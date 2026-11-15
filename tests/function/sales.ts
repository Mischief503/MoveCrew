// Sales texts in the Edge Function (Nov 14, batch 2: "text the quote, follow up by itself"): the office and the call
// center text a priced open quote from the company line; it counts on the job's sales record; the follow-ups go out with
// the evening cron (days 1, 3 and 7) while the quote stays open and quiet; a text back lands on the lead and stops them;
// the office answers from the lead. The harness is test.ts's: an in-memory PostgREST, a fake Twilio and auth server.
// Run: deno run -A tests/function/sales.ts
// deno-lint-ignore-file no-explicit-any
(globalThis as any).__TALLY_TEST = true;
Deno.env.set("SUPABASE_URL", "https://proj.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service");
Deno.env.set("TWILIO_ACCOUNT_SID", "ACtest");
Deno.env.set("TWILIO_AUTH_TOKEN", "tok123");
const fn = await import("../../supabase/functions/tally-twilio/index.ts");
const BASE = "https://proj.supabase.co/functions/v1/tally-twilio";

let failures = 0, passes = 0;
function ok(c: unknown, m: string) { if (c) { passes++; console.log("PASS", m); } else { failures++; console.log("FAIL", m); } }

/* ---------- in-memory database ---------- */
const DB: Record<string, any[]> = { docs: [], members: [], comm_lines: [], comm_log: [], comm_job_state: [], tally_cc_team: [], cc_orgs: [] };
let nextId = 1;
const clone = (o: any) => JSON.parse(JSON.stringify(o));
function getField(row: any, key: string) {
  if (key.indexOf("->") < 0) return row[key];
  const parts = key.split(/->>?/);
  let v = row[parts[0]];
  for (const p of parts.slice(1)) v = v == null ? v : v[p];
  return v == null ? v : String(v);
}
function matches(row: any, filters: [string, string][]) {
  return filters.every(([k, f]) => {
    const i = f.indexOf("."), op = f.slice(0, i), val = f.slice(i + 1), v = getField(row, k);
    if (op === "eq") return String(v) === val;
    if (op === "neq") return String(v) !== val;
    if (op === "is") return val === "true" ? v === true : val === "null" ? v == null : v === false;
    if (op === "gte") return String(v) >= val;
    if (op === "lt") return String(v) < val;
    if (op === "lte") return v != null && String(v) <= val;
    if (op === "in") return val.replace(/^\(|\)$/g, "").split(",").indexOf(String(v)) >= 0;
    if (op === "ilike" || op === "like") { const re = new RegExp("^" + val.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$", op === "ilike" ? "i" : ""); return v != null && re.test(String(v)); }
    throw new Error("op " + op);
  });
}
function restMock(method: string, u: URL, body: any, prefer: string) {
  const table = u.pathname.split("/").pop()!;
  const rows = DB[table];
  if (!rows) return { status: 404, body: { message: "no table " + table } };
  const filters: [string, string][] = []; let limit = 1e9, order = "", onConflict = "";
  u.searchParams.forEach((v, k) => {
    if (k === "select") return; if (k === "limit") { limit = +v; return; } if (k === "order") { order = v; return; } if (k === "on_conflict") { onConflict = v; return; }
    filters.push([k, v]);
  });
  const rep = prefer.indexOf("return=representation") >= 0;
  if (method === "GET") {
    let out = rows.filter((r) => matches(r, filters));
    if (order) { const [f, d] = order.split("."); out = out.slice().sort((a, b) => (a[f] < b[f] ? -1 : 1) * (d === "desc" ? -1 : 1)); }
    return { status: 200, body: clone(out.slice(0, limit)) };
  }
  if (method === "POST") {
    const list = Array.isArray(body) ? body : [body], added: any[] = [];
    for (const r0 of list) {
      const r = clone(r0);
      if (onConflict) {
        const keys = onConflict.split(",");
        if (rows.some((x) => keys.every((k) => String(x[k]) === String(r[k])))) { if (prefer.indexOf("ignore-duplicates") >= 0) continue; return { status: 409, body: { message: "dup" } }; }
      }
      if (table === "comm_log") { r.id = nextId++; r.created_at = r.created_at || new Date().toISOString(); }
      rows.push(r); added.push(r);
    }
    return { status: 201, body: rep ? clone(added) : null };
  }
  if (method === "PATCH") {
    const hit = rows.filter((r) => matches(r, filters));
    hit.forEach((r) => { Object.assign(r, clone(body)); if (table === "docs") r.updated_at = String(body.updated_at || new Date().toISOString()) + "#" + (nextId++); });
    return { status: 200, body: rep ? clone(hit) : null };
  }
  if (method === "DELETE") {
    const goneRows = rows.filter((r) => matches(r, filters)), keep = rows.filter((r) => !matches(r, filters)), gone = goneRows.length;
    rows.length = 0; keep.forEach((r) => rows.push(r));
    return { status: 200, body: rep ? clone(goneRows) : null, gone };
  }
  return { status: 405, body: null };
}

/* ---------- fake Twilio and auth ---------- */
const sent: any[] = [];
const routesCalls: any[] = [];
let twilioFail = "";
let onSend: ((p: any) => Promise<void>) | null = null;   // runs once, as a text is being sent
const USERS: Record<string, string> = { "tok-owner": "u-owner", "tok-dispatch": "u-dispatch", "tok-marcus": "u-marcus", "tok-kim": "u-kim", "tok-stranger": "u-stranger", "tok-jess": "u-jess" };
(globalThis as any).fetch = async (input: string, init: any = {}) => {
  const u = new URL(input), method = (init.method || "GET").toUpperCase();
  const reply = (status: number, b: any) => new Response(b == null ? "" : JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
  if (u.host === "api.twilio.com") {
    const p = Object.fromEntries(new URLSearchParams(init.body));
    const kind = u.pathname.endsWith("Messages.json") ? "sms" : "call";
    if (twilioFail) return reply(400, { message: twilioFail });
    if (onSend) {
      const f = onSend; onSend = null;
      // a hold that the function's own timeout can cut short, like a real hung connection
      await Promise.race([f(p), new Promise((_, rej) => init.signal && init.signal.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))))]);
    }
    const sid = (kind === "sms" ? "SM" : "CA") + (sent.length + 1);
    sent.push({ kind, sid, ...p });
    return reply(201, { sid, status: "queued" });
  }
  if (u.host === "routes.googleapis.com") {
    const h = init.headers, bd = JSON.parse(init.body);
    routesCalls.push({ h, bd });
    if (h["X-Goog-Api-Key"] !== "gkey") return reply(403, { error: { message: "API key not valid" } });
    if (/nowhere/i.test(bd.destination.address)) return reply(200, {});
    if (/zzz/i.test(bd.destination.address)) return reply(400, { error: { message: "Address not found: origin or destination could not be geocoded" } });
    return reply(200, { routes: [{ distanceMeters: 36049, duration: "1862s" }] });
  }
  if (u.pathname === "/auth/v1/user") {
    const t = String(init.headers.Authorization || "").replace("Bearer ", "");
    return USERS[t] ? reply(200, { id: USERS[t] }) : reply(401, { message: "bad jwt" });
  }
  if (u.pathname.startsWith("/rest/v1/")) {
    const h = init.headers || {};
    if (h.Authorization !== "Bearer service") return reply(401, { message: "not service" });
    const r = restMock(method, u, init.body ? JSON.parse(init.body) : undefined, h.Prefer || "");
    return reply(r.status, r.body);
  }
  throw new Error("unexpected fetch " + input);
};

/* ---------- a company ---------- */
const ORG = "org-1", ORG2 = "org-2";
const tomorrow = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
const later = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
const settings = {
  company: "Ace Moving — Austin",
  contacts: { Owner: "512-555-0100", Dispatch: "(512) 555-0199", Marcus: "512-555-0101", Dee: "512.555.0102", Luis: "", Kim: "512-555-0106", Jess: "512-555-0107" },
  office: [{ name: "Owner", kind: "owner" }, { name: "Dispatch", kind: "dispatch" }],
  leads: ["Marcus"], trucks: [{ id: "t26", name: "Box 1 (26 ft)" }],
  forms: [{ id: "f1", title: "Delivery receipt", required: true }, { id: "f2", title: "Optional", required: false }],
  comms: { alerts: { assigned: true, moved: true, forms: true } },
};
function job(id: string, over: any = {}) {
  return { id, status: "booked", d: { name: "Priya “P” Nair", phone: "512-555-0142", moveDate: tomorrow, time: "08:00", from: "418 Oak St, Austin", to: "77 Ridge Rd" }, assign: { truckId: "t26", crew: ["Marcus", "Dee"] }, signed: {}, ...over };
}
function putDoc(org: string, path: string, data: any) {
  const [collection, doc_id] = path.split("/");
  const i = DB.docs.findIndex((r) => r.org_id === org && r.path === path);
  // not frozen here (test.ts freezes its rows): the sales texts write to a job (jobWrite), like the customer side's custWrite
  const row = { org_id: org, path, collection, doc_id, data: clone(data), updated_at: new Date().toISOString() };
  if (i >= 0) DB.docs[i] = row; else DB.docs.push(row);
}
putDoc(ORG, "org/settings", settings);
putDoc(ORG2, "org/settings", { company: "Stranger Co", contacts: {}, office: [] });
DB.members.push(
  { org_id: ORG, user_id: "u-owner", role: "owner", staff: "Owner" },
  { org_id: ORG, user_id: "u-dispatch", role: "dispatch", staff: "Dispatch" },
  { org_id: ORG, user_id: "u-marcus", role: "lead", staff: "Marcus" },
  { org_id: ORG, user_id: "u-kim", role: "crew", staff: "Kim" },
  { org_id: ORG2, user_id: "u-stranger", role: "owner", staff: "Zed" },
);

async function app(tok: string, body: any, origin?: string) {
  const h: Record<string, string> = { Authorization: "Bearer " + tok, "Content-Type": "application/json" };
  if (origin) h.Origin = origin;
  const r = await fn.handle(new Request(BASE + "/app", { method: "POST", headers: h, body: JSON.stringify(body) }));
  return { status: r.status, body: await r.json() };
}
async function hook(sub: string, params: Record<string, string>, opts: { badSig?: boolean } = {}) {
  const url = BASE + "/twilio/" + sub;
  const u = new URL(url);
  const sig = await fn.twilioSignature(u.origin + u.pathname + u.search, params, opts.badSig ? "wrong" : "tok123");
  const r = await fn.handle(new Request(url, { method: "POST", headers: { "X-Twilio-Signature": sig, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params).toString() }));
  return { status: r.status, text: await r.text() };
}
const smsTo = (n: string) => sent.filter((s) => s.kind === "sms" && s.To === n);


/* ---------- the company's line, a call center person, and some quotes ---------- */
DB.comm_lines.push({ org_id: ORG, phone_number: "+15125550000", enabled: true });
DB.tally_cc_team.push({ email: "jess@x.com", name: "Jess", phone: "512-555-0107", user_id: "u-jess" });
DB.cc_orgs.push({ org_id: ORG });
const NOW = Date.now();
function quote(id: string, over: any = {}) {
  return { id, status: "quoted", createdAt: NOW - 36e5, d: { name: "Sam Kowalski", phone: "512-555-0120", email: "sam@example.com", moveDate: later, time: "09:00", from: "Austin", to: "Waco" },
    quote: { total: 1065, crew: 3, hours: 5 }, assign: { truckId: "", crew: [] }, log: {}, ...over };
}
const docOf = (id: string) => DB.docs.find((r) => r.org_id === ORG && r.path === "jobs/" + id).data;
const logs = (id: string) => Object.values(docOf(id).log || {}).map((l: any) => l.ev);
const SITE = "https://mischief503.github.io/MoveCrew/";
putDoc(ORG, "jobs/q1", quote("q1"));
putDoc(ORG, "jobs/q2", quote("q2", { status: "lead", quote: { total: 0 }, d: { name: "Rosa Diaz", phone: "512-555-0133" } }));
putDoc(ORG, "jobs/q3", quote("q3", { status: "booked" }));
putDoc(ORG, "jobs/q4", quote("q4", { test: true }));
putDoc(ORG, "jobs/q5", quote("q5", { d: { name: "Hollis & Reed Law", phone: "", moveDate: later } }));

/* ---------- the wording ---------- */
{
  const body = fn.salesBody(settings, quote("x"), "quote", SITE, "(512) 555-0000");
  const day = fn.fmtDay(later);
  ok(body === "Ace Moving - Austin: Hi Sam, your moving quote is $1,065 for " + day + " at 9:00 AM (3 movers, about 5 hours). See it and book online: " + SITE + " (sign in with sam@example.com). Reply here with any questions.",
    "the quote text: first name, price, day and time, crew, the link to book with their email: " + body);
  ok(fn.salesBody(settings, quote("x", { d: { name: "Hollis & Reed Law", moveDate: "" } }), "quote", SITE, "") .indexOf("Hi there, your moving quote is $1,065 for the day you pick (3 movers") > 0, "a company's name isn't a first name, and no day yet says so");
  ok(fn.salesBody(settings, quote("x", { d: { name: "Sam", email: "" } }), "quote", SITE, "").indexOf("book online") < 0, "no email on the quote: no link (they sign in with it)");
  ok(fn.salesBody({ ...settings, opt: { custBook: false } }, quote("x"), "quote", SITE, "").indexOf("book online") < 0, "customers can't book their own quote: no link");
  ok(fn.salesBody({ ...settings, salesTpl: { quote: "{company}: {first}, {total} on {when}. Call {phone}." } }, quote("x"), "quote", SITE, "(512) 555-0000") === "Ace Moving - Austin: Sam, $1,065 on " + day + " at 9:00 AM. Call (512) 555-0000.",
    "the company's own wording, filled in");
  ok(/^Ace Moving - Austin: Hi Sam, checking you got your moving quote: \$1,065 for /.test(fn.salesBody(settings, quote("x"), "f1", "", "(512) 555-0000")) && /call \(512\) 555-0000\.$/.test(fn.salesBody(settings, quote("x"), "f1", "", "(512) 555-0000")), "follow-up 1 names the price, the day and the company line");
}

/* ---------- who may text a quote ---------- */
let r = await app("tok-kim", { action: "quote_text", org: ORG, jobId: "q1", url: SITE });
ok(r.status === 403 && sent.length === 0, "a crew member can't text quotes");
r = await app("tok-stranger", { action: "quote_text", org: ORG, jobId: "q1", url: SITE });
ok(r.status === 401, "someone from another company can't either");
r = await app("tok-owner", { action: "quote_text", org: ORG, jobId: "q2", url: SITE });
ok(r.body.ok === false && /Price it first/.test(r.body.message), "a lead with no price: price it first");
r = await app("tok-owner", { action: "quote_text", org: ORG, jobId: "q3", url: SITE });
ok(r.body.ok === false && /booked or closed/.test(r.body.message), "a booked job: not a quote any more");
r = await app("tok-owner", { action: "quote_text", org: ORG, jobId: "q4", url: SITE });
ok(r.body.ok === false && /Test job/.test(r.body.message), "a test job texts nobody");
r = await app("tok-owner", { action: "quote_text", org: ORG, jobId: "q5", url: SITE });
ok(r.body.ok === false && /no customer phone/.test(r.body.message) && sent.length === 0, "no phone number: nothing to text");

/* ---------- the quote, texted ---------- */
r = await app("tok-dispatch", { action: "quote_text", org: ORG, jobId: "q1", url: SITE });
const t1 = smsTo("+15125550120");
ok(r.body.ok && r.body.message === "Texted Sam Kowalski the quote." && t1.length === 1 && t1[0].From === "+15125550000" && /your moving quote is \$1,065/.test(t1[0].Body) && t1[0].Body.indexOf(SITE) > 0,
  "dispatch texts the quote from the company line: " + (t1[0] && t1[0].Body));
const l1 = DB.comm_log.find((x) => x.job_id === "q1" && x.purpose === "quote");
ok(l1 && l1.staff === "Dispatch" && l1.direction === "out" && l1.party === "Sam Kowalski", "logged as the quote text, by Dispatch");
let s = docOf("q1").sales;
ok(s.n === 1 && s.last.k === "qsent" && s.last.by === "Dispatch" && s.owner === "Dispatch" && s.qs.n === 1 && s.fu === null && s.first > 0, "the lead's record: counted, Dispatch works it, follow-ups off: " + JSON.stringify(s));
ok(logs("q1").indexOf("Quote texted by Dispatch") >= 0, "the activity says so");
r = await app("tok-owner", { action: "quote_text", org: ORG, jobId: "q1", url: SITE });
ok(r.body.ok === false && /a moment ago/.test(r.body.message) && smsTo("+15125550120").length === 1, "again within 10 minutes: not twice");

/* ---------- the follow-ups: off, then on ---------- */
let f = await fn.runFollowUps(NOW + 2 * 864e5);
ok(f.ok && f.report[0].follow === "off" && smsTo("+15125550120").length === 1, "follow-up texts off: the cron sends none");
putDoc(ORG, "org/settings", { ...settings, opt: { salesFollow: true } });
DB.comm_log.forEach((x) => { if (x.purpose === "quote") x.created_at = new Date(NOW - 3600e3).toISOString(); });
putDoc(ORG, "jobs/q6", quote("q6", { d: { name: "Lena Wu", phone: "512-555-0144", email: "", moveDate: later, time: "09:00" } }));
r = await app("tok-owner", { action: "quote_text", org: ORG, jobId: "q6", url: SITE });
s = docOf("q6").sales;
ok(r.body.ok && /Follow-ups go out in 1, 3 and 7 days/.test(r.body.message) && s.fu.step === 0 && s.fu.from > 0 && s.fu.at === s.fu.from + 864e5 && logs("q6").indexOf("Quote texted by Owner; follow-up texts are on") >= 0,
  "with follow-ups on, texting the quote starts them: " + JSON.stringify(s.fu));
const from = s.fu.from;
f = await fn.runFollowUps(from + 12 * 36e5);
ok(smsTo("+15125550144").length === 1, "half a day later: nothing yet");
f = await fn.runFollowUps(from + 864e5 + 60e3);
let w = smsTo("+15125550144");
s = docOf("q6").sales;
ok(w.length === 2 && /^Ace Moving - Austin: Hi Lena, checking you got your moving quote/.test(w[1].Body) && s.fu.step === 1 && s.fu.at === from + 3 * 864e5 && s.fus === 1 && logs("q6").indexOf("Follow-up text 1 of 3 sent") >= 0,
  "a day later: follow-up 1, and the next one set for day 3: " + w[1].Body);
ok(DB.comm_log.some((x) => x.job_id === "q6" && x.purpose === "follow-up" && !x.staff), "logged as a follow-up, from no one in particular");
f = await fn.runFollowUps(from + 864e5 + 120e3);
ok(smsTo("+15125550144").length === 2, "the cron running again the same evening sends nothing more");
await fn.runFollowUps(from + 3 * 864e5 + 60e3);
await fn.runFollowUps(from + 7 * 864e5 + 60e3);
w = smsTo("+15125550144"); s = docOf("q6").sales;
ok(w.length === 4 && /still open with us/.test(w[2].Body) && /last check-in/.test(w[3].Body) && s.fu === null && s.fus === 3 && logs("q6").indexOf("Follow-up text 3 of 3 sent") >= 0, "days 3 and 7: follow-ups 2 and 3, then done");
await fn.runFollowUps(from + 30 * 864e5);
ok(smsTo("+15125550144").length === 4, "and never a fourth");

/* ---------- a text back stops them ---------- */
putDoc(ORG, "jobs/q7", quote("q7", { d: { name: "Owen Patel", phone: "512-555-0155", moveDate: later, time: "10:00" } }));
r = await app("tok-owner", { action: "quote_text", org: ORG, jobId: "q7", url: SITE });
const nFwd = sent.length;
let h = await hook("sms", { From: "+15125550155", To: "+15125550000", Body: "Is Saturday open instead?", MessageSid: "SMin1" });
s = docOf("q7").sales;
ok(h.status === 200 && s.in && s.in.t === "Is Saturday open instead?" && s.in.at > 0 && s.fu === null && logs("q7").indexOf("Texted back: “Is Saturday open instead?”") >= 0, "a text back lands on the lead and stops the follow-ups: " + JSON.stringify(s.in));
ok(sent.slice(nFwd).some((x) => /Text to the company line from Owen Patel: Is Saturday open instead\?/.test(x.Body)), "and the office still gets it forwarded, as before");
await fn.runFollowUps(Date.now() + 2 * 864e5);
ok(smsTo("+15125550155").length === 1, "no follow-up after a text back");

/* ---------- the office answers from the lead ---------- */
r = await app("tok-owner", { action: "sales_text", org: ORG, jobId: "q7", body: "  Yes! Saturday at 9 works.  Want it? " });
const ans = smsTo("+15125550155");
s = docOf("q7").sales;
ok(r.body.ok && r.body.message === "Texted Owen Patel." && ans.length === 2 && ans[1].Body === "Ace Moving - Austin: Yes! Saturday at 9 works. Want it?" && s.last.k === "texted" && s.last.at > s.in.at && logs("q7").some((e) => e === "Texted by Owner: “Yes! Saturday at 9 works. Want it?”"),
  "the owner answers: from the company line, with the company's name, counted (and so answered): " + (ans[1] && ans[1].Body));
r = await app("tok-owner", { action: "sales_text", org: ORG, jobId: "q7", body: "   " });
ok(r.body.ok === false && /Write the text first/.test(r.body.message), "an empty text: write it first");
r = await app("tok-owner", { action: "sales_text", org: ORG, jobId: "q7", body: "x".repeat(481) });
ok(r.body.ok === false && /under 480/.test(r.body.message), "a very long one: keep it under 480");
r = await app("tok-kim", { action: "sales_text", org: ORG, jobId: "q7", body: "hi" });
ok(r.status === 403, "crew can't text customers from Sales");

/* ---------- STOP, and a call logged since the quote ---------- */
putDoc(ORG, "jobs/q8", quote("q8", { d: { name: "Chloe Martin", phone: "512-555-0166", moveDate: later, time: "10:00" } }));
r = await app("tok-owner", { action: "quote_text", org: ORG, jobId: "q8", url: SITE });
h = await hook("sms", { From: "+15125550166", To: "+15125550000", Body: "STOP", MessageSid: "SMin2" });
s = docOf("q8").sales;
ok(s.fu === null && !s.in && logs("q8").indexOf("Texted STOP: no more texts from the company line") >= 0, "STOP: the follow-ups stop, and it isn't a question to answer");
putDoc(ORG, "jobs/q9", quote("q9", { d: { name: "Devon Reyes", phone: "512-555-0177", moveDate: later, time: "10:00" } }));
r = await app("tok-owner", { action: "quote_text", org: ORG, jobId: "q9", url: SITE });
const q9 = docOf("q9"); putDoc(ORG, "jobs/q9", { ...q9, sales: { ...q9.sales, last: { k: "talked", at: q9.sales.fu.from + 36e5, by: "Owner" }, n: 2 } });
await fn.runFollowUps(q9.sales.fu.from + 864e5 + 60e3);
s = docOf("q9").sales;
ok(smsTo("+15125550177").length === 1 && s.fu === null && logs("q9").indexOf("Follow-up texts stopped") >= 0, "someone called them after the quote went out: no follow-ups (a person has it now)");
putDoc(ORG, "jobs/qa", quote("qa", { d: { name: "Grace Pham", phone: "512-555-0188", moveDate: later, time: "10:00" } }));
r = await app("tok-owner", { action: "quote_text", org: ORG, jobId: "qa", url: SITE });
const qa = docOf("qa"); putDoc(ORG, "jobs/qa", { ...qa, status: "booked" });
await fn.runFollowUps(qa.sales.fu.from + 864e5 + 60e3);
ok(smsTo("+15125550188").length === 1, "booked meanwhile: no follow-up");

/* ---------- the call center ---------- */
putDoc(ORG, "jobs/qb", quote("qb", { d: { name: "Ibrahim Sayed", phone: "512-555-0191", email: "ib@example.com", moveDate: later, time: "10:00" } }));
r = await app("tok-jess", { action: "quote_text", org: ORG, jobId: "qb", url: SITE });
s = docOf("qb").sales;
ok(r.body.ok && smsTo("+15125550191").length === 1 && s.owner === "Jess" && s.last.by === "Jess" && logs("qb").indexOf("Quote texted by Jess (call center); follow-up texts are on") >= 0, "MoveCrew's call center texts a quote too, and it's theirs to work: " + logs("qb").slice(-1)[0]);
r = await app("tok-jess", { action: "sales_text", org: ORG, jobId: "qb", body: "Any questions about the quote?" });
ok(r.body.ok && logs("qb").some((e) => e === "Texted by Jess (call center): “Any questions about the quote?”"), "and answers texts");

console.log(`\nsales texts: ${passes} passed, ${failures} failed`);
if (failures) Deno.exit(1);

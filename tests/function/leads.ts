// Leads that come in by themselves (Nov 14, Sales batch 3): a website's Get a quote form (POST /lead, no sign-in)
// lands in Sales and texts the office; a missed call to the company line lands in Sales (on the caller's open lead, or
// as a new one); a company with MoveCrew's call center service rings the team's phones too, and they hear its name.
// The harness is sales.ts's (test.ts's, with job rows that take writes). Run: deno run -A tests/function/leads.ts
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
const ORG = "0a1b2c3d-1111-4222-8333-944455556666", ORG2 = "0a1b2c3d-1111-4222-8333-944455557777";
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



/* ---------- the company's line and MoveCrew's call center ---------- */
DB.comm_lines.push({ org_id: ORG, phone_number: "+15125550000", enabled: true });
DB.tally_cc_team.push({ email: "jess@x.com", name: "Jess", phone: "512-555-0107", user_id: "u-jess" }, { email: "ana@x.com", name: "Ana", phone: "512-555-0108", user_id: "u-ana" });
DB.cc_orgs.push({ org_id: ORG });
const docOf = (id: string) => (DB.docs.find((r) => r.org_id === ORG && r.path === "jobs/" + id) || {}).data;
const logs = (id: string) => Object.values((docOf(id) || {}).log || {}).map((l: any) => l.ev);
const jobsBy = (src: string) => DB.docs.filter((r) => r.org_id === ORG && r.collection === "jobs" && r.data.d && r.data.d.source === src).map((r) => r.data);
async function lead(body: any, raw?: string) {
  const r = await fn.handle(new Request(BASE + "/lead", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://mischief503.github.io" }, body: raw !== undefined ? raw : JSON.stringify(body) }));
  return { status: r.status, cors: r.headers.get("Access-Control-Allow-Origin"), body: await r.json() };
}
const day = new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10);
const ask = (over: any = {}) => ({ org: ORG, name: "Lena Wu", phone: "512-555-0150", email: "lena@example.com", from: "12 Elm St, Austin", to: "Round Rock", date: day, size: "b2", note: "Piano in the living room", ms: 30000, hp: "", ...over });

/* ---------- the form: whose it is ---------- */
let r = await lead({ org: "not-a-company", probe: true });
ok(r.body.ok === false && /isn't complete/.test(r.body.message), "a link with no company in it: ask for it again");
r = await lead({ org: "0a1b2c3d-1111-4222-8333-000000000000", probe: true });
ok(r.body.ok === false, "a company that isn't here: the same");
r = await lead({ org: ORG, probe: true });
ok(r.body.ok === true && r.body.company === "Ace Moving - Austin" && r.cors === "*", "the form asks whose it is: the company's name (and any website may ask)");
const opt = await fn.handle(new Request(BASE + "/lead", { method: "OPTIONS" }));
ok(opt.status === 200 && opt.headers.get("Access-Control-Allow-Methods") === "POST, OPTIONS", "a browser's check first is answered");
r = await lead({}, "not json");
ok(r.body.ok === false, "not a form at all: no");

/* ---------- a bot ---------- */
r = await lead(ask({ hp: "http://spam.example" }));
ok(r.body.ok === true && jobsBy("Website").length === 0 && sent.length === 0, "the hidden box filled in: it's told all went well, and nothing is made");
r = await lead(ask({ ms: 900 }));
ok(r.body.ok === true && jobsBy("Website").length === 0, "sent in under 2.5 seconds: the same");
r = await lead(ask({ ms: undefined }));
ok(r.body.ok === true && jobsBy("Website").length === 0, "no time on it: the same");

/* ---------- what it needs ---------- */
r = await lead(ask({ name: "  " }));
ok(r.body.ok === false && r.body.message === "Put in your name.", "no name");
r = await lead(ask({ phone: "555-01" }));
ok(r.body.ok === false && /phone number we can call you at/.test(r.body.message), "no phone number to call");
r = await lead(ask({ email: "lena@" }));
ok(r.body.ok === false && /email doesn't look right/.test(r.body.message), "an email that isn't one");
r = await lead(ask({ from: "" }));
ok(r.body.ok === false && /moving from/.test(r.body.message), "no pickup");
r = await lead(ask({ date: "2020-01-01" }));
ok(r.body.ok === false && /between today and a year from now/.test(r.body.message), "a day gone by");
ok(jobsBy("Website").length === 0 && sent.length === 0, "none of those made a lead or a text");

/* ---------- a real request ---------- */
r = await lead(ask());
const L = jobsBy("Website")[0];
ok(r.status === 200 && r.body.ok === true && r.body.company === "Ace Moving - Austin" && !!L, "a request: a new lead");
ok(L && L.status === "lead" && /^w/.test(L.id) && L.d.name === "Lena Wu" && L.d.phone === "512-555-0150" && L.d.email === "lena@example.com" && L.d.from === "12 Elm St, Austin" && L.d.to === "Round Rock" && L.d.moveDate === day,
  "the lead has who, where and when");
ok(L && L.d.notes === "Home: 2 bedrooms\nFrom the website: Piano in the living room" && !(Number(L.quote.total) > 0) && L.sales && L.sales.web && L.sales.web.at > 0 && !L.sales.n,
  "the size and the note in its notes, no price yet, and New in Sales (no contact yet)");
ok(logs(L.id).indexOf("Asked for a quote on the website") >= 0, "its activity says where it came from");
const tx = sent.filter((x) => x.kind === "sms");
ok(tx.length === 2 && tx.map((x) => x.To).sort().join() === "+15125550100,+15125550199" &&
  tx[0].Body.indexOf("Ace Moving - Austin: New lead from your website: Lena Wu, (512) 555-0150, 12 Elm St, Austin to Round Rock, " + fn.fmtDay(day) + ". It's in Sales. Call them soon.") === 0,
  "the office is texted from the company line: " + (tx[0] && tx[0].Body));
ok(DB.comm_log.some((x) => x.purpose === "web-lead" && x.job_id === L.id), "the texts are on the lead's log");

/* ---------- the same person again ---------- */
const n0 = sent.length;
r = await lead(ask({ note: "Also a gun safe" }));
ok(r.body.ok === true && jobsBy("Website").length === 1 && logs(L.id).some((e) => e === "Asked again on the website: “Also a gun safe”") && sent.length === n0,
  "asked again while it's open: on the same lead, not a second one, and no new text");

/* ---------- the alert switched off, and a flood ---------- */
DB.docs.find((x) => x.org_id === ORG && x.path === "org/settings").data.comms.alerts.webLead = false;
r = await lead(ask({ name: "Omar Ali", phone: "512-555-0151", email: "", to: "", date: "", size: "", note: "" }));
const O = jobsBy("Website").find((x) => x.d.name === "Omar Ali");
ok(r.body.ok && O && O.d.to === "" && O.d.moveDate === "" && O.d.notes === "" && sent.length === n0, "New leads from your website off: the lead, no text");
for (let i = 0; i < 30; i++) DB.docs.push({ org_id: ORG, path: "jobs/flood" + i, collection: "jobs", doc_id: "flood" + i, updated_at: "x", data: { id: "flood" + i, status: "lead", createdAt: Date.now() - 6e4, d: { source: "Website", phone: "" } } });
r = await lead(ask({ name: "Bot", phone: "512-555-0152" }));
ok(r.body.ok === false && /a lot of requests right now/.test(r.body.message), "30 in the last hour: call us instead");
DB.docs = DB.docs.filter((x) => !/^jobs\/flood/.test(x.path));
DB.docs.find((x) => x.org_id === ORG && x.path === "org/settings").data.comms.alerts.webLead = true;

/* ---------- a call: the office's phones, and the call center's ---------- */
let h = await hook("voice", { From: "+15125550177", To: "+15125550000", CallSid: "CAin1" });
ok(/<Number url="[^"]*\/twilio\/whisper\?log=\d+">\+15125550100<\/Number>/.test(h.text) && /\+15125550199<\/Number>/.test(h.text), "a call rings the office as before");
ok(/<Number url="[^"]*\/twilio\/whisper\?log=\d+&amp;cc=1">\+15125550107<\/Number>/.test(h.text) && /cc=1">\+15125550108<\/Number>/.test(h.text),
  "and, with the call center service, the call center's phones: " + h.text);
const row1 = DB.comm_log.filter((x) => x.channel === "call" && x.direction === "in").pop();
h = await hook("whisper?log=" + row1.id + "&cc=1", { To: "+15125550107" });
ok(h.text.indexOf("<Say>Call for Ace Moving - Austin, from an unknown caller.</Say>") >= 0, "the call center hears which company it is: " + h.text);
h = await hook("whisper?log=" + row1.id, { To: "+15125550100" });
ok(h.text.indexOf("<Say>Move Crew call from an unknown caller.</Say>") >= 0, "the company's own people hear it as before");

/* ---------- nobody picked up: a new lead ---------- */
const s0 = sent.length;
h = await hook("after?log=" + row1.id, { From: "+15125550177", To: "+15125550000", DialCallStatus: "no-answer" });
const M = jobsBy("Missed call")[0];
ok(!!M && M.status === "lead" && /^m/.test(M.id) && M.d.phone === "(512) 555-0177" && M.d.name === "" && M.sales.missed.at > 0 && !M.sales.n, "a missed call from someone new: a lead to call back, with their number");
ok(logs(M.id).indexOf("Missed call on the company line: a new lead to call back") >= 0 && DB.comm_log.find((x) => x.id === row1.id).job_id === M.id && DB.comm_log.find((x) => x.id === row1.id).status === "missed",
  "its activity says so, and the call is on its log");
const mt = sent.slice(s0).filter((x) => x.kind === "sms");
ok(mt.length === 2 && /Missed call on the company line from an unknown caller \+15125550177\. It's in Sales as a new lead\. Call them back from MoveCrew\./.test(mt[0].Body), "the office's text says where it is: " + (mt[0] && mt[0].Body));
ok(/We got your number and will call you right back/.test(h.text), "the caller hears they'll be called back");

/* ---------- they call again, and nobody picks up again ---------- */
h = await hook("voice", { From: "+15125550177", To: "+15125550000", CallSid: "CAin2" });
const row2 = DB.comm_log.filter((x) => x.channel === "call" && x.direction === "in").pop();
ok(row2.job_id === M.id, "the second call is theirs");
const s1 = sent.length;
await hook("after?log=" + row2.id, { From: "+15125550177", To: "+15125550000", DialCallStatus: "busy" });
ok(jobsBy("Missed call").length === 1 && logs(M.id).indexOf("Missed their call on the company line") >= 0 && docOf(M.id).sales.missed.at >= M.sales.missed.at,
  "missed again: on the same lead, not a second one");
ok(sent.slice(s1).some((x) => /It's on their lead in Sales\./.test(x.Body)), "and the office's text says so");

/* ---------- a quote's customer, a booked one, and someone who works here ---------- */
putDoc(ORG, "jobs/q1", { id: "q1", status: "quoted", createdAt: Date.now() - 864e5, d: { name: "Sam Kowalski", phone: "512-555-0120" }, quote: { total: 1065 }, sales: { n: 1, last: { k: "talked", at: Date.now() - 864e5, by: "Owner" } }, log: {} });
h = await hook("voice", { From: "+15125550120", To: "+15125550000", CallSid: "CAin3" });
let row = DB.comm_log.filter((x) => x.channel === "call" && x.direction === "in").pop();
await hook("after?log=" + row.id, { From: "+15125550120", To: "+15125550000", DialCallStatus: "no-answer" });
ok(docOf("q1").sales.missed.at > 0 && docOf("q1").sales.n === 1 && logs("q1").indexOf("Missed their call on the company line") >= 0 && jobsBy("Missed call").length === 1, "a quote's customer: on their quote");
putDoc(ORG, "jobs/b1", { id: "b1", status: "booked", createdAt: Date.now() - 864e5, d: { name: "Priya Nair", phone: "512-555-0142" }, quote: { total: 900 }, log: {} });
h = await hook("voice", { From: "+15125550142", To: "+15125550000", CallSid: "CAin4" });
row = DB.comm_log.filter((x) => x.channel === "call" && x.direction === "in").pop();
const s2 = sent.length;
await hook("after?log=" + row.id, { From: "+15125550142", To: "+15125550000", DialCallStatus: "no-answer" });
ok(!docOf("b1").sales && jobsBy("Missed call").length === 1 && sent.slice(s2).some((x) => /from Priya Nair \+15125550142\. Call them back from MoveCrew\.$/.test(x.Body)), "a booked customer: not a sale, the office's text as before");
h = await hook("voice", { From: "+15125550101", To: "+15125550000", CallSid: "CAin5" });
ok(h.text.indexOf("cc=1") < 0, "Marcus calling in: the call center's phones don't ring");
row = DB.comm_log.filter((x) => x.channel === "call" && x.direction === "in").pop();
await hook("after?log=" + row.id, { From: "+15125550101", To: "+15125550000", DialCallStatus: "no-answer" });
ok(jobsBy("Missed call").length === 1, "and his missed call isn't a lead");

/* ---------- without the call center service, and with nobody to ring ---------- */
DB.cc_orgs.length = 0;
h = await hook("voice", { From: "+15125550188", To: "+15125550000", CallSid: "CAin6" });
ok(h.text.indexOf("cc=1") < 0 && h.text.indexOf("+15125550100") > 0, "a company without the service: its own people only");
DB.docs.find((x) => x.org_id === ORG && x.path === "org/settings").data.comms.ring = ["Luis"];   // Luis has no phone number
h = await hook("voice", { From: "+15125550189", To: "+15125550000", CallSid: "CAin7" });
ok(/No one can take your call right now/.test(h.text) && jobsBy("Missed call").some((x) => x.d.phone === "(512) 555-0189"), "nobody to ring: the caller is told, and it's a lead to call back");

/* ---------- MoveCrew admin: what the call center booked, by company and month (Nov 17, Sales batch 4) ---------- */
{
  const now = Date.UTC(2026, 10, 17, 20, 0, 0);   // Nov 17, 2026, noon in Oregon
  const at = (y: number, m: number, d: number, h = 18) => Date.UTC(y, m, d, h, 0, 0);
  const jb = (org: string, id: string, data: any) => DB.docs.push({ org_id: org, path: "jobs/" + id, collection: "jobs", doc_id: id, updated_at: "x", data: { id, ...data } });
  const lg = (ev: string, ts: number) => ({ k1: { ts, ev } });
  // Ace (ORG): Jess made a quote and booked it this month; Ana booked the office's quote this month; Jess made one as Booked in October (before bookedCC)
  jb(ORG, "b1", { status: "booked", createdAt: at(2026, 10, 3), createdCC: true, log: lg("Created as Quoted by Jess (call center)", at(2026, 10, 3)), bookedCC: { at: at(2026, 10, 5), by: "Jess", team: true } });
  jb(ORG, "b2", { status: "booked", createdAt: at(2026, 9, 20), log: lg("Created as Quoted by Owner", at(2026, 9, 20)), bookedCC: { at: at(2026, 10, 9), by: "Ana", team: true } });
  jb(ORG, "b3", { status: "done", createdAt: at(2026, 9, 14), createdCC: true, log: [{ ts: at(2026, 9, 14), ev: "Created as Booked by Jess (call center)" }] });
  // a company's own call center person (Tanya) doesn't count, by the job's flag or by her name; nor a quote left as a lead
  jb(ORG, "b4", { status: "booked", createdAt: at(2026, 10, 6), createdCC: true, log: lg("Created as Booked by Tanya (call center)", at(2026, 10, 6)), bookedCC: { at: at(2026, 10, 6), by: "Tanya", team: false } });
  jb(ORG, "b5", { status: "lead", createdAt: at(2026, 10, 7), createdCC: true, log: lg("Created as Lead by Jess (call center)", at(2026, 10, 7)) });
  // late on Oct 31 in Oregon is Nov 1 in UTC: it's October's
  jb(ORG, "b6", { status: "booked", createdAt: at(2026, 9, 31), createdCC: true, log: lg("Created as Quoted by Jess (call center)", at(2026, 9, 31)), bookedCC: { at: Date.UTC(2026, 10, 1, 5, 30), by: "Jess", team: true } });
  // Green (ORG2): one booking in September; and something from last year that's too old
  jb(ORG2, "g1", { status: "paid", createdAt: at(2026, 8, 2), createdCC: true, log: lg("Created as Quoted by Ana (call center)", at(2026, 8, 2)), bookedCC: { at: at(2026, 8, 4), by: "Ana" } });
  jb(ORG2, "g2", { status: "paid", createdAt: at(2025, 8, 2), createdCC: true, log: lg("Created as Booked by Ana (call center)", at(2025, 8, 2)) });
  const bill = await fn.ccBill(DB.tally_cc_team, now);
  const of = (org: string) => (bill.find((x: any) => x.org === org) || { months: {} }).months;
  const A = of(ORG), G = of(ORG2);
  ok(A["2026-11"] && A["2026-11"].booked === 2 && A["2026-11"].quoted === 1, "Ace in November: Jess's booking and Ana's (on the office's quote), one quote made: " + JSON.stringify(A["2026-11"]));
  ok(A["2026-10"] && A["2026-10"].booked === 2 && A["2026-10"].quoted === 2, "Ace in October: the job Jess made as Booked (before Nov 17) and the one booked late on Oct 31 in Oregon: " + JSON.stringify(A["2026-10"]));
  ok(G["2026-09"] && G["2026-09"].booked === 1 && G["2026-09"].quoted === 1 && !G["2025-09"] && Object.keys(G).length === 1, "Green in September; last year's is too old");
  ok(!JSON.stringify(bill).includes("Tanya") && A["2026-11"].booked === 2, "a company's own call center person (Tanya) and a quote left as a lead don't count");
}

console.log(`\nleads: ${passes} passed, ${failures} failed`);
if (failures) Deno.exit(1);

// Walk-through video calls in the Edge Function (Sales, batch 7, Nov 19; Richie: "The walk through videos should be
// saved to the crew notes so they can veiw it and see what they are in for", then "MoveCrew runs the call" and "Delete
// 30 days after move"). Who may run a call (the office, the call center) and who may watch its video (the office, the
// crew on the job, the call center while it's open); the customer's link (no sign-in: the code must match the job's
// walk-through) and the call's offer and answer passed through walk_rooms; Twilio's relay when its keys are in, STUN
// otherwise; each recorded part: a link to put it in storage, then onto the job; the storage guard (WALK_CAP_MB); and
// the videos going 30 days after the move is paid or the lead was lost, with files no job has. The harness: an
// in-memory PostgREST and Storage, a fake Twilio and auth server.
// Run: deno run -A tests/function/walk.ts
// deno-lint-ignore-file no-explicit-any
(globalThis as any).__TALLY_TEST = true;
Deno.env.set("SUPABASE_URL", "https://proj.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service");
Deno.env.delete("TWILIO_ACCOUNT_SID");
Deno.env.delete("TWILIO_AUTH_TOKEN");
Deno.env.set("TALLY_CRON_SECRET", "cron-secret");
const fn = await import("../../supabase/functions/tally-twilio/index.ts");
const BASE = "https://proj.supabase.co/functions/v1/tally-twilio";

let failures = 0, passes = 0;
function ok(c: unknown, m: string) { if (c) { passes++; console.log("PASS", m); } else { failures++; console.log("FAIL", m); } }

/* ---------- in-memory database ---------- */
const DB: Record<string, any[]> = { docs: [], members: [], tally_cc_team: [], cc_orgs: [], walk_rooms: [], comm_lines: [], comm_log: [], comm_job_state: [] };
let nextId = 1, dbDown = "";
const clone = (o: any) => JSON.parse(JSON.stringify(o));
function getField(row: any, key: string) {
  if (key.indexOf("->") < 0) return row[key];
  const parts = key.split(/->>?/);
  let v = row[parts[0]];
  for (const p of parts.slice(1)) v = v == null ? v : v[p];
  return v;
}
function matches(row: any, filters: [string, string][]) {
  return filters.every(([k, f]) => {
    const v = getField(row, k);
    if (f === "not.is.null") return v != null;
    const i = f.indexOf("."), op = f.slice(0, i), val = f.slice(i + 1);
    if (op === "eq") return String(v) === val;
    if (op === "is") return val === "null" ? v == null : String(v) === val;
    if (op === "in") return val.replace(/^\(|\)$/g, "").split(",").indexOf(String(v)) >= 0;
    throw new Error("op " + op);
  });
}
const rpcs: string[] = [];
function restMock(method: string, u: URL, body: any, prefer: string) {
  const table = u.pathname.replace("/rest/v1/", "");
  if (table === "rpc/walk_space") {
    rpcs.push("walk_space");
    if (dbDown === "space") return { status: 404, body: { message: "Could not find the function public.walk_space" } };
    let walk = 0, all = 0;
    Object.entries(FILES).forEach(([p, f]: [string, any]) => { all += f.size; if (p.indexOf("walk-videos/") === 0) walk += f.size; });
    return { status: 200, body: { walk, all: all + OTHER_BYTES } };
  }
  const rows = DB[table];
  if (!rows || (dbDown === table)) return { status: 404, body: { message: "relation " + table + " does not exist" } };
  const filters: [string, string][] = []; let limit = 1e9, onConflict = "";
  u.searchParams.forEach((v, k) => {
    if (k === "select") return; if (k === "limit") { limit = +v; return; } if (k === "on_conflict") { onConflict = v; return; }
    filters.push([k, v]);
  });
  const rep = prefer.indexOf("return=representation") >= 0;
  if (method === "GET") return { status: 200, body: clone(rows.filter((r) => matches(r, filters)).slice(0, limit)) };
  if (method === "POST") {
    const r = clone(body);
    if (onConflict) {
      const keys = onConflict.split(","), hit = rows.find((x) => keys.every((k) => String(x[k]) === String(r[k])));
      if (hit) { if (prefer.indexOf("merge-duplicates") >= 0) { Object.assign(hit, r); return { status: 200, body: rep ? [clone(hit)] : null }; } return { status: 409, body: { message: "dup" } }; }
    }
    if (table === "walk_rooms") r.offer_seq = r.offer_seq || 0, r.answer_seq = r.answer_seq || 0;
    rows.push(r);
    return { status: 201, body: rep ? [clone(r)] : null };
  }
  if (method === "PATCH") {
    const hit = rows.filter((r) => matches(r, filters));
    hit.forEach((r) => { Object.assign(r, clone(body)); if (table === "docs") r.updated_at = String(body.updated_at || new Date().toISOString()) + "#" + (nextId++); });
    return { status: 200, body: rep ? clone(hit) : null };
  }
  return { status: 405, body: null };
}

/* ---------- in-memory Storage (the walk-videos bucket, and other files) ---------- */
const FILES: Record<string, { size: number; created_at: string }> = {};
let OTHER_BYTES = 0;
const storeCalls: any[] = [];
function storageMock(method: string, u: URL, body: any) {
  const p = decodeURIComponent(u.pathname.replace("/storage/v1/", ""));
  storeCalls.push({ method, p, body });
  let m = /^object\/upload\/sign\/walk-videos\/(.+)$/.exec(p);
  if (m && method === "POST") return { status: 200, body: { url: "/object/upload/sign/walk-videos/" + m[1] + "?token=up-" + m[1].length } };
  m = /^object\/sign\/walk-videos\/(.+)$/.exec(p);
  if (m && method === "POST") return FILES["walk-videos/" + m[1]] ? { status: 200, body: { signedURL: "/object/sign/walk-videos/" + m[1] + "?token=dl-" + body.expiresIn } } : { status: 400, body: { message: "Object not found" } };
  if (p === "object/list/walk-videos" && method === "POST") {
    const pre = String(body.prefix || ""), seen: Record<string, boolean> = {}, out: any[] = [];
    Object.keys(FILES).filter((k) => k.indexOf("walk-videos/" + pre) === 0).sort().forEach((k) => {
      const rest = k.slice(("walk-videos/" + pre).length), i = rest.indexOf("/");
      if (i >= 0) { const name = rest.slice(0, i); if (!seen[name]) { seen[name] = true; out.push({ name, id: null, metadata: null }); } }
      else out.push({ name: rest, id: "id-" + rest, created_at: FILES[k].created_at, updated_at: FILES[k].created_at, metadata: { size: FILES[k].size, mimetype: "video/mp4" } });
    });
    return { status: 200, body: out.slice(body.offset || 0, (body.offset || 0) + (body.limit || 100)) };
  }
  if (p === "object/walk-videos" && method === "DELETE") { (body.prefixes || []).forEach((x: string) => { delete FILES["walk-videos/" + x]; }); return { status: 200, body: [] }; }
  return { status: 400, body: { message: "storage: " + method + " " + p } };
}
const put = (path: string, size: number, ageMs = 0) => { FILES["walk-videos/" + path] = { size, created_at: new Date(Date.now() - ageMs).toISOString() }; };

/* ---------- fake Twilio and auth ---------- */
const twilioCalls: any[] = [];
const USERS: Record<string, string> = { "tok-owner": "u-owner", "tok-dispatch": "u-dispatch", "tok-marcus": "u-marcus", "tok-kim": "u-kim", "tok-stranger": "u-stranger", "tok-jess": "u-jess", "tok-luis": "u-luis" };
(globalThis as any).fetch = async (input: string, init: any = {}) => {
  const u = new URL(input), method = (init.method || "GET").toUpperCase();
  const reply = (status: number, b: any) => new Response(b == null ? "" : JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
  if (u.host === "api.twilio.com") {
    twilioCalls.push({ path: u.pathname, auth: init.headers.Authorization, body: String(init.body) });
    if (/\/Tokens\.json$/.test(u.pathname)) return reply(201, { ttl: "7200", ice_servers: [{ url: "stun:global.stun.twilio.com:3478", urls: "stun:global.stun.twilio.com:3478" }, { url: "turn:global.turn.twilio.com:3478?transport=udp", urls: "turn:global.turn.twilio.com:3478?transport=udp", username: "tw-user", credential: "tw-pass" }] });
    return reply(404, {});
  }
  if (u.pathname === "/auth/v1/user") {
    const t = String(init.headers.Authorization || "").replace("Bearer ", "");
    return USERS[t] ? reply(200, { id: USERS[t] }) : reply(401, { message: "bad jwt" });
  }
  const h = init.headers || {};
  if (h.Authorization !== "Bearer service" || h.apikey !== "service") return reply(401, { message: "not service" });
  if (u.pathname.startsWith("/rest/v1/")) { const r = restMock(method, u, init.body ? JSON.parse(init.body) : undefined, h.Prefer || ""); return reply(r.status, r.body); }
  if (u.pathname.startsWith("/storage/v1/")) { const r = storageMock(method, u, init.body ? JSON.parse(init.body) : {}); return reply(r.status, r.body); }
  throw new Error("unexpected fetch " + input);
};

/* ---------- a company: the office, a crew lead and a crew member, the call center, and some jobs ---------- */
const ORG = "11111111-2222-3333-4444-555555555555", ORG2 = "org-2";
function putDoc(org: string, path: string, data: any) {
  const [collection, doc_id] = path.split("/");
  const i = DB.docs.findIndex((r) => r.org_id === org && r.path === path);
  const row = { org_id: org, path, collection, doc_id, data: clone(data), updated_at: new Date().toISOString() };
  if (i >= 0) DB.docs[i] = row; else DB.docs.push(row);
}
const doc = (id: string, org = ORG) => (DB.docs.find((r) => r.org_id === org && r.path === "jobs/" + id) || {}).data;
const logs = (id: string) => Object.values((doc(id) || {}).log || {}).map((l: any) => l.ev);
putDoc(ORG, "org/settings", { company: "Ace Moving — Austin", office: [{ name: "Owner", kind: "owner" }, { name: "Dispatch", kind: "dispatch" }], crew: ["Marcus", "Kim", "Luis"], leads: ["Marcus"], ccStaff: ["Luis"] });
putDoc(ORG2, "org/settings", { company: "Stranger Co" });
DB.members.push(
  { org_id: ORG, user_id: "u-owner", role: "owner", staff: "Owner" },
  { org_id: ORG, user_id: "u-dispatch", role: "dispatch", staff: "Dispatch" },
  { org_id: ORG, user_id: "u-marcus", role: "lead", staff: "Marcus" },
  { org_id: ORG, user_id: "u-kim", role: "crew", staff: "Kim" },
  { org_id: ORG, user_id: "u-luis", role: "crew", staff: "Luis" },
  { org_id: ORG2, user_id: "u-stranger", role: "owner", staff: "Zed" },
);
DB.tally_cc_team.push({ email: "jess@x.com", name: "Jess", phone: "512-555-0107", user_id: "u-jess" });
DB.cc_orgs.push({ org_id: ORG });
const ROOM = "AbCdEfGhIjKlMnOp", ROOM2 = "ZyXwVuTsRqPoNmLk", NOW = Date.now(), DAY = 864e5;
function job(id: string, over: any = {}) {
  return { id, status: "quoted", createdAt: NOW - 3 * DAY, d: { name: "Sam Kowalski", phone: "512-555-0120", moveDate: "2099-01-01", time: "09:00" },
    quote: { total: 1065 }, assign: { truckId: "", crew: [] }, log: {}, survey: { at: NOW + 36e5, kind: "video", who: "Dispatch Dee", by: "Dispatch", set: NOW, room: ROOM }, ...over };
}
putDoc(ORG, "jobs/q1", job("q1"));
putDoc(ORG, "jobs/q2", job("q2", { survey: { at: NOW, kind: "voice", who: "Owner", room: ROOM2 } }));
putDoc(ORG, "jobs/b1", job("b1", { status: "booked", assign: { truckId: "t1", crew: ["Marcus"] }, survey: null }));
putDoc(ORG, "jobs/p1", job("p1", { status: "paid", assign: { truckId: "t1", crew: ["Marcus"] }, survey: null }));

async function app(tok: string, body: any) {
  const r = await fn.handle(new Request(BASE + "/app", { method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: JSON.stringify({ org: ORG, ...body }) }));
  return { status: r.status, body: await r.json() };
}
async function cust(body: any) {
  const r = await fn.handle(new Request(BASE + "/walk", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://mischief503.github.io" }, body: JSON.stringify(body) }));
  return { status: r.status, body: await r.json(), cors: r.headers.get("Access-Control-Allow-Origin") };
}
const W = ORG + ".q1." + ROOM;
const SDP = (s: string) => "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=" + s + "\r\n";
const row = (id: string) => DB.walk_rooms.find((r) => r.org_id === ORG && r.job_id === id);

/* ---------- the link's code, and which videos are due ---------- */
ok(JSON.stringify(fn.walkParse(W)) === JSON.stringify({ org: ORG, jobId: "q1", room: ROOM }), "the link's code: company, job, room");
ok(fn.walkParse(ORG + ".q1.short") === null && fn.walkParse("q1." + ROOM) === null && fn.walkParse(ORG + ".q1." + ROOM + ".x") === null && fn.walkParse(ORG + ".q 1." + ROOM) === null && fn.walkParse(null) === null, "anything else is no code");
const paidOn = (days: number) => ({ status: "paid", payments: { p1: { amt: 500, date: new Date(NOW - days * DAY).toISOString().slice(0, 10) }, p0: { amt: 0, date: "2099-01-01" } } });
ok(fn.walkDue(paidOn(31)) === "paid" && fn.walkDue(paidOn(29)) === "", "a paid move's videos are due 30 days after its latest payment's day (not before)");
ok(fn.walkDue({ status: "paid", payments: { s: { stripe: true, live: false, amt: 500, date: new Date(NOW - 40 * DAY).toISOString().slice(0, 10) } }, finishedAt: NOW - 5 * DAY }) === "", "a test card payment doesn't count; then it's from when the move finished");
ok(fn.walkDue({ status: "lost", sales: { lost: { at: NOW - 31 * DAY } } }) === "lost" && fn.walkDue({ status: "lost", sales: { lost: { at: NOW - 3 * DAY } } }) === "", "a lost lead's: 30 days after it was lost");
ok(fn.walkDue({ status: "booked" }) === "" && fn.walkDue({ status: "done", payments: {} }) === "" && fn.walkDue(null) === "gone", "never while the move is ahead or unpaid; a job that's gone: at once");

/* ---------- who may run a call ---------- */
let r = await app("tok-kim", { action: "walk_open", jobId: "q1", room: ROOM });
ok(r.status === 403 && /Only the office and the call center run walk-throughs/.test(r.body.message), "a crew member can't run a walk-through: " + r.body.message);
r = await app("tok-stranger", { action: "walk_open", jobId: "q1", room: ROOM });
ok(r.status === 401, "someone from another company can't either");
r = await app("tok-owner", { action: "walk_open", jobId: "q1", room: "short" });
ok(r.status === 400 && !DB.walk_rooms.length, "a room that isn't one is refused");
r = await app("tok-owner", { action: "walk_open", jobId: "p1", room: ROOM });
ok(!r.body.ok && r.body.message === "Walk-throughs are for open quotes and booked moves.", "not on a paid move");
r = await app("tok-owner", { action: "walk_open", jobId: "nope", room: ROOM });
ok(!r.body.ok && r.body.message === "That job isn't here any more.", "nor a job that's gone");

/* ---------- the customer can open the link first: they wait in the room ---------- */
let c = await cust({ action: "join", w: ORG + ".q1.WrongRoomWrongRo" });
ok(!c.body.ok && c.body.message === "This walk-through link isn't working any more. Call or text your mover for a new one." && !DB.walk_rooms.length, "a wrong room: the link doesn't work, and nothing is written");
c = await cust({ action: "join", w: ORG + ".q2." + ROOM2 });
ok(c.body.ok, "(a voice walk-through's room still opens: it's the job's own)");
DB.walk_rooms.length = 0;
c = await cust({ action: "join", w: "garbage" });
ok(!c.body.ok && c.status === 200, "a link that isn't one: the same message");
c = await cust({ action: "join", w: W });
ok(c.body.ok && c.body.company === "Ace Moving - Austin" && c.body.first === "Sam" && c.body.host === "Dispatch" && c.body.at === NOW + 36e5 && c.body.over === false && c.body.live === false && c.body.seq === 0, "Sam's link: the company, his first name, who it's with, when: " + JSON.stringify({ ...c.body, ice: undefined }));
ok(JSON.stringify(c.body.ice) === JSON.stringify([{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }]) && !twilioCalls.length, "without Twilio's keys: a public STUN server");
ok(c.cors === "*", "the website can call it (CORS)");
ok(row("q1") && row("q1").room !== ROOM && row("q1").room.length === 40 && !!row("q1").cust_at && !row("q1").offer, "the room keeps a hash of the code, never the code, and that Sam is here");
ok(!JSON.stringify(c.body).includes("512-555") && !JSON.stringify(c.body).includes("1065"), "his link gives out no phone numbers or prices");

/* ---------- the office opens the call: Twilio's relay with its keys ---------- */
Deno.env.set("TWILIO_ACCOUNT_SID", "ACtest");
Deno.env.set("TWILIO_AUTH_TOKEN", "tok123");
putDoc(ORG, "jobs/q1", job("q1", { survey: { ...job("q1").survey, room: ROOM } }));
r = await app("tok-dispatch", { action: "walk_open", jobId: "q1", room: ROOM });
ok(r.body.ok && r.body.here === true && r.body.seq === 0, "Dispatch opens it: Sam is already there");
ok(r.body.ice.length === 2 && r.body.ice[1].urls === "turn:global.turn.twilio.com:3478?transport=udp" && r.body.ice[1].username === "tw-user" && r.body.ice[1].credential === "tw-pass", "with Twilio's keys: its relay (TURN) for phones on cell data");
ok(twilioCalls.length === 1 && twilioCalls[0].path === "/2010-04-01/Accounts/ACtest/Tokens.json" && twilioCalls[0].auth === "Basic " + btoa("ACtest:tok123") && twilioCalls[0].body === "Ttl=7200", "a two-hour Twilio token");
ok(r.body.space && r.body.space.ok === true && r.body.space.mins > 150, "room to record: " + JSON.stringify(r.body.space));
ok(row("q1").host_uid === "u-dispatch" && row("q1").host_name === "Dispatch" && !!row("q1").cust_at, "the room: Dispatch hosts it, Sam still there");
c = await cust({ action: "join", w: W });
ok(c.body.live === true && c.body.ice.length === 2 && twilioCalls.length === 1, "Sam's page sees the host there; the token is reused for half an hour");

/* ---------- the offer and the answer ---------- */
r = await app("tok-dispatch", { action: "walk_offer", jobId: "q1", room: ROOM, seq: 1, sdp: "not sdp" });
ok(r.status === 400 && !row("q1").offer, "an offer that isn't SDP is refused");
r = await app("tok-dispatch", { action: "walk_offer", jobId: "q1", room: ROOM, seq: 1, sdp: SDP("offer1") });
ok(r.body.ok && row("q1").offer_seq === 1 && row("q1").offer.sdp === SDP("offer1"), "the offer waits in the room");
r = await app("tok-dispatch", { action: "walk_offer", jobId: "q1", room: ROOM, seq: 1, sdp: SDP("again") });
ok(!r.body.ok && r.body.seq === 1, "an offer must be newer than the last one (and says which is the last)");
c = await cust({ action: "poll", w: W, seen: 0 });
ok(c.body.ok && c.body.offer && c.body.offer.seq === 1 && c.body.offer.sdp === SDP("offer1") && c.body.offer.type === "offer", "Sam's phone picks up the offer");
c = await cust({ action: "poll", w: W, seen: 1 });
ok(c.body.ok && c.body.offer === null, "once, not again");
r = await app("tok-dispatch", { action: "walk_poll", jobId: "q1", room: ROOM });
ok(r.body.ok && r.body.here === true && r.body.answer === null && r.body.seq === 1, "the office: Sam is here, no answer yet");
c = await cust({ action: "answer", w: W, seq: 0, sdp: SDP("answer0") });
ok(!c.body.ok && c.body.stale === true && !row("q1").answer, "an answer to an old offer is refused");
c = await cust({ action: "answer", w: W, seq: 1, sdp: SDP("answer1") });
ok(c.body.ok && row("q1").answer_seq === 1, "the answer");
r = await app("tok-dispatch", { action: "walk_poll", jobId: "q1", room: ROOM });
ok(r.body.answer && r.body.answer.seq === 1 && r.body.answer.sdp === SDP("answer1") && r.body.answer.type === "answer", "the office picks it up: they're connected");
r = await app("tok-dispatch", { action: "walk_offer", jobId: "q1", room: ROOM, seq: 2, sdp: SDP("offer2") });
ok(r.body.ok && !row("q1").answer && row("q1").offer_seq === 2, "a new offer (the connection dropped) clears the old answer");
r = await app("tok-owner", { action: "walk_poll", jobId: "q1", room: ROOM });
ok(!r.body.ok && r.body.gone && /started this call on another device/.test(r.body.message), "someone else can't take over a call by polling it");
r = await app("tok-dispatch", { action: "walk_poll", jobId: "q1", room: "OtherRoomOtherRo" });
ok(!r.body.ok && r.body.gone && r.body.message === "This walk-through was set again, so this call stopped.", "a different room: this call stopped");

/* ---------- the call center runs one too ---------- */
putDoc(ORG, "jobs/q3", job("q3", { status: "lead", survey: { at: NOW, kind: "video", who: "Jess", room: ROOM2 } }));
r = await app("tok-jess", { action: "walk_open", jobId: "q3", room: ROOM2 });
ok(r.body.ok, "MoveCrew's call center (Jess) runs a walk-through on a lead");
r = await app("tok-luis", { action: "walk_open", jobId: "q3", room: ROOM2 });
ok(r.body.ok && DB.walk_rooms.find((x) => x.job_id === "q3").host_name === "Luis", "and the company's own call center person (Luis), who takes it over");

/* ---------- the recording: a link for each part, then onto the job ---------- */
const CALL = "c4llabc123";
r = await app("tok-dispatch", { action: "walk_part", jobId: "q1", room: ROOM, call: CALL, part: 1, type: "video/quicktime", bytes: 1000 });
ok(r.status === 400, "only MP4 or WebM");
r = await app("tok-dispatch", { action: "walk_part", jobId: "q1", room: ROOM, call: "x", part: 1, type: "video/mp4", bytes: 1000 });
ok(r.status === 400, "a call id that isn't one");
r = await app("tok-dispatch", { action: "walk_part", jobId: "q1", room: ROOM, call: CALL, part: 1, type: "video/mp4", bytes: 51 * 1024 * 1024 });
ok(!r.body.ok && r.body.message === "That video part is too big to save (50 MB at most).", "a part over 50 MB (the free plan's largest file)");
r = await app("tok-kim", { action: "walk_part", jobId: "q1", room: ROOM, call: CALL, part: 1, type: "video/mp4", bytes: 1000 });
ok(r.status === 403, "the crew can't put videos in");
r = await app("tok-dispatch", { action: "walk_part", jobId: "q1", room: ROOM, call: CALL, part: 1, type: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", bytes: 30e6 });
ok(r.body.ok && r.body.path === ORG + "/q1/" + CALL + "-1.mp4" && r.body.url === "https://proj.supabase.co/storage/v1/object/upload/sign/walk-videos/" + ORG + "/q1/" + CALL + "-1.mp4?token=up-" + (ORG + "/q1/" + CALL + "-1.mp4").length,
  "part 1: a signed link to put it at <company>/<job>/<call>-1.mp4: " + r.body.url);
r = await app("tok-dispatch", { action: "walk_saved", jobId: "q1", room: ROOM, call: CALL, part: 1, type: "video/mp4", secs: 480, at: NOW - 600e3 });
ok(!r.body.ok && r.body.message === "That video part isn't in storage. Save it again." && !doc("q1").walkVids, "said saved before it's in storage: refused");
put(ORG + "/q1/" + CALL + "-1.mp4", 30e6);
r = await app("tok-dispatch", { action: "walk_saved", jobId: "q1", room: ROOM, call: CALL, part: 1, type: "video/mp4", secs: 480, at: NOW - 600e3 });
const v1 = doc("q1").walkVids && doc("q1").walkVids[CALL + "-1"];
ok(r.body.ok && v1 && v1.path === ORG + "/q1/" + CALL + "-1.mp4" && v1.secs === 480 && v1.bytes === 30e6 && v1.by === "Dispatch" && v1.part === 1 && v1.call === CALL && v1.type === "video/mp4" && v1.at === NOW - 600e3 && JSON.stringify(r.body.video) === JSON.stringify(v1),
  "saved: on the job under its own key, with how long, how big and who: " + JSON.stringify(v1));
ok(logs("q1").filter((e) => e === "Walk-through video saved (8 min), by Dispatch").length === 1, "the activity says so");
r = await app("tok-dispatch", { action: "walk_saved", jobId: "q1", room: ROOM, call: CALL, part: 1, type: "video/mp4", secs: 480, at: NOW - 600e3 });
ok(r.body.ok && logs("q1").filter((e) => /^Walk-through video saved/.test(e)).length === 1, "saved again (a retry): once on the job, once in the activity");
put(ORG + "/q1/" + CALL + "-2.mp4", 9e6);
r = await app("tok-dispatch", { action: "walk_saved", jobId: "q1", room: ROOM, call: CALL, part: 2, type: "video/mp4", secs: 130, at: NOW - 120e3 });
ok(r.body.ok && Object.keys(doc("q1").walkVids).length === 2 && logs("q1").indexOf("Walk-through video, part 2, saved (2 min), by Dispatch") >= 0, "part 2 next to it");

/* ---------- the end: a call that happened makes the walk-through done ---------- */
r = await app("tok-dispatch", { action: "walk_end", jobId: "q1", room: ROOM, done: true, secs: 610 });
ok(r.body.ok && doc("q1").survey.done > 0 && logs("q1").indexOf("Walk-through done (video call, 10 min), by Dispatch") >= 0 && !!row("q1").ended_at && !row("q1").offer, "ended: the walk-through is done, in the activity, and the room is closed");
c = await cust({ action: "poll", w: W, seen: 2 });
ok(!c.body.ok || c.body.over === true, "Sam's page hears it's over");
c = await cust({ action: "join", w: W });
ok(c.body.ok && c.body.over === true, "opening the link again: it's over");
putDoc(ORG, "jobs/q4", job("q4", { survey: { at: NOW, kind: "video", who: "Owner", room: ROOM } }));
await app("tok-owner", { action: "walk_open", jobId: "q4", room: ROOM });
r = await app("tok-owner", { action: "walk_end", jobId: "q4", room: ROOM, done: false, secs: 9 });
ok(r.body.ok && !doc("q4").survey.done && !logs("q4").length, "a call of a few seconds (a drop): not done");

/* ---------- who may watch ---------- */
r = await app("tok-owner", { action: "walk_watch", jobId: "q1", id: CALL + "-1" });
ok(r.body.ok && r.body.url === "https://proj.supabase.co/storage/v1/object/sign/walk-videos/" + ORG + "/q1/" + CALL + "-1.mp4?token=dl-10800" && r.body.until > Date.now() + 2.9 * 36e5, "the owner watches it: a link good for 3 hours");
r = await app("tok-jess", { action: "walk_watch", jobId: "q1", id: CALL + "-1" });
ok(r.body.ok, "the call center, while it's an open quote");
r = await app("tok-marcus", { action: "walk_watch", jobId: "q1", id: CALL + "-1" });
ok(r.status === 403 && r.body.message === "You can watch the walk-through videos of your own jobs.", "a crew lead not on the job can't");
putDoc(ORG, "jobs/q1", { ...doc("q1"), status: "booked", assign: { truckId: "t1", crew: ["Marcus", "Kim"] } });
r = await app("tok-marcus", { action: "walk_watch", jobId: "q1", id: CALL + "-1" });
const r2 = await app("tok-kim", { action: "walk_watch", jobId: "q1", id: CALL + "-2" });
ok(r.body.ok && r2.body.ok, "booked with Marcus and Kim on it: they watch it");
r = await app("tok-stranger", { action: "walk_watch", jobId: "q1", id: CALL + "-1" });
ok(r.status === 401, "nobody from another company");
r = await app("tok-owner", { action: "walk_watch", jobId: "q1", id: "nope-1" });
ok(!r.body.ok && r.body.message === "That video isn't here any more.", "a video that's gone");

/* ---------- deleting one (the office) ---------- */
r = await app("tok-marcus", { action: "walk_remove", jobId: "q1", id: CALL + "-2" });
ok(r.status === 403 && FILES["walk-videos/" + ORG + "/q1/" + CALL + "-2.mp4"], "the crew can't delete one");
r = await app("tok-dispatch", { action: "walk_remove", jobId: "q1", id: CALL + "-2" });
ok(r.body.ok && !FILES["walk-videos/" + ORG + "/q1/" + CALL + "-2.mp4"] && !doc("q1").walkVids[CALL + "-2"] && doc("q1").walkVids[CALL + "-1"] && logs("q1").indexOf("Walk-through video, part 2, deleted by Dispatch") >= 0, "Dispatch deletes part 2: the file, its place on the job, and the activity says so");

/* ---------- the storage guard ---------- */
Deno.env.set("WALK_CAP_MB", "100");
OTHER_BYTES = 75 * 1048576;
r = await app("tok-dispatch", { action: "walk_part", jobId: "q1", room: ROOM, call: CALL, part: 3, type: "video/mp4", bytes: 30e6 });
ok(!r.body.ok && r.body.full === true && r.body.message === "Video storage is full, so this part wasn't saved. Delete old walk-through videos, or move MoveCrew's Supabase to a plan with more room.", "nearly full (WALK_CAP_MB): the part isn't taken, and the app is told why");
ok(rpcs.filter((x) => x === "walk_space").length >= 2, "(it cleared out what was due first, and looked again)");
await app("tok-owner", { action: "walk_end", jobId: "q4", room: ROOM, done: false, secs: 1 });
r = await app("tok-owner", { action: "walk_open", jobId: "q4", room: ROOM });
ok(r.body.ok && r.body.space.ok === false && r.body.space.why === "full", "a call opened while it's full: the call works, and it says it won't be saved");
OTHER_BYTES = 0;
Deno.env.delete("WALK_CAP_MB");
dbDown = "space";
r = await app("tok-dispatch", { action: "walk_part", jobId: "q1", room: ROOM, call: CALL, part: 3, type: "video/mp4", bytes: 1000 });
ok(!r.body.ok && r.body.message === "Video saving isn't set up on the server yet (supabase-walk.sql).", "before supabase-walk.sql is run: it says so");
dbDown = "walk_rooms";
r = await app("tok-dispatch", { action: "walk_open", jobId: "q1", room: ROOM });
ok(!r.body.ok && r.body.message === "Video calls aren't set up on the server yet (supabase-walk.sql).", "and for the call itself");
dbDown = "";

/* ---------- 30 days after the move is paid: the videos go ---------- */
putDoc(ORG, "jobs/old", job("old", { ...paidOn(31), survey: null, walkVids: { "c1-1": { id: "c1-1", call: "c1", part: 1, path: ORG + "/old/c1-1.mp4", at: NOW - 60 * DAY, secs: 300, bytes: 2e7 } } }));
putDoc(ORG, "jobs/recent", job("recent", { ...paidOn(10), survey: null, walkVids: { "c2-1": { id: "c2-1", call: "c2", part: 1, path: ORG + "/recent/c2-1.mp4", at: NOW - 20 * DAY, secs: 300, bytes: 2e7 } } }));
putDoc(ORG, "jobs/lost", job("lost", { status: "lost", sales: { lost: { at: NOW - 40 * DAY } }, survey: null, walkVids: { "c3-1": { id: "c3-1", call: "c3", part: 1, path: ORG + "/lost/c3-1.mp4", at: NOW - 50 * DAY, secs: 60, bytes: 5e6 } } }));
put(ORG + "/old/c1-1.mp4", 2e7, 60 * DAY); put(ORG + "/recent/c2-1.mp4", 2e7, 20 * DAY); put(ORG + "/lost/c3-1.mp4", 5e6, 50 * DAY);
put(ORG + "/deleted-job/c9-1.mp4", 4e6, 3 * DAY);            // its job was deleted
put(ORG + "/q1/" + CALL + "-7.mp4", 4e6, 2 * DAY);           // a part never put on its job
put(ORG + "/q1/" + CALL + "-8.mp4", 4e6, 3600e3);            // one that may still be on its way
r = await app("tok-marcus", { action: "walk_sweep" });
ok(r.status === 403, "only the office asks for the clear-out");
r = await app("tok-owner", { action: "walk_sweep" });
ok(r.body.ok && r.body.removed === 4, "the owner's MoveCrew asks: 4 removed (" + r.body.removed + ")");
ok(!FILES["walk-videos/" + ORG + "/old/c1-1.mp4"] && !doc("old").walkVids && logs("old").indexOf("Walk-through video removed: 30 days after the move was paid") >= 0, "paid 31 days ago: the video and its place on the job are gone, and the activity says why");
ok(FILES["walk-videos/" + ORG + "/recent/c2-1.mp4"] && doc("recent").walkVids["c2-1"], "paid 10 days ago: kept");
ok(!FILES["walk-videos/" + ORG + "/lost/c3-1.mp4"] && !doc("lost").walkVids && logs("lost").indexOf("Walk-through video removed: 30 days after the lead was lost") >= 0, "a lead lost 40 days ago: gone");
ok(!FILES["walk-videos/" + ORG + "/deleted-job/c9-1.mp4"] && !FILES["walk-videos/" + ORG + "/q1/" + CALL + "-7.mp4"], "the files no job has (a deleted job, a part never put on its job): gone");
ok(FILES["walk-videos/" + ORG + "/q1/" + CALL + "-8.mp4"] && FILES["walk-videos/" + ORG + "/q1/" + CALL + "-1.mp4"] && doc("q1").walkVids[CALL + "-1"], "a part from the last day (maybe still on its way), and the videos on open jobs: kept");
// the evening cron does it for every company
putDoc(ORG2, "jobs/z1", job("z1", { ...paidOn(45), survey: null, walkVids: { "c5-1": { id: "c5-1", call: "c5", part: 1, path: ORG2 + "/z1/c5-1.mp4", at: NOW - 50 * DAY, secs: 60, bytes: 1e6 } } }));
put(ORG2 + "/z1/c5-1.mp4", 1e6, 50 * DAY);
const cr = await fn.handle(new Request(BASE + "/cron/tomorrow", { method: "POST", headers: { "x-tally-cron": "cron-secret" } }));
const cj = await cr.json();
ok(cj.walk && cj.walk.removed === 1 && !FILES["walk-videos/" + ORG2 + "/z1/c5-1.mp4"] && !doc("z1", ORG2).walkVids, "the evening cron clears every company's: " + JSON.stringify(cj.walk));

/* ---------- the customer's own copy (their app): the link's code for a video walk-through ---------- */
ok(fn.custSurvey({ id: "q9", status: "quoted", survey: { at: NOW, kind: "video", who: "Dee Ray", room: ROOM } }, ORG).w === ORG + ".q9." + ROOM, "their app gets the video walk-through's link code");
ok(!("w" in fn.custSurvey({ id: "q9", status: "quoted", survey: { at: NOW, kind: "voice", who: "Dee", room: ROOM } }, ORG)) && !("w" in fn.custSurvey({ id: "q9", status: "quoted", survey: { at: NOW, kind: "video", who: "Dee" } }, ORG)), "not for a voice call, nor one with no room");

/* ---------- the customer's page sends plain text (no CORS preflight) ---------- */
{
  const t = await fn.handle(new Request(BASE + "/walk", { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify({ action: "join", w: ORG + ".q2." + ROOM2 }) }));
  const tj = await t.json();
  ok(t.status === 200 && tj.ok === true && tj.first === "Sam", "a request sent as plain text is read the same");
}

/* ---------- too many tries ---------- */
let last: any = null;
for (let i = 0; i < 152; i++) last = await cust({ action: "poll", w: ORG + ".q2." + ROOM2, seen: 0 });
ok(last.status === 429 && last.body.message === "Too many tries. Wait a minute, then try again.", "a link asked 150 times in a minute: too many");

console.log(`\nwalk function: ${passes} passed, ${failures} failed`);
if (failures) Deno.exit(1);

// Square in the Edge Function (Nov 1). Richie: "For payment processing i would also like to add remedy and square card .
// There should be a place where the company can link what they use then the app will auto use their connection for the
// payment". A company connects its own Square account (OAuth, sealed tokens); then its card payments go through Square:
// a typed card's token charged, cards kept on file, pay links and the customer app's page, refunds, disputes and a seller
// taking MoveCrew's access back by webhook; switching back to Stripe; disconnecting. An in-memory PostgREST, a fake
// Square (sandbox) that keeps payments, cards, customers, orders and payment links, and signed Square events.
// Run: deno run -A tests/function/square.ts
// deno-lint-ignore-file no-explicit-any
(globalThis as any).__TALLY_TEST = true;
Deno.env.set("SUPABASE_URL", "https://proj.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service");
Deno.env.set("TWILIO_ACCOUNT_SID", "ACtest");
Deno.env.set("TWILIO_AUTH_TOKEN", "tok123");
Deno.env.set("STRIPE_SECRET_KEY", "sk_test_123");
Deno.env.set("STRIPE_PUBLISHABLE_KEY", "pk_test_123");
const fn = await import("../../supabase/functions/tally-twilio/index.ts");
const BASE = "https://proj.supabase.co/functions/v1/tally-twilio";
const APP_ID = "sandbox-sq0idb-TestApp123", SECRET = "sandbox-sq0csb-TestSecret456", HOOK_KEY = "sq-hook-key-789";
const sqOn = () => { Deno.env.set("SQUARE_APP_ID", APP_ID); Deno.env.set("SQUARE_APP_SECRET", SECRET); Deno.env.set("SQUARE_WEBHOOK_KEY", HOOK_KEY); };
const sqOff = () => { Deno.env.delete("SQUARE_APP_ID"); Deno.env.delete("SQUARE_APP_SECRET"); Deno.env.delete("SQUARE_WEBHOOK_KEY"); };

let failures = 0, passes = 0;
function ok(c: unknown, m: string) { if (c) { passes++; console.log("PASS", m); } else { failures++; console.log("FAIL", m); } }

/* ---------- in-memory database ---------- */
const DB: Record<string, any[]> = { docs: [], members: [], orgs: [], comm_lines: [], comm_log: [], comm_job_state: [], pay_orgs: [], pay_customers: [], pay_links: [], pay_log: [],
  pay_config: [], pay_cards: [], pay_jobs: [], pay_locks: [], pay_accounts: [], pay_config_connect: [], pay_square: [] };
const KEYS: Record<string, string[]> = { docs: ["org_id", "path"], orgs: ["id"], pay_orgs: ["org_id"], pay_customers: ["org_id", "cust_key", "livemode"], pay_links: ["token"], pay_log: ["pi"],
  pay_config: ["mode"], pay_cards: ["id"], pay_jobs: ["org_id", "job_id", "livemode"], pay_locks: ["org_id", "job_id"], pay_accounts: ["account_id"], pay_config_connect: ["mode"],
  pay_square: ["org_id", "merchant_id", "livemode"] };
const clone = (o: any) => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
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
    if (op === "in") return val.replace(/^\(|\)$/g, "").split(",").indexOf(String(v)) >= 0;
    throw new Error("op " + op);
  });
}
function payRecord(b: any) {
  const row = DB.docs.find((r) => r.org_id === b.o && r.path === "jobs/" + b.job);
  if (!row) return null;
  const d = clone(row.data);
  const old = d.payments && d.payments[b.pay_id];
  if (b.payment != null && old && String(old.amt) === String(b.payment.amt) && !!old.pending === !!b.payment.pending && (old.method || "") === (b.payment.method || "")) return d;
  if (b.payment == null && !old) return d;
  if (!d.payments || typeof d.payments !== "object" || Array.isArray(d.payments)) d.payments = {};
  if (b.payment == null) delete d.payments[b.pay_id]; else d.payments[b.pay_id] = b.payment;
  if (b.log_key && b.log_entry) { if (!d.log || typeof d.log !== "object") d.log = {}; d.log[b.log_key] = b.log_entry; }
  if (b.mark_paid && d.status === "done") d.status = "paid";
  row.data = d; row.updated_at = new Date().toISOString();
  return d;
}
function payReopen(b: any) {
  const row = DB.docs.find((r) => r.org_id === b.o && r.path === "jobs/" + b.job);
  if (!row || row.data.status !== "paid") return false;
  const d = clone(row.data);
  d.status = "done";
  if (b.log_key && b.log_entry) { if (!d.log || typeof d.log !== "object") d.log = {}; d.log[b.log_key] = b.log_entry; }
  row.data = d;
  return true;
}
let noSquareTable = false;
function restMock(method: string, u: URL, body: any, prefer: string) {
  const parts = u.pathname.split("/");
  if (parts[parts.length - 2] === "rpc") {
    const name = parts[parts.length - 1];
    if (name === "pay_record") return { status: 200, body: payRecord(body) };
    if (name === "pay_reopen") return { status: 200, body: payReopen(body) };
    return { status: 404, body: { message: "no function" } };
  }
  const table = parts.pop()!;
  const rows = DB[table];
  if (!rows || (table === "pay_square" && noSquareTable)) return { status: 404, body: { message: "relation \"public." + table + "\" does not exist" } };
  const filters: [string, string][] = []; let limit = 1e9, onConflict = "";
  u.searchParams.forEach((v, k) => {
    if (k === "select" || k === "order") return; if (k === "limit") { limit = +v; return; } if (k === "on_conflict") { onConflict = v; return; }
    filters.push([k, v]);
  });
  const rep = prefer.indexOf("return=representation") >= 0;
  if (method === "GET") return { status: 200, body: clone(rows.filter((r) => matches(r, filters)).slice(0, limit)) };
  if (method === "POST") {
    const list = Array.isArray(body) ? body : [body], added: any[] = [];
    for (const r0 of list) {
      const r = clone(r0);
      if (!r.created_at && table !== "docs" && table !== "pay_config") r.created_at = new Date().toISOString();
      const keys = (onConflict ? onConflict.split(",") : KEYS[table]) || [];
      const hit = keys.length ? rows.find((x) => keys.every((k) => String(x[k]) === String(r[k]))) : null;
      if (hit) {
        if (prefer.indexOf("ignore-duplicates") >= 0) continue;
        if (prefer.indexOf("merge-duplicates") >= 0) { delete r.created_at; Object.assign(hit, r); added.push(hit); continue; }
        return { status: 409, body: { message: "duplicate key" } };
      }
      // one current Square connection per company and mode (pay_square_current_idx)
      if (table === "pay_square" && r.is_current !== false && rows.some((x) => x.org_id === r.org_id && !!x.livemode === !!r.livemode && x.is_current)) return { status: 409, body: { message: "duplicate key pay_square_current_idx" } };
      rows.push(r); added.push(r);
    }
    return { status: 201, body: rep ? clone(added) : null };
  }
  if (method === "PATCH") {
    const hit = rows.filter((r) => matches(r, filters));
    hit.forEach((r) => Object.assign(r, clone(body)));
    return { status: 200, body: rep ? clone(hit) : null };
  }
  if (method === "DELETE") {
    DB[table] = rows.filter((r) => !matches(r, filters));
    return { status: 204, body: null };
  }
  return { status: 405, body: null };
}

/* ---------- a fake Square (the sandbox) ---------- */
const SQ: any = { tokens: {}, refresh: {}, payments: {}, cards: {}, customers: [], links: {}, orders: {}, disputes: [], idem: {}, n: 0, calls: [], revoked: [] };
const MERCHANTS: any = {
  MLR1aceAAA: { business_name: "Ace Moving LLC", main: { id: "L1main", name: "Ace Moving (Portland)", status: "ACTIVE", capabilities: ["CREDIT_CARD_PROCESSING", "AUTOMATIC_TRANSFERS"], currency: "USD" } },
  MLR2nocard: { business_name: "No Cards Yet", main: { id: "L2main", name: "Warehouse", status: "ACTIVE", capabilities: [], currency: "USD" } },
  MLR3other: { business_name: "Bright Moves", main: { id: "L3main", name: "Bright Moves", status: "ACTIVE", capabilities: ["CREDIT_CARD_PROCESSING"], currency: "USD" } },
};
const CODES: Record<string, string> = { "code-ace-1": "MLR1aceAAA", "code-ace-2": "MLR1aceAAA", "code-ace-3": "MLR1aceAAA", "code-nocard": "MLR2nocard", "code-other": "MLR3other" };
const id = (p: string) => p + (++SQ.n);
function sqErr(status: number, code: string, detail: string, category = "INVALID_REQUEST_ERROR", extra: any = {}) { return { status, body: { errors: [{ category, code, detail }], ...extra } }; }
function issue(merchant: string, days = 30) {
  const at = "EAAAl" + id("tok"), rt = "EQAAl" + id("ref");
  SQ.tokens[at] = { merchant, expires: Date.now() + days * 864e5 };
  SQ.refresh[rt] = merchant;
  return { access_token: at, token_type: "bearer", expires_at: new Date(Date.now() + days * 864e5).toISOString(), merchant_id: merchant, refresh_token: rt, short_lived: false };
}
function cardOf(src: string): any {
  if (src === "cnon:card-nonce-ok" || /^cnon:ok/.test(src)) return { card_brand: "VISA", last_4: "1111", exp_month: 11, exp_year: 2030, fingerprint: "sq-1-fpVISA", cardholder_name: "Priya Nair", card_type: "CREDIT" };
  if (/^cnon:mc/.test(src)) return { card_brand: "MASTERCARD", last_4: "5100", exp_month: 6, exp_year: 2029, fingerprint: "sq-1-fpMC", card_type: "CREDIT" };
  return null;
}
function sqApi(method: string, path: string, body: any, h: any) {
  const reply = (status: number, b: any) => ({ status, body: b });
  if (h["Square-Version"] !== "2026-05-20") return sqErr(400, "BAD_VERSION", "Square-Version " + h["Square-Version"]);
  let m: RegExpExecArray | null;
  if (path === "/oauth2/token" && method === "POST") {
    if (body.client_id !== APP_ID || body.client_secret !== SECRET) return sqErr(401, "UNAUTHORIZED", "Not authorized", "AUTHENTICATION_ERROR");
    if (body.grant_type === "authorization_code") {
      const mer = CODES[body.code];
      if (!mer) return sqErr(400, "INVALID_GRANT", "Code is invalid or expired");
      delete CODES[body.code];   // a code works once
      return reply(200, issue(mer));
    }
    if (body.grant_type === "refresh_token") {
      const mer = SQ.refresh[body.refresh_token];
      if (!mer || SQ.revoked.indexOf(mer) >= 0) return sqErr(401, "UNAUTHORIZED", "Refresh token is revoked", "AUTHENTICATION_ERROR");
      const t = issue(mer);
      delete SQ.refresh[t.refresh_token]; SQ.refresh[body.refresh_token] = mer;   // the same refresh token stays good
      return reply(200, { ...t, refresh_token: body.refresh_token });
    }
    return sqErr(400, "BAD_REQUEST", "grant_type");
  }
  if (path === "/oauth2/revoke" && method === "POST") {
    if (h.Authorization !== "Client " + SECRET || body.client_id !== APP_ID) return sqErr(401, "UNAUTHORIZED", "Not authorized", "AUTHENTICATION_ERROR");
    SQ.revoked.push(body.merchant_id);
    Object.keys(SQ.tokens).forEach((t) => { if (SQ.tokens[t].merchant === body.merchant_id) delete SQ.tokens[t]; });
    return reply(200, { success: true });
  }
  // everything else needs the seller's access token
  const tok = String(h.Authorization || "").replace(/^Bearer /, ""), t = SQ.tokens[tok];
  if (!t) return sqErr(401, "UNAUTHORIZED", "This request could not be authorized.", "AUTHENTICATION_ERROR");
  if (t.expires < Date.now()) return sqErr(401, "ACCESS_TOKEN_EXPIRED", "The access token has expired.", "AUTHENTICATION_ERROR");
  const mer = t.merchant, M = MERCHANTS[mer];
  if (method === "GET" && path === "/v2/locations/main") return reply(200, { location: clone(M.main) });
  if (method === "GET" && path === "/v2/locations") return reply(200, { locations: [clone(M.main)] });
  if (method === "GET" && (m = /^\/v2\/merchants\/(\w+)$/.exec(path))) return m[1] === mer ? reply(200, { merchant: { id: mer, business_name: M.business_name, country: "US", currency: "USD", status: "ACTIVE" } }) : sqErr(403, "FORBIDDEN", "not yours");
  const idem = (k: string, f: () => any) => { const key = mer + "|" + path + "|" + k; if (k && SQ.idem[key]) return clone(SQ.idem[key]); const out = f(); if (k) SQ.idem[key] = clone(out); return out; };
  if (method === "POST" && path === "/v2/customers") return idem(body.idempotency_key, () => { const c = { id: id("CUS"), merchant: mer, given_name: body.given_name, email_address: body.email_address, phone_number: body.phone_number, reference_id: body.reference_id }; SQ.customers.push(c); return reply(200, { customer: c }); });
  if (method === "POST" && path === "/v2/payments") {
    if (!body.idempotency_key || body.idempotency_key.length > 45) return sqErr(400, "VALUE_TOO_LONG", "idempotency_key");
    return idem(body.idempotency_key, () => {
      if (body.location_id !== M.main.id) return sqErr(400, "NOT_FOUND", "Location not found");
      const src = String(body.source_id || "");
      let card = cardOf(src), saved: any = null;
      if (/^ccof:/.test(src)) {
        saved = SQ.cards[src];
        if (!saved || saved.merchant !== mer || !saved.enabled) return sqErr(400, "CARD_NOT_FOUND", "Card not found");
        if (saved.customer_id !== body.customer_id) return sqErr(400, "INVALID_CARD", "The card belongs to another customer");
        card = { card_brand: saved.card_brand, last_4: saved.last_4, exp_month: saved.exp_month, exp_year: saved.exp_year, fingerprint: saved.fingerprint };
      }
      const amt = body.amount_money && body.amount_money.amount;
      const pay: any = { id: id("PAY"), merchant: mer, status: "COMPLETED", amount_money: { amount: amt, currency: "USD" }, total_money: { amount: amt, currency: "USD" }, approved_money: { amount: amt, currency: "USD" },
        source_type: "CARD", location_id: body.location_id, order_id: id("ORDP"), reference_id: body.reference_id, note: body.note, customer_id: body.customer_id || null, buyer_email_address: body.buyer_email_address,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(), card_details: { status: "CAPTURED", entry_method: saved ? "ON_FILE" : "KEYED", card: card || { card_brand: "VISA", last_4: "0002" } } };
      const fail = (code: string, detail: string) => { pay.status = "FAILED"; pay.card_details.status = "FAILED"; pay.card_details.errors = [{ code, detail, category: "PAYMENT_METHOD_ERROR" }]; SQ.payments[pay.id] = pay; return { status: 400, body: { errors: [{ code, detail, category: "PAYMENT_METHOD_ERROR" }], payment: clone(pay) } }; };
      if (src === "cnon:card-nonce-declined") return fail("GENERIC_DECLINE", "Authorization error: 'GENERIC_DECLINE'");
      if (src === "cnon:card-nonce-cvv") return fail("CVV_FAILURE", "Authorization error: 'CVV_FAILURE'");
      if (src === "cnon:card-nonce-verify") return fail("CARD_DECLINED_VERIFICATION_REQUIRED", "Verification required");
      if (src === "cnon:card-nonce-used") return sqErr(400, "CARD_TOKEN_USED", "Card nonce already used");
      if (!card) return sqErr(400, "INVALID_CARD_DATA", "Invalid card nonce");
      SQ.payments[pay.id] = pay;
      return reply(200, { payment: clone(pay) });
    });
  }
  if (method === "GET" && (m = /^\/v2\/payments\/(\w+)$/.exec(path))) {
    const p = SQ.payments[m[1]];
    return p && p.merchant === mer ? reply(200, { payment: clone(p) }) : sqErr(404, "NOT_FOUND", "Payment not found");
  }
  if (method === "POST" && path === "/v2/cards") return idem(body.idempotency_key, () => {
    const p = SQ.payments[body.source_id];
    if (!p || p.merchant !== mer || p.status !== "COMPLETED") return sqErr(400, "INVALID_CARD", "Card can't be stored from that payment");
    const c = p.card_details.card, cd = { id: "ccof:" + id("CARD"), merchant: mer, card_brand: c.card_brand, last_4: c.last_4, exp_month: c.exp_month, exp_year: c.exp_year, fingerprint: c.fingerprint,
      cardholder_name: body.card.cardholder_name || "", customer_id: body.card.customer_id, reference_id: body.card.reference_id, enabled: true };
    SQ.cards[cd.id] = cd;
    return reply(200, { card: clone(cd) });
  });
  if (method === "POST" && (m = /^\/v2\/cards\/([\w:]+)\/disable$/.exec(path))) {
    const c = SQ.cards[m[1]];
    if (!c || c.merchant !== mer) return sqErr(404, "NOT_FOUND", "Card not found");
    c.enabled = false; return reply(200, { card: clone(c) });
  }
  if (method === "POST" && path === "/v2/online-checkout/payment-links") return idem(body.idempotency_key, () => {
    const o = body.order || {};
    if (o.location_id !== M.main.id) return sqErr(400, "NOT_FOUND", "Location not found");
    const total = (o.line_items || []).reduce((a: number, l: any) => a + Number(l.base_price_money.amount) * Number(l.quantity), 0);
    const ord = { id: id("ORD"), merchant: mer, location_id: o.location_id, reference_id: o.reference_id, line_items: clone(o.line_items), metadata: clone(o.metadata), state: "OPEN", tenders: [] as any[], total_money: { amount: total, currency: "USD" } };
    SQ.orders[ord.id] = ord;
    const pl = { id: id("PL"), merchant: mer, version: 1, order_id: ord.id, url: "https://sandbox.square.link/u/" + id("u"), long_url: "https://sandbox.square.link/long", created_at: new Date().toISOString(),
      checkout_options: clone(body.checkout_options), pre_populated_data: clone(body.pre_populated_data), payment_note: body.payment_note, deleted: false };
    SQ.links[pl.id] = pl;
    return reply(200, { payment_link: clone(pl), related_resources: { orders: [clone(ord)] } });
  });
  if (method === "DELETE" && (m = /^\/v2\/online-checkout\/payment-links\/(\w+)$/.exec(path))) {
    const pl = SQ.links[m[1]];
    if (!pl || pl.merchant !== mer || pl.deleted) return sqErr(404, "NOT_FOUND", "Payment link not found");
    pl.deleted = true; return reply(200, { id: pl.id, cancelled_order_id: pl.order_id });
  }
  if (method === "GET" && (m = /^\/v2\/orders\/(\w+)$/.exec(path))) {
    const o = SQ.orders[m[1]];
    return o && o.merchant === mer ? reply(200, { order: clone(o) }) : sqErr(404, "NOT_FOUND", "Order not found");
  }
  if (method === "GET" && path === "/v2/disputes") return reply(200, { disputes: clone(SQ.disputes.filter((d: any) => d.merchant === mer)) });
  return sqErr(404, "NOT_FOUND", "fake square: no route " + method + " " + path);
}
// the customer paying on a Square payment link's page
function customerPaysLink(plId: string, brand = "VISA") {
  const pl = SQ.links[plId], o = SQ.orders[pl.order_id];
  if (pl.deleted) throw new Error("link " + plId + " was deleted");
  const amt = o.total_money.amount;
  const pay: any = { id: id("PAY"), merchant: pl.merchant, status: "COMPLETED", amount_money: { amount: amt, currency: "USD" }, total_money: { amount: amt, currency: "USD" }, source_type: "CARD",
    location_id: o.location_id, order_id: o.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    card_details: { status: "CAPTURED", card: { card_brand: brand, last_4: brand === "AMERICAN_EXPRESS" ? "8431" : "1111", exp_month: 1, exp_year: 2031, fingerprint: "sq-1-fp" + brand } } };
  SQ.payments[pay.id] = pay;
  o.tenders.push({ id: id("TND"), type: "CARD", payment_id: pay.id, amount_money: { amount: amt, currency: "USD" } });
  o.state = "COMPLETED";
  return pay;
}
function refundOn(pid: string, amt: number) { const p = SQ.payments[pid]; p.refunded_money = { amount: (p.refunded_money ? p.refunded_money.amount : 0) + amt, currency: "USD" }; p.updated_at = new Date().toISOString(); return p; }

/* ---------- fake auth, and fetch ---------- */
const USERS: Record<string, any> = { "tok-owner": { id: "u-owner" }, "tok-dispatch": { id: "u-dispatch" }, "tok-marcus": { id: "u-marcus" }, "tok-kim": { id: "u-kim" }, "tok-owner2": { id: "u-owner2" },
  "tok-lena": { id: "u-lena", email: "lena@example.com", email_confirmed_at: "2026-10-01T00:00:00Z" } };
const stripeCalls: any[] = [];
(globalThis as any).fetch = async (input: string, init: any = {}) => {
  const u = new URL(input), method = (init.method || "GET").toUpperCase();
  const reply = (status: number, b: any) => new Response(status === 204 ? null : b == null ? "" : JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
  if (u.host === "connect.squareupsandbox.com") {
    const h = init.headers || {}, body = init.body ? JSON.parse(init.body) : undefined;
    SQ.calls.push({ method, path: u.pathname + (u.search || ""), body: clone(body), auth: h.Authorization });
    const r = sqApi(method, u.pathname, body, h);
    return reply(r.status, r.body);
  }
  if (u.host === "connect.squareup.com") throw new Error("the live Square host was called in sandbox mode: " + input);
  if (u.host === "api.stripe.com") { stripeCalls.push({ method, path: u.pathname }); return reply(500, { error: { type: "api_error", message: "stripe isn't part of this test" } }); }
  if (u.pathname === "/auth/v1/user") {
    const t = String(init.headers.Authorization || "").replace("Bearer ", "");
    return USERS[t] ? reply(200, USERS[t]) : reply(401, { message: "bad jwt" });
  }
  if (u.pathname.startsWith("/rest/v1/")) {
    const h = init.headers || {};
    if (h.Authorization !== "Bearer service") return reply(401, { message: "not service" });
    const r = restMock(method, u, init.body ? JSON.parse(init.body) : undefined, h.Prefer || "");
    return reply(r.status, r.body);
  }
  if (u.host === "api.twilio.com") return reply(201, { sid: "SM1", status: "queued" });
  throw new Error("unexpected fetch " + input);
};

/* ---------- two companies ---------- */
const ORG = "11111111-1111-1111-1111-111111111111", ORG2 = "22222222-2222-2222-2222-222222222222";
DB.orgs.push({ id: ORG, name: "Ace Moving" }, { id: ORG2, name: "Bright Moves" });
function putDoc(org: string, path: string, data: any) {
  const [collection, doc_id] = path.split("/");
  const i = DB.docs.findIndex((r) => r.org_id === org && r.path === path);
  const row = { org_id: org, path, collection, doc_id, data: clone(data), updated_at: new Date().toISOString() };
  if (i >= 0) DB.docs[i] = row; else DB.docs.push(row);
}
const doc = (path: string, org = ORG) => (DB.docs.find((r) => r.org_id === org && r.path === path) || {}).data;
function job(id: string, over: any = {}) {
  return { id, status: "done", d: { name: "Priya Nair", phone: "503-555-0142", email: "priya@example.com", moveDate: "2026-11-01", time: "08:00" },
    quote: { total: 1200, deposit: 300 }, assign: { truckId: "", crew: ["Marcus", "Kim"] }, signed: {}, payments: { p0: { id: "p0", amt: 200, method: "Cash", date: "2026-11-01", ts: 1 } },
    extras: {}, materials: {}, log: {}, ...over };
}
putDoc(ORG, "org/settings", { company: "Ace Moving", contacts: { Owner: "503-555-0100", Marcus: "503-555-0101" }, office: [{ name: "Owner", kind: "owner" }], leads: ["Marcus"] });
putDoc(ORG, "jobs/j1", job("j1"));   // 1200 owed less 200 cash: 1000
putDoc(ORG, "jobs/j2", job("j2", { d: { name: "Omar Haddad", phone: "503-555-0177", email: "omar@example.com", moveDate: "2026-11-01" }, quote: { total: 800, deposit: 0 }, payments: {} }));
putDoc(ORG, "jobs/j3", job("j3", { d: { name: "Lena Wu", phone: "503-555-0190", email: "lena@example.com", moveDate: "2026-11-02" }, status: "booked", quote: { total: 640, deposit: 160 }, payments: {} }));
putDoc(ORG, "jobs/j4", job("j4", { d: { name: "Lena Wu", phone: "503-555-0190", email: "lena@example.com", moveDate: "2026-10-30" }, quote: { total: 500, deposit: 0 }, payments: {}, assign: { truckId: "", crew: ["Marcus"] } }));
putDoc(ORG2, "org/settings", { company: "Bright Moves" });
putDoc(ORG2, "jobs/b1", job("b1"));
DB.members.push(
  { org_id: ORG, user_id: "u-owner", role: "owner", staff: "Owner", email: "owner@ace.example" },
  { org_id: ORG, user_id: "u-dispatch", role: "dispatch", staff: "Dispatch" },
  { org_id: ORG, user_id: "u-marcus", role: "lead", staff: "Marcus" },
  { org_id: ORG, user_id: "u-kim", role: "crew", staff: "Kim" },
  { org_id: ORG2, user_id: "u-owner2", role: "owner", staff: "Bea" },
);
async function app(tok: string, body: any, org = ORG) {
  const r = await fn.handle(new Request(BASE + "/app", { method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: JSON.stringify({ org, ...body }) }));
  return { status: r.status, body: await r.json() };
}
async function getUrl(path: string) {
  const r = await fn.handle(new Request(BASE + path, { method: "GET", redirect: "manual" }));
  return { status: r.status, loc: r.headers.get("location") || "", text: r.status === 302 ? "" : await r.text() };
}
async function hookSig(body: string, key = HOOK_KEY, url = BASE + "/square") {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(url + body)));
  let s = ""; mac.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s);
}
let evN = 0;
async function event(type: string, object: any, merchant = "MLR1aceAAA", sig?: string) {
  const body = JSON.stringify({ merchant_id: merchant, type, event_id: "ev-" + (++evN), created_at: new Date().toISOString(), data: { type: type.split(".")[0], id: "x", object } });
  const r = await fn.handle(new Request(BASE + "/square", { method: "POST", headers: { "Content-Type": "application/json", "x-square-hmacsha256-signature": sig || await hookSig(body) }, body }));
  return { status: r.status, text: await r.text() };
}
const sqRow = (org = ORG) => DB.pay_square.find((r) => r.org_id === org && r.is_current);
const lines = (jobId: string, org = ORG) => doc("jobs/" + jobId, org).payments || {};
const logs = (jobId: string) => Object.values(doc("jobs/" + jobId).log || {}).map((l: any) => l.ev);
const stateOf = (url: string) => new URL(url).searchParams.get("state") || "";
async function connect(code: string, tok = "tok-owner", org = ORG) {
  const c = await app(tok, { action: "pay_sq_connect" }, org);
  return await getUrl("/square/oauth?code=" + encodeURIComponent(code) + "&state=" + encodeURIComponent(stateOf(c.body.url)) + "&response_type=code");
}

/* ======================= not set up on MoveCrew ======================= */
sqOff();
{
  const c = await app("tok-owner", { action: "pay_config" });
  ok(c.body.ok && !c.body.square && c.body.provider !== "square", "no Square app keys: pay_config says nothing about Square");
  const r = await app("tok-owner", { action: "pay_sq_connect" });
  ok(!r.body.ok && /SQUARE_APP_ID and SQUARE_APP_SECRET/.test(r.body.message), "Connect with Square says what's missing: " + r.body.message);
  const o = await getUrl("/square/oauth?code=x&state=y");
  ok(o.status === 400 && /expired/.test(o.text), "Square's sign-in coming back with Square not set up: the sign-in has expired");
}

/* ======================= the owner connects Square ======================= */
sqOn();
{
  noSquareTable = true;
  let c = await app("tok-owner", { action: "pay_config" });
  ok(c.body.square && c.body.square.table === false && c.body.square.mode === "test", "before supabase-square.sql: Setup is told the database step is missing");
  const r0 = await app("tok-owner", { action: "pay_sq_connect" });
  ok(!r0.body.ok && /supabase-square\.sql/.test(r0.body.message), "and Connect with Square says to run it");
  noSquareTable = false;
  c = await app("tok-owner", { action: "pay_config" });
  ok(c.body.square && c.body.square.table && !c.body.square.conn && c.body.square.appId === APP_ID && c.body.provider === "stripe", "with the table: Square offered, nothing connected, cards still go through Stripe");
  const d = await app("tok-dispatch", { action: "pay_sq_connect" });
  ok(d.status === 403 && !d.body.ok, "dispatch can't connect Square (the owner does)");
  const r = await app("tok-owner", { action: "pay_sq_connect" });
  const u = new URL(r.body.url);
  ok(r.body.ok && u.origin === "https://connect.squareupsandbox.com" && u.pathname === "/oauth2/authorize" && u.searchParams.get("client_id") === APP_ID, "Connect with Square: Square's sandbox sign-in page");
  ok(u.searchParams.get("scope") === fn.SQ_SCOPES.join(" ") && /PAYMENTS_WRITE/.test(u.search) && !/session=false/.test(r.body.url), "asking for the payments, orders, customers, disputes and profile scopes (no session=false in the sandbox): " + u.searchParams.get("scope"));
  const st = stateOf(r.body.url);
  // a made-up or altered state is refused
  let o = await getUrl("/square/oauth?code=code-ace-1&state=" + encodeURIComponent(st.replace(/.$/, (ch) => ch === "A" ? "B" : "A")));
  ok(o.status === 400 && /expired/.test(o.text) && !DB.pay_square.length, "an altered state is refused, nothing connected");
  o = await getUrl("/square/oauth?error=access_denied&error_description=user+denied&state=" + encodeURIComponent(st));
  ok(o.status === 400 && /cancelled/.test(o.text), "the owner pressing Deny on Square's page: not connected");
  // someone else's state (a company they aren't the owner of any more)
  const m = DB.members.find((x) => x.user_id === "u-owner"); m.role = "dispatch";
  o = await getUrl("/square/oauth?code=code-ace-1&state=" + encodeURIComponent(st));
  ok(o.status === 403 && !DB.pay_square.length, "no longer the owner when Square sends them back: refused");
  m.role = "owner";
  o = await getUrl("/square/oauth?code=code-ace-1&state=" + encodeURIComponent(st));
  ok(o.status === 200 && /Square is connected for Ace Moving LLC \(Square's sandbox: no real money moves\)/.test(o.text) && /Card payments for Ace Moving now go through Square/.test(o.text), "the code: connected, in plain words: " + o.text.split("\n")[0]);
  const row = sqRow();
  ok(row && row.merchant_id === "MLR1aceAAA" && row.location_id === "L1main" && row.location_name === "Ace Moving (Portland)" && row.business_name === "Ace Moving LLC" && row.status === "ready" && row.active && row.livemode === false && row.created_by === "u-owner", "the connection: the seller, its main location, active");
  const at = Object.keys(SQ.tokens).find((k) => SQ.tokens[k].merchant === "MLR1aceAAA")!;
  ok(/^v1\./.test(row.access_enc) && row.access_enc.indexOf(at) < 0 && JSON.stringify(row).indexOf(at) < 0 && JSON.stringify(row).indexOf("EQAAl") < 0, "the tokens are kept sealed, never in the clear");
  ok(await fn.sqUnseal(row.access_enc) === at && await fn.sqUnseal(row.access_enc.slice(0, -4) + "AAAA") === "", "sealed with the app secret: opens with it, and a changed one doesn't open");
  c = await app("tok-owner", { action: "pay_config" });
  ok(c.body.ready && c.body.provider === "square" && c.body.test === true && c.body.square.conn.state === "ready" && c.body.square.conn.active && c.body.square.conn.business === "Ace Moving LLC" && c.body.square.conn.locationId === "L1main" && c.body.square.appId === APP_ID,
    "pay_config: ready, through Square, in the sandbox, with what the card box needs");
  const k = await app("tok-kim", { action: "pay_config" });
  ok(k.body.provider === "square", "everyone in the company gets the same answer (the card box on the crew lead's phone)");
  // a code works once
  o = await getUrl("/square/oauth?code=code-ace-1&state=" + encodeURIComponent(st));
  ok(o.status === 400 && DB.pay_square.length === 1, "the same code again: refused, still one connection");
}

/* ======================= a card typed in ======================= */
{
  let r = await app("tok-kim", { action: "pay_intent", jobId: "j1", amount: 100, token: "cnon:card-nonce-ok" });
  ok(r.status === 403 && !r.body.ok, "a crew member can't take a card");
  r = await app("tok-marcus", { action: "pay_intent", jobId: "j1", amount: 1500, token: "cnon:card-nonce-ok" });
  ok(!r.body.ok && /more than the \$1,000\.00 still owed/.test(r.body.message) && !SQ.calls.some((x: any) => x.path === "/v2/payments"), "more than is owed: refused before Square is asked");
  r = await app("tok-marcus", { action: "pay_intent", jobId: "j1", amount: 250, token: "bad token!" });
  ok(!r.body.ok && /didn't come through/.test(r.body.message), "a token that isn't one: refused");
  r = await app("tok-marcus", { action: "pay_intent", jobId: "j1", amount: 250, token: "cnon:card-nonce-ok", save: true });
  const pay = Object.values(SQ.payments).find((p: any) => p.amount_money.amount === 25000) as any;
  const call = SQ.calls.find((x: any) => x.path === "/v2/payments" && x.body.amount_money.amount === 25000);
  ok(r.body.ok && r.body.done && r.body.message === "Card charged $250.00.", "Marcus charges $250 on the card typed in: " + r.body.message);
  ok(call && call.body.location_id === "L1main" && call.body.autocomplete === true && call.body.reference_id === "j1" && call.body.idempotency_key.length <= 45 && /^Ace Moving - Priya Nair/.test(call.body.note) && call.body.customer_id && call.body.buyer_email_address === "priya@example.com",
    "the payment: at the company's location, completed at once, for the job, with the customer, a key Square takes");
  const ln = lines("j1")["st_sq_" + pay.id];
  ok(ln && ln.amt === 250 && ln.method === "Visa ••1111 · test" && ln.stripe === "sq_" + pay.id && ln.by === "Marcus", "the job's line: $250, Visa ••1111 · test, the ledger's id: " + JSON.stringify(ln));
  const led = DB.pay_log.find((x) => x.pi === "sq_" + pay.id);
  ok(led && led.status === "succeeded" && led.amount_cents === 25000 && led.account === "sq:MLR1aceAAA" && led.livemode === false && led.source === "card" && led.by_staff === "Marcus", "the ledger: succeeded, on the Square account");
  const cus = SQ.customers.find((x: any) => x.id === call.body.customer_id);
  ok(cus && cus.phone_number === "+15035550142" && cus.email_address === "priya@example.com" && DB.pay_customers.some((x) => x.customer_id === cus.id && x.account === "sq:MLR1aceAAA" && /^sq:MLR1aceAAA\|/.test(x.cust_key)), "a Square customer for the job, filed under the Square account");
  // kept on file
  const card = DB.pay_cards.find((x) => x.account === "sq:MLR1aceAAA");
  const vault = card && doc("vault/" + card.id);
  ok(card && /^ccof:/.test(card.pm_id) && card.customer_id === cus.id && card.job_id === "j1" && card.livemode === false, "the card kept on file with Square (from the payment), for this customer and job");
  ok(vault && vault.via === "square" && vault.brand === "Visa" && vault.last4 === "1111" && vault.exp === "11/30" && vault.name === "Priya Nair" && (vault.jobs || []).indexOf("j1") >= 0 && JSON.stringify(vault).indexOf("ccof:") < 0, "the app's copy: brand, last four, expiry, name, never Square's id: " + JSON.stringify(vault));
  // the same token sent again (a double tap): one charge
  const before = Object.keys(SQ.payments).length;
  r = await app("tok-marcus", { action: "pay_intent", jobId: "j1", amount: 250, token: "cnon:card-nonce-ok", save: true });
  ok(Object.keys(SQ.payments).length === before && Object.keys(lines("j1")).filter((k) => /^st_sq_/.test(k)).length === 1, "the same card box token sent twice: charged once");
  // declines
  r = await app("tok-marcus", { action: "pay_intent", jobId: "j1", amount: 100, token: "cnon:card-nonce-declined" });
  const failed = Object.values(SQ.payments).find((p: any) => p.status === "FAILED") as any;
  ok(!r.body.ok && r.body.message === "The card was declined: the bank said no." && !lines("j1")["st_sq_" + failed.id], "a declined card: said plainly, nothing on the bill");
  ok(DB.pay_log.some((x) => x.pi === "sq_" + failed.id && x.status === "canceled" && /GENERIC_DECLINE/.test(x.error || "")), "the failed try is in the ledger, over (not looked up again)");
  r = await app("tok-marcus", { action: "pay_intent", jobId: "j1", amount: 100, token: "cnon:card-nonce-cvv" });
  ok(!r.body.ok && /security code is wrong/.test(r.body.message), "a wrong security code: " + r.body.message);
  r = await app("tok-marcus", { action: "pay_intent", jobId: "j1", amount: 100, token: "cnon:card-nonce-verify" });
  ok(!r.body.ok && r.body.needLink && /approve this one/.test(r.body.message), "the bank wants the customer to approve: send a pay link");
  r = await app("tok-marcus", { action: "pay_intent", jobId: "j1", amount: 100, token: "cnon:card-nonce-used" });
  ok(!r.body.ok && /timed out/.test(r.body.message), "a used token: type the card in again");
  const cfg = await app("tok-owner", { action: "pay_config" });
  ok(cfg.body.ready, "declines don't change anything about the connection");
}

/* ======================= a card on file ======================= */
{
  const card = clone(DB.pay_cards.find((x) => x.account === "sq:MLR1aceAAA"));
  let r = await app("tok-marcus", { action: "pay_saved", jobId: "j1", vaultId: card.id, amount: 100 });
  const call = SQ.calls.filter((x: any) => x.path === "/v2/payments").pop();
  ok(r.body.ok && /^Charged \$100\.00 to Visa ••1111\.$/.test(r.body.message) && call.body.source_id === card.pm_id && call.body.customer_id === card.customer_id && call.body.idempotency_key.length <= 45,
    "the card on file charged through Square: " + r.body.message);
  r = await app("tok-marcus", { action: "pay_saved", jobId: "j1", vaultId: card.id, amount: 100 });
  ok(!r.body.ok && /just charged \$100\.00/.test(r.body.message), "the same amount again a moment later: asked to check the bill first");
  r = await app("tok-marcus", { action: "pay_saved", jobId: "j2", vaultId: card.id, amount: 50 });
  ok(!r.body.ok && /different customer|another job/.test(r.body.message), "Marcus can't charge it on another customer's job: " + r.body.message);
  // removed by the office: disabled at Square
  r = await app("tok-owner", { action: "pay_forget", vaultId: card.id });
  ok(r.body.ok && SQ.cards[card.pm_id].enabled === false && !doc("vault/" + card.id) && DB.pay_cards.find((x) => x.id === card.id).pm_id === "", "Remove: disabled at Square, gone from the app, the record emptied");
  r = await app("tok-owner", { action: "pay_saved", jobId: "j1", vaultId: card.id, amount: 50 });
  ok(!r.body.ok, "and it can't be charged again");
}

/* ======================= a pay link ======================= */
{
  const owed0 = await fn.owedCents(ORG, "j2");
  let r = await app("tok-owner", { action: "pay_link", jobId: "j2", amount: 800, save: true });
  const link = DB.pay_links.find((x) => x.job_id === "j2" && x.status === "open");
  const pl = link && SQ.links[link.session_id.replace(/^sqpl_test_/, "")];
  ok(r.body.ok && /\/p\//.test(r.body.url) && link && /^sqpl_test_PL/.test(link.session_id) && link.account === "sq:MLR1aceAAA" && link.meta && link.meta.order_id === pl.order_id && !link.save_card,
    "a pay link: a Square payment link behind it, its order remembered (Square links can't keep a card)");
  const ord = SQ.orders[pl.order_id];
  ok(ord.reference_id === "j2" && ord.line_items.length === 1 && ord.line_items[0].base_price_money.amount === 80000 && ord.metadata.tally_job === "j2" && pl.checkout_options.allow_tipping === false && /\/pay\/done$/.test(pl.checkout_options.redirect_url) && pl.pre_populated_data.buyer_email === "omar@example.com",
    "the order: $800 for the job, no tip on a pay link, back to MoveCrew's thank-you page");
  let g = await getUrl("/p/" + link.token);
  ok(g.status === 302 && g.loc === pl.url, "opening the link goes to Square's page");
  // paid, then the webhook (signed by Square)
  const p = customerPaysLink(pl.id, "AMERICAN_EXPRESS");
  let e = await event("payment.updated", { payment: clone(p) }, "MLR1aceAAA", "bm90IHRoZSBzaWduYXR1cmU=");
  ok(e.status === 401 && !lines("j2")["st_sq_" + p.id], "an event with a bad signature: refused, nothing written");
  e = await event("payment.updated", { payment: clone(p) });
  const ln = lines("j2")["st_sq_" + p.id];
  ok(e.status === 200 && ln && ln.amt === 800 && ln.method === "Amex ••8431 (pay link) · test" && doc("jobs/j2").status === "paid", "Square's event: the payment on the job, Paid: " + JSON.stringify(ln));
  ok(DB.pay_links.find((x) => x.token === link.token).status === "paid" && DB.pay_log.find((x) => x.pi === "sq_" + p.id).source === "link", "the link is done; the ledger knows it came through a pay link");
  ok(owed0 === 80000 && await fn.owedCents(ORG, "j2") === 0, "nothing owed after it");
  g = await getUrl("/p/" + link.token);
  ok(g.status === 200 && /done/.test(g.text), "the link opened again: done, thank you");
  e = await event("payment.updated", { payment: clone(p) });
  ok(Object.keys(lines("j2")).filter((k) => /^st_sq_/.test(k)).length === 1, "the same event again: no second line");
}

/* ======================= a pay link paid with no event: picked up when the job is looked at ======================= */
{
  let r = await app("tok-owner", { action: "pay_link", jobId: "j3", amount: 160 });
  const link = DB.pay_links.find((x) => x.job_id === "j3" && x.status === "open");
  const pl = SQ.links[link.session_id.replace(/^sqpl_test_/, "")];
  // a smaller one replaces it: the first page is taken down at Square
  r = await app("tok-owner", { action: "pay_link", jobId: "j3", amount: 100 });
  const l2 = DB.pay_links.find((x) => x.job_id === "j3" && x.status === "open");
  ok(r.body.ok && l2.token !== link.token && pl.deleted && DB.pay_links.find((x) => x.token === link.token).status === "expired", "a new link for the job: the old one's Square page is taken down");
  const p = customerPaysLink(l2.session_id.replace(/^sqpl_test_/, ""));
  r = await app("tok-owner", { action: "pay_check", jobId: "j3" });
  ok(r.body.ok && lines("j3")["st_sq_" + p.id] && lines("j3")["st_sq_" + p.id].amt === 100 && r.body.owed === 540, "no event yet: Check now finds the payment through the link's order (owed $540): " + JSON.stringify(r.body));
}

/* ======================= refunds and disputes made in Square ======================= */
{
  const p = Object.values(SQ.payments).find((x: any) => x.status === "COMPLETED" && x.order_id && SQ.orders[x.order_id] && SQ.orders[x.order_id].reference_id === "j2") as any;
  refundOn(p.id, 20000);
  let e = await event("refund.updated", { refund: { id: "R1", payment_id: p.id, status: "COMPLETED", amount_money: { amount: 20000, currency: "USD" } } });
  const rf = lines("j2")["rf_sq_" + p.id];
  ok(e.status === 200 && rf && rf.amt === -200 && /Refund · Amex ••8431/.test(rf.method) && doc("jobs/j2").status === "done", "a $200 refund made in Square: on the bill, the job owes again: " + JSON.stringify(rf));
  ok(logs("j2").some((l) => /Back to Complete: \$200\.00? is owed again|Back to Complete: \$200 is owed again/.test(l)), "and says so in its history");
  SQ.disputes.push({ id: "DP1", merchant: "MLR1aceAAA", state: "EVIDENCE_REQUIRED", reason: "NOT_AS_DESCRIBED", amount_money: { amount: 30000, currency: "USD" }, disputed_payment: { payment_id: p.id } });
  e = await event("dispute.created", { dispute: { id: "DP1", state: "EVIDENCE_REQUIRED", disputed_payment: { payment_id: p.id } } });
  const dp = lines("j2")["dp_sq_" + p.id];
  ok(e.status === 200 && dp && dp.amt === -300 && /^Disputed · /.test(dp.method) && logs("j2").some((l) => /Square holds \$300/.test(l)), "a dispute: Square holds $300 until the bank decides: " + JSON.stringify(dp));
  SQ.disputes[0].state = "WON";
  e = await event("dispute.state.changed", { dispute: { id: "DP1", state: "WON", disputed_payment: { payment_id: p.id } } });
  ok(!lines("j2")["dp_sq_" + p.id] && logs("j2").some((l) => /Dispute closed/.test(l)), "won: the money held comes back");
  e = await event("payment.updated", { payment: { id: "PAYnothere" } });
  ok(e.status === 200 && /not-tally/.test(e.text), "a payment MoveCrew didn't take: left alone");
  e = await event("payment.updated", { payment: clone(p) }, "MLR3other");
  ok(e.status === 200 && /other-account/.test(e.text), "the same payment named by another seller's event: not written onto Ace's jobs");
}

/* ======================= the customer app's page, with a tip ======================= */
{
  const r = (await app("tok-lena", { action: "cust_pay", org: ORG, jobId: "j4", kind: "bill", amount: 50000, tip: 4000, back: "https://mischief503.github.io/Tally/" })).body;
  const link = DB.pay_links.find((x) => x.job_id === "j4" && x.status === "open" && x.created_by === fn.CUST_BY);
  const pl = link && SQ.links[link.session_id.replace(/^sqpl_test_/, "")], ord = pl && SQ.orders[pl.order_id];
  ok(r.ok && r.url === pl.url && link.meta.tip === 4000 && ord.line_items.length === 2 && ord.line_items[1].name === "Tip for your crew" && ord.line_items[1].base_price_money.amount === 4000,
    "the customer app: Square's page with the tip as its own line: " + JSON.stringify(r).slice(0, 160));
  ok(/^https:\/\/mischief503\.github\.io\/Tally\//.test(pl.checkout_options.redirect_url), "back to the customer's app afterwards");
  const p = customerPaysLink(pl.id);
  const e = await event("payment.updated", { payment: clone(p) });
  const ln = lines("j4")["st_sq_" + p.id];
  ok(e.status === 200 && ln && ln.tip === 40 && ln.amt === 500 && /customer app/.test(ln.method) && doc("jobs/j4").status === "paid", "paid: the $500 bill and the $40 tip apart, and the job is paid: " + JSON.stringify(ln));
  ok(DB.pay_links.find((x) => x.token === link.token).status === "paid" && DB.pay_log.find((x) => x.pi === "sq_" + p.id).source === "cust;tip=4000", "the page is done; the ledger keeps the tip in it");
}

/* ======================= switching to Stripe and back, and the seller taking access back ======================= */
{
  let r = await app("tok-dispatch", { action: "pay_sq_use", use: "stripe" });
  ok(r.status === 403, "only the owner picks how cards are taken");
  r = await app("tok-owner", { action: "pay_sq_use", use: "stripe" });
  let c = await app("tok-owner", { action: "pay_config" });
  ok(r.body.ok && c.body.provider === "stripe" && c.body.square.conn.active === false && c.body.square.conn.state === "ready", "Use Stripe: cards go through Stripe again, Square stays connected");
  r = await app("tok-marcus", { action: "pay_intent", jobId: "j1", amount: 60, token: "cnon:card-nonce-ok" });
  ok(!SQ.calls.some((x: any) => x.path === "/v2/payments" && x.body.amount_money.amount === 6000), "a card now isn't charged on Square");
  r = await app("tok-owner", { action: "pay_sq_use", use: "square" });
  c = await app("tok-owner", { action: "pay_config" });
  ok(r.body.ok && c.body.provider === "square", "and back to Square");
  // the access token running out: renewed with the refresh token, then the call goes through
  const row = sqRow();
  row.expires_at = new Date(Date.now() + 2 * 864e5).toISOString();
  const old = await fn.sqUnseal(row.access_enc);
  r = await app("tok-marcus", { action: "pay_intent", jobId: "j1", amount: 75, token: "cnon:ok-2" });
  ok(r.body.ok && (await fn.sqUnseal(sqRow().access_enc)) !== old && Date.parse(sqRow().expires_at) > Date.now() + 20 * 864e5, "a token close to running out is renewed before it is used");
  // the seller takes MoveCrew's access back in Square: no more charges, and Setup says so
  let e = await event("oauth.authorization.revoked", { revocation: { revoked_at: new Date().toISOString(), revoker_type: "MERCHANT" } });
  c = await app("tok-owner", { action: "pay_config" });
  ok(e.status === 200 && sqRow().status === "revoked" && c.body.provider !== "square" && c.body.square.conn.state === "revoked" && sqRow().access_enc === "", "the seller revoked MoveCrew in Square: the connection is marked, tokens wiped, Setup says so");
  r = await app("tok-marcus", { action: "pay_intent", jobId: "j1", amount: 75, token: "cnon:ok-3" });
  ok(!SQ.calls.some((x: any) => x.path === "/v2/payments" && x.body.source_id === "cnon:ok-3"), "and nothing goes to Square after it");
  // connected again
  let o = await connect("code-ace-2");
  ok(o.status === 200 && sqRow().status === "ready" && sqRow().merchant_id === "MLR1aceAAA" && DB.pay_square.filter((x) => x.org_id === ORG).length === 1, "connected again: the same seller, one row");
  // another Square account, one that can't take cards yet
  o = await connect("code-nocard");
  c = await app("tok-owner", { action: "pay_config" });
  const old1 = DB.pay_square.find((x) => x.org_id === ORG && x.merchant_id === "MLR1aceAAA");
  ok(/can't take card payments yet/.test(o.text) && sqRow().merchant_id === "MLR2nocard" && sqRow().status === "no-location" && c.body.provider !== "square" && c.body.square.conn.state === "no-location",
    "another Square account that can't take cards yet: connected, but cards don't go through it, and Setup says why");
  ok(old1 && old1.is_current === false && old1.status === "ready" && old1.access_enc, "the earlier Square account stays on file (for its payments' refunds)");
  // a refund made later on a payment from the earlier account still lands
  const p = Object.values(SQ.payments).find((x: any) => x.merchant === "MLR1aceAAA" && x.status === "COMPLETED" && x.reference_id === "j1") as any;
  refundOn(p.id, 5000);
  e = await event("refund.updated", { refund: { id: "R2", payment_id: p.id, status: "COMPLETED", amount_money: { amount: 5000, currency: "USD" } } });
  ok(e.status === 200 && lines("j1")["rf_sq_" + p.id] && lines("j1")["rf_sq_" + p.id].amt === -50, "a refund made later on a payment taken with the earlier Square account still comes onto the job");
  // disconnected from Setup
  const revs = SQ.revoked.length;
  r = await app("tok-dispatch", { action: "pay_sq_disconnect" });
  ok(r.status === 403 && sqRow(), "dispatch can't disconnect Square");
  r = await app("tok-owner", { action: "pay_sq_disconnect" });
  c = await app("tok-owner", { action: "pay_config" });
  const gone = DB.pay_square.find((x) => x.org_id === ORG && x.merchant_id === "MLR2nocard");
  ok(r.body.ok && /stay in your Square account/.test(r.body.message) && SQ.revoked[revs] === "MLR2nocard" && !sqRow() && gone.status === "revoked" && gone.access_enc === "" && gone.refresh_enc === "" && c.body.provider !== "square" && !c.body.square.conn,
    "Disconnect: Square takes the access back, the tokens go, the payments already taken stay");
}

/* ======================= another company ======================= */
{
  const o = await connect("code-ace-3", "tok-owner2", ORG2);
  ok(o.status === 200 && sqRow(ORG2) && sqRow(ORG2).merchant_id === "MLR1aceAAA", "another company may connect the same Square seller");
  const r = await app("tok-owner", { action: "pay_check", jobId: "b1" }, ORG2);
  ok(r.status === 401 || r.status === 403 || !r.body.ok, "Ace's owner can't reach Bright Moves' payments");
}

console.log(`\nsquare: ${passes} passed, ${failures} failed`);
Deno.exit(failures ? 1 : 0);

// Refunds from the app and autopay for storage (batch 15, Nov 22): the hosted edition with a fake Edge Function.
// Refunds: the owner (or dispatch with Options › Dispatch can give refunds) refunds a card payment from its line on
// the job; the server gives it back and writes the refund onto the job. Autopay: a storage account's card on file
// pays each bill by itself, turned on by the office; an office phone asks the server once per bill.
// Run: node tests/ui/refund.js
const { load, ok, sleep, summary } = require('./lib');
const FILE = __dirname + '/../../build/tally-supabase.html';
const ART = __dirname + '/../../build/tally-artifact.html';
const ORG = 'org-1';
const CARD = 'st_9f86d081884c7d659a2f';
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const day = (n) => iso(new Date(Date.now() + n * 864e5));

function jobDoc(id, over = {}) {
  return Object.assign({ id, status: 'paid', createdAt: Date.now() - 4 * 864e5, finishedAt: Date.now() - 864e5,
    d: { name: 'Priya Nair', phone: '512-555-0142', email: '', source: 'Google', moveDate: day(-1), time: '08:00', from: '418 Oak St', to: '77 Ridge Rd', miles: '', flights: '', pack: false, crew: '', truckId: '', hoursOverride: '', discount: '', notes: '', custom: {}, items: [] },
    quote: { total: 1000, cf: 500, crew: 3, hours: 4, lines: [{ label: 'Movers', amt: 1000 }], deposit: 0, nte: 1150, lbs: 3500, truckId: 't26', truckName: 'Box 1', nTrucks: 1, pct: 0.3, count: 10 },
    items: [], assign: { truckId: 't26', crew: ['Marcus', 'Dee'] }, tally: {}, signed: {}, extras: {}, crewNotes: {}, photos: {}, materials: {}, costs: {}, log: {},
    // a card payment the server wrote (with the crew's tip), and cash recorded on a phone
    payments: { st_pi_100: { id: 'st_pi_100', amt: 1000, tip: 150, method: 'Visa ending 4242 · test', date: day(-1), ts: 2, stripe: 'pi_100', live: false },
      p_cash: { id: 'p_cash', amt: 50, method: 'Cash', date: day(-1), ts: 3 } } }, over);
}
function seed() {
  const docs = [];
  const put = (path, data) => { const [collection, doc_id] = path.split('/'); docs.push({ org_id: ORG, path, collection, doc_id, data, updated_at: new Date().toISOString() }); };
  put('meta/init', { ts: 1, mode: 'fresh' });
  put('org/settings', { company: 'Ace Moving', crew: ['Marcus', 'Dee'], leads: ['Marcus'], office: [{ name: 'Owner', kind: 'owner' }, { name: 'Sam', kind: 'dispatch' }],
    contacts: { Owner: '512-555-0100' }, trucks: [{ id: 't26', name: 'Box 1', cf: 1700 }], opt: { storage: true }, sto: { addr: '900 Industrial Way' } });
  put('jobs/j2', jobDoc('j2'));
  // Lena Wu's storage account: in since 40 days ago, so its bills are made when the office opens MoveCrew
  put('jobs/s1', { id: 's1', status: 'storage', createdAt: Date.now() - 40 * 864e5,
    d: { name: 'Lena Wu', phone: '512-555-0177', email: '', jobType: 'storage', moveDate: '', time: '', from: '900 Industrial Way', to: '', source: '', custom: {}, items: [],
      sto: { vaults: ['v1'], prices: { v1: 150 }, start: day(-40), since: day(-40), from: '', out: '', outJob: '' } },
    quote: { total: 0, cf: 0, crew: 0, hours: 0, lines: [], deposit: 0 }, items: [], assign: { truckId: '', crew: [] }, tally: {}, payments: {}, signed: {}, extras: {}, crewNotes: {}, photos: {}, materials: {}, costs: {}, log: {} });
  put('vault/' + CARD, { id: CARD, cust: '5125550177', type: 'card', brand: 'Visa', last4: '4242', exp: '03/30', ts: 1, via: 'stripe', live: false, name: 'Lena Wu', jobs: ['s1'] });
  return { docs, access_requests: [], comm_log: [],
    members: [{ org_id: ORG, user_id: 'u-owner', email: 'o@x.com', staff: 'Owner', role: 'owner', ts: 1 }, { org_id: ORG, user_id: 'u-sam', email: 's@x.com', staff: 'Sam', role: 'dispatch', ts: 1 },
      { org_id: ORG, user_id: 'u-marcus', email: 'm@x.com', staff: 'Marcus', role: 'lead', ts: 1 }],
    comm_lines: [] };
}
const fnCalls = (A, act) => A.calls.fn.filter((c) => c.body.action === act);
function replies(ctl) {
  return (b) => {
    if (b.action === 'pay_config') return { ok: true, ready: true, test: true, publishableKey: 'pk_test_1', reason: '' };
    if (b.action === 'pay_refund') return ctl.refund || { ok: true, message: 'Refunded $' + Number(b.amount).toFixed(2) + ' to Visa ending 4242. It shows on their statement in 5 to 10 days.' };
    if (b.action === 'pay_auto') return ctl.auto || { ok: true, tried: true, message: 'Charged $150.00 to Visa ending 4242.' };
    return { ok: true, sent: 0 };
  };
}

(async () => {
  const ctl = {};
  let A = await load(FILE, { db: seed(), org: ORG, me: { uid: 'u-owner', email: 'o@x.com' }, fnReply: replies(ctl) });
  let { $, $$, click, T, w } = A;
  const S = () => T.state().settings, job = (id) => T.state().jobs.find((j) => j.id === id);
  const sheet = () => ($('#sheet') && !$('#sheet').hidden ? $('#sheet').textContent.replace(/\s+/g, ' ') : '');
  const toast = () => ($('#toast') ? $('#toast').textContent : '');
  const type = (sel, v) => { const e = $(sel); e.value = v; e.dispatchEvent(new w.Event('input', { bubbles: true })); };

  /* ---------------- a refund from the job ---------------- */
  T.openJob('j2'); await sleep(40);
  const links = () => $$('#sheet [data-act="sh:refund"]');
  ok(links().length === 1 && links()[0].dataset.pid === 'st_pi_100' && links()[0].textContent === 'Refund', 'the owner: Refund on the card payment, not on the cash');
  ok(T.refundLeft(job('j2'), job('j2').payments.find((p) => p.id === 'st_pi_100')) === 1150 && T.refundLeft(job('j2'), job('j2').payments.find((p) => p.id === 'p_cash')) === 0,
    'what can go back: the $1,000 payment and its $150 tip; cash isn’t refunded here');
  click(links()[0]); await sleep(20);
  ok($('#refundBox') && /Refund Visa ending 4242/.test($('#refundBox').textContent) && !/ · test/.test($('#refundBox h3').textContent) && $('#rfAmt').value === '1000.00' &&
    /\$1,150 of it can go back, \$150 of that the crew’s tip\. Past \$1,000, a refund comes off their tip\. It goes back to the card and shows on their statement in 5 to 10 days\./.test(sheet()),
    'the refund: the card, the bill’s part to start, and what comes off the tip past it');
  type('#rfAmt', '2000.00');   // a money box fills from the right: 2000.00 is $2,000
  click('#sheet [data-act="sh:refundgo"]'); await sleep(20);
  ok(/That is more than the \$1,150 left of that payment\./.test(toast()) && !fnCalls(A, 'pay_refund').length, 'more than is left: it says so, and nothing goes to the server');
  type('#rfAmt', '100.00');
  $('#rfWhy').value = 'duplicate';
  click('#sheet [data-act="sh:refundgo"]'); await sleep(20);
  ok($('#sheet [data-act="sh:refundgo"]').textContent === 'Tap again to refund $100' && $('#rfAmt').value === '100.00' && $('#rfWhy').value === 'duplicate' && !fnCalls(A, 'pay_refund').length,
    'the first tap asks again, keeping the amount and why');
  click('#sheet [data-act="sh:refundgo"]'); await sleep(60);
  const rc = fnCalls(A, 'pay_refund');
  ok(rc.length === 1 && rc[0].body.jobId === 'j2' && rc[0].body.pi === 'pi_100' && rc[0].body.amount === 100 && rc[0].body.reason === 'duplicate' && /^r[a-z0-9]{8,}$/.test(rc[0].body.nonce),
    'the second tap: the server gets the payment, $100, why and the tap’s own id');
  ok(/Refunded \$100\.00 to Visa ending 4242/.test(toast()) && !$('#refundBox'), 'refunded: it says so and the form closes (the refund’s line comes from the server)');
  // the server's lines: $100 off the bill
  job('j2').payments.push({ id: 'rf_pi_100', amt: -100, method: 'Refund · Visa ending 4242', date: day(0), ts: 4, stripe: 'pi_100', live: false });
  ok(T.refundLeft(job('j2'), job('j2').payments.find((p) => p.id === 'st_pi_100')) === 1050, 'its refund line counts: $1,050 can still go back');
  job('j2').payments.push({ id: 'rt_pi_100', amt: 0, tip: -150, method: 'Tip back $150.00', date: day(0), ts: 5, stripe: 'pi_100', live: false });
  job('j2').payments.find((p) => p.id === 'rf_pi_100').amt = -1000;
  T.renderSheet ? T.renderSheet() : T.openJob('j2'); await sleep(20);
  ok(T.refundLeft(job('j2'), job('j2').payments.find((p) => p.id === 'st_pi_100')) === 0 && !links().length, 'all of it back, the tip too: no Refund left on it');
  job('j2').payments = job('j2').payments.filter((p) => !/^(rf|rt)_/.test(p.id));
  T.openJob('j2'); await sleep(20);
  ctl.refund = { ok: false, message: "That payment has been given back already." };
  click(links()[0]); await sleep(20);
  click('#sheet [data-act="sh:refundgo"]'); await sleep(10); click('#sheet [data-act="sh:refundgo"]'); await sleep(60);
  ok(/given back already/.test(toast()) && $('#refundBox'), 'the server says no: it says why, and the form stays');
  click('#sheet [data-act="sh:refundx"]'); await sleep(10);
  ok(!$('#refundBox'), 'Cancel closes it');
  ctl.refund = null;
  const pend = job('j2').payments.find((p) => p.id === 'st_pi_100'); pend.pending = true; T.openJob('j2'); await sleep(20);
  ok(!links().length, 'a payment still clearing can’t be refunded yet'); delete pend.pending;

  /* ---------------- autopay on Lena Wu’s storage account ---------------- */
  const s1 = () => job('s1');
  T.stoTick(); await sleep(20);
  const bills = () => T.stoBills(s1());
  ok(bills().length >= 2 && T.balOf(s1()) >= 300, 'her bills were made: ' + bills().map((b) => b.id).join(', '));
  T.openJob('s1'); await sleep(30);
  ok(/Autopay: a card on file pays each bill by itself, with the customer’s OK/.test(sheet()) && $('#sheet [data-act="sto:autoon"]').textContent === 'Visa ending 4242', 'Autopay: her card on file to pick');
  click('#sheet [data-act="sto:autoon"]'); await sleep(20);
  ok($('#sheet [data-act="sto:autoon"]').textContent === 'Tap again: Visa ending 4242 pays each bill' && !s1().d.sto.autopay, 'the first tap asks again');
  click('#sheet [data-act="sto:autoon"]'); await sleep(20);
  const newest = bills()[bills().length - 1].id;
  ok(s1().d.sto.autopay && s1().d.sto.autopay.vault === CARD && s1().d.sto.autopay.label === 'Visa ending 4242' && s1().d.sto.autoTry.skip === true && s1().d.sto.autoTry.bill === newest &&
    /Autopay is on\. Visa ending 4242 pays the next bill, /.test(toast()) && s1().log.some((l) => /^Autopay on: Visa ending 4242 pays each bill · Owner$/.test(l.ev)),
    'on: the card pays each bill from the next one (what’s owed now is collected the usual way)');
  ok(/Visa ending 4242 pays each bill by itself\.\s*It starts with the next bill\.\s*Turn autopay off/.test(sheet()), 'the account says so: ' + (sheet().match(/Autopay.{0,160}/) || [''])[0]);
  T.stoTick(); await sleep(30);
  ok(!fnCalls(A, 'pay_auto').length, 'nothing is charged for the bill it came on with');
  // the next bill comes
  const nb = 'sm_' + day(0), from = newest.slice(3);
  s1().extras = s1().extras.filter((e) => e.id !== nb).concat([{ id: nb, label: 'Storage next month: Unit #1', amt: 150, ts: Date.now(), sto: { from: day(0), to: day(29), n: 1, units: ['v1'] } }]);
  s1().d.sto.autoTry = { bill: from > day(0) ? from : newest, at: 1, ok: true, skip: true, msg: '' };
  T.stoTick(); await sleep(40);
  const ac = fnCalls(A, 'pay_auto');
  ok(ac.length === 1 && ac[0].body.jobId === 's1' && ac[0].body.bill === nb, 'a new bill: the office’s phone asks the server to charge it, once: ' + JSON.stringify(ac.map((c) => c.body)));
  T.stoTick(); T.stoTick(); await sleep(40);
  ok(fnCalls(A, 'pay_auto').length === 1, 'asked once, however often it looks');
  // the server wrote that it didn't go through
  s1().d.sto.autoTry = { bill: nb, at: Date.now(), ok: false, msg: 'The card was declined: insufficient funds.' };
  T.openJob('s1'); await sleep(20);
  ok(/Didn’t go through for the .* bill: The card was declined: insufficient funds\./.test(sheet()), 'the account says it didn’t go through, and why');
  const alerts = () => T.stoAlerts().join(' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  ok(/Storage bill past due: Lena Wu \$[\d,.]+ owed · since .* · autopay didn’t go through/.test(alerts()) && !/Autopay didn’t go through: Lena Wu/.test(alerts()),
    'Today, past due: the past-due row says autopay didn’t go through too: ' + alerts().slice(0, 200));
  // the older bills paid: only the new one is owed, not past due yet
  s1().payments.push({ id: 'p_old', amt: Math.round((T.balOf(s1()) - 150) * 100) / 100, method: 'Cash', date: day(0), ts: Date.now() });
  ok(/Autopay didn’t go through: Lena Wu/.test(alerts()) && /The card was declined: insufficient funds · \$150 owed/.test(alerts()), 'Today: Autopay didn’t go through: Lena Wu, why, and the $150 owed: ' + alerts().slice(0, 200));
  // the customer app
  const info = T.stoCustInfo(s1(), S());
  ok(info.autopay && info.autopay.label === 'Visa ending 4242', 'the customer’s copy has the card that pays');
  const card = T.custStoCard({ status: 'storage', sto: info, bill: { due: 300, paid: 0 }, test: false }).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  ok(/Autopay: Visa ending 4242 pays each bill\./.test(card), 'their In storage card says autopay is on');
  click('#sheet [data-act="sto:autooff"]'); await sleep(20);
  ok(!s1().d.sto.autopay && !s1().d.sto.autoTry && /Autopay is off\./.test(toast()) && s1().log.some((l) => /^Autopay off \(Visa ending 4242\) · Owner$/.test(l.ev)), 'off again, in the account’s activity');
  ok(!A.errors.length, 'no errors for the owner: ' + A.errors.join(' | '));

  /* ---------------- dispatch, the crew, and the claude.ai copy ---------------- */
  A = await load(FILE, { db: seed(), org: ORG, me: { uid: 'u-sam', email: 's@x.com' }, fnReply: replies(ctl) });
  ({ $, $$, click, T, w } = A);
  T.openJob('j2'); await sleep(40);
  ok(T.state().ui.role === 'dispatch' && !$$('#sheet [data-act="sh:refund"]').length, 'dispatch: no refunds to start');
  T.state().settings.opt.dispatchRefund = true; T.openJob('j2'); await sleep(20);
  ok($$('#sheet [data-act="sh:refund"]').length === 1, 'with Options › Dispatch can give refunds on: Refund');
  ok(!A.errors.length, 'no errors for dispatch: ' + A.errors.join(' | '));
  A = await load(FILE, { db: seed(), org: ORG, me: { uid: 'u-marcus', email: 'm@x.com' }, fnReply: replies(ctl) });
  ({ T } = A);
  ok(T.state().ui.role === 'lead' && !T.canRefund(), 'a crew lead never refunds');
  A = await load(ART, {});
  ok(!A.T.canRefund(), 'the claude.ai copy takes no cards, so it gives no refunds');
  process.exit(summary('refund') ? 1 : 0);
})();

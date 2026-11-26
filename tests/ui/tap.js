// Tap to pay (batch 15b, Nov 22): the customer taps their card or phone on the back of the crew's Android phone.
// The hosted edition with a fake Edge Function and a fake Android app (TallyNative: tapCheck, tapPay, tapToken),
// standing in for MoveCrew's Android app with Stripe Terminal's Tap to Pay in it.
// Run: node tests/ui/tap.js
const { load, ok, sleep, summary } = require('./lib');
const FILE = __dirname + '/../../build/tally-supabase.html';
const ART = __dirname + '/../../build/tally-artifact.html';
const ORG = 'org-1';
const CARD = 'st_9f86d081884c7d659a2f';
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const day = (n) => iso(new Date(Date.now() + n * 864e5));

function jobDoc(id, over = {}) {
  return Object.assign({ id, status: 'done', createdAt: Date.now() - 4 * 864e5, startedAt: Date.now() - 4e6, finishedAt: Date.now() - 6e5,
    d: { name: 'Lena Wu', phone: '512-555-0177', email: '', source: 'Google', moveDate: day(0), time: '08:00', from: '418 Oak St', to: '77 Ridge Rd', miles: '', flights: '', pack: false, crew: '', truckId: '', hoursOverride: '', discount: '', notes: '', custom: {}, items: [] },
    quote: { total: 1000, cf: 500, crew: 3, hours: 4, lines: [{ label: 'Movers', amt: 1000 }], deposit: 0, nte: 1150, lbs: 3500, truckId: 't26', truckName: 'Box 1', nTrucks: 1, pct: 0.3, count: 10 },
    items: [], assign: { truckId: 't26', crew: ['Marcus', 'Dee'] }, tally: {}, signed: {}, extras: {}, crewNotes: {}, photos: {}, materials: {}, costs: {}, log: {}, payments: {} }, over);
}
function seed(o = {}) {
  const docs = [];
  const put = (path, data) => { const [collection, doc_id] = path.split('/'); docs.push({ org_id: ORG, path, collection, doc_id, data, updated_at: new Date().toISOString() }); };
  put('meta/init', { ts: 1, mode: 'fresh' });
  put('org/settings', { company: 'Ace Moving', crew: ['Marcus', 'Dee'], leads: ['Marcus'], office: [{ name: 'Owner', kind: 'owner' }], contacts: { Owner: '512-555-0100' },
    trucks: [{ id: 't26', name: 'Box 1', cf: 1700 }], shopAddress: '900 Industrial Way, Portland, OR 97210', opt: o.opt || {} });
  put('jobs/j2', jobDoc('j2'));
  if (o.card) put('vault/' + CARD, { id: CARD, cust: '5125550177', type: 'card', brand: 'Visa', last4: '4242', exp: '03/30', ts: 1, via: 'stripe', live: !!o.live, name: 'Lena Wu', jobs: ['j2'] });
  return { docs, access_requests: [], comm_log: [], comm_lines: [],
    members: [{ org_id: ORG, user_id: 'u-owner', email: 'o@x.com', staff: 'Owner', role: 'owner', ts: 1 }, { org_id: ORG, user_id: 'u-marcus', email: 'm@x.com', staff: 'Marcus', role: 'lead', ts: 1 }] };
}
// the fake Android app: what the page asked of it, and a way to answer as the phone would
function phone(log, can = true) {
  return (w) => {
    w.TallyNative = {
      tapCheck() { log.push(['check']); return JSON.stringify(can ? { ok: true } : { ok: false, why: 'android' }); },
      tapPay(id, json) { log.push(['pay', id, JSON.parse(json)]); },
      tapToken(id, secret, err) { log.push(['token', id, secret, err]); },
      hasGoogle() { return false; },
    };
  };
}
const fnCalls = (A, act) => A.calls.fn.filter((c) => c.body.action === act);
function replies(ctl) {
  return (b) => {
    if (b.action === 'pay_config') return ctl.cfg || { ok: true, ready: true, test: true, publishableKey: 'pk_test_1', reason: '' };
    if (b.action === 'pay_tap') return ctl.tap || { ok: true, clientSecret: 'pi_7_secret_abc', pi: 'pi_7', location: 'tml_1', live: !!(ctl.cfg && ctl.cfg.test === false), account: '', merchant: 'Ace Moving', amount: 1150, tip: 150 };
    if (b.action === 'pay_tap_cancel') return { ok: true, piStatus: 'canceled' };
    if (b.action === 'pay_tap_token') return ctl.token || { ok: true, secret: 'pst_test_1', live: false, account: '' };
    if (b.action === 'pay_check') return { ok: true, owed: 0, fixed: 0, piStatus: 'succeeded' };
    return { ok: true, sent: 0 };
  };
}

(async () => {
  const ctl = {}, log = [];
  let A = await load(FILE, { db: seed(), org: ORG, me: { uid: 'u-owner', email: 'o@x.com' }, fnReply: replies(ctl), setup: phone(log) });
  let { $, $$, click, T } = A;
  const flowText = () => ($('#flow') ? $('#flow').textContent.replace(/\s+/g, ' ') : '');
  const ways = () => $$('#flow [data-act="flow:method"]').map((c) => c.dataset.m).join();
  const on = () => ($('#flow [data-act="flow:method"].on') || {}).dataset || {};
  const payBtn = () => $('#flow [data-act="flow:pay"]');
  const toast = () => ($('#toast') ? $('#toast').textContent : '');
  const lastPay = () => log.filter((x) => x[0] === 'pay').slice(-1)[0];
  const answer = (r) => { A.w.__tallyNativeDone(lastPay()[1], r); };
  const openPay = async () => {
    if (!$('#sheet [data-act="flow:open"]')) { click('[data-act="tab"][data-tab="jobs"]'); await sleep(20); click('[data-act="job:open"][data-id="j2"]'); await sleep(40); }
    click('#sheet [data-act="flow:open"]'); await sleep(60);
  };

  /* ---------------- the way to pay on a phone that can take a tap ---------------- */
  await openPay();
  ok(T.tapCan() === true && log.some((x) => x[0] === 'check'), 'MoveCrew\'s Android app says this phone can take a tap');
  ok(ways() === 'tap,link,card,other' && on().m === 'tap' && $$('#flow [data-act="flow:method"]').map((c) => c.textContent).join('|') === 'Tap to pay|Pay link|Card|Cash or check',
    'Tap to pay is a way to pay, picked first when no card is on file for the job: ' + ways());
  ok($('#flow .tapbox svg') && /Stripe test mode: this phone pretends a Visa was tapped, so nothing needs to touch it\./.test(flowText()), 'test mode: the phone pretends the tap, and says so');
  ok(payBtn().disabled && payBtn().textContent === 'Pick a tip first', 'the tip comes first, as for every way to pay');
  click('#flow [data-act="flow:tip"][data-t="15"]'); await sleep(30);
  ok(payBtn().textContent === 'Tap to pay $1,150' && !payBtn().disabled, 'then the button says the final total: Tap to pay $1,150');

  /* ---------------- a tap that goes through ---------------- */
  click(payBtn()); await sleep(40);
  const tc = fnCalls(A, 'pay_tap');
  ok(tc.length === 1 && tc[0].body.jobId === 'j2' && tc[0].body.amount === 1000 && tc[0].body.tip === 150, 'the server makes the payment: $1,000 toward the bill and the $150 tip');
  const p1 = lastPay();
  ok(p1 && p1[2].secret === 'pi_7_secret_abc' && p1[2].location === 'tml_1' && p1[2].live === false && p1[2].account === '' && p1[2].merchant === 'Ace Moving',
    'the phone\'s reader is asked to take the tap for it, on the company\'s location, in test mode, with its name');
  ok(payBtn().disabled && payBtn().textContent === 'Waiting for the tap…' && !fnCalls(A, 'pay_check').length, 'while Stripe\'s screen waits for the tap, the button waits too');
  answer({ ok: true, pi: 'pi_7' }); await sleep(60);
  const ck = fnCalls(A, 'pay_check');
  ok(ck.length >= 1 && ck.some((c) => c.body.jobId === 'j2' && c.body.pi === 'pi_7') && /Paid \$1,150 by tap, with a \$150 tip for the crew\./.test(toast()) && !fnCalls(A, 'pay_tap_cancel').length,
    'the phone says it went through: the server writes it down, and the toast says so: ' + toast());

  /* ---------------- taps that don't happen ---------------- */
  const tapAgain = async () => { if (!$('#flow')) await openPay(); click('#flow [data-act="flow:method"][data-m="tap"]'); await sleep(20); if ($('#flow [data-act="flow:tip"][data-t="0"]')) { click('#flow [data-act="flow:tip"][data-t="0"]'); await sleep(20); } click(payBtn()); await sleep(40); };
  await tapAgain();
  answer({ ok: false, canceled: true, code: 'CANCELED', message: 'The command was canceled.' }); await sleep(40);
  let cc = fnCalls(A, 'pay_tap_cancel');
  ok(cc.length === 1 && cc[0].body.pi === 'pi_7' && cc[0].body.jobId === 'j2' && $('#flowErr').textContent === 'Canceled. Nothing was charged.' && !payBtn().disabled,
    'canceled on Stripe\'s screen: called off on the server at once, and the screen says nothing was charged');
  await tapAgain();
  answer({ ok: false, code: 'DECLINED_BY_STRIPE_API', message: 'Your card was declined.' }); await sleep(40);
  ok($('#flowErr').textContent === 'The card was declined. Try another card or way to pay.' && fnCalls(A, 'pay_tap_cancel').length === 2, 'declined: said plainly, and called off');
  ok(T.tapWhy({ code: 'TAP_TO_PAY_NFC_DISABLED' }) === 'Turn on NFC in the phone’s settings, then try again.' &&
    /Developer options are on/.test(T.tapWhy({ code: 'TAP_TO_PAY_DEBUG_NOT_SUPPORTED' })) && /needs the phone’s location/.test(T.tapWhy({ code: 'LOCATION_PERMISSION' })) &&
    /needs the phone’s location/.test(T.tapWhy({ code: 'LOCATION_SERVICES_DISABLED' })) &&
    T.tapWhy({ code: 'TAP_TO_PAY_UNSUPPORTED_DEVICE', message: 'Unsupported device.' }) === 'This phone can’t take tap to pay: Unsupported device. Send a pay link instead.' &&
    /screen recording, an overlay or an accessibility app/.test(T.tapWhy({ code: 'TAP_TO_PAY_INSECURE_ENVIRONMENT' })) &&
    T.tapWhy({ code: 'STRIPE_API_CONNECTION_ERROR', message: 'Could not reach Stripe.' }) === 'Could not reach Stripe.' && T.tapWhy({}) === 'The card was not charged.',
    'what the phone\'s reader says, in words for the person holding it');
  ctl.tap = { ok: false, message: 'Tap to pay needs the shop\'s address first, written as street, city, state and ZIP (Setup › Company): Stripe keeps where cards are taken.' };
  const pays = log.filter((x) => x[0] === 'pay').length;
  await tapAgain();
  ok(/needs the shop's address first/.test($('#flowErr').textContent) && log.filter((x) => x[0] === 'pay').length === pays && !payBtn().disabled, 'the server says no: its words, and the phone\'s reader isn\'t asked');
  ctl.tap = null;

  /* ---------------- the reader signing in ---------------- */
  ok(A.w.__tallyTapToken('k1') === true, 'the reader asks the page for a connection token');
  await sleep(30);
  let tk = log.filter((x) => x[0] === 'token');
  ok(fnCalls(A, 'pay_tap_token').length === 1 && tk.length === 1 && tk[0][1] === 'k1' && tk[0][2] === 'pst_test_1' && tk[0][3] === '', 'the page gets one from the server and hands it to the reader');
  ctl.token = { ok: false, message: 'Tap to pay is off in Options.' };
  A.w.__tallyTapToken('k2'); await sleep(30);
  tk = log.filter((x) => x[0] === 'token');
  ok(tk.length === 2 && tk[1][1] === 'k2' && tk[1][2] === '' && tk[1][3] === 'Tap to pay is off in Options.', 'no token: the reader is told why');
  ctl.token = null;

  /* ---------------- when it isn't offered ---------------- */
  const S = T.state().settings;
  S.opt.payTap = false; T.render(); await sleep(30);
  ok(!/tap/.test(ways()) && on().m === 'link', 'Options › Tap to pay off: not offered (' + ways() + ')');
  S.opt.payTap = true; T.render(); await sleep(30);
  ok(/^tap,/.test(ways()), 'back on: offered again');
  ok(A.errors.length === 0, 'no errors (' + A.errors.slice(0, 3).join(' | ') + ')');

  // a card kept on file for this job is still picked first; live mode says how to tap
  const ctl2 = { cfg: { ok: true, ready: true, test: false, publishableKey: 'pk_live_1', reason: '' } }, log2 = [];
  A = await load(FILE, { db: seed({ card: true, live: true }), org: ORG, me: { uid: 'u-marcus', email: 'm@x.com' }, fnReply: replies(ctl2), setup: phone(log2) });
  ({ $, $$, click, T } = A);
  click('.crewcard [data-act="flow:open"][data-id="j2"]'); await sleep(60);
  if (!$('#flow')) { await openPay(); }
  ok(ways() === 'vault,tap,link,card,other' && on().m === 'vault', 'Marcus, with Lena\'s card on file for this job: the card on file first, then Tap to pay (' + ways() + ')');
  click('#flow [data-act="flow:method"][data-m="tap"]'); await sleep(30);
  ok(/When it asks, Lena Wu holds their card or phone flat against the back of this phone\./.test(flowText()) && !/test mode/i.test(flowText()), 'live: it says how the customer taps');
  click('#flow [data-act="flow:tip"][data-t="0"]'); await sleep(20);
  click(payBtn()); await sleep(40);
  ok(log2.filter((x) => x[0] === 'pay').slice(-1)[0][2].live === true, 'and the phone\'s reader is a real one');
  ok(A.errors.length === 0, 'no errors (' + A.errors.slice(0, 3).join(' | ') + ')');

  // a phone that can't (Android 12, or no NFC), a computer, a company on Square, the claude.ai copy: no tap
  A = await load(FILE, { db: seed(), org: ORG, me: { uid: 'u-owner', email: 'o@x.com' }, fnReply: replies({}), setup: phone([], false) });
  ({ $, $$, click, T } = A);
  await openPay();
  ok(T.tapCan() === false && ways() === 'link,card,other', 'a phone that can\'t take a tap: not offered (' + ways() + ')');
  A = await load(FILE, { db: seed(), org: ORG, me: { uid: 'u-owner', email: 'o@x.com' }, fnReply: replies({}) });
  ({ $, $$, click, T } = A);
  await openPay();
  ok(T.tapCan() === false && ways() === 'link,card,other', 'on a computer (no MoveCrew Android app): not offered');
  A = await load(FILE, { db: seed(), org: ORG, me: { uid: 'u-owner', email: 'o@x.com' }, setup: phone([]),
    fnReply: replies({ cfg: { ok: true, ready: true, test: true, provider: 'square', square: { appId: 'sandbox-sq0idb-1', conn: { locationId: 'L1' } }, reason: '' } }) });
  ({ $, $$, click, T } = A);
  await openPay();
  ok(T.tapCan() === true && !/tap/.test(ways()), 'a company whose cards go through Square: not offered (' + ways() + ')');
  A = await load(ART, { setup: phone([]) });
  ok(A.T.tapOn() === false, 'the claude.ai copy: never');
  process.exit(summary('tap') ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

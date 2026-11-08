// Square in the app (Nov 1). Richie: "For payment processing i would also like to add remedy and square card . There
// should be a place where the company can link what they use then the app will auto use their connection for the
// payment". Setup › Payments: Connect with Square (Square's sign-in page, outside MoveCrew), what's connected, Use Stripe
// instead / Use Square for cards, Disconnect. Then the payment screen uses Square by itself: Square's card box (its
// token charged by the server), cards kept with Square, pay links that can't keep a card. The Edge Function and
// Square's Web Payments SDK are fakes that record what they were asked.
const { load, ok, sleep, summary, clone } = require('./lib');
const FILE = __dirname + '/../../build/tally-supabase.html';
const ORG = 'org-1';
const AUTH = 'https://connect.squareupsandbox.com/oauth2/authorize?client_id=sandbox-sq0idb-App&scope=PAYMENTS_WRITE+PAYMENTS_READ&state=abc.def';
const day = (n) => { const d = new Date(Date.now() + n * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

function jobDoc(id, over = {}) {
  return Object.assign({ id, status: 'done', createdAt: Date.now() - 864e5, finishedAt: Date.now() - 6e5, startedAt: Date.now() - 4e6,
    d: { name: 'Lena Wu', phone: '503-555-0177', email: 'lena@example.com', source: 'Google', moveDate: day(0), time: '08:00', from: '418 Oak St', to: '77 Ridge Rd', miles: '', flights: '', pack: false, crew: '', truckId: '', hoursOverride: '', discount: '', notes: '', custom: {}, items: [] },
    quote: { total: 1000, cf: 500, crew: 3, hours: 4, lines: [{ label: 'Movers', amt: 1000 }], deposit: 250, nte: 1150, lbs: 3500, truckId: 't26', truckName: 'Box 1', nTrucks: 1, pct: 0.3, count: 10 },
    items: [], assign: { truckId: 't26', crew: ['Marcus', 'Dee'] }, tally: {}, payments: {}, signed: {}, extras: {}, crewNotes: {}, photos: {}, materials: {}, costs: {}, log: {} }, over);
}
function seed() {
  const docs = [];
  const put = (path, data) => { const [collection, doc_id] = path.split('/'); docs.push({ org_id: ORG, path, collection, doc_id, data, updated_at: new Date().toISOString() }); };
  put('meta/init', { ts: 1, mode: 'fresh' });
  put('org/settings', { company: 'Ace Moving', crew: ['Marcus', 'Dee'], leads: ['Marcus'], office: [{ name: 'Ana', kind: 'owner' }], contacts: { Ana: '503-555-0100' }, trucks: [{ id: 't26', name: 'Box 1', cf: 1700 }] });
  put('jobs/j2', jobDoc('j2'));
  // cards kept on file: one with Square (this job), one with Stripe from before
  put('vault/sq_aaa', { id: 'sq_aaa', type: 'card', brand: 'Visa', last4: '1111', exp: '11/30', name: 'Lena Wu', cust: '5035550177', jobs: ['j2'], via: 'square', live: false, ts: 1 });
  put('vault/st_bbb', { id: 'st_bbb', type: 'card', brand: 'Mastercard', last4: '4444', exp: '01/29', name: 'Lena Wu', cust: '5035550177', jobs: ['j2'], via: 'stripe', live: false, ts: 1 });
  return {
    docs, access_requests: [], comm_log: [],
    members: [{ org_id: ORG, user_id: 'u-ana', email: 'ana@x.com', staff: 'Ana', role: 'owner', ts: 1 }, { org_id: ORG, user_id: 'u-marcus', email: 'm@x.com', staff: 'Marcus', role: 'lead', ts: 1 }],
    comm_lines: [{ org_id: ORG, phone_number: '+15035550000', enabled: true }],
  };
}
// what the server says, step by step
const STRIPE_READY = { ok: true, ready: true, test: true, publishableKey: 'pk_test_x', account: '', via: 'platform', reason: '', provider: 'stripe' };
const SQ = (conn, extra = {}) => Object.assign({ mode: 'test', table: true, appId: 'sandbox-sq0idb-App', hooks: true }, conn === undefined ? {} : { conn }, extra);
const READY = { state: 'ready', active: true, business: 'Ace Moving LLC', location: 'Ace Moving (Portland)', locationId: 'L1main' };
const CFG = {
  offer: Object.assign({}, STRIPE_READY, { square: SQ() }),
  noTable: Object.assign({}, STRIPE_READY, { square: { mode: 'test', table: false } }),
  square: { ok: true, ready: true, provider: 'square', test: true, publishableKey: '', account: '', via: 'square', reason: '', square: SQ(READY) },
  paused: Object.assign({}, STRIPE_READY, { square: SQ(Object.assign({}, READY, { active: false })) }),
  noLoc: Object.assign({}, STRIPE_READY, { square: SQ({ state: 'no-location', active: true, business: 'Ace Moving LLC', location: '', locationId: '' }) }),
  revoked: Object.assign({}, STRIPE_READY, { square: SQ({ state: 'revoked', active: false, business: 'Ace Moving LLC', location: '', locationId: '' }) }),
};
function fnReplies(ctl) {
  return (b) => {
    if (b.action === 'pay_config') return clone(ctl.cfg);
    if (b.action === 'pay_sq_connect') return ctl.connect ? clone(ctl.connect) : { ok: true, url: AUTH };
    if (b.action === 'pay_sq_use') return { ok: true, message: b.use === 'square' ? 'Card payments now go through Square.' : 'Card payments now go through Stripe.' };
    if (b.action === 'pay_sq_disconnect') return { ok: true, message: 'Square is disconnected. Payments already taken stay in your Square account.' };
    if (b.action === 'pay_intent') return ctl.intent ? clone(ctl.intent) : { ok: true, done: true, message: 'Card charged $' + Number(b.amount).toFixed(2) + '.' };
    if (b.action === 'pay_saved') return { ok: true, message: 'Charged $' + Number(b.amount).toFixed(2) + ' to Visa ••1111.' };
    if (b.action === 'pay_check') return { ok: true, owed: 1000, fixed: 0 };
    if (b.action === 'pay_link') return { ok: true, url: 'https://proj.supabase.co/functions/v1/tally-twilio/p/AbCdEfGh23', amount: b.amount };
    if (b.action === 'pay_forget') return { ok: true, message: 'Card removed. It can\'t be charged again.' };
    return { ok: true, sent: 0 };
  };
}
// window.open, and Square's Web Payments SDK
function browser(rec, opts = {}) {
  return (w) => {
    w.__tallyReload = () => {};
    w.open = (url, target) => {
      rec.opened.push([url, target]);
      if (opts.blocked) return null;
      const tab = { closed: false, opener: w, location: { href: url || 'about:blank' }, document: { title: '', body: { innerHTML: '' } }, close() { this.closed = true; rec.closedTabs++; } };
      rec.tabs.push(tab);
      return tab;
    };
    // Square's script is "loaded" by putting window.Square in place as the page adds the script tag
    const add = w.HTMLHeadElement.prototype.appendChild;
    w.HTMLHeadElement.prototype.appendChild = function (el) {
      if (el && el.tagName === 'SCRIPT' && /squarecdn\.com/.test(el.src || '')) {
        rec.sqScripts.push(el.src);
        setTimeout(() => {
          if (opts.noSquare) { if (el.onerror) el.onerror(new w.Event('error')); return; }
          w.Square = { payments(appId, loc) {
            rec.payments.push([appId, loc]);
            return { card(o) {
              if (opts.badStyle && o && o.style) return Promise.reject(Object.assign(new Error('Invalid styles'), { name: 'InvalidStylesError' }));
              rec.cards.push(o ? clone(o) : null);
              const card = { attach(sel) { const el2 = w.document.querySelector(sel); rec.attached.push(sel); if (el2) el2.innerHTML = '<div class="sq-card-wrapper">Square card box</div>'; return Promise.resolve(); },
                tokenize(vd) { rec.tokenize.push(clone(vd)); return Promise.resolve(rec.tokenResult ? clone(rec.tokenResult) : { status: 'OK', token: 'cnon:card-nonce-ok' }); },
                destroy() { rec.destroyed++; return Promise.resolve(true); } };
              return Promise.resolve(card);
            } };
          } };
          if (el.onload) el.onload(new w.Event('load'));
        }, 5);
        return el;
      }
      if (el && el.tagName === 'SCRIPT' && /stripe\.com/.test(el.src || '')) { rec.stripeScripts.push(el.src); return el; }
      return add.call(this, el);
    };
  };
}
const rec0 = () => ({ opened: [], tabs: [], closedTabs: 0, sqScripts: [], stripeScripts: [], payments: [], cards: [], attached: [], tokenize: [], destroyed: 0, tokenResult: null });
const fnCalls = (A, act) => A.calls.fn.filter((c) => c.body.action === act);
const say = (el) => (el ? el.textContent.replace(/\s+/g, ' ') : '');
const card = (A, title) => A.$$('#view section.card').find((s) => new RegExp('^' + title).test(say(s.querySelector('h2')).trim()));
async function setup(A) { await A.go('settings', 'pay'); await sleep(30); }
async function back(A) {   // the owner comes back to MoveCrew from Square's page
  Object.defineProperty(A.w.document, 'hidden', { value: true, configurable: true });
  A.w.document.dispatchEvent(new A.w.Event('visibilitychange'));
  await sleep(5);
  Object.defineProperty(A.w.document, 'hidden', { value: false, configurable: true });
  A.w.A_now = Date.now();
  A.w.document.dispatchEvent(new A.w.Event('visibilitychange'));
  await sleep(60);
}
async function openPay(A) { await A.go('jobs'); A.click('[data-act="job:open"][data-id="j2"]'); await sleep(40); const b = A.$$('#sheet [data-act="flow:open"]').find((x) => /Collect payment|Take a payment/.test(x.textContent)); A.click(b); await sleep(80); }
const flowText = (A) => say(A.$('#flow'));

(async () => {
  /* ===== Setup › Payments: Square offered, connected on Square's own page ===== */
  let ctl = { cfg: CFG.noTable }, rec = rec0();
  let A = await load(FILE, { db: seed(), org: ORG, me: { uid: 'u-ana', email: 'ana@x.com' }, fnReply: fnReplies(ctl), setup: browser(rec) });
  await setup(A);
  ok(/Square needs one step in the database first/.test(say(card(A, 'Square'))) && /supabase-square\.sql/.test(say(card(A, 'Square'))), 'before the database step: Setup says to run supabase-square.sql');
  ok(card(A, 'Stripe') && /Stripe is connected/.test(say(card(A, 'Stripe'))), 'Stripe keeps its own section, titled Stripe now that there are two');
  ctl.cfg = CFG.offer; A.click('[data-act="pay:reload"]'); await sleep(60);
  let sq = card(A, 'Square');
  ok(sq && /Already take cards with Square\? Connect your Square account/.test(say(sq)) && /MoveCrew takes no cut/.test(say(sq)) && /Square’s sandbox for now/.test(say(sq)), 'Square offered: what connecting it does, in the sandbox for now');
  const btn = sq.querySelector('[data-act="pay:sqconnect"]');
  ok(btn && /Connect with Square/.test(btn.textContent) && !btn.classList.contains('primary'), 'Connect with Square (not the main button while Stripe already takes cards)');
  A.click(btn);
  ok(/Opening Square/.test(say(card(A, 'Square'))) && rec.tabs.length === 1 && rec.tabs[0].document.title === 'Opening Square…', 'a tab opens on the tap, saying it is opening Square: ' + say(card(A, 'Square')).slice(0, 120) + ' | tabs ' + rec.tabs.length + ' ' + (rec.tabs[0] && rec.tabs[0].document.title));
  await sleep(60);
  ok(fnCalls(A, 'pay_sq_connect').length === 1 && rec.tabs[0].location.href === AUTH, 'the tab goes to Square’s sign-in page the server gave');
  ok(/Finished on Square’s page\? Come back here/.test(say(card(A, 'Square'))), 'Setup says to come back when done');
  ctl.cfg = CFG.square;
  const cfgCalls = fnCalls(A, 'pay_config').length;
  await back(A); await sleep(40);
  ok(fnCalls(A, 'pay_config').length > cfgCalls, 'coming back to MoveCrew asks the server again');
  sq = card(A, 'Square');
  ok(sq && /Card payments go through your Square account \(Square’s sandbox\)/.test(say(sq)) && /Ace Moving LLC · Ace Moving \(Portland\)/.test(say(sq)) && !/Finished on Square’s page/.test(say(sq)), 'connected: cards go through Square, at Ace Moving LLC’s Portland location: ' + say(sq).slice(0, 160));
  ok(A.$$('#view section.card')[0] === sq && /Not used while card payments go through Square/.test(say(card(A, 'Stripe'))), 'Square comes first, and Stripe says it isn’t used meanwhile');
  // switching to Stripe, and back
  A.click(sq.querySelector('[data-act="pay:squse"][data-use="stripe"]')); await sleep(40);
  ok(fnCalls(A, 'pay_sq_use').pop().body.use === 'stripe' && /Card payments now go through Stripe/.test(say(A.$('#toast'))), 'Use Stripe instead: asked of the server, and said');
  ctl.cfg = CFG.paused; A.click('[data-act="pay:reload"]'); await sleep(60);
  sq = card(A, 'Square');
  ok(/Square is connected \(Square’s sandbox\)/.test(say(sq)) && /Card payments go through Stripe until you switch/.test(say(sq)) && sq.querySelector('[data-act="pay:squse"][data-use="square"]'), 'Square stays connected, with Use Square for cards');
  A.click(sq.querySelector('[data-act="pay:squse"][data-use="square"]')); await sleep(40);
  ok(fnCalls(A, 'pay_sq_use').pop().body.use === 'square', 'Use Square for cards');
  // disconnecting takes two taps
  ctl.cfg = CFG.square; A.click('[data-act="pay:reload"]'); await sleep(60);
  A.click(card(A, 'Square').querySelector('[data-act="pay:sqoff"]')); await sleep(10);
  ok(/Tap again to disconnect/.test(say(card(A, 'Square'))) && /Payments already taken stay in your Square account/.test(say(card(A, 'Square'))) && !fnCalls(A, 'pay_sq_disconnect').length, 'Disconnect Square: the first tap asks again');
  A.click(card(A, 'Square').querySelector('[data-act="pay:sqoff"]')); await sleep(40);
  ok(fnCalls(A, 'pay_sq_disconnect').length === 1 && /Square is disconnected/.test(say(A.$('#toast'))), 'the second tap disconnects');
  ctl.cfg = CFG.revoked; A.click('[data-act="pay:reload"]'); await sleep(60);
  ok(/Square was disconnected \(Ace Moving LLC\)/.test(say(card(A, 'Square'))) && card(A, 'Square').querySelector('[data-act="pay:sqconnect"]').classList.contains('primary') === false, 'disconnected (or taken back in Square): Connect again');
  ctl.cfg = CFG.noLoc; A.click('[data-act="pay:reload"]'); await sleep(60);
  ok(/Your Square account can’t take card payments yet/.test(say(card(A, 'Square'))), 'a Square account that can’t take cards yet: says so');
  // a page that isn't Square's is never opened
  ctl.cfg = CFG.offer; ctl.connect = { ok: true, url: 'https://evil.example/oauth2/authorize' }; A.click('[data-act="pay:reload"]'); await sleep(60);
  A.click(card(A, 'Square').querySelector('[data-act="pay:sqconnect"]')); await sleep(60);
  ok(/Square did not give a page to open/.test(say(card(A, 'Square'))) && rec.tabs[rec.tabs.length - 1].closed, 'an address that isn’t Square’s is never opened, and the tab closes');
  ctl.connect = { ok: false, status: 403, message: 'Only the owner connects the company\'s Square account.' };
  A.click(card(A, 'Square').querySelector('[data-act="pay:sqconnect"]')); await sleep(60);
  ok(/Only the owner connects/.test(say(card(A, 'Square'))), 'the server’s no, in its own words');
  ok(A.errors.length === 0, 'no errors (' + A.errors.slice(0, 3).join(' | ') + ')');

  /* ===== the payment screen with Square ===== */
  ctl = { cfg: CFG.square }; rec = rec0();
  A = await load(FILE, { db: seed(), org: ORG, me: { uid: 'u-ana', email: 'ana@x.com' }, fnReply: fnReplies(ctl), setup: browser(rec) });
  await openPay(A);
  ok(/Square’s sandbox: no real money moves\. Test card 4111 1111 1111 1111/.test(flowText(A)) && !/Stripe test mode/.test(flowText(A)), 'the payment screen says Square’s sandbox, with Square’s test card');
  // cards on file: Square's only
  const vaultChip = A.$('#flow [data-act="flow:method"][data-m="vault"]');
  ok(vaultChip && A.$$('#flow input[name=vaultPick]').length === 1 && /Visa ending 1111/.test(flowText(A)) && !/Mastercard ending 4444/.test(flowText(A)), 'Card on file lists the card kept with Square, not the one kept with Stripe');
  ok(A.$('#flow [data-act="flow:pay"]').disabled && A.$$('#flow [data-act="flow:tip"]').length === 5, 'the bill after the move: the crew’s tip is asked first');
  A.click('#flow [data-act="flow:tip"][data-t="20"]'); await sleep(30);
  A.click('#flow [data-act="flow:pay"]'); await sleep(40);
  ok(fnCalls(A, 'pay_saved').length === 1 && fnCalls(A, 'pay_saved')[0].body.vaultId === 'sq_aaa' && fnCalls(A, 'pay_saved')[0].body.amount === 1000 && fnCalls(A, 'pay_saved')[0].body.tip === 200 && /Charged \$1,?000\.00 to Visa ••1111/.test(say(A.$('#toast'))), 'charging it: the server does it on Square, with the 20% tip apart from the bill');
  // the card box
  await sleep(1600);
  A.click('#flow [data-act="flow:method"][data-m="card"]'); await sleep(80);
  ok(rec.sqScripts.length === 1 && rec.sqScripts[0] === 'https://sandbox.web.squarecdn.com/v1/square.js' && !rec.stripeScripts.length, 'Square’s card box script, the sandbox’s, and not Stripe’s');
  ok(rec.payments[0] && rec.payments[0][0] === 'sandbox-sq0idb-App' && rec.payments[0][1] === 'L1main' && rec.attached[0] === '#stripeCard' && /Square card box/.test(flowText(A)), 'Square’s card box for the company’s app and location, in the payment screen');
  const st = rec.cards[0] && rec.cards[0].style;
  ok(st && st.input && /^#|^rgb/.test(st.input.color) && st['.input-container.is-focus'] && st['.input-container.is-focus'].borderColor, 'in the app’s colours (plain colours, as Square takes them)');
  ok(A.$('#flow #saveCard'), 'Keep this card on file is offered (kept with Square)');
  A.$('#flow #saveCard').checked = true;
  const amt = A.$('#flowAmt'); amt.value = '250.00'; amt.dispatchEvent(new A.w.Event('input', { bubbles: true })); await sleep(20);
  A.click('#flow [data-act="flow:pay"]'); await sleep(60);
  const vd = rec.tokenize[0], intent = fnCalls(A, 'pay_intent')[0];
  ok(vd && vd.amount === '250.00' && vd.currencyCode === 'USD' && vd.intent === 'CHARGE' && vd.sellerKeyedIn === true && vd.billingContact.givenName === 'Lena' && vd.billingContact.familyName === 'Wu' && vd.billingContact.email === 'lena@example.com',
    'Square’s card box makes a token for $250.00, typed in by the company, with the customer’s name and email: ' + JSON.stringify(vd));
  ok(intent && intent.body.token === 'cnon:card-nonce-ok' && intent.body.amount === 250 && intent.body.save === true && intent.body.jobId === 'j2', 'the token goes to the server, which charges it (and keeps the card)');
  ok(/Card charged \$250\.00/.test(say(A.$('#toast'))) && rec.destroyed >= 1, 'charged: said, and the card box is put away');
  // declined, and the bank wanting the customer to approve it
  await sleep(1600);
  A.click('#flow [data-act="flow:method"][data-m="card"]'); await sleep(80);
  ctl.intent = { ok: false, message: 'The card was declined: the bank said no.' };
  A.click('#flow [data-act="flow:pay"]'); await sleep(60);
  ok(/The card was declined: the bank said no\./.test(say(A.$('#flowErr'))), 'a declined card: the server’s words on the screen');
  rec.tokenResult = { status: 'Invalid', errors: [{ message: 'Card number is not valid' }] };
  const n0 = fnCalls(A, 'pay_intent').length;
  A.click('#flow [data-act="flow:pay"]'); await sleep(60);
  ok(/Card number is not valid/.test(say(A.$('#flowErr'))) && fnCalls(A, 'pay_intent').length === n0, 'a card Square’s box doesn’t accept: its words, and nothing sent');
  rec.tokenResult = null;
  ctl.intent = { ok: false, needLink: true, message: 'The customer\'s bank wants them to approve this one. Send them a pay link instead.' };
  A.click('#flow [data-act="flow:pay"]'); await sleep(80);
  ok(A.$('#flow [data-act="flow:method"][data-m="link"]').classList.contains('on') && /approve this one/.test(say(A.$('#flowErr'))), 'the bank wants an approval: over to a pay link, saying why');
  // a pay link on Square can't keep a card
  ok(!A.$('#flow #saveLink') && /Show a QR code/.test(flowText(A)), 'a pay link on Square: no Keep the card on file (Square’s pages don’t)');
  ok(A.errors.length === 0, 'no errors (' + A.errors.slice(0, 3).join(' | ') + ')');

  /* ===== Square's card box doesn't load ===== */
  ctl = { cfg: CFG.square }; rec = rec0();
  A = await load(FILE, { db: seed(), org: ORG, me: { uid: 'u-ana', email: 'ana@x.com' }, fnReply: fnReplies(ctl), setup: browser(rec, { noSquare: true }) });
  await openPay(A);
  A.click('#flow [data-act="flow:method"][data-m="card"]'); await sleep(80);
  ok(/The card form did not load\. Check the connection, or send a pay link\./.test(flowText(A)), 'Square’s script can’t load: say so, point to a pay link');
  A.click('#flow [data-act="flow:tip"][data-t="0"]'); await sleep(30);
  A.click('#flow [data-act="flow:pay"]'); await sleep(30);
  ok(/still loading/.test(say(A.$('#flowErr'))) && !fnCalls(A, 'pay_intent').length, 'and nothing is charged');
  ctl = { cfg: CFG.square }; rec = rec0();
  A = await load(FILE, { db: seed(), org: ORG, me: { uid: 'u-ana', email: 'ana@x.com' }, fnReply: fnReplies(ctl), setup: browser(rec, { badStyle: true }) });
  await openPay(A);
  A.click('#flow [data-act="flow:method"][data-m="card"]'); await sleep(80);
  ok(rec.cards.length === 1 && rec.cards[0] === null && /Square card box/.test(flowText(A)), 'a look Square won’t take: its own look instead, still there');

  /* ===== cards kept on file, in Setup ===== */
  await A.go('settings', 'vault'); await sleep(30);
  const v = say(A.$('#view'));
  ok(/Visa ending 1111 · Lena Wu · Square sandbox/.test(v) && /Mastercard ending 4444 · Lena Wu · Stripe test/.test(v), 'Setup’s cards on file say which keeps each: Square or Stripe');
  const rm = A.$$('#view [data-act="st:rmvault"]').find((b) => b.dataset.id === 'sq_aaa');
  A.click(rm); await sleep(10); if (A.$$('#view [data-act="st:rmvault"]').find((b) => b.dataset.id === 'sq_aaa')) { A.click(A.$$('#view [data-act="st:rmvault"]').find((b) => b.dataset.id === 'sq_aaa')); }
  await sleep(40);
  ok(fnCalls(A, 'pay_forget').some((c) => c.body.vaultId === 'sq_aaa'), 'removing the Square card asks the server (which disables it at Square)');

  /* ===== a Stripe company: nothing changes ===== */
  ctl = { cfg: STRIPE_READY }; rec = rec0();
  A = await load(FILE, { db: seed(), org: ORG, me: { uid: 'u-ana', email: 'ana@x.com' }, fnReply: fnReplies(ctl), setup: browser(rec) });
  await setup(A);
  ok(!card(A, 'Square') && card(A, 'Payments'), 'Square not set up on MoveCrew: Setup › Payments is as before');
  await openPay(A);
  ok(/Stripe test mode/.test(flowText(A)) && A.$$('#flow input[name=vaultPick]').length === 1 && /Mastercard ending 4444/.test(flowText(A)), 'a company on Stripe: Stripe’s words, Stripe’s card on file only');

  process.exit(summary('square') ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

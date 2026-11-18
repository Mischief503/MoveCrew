// Sales, batch 3 (Richie, Nov 14, the call center and sales side to 80%): leads that come in by themselves. The website's
// Get a quote form (Setup shows it and, in the claude.ai copy, makes a lead from it; the website's own page is
// ?quote=<company>, before anyone signs in), a missed call on the Sales board and Today, a new lead announced as it
// comes in, and a call ringing on the office's screen (the hosted app, with a company line).
const { load, ok, sleep, summary } = require('./lib');
const file = process.argv[2] || __dirname + '/../../build/tally-artifact.html', label = process.argv[3] || 'leads';
const HOSTED = __dirname + '/../../build/tally-supabase.html';
const L = (m) => label + ': ' + m;
const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

(async () => {
  const A = await load(file, {});
  const { w, $, $$, click, T } = A;
  const st = () => T.state();
  const card = (j) => $('#ccList .scard[data-job="' + j.id + '"]');
  const line = (j) => txt(card(j) && card(j).querySelector('.snext'));
  const toastTxt = () => $('#toast').textContent;
  const evs = (j) => j.log.map((l) => l.ev);
  const set = (id, v) => { const x = $('#' + id); x.value = v; x.dispatchEvent(new w.Event('input', { bubbles: true })); };
  const send = async () => { $('#wqForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await sleep(20); };
  const n0 = st().jobs.length;

  /* ---------- Setup › Get a quote form ---------- */
  await A.go('settings', 'webform');
  ok(/^Get a quote form/.test(txt($('#view section.card h2'))) && /https:\/\/mischief503\.github\.io\/MoveCrew\/\?quote=your-company/.test(txt($('#wqLink'))) && /Sign in on the MoveCrew website to see your own\./.test(txt($('#view'))),
    L('Setup › Get a quote form: the link, and that the claude.ai copy has no company of its own'));
  click('[data-act="wq:try"]'); await sleep(15);
  ok(!!$('#view .wqframe #wqForm') && txt($('#view .wqframe h1')) === 'Your Moving Co.' && $$('#view .wqframe label').length === 9 && $$('#wqSize option').length === 7,
    L('Try the form: the customer’s form, with the company’s name, eight things to fill in and the hidden box'));
  await send();
  ok(txt($('#wqMsg')) === 'Put in your name.' && st().jobs.length === n0, L('sent empty: put in your name'));
  set('wqName', 'Nora Quinn'); set('wqPhone', '512-555-01'); await send();
  ok(/phone number we can call you at/.test(txt($('#wqMsg'))), L('a short phone number: no'));
  set('wqPhone', '(512) 555-0150'); set('wqEmail', 'lena@'); await send();
  ok(/email doesn’t look right/.test(txt($('#wqMsg'))), L('an email that isn’t one: no'));
  set('wqEmail', 'lena@example.com'); await send();
  ok(/moving from/.test(txt($('#wqMsg'))), L('no pickup: no'));
  const day = new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10);
  set('wqFrom', '12 Elm St, Austin'); set('wqTo', 'Round Rock'); set('wqDate', day); set('wqSize', 'b2'); set('wqNote', 'A piano'); await send();
  const W = st().jobs.find((j) => j.d.name === 'Nora Quinn');
  ok(!!W && W.status === 'lead' && W.d.source === 'Website' && W.d.phone === '(512) 555-0150' && W.d.email === 'lena@example.com' && W.d.from === '12 Elm St, Austin' && W.d.to === 'Round Rock' && W.d.moveDate === day && W.d.notes === 'Home: 2 bedrooms\nFrom the website: A piano',
    L('sent: a new lead here, from the website, with what was typed'));
  ok(T.salesStage(W) === 'new' && evs(W).includes('Asked for a quote on the website (tried in Setup)') && /^Thanks, Nora\./.test(txt($('#view .wqframe h1'))) && /in Sales/.test(toastTxt()),
    L('it’s New in Sales, its activity says where it came from, and the form says thanks'));
  click('[data-act="wq:sales"]'); await sleep(20);
  ok(T.ui.tab === 'quotes' && !!card(W) && /^New · waiting \d+ min · not called yet$/.test(line(W)) && /Website/.test(txt(card(W))), L('See it in Sales: there, New, from the Website'));

  /* ---------- a missed call ---------- */
  const M = JSON.parse(JSON.stringify(W));
  M.id = 'mcall1'; M.d.name = ''; M.d.phone = '(512) 555-0177'; M.d.source = 'Missed call'; M.d.email = ''; M.d.notes = ''; M.createdAt = Date.now() - 4 * 6e4; M.sales = { missed: { at: Date.now() - 4 * 6e4 } }; M.log = [];
  st().jobs.push(M); T.render(); await sleep(15);
  ok(txt(card(M).querySelector('h3')) === '(512) 555-0177' && line(M) === 'Missed their call 4 min ago · call them back' && !!card(M).querySelector('.snext .pill.bad') && $$('#ccList .scard')[0] === card(M),
    L('a missed call: by its number, in red, at the top: ' + line(M)));
  ok(txt($('#tabs [data-tab="quotes"] .badge')) === '3', L('the badge counts it (with the two new leads)'));
  click('[data-act="tab"][data-tab="today"]'); await sleep(20);
  const mm = $('[data-act="today:alerts"]'); if (mm && mm.getAttribute('aria-expanded') === 'false') { click(mm); await sleep(10); }
  const rows = $$('#view .alert').map(txt);
  ok(rows.includes('!1 missed call to call back(512) 555-0177 · Sales›') && rows.some((r) => /^!2 new leads not called yet/.test(r) && r.indexOf('555-0177') < 0),
    L('Today: “1 missed call to call back”, and it isn’t counted again with the new leads: ' + rows.filter((r) => /call|lead/.test(r)).join(' | ')));
  click('#tabs [data-act="tab"][data-tab="quotes"]'); await sleep(15);
  click('#ccList [data-act="sl:p"][data-m="log"][data-id="mcall1"]'); await sleep(15);
  click('#ccList [data-act="sl:log"][data-k="talked"][data-id="mcall1"]'); await sleep(15);
  ok(!/Missed their call/.test(line(M)) && T.salesMissed(M) === null, L('a call logged answers it'));

  /* ---------- a new lead announced as it comes in ---------- */
  T.leadNotice();
  const N = JSON.parse(JSON.stringify(W)); N.id = 'web2'; N.d.name = 'Omar Ali'; N.createdAt = Date.now() - 6e4; N.log = [];
  st().jobs.push(N); T.leadNotice();
  ok(toastTxt() === 'New lead from your website: Omar Ali. It’s in Sales.', L('a website lead coming in: a pop-up message'));
  ok(A.errors.length === 0, L('no errors (' + A.errors.slice(0, 3).join(' | ') + ')'));

  /* ---------- the website's page: ?quote=<company> ---------- */
  const ORGU = '0a1b2c3d-1111-4222-8333-944455556666';
  const fn = [];
  const Q = await load(HOSTED, { hash: '?quote=' + ORGU, db: { docs: [], members: [], access_requests: [] }, me: null,
    fnReply: (b) => { fn.push(b); return b.probe ? { ok: true, company: 'Ace Moving - Austin' } : b.name === 'Busy' ? { ok: false, message: 'We’re getting a lot of requests right now. Please call us instead.' } : { ok: true, company: 'Ace Moving - Austin' }; } });
  await sleep(200);
  const qf = Q.$('#login #wqForm');
  ok(!!qf && Q.w.document.documentElement.classList.contains('pre-auth') && Q.$('#login').classList.contains('wqpage') && !Q.$('#login input[type="email"]#lgEmail'),
    L('the website’s ?quote= page: the form, with nobody signed in, and no sign-in'));
  ok(fn.length === 1 && fn[0].probe === true && fn[0].org === ORGU && txt(Q.$('#wqCo')) === 'Ace Moving - Austin', L('it asks whose form it is, and shows the company'));
  const qset = (id, v) => { Q.$('#login #' + id).value = v; };
  Q.$('#login #wqForm').dispatchEvent(new Q.w.Event('submit', { bubbles: true, cancelable: true })); await sleep(20);
  ok(txt(Q.$('#login #wqMsg')) === 'Put in your name.' && fn.length === 1, L('sent empty: nothing goes'));
  qset('wqName', 'Busy'); qset('wqPhone', '512-555-0150'); qset('wqFrom', 'Austin');
  Q.$('#login #wqForm').dispatchEvent(new Q.w.Event('submit', { bubbles: true, cancelable: true })); await sleep(30);
  ok(/a lot of requests right now/.test(txt(Q.$('#login #wqMsg'))) && !!Q.$('#login #wqForm'), L('the server says no: its words, and the form stays'));
  qset('wqName', 'Lena Wu'); qset('wqSite', '');
  Q.$('#login #wqForm').dispatchEvent(new Q.w.Event('submit', { bubbles: true, cancelable: true })); await sleep(30);
  const sentB = fn[fn.length - 1];
  ok(sentB.org === ORGU && sentB.name === 'Lena Wu' && sentB.phone === '512-555-0150' && sentB.from === 'Austin' && sentB.hp === '' && sentB.ms > 0 && !sentB.probe, L('sent: to the server, with the company and the time it took'));
  ok(/^Thanks, Lena\./.test(txt(Q.$('#login h1'))) && /Ace Moving - Austin has your move and will call you soon at \(512\) 555-0150\./.test(txt(Q.$('#login'))), L('and it says thanks, and when they’ll hear back'));
  ok(Q.errors.length === 0, L('the page: no errors (' + Q.errors.slice(0, 3).join(' | ') + ')'));

  /* ---------- hosted: a call ringing, on the office's screen ---------- */
  const ORG = 'org-1';
  const row = (path, data) => { const [collection, doc_id] = path.split('/'); return { org_id: ORG, path, collection, doc_id, data, updated_at: new Date().toISOString() }; };
  const later = new Date(Date.now() + 6 * 864e5).toISOString().slice(0, 10);
  const db = { docs: [row('meta/init', { ts: 1 }),
    row('org/settings', { company: 'Ace Moving', crew: ['Marcus'], leads: ['Marcus'], office: [{ name: 'Owner', kind: 'owner' }, { name: 'Dispatch', kind: 'dispatch' }], contacts: {}, trucks: [{ id: 't26', name: 'Box 1 (26 ft)', cf: 1700 }], forms: [] }),
    row('jobs/q1', { id: 'q1', status: 'quoted', createdAt: Date.now() - 864e5, d: { name: 'Sam Kowalski', phone: '512-555-0120', moveDate: later, time: '09:00', from: 'Austin', to: 'Waco', items: [], custom: {} },
      quote: { total: 1065, cf: 400, crew: 3, hours: 5, lines: [] }, items: [], assign: { truckId: '', crew: [] }, tally: {}, payments: {}, signed: {}, extras: {}, crewNotes: {}, photos: {}, materials: {}, costs: {}, log: {}, confirm: {},
      sales: { owner: 'Dispatch', n: 1, first: Date.now() - 864e5, last: { k: 'talked', at: Date.now() - 864e5, by: 'Dispatch' } } })],
    access_requests: [], comm_lines: [{ org_id: ORG, phone_number: '+15125550000', enabled: true }],
    comm_log: [{ id: 7, org_id: ORG, job_id: 'q1', channel: 'call', direction: 'in', purpose: 'callback', staff: null, party: 'Sam Kowalski', from_number: '+15125550120', status: 'ringing', created_at: new Date(Date.now() - 5e3).toISOString() }],
    members: [{ org_id: ORG, user_id: 'u-dispatch', email: 'd@x', staff: 'Dispatch', role: 'dispatch', ts: 1 }] };
  const D = await load(HOSTED, { db, org: ORG, me: { uid: 'u-dispatch', email: 'd@x' } });
  await sleep(300);
  D.T.ringPoll(); await sleep(40);
  const bar = () => D.$('#ringBar');
  ok(!!bar() && !bar().hidden, L('a call ringing: at the top of the screen: ' + txt(bar())));
  const parts = () => Array.from(bar().querySelectorAll('.grow small, .grow b')).map(txt);
  ok(parts()[0] === 'Calling the company line' && parts()[1] === 'Sam Kowalski' && /^Quoted · \$1,065 · \w{3}, \w{3} \d{1,2}$/.test(parts()[2]) && !!bar().querySelector('[data-act="sl:show"][data-id="q1"]'),
    L('a quote’s customer: its stage, price and day, and Open in Sales: ' + parts().join(' | ')));
  D.click('#ringBar [data-act="sl:show"]'); await sleep(30);
  ok(D.T.ui.tab === 'quotes' && D.T.ui.ccq === 'Sam Kowalski', L('Open in Sales: their card'));
  db.comm_log[0].status = 'answered'; D.T.ringPoll(); await sleep(40);
  ok(bar().hidden, L('answered: it goes'));
  db.comm_log.push({ id: 8, org_id: ORG, job_id: null, channel: 'call', direction: 'in', purpose: 'callback', staff: null, party: 'an unknown caller', from_number: '+15125550177', status: 'ringing', created_at: new Date().toISOString() });
  D.T.ringPoll(); await sleep(40);
  ok(parts()[1] === '(512) 555-0177' && parts()[2] === 'Not in MoveCrew yet' && !!bar().querySelector('[data-act="ring:quote"]') && !bar().hidden, L('someone new: their number, and New quote: ' + parts().join(' | ')));
  D.click('#ringBar [data-act="ring:quote"]'); await sleep(30);
  ok(bar().hidden && D.T.ui.tab === 'quote' && D.T.state().draft.phone === '(512) 555-0177', L('New quote: the quote builder with their number'));
  D.T.ringPoll(); await sleep(40);
  ok(bar().hidden, L('and it doesn’t come back for that call'));
  ok(D.errors.length === 0, L('hosted: no errors (' + D.errors.slice(0, 3).join(' | ') + ')'));

  process.exit(summary(label) ? 1 : 0);
})().catch((e) => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });

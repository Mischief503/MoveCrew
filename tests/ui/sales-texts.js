// Sales, batch 2 (Richie, Nov 14, the call center and sales side to 80%): text the quote, the texts with a customer,
// a text back, follow-ups and the wording. The claude.ai copy (no company line: the quote goes from your own phone's
// texting app, and counts) and the hosted app with a company line (Text the quote and Send go to the server; the
// conversation shows on the lead).
const { load, ok, sleep, summary } = require('./lib');
const file = process.argv[2] || __dirname + '/../../build/tally-artifact.html', label = process.argv[3] || 'sales-texts';
const HOSTED = __dirname + '/../../build/tally-supabase.html';
const L = (m) => label + ': ' + m;
const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

(async () => {
  const A = await load(file, {});
  const { w, $, $$, click, T } = A;
  const st = () => T.state();
  const byName = (n) => st().jobs.find((j) => j.d.name === n);
  const card = (j) => $('#ccList .scard[data-job="' + j.id + '"]');
  const line = (j) => txt(card(j) && card(j).querySelector('.snext'));
  const toastTxt = () => $('#toast').textContent;
  const evs = (j) => j.log.map((l) => l.ev);
  const tap = async (sel, ms) => { click(sel); await sleep(ms || 15); };
  const O = byName('Ortega family'), S = byName('Sam Kowalski');
  O.d.email = 'ortega.family@example.com';
  click('#tabs [data-act="tab"][data-tab="quotes"]'); await sleep(15);

  /* ---------- the quote, from your own phone (no company line here) ---------- */
  ok(!!card(O).querySelector('[data-act="sl:p"][data-m="tx"]') && txt(card(O).querySelector('[data-act="sl:p"][data-m="tx"]')) === 'Text', L('each card with a phone has Text'));
  await tap('#ccList [data-act="sl:p"][data-m="tx"][data-id="' + O.id + '"]');
  const qt = txt(card(O).querySelector('.sqtxt'));
  const dd = new Date(O.d.moveDate + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  ok(qt.indexOf('Your Moving Co.: Hi there, your moving quote is $1,065 for ' + dd + ' at 9:00') === 0 && /movers, about [\d.]+ hours\)\. See it and book online: https:\/\/\S+ \(sign in with ortega\.family@example\.com\)\. Reply here with any questions\.$/.test(qt),
    L('the quote as they’ll get it: “' + qt + '”'));
  const a = card(O).querySelector('[data-act="sl:qsms"]');
  ok(a && a.getAttribute('href').indexOf('sms:5125550189?&body=') === 0 && decodeURIComponent(a.getAttribute('href').split('body=')[1]) === qt && txt(a) === 'Text the quote from my phone', L('Text the quote from my phone: the texting app, with it written'));
  ok(/In the phone app, texts go from the company line and their answers show here\./.test(txt(card(O).querySelector('.spanel'))), L('it says the phone app texts from the company line'));
  const n0 = O.sales.n;
  click(a); await sleep(30);
  ok(O.sales.n === n0 + 1 && O.sales.last.k === 'qsent' && O.sales.qs.n === 1 && evs(O).slice(-1)[0] === 'Quote texted by Owner' && /Your texting app opens with the quote/.test(toastTxt()) && /^When should you call back\?/.test(txt(card(O).querySelector('.spanel'))),
    L('tapped: counted as Texted the quote, then when to call back'));
  ok(/^Last: texted the quote, today /.test(line(O)) || /^Call back /.test(line(O)), L('its line: ' + line(O)));
  await tap('#ccList [data-act="sl:p"][data-m="tx"][data-id="' + S.id + '"]');
  ok(/Price it first \(Open quote\), then you can text them the quote\./.test(txt(card(S).querySelector('.spanel'))) && !card(S).querySelector('[data-act="sl:qsms"]'), L('a lead with no price: price it first'));

  /* ---------- the wording: Setup › Sales texts ---------- */
  await A.go('settings', 'salestexts');
  const ta = $('textarea[data-s="salesTpl.quote"]');
  ok(!!ta && $$('textarea[data-s^="salesTpl."]').length === 4 && /\{first\} \{company\} \{total\} \{when\} \{movers\} \{hours\} \{phone\}/.test(txt($('#view'))), L('Setup › Sales texts: the quote and three follow-ups, with what fills in'));
  ta.value = '{company}: {first}, it’s {total} for {when}.'; ta.dispatchEvent(new w.Event('input', { bubbles: true })); await sleep(10);
  ok(st().settings.salesTpl.quote === '{company}: {first}, it’s {total} for {when}.', L('typed: saved as the company’s own'));
  click('#tabs [data-act="tab"][data-tab="quotes"]'); await sleep(15);
  await tap('#ccList [data-act="sl:p"][data-m="tx"][data-id="' + O.id + '"]');
  ok(txt(card(O).querySelector('.sqtxt')) === 'Your Moving Co.: there, it’s $1,065 for ' + dd + ' at 9:00 AM.', L('the quote text follows it: ' + txt(card(O).querySelector('.sqtxt'))));
  st().settings.salesTpl.quote = '';
  ok(!!$$('#view').length && T.state().settings.opt.salesFollow === undefined, L('Options › Follow-up texts for quotes starts off'));

  /* ---------- follow-ups and a text back ---------- */
  O.sales.fu = { step: 1, at: Date.now() + 864e5, from: Date.now() - 864e5 }; O.sales.fus = 1; T.render(); await sleep(10);
  ok(/^Follow-up texts: 1 of 3 sent · the next one tomorrow eveningStop$/.test(txt(card(O).querySelector('.sfu'))), L('the card: ' + txt(card(O).querySelector('.sfu'))));
  await tap('#ccList [data-act="sl:fustop"][data-id="' + O.id + '"]');
  ok(O.sales.fu === null && evs(O).slice(-1)[0] === 'Follow-up texts stopped by Owner' && !card(O).querySelector('.sfu'), L('Stop: no more follow-ups'));
  // the quote went out 20 minutes ago, and they texted back 5 minutes ago (a text back older than the last call or text is answered)
  O.sales.last = Object.assign({}, O.sales.last, { at: Date.now() - 20 * 6e4 });
  O.sales.in = { at: Date.now() - 5 * 6e4, t: 'Is Saturday open instead?' }; T.render(); await sleep(10);
  ok(line(O) === 'Texted back 5 min ago: “Is Saturday open instead?”' && !!card(O).querySelector('.snext .pill.bad') && $$('#ccList .scard')[0] === card(O), L('a text back: in red, at the top: ' + line(O)));
  ok(txt($('#tabs [data-tab="quotes"] .badge')) === '2', L('the badge counts it (and the new lead)'));
  await tap('[data-act="tab"][data-tab="today"]');
  const m = $('[data-act="today:alerts"]'); if (m && m.getAttribute('aria-expanded') === 'false') { click(m); await sleep(10); }
  ok($$('#view .alert').map(txt).includes('!1 customer texted backOrtega family · answer them in Sales›'), L('Today: “1 customer texted back”'));
  click('#tabs [data-act="tab"][data-tab="quotes"]'); await sleep(15);
  await tap('#ccList [data-act="sl:p"][data-m="log"][data-id="' + O.id + '"]');
  await tap('#ccList [data-act="sl:log"][data-k="talked"][data-id="' + O.id + '"]');
  ok(!/Texted back/.test(line(O)) && txt($('#tabs [data-tab="quotes"] .badge')) === '1', L('a call logged answers it'));
  ok(A.errors.length === 0, L('no errors (' + A.errors.slice(0, 3).join(' | ') + ')'));

  /* ---------- hosted, with the company line ---------- */
  const ORG = 'org-1';
  const row = (path, data) => { const [collection, doc_id] = path.split('/'); return { org_id: ORG, path, collection, doc_id, data, updated_at: new Date().toISOString() }; };
  const later = new Date(Date.now() + 6 * 864e5).toISOString().slice(0, 10);
  const db = { docs: [row('meta/init', { ts: 1 }),
    row('org/settings', { company: 'Ace Moving', crew: ['Marcus'], leads: ['Marcus'], office: [{ name: 'Owner', kind: 'owner' }, { name: 'Dispatch', kind: 'dispatch' }], contacts: {}, trucks: [{ id: 't26', name: 'Box 1 (26 ft)', cf: 1700 }], forms: [] }),
    row('jobs/q1', { id: 'q1', status: 'quoted', createdAt: Date.now() - 864e5, d: { name: 'Sam Kowalski', phone: '512-555-0120', email: 'sam@example.com', moveDate: later, time: '09:00', from: 'Austin', to: 'Waco', items: [], custom: {} },
      quote: { total: 1065, cf: 400, crew: 3, hours: 5, lines: [] }, items: [], assign: { truckId: '', crew: [] }, tally: {}, payments: {}, signed: {}, extras: {}, crewNotes: {}, photos: {}, materials: {}, costs: {}, log: {}, confirm: {},
      sales: { owner: 'Dispatch', n: 1, first: Date.now() - 864e5, last: { k: 'qsent', at: Date.now() - 864e5, by: 'Dispatch' }, in: { at: Date.now() - 60e3, t: 'Can you do Saturday?' } } })],
    access_requests: [], comm_lines: [{ org_id: ORG, phone_number: '+15125550000', enabled: true }],
    comm_log: [
      { id: 1, org_id: ORG, job_id: 'q1', channel: 'sms', direction: 'out', purpose: 'quote', staff: 'Dispatch', party: 'Sam Kowalski', body: 'Ace Moving: Hi Sam, your moving quote is $1,065.', status: 'delivered', created_at: new Date(Date.now() - 864e5).toISOString() },
      { id: 2, org_id: ORG, job_id: 'q1', channel: 'sms', direction: 'in', purpose: 'customer-text', staff: null, party: 'Sam Kowalski', body: 'Can you do Saturday?', status: 'received', created_at: new Date(Date.now() - 60e3).toISOString() },
      { id: 3, org_id: ORG, job_id: 'q1', channel: 'sms', direction: 'out', purpose: 'forward', staff: 'Owner', party: 'Sam Kowalski', body: 'Ace Moving: Text to the company line from Sam…', status: 'delivered', created_at: new Date(Date.now() - 50e3).toISOString() }],
    members: [{ org_id: ORG, user_id: 'u-dispatch', email: 'd@x', staff: 'Dispatch', role: 'dispatch', ts: 1 }] };
  const fnCalls = [];
  const D = await load(HOSTED, { db, org: ORG, me: { uid: 'u-dispatch', email: 'd@x' }, fnReply: (b) => { fnCalls.push(b); return b.action === 'quote_text' ? { ok: true, message: 'Texted Sam Kowalski the quote.' } : b.action === 'sales_text' ? { ok: true, message: 'Texted Sam Kowalski.' } : { ok: true, sent: 0 }; } });
  await sleep(300);
  D.click('#tabs [data-act="tab"][data-tab="quotes"]'); await sleep(20);
  const dc = () => D.$('#ccList .scard[data-job="q1"]');
  ok(/^Texted back 1 min ago: “Can you do Saturday\?”$/.test(txt(dc().querySelector('.snext'))), L('hosted: the text back is on the lead'));
  D.click('#ccList [data-act="sl:p"][data-m="tx"][data-id="q1"]'); await sleep(400);
  const bub = D.$$('#ccList .scard[data-job="q1"] .smsg').map((b) => (b.classList.contains('me') ? 'out: ' : 'in: ') + txt(b.querySelector('div')));
  ok(bub.join(' | ') === 'out: Ace Moving: Hi Sam, your moving quote is $1,065. | in: Can you do Saturday?', L('hosted: the texts with Sam, oldest first, without the office’s own forwards: ' + bub.join(' | ')));
  D.click('#ccList [data-act="sl:qtext"][data-id="q1"]'); await sleep(50);
  ok(fnCalls.some((b) => b.action === 'quote_text' && b.jobId === 'q1' && /^https:\/\/tally\.example\.com\//.test(b.url)) && D.$('#toast').textContent === 'Texted Sam Kowalski the quote.', L('hosted: Text the quote goes to the server, with the app’s address'));
  const tb = D.$('#slTx_q1'); D.click('#ccList [data-act="sl:send"][data-id="q1"]'); await sleep(20);
  ok(/Write the text first\./.test(D.$('#toast').textContent) && !fnCalls.some((b) => b.action === 'sales_text'), L('hosted: Send with nothing written: write it first'));
  tb.value = 'Yes, Saturday works!'; D.click('#ccList [data-act="sl:send"][data-id="q1"]'); await sleep(50);
  ok(fnCalls.some((b) => b.action === 'sales_text' && b.jobId === 'q1' && b.body === 'Yes, Saturday works!') && D.$('#toast').textContent === 'Texted Sam Kowalski.' && D.$('#slTx_q1').value === '', L('hosted: Send texts the answer, and clears the box'));
  ok(D.errors.length === 0, L('hosted: no errors (' + D.errors.slice(0, 3).join(' | ') + ')'));

  process.exit(summary(label) ? 1 : 0);
})().catch((e) => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });

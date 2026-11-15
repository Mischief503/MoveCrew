// Sales, batch 1 (Richie, Nov 14: "We need to build the call center/sales side . We have maybe thought about this with
// a 20% we need to maximize this to at least 80%"). Never lose a lead: the Sales board for the office (in its bar, with
// a badge) and the call center; each lead's stage, who's working it, how long a new one has waited, a call logged in a
// tap, a call-back with its time (due, overdue), lost with a reason and reopened; Today's rows; the job sheet's line; a
// quote made in the quote builder counted as the first contact; the call center taking a lead; and, in the hosted app,
// the office's changes and the call center's going to the database as small patches.
const { load, ok, sleep, summary } = require('./lib');
const file = process.argv[2] || __dirname + '/../../build/tally-artifact.html', label = process.argv[3] || 'sales';
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
  const chips = () => $$('#view .sfil .chip').map(txt);
  const badge = () => txt($('#tabs [data-tab="quotes"] .badge'));
  const toastTxt = () => $('#toast').textContent;
  const evs = (j) => j.log.map((l) => l.ev);
  const go = async () => { click('#tabs [data-act="tab"][data-tab="quotes"]'); await sleep(15); };
  const tap = async (sel, ms) => { click(sel); await sleep(ms || 15); };
  const S = byName('Sam Kowalski'), O = byName('Ortega family');

  /* ---------- the bar, the badge and Today ---------- */
  ok($$('#tabs button').map(txt).join('|').replace(/\d/g, '') === 'Today|Jobs||Sales|Board|Chat|More', L('the office’s bar: Today, Jobs, +, Sales, Board, Chat, More'));
  ok(badge() === '1', L('Sales has a badge: 1 lead to call now (Sam Kowalski, new)'));
  const allRows = async () => { const m = $('[data-act="today:alerts"]'); if (m && m.getAttribute('aria-expanded') === 'false') { click(m); await sleep(10); } };   // Sales' rows come last in Needs you
  await allRows();
  const today = $$('#view .alert').map(txt);
  ok(today.some((a) => /^!1 new lead not called yetSam Kowalski · waiting 1[23] min›$/.test(a)), L('Today: “1 new lead not called yet”, who and how long: ' + today.filter((a) => /lead/.test(a)).join(' | ')));
  click($$('#view .alert').find((a) => /new lead/.test(a.textContent))); await sleep(15);
  ok(T.ui.tab === 'quotes' && T.ui.slf === 'new' && $$('#ccList .scard').length === 1 && !!card(S), L('tapping it opens Sales on New: Sam Kowalski'));

  /* ---------- the board ---------- */
  await tap('[data-act="sl:f"][data-f="open"]');
  ok(chips().join(' | ') === 'Open 2 | Due now 1 | New 1 | Contacted 0 | Quoted 0 | Follow up 1 | Mine 1 | Booked 0 | Lost 1', L('the lists, with counts: ' + chips().join(' | ')));
  ok($$('#ccList .scard').map((c) => c.dataset.job).join() === [S.id, O.id].join(), L('the most urgent first: the new lead, then the call-back tomorrow'));
  ok(/^New · waiting 1[23] min · not called yet$/.test(line(S)) && !!card(S).querySelector('.snext .pill.warn') && txt(card(S).querySelector('.sstage')) === 'New', L('the new lead: “' + line(S) + '” (amber after 5 minutes)'));
  ok(/^Call back tomorrow 10:00\sAM$/.test(line(O)) && txt(card(O).querySelector('.sstage')) === 'Follow up' && card(O).querySelector('select[data-sown]').value === 'Owner', L('Ortega family: “' + line(O) + '”, Follow up, Owner working it'));
  S.createdAt = Date.now() - 40 * 6e4; T.render(); await sleep(10);
  ok(/waiting 40 min/.test(line(S)) && !!card(S).querySelector('.snext .pill.bad'), L('after 15 minutes it turns red: ' + line(S)));

  /* ---------- a call logged, then a call-back ---------- */
  await tap('#ccList [data-act="sl:p"][data-m="log"][data-id="' + S.id + '"]');
  ok(/What happened\?No answerLeft a voicemailTalkedTexted/.test(txt(card(S).querySelector('.spanel'))), L('Log a call: No answer, Left a voicemail, Talked, Texted'));
  await tap('#ccList [data-act="sl:log"][data-k="noanswer"][data-id="' + S.id + '"]');
  ok(S.sales.n === 1 && S.sales.last.k === 'noanswer' && S.sales.last.by === 'Owner' && S.sales.owner === 'Owner' && S.sales.first > 0 && evs(S).slice(-1)[0] === 'Called by Owner: no answer', L('No answer: counted, and Owner works it now (“' + evs(S).slice(-1)[0] + '”)'));
  ok(/^When should you call back\?/.test(txt(card(S).querySelector('.spanel'))) && /When should someone call back\?/.test(toastTxt()) && badge() === '', L('then it asks when to call back; nothing to call now, so no badge'));
  ok(/^Last: no answer, today \d{1,2}:\d\d\s[AP]M \(Owner\) · No call-back set$/.test(line(S)) && txt(card(S).querySelector('.sstage')) === 'Contacted', L('Contacted: “' + line(S) + '”'));
  await tap('#ccList [data-act="sl:back"][data-k="am"][data-id="' + S.id + '"]');
  const t10 = new Date(); t10.setDate(t10.getDate() + 1); t10.setHours(10, 0, 0, 0);
  ok(S.sales.next.at === t10.getTime() && S.sales.next.by === 'Owner' && /^Call back tomorrow 10:00\sAM, set by Owner$/.test(evs(S).slice(-1)[0]) && txt(card(S).querySelector('.sstage')) === 'Follow up' && !card(S).querySelector('.spanel'), L('Tomorrow 10:00 AM: “' + evs(S).slice(-1)[0] + '”, Follow up'));
  // a time of their own
  await tap('#ccList [data-act="sl:p"][data-m="back"][data-id="' + S.id + '"]');
  const inp = $('#slAt_' + S.id); inp.value = ''; await tap('#ccList [data-act="sl:backat"][data-id="' + S.id + '"]');
  ok(/Pick a day and time first\./.test(toastTxt()), L('Set with no time: “Pick a day and time first.”'));
  const past = new Date(Date.now() - 3 * 36e5), pad = (n) => String(n).padStart(2, '0');
  const loc = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  $('#slAt_' + S.id).value = loc(past); await tap('#ccList [data-act="sl:backat"][data-id="' + S.id + '"]');
  ok(/That time has passed/.test(toastTxt()) && S.sales.next.at === t10.getTime(), L('a time gone by: “That time has passed. Pick a time ahead.”'));
  const fut = new Date(Date.now() + 2 * 864e5); fut.setHours(15, 30, 0, 0);
  $('#slAt_' + S.id).value = loc(fut); await tap('#ccList [data-act="sl:backat"][data-id="' + S.id + '"]');
  ok(S.sales.next.at === fut.getTime() && /^Call back /.test(toastTxt()), L('a day and time ahead: set (' + toastTxt() + ')'));

  /* ---------- due, then overdue ---------- */
  S.sales.next.at = Date.now() - 10 * 6e4; T.render(); await sleep(10);
  ok(line(S) === 'Call back now' && !!card(S).querySelector('.snext .pill.warn') && badge() === '1' && chips()[1] === 'Due now 1', L('its time came: “Call back now”, the badge and Due now say 1'));
  S.sales.next.at = Date.now() - 2 * 36e5; T.render(); await sleep(10);
  ok(/^Overdue: the call-back was today \d{1,2}:\d\d\s[AP]M$/.test(line(S)) && !!card(S).querySelector('.snext .pill.bad'), L('an hour late: “' + line(S) + '” in red'));
  await tap('[data-act="tab"][data-tab="today"]'); await allRows();
  const td = $$('#view .alert').map(txt).find((a) => /call-back/.test(a)) || '';
  ok(td === '!1 call-back is dueSam Kowalski · Sales›' && !!$$('#view .alert').find((a) => /call-back/.test(a.textContent)).querySelector('.ic.bad'), L('Today: “1 call-back is due”, red when one is late'));
  click($$('#view .alert').find((a) => /call-back/.test(a.textContent))); await sleep(15);
  ok(T.ui.tab === 'quotes' && T.ui.slf === 'due' && !!card(S), L('tapping it opens Due now'));
  await tap('#ccList [data-act="sl:p"][data-m="log"][data-id="' + S.id + '"]');
  await tap('#ccList [data-act="sl:log"][data-k="talked"][data-id="' + S.id + '"]');
  ok(S.sales.next === null && S.sales.n === 2 && /Open the quote to price it/.test(toastTxt()) && badge() === '', L('Talked: the call-back is done, and it suggests the quote'));
  await tap('#ccList [data-act="sl:back"][data-k="2d"][data-id="' + S.id + '"]');
  ok(!card(S), L('set for 2 days from now, it leaves Due now'));
  await tap('[data-act="sl:f"][data-f="open"]');
  await tap('#ccList [data-act="sl:p"][data-m="back"][data-id="' + S.id + '"]');
  await tap('#ccList [data-act="sl:noback"][data-id="' + S.id + '"]');
  ok(S.sales.next === null && evs(S).slice(-1)[0] === 'Call-back taken off by Owner', L('No call-back takes it off'));

  /* ---------- who works it, Mine ---------- */
  await tap('[data-act="sl:f"][data-f="open"]');
  const sel = card(S).querySelector('select[data-sown]');
  ok([...sel.options].map((o) => o.textContent).join(',') === 'No one yet,Owner,Dispatch', L('the office picks who works it: ' + [...sel.options].map((o) => o.textContent).join(', ')));
  sel.value = 'Dispatch'; sel.dispatchEvent(new w.Event('change', { bubbles: true })); await sleep(15);
  ok(S.sales.owner === 'Dispatch' && evs(S).slice(-1)[0] === 'Dispatch is working this lead (picked by Owner)' && toastTxt() === 'Dispatch is working Sam Kowalski.', L('given to Dispatch'));
  await tap('[data-act="sl:f"][data-f="mine"]');
  ok($$('#ccList .scard').map((c) => c.dataset.job).join() === O.id, L('Mine: only Ortega family now'));

  /* ---------- lost with a reason, and reopened ---------- */
  await tap('[data-act="sl:f"][data-f="open"]');
  await tap('#ccList [data-act="sl:p"][data-m="lost"][data-id="' + S.id + '"]');
  ok(/^Why was it lost\?Went with another moverPriceThe date didn’t workMoving themselvesNot movingNever answeredOther$/.test(txt(card(S).querySelector('.spanel'))), L('Lost asks why'));
  await tap('#ccList [data-act="sl:lost"][data-k="price"][data-id="' + S.id + '"]');
  ok(S.status === 'lost' && S.sales.lost.k === 'price' && S.sales.lost.by === 'Owner' && evs(S).slice(-1)[0] === 'Marked lost by Owner: price' && !card(S), L('Price: lost, off the open ones (“Marked lost by Owner: price”)'));
  await tap('[data-act="sl:f"][data-f="lost"]');
  ok(/^Lost: price · today \d{1,2}:\d\d\s[AP]M \(Owner\)$/.test(line(S)) && !!card(S).querySelector('[data-act="sl:reopen"]'), L('Lost: “' + line(S) + '”, with Reopen'));
  await tap('#ccList [data-act="sl:reopen"][data-id="' + S.id + '"]');
  ok(S.status === 'lead' && S.sales.lost === null && evs(S).slice(-1)[0] === 'Reopened by Owner' && T.ui.slf === 'open' && !!card(S), L('Reopen: a lead again, back with the open ones'));

  /* ---------- a quote made in the quote builder ---------- */
  await tap('#fab', 15);
  const type = (sel, v) => { const el = $(sel); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
  type('[data-d="name"]', 'Rosa Diaz'); type('[data-d="phone"]', '512-555-0133');
  await tap('[data-act="q:step"][data-s="2"]'); click($$('[data-act="inc"]')[0]); await sleep(5);
  await tap('[data-act="q:step"][data-s="3"]'); await tap('#qSave', 15);
  const R = byName('Rosa Diaz');
  ok(R && R.status === 'quoted' && R.sales.owner === 'Owner' && R.sales.n === 1 && R.sales.last.k === 'quote', L('a quote made by the office: Owner works it, and making it was the first contact'));
  await go();
  ok(txt(card(R).querySelector('.sstage')) === 'Quoted' && /^Last: made the quote, today /.test(line(R)), L('on the board as Quoted, not New: “' + line(R) + '”'));

  /* ---------- the job sheet ---------- */
  T.openJob(R.id); await sleep(15);
  const sn = $('#sheet .snote');
  ok(sn && /^Sales · Owner is working itOpen in Sales/.test(txt(sn)), L('the job sheet: “' + txt(sn).slice(0, 60) + '”'));
  await tap('#sheet [data-act="sl:show"][data-id="' + R.id + '"]', 20);
  ok(!T.ui.jobId && T.ui.tab === 'quotes' && T.ui.ccq === 'Rosa Diaz' && !!card(R) && !!card(R).querySelector('.spanel') && $$('#ccList .scard').length === 1, L('Open in Sales: found, with Log a call open'));
  T.ui.ccq = ''; T.ui.sp = null;

  /* ---------- the call center ---------- */
  const V = byName('Sam Kowalski'); V.sales = null; V.createdAt = Date.now() - 3 * 6e4;
  const pv = async (role, staff) => { click('[data-act="more:open"]'); await sleep(5); click('[data-act="more:preview"]'); await sleep(5); click($$('#more [data-act="pv:set"]').find((b) => b.dataset.role === role && b.dataset.staff === staff)); await sleep(20); };
  await pv('callcenter', '');
  await tap('#tabs [data-act="tab"][data-tab="quotes"]');
  ok(!chips().some((c) => /^(Booked|Lost)/.test(c)) && !$('#ccList select[data-sown]'), L('MoveCrew’s call center (seen as anyone): open ones only, and no picking for others'));
  ok(txt(card(V).querySelector('.sown')) === 'No one is working it yet.' && !card(V).querySelector('[data-act="sl:take"]'), L('seen as anyone, there’s no one to take it'));
  click('[data-act="pv:end"]'); await sleep(15);
  st().settings.ccStaff = ['Kim']; T.save(); T.render(); await sleep(10);   // Kim, a crew member, is also the company's call center person
  await pv('crew', 'Kim');
  await tap('#tabs [data-act="tab"][data-tab="quotes"]');
  ok(T.ui.tab === 'quotes' && /No one is working it yet\.Take it/.test(txt(card(V).querySelector('.sown'))), L('Kim, the company’s call center person: a lead nobody has, with Take it'));
  await tap('#ccList [data-act="sl:take"][data-id="' + V.id + '"]');
  ok(V.sales.owner === 'Kim' && evs(V).slice(-1)[0] === 'Kim (call center) took this lead' && /It’s yours/.test(toastTxt()) && txt(card(V).querySelector('.sown')) === 'Working it: You', L('Take it: Kim’s (“' + evs(V).slice(-1)[0] + '”), and it says You'));
  await tap('[data-act="sl:f"][data-f="mine"]');
  ok($$('#ccList .scard').map((c) => c.dataset.job).join() === V.id, L('Kim’s Mine: that lead'));
  click('[data-act="pv:end"]'); await sleep(15);
  ok(A.errors.length === 0, L('no errors (' + A.errors.slice(0, 3).join(' | ') + ')'));

  /* ---------- hosted: small patches to the database ---------- */
  const ORG = 'org-1';
  const row = (path, data) => { const [collection, doc_id] = path.split('/'); return { org_id: ORG, path, collection, doc_id, data, updated_at: new Date().toISOString() }; };
  const db = { docs: [row('meta/init', { ts: 1 }),
    row('org/settings', { company: 'Ace Moving', crew: ['Marcus'], leads: ['Marcus'], office: [{ name: 'Owner', kind: 'owner' }, { name: 'Dispatch', kind: 'dispatch' }], contacts: {}, trucks: [{ id: 't26', name: 'Box 1 (26 ft)', cf: 1700 }], forms: [] }),
    row('jobs/l1', { id: 'l1', status: 'lead', createdAt: Date.now() - 5 * 6e4, d: { name: 'Web Lead', phone: '512-555-0101', moveDate: '', time: '08:00', from: 'Austin', to: 'Waco', items: [], custom: {}, source: 'Website' },
      quote: { total: 0, cf: 0, crew: 2, hours: 3, lines: [] }, items: [], assign: { truckId: '', crew: [] }, tally: {}, payments: {}, signed: {}, extras: {}, crewNotes: {}, photos: {}, materials: {}, costs: {}, log: {}, confirm: {} })],
    access_requests: [], comm_log: [], comm_lines: [],
    members: [{ org_id: ORG, user_id: 'u-dispatch', email: 'd@x', staff: 'Dispatch', role: 'dispatch', ts: 1 }] };
  const D = await load(HOSTED, { db, org: ORG, me: { uid: 'u-dispatch', email: 'd@x' }, fnReply: () => ({ ok: true, sent: 0 }) });
  D.click('#tabs [data-act="tab"][data-tab="quotes"]'); await sleep(20);
  ok(!!D.$('#ccList .scard[data-job="l1"]') && /^New · waiting [56] min · not called yet$/.test(txt(D.$('#ccList .scard[data-job="l1"] .snext'))), L('hosted: dispatch’s Sales board has the new web lead'));
  D.click('#ccList [data-act="sl:p"][data-m="log"][data-id="l1"]'); await sleep(10);
  D.click('#ccList [data-act="sl:log"][data-k="vm"][data-id="l1"]'); await sleep(700);
  const pw = D.calls.writes.filter((x) => x.op === 'patch').pop();
  const dbs = db.docs.find((x) => x.path === 'jobs/l1').data.sales;
  ok(pw && Object.keys(pw.patch).sort().join() === 'log,sales' && dbs && dbs.last.k === 'vm' && dbs.owner === 'Dispatch' && dbs.n === 1, L('hosted: Left a voicemail goes as a small patch (sales and the activity): ' + JSON.stringify(dbs)));
  D.click('#ccList [data-act="sl:back"][data-k="1h"][data-id="l1"]'); await sleep(700);
  D.click('#ccList [data-act="sl:p"][data-m="log"][data-id="l1"]'); await sleep(10);
  D.click('#ccList [data-act="sl:log"][data-k="talked"][data-id="l1"]'); await sleep(700);
  const d2 = db.docs.find((x) => x.path === 'jobs/l1').data.sales;
  ok(d2.n === 2 && !('next' in d2), L('hosted: the call-back, once done, is gone from the database too: ' + JSON.stringify(d2)));
  ok(D.errors.length === 0, L('hosted: no errors (' + D.errors.slice(0, 3).join(' | ') + ')'));

  process.exit(summary(label) ? 1 : 0);
})().catch((e) => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });

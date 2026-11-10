// The lead for the day (Richie, Nov 9: his boss "was bitching at us for not sharing who the lead was for the day .
// Since their was multiple leads on the job"). With two or more on a job who can lead it, the one leading today is
// picked at Start job (the one starting it, or the office's pick) or by the office on the job's sheet; it's written in
// the job's activity, named on the sheet, the crew's card and job messages, the customer's "Tanya's crew", Reports by
// crew; whoever leads and leaves the job hands it to the next one on it who can lead; taken off the crew, the pick goes
// (and the hosted app's database drops it too). A job with one lead shows none of it.
const { load, ok, sleep, summary } = require('./lib');
const file = process.argv[2] || __dirname + '/../../build/tally-artifact.html', label = process.argv[3] || 'lead';
const HOSTED = __dirname + '/../../build/tally-supabase.html';
const L = (m) => label + ': ' + m;
const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

(async () => {
  const A = await load(file, {});
  const { w, $, $$, click, T } = A;
  const st = () => T.state();
  const byName = (n) => st().jobs.find((j) => j.d.name === n);
  const preview = async (role, staff) => { click('[data-act="more:open"]'); await sleep(5); click('[data-act="more:preview"]'); await sleep(5); click($$('#more [data-act="pv:set"]').find((b) => b.dataset.role === role && b.dataset.staff === staff)); await sleep(15); };
  const endPreview = async () => { click('[data-act="pv:end"]'); await sleep(15); };
  const crewCard = (j) => $('#view .crewcard[data-job="' + j.id + '"]');
  const ccLead = (j) => txt(crewCard(j) && crewCard(j).querySelector('.cc-lead'));
  const sheet = async (j) => { T.openJob(j.id); await sleep(20); };
  const closeSheet = async () => { const c = $('#sheet [data-act="sheet:close"]'); if (c) click(c); await sleep(10); };
  const leadSel = () => $('#sheet select[data-lead]');
  const pick = async (v) => { const s = leadSel(); s.value = v; s.dispatchEvent(new w.Event('change', { bubbles: true })); await sleep(20); };
  const opts = () => (leadSel() ? [...leadSel().options].map((o) => (o.value || '—') + '=' + o.textContent + (o.selected ? '*' : '')).join(', ') : 'no select');
  const evs = (j) => j.log.map((l) => l.ev);
  const head = () => txt($('#sheet .sheet-head small'));
  const toastTxt = () => $('#toast').textContent;
  const startChips = () => $$('#start [data-act="go:lead"]').map((b) => b.dataset.n + (b.getAttribute('aria-pressed') === 'true' ? '*' : ''));

  /* ---------- one who can lead: nothing new ---------- */
  const P = byName('Priya Nair');
  ok(P && P.status === 'booked' && P.assign.crew.join() === 'Marcus,Dee,Luis' && st().settings.leads.join() === 'Marcus,Tanya', L('sample: Priya Nair today with Marcus (lead), Dee and Luis; Marcus and Tanya are the leads'));
  await sheet(P);
  ok(!leadSel() && !/Lead today/.test(txt($('#sheet'))) && !/Lead:/.test(head()), L('one who can lead on the job: no Lead today on the sheet'));
  await closeSheet();
  await preview('crew', 'Dee');
  ok(!!crewCard(P) && !crewCard(P).querySelector('.cc-lead'), L('nor on Dee’s card for it'));
  click('[data-act="tab"][data-tab="chat"]'); await sleep(10); click('[data-act="chat:open"][data-t="jobs"]'); await sleep(10);
  let msg = txt($$('#view .jmsg').find((m) => /Priya Nair/.test(m.textContent)));
  ok(/Lead: Marcus/.test(msg) && !/can lead it/.test(msg), L('her job message says Lead: Marcus, as before: ' + msg));
  await endPreview();
  A.clockIn('Marcus', 'Dee', 'Luis', 'Tanya');
  await preview('lead', 'Marcus');
  await A.go('crew');
  click('[data-act="cr:start"][data-id="' + P.id + '"]'); await sleep(15);
  ok(!$('#start').hidden && !$('#start [data-act="go:lead"]') && !/Who’s leading today\?/.test(txt($('#start'))), L('Start job with one lead: no “Who’s leading today?”'));
  click('#start [data-act="go:close"]'); await sleep(10);
  await endPreview();

  /* ---------- two who can lead: the office adds Tanya ---------- */
  await sheet(P);
  click('#sheet [data-act="sh:crew"][data-n="Tanya"]'); await sleep(20);
  ok(P.assign.crew.join() === 'Marcus,Dee,Luis,Tanya', L('the office puts Tanya, a lead too, on the job'));
  ok(!!leadSel() && opts() === '—=Picked at Start job, or pick now*, Marcus=Marcus, Tanya=Tanya' && /^Lead today \(2 on this job can lead it\)/.test(txt(leadSel().closest('label'))),
    L('the sheet asks who leads today: “Picked at Start job, or pick now”, Marcus, Tanya: ' + opts()));
  await closeSheet();
  await preview('crew', 'Dee');
  ok(ccLead(P) === 'Marcus and Tanya can lead this one. Whoever starts the job picks who leads today.', L('Dee’s card: “Marcus and Tanya can lead this one. Whoever starts the job picks who leads today.” ' + ccLead(P)));
  ok(/Crew: Marcus \(lead\)/.test(txt(crewCard(P))) && /Tanya \(lead\)/.test(txt(crewCard(P))), L('the crew line still marks both as leads'));
  click('[data-act="tab"][data-tab="chat"]'); await sleep(10); click('[data-act="chat:open"][data-t="jobs"]'); await sleep(10);
  msg = txt($$('#view .jmsg').find((m) => /Priya Nair/.test(m.textContent)));
  ok(/Marcus and Tanya can lead it\. Whoever starts the job picks who leads today\./.test(msg) && !/Lead: Marcus/.test(msg) && /With: Luis/.test(msg) && !/With:[^.]*(Marcus|Tanya)/.test(msg), L('her job message: who can lead, and With: only Luis: ' + msg));
  await endPreview();

  /* ---------- Start job: the one starting leads unless they pick someone else ---------- */
  await preview('lead', 'Tanya');
  click('[data-act="tab"][data-tab="chat"]'); await sleep(10); click('[data-act="chat:open"][data-t="jobs"]'); await sleep(10);
  msg = txt($$('#view .jmsg').find((m) => /Priya Nair/.test(m.textContent)));
  ok(/You and Marcus can lead it\./.test(msg), L('Tanya’s job message: “You and Marcus can lead it.”'));
  await A.go('crew');
  click('[data-act="cr:start"][data-id="' + P.id + '"]'); await sleep(15);
  ok(!$('#start').hidden && /Who’s leading today\?/.test(txt($('#start'))) && startChips().join() === 'Marcus,Tanya*', L('Tanya’s Start job asks “Who’s leading today?”, Tanya picked (she’s starting it): ' + startChips().join()));
  click('#start [data-act="go:close"]'); await sleep(10);
  ok(P.status === 'booked' && !P.assign.lead, L('closed without starting: nothing picked'));
  await endPreview();

  /* ---------- the office picks Marcus on the sheet ---------- */
  await sheet(P);
  await pick('Marcus');
  ok(P.assign.lead === 'Marcus' && evs(P).slice(-1)[0] === 'Lead today: Marcus (picked by Owner)' && toastTxt() === 'Marcus leads Priya Nair today.', L('the office picks Marcus: saved, in the activity (picked by Owner), the toast says so: ' + evs(P).slice(-1)[0] + ' / ' + toastTxt()));
  ok(opts() === 'Marcus=Marcus*, Tanya=Tanya', L('the sheet shows Marcus picked, with no blank choice now: ' + opts()));
  ok(!/Lead:/.test(head()), L('a booked job’s header doesn’t name the lead yet'));
  await closeSheet();
  await preview('crew', 'Dee');
  ok(ccLead(P) === 'Lead today: Marcus', L('Dee’s card: “Lead today: Marcus”'));
  click('[data-act="tab"][data-tab="chat"]'); await sleep(10); click('[data-act="chat:open"][data-t="jobs"]'); await sleep(10);
  msg = txt($$('#view .jmsg').find((m) => /Priya Nair/.test(m.textContent)));
  ok(/Lead: Marcus/.test(msg) && !/can lead it/.test(msg) && /With: Luis, Tanya/.test(msg), L('her job message: Lead: Marcus, With: Luis, Tanya: ' + msg));
  await endPreview();

  /* ---------- Tanya starts it and takes the lead ---------- */
  await preview('lead', 'Tanya');
  await A.go('crew');
  click('[data-act="cr:start"][data-id="' + P.id + '"]'); await sleep(15);
  ok(startChips().join() === 'Marcus*,Tanya', L('her Start job has the office’s pick, Marcus: ' + startChips().join()));
  click('#start [data-act="go:lead"][data-n="Tanya"]'); await sleep(10);
  ok(startChips().join() === 'Marcus,Tanya*', L('she taps herself'));
  const n0 = P.log.length;
  click('#start [data-act="go:start"]'); await sleep(20);
  ok(P.status === 'active' && P.assign.lead === 'Tanya' && evs(P).slice(n0).indexOf('Lead today: Tanya') >= 0, L('started: Tanya leads today, in the activity: ' + evs(P).slice(n0).join(' / ')));
  ok(ccLead(P) === 'Lead today: Tanya', L('her card says so: ' + ccLead(P)));
  await endPreview();
  await sheet(P);
  ok(/ · Lead: Tanya$/.test(head()) && opts() === 'Marcus=Marcus, Tanya=Tanya*', L('the office’s sheet: “· Lead: Tanya” in its header and the pick: ' + head()));
  await closeSheet();

  /* ---------- the lead leaves the job: the next one on it who can lead takes it ---------- */
  T.mvAdd(P, 'Tanya', -1, Date.now()); T.render(); await sleep(10);
  ok(P.assign.lead === 'Marcus' && evs(P).indexOf('Lead today: Marcus (Tanya left)') >= 0, L('Tanya leaves: Marcus leads, “Lead today: Marcus (Tanya left)”'));
  T.mvAdd(P, 'Dee', -1, Date.now()); T.render(); await sleep(10);
  ok(P.assign.lead === 'Marcus' && evs(P).filter((e) => /^Lead today/.test(e)).length === 3, L('someone else leaving changes nothing'));

  /* ---------- taken off the crew: the pick goes ---------- */
  const N = byName('Nadia Farouk');
  await sheet(N);
  click('#sheet [data-act="sh:crew"][data-n="Tanya"]'); await sleep(20);
  await pick('Tanya');
  ok(N.assign.lead === 'Tanya', L('Nadia Farouk: the office adds Tanya and picks her'));
  click('#sheet [data-act="sh:crew"][data-n="Tanya"]'); await sleep(20);
  ok(N.assign.crew.indexOf('Tanya') < 0 && N.assign.lead === null && !leadSel(), L('then takes her off the crew: the pick goes with her (null, so a server drops it too), and the choice with it'));
  await closeSheet();

  /* ---------- a paid job with two leads: the customer's crew and Reports ---------- */
  const W = byName('Lena Wu');
  ok(W && W.status === 'paid' && W.assign.crew.join() === 'Marcus,Kim,Tanya', L('sample: Lena Wu, paid, crew Marcus, Kim and Tanya'));
  const crewRows = async () => { await A.go('reports'); const sec = $$('#view section.card').find((s) => /Revenue by crew/.test(s.textContent)); return sec ? $$('#view section.card').indexOf(sec) >= 0 && [...sec.querySelectorAll('tr')].slice(1).map((r) => txt(r.cells[0]) + ' ' + txt(r.cells[1])) : []; };
  const before = await crewRows();
  await sheet(W);
  ok(opts() === '—=Not picked*, Marcus=Marcus, Tanya=Tanya' && /· Lead: Marcus$/.test(head()), L('its sheet: Not picked, and the header names Marcus (the first lead on it): ' + opts() + ' / ' + head()));
  await pick('Tanya');
  ok(W.assign.lead === 'Tanya' && /· Lead: Tanya$/.test(head()), L('the office says Tanya led it: the header follows'));
  await closeSheet();
  const after = await crewRows();
  const n = (rows, who) => { const r = rows.find((x) => x.indexOf(who + '’s crew ') === 0); return r ? +r.split(' ').pop() : 0; };
  ok(n(after, 'Tanya') === n(before, 'Tanya') + 1 && n(after, 'Marcus') === n(before, 'Marcus') - 1, L('Reports › Revenue by crew moves the job from Marcus’s crew to Tanya’s: ' + before.join(', ') + ' → ' + after.join(', ')));
  const lena = T.custPeople().find((x) => x.name === 'Lena Wu').key;
  await A.go('jobs');
  click('[data-act="more:open"]'); await sleep(5); click('[data-act="more:preview"]'); await sleep(5);
  click(`#more [data-act="pv:set"][data-role="customer"][data-staff="${lena}"]`); await sleep(30);
  const nr = $('#cust [data-act="cs:norev"]'); if (nr) { click(nr); await sleep(20); }
  ok(/Your move was done by/.test(txt($('#view'))) && /Tanya’s crew of 3/.test(txt($('#view .cm-by'))), L('the customer’s app: “Tanya’s crew of 3”: ' + txt($('#view .cm-by .cm-sub'))));
  await endPreview();
  ok(A.errors.length === 0, L('no errors (' + A.errors.slice(0, 3).join(' | ') + ')'));

  /* ---------- hosted: the pick and its removal reach the database ---------- */
  const ORG = 'org-1';
  const day = (k) => { const d = new Date(Date.now() + k * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const row = (path, data) => { const [collection, doc_id] = path.split('/'); return { org_id: ORG, path, collection, doc_id, data, updated_at: new Date().toISOString() }; };
  const db = { docs: [row('meta/init', { ts: 1 }),
    row('org/settings', { company: 'Ace Moving', crew: ['Marcus', 'Dee', 'Tanya'], leads: ['Marcus', 'Tanya'], office: [{ name: 'Owner', kind: 'owner' }, { name: 'Dispatch', kind: 'dispatch' }],
      contacts: { Owner: '512-555-0100', Dispatch: '512-555-0199', Marcus: '512-555-0101', Dee: '512-555-0102', Tanya: '512-555-0104' }, trucks: [{ id: 't26', name: 'Box 1 (26 ft)', cf: 1700 }], forms: [] }),
    row('jobs/j1', { id: 'j1', status: 'booked', createdAt: 1, d: { name: 'Priya Nair', phone: '512-555-0142', moveDate: day(1), time: '08:00', from: '418 Oak St', to: '77 Ridge Rd', items: [], custom: {} },
      quote: { total: 1615, cf: 1450, crew: 3, hours: 7, lines: [], deposit: 0, nte: 0, nTrucks: 1 }, items: [], assign: { truckId: 't26', crew: ['Marcus', 'Dee', 'Tanya'] }, tally: {},
      payments: {}, signed: {}, extras: {}, crewNotes: {}, photos: {}, materials: {}, costs: {}, log: {}, confirm: {} })],
    access_requests: [], comm_log: [], comm_lines: [],
    members: [{ org_id: ORG, user_id: 'u-dispatch', email: 'd@x', staff: 'Dispatch', role: 'dispatch', ts: 1 }, { org_id: ORG, user_id: 'u-dee', email: 'e@x', staff: 'Dee', role: 'crew', ts: 1 }] };
  const as = (uid) => ({ uid, email: uid + '@x' });
  const dbJob = () => db.docs.find((x) => x.path === 'jobs/j1').data;
  const D = await load(HOSTED, { db, org: ORG, me: as('u-dispatch'), fnReply: () => ({ ok: true, sent: 0 }) });
  D.T.ui.jobId = 'j1'; D.T.render(); await sleep(20);
  const dsel = D.$('#sheet select[data-lead]');
  ok(!!dsel, L('hosted: dispatch’s sheet asks who leads today'));
  dsel.value = 'Tanya'; dsel.dispatchEvent(new D.w.Event('change', { bubbles: true })); await sleep(600);
  ok(dbJob().assign.lead === 'Tanya' && Object.values(dbJob().log).some((l) => l.ev === 'Lead today: Tanya (picked by Dispatch)'), L('hosted: the database has Tanya as the lead today, and the activity line: ' + JSON.stringify(dbJob().assign)));
  const E = await load(HOSTED, { db, org: ORG, me: as('u-dee'), fnReply: () => ({ ok: true, sent: 0 }) });
  E.click('[data-act="tab"][data-tab="crew"]'); await sleep(20);
  ok(txt(E.$('#view .crewcard[data-job="j1"] .cc-lead')) === 'Lead today: Tanya', L('hosted: Dee’s phone says “Lead today: Tanya”'));
  D.click('#sheet [data-act="sh:crew"][data-n="Tanya"]'); await sleep(600);
  ok(dbJob().assign.crew.join() === 'Marcus,Dee' && !('lead' in dbJob().assign), L('hosted: Tanya taken off the crew: the database drops the pick too: ' + JSON.stringify(dbJob().assign)));
  // (the stand-in database tells only the phone that wrote a row, so the change reaches Dee's phone through its own connection)
  E.w.__sb.__fire('docs', db.docs.find((x) => x.path === 'jobs/j1')); await sleep(1000);
  const ej = E.T.state().jobs.find((x) => x.id === 'j1');
  ok(ej && ej.assign.crew.join() === 'Marcus,Dee' && !ej.assign.lead && !E.$('#view .crewcard[data-job="j1"] .cc-lead'), L('hosted: Dee’s phone follows (one lead now, no line): ' + JSON.stringify(ej && ej.assign) + ' ' + txt(E.$('#view .crewcard[data-job="j1"] .cc-lead'))));
  ok(D.errors.length === 0 && E.errors.length === 0, L('hosted: no errors (' + D.errors.concat(E.errors).slice(0, 3).join(' | ') + ')'));

  process.exit(summary(label) ? 1 : 0);
})().catch((e) => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });

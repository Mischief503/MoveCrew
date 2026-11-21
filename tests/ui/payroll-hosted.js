// Payroll on the hosted MoveCrew (batch 8): HR who aren't the office or the owner go through the database's functions
// (supabase-payroll.sql, tested in tests/sql/payroll.sh; stood in for here by db.__rpc): Marcus, a crew lead with HR,
// reads a pay period's jobs (payroll_jobs) and the payroll details (payroll_people), saves the payroll settings
// (hr_payroll_set), a tip split on a job he isn't on (hr_tip_split) and a payroll ID (hr_payroll_id), and fixes a
// clock punch (the clock rows themselves). The files leave the app: Android's share sheet in the Android app (and what
// the Android app from before says), the phone's share sheet on the website, a download on a computer. The owner saves
// with the rest of the settings and the profiles. And the database without the update: what Marcus is told.
const { load, ok, sleep, summary } = require('./lib');
const FILE = __dirname + '/../../build/tally-supabase.html', ORG = 'org-1';
const L = (m) => 'payroll hosted: ' + m;
const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
const pad = (n) => String(n).padStart(2, '0'), iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addD = (s, n) => { const d = new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)); d.setDate(d.getDate() + n); return iso(d); };
const at = (s, h, m) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), h, m || 0).getTime();
const today = iso(new Date()), mon = addD(today, -((new Date().getDay() + 6) % 7)), d0 = addD(mon, -7), dd = (i) => addD(d0, i);

function seed(opts) {
  const docs = [], put = (path, data) => { const [c, id] = path.split('/'); docs.push({ org_id: ORG, path, collection: c, doc_id: id, data, updated_at: 'x' }); };
  const settings = { company: 'Ace Moving', crew: ['Marcus', 'Kim', 'Luis'], leads: ['Marcus'], office: [{ name: 'Owner', kind: 'owner' }], ccStaff: [], hr: ['Marcus'],
    contacts: {}, rates: { r2: 140, r3: 195, r4: 250 }, minHours: 3, trucks: [{ id: 't16', name: 'Van (16 ft)', cf: 800 }], opt: { clock: true },
    payroll: { freq: 'weekly', anchor: addD(mon, -14), weekStart: 1, otWeekOn: true, otWeek: 40, otDayOn: false, otDay: 8, tips: 'lead', set: true, by: 'Owner', at: 1 } };
  put('meta/init', { ts: 1 }); put('org/settings', settings);
  const job = (id, name, day, crew, over) => Object.assign({ id, status: 'done', createdAt: at(day, 7), d: { name, phone: '512-555-0170', moveDate: day, time: '08:00', from: '1 A St', to: '2 B St', items: [], custom: {} },
    quote: { cf: 193, count: 18, crew: 2, hours: 3, truckId: 't16', truckName: 'Van (16 ft)', nTrucks: 1, total: 600, kind: 'local', rate: 140, lines: [] }, items: [],
    assign: { truckId: 't16', crew }, tally: {}, payments: {}, signed: {}, extras: {}, crewNotes: {}, photos: {}, materials: {}, costs: {}, log: {}, confirm: {}, actualHours: 5, minPaid: 3, startedAt: at(day, 8), finishedAt: at(day, 13) }, over || {});
  // Kim and Luis's job, which Marcus isn't on: the database's rules don't give it to him; payroll_jobs does
  const kl = job('kl', 'Rosa Vega', dd(1), ['Kim', 'Luis'], { status: 'paid', payments: { p1: { id: 'p1', amt: 600, method: 'Card', date: dd(1), ts: at(dd(1), 13), tip: 50 } } });
  const mj = job('mj', 'Theo Park', dd(2), ['Marcus'], { actualHours: 6 });
  put('jobs/kl', kl); put('jobs/mj', mj);
  put('shifts/s1', { id: 's1', who: 'Kim', inAt: at(dd(3), 7), outAt: at(dd(3), 15), activity: 'Warehouse', breaks: [], late: 0, note: '' });
  put('shifts/s2', { id: 's2', who: 'Luis', inAt: at(dd(4), 7), outAt: 0, activity: 'Job day', breaks: [], late: 0, note: '' });
  const db = { docs, access_requests: [], comm_log: [], comm_lines: [], __orgNames: { [ORG]: 'Ace Moving' },
    members: [{ org_id: ORG, user_id: 'u-owner', email: 'o@x', staff: 'Owner', role: 'owner', ts: 1 }, { org_id: ORG, user_id: 'u-marcus', email: 'marcus@x', staff: 'Marcus', role: 'lead', ts: 1 }],
    employees: [{ id: 'e-kim', org_id: ORG, name: 'Kim', role: 'crew', email: 'kim@x', active: true, user_id: null, info: { payrollId: 'K-9', workerType: 'W-2 employee', payType: 'Hourly', payRate: '22' }, notes: 'owner only' },
      { id: 'e-luis', org_id: ORG, name: 'Luis', role: 'crew', email: 'luis@x', active: true, user_id: null, info: { payType: 'Hourly' }, notes: '' },
      { id: 'e-marcus', org_id: ORG, name: 'Marcus', role: 'lead', email: 'marcus@x', active: true, user_id: 'u-marcus', info: { payrollId: 'M-1', workerType: 'W-2 employee' }, notes: '' }] };
  const asked = db.__asked = [];
  db.__rpc = opts && opts.missing ? { payroll_jobs: () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.payroll_jobs(f, o, t) in the schema cache' } }) } : {
    payroll_jobs: (a) => { asked.push(['jobs', a.f, a.t]); return { data: db.docs.filter((r) => r.collection === 'jobs' && ['active', 'done', 'paid'].indexOf(r.data.status) >= 0).map((r) => JSON.parse(JSON.stringify(r.data))) }; },
    payroll_people: () => { asked.push(['people']); return { data: db.employees.map((e) => ({ name: e.name, payroll_id: e.info.payrollId || '', worker_type: e.info.workerType || '', pay_type: e.info.payType || '', active: e.active })) }; },
    hr_payroll_set: (a) => { asked.push(['set', a.p]); const c = Object.assign({}, a.p, { set: true, by: 'Marcus', at: 2 }); db.docs.find((r) => r.path === 'org/settings').data.payroll = c; return { data: c }; },
    hr_tip_split: (a) => { asked.push(['tip', a.jid, a.split]); const r = { amts: a.split, total: 50, by: 'Marcus', at: 3 }; db.docs.find((x) => x.path === 'jobs/' + a.jid).data.tipSplit = r; return { data: r }; },
    hr_payroll_id: (a) => { asked.push(['pid', a.emp, a.pid]); const e = db.employees.find((x) => x.name === a.emp); e.info.payrollId = a.pid; return { data: { name: e.name, payroll_id: a.pid } }; },
  };
  // the row rules for Marcus: what a lead reads, and every clock row (a lead does; HR does too)
  db.__visible = (r) => r.collection !== 'jobs' || ((r.data.assign || {}).crew || []).indexOf('Marcus') >= 0;
  return db;
}

(async () => {
  /* ---------- Marcus: a crew lead, with HR ---------- */
  let db = seed(), files = [];
  let A = await load(FILE, { db, org: ORG, me: { uid: 'u-marcus', email: 'marcus@x' }, setup: (w) => { w.TextEncoder = TextEncoder; w.__tallyFile = (n, m, b) => { files.push({ n, m, b }); return 'saved'; }; } });
  let { $, $$, click, T, w } = A;
  await sleep(300);
  const view = () => txt($('#view')), P = () => T.payUi();
  const toast = () => ($('#toast') && !$('#toast').hidden ? $('#toast').textContent : '');
  const fire = (el, v) => { if (typeof el === 'string') el = $(el); if (v !== undefined) el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const rows = () => $$('#prSum tr.prrow').map((r) => Array.from(r.children).map(txt).join(' | '));
  ok(T.sync.identity.role === 'lead' && T.state().ui.role === 'lead' && T.state().jobs.map((j) => j.id).join() === 'mj', L('Marcus signs in: a lead, with his own job only'));
  click('[data-act="more:open"]'); await sleep(5);
  ok(!!$('#more [data-act="more:go"][data-tab="payroll"]'), L('HR: Payroll in More'));
  click('#more [data-act="more:go"][data-tab="payroll"]'); await sleep(60);
  ok(db.__asked.some((x) => x[0] === 'jobs' && x[1] === d0 && x[2] === addD(dd(6), 1)) && db.__asked.some((x) => x[0] === 'people'), L('it asks the database for the week’s jobs (with the day after, for time zones) and the payroll details'));
  ok(P().per.from === d0 && rows().length === 3, L('the last pay period: ' + rows().join(' / ')));
  ok(/^Kim ?ID K-9 \| 13\.00 \| — \| 13\.00 \| \$25$/.test(rows().find((r) => /^Kim/.test(r)) || ''), L('Kim: Rosa Vega’s 5 hours (a job Marcus isn’t on), her 8-hour Thursday, and half the tip until it’s split: ' + rows()[0]));
  ok(/Luis is still clocked in, since/.test(txt($('#prCheck'))) && /The tip on Rosa Vega’s move isn’t split yet/.test(txt($('#prCheck'))) && /No payroll ID for Luis\./.test(txt($('#prCheck'))), L('to check: Luis still clocked in, the tip, his payroll ID'));
  // a tip split on a job he isn't on: through the database
  click('#prCheck [data-act="pr:tip"]'); await sleep(10);
  ok(!$('#prTips .tiped'), L('Split in the check list goes to the tip'));
  click('#prTips [data-act="tip:open"]'); await sleep(10);
  fire('[data-tipn="Kim"]', '30'); fire('[data-tipn="Luis"]', '20'); click('#prTips [data-act="tip:save"]'); await sleep(30);
  const tipAsk = db.__asked.find((x) => x[0] === 'tip');
  ok(tipAsk && tipAsk[1] === 'kl' && tipAsk[2].Kim === 30 && tipAsk[2].Luis === 20 && /Tip split saved/.test(toast()), L('saved through hr_tip_split: Kim $30, Luis $20'));
  ok(/\$30$/.test(rows().find((r) => /^Kim/.test(r))) && !A.calls.writes.some((x) => x.table === 'docs' && x.row && x.row.path === 'jobs/kl'), L('the hours show it, and the job itself isn’t written'));
  // a payroll ID: through the database
  click('#prCheck [data-act="pr:ids"]'); await sleep(10);
  fire('[data-prid="Luis"]', 'L-4'); click('[data-act="pr:idsave"]'); await sleep(30);
  ok(db.__asked.some((x) => x[0] === 'pid' && x[1] === 'Luis' && x[2] === 'L-4') && /Payroll IDs saved/.test(toast()) && !/No payroll ID/.test(txt($('#prCheck'))), L('Luis’s ID through hr_payroll_id'));
  ok(!A.calls.writes.some((x) => x.table === 'employees'), L('never the profiles directly'));
  // fixing Luis's clock-out: the clock row itself
  click('#prCheck [data-act="pr:fix"]'); await sleep(10);
  fire('#pp_s2 [data-prf="outS"]', dd(4) + 'T15:30'); click('[data-act="pr:fixsave"]'); await sleep(400);
  const sw = A.calls.writes.filter((x) => x.table === 'docs' && x.row && x.row.path === 'shifts/s2').pop();
  ok(sw && sw.row.data.outAt === at(dd(4), 15, 30) && sw.row.data.fixes && sw.row.data.fixes[0].by === 'Marcus', L('Luis’s clock-out saved to his clock row, fixed by Marcus'));
  // the settings: through the database
  T.ui.open['pr:set'] = true; T.render(); await sleep(10);
  const ev = $('input[name="prTips"][value="even"]'); ev.checked = true; fire(ev);
  const owk = $('[data-prc="otWeek"]'); fire(owk, '45');
  click('[data-act="pr:cfgsave"]'); await sleep(30);
  const setAsk = db.__asked.find((x) => x[0] === 'set');
  ok(setAsk && setAsk[1].tips === 'even' && setAsk[1].otWeek === 45 && setAsk[1].freq === 'weekly' && T.state().settings.payroll.tips === 'even' && /Payroll settings saved/.test(toast()), L('settings saved through hr_payroll_set'));
  await sleep(40);
  ok(!A.calls.writes.some((x) => x.table === 'docs' && x.row && x.row.path === 'org/settings') && T.sync.lastSettings === T.canon((function () { const s = JSON.parse(JSON.stringify(T.state().settings)); s.forms = (s.forms || []).map((f) => { const g = Object.assign({}, f); g.pageIds = f.pageIds || []; delete g.pages; return g; }); return s; })()), L('the settings doc itself isn’t written, and this copy counts as up to date'));
  // the files
  click('[data-act="pr:file"][data-k="xlsx"]'); await sleep(20);
  const f1 = files.pop();
  ok(f1 && f1.n === 'ace-moving-payroll-' + d0 + '-to-' + dd(6) + '.xlsx' && f1.m === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && f1.b[0] === 0x50 && f1.b[1] === 0x4b, L('the Excel file: named for the company and the week, a zip'));
  click('[data-act="pr:file"][data-k="csv"]'); await sleep(20);
  const f2 = files.pop(), csv = f2 ? new TextDecoder().decode(f2.b) : '';
  ok(f2 && f2.n.endsWith('.csv') && f2.m === 'text/csv' && f2.b[0] === 0xEF && f2.b[1] === 0xBB && f2.b[2] === 0xBF && /^Employee,Payroll ID/.test(csv) && /\r\nKim,K-9,W-2 employee,Hourly,13,0,0,13,25\r\n/.test(csv), L('the CSV (with the mark that tells Excel it’s UTF-8): ' + csv.split('\r\n')[1]));
  // the Android app: its share sheet
  delete w.__tallyFile;
  let shared = null; w.TallyNative = { shareFile: (n, m, b64) => { shared = { n, m, b64 }; return true; } };
  click('[data-act="pr:file"][data-k="xlsx"]'); await sleep(20);
  ok(shared && shared.n.endsWith('.xlsx') && Buffer.from(shared.b64, 'base64').slice(0, 2).toString() === 'PK', L('the Android app: the file goes to Android’s share sheet (TallyNative.shareFile)'));
  w.TallyNative = { hasGoogle: () => false };
  click('[data-act="pr:file"][data-k="csv"]'); await sleep(20);
  ok(/Update the MoveCrew app to send files from your phone/.test(toast()), L('the Android app from before: update it'));
  delete w.TallyNative;
  // the website on a phone: the phone's share sheet
  Object.defineProperty(w.navigator, 'userAgent', { configurable: true, get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' });
  let sh2 = null; w.navigator.canShare = (d) => !!(d && d.files && d.files.length); w.navigator.share = (d) => { sh2 = d; return Promise.resolve(); };
  T.render(); await sleep(10);
  ok(/Send the Excel file/.test(txt($('[data-act="pr:file"][data-k="xlsx"]'))), L('on a phone the button says Send'));
  click('[data-act="pr:file"][data-k="xlsx"]'); await sleep(20);
  ok(sh2 && sh2.files[0].name.endsWith('.xlsx') && sh2.files[0].type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && /Sent/.test(toast()), L('the website on a phone: the phone’s share sheet'));
  // a computer: a download
  Object.defineProperty(w.navigator, 'userAgent', { configurable: true, get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
  let blob = null; w.URL.createObjectURL = (b) => { blob = b; return 'blob:x'; }; w.URL.revokeObjectURL = () => {};
  T.render(); await sleep(10);
  click('[data-act="pr:file"][data-k="csv"]'); await sleep(20);
  ok(blob && blob.type === 'text/csv' && /Saved ace-moving-payroll-.*\.csv to your downloads/.test(toast()) && /Download a CSV/.test(txt($('[data-act="pr:file"][data-k="csv"]'))), L('a computer: a download'));
  ok(A.errors.filter((e) => !/navigation/.test(e)).length === 0, L('no errors for Marcus (' + A.errors.slice(0, 2).join(' | ') + ')'));

  /* ---------- the owner: the settings and the profiles, as before ---------- */
  db = seed(); files = [];
  A = await load(FILE, { db, org: ORG, me: { uid: 'u-owner', email: 'o@x' }, setup: (w2) => { w2.TextEncoder = TextEncoder; w2.__tallyFile = (n, m, b) => { files.push({ n }); return 'saved'; }; } });
  ({ $, $$, click, T, w } = A);
  await sleep(300);
  T.ui.tab = 'payroll'; T.render(); await sleep(60);
  ok(!db.__asked.length && rows().length === 3, L('the owner reads the jobs and profiles himself: no payroll functions'));
  click('#prCheck [data-act="pr:ids"]'); await sleep(10);
  fire('[data-prid="Luis"]', 'L-5'); click('[data-act="pr:idsave"]'); await sleep(40);
  const ew = A.calls.writes.filter((x) => x.table === 'employees').pop();
  ok(ew && ew.row.info && ew.row.info.payrollId === 'L-5' && ew.row.info.payType === 'Hourly' && ew.row.name === 'Luis', L('the owner’s payroll ID goes on the profile, the rest as it was'));
  T.ui.open['pr:set'] = true; T.render(); await sleep(10);
  const ev2 = $('input[name="prTips"][value="off"]'); ev2.checked = true; fire(ev2);
  click('[data-act="pr:cfgsave"]'); await sleep(400);
  const sws = A.calls.writes.filter((x) => x.table === 'docs' && x.row && x.row.path === 'org/settings').pop();
  ok(sws && sws.row.data.payroll && sws.row.data.payroll.tips === 'off' && sws.row.data.payroll.by === 'Owner' && !db.__asked.some((x) => x[0] === 'set'), L('the owner’s settings go with the rest of the settings'));
  ok(A.errors.length === 0, L('no errors for the owner (' + A.errors.slice(0, 2).join(' | ') + ')'));

  /* ---------- the database without the payroll update ---------- */
  db = seed({ missing: true });
  A = await load(FILE, { db, org: ORG, me: { uid: 'u-marcus', email: 'marcus@x' }, setup: (w3) => { w3.TextEncoder = TextEncoder; } });
  ({ $, $$, click, T, w } = A);
  await sleep(300);
  T.ui.tab = 'payroll'; T.render(); await sleep(60);
  ok(/The database needs the payroll update first \(supabase-payroll\.sql\)\. Ask the owner\./.test(view()) && !!$('[data-act="pr:retry"]') && !!$('#prSet'), L('without the update: what to do, Try again, and the settings still there'));
  ok(A.errors.length === 0, L('no errors (' + A.errors.slice(0, 2).join(' | ') + ')'));
  process.exit(summary('payroll-hosted') ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

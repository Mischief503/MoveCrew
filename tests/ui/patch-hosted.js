// A job's change reaches the database as a merge patch (RFC 7386, what doc_patch applies): only what changed, and null
// for each key a phone took out, at any depth. Found Nov 9 while adding the lead for the day: the database merges
// objects key by key, so a key the app simply dropped stayed there and came back with the next copy. Dispatch moving
// Marcus from Box 2 to Box 1 left him driving both trucks; a driver cleared with "Who drives?" came back.
const { load, ok, sleep, summary } = require('./lib');
const HOSTED = __dirname + '/../../build/tally-supabase.html';
const ORG = 'org-1';
const day = (n) => { const d = new Date(Date.now() + n * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const row = (path, data) => { const [collection, doc_id] = path.split('/'); return { org_id: ORG, path, collection, doc_id, data, updated_at: new Date().toISOString() }; };
// JSON with its keys sorted, so the checks don't depend on the order keys were added in
const sortK = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((o, k) => { o[k] = sortK(v[k]); return o; }, {}) : Array.isArray(v) ? v.map(sortK) : v);
const J = (S) => JSON.stringify(sortK(S));
function seed(assign) {
  return { docs: [row('meta/init', { ts: 1 }),
    row('org/settings', { company: 'Ace Moving', crew: ['Marcus', 'Dee', 'Luis'], leads: ['Marcus'], drivers: ['Marcus', 'Luis'], office: [{ name: 'Owner', kind: 'owner' }, { name: 'Dispatch', kind: 'dispatch' }],
      contacts: {}, trucks: [{ id: 't26', name: 'Box 1 (26 ft)', cf: 1700 }, { id: 't20', name: 'Box 2 (20 ft)', cf: 1000 }], forms: [] }),
    row('jobs/j1', { id: 'j1', status: 'booked', createdAt: 1, d: { name: 'Priya Nair', moveDate: day(1), time: '08:00', from: '418 Oak St', to: '77 Ridge Rd', items: [], custom: {} },
      quote: { total: 1615, cf: 1450, crew: 3, hours: 7, lines: [], deposit: 0, nte: 0, nTrucks: 2 }, items: [], assign, tally: {},
      payments: {}, signed: {}, extras: {}, crewNotes: {}, photos: {}, materials: {}, costs: {}, log: {}, confirm: {} })],
    access_requests: [], comm_log: [], comm_lines: [],
    members: [{ org_id: ORG, user_id: 'u-dispatch', email: 'd@x', staff: 'Dispatch', role: 'dispatch', ts: 1 }] };
}
const as = (uid) => ({ uid, email: uid + '@x' });
const pick = async (A, sel, v) => { const s = A.$(sel); s.value = v; s.dispatchEvent(new A.w.Event('change', { bubbles: true })); await sleep(700); };
// the next copy from the database reaches the phone (the stand-in database tells only the phone that wrote, after
// the write; this is the copy arriving again, as another phone's change would bring it)
const echo = async (A, db) => { A.w.__sb.__fire('docs', db.docs.find((x) => x.path === 'jobs/j1')); await sleep(1000); };

(async () => {
  const all = [];
  /* ---------- Marcus moved from Box 2 to Box 1 ---------- */
  let db = seed({ truckId: 't26', more: ['t20'], crew: ['Marcus', 'Dee'], drivers: { t20: 'Marcus' } });
  let D = await load(HOSTED, { db, org: ORG, me: as('u-dispatch'), fnReply: () => ({ ok: true, sent: 0 }) }); all.push(D);
  const dbA = () => db.docs.find((x) => x.path === 'jobs/j1').data.assign;
  const local = (A) => A.T.state().jobs.find((x) => x.id === 'j1').assign;
  const sels = (A) => A.$$('#sheet select[data-drv="sh"]').map((x) => x.value).join(',');
  D.T.ui.jobId = 'j1'; D.T.render(); await sleep(20);
  await pick(D, '#sheet select[data-drv="sh"][data-t="t26"]', 'Marcus');
  ok(J(dbA().drivers) === '{"t26":"Marcus"}', 'Marcus moved to Box 1: the database has him on Box 1 only: ' + J(dbA().drivers));
  const w = D.calls.writes.filter((x) => x.op === 'patch').pop();
  ok(w && J(w.patch.assign) === '{"drivers":{"t20":null,"t26":"Marcus"}}', 'the change sent is just that: Box 2’s driver out (null), Box 1’s in: ' + J(w && w.patch));
  await echo(D, db);
  ok(J(local(D).drivers) === '{"t26":"Marcus"}' && sels(D) === 'Marcus,', 'the next copy from the database leaves him on Box 1 only, and Box 2 needs a driver: ' + sels(D));

  /* ---------- a driver cleared on purpose ---------- */
  db = seed({ truckId: 't26', crew: ['Marcus', 'Dee', 'Luis'], drivers: { t26: 'Marcus' } });
  D = await load(HOSTED, { db, org: ORG, me: as('u-dispatch'), fnReply: () => ({ ok: true, sent: 0 }) }); all.push(D);
  D.T.ui.jobId = 'j1'; D.T.render(); await sleep(20);
  await pick(D, '#sheet select[data-drv="sh"][data-t="t26"]', '');
  ok(J(dbA().drivers) === '{}', '“Who drives?” picked for Box 1: the database drops Marcus as its driver: ' + J(dbA().drivers));
  await echo(D, db);
  ok(J(local(D).drivers) === '{}' && sels(D) === '', 'and he doesn’t come back with the next copy: ' + J(local(D).drivers));

  /* ---------- a truck taken off the job, and someone off the crew ---------- */
  db = seed({ truckId: 't26', more: ['t20'], crew: ['Marcus', 'Dee', 'Luis'], drivers: { t26: 'Marcus', t20: 'Luis' } });
  D = await load(HOSTED, { db, org: ORG, me: as('u-dispatch'), fnReply: () => ({ ok: true, sent: 0 }) }); all.push(D);
  D.T.ui.jobId = 'j1'; D.T.render(); await sleep(20);
  await pick(D, '#sheet select[data-trk="sh"][data-i="1"]', '');
  ok(J(dbA().more) === '[]' && J(dbA().drivers) === '{"t26":"Marcus"}', 'Box 2 taken off the job: its driver goes from the database too: ' + J(dbA()));
  D.click('#sheet [data-act="sh:crew"][data-n="Marcus"]'); await sleep(700);
  ok(J(dbA().crew) === '["Dee","Luis"]' && J(dbA().drivers) === '{}', 'Marcus taken off the crew: he no longer drives Box 1 in the database: ' + J(dbA()));
  await echo(D, db);
  D.click('#sheet [data-act="sh:crew"][data-n="Marcus"]'); await sleep(700);
  ok(J(local(D).crew) === '["Dee","Luis","Marcus"]' && J(local(D).drivers) === '{}', 'put back on the crew later, he isn’t Box 1’s driver again by himself (dispatch picks): ' + J(local(D)));

  /* ---------- the patch itself ---------- */
  const T = D.T, diff = (a, b) => J(T.jobDiff(a, b));
  const base = { id: 'x', status: 'booked', d: { name: 'A', notes: 'gate 4' }, assign: { truckId: 't26', crew: ['Marcus'], drivers: { t26: 'Marcus' } }, payments: { p1: { amt: 5 } }, eta: { mins: 30 } };
  const cp = (f) => { const c = JSON.parse(JSON.stringify(base)); f(c); return c; };
  ok(T.jobDiff(base, cp(() => {})) === null, 'nothing changed: nothing sent');
  ok(diff(base, cp((c) => { c.d.notes = 'gate 5'; })) === '{"d":{"notes":"gate 5"}}', 'one field changed: only that field');
  ok(diff(base, cp((c) => { c.assign.crew.push('Dee'); })) === '{"assign":{"crew":["Marcus","Dee"]}}', 'a list changed: the whole list');
  ok(diff(base, cp((c) => { delete c.d.notes; })) === '{"d":{"notes":null}}', 'a field taken out: null');
  ok(diff(base, cp((c) => { delete c.eta; })) === '{"eta":null}', 'a part of the job taken off altogether: null');
  ok(diff(base, cp((c) => { c.assign.lead = null; })) === 'null', 'a key set to null that the database never had: nothing to send');
  ok(diff(base, cp((c) => { delete c.payments.p1; })) === '{"payments":{"p1":null}}' && diff(base, cp((c) => { c.payments.p2 = { amt: 7 }; })) === '{"payments":{"p2":{"amt":7}}}', 'payments and the other lists by id work as before');
  ok(diff(base, cp((c) => { c.rq = { state: 'waiting' }; })) === '{"rq":{"state":"waiting"}}' &&
    diff(cp((c) => { c.rq = { state: 'done', applied: 9, sig: { name: 'P' } }; }), cp((c) => { c.rq = { state: 'waiting' }; })) === '{"rq":{"applied":null,"sig":null,"state":"waiting"}}',
    'a new on-site quote in place of a done one: the old one’s signature and applied time go too');

  ok(all.every((x) => x.errors.length === 0), 'no errors (' + all.map((x) => x.errors.join(' | ')).join(' ') + ')');
  process.exit(summary('patch hosted') ? 1 : 0);
})().catch((e) => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });

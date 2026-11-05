// Coming back to MoveCrew (Richie, Nov 5, after Build 63: "Its still not uploading photos"). supabase-js says
// SIGNED_IN again every time the page comes back to the front (auth-js _onVisibilityChanged → _recoverAndRefresh),
// and the app took that for someone new signing in: it reloaded itself, so coming back from the camera started
// MoveCrew over and the photos on their way in were lost. The same person carries on now; someone else signing in
// still starts clean. Also: a photo lands on the job even when the office's changes come in while it is being made
// smaller, the photos wait a few seconds for a job that isn't in yet, and after a while away the app catches up on
// what it missed (the live updates stop in the background).
const { load, ok, sleep, summary } = require('./lib');
const FILE = __dirname + '/../../build/tally-supabase.html';
const ORG = 'org-1';
const day = (n) => { const d = new Date(Date.now() + n * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

function jobDoc(id, name, over = {}) {
  return Object.assign({ id, status: 'booked', createdAt: Date.now() - 864e5,
    d: { name, phone: '512-555-0142', email: '', moveDate: day(0), time: '08:00', from: '418 Oak St', to: '77 Ridge Rd', miles: '', flights: '', pack: false, crew: '', truckId: '', hoursOverride: '', discount: '', notes: '', custom: {}, items: [] },
    quote: { total: 1000, cf: 500, crew: 2, hours: 4, lines: [{ label: 'Movers', amt: 1000 }], deposit: 250, nte: 1150, truckId: 't26', truckName: 'Box 1', nTrucks: 1, count: 10 },
    items: [], assign: { truckId: 't26', crew: ['Marcus', 'Dee'] }, tally: {}, payments: {}, signed: {}, extras: {}, crewNotes: {}, photos: {}, materials: {}, costs: {}, log: {} }, over);
}
const put = (docs, path, data) => { const [collection, doc_id] = path.split('/'); const r = { org_id: ORG, path, collection, doc_id, data, updated_at: new Date().toISOString() }; docs.push(r); return r; };
function seed(over = {}) {
  const docs = [];
  put(docs, 'meta/init', { ts: 1, mode: 'fresh' });
  put(docs, 'org/settings', { company: 'Ace Moving', crew: ['Marcus', 'Dee'], leads: ['Marcus'], office: [{ name: 'Owner', kind: 'owner' }],
    contacts: { Owner: '512-555-0100', Marcus: '512-555-0101', Dee: '512-555-0102' }, trucks: [{ id: 't26', name: 'Box 1 (26 ft)', cf: 1700 }] });
  put(docs, 'jobs/j1', jobDoc('j1', 'Priya Nair'));
  put(docs, 'jobs/j2', jobDoc('j2', 'Lena Wu'));
  return Object.assign({ docs, access_requests: [], comm_lines: [], comm_log: [],
    members: [{ org_id: ORG, user_id: 'u-owner', email: 'o@x.com', staff: 'Owner', role: 'owner', ts: 1 },
              { org_id: ORG, user_id: 'u-marcus', email: 'm@x.com', staff: 'Marcus', role: 'lead', ts: 1 }] }, over);
}
const OWNER = { uid: 'u-owner', email: 'o@x.com' };

// the phone: pictures that open at 4000 x 3000 (after st.slow ms), drawn into a stand-in canvas; the app's bridge
function phone(st) {
  return (w) => {
    class Img { set src(v) { this._s = v; setTimeout(() => { this.width = 4000; this.height = 3000; if (this.onload) this.onload(); }, st.slow || 1); } get src() { return this._s; } }
    w.Image = Img;
    w.HTMLCanvasElement.prototype.getContext = function () { return { drawImage() {} }; };
    w.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/jpeg;base64,' + 'A'.repeat(64); };
    w.URL.createObjectURL = () => 'blob:p';
    w.URL.revokeObjectURL = () => {};
    w.TallyNative = { hasGoogle: () => false, photosFor: (s) => st.forCalls.push(JSON.parse(s)), pendingPhotos: () => '{"busy":false,"batches":[]}', photosDone: () => {} };
    w.__tallyReload = () => { st.reloads++; };
  };
}
// the page in the background and back (document.hidden, and the visibilitychange Android and browsers send)
function screen(w) {
  let hidden = false;
  Object.defineProperty(w.document, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(w.document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
  return (h) => { hidden = h; w.document.dispatchEvent(new w.Event('visibilitychange')); };
}

(async () => {
  const st = { reloads: 0, forCalls: [], slow: 0 };
  const DB = seed();
  const A = await load(FILE, { db: DB, org: ORG, me: OWNER, setup: phone(st) });
  const { $, $$, T, w } = A;
  const setHidden = screen(w);
  const toast = () => ($('#toast') && !$('#toast').hidden ? $('#toast').textContent.trim() : '');
  const job = (id) => T.state().jobs.find((j) => j.id === id);
  const photosOf = (id) => (job(id) || { photos: [] }).photos;
  const photoWrites = () => A.calls.writes.filter((x) => x.table === 'docs' && x.row && x.row.collection === 'photos');
  const rpcs = (n) => A.calls.rpc.filter((r) => r.name === n).length;
  const row = (path) => DB.docs.find((r) => r.path === path);
  // a photo picked in the phone's picker: the page's own file input gets it
  const pick = (names) => {
    const inp = $$('body > input[type="file"]').pop();
    const files = names.map((n) => new w.File(['jpeg'], n, { type: 'image/jpeg' }));
    Object.defineProperty(inp, 'files', { configurable: true, get: () => files });
    inp.dispatchEvent(new w.Event('change'));
  };
  await sleep(600);
  ok(rpcs('claim_invites') === 1 && rpcs('my_orgs') === 1 && st.reloads === 0, 'the owner is in: MoveCrew started once');

  /* ---------- the camera: away, back, the photo comes in ---------- */
  T.openJob('j1', true); await sleep(30);
  A.click('#sheet [data-act="photo"][data-kind="Pickup"]'); await sleep(20);
  ok($$('body > input[type="file"]').length >= 1 && (st.forCalls[0] || {}).job === 'j1', 'Pickup on Priya Nair’s sheet opens the picker (the app is told it is for j1)');
  setHidden(true); await sleep(20);                      // the camera is in front
  setHidden(false);                                      // back in MoveCrew…
  w.__sb.__auth('SIGNED_IN', OWNER); await sleep(30);    // …and Supabase says SIGNED_IN again, as it does every time
  ok(st.reloads === 0, 'Supabase saying SIGNED_IN again for the same person doesn’t start MoveCrew over (no reload)');
  ok(rpcs('claim_invites') === 1 && rpcs('my_orgs') === 1, 'nor does the app go through signing in again (claim_invites and my_orgs once)');
  ok(T.ui.jobId === 'j1' && !$('#sheet').hidden, 'the owner is still on Priya Nair’s job, its sheet open');
  pick(['IMG_2041.jpg']); await sleep(250);
  ok(photosOf('j1').length === 1 && photosOf('j1')[0].kind === 'Pickup', 'the photo from the camera is on the job, as a Pickup photo');
  ok(photoWrites().length === 1 && photoWrites()[0].row.data.jobId === 'j1', 'and it reaches the database (photos/<id> for j1)');
  ok(toast() === 'Pickup photo saved.', 'the owner is told “Pickup photo saved.” (' + toast() + ')');

  /* ---------- the office changes the job while the photo is being made smaller ---------- */
  st.slow = 450;
  A.click('#sheet [data-act="photo"][data-kind="Damage"]'); await sleep(20);
  pick(['IMG_2042.jpg']); await sleep(40);
  const r1 = row('jobs/j1');
  r1.data = JSON.parse(JSON.stringify(r1.data)); r1.data.d.notes = 'Gate code 4411';
  w.__sb.__fire('docs', r1); await sleep(250);             // another phone saved the job: the app takes the new copy
  ok(job('j1').d.notes === 'Gate code 4411', 'the office’s change to the job comes in meanwhile (a new copy of the job)');
  await sleep(500); st.slow = 0;
  ok(photosOf('j1').filter((p) => p.kind === 'Damage').length === 1, 'the photo still lands on the job: on the copy that’s there now');
  ok(photoWrites().some((x) => x.row.data.kind === 'Damage' && x.row.data.jobId === 'j1'), 'and reaches the database');
  ok(job('j1').d.notes === 'Gate code 4411', 'the office’s change is kept too');

  /* ---------- photos for a job that isn't in yet: they wait for it ---------- */
  T.takePhotos([new w.File(['jpeg'], 'IMG_2043.jpg', { type: 'image/jpeg' })], { job: 'j3', kind: 'Delivery' }); await sleep(700);
  ok(!job('j3'), '(the job isn’t on the phone yet)');
  const r3 = put(DB.docs, 'jobs/j3', jobDoc('j3', 'Omar Haddad')); w.__sb.__fire('docs', r3); await sleep(1100);
  ok(photosOf('j3').length === 1 && photosOf('j3')[0].kind === 'Delivery', 'once it comes in, the photo goes on it');
  T.takePhotos([new w.File(['jpeg'], 'IMG_2044.jpg', { type: 'image/jpeg' })], { job: 'gone-job', kind: 'Pickup' }); await sleep(10700);
  ok(/weren’t added: that job isn’t here any more/.test(toast()), 'a job that never comes: the person is told, not left wondering (' + toast() + ')');

  /* ---------- after a while away, the app catches up on what it missed ---------- */
  const r2 = row('jobs/j2');
  setHidden(true);
  r2.data = JSON.parse(JSON.stringify(r2.data)); r2.data.d.time = '10:30';   // changed while the live updates were off
  setHidden(false); await sleep(400);
  ok(job('j2').d.time === '08:00', 'back after a moment (the camera): nothing is fetched again');
  setHidden(true);
  const now = w.Date.now; w.Date.now = () => now() + 120e3;
  setHidden(false); w.Date.now = now; await sleep(400);
  ok(job('j2').d.time === '10:30', 'back after two minutes: the change made meanwhile is there');
  ok(st.reloads === 0 && T.ui.jobId === 'j1', 'still no restart, and the owner is where they were');

  /* ---------- someone else signs in on this device: start clean ---------- */
  w.__sb.__auth('SIGNED_IN', { uid: 'u-marcus', email: 'm@x.com' }); await sleep(30);
  ok(st.reloads === 1, 'someone else signing in on this device starts MoveCrew clean (one reload)');
  w.__sb.__auth('SIGNED_OUT', null); await sleep(30);
  w.__sb.__auth('SIGNED_IN', OWNER); await sleep(30);
  ok(st.reloads === 2, 'signed out, then in again: a clean start too');
  ok(A.errors.length === 0, 'no errors (' + A.errors.slice(0, 2).join(' | ') + ')');

  /* ---------- back from Google's sign-in page: Supabase says SIGNED_IN as well as giving the session ---------- */
  const st2 = { reloads: 0, forCalls: [], slow: 0 };
  const B = await load(FILE, { db: seed({ __signedInAtStart: true }), org: ORG, me: OWNER, setup: phone(st2) });
  await sleep(600);
  const brpcs = (n) => B.calls.rpc.filter((r) => r.name === n).length;
  ok(brpcs('claim_invites') === 1 && brpcs('my_orgs') === 1 && st2.reloads === 0, 'MoveCrew starts once, not twice (claim_invites and my_orgs once, no reload)');
  ok(B.T.state().jobs.length === 2 && B.errors.length === 0, 'and the company’s jobs are in');

  process.exit(summary('backtofront') ? 1 : 0);
})();

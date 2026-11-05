// Photos in the Android app when Android closes MoveCrew while the camera or the gallery is open (Richie, Nov 5:
// "Uploading photos is not uploading anything and it just resets the app . I need it to stay in the app and actually
// upload photos"). The app (MainActivity) makes each photo smaller before the page reads it, and when the page that
// asked is gone, keeps the batch with the job and kind the page said (TallyNative.photosFor) for the page that opens
// next: pendingPhotos → the files at /picked/<name> → photosDone. Stood in for here: TallyNative, the files, and the
// pictures themselves (jsdom opens no images and draws nothing).
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
function seed() {
  const docs = [];
  const put = (path, data) => { const [collection, doc_id] = path.split('/'); docs.push({ org_id: ORG, path, collection, doc_id, data, updated_at: new Date().toISOString() }); };
  put('meta/init', { ts: 1, mode: 'fresh' });
  put('org/settings', { company: 'Ace Moving', crew: ['Marcus', 'Dee'], leads: ['Marcus'], office: [{ name: 'Owner', kind: 'owner' }],
    contacts: { Owner: '512-555-0100', Marcus: '512-555-0101', Dee: '512-555-0102' }, trucks: [{ id: 't26', name: 'Box 1 (26 ft)', cf: 1700 }] });
  put('jobs/j1', jobDoc('j1', 'Priya Nair'));
  put('jobs/j2', jobDoc('j2', 'Lena Wu', { assign: { truckId: 't26', crew: ['Owner'] } }));
  return { docs, access_requests: [], comm_lines: [], comm_log: [],
    members: [{ org_id: ORG, user_id: 'u-owner', email: 'o@x.com', staff: 'Owner', role: 'owner', ts: 1 },
              { org_id: ORG, user_id: 'u-marcus', email: 'm@x.com', staff: 'Marcus', role: 'lead', ts: 1 }] };
}
const batch = (id, job, kind, names) => ({ id, for: { job, kind }, names, ts: Date.now() });

// the phone: the app's bridge, the files it made ready, and pictures that open at 4000 x 3000
function phone(st) {
  let W = null;
  return {
    setup(w) {
      W = w;
      class Img { set src(v) { this._s = v; setTimeout(() => { if (st.bad) { if (this.onerror) this.onerror(new Error('bad')); return; } this.width = 4000; this.height = 3000; if (this.onload) this.onload(); }, 1); } get src() { return this._s; } }
      w.Image = Img;
      w.HTMLCanvasElement.prototype.getContext = function () { return { drawImage() {} }; };
      w.HTMLCanvasElement.prototype.toDataURL = function () { st.drawn.push(this.width + 'x' + this.height); return 'data:image/jpeg;base64,' + 'A'.repeat(64); };
      w.URL.createObjectURL = () => 'blob:p' + (++st.urls);
      w.URL.revokeObjectURL = () => { st.revoked++; };
      if (st.android) w.TallyNative = {
        hasGoogle: () => false,
        photosFor: (s) => st.forCalls.push(JSON.parse(s)),
        pendingPhotos: () => { st.asked++; return JSON.stringify({ busy: st.busy, batches: st.batches }); },
        photosDone: (id) => { st.done.push(id); st.batches = st.batches.filter((b) => b.id !== id); },
      };
    },
    net: async (url) => {
      if (/^\/picked\//.test(url)) {
        st.fetched.push(url);
        const gone = st.gone.indexOf(url) >= 0;
        return { ok: !gone, status: gone ? 404 : 200, blob: async () => new W.Blob(['jpeg bytes'], { type: 'image/jpeg' }) };
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
    },
  };
}
const fresh = (over = {}) => Object.assign({ android: true, busy: false, batches: [], forCalls: [], done: [], fetched: [], gone: [], drawn: [], urls: 0, revoked: 0, asked: 0, bad: false }, over);

(async () => {
  /* ---------- the owner: MoveCrew was closed while the camera was open, and opens again ---------- */
  let st = fresh({ batches: [batch('b100', 'j1', 'Pickup', ['photo-1.jpg', 'photo-2.jpg'])] });
  let P = phone(st);
  let A = await load(FILE, { db: seed(), org: ORG, me: { uid: 'u-owner', email: 'o@x.com' }, setup: P.setup, net: P.net });
  let { $, T } = A;
  const toast = () => ($('#toast') && !$('#toast').hidden ? $('#toast').textContent : '');
  const photosOf = (id) => (T.state().jobs.find((j) => j.id === id) || { photos: [] }).photos;
  const photoWrites = (A2) => A2.calls.writes.filter((x) => x.table === 'docs' && x.row && x.row.collection === 'photos');
  await sleep(1200);
  ok(st.asked >= 1, 'at the start, the page asks the app for photos waiting for it');
  ok(st.fetched.join() === '/picked/photo-1.jpg,/picked/photo-2.jpg', 'it fetches the two files the app made ready (/picked/<name>)');
  ok(photosOf('j1').length === 2 && photosOf('j1').every((p) => p.kind === 'Pickup' && /^data:image\/jpeg/.test(p.data)), 'both go on Priya Nair’s job as Pickup photos');
  ok(st.drawn.length === 2 && st.drawn.every((s) => s === '560x420'), 'each is made into the job’s 560-pixel copy');
  ok(st.urls === 2 && st.revoked === 2, 'each picture is opened from the file (an object URL) and let go after');
  const pw = photoWrites(A);
  ok(pw.length === 2 && pw.every((x) => x.row.data.jobId === 'j1' && x.row.data.kind === 'Pickup'), 'and they reach the database (photos/<id> for job j1)');
  ok(st.done.join() === 'b100' && st.batches.length === 0, 'the page tells the app it has them (photosDone), so the app lets them go');
  ok(/restarted while the camera was open\. 2 photos saved to Priya Nair\./.test(toast()), 'the owner is told: “MoveCrew restarted while the camera was open. 2 photos saved to Priya Nair.”');
  ok(T.ui.jobId === 'j1' && !$('#sheet').hidden, 'and is shown the job, its sheet open');
  ok(/2 pickup photos added/.test(JSON.stringify(T.state().jobs.find((j) => j.id === 'j1').log)), 'the job’s activity: “2 pickup photos added”');

  /* the app was still making the next ones ready when the page asked */
  st.busy = true; st.batches = []; const asked0 = st.asked;
  T.phonePhotos(); await sleep(300);
  ok(st.asked > asked0 && photosOf('j2').length === 0, 'the app says it is still making photos ready: the page waits');
  st.busy = false; st.batches = [batch('b101', 'j2', 'Damage', ['photo-3.jpg'])];
  await sleep(1400);
  ok(photosOf('j2').length === 1 && photosOf('j2')[0].kind === 'Damage' && st.done.indexOf('b101') >= 0, 'once ready, the page takes them by itself: a Damage photo on Lena Wu');
  ok(/Damage photo saved to Lena Wu\./.test(toast()), '“… Damage photo saved to Lena Wu.”');

  /* the app hands photos over itself (window.tallyPhonePhotos), one of the files gone */
  st.batches = [batch('b102', 'j1', 'Delivery', ['photo-4.jpg', 'photo-5.jpg'])]; st.gone = ['/picked/photo-5.jpg'];
  A.w.tallyPhonePhotos(); await sleep(900);
  ok(photosOf('j1').filter((p) => p.kind === 'Delivery').length === 1 && st.done.indexOf('b102') >= 0, 'when the app says photos are ready, the page takes them; a file that’s gone is left out');

  /* none of them can be read */
  st.batches = [batch('b103', 'j1', 'Pickup', ['photo-6.jpg'])]; st.gone = []; st.bad = true;
  const n0 = photosOf('j1').length;
  A.w.tallyPhonePhotos(); await sleep(900);
  ok(photosOf('j1').length === n0 && st.done.indexOf('b103') >= 0 && /couldn’t read those photos/.test(toast()), 'pictures that can’t be opened: nothing added, the person is told, the app lets them go');
  st.bad = false;

  /* a job that isn't there any more */
  st.batches = [batch('b104', 'gone-job', 'Pickup', ['photo-7.jpg'])];
  A.w.tallyPhonePhotos(); await sleep(5200);
  ok(st.done.indexOf('b104') >= 0 && st.fetched.indexOf('/picked/photo-7.jpg') < 0 && /isn’t here any more/.test(toast()), 'photos for a job that’s gone: not fetched, the person is told, the app lets them go (a few seconds after the jobs are in)');

  /* taking photos the usual way tells the app what they are for first */
  T.openJob('j1', true); await sleep(30);
  A.click('#sheet [data-act="photo"][data-kind="Damage"]'); await sleep(20);
  const last = st.forCalls[st.forCalls.length - 1] || {};
  ok(last.job === 'j1' && last.kind === 'Damage', 'Damage on the job sheet: the app is told the photos are for j1, Damage, before the picker opens');
  const n1 = photosOf('j1').length;
  T.ui.photoJob = 'j1'; T.ui.photoKind = 'Damage';
  T.takePhotos([new A.w.File(['x'], 'IMG_1.jpg', { type: 'image/jpeg' })]); await sleep(200);
  ok(photosOf('j1').length === n1 + 1 && /^Damage photo saved\.$/.test(toast().trim()), 'a photo picked the usual way: saved, “Damage photo saved.”');
  ok(A.errors.length === 0, 'no errors for the owner (' + A.errors.slice(0, 2).join(' | ') + ')');

  /* ---------- a crew lead: shown his Jobs ---------- */
  st = fresh({ batches: [batch('b200', 'j1', 'Pickup', ['photo-8.jpg'])] }); P = phone(st);
  A = await load(FILE, { db: seed(), org: ORG, me: { uid: 'u-marcus', email: 'm@x.com' }, setup: P.setup, net: P.net });
  ({ $, T } = A);
  await sleep(1200);
  ok(photosOf('j1').length === 1 && st.done.join() === 'b200', 'Marcus’s photo from before the restart is on Priya Nair’s job');
  ok(T.ui.tab === 'crew' && /Pickup photo saved to Priya Nair\./.test(toast()), 'and he is on his Jobs, told “… Pickup photo saved to Priya Nair.”');
  T.ui.tab = 'chat'; T.render(); await sleep(20);
  st.batches = [batch('b201', 'j1', 'Delivery', ['photo-9.jpg'])];
  A.w.tallyPhonePhotos(); await sleep(900);
  ok(T.ui.tab === 'crew' && photosOf('j1').length === 2 && /Delivery photo saved to Priya Nair\./.test(toast()), 'photos that come in while he’s on Chat take him to his Jobs, where the job is');
  ok(A.errors.length === 0, 'no errors for the lead (' + A.errors.slice(0, 2).join(' | ') + ')');

  /* ---------- not the Android app: nothing asked, the picker works as before ---------- */
  st = fresh({ android: false }); P = phone(st);
  A = await load(FILE, { db: seed(), org: ORG, me: { uid: 'u-owner', email: 'o@x.com' }, setup: P.setup, net: P.net });
  ({ $, T } = A);
  await sleep(600);
  T.openJob('j1', true); await sleep(30);
  A.click('#sheet [data-act="photo"][data-kind="Pickup"]'); await sleep(20);
  ok(st.asked === 0 && st.forCalls.length === 0 && A.errors.length === 0, 'in a browser or on Windows there is no app to ask, and the picker opens as before');

  process.exit(summary('phonephotos') ? 1 : 0);
})();

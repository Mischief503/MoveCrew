// Storage inventory (batch 13e; Richie, Nov 26: "Each storage unit should be able to log items with a picture to
// inventory every item going in . Just like everything else this should be a option for every company to turn on and
// off . When you click on the storage it should open a inventory tab with pictures"). Run against either edition:
// node tests/ui/stoinv.js <file> <label>
// The hosted edition then runs again with the shared store: the items in the job's stoInv map without their pictures,
// each picture a photos/<id> document (kind Inventory), fetched on another phone when shown, and the pictures the
// Android app kept when Android closed MoveCrew with the camera open. Stood in for here: the pictures themselves
// (jsdom opens no images and draws nothing), the Android app's bridge, and the files it made ready.
const { load, ok, sleep, summary } = require('./lib');
const file = process.argv[2] || __dirname + '/../../build/tally-artifact.html', label = process.argv[3] || 'stoinv';
const L = (m) => label + ': ' + m;
const hosted = /supabase/.test(file);
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

// pictures that open at 4000 × 3000, each drawn into a 640-pixel copy of its own
function pics(st) {
  return (w) => {
    class Img { set src(v) { this._s = v; setTimeout(() => { if (st.bad) { if (this.onerror) this.onerror(new Error('bad')); return; } this.width = 4000; this.height = 3000; if (this.onload) this.onload(); }, 1); } get src() { return this._s; } }
    w.Image = Img;
    w.HTMLCanvasElement.prototype.getContext = function () { return { drawImage() {} }; };
    w.HTMLCanvasElement.prototype.toDataURL = function () { st.drawn.push(this.width + 'x' + this.height); return 'data:image/jpeg;base64,' + 'B'.repeat(48) + (++st.n); };
    w.URL.createObjectURL = () => 'blob:p' + (++st.urls);
    w.URL.revokeObjectURL = () => { st.revoked++; };
  };
}
const fresh = () => ({ drawn: [], urls: 0, revoked: 0, n: 0, bad: false });

(async () => {
  const st = fresh();
  const A = await load(file, { setup: pics(st) });
  const { w, $, $$, click, T } = A;
  const S = () => T.state().settings;
  const today = iso(new w.Date());
  const addDays = (n) => { const d = new w.Date(); d.setDate(d.getDate() + n); return iso(d); };
  const sheet = () => ($('#sheet') && !$('#sheet').hidden ? $('#sheet').textContent.replace(/\s+/g, ' ') : '');
  const view = () => $('#view').textContent.replace(/\s+/g, ' ');
  const toast = () => ($('#toast') ? $('#toast').textContent.trim() : '');
  const type = (sel, v) => { const e = typeof sel === 'string' ? $(sel) : sel; e.value = v; e.dispatchEvent(new w.Event('input', { bubbles: true })); };
  const files = (n, name) => Array.from({ length: n }, (_, i) => new w.File(['jpeg bytes'], (name || 'IMG_') + (i + 1) + '.jpg', { type: 'image/jpeg' }));
  const logs = (j) => JSON.stringify(j.log);
  // the Android app: told what the pictures are for before the picker opens (only while a test taps)
  const app = [];
  const withApp = (fn) => { w.TallyNative = { photosFor: (s) => app.push(JSON.parse(s)) }; try { fn(); } finally { delete w.TallyNative; } };
  // the picker the page opened (a file input of its own), and pictures picked in it
  const opened = (fn) => { const was = new Set($$('input[type="file"]')); fn(); return $$('input[type="file"]').find((e) => !was.has(e)); };
  const pick = async (inp, n) => { Object.defineProperty(inp, 'files', { value: files(n), configurable: true }); inp.dispatchEvent(new w.Event('change', { bubbles: true })); await sleep(40 + n * 15); };

  /* ---------------- on to start; a customer in storage ---------------- */
  ok(T.siOn(), L('Options › Storage inventory: on to start'));
  const a = T.stoNewAcct({ name: 'Lena Wu', phone: '5035550142', email: '', vaults: ['v3', 'v4'], start: addDays(-20) }, 'Owner');
  ok(T.siCan(a) && !T.siMove(a) && T.siUnits(a).join() === 'v3,v4' && T.siAll(a).length === 0 && T.siNextN(a) === 1, L('a storage account: its units, nothing in it yet, the first item #1'));

  /* ---------------- Storage: a unit opens what's in it ---------------- */
  T.ui.tab = 'storage'; T.render(); await sleep(10);
  const tile = (u) => $('#view [data-act="sto:unit"][data-u="' + u + '"]');
  ok(tile('v3') && tile('v4') && tile('v3').dataset.id === a.id && $$('#view [data-act="sto:unit"]').length === 2 && /^Unit #3, .*: Lena Wu, .*, 0 items in it$/.test(tile('v3').getAttribute('aria-label')),
    L('Storage: her two units open her inventory, and say what’s in each: ' + (tile('v3') ? tile('v3').getAttribute('aria-label') : 'none')));
  ok(/Tap a taken one for what’s in it, with pictures, and the customer’s account\./.test(view()), L('and the screen says so'));
  click(tile('v3')); await sleep(15);
  const tabs = () => $$('#sheet .sitabs [role="tab"]');
  ok(T.ui.jobId === a.id && T.ui.stoTab === 'inv' && tabs().length === 2 && tabs()[0].getAttribute('aria-selected') === 'true' && tabs()[0].textContent.trim() === 'Inventory' && tabs()[1].textContent.trim() === 'Account',
    L('Unit #3 tapped: her account opens on its Inventory tab'));
  ok($('#sheet [data-act="si:add"][data-u="v3"]') && /Add items to Unit #3/.test(sheet()) && $('#sheet [data-act="si:bare"][data-u="v3"]') && !$('#sheet [data-act="si:to"]') && /Nothing taken yet\./.test(sheet()),
    L('on Unit #3: Add items to Unit #3, or No picture; nothing taken yet'));
  ok($$('#sheet [data-act="si:f"]').map((e) => e.dataset.f).join() === 'all,v3,v4' && $('#sheet [data-act="si:f"][data-f="v3"]').getAttribute('aria-pressed') === 'true', L('her units as chips, Unit #3 picked'));
  click('#sheet [data-act="si:tab"][data-t="acct"]'); await sleep(10);
  ok(T.ui.stoTab === 'acct' && !$('#sheet .siwrap') && /Storage account/.test(sheet()) && tabs()[1].getAttribute('aria-selected') === 'true', L('Account: the account as before'));
  click('#sheet [data-act="si:tab"][data-t="inv"]'); await sleep(10);
  ok($('#sheet .siwrap') && T.ui.siF[a.id] === 'v3', L('back to Inventory, still on Unit #3'));
  T.openJob(a.id); await sleep(5);
  ok(T.ui.stoTab === 'inv', L('the same account again: the same tab'));

  /* ---------------- a picture of each thing ---------------- */
  let inp = opened(() => withApp(() => click('#sheet [data-act="si:add"][data-u="v3"]')));
  ok(inp && inp.multiple && inp.accept === 'image/*' && app.length === 1 && app[0].job === a.id && app[0].kind === 'Inventory' && app[0].unit === 'v3' && app[0].item === '',
    L('Add items: the camera or the phone’s pictures, several at once; the Android app is told they’re for her inventory, Unit #3'));
  await pick(inp, 3);
  const items = (j) => T.siAll(j || a).map((r) => r.x);
  ok(items().length === 3 && items().map((x) => x.n).join() === '1,2,3' && items().every((x) => x.unit === 'v3' && /^data:image\/jpeg/.test(x.data) && x.ph && x.by && !x.name),
    L('three pictures: items #1, #2 and #3 in Unit #3, each with its picture'));
  ok(st.drawn.length === 3 && st.drawn.every((s) => s === '640x480') && st.revoked === st.urls && st.urls === 3, L('each made into a 640-pixel copy, the file let go after'));
  const who = items()[0].by;
  ok(logs(a).indexOf('3 items taken for storage in Unit #3 (' + who + ')') >= 0, L('her activity: “3 items taken for storage in Unit #3 (' + who + ')”'));
  ok(toast() === '3 items added to Unit #3. Tap one to say what it is.', L('“3 items added to Unit #3. Tap one to say what it is.”'));
  ok($$('#sheet .sigrid .siit').length === 3 && $$('#sheet .siit .siph img').length === 3 && /Not named yet/.test(sheet()) && tabs()[0].textContent.trim() === 'Inventory · 3' && /3 items in storage: Unit #3 3, Unit #4 0\./.test(sheet()),
    L('the pictures, Inventory · 3, and what’s in each unit'));
  await sleep(10);
  ok(!inp.parentNode, L('the picker is taken off the page after'));

  /* one picture: opened to say what it is */
  T.siTake(files(1, 'sofa'), { job: a.id, unit: 'v4' }); await sleep(60);
  const x4 = items().find((x) => x.n === 4);
  ok(x4 && x4.unit === 'v4' && toast() === 'Item #4 added. Say what it is below.' && $('#sheet #siEdit') && $('#sheet #siName') && /Item #4 · Unit #4/.test($('#siEdit').textContent),
    L('one picture: item #4 in Unit #4, opened to say what it is'));
  ok($('#siEdit .sibig img') && $('#siEdit .sibig img').getAttribute('src') === x4.data && /Take it again/.test($('#siEdit').textContent) && $('#siEdit').textContent.indexOf('Taken by ' + who) >= 0,
    L('its picture large, Take it again, and who took it when'));
  type('#siName', 'Sofa, 3 seat'); type('#siNote', 'Small scratch on the left arm');
  click('#sheet [data-act="si:save"]'); await sleep(10);
  ok(x4.name === 'Sofa, 3 seat' && x4.note === 'Small scratch on the left arm' && !$('#siEdit') && toast() === '#4 Sofa, 3 seat saved.', L('what it is and a note, saved: “#4 Sofa, 3 seat saved.”'));
  click('#sheet [data-act="si:f"][data-f="all"]'); await sleep(10);
  ok($$('#sheet .siit').length === 4 && /#4 Sofa, 3 seat/.test(sheet()) && $$('#sheet [data-act="si:to"]').map((e) => e.dataset.u + ':' + e.getAttribute('aria-pressed')).join() === 'v3:true,v4:false' && /Add items to Unit #3/.test(sheet()),
    L('All: the four, and which unit new ones go into (Unit #3, or Unit #4)'));

  /* a picture tapped: its unit, taken out and back */
  const x1 = items().find((x) => x.n === 1);
  click('#sheet [data-act="si:open"][data-i="' + x1.id + '"]'); await sleep(10);
  ok($('#siEdit') && /Item #1 · Unit #3/.test($('#siEdit').textContent) && $$('#siEdit [data-act="si:unit"]').length === 2, L('a picture tapped: item #1 open, its unit to change'));
  click('#siEdit [data-act="si:unit"][data-u="v4"]'); await sleep(10);
  ok(x1.unit === 'v4' && /Item #1 · Unit #4/.test($('#siEdit').textContent) && /4 items in storage: Unit #3 2, Unit #4 2\./.test(sheet()), L('moved to Unit #4: Unit #3 2, Unit #4 2'));
  click('#siEdit [data-act="si:out"]'); await sleep(10);
  ok(x1.out === today && x1.outBy === who && toast() === 'Item #1 is marked as taken out.' && logs(a).indexOf('Item #1 taken out of storage (' + who + ')') >= 0 && /3 items in storage: Unit #3 2, Unit #4 1\. 1 taken out\./.test(sheet()),
    L('Taken out: marked with the day, in her activity; 3 in storage, 1 taken out'));
  click('#sheet [data-act="si:f"][data-f="out"]'); await sleep(10);
  ok($$('#sheet .siit').length === 1 && $('#sheet .siit.out') && /^Out /.test($('#sheet .siit.out small').textContent), L('Taken out: item #1, its picture grey, the day it went out'));
  click('#sheet [data-act="si:open"][data-i="' + x1.id + '"]'); await sleep(10);
  ok(/out of storage /.test($('#siEdit').textContent) && $('#siEdit [data-act="si:out"]').textContent.trim() === 'Back in storage', L('open: when it went out, and Back in storage'));
  click('#siEdit [data-act="si:out"]'); await sleep(10);
  ok(!x1.out && !x1.outBy && toast() === 'Item #1 is back in storage.' && $('#sheet [data-act="si:f"][data-f="all"]').getAttribute('aria-pressed') === 'true' && !$('#sheet [data-act="si:f"][data-f="out"]'),
    L('back in storage: none out, so it shows them all'));

  /* removed, with a second tap */
  click('#sheet [data-act="si:open"][data-i="' + x4.id + '"]'); await sleep(10);
  click('#siEdit [data-act="si:rm"]'); await sleep(10);
  ok(items().length === 4 && $('#siEdit [data-act="si:rm"]').textContent.trim() === 'Tap again to remove it', L('Remove: “Tap again to remove it”'));
  click('#siEdit [data-act="si:rm"]'); await sleep(10);
  ok(items().length === 3 && !items().some((x) => x.id === x4.id) && !$('#siEdit') && toast() === '#4 Sofa, 3 seat removed.' && logs(a).indexOf('Removed #4 Sofa, 3 seat from the storage inventory (' + who + ')') >= 0,
    L('tapped again: “#4 Sofa, 3 seat removed.”, in her activity'));

  /* no picture now, one later */
  click('#sheet [data-act="si:to"][data-u="v4"]'); await sleep(10);
  ok(/Add items to Unit #4/.test(sheet()) && $('#sheet [data-act="si:to"][data-u="v4"]').getAttribute('aria-pressed') === 'true', L('into Unit #4'));
  click('#sheet [data-act="si:bare"]'); await sleep(10);
  const xb = items().find((x) => !x.ph);
  ok(xb && xb.unit === 'v4' && xb.n === 4 && $('#siEdit') && /No picture yet/.test($('#siEdit').textContent) && /Add a picture/.test($('#siEdit').textContent) && logs(a).indexOf('Item #4 taken for storage in Unit #4, no picture (' + who + ')') >= 0,
    L('No picture: item #4 (the next number) to say what it is, its picture later'));
  inp = opened(() => withApp(() => click('#siEdit [data-act="si:pic"]')));
  const ap = app[app.length - 1];
  ok(inp && !inp.multiple && ap.job === a.id && ap.kind === 'Inventory' && ap.unit === 'v4' && ap.item === xb.id, L('Add a picture: one picture, for that item'));
  await pick(inp, 1);
  ok(xb.ph && /^data:image\/jpeg/.test(xb.data) && items().length === 4 && toast() === 'Picture saved.' && $('#siEdit .sibig img'), L('its picture in, no new item: “Picture saved.”'));
  const ph0 = xb.ph, d0 = xb.data;
  T.siTake(files(1), { job: a.id, item: xb.id }); await sleep(40);
  ok(xb.ph && xb.ph !== ph0 && xb.data !== d0 && items().length === 4, L('Take it again: a new picture in its place'));
  click('#siEdit [data-act="si:close"]'); await sleep(5);
  ok(!$('#siEdit'), L('Close'));

  /* ---------------- a move into storage: the crew takes the pictures ---------------- */
  const WH = '900 Industrial Way, Portland, OR'; S().sto.addr = WH;
  const M = T.newJob(Object.assign(T.blankDraft(), { name: 'Rosa Diaz', moveDate: today, time: '08:00', from: '418 Oak St, Portland, OR', to: WH, toSto: true, items: { sofa3: 1, boxm: 20 }, stoPlan: { units: ['v6', 'v7'], prices: { v6: 150, v7: 150 }, hand: true } }), S(), 'booked');
  M.id = 'rosa1'; M.assign.crew = ['Marcus', 'Dee']; T.state().jobs.push(M);
  ok(T.siMove(M) && T.siCan(M) && T.siUnits(M).join() === 'v6,v7' && T.siNextN(M) === 1, L('a move into storage: an inventory of its own, into the units picked for it'));
  T.openJob(M.id); await sleep(10);
  ok(/Storage inventory/.test(sheet()) && !$('#sheet .sitabs') && $('#sheet [data-act="si:add"][data-u="v6"]') && $$('#sheet [data-act="si:to"]').length === 2, L('its job sheet: Storage inventory, Add items to Unit #6 (or Unit #7)'));
  T.siTake(files(2), { job: M.id, unit: 'v6' }); await sleep(60);
  ok(items(M).map((x) => x.n).join() === '1,2' && M.stoInv.every((x) => x.unit === 'v6') && /2 items for storage: Unit #6 2, Unit #7 0\./.test(sheet()), L('two pictures on the move: #1 and #2 in Unit #6, “2 items for storage”'));
  click('#sheet [data-act="sheet:close"]'); await sleep(10);
  T.state().ui.role = 'lead'; T.state().ui.me = 'Marcus'; T.ui.tab = 'crew'; T.render(); await sleep(10);
  const cc = () => $('#view .crewcard[data-job="' + M.id + '"] details.cc-si');
  ok(cc() && /Storage inventory/.test(cc().querySelector('summary').textContent) && /2 items/.test(cc().querySelector('summary').textContent) && !cc().open, L('the crew’s card: Storage inventory, 2 items, folded'));
  T.ui.open['si:' + M.id] = true; T.render(); await sleep(5);
  ok(cc().open && cc().querySelectorAll('.siit').length === 2 && !cc().querySelector('[data-act="job:open"]'), L('opened: the two pictures (and no way into the account, which the crew can’t open)'));
  inp = opened(() => withApp(() => click(cc().querySelector('[data-act="si:add"]'))));
  ok(inp && app[app.length - 1].job === M.id && app[app.length - 1].kind === 'Inventory' && app[app.length - 1].unit === 'v6', L('the crew’s Add items: the camera, for the move, Unit #6'));
  await pick(inp, 1);
  const xm = items(M).find((x) => x.n === 3);
  ok(xm && xm.by === 'Marcus' && xm.unit === 'v6' && cc() && cc().querySelector('#siEdit') && /Item #3/.test(cc().querySelector('#siEdit').textContent), L('item #3, by Marcus, opened on his card'));
  type('#siName', 'Dresser'); click(cc().querySelector('[data-act="si:save"]')); await sleep(10);
  ok(xm.name === 'Dresser' && toast() === '#3 Dresser saved.' && !$('#view #siEdit') && /Dresser/.test(cc().textContent), L('named on his card: “#3 Dresser saved.”'));
  T.state().ui.role = 'owner'; T.ui.tab = 'jobs'; T.render(); await sleep(5);

  /* ---------------- done: into storage, with what the crew took ---------------- */
  T.setStatus(M, 'done'); M.finishedAt = Date.now(); T.stoSweep();
  const acc = T.state().jobs.find((j) => j.id === 'si' + M.id);
  ok(acc && acc.d.sto.from === M.id && M.d.stoIn && M.d.stoIn.id === acc.id && (M.d.stoIn.units || []).join() === 'v6,v7', L('done: her storage account opens, and the move knows its units'));
  ok(items(acc).map((x) => x.n).join() === '1,2,3' && T.siAll(acc).every((r) => r.j === M) && T.siNextN(acc) === 4 && T.siNextN(M) === 4, L('the account’s inventory: the three from the move; the next is #4, from either'));
  T.siTake(files(1), { job: acc.id, unit: 'v7' }); await sleep(40);
  ok(acc.stoInv.length === 1 && acc.stoInv[0].n === 4 && T.siAll(acc).length === 4 && T.siAll(M).length === 3, L('one more at the warehouse: #4, on the account'));
  T.ui.tab = 'storage'; T.render(); await sleep(10);
  ok(/, 3 items in it$/.test(tile('v6').getAttribute('aria-label')) && /, 1 item in it$/.test(tile('v7').getAttribute('aria-label')) && /Rosa Diaz[^]*· 4 items/.test(view()),
    L('Storage: Unit #6 3 items, Unit #7 1; her account says 4 items'));
  click(tile('v6')); await sleep(15);
  ok(T.ui.jobId === acc.id && T.ui.stoTab === 'inv' && $$('#sheet .siit').length === 3 && /Dresser/.test(sheet()), L('Unit #6: the three pictures the crew took'));
  click('#sheet [data-act="si:open"][data-i="' + xm.id + '"]'); await sleep(10);
  ok(/· on the move on /.test($('#siEdit').textContent) && /Taken by Marcus/.test($('#siEdit').textContent) && $('#siName').value === 'Dresser', L('one of them: taken by Marcus, on the move'));
  click('#siEdit [data-act="si:close"]'); await sleep(5);
  T.openJob(M.id); await sleep(10);
  ok($('#sheet [data-act="job:open"][data-id="' + acc.id + '"]') && /The whole inventory is on the storage account\./.test(sheet()), L('the move’s sheet: the whole inventory is on the account, Open it'));

  /* ---------------- out of storage: what was in it ---------------- */
  T.stoClose(a, today, 'closed in a test'); T.ui.stoTabNext = 'inv'; T.openJob(a.id); await sleep(10);
  ok(/Out of storage .*\. This is what was in it\./.test(sheet()) && !$('#sheet [data-act="si:add"]') && $$('#sheet .siit').length === 4, L('her account closed: what was in it, nothing more to add'));

  /* ---------------- kept with the job ---------------- */
  const doc = T.jobDoc(a);
  ok(doc.stoInv && Object.keys(doc.stoInv).length === 4 && Object.values(doc.stoInv).every((x) => !('data' in x) && x.n) && T.docToJob2(doc).stoInv.length === 4 && x1.data, L('saved as a map without the pictures (they’re kept on their own), and read back'));
  ok(!('stoInv' in T.jobDoc(T.state().jobs.find((j) => !j.stoInv))), L('a job with no inventory saves none'));

  /* ---------------- switched off ---------------- */
  S().opt.stoInv = false; T.ui.tab = 'storage'; T.render(); await sleep(10);
  ok(!$('#view [data-act="sto:unit"]') && $('#view .vt[data-act="job:open"][data-id="' + acc.id + '"]') && !/what’s in it/.test(view()) && !/· 4 items/.test(view()), L('Options › Storage inventory off: a unit opens the account as before'));
  T.openJob(acc.id); await sleep(10);
  ok(!$('#sheet .sitabs') && !$('#sheet .siwrap') && /Storage account/.test(sheet()), L('no Inventory tab'));
  T.openJob(M.id); await sleep(10);
  ok(!/Storage inventory/.test(sheet()) && !$('#sheet .siwrap'), L('nothing on the move'));
  ok(T.siAll(acc).length === 4 && a.stoInv.length === 4 && !T.siCan(M), L('and what was taken is kept'));
  S().opt.stoInv = true; S().opt.storage = false;
  ok(!T.siOn(), L('Options › Storage off: no inventory either'));
  S().opt.storage = true;
  ok(!A.errors.length, L('no errors: ' + A.errors.join(' | ')));

  if (hosted) await shared();
  process.exit(summary(label) ? 1 : 0);
})();

/* ---------------- the shared store ---------------- */
async function shared() {
  const ORG = 'org-1';
  const day = (n) => iso(new Date(Date.now() + n * 864e5));
  const docs = [], put = (path, data) => { const [collection, doc_id] = path.split('/'); docs.push({ org_id: ORG, path, collection, doc_id, data, updated_at: new Date().toISOString() }); };
  put('meta/init', { ts: 1, mode: 'fresh' });
  put('org/settings', { company: 'Ace Moving', crew: ['Marcus', 'Dee'], leads: ['Marcus'], office: [{ name: 'Owner', kind: 'owner' }],
    contacts: { Owner: '512-555-0100', Marcus: '512-555-0101', Dee: '512-555-0102' }, trucks: [{ id: 't26', name: 'Box 1 (26 ft)', cf: 1700 }] });
  const db = { docs, access_requests: [], comm_lines: [], comm_log: [],
    members: [{ org_id: ORG, user_id: 'u-owner', email: 'o@x.com', staff: 'Owner', role: 'owner', ts: 1 }] };
  // the phone: pictures, and the Android app with the files it made ready (/picked/<name>)
  const st = Object.assign(fresh(), { batches: [], done: [], fetched: [] });
  let W = null;
  const setup = (w) => {
    W = w; pics(st)(w);
    w.TallyNative = { hasGoogle: () => false, photosFor: () => {}, pendingPhotos: () => JSON.stringify({ busy: false, batches: st.batches }),
      photosDone: (id) => { st.done.push(id); st.batches = st.batches.filter((b) => b.id !== id); } };
  };
  const net = async (url) => {
    if (/^\/picked\//.test(url)) { st.fetched.push(url); return { ok: true, status: 200, blob: async () => new W.Blob(['jpeg bytes'], { type: 'image/jpeg' }) }; }
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
  };
  const A = await load(file, { db, org: ORG, me: { uid: 'u-owner', email: 'o@x.com' }, setup, net });
  const { $, click, T } = A;
  await sleep(900);
  const toast = () => ($('#toast') && !$('#toast').hidden ? $('#toast').textContent.trim() : '');
  const files = (n) => Array.from({ length: n }, (_, i) => new W.File(['x'], 'IMG_' + (i + 1) + '.jpg', { type: 'image/jpeg' }));
  const row = (p) => db.docs.find((r) => r.org_id === ORG && r.path === p);
  const made = T.stoNewAcct({ name: 'Lena Wu', phone: '5035550142', email: '', vaults: ['v3', 'v4'], start: day(-20) }, 'Owner');
  const aid = made.id, acct = () => T.state().jobs.find((j) => j.id === aid), mine = () => acct().stoInv || [];
  T.save(); await sleep(400);
  T.siTake(files(2), { job: aid, unit: 'v3' }); await sleep(700);
  const inv = row('jobs/' + aid) && row('jobs/' + aid).data.stoInv;
  ok(inv && Object.keys(inv).length === 2 && Object.values(inv).every((x) => x && x.ph && x.unit === 'v3' && !('data' in x)), L('shared: her items in the job’s stoInv map, without their pictures'));
  ok(mine().length === 2 && mine().every((x) => { const r = row('photos/' + x.ph); return r && r.data.kind === 'Inventory' && r.data.jobId === aid && r.data.id === x.ph && /^data:image\/jpeg/.test(r.data.data); }),
    L('each picture a photos/<id> document of its own, kind Inventory'));

  /* removed: its picture goes too */
  T.ui.stoTabNext = 'inv'; T.openJob(aid); await sleep(20);
  const x0 = mine()[0], ph0 = x0.ph;
  click('#sheet [data-act="si:open"][data-i="' + x0.id + '"]'); await sleep(10);
  click('#siEdit [data-act="si:rm"]'); await sleep(10); click('#siEdit [data-act="si:rm"]'); await sleep(700);
  ok(mine().length === 1 && !row('photos/' + ph0) && row('photos/' + mine()[0].ph) && !(x0.id in row('jobs/' + aid).data.stoInv), L('removed: gone from the map, and its picture from the shared store'));
  /* taken again: the new picture in, the old one gone */
  const x1 = mine()[0], old = x1.ph;
  T.siTake(files(1), { job: aid, item: x1.id }); await sleep(700);
  const nx = mine()[0];
  ok(nx.ph !== old && !row('photos/' + old) && row('photos/' + nx.ph) && row('jobs/' + aid).data.stoInv[x1.id].ph === nx.ph, L('taken again: the new picture in, the old one gone'));
  ok(!A.errors.length, L('shared: no errors (' + A.errors.slice(0, 2).join(' | ') + ')'));

  /* another phone: the item, its picture fetched when it's shown, not sent back up */
  const B = await load(file, { db, org: ORG, me: { uid: 'u-owner', email: 'o@x.com' }, setup: pics(fresh()) });
  await sleep(900);
  const bj = () => B.T.state().jobs.find((j) => j.id === aid);
  ok(bj() && bj().stoInv.length === 1 && bj().stoInv[0].ph === nx.ph && !bj().stoInv[0].data, L('another phone: the item, its picture not fetched yet'));
  B.T.ui.stoTabNext = 'inv'; B.T.openJob(aid); await sleep(500);
  ok(/^data:image\/jpeg/.test(bj().stoInv[0].data || '') && B.$('#sheet .siit .siph img'), L('her Inventory open there: the picture fetched, and shown'));
  await sleep(400);
  ok(!B.calls.writes.some((x) => x.table === 'docs' && x.row && x.row.collection === 'photos'), L('and not sent back up'));
  ok(!B.errors.length, L('the other phone: no errors (' + B.errors.slice(0, 2).join(' | ') + ')'));

  /* the Android app kept pictures when Android closed MoveCrew with the camera open */
  st.batches = [{ id: 'b300', for: { job: aid, kind: 'Inventory', unit: 'v4', item: '' }, names: ['photo-1.jpg', 'photo-2.jpg'], ts: Date.now() }];
  click('#sheet [data-act="sheet:close"]'); await sleep(10);
  A.w.tallyPhonePhotos(); await sleep(1200);
  ok(st.fetched.join() === '/picked/photo-1.jpg,/picked/photo-2.jpg' && mine().filter((x) => x.unit === 'v4').length === 2 && st.done.indexOf('b300') >= 0,
    L('pictures the app kept: two items in Unit #4, and the app lets them go'));
  ok(/^MoveCrew restarted while the camera was open\. 2 items saved to the storage inventory for Lena Wu\.$/.test(toast()), L('“… 2 items saved to the storage inventory for Lena Wu.”'));
  ok(T.ui.jobId === aid && T.ui.stoTab === 'inv', L('and her account is open, on Inventory'));
  await sleep(600);
  ok(mine().filter((x) => x.unit === 'v4').every((x) => row('photos/' + x.ph)), L('their pictures in the shared store too'));
  ok(!A.errors.length, L('shared, at the end: no errors (' + A.errors.slice(0, 2).join(' | ') + ')'));
}

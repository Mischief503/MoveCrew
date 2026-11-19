// A real walk-through video call (Sales, batch 7, Nov 19; Richie: "The walk through videos should be saved to the crew
// notes so they can veiw it and see what they are in for"), in a real browser: two Chromium pages with the browser's
// stand-in camera and microphone. The office starts the call from a lead in Sales; the customer opens walk.html from the
// link and joins; the two connect straight to each other (WebRTC); MoveCrew records the customer's camera with both
// voices, saves it as a video file when the call ends, and puts it on the job, where the office and the crew on the job
// watch it. The Edge Function's walk actions are played by a small server here (the real one has its own tests in
// tests/function/walk.ts), and the hosted app runs against the tests' stand-in Supabase (lib.js).
// Run: node tests/ui/walkcall.js   (SHOTS=<folder> also saves screenshots; WALK_Y4M=<file> uses that video as the camera)
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('playwright-core')); }
const fs = require('fs'), path = require('path'), http = require('http'), { execFileSync } = require('child_process');
const lib = fs.readFileSync(__dirname + '/lib.js', 'utf8');
const SB = lib.slice(lib.indexOf('function deepFreeze'), lib.indexOf('async function load('));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + 'walkcall: ' + m); };
const SHOTS = process.env.SHOTS || '';
const shot = async (p, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, name + '.png') }); } };

/* ---------- the company: an owner (Ana), a crew lead (Marcus), and Sam's quote ---------- */
const ORG = 'org-1', day = (n) => { const d = new Date(Date.now() + n * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function seed() {
  const docs = [], put = (p, data) => { const [c, id] = p.split('/'); docs.push({ org_id: ORG, path: p, collection: c, doc_id: id, data, updated_at: new Date().toISOString() }); };
  put('meta/init', { ts: 1, mode: 'fresh' });
  put('org/settings', { company: 'Ace Moving', crew: ['Marcus', 'Dee'], leads: ['Marcus'], office: [{ name: 'Ana', kind: 'owner' }],
    contacts: { Ana: '512-555-0100', Marcus: '512-555-0101', Dee: '512-555-0102' }, trucks: [{ id: 't26', name: 'Box 1 (26 ft)', cf: 1700 }], forms: [], comms: { ring: ['Ana'] } });
  put('jobs/q1', { id: 'q1', status: 'quoted', createdAt: Date.now() - 36e5, createdBy: 'Ana', d: { name: 'Sam Kowalski', phone: '512-555-0120', email: 'sam@example.com', moveDate: day(6), time: '09:00', from: '418 Oak St, Austin', to: '77 Ridge Rd, Round Rock', items: [], custom: {} },
    quote: { total: 1065, cf: 640, crew: 3, hours: 5, lines: [{ label: '3 movers, 5 hr', amt: 1065 }], deposit: 200, nte: 0, kind: 'local' }, items: [], assign: { truckId: '', crew: [] }, tally: {},
    payments: {}, signed: {}, extras: {}, crewNotes: {}, photos: {}, materials: {}, costs: {}, log: {}, confirm: {}, sales: { owner: 'Ana', ownerAt: Date.now() - 36e5 } });
  return { docs, comm_log: [], comm_lines: [], __orgNames: { [ORG]: 'Ace Moving' },
    members: [{ org_id: ORG, user_id: 'u-ana', email: 'ana@x.com', staff: 'Ana', role: 'owner', ts: 1 }, { org_id: ORG, user_id: 'u-marcus', email: 'marcus@x.com', staff: 'Marcus', role: 'lead', ts: 1 }],
    access_requests: [], employees: [] };
}

/* ---------- the stand-in for the Edge Function's walk actions (and its storage), like the real one ---------- */
const rooms = {}, files = {}, saved = {}, seen = [], custTypes = {};
let base = '';
// the project's address, as on the website (the app only talks to an https one); its requests come here (proj below)
const PROJ = 'https://proj.supabase.co';
function walkParse(w) { const m = /^([A-Za-z0-9-]{1,40})\.([A-Za-z0-9_-]{1,40})\.([A-Za-z0-9_-]{12,40})$/.exec(String(w || '')); return m ? { org: m[1], jobId: m[2], room: m[3] } : null; }
const fresh = (t, ms) => t > 0 && Date.now() - t < (ms || 9000);
function app(b) {
  seen.push(b.action);
  const r = rooms[b.jobId];
  switch (b.action) {
    case 'walk_open': {
      const same = r && r.room === b.room;
      rooms[b.jobId] = Object.assign({ cust: same ? r.cust : 0, offerSeq: same ? r.offerSeq : 0 }, { room: b.room, host: Date.now(), offer: null, answer: null, answerSeq: 0, ended: false });
      return { ok: true, ice: [], space: { ok: true, mins: 180 }, here: same && fresh(r.cust), seq: same ? r.offerSeq : 0 };
    }
    case 'walk_poll': if (!r || r.room !== b.room) return { ok: false, gone: true, message: 'gone' };
      r.host = Date.now(); return { ok: true, here: fresh(r.cust), seq: r.offerSeq, answer: r.answer && r.answerSeq === r.offerSeq ? { seq: r.offerSeq, type: 'answer', sdp: r.answer } : null };
    case 'walk_offer': if (!r || r.room !== b.room) return { ok: false, gone: true };
      if (!(b.seq > r.offerSeq)) return { ok: false, seq: r.offerSeq, message: 'out of date' };
      r.offer = b.sdp; r.offerSeq = b.seq; r.answer = null; return { ok: true, seq: b.seq };
    case 'walk_end': if (r) { r.ended = true; r.offer = null; r.answer = null; r.endBody = b; }
      return b.done ? dbJob(b.jobId, { done: b.room }).then(() => ({ ok: true })) : { ok: true };
    case 'walk_part': { const ext = b.type === 'video/mp4' ? 'mp4' : 'webm', p = ORG + '/' + b.jobId + '/' + b.call + '-' + b.part + '.' + ext; return { ok: true, path: p, url: PROJ + '/upload/' + p + '?token=t1' }; }
    case 'walk_saved': { const ext = b.type === 'video/mp4' ? 'mp4' : 'webm', p = ORG + '/' + b.jobId + '/' + b.call + '-' + b.part + '.' + ext;
      if (!files[p]) return { ok: false, message: 'That video part isn’t in storage. Save it again.' };
      const v = { id: b.call + '-' + b.part, call: b.call, part: b.part, path: p, at: b.at, secs: b.secs, bytes: files[p].length, type: b.type, by: 'Ana' };
      saved[v.id] = v; return dbJob(b.jobId, { vid: v }).then(() => ({ ok: true, video: v })); }
    case 'walk_watch': { const v = Object.values(saved).find((x) => x.id === b.id); return v ? { ok: true, url: PROJ + '/vid/' + v.path, until: Date.now() + 3 * 36e5 } : { ok: false, message: 'That video isn’t here any more.' }; }
    case 'member_status': return { ok: true, admin: false, test: false, state: 'active', payments: true };
    case 'pay_config': return { ok: true, ready: false, test: true, publishableKey: '', reason: 'connect', connect: { state: 'none', due: [] } };
    default: return { ok: true, sent: 0 };
  }
}
// the job in the app's database (the stand-in Supabase in the office's page), changed the way the server's jobWrite does
let hostPage = null;
function dbJob(id, ch) {
  if (!hostPage) return Promise.resolve();
  return hostPage.evaluate(([id, ch]) => { const db = window.__db, i = db.docs.findIndex((r) => r.path === 'jobs/' + id); if (i < 0) return;
    const d = JSON.parse(JSON.stringify(db.docs[i].data));
    if (ch.vid) d.walkVids = Object.assign({}, d.walkVids || {}, { [ch.vid.id]: ch.vid });
    if (ch.done && d.survey && d.survey.room === ch.done) d.survey = Object.assign({}, d.survey, { done: Date.now() });
    db.docs[i] = Object.assign({}, db.docs[i], { data: d, updated_at: new Date().toISOString() }); }, [id, ch]);
}
function walk(b) {
  const c = walkParse(b.w), r = c && rooms[c.jobId];
  if (!c || !r || r.room !== c.room) return { ok: false, message: 'This walk-through link isn’t working any more. Call or text your mover for a new one.' };
  if (b.action === 'join') { r.cust = Date.now(); return { ok: true, company: 'Ace Moving', first: 'Sam', host: 'Ana', at: Date.now(), over: r.ended, ice: [], live: fresh(r.host, 15000), seq: r.offerSeq }; }
  if (b.action === 'poll') { r.cust = Date.now(); return { ok: true, offer: r.offer && r.offerSeq > (b.seen || 0) && !r.ended ? { seq: r.offerSeq, type: 'offer', sdp: r.offer } : null, over: r.ended, ended: r.ended, live: fresh(r.host, 15000) }; }
  if (b.action === 'answer') { if (b.seq !== r.offerSeq) return { ok: false, stale: true }; r.answer = b.sdp; r.answerSeq = b.seq; r.cust = Date.now(); return { ok: true }; }
  if (b.action === 'bye') { r.cust = 0; return { ok: true }; }
  return { ok: false };
}
// the file part of the upload (FormData: cacheControl, then the file under an empty name)
function filePart(buf, type) {
  const m = /boundary=(.+)$/.exec(type || ''); if (!m) return buf;
  const bnd = Buffer.from('--' + m[1]), parts = [];
  let i = buf.indexOf(bnd);
  while (i >= 0) { const j = buf.indexOf(bnd, i + bnd.length); if (j < 0) break; parts.push(buf.slice(i + bnd.length, j)); i = j; }
  const f = parts.find((p) => /filename=/.test(p.slice(0, 400).toString())) || parts[parts.length - 1];
  const h = f.indexOf('\r\n\r\n');
  return { head: f.slice(0, h).toString(), body: f.slice(h + 4, f.length - 2) };
}
const HOSTED = fs.readFileSync(__dirname + '/../../build/tally-supabase.html', 'utf8'), WALKHTML = fs.readFileSync(__dirname + '/../../web/walk.html', 'utf8');
const server = http.createServer((req, res) => {
  const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => {
    const buf = Buffer.concat(chunks), u = new URL(req.url, base);
    const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (u.pathname === '/app.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(HOSTED.replace('PASTE_YOUR_PROJECT_URL', PROJ).replace('PASTE_YOUR_ANON_PUBLIC_KEY', 'anon')); return; }
    if (u.pathname === '/walk.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(WALKHTML.replace('PASTE_YOUR_PROJECT_URL', PROJ)); return; }
    if (u.pathname === '/functions/v1/tally-twilio/app' && req.method === 'POST') { Promise.resolve(app(JSON.parse(buf.toString() || '{}'))).then(json, (e) => json({ ok: false, message: String(e) })); return; }
    if (u.pathname === '/functions/v1/tally-twilio/walk' && req.method === 'POST') { custTypes[req.headers['content-type'] || ''] = 1; return json(walk(JSON.parse(buf.toString() || '{}'))); }
    if (u.pathname === '/functions/v1/tally-twilio/walk' && req.method === 'OPTIONS') { custTypes.preflight = 1; res.writeHead(204); res.end(); return; }
    if (u.pathname.startsWith('/upload/') && req.method === 'PUT') {
      const p = decodeURIComponent(u.pathname.slice(8)), f = filePart(buf, req.headers['content-type']);
      files[p] = f.body || f; files[p].head = f.head || ''; files[p].auth = req.headers.authorization; files[p].upsert = req.headers['x-upsert'];
      return json({ Key: 'walk-videos/' + p });
    }
    if (u.pathname.startsWith('/vid/')) {
      const p = decodeURIComponent(u.pathname.slice(5)), f = files[p];
      if (!f) { res.writeHead(404); res.end(); return; }
      const type = /\.mp4$/.test(p) ? 'video/mp4' : 'video/webm', rg = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
      if (rg) { const a = +rg[1], z = rg[2] ? Math.min(+rg[2], f.length - 1) : f.length - 1; res.writeHead(206, { 'Content-Type': type, 'Content-Range': 'bytes ' + a + '-' + z + '/' + f.length, 'Content-Length': z - a + 1, 'Accept-Ranges': 'bytes' }); res.end(f.slice(a, z + 1)); return; }
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': f.length, 'Accept-Ranges': 'bytes' }); res.end(f); return;
    }
    res.writeHead(404); res.end();
  });
});
const owner = { uid: 'u-ana', email: 'ana@x.com' };
const init = (db, me) => `(function(){ ${SB}
  var db=${JSON.stringify(db)}, me=${JSON.stringify(me)}, calls={fn:[],writes:[],rpc:[],storage:[]};
  window.__calls=calls; window.__TALLY_TEST=true; window.__db=db;
  Object.defineProperty(window,'supabase',{configurable:true,get:function(){return {createClient:function(){return (window.__sb=makeSupabase(db,me,calls))}}},set:function(){}});
  try{ localStorage.setItem('tally.org','${ORG}') }catch(e){}
  document.addEventListener('DOMContentLoaded',function(){var s=document.createElement('style');s.textContent='*{scroll-behavior:auto!important}';document.head.appendChild(s)});
})();`;
// the pages' requests to the project come to the server here; nothing else leaves the machine
const proj = (p) => p.route(/^https:/, (r) => { const u = r.request().url(); if (u.indexOf(PROJ + '/') !== 0) return r.abort(); return r.fetch({ url: base + u.slice(PROJ.length) }).then((resp) => r.fulfill({ response: resp }), () => r.abort()); });
const txt = (p, sel) => p.$eval(sel, (e) => e.innerText.replace(/\s+/g, ' ').trim()).catch(() => '');
async function until(fn, ms, what) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch (e) { /* not yet */ } await sleep(150); } console.log('  (timed out waiting for ' + what + ')'); return false; }

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
  const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--disable-features=WebRtcHideLocalIpsWithMdns'];
  if (process.env.WALK_Y4M) args.push('--use-file-for-fake-video-capture=' + process.env.WALK_Y4M);
  const b = await chromium.launch(Object.assign({ args }, process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}));
  const errors = [];
  try {
    /* ---- the office: Ana, on a computer ---- */
    const hc = await b.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['microphone', 'camera'] });
    const h = await hc.newPage(); h.setDefaultTimeout(10000); hostPage = h;
    h.on('pageerror', (e) => errors.push('host: ' + e.message));
    await proj(h);
    await h.addInitScript(init(seed(), owner));
    await h.goto(base + '/app.html');
    await until(() => h.evaluate(() => !!(window.__tally && window.__tally.state().jobs.length && window.tallyWalk)), 15000, 'the app');
    ok(await h.evaluate(() => typeof window.tallyWalk.call === 'function' && window.tallyWalk.org() === 'org-1'), 'the hosted app has the walk-through calls (tallyWalk)');
    await h.evaluate(() => { const T = window.__tally; T.ui.tab = 'quotes'; T.ui.slf = 'open'; T.render(); });
    await sleep(300);
    await h.click('#ccList .scard[data-job="q1"] [data-act="sl:p"][data-m="sv"]'); await sleep(200);
    ok(/Start the video call/.test(await txt(h, '#ccList .scard[data-job="q1"] .spanel')), 'the walk-through panel has Start the video call');
    await h.click('#ccList .scard[data-job="q1"] [data-act="wk:start"]');
    await until(() => h.evaluate(() => { const i = document.getElementById('wkLinkIn'); return !!(i && i.value); }), 10000, 'the waiting screen');
    const link = await h.$eval('#wkLinkIn', (e) => e.value);
    const room = await h.evaluate(() => window.__tally.state().jobs.find((j) => j.id === 'q1').survey);
    ok(room && room.kind === 'video' && /^[A-Za-z0-9_-]{16}$/.test(room.room) && !room.done, 'starting it made a video walk-through with a room: ' + JSON.stringify(room));
    ok(link === 'https://mischief503.github.io/MoveCrew/walk.html?w=org-1.q1.' + room.room, 'the link for Sam: ' + link);
    ok(/Waiting for Sam/.test(await txt(h, '#wkHead')) && /Sam joins from the link in their text/.test(await txt(h, '#wkInfo')), 'the call waits for Sam: ' + await txt(h, '#wkInfo'));
    ok(seen.indexOf('walk_open') >= 0 && rooms.q1 && rooms.q1.room === room.room, 'the server has the room');
    ok(await h.evaluate(() => document.body.classList.contains('wkon') && !document.body.classList.contains('lock')), 'the page under the call keeps still (its own class, not a job sheet’s)');
    await shot(h, '1-office-waiting');

    /* ---- Sam, on a phone ---- */
    const cc = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['microphone', 'camera'] });
    const c = await cc.newPage(); c.setDefaultTimeout(10000);
    c.on('pageerror', (e) => errors.push('customer: ' + e.message));
    await proj(c);
    await c.goto(base + '/walk.html?w=' + link.split('?w=')[1]);
    await until(() => c.$('#joinB'), 8000, 'the join button');
    const card0 = await txt(c, '#card');
    ok(/^Hi Sam! Your video walk-through with Ana/.test(card0) && /This call is recorded so your moving crew can see what’s moving before moving day\./.test(card0) && /Turn on my camera and join/.test(card0), 'Sam’s page: who it’s with, that it’s recorded, and Join: ' + card0.slice(0, 160));
    ok(/Ace Moving/.test(await txt(c, '#co')), 'with the company’s name on it');
    ok(Object.keys(custTypes).join() === 'text/plain;charset=UTF-8', 'Sam’s page asks as plain text: one round trip each, no preflight (' + Object.keys(custTypes).join() + ')');
    await shot(c, '2-customer-join');
    await c.click('#joinB');
    await until(() => c.evaluate(() => window.__walk.state() === 'live'), 20000, 'Sam on the call');
    await until(() => h.evaluate(() => /Live/.test(document.getElementById('wkHead').innerText)), 10000, 'the office on the call');
    ok(await c.evaluate(() => window.__walk.state()) === 'live', 'Sam is on the call');
    ok(/Live · \d+:\d\d/.test(await txt(h, '#wkHead')), 'the office is on the call: ' + await txt(h, '#wkHead'));
    await until(() => h.evaluate(() => { const v = document.getElementById('wkRemote'); return v && v.videoWidth > 0; }), 10000, 'Sam’s camera on the office’s screen');
    ok(await h.evaluate(() => document.getElementById('wkRemote').videoWidth > 0), 'the office sees Sam’s camera');
    await until(() => h.evaluate(() => /● Recording/.test(document.getElementById('wkCtl').innerText)), 8000, 'recording');
    ok(/● Recording/.test(await txt(h, '#wkCtl')), 'and it’s recording');
    ok(/Recording On the call with Ana/.test(await txt(c, '#callBar')), 'Sam’s screen says it’s recorded too: ' + await txt(c, '#callBar'));
    ok(await h.evaluate(() => !!window.tallyBusy()), 'MoveCrew counts as busy during a call (no company switch)');
    await sleep(2500);
    await shot(h, '3-office-live'); await shot(c, '4-customer-live');
    // Hide: the call goes on in the bar
    await h.click('[data-act="wk:min"]'); await sleep(200);
    ok(await h.evaluate(() => document.getElementById('wkOv').hidden && !document.getElementById('wkBar').hidden && /On the call with Sam/.test(document.getElementById('wkBar').innerText) && !document.body.classList.contains('wkon')), 'Hide: a bar says the call is on, and the app is there under it (and scrolls)');
    await h.click('#wkBar'); await sleep(200);
    ok(await h.evaluate(() => !document.getElementById('wkOv').hidden), 'the bar brings the call back');
    await sleep(19000);   // a walk-through is done after 20 seconds on the call (a shorter one is a dropped call)

    /* ---- the end: the video is saved to the crew notes ---- */
    await h.click('[data-act="wk:end"]');
    await until(() => h.evaluate(() => /Saved to the crew notes/.test(document.getElementById('wkInfo').innerText)), 20000, 'the video saved');
    const said = await txt(h, '#wkInfo');
    ok(/^Call ended Saved to the crew notes: \d+ sec of video\. The crew on the job can watch it there\.$/.test(said) && await h.evaluate(() => document.getElementById('wkMinB').hidden), 'the call ended and the video is saved: ' + said);
    await until(() => c.evaluate(() => window.__walk.state() === 'ended'), 8000, 'Sam’s page to end');
    ok(/The walk-through is over/.test(await txt(c, '#card')), 'Sam’s page: ' + await txt(c, '#card'));
    await shot(h, '5-office-saved'); await shot(c, '6-customer-over');
    const paths = Object.keys(files), f = files[paths[0]];
    ok(paths.length === 1 && /^org-1\/q1\/[a-z0-9]+-1\.(mp4|webm)$/.test(paths[0]), 'one part went to storage: ' + paths.join(', '));
    ok(f && f.length > 20000 && /Content-Type: video\/(mp4|webm)/i.test(f.head) && f.upsert === 'false' && f.auth === 'Bearer tok-u-ana', 'a real video file, ' + (f ? f.length : 0) + ' bytes: ' + (f && f.head.replace(/\r\n/g, ' | ')));
    let probe = {};
    try {
      const tmp = path.join(require('os').tmpdir(), 'walkcall-' + path.basename(paths[0])); fs.writeFileSync(tmp, f);
      probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', tmp]).toString());
    } catch (e) { probe = { err: String(e.message).slice(0, 200) }; }
    if (probe.err && /ENOENT/.test(probe.err)) console.log('  (ffprobe not here: the file’s streams aren’t checked)');
    else {
      const kinds = (probe.streams || []).map((s) => s.codec_type + ':' + s.codec_name).join(',');
      // H.264 and AAC where the browser has them (Chrome, Edge, Safari, the apps); this test's Chromium has neither, so VP9 and Opus
      ok(/video:(h264|vp8|vp9)/.test(kinds) && /audio:(aac|opus)/.test(kinds) && Number(probe.format && probe.format.duration) > 15, 'it has Sam’s camera and the voices, ' + Math.round(Number(probe.format && probe.format.duration)) + ' s: ' + kinds);
    }
    ok(rooms.q1.ended && rooms.q1.endBody && rooms.q1.endBody.done === true && rooms.q1.endBody.secs >= 20, 'the server heard the call ended after ' + (rooms.q1.endBody && rooms.q1.endBody.secs) + ' s');
    const q1 = await h.evaluate(() => { const j = window.__tally.state().jobs.find((x) => x.id === 'q1'); return { vids: j.walkVids, survey: j.survey }; });
    ok(q1.vids && q1.vids.length === 1 && q1.vids[0].path === paths[0] && q1.vids[0].secs >= 20, 'the job has the video: ' + JSON.stringify(q1.vids));
    ok(q1.survey && q1.survey.done > 0, 'and the walk-through is done');
    await h.click('[data-act="wk:done"]'); await sleep(300);
    ok(await h.evaluate(() => document.getElementById('wkOv').hidden && !window.tallyBusy() && !document.body.classList.contains('wkon')), 'Done closes the call');
    await sleep(500);
    const sent = await h.evaluate(() => window.__calls.writes.filter((w) => /q1/.test(JSON.stringify(w)) && /walkVids/.test(JSON.stringify(w))).length);
    ok(sent === 0, 'the app doesn’t send the video back: the server put it on the job');

    /* ---- the office watches it on the job ---- */
    await h.evaluate(() => window.__tally.openJob('q1'));
    await sleep(500);
    const fold = await txt(h, '#sheet details[data-k="sh:Job notes"] summary');
    ok(/walk-through video/.test(fold), 'Job notes, folded, says there’s a walk-through video: ' + fold);
    await h.click('#sheet details[data-k="sh:Job notes"] summary'); await sleep(300);
    await h.evaluate(() => { const e = document.querySelector('#sheet .wkv'); if (e) e.scrollIntoView({ block: 'center' }); }); await sleep(200);
    const sheetV = await txt(h, '#sheet .wkv');
    ok(/^▶ Walk-through video .+ · \d+ sec · by Ana Watch Delete The crew on the job sees it in the job’s notes\. It’s deleted 30 days after the move is paid\.$/.test(sheetV), 'the job sheet, under Job notes: ' + sheetV);
    await h.click('#sheet [data-act="wk:watch"]');
    await until(() => h.evaluate(() => { const v = document.querySelector('#wkPlay video'); return v && v.readyState >= 2; }), 10000, 'the video to play');
    const pl = await h.evaluate(() => { const v = document.querySelector('#wkPlay video'); return { rs: v.readyState, w: v.videoWidth, dur: v.duration, src: v.currentSrc }; });
    ok(pl.rs >= 2 && pl.w > 0 && pl.src.indexOf(PROJ + '/vid/org-1/q1/') === 0, 'Watch plays it: ' + JSON.stringify(pl));
    await sleep(800);
    await shot(h, '7-office-watch');
    await h.keyboard.press('Escape'); await sleep(200);
    await h.evaluate(() => { const T = window.__tally; T.ui.jobId = null; const s = document.getElementById('sheet'); if (s) s.hidden = true; T.render(); });
    ok(await h.evaluate(() => document.getElementById('wkPlay').hidden), 'Escape closes the player');

    /* ---- the crew: booked, with Marcus on it; on his phone, in the job's notes ---- */
    const db2 = await h.evaluate(() => JSON.parse(JSON.stringify(window.__db)));
    const jr = db2.docs.find((r) => r.path === 'jobs/q1');
    jr.data.status = 'booked'; jr.data.d.moveDate = day(0); jr.data.assign = { truckId: 't26', crew: ['Marcus'] };
    const mc = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const m = await mc.newPage(); m.setDefaultTimeout(10000);
    m.on('pageerror', (e) => errors.push('crew: ' + e.message));
    await proj(m);
    await m.addInitScript(init(db2, { uid: 'u-marcus', email: 'marcus@x.com' }));
    await m.goto(base + '/app.html');
    await until(() => m.$('.crewcard[data-job="q1"]'), 15000, 'Marcus’s card');
    const crewV = await txt(m, '.crewcard[data-job="q1"] .cc-sec .wkv');
    ok(/^▶ Walk-through video .+ · \d+ sec · by Ana Watch$/.test(crewV), 'the crew lead’s card, in Notes for the job: ' + crewV);
    const cn = await m.evaluate(() => { const v = document.querySelector('.crewcard[data-job="q1"] .wkv'); const s = v && v.closest('.cc-sec'); return s && s.querySelector('h4').textContent; });
    ok(cn === 'Notes for the job', 'the section is the job’s notes: ' + cn);
    await m.evaluate(() => { const e = document.querySelector('.crewcard[data-job="q1"] .wkv'); if (e) e.scrollIntoView({ block: 'center' }); });
    await sleep(200); await shot(m, '8-crew-notes');
    await m.click('.crewcard[data-job="q1"] [data-act="wk:watch"]');
    await until(() => m.evaluate(() => { const v = document.querySelector('#wkPlay video'); return v && v.readyState >= 2; }), 10000, 'the crew’s video to play');
    ok(await m.evaluate(() => document.querySelector('#wkPlay video').readyState >= 2), 'Marcus can watch it on his phone');
    ok(seen.filter((x) => x === 'walk_watch').length === 2, 'each one asked the server for the video (it checks who may watch)');
    await sleep(600); await shot(m, '9-crew-watch');
    ok(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  } catch (e) {
    ok(false, 'stopped: ' + (e && e.stack || e));
  } finally {
    await b.close(); server.close();
  }
  console.log('\nwalkcall: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();

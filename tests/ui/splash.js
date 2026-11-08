// The loading screen (Richie, Nov 6): "When opening the app it shows it loading can we fill that 10 seconds or so with
// a loading screen of a handtruck with a few boxes on it and the wheels rolling". It is the first thing on the page (so
// it shows before any script runs), it says how far MoveCrew has got, and it goes once there is something to see: the
// company's jobs in (or 4 seconds after the app asked for them), a sign-in or set-up screen at once.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const { load, ok, sleep, summary } = require('./lib');
const HOSTED = __dirname + '/../../build/tally-supabase.html';
const ARTIFACT = __dirname + '/../../build/tally-artifact.html';
const ORG = 'org-1';
const OWNER = { uid: 'u-owner', email: 'o@x.com' };
const day = (n) => { const d = new Date(Date.now() + n * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

function seed(over = {}, init = true) {
  const docs = [];
  const put = (path, data) => { const [collection, doc_id] = path.split('/'); docs.push({ org_id: ORG, path, collection, doc_id, data, updated_at: new Date().toISOString() }); };
  if (init) put('meta/init', { ts: 1, mode: 'fresh' });
  put('org/settings', { company: 'Ace Moving', crew: ['Marcus'], leads: ['Marcus'], office: [{ name: 'Owner', kind: 'owner' }], trucks: [{ id: 't26', name: 'Box 1 (26 ft)', cf: 1700 }] });
  put('jobs/j1', { id: 'j1', status: 'booked', createdAt: Date.now(), d: { name: 'Priya Nair', phone: '', email: '', moveDate: day(0), time: '08:00', from: '418 Oak St', to: '77 Ridge Rd', custom: {}, items: [] },
    quote: { total: 1000, crew: 2, hours: 4, lines: [] }, items: [], assign: { truckId: 't26', crew: ['Marcus'] }, tally: {}, payments: {}, signed: {}, extras: {}, crewNotes: {}, photos: {}, materials: {}, costs: {}, log: {} });
  return Object.assign({ docs, access_requests: [], comm_lines: [], comm_log: [],
    members: [{ org_id: ORG, user_id: 'u-owner', email: 'o@x.com', staff: 'Owner', role: 'owner', ts: 1 }] }, over);
}
// what the loading screen was told to say, in order (window.tallySplash, wrapped as the page defines it)
const listen = (st) => (w) => {
  let real;
  Object.defineProperty(w, 'tallySplash', { configurable: true, get: () => real, set: (f) => { real = (t) => { st.said.push(t); return f(t); }; } });
};

(async () => {
  /* ---------- the page as it arrives: the hand truck is the first thing in it ---------- */
  const html = fs.readFileSync(HOSTED, 'utf8');
  const D = new JSDOM(html).window.document;   // no scripts: what shows before any of them runs
  const sp = D.body.firstElementChild;
  ok(sp && sp.id === 'splash', 'the loading screen is the first thing on the page');
  ok(sp && sp.getAttribute('role') === 'status' && D.getElementById('splashSay').textContent === 'Getting your day ready…', 'it says “Getting your day ready…”, to screen readers too (role=status)');
  ok(sp && sp.querySelector('svg[aria-hidden="true"] .sp-wheel circle') && sp.querySelectorAll('.sp-wheel path').length >= 1 && sp.querySelector('.sp-road'), 'the drawing: a wheel that turns (spokes), the road going by');
  ok(sp && sp.querySelectorAll('svg rect[fill="url(#spBox)"]').length === 3, 'three boxes on the hand truck');
  ok(sp && sp.querySelector('.sp-name .sp-sr').textContent === 'MoveCrew' && /MOVE/.test(sp.querySelector('.sp-name').textContent), 'MOVE CREW in the new icon’s colours, read as “MoveCrew”');
  // Richie, Nov 7: "The 3 words on the picture and the loading screen i think we could choose better", then "Book move relax"
  ok(sp && [...sp.querySelectorAll('.sp-tag span')].map((s) => s.textContent).join(' ◆ ') === 'Book ◆ Move ◆ Relax' && sp.querySelectorAll('.sp-tag i').length === 2,
    'under the name, the icon’s words: Book ◆ Move ◆ Relax');
  const css = D.getElementById('splashCss').textContent;
  ok(/#splash\{position:fixed;inset:0;z-index:110/.test(css) && /@media \(prefers-reduced-motion:reduce\)\{#splash \*\{animation:none!important\}/.test(css), 'over the app (z 110; sign-in is 120, the access card 80), and still for people who turn motion off');
  ok(/@keyframes sp-spin\{to\{transform:rotate\(360deg\)\}\}/.test(css) && /\.sp-wheel\{transform-origin:122px 150px;animation:sp-spin/.test(css), 'the wheel turns about its own middle');

  /* ---------- the owner, signed in: what it says, and when it goes ---------- */
  const st = { said: [] };
  const A = await load(HOSTED, { db: seed(), org: ORG, me: OWNER, setup: listen(st) });
  await sleep(500);
  ok(JSON.stringify(st.said) === JSON.stringify(['Getting your day ready…', 'Signing you in…', 'Opening Ace Moving…', 'Loading your jobs…']),
    'it says how far MoveCrew has got: ' + st.said.join(' › '));
  ok(!A.$('#splash'), 'it goes once the jobs are in (not 4 seconds later)');
  ok(A.T.state().jobs.length === 1 && /Priya Nair/.test(A.text()), 'and the app is there with the day’s job');
  ok(A.errors.length === 0, 'no errors (' + A.errors.slice(0, 2).join(' | ') + ')');

  /* ---------- the jobs don't come: it goes after 4 seconds anyway ---------- */
  const st2 = { said: [] };
  const B = await load(HOSTED, { db: seed({ __failSelect: (table, asked) => table === 'docs' && asked.some(([c, v]) => c === 'collection' && v === 'jobs') }), org: ORG, me: OWNER, setup: listen(st2) });
  await sleep(1200);
  ok(B.$('#splash') && B.$('#splashSay').textContent === 'Loading your jobs…', 'the jobs not in yet: “Loading your jobs…”, the hand truck still rolling');
  await sleep(3600);
  ok(!B.$('#splash'), 'about 4 seconds after the app asked for them: the app shows, jobs or not');

  /* ---------- not signed in: sign-in shows over it, and it comes back after ---------- */
  const st3 = { said: [] };
  const C = await load(HOSTED, { db: seed(), org: ORG, me: null, setup: listen(st3) });
  await sleep(200);
  const cs = (el) => C.w.getComputedStyle(el).display;
  ok(C.$('#login') && C.$('#splash') && cs(C.$('#splash')) === 'none', 'not signed in: the sign-in screen, the loading screen hidden under it (kept for after)');
  C.w.__sb.__auth('SIGNED_IN', OWNER); await sleep(60);
  ok(!C.$('#login') && C.$('#splash') && cs(C.$('#splash')) !== 'none', 'signed in: the sign-in screen goes and the hand truck rolls while the company opens');
  await sleep(600);
  ok(st3.said.indexOf('Opening Ace Moving…') > 0 && !C.$('#splash'), 'then it goes, with the jobs in (' + st3.said.join(' › ') + ')');

  /* ---------- a screen that asks something: it goes at once ---------- */
  const E = await load(HOSTED, { db: seed({}, false), org: ORG, me: OWNER });
  await sleep(450);
  ok(/Set up your shared workspace/.test(E.$('#gate').textContent) && !E.$('#splash'), 'a company not set up yet: “Set up your shared workspace” shows straight away, no hand truck over it');

  /* ---------- the claude.ai copy on one device: no waiting at all ---------- */
  const F = await load(ARTIFACT, {});
  await sleep(450);
  ok(!F.$('#splash') && F.$('#view').textContent.trim().length > 0, 'the claude.ai copy with nothing to wait for: straight to the app');
  ok(F.errors.length === 0 && E.errors.length === 0 && C.errors.length === 0 && B.errors.length === 0, 'no errors in any of them');

  process.exit(summary('splash') ? 1 : 0);
})();

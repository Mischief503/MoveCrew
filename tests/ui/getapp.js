// Getting MoveCrew onto an iPhone without the App Store (Richie, Nov 8: "If we want to make this actually top tier stuff
// we will need it avaliable for iphones as well", then "we will just do the webbase right now"). The invite texted to
// someone who works in the field is one link (the website's ?get=app) that shows the steps for the phone it's opened
// on: an iPhone adds MoveCrew to its Home Screen (Share, which iOS 26 keeps under ⋯, then Add to Home Screen), an
// Android phone downloads the app, a computer gets the Windows app. In an iPhone's Home Screen app the sign-in is the
// emailed code (no Google button), More › Get the app shows the same steps to someone on the website, and the
// customer's Get the app has the iPhone steps for iOS 26.
const { load, ok, sleep, summary } = require('./lib');
const HOSTED = __dirname + '/../../build/tally-supabase.html';
const ARTIFACT = __dirname + '/../../build/tally-artifact.html';
const ORG = 'org-1';
const APK = 'https://github.com/Mischief503/MoveCrew/releases/latest/download/MoveCrew.apk';
const WIN = 'https://github.com/Mischief503/MoveCrew/releases/download/windows/MoveCrew-Setup.exe';
const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36',
  computer: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
};
// a phone: its browser's name for itself, an iPad's touch points, and whether MoveCrew runs from its Home Screen
const device = (kind, o = {}) => (w) => {
  Object.defineProperty(w.navigator, 'userAgent', { configurable: true, get: () => UA[kind] });
  Object.defineProperty(w.navigator, 'maxTouchPoints', { configurable: true, get: () => (kind === 'ipad' || kind === 'iphone' || kind === 'android' ? 5 : 0) });
  if (o.home) Object.defineProperty(w.navigator, 'standalone', { configurable: true, get: () => true });
};
function seed(over = {}) {
  const docs = [];
  const put = (path, data) => { const [collection, doc_id] = path.split('/'); docs.push({ org_id: ORG, path, collection, doc_id, data, updated_at: new Date().toISOString() }); };
  put('meta/init', { ts: 1, mode: 'fresh' });
  put('org/settings', Object.assign({ company: 'Ace Moving', crew: ['Marcus', 'Dee'], leads: ['Marcus'], office: [{ name: 'Owner', kind: 'owner' }], contacts: { Owner: '512-555-0100' },
    trucks: [{ id: 't26', name: 'Box 1 (26 ft)', cf: 1700 }] }, over.settings || {}));
  return { docs, access_requests: [], comm_lines: [], comm_log: [], employees: [],
    members: [{ org_id: ORG, user_id: 'u-owner', email: 'o@x.com', staff: 'Owner', role: 'owner', ts: 1 }] };
}
// Supabase's settings say Google sign-in is on
const googleOn = (req) => (url) => { if (/\/auth\/v1\/settings/.test(url)) { req.n++; return { ok: true, json: async () => ({ external: { google: true } }) }; } return { ok: false, json: async () => ({}) }; };
const set = (A, sel, v) => { const el = A.$(sel); el.value = v; el.dispatchEvent(new A.w.Event('input', { bubbles: true })); el.dispatchEvent(new A.w.Event('change', { bubbles: true })); };
const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

(async () => {
  /* ---------- the invite's link opened on an iPhone, before signing in ---------- */
  const I = await load(HOSTED, { db: seed(), org: ORG, me: null, hash: '?get=app', setup: device('iphone') });
  await sleep(150);
  const box = I.$('#login .getbox');
  ok(box && /Get MoveCrew on your iPhone/.test(txt(box)) && !I.$('#lgSend'), 'the invite’s link on an iPhone: “Get MoveCrew on your iPhone”, before any sign-in');
  const steps = I.$$('#login .getbox > .gsteps li').map(txt);
  ok(steps.length === 3 && /^In Safari, tap Share/.test(steps[0]) && /On iOS 26, tap ⋯ next to the address bar first\./.test(steps[0]) && !!I.$('#login .gsteps .gshare') &&
    steps[1] === 'Tap Add to Home Screen. Keep Open as Web App on, then tap Add.' && steps[2] === 'Open MoveCrew from your Home Screen and sign in there with your email.',
    'three steps: Share (under ⋯ on iOS 26, with its picture), Add to Home Screen with Open as Web App on, then open it and sign in there: ' + steps.join(' | '));
  ok(/Nothing to download from the App Store/.test(txt(box)), 'and it says there’s nothing to get from the App Store');
  const other = I.$('#login .gother');
  const links = I.$$('#login .gother a.gbtn').map((a) => [txt(a), a.getAttribute('href')]);
  ok(other && !other.open && /Another phone or a computer\?/.test(txt(other.querySelector('summary'))) && JSON.stringify(links) === JSON.stringify([['Download the Android app', APK], ['Download MoveCrew for Windows', WIN]]),
    'folded under “Another phone or a computer?”: the Android app and MoveCrew for Windows ' + JSON.stringify(links));
  I.click('#lgHere'); await sleep(30);
  ok(!I.$('#login .getbox') && !!I.$('#lgSend') && !!I.$('#lgEmail'), '“Sign in here instead” goes to the usual sign-in');
  ok(I.errors.length === 0, 'no errors (' + I.errors.slice(0, 2).join(' | ') + ')');

  /* ---------- on an Android phone, a computer, an iPad ---------- */
  const N = await load(HOSTED, { db: seed(), org: ORG, me: null, hash: '?get=app', setup: device('android') });
  await sleep(150);
  const nFirst = N.$('#login .getbox > a.gbtn');
  ok(/Get MoveCrew on your phone/.test(txt(N.$('#login .getbox'))) && nFirst && nFirst.getAttribute('href') === APK && txt(nFirst) === 'Download the Android app' &&
    /Open the downloaded file and tap Install\. If your phone asks, let your browser install apps\./.test(txt(N.$('#login .getbox > .gsteps'))),
    'an Android phone: Download the Android app first, then how to install it');
  ok(/On an iPhone or iPad/.test(txt(N.$('#login .gother'))) && /Add to Home Screen/.test(txt(N.$('#login .gother'))), 'the iPhone’s steps folded under it (for a phone you’re not holding)');
  const C = await load(HOSTED, { db: seed(), org: ORG, me: null, hash: '?get=app', setup: device('computer') });
  await sleep(150);
  const cFirst = C.$('#login .getbox > a.gbtn');
  ok(txt(C.$('#login .getbox .ask')) === 'Get MoveCrew' && cFirst && txt(cFirst) === 'Download MoveCrew for Windows' && cFirst.getAttribute('href') === WIN && /Or use MoveCrew right here in your browser\./.test(txt(C.$('#login .getbox'))),
    'a computer: MoveCrew for Windows, or the browser');
  const P = await load(HOSTED, { db: seed(), org: ORG, me: null, hash: '?get=app', setup: device('ipad') });
  await sleep(150);
  ok(/Get MoveCrew on your iPad/.test(txt(P.$('#login .getbox'))) && /Add to Home Screen/.test(txt(P.$('#login .getbox > .gsteps'))), 'an iPad (which says it’s a Mac, with a touch screen): the iPhone’s steps');

  /* ---------- MoveCrew on the iPhone's Home Screen: no invite page, and the emailed code ---------- */
  const req1 = { n: 0 };
  const H = await load(HOSTED, { db: seed(), org: ORG, me: null, hash: '?get=app', setup: device('iphone', { home: true }), net: googleOn(req1) });
  await sleep(200);
  ok(!H.$('#login .getbox') && !!H.$('#lgSend') && !H.$('#lgGoogle') && req1.n === 0, 'opened from the Home Screen: straight to sign-in with the emailed code, no Google button (it would leave the app), Google not even asked');
  const req2 = { n: 0 };
  const S = await load(HOSTED, { db: seed(), org: ORG, me: null, setup: device('iphone'), net: googleOn(req2) });
  await sleep(200);
  ok(!S.$('#login .getbox') && !!S.$('#lgGoogle') && req2.n === 1, 'in Safari itself (and without the invite’s link): the usual sign-in, Continue with Google when it’s on');
  ok([N, C, P, H, S].every((x) => x.errors.length === 0), 'no errors on any of them');

  /* ---------- signed in on the website: More › Get the app, and the invite's text ---------- */
  const O = await load(HOSTED, { db: seed(), org: ORG, me: { uid: 'u-owner', email: 'o@x.com' }, setup: device('iphone') });
  await sleep(300);
  O.click('[data-act="more:open"]'); await sleep(10);
  const getRow = O.$('#more [data-act="more:getapp"]');
  ok(getRow && /Get the app/.test(txt(getRow)) && /Add MoveCrew to your Home Screen/.test(txt(getRow)), 'More › Get the app: “Add MoveCrew to your Home Screen”');
  O.click(getRow); await sleep(10);
  const sheet = O.$('#more .getsheet');
  ok(sheet && /Get MoveCrew on your iPhone/.test(txt(sheet)) && /Open MoveCrew from your Home Screen\. Sign in there once more with your email\./.test(txt(sheet)),
    'its sheet: the iPhone’s steps, and signing in once more in the Home Screen app (it keeps its own sign-in)');
  O.click('#more .getsheet [data-act="more:close"]'); await sleep(10);
  ok(O.$('#more').hidden, 'Done closes it');
  // someone new who works in the field is texted the one link
  await O.go('settings', 'employees'); await sleep(40);
  ok(O.$('#view [data-s="appLink"]') && O.$('#view [data-s="appLink"]').getAttribute('placeholder') === 'https://tally.example.com/?get=app', 'Setup › Employees: the link to get the app is the website’s ?get=app page unless the owner puts in another');
  O.click('[data-act="emp:new"]'); await sleep(20);
  set(O, '[data-ek="name"]', 'Rico'); set(O, '[data-ek="email"]', 'rico@x.com'); set(O, '[data-ek="phone"]', '503-555-0188');
  O.click('[data-act="emp:save"]'); await sleep(40);
  let sms = O.$('#emp a[href^="sms:"]');
  let body = sms ? decodeURIComponent(sms.getAttribute('href').replace(/^[^?]*\?&body=/, '')) : '';
  ok(body === 'Hi Rico, it\'s Ace Moving. Get the MoveCrew app here: https://tally.example.com/?get=app and sign in with rico@x.com. You\'ll go straight to your jobs. Already use MoveCrew? Just open it and pick Ace Moving.',
    'Text Rico the app: the one link, for an iPhone or an Android phone: ' + body);
  O.click('[data-act="emp:close"]'); await sleep(10);
  O.T.state().settings.appLink = 'https://example.com/our-app'; O.T.save();
  O.click(O.$$('.emprow').find((r) => /Rico/.test(r.textContent))); await sleep(40);
  sms = O.$('#emp a[href^="sms:"]');
  body = sms ? decodeURIComponent(sms.getAttribute('href').replace(/^[^?]*\?&body=/, '')) : '';
  ok(/Get the MoveCrew app here: https:\/\/example\.com\/our-app and sign in/.test(body), 'a link the owner put in Setup is texted instead');
  O.click('[data-act="emp:close"]'); await sleep(10);
  const OH = await load(HOSTED, { db: seed(), org: ORG, me: { uid: 'u-owner', email: 'o@x.com' }, setup: device('iphone', { home: true }) });
  await sleep(300);
  OH.click('[data-act="more:open"]'); await sleep(10);
  ok(!OH.$('#more [data-act="more:getapp"]') && !!OH.$('#more [data-act="more:signout"]'), 'MoveCrew already on the Home Screen: no Get the app in More');
  ok(O.errors.length === 0 && OH.errors.length === 0, 'no errors (' + O.errors.concat(OH.errors).slice(0, 2).join(' | ') + ')');

  /* ---------- the customer's Get the app (the claude.ai copy, seen as Lena Wu) ---------- */
  for (const [kind, want, label] of [
    ['iphone', /In Safari, tap Share.*On iOS 26, tap ⋯ next to the address bar first\..*Add to Home Screen\. Keep Open as Web App on, then tap Add\..*Open MoveCrew from your Home Screen\. Sign in there once more with your email\./, 'an iPhone: the three steps, and signing in once more there'],
    ['android', /In Chrome, open the menu ⋮ and tap Add to Home screen or Install app\..*On an iPhone: in Safari, tap Share \(on iOS 26, under ⋯ next to the address bar\), then Add to Home Screen\./, 'an Android phone: Chrome’s way, and a line for an iPhone'],
  ]) {
    const A = await load(ARTIFACT, { setup: device(kind) });
    const T = A.T;
    const lena = T.custPeople().find((x) => x.name === 'Lena Wu');
    A.click('[data-act="more:open"]'); await sleep(5); A.click('[data-act="more:preview"]'); await sleep(5);
    A.click(A.$$('#more [data-act="pv:set"][data-role="customer"]').find((b) => b.dataset.staff === lena.key)); await sleep(30);
    await A.go('myprofile'); await sleep(20);
    const card = A.$$('#view .card').find((c) => /Get the app/.test(txt(c.querySelector('h3'))));
    ok(card && want.test(txt(card)), 'the customer’s Get the app on ' + label + ': ' + txt(card).slice(0, 160));
    ok(A.errors.length === 0, 'no errors (' + A.errors.slice(0, 2).join(' | ') + ')');
  }

  process.exit(summary('getapp') ? 1 : 0);
})();

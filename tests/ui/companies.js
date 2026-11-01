// Someone in more than one company (Nov 1). Richie: "I need people to be able to work for multiple companys and there
// should be a switch company option in more . As well as ask them when they enter the app witch company they are
// working for that day . But this only happens if the person gets added to more than 1 company by email".
// The hosted edition: asked once a work day (4 a.m. to 4 a.m.), and again when another company adds them; never for
// someone in one company, for a company they've only asked to join, or for the call center; More › Switch company
// and the company's name at the top; coming back to the app on a new day; changes still on their way hold a switch.
const { load, ok, sleep, summary } = require('./lib');
const FILE = __dirname + '/../../build/tally-supabase.html';
const A_ID = 'org-a', B_ID = 'org-b', C_ID = 'org-c';
const NAMES = { [A_ID]: 'Ace Moving', [B_ID]: 'Bright Moves', [C_ID]: 'Rich Side Hauling' };
const RICH = { uid: 'u-rich', email: 'rich@x.com' };

const pad = (n) => String(n).padStart(2, '0');
const dayOf = (ms) => { const d = new Date(ms - 4 * 3600e3); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const today = () => dayOf(Date.now());
const yesterday = () => dayOf(Date.now() - 864e5);
const tag = (day, ids, uid = RICH.uid) => uid + '|' + day + '|' + ids.slice().sort().join(',');

function seed(orgs, extra = {}) {
  const docs = [];
  const put = (org, path, data) => { const [collection, doc_id] = path.split('/'); docs.push({ org_id: org, path, collection, doc_id, data, updated_at: new Date().toISOString() }); };
  const roles = Object.assign({ [A_ID]: 'lead', [B_ID]: 'owner', [C_ID]: 'owner' }, extra.roles || {});
  const members = [];
  [A_ID, B_ID, C_ID].forEach((org) => {
    put(org, 'meta/init', { ts: 1, mode: 'fresh' });
    put(org, 'org/settings', { company: NAMES[org], crew: ['Rich', 'Dee'], leads: ['Rich'], office: [{ name: 'Rich', kind: 'owner' }], contacts: { Rich: '503-555-0100' }, trucks: [{ id: 't1', name: 'Box 1 (26 ft)', cf: 1700 }] });
    members.push({ org_id: org, user_id: 'u-other', email: 'o@x.com', staff: 'Dee', role: 'owner', ts: 1 });
  });
  orgs.forEach((org) => members.push({ org_id: org, user_id: RICH.uid, email: RICH.email, staff: 'Rich', role: roles[org], ts: 1 }));
  return Object.assign({ docs, members, access_requests: [], comm_log: [], comm_lines: [], __orgNames: NAMES }, extra.db || {});
}
// opens MoveCrew as Rich: org = the company this device had open; day = what it kept for the day; pickAll = More ›
// Switch company asked for the whole list
async function open(orgs, o = {}) {
  let reloads = 0;
  const A = await load(FILE, {
    db: seed(orgs, o), me: o.me || RICH, org: o.org === undefined ? A_ID : o.org,
    setup: (w) => {
      w.__tallyReload = () => { reloads++; };
      if (o.day) w.localStorage.setItem('tally.orgDay', o.day);
      if (o.pickAll) w.sessionStorage.setItem('tally.pickAll', '1');
    },
  });
  A.reloads = () => reloads;
  A.login = () => A.$('#login');
  A.orgBtns = () => A.$$('#login button.org');
  A.btn = (id) => A.$('#login button.org[data-org="' + id + '"]');
  A.kept = () => A.w.localStorage.getItem('tally.orgDay');
  A.org = () => A.w.localStorage.getItem('tally.org');
  return A;
}

(async () => {
  /* ===== in two companies, first time today: asked, the one open last time marked ===== */
  let A = await open([A_ID, B_ID]);
  ok(A.login() && /Which company are you working for today\?/.test(A.login().textContent), 'in two companies: MoveCrew asks which company today');
  ok(A.orgBtns().length === 2 && /Ace Moving/.test(A.btn(A_ID).textContent) && /Bright Moves/.test(A.btn(B_ID).textContent), 'both companies to pick from');
  ok(/Crew lead · last time/.test(A.btn(A_ID).textContent) && /^Bright MovesOwner$/.test(A.btn(B_ID).textContent.trim()), 'each with what they are there (Crew lead, Owner), and the one open last time marked: ' + A.btn(A_ID).textContent + ' | ' + A.btn(B_ID).textContent);
  ok(A.w.document.documentElement.classList.contains('pre-auth') && !A.w.__tallyBooted, 'nothing of either company shows until they pick');
  ok(/You work for 2 companies, so MoveCrew asks once a day/.test(A.login().textContent) && /More › Switch company/.test(A.login().textContent), 'it says why it asks, and where to change it later');
  // the same company: straight in, no starting again
  A.click(A.btn(A_ID)); await sleep(400);
  ok(A.reloads() === 0 && !A.login() && A.w.__tallyBooted && !A.w.document.documentElement.classList.contains('pre-auth'), 'picking the company that was open goes straight in (no starting again)');
  ok(A.kept() === tag(today(), [A_ID, B_ID]), 'today’s pick is kept on this phone: ' + A.kept());
  const cosw = A.$('#brandCo button.cosw');
  ok(cosw && /Ace Moving/.test(cosw.textContent) && /Switch company/.test(cosw.getAttribute('aria-label')), 'the company’s name at the top is a switch');
  A.click('[data-act="more:open"]'); await sleep(10);
  const mrow = A.$('#more [data-act="more:company"]');
  ok(mrow && /Switch company/.test(mrow.textContent) && /Now: Ace Moving · 2 companies/.test(mrow.textContent), 'More › Switch company says which one is open now: ' + (mrow && mrow.textContent));
  A.click(mrow); await sleep(10);
  ok(/Switch company/.test(A.$('#more h2').textContent) && A.$$('#more [data-act="co:use"]').length === 2, 'Switch company lists their companies right there');
  const here = A.$('#more [data-act="co:use"][data-org="' + A_ID + '"]');
  ok(here.getAttribute('aria-current') === 'true' && /Crew lead · working here now/.test(here.textContent) && /✓/.test(here.textContent), 'the one open now is ticked: ' + here.textContent);
  ok(!/haven’t reached the office/.test(A.$('#more').textContent), 'no warning with nothing waiting to go');
  A.click(here); await sleep(10);
  ok(A.$('#more').hidden && A.reloads() === 0, 'tapping the one open closes the list');
  A.click('#brandCo button.cosw'); await sleep(10);
  ok(!A.$('#more').hidden && /Switch company/.test(A.$('#more h2').textContent), 'tapping the name at the top opens the same list');
  A.click('#more [data-act="co:use"][data-org="' + B_ID + '"]'); await sleep(10);
  ok(A.reloads() === 1 && A.org() === B_ID && A.kept() === tag(today(), [A_ID, B_ID]), 'tapping the other company opens it, and it is today’s');
  ok(A.errors.length === 0, 'no errors (' + A.errors.slice(0, 3).join(' | ') + ')');

  /* ===== the same day again: no question ===== */
  A = await open([A_ID, B_ID], { day: tag(today(), [A_ID, B_ID]) });
  ok(!A.login() && A.w.__tallyBooted && A.reloads() === 0, 'opened again the same day: straight into the company picked');

  /* ===== the next day: asked again; picking the other company opens it ===== */
  A = await open([A_ID, B_ID], { day: tag(yesterday(), [A_ID, B_ID]) });
  ok(A.login() && /working for today/.test(A.login().textContent) && !A.w.__tallyBooted, 'the next day: asked again');
  A.click(A.btn(B_ID)); await sleep(20);
  ok(A.reloads() === 1 && A.org() === B_ID && A.kept() === tag(today(), [A_ID, B_ID]), 'picking the other company opens that one, kept for the day');

  /* ===== nothing open yet on this phone ===== */
  A = await open([A_ID, B_ID], { org: '' });
  ok(A.login() && A.orgBtns().length === 2 && !/last time/.test(A.login().textContent), 'a phone with no company open yet: asked, nothing marked');

  /* ===== another company added them since this morning: asked again, that one marked new ===== */
  A = await open([A_ID, B_ID, C_ID], { day: tag(today(), [A_ID, B_ID]) });
  ok(A.login() && A.orgBtns().length === 3, 'a company that added them since: asked again, with all three');
  ok(/Owner · new: they just added you/.test(A.btn(C_ID).textContent) && !/new/.test(A.btn(A_ID).textContent + A.btn(B_ID).textContent), 'the new one marked: ' + A.btn(C_ID).textContent);
  // the question's other ways out: the whole list, and signing out
  A.click('#pkAll'); await sleep(10);
  ok(/Start a new company/.test(A.login().textContent) && /Join a company with a code/.test(A.login().textContent), 'Start or join another company: the whole list, in place');

  /* ===== one company: never asked (a company they've only asked to join doesn't count) ===== */
  A = await open([A_ID], { db: { __pendingOrgs: [{ id: B_ID, name: 'Bright Moves' }] } });
  ok(!A.login() && A.w.__tallyBooted, 'one company, and a request to join another still waiting: never asked');
  ok(!A.$('#brandCo button.cosw') && /Ace Moving/.test(A.$('#brandCo').textContent), 'one company: the name at the top is just the name');
  A.click('[data-act="more:open"]'); await sleep(10);
  const one = A.$('#more [data-act="more:company"]');
  ok(one && /Switch company/.test(one.textContent) && /Ace Moving/.test(one.textContent) && !/Now:/.test(one.textContent), 'one company: More still has Switch company (to start or join one)');
  A.click(one); await sleep(10);
  ok(A.reloads() === 1 && A.org() === null && A.w.sessionStorage.getItem('tally.pickAll') === '1', 'it opens the whole list');
  // the whole list, for someone in one company: it used to go straight back into that company
  A = await open([A_ID], { org: '', pickAll: true });
  ok(A.login() && /Start a new company/.test(A.login().textContent) && A.btn(A_ID) && A.reloads() === 0, 'Switch company with one company: the list to start or join one, not straight back in');
  ok(A.w.sessionStorage.getItem('tally.pickAll') === null, 'the whole list is asked for once');
  A = await open([A_ID, B_ID], { org: '', pickAll: true });
  ok(A.login() && /Start a new company/.test(A.login().textContent) && !/working for today/.test(A.login().textContent), 'in two companies, the whole list too (no question about today first)');

  /* ===== MoveCrew's call center team: not asked, even in a company of their own ===== */
  A = await open([A_ID], { me: RICH, db: { __ccTeam: { [RICH.uid]: 'Rich' }, __ccOrgs: [{ id: B_ID, name: 'Bright Moves' }, { id: C_ID, name: 'Rich Side Hauling' }] } });
  ok(!A.login() && A.w.__tallyBooted, 'on the call center team and in one company: not asked (the call center picks from Companies)');

  /* ===== back in the app on a new day ===== */
  A = await open([A_ID, B_ID], { day: tag(today(), [A_ID, B_ID]) });
  ok(!A.login() && A.w.__tallyBooted, 'working in Ace Moving');
  const realBusy = A.w.tallyBusy;
  A.w.localStorage.setItem('tally.orgDay', tag(yesterday(), [A_ID, B_ID]));   // the app stayed open overnight
  A.w.tallyBusy = () => true;   // changes from last night still on their way to the office
  A.w.document.dispatchEvent(new A.w.Event('visibilitychange')); await sleep(30);
  ok(!A.login(), 'back in the app with changes still on their way: not asked yet');
  A.w.tallyBusy = realBusy;
  A.w.document.dispatchEvent(new A.w.Event('visibilitychange')); await sleep(30);
  ok(A.login() && /working for today/.test(A.login().textContent) && /last time/.test(A.btn(A_ID).textContent), 'once they have gone: which company today, the one open marked');
  ok(A.$('#view') && A.$('#view').textContent.length > 0 && A.w.document.documentElement.classList.contains('pre-auth'), 'the app waits underneath, as it was');
  A.click(A.btn(A_ID)); await sleep(30);
  ok(!A.login() && A.reloads() === 0 && !A.w.document.documentElement.classList.contains('pre-auth') && A.kept() === tag(today(), [A_ID, B_ID]), 'the same company: back to where they were, nothing started again');
  // the Windows app left on overnight: asked once it's been quiet half an hour, never while someone is using it
  A.w.localStorage.setItem('tally.orgDay', tag(yesterday(), [A_ID, B_ID]));
  A.w.document.dispatchEvent(new A.w.Event('pointerdown', { bubbles: true }));
  await A.w.__tallyDayCheck(true); await sleep(20);
  ok(!A.login(), 'someone using the app is never interrupted by the question');
  const now0 = A.w.Date.now, t0 = now0.call(A.w.Date);
  A.w.Date.now = () => t0 + 31 * 60e3;   // half an hour with nobody touching it
  await A.w.__tallyDayCheck(true); await sleep(30);
  A.w.Date.now = now0;
  ok(A.login() && /working for today/.test(A.login().textContent), 'left alone half an hour on a new day: the question is waiting for whoever comes in');
  ok(A.calls.rpc.filter((c) => c.name === 'my_orgs').length === 2, 'their companies were looked at again (a company that added them since would show)');
  A.click('#pkOut'); await sleep(20);
  ok(A.kept() === null && A.org() === null && A.reloads() === 1, 'Sign out forgets today’s company');

  /* ===== a switch with changes still on their way: a second tap ===== */
  A = await open([A_ID, B_ID], { day: tag(today(), [A_ID, B_ID]) });
  A.w.tallyBusy = () => true;
  A.click('#brandCo button.cosw'); await sleep(10);
  ok(/Some changes haven’t reached the office yet/.test(A.$('#more').textContent), 'changes still on their way: the list says so');
  A.click('#more [data-act="co:use"][data-org="' + B_ID + '"]'); await sleep(10);
  ok(A.reloads() === 0 && /Tap again to switch anyway/.test(A.$('#more [data-org="' + B_ID + '"]').textContent), 'the first tap holds it');
  A.click('#more [data-act="co:use"][data-org="' + B_ID + '"]'); await sleep(10);
  ok(A.reloads() === 1 && A.org() === B_ID, 'a second tap switches anyway');
  A = await open([A_ID, B_ID], { day: tag(today(), [A_ID, B_ID]) });
  A.click('#brandCo button.cosw'); await sleep(10);
  A.click('#more [data-act="co:other"]'); await sleep(10);
  ok(A.reloads() === 1 && A.org() === null && A.w.sessionStorage.getItem('tally.pickAll') === '1', 'Start or join another company: the whole list');
  ok(A.errors.length === 0, 'no errors (' + A.errors.slice(0, 3).join(' | ') + ')');

  /* ===== the claude.ai artifact has one company: none of this ===== */
  const ART = await load(__dirname + '/../../build/tally-artifact.html', {});
  ART.click('[data-act="more:open"]'); await sleep(10);
  ok(!ART.$('[data-act="more:company"]') && !ART.$('#brandCo button.cosw'), 'the artifact: no Switch company, no switch at the top');

  process.exit(summary('companies') ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

// Walk-through videos in the app (Sales, batch 7, Nov 19; Richie: "The walk through videos should be saved to the crew
// notes so they can veiw it and see what they are in for"): how a job carries its videos (one key per part, like
// photos), a video walk-through's room and the link in its text, Start video call where it can run (the hosted app)
// and where it says it can't (the claude.ai copy), the videos in the crew's notes and on the job sheet (folded or not),
// watching one, the office deleting one, the customer app's Join, and the office's MoveCrew asking for the clear-out of
// videos 30 days after the move is paid. The call itself runs in a real browser: walkcall.js.
const { load, ok, sleep, summary } = require('./lib');
const ART = __dirname + '/../../build/tally-artifact.html', HOSTED = __dirname + '/../../build/tally-supabase.html';
const L = (m) => 'walkvideo: ' + m;
const txt = (el) => { if (!el) return ''; const out = []; const walk = (n) => { if (n.nodeType === 3) out.push(n.nodeValue); else if (n.nodeType === 1) { out.push(' '); n.childNodes.forEach(walk); out.push(' '); } }; walk(el); return out.join('').replace(/\s+/g, ' ').replace(/ ([.,:;)]|’s)/g, '$1').replace(/\( /g, '(').trim(); };
const NOW = Date.now(), DAY = 864e5;
const day = (n) => { const d = new Date(NOW + n * DAY); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const V = (id, part, at, secs, path) => ({ id: id + '-' + part, call: id, part, path: path || 'org-1/x/' + id + '-' + part + '.mp4', at, secs, bytes: 1e6, type: 'video/mp4', by: 'Dee' });

(async () => {
  /* ---------- the claude.ai copy ---------- */
  const A = await load(ART, {});
  const { w, $, $$, click, T } = A;
  const st = () => T.state();
  const S0 = st().jobs.find((j) => j.d.name === 'Sam Kowalski'), id = S0.id;
  // a job's videos travel like its photos: one key per part
  S0.walkVids = [V('c1', 2, NOW - 5e5, 130), V('c1', 1, NOW - 10e5, 480)];
  const d0 = T.jobDoc(S0);
  ok(d0.walkVids && Object.keys(d0.walkVids).sort().join(',') === 'c1-1,c1-2' && d0.walkVids['c1-1'].secs === 480, L('on its way to the database: a map, one key per part'));
  const back = T.docToJob(d0);
  ok(back.walkVids.map((v) => v.id).join(',') === 'c1-1,c1-2', L('and back: the parts in order'));
  const d1 = JSON.parse(JSON.stringify(d0)); d1.walkVids['c9-1'] = V('c9', 1, NOW, 30);
  ok(JSON.stringify(T.jobDiff(d0, d1)) === JSON.stringify({ walkVids: { 'c9-1': d1.walkVids['c9-1'] } }), L('a new part changes just its own key (two phones never write over each other)'));
  delete S0.walkVids;
  ok(!('walkVids' in T.jobDoc(S0)) && !('walkVids' in T.docToJob(T.jobDoc(S0))), L('a job with none has none'));
  ok(T.walkMinsW(22) === '22 sec' && T.walkMinsW(480) === '8 min' && T.walkMinsW(0) === '1 sec', L('how long: 22 sec, 8 min'));

  // which videos are due to go (the office's MoveCrew asks the server to clear them)
  const due = (o) => T.walkDueC(Object.assign({ payments: [], log: [] }, o));
  ok(due({ status: 'paid', payments: [{ amt: 500, date: day(-31) }] }) === true && due({ status: 'paid', payments: [{ amt: 500, date: day(-10) }] }) === false, L('a paid move’s videos are due 30 days after it’s paid'));
  ok(due({ status: 'lost', sales: { lost: { at: NOW - 40 * DAY } } }) === true && due({ status: 'lost', sales: { lost: { at: NOW - 5 * DAY } } }) === false && due({ status: 'booked' }) === false, L('a lost lead’s 30 days after; never a move still ahead'));

  // Sales: the walk-through panel in the claude.ai copy says where calls run
  T.ui.tab = 'quotes'; Object.assign(T.ui, { slf: 'open', sp: null }); T.render(); await sleep(15);
  const card = () => $('#ccList .scard[data-job="' + id + '"]');
  const panelOpen = async () => { if (!card().querySelector('.spanel')) { click(card().querySelector('[data-act="sl:p"][data-m="sv"]')); await sleep(15); } };
  await panelOpen();
  const pan = txt(card().querySelector('.spanel'));
  ok(/MoveCrew runs the video call in the app \(the website, Windows or Android\): Sam joins from the link in the text, and it’s saved to the crew notes\./.test(pan) && !card().querySelector('[data-act="wk:start"]'), L('the claude.ai copy: where the video call runs, and no Start button'));
  click('#ccList [data-act="sl:svk"][data-k="voice"]'); await sleep(10);
  ok(!/MoveCrew runs the video call/.test(txt(card().querySelector('.spanel'))), L('not for a voice call'));
  click('#ccList [data-act="sl:svk"][data-k="video"]'); await sleep(10);
  click('#ccList [data-act="sl:sv"][data-id="' + id + '"]'); await sleep(15);
  ok(S0.survey && S0.survey.kind === 'video' && /^[A-Za-z0-9_-]{16}$/.test(S0.survey.room), L('a video walk-through gets its room when it’s set: ' + (S0.survey && S0.survey.room)));
  const room0 = S0.survey.room;
  await panelOpen();
  click('#ccList [data-act="sl:sv"][data-id="' + id + '"]'); await sleep(15);
  ok(S0.survey.room === room0, L('changed: the same room (the link they have still works)'));
  ok(/^Hi Sam, your video walk-through is set for .+ Dispatch will video call you at|^Hi Sam, your video walk-through is set for .+ will video call you at/.test(T.surveyText(S0, false)) && T.walkLink(S0) === '', L('the claude.ai copy: no link in the text (calls run in the app)'));
  S0.survey = null; T.ui.sp = null; T.render(); await sleep(10); await panelOpen();
  click('#ccList [data-act="sl:svk"][data-k="voice"]'); await sleep(10);
  click('#ccList [data-act="sl:sv"][data-id="' + id + '"]'); await sleep(15);
  ok(S0.survey.kind === 'voice' && !S0.survey.room, L('a voice walk-through has no room'));

  // a booked job with a video: the crew's notes and the job sheet
  const B = st().jobs.find((j) => j.status === 'booked' && (j.assign.crew || []).length);
  B.walkVids = [V('c2', 1, NOW - 2 * DAY, 300, 'org-1/' + B.id + '/c2-1.mp4')];
  const crew = B.assign.crew[0];
  st().ui.role = (st().settings.leads || []).indexOf(crew) >= 0 ? 'lead' : 'crew'; st().ui.me = crew; T.ui.tab = 'today'; T.render(); await sleep(20);
  let cc = $('.crewcard[data-job="' + B.id + '"]');
  if (!cc) { T.ui.tab = 'jobs'; T.render(); await sleep(20); await A.openCard(B.id); cc = $('.crewcard[data-job="' + B.id + '"]'); }
  const wv = cc && cc.querySelector('.cc-sec .wkv');
  ok(!!wv && wv.closest('.cc-sec').querySelector('h4').textContent === 'Notes for the job', L(crew + '’s card: the video is in Notes for the job'));
  ok(/^▶ Walk-through video .+ · 5 min · by Dee it plays in the MoveCrew app\.$/.test(txt(wv)) && !wv.querySelector('[data-act="wk:watch"]'), L('the claude.ai copy says where it plays: ' + txt(wv)));
  st().ui.role = 'owner'; T.ui.tab = 'today'; T.render(); await sleep(10);
  T.openJob(B.id); await sleep(20);
  const fold = $('#sheet details[data-k="sh:Job notes"]');
  ok(fold && /walk-through video$/.test(txt(fold.querySelector('summary'))), L('the job sheet: Job notes, folded, says there’s a video: ' + txt(fold && fold.querySelector('summary'))));
  ok(/The crew on the job sees it in the job’s notes\. It’s deleted 30 days after the move is paid\./.test(txt($('#sheet .wkv'))) && !$('#sheet [data-act="wk:rm"]'), L('inside: what happens to it (no Delete here: that’s the server’s)'));
  T.ui.jobId = null; $('#sheet').hidden = true;
  ok(A.errors.length === 0, L('the claude.ai copy: no errors (' + A.errors.slice(0, 3).join(' | ') + ')'));

  /* ---------- the hosted app ---------- */
  const ORG = 'org-1';
  const drow = (path, data) => { const [collection, doc_id] = path.split('/'); return { org_id: ORG, path, collection, doc_id, data, updated_at: new Date().toISOString() }; };
  const base = (over) => Object.assign({ createdAt: NOW - DAY, items: [], tally: {}, payments: {}, signed: {}, extras: {}, crewNotes: {}, photos: {}, materials: {}, costs: {}, log: {}, confirm: {} }, over);
  const db = { docs: [drow('meta/init', { ts: 1 }),
    drow('org/settings', { company: 'Ace Moving', crew: ['Marcus'], leads: ['Marcus'], office: [{ name: 'Owner', kind: 'owner' }, { name: 'Dispatch', kind: 'dispatch' }], contacts: {}, trucks: [{ id: 't26', name: 'Box 1 (26 ft)', cf: 1700 }], forms: [] }),
    drow('jobs/q1', base({ id: 'q1', status: 'quoted', d: { name: 'Lena Wu', phone: '512-555-0150', email: 'lena@x.com', moveDate: day(8), time: '09:00', from: 'Austin', to: 'Waco', items: [], custom: {} },
      quote: { total: 900, cf: 400, crew: 2, hours: 4, lines: [] }, assign: { truckId: '', crew: [] }, sales: { owner: 'Dispatch', n: 1 } })),
    drow('jobs/p1', base({ id: 'p1', status: 'paid', d: { name: 'Old Move', phone: '', moveDate: day(-40), time: '08:00', items: [], custom: {} }, quote: { total: 800, lines: [] }, assign: { truckId: 't26', crew: ['Marcus'] },
      payments: { pay1: { id: 'pay1', amt: 800, date: day(-35), ts: NOW - 35 * DAY } }, walkVids: { 'c7-1': V('c7', 1, NOW - 45 * DAY, 200, 'org-1/p1/c7-1.mp4') } })),
    drow('jobs/b1', base({ id: 'b1', status: 'booked', d: { name: 'Kai Ng', phone: '512-555-0177', moveDate: day(2), time: '08:00', items: [], custom: {} }, quote: { total: 700, lines: [] }, assign: { truckId: 't26', crew: ['Marcus'] },
      walkVids: { 'c8-1': V('c8', 1, NOW - DAY, 480, 'org-1/b1/c8-1.mp4'), 'c8-2': V('c8', 2, NOW - DAY + 480e3, 90, 'org-1/b1/c8-2.mp4') } }))],
    access_requests: [], comm_lines: [{ org_id: ORG, phone_number: '+15125550000', enabled: true }], comm_log: [],
    members: [{ org_id: ORG, user_id: 'u-dispatch', email: 'd@x', staff: 'Dispatch', role: 'dispatch', ts: 1 }] };
  const fnCalls = [];
  const D = await load(HOSTED, { db, org: ORG, me: { uid: 'u-dispatch', email: 'd@x' }, fnReply: (b) => {
    fnCalls.push(b);
    if (b.action === 'sales_text') return { ok: true, message: 'Texted Lena Wu.' };
    if (b.action === 'walk_watch') return { ok: true, url: 'https://proj.supabase.co/storage/v1/object/sign/walk-videos/' + b.id + '.mp4?token=x', until: Date.now() + 3 * 36e5 };
    if (b.action === 'walk_remove') return { ok: true };
    if (b.action === 'walk_sweep') return { ok: true, removed: 1 };
    return { ok: true, sent: 0 };
  } });
  await sleep(300);
  const HT = D.T, hs = () => HT.state(), q1 = () => hs().jobs.find((j) => j.id === 'q1');
  // the office's MoveCrew asks the server to clear what's due, once (p1 was paid 35 days ago)
  ok(fnCalls.filter((b) => b.action === 'walk_sweep').length === 1 && D.w.localStorage.getItem('tally.walkSweep.org-1') > 0, L('hosted: the office’s MoveCrew asks for the clear-out of a video that’s due, once'));
  HT.walkSweepSoon(); HT.walkW.swept = false; HT.walkSweepSoon();
  ok(fnCalls.filter((b) => b.action === 'walk_sweep').length === 1, L('and not again within 12 hours on this device'));
  // Sales: Start the video call, and the link in the text
  D.click('#tabs [data-act="tab"][data-tab="quotes"]'); await sleep(20);
  D.click('#ccList [data-act="sl:p"][data-m="sv"][data-id="q1"]'); await sleep(20);
  ok(txt(D.$('#ccList .scard[data-job="q1"] .spanel [data-act="wk:start"]')) === 'Start the video call', L('hosted: the walk-through panel has Start the video call'));
  D.click('#ccList [data-act="sl:sv"][data-id="q1"]'); await sleep(400);
  const room = q1().survey.room, st1 = fnCalls.find((b) => b.action === 'sales_text');
  ok(/^[A-Za-z0-9_-]{16}$/.test(room) && HT.walkLink(q1()) === 'https://tally.example.com/walk.html?w=org-1.q1.' + room, L('hosted: the link: ' + HT.walkLink(q1())));
  ok(st1 && st1.body.indexOf('At that time, open this link on your phone to join: https://tally.example.com/walk.html?w=org-1.q1.' + room + ' Dispatch will be on the call, so be ready to show us what’s moving. Reply here to change the time.') > 0, L('hosted: the text Lena gets has it: ' + (st1 && st1.body)));
  const sc = D.$('#ccList .scard[data-job="q1"]');
  ok(!!sc.querySelector('.sbtns [data-act="wk:start"]') && txt(sc.querySelector('.sbtns [data-act="wk:start"]')) === 'Start video call' && !sc.querySelector('.sbtns [data-act="wk:start"]').classList.contains('primary'), L('the lead’s card: Start video call (plain until it’s time)'));
  q1().survey = Object.assign({}, q1().survey, { at: Date.now() + 5 * 6e4 }); HT.render(); await sleep(15);
  ok(D.$('#ccList .scard[data-job="q1"] .sbtns [data-act="wk:start"]').classList.contains('primary'), L('from 10 minutes before: the main button'));
  ok(/^Hi Lena, we’re ready for your video walk-through now\. Open this link on your phone to join: https:\/\/tally\.example\.com\/walk\.html\?w=org-1\.q1\.[A-Za-z0-9_-]{16} Dispatch is on the call, so be ready to show us what’s moving\.$/.test(HT.surveyText(q1(), true)), L('at the time, the text says to join now: ' + HT.surveyText(q1(), true)));
  // no video calls in this browser (jsdom has none): it says so, and nothing starts
  D.click('#ccList .scard[data-job="q1"] .sbtns [data-act="wk:start"]'); await sleep(20);
  ok(D.$('#toast').textContent === 'This device can’t run video calls. Use MoveCrew in Chrome, Edge or Safari, or the Windows app.' && !HT.wk(), L('a browser without video calls: ' + D.$('#toast').textContent));
  // the customer app: Join, from half an hour before
  const m0 = HT.custMoveOf(q1(), hs().settings);
  ok(m0.survey && m0.survey.w === 'org-1.q1.' + room, L('the customer’s copy has the link’s code'));
  const ch = HT.custSurveyHtml(m0);
  ok(/Dispatch will be on the call\./.test(ch) && /href="https:\/\/tally\.example\.com\/walk\.html\?w=org-1\.q1\.[A-Za-z0-9_-]{16}">Join the video walk-through<\/a>/.test(ch), L('their app, at the time: Join the video walk-through'));
  m0.survey.at = Date.now() + 5 * 36e5;
  ok(/Join from the link in our text, or here when it’s time\./.test(HT.custSurveyHtml(m0)) && !/Join the video walk-through/.test(HT.custSurveyHtml(m0)), L('hours ahead: it says where to join, without the button yet'));
  // the job sheet: watch it, delete a part
  HT.openJob('b1'); await sleep(30);
  const sv = D.$('#sheet .wkv');
  ok(/^▶ Walk-through video .+ · 10 min · by Dee Watch part 1 8 min Delete Watch part 2 2 min Delete/.test(txt(sv)), L('the job sheet: a video in two parts, Watch and Delete each: ' + txt(sv)));
  D.click(D.$$('#sheet [data-act="wk:watch"]')[0]); await sleep(40);
  const pv = D.$('#wkPlay video');
  ok(!D.$('#wkPlay').hidden && pv && pv.getAttribute('src') === 'https://proj.supabase.co/storage/v1/object/sign/walk-videos/c8-1.mp4?token=x' && fnCalls.some((b) => b.action === 'walk_watch' && b.jobId === 'b1' && b.id === 'c8-1'), L('Watch: the server’s link plays in the player'));
  ok(/^Walk-through video · part 1 of 2 Kai Ng · .+ · 8 min · by Dee Close/.test(txt(D.$('#wkPlay .wkp-top'))) && txt(D.$('#wkPlay .wkp-nav')) === 'Part 2 ›', L('the player: part 1 of 2, and Part 2 next: ' + txt(D.$('#wkPlay .wkp-top'))));
  D.click('#wkPlay [data-act="wk:watch"]'); await sleep(40);
  ok(D.$('#wkPlay video').getAttribute('src').indexOf('c8-2.mp4') > 0 && txt(D.$('#wkPlay .wkp-nav')) === '‹ Part 1', L('Part 2 ›'));
  D.w.document.dispatchEvent(new D.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(20);
  ok(D.$('#wkPlay').hidden && !HT.walkW.play, L('Escape closes the player'));
  HT.openJob('b1'); await sleep(20);
  D.click(D.$$('#sheet [data-act="wk:rm"]')[1]); await sleep(20);
  ok(/^Delete part 2 of this video\? It can’t be brought back\. Delete Keep it$/.test(txt(D.$('#sheet .wkv-rm'))), L('Delete asks first: ' + txt(D.$('#sheet .wkv-rm'))));
  D.click('#sheet [data-act="wk:rmno"]'); await sleep(20);
  ok(!D.$('#sheet .wkv-rm') && hs().jobs.find((j) => j.id === 'b1').walkVids.length === 2, L('Keep it'));
  D.click(D.$$('#sheet [data-act="wk:rm"]')[1]); await sleep(20);
  D.click('#sheet [data-act="wk:rmyes"]'); await sleep(60);
  const b1 = hs().jobs.find((j) => j.id === 'b1');
  ok(fnCalls.some((b) => b.action === 'walk_remove' && b.jobId === 'b1' && b.id === 'c8-2') && b1.walkVids.map((v) => v.id).join(',') === 'c8-1' && D.$('#toast').textContent === 'Video deleted.', L('Delete: the server deletes it, and it’s gone here'));
  ok(!D.calls.writes.some((x) => /walkVids/.test(JSON.stringify(x))), L('the app never writes a video onto a job itself (the server does)'));
  ok(D.errors.length === 0, L('hosted: no errors (' + D.errors.slice(0, 3).join(' | ') + ')'));
  process.exit(summary('walkvideo') ? 1 : 0);
})().catch((e) => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });

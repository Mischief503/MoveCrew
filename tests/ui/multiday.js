// Moves over more than one day (batch 10, Nov 22). From Richie's gap list: moves over more than one day: load one day
// and deliver the next, or a big job across several days. Each day on the schedule with the truck held overnight, the
// crew lead's End day 1 and Start day 2, and the bill and pay without the nights. Run against either edition:
// node tests/ui/multiday.js <file> <label>
const { load, ok, sleep, summary, clone } = require('./lib');
const file = process.argv[2] || __dirname + '/../../build/tally-artifact.html', label = process.argv[3] || 'multiday';
const L = (m) => label + ': ' + m;
const H = 36e5;

(async () => {
  const A = await load(file, {});
  const { w, $, $$, click, T, go } = A;
  const st = () => T.state(), S = () => st().settings;
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const addDays = (day, n) => { const d = new w.Date(day + 'T12:00'); d.setDate(d.getDate() + n); return iso(d); };
  const today = iso(new w.Date());
  const view = () => $('#view').textContent.replace(/\s+/g, ' ');
  const sheet = () => ($('#sheet') && !$('#sheet').hidden ? $('#sheet').textContent.replace(/\s+/g, ' ') : '');
  const toast = () => ($('#toast') ? $('#toast').textContent : '');
  const type = (sel, v) => { const e = typeof sel === 'string' ? $(sel) : sel; e.value = v; e.dispatchEvent(new w.Event('input', { bubbles: true })); e.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const draft = (o) => Object.assign(T.blankDraft(), { name: 'X' }, o || {});
  const txt = (q) => q.lines.map((l) => l.label + ' ' + l.amt).join(' | ');
  // two days in a row with nothing on them, three weeks or more out
  const D = (() => { for (let i = 22; i < 60; i++) { const d = addDays(today, i); if (!T.schedRecs().some((r) => r.d.moveDate === d || r.d.moveDate === addDays(d, 1) || r.d.moveDate === addDays(d, 2))) return d; } })();
  const D2 = addDays(D, 1);

  /* ---------------- the days and their hours ---------------- */
  const big = { sofa3: 3, bedk: 2, bedq: 2, dresser: 4, dintable: 1, dinchair: 6, fridge: 1, washer: 1, dryer: 1, boxm: 80, boxl: 30 };
  ok(T.splitHours(7, 2, 0) === 3.5 && T.splitHours(7, 2, 1) === 3.5 && T.splitHours(7.5, 2, 0) === 4 && T.splitHours(7.5, 2, 1) === 3.5 && T.splitHours(9, 3, 2) === 3 && T.splitHours(5, 1, 0) === 5,
    L('the hours shared out over the days, to the half hour, the last day the rest'));
  const jd = { d: { moveDate: D, time: '08:00', days: [{ date: D2, time: '09:00' }, { date: '', time: '' }] } };
  ok(T.jobDays(jd).map((x) => x.date + ' ' + x.time).join() === D + ' 08:00,' + D2 + ' 09:00' && T.onDate(jd, D2).i === 1 && T.onDate(jd, D2).of === 2 && !T.onDate(jd, addDays(D, 2)), L('a job’s days (one with no date yet doesn’t count), and the day it is on a date'));
  let q = T.calc(draft({ moveDate: D, items: big }), S());
  const q2 = T.calc(draft({ moveDate: D, items: big, days: [{ date: D2, time: '08:00' }] }), S());
  ok(q2.total === q.total && q2.hours === q.hours && !/overnight/.test(txt(q2)), L('two days: the same price (the hours are the hours), no night fee to start'));
  const S150 = Object.assign(clone(S()), { nightFee: 150 });
  const q3 = T.calc(draft({ moveDate: D, items: big, days: [{ date: D2, time: '08:00' }] }), S150);
  ok(/Truck held overnight: 1 night 150/.test(txt(q3)) && q3.total === q.total + 150, L('with a night fee in Options: “Truck held overnight: 1 night” $150: ' + txt(q3)));

  /* ---------------- the quote ---------------- */
  click('#fab'); await sleep(15);
  type('[data-d="name"]', 'Lindqvist Estate');
  type('[data-d="moveDate"]', D); type('[data-d="time"]', '08:00');
  ok($('#qDays') && $('#qDays').value === '1', L('a new quote has Days: One day'));
  type('#qDays', '2'); await sleep(10);
  ok(st().draft.days.length === 1 && st().draft.days[0].date === D2 && st().draft.days[0].time === '08:00' && $('[data-dday="0"][data-k="date"]').value === D2, L('Days: 2 days adds day 2, the next day at the same time'));
  st().draft.items = clone(big);
  click('[data-act="q:step"][data-s="3"]'); await sleep(20);
  const dp = () => ($('#dayPlan') ? $('#dayPlan').textContent.replace(/\s+/g, ' ') : '');
  ok(/Day 1 · /.test(dp()) && /Day 2 · /.test(dp()) && /It fits that day/.test(dp()), L('the day under the price: day 1 to put in a slot, day 2 below it'));
  ok(T.laterDayMiss(st().draft, T.calc(st().draft, S()), S()) === null, L('every day fits'));
  click('[data-act="q:book"]'); await sleep(30);
  const J = st().jobs.find((j) => j.d.name === 'Lindqvist Estate');
  ok(J && J.status === 'booked' && J.d.days.length === 1 && J.d.days[0].date === D2, L('booked over two days'));

  /* ---------------- the schedule ---------------- */
  const BOX1 = S().trucks.find((t) => t.name.indexOf('Box 1') === 0).id;
  J.assign = { truckId: BOX1, more: [], crew: ['Marcus', 'Dee', 'Luis'] };
  const sp = T.daySpans(J);
  ok(sp.length === 2 && sp[0].he === 420 + 12 * 60 && sp[1].hs === 420 && sp[0].s === 480 && sp[1].e === 480 + Math.round(T.dayHoursOf(J, 1) * 60), L('the truck is held to the end of day 1 and from the start of day 2'));
  let P = T.planDay(D, T.schedRecs(), S()), P2 = T.planDay(D2, T.schedRecs(), S());
  ok(P.lanes[BOX1].some((b) => b.r.id === J.id && b.day === 1 && b.of === 2) && P2.lanes[BOX1].some((b) => b.r.id === J.id && b.day === 2), L('on the schedule on both days, in its truck’s slot'));
  const needBox1 = { hours: 2, crew: 2, trucks: 1, cf: 1500 };   // only Box 1 is big enough
  ok(T.fitAt(P, needBox1, T.hmMin('16:30')).why === 'busy' && T.fitAt(P2, needBox1, T.hmMin('07:00')).why === 'busy' && T.fitAt(T.planDay(addDays(D, 2), T.schedRecs(), S()), needBox1, T.hmMin('08:00')).ok,
    L('its truck stays taken overnight: not free the evening of day 1 or the morning of day 2; free the day after'));
  const O = clone(J); O.id = 'md-other'; O.d = Object.assign({}, O.d, { name: 'Evening Job', time: '17:00', days: [] }); O.quote = Object.assign({}, O.quote, { hours: 2 }); O.assign = { truckId: BOX1, more: [], crew: ['Tanya'] };
  st().jobs.push(O);
  ok(T.conflictsFor(J).some((c) => c.other.id === O.id && /Box 1/.test(c.what)) && !T.conflictsFor(J).some((c) => c.what === 'Marcus'), L('a job in its truck that evening is double-booked; its crew is free after the day’s work'));
  st().jobs = st().jobs.filter((j) => j.id !== O.id);
  T.ui.weekStart = D2; T.ui.day = D2; await go('dispatch'); await sleep(10);
  ok(/Lindqvist Estate · day 2 of 2/.test(view()), L('the Board shows it on day 2: “day 2 of 2”'));

  /* ---------------- the crew ---------------- */
  const t0 = Date.now() - 30 * H;
  J.status = 'active'; J.startedAt = t0; J.phases = { loadStart: t0 + 0.5 * H, loadEnd: t0 + 6 * H };
  ok(T.canEndDay(J) && T.dayNow(J) === 1 && !T.jobPaused(J), L('a running two-day move on day 1 can end the day'));
  J.crewOn = { Marcus: [{ in: t0 }], Dee: [{ in: t0 }] };
  T.endDay(J, 'Marcus');
  ok(T.jobPaused(J) && T.dayNow(J) === 1 && J.pauses.length === 1 && J.crewOn.Marcus[0].out > 0 && /Day 1 done at/.test(J.log[J.log.length - 1].ev), L('End day 1: stopped for the night, the crew off the job'));
  J.pauses[0].from = t0 + 6.5 * H;
  st().ui.role = 'lead'; st().ui.me = 'Marcus'; T.ui.tab = 'crew'; T.render(); await sleep(10);
  let card = $('#view .crewcard[data-job="' + J.id + '"]');
  ok(card && card.querySelector('[data-act="cr:resume"]') && card.querySelector('[data-act="cr:resume"]').textContent === 'Start day 2' && /Day 1 done, back /.test(card.textContent) && /The clock is stopped overnight/.test(card.textContent),
    L('the lead’s card: Start day 2, and when they’re back'));
  T.resumeDay(J, 'Marcus');
  J.pauses[0].to = t0 + 24 * H;
  ok(!T.jobPaused(J) && T.dayNow(J) === 2 && !T.canEndDay(J), L('Start day 2: running again, on its last day'));
  T.render(); await sleep(10);
  card = $('#view .crewcard[data-job="' + J.id + '"]');
  ok(card && !card.querySelector('[data-act="cr:endday"]') && /Night after day 1/.test(card.textContent), L('no End day on the last day; the night shows in the times'));
  st().ui.role = 'owner'; T.render(); await sleep(5);
  // the bill by the clock: 6.5 h on day 1, 3 h on day 2, not the night between
  J.phases = Object.assign({}, J.phases, { unloadStart: t0 + 25 * H, unloadEnd: t0 + 27 * H });
  J.quote = Object.assign({}, J.quote, { shopTravel: false, flat: false, kind: 'local' });
  const W = T.minusPauses(J, J.phases.loadStart, J.phases.unloadEnd, '');
  ok(W.length === 2 && W[0][1] === t0 + 6.5 * H && W[1][0] === t0 + 24 * H, L('the clock without the night: two stretches'));
  J.finishedAt = t0 + 27.2 * H;
  const c = T.clockBill(J);
  ok(c && !c.missing && Math.abs(c.worked - 9) < 0.01 && c.billed === 9 && c.rows.filter((r) => r.k === 'hours').length === 2 && /, \d{1,2}:\d\d [AP]M to /.test(c.rows[0].sub), L('billed 9 h: 6 on day 1 and 3 on day 2, a row each with its day: ' + c.rows.filter((r) => r.k === 'hours').map((r) => r.label + ' · ' + r.sub).join(' / ')));

  /* ---------------- the job sheet ---------------- */
  J.status = 'booked'; J.pauses = []; delete J.finishedAt; J.startedAt = 0; J.phases = {};
  await go('jobs'); T.openJob(J.id); await sleep(10);
  ok($('#shDays') && $('#shDays').value === '2' && $('#sheet [data-jday="0"][data-k="date"]').value === D2, L('the job sheet: Days and day 2’s date and start'));
  type('#shDays', '3'); await sleep(10);
  ok(J.d.days.length === 2 && J.d.days[1].date === addDays(D2, 1) && /Days: 3 days: /.test(J.log[J.log.length - 1].ev), L('three days: day 3 the day after, in the activity'));
  type('#shDays', '2'); await sleep(10);
  click('#sheet [data-act="sheet:close"]'); await sleep(5);

  /* ---------------- the customer ---------------- */
  const m = T.custMoveOf(J, S());
  ok(m.d.days.length === 1 && m.d.days[0].date === D2 && /^2-day move: /.test(T.custKindHtml(m).replace(/<[^>]+>/g, '')), L('their copy has the days: “2-day move: …”'));
  ok(T.custMoveOf(st().jobs.find((j) => j.id !== J.id && j.status === 'booked'), S()).d.days.length === 0, L('a one-day move’s copy has none'));

  /* ---------------- Options ---------------- */
  await go('settings', 'options'); await sleep(10);
  const sw = $('input[role="switch"][data-s="opt.multiDay"]'), nf = $('[data-s="nightFee"]');
  ok(sw && sw.checked && nf && nf.value === '0', L('Options › Moves over more than one day, on, with the night fee ($0 to start)'));
  sw.checked = false; sw.dispatchEvent(new w.Event('input', { bubbles: true })); await sleep(10);
  click('#fab'); await sleep(15);
  ok(!$('#qDays'), L('switched off: no Days on a new quote'));
  S().opt.multiDay = true; st().draft = T.blankDraft();

  ok(!A.errors.length, L('no errors: ' + A.errors.join(' | ')));
  process.exit(summary(label) ? 1 : 0);
})();

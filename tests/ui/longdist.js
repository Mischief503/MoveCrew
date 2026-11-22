// Long-distance moves (batch 12, Nov 22). From Richie's list of what MoveCrew was missing (Nov 21): long distance,
// the way interstate movers run it: priced by weight and distance, a delivery window, binding or non-binding
// estimates, weight tickets, and the 110% rule at delivery (49 CFR 375). Run against either edition:
// node tests/ui/longdist.js <file> <label>
const { load, ok, sleep, summary, clone } = require('./lib');
const file = process.argv[2] || __dirname + '/../../build/tally-artifact.html', label = process.argv[3] || 'longdist';
const L = (m) => label + ': ' + m;
const H = 36e5;

(async () => {
  const A = await load(file, {});
  const { w, $, $$, click, T, go } = A;
  const st = () => T.state(), S = () => st().settings;
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const addDays = (day, n) => { const d = new w.Date(day + 'T12:00'); d.setDate(d.getDate() + n); return iso(d); };
  const today = iso(new w.Date());
  const r2 = (n) => Math.round(n * 100) / 100;
  const view = () => $('#view').textContent.replace(/\s+/g, ' ');
  const sheet = () => ($('#sheet') && !$('#sheet').hidden ? $('#sheet').textContent.replace(/\s+/g, ' ') : '');
  const toast = () => ($('#toast') ? $('#toast').textContent : '');
  const type = (sel, v) => { const e = typeof sel === 'string' ? $(sel) : sel; e.value = v; e.dispatchEvent(new w.Event('input', { bubbles: true })); e.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const draft = (o) => Object.assign(T.blankDraft(), { name: 'X' }, o || {});
  const txt = (q) => q.lines.map((l) => l.label + ' ' + l.amt).join(' | ');
  // two weeks with nothing on them, three weeks or more out
  const D = (() => { for (let i = 22; i < 90; i++) { const d = addDays(today, i); if (!T.schedRecs().some((r) => r.d.moveDate >= d && r.d.moveDate <= addDays(d, 14))) return d; } })();
  const big = { sofa3: 3, bedk: 2, bedq: 2, dresser: 4, dintable: 1, dinchair: 6, fridge: 1, washer: 1, dryer: 1, boxm: 80, boxl: 30 };
  const PDX = '123 Main St, Portland, OR 97201', PHX = '4410 N 24th St, Phoenix, AZ 85016';
  const dl = (o) => draft(Object.assign({ moveDate: D, time: '08:00', moveKind: 'long', miles: '1300', items: clone(big), from: PDX, to: PHX }, o || {}));

  /* ---------------- the price ---------------- */
  ok(T.opt('longDist') && Array.isArray(S().ldRates) && S().ldRates.length === 6 && S().ldMinLbs === 2000 && S().ldEst === 'nb', L('Options › Long-distance moves on; the rates to start'));
  ok(T.ldRateFor(400, S()).r === 55 && T.ldRateFor(500, S()).r === 55 && T.ldRateFor(501, S()).r === 70 && T.ldRateFor(1300, S()).r === 82 && T.ldRateFor(2600, S()).r === 108, L('the rate per 100 lb by the miles: the first band they fit in'));
  let q = T.calc(dl(), S());
  const lbs = Math.round(q.cf * 7);
  ok(q.kind === 'long' && q.ld.lbs === lbs && q.ld.rate === 82 && /^Line haul: [\d,]+ lb at \$82 per 100 lb, 1,300 mi$/.test(q.lines[0].label) && q.lines[0].amt === Math.round(lbs / 100 * 82), L('by weight and distance: ' + txt(q)));
  ok(!q.flat && q.ld.est === 'nb' && q.ld.cap === r2(q.total * 1.1) && q.nte === 0 && q.hours > 0, L('non-binding to start: at delivery at most 110% (' + q.ld.cap + '), no estimated top price'));
  ok(!/movers|Truck and fuel|Mileage/.test(txt(q)), L('no hours, truck fee or miles on the price'));
  const qMin = T.calc(dl({ items: { boxm: 5 } }), S());
  ok(qMin.ld.bill === 2000 && /\(the 2,000-lb least\)/.test(qMin.lines[0].label), L('a small load: billed at the least weight: ' + qMin.lines[0].label));
  const qTyped = T.calc(dl({ ld: { lbs: 9000 } }), S());
  ok(qTyped.ld.lbs === 9000 && /^Line haul: 9,000 lb/.test(qTyped.lines[0].label), L('a weight typed on the quote wins'));
  const qB = T.calc(dl({ ld: { est: 'b' } }), S());
  ok(qB.flat && qB.ld.est === 'b' && qB.ld.cap === 0 && qB.total === q.total, L('binding: the same price, and the bill is the estimate'));
  const Sf = Object.assign(clone(S()), { ldFuelPct: 10 });
  const qF = T.calc(dl(), Sf);
  ok(qF.lines[1].label === 'Fuel surcharge (10% of the line haul)' && qF.lines[1].amt === Math.round(q.lines[0].amt * 0.1), L('a fuel surcharge, 10% of the line haul'));
  const Sa = Object.assign(clone(S()), { ldMiles: 500 });
  ok(T.moveKind(draft({ miles: '600' }), Sa) === 'long' && T.moveKind(draft({ miles: '300' }), Sa) === 'mileage' && T.moveKind(draft({ miles: '600' }), S()) === 'mileage', L('long distance by distance only with a line set in the Rate card'));
  const Soff = clone(S()); Soff.opt = Object.assign({}, Soff.opt, { longDist: false });
  ok(T.moveKind(dl(), Soff) !== 'long' && T.calc(dl(), Soff).kind !== 'long', L('Options off: no long-distance moves'));
  ok(T.addrState(PHX) === 'AZ' && T.addrState('Austin, TX') === 'TX' && T.addrState('Portland') === '' && T.ldInter(dl()) === true && T.ldInter(draft({ from: 'A, OR 97201', to: 'B, OR 97301' })) === false && T.ldInter(draft({ from: 'here', to: 'there' })) === null,
    L('interstate from the addresses’ states'));

  /* ---------------- the window and the delivery day ---------------- */
  const d2 = dl();
  T.ldSync(d2, S());
  ok(d2.ld.w0 === addDays(D, 3) && d2.ld.w1 === addDays(D, 8) && d2.days.length === 1 && d2.days[0].ld === 'deliver' && !d2.days[0].set && d2.days[0].date === addDays(D, 8) && d2.days[0].back === 3 && d2.days[0].crew === true,
    L('the window: 3 days on the road (1,300 mi at 500 a day), 5 days long; the truck held to its last day'));
  d2.ld.day = addDays(D, 4); T.ldSync(d2, S());
  ok(d2.days[0].date === addDays(D, 4) && d2.days[0].set, L('the delivery day set'));
  d2.moveKind = 'local'; T.ldSync(d2, S());
  ok(d2.days.length === 0, L('made local again: no delivery day'));

  /* ---------------- the quote screen ---------------- */
  click('#fab'); await sleep(15);
  type('[data-d="name"]', 'Ortiz Family');
  type('[data-d="moveDate"]', D); type('[data-d="time"]', '08:00');
  type('[data-d="from"]', PDX); type('[data-d="to"]', PHX); type('[data-d="miles"]', '1300');
  st().draft.items = clone(big);
  click('[data-act="q:step"][data-s="3"]'); await sleep(20);
  ok(!!$('[data-d="moveKind"] option[value="long"]'), L('Move type has Long distance'));
  type('[data-d="moveKind"]', 'long'); await sleep(20);
  const lines = () => ($('#qLines') ? $('#qLines').textContent.replace(/\s+/g, ' ') : '');
  ok($('#ldSum') && /^Long distance · non-binding · delivery between /.test($('#ldSum').textContent) && /Line haul: /.test(lines()) && /At delivery, at most \(110%\)/.test(lines()), L('the Long distance part and the price: ' + ($('#ldSum') || {}).textContent));
  ok(/Interstate/.test($('#kindNote').textContent) && /Non-binding estimate/.test($('#kindNote').textContent), L('the note: non-binding, and interstate (the booklets)'));
  type('[data-ld="est"]', 'b'); await sleep(10);
  ok(/Binding estimate: the bill is this price/.test(lines()) && /binding/.test($('#ldSum').textContent), L('Binding: the bill is the price'));
  type('[data-ld="est"]', 'nb'); await sleep(10);
  type('[data-ld="day"]', addDays(D, 5)); await sleep(10);
  ok(st().draft.days[0].date === addDays(D, 5) && st().draft.days[0].set && /delivery /.test($('#ldSum').textContent), L('the delivery day on the quote'));
  type('[data-ld="day"]', ''); await sleep(10);
  ok(st().draft.days[0].date === addDays(D, 8) && !st().draft.days[0].set, L('cleared: the window’s last day holds the truck again'));
  const dp = () => ($('#dayPlan') ? $('#dayPlan').textContent.replace(/\s+/g, ' ') : '');
  ok(/Loading day/.test(dp()) && /Delivery window ends · /.test(dp()), L('under the price: the loading day, then the window’s last day'));
  click('[data-act="q:book"]'); await sleep(30);
  if (!st().jobs.find((j) => j.d.name === 'Ortiz Family')) { click('[data-act="q:book"]'); await sleep(30); }
  const J = st().jobs.find((j) => j.d.name === 'Ortiz Family');
  ok(J && J.status === 'booked' && J.quote.kind === 'long' && J.d.days.length === 1 && J.d.days[0].ld === 'deliver' && J.d.ld.est === 'nb', L('booked, with its delivery day'));

  /* ---------------- the schedule ---------------- */
  const BOX1 = S().trucks.find((t) => t.name.indexOf('Box 1') === 0).id;
  J.assign = { truckId: BOX1, more: [], crew: ['Marcus', 'Dee', 'Luis'] };
  let R = T.roadDays(J);
  ok(R.filter((x) => x.what === 'out').length === 7 && R.filter((x) => x.what === 'back').length === 3 && R[0].date === addDays(D, 1) && R[R.length - 1].date === addDays(D, 11), L('on the road the 7 days between, and 3 days driving back'));
  const P = T.planDay(addDays(D, 2), T.schedRecs(), S());
  ok(P.lanes[BOX1].some((b) => b.r.id === J.id && b.road === 'out' && b.hs === 0 && b.he === 1440 && b.movers === Math.max(J.quote.crew, 3)), L('a road day on the day plan: the whole day, its truck and its crew'));
  const needBox1 = { hours: 2, crew: 2, trucks: 1, cf: 1500 };
  ok(T.fitAt(P, needBox1, T.hmMin('08:00')).why === 'busy' && T.fitAt(T.planDay(addDays(D, 12), T.schedRecs(), S()), needBox1, T.hmMin('08:00')).ok, L('its truck isn’t free on the road; free once it’s back'));
  ok(T.planDay(addDays(D, 9), T.schedRecs(), S()).lanes[BOX1].some((b) => b.r.id === J.id && b.road === 'back'), L('driving back after the delivery'));
  const O = clone(J); O.id = 'ld-other'; O.d = Object.assign({}, O.d, { name: 'Local Job', moveDate: addDays(D, 3), days: [], moveKind: 'local' }); O.quote = Object.assign({}, O.quote, { kind: 'local', hours: 3 }); O.assign = { truckId: BOX1, more: [], crew: ['Tanya'] };
  st().jobs.push(O);
  ok(T.conflictsFor(J).some((c) => c.other.id === O.id && /Box 1/.test(c.what)) && T.conflictsFor(O).some((c) => c.other.id === J.id) && !T.conflictsFor(J).some((c) => c.what === 'Tanya'), L('a job in its truck on a road day is double-booked'));
  O.assign.crew = ['Marcus'];
  ok(T.conflictsFor(J).some((c) => c.what === 'Marcus'), L('and its crew, who go with the truck'));
  st().jobs = st().jobs.filter((j) => j.id !== O.id);
  ok(T.schedOf(J).d.days[0].ld === 'deliver' && T.schedOf(J).d.days[0].back === 3 && T.schedOf(J).d.days[0].crew === true, L('the schedule’s copy keeps the delivery day and the drive back'));
  T.ui.weekStart = addDays(D, 2); T.ui.day = addDays(D, 2); await go('dispatch'); await sleep(10);
  ok(/On the road · Ortiz Family/.test(view()) && /on the road all day/.test(view()), L('the Board on a road day: “On the road · Ortiz Family”'));

  /* ---------------- the job sheet ---------------- */
  await go('jobs'); T.openJob(J.id); await sleep(10);
  ok(/Long distance/.test(sheet()) && /Non-binding estimate/.test(sheet()) && /delivery day not set/.test(sheet()) && /Your Rights and Responsibilities When You Move/.test(sheet()) && !$('#shDays'), L('the sheet’s Long distance part (and no Days)'));
  const dayIn = $('#sheet [data-ldj="day"]'); dayIn.value = addDays(D, 5); dayIn.dispatchEvent(new w.Event('change', { bubbles: true })); await sleep(10);
  ok(J.d.ld.day === addDays(D, 5) && J.d.days[0].date === addDays(D, 5) && J.d.days[0].set && /^Delivery day set: /.test(J.log[J.log.length - 1].ev), L('Set the delivery day: in the activity'));
  R = T.roadDays(J);
  ok(R.filter((x) => x.what === 'out').length === 4 && R[R.length - 1].date === addDays(D, 8), L('the truck frees up after it'));
  click('#sheet [data-act="sheet:close"]'); await sleep(5);
  T.ui.weekStart = addDays(D, 5); T.ui.day = addDays(D, 5); await go('dispatch'); await sleep(10);
  ok(/Ortiz Family · delivery/.test(view()), L('the Board on the delivery day: “· delivery”'));

  /* ---------------- the crew lead: the weights and the bill ---------------- */
  const est = J.quote.total, net = Math.ceil(J.quote.ld.lbs * 1.4);
  J.d.moveDate = today; J.status = 'active'; J.startedAt = Date.now() - 3 * H;
  st().ui.role = 'lead'; st().ui.me = 'Marcus'; T.ui.tab = 'crew'; T.render(); await sleep(10);
  let card = $('#view .crewcard[data-job="' + J.id + '"]');
  ok(card && card.querySelector('#wt_t_' + J.id) && card.querySelector('#wt_g_' + J.id) && /Weights/.test(card.textContent) && card.querySelector('[data-kind="Weight ticket"]'), L('the lead’s card: Weights, and a scale ticket photo'));
  $('#wt_t_' + J.id).value = '30000'; $('#wt_g_' + J.id).value = '20000'; click('[data-act="cr:wt"][data-id="' + J.id + '"]'); await sleep(10);
  ok(!J.wt && /should weigh more/.test(toast()), L('loaded lighter than empty: it says so'));
  $('#wt_t_' + J.id).value = '26000'; $('#wt_g_' + J.id).value = String(26000 + net); click('[data-act="cr:wt"][data-id="' + J.id + '"]'); await sleep(10);
  const wb = T.ldWeightBill(J);
  ok(J.wt && J.wt.net === net && J.wt.tare === 26000 && J.wt.by === 'Marcus' && J.extras.some((e) => e.id === 'weight') && wb && T.totalOf(J) === wb.total && /^Saved: [\d,]+ lb net\. The bill is \$/.test(toast()), L('Save weights: the net, and the bill by the weight: ' + toast()));
  const n = T.ldNow(J);
  ok(n && n.cap === r2(est * 1.1) && Math.abs(n.now - r2(n.cap - T.paidOf(J))) < 0.01 && Math.abs(n.rest - r2(T.totalOf(J) - n.cap)) < 0.01 && T.flowAmtNow(J) === n.now, L('past 110%: at delivery ' + (n && n.now) + ', the rest ' + (n && n.rest) + ' later'));
  T.render(); await sleep(5); card = $('#view .crewcard[data-job="' + J.id + '"]');
  ok(card && card.querySelector('[data-act="cr:endday"]') && card.querySelector('[data-act="cr:endday"]').textContent === 'End the loading day' && /Non-binding estimate: the bill comes from the net weight/.test(card.textContent), L('loaded: End the loading day; the Quote part says how it’s billed'));
  T.endDay(J, 'Marcus'); T.render(); await sleep(5); card = $('#view .crewcard[data-job="' + J.id + '"]');
  ok(card && card.querySelector('[data-act="cr:resume"]') && card.querySelector('[data-act="cr:resume"]').textContent === 'Start the delivery' && /Loaded and on the road\. Delivery .+ at 8:00 AM\. The clock is stopped until then\./.test(card.textContent.replace(/\s+/g, ' ')),
    L('on the road: when it delivers, and Start the delivery'));
  T.resumeDay(J, 'Marcus');
  st().ui.role = 'owner'; T.render(); await sleep(5);

  /* ---------------- the customer, before paying ---------------- */
  T.setStatus(J, 'done'); J.finishedAt = Date.now();
  T.formsPending(J).forEach((f) => J.signed.push({ id: 'sg' + f.id, formId: f.id, name: 'Ana Ortiz', ts: Date.now() }));
  let m = T.custMoveOf(J, S());
  ok(m.ldInfo && m.ldInfo.est === 'nb' && m.ldInfo.net === net && m.ldInfo.inter === true && m.ldInfo.day === addDays(D, 5) && m.bill.now === T.ldNow(J).now && m.bill.due === T.balOf(J), L('their copy: the weight, the delivery day, and what’s due at delivery'));
  ok(/Weighed: /.test(T.custLdHtml(m)) && /reweigh/.test(T.custLdHtml(m)) && /fmcsa\.dot\.gov/.test(T.custLdHtml(m)) && /^Long-distance move: delivery /.test(T.custKindHtml(m).replace(/<[^>]+>/g, '')), L('their app: Long distance, the weight and the booklets'));
  if (T.custStage(m) === 'due') ok(T.custDueNow(m).amt === T.ldNow(J).now, L('they pay what’s due at delivery'));

  /* ---------------- the rest, 30 days after delivery ---------------- */
  T.addPayment(J, T.ldNow(J).now, 'Cash');
  ok(T.invoiceJob(J) && T.ldBilledLater(J) && /^The rest, \$[\d,.]+, is billed 30 days after delivery/.test(T.invLine(J)), L('paid at delivery: the rest goes on an invoice: ' + T.invLine(J)));
  T.invSweep();
  ok(J.inv && J.inv.no > 1000 && T.invDue(J) === addDays(iso(new w.Date(J.finishedAt)), 30), L('numbered, due 30 days after delivery'));
  m = T.custMoveOf(J, S());
  ok(m.bill.now === T.balOf(J), L('their app: the rest can be paid when they like'));

  /* ---------------- binding ---------------- */
  const B = clone(J); B.id = 'ld-b'; B.d.ld = Object.assign({}, B.d.ld, { est: 'b' }); B.quote = T.calc(B.d, S()); B.extras = []; B.wt = null; B.payments = []; B.inv = null; B.status = 'active';
  st().jobs.push(B);
  T.ldWeigh(B, '26000', String(26000 + net), '', 'Marcus');
  ok(B.quote.flat && B.wt.net === net && !B.extras.some((e) => e.id === 'weight') && T.totalOf(B) === B.quote.total && T.ldNow(B) === null, L('binding: weighed for the record, the bill stays the estimate'));
  st().jobs = st().jobs.filter((j) => j.id !== B.id);

  /* ---------------- Today ---------------- */
  const Tj = clone(J); Tj.id = 'ld-today'; Tj.status = 'booked'; Tj.d.name = 'Window Soon'; Tj.d.ld = Object.assign({}, Tj.d.ld, { w0: addDays(today, 1), w1: addDays(today, 6), day: '' });
  st().jobs.push(Tj);
  const al = T.ldDayAlerts().join(' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  ok(/Set the delivery day: Window Soon/.test(al) && /tell them 24 hours ahead/.test(al), L('Today: set the delivery day when the window opens soon'));
  st().jobs = st().jobs.filter((j) => j.id !== Tj.id);

  /* ---------------- Setup and Options ---------------- */
  await go('settings', 'rates'); await sleep(10);
  ok($('#ldRates') && $('[data-s="ldRates.0.r"]') && $('[data-s="ldRates.0.r"]').value === '55' && $('[data-s="ldMinLbs"]').value === '2000', L('Setup › Rate card › Long distance: the bands and the least weight'));
  await go('settings', 'company'); await sleep(10);
  ok($('[data-s="usdot"]') && $('[data-s="mcNo"]'), L('Setup › Company: USDOT and MC numbers'));
  await go('settings', 'options'); await sleep(10);
  const sw = $('input[role="switch"][data-s="opt.longDist"]');
  ok(sw && sw.checked, L('Options › Long-distance moves, on'));
  sw.checked = false; sw.dispatchEvent(new w.Event('input', { bubbles: true })); await sleep(10);
  click('#fab'); await sleep(15);
  click('[data-act="q:step"][data-s="3"]'); await sleep(15);
  ok(!$('[data-d="moveKind"] option[value="long"]'), L('switched off: no Long distance on a new quote'));
  S().opt.longDist = true; st().draft = T.blankDraft();

  ok(!A.errors.length, L('no errors: ' + A.errors.join(' | ')));
  process.exit(summary(label) ? 1 : 0);
})();

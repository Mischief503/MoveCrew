// Storage (batch 13, Nov 22). From Richie's list of what MoveCrew was missing (Nov 21): customers' things kept in
// the warehouse between moves, in units (Unit #1, Unit #2, each with a size and a price), billed every month, and
// delivered later. Run against either edition:
// node tests/ui/storage.js <file> <label>
const { load, ok, sleep, summary, clone } = require('./lib');
const file = process.argv[2] || __dirname + '/../../build/tally-artifact.html', label = process.argv[3] || 'storage';
const L = (m) => label + ': ' + m;

(async () => {
  const A = await load(file, {});
  const { w, $, $$, click, T, go } = A;
  const st = () => T.state(), S = () => st().settings;
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const addDays = (day, n) => { const d = new w.Date(day + 'T12:00'); d.setDate(d.getDate() + n); return iso(d); };
  const today = iso(new w.Date());
  const sheet = () => ($('#sheet') && !$('#sheet').hidden ? $('#sheet').textContent.replace(/\s+/g, ' ') : '');
  const view = () => $('#view').textContent.replace(/\s+/g, ' ');
  const toast = () => ($('#toast') ? $('#toast').textContent : '');
  const type = (sel, v) => { const e = typeof sel === 'string' ? $(sel) : sel; e.value = v; e.dispatchEvent(new w.Event('input', { bubbles: true })); e.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const strip = (h) => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const draft = (o) => Object.assign(T.blankDraft(), { name: 'X' }, o || {});

  /* ---------------- Setup and the switch ---------------- */
  ok(T.opt('storage') && S().sto && S().sto.units.length === 12 && S().sto.units[0].name === 'Unit #1' && S().sto.units[11].name === 'Unit #12' && S().sto.units[0].size === '5×7×8 ft' && S().sto.units[0].rate === 150 && S().sto.rate === 150 && S().sto.fee === 0,
    L('Options › Storage on; Unit #1 to Unit #12, 5×7×8 ft at $150 a month each, to start'));
  const Sold = { sto: { units: [{ id: 'v3', name: 'Vault 3' }, { id: 'x9', name: 'Vault 9' }], rate: 120 } };
  T.stoCfg(Sold);
  ok(Sold.sto.units[0].name === 'Unit #3' && Sold.sto.units[1].name === 'Vault 9' && Sold.sto.units[0].rate === 120 && Sold.sto.units[0].size === '', L('the first version’s “Vault 3” is called “Unit #3” (a name of your own stays)'));
  const qs = T.calc(draft({ jobType: 'storage', items: { sofa3: 1 } }), S());
  ok(qs.kind === 'storage' && qs.total === 0 && qs.nTrucks === 0 && qs.crew === 0 && !qs.lines.length, L('an account’s quote: no truck, no crew, nothing to pay up front'));
  ok(T.stoBillDates('2026-01-31', '2026-04-30').join() === '2026-01-31,2026-02-28,2026-03-28,2026-04-28' && T.stoNext('2026-01-31', '2026-02-28') === '2026-03-28' && T.stoBillDates('2026-12-02', '2027-01-02').join() === '2026-12-02,2027-01-02',
    L('the bill days: the day it went in, then that day each month (the 28th at the latest), over the new year'));

  /* ---------------- Put in storage, from a move ---------------- */
  const D = addDays(today, -40);
  const M = T.newJob(draft({ name: 'Lena Wu', phone: '5035550142', email: 'lena@example.com', moveDate: D, time: '08:00', from: '18 Elm St, Portland, OR', to: 'Warehouse', items: { sofa3: 1, bedq: 1, boxm: 20 } }), S(), 'done');
  M.id = 'sto-move'; M.finishedAt = Date.now() - 39 * 864e5; M.assign.crew = ['Marcus', 'Dee'];
  st().jobs.push(M);
  await go('jobs'); T.openJob(M.id); await sleep(10);
  ok(/Storage/.test(sheet()) && $('#sheet [data-act="sto:pick"]') && /Put in storage/.test(sheet()) && /Unit #1\s*5×7×8 ft · \$150\/mo/.test($('#sheet [data-act="sto:pick"][data-u="v1"]').textContent), L('a finished move’s job sheet: Storage, with the free units, each with its size and price'));
  S().sto.units[0].rate = 140; S().sto.units[1].rate = 140; T.openJob(M.id); await sleep(5);
  click('#sheet [data-act="sto:pick"][data-u="v1"]'); await sleep(5);
  click('#sheet [data-act="sto:pick"][data-u="v2"]'); await sleep(5);
  ok(/Put in storage: 2 units, \$280 a month/.test(sheet()), L('two units picked: “Put in storage: 2 units, $280 a month” (their prices)'));
  ok($('#sheet [data-stof="start"]').value === D, L('it goes in on the move’s day, to start'));
  click('#sheet [data-act="sto:in"]'); await sleep(10);
  const J = st().jobs.find((j) => T.stoIs(j) && j.d.sto.from === M.id);
  const due0 = T.stoBillDates(D, today);
  ok(J && J.status === 'storage' && J.d.name === 'Lena Wu' && J.d.email === 'lena@example.com' && J.d.sto.vaults.join() === 'v1,v2' && J.d.sto.prices.v1 === 140 && J.d.sto.prices.v2 === 140 && !J.d.sto.rate && T.stoMonthly(J) === 280 && J.d.sto.start === D && J.d.source === '' && !J.d.moveDate,
    L('an account: In storage, Unit #1 and Unit #2 at $140 each, from the move’s day'));
  ok(M.d.stoIn && M.d.stoIn.id === J.id && M.d.stoIn.words === 'Unit #1, Unit #2' && /Into storage after this move: Unit #1, Unit #2/.test(sheet()), L('the move says where its things went'));
  let B = T.stoBills(J);
  ok(due0.length === 2 && B.length === 2 && B[0].id === 'sm_' + D && B[0].amt === 280 && /^Storage \w{3} \d+ to \w{3} \d+: Unit #1, Unit #2$/.test(B[0].label) && B[1].id === 'sm_' + due0[1] && T.totalOf(J) === 560,
    L('billed for each month so far: ' + B.map((b) => b.label + ' $' + b.amt).join(' | ')));
  ok(!T.stoSweep() && T.stoBills(J).length === 2, L('the same bills on every pass (each has the day in its id)'));
  ok(T.stoDueSince(J) === D && T.stoLate(J), L('nothing paid: owed since the first bill, past due ten days on'));

  /* ---------------- Jobs and Today ---------------- */
  T.ui.jobId = null; T.render(); await go('jobs'); await sleep(10);
  const chip = $('[data-act="filter"][data-f="storage"]');
  ok(chip && /In storage 1/.test(chip.textContent.replace(/\s+/g, ' ')), L('Jobs: an In storage chip'));
  click(chip); await sleep(5);
  ok(/Lena Wu/.test(view()) && /Since \w{3} \d+ · Unit #1, Unit #2 · \$280 a month/.test(view()) && /\$280\/mo/.test(view()) && /\$560 past due/.test(view()), L('the account on Jobs: since, the units, a month, and what’s past due'));
  click('[data-act="filter"][data-f="all"]'); await sleep(5);
  const al = strip(T.stoAlerts().join(' '));
  ok(/Storage bill past due: Lena Wu/.test(al) && /\$560 owed · since/.test(al), L('Today: ' + al.trim()));
  T.ui.allAlerts = true; await go('today'); await sleep(10);
  ok(/Storage bill past due: Lena Wu/.test(view()), L('on Today, under Needs you'));

  /* ---------------- the Storage screen (Richie, Nov 22: "what is available and what is taken. Who is paid and who owes") ---------------- */
  click('[data-act="more:open"]'); await sleep(5);
  const moreRow = $('#more [data-act="more:go"][data-tab="storage"]');
  ok(moreRow && /The units free and taken, who’s paid and who owes/.test(moreRow.textContent), L('More › Storage'));
  click(moreRow); await sleep(10);
  const kp = $$('#view .kpi').map((k) => k.textContent.replace(/\s+/g, ' ').trim()), vt = $$('#view .vt');
  ok(T.ui.tab === 'storage' && kp.join(' | ') === '10Units free, of 12 | 2Taken | $560Owed | $280Storage a month', L('Storage: ' + kp.join(' | ')));
  ok(vt.length === 12 && vt.filter((e) => e.classList.contains('free')).length === 10 && vt[0].classList.contains('late') && /Unit #1/.test(vt[0].textContent) && /5×7×8 ft\s*\$140\/mo/.test(vt[0].textContent) && /Lena Wu/.test(vt[0].textContent) && /\$560 past due/.test(vt[0].textContent) && /Free/.test(vt[2].textContent) && /Unit #3\s*5×7×8 ft\s*\$150\/mo/.test(vt[2].textContent),
    L('every unit as a tile with its size and price: free, or whose and what they owe (Unit #1, 5×7×8 ft, $140/mo: Lena Wu, $560 past due)'));
  ok(/Free/.test($('#view .vlegend').textContent) && /Past due/.test($('#view .vlegend').textContent), L('with what the colours mean'));
  const sc = $$('#view button.job');
  ok(sc.length === 1 && /Lena Wu/.test(sc[0].textContent) && /\$560 past due/.test(sc[0].textContent) && /Unit #1, Unit #2 · since/.test(sc[0].textContent) && /Owe 1/.test($('[data-act="sto:f"][data-f="owe"]').textContent.replace(/\s+/g, ' ')),
    L('who’s in storage: Lena Wu, her units and what she owes; Owe 1'));
  click('[data-act="sto:f"][data-f="owe"]'); await sleep(5);
  ok(T.ui.stoF === 'owe' && $$('#view button.job').length === 1, L('Owe: the ones who owe'));
  click('[data-act="sto:f"][data-f="all"]'); await sleep(5);
  click($$('#view .vt')[0]); await sleep(10);
  ok(T.ui.jobId === J.id && /Storage account/.test(sheet()), L('a taken unit opens the customer’s account'));
  click('#sheet [data-act="sheet:close"]'); await sleep(5);
  S().opt.dispatchMoney = false; st().ui.role = 'dispatch'; T.ui.tab = 'storage'; T.render(); await sleep(5);
  ok(T.ui.tab === 'storage' && $$('#view .kpi').length === 2 && $$('#view .vt').length === 12, L('dispatch has it too, without the totals while Dispatch sees revenue is off'));
  st().ui.role = 'crew'; st().ui.me = 'Dee'; T.render(); await sleep(5);
  ok(T.ui.tab !== 'storage', L('the crew don’t'));
  st().ui.role = 'owner'; delete S().opt.dispatchMoney; T.ui.tab = 'jobs'; T.ui.filter = 'storage'; T.render(); await sleep(5);
  ok(!!$('#view [data-act="tab"][data-tab="storage"]'), L('Jobs › In storage points to it'));
  T.ui.filter = 'all'; T.render(); await sleep(5);

  /* ---------------- the account's job sheet ---------------- */
  T.openJob(J.id); await sleep(10);
  const sh = sheet();
  ok(/Storage account/.test(sh) && /In storage since/.test(sh) && /from the move/.test(sh) && /Billed on the \d+(st|nd|rd|th) of each month/.test(sh) && /Past due/.test(sh), L('its job sheet: since when, from the move, the bills and which are past due'));
  ok(!/Edit quote/.test(sh) && !$('#sheet [data-jstatus]') && !/Schedule/.test(sh) && /Collect payment/.test(sh) && /Billed/.test(sh) && /\$560/.test(sh) && /Past due/.test(sh), L('no Edit quote, no Schedule; Collect payment and what’s billed'));
  ok(/Storage account · 2 units · \$280 a month/.test(sh), L('the line under the name'));
  ok($('#sheet [data-stoj="price"][data-u="v1"]').value === '140' && /Unit #1\s*5×7×8 ft/.test($('#sheet .stoprice').textContent), L('each unit’s price for this customer, with its size'));
  click('#sheet [data-act="flow:open"]'); await sleep(10);
  const fl = $('#flow') && !$('#flow').hidden ? $('#flow').textContent.replace(/\s+/g, ' ') : '';
  ok(/Billed/.test(fl) && /\$560/.test(fl) && !/Sign/.test(fl.slice(0, 200)) && !/tip/i.test(fl), L('Collect payment: what’s billed and owed, no forms and no tip'));
  click('#flow [data-act="flow:close"]'); await sleep(5);
  T.addPayment(J, 280, 'Cash'); T.render(); await sleep(5);
  ok(T.balOf(J) === 280 && T.stoDueSince(J) === due0[1] && J.status === 'storage', L('$280 paid: the first month paid, the second still owed, still In storage'));
  T.openJob(J.id); await sleep(5);
  ok(/Paid/.test(sheet()), L('the bills say which are paid'));
  click('#sheet [data-act="sto:vault"][data-u="v3"]'); await sleep(5);
  ok(J.d.sto.vaults.join() === 'v1,v2,v3' && J.d.sto.prices.v3 === 150 && T.stoMonthly(J) === 430 && M.d.stoIn.words === 'Unit #1, Unit #2, Unit #3', L('a third unit at its price, $150: $430 a month, and the move’s card follows'));
  type('#sheet [data-stoj="price"][data-u="v1"]', '150'); await sleep(5);
  ok(J.d.sto.prices.v1 === 150 && T.stoMonthly(J) === 440 && T.stoBills(J)[0].amt === 280 && /Unit #1: \$150 a month/.test(J.log[J.log.length - 1].ev), L('one unit’s price changed for her: the next bills; the ones made stay'));
  S().sto.units[1].rate = 175;
  ok(T.stoMonthly(J) === 440 && T.stoPriceOf(J, 'v2') === 140, L('a unit’s price raised in Setup: what she pays stays'));
  S().sto.units[1].rate = 140;
  click('#sheet [data-act="sto:vault"][data-u="v3"]'); await sleep(5);
  click('#sheet [data-act="sto:vault"][data-u="v2"]'); await sleep(5);
  click('#sheet [data-act="sto:vault"][data-u="v1"]'); await sleep(5);
  ok(J.d.sto.vaults.join() === 'v1' && /Keep at least one unit/.test(toast()) && !('v2' in J.d.sto.prices), L('the last unit stays: “Keep at least one unit”'));
  T.stoSetVaults(J, ['v1', 'v2'], 'Owner'); J.d.sto.prices = { v1: 150, v2: 150 };

  /* ---------------- the customer's app ---------------- */
  let m = T.custMoveOf(J, S());
  ok(m.sto && m.sto.n === 2 && m.sto.names === 'Unit #1, Unit #2' && m.sto.units.length === 2 && m.sto.units[0].size === '5×7×8 ft' && m.sto.units[0].price === 150 && m.sto.monthly === 300 && m.sto.since === D && m.sto.bills.length === 2 && m.sto.next === T.stoNext(D, today) && !m.forms.length, L('their copy: the units with sizes and prices, a month, the bills, the next bill'));
  ok(T.custStage(m) === 'storage' && T.custDueNow(m).amt === 280 && T.custDueNow(m).kind === 'bill', L('they can pay what’s owed: $280'));
  ok(/In storage since/.test(strip(T.custCardHtml(m))) && /\$300 a month/.test(strip(T.custCardHtml(m))) && /Unit #1 \(5×7×8 ft\), Unit #2 \(5×7×8 ft\)/.test(strip(T.custCardHtml(m))) && /Your units/.test(strip(T.custDetailsHtml(m))) && /Pay your storage bill: \$280/.test(strip(T.custNextHtml(m))) && /Your storage bills/.test(strip(T.custDetailsHtml(m))) && /What’s in storage/.test(strip(T.custDetailsHtml(m))),
    L('their app: In storage since, a month, Pay your storage bill, the bills and what’s in it'));

  /* ---------------- the crew's card ---------------- */
  const Mb = clone(M); Mb.id = 'sto-move-b'; Mb.status = 'booked'; Mb.d.moveDate = today; Mb.d.time = '08:00'; Mb.finishedAt = null; Mb.assign.crew = ['Marcus'];
  st().jobs.push(Mb);
  st().ui.role = 'lead'; st().ui.me = 'Marcus'; T.ui.tab = 'crew'; T.render(); await sleep(10);
  ok(/Into storage: Unit #1, Unit #2/.test(view()), L('the crew’s card: “Into storage: Unit #1, Unit #2”'));
  st().ui.role = 'owner'; st().jobs = st().jobs.filter((j) => j.id !== Mb.id); T.ui.tab = 'jobs'; T.render(); await sleep(5);

  /* ---------------- Reports ---------------- */
  const rep = strip(T.stoReportCard(() => true));
  ok(/In storage now: 1 customer · 2 of 12 units · \$300 a month/.test(rep) && /\$280 owed/.test(rep) && /Billed in these dates: \$560/.test(rep), L('Reports › Storage: ' + rep.trim().slice(0, 120)));

  /* ---------------- Deliver from storage ---------------- */
  T.openJob(J.id); await sleep(5);
  click('#sheet [data-act="sto:out"]'); await sleep(15);
  const O = st().jobs.find((j) => j.d.stoOut && j.d.stoOut.id === J.id);
  ok(O && O.status === 'quoted' && O.d.from === J.d.from && O.d.items.sofa3 === 1 && O.d.stoOut.words === 'Unit #1, Unit #2' && J.d.sto.outJob === O.id && T.ui.tab === 'quote' && st().draft.editId === O.id,
    L('Deliver from storage: a move quote with what’s stored, open to finish'));
  st().draft = T.blankDraft(); T.ui.tab = 'jobs'; T.render(); await sleep(5);
  O.d.moveDate = today; O.status = 'booked';
  T.openJob(J.id); await sleep(5);
  ok(/Delivery: /.test(sheet()) && /It comes out of storage when that move starts/.test(sheet()), L('the account shows the delivery'));
  T.setStatus(O, 'active'); T.stoSweep();
  ok(J.status === 'done' && J.d.sto.out === today && T.balOf(J) > 0 && /Out of storage/.test(J.log[J.log.length - 1].ev), L('the move out started: out of storage today, ' + J.log[J.log.length - 1].ev));
  ok(!T.stoUsedBy().v1 && !T.stoUsedBy().v2, L('its units are free again'));
  m = T.custMoveOf(J, S());
  ok(T.custStage(m) === 'storage' && /Out of storage/.test(strip(T.custCardHtml(m))) && T.custDueNow(m).amt === T.balOf(J), L('their app: Out of storage, and the bill still due'));
  T.addPayment(J, T.balOf(J), 'Cash');
  ok(J.status === 'paid', L('paid up: Paid'));
  T.setStatus(O, 'booked');
  T.openJob(J.id); await sleep(5);
  click('#sheet [data-act="sto:reopen"]'); await sleep(5);
  ok(J.status === 'storage' && !J.d.sto.out && !J.d.sto.outJob, L('Put back in storage'));
  click('#sheet [data-act="sto:close"]'); await sleep(5);
  ok(J.status === 'storage' && /Tap again/.test(sheet()), L('closing asks twice'));
  click('#sheet [data-act="sto:close"]'); await sleep(5);
  ok(J.status !== 'storage' && J.d.sto.out === today, L('closed: out of storage today'));

  /* ---------------- someone already in storage ---------------- */
  T.ui.jobId = null; T.render();
  await go('settings', 'storage'); await sleep(10);
  ok($('#stoCard') && $$('#stoCard [data-s$=".name"]').length === 12 && $$('#stoCard [data-s$=".size"]').length === 12 && $$('#stoCard [data-s^="sto.units."][data-s$=".rate"]').length === 12 && $('[data-s="sto.units.0.name"]').value === 'Unit #1' && $('[data-s="sto.units.0.size"]').value === '5×7×8 ft' && $('[data-s="sto.units.2.rate"]').value === '150' && $('[data-s="sto.rate"]').value === '150',
    L('Setup › Storage: each unit’s name, size and price, and what new units start at'));
  type('[data-s="sto.units.4.size"]', '10×10 ft'); type('[data-s="sto.units.4.rate"]', '120'); await sleep(5);
  ok(S().sto.units[4].size === '10×10 ft' && S().sto.units[4].rate === 120, L('Unit #5 made 10×10 ft at $120, right in the list'));
  $('#nStoUnit').value = ''; $('#nStoSize').value = '10×20 ft'; $('#nStoRate').value = '260'; click('[data-act="sto:addunit"]'); await sleep(5);
  ok(S().sto.units.length === 13 && S().sto.units[12].name === 'Unit #13' && S().sto.units[12].size === '10×20 ft' && S().sto.units[12].rate === 260, L('a unit added: Unit #13, 10×20 ft, $260'));
  click('[data-act="sto:rmunit"][data-i="12"]'); await sleep(5);
  ok(S().sto.units.length === 12, L('a free unit removed'));
  const next = addDays(today, 5);
  type('#stoCard [data-stof="name"]', 'Old Customer'); type('#stoCard [data-stof="start"]', next);
  click('#stoCard [data-act="sto:pick"][data-u="v5"]'); await sleep(5);
  click('#stoCard [data-act="sto:new"]'); await sleep(10);
  const K = st().jobs.find((j) => j.d.name === 'Old Customer');
  ok(K && K.status === 'storage' && K.d.sto.start === next && K.d.sto.prices.v5 === 120 && T.stoMonthly(K) === 120 && K.d.sto.vaults.join() === 'v5' && !T.stoBills(K).length && T.balOf(K) === 0, L('added: Unit #5 at its $120, nothing billed before the day picked'));
  ok(/The first bill comes/.test(sheet()), L('its sheet says when the first bill comes'));
  $('#stoChL').value = 'Key copy'; $('#stoChA').value = '25.00'; click('#sheet [data-act="sto:charge"]'); await sleep(5);
  ok(T.balOf(K) === 25 && T.stoDueSince(K) === today && !T.stoLate(K) && /Key copy/.test(sheet()) && /Owed/.test(sheet()), L('a charge on the account, owed from today'));
  $('#stoChL').value = 'Sorry for the wait'; $('#stoChA').value = '10.00'; $('#stoChT').value = 'credit'; click('#sheet [data-act="sto:charge"]'); await sleep(5);
  ok(T.balOf(K) === 15 && K.status === 'storage', L('a credit takes $10 off'));

  /* ---------------- not a lead, a quote or a finished job ---------------- */
  T.ui.jobId = null; T.render();
  await go('reports'); await sleep(10);
  ok(!!$('#stoRep'), L('Reports shows the Storage card'));

  /* ---------------- switched off ---------------- */
  S().opt.storage = false;
  T.openJob(M.id); await sleep(5);
  ok(/Into storage after this move/.test(sheet()), L('switched off: a move already in storage still shows it'));
  const M2 = clone(M); M2.id = 'sto-move-2'; delete M2.d.stoIn; st().jobs.push(M2);
  T.openJob(M2.id); await sleep(5);
  ok(!$('#sheet [data-act="sto:pick"]'), L('switched off: no Put in storage on a move'));
  S().opt.storage = true; T.ui.jobId = null; T.render();

  ok(!A.errors.length, L('no errors: ' + A.errors.join(' | ')));
  process.exit(summary(label) ? 1 : 0);
})();

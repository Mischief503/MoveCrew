// More kinds of jobs (batch 9, Nov 21). Richie, on the list of what MoveCrew is missing: "6-16 i think you should start
// planning and making now". Item 8: labor only (loading or unloading the customer's own truck, container or rental),
// a packing day before the move, and commercial jobs billed on an invoice with terms. Run against either edition:
// node tests/ui/jobtypes.js <file> <label>
const { load, ok, sleep, summary, clone } = require('./lib');
const file = process.argv[2] || __dirname + '/../../build/tally-artifact.html', label = process.argv[3] || 'jobtypes';
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
  // a day with nothing on it, three to four weeks out
  const D = (() => { for (let i = 22; i < 40; i++) { const d = addDays(today, i); if (!T.schedRecs().some((r) => r.d.moveDate === d)) return d; } })();

  /* ---------------- the price ---------------- */
  const stuff = { sofa3: 2, bedq: 2, dresser: 2, boxm: 40 };   // 424 cu ft
  let q = T.calc(draft({ jobType: 'labor', laborKind: 'both', items: stuff }), S());
  ok(q.nTrucks === 0 && q.truckId === '' && q.pct === 0 && q.kind === 'local' && q.type === 'labor' && q.crew === 3 && q.hours === 3.5 && txt(q) === '3 movers, 3.5 hr at $195/hr 683' && q.total === 683 && q.deposit === 171 && !q.shopTravel,
    L('labor only, loading and unloading 424 cu ft: 3 movers by the hour (424 ÷ 135 → 3.5 h), no truck, no truck fee, no miles: ' + txt(q)));
  ok(T.priced(q) && T.calc(draft({ jobType: 'labor', laborKind: 'load', items: stuff }), S()).hours === 3, L('loading only takes half the time (1.6 h), so the 3-hour minimum'));
  q = T.calc(draft({ jobType: 'labor', laborKind: 'unload', items: { sofa3: 6, bedq: 6, dresser: 6, boxm: 120 } }), S());
  ok(q.crew === 4 && q.hours === 4, L('unloading only, 1,272 cu ft: 4 movers, half of 7.1 h → 4 h: ' + txt(q)));
  q = T.calc(draft({ jobType: 'labor' }), S());
  ok(q.cf === 0 && q.hours === 3 && q.total === 420 && T.priced(q) && !T.priced(T.calc(draft({}), S())), L('nothing in yet: the minimum, priced already (a move with nothing in has no price)'));
  q = T.calc(draft({ jobType: 'labor', items: stuff, flights: '2' }), S());
  ok(/Stairs: 2 flights 50/.test(txt(q)) && q.total === 733, L('stairs still count on a labor job'));
  q = T.calc(draft({ jobType: 'packing', items: { boxm: 40, boxl: 20, sofa3: 1 } }), S());
  ok(q.crew === 2 && q.hours === 4 && txt(q) === '2 packers, 4 hr at $140/hr 560 | Boxes and materials: 60 boxes 180' && q.total === 740 && q.boxes === 60 && q.nTrucks === 0,
    L('packing 60 boxes: 2 packers at 8 boxes an hour each (3.75 → 4 h), plus $3 a box: ' + txt(q)));
  q = T.calc(draft({ jobType: 'packing', items: { boxm: 40, boxl: 20 } }), Object.assign(clone(S()), { packRate: 10, boxPrice: 0 }));
  ok(q.hours === 3 && txt(q) === '2 packers, 3 hr at $140/hr 420', L('the rate card’s boxes an hour (10) and no price a box'));
  q = T.calc(draft({ jobType: 'labor', items: stuff, hoursOverride: '6', crew: '2' }), S());
  ok(q.hours === 6 && q.crew === 2 && q.total === 840, L('the hours and the crew set by hand'));
  ok(T.calc(draft({ jobType: 'labor', items: stuff, invoice: true }), S()).deposit === 0 && T.calc(draft({ items: stuff, invoice: true }), S()).deposit === 0 && T.calc(draft({ items: stuff }), S()).deposit > 0,
    L('a job billed on an invoice asks for no deposit, move or labor'));
  ok(T.addrRoles({ d: { jobType: 'labor', laborKind: 'load' } }).map((r) => r[1]).join() === 'Where we load' && T.addrRoles({ d: { jobType: 'labor' } }).map((r) => r[1]).join() === 'Where we load,Where we unload' && T.addrRoles({ d: { jobType: 'packing' } }).map((r) => r[1]).join() === 'Where we pack' && T.addrRoles({ d: {} }).map((r) => r[1]).join() === 'Pickup,Delivery',
    L('the addresses each kind of job has'));

  /* ---------------- the quote screen ---------------- */
  click('#fab'); await sleep(15);
  const chips = () => $$('#view [data-act="q:jt"]').map((b) => b.textContent + (b.classList.contains('on') ? '*' : '')).join(',');
  ok(chips() === 'Move*,Labor only,Packing' && /^The move/.test($('#view section.card:nth-of-type(3) h2') ? $$('#view section.card h2').map((h) => h.textContent).find((t) => /^The (move|job)/.test(t)) : ''), L('a new quote: Kind of job, Move on'));
  type('[data-d="name"]', 'Harbor Storage Co');
  click('[data-act="q:jt"][data-v="labor"]'); await sleep(10);
  const labels = () => $$('#view label.f > span').map((s) => s.textContent);
  ok(st().draft.jobType === 'labor' && st().draft.laborKind === 'both' && chips() === 'Move,Labor only*,Packing' && labels().indexOf('Where we load') >= 0 && labels().indexOf('Where we unload') >= 0 && labels().indexOf('Job date') >= 0 && !$('[data-d="miles"]') && !$('#distNote') && !$('[data-d="pack"]'),
    L('Labor only: “The job”, Where we load and Where we unload, no miles and no packing'));
  ok($$('#view [data-act="q:lk"]').map((b) => b.textContent).join() === 'Load and unload,Load only,Unload only' && /No truck goes out/.test($('#qMeter').textContent) && /Labor only: loading and unloading/.test($('#qMeter').textContent),
    L('loading, unloading or both; the top card says no truck goes out'));
  click('[data-act="q:lk"][data-v="unload"]'); await sleep(10);
  ok(st().draft.laborKind === 'unload' && labels().indexOf('Where we unload') >= 0 && labels().indexOf('Where we load') < 0 && !$('[data-d="to"]'), L('Unload only: one address'));
  click('[data-act="q:jt"][data-v="packing"]'); await sleep(10);
  ok(labels().indexOf('Packing date') >= 0 && labels().indexOf('Where we pack') >= 0 && !$('[data-d="flights"]') && !$('[data-d="to"]'), L('Packing: the packing date, where we pack, no stairs'));
  click('[data-act="q:step"][data-s="2"]'); await sleep(10);
  ok(/Boxes to pack/.test(view()) && $$('#qGroups details.grp').filter((g) => g.open).map((g) => g.querySelector('summary').textContent).join() === 'Boxes', L('step 2 for packing: the boxes, open'));
  st().draft.items = { boxm: 40, boxl: 20 };
  click('[data-act="q:step"][data-s="3"]'); await sleep(15);
  ok(!$('[data-d="moveKind"]') && !$('[data-d="truckId"]') && labels().indexOf('Packers') >= 0 && /Adjust the crew, hours or discount/.test(view()) && /2 packers, 4 hr at \$140\/hr\$560/.test($('#qLines').textContent) && /Total\$740/.test($('#qLines').textContent),
    L('step 3: no move type or truck to pick, Packers, and the price: ' + $('#qLines').textContent));
  ok($('#qSub').textContent === '2 packers · 4 h · 60 boxes' && $('#qTot').textContent === '$740', L('the bar: ' + $('#qSub').textContent));
  click('[data-act="q:step"][data-s="1"]'); await sleep(10);
  click('[data-act="q:jt"][data-v="labor"]'); await sleep(10);
  click('[data-act="q:lk"][data-v="both"]'); await sleep(10);
  type('[data-d="from"]', '9 Dock Rd'); type('[data-d="to"]', '2201 Elm St');
  type('[data-d="moveDate"]', D); type('[data-d="time"]', '09:00');
  st().draft.items = clone(stuff);
  const inv = $('[data-d="invoice"]');
  ok(!!inv && $('#qInvBox').hidden, L('Bill on an invoice, its details hidden until it’s on'));
  inv.checked = true; inv.dispatchEvent(new w.Event('input', { bubbles: true })); inv.dispatchEvent(new w.Event('change', { bubbles: true })); await sleep(5);
  ok(st().draft.invoice === true && !$('#qInvBox').hidden && $('[data-d="terms"]').value === '30', L('on: bill to, billing email, PO and terms (Net 30 to start)'));
  type('[data-d="billTo"]', 'Harbor Storage LLC'); type('[data-d="po"]', 'PO-4471'); type('[data-d="terms"]', '15');
  click('[data-act="q:step"][data-s="3"]'); await sleep(15);
  const dp = () => ($('#dayPlan') ? $('#dayPlan').textContent.replace(/\s+/g, ' ') : '');
  ok(/This job: 3\.5 h · 3 movers · no truck\./.test(dp()) && /Crew only/.test(dp()) && /Labor only: loading and unloading, no truck: 9:00 AM to 12:30 PM\./.test(dp()) && !/Deposit/.test($('#qLines').textContent),
    L('the day under the price: no slot, the movers free then, a Crew only row; no deposit: ' + dp().slice(0, 160)));
  click('[data-act="q:book"]'); await sleep(30);
  const J = st().jobs.find((j) => j.d.name === 'Harbor Storage Co');
  ok(J && J.status === 'booked' && J.quote.nTrucks === 0 && J.d.jobType === 'labor' && J.d.invoice === true && J.d.terms === '15' && J.d.po === 'PO-4471' && /Job booked\. Add the crew\./.test(toast()),
    L('booked, with no truck: ' + toast()));
  ok(T.crewOnly(J) && T.needsSched(J), L('it needs scheduling: its crew'));
  J.assign.crew = ['Marcus', 'Dee', 'Luis']; st().jobs = st().jobs.slice();
  J.signed = [{ id: 'sg1', formId: 'f_deliv', title: 'Delivery receipt and release', name: 'Pat Moreno', ts: Date.now(), sig: '' }];
  ok(!T.needsSched(J), L('with a crew and a lead, it’s scheduled: no truck needed'));

  /* ---------------- the schedule ---------------- */
  const need = T.needOf(J.quote, S());
  ok(need.trucks === 0 && need.cf === 0 && need.crew === 3 && need.hours === 3.5, L('what it needs: 3 movers for 3.5 h, no truck'));
  let P = T.planDay(D, T.schedRecs(), S());
  ok(P.crew.length === 1 && P.crew[0].r.id === J.id && !P.loose.length && P.trucks.every((t) => !P.lanes[t.id].length), L('on the day: crew only, not in a slot and not “No truck yet”'));
  const two = T.fitAt(P, { hours: 4, crew: 4, trucks: 0, cf: 0 }, T.hmMin('10:00'));
  ok(!two.ok && two.why === 'movers' && T.fitAt(P, { hours: 4, crew: 3, trucks: 0, cf: 0 }, T.hmMin('10:00')).ok && T.fitAt(P, { hours: 2, crew: 4, trucks: 0, cf: 0 }, T.hmMin('13:00')).ok,
    L('another crew-only job fits while the movers are free: 4 more at 10 is too many with 6 on, 3 fit; at 1 PM everyone’s free'));
  ok(T.fitWhy(two, P, { hours: 4, crew: 4, trucks: 0 }, T.hmMin('10:00')) === '7 movers would be busy then, and 6 movers are on that day.', L('and why not, in words'));
  T.ui.weekStart = D; T.ui.day = D; await go('dispatch'); await sleep(10);
  const lane = (t) => $$('#view .lane').find((l) => l.querySelector('.lh') && l.querySelector('.lh').textContent.indexOf(t) === 0);
  ok(lane('Crew only, no truck') && /Harbor Storage Co/.test(lane('Crew only, no truck').textContent) && /9 Dock Rd → 2201 Elm St/.test(lane('Crew only, no truck').textContent) && !lane('No truck yet'), L('the Board: a Crew only lane, not No truck yet'));

  /* ---------------- the crew ---------------- */
  J.status = 'active'; J.startedAt = Date.now() - 2.4 * H;
  ok(T.phaseNext(J) === 4, L('a labor job has no load and unload steps'));
  const c = T.clockBill(J);
  ok(c && c.missing, L('the clock waits for Finish job'));
  J.finishedAt = Date.now();
  const c2 = T.clockBill(J);
  ok(c2 && !c2.missing && c2.billed === 3 && c2.total === 585 && c2.rows[0].label === '3 movers, 3 hr at $195/hr', L('billed on its clock from Start job to Finish job: 2.4 h, so the 3-hour minimum: ' + (c2 && c2.rows[0].label)));
  delete J.finishedAt;

  /* ---------------- the invoice ---------------- */
  ok(T.invState(J) === 'later' && T.invLine(J) === 'Billed on an invoice, Net 15. The office sends it.', L('before it’s done: ' + T.invLine(J)));
  T.setStatus(J, 'done');
  ok(J.inv && J.inv.no === 1001 && J.inv.at === today && T.invDue(J) === addDays(today, 15) && T.invState(J) === 'open', L('done: invoice 1001, due in 15 days'));
  ok(/^Billed on an invoice \(1001\), Net 15, due /.test(T.invLine(J)), L(T.invLine(J)));
  const J2 = clone(J); J2.id = 'inv2'; J2.inv = null; J2.status = 'active'; J2.d.name = 'Second Co'; J2.d.terms = '0'; st().jobs.push(J2);
  T.setStatus(J2, 'done');
  ok(J2.inv.no === 1002 && T.invDue(J2) === today && T.invState(J2) === 'open', L('the next one is 1002; due on receipt'));
  J2.inv.at = addDays(today, -1);
  ok(T.invState(J2) === 'overdue', L('a day after it was due: past due'));
  const J3 = clone(J2); J3.id = 'inv3'; J3.inv = { at: addDays(today, -3) }; J3.d.name = 'Third Co'; J3.finishedAt = Date.now() - 3 * 864e5; st().jobs.push(J3);
  ok(T.invSweep() && J3.inv.no === 1003 && J3.inv.at === addDays(today, -3), L('a crew lead’s finished one gets its number on the office’s phone, keeping its day'));
  // the crew's card
  J.assign.crew = ['Marcus', 'Dee', 'Luis']; J.d.moveDate = today; J.status = 'done';
  T.ui.tab = 'crew'; T.render(); await sleep(10);
  const card = $('#view .crewcard[data-job="' + J.id + '"]');
  ok(card && !card.querySelector('[data-act="flow:open"]') && /Billed on an invoice \(1001\)/.test(card.textContent), L('the crew doesn’t collect on it: the card says it’s billed on an invoice'));
  // the job sheet
  await go('jobs'); T.openJob(J.id); await sleep(10);
  ok(/Invoice 1001 · Net 15 · due/.test(sheet()) && /Open/.test(sheet()) && $('#sheet [data-j="billTo"]').value === 'Harbor Storage LLC' && /Labor only: loading and unloading · 3 movers · 3\.5 h/.test(sheet()) && /Where we load/.test(sheet()),
    L('the job sheet: the invoice, its terms and who it’s billed to'));
  click('#sheet [data-act="inv:sent"]'); await sleep(10);
  ok(J.inv.sent > 0 && /Sent /.test(sheet()), L('Mark as sent'));
  ok(/Take the invoice payment/.test(sheet()), L('the office takes the payment when it comes in'));
  click('#sheet [data-act="sheet:close"]'); await sleep(10);
  // Today and Reports
  J2.d.moveDate = addDays(today, -1);
  await go('today'); await sleep(10);
  ok(/Invoice 1002 is past due/.test(view()) && !/Invoice 1001 is past due/.test(view()) && !/Harbor Storage Co finished/.test(view()), L('Today: the past-due one, and no “still to collect” for invoices on their terms'));
  await go('reports'); await sleep(10);
  ok(/Invoices/.test(view()) && /Open now: 3/.test(view()) && /past due/.test(view()) && /Harbor Storage LLC/.test(view()), L('Reports › Invoices: the open ones'));

  /* ---------------- the customer's copy ---------------- */
  const m = T.custMoveOf(J, S());
  ok(m.type === 'labor' && m.labor === 'both' && m.quote.trucks === 0 && m.inv && m.inv.no === 1001 && m.inv.terms === 15 && m.inv.due === addDays(today, 15), L('their copy: labor only, no truck, the invoice'));
  ok(/Labor only: loading and unloading · Billed on an invoice \(1001\), Net 15, due/.test(T.custKindHtml(m)), L('their app says so under the day'));
  const mv = T.custMoveOf(st().jobs.find((j) => j.status === 'booked' && !j.d.jobType), S());
  ok(mv.type === '' && mv.inv === null && mv.quote.trucks >= 1 && T.custKindHtml(mv) === '', L('a move’s copy is as before'));

  /* ---------------- a packing day ---------------- */
  const M = st().jobs.find((j) => j.status === 'booked' && !j.d.jobType && j.d.moveDate > today);
  M.d.items = Object.assign({}, M.d.items, { boxm: 30, boxs: 10 });
  T.openJob(M.id); await sleep(10);
  ok(!!$('#sheet [data-act="sh:packday"]') && /Add a packing day ?Packing the day before, as a job of its own with this move’s boxes\./.test(sheet()) && !/Packing day: /.test(sheet()), L('a booked move’s sheet offers Add a packing day, under its crew'));
  const n0 = st().jobs.length;
  click('#sheet [data-act="sh:packday"]'); await sleep(15);
  const PK = st().jobs[st().jobs.length - 1];
  ok(st().jobs.length === n0 + 1 && PK.d.jobType === 'packing' && PK.d.packFor === M.id && M.d.packDay === PK.id && PK.status === 'quoted' && PK.d.moveDate === addDays(M.d.moveDate, -1) && PK.d.time === '09:00' && PK.d.from === M.d.from && PK.d.name === M.d.name,
    L('a packing day: the same customer, the day before at 9, at the pickup, as a quote'));
  ok(Object.keys(PK.d.items).every((k) => S().catalog.find((i) => i.id === k).cat === 'Boxes') && PK.d.items.boxm === M.d.items.boxm && PK.quote.nTrucks === 0 && T.priced(PK.quote), L('with the move’s boxes only, priced'));
  ok(T.ui.jobId === PK.id && /Packing for the move on/.test(sheet()) && /Check the boxes and hours, then book it/.test(toast()), L('its sheet opens, linked to the move'));
  T.openJob(M.id); await sleep(10);
  ok(/Packing day: /.test(sheet()) && !$('#sheet [data-act="sh:packday"]'), L('and the move links to it'));
  const M2 = st().jobs.find((j) => j.status === 'booked' && !j.d.jobType && j.d.moveDate === today && j.id !== M.id);
  if (M2) { const P2 = T.packDayFrom(M2); ok(P2.d.moveDate === '' && P2.d.packFor === M2.id, L('a move today: its packing day has no day yet, for the office to pick (the day before has gone by)')); }
  click('#sheet [data-act="sheet:close"]'); await sleep(10);

  /* ---------------- Options ---------------- */
  await go('settings', 'options'); await sleep(10);
  const sw = (k) => $('input[role="switch"][data-s="opt.' + k + '"]');
  ok(sw('labor') && sw('packDays') && sw('invoices') && sw('labor').checked && sw('invoices').checked, L('Options: Labor-only jobs, Packing days, Invoices for business customers, on to start'));
  const pr = $('[data-s="packRate"]'), bp = $('[data-s="boxPrice"]');
  ok(pr && bp && pr.value === '8' && bp.value === '3', L('Packing days has two numbers: boxes an hour per packer (8), and the price a box (3)'));
  const flip = (k, on) => { const i = sw(k); i.checked = on; i.dispatchEvent(new w.Event('input', { bubbles: true })); };
  flip('labor', false); flip('packDays', false); await sleep(10);
  ok(S().opt.labor === false && !T.opt('labor') && !T.opt('packDays'), L('switched off'));
  click('#fab'); await sleep(15);
  ok(!$('[data-act="q:jt"]'), L('with both off, a new quote has no Kind of job'));
  st().draft.jobType = 'labor'; T.render(); await sleep(10);
  ok(chips() === 'Move,Labor only*', L('a labor job being changed still shows its kind'));
  st().draft = T.blankDraft(); S().opt.labor = true; S().opt.packDays = true;

  ok(!A.errors.length, L('no errors: ' + A.errors.join(' | ')));
  process.exit(summary(label) ? 1 : 0);
})();

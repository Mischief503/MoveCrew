// Moves into storage (batch 13d; Richie, Nov 22: "Can we add a type of job, a storage in option. This auto puts your
// storage location as the last stop, and will auto suggest storage units to fit the cubic foot of stuff in the
// estimate."). Run against either edition:
// node tests/ui/stoin.js <file> <label>
const { load, ok, sleep, summary, clone } = require('./lib');
const file = process.argv[2] || __dirname + '/../../build/tally-artifact.html', label = process.argv[3] || 'stoin';
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
  const WH = '900 Industrial Way, Portland, OR';
  const U = S().sto.units;
  S().sto.addr = WH;
  // a warehouse with bigger units too: Unit #9 10×10 ft at $210, Unit #12 10×20 ft at $320
  const U2 = clone(U); U2[8].size = '10×10 ft'; U2[8].rate = 210; U2[11].size = '10×20 ft'; U2[11].rate = 320;

  /* ---------------- how much a unit holds, and the units for so many cubic feet ---------------- */
  ok(['5×7×8 ft', '10×10 ft', "10' x 10'", '250 cu ft', '5 x 7 x 7 ft (245 cu ft)', '10x10x10', '', 'Big one'].map((s) => T.stoCap({ size: s })).join() === '280,800,800,250,245,1000,0,0',
    L('a unit holds: 5×7×8 ft 280 cu ft, a floor size 8 ft high (10×10 ft 800), the cubic feet when it says them, nothing it can’t read'));
  ok(T.stoSuggest(407, U).join() === 'v1,v2', L('407 cu ft in 5×7×8 ft units: Unit #1 and Unit #2 (560 cu ft, $300), the first in the list'));
  ok(T.stoSuggest(407, U2).join() === 'v9', L('with bigger units, 407 cu ft: Unit #9, 10×10 ft at $210, not two small ones at $300'));
  ok(T.stoSuggest(1000, U2).join() === 'v12', L('1,000 cu ft: Unit #12, 10×20 ft at $320, not Unit #9 and a small one at $360'));
  ok(T.stoSuggest(1700, U2).join() === 'v1,v12', L('1,700 cu ft: Unit #12 and a small one ($470), not Unit #9 and Unit #12 ($530)'));
  ok(T.stoSuggest(280, U).join() === 'v1' && T.stoSuggest(0, U).join() === '' && T.stoSuggest(900, U.slice(0, 2)).join() === 'v1,v2',
    L('280 cu ft: one; nothing moving: none; not enough room: every one there is'));

  /* ---------------- the quote ---------------- */
  await go('quote');
  ok($('[data-act="q:jt"][data-v="stoin"]') && /Kind of job/.test(view()) && /Into storage/.test($('.qkinds').textContent), L('Kind of job: Into storage, with Options › Storage on'));
  type('[data-d="name"]', 'Rosa Diaz'); type('[data-d="phone"]', '5035550188'); type('[data-d="from"]', '418 Oak St, Portland, OR');
  click('[data-act="q:jt"][data-v="stoin"]'); await sleep(10);
  const dr = () => st().draft;
  ok(dr().toSto === true && dr().jobType === '' && dr().to === WH && $('[data-d="to"]').value === WH && /Storage warehouse/.test(view()),
    L('tapped: the delivery is the warehouse, as the last stop (Storage warehouse)'));
  ok($('[data-act="q:jt"][data-v="stoin"]').getAttribute('aria-pressed') === 'true' && $('[data-act="q:jt"][data-v=""]').getAttribute('aria-pressed') === 'false' && /The move ends at your warehouse/.test(view()),
    L('Into storage is picked, not Move, and it says what it does'));
  type('[data-d="moveDate"]', addDays(today, 9)); type('[data-d="time"]', '08:00');
  dr().items = { sofa3: 1, bedq: 1, dresser: 1, fridge: 1, dintable: 1, boxm: 60 };
  click('[data-act="q:step"][data-s="3"]'); await sleep(15);
  const qs = () => ($('#qSto') ? $('#qSto').textContent.replace(/\s+/g, ' ') : '');
  ok(/Storage after the move/.test(qs()) && /About 407 cu ft\. Unit #1, Unit #2 hold 560 cu ft: \$300 a month, billed from the move day\./.test(qs()),
    L('under the price: about 407 cu ft, and the units that hold it: ' + qs().slice(0, 140)));
  ok($$('#qSto [data-act="q:stou"].on').map((e) => e.dataset.u).join() === 'v1,v2' && $$('#qSto [data-act="q:stou"]').length === 12 && !$('#qSto [data-act="q:stoauto"]'),
    L('the units as chips, the picked ones on'));
  ok(/Then storage: Unit #1, Unit #2\s*\$300\/mo/.test($('#qLines').textContent), L('the price says what storage costs after it: ' + $('#qLines').textContent.slice(-60)));
  click('#qSto [data-act="q:stou"][data-u="v2"]'); await sleep(5);
  click('#qSto [data-act="q:stou"][data-u="v9"]'); await sleep(5);
  ok(dr().stoPlan && dr().stoPlan.hand === true && dr().stoPlan.units.join() === 'v1,v9' && /Unit #1, Unit #9 hold 560 cu ft: \$300 a month/.test(qs()) && $('#qSto [data-act="q:stoauto"]'),
    L('tapped by hand: Unit #1 and Unit #9, and Pick for me'));
  click('#qSto [data-act="q:stoauto"]'); await sleep(5);
  ok(!dr().stoPlan && /Unit #1, Unit #2 hold 560/.test(qs()), L('Pick for me: back to the units for its cubic feet'));
  click('[data-act="q:book"]'); await sleep(30);
  if (!st().jobs.some((j) => j.d.name === 'Rosa Diaz')) { click('[data-act="q:book"]'); await sleep(30); }   // Book anyway, when no truck is set up for the day
  const J = st().jobs.find((j) => j.d.name === 'Rosa Diaz');
  ok(J && J.status === 'booked' && J.d.toSto === true && J.d.to === WH && J.d.stoPlan && J.d.stoPlan.units.join() === 'v1,v2' && J.d.stoPlan.prices.v1 === 150 && J.d.stoPlan.prices.v2 === 150 && J.d.stoPlan.hand === false,
    L('booked: a move into storage, with Unit #1 and Unit #2 at $150 each'));

  /* ---------------- held for it ---------------- */
  ok(T.stoHeldBy('').v1 === J && T.stoHeldBy('').v2 === J && !T.stoHeldBy(J.id).v1, L('its units are held for it'));
  ok(T.stoFree(S()).map((u) => u.id).indexOf('v1') < 0 && T.stoOpenFor('', S()).map((u) => u.id).indexOf('v2') < 0, L('not free for anyone else'));
  ok(T.stoSuggest(407, T.stoOpenFor('', S())).join() === 'v3,v4', L('another move into storage gets Unit #3 and Unit #4'));
  await go('jobs');
  const card = $$('#view .job').find((e) => /Rosa Diaz/.test(e.textContent));
  ok(card && /Into storage/.test(card.textContent), L('Jobs: an Into storage tag'));
  T.openJob(J.id); await sleep(10);
  ok(/Into storage after this move: Unit #1, Unit #2 · \$300 a month\. They hold 560 cu ft, for about 407 cu ft of things\./.test(sheet()) && /Held for this move\. When the move is done it goes into storage by itself, billed every month from /.test(sheet()),
    L('its job sheet: the units, held, and in by itself when it’s done: ' + (sheet().match(/Into storage after this move[^.]*\./) || [''])[0]));
  ok(/ · into storage$/.test(T.sheetKindLine(J)) && T.addrRoles(J)[1][1] === 'Storage warehouse', L('the kind line and the addresses say so'));
  click('#sheet [data-act="sto:plan"][data-u="v3"]'); await sleep(10);
  ok(J.d.stoPlan.units.join() === 'v1,v2,v3' && J.d.stoPlan.hand === true && J.d.stoPlan.prices.v3 === 150 && J.log.some((e) => /Units for storage: Unit #1, Unit #2, Unit #3, \$450 a month/.test(e.what || e.text || e.msg || JSON.stringify(e))),
    L('a unit added on the job sheet, at its price, in the job’s activity'));
  click('#sheet [data-act="sto:plan"][data-u="v3"]'); await sleep(10);
  ok(J.d.stoPlan.units.join() === 'v1,v2', L('and taken off again'));
  ok(/Into storage:<\/b> Unit #1, Unit #2/.test(T.stoCrewLine(J)), L('the crew’s card: Into storage: Unit #1, Unit #2'));
  const m = T.custMoveOf(J, S());
  ok(m.stoPlan && m.stoPlan.monthly === 300 && m.stoPlan.units[0].name === 'Unit #1' && m.stoPlan.units[0].size === '5×7×8 ft' && m.stoPlan.addr === WH && /Into storage after the move: Unit #1 \(5×7×8 ft\), Unit #2 \(5×7×8 ft\), \$300 a month/.test(strip(T.custKindHtml(m))),
    L('the customer app: Into storage after the move, the units and a month'));

  /* ---------------- the Storage screen and Setup ---------------- */
  T.ui.tab = 'storage'; T.render(); await sleep(10);
  const vt = $$('#view .vt');
  ok(vt[0].classList.contains('held') && vt[1].classList.contains('held') && /Rosa Diaz/.test(vt[0].textContent) && /Held · in /.test(vt[0].textContent) && vt[0].dataset.id === J.id,
    L('Storage: Unit #1 and Unit #2 held for Rosa Diaz, tapping opens the move'));
  ok(/10 free, 0 taken, 2 held for moves coming in\./.test(view()) && /Held for a move/.test($('#view .vlegend').textContent) && /^10\s*Units free, of 12$/.test($('#view .kpi').textContent.trim()),
    L('10 free, 2 held, and the colours say so: ' + $('#view .kpi').textContent.trim() + ' / ' + (view().match(/\d+ free, [^.]*\./) || [''])[0]));
  ok(/Coming in\s*1 move/.test(view()) && /Rosa Diaz\s*\$300\/mo\s*Unit #1, Unit #2 · in /.test(view()), L('Coming in: Rosa Diaz, $300/mo, Unit #1, Unit #2'));
  T.ui.setSec = 'storage'; T.ui.tab = 'settings'; T.render(); await sleep(10);
  ok(/Held for a move:\s*Rosa Diaz/.test(view()) && !$('[data-act="sto:rmunit"][data-i="0"]') && $('[data-act="sto:rmunit"][data-i="2"]') && /a floor size like 10×10 ft counts 8 ft high/.test(view()),
    L('Setup › Storage: held, so it can’t be removed; how a size counts'));
  U[5].size = 'Big one'; T.render(); await sleep(5);
  ok(/MoveCrew can’t read this size, so it isn’t picked for moves into storage/.test(view()), L('a size it can’t read says so'));
  U[5].size = '5×7×8 ft';

  /* ---------------- done: into storage by itself ---------------- */
  J.d.moveDate = addDays(today, -1); T.setStatus(J, 'done'); J.finishedAt = Date.now();
  T.stoSweep();
  const ac = st().jobs.find((j) => j.id === 'si' + J.id);
  ok(ac && T.stoIs(ac) && ac.status === 'storage' && ac.d.sto.vaults.join() === 'v1,v2' && ac.d.sto.prices.v1 === 150 && ac.d.sto.start === addDays(today, -1) && ac.d.sto.from === J.id && J.d.stoIn && J.d.stoIn.id === ac.id,
    L('done: its storage account opens, Unit #1 and Unit #2 from the move day'));
  ok(T.stoBills(ac).length === 1 && T.totalOf(ac) === 300 && ac.log.some((e) => /when the move was done/.test(JSON.stringify(e))), L('the first bill, $300, and the account says how it opened'));
  T.stoSweep();
  ok(st().jobs.filter((j) => j.id === 'si' + J.id).length === 1 && !T.stoHeldBy('').v1 && T.stoUsedBy().v1 === ac, L('once: the units are in use now, not held'));
  T.openJob(J.id); await sleep(10);
  ok(/Into storage after this move: Unit #1, Unit #2 · \$300 a month · In storage/.test(sheet()), L('the move points to the account'));

  /* ---------------- another office phone opened it first ---------------- */
  const J2 = T.newJob(Object.assign(T.blankDraft(), { name: 'Omar Haddad', moveDate: addDays(today, -2), time: '08:00', from: '7 Pine St', to: WH, toSto: true, items: { sofa3: 1 }, stoPlan: { units: ['v5'], prices: { v5: 140 }, hand: true } }), S(), 'done');
  J2.id = 'om1';
  const other = T.stoNewJob(J2.d, { vaults: ['v5'], start: addDays(today, -2), from: 'om1', prices: { v5: 140 }, id: 'siom1' });
  st().jobs.push(J2, other);
  T.stoSweep();
  ok(st().jobs.filter((j) => j.id === 'siom1').length === 1 && J2.d.stoIn && J2.d.stoIn.id === 'siom1' && other.d.sto.prices.v5 === 140, L('the account came from another phone: the move points to it, and there’s one'));

  /* ---------------- a unit taken before it goes in ---------------- */
  const J3 = T.newJob(Object.assign(T.blankDraft(), { name: 'Kim Le', moveDate: addDays(today, 5), time: '08:00', from: '9 Ash St', to: WH, toSto: true, items: { sofa3: 1 }, stoPlan: { units: ['v6', 'v7'], prices: { v6: 150, v7: 150 }, hand: false } }), S(), 'booked');
  J3.id = 'kim1'; st().jobs.push(J3);
  T.stoNewAcct({ name: 'Walk-in', phone: '', email: '', vaults: ['v7'], start: today }, 'Owner');
  T.openJob(J3.id); await sleep(10);
  ok(/Unit #7 was taken, so it’s off this move\./.test(sheet()) && /Into storage after this move: Unit #6 · \$150 a month/.test(sheet()), L('a unit taken meanwhile: the job sheet says so'));
  T.setStatus(J3, 'done'); T.stoSweep();
  const ac3 = st().jobs.find((j) => j.id === 'sikim1');
  ok(ac3 && ac3.d.sto.vaults.join() === 'v6', L('it goes in with the units left'));

  /* ---------------- back to a move; switched off ---------------- */
  await go('quote');
  click('[data-act="q:step"][data-s="1"]'); await sleep(10);
  click('[data-act="q:jt"][data-v="stoin"]'); await sleep(5);
  ok(dr().toSto && dr().to === WH, L('a new quote, Into storage'));
  click('[data-act="q:jt"][data-v=""]'); await sleep(5);
  ok(!dr().toSto && dr().to === '' && !dr().stoPlan && !/Storage warehouse/.test(view()), L('back to Move: the warehouse comes off the delivery'));
  S().opt.storage = false; T.render(); await sleep(5);
  ok(!$('[data-act="q:jt"][data-v="stoin"]'), L('Options › Storage off: no Into storage'));
  S().opt.storage = true;
  ok(!A.errors.length, L('no errors: ' + A.errors.join(' | ')));
  process.exit(summary(label) ? 1 : 0);
})();

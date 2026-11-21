// Payroll (batch 8, Nov 20; Richie: "a fast export in spreadsheets to send to the payroll company", pay periods and
// overtime "under hr responsibility", an HR switch on the profile "just like lead or sales responsibility", and tips the
// company's way: split by the crew lead, or "by the hours worked on the job for jobs where someone is added").
// In the claude.ai copy: Payroll for the owner; the settings; a week's hours with daily and weekly overtime, a job's
// minimum top-up, time on a job someone joined late; what to check (still clocked in, a long shift, a job not finished,
// payroll IDs); fixing, adding and taking out a clock punch; tips by hours, evenly, split by the lead (on the job card
// and in Payroll) or left out; commission; the Excel workbook and the CSV; Copy here; the HR switch, and someone whose
// only side is HR; Reports › Employee hours agreeing.
const { load, ok, sleep, summary } = require('./lib');
const ART = __dirname + '/../../build/tally-artifact.html';
const L = (m) => 'payroll: ' + m;
const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

// the files: a zip stored without compression, read here entry by entry
function unzip(bytes) {
  const b = Buffer.from(bytes), out = {};
  let end = b.length - 22; while (end >= 0 && b.readUInt32LE(end) !== 0x06054b50) end--;
  const n = b.readUInt16LE(end + 10), cdOff = b.readUInt32LE(end + 16);
  let p = cdOff;
  for (let i = 0; i < n; i++) {
    if (b.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
    const method = b.readUInt16LE(p + 10), size = b.readUInt32LE(p + 20), nl = b.readUInt16LE(p + 28), el = b.readUInt16LE(p + 30), cl = b.readUInt16LE(p + 32), off = b.readUInt32LE(p + 42);
    const name = b.slice(p + 46, p + 46 + nl).toString('utf8');
    if (b.readUInt32LE(off) !== 0x04034b50) throw new Error('bad local header for ' + name);
    const lnl = b.readUInt16LE(off + 26), lel = b.readUInt16LE(off + 28);
    out[name] = { method, data: b.slice(off + 30 + lnl + lel, off + 30 + lnl + lel + size).toString('utf8') };
    p += 46 + nl + el + cl;
  }
  return out;
}

(async () => {
  const A = await load(ART, { setup: (w) => { w.TextEncoder = TextEncoder; } });   // jsdom has no TextEncoder; every browser does
  const { w, $, $$, click, T } = A;
  const st = () => T.state(), S = () => st().settings, P = () => T.payUi();
  const view = () => txt($('#view'));
  const toast = () => ($('#toast') && !$('#toast').hidden ? $('#toast').textContent : '');
  const fire = (el, v) => { if (typeof el === 'string') el = $(el); if (v !== undefined) el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const pick = (el) => { if (typeof el === 'string') el = $(el); el.checked = true; fire(el); };
  const pad = (n) => String(n).padStart(2, '0'), iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const addD = (s, n) => { const d = new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)); d.setDate(d.getDate() + n); return iso(d); };
  const at = (s, h, m) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), h, m || 0).getTime();
  const rows = () => $$('#prSum tr.prrow').map((r) => Array.from(r.children).map(txt).join(' | '));
  const rowOf = (n) => rows().find((r) => r.indexOf(n) === 0) || '';
  const go = async () => { T.ui.jobId = null; T.ui.tab = 'payroll'; T.render(); await sleep(20); };

  /* ---------- the owner has Payroll ---------- */
  click('[data-act="more:open"]'); await sleep(5);
  const mrow = $('#more [data-act="more:go"][data-tab="payroll"]');
  ok(!!mrow && /Payroll/.test(txt(mrow)) && /Hours, overtime and tips for the payroll company/.test(txt(mrow)), L('More › Payroll, for the owner'));
  click(mrow); await sleep(25);
  ok(T.ui.tab === 'payroll' && /Payroll settings ?Not set yet/.test(view()) && /Set how often you pay in Payroll settings, below/.test(view()), L('Payroll opens; the settings aren’t set yet, and it says so'));
  ok($('#prSet').open, L('so they open first'));

  /* ---------- the settings: weekly, from a Monday, overtime over 8 a day and 40 a week, tips by hours ---------- */
  const today = iso(new Date()), mon = addD(today, -((new Date().getDay() + 6) % 7)), d0 = addD(mon, -7), dd = (i) => addD(d0, i);
  pick('input[name="prFreq"][value="weekly"]'); await sleep(5);
  ok(!$('#prAnchorBox').hidden && $('#prSemiNote').hidden, L('weekly asks for a first day'));
  pick('input[name="prFreq"][value="semimonthly"]'); await sleep(5);
  ok($('#prAnchorBox').hidden && !$('#prSemiNote').hidden, L('twice a month says the 1st to the 15th and the 16th on'));
  pick('input[name="prFreq"][value="weekly"]');
  fire('[data-prc="anchor"]', addD(mon, -21)); fire('[data-prc="weekStart"]', '1');
  const od = $('[data-prc="otDayOn"]'); od.checked = true; fire(od);
  click('[data-act="pr:cfgsave"]'); await sleep(20);
  const pc = S().payroll || {};
  ok(pc.freq === 'weekly' && pc.anchor === addD(mon, -21) && pc.weekStart === 1 && pc.otWeekOn === true && pc.otWeek === 40 && pc.otDayOn === true && pc.otDay === 8 && pc.tips === 'hours' && pc.set === true, L('saved: weekly, Mondays, over 8 a day and 40 a week, tips by hours'));
  ok(/Payroll settings saved/.test(toast()) && !$('#prSet').open && /Weekly · overtime over 8 h a day or over 40 h a week · tips: by hours on the job/.test(txt($('#prSet summary'))), L('folded, with what they are'));
  ok(P().per.from === d0 && P().per.to === dd(6) && /The last pay period/.test(txt($('.prper'))), L('the last pay period: last week, Monday to Sunday (' + P().per.from + ')'));
  ok(JSON.stringify(T.periodOf('2026-11-20', { freq: 'semimonthly' })) === '{"from":"2026-11-16","to":"2026-11-30"}' && JSON.stringify(T.periodOf('2026-02-10', { freq: 'semimonthly' })) === '{"from":"2026-02-01","to":"2026-02-15"}'
    && JSON.stringify(T.periodOf('2026-02-20', { freq: 'monthly' })) === '{"from":"2026-02-01","to":"2026-02-28"}'
    && JSON.stringify(T.periodOf('2026-11-20', { freq: 'biweekly', anchor: '2026-11-02', weekStart: 1 })) === '{"from":"2026-11-16","to":"2026-11-29"}'
    && JSON.stringify(T.periodOf('2026-10-30', { freq: 'biweekly', anchor: '2026-11-02', weekStart: 1 })) === '{"from":"2026-10-19","to":"2026-11-01"}', L('pay periods: twice a month, monthly, and every 2 weeks either side of the first day'));

  /* ---------- a week of work ---------- */
  const base = JSON.parse(JSON.stringify(st().jobs.find((j) => j.status === 'paid')));
  const mk = (id, name, day, over) => { const j = JSON.parse(JSON.stringify(base)); Object.assign(j, { id, log: [], test: false, extras: [], materials: [], costs: [], payments: [], crewAdj: [], photos: [] }); delete j.crewOn; delete j.tipSplit; delete j.quotedBy; j.d = Object.assign({}, j.d, { name, moveDate: day }); j.quote = Object.assign({}, j.quote, { total: 1000 }); return Object.assign(j, over); };
  const J1 = mk('pj1', 'Ann Lee', dd(1), { status: 'paid', assign: { truckId: '', crew: ['Marcus', 'Andre'] }, actualHours: 4, minPaid: 3, startedAt: at(dd(1), 8), finishedAt: at(dd(1), 12),
    crewOn: { Marcus: [{ in: at(dd(1), 8), out: at(dd(1), 12) }], Andre: [{ in: at(dd(1), 10), out: at(dd(1), 12) }] }, payments: [{ id: 'pa1', amt: 1000, method: 'Card', date: dd(1), ts: at(dd(1), 12), tip: 90 }] });
  const J2 = mk('pj2', 'Bo Diaz', dd(2), { status: 'done', assign: { truckId: '', crew: ['Luis'] }, actualHours: 2.5, minPaid: 3, startedAt: at(dd(2), 9), finishedAt: at(dd(2), 11, 30) });
  const J3 = mk('pj3', 'Cy Ray', dd(3), { status: 'active', assign: { truckId: '', crew: ['Tanya'] }, startedAt: at(dd(3), 9) });
  st().jobs.length = 0; [J1, J2, J3].forEach((j) => st().jobs.push(j));
  const sh = (id, who, day, h1, m1, h2, m2, more) => Object.assign({ id, who, inAt: at(day, h1, m1), outAt: h2 == null ? 0 : at(day, h2, m2), activity: 'Job day', breaks: [], late: 0, note: '' }, more || {});
  st().shifts.length = 0;
  [sh('k0', 'Kim', dd(0), 7, 0, 17, 30, { breaks: [{ s: at(dd(0), 12), e: at(dd(0), 12, 30) }] }), sh('k1', 'Kim', dd(1), 7, 0, 17, 0), sh('k2', 'Kim', dd(2), 7, 0, 17, 0), sh('k3', 'Kim', dd(3), 7, 0, 17, 0), sh('k4', 'Kim', dd(4), 8, 0, 14, 0, { activity: 'Warehouse' }),
   sh('e3', 'Dee', dd(3), 8, 0, null), sh('t5', 'Tanya', dd(5), 6, 0, 21, 0)].forEach((x) => st().shifts.push(x));
  w.localStorage.setItem('tally.employees.local', JSON.stringify([{ id: 'ek', name: 'Kim', role: 'crew', email: '', active: true, info: { payrollId: 'K-1', workerType: 'W-2 employee', payType: 'Hourly' }, notes: '' },
    { id: 'el', name: 'Luis', role: 'crew', email: '', active: true, info: { payType: 'Hourly' }, notes: '' }]));
  await T.loadPeople(true); await go();

  ok(rows().length === 6 && /^Kim ?ID K-1 \| 38\.00 \| 8\.00 \| 46\.00 \| —/.test(rowOf('Kim')), L('Kim: four 10-hour days (a 30-minute break unpaid) and 6 on Friday: 38 regular, 8 overtime over 8 a day: ' + rowOf('Kim')));
  ok(rowOf('Marcus') === 'Marcus | 4.00 | — | 4.00 | $60', L('Marcus: his 4 hours on Ann Lee’s move (from the time clock on the job), and $60 of the $90 tip: ' + rowOf('Marcus')));
  ok(rowOf('Andre') === 'Andre | 2.00 | — | 3.00+1.00 top-up | $30', L('Andre joined 2 hours in: 2 worked, a 1-hour top-up to the 3-hour minimum, and $30, by his hours: ' + rowOf('Andre')));
  ok(rowOf('Luis') === 'Luis | 2.50 | — | 3.00+0.50 top-up | —', L('Luis, no time clock: the job’s 2.5 hours and a half-hour top-up: ' + rowOf('Luis')));
  ok(rowOf('Tanya') === 'Tanya | 8.00 | 7.00 | 15.00 | —', L('Tanya’s 15-hour Saturday: 7 of it overtime: ' + rowOf('Tanya')));
  ok(rowOf('Dee') === 'Deestill clocked in | — | — | — | —', L('Dee: still on the clock since Thursday: listed, and not counted until it’s fixed: ' + rowOf('Dee')));
  const chk = txt($('#prCheck'));
  ok(/Dee is still clocked in, since .* at 8:00 AM\. That shift isn’t counted until it’s fixed\./.test(chk), L('to check: Dee still clocked in, not counted until it’s fixed'));
  ok(/Tanya was on the clock 15h 0m on .*\. Is that right\?/.test(chk), L('Tanya’s long shift'));
  ok(/Cy Ray’s move \(.*\) isn’t finished, so its hours aren’t in yet for anyone who didn’t clock in\./.test(chk), L('a move still running'));
  ok(/No payroll ID for Andre, Dee, Luis, Marcus and Tanya\./.test(chk), L('payroll IDs: Kim has one, so the rest are missing'));

  /* ---------- each day ---------- */
  click($$('#prSum [data-act="pr:who"]').find((b) => b.dataset.n === 'Kim')); await sleep(10);
  const kd = $$('#prSum tr.prdays table.prday tr').slice(1).map((r) => Array.from(r.children).map(txt).join(' | '));
  ok(kd.length === 5 && /^Mon, .*Time clock \| 10\.00 \| 8\.00 \| 2\.00$/.test(kd[0]) && /^Fri, .*\| 6\.00 \| 6\.00 \| —$/.test(kd[4]), L('tap Kim: each day, worked, regular and overtime: ' + kd[0] + ' … ' + kd[4]));

  /* ---------- overtime by the week only ---------- */
  S().payroll = Object.assign({}, S().payroll, { otDayOn: false }); await go();
  ok(/^Kim ?ID K-1 \| 40\.00 \| 6\.00 \|/.test(rowOf('Kim')) && rowOf('Tanya') === 'Tanya | 15.00 | — | 15.00 | —', L('weekly overtime only: Kim 40 and 6 over, Tanya’s long day all regular'));
  // a week the period starts in the middle of: its earlier days count toward 40
  S().payroll = Object.assign({}, S().payroll, { weekStart: 4 }); P().per = { from: dd(1), to: dd(6) }; P().ck = [S().payroll.freq, S().payroll.anchor, 4].join('|');
  const R2 = T.payrollData({ from: dd(3), to: dd(6) });
  const k2 = R2.people.find((p) => p.name === 'Kim');
  ok(R2.lo === dd(3) && k2.reg === 16 && k2.ot === 0, L('the workweek from Thursday: Kim’s Thursday and Friday, 16 regular'));
  const R3 = T.payrollData({ from: dd(2), to: dd(4) }, { now: Date.now() });
  ok(R3.lo === addD(dd(3), -7) && R3.people.find((p) => p.name === 'Kim').reg === 26, L('a period starting on Wednesday reaches back to the week’s Thursday before it: ' + R3.lo));
  S().payroll = Object.assign({}, S().payroll, { weekStart: 1, otDayOn: true }); P().per = null; await go();

  /* ---------- fixing a punch ---------- */
  click($$('#prCheck [data-act="pr:fix"]').find((b) => b.dataset.id === 'e3')); await sleep(15);
  ok($('#prPunch').open && !!$('#pp_e3 .pred') && $('#pp_e3 [data-prf="inS"]').value === dd(3) + 'T08:00' && $('#pp_e3 [data-prf="outS"]').value === '', L('Fix opens Dee’s punch, clock in 8:00, no clock out'));
  fire('#pp_e3 [data-prf="outS"]', dd(3) + 'T07:00'); click('[data-act="pr:fixsave"]'); await sleep(10);
  ok(/Clock out has to be after clock in\./.test(txt($('#prErr'))), L('a clock out before the clock in: said so'));
  fire('#pp_e3 [data-prf="outS"]', dd(3) + 'T16:00'); click('[data-act="pr:fixsave"]'); await sleep(15);
  const e3 = st().shifts.find((x) => x.id === 'e3');
  ok(e3.outAt === at(dd(3), 16) && e3.fixes.length === 1 && e3.fixes[0].outAt === 0 && e3.fixes[0].inAt === at(dd(3), 8) && /Clock punch fixed/.test(toast()), L('saved, keeping who fixed it and what it was'));
  ok(rowOf('Dee') === 'Dee | 8.00 | — | 8.00 | —' && !/Dee is still clocked in/.test(txt($('#prCheck'))) && /Fixed by Owner|Fixed by/.test(txt($('#pp_e3'))), L('Dee: 8 hours; no longer to check; the punch says it was fixed'));
  /* ---------- adding one, taking one out ---------- */
  click('[data-act="pr:add"]'); await sleep(10);
  fire('[data-pra="who"]', 'Luis'); fire('[data-pra="day"]', dd(4)); fire('[data-pra="tin"]', '09:00'); fire('[data-pra="tout"]', '13:00');
  click('[data-act="pr:addsave"]'); await sleep(15);
  const added = st().shifts.find((x) => x.who === 'Luis');
  ok(added && added.inAt === at(dd(4), 9) && added.outAt === at(dd(4), 13) && added.added && rowOf('Luis') === 'Luis | 6.50 | — | 7.00+0.50 top-up | —', L('a missed shift for Luis on Friday, 9 to 1: his 7 hours: ' + rowOf('Luis')));
  click('[data-act="pr:add"]'); await sleep(10);
  fire('[data-pra="who"]', 'Kim'); fire('[data-pra="day"]', dd(4)); fire('[data-pra="tin"]', '10:00'); fire('[data-pra="tout"]', '11:00');
  click('[data-act="pr:addsave"]'); await sleep(10);
  ok(/That overlaps Kim’s shift on/.test(txt($('#prErr2'))), L('one on top of another shift: said so'));
  click('[data-act="pr:addno"]'); await sleep(5);
  click($$('#prPunch [data-act="pr:fix"]').find((b) => b.dataset.id === 'k4')); await sleep(10);
  click('#pp_k4 [data-act="pr:void"]'); await sleep(10);
  ok(/Tap again to take it out/.test(txt($('#pp_k4'))), L('taking a shift out asks once more'));
  click('#pp_k4 [data-act="pr:void"]'); await sleep(15);
  const k4 = st().shifts.find((x) => x.id === 'k4');
  ok(k4 && k4.void && k4.void.by && /^Kim ?ID K-1 \| 32\.00 \| 8\.00 \|/.test(rowOf('Kim')) && !$('#pp_k4'), L('Kim’s Friday is out of the hours (kept, marked): 32 and 8'));
  ok(T.shiftMs(k4) === 0 && T.paidToday('Kim') === T.paidToday('Kim'), L('it counts for nothing anywhere'));

  /* ---------- payroll IDs ---------- */
  click('#prCheck [data-act="pr:ids"]'); await sleep(10);
  ok($('#prIds').open && !!$('[data-prid="Luis"]') && !$('[data-prid="Andre"]') && /No profile yet/.test(txt($('#prIds'))), L('Add: the IDs, for the people with a profile'));
  fire('[data-prid="Luis"]', 'L 22'); click('[data-act="pr:idsave"]'); await sleep(20);
  ok((T.people.list.find((e) => e.name === 'Luis') || {}).info.payrollId === 'L 22' && JSON.parse(w.localStorage.getItem('tally.employees.local')).find((e) => e.name === 'Luis').info.payrollId === 'L 22' && /Payroll IDs saved/.test(toast()), L('saved on Luis’s profile'));
  ok(/No payroll ID for Andre, Dee, Marcus and Tanya\./.test(txt($('#prCheck'))) && /^Luis ?ID L 22/.test(rowOf('Luis')), L('and he’s off the list'));

  /* ---------- tips ---------- */
  S().payroll = Object.assign({}, S().payroll, { tips: 'even' }); await go();
  ok(rowOf('Marcus').endsWith('$45') && rowOf('Andre').endsWith('$45'), L('tips evenly: $45 each'));
  const cents = T.splitCents(100, { A: 1, B: 1, C: 1 });
  ok(cents.A === 33.34 && cents.B === 33.33 && cents.C === 33.33, L('$100 three ways adds up to the cent: 33.34, 33.33, 33.33'));
  S().payroll = Object.assign({}, S().payroll, { tips: 'off' }); await go();
  ok(!/Tips/.test(txt($('#prSum tr'))) && !$('#prTips'), L('tips left out: no tips column'));
  S().payroll = Object.assign({}, S().payroll, { tips: 'lead' }); await go();
  ok(/The tip on Ann Lee’s move isn’t split yet\. Until it is, it’s split evenly\./.test(txt($('#prCheck'))) && rowOf('Marcus').endsWith('$45'), L('the lead splits it: not yet, so evenly for now'));
  click('#prTips [data-act="tip:open"]'); await sleep(10);
  ok(!!$('#prTips .tiped') && $('[data-tipn="Marcus"]').value === '45' && /Adds up to the \$90 tip/.test(txt($('#tipSum'))), L('Split: each share, even to start'));
  fire('[data-tipn="Marcus"]', '70'); await sleep(5);
  ok(/Adds up to \$115: \$25 too much\./.test(txt($('#tipSum'))), L('it adds them up as you type'));
  click('#prTips [data-act="tip:save"]'); await sleep(10);
  ok(/The shares add up to \$115, not the \$90 tip\./.test(txt($('#tipErr'))), L('and won’t save a split that doesn’t add up'));
  fire('[data-tipn="Andre"]', '20'); click('#prTips [data-act="tip:save"]'); await sleep(15);
  ok(J1.tipSplit && J1.tipSplit.amts.Marcus === 70 && J1.tipSplit.amts.Andre === 20 && J1.tipSplit.total === 90 && J1.tipSplit.by && J1.log.some((l) => /^Tip split by .*: Andre \$20, Marcus \$70$/.test(l.ev)), L('saved on the job, with who split it'));
  ok(rowOf('Marcus').endsWith('$70') && rowOf('Andre').endsWith('$20') && !/isn’t split yet/.test(txt($('#prCheck'))) && /Split by .*: Andre \$20 · Marcus \$70/.test(txt($('#prTips'))), L('Marcus $70, Andre $20'));
  ok(T.jobDoc(J1).tipSplit.amts.Marcus === 70, L('the split syncs with the job'));
  // a tip after the split
  J1.payments.push({ id: 'pa2', amt: 0.01, method: 'Cash', date: dd(2), ts: at(dd(2), 9), tip: 10 }); await go();
  ok(/A tip came in on Ann Lee’s move after .* split it\./.test(txt($('#prCheck'))) && rowOf('Marcus').endsWith('$77.78') && rowOf('Andre').endsWith('$22.22'), L('a tip after the split: to check, and shared the same way meanwhile: ' + rowOf('Marcus') + ' / ' + rowOf('Andre')));
  J1.payments.pop();
  // the crew lead, on the job card
  click('[data-act="more:open"]'); await sleep(5); click('[data-act="more:preview"]'); await sleep(5);
  click($$('#more [data-act="pv:set"]').find((b) => b.dataset.staff === 'Marcus')); await sleep(15);
  T.ui.tab = 'crew'; T.ui.crewView = 'history'; T.render(); await sleep(15); await A.openCard('pj1');
  const card = () => txt($('#view details.hcard[data-job="pj1"]') || $('#view'));
  ok(/Tip from the customer: \$90: Andre \$20, Marcus \$70\. Split by/.test(card()) && !!$('#view [data-act="tip:open"][data-id="pj1"]'), L('Marcus, the lead, sees the split on the job card, and Change the split'));
  click('#view [data-act="tip:open"][data-id="pj1"]'); await sleep(10);
  fire('[data-tipn="Marcus"]', '45'); fire('[data-tipn="Andre"]', '45'); click('#view [data-act="tip:save"]'); await sleep(15);
  ok(J1.tipSplit.amts.Marcus === 45 && J1.tipSplit.by === 'Marcus' && /Split by Marcus/.test(card()), L('he splits it again himself'));
  click('[data-act="pv:end"]'); await sleep(10);
  S().payroll = Object.assign({}, S().payroll, { tips: 'hours' });

  /* ---------- commission ---------- */
  S().commPct = 5; J1.quotedBy = 'Dee'; await go();
  ok(/Comm\./.test(txt($('#prSum tr'))) && rowOf('Dee').endsWith('$50') && /Hours, tips and commission/.test(txt($('#prSum h2'))), L('commission: Dee quoted Ann Lee’s $1,000 move, paid in this period: $50'));

  /* ---------- the files ---------- */
  const R = P().R, sheets = T.paySheets(R);
  ok(sheets.map((s) => s.name).join('|') === 'Payroll summary|By day|Clock punches|Tips|Commission', L('the workbook’s sheets: ' + sheets.map((s) => s.name).join(', ')));
  const z = unzip(T.xlsxBook(sheets, 'Payroll'));
  const names = Object.keys(z);
  ok(names[0] === '[Content_Types].xml' && ['xl/workbook.xml', 'xl/styles.xml', 'xl/_rels/workbook.xml.rels', '_rels/.rels', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet5.xml', 'docProps/core.xml'].every((n) => names.includes(n)) && names.every((n) => z[n].method === 0), L('an Excel workbook: its parts, stored'));
  const bad = names.filter((n) => /\.(xml|rels)$/.test(n)).filter((n) => new w.DOMParser().parseFromString(z[n].data, 'application/xml').getElementsByTagName('parsererror').length);
  ok(bad.length === 0, L('every part is well-formed XML' + (bad.length ? ': ' + bad.join(', ') : '')));
  const s1 = z['xl/worksheets/sheet1.xml'].data;
  ok(/<c r="A1" s="6" t="inlineStr"><is><t>.*payroll for /.test(s1) && /<c r="A4" s="1" t="inlineStr"><is><t>Employee<\/t>/.test(s1) && /<pane ySplit="4"/.test(s1), L('the summary: a title, the column names on row 4, frozen under them'));
  ok(/<c r="A5" s="0" t="inlineStr"><is><t>Andre<\/t><\/is><\/c>.*<c r="E5" s="2"><v>2<\/v><\/c><c r="F5" s="2"><v>0<\/v><\/c><c r="G5" s="2"><v>1<\/v><\/c><c r="H5" s="2"><v>3<\/v><\/c>/.test(s1), L('Andre’s row: 2 regular, 0 overtime, 1 top-up, 3 in all, as numbers'));
  ok(/<c r="B\d+" s="0" t="inlineStr"><is><t>K-1<\/t>/.test(s1) && /t="inlineStr"><is><t>Total<\/t>/.test(s1) && /s="7"><v>/.test(s1), L('Kim’s payroll ID, and the totals row'));
  const s3 = z['xl/worksheets/sheet3.xml'].data;
  ok(/<c r="C2" s="5"><v>\d+\.\d+<\/v>/.test(s3) && /fixed by /.test(s3) && /added by /.test(s3) && !/>k4</.test(s3), L('clock punches: real dates and times, fixes and additions noted, the one taken out left out'));
  ok(/numFmtId="166" formatCode="&quot;\$&quot;#,##0\.00"/.test(z['xl/styles.xml'].data), L('money shows as dollars'));
  const csv = T.csvOf(sheets[0].rows.slice(3, 4 + R.people.length));
  ok(csv.charCodeAt(0) === 0xFEFF && csv.split('\r\n')[0] === '\uFEFFEmployee,Payroll ID,Worker type,Pay type,Regular hours,Overtime hours,Min. top-up hours,Total hours,Tips,Commission'
    && csv.split('\r\n')[1] === 'Andre,,,,2,0,1,3,30,0' && csv.split('\r\n').length === R.people.length + 2, L('the CSV: one row a person, numbers plain: ' + csv.split('\r\n')[1]));
  ok(T.csvOf([['=SUM(A1)', 'a,b', 'say "hi"']]) === '\uFEFF\'=SUM(A1),"a,b","say ""hi"""\r\n', L('a CSV can’t carry a formula in, and quotes what it must'));
  ok(T.crc32(new TextEncoder().encode('123456789')) === 0xCBF43926, L('the zip’s checksums are the standard ones'));
  // here, in claude.ai: copy instead of a file
  ok(!$('[data-act="pr:file"]') && !!$('[data-act="pr:copy"][data-w="sum"]') && /The MoveCrew app and website make these as an Excel file or a CSV/.test(view()), L('in this copy: Copy the summary, and where the files come from'));
  click('[data-act="pr:copy"][data-w="sum"]'); await sleep(15);
  ok(!!$('#prCopy') && $('#prCopy').value.split('\n')[0] === 'Employee\tPayroll ID\tWorker type\tPay type\tRegular hours\tOvertime hours\tMin. top-up hours\tTotal hours\tTips\tCommission', L('no clipboard here: the box to copy from, tab-separated'));

  /* ---------- Reports › Employee hours agrees ---------- */
  T.ui.from = d0; T.ui.to = dd(6); T.ui.tab = 'reports'; T.render(); await sleep(20);
  const rr = $$('#hoursCard table.tbl tr').map((r) => Array.from(r.cells).map(txt));
  const andre = rr.find((c) => /^Andre/.test(c[0]) || /^Andre/.test(c[0] || '')) || [];
  ok(andre[2] === '2.0' && andre[3] === '+1.0' && andre[4] === '3.0' && !!$('#hoursCard [data-act="tab"][data-tab="payroll"]'), L('Reports › Employee hours: Andre’s own 2 hours and his own top-up, and a way to Payroll: ' + andre.join(' | ')));
  const kimR = rr.find((c) => /^Kim/.test(c[0])) || [];
  ok(kimR[1] === '40.0', L('Kim’s clock there leaves out the shift taken out: ' + kimR[1]));

  /* ---------- the HR switch ---------- */
  T.ui.tab = 'settings'; T.ui.setSec = 'employees'; T.render(); await sleep(20);
  click('[data-act="emp:new"]'); await sleep(15);
  ok(!!$('#emp [data-ak="hr"]') && /HR ?Payroll: hours, overtime and tips/.test(txt($('#emp .sides'))) && !!$('#emp [data-ek="payrollId"]'), L('a profile has the HR switch beside the others, and a Payroll ID'));
  fire('#emp [data-ek="name"]', 'Pat Ruiz'); const off = $('#emp input[name="empField"][value="off"]'); off.checked = true; fire(off); await sleep(5);
  const hrs = $('#emp [data-ak="hr"]'); hrs.checked = true; fire(hrs); await sleep(10);
  ok(/Pat sees: Payroll: everyone’s hours, overtime and tips, to send to the payroll company\./.test(txt($('#emp'))), L('with HR alone: what Pat sees'));
  fire('#emp [data-ek="payrollId"]', 'P<7>'); click('[data-act="emp:save"]'); await sleep(20);
  ok(/Payroll ID: up to 40 letters/.test(txt($('#empErr'))), L('a payroll ID with odd marks: said so'));
  fire('#emp [data-ek="payrollId"]', 'P-7'); click('[data-act="emp:save"]'); await sleep(25);
  ok((S().hr || []).indexOf('Pat Ruiz') >= 0 && S().crew.indexOf('Pat Ruiz') < 0 && T.hrHas('Pat Ruiz') && T.people.list.find((e) => e.name === 'Pat Ruiz').info.payrollId === 'P-7', L('saved: Pat has HR (the settings’ hr list), no field side'));
  click('[data-act="emp:close"]'); await sleep(10);
  ok(/Pat Ruiz.*HR/.test($$('.emprow').map(txt).join('|')), L('the Employees list says HR'));
  // Kim, crew, gets HR too
  click($$('.emprow').find((r) => /^Kim/.test(txt(r)))); await sleep(15);
  const hk = $('#emp [data-ak="hr"]'); hk.checked = true; fire(hk); click('[data-act="emp:save"]'); await sleep(25); click('[data-act="emp:close"]'); await sleep(10);
  ok(S().hr.indexOf('Kim') >= 0 && S().crew.indexOf('Kim') >= 0, L('Kim: crew, and HR'));
  // see it their way
  const preview = async (n) => { click('[data-act="more:open"]'); await sleep(5); click('[data-act="more:preview"]'); await sleep(5); const b = $$('#more [data-act="pv:set"]').find((x) => x.dataset.staff === n); if (b) click(b); await sleep(20); return !!b; };
  const tabs = () => $$('#tabs button').map((b) => b.textContent.replace(/\d+$/, '').trim()).filter(Boolean).join('|');
  await preview('Kim');
  click('[data-act="more:open"]'); await sleep(5);
  ok(tabs() === 'Jobs|Chat|More' && !!$('#more [data-act="more:go"][data-tab="payroll"]'), L('Kim’s phone: her jobs and Chat, and Payroll in More: ' + tabs()));
  click('#more [data-act="more:go"][data-tab="payroll"]'); await sleep(20);
  ok(T.ui.tab === 'payroll' && !!$('#prSum'), L('her Payroll'));
  click('[data-act="pv:end"]'); await sleep(10);
  const pv = await preview('Pat Ruiz');
  ok(pv && tabs() === 'Payroll|Chat|More' && T.ui.tab === 'payroll' && !!$('#prSum'), L('Pat, HR alone: Payroll and Chat, opening on Payroll: ' + tabs()));
  click('[data-act="more:open"]'); await sleep(5);
  ok(!$('#more [data-act="more:go"][data-tab="payroll"]') && !/Truck down/.test(txt($('#more'))), L('nothing more for Pat in More (no second Payroll, no Truck down)'));
  click('[data-act="more:close"]'); click('[data-act="pv:end"]'); await sleep(10);
  await preview('Luis');
  click('[data-act="more:open"]'); await sleep(5);
  ok(!$('#more [data-act="more:go"][data-tab="payroll"]') && !T.canHR(), L('Luis, without HR: no Payroll'));
  T.ui.tab = 'payroll'; T.render(); await sleep(15);
  ok(T.ui.tab !== 'payroll', L('and he can’t land on it'));
  click('[data-act="pv:end"]'); await sleep(10);

  ok(A.errors.length === 0, L('no errors (' + A.errors.slice(0, 3).join(' | ') + ')'));
  process.exit(summary('payroll') ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

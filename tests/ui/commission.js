// Sales, batch 6 (Nov 17; Richie: "% of the final bill, once paid", to "Whoever made the quote"): Setup › Sales
// commission, Reports › Commissions (the paid moves in the days picked, by who made the quote; MoveCrew's call center
// billed instead; what's waiting to be paid), the job sheet's line, who made the quote (the first to save it with a
// price), and the owner's alone.
const { load, ok, sleep, summary } = require('./lib');
const ART = __dirname + '/../../build/tally-artifact.html';
const L = (m) => 'commission: ' + m;
const txt = (el) => { if (!el) return ''; const out = []; const walk = (n) => { if (n.nodeType === 3) out.push(n.nodeValue); else if (n.nodeType === 1) { out.push(' '); n.childNodes.forEach(walk); out.push(' '); } }; walk(el); return out.join('').replace(/\s+/g, ' ').replace(/ ([.,:;)]|’s)/g, '$1').replace(/\( /g, '(').trim(); };
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const day = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return iso(d); };

(async () => {
  const A = await load(ART, {});
  const { w, $, $$, click, T } = A;
  const st = () => T.state(), S = () => st().settings;
  const type = (el, v) => { if (typeof el === 'string') el = $(el); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
  const go = async (tab, more) => { T.ui.jobId = null; T.ui.tab = tab; Object.assign(T.ui, more || {}); T.render(); await sleep(15); };
  const base = JSON.parse(JSON.stringify(st().jobs.find((j) => j.d.name === 'Sam Kowalski')));
  const mk = (id, name, over) => { const j = JSON.parse(JSON.stringify(base)); j.id = id; j.log = []; j.test = false; j.extras = []; j.materials = []; j.payments = []; j.d = Object.assign({}, j.d, { name, moveDate: day(-3) }); j.quote = Object.assign({}, j.quote, { total: 1000 }); Object.assign(j, over); return j; };
  const pay = (amt, date) => [{ id: 'p' + Math.round(amt), amt, method: 'Card', date, ts: Date.now() }];
  const jobs = [
    mk('c1', 'Ann Paid', { status: 'paid', quotedBy: 'Dee', createdBy: 'Owner', payments: pay(1000, day(-2)) }),
    mk('c2', 'Bob Paid', { status: 'paid', createdBy: 'Owner', payments: pay(1000, day(-1)) }),
    mk('c3', 'Cal Team', { status: 'paid', quotedBy: 'Jess', quotedTeam: true, createdCC: true, createdBy: 'Jess', payments: pay(1000, day(-1)) }),
    mk('c4', 'Dot Booked', { status: 'booked', quotedBy: 'Dee', d: Object.assign({}, base.d, { name: 'Dot Booked', moveDate: day(3) }) }),
    mk('c5', 'Eve Test', { status: 'paid', quotedBy: 'Dee', test: true, payments: pay(1000, day(-1)) }),
    mk('c6', 'Fay Old', { status: 'paid', quotedBy: 'Dee', payments: pay(1000, day(-40)) }),
    mk('c7', 'Gus Lead', { status: 'quoted', quotedBy: 'Dee' }),
  ];
  jobs[0].extras = [{ id: 'x1', label: 'Extra stop', amt: 200 }];   // the final bill: $1,200
  jobs[0].payments = pay(1200, day(-2));
  st().jobs.length = 0; jobs.forEach((j) => st().jobs.push(j));
  T.ui.from = day(-7); T.ui.to = '';

  /* ---------- none set yet ---------- */
  await go('reports');
  const rep = () => $('#commRep');
  const rows = () => Array.from(rep().querySelectorAll('tr')).slice(1).map((r) => Array.from(r.children).map(txt).join(' | '));
  ok(!!rep() && /^Commissions No commission % is set yet: set one in Setup › Sales commission\. Here are the paid moves each person quoted\./.test(txt(rep())), L('Reports › Commissions, before a % is set'));
  ok(rows().join(' / ') === 'Dee | 1 | $1,200 | — / Owner | 1 | $1,000 | — / MoveCrew’s call center | 1 | $1,000 | billed as call center work / Total | 3 | $3,200 | —', L('the paid moves by who made the quote: ' + rows().join(' / ')));
  /* ---------- Setup › Sales commission ---------- */
  await go('settings', { setSec: '' });
  ok(/Sales commission None set yet/.test(txt($('#view'))), L('the Setup list: none set yet'));
  await go('settings', { setSec: 'commission' });
  const pct = $('[data-s="commPct"]');
  ok(pct && pct.value === '0' && /Whoever made the quote earns this share of the final bill \(the quote, extras and materials, never tips\) once the move is paid\./.test(txt($('#view'))), L('Setup › Sales commission: 0 to start, and what it means'));
  type(pct, '5'); await sleep(5);
  ok(S().commPct === 5, L('5%'));
  await go('settings', { setSec: '' });
  ok(/Sales commission 5% of the final bill to whoever made the quote/.test(txt($('#view'))), L('the Setup list says so'));
  /* ---------- Reports › Commissions ---------- */
  await go('reports');
  ok(/^Commissions 5% of the final bill to whoever made the quote, once the move is paid, for the moves paid on the days picked\./.test(txt(rep())), L('5% of the final bill'));
  ok(rows().join(' / ') === 'Dee | 1 | $1,200 | $60 / Owner | 1 | $1,000 | $50 / MoveCrew’s call center | 1 | $1,000 | billed as call center work / Total | 3 | $3,200 | $110', L('Dee $60 on her $1,200 bill, the Owner $50, MoveCrew’s call center none: ' + rows().join(' / ')));
  ok(/Not paid yet: 1 booked or finished move, about \$50 in commission once it’s paid\./.test(txt(rep())), L('the booked one waits: ' + (txt(rep()).match(/Not paid yet[^.]*\./) || [''])[0]));
  ok(!/Eve Test|Fay Old|Gus Lead/.test(txt(rep())) && rows().length === 4, L('not a test job, not one paid before the days picked, not an open quote'));
  T.ui.from = ''; T.render(); await sleep(10);
  ok(rows()[0] === 'Dee | 2 | $2,200 | $110', L('all time: Dee’s older one too: ' + rows()[0]));
  T.ui.from = day(-7);
  /* ---------- the job sheet ---------- */
  const sheet = async (jid) => { T.openJob(jid); await sleep(15); return txt($('#sheet')); };
  ok((await sheet('c1')).indexOf('Commission: $60 to Dee (5% of the $1,200 bill).') > 0, L('a paid move: its commission'));
  ok((await sheet('c4')).indexOf('Commission: Dee earns 5% of the final bill once it’s paid (about $50 now).') > 0, L('a booked one: once it’s paid'));
  ok((await sheet('c3')).indexOf('Quoted by MoveCrew’s call center (Jess): billed as call center work, no commission.') > 0, L('MoveCrew’s call center: billed instead'));
  T.ui.jobId = null; T.render();
  /* ---------- who made the quote: the first to save it with a price ---------- */
  const it = S().catalog.filter((i) => i.cf >= 30 && i.cf <= 70)[0];
  const d0 = st().draft; Object.assign(d0, { name: 'Hal New', phone: '(512) 555-0133', moveDate: day(9), time: '09:00', from: '1 A St, Austin', to: '2 B St, Austin', miles: '4' });
  d0.items = {};
  await go('quote', { qstep: 3 }); click('#qSave'); await sleep(20);
  const H = st().jobs.find((j) => j.d.name === 'Hal New');
  ok(H && H.status === 'lead' && !H.quotedBy && !!H.createdBy, L('a lead saved with no price: no quote maker yet'));
  st().ui.role = 'dispatch'; st().ui.who = '';
  T.ui.jobId = null; st().draft = Object.assign({}, st().draft, H.d, { editId: H.id, items: {} }); st().draft.items[it.id] = 10;
  await go('quote', { qstep: 3 }); click('#qSave'); await sleep(20);
  const disp = (S().office.find((o) => o.kind === 'dispatch') || {}).name;
  ok(H.quote.total > 0 && H.quotedBy === disp && H.quotedBy !== H.createdBy, L('priced by dispatch: dispatch made the quote (' + H.quotedBy + ', the lead was ' + H.createdBy + '’s)'));
  st().ui.role = 'owner';
  st().draft = Object.assign({}, st().draft, H.d, { editId: H.id }); st().draft.items[it.id] = 12;
  await go('quote', { qstep: 3 }); click('#qSave'); await sleep(20);
  ok(H.quotedBy === disp, L('saved again by the owner: still dispatch’s'));
  /* ---------- the owner's alone ---------- */
  st().ui.role = 'dispatch'; await go('reports');
  ok(!$('#commRep'), L('dispatch sees no Commissions'));
  ok((await sheet('c1')).indexOf('Commission:') < 0, L('nor the line on the job'));
  st().ui.role = 'owner'; T.ui.jobId = null;
  ok(A.errors.length === 0, L('no errors (' + A.errors.slice(0, 3).join(' | ') + ')'));
  process.exit(summary('commission') ? 1 : 0);
})().catch((e) => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });

// Sales, batch 4 (Nov 17): Reports › Sales (how the leads that came in went: reached, priced, booked, lost and why, the
// first call, by who worked them and where they came from, the call center's part, what's waiting now) and MoveCrew
// admin's call center work for billing (the hosted app, with the server's list stood in).
const { load, ok, sleep, summary } = require('./lib');
const ART = __dirname + '/../../build/tally-artifact.html', HOSTED = __dirname + '/../../build/tally-supabase.html';
const L = (m) => 'salesreport: ' + m;
// the words as read: each element's text apart from the next (jsdom's textContent runs block elements together)
const txt = (el) => { if (!el) return ''; const out = []; const walk = (n) => { if (n.nodeType === 3) out.push(n.nodeValue); else if (n.nodeType === 1) { out.push(' '); n.childNodes.forEach(walk); out.push(' '); } }; walk(el); return out.join('').replace(/\s+/g, ' ').replace(/ ([.,:;)]|’s)/g, '$1').replace(/\( /g, '(').trim(); };

(async () => {
  const A = await load(ART, {});
  const { $, $$, click, T } = A;
  const now = Date.now(), H = 36e5, M = 6e4;
  const base = JSON.parse(JSON.stringify(T.state().jobs.find((j) => j.d.name === 'Sam Kowalski')));
  const mk = (id, over, d, quote) => { const j = JSON.parse(JSON.stringify(base)); j.id = id; j.log = []; j.test = false; Object.assign(j, over); j.d = Object.assign({}, j.d, d); j.quote = Object.assign({}, j.quote, quote || { total: 0 }); return j; };
  const jobs = [
    mk('a', { status: 'quoted', createdAt: now - 2 * H, sales: { n: 1, owner: 'Dee', first: now - 2 * H + 12 * M } }, { name: 'Ann Web', source: 'Website' }, { total: 900 }),
    mk('b', { status: 'lead', createdAt: now - H, sales: { missed: { at: now - H } } }, { name: '', phone: '(512) 555-0177', source: 'Missed call' }),
    mk('c', { status: 'booked', createdAt: now - 3 * H, createdBy: 'Owner', sales: { n: 1, owner: 'Owner', first: now - 3 * H } }, { name: 'Cal Google', source: 'Google' }, { total: 1200 }),
    mk('d', { status: 'lost', createdAt: now - 5 * H, sales: { n: 2, owner: 'Dee', first: now - 5 * H + 40 * M, lost: { k: 'price', at: now - H, by: 'Dee' } } }, { name: 'Dot Web', source: 'Website' }, { total: 800 }),
    mk('e', { status: 'quoted', createdAt: now - H, test: true }, { name: 'Test job', source: 'Website' }, { total: 500 }),
    mk('f', { status: 'quoted', createdAt: now - 40 * 864e5 }, { name: 'Old lead', source: 'Yelp' }, { total: 700 }),
  ];
  T.state().jobs.length = 0; jobs.forEach((j) => T.state().jobs.push(j));
  T.ui.from = new Date(now - 7 * 864e5).toISOString().slice(0, 10); T.ui.to = '';
  T.ui.tab = 'reports'; T.render(); await sleep(20);
  const card = () => $('#salesRep');
  const kpis = () => $$('#salesRep .kpi').map(txt);
  ok(!!card() && /^Sales The leads that came in from .+ on, and what became of them\./.test(txt(card())), L('Reports has Sales, for the days picked: ' + txt(card()).slice(0, 90)));
  ok(kpis().join(' | ') === '4 Leads came in | 75% Reached (3) | 25% Booked (1) | 12 min To the first call', L('four leads (not the test job, not the old one): 3 reached, 1 booked, the first call within 12 min: ' + kpis().join(' | ')));
  const fun = $$('#salesRep .sfun:not(.swhy)').map(txt);
  ok(fun.join(' | ') === 'Came in 4 | Reached 3 | Priced 3 | Booked 1' && /1 lost · 2 still open · half got their first call within 12 min/.test(txt(card())), L('the funnel: ' + fun.join(' | ')));
  const rows = (h) => { const t = $$('#salesRep h3').find((x) => txt(x) === h); const tb = t && t.nextElementSibling && t.nextElementSibling.querySelector('table'); return tb ? Array.from(tb.querySelectorAll('tr')).slice(1).map((r) => Array.from(r.children).map(txt).join(' ')) : []; };
  ok(rows('By who worked them').join(' | ') === 'Dee 2 2 0 0% | No one 1 0 0 0% | Owner 1 1 1 100%', L('by who worked them: ' + rows('By who worked them').join(' | ')));
  ok(rows('By where they came from').join(' | ') === 'Website 2 0 0% 12 min | Google 1 1 100% — | Missed call 1 0 0% —', L('by where they came from, with how soon the first call came: ' + rows('By where they came from').join(' | ')));
  ok($$('#salesRep .sfun.swhy').map(txt).join(' | ') === 'Price 1', L('lost, and why: Price'));
  ok(/Right now: 3 open in Sales, 2 not called yet, 1 due\./.test(txt(card())) && !!card().querySelector('[data-act="sl:go"][data-f="due"]'), L('what’s waiting right now, with Open Sales: ' + (txt(card()).match(/Right now:[^.]*\./) || [''])[0]));
  ok(!/call center/.test(txt(card())), L('no call center line without its work'));
  // the call center's part
  T.state().jobs.push(mk('g', { status: 'booked', createdAt: now - 4 * H, createdCC: true, bookedCC: { at: now - 3 * H, by: 'Jess', team: true }, sales: { n: 1, owner: 'Jess', first: now - 4 * H } }, { name: 'Gus CC', source: 'Google' }, { total: 1000 }));
  T.state().jobs.push(mk('h', { status: 'booked', createdAt: now - 4 * H, createdCC: true, bookedCC: { at: now - 3 * H, by: 'Tanya', team: false }, sales: { n: 1, owner: 'Tanya', first: now - 4 * H } }, { name: 'Hal Own', source: 'Google' }, { total: 1000 }));
  T.render(); await sleep(15);
  ok(/The call center made 2 of these and booked 2 \(1 by MoveCrew’s call center, 1 by your own\)\./.test(txt(card())), L('the call center’s part, MoveCrew’s and the company’s own: ' + (txt(card()).match(/The call center[^.]*\./) || [''])[0]));
  // all time, and nothing in the days picked
  T.ui.from = ''; T.render(); await sleep(10);
  ok(/^7 Leads came in/.test(kpis()[0]) && /came in any time/.test(txt(card())), L('blank days: any time (the old lead too)'));
  T.ui.from = '2020-01-01'; T.ui.to = '2020-01-31'; T.render(); await sleep(10);
  ok(/No leads came in then\./.test(txt(card())) && !card().querySelector('.kpi'), L('no leads in the days picked: says so'));
  T.ui.from = ''; T.ui.to = '';
  // Open Sales goes to the board
  T.render(); await sleep(10);
  click('#salesRep [data-act="sl:go"]'); await sleep(15);
  ok(T.ui.tab === 'quotes' && T.ui.slf === 'due', L('Open Sales: the board, on Due now'));
  // dispatch sees it too
  T.ui.role = 'dispatch'; T.ui.tab = 'reports'; T.render(); await sleep(15);
  ok(!!card() && /Leads came in/.test(txt(card())), L('dispatch sees Sales in Reports too'));
  ok(A.errors.length === 0, L('no errors (' + A.errors.slice(0, 3).join(' | ') + ')'));

  /* ---------- MoveCrew admin: the call center's work, for billing ---------- */
  const ORG = 'org-1', mth = (i) => { const d = new Date(); const x = new Date(d.getFullYear(), d.getMonth() - i, 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
  const put = (docs, path, data) => { const [collection, doc_id] = path.split('/'); docs.push({ org_id: ORG, path, collection, doc_id, data, updated_at: new Date().toISOString() }); };
  const docs = []; put(docs, 'meta/init', { ts: 1, mode: 'fresh' }); put(docs, 'org/settings', { company: 'Blue Moving', crew: ['Marcus'], leads: ['Marcus'], office: [{ name: 'Ana', kind: 'owner' }], contacts: {}, forms: [], trucks: [] });
  const companies = [{ id: 'org-blue', name: 'Blue Moving', created: new Date().toISOString(), owners: ['ana@x'], invited: [], members: 3, test: false, waived: false, discount_pct: 0, note: '', cc: true, member: { state: 'active', price_cents: 14900 }, cards: 'connected' },
    { id: 'org-green', name: 'Green Movers', created: new Date().toISOString(), owners: ['gus@x'], invited: [], members: 2, test: false, waived: false, discount_pct: 0, note: '', cc: true, member: { state: 'trial' }, cards: 'none' }];
  const bill = [{ org: 'org-green', months: { [mth(0)]: { booked: 3, quoted: 5 }, [mth(2)]: { booked: 1, quoted: 1 } } }, { org: 'org-blue', months: { [mth(1)]: { booked: 2, quoted: 4 } } }, { org: 'org-gone', months: { [mth(5)]: { booked: 9, quoted: 9 } } }];
  const B = await load(HOSTED, { db: { docs, access_requests: [], comm_log: [], comm_lines: [], members: [{ org_id: ORG, user_id: 'u-ana', email: 'ana@x.com', staff: 'Ana', role: 'owner', ts: 1 }] }, org: ORG, me: { uid: 'u-ana', email: 'ana@x.com' },
    fnReply: (b) => b.action === 'member_status' ? { ok: true, admin: true, test: true, state: 'test' } : b.action === 'admin_list' ? { ok: true, plan: { monthly_cents: 14900, trial_days: 14 }, payments: 'test', companies, team: [{ email: 'jess@x', name: 'Jess', phone: '5125550107', signedIn: true }], ccBill: bill } : { ok: true } });
  await sleep(200);
  B.T.ui.tab = 'admin'; B.T.render(); await sleep(80);
  const bc = B.$('#admBill');
  const brow = (n) => { const r = bc && Array.from(bc.querySelectorAll('tr')).find((x) => txt(x.children[0]) === n); return r ? Array.from(r.children).slice(1).map(txt).join(' | ') : ''; };
  ok(!!bc && /^Call center work/.test(txt(bc)) && bc.querySelectorAll('th').length === 4, L('MoveCrew admin: Call center work, the last three months'));
  ok(brow('Blue Moving') === '— | 2 booked 4 quotes | —' && brow('Green Movers') === '3 booked 5 quotes | — | 1 booked 1 quote', L('per company and month, booked and quotes made: ' + brow('Blue Moving') + ' / ' + brow('Green Movers')));
  ok(!/org-gone|A company no longer here/.test(txt(bc)) && txt(bc).indexOf('Blue Moving') < txt(bc).indexOf('Green Movers'), L('nothing older than three months, by company name'));
  ok(B.errors.length === 0, L('admin: no errors (' + B.errors.slice(0, 3).join(' | ') + ')'));
  process.exit(summary('salesreport') ? 1 : 0);
})().catch((e) => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });

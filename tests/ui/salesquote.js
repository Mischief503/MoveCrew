// Sales, batch 5 (Nov 17): the call script (a checklist at the top of a new quote; Setup › Call script; the job keeps
// what was asked), crew options side by side (the same move with 2, 3 and 4 movers; Use this), and how long a quote's
// price is good (Rate card › Quotes are good for: the quote keeps its last day; the Sales card shows it; Due now, the
// card's line and Today call before it runs out; the texts' {until}; the customer app shows it and won't book it after;
// saving the quote again starts the days over; the call center's rate card).
const { load, ok, sleep, summary } = require('./lib');
const ART = __dirname + '/../../build/tally-artifact.html';
const L = (m) => 'salesquote: ' + m;
// the words as read: each element's text apart from the next (jsdom's textContent runs them together)
const txt = (el) => { if (!el) return ''; const out = []; const walk = (n) => { if (n.nodeType === 3) out.push(n.nodeValue); else if (n.nodeType === 1) { out.push(' '); n.childNodes.forEach(walk); out.push(' '); } }; walk(el); return out.join('').replace(/\s+/g, ' ').replace(/ ([.,:;)]|’s)/g, '$1').replace(/\( /g, '(').trim(); };

(async () => {
  const A = await load(ART, {});
  const { w, $, $$, click, T } = A;
  const st = () => T.state(), S = () => st().settings;
  const fire = (el) => el.dispatchEvent(new w.Event('input', { bubbles: true }));
  const type = (el, v) => { if (typeof el === 'string') el = $(el); el.value = v; fire(el); };
  const tick = (el, on) => { el.checked = on; fire(el); };
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const day = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return iso(d); };
  const short = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };
  const toast = () => $('#toast').textContent;
  const go = async (tab, more) => { T.ui.jobId = null; T.ui.tab = tab; Object.assign(T.ui, more || {}); T.render(); await sleep(15); };

  /* ---------- the call script, on a new quote ---------- */
  await go('quote', { qstep: 1 });
  const scr = () => $('#view details.qscript');
  const boxes = () => $$('#view details.qscript input[data-ask]');
  ok(!!scr() && scr().open && boxes().length === 9 && txt(scr().querySelector('summary')) === 'Call script 0 of 9 asked', L('a new quote starts with MoveCrew’s call script, open: 9 questions, none asked yet'));
  ok(/^Thank them for calling, and get their name/.test(txt(scr().querySelector('.acc-body'))) && /Ask for the booking: the deposit holds their day$/.test(txt(scr().querySelector('.acc-body'))), L('from thanking them for calling to asking for the booking'));
  ok(scr().nextElementSibling && /^Customer/.test(txt(scr().nextElementSibling)), L('at the top, above the customer'));
  tick(boxes()[0], true); tick(boxes()[1], true); tick(boxes()[8], true); await sleep(5);
  ok(txt($('#qAsked')) === '3 of 9 asked' && st().draft.asked.length === 3 && st().draft.asked[2] === 'Ask for the booking: the deposit holds their day', L('ticked as they go: 3 of 9 asked, kept with the quote being made'));
  tick(boxes()[1], false); await sleep(5);
  ok(txt($('#qAsked')) === '2 of 9 asked' && st().draft.asked.indexOf('The move date, and how sure they are of it') < 0, L('and one unticked: 2 of 9'));
  await go('quote', { qstep: 1 });
  ok(boxes()[0].checked && !boxes()[1].checked && boxes()[8].checked, L('still ticked when the quote comes back'));
  scr().open = false; scr().dispatchEvent(new w.Event('toggle')); await go('quote', { qstep: 1 });
  ok(!scr().open && txt(scr().querySelector('summary')) === 'Call script 2 of 9 asked', L('closed, it stays closed, and says how many were asked'));
  scr().open = true; scr().dispatchEvent(new w.Event('toggle'));

  /* ---------- crew options, side by side ---------- */
  const d = st().draft;
  Object.assign(d, { name: 'Nina Patel', phone: '(512) 555-0131', email: 'nina@example.com', moveDate: day(12), time: '09:00', from: '5 Elm St, Austin', to: '9 Oak Ave, Austin', miles: '6' });
  const it = S().catalog.filter((i) => i.cf >= 30 && i.cf <= 70)[0];
  d.items = {}; d.items[it.id] = Math.ceil(600 / it.cf);
  await go('quote', { qstep: 3 });
  const exp = [2, 3, 4].map((n) => { const q = T.calc(Object.assign({}, st().draft, { crew: String(n) }), S()); return n + ' movers about ' + (Math.round(q.hours * 100) / 100) + ' h ' + T.money(q.total); });
  const tiles = () => $$('#qCrew .qco').map(txt);
  ok(txt($('#qCrew .qcrew-h')) === 'Crew options' && tiles().join(' | ') === exp[0] + ' Use this | ' + exp[1] + ' On the quote | ' + exp[2] + ' Use this', L('under the price: the same move with 2, 3 and 4 movers, the quote’s own marked: ' + tiles().join(' | ')));
  ok(!!$('#qCrew .qco.on') && txt($('#qCrew .qco.on')).indexOf('3 movers') === 0, L('the crew on the quote (3, by the inventory) stands out'));
  const t2 = T.calc(Object.assign({}, st().draft, { crew: '2' }), S());
  click('#qCrew [data-act="q:crew"][data-n="2"]'); await sleep(15);
  ok(st().draft.crew === '2' && $('[data-d="crew"]').value === '2' && txt($('#qCrew .qco.on')).indexOf('2 movers') === 0 && toast() === '2 movers on the quote: ' + T.money(t2.total) + '.' && $('#qTot').textContent === T.money(t2.total), L('Use this: the quote is for 2 movers now, the total too (' + toast() + ')'));
  type('[data-d="hoursOverride"]', '5'); await sleep(10);
  ok(!$('#qCrew .qco'), L('hours set by hand: nothing to compare, so no options'));
  type('[data-d="hoursOverride"]', ''); await sleep(10);
  ok($$('#qCrew .qco').length === 3, L('and back without them'));
  const r4 = S().rates.r4; S().rates.r4 = 0; T.render(); await sleep(10);
  ok($$('#qCrew .qco').length === 2, L('a crew size with no rate isn’t offered'));
  S().rates.r4 = r4;

  /* ---------- saved: how long the price is good ---------- */
  T.render(); await sleep(10);
  click('#qSave'); await sleep(20);
  const N = st().jobs.find((j) => j.d.name === 'Nina Patel');
  ok(N && N.status === 'quoted' && N.quote.until === day(30) && N.quote.crew === 2, L('saved: the price is good for the rate card’s 30 days, to ' + (N && N.quote.until)));
  ok(N.d.asked.join(' | ') === 'Thank them for calling, and get their name | Ask for the booking: the deposit holds their day', L('and the job keeps what was asked on the call'));
  const sh = txt($('#sheet'));
  ok(sh.indexOf('The price is good until ' + short(day(30)) + '.') > 0, L('the job sheet says how long the price is good'));
  ok(/Call script: 2 of 9 asked\. Not asked: The move date, and how sure they are of it; Where from and where to: .*; How they heard about us\./.test(sh), L('and what wasn’t asked on the call: ' + (sh.match(/Call script:[^]*?us\./) || [''])[0].slice(0, 120)));
  ok(st().draft.asked.length === 0 && !st().draft.name, L('the next quote starts with nothing ticked'));

  /* ---------- Sales: the card, Due now, Today ---------- */
  await go('quotes', { slf: 'open' });
  const card = () => $('#ccList .scard[data-job="' + N.id + '"]');
  const line = () => txt(card().querySelector('.snext'));
  const price = () => txt(card().querySelector('.sprice'));
  const due = () => +((txt($$('#view .sfil .chip').find((c) => /^Due now/.test(txt(c)))) || '').match(/\d+$/) || [0])[0];
  ok(price() === T.money(N.quote.total) + ' good until ' + short(day(30)), L('the Sales card: the price, good until ' + short(day(30))));
  const due0 = due();
  // two days left, and the last call was before those two days
  N.quote.until = day(1); N.sales = Object.assign({}, N.sales, { last: { k: 'quote', at: Date.now() - 3 * 864e5, by: 'Owner' } }); await go('quotes', { slf: 'open' });
  ok(T.salesRunsOut(N) === 'tomorrow' && line() === 'The price runs out tomorrow · call them' && !!card().querySelector('.snext .pill.warn'), L('its price runs out tomorrow: the card says to call them'));
  ok(price() === T.money(N.quote.total) + ' Good until tomorrow' && !!card().querySelector('.sprice .pill.warn'), L('and the price says good until tomorrow'));
  ok(due() === due0 + 1, L('it’s in Due now (' + due0 + ' → ' + due() + ')'));
  click('[data-act="sl:f"][data-f="due"]'); await sleep(15);
  ok(!!card(), L('on the Due now list'));
  N.sales.next = { at: Date.now() + 864e5, by: 'Owner' }; await go('quotes', { slf: 'open' });
  ok(/^The price runs out tomorrow · call them \(a call-back is set for tomorrow /.test(line()), L('a call-back set for later: still call before the price runs out: ' + line()));
  N.sales.next = { at: Date.now() - 2 * 36e5, by: 'Owner' }; await go('quotes', { slf: 'open' });
  ok(/^Overdue: the call-back was/.test(line()), L('an overdue call-back comes first'));
  N.sales.next = null;
  await go('today');
  const more = $('[data-act="today:alerts"]'); if (more && more.getAttribute('aria-expanded') === 'false') { click(more); await sleep(10); }
  const row = $$('#view .alert').map(txt).find((a) => /price runs out soon/.test(a)) || '';
  ok(row === '! 1 quote’s price runs out soon Nina Patel · call them before it does · Sales ›', L('Today: ' + row));
  click($$('#view .alert').find((a) => /price runs out soon/.test(a.textContent))); await sleep(15);
  ok(T.ui.tab === 'quotes' && T.ui.slf === 'due', L('tapping it opens Sales, on Due now'));
  // a call: no longer due
  click('#ccList [data-act="sl:p"][data-m="log"][data-id="' + N.id + '"]'); await sleep(10);
  click('#ccList [data-act="sl:log"][data-k="talked"][data-id="' + N.id + '"]'); await sleep(15);
  ok(T.salesRunsOut(N) === '' && !/price runs out/.test(line()), L('once they’ve talked, it isn’t due: ' + line()));
  await go('quotes', { slf: 'open' });
  ok(due() === due0 && /Good until tomorrow/.test(price()), L('off Due now (the price still says good until tomorrow)'));
  N.sales.last.at = Date.now() - 3 * 864e5;
  N.quote.until = day(0); ok(T.salesRunsOut(N) === 'today', L('its last day: runs out today'));
  N.quote.until = day(2); ok(T.salesRunsOut(N) === 'in 2 days', L('two days left: in 2 days'));
  N.quote.until = day(3); ok(T.salesRunsOut(N) === '', L('three days left: not yet'));

  /* ---------- the texts: {until} ---------- */
  N.quote.until = day(20);
  const qt = T.salesBodyC(N, 'quote'), f3 = T.salesBodyC(N, 'f3');
  ok(qt.indexOf('hours). The price is good until ' + short(day(20)) + '. See it and book online:') > 0, L('the quote text says how long the price is good: ' + qt));
  ok(f3.indexOf('moving quote. The price is good until ' + short(day(20)) + '. If plans changed') > 0, L('and the last follow-up'));

  /* ---------- the price ran out ---------- */
  N.quote.until = day(-1); await go('quotes', { slf: 'open' });
  ok(price() === T.money(N.quote.total) + ' The price ran out ' + short(day(-1)) && !!card().querySelector('.sprice .pill.bad') && T.salesRunsOut(N) === '' && due() === due0, L('a price that ran out: the card says so, and it isn’t due'));
  ok(T.salesBodyC(N, 'quote').indexOf('good until') < 0, L('the texts don’t say it’s good'));
  const m = T.custMoveOf(N, S()), cc = T.custCardHtml(m), cn = T.custNextHtml(m);
  ok(m.quote.until === day(-1) && /This price ran out/.test(cc) && /class="cm-until out"/.test(cc), L('the customer app: this price ran out'));
  ok(/This price was good until .+\. Call or text us for a new one\./.test(cn) && !/data-act="cs:book"/.test(cn), L('and no Book button: call or text for a new one'));
  ok(T.custBookWhy(N) === 'This price was good until ' + short(day(-1)) + '. Call or text us for a new one.', L('booking it there is refused: ' + T.custBookWhy(N)));
  N.quote.until = day(9);
  const m2 = T.custMoveOf(N, S());
  ok(/This price is good until /.test(T.custCardHtml(m2)) && /data-act="cs:book"/.test(T.custNextHtml(m2)) && !/This price/.test(T.custBookWhy(N)), L('still good: the customer app says until when, and they can book it'));
  N.quote.until = day(1);
  ok(/class="cm-until soon">This price is good until tomorrow</.test(T.custCardHtml(T.custMoveOf(N, S()))), L('and says so plainly when it’s nearly out'));
  // saving the quote again starts the days over
  N.quote.until = day(-1); await go('quotes', { slf: 'open' });
  click('#ccList [data-act="cc:open"][data-id="' + N.id + '"]'); await sleep(15);
  ok(T.ui.tab === 'quote' && st().draft.editId === N.id && boxes().length === 9 && boxes()[0].checked, L('Open quote: back in the quote builder, with the call script as it was ticked'));
  T.ui.qstep = 3; T.render(); await sleep(10);
  click('#qSave'); await sleep(20);
  ok(N.quote.until === day(30) && N.status === 'quoted', L('saved again: good for 30 days from today'));

  /* ---------- Rate card › Quotes are good for ---------- */
  await go('settings', { setSec: 'rates' });
  const qd = $('[data-s="quoteDays"]');
  ok(qd && qd.value === '30' && /Quotes are good for \(days\)/.test(txt(qd.closest('label'))) && /A quote’s price is good for the days set, from the day it’s saved \(0: no end\)/.test(txt($('#view'))), L('the rate card: quotes are good for 30 days, and what that does'));
  type(qd, '14'); await sleep(5);
  ok(S().quoteDays === 14 && /Quotes are good for<\/td><td>14 days/.test(T.rateCardHtml(S())), L('14 days: on the call center’s rate card too'));
  await go('quotes', { slf: 'open' }); click('#ccList [data-act="cc:open"][data-id="' + N.id + '"]'); await sleep(15);
  T.ui.qstep = 3; T.render(); await sleep(10); click('#qSave'); await sleep(20);
  ok(N.quote.until === day(14), L('saved: good for 14 days'));
  await go('settings', { setSec: 'rates' }); type('[data-s="quoteDays"]', '0'); await sleep(5);
  ok(!/Quotes are good for/.test(T.rateCardHtml(S())), L('0: no end, and the rate card doesn’t say'));
  await go('quotes', { slf: 'open' }); click('#ccList [data-act="cc:open"][data-id="' + N.id + '"]'); await sleep(15);
  T.ui.qstep = 3; T.render(); await sleep(10); click('#qSave'); await sleep(20);
  ok(!N.quote.until && T.salesRunsOut(N) === '', L('saved: no last day on the quote'));
  await go('quotes', { slf: 'open' });
  ok(price() === T.money(N.quote.total), L('and the card shows just the price'));
  S().quoteDays = 30;

  /* ---------- Setup › Call script ---------- */
  await go('settings', { setSec: 'callscript' });
  const box = () => $('#callScriptBox');
  ok(box() && box().value.split('\n').length === 9 && /These are MoveCrew’s\. Change them to fit how you sell\./.test(txt($('#view'))) && !$('[data-act="st:script0"]'), L('Setup › Call script: MoveCrew’s nine lines, to change'));
  type(box(), 'Get their name\n\n  Ask about stairs  \nAsk for the booking'); await sleep(5);
  ok(JSON.stringify(S().callScript) === JSON.stringify(['Get their name', 'Ask about stairs', 'Ask for the booking']), L('their own, a line each (blank lines and spaces dropped): ' + JSON.stringify(S().callScript)));
  await go('settings', { setSec: 'callscript' });
  ok(!!$('[data-act="st:script0"]') && box().value === 'Get their name\nAsk about stairs\nAsk for the booking', L('theirs, with Start over with MoveCrew’s'));
  await go('quote', { qstep: 1 });
  ok(boxes().length === 3 && txt(scr().querySelector('summary')) === 'Call script 0 of 3 asked', L('a new quote has their 3 questions'));
  await go('settings', { setSec: '' });
  ok(/Call script 3 questions on new quotes/.test(txt($('#view'))), L('the Setup list says so'));
  await go('settings', { setSec: 'callscript' }); type(box(), ''); await sleep(5);
  ok(Array.isArray(S().callScript) && S().callScript.length === 0, L('emptied: no script'));
  await go('quote', { qstep: 1 });
  ok(!scr() && /^Customer/.test(txt($('#view section.card:not(.hero)'))), L('and a new quote has no checklist'));
  await go('settings', { setSec: '' });
  ok(/Call script Off: no checklist on quotes/.test(txt($('#view'))), L('Setup says it’s off'));
  await go('settings', { setSec: 'callscript' }); click('[data-act="st:script0"]'); await sleep(10);
  ok(S().callScript.length === 9 && box().value.split('\n').length === 9 && /call script is back/.test(toast()), L('Start over with MoveCrew’s: the nine are back'));
  // dispatch makes quotes with it, and doesn't change it
  st().ui.role = 'dispatch'; await go('settings', { setSec: '' });
  ok(!$('#callScriptBox') && !/Call script/.test(txt($('#view'))), L('dispatch doesn’t see Setup › Call script'));
  await go('quote', { qstep: 1 });
  ok(boxes().length === 9, L('and has the checklist on a new quote'));
  st().ui.role = 'owner';
  ok(A.errors.length === 0, L('no errors (' + A.errors.slice(0, 3).join(' | ') + ')'));
  process.exit(summary('salesquote') ? 1 : 0);
})().catch((e) => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });

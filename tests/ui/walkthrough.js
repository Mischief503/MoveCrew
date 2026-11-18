// Sales, batch 6 (Nov 17; Richie: "Video or voice call walk through", taken by "The person who quoted and booked the
// job . Once a call center person is on a job , that person stays on that job"): a walk-through set from a lead in Sales
// (video or voice, a day and time, who takes it), the text to the customer with the time (from your phone here; from
// the company line in the hosted app), the card's line, Walk-throughs (the calendar of what's coming), due and overdue,
// Today's row, done by a call logged or It's done, cancelled, and the customer app's line.
const { load, ok, sleep, summary } = require('./lib');
const ART = __dirname + '/../../build/tally-artifact.html', HOSTED = __dirname + '/../../build/tally-supabase.html';
const L = (m) => 'walkthrough: ' + m;
// the words as read: each element's text apart from the next (jsdom's textContent runs them together)
const txt = (el) => { if (!el) return ''; const out = []; const walk = (n) => { if (n.nodeType === 3) out.push(n.nodeValue); else if (n.nodeType === 1) { out.push(' '); n.childNodes.forEach(walk); out.push(' '); } }; walk(el); return out.join('').replace(/\s+/g, ' ').replace(/ ([.,:;)]|’s)/g, '$1').replace(/\( /g, '(').trim(); };
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const local = (d) => iso(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
const dayAt = (days, h, m) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m || 0, 0, 0); return d; };
const clock = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

(async () => {
  const A = await load(ART, {});
  const { w, $, $$, click, T } = A;
  const st = () => T.state();
  const S0 = st().jobs.find((j) => j.d.name === 'Sam Kowalski'), id = S0.id;
  const go = async (more) => { T.ui.jobId = null; T.ui.tab = 'quotes'; Object.assign(T.ui, { slf: 'open', sp: null }, more || {}); T.render(); await sleep(15); };
  const card = () => $('#ccList .scard[data-job="' + id + '"]');
  const line = () => txt(card() && card().querySelector('.snext'));
  const panel = () => card() && card().querySelector('.spanel');
  const chip = (f) => txt($$('#view .sfil .chip').find((c) => c.dataset.f === f));
  const toast = () => $('#toast').textContent;
  const evs = () => S0.log.map((l) => l.ev);
  const setVal = (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); };

  await go();
  ok(chip('survey') === 'Walk-throughs 0' && !S0.survey, L('Sales has Walk-throughs, none yet'));
  ok(!!card().querySelector('[data-act="sl:p"][data-m="sv"]') && txt(card().querySelector('[data-act="sl:p"][data-m="sv"]')) === 'Walk-through', L('each open lead has Walk-through'));
  click(card().querySelector('[data-act="sl:p"][data-m="sv"]')); await sleep(15);
  const tm = dayAt(1, 10);
  ok(/^A walk-through with Sam Kowalski A video or voice call where they show you what’s moving, so the quote is right\./.test(txt(panel())), L('the panel: what a walk-through is'));
  ok(txt($('#ccList [data-act="sl:svk"][data-k="video"]')) === 'Video call' && $('#ccList [data-act="sl:svk"][data-k="video"]').getAttribute('aria-pressed') === 'true' && $('#ccList [data-act="sl:svk"][data-k="voice"]').getAttribute('aria-pressed') === 'false', L('video call to start, or voice'));
  ok($('#svAt_' + id).value === local(tm), L('tomorrow 10:00 AM to start: ' + $('#svAt_' + id).value));
  ok(!!$('#svWho_' + id) && !$$('#svWho_' + id + ' option').some((o) => o.value === '') && /Text Sam the time \(from your phone\)/.test(txt(panel())) && $('#svTx_' + id).checked, L('who takes it (the office picks), and Text Sam the time, ticked'));
  click('#ccList [data-act="sl:svk"][data-k="voice"]'); await sleep(10);
  ok($('#ccList [data-act="sl:svk"][data-k="voice"]').getAttribute('aria-pressed') === 'true', L('Voice call picked'));
  const at2 = dayAt(1, 14);
  // someone else from the office takes it (the list: the office and the call center people)
  const WHO = $$('#svWho_' + id + ' option').map((o) => o.value).find((v) => v && v !== $('#svWho_' + id).value);
  setVal($('#svAt_' + id), local(at2)); setVal($('#svWho_' + id), WHO);
  click('#ccList [data-act="sl:sv"][data-id="' + id + '"]'); await sleep(15);
  ok(S0.survey && S0.survey.kind === 'voice' && S0.survey.who === WHO && S0.survey.at === at2.getTime() && !S0.survey.done, L('set: a voice call with ' + WHO + ', tomorrow at 2:00 PM'));
  ok(S0.sales && S0.sales.owner === WHO, L(WHO + ' works the lead now (nobody did)'));
  ok(evs().some((e) => e.indexOf('Walk-through set for tomorrow 2:00 PM (voice call, with ' + WHO + '), by ') === 0), L('the activity says so: ' + evs().filter((e) => /Walk-through/.test(e)).join(' | ')));
  ok(toast() === 'Walk-through set: Voice walk-through tomorrow 2:00 PM with ' + WHO + '. Text them the time from your phone below.', L('the message: ' + toast()));
  const sms = $('#ccList [data-act="sl:svsms"][data-id="' + id + '"]');
  const day2 = at2.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const body = sms && decodeURIComponent(sms.getAttribute('href').split('body=')[1]);
  ok(!!sms && txt(sms) === 'Text Sam the time from my phone' && body === 'Your Moving Co.: Hi Sam, your walk-through call is set for ' + day2 + ' at 2:00 PM. ' + WHO.split(' ')[0] + ' will call you at ' + T.state().jobs.find((j) => j.id === id).d.phone.replace(/\D/g, '').replace(/^(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3') + ' then to go over what’s moving. Reply here to change the time.',
    L('Text Sam the time from my phone: ' + body));
  click(sms); await sleep(15);
  ok(S0.survey.texted > 0 && evs().some((e) => /^Walk-through time texted by /.test(e)) && !$('#ccList [data-act="sl:svsms"]'), L('tapped: texted, in the activity'));
  await go();
  ok(line() === 'Voice walk-through tomorrow 2:00 PM with ' + WHO, L('the card’s line: ' + line()));
  ok(chip('survey') === 'Walk-throughs 1', L('Walk-throughs 1'));
  click('[data-act="sl:f"][data-f="survey"]'); await sleep(15);
  ok(txt($('#ccList .secline h2')) === 'Walk-throughs: what’s coming up' && txt($('#ccList .sday')) === 'Tomorrow' && $('#ccList .sday').nextElementSibling === card(), L('Walk-throughs: under Tomorrow'));
  // the customer app
  const m = T.custMoveOf(S0, st().settings), ch = T.custCardHtml(m);
  ok(/Your price isn’t set yet: Your Moving Co\. will send it soon\./.test(ch) && !/data-act="cs:book"/.test(T.custNextHtml(m)) && /Your price comes first\. We’ll send it soon\./.test(T.custNextHtml(m)) && T.custBookWhy(S0) === 'Your price isn’t set yet. Call or text us for it.',
    L('no price yet: their app says it comes first, and there’s nothing to book'));
  ok(m.survey && m.survey.kind === 'voice' && m.survey.who === WHO.split(' ')[0] && ch.indexOf('<b>Your walk-through call:</b> ' + at2.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + ' at 2:00 PM. ' + WHO.split(' ')[0] + ' will call you then.') > 0, L('their app shows it'));
  // its time comes
  const soon = new Date(Date.now() + 5 * 6e4); S0.survey.at = soon.getTime(); await go();
  ok(line() === 'Voice walk-through now with ' + WHO + ' · call them' && !!card().querySelector('.snext .pill.warn'), L('ten minutes before: “' + line() + '”'));
  ok(/^Due now \d+$/.test(chip('due')) && T.salesLine(S0).cls === 'warn', L('and it’s due'));
  T.ui.tab = 'today'; T.render(); await sleep(15);
  const more = $('[data-act="today:alerts"]'); if (more && more.getAttribute('aria-expanded') === 'false') { click(more); await sleep(10); }
  const row = $$('#view .alert').map(txt).find((a) => /walk-through/.test(a)) || '';
  ok(row === '! 1 walk-through today Sam Kowalski ' + clock(soon) + ' · Sales ›' || (iso(soon) !== iso(new Date()) && row === ''), L('Today: ' + row));
  if (row) { click($$('#view .alert').find((a) => /walk-through/.test(a.textContent))); await sleep(15); ok(T.ui.tab === 'quotes' && T.ui.slf === 'survey', L('it opens Walk-throughs')); }
  S0.survey.at = Date.now() - 2 * 36e5; await go();
  ok(/^The walk-through was (today|yesterday) \d{1,2}:\d\d [AP]M: log how it went$/.test(line()) && !!card().querySelector('.snext .pill.bad'), L('past it: “' + line() + '”'));
  // a call logged after it: done
  click(card().querySelector('[data-act="sl:p"][data-m="log"]')); await sleep(10);
  click('#ccList [data-act="sl:log"][data-k="talked"][data-id="' + id + '"]'); await sleep(15);
  ok(S0.survey.done > 0 && evs().some((e) => /^Walk-through done \(/.test(e)) && !/walk-through/i.test(line()), L('Talked after its time: done'));
  await go();
  ok(chip('survey') === 'Walk-throughs 0', L('Walk-throughs 0 again'));
  click('[data-act="sl:f"][data-f="survey"]'); await sleep(15);
  ok(/No walk-throughs set Set one from a lead: Walk-through, then the day and time\./.test(txt($('#ccList'))), L('none: says how to set one'));
  ok(!T.custMoveOf(S0, st().settings).survey, L('their app no longer shows it'));
  // set again (they work it, so it's theirs), then It's done, then one cancelled
  await go(); click(card().querySelector('[data-act="sl:p"][data-m="sv"]')); await sleep(10);
  ok($('#svWho_' + id).value === WHO && $('#ccList [data-act="sl:svk"][data-k="video"]').getAttribute('aria-pressed') === 'true', L('the next one: ' + WHO + ' takes it, as they work the lead'));
  $('#svTx_' + id).checked = false;
  click('#ccList [data-act="sl:sv"][data-id="' + id + '"]'); await sleep(15);
  ok(S0.survey && S0.survey.kind === 'video' && S0.survey.who === WHO && !S0.survey.done && !$('#ccList [data-act="sl:svsms"]') && toast() === 'Walk-through set: Video walk-through tomorrow 10:00 AM with ' + WHO + '.', L('no text this time: ' + toast()));
  ok(txt(panel().querySelector('.hint')) === 'Video walk-through tomorrow 10:00 AM with ' + WHO && !!panel().querySelector('[data-act="sl:svdone"]') && !!panel().querySelector('[data-act="sl:svoff"]'), L('the panel has It’s done and Cancel it'));
  click('#ccList [data-act="sl:svdone"][data-id="' + id + '"]'); await sleep(15);
  ok(S0.survey.done > 0 && toast() === 'Walk-through done. Price it now: Open quote.', L('It’s done'));
  await go(); click(card().querySelector('[data-act="sl:p"][data-m="sv"]')); await sleep(10);
  click('#ccList [data-act="sl:sv"][data-id="' + id + '"]'); await sleep(15);
  click('#ccList [data-act="sl:svoff"][data-id="' + id + '"]'); await sleep(15);
  ok(S0.survey === null && evs().some((e) => /^Walk-through cancelled by /.test(e)) && toast() === 'Walk-through cancelled.', L('Cancel it'));
  // a time that passed isn't taken
  click(card().querySelector('[data-act="sl:p"][data-m="sv"]')); await sleep(10);
  setVal($('#svAt_' + id), local(dayAt(-1, 9)));
  click('#ccList [data-act="sl:sv"][data-id="' + id + '"]'); await sleep(10);
  ok(S0.survey === null && toast() === 'That time has passed. Pick a time ahead.', L('a time gone by: ' + toast()));
  ok(A.errors.length === 0, L('no errors (' + A.errors.slice(0, 3).join(' | ') + ')'));

  /* ---------- hosted, with the company line: the time goes by text ---------- */
  const ORG = 'org-1';
  const drow = (path, data) => { const [collection, doc_id] = path.split('/'); return { org_id: ORG, path, collection, doc_id, data, updated_at: new Date().toISOString() }; };
  const db = { docs: [drow('meta/init', { ts: 1 }),
    drow('org/settings', { company: 'Ace Moving', crew: ['Marcus'], leads: ['Marcus'], office: [{ name: 'Owner', kind: 'owner' }, { name: 'Dispatch', kind: 'dispatch' }], contacts: {}, trucks: [{ id: 't26', name: 'Box 1 (26 ft)', cf: 1700 }], forms: [] }),
    drow('jobs/q1', { id: 'q1', status: 'lead', createdAt: Date.now() - 864e5, d: { name: 'Lena Wu', phone: '512-555-0150', email: '', moveDate: '', time: '', from: 'Austin', to: 'Waco', items: [], custom: {} },
      quote: { total: 0, cf: 0, lines: [] }, items: [], assign: { truckId: '', crew: [] }, tally: {}, payments: {}, signed: {}, extras: {}, crewNotes: {}, photos: {}, materials: {}, costs: {}, log: {}, confirm: {},
      sales: { owner: 'Dispatch', n: 1, first: Date.now() - 864e5, last: { k: 'talked', at: Date.now() - 864e5, by: 'Dispatch' } } })],
    access_requests: [], comm_lines: [{ org_id: ORG, phone_number: '+15125550000', enabled: true }], comm_log: [],
    members: [{ org_id: ORG, user_id: 'u-dispatch', email: 'd@x', staff: 'Dispatch', role: 'dispatch', ts: 1 }] };
  const fnCalls = [];
  const D = await load(HOSTED, { db, org: ORG, me: { uid: 'u-dispatch', email: 'd@x' }, fnReply: (b) => { fnCalls.push(b); return b.action === 'sales_text' ? { ok: true, message: 'Texted Lena Wu.' } : { ok: true, sent: 0 }; } });
  await sleep(300);
  D.click('#tabs [data-act="tab"][data-tab="quotes"]'); await sleep(20);
  D.click('#ccList [data-act="sl:p"][data-m="sv"][data-id="q1"]'); await sleep(20);
  ok(/Text Lena the time$/.test(txt(D.$('#ccList .spanel label.check'))) && D.$('#svWho_q1').value === 'Dispatch', L('hosted: Dispatch takes it (she works the lead), and the text goes from the line'));
  D.click('#ccList [data-act="sl:sv"][data-id="q1"]'); await sleep(400);
  const st1 = fnCalls.find((b) => b.action === 'sales_text');
  const tm1 = dayAt(1, 10), dd1 = tm1.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  ok(st1 && st1.jobId === 'q1' && st1.body === 'Hi Lena, your video walk-through is set for ' + dd1 + ' at 10:00 AM. Dispatch will video call you at (512) 555-0150 then, so have your phone ready to show us what’s moving. Reply here to change the time.',
    L('hosted: the time goes from the company line: ' + (st1 && st1.body)));
  const qd = () => (db.docs.find((r) => r.path === 'jobs/q1') || {}).data || {};
  ok(qd().survey && qd().survey.kind === 'video' && qd().survey.who === 'Dispatch' && qd().survey.texted > 0 && D.$('#toast').textContent === 'Walk-through set, and Lena has the time by text.', L('hosted: saved, texted: ' + D.$('#toast').textContent));
  ok(D.errors.length === 0, L('hosted: no errors (' + D.errors.slice(0, 3).join(' | ') + ')'));
  process.exit(summary('walkthrough') ? 1 : 0);
})().catch((e) => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });

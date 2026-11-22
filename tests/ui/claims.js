// Damage claims and truck reminders (batch 11, Nov 22). From Richie's list of what MoveCrew is missing (Nov 21): damage
// claims, and truck and driver reminders (the drivers' license and medical card reminders were there already). Run
// against either edition: node tests/ui/claims.js <file> <label>
const { load, ok, sleep, summary, clone } = require('./lib');
const file = process.argv[2] || __dirname + '/../../build/tally-artifact.html', label = process.argv[3] || 'claims';
const L = (m) => label + ': ' + m;

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

  /* ---------------- a claim on the job sheet ---------------- */
  const J = st().jobs.find((j) => j.status === 'done' && (j.items || []).length) || st().jobs.find((j) => j.status === 'done');
  ok(!!J && !T.claimsOf(J).length, L('a finished job with no claims: ' + (J && J.d.name)));
  const item = J.items[0];
  T.openJob(J.id); await sleep(10);
  ok(/Damage claims/.test(sheet()) && /No claims\. The customer can report damage in their app for 30 days after the move\./.test(sheet()), L('its sheet has Damage claims, with how the customer reports one'));
  $('#clItem').value = item.name; $('#clWhat').value = 'Leg cracked when unloading.'; $('#clAmt').value = '25000'; $('#clFrom').value = 'customer';
  click('#sheet [data-act="cl:add"]'); await sleep(10);
  let c = T.claimsOf(J)[0];
  ok(c && c.item === item.name && c.amt === 250 && c.from === 'customer' && c.status === 'open' && /Damage claim from the customer: /.test(J.log[J.log.length - 1].ev) && /Claim added/.test(toast()), L('New damage claim: the item, what happened, $250 claimed, open'));
  const rv = T.releasedOf(J, item.name);
  ok(rv === Math.round(item.cf * 7 * 0.6 * 100) / 100 && sheet().indexOf('released value about ' + T.money(rv) + ' ($0.60 a pound)') >= 0, L('its released value from the item’s size: about ' + T.money(rv) + ' ($0.60 a pound)'));
  click('#sheet [data-act="sheet:close"]'); await sleep(5);
  T.ui.allAlerts = true; await go('today'); await sleep(10);
  ok(new RegExp('Damage claim: ' + J.d.name).test(view()) && /\$250 claimed/.test(view()), L('Today shows the open claim'));
  await go('reports'); await sleep(10);
  ok(/Damage claims/.test(view()) && /Open now: 1 · \$250 claimed/.test(view()), L('Reports › Damage claims: open now'));
  T.openJob(J.id); await sleep(10);
  click('#sheet [data-act="cl:st"][data-v="paid"]'); await sleep(10);
  c = T.claimsOf(J)[0];
  ok(c.status === 'paid' && c.paid === 250 && c.closedAt > 0 && $('#sheet [data-clpaid]'), L('Paid: closed, at the amount claimed to start, with Paid to them'));
  type('#sheet [data-clpaid]', '20000'); await sleep(10);
  c = T.claimsOf(J)[0];
  ok(c.paid === 200 && /Claim for .*: Paid \$200/.test(J.log[J.log.length - 1].ev), L('paid $200 instead'));
  click('#sheet [data-act="sheet:close"]'); await sleep(5);
  await go('reports'); await sleep(10);
  ok(/No open claims\. Closed in these dates: 1, \$200 paid/.test(view()), L('Reports: none open, one closed, $200 paid'));
  // kept in the database as a map, like the payments
  const doc = T.jobDoc(J);
  ok(doc.claims && doc.claims[c.id] && doc.claims[c.id].paid === 200 && T.docToJob2(doc).claims.length === 1 && T.docToJob2(doc).claims[0].id === c.id, L('saved as a map, and read back'));
  ok(!('claims' in T.jobDoc(st().jobs.find((j) => !T.claimsOf(j).length))), L('a job with no claims saves none'));

  /* ---------------- the crew lead ---------------- */
  const R = st().jobs.find((j) => j.status === 'booked' && j.d.moveDate === today) || st().jobs.find((j) => j.status === 'booked');
  R.status = 'active'; R.startedAt = Date.now() - 3600e3; R.d.moveDate = today; R.assign.crew = ['Marcus', 'Dee'];
  st().ui.role = 'lead'; st().ui.me = 'Marcus'; T.ui.tab = 'crew'; T.render(); await sleep(10);
  ok(!!$('#view .crewcard[data-job="' + R.id + '"] .cc-claim'), L('the lead’s card has Report damage'));
  $('#ccl_i_' + R.id).value = 'Hallway wall'; $('#ccl_w_' + R.id).value = 'Scuffed with the dresser.';
  click('#view [data-act="cr:claim"][data-id="' + R.id + '"]'); await sleep(10);
  ok(T.claimsOf(R).length === 1 && T.claimsOf(R)[0].from === 'crew' && T.claimsOf(R)[0].by === 'Marcus' && /The office has it/.test(toast()), L('Tell the office: a claim from the crew, by Marcus'));
  st().ui.role = 'owner'; T.render(); await sleep(5);

  /* ---------------- the customer ---------------- */
  J.d.moveDate = addDays(today, -3);
  let m = T.custMoveOf(J, S());
  ok(m.claimsOn && m.claims.length === 1 && m.claims[0].status === 'paid' && m.claims[0].paid === 200 && !('by' in m.claims[0]) && T.custClaimOk(m), L('their copy: their claim (paid $200), and they can report more'));
  ok(/Report damage/.test(T.custClaimsHtml(m)) && /Paid \$200/.test(T.custClaimsHtml(m)), L('their app: the claim and Report damage'));
  const box = w.document.createElement('div');
  box.innerHTML = '<input id="csClItem"><textarea id="csClWhat"></textarea><input id="csClAmt"><p id="csClErr"></p>';
  w.document.body.appendChild(box);
  T.csClaimGo(m);
  ok($('#csClErr').textContent === 'Say what was damaged.', L('it asks what was damaged'));
  $('#csClItem').value = 'Mirror'; $('#csClWhat').value = 'Cracked in the corner.'; $('#csClAmt').value = '8000';
  T.csClaimGo(m); await sleep(10);
  const mine = T.claimsOf(J).filter((x) => x.from === 'customer' && x.item === 'Mirror')[0];
  ok(mine && mine.amt === 80 && mine.by === J.d.name, L('Send: a claim from the customer, $80'));
  box.remove();
  J.d.moveDate = addDays(today, -31);
  ok(!T.custClaimOk(T.custMoveOf(J, S())), L('31 days after the move they can’t report more'));

  /* ---------------- truck reminders ---------------- */
  const tr = S().trucks[0];
  tr.regDue = addDays(today, 10); tr.inspDue = addDays(today, -1); tr.insDue = addDays(today, 90);
  const al = T.truckDueAlerts().join(' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  ok(new RegExp(tr.name.replace(/[()]/g, '\\$&') + ': registration is due soon').test(al) && /inspection is past due/.test(al) && !/insurance/.test(al), L('Today: registration due in 10 days, inspection past due; insurance in 90 days isn’t yet'));
  await go('today'); await sleep(10);
  ok(/registration is due soon/.test(view()), L('on Today for the owner'));
  click($$('#view [data-act="go:fleet"]')[0]); await sleep(15);
  ok(T.ui.tab === 'settings' && T.ui.setSec === 'fleet' && $('[data-s="trucks.0.regDue"]') && $('[data-s="trucks.0.regDue"]').value === tr.regDue && /Past due: inspection, /.test(view()), L('tapping it opens Setup › Fleet: the truck’s dates, the one past due first'));

  /* ---------------- Options ---------------- */
  await go('settings', 'options'); await sleep(10);
  const sw = (k) => $('input[role="switch"][data-s="' + k + '"]');
  ok(sw('opt.claims') && sw('opt.claims').checked && sw('opt.truckDue') && sw('opt.truckDue').checked && sw('comms.alerts.claim') && sw('comms.alerts.claim').checked, L('Options: Damage claims, Truck reminders, and the text for a customer’s damage report, all on'));
  sw('opt.truckDue').checked = false; sw('opt.truckDue').dispatchEvent(new w.Event('input', { bubbles: true })); await sleep(5);
  ok(!T.truckDueAlerts().length, L('Truck reminders off: none on Today'));

  ok(!A.errors.length, L('no errors: ' + A.errors.join(' | ')));
  process.exit(summary(label) ? 1 : 0);
})();

// MoveCrew on an iPhone (Richie, Nov 8: "we will need it avaliable for iphones as well", the website on the Home
// Screen for now). The app as an iPhone shows it: Playwright's iPhone 15 (its screen, touch, Safari's name for
// itself). Here it runs in Chromium; GitHub's Tests run it again in WebKit, Safari's own engine (PW_ENGINE=webkit),
// which is what catches what only Safari does differently. The claude.ai copy (no back end): the office's day, a job,
// Collect payment with the tip, the customer's move, Book another move, Get the app; no errors, nothing wider than
// the screen.
const pw = require('playwright');
const path = require('path');
const ENGINE = process.env.PW_ENGINE || 'chromium';
const FILE = 'file://' + path.resolve(__dirname + '/../../build/tally-artifact.html');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };

(async () => {
  const { defaultBrowserType, ...phone } = pw.devices['iPhone 15'] || pw.devices['iPhone 13'];
  const browser = await pw[ENGINE].launch();
  const ctx = await browser.newContext(phone);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.addInitScript(() => { window.__TALLY_TEST = true; });
  await p.goto(FILE); await sleep(800);
  const L = (m) => ENGINE + ', ' + (phone.viewport.width) + ' wide: ' + m;
  const tap = async (sel, w) => { await p.tap(sel); await sleep(w || 200); };
  // nothing runs off the side: the page itself, and any open sheet or overlay, no wider than the screen
  const fits = () => p.evaluate(() => {
    const W = window.innerWidth, wide = [];
    if (document.documentElement.scrollWidth > W + 1) wide.push('page ' + document.documentElement.scrollWidth);
    document.querySelectorAll('#sheet .panel,#flow .flow-body,#cust .panel,#more .panel,#view').forEach((el) => {
      if (el.offsetParent !== null && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'auto') wide.push(el.id || el.className);
    });
    return wide;
  });

  /* ---------- the office's day ---------- */
  ok(/Good (morning|afternoon|evening)/.test(await p.textContent('#view')), L('Today opens'));
  let w = await fits(); ok(!w.length, L('Today fits the screen ' + w.join(', ')));

  /* ---------- Collect payment on a finished move: subtotal, the tip, the final total ---------- */
  const mid = await p.evaluate(() => {
    const T = window.__tally, j = T.state().jobs.find((x) => x.d.name === 'Marcus Tull');
    T.formsPending(j).forEach((f) => j.signed.push({ id: 'x' + f.id, formId: f.id, title: f.title, name: 'Marcus Tull', sig: '', ts: Date.now() }));
    T.save(); T.render(); return j.id;
  });
  await p.evaluate((id) => window.__tally.openJob(id), mid); await sleep(300);
  w = await fits(); ok(!w.length, L('a job’s sheet fits ' + w.join(', ')));
  await p.evaluate(() => { const b = document.querySelector('#sheet [data-act="flow:open"]'); b.click(); }); await sleep(400);
  ok(/Add a tip for the crew/.test(await p.textContent('#flow')) && (await p.$$('#flow [data-act="flow:tip"]')).length === 5, L('Collect payment asks for a tip: No tip, 10, 15, 20%, Other'));
  const sub = await p.inputValue('#flowAmt');
  await p.evaluate(() => { const c = [...document.querySelectorAll('#flow [data-act="flow:method"]')].find((b) => /New card/.test(b.textContent)); if (c) c.click(); }); await sleep(200);
  await p.fill('#cardNum', '4242424242424242'); await p.fill('#cardExp', '1230'); await p.fill('#cardCvc', '123');
  await tap('#flow [data-act="flow:tip"][data-t="15"]');
  const after = await p.evaluate(() => ({ card: document.querySelector('#cardNum').value, total: document.querySelector('#flowTotal').textContent, btn: document.querySelector('#flow [data-act="flow:pay"]').textContent, on: document.querySelector('#flow [data-act="flow:tip"][data-t="15"]').getAttribute('aria-pressed') }));
  ok(after.card === '4242-4242-4242-4242' && after.on === 'true' && /^\$[\d,]+\.\d\d$/.test(after.total) && after.btn === 'Charge ' + after.total, L('15% picked after typing the card: the card stays, the Final total and the button say ' + after.total + ' (subtotal ' + sub + ')'));
  w = await fits(); ok(!w.length, L('Collect payment fits ' + w.join(', ')));
  await tap('#flow [data-act="flow:pay"]', 500);
  ok(/Paid in full/.test(await p.textContent('#flow')) && /tip for the crew/.test(await p.textContent('#flow')), L('charged (the demo): Paid in full, the tip on the receipt'));
  await tap('#flow [data-act="flow:close"]', 300);
  await p.evaluate(() => { const c = document.querySelector('#sheet [data-act="sheet:close"]'); if (c) c.click(); }); await sleep(200);

  /* ---------- the customer: their move, who did it, Book another move, Get the app ---------- */
  const lena = await p.evaluate(() => window.__tally.custPeople().find((x) => x.name === 'Lena Wu').key);
  await tap('[data-act="more:open"]'); await tap('[data-act="more:preview"]');
  await tap(`#more [data-act="pv:set"][data-role="customer"][data-staff="${lena}"]`, 500);
  await p.evaluate(() => { const n = document.querySelector('#cust [data-act="cs:norev"]'); if (n) n.click(); }); await sleep(300);
  ok(/Your move was done by/.test(await p.textContent('#view')), L('the customer’s move: “Your move was done by”'));
  w = await fits(); ok(!w.length, L('the customer’s move fits ' + w.join(', ')));
  await p.evaluate(() => document.querySelector('#view [data-act="cs:again"]').scrollIntoView({ block: 'center' })); await sleep(150);
  await tap('#view [data-act="cs:again"]', 400);
  const d = (n) => { const x = new Date(Date.now() + n * 864e5); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  await p.fill('#csaTo', '2210 Lakeview Dr, Austin');
  await p.fill('#csaD1', d(14)); await p.fill('#csaD2', d(21));
  ok((await p.inputValue('#csaD1')) === d(14) && (await p.inputValue('#csaD2')) === d(21), L('the date boxes take the first and last day'));
  await p.evaluate(() => { document.querySelectorAll('#cust .rqrooms details')[0].open = true; }); await sleep(100);
  await tap('#cust [data-act="cs:itinc"][data-id="sofa3"]', 100);
  await p.fill('#csaPhone', '512-555-0144');
  w = await fits(); ok(!w.length, L('Book another move fits ' + w.join(', ')));
  await p.evaluate(() => document.querySelector('#cust [data-act="cs:againgo"]').scrollIntoView({ block: 'center' })); await sleep(150);
  await tap('#cust [data-act="cs:againgo"]', 500);
  ok(/Sent to/.test(await p.textContent('#cust')) || /Requested/.test(await p.textContent('#view')), L('sent to the company: ' + ((await p.textContent('#csErr').catch(() => '')) || 'no message')));
  await p.evaluate(() => { const c = document.querySelector('#cust .sheet-head [data-act="cs:close"]'); if (c) c.click(); }); await sleep(300);
  await p.evaluate(() => { const b = document.querySelector('#tabs [data-act="tab"][data-tab="myprofile"]'); if (b) b.click(); }); await sleep(300);
  const get = await p.evaluate(() => { const c = [...document.querySelectorAll('#view .card')].find((x) => /Get the app/.test(x.textContent)); return c ? c.textContent.replace(/\s+/g, ' ') : ''; });
  ok(/Add to Home Screen/.test(get) && /On iOS 26, tap ⋯/.test(get), L('Profile › Get the app: the iPhone’s steps'));
  await tap('[data-act="pv:end"]', 300);

  ok(errs.length === 0, L('no errors (' + errs.slice(0, 3).join(' | ') + ')'));
  await browser.close();
  console.log(`\niphone (${ENGINE}): ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });

// Recruit banners e2e (docs/specs/BANNERS.md §I.4): a fake clock on a banner day, the rail of today's banners
// (LR, Student, Guardian, Standard), the countdown and look-ahead, the rates page, the Legend Promise bar, a 10×
// on the LR Banner, the Standard pick, and the 7 PM Central rollover while the screen is open (the banners
// redraw; a pull carrying yesterday's banner is refused before payment).
//
//   node e2e/recruit-banners.mjs                                   # 844x390 (touch) and 1280x720
//   node e2e/recruit-banners.mjs --viewport 844x390 --shots /tmp/rb   # one size + screenshots
//   node e2e/recruit-banners.mjs --at 2026-11-10T12:00:00-06:00      # another banner day
// Exit code 1 if any check fails. Starts its own Vite dev server on a free port.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport', null) ? opt('viewport').split(',') : ['844x390', '1280x720'];
const shotsDir = opt('shots', null);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
// a day in Tenka's debut week (pins in src/data/banners.js), 6:50 PM Central: the rollover is 10 minutes away
const AT = Date.parse(opt('at', '2026-11-10T18:50:00-06:00'));

const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
}
const IGNORE = [/GPU stall/i, /WebGL/i, /favicon/i, /GroupMarkerNotSet/i, /Failed to load resource: net::ERR_(CERT|NAME|INTERNET|PROXY|TUNNEL|CONNECTION)/i];

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const base = `http://127.0.0.1:${port}/?onboarding=0`;
const { browser } = await launchChromium();

async function run(vp) {
  const [w, hh] = vp.split('x').map(Number);
  log(`\n=== ${vp} ===`);
  const touch = Math.min(w, hh) < 600;
  const ctx = await browser.newContext({ viewport: { width: w, height: hh }, deviceScaleFactor: 1, hasTouch: touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.some((re) => re.test(m.text()))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: AT });
  const shot = async (name) => { if (shotsDir) await page.screenshot({ path: `${shotsDir}/${vp}-${name}.png`, timeout: 60000, animations: 'disabled' }).catch((e) => log(`  (shot ${name} skipped: ${e.message.split('\n')[0]})`)); };
  const tap = async (sel) => (touch ? page.tap(sel) : page.click(sel));
  const closeModal = async () => {
    const btn = page.locator('.modal .btn, .modal button').filter({ hasText: /^(Close|Cancel)$/ }).last();
    if (await btn.count()) await btn.click();
    await page.waitForTimeout(250);
  };

  await page.goto(`${base}#/lobby`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 30000 });
  await page.evaluate(() => {
    const p = window.__sakura.store.profile;
    p.currencies.gems = 50000;
    window.__sakura.store.commit('e2e');
  });
  // screenshots for the owner boards: no toasts or lesson pop-ups over the banner (checks are unaffected)
  if (shotsDir) await page.addStyleTag({ content: '.toast-host, .jn-toast { display: none !important; }' });
  await page.evaluate(() => { location.hash = '#/recruit'; });
  await page.waitForSelector('.bn-rail', { timeout: 20000 });
  await page.waitForTimeout(600);

  const tabs = await page.$$eval('.bn-tab', (els) => els.map((e) => e.dataset.testid));
  check(JSON.stringify(tabs) === JSON.stringify(['banner-tab-legend', 'banner-tab-tower', 'banner-tab-hero', 'banner-tab-standard']), `rail shows LR, Student, Guardian, Standard (${tabs.join(', ')})`);
  check(await page.isVisible('[data-testid="banner-time"]'), 'the countdown shows');
  await shot('1-student');

  // the look-ahead and the SR rate-ups
  check(await page.isVisible('[data-testid="banner-next"]'), 'Student Spotlight shows "Next: tomorrow …"');
  check((await page.$$('[data-testid^="sr-up-"]')).length === 3, 'three SR rate-ups');

  // rates page
  await tap('[data-testid="rates"]');
  await page.waitForSelector('[data-testid="rates-page"]');
  const ratesText = await page.textContent('[data-testid="rates-page"]');
  check(/Featured SSR/.test(ratesText) && /1%/.test(ratesText) && /3%/.test(ratesText), 'rates page lists the featured 1.0% and rate-ups 3.0%');
  await shot('2-rates');
  await closeModal();

  // LR tab
  await tap('[data-testid="banner-tab-legend"]');
  await page.waitForSelector('[data-testid="promise"]');
  const title = await page.textContent('[data-testid="banner-title"]');
  check(/Physics Club/.test(title), `LR tab is Tenka's debut banner (${title})`);
  check(/0\s*\/ 300|0\/ 300|300/.test(await page.textContent('[data-testid="promise"]')), 'Legend Promise bar shows /300');
  await shot('3-lr');
  await tap('[data-testid="rates"]');
  await page.waitForSelector('[data-testid="rates-page"]');
  check(/0\.7%/.test(await page.textContent('[data-testid="rates-page"]')), 'LR rates page shows 0.7% in the debut week');
  await closeModal();

  // a 10× on the LR Banner: points + promise move, pity shared
  await tap('[data-testid="pull-10"]');
  await page.waitForSelector('[data-testid="confirm-pull"]');
  await tap('[data-testid="confirm-pull"]');
  await page.waitForSelector('[data-testid="reveal-skip"]', { timeout: 10000 });
  await tap('[data-testid="reveal-skip"]');
  await page.waitForSelector('[data-testid="reveal-close"]', { state: 'attached', timeout: 15000 });
  await page.waitForTimeout(400);
  await shot('4-reveal');
  // the Potential-up cards may sit on top of the results: press Close in the page itself
  await page.evaluate(() => document.querySelector('[data-testid="reveal-close"]')?.click());
  await page.waitForTimeout(500);
  const counters = await page.evaluate(() => window.__sakura.store.profile.missions.counters);
  const pulled = await page.evaluate(() => window.__sakura.store.profile.gacha.totalPulls);
  check(pulled === 10, '10 pulls recorded');
  check((counters['gl:tenka'] || 0) + (await page.evaluate(() => window.__sakura.store.profile.units.tenka ? 1 : 0)) >= 1, 'the Legend Promise counted the LR pulls');
  check(await page.evaluate(() => window.__sakura.store.profile.gacha.history.slice(-1)[0].banner?.startsWith('legend:tenka:')), 'history carries the LR banner id');

  // Guardian and Standard tabs
  await tap('[data-testid="banner-tab-hero"]');
  await page.waitForTimeout(300);
  await shot('5-guardian');
  await tap('[data-testid="banner-tab-standard"]');
  await page.waitForSelector('[data-testid="standard-pick"]');
  check(await page.isVisible('[data-testid="standard-welcome"]') || /SSR guaranteed/.test(await page.textContent('[data-testid="pull-10"]')), 'Standard shows the first-10× SSR promise');
  await shot('6-standard');
  await tap('[data-testid="pick-change"]');
  await page.waitForSelector('[data-testid="pick-kaede"]');
  await tap('[data-testid="pick-kaede"]');
  await page.waitForTimeout(400);
  check(/Kaede/.test(await page.textContent('[data-testid="standard-pick"]')), 'the Standard pick changes to Kaede');
  check(await page.isDisabled('[data-testid="pick-change"]'), 'and cannot change again today');

  // spark dialog: Tenka is never offered
  await tap('[data-testid="spark"]');
  await page.waitForSelector('.ma-spark-grid');
  check(!(await page.$('[data-testid="spark-tenka"]')), 'the spark dialog never offers an LR unit');
  await shot('7-spark');
  await closeModal();

  // 7 PM Central passes with the screen open: the Student Spotlight changes
  await tap('[data-testid="banner-tab-tower"]');
  await page.waitForTimeout(300);
  const before = await page.getAttribute('.bn-page', 'data-banner');
  await page.clock.runFor(11 * 60 * 1000);
  await page.waitForTimeout(500);
  const after = await page.getAttribute('.bn-page', 'data-banner');
  check(before !== after && /^tower:/.test(after), `the banner switches at 7 PM Central (${before} → ${after})`);
  // a pull carrying yesterday's banner id is refused before payment
  const refused = await page.evaluate(async ([id]) => {
    const { pull } = await import('/src/systems/gacha.js');
    const p = window.__sakura.store.profile;
    const gems = p.currencies.gems;
    const r = pull(p, 1, { next: () => 0.5, pick: (a) => a[0] }, { bannerId: id });
    return { error: r.error, same: p.currencies.gems === gems };
  }, [before]);
  check(refused.error === 'rotated' && refused.same, "a pull on yesterday's banner is refused with 'rotated' and costs nothing");

  // the Coin banner after the first 6-5 clear: coins only, pity and points untouched
  await page.evaluate(() => {
    const p = window.__sakura.store.profile;
    p.progress.stages['6-5'] = { clears: 1, easy: true, normal: false, hard: false, nightmare: false };
    p.currencies.coins = 2_000_000;
    window.__sakura.store.commit('e2e');
  });
  await page.waitForSelector('[data-testid="banner-tab-coin"]');
  await tap('[data-testid="banner-tab-coin"]');
  await page.waitForSelector('[data-testid="coin-wallet"]');
  await shot('8-coin');
  const g0 = await page.evaluate(() => JSON.stringify(window.__sakura.store.profile.gacha));
  await tap('[data-testid="pull-10"]');
  await page.waitForSelector('.modal [data-testid], .modal .btn');
  await page.locator('.modal button').filter({ hasText: /^Recruit$/ }).click();
  await page.waitForSelector('[data-testid="reveal-skip"]', { timeout: 10000 });
  await tap('[data-testid="reveal-skip"]');
  await page.waitForSelector('[data-testid="reveal-close"]', { state: 'attached', timeout: 15000 });
  await page.evaluate(() => document.querySelector('[data-testid="reveal-close"]')?.click());
  await page.waitForTimeout(500);
  const after2 = await page.evaluate(() => ({ g: JSON.stringify(window.__sakura.store.profile.gacha), c: window.__sakura.store.profile.missions.counters, coins: window.__sakura.store.profile.currencies.coins }));
  check(after2.g === g0, 'a Coin 10× leaves pity, recruit points, total pulls and history untouched');
  check(after2.c['gc:n'] === 10 && after2.coins <= 2_000_000 - 250_000 + 200_000, 'it costs 250,000 coins and counts 10 of the weekly 20');
  check(/10\/20/.test(await page.textContent('[data-testid="coin-week"]')), 'the tab says "This week 10/20"');

  check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}

try {
  for (const vp of viewports) await run(vp);
} finally {
  await browser.close();
  await server.close();
}
log(failures.length ? `\n${failures.length} check(s) failed` : '\nall checks passed');
process.exitCode = failures.length ? 1 : 0;

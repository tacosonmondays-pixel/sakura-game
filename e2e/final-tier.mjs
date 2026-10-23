// End-to-end check of the one-final-tier-per-path rule in the battle UI (spec §5.3):
//   two Aoi; A bought to 5-0-0, B to 4-0-0 (coins topped up through the test hook) → B's panel shows
//   the lock on her first path with the exact copy and the holder line; Show selects A and pulses
//   her; selling A gives B her buy button back; the drawer's two-tap buy by mouse, then by keyboard (Enter, Enter:
//   the focus survives tap 1's re-render; the row body and Sell's confirm too). Then the wiki section "One final tier
//   per path".
// Screenshots of the panel with the lock at 1280×720 and 844×390 (and the wiki) go to --shots <dir>.
//
//   node e2e/final-tier.mjs [--shots /tmp/shots]
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 when a
// check fails.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const shotsDir = opt('shots', null);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const SIZES = [[1280, 720], [844, 390]];
const IGNORE = [
  /GPU stall due to ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i, /favicon\.ico/i,
  /Failed to load resource: net::ERR_/i,
];
const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
}

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const base = `http://127.0.0.1:${port}/`;

const save = await server.ssrLoadModule('/src/systems/save.js');
const rules = await server.ssrLoadModule('/src/ui/battle/rules.js');
const GIRLS = ['aoi', 'rei', 'yuki', 'momo'];
const profile = save.createProfile();
for (const id of [...GIRLS, 'hikari']) profile.units[id] = { ...save.newUnitState(), level: 40, breakthrough: 3 };
profile.formation = { ...(profile.formation || {}), towers: GIRLS, hero: 'hikari' };
profile.progress.stages['1-1'] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
profile.settings = { ...profile.settings, autoStart: false };
const saveText = JSON.stringify(profile);

const { browser, label } = await launchChromium();
log(`browser: ${label}`);
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await context.addInitScript(([key, text]) => {
  if (!sessionStorage.getItem('ft-e2e-seeded')) {
    localStorage.setItem(key, text);
    sessionStorage.setItem('ft-e2e-seeded', '1');
  }
}, [save.SAVE_KEY, saveText]);
const page = await context.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (!IGNORE.some((re) => re.test(t))) errors.push(`[console] ${t}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
const settle = (ms = 250) => page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, t)))), ms).catch(() => null);
const go = (hash) => page.evaluate((h) => { location.hash = h; }, hash);
async function snapAll(name, before = null) {
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await settle(500);
    if (before) {
      await before();
      await settle(300);
    }
    const leaked = await page.evaluate(() => (document.body.innerText.match(/\b(null|undefined|NaN|Infinity)\b/g) || []).join(', ')).catch(() => '');
    check(!leaked, `${name} ${w}x${h}: no "null" / "undefined" / "NaN" on screen${leaked ? ` (${leaked})` : ''}`);
    if (shotsDir) await page.screenshot({ path: `${shotsDir}/${name}-${w}x${h}.png`, timeout: 90000 }).catch((e) => log(`    (screenshot: ${String(e.message).split('\n')[0]})`));
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await settle(300);
}

try {
  await page.goto(base, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 90000 });
  await go('#/battle?stage=1-1&difficulty=normal');
  await page.waitForFunction(() => window.__battle?.ui?.act && window.__battle.ui.select, null, { timeout: 90000 });
  await settle(600);

  log('\n--- two Aoi: A 5-0-0, B 4-0-0 ---');
  const ids = await page.evaluate(() => {
    const { sim, ui } = window.__battle;
    sim.cash = 1e7;
    const spots = [];
    for (let y = 0.6; y < sim.map.height && spots.length < 2; y += 0.35) {
      for (let x = 0.6; x < sim.map.width && spots.length < 2; x += 0.35) {
        if (!sim.canPlace('aoi', x, y).ok) continue;
        if (sim.placement.pathDistance(x, y) > 1.6) continue;
        if (spots.some(([a, b]) => Math.hypot(a - x, b - y) < 2.5)) continue;
        spots.push([x, y]);
      }
    }
    const A = ui.act.place('aoi', ...spots[0]);
    const B = ui.act.place('aoi', ...spots[1]);
    for (let i = 0; i < 5; i++) ui.act.upgrade(A.uid, 0);
    for (let i = 0; i < 4; i++) ui.act.upgrade(B.uid, 0);
    return { A: A.uid, B: B.uid, a: A.tiers.join('-'), b: B.tiers.join('-'), path: A.def.paths[0].name };
  });
  check(ids.a === '5-0-0' && ids.b === '4-0-0', `A ${ids.a}, B ${ids.b}`);
  await page.evaluate((uid) => window.__battle.ui.select(uid), ids.B);
  await settle(500);
  const lock = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="final-lock-0"]');
    return el ? { line: el.querySelector('.bt-lock-line')?.textContent || '', show: document.querySelector('[data-testid="final-show-0"]')?.textContent || '' } : null;
  });
  check(!!lock, 'B\'s first path shows the final-tier lock');
  check(lock?.line === rules.onePerPathReason('Aoi', ids.path), `lock copy: "${lock?.line}"`);
  check(/^Held by Aoi 5-0-0 · .+ · Show ›$/.test(lock?.show || ''), `holder line: "${lock?.show}"`);
  check(await page.evaluate(() => !document.querySelector('[data-testid="buy-0"]')), 'no buy button on the held path');
  check(await page.evaluate(() => !!document.querySelector('.bt-pip.held')), 'the last pip shows "held"');
  check(await page.evaluate(() => window.__battle.sim.upgradeStatus(window.__battle.ui.selectedUid, 0).reason === 'onePerPath'), 'sim: onePerPath');
  await snapAll('final-lock', () => page.evaluate(() => document.querySelector('[data-testid="final-lock-0"]')?.scrollIntoView({ block: 'nearest' })));

  log('\n--- Show selects the holder ---');
  await page.locator('[data-testid="final-show-0"]').click({ timeout: 20000 });
  await settle(300);
  check(await page.evaluate((a) => window.__battle.ui.selectedUid === a, ids.A), 'Show › selects A');
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/final-show-pulse-1280x720.png` }).catch(() => null);

  log('\n--- selling A frees the final tier ---');
  await page.evaluate((a) => window.__battle.ui.act.sell(a), ids.A);
  await page.evaluate((b) => window.__battle.ui.select(b), ids.B);
  await settle(400);
  check(await page.evaluate(() => !!document.querySelector('[data-testid="buy-0"]') && !document.querySelector('[data-testid="final-lock-0"]')), 'B can buy her tier 5 again');
  // (the drawer's two-tap buy: tap 1 arms the price — "Buy · …" — tap 2 buys)
  await page.locator('[data-testid="buy-0"]').click({ timeout: 20000 });
  await settle(200);
  check(/Buy/.test(await page.locator('[data-testid="buy-0"]').innerText()), 'tap 1 arms the price ("Buy · …")');
  check(await page.evaluate((b) => window.__battle.sim.getTower(b).tiers.join('-') === '4-0-0', ids.B), 'tap 1 alone buys nothing');
  await page.locator('[data-testid="buy-0"]').click({ timeout: 20000 });
  await settle(300);
  check(await page.evaluate((b) => window.__battle.sim.getTower(b).tiers.join('-') === '5-0-0', ids.B), 'B bought 5-0-0');

  // (M4 review logic-3) the keyboard: tap 1 re-renders the drawer, and the price's new copy keeps the focus, so a
  // second Enter buys; the row body (role=button) and Sell's two-tap confirm keep it too
  log('\n--- the keyboard: Enter, then Enter again buys ---');
  await page.evaluate(() => { window.__battle.sim.cash = 1e7; });
  await settle(300);
  const focused = () => page.evaluate(() => {
    const a = document.activeElement;
    return a?.dataset?.testid || (a?.classList?.contains('bt-path-main') ? `row-${a.closest('[data-path]')?.dataset.path}` : a?.tagName?.toLowerCase() || null);
  });
  await page.focus('[data-testid="buy-1"]');
  await page.keyboard.press('Enter');
  await settle(150);
  const k1 = { label: await page.locator('[data-testid="buy-1"]').innerText(), focus: await focused(), tiers: await page.evaluate((b) => window.__battle.sim.getTower(b).tiers.join('-'), ids.B) };
  check(/Buy/.test(k1.label) && k1.focus === 'buy-1' && k1.tiers === '5-0-0', `keyboard: Enter on a price arms it, buys nothing, and the focus stays on it (${JSON.stringify(k1)})`);
  await page.keyboard.press('Enter');
  await settle(300);
  const k2 = { tiers: await page.evaluate((b) => window.__battle.sim.getTower(b).tiers.join('-'), ids.B), focus: await focused() };
  check(k2.tiers === '5-1-0', `keyboard: the second Enter buys the tier (${JSON.stringify(k2)})`);
  check(k2.focus === 'buy-1', `keyboard: the focus stays on her next price (${k2.focus})`);
  // (her second path's row: 5-1-0 locks the third one)
  await page.focus('.bt-path[data-path="1"] .bt-path-main[role="button"]');
  await page.keyboard.press('Enter');
  await settle(150);
  const k3 = { armed: await page.evaluate(() => !!document.querySelector('.bt-path[data-path="1"].armed')), focus: await focused() };
  check(k3.armed && k3.focus === 'row-1', `keyboard: Enter on a row opens it and the row keeps the focus (${JSON.stringify(k3)})`);
  await page.focus('[data-testid="sell"]');
  await page.keyboard.press('Enter');
  await settle(150);
  const k4 = { label: await page.locator('[data-testid="sell"]').innerText(), focus: await focused() };
  check(/CONFIRM/.test(k4.label) && k4.focus === 'sell', `keyboard: Enter on Sell asks to confirm and Sell keeps the focus (${JSON.stringify(k4)})`);
  await page.evaluate(() => window.__battle.ui.select(null));
  await settle(200);

  log('\n--- wiki: one final tier per path ---');
  await go('#/wiki/crosspath');
  await page.waitForSelector('.mb-article', { timeout: 30000 });
  await settle(400);
  check(await page.evaluate(() => /One final tier per path/.test(document.querySelector('.mb-article')?.textContent || '')), 'the wiki article has the section');
  await snapAll('wiki-final-tier', () => page.evaluate(() => {
    const hs = [...document.querySelectorAll('.mb-article h3, .mb-article h2, .mb-article h4')];
    hs.find((x) => /One final tier per path/.test(x.textContent))?.scrollIntoView({ block: 'start' });
  }));
} catch (e) {
  failures.push(`crashed: ${e.message}`);
  log(e);
} finally {
  if (errors.length) {
    log(`\nconsole / page errors:\n${errors.slice(0, 20).join('\n')}`);
    failures.push(`${errors.length} console / page error(s)`);
  }
  await browser.close();
  await server.close();
}
log(failures.length ? `\nFAILED (${failures.length}):\n- ${failures.join('\n- ')}` : '\nall final-tier checks passed');
process.exit(failures.length ? 1 : 0);

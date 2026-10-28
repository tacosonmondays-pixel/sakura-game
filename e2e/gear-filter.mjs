// Equipment filters (owner: "can you add a filter for equipment?"): the Backpack's Equipment tab
// and a girl's Equipment tab, at a phone and a PC size, with 20 generated pieces: rarity (the
// Backpack's own chips), sort, Clear, an empty result, remembered choices, slot-aware main stats.
// Usage: node e2e/gear-filter.mjs [--shots dir]
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const args = process.argv.slice(2);
const SHOTS = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const require = createRequire('/opt/node22/lib/node_modules/playwright/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const fails = [];
const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); };
for (const [W, H] of [[844, 390], [1280, 720]]) {
  const touch = W < 1000;
  const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 15000 }).catch(() => null);
  if (later) { await later.click({ force: true }); await page.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 10000 }).catch(() => {}); }
  await page.evaluate(async () => {
    const { store } = window.__sakura;
    const gear = await import('/src/systems/gear.js');
    const { createRng } = await import('/src/core/rng.js');
    const rng = createRng(7);
    const p = store.profile;
    for (const r of ['common', 'rare', 'superRare', 'mythic', 'legendary']) for (let i = 0; i < 4; i++) {
      gear.addGear(p, gear.rollGear(rng, { rarity: r, level: i * 2 }));
    }
    store.commit('test'); store.saveNow?.();
  });
  // UI v2 M2: the Backpack's filters live in its Filter sheet (rarity and slot chips, then the dropdowns), the sort in
  // its Sort sheet; the grid shows gear tiles
  const tiles = () => page.locator('#app .mb-gear-grid .ui-gtile');
  const openFilter = async () => {
    await page.locator('#app [data-testid="bp-filter"]').click();
    await page.waitForSelector('[data-testid="gear-filter-sheet"] [data-testid="gear-filter"]', { timeout: 15000 });
  };
  const closeSheet = async () => {
    await page.keyboard.press('Escape');
    await page.waitForSelector('.ui-layer', { state: 'detached', timeout: 5000 }).catch(() => {});
  };
  await page.evaluate(() => { location.hash = '#/backpack?tab=equipment'; });
  await page.waitForSelector('#app [data-testid="bp-filter"]', { timeout: 15000 });
  const total = await tiles().count();
  check(total === 20, `${W}x${H} backpack: 20 gear shown (${total})`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/backpack-all-${W}x${H}.png`, fullPage: false });
  await openFilter();
  check(await page.locator('[data-testid^="gear-filter-rarity"]').count() === 0, `${W}x${H} backpack: one rarity row (the sheet's own chips filter gear)`);
  check(await page.locator('[data-testid="gear-filter-sheet"] [data-testid="gear-filter-sort"]').count() === 0, `${W}x${H} backpack: the sort is not in the Filter sheet (its own Sort button)`);
  await page.locator('[data-testid="bp-rarity-mythic"]').click();
  await page.waitForTimeout(300);
  const mythic = await tiles().count();
  const countText = await page.locator('[data-testid="gear-filter-count"]').innerText();
  check(mythic === 4 && /Showing 4 of 20/.test(countText), `${W}x${H} rarity Mythic → 4 ("${countText}")`);
  await closeSheet();
  check(await page.locator('#app [data-testid="bp-filter"].on').count() === 1, `${W}x${H} the Filter button shows that a filter is on`);
  await page.locator('#app [data-testid="bp-sort"]').click();
  await page.locator('[data-testid="gear-sort-level"]').click();
  await page.waitForTimeout(300);
  const levels = await page.evaluate(() => [...document.querySelectorAll('#app .mb-gear-grid .ui-gtile[data-gear]')].map((t) => `+${window.__sakura.store.profile.gear[t.dataset.gear].level}`));
  check(levels.join(',') === '+6,+4,+2,+0', `${W}x${H} sort by level: ${levels.join(',')}`);
  check(/level/i.test(await page.locator('#app [data-testid="bp-sort"]').innerText()), `${W}x${H} the Sort button names the order`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/backpack-mythic-${W}x${H}.png` });
  await openFilter();
  await page.locator('[data-testid="gear-filter-clear"]').click();
  await page.waitForTimeout(300);
  check(await tiles().count() === 20, `${W}x${H} Clear filters → 20 again`);
  // remembered on the next visit
  await page.selectOption('[data-testid="gear-filter-status"]', 'locked');
  await page.waitForTimeout(300);
  check(await tiles().count() === 0 && await page.locator('text=No gear matches these filters').count() === 1, `${W}x${H} no matches → friendly empty state`);
  await page.selectOption('[data-testid="gear-filter-status"]', 'all');
  await page.selectOption('[data-testid="gear-filter-main"]', 'atkPct');
  await closeSheet();
  await page.evaluate(() => { location.hash = '#/lobby'; });
  await page.waitForTimeout(800);
  await page.evaluate(() => { location.hash = '#/backpack?tab=equipment'; });
  await page.waitForSelector('#app [data-testid="bp-filter"]', { timeout: 15000 });
  await openFilter();
  const remembered = await page.locator('[data-testid="gear-filter-main"]').inputValue();
  check(remembered === 'atkPct', `${W}x${H} filter remembered on the next visit (${remembered})`);
  await closeSheet();
  // girl's equipment tab: the filter lives in a slot's sheet, behind its Filter button (UI_DIRECTION.md §6.2 M1b)
  await page.evaluate(() => { location.hash = '#/student/hikari?tab=gear'; });
  await page.waitForSelector('[data-testid="slot-charm"]', { timeout: 30000 }).catch(async () => { await page.reload(); await page.waitForSelector('[data-testid="slot-charm"]', { timeout: 30000 }); });
  await page.locator('[data-testid="slot-charm"]').click();
  await page.waitForSelector('[data-testid="gear-sheet"]', { timeout: 15000 });
  await page.locator('[data-testid="gear-filter-open"]').click();
  const bar = await page.waitForSelector('[data-testid="gear-sheet"] [data-testid="gear-filter"]', { timeout: 15000 }).then(() => true).catch(() => false);
  check(bar, `${W}x${H} girl's Equipment: a slot's sheet has the filter bar behind Filter`);
  const opts = await page.locator('[data-testid="gear-sheet"] [data-testid="gear-filter-main"] option').allInnerTexts();
  check(opts.length >= 2 && opts[0] === 'Any', `${W}x${H} main-stat options for the slot: ${opts.join(' / ')}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/student-gear-${W}x${H}.png` });
  // shoes can't have an ATK main stat: the remembered student filter must not empty that list
  await page.selectOption('[data-testid="gear-sheet"] [data-testid="gear-filter-main"]', 'atkPct');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-testid="gear-sheet"]', { state: 'detached', timeout: 5000 }).catch(() => {});
  await page.locator('[data-testid="slot-shoes"]').click();
  await page.waitForSelector('[data-testid="gear-sheet"]', { timeout: 15000 });
  await page.waitForTimeout(500);
  const shoes = await page.locator('[data-testid="gear-sheet"] [data-testid="gear-picker"] .ui-gtile').count();
  check(shoes > 0, `${W}x${H} switching to Shoes ignores the Charm-only ATK filter (${shoes} shown)`);
  check(errs.length === 0, `${W}x${H} no page errors ${errs.join(' | ')}`);
  await page.close();
}
await browser.close(); await server.close();
console.log(fails.length ? `${fails.length} FAILED` : 'ALL GEAR FILTER CHECKS PASSED');
process.exit(fails.length ? 1 : 0);

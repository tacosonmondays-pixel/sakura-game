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
  await page.goto(`${base}#/lobby`, { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(`${base}#/lobby`, { waitUntil: 'load' });
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
  await page.evaluate(() => { location.hash = '#/backpack?tab=equipment'; });
  await page.waitForSelector('[data-testid="gear-filter"]', { timeout: 15000 });
  const total = await page.locator('.mb-gear-grid .mb-gear').count();
  check(total === 20, `${W}x${H} backpack: 20 gear shown (${total})`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/backpack-all-${W}x${H}.png`, fullPage: false });
  check(await page.locator('[data-testid^="gear-filter-rarity"]').count() === 0, `${W}x${H} backpack: one rarity row (the page's own chips filter gear)`);
  await page.locator('.mb-chips-rarity .mb-chip', { hasText: 'Mythic' }).first().click();
  await page.waitForTimeout(300);
  const mythic = await page.locator('.mb-gear-grid .mb-gear').count();
  const countText = await page.locator('[data-testid="gear-filter-count"]').innerText();
  check(mythic === 4 && /Showing 4 of 20/.test(countText), `${W}x${H} rarity Mythic → 4 ("${countText}")`);
  await page.selectOption('[data-testid="gear-filter-sort"]', 'level');
  await page.waitForTimeout(300);
  const levels = await page.locator('.mb-gear-grid .mb-gear-level').allInnerTexts();
  check(levels.join(',') === '+6,+4,+2,+0', `${W}x${H} sort by level: ${levels.join(',')}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/backpack-mythic-${W}x${H}.png` });
  await page.locator('[data-testid="gear-filter-clear"]').click();
  await page.waitForTimeout(300);
  check(await page.locator('.mb-gear-grid .mb-gear').count() === 20, `${W}x${H} Clear filters → 20 again`);
  // remembered on the next visit
  await page.selectOption('[data-testid="gear-filter-status"]', 'locked');
  await page.waitForTimeout(300);
  check(await page.locator('.mb-gear-grid .mb-gear').count() === 0 && await page.locator('text=No gear matches these filters').count() === 1, `${W}x${H} no matches → friendly empty state`);
  await page.selectOption('[data-testid="gear-filter-status"]', 'all');
  await page.selectOption('[data-testid="gear-filter-main"]', 'atkPct');
  await page.evaluate(() => { location.hash = '#/lobby'; });
  await page.waitForTimeout(800);
  await page.evaluate(() => { location.hash = '#/backpack?tab=equipment'; });
  await page.waitForSelector('[data-testid="gear-filter"]', { timeout: 15000 });
  const remembered = await page.locator('[data-testid="gear-filter-main"]').inputValue();
  check(remembered === 'atkPct', `${W}x${H} filter remembered on the next visit (${remembered})`);
  // girl's equipment tab
  await page.evaluate(() => { location.hash = '#/student/hikari?tab=gear'; });
  await page.waitForSelector('.mb-slots', { timeout: 30000 }).catch(async () => { await page.reload(); await page.waitForSelector('.mb-slots', { timeout: 30000 }); });
  const bar = await page.waitForSelector('.mb-tab-body [data-testid="gear-filter"]', { timeout: 15000 }).then(() => true).catch(() => false);
  check(bar, `${W}x${H} girl's Equipment tab has the filter bar`);
  const opts = await page.locator('[data-testid="gear-filter-main"] option').allInnerTexts();
  check(opts.length >= 2 && opts[0] === 'Any', `${W}x${H} main-stat options for the slot: ${opts.join(' / ')}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/student-gear-${W}x${H}.png` });
  // shoes can't have an ATK main stat: the remembered student filter must not empty that list
  await page.selectOption('.mb-tab-body [data-testid="gear-filter-main"]', 'atkPct');
  await page.waitForTimeout(300);
  await page.locator('[data-testid="slot-shoes"]').click();
  await page.waitForTimeout(500);
  const shoes = await page.locator('.mb-tab-body .mb-gear-grid .mb-gear').count();
  check(shoes > 0, `${W}x${H} switching to Shoes ignores the Charm-only ATK filter (${shoes} shown)`);
  check(errs.length === 0, `${W}x${H} no page errors ${errs.join(' | ')}`);
  await page.close();
}
await browser.close(); await server.close();
console.log(fails.length ? `${fails.length} FAILED` : 'ALL GEAR FILTER CHECKS PASSED');
process.exit(fails.length ? 1 : 0);

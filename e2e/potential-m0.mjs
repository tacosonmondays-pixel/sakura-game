// Potential M0 (owner, Oct 14: "add potential levels when you get dupes … max 6"): the counting
// (M2 put it on screen; this file keeps checking the counts). Owns every girl, recruits ten
// through the real Recruit screen and checks that the ten duplicates landed in units[id].dupes
// and in the shadow copy, and that the counts survive a reload. Then stores a save as a build
// from before M0 would (no dupes, no shadow), reloads and checks the one-time backfill from the
// recruit history.
// Phone (844x390) and PC (1280x720).
// Usage: node e2e/potential-m0.mjs
import { createServer } from 'vite';
import { createRequire } from 'node:module';

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const require = createRequire('/opt/node22/lib/node_modules/playwright/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const fails = [];
const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); };
const T = 60000;
const SAVE_KEY = 'sakura-sentinels-save-v1';

async function dismissGift(page) {
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 15000 }).catch(() => null);
  if (later) { await later.click({ force: true }); await page.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 15000 }).catch(() => {}); }
}

async function load(page, hash = '#/lobby') {
  await page.goto(`${base}?onboarding=0${hash}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: T });
}

const dupesOf = (page) => page.evaluate(() => {
  const p = window.__sakura.store.profile;
  return { dupes: Object.fromEntries(Object.entries(p.units).map(([id, u]) => [id, u.dupes])), counters: p.missions.counters, seenIntro: p.seenIntro };
});
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

for (const vp of [{ w: 844, h: 390, touch: true }, { w: 1280, h: 720, touch: false }]) {
  console.log(`viewport ${vp.w}x${vp.h}`);
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.touch, isMobile: vp.touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await load(page);
  await page.evaluate(() => localStorage.clear());
  await load(page);
  await dismissGift(page);

  // own every girl, so every recruit is a duplicate
  await page.evaluate(async () => {
    const { store } = window.__sakura;
    const { grantUnit } = await import('/src/systems/unlocks.js');
    const { UNITS } = await import('/src/data/units.js');
    const p = store.profile;
    for (const u of UNITS) if (!p.units[u.id]) grantUnit(p, u.id, Date.now() - 60000); // joined a minute ago
    p.items.ticket_recruit10 = 1;
    store.commit('test');
    store.saveNow();
  });
  const before = await dupesOf(page);
  check(sum(before.dupes) === 0, `every girl owned at 0 duplicates (${sum(before.dupes)})`);

  // a real 10-pull through the Recruit screen
  await page.evaluate(() => { location.hash = '#/recruit'; });
  await page.waitForSelector('[data-testid="pull-10"]', { timeout: T });
  await page.click('[data-testid="pull-10"]');
  const confirm = await page.waitForSelector('[data-testid="confirm-pull"]', { timeout: 3000 }).catch(() => null);
  if (confirm) await confirm.click();
  const skip = await page.waitForSelector('[data-testid="reveal-skip"]', { timeout: 15000 }).catch(() => null);
  if (skip) await skip.click({ force: true }).catch(() => {});
  const close = await page.waitForSelector('[data-testid="reveal-close"]', { timeout: 30000 }).catch(() => null);
  // since M2 the reveal shows the steps ("▲ N Potential"); M0 itself showed nothing
  const summary = await page.evaluate(() => document.querySelector('[data-testid="reveal-summary"]')?.textContent || '');
  if (close) await close.click({ force: true }).catch(() => {});
  await page.waitForTimeout(300);
  const after = await dupesOf(page);
  check(sum(after.dupes) === 10, `a 10-pull of owned girls adds 10 duplicates (${sum(after.dupes)})`);
  check(Object.entries(after.dupes).every(([id, n]) => after.counters[`pot:${id}`] === n), 'the shadow copy matches every count');
  check(/▲ \d+ Potential/.test(summary), `the reveal summary counts the Potential steps (M2): "${summary}"`);

  // reload: the counts survive
  await page.evaluate(() => window.__sakura.store.saveNow());
  await load(page, '#/lobby');
  const reloaded = await dupesOf(page);
  check(JSON.stringify(reloaded.dupes) === JSON.stringify(after.dupes), 'duplicates survive a reload');
  check(!reloaded.seenIntro.includes('potential-backfilled'), 'a save that had counts is not backfilled');

  // a save from before M0 (as v0.1.25 wrote it): no dupes, no shadow → backfilled from history
  const old = await page.evaluate((key) => {
    const raw = JSON.parse(localStorage.getItem(key));
    for (const u of Object.values(raw.units)) delete u.dupes;
    for (const k of Object.keys(raw.missions.counters)) if (k.startsWith('pot:')) delete raw.missions.counters[k];
    return raw;
  }, SAVE_KEY);
  await page.evaluate(([key, raw]) => {
    window.__sakura.store.saveNow = () => {}; // this tab must not write over the planted save
    window.onbeforeunload = null;
    localStorage.setItem(key, JSON.stringify(raw));
  }, [SAVE_KEY, old]);
  const ctx2 = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.touch, isMobile: vp.touch, storageState: await ctx.storageState() });
  await ctx.close();
  const page2 = await ctx2.newPage();
  page2.on('pageerror', (e) => errors.push(e.message));
  await load(page2);
  const back = await dupesOf(page2);
  check(back.seenIntro.includes('potential-backfilled'), 'an old save is marked as backfilled');
  check(JSON.stringify(back.dupes) === JSON.stringify(after.dupes), `the backfill finds the same 10 duplicates in the history (${sum(back.dupes)})`);
  check(!errors.length, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await ctx2.close();
}

await browser.close();
await server.close();
if (fails.length) {
  console.log(`\n${fails.length} failed`);
  process.exit(1);
}
console.log('\npotential-m0: all ok');

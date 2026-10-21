// Owner bug (Oct 13): "when you level cap and then break through, it doesnt bring back the option
// to continue leveling up, forcing you to click on a different tab and coming back". A girl at her
// level cap breaks through on the Level Up tab; the same tab, without switching, must show the new
// cap, the EXP line and the books + Level Up button again — and levelling up must then work.
// Usage: node e2e/breakthrough-refresh.mjs [--viewport 844x390] [--shots dir]
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const [W, H] = arg('--viewport', '1280x720').split('x').map(Number);
const shotsDir = arg('--shots', null);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const touch = W < 1000;

const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
}

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const require = createRequire('/opt/node22/lib/node_modules/playwright/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const tap = async (sel) => {
  const el = page.locator(sel).first();
  await (touch ? el.tap({ timeout: 20000 }) : el.click({ timeout: 20000 }));
};
// innerText follows the caps style of the cap line ("CAP 10"): the checks ignore case
const headText = () => page.evaluate(() => document.querySelector('.mb-lv-head')?.parentElement?.innerText || '');

try {
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 15000 }).catch(() => null);
  if (later) {
    await later.click({ force: true });
    await page.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 10000 }).catch(() => {});
  }
  // Hikari at Lv.10 = her cap, gate 1 materials + books in the backpack
  const unitId = await page.evaluate(async () => {
    const { store } = window.__sakura;
    const inv = await import('/src/systems/inventory.js');
    const prog = await import('/src/systems/progression.js');
    const items = await import('/src/data/items.js');
    const p = store.profile;
    const id = p.units.hikari ? 'hikari' : Object.keys(p.units)[0];
    Object.assign(p.units[id], { level: 10, exp: 0, breakthrough: 0 });
    inv.addItems(p, prog.breakthroughCost(id, 1).map((c) => ({ id: c.id, count: c.count })));
    inv.addItems(p, [{ id: items.bookId('rare'), count: 40 }, { id: 'coins', count: 1_000_000 }]);
    store.commit('test');
    store.saveNow?.();
    return id;
  });
  await page.evaluate((id) => { location.hash = `#/student/${id}?tab=level`; }, unitId);
  await page.waitForSelector('[data-testid="breakthrough"]', { timeout: 20000 });
  const before = await headText();
  check(/Cap 10/i.test(before) && /Level cap reached/.test(before), `at the cap: "${before.replace(/\s+/g, ' ').slice(0, 90)}"`);
  check((await page.locator('[data-testid="level-up"]').count()) === 0, 'at the cap: no Level Up button (books paused)');

  await tap('[data-testid="breakthrough"]');
  await page.waitForFunction(() => /Cap 20/.test(document.querySelector('.mb-lv-head')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
  const after = await headText();
  check(/Cap 20/i.test(after) && !/Level cap reached/.test(after), `same tab after the breakthrough: "${after.replace(/\s+/g, ' ').slice(0, 90)}"`);
  check((await page.locator('[data-testid="level-up"]').count()) === 1, 'the books + Level Up button are back without switching tabs');
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/breakthrough-after-${W}x${H}.png` });

  await tap('[data-testid="auto-select"]');
  await tap('[data-testid="level-up"]');
  const lv = await page.evaluate((id) => window.__sakura.store.profile.units[id].level, unitId);
  check(lv > 10 && lv <= 20, `levelling continues past the old cap (now Lv.${lv})`);
} catch (e) {
  failures.push(`crashed: ${e.stack || e}`);
  log(e);
} finally {
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.slice(0, 5).join(' | ')}` : ''}`);
  await browser.close().catch(() => {});
  await server.close();
}
log(failures.length ? `\n${failures.length} CHECK(S) FAILED` : '\nALL BREAKTHROUGH CHECKS PASSED');
process.exit(failures.length ? 1 : 0);

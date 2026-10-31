// Art v3 (display only): every roster portrait redrawn in Look B. A profile that owns every girl, at 390x844 (phone
// portrait), 844x390 (phone landscape) and 1280x720 (desktop):
//   1. the girls list: every portrait image on it loads (no broken -card/-thumb), no page error;
//   2. a few girls' pages (the -full/-bust master): the picture loads at its real size;
//   3. the squad (formation) screen: its thumbs load.
// Screenshots of each step go to --shots <dir>.
//
//   node e2e/art-v3.mjs [--shots /tmp/art-v3] [--sizes 390x844,844x390,1280x720] [--girls hikari,kogane,kohaku_tsubaki]
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 when a check fails.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';
import { seedUiSave, SHOT_NOW } from './uiSeed.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const SHOTS = opt('shots', null);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const SIZES = opt('sizes', '390x844,844x390,1280x720').split(',');
const PAGES = opt('girls', 'hikari,yuki,kogane,norika,kohaku_tsubaki').split(',');

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser, label } = await launchChromium();
console.log(`browser: ${label}`);
const fails = [];
let oks = 0;
const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (c) oks += 1; else fails.push(m); return c; };
const settle = (page, ms = 150) => page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, t)))), ms);
const clean = (page) => page.evaluate(() => document.querySelectorAll('.modal-overlay, .toast, .jn-toast, .ach-toast').forEach((n) => n.remove()));

async function go(page, hash, screen) {
  await page.evaluate((hh) => { location.hash = hh; }, hash);
  await page.waitForFunction((s) => document.querySelector('#app')?.dataset.screen === s && !document.documentElement.dataset.tx, screen, { timeout: 30000 }).catch(() => {});
  await clean(page);
  await settle(page, 700);
}

/** Every visible portrait <img> (src under /art/portraits/) has loaded; returns [count, broken srcs]. */
async function portraitsLoaded(page) {
  // lazy pictures off screen have not been asked for yet: ask for every one now, so a missing file shows as broken
  await page.evaluate(() => document.querySelectorAll('img[src*="/art/portraits/"][loading="lazy"]').forEach((i) => { i.loading = 'eager'; }));
  await page.waitForFunction(() => [...document.querySelectorAll('img[src*="/art/portraits/"]')].every((i) => i.complete), null, { timeout: 20000 }).catch(() => {});
  return page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img[src*="/art/portraits/"]')];
    return [imgs.length, imgs.filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src'))];
  });
}

async function run(size) {
  const [W, H] = size.split('x').map(Number);
  const touch = Math.min(W, H) < 600;
  console.log(`\n== ${size} ==`);
  const context = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce', timezoneId: 'America/Chicago' });
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.clock.setFixedTime(new Date(SHOT_NOW));
  await page.addInitScript(() => {
    try { sessionStorage.setItem('sakura-beta-gift-shown', '1'); } catch { /* none */ }
    try { sessionStorage.setItem('sakura-ui-rotate-dismissed', '1'); } catch { /* none */ }
    document.addEventListener('DOMContentLoaded', () => document.head.append(Object.assign(document.createElement('style'), { textContent: '.toast-host, .jn-toast { display: none !important; }' })));
  });
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load', timeout: 90000 });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 30000 });
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 4000 }).catch(() => null);
  if (later) await later.click({ force: true });
  await seedUiSave(page, false);
  await page.evaluate(async () => {
    const { store } = window.__sakura;
    const { grantUnit } = await import('/src/systems/unlocks.js');
    const { UNITS } = await import('/src/data/units.js');
    for (const u of UNITS) if (!store.profile.units[u.id]) grantUnit(store.profile, u.id, 1760000000000);
    store.commit('e2e');
    store.saveNow?.();
  });

  await go(page, '#/students', 'students');
  // the list may lazy-load below the fold: scroll it through once so every tile asks for its picture
  await page.evaluate(async () => {
    const sc = [...document.querySelectorAll('*')].find((n) => n.scrollHeight > n.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(n).overflowY));
    if (!sc) return;
    for (let y = 0; y <= sc.scrollHeight; y += sc.clientHeight / 2) { sc.scrollTop = y; await new Promise((r) => setTimeout(r, 120)); }
    sc.scrollTop = 0;
  });
  let [n, broken] = await portraitsLoaded(page);
  check(n > 0 && broken.length === 0, `${size} girls list: ${n} portraits, broken: ${broken.join(', ') || 'none'}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${size}-students.png` });

  for (const id of PAGES) {
    await go(page, `#/student/${id}`, 'student');
    [n, broken] = await portraitsLoaded(page);
    check(n > 0 && broken.length === 0, `${size} ${id} page: ${n} portraits, broken: ${broken.join(', ') || 'none'}`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${size}-student-${id}.png` });
  }

  await go(page, '#/formation', 'formation');
  [n, broken] = await portraitsLoaded(page);
  check(broken.length === 0, `${size} squad: ${n} portraits, broken: ${broken.join(', ') || 'none'}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${size}-formation.png` });

  check(errs.length === 0, `${size} no page errors${errs.length ? `: ${errs.slice(0, 3).join(' | ')}` : ''}`);
  await context.close();
}

try {
  for (const s of SIZES) await run(s);
} finally {
  await browser.close();
  await server.close();
}
console.log(`\n${oks} ok, ${fails.length} failed`);
if (fails.length) { for (const f of fails) console.log(`  FAIL ${f}`); process.exit(1); }

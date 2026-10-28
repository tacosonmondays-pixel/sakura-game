// Tryout Day in a two-tab co-op room (local adapter; docs/specs/TRYOUT_DAY.md §11, M1):
//   the host turns Tryout Day on, both tabs pick 3 of their six and a hero, the host starts; both battles show the run
//   UI and built the same run, each tab's bar its own squad.
// node e2e/tryout-coop.mjs [--viewport 1280x720] [--shots dir]
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const [W, H] = opt('viewport', '1280x720').split('x').map(Number);
const shotsDir = opt('shots', null);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const failures = [];
const log = (...a) => console.log(...a);
const check = (c, m) => {
  log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`);
  if (!c) failures.push(m);
  return c;
};
const T = { timeout: 30000 };

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/?online=local&onboarding=0`;
// two tabs in one window: neither may be throttled as a background tab (the host would mark the guest gone)
const { browser, label } = await launchChromium({ args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
log(`browser: ${label}`);
const errors = [];
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: 'reduce' });

async function maybeName(page, name) {
  const input = await page.waitForSelector('[data-testid="name-input"]', { timeout: 4000 }).catch(() => null);
  if (!input) return;
  await page.fill('[data-testid="name-input"]', name);
  await page.click('[data-testid="name-save"]', T);
}
async function clearModal(page) {
  for (let i = 0; i < 3; i++) {
    if (!(await page.$('.modal-overlay'))) return;
    if (await page.$('[data-testid="beta-gift-later"]')) await page.click('[data-testid="beta-gift-later"]', { force: true });
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
}
const watch = (p, n) => {
  p.on('pageerror', (e) => errors.push(`${n} pageerror ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/WebGL|GPU stall|favicon|Failed to load resource|GL_CLOSE/i.test(m.text())) errors.push(`${n} ${m.text()}`); });
};

const A = await ctx.newPage();
watch(A, 'host');
await A.goto(`${url}#/lobby`, { waitUntil: 'load' });
await A.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 60000 });
await A.evaluate(() => {
  const { store } = window.__sakura;
  for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5', '2-1', '2-2', '2-3', '2-4', '2-5']) store.profile.progress.stages[id] = { clears: 1, easy: true, normal: true, hard: false, nightmare: false };
  store.commit('replace');
  store.saveNow?.();
});
const code = 'TRY01';
await A.evaluate((c) => { location.hash = `#/coop/${c}?host=1&stage=1-1&difficulty=normal`; }, code);
await maybeName(A, 'Aiko');
await A.waitForSelector('[data-testid="coop-room-code"]', T);
const B = await ctx.newPage();
watch(B, 'guest');
await B.goto(`${url}#/coop/${code}`, { waitUntil: 'load' });
await maybeName(B, 'Bea');
await B.waitForFunction(() => window.__coop?.paired, null, T);
await clearModal(A);
await A.click('[data-testid="coop-tryout"] [data-tryout="on"]', T);
check(await B.waitForFunction(() => !!window.__coop?.tryout, null, T).then(() => true).catch(() => false), 'the guest sees the host\'s run');
for (const p of [A, B]) {
  await clearModal(p);
  await p.waitForSelector('[data-testid="coop-run-six"]', T);
  for (let i = 0; i < 3; i++) {
    await p.locator('[data-testid="coop-run-girl"]').nth(i).click(T);
    await p.waitForFunction((n) => document.querySelectorAll('[data-testid="coop-run-girl"][aria-pressed="true"]').length >= n, i + 1, T).catch(() => {});
  }
}
if (shotsDir) await A.screenshot({ path: `${shotsDir}/tycoop-room-host-${W}x${H}.png` });
await clearModal(B);
await B.click('[data-testid="coop-ready"]', T);
check(await A.waitForFunction(() => window.__coop?.canStart, null, T).then(() => true).catch(() => false), 'the host can start once both picked 3 and the guest is ready');
await A.click('[data-testid="coop-start"]', T);
const ready = (p) => p.waitForFunction(() => window.__battle?.ui?.tryoutUi && !document.documentElement.dataset.tx, null, { timeout: 180000, polling: 250 }).then(() => true).catch(() => false);
const [ra, rb] = await Promise.all([ready(A), ready(B)]);
check(ra && rb, 'both battles mount with the run UI');

// both clients built the same run (a pick across both players is covered headless: tests/online/tryoutCoop.test.js
// and the Tryout Day run in e2e/engines.mjs; a real-time two-tab run to wave 4 is too slow under software WebGL)
const runs = await Promise.all([A, B].map((p) => p.evaluate(() => {
  const ty = window.__battle.sim.tryout;
  return { seed: ty.seed, map: ty.mapId, squads: ty.players.map((x) => x.squad.join(',')), seats: JSON.stringify(ty.seats.blocks[0]) };
})));
check(JSON.stringify(runs[0]) === JSON.stringify(runs[1]), `both clients built the same run (${runs[0].map} · ${JSON.stringify(runs[0].squads)})`);
check(runs[0].squads.every((q) => q.split(',').length === 3), 'each player starts with their 3 drafted girls');
const ui = await Promise.all([A, B].map((p) => p.evaluate(() => !!document.querySelector('[data-testid="ty-tracker"]') && !!document.querySelector('[data-testid="ty-chip-a_hearts"]'))));
check(ui.every(Boolean), 'both trackers show Full Hearts');
const mine = await Promise.all([A, B].map((p) => p.evaluate(() => [...window.__battle.sim.loadout.keys()].join(','))));
check(mine[0] === runs[0].squads[0] && mine[1] === runs[0].squads[1], 'each tab\'s bar holds its own squad');
if (shotsDir) await B.screenshot({ path: `${shotsDir}/tycoop-battle-guest-${W}x${H}.png` });
await ctx.close();
await browser.close();
await server.close();
if (errors.length) for (const e of errors.slice(0, 15)) log(`  error: ${e}`);
check(errors.length === 0, 'no console errors');
log(failures.length ? `\n${failures.length} check(s) failed` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);

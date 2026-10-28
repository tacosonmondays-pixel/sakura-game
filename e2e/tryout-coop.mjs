// Tryout Day in a two-tab co-op room (local adapter; docs/specs/TRYOUT_DAY.md §11, M1):
//   the host turns Tryout Day on, both tabs pick 3 of their six and a hero, the host starts; both battles show the run
//   UI; waves to the first pick; each tab takes a card from its own offer (the other's sheet says "Partner"); both
//   sims agree (squads, picks, the co-op hash) and the next wave waits until both picked.
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
const { browser, label } = await launchChromium();
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

// play to the first pick: both clients start waves through the lockstep (the host's Start), coins topped up
const step = async () => {
  await A.evaluate(() => {
    const { ui, sim } = window.__battle;
    if (sim.state !== 'wave' && !sim.tryoutWindowOpen()) ui.startWave();
  });
  await A.waitForTimeout(2000);
};
// each player places her hero and squad (lockstep place commands)
for (const [p, dx] of [[A, 0], [B, 1]]) {
  await p.evaluate((off) => {
    const { sim, ui } = window.__battle;
    const spots = [];
    for (let y = 0.75; y < sim.map.height; y += 0.5) for (let x = 0.75 + off * 0.25; x < sim.map.width; x += 0.5) if (!sim.placementReason('aoi', x, y)) spots.push([x, y]);
    let k = off * 7;
    for (const id of [sim.heroConfig?.unitId, ...sim.loadout.keys()]) {
      if (!id) continue;
      for (; k < spots.length; k += 3) if (sim.canPlace(id, spots[k][0], spots[k][1]).ok) { ui.act.place(id, spots[k][0], spots[k][1]); k += 9; break; }
    }
  }, dx);
}
await A.waitForTimeout(1500);
await A.evaluate(() => window.__battle.ui.setAutoStart?.(true));
await A.evaluate(() => window.__battle.ui.setSpeed?.(3));
const until = Date.now() + 9 * 60 * 1000;
let last = null;
while (Date.now() < until) {
  const st = await A.evaluate(() => ({ win: window.__battle.sim.tryoutWindowOpen(), wave: window.__battle.sim.wave, state: window.__battle.sim.state, lives: window.__battle.sim.lives, towers: window.__battle.sim.towers.length }));
  last = st;
  if (st.win || st.state === 'lost' || st.state === 'won') break;
  await step();
}
log('    run state:', JSON.stringify(await Promise.all([A, B].map((p) => p.evaluate(() => window.__battle.sim.tryout.players.map((x) => ({ win: x.win, gone: x.gone, picks: x.picks })))))));
const atPick = await Promise.all([A, B].map((p) => p.waitForFunction(() => window.__battle.sim.tryout.players.every((x) => x.win === 'pick'), null, { timeout: 60000 }).then(() => true).catch(() => false)));
check(atPick.every(Boolean), `both players' picks open after wave 4 (${JSON.stringify(last)})`);
await Promise.all([A, B].map((p) => p.waitForSelector('[data-testid="ty-pick"]:not([hidden])', T).catch(() => null)));
if (shotsDir) await B.screenshot({ path: `${shotsDir}/tycoop-pick-guest-${W}x${H}.png` });
const offers = await Promise.all([A, B].map((p) => p.evaluate(() => window.__battle.sim.tryout.players.map((x) => JSON.stringify(x.offer)))));
check(offers[0][0] === offers[1][0] && offers[0][1] === offers[1][1], 'both clients show the same two offers');
check(offers[0][0] !== offers[0][1], 'each player has their own offer');
await A.click('[data-testid="ty-card-0"]', T);
const partner = await B.waitForFunction(() => /✓/.test(document.querySelector('[data-testid="ty-partner"]')?.textContent || ''), null, T).then(() => true).catch(() => false);
check(partner, 'the guest\'s sheet says the partner has picked');
const waits = await A.evaluate(() => window.__battle.sim.tryoutWindowOpen());
check(waits, 'the wave waits while the guest still chooses');
await B.click('[data-testid="ty-card-0"]', T);
const closed = await Promise.all([A, B].map((p) => p.waitForFunction(() => !window.__battle.sim.tryoutWindowOpen(), null, T).then(() => true).catch(() => false)));
check(closed.every(Boolean), 'both windows close once both picked');
await A.waitForTimeout(1500);
const state = await Promise.all([A, B].map((p) => p.evaluate(() => ({ squads: window.__battle.sim.tryout.players.map((x) => x.squad.join(',')), picks: window.__battle.sim.tryout.players.map((x) => x.picks.length), tick: window.__battle.coop?.tick }))));
check(JSON.stringify(state[0].squads) === JSON.stringify(state[1].squads) && state[0].picks.join() === '1,1', `both clients agree on the squads (${JSON.stringify(state[0].squads)})`);
const desync = await Promise.all([A, B].map((p) => p.evaluate(() => (window.__battle.coop?.lockstep?.desynced ?? false))));
check(!desync.some(Boolean), 'no desync reported');
await ctx.close();
await browser.close();
await server.close();
if (errors.length) for (const e of errors.slice(0, 15)) log(`  error: ${e}`);
check(errors.length === 0, 'no console errors');
log(failures.length ? `\n${failures.length} check(s) failed` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);

// Tryout Day in a two-tab co-op room (local adapter; docs/specs/TRYOUT_DAY.md §11, M1):
//   the host turns Tryout Day on, both tabs pick 3 of their six and a hero, the host starts; both battles show the run
//   UI and built the same run, each tab's bar its own squad. §20.7: the host's run panel has Half · Full · Extended Day
//   (the host's ladder: a Full Day cleared here) and the Random Class switch with its help line; the guest sees both
//   read-only. The host sets both, the run starts as an Extended Day in Random Class (each three drawn), and the
//   first pick's reveal shows on both screens and lands by itself, the same on both.
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
/** A screenshot (not a check): its tab comes to the front first; a frame that will not settle under load is logged. */
const snap = async (page, name, o = {}) => {
  if (!shotsDir) return;
  await page.bringToFront().catch(() => {});
  await page.screenshot({ path: `${shotsDir}/${name}-${W}x${H}.png`, timeout: 60000, ...o }).catch((e) => log(`  (shot ${name} skipped: ${e.message.split('\n')[0]})`));
};

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/?online=local&onboarding=0`;
// two tabs in one window: neither may be throttled as a background tab (the host would mark the guest gone)
const { browser, label } = await launchChromium({ args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
log(`browser: ${label}`);
const errors = [];
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: 'reduce' });

async function maybeName(page, name) {
  // (the name prompt can come late on a slow phone-size tab: wait for it or for the room, whichever shows first)
  await page.waitForFunction(() => document.querySelector('[data-testid="name-input"]') || window.__coop, null, { timeout: 30000 }).catch(() => {});
  const input = await page.$('[data-testid="name-input"]');
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
  // (§20.7: the host has cleared a Full Day, so the host's ladder opens Extended Day; test-only counters)
  store.profile.missions = store.profile.missions || {};
  store.profile.missions.counters = { ...(store.profile.missions.counters || {}), 'ty:half': 1, 'ty:full': 1 };
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
const paired = await B.waitForFunction(() => window.__coop?.paired, null, { timeout: 90000 }).then(() => true).catch(() => false);
if (!paired) {
  const dump = async (p) => p.evaluate(() => ({ hash: location.hash, screen: document.querySelector('#app')?.dataset.screen, modal: document.querySelector('.modal-overlay')?.innerText?.slice(0, 120), coop: window.__coop ? { phase: window.__coop.phase, paired: window.__coop.paired, peer: !!window.__coop.peer } : null }));
  log('    host:', JSON.stringify(await dump(A)));
  log('    guest:', JSON.stringify(await dump(B)));
}
check(paired, 'the guest pairs with the host');
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
// M3: the run panel in the kit: girl tiles, the Grade segRow (a locked Grade says why), map and length options
const panel = await A.evaluate(() => {
  const run = document.querySelector('[data-testid="coop-run"]');
  return {
    tiles: run.querySelectorAll('[data-testid="coop-run-girl"].ui-girltile').length,
    picked: run.querySelectorAll('[data-testid="coop-run-girl"].ui-girltile.sel').length,
    grades: run.querySelectorAll('[data-testid="coop-run-grade"] > .ui-opt').length,
    locked: run.querySelectorAll('[data-testid="coop-run-grade"] > .ui-opt.locked').length,
    maps: run.querySelectorAll('[data-testid="coop-run-map"] .ty-map').length,
    lengths: run.querySelectorAll('[data-testid="coop-run-length"] > .ui-opt').length,
    heroes: run.querySelectorAll('[data-testid="coop-run-hero"] .ui-opt').length,
    scroll: document.documentElement.scrollWidth <= innerWidth + 1,
  };
});
check(panel.tiles === 6 && panel.picked === 3, `the host's six are girl tiles, three selected (${JSON.stringify(panel)})`);
check(panel.grades === 12 && panel.locked >= 1 && panel.maps === 2 && panel.lengths === 3 && panel.heroes >= 1, `Grades as a segRow, map and length as options (${JSON.stringify(panel)})`);
await A.click('[data-testid="coop-run-grade-12"]');
check(await A.waitForFunction(() => /Grade 12/.test([...document.querySelectorAll('.toast-host .toast')].map((t) => t.textContent).join(' ')), null, { timeout: 5000 }).then(() => true).catch(() => false)
  && await A.evaluate(() => window.__coop.tryout.grade === 1), 'a locked Grade tap says why and changes nothing');
check(panel.scroll, 'no horizontal scroll in the room');
const guestPanel = await B.evaluate(() => ({ tiles: document.querySelectorAll('[data-testid="coop-run-girl"].ui-girltile').length, grades: document.querySelectorAll('[data-testid="coop-run-grade"]').length, map: document.querySelectorAll('[data-testid="coop-run-map"] .ty-map').length }));
check(guestPanel.tiles === 6 && guestPanel.grades === 0 && guestPanel.map === 1, `the guest's panel: their six, the host's map, no Grade row (${JSON.stringify(guestPanel)})`);
// §20.7: the options in the host's panel (the host's ladder), read-only for the guest
const hostOpts = await A.evaluate(() => ({
  lengths: [...document.querySelectorAll('[data-testid="coop-run-length"] > .ui-opt')].map((e) => `${e.dataset.id}${e.classList.contains('locked') ? ':locked' : ''}`).join(),
  random: !!document.querySelector('[data-testid="coop-run-random"]'),
  help: document.querySelector('[data-testid="coop-run-random-help"]')?.textContent || '',
  ro: !!document.querySelector('[data-testid="coop-run-options"]'),
}));
check(hostOpts.lengths === 'half,full,after' && hostOpts.random && /striker/.test(hostOpts.help) && /Control or Support/.test(hostOpts.help) && !hostOpts.ro,
  `the host's panel: Half · Full · Extended Day open on the host's ladder, the Random Class switch and its help line (${JSON.stringify(hostOpts)})`);
const guestOpts = async () => B.evaluate(() => ({
  length: document.querySelector('[data-testid="coop-run-length-ro"]')?.dataset.length || null,
  random: document.querySelector('[data-testid="coop-run-random-ro"]')?.dataset.on || null,
  controls: document.querySelectorAll('[data-testid="coop-run-random"], [data-testid="coop-run-length"]').length,
}));
const g0 = await guestOpts();
check(g0.length === 'half' && g0.random === 'false' && g0.controls === 0, `the guest sees the run's length and Random Class read-only, no controls (${JSON.stringify(g0)})`);
// the round trip: the host sets Extended Day and Random Class; the guest sees both, read-only; the run starts with them
await A.click('[data-testid="coop-run-length-after"]', T);
await A.click('[data-testid="coop-run-random"]', T);
const kept = await A.waitForFunction(() => window.__coop.tryout?.length === 'after' && window.__coop.tryout?.random === true, null, T).then(() => true).catch(() => false);
check(kept && await A.evaluate(() => document.querySelector('[data-testid="coop-run-random"]')?.getAttribute('aria-pressed') === 'true'
  && document.querySelector('[data-testid="coop-run-length-after"]')?.getAttribute('aria-checked') === 'true'), 'the room keeps the host\'s Extended Day and Random Class');
const got = await B.waitForFunction(() => document.querySelector('[data-testid="coop-run-length-ro"]')?.dataset.length === 'after'
  && document.querySelector('[data-testid="coop-run-random-ro"]')?.dataset.on === 'true', null, T).then(() => true).catch(() => false);
check(got, 'the guest sees Extended Day and Random Class from the host, read-only');
check(await B.evaluate(() => document.querySelectorAll('.ty-coop-six.random [data-testid="coop-run-girl"][aria-disabled="true"]').length === 6
  && !document.querySelector('[data-testid="coop-run-redraw"]')), 'Random Class: the guest\'s six show, not pickable, no Redraw');
check(await A.evaluate(() => document.querySelectorAll('.ty-coop-six.random [data-testid="coop-run-girl"][aria-disabled="true"]').length === 6), 'Random Class: the host\'s six show, not pickable');
await snap(A, 'tycoop-room-host-random', { fullPage: true });
await snap(B, 'tycoop-room-guest-random', { fullPage: true });
await clearModal(B);
await B.click('[data-testid="coop-ready"]', T);
check(await A.waitForFunction(() => window.__coop?.canStart, null, T).then(() => true).catch(() => false), 'the host can start once the guest is ready (Random Class: no drafts needed)');
await A.click('[data-testid="coop-start"]', T);
const ready = (p) => p.waitForFunction(() => window.__battle?.ui?.tryoutUi && !document.documentElement.dataset.tx, null, { timeout: 240000, polling: 250 }).then(() => true).catch(() => false);
const [ra, rb] = await Promise.all([ready(A), ready(B)]);
check(ra && rb, 'both battles mount with the run UI');

// both clients built the same run: an Extended Day in Random Class, each player's three drawn by the Sim
const runs = await Promise.all([A, B].map((p) => p.evaluate(() => {
  const ty = window.__battle.sim.tryout;
  return { seed: ty.seed, map: ty.mapId, length: ty.length, random: ty.random === true, squads: ty.players.map((x) => x.squad.join(',')), seats: JSON.stringify(ty.seats.blocks[0]) };
})));
check(JSON.stringify(runs[0]) === JSON.stringify(runs[1]), `both clients built the same run (${runs[0].map} · ${JSON.stringify(runs[0].squads)})`);
check(runs[0].length === 'after' && runs[0].random, `the run is an Extended Day in Random Class (${runs[0].length}, random ${runs[0].random})`);
check(runs[0].squads.every((q) => q.split(',').length === 3), 'each player starts with their 3 drawn girls');
const ui = await Promise.all([A, B].map((p) => p.evaluate(() => !!document.querySelector('[data-testid="ty-tracker"]') && !!document.querySelector('[data-testid="ty-chip-a_hearts"]'))));
check(ui.every(Boolean), 'both trackers show Full Hearts');
const mine = await Promise.all([A, B].map((p) => p.evaluate(() => [...window.__battle.sim.loadout.keys()].join(','))));
check(mine[0] === runs[0].squads[0] && mine[1] === runs[0].squads[1], 'each tab\'s bar holds its own squad');

// to the first pick: each player places her hero and girls (ui.act, the tower bar's commands), the host sets 3× and
// Auto, and the lockstep is pumped (as e2e/coop-freeplay.mjs does) until the pick opens; then the game runs at its
// own pace so the reveal shows on both screens and lands by itself, on the same card on both
for (const p of [A, B]) {
  await p.evaluate(() => {
    window.__sawReveal = false;
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="ty-reveal"]') && !document.querySelector('[data-testid="ty-pick"]')?.hidden) window.__sawReveal = true;
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  });
}
const placeAll = (p) => p.evaluate(() => {
  const { sim, ui, coop } = window.__battle;
  const slot = coop.lockstep.mySlot;
  const ids = [sim.heroConfigs?.[slot]?.unitId, ...sim.tryout.players[slot].squad].filter(Boolean);
  const spots = [];
  for (let y = 0.55; y < sim.map.height; y += 0.35) for (let x = 0.55; x < sim.map.width; x += 0.35) if (!sim.placementReason('kage', x, y)) spots.push([x, y, sim.placement.pathDistance(x, y)]);
  spots.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  const mineSpots = spots.filter((_, i) => i % 2 === slot);
  let k = 0;
  for (const id of ids) {
    for (; k < mineSpots.length; k++) {
      const [x, y] = mineSpots[k];
      if (sim.canPlace(id, x, y).ok) { ui.act.place(id, x, y); k += 3; break; }
    }
  }
  return ids.length;
});
await Promise.all([placeAll(A), placeAll(B)]);
const pump = (page, on, host = false) => page.evaluate(([run, isHost]) => {
  clearInterval(window.__tyPump);
  window.__tyPump = 0;
  if (!run) return;
  window.__tyPump = setInterval(() => {
    const ls = window.__battle?.coop?.lockstep;
    if (!ls || ls.finished) return;
    // (the host sets 1× again once wave 4 runs: the reveal after it is a 2 s show at the game's own pace)
    if (isHost && !window.__slowed && window.__battle.sim.wave >= 4) {
      window.__slowed = true;
      ls.queue('speed', [1]);
    }
    // (stop pumping once a pick is open: the reveal then runs at the game's own pace)
    if (window.__battle.sim.tryoutWindowOpen()) return;
    for (let i = 0; i < 3; i++) ls.advance(0.05);
  }, 4);
}, [on, host]);
await A.evaluate(() => {
  const { ui, coop } = window.__battle;
  coop.lockstep.queue('speed', [3]);
  ui.setAutoStart?.(true);
  ui.startWave();
});
await Promise.all([pump(A, true, true), pump(B, true)]);
const pickOpen = (p) => p.waitForFunction(() => window.__battle?.sim?.tryout?.players.some((x) => x.win === 'pick'), null, { timeout: 600000, polling: 200 }).then(() => true).catch(() => false);
const [oa, ob] = await Promise.all([pickOpen(A), pickOpen(B)]);
check(oa && ob, `the first pick opens on both (wave ${await A.evaluate(() => window.__battle.sim.wave)})`);
const landed = (p) => p.waitForFunction(() => window.__battle.sim.tryout.players.every((x) => x.picks.length >= 1 && x.win !== 'pick'), null, { timeout: 120000, polling: 200 }).then(() => true).catch(() => false);
const [la, lb] = await Promise.all([landed(A), landed(B)]);
await Promise.all([pump(A, false), pump(B, false)]);
const seen = await Promise.all([A, B].map((p) => p.evaluate(() => window.__sawReveal)));
check(seen.every(Boolean), `the Random Class reveal shows on both screens (${seen})`);
check(la && lb, 'both picks land by themselves (no tap)');
const picks = await Promise.all([A, B].map((p) => p.evaluate(() => JSON.stringify(window.__battle.sim.tryout.players.map((x) => x.picks.map((k) => k.girl || k.card || k.varsity))))));
check(picks[0] === picks[1], `both clients drew the same picks (${picks[0]})`);
await snap(B, 'tycoop-battle-guest');
await ctx.close();
await browser.close();
await server.close();
if (errors.length) for (const e of errors.slice(0, 15)) log(`  error: ${e}`);
check(errors.length === 0, 'no console errors');
log(failures.length ? `\n${failures.length} check(s) failed` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);

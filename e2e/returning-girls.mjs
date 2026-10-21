// End-to-end check of the returning girls (track 5): a profile that owns all nine.
//   1. The girls list and each new girl's student page render (no "null"/"undefined"/"NaN").
//   2. A battle with six of them (Fuu, Hana, Ruri, Noa, Iroha, Ena) and Seiran: each tower is placed
//      and bought to tier 3 with her panel's buy button; Iroha is aimed through aim mode (Set aim →
//      a tap on the map → her mirror panel moves), then Auto; Seiran levels to 3 and is aimed too.
//   3. One battle each with Kanna and Yoriko as the hero, levelled to 3 with their ult fired.
// Screenshots (girls list, every new girl's page, a battle with several of them) at 844×390 and
// 1280×720 go to --shots <dir>.
//
//   node e2e/returning-girls.mjs [--shots /tmp/shots]
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
const TOWERS = ['fuu', 'hana', 'ruri', 'noa', 'iroha', 'ena'];
const HEROES = ['seiran', 'kanna', 'yoriko'];
const profile = save.createProfile();
for (const id of [...TOWERS, ...HEROES]) profile.units[id] = { ...save.newUnitState(), level: 40, breakthrough: 3 };
profile.formation = { ...(profile.formation || {}), towers: TOWERS, hero: 'seiran' };
profile.progress.stages['1-1'] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
profile.settings = { ...profile.settings, autoStart: false };
const saveText = JSON.stringify(profile);

const { browser, label } = await launchChromium();
log(`browser: ${label}`);
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await context.addInitScript(([key, text]) => {
  if (!sessionStorage.getItem('rg-e2e-seeded')) {
    localStorage.setItem(key, text);
    sessionStorage.setItem('rg-e2e-seeded', '1');
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
async function snapAll(name) {
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await settle(600);
    const leaked = await page.evaluate(() => (document.body.innerText.match(/\b(null|undefined|NaN|Infinity)\b/g) || []).join(', ')).catch(() => '');
    check(!leaked, `${name} ${w}x${h}: no "null" / "undefined" / "NaN" on screen${leaked ? ` (${leaked})` : ''}`);
    if (shotsDir) await page.screenshot({ path: `${shotsDir}/${name}-${w}x${h}.png`, timeout: 90000 }).catch((e) => log(`    (screenshot: ${String(e.message).split('\n')[0]})`));
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await settle(300);
}

/** Opens a battle on 1-1 with `hero` in the formation and waits for the test hook. */
async function openBattle(hero) {
  // a fresh load of the lobby, the formation's hero set there, then the battle
  await page.goto(base, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 90000 });
  await page.evaluate((h) => {
    const { store } = window.__sakura;
    store.profile.formation.hero = h;
    store.profile.battleSaves = {}; // the last battle saved itself: a battle link would go to prep
    store.commit('formation');
  }, hero);
  await go('#/battle?stage=1-1&difficulty=normal');
  const ok = await page.waitForFunction((h) => window.__battle?.ui?.act && window.__battle.sim.heroConfig?.unitId === h, hero, { timeout: 60000 }).then(() => true, () => false);
  if (!ok) log('    battle state:', await page.evaluate(() => JSON.stringify({ hash: location.hash, hero: window.__battle?.sim?.heroConfig?.unitId, f: window.__sakura.store.profile.formation, modal: document.querySelector('.modal-overlay')?.innerText?.slice(0, 200) })));
  await settle(600);
}

/** Places a girl near the road on a spot visible on screen; returns her uid or null. */
async function placeNear(unitId, minGap = 1.4) {
  return page.evaluate(([id, gap]) => {
    const { sim, ui, renderer } = window.__battle;
    sim.cash = 1e7;
    const barTop = ui.bar?.el?.getBoundingClientRect().top ?? innerHeight;
    for (let y = 0.6; y < sim.map.height; y += 0.3) {
      for (let x = 0.6; x < sim.map.width; x += 0.3) {
        if (!sim.canPlace(id, x, y).ok) continue;
        if (sim.placement.pathDistance(x, y) > 1.8) continue;
        if (sim.towers.some((t) => Math.hypot(t.x - x, t.y - y) < gap)) continue;
        const s = renderer.worldToScreen(x, y, 0);
        if (!s.visible || s.clientY > barTop - 20 || s.clientY < 60) continue;
        const t = ui.act.place(id, x, y);
        if (t) return t.uid;
      }
    }
    return null;
  }, [unitId, minGap]);
}

/** Buys path 0 to tier 3 with the panel's buy button. */
async function buyToTier3(uid) {
  await page.evaluate((u) => window.__battle.ui.select(u), uid);
  await settle(300);
  for (let i = 0; i < 3; i++) {
    const btn = page.locator('[data-testid="buy-0"]').first();
    if (!(await btn.count())) break;
    await btn.click({ force: true });
    await settle(250);
  }
  return page.evaluate((u) => window.__battle.sim.getTower(u)?.tiers.join('-'), uid);
}

/** A tap on the board at world (x, y) (the next tap after Set aim aims her). */
async function tapWorld(x, y) {
  const s = await page.evaluate(([wx, wy]) => window.__battle.renderer.worldToScreen(wx, wy, 0), [x, y]);
  await page.mouse.click(s.clientX, s.clientY);
  await settle(300);
}

try {
  await page.goto(base, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 90000 });

  log('\n--- girls list and the new girls\' pages ---');
  await go('#/students');
  await page.waitForFunction(() => /Kanna/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => null);
  await settle(800);
  const listed = await page.evaluate((names) => names.filter((n) => document.body.innerText.toLowerCase().includes(n.toLowerCase())), ['Kanna', 'Yoriko', 'Seiran', 'Fuu', 'Hana', 'Ruri', 'Noa', 'Iroha', 'Ena']);
  check(listed.length === 9, `the girls list shows all nine (${listed.join(', ')})`);
  await snapAll('girls-list');
  for (const id of [...HEROES, ...TOWERS]) {
    await go(`#/student/${id}`);
    await settle(900);
    const name = await page.evaluate(() => document.querySelector('.mb-show-name')?.textContent || '');
    check(name.length > 1, `${id}: her page shows her name (${name})`);
    await snapAll(`student-${id}`);
  }

  log('\n--- battle: six returning towers + Seiran ---');
  await openBattle('seiran');
  const placed = {};
  for (const id of TOWERS) placed[id] = await placeNear(id);
  for (const id of TOWERS) check(placed[id] != null, `${id} placed`);
  for (const id of TOWERS) {
    if (placed[id] == null) continue;
    const tiers = await buyToTier3(placed[id]);
    check(tiers === '3-0-0', `${id} bought to tier 3 with the panel (${tiers})`);
  }
  const heroUid = await placeNear('seiran', 1.2);
  check(heroUid != null, 'Seiran placed');

  log('\n--- aim mode: Iroha\'s mirror panel ---');
  if (placed.iroha != null) {
    await page.evaluate((u) => window.__battle.ui.select(u), placed.iroha);
    await settle(300);
    const before = await page.evaluate((u) => { const t = window.__battle.sim.getTower(u); return { ox: t.ox, oy: t.oy, x: t.x, y: t.y }; }, placed.iroha);
    await page.locator('[data-testid="aim-set"]').first().click({ force: true });
    await settle(250);
    check(await page.locator('[data-testid="aim-banner"]').isVisible(), 'Set aim shows the "tap the map" banner');
    await tapWorld(before.x + 1.6, before.y + 1.2);
    const after = await page.evaluate((u) => { const t = window.__battle.sim.getTower(u); return { aim: t.aim, ox: t.ox, oy: t.oy }; }, placed.iroha);
    check(!!after.aim && (after.ox !== before.ox || after.oy !== before.oy), `the tap aims her mirror panel (${JSON.stringify(after.aim)})`);
    check(!(await page.locator('[data-testid="aim-banner"]').isVisible()), 'the banner closes after the tap');
    await page.locator('[data-testid="aim-auto"]').first().click({ force: true });
    await settle(250);
    check(await page.evaluate((u) => window.__battle.sim.getTower(u).aim === null, placed.iroha), 'Auto clears her aim');
    // aim again and keep it for the screenshot
    await page.locator('[data-testid="aim-set"]').first().click({ force: true });
    await tapWorld(before.x + 1.2, before.y - 1.2);
  }

  log('\n--- Seiran: level 3, aim, Dragonflight ---');
  const seiran = await page.evaluate(() => {
    const { sim } = window.__battle;
    const h = sim.hero;
    if (!h) return null;
    sim.cash = 1e7;
    while (h.level < 3) if (!sim.buyHeroLevel({ level: h.level + 1, maxPrice: 1e9 })?.ok) break;
    return { level: h.level, uid: h.uid };
  });
  check(seiran && seiran.level >= 3, `Seiran reaches Lv ${seiran?.level}`);
  if (seiran) {
    await page.evaluate((u) => window.__battle.ui.select(u), seiran.uid);
    await settle(300);
    const hasAim = await page.locator('[data-testid="aim-set"]').count();
    check(hasAim > 0, 'Seiran\'s panel has Set aim');
    if (hasAim) {
      await page.locator('[data-testid="aim-set"]').first().click({ force: true });
      const road = await page.evaluate(() => { const p = window.__battle.sim.pathData[0]; const m = p.points[Math.floor(p.points.length / 2)]; return { x: m[0], y: m[1] }; });
      await tapWorld(road.x, road.y);
      check(await page.evaluate((u) => !!window.__battle.sim.getTower(u).aim, seiran.uid), 'Seiran is aimed with a tap');
    }
    await page.evaluate(() => window.__battle.ui.startWave());
    await page.waitForFunction(() => window.__battle.sim.enemies.some((e) => !e.dead), null, { timeout: 60000 }).catch(() => null);
    await settle(1500);
    const fired = await page.evaluate(() => {
      const { sim } = window.__battle;
      sim.hero.ultUnlocked = true;
      sim.hero.ultCooldown = 0;
      return sim.activateUlt();
    });
    check(fired, 'Dragonflight fires');
    await settle(700);
    await page.evaluate(() => window.__battle.ui.select(null));
    await snapAll('battle-returning');
  }

  for (const hero of ['kanna', 'yoriko']) {
    log(`\n--- ${hero} as the hero ---`);
    await openBattle(hero);
    const uid = await placeNear(hero, 1.2);
    check(uid != null, `${hero} placed`);
    const r = await page.evaluate(() => {
      const { sim } = window.__battle;
      const h = sim.hero;
      sim.cash = 1e7;
      while (h.level < 3) if (!sim.buyHeroLevel({ level: h.level + 1, maxPrice: 1e9 })?.ok) break;
      return { level: h.level };
    });
    check(r.level >= 3, `${hero} reaches Lv ${r.level}`);
    await page.evaluate(() => window.__battle.ui.startWave());
    await page.waitForFunction(() => window.__battle.sim.enemies.some((e) => !e.dead && !e.hidden), null, { timeout: 60000 }).catch(() => null);
    await settle(1200);
    const fired = await page.evaluate(() => {
      const { sim } = window.__battle;
      sim.hero.ultUnlocked = true;
      sim.hero.ultCooldown = 0;
      return sim.activateUlt();
    });
    check(fired, `${hero}'s ult fires`);
  }

  check(errors.length === 0, `no console errors${errors.length ? `:\n    ${errors.slice(0, 8).join('\n    ')}` : ''}`);
} catch (e) {
  failures.push(`crashed: ${e.stack || e.message}`);
  log(`  FAIL crashed: ${e.stack || e.message}`);
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  log(`\nFAILED (${failures.length}):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
log('\nALL RETURNING-GIRLS CHECKS PASSED');

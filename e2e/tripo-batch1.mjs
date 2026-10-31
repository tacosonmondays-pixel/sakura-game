// Tripo batch 1 in a battle (docs/art/tripo/batch-1.md) at 844×390 (or --size WxH): Kogane (her Tripo figure with
// Big Yellow beside her), then Norika (her figure and her road barricades), with Suzu's bells on the road and the five
// Gate Response Brigade enemies (trooper, shieldline, gnat, tortoise, badger) walking it next to a slime. Checks that
// the Tripo files are what is drawn (not the procedural stand-ins or the construct family) and that nothing logs an
// error; --shots <dir> saves the battle screenshots.
//
//   node e2e/tripo-batch1.mjs [--shots /tmp/shots] [--size 1280x720]
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 when a check fails.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const shotsDir = opt('shots', null);
const [VW, VH] = String(opt('size', '844x390')).split('x').map(Number);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const IGNORE = [
  /GPU stall due to ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i, /favicon\.ico/i,
  /Failed to load resource: net::ERR_/i,
];
const BRIGADE = ['brigade_trooper', 'brigade_shieldline', 'brigade_gnat', 'brigade_tortoise', 'brigade_badger'];
const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
}

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const base = `http://127.0.0.1:${port}/`;
const save = await server.ssrLoadModule('/src/systems/save.js');

const { browser, label } = await launchChromium();
log(`browser: ${label}`);
const errors = [];

async function battle(hero) {
  log(`\n== battle with ${hero}`);
  const profile = save.createProfile();
  for (const id of ['suzu', 'aoi', 'kogane', 'norika']) profile.units[id] = { ...save.newUnitState(), level: 40, breakthrough: 3 };
  profile.formation = { ...(profile.formation || {}), towers: ['suzu', 'aoi'], hero };
  profile.progress.stages['1-1'] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
  profile.settings = { ...profile.settings, autoStart: false, quality: 'high', camera: 'free' };
  const context = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  await context.addInitScript(([key, text]) => {
    if (!sessionStorage.getItem('tripo-e2e-seeded')) {
      localStorage.setItem(key, text);
      sessionStorage.setItem('tripo-e2e-seeded', '1');
    }
  }, [save.SAVE_KEY, JSON.stringify(profile)]);
  const page = await context.newPage();
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'warning' && /unavailable|disabled/.test(t)) errors.push(`[console] ${t}`);
    if (m.type() === 'error' && !IGNORE.some((re) => re.test(t))) errors.push(`[console] ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  const settle = (ms = 250) => page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, t)))), ms).catch(() => null);
  await page.goto(base, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 90000 });
  await page.evaluate(() => { location.hash = '#/battle?stage=1-1&difficulty=normal'; });
  const ok = await page.waitForFunction((h) => window.__battle?.ui?.act && window.__battle.sim.heroConfig?.unitId === h, hero, { timeout: 90000 }).then(() => true, () => false);
  check(ok, `battle 1-1 opens with ${hero} as the hero`);
  // place the hero, Suzu and Aoi near the road, in view
  const placed = await page.evaluate((ids) => {
    const { sim, ui, renderer } = window.__battle;
    sim.cash = 1e7;
    const out = {};
    for (const [id, a, b] of ids) {
      let done = null;
      for (let y = 0.6; y < sim.map.height - 0.6 && !done; y += 0.25) {
        for (let x = 0.6; x < sim.map.width && !done; x += 0.25) {
          if (!sim.canPlace(id, x, y).ok) continue;
          const d = sim.placement.pathDistance(x, y);
          if (d < a || d > b) continue;
          if (sim.towers.some((t) => Math.hypot(t.x - x, t.y - y) < 1.4)) continue;
          const s = renderer.worldToScreen(x, y, 0);
          if (!s.visible || s.clientY < 90 || s.clientY > innerHeight - 110 || s.clientX < 80 || s.clientX > innerWidth - 80) continue;
          const t = ui.act.place(id, x, y);
          ui.placement?.cancel?.();
          if (t) done = t.uid;
        }
      }
      out[id] = done;
    }
    return out;
  }, [[hero, 0.6, 1.4], ['suzu', 0.6, 1.4], ['aoi', 1.2, 2.4]]);
  check(Object.values(placed).every((u) => u != null), `placed ${JSON.stringify(placed)}`);
  // the Brigade (and a slime, an existing family model, for scale) on the road, tough enough to stay a while
  await page.evaluate((ids) => {
    const { sim } = window.__battle;
    sim._spawnQueue = [];
    const all = [...ids, 'slime_green'];
    all.forEach((id, i) => sim.spawnEnemy(id, { pathIndex: 0, dist: 1.5 + i * 1.6, hpMul: 400 }));
  }, BRIGADE);
  await page.waitForFunction((ids) => {
    const scene = window.__battle.renderer.sceneProbe();
    const seen = new Set();
    scene.traverse((o) => { if (o.name?.startsWith('glb:tripo/')) seen.add(o.name.slice(10)); });
    return ids.every((id) => seen.has(id));
  }, BRIGADE, { timeout: 60000 }).catch(() => null);
  await settle(1500);
  const probeNow = () => page.evaluate(([h, ids]) => {
    const { renderer, sim } = window.__battle;
    const scene = renderer.sceneProbe();
    const tripoEnemies = new Set();
    const meshes = {};
    scene.traverse((o) => {
      if (o.name?.startsWith('glb:tripo/')) tripoEnemies.add(o.name.slice(10));
      if (o.isInstancedMesh && o.name?.startsWith('tripo:')) meshes[o.name] = o.count;
    });
    const t = sim.towers.find((x) => x.unitId === h);
    const model = t ? renderer.towerModel(t.uid) : null;
    return {
      tripoEnemies: [...tripoEnemies].sort(), meshes,
      heroGlb: !!model?.userData?.glb, heroStandIn: !!model?.userData?.standIn,
      bells: sim.traps.filter((x) => !x.strip).length, bars: (t?.bars || []).length,
      enemies: sim.enemies.filter((e) => ids.includes(e.def?.id)).length,
    };
  }, [hero, BRIGADE]);
  const probe = await probeNow();
  log(`  probe ${JSON.stringify(probe)}`);
  check(probe.heroGlb && !probe.heroStandIn, `${hero} is her GLB figure, not the procedural stand-in`);
  check(BRIGADE.every((id) => probe.tripoEnemies.includes(id)), `the five Brigade enemies wear their Tripo models (${probe.tripoEnemies.join(', ')})`);
  if (hero === 'kogane') check(probe.meshes['tripo:big_yellow'] > 0, 'Big Yellow is the Tripo walker');
  if (hero === 'norika') check(probe.bars > 0 && probe.meshes['tripo:norika_barricade'] > 0, `her ${probe.bars} barricades are the Tripo barricade`);
  // start the first wave, then (battle paused) step the sim by hand until Suzu has an armed bell on the road: a
  // SwiftShader frame is too slow to rely on real time. Then draw a few frames and check every bell is a 3D bell.
  const stepped = await page.evaluate(() => {
    const { sim, ui } = window.__battle;
    ui.paused = true;
    if (sim.state === 'prep' || sim.state === 'between') sim.startNextWave();
    let n = 0;
    for (; n < 60 * 60 && !sim.traps.some((t) => !t.strip && t.armed); n++) sim.update(1 / 60);
    return { seconds: Math.round(n / 6) / 10, bells: sim.traps.filter((t) => !t.strip).length };
  });
  log(`  stepped ${stepped.seconds} s of sim: ${stepped.bells} bells`);
  // the bell file is requested the first time a bell is on the board, and a freshly tossed bell is hidden until its
  // throw lands (attack FX, visual time): unpause and wait until the drawn bells match the sim's
  await page.evaluate(() => { window.__battle.ui.paused = false; });
  await page.waitForFunction(() => {
    const { sim, renderer } = window.__battle;
    const bells = sim.traps.filter((t) => !t.strip).length;
    let drawn = 0;
    renderer.sceneProbe().traverse((o) => { if (o.name === 'tripo:suzu_bell') drawn = o.count; });
    return bells > 0 && drawn === bells;
  }, null, { timeout: 30000, polling: 200 }).catch(() => null);
  const p2 = await probeNow();
  log(`  bells ${p2.bells}, drawn ${p2.meshes['tripo:suzu_bell'] || 0}`);
  check(p2.bells > 0, `Suzu laid bells (${p2.bells})`);
  check((p2.meshes['tripo:suzu_bell'] || 0) === p2.bells, `Suzu's ${p2.bells} bells are 3D bells (${p2.meshes['tripo:suzu_bell'] || 0} drawn)`);
  await settle(800);
  if (shotsDir) {
    await page.evaluate(() => document.querySelectorAll('.jn-toast').forEach((e) => e.remove()));
    await page.screenshot({ path: `${shotsDir}/battle-${hero}-${VW}x${VH}.png` });
    // closer: wheel-zoom the camera in on the hero
    const at = await page.evaluate((h) => {
      const { renderer, sim } = window.__battle;
      const t = sim.towers.find((x) => x.unitId === h);
      return renderer.worldToScreen(t.x, t.y, 0.5);
    }, hero);
    await page.mouse.move(at.clientX, at.clientY);
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, -240);
      await settle(80);
    }
    await settle(600);
    log(`  zoom ${JSON.stringify(await page.evaluate(() => window.__battle.renderer.cameraState.zoom))}`);
    await page.screenshot({ path: `${shotsDir}/battle-${hero}-${VW}x${VH}-zoom.png` });
  }
  await context.close();
}

try {
  await battle('kogane');
  await battle('norika');
} catch (e) {
  failures.push(`crash: ${e.message}`);
}
check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 5).join(' | ')}` : ''}`);
await browser.close();
await server.close();
log(failures.length ? `\nFAILED (${failures.length})` : '\nall ok');
process.exit(failures.length ? 1 : 0);

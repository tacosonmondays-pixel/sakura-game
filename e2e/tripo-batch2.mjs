// Tripo batch 2 in a battle (docs/art/tripo/batch-2.md) at 844×390 (or --size WxH): Luna, Yoriko, Nami and Kanna as
// their Tripo figures (one battle each), the twelve family enemies and the six bosses / titans on the road wearing
// their own Tripo models, and the story landmarks (1-6's clock tower and ticket gates, 1-10's dry fountain) swapped
// in for their procedural pieces. No console errors. --shots <dir> saves the battle screenshots.
//
//   node e2e/tripo-batch2.mjs [--shots /tmp/shots] [--size 1280x720]
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
const FAMILY_REPS = ['slime_green', 'goblin_runner', 'orc_grunt', 'ghost_wisp', 'ghoul_bonewalker', 'oni_brute', 'lizard_skink',
  'construct_cogling', 'beast_wolf', 'fae_sprite', 'plant_sprout', 'dragon_wyvern'];
const BOSSES = ['dragon_ashwing', 'fp_eclipse_wyrm', 'fp_gloom_regent', 'fp_hyakki_daimyo', 'iron_colossus', 'fp_foundry_titan'];
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

async function battle(hero, stage, enemies, landmarks) {
  log(`\n== ${stage} with ${hero}`);
  const profile = save.createProfile();
  for (const id of ['aoi', 'luna', 'nami', 'kanna', 'yoriko']) profile.units[id] = { ...save.newUnitState(), level: 40, breakthrough: 3 };
  profile.formation = { ...(profile.formation || {}), towers: ['aoi'], hero };
  for (const ch of [1, 2]) for (let i = 1; i <= 10; i++) profile.progress.stages[`${ch}-${i}`] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
  profile.settings = { ...profile.settings, autoStart: false, quality: 'high', camera: 'free' };
  const context = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  await context.addInitScript(([key, text]) => {
    if (!sessionStorage.getItem('tripo2-e2e-seeded')) {
      localStorage.setItem(key, text);
      sessionStorage.setItem('tripo2-e2e-seeded', '1');
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
  await page.evaluate((st) => { location.hash = `#/battle?stage=${st}&difficulty=normal`; }, stage);
  const ok = await page.waitForFunction((h) => window.__battle?.ui?.act && window.__battle.sim.heroConfig?.unitId === h, hero, { timeout: 90000 }).then(() => true, () => false);
  check(ok, `battle ${stage} opens with ${hero} as the hero`);
  if (!ok) { await context.close(); return; }
  const placed = await page.evaluate((h) => {
    const { sim, ui, renderer } = window.__battle;
    sim.cash = 1e7;
    for (let y = 0.6; y < sim.map.height - 0.6; y += 0.25) {
      for (let x = 0.6; x < sim.map.width; x += 0.25) {
        if (!sim.canPlace(h, x, y).ok) continue;
        const d = sim.placement.pathDistance(x, y);
        if (d < 0.6 || d > 1.4) continue;
        const s = renderer.worldToScreen(x, y, 0);
        if (!s.visible || s.clientY < 90 || s.clientY > innerHeight - 110 || s.clientX < 80 || s.clientX > innerWidth - 80) continue;
        const t = ui.act.place(h, x, y);
        ui.placement?.cancel?.();
        if (t) return t.uid;
      }
    }
    return null;
  }, hero);
  check(placed != null, `${hero} placed`);
  if (enemies.length) {
    await page.evaluate((ids) => {
      const { sim } = window.__battle;
      sim._spawnQueue = [];
      ids.forEach((id, i) => sim.spawnEnemy(id, { pathIndex: 0, dist: 1.2 + i * 1.1, hpMul: 400 }));
    }, enemies);
  }
  const want = enemies;
  await page.waitForFunction(([ids, lm]) => {
    const scene = window.__battle.renderer.sceneProbe();
    const seen = new Set();
    let land = 0;
    scene.traverse((o) => {
      if (o.name?.startsWith('glb:tripo/')) seen.add(o.name.slice(10));
      if (o.name === 'tripo:landmark') land++;
    });
    return ids.every((id) => seen.has(id)) && land >= lm;
  }, [want, landmarks], { timeout: 90000, polling: 500 }).catch(() => null);
  await settle(1200);
  const probe = await page.evaluate(([h]) => {
    const { renderer, sim } = window.__battle;
    const seen = new Set();
    let land = 0;
    renderer.sceneProbe().traverse((o) => {
      if (o.name?.startsWith('glb:tripo/')) seen.add(o.name.slice(10));
      if (o.name === 'tripo:landmark') land++;
    });
    const t = sim.towers.find((x) => x.unitId === h);
    const model = t ? renderer.towerModel(t.uid) : null;
    return { enemies: [...seen].sort(), landmarks: land, heroGlb: !!model?.userData?.glb, heroStandIn: !!model?.userData?.standIn };
  }, [hero]);
  log(`  probe ${JSON.stringify(probe)}`);
  check(probe.heroGlb && !probe.heroStandIn, `${hero} is her GLB figure`);
  if (want.length) check(want.every((id) => probe.enemies.includes(id)), `${want.length} enemies wear their Tripo models (missing: ${want.filter((id) => !probe.enemies.includes(id)).join(', ') || 'none'})`);
  if (landmarks) check(probe.landmarks >= landmarks, `${probe.landmarks} story landmark(s) drawn as Tripo models (want ≥ ${landmarks})`);
  if (shotsDir) {
    await page.evaluate(() => document.querySelectorAll('.jn-toast').forEach((e) => e.remove()));
    await page.screenshot({ path: `${shotsDir}/b2-${stage}-${hero}-${VW}x${VH}.png` });
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
    await page.screenshot({ path: `${shotsDir}/b2-${stage}-${hero}-${VW}x${VH}-zoom.png` });
  }
  await context.close();
}

try {
  await battle('luna', '1-6', FAMILY_REPS, 2); // clock tower + ticket gates
  await battle('yoriko', '1-10', BOSSES, 1); // the dry fountain
  await battle('nami', '1-9', [], 1); // the lock gate
  await battle('kanna', '1-1', [], 0);
} catch (e) {
  failures.push(`crash: ${e.message}`);
}
check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 5).join(' | ')}` : ''}`);
await browser.close();
await server.close();
log(failures.length ? `\nFAILED (${failures.length})` : '\nall ok');
process.exit(failures.length ? 1 : 0);

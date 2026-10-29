// Display polish 2 (display only): two battle reads at phone size (844x390, the default camera).
//   1. Iroha placed 0.8-1.6 tiles from the road with no aim (her relay origin is on her or just in front of her):
//      her mirror panel is drawn beside her, not on her body (whole board, a crop, a zoomed-in close-up, firing).
//   2. Tenka's coilgun reads at the default zoom (whole board, a crop around her, zoomed-in close-ups firing).
// Screenshots (JPEG) go to --shots <dir> with an optional --tag (e.g. before / after). --before skips the checks
// that only hold with the fix (for a capture of the old build).
//
//   node e2e/display-polish-2.mjs [--shots docs/review/display-polish-2] [--tag after] [--before]
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
const tag = opt('tag', 'after');
const before = args.includes('--before');
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
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
const profile = save.createProfile();
for (const id of ['tenka', 'iroha']) profile.units[id] = { ...save.newUnitState(), level: 40, breakthrough: 3 };
profile.formation = { ...(profile.formation || {}), towers: ['tenka', 'iroha'], hero: profile.formation?.hero ?? null };
profile.progress.stages['1-1'] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
profile.settings = { ...profile.settings, autoStart: false, quality: 'high', camera: 'free' };
const saveText = JSON.stringify(profile);

const { browser, label } = await launchChromium();
log(`browser: ${label}`);
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
await context.addInitScript(([key, text]) => {
  if (!sessionStorage.getItem('dp2-e2e-seeded')) {
    localStorage.setItem(key, text);
    sessionStorage.setItem('dp2-e2e-seeded', '1');
  }
  try { sessionStorage.setItem('sakura-beta-gift-shown', '1'); } catch { /* no storage */ }
}, [save.SAVE_KEY, saveText]);
const page = await context.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' && !IGNORE.some((re) => re.test(m.text()))) errors.push(`[console] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const settle = (ms = 250) => page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, t)))), ms).catch(() => null);

async function shot(name, clip = null) {
  if (!shotsDir) return;
  await page.screenshot({ path: `${shotsDir}/${name}.jpg`, type: 'jpeg', quality: 78, ...(clip ? { clip } : {}), timeout: 240000 })
    .catch((e) => log(`    (screenshot: ${String(e.message).split('\n')[0]})`));
}

async function openBattle() {
  await page.goto(base, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 90000 });
  await page.evaluate(() => {
    const { store } = window.__sakura;
    store.profile.battleSaves = {};
    store.commit('formation');
  });
  await page.evaluate(() => { location.hash = '#/battle?stage=1-1&difficulty=normal'; });
  return page.waitForFunction(() => window.__battle?.ui?.act, null, { timeout: 90000 }).then(() => true, () => false);
}

/** Places a girl 0.8-1.6 tiles from the road near the middle of the screen; returns her uid and spot. */
function place(unitId) {
  return page.evaluate((id) => {
    const { sim, ui, renderer } = window.__battle;
    sim.cash = 1e7;
    const barTop = ui.bar?.el?.getBoundingClientRect().top ?? innerHeight;
    let best = null;
    for (let y = 0.6; y < sim.map.height; y += 0.25) {
      for (let x = 0.6; x < sim.map.width; x += 0.25) {
        if (!sim.canPlace(id, x, y).ok) continue;
        const d = sim.placement.pathDistance(x, y);
        if (d < 0.8 || d > 1.6) continue;
        const s = renderer.worldToScreen(x, y, 0);
        if (!s.visible || s.clientY > barTop - 60 || s.clientY < 120) continue;
        const off = Math.hypot(s.clientX - innerWidth / 2, s.clientY - innerHeight / 2);
        if (!best || off < best.off) best = { x, y, off };
      }
    }
    if (!best) return null;
    const t = ui.act.place(id, best.x, best.y);
    ui.placement?.cancel?.();
    ui.select?.(null);
    return t ? { uid: t.uid, x: t.x, y: t.y } : null;
  }, unitId);
}

/** Zooms the free camera at (x, z) (wheel steps). */
async function zoomAt(x, z, steps) {
  const s = await page.evaluate(([wx, wz]) => window.__battle.renderer.worldToScreen(wx, wz, 0), [x, z]);
  await page.mouse.move(s.clientX, s.clientY);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, -240);
    await settle(60);
  }
  await settle(500);
  return page.evaluate(() => window.__battle.renderer.cameraState.zoom);
}

async function boxAround(x, z, w, h) {
  const s = await page.evaluate(([wx, wz]) => window.__battle.renderer.worldToScreen(wx, wz, 0.6), [x, z]);
  const vp = page.viewportSize();
  const x0 = Math.max(0, Math.min(vp.width - w, Math.round(s.clientX - w / 2)));
  const y0 = Math.max(0, Math.min(vp.height - h, Math.round(s.clientY - h / 2)));
  return { x: x0, y: y0, width: w, height: h };
}

try {
  log('\n--- Iroha, no aim (origin on her own spot), 844x390 default camera ---');
  check(await openBattle(), 'battle 1-1 opens');
  await settle(800);
  const ir = await place('iroha');
  check(ir != null, `Iroha placed (${JSON.stringify(ir)})`);
  await page.evaluate(() => window.__battle.renderer.resetCamera());
  await page.waitForFunction((u) => window.__battle.renderer.towerModel(u), ir.uid, { timeout: 60000 }).catch(() => null);
  await settle(900);
  const st = await page.evaluate((u) => {
    const t = window.__battle.sim.getTower(u);
    const pr = window.__battle.renderer.mirrorProbe();
    const panel = (pr.list || []).find((q) => q.uid === u) || null;
    return { x: t.x, y: t.y, ox: t.ox, oy: t.oy, at: panel?.at ?? null };
  }, ir.uid);
  log(`    her spot ${st.x},${st.y} origin ${st.ox},${st.oy} panel drawn at ${JSON.stringify(st.at)}`);
  check(Math.hypot(st.ox - st.x, st.oy - st.y) < 1, 'her un-aimed relay origin is at or just in front of her');
  if (!before) {
    // the default camera looks north (yaw 0): clear of her = 0.4+ tiles to her side, or well in front / behind
    const ok = st.at && (Math.abs(st.at[0] - st.x) >= 0.4 || st.at[1] - st.y >= 1 || st.at[1] - st.y <= -0.35);
    check(ok, `the panel is drawn clear of her body (${st.at ? (st.at[0] - st.x).toFixed(2) : '?'} tiles to her side)`);
  }
  await shot(`iroha-844x390-${tag}`);
  await shot(`iroha-844x390-crop-${tag}`, await boxAround(st.x, st.y, 240, 160));
  const zi = await zoomAt(st.x, st.y, 7);
  log(`    zoom ${zi}`);
  await shot(`iroha-844x390-zoom-${tag}`, await boxAround(st.x, st.y, 420, 300));
  await page.evaluate(() => window.__battle.renderer.resetCamera());
  await settle(300);
  // a wave so she fires from the panel (the flip, glint and flash), then a crop around her
  await page.evaluate((u) => {
    const { sim, ui } = window.__battle;
    ui.startWave();
    for (let k = 0; k < 2400 && sim.getTower(u)?.targetUid == null && sim.state === 'wave'; k++) sim.update(0.25);
  }, ir.uid);
  await zoomAt(st.x, st.y, 7);
  await settle(200);
  await shot(`iroha-844x390-firing-${tag}`, await boxAround(st.x, st.y, 420, 300));

  log('\n--- Tenka, 844x390 default camera ---');
  check(await openBattle(), 'battle 1-1 opens again');
  await settle(800);
  const tk = await place('tenka');
  check(tk != null, `Tenka placed (${JSON.stringify(tk)})`);
  await page.waitForFunction((u) => window.__battle.renderer.towerModel(u)?.userData.glb, tk.uid, { timeout: 60000 }).catch(() => null);
  await page.evaluate(() => window.__battle.renderer.resetCamera());
  await settle(900);
  const gun = await page.evaluate((u) => {
    const m = window.__battle.renderer.towerModel(u);
    let s = null;
    m?.traverse((o) => { if (o.name === 'prop' && o.isMesh) s = { scale: o.scale.x, accent: !!o.children.find((c) => c.name === 'propAccent') }; });
    return s;
  }, tk.uid);
  log(`    coilgun ${JSON.stringify(gun)}`);
  check(gun != null, 'the coilgun hangs on her hand');
  await shot(`tenka-844x390-${tag}`);
  await shot(`tenka-844x390-crop-${tag}`, await boxAround(tk.x, tk.y, 240, 160));
  // she shoots: the muzzle flash at the barrel tip
  await page.evaluate((u) => {
    const { sim, ui } = window.__battle;
    ui.startWave();
    for (let k = 0; k < 2400 && sim.getTower(u)?.targetUid == null && sim.state === 'wave'; k++) sim.update(0.25);
  }, tk.uid);
  await settle(200);
  await zoomAt(tk.x, tk.y, 7);
  const box = await boxAround(tk.x, tk.y, 420, 300);
  for (let i = 0; i < 3; i++) {
    await shot(`tenka-844x390-zoom-${tag}-${i}`, box);
    await settle(30);
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
log('\nALL DISPLAY POLISH 2 CHECKS PASSED');

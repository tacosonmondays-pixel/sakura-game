// Tenka's 3D figure (tenka.glb + the separate tenka-coilgun.glb prop, display only):
//   1. Battle 1-1 at quality high: she is placed, drawn from her full GLB with the coilgun hung on her hand
//      socket (and its outline); a close-up with the free camera zoomed in, at 844x390 and 1280x720.
//   2. Quality low: she is rebuilt from the LOD file, still holds the coilgun, without outlines.
//   3. Her girl page's 3D view.
//   4. The fallback: with tenka.glb blocked she stays the procedural chibi in her palette, no page error.
// Screenshots (JPEG) go to --shots <dir>.
//
//   node e2e/tenka-figure.mjs [--shots docs/review/visual-reworks/tenka]
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
const SIZES = [[844, 390], [1280, 720]];
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
for (const id of ['tenka', 'hikari']) profile.units[id] = { ...save.newUnitState(), level: 40, breakthrough: 3 };
profile.formation = { ...(profile.formation || {}), towers: ['tenka', 'hikari'], hero: profile.formation?.hero ?? null };
profile.progress.stages['1-1'] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
profile.settings = { ...profile.settings, autoStart: false, quality: 'high', camera: 'free' };
const saveText = JSON.stringify(profile);

const { browser, label } = await launchChromium();
log(`browser: ${label}`);

/** A page on a fresh context with the save seeded once; `block` aborts requests whose URL matches it. */
async function openPage(block = null) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  await context.addInitScript(([key, text]) => {
    if (!sessionStorage.getItem('tenka-e2e-seeded')) {
      localStorage.setItem(key, text);
      sessionStorage.setItem('tenka-e2e-seeded', '1');
    }
    try { sessionStorage.setItem('sakura-beta-gift-shown', '1'); } catch { /* no storage */ }
  }, [save.SAVE_KEY, saveText]);
  if (block) await context.route(block, (r) => r.abort());
  const page = await context.newPage();
  const errors = [];
  const warnings = [];
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'warning' && /\[models\]/.test(t)) warnings.push(t);
    if (m.type() === 'error' && !IGNORE.some((re) => re.test(t))) errors.push(`[console] ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  return { context, page, errors, warnings };
}

const { context, page, errors, warnings } = await openPage();
const settle = (p, ms = 250) => p.evaluate((t) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, t)))), ms).catch(() => null);
const go = (p, hash) => p.evaluate((h) => { location.hash = h; }, hash);

async function shot(p, name, clip = null) {
  if (!shotsDir) return;
  await p.screenshot({ path: `${shotsDir}/${name}.jpg`, type: 'jpeg', quality: 80, ...(clip ? { clip } : {}), timeout: 240000 })
    .catch((e) => log(`    (screenshot: ${String(e.message).split('\n')[0]})`));
}

async function openBattle(p) {
  await p.goto(base, { waitUntil: 'load', timeout: 90000 });
  await p.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 90000 });
  await p.evaluate(() => {
    const { store } = window.__sakura;
    store.profile.battleSaves = {};
    store.commit('formation');
  });
  await go(p, '#/battle?stage=1-1&difficulty=normal');
  return p.waitForFunction(() => window.__battle?.ui?.act, null, { timeout: 90000 }).then(() => true, () => false);
}

/**
 * Places a girl near the road on a visible spot close to the middle of the screen, with the nearest road
 * beside her on screen (left or right), so she aims side-on and her coilgun shows; returns her uid or null.
 */
async function placeNear(p, unitId) {
  return p.evaluate((id) => {
    const { sim, ui, renderer } = window.__battle;
    sim.cash = 1e7;
    const barTop = ui.bar?.el?.getBoundingClientRect().top ?? innerHeight;
    const road = sim.pathData.flatMap((pd) => {
      const out = [];
      for (let i = 1; i < pd.points.length; i++) {
        const [ax, ay] = pd.points[i - 1];
        const [bx, by] = pd.points[i];
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.2));
        for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
      }
      return out;
    });
    let best = null;
    for (let y = 0.6; y < sim.map.height; y += 0.25) {
      for (let x = 0.6; x < sim.map.width; x += 0.25) {
        if (!sim.canPlace(id, x, y).ok) continue;
        const d = sim.placement.pathDistance(x, y);
        if (d < 0.8 || d > 1.8) continue;
        const s = renderer.worldToScreen(x, y, 0);
        if (!s.visible || s.clientY > barTop - 60 || s.clientY < 120) continue;
        let near = road[0];
        for (const q of road) if (Math.hypot(q[0] - x, q[1] - y) < Math.hypot(near[0] - x, near[1] - y)) near = q;
        const r = renderer.worldToScreen(near[0], near[1], 0);
        const side = Math.abs(r.clientX - s.clientX) > 2 * Math.abs(r.clientY - s.clientY);
        const off = Math.hypot(s.clientX - innerWidth / 2, s.clientY - innerHeight / 2) + (side ? 0 : 10000);
        if (!best || off < best.off) best = { x, y, off };
      }
    }
    if (!best) return null;
    const t = ui.act.place(id, best.x, best.y);
    ui.placement?.cancel?.();
    return t?.uid ?? null;
  }, unitId);
}

/** How her model is drawn: GLB or procedural, detail level, hand props on sockets and their outlines. */
const probe = (p, uid) => p.evaluate((u) => {
  const m = window.__battle.renderer.towerModel(u);
  if (!m) return null;
  let props = 0;
  let propOutlines = 0;
  m.traverse((o) => {
    if (o.name !== 'prop' || !o.isMesh) return;
    props++;
    propOutlines += o.parent.children.filter((c) => c.userData.isOutline && c.geometry === o.geometry).length;
  });
  return { glb: !!m.userData.glb, detail: m.userData.detail ?? null, standIn: !!m.userData.standIn, props, propOutlines };
}, uid);

/** Zooms the free camera at her (wheel steps). */
async function zoomAt(p, x, z, steps) {
  const s = await p.evaluate(([wx, wz]) => window.__battle.renderer.worldToScreen(wx, wz, 0), [x, z]);
  await p.mouse.move(s.clientX, s.clientY);
  for (let i = 0; i < steps; i++) {
    await p.mouse.wheel(0, -240);
    await settle(p, 60);
  }
  await settle(p, 500);
  return p.evaluate(() => window.__battle.renderer.cameraState.zoom);
}

/** Screen box (CSS px) around her, clamped to the viewport. */
async function boxAround(p, x, z, w, h) {
  const s = await p.evaluate(([wx, wz]) => window.__battle.renderer.worldToScreen(wx, wz, 0.6), [x, z]);
  const vp = p.viewportSize();
  const x0 = Math.max(0, Math.min(vp.width - w, Math.round(s.clientX - w / 2)));
  const y0 = Math.max(0, Math.min(vp.height - h, Math.round(s.clientY - h / 2)));
  return { x: x0, y: y0, width: Math.min(w, vp.width), height: Math.min(h, vp.height) };
}

try {
  log('\n--- battle 1-1, quality high ---');
  check(await openBattle(page), 'battle 1-1 opens');
  await settle(page, 800);
  const uid = await placeNear(page, 'tenka');
  check(uid != null, `Tenka placed (${uid})`);
  const t = await page.evaluate((u) => { const x = window.__battle.sim.getTower(u); return x && { x: x.x, y: x.y }; }, uid);
  await page.waitForFunction((u) => window.__battle.renderer.towerModel(u)?.userData.glb, uid, { timeout: 60000 }).catch(() => null);
  await settle(page, 400);
  const hi = await probe(page, uid);
  check(hi?.glb && hi.detail === 'full' && !hi.standIn, `she is drawn from her full GLB (${JSON.stringify(hi)})`);
  check(hi?.props === 1 && hi.propOutlines === 1, `the coilgun hangs on her hand socket, with its outline (${hi?.props} prop, ${hi?.propOutlines} outline)`);
  await page.evaluate((u) => window.__battle.ui.select(null), uid);
  // idle close-ups (she faces the camera, the coilgun held low at her side)
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => window.__battle.renderer.resetCamera());
    await settle(page, 500);
    log(`    zoom ${await zoomAt(page, t.x, t.y, 7)}`);
    await shot(page, `closeup-${w}x${h}`, await boxAround(page, t.x, t.y, Math.round(w * 0.6), Math.round(h * 0.8)));
  }
  // a wave so she shoots (attack clip + muzzle FX): the whole board, then a burst of close-ups while she fires
  // (the sim is fast-forwarded until she has a target: a loaded machine renders few frames a second)
  const inRange = await page.evaluate((u) => {
    const { sim, ui } = window.__battle;
    ui.startWave();
    for (let k = 0; k < 2400 && sim.getTower(u)?.targetUid == null && sim.state === 'wave'; k++) sim.update(0.25);
    return sim.getTower(u)?.targetUid != null;
  }, uid);
  check(inRange, `she takes aim at a monster${inRange ? '' : ` (${await page.evaluate(() => JSON.stringify({ at: [window.__battle.sim.towers[0]?.x, window.__battle.sim.towers[0]?.y], wave: window.__battle.sim.wave, t: window.__battle.sim.time, paused: window.__battle.ui.paused, enemies: window.__battle.sim.enemies.slice(0, 4).map((e) => [e.x, e.y, e.dead, e.hidden]) }))})`}`);
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => window.__battle.renderer.resetCamera());
    await settle(page, 500);
    await shot(page, `battle-${w}x${h}`);
    await zoomAt(page, t.x, t.y, 7);
    const box = await boxAround(page, t.x, t.y, Math.round(w * 0.6), Math.round(h * 0.8));
    for (let i = 0; i < 3; i++) {
      await shot(page, `attack-${w}x${h}-${i}`, box);
      await settle(page, 40);
    }
  }
  await page.evaluate(() => window.__battle.renderer.resetCamera());
  await page.setViewportSize({ width: 844, height: 390 });

  log('\n--- quality low (a new battle with the Low setting, as a phone player would have it) ---');
  await page.evaluate(() => {
    const { store } = window.__sakura;
    store.profile.settings.quality = 'low';
    store.commit('settings');
    store.saveNow?.();
  });
  check(await openBattle(page), 'battle 1-1 opens on Low');
  await settle(page, 800);
  const luid = await placeNear(page, 'tenka');
  await page.waitForFunction((u) => window.__battle.renderer.towerModel(u)?.userData.glb, luid, { timeout: 60000 }).catch(() => null);
  await settle(page, 600);
  const lo = await probe(page, luid);
  check(lo?.glb && lo.detail === 'lod', `quality low: drawn from her LOD file (${JSON.stringify(lo)})`);
  check(lo?.props === 1 && lo.propOutlines === 0, 'quality low: still holds the coilgun, no outlines');
  const lt = await page.evaluate((u) => { const x = window.__battle.sim.getTower(u); return x && { x: x.x, y: x.y }; }, luid);
  const zl = await zoomAt(page, lt.x, lt.y, 7);
  log(`    zoom ${zl}`);
  await shot(page, 'closeup-low-844x390', await boxAround(page, lt.x, lt.y, 506, 312));
  await page.evaluate(() => {
    const { store } = window.__sakura;
    store.profile.settings.quality = 'high';
    store.commit('settings');
    store.saveNow?.();
  });

  log('\n--- her girl page, 3D view ---');
  await page.evaluate(() => { window.__battle.ui.paused = true; });
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    for (let i = 0; i < 3; i++) {
      await go(page, '#/student/tenka');
      await settle(page, 900);
      const name = await page.evaluate(() => document.querySelector('.mb-show-name')?.textContent || '');
      if (/tenka/i.test(name)) break;
      await page.keyboard.press('Escape').catch(() => null);
    }
    await page.evaluate(() => document.querySelectorAll('.jn-toast').forEach((e) => e.remove()));
    const tab = page.locator('[data-testid="view-3d"]').first();
    if (await tab.count()) await tab.click({ force: true });
    await settle(page, 4000);
    const shown = await page.evaluate(() => ({ hash: location.hash, name: document.querySelector('.mb-show-name')?.textContent || '', d3: !!document.querySelector('.gp-3d canvas, .mb-show-3d canvas') }));
    check(/student\/tenka/.test(shown.hash) && /tenka/i.test(shown.name) && shown.d3, `${w}x${h}: her page shows the 3D figure (${shown.name})`);
    await shot(page, `student-${w}x${h}`);
  }
  check(errors.length === 0, `no console errors${errors.length ? `:\n    ${errors.slice(0, 8).join('\n    ')}` : ''}`);
  check(!warnings.some((w) => /tenka/.test(w)), `no model warnings for her${warnings.length ? ` (${warnings.join(' | ')})` : ''}`);
  await context.close();

  log('\n--- fallback: tenka.glb blocked ---');
  const fb = await openPage(/\/tenka(\.lod)?\.glb/);
  check(await openBattle(fb.page), 'battle 1-1 opens');
  await settle(fb.page, 800);
  const fuid = await placeNear(fb.page, 'tenka');
  await settle(fb.page, 2500);
  const f = await probe(fb.page, fuid);
  check(f && !f.glb && !f.standIn, `without her GLB she is the procedural chibi (${JSON.stringify(f)})`);
  check(fb.warnings.some((w) => /tenka unavailable/.test(w)), 'the failed load is reported as a model warning');
  check(!fb.errors.some((e) => /pageerror/.test(e)), `no page error${fb.errors.length ? ` (${fb.errors.slice(0, 4).join(' | ')})` : ''}`);
  const ft = await fb.page.evaluate((u) => { const x = window.__battle.sim.getTower(u); return x && { x: x.x, y: x.y }; }, fuid);
  await zoomAt(fb.page, ft.x, ft.y, 7);
  await shot(fb.page, 'fallback-844x390', await boxAround(fb.page, ft.x, ft.y, 506, 312));
  await fb.context.close();
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
log('\nALL TENKA FIGURE CHECKS PASSED');

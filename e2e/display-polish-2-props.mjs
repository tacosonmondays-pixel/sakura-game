// Display polish 2, the props' shells (display only) at phone size (844x390, quality high): Kinu's orbit
// scissors and heat ring, Azami's spike strip (its end caps), Chigusa's thorn bed and her vines on a held walker
// (again with the walker left out, as its body hides most of them). The game's frame loop is held and the sim
// and renderer are stepped by hand: Kinu's scissors come from her upgrades and a heat ring is set down by hand,
// Azami lays her own strip, a walker comes up the road to Chigusa and is held there beside a thorn bed set down
// by hand. Then the camera zooms in and a frame plus an enlarged crop (square pixels) is saved.
//
//   node e2e/display-polish-2-props.mjs [--shots docs/review/display-polish-2/props] [--tag after]
//                                       [--only kinu,azami,chigusa]
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 when a check fails.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const shotsDir = opt('shots', null);
const tag = opt('tag', 'after');
const only = opt('only', 'kinu,azami,chigusa').split(',');
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
const GIRLS = ['kinu', 'azami', 'chigusa'];
for (const id of GIRLS) profile.units[id] = { ...save.newUnitState(), level: 40, breakthrough: 3 };
profile.formation = { ...(profile.formation || {}), towers: GIRLS };
profile.progress.stages['1-1'] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
profile.settings = { ...profile.settings, autoStart: false, quality: 'high', camera: 'free' };
const saveText = JSON.stringify(profile);

const { browser, label } = await launchChromium();
log(`browser: ${label}`);
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
await context.addInitScript(([key, text]) => {
  if (!sessionStorage.getItem('dp2p-e2e-seeded')) {
    localStorage.setItem(key, text);
    sessionStorage.setItem('dp2p-e2e-seeded', '1');
  }
  try { sessionStorage.setItem('sakura-beta-gift-shown', '1'); } catch { /* no storage */ }
}, [save.SAVE_KEY, saveText]);
const page = await context.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' && !IGNORE.some((re) => re.test(m.text()))) errors.push(`[console] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const settle = (ms = 250) => page.waitForTimeout(ms);

/** A JPEG of the page (or a clip of it); `enlarge` scales the clip up with square pixels (ImageMagick) to read it. */
async function shot(name, clip = null, enlarge = 1) {
  if (!shotsDir) return null;
  const path = `${shotsDir}/${name}.jpg`;
  await page.screenshot({ path, type: 'jpeg', quality: enlarge > 1 ? 95 : 80, ...(clip ? { clip } : {}), timeout: 240000 })
    .catch((e) => log(`    (screenshot: ${String(e.message).split('\n')[0]})`));
  if (enlarge > 1) {
    const r = spawnSync('convert', [path, '-filter', 'point', '-resize', `${enlarge * 100}%`, '-quality', '85', path]);
    if (r.status !== 0) log(`    (convert: ${String(r.stderr).slice(-200)})`);
  }
  return path;
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

/** Places a girl `near`..`far` tiles from the road near the middle of the screen; returns her uid and spot. */
function place(unitId, near = 0.8, far = 1.6) {
  return page.evaluate(([id, lo, hi]) => {
    const { sim, ui, renderer } = window.__battle;
    sim.cash = 1e7;
    const barTop = ui.bar?.el?.getBoundingClientRect().top ?? innerHeight;
    let best = null;
    for (let y = 0.6; y < sim.map.height; y += 0.25) {
      for (let x = 0.6; x < sim.map.width; x += 0.25) {
        if (!sim.canPlace(id, x, y).ok) continue;
        const d = sim.placement.pathDistance(x, y);
        if (d < lo || d > hi) continue;
        const s = renderer.worldToScreen(x, y, 0);
        if (!s.visible || s.clientY > barTop - 60 || s.clientY < 120) continue;
        const off = Math.hypot(s.clientX - innerWidth / 2, s.clientY - innerHeight / 2);
        if (!best || off < best.off) best = { x, y, off };
      }
    }
    if (!best) return { fail: 'no spot' };
    const t = ui.act.place(id, best.x, best.y);
    ui.placement?.cancel?.();
    ui.select?.(null);
    return t ? { uid: t.uid, x: t.x, y: t.y } : null;
  }, [unitId, near, far]);
}

/** The road point nearest (x, y), from the sim's own path data. */
function roadNear(x, y) {
  return page.evaluate(([px, py]) => {
    const { sim } = window.__battle;
    let best = null;
    for (const p of sim.pathData || []) {
      const pts = p.points;
      for (let i = 0; i + 1 < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[i + 1];
        const dx = bx - ax;
        const dy = by - ay;
        const L = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L));
        const qx = ax + dx * t;
        const qy = ay + dy * t;
        const d = Math.hypot(px - qx, py - qy);
        if (!best || d < best.d) best = { x: qx, y: qy, d };
      }
    }
    return best;
  }, [x, y]);
}

async function boxAround(x, z, w, h, y = 0.2) {
  const s = await page.evaluate(([wx, wz, wy]) => window.__battle.renderer.worldToScreen(wx, wz, wy), [x, z, y]);
  const vp = page.viewportSize();
  const x0 = Math.max(0, Math.min(vp.width - w, Math.round(s.clientX - w / 2)));
  const y0 = Math.max(0, Math.min(vp.height - h, Math.round(s.clientY - h / 2)));
  return { x: x0, y: y0, width: w, height: h };
}

async function zoomAt(x, z, steps) {
  await page.evaluate(() => window.__battle.renderer.resetCamera());
  await frames(10);
  const s = await page.evaluate(([wx, wz]) => window.__battle.renderer.worldToScreen(wx, wz, 0), [x, z]);
  await page.mouse.move(s.clientX, s.clientY);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, -240);
    await frames(6);
  }
  await frames(90);
  await settle(300);
  log(`    camera zoom ${JSON.stringify(await page.evaluate(() => window.__battle.renderer.cameraState.zoom))}`);
}

/** Holds the game's own frame loop (its callbacks wait) so only frames drawn here happen; the sim stands still. */
const hold = () => page.evaluate(() => {
  const { ui } = window.__battle;
  ui.paused = true;
  if (window.__holdLoop) return;
  const raf = window.requestAnimationFrame.bind(window);
  window.__holdLoop = true;
  window.requestAnimationFrame = (cb) => raf(function held(t) {
    if (window.__holdLoop) raf(held);
    else cb(t);
  });
});
/** Draws n renderer frames (1/60 s each of the visual clock) with the sim held. */
const frames = (n = 1) => page.evaluate((k) => { for (let i = 0; i < k; i++) window.__battle.renderer.update(1 / 60); }, n);

const covers = (kind) => page.waitForFunction((k) => window.__battle.renderer.placedPropsProbe()?.covers(k), kind, { timeout: 90000, polling: 100 }).then(() => true, () => false);

async function fresh(who) {
  check(await openBattle(), `battle 1-1 opens (${who})`);
  await settle(800);
  await page.evaluate(() => { window.__battle.ui.placement?.cancel?.(); window.__battle.ui.select?.(null); });
}

try {

  // ---------------------------------------------------------------------------------------------
  if (only.includes('kinu')) {
    log('\n--- Kinu: orbit scissors and her heat ring ---');
    await fresh('kinu');
    const k = await place('kinu', 0.9, 1.6);
    if (!check(k?.uid != null, `Kinu placed (${JSON.stringify(k)})`)) throw new Error('no spot for Kinu');
    await hold();
    const sc = await page.evaluate((u) => {
      const { sim } = window.__battle;
      sim.cash = 1e7;
      for (let i = 0; i < 4; i++) sim.upgradeTower(u, 2); // Pin Cushion → Orbit Scissors
      const t = sim.getTower(u);
      t.rings = t.rings || [];
      t.rings.push({ x: t.x, y: t.y, r: 1.0, max: 2.6, hit: [] }); // a heat ring, held still (paused)
      return t.stats?.ring?.scissors || 0;
    }, k.uid);
    check(sc === 3, `three pairs of orbit scissors (${sc})`);
    check(await covers('heatRing'), 'the ring and scissors are drawn as 3D props');
    await zoomAt(k.x, k.y, 6);
    await shot(`kinu-844x390-${tag}`);
    await shot(`kinu-844x390-zoom-${tag}`, await boxAround(k.x, k.y, 300, 210, 0.1), 2);
  }

  // ---------------------------------------------------------------------------------------------
  if (only.includes('azami')) {
    log('\n--- Azami: a spike strip (its two end caps) ---');
    await fresh('azami');
    const a = await place('azami', 0.8, 1.4);
    if (!check(a?.uid != null, `Azami placed (${JSON.stringify(a)})`)) throw new Error('no spot for Azami');
    await hold();
    // a wave runs (sim stepped by hand) until she has laid a strip and it is armed; then the sim stands still
    const r = await page.evaluate((u) => {
      const { sim, ui } = window.__battle;
      ui.startWave();
      for (let k = 0; k < 60 * 40 && sim.state === 'wave'; k++) {
        sim.update(1 / 60);
        sim.drainEvents();
        const tr = sim.traps.find((q) => q.strip && q.ownerUid === u && q.armed);
        if (tr && !sim.enemies.some((e) => !e.dead && Math.hypot(e.x - tr.x, e.y - tr.y) < 1.2)) return { x: tr.x, y: tr.y, k };
      }
      return null;
    }, a.uid);
    if (!check(r != null, `a strip laid (${JSON.stringify(r)})`)) throw new Error('no strip');
    check(await covers('strip'), 'the strip is drawn as the 3D prop');
    await zoomAt(r.x, r.y, 8);
    await shot(`azami-strip-844x390-${tag}`);
    await shot(`azami-strip-844x390-zoom-${tag}`, await boxAround(r.x, r.y, 200, 130, 0.05), 3);
  }

  // ---------------------------------------------------------------------------------------------
  if (only.includes('chigusa')) {
    log('\n--- Chigusa: a thorn bed and the vines on a held walker ---');
    await fresh('chigusa');
    const c = await place('chigusa', 0.8, 1.6);
    if (!check(c?.uid != null, `Chigusa placed (${JSON.stringify(c)})`)) throw new Error('no spot for Chigusa');
    const r = await roadNear(c.x, c.y);
    await hold();
    // a walker: start the wave and step the sim until one is on the board, then hold it by her vine
    // a walker: the wave runs (sim and renderer stepped by hand, the walker kept alive) until one walks up to the
    // road beside her; there it is held by her vine and a thorn bed lies just behind it
    const held = await page.evaluate(([u, x, y]) => {
      const { sim, ui, renderer } = window.__battle;
      ui.startWave();
      const t = sim.getTower(u);
      let e = null;
      for (let k = 0; k < 60 * 90 && sim.state === 'wave'; k++) {
        for (const q of sim.enemies) q.hp = q.maxHp = 1e9;
        sim.update(1 / 60);
        sim.drainEvents();
        if (k % 15 === 0) renderer.update(0);
        e = sim.enemies.find((q) => !q.dead && Math.hypot(q.x - x, q.y - y) < 0.95);
        if (e && Math.hypot(e.x - x, e.y - y) > 0.75) break;
        e = null;
      }
      if (!e) return null;
      renderer.update(1 / 60);
      t.beds = [{ uid: 990002, x, y, ttl: 999, hits: 4 }];
      e.statuses = e.statuses || {};
      e.statuses.hold = { left: 999, sourceUid: u };
      return { uid: e.uid, x: e.x, y: e.y, t: sim.time };
    }, [c.uid, r.x, r.y]);
    if (!check(held != null, `a walker held (${JSON.stringify(held)})`)) throw new Error('no walker');
    check(await covers('bed'), 'bed and vines are drawn as 3D props');
    const mx = (r.x + held.x) / 2;
    const my = (r.y + held.y) / 2;
    await zoomAt(mx, my, 7);
    await shot(`chigusa-844x390-${tag}`);
    await shot(`chigusa-844x390-zoom-${tag}`, await boxAround(mx, my, 240, 160, 0.15), 3);
    // the walker's body hides most of the tendrils: the same frame with its model left out, to read their shading
    await page.evaluate((u) => {
      const v = window.__battle.renderer.placedPropsProbe()?.actors?.enemies?.get(u);
      v?.model.removeFromParent();
    }, held.uid);
    await frames(2);
    await frames(2);
    await shot(`chigusa-vines-only-844x390-zoom-${tag}`, await boxAround(mx, my, 240, 160, 0.15), 3);
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
log('\nALL DISPLAY POLISH 2 PROPS CHECKS PASSED');

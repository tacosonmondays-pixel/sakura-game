// Display polish 2, the lows (display only) at phone size (844x390, the default camera, quality high):
//   1. Kaede's dash afterimages: the battle is paused and stepped by hand (sim + renderer, 1/60 s each) up to one of
//      her lunges, then frames at +0.02 … +0.18 s are captured: a full frame and a strip of crops around her.
//   2. Ouka's council banner (Rally Banner planted by her): a full frame, a crop and a zoomed-in crop.
//   3. Yoriko's doll at 3x: per-frame doll stage / progress around each attack (logged), checks that the strike never
//      starts before her needle lands and that Extend never skips ahead in one frame; a crop strip of one attack.
// Screenshots (JPEG) go to --shots <dir> with --tag (before / after). --before skips the checks that only hold with
// the fixes.
//
//   node e2e/display-polish-2-lows.mjs [--shots docs/review/display-polish-2/lows] [--tag after] [--before]
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 when a check fails.
import { createServer } from 'vite';
import { mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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
const tmp = join(tmpdir(), `dp2-lows-${process.pid}`);
mkdirSync(tmp, { recursive: true });
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
const GIRLS = ['kaede', 'ouka', 'yoriko'];
for (const id of GIRLS) profile.units[id] = { ...save.newUnitState(), level: 40, breakthrough: 3 };
profile.formation = { ...(profile.formation || {}), towers: GIRLS, hero: profile.formation?.hero ?? null };
profile.progress.stages['1-1'] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
profile.settings = { ...profile.settings, autoStart: false, quality: 'high', camera: 'free' };
const saveText = JSON.stringify(profile);

const { browser, label } = await launchChromium();
log(`browser: ${label}`);
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
await context.addInitScript(([key, text]) => {
  if (!sessionStorage.getItem('dp2l-e2e-seeded')) {
    localStorage.setItem(key, text);
    sessionStorage.setItem('dp2l-e2e-seeded', '1');
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

async function shot(name, clip = null, dir = shotsDir) {
  if (!dir) return null;
  const path = `${dir}/${name}.jpg`;
  await page.screenshot({ path, type: 'jpeg', quality: 80, ...(clip ? { clip } : {}), timeout: 240000 })
    .catch((e) => log(`    (screenshot: ${String(e.message).split('\n')[0]})`));
  return path;
}

/** Side-by-side strip of frames (ImageMagick), under 250 KB. */
function strip(files, out, labels) {
  if (!shotsDir || !files.length) return;
  const a = ['-mode', 'concatenate', '-tile', `${files.length}x1`, '-geometry', '+2+0', '-background', '#1b1b2a'];
  const r = spawnSync('montage', [...(labels ? files.flatMap((f, i) => ['-label', labels[i], f]) : files), ...a, '-pointsize', '12', '-fill', 'white', '-quality', '82', out]);
  if (r.status !== 0) log(`    (montage: ${String(r.stderr).slice(-200)})`);
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
    if (!best) return null;
    const t = ui.act.place(id, best.x, best.y);
    ui.placement?.cancel?.();
    ui.select?.(null);
    return t ? { uid: t.uid, x: t.x, y: t.y } : null;
  }, [unitId, near, far]);
}

async function boxAround(x, z, w, h, y = 0.4) {
  const s = await page.evaluate(([wx, wz, wy]) => window.__battle.renderer.worldToScreen(wx, wz, wy), [x, z, y]);
  const vp = page.viewportSize();
  const x0 = Math.max(0, Math.min(vp.width - w, Math.round(s.clientX - w / 2)));
  const y0 = Math.max(0, Math.min(vp.height - h, Math.round(s.clientY - h / 2)));
  return { x: x0, y: y0, width: w, height: h };
}

async function zoomAt(x, z, steps) {
  const s = await page.evaluate(([wx, wz]) => window.__battle.renderer.worldToScreen(wx, wz, 0), [x, z]);
  await page.mouse.move(s.clientX, s.clientY);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, -240);
    await settle(60);
  }
  await settle(500);
}

/**
 * Pauses the loop and steps sim + renderer by hand until `pred` (evaluated in the page on that step's events)
 * is true, at most `max` steps; fast-forwards in 0.25 s sim steps (events dropped) while `ff` holds.
 */
function stepUntil(fn, arg) {
  return page.evaluate(fn, arg);
}

try {
  // ---------------------------------------------------------------------------------------------
  log('\n--- 1. Kaede: dash afterimages at 844x390 (default camera, paused + stepped by hand) ---');
  check(await openBattle(), 'battle 1-1 opens');
  await settle(800);
  const kd = await place('kaede', 0.9, 1.3);
  check(kd != null, `Kaede placed (${JSON.stringify(kd)})`);
  await page.evaluate(() => window.__battle.renderer.resetCamera());
  await page.waitForFunction((u) => window.__battle.renderer.towerModel(u)?.userData.glb, kd.uid, { timeout: 90000 }).catch(() => null);
  await settle(900);
  const lunge = await stepUntil(async (u) => {
    const { sim, ui, renderer } = window.__battle;
    ui.paused = true;
    ui.startWave();
    const t = () => sim.getTower(u);
    // fast-forward until she has a target that has walked to the front of her (toward the camera)
    for (let k = 0; k < 4000 && sim.state === 'wave'; k++) {
      sim.update(0.05);
      sim.drainEvents();
      const tw = t();
      const e = tw?.targetUid != null ? sim.enemies.find((q) => q.uid === tw.targetUid) : null;
      if (e && e.y > tw.y + 0.3 && tw.cooldown > 0.2) break;
    }
    renderer.update(1 / 60);
    // now by hand, 1/60 s a step, up to her next slash
    for (let k = 0; k < 600; k++) {
      sim.update(1 / 60);
      const hit = sim.events.find((ev) => ev.type === 'attack' && ev.towerUid === u);
      renderer.update(1 / 60);
      if (hit) return { k, kind: hit.kind, target: hit.targetUid };
    }
    return null;
  }, kd.uid);
  check(lunge != null, `a lunge found (${JSON.stringify(lunge)})`);
  const kFiles = [];
  const kLabels = [];
  const kBox = await boxAround(kd.x, kd.y + 0.3, 200, 170);
  const offsets = [1, 3, 5, 8, 11]; // frames after the attack frame (1/60 s each)
  let at = 0;
  for (const f of offsets) {
    await page.evaluate((n) => {
      const { sim, renderer } = window.__battle;
      for (let i = 0; i < n; i++) {
        sim.update(1 / 60);
        renderer.update(1 / 60);
      }
    }, f - at);
    at = f;
    await settle(120);
    const g = await page.evaluate(() => {
      const L = window.__battle.renderer.attackFxProbe();
      return L ? L.stats : null;
    });
    if (f === 3) await shot(`kaede-lunge-844x390-${tag}`);
    kFiles.push(await shot(`k${f}`, kBox, tmp));
    kLabels.push(`+${(f / 60).toFixed(2)} s`);
    void g;
  }
  strip(kFiles.filter(Boolean), `${shotsDir}/kaede-lunge-844x390-strip-${tag}.jpg`, kLabels);

  // ---------------------------------------------------------------------------------------------
  log('\n--- 2. Ouka: her council banner (Rally Banner) at 844x390 ---');
  check(await openBattle(), 'battle 1-1 opens again');
  await settle(800);
  const ok = await place('ouka', 1.4, 2.4);
  check(ok != null, `Ouka placed (${JSON.stringify(ok)})`);
  const planted = await page.evaluate((u) => {
    const { sim } = window.__battle;
    sim.cash = 1e7;
    for (let i = 0; i < 3; i++) sim.upgradeTower(u, 2);
    const t = sim.getTower(u);
    // a banner a little to her right and toward the camera
    sim.setAim(u, t.x + 1.4, t.y + 0.6);
    return t.banners ? t.banners.map((b) => [b.x, b.y]) : null;
  }, ok.uid);
  check(Array.isArray(planted) && planted.length === 1, `a banner planted (${JSON.stringify(planted)})`);
  await page.evaluate(() => window.__battle.renderer.resetCamera());
  await page.waitForFunction(() => window.__battle.renderer.placedPropsProbe()?.covers('banner'), null, { timeout: 90000 }).catch(() => null);
  await settle(1500);
  const covers = await page.evaluate(() => window.__battle.renderer.placedPropsProbe()?.covers('banner'));
  check(covers === true, 'the banner is drawn as the 3D prop');
  const [bx, by] = planted?.[0] || [ok.x, ok.y];
  await shot(`ouka-banner-844x390-${tag}`);
  await shot(`ouka-banner-844x390-crop-${tag}`, await boxAround((bx + ok.x) / 2, (by + ok.y) / 2, 300, 190));
  await zoomAt(bx, by, 7);
  await shot(`ouka-banner-844x390-zoom-${tag}`, await boxAround(bx, by, 300, 220, 0.6));

  // ---------------------------------------------------------------------------------------------
  log('\n--- 3. Yoriko: the doll at 3x, frame by frame ---');
  check(await openBattle(), 'battle 1-1 opens a third time');
  await settle(800);
  const yo = await place('yoriko', 0.9, 1.5);
  check(yo != null, `Yoriko placed (${JSON.stringify(yo)})`);
  await page.evaluate(() => window.__battle.renderer.resetCamera());
  await page.waitForFunction(() => (window.__battle.renderer.companionsProbe()?.actors || []).some((r) => r.marionette), null, { timeout: 90000 }).catch(() => null);
  await settle(600);
  const yBox = await boxAround(yo.x, yo.y, 220, 170, 0.5);
  // 3x: the sim steps 3/60 per frame, the renderer 1/60 at timeScale 3 (as the loop does)
  const trace = await page.evaluate(async (u) => {
    const { sim, ui, renderer } = window.__battle;
    ui.paused = true;
    renderer.setTimeScale?.(3);
    ui.startWave();
    for (let k = 0; k < 4000 && sim.state === 'wave'; k++) {
      sim.update(0.05);
      sim.drainEvents();
      if (sim.getTower(u)?.targetUid != null) break;
    }
    const doll = () => (renderer.companionsProbe()?.actors || []).find((r) => r.uid === u)?.marionette || null;
    const rows = [];
    // her needles in flight: one gone (or dead) since the last frame = a hit landed
    const mine = () => new Set(sim.projectiles.filter((p) => p.ownerUid === u && !p.dead && p.turretUid == null).map((p) => p.uid));
    let flying = mine();
    for (let k = 0; k < 600 && sim.state === 'wave'; k++) {
      for (let j = 0; j < 3; j++) sim.update(1 / 60);
      const evs = sim.events.slice();
      renderer.update(1 / 60);
      const now = mine();
      let hit = false;
      for (const id of flying) if (!now.has(id)) hit = true;
      flying = now;
      const d = doll();
      rows.push({ k, attack: evs.some((ev) => ev.type === 'attack' && ev.towerUid === u), hit, stage: d?.stage ?? null, u: d?.u ?? null });
    }
    return rows;
  }, yo.uid);
  const attacks = trace.filter((r) => r.attack).length;
  log(`    ${trace.length} frames, ${attacks} attacks`);
  // the strike frames vs the hit frames; the largest Extend gain in one frame
  let maxGain = 0;
  let strikeBeforeHit = 0;
  let strikes = 0;
  for (let i = 1; i < trace.length; i++) {
    const a = trace[i - 1];
    const b = trace[i];
    if (a.stage === 'extend' && b.stage === 'extend') maxGain = Math.max(maxGain, b.u - a.u);
    if (b.stage === 'strike' && a.stage !== 'strike') {
      strikes++;
      // a hit of hers within the next 2 frames means the strike began early
      const hitAt = trace.slice(i, i + 4).findIndex((r) => r.hit);
      const hitBefore = trace.slice(Math.max(0, i - 2), i + 1).some((r) => r.hit);
      if (hitAt > 1 && !hitBefore) strikeBeforeHit++;
    }
  }
  log(`    strikes ${strikes}, started 2+ frames before her hit: ${strikeBeforeHit}, largest Extend gain in one frame: ${maxGain.toFixed(2)}`);
  check(strikes > 0, 'the doll struck');
  if (!before) check(maxGain < 0.45, `Extend never skips ahead in one frame (largest gain ${maxGain.toFixed(2)})`);
  // a crop strip of one attack, from the attack frame on (one frame at a time, 3x)
  const yFiles = [];
  const yLabels = [];
  const grabbed = await page.evaluate((u) => {
    const { sim, renderer } = window.__battle;
    for (let k = 0; k < 600 && sim.state === 'wave'; k++) {
      for (let j = 0; j < 3; j++) sim.update(1 / 60);
      const go = sim.events.some((ev) => ev.type === 'attack' && ev.towerUid === u);
      renderer.update(1 / 60);
      if (go) return k;
    }
    return -1;
  }, yo.uid);
  if (grabbed >= 0) {
    for (let f = 0; f < 6; f++) {
      if (f) {
        await page.evaluate(() => {
          const { sim, renderer } = window.__battle;
          for (let j = 0; j < 3; j++) sim.update(1 / 60);
          renderer.update(1 / 60);
        });
      }
      await settle(100);
      const st = await page.evaluate((u) => (window.__battle.renderer.companionsProbe()?.actors || []).find((r) => r.uid === u)?.marionette, yo.uid);
      yFiles.push(await shot(`y${f}`, yBox, tmp));
      yLabels.push(`${st?.stage ?? '?'} ${st?.u ?? ''}`);
    }
    strip(yFiles.filter(Boolean), `${shotsDir}/yoriko-3x-844x390-strip-${tag}.jpg`, yLabels);
  }
  check(errors.length === 0, `no console errors${errors.length ? `:\n    ${errors.slice(0, 8).join('\n    ')}` : ''}`);
} catch (e) {
  failures.push(`crashed: ${e.stack || e.message}`);
  log(`  FAIL crashed: ${e.stack || e.message}`);
} finally {
  await browser.close();
  await server.close();
  rmSync(tmp, { recursive: true, force: true });
}

if (failures.length) {
  log(`\nFAILED (${failures.length}):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
log('\nALL DISPLAY POLISH 2 LOWS CHECKS PASSED');

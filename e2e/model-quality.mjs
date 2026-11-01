// Model quality (docs/art/tripo/model-quality.md): the imported heroes really move their arms (no T-pose) and the
// Green Slime is the glossy jelly with its squash-and-stretch hop, in a real battle.
//
//   1. Battle 1-1 with each re-rigged or rebuilt hero (Luna first) placed beside the road, quality high and medium
//      (LOD file): her skinned body is measured in each clip (idle, walk, attack, cheer, hurt), stepping her animator by
//      hand: the free hand must come down from the T-pose (the skinned mesh around the rest hand drops more than 0.4
//      arm lengths in idle; FREE_ARMS: the arm holding her staff / trident / control bar / paddle / wrench is placed at
//      grip height) and every clip must move her (the skinned vertices travel). A figure that already rests with her
//      arms down (the Blender-built staff, docs/art/tripo/staff-models.md) has no T-pose to leave: her free hand must
//      stay down instead (it never rises more than 0.15 arm lengths).
//   2. Green Slimes on the road (their own model): the body squashes and stretches (height range over the move
//      clip), and the slime family's other slimes still draw.
//   3. The re-rigged batch-2 enemies (docs/art/tripo/enemy-rigs.md), each alone on the road wearing its own model, at
//      each size and their light files at medium: the mesh where their arms really are (tests/models/enemyArms.js) is
//      on the arm bones, and the hands swing in the walk and the special (animator stepped by hand).
//      --enemies orc_grunt,oni_brute picks them, --no-heroes runs only them, --no-enemy-lod skips their medium pass.
//   4. No console errors.
// --shots <dir> saves close-ups (zoomed free camera) per state: <tag>-<who>-<state>-<W>x<H>.png, at 390x844 and
// 1280x720 (or --sizes 844x390,1280x720). --heroes luna,nami picks the heroes (default: every Tripo hero).
//
//   node e2e/model-quality.mjs [--shots /tmp/mq] [--tag after] [--heroes luna] [--medium luna] [--no-checks]
//   node e2e/model-quality.mjs --busy     # frame cost of 40 Green Slimes on the road, quality high and medium
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 when a check fails.
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchChromium } from './browser.mjs';
import { ENEMY_ARMS, ENEMY_LODS } from '../tests/models/enemyArms.js';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const shotsDir = opt('shots', null);
const tag = opt('tag', 'shot');
const noChecks = args.includes('--no-checks');
const SIZES = String(opt('sizes', '390x844,1280x720')).split(',').map((s) => s.split('x').map(Number));
const HEROES = String(opt('heroes', 'luna,nami,kanna,yoriko,kogane,norika')).split(',').filter(Boolean);
// the medium-quality pass (LOD files) at the last size: --medium luna,nami (default: the first hero)
const MEDIUM = String(opt('medium', HEROES[0])).split(',').filter(Boolean);
// the re-rigged batch-2 enemies (--enemies orc_grunt,oni_brute; default: all of them; --enemies none skips them)
let ENEMIES = String(opt('enemies', Object.keys(ENEMY_ARMS).join(','))).split(',').filter((id) => ENEMY_ARMS[id]);
// the moment of each special the close-up shows (seconds; default 0.2: the wind-up near its top)
const SPECIAL_AT = { goblin_runner: 0.33, lizard_skink: 0.15 };
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const IGNORE = [
  /GPU stall due to ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i, /favicon\.ico/i,
  /Failed to load resource: net::ERR_/i,
];
// the arm(s) that hang free in idle (the other holds her prop at grip height)
const FREE_ARMS = { luna: ['L'], nami: ['R'], kanna: ['L', 'R'], yoriko: ['R'], kogane: ['L'], norika: ['L'] };
const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  if (noChecks) { log(`  info ${msg} (${cond ? 'ok' : 'not ok'})`); return cond; }
  log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
}

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const base = `http://127.0.0.1:${port}/`;
const save = await server.ssrLoadModule('/src/systems/save.js');
// enemies switched off for now (glbEnemy TRIPO_PAUSED) wear their family mesh: their own-model checks are skipped
const { TRIPO_PAUSED } = await server.ssrLoadModule('/src/models/glbEnemy.js');
const SLIME_OWN = !TRIPO_PAUSED.includes('slime_green');
const SLIME_GLB = SLIME_OWN ? 'glb:tripo/slime_green' : 'glb:slime';
ENEMIES = ENEMIES.filter((id) => !TRIPO_PAUSED.includes(id));
// models whose face is geometry (docs/art/tripo/slime-goblin-faces.md): it draws, and it is never outlined
const FACES = new Set(['slime_green', 'goblin_runner']);
if (TRIPO_PAUSED.length) console.log(`paused (family mesh, own-model checks skipped): ${TRIPO_PAUSED.join(', ')}`);

const { browser, label } = await launchChromium();
log(`browser: ${label}`);
const errors = [];

async function openBattle(hero, [VW, VH], quality) {
  const profile = save.createProfile();
  for (const id of ['aoi', ...HEROES]) profile.units[id] = { ...save.newUnitState(), level: 40, breakthrough: 3 };
  profile.formation = { ...(profile.formation || {}), towers: ['aoi'], hero };
  profile.settings = { ...profile.settings, autoStart: false, quality, camera: 'free', attackFx: false };
  const context = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  await context.addInitScript(([key, text]) => {
    if (!sessionStorage.getItem('mq-e2e-seeded')) {
      localStorage.setItem(key, text);
      sessionStorage.setItem('mq-e2e-seeded', '1');
    }
  }, [save.SAVE_KEY, JSON.stringify(profile)]);
  const page = await context.newPage();
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'warning' && /unavailable|disabled/.test(t)) errors.push(`[console] ${t}`);
    if (m.type() === 'error' && !IGNORE.some((re) => re.test(t))) errors.push(`[console] ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  await page.goto(base, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 90000 });
  await page.evaluate(() => { location.hash = '#/battle?stage=1-1&difficulty=normal'; });
  const ok = await page.waitForFunction((h) => window.__battle?.ui?.act && window.__battle.sim.heroConfig?.unitId === h, hero, { timeout: 90000 }).then(() => true, () => false);
  return { context, page, ok };
}

const settle = (page, ms = 250) => page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, t)))), ms).catch(() => null);

/** Places the hero beside the road near the middle of the screen; returns her uid. */
async function placeHero(page, hero) {
  return page.evaluate((h) => {
    const { sim, ui, renderer } = window.__battle;
    sim.cash = 1e7;
    let best = null;
    for (let y = 0.6; y < sim.map.height - 0.6; y += 0.25) {
      for (let x = 0.6; x < sim.map.width; x += 0.25) {
        if (!sim.canPlace(h, x, y).ok) continue;
        const d = sim.placement.pathDistance(x, y);
        if (d < 0.7 || d > 1.3) continue;
        const s = renderer.worldToScreen(x, y, 0);
        if (!s.visible) continue;
        const c = Math.hypot(s.clientX - innerWidth / 2, s.clientY - innerHeight * 0.55);
        if (!best || c < best.c) best = { x, y, c };
      }
    }
    if (!best) return null;
    const t = ui.act.place(h, best.x, best.y);
    ui.placement?.cancel?.();
    return t ? t.uid : null;
  }, hero);
}

/** Zooms the free camera in on a world point (x, y = board coords, h = height). */
async function zoomOn(page, x, y, h, clicks = 5) {
  await page.evaluate(() => window.__battle.renderer.resetCamera?.());
  await settle(page, 400);
  for (let i = 0; i < clicks; i++) {
    const at = await page.evaluate(([px, py, ph]) => window.__battle.renderer.worldToScreen(px, py, ph), [x, y, h]);
    await page.mouse.move(at.clientX, at.clientY);
    await page.mouse.wheel(0, -240);
    await settle(page, 60);
  }
  await settle(page, 500);
}

/**
 * Forces the hero's drawn state (the battle always draws 'idle' between attacks): wraps her animate so the actors'
 * per-frame call plays `state`. With sampleMs > 0 it then steps her own animator by hand (frame-rate independent:
 * SwiftShader frames are slow) and measures how far the skinned vertices travel between steps (share of her
 * height), and how far the mesh around each rest hand has come down (median, in arm lengths: 0 = still in the
 * T-pose), the lowest over the samples.
 */
async function heroProbe(page, uid, state, sampleMs = 0) {
  return page.evaluate(async ([u, st, ms]) => {
    const model = window.__battle.renderer.towerModel(u);
    const ud = model.userData;
    if (ud.animate !== ud.__mqWrapped) {
      ud.__mqOrig = ud.animate;
      ud.__mqWrapped = (t, dt) => ud.__mqOrig(t, ud.__mqFreeze ? 0 : dt, ud.__mqState || 'idle');
      ud.animate = ud.__mqWrapped;
    }
    ud.__mqState = st === 'attack' ? 'idle' : st;
    // a sampled run starts clean: 1.2 s of the clip first, so an attack still in flight (the battle was paused in
    // the middle of one) and the crossfade into this state have played out
    if (ms > 0) for (let i = 0; i < 24; i++) ud.animate(0, 0.05);
    if (st === 'attack') ud.playAttack?.();
    let body = null;
    model.traverse((o) => { if (o.isSkinnedMesh && o.name === 'body' && !body) body = o; });
    if (!body) return { skinned: false };
    const Vec3 = body.position.constructor;
    const v = new Vec3();
    // the mesh around each rest hand (bind-pose geometry): how far it comes down, as a share of the arm's length
    // (the bones of the batch-2 Luna dropped 62 degrees while her arms, bound to other bones, stayed in a T-pose)
    // (three's skinning: a bone's world matrix at bind time is boneInverse^-1, the mesh's was bindMatrix, so in
    // geometry space a bone rests at bindMatrix^-1 x boneInverse^-1; applyBoneTransform answers in geometry space too,
    // the 'attached' bind mode keeps bindMatrixInverse = the mesh's current matrixWorld^-1)
    const bindInv = body.bindMatrix.clone().invert();
    const restPos = (k) => new Vec3().setFromMatrixPosition(bindInv.clone().multiply(body.skeleton.boneInverses[k].clone().invert()));
    const pos0 = body.geometry.attributes.position;
    const hands = {};
    for (const side of ['L', 'R']) {
      const ks = body.skeleton.bones.findIndex((b) => b.name === 'upper_arm_' + side);
      const kh = body.skeleton.bones.findIndex((b) => b.name === 'hand_' + side);
      if (ks < 0 || kh < 0) continue;
      const S = restPos(ks);
      const Hd = restPos(kh);
      const l = S.distanceTo(Hd);
      const idx = [];
      for (let i = 0; i < pos0.count; i++) if (v.fromBufferAttribute(pos0, i).distanceTo(Hd) < 0.3 * l) idx.push(i);
      // how far the arm already hangs in the bind pose (shoulder over hand, in arm lengths): ~0 in a T-pose
      hands[side] = { idx, l, hang: (S.y - Hd.y) / l };
    }
    const measure = () => {
      model.updateMatrixWorld(true);
      body.skeleton.update();
      const pos = body.geometry.attributes.position;
      const out = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        body.applyBoneTransform(i, v);
        out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
      }
      const drop = {};
      for (const [side, h] of Object.entries(hands)) {
        const d = h.idx.map((i) => (pos.getY(i) - out[i * 3 + 1]) / h.l).sort((x, y) => x - y);
        drop[side] = d.length ? d[Math.floor(d.length / 2)] : null;
      }
      return { out, drop };
    };
    body.geometry.computeBoundingBox();
    const bb = body.geometry.boundingBox;
    const height = bb.max.y - bb.min.y;
    const a = measure();
    let travel = 0;
    const drops = { L: a.drop.L ?? null, R: a.drop.R ?? null };
    if (ms > 0) {
      const steps = 10;
      let prev = a.out;
      for (let k = 0; k < steps; k++) {
        ud.animate(performance.now() / 1000, ms / steps / 1000);
        const b = measure();
        let mx = 0;
        for (let i = 0; i < prev.length; i += 3) {
          const d = Math.hypot(b.out[i] - prev[i], b.out[i + 1] - prev[i + 1], b.out[i + 2] - prev[i + 2]);
          if (d > mx) mx = d;
        }
        travel = Math.max(travel, mx / height);
        for (const s of ['L', 'R']) if (b.drop[s] != null) drops[s] = Math.min(drops[s] ?? Infinity, b.drop[s]);
        prev = b.out;
      }
    }
    const hang = Object.fromEntries(Object.entries(hands).map(([s, h]) => [s, h.hang]));
    return { skinned: true, travel, drop: drops, hang, detail: ud.detail };
  }, [uid, state, sampleMs]);
}

/** Seconds into each clip the close-up shows (the attack near its strike, the cheer with the arms up). */
const POSE_AT = { idle: 0.45, walk: 0.25, attack: 0.36, cheer: 0.32, hurt: 0.2 };

/** Puts the hero in `state` at `t` seconds of its clip (stepped by hand from a fresh start) and holds it there. */
async function holdPose(page, uid, state, t) {
  await heroProbe(page, uid, state, 0);
  await page.evaluate(([u, st, at]) => {
    const ud = window.__battle.renderer.towerModel(u).userData;
    ud.__mqFreeze = false;
    // let the crossfade finish on the clip, restart it, then step to the moment
    // play out any attack in flight and the crossfade, restart this state's own loop, then step to the moment
    for (let i = 0; i < 24; i++) ud.animate(0, 0.05);
    const clip = { idle: 'idle', walk: 'walk', cheer: 'cheer', hurt: 'hurt' }[st];
    if (st === 'attack') ud.playAttack?.();
    else ud.mixer?._actions?.forEach((a) => { if (a.getClip().name === clip) a.time = 0; });
    const n = Math.max(1, Math.round(at / 0.02));
    for (let i = 0; i < n; i++) ud.animate(0, at / n);
    ud.__mqFreeze = true;
  }, [uid, state, t]);
}

/** Spawns Green Slimes (and two family slimes) around the hero's stretch of road; they creep, so they stay in view. */
async function spawnSlimes(page, nearX, nearY) {
  return page.evaluate(async ([nx, ny]) => {
    const { pointAt } = await import('/src/sim/path.js');
    const { sim } = window.__battle;
    sim._spawnQueue = [];
    // the road distance closest to the hero
    let bestD = 2;
    let bestC = 1e9;
    const path = sim.pathData[0];
    for (let d = 0.5; d < path.length; d += 0.25) {
      const p = pointAt(path, d);
      const c = Math.hypot(p.x - nx, p.y - ny);
      if (c < bestC) { bestC = c; bestD = d; }
    }
    const ids = ['slime_green', 'slime_green', 'slime_gold', 'slime_green'];
    const out = [];
    ids.forEach((id, i) => {
      const e = sim.spawnEnemy(id, { pathIndex: 0, dist: Math.max(0.5, bestD - 0.9 + i * 0.6), hpMul: 1e7 });
      if (e) { e.baseSpeed = 0.03; out.push(e.uid); }
    });
    return { uids: out, dist: bestD, off: +bestC.toFixed(2) };
  }, [nearX, nearY]);
}

/**
 * The first Green Slime's move clip, stepped by hand (frame-rate independent) over one hop: the skinned body's
 * height and width range (share of the largest), the model file and the body material.
 */
async function slimeProbe(page) {
  return page.evaluate(() => {
    let model = null;
    window.__battle.renderer.sceneProbe().traverse((o) => { if (!model && o.name === 'enemy:slime_green') model = o; });
    if (!model) return null;
    let body = null;
    let file = null;
    model.traverse((o) => { if (o.isSkinnedMesh && o.name === 'body' && !body) body = o; if (o.name?.startsWith('glb:')) file = o.name.slice(4); });
    if (!body) return { file, skinned: false };
    const heights = [];
    const widths = [];
    const Vec3 = body.position.constructor;
    const v = new Vec3();
    for (let k = 0; k < 24; k++) {
      model.userData.animate(k * 0.05, 0.05, { moving: true, speed: 1 });
      model.updateMatrixWorld(true);
      body.skeleton.update();
      const pos = body.geometry.attributes.position;
      let lo = 1e9; let hi = -1e9; let wl = 1e9; let wh = -1e9;
      for (let i = 0; i < pos.count; i += 3) {
        v.fromBufferAttribute(pos, i);
        body.applyBoneTransform(i, v);
        lo = Math.min(lo, v.y); hi = Math.max(hi, v.y);
        wl = Math.min(wl, v.x); wh = Math.max(wh, v.x);
      }
      heights.push(hi - lo);
      widths.push(wh - wl);
    }
    const hr = (Math.max(...heights) - Math.min(...heights)) / Math.max(...heights);
    const wr = (Math.max(...widths) - Math.min(...widths)) / Math.max(...widths);
    const mat = body.material;
    let face = null;
    model.traverse((o) => { if (o.isMesh && o.name === 'face') face = o; });
    return {
      file, skinned: true, heightRange: +hr.toFixed(3), widthRange: +wr.toFixed(3), material: mat.type, jelly: /jelly/.test(mat.customProgramCacheKey?.() || ''),
      face: !!face && face.visible && !face.userData.isOutline && !face.material?.userData?.outline,
    };
  });
}

/**
 * Saves a screenshot; with `at` (a board point { x, y, h }, or { enemy: uid } for an enemy where it stands now) also
 * a JSON beside it with that point's screen position, so a board can crop around the model.
 */
async function shot(page, who, state, VW, VH, at = null) {
  if (!shotsDir) return;
  await page.evaluate(() => document.querySelectorAll('.jn-toast').forEach((e) => e.remove()));
  const name = `${shotsDir}/${tag}-${who}-${state}-${VW}x${VH}`;
  await page.screenshot({ path: `${name}.png` });
  if (at) {
    const sp = await page.evaluate((a) => {
      const { sim, renderer } = window.__battle;
      let p = a;
      if (a.enemy != null) {
        const e = sim.enemies.find((x) => x.uid === a.enemy);
        p = e ? { x: e.x, y: e.y, h: 0.2 } : null;
      }
      if (!p) return null;
      const s = renderer.worldToScreen(p.x, p.y, p.h ?? 0.4);
      return { x: Math.round(s.clientX), y: Math.round(s.clientY) };
    }, at);
    if (sp) writeFileSync(`${name}.json`, JSON.stringify(sp));
  }
}

async function slimeShots(page, slimeInfo, VW, VH, quality) {
  log(`  slimes ${JSON.stringify(slimeInfo)}`);
  const sp = await page.evaluate((uids) => {
    const e = window.__battle.sim.enemies.find((x) => x.uid === uids[0] && !x.dead);
    return e ? { x: e.x, y: e.y } : null;
  }, slimeInfo?.uids || []);
  check(!!sp, 'the Green Slimes are on the road');
  if (!sp) return;
  const tagQ = quality === 'high' ? '' : `-${quality}`;
  await zoomOn(page, sp.x, sp.y, 0.2, VW < 600 ? 7 : 8);
  await shot(page, `slime${tagQ}`, 'move', VW, VH, { enemy: slimeInfo.uids[0] });
  const m = await slimeProbe(page);
  log(`  slime move ${JSON.stringify(m)}`);
  if (m && !SLIME_OWN) log('  (slime_green paused: on its family mesh, own-model checks skipped)');
  if (m && SLIME_OWN) {
    check(/^tripo\/slime_green/.test(m.file || ''), `the Green Slime wears its own model (${m.file})`);
    check(m.skinned && m.heightRange > 0.15 && m.widthRange > 0.05, `the Green Slime squashes and stretches as it hops (height range ${(m.heightRange * 100).toFixed(0)}%, width ${(m.widthRange * 100).toFixed(0)}%)`);
    check(m.jelly, 'the Green Slime wears the glossy jelly material');
    check(m.face, 'the Green Slime draws its face mesh, never outlined');
  }
  // a hit, then its special
  await page.evaluate(() => {
    window.__battle.renderer.sceneProbe().traverse((o) => { if (o.name === 'enemy:slime_green') o.userData.hitFlash?.(null, 0.6); });
  });
  await settle(page, 60);
  await shot(page, `slime${tagQ}`, 'hit', VW, VH, { enemy: slimeInfo.uids[0] });
  await settle(page, 600);
  await page.evaluate(() => {
    window.__battle.renderer.sceneProbe().traverse((o) => { if (o.name === 'enemy:slime_green') o.userData.playSpecial?.(); });
  });
  await settle(page, 220);
  await shot(page, `slime${tagQ}`, 'special', VW, VH, { enemy: slimeInfo.uids[0] });
}

async function heroRun(hero, size, quality, { slimes = false } = {}) {
  const [VW, VH] = size;
  log(`\n== ${hero} at ${VW}x${VH} (${quality})${slimes ? ' + slimes' : ''}`);
  const { context, page, ok } = await openBattle(hero, size, quality);
  check(ok, `battle 1-1 opens with ${hero}`);
  if (!ok) { await context.close(); return; }
  const uid = await placeHero(page, hero);
  check(uid != null, `${hero} placed`);
  if (uid == null) { await context.close(); return; }
  const loaded = await page.waitForFunction((u) => window.__battle.renderer.towerModel(u)?.userData?.glb, uid, { timeout: 60000, polling: 250 }).then(() => true, () => false);
  check(loaded, `${hero} is drawn from her GLB`);
  const pos = await page.evaluate((u) => { const t = window.__battle.sim.towers.find((x) => x.uid === u); return { x: t.x, y: t.y }; }, uid);
  await settle(page, 600);
  // wide view first
  await shot(page, hero, 'wide', VW, VH);
  await zoomOn(page, pos.x, pos.y, 0.5, VW < 600 ? 6 : 7);
  // her close-ups first, the battle paused and no enemy near (her attacks and their beams would play over the clip
  // being shown); the Green Slimes come after
  await page.evaluate(() => { window.__battle.ui.paused = true; });
  const results = {};
  const tagQ = quality === 'high' ? '' : `-${quality}`;
  for (const st of ['idle', 'walk', 'attack', 'cheer', 'hurt']) {
    if (st === 'attack') {
      // the one-shot cast over idle, sampled while it plays
      await heroProbe(page, uid, 'idle', 0);
      await settle(page, 300);
      results[st] = await heroProbe(page, uid, 'attack', 500).catch((e) => ({ err: e.message }));
    } else {
      await heroProbe(page, uid, st, 0);
      await settle(page, 300);
      results[st] = await heroProbe(page, uid, st, 900).catch((e) => ({ err: e.message }));
    }
    // the shot: the same moment of each clip every run (stepped by hand, then held while the frame draws)
    await holdPose(page, uid, st, POSE_AT[st]);
    await settle(page, 250);
    await shot(page, `${hero}${tagQ}`, st, VW, VH, { x: pos.x, y: pos.y, h: 0.45 });
    await page.evaluate((u) => { window.__battle.renderer.towerModel(u).userData.__mqFreeze = false; }, uid);
  }
  await heroProbe(page, uid, 'idle', 0);
  const fmt = (r) => (r?.skinned ? `hand mesh drop L ${r.drop.L?.toFixed(2)} R ${r.drop.R?.toFixed(2)} arm lengths, travel ${(r.travel * 100).toFixed(1)}% of height per step` : JSON.stringify(r));
  for (const [st, r] of Object.entries(results)) log(`  ${st.padEnd(6)} ${fmt(r)} (${r?.detail})`);
  const idle = results.idle;
  if (idle?.skinned) {
    // no T-pose: her free arm hangs (the arm holding a staff / trident / control bar is placed by IK at grip height)
    const free = FREE_ARMS[hero] || ['L', 'R'];
    for (const side of free) {
      const name = `${hero}'s ${side === 'L' ? 'left' : 'right'} hand`;
      if ((idle.hang?.[side] ?? 0) > 0.7) {
        check(idle.drop[side] > -0.15, `${name} rests down and stays down in idle (rest hang ${idle.hang[side].toFixed(2)} arm lengths, the mesh around it moves ${idle.drop[side]?.toFixed(2)}, want > -0.15)`);
      } else {
        check(idle.drop[side] > 0.4, `${name} comes down in idle (the mesh around it: ${idle.drop[side]?.toFixed(2)} arm lengths, want > 0.4)`);
      }
    }
    check(idle.travel > 0.002, `${hero}'s idle moves her (${(idle.travel * 100).toFixed(1)}% of her height per step)`);
  }
  for (const st of ['walk', 'cheer', 'attack']) {
    const r = results[st];
    if (r?.skinned) check(r.travel > 0.006, `${hero}'s ${st} moves her (${(r.travel * 100).toFixed(1)}% per step)`);
  }
  if (slimes) {
    await page.evaluate((u) => {
      const ud = window.__battle.renderer.towerModel(u).userData;
      ud.__mqState = 'idle';
      ud.__mqFreeze = false;
      window.__battle.ui.paused = false;
    }, uid);
    const slimeInfo = await spawnSlimes(page, pos.x, pos.y);
    await page.waitForFunction((pre) => {
      let n = 0;
      window.__battle.renderer.sceneProbe().traverse((o) => { if (o.name === pre || o.name === `${pre}.lod`) n++; });
      return n > 0;
    }, SLIME_GLB, { timeout: 60000, polling: 300 }).catch(() => null);
    await settle(page, 600);
    await slimeShots(page, slimeInfo, VW, VH, quality);
  }
  await context.close();
}

/**
 * Frame cost of a busy road: 40 Green Slimes walking past the hero (their own model, the jelly material) for a few
 * seconds at `quality`: rAF frame deltas (median / p95, software WebGL here: compare runs with each other, not with a
 * phone), and the frame's draw calls and triangles.
 */
async function busyWave(quality) {
  const [VW, VH] = [1280, 720];
  log(`\n== busy wave: 40 Green Slimes (${quality})`);
  const hero = HEROES[0];
  const { context, page, ok } = await openBattle(hero, [VW, VH], quality);
  if (!ok) { check(false, 'busy wave battle opens'); await context.close(); return null; }
  await placeHero(page, hero);
  await page.evaluate(() => {
    const { sim } = window.__battle;
    sim._spawnQueue = [];
    for (let i = 0; i < 40; i++) sim.spawnEnemy('slime_green', { pathIndex: 0, dist: 0.5 + i * 0.5, hpMul: 1e7 });
  });
  await page.waitForFunction((pre) => {
    let n = 0;
    window.__battle.renderer.sceneProbe().traverse((o) => { if (o.name?.startsWith(pre)) n++; });
    return n >= 40;
  }, SLIME_GLB, { timeout: 90000, polling: 500 }).catch(() => null);
  await settle(page, 1500);
  const m = await page.evaluate(() => new Promise((resolve) => {
    const d = [];
    let last = performance.now();
    const end = last + 4000;
    const tick = (t) => {
      d.push(t - last);
      last = t;
      if (t < end) requestAnimationFrame(tick);
      else {
        d.sort((a, b) => a - b);
        const info = window.__battle.renderer.info;
        resolve({ frames: d.length, median: +d[Math.floor(d.length / 2)].toFixed(1), p95: +d[Math.floor(d.length * 0.95)].toFixed(1), calls: info.calls, triangles: info.triangles });
      }
    };
    requestAnimationFrame(tick);
  }));
  log(`  ${JSON.stringify(m)}`);
  await context.close();
  return m;
}

/**
 * The Halloween event stage (costumes on): Green Slimes keep their event hats on the new model (its 'top' bone is the
 * blob families' head slot, glbEnemy.js SLOT_BONES), at 1280x720.
 */
async function eventHats() {
  const [VW, VH] = [1280, 720];
  log('\n== event costumes: Green Slimes on ev-halloween-1');
  const { context, page } = await openBattle(HEROES[0], [VW, VH], 'high');
  await page.evaluate(() => { location.hash = '#/battle?stage=ev-halloween-1&difficulty=normal'; });
  const ok = await page.waitForFunction(() => window.__battle?.sim?.stage?.id === 'ev-halloween-1' && window.__battle.ui?.act, null, { timeout: 90000 }).then(() => true, () => false);
  if (!ok) { log('  (event stage not open: skipped)'); await context.close(); return; }
  const uids = await page.evaluate(() => {
    const { sim } = window.__battle;
    sim._spawnQueue = [];
    const out = [];
    for (let i = 0; i < 8; i++) {
      const e = sim.spawnEnemy('slime_green', { pathIndex: 0, dist: 3 + i * 0.6, hpMul: 1e7 });
      e.baseSpeed = 0.02;
      out.push(e.uid);
    }
    return out;
  });
  await page.waitForFunction((pre) => {
    let n = 0;
    window.__battle.renderer.sceneProbe().traverse((o) => { if (o.name?.startsWith(pre)) n++; });
    return n >= 8;
  }, SLIME_GLB, { timeout: 90000, polling: 500 }).catch(() => null);
  await settle(page, 800);
  const r = await page.evaluate(() => {
    let slimes = 0;
    let hats = 0;
    window.__battle.renderer.sceneProbe().traverse((o) => {
      if (o.name !== 'enemy:slime_green') return;
      slimes++;
      if ((o.userData.attachments || []).length) hats++;
    });
    return { slimes, hats };
  });
  log(`  ${JSON.stringify(r)}`);
  check(r.slimes >= 8 && r.hats >= 4, `Green Slimes wear their event hats on ${SLIME_OWN ? 'their own' : 'the family'} model (${r.hats} of ${r.slimes}; 1 in 7 goes plain)`);
  const sp = await page.evaluate((u) => { const e = window.__battle.sim.enemies.find((x) => x.uid === u); return { x: e.x, y: e.y }; }, uids[3]);
  await zoomOn(page, sp.x, sp.y, 0.2, 6);
  await shot(page, 'slime-event', 'hats', VW, VH, { enemy: uids[3] });
  await context.close();
}

/**
 * The re-rigged batch-2 enemies (tools/tripo/rerig_tripo_enemy.py, docs/art/tripo/enemy-rigs.md), one at a time on the
 * road of 1-1 near the middle of the screen, their own model loaded: where their arms really are (the mesh, from
 * tests/models/enemyArms.js) is skinned to the arm bones, and stepping their animator by hand (frame-rate independent)
 * the hands swing in move and in the special. --shots: a close-up of each in its move and its special, held still.
 */
async function enemyRun(size, quality) {
  const [VW, VH] = size;
  const ids = quality === 'high' ? ENEMIES : ENEMIES.filter((id) => ENEMY_LODS.has(id));
  if (!ids.length) return;
  log(`\n== batch-2 enemies at ${VW}x${VH} (${quality}): ${ids.join(', ')}`);
  const { context, page, ok } = await openBattle(HEROES[0] || 'luna', size, quality);
  check(ok, `battle 1-1 opens (${VW}x${VH}, ${quality})`);
  if (!ok) { await context.close(); return; }
  // no hero on the board (her beams would cross the close-ups): leave the free-deploy prompt, so the wheel zooms
  await page.evaluate(() => window.__battle.ui.placement?.cancel?.());
  await page.click('[data-testid=place-cancel]', { timeout: 3000 }).catch(() => null);
  await settle(page, 300);
  const tagQ = quality === 'high' ? '' : `-${quality}`;
  const lod = quality !== 'high';
  for (const id of ids) {
    const at = await page.evaluate(async (eid) => {
      const { pointAt } = await import('/src/sim/path.js');
      const { sim, renderer, ui } = window.__battle;
      ui.paused = false;
      sim._spawnQueue = [];
      sim.enemies.splice(0);
      // the road point nearest the middle of the screen (a little below it: the bosses are tall) where the road runs
      // down the screen, so the enemy walks toward the camera and its face shows
      const path = sim.pathData[0];
      let best = null;
      for (let d = 0.5; d < path.length - 0.8; d += 0.25) {
        const p = pointAt(path, d);
        const q = pointAt(path, d + 0.3);
        const s = renderer.worldToScreen(p.x, p.y, 0);
        const s2 = renderer.worldToScreen(q.x, q.y, 0);
        if (!s.visible) continue;
        const dx = s2.clientX - s.clientX;
        const dy = s2.clientY - s.clientY;
        const toward = dy > 0.7 * Math.abs(dx);
        const c = Math.hypot(s.clientX - innerWidth / 2, s.clientY - innerHeight * 0.6) + (toward ? 0 : 1e4);
        if (!best || c < best.c) best = { d, c };
      }
      const e = sim.spawnEnemy(eid, { pathIndex: 0, dist: best ? best.d : 3, hpMul: 1e7 });
      if (!e) return null;
      e.baseSpeed = 0.02;
      return { uid: e.uid, x: e.x, y: e.y };
    }, id);
    check(!!at, `${id} spawned on the road`);
    if (!at) continue;
    const want = `glb:tripo/${id}${lod && ENEMY_LODS.has(id) ? '.lod' : ''}`;
    const loaded = await page.waitForFunction(([eid, w]) => {
      let ok = false;
      window.__battle.renderer.sceneProbe().traverse((o) => {
        if (o.name === `enemy:${eid}`) o.traverse((c) => { if (c.name === w) ok = true; });
      });
      return ok;
    }, [id, want], { timeout: 60000, polling: 250 }).then(() => true, () => false);
    check(loaded, `${id} wears its own model (${want})`);
    if (!loaded) continue;
    await settle(page, 400);
    if (FACES.has(id)) {
      const face = await page.evaluate((eid) => {
        let f = null;
        window.__battle.renderer.sceneProbe().traverse((o) => { if (!f && o.name === `enemy:${eid}`) o.traverse((c) => { if (c.isMesh && c.name === 'face') f = c; }); });
        return !!f && f.visible && !f.userData.isOutline && !f.material?.userData?.outline;
      }, id);
      check(face, `${id} draws its face mesh (its eyes), never outlined`);
    }
    await page.evaluate(() => { window.__battle.ui.paused = true; });
    const r = await page.evaluate(([eid, spec]) => {
      let model = null;
      window.__battle.renderer.sceneProbe().traverse((o) => { if (!model && o.name === `enemy:${eid}`) model = o; });
      let body = null;
      model.traverse((o) => { if (o.isSkinnedMesh && o.name === 'body' && !body) body = o; });
      if (!body) return { skinned: false };
      const ud = model.userData;
      if (ud.animate !== ud.__mqW) {
        ud.__mqOrig = ud.animate;
        ud.__mqW = (t, dt, o) => ud.__mqOrig(t, ud.__mqFreeze ? 0 : dt, ud.__mqOpts || o);
        ud.animate = ud.__mqW;
      }
      const geo = body.geometry;
      const pos = geo.attributes.position;
      const si = geo.attributes.skinIndex;
      const sw = geo.attributes.skinWeight;
      geo.computeBoundingBox();
      const k = geo.boundingBox.max.y - geo.boundingBox.min.y; // the stored height (the 1 m frame scaled)
      const Vec3 = body.position.constructor;
      const v = new Vec3();
      const P = [];
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); P.push([v.x / k, -v.z / k, (v.y - geo.boundingBox.min.y) / k]); }
      const names = body.skeleton.bones.map((b) => b.name);
      const dom = (i) => {
        let best = 0;
        for (let c = 1; c < 4; c++) if (sw.getComponent(i, c) > sw.getComponent(i, best)) best = c;
        return names[si.getComponent(i, best)];
      };
      const lerp3 = (a, b, t) => a.map((x, j) => x + (b[j] - x) * t);
      const near = (at, r) => P.map((_, i) => i).filter((i) => Math.hypot(P[i][0] - at[0], P[i][2] - at[2]) < r && Math.abs(P[i][1] - at[1]) < 0.12);
      const out = { skinned: true, share: {}, swing: {}, special: 0 };
      const hands = {};
      for (const side of ['L', 'R']) {
        const [S, E, W, T] = spec[side];
        const chain = new RegExp(`^(shoulder|upper_arm|forearm|hand)_${side}$`);
        const probes = { upper: lerp3(S, E, 0.5), fore: lerp3(E, W, 0.5), hand: lerp3(W, T, 0.4) };
        for (const [part, at] of Object.entries(probes)) {
          const idx = near(at, spec.r);
          out.share[`${side} ${part}`] = idx.length ? +(idx.filter((i) => chain.test(dom(i))).length / idx.length).toFixed(2) : 0;
        }
        hands[side] = near(probes.hand, spec.r);
      }
      const skinnedAt = (idx) => {
        model.updateMatrixWorld(true);
        body.skeleton.update();
        return idx.map((i) => { const p = new Vec3().fromBufferAttribute(pos, i); body.applyBoneTransform(i, p); return p; });
      };
      const travel = (steps, dt) => {
        const first = { L: skinnedAt(hands.L), R: skinnedAt(hands.R) };
        const best = { L: 0, R: 0 };
        for (let s = 0; s < steps; s++) {
          ud.animate(0, dt);
          for (const side of ['L', 'R']) {
            const now = skinnedAt(hands[side]);
            const d = now.map((p, j) => p.distanceTo(first[side][j]) / k).sort((a, b) => a - b);
            if (d.length) best[side] = Math.max(best[side], d[Math.floor(d.length / 2)]);
          }
        }
        return best;
      };
      ud.__mqFreeze = false;
      // idle first (lets the crossfade play out), then a second of the walk
      ud.__mqOpts = { moving: false, speed: 1 };
      for (let s = 0; s < 20; s++) ud.animate(0, 0.05);
      ud.__mqOpts = { moving: true, speed: 1 };
      for (let s = 0; s < 6; s++) ud.animate(0, 0.05);
      const sw2 = travel(20, 0.05);
      out.swing = { L: +sw2.L.toFixed(3), R: +sw2.R.toFixed(3) };
      ud.__mqOpts = { moving: false, speed: 1 };
      for (let s = 0; s < 20; s++) ud.animate(0, 0.05);
      ud.playSpecial?.();
      const sp = travel(12, 0.05);
      out.special = +Math.max(sp.L, sp.R).toFixed(3);
      ud.__mqFreeze = true;
      return out;
    }, [id, ENEMY_ARMS[id]]);
    log(`  ${id}: arm mesh on arm bones ${JSON.stringify(r.share)}, hand swing in move ${JSON.stringify(r.swing)}, in the special ${r.special}`);
    if (r.skinned) {
      for (const [part, s] of Object.entries(r.share)) check(s > 0.6, `${id}${tagQ} ${part}: the arm's mesh is on that arm's bones (${(s * 100).toFixed(0)}%)`);
      for (const side of ['L', 'R']) check(r.swing[side] > 0.025, `${id}${tagQ} ${side} hand swings as it walks (${(r.swing[side] * 100).toFixed(1)}% of its height)`);
      check(r.special > 0.05, `${id}${tagQ} special moves its hands (${(r.special * 100).toFixed(1)}%)`);
    } else check(false, `${id} skinned body`);
    if (shotsDir) {
      // close-ups: the walk and the special, each at a fixed moment, held still while the frame draws
      const pos = await page.evaluate((u) => { const e = window.__battle.sim.enemies.find((x) => x.uid === u); return e ? { x: e.x, y: e.y } : null; }, at.uid);
      const big = ['fp_hyakki_daimyo', 'iron_colossus', 'fp_foundry_titan'].includes(id);
      // the hero's free-deploy prompt can open again a moment after the battle starts; while it is up the wheel
      // does not zoom
      if (await page.isVisible('[data-testid=place-cancel]').catch(() => false)) {
        await page.click('[data-testid=place-cancel]', { timeout: 3000 }).catch(() => null);
        await settle(page, 200);
      }
      await zoomOn(page, pos.x, pos.y, big ? 0.9 : 0.35, big ? (VW < 600 ? 6 : 7) : 10); // (small ones: the free camera's closest zoom)
      for (const [state, setup] of [['move', 'move'], ['special', 'special']]) {
        await page.evaluate(([eid, st, at]) => {
          let model = null;
          window.__battle.renderer.sceneProbe().traverse((o) => { if (!model && o.name === `enemy:${eid}`) model = o; });
          const ud = model.userData;
          ud.__mqFreeze = false;
          ud.__mqOpts = { moving: false, speed: 1 };
          for (let s = 0; s < 20; s++) ud.animate(0, 0.05);
          if (st === 'move') {
            ud.__mqOpts = { moving: true, speed: 1 };
            for (let s = 0; s < 16; s++) ud.animate(0, 0.025);
          } else {
            ud.playSpecial?.();
            for (let s = 0; s < Math.round(at / 0.025); s++) ud.animate(0, 0.025);
          }
          ud.__mqFreeze = true;
        }, [id, setup, SPECIAL_AT[id] ?? 0.2]);
        await settle(page, 250);
        await shot(page, `${id}${tagQ}`, state, VW, VH, { x: pos.x, y: pos.y, h: big ? 0.9 : 0.35 });
      }
    }
  }
  await context.close();
}

try {
  if (args.includes('--busy')) {
    // frame cost only (run it on this tree and on main to compare)
    for (const q of ['high', 'medium']) await busyWave(q);
  } else {
  if (!args.includes('--no-heroes')) {
    for (const size of SIZES) {
      for (const [i, hero] of HEROES.entries()) await heroRun(hero, size, 'high', { slimes: i === 0 });
    }
    // the LOD files (quality medium) at one size
    for (const hero of MEDIUM) await heroRun(hero, SIZES[SIZES.length - 1], 'medium', { slimes: hero === MEDIUM[0] });
    await eventHats();
  }
  // the re-rigged batch-2 enemies at each size, and their LOD files at medium
  for (const size of SIZES) await enemyRun(size, 'high');
  if (!args.includes('--no-enemy-lod')) await enemyRun(SIZES[SIZES.length - 1], 'medium');
  }
} catch (e) {
  failures.push(`crash: ${e.stack || e.message}`);
}
check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 5).join(' | ')}` : ''}`);
await browser.close();
await server.close();
log(failures.length ? `\nFAILED (${failures.length})\n  ${failures.join('\n  ')}` : '\nall ok');
process.exit(failures.length ? 1 : 0);

// The staff heroes rebuilt on the chibi pipeline (docs/art/tripo/staff-models.md) in a real battle: Norika and
// Kogane placed beside the road on 1-1 (day) and 2-1 (night), at 1280x720 and at 390x844 like a phone (device pixel
// ratio 3), quality high (full file) and medium (the LOD file).
//   * she is drawn from her GLB, the staff build (asset extras.build 'staff') at the detail her quality asks for;
//   * every clip the game plays for her exists and moves her (idle, walk, attack, cheer, hurt; her animator stepped by
//     hand, frame-rate independent): the skinned vertices travel;
//   * her hard hat leaves her face clear from the battle camera: no hat vertex comes near the line of sight from an
//     eye that faces the camera to the camera (its direction taken from the game's own projection), in idle and at
//     the attack's strike;
//   * no console errors.
// --shots <dir> saves a wide view and close-ups (idle, attack at its strike, cheer) per hero, stage, size and quality:
// <dir>/staff-<hero>-<stage>-<quality>-<state>-<W>x<H>.png (the board is made from them).
//
//   node e2e/staff-models.mjs [--shots /tmp/staff] [--heroes norika,kogane] [--stages 1-1,2-1]
//                             [--sizes 1280x720,390x844] [--qualities high,medium]
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
const HEROES = String(opt('heroes', 'norika,kogane')).split(',').filter(Boolean);
const STAGES = String(opt('stages', '1-1,2-1')).split(',').filter(Boolean);
const SIZES = String(opt('sizes', '1280x720,390x844')).split(',').map((s) => s.split('x').map(Number));
const QUALITIES = String(opt('qualities', 'high,medium')).split(',').filter(Boolean);
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

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const base = `http://127.0.0.1:${port}/`;
const save = await server.ssrLoadModule('/src/systems/save.js');
const { browser, label } = await launchChromium();
log(`browser: ${label}`);
const errors = [];
const settle = (page, ms = 250) => page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, t)))), ms).catch(() => null);

async function openBattle(hero, stage, [VW, VH], quality) {
  const profile = save.createProfile();
  for (const id of ['aoi', ...HEROES]) profile.units[id] = { ...save.newUnitState(), level: 40, breakthrough: 3 };
  profile.formation = { ...(profile.formation || {}), towers: ['aoi'], hero };
  profile.settings = { ...profile.settings, autoStart: false, quality, camera: 'free', attackFx: false };
  const context = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: VW < 600 ? 3 : 1 });
  await context.addInitScript(([key, text]) => {
    if (!sessionStorage.getItem('staff-e2e-seeded')) {
      localStorage.setItem(key, text);
      sessionStorage.setItem('staff-e2e-seeded', '1');
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
  await page.evaluate((s) => { location.hash = `#/battle?stage=${s}&difficulty=normal`; }, stage);
  const ok = await page.waitForFunction(([h, s]) => window.__battle?.ui?.act && window.__battle.sim.heroConfig?.unitId === h && window.__battle.sim.stage?.id === s,
    [hero, stage], { timeout: 90000 }).then(() => true, () => false);
  return { context, page, ok };
}

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

async function zoomOn(page, x, y, h, clicks) {
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
 * Plays `state` on her (the battle paused, her animator stepped by hand): the skinned vertices' largest travel between
 * steps (share of her height) over `ms`, then holds the pose at `at` seconds. With `face` it also projects her eyes and
 * her hat with the game's camera: the hat must stay above both eyes on screen (the brim never comes down over them).
 */
async function playState(page, uid, state, ms, at, face = false) {
  return page.evaluate(([u, st, dur, hold, wantFace]) => {
    const { renderer } = window.__battle;
    const model = renderer.towerModel(u);
    const ud = model.userData;
    if (ud.animate !== ud.__sfWrapped) {
      ud.__sfOrig = ud.animate;
      ud.__sfWrapped = (t, dt) => ud.__sfOrig(t, ud.__sfFreeze ? 0 : dt, ud.__sfState || 'idle');
      ud.animate = ud.__sfWrapped;
    }
    ud.__sfFreeze = false;
    ud.__sfState = st === 'attack' ? 'idle' : st;
    for (let i = 0; i < 24; i++) ud.animate(0, 0.05);
    let body = null;
    let head = null;
    model.traverse((o) => {
      if (o.isSkinnedMesh && o.name === 'body' && !o.userData.isOutline && !body) body = o;
      if (o.isSkinnedMesh && o.name === 'head' && !o.userData.isOutline && !head) head = o;
    });
    const Vec3 = body.position.constructor;
    const v = new Vec3();
    // skinned positions in the geometry's own space (the travel: compared with the geometry's height), or in the
    // scene (the face check: projected with the game's camera)
    const skin = (mesh, i, world = true) => {
      v.fromBufferAttribute(mesh.geometry.attributes.position, i);
      mesh.applyBoneTransform(i, v);
      return world ? v.clone().applyMatrix4(mesh.matrixWorld) : v.clone();
    };
    const snap = () => {
      model.updateMatrixWorld(true);
      body.skeleton.update();
      const n = body.geometry.attributes.position.count;
      const out = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const p = skin(body, i, false);
        out[i * 3] = p.x; out[i * 3 + 1] = p.y; out[i * 3 + 2] = p.z;
      }
      return out;
    };
    body.geometry.computeBoundingBox();
    const height = body.geometry.boundingBox.max.y - body.geometry.boundingBox.min.y;
    if (st === 'attack') ud.playAttack?.();
    let prev = snap();
    let travel = 0;
    const steps = 10;
    for (let k = 0; k < steps; k++) {
      ud.animate(0, dur / steps / 1000);
      const cur = snap();
      let mx = 0;
      for (let i = 0; i < cur.length; i += 3) mx = Math.max(mx, Math.hypot(cur[i] - prev[i], cur[i + 1] - prev[i + 1], cur[i + 2] - prev[i + 2]));
      travel = Math.max(travel, mx / height);
      prev = cur;
    }
    // the shot: a fresh start of the state, stepped to `hold` seconds, then frozen
    for (let i = 0; i < 24; i++) ud.animate(0, 0.05);
    if (st === 'attack') ud.playAttack?.();
    else ud.mixer?._actions?.forEach((a) => { if (a.getClip().name === st) a.time = 0; });
    const n = Math.max(1, Math.round(hold / 0.02));
    for (let i = 0; i < n; i++) ud.animate(0, hold / n);
    ud.__sfFreeze = true;
    let faceInfo = null;
    if (wantFace && head) {
      model.updateMatrixWorld(true);
      head.skeleton.update();
      // the painted eyes: the face primitive's front vertices at the eye line (eye_v 0.42, 0.195 of the width out)
      const g = head.geometry;
      g.computeBoundingBox();
      const bb = g.boundingBox;
      // the game's view direction, from its own projection (worldToScreen(x, y, h) takes board coordinates: the scene
      // point (x, h, y)): the camera is orthographic, so the direction toward it is the one that does not move a point
      // on screen (the cross product of the screen axes' gradients), pointing up
      const scr = (p) => { const s = renderer.worldToScreen(p.x, p.z, p.y); return new Vec3(s.clientX, s.clientY, 0); };
      const o = new Vec3().setFromMatrixPosition(model.matrixWorld).add(new Vec3(0, 0.5, 0));
      const s0 = scr(o);
      const grad = [new Vec3(1, 0, 0), new Vec3(0, 1, 0), new Vec3(0, 0, 1)].map((e) => scr(o.clone().addScaledVector(e, 0.01)).sub(s0));
      const rowX = new Vec3(grad[0].x, grad[1].x, grad[2].x);
      const rowY = new Vec3(grad[0].y, grad[1].y, grad[2].y);
      const toCam = rowX.clone().cross(rowY).normalize();
      if (toCam.y < 0) toCam.negate();
      // the painted eyes: the face primitive's front vertices at the eye line (eye_v 0.42, 0.195 of the width out)
      const eyes = [-1, 1].map((s) => {
        const want = new Vec3((bb.min.x + bb.max.x) / 2 + s * 0.195 * (bb.max.x - bb.min.x), bb.min.y + 0.42 * (bb.max.y - bb.min.y), bb.max.z);
        let best = -1;
        let bd = Infinity;
        const p = new Vec3();
        for (let i = 0; i < g.attributes.position.count; i++) {
          p.fromBufferAttribute(g.attributes.position, i);
          const d = p.distanceTo(want);
          if (d < bd) { bd = d; best = i; }
        }
        return skin(head, best);
      });
      // the head's centre and size in the scene (an eye turned away from the camera is the head's to hide, not the hat's)
      const hc = new Vec3();
      let n = 0;
      for (let i = 0; i < g.attributes.position.count; i += 7) { hc.add(skin(head, i)); n++; }
      hc.multiplyScalar(1 / n);
      const headR = eyes.reduce((m, e) => Math.max(m, e.distanceTo(hc)), 0);
      const facing = eyes.map((e) => e.clone().sub(hc).normalize().dot(toCam) > 0.15);
      // the hat: the head bone's safety-yellow vertices; the nearest any of them comes to a sight line from a facing eye
      // to the camera, as a share of the head's radius
      const col = body.geometry.attributes.color;
      const si = body.geometry.attributes.skinIndex;
      const sw = body.geometry.attributes.skinWeight;
      const headIdx = body.skeleton.bones.findIndex((b) => b.name === 'head');
      let hatPts = 0;
      let closest = Infinity;
      for (let i = 0; i < body.geometry.attributes.position.count; i++) {
        let bi = 0;
        let bw = -1;
        for (let c = 0; c < 4; c++) if (sw.getComponent(i, c) > bw) { bw = sw.getComponent(i, c); bi = si.getComponent(i, c); }
        if (bi !== headIdx) continue;
        if (!(col.getX(i) > 0.6 && col.getY(i) > 0.3 && col.getY(i) < 0.85 && col.getZ(i) < 0.15)) continue;
        hatPts++;
        const h = skin(body, i);
        eyes.forEach((e, k) => {
          if (!facing[k]) return;
          const w = h.clone().sub(e);
          const t = w.dot(toCam);
          if (t > 0) closest = Math.min(closest, w.addScaledVector(toCam, -t).length() / headR);
        });
      }
      faceInfo = { hatPts, facing: facing.filter(Boolean).length, clearance: closest, toCamY: +toCam.y.toFixed(3) };
    }
    return { travel, face: faceInfo, detail: ud.detail };
  }, [uid, state, ms, at, face]);
}

const POSE_AT = { idle: 0.45, walk: 0.25, attack: 0.42, cheer: 0.3, hurt: 0.2 };

async function run(hero, stage, size, quality) {
  const [VW, VH] = size;
  log(`\n== ${hero} on ${stage} at ${VW}x${VH} (${quality})`);
  const { context, page, ok } = await openBattle(hero, stage, size, quality);
  check(ok, `battle ${stage} opens with ${hero}`);
  if (!ok) { await context.close(); return; }
  const uid = await placeHero(page, hero);
  check(uid != null, `${hero} placed`);
  if (uid == null) { await context.close(); return; }
  const detail = quality === 'high' ? 'full' : 'lod';
  const loaded = await page.waitForFunction(([u, d]) => window.__battle.renderer.towerModel(u)?.userData?.detail === d, [uid, detail], { timeout: 60000, polling: 250 }).then(() => true, () => false);
  check(loaded, `${hero} is drawn from her GLB (${detail})`);
  if (!loaded) { await context.close(); return; }
  const build = await page.evaluate(async ([h, d]) => {
    const { getCharacter } = await import('/src/models/glbChibi.js');
    const a = getCharacter(h, d);
    return a ? { build: a.extras.build, generator: a.extras.generator, clips: Object.keys(a.clips).sort() } : null;
  }, [hero, detail]);
  check(build?.build === 'staff' && /build_characters/.test(build.generator || ''), `${hero} is the staff build (${JSON.stringify(build)})`);
  const pos = await page.evaluate((u) => { const t = window.__battle.sim.towers.find((x) => x.uid === u); return { x: t.x, y: t.y }; }, uid);
  await settle(page, 600);
  const tagQ = `${stage}-${quality}`;
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/staff-${hero}-${tagQ}-wide-${VW}x${VH}.png`, timeout: 120000 });
  await zoomOn(page, pos.x, pos.y, 0.5, VW < 600 ? 6 : 7);
  await page.evaluate(() => { window.__battle.ui.paused = true; });
  for (const st of ['idle', 'walk', 'attack', 'cheer', 'hurt']) {
    const r = await playState(page, uid, st, st === 'attack' ? 500 : 900, POSE_AT[st], st === 'idle' || st === 'attack').catch((e) => ({ err: e.message }));
    if (r.err) { check(false, `${hero} ${st}: ${r.err}`); continue; }
    // idle breathes and hurt is a dizzy sway (held, like the girls'): a little; walk, attack and cheer clearly
    check(r.travel > (st === 'idle' || st === 'hurt' ? 0.002 : 0.006), `${hero}'s ${st} moves her (${(r.travel * 100).toFixed(1)}% of her height per step)`);
    if (r.face) {
      // the camera looks 48 degrees down (toCam.y = sin 48 = 0.74); she faces the road, so from some placements only
      // one eye (or, from behind, none) faces the camera
      check(r.face.hatPts > 50 && Math.abs(r.face.toCamY - 0.743) < 0.02 && (r.face.facing === 0 || r.face.clearance > 0.12),
        `${hero}'s eyes are clear of her hard hat in ${st} (${r.face.facing} eye(s) facing the camera; the hat comes no nearer than ${Number.isFinite(r.face.clearance) ? r.face.clearance.toFixed(2) : '-'} head radii to their sight lines, camera up ${r.face.toCamY})`);
    }
    await settle(page, 250);
    if (shotsDir && ['idle', 'attack', 'cheer'].includes(st)) await page.screenshot({ path: `${shotsDir}/staff-${hero}-${tagQ}-${st}-${VW}x${VH}.png`, timeout: 120000 });
  }
  await context.close();
}

for (const hero of HEROES) {
  for (const stage of STAGES) {
    for (const size of SIZES) {
      for (const q of QUALITIES) await run(hero, stage, size, q);
    }
  }
}
check(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 5).join(' | ')}` : ''}`);
await browser.close();
await server.close();
log(failures.length ? `\n${failures.length} check(s) failed` : '\nall ok');
process.exit(failures.length ? 1 : 0);

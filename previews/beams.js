// Beams lab (dev only; docs/VFX.md "Toon beams", batch B3): the toon beam layer (src/render/vfx/toonBeams.js) on the lab
// patch (previews/vfxLabStage.js: a battle-like board on our own lake look, the battle's lights, camera and high's bloom
// + grade), with real chibis for scale and goblins to aim at. Not wired into the battle.
//
//   /previews/beams.html            live: the scene loops; scene / tier / Reduce Motion / today's look buttons
//   ?scene=umeko|luna|kohaku|miko|raika|all  &quality=high|medium|low  &rm=1  &flashes=0  &zoom=2.5 (a close-up)
//   &focus=crown|muzzle|beam (what the crops and close-ups centre on)  &clean=1 (no buttons)
//   &old=1: today's live look of the same beam, drawn by the current code (held.js, s5held.js, kohaku_tsubaki.js,
//   beams.js) through the real attack context, for the side-by-side boards
//   &manual=1: no loop; window.__lab.shot(t) steps the scene to t s and draws it (call in rising order);
//   window.__lab.moments() → the scene's beats (charge, fire, sustain, end, impact); window.__lab.screen() → the focus's
//   screen px; window.__lab.stats(); window.__lab.bench(); window.__lab.inkScan(t) → the dark-ink fragments of every
//   frame up to t (see e2e/beams-ink.mjs)
import * as THREE from 'three';
import { createLabStage } from './vfxLabStage.js';
import { createToonBeamFx } from '../src/render/vfx/toonBeams.js';
import { TOON_BEAM_PRESETS } from '../src/render/vfx/toonBeamPresets.js';
import { createVisualRandom, visualSeed } from '../src/render/vfx/random.js';
import { FlashGuard, screenShare } from '../src/render/vfx/flashGuard.js';
import { createContext } from '../src/render/attackFx/context.js';
import { drawHeld } from '../src/render/attackFx/patterns/held.js';
import { drawS5Held } from '../src/render/attackFx/patterns/s5held.js';
import { kohaku_tsubaki } from '../src/render/attackFx/styles/kohaku_tsubaki.js';
import { createBeamFx } from '../src/render/vfx/beams.js';
import { RING_DIRS } from '../src/sim/constants.js';
import { UNIT_MAP } from '../src/data/units.js';
import { ENEMIES } from '../src/data/enemies.js';
import { preloadModels, buildChibi, buildEnemy, preloadEnemies } from '../src/models/index.js';

const SCENES = ['umeko', 'luna', 'kohaku', 'miko', 'raika', 'all'];
const Q = new URLSearchParams(location.search);
const sceneId = SCENES.includes(Q.get('scene')) ? Q.get('scene') : 'all';
const quality = ['high', 'medium', 'low'].includes(Q.get('quality')) ? Q.get('quality') : 'high';
const rm = Q.get('rm') === '1';
const old = Q.get('old') === '1';
const flashes = Q.get('flashes') !== '0';
const manual = Q.get('manual') === '1';
const zoom = Number(Q.get('zoom') || 1);
const focusOn = ['crown', 'muzzle', 'beam'].includes(Q.get('focus')) ? Q.get('focus') : 'beam';
if (Q.get('clean') === '1') document.body.classList.add('clean');

const W = innerWidth;
const H = innerHeight;
const canvas = document.getElementById('c');
canvas.width = W;
canvas.height = H;
canvas.style.width = `${W}px`;
canvas.style.height = `${H}px`;
const DT = 1 / 60;
const TAU = Math.PI * 2;
window.__lab = { ready: false };

/**
 * The scenes: each girl where she stands (board x, z; the sim's x, y), the goblins she aims at, and her beam's loop.
 * Her beam's muzzle is where today's code starts it: a staff girl's weapon tip, Luna's moon familiar, Miko's mirror,
 * the duo's prism lens.
 */
const LAYOUT = {
  umeko: { girls: [['umeko', 3.2, 2.2]], foes: [[6.05, 3.55], [6.5, 2.35], [5.5, 4.55]], loop: 2.4, focus: [5.9, 3.4] },
  luna: { girls: [['luna', 3.2, 2.3]], foes: [[6.2, 3.2], [5.6, 4.4], [6.4, 2.1]], loop: 1.5, focus: [5.6, 3.3] },
  kohaku: { girls: [['kohaku_tsubaki', 3.3, 2.25]], foes: [[6.6, 3.5], [7.6, 2.7]], loop: 2.6, focus: [6.6, 3.5] },
  miko: { girls: [['miko', 3.4, 2.3]], foes: [[6.9, 3.6]], loop: 1.15, focus: [6.9, 3.6] },
  raika: { girls: [['raika', 3.4, 2.3]], foes: [[7.0, 3.5]], loop: 1.1, focus: [7.0, 3.5] },
  all: {
    girls: [['umeko', 1.4, 1.6], ['luna', 4.2, 1.5], ['kohaku_tsubaki', 6.9, 1.6], ['miko', 9.3, 1.7], ['raika', 10.9, 3.9]],
    foes: [[2.9, 3.7], [3.7, 4.9], [5.4, 3.6], [8.2, 3.4], [9.9, 4.6], [8.6, 5.6]], loop: 2.4, focus: [6, 3.5],
  },
};
const lay = LAYOUT[sceneId];
const PRESET_OF = { umeko: 'umeko', luna: 'luna', kohaku_tsubaki: 'kohaku', miko: 'miko', raika: 'raika' };

async function main() {
  const stage = await createLabStage({ canvas, width: W, height: H, quality, girl: null, zoom, focus: lay.focus });
  const scene = stage.scene;
  const rand = createVisualRandom(visualSeed('lab', 'beams', sceneId)).fork('beams');
  const beams = createToonBeamFx({ scene, camera: stage.camera, quality, reduceMotion: rm, rand, flashes });
  beams.setGlow(quality, stage.glow);
  beams.setPixel(stage.rig.scale);
  // the battle's flash guard, asked as BattleRenderer's flashGate does (screen share of each flash, on the lab clock)
  const guard = new FlashGuard({ reduceMotion: rm });
  const clock = { t: 0 };
  let guardPeak = 0;
  const flashGate = (size, uv, strength) => guard.world(screenShare(size / Math.max(1e-6, stage.rig.scale), stage.rig.viewW, stage.rig.viewH, 0.4), strength, clock.t);
  beams.flashGate = flashGate;

  // ---- the cast: real chibis and goblins (their views, as the battle's actors keep them, for the attack context)
  const ids = [...new Set(lay.girls.map((g) => g[0]))];
  try {
    await preloadModels(ids, { detail: quality === 'high' ? 'full' : 'lod' });
  } catch {
    // (offline: the procedural chibis stand in)
  }
  const goblin = ENEMIES.find((e) => e.family === 'goblin') || ENEMIES[0];
  try {
    await preloadEnemies([goblin.family]);
  } catch {
    // (offline: the procedural enemy stands in)
  }
  const actors = { towers: new Map(), enemies: new Map() };
  const girls = [];
  lay.girls.forEach(([id, x, z], i) => {
    const f = buildChibi(UNIT_MAP[id], { quality });
    // she faces her first goblin (the sim's facing: 0 looks down +z, the board's y)
    const foe = lay.foes[Math.min(i, lay.foes.length - 1)];
    const facing = Math.atan2(foe[0] - x, foe[1] - z);
    f.position.set(x, 0, z);
    f.rotation.y = facing;
    scene.add(f);
    f.userData.animate?.(1.0, 0, 'idle');
    const uid = 100 + i;
    actors.towers.set(uid, { uid, model: f, facing, scale: 1.22, lift: 0 });
    girls.push({ id, uid, x, z, facing, model: f, t: { uid, x, y: z, ox: x, oy: z, facing, disabled: 0 } });
  });
  const foes = lay.foes.map(([x, z], i) => {
    const m = buildEnemy(goblin, { quality });
    m.position.set(x, 0, z);
    m.rotation.y = -1.2;
    m.scale.setScalar(1.12);
    scene.add(m);
    m.userData.animate?.(0.4, 0, 'walk');
    const h = (m.userData.height || 0.6 * (goblin.size || 1)) * 1.12;
    const uid = 500 + i;
    const view = { uid, model: m, x, z, y: 0, height: h, hidden: false };
    actors.enemies.set(uid, view);
    return { uid, x, z, h, view, sim: { uid, x, y: z, dead: false } };
  });
  scene.updateMatrixWorld(true);
  // each girl's face (her head: the top 42 % of her figure's box) for the beams' ink clear zone: the circle, in the
  // view plane, round every corner of that box (the board's camera is orthographic, so it is her head on screen)
  stage.camera.updateMatrixWorld(true);
  const toView = stage.camera.matrixWorldInverse;
  const fv = new THREE.Vector3();
  const cv = new THREE.Vector3();
  for (const g of girls) {
    const box = new THREE.Box3().setFromObject(g.model);
    const hh = (box.max.y - box.min.y) * 0.42;
    g.face = [(box.min.x + box.max.x) / 2, box.max.y - hh / 2, (box.min.z + box.max.z) / 2];
    fv.set(g.face[0], g.face[1], g.face[2]).applyMatrix4(toView);
    let r = 0;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.max.y - hh, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      cv.set(x, y, z).applyMatrix4(toView);
      r = Math.max(r, Math.hypot(cv.x - fv.x, cv.y - fv.y));
    }
    g.faceR = 1.08 * r;
  }

  // the attack context the styles draw through (the muzzles; today's look with old=1)
  const ctx = createContext({ sim: null, actors, fx: null, batches: stage.batches, atlas: stage.atlas, camera: stage.camera, rig: stage.rig, quality, reduceMotion: rm, rand: rand.fork('ctx') });
  ctx.setQuality(quality);
  ctx.setGlow(quality, stage.glow);
  const oldBeams = old ? createBeamFx({ scene, batches: stage.batches, atlas: stage.atlas, camera: stage.camera, quality, reduceMotion: rm, rand: rand.fork('old') }) : null;
  if (oldBeams) {
    oldBeams.setGlow(quality, stage.glow);
    oldBeams.setPixel(stage.rig.scale);
    oldBeams.flashGate = flashGate;
  }

  // ---- muzzles (where today's code starts each beam), into a reused [x, y, z]
  const MZ = { x: 0, y: 0, h: 0 };
  const muzzle = (g, out) => {
    const s = 1;
    const f = g.facing;
    if (g.id === 'miko') {
      // her sun mirror over her shoulder (miko.js mirrorPos)
      out[0] = g.x - Math.sin(f) * 0.25 * s;
      out[2] = g.z - Math.cos(f) * 0.25 * s;
      out[1] = 1.25 * s;
    } else if (g.id === 'kohaku_tsubaki') {
      // Kohaku's prism lens (the duo's anchor), else her spot on the base
      const lens = g.model.userData?.anchors?.lens;
      out[0] = lens ? lens.x : g.x - 0.18;
      out[1] = lens ? lens.y : 0.6;
      out[2] = lens ? lens.z : g.z;
    } else {
      // a staff girl's weapon tip (the attack context's hand: her figure's muzzle anchor; Luna's moonbeams leave it too,
      // as s5held.js draws them today)
      ctx.hand(g.t, MZ);
      out[0] = MZ.x;
      out[1] = MZ.h + (MZ.tip ? 0 : 0.1);
      out[2] = MZ.y;
    }
    return out;
  };

  // ---- the scripts: each girl's beam over the loop (new layer or today's look)
  const H_END = 0.35; // (the end height today's beams use)
  const near = (x, z, r = 0.5) => {
    for (const f of foes) if (Math.hypot(f.x - x, f.z - z) < r) return f;
    return null;
  };
  /** A sweep's angle a sim step i into it (a triangle wave between centre − arc and centre + arc, `pass` steps a swing). */
  const swing = (c, arcSteps, pass, t) => {
    const ph = (t / (pass / 60)) % 2;
    const k = ph < 1 ? ph : 2 - ph;
    return c + (-1 + 2 * k) * ((arcSteps * TAU) / RING_DIRS);
  };
  const actorsFor = [];
  for (const g of girls) {
    const pid = PRESET_OF[g.id];
    const p = TOON_BEAM_PRESETS[pid];
    const A = [0, 0, 0];
    const B = [0, 0, 0];
    const foe0 = foes[Math.min(girls.indexOf(g), foes.length - 1)];
    const st = { g, pid, p, A, B, recs: [], tw: null, foe0 };
    if (pid === 'umeko') {
      // Searchlight Sweep: one held beam of her range swinging ±45° (arc 30 table steps, a swing 2 a step: a pass
      // every 30 steps) round her first goblin's line
      const range = 3.25;
      const c = Math.atan2(foe0.x - g.x, foe0.z - g.z);
      const Lb = Math.sqrt(range * range - 0.25 * 0.25);
      st.aimAt = (t) => {
        const a = swing(c, 30, 30, Math.max(0, t - p.windup));
        B[0] = g.x + Math.sin(a) * Lb;
        B[1] = H_END;
        B[2] = g.z + Math.cos(a) * Lb;
        return a;
      };
      st.hold = [0, 1.75];
      st.range = range;
    } else if (pid === 'luna') {
      // Moonbeam Sweep: two moonbeams swinging in mirror (arc 30 steps over a pass of 36 steps), then released
      const range = 3.3;
      const c = Math.atan2(foe0.x - g.x, foe0.z - g.z);
      const Lb = Math.sqrt(range * range - 0.25 * 0.25);
      st.B2 = [0, 0, 0];
      st.aimAt = (t) => {
        const k = Math.min(1, Math.max(0, t - p.windup) / 0.6);
        const off = (-1 + 2 * k) * ((30 * TAU) / RING_DIRS);
        B[0] = g.x + Math.sin(c + off) * Lb; B[1] = H_END; B[2] = g.z + Math.cos(c + off) * Lb;
        st.B2[0] = g.x + Math.sin(c - off) * Lb; st.B2[1] = H_END; st.B2[2] = g.z + Math.cos(c - off) * Lb;
        return c + off;
      };
      st.hold = [0, p.windup + 0.6];
      st.range = range;
    } else if (pid === 'kohaku') {
      st.hold = [0, 1.25];
    }
    actorsFor.push(st);
  }

  /** Starts one loop of every girl's beam. */
  function start() {
    beams.clear();
    oldBeams?.clear();
    for (const st of actorsFor) {
      st.recs.length = 0;
      st.t = 0;
      st.fired2 = false;
      const { g, pid } = st;
      muzzle(g, st.A);
      if (pid === 'umeko' || pid === 'luna') {
        st.aimAt(0);
        if (!old) {
          const hit = !!near(st.B[0], st.B[2]);
          st.recs.push(beams.fire(pid, st.A, st.B, { hit, face: g.face, faceR: g.faceR }));
          if (pid === 'luna') st.recs.push(beams.fire(pid, st.A, st.B2, { hit: !!near(st.B2[0], st.B2[2]), face: g.face, faceR: g.faceR }));
        }
      } else if (pid === 'kohaku') {
        const f = st.foe0;
        st.B[0] = f.x; st.B[1] = f.h * 0.55; st.B[2] = f.z;
        if (!old) st.recs.push(beams.fire(pid, st.A, st.B, { face: g.face, faceR: g.faceR }));
        else {
          st.tw = { data: kohaku_tsubaki.init(), look: { accent: [0, 0, 0] } };
          st.holds = [{ e: f.sim, held: 0 }];
          st.spec = { projectiles: 1, range: 4.6, pierce: 2, ramp: null, edge: false };
        }
      } else {
        // a fired lance at her goblin (Miko's holy ray, Raika's Overcharge lance)
        const f = st.foe0;
        st.B[0] = f.x; st.B[1] = H_END; st.B[2] = f.z;
        if (!old) st.recs.push(beams.fire(pid, st.A, st.B, { width: 0.2, face: g.face, faceR: g.faceR }));
        else st.oldAt = TOON_BEAM_PRESETS[pid].windup; // (today's lance fires on the sim's beam event: at the same beat)
      }
    }
  }

  /** One frame of the scripts (before the layers update). */
  function tick(dt) {
    for (const st of actorsFor) {
      st.t += dt;
      const { g, pid, p } = st;
      const t = st.t;
      muzzle(g, st.A);
      if (pid === 'umeko' || pid === 'luna') {
        const a = st.aimAt(t);
        if (!old) {
          const r0 = st.recs[0];
          beams.aim(r0, st.A, st.B, { hit: !!near(st.B[0], st.B[2]) });
          if (st.recs[1]) beams.aim(st.recs[1], st.A, st.B2, { hit: !!near(st.B2[0], st.B2[2]) });
          if (t >= st.hold[1]) for (const r of st.recs) beams.release(r);
        } else if (t >= p.windup) {
          // today's look, drawn every frame from the channel (held.js / s5held.js)
          const k = Math.round((a / TAU) * RING_DIRS);
          if (pid === 'umeko') {
            if (t < st.hold[1]) drawHeld(ctx, { ...g.t, eff: { behavior: 'sweep', range: st.range }, ch: { k: ((k % RING_DIRS) + RING_DIRS) % RING_DIRS }, stats: {} });
          } else {
            const P = 36;
            const i = Math.round((t - p.windup) * 60);
            if (i <= P + 12) {
              const c = Math.round((Math.atan2(st.foe0.x - g.x, st.foe0.z - g.z) / TAU) * RING_DIRS);
              drawS5Held(ctx, { ...g.t, eff: { range: st.range }, stats: { moon: { beams: 2 } }, moon: { c, side: 1, arc: 30, i, P, hits: [[], []], n: [0, 0] } });
            }
          }
        }
      } else if (pid === 'kohaku') {
        const f2 = foes[Math.min(foes.length - 1, foes.indexOf(st.foe0) + 1)];
        if (!old) {
          if (t >= st.hold[1]) beams.release(st.recs[0]);
          if (!st.fired2 && t >= 1.1) {
            st.fired2 = true;
            st.B2 = [f2.x, f2.h * 0.55, f2.z];
            st.recs.push(beams.fire(pid, st.A, st.B2, { face: g.face, faceR: g.faceR }));
          }
          if (st.recs[1] && t >= 2.2) beams.release(st.recs[1]);
          for (const r of st.recs) beams.aim(r, st.A, r === st.recs[0] ? st.B : st.B2);
        } else {
          // today's constant beam (kohaku_tsubaki.js), on the first goblin then the second, as the sim's holds go
          const holding = t < st.hold[1] ? st.foe0 : t >= 1.1 && t < 2.2 ? f2 : null;
          st.holds[0].e = holding ? holding.sim : null;
          st.holds[0].held = holding ? t : 0;
          ctx.gdt = dt;
          kohaku_tsubaki.update(dt, st.tw, { ...g.t, beamSpec: st.spec, prismBeams: holding ? st.holds : [], beamTickSpec: null }, ctx);
        }
      } else if (old && st.oldAt != null && t >= st.oldAt) {
        st.oldAt = null;
        oldBeams.fire(st.A, st.B, pid === 'miko' ? { preset: 'holy', width: 0.2 } : { preset: 'storm', width: 0.2, zig: quality === 'low' ? 2 : 6 });
      }
    }
  }

  // ---- stepping
  let frame = 0;
  const guardStats = () => ({ worldLoad: guard.worldArea.sum(clock.t), worldPeak: guardPeak, dimmed: guard.dimmed });
  const step = () => {
    stage.step(DT, (d) => {
      clock.t += d;
      ctx.time += d;
      ctx.beginFrame();
      tick(d);
      beams.update(d);
      oldBeams?.update(d);
      guardPeak = Math.max(guardPeak, guard.worldArea.sum(clock.t));
    });
    frame++;
  };
  start();

  /** The scene's beats (its first girl's beam): charge, fire, sustain, end, impact (s). */
  const moments = () => {
    const p = TOON_BEAM_PRESETS[actorsFor[0].pid];
    const land = p.windup + p.grow;
    const st = actorsFor[0];
    const endAt = st.hold ? st.hold[1] : land + 2 / 30 + p.hold;
    return [
      { t: p.windup * 0.62, cap: 'charge' },
      { t: p.windup + p.grow * 0.5, cap: 'fire' },
      { t: land + 1 / 30, cap: 'impact' },
      { t: st.hold ? Math.min(endAt - 0.15, land + 0.45) : land + 2 / 30 + p.hold * 0.6, cap: 'sustain' },
      { t: endAt + p.fade * 0.5, cap: 'end' },
    ].sort((a, b) => a.t - b.t);
  };
  const info = document.getElementById('info');
  const show = () => {
    const s = beams.stats;
    info.textContent = `${sceneId} · ${quality}${rm ? ' · Reduce Motion' : ''}${old ? ' · today\'s look' : ''} · ${(frame * DT).toFixed(2)} s · calls ${s.calls} · segs ${s.segments} · spots ${s.spots} · ground ${s.ground} · flash ${guard.worldArea.sum(clock.t).toFixed(3)} screens/s`;
  };
  const focusPt = () => {
    const st = actorsFor[0];
    if (focusOn === 'muzzle') return [st.A[0], st.A[1], st.A[2]];
    if (focusOn === 'crown') return [st.B[0], st.B[1], st.B[2]];
    if (sceneId === 'all') return [lay.focus[0], 0.45, lay.focus[1]];
    return [(st.A[0] + st.B[0]) / 2, (st.A[1] + st.B[1]) / 2, (st.A[2] + st.B[2]) / 2];
  };

  // ---- the dark-ink measurement (in the page: no image dependency). A pixel the effect changed (any channel off the
  // board without it by ≥ 10) is "dark" when its luma is under 0.2 and the effect did not brighten it (a translucent
  // band over a dark outline is not ink); dark pixels are joined 8-connected, and a
  // component under 40 px that touches no colour pixel of the effect (luma ≥ 0.2) is a loose dark-ink fragment.
  const gl = stage.renderer.getContext();
  const N = W * H;
  const base = new Uint8Array(N * 4);
  const px = new Uint8Array(N * 4);
  const cls = new Uint8Array(N);
  const seen = new Uint8Array(N);
  const stack = new Int32Array(N);
  const read = (out) => gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, out);
  let settled = false;
  const meshes = [...beams.meshes];
  // each girl's face: the top 42 % of her figure's box, on screen (static figures: worked out once)
  const faces = girls.map((g) => {
    const box = new THREE.Box3().setFromObject(g.model);
    const y0 = box.max.y - (box.max.y - box.min.y) * 0.42;
    let x0 = Infinity;
    let x1 = -Infinity;
    let s0 = Infinity;
    let s1 = -Infinity;
    for (const x of [box.min.x, box.max.x]) for (const y of [y0, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const [sx, sy] = stage.toScreen(x, y, z);
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); s0 = Math.min(s0, sy); s1 = Math.max(s1, sy);
    }
    return { id: g.id, x0: Math.floor(x0), x1: Math.ceil(x1), y0: Math.floor(s0), y1: Math.ceil(s1) };
  });
  const baseline = () => {
    const vis = meshes.map((m) => m.visible);
    for (const m of meshes) m.visible = false;
    stage.render();
    read(base);
    meshes.forEach((m, i) => { m.visible = vis[i]; });
  };
  function analyse(maxSize = 40) {
    for (let i = 0; i < N; i++) {
      const o = i * 4;
      const d = Math.max(Math.abs(px[o] - base[o]), Math.abs(px[o + 1] - base[o + 1]), Math.abs(px[o + 2] - base[o + 2]));
      if (d < 10) cls[i] = 0;
      else {
        // dark ink: under 0.2 luma and made darker by the beams (a translucent band over a dark outline is not ink)
        const y = (0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]) / 255;
        const y0 = (0.2126 * base[o] + 0.7152 * base[o + 1] + 0.0722 * base[o + 2]) / 255;
        cls[i] = y < 0.2 && y <= y0 + 0.01 ? 1 : 2;
      }
    }
    seen.fill(0);
    const frags = [];
    let dark = 0;
    for (let i = 0; i < N; i++) {
      if (cls[i] !== 1 || seen[i]) continue;
      let sp = 0;
      stack[sp++] = i;
      seen[i] = 1;
      let size = 0;
      let touch = false;
      let sx = 0;
      let sy = 0;
      let y0min = 1;
      let y1min = 1;
      let bx0 = W;
      let bx1 = 0;
      let by0 = H;
      let by1 = 0;
      while (sp > 0) {
        const k = stack[--sp];
        size++;
        const x = k % W;
        const y = (k - x) / W;
        sx += x;
        sy += y;
        if (x < bx0) bx0 = x;
        if (x > bx1) bx1 = x;
        if (y < by0) by0 = y;
        if (y > by1) by1 = y;
        const o4 = k * 4;
        y0min = Math.min(y0min, (0.2126 * base[o4] + 0.7152 * base[o4 + 1] + 0.0722 * base[o4 + 2]) / 255);
        y1min = Math.min(y1min, (0.2126 * px[o4] + 0.7152 * px[o4 + 1] + 0.0722 * px[o4 + 2]) / 255);
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= H) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= W || (dx === 0 && dy === 0)) continue;
            const q = yy * W + xx;
            if (cls[q] === 2) touch = true;
            else if (cls[q] === 1 && !seen[q]) {
              seen[q] = 1;
              stack[sp++] = q;
            }
          }
        }
      }
      dark++;
      if (size < maxSize && !touch) frags.push({ x: Math.round(sx / size), y: H - 1 - Math.round(sy / size), size, box: [bx0, H - 1 - by1, bx1, H - 1 - by0], before: +y0min.toFixed(3), after: +y1min.toFixed(3) });
    }
    // dark effect pixels over a girl's face (screen y is flipped against the read rows)
    let face = 0;
    for (const f of faces) {
      for (let y = Math.max(0, f.y0); y <= Math.min(H - 1, f.y1); y++) {
        const row = (H - 1 - y) * W;
        for (let x = Math.max(0, f.x0); x <= Math.min(W - 1, f.x1); x++) if (cls[row + x] === 1) face++;
      }
    }
    return { frags, dark, face };
  }

  window.__lab = {
    ready: true,
    scene: sceneId,
    quality,
    rm,
    old,
    loop: lay.loop,
    moments,
    /** Steps the scene to t seconds (rising order) and draws that frame. */
    shot(t) {
      const target = Math.round(t / DT);
      while (frame < target) step();
      const r = stage.render();
      show();
      return { t: frame * DT, ...beams.stats, frameCalls: r.calls, phases: actorsFor.flatMap((s) => s.recs.map((x) => beams.phase(x))), ...guardStats() };
    },
    /** The focus's screen px (the boards crop round it). */
    screen: () => stage.toScreen(...focusPt()),
    /** A board point's screen px. */
    toScreen: (x, y, z) => stage.toScreen(x, y, z),
    stats: () => ({ ...beams.stats, sceneCalls: stage.calls(), ...guardStats() }),
    /**
     * Waits until the board without the beams is still (its figures' textures decoded: the same pixels three checks in
     * a row, 0.3 s apart), then shoots that board as the dark-ink scan's baseline. Call before inkScan on a fresh page.
     */
    async settle(maxMs = 15000) {
      const t0 = performance.now();
      let last = -1;
      let same = 0;
      while (performance.now() - t0 < maxMs && same < 3) {
        await new Promise((r) => setTimeout(r, 300));
        baseline();
        let hash = 0;
        for (let i = 0; i < base.length; i += 7) hash = (Math.imul(hash, 31) + base[i]) | 0;
        same = hash === last ? same + 1 : 0;
        last = hash;
      }
      settled = true;
      return { ms: Math.round(performance.now() - t0), stable: same >= 3 };
    },
    /**
     * The dark-ink fragments of every frame from now to t s (1/60 s steps, the whole view): { frames, frags (total),
     * worst (most in one frame), examples: [{ t, x, y, size }] }. Call on a fresh page (manual=1): the board without
     * the beams is shot first.
     */
    inkScan(t, maxSize = 40) {
      if (frame === 0 && !settled) {
        stage.render();
        baseline();
      }
      const target = Math.round(t / DT);
      let frames = 0;
      let total = 0;
      let worst = 0;
      let darkMax = 0;
      let faceMax = 0;
      let faceFrames = 0;
      const examples = [];
      while (frame < target) {
        step();
        stage.render();
        read(px);
        const r = analyse(maxSize);
        frames++;
        total += r.frags.length;
        worst = Math.max(worst, r.frags.length);
        darkMax = Math.max(darkMax, r.dark);
        faceMax = Math.max(faceMax, r.face);
        if (r.face > 0) faceFrames++;
        for (const f of r.frags) if (examples.length < 24) examples.push({ t: +(frame * DT).toFixed(3), ...f });
      }
      return { frames, frags: total, worst, darkComponentsMax: darkMax, faceInkMax: faceMax, faceInkFrames: faceFrames, faces, examples, ...guardStats() };
    },
    /**
     * Frame time on this machine (headless SwiftShader: compare runs, nothing absolute about a phone): `n` drawn frames
     * of the board alone, then `n` with the scene running; median ms and draw calls.
     */
    bench(n = 60) {
      const one = new Uint8Array(4);
      const time = (fn) => {
        const ms = [];
        for (let i = 0; i < n; i++) {
          const t0 = performance.now();
          fn(i);
          step();
          stage.render();
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, one);
          ms.push(performance.now() - t0);
        }
        ms.sort((a, b) => a - b);
        return ms[Math.floor(n / 2)];
      };
      beams.clear();
      for (const st of actorsFor) st.recs.length = 0;
      const idle = time(() => {});
      const idleCalls = stage.calls();
      start();
      for (let i = 0; i < 12; i++) step();
      const busy = time(() => {});
      return { idleMs: idle, busyMs: busy, idleCalls, busyCalls: stage.calls(), stats: beams.stats, quality };
    },
  };

  if (manual) return;
  // live: the scene loops; the buttons switch the scene, tier, Reduce Motion and today's look
  const sel = document.getElementById('scene');
  for (const id of SCENES) sel.add(new Option(id, id, id === sceneId, id === sceneId));
  const qs = document.getElementById('quality');
  qs.value = quality;
  const reload = (k, v) => {
    Q.set(k, v);
    location.search = Q.toString();
  };
  sel.onchange = () => reload('scene', sel.value);
  qs.onchange = () => reload('quality', qs.value);
  const rmb = document.getElementById('rm');
  rmb.classList.toggle('on', rm);
  rmb.onclick = () => reload('rm', rm ? '0' : '1');
  const ob = document.getElementById('old');
  ob.classList.toggle('on', old);
  ob.onclick = () => reload('old', old ? '0' : '1');
  document.getElementById('go').onclick = () => start();
  let last = performance.now();
  let since = 0;
  const live = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    since += dt;
    if (since > lay.loop) {
      since = 0;
      start();
    }
    step();
    stage.render();
    show();
    requestAnimationFrame(live);
  };
  requestAnimationFrame(live);
}

main().catch((e) => {
  window.__lab = { ready: false, error: String(e?.stack || e) };
  console.error(e);
});

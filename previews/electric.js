// Electricity lab (dev only; docs/VFX.md "Electricity", batch B2): the electric layer (src/render/vfx/electric.js) on
// the lab patch (previews/vfxLabStage.js: a battle-like board on our own lake look, the battle's lights, camera and
// high's bloom + grade), with real chibis (and goblins for the shocked crackle) for scale. Not wired into the battle.
//
//   /previews/electric.html            live: the scene loops; scene / preset / tier / Reduce Motion buttons
//   ?scene=aura|shock|scorch|drumstorm|surge|all  &quality=high|medium|low  &rm=1  &preset=raika|chika|tenka|seiran|yuzuha
//   &focus=<i> (aura: which girl the crops and close-ups centre on)  &zoom=2.5 (a close-up)  &clean=1 (no buttons)
//   &manual=1: no loop; window.__lab.shot(t) steps the scene to t s and draws it (call in rising order);
//   window.__lab.screen() → the focus's screen px; window.__lab.stats() → draw calls etc.; window.__lab.bench()
//
// The shock scene strikes Raika's live chain (src/render/vfx/lightning.js, its storm preset) through three goblins and
// starts the shocked crackle on each as its hop lands, so the new crackle sits beside the existing chain.
import * as THREE from 'three';
import { createLabStage } from './vfxLabStage.js';
import { createElectricFx } from '../src/render/vfx/electric.js';
import { ELECTRIC_PRESETS, ELECTRIC_CASTS } from '../src/render/vfx/electricPresets.js';
import { createLightningFx } from '../src/render/vfx/lightning.js';
import { LIGHTNING_PRESETS } from '../src/render/vfx/lightningPresets.js';
import { createVisualRandom, visualSeed } from '../src/render/vfx/random.js';
import { UNIT_MAP } from '../src/data/units.js';
import { ENEMIES } from '../src/data/enemies.js';
import { preloadModels, buildChibi, buildEnemy, preloadEnemies } from '../src/models/index.js';

const SCENES = ['aura', 'shock', 'scorch', 'drumstorm', 'surge', 'all'];
const Q = new URLSearchParams(location.search);
const sceneId = SCENES.includes(Q.get('scene')) ? Q.get('scene') : 'all';
const quality = ['high', 'medium', 'low'].includes(Q.get('quality')) ? Q.get('quality') : 'high';
const rm = Q.get('rm') === '1';
const manual = Q.get('manual') === '1';
const zoom = Number(Q.get('zoom') || 1);
const presetQ = ELECTRIC_PRESETS[Q.get('preset')] ? Q.get('preset') : null;
const focusI = Math.max(0, Math.min(4, Number(Q.get('focus') || 0)));
if (Q.get('clean') === '1') document.body.classList.add('clean');

/** The five girls and their presets (the aura scene's row, left to right). */
const ROW = ['raika', 'chika', 'tenka', 'seiran', 'yuzuha'];
const ROW_AT = [[2.7, 2.55], [4.35, 2.55], [6.0, 2.55], [7.65, 2.55], [9.3, 2.55]];
/** Where each scene's focus sits (crops and close-ups centre on it). */
const FOCUS = {
  aura: ROW_AT[focusI],
  shock: [5.6, 3.55],
  scorch: [5.2, 3.5],
  drumstorm: [5.6, 3.2],
  surge: [5.6, 3.2],
  all: [6, 3.2],
};
const focus = FOCUS[sceneId];

const W = innerWidth;
const H = innerHeight;
const canvas = document.getElementById('c');
canvas.width = W;
canvas.height = H;
canvas.style.width = `${W}px`;
canvas.style.height = `${H}px`;
const DT = 1 / 60;
window.__lab = { ready: false };

/** A lab drone stand-in (a small white pod with a cyan visor ring; the battle draws Chika's real drones). */
function droneProp() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), new THREE.MeshToonMaterial({ color: '#f4f8ff' }));
  body.scale.set(1, 0.8, 1);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 8, 20), new THREE.MeshToonMaterial({ color: '#4fd3ff' }));
  ring.rotation.x = Math.PI / 2;
  const ink = new THREE.Mesh(new THREE.SphereGeometry(0.083, 16, 12), new THREE.MeshBasicMaterial({ color: '#1f2a4a', side: THREE.BackSide }));
  ink.scale.set(1, 0.8, 1);
  g.add(ink, body, ring);
  return g;
}

async function main() {
  const stage = await createLabStage({ canvas, width: W, height: H, quality, girl: null, zoom, focus });
  const scene = stage.scene;
  const rand = createVisualRandom(visualSeed('lab', 'electric', sceneId, presetQ || '')).fork('electric');
  const elec = createElectricFx({ scene, camera: stage.camera, quality, reduceMotion: rm, rand });
  elec.setGlow(quality, stage.glow);
  elec.setPixel(stage.rig.scale);
  const lightning = createLightningFx({ scene, batches: stage.batches, atlas: stage.atlas, quality, reduceMotion: rm, rand: rand.fork('chain') });
  lightning.setGlow(quality, stage.glow);
  lightning.setPixel(stage.rig.scale);

  // ---- the cast: chibis for scale (and goblins for the shocked crackle)
  const girls = new Set();
  const needs = { aura: ROW, shock: ['raika'], scorch: ['raika'], drumstorm: ['raika'], surge: ['chika'], all: ['raika', 'chika', 'tenka'] }[sceneId];
  for (const g of needs) girls.add(g);
  try {
    await preloadModels([...girls], { detail: quality === 'high' ? 'full' : 'lod' });
  } catch {
    // (offline: the procedural chibis stand in)
  }
  const place = (id, x, z, ry = 0.35) => {
    const f = buildChibi(UNIT_MAP[id], { quality });
    f.position.set(x, 0, z);
    f.rotation.y = ry;
    scene.add(f);
    f.userData.animate?.(1.0, 0, 'idle');
    return f;
  };
  const goblin = ENEMIES.find((e) => e.family === 'goblin') || ENEMIES[0];
  const foes = [];
  const addFoe = async (x, z) => {
    if (!foes.length) {
      try {
        await preloadEnemies([goblin.family]);
      } catch {
        // (offline: the procedural enemy stands in)
      }
    }
    const m = buildEnemy(goblin, { quality });
    m.position.set(x, 0, z);
    m.rotation.y = -1.2;
    m.scale.setScalar(1.12);
    scene.add(m);
    m.userData.animate?.(0.4, 0, 'walk');
    const h = (m.userData.height || 0.6 * (goblin.size || 1)) * 1.12;
    foes.push({ m, x, z, h });
  };

  // ---- the scenes (each restarts every `loop` s in the live view)
  const drones = [];
  const dronePts = [];
  let chika = null;
  let loop = 3;
  let start = () => {};
  let tick = () => {};
  const pre = (id) => presetQ || id;

  if (sceneId === 'aura') {
    ROW.forEach((id, i) => place(id, ROW_AT[i][0], ROW_AT[i][1]));
    start = () => ROW.forEach((id, i) => elec.aura(pre(id), ROW_AT[i][0], ROW_AT[i][1], { radius: 0.27, height: 0.95, life: loop - 0.2 }));
  } else if (sceneId === 'shock') {
    place('raika', 3.1, 2.45, 0.9);
    await addFoe(5.6, 3.55);
    await addFoe(7.0, 3.2);
    await addFoe(8.45, 3.65);
    loop = 1.6;
    // Raika's live chain through the goblins, then the shocked crackle on each as its hop lands
    const p = LIGHTNING_PRESETS.storm;
    const lands = foes.map((_, i) => 0.05 + i * Math.min(p.hopDelay, 0.24 / foes.length) + p.grow);
    let shocked = 0;
    let since = 0;
    start = () => {
      shocked = 0;
      since = 0;
      lightning.strike([[3.3, 0.78, 2.6], ...foes.map((f) => [f.x, f.h * 0.55, f.z])], { preset: 'storm' });
    };
    tick = (dt) => {
      since += dt;
      while (shocked < foes.length && since >= lands[shocked] - 0.05) {
        const f = foes[shocked];
        elec.shock(pre('raika'), f.x, f.z, { radius: 0.24, height: Math.max(0.5, f.h * 0.95) });
        shocked++;
      }
    };
  } else if (sceneId === 'scorch') {
    place('raika', 6.7, 2.45, 0.2);
    loop = 2.2;
    start = () => {
      elec.scorch(pre('raika'), 5.2, 3.5, { size: 1.15 });
    };
  } else if (sceneId === 'drumstorm') {
    place('raika', 5.6, 3.2, 0.5);
    loop = 2.4;
    start = () => elec.cast('raika.drumstorm', 5.6, 3.2, { duration: 2.1 });
  } else if (sceneId === 'surge') {
    chika = place('chika', 5.6, 3.2, 0.5);
    for (let i = 0; i < 4; i++) {
      const d = droneProp();
      scene.add(d);
      drones.push(d);
      dronePts.push({ x: 0, y: 0, z: 0 });
    }
    loop = 3;
    let t = 0;
    tick = (dt) => {
      t += dt;
      for (let i = 0; i < drones.length; i++) {
        const a = t * 1.1 + (i * Math.PI * 2) / drones.length;
        const r = 0.82 + 0.06 * Math.sin(t * 2.3 + i);
        dronePts[i].x = 5.6 + Math.cos(a) * r;
        dronePts[i].z = 3.2 + Math.sin(a) * r * 0.9;
        dronePts[i].y = 1.02 + 0.07 * Math.sin(t * 3.1 + i * 1.7);
        drones[i].position.set(dronePts[i].x, dronePts[i].y, dronePts[i].z);
        drones[i].rotation.y = -a;
      }
    };
    tick(0);
    start = () => elec.cast('chika.droneSurge', 5.6, 3.2, { points: dronePts, duration: loop - 0.15 });
  } else {
    // all: Raika's Drumstorm, Chika's crackle, Tenka's scorch with her aura
    place('raika', 4.0, 3.0, 0.5);
    place('chika', 7.6, 2.4, 0.3);
    place('tenka', 9.4, 3.9, -0.3);
    loop = 2.6;
    start = () => {
      elec.cast('raika.drumstorm', 4.0, 3.0, { duration: 2.2 });
      elec.aura(pre('chika'), 7.6, 2.4, { life: 2.4 });
      elec.aura(pre('tenka'), 9.4, 3.9, { life: 2.4 });
      elec.scorch(pre('tenka'), 8.6, 3.5);
    };
  }
  void chika;

  let frame = 0;
  const step = () => {
    stage.step(DT, (d) => {
      tick(d);
      elec.update(d);
      lightning.update(d);
    });
    frame++;
  };
  start();
  const info = document.getElementById('info');
  const show = () => {
    const s = elec.stats;
    info.textContent = `${sceneId} · ${quality}${rm ? ' · Reduce Motion' : ''} · ${(frame * DT).toFixed(2)} s · calls ${s.calls} · strokes ${s.strokes} · ground ${s.ground}`;
  };

  window.__lab = {
    ready: true,
    scene: sceneId,
    quality,
    rm,
    /** Steps the scene to t seconds (rising order) and draws that frame. */
    shot(t) {
      const target = Math.round(t / DT);
      while (frame < target) step();
      const r = stage.render();
      show();
      return { t: frame * DT, ...elec.stats, frameCalls: r.calls };
    },
    /** The focus's screen px (the boards crop round it). */
    screen: () => stage.toScreen(focus[0], 0.45, focus[1]),
    stats: () => ({ ...elec.stats, sceneCalls: stage.calls() }),
    /**
     * Frame time on this machine (headless SwiftShader: compare runs, nothing absolute about a phone): `n` drawn frames
     * of the board alone, then `n` with the scene running and `extra` crackling bodies more; median ms and draw calls.
     */
    bench(n = 60, extra = 8) {
      const px = new Uint8Array(4);
      const gl = stage.renderer.getContext();
      const time = (fn) => {
        const ms = [];
        for (let i = 0; i < n; i++) {
          const t0 = performance.now();
          fn(i);
          step();
          stage.render();
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          ms.push(performance.now() - t0);
        }
        ms.sort((a, b) => a - b);
        return ms[Math.floor(n / 2)];
      };
      elec.clear();
      lightning.clear();
      const idle = time(() => {});
      const idleCalls = stage.calls();
      const t0 = performance.now();
      start();
      for (let k = 0; k < extra; k++) elec.aura(ROW[k % ROW.length], 1.5 + k * 1.2, 1.2 + (k % 2) * 4.2, { life: 99 });
      const cpu = performance.now() - t0;
      const busy = time((i) => {
        if (i % 30 === 0) elec.scorch('raika', 2 + (i / 30) * 2, 3.5);
      });
      return { idleMs: idle, busyMs: busy, idleCalls, busyCalls: stage.calls(), stats: elec.stats, startMs: cpu, quality };
    },
  };

  if (manual) return;
  // live: the scene loops; the buttons switch the scene, preset, tier and Reduce Motion
  const sel = document.getElementById('scene');
  for (const id of SCENES) sel.add(new Option(id, id, id === sceneId, id === sceneId));
  const ps = document.getElementById('preset');
  ps.add(new Option('(each girl\'s own)', '', !presetQ, !presetQ));
  for (const id of Object.keys(ELECTRIC_PRESETS)) ps.add(new Option(ELECTRIC_PRESETS[id].label, id, id === presetQ, id === presetQ));
  const qs = document.getElementById('quality');
  qs.value = quality;
  const reload = (k, v) => {
    Q.set(k, v);
    location.search = Q.toString();
  };
  sel.onchange = () => reload('scene', sel.value);
  ps.onchange = () => reload('preset', ps.value);
  qs.onchange = () => reload('quality', qs.value);
  const rmb = document.getElementById('rm');
  rmb.classList.toggle('on', rm);
  rmb.onclick = () => reload('rm', rm ? '0' : '1');
  document.getElementById('go').onclick = () => start();
  void ELECTRIC_CASTS;
  let last = performance.now();
  let since = 0;
  const live = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    since += dt;
    if (since > loop) {
      since = 0;
      start();
    }
    stage.step(dt, (d) => {
      tick(d);
      elec.update(d);
      lightning.update(d);
    });
    frame++;
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

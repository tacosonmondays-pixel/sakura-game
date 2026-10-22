// Dev preview for the 'Lively figures' / 'Clean cel textures' prototype (proto/rig-motion,
// src/models/figureOptions.js). Before / after captures and the frame-cost measurement use it.
//   ?mode=battle    a real Sim + BattleRenderer: girls dropped in one by one, a monster stream,
//                   attacks, two girls stunned at 6 s for 2 s, victory at 10 s
//   ?mode=closeup   three girls up close (Noa, Hikari, Kanna) on a scripted timeline: landing,
//                   idle, a turn, two attacks, a stun, victory
//   ?mode=perf&n=40 N girls on a stage with a monster stream; window.__perf when done
//   &lively=0|1 &cel=0|1 (figureOptions.js URL overrides) &quality=high|medium|low &reduce=1
//   &stage=1-1 &zoom=1.6 (battle) &team=noa,noa,hikari,... &auto=0: no frame loop, the capture
//   script calls window.__step(dt) once per frame (deterministic time)
import * as THREE from 'three';
import { preloadModels, buildChibi } from '../src/models/index.js';
import { getCharacter } from '../src/models/glbChibi.js';
import { setFigureOptions, figureOptions } from '../src/models/figureOptions.js';
import { livelyStats } from '../src/models/livelyRig.js';
import { Sim } from '../src/sim/Sim.js';
import { segDistSq } from '../src/sim/path.js';
import { createBattleRenderer } from '../src/render/BattleRenderer.js';
import { LivelyPose } from '../src/render/livelyPose.js';
import { lerpAngle } from '../src/render/geo.js';
import { VIEWER_LIGHTS } from '../src/models/viewer.js';
import { UNIT_MAP } from '../src/data/units.js';

const params = new URLSearchParams(location.search);
const mode = params.get('mode') || 'battle';
const quality = params.get('quality') || 'high';
const reduce = params.get('reduce') === '1';
const auto = params.get('auto') !== '0';
setFigureOptions({ quality, reduceMotion: reduce });
const opts = figureOptions();
const tag = document.getElementById('tag');
const info = document.getElementById('info');
tag.textContent = `${opts.lively ? 'Lively figures ON' : 'Before (shipped clips)'}${opts.cel ? ' · Clean cel textures' : ''}${reduce ? ' · Reduce motion' : ''}`;
if (params.get('notag') === '1') tag.style.display = 'none';

const ENEMY_STREAM = ['slime_green', 'slime_droplet', 'slime_gold', 'slime_rose', 'slime_iron'];

// ---------------------------------------------------------------------------------------------
// battle + perf: a real Sim and the battle renderer
// ---------------------------------------------------------------------------------------------
function battleTiles(sim, unitFor, n) {
  const W = sim.map.width;
  const H = sim.map.height;
  const paths = sim.pathData;
  const near = [];
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const x = tx + 0.5;
      const y = ty + 0.5;
      let best = Infinity;
      for (const p of paths) {
        const pts = p.points;
        for (let i = 1; i < pts.length; i++) best = Math.min(best, segDistSq(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
      }
      const d = Math.sqrt(best);
      if (d < 0.75 || d > (mode === 'perf' ? 12 : 2.2)) continue;
      near.push({ tx, ty, d, c: Math.hypot(x - W / 2, y - H / 2) });
    }
  }
  near.sort((a, b) => a.c + a.d * 0.5 - (b.c + b.d * 0.5));
  const out = [];
  for (const t of near) {
    if (out.length >= n) break;
    // this slot's girl, or the next one in the team that can stand here (water girls, ...)
    let id = null;
    for (let k = 0; k < 8 && !id; k++) {
      const c = unitFor(out.length + k);
      const chk = sim.canPlace(c, t.tx, t.ty);
      if (chk.ok || chk.reason === 'cash') id = c;
    }
    if (!id) continue;
    // perf: place right away (footprints then block their neighbours, so N really fit)
    if (mode === 'perf') {
      if (!sim.placeTower(id, t.tx, t.ty)) continue;
      t.done = true;
    }
    t.unitId = id;
    out.push(t);
  }
  return out;
}

async function runBattle() {
  const n = Number(params.get('n') || 10);
  const defTeam = mode === 'perf'
    ? ['noa', 'hikari', 'hana', 'ruri', 'aoi', 'kanna', 'akane', 'fuu']
    : ['noa', 'noa', 'noa', 'noa', 'noa', 'hikari', 'hana', 'ruri', 'kanna', 'aoi'];
  const team = (params.get('team') ? params.get('team').split(',') : defTeam).filter((id) => UNIT_MAP[id]);
  const unique = [...new Set(team)];
  await preloadModels(unique, { detail: quality === 'high' ? 'full' : 'lod' });
  const sim = new Sim({ stageId: params.get('stage') || '1-1', difficulty: 'normal', seed: 7, loadout: unique.map((unitId) => ({ unitId })), hero: null, options: { autoStart: false } });
  sim.cash = 1e9;
  sim.lives = 1e6;
  const el = document.getElementById('stage');
  const r = createBattleRenderer(el, sim, { quality, settings: { quality, reduceMotion: reduce, buffIcons: 'off', camera: params.get('zoom') ? 'free' : 'locked', lighting: { exposure: 1, warmth: 0 } }, insets: { top: 0, right: 0, bottom: 0, left: 0 } });
  window.__sim = sim;
  window.__r = r;
  if (params.get('zoom')) {
    const rect = r.canvas.getBoundingClientRect();
    const [zx, zy] = (params.get('at') || '0.5,0.5').split(',').map(Number);
    const steps = Math.round(Math.log(Number(params.get('zoom'))) / 0.15);
    for (let i = 0; i < steps; i++) r.canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: rect.left + rect.width * zx, clientY: rect.top + rect.height * zy, bubbles: true, cancelable: true }));
  }
  // where everyone goes (computed up front so before / after place identically)
  const total = mode === 'perf' ? n : Math.min(n, team.length);
  const slots = battleTiles(sim, (i) => team[i % team.length], total);
  const plan = slots.map((s, i) => ({ ...s, at: mode === 'perf' ? 0 : 0.35 + i * 0.22 }));
  // monsters enter the road a few tiles before the girls (path distance nearest the first slot − 3)
  const spawnDist = (() => {
    if (!slots.length) return 0.5;
    const p = sim.pathData[0];
    let best = Infinity;
    let at = 0;
    for (let i = 1; i < p.points.length; i++) {
      const [ax, ay] = p.points[i - 1];
      const [bx, by] = p.points[i];
      const d = segDistSq(slots[0].tx + 0.5, slots[0].ty + 0.5, ax, ay, bx, by);
      if (d < best) { best = d; at = p.cum[i - 1]; }
    }
    return Math.max(0.5, at - 3);
  })();
  let t = 0;
  let nextSpawn = mode === 'perf' ? 0 : 1.2;
  let spawnI = 0;
  const stunAt = 6;
  const winAt = 10;
  let stunned = false;
  let won = false;
  // the wave clock runs (its own monsters join the stream); a pre-roll puts the first ones on the road
  sim.startNextWave();
  sim.update(0.02);
  function step(dt) {
    t += dt;
    for (const p of plan) {
      if (!p.done && t >= p.at) {
        p.done = true;
        sim.placeTower(p.unitId, p.tx, p.ty);
      }
    }
    if (t >= nextSpawn && (mode === 'perf' || t < winAt - 1.5)) {
      nextSpawn = t + (mode === 'perf' ? 0.35 : 0.7);
      sim.spawnEnemy(ENEMY_STREAM[spawnI++ % ENEMY_STREAM.length], { dist: mode === 'perf' ? 0.5 + (spawnI % 7) * 2 : spawnDist, pathIndex: 0, hpMul: 6 });
    }
    if (mode === 'battle' && !stunned && t >= stunAt) {
      stunned = true;
      // display test: two girls jammed for 2 s (the preview sets the sim field directly)
      for (const tw of sim.towers.slice(1, 3)) tw.disabled = 2;
    }
    if (mode === 'battle' && !won && t >= winAt) {
      won = true;
      sim.events.push({ type: 'won' });
      for (const e of sim.enemies) e.hp = 0;
    }
    sim.update(dt);
    r.update(dt);
  }
  window.__step = (dt = 1 / 30) => step(dt);
  window.__time = () => t;
  if (mode === 'perf') return perfLoop(r, sim, step);
  if (auto) {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      step(dt);
      info.textContent = `${sim.towers.length} girls · ${sim.enemies.length} monsters · t ${t.toFixed(1)} s`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  document.body.dataset.ready = '1';
}

/** Frame cost with N girls: warm-up, then a measured window (CPU time of the renderer's update). */
function perfLoop(r, sim, step) {
  const warm = Number(params.get('warm') || 3);
  const span = Number(params.get('span') || 8);
  let last = performance.now();
  let elapsed = 0;
  const frames = [];
  const cpu = [];
  const lively = [];
  const loop = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const c0 = performance.now();
    step(dt);
    const c1 = performance.now();
    const ls = r.takeLivelyStats();
    elapsed += dt;
    if (elapsed > warm) {
      frames.push(dt * 1000);
      cpu.push(c1 - c0);
      lively.push(ls.ms);
    }
    info.textContent = `${sim.towers.length} girls · ${(dt * 1000).toFixed(1)} ms/frame · lively ${ls.ms.toFixed(3)} ms`;
    if (elapsed < warm + span) requestAnimationFrame(loop);
    else {
      const avg = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
      const pct = (a, p) => [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) * p)] || 0;
      window.__perf = {
        girls: sim.towers.length, frames: frames.length, quality, lively: opts.lively, cel: opts.cel,
        frameMs: avg(frames), frameP95: pct(frames, 0.95), updateCpuMs: avg(cpu), updateCpuP95: pct(cpu, 0.95),
        livelyMs: avg(lively), livelyP95: pct(lively, 0.95), calls: r.info.calls, triangles: r.info.triangles,
      };
      info.textContent = JSON.stringify(window.__perf);
      document.body.dataset.done = '1';
    }
  };
  requestAnimationFrame(loop);
  document.body.dataset.ready = '1';
}

// ---------------------------------------------------------------------------------------------
// close-up: three girls on a scripted timeline, battle-like lights, a fixed camera
// ---------------------------------------------------------------------------------------------
async function runCloseup() {
  const ids = (params.get('team') || 'noa,hikari,kanna').split(',').filter((id) => UNIT_MAP[id]);
  await preloadModels(ids, { detail: 'full' });
  const el = document.getElementById('stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#bfe0c9');
  const L = VIEWER_LIGHTS;
  scene.add(new THREE.HemisphereLight(L.hemi.sky, L.hemi.ground, L.hemi.intensity));
  const key = new THREE.DirectionalLight(L.key.color, L.key.intensity);
  key.position.set(...L.key.position);
  scene.add(key);
  const rim = new THREE.DirectionalLight(L.rim.color, L.rim.intensity);
  rim.position.set(...L.rim.position);
  scene.add(rim);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(4, 48), new THREE.MeshLambertMaterial({ color: '#9ccf8a' }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 50);
  const W = () => window.innerWidth;
  const H = () => window.innerHeight;
  const resize = () => {
    renderer.setSize(W(), H(), false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
  };
  resize();
  // a three-quarter look-down, close
  const spacing = 1.05;
  const target = new THREE.Vector3(0, 0.55, 0);
  const pitch = (Number(params.get('pitch') || 20) * Math.PI) / 180;
  const dist = Number(params.get('dist') || 4.3);
  const face = (Number(params.get('face') || 0) * Math.PI) / 180;
  const skirtTest = Number(params.get('skirtTest') || 0);
  camera.position.set(0, target.y + Math.sin(pitch) * dist, Math.cos(pitch) * dist);
  camera.lookAt(target);
  const figs = ids.map((id, i) => {
    const model = buildChibi(UNIT_MAP[id], { quality: 'high', detail: 'full' });
    const scale = 1.0;
    model.position.set((i - (ids.length - 1) / 2) * spacing, 0, 0);
    model.rotation.order = 'YXZ';
    model.scale.setScalar(0.01);
    scene.add(model);
    const f = { id, model, scale, facing: 0, want: 0, pose: null, drive: null, pop: 0, cooldown: 0, lastAttackT: -10, state: 'idle' };
    if (opts.lively) {
      f.pose = new LivelyPose(101 + i);
      f.drive = { turn: 0, engaged: false, windup: 0, fire: 0 };
      model.userData.drive = f.drive;
    }
    return f;
  });
  // timeline (s): turns, attacks (with their 0.22 s charge), stun, victory
  const TURN = [[4.0, 1.2], [5.8, 0]];
  const ATTACKS = [6.6, 7.9];
  const STUN = [9.0, 10.6];
  const WIN = 10.8;
  let t = 0;
  function step(dt) {
    t += dt;
    for (const [i, f] of figs.entries()) {
      for (const [at, yaw] of TURN) if (t >= at) f.want = yaw * (i % 2 ? -1 : 1);
      let state = 'idle';
      if (t >= STUN[0] && t < STUN[1]) state = 'disabled';
      if (t >= WIN) state = 'victory';
      // the charge before each attack (as the sim's cooldown would count down)
      let cd = 0;
      for (const a of ATTACKS) if (t < a && t >= a - 0.6) cd = a - t;
      for (const a of ATTACKS) {
        if (!f[`a${a}`] && t >= a + i * 0.08) {
          f[`a${a}`] = true;
          f.lastAttackT = t;
          f.model.userData.playAttack?.();
          if (f.pose) {
            f.pose.fire(reduce);
            f.drive.fire++;
          }
        }
      }
      const m = f.model;
      if (f.pose) {
        f.facing = lerpAngle(f.facing, f.want, Math.min(1, dt * 6));
        const engaged = t - f.lastAttackT < 1.5 || (cd > 0 && cd < 0.6);
        const windup = engaged && cd > 0 && cd < 0.22 && state !== 'disabled' ? 1 - cd / 0.22 : 0;
        f.drive.turn = f.want - f.facing;
        f.drive.engaged = engaged;
        f.drive.windup = windup;
        f.pose.update(dt, { windup, state, reduceMotion: reduce, low: quality === 'low' });
        const s = f.scale * f.pose.grow;
        m.scale.set(s * f.pose.sxz, s * f.pose.sy, s * f.pose.sxz);
        m.position.y = f.pose.dy;
        m.rotation.x = f.pose.leanRad;
      } else {
        // the shipped behaviour: elastic pop, body turns at 12/s
        f.pop = Math.min(1, f.pop + dt * 3.2);
        const k = f.pop;
        const elastic = k >= 1 ? 1 : 1 - Math.cos(k * Math.PI * 2.5) * Math.exp(-k * 5) * (1 - k);
        m.scale.setScalar(f.scale * Math.max(0.01, elastic));
        f.facing = lerpAngle(f.facing, f.want, Math.min(1, dt * 12));
      }
      m.rotation.y = f.facing + face;
      m.userData.animate?.(t, dt, state);
      if (skirtTest) bendSkirt(f);
    }
    renderer.render(scene, camera);
  }
  // &skirtTest=deg: every runtime skirt panel swung outward by deg (shows which vertices follow)
  function bendSkirt(f) {
    const info = getCharacter(f.id, 'full')?.livelyInfo;
    const ch = info?.chains.find((c) => c.skirt);
    if (!ch) return;
    ch.names.forEach((n, j) => {
      const b = f.model.getObjectByName(n);
      if (!b) return;
      const ax = ch.skirt[j].a.clone().applyQuaternion(ch.links[j].qi);
      b.quaternion.setFromAxisAngle(ax, (skirtTest * Math.PI) / 180);
    });
    f.model.updateMatrixWorld(true);
  }
  window.__step = (dt = 1 / 30) => step(dt);
  window.__time = () => t;
  window.addEventListener('resize', resize);
  if (auto) {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      step(dt);
      info.textContent = `t ${t.toFixed(1)} s · lively ${livelyStats.ms.toFixed(2)} ms`;
      livelyStats.ms = 0;
      if (t > 13) t = 0;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } else step(0);
  document.body.dataset.ready = '1';
}

// ---------------------------------------------------------------------------------------------
// metrics: idle motion of copies of one girl (no drawing): how far the head / chest swing and how
// much the copies move in step. window.__metrics = { perFigure, headRange, chestRange, corr }
// ---------------------------------------------------------------------------------------------
async function runMetrics() {
  const id = params.get('unit') || 'noa';
  const copies = Number(params.get('copies') || 5);
  const secs = Number(params.get('secs') || 12);
  await preloadModels([id], { detail: 'full' });
  const scene = new THREE.Scene();
  const figs = [];
  for (let i = 0; i < copies; i++) {
    const m = buildChibi(UNIT_MAP[id], { quality: 'high', detail: 'full' });
    m.position.x = i * 1.2;
    scene.add(m);
    const bone = (n) => {
      let b = null;
      m.traverse((o) => { if (!b && o.isBone && o.name === n) b = o; });
      return b;
    };
    figs.push({ m, head: bone('head'), chest: bone('chest'), series: { head: [], chest: [], pitch: [] } });
  }
  const dt = 1 / 30;
  const q = new THREE.Quaternion();
  const qr = new THREE.Quaternion();
  const fwd = new THREE.Vector3();
  // cost of the skeleton layer alone: animate every copy for 4 s first (no sampling), timed
  livelyStats.ms = 0;
  livelyStats.figures = 0;
  const t0 = performance.now();
  for (let k = 0; k < 120; k++) for (const f of figs) f.m.userData.animate?.(k * dt, dt, 'idle');
  const animMs = performance.now() - t0;
  const layer = { usPerFigure: +((livelyStats.ms * 1000) / Math.max(1, livelyStats.figures)).toFixed(2), animateUsPerFigure: +((animMs * 1000) / (120 * figs.length)).toFixed(2) };
  for (let k = 0; k < secs * 30; k++) {
    const t = k * dt;
    for (const f of figs) {
      f.m.userData.animate?.(t, dt, 'idle');
      f.m.updateMatrixWorld(true);
      f.m.getWorldQuaternion(qr).invert();
      for (const part of ['head', 'chest']) {
        if (!f[part]) continue;
        f[part].getWorldQuaternion(q).premultiply(qr);
        f.series[part].push(q.clone());
      }
      if (f.head) {
        f.head.getWorldQuaternion(q).premultiply(qr);
        fwd.set(0, 0, 1).applyQuaternion(q);
        f.series.pitch.push(Math.asin(Math.max(-1, Math.min(1, -fwd.y))));
      }
    }
  }
  // range: the largest angle between any two samples of a bone (deg)
  const range = (list) => {
    let max = 0;
    for (let i = 0; i < list.length; i += 3) for (let j = i + 3; j < list.length; j += 3) max = Math.max(max, list[i].angleTo(list[j]));
    return (max * 180) / Math.PI;
  };
  const perFigure = figs.map((f) => ({ head: +range(f.series.head).toFixed(2), chest: +range(f.series.chest).toFixed(2) }));
  const pearson = (a, b) => {
    const n = Math.min(a.length, b.length);
    const ma = a.reduce((s, x) => s + x, 0) / n;
    const mb = b.reduce((s, x) => s + x, 0) / n;
    let num = 0;
    let da = 0;
    let db = 0;
    for (let i = 0; i < n; i++) {
      num += (a[i] - ma) * (b[i] - mb);
      da += (a[i] - ma) ** 2;
      db += (b[i] - mb) ** 2;
    }
    return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 1;
  };
  const cors = [];
  for (let i = 0; i < figs.length; i++) for (let j = i + 1; j < figs.length; j++) cors.push(pearson(figs[i].series.pitch, figs[j].series.pitch));
  const avg = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
  window.__metrics = {
    unit: id, lively: opts.lively, copies, secs, perFigure,
    headRange: +avg(perFigure.map((p) => p.head)).toFixed(2), chestRange: +avg(perFigure.map((p) => p.chest)).toFixed(2),
    corr: +avg(cors).toFixed(3),
    layer,
  };
  info.textContent = JSON.stringify(window.__metrics);
  document.body.dataset.ready = '1';
  document.body.dataset.done = '1';
}

(mode === 'closeup' ? runCloseup() : mode === 'metrics' ? runMetrics() : runBattle()).catch((e) => {
  tag.textContent = `Error: ${e.message}`;
  console.error(e);
});

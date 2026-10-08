// TEMPORARY harness (delete before commit): the owner's Meshy Hikari through the real runtime.
// ?view=close  [&shade=figurine|toon3|soft|unlit|lambert] [&clip=idle&t=0]   ref | front | 3/4
// ?view=face   front | 3/4 | 3/4 at battle pitch 48
// ?view=battle [&stage=1-1&zoom=1&shades=figurine,unlit&with=aoi]  real terrain, camera, light
// ?view=strip  &clip=idle|attack|cheer|hurt|walk &n=6 [&pitch=0|30|48]
import * as THREE from 'three';
import { preloadModels, buildChibi } from '../src/models/index.js';
import { gradientMap, outlineMaterial } from '../src/models/toon.js';
import { CameraRig } from '../src/render/camera.js';
import { buildTerrain, resolveScenery } from '../src/render/terrain.js';
import { resolveLook } from '../src/render/themes.js';
import { Sim } from '../src/sim/Sim.js';
import { UNIT_MAP } from '../src/data/units.js';

const q = new URLSearchParams(location.search);
const view = q.get('view') || 'close';
const quality = q.get('quality') || 'high';
const statusEl = document.getElementById('status');
const labelsEl = document.getElementById('labels');
const status = (s) => { statusEl.textContent = s; };
const HERO_SCALE = 1.36;
const TOWER_SCALE = 1.22;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.info.autoReset = false;
document.getElementById('app').appendChild(renderer.domElement);

function label(x, y, t, sub = '') { const d = document.createElement('div'); d.style.left = `${x}px`; d.style.top = `${y}px`; d.innerHTML = t + (sub ? `<small>${sub}</small>` : ''); labelsEl.append(d); }

function shade(g, mode) {
  if (q.get('ol') === '0') g.traverse((o) => { if (o.userData.isOutline) o.visible = false; });
  if (q.get('lean')) {
    const lean = Number(q.get('lean'));
    g.traverse((o) => { if (o.isBone && o.name === 'neck') o.userData.lean = lean; });
  }
  if (!mode || mode === 'figurine') return g;
  g.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline || o.name !== 'body') return;
    const map = o.material.map;
    if (mode === 'toon3') o.material = new THREE.MeshToonMaterial({ map, gradientMap: gradientMap(3) });
    else if (mode === 'soft') o.material = new THREE.MeshToonMaterial({ map, gradientMap: gradientMap('soft') });
    else if (mode === 'unlit') o.material = new THREE.MeshBasicMaterial({ map });
    else if (mode === 'lambert') o.material = new THREE.MeshLambertMaterial({ map });
    else if (mode === 'std') o.material = new THREE.MeshStandardMaterial({ map, roughness: 0.55, metalness: 0 });
    else if (mode.startsWith('fig')) {
      // figX-<ramp lo>-<color>-<emissive>
      const [, lo, c, e] = mode.split('-').map(Number);
      const ramp = new THREE.DataTexture(new Uint8Array([lo, lo, lo, 255, (lo + 255) / 2, (lo + 255) / 2, (lo + 255) / 2, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
      ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
      o.material = new THREE.MeshToonMaterial({ map, gradientMap: ramp, color: new THREE.Color(c, c, c), emissiveMap: map, emissive: '#ffffff', emissiveIntensity: e });
    }
  });
  return g;
}

/** Deterministic pose: steps the runtime animator to time t in state, or an attack at t. */
function poseAt(g, clip, t) {
  const ud = g.userData;
  const dt = 1 / 60;
  if (clip === 'attack') {
    for (let k = 0; k < 30; k++) ud.animate(k * dt, dt, 'idle');
    ud.playAttack();
    const n = Math.round(t / dt);
    for (let k = 0; k < n; k++) ud.animate(1 + k * dt, dt, 'idle');
    return;
  }
  const state = { idle: 'idle', walk: 'walk', cheer: 'cheer', hurt: 'disabled', victory: 'victory' }[clip] || 'idle';
  // settle the crossfade first, then land exactly on t inside the loop
  ud.animate(0, 0, state);
  for (let k = 0; k < 30; k++) ud.animate(k * dt, dt, state);
  const act = ud.mixer._actions.find((a) => a.isRunning() && a.getEffectiveWeight() > 0.99);
  if (act) { act.time = t % act.getClip().duration; ud.mixer.update(0); }
}

function lightsAt(scene, look, c = new THREE.Vector3()) {
  scene.add(new THREE.HemisphereLight(look.light.sky, look.light.ground, look.light.hemi));
  const key = new THREE.DirectionalLight(look.light.key, look.light.keyI); key.position.set(c.x - 6, 12, c.z + 7); key.target.position.copy(c);
  const fill = new THREE.DirectionalLight(look.light.fill, look.light.fillI); fill.position.set(c.x + 6, 6, c.z - 7); fill.target.position.copy(c);
  scene.add(key, key.target, fill, fill.target);
}
function studio(bg = '#ffffff') { const look = resolveLook('sakura', {}); const s = new THREE.Scene(); s.background = new THREE.Color(bg); lightsAt(s, look); return s; }
function orthoCam(y0, y1, aspect, pitchDeg = 0, yaw = 0) {
  const h = (y1 - y0) / 2; const cam = new THREE.OrthographicCamera(-h * aspect, h * aspect, h, -h, 0.01, 50);
  const p = THREE.MathUtils.degToRad(pitchDeg); const cy = (y0 + y1) / 2;
  cam.position.set(10 * Math.cos(p) * Math.sin(yaw), cy + 10 * Math.sin(p), 10 * Math.cos(p) * Math.cos(yaw)); cam.lookAt(0, cy, 0); return cam;
}
function renderCells(cells) {
  renderer.setScissorTest(true); renderer.info.reset();
  for (const c of cells) {
    const y = innerHeight - c.y - c.h;
    renderer.setViewport(c.x, y, c.w, c.h); renderer.setScissor(c.x, y, c.w, c.h);
    renderer.render(c.scene, c.cam);
  }
  renderer.setScissorTest(false);
}
function refImg(x, y, w, h) { const im = document.createElement('img'); im.className = 'ref'; im.src = '/_owner-chibi/preview.png'; Object.assign(im.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` }); document.body.append(im); }

function hikari(mode, opts = {}) { return shade(buildChibi(UNIT_MAP.hikari, { quality, detail: opts.detail || (quality === 'high' ? 'full' : 'lod') }), mode); }

async function closeView() {
  const mode = q.get('shade');
  const H = 1.53; const W = innerWidth / 3;
  const cells = [];
  refImg(0, 0, W, innerHeight);
  const yaws = [0, Number(q.get('yaw') || 0.6)];
  yaws.forEach((yaw, i) => {
    const s = studio(); const g = hikari(mode); s.add(g); poseAt(g, q.get('clip') || 'idle', Number(q.get('t') || 0));
    cells.push({ scene: s, cam: orthoCam(-0.12, H + 0.12, W / innerHeight, Number(q.get('pitch') || 0), yaw), x: (i + 1) * W, y: 0, w: W, h: innerHeight });
  });
  renderCells(cells);
  label(W / 2, 4, 'Meshy preview.png'); label(W * 1.5, 4, 'in game: front', mode || 'figurine'); label(W * 2.5, 4, 'in game: 3/4');
}

async function faceView() {
  const mode = q.get('shade');
  const W = innerWidth / 3; const cells = [];
  [[0, 0, 'face front'], [0.6, 0, 'face 3/4'], [0.6, 48, 'face 3/4 · battle pitch 48°']].forEach(([yaw, pitch, t], i) => {
    const s = studio(); const g = hikari(mode); s.add(g); poseAt(g, 'idle', 0);
    const y0 = 0.86; const y1 = 1.58;
    cells.push({ scene: s, cam: orthoCam(y0, y1, W / innerHeight, pitch, yaw), x: i * W, y: 0, w: W, h: innerHeight });
    label(i * W + W / 2, 4, t);
  });
  renderCells(cells);
}

async function stripView() {
  const clip = q.get('clip') || 'idle'; const n = Number(q.get('n') || 6);
  const dur = { idle: 1.5, walk: 0.967, attack: 0.6, cheer: 1.2, hurt: 0.4 }[clip];
  const W = innerWidth / n; const cells = [];
  const pitch = Number(q.get('pitch') || 0); const yaw = Number(q.get('yaw') || 0);
  for (let i = 0; i < n; i++) {
    const t = clip === 'attack' ? (dur * i) / (n - 1) : (dur * i) / n;
    const s = studio(); const g = hikari(q.get('shade')); s.add(g); poseAt(g, clip, t);
    cells.push({ scene: s, cam: orthoCam(-0.1, 1.95, W / innerHeight, pitch, yaw), x: i * W, y: 0, w: W, h: innerHeight });
    label(i * W + W / 2, 4, `${clip} ${t.toFixed(2)}s`);
  }
  renderCells(cells);
}

async function battleView() {
  const stageId = q.get('stage') || '1-1';
  const others = (q.get('with') || 'aoi').split(',').filter(Boolean);
  const shades = (q.get('shades') || 'figurine').split(',');
  const sim = new Sim({ stageId, loadout: others.map((u) => ({ unitId: u })), seed: 1 });
  const map = sim.map;
  const familyOf = (id) => { try { return sim.data?.enemy?.(id)?.family || null; } catch { return null; } };
  const scenery = resolveScenery(sim.stage, familyOf);
  const look = resolveLook(map.theme, scenery);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(look.bg);
  scene.add(buildTerrain(map, look, scenery, { shadows: false, quality: 'medium' }).group);
  lightsAt(scene, look, new THREE.Vector3(map.width / 2, 0, map.height / 2));
  const rig = new CameraRig(map); rig.setViewport(innerWidth, innerHeight, { top: 60, bottom: 92 });
  const ids = [...shades.map((s) => `hikari:${s}`), ...others];
  const cx = map.width / 2; const cy = map.height / 2; const cand = [];
  for (let y = 1; y < map.height - 1; y += 0.5) for (let x = 1; x < map.width - 1; x += 0.5) cand.push([x, y]);
  cand.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
  const step = Number(q.get('step') || 1.3);
  const ok = (x, y) => sim.canPlace(others[0] || 'aoi', x, y).ok;
  let spot = cand.find(([x, y]) => ids.every((_, i) => ok(x + i * step, y))) || cand[0];
  const models = ids.map((id, i) => {
    const [uid, mode] = id.split(':');
    const m = uid === 'hikari' ? hikari(mode, { detail: 'lod' }) : buildChibi(UNIT_MAP[uid], { quality: 'medium' });
    m.scale.setScalar(uid === 'hikari' ? HERO_SCALE : TOWER_SCALE);
    m.position.set(spot[0] + i * step, 0.05, spot[1]);
    m.rotation.y = Number(q.get('face') || 0);
    scene.add(m);
    poseAt(m, q.get('clip') || 'idle', Number(q.get('t') || 0.3));
    return m;
  });
  const zoom = Number(q.get('zoom') || 1);
  if (zoom > 1) {
    rig.zoom = zoom;
    const P = new THREE.Vector3(spot[0] + step * (ids.length - 1) / 2 - map.width / 2, 0.55, spot[1] - map.height / 2);
    rig.pan.set(P.dot(rig._right) - rig.baseOffset.x, P.dot(rig._up) - rig.baseOffset.y);
  }
  rig.apply(0);
  const cam = rig.camera;
  scene.updateMatrixWorld(true);
  const pxH = models.map((m) => {
    const box = new THREE.Box3().setFromObject(m, true);
    const a = new THREE.Vector3(m.position.x, box.min.y, m.position.z).project(cam);
    const b = new THREE.Vector3(m.position.x, box.max.y, m.position.z).project(cam);
    return Math.round(Math.abs(b.y - a.y) * 0.5 * innerHeight);
  });
  renderer.info.reset(); renderer.render(scene, cam);
  if (!q.get('nolabel')) models.forEach((m, i) => {
    const p = m.position.clone().setY(-0.02).project(cam);
    label((p.x * 0.5 + 0.5) * innerWidth, (-p.y * 0.5 + 0.5) * innerHeight + 4 + (i % 2) * 24, ids[i], `${pxH[i]} px`);
  });
  status(`battle ${stageId} ${innerWidth}x${innerHeight} zoom ${rig.zoom.toFixed(2)} · px ${ids.map((id, i) => `${id}:${pxH[i]}`).join(' ')} · ${renderer.info.render.calls} calls ${Math.round(renderer.info.render.triangles / 1000)}k tris`);
}

(async () => {
  await preloadModels(['hikari', 'aoi', ...(q.get('with') || '').split(',').filter(Boolean)], { detail: 'full' });
  await preloadModels(['hikari'], { detail: 'lod' });
  if (view === 'close') await closeView();
  else if (view === 'face') await faceView();
  else if (view === 'strip') await stripView();
  else await battleView();
  if (!statusEl.textContent) status(`${view} · ${renderer.info.render.calls} calls ${Math.round(renderer.info.render.triangles / 1000)}k tris`);
  document.body.dataset.ready = '1';
})();

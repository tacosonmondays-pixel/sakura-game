// Dev preview for the V2 GLB enemies (public src/models API).
// ?view=lineup|family|turn|states|hooks|game|viewer  &fam=slime  &id=slime_green  &ids=a,b
// &t=<seconds> freezes animation time (deterministic screenshots)  &quality=high|medium|low
// &page=1|2 (lineup halves)  &labels=0  &proc=1 (force the procedural fallback)
import * as THREE from 'three';
import { makeSilhouette, createModelViewer, buildChibi, preloadModels } from '../src/models/index.js';
import { buildEnemy, preloadEnemies } from '../src/models/enemies.js';
import { ENEMIES, FAMILY_ORDER } from '../src/data/enemies.js';

const params = new URLSearchParams(location.search);
const view = params.get('view') || 'lineup';
const quality = params.get('quality') || 'high';
const fixedT = params.has('t') ? Number(params.get('t')) : null;
const showLabels = params.get('labels') !== '0';
const label = document.getElementById('label');
const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(params.get('bg') || '#dfeeff');
scene.add(new THREE.HemisphereLight('#ffffff', '#c8d4ea', 1.15));
const key = new THREE.DirectionalLight('#fff6ea', 1.7);
key.position.set(2.5, 5, 4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = key.shadow.camera.bottom = -8;
key.shadow.camera.right = key.shadow.camera.top = 8;
key.shadow.bias = -0.0005;
scene.add(key);
const rim = new THREE.DirectionalLight('#bfe0ff', 0.8);
rim.position.set(-3, 2, -4);
scene.add(rim);
const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshToonMaterial({ color: '#a9d8a0' }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

let camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 100);
const actors = [];
window.__preview = { scene, renderer, actors, THREE, get camera() { return camera; } };
const tags = [];
const byId = (id) => ENEMIES.find((e) => e.id === id) || ENEMIES[0];

function frameCamera(fov, pos, look) {
  camera.fov = fov;
  camera.position.set(...pos);
  camera.lookAt(...look);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}

function add(def, x, z, rot = 0, opts = {}) {
  const g = buildEnemy(def, { quality });
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  Object.assign(g.userData, opts);
  scene.add(g);
  actors.push(g);
  if (showLabels && opts.tag !== false) {
    const el = document.createElement('div');
    el.className = 'tag';
    el.textContent = opts.label || def.name;
    app.appendChild(el);
    tags.push({ el, g, h: (g.userData.height || 0.5) + 0.1 });
  }
  return g;
}

async function main() {
  if (params.get('proc') !== '1') await preloadEnemies();
  const glb = actorsGlb();
  const ids = params.get('ids') ? params.get('ids').split(',') : null;
  if (view === 'viewer') {
    renderer.domElement.style.display = 'none';
    app.style.cssText = 'position:fixed;inset:0;display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px;background:#eaf4ff';
    const a = document.createElement('div');
    const b = document.createElement('div');
    a.style.cssText = b.style.cssText = 'border-radius:16px;overflow:hidden;background:#fff';
    app.append(a, b);
    const v1 = createModelViewer(a, { background: ['#bfe3ff', '#ffffff'] });
    v1.setObject(buildEnemy(byId(params.get('id') || 'slime_prince'), { quality }));
    const v2 = createModelViewer(b, { background: null, autoRotate: false });
    const sil = buildEnemy(byId(params.get('id2') || 'dragon_ashwing'), { quality });
    if (params.get('sil') !== '0') makeSilhouette(sil);
    v2.setObject(sil);
    label.textContent = 'viewer';
    document.body.dataset.ready = '1';
    return;
  }
  if (view === 'turn') {
    const def = byId(params.get('id') || 'slime_green');
    const rots = [0, Math.PI * 0.25, Math.PI * 0.5, Math.PI];
    const w = 0.6 * (def.size || 1) * 1.4 + 0.3;
    rots.forEach((r, i) => add(def, (i - 1.5) * w, 0, r, { tag: i === 0, label: def.name }));
    const h = 0.6 * (def.size || 1);
    frameCamera(24, [0, h * 0.9, w * 4.2 + 0.8], [0, h * 0.45, 0]);
  } else if (view === 'states') {
    const def = byId(params.get('id') || 'slime_green');
    const states = ['idle', 'move', 'hit', 'death', 'special', 'cast'];
    const w = 0.6 * (def.size || 1) * 1.5 + 0.3;
    states.forEach((st, i) => {
      const g = add(def, (i - 2.5) * w, 0, 0.3, { label: st, state: st });
      g.userData.primed = false;
    });
    const h = 0.6 * (def.size || 1);
    frameCamera(26, [0, h * 1.1, w * 6 + 0.5], [0, h * 0.4, 0]);
  } else if (view === 'hooks') {
    const cfg = [
      ['slime_green', 'veiled', (g) => g.userData.setVeiled(true)],
      ['construct_aegis', 'barrier', (g) => g.userData.setBarrier(0.8)],
      ['ghost_phantom', 'phasing', (g) => g.userData.setPhasing(true)],
      ['orc_grunt', 'freeze', (g) => g.userData.setStatus({ freeze: { left: 1 } })],
      ['goblin_runner', 'poison', (g) => g.userData.setStatus({ poison: { left: 1 } })],
      ['beast_wolf', 'burn', (g) => g.userData.setStatus({ burn: { left: 1 } })],
      ['oni_brute', 'hit flash', (g) => g.userData.hitFlash()],
      ['dragon_wyvern', 'silhouette', (g) => makeSilhouette(g)],
    ];
    cfg.forEach(([id, name, fn], i) => {
      const g = add(byId(id), (i - 3.5) * 1.0, 0, 0.2, { label: name, hook: fn });
    });
    frameCamera(30, [0, 1.5, 8.2], [0, 0.35, 0]);
  } else if (view === 'family') {
    const fam = params.get('fam') || 'slime';
    const list = ENEMIES.filter((e) => e.family === fam);
    let x = 0;
    const widths = list.map((d) => 0.6 * (d.size || 1) * 1.25 + 0.35);
    const total = widths.reduce((a, b) => a + b, 0);
    list.forEach((def, i) => {
      add(def, x - total / 2 + widths[i] / 2, 0, Number(params.get('rot') || 0.25));
      x += widths[i];
    });
    const aspect = innerWidth / innerHeight;
    const d = Math.max(3, (total + 1) / (2 * Math.tan(THREE.MathUtils.degToRad(14)) * aspect));
    frameCamera(28, [0, d * 0.32, d], [0, 0.4, 0]);
  } else if (view === 'game') {
    const list = ids ? ids.map(byId) : ['slime_green', 'goblin_runner', 'orc_grunt', 'ghost_wisp', 'ghoul_leech', 'oni_haste', 'lizard_hunter', 'construct_cogling', 'beast_wolf', 'fae_sprite', 'plant_seedpod', 'dragon_wyvern', 'slime_prince', 'orc_general'].map(byId);
    list.forEach((def, i) => {
      add(def, (i % 7) * 1.1 - 3.3, Math.floor(i / 7) * 1.5 - 0.5, (i % 3) * 0.7 - 0.7, { tag: false });
    });
    if (params.get('girls') !== '0') {
      await preloadModels(['hikari', 'aoi']);
      const { UNITS } = await import('../src/data/units.js');
      for (const [i, id] of ['hikari', 'aoi'].entries()) {
        const g = buildChibi(UNITS.find((u) => u.id === id), { quality });
        g.position.set(-4.2 + i * 8.4, 0, 0.5);
        g.rotation.y = i ? -0.8 : 0.8;
        scene.add(g);
        actors.push(g);
      }
    }
    const aspect = innerWidth / innerHeight;
    const ortho = new THREE.OrthographicCamera(-4.6, 4.6, 4.6 / aspect, -4.6 / aspect, 0.1, 100);
    ortho.position.set(0, 6.5, 4.6);
    ortho.lookAt(0, 0, 0);
    ortho.zoom = Number(params.get('zoom') || 1.5);
    ortho.updateProjectionMatrix();
    camera = ortho;
  } else {
    // lineup: family rows, three families per page so every face is readable
    const page = Number(params.get('page') || 1);
    const per = Number(params.get('per') || 3);
    const fams = FAMILY_ORDER.filter((_, i) => Math.floor(i / per) === page - 1);
    const rowGap = 1.75;
    let row = 0;
    let maxW = 0;
    for (const fam of fams) {
      const list = ENEMIES.filter((e) => e.family === fam);
      const widths = list.map((d) => Math.min(2.4, 0.6 * (d.size || 1) * 1.15 + 0.38));
      const total = widths.reduce((a, b) => a + b, 0);
      maxW = Math.max(maxW, total);
      let x = 0;
      list.forEach((def, i) => {
        add(def, x - total / 2 + widths[i] / 2, -row * rowGap, 0.22);
        x += widths[i];
      });
      row++;
    }
    const depth = (row - 1) * rowGap;
    const aspect = innerWidth / innerHeight;
    const d = Math.max(4, (maxW + 1.0) / (2 * Math.tan(THREE.MathUtils.degToRad(16)) * aspect));
    frameCamera(32, [0, d * 0.7 + depth * 0.35, d * 0.75 + 1.2], [0, 0.25, -depth * 0.5]);
  }
  label.textContent = `${view} · ${glb ? 'GLB enemies' : 'procedural fallback'} · quality ${quality}`;
  document.body.dataset.ready = '1';
}

function actorsGlb() {
  return params.get('proc') !== '1';
}

const clock = new THREE.Timer();
const tmpV = new THREE.Vector3();
function frame() {
  clock.update();
  const dt = clock.getDelta();
  const t = fixedT ?? clock.getElapsed();
  for (const a of actors) {
    if (a.userData.kind === 'chibi') {
      a.userData.animate?.(t, dt, 'idle');
      continue;
    }
    if (a.userData.hook && !a.userData.hooked) {
      a.userData.hooked = true;
      a.userData.hook(a);
    }
    const st = a.userData.state;
    if (st && !a.userData.primed) {
      a.userData.primed = true;
      const at = Number(params.get('at') || { hit: 0.14, death: 0.7, special: 0.5, cast: 0.5 }[st] || 0.45);
      if (st === 'hit') a.userData.hitFlash?.();
      if (st === 'death') a.userData.playDeath?.();
      if (st === 'special') a.userData.playSpecial?.();
      if (st === 'cast') a.userData.setCasting?.(true);
      const steps = 40;
      for (let k = 0; k < steps; k++) a.userData.animate(k * at / steps, at / steps, { moving: st === 'move', speed: 1 });
      a.userData.freeze = st !== 'idle' && st !== 'move' && st !== 'cast';
      continue;
    }
    if (a.userData.freeze) continue;
    if (fixedT != null) {
      if (!a.userData.stepped) {
        a.userData.stepped = true;
        for (let k = 0; k < Math.round(fixedT / 0.05); k++) a.userData.animate(k * 0.05, 0.05, { moving: st !== 'idle', speed: 1 });
      }
    } else {
      a.userData.animate?.(t, dt, { moving: st ? st === 'move' || st === 'cast' : true, speed: 1 });
    }
  }
  renderer.render(scene, camera);
  for (const tg of tags) {
    tmpV.set(tg.g.position.x, tg.h, tg.g.position.z).project(camera);
    tg.el.style.left = `${(tmpV.x * 0.5 + 0.5) * innerWidth}px`;
    tg.el.style.top = `${(-tmpV.y * 0.5 + 0.5) * innerHeight}px`;
  }
  requestAnimationFrame(frame);
}

main().then(frame);

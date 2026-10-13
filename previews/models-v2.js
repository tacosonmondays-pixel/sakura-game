// Dev preview for the V2 GLB chibis (uses the public src/models API).
// ?view=turn|closeup|thumb|states|faces|game|lineup|viewer  &id=hikari  &ids=a,b  &quality=high|medium|low
// &t=<seconds> freezes animation time (deterministic screenshots)  &bg=#hex | bg=none (transparent, no ground)
// &skin=<skinId> dresses the girl(s) in that outfit (src/data/skins.js)
// &asset=<manifest key> shows that model file directly (e.g. sentinel-aoi, future-tomoe; id = the
//   unit whose rig/animation data to borrow) — used to render the outfit / Coming Soon thumbnails
import * as THREE from 'three';
import { preloadModels, buildChibi, createModelViewer } from '../src/models/index.js';
import { loadCharacter, instantiateCharacter, ensureSkeletonUtils } from '../src/models/glbChibi.js';

const params = new URLSearchParams(location.search);
const view = params.get('view') || 'turn';
const quality = params.get('quality') || 'high';
const fixedT = params.has('t') ? Number(params.get('t')) : null;
const id = params.get('id') || 'hikari';
const label = document.getElementById('label');
const transparent = params.get('bg') === 'none';
const skin = params.get('skin') || null;
const assetKey = params.get('asset') || null;
let assetData = null;

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: transparent, preserveDrawingBuffer: transparent });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = transparent ? null : new THREE.Color(params.get('bg') || '#dfeeff');
if (transparent) {
  renderer.setClearColor(0x000000, 0);
  document.documentElement.style.background = document.body.style.background = 'transparent';
  for (const el of document.querySelectorAll('nav, #label')) el.style.display = 'none';
}
scene.add(new THREE.HemisphereLight('#ffffff', '#c8d4ea', 1.15));
const key = new THREE.DirectionalLight('#fff6ea', 1.7);
key.position.set(2.5, 5, 4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = key.shadow.camera.bottom = -6;
key.shadow.camera.right = key.shadow.camera.top = 6;
key.shadow.bias = -0.0005;
scene.add(key);
const rim = new THREE.DirectionalLight('#bfe0ff', 0.8);
rim.position.set(-3, 2, -4);
scene.add(rim);

const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshToonMaterial({ color: '#a9d8a0' }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
if (!transparent) scene.add(ground);

const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 100);
const actors = [];

function frameCamera(fov, pos, look) {
  camera.fov = fov;
  camera.position.set(...pos);
  camera.lookAt(...look);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}

async function main() {
  const { UNITS } = await import('../src/data/units.js');
  const unit = (uid) => UNITS.find((u) => u.id === uid) || UNITS[0];
  const ids = params.get('ids') ? params.get('ids').split(',') : null;
  if (assetKey) {
    await ensureSkeletonUtils();
    assetData = await loadCharacter(assetKey, quality === 'high' ? 'full' : 'lod');
  }
  // one girl: the asset override, else her (skin's) chibi
  const chibi = (u) => (assetData ? instantiateCharacter(assetData, u, { quality }) : buildChibi(u, { quality, skin }));
  if (view === 'upgrade') {
    // build BEFORE anything is loaded: the procedural placeholder must be swapped for the GLB
    const list = (ids || ['hikari', 'aoi', 'momo']).map(unit);
    list.forEach((u, i) => {
      const g = buildChibi(u, { quality });
      g.position.x = (i - (list.length - 1) / 2) * 0.8;
      scene.add(g);
      actors.push(g);
    });
    frameCamera(24, [0, 0.62, 4.4], [0, 0.5, 0]);
    label.textContent = 'upgrade view: placeholders first, GLBs swap in';
    setTimeout(() => {
      label.textContent = `upgrade view · glb flags: ${actors.map((a) => a.userData.glb ? 1 : 0).join(',')}`;
      document.body.dataset.ready = '1';
    }, 2500);
    return;
  }
  const ok = assetKey ? !!assetData : await preloadModels(ids || (view === 'lineup' || view === 'game' ? null : [id]), skin ? { skins: Object.fromEntries((ids || [id]).map((x) => [x, skin])) } : {});
  label.textContent = `${view} · ${ok ? 'GLB characters' : 'procedural fallback'} · quality ${quality}`;

  if (view === 'viewer') {
    renderer.domElement.style.display = 'none';
    app.style.cssText = 'position:fixed;inset:0;display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px;background:#eaf4ff';
    const a = document.createElement('div');
    const b = document.createElement('div');
    a.style.cssText = b.style.cssText = 'border-radius:16px;overflow:hidden;background:#fff';
    app.append(a, b);
    const v1 = createModelViewer(a, { background: ['#bfe3ff', '#ffffff'] });
    v1.setObject(buildChibi(unit(id), { quality }));
    const v2 = createModelViewer(b, { background: null, autoRotate: false });
    const g = buildChibi(unit(params.get('id2') || 'aoi'), { quality });
    v2.setObject(g);
    v2.setState(params.get('state') || 'idle');
    document.body.dataset.ready = '1';
    return;
  }
  if (view === 'turn') {
    // front / 3-4 / side / back, large
    const rots = [0, Math.PI * 0.25, Math.PI * 0.5, Math.PI];
    rots.forEach((r, i) => {
      const g = buildChibi(unit(id), { quality });
      g.position.x = (i - 1.5) * 0.9;
      g.rotation.y = r;
      scene.add(g);
      actors.push(g);
    });
    frameCamera(24, [0, 0.62, 4.4], [0, 0.5, 0]);
  } else if (view === 'closeup') {
    const g = chibi(unit(id));
    g.rotation.y = Number(params.get('rot') || 0.3);
    scene.add(g);
    actors.push(g);
    frameCamera(22, [0.15, 0.78, 1.9], [0, 0.66, 0]);
  } else if (view === 'thumb') {
    // full figure, 4:5 card framing (outfit thumbnails: render at 640x800, scale to 320x400)
    const g = chibi(unit(id));
    g.rotation.y = Number(params.get('rot') || 0.35);
    scene.add(g);
    actors.push(g);
    const h = g.userData.height || 0.9;
    frameCamera(20, [0.1, h * 0.62, 4.4 * h], [0, h * 0.5, 0]);
  } else if (view === 'states') {
    const states = ['idle', 'attack', 'cheer', 'victory', 'disabled', 'walk', 'pickup'];
    states.forEach((st, i) => {
      const g = buildChibi(unit(id), { quality });
      g.position.x = (i - 3) * 0.78;
      g.userData.fixedState = st;
      if (st === 'attack') g.userData.attackAt = Number(params.get('at') || 0.45);
      scene.add(g);
      actors.push(g);
    });
    frameCamera(26, [0, 0.8, 5.4], [0, 0.45, 0]);
  } else if (view === 'faces') {
    const cells = ['idle', 'blink', 'attack', 'happy', 'hurt', 'dizzy', 'wink', 'shy', 'surprised'];
    cells.forEach((c, i) => {
      const g = buildChibi(unit(id), { quality });
      g.position.x = (i - 4) * 0.5;
      g.userData.expr = c;
      scene.add(g);
      actors.push(g);
    });
    frameCamera(18, [0, 0.72, 6.0], [0, 0.66, 0]);
  } else if (view === 'row') {
    // up to 5 girls close enough to judge faces and costumes
    const list = (ids || ['hikari', 'luna', 'nami', 'aoi', 'rei']).map(unit);
    list.forEach((u, i) => {
      const g = buildChibi(u, { quality, skin });
      g.position.x = (i - (list.length - 1) / 2) * 0.78;
      g.rotation.y = Number(params.get('rot') || 0);
      scene.add(g);
      actors.push(g);
    });
    frameCamera(24, [0, 0.62, 4.6], [0, 0.5, 0]);
  } else if (view === 'game') {
    // the battle renderer's angled orthographic look at tower scale
    const list = ids ? ids.map(unit) : UNITS.slice(0, 9);
    list.forEach((u, i) => {
      const g = buildChibi(u, { quality });
      g.position.set((i % 5) * 1.2 - 2.4, 0, Math.floor(i / 5) * 1.4 - 0.5);
      g.scale.setScalar(0.95);
      g.rotation.y = (i % 3) * 0.6 - 0.6;
      scene.add(g);
      actors.push(g);
    });
    const ortho = new THREE.OrthographicCamera(-4.2, 4.2, 4.2 / (innerWidth / innerHeight), -4.2 / (innerWidth / innerHeight), 0.1, 100);
    ortho.position.set(0, 6.5, 4.6);
    ortho.lookAt(0, 0, 0);
    ortho.zoom = Number(params.get('zoom') || 1.6);
    ortho.updateProjectionMatrix();
    activeCamera = ortho;
  } else {
    const list = ids ? ids.map(unit) : UNITS;
    const perRow = 10;
    list.forEach((u, i) => {
      const g = buildChibi(u, { quality });
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const n = Math.min(perRow, list.length - row * perRow);
      g.position.set((col - (n - 1) / 2) * 0.72 + (row % 2) * 0.36, 0, -row * 1.3);
      scene.add(g);
      actors.push(g);
    });
    frameCamera(30, [0, 2.1, 8.2], [0, 0.35, -0.8]);
  }
  document.body.dataset.ready = '1';
}

let activeCamera = camera;
const clock = new THREE.Timer();
let lastT = 0;
function frame() {
  clock.update();
  const dt = clock.getDelta();
  const t = fixedT ?? clock.getElapsed();
  for (const a of actors) {
    const st = a.userData.fixedState || params.get('state') || 'idle';
    if (a.userData.expr) a.userData.setExpression?.(a.userData.expr);
    if (a.userData.attackAt != null && !a.userData.primed) {
      a.userData.primed = true;
      a.userData.playAttack();
      for (let k = 0; k < 30; k++) a.userData.animate(t, a.userData.attackAt / 30, 'idle');
      a.userData.freeze = true;
    }
    if (a.userData.freeze) continue;
    if (fixedT != null) {
      // deterministic: advance a fixed number of steps once
      if (!a.userData.stepped) {
        a.userData.stepped = true;
        for (let k = 0; k < Math.round(fixedT / 0.05); k++) a.userData.animate(k * 0.05, 0.05, st);
      }
    } else {
      a.userData.animate(t, dt, st);
    }
  }
  renderer.render(scene, activeCamera);
  requestAnimationFrame(frame);
}

main().then(frame);

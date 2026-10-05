// Dev preview for src/models: lineup of all girls + enemy families, and close-ups.
// Query params: ?view=lineup|close|enemies|turn&ids=hikari,aoi&state=idle&t=1.2&quality=high
import * as THREE from 'three';
import { preloadModels, buildChibi, buildEnemy, makeSilhouette, createModelViewer } from '../src/models/index.js';

const params = new URLSearchParams(location.search);
const view = params.get('view') || 'lineup';
const state = params.get('state') || 'idle';
const quality = params.get('quality') || 'high';
const fixedT = params.has('t') ? Number(params.get('t')) : null;

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#cfe8ff');
scene.add(new THREE.HemisphereLight('#ffffff', '#c8d4ea', 1.15));
const key = new THREE.DirectionalLight('#fff6ea', 1.7);
key.position.set(2.5, 5, 4);
scene.add(key);
const rim = new THREE.DirectionalLight('#bfe0ff', 0.8);
rim.position.set(-3, 2, -4);
scene.add(rim);

const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshToonMaterial({ color: '#a9d8a0' }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 100);
const actors = [];

async function main() {
  await preloadModels();
  const { UNITS } = await import('../src/data/units.js');
  let enemyDefs = [];
  try {
    const mods = import.meta.glob('../src/data/enemies.js');
    const loader = mods['../src/data/enemies.js'];
    if (loader) enemyDefs = (await loader()).ENEMIES || [];
  } catch { enemyDefs = []; }
  if (!enemyDefs.length) enemyDefs = SAMPLE_ENEMIES;

  const ids = params.get('ids') ? params.get('ids').split(',') : null;
  if (view === 'viewer') {
    renderer.domElement.style.display = 'none';
    app.style.cssText = 'position:fixed;inset:0;display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px;background:#eaf4ff';
    const a = document.createElement('div');
    const b = document.createElement('div');
    a.style.cssText = b.style.cssText = 'border-radius:16px;overflow:hidden;background:#fff';
    app.append(a, b);
    const v1 = createModelViewer(a, { background: ['#bfe3ff', '#ffffff'] });
    v1.setObject(buildChibi(UNITS.find((u) => u.id === (ids?.[0] || 'hikari')), { quality }));
    const v2 = createModelViewer(b, { background: null });
    const sil = buildEnemy(enemyDefs.find((e) => e.id === (ids?.[1] || 'dragon_ashwing')) || enemyDefs[0], { quality });
    if (params.get('sil') !== '0') makeSilhouette(sil);
    v2.setObject(sil);
    document.body.dataset.ready = '1';
    return;
  }
  if (view === 'states') {
    const u = UNITS.find((x) => x.id === (ids?.[0] || 'hikari'));
    const states = ['idle', 'attack', 'cheer', 'victory', 'disabled'];
    states.forEach((st, i) => {
      const g = buildChibi(u, { quality });
      g.position.x = (i - 2) * 1.0;
      g.userData.fixedState = st;
      if (st === 'attack') g.userData.attackAt = Number(params.get('at') || 0.4);
      scene.add(g);
      actors.push(g);
    });
    camera.position.set(0, 0.7, 4.6);
    camera.lookAt(0, 0.45, 0);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    document.body.dataset.ready = '1';
    return;
  }
  if (view === 'hooks') {
    const pick = (id) => enemyDefs.find((e) => e.id === id) || enemyDefs[0];
    const cfg = [
      ['slime_green', (g) => g.userData.setVeiled(true)],
      ['construct_aegis', (g) => g.userData.setBarrier(0.8)],
      ['ghost_phantom', (g) => g.userData.setPhasing(true)],
      ['orc_grunt', (g) => g.userData.setStatus({ freeze: { left: 1 } })],
      ['goblin_runner', (g) => g.userData.setStatus({ poison: { left: 1 } })],
      ['beast_wolf', (g) => g.userData.setStatus({ burn: { left: 1 } })],
      ['oni_brute', (g) => g.userData.hitFlash()],
      ['dragon_wyvern', (g) => makeSilhouette(g)],
    ];
    cfg.forEach(([id, fn], i) => {
      const g = buildEnemy(pick(id), { quality });
      g.position.x = (i - 3.5) * 1.0;
      fn(g);
      scene.add(g);
      actors.push(g);
    });
    camera.position.set(0, 1.6, 6.5);
    camera.lookAt(0, 0.3, 0);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    document.body.dataset.ready = '1';
    return;
  }
  if (view === 'enemies') {
    const byFamily = new Map();
    for (const e of enemyDefs) {
      if (!byFamily.has(e.family)) byFamily.set(e.family, []);
      byFamily.get(e.family).push(e);
    }
    const famList = [...byFamily.entries()];
    const only = params.get('fam');
    let row = 0;
    for (const [fam, list] of famList) {
      if (only && !only.split(',').includes(fam)) continue;
      const shown = list.slice(0, 8);
      let x = 0;
      const widths = shown.map((d) => Math.max(0.75, 0.45 * (d.size || 1) + 0.35));
      const total = widths.reduce((a, b) => a + b, 0);
      shown.forEach((def, i) => {
        const g = buildEnemy(def, { quality });
        g.position.set(x - total / 2 + widths[i] / 2, 0, -row * 1.5);
        x += widths[i];
        scene.add(g);
        actors.push(g);
      });
      row++;
    }
    const depth = (row - 1) * 1.5;
    camera.fov = 34;
    const wide = Math.max(1, 1.6 / (innerWidth / innerHeight));
    camera.position.set(0, (2.6 + depth * 0.55) * wide, (5.5 + depth * 0.45) * wide);
    camera.lookAt(0, 0.3, -depth * 0.5);
  } else {
    const list = ids ? ids.map((id) => UNITS.find((u) => u.id === id)).filter(Boolean) : UNITS;
    const spacing = view === 'close' ? 1.0 : 1.0;
    const perRow = view === 'close' ? list.length : 10;
    list.forEach((u, i) => {
      const g = buildChibi(u, { quality });
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const n = Math.min(perRow, list.length - row * perRow);
      g.position.set((col - (n - 1) / 2) * spacing + (row % 2) * 0.5, 0, -row * 1.6);
      if (params.get('rot')) g.rotation.y = Number(params.get('rot'));
      scene.add(g);
      actors.push(g);
    });
    if (view === 'lineup') {
      // One representative of every enemy family behind the girls.
      const fams = [...new Set(enemyDefs.map((e) => e.family))];
      fams.forEach((fam, i) => {
        const list = enemyDefs.filter((e) => e.family === fam);
        const def = list.find((e) => e.tier === 'elite') || list[0];
        const g = buildEnemy(def, { quality });
        g.position.set((i - (fams.length - 1) / 2) * 1.05, 0, -5.2);
        scene.add(g);
        actors.push(g);
      });
    }
    if (view === 'close') {
      const w = list.length * spacing;
      const aspect = innerWidth / innerHeight;
      const d = Math.max(2.2, (w + 0.3) / (2 * Math.tan(THREE.MathUtils.degToRad(15)) * aspect));
      camera.position.set(0, 0.62, d);
      camera.lookAt(0, 0.5, 0);
    } else if (view === 'top') {
      camera.position.set(0, 9, 9);
      camera.lookAt(0, 0.3, -0.8);
    } else {
      camera.position.set(0, 6.2, 12.6);
      camera.lookAt(0, 0.1, -2.4);
    }
  }
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  document.body.dataset.ready = '1';
}

const clock = new THREE.Timer();
function frame() {
  clock.update();
  const dt = clock.getDelta();
  const t = fixedT ?? clock.getElapsed();
  for (const a of actors) {
    if (a.userData.kind !== 'chibi') {
      a.userData.animate?.(t, fixedT != null ? 0.016 : dt, { moving: true, speed: 1 });
      continue;
    }
    const st = a.userData.fixedState || state;
    if (a.userData.attackAt != null && !a.userData.primed) {
      // Pose the attack at a fixed fraction for screenshots.
      a.userData.primed = true;
      a.userData.playAttack();
      for (let k = 0; k < 60; k++) a.userData.animate(t, a.userData.attackAt * 0.6 / 60, 'idle');
      a.userData.freeze = true;
    }
    if (a.userData.freeze) continue;
    for (let k = 0; k < (fixedT != null ? 20 : 1); k++) a.userData.animate(t, fixedT != null ? 0.05 : dt, st === 'attack' ? 'idle' : st);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

const SAMPLE_ENEMIES = [
  ['slime_green', 'slime', 'green', [], '#7bd389', '#3fa35b', 1, 'normal', {}],
  ['slime_violet', 'slime', 'veiled', [], '#b197fc', '#7950f2', 1, 'normal', { veiled: true }],
  ['slime_iron', 'slime', 'iron', ['helmet'], '#adb5bd', '#495057', 1, 'normal', {}],
  ['slime_rose', 'slime', 'rose', [], '#ff8fab', '#d6336c', 1, 'normal', { siphon: { radius: 1, rate: 1 } }],
  ['slime_gold', 'slime', 'gold', [], '#ffd43b', '#f08c00', 1, 'normal', { hasty: { mul: 2, every: 4, duration: 1 } }],
  ['slime_ember', 'slime', 'ember', [], '#ff922b', '#e8590c', 1, 'normal', { volatile: { radius: 1, stun: 1 } }],
  ['slime_prince', 'slime', 'prince', ['crown', 'cape'], '#74c0fc', '#1c7ed6', 2.2, 'miniboss', {}],
  ['goblin_runner', 'goblin', 'runner', [], '#8fd16a', '#5c940d', 0.9, 'normal', {}],
  ['goblin_sapper', 'goblin', 'sapper', ['bomb', 'goggles'], '#94d82d', '#5c940d', 1, 'normal', { sabotage: {} }],
  ['goblin_smoke', 'goblin', 'smoke', ['hood'], '#a9e34b', '#2b8a3e', 1, 'normal', { veiled: true }],
  ['goblin_machine', 'goblin', 'machine', ['mech'], '#ffa94d', '#495057', 2.4, 'miniboss', {}],
  ['orc_ironhide', 'orc', 'ironhide', ['helmet', 'armor'], '#69db7c', '#495057', 1.3, 'normal', {}],
  ['orc_shield', 'orc', 'shieldbearer', ['shield', 'helmet'], '#8ce99a', '#868e96', 1.4, 'elite', { guardian: {} }],
  ['orc_general', 'orc', 'general', ['helmet', 'cape', 'axe'], '#51cf66', '#c92a2a', 2.4, 'miniboss', {}],
  ['ghost_wisp', 'ghost', 'wisp', [], '#d0ebff', '#74c0fc', 0.9, 'normal', { phasing: {} }],
  ['ghost_wraith', 'ghost', 'wraith', ['hood', 'lantern'], '#e5dbff', '#7048e8', 1.2, 'elite', { veiled: true }],
  ['ghoul_siphon', 'ghoul', 'siphon', [], '#a9a3c9', '#5f3dc4', 1.1, 'normal', { siphon: {} }],
  ['ghoul_blink', 'ghoul', 'blinker', [], '#9fa8bd', '#364fc7', 1.1, 'normal', { blink: {} }],
  ['grave_lych', 'ghoul', 'lych', ['crown', 'staff', 'cape'], '#adb5bd', '#7048e8', 3, 'boss', {}],
  ['oni_haste', 'oni', 'haste', ['club'], '#ff6b6b', '#ffd43b', 1.3, 'elite', { field: { kind: 'haste' } }],
  ['oni_shield', 'oni', 'shield', ['mask'], '#748ffc', '#ffd43b', 1.3, 'elite', { field: { kind: 'shield' } }],
  ['oni_champion', 'oni', 'champion', ['club', 'mask'], '#e03131', '#ffd43b', 2.6, 'miniboss', {}],
  ['lizard_marsh', 'lizard', 'marsh', ['spear'], '#63e6be', '#087f5b', 1.1, 'normal', { regen: {} }],
  ['lizard_sunscale', 'lizard', 'sunscale', ['shield'], '#ffa94d', '#c92a2a', 1.2, 'elite', { ward: 'fire' }],
  ['construct_crystal', 'construct', 'crystal', [], '#99e9f2', '#1098ad', 1.2, 'normal', { crystal: { cap: 5, hits: 6 } }],
  ['construct_barrier', 'construct', 'barrier', [], '#bac8ff', '#4263eb', 1.3, 'elite', { barrier: { hp: 100 } }],
  ['iron_colossus', 'construct', 'colossus', [], '#868e96', '#fab005', 3, 'boss', {}],
  ['beast_wolf', 'beast', 'wolf', [], '#adb5bd', '#495057', 1, 'normal', { enrage: {} }],
  ['beast_boar', 'beast', 'boar', ['tusks'], '#a0522d', '#5c3d2e', 1.3, 'elite', { hasty: {} }],
  ['fae_illusionist', 'fae', 'illusionist', [], '#f783ac', '#ae3ec9', 0.9, 'elite', { decoy: {} }],
  ['fae_sprite', 'fae', 'sprite', [], '#99e9f2', '#3bc9db', 0.7, 'normal', {}],
  ['plant_pod', 'plant', 'seedpod', [], '#94d82d', '#e64980', 1, 'normal', { brood: {} }],
  ['plant_thorn', 'plant', 'thornroot', [], '#5c940d', '#862e9c', 1.3, 'normal', {}],
  ['wyvern', 'dragon', 'wyvern', [], '#ff8787', '#862e9c', 1.2, 'elite', { airborne: true }],
  ['ashwing', 'dragon', 'ashwing', [], '#495057', '#ff6b6b', 3, 'boss', { airborne: true, ward: 'fire' }],
].map(([id, family, variant, props, color, accent, size, tier, traits]) => ({
  id, name: id, family, tier, size, color, accent, armor: props.includes('armor') || props.includes('helmet') ? 3 : 0, traits, model: { base: family, variant, props },
}));

main().then(frame);

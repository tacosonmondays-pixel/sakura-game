// Dev preview for the companion figures (public/models/companions, tools/blender/companions/build_companions.py),
// drawn with the girls' runtime look (src/models/glbChibi.js: toon ramp, inverted-hull outline, unlit glow).
// ?view=turn&id=kon                      turnaround: front, 3/4, side, back (+ the battle camera's 48 deg view)
// ?view=clip&id=kon&clip=attack&frames=6 one clip as a frame strip
// ?view=lineup&id=kon[&cam=battle]       next to its girl at true scale, then at its manifest home offset
// ?view=measure                          logs the girls' anchor bones (feet, left shoulder, raised hand) as JSON
// &lod=1 the LOD files · &bg=#hex
import * as THREE from 'three';
import { preloadModels, buildChibi } from '../src/models/index.js';
import { loadCharacter, instantiateCharacter } from '../src/models/glbChibi.js';

const params = new URLSearchParams(location.search);
const view = params.get('view') || 'turn';
const id = params.get('id') || 'kon';
const detail = params.get('lod') === '1' ? 'lod' : 'full';
const label = document.getElementById('label');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(params.get('bg') || '#dfeeff');
scene.add(new THREE.HemisphereLight('#ffffff', '#c8d4ea', 1.15));
const key = new THREE.DirectionalLight('#fff6ea', 1.7);
key.position.set(2.5, 5, 4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = key.shadow.camera.bottom = -3;
key.shadow.camera.right = key.shadow.camera.top = 3;
key.shadow.bias = -0.0005;
scene.add(key);
const rim = new THREE.DirectionalLight('#bfe0ff', 0.8);
rim.position.set(-3, 2, -4);
scene.add(rim);
const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshToonMaterial({ color: '#a9d8a0' }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const camera = new THREE.PerspectiveCamera(24, innerWidth / innerHeight, 0.01, 100);

const manifest = await fetch('../models/companions/manifest.json').then((r) => r.json());

/** A companion instance (the girls' runtime path; the file lives next to the characters folder). */
async function companion(cid) {
  const asset = await loadCharacter(`../companions/${cid}`, detail);
  if (!asset) throw new Error(`no ${cid}`);
  const g = instantiateCharacter(asset, { id: cid }, { quality: 'high' });
  const holo = asset.extras.holo;
  if (holo) {
    // the holographic fox: body + face a little see-through; a depth-only pre-pass first, so only the front
    // surface blends (no inner parts showing through)
    const meshes = [];
    g.traverse((o) => {
      if (o.isMesh && !o.userData.isOutline && (o.name === 'body' || o.name === 'head')) meshes.push(o);
    });
    for (const o of meshes) {
      o.material = o.material.clone();
      o.material.transparent = true;
      o.material.opacity = holo.opacity;
      o.renderOrder = 2;
      const pre = o.clone();
      pre.material = new THREE.MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 });
      pre.renderOrder = 1;
      pre.userData.isOutline = true;
      if (o.isSkinnedMesh) pre.bind(o.skeleton, o.bindMatrix);
      o.parent.add(pre);
    }
  }
  g.userData.asset = asset;
  return g;
}

function pose(g, clip, t) {
  const mixer = g.userData.mixer;
  mixer.stopAllAction();
  const c = g.userData.asset.clips[clip];
  const a = mixer.clipAction(c);
  a.setLoop(THREE.LoopRepeat, Infinity);
  a.reset().play();
  mixer.setTime(Math.min(t, c.duration - 1e-3));
}

async function girl(gid) {
  await preloadModels([gid]);
  const { UNITS } = await import('../src/data/units.js');
  const g = buildChibi(UNITS.find((u) => u.id === gid), { quality: 'high' });
  g.userData.animate?.(0, 0.016, 'idle');
  return g;
}

function girlIdle(g, t = 0) {
  g.userData.mixer?.setTime(t);
}

function frame(fov, pos, look) {
  camera.fov = fov;
  camera.position.set(...pos);
  camera.lookAt(...look);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}

const tags = [];
function tag(text, x, y, z) {
  tags.push({ text, p: new THREE.Vector3(x, y, z) });
}

function render() {
  scene.updateMatrixWorld(true);
  renderer.render(scene, camera);
  for (const t of tags) {
    const v = t.p.clone().project(camera);
    const el = document.createElement('div');
    el.className = 'tag';
    el.textContent = t.text;
    el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
    document.body.appendChild(el);
  }
  document.body.dataset.ready = '1';
}

async function main() {
  const m = manifest[id];
  const h = m ? m.height : 0.2;
  if (view === 'turn') {
    // four angles at eye level + the 48 deg battle view
    const angles = [0, 0.75, Math.PI / 2, Math.PI, -0.6];
    const gap = h * 1.5;
    for (let i = 0; i < angles.length; i++) {
      const g = await companion(id);
      pose(g, 'idle', Number(params.get('t') || 0.4));
      g.rotation.y = angles[i];
      g.position.x = (i - (angles.length - 1) / 2) * gap;
      scene.add(g);
    }
    frame(24, [0, h * 1.4, h * 9.5], [0, h * 0.5, 0]);
    label.textContent = `${id} (${detail}) · ${m?.bytes ?? '?'} B · height ${h} m · front, 3/4, side, back, 3/4 left`;
  } else if (view === 'clip') {
    const clip = params.get('clip') || 'idle';
    const n = Number(params.get('frames') || 6);
    const probe = await companion(id);
    const dur = probe.userData.asset.clips[clip].duration;
    const gap = h * Number(params.get('gap') || 1.9);
    for (let i = 0; i < n; i++) {
      const g = i === 0 ? probe : await companion(id);
      const t = (dur * i) / (clip === 'idle' || clip === 'move' ? n : n - 1);
      pose(g, clip, t);
      g.rotation.y = Number(params.get('rot') || 0.9);
      g.position.x = (i - (n - 1) / 2) * gap;
      scene.add(g);
      tag(`${t.toFixed(2)} s`, g.position.x, -h * 0.25, 0);
    }
    frame(24, [0, h * 2.2, h * 11.5], [0, h * 0.55, 0]);
    label.textContent = `${id} · clip ${clip} (${dur.toFixed(2)} s) · ${n} frames`;
  } else if (view === 'lineup') {
    // left: side by side at true scale; right: at the home offset (the girl's idle pose)
    const owner = m.owner;
    const a = await girl(owner);
    a.position.x = -0.55;
    girlIdle(a, 0);
    scene.add(a);
    const c1 = await companion(id);
    pose(c1, 'idle', 0.4);
    c1.position.set(-0.55 + 0.45, 0, 0.0);
    scene.add(c1);
    const b = await girl(owner);
    b.position.x = 0.75;
    girlIdle(b, 0);
    scene.add(b);
    const c2 = await companion(id);
    pose(c2, 'idle', 0.4);
    c2.position.set(0.75 + m.home.offset[0], m.home.offset[1], m.home.offset[2]);
    scene.add(c2);
    tag('true scale', -0.35, -0.08, 0.3);
    tag('at home offset', 0.75, -0.08, 0.3);
    if (params.get('cam') === 'battle') frame(26, [0.1, 0.5 + 4.2 * Math.sin(0.84), 4.2 * Math.cos(0.84)], [0.1, 0.45, 0]); // the 48 deg battle camera
    else frame(26, [0.1, 1.05, 3.9], [0.1, 0.55, 0]);
    label.textContent = `${id} with ${owner} · ${m.home.note}`;
  } else if (view === 'measure') {
    const out = {};
    for (const [gid, bones] of [['ruri', ['root', 'foot_L', 'foot_R', 'toe_L', 'toe_R']], ['hana', ['shoulder_L', 'upper_arm_L', 'neck', 'kaze', 'hand_L']],
      ['yoriko', ['hand_L', 'forearm_L', 'upper_arm_L', 'shoulder_L']]]) {
      const g = await girl(gid);
      scene.add(g);
      const rec = { rest: {}, idle0: {} };
      for (const [k, t] of [['rest', null], ['idle0', 0]]) {
        if (t != null) girlIdle(g, t);
        g.updateMatrixWorld(true);
        for (const b of bones) {
          const o = g.getObjectByName(b);
          if (o) rec[k][b] = o.getWorldPosition(new THREE.Vector3()).toArray().map((x) => +x.toFixed(4));
        }
      }
      // shoulder top: cast down onto her mesh at a few points left of her neck (idle pose)
      if (gid === 'hana') {
        const ray = new THREE.Raycaster();
        rec.shoulderTop = [];
        for (const x of [0.08, 0.11, 0.14, 0.17, 0.2]) {
          ray.set(new THREE.Vector3(x, 3, 0), new THREE.Vector3(0, -1, 0));
          const hit = ray.intersectObject(g, true).find((h2) => !h2.object.userData.isOutline);
          rec.shoulderTop.push([x, hit ? +hit.point.y.toFixed(4) : null, hit ? +hit.point.z.toFixed(4) : null]);
        }
      }
      const box = new THREE.Box3().setFromObject(g);
      rec.box = [box.min.toArray().map((x) => +x.toFixed(3)), box.max.toArray().map((x) => +x.toFixed(3))];
      out[gid] = rec;
      scene.remove(g);
    }
    console.warn(`[measure] ${JSON.stringify(out)}`);
    label.textContent = JSON.stringify(out);
  }
  render();
}

main().catch((e) => {
  label.textContent = `error: ${e.message}`;
  console.error(e);
  document.body.dataset.ready = '1';
});

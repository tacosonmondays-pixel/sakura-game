// Sticker pose bases (tools/stickers/README.md): one girl's in-game chibi GLB, drawn by the game's own loader and toon
// materials, in her cheer clip, a three-quarter front view, flat bright light, no battle halo, on a transparent
// background. The page
// exposes window.renderGirl(id, { clip, at, yaw }) → a PNG data URL (1024 x 1024). Driven by render.mjs.
import * as THREE from 'three';
import { loadCharacter, instantiateCharacter, ensureSkeletonUtils } from '../../src/models/glbChibi.js';
import { UNIT_MAP } from '../../src/data/units.js';

const SIZE = 1024;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.append(renderer.domElement);

window.renderGirl = async (id, { state = 'cheer', at = 0.6, yaw = 0.35, expression = 'happy' } = {}) => {
  await ensureSkeletonUtils();
  const asset = await loadCharacter(id, 'full');
  if (!asset) throw new Error(`no model for ${id}`);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(0.4, 1.2, 2);
  scene.add(key);
  const g = instantiateCharacter(asset, UNIT_MAP[id], { quality: 'high', pose: 'idle' });
  g.rotation.y = yaw;
  // no battle halo on a sticker (the girls' illustrations have none): the halo and its outline share its geometry
  const halos = new Set();
  g.traverse((o) => { if (o.isMesh && o.name === 'halo') halos.add(o.geometry); });
  g.traverse((o) => { if (o.isMesh && halos.has(o.geometry)) o.visible = false; });
  scene.add(g);
  // run her clip to the moment we want (fixed steps: the same pose every time)
  const steps = Math.round(at / (1 / 60));
  for (let i = 0; i <= steps; i++) g.userData.animate(i / 60, 1 / 60, state);
  g.userData.setExpression?.(expression);
  g.userData.animate(at, 0, state);
  // frame her: the box of the posed figure, a slightly low camera so the head reads big
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g, true);
  const c = box.getCenter(new THREE.Vector3());
  const s = box.getSize(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(22, 1, 0.01, 100);
  const dist = (Math.max(s.y, s.x) * 0.58) / Math.tan(THREE.MathUtils.degToRad(11));
  cam.position.set(c.x, c.y + s.y * 0.05, c.z + dist);
  cam.lookAt(c.x, c.y, c.z);
  renderer.render(scene, cam);
  return renderer.domElement.toDataURL('image/png');
};
window.renderReady = true;

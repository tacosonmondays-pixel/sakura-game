// Clan boss portrait: a still of the boss's own 3D model (the bestiary's lighting and framing),
// rendered once per boss into a data URL. three.js and the enemy GLBs load lazily (the clan
// screen should not pull the battle renderer into its chunk); until the still is ready — or if
// WebGL is missing — the caller keeps showing its placeholder.
import { ENEMY_MAP } from '../../data/enemies.js';

const cache = new Map();
const LOAD_TIMEOUT_MS = 8000;

/**
 * @param {string} enemyId e.g. 'dragon_ashwing'
 * @param {number} [size] square pixel size
 * @returns {Promise<string|null>} a PNG data URL, or null when it cannot be drawn
 */
export function bossPortrait(enemyId, size = 256) {
  const key = `${enemyId}:${size}`;
  if (!cache.has(key)) cache.set(key, render(enemyId, size).catch((e) => {
    console.warn('[clan] boss portrait failed', enemyId, e);
    return null;
  }));
  return cache.get(key);
}

async function render(enemyId, size) {
  const def = ENEMY_MAP[enemyId];
  if (!def || typeof document === 'undefined') return null;
  const [THREE, models] = await Promise.all([import('three'), import('../../models/index.js')]);
  // the family GLB (procedural fallback when it does not arrive in time)
  await Promise.race([
    Promise.resolve(models.preloadEnemies(models.enemyModelKeys(def))).catch(() => false),
    new Promise((r) => setTimeout(r, LOAD_TIMEOUT_MS)),
  ]);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#c9d3ea', 1.3));
    const key = new THREE.DirectionalLight('#fff4e6', 1.7);
    key.position.set(2.2, 3.5, 3.2);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#ffd0e4', 1.1);
    rim.position.set(-2.5, 2, -3);
    scene.add(rim);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    const model = models.buildEnemy(def, { quality: 'medium' });
    model.userData.animate?.(0.4, 0, { moving: false, speed: 1 });
    model.rotation.y = 0.6;
    scene.add(model);
    const box = models.drawnBox(model); // frame what is drawn (posed, visible meshes only)
    const sz = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const span = Math.max(sz.x, sz.y, sz.z) * 1.05;
    const dist = (span / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(center.x, center.y + span * 0.16, center.z + dist);
    camera.lookAt(center);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(model);
    models.disposeObject(model);
    return url;
  } finally {
    renderer.dispose();
    renderer.forceContextLoss?.();
  }
}

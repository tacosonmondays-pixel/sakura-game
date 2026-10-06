// buildEnemy (CONTRACT §7): V2 GLB enemies with the V1 procedural builder as fallback.
//
// A family GLB (public/models/enemies/<family>.glb) that is already loaded gives a GLB
// instance right away. Otherwise the procedural enemy is returned as a placeholder and the
// same group is upgraded in place when the family file arrives (node tests / offline keep
// the procedural model). Call `preloadEnemies()` (or `preloadModels()`) before a battle so
// the first wave is already V2.
import { buildEnemyProcedural } from './enemiesProcedural.js';
import { getFamily, loadFamily, canLoadEnemies, instantiateEnemy } from './glbEnemy.js';
import { makeSilhouette } from './util.js';

export { preloadEnemies, enemyUrl, loadFamily, getFamily, ENEMY_FACE_CELLS, visiblePieces } from './glbEnemy.js';

/**
 * Builds an enemy model.
 * @param {object} def EnemyDef ({ id, family, tier, size, color, accent, model: { base, variant, props }, traits })
 * @param {{quality?: 'high'|'medium'|'low'}} [opts]
 * @returns {THREE.Group} feet at y=0, faces +z, height 0.6 × size. userData: animate(time, dt, {moving, speed}),
 *   hitFlash(), setVeiled(b), setBarrier(frac), setPhasing(b), setStatus(map), playDeath() -> seconds,
 *   playSpecial() -> seconds, setCasting(b), height, enemyId, family, glb (true for the V2 model)
 */
export function buildEnemy(def = {}, opts = {}) {
  const family = def.model?.base || def.family || 'slime';
  const asset = getFamily(family);
  if (asset) return instantiateEnemy(asset, def, opts);
  const group = buildEnemyProcedural(def, opts);
  group.userData.glb = false;
  if (canLoadEnemies()) {
    loadFamily(family).then((a) => {
      if (!a || group.userData.disposed || !group.parent) return;
      upgradeInPlace(group, a, def, opts);
    }).catch(() => {});
  }
  const origDispose = group.userData.dispose;
  group.userData.dispose = () => {
    group.userData.disposed = true;
    origDispose?.();
  };
  return group;
}

/** Replaces the procedural placeholder's children with the GLB instance (same group). */
function upgradeInPlace(group, asset, def, opts) {
  let shadows = false;
  group.traverse((o) => { if (o.isMesh && o.castShadow) shadows = true; });
  const oldDispose = group.userData.dispose;
  for (const c of [...group.children]) group.remove(c);
  instantiateEnemy(asset, def, opts, group);
  if (!shadows) group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  try { oldDispose?.(); } catch { /* ignore */ }
  group.userData.disposed = false;
  if (group.userData.silhouette) makeSilhouette(group);
}

// Public API of the models area (CONTRACTS.md §7).
//
// V2: girls are Blender-authored GLBs (public/models/characters/<id>.glb + <id>.lod.glb).
// buildChibi stays synchronous: when a character's GLB is already loaded it is instantiated
// right away; otherwise the procedural V1 chibi is returned as a placeholder and upgraded in
// place when the GLB arrives (node tests / offline keep the procedural fallback).
import { loadBaseBody } from './body.js';
import { buildChibi as buildChibiProc, clearChibiCache } from './chibi.js';
import { makeSilhouette as silhouette } from './util.js';
import {
  getCharacter, loadCharacter, loadManifest, preloadCharacters, instantiateCharacter, ensureSkeletonUtils, skeletonUtilsReady,
  canLoadCharacters, detailFor,
} from './glbChibi.js';

export { CHIBI_HEIGHT } from './chibi.js';
export { buildEnemy, preloadEnemies, enemyUrl } from './enemies.js';
export { makeSilhouette, disposeObject } from './util.js';
export { createModelViewer } from './viewer.js';
export { characterUrl, FACE_CELLS, detailFor } from './glbChibi.js';

let preloaded = null;

/**
 * Loads the character GLBs once; safe to call many times. With no arguments every unit in
 * the manifest is loaded at full detail (a few files at a time, so the first ones arrive
 * fast). `ids` limits the set (recommended: the battle formation); `detail` picks 'full'
 * (quality high) or 'lod' (medium/low). Resolves true when GLB characters are in use,
 * false when only the procedural fallback is available (node, offline, no generated models).
 * @param {string[]|null} [ids]
 * @param {{detail?: 'full'|'lod'}} [opts]
 */
export function preloadModels(ids = null, { detail = 'full' } = {}) {
  if (!preloaded) {
    preloaded = (async () => {
      if (!canLoadCharacters()) return false;
      await ensureSkeletonUtils();
      const manifest = await loadManifest();
      if (!manifest) {
        // no generated characters: fall back to the V1 base body
        const ok = await loadBaseBody();
        if (ok) clearChibiCache();
        return false;
      }
      return preloadCharacters(ids, detail);
    })();
    return preloaded;
  }
  if (ids) return preloaded.then((ok) => preloadCharacters(ids, detail).then((any) => any || ok));
  return preloaded;
}

/**
 * Builds a chibi for a unit definition (synchronous).
 * @param {object} unitDef UnitDef (needs id, palette, look; adult/kind for heroes)
 * @param {{quality?: 'high'|'medium'|'low', pose?: string, detail?: 'full'|'lod'}} [opts]
 *   detail defaults from quality (high -> full, medium/low -> lod). Close-up viewers should pass
 *   `detail: 'full'` even at medium quality.
 * @returns {THREE.Group} feet at y=0, facing +z; userData: animate(time, dt, state), playAttack(),
 *   setHighlight(bool), setExpression(name|null), height, unitId, glb (true when the V2 GLB is shown)
 */
export function buildChibi(unitDef, opts = {}) {
  const quality = opts.quality || 'high';
  const detail = opts.detail || detailFor(quality);
  if (skeletonUtilsReady()) {
    const exact = getCharacter(unitDef.id, detail);
    if (exact) return instantiateCharacter(exact, unitDef, opts);
    // the other detail level is already here: use it now, fetch the preferred one for later
    const other = getCharacter(unitDef.id, detail === 'full' ? 'lod' : 'full');
    if (other) {
      if (canLoadCharacters()) loadCharacter(unitDef.id, detail).catch(() => {});
      return instantiateCharacter(other, unitDef, opts);
    }
  }
  const group = buildChibiProc(unitDef, opts);
  if (canLoadCharacters()) {
    Promise.all([ensureSkeletonUtils(), loadCharacter(unitDef.id, detail)]).then(([, a]) => {
      if (!a || group.userData.disposed || !group.parent) return;
      upgradeInPlace(group, a, unitDef, opts);
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
function upgradeInPlace(group, asset, unitDef, opts) {
  const old = [...group.children];
  let shadows = false;
  group.traverse((o) => { if (o.isMesh && o.castShadow) shadows = true; });
  const oldDispose = group.userData.dispose;
  for (const c of old) group.remove(c);
  instantiateCharacter(asset, unitDef, opts, group);
  if (!shadows) group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  try { oldDispose?.(); } catch { /* ignore */ }
  group.userData.disposed = false;
  if (group.userData.silhouette) silhouette(group);
}

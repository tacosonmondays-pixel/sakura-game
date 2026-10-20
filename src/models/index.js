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
import { resolveSkin } from '../data/skins.js';
import { UNIT_IDS } from '../data/units.js';

export { CHIBI_HEIGHT } from './chibi.js';
export { buildEnemy, preloadEnemies, enemyUrl } from './enemies.js';
export { makeSilhouette, disposeObject } from './util.js';
export { createModelViewer } from './viewer.js';
export { characterUrl, FACE_CELLS, detailFor } from './glbChibi.js';

let preloaded = null;

/**
 * Loads the character GLBs once; safe to call many times. With no arguments every unit of the
 * roster is loaded at full detail in her default outfit (a few files at a time, so the first ones
 * arrive fast; the manifest's outfit and Coming Soon models are not fetched). `ids` limits the
 * set (recommended: the battle formation); `detail` picks 'full' (quality high) or 'lod'
 * (medium/low); `skins` ({ unitId: skinId }) loads those girls' outfit models instead of their
 * defaults. Resolves true when GLB characters are in use, false when only the procedural
 * fallback is available (node, offline, no generated models).
 * @param {string[]|null} [ids]
 * @param {{detail?: 'full'|'lod', skins?: Object<string, string|null>}} [opts]
 */
export function preloadModels(ids = null, { detail = 'full', skins = {} } = {}) {
  // model files (manifest keys) for the units: glbChibi loads every manifest key when given null
  ids = (ids || UNIT_IDS).map((id) => resolveSkin(id, skins?.[id]).asset);
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
  return preloaded.then((ok) => preloadCharacters(ids, detail).then((any) => any || ok));
}

/**
 * Builds a chibi for a unit definition (synchronous).
 * @param {object} unitDef UnitDef (needs id, palette, look; adult/kind for heroes)
 * @param {{quality?: 'high'|'medium'|'low', pose?: string, detail?: 'full'|'lod', skin?: string|object|null}} [opts]
 *   detail defaults from quality (high -> full, medium/low -> lod). Close-up viewers should pass
 *   `detail: 'full'` even at medium quality. skin = SkinDef or skin id (src/data/skins.js); unknown
 *   or another girl's skin falls back to her default outfit.
 * @returns {THREE.Group} feet at y=0, facing +z; userData: animate(time, dt, state), playAttack(),
 *   setHighlight(bool), setExpression(name|null), height, unitId, skinId, glb (true when the V2 GLB is shown)
 */
export function buildChibi(unitDef, opts = {}) {
  const quality = opts.quality || 'high';
  const detail = opts.detail || detailFor(quality);
  const skin = resolveSkin(unitDef.id, opts.skin);
  const key = skin.asset;
  if (skeletonUtilsReady()) {
    const exact = getCharacter(key, detail);
    if (exact) return tagSkin(instantiateCharacter(exact, unitDef, opts), skin);
    // the other detail level is already here: use it now, fetch the preferred one for later
    const other = getCharacter(key, detail === 'full' ? 'lod' : 'full');
    if (other) {
      if (canLoadCharacters()) loadCharacter(key, detail).catch(() => {});
      return tagSkin(instantiateCharacter(other, unitDef, opts), skin);
    }
  }
  // placeholder in the outfit's colours (its frozen palette/look) until the GLB arrives
  const look = skin.palette || skin.look ? { ...unitDef, palette: skin.palette ?? unitDef.palette, look: skin.look ?? unitDef.look } : unitDef;
  const group = tagSkin(buildChibiProc(look, opts), skin);
  if (canLoadCharacters()) {
    Promise.all([ensureSkeletonUtils(), loadCharacter(key, detail)]).then(([, a]) => {
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

function tagSkin(group, skin) {
  group.userData.skinId = skin.id;
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

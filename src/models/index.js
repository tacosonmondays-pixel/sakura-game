// Public API of the models area (CONTRACTS.md §7).
import { loadBaseBody } from './body.js';
import { clearChibiCache } from './chibi.js';

export { buildChibi, CHIBI_HEIGHT } from './chibi.js';
export { buildEnemy } from './enemies.js';
export { makeSilhouette, disposeObject } from './util.js';
export { createModelViewer } from './viewer.js';

let preloaded = null;

/**
 * Loads public/models/chibi_base.glb once (safe to call many times). Resolves to true when
 * the GLB body is in use, false when the procedural fallback body is used.
 */
export function preloadModels() {
  if (!preloaded) {
    preloaded = loadBaseBody().then((ok) => {
      if (ok) clearChibiCache();
      return ok;
    });
  }
  return preloaded;
}

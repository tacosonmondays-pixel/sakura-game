// [ui-ink] The home's living-scene slot (UI v2 "Ink & Paper" V2; the build plan's step 5 and C4, C5). Pure: no DOM,
// no WebGL. The lobby asks liveSceneFor() which host gets a living scene; every other answer is her still portrait.
//
// A living scene plays only for a host who has one (Marumi so far), on High or Medium graphics, with WebGL 2, and
// never under Reduce motion (the game's setting or the system's). Low graphics, Reduce motion, no WebGL 2 or a scene
// that failed to load: her still -cut portrait, with no error toast. The engine (src/ui/lobby/live/engine.js) loads
// by dynamic import, so the lobby's first load does not grow.
//
// C4, the calm set: the one sanctioned exception to "nothing moves on its own" (rule 11), on the home only. On:
// breath, blinks, hair / ribbon / skirt sway, the ball's float, the flame's flicker, the lamps' shimmer, a few motes and
// the fuse's sparks. Off: camera drift, roll and dolly, pointer and gyro parallax (and the iOS motion prompt), the
// petals, the near and far bokeh, the head's sway, the flame's bob, the floor's moving sheen.

/**
 * Hosts with a living scene: id → how to load its definition (dynamic import: fetched only when she hosts), and the side
 * the home's controls take beside it (home layout C, src/ui/lobby/homeLayout.js: her plate puts her right of centre, so
 * the block mirrors to the left; the definition's SIDE says the same, tests/ui/homeLayout.test.js).
 */
export const LIVE_SCENES = Object.freeze({
  marumi: Object.freeze({ id: 'marumi', side: 'l', load: () => import('./live/marumi.js') }),
});

/**
 * @param {string} hostId the secretary
 * @param {{ quality?: string, reduceMotion?: boolean, prefersReduced?: boolean, webgl2?: boolean, failed?: boolean, portrait?: boolean }} [o]
 *   quality: 'high' | 'medium' | 'low' (an unknown value counts as high, as the save's default); failed: her scene
 *   failed to load in this session; portrait: a phone held upright (the rotate prompt's fallback: her scene is
 *   composed for landscape, so she shows still)
 * @returns {{ id: string, side: 'r'|'l', load: () => Promise<object> }|null} null: her still portrait
 */
export function liveSceneFor(hostId, { quality = 'high', reduceMotion = false, prefersReduced = false, webgl2 = false, failed = false, portrait = false } = {}) {
  const scene = LIVE_SCENES[hostId];
  if (!scene) return null;
  if (quality === 'low') return null;
  if (reduceMotion || prefersReduced) return null;
  if (!webgl2 || failed || portrait) return null;
  return scene;
}

/**
 * The calm set's amounts (C4). Everything not in the calm set is 0, at every quality. Medium halves the motes.
 * The proto's values for the rest (px of art, degrees, or a 0-1 strength).
 * @param {string} [quality]
 */
export function calmAmounts(quality = 'high') {
  return Object.freeze({
    breath: 2.4, blink: 1, hair: 3.0, ribbon: 1.6, skirt: 2.4, ball: 1.0, flicker: 0.025, shimmer: 1, sparks: 1,
    motes: quality === 'medium' ? 6 : 12,
    // off (C4)
    head: 0, haloBob: 0, sweep: 0, drift: 0, parallax: 0, roll: 0, dolly: 0, petals: 0, bokehNear: 0, bokehFar: 0, gyro: 0,
  });
}

/** The caps every living scene keeps (the plan's step 5, risks): device pixel ratio, frames per second. */
export const LIVE_CAPS = Object.freeze({ dpr: 1.5, fps: 30 });

/**
 * True when this browser has WebGL 2 at all. (No throwaway context is made: the home keeps one WebGL context at most.
 * A browser that has it but cannot make a context fails in the engine, and the home shows her still portrait.)
 */
export function canWebGL2(win = globalThis) {
  return typeof win?.WebGL2RenderingContext === 'function';
}

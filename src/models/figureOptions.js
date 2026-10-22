// Display-only switches for the girls' 3D figures (prototype proto/rig-motion, owner decision #149:
// "they're super stiff" and "the texture looks obviously generated").
//
//   lively        'Lively figures': procedural secondary motion on top of the baked clips
//                 (src/models/livelyRig.js on the skeleton, src/render/livelyPose.js on the whole
//                 figure in battle): breathing, weight shift, glances, the head leading a turn,
//                 attack anticipation + follow-through, a landing on placement, hair / tail / coat
//                 springs, a dazed sway when disabled, loops out of step with each other.
//   cel           'Clean cel textures': the painted (Meshy) figures drawn as flat colour + one hard
//                 shadow with their texture snapped to its own palette (src/models/celFigure.js),
//                 instead of look B (figurine.js). A comparison for the owner, not a replacement.
//   reduceMotion  the game's Reduce motion setting: the lively layer moves less and slower.
//   quality       'high' everything, 'medium' springs at 30 Hz, 'low' no springs or breathing.
//
// Nothing here is read by the sim (src/sim, the co-op graph of tools/simId.mjs): the figures only
// read sim state. Dev overrides for captures: ?lively=0|1 &cel=0|1 in the page URL.
const opts = { lively: true, cel: false, reduceMotion: false, quality: 'high' };
let urlRead = false;
const urlForced = {};

function readUrl() {
  if (urlRead) return;
  urlRead = true;
  try {
    const q = new URLSearchParams(globalThis.location?.search || '');
    for (const k of ['lively', 'cel']) {
      if (q.has(k)) urlForced[k] = q.get(k) !== '0';
    }
  } catch {
    /* no location (node) */
  }
  Object.assign(opts, urlForced);
}

/** The current figure options (read every frame by the lively layer; do not mutate). */
export function figureOptions() {
  readUrl();
  return opts;
}

/**
 * Updates the options from the saved settings ({ livelyFigures, celTextures, reduceMotion,
 * quality }) or direct keys ({ lively, cel, reduceMotion, quality }). The URL overrides win.
 * Figures built afterwards use the new values (the cel material is picked when a figure is built).
 */
export function setFigureOptions(s = {}) {
  readUrl();
  if (!s || typeof s !== 'object') return opts;
  if (typeof s.livelyFigures === 'boolean') opts.lively = s.livelyFigures;
  if (typeof s.lively === 'boolean') opts.lively = s.lively;
  if (typeof s.celTextures === 'boolean') opts.cel = s.celTextures;
  if (typeof s.cel === 'boolean') opts.cel = s.cel;
  if (typeof s.reduceMotion === 'boolean') opts.reduceMotion = s.reduceMotion;
  if (['high', 'medium', 'low'].includes(s.quality)) opts.quality = s.quality;
  Object.assign(opts, urlForced);
  return opts;
}

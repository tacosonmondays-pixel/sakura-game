// Display-only switches for the girls' 3D figures (prototype proto/rig-motion, owner decision #149:
// "they're super stiff" and "the texture looks obviously generated").
//
//   lively        'Lively figures': procedural secondary motion on top of the baked clips
//                 (src/models/livelyRig.js on the skeleton, src/render/livelyPose.js on the whole
//                 figure in battle): breathing, weight shift, glances, the head leading a turn,
//                 attack anticipation + follow-through, a landing on placement, hair / tail / coat /
//                 bun springs, a dazed sway when disabled, loops out of step with each other.
//   cel           'Clean cel textures': the painted (Meshy) figures drawn as flat colour + one hard
//                 shadow (src/models/celFigure.js) on their offline-flattened base colour where the GLB
//                 carries one (asset.extras.flat: plaid gone, house colours, face protected; Noa first),
//                 else their texture snapped to its own palette. Default ON while the owner decides
//                 (#145 ask-with-defaults); off = the old glossy figurine look B (figurine.js).
//   flat          dev only: false draws the cel look on the painted texture even when a flattened one
//                 exists (for comparisons).
//   reduceMotion  the game's Reduce motion setting: the lively layer moves half as much and slower.
//   quality       'high' everything, 'medium' springs at 30 Hz, 'low' no springs or breathing.
//
// Nothing here is read by the sim (src/sim, the co-op graph of tools/simId.mjs): the figures only
// read sim state. Dev overrides for captures: ?lively=0|1 &cel=0|1 &flat=0|1 in the page URL.
const opts = { lively: true, cel: true, flat: true, reduceMotion: false, quality: 'high' };
let urlRead = false;
const urlForced = {};

function readUrl() {
  if (urlRead) return;
  urlRead = true;
  try {
    const q = new URLSearchParams(globalThis.location?.search || '');
    for (const k of ['lively', 'cel', 'flat']) {
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
 * Updates the options from the saved settings ({ livelyFigures, celFigures, reduceMotion, quality })
 * or direct keys ({ lively, cel, flat, reduceMotion, quality }). The URL overrides win. Figures built
 * afterwards use the new values (the cel material is picked when a figure is built). The prototype's
 * first key `celTextures` (default off) is not read any more: saves stored that default without anyone
 * choosing it, and the new default is the clean cel look.
 */
export function setFigureOptions(s = {}) {
  readUrl();
  if (!s || typeof s !== 'object') return opts;
  if (typeof s.livelyFigures === 'boolean') opts.lively = s.livelyFigures;
  if (typeof s.lively === 'boolean') opts.lively = s.lively;
  if (typeof s.celFigures === 'boolean') opts.cel = s.celFigures;
  if (typeof s.cel === 'boolean') opts.cel = s.cel;
  if (typeof s.flat === 'boolean') opts.flat = s.flat;
  if (typeof s.reduceMotion === 'boolean') opts.reduceMotion = s.reduceMotion;
  if (['high', 'medium', 'low'].includes(s.quality)) opts.quality = s.quality;
  Object.assign(opts, urlForced);
  return opts;
}

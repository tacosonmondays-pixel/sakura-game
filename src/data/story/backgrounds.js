// Story backgrounds (owner: story; STORY_SPEC §1.2.4). Plain data, no DOM.
//
// Kinds:
//   paint  the painted academy (public/art/lobby/academy.webp) under one of the lobby's CSS tints
//   cg     a painted lobby scene with a girl already in it; the player hides portraits while it is up
//   stage  `stage:<stageId>` — a still of that stage's battle map (built by src/ui/story/backdrop.js);
//          not listed here, any campaign stage id works (the content test checks it exists)
//   solid  a flat colour for fades and title cards
//
// Files are relative to public/art/lobby/ (lobbyArtUrl in src/data/lobbyArt.js adds the deploy base).

export const STAGE_BG_PREFIX = 'stage:';

export const BACKGROUNDS = {
  'academy-day': { kind: 'paint', file: 'academy.webp', thumb: 'thumbs/academy.webp', tint: 'day' },
  'academy-sunset': { kind: 'paint', file: 'academy.webp', thumb: 'thumbs/academy.webp', tint: 'sunset' },
  'academy-night': { kind: 'paint', file: 'academy.webp', thumb: 'thumbs/academy.webp', tint: 'night' },
  // Quiet "indoor" talk: the same painting, blurred 8 px and dimmed.
  'academy-soft': { kind: 'paint', file: 'academy.webp', thumb: 'thumbs/academy.webp', tint: 'day', blur: 8, dim: 0.25 },
  'cg:hikari-rampart': { kind: 'cg', file: 'hikari.webp', thumb: 'thumbs/hikari.webp', girl: 'hikari' },
  'cg:aoi-archery': { kind: 'cg', file: 'aoi.webp', thumb: 'thumbs/aoi.webp', girl: 'aoi' },
  'cg:sango-harbour': { kind: 'cg', file: 'sango.webp', thumb: 'thumbs/sango.webp', girl: 'sango' },
  black: { kind: 'solid', color: '#05060a' },
};

export const BACKGROUND_IDS = Object.keys(BACKGROUNDS);

/** Academy tint shown when a chapter's stage still is unavailable (no WebGL, low quality, slow). */
export const CHAPTER_FALLBACK_BG = {
  0: 'academy-day',
  1: 'academy-day',
  2: 'academy-night',
  3: 'academy-sunset',
  4: 'academy-day',
  5: 'academy-night',
  6: 'academy-sunset',
  7: 'academy-night',
  8: 'academy-sunset',
};

/** @returns {string|null} the stage id of a `stage:<id>` background, else null */
export function stageOfBackground(id) {
  if (typeof id !== 'string' || !id.startsWith(STAGE_BG_PREFIX)) return null;
  const stageId = id.slice(STAGE_BG_PREFIX.length);
  return /^[0-9]+-[0-9]+$/.test(stageId) ? stageId : null;
}

/** @returns {boolean} a listed background or a well-formed `stage:<id>` (existence is checked by tests) */
export function isBackgroundId(id) {
  return Object.prototype.hasOwnProperty.call(BACKGROUNDS, id) || stageOfBackground(id) !== null;
}

/** @returns {boolean} the background is a CG (portraits hidden while it is up) */
export function isCgBackground(id) {
  return BACKGROUNDS[id]?.kind === 'cg';
}

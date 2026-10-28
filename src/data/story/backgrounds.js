// Story backgrounds (owner: story; STORY_SPEC §1.2.4). Plain data, no DOM.
//
// Kinds:
//   paint  a painted picture (the lobby's academy, or a story place under public/art/lobby/story/) under one of
//          the lobby's CSS tints; a story place has its time of day painted in, so it takes 'day' (the soft
//          bottom gradient only) and a `focus` (CSS object-position) that keeps its landmark in the open band
//          above the text box on a landscape phone (and its middle on a portrait one)
//   cg     a painted lobby scene with a girl already in it; the player hides portraits while it is up
//   stage  `stage:<stageId>` — that stage's painted place (STAGE_PLACE below); a stage without one falls back to
//          its chapter's academy tint (CHAPTER_FALLBACK_BG). Not listed here: any campaign stage id works (the
//          content test checks it exists)
//   solid  a flat colour for fades and title cards
//
// Files are relative to public/art/lobby/ (lobbyArtUrl in src/data/lobbyArt.js adds the deploy base).

export const STAGE_BG_PREFIX = 'stage:';

/** A story place: public/art/lobby/story/<id>.webp, its 320 px archive thumb, and its focal point. */
function place(id, focus) {
  return { kind: 'paint', file: `story/${id}.webp`, thumb: `story/thumbs/${id}.webp`, tint: 'day', focus };
}

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

  // Story places (Oct 27 set, one picture each; time-of-day variants share a layout). focus = 'x% y%'.
  'academy-courtyard': place('academy-courtyard', '50% 55%'),
  'academy-courtyard-sunset': place('academy-courtyard-sunset', '50% 55%'),
  'academy-courtyard-night': place('academy-courtyard-night', '50% 55%'),
  'academy-gate': place('academy-gate', '50% 60%'),
  'academy-gate-sunset': place('academy-gate-sunset', '50% 60%'),
  'academy-gate-night': place('academy-gate-night', '50% 60%'),
  'common-room': place('common-room', '40% 55%'),
  workshop: place('workshop', '50% 70%'),
  'blossom-court': place('blossom-court', '50% 55%'),
  'blossom-court-sunset': place('blossom-court-sunset', '50% 50%'),
  'blossom-court-night': place('blossom-court-night', '50% 55%'),
  'library-garden': place('library-garden', '70% 45%'),
  lakeshore: place('lakeshore', '50% 55%'),
  'moon-pier': place('moon-pier', '48% 75%'),
  'shrine-steps': place('shrine-steps', '46% 45%'),
  'shrine-bell': place('shrine-bell', '50% 55%'),
  'mountain-pass': place('mountain-pass', '50% 60%'),
  'beacon-gate': place('beacon-gate', '50% 30%'),
  marsh: place('marsh', '50% 75%'),
  'drowned-willow': place('drowned-willow', '50% 65%'),
  foundry: place('foundry', '50% 60%'),
  'sakura-sanctuary': place('sakura-sanctuary', '45% 80%'),
  'festival-street': place('festival-street', '50% 55%'),
  'festival-drum': place('festival-drum', '54% 40%'),
  'base-camp': place('base-camp', '50% 75%'),
  'summit-nest': place('summit-nest', '50% 75%'),
  // Gate Arc, Act 1 (its scenes and stages 1-6 to 1-10 are not written yet)
  'station-plaza': place('station-plaza', '50% 55%'),
  'covered-arcade': place('covered-arcade', '50% 55%'),
  'corner-store': place('corner-store', '50% 60%'),
  'dry-fountain': place('dry-fountain', '50% 75%'),
  shelter: place('shelter', '50% 55%'),
};

export const BACKGROUND_IDS = Object.keys(BACKGROUNDS);

/**
 * The painted place a `stage:<id>` background shows (scenes stay written as `stage:<id>`). Every campaign stage
 * has one, the Gate Arc's Act II stages too (chapter 1's Rush Hour: 1-6 and 1-9 station-plaza, 1-7 covered-arcade,
 * 1-8 corner-store, 1-10 dry-fountain; chapter 2's Hilltop After Dark: 2-6 the shelter (Hilltop is Shelter 3), 2-7 the
 * night jetty, 2-8 the club huts' workshop, 2-9 the school ground at night, 2-10 the lake and its old lamp). A later
 * Act II stage without one shows its map theme's skyline (backdrop.js).
 */
export const STAGE_PLACE = {
  '1-1': 'blossom-court', '1-2': 'blossom-court', '1-3': 'blossom-court', '1-4': 'blossom-court', '1-5': 'blossom-court',
  '1-6': 'station-plaza', '1-7': 'covered-arcade', '1-8': 'corner-store', '1-9': 'station-plaza', '1-10': 'dry-fountain',
  '2-6': 'shelter', '2-7': 'moon-pier', '2-8': 'workshop', '2-9': 'academy-courtyard-night', '2-10': 'lakeshore',
  '2-1': 'lakeshore', '2-2': 'lakeshore', '2-3': 'lakeshore', '2-4': 'moon-pier', '2-5': 'moon-pier',
  '3-1': 'shrine-steps', '3-2': 'shrine-steps', '3-3': 'shrine-steps', '3-4': 'shrine-bell', '3-5': 'shrine-bell',
  '4-1': 'mountain-pass', '4-2': 'mountain-pass', '4-3': 'beacon-gate', '4-4': 'mountain-pass', '4-5': 'beacon-gate',
  '5-1': 'marsh', '5-2': 'marsh', '5-3': 'marsh', '5-4': 'drowned-willow', '5-5': 'drowned-willow',
  '6-1': 'foundry', '6-2': 'foundry', '6-3': 'foundry', '6-4': 'foundry', '6-5': 'foundry',
  '7-1': 'festival-street', '7-2': 'festival-drum', '7-3': 'festival-street', '7-4': 'festival-drum', '7-5': 'festival-drum',
  '8-1': 'base-camp', '8-2': 'base-camp', '8-3': 'summit-nest', '8-4': 'summit-nest', '8-5': 'summit-nest',
};

/**
 * Listed but not used by any scene yet: the old academy looks (kept for scenes that want the lobby painting), the
 * day gate and night fountain variants. The content test keeps this list honest.
 */
export const SPARE_BACKGROUNDS = [
  'academy-soft', 'academy-gate', 'blossom-court-night',
];

/** Academy tint shown for a stage background whose stage has no STAGE_PLACE (and no still). */
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

/**
 * Per-girl vertical nudge (vh, + = lower) for her drawn stand in the scene player, for stands whose head sits
 * higher or lower in the file than the rest (big hair, ears, a hat). Empty entries use 0.
 */
export const STAND_NUDGE = {};

/** @returns {string|null} the painted place a `stage:<id>` background shows, else null */
export function placeOfStage(stageId) {
  const id = STAGE_PLACE[stageId];
  return id && BACKGROUNDS[id] ? id : null;
}

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

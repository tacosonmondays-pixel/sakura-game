// Display-only rules for the enemy models (Enemies v2, route (c); notes in notes/enemies-v2). No three.js
// here, so main.js and the node tests can import it without pulling the renderer in. Nothing in this file
// is read by the battle sim: EnemyDef.size (which also sets the sim hit radius) and every other hashed
// field of src/data/enemies.js stay as they are. The renderer only draws the monsters bigger / lighter.
//
//   displayScale(def)   how much bigger than 0.6 × size the model is drawn: the family's boost for a
//                       normal enemy, half of it for an elite, none for minibosses and bosses
//   displayColors(def)  the body / accent colours the model is tinted with (def.color / def.accent, or a
//                       lighter base for the 8 darkest elites and bosses, whose old colour becomes the
//                       dark outline accent), before the small runtime lift (liftLinear)
//   enemyLook()         'cel' (clean cel, the default) or 'glossy' (the old 3-step toon): follows the
//                       girls' Figure look setting (settings.figureLook) and their URL switch ?cel=0|1
//   enemyReduceMotion() the game's Reduce motion: the enemies' lively layer moves half as much

/**
 * Per-family size boost for normal enemies (display only). Small fodder gets the most, brutes less, and
 * the families that already read big (lizardfolk, dragons, beasts) none, so the fodder-to-brute order
 * stays and nothing but a boss outgrows Hikari (93 px at the default zoom). Orcs got 1.2 instead of the
 * plan's 1.25 after the real path capture: tower-shield bearers at wave spacing touched on the bends.
 * tests/models/enemyDisplay.test.js checks the order against measured heights.
 */
export const FAMILY_BOOST = Object.freeze({
  fae: 1.4,
  ghost: 1.4,
  goblin: 1.35,
  plant: 1.3,
  construct: 1.3,
  ghoul: 1.3,
  slime: 1.15,
  orc: 1.2,
  oni: 1.15,
  lizard: 1,
  dragon: 1,
  beast: 1,
});

/** Share of the family boost each tier gets (elites half, minibosses and bosses none). */
export const TIER_BOOST_SHARE = Object.freeze({ normal: 1, elite: 0.5, miniboss: 0, boss: 0 });

/**
 * Single enemies whose model is tall for its size, held back so they stay under their family's elite:
 * the mimic slime (a chest on top) would otherwise outgrow the Royal Guard.
 */
export const SCALE_OVERRIDE = Object.freeze({ slime_mimic: 1.05 });

/** The family a def is drawn with (the GLB family file it uses). */
export function enemyFamily(def = {}) {
  return def.model?.base || def.family || 'slime';
}

/** Display scale of an enemy model (1 = today's 0.6 × size). */
export function displayScale(def = {}) {
  if (SCALE_OVERRIDE[def.id] != null) return SCALE_OVERRIDE[def.id];
  const boost = FAMILY_BOOST[enemyFamily(def)] ?? 1;
  const share = TIER_BOOST_SHARE[def.tier || 'normal'] ?? 0;
  return 1 + (boost - 1) * share;
}

/**
 * Lighter display base colours for the 8 darkest elites and bosses (they read as black blobs at battle
 * size): the same hue at OKLab lightness 0.47 with 15 % more chroma. Their old colour is kept as the dark
 * outline accent (`line`), so they stay spooky. The accents are unchanged.
 */
export const DARK_LIFT = Object.freeze({
  orc_general: '#50623d',
  beast_alpha: '#565778',
  grave_lych: '#6b3aab',
  dragon_ashwing: '#844454',
  fp_gloom_regent: '#5e4f8c',
  fp_eclipse_wyrm: '#615080',
  fp_hyakki_daimyo: '#8d4036',
  fp_foundry_titan: '#555873',
});

/** { color, accent, line } hex strings the model is tinted with (line = the outline's base colour). */
export function displayColors(def = {}) {
  const color = def.color || '#ffffff';
  const accent = def.accent || color;
  const lifted = DARK_LIFT[def.id];
  return lifted ? { color: lifted, accent, line: color } : { color, accent, line: color };
}

/** The small runtime palette lift: OKLab L + 0.04, chroma × 1.08 (the accent gets half the L lift). */
export const PALETTE_LIFT = Object.freeze({ L: 0.04, chroma: 1.08, accentShare: 0.5 });

const s2l = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** '#rrggbb' → linear [r, g, b]. */
export function hexToLinear(hex = '#ffffff') {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  return [0, 2, 4].map((i) => s2l(parseInt(full.slice(i, i + 2), 16) / 255));
}

export function linearToOklab([r, g, b]) {
  const l = Math.cbrt(Math.max(0, 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b));
  const m = Math.cbrt(Math.max(0, 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b));
  const s = Math.cbrt(Math.max(0, 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b));
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToLinear([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, c)));
}

/** Lifted linear [r, g, b] of a hex colour (share 1 = the body lift, PALETTE_LIFT.accentShare = accents). */
export function liftLinear(hex, share = 1) {
  const [L, a, b] = linearToOklab(hexToLinear(hex));
  const k = 1 + (PALETTE_LIFT.chroma - 1) * share;
  return oklabToLinear([Math.min(0.97, L + PALETTE_LIFT.L * share), a * k, b * k]);
}

// ---------------------------------------------------------------------------
// Look switches (set from the saved settings by main.js; the URL wins for captures)
// ---------------------------------------------------------------------------

const opts = { look: 'cel', reduceMotion: false };
let urlLook = null;
let urlRead = false;

function readUrl() {
  if (urlRead) return;
  urlRead = true;
  try {
    const q = new URLSearchParams(globalThis.location?.search || '');
    // the girls' dev switch (?cel=0|1); ?enemyLook=cel|glossy only for the enemies
    if (q.has('cel')) urlLook = q.get('cel') === '0' ? 'glossy' : 'cel';
    if (q.get('enemyLook') === 'cel' || q.get('enemyLook') === 'glossy') urlLook = q.get('enemyLook');
  } catch {
    /* no location (node) */
  }
}

/**
 * Updates the switches from the saved settings ({ figureLook, reduceMotion }) or direct keys
 * ({ look: 'cel'|'glossy', reduceMotion }). Models built afterwards use them (the material is picked when
 * a monster is built). An unknown or missing figureLook keeps the current look (clean cel by default).
 */
export function setEnemyDisplayOptions(s = {}) {
  if (!s || typeof s !== 'object') return opts;
  const look = s.look ?? s.figureLook;
  if (look === 'cel' || look === 'glossy') opts.look = look;
  if (typeof s.reduceMotion === 'boolean') opts.reduceMotion = s.reduceMotion;
  return opts;
}

/** 'cel' | 'glossy' for the next monster built. */
export function enemyLook() {
  readUrl();
  return urlLook || opts.look;
}

/** The game's Reduce motion (the saved setting, html[data-reduce-motion] or the system preference). */
export function enemyReduceMotion() {
  if (opts.reduceMotion) return true;
  try {
    if (globalThis.document?.documentElement?.hasAttribute('data-reduce-motion')) return true;
    return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

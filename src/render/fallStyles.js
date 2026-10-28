// How a beaten enemy leaves the board (render only; Gate Arc S3a, STEP3_BUILD_PLAN decision 9,
// STORY §7.3 and §15 "How the war is shown").
//
//   sparkle    every monster: the shipped poof with the homeward sparkle (a creature going home)
//   fade       a Brigade trooper: the same fall-and-fade without the homeward sparkle (first light
//              was sung for the wilds; it cannot send a soldier home)
//   sparkFall  the Gnat (a small machine): it breaks apart in a spray of amber sparks
//   breakdown  the Brigade's heavier machines: steam, sparks and scrap that fade with the body
//
// No style leaves anything on the road, and none shows a wound: the Brigade's units are people and
// machines of our own city. The style keys on the enemy def: an explicit `def.fall` wins; otherwise
// the Brigade's ids (`brigade_*`; in Step 3 the Gnat is a construct-family def, so the id is what
// marks it) or a future `brigade` family. Everything else keeps the shipped sparkle.
//
// Gate Arc S5a: the machines out of the Noon Gate (`vesper_*` ids on the construct family, STEP5
// decision 4) break apart too, never going home: the Patrol Orb and the Halo Drone in a spark spray,
// the Line Sentry breaking down, their sparks in the def's own accent (cyan, not the Gnat's amber) and
// their scrap white glass (fallTintOf: the tint is built once per def, then reused).
//
// Gate Arc S6a (STEP6 decision 5): Vesperline's machines break apart too: the Lattice Shell in a spark spray, the
// Vesper Aegis, the Vesper Warden and Gatekeeper Unit 01 breaking down (cyan sparks and white glass scrap; the
// Gatekeeper's sparks in its amber accent). The Night's touched (`rime_*`, the Rime Wisp) are never sent home:
// they fade with a violet tint (§3.4: "it flinches back"), never the homeward sparkle. No `fall` field is needed.

export const FALL_STYLES = Object.freeze(['sparkle', 'fade', 'sparkFall', 'breakdown']);

/** Brigade unit id → style (the trooper kinds fall back to 'fade'). */
const BRIGADE_FALL = {
  brigade_gnat: 'sparkFall',
  brigade_tortoise: 'breakdown',
  brigade_badger: 'breakdown',
  brigade_strider: 'breakdown',
  brigade_hammer: 'breakdown',
};

/** Vesperline machine id → style (any other `vesper_*` machine sparks apart). */
const VESPER_FALL = {
  vesper_patrol_orb: 'sparkFall',
  vesper_halo_drone: 'sparkFall',
  vesper_line_sentry: 'breakdown',
  // Gate Arc S6a: Vesperline's machines (STEP6 decision 5)
  vesper_lattice_shell: 'sparkFall',
  vesper_aegis: 'breakdown',
  vesper_warden: 'breakdown',
  vesper_gatekeeper: 'breakdown',
};

/** Is this a machine out of the Noon Gate? (one char test first: every shipped id fails it at once) */
const isVesper = (id) => id.charCodeAt(0) === 118 && id.startsWith('vesper_');
/** Is this one of the Night's touched (the Rime Wisp, Step 8's rime_ kin)? (one char test first) */
const isRime = (id) => id.charCodeAt(0) === 114 && id.startsWith('rime_');

/**
 * @param {object|null} def EnemyDef ({ id, family, fall? })
 * @returns {'sparkle'|'fade'|'sparkFall'|'breakdown'}
 */
export function fallStyleOf(def) {
  if (!def) return 'sparkle';
  const id = def.id || '';
  // (an explicit `fall` never sends a rime_ wisp home: the Night's touched are not sent home)
  if (FALL_STYLES.includes(def.fall) && !(def.fall === 'sparkle' && isRime(id))) return def.fall;
  if (BRIGADE_FALL[id]) return BRIGADE_FALL[id];
  if (VESPER_FALL[id]) return VESPER_FALL[id];
  // every shipped monster leaves here, before any loop (this runs on every defeat)
  if (!id.startsWith('brigade_')) return isVesper(id) ? 'sparkFall' : isRime(id) ? 'fade' : def.family === 'brigade' ? 'fade' : 'sparkle';
  for (const key in BRIGADE_FALL) if (id.startsWith(`${key}_`)) return BRIGADE_FALL[key];
  return 'fade';
}

/** The Noon machines' default accent (cyan) when a def gives none. */
export const VESPER_CYAN = '#3fd0e8';
const tints = new Map();

/**
 * The colours a machine breaks apart in (null: the style's own, the Gnat's amber): for a `vesper_*`
 * def its accent for the sparks with white glass glints, white-glass scrap, a cool grey puff. Built
 * once per def id, then reused (no allocation per defeat).
 * @param {object|null} def EnemyDef ({ id, accent?, color? })
 * @returns {{ spark: string, glint: string, shard: string, shard2: string, smoke: string, flash: string }|null}
 */
export function fallTintOf(def) {
  const id = def?.id || '';
  if (isRime(id)) return RIME_TINT;
  if (!isVesper(id)) return null;
  let t = tints.get(id);
  if (!t) {
    const accent = def.accent || VESPER_CYAN;
    t = Object.freeze({ spark: accent, glint: '#e9fbff', shard: def.color || '#f2f7fb', shard2: '#bfeff8', smoke: '#9fb4bf', flash: '#c9f6ff' });
    tints.set(id, t);
  }
  return t;
}

/**
 * The Night's touched fade in violet (Gate Arc S6a, `rime_*`): pale violet motes (`dots`) and a cold violet puff
 * (`puff`) instead of the grey ones; no homeward sparkle.
 */
export const RIME_TINT = Object.freeze({ spark: '#b9a8ff', glint: '#e8e4ff', shard: '#3d2f6b', shard2: '#b9a8ff', smoke: '#8f86b8', flash: '#d9d2ff', dots: '#b9a8ff', puff: '#cfc6f2' });
const RIME_FADE = Object.freeze({ homeward: false, puff: RIME_TINT.puff });

/** Does this style send the creature home (the rising sparkle)? Only the shipped monsters' does. */
export function homeward(style) {
  return style === 'sparkle';
}

const HOME = Object.freeze({ homeward: true });
const NO_HOME = Object.freeze({ homeward: false });

/**
 * Plays the fall FX for one beaten enemy.
 * @param {import('./fx.js').FxSystem} fx
 * @param {string} style fallStyleOf()
 * @param {{ x: number, y: number, z: number, size?: number, color?: string }} p where it fell
 * @param {object|null} [def] its EnemyDef: a Noon machine's sparks and scrap take its tint (fallTintOf)
 */
export function playFall(fx, style, p, def = null) {
  const size = p.size ?? 1;
  const tint = def ? fallTintOf(def) : null;
  if (style === 'sparkFall') fx.sparkFall(p.x, p.y, p.z, size, tint);
  else if (style === 'breakdown') fx.breakdown(p.x, p.y, p.z, size, tint);
  else if (tint?.dots && !homeward(style)) fx.death(p.x, p.y, p.z, size, tint.dots, RIME_FADE);
  else fx.death(p.x, p.y, p.z, size, p.color || '#ffffff', homeward(style) ? HOME : NO_HOME);
}

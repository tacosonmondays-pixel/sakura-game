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

export const FALL_STYLES = Object.freeze(['sparkle', 'fade', 'sparkFall', 'breakdown']);

/** Brigade unit id → style (the trooper kinds fall back to 'fade'). */
const BRIGADE_FALL = {
  brigade_gnat: 'sparkFall',
  brigade_tortoise: 'breakdown',
  brigade_badger: 'breakdown',
  brigade_strider: 'breakdown',
  brigade_hammer: 'breakdown',
};

/**
 * @param {object|null} def EnemyDef ({ id, family, fall? })
 * @returns {'sparkle'|'fade'|'sparkFall'|'breakdown'}
 */
export function fallStyleOf(def) {
  if (!def) return 'sparkle';
  if (FALL_STYLES.includes(def.fall)) return def.fall;
  const id = String(def.id || '');
  for (const [key, style] of Object.entries(BRIGADE_FALL)) if (id === key || id.startsWith(`${key}_`)) return style;
  if (id.startsWith('brigade_') || def.family === 'brigade') return 'fade';
  return 'sparkle';
}

/** Does this style send the creature home (the rising sparkle)? Only the shipped monsters' does. */
export function homeward(style) {
  return style === 'sparkle';
}

/**
 * Plays the fall FX for one beaten enemy.
 * @param {import('./fx.js').FxSystem} fx
 * @param {string} style fallStyleOf()
 * @param {{ x: number, y: number, z: number, size?: number, color?: string }} p where it fell
 */
export function playFall(fx, style, p) {
  const size = p.size ?? 1;
  if (style === 'sparkFall') fx.sparkFall(p.x, p.y, p.z, size);
  else if (style === 'breakdown') fx.breakdown(p.x, p.y, p.z, size);
  else fx.death(p.x, p.y, p.z, size, p.color || '#ffffff', { homeward: homeward(style) });
}

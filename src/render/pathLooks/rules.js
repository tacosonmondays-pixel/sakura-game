// Path looks: which layers a girl shows for her upgrade tiers (pure; docs/specs/path-looks.md §2).
//
//   pips     every girl: three small gauges on the ground, one per path in its PATH_COLORS colour, one pip per tier
//   glows    T1–T2 accents: a soft glow in the path colour at her weapon hand (the highest such path) and her other
//            hand (the second); a path at T3+ shows its piece instead
//   pieces   T3 attachment, T4 escalated attachment, T5 capstone: one path for a girl (her committed path, the highest
//            at T3+, as flair.js tierLook), every path at T3+ for a hero (her track maps levels back to path tiers,
//            src/sim/hero.js heroLookTiers)
//   aura     T5: a ground glow and rising motes in the capstone path's colour (a hero with several capstones: each one)
//
// Display only: reads tiers, never the sim. Keyed on path INDEX and tier (never path names).

/** Tier at which each layer starts. */
export const LOOK_TIERS = Object.freeze({ glow: 1, piece: 3, escalate: 4, capstone: 5 });

/**
 * @param {number[]} tiers [a, b, c] (a hero: heroLookTiers(def, level))
 * @param {{ multi?: boolean }} [opts] multi: every path at T3+ shows its piece (heroes)
 * @returns {{ tiers: number[], glows: Array<{path:number, tier:number, hand:'weapon'|'off'}>,
 *   pieces: Array<{path:number, tier:number}>, aura: number[], key: string }}
 *   key: a stable string of everything drawn by models (pieces), so a view only rebuilds when it changes
 */
export function pathLayers(tiers, { multi = false } = {}) {
  const t = [0, 1, 2].map((i) => Math.max(0, Math.min(5, (tiers && tiers[i]) | 0)));
  // the committed path of a girl: the highest tier at T3+ (ties: the lower index, as flair.js)
  let look = -1;
  for (let i = 0; i < 3; i++) if (t[i] >= LOOK_TIERS.piece && (look < 0 || t[i] > t[look])) look = i;
  const pieces = [];
  for (let i = 0; i < 3; i++) {
    if (t[i] < LOOK_TIERS.piece) continue;
    if (multi || i === look) pieces.push({ path: i, tier: t[i] });
  }
  // accents: paths at T1–T2 (a girl's second path at T3+ cannot exist; a hero's paths at T3+ show pieces)
  const acc = [0, 1, 2].filter((i) => t[i] >= LOOK_TIERS.glow && t[i] < LOOK_TIERS.piece && !pieces.some((p) => p.path === i));
  acc.sort((a, b) => t[b] - t[a] || a - b);
  const glows = acc.slice(0, 2).map((path, k) => ({ path, tier: t[path], hand: k === 0 ? 'weapon' : 'off' }));
  const aura = pieces.filter((p) => p.tier >= LOOK_TIERS.capstone).map((p) => p.path);
  const key = pieces.map((p) => `${p.path}:${p.tier}`).join(',');
  return { tiers: t, glows, pieces, aura, key };
}

/**
 * The catalog stage of a path's tier: 3 → 't3', 4 → 't4', 5 → 't5' (a tier the catalog leaves out falls back to the
 * one below it, so a girl with only a T3 and a T5 piece wears her T3 piece at T4).
 * @param {object} pathDef catalog entry of one path ({ t3, t4?, t5? })
 * @param {number} tier
 * @returns {Array<object>|null} the pieces to wear
 */
export function stagePieces(pathDef, tier) {
  if (!pathDef || tier < LOOK_TIERS.piece) return null;
  for (let k = Math.min(5, tier); k >= 3; k--) {
    const list = pathDef[`t${k}`];
    if (list && list.length) return list;
  }
  return null;
}

/**
 * Pip layout around a girl's ground ring (radians in the ground plane, x = cos, z = sin), centred on the side that faces
 * the camera: path 0 on the screen's left, path 1 in front, path 2 on the right; five pips per path.
 * @param {number} cameraYaw the battle camera's yaw (actors.cameraYaw)
 * @param {{ group?: number, step?: number }} [o] angle between path groups' centres, between pips (radians)
 * @returns {number[][]} [path][pip] → angle
 */
export function pipAngles(cameraYaw = 0, { group = 1.1, step = 0.215 } = {}) {
  // the ground point nearest the camera: the camera sits at (sin yaw, cos yaw) from its target (src/render/camera.js)
  const front = Math.atan2(Math.cos(cameraYaw), Math.sin(cameraYaw));
  const out = [];
  for (let p = 0; p < 3; p++) {
    const c = front + (1 - p) * group; // path 0 toward the screen's left (+90° from the front), path 2 to its right
    const row = [];
    for (let k = 0; k < 5; k++) row.push(c + (2 - k) * step);
    out.push(row);
  }
  return out;
}

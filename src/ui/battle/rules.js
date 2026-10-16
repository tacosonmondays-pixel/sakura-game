// Pure battle-UI rules (no DOM) shared by the tower panel and tests (owner: battle-ui).

/**
 * Human explanation for a crosspath lock (two paths at most, only one past tier 2).
 * @param {number[]} tiers current tiers [a, b, c]
 * @param {number} path path index 0-2 that is locked
 * @param {string[]} names path names
 * @returns {string}
 */
export function crosspathReason(tiers, path, names) {
  const others = [0, 1, 2].filter((p) => p !== path);
  const cur = tiers[path] || 0;
  if (cur === 0 && others.filter((p) => tiers[p] > 0).length >= 2) {
    const used = others.map((p) => names[p]).join(' + ');
    return `Two paths in use (${used}) — max two.`;
  }
  const high = others.find((p) => tiers[p] > 2);
  if (high != null) return `Capped at T2 — ${names[high]} is already T${tiers[high]}.`;
  return 'Locked by crosspathing.';
}

/**
 * Highest tier this path can still reach given the other paths (for pip styling).
 * @param {number[]} tiers
 * @param {number} path
 * @returns {number} 0, 2 or 5
 */
export function pathCap(tiers, path) {
  const others = [0, 1, 2].filter((p) => p !== path);
  if ((tiers[path] || 0) === 0 && others.filter((p) => tiers[p] > 0).length >= 2) return 0;
  if (others.some((p) => tiers[p] > 2)) return 2;
  return 5;
}

// ---------------------------------------------------------------------------
// One final tier per path (src/sim/finalTier.js): copy for the lock, the holder and the rule.
// ---------------------------------------------------------------------------

/** Roman numeral of the final tier in copy ("Sentry Works V"). */
export const FINAL_NUMERAL = 'V';

/** The rule in one sentence (tree / unit sheet / wiki). */
export const ONE_PER_PATH_RULE = 'Each path\'s T5 is one girl at a time: one 5-x-x, one x-5-x and one x-x-5 per girl.';

/** Co-op tooltip on the lock: your ally's copies never block yours. */
export const ONE_PER_PATH_COOP = 'In co-op each player has her own.';

/** The lock line on a final tier another copy holds. */
export function onePerPathReason(girl, pathName) {
  return `Only one ${girl} can hold ${pathName} ${FINAL_NUMERAL}. Sell or upgrade that one.`;
}

/** Tooltip of the final-tier pip when another copy holds it. */
export function heldPipTitle(tierName, girl) {
  return `T5 ${tierName} — held by another ${girl}`;
}

/** Co-op: my tier-5 order arrived after my other copy's (same tick race). */
export function finalRaceText(girl, pathName) {
  return `Another ${girl} took ${pathName} ${FINAL_NUMERAL} first.`;
}

/**
 * Where on the map a point is, in words (thirds of the map): "top left", "top", "top right", "left",
 * "centre", "right", "bottom left", "bottom", "bottom right". Map y grows towards the bottom of the screen.
 */
export function whereOnMap(x, y, w, h) {
  const col = !(w > 0) ? 1 : x < w / 3 ? 0 : x < (2 * w) / 3 ? 1 : 2;
  const row = !(h > 0) ? 1 : y < h / 3 ? 0 : y < (2 * h) / 3 ? 1 : 2;
  const cols = ['left', '', 'right'];
  const rows = ['top', '', 'bottom'];
  return [rows[row], cols[col]].filter(Boolean).join(' ') || 'centre';
}

/** "Held by Chika 5-0-2 · bottom left" (the panel adds " · Show ›"). */
export function finalHolderLine(holder, where) {
  return `Held by ${holder.def?.name || holder.name || 'her'} ${holder.tiers.join('-')} · ${where}`;
}

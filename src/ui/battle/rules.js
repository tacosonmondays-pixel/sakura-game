// Pure battle-UI rules (no DOM) shared by the tower panel and tests (owner: battle-ui).

/**
 * Human explanation for a crosspath lock (BTD6-style: two paths at most, only one past tier 2).
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

// One final tier per path (owner, Oct 15): any number of copies of a girl, but per girl type and per player only
// one copy may own each path's final tier (one 5-x-x, one x-5-x, one x-x-5). Selling the holder frees it.
// Heroes are exempt. Pure and deterministic: reads towers, tiers and owner only (never a view slot), so a
// co-op command that breaks the rule is refused the same way on every client.

/** The tier the rule caps: a path's last tier (tier 5 for every tower girl). */
export const FINAL_TIER = 5;

/** The final tier of `def`'s path `path`: its last tier, at most FINAL_TIER (0 when the path has no tiers). */
export function finalTierOf(def, path) {
  return Math.min(FINAL_TIER, def?.paths?.[path]?.tiers?.length || 0);
}

/**
 * The girl of `unitId` owned by `owner` (except `exceptUid`) holding `path`'s final tier, or null. Ties
 * (only possible in a battle save from before the rule, which keeps both): the lowest uid is the holder.
 * @param {object[]} towers TowerRT list (sim.towers)
 * @param {string} unitId girl type (skins are cosmetic and not part of it)
 * @param {number} owner player index (0 in solo)
 * @param {number} path 0-2
 * @param {number|null} [exceptUid] the girl asking (never her own holder)
 * @returns {object|null} TowerRT
 */
export function findFinalHolder(towers, unitId, owner, path, exceptUid = null) {
  let best = null;
  for (const o of towers) {
    if (o.removed || o.isHero || o.uid === exceptUid || o.unitId !== unitId || (o.owner ?? 0) !== owner) continue;
    const fin = finalTierOf(o.def, path);
    if (fin > 0 && (o.tiers[path] || 0) >= fin && (!best || o.uid < best.uid)) best = o;
  }
  return best;
}

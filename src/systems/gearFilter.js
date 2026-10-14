// Equipment filters (owner: "can you add a filter for equipment?"). Pure list logic shared by the
// Backpack's Equipment tab and a girl's Equipment tab (src/ui/gearFilterBar.js draws the
// controls): rarity, main stat, a wanted substat, equipped / spare / locked, and the sort order.
import { GEAR_STATS, ITEM_RARITY_ORDER } from '../data/types.js';

/** @typedef {{ rarity: string|null, main: string|null, sub: string|null, status: string, sort: string }} GearFilter */

/** @type {GearFilter} */
export const DEFAULT_GEAR_FILTER = Object.freeze({ rarity: null, main: null, sub: null, status: 'all', sort: 'best' });

export const GEAR_STATUSES = Object.freeze({
  all: 'All gear',
  spare: 'Not equipped',
  equipped: 'Equipped',
  locked: 'Locked',
  unlocked: 'Unlocked',
});

export const GEAR_SORTS = Object.freeze({
  best: 'Best first',
  level: 'Level',
  main: 'Main stat',
  subs: 'Most substats',
  worst: 'Weakest first',
});

const rarityRank = (r) => ITEM_RARITY_ORDER.indexOf(r);
const tieBreak = (a, b) => String(a.uid).localeCompare(String(b.uid));
const best = (a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || b.level - a.level || tieBreak(a, b);

const SORTERS = {
  best,
  worst: (a, b) => -best(a, b) || tieBreak(a, b),
  level: (a, b) => b.level - a.level || best(a, b),
  // grouped by main stat (in the game's stat order), the strongest roll of each first
  main: (a, b) => (Object.keys(GEAR_STATS).indexOf(a.main?.stat) - Object.keys(GEAR_STATS).indexOf(b.main?.stat))
    || (b.main?.value ?? 0) - (a.main?.value ?? 0) || best(a, b),
  subs: (a, b) => (b.subs?.length ?? 0) - (a.subs?.length ?? 0) || best(a, b),
};

/** A filter with unknown or missing fields replaced by the defaults (old saves, bad storage). */
export function normalizeGearFilter(f) {
  const src = f && typeof f === 'object' ? f : {};
  return {
    rarity: ITEM_RARITY_ORDER.includes(src.rarity) ? src.rarity : null,
    main: GEAR_STATS[src.main] ? src.main : null,
    sub: GEAR_STATS[src.sub] ? src.sub : null,
    status: GEAR_STATUSES[src.status] ? src.status : 'all',
    sort: SORTERS[src.sort] ? src.sort : 'best',
  };
}

/** Does this piece pass the filter (sort aside)? */
export function gearMatches(g, f) {
  if (f.rarity && g.rarity !== f.rarity) return false;
  if (f.main && g.main?.stat !== f.main) return false;
  if (f.sub && !(g.subs || []).some((s) => s.stat === f.sub)) return false;
  switch (f.status) {
    case 'spare': return !g.equippedBy;
    case 'equipped': return !!g.equippedBy;
    case 'locked': return !!g.locked;
    case 'unlocked': return !g.locked;
    default: return true;
  }
}

/** Filters and sorts a gear list (never mutates it). */
export function applyGearFilter(list, filter) {
  const f = normalizeGearFilter(filter);
  return list.filter((g) => gearMatches(g, f)).sort(SORTERS[f.sort]);
}

/** How many filters narrow the list (the sort does not count). */
export function activeGearFilters(filter) {
  const f = normalizeGearFilter(filter);
  return (f.rarity ? 1 : 0) + (f.main ? 1 : 0) + (f.sub ? 1 : 0) + (f.status !== 'all' ? 1 : 0);
}

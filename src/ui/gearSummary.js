// What a big pile of opened gear boxes gave (docs/specs/ACHIEVEMENTS.md §5.3): above 12 pieces, a summary instead of
// one card per piece: counts by rarity and slot, the best 6, and "See all in Equipment". Shared by the Achievements
// Claim-all modal and the Backpack's Open all.

import { h } from './dom.js';
import { ITEM_RARITIES, ITEM_RARITY_ORDER, GEAR_SLOTS } from '../data/types.js';
import { gearTile } from './screens/stage.js';

/** Above this many pieces the opener shows boxSummary() instead of every card. */
export const SUMMARY_ABOVE = 12;

/** Best first: rarity, then level, then the uid order (stable). */
export function bestGear(gear, n = 6) {
  const rank = (g) => ITEM_RARITY_ORDER.indexOf(g.rarity);
  return [...gear].sort((a, b) => rank(b) - rank(a) || (b.level || 0) - (a.level || 0)).slice(0, n);
}

/** Counts by rarity (best first) and by slot. */
export function gearCounts(gear) {
  const rarity = {};
  const slot = {};
  for (const g of gear) {
    rarity[g.rarity] = (rarity[g.rarity] || 0) + 1;
    slot[g.slot] = (slot[g.slot] || 0) + 1;
  }
  return { rarity, slot };
}

/**
 * @param {object[]} gear the opened pieces
 * @param {{ onSeeAll?: () => void }} [opts]
 * @returns {HTMLElement}
 */
export function boxSummary(gear, { onSeeAll = null } = {}) {
  const { rarity, slot } = gearCounts(gear);
  const rarities = [...ITEM_RARITY_ORDER].reverse().filter((r) => rarity[r]);
  return h('div.gear-summary', { 'data-testid': 'gear-summary' },
    h('div.gear-summary-head', h('b', `${gear.length} pieces of gear`), h('span.muted', ' · the best 6 below')),
    h('div.gear-summary-counts',
      rarities.map((r) => {
        const chip = h('span.gear-summary-chip', h('i'), `${ITEM_RARITIES[r]?.name || r} ×${rarity[r]}`);
        chip.style.setProperty('--rc', ITEM_RARITIES[r]?.color || '#999');
        return chip;
      }),
      Object.keys(GEAR_SLOTS).filter((s) => slot[s]).map((s) => h('span.gear-summary-chip.slot', `${GEAR_SLOTS[s].name} ×${slot[s]}`))),
    h('div.gear-summary-best', bestGear(gear).map((g) => h('div.item-tile-wrap', gearTile(g, { size: 60 }), h('div.item-tile-name', g.name)))),
    onSeeAll ? h('button.gear-summary-all', { onclick: onSeeAll, 'data-testid': 'gear-summary-all' }, 'See all in Equipment ›') : null,
  );
}

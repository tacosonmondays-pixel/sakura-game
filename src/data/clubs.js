// Academy Club gear sets (docs/specs/GEAR_STATS.md §C). Menus, rolls and the save read this file; the
// sim has its own copy of the ids in src/sim/gearRules.js (a test keeps them equal), so this file stays
// outside the co-op hash.

/** Club ids by their save index (1…15, append-only: the `gcl:` mirror stores the index). */
export const CLUB_IDS = Object.freeze(['archery', 'fencing', 'taiko', 'pyro', 'tea', 'bell']);
/** Clubs a new Mythic+ piece can roll into today. Bell joins with the tower abilities. */
export const LIVE_CLUBS = Object.freeze(['archery', 'fencing', 'taiko', 'pyro', 'tea']);
/** Rarities that can belong to a club (UR pieces are Legendary with the `ur` flag). */
export const CLUB_RARITIES = Object.freeze(['mythic', 'legendary']);

/**
 * fav: the three substats a club piece rolls at double weight. two: the 2-piece stat (a gear-stat key
 * and value, folded into her gear totals). trick: the 3-piece rule's name and card sentence.
 */
export const CLUBS = Object.freeze({
  archery: { id: 'archery', name: 'Archery Club', emblem: 'bow', color: '#5fbf7f', fav: ['piercePct', 'critChance', 'ratePct'], two: { stat: 'piercePct', value: 0.30 }, trick: { name: 'Follow-Through', text: 'Every 5th attack gets +100% Pierce.' } },
  fencing: { id: 'fencing', name: 'Fencing Club', emblem: 'foil', color: '#7fa8ff', fav: ['critChance', 'critDmg', 'armorPen'], two: { stat: 'critChance', value: 0.03 }, trick: { name: 'Finishing Thrust', text: 'Every 25th attack deals double damage and ignores armor.' } },
  taiko: { id: 'taiko', name: 'Taiko Club', emblem: 'drum', color: '#ff8a5c', fav: ['atkPct', 'ratePct', 'rangePct'], two: { stat: 'ratePct', value: 0.05 }, trick: { name: 'Big Beat', text: 'Every 10th attack hits 50% harder.' } },
  pyro: { id: 'pyro', name: 'Pyrotechnics Club', emblem: 'firework', color: '#ff5a8a', fav: ['atkPct', 'piercePct', 'rangePct'], two: { stat: 'atkPct', value: 0.05 }, trick: { name: 'Finale Pop', text: 'Enemies she defeats burst for 25% of her hit.' } },
  tea: { id: 'tea', name: 'Tea Club', emblem: 'teacup', color: '#c9a36b', fav: ['auraPct', 'rangePct', 'costCut'], two: { stat: 'auraPct', value: 0.06 }, trick: { name: 'Second Cup', text: 'Girls in her aura attack 2% faster.' } },
  bell: { id: 'bell', name: 'Bell Club', emblem: 'bell', color: '#ffd166', fav: ['ultHaste', 'ratePct', 'rangePct'], two: { stat: 'ultHaste', value: 0.08 }, trick: { name: 'First Bell', text: 'When a wave starts, her abilities gain 10% charge.' } },
});

/** Club index for the `gcl:` mirror (1-based; 0 = no club). */
export const clubIndex = (id) => CLUB_IDS.indexOf(id) + 1;
export const clubAt = (i) => CLUB_IDS[i - 1] || null;

/** Club Armband: 1 band + 2,000 × (tier + 1) coins (Mythic 8,000, Legendary 10,000, UR 12,000). */
export const ARMBAND_COIN_STEP = 2000;
/** Welcome gift at the first load with clubs. */
export const ARMBAND_GIFT = 9;

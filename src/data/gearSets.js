// Gear sets (docs/specs/GEAR_UPDATE.md §3). Not part of the co-op hash: the sim keeps its own id list
// (src/sim/setRules.js SIM_SET_IDS, from the sets update), held equal to SET_IDS by a test.
// A set is five pieces, one per slot, each with the set's own design. Today's pieces have no `set` (No set, for good).

/** Set ids. Append-only: mirrors store a set's index + 1 (`gst:`, `gph:`). */
export const SET_IDS = Object.freeze(['spirit', 'freezetag', 'geometry', 'popper', 'treasurer', 'powerbank']);

/**
 * Names, colours and the fixed piece names of each set (the rarity suffix is added on the piece); `two` its 2-piece stat
 * (folded into her gear totals, GEAR_UPDATE.md §3.1) and `cap` what its 5-piece set cap lifts (§3.2): 'crit' (Crit Rate
 * and Crit DMG), 'abilHaste' (her ⚡ ability takes half of all her Skill Haste), 'auraPct', 'controlPct', 'interest'
 * (her wave interest) or 'splash' (her blasts read all her Pierce). The passives' numbers live in src/sim/setRules.js.
 */
export const GEAR_SETS = Object.freeze({
  spirit: Object.freeze({
    two: Object.freeze({ stat: 'auraPct', value: 0.08 }), cap: 'auraPct',
    name: 'Spirit Squad', role: 'support', color: '#e5484d',
    pieces: Object.freeze({ charm: 'Pom-Pom Keyring', ribbon: 'Cheer Bow', shoes: 'Light-Up Trainers', hair: 'Pom Clip', necklace: 'Spirit Locket' }),
  }),
  freezetag: Object.freeze({
    two: Object.freeze({ stat: 'controlPct', value: 0.1 }), cap: 'controlPct',
    name: 'Freeze Tag', role: 'control', color: '#5fb4e8',
    pieces: Object.freeze({ charm: 'Tag Token', ribbon: 'Chalk-Line Ribbon', shoes: 'Hopscotch Sneakers', hair: 'Pause-Button Clip', necklace: 'Tag Timer' }),
  }),
  geometry: Object.freeze({
    two: Object.freeze({ stat: 'critDmg', value: 0.1 }), cap: 'crit',
    name: 'Geometry Set', role: 'precision', color: '#5a6fa8',
    pieces: Object.freeze({ charm: 'Compass Keyring', ribbon: 'Protractor Ribbon', shoes: 'Ruler-Step Loafers', hair: 'Set-Square Clip', necklace: 'Crosshair Locket' }),
  }),
  popper: Object.freeze({
    two: Object.freeze({ stat: 'piercePct', value: 0.2 }), cap: 'splash',
    name: 'Party Popper', role: 'crowd', color: '#9b5de5',
    pieces: Object.freeze({ charm: 'Popper Keyring', ribbon: 'Streamer Bow', shoes: 'Glitter-Trail Trainers', hair: 'Confetti Clip', necklace: 'Party Locket' }),
  }),
  treasurer: Object.freeze({
    two: Object.freeze({ stat: 'costCut', value: 0.04 }), cap: 'interest',
    name: 'Treasurer', role: 'money', color: '#9fd8c4',
    pieces: Object.freeze({ charm: 'Abacus Bracelet', ribbon: 'Coin-Clasp Ribbon', shoes: 'Coin-Buckle Loafers', hair: 'Calculator Clip', necklace: 'Coin Locket' }),
  }),
  powerbank: Object.freeze({
    two: Object.freeze({ stat: 'ultHaste', value: 0.08 }), cap: 'abilHaste',
    name: 'Power Bank', role: 'abilities', color: '#8bd13a',
    pieces: Object.freeze({ charm: 'Power Bank Keyring', ribbon: 'Charging-Cable Bow', shoes: 'Charge-Bar Trainers', hair: 'Lightning Clip', necklace: 'Battery Locket' }),
  }),
});

/** The set each titan's chests drop (GEAR_UPDATE.md §3.6): the four titan sets (the Rainbow Gear Box offers these). */
export const TITAN_SETS = Object.freeze({ daimyo: 'spirit', regent: 'freezetag', wyrm: 'geometry', foundry: 'popper' });

/** Rarities a set piece exists at (UR and LR by awakening and Limit Break). */
export const SET_RARITIES = Object.freeze(['superRare', 'mythic', 'legendary']);

/** @returns {number} 1 + the set's index (0 = no set): the value its mirrors store */
export const setIndex = (id) => SET_IDS.indexOf(id) + 1;
/** @returns {string|null} the set at a mirror value */
export const setAt = (i) => SET_IDS[i - 1] || null;
/** @returns {boolean} a known set id */
export const isSet = (id) => SET_IDS.includes(id);
/** @returns {string} a set piece's fixed name (before the rarity suffix) */
export const setPieceName = (setId, slot) => GEAR_SETS[setId]?.pieces?.[slot] || null;

/** Pieces of one set that give its 2-piece stat, its passive, and its stronger passive with the set cap. */
export const SET_TWO = 2;
export const SET_FOUR = 4;
export const SET_FIVE = 5;

/** One-line texts for menus (the numbers match src/sim/setRules.js SET_PASSIVES at 4 / 5 pieces). */
export const SET_TEXT = Object.freeze({
  spirit: Object.freeze({ passive: 'Big Cheer', four: 'Every 20 s, girls in her aura deal +12% damage for 5 s.', five: '+16% for 6 s. Aura Power has no cap.' }),
  freezetag: Object.freeze({ passive: 'You\'re It', four: 'Enemies she slows, freezes, stuns or holds take +6% damage from every girl (bosses +3%).', five: '+8% (bosses +4%). Control Strength has no cap.' }),
  geometry: Object.freeze({ passive: 'Right Angle', four: 'Every 4th attack is a sure crit.', five: 'Those crits hit ×1.2 harder. Crit Rate and Crit DMG have no cap: crit over 100% becomes super crits.' }),
  popper: Object.freeze({ passive: 'Confetti Burst', four: 'Every 6th attack bursts on the enemies around for 50% of the hit.', five: 'Every 5th, 60%. Her blasts use all her Pierce.' }),
  treasurer: Object.freeze({ passive: 'Bake Sale', four: 'Coins from enemies she defeats +10%, her own coins too.', five: '+15%. Her wave interest has no cap.' }),
  powerbank: Object.freeze({ passive: 'Supercharge', four: 'Her ⚡ ability hits 15% harder and charges 10% faster.', five: '+25%, 15% faster. Her ⚡ ability takes half of all her Skill Haste.' }),
});

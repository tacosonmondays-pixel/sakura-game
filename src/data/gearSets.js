// Gear sets (docs/specs/GEAR_UPDATE.md §3). Not part of the co-op hash: the sim keeps its own id list
// (src/sim/setRules.js SIM_SET_IDS, from the sets update), held equal to SET_IDS by a test.
// A set is five pieces, one per slot, each with the set's own design. Today's pieces have no `set` (No set, for good).

/** Set ids. Append-only: mirrors store a set's index + 1 (`gst:`, `gph:`). */
export const SET_IDS = Object.freeze(['spirit', 'freezetag', 'geometry', 'popper', 'treasurer', 'powerbank']);

/** Names, colours and the fixed piece names of each set (the rarity suffix is added on the piece). */
export const GEAR_SETS = Object.freeze({
  spirit: Object.freeze({
    name: 'Spirit Squad', role: 'support', color: '#e5484d',
    pieces: Object.freeze({ charm: 'Pom-Pom Keyring', ribbon: 'Cheer Bow', shoes: 'Light-Up Trainers', hair: 'Pom Clip', necklace: 'Spirit Locket' }),
  }),
  freezetag: Object.freeze({
    name: 'Freeze Tag', role: 'control', color: '#5fb4e8',
    pieces: Object.freeze({ charm: 'Tag Token', ribbon: 'Chalk-Line Ribbon', shoes: 'Hopscotch Sneakers', hair: 'Pause-Button Clip', necklace: 'Tag Timer' }),
  }),
  geometry: Object.freeze({
    name: 'Geometry Set', role: 'precision', color: '#5a6fa8',
    pieces: Object.freeze({ charm: 'Compass Keyring', ribbon: 'Protractor Ribbon', shoes: 'Ruler-Step Loafers', hair: 'Set-Square Clip', necklace: 'Crosshair Locket' }),
  }),
  popper: Object.freeze({
    name: 'Party Popper', role: 'crowd', color: '#9b5de5',
    pieces: Object.freeze({ charm: 'Popper Keyring', ribbon: 'Streamer Bow', shoes: 'Glitter-Trail Trainers', hair: 'Confetti Clip', necklace: 'Party Locket' }),
  }),
  treasurer: Object.freeze({
    name: 'Treasurer', role: 'money', color: '#3fbf9f',
    pieces: Object.freeze({ charm: 'Abacus Bracelet', ribbon: 'Coin-Clasp Ribbon', shoes: 'Coin-Buckle Loafers', hair: 'Calculator Clip', necklace: 'Coin Locket' }),
  }),
  powerbank: Object.freeze({
    name: 'Power Bank', role: 'abilities', color: '#8bd13a',
    pieces: Object.freeze({ charm: 'Power Bank Keyring', ribbon: 'Charging-Cable Bow', shoes: 'Charge-Bar Trainers', hair: 'Lightning Clip', necklace: 'Battery Locket' }),
  }),
});

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

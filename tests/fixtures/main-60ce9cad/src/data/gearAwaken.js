// VENDORED from origin/main 60ce9cad:src/data/gearAwaken.js for the gear update's old-build round trips (GEAR_UPDATE.md §13).
// Imports of files that are not vendored point at the live tree. Do not edit: regenerate with git show.
// Rainbow UR gear: Rainbow Bloom (awakening) and the Starlight Needle (docs/specs/GEAR_AWAKEN.md).
// Not part of the co-op hash. A UR piece stays `rarity: 'legendary'` with `ur: 1` (types.js untouched).

/** UR rarity scale (Legendary is 2.8): every number ×8/7, Armor Pierce ×1.105. */
export const UR_SCALE = 3.2;
export const UR_MAX_LEVEL = 12;
/** Bit order of the `gtn:` stitch mirror: frozen, append-only (2 bits per stat, ≤ 20 bits). */
export const TUNE_BITS = Object.freeze(['atkPct', 'ratePct', 'rangePct', 'critChance', 'critDmg', 'armorPen', 'costCut', 'ultHaste', 'piercePct', 'auraPct']);
/** Per-line ✦ bits: 1 = gold ✦, 2 = rainbow ✦. */
export const TUNE_GOLD = 1;
export const TUNE_RAINBOW = 2;

export const SEED_ID = 'seed_rainbow';
export const NEEDLE_ID = 'needle_star';
export const ARMBAND_ID = 'club_band';

export const AWAKEN_COINS = 80000;
export const STITCH_COINS = 20000;
export const TAKE_BACK_COINS = 10000;
/** Rainbow Resonance: +Range by UR pieces worn (0…3). */
export const RESONANCE = Object.freeze([0, 0, 0.05, 0.10]);
/** First-bloom gift: 1 Seed the first time the save holds a Legendary +10. */
export const FIRST_BLOOM_GIFT = 1;

/** Name suffixes. */
export const LEGENDARY_SUFFIX = 'of the Eternal Sakura';
export const UR_SUFFIX = 'of the Rainbow Sakura';

/** missions.counters mirror prefixes (an older build keeps counters word for word). */
export const MARK = Object.freeze({
  ur: 'gur:', // UR level 10–12
  box: 'gbx:', // box-born UR (Rainbow Gear Box, ASCENSION.md §C.8): slot index × 100 + main-stat index + 1; 0 after salvage
  boxPaid: 'gbl:', // box-born UR: bit L set when its +L → +L+1 (below +10) was paid at UR prices; gone after salvage
  tuned: 'gtn:', // ✦ bits by TUNE_BITS
  club: 'gcl:', // club index
  newLine: 'gnx:', // a Pierce / Aura Power line
  newFp: 'gnf:', // fingerprint of the piece's other subs
  inv: 'inv:', // item count
  seedGift: 'ga:gift',
  bandGift: 'gc:gift',
  urEver: 'ach:urEver',
  urWorn: 'ach:urWorn',
  needleWeek: 'cap:fpNeedle',
});
/** Items mirrored in `inv:` (an older build drops unknown item ids). */
export const MIRRORED_ITEMS = Object.freeze([SEED_ID, NEEDLE_ID, ARMBAND_ID]);

/** Freeplay milestone items, once per tier (gear-awaken §6.1, §6.2): the Matriarch a Seed, wave 150 two Needles. */
export const MILESTONE_ITEMS = Object.freeze({
  w150: Object.freeze([Object.freeze({ id: NEEDLE_ID, count: 2 })]),
  matriarch: Object.freeze([Object.freeze({ id: SEED_ID, count: 1 })]),
});
/** missions.counters prefixes: a paid freeplay milestone ('fpm:tier:id') and its items paid ('fpu:tier:id'). */
export const MILESTONE_MARK = 'fpm:';
export const MILESTONE_ITEMS_MARK = 'fpu:';

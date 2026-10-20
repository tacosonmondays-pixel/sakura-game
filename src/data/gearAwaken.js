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

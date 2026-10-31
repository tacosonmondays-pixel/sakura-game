// Rainbow UR gear: Rainbow Bloom (awakening) and the Starlight Needle (docs/specs/GEAR_AWAKEN.md), and LR gear, pins
// and set pieces (docs/specs/GEAR_UPDATE.md §4, §6, §9). Not part of the co-op hash. A UR piece stays
// `rarity: 'legendary'` with `ur: 1` (types.js untouched); an LR piece keeps `ur: 1` and adds `lr` (1 Set LR, 2 Blank LR).
import { SET_IDS } from './gearSets.js';

/** UR rarity scale (Legendary is 2.8): every number ×8/7, Armor Pierce ×1.105. */
export const UR_SCALE = 3.2;
export const UR_MAX_LEVEL = 12;
/** Bit order of the `gtn:` stitch mirror (2 bits per stat) and the `gtx:` / `gtp:` marks (1 bit): frozen, append-only. */
export const TUNE_BITS = Object.freeze(['atkPct', 'ratePct', 'rangePct', 'critChance', 'critDmg', 'armorPen', 'costCut', 'ultHaste', 'piercePct', 'auraPct', 'auraRangePct', 'buffDurPct', 'controlPct']);
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

/** LR gear (GEAR_UPDATE.md §4): Limit Break a UR +12 piece into Set LR (`lr: 1`, scale 4.0) or Blank LR (`lr: 2`, 5.0). */
export const LR_SET = 1;
export const LR_BLANK = 2;
export const LR_SCALE = 4.0;
export const BLANK_SCALE = 5.0;
export const LR_MAX_LEVEL = 18;
/** Price tier of an LR piece (UR is 5): +13 … +18 cost 39,200 … 53,200 coins. */
export const LR_TIER = 6;
export const LENS_ID = 'lens_nightglass';
export const LIMIT_BREAK_COINS = 150000;
/** The Nightglass ✦: a third ✦ on an LR piece, its own line field `night` (never in `tuned`, which stays 0–3). */
export const NIGHT_STAR = 1;
/** Each LR piece she wears raises her caps by this much (§4.3: aura most, crit least). */
export const LR_CAP_STEP = Object.freeze({
  auraPct: 0.04, auraRangePct: 0.03, buffDurPct: 0.04, controlPct: 0.04, rangePct: 0.04, piercePct: 0.1, critDmg: 0.1, armorPen: 2, ultHaste: 0.01,
  costCut: 0.005, critChance: 0.01,
});
/** Blank LR pieces that double every base cap (and her fill-in limit and DoT cap bonus). */
export const BLANK_FIVE = 5;

/** Pins (GEAR_UPDATE.md §6): the Tie Pin sets a main stat to its best roll, the Collar Pin one substat. Line mark `top`. */
export const TIE_PIN_ID = 'tie_pin';
export const COLLAR_PIN_ID = 'collar_pin';
export const TIE_PIN_COINS = 20000;
export const COLLAR_PIN_COINS = 10000;

/**
 * Set Boxes (GEAR_UPDATE.md §5; Set Boxes v2, docs/specs/SET_BOXES_V2.md §3): a whole five-piece set at Mythic,
 * Legendary or UR, of two kinds. The **preset** kind (main stats chosen) keeps the live ids `setbox_<set>_<rarity>`
 * (Supply Bot only from v2 on; boxes players own stay preset); the **random** kind (main stats rolled, batch-opened)
 * is `setbox_<set>_<rarity>_random`, what the player sources pay. `<set>` is a set id or `pick` (choose the set).
 */
export const SET_BOX_RARITIES = Object.freeze(['mythic', 'legendary', 'ur']);
export const SET_BOX_KINDS = Object.freeze(['random', 'preset']);
/** The rarities the live (v0.1.66) preset ids exist at: frozen, every older build knows these 14 ids. */
export const SET_BOX_LIVE_RARITIES = Object.freeze(['mythic', 'legendary']);
export const SET_BOX_RANDOM = '_random';
export const setBoxId = (setId, rarity, kind = 'preset') => `setbox_${setId}_${rarity}${kind === 'random' ? SET_BOX_RANDOM : ''}`;
/** `{ set, rarity, kind }` of a Set Box id (`set` 'pick' for a choose-box), or null. */
export function setBoxInfo(id) {
  const m = /^setbox_([a-z]+)_(mythic|legendary|ur)(_random)?$/.exec(String(id || ''));
  if (!m || (m[1] !== 'pick' && !SET_IDS.includes(m[1]))) return null;
  return { set: m[1], rarity: m[2], kind: m[3] ? 'random' : 'preset' };
}
const boxIdsOf = (sets) => sets.flatMap((id) => SET_BOX_KINDS.flatMap((k) => SET_BOX_RARITIES.map((r) => setBoxId(id, r, k))));
export const SET_PICK_BOX_IDS = Object.freeze(boxIdsOf(['pick']));
export const SET_BOX_IDS = Object.freeze(boxIdsOf(SET_IDS));
/** The 14 ids live v0.1.66 knows (the preset kind at Mythic and Legendary). */
export const SET_BOX_LIVE_IDS = Object.freeze(['pick', ...SET_IDS].flatMap((id) => SET_BOX_LIVE_RARITIES.map((r) => setBoxId(id, r))));
/** The one-time Set Box letter's id: this prefix, then its boxes' item ids joined by '+'. */
export const SETBOX_GIFT_PREFIX = 'setbox-gift:';
/** Most Set Boxes one tap opens (5 pieces each: the 100 pieces of a regular "Open all"). */
export const SET_OPEN_BATCH_MAX = 20;
/** Every item the gear update adds: 2 choose-boxes, 12 set boxes and 3 tools (the v0.1.66 list, frozen). */
export const GEAR_UPDATE_ITEM_IDS = Object.freeze([...SET_BOX_LIVE_IDS.filter((id) => id.startsWith('setbox_pick_')), ...SET_BOX_LIVE_IDS.filter((id) => !id.startsWith('setbox_pick_')), TIE_PIN_ID, COLLAR_PIN_ID, LENS_ID]);
/** Set Boxes v2's new ids (older builds drop them: mirrored in `inv:`). */
export const SET_BOX_V2_IDS = Object.freeze([...SET_PICK_BOX_IDS, ...SET_BOX_IDS].filter((id) => !SET_BOX_LIVE_IDS.includes(id)));

/** Name suffixes. */
export const LEGENDARY_SUFFIX = 'of the Eternal Sakura';
export const UR_SUFFIX = 'of the Rainbow Sakura';
export const LR_SUFFIX = 'of the Nightglass Sakura';

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
  // the gear update (GEAR_UPDATE.md §9): marks no build before it reads, so none of them can refund or clamp
  set: 'gst:', // a classic-slot piece's set: set index + 1
  lr: 'glr:', // a classic-slot LR piece: LR kind × 100 + level
  night: 'gtx:', // the Nightglass ✦ on a classic-slot piece: 1 bit per stat, TUNE_BITS order
  top: 'gtp:', // pins on a classic-slot piece: bit 0 the main stat, bit 1 + TUNE_BITS index a substat
  piece: 'gph:', // a Hair Clip / Necklace, whole: slot, rarity, level, set, main stat, flags
  pieceMain: 'gpm:', // its main stat's base × 1e6
  pieceSub: 'gps:', // its substat i: stat, ▲, pin, ✦ bits, base
  pieceClub: 'gpc:', // its club index (never the legacy `gcl:`)
  team: 'tm:', // teams: `tm:a` the active team, `tm:<team>:<unitId>` her place and loadout
  preset: 'gp:', // gear loadouts: `gp:<unitId>` active + 10 × count, `gp:<unitId>:<n>:<slot>` the piece
  lrEver: 'ach:lrEver', // Limit Breaks ever (achievements "First Nightglass")
  lrForm: 'ach:lrForm', // 1 once a girl has worn an LR Set Form (achievement "Nightglass Form")
  // the one-time Set Boxes (GEAR_UPDATE.md §5.3, r3): one mark per box, for veterans and new players alike
  welcomeBox: 'su:welcome', // the welcome Mythic Set Box (Titan Trials open)
  titanBox: 'su:titanbox:', // su:titanbox:<titan> — that titan's Legendary Set Box (its Nightmare first clear)
  // Set Boxes v2 (SET_BOXES_V2.md §6): 1 once this build paid a `setbox-gift:` letter's claim (an older build that
  // claimed it while its cleanMail had stripped the v2 boxes paid nothing: the next load here pays them once)
  giftPaid: 'su:paid:',
});
/** Items mirrored in `inv:` (an older build drops unknown item ids). */
export const MIRRORED_ITEMS = Object.freeze([SEED_ID, NEEDLE_ID, ARMBAND_ID, ...GEAR_UPDATE_ITEM_IDS, ...SET_BOX_V2_IDS]);

/** Freeplay milestone items, once per tier (gear-awaken §6.1, §6.2): the Matriarch a Seed, wave 150 two Needles. */
export const MILESTONE_ITEMS = Object.freeze({
  w150: Object.freeze([Object.freeze({ id: NEEDLE_ID, count: 2 })]),
  // LR gear (GEAR_UPDATE.md §4.6): wave 225 pays a Nightglass Lens, once per tier
  w225: Object.freeze([Object.freeze({ id: LENS_ID, count: 1 })]),
  matriarch: Object.freeze([Object.freeze({ id: SEED_ID, count: 1 })]),
});
/** missions.counters prefixes: a paid freeplay milestone ('fpm:tier:id') and its items paid ('fpu:tier:id'). */
export const MILESTONE_MARK = 'fpm:';
export const MILESTONE_ITEMS_MARK = 'fpu:';

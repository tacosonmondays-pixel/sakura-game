// Gear: rolling, equipping, rerolls, enhancement and salvage (owner: systems). See CONTRACTS.md §5.
//
// GearInstance = { uid, slot, rarity, level 0-10 (0-12 when ur), main: { stat, value, base },
//                  subs: [{ stat, value, base, upgrades, tuned? }], locked, equippedBy, name, ur?, club? }
// `base` is the value at +0 (the main stat grows with level; subs grow by `upgrades` and ✦ stitches).
//
// Rainbow UR gear (docs/specs/GEAR_AWAKEN.md): a UR piece stays `rarity: 'legendary'` with `ur: 1`. Its
// numbers are STORED in Legendary form and read ×urMul(stat) — only through gearLines / effectiveValue,
// so a stale tab that rerolls a UR piece can never leave a line silently low.
// Academy Clubs and the two club-only substats (docs/specs/GEAR_STATS.md): `club` on Mythic+ pieces;
// Pierce (ribbons) and Aura Power (shoes) roll only on club pieces, so un-clubbed pieces keep today's odds.

import { GEAR_SLOTS, GEAR_MAIN_STATS, GEAR_SUBSTATS_BY_RARITY, ITEM_RARITIES, ITEM_RARITY_ORDER } from '../data/types.js';
import { GEAR_STAT_DEFS, GEAR_STAT_KEYS, BASE_STAT_KEYS, statName, subPool, BATTLE_CAPS, CAPPED_STATS, fillStats, midRoll, FILL_SOFT_M, AURA_FILL_M, FILL_WORTH, GEAR_FIT } from '../data/gearStats.js';
import { CLUBS, LIVE_CLUBS, CLUB_RARITIES, ARMBAND_COIN_STEP, ARMBAND_GIFT } from '../data/clubs.js';
import {
  UR_SCALE, UR_MAX_LEVEL, TUNE_GOLD, TUNE_RAINBOW, SEED_ID, NEEDLE_ID, ARMBAND_ID, AWAKEN_COINS, STITCH_COINS, TAKE_BACK_COINS,
  RESONANCE, LEGENDARY_SUFFIX, UR_SUFFIX, MARK,
} from '../data/gearAwaken.js';
import { getItem } from '../data/items.js';
import { createRng } from '../core/rng.js';
import { consumeItems, addItems, missingItems, itemCount } from './inventory.js';
import { track } from './missions.js';
import { potentialLevel } from './potential.js';

export const MAX_GEAR_LEVEL = 10;
/** Stat multiplier per gear rarity (UR, the awakened Legendary, is 3.2). */
export const GEAR_RARITY_SCALE = { common: 1, rare: 1.35, superRare: 1.75, mythic: 2.2, legendary: 2.8 };
const SCALE = { ...GEAR_RARITY_SCALE, ur: UR_SCALE };
/** Main stats roll 1.2× a substat's range. */
const MAIN_MUL = 1.2;
/** Main stat growth per enhancement level (fraction of its +0 value). */
const MAIN_GROWTH = { default: 0.06, armorPen: 0.04 };
/** Each sub upgrade adds this fraction of the stat's mid roll (scaled by rarity). */
const SUB_GROWTH = 0.5;
/** A substat grows on every Nth enhancement level. */
export const SUB_GROWTH_EVERY = 3;
/** Club favourites roll at this weight (others 1). */
const FAV_WEIGHT = 2;

const SLOT_NOUNS = {
  charm: ['Omamori', 'Pendant', 'Charm Bracelet', 'Brooch'],
  ribbon: ['Ribbon', 'Hair Bow', 'Scrunchie', 'Hairpin'],
  shoes: ['Loafers', 'Sneakers', 'Boots', 'Sandals'],
};
const STAT_PREFIX = {
  atkPct: ['Fierce', 'Valiant'],
  ratePct: ['Swift', 'Brisk'],
  rangePct: ['Farsight', 'Starlit'],
  critChance: ['Lucky', 'Clover'],
  critDmg: ['Ruthless', 'Keen'],
  // "Pierce" is a substat now: new Armor Pierce pieces are no longer named "Piercing …" (stored names stay)
  armorPen: ['Steelbreak', 'Platecutter'],
  costCut: ['Thrifty', 'Bargain'],
  ultHaste: ['Eager', 'Dawnspark'],
};
const RARITY_SUFFIX = { mythic: 'of the Crimson Moon', legendary: LEGENDARY_SUFFIX };

const rarityOrder = (r) => ITEM_RARITIES[r]?.order ?? 0;
const isPct = (stat) => !!GEAR_STAT_DEFS[stat]?.pct;
const roundStat = (stat, v) => (isPct(stat) ? Math.round(v * 10000) / 10000 : Math.round(v * 10) / 10);
const statScale = (stat, rarity) => {
  const s = SCALE[rarity] ?? 1;
  return stat === 'armorPen' ? 1 + (s - 1) * 0.5 : s;
};
/** ✦ marks on a line (0–2). */
export const tuneCount = (tuned) => ((tuned | 0) & TUNE_GOLD ? 1 : 0) + ((tuned | 0) & TUNE_RAINBOW ? 1 : 0);

// ---------------------------------------------------------------------------
// UR reads (gear-awaken §3): the only place stored values become effective values
// ---------------------------------------------------------------------------

/** @returns {boolean} an awakened (rainbow UR) piece */
export const isUrGear = (g) => !!g?.ur && g.rarity === 'legendary';
/** Price / payout tier: rarity order, UR = 5 (one rule for every price, so nothing falls back to Common). */
export const gearTier = (g) => (isUrGear(g) ? 5 : rarityOrder(g?.rarity));
/** The rarity key a piece's numbers scale with ('ur' for UR). */
export const gearScaleKey = (g) => (isUrLook(g) ? 'ur' : g?.rarity);
/** UR to the eye: an awakened piece, or a UR piece from someone's profile card (values already effective). */
export const isUrLook = (g) => isUrGear(g) || (!!g?.urCard && g.rarity === 'legendary');
/** Highest enhancement level of a piece (+12 for UR). */
export const maxGearLevel = (g) => (isUrGear(g) ? UR_MAX_LEVEL : MAX_GEAR_LEVEL);
/** UR read multiplier of a stat: ×8/7, Armor Pierce ×1.105. */
export const urMul = (stat) => statScale(stat, 'ur') / statScale(stat, 'legendary');
/** Effective value of one stored line of a piece. */
export const effectiveValue = (g, line) => (isUrGear(g) ? roundStat(line.stat, line.value * urMul(line.stat)) : line.value);

/**
 * Every line of a piece with its effective value (what cards show, totals sum and battle reads).
 * @returns {{ main: { stat, value }, subs: { stat, value, upgrades, tuned }[] }}
 */
export function gearLines(g) {
  return {
    main: { stat: g.main.stat, value: effectiveValue(g, g.main) },
    subs: (g.subs || []).map((s) => ({ stat: s.stat, value: effectiveValue(g, s), upgrades: s.upgrades || 0, tuned: s.tuned || 0 })),
  };
}

/** Range [min, max] a substat (+0) can roll at a rarity ('ur' for the UR read). */
export function substatRange(stat, rarity) {
  const [a, b] = GEAR_STAT_DEFS[stat].base;
  const s = statScale(stat, rarity);
  return [roundStat(stat, a * s), roundStat(stat, b * s)];
}

/** Highest value a main stat can show at a rarity and level (best +0 roll, grown; profile snapshots clamp to it). */
export function mainStatMax(stat, rarity, level = MAX_GEAR_LEVEL) {
  const growth = MAIN_GROWTH[stat] ?? MAIN_GROWTH.default;
  return roundStat(stat, mainStatRange(stat, rarity)[1] * (1 + growth * level));
}

/** Highest value a substat can show at a rarity after `upgrades` growths (✦ count as growths here). */
export function substatMax(stat, rarity, upgrades = 0) {
  return roundStat(stat, substatRange(stat, rarity)[1] + upgrades * subGrowth(stat, rarity));
}

/**
 * Highest effective value a line can show (tests, the save repair and the profile viewer).
 * @param {{ ur?: boolean, main?: boolean, level?: number, ups?: number, tuned?: number, rarity?: string }} o
 */
export function lineCeiling(stat, { ur = false, main = false, level = MAX_GEAR_LEVEL, ups = 0, tuned = 0, rarity = 'legendary' } = {}) {
  const r = ur ? 'ur' : rarity;
  if (main) return mainStatMax(stat, r, level);
  return substatMax(stat, r, ups + tuneCount(tuned));
}

/** Range [min, max] a main stat (+0) can roll at a rarity. */
export function mainStatRange(stat, rarity) {
  const [a, b] = GEAR_STAT_DEFS[stat].base;
  const s = statScale(stat, rarity) * MAIN_MUL;
  return [roundStat(stat, a * s), roundStat(stat, b * s)];
}

function rollSub(rng, stat, rarity) {
  const [a, b] = GEAR_STAT_DEFS[stat].base;
  const base = roundStat(stat, rng.range(a, b) * statScale(stat, rarity));
  return { stat, value: base, base, upgrades: 0 };
}

/** One growth step (▲ or ✦) of a stat at a rarity (stored form: Legendary for UR). */
export function subGrowth(stat, rarity) {
  const [a, b] = GEAR_STAT_DEFS[stat].base;
  return ((a + b) / 2) * statScale(stat, rarity) * SUB_GROWTH;
}

function applySubUpgrades(sub, rarity) {
  if (sub.base == null) sub.base = sub.value;
  sub.value = roundStat(sub.stat, sub.base + ((sub.upgrades || 0) + tuneCount(sub.tuned)) * subGrowth(sub.stat, rarity));
  return sub;
}

function rollMain(rng, stat, rarity) {
  const [a, b] = GEAR_STAT_DEFS[stat].base;
  const base = roundStat(stat, rng.range(a, b) * statScale(stat, rarity) * MAIN_MUL);
  return { stat, value: base, base };
}

function applyMainLevel(main, level) {
  const growth = MAIN_GROWTH[main.stat] ?? MAIN_GROWTH.default;
  if (main.base == null) main.base = main.value;
  main.value = roundStat(main.stat, main.base * (1 + growth * level));
  return main;
}

/** Recompute a piece's stored values from base, level, ▲ and ✦ (the save repair). */
export function recomputeGear(g) {
  applyMainLevel(g.main, g.level);
  for (const s of g.subs || []) applySubUpgrades(s, g.rarity);
  return g;
}

/** One fresh sub line from a piece's pool (the save repair's refill). */
export function rollFreshSub(rng, g) {
  const [stat] = pickSubStats(rng, 1, new Set([g.main.stat, ...(g.subs || []).map((s) => s.stat)]), favOf(g), poolOf(g));
  return stat ? rollSub(rng, stat, g.rarity) : null;
}

/**
 * Pick `count` distinct substat keys from `pool`, not in `exclude`. Without favourites it draws exactly as
 * before clubs (one rng.next() per line, uniform), so un-clubbed pieces keep today's odds and sequences;
 * a club's favourites weigh FAV_WEIGHT.
 */
function pickSubStats(rng, count, exclude, fav = null, pool = BASE_STAT_KEYS) {
  const left = pool.filter((s) => !exclude.has(s));
  const out = [];
  if (!fav || !fav.length) {
    while (out.length < count && left.length) out.push(left.splice(Math.floor(rng.next() * left.length), 1)[0]);
    return out;
  }
  while (out.length < count && left.length) {
    const w = left.map((s) => (fav.includes(s) ? FAV_WEIGHT : 1));
    let x = rng.next() * w.reduce((a, b) => a + b, 0);
    let i = 0;
    while (i < left.length - 1 && x >= w[i]) x -= w[i++];
    out.push(left.splice(i, 1)[0]);
  }
  return out;
}

const poolOf = (g) => subPool(g.slot, g.club);
const favOf = (g) => (g.club && CLUBS[g.club] ? CLUBS[g.club].fav : null);

/** Distribute `n` sub upgrades randomly over the given subs. */
function distributeUpgrades(rng, subs, n) {
  if (!subs.length) return;
  for (let i = 0; i < n; i++) subs[Math.floor(rng.next() * subs.length)].upgrades += 1;
}

/** Display name from main stat + slot (+ rarity suffix; UR pieces are "…of the Rainbow Sakura"). */
export function gearName(rng, slot, rarity, mainStat, { ur = false } = {}) {
  const prefix = rng.pick(STAT_PREFIX[mainStat] || ['Fine']);
  const noun = rng.pick(SLOT_NOUNS[slot] || [GEAR_SLOTS[slot]?.name || 'Gear']);
  const suffix = ur ? UR_SUFFIX : RARITY_SUFFIX[rarity];
  return suffix ? `${prefix} ${noun} ${suffix}` : `${prefix} ${noun}`;
}

/** The name with its rarity suffix swapped for the UR one (or added). */
export function urName(name) {
  const n = String(name || '');
  if (n.endsWith(UR_SUFFIX)) return n;
  if (n.endsWith(LEGENDARY_SUFFIX)) return n.slice(0, -LEGENDARY_SUFFIX.length) + UR_SUFFIX;
  return `${n} ${UR_SUFFIX}`.trim();
}

/**
 * Roll a new piece of gear (not yet in the profile; uid is null until addGear).
 * @param {object} rng createRng() instance
 * @param {{ slot?: string, rarity?: string, level?: number, club?: string }} opts slot defaults to random; a club
 *   (Mythic+) rolls from the club pool with its favourites
 * @returns {object} GearInstance
 */
export function rollGear(rng, { slot = null, rarity = 'common', level = 0, club = null } = {}) {
  const s = slot && GEAR_SLOTS[slot] ? slot : rng.pick(Object.keys(GEAR_SLOTS));
  const r = ITEM_RARITIES[rarity] ? rarity : 'common';
  const c = club && CLUBS[club] && CLUB_RARITIES.includes(r) ? club : null;
  const mainStat = rng.pick(GEAR_MAIN_STATS[s]);
  const main = rollMain(rng, mainStat, r);
  const subStats = pickSubStats(rng, GEAR_SUBSTATS_BY_RARITY[r] || 0, new Set([mainStat]), c ? CLUBS[c].fav : null, subPool(s, c));
  const subs = subStats.map((st) => rollSub(rng, st, r));
  const lvl = Math.max(0, Math.min(MAX_GEAR_LEVEL, Math.floor(level)));
  distributeUpgrades(rng, subs, Math.floor(lvl / SUB_GROWTH_EVERY));
  subs.forEach((sub) => applySubUpgrades(sub, r));
  applyMainLevel(main, lvl);
  const g = { uid: null, slot: s, rarity: r, level: lvl, main, subs, locked: false, equippedBy: null, name: gearName(rng, s, r, mainStat) };
  if (c) g.club = c;
  return g;
}

/**
 * A fresh Mythic+ piece joins a club when it enters the backpack (gear-stats §C.4): one live club at random
 * from its OWN rng (`club|<createdAt>|<uid>`), so no reward draw shifts. Its substats are then re-drawn from
 * that club's pool (favourites ×2), keeping its count and ▲, so new drops can carry Pierce / Aura Power.
 */
function joinClubOnDrop(profile, g, uid, club) {
  if (!CLUB_RARITIES.includes(g.rarity) || g.club) return;
  const rng = createRng(`club|${profile.createdAt || 0}|${uid}`);
  g.club = club && CLUBS[club] ? club : LIVE_CLUBS[Math.floor(rng.next() * LIVE_CLUBS.length)];
  const ups = g.subs.reduce((n, s) => n + (s.upgrades || 0), 0);
  const fresh = pickSubStats(rng, g.subs.length, new Set([g.main.stat]), favOf(g), poolOf(g)).map((st) => rollSub(rng, st, g.rarity));
  distributeUpgrades(rng, fresh, ups);
  fresh.forEach((s) => applySubUpgrades(s, g.rarity));
  g.subs = fresh;
}

/**
 * Store gear in the profile (assigns a uid when missing). A dropped piece (stage drops, gear boxes) passes
 * `club`: a fresh Mythic+ piece then joins that club ('random' = a random live club; an id = Titan Trials'
 * Club Focus) and the save gets its one-time Armband welcome.
 * @param {{ club?: string|null }} [opts]
 * @returns {string} uid
 */
export function addGear(profile, gear, { club = null } = {}) {
  profile.seq ||= { gear: 0 };
  let uid = gear.uid;
  const fresh = !uid;
  if (!uid || profile.gear[uid]) {
    do uid = `g${++profile.seq.gear}`; while (profile.gear[uid]);
  }
  const g = { ...gear, uid, equippedBy: null };
  if (fresh && club) joinClubOnDrop(profile, g, uid, club === 'random' ? null : club);
  profile.gear[uid] = g;
  if (club) armbandWelcome(profile);
  if (gear.rarity) track(profile, `gear:${gear.rarity}`, 1); // achievements: gear of a rarity ever obtained
  return uid;
}

/**
 * Most gear pieces a save holds (equipped ones included). Opening boxes stops there, so a huge
 * pile of boxes can never freeze the game or grow the save past what the browser can store
 * (99,000 boxes opened at once did both).
 */
export const GEAR_BAG_MAX = 1000;
/** Most boxes one tap opens. */
export const OPEN_BATCH_MAX = 100;
/** @returns {number} gear pieces in the save */
export const gearCount = (profile) => Object.keys(profile?.gear || {}).length;
/** @returns {number} free places in the gear bag */
export const gearRoom = (profile) => Math.max(0, GEAR_BAG_MAX - gearCount(profile));

/**
 * Open up to `count` boxes: at most OPEN_BATCH_MAX at a time and never past GEAR_BAG_MAX
 * (boxes that don't fit stay in the backpack).
 * @param {{ club?: string }} [opts] the club fresh Mythic+ pieces join (Titan Trials' Club Focus; default random)
 * @returns {{ ok: boolean, error?: 'notGearBox'|'missing'|'bagFull', gear: object[], opened?: number, wanted?: number }}
 */
export function openGearBox(profile, itemId, rng, count = 1, { club = null } = {}) {
  const item = getItem(itemId);
  if (!item || item.category !== 'gearbox') return { ok: false, error: 'notGearBox', gear: [] };
  // the Rainbow Gear Box opens only through its slot picker, into rainbow (UR) gear (ASCENSION.md §C.8)
  if (item.pickSlot) return { ok: false, error: 'pickSlot', gear: [] };
  const wanted = Math.max(1, Math.floor(count));
  const n = Math.min(wanted, OPEN_BATCH_MAX, gearRoom(profile));
  if (n <= 0) return { ok: false, error: 'bagFull', gear: [], opened: 0, wanted };
  if (!consumeItems(profile, [{ id: itemId, count: n }])) return { ok: false, error: 'missing', gear: [] };
  const gear = [];
  for (let i = 0; i < n; i++) {
    const g = rollGear(rng, { rarity: item.rarity });
    g.uid = addGear(profile, g, { club: club || 'random' });
    gear.push(profile.gear[g.uid]);
  }
  return { ok: true, gear, opened: n, wanted };
}

// ---------------------------------------------------------------------------
// The Rainbow Gear Box (docs/specs/ASCENSION.md §C.8): Titan Trials' UR box, opened through a slot picker
// ---------------------------------------------------------------------------

export const RAINBOW_BOX_ID = 'gearbox_rainbow';

/** `gbx:` value of a box-born UR piece: slot index × 100 + main-stat index + 1 (0 = none / salvaged). */
export function boxMark(g) {
  const s = Object.keys(GEAR_SLOTS).indexOf(g?.slot);
  const m = s >= 0 ? (GEAR_MAIN_STATS[g.slot] || []).indexOf(g.main?.stat) : -1;
  return s >= 0 && m >= 0 ? s * 100 + m + 1 : 0;
}

/**
 * Open one Rainbow Gear Box into the slot the player picked: one Legendary piece already rainbow UR
 * (`ur: 1`), +0, four substats, locked like an awakened piece. A fresh piece joins a club like every box
 * piece (`club`: 'random' until Titan Trials' Club Focus exists). Writes the `gbx:<uid>` mirror so an
 * older build that drops `ur` below +10 gives it back (gearMarks.js restoreGearMarks).
 * @param {'charm'|'ribbon'|'shoes'} slot
 * @returns {{ ok: boolean, error?: 'slot'|'bagFull'|'missing', gear: object|null }}
 */
export function openRainbowBox(profile, slot, rng, { club = 'random' } = {}) {
  if (!GEAR_SLOTS[slot]) return { ok: false, error: 'slot', gear: null };
  if (gearRoom(profile) <= 0) return { ok: false, error: 'bagFull', gear: null };
  if (!consumeItems(profile, [{ id: RAINBOW_BOX_ID, count: 1 }])) return { ok: false, error: 'missing', gear: null };
  const g = rollGear(rng, { slot, rarity: 'legendary', level: 0 });
  g.ur = 1;
  g.locked = true;
  g.name = urName(g.name);
  const uid = addGear(profile, g, { club });
  const piece = profile.gear[uid];
  const c = (profile.missions ||= {}).counters ||= {};
  c[MARK.box + uid] = boxMark(piece);
  c[MARK.urEver] = (c[MARK.urEver] || 0) + 1;
  return { ok: true, gear: piece };
}

/**
 * Equip gear on a unit. Swaps out the unit's previous piece in that slot and removes the
 * gear from its previous owner.
 * @returns {{ ok: boolean, error?: string, previous?: string|null }}
 */
export function equipGear(profile, unitId, uid) {
  const unit = profile.units[unitId];
  const gear = profile.gear[uid];
  if (!unit) return { ok: false, error: 'notOwned' };
  if (!gear) return { ok: false, error: 'noGear' };
  const slot = gear.slot;
  if (gear.equippedBy && gear.equippedBy !== unitId) {
    const other = profile.units[gear.equippedBy];
    if (other && other.gear[slot] === uid) other.gear[slot] = null;
  }
  const previous = unit.gear[slot];
  if (previous && previous !== uid && profile.gear[previous]) profile.gear[previous].equippedBy = null;
  unit.gear[slot] = uid;
  gear.equippedBy = unitId;
  noteUrWorn(profile, unitId);
  return { ok: true, previous: previous && previous !== uid ? previous : null };
}

/** Remove whatever the unit wears in a slot. @returns {{ ok: boolean, uid?: string }} */
export function unequipGear(profile, unitId, slot) {
  const unit = profile.units[unitId];
  if (!unit || !GEAR_SLOTS[slot]) return { ok: false };
  const uid = unit.gear[slot];
  if (uid && profile.gear[uid]) profile.gear[uid].equippedBy = null;
  unit.gear[slot] = null;
  return { ok: true, uid: uid || null };
}

/** Toggle the protection lock (locked gear cannot be salvaged). */
export function setGearLocked(profile, uid, locked) {
  const g = profile.gear[uid];
  if (!g) return false;
  g.locked = !!locked;
  return true;
}

// ---------------------------------------------------------------------------
// Rerolls
// ---------------------------------------------------------------------------

/** Indices of ✦ lines (kept in place by every substat reroll, a free lock). */
export const tunedIndices = (g) => (g.subs || []).map((s, i) => (s.tuned ? i : -1)).filter((i) => i >= 0);

/** A Lock Pin is offered only while at least 2 lines still reroll. */
export function canLockPin(g, lockIndex) {
  if (lockIndex == null) return true;
  if (!Number.isInteger(lockIndex) || lockIndex < 0 || lockIndex >= (g.subs?.length || 0)) return false;
  if (g.subs[lockIndex].tuned) return false; // already kept for free
  return g.subs.length - tunedIndices(g).length - 1 >= 2;
}

/**
 * Cost of a substat reroll: Fortune Dice (+1 Lock Pin when a substat is locked) + coins.
 * @returns {{id:string,count:number}[]}
 */
export function rerollCost(gear, { lockIndex = null } = {}) {
  const o = gearTier(gear);
  const cost = [{ id: 'dice_reroll', count: o >= 4 ? 3 : o >= 3 ? 2 : 1 }, { id: 'coins', count: 2000 * (o + 1) }];
  if (lockIndex != null) cost.push({ id: 'lock_pin', count: 1 });
  return cost;
}

/** Cost of a main-stat reroll: one Prism Dice + coins. */
export function mainRerollCost(gear) {
  return [{ id: 'dice_prism', count: 1 }, { id: 'coins', count: 5000 * (gearTier(gear) + 1) }];
}

/** Main stats a Prism Dice can turn this piece into (the player picks one). */
export const mainStatChoices = (gear) => (GEAR_MAIN_STATS[gear.slot] || []).filter((s) => s !== gear.main.stat);

const cloneGear = (g) => JSON.parse(JSON.stringify(g));

/**
 * Reroll every substat (optionally keeping one locked). ✦ lines always stay with their ▲ (a free lock).
 * Enhancement upgrades already earned are kept: kept subs keep their own, the rest are redistributed.
 * @returns {{ ok: boolean, error?: string, before?: object, after?: object, cost?: object[] }}
 */
export function rerollSubstats(profile, uid, rng, { lockIndex = null } = {}) {
  const gear = profile.gear[uid];
  if (!gear) return { ok: false, error: 'noGear' };
  if (!gear.subs.length) return { ok: false, error: 'noSubstats' };
  if (lockIndex != null && (!Number.isInteger(lockIndex) || lockIndex < 0 || lockIndex >= gear.subs.length)) return { ok: false, error: 'badLock' };
  if (lockIndex != null && gear.subs.length < 2) return { ok: false, error: 'badLock' };
  if (lockIndex != null && !canLockPin(gear, lockIndex)) return { ok: false, error: 'badLock' };
  const cost = rerollCost(gear, { lockIndex });
  if (!consumeItems(profile, cost)) return { ok: false, error: 'missing', missing: missingItems(profile, cost) };
  const before = cloneGear(gear);
  const keep = new Set(tunedIndices(gear));
  if (lockIndex != null) keep.add(lockIndex);
  const exclude = new Set([gear.main.stat]);
  for (const i of keep) exclude.add(gear.subs[i].stat);
  const fresh = pickSubStats(rng, gear.subs.length - keep.size, exclude, favOf(gear), poolOf(gear)).map((st) => rollSub(rng, st, gear.rarity));
  const totalUpgrades = Math.floor(gear.level / SUB_GROWTH_EVERY);
  const keptUps = [...keep].reduce((n, i) => n + (gear.subs[i].upgrades || 0), 0);
  distributeUpgrades(rng, fresh, Math.max(0, totalUpgrades - keptUps));
  fresh.forEach((s) => applySubUpgrades(s, gear.rarity));
  const subs = [];
  let k = 0;
  for (let i = 0; i < gear.subs.length; i++) subs.push(keep.has(i) ? gear.subs[i] : fresh[k++]);
  gear.subs = subs;
  track(profile, 'gearReroll', 1);
  track(profile, 'spendCoins', cost.find((c) => c.id === 'coins').count);
  return { ok: true, before, after: cloneGear(gear), cost };
}

/**
 * Change the main stat into a different stat allowed for the slot: `stat` picks it (the player chooses),
 * else one at random. A substat that collides with the new main stat is rerolled into a free stat and
 * keeps its ▲ and ✦.
 * @returns {{ ok: boolean, error?: string, before?: object, after?: object }}
 */
export function rerollMainStat(profile, uid, rng, { stat: chosen = null } = {}) {
  const gear = profile.gear[uid];
  if (!gear) return { ok: false, error: 'noGear' };
  const options = mainStatChoices(gear);
  if (!options.length) return { ok: false, error: 'noOptions' };
  if (chosen != null && !options.includes(chosen)) return { ok: false, error: 'badStat' };
  const cost = mainRerollCost(gear);
  if (!consumeItems(profile, cost)) return { ok: false, error: 'missing', missing: missingItems(profile, cost) };
  const before = cloneGear(gear);
  const stat = chosen ?? rng.pick(options);
  gear.main = applyMainLevel(rollMain(rng, stat, gear.rarity), gear.level);
  const clash = gear.subs.findIndex((s) => s.stat === stat);
  if (clash >= 0) {
    const used = new Set([stat, ...gear.subs.map((s) => s.stat)]);
    const [replacement] = pickSubStats(rng, 1, used, favOf(gear), poolOf(gear));
    const sub = rollSub(rng, replacement, gear.rarity);
    sub.upgrades = gear.subs[clash].upgrades || 0;
    if (gear.subs[clash].tuned) sub.tuned = gear.subs[clash].tuned;
    gear.subs[clash] = applySubUpgrades(sub, gear.rarity);
  }
  gear.name = gearName(rng, gear.slot, gear.rarity, stat, { ur: isUrGear(gear) });
  track(profile, 'gearReroll', 1);
  track(profile, 'spendCoins', cost.find((c) => c.id === 'coins').count);
  return { ok: true, before, after: cloneGear(gear), cost };
}

// ---------------------------------------------------------------------------
// Enhance and salvage
// ---------------------------------------------------------------------------

const levelCoins = (tier, l) => (800 + 400 * l) * (tier + 1);

/** Coins for the next enhancement level (null at max; UR +11 / +12 at tier-6 prices). */
export function enhanceCost(gear) {
  if (gear.level >= maxGearLevel(gear)) return null;
  return levelCoins(gearTier(gear), gear.level);
}

/** Total coins spent enhancing a piece to its current level (+11 / +12 of a UR piece at its tier). */
export function enhanceInvested(gear) {
  let total = 0;
  const base = rarityOrder(gear.rarity);
  for (let l = 0; l < gear.level; l++) total += levelCoins(l >= MAX_GEAR_LEVEL ? gearTier(gear) : base, l);
  return total;
}

/** The line that grows at the next ▲ (least-upgraded, ties → first; ✦ never count). */
export function nextGrowthIndex(gear) {
  if (!gear.subs?.length) return null;
  let best = 0;
  gear.subs.forEach((s, i) => { if ((s.upgrades || 0) < (gear.subs[best].upgrades || 0)) best = i; });
  return best;
}

/**
 * +1 level (max 10, UR 12). The main stat grows every level; every 3rd level the least-upgraded
 * substat grows (deterministic, ties → first). The first Legendary +10 ever pays the first-bloom Seed.
 * @returns {{ ok: boolean, error?: string, level?: number, grewSub?: number|null, cost?: number, gift?: object[] }}
 */
export function enhanceGear(profile, uid) {
  const gear = profile.gear[uid];
  if (!gear) return { ok: false, error: 'noGear' };
  const cost = enhanceCost(gear);
  if (cost == null) return { ok: false, error: 'max' };
  if (!consumeItems(profile, [{ id: 'coins', count: cost }])) return { ok: false, error: 'missing', missing: [{ id: 'coins', need: cost, have: itemCount(profile, 'coins') }] };
  gear.level += 1;
  applyMainLevel(gear.main, gear.level);
  if (gear.level === MAX_GEAR_LEVEL) track(profile, `gear10:${gear.rarity}`, 1); // achievements: pieces ever at +10
  let grewSub = null;
  if (gear.level % SUB_GROWTH_EVERY === 0 && gear.subs.length) {
    const best = nextGrowthIndex(gear);
    const sub = gear.subs[best];
    sub.upgrades = (sub.upgrades || 0) + 1;
    applySubUpgrades(sub, gear.rarity);
    grewSub = best;
  }
  track(profile, 'spendCoins', cost);
  const gift = gear.rarity === 'legendary' && gear.level === MAX_GEAR_LEVEL ? firstBloomGift(profile) : null;
  return { ok: true, level: gear.level, grewSub, cost, ...(gift ? { gift } : {}) };
}

/** Once per save: 1 Rainbow Seed the first time it holds a Legendary +10. @returns {object[]|null} */
export function firstBloomGift(profile) {
  const c = (profile.missions ||= {}).counters ||= {};
  if (c[MARK.seedGift]) return null;
  c[MARK.seedGift] = 1;
  return addItems(profile, [{ id: SEED_ID, count: 1 }]);
}

/** Rewards salvaging would give (preview): a UR or stitched piece also returns its Seed and every Needle. */
export function salvageRewards(gear) {
  const o = rarityOrder(gear.rarity);
  const rewards = [{ id: 'coins', count: 300 * (o + 1) * (o + 1) + Math.floor(enhanceInvested(gear) * 0.5) }];
  const dice = [0, 0, 1, 2, 3][o];
  if (dice) rewards.push({ id: 'dice_reroll', count: dice });
  if (gear.rarity === 'legendary') rewards.push({ id: 'lock_pin', count: 1 });
  if (isUrGear(gear)) rewards.push({ id: SEED_ID, count: 1 });
  const needles = (gear.subs || []).reduce((n, s) => n + tuneCount(s.tuned), 0);
  if (needles) rewards.push({ id: NEEDLE_ID, count: needles });
  return rewards;
}

/**
 * Destroy gear for coins (half the enhancement cost back) and dice. Equipped or locked
 * gear is refused.
 * @returns {{ ok: boolean, error?: string, rewards: object[] }}
 */
export function salvageGear(profile, uid) {
  const gear = profile.gear[uid];
  if (!gear) return { ok: false, error: 'noGear', rewards: [] };
  if (gear.locked) return { ok: false, error: 'locked', rewards: [] };
  if (gear.equippedBy) return { ok: false, error: 'equipped', rewards: [] };
  const rewards = salvageRewards(gear);
  delete profile.gear[uid];
  dropMarks(profile, uid);
  addItems(profile, rewards);
  track(profile, 'salvage', 1);
  return { ok: true, rewards };
}

/** A salvaged piece's mirrors go with it (its refund is paid now, never again from a mark). */
function dropMarks(profile, uid) {
  const c = profile.missions?.counters;
  if (!c) return;
  for (const p of [MARK.ur, MARK.tuned, MARK.club, MARK.newLine, MARK.newFp]) delete c[p + uid];
  // a box-born piece's mark stays as 0: its Seed was paid with the salvage (ASCENSION.md §C.8)
  if (MARK.box + uid in c) c[MARK.box + uid] = 0;
}

// ---------------------------------------------------------------------------
// Rainbow Bloom (awakening) and the Starlight Needle (gear-awaken §2, §4)
// ---------------------------------------------------------------------------

/** @returns {{id:string,count:number}[]} 1 Rainbow Seed + 80,000 coins */
export const awakenGearCost = () => [{ id: SEED_ID, count: 1 }, { id: 'coins', count: AWAKEN_COINS }];

/** @returns {{ ok: boolean, reason?: 'noGear'|'rarity'|'level'|'already'|'missing', missing?: object[], cost?: object[] }} */
export function canAwakenGear(profile, uid) {
  const g = profile.gear?.[uid];
  if (!g) return { ok: false, reason: 'noGear' };
  if (g.rarity !== 'legendary') return { ok: false, reason: 'rarity' };
  if (isUrGear(g)) return { ok: false, reason: 'already' };
  if (g.level < MAX_GEAR_LEVEL) return { ok: false, reason: 'level' };
  const cost = awakenGearCost();
  const missing = missingItems(profile, cost);
  if (missing.length) return { ok: false, reason: 'missing', missing, cost };
  return { ok: true, cost };
}

/** True when a piece could awaken now if the Seed and coins were there (the ✦ "Can awaken" hint). */
export const awakenReady = (g) => !!g && g.rarity === 'legendary' && !isUrGear(g) && g.level >= MAX_GEAR_LEVEL;

/**
 * Rainbow Bloom: a Legendary +10 becomes UR. Always succeeds; auto-locks; values stay stored in Legendary
 * form (every read grows ×8/7 at once); a gold ✦ is kept and the rainbow ✦ slot opens.
 * @returns {{ ok: boolean, error?: string, missing?: object[], before?: object, after?: object }}
 */
export function awakenGear(profile, uid) {
  const check = canAwakenGear(profile, uid);
  if (!check.ok) return { ok: false, error: check.reason, missing: check.missing };
  if (!consumeItems(profile, check.cost)) return { ok: false, error: 'missing', missing: missingItems(profile, check.cost) };
  const g = profile.gear[uid];
  const before = cloneGear(g);
  g.ur = 1;
  g.locked = true;
  g.name = urName(g.name);
  const c = (profile.missions ||= {}).counters ||= {};
  c[MARK.ur + uid] = g.level;
  c[MARK.urEver] = (c[MARK.urEver] || 0) + 1;
  if (g.equippedBy) noteUrWorn(profile, g.equippedBy);
  track(profile, 'gearAwaken', 1);
  track(profile, 'spendCoins', AWAKEN_COINS);
  return { ok: true, before, after: cloneGear(g) };
}

/**
 * The stitch slots of a piece: gold (Legendary +10 or UR), rainbow (UR only). `used` = already stitched.
 * @returns {{ gold: { open: boolean, used: boolean }, rainbow: { open: boolean, used: boolean }, free: 'gold'|'rainbow'|null }}
 */
export function stitchSlots(g) {
  const tuned = (g?.subs || []).reduce((m, s) => m | (s.tuned | 0), 0);
  const gold = { open: !!g && g.rarity === 'legendary' && (isUrGear(g) || g.level >= MAX_GEAR_LEVEL), used: !!(tuned & TUNE_GOLD) };
  const rainbow = { open: isUrGear(g), used: !!(tuned & TUNE_RAINBOW) };
  const free = gold.open && !gold.used ? 'gold' : rainbow.open && !rainbow.used ? 'rainbow' : null;
  return { gold, rainbow, free };
}

/** @returns {{id:string,count:number}[]} 1 Starlight Needle + 20,000 coins */
export const stitchCost = () => [{ id: NEEDLE_ID, count: 1 }, { id: 'coins', count: STITCH_COINS }];

/** @returns {{ ok: boolean, reason?: string, slot?: 'gold'|'rainbow', missing?: object[], cost?: object[] }} */
export function canStitch(profile, uid, subIndex) {
  const g = profile.gear?.[uid];
  if (!g) return { ok: false, reason: 'noGear' };
  if (!Number.isInteger(subIndex) || !g.subs?.[subIndex]) return { ok: false, reason: 'badLine' };
  const slots = stitchSlots(g);
  if (!slots.gold.open) return { ok: false, reason: g.rarity === 'legendary' ? 'level' : 'rarity' };
  if (!slots.free) return { ok: false, reason: 'full' };
  const cost = stitchCost();
  const missing = missingItems(profile, cost);
  if (missing.length) return { ok: false, reason: 'missing', missing, cost, slot: slots.free };
  return { ok: true, slot: slots.free, cost };
}

/**
 * Stitch a ✦ onto a substat: +1 growth step at the piece's scale (gold slot first, then rainbow).
 * @returns {{ ok: boolean, error?: string, slot?: string, before?: object, after?: object }}
 */
export function stitchSub(profile, uid, subIndex) {
  const check = canStitch(profile, uid, subIndex);
  if (!check.ok) return { ok: false, error: check.reason, missing: check.missing };
  if (!consumeItems(profile, check.cost)) return { ok: false, error: 'missing', missing: missingItems(profile, check.cost) };
  const g = profile.gear[uid];
  const before = cloneGear(g);
  const sub = g.subs[subIndex];
  sub.tuned = (sub.tuned | 0) | (check.slot === 'gold' ? TUNE_GOLD : TUNE_RAINBOW);
  applySubUpgrades(sub, g.rarity);
  track(profile, 'gearStitch', 1);
  track(profile, 'spendCoins', STITCH_COINS);
  return { ok: true, slot: check.slot, before, after: cloneGear(g) };
}

/**
 * Take back one ✦ from a line (rainbow before gold) for 10,000 coins; the Needle comes back.
 * @returns {{ ok: boolean, error?: string, before?: object, after?: object }}
 */
export function takeBackStitch(profile, uid, subIndex) {
  const g = profile.gear?.[uid];
  const sub = g?.subs?.[subIndex];
  if (!sub) return { ok: false, error: 'badLine' };
  if (!sub.tuned) return { ok: false, error: 'notTuned' };
  const cost = [{ id: 'coins', count: TAKE_BACK_COINS }];
  if (!consumeItems(profile, cost)) return { ok: false, error: 'missing', missing: missingItems(profile, cost) };
  const before = cloneGear(g);
  sub.tuned = sub.tuned & TUNE_RAINBOW ? sub.tuned & ~TUNE_RAINBOW : sub.tuned & ~TUNE_GOLD;
  if (!sub.tuned) delete sub.tuned;
  applySubUpgrades(sub, g.rarity);
  addItems(profile, [{ id: NEEDLE_ID, count: 1 }]);
  track(profile, 'spendCoins', TAKE_BACK_COINS);
  return { ok: true, before, after: cloneGear(g) };
}

// ---------------------------------------------------------------------------
// Academy Clubs (gear-stats §C)
// ---------------------------------------------------------------------------

/** @returns {{id:string,count:number}[]} 1 Club Armband + 2,000 × (tier + 1) coins */
export const armbandCost = (g) => [{ id: ARMBAND_ID, count: 1 }, { id: 'coins', count: ARMBAND_COIN_STEP * (gearTier(g) + 1) }];

/** @returns {{ ok: boolean, reason?: string, missing?: object[], cost?: object[] }} */
export function canTieArmband(profile, uid, club) {
  const g = profile.gear?.[uid];
  if (!g) return { ok: false, reason: 'noGear' };
  if (!CLUB_RARITIES.includes(g.rarity)) return { ok: false, reason: 'rarity' };
  if (!LIVE_CLUBS.includes(club)) return { ok: false, reason: 'badClub' };
  if (g.club === club) return { ok: false, reason: 'same' };
  const cost = armbandCost(g);
  const missing = missingItems(profile, cost);
  if (missing.length) return { ok: false, reason: 'missing', missing, cost };
  return { ok: true, cost };
}

/** Once per save, the first time it holds a Mythic or better piece: 9 Club Armbands. @returns {boolean} paid now */
export function armbandWelcome(profile) {
  const c = (profile.missions ||= {}).counters ||= {};
  if (c[MARK.bandGift] || !Object.values(profile.gear || {}).some((g) => CLUB_RARITIES.includes(g.rarity))) return false;
  c[MARK.bandGift] = 1;
  addItems(profile, [{ id: ARMBAND_ID, count: ARMBAND_GIFT }]);
  return true;
}

/** Tie a Club Armband: the piece joins `club`. Its stats never change. */
export function tieArmband(profile, uid, club) {
  const check = canTieArmband(profile, uid, club);
  if (!check.ok) return { ok: false, error: check.reason, missing: check.missing };
  if (!consumeItems(profile, check.cost)) return { ok: false, error: 'missing', missing: missingItems(profile, check.cost) };
  profile.gear[uid].club = club;
  track(profile, 'spendCoins', check.cost.find((c) => c.id === 'coins').count);
  return { ok: true };
}

/** The pieces a girl wears. */
export function wornGear(profile, unitId) {
  const unit = profile?.units?.[unitId];
  if (!unit) return [];
  return Object.keys(GEAR_SLOTS).map((s) => unit.gear?.[s] && profile.gear?.[unit.gear[s]]).filter(Boolean);
}

/**
 * Her club set and Rainbow Resonance.
 * @returns {{ club: string|null, clubN: number, clubs: Object<string,number>, ur: number, resonance: number }}
 */
export function gearSetInfo(profile, unitId) {
  const worn = wornGear(profile, unitId);
  const clubs = {};
  for (const g of worn) if (g.club && CLUBS[g.club]) clubs[g.club] = (clubs[g.club] || 0) + 1;
  let club = null;
  let clubN = 0;
  for (const [id, n] of Object.entries(clubs)) if (n > clubN) [club, clubN] = [id, n];
  if (clubN < 2) club = null;
  const ur = worn.filter(isUrLook).length;
  return { club, clubN: club ? clubN : 0, clubs, ur, resonance: RESONANCE[Math.min(3, ur)] || 0 };
}

/** The highest number of UR pieces one girl has worn (counter-backed, never goes down). */
function noteUrWorn(profile, unitId) {
  const n = wornGear(profile, unitId).filter(isUrGear).length;
  const c = (profile.missions ||= {}).counters ||= {};
  if (n > (c[MARK.urWorn] || 0)) c[MARK.urWorn] = n;
}

// ---------------------------------------------------------------------------
// Totals and Every Line Counts (gear-stats §B)
// ---------------------------------------------------------------------------

const zeroTotals = () => Object.fromEntries(GEAR_STAT_KEYS.map((k) => [k, 0]));

/**
 * Sum of every stat on the gear a unit wears (effective values), plus her club's 2-piece stat and
 * Rainbow Resonance's Range. Raw sums: caps are applied in unitBattleStats.
 * @returns {{ atkPct, ratePct, rangePct, critChance, critDmg, armorPen, costCut, ultHaste, piercePct, auraPct }}
 */
export function gearStatTotals(profile, unitId) {
  const totals = zeroTotals();
  const unit = profile?.units?.[unitId];
  if (!unit) return totals;
  for (const g of wornGear(profile, unitId)) {
    const L = gearLines(g);
    for (const s of [L.main, ...L.subs]) if (s && totals[s.stat] != null) totals[s.stat] += s.value;
  }
  const set = gearSetInfo(profile, unitId);
  if (set.club) totals[CLUBS[set.club].two.stat] += CLUBS[set.club].two.value;
  totals.rangePct += set.resonance;
  for (const k of Object.keys(totals)) totals[k] = roundStat(k, totals[k]);
  return totals;
}

/** Fill-in worth of `value` of `stat` toward `target` (half an ATK line's worth; scale `s` = the piece's). */
function fillWorth(stat, value, target, scaleKey = 'legendary') {
  const mid = (k) => midRoll(k) * statScale(k, scaleKey);
  return FILL_WORTH * value * mid(target) / mid(stat);
}

/**
 * Every Line Counts: the lines her kit can't use (GEAR_FIT, by her stars and Potential) and the part of a
 * capped stat over its MAX turn into ATK — or, for Umeko and Miko, into Aura Power and aura radius. Soft
 * limit: fill = M·f / (f + M). Fill lines still feed their own stat too.
 * @returns {{ target: 'atk'|'aura', total: number, cap: number, lines: { uid, index, stat, value, share }[], over: { stat, value, share }[] }}
 */
export function gearFillIn(profile, unitId) {
  const unit = profile?.units?.[unitId];
  const aura = GEAR_FIT[unitId]?.fillTo === 'aura';
  const target = aura ? 'auraPct' : 'atkPct';
  const M = aura ? AURA_FILL_M : FILL_SOFT_M;
  const out = { target: aura ? 'aura' : 'atk', total: 0, cap: M, lines: [], over: [] };
  if (!unit) return out;
  const dead = fillStats(unitId, { awaken: unit.awaken || 0, potential: potentialLevel(unit) });
  const parts = [];
  for (const g of wornGear(profile, unitId)) {
    const L = gearLines(g);
    const sk = gearScaleKey(g);
    const lines = [{ ...L.main, index: -1 }, ...L.subs.map((s, i) => ({ ...s, index: i }))];
    for (const l of lines) if (dead.has(l.stat) && l.value > 0) parts.push({ kind: 'line', uid: g.uid, index: l.index, stat: l.stat, value: l.value, w: fillWorth(l.stat, l.value, target, sk) });
  }
  const set = gearSetInfo(profile, unitId);
  if (set.club && dead.has(CLUBS[set.club].two.stat)) {
    const t = CLUBS[set.club].two;
    parts.push({ kind: 'line', uid: null, index: 'club', stat: t.stat, value: t.value, w: fillWorth(t.stat, t.value, target) });
  }
  const totals = gearStatTotals(profile, unitId);
  for (const stat of CAPPED_STATS) {
    const over = totals[stat] - BATTLE_CAPS[stat];
    if (over > 1e-9 && !dead.has(stat)) parts.push({ kind: 'over', stat, value: roundStat(stat, over), w: fillWorth(stat, over, target) });
  }
  const f = parts.reduce((n, p) => n + p.w, 0);
  if (f <= 0) return out;
  out.total = Math.round((M * f / (f + M)) * 10000) / 10000;
  for (const p of parts) {
    const share = Math.round(out.total * p.w / f * 10000) / 10000;
    if (p.kind === 'line') out.lines.push({ uid: p.uid, index: p.index, stat: p.stat, value: p.value, share });
    else out.over.push({ stat: p.stat, value: p.value, share });
  }
  return out;
}

/**
 * '+5.2% ATK' / '+2 Armor Pierce' / '+46% Pierce'
 * @returns {string}
 */
export function describeStat(stat, value) {
  const def = GEAR_STAT_DEFS[stat];
  if (!def) return `+${value} ${stat}`;
  if (def.pct) {
    const v = Math.round(value * 1000) / 10;
    return `+${v}% ${statName(stat)}`;
  }
  return `+${Math.round(value * 10) / 10} ${statName(stat)}`;
}

/** describeStat of a piece's line read through its UR multiplier. */
export const describeLine = (g, line) => describeStat(line.stat, effectiveValue(g, line));

/** Gear of the profile, best first (tier, level), optionally filtered by slot. */
export function gearList(profile, { slot = null } = {}) {
  return Object.values(profile.gear)
    .filter((g) => !slot || g.slot === slot)
    .sort((a, b) => gearTier(b) - gearTier(a) || b.level - a.level || a.uid.localeCompare(b.uid));
}

export { ITEM_RARITY_ORDER as GEAR_RARITY_ORDER };

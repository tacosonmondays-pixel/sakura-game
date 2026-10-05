// Gear: rolling, equipping, rerolls, enhancement and salvage (owner: systems). See CONTRACTS.md §5.
//
// GearInstance = { uid, slot, rarity, level 0-10, main: { stat, value, base }, subs: [{ stat, value, base, upgrades }],
//                  locked, equippedBy, name }
// `base` is the value at +0 (the main stat grows with level; subs grow by `upgrades`).

import { GEAR_SLOTS, GEAR_STATS, GEAR_MAIN_STATS, GEAR_SUBSTATS_BY_RARITY, ITEM_RARITIES, ITEM_RARITY_ORDER } from '../data/types.js';
import { getItem } from '../data/items.js';
import { consumeItems, addItems, missingItems, itemCount } from './inventory.js';
import { track } from './missions.js';

export const MAX_GEAR_LEVEL = 10;
/** Stat multiplier per gear rarity. */
export const GEAR_RARITY_SCALE = { common: 1, rare: 1.35, superRare: 1.75, mythic: 2.2, legendary: 2.8 };
/** Main stats roll 1.2× a substat's range. */
const MAIN_MUL = 1.2;
/** Main stat growth per enhancement level (fraction of its +0 value). */
const MAIN_GROWTH = { default: 0.06, armorPen: 0.04 };
/** Each sub upgrade adds this fraction of the stat's mid roll (scaled by rarity). */
const SUB_GROWTH = 0.5;
/** A substat grows on every Nth enhancement level. */
const SUB_GROWTH_EVERY = 3;

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
  armorPen: ['Piercing', 'Steelbreak'],
  costCut: ['Thrifty', 'Bargain'],
  ultHaste: ['Eager', 'Dawnspark'],
};
const RARITY_SUFFIX = { mythic: 'of the Crimson Moon', legendary: 'of the Eternal Sakura' };

const rarityOrder = (r) => ITEM_RARITIES[r]?.order ?? 0;
const roundStat = (stat, v) => (GEAR_STATS[stat].pct ? Math.round(v * 10000) / 10000 : Math.round(v * 10) / 10);
const statScale = (stat, rarity) => {
  const s = GEAR_RARITY_SCALE[rarity] ?? 1;
  return stat === 'armorPen' ? 1 + (s - 1) * 0.5 : s;
};

/** Range [min, max] a substat (+0) can roll at a rarity. */
export function substatRange(stat, rarity) {
  const [a, b] = GEAR_STATS[stat].base;
  const s = statScale(stat, rarity);
  return [roundStat(stat, a * s), roundStat(stat, b * s)];
}

/** Range [min, max] a main stat (+0) can roll at a rarity. */
export function mainStatRange(stat, rarity) {
  const [a, b] = GEAR_STATS[stat].base;
  const s = statScale(stat, rarity) * MAIN_MUL;
  return [roundStat(stat, a * s), roundStat(stat, b * s)];
}

function rollSub(rng, stat, rarity) {
  const [a, b] = GEAR_STATS[stat].base;
  const base = roundStat(stat, rng.range(a, b) * statScale(stat, rarity));
  return { stat, value: base, base, upgrades: 0 };
}

function subGrowth(stat, rarity) {
  const [a, b] = GEAR_STATS[stat].base;
  return ((a + b) / 2) * statScale(stat, rarity) * SUB_GROWTH;
}

function applySubUpgrades(sub, rarity) {
  sub.value = roundStat(sub.stat, sub.base + sub.upgrades * subGrowth(sub.stat, rarity));
  return sub;
}

function rollMain(rng, stat, rarity) {
  const [a, b] = GEAR_STATS[stat].base;
  const base = roundStat(stat, rng.range(a, b) * statScale(stat, rarity) * MAIN_MUL);
  return { stat, value: base, base };
}

function applyMainLevel(main, level) {
  const growth = MAIN_GROWTH[main.stat] ?? MAIN_GROWTH.default;
  main.value = roundStat(main.stat, main.base * (1 + growth * level));
  return main;
}

/** Pick `count` distinct substat keys not in `exclude`. */
function pickSubStats(rng, count, exclude) {
  const pool = Object.keys(GEAR_STATS).filter((s) => !exclude.has(s));
  const out = [];
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
  return out;
}

/** Distribute `n` sub upgrades randomly over the given subs. */
function distributeUpgrades(rng, subs, n) {
  if (!subs.length) return;
  for (let i = 0; i < n; i++) subs[Math.floor(rng.next() * subs.length)].upgrades += 1;
}

/** Display name from main stat + slot (+ rarity suffix). */
export function gearName(rng, slot, rarity, mainStat) {
  const prefix = rng.pick(STAT_PREFIX[mainStat] || ['Fine']);
  const noun = rng.pick(SLOT_NOUNS[slot] || [GEAR_SLOTS[slot]?.name || 'Gear']);
  return RARITY_SUFFIX[rarity] ? `${prefix} ${noun} ${RARITY_SUFFIX[rarity]}` : `${prefix} ${noun}`;
}

/**
 * Roll a new piece of gear (not yet in the profile; uid is null until addGear).
 * @param {object} rng createRng() instance
 * @param {{ slot?: string, rarity?: string, level?: number }} opts slot defaults to random
 * @returns {object} GearInstance
 */
export function rollGear(rng, { slot = null, rarity = 'common', level = 0 } = {}) {
  const s = slot && GEAR_SLOTS[slot] ? slot : rng.pick(Object.keys(GEAR_SLOTS));
  const r = ITEM_RARITIES[rarity] ? rarity : 'common';
  const mainStat = rng.pick(GEAR_MAIN_STATS[s]);
  const main = rollMain(rng, mainStat, r);
  const subStats = pickSubStats(rng, GEAR_SUBSTATS_BY_RARITY[r] || 0, new Set([mainStat]));
  const subs = subStats.map((st) => rollSub(rng, st, r));
  const lvl = Math.max(0, Math.min(MAX_GEAR_LEVEL, Math.floor(level)));
  distributeUpgrades(rng, subs, Math.floor(lvl / SUB_GROWTH_EVERY));
  subs.forEach((sub) => applySubUpgrades(sub, r));
  applyMainLevel(main, lvl);
  return { uid: null, slot: s, rarity: r, level: lvl, main, subs, locked: false, equippedBy: null, name: gearName(rng, s, r, mainStat) };
}

/**
 * Store gear in the profile (assigns a uid when missing).
 * @returns {string} uid
 */
export function addGear(profile, gear) {
  profile.seq ||= { gear: 0 };
  let uid = gear.uid;
  if (!uid || profile.gear[uid]) {
    do uid = `g${++profile.seq.gear}`; while (profile.gear[uid]);
  }
  profile.gear[uid] = { ...gear, uid, equippedBy: null };
  return uid;
}

/**
 * Open gear boxes from the backpack into real gear.
 * @returns {{ ok: boolean, error?: string, gear: object[] }}
 */
export function openGearBox(profile, itemId, rng, count = 1) {
  const item = getItem(itemId);
  if (!item || item.category !== 'gearbox') return { ok: false, error: 'notGearBox', gear: [] };
  const n = Math.max(1, Math.floor(count));
  if (!consumeItems(profile, [{ id: itemId, count: n }])) return { ok: false, error: 'missing', gear: [] };
  const gear = [];
  for (let i = 0; i < n; i++) {
    const g = rollGear(rng, { rarity: item.rarity });
    g.uid = addGear(profile, g);
    gear.push(profile.gear[g.uid]);
  }
  return { ok: true, gear };
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

/**
 * Cost of a substat reroll: Fortune Dice (+1 Lock Pin when a substat is locked) + coins.
 * @returns {{id:string,count:number}[]}
 */
export function rerollCost(gear, { lockIndex = null } = {}) {
  const o = rarityOrder(gear.rarity);
  const cost = [{ id: 'dice_reroll', count: o >= 4 ? 3 : o >= 3 ? 2 : 1 }, { id: 'coins', count: 2000 * (o + 1) }];
  if (lockIndex != null) cost.push({ id: 'lock_pin', count: 1 });
  return cost;
}

/** Cost of a main-stat reroll: one Prism Dice + coins. */
export function mainRerollCost(gear) {
  return [{ id: 'dice_prism', count: 1 }, { id: 'coins', count: 5000 * (rarityOrder(gear.rarity) + 1) }];
}

const cloneGear = (g) => JSON.parse(JSON.stringify(g));

/**
 * Reroll every substat (optionally keeping one locked). Enhancement upgrades already earned
 * are kept: the locked sub keeps its own, the rest are redistributed over the new subs.
 * @returns {{ ok: boolean, error?: string, before?: object, after?: object, cost?: object[] }}
 */
export function rerollSubstats(profile, uid, rng, { lockIndex = null } = {}) {
  const gear = profile.gear[uid];
  if (!gear) return { ok: false, error: 'noGear' };
  if (!gear.subs.length) return { ok: false, error: 'noSubstats' };
  if (lockIndex != null && (!Number.isInteger(lockIndex) || lockIndex < 0 || lockIndex >= gear.subs.length)) return { ok: false, error: 'badLock' };
  if (lockIndex != null && gear.subs.length < 2) return { ok: false, error: 'badLock' };
  const cost = rerollCost(gear, { lockIndex });
  if (!consumeItems(profile, cost)) return { ok: false, error: 'missing', missing: missingItems(profile, cost) };
  const before = cloneGear(gear);
  const locked = lockIndex != null ? gear.subs[lockIndex] : null;
  const exclude = new Set([gear.main.stat]);
  if (locked) exclude.add(locked.stat);
  const fresh = pickSubStats(rng, gear.subs.length - (locked ? 1 : 0), exclude).map((st) => rollSub(rng, st, gear.rarity));
  const totalUpgrades = Math.floor(gear.level / SUB_GROWTH_EVERY);
  distributeUpgrades(rng, fresh, Math.max(0, totalUpgrades - (locked ? locked.upgrades || 0 : 0)));
  fresh.forEach((s) => applySubUpgrades(s, gear.rarity));
  const subs = [];
  let k = 0;
  for (let i = 0; i < gear.subs.length; i++) subs.push(i === lockIndex ? gear.subs[i] : fresh[k++]);
  gear.subs = subs;
  track(profile, 'gearReroll', 1);
  track(profile, 'spendCoins', cost.find((c) => c.id === 'coins').count);
  return { ok: true, before, after: cloneGear(gear), cost };
}

/**
 * Reroll the main stat into a different stat allowed for the slot. A substat that collides
 * with the new main stat is rerolled into a free stat.
 * @returns {{ ok: boolean, error?: string, before?: object, after?: object }}
 */
export function rerollMainStat(profile, uid, rng) {
  const gear = profile.gear[uid];
  if (!gear) return { ok: false, error: 'noGear' };
  const options = GEAR_MAIN_STATS[gear.slot].filter((s) => s !== gear.main.stat);
  if (!options.length) return { ok: false, error: 'noOptions' };
  const cost = mainRerollCost(gear);
  if (!consumeItems(profile, cost)) return { ok: false, error: 'missing', missing: missingItems(profile, cost) };
  const before = cloneGear(gear);
  const stat = rng.pick(options);
  gear.main = applyMainLevel(rollMain(rng, stat, gear.rarity), gear.level);
  const clash = gear.subs.findIndex((s) => s.stat === stat);
  if (clash >= 0) {
    const used = new Set([stat, ...gear.subs.map((s) => s.stat)]);
    const [replacement] = pickSubStats(rng, 1, used);
    const sub = rollSub(rng, replacement, gear.rarity);
    sub.upgrades = gear.subs[clash].upgrades || 0;
    gear.subs[clash] = applySubUpgrades(sub, gear.rarity);
  }
  gear.name = gearName(rng, gear.slot, gear.rarity, stat);
  track(profile, 'gearReroll', 1);
  track(profile, 'spendCoins', cost.find((c) => c.id === 'coins').count);
  return { ok: true, before, after: cloneGear(gear), cost };
}

/** Coins for the next enhancement level (null at max). */
export function enhanceCost(gear) {
  if (gear.level >= MAX_GEAR_LEVEL) return null;
  return (800 + 400 * gear.level) * (rarityOrder(gear.rarity) + 1);
}

/** Total coins spent enhancing a piece to its current level. */
export function enhanceInvested(gear) {
  let total = 0;
  for (let l = 0; l < gear.level; l++) total += (800 + 400 * l) * (rarityOrder(gear.rarity) + 1);
  return total;
}

/**
 * +1 level (max 10). The main stat grows every level; every 3rd level the least-upgraded
 * substat grows (deterministic, ties → first).
 * @returns {{ ok: boolean, error?: string, level?: number, grewSub?: number|null, cost?: number }}
 */
export function enhanceGear(profile, uid) {
  const gear = profile.gear[uid];
  if (!gear) return { ok: false, error: 'noGear' };
  const cost = enhanceCost(gear);
  if (cost == null) return { ok: false, error: 'max' };
  if (!consumeItems(profile, [{ id: 'coins', count: cost }])) return { ok: false, error: 'missing', missing: [{ id: 'coins', need: cost, have: itemCount(profile, 'coins') }] };
  gear.level += 1;
  applyMainLevel(gear.main, gear.level);
  let grewSub = null;
  if (gear.level % SUB_GROWTH_EVERY === 0 && gear.subs.length) {
    let best = 0;
    gear.subs.forEach((s, i) => { if ((s.upgrades || 0) < (gear.subs[best].upgrades || 0)) best = i; });
    const sub = gear.subs[best];
    sub.upgrades = (sub.upgrades || 0) + 1;
    if (sub.base == null) sub.base = sub.value;
    applySubUpgrades(sub, gear.rarity);
    grewSub = best;
  }
  track(profile, 'spendCoins', cost);
  return { ok: true, level: gear.level, grewSub, cost };
}

/** Rewards salvaging would give (preview). */
export function salvageRewards(gear) {
  const o = rarityOrder(gear.rarity);
  const rewards = [{ id: 'coins', count: 300 * (o + 1) * (o + 1) + Math.floor(enhanceInvested(gear) * 0.5) }];
  const dice = [0, 0, 1, 2, 3][o];
  if (dice) rewards.push({ id: 'dice_reroll', count: dice });
  if (gear.rarity === 'legendary') rewards.push({ id: 'lock_pin', count: 1 });
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
  addItems(profile, rewards);
  return { ok: true, rewards };
}

/**
 * Sum of every stat on the gear a unit wears.
 * @returns {{ atkPct, ratePct, rangePct, critChance, critDmg, armorPen, costCut, ultHaste }}
 */
export function gearStatTotals(profile, unitId) {
  const totals = Object.fromEntries(Object.keys(GEAR_STATS).map((k) => [k, 0]));
  const unit = profile.units?.[unitId];
  if (!unit) return totals;
  for (const slot of Object.keys(GEAR_SLOTS)) {
    const g = unit.gear?.[slot] && profile.gear[unit.gear[slot]];
    if (!g) continue;
    for (const s of [g.main, ...g.subs]) if (s && totals[s.stat] != null) totals[s.stat] += s.value;
  }
  for (const k of Object.keys(totals)) totals[k] = roundStat(k, totals[k]);
  return totals;
}

/**
 * '+5.2% ATK' / '+2 Armor Pierce'
 * @returns {string}
 */
export function describeStat(stat, value) {
  const def = GEAR_STATS[stat];
  if (!def) return `+${value} ${stat}`;
  if (def.pct) {
    const v = Math.round(value * 1000) / 10;
    return `+${v}% ${def.name}`;
  }
  return `+${Math.round(value * 10) / 10} ${def.name}`;
}

/** Gear of the profile, best first (rarity, level), optionally filtered by slot. */
export function gearList(profile, { slot = null } = {}) {
  return Object.values(profile.gear)
    .filter((g) => !slot || g.slot === slot)
    .sort((a, b) => rarityOrder(b.rarity) - rarityOrder(a.rarity) || b.level - a.level || a.uid.localeCompare(b.uid));
}

export { ITEM_RARITY_ORDER as GEAR_RARITY_ORDER };

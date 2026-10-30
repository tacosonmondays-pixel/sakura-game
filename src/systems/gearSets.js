// Gear sets outside battle (docs/specs/GEAR_UPDATE.md §3, §5, §6): set pieces, Set Boxes, the Tie Pin and the Collar
// Pin, the set sources' post-roll and the one-time boxes (owner: systems). Not co-op hashed: the battle reads a girl's
// set through unitBattleStats (`set`, `setN`) and src/sim/setRules.js.

import { SLOT_IDS, MAIN_STATS_BY_SLOT } from '../data/gearSlots.js';
import { SET_IDS, SET_RARITIES, GEAR_SETS } from '../data/gearSets.js';
import { fillStats } from '../data/gearStats.js';
import { TIE_PIN_ID, COLLAR_PIN_ID, TIE_PIN_COINS, COLLAR_PIN_COINS, MARK, setBoxId } from '../data/gearAwaken.js';
import { getItem } from '../data/items.js';
import { gameDayNumber } from '../core/reset.js';
import {
  rollGear, addGear, gearRoom, pieceName, recomputeGear, topMainBase, topSubBase, isLrGear, cloneGearOf,
} from './gear.js';
import { consumeItems, missingItems, addItems } from './inventory.js';
import { track } from './missions.js';
import { potentialLevel } from './potential.js';

const counters = (p) => ((p.missions ||= {}).counters ||= {});
const whole = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

// ---------------------------------------------------------------------------
// Set pieces
// ---------------------------------------------------------------------------

/** The set each titan's chests drop (§3.6). */
export const TITAN_SETS = Object.freeze({ daimyo: 'spirit', regent: 'freezetag', wyrm: 'geometry', foundry: 'popper' });

/**
 * Roll one set piece (not yet in the profile): its slot (one of the five at random when none), the set's fixed name.
 * Set pieces exist at Super Rare and up; a lower rarity rolls a No-set classic piece instead (Normal's Rare box).
 * @returns {object} GearInstance
 */
export function rollSetPiece(rng, setId, { slot = null, rarity = 'superRare', level = 0, main = null } = {}) {
  if (!SET_IDS.includes(setId) || !SET_RARITIES.includes(rarity)) return rollGear(rng, { slot: slot && SLOT_IDS.indexOf(slot) < 3 ? slot : null, rarity, level });
  const s = slot && SLOT_IDS.includes(slot) ? slot : rng.pick(SLOT_IDS);
  const g = rollGear(rng, { slot: s, rarity, level, main });
  g.set = setId;
  g.name = pieceName(g);
  return g;
}

/** Store a fresh set piece (a Mythic+ one joins a random club, as every drop). @returns {object} the stored piece */
export function addSetPiece(profile, g) {
  const uid = addGear(profile, g, { club: 'random' });
  return profile.gear[uid];
}

// ---------------------------------------------------------------------------
// Set Boxes (§5)
// ---------------------------------------------------------------------------

/** @returns {boolean} a Set Box item */
export const isSetBox = (itemId) => !!getItem(itemId)?.pickSet;
/** The sets a box offers: its own, or all six for a choose-box. */
export const setBoxSets = (itemId) => (getItem(itemId)?.set ? [getItem(itemId).set] : getItem(itemId)?.pickSet ? [...SET_IDS] : []);

/**
 * "Fill for a girl": a main stat per slot from what her kit uses (stats that do not fill in for her), in a fixed order
 * of preference per slot.
 * @returns {Object<string, string>} slot → main stat
 */
export function fillMainsFor(profile, unitId) {
  const u = profile?.units?.[unitId];
  const dead = fillStats(unitId, { awaken: u?.awaken || 0, potential: u ? potentialLevel(u) : 1 });
  const PREF = {
    charm: ['critDmg', 'atkPct'], ribbon: ['critChance', 'rangePct', 'armorPen'], shoes: ['ratePct', 'ultHaste', 'costCut'],
    hair: ['auraPct', 'critChance', 'atkPct', 'auraRangePct'], necklace: ['critDmg', 'ratePct', 'controlPct', 'buffDurPct'],
  };
  const aura = !dead.has('auraPct');
  const out = {};
  for (const s of SLOT_IDS) {
    const order = s === 'hair' && !aura ? ['critChance', 'atkPct', 'auraPct', 'auraRangePct'] : PREF[s];
    out[s] = order.find((k) => !dead.has(k) && MAIN_STATS_BY_SLOT[s].includes(k)) || MAIN_STATS_BY_SLOT[s][0];
  }
  return out;
}

/**
 * Open a Set Box: all five pieces of one set at the box's rarity, +0, the main stats chosen (one per slot; a missing
 * or wrong one: the slot's first), substats rolled; each Mythic+ piece joins a random club. Needs 5 free places.
 * @param {{ set?: string, mains?: Object<string, string> }} pick the set (a choose-box) and the mains
 * @returns {{ ok: boolean, error?: 'notSetBox'|'set'|'bagFull'|'missing', gear: object[] }}
 */
export function openSetBox(profile, itemId, rng, { set = null, mains = {} } = {}) {
  const item = getItem(itemId);
  if (!item?.pickSet) return { ok: false, error: 'notSetBox', gear: [] };
  const setId = item.set || set;
  if (!setBoxSets(itemId).includes(setId)) return { ok: false, error: 'set', gear: [] };
  if (gearRoom(profile) < SLOT_IDS.length) return { ok: false, error: 'bagFull', gear: [] };
  if (!consumeItems(profile, [{ id: itemId, count: 1 }])) return { ok: false, error: 'missing', gear: [] };
  const gear = SLOT_IDS.map((slot) => {
    const main = MAIN_STATS_BY_SLOT[slot].includes(mains?.[slot]) ? mains[slot] : MAIN_STATS_BY_SLOT[slot][0];
    return addSetPiece(profile, rollSetPiece(rng, setId, { slot, rarity: item.rarity, main }));
  });
  track(profile, 'setBox', 1);
  return { ok: true, gear };
}

// ---------------------------------------------------------------------------
// Pins (§6): the Tie Pin (the main stat's best roll) and the Collar Pin (one substat's)
// ---------------------------------------------------------------------------

/** Pins work on gold, UR and LR pieces. */
const pinnable = (g) => !!g && g.rarity === 'legendary';
/** Collar Pins a piece takes: 1, LR 2 (on different lines). */
export const collarPinsMax = (g) => (isLrGear(g) ? 2 : 1);

/** @returns {{ id: string, count: number }[]} 1 Tie Pin + 20,000 coins */
export const tiePinCost = () => [{ id: TIE_PIN_ID, count: 1 }, { id: 'coins', count: TIE_PIN_COINS }];
/** @returns {{ id: string, count: number }[]} 1 Collar Pin + 10,000 coins */
export const collarPinCost = () => [{ id: COLLAR_PIN_ID, count: 1 }, { id: 'coins', count: COLLAR_PIN_COINS }];

/** @returns {{ ok: boolean, reason?: string, missing?: object[], cost?: object[] }} */
export function canTopMainRoll(profile, uid) {
  const g = profile.gear?.[uid];
  if (!g) return { ok: false, reason: 'noGear' };
  if (!pinnable(g)) return { ok: false, reason: 'rarity' };
  if (g.main.top) return { ok: false, reason: 'already' };
  const cost = tiePinCost();
  const missing = missingItems(profile, cost);
  return missing.length ? { ok: false, reason: 'missing', missing, cost } : { ok: true, cost };
}

/** @returns {{ ok: boolean, reason?: string, missing?: object[], cost?: object[] }} */
export function canTopSubRoll(profile, uid, index) {
  const g = profile.gear?.[uid];
  if (!g) return { ok: false, reason: 'noGear' };
  if (!pinnable(g)) return { ok: false, reason: 'rarity' };
  if (!Number.isInteger(index) || !g.subs?.[index]) return { ok: false, reason: 'badLine' };
  if (g.subs[index].top) return { ok: false, reason: 'already' };
  if (g.subs.filter((s) => s.top).length >= collarPinsMax(g)) return { ok: false, reason: 'full' };
  const cost = collarPinCost();
  const missing = missingItems(profile, cost);
  return missing.length ? { ok: false, reason: 'missing', missing, cost } : { ok: true, cost };
}

/** Tie Pin: the main stat becomes its best roll for its rarity; it keeps growing with the level. No undo. */
export function topMainRoll(profile, uid) {
  const check = canTopMainRoll(profile, uid);
  if (!check.ok) return { ok: false, error: check.reason, missing: check.missing };
  if (!consumeItems(profile, check.cost)) return { ok: false, error: 'missing' };
  const g = profile.gear[uid];
  const before = cloneGearOf(g);
  g.main.base = topMainBase(g);
  g.main.top = 1;
  recomputeGear(g);
  track(profile, 'spendCoins', TIE_PIN_COINS);
  return { ok: true, before, after: cloneGearOf(g) };
}

/** Collar Pin: one substat becomes its best roll; its ▲ and ✦ stay on top. No undo. */
export function topSubRoll(profile, uid, index) {
  const check = canTopSubRoll(profile, uid, index);
  if (!check.ok) return { ok: false, error: check.reason, missing: check.missing };
  if (!consumeItems(profile, check.cost)) return { ok: false, error: 'missing' };
  const g = profile.gear[uid];
  const before = cloneGearOf(g);
  const sub = g.subs[index];
  sub.base = topSubBase(g, sub.stat);
  sub.top = 1;
  recomputeGear(g);
  track(profile, 'spendCoins', COLLAR_PIN_COINS);
  return { ok: true, before, after: cloneGearOf(g) };
}

// ---------------------------------------------------------------------------
// Sources (§3.6): Market Canal (Treasurer) and Total Assault (Power Bank), after the stage's own drops
// ---------------------------------------------------------------------------

/** Set pieces a game day from the Bounty and Total Assault post-roll together. */
export const SET_DAY_CAP = 3;
const SET_DAY = 'cap:setDay';

/**
 * The post-roll of one win or sweep (outside the stage drop tables, which are co-op hashed): Market Canal II (25 %:
 * Super Rare or Mythic) and III (35 %: Mythic, Legendary 25 % on Nightmare / 10 % on Hard) pay a Treasurer piece, Total Assault on Hard and up (35 %) a Power Bank piece, under the daily
 * cap. Draws from its own forked rng, so the stage's drops never shift. @returns {object|null} the piece paid
 */
export function setPostRoll(profile, stage, difficulty, rng, now = Date.now()) {
  let setId = null;
  let chance = 0;
  let table = null;
  if (stage?.id === 'res-coins-2') {
    setId = 'treasurer';
    chance = 0.25;
    table = [['mythic', 0.4], ['superRare', 0.6]];
  } else if (stage?.id === 'res-coins-3') {
    setId = 'treasurer';
    chance = 0.35;
    const leg = difficulty === 'nightmare' ? 0.25 : difficulty === 'hard' ? 0.1 : 0;
    table = [['legendary', leg], ['mythic', 1 - leg]];
  } else if (stage?.kind === 'boss' && (difficulty === 'hard' || difficulty === 'nightmare')) {
    setId = 'powerbank';
    chance = 0.35;
    table = difficulty === 'nightmare' ? [['legendary', 0.3], ['mythic', 0.7]] : [['legendary', 0.15], ['mythic', 0.85]];
  }
  if (!setId) return null;
  const c = counters(profile);
  const day = gameDayNumber(now);
  if (whole(c[`${SET_DAY}:at`]) !== day) {
    c[`${SET_DAY}:at`] = day;
    c[SET_DAY] = 0;
  }
  if (whole(c[SET_DAY]) >= SET_DAY_CAP) return null;
  const r = rng.fork ? rng.fork('setPost') : rng;
  if (!(r.next() < chance)) return null;
  let x = r.next();
  let rarity = table[table.length - 1][0];
  for (const [k, p] of table) {
    if (x < p) { rarity = k; break; }
    x -= p;
  }
  c[SET_DAY] = whole(c[SET_DAY]) + 1;
  return addSetPiece(profile, rollSetPiece(r, setId, { rarity }));
}

// ---------------------------------------------------------------------------
// One-time boxes (§5.2, §5.3)
// ---------------------------------------------------------------------------

const WELCOME = 'su:welcome';

/**
 * The welcome Mythic Set Box once Titan Trials open (3-5 cleared), and on the sets update's first load the veterans'
 * boxes (once, `su:vet`): a Legendary Set Box of each titan's set whose Nightmare first clear is already paid
 * (`tfc:<titan>:2`). A new player gets that box from the first clear itself. `add: false` leaves paying to the caller
 * (a battle result adds it with its rewards). @returns {{ id, count }[]} what was paid
 */
export function grantSetBoxGifts(profile, { add = true } = {}) {
  const c = counters(profile);
  const paid = [];
  const cleared35 = stageCleared(profile, '3-5');
  if (!c[MARK.veteran]) {
    c[MARK.veteran] = 1;
    for (const [titan, set] of Object.entries(TITAN_SETS)) if (whole(c[`tfc:${titan}:2`])) paid.push({ id: setBoxId(set, 'legendary'), count: 1 });
  }
  if (!c[WELCOME] && cleared35) {
    c[WELCOME] = 1;
    paid.push({ id: setBoxId('pick', 'mythic'), count: 1 });
  }
  if (add && paid.length) addItems(profile, paid);
  return paid;
}

function stageCleared(profile, stageId) {
  const e = profile?.progress?.stages?.[stageId];
  return !!e && ['easy', 'normal', 'hard', 'nightmare'].some((d) => e[d]);
}

/** The name of a set for menus. */
export const setName = (id) => GEAR_SETS[id]?.name || id;
/** @returns {boolean} a piece a pin can take (gold, UR or LR) */
export const isPinnable = pinnable;

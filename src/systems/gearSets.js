// Gear sets outside battle (docs/specs/GEAR_UPDATE.md §3, §5, §6): set pieces, Set Boxes, the Tie Pin and the Collar
// Pin, the set sources' post-roll and the one-time boxes (owner: systems). Not co-op hashed: the battle reads a girl's
// set through unitBattleStats (`set`, `setN`) and src/sim/setRules.js.

import { SLOT_IDS, MAIN_STATS_BY_SLOT } from '../data/gearSlots.js';
import { SET_IDS, SET_RARITIES, GEAR_SETS, TITAN_SETS } from '../data/gearSets.js';
import { fillStats, CONTROL_REAL, skillHasteCounts } from '../data/gearStats.js';
import { UNIT_MAP } from '../data/units.js';
import { SET_ATTACK_BEHAVIORS } from '../sim/setRules.js';
import {
  TIE_PIN_ID, COLLAR_PIN_ID, TIE_PIN_COINS, COLLAR_PIN_COINS, MARK, setBoxId, setBoxInfo, SET_BOX_V2_IDS, SET_OPEN_BATCH_MAX, SETBOX_GIFT_PREFIX,
} from '../data/gearAwaken.js';
import { getItem } from '../data/items.js';
import { gameDayNumber } from '../core/reset.js';
import {
  rollGear, addGear, gearRoom, pieceName, recomputeGear, topMainBase, topSubBase, isLrGear, cloneGearOf, addBoxUr,
} from './gear.js';
import { consumeItems, missingItems, addItems, itemCount, itemSources } from './inventory.js';
import { deliverMail } from './mail.js';
import { titansUnlocked } from './titans.js';
import { track } from './missions.js';
import { potentialLevel } from './potential.js';

const counters = (p) => ((p.missions ||= {}).counters ||= {});
const whole = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

// ---------------------------------------------------------------------------
// Set pieces
// ---------------------------------------------------------------------------

export { TITAN_SETS };

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

/** @returns {'random'|'preset'|null} a Set Box's kind (SET_BOXES_V2.md D1) */
export const setBoxKind = (itemId) => (getItem(itemId)?.pickSet ? getItem(itemId).setKind || 'preset' : null);
/** @returns {'mythic'|'legendary'|'ur'|null} a Set Box's rarity (UR: its pieces are box-born rainbow UR) */
export const setBoxRarity = (itemId) => (getItem(itemId)?.pickSet ? getItem(itemId).setRarity || getItem(itemId).rarity : null);
export { SET_OPEN_BATCH_MAX };

/**
 * How many of `itemId` one tap can open now: held, at most SET_OPEN_BATCH_MAX, and 5 free places each.
 * @returns {number}
 */
export function setBoxOpenable(profile, itemId, count = SET_OPEN_BATCH_MAX) {
  return Math.max(0, Math.min(Math.floor(count), itemCount(profile, itemId), SET_OPEN_BATCH_MAX, Math.floor(gearRoom(profile) / SLOT_IDS.length)));
}

/**
 * Open Set Boxes (GEAR_UPDATE.md §5; Set Boxes v2, SET_BOXES_V2.md §4): each box gives all five pieces of ONE set
 * (its own; a choose-box: `set`, the same for the whole batch) at the box's rarity, +0, substats rolled, each Mythic+
 * piece in a random club. The preset kind takes the chosen `mains` for every box (a missing or wrong one: the slot's
 * first); the random kind rolls them, as a regular gear box. A UR box's pieces are box-born rainbow UR (addBoxUr, as
 * the Rainbow Gear Box). Opens `count` boxes, at most SET_OPEN_BATCH_MAX, as many as the bag has 5 free places for
 * (the rest stay in the Backpack).
 * @param {{ set?: string, mains?: Object<string, string>, count?: number }} pick
 * @returns {{ ok: boolean, error?: 'notSetBox'|'set'|'bagFull'|'missing', gear: object[], opened?: number, wanted?: number, set?: string }}
 */
export function openSetBox(profile, itemId, rng, { set = null, mains = {}, count = 1 } = {}) {
  const item = getItem(itemId);
  if (!item?.pickSet) return { ok: false, error: 'notSetBox', gear: [] };
  const setId = item.set || set;
  if (!setBoxSets(itemId).includes(setId)) return { ok: false, error: 'set', gear: [] };
  const wanted = Math.max(1, Math.floor(Number(count) || 1));
  if (gearRoom(profile) < SLOT_IDS.length) return { ok: false, error: 'bagFull', gear: [], opened: 0, wanted };
  const n = setBoxOpenable(profile, itemId, wanted);
  if (n <= 0 || !consumeItems(profile, [{ id: itemId, count: n }])) return { ok: false, error: 'missing', gear: [], opened: 0, wanted };
  const preset = setBoxKind(itemId) === 'preset';
  const ur = setBoxRarity(itemId) === 'ur';
  const rarity = ur ? 'legendary' : item.rarity;
  const gear = [];
  for (let i = 0; i < n; i++) {
    for (const slot of SLOT_IDS) {
      const main = !preset ? null : MAIN_STATS_BY_SLOT[slot].includes(mains?.[slot]) ? mains[slot] : MAIN_STATS_BY_SLOT[slot][0];
      const g = rollSetPiece(rng, setId, { slot, rarity, main });
      gear.push(ur ? addBoxUr(profile, g, { club: 'random' }) : addSetPiece(profile, g));
    }
  }
  track(profile, 'setBox', n);
  return { ok: true, gear, opened: n, wanted, set: setId };
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
// One-time boxes (§5.2, §5.3): one rule and one mark per box
// ---------------------------------------------------------------------------

/** The one-time Set Box letter's id: this prefix, then its boxes' item ids joined by '+'. */
export { SETBOX_GIFT_PREFIX };

/**
 * The mark that says box `id` was sent (its one-time rule), or null for an id that is no one-time Set Box. Both kinds
 * share one mark (Set Boxes v2 D3): the live preset ids an older build's letter names, and the random ids this build
 * pays, so nobody is paid twice.
 */
function boxMark(id) {
  const info = setBoxInfo(id);
  if (!info || info.rarity === 'ur') return null;
  if (info.set === 'pick') return info.rarity === 'mythic' ? MARK.welcomeBox : null;
  if (info.rarity !== 'legendary') return null;
  for (const [titan, set] of Object.entries(TITAN_SETS)) if (info.set === set) return MARK.titanBox + titan;
  return null;
}

/**
 * An older build (before the gear update: an open tab, a cached copy; or v0.1.66 for Set Boxes v2's ids) cleans the
 * Set Box ids it does not know out of a letter's rewards when it loads and saves (its cleanMail), and the su: marks
 * stop a resend, so the boxes were lost (v0.1.66 audit C H1). The letter's id names its boxes: an emptied letter gets
 * them back when every one is a one-time box whose mark is set (sent by this letter and not paid any other way: the
 * marks are only set where a box is paid, and a 'mail' payment pays only through the letter). An unclaimed one pays
 * them on its claim; a claimed one shows them only (claimMail refuses a claimed letter; audit C L1) — unless it names
 * a v2 box and has no `su:paid:` mark: then an older build claimed it while it was empty and paid nothing, so its boxes
 * are paid now, once (Set Boxes v2 §6). Mirrors repairVigilLetter.
 */
function repairSetBoxLetters(profile, c) {
  const letters = Array.isArray(profile.mail?.letters) ? profile.mail.letters : [];
  for (const l of letters) {
    if (typeof l?.id !== 'string' || !l.id.startsWith(SETBOX_GIFT_PREFIX)) continue;
    if (Array.isArray(l.rewards) && l.rewards.some((r) => r?.count > 0)) continue;
    const ids = l.id.slice(SETBOX_GIFT_PREFIX.length).split('+');
    if (!ids.length || !ids.every((id) => getItem(id) && boxMark(id) && c[boxMark(id)])) continue;
    l.rewards = ids.map((id) => ({ id, count: 1 }));
    if (l.claimed && ids.some((id) => SET_BOX_V2_IDS.includes(id)) && !c[MARK.giftPaid + l.id]) {
      c[MARK.giftPaid + l.id] = 1;
      addItems(profile, l.rewards);
    }
  }
}

/**
 * The one-time Set Boxes (GEAR_UPDATE.md §5.3, r3; Set Boxes v2 D3: the random kind): whenever Titan Trials are open
 * and `su:welcome` is not set, the welcome Mythic Set Box (choose the set); whenever a titan's Nightmare first clear is
 * paid (`tfc:<titan>:2`) and `su:titanbox:<titan>` is not set, that titan's Legendary Set Box. The same check serves
 * veterans (on the sets update's first load) and new players (after the clear), in any order, so a first clear made in
 * an older tab still pays later. A save an older build already paid (its preset box, its mark) gets nothing new.
 * @param {{ mode?: 'list'|'mail'|'items' }} [o] 'list': the caller pays the returned boxes (a battle's rewards);
 *   'mail': one letter carries them (the notice line, migrateProfile); 'items': straight into the Backpack
 * @returns {{ id: string, count: number }[]} what is owed now (marks set)
 */
export function grantSetBoxGifts(profile, { mode = 'items', now = Date.now() } = {}) {
  const c = counters(profile);
  repairSetBoxLetters(profile, c);
  const paid = [];
  if (!c[MARK.welcomeBox] && titansUnlocked(profile)) {
    c[MARK.welcomeBox] = 1;
    paid.push({ id: setBoxId('pick', 'mythic', 'random'), count: 1 });
  }
  for (const [titan, set] of Object.entries(TITAN_SETS)) {
    if (!whole(c[`tfc:${titan}:2`]) || c[MARK.titanBox + titan]) continue;
    c[MARK.titanBox + titan] = 1;
    paid.push({ id: setBoxId(set, 'legendary', 'random'), count: 1 });
  }
  if (!paid.length || mode === 'list') return paid;
  if (mode === 'mail') {
    deliverMail(profile, {
      id: `${SETBOX_GIFT_PREFIX}${paid.map((x) => x.id).join('+')}`,
      title: 'Set Boxes for you',
      body: 'Gear sets are here! A thank-you for the Titan Trials you have already opened and cleared: open them from the Backpack once you claim them.',
      rewards: paid,
    }, now);
  } else addItems(profile, paid);
  return paid;
}

// ---------------------------------------------------------------------------
// The dead-passive rule (§3.1): never promise what is not there
// ---------------------------------------------------------------------------

/**
 * Why her set's passive (4 / 5 pieces) does nothing for her kit, or null when it works. The set line on her Equipment
 * tab and the Set Box picker grey it with this reason. `cap`: the 5-piece set cap's own reason (null when it works).
 * @returns {{ passive: string|null, cap: string|null }}
 */
export function setIdle(setId, unitId) {
  const def = UNIT_MAP[unitId];
  const out = { passive: null, cap: null };
  if (!def) return out;
  const behavior = def.base?.behavior;
  const dead = fillStats(unitId, {});
  if (setId === 'geometry' || setId === 'popper') {
    if (!SET_ATTACK_BEHAVIORS.includes(behavior)) out.passive = 'Her attacks never count for it.';
    else if (setId === 'geometry' && dead.has('critChance')) out.passive = 'Her hits cannot crit (her crit lines count as her average crit instead).';
    if (setId === 'geometry' && dead.has('critChance')) out.cap = out.cap || 'Her hits cannot crit.';
  }
  if (setId === 'freezetag' && !CONTROL_REAL.includes(unitId)) out.passive = 'She slows, freezes, stuns and holds nothing.';
  if (setId === 'powerbank' && !skillHasteCounts(unitId) && def.kind !== 'hero') out.passive = 'Her ⚡ ability is not hasted (or not in this build yet).';
  if (setId === 'treasurer' && !def.base?.income) out.cap = 'She earns no wave interest.';
  if (setId === 'spirit' && !def.base?.aura) out.cap = 'She has no aura (her cheer still reaches her 2 nearest girls).';
  return out;
}

/** The name of a set for menus. */
export const setName = (id) => GEAR_SETS[id]?.name || id;
/** @returns {boolean} a piece a pin can take (gold, UR or LR) */
export const isPinnable = pinnable;

/**
 * Whether the pins show (v0.1.66 audit C M1): a pin can be had (a shop, drop or reward lists a Tie or Collar Pin) or
 * she already owns one. Until then a piece shows no Pin button, so nothing promises what cannot be got.
 */
export function pinsShown(profile) {
  if (itemCount(profile, TIE_PIN_ID) > 0 || itemCount(profile, COLLAR_PIN_ID) > 0) return true;
  return itemSources(TIE_PIN_ID).length > 0 || itemSources(COLLAR_PIN_ID).length > 0;
}

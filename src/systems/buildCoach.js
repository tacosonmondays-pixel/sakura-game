// The Build Coach (docs/specs/BUILD_COACH.md, milestone C1): "Set as Main" on one girl, then everything she still
// needs to max (exact counts from the game's own cost functions), where to farm each missing material (from the drop
// tables, only what players earn by playing: never the Gem Shop or a banner), her gear plan, her Potential steps, and
// a build score with the next three steps. Pure: it reads the save and src/data/buildCoachData.js and returns rows;
// the screens (src/ui/buildCoach.js) only draw them. Not hashed: nothing under src/sim imports it, no sim change.
//
// The plan grows with the gear update as data, never new screens: set rows light up when the Hair Clip and the
// Necklace are shown (SHOWN_SLOTS), pin targets when the pins have a source, the LR row when Limit Break exists,
// the accessory row when the accessories ship (features()).
//
// Save: profile.buildCoach = { main: unitId | null, seen: {} } (additive), mirrored as 'cm:<unitId>' = 1 in
// missions.counters so an older build that drops the block gives it back on the next load.
import { UNIT_MAP } from '../data/units.js';
import { ITEMS, getItem } from '../data/items.js';
import { SHOP_OFFER_MAP } from '../data/shop.js';
import { SHOWN_SLOTS, SLOT_IDS, slotName } from '../data/gearSlots.js';
import { GEAR_SETS } from '../data/gearSets.js';
import { CLUBS } from '../data/clubs.js';
import { statName, midRoll } from '../data/gearStats.js';
import { BUILD_COACH_DATA, BUILD_COACH_META } from '../data/buildCoachData.js';
import { potentialSteps, MAX_POTENTIAL } from '../data/potential.js';
import { STAGE_MAP } from '../data/stages.js';
import { DIFFICULTIES, DIFFICULTY_ORDER, GEAR_SUBSTATS_BY_RARITY } from '../data/types.js';
import { STITCH_COINS, UR_MAX_LEVEL } from '../data/gearAwaken.js';
import { eventDifficultyStatus } from './events.js';
import { potentialTextRow } from '../data/potentialText.js';
import {
  levelCap, expForLevel, breakthroughCost, awakenCost, gatePotential, MAX_BREAKTHROUGH, MAX_AWAKEN, COINS_PER_EXP,
  BREAKTHROUGH_LEVEL_CAP, EXP_PER_LEVEL_ABOVE_60, COINS_PER_LEVEL_ABOVE_60, MAX_LEVEL, LEVEL_PAST_GATES,
} from './progression.js';
import { raiseCost, essenceBalance, boughtP, kindredFor } from './essence.js';
import { potentialLevel } from './potential.js';
import {
  gearLines, enhanceCost, maxGearLevel, mainStatMax, substatRange, isUrGear, stitchSlots, awakenGearCost, mainRerollCost, armbandCost,
  gearStatTotals, gearSetInfo, wornGear,
} from './gear.js';
import * as gearSystem from './gear.js';
import { itemCount, itemSources } from './inventory.js';
import { isStageUnlocked } from './unlocks.js';
import { weightsOf, modelValue, SET_SIGNATURE } from './buildCoachModel.js';

export { MAIN_MARK, cleanBuildCoach, writeBuildCoachMark, mainGirl, setMain, clearMain } from './buildCoachSave.js';
import { mainGirl } from './buildCoachSave.js';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

/**
 * Her rows in the bench data, the path the coach opens on first: by `rank` (damage over the roster's median on the
 * same ruler; a support class opens on her support path), never raw damage across rulers (review r1 B1, M7).
 */
export function coachPaths(unitId) {
  const rows = BUILD_COACH_DATA[unitId] || [];
  return [...rows].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0) || a.path - b.path);
}

/** True when the data was measured on another sim than this build's (the stale-data warning). */
export const coachDataStale = (currentSimId) => !!currentSimId && BUILD_COACH_META.simId !== currentSimId;

/** What the game has today, so the plan shows only what a player can act on (and lights up as the update lands). */
export function features() {
  return {
    sets: SHOWN_SLOTS.length > 3,
    slots: SHOWN_SLOTS,
    pins: itemSources('tie_pin').length > 0,
    lr: typeof gearSystem.limitBreakGear === 'function',
    accessories: false,
  };
}

// ---------------------------------------------------------------------------
// To max: exact counts
// ---------------------------------------------------------------------------

const add = (map, id, n) => { if (n > 0) map.set(id, (map.get(id) || 0) + n); };
const needRows = (p, map) => [...map].map(([id, need]) => {
  const have = id === 'coins' ? p.currencies?.coins || 0 : itemCount(p, id);
  return { id, need, have, missing: Math.max(0, need - have) };
});

/**
 * EXP, coins and Akashic Tomes from her level (and the EXP she holds) to `toLevel`, by the game's rules: coins per EXP
 * applied up to 60 (COINS_PER_EXP), LEVEL_PAST_GATES' coins per level above it, one Tome per level above 60
 * (progression.js coinsFor, expForLevel; review r1 M2).
 */
function levelNeed(st, toLevel) {
  let below = 0;
  let above = 0;
  for (let l = st.level; l < toLevel; l++) {
    const e = expForLevel(l) - (l === st.level ? st.exp || 0 : 0);
    if (!Number.isFinite(e)) break;
    if (l >= BREAKTHROUGH_LEVEL_CAP) above += Math.max(0, e);
    else below += Math.max(0, e);
  }
  const coins = Math.ceil(below * COINS_PER_EXP + (above * COINS_PER_LEVEL_ABOVE_60) / EXP_PER_LEVEL_ABOVE_60);
  return { exp: below, tomes: Math.ceil(above / EXP_PER_LEVEL_ABOVE_60), coins };
}

/** EXP the books in the bag hold (the Akashic Tome counts as its own row above 60). */
function bookExp(p) {
  let n = 0;
  for (const [id, count] of Object.entries(p.items || {})) if (ITEMS[id]?.category === 'book' && id !== LEVEL_PAST_GATES.book) n += (ITEMS[id].xp || 0) * count;
  return n;
}

/**
 * Everything she still needs to max, one row per system: "need N · have M · missing K".
 * @returns {{ rows: { key, title, line, done: boolean, needs: { id, need, have, missing }[], go?: object }[],
 *   coins: { need, have, missing }, missing: { id, missing }[] }}
 */
export function toMax(p, unitId, plan = null) {
  const st = p.units[unitId];
  const def = UNIT_MAP[unitId];
  if (!st || !def) return { rows: [], coins: { need: 0, have: 0, missing: 0 }, missing: [] };
  const rows = [];
  const all = new Map();
  const row = (key, title, line, map, extra = {}) => {
    for (const [id, n] of map) add(all, id, n);
    const needs = needRows(p, map);
    rows.push({ key, title, line, done: !map.size && !extra.todo, needs, ...extra });
  };

  // Level: to 85 (the cap at P6 with every gate), saying the cap she has now
  const cap = levelCap(st);
  const lv = levelNeed(st, MAX_LEVEL);
  const lvMap = new Map();
  add(lvMap, 'coins', lv.coins);
  add(lvMap, LEVEL_PAST_GATES.book, lv.tomes);
  const books = bookExp(p);
  const lvLine = st.level >= MAX_LEVEL ? `Level ${MAX_LEVEL}`
    : `Level ${st.level} → ${MAX_LEVEL} (her cap now ${cap})${lv.exp ? `: ${lv.exp.toLocaleString('en-US')} EXP below 60 (your books hold ${books.toLocaleString('en-US')})` : ''}`;
  row('level', 'Level', lvLine, lvMap,
    { exp: { need: lv.exp, have: books, missing: Math.max(0, lv.exp - books) }, todo: st.level < MAX_LEVEL, go: { route: 'student', params: { id: unitId, tab: 'level' } } });

  // Gates
  const gMap = new Map();
  const gateLines = [];
  for (let g = st.breakthrough + 1; g <= MAX_BREAKTHROUGH; g++) {
    for (const c of breakthroughCost(unitId, g)) add(gMap, c.id, c.count);
    const needP = gatePotential(g);
    if (needP > potentialLevel(st)) gateLines.push(`gate ${g} needs P${needP}`);
  }
  row('gates', 'Gates', st.breakthrough >= MAX_BREAKTHROUGH ? 'Every gate open' : `Gates ${st.breakthrough} → ${MAX_BREAKTHROUGH}${gateLines.length ? ` (${gateLines.slice(0, 2).join(', ')})` : ''}`, gMap,
    { go: { route: 'student', params: { id: unitId, tab: 'level' } } });

  // Stars
  const sMap = new Map();
  for (let s = st.awaken + 1; s <= MAX_AWAKEN; s++) for (const c of awakenCost(unitId, s)) add(sMap, c.id, c.count);
  row('stars', 'Stars', st.awaken >= MAX_AWAKEN ? '★5' : `★${st.awaken} → ★${MAX_AWAKEN}`, sMap, { go: { route: 'student', params: { id: unitId, tab: 'awaken' } } });

  // Potential
  const pMap = new Map();
  const P = boughtP(st);
  let essence = 0;
  for (let k = P; k < MAX_POTENTIAL; k++) {
    add(pMap, 'coins', raiseCost(def, k) || 0);
    essence += 1;
  }
  const ess = essenceBalance(p, unitId);
  // Essence she lacks is earned by playing as Kindred Essence (Titan Trials first clears; review r1 M1): her rarity's
  // Kindred goes to the Farm list
  const kin = kindredFor(def)[0] || null;
  const kinHave = kindredFor(def).reduce((a, id) => a + itemCount(p, id), 0);
  const essMissing = Math.max(0, essence - ess - kinHave);
  if (kin && essMissing) add(pMap, kin, essMissing + itemCount(p, kin));
  row('potential', 'Potential', P >= MAX_POTENTIAL ? 'P6' : `P${P} → P${MAX_POTENTIAL}: ${essence} Essence (she holds ${ess}; Kindred Essence from Titan Trials stands in)`, pMap,
    { essence: { need: essence, have: ess + kinHave, missing: essMissing }, todo: P < MAX_POTENTIAL, go: { route: 'student', params: { id: unitId, tab: 'info', focus: 'potential' } } });

  // Gear: enhance every shown slot to its max, the Rainbow Seed and the open stitches
  const gMap2 = new Map();
  const lines = [];
  for (const slot of features().slots) {
    const uid = st.gear?.[slot];
    const g = uid ? p.gear[uid] : null;
    if (!g) {
      lines.push(`${slotName(slot)}: empty`);
      continue;
    }
    // the whole road (review r1 M3): +10, then for a Legendary the Rainbow Bloom (Seed + coins) and UR +10 → +12 at
    // UR prices, and both ✦ stitches (gold, rainbow: a Needle and the stitch coins each)
    const legend = g.rarity === 'legendary';
    const top = legend ? UR_MAX_LEVEL : maxGearLevel(g);
    let coins = 0;
    const probe = { ...g };
    while (probe.level < top) {
      if (legend && probe.level >= maxGearLevel(probe) && !isUrGear(probe)) probe.ur = 1;
      coins += enhanceCost(probe) || 0;
      probe.level += 1;
    }
    add(gMap2, 'coins', coins);
    if (legend && !isUrGear(g)) for (const c of awakenGearCost()) add(gMap2, c.id, c.count);
    if (legend) {
      const sl = stitchSlots(g);
      const open = (sl.gold.used ? 0 : 1) + (sl.rainbow.used ? 0 : 1);
      add(gMap2, 'needle_star', open);
      add(gMap2, 'coins', open * STITCH_COINS);
    }
    if (g.level < top) lines.push(`${slotName(slot)} +${g.level} → +${top}${legend && !isUrGear(g) ? ' (UR)' : ''}`);
  }
  // her plan's pins (when the pins have a source)
  if (plan?.pins && features().pins) {
    add(gMap2, 'tie_pin', 1);
    add(gMap2, 'collar_pin', plan.pins.collar.length);
  }
  row('gear', 'Gear', lines.length ? lines.slice(0, 3).join(' · ') : 'Every piece at its max', gMap2, { todo: lines.length > 0, go: { route: 'student', params: { id: unitId, tab: 'gear' } } });

  const coinsNeed = all.get('coins') || 0;
  return {
    rows,
    coins: { need: coinsNeed, have: p.currencies?.coins || 0, missing: Math.max(0, coinsNeed - (p.currencies?.coins || 0)) },
    missing: needRows(p, all).filter((r) => r.missing > 0 && r.id !== 'coins').map((r) => ({ id: r.id, missing: r.missing })),
  };
}

// ---------------------------------------------------------------------------
// Farm: where each missing material comes from
// ---------------------------------------------------------------------------

/**
 * Currencies a banner pays: Recruit Points (pulls) and the Memento / Moonpearl a spare duplicate pays (review r1 H2,
 * M1). The coach never prices a source in them (owner Q18: never the Gem Shop or a banner); the owner may rule the
 * duplicate exchanges in (OWNER_BOARD Q18), which is this one list.
 */
export const BANNER_FED = Object.freeze(['recruitPoints', 'memento', 'moonpearl']);

/** A source players reach by playing: never the Gem Shop, gems, or a banner (or a currency only banners pay). */
function earnedByPlay(src) {
  if (src.route === 'recruit') return false;
  if (src.kind === 'shop') {
    const offer = SHOP_OFFER_MAP[src.offerId];
    if (!offer || offer.currency === 'gems' || offer.tab === 'gems' || BANNER_FED.includes(offer.currency)) return false;
  }
  return true;
}

/**
 * Her yield per run of an item on a stage at its hardest difficulty open on this save (review r1 M4): every difficulty
 * of an open campaign stage is open; an event stage asks the event.
 * @returns {{ difficulty: string, expected: number, chance: number }|null}
 */
function stageYield(p, stageId, itemId) {
  const st = STAGE_MAP[stageId];
  if (!st) return null;
  const order = st.kind === 'event' && st.difficulties ? st.difficulties : DIFFICULTY_ORDER;
  for (const d of [...order].reverse()) {
    if (st.kind === 'event' && !eventDifficultyStatus(p, stageId, d)?.ok) continue;
    let none = 1;
    let expected = 0;
    for (const x of st.drops || []) {
      if (x.item !== itemId || DIFFICULTY_ORDER.indexOf(x.difficulty || 'easy') > DIFFICULTY_ORDER.indexOf(d)) continue;
      none *= 1 - x.chance;
      expected += (x.chance * (x.min + x.max)) / 2;
    }
    if (expected > 0) return { difficulty: d, expected: Math.round(expected * 100) / 100, chance: 1 - none };
  }
  return null;
}

/**
 * The best sources of each missing item, ranked by expected units per run (stages open for this save first).
 * @returns {{ id, name, missing, sources: { label, note, expected?, stageId?, go: { route, params } }[] }[]}
 */
export function farmPlan(p, missing, { per = 3 } = {}) {
  return missing.map(({ id, missing: n }) => {
    const all = itemSources(id).filter(earnedByPlay);
    const stages = all.filter((s) => s.kind === 'stage' && isStageUnlocked(p, s.stageId))
      .map((s) => ({ ...s, y: stageYield(p, s.stageId, id) })).filter((s) => s.y)
      .sort((a, b) => b.y.expected - a.y.expected || (a.order || 0) - (b.order || 0));
    const rest = all.filter((s) => s.kind !== 'stage');
    const sources = [...stages, ...rest].slice(0, per).map((s) => ({
      label: s.label,
      note: s.y ? `≈ ${s.y.expected} per run on ${DIFFICULTIES[s.y.difficulty]?.name || s.y.difficulty} (${Math.round(s.y.chance * 100)}%)` : s.note,
      expected: s.y ? s.y.expected : null,
      difficulty: s.y ? s.y.difficulty : null,
      stageId: s.stageId || null,
      go: s.stageId ? { route: 'stage', params: { id: s.stageId, difficulty: s.y.difficulty } } : { route: s.route, params: s.params || {} },
    }));
    return { id, name: getItem(id)?.name || id, missing: n, sources };
  });
}

/** The main girl's Farm rows that drop on this stage ("Farming for Kage: Phoenix Plume ×2"). */
export function farmingHere(p, stageId) {
  const main = mainGirl(p);
  if (!main) return null;
  const plan = gearPlan(p, main);
  const need = toMax(p, main, plan.row);
  const here = farmPlan(p, need.missing, { per: 6 }).filter((f) => f.sources.some((s) => s.stageId === stageId));
  return here.length ? { unitId: main, items: here.map((f) => ({ id: f.id, name: f.name, missing: f.missing })) } : null;
}

// ---------------------------------------------------------------------------
// Gear plan
// ---------------------------------------------------------------------------

/**
 * Her gear plan on one path (default: her best): mains per slot with her piece checked, the substat order and which of
 * each piece's lines match, the club split, and (as they exist) the set, pins, LR kind and accessory.
 */
export function gearPlan(p, unitId, pathIndex = null) {
  const paths = coachPaths(unitId);
  const row = paths.find((r) => r.path === pathIndex) || paths[0] || null;
  const f = features();
  const st = p.units[unitId];
  const out = { row, paths, features: f, slots: [], subs: row?.subs || [], club: null, set: null, pins: null, lr: null, est: (row?.est || []).map((k) => statName(k)) };
  if (!row || !st) return out;
  for (const slot of f.slots) {
    const uid = st.gear?.[slot];
    const g = uid ? p.gear[uid] : null;
    const want = row.mains?.[slot];
    const L = g ? gearLines(g) : null;
    const top = row.subs.slice(0, 4);
    out.slots.push({
      slot,
      name: slotName(slot),
      want,
      wantName: want ? statName(want) : null,
      piece: g ? { uid, name: g.name, main: L.main.stat, ok: L.main.stat === want, level: g.level, rarity: g.rarity } : null,
      match: g ? L.subs.map((s) => ({ stat: s.stat, good: top.includes(s.stat) })) : [],
    });
  }
  const three = row.club?.three;
  const two = row.club?.two;
  const set = gearSetInfo(p, unitId);
  out.club = {
    three, two, threeName: CLUBS[three]?.name || null, twoName: CLUBS[two]?.name || null,
    // today's three pieces hold one club's three; five pieces hold 3 + 2
    split: f.slots.length >= 5 ? `${CLUBS[three]?.name} 3 + ${CLUBS[two]?.name} 2` : `${CLUBS[three]?.name} 3`,
    now: set.club ? `${CLUBS[set.club].name} ${set.clubN || 0}` : null,
  };
  if (f.sets) out.set = { best: row.sets?.[0], next: row.sets?.[1], name: GEAR_SETS[row.sets?.[0]]?.name, nextName: GEAR_SETS[row.sets?.[1]]?.name, stat: statName(SET_SIGNATURE[row.sets?.[0]]) };
  if (f.pins) out.pins = { tie: row.pins.tie, tieName: slotName(row.pins.tie), collar: row.pins.collar.map((s) => statName(s)) };
  if (f.lr) out.lr = row.lr;
  return out;
}

// ---------------------------------------------------------------------------
// Potential
// ---------------------------------------------------------------------------

/** Her Potential steps still to buy, in order, with what each gives and its price. */
export function potentialPlan(p, unitId) {
  const def = UNIT_MAP[unitId];
  const st = p.units[unitId];
  if (!def || !st) return [];
  const P = boughtP(st);
  const text = potentialTextRow(def) || [];
  return potentialSteps(def).filter((s) => s.step > P).map((s) => ({
    step: s.step,
    name: s.name || `P${s.step}`,
    text: (() => { const t = text[s.step - 2]; return typeof t === 'string' ? t : t?.card || t?.long || null; })(),
    coins: raiseCost(def, s.step - 1) || 0,
    essence: 1,
  }));
}

// ---------------------------------------------------------------------------
// Build score and the next best steps
// ---------------------------------------------------------------------------

const rarityRank = { common: 0, rare: 1, superRare: 2, epic: 2, mythic: 3, legendary: 4 };
/** A piece's lines as totals. */
function pieceTotals(g) {
  const out = {};
  const L = gearLines(g);
  for (const s of [L.main, ...L.subs]) out[s.stat] = (out[s.stat] || 0) + s.value;
  return out;
}
const sumTotals = (...ts) => {
  const out = {};
  for (const t of ts) for (const [k, v] of Object.entries(t)) out[k] = (out[k] || 0) + v;
  return out;
};
/** Her plan's piece at a rarity and level: the wanted main (best roll) and her top substats at an average roll. */
function idealTotals(row, slot, rarity, level) {
  const out = {};
  const want = row.mains?.[slot];
  if (want) out[want] = mainStatMax(want, rarity, level);
  const n = GEAR_SUBSTATS_BY_RARITY[rarity === 'ur' ? 'legendary' : rarity] ?? 0;
  for (const s of row.subs.filter((x) => x !== want).slice(0, n)) {
    const [a, b] = substatRange(s, rarity);
    out[s] = (out[s] || 0) + (a + b) / 2;
  }
  return out;
}

/**
 * Build score 0–100: her model with what she wears ÷ the same model with her best build of what she has (her plan's
 * mains and substats at her pieces' rarities and levels). "Max": against her fully maxed plan (Legendary UR +12).
 * @returns {{ score: number, max: number, steps: object[] }}
 */
export function buildScore(p, unitId, pathIndex = null) {
  const plan = gearPlan(p, unitId, pathIndex);
  const row = plan.row;
  const st = p.units[unitId];
  if (!row || !st) return { score: 0, max: 0, steps: [] };
  const w = weightsOf(row);
  const cur = gearStatTotals(p, unitId);
  const vCur = modelValue(w, cur);
  const slots = plan.features.slots;
  const best = [];
  const maxed = [];
  for (const slot of slots) {
    const g = st.gear?.[slot] ? p.gear[st.gear[slot]] : null;
    // an empty slot: the best spare of that slot in the bag (what she has), else nothing
    const spare = g ? null : spareFor(p, unitId, slot, w);
    const ref = g || spare;
    if (ref) best.push(idealTotals(row, slot, ref.rarity, ref.level));
    maxed.push(idealTotals(row, slot, 'ur', UR_MAX_LEVEL));
  }
  const clubTwo = CLUBS[row.club?.three]?.two;
  const vBest = Math.max(vCur, modelValue(w, sumTotals(...best)));
  const vMax = Math.max(vCur, modelValue(w, sumTotals(...maxed, clubTwo ? { [clubTwo.stat]: clubTwo.value } : {})));
  const score = Math.round((100 * vCur) / vBest);
  const max = Math.round((100 * vCur) / vMax);
  return { score, max, steps: nextSteps(p, unitId, plan, w, vCur, vMax) };
}

/** Her best free spare for a slot (not worn by anyone), by her model. */
function spareFor(p, unitId, slot, w) {
  let best = null;
  let bestV = 1;
  for (const g of Object.values(p.gear || {})) {
    if (g.slot !== slot || g.equippedBy) continue;
    const v = modelValue(w, pieceTotals(g));
    if (v > bestV) { best = g; bestV = v; }
  }
  return best;
}

/** Points of the Max line a change is worth (vMax is the 100). */
const points = (vNew, vCur, vMax) => Math.max(0, (100 * (vNew - vCur)) / vMax);

/**
 * The three steps with the most score per cost: enhance a piece, equip a better spare, change a main with a Prism
 * Dice, tie an Armband toward her club. Each has a Go. A step that needs something missing names it.
 */
function nextSteps(p, unitId, plan, w, vCur, vMax) {
  const st = p.units[unitId];
  const cur = gearStatTotals(p, unitId);
  const out = [];
  const coinsHave = p.currencies?.coins || 0;
  for (const s of plan.slots) {
    const g = s.piece ? p.gear[s.piece.uid] : null;
    if (g && g.level < maxGearLevel(g)) {
      // to the next ▲ (every 3 levels) or the max
      const to = Math.min(maxGearLevel(g), (Math.floor(g.level / 3) + 1) * 3);
      let coins = 0;
      const probe = { ...g };
      while (probe.level < to) { coins += enhanceCost(probe) || 0; probe.level += 1; }
      const L = gearLines(g);
      const grown = mainStatMax(L.main.stat, g.rarity, to) / Math.max(1e-9, mainStatMax(L.main.stat, g.rarity, g.level));
      const after = { ...cur, [L.main.stat]: (cur[L.main.stat] || 0) + L.main.value * (grown - 1) };
      const gain = points(modelValue(w, after), vCur, vMax);
      out.push({ kind: 'enhance', text: `Enhance her ${s.name} +${g.level} → +${to}`, chip: `${s.name} to +${to}`, gain, cost: coins, costText: `${coins.toLocaleString('en-US')} coins`, short: coinsHave < coins ? 'coins' : null, go: { route: 'student', params: { id: unitId, tab: 'gear' } } });
    }
    if (g && !s.piece.ok && s.want) {
      const L = gearLines(g);
      const after = { ...cur, [L.main.stat]: (cur[L.main.stat] || 0) - L.main.value, [s.want]: (cur[s.want] || 0) + mainStatMax(s.want, g.rarity, g.level) };
      const gain = points(modelValue(w, after), vCur, vMax);
      const cost = mainRerollCost(g);
      const coins = cost.find((c) => c.id === 'coins')?.count || 0;
      const dice = itemCount(p, 'dice_prism');
      out.push({ kind: 'prism', text: `Prism Dice: the main on her ${s.name} → ${s.wantName}`, chip: `${s.name} main → ${s.wantName}`, gain, cost: coins, costText: `1 Prism Dice + ${coins.toLocaleString('en-US')} coins`, short: dice < 1 ? 'dice_prism' : null, go: { route: 'student', params: { id: unitId, tab: 'gear' } } });
    }
    const spare = spareFor(p, unitId, s.slot, w);
    if (spare) {
      const off = g ? pieceTotals(g) : {};
      const on = pieceTotals(spare);
      const after = sumTotals(cur, on, Object.fromEntries(Object.entries(off).map(([k, v]) => [k, -v])));
      const gain = points(modelValue(w, after), vCur, vMax);
      if (gain > 0.5) out.push({ kind: 'equip', text: `Equip ${spare.name} on her ${s.name}`, chip: `a better ${s.name}`, gain, cost: 1, costText: 'free', short: null, go: { route: 'student', params: { id: unitId, tab: 'gear' } } });
    }
  }
  // her club: an Armband ties a Mythic or better piece into it
  const set = gearSetInfo(p, unitId);
  const want = plan.club?.three;
  if (want && (set.club !== want || (set.clubN || 0) < 3)) {
    const piece = wornGear(p, unitId).find((g) => g.club !== want && rarityRank[g.rarity] >= 3);
    if (piece) {
      const two = CLUBS[want].two;
      const after = { ...cur, [two.stat]: (cur[two.stat] || 0) + (set.club === want ? 0 : two.value) };
      const gain = Math.max(0.5, points(modelValue(w, after), vCur, vMax));
      const ac = armbandCost(piece);
      const acCoins = ac.find((c) => c.id === 'coins')?.count || 0;
      out.push({ kind: 'club', text: `Tie an Armband: ${CLUBS[want].name} on her ${slotName(piece.slot)}`, chip: `${CLUBS[want].name} Armband`, gain, cost: acCoins, costText: `1 Club Armband + ${acCoins.toLocaleString('en-US')} coins`, short: itemCount(p, 'club_band') < 1 ? 'club_band' : null, go: { route: 'student', params: { id: unitId, tab: 'gear' } } });
    }
  }
  // nothing to do on gear: her level
  if (!out.length && st.level < levelCap(st)) out.push({ kind: 'level', text: `Level her up to ${levelCap(st)}`, chip: `level ${levelCap(st)}`, gain: 0, cost: 1, costText: 'books and coins', short: null, go: { route: 'student', params: { id: unitId, tab: 'level' } } });
  return out
    .filter((s) => s.gain > 0 || s.kind === 'level')
    .sort((a, b) => b.gain / Math.max(1, b.cost) - a.gain / Math.max(1, a.cost) || b.gain - a.gain)
    .slice(0, 3)
    .map((s) => ({
      ...s,
      gain: s.gain > 0 ? Math.max(1, Math.round(s.gain)) : 0,
      per: s.gain / Math.max(1, s.cost), // (the order: score per coin)
      // a step that needs something missing points to where it is earned (§6)
      farm: s.short ? farmPlan(p, [{ id: s.short, missing: 1 }], { per: 1 })[0]?.sources[0] || null : null,
    }));
}

/** The home chip's one line: "Kage · next: Enhance her Ribbon +8 → +10". */
export function homeLine(p) {
  const main = mainGirl(p);
  if (!main) return null;
  const { steps } = buildScore(p, main);
  return { unitId: main, name: UNIT_MAP[main]?.name || main, next: steps[0] || null };
}

/** Subs a slot's line names, for the plan sheet (stat → its name). */
export const statLabel = (stat) => statName(stat);
export { SLOT_IDS, midRoll };

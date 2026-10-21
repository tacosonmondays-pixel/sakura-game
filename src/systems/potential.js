// Potential (owner: systems). See docs/specs/POTENTIAL.md.
//
// Every duplicate of an owned girl (a recruit, a spark, an SSR Select Ticket) adds 1 to
// `profile.units[id].dupes`; her Potential is `min(6, 1 + dupes)` (potentialLevel: the ONE place
// that says where Potential comes from, so a later source such as ascension's Essence swaps in here
// without touching the ladders). Each step P2…P6 (v3: a stat buff plus a kit buff) comes from
// src/data/potential.js, which the battle sim folds in (mods.js resolveStats) from
// `unitBattleStats().potential`; its text from src/data/potentialText.js. This file is outside the
// co-op graph: counting, the backfill and the one describer every screen uses (student page, battle
// panel, recruit, wiki, letter).
//
// The count is mirrored in `missions.counters['pot:<id>']` (with `'pot:at'` = when it last
// changed) because builds from before M0 drop `dupes` through their `cleanUnit` allowlist but
// keep `missions.counters` word for word: an out-of-date tab that saves cannot lower it.
// Saves from before M0 are credited once from the recruit history (`backfillDupes`).
//
// Pure functions; save.js and unlocks.js call them.

import { UNIT_MAP } from '../data/units.js';
import { MAX_POTENTIAL, potentialSteps, potentialFold, potentialClamp, potentialTrack } from '../data/potential.js';
import { potentialTextRow } from '../data/potentialText.js';

export { MAX_POTENTIAL, potentialSteps, potentialFold };

/**
 * Recruit pool sizes of v0.1.25 (19 girls), pinned: the backfill only ever estimates recruits
 * made before M0 counted them, and those were all made on this pool.
 */
export const POOL_SIZE_V0125 = Object.freeze({ R: 4, SR: 10, SSR: 5 });

/** Share of all recruits per rarity with pity and the ten-pull guarantee (spec §6.2). */
export const RARITY_SHARE = Object.freeze({ R: 0.785, SR: 0.194, SSR: 0.0203 });

/** A history entry this close after `obtainedAt` is the girl's first copy, not a duplicate. */
export const FIRST_COPY_MS = 2000;

/** Shadow-copy keys in `missions.counters` (never collide with mission events). */
export const SHADOW_PREFIX = 'pot:';
export const SHADOW_AT = 'pot:at';

/** Marker in `seenIntro`: the one-time backfill ran on an existing save. */
export const BACKFILL_MARKER = 'potential-backfilled';

/**
 * Marker in `seenIntro`: this save has met Potential v3 (src/systems/mail.js ensurePotentialLetter
 * sets it on the first app start of a v3 build, with the "Potential grew!" letter for a save that
 * already had a girl at P2+). `NEW_PREFIX + id` entries: girls whose v3 steps she has not looked
 * at yet (the NEW badge on her card; opening her Info tab clears it). Both are strings in a list
 * every build keeps word for word.
 */
export const V3_MARKER = 'potential-v3';
export const NEW_PREFIX = 'pot3-new:';

/** @returns {boolean} her card shows the one-time NEW badge (a girl at P2+ when v3 arrived, not looked at yet) */
export function hasPotentialNew(profile, unitId) {
  return !!profile?.seenIntro?.includes(NEW_PREFIX + unitId);
}

/** Her Info tab was opened: clear her NEW badge. @returns {boolean} something changed */
export function clearPotentialNew(profile, unitId) {
  const list = profile?.seenIntro;
  if (!Array.isArray(list)) return false;
  const i = list.indexOf(NEW_PREFIX + unitId);
  if (i < 0) return false;
  list.splice(i, 1);
  return true;
}

/** Starters are owned from the start; no history entry can be their first copy. */
const STARTERS = ['hikari', 'aoi', 'rei'];

const whole = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/**
 * @param {object|null|undefined} unitState profile.units[id]
 * @returns {number} 1..6 (no state or no bought Potential → 1)
 */
export function potentialLevel(unitState) {
  // Ascension (docs/specs/ASCENSION.md §A.1): Potential is bought with Essence (src/systems/essence.js)
  // and stored as `pl`; no `pl` = P1 (never read from `dupes`, which also counts spare copies)
  return Math.min(MAX_POTENTIAL, Math.max(1, whole(unitState?.pl) || 1));
}

/**
 * The unit-state fields that put a girl at Potential `p`: potentialLevel's inverse, kept beside it.
 * A screen that knows only her P (a profile card's showcase entry, a co-op ally's loadout) builds her
 * state from this, so a later Potential source (ascension's Essence) changes both directions here.
 * Her level cap needs no state at all: src/systems/progression.js levelCapAt(gates, p).
 * @param {number} p 1…6 (anything else counts as P1)
 * @returns {{ dupes: number, pl: number }} (`pl`: bought Potential, ASCENSION.md §A.1)
 */
export function potentialState(p) {
  const pl = Math.max(1, Math.min(MAX_POTENTIAL, Math.floor(Number(p) || 1)));
  return { dupes: pl - 1, pl };
}

/**
 * Potential v3 paid Akashic Tomes for duplicates past P6. Ascension replaced that: a copy past her
 * Essence hold cap is a spare (Mementos, Moonpearls, recruit points; src/systems/essence.js). Kept
 * exported (always 0 now) for older callers.
 */
export const DUPE_PAST_MAX_TOMES = Object.freeze({ R: 0, SR: 0, SSR: 0 });
/** The book the levels above 60 are priced in (src/systems/progression.js LEVEL_PAST_GATES). */
export const DUPE_PAST_MAX_ITEM = 'book_legendary';

/** @returns {number} always 0: duplicates no longer pay Tomes (Ascension) */
export function dupePastMaxTomes() {
  return 0;
}

/** What a spare copy of her converts into: "6 Mementos, 1 Moonpearl and 1 recruit point". */
export function dupePastMaxPay(def) {
  switch (def?.rarity) {
    case 'SSR': return '10 Moonpearls and 5 recruit points';
    case 'SR': return '6 Mementos, 1 Moonpearl and 1 recruit point';
    default: return '2 Mementos and ⅕ of a recruit point';
  }
}

/**
 * Write the shadow copy of one girl's count.
 * @param {object} profile
 * @param {string} unitId
 * @param {number} [now]
 */
export function shadowPotential(profile, unitId, now = Date.now()) {
  const m = (profile.missions ||= {});
  const c = (m.counters ||= {});
  c[SHADOW_PREFIX + unitId] = whole(profile.units?.[unitId]?.dupes);
  c[SHADOW_AT] = now;
}

/**
 * Smallest k with P(X ≤ k) ≥ q for X ~ Poisson(λ). A fixed product series (e^-λ once, then
 * ×λ/k), run once per save outside the sim; the stored result is what counts.
 * @param {number} lambda
 * @param {number} [q]
 * @returns {number}
 */
export function poissonQuantile(lambda, q = 0.25) {
  if (!(lambda > 0)) return 0;
  let term = Math.exp(-lambda);
  let cdf = term;
  let k = 0;
  while (cdf < q && k < 100000) {
    k += 1;
    term *= lambda / k;
    cdf += term;
  }
  return k;
}

/** History entries of one girl at or after `from`, and whether one of them is her first copy. */
function historyCopies(unitId, st, history, from, starter) {
  const obtainedAt = typeof st.obtainedAt === 'number' ? st.obtainedAt : Infinity;
  const own = history.filter((h) => h.unitId === unitId && h.at >= obtainedAt && h.at > from);
  const first = !starter && own.some((h) => h.at - obtainedAt <= FIRST_COPY_MS);
  return Math.max(0, own.length - (first ? 1 : 0));
}

/**
 * One-time credit for saves from before M0 (spec §6.2). For each owned girl whose `dupes` is
 * `null`: her duplicates in the kept history (her first copy excluded), plus an estimate for
 * recruits that fell out of the 100-entry history — average luck (floor λ) for R and SR, a
 * cautious guess (the Poisson 25th percentile) for SSR.
 * @param {object} units profile.units ({ [id]: { dupes: number|null, obtainedAt } })
 * @param {object} gacha profile.gacha ({ totalPulls, history: [{ unitId, at }] })
 * @param {{ createdAt?: number, now?: number, starters?: string[] }} [opts]
 * @returns {Object<string, number>} { [unitId]: dupes } for the girls that needed credit
 */
export function backfillDupes(units, gacha, { createdAt, now = Date.now(), starters = STARTERS } = {}) {
  const out = {};
  const history = Array.isArray(gacha?.history) ? gacha.history : [];
  const totalPulls = whole(gacha?.totalPulls);
  const fellOut = Math.max(0, totalPulls - history.length);
  const oldestAt = history.length ? history[0].at : now;
  const created = typeof createdAt === 'number' ? createdAt : now;
  for (const [id, st] of Object.entries(units || {})) {
    if (!st || st.dupes != null) continue;
    const def = UNIT_MAP[id];
    if (!def) continue;
    const fromHistory = historyCopies(id, st, history, -Infinity, starters.includes(id));
    let estimated = 0;
    const pool = POOL_SIZE_V0125[def.rarity];
    if (fellOut > 0 && pool && typeof st.obtainedAt === 'number') {
      const f = Math.min(1, Math.max(0, (oldestAt - Math.max(st.obtainedAt, created)) / Math.max(1, oldestAt - created)));
      const lambda = (fellOut * RARITY_SHARE[def.rarity]) / pool * f;
      estimated = def.rarity === 'SSR' ? poissonQuantile(lambda, 0.25) : Math.floor(lambda);
    }
    out[id] = fromHistory + estimated;
  }
  return out;
}

/**
 * Stale-tab repair (spec §6.5). A girl whose `dupes` was dropped (null) but who has a shadow
 * gets the shadow plus her duplicates in the history after `'pot:at'`; a girl with both keeps
 * the larger. Never lowers a count.
 * @param {object} units profile.units
 * @param {object} counters profile.missions.counters
 * @param {object[]} history profile.gacha.history
 * @param {{ starters?: string[] }} [opts]
 * @returns {Object<string, number>} { [unitId]: dupes } for the girls it set
 */
export function restoreFromShadow(units, counters, history, { starters = STARTERS } = {}) {
  const out = {};
  if (!counters) return out;
  const at = typeof counters[SHADOW_AT] === 'number' ? counters[SHADOW_AT] : -Infinity;
  const list = Array.isArray(history) ? history : [];
  for (const [id, st] of Object.entries(units || {})) {
    if (!st) continue;
    const key = SHADOW_PREFIX + id;
    if (!(key in counters)) continue;
    const shadow = whole(counters[key]);
    if (st.dupes == null) out[id] = shadow + historyCopies(id, st, list, at, starters.includes(id));
    else if (shadow > st.dupes) out[id] = shadow;
  }
  return out;
}

/** @returns {number} duplicates still needed for the next step (0 at P6) */
export function dupesToNext(unitState) {
  return potentialLevel(unitState) >= MAX_POTENTIAL ? 0 : 1;
}

/** @returns {number} duplicates still needed for P6 */
export function dupesToMax(unitState) {
  return MAX_POTENTIAL - potentialLevel(unitState);
}

const pct = (m) => `${Math.round((m - 1) * 1000) / 10}%`;

/** Who a step helps (unit-info's Self / Allies / Enemies tags): an aura or a limited buff helps allies. */
function stepWho(step) {
  const m = step?.mods || {};
  if (m.aura || m.proc?.auraBoost || m.brew || m.link || m.ult?.rateBuff || m.ult?.buffDuration) return 'allies';
  return 'self';
}

/**
 * The stat part of a step as a short label, the line under each node ("+4% SPD", "+3% AURA",
 * "+3% COIN"): the value of her stat track at that step (src/data/potential.js POTENTIAL_TRACK_OF).
 * '' when the step has no stat part (fixtures).
 */
export function potentialStatLabel(step, def = null) {
  const g = step?.girl || {};
  const a = step?.mods?.aura || {};
  const track = def ? potentialTrack(def) : null;
  if (track === 'coins' && g.incomeMul) return `+${pct(g.incomeMul)} COIN`;
  if (track === 'aura' && (a.dmgMul || a.rateMul)) return `+${pct(a.dmgMul || a.rateMul)} AURA`;
  if (g.damageMul) return `+${pct(g.damageMul)} ${def?.base?.behavior === 'trap' ? 'TRAP' : 'DMG'}`;
  if (g.rateMul) return `+${pct(g.rateMul)} SPD`;
  if (g.incomeMul) return `+${pct(g.incomeMul)} COIN`;
  return '';
}

/**
 * Player-facing text for one step (src/data/potentialText.js): the node label (≤ 9 characters, for the
 * six-node track and chips), the long text (tooltips, wiki, letter) and who it helps. A def without a
 * text row (fixtures) gets a label from the step's stat part.
 * @param {{ step: number, girl?: object|null, mods?: object|null }} step
 * @param {object} [def]
 * @returns {{ short: string, long: string, who: 'self'|'allies'|'enemies' }[]}
 */
export function describePotentialStep(step, def = null) {
  const row = potentialTextRow(def);
  const txt = row && step?.step >= 2 ? row[step.step - 2] : null;
  const who = stepWho(step);
  if (txt) return [{ short: txt.node, long: txt.long, who }];
  const label = potentialStatLabel(step, def);
  if (!label) return [];
  return [{ short: label, long: label.replace(' DMG', ' damage').replace(' SPD', ' attack speed').replace(' COIN', ' coins per wave').replace(' AURA', ' aura').replace(' TRAP', ' trap damage'), who }];
}

/** A kit step (stat + kit, or the capstone) teaches her a trick; a 'stat' step only raises a number. */
export const isKitStep = (step) => !!step && step.kind != null && step.kind !== 'stat';

const TAG_ORDER = ['allies', 'enemies', 'coins'];
const ENEMY_STATUS = (m) => [...(m.statusAdd || []), ...(m.proc?.status || []), ...(m.ult?.status || []), ...(m.ult?.statusAdd || [])];

/**
 * Who a step reaches besides her own attacks (the Info tab's chips): 'allies' (an aura, a rhythm's
 * aura boost, a brew or link, a hero's team-wide haste), 'enemies' (a status or silence she puts on
 * them, Brittle inside her aura, a burn that leaps), 'coins' (wave income, loot, a harvest).
 * @returns {('allies'|'enemies'|'coins')[]}
 */
export function potentialStepTags(step) {
  const m = step?.mods || {};
  const g = step?.girl || {};
  const out = new Set();
  if (stepWho(step) === 'allies') out.add('allies');
  if (ENEMY_STATUS(m).length || m.silence || m.proc?.silence || m.aura?.foeVuln || m.dotSpread) out.add('enemies');
  if (g.incomeMul || m.bountyAura || m.harvest) out.add('coins');
  return TAG_ORDER.filter((t) => out.has(t));
}

/**
 * One step for previews, cards, the letter and the Info tab's step list:
 *   brief  "✦ Moonpiercer" on a kit step; on a stat step what it raises ("+4% attack speed")
 * @param {object} def
 * @param {number} p 2…6
 * @returns {{ step: number, name: string|null, kind: string, kit: boolean, crown: boolean, node: string, long: string, brief: string, stat: string, tags: string[] }|null}
 */
export function potentialStepInfo(def, p) {
  const s = potentialSteps(def).find((x) => x.step === p);
  if (!s) return null;
  const parts = describePotentialStep(s, def);
  const long = parts.map((x) => x.long).join(' ');
  const kit = isKitStep(s);
  return {
    step: s.step,
    name: s.name,
    kind: s.kind,
    kit,
    crown: s.step === MAX_POTENTIAL,
    node: parts.map((x) => x.short).join(' '),
    long,
    brief: kit && s.name ? `✦ ${s.name}` : long.replace(/\.\s*$/, ''),
    stat: potentialStatLabel(s, def),
    tags: potentialStepTags(s),
  };
}

/**
 * The step her next duplicate unlocks, with what it takes (always 1 duplicate today: the source
 * lives in potentialLevel / dupesToNext). Null at P6 and for a girl not owned.
 * @returns {(ReturnType<typeof potentialStepInfo> & { dupes: number })|null}
 */
export function potentialNext(def, unitState) {
  if (!unitState) return null;
  const p = potentialLevel(unitState);
  if (p >= MAX_POTENTIAL) return null;
  const info = potentialStepInfo(def, p + 1);
  return info ? { ...info, dupes: dupesToNext(unitState) } : null;
}

/**
 * The duplicates rule in one sentence (the recruit rates, the wiki): where Potential comes from and
 * what a step gives (docs/specs/ASCENSION.md §A).
 */
export function potentialDupesRule() {
  return `+1 Essence of her. Raise her Potential (P1 → P${MAX_POTENTIAL}) with 1 Essence and coins on her page: every step makes her stronger, opens her next level gate past 60, and from P3 (from P2 for SSR girls and heroes) teaches her a new trick, up to her P${MAX_POTENTIAL} capstone. She holds at most 6 − P Essence; a copy past that becomes Mementos and Moonpearls (for the Memento Exchange) and recruit points.`;
}

/** "1 more Essence" / "2 more Essence" (a duplicate gives 1). */
export const moreDupes = (n) => `${n} more Essence`;

/** The pill's tooltip: "Potential 5 of 6 — Moonpiercer" (her newest step), "Potential 1 of 6" at P1. */
export function potentialPillTitle(def, p) {
  const level = potentialClamp(p);
  const newest = level >= 2 ? potentialSteps(def)[level - 2]?.name : null;
  return `Potential ${level} of ${MAX_POTENTIAL}${newest ? ` — ${newest}` : ''}`;
}

/**
 * The six nodes for the UI (P1 = her base). `capAt(p)` (optional, src/systems/progression.js
 * potentialLevelCap) is her level cap at P: a node shows it beside its stat ("+4% SPD" "Lv 67",
 * src/ui/potential.js nodeLine) only when Potential raises it above her P1 cap, so the line reads
 * the level rule as it is. `line` is the same as one string (`+4% SPD · 67`).
 * @param {object} def
 * @param {object|null} unitState
 * @param {{ capAt?: (p: number) => number }} [o]
 * @returns {{ step: number, name: string|null, kind: string|null, kit: boolean, parts: object[], short: string, long: string, stat: string, cap: number|null, line: string, tags: string[], active: boolean, next: boolean }[]}
 */
export function potentialView(def, unitState, { capAt = null } = {}) {
  const owned = !!unitState;
  const level = owned ? potentialLevel(unitState) : 0;
  const base = capAt ? capAt(1) : null;
  const capOf = (p) => {
    const c = capAt ? capAt(p) : null;
    return typeof c === 'number' && typeof base === 'number' && c > base ? c : null;
  };
  const nodes = [{ step: 1, name: null, kind: null, kit: false, parts: [], short: 'Base', long: 'Her base (first copy)', stat: '', cap: null, line: '', tags: [], active: owned, next: !owned }];
  for (const s of potentialSteps(def)) {
    const parts = describePotentialStep(s, def);
    const stat = potentialStatLabel(s, def);
    const cap = capOf(s.step);
    nodes.push({
      step: s.step,
      name: s.name,
      kind: s.kind,
      kit: isKitStep(s),
      parts,
      short: parts.map((p) => p.short).join(' '),
      long: parts.map((p) => p.long).join(' '),
      stat,
      cap,
      line: [stat, cap != null ? String(cap) : ''].filter(Boolean).join(' · '),
      tags: potentialStepTags(s),
      active: owned && s.step <= level,
      next: owned && s.step === level + 1,
    });
  }
  return nodes;
}

const RARITY_RANK = { UR: 3, SSR: 2, SR: 1, R: 0 };

/**
 * What a recruit raised (a 10-pull, a spark, an SSR Select Ticket, a Mall exchange): per girl whose
 * Potential rose, from → to and the steps she reached. `cards`: the girls who reached a kit step
 * (the "Potential up!" cards), highest rarity first, then the highest P; `statOnly`: girls whose
 * rises were all stat steps (one "Also:" line).
 * @param {{ unitId: string, potential?: number, potentialUp?: boolean }[]} results in recruit order
 * @returns {{ girls: object[], cards: object[], statOnly: object[], steps: number, tricks: number }}
 */
export function potentialRises(results) {
  const by = new Map();
  (results || []).forEach((r, i) => {
    if (!r?.potentialUp || !(r.potential >= 2) || !UNIT_MAP[r.unitId]) return;
    const g = by.get(r.unitId) || { unitId: r.unitId, def: UNIT_MAP[r.unitId], from: MAX_POTENTIAL, to: 1, order: i };
    g.from = Math.min(g.from, potentialClamp(r.potential) - 1);
    g.to = Math.max(g.to, potentialClamp(r.potential));
    by.set(r.unitId, g);
  });
  const girls = [...by.values()].map((g) => {
    const steps = [];
    for (let p = g.from + 1; p <= g.to; p++) {
      const info = potentialStepInfo(g.def, p);
      if (info) steps.push(info);
    }
    const kit = steps.filter((s) => s.kit);
    return {
      ...g,
      steps,
      kit,
      newest: steps[steps.length - 1] || null,
      // the trick on her card: the newest kit step she reached
      shown: kit[kit.length - 1] || null,
      next: g.to < MAX_POTENTIAL ? potentialStepInfo(g.def, g.to + 1) : null,
      full: g.to >= MAX_POTENTIAL,
    };
  });
  const rank = (g) => RARITY_RANK[g.def.rarity] ?? 0;
  const cards = girls.filter((g) => g.kit.length).sort((a, b) => rank(b) - rank(a) || b.to - a.to || a.order - b.order);
  const statOnly = girls.filter((g) => !g.kit.length).sort((a, b) => a.order - b.order);
  return {
    girls,
    cards,
    statOnly,
    steps: girls.reduce((a, g) => a + g.steps.length, 0),
    tricks: girls.reduce((a, g) => a + g.kit.length, 0),
  };
}

/** One line for tooltips: the names of her active steps ("Night Drills, Shadow Edge, Shadow Tempo"), or ''. */
export function potentialSummary(def, p) {
  const level = potentialClamp(p);
  return potentialSteps(def).filter((s) => s.step <= level && s.name).map((s) => s.name).join(', ');
}

/**
 * Power factor of her active steps: Π of each step's `power` (src/data/potentialText.js, her scored
 * measure's paper size). A def without a text row: Π damageMul × Π rateMul × √Π rangeMul of her fold.
 */
export function potentialPowerFactor(def, p) {
  const level = potentialClamp(p);
  const row = potentialTextRow(def);
  if (row) {
    let f = 1;
    for (let k = 2; k <= level; k++) f *= row[k - 2]?.power ?? 1;
    return f;
  }
  const f = potentialFold(def, p);
  return f.damageMul * f.rateMul * Math.sqrt(f.rangeMul);
}

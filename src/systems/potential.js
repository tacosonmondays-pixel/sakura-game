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

/** Starters are owned from the start; no history entry can be their first copy. */
const STARTERS = ['hikari', 'aoi', 'rei'];

const whole = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/**
 * @param {object|null|undefined} unitState profile.units[id]
 * @returns {number} 1..6 (no state or no dupes → 1)
 */
export function potentialLevel(unitState) {
  return Math.min(MAX_POTENTIAL, 1 + whole(unitState?.dupes));
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

/**
 * The six nodes for the UI (P1 = her base).
 * @returns {{ step: number, name: string|null, kind: string|null, parts: object[], short: string, long: string, stat: string, active: boolean, next: boolean }[]}
 */
export function potentialView(def, unitState) {
  const owned = !!unitState;
  const level = owned ? potentialLevel(unitState) : 0;
  const nodes = [{ step: 1, name: null, kind: null, parts: [], short: 'Base', long: 'Her base (first copy)', stat: '', active: owned, next: !owned }];
  for (const s of potentialSteps(def)) {
    const parts = describePotentialStep(s, def);
    nodes.push({
      step: s.step,
      name: s.name,
      kind: s.kind,
      parts,
      short: parts.map((p) => p.short).join(' '),
      long: parts.map((p) => p.long).join(' '),
      stat: potentialStatLabel(s, def),
      active: owned && s.step <= level,
      next: owned && s.step === level + 1,
    });
  }
  return nodes;
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

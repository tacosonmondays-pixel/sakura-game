// Potential (owner: systems). See docs/specs/POTENTIAL.md.
//
// Every duplicate of an owned girl (a recruit, a spark, an SSR Select Ticket) adds 1 to
// `profile.units[id].dupes`; her Potential is `min(6, 1 + dupes)`. Each step P2…P6 is a small
// passive from src/data/potential.js, which the battle sim folds in (mods.js resolveStats) from
// `unitBattleStats().potential`. This file is outside the co-op graph: counting, the backfill and
// the one describer every screen uses (student page, battle panel, recruit, wiki, letter).
//
// The count is mirrored in `missions.counters['pot:<id>']` (with `'pot:at'` = when it last
// changed) because builds from before M0 drop `dupes` through their `cleanUnit` allowlist but
// keep `missions.counters` word for word: an out-of-date tab that saves cannot lower it.
// Saves from before M0 are credited once from the recruit history (`backfillDupes`).
//
// Pure functions; save.js and unlocks.js call them.

import { UNIT_MAP } from '../data/units.js';
import { MAX_POTENTIAL, potentialSteps, potentialFold, potentialClamp } from '../data/potential.js';

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
const pctAdd = (v) => `${Math.round(v * 1000) / 10}%`;

/**
 * Player-facing text for one step: short labels (≤ 9 characters, for the six-node track and
 * chips), long text (tooltips, wiki, letter) and who it helps (unit-info's Self / Allies tags).
 * @param {{ girl?: object|null, mods?: object|null }} step
 * @param {object} [def] for "(traps)" / "(drones too)"
 * @returns {{ short: string, long: string, who: 'self'|'allies'|'enemies' }[]}
 */
export function describePotentialStep(step, def = null) {
  const parts = [];
  const b = def?.base?.behavior;
  const where = b === 'trap' ? ' (traps)' : b === 'turret' ? ' (drones too)' : '';
  const g = step?.girl || {};
  const m = step?.mods || {};
  if (g.damageMul) parts.push({ short: `+${pct(g.damageMul)} DMG`, long: `+${pct(g.damageMul)} damage${where}`, who: 'self' });
  if (g.rateMul) parts.push({ short: `+${pct(g.rateMul)} SPD`, long: `+${pct(g.rateMul)} attack speed${b === 'turret' ? where : ''}`, who: 'self' });
  if (g.rangeMul) parts.push({ short: `+${pct(g.rangeMul)} RNG`, long: `+${pct(g.rangeMul)} range${b === 'turret' ? where : ''}`, who: 'self' });
  if (g.incomeMul) parts.push({ short: `+${pct(g.incomeMul)} COIN`, long: `+${pct(g.incomeMul)} coins per wave`, who: 'self' });
  if (m.crit?.chance) parts.push({ short: `+${pctAdd(m.crit.chance)} CRIT`, long: `+${pctAdd(m.crit.chance)} crit chance`, who: 'self' });
  if (m.eliteMul) parts.push({ short: `+${pct(m.eliteMul)} ELITE`, long: `+${pct(m.eliteMul)} damage to elites`, who: 'self' });
  if (m.bossMul) parts.push({ short: `+${pct(m.bossMul)} BOSS`, long: `+${pct(m.bossMul)} damage to bosses`, who: 'self' });
  if (m.aura?.dmgMul) parts.push({ short: `+${pct(m.aura.dmgMul)} AURA`, long: `aura +${pct(m.aura.dmgMul)} damage`, who: 'allies' });
  if (m.aura?.rateMul) parts.push({ short: `+${pct(m.aura.rateMul)} AURA`, long: `aura +${pct(m.aura.rateMul)} attack speed`, who: 'allies' });
  if (m.silence) parts.push({ short: `+${m.silence}s SIL`, long: `silence +${m.silence} s`, who: 'enemies' });
  if (m.ramp?.max) parts.push({ short: `+${pctAdd(m.ramp.max)} FOCUS`, long: `focus cap +${pctAdd(m.ramp.max)}`, who: 'self' });
  return parts;
}

/**
 * The six nodes for the UI (P1 = her base).
 * @returns {{ step: number, name: string|null, parts: object[], short: string, long: string, active: boolean, next: boolean }[]}
 */
export function potentialView(def, unitState) {
  const owned = !!unitState;
  const level = owned ? potentialLevel(unitState) : 0;
  const nodes = [{ step: 1, name: null, parts: [], short: 'Base', long: 'Her base (first copy)', active: owned, next: !owned }];
  for (const s of potentialSteps(def)) {
    const parts = describePotentialStep(s, def);
    nodes.push({
      step: s.step,
      name: s.name,
      parts,
      short: parts.map((p) => p.short).join(' '),
      long: parts.map((p) => p.long).join(', '),
      active: owned && s.step <= level,
      next: owned && s.step === level + 1,
    });
  }
  return nodes;
}

/** One line for tooltips: "+2% damage, +2% attack speed, +3% range" (every active step), or ''. */
export function potentialSummary(def, p) {
  const level = potentialClamp(p);
  return potentialSteps(def).filter((s) => s.step <= level).flatMap((s) => describePotentialStep(s, def).map((x) => x.long)).join(', ');
}

/** Power factor of her active whole-girl steps: Π damageMul × Π rateMul × √Π rangeMul. */
export function potentialPowerFactor(def, p) {
  const f = potentialFold(def, p);
  return f.damageMul * f.rateMul * Math.sqrt(f.rangeMul);
}

// Co-op plausibility clamp: every girl's battle stats in a start message are clamped to what an
// honest save can reach, with wide headroom, before either Sim reads them. The lobby (session.js
// begin) clamps the start message on both peers — the host's own and the one the guest receives —
// so both build their CoopSim from the same clamped message and stay in lockstep. A resync or a
// rejoin rebuilds from the host's start and checkpoint: the lockstep (clampStarts) clamps that start
// again and rebuilds any girl whose checkpointed stats are not what her clamped entry gives
// (lockstep.js rederiveStats). An honest loadout passes through unchanged (the identity). It closes
// the hole where a hand-edited peer could send `damageMul: 1000`. (Test harnesses and the
// cross-engine fixtures call createCoopSim / Lockstep directly with deliberately superhuman stats;
// they are not network input.)
//
// Ceilings (gear-awaken spec §9.1, kept by Potential v3 §2.2 / §4.7): the honest maximum with UR
// gear at level 85 is damageMul 7.57 and rateMul 3.10, so gear's 10 / 5 already fit; Potential adds
// one rule, `potential` an integer 1–6. Levels travel up to 85 (P6) and the rule allows 1–99, so a
// later level-cap retune needs no co-op id change. Every DEFAULT_UNIT_STATS key needs a rule
// (tests/online/coopStatLimits.test.js fails otherwise); keys without one are dropped.
// Part of the co-op compatibility id (session.js imports it).
import { DEFAULT_UNIT_STATS } from '../../sim/constants.js';
import { MAX_POTENTIAL } from '../../data/potential.js';
import { COOP } from '../../data/coop.js';
import { SIM_CLUB_IDS, PIERCE_K_MAX } from '../../sim/gearRules.js';

const num = (lo, hi) => Object.freeze({ type: 'num', lo, hi });
const int = (lo, hi) => Object.freeze({ type: 'int', lo, hi });
const BOOL = Object.freeze({ type: 'bool' });
const oneOf = (list) => Object.freeze({ type: 'enum', list: Object.freeze([...list]) });

/** One rule per stat key a loadout may carry (unitBattleStats' keys). */
export const UNIT_STAT_LIMITS = Object.freeze({
  // [banners G6] UR Resonance (×1.10) and the LR boost (×1.15) on top of UR gear at level 85: honest max ≈ 9.6
  damageMul: num(0, 15),
  rateMul: num(0, 5),
  rangeMul: num(0, 3),
  critChance: num(0, 0.75),
  critMul: num(1, 6),
  armorPen: num(0, 50),
  costMul: num(0.75, 1),
  ultHaste: num(0, 0.5),
  // gear (docs/specs/GEAR_STATS.md §F.2): Pierce in hundredths (capped at source at 150), Aura Power
  // (15 % lines + 5 % fill), the aura girls' fill-in radius, gear ATK's share of burns, her club set,
  // and the UR pieces she wears (the renderer's rainbow sparkles; the sim never reads it)
  pierceK: int(0, PIERCE_K_MAX + 50),
  // Aura Power 0.3 grown by UR Resonance and LR (×1.10 · ×1.15 of 1 + Aura Power): honest max ≈ 0.64
  auraPct: num(0, 0.75),
  auraRangeMul: num(1, 1.2),
  dotMul: num(1, 1.5),
  club: oneOf(SIM_CLUB_IDS),
  clubN: int(0, 3),
  rainbow: int(0, 3),
  awakenPassive: BOOL,
  level: int(1, 99),
  awaken: int(0, 5),
  // the sim never reads it; room for a later ascension's gates 6–10
  breakthrough: int(0, 10),
  // Potential v3: P1…P6
  potential: int(1, MAX_POTENTIAL),
  // [banners G6] LR (Limit Break): her LR ability form
  lr: BOOL,
});

/** Most loadout entries one player may bring (her towers, one more when she brings no hero). */
export const LOADOUT_MAX = COOP.towersPerPlayer + 1;

const fallback = (key, rule) => (key in DEFAULT_UNIT_STATS ? DEFAULT_UNIT_STATS[key] : rule.type === 'int' ? rule.lo : 0);

function clampOne(key, rule, v) {
  if (rule.type === 'bool') return v === true;
  if (rule.type === 'enum') return rule.list.includes(v) ? v : null;
  let n = typeof v === 'number' ? v : Number.NaN;
  if (!Number.isFinite(n)) return fallback(key, rule);
  if (rule.type === 'int') n = Math.floor(n);
  return Math.min(rule.hi, Math.max(rule.lo, n));
}

/**
 * @param {object} stats a loadout entry's stats (unitBattleStats' shape)
 * @returns {object} the same keys in the same order, each clamped by its rule; unknown keys dropped;
 *   a missing stats object stays missing (the Sim uses DEFAULT_UNIT_STATS)
 */
export function clampUnitStats(stats) {
  if (stats == null) return stats;
  if (typeof stats !== 'object' || Array.isArray(stats)) return {};
  const out = {};
  for (const [k, v] of Object.entries(stats)) {
    const rule = Object.prototype.hasOwnProperty.call(UNIT_STAT_LIMITS, k) ? UNIT_STAT_LIMITS[k] : null;
    if (rule) out[k] = clampOne(k, rule, v);
  }
  return out;
}

/** A loadout entry with its stats clamped (null for a malformed entry). */
export function clampEntry(e) {
  if (!e || typeof e !== 'object' || typeof e.unitId !== 'string') return null;
  return 'stats' in e ? { ...e, stats: clampUnitStats(e.stats) } : { ...e };
}

/** A start message's player with her loadout capped at LOADOUT_MAX and every stat clamped. */
export function clampPlayer(p) {
  const loadout = (Array.isArray(p?.loadout) ? p.loadout : []).slice(0, LOADOUT_MAX).map(clampEntry).filter(Boolean);
  return { ...p, loadout, hero: p?.hero ? clampEntry(p.hero) : null };
}

/**
 * A start message with every player clamped (clampPlayer); the rest of the message as it was.
 * Idempotent, so a start that was clamped once (a resync, a rejoin) stays the same.
 */
export function clampStart(start) {
  if (!start || typeof start !== 'object' || !Array.isArray(start.players)) return start;
  return { ...start, players: start.players.map((p) => (p && typeof p === 'object' ? clampPlayer(p) : p)) };
}

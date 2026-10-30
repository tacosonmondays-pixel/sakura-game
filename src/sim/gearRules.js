// Gear in battle (docs/specs/GEAR_STATS.md §A.3, §A.4, §B.3, §B.4, §C.3): Pierce on every kit, the Academy
// Club tricks and Skill Haste's reach to tower abilities. Part of the co-op hash. Integers only on the
// battle side (Pierce travels as `pierceK`, whole hundredths; carries and trick counters are integers),
// no rng draw anywhere, so every engine and every peer runs it the same.

import { setPassive, ABIL_HASTE_CEIL } from './setRules.js';

/** Club ids in the save's index order (the menu-side CLUB_IDS; tests/sim/gearSim.test.js keeps the two lists equal). */
export const SIM_CLUB_IDS = Object.freeze(['archery', 'fencing', 'taiko', 'pyro', 'tea', 'bell']);

/** Gear Pierce reaches these single-target pierce-1 shooters at half rate (and at most +1 a shot). */
export const PIERCE_HALF = Object.freeze({ shiro: true, momo: true, miko: true });
/** Most extra targets one shot / beam / chain gets from gear Pierce (half-rate kits: 1). */
export const PIERCE_MAX_EXTRA = 2;
/** A sweep (pulse) takes 2 more targets per 100 % Pierce; its carry runs on 2k, up to this many extra. */
export const PULSE_MAX_EXTRA = 4;
/** Blasts and traps: radius × (1 + this × Pierce). */
export const BLAST_PER_PIERCE = 0.2;
/** Gear Pierce cap in hundredths (the battle stats cap it at source; this guards a hand-made loadout). 300: five Blank LR. */
export const PIERCE_K_MAX = 300;

/** Club tricks (3 pieces of one club). */
export const TRICK = Object.freeze({
  followThrough: { club: 'archery', every: 5, pierceK: 100 },
  thrust: { club: 'fencing', every: 25, mul: 2 },
  bigBeat: { club: 'taiko', every: 10, mul: 1.5 },
  finalePop: { club: 'pyro', share: 0.25, radius: 0.9 },
  secondCup: { club: 'tea', rateMul: 1.02, near: 2, nearest: 2 },
  firstBell: { club: 'bell', charge: 0.1 },
});
/** Finale Pop's one budget for the whole battle, in half-pops: +1 a step, at most 12 (6 pops) banked. */
export const POP_BUDGET_MAX = 12;
export const POP_COST = 2;
/** Armor a Finishing Thrust ignores (added to the hit's armor pierce). */
export const THRUST_PEN = 1e6;

/** The club trick she runs (her 3-piece set), or null. */
export const trickClub = (us) => (us && us.clubN >= 3 && SIM_CLUB_IDS.includes(us.club) ? us.club : null);

/**
 * Pierce carry step: k hundredths accumulate and every full 100 is one more target, so every peer gets the
 * same extra target on the same attacks. Mutates `holder[key]`. @returns {number} extra targets
 */
export function pierceCarry(holder, key, k, maxExtra) {
  if (!(k > 0)) return 0;
  const carry = (holder[key] || 0) + k;
  const extra = Math.min(maxExtra, Math.floor(carry / 100));
  holder[key] = Math.min(99, carry - 100 * extra);
  return extra;
}

/** Her gear Pierce in hundredths for one attack (Follow-Through adds 100 after the cap), at her kit's rate. */
export function pierceK(t, followThrough = false) {
  const base = Math.min(PIERCE_K_MAX, Math.max(0, Math.floor(t.unitStats?.pierceK || 0)));
  const k = base + (followThrough ? TRICK.followThrough.pierceK : 0);
  return PIERCE_HALF[t.unitId] ? Math.round(k / 2) : k;
}

/** Most extra targets her shots get. */
export const pierceMax = (t) => (PIERCE_HALF[t.unitId] ? 1 : PIERCE_MAX_EXTRA);

/**
 * Follow-Through on a blast or a trap (§A.3, §C.2): her radius on that attack over her usual one. Her blast
 * is already × (1 + 0.2 × Pierce) (mods.js applyGearReach); the trick's +100 % sits after the cap, so the
 * attack blasts at × (1 + 0.2 × (Pierce + 1)): (100 + 0.2 × (k + 100)) / (100 + 0.2 × k), k her capped
 * `pierceK`. 1.2 with no gear Pierce, about 1.15 at the cap. One division, no engine maths.
 */
export function followThroughBlast(unitStats) {
  const k = Math.min(PIERCE_K_MAX, Math.max(0, Math.floor(unitStats?.pierceK || 0)));
  return (100 + BLAST_PER_PIERCE * (k + TRICK.followThrough.pierceK)) / (100 + BLAST_PER_PIERCE * k);
}

// ---------------------------------------------------------------------------
// Skill Haste on tower abilities (§B.4; the ⚡ abilities themselves are built by the abilities track)
// ---------------------------------------------------------------------------

/** Ability kinds that lift the whole board: never hasted (a fast Moonbrand would be a free boss multiplier). */
export const NOT_HASTED_KINDS = Object.freeze(['rally', 'debuff']);
/** Abilities and hero skills take this share of her Skill Haste (hero ults keep all of it). */
export const ABILITY_HASTE_SHARE = 0.5;
/** Skill Haste cap for hero ults and abilities (the battle stats cap it at source too; LR gear raises it, ≤ 75 %). */
export const SKILL_HASTE_CAP = 0.75;
/** Charge points an ability gains per tick with no haste (the abilities spec's integer charge). */
export const ABILITY_CHARGE_BASE = 100;

/**
 * Skill Haste an ability of `kind` gets from her unit stats: half her (capped) Skill Haste, none for rallies and
 * debuffs. Her unit stats carry it as `abilHaste` (GEAR_UPDATE.md §3.2: Power Bank's set cap gives it half of her
 * whole Skill Haste, so a hero's ult never reads the uncapped value); without the key, half of her `ultHaste`.
 * @returns {number} 0 … ABIL_HASTE_CEIL
 */
export function abilityHaste(unitStats, kind = null) {
  if (kind && NOT_HASTED_KINDS.includes(kind)) return 0;
  const a = Number(unitStats?.abilHaste) || 0;
  if (a > 0) return Math.min(ABIL_HASTE_CEIL, a);
  const h = Math.min(SKILL_HASTE_CAP, Math.max(0, Number(unitStats?.ultHaste) || 0));
  return ABILITY_HASTE_SHARE * h;
}

/**
 * Integer charge points an ability of `kind` gains per tick: round(100 / (1 − haste) × Supercharge). 100 with no haste
 * and no Power Bank set; at most 400 × 1.2. Deterministic on every engine (one division, one round).
 */
export function abilityChargePerTick(unitStats, kind = null) {
  const h = abilityHaste(unitStats, kind);
  const sc = kind && NOT_HASTED_KINDS.includes(kind) ? null : setPassive(unitStats, 'powerbank');
  const base = h > 0 ? ABILITY_CHARGE_BASE / (1 - h) : ABILITY_CHARGE_BASE;
  return sc ? Math.round(base * (1 + sc.charge)) : h > 0 ? Math.round(base) : ABILITY_CHARGE_BASE;
}

/** Power Bank's Supercharge on her ability's damage (1 without the set). */
export function superchargeMul(unitStats) {
  const sc = setPassive(unitStats, 'powerbank');
  return sc ? 1 + sc.dmg : 1;
}

/** First Bell (Bell Club, with the abilities): charge points her hasted abilities start a wave with. */
export function firstBellCharge(unitStats, fullCharge, kind = null) {
  if (kind && NOT_HASTED_KINDS.includes(kind)) return 0;
  // Supercharge · Nightglass (the Power Bank LR Set Form) starts every wave charged too
  const sc = setPassive(unitStats, 'powerbank');
  const lr = sc && sc.start > 0 ? Math.floor(fullCharge * sc.start) : 0;
  if (trickClub(unitStats) !== TRICK.firstBell.club) return lr;
  return Math.floor(fullCharge * TRICK.firstBell.charge) + lr;
}

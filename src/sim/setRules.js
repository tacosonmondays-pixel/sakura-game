// Gear sets in battle (docs/specs/GEAR_UPDATE.md §2.4, §3.2, §3.4, §4.5). Part of the co-op hash. A girl's set
// travels in her unit stats as `set` (the set id when she wears 4+ pieces of it, else null), `setN` (4 or 5) and
// `setLr` (all five pieces LR of that set: its LR Set Form, from LR gear); her support stats as `buffDurMul` and
// `controlMul`. Integer counters and step timers only, no rng draw anywhere: a sure crit and a super crit reuse
// each hit's one crit draw (Sim._hit), so every engine and every peer runs it the same.

/** Set ids in the save's order (the menu-side SET_IDS, src/data/gearSets.js; a test keeps the two lists equal). */
export const SIM_SET_IDS = Object.freeze(['spirit', 'freezetag', 'geometry', 'popper', 'treasurer', 'powerbank']);

/**
 * Each set's passive: 4 pieces, 5 pieces and the LR Set Form (five LR pieces of the set). Spec numbers; the measured
 * gates (§8.4) tune them before they ship.
 *   spirit     Big Cheer: every `every` s the girls in her aura (no aura: her `nearest` nearest within `near` tiles) deal
 *              ×(1 + bonus) for `dur` s (a rally: the strongest wins; Skill Haste never speeds it; Buff Duration does)
 *   freezetag  You're It: an enemy under her control takes ×(1 + bonus) from every girl while it lasts (bosses and
 *              minibosses `boss`); the LR form's control also lasts ×`control` longer
 *   geometry   Right Angle: every `every`-th attack is a sure crit, ×`mul` on top of her crit
 *   popper     Confetti Burst: every `every`-th attack bursts on the other enemies within `radius` tiles of the one
 *              it hit, for `share` of the hit (never crits, never chains, Finale Pop's kind of budget)
 *   treasurer  Bake Sale: her coins (kills and a coin-maker's own coins) × (1 + share); the LR form's first upgrade
 *              each wave costs `firstBuy` less
 *   powerbank  Supercharge: her ⚡ ability (a hero's skill) deals ×(1 + dmg) and charges ×(1 + charge) faster; the LR
 *              form starts every wave `start` charged
 */
export const SET_PASSIVES = Object.freeze({
  spirit: Object.freeze({
    4: Object.freeze({ every: 20, bonus: 0.12, dur: 5 }), 5: Object.freeze({ every: 20, bonus: 0.16, dur: 6 }), lr: Object.freeze({ every: 15, bonus: 0.2, dur: 7 }),
  }),
  freezetag: Object.freeze({
    4: Object.freeze({ bonus: 0.06, boss: 0.03 }), 5: Object.freeze({ bonus: 0.08, boss: 0.04 }), lr: Object.freeze({ bonus: 0.1, boss: 0.05, control: 1.15 }),
  }),
  geometry: Object.freeze({
    4: Object.freeze({ every: 4, mul: 1 }), 5: Object.freeze({ every: 4, mul: 1.2 }), lr: Object.freeze({ every: 3, mul: 1.3 }),
  }),
  popper: Object.freeze({
    4: Object.freeze({ every: 6, share: 0.5, radius: 1 }), 5: Object.freeze({ every: 5, share: 0.6, radius: 1 }), lr: Object.freeze({ every: 4, share: 0.75, radius: 1.3 }),
  }),
  treasurer: Object.freeze({
    4: Object.freeze({ share: 0.1 }), 5: Object.freeze({ share: 0.15 }), lr: Object.freeze({ share: 0.2, firstBuy: 0.1 }),
  }),
  powerbank: Object.freeze({
    4: Object.freeze({ dmg: 0.15, charge: 0.1 }), 5: Object.freeze({ dmg: 0.25, charge: 0.15 }), lr: Object.freeze({ dmg: 0.35, charge: 0.2, start: 0.2 }),
  }),
});

/** Big Cheer with no aura: her nearest girls within this many tiles (ties by lower uid). */
export const CHEER_NEAR = 2;
export const CHEER_NEAREST = 2;
/** Confetti Burst's battle-wide budget in half-bursts: +1 a step, at most this many banked. */
export const BURST_BUDGET_MAX = 12;
export const BURST_COST = 2;

/** Crit chance above 100 %: the part over 1 is the chance of a super crit, a crit that hits ×SUPER_CRIT_MUL again. */
export const SUPER_CRIT_MUL = 1.5;
/** Crit chance counts up to this (every hit a super crit). */
export const CRIT_CEIL = 2;
/** Treasurer's set cap lifts her interest's 150-coin cap, up to this a wave (a maths ceiling: review r2 L16). */
export const INTEREST_SET_CEIL = 5000;
/** Her ⚡ ability's haste never passes this (charge ×4, so 100 / (1 − h) never divides by zero). */
export const ABIL_HASTE_CEIL = 0.75;
/** Party Popper's set cap: her blasts read her whole Pierce, up to this many hundredths (radius ×2.0). */
export const BLAST_K_MAX = 500;
/** Control Strength in battle never passes this (Freeze Tag's set cap; boss resistance and the CC budget still apply). */
export const CONTROL_MUL_MAX = 4;

/** Status types Control Strength lengthens (a slow's strength never changes). */
export const CONTROL_TYPES = Object.freeze({ slow: true, freeze: true, stun: true, shock: true, ground: true, hold: true });

/**
 * Her set passive's numbers, or null: 4 or 5 pieces of a known set, the LR Set Form when `setLr`.
 * @param {object} us her unit stats
 */
export function setPassive(us, setId = null) {
  if (!us || !SIM_SET_IDS.includes(us.set) || !(us.setN >= 4) || (setId && us.set !== setId)) return null;
  const row = SET_PASSIVES[us.set];
  return us.setLr && us.setN >= 5 ? row.lr : row[us.setN >= 5 ? 5 : 4];
}

/** Her Buff Duration multiplier (1 with none). */
export const buffDur = (us) => (us && us.buffDurMul > 1 ? us.buffDurMul : 1);

/** Her Control Strength multiplier on her control statuses (the LR You're It form adds its own). */
export function controlMulOf(us) {
  let m = us && us.controlMul > 1 ? us.controlMul : 1;
  const p = setPassive(us, 'freezetag');
  if (p && p.control) m *= p.control;
  return Math.min(CONTROL_MUL_MAX, m);
}

/** Her You're It bonus (0 without the set). */
export function itBonusOf(us) {
  const p = setPassive(us, 'freezetag');
  return p ? p.bonus : 0;
}

/**
 * Every call site that applies a status sets three context fields from the girl who applies it (GEAR_UPDATE.md
 * §2.4): `sourceUid`, `controlMul` (1 for anything that is not a girl) and `itBonus` (0 likewise). Returns `ctx`.
 * @param {object} ctx the status context (often the sim's shared one)
 * @param {{ uid?: number, unitStats?: object }|null} source the girl or hero, or null
 */
export function statusCtxFor(ctx, source) {
  ctx.sourceUid = source ? source.uid ?? null : null;
  const us = source ? source.unitStats : null;
  ctx.controlMul = controlMulOf(us);
  ctx.itBonus = itBonusOf(us);
  return ctx;
}

/**
 * Her crit chance's ceiling: CRIT_CEIL (super crits) with Geometry Set's 5-piece set cap or five Blank LR pieces
 * (`critCeil` 2 from her unit stats), 1 for everyone else, so no kit's own crit plus an aura passes 100 % without them
 * (review r2 L15).
 */
export const critCeilOf = (us) => (us && (us.critCeil >= CRIT_CEIL || (us.set === 'geometry' && us.setN >= 5)) ? CRIT_CEIL : 1);

/**
 * Crit chance → the spec's crit chance (≤ 1) and super-crit chance (the part over 1, ≤ 1) under her ceiling.
 * @returns {[number, number]}
 */
export function splitCrit(chance, ceil = CRIT_CEIL) {
  const c = Math.min(ceil, Math.max(0, chance || 0));
  return [Math.min(1, c), Math.max(0, c - 1)];
}

/**
 * Her average crit factor on damage that cannot crit (traps that never crit, burns and poisons): deterministic, no draw
 * (GEAR_UPDATE.md §8.3 lever 1). c her crit chance (up to CRIT_CEIL), k her crit hit multiplier.
 */
export function averageCrit(c, k) {
  const cc = Math.min(CRIT_CEIL, Math.max(0, c || 0));
  const kk = Math.max(1, k || 1);
  return 1 + Math.min(1, cc) * (kk - 1) + Math.max(0, Math.min(1, cc - 1)) * kk * (SUPER_CRIT_MUL - 1);
}

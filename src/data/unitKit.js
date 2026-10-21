// Builders for the roster expansion (owner: units; docs/merge/ROSTER_SPEC.md §5.1). Copies of the
// helpers in src/data/units.js (that file keeps its own; a later cleanup may switch it over) plus the
// statuses of the roster mechanics: ground (flyers knocked down), curse (bursts and spreads on
// death), mark (a team damage bonus) and hex (a share of max HP per second). Plain data, no side effects.

/** StatusSpec builders. `chance` is omitted when it is 1 (the contract default). */
const withChance = (spec, chance) => (chance != null && chance < 1 ? { ...spec, chance } : spec);
export const S = {
  slow: (amount, duration, chance) => withChance({ type: 'slow', amount, duration }, chance),
  freeze: (duration, chance) => withChance({ type: 'freeze', duration }, chance),
  stun: (duration, chance) => withChance({ type: 'stun', duration }, chance),
  shock: (duration, chance) => withChance({ type: 'shock', duration }, chance),
  burn: (dps, duration, chance) => withChance({ type: 'burn', dps, duration }, chance),
  poison: (dps, duration, chance) => withChance({ type: 'poison', dps, duration }, chance),
  shred: (amount, duration, chance) => withChance({ type: 'shred', amount, duration }, chance),
  vulnerable: (bonus, duration, chance) => withChance({ type: 'vulnerable', bonus, duration }, chance),
  soak: (duration, chance) => withChance({ type: 'soak', duration }, chance),
  silence: (duration, chance) => withChance({ type: 'silence', duration }, chance),
  reveal: (duration, chance) => withChance({ type: 'reveal', duration }, chance),
  /** Knocks a flyer down for `duration` s (ground-only attacks can hit it; bosses 25%). */
  ground: (duration, chance) => withChance({ type: 'ground', duration }, chance),
  /** On death the enemy bursts for burstMul × the cursing hit within `radius` and spreads a weaker curse. */
  curse: (burstMul, radius, duration, chance) => withChance({ type: 'curse', burstMul, radius, duration }, chance),
  /** +bonus damage taken from everyone for `duration` s. */
  mark: (bonus, duration) => ({ type: 'mark', bonus, duration }),
  /** pct of max HP per second for `duration` s, no regen (less on minibosses and bosses). */
  hex: (pct, duration) => ({ type: 'hex', pct, duration }),
  /** Cannot move for `duration` s (Chigusa's vines): minibosses resist; bosses and flyers are immune. */
  hold: (duration) => ({ type: 'hold', duration }),
};

/** Full BaseStats with contract defaults; `o` overrides. */
export function stats(o) {
  return {
    cost: 0,
    behavior: 'projectile',
    damage: 0,
    rate: 1,
    range: 3,
    projectiles: 1,
    pierce: 1,
    splash: 0,
    chain: 0,
    maxTargets: 99,
    projectileSpeed: 14,
    armorPen: 0,
    canHitAir: true,
    detection: false,
    eliteMul: 1,
    bossMul: 1,
    barrierMul: 1,
    silence: 0,
    reveal: 0,
    knockback: 0,
    ...o,
    status: o.status ? o.status : [],
    crit: { chance: 0, mul: 1.5, ...(o.crit || {}) },
  };
}

export const tier = (name, cost, desc, mods) => ({ name, cost, desc, mods });
export const path = (id, name, focus, tiers) => ({ id, name, focus, tiers });
export const free = (afterStage, note) => ({ type: 'free', afterStage, note });
export const STARTER = { type: 'starter' };
export const GACHA_ONLY = { type: 'gacha' };

// Potential steps (owner: systems; spec docs/specs/POTENTIAL.md §3). Every duplicate of an owned
// girl raises her Potential by 1, from P1 (her first copy) to P6; each step P2…P6 turns on one
// small passive from this file. In the co-op graph: src/sim/mods.js resolveStats folds the steps
// in, and src/online/coop/version.js hashes the three tables, so two builds with different steps
// cannot pair.
//
// A step is `{ girl?, mods? }`:
//   girl  whole-girl multipliers (POTENTIAL_GIRL_KEYS). They multiply into her unit stats exactly
//         like her level and gear (mods.js applyUnitStats), so they reach her traps and drones and
//         are the same size at level 1 and level 60; incomeMul multiplies income.perWave after
//         every upgrade.
//   mods  a ModSet applied after the awaken passive, restricted to POTENTIAL_MOD_KEYS.
// Every step is relative on purpose: a flat bonus (range, trap damage, armor ignore, coins) is
// huge where the base is small and nothing at endgame (spec §3.2 lists the banned keys).
//
// P2…P5 come from her role category's ladder unless her row replaces a step; P6 is her own
// signature. Every girl has a row (tests/data/potential.test.js); a kit variant may have its
// own (`id@kitStyle`). Deterministic: products of constants, no transcendental math.
import { ROLES } from './types.js';

export const MAX_POTENTIAL = 6;
export const POTENTIAL_GIRL_KEYS = Object.freeze(['damageMul', 'rateMul', 'rangeMul', 'incomeMul']);
export const POTENTIAL_MOD_KEYS = Object.freeze(['crit.chance', 'eliteMul', 'bossMul', 'aura.dmgMul', 'aura.rateMul', 'silence', 'ramp.max']);

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

const DMG2 = { girl: { damageMul: 1.02 } };
const DMG3 = { girl: { damageMul: 1.03 } };
const SPD2 = { girl: { rateMul: 1.02 } };
const SPD3 = { girl: { rateMul: 1.03 } };
const RNG3 = { girl: { rangeMul: 1.03 } };
const COIN2 = { girl: { incomeMul: 1.02 } };
const CRIT2 = { mods: { crit: { chance: 0.02 } } };

const DPS_LADDER = [DMG2, SPD2, RNG3, DMG3];
const CONTROL_LADDER = [RNG3, SPD2, DMG3, SPD2];

/** P2, P3, P4, P5 by role category (`hero` for heroes). */
export const POTENTIAL_LADDERS = deepFreeze({
  dps: DPS_LADDER,
  frag: DPS_LADDER,
  hero: DPS_LADDER,
  control: CONTROL_LADDER,
  support: CONTROL_LADDER,
  economy: [SPD3, COIN2, RNG3, DMG3],
});

/** Signature for a def without a row: fixtures and dev units only (a test requires every shipped girl's row). */
export const POTENTIAL_SIGNATURE_DEFAULT = deepFreeze({
  dps: { name: 'Full Bloom', girl: { damageMul: 1.03 } },
  frag: { name: 'Full Bloom', girl: { damageMul: 1.03 } },
  hero: { name: 'Full Bloom', girl: { damageMul: 1.03 } },
  control: { name: 'Full Bloom', girl: { rateMul: 1.03 } },
  support: { name: 'Full Bloom', girl: { rateMul: 1.03 } },
  economy: { name: 'Full Bloom', girl: { incomeMul: 1.03 } },
});

/**
 * One row per girl: `p6` (her signature, with a name) and optionally `p2`…`p5` replacing a
 * ladder step. Keys `id` or `id@kitStyle`.
 */
export const POTENTIAL_GIRLS = deepFreeze({
  hikari: { p6: { name: 'First Light', mods: { crit: { chance: 0.03 } } } },
  luna: { p6: { name: 'Moonwake', mods: { eliteMul: 1.05 } } },
  nami: { p6: { name: 'Neap Tide', mods: { bossMul: 1.05 } } },
  aoi: { p6: { name: "Fletcher's Focus", mods: { crit: { chance: 0.03 } } } },
  // melee: range is worth 3–4× its paper value against a walking boss, so crit instead (spec §3.3)
  rei: { p4: CRIT2, p6: { name: 'Iron Edge', mods: { eliteMul: 1.05 } } },
  yuki: { p6: { name: 'Powder Snow', girl: { rangeMul: 1.04 } } },
  momo: { p6: { name: 'Lucky Coin', girl: { incomeMul: 1.03 } } },
  akane: { p6: { name: 'Bonfire Night', girl: { rateMul: 1.03 } } },
  sango: { p6: { name: 'Coral Drill', mods: { eliteMul: 1.05 } } },
  kage: { p6: { name: 'Moonless Strike', mods: { eliteMul: 1.05 } } },
  // aura steps are budgeted team-wide: +1 % at P4 and +1 % at P6 for every girl in her aura
  umeko: { p4: { mods: { aura: { rateMul: 1.01 } } }, p6: { name: 'Spring Breeze', mods: { aura: { rateMul: 1.01 } } } },
  shiro: { p4: CRIT2, p6: { name: 'Big Game', mods: { bossMul: 1.05 } } },
  midori: { p6: { name: 'Quick Brew', girl: { rateMul: 1.03 } } },
  suzu: { p6: { name: 'Silver Bells', girl: { damageMul: 1.03 } } },
  raika: { p6: { name: 'Static Charge', girl: { damageMul: 1.03 } } },
  miko: { p4: { mods: { aura: { dmgMul: 1.01 } } }, p6: { name: 'Festival Blessing', mods: { aura: { dmgMul: 1.01 } } } },
  hotaru: { p6: { name: 'Quiet Lantern', mods: { silence: 0.1 } } },
  kaede: { p6: { name: 'Maple Focus', mods: { ramp: { max: 0.05 } } } },
  chika: { p6: { name: 'Overclocked Drones', girl: { rateMul: 1.03 } } },
});

/** @returns {string} the def's ladder category */
export function potentialCategory(def) {
  if (def?.kind === 'hero') return 'hero';
  return ROLES[def?.role]?.category || 'dps';
}

/** @returns {object|null} the def's own row (kit variant first), or null */
export function potentialRow(def) {
  if (!def) return null;
  if (def.kitStyle && POTENTIAL_GIRLS[`${def.id}@${def.kitStyle}`]) return POTENTIAL_GIRLS[`${def.id}@${def.kitStyle}`];
  return POTENTIAL_GIRLS[def.id] || null;
}

/**
 * The five steps of a def, P2…P6. `def.potential` (fixtures) wins over the tables.
 * @returns {{ step: number, name: string|null, girl: object|null, mods: object|null }[]}
 */
export function potentialSteps(def) {
  const cat = potentialCategory(def);
  const row = def?.potential || potentialRow(def) || {};
  const ladder = POTENTIAL_LADDERS[cat] || POTENTIAL_LADDERS.dps;
  const out = [];
  for (let step = 2; step <= MAX_POTENTIAL; step++) {
    const s = row[`p${step}`] || (step < MAX_POTENTIAL ? ladder[step - 2] : POTENTIAL_SIGNATURE_DEFAULT[cat] || POTENTIAL_SIGNATURE_DEFAULT.dps);
    out.push({ step, name: step === MAX_POTENTIAL ? s.name || null : null, girl: s.girl || null, mods: s.mods || null });
  }
  return out;
}

/** Potential from a battle-stats value: whole 1…6; anything not a finite number counts as P1. */
export function potentialClamp(p) {
  if (typeof p !== 'number' || !Number.isFinite(p)) return 1;
  return Math.min(MAX_POTENTIAL, Math.max(1, Math.floor(p)));
}

const NEUTRAL = Object.freeze({ level: 1, damageMul: 1, rateMul: 1, rangeMul: 1, incomeMul: 1, sets: Object.freeze([]) });
const memo = new WeakMap();

/**
 * Everything P2…P(p) adds, folded: the whole-girl multipliers multiplied together (in step order)
 * and the ModSets in step order. P1 and anything that is not a number → neutral.
 * @returns {{ level: number, damageMul: number, rateMul: number, rangeMul: number, incomeMul: number, sets: object[] }}
 */
export function potentialFold(def, p) {
  const level = potentialClamp(p);
  if (level < 2 || !def || typeof def !== 'object') return NEUTRAL;
  let slots = memo.get(def);
  if (!slots) memo.set(def, (slots = new Array(MAX_POTENTIAL + 1).fill(null)));
  if (slots[level]) return slots[level];
  const f = { level, damageMul: 1, rateMul: 1, rangeMul: 1, incomeMul: 1, sets: [] };
  for (const s of potentialSteps(def)) {
    if (s.step > level) break;
    if (s.girl) for (const k of POTENTIAL_GIRL_KEYS) if (typeof s.girl[k] === 'number') f[k] *= s.girl[k];
    if (s.mods) f.sets.push(s.mods);
  }
  Object.freeze(f.sets);
  return (slots[level] = Object.freeze(f));
}

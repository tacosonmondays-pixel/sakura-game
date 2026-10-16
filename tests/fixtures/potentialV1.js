// Potential v1 (the "small passives" ladder live in v0.1.34–v0.1.35, `src/data/potential.js` at
// c4f2220), kept as test data only: gate B6 (docs/specs/POTENTIAL.md v3 §12–§13.1) runs every girl
// with these steps and with v3's and checks that v3 never does less, so "nothing got weaker" holds
// for the players who had v1. `v1Def(def)` gives a def whose `potential` row (fixtures win in
// src/data/potential.js potentialSteps) is her v1 row P2…P6.
import { ROLES } from '../../src/data/types.js';

const DMG2 = { girl: { damageMul: 1.02 } };
const DMG3 = { girl: { damageMul: 1.03 } };
const SPD2 = { girl: { rateMul: 1.02 } };
const SPD3 = { girl: { rateMul: 1.03 } };
const RNG3 = { girl: { rangeMul: 1.03 } };
const COIN2 = { girl: { incomeMul: 1.02 } };
const CRIT2 = { mods: { crit: { chance: 0.02 } } };
const DPS = [DMG2, SPD2, RNG3, DMG3];
const CONTROL = [RNG3, SPD2, DMG3, SPD2];
const LADDERS = { dps: DPS, frag: DPS, hero: DPS, control: CONTROL, support: CONTROL, economy: [SPD3, COIN2, RNG3, DMG3] };
const SIGNATURE_DEFAULT = {
  dps: { name: 'Full Bloom', girl: { damageMul: 1.03 } },
  frag: { name: 'Full Bloom', girl: { damageMul: 1.03 } },
  hero: { name: 'Full Bloom', girl: { damageMul: 1.03 } },
  control: { name: 'Full Bloom', girl: { rateMul: 1.03 } },
  support: { name: 'Full Bloom', girl: { rateMul: 1.03 } },
  economy: { name: 'Full Bloom', girl: { incomeMul: 1.03 } },
};
const GIRLS = {
  hikari: { p6: { mods: { crit: { chance: 0.03 } } } },
  luna: { p6: { mods: { eliteMul: 1.05 } } },
  nami: { p6: { mods: { bossMul: 1.05 } } },
  aoi: { p6: { mods: { crit: { chance: 0.03 } } } },
  rei: { p4: CRIT2, p6: { mods: { eliteMul: 1.05 } } },
  yuki: { p6: { girl: { rangeMul: 1.04 } } },
  momo: { p6: { girl: { incomeMul: 1.03 } } },
  akane: { p6: { girl: { rateMul: 1.03 } } },
  sango: { p6: { mods: { eliteMul: 1.05 } } },
  kage: { p6: { mods: { eliteMul: 1.05 } } },
  umeko: { p4: { mods: { aura: { rateMul: 1.01 } } }, p6: { mods: { aura: { rateMul: 1.01 } } } },
  shiro: { p4: CRIT2, p6: { mods: { bossMul: 1.05 } } },
  midori: { p6: { girl: { rateMul: 1.03 } } },
  suzu: { p6: { girl: { damageMul: 1.03 } } },
  raika: { p6: { girl: { damageMul: 1.03 } } },
  miko: { p4: { mods: { aura: { dmgMul: 1.01 } } }, p6: { mods: { aura: { dmgMul: 1.01 } } } },
  hotaru: { p6: { mods: { silence: 0.1 } } },
  kaede: { p6: { mods: { ramp: { max: 0.05 } } } },
  chika: { p6: { girl: { rateMul: 1.03 } } },
};

/** Her v1 row as { p2..p6: { name, girl, mods } } (v1's ladder by role category, her own steps on top). */
export function v1Row(def) {
  const cat = def?.kind === 'hero' ? 'hero' : ROLES[def?.role]?.category || 'dps';
  const ladder = LADDERS[cat] || DPS;
  const own = GIRLS[def?.id] || {};
  const row = {};
  for (let p = 2; p <= 6; p++) {
    const s = own[`p${p}`] || (p < 6 ? ladder[p - 2] : SIGNATURE_DEFAULT[cat] || SIGNATURE_DEFAULT.dps);
    row[`p${p}`] = { name: `v1 P${p}`, girl: s.girl || null, mods: s.mods || null };
  }
  return row;
}

/** A def that fights with her v1 steps (its own object, so potentialFold's memo keeps v1 and v3 apart). */
export const v1Def = (def) => ({ ...def, potential: v1Row(def) });

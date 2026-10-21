// Gear stat definitions for menus, rolls and the save (docs/specs/GEAR_STATS.md §A, §B). Not part of
// the co-op hash: src/sim must never import this file (tests/systems/gearStats.test.js greps for it).
// GEAR_STATS in src/data/types.js stays frozen (the sim imports types.js); this file spreads it and
// adds the two club-only substats, Pierce and Aura Power.
import { GEAR_STATS } from './types.js';

/** Every gear stat: today's eight (same keys, ranges and slots) + Pierce (ribbons) + Aura Power (shoes). */
export const GEAR_STAT_DEFS = Object.freeze({
  ...GEAR_STATS,
  piercePct: { name: 'Pierce', pct: true, base: [0.08, 0.16] },
  auraPct: { name: 'Aura Power', pct: true, base: [0.02, 0.04] },
});
export const GEAR_STAT_KEYS = Object.freeze(Object.keys(GEAR_STAT_DEFS));
/** Today's eight keys: what a piece without a club rolls from (its odds never change). */
export const BASE_STAT_KEYS = Object.freeze(Object.keys(GEAR_STATS));

/** Card names: Ult Haste is Skill Haste now (the key stays `ultHaste`). */
export const STAT_LABELS = Object.freeze({
  ...Object.fromEntries(GEAR_STAT_KEYS.map((k) => [k, GEAR_STAT_DEFS[k].name])),
  ultHaste: 'Skill Haste',
});
/** Short tooltips for the stat names a child may not know. */
export const STAT_HINTS = Object.freeze({
  piercePct: 'Hits more enemies: shots go through one more, blasts and traps grow, sweeps hit more, lightning jumps further.',
  auraPct: 'Makes her aura stronger.',
  ultHaste: 'Speeds up hero ults (and, at half strength, every girl\'s ⚡ ability).',
});

/** @returns {string} the card name of a gear stat */
export const statName = (stat) => STAT_LABELS[stat] || stat;

/** A new stat rolls only on club pieces, and only in its slot (never a main stat). */
export const NEW_STAT_SLOT = Object.freeze({ piercePct: 'ribbon', auraPct: 'shoes' });

/**
 * The substat pool of a piece: a piece without a club keeps today's eight; a club piece adds its slot's
 * new stat (ribbons Pierce, shoes Aura Power).
 */
export function subPool(slot, club) {
  if (!club) return BASE_STAT_KEYS;
  return GEAR_STAT_KEYS.filter((k) => !NEW_STAT_SLOT[k] || NEW_STAT_SLOT[k] === slot);
}

/**
 * Caps on her gear totals (gear-awaken §7.3 + gear-stats §A.6). Crit Rate, Cost Reduction and Skill
 * Haste were live before; Crit DMG +200 %, Range +50 %, Pierce +150 % and Aura Power +15 % are new.
 * The part of a stat above its cap fills in as ATK (Every Line Counts).
 */
export const BATTLE_CAPS = Object.freeze({ critChance: 0.75, costCut: 0.25, ultHaste: 0.5, critDmg: 2.0, rangePct: 0.5, piercePct: 1.5, auraPct: 0.15 });
/** Gear-stat key of each cap (the same keys). */
export const CAPPED_STATS = Object.freeze(Object.keys(BATTLE_CAPS));

/** Every Line Counts: the soft limit on fill-in ATK, and the aura girls' own bucket (from the battle update). */
export const FILL_SOFT_M = 0.12;
export const AURA_FILL_M = 0.05;
/** Half an ATK line's worth. */
export const FILL_WORTH = 0.5;

/**
 * What her kit can't use (§B.2), decided from what a menu can see: her kit, stars and Potential. `fill`
 * lists stats that fill in; `until` makes a stat fill only below a star or Potential (it becomes real
 * there). `fillTo: 'aura'` = Umeko and Miko: their dead lines raise her aura instead of her ATK.
 */
const DEAD_TOWER = ['ultHaste', 'auraPct'];
export const GEAR_FIT = Object.freeze({
  hikari: { fill: ['auraPct'] },
  nami: { fill: ['auraPct'] },
  luna: { fill: ['auraPct'], until: { auraPct: { potential: 6 } } },
  aoi: { fill: DEAD_TOWER },
  rei: { fill: DEAD_TOWER },
  yuki: { fill: DEAD_TOWER },
  momo: { fill: DEAD_TOWER },
  akane: { fill: DEAD_TOWER },
  kage: { fill: DEAD_TOWER },
  raika: { fill: DEAD_TOWER },
  midori: { fill: DEAD_TOWER },
  sango: { fill: ['ultHaste', 'armorPen', 'auraPct'] },
  shiro: { fill: ['ultHaste', 'rangePct', 'armorPen', 'auraPct'] },
  suzu: { fill: ['ultHaste', 'critChance', 'critDmg', 'armorPen', 'auraPct'] },
  kaede: { fill: ['ultHaste', 'armorPen', 'piercePct', 'auraPct'] },
  chika: { fill: DEAD_TOWER },
  hotaru: { fill: ['ultHaste', 'auraPct'], until: { auraPct: { potential: 2 } } },
  miko: { fillTo: 'aura', fill: ['atkPct', 'ratePct', 'critChance', 'critDmg', 'armorPen', 'piercePct', 'ultHaste'] },
  umeko: { fillTo: 'aura', fill: ['atkPct', 'critChance', 'critDmg', 'armorPen', 'piercePct', 'ultHaste', 'auraPct'], until: { auraPct: { awaken: 3 } } },
  // the returning girls (roster wave, src/data/unitsExpansion.js): the three staff heroes as Hikari and Nami (no
  // aura on the base kit; Yoriko's stage aura is on her level track), the students as the live towers (no ult
  // reader, no base aura), except Noa, whose sanctuary carries +8 % damage, so her Aura Power is real
  kanna: { fill: ['auraPct'] },
  yoriko: { fill: ['auraPct'] },
  seiran: { fill: ['auraPct'] },
  fuu: { fill: DEAD_TOWER },
  hana: { fill: DEAD_TOWER },
  ruri: { fill: DEAD_TOWER },
  noa: { fill: ['ultHaste'] },
  iroha: { fill: DEAD_TOWER },
  ena: { fill: DEAD_TOWER },
  // the new girls (UNIT_GAPS §5, src/data/unitsNewGirls.js): the attacking students as the live towers; Wakaba
  // (drinks) and Ouka (office rules) deal no damage, so the damage lines fill in too (her speed still counts for
  // Wakaba's throws; nothing else reaches Ouka's rules)
  azami: { fill: DEAD_TOWER },
  kinu: { fill: DEAD_TOWER },
  wakaba: { fill: ['ultHaste', 'auraPct', 'atkPct', 'critChance', 'critDmg', 'armorPen', 'piercePct'] },
  yuzuha: { fill: DEAD_TOWER },
  ouka: { fill: ['ultHaste', 'auraPct', 'atkPct', 'ratePct', 'critChance', 'critDmg', 'armorPen', 'piercePct', 'rangePct'] },
  chigusa: { fill: DEAD_TOWER },
  marumi: { fill: DEAD_TOWER },
  // Tenka (BUILD_PLAN 6.1): an attacking student like the live towers (no aura; Skill Haste waits with the
  // other towers' until the ability bar ships)
  tenka: { fill: DEAD_TOWER },
});

/**
 * Stats that fill in for her right now (her stars and Potential decide the `until` rows).
 * Unknown girls (new ones without a row yet) fill nothing.
 * @param {string} unitId
 * @param {{ awaken?: number, potential?: number }} state
 * @returns {Set<string>}
 */
export function fillStats(unitId, { awaken = 0, potential = 1 } = {}) {
  const row = GEAR_FIT[unitId];
  if (!row) return new Set();
  const out = new Set();
  for (const s of row.fill) {
    const u = row.until?.[s];
    if (u && ((u.awaken != null && awaken >= u.awaken) || (u.potential != null && potential >= u.potential))) continue;
    out.add(s);
  }
  return out;
}

/** Common mid roll of a stat (the fill-in exchange rate is mid(target) / mid(stat)). */
export function midRoll(stat) {
  const [a, b] = GEAR_STAT_DEFS[stat].base;
  return (a + b) / 2;
}

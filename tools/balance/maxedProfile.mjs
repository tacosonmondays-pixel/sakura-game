// The fully maxed profile every balance round 5 number uses (docs/BALANCE.md "Balance round 5"): L85, ★5, 10 gates,
// P6, three UR +12 Taiko pieces at average rolls (crit damage / crit chance / attack speed mains, ATK and crit subs),
// through the game's own unitBattleStats, and the duo at LR. No side effects: UR Resonance follows the clock, so
// `maxedStats(id, now)` takes one (tools/balance/r5Bench.mjs sets the clock past its Nov 2 week; `RESONANCE_ON` is a
// time inside it).
import { unitBattleStats } from '../../src/systems/progression.js';
import { mainStatRange, substatRange, subGrowth } from '../../src/systems/gear.js';
import { fillMainsFor } from '../../src/systems/gearSets.js';
import { SET_IDS } from '../../src/data/gearSets.js';

/** A time inside UR Resonance's first week (Nov 4, 2026, 12:00 UTC). */
export const RESONANCE_ON = Date.UTC(2026, 10, 4, 12);

const avg = ([a, b]) => (a + b) / 2;
function piece(uid, slot, mainStat, subs) {
  const mb = +avg(mainStatRange(mainStat, 'legendary')).toFixed(4);
  const growth = mainStat === 'armorPen' ? 0.04 : 0.06;
  const main = { stat: mainStat, base: mb, value: +(mb * (1 + growth * 12)).toFixed(4) };
  const sl = subs.map(([stat, ups]) => {
    const base = +avg(substatRange(stat, 'legendary')).toFixed(4);
    return { stat, base, upgrades: ups, tuned: 0, value: +(base + ups * subGrowth(stat, 'legendary')).toFixed(4) };
  });
  return { uid, slot, rarity: 'legendary', level: 12, main, subs: sl, ur: 1, club: 'taiko', locked: false, equippedBy: null, name: uid };
}
/** Bare profiles for the no-nerf gate's low pass (tools/balance/noNerfGate.mjs --profile): no gear. */
export const LOW_PROFILES = {
  l1: { level: 1, awaken: 0, breakthrough: 0, pl: 0 },
  l40: { level: 40, awaken: 3, breakthrough: 4, pl: 2 },
};
/**
 * The fully maxed profile (the round-3/4 bench's, unchanged), plus an LR unit's Limit Break (`lr: false`: without it).
 * `profile: 'l1' | 'l40'`: a bare profile instead (LOW_PROFILES, no gear).
 */
export function maxedProfile(id, { lr = true, profile = 'maxed' } = {}) {
  const missions = { counters: lr ? { [`lr:${id}`]: 1, [`lbt:${id}`]: 1 } : {} };
  if (LOW_PROFILES[profile]) return { units: { [id]: { ...LOW_PROFILES[profile], gear: {} } }, gear: {}, missions };
  const urSet = /^urset:([a-z]+)$/.exec(profile || '');
  if (urSet) return urSetProfile(id, urSet[1], missions);
  const c = piece(`${id}_c`, 'charm', 'critDmg', [['atkPct', 2], ['critChance', 2], ['ratePct', 0], ['armorPen', 0]]);
  const r = piece(`${id}_r`, 'ribbon', 'critChance', [['atkPct', 2], ['critDmg', 2], ['ratePct', 0], ['armorPen', 0]]);
  const s = piece(`${id}_s`, 'shoes', 'ratePct', [['atkPct', 2], ['critChance', 1], ['critDmg', 1], ['armorPen', 0]]);
  for (const g of [c, r, s]) g.equippedBy = id;
  return {
    units: { [id]: { level: 85, awaken: 5, breakthrough: 10, pl: 6, gear: { charm: c.uid, ribbon: r.uid, shoes: s.uid } } },
    gear: { [c.uid]: c, [r.uid]: r, [s.uid]: s },
    missions,
  };
}
/**
 * Set Boxes v2 (docs/specs/SET_BOXES_V2.md §7): the strongest gear a UR Set Box leads to — five UR +12 pieces of one
 * set at average rolls (its 2-piece stat, its passive and its 5-piece cap), the classic three with the bench's mains,
 * the Hair Clip and the Necklace with "Fill for a girl"'s mains. `profile: 'urset:<set>'`.
 */
function urSetProfile(id, setId, missions) {
  if (!SET_IDS.includes(setId)) throw new Error(`urset: unknown set ${setId}`);
  const unit = { level: 85, awaken: 5, breakthrough: 10, pl: 6, gear: {} };
  const fill = fillMainsFor({ units: { [id]: unit } }, id);
  const POOL = ['atkPct', 'critChance', 'critDmg', 'ratePct', 'armorPen'];
  const subsFor = (main) => POOL.filter((k) => k !== main).slice(0, 4).map((k, i) => [k, i < 2 ? 2 : 0]);
  const mains = { charm: 'critDmg', ribbon: 'critChance', shoes: 'ratePct', hair: fill.hair, necklace: fill.necklace };
  const gear = {};
  for (const [slot, main] of Object.entries(mains)) {
    const g = piece(`${id}_${slot}`, slot, main, slot === 'charm' ? [['atkPct', 2], ['critChance', 2], ['ratePct', 0], ['armorPen', 0]]
      : slot === 'ribbon' ? [['atkPct', 2], ['critDmg', 2], ['ratePct', 0], ['armorPen', 0]]
        : slot === 'shoes' ? [['atkPct', 2], ['critChance', 1], ['critDmg', 1], ['armorPen', 0]] : subsFor(main));
    g.set = setId;
    g.equippedBy = id;
    gear[g.uid] = g;
    unit.gear[slot] = g.uid;
  }
  return { units: { [id]: unit }, gear, missions };
}

/** Her battle stats fully maxed; `now` (default the clock) decides UR Resonance; `lr: false` leaves an LR unit at UR. */
export function maxedStats(id, now = null, { lr = true, profile = 'maxed' } = {}) {
  if (now == null) return unitBattleStats(maxedProfile(id, { lr, profile }), id);
  const keep = Date.now;
  Date.now = () => now;
  try {
    return unitBattleStats(maxedProfile(id, { lr, profile }), id);
  } finally {
    Date.now = keep;
  }
}

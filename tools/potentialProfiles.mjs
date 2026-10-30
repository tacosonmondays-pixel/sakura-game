// Potential v3 measurement profiles (docs/specs/POTENTIAL.md v3; design spec §8.3 and §10 PC11): who
// has which Potential, which level her carries reach and which gear she wears. capBot.mjs and
// killcap.mjs read them through --profile / --potential / --level / --gear.
//
//   --profile p1|f2p-steady|f2p-late|whale   the defaults below (whale = "Whale A": Build A at P6)
//   --potential p1|f2p|whale|1…6             overrides the Potential part
//   --level 60|75|85                         overrides her level (★5, gate 5, the progression curve)
//   --gear maxed|late|urLate                 overrides the gear block (each measured at level 60)
//   --gates 5…10                             her breakthrough gates (Ascension, docs/specs/ASCENSION.md
//                                            §B.1: +2 % damage each, additive in the level term; default
//                                            5, the Potential v3 measurements; an Ascended L85 girl has 10)
//
// | profile    | Potential                                         | level | gear  |
// |------------|---------------------------------------------------|-------|-------|
// | p1         | everyone P1                                       | 60    | maxed |
// | f2p-steady | R/SR P6, SSR P2, Nami 6, Hikari 3, Luna 2 (month 3) | 75    | maxed |
// | f2p-late   | the same (month 6+)                               | 85    | late  |
// | whale      | everyone P6                                       | 85    | urLate|
// | full       | everyone P6, ★5, 10 gates, UR Resonance on, the duo LR | 85 | full  |
//
// `full` is balance round 5's fully maxed girl (tools/balance/maxedProfile.mjs: three UR +12 Taiko pieces at average
// rolls through the game's own unitBattleStats, UR Resonance on): the strongest account a player can reach.
//
// The gear blocks are the battle multipliers at level 60 (`maxed`: ★5, legendary +10, average rolls,
// tools/freeplayBot.mjs MAXED; `late`: best of ten gold sets; `urLate`: UR gear). A level other than 60
// scales damage and attack speed by the level curve of src/systems/progression.js unitBattleStats
// (damage 1 + 1.8 %·(L−1) + 2 %·gates + 5 %·stars, then × gear; speed 1 + 0.4 %·(L−1), then × gear).
import { MAXED } from './freeplayBot.mjs';
import { DEFAULT_UNIT_STATS } from '../src/sim/constants.js';
import { UNIT_MAP } from '../src/data/units.js';
import { maxedStats, RESONANCE_ON } from './balance/maxedProfile.mjs';

export const GEAR = Object.freeze({
  maxed: MAXED,
  late: { ...MAXED, damageMul: 3.5, rateMul: 1.64, rangeMul: 1.17, critChance: 0.36, critMul: 1.8, armorPen: 5.3, costMul: 0.88, ultHaste: 0.27 },
  urLate: { ...MAXED, damageMul: 3.97, rateMul: 1.75, rangeMul: 1.3, critChance: 0.58, critMul: 2.23, armorPen: 6.6, costMul: 0.85, ultHaste: 0.31 },
});

export const PROFILES = Object.freeze({
  p1: { potential: 'p1', level: 60, gear: 'maxed' },
  'f2p-steady': { potential: 'f2p', level: 75, gear: 'maxed' },
  'f2p-late': { potential: 'f2p', level: 85, gear: 'late' },
  whale: { potential: 'whale', level: 85, gear: 'urLate' },
  full: { potential: 'whale', level: 85, gear: 'full', gates: 10 },
});

/** The free player's Potential (v2 §3.1): R/SR P6, SSR P2, Nami 6, Hikari 3, Luna 2. */
const F2P_HEROES = { nami: 6, hikari: 3, luna: 2 };
export function potentialFor(unitId, potential) {
  if (typeof potential === 'number') return Math.max(1, Math.min(6, Math.floor(potential)));
  if (potential === 'whale') return 6;
  if (potential === 'f2p') {
    if (unitId in F2P_HEROES) return F2P_HEROES[unitId];
    return UNIT_MAP[unitId]?.rarity === 'SSR' ? 2 : 6;
  }
  return 1;
}

const STARS = 5;
const GATES = 5;
const levelDamage = (L, gates = GATES) => 1 + 0.018 * (L - 1) + 0.02 * gates + 0.05 * STARS;
const levelRate = (L) => 1 + 0.004 * (L - 1);

/** Battle stats of one girl under a profile ({ potential, level, gear }). */
export function profileStats(unitId, prof) {
  if (prof.gear === 'full') return { ...DEFAULT_UNIT_STATS, ...maxedStats(unitId, RESONANCE_ON) };
  const g = GEAR[prof.gear];
  if (!g) throw new Error(`unknown gear block ${prof.gear} (maxed, late, urLate, full)`);
  const L = prof.level;
  return {
    ...DEFAULT_UNIT_STATS,
    ...g,
    damageMul: (g.damageMul * levelDamage(L, prof.gates ?? GATES)) / levelDamage(60),
    rateMul: (g.rateMul * levelRate(L)) / levelRate(60),
    level: L,
    potential: potentialFor(unitId, prof.potential),
  };
}

/**
 * The profile a command line asks for. `opt(name, fallback)` reads `--name value`.
 * @returns {{ name: string, potential: string|number, level: number, gear: string }}
 */
export function profileFromArgs(opt) {
  const name = opt('profile', 'p1');
  const base = PROFILES[name];
  if (!base) throw new Error(`unknown profile ${name} (${Object.keys(PROFILES).join(', ')})`);
  const pot = opt('potential', null);
  const potential = pot == null ? base.potential : /^\d$/.test(pot) ? Number(pot) : pot === 'f2p-steady' || pot === 'f2p-late' ? 'f2p' : pot;
  if (typeof potential !== 'number' && !['p1', 'f2p', 'whale'].includes(potential)) throw new Error(`unknown --potential ${pot}`);
  const level = Number(opt('level', base.level));
  if (!(level >= 1 && level <= 85)) throw new Error(`--level ${level} is outside 1…85`);
  const gates = Number(opt('gates', base.gates ?? GATES));
  if (!(gates >= 0 && gates <= 10)) throw new Error(`--gates ${gates} is outside 0…10`);
  return { name, potential, level, gear: opt('gear', base.gear), gates };
}

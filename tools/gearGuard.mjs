// Gear guard runs (docs/specs/GEAR_AWAKEN.md §7.4, GEAR_STATS.md §D.4): the Freeplay bot's team build with
// the gear stat blocks on every girl, on the given stages and tiers, two seeds each. The rule this guards:
// UR_LATE (rainbow gear's endpoint) and the club presets must never beat the wave-250 Eclipse Wyrm.
//
//   node --import ./tools/simLoader.mjs tools/gearGuard.mjs [--stages 4-5,1-5] [--tiers blossom,crimson] [--seeds 7,11] [--presets maxed,late,urLate,urLateClubs]
//
// Presets: MAXED (today's calibration), LATE (best of 10 Legendary), UR_LATE (the UR endpoint, GA §7.2),
// and the primed club presets (gear-stats §D.4): `late'` / `urLate'` add Every Line Counts (×1.06 / ×1.065
// on damage, the modelled fill of their dead parts), the boss clubs (Taiko for the fast hitters, Fencing for
// the crit girls), Archery Kage with Pierce, Pyrotechnics Akane, Tea Miko with Aura Power. Prints one JSON
// line per run and a summary; exit 1 if any run beats the Wyrm.
import { runBot, MAXED } from './freeplayBot.mjs';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? def : process.argv[i + 1];
};

export const LATE = { ...MAXED, damageMul: 3.50, rateMul: 1.64, rangeMul: 1.17, critChance: 0.36, critMul: 1.80, armorPen: 5.3, costMul: 0.88, ultHaste: 0.27 };
export const UR_LATE = { ...MAXED, damageMul: 3.97, rateMul: 1.75, rangeMul: 1.30, critChance: 0.58, critMul: 2.23, armorPen: 6.6, costMul: 0.85, ultHaste: 0.31 };
const prime = (b, fill) => ({ ...b, damageMul: Math.round(b.damageMul * fill * 10000) / 10000 });
/** her club set, Pierce and aura on top of a primed block (the `clubs` lineup of gear-stats §D.4) */
const CLUBS_LINEUP = {
  shiro: { club: 'fencing', clubN: 3, critChance: 0.03 },
  kage: { club: 'archery', clubN: 3, pierceK: 76 },
  aoi: { club: 'taiko', clubN: 3, rateMulx: 1.05 },
  sango: { club: 'pyro', clubN: 3, damageMulx: 1.05, pierceK: 46 },
  akane: { club: 'pyro', clubN: 3, damageMulx: 1.05, pierceK: 46, dotMul: 1.25 },
  miko: { club: 'tea', clubN: 3, auraPct: 0.2, auraRangeMul: 1.05 },
  momo: { club: 'taiko', clubN: 3, rateMulx: 1.05 },
  yuki: { club: 'taiko', clubN: 3, rateMulx: 1.05 },
  hikari: { club: 'taiko', clubN: 3, rateMulx: 1.05, pierceK: 46 },
};
function lineup(base) {
  const out = {};
  for (const [id, o] of Object.entries(CLUBS_LINEUP)) {
    const { rateMulx = 1, damageMulx = 1, critChance = 0, ...rest } = o;
    out[id] = { ...rest, rateMul: Math.round(base.rateMul * rateMulx * 10000) / 10000, damageMul: Math.round(base.damageMul * damageMulx * 10000) / 10000, critChance: Math.min(0.75, base.critChance + critChance) };
  }
  return out;
}
export const PRESETS = {
  maxed: { base: MAXED },
  late: { base: LATE },
  urLate: { base: UR_LATE },
  lateClubs: { base: prime(LATE, 1.06), per: lineup(prime(LATE, 1.06)) },
  urLateClubs: { base: prime(UR_LATE, 1.065), per: lineup(prime(UR_LATE, 1.065)) },
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const stages = String(arg('stages', '4-5')).split(',');
  const tiers = String(arg('tiers', 'blossom,crimson')).split(',');
  const seeds = String(arg('seeds', '7,11')).split(',').map(Number);
  const presets = String(arg('presets', 'late,urLate,urLateClubs')).split(',');
  const rows = [];
  for (const p of presets) for (const stageId of stages) for (const tier of tiers) for (const seed of seeds) {
    const r = runBot({ stageId, tier, seed, maxWave: Number(arg('maxWave', 260)), ...PRESETS[p] });
    const row = { preset: p, stageId, tier, seed, fell: r.fell, cleared: r.cleared, wyrm: r.cleared >= 250, wallSec: r.wallSec, maxStepMs: r.maxStepMs };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
  const beat = rows.filter((r) => r.wyrm);
  console.log(`SUMMARY ${rows.length} runs; beat the Eclipse Wyrm: ${beat.length}${beat.length ? ` (${beat.map((r) => `${r.preset} ${r.stageId} ${r.tier} s${r.seed}`).join(', ')})` : ''}`);
  process.exit(beat.length ? 1 : 0);
}

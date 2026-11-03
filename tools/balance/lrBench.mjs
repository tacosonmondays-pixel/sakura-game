// The LR units against Kage (docs/specs/DUO_LR.md §6–§7, the owner's Oct 30 "LR's should be more op!"): each LR
// unit's tier-5 builds as her DPS ÷ the best Kage tier 5, on a crowd and on a boss, on two benches:
//   light  tools/benchHit.mjs measure: the STRONG preset (level 60, ★3 awakened, crit 25%), one girl alone, mean of
//          four configs (stages 4-5 and 6-3 × seeds 9 and 1); LR = the same stats with her LR form on (`lr: true`)
//   r5     tools/balance/r5Bench.mjs measure: fully maxed with Umeko + Midori beside her, mean of seeds 9/1/2; no-LR =
//          her UR self (no Limit Break), LR = Limit Break cleared (her LR form and the LR boost)
//
//   node --import ./tools/simLoader.mjs tools/balance/lrBench.mjs [units…] [--bench light,r5] [--builds p0t5,p1t5,p2t5] [--json]
import { defaultData } from '../../src/sim/data.js';
import { DEFAULT_UNIT_STATS } from '../../src/sim/constants.js';
import { measure as hitMeasure } from '../benchHit.mjs';
import { measure as r5Measure } from './r5Bench.mjs';

const argv = process.argv.slice(2);
const VALUED = ['--bench', '--builds'];
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const names = argv.filter((a, i) => !a.startsWith('--') && !VALUED.includes(argv[i - 1]));
const UNITS = names.length ? names : ['kohaku_tsubaki', 'tenka'];
const BENCHES = opt('bench', 'light,r5').split(',');
const BUILDS = opt('builds', 'p0t5,p1t5,p2t5').split(',');
const KAGE_BUILDS = ['p0t5', 'p1t5', 'p2t5'];
const TARGETS = ['crowd', 'boss'];

const lv = (L, bt, st) => 1 + 0.018 * (L - 1) + 0.02 * bt + 0.05 * st;
const rt = (L) => 1 + 0.004 * (L - 1);
/** tools/benchHit.mjs's STRONG preset. */
const STRONG = { ...DEFAULT_UNIT_STATS, damageMul: +(lv(60, 5, 3) * 1.45).toFixed(4), rateMul: +(rt(60) * 1.2).toFixed(4), critChance: 0.25, critMul: 1.3, armorPen: 1, awakenPassive: true, level: 60, awaken: 3 };
const LIGHT_CONFIGS = [['4-5', 9], ['4-5', 1], ['6-3', 9], ['6-3', 1]];
const R5_SEEDS = [9, 1, 2];
const parse = (b) => [+b[1], +b[3]];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const d = defaultData();

function light(unitId, build, target, lr) {
  const stats = lr ? { ...STRONG, lr: true } : STRONG;
  // her boss in the light bench walks through her reach (benchHit's own boss)
  return mean(LIGHT_CONFIGS.map(([stageId, seed]) => hitMeasure({ d, unitId, stats, build: parse(build), stageId, seed, target }).hitDps || 0));
}
function r5(unitId, build, target, lr) {
  return mean(R5_SEEDS.map((seed) => r5Measure({ d, unitId, build: parse(build), target, seed, lr }).dps || 0));
}
const BENCH = { light, r5 };

const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n)));
for (const bench of BENCHES) {
  const run = BENCH[bench];
  const kage = {};
  for (const target of TARGETS) kage[target] = Math.max(...KAGE_BUILDS.map((b) => run('kage', b, target, false)));
  console.log(`${bench}: best Kage T5 crowd ${fmt(kage.crowd)} boss ${fmt(kage.boss)}`);
  for (const unitId of UNITS) {
    for (const build of BUILDS) {
      for (const lr of [false, true]) {
        const v = {};
        for (const target of TARGETS) v[target] = run(unitId, build, target, lr);
        const row = { bench, unitId, build, lr, crowd: Math.round(v.crowd), boss: Math.round(v.boss), xCrowd: +(v.crowd / kage.crowd).toFixed(2), xBoss: +(v.boss / kage.boss).toFixed(2) };
        console.log(argv.includes('--json') ? JSON.stringify(row) : `  ${unitId} ${build} ${lr ? 'LR   ' : 'no-LR'}: crowd ${fmt(v.crowd)} (×${row.xCrowd}) boss ${fmt(v.boss)} (×${row.xBoss})`);
      }
    }
  }
}

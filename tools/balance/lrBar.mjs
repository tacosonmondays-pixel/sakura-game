// The LR bar (the owner, Oct 30: "LRs should beat every character, that's the point"; docs/BALANCE.md "The LR bar"):
// every LR build (the duo's and Tenka's three tier-5 builds in their LR form) must deal at least LR_MARGIN × the best
// NON-LR build of every unit, heroes included, on a crowd and on a boss, on the round-5 bench (tools/balance/r5Bench.mjs:
// fully maxed, Umeko + Midori beside her, mean of seeds 9/1/2; boss = the better of the held and the walking boss).
//
//   node --import ./tools/simLoader.mjs tools/balance/lrBar.mjs --bar [--json]   measure the bar (every non-LR build)
//   node --import ./tools/simLoader.mjs tools/balance/lrBar.mjs [--json]         every LR build ÷ LR_BAR; exit 1 under
//
// The bar takes every non-hero unit's three tier-5 builds (an LR unit without her Limit Break: her UR self), every hero
// at Lv 25 with Mastery full, and the KNOWN rows measured on other benches (below). `LR_BAR` pins the result;
// tests/sim/lrBar.test.js measures the LR builds against it. Re-measure the bar (--bar) when a unit is raised.
import { defaultData } from '../../src/sim/data.js';
import { measure } from './r5Bench.mjs';

/** Each LR build must reach this × the bar on both axes. */
export const LR_MARGIN = 1.25;

/** Non-LR numbers from other benches that join the bar (the owner's list, Oct 30). */
export const KNOWN = Object.freeze([
  // tools/balance/labBench.mjs: Tenka's Joint Research at UR with a full lab team (her lab weapons need the girls)
  { unitId: 'tenka', build: 'lab, full lab team, no LR', crowd: 15.43e6, boss: 3.55e6 },
  // feature/iroha-mirrors 7d1cc0bf (her round 4, in review), fully maxed with Umeko + Midori, her best player layout
  // (her mirrors placed by hand): 5-0-2 on a boss, 2-0-5 on a crowd (on Auto: 2.77M / 6.96M)
  { unitId: 'iroha', build: 'best layout, feature/iroha-mirrors', crowd: 8.70e6, boss: 5.96e6 },
]);

/**
 * The bar, measured on `feature/balance-r5` (`--bar`, Oct 30; every non-hero unit's three tier-5 builds, eight heroes
 * at Lv 25, KNOWN): the best non-LR crowd and boss of any unit. Re-measure and re-pin it when a non-LR unit is raised
 * (or merged in). Headroom for the S5 shapes (+10–30% on six girls, all under 3M) is inside both axes.
 */
export const LR_BAR = Object.freeze({
  crowd: { dps: 16470821, unitId: 'akane', build: 'p0t5' },
  boss: { dps: 5960000, unitId: 'iroha', build: 'best layout, feature/iroha-mirrors' },
});

/** The LR builds: [unitId, build] (pNt5: path N at tier 5, its tier-2 crosspath as r5Bench builds it). */
export const LR_BUILDS = Object.freeze([
  ['kohaku_tsubaki', 'p0t5'], ['kohaku_tsubaki', 'p1t5'], ['kohaku_tsubaki', 'p2t5'],
  ['tenka', 'p0t5'], ['tenka', 'p1t5'], ['tenka', 'p2t5'],
]);
const LR_UNITS = [...new Set(LR_BUILDS.map(([u]) => u))];

const SEEDS = [9, 1, 2];
const parse = (b) => [+b[1], +b[3]];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

/** One build's two axes on the r5 bench (crowd; boss = max of held and walking), mean of SEEDS. */
export function axes(d, unitId, build, lr) {
  const m = (target) => mean(SEEDS.map((seed) => measure({ d, unitId, build: parse(build), target, seed, lr }).dps || 0));
  return { crowd: m('crowd'), boss: Math.max(m('boss'), m('bossw')) };
}

/** Every non-LR build's axes, and the bar per axis (KNOWN rows included). */
export function measureBar(d = defaultData()) {
  const rows = [];
  for (const id of Object.keys(d.units)) {
    const def = d.units[id];
    if (def.kind === 'hero') {
      rows.push({ unitId: id, build: 'Lv25', ...axes(d, id, 'p0t0', false) });
      continue;
    }
    for (const build of ['p0t5', 'p1t5', 'p2t5']) rows.push({ unitId: id, build: LR_UNITS.includes(id) ? `${build} (no LR)` : build, ...axes(d, id, build, false) });
  }
  for (const k of KNOWN) rows.push({ ...k, known: true });
  const bar = {};
  for (const ax of ['crowd', 'boss']) {
    const top = rows.reduce((b, r) => (r[ax] > b[ax] ? r : b));
    bar[ax] = { dps: Math.round(top[ax]), unitId: top.unitId, build: top.build };
  }
  return { rows, bar };
}

/** Every LR build against `bar` (default LR_BAR): { unitId, build, crowd, boss, crowdX, bossX, ok }. */
export function checkLr(d = defaultData(), bar = LR_BAR) {
  return LR_BUILDS.map(([unitId, build]) => {
    const a = axes(d, unitId, build, true);
    const crowdX = a.crowd / bar.crowd.dps;
    const bossX = a.boss / bar.boss.dps;
    return { unitId, build, ...a, crowdX, bossX, ok: crowdX >= LR_MARGIN && bossX >= LR_MARGIN };
  });
}

const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n)));

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const d = defaultData();
  if (argv.includes('--bar')) {
    const { rows, bar } = measureBar(d);
    if (argv.includes('--json')) for (const r of rows) console.log(JSON.stringify(r));
    for (const ax of ['crowd', 'boss']) {
      console.log(`top ${ax}:`);
      for (const r of [...rows].sort((a, b) => b[ax] - a[ax]).slice(0, 8)) console.log(`  ${r.unitId} ${r.build} ${fmt(r[ax])}`);
    }
    console.log(`BAR ${JSON.stringify(bar)}`);
  } else {
    const out = checkLr(d);
    for (const r of out) console.log(argv.includes('--json') ? JSON.stringify(r) : `${r.ok ? 'ok   ' : 'UNDER'} ${r.unitId} ${r.build} crowd ${fmt(r.crowd)} (×${r.crowdX.toFixed(2)} of bar)  boss ${fmt(r.boss)} (×${r.bossX.toFixed(2)})`);
    process.exitCode = out.every((r) => r.ok) ? 0 : 1;
  }
}

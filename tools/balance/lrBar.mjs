// The LR bar (the owner, Oct 30: "LRs should beat every character, that's the point"; docs/BALANCE.md "The LR bar"):
// every LR build (the duo's and Tenka's three tier-5 builds in their LR form) must deal at least LR_MARGIN × the best
// NON-LR build of every unit, heroes included, on a crowd and on a boss. Boss = the better of the held and the walking
// boss. The margin is checked on the fixed round-5 bench (tools/balance/r5Bench.mjs: fully maxed, Umeko 2-5-0 + Midori
// 5-0-2 beside her, mean of seeds 9/1/2); the bar it is checked against is the best non-LR number under any support
// pair in PAIRS (so a girl with better friends than the bench's sets it). Under the same supports (each pair and the
// bigger TEAMS) every LR build must still beat the best non-LR (≥ ×1.0; the 1.25× margin is the fixed bench's).
//
//   node --import ./tools/simLoader.mjs tools/balance/lrBar.mjs --bar [--top 6] [--json]   measure the bar
//   node --import ./tools/simLoader.mjs tools/balance/lrBar.mjs [--pairs] [--json]          LR builds ÷ LR_BAR; exit 1 under
//
// --bar: every non-hero unit's three tier-5 builds with both tier-2 crosspaths (an LR unit at UR, without her Limit
// Break) and every hero at Lv 25 with Mastery full, on the fixed bench; then the top `--top` non-LR builds per axis and
// every LR build again under each support pair in PAIRS; then KNOWN. Prints the bar (the max over all of it) and, per
// pair, each LR build ÷ that pair's best non-LR (the owner's rule: an LR wins under every pair, ≥ ×1.0). Re-pin LR_BAR
// from its BAR line. --pairs (without --bar): only that per-pair check. tests/sim/lrBar.test.js runs the default check.
import { defaultData } from '../../src/sim/data.js';
import { measure } from './r5Bench.mjs';

/** Each LR build must reach this × the bar on both axes, on the fixed bench. */
export const LR_MARGIN = 1.25;

/**
 * Support pairs screened for the bar (the LR-bar review's single-support screen, Oct 30: Umeko 2-5-0 is the best
 * single support, then Midori 2-0-5, Miko 5-0-2 and Chika x-5-0). `um` is the fixed bench (Umeko 2-5-0 + Midori 5-0-2).
 */
export const PAIRS = Object.freeze([
  'um',
  'umeko:p1t5+chika:p1t5',
  'umeko:p1t5+midori:p2t5',
  'umeko:p1t5+miko:p0t5',
  'midori:p0t5+miko:p0t5',
  'midori:p2t5+chika:p1t5',
]);

/**
 * Bigger support teams: not in the bar (the bench and the bar are two supports), only the same-support check (an LR
 * build beside them against the best non-LR beside them, ≥ ×1.0).
 */
export const TEAMS = Object.freeze(['umeko:p1t5+midori:p2t5+chika:p1t5']);

/** Non-LR numbers from other benches that join the bar (the owner's list, Oct 30). */
export const KNOWN = Object.freeze([
  // tools/balance/labBench.mjs: Tenka's Joint Research at UR with a full lab team (her lab weapons need the girls)
  { unitId: 'tenka', build: 'lab, full lab team, no LR', crowd: 15.43e6, boss: 3.55e6 },
  // feature/iroha-mirrors 7d1cc0bf (her round 4, in review), fully maxed with Umeko + Midori, her mirrors placed by hand:
  // the best layout found (tools/balance/irohaLayouts.mjs, which runs once her mirrors are in the tree; her spec §10
  // and her review r4's search): 5-0-2 on a boss 6.13M, 2-0-5 on a crowd 8.70M (on Auto: 2.77M / 6.96M).
  // When iroha-mirrors merges: run irohaLayouts.mjs, put its best here, run --bar and re-pin LR_BAR.
  { unitId: 'iroha', build: 'best layout, feature/iroha-mirrors', crowd: 8.70e6, boss: 6.13e6 },
]);

/**
 * The bar, measured on `feature/balance-r5` (`--bar`, Oct 30): the best non-LR crowd and boss of any unit under any
 * pair in PAIRS, KNOWN included. Re-measure and re-pin it when a non-LR unit is raised or merged in. Headroom for the
 * S5 shapes (+10–30% on six girls, all under 3M) is inside both axes.
 */
export const LR_BAR = Object.freeze({
  crowd: { dps: 17397696, unitId: 'akane', build: 'p0t5', support: 'umeko:p1t5+chika:p1t5' },
  boss: { dps: 6130000, unitId: 'iroha', build: 'best layout, feature/iroha-mirrors', support: 'um' },
});

/** The LR builds: [unitId, build] (pNt5: path N at tier 5, its tier-2 crosspath as r5Bench builds it). */
export const LR_BUILDS = Object.freeze([
  ['kohaku_tsubaki', 'p0t5'], ['kohaku_tsubaki', 'p1t5'], ['kohaku_tsubaki', 'p2t5'],
  ['tenka', 'p0t5'], ['tenka', 'p1t5'], ['tenka', 'p2t5'],
]);
const LR_UNITS = [...new Set(LR_BUILDS.map(([u]) => u))];
/** Each path at tier 5 with both tier-2 crosspaths: pNt5 (r5Bench's default crosspath) and pNt5cK (the other). */
const T5_BUILDS = ['p0t5', 'p0t5c1', 'p1t5', 'p1t5c2', 'p2t5', 'p2t5c1'];

const SEEDS = [9, 1, 2];
const parse = (b) => {
  const m = /^p(\d)t(\d)(?:c(\d))?$/.exec(b);
  return m[3] != null ? [+m[1], +m[2], +m[3]] : [+m[1], +m[2]];
};
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

/** One build's two axes (crowd; boss = max of held and walking), mean of SEEDS, beside `support`. */
export function axes(d, unitId, build, lr, support = 'um') {
  const hero = d.units[unitId]?.kind === 'hero';
  const m = (target) => mean(SEEDS.map((seed) => measure({ d, unitId, build: hero ? [0, 0] : parse(build), target, seed, lr, support }).dps || 0));
  return { crowd: m('crowd'), boss: Math.max(m('boss'), m('bossw')) };
}

const top = (rows, ax) => rows.reduce((b, r) => (r[ax] > b[ax] ? r : b));
const barOf = (rows) => Object.fromEntries(['crowd', 'boss'].map((ax) => {
  const t = top(rows, ax);
  return [ax, { dps: Math.round(t[ax]), unitId: t.unitId, build: t.build, support: t.support }];
}));

/** Every LR build under `support`: { unitId, build, support, crowd, boss }. */
export function lrRows(d, support = 'um') {
  return LR_BUILDS.map(([unitId, build]) => ({ unitId, build, support, ...axes(d, unitId, build, true, support) }));
}

/**
 * The bar: every non-LR build on the fixed bench, the top `topN` per axis again under every pair, KNOWN; plus, per
 * pair, the LR builds against that pair's best non-LR.
 */
export function measureBar(d = defaultData(), { topN = 6 } = {}) {
  const rows = [];
  for (const id of Object.keys(d.units)) {
    if (d.units[id].kind === 'hero') {
      rows.push({ unitId: id, build: 'Lv25', support: 'um', ...axes(d, id, 'p0t0', false) });
      continue;
    }
    for (const build of T5_BUILDS) rows.push({ unitId: id, build: LR_UNITS.includes(id) ? `${build} (no LR)` : build, raw: build, support: 'um', ...axes(d, id, build, false) });
  }
  const cands = new Map();
  for (const ax of ['crowd', 'boss']) for (const r of [...rows].sort((a, b) => b[ax] - a[ax]).slice(0, topN)) cands.set(`${r.unitId} ${r.build}`, r);
  const perPair = [];
  for (const support of [...PAIRS.slice(1), ...TEAMS]) {
    const pr = [...cands.values()].map((r) => ({ unitId: r.unitId, build: r.build, raw: r.raw, support, ...axes(d, r.unitId, r.raw || 'p0t0', false, support) }));
    if (PAIRS.includes(support)) rows.push(...pr);
    else rows.push(...pr.map((r) => ({ ...r, team: true })));
    perPair.push({ support, bar: barOf(pr), lr: lrRows(d, support) });
  }
  perPair.unshift({ support: 'um', bar: barOf(rows.filter((r) => r.support === 'um')), lr: lrRows(d, 'um') });
  for (const k of KNOWN) rows.push({ ...k, support: 'um', known: true });
  return { rows, bar: barOf(rows.filter((r) => !r.team)), perPair };
}

/** Every LR build on the fixed bench against `bar` (default LR_BAR): { unitId, build, crowd, boss, crowdX, bossX, ok }. */
export function checkLr(d = defaultData(), bar = LR_BAR) {
  return lrRows(d, 'um').map((r) => {
    const crowdX = r.crowd / bar.crowd.dps;
    const bossX = r.boss / bar.boss.dps;
    return { ...r, crowdX, bossX, ok: crowdX >= LR_MARGIN && bossX >= LR_MARGIN };
  });
}

const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n)));

function printPairs(perPair) {
  let worst = Infinity;
  for (const p of perPair) {
    console.log(`pair ${p.support}: best non-LR crowd ${p.bar.crowd.unitId} ${p.bar.crowd.build} ${fmt(p.bar.crowd.dps)}, boss ${p.bar.boss.unitId} ${p.bar.boss.build} ${fmt(p.bar.boss.dps)}`);
    for (const r of p.lr) {
      const cx = r.crowd / p.bar.crowd.dps;
      const bx = r.boss / p.bar.boss.dps;
      worst = Math.min(worst, cx, bx);
      console.log(`  ${cx >= 1 && bx >= 1 ? 'ok   ' : 'UNDER'} ${r.unitId} ${r.build} crowd ${fmt(r.crowd)} ×${cx.toFixed(2)}  boss ${fmt(r.boss)} ×${bx.toFixed(2)}`);
    }
  }
  console.log(`worst LR ÷ same-pair best non-LR: ×${worst.toFixed(3)}`);
  return worst;
}

/** --pairs: the non-LR builds that top the bar today (BAR_CANDIDATES) under `support`. */
function KNOWN_FREE(d, support) {
  return BAR_CANDIDATES.map(([unitId, build]) => ({ unitId, build, support, ...axes(d, unitId, build, false, support) }));
}

/** The non-LR builds that top either axis under some pair (the last --bar run; --pairs re-measures only these). */
export const BAR_CANDIDATES = Object.freeze([
  ['akane', 'p0t5'], ['akane', 'p0t5c1'], ['hotaru', 'p0t5'], ['hotaru', 'p0t5c1'], ['sango', 'p2t5c1'],
  ['aoi', 'p2t5c1'], ['shiro', 'p0t5'], ['kohaku_tsubaki', 'p0t5'], ['kohaku_tsubaki', 'p0t5c1'], ['kohaku_tsubaki', 'p1t5'],
]);

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const opt = (k, dflt) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : dflt);
  const d = defaultData();
  if (argv.includes('--bar')) {
    const { rows, bar, perPair } = measureBar(d, { topN: Number(opt('top', 6)) });
    if (argv.includes('--json')) for (const r of rows) console.log(JSON.stringify(r));
    for (const ax of ['crowd', 'boss']) {
      console.log(`top ${ax}:`);
      // (TEAMS rows, three supports, print for reference and stay outside the bar)
      for (const r of [...rows].sort((a, b) => b[ax] - a[ax]).slice(0, 10)) console.log(`  ${r.unitId} ${r.build} [${r.support}] ${fmt(r[ax])}${r.team ? '  (TEAMS: outside the bar)' : ''}`);
    }
    const worst = printPairs(perPair);
    console.log(`BAR ${JSON.stringify(bar)}`);
    process.exitCode = worst >= 1 ? 0 : 1;
  } else if (argv.includes('--pairs')) {
    const perPair = [...PAIRS, ...TEAMS].map((support) => ({ support, lr: lrRows(d, support), bar: barOf(KNOWN_FREE(d, support)) }));
    process.exitCode = printPairs(perPair) >= 1 ? 0 : 1;
  } else {
    const out = checkLr(d);
    for (const r of out) console.log(argv.includes('--json') ? JSON.stringify(r) : `${r.ok ? 'ok   ' : 'UNDER'} ${r.unitId} ${r.build} crowd ${fmt(r.crowd)} (×${r.crowdX.toFixed(2)} of bar)  boss ${fmt(r.boss)} (×${r.bossX.toFixed(2)})`);
    process.exitCode = out.every((r) => r.ok) ? 0 : 1;
  }
}

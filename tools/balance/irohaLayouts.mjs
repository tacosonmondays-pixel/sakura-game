// Iroha's best mirror layouts (the LR bar's KNOWN row, tools/balance/lrBar.mjs; her spec docs/specs/IROHA_MIRRORS.md
// §10 on feature/iroha-mirrors): on the round-5 bench (tools/balance/r5Bench.mjs: fully maxed, Umeko + Midori, 4-5),
// her mirrors placed by hand instead of on Auto. Runs only on a tree with her mirrors (src/sim/mirrors.js mirrorCount
// and Sim.setAim's mirror slots); elsewhere it says so and exits 0.
//
//   node --import ./tools/simLoader.mjs tools/balance/irohaLayouts.mjs [--builds p0t5,p1t5,p2t5] [--axes boss,crowd]
//        [--random 120] [--keep 4] [--json]
//
// Layouts per build: stars around her nearest road point (radius 0.5–1.8 by 0.1, her mirrors on a regular polygon
// visited with step 1 or 2, two phases) and `--random` five-point layouts within 3 tiles of it (a fixed PRNG), each
// screened on seed 9; the best `--keep` re-run on seeds 9/1/2. Boss = the better of the held and the walking boss.
// When iroha-mirrors merges: run this, put the best boss and crowd in lrBar.mjs KNOWN, run lrBar.mjs --bar, re-pin LR_BAR.
import { defaultData } from '../../src/sim/data.js';
import { measure } from './r5Bench.mjs';

const argv = process.argv.slice(2);
const opt = (k, dflt) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : dflt);
const BUILDS = opt('builds', 'p0t5,p1t5,p2t5').split(',');
const AXES = opt('axes', 'boss,crowd').split(',');
const RANDOM = Number(opt('random', 120));
const KEEP = Number(opt('keep', 4));
const parse = (b) => [+b[1], +b[3]];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

let mirrors = null;
try {
  mirrors = await import('../../src/sim/mirrors.js');
} catch {
  mirrors = null;
}
if (!mirrors?.mirrorCount) {
  console.log('no mirrors in this tree (src/sim/mirrors.js mirrorCount): run this on a tree with feature/iroha-mirrors merged');
  process.exit(0);
}

/** A fixed PRNG (mulberry32), so the random layouts are the same every run. */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Layouts as offsets from her nearest road point: [{ name, pts: [[dx, dy], …] }] (5 points; she uses the first n). */
function layouts() {
  const out = [];
  for (let r = 0.5; r <= 1.8001; r += 0.1) {
    for (const step of [1, 2]) {
      for (const phase of [0, 0.5]) {
        const pts = [];
        for (let k = 0; k < 5; k++) {
          const a = (2 * Math.PI * (((k * step) % 5) + phase)) / 5;
          pts.push([+(r * Math.cos(a)).toFixed(3), +(r * Math.sin(a)).toFixed(3)]);
        }
        out.push({ name: `star r${r.toFixed(1)} s${step} φ${phase}`, pts });
      }
    }
  }
  const rnd = prng(20261030);
  for (let i = 0; i < RANDOM; i++) {
    const pts = [];
    for (let k = 0; k < 5; k++) {
      const a = rnd() * 2 * Math.PI;
      const rr = 3 * Math.sqrt(rnd());
      pts.push([+(rr * Math.cos(a)).toFixed(3), +(rr * Math.sin(a)).toFixed(3)]);
    }
    out.push({ name: `random ${i}`, pts });
  }
  return out;
}

const d = defaultData();
function run(build, target, seed, lay) {
  const setup = lay ? (sim, t, { spot, path0 }) => {
    const n = mirrors.mirrorCount(t);
    const c = path0.reduce((b, s) => ((s.x - spot.x) ** 2 + (s.y - spot.y) ** 2 < b.dd ? { dd: (s.x - spot.x) ** 2 + (s.y - spot.y) ** 2, s } : b), { dd: 1e9 }).s;
    for (let k = 0; k < n && k < lay.pts.length; k++) sim.setAim(t.uid, c.x + lay.pts[k][0], c.y + lay.pts[k][1], k);
  } : null;
  return measure({ d, unitId: 'iroha', build: parse(build), target, seed, setup }).dps || 0;
}
const axis = (build, ax, seed, lay) => (ax === 'boss' ? Math.max(run(build, 'boss', seed, lay), run(build, 'bossw', seed, lay)) : run(build, 'crowd', seed, lay));

const all = layouts();
const results = [];
for (const build of BUILDS) {
  for (const ax of AXES) {
    const auto = mean([9, 1, 2].map((s) => axis(build, ax, s, null)));
    const screened = all.map((lay) => ({ lay, v: axis(build, ax, 9, lay) })).sort((a, b) => b.v - a.v).slice(0, KEEP);
    const best = screened.map(({ lay }) => ({ lay, v: mean([9, 1, 2].map((s) => axis(build, ax, s, lay))) })).sort((a, b) => b.v - a.v)[0];
    const row = { build, axis: ax, auto: Math.round(auto), best: Math.round(best.v), layout: best.lay.name, pts: best.lay.pts };
    results.push(row);
    console.log(argv.includes('--json') ? JSON.stringify(row) : `${build} ${ax}: Auto ${(auto / 1e6).toFixed(2)}M, best ${(best.v / 1e6).toFixed(2)}M (${best.lay.name} ${JSON.stringify(best.lay.pts)})`);
  }
}
const top = (ax) => results.filter((r) => r.axis === ax).reduce((b, r) => (!b || r.best > b.best ? r : b), null);
for (const ax of AXES) {
  const t = top(ax);
  if (t) console.log(`KNOWN ${ax}: ${t.best} (${t.build}, ${t.layout})`);
}

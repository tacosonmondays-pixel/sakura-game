// The no-nerf gate (the owner's rule: no girl lower than live in any measured scenario; the final review of balance
// round 5): every girl, every path at tiers 1–5 (a tier-2 crosspath, as tools/balance/r5Bench.mjs builds pNtM), boss /
// walking boss / crowd, with Umeko + Midori beside her and alone. Run it in the live tree and on the branch (copy this
// file, r5Bench.mjs and maxedProfile.mjs into the live tree), then compare.
//
//   node --import ./tools/simLoader.mjs tools/balance/noNerfGate.mjs --support um|none [--tiers 1,2,3,4,5]
//        [--seeds 9,1,2] [--seeds5 …] [--profiles maxed,l1,l40] [--no-lr-off] [girls…] > side.jsonl
//   node tools/balance/noNerfGate.mjs --compare live.jsonl branch.jsonl [--tol 0.995]
//
// Every cell is the mean of --seeds (default 9,1,2; --seeds5 overrides tier 5 only). One JSON line per cell.
// --profiles (default all three, maxed,l1,l40): the girl's profile (maxed: the fully maxed bench profile; l1 / l40:
// bare, no gear, maxedProfile.mjs LOW_PROFILES, tagged `|l1` / `|l40`); the supports stay fully maxed. LR-off pass (on
// by default; --no-lr-off skips it): every unit whose stats change with her Limit Break (the LR units) is measured again
// without it, tagged `|lroff`. Heroes are not measured (every HERO_POWER and POWER value is ≥ 1, docs/BALANCE.md).
// --compare prints the cells missing or errored on either side (and fails if any), every cell under live × tol, and
// the count per tier; it exits 1 on any miss or any cell under.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const VALUED = ['--support', '--tiers', '--seeds5', '--seeds', '--compare', '--tol', '--profiles'];
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const names = argv.filter((a, i) => !a.startsWith('--') && !VALUED.includes(argv[i - 1]) && !(argv[i - 2] === '--compare'));

function load(f) {
  const m = new Map();
  for (const l of readFileSync(f, 'utf8').split('\n')) {
    if (!l.startsWith('{')) continue;
    const r = JSON.parse(l);
    m.set(`${r.unitId}|${r.build}|${r.target}|${r.support}`, r);
  }
  return m;
}

async function measureAll() {
  const { defaultData } = await import('../../src/sim/data.js');
  const { measure, maxedStats } = await import('./r5Bench.mjs');
  const d = defaultData();
  const support = opt('support', 'um');
  const tiers = opt('tiers', '1,2,3,4,5').split(',').map(Number);
  const seeds = opt('seeds', '9,1,2').split(',').map(Number);
  const seeds5 = opt('seeds5', null)?.split(',').map(Number) ?? seeds;
  const girls = names.length ? names : Object.keys(d.units).filter((id) => d.units[id].kind !== 'hero');
  // the LR units: her stats move with her Limit Break
  const lrUnits = girls.filter((id) => JSON.stringify(maxedStats(id, null, { lr: true })) !== JSON.stringify(maxedStats(id, null, { lr: false })));
  const passes = [];
  for (const profile of opt('profiles', 'maxed,l1,l40').split(',')) {
    for (const unitId of girls) passes.push([unitId, true, profile]);
    if (!argv.includes('--no-lr-off')) for (const unitId of lrUnits) passes.push([unitId, false, profile]);
  }
  for (const [unitId, lr, profile] of passes) {
    const tag = `${support}${lr ? '' : '|lroff'}${profile === 'maxed' ? '' : `|${profile}`}`;
    for (const tier of tiers) {
      for (let p = 0; p < 3; p++) {
        for (const target of ['boss', 'bossw', 'crowd']) {
          const ss = tier === 5 ? seeds5 : seeds;
          const rs = ss.map((seed) => measure({ d, unitId, build: [p, tier], target, support, seed, lr, profile }));
          const bad = rs.find((r) => r.error);
          const row = { unitId, build: `p${p}t${tier}`, target, support: tag, seeds: ss.length, ...(bad ? { error: bad.error } : { dps: Math.round(rs.reduce((a, r) => a + r.dps, 0) / rs.length), tiers: rs[0].tiers }) };
          console.log(JSON.stringify(row));
        }
      }
    }
  }
}

function compare(fa, fb) {
  const tol = Number(opt('tol', 0.995));
  const live = load(fa);
  const br = load(fb);
  const per = {};
  let cells = 0;
  const under = [];
  const missing = [];
  for (const k of new Set([...live.keys(), ...br.keys()])) {
    const a = live.get(k);
    const b = br.get(k);
    if (!a || !b || a.dps == null || b.dps == null) {
      missing.push(`${k}: live ${!a ? 'missing' : a.error ?? 'ok'}, branch ${!b ? 'missing' : b.error ?? 'ok'}`);
      continue;
    }
    cells++;
    const t = `${b.support} ${b.build.slice(2)}`;
    per[t] = per[t] || { cells: 0, under: 0 };
    per[t].cells++;
    if (b.dps < a.dps * tol) {
      per[t].under++;
      under.push(`${k} live ${a.dps} → ${b.dps} (×${(b.dps / Math.max(1, a.dps)).toFixed(3)})`);
    }
  }
  console.log(`${cells} cells compared; missing or errored on either side: ${missing.length}; under live ×${tol}: ${under.length}`);
  for (const [t, v] of Object.entries(per).sort()) console.log(`  ${t}: ${v.cells} cells, ${v.under} under`);
  for (const m of missing) console.log(`  MISSING ${m}`);
  for (const u of under) console.log(`  UNDER ${u}`);
  return under.length + missing.length;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (argv.includes('--compare')) {
    const i = argv.indexOf('--compare');
    process.exitCode = compare(argv[i + 1], argv[i + 2]) ? 1 : 0;
  } else await measureAll();
}

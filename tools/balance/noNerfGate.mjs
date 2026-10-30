// The no-nerf gate (the owner's rule: no girl lower than live in any measured scenario; the final review of balance
// round 5): every girl, every path at tiers 1–5 (a tier-2 crosspath, as tools/balance/r5Bench.mjs builds pNtM), boss /
// walking boss / crowd, with Umeko + Midori beside her and alone. Run it in the live tree and on the branch (copy this
// file, r5Bench.mjs and maxedProfile.mjs into the live tree), then compare.
//
//   node --import ./tools/simLoader.mjs tools/balance/noNerfGate.mjs --support um|none [--tiers 1,2,3,4,5]
//        [--seeds5 9,1,2] [--seeds 9] [girls…] > side.jsonl
//   node tools/balance/noNerfGate.mjs --compare live.jsonl branch.jsonl [--tol 0.995]
//
// Tier 5 is the mean of --seeds5, tiers 1–4 of --seeds (the review's split). One JSON line per cell. --compare prints
// every cell under live × tol and the count per tier.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const VALUED = ['--support', '--tiers', '--seeds5', '--seeds', '--compare', '--tol'];
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
  const { measure } = await import('./r5Bench.mjs');
  const d = defaultData();
  const support = opt('support', 'um');
  const tiers = opt('tiers', '1,2,3,4,5').split(',').map(Number);
  const seeds5 = opt('seeds5', '9,1,2').split(',').map(Number);
  const seeds = opt('seeds', '9').split(',').map(Number);
  const girls = names.length ? names : Object.keys(d.units).filter((id) => d.units[id].kind !== 'hero');
  for (const unitId of girls) {
    for (const tier of tiers) {
      for (let p = 0; p < 3; p++) {
        for (const target of ['boss', 'bossw', 'crowd']) {
          const ss = tier === 5 ? seeds5 : seeds;
          const rs = ss.map((seed) => measure({ d, unitId, build: [p, tier], target, support, seed }));
          const bad = rs.find((r) => r.error);
          const row = { unitId, build: `p${p}t${tier}`, target, support, seeds: ss.length, ...(bad ? { error: bad.error } : { dps: Math.round(rs.reduce((a, r) => a + r.dps, 0) / rs.length), tiers: rs[0].tiers }) };
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
  for (const [k, b] of br) {
    const a = live.get(k);
    if (!a || a.dps == null || b.dps == null) continue;
    cells++;
    const t = b.build.slice(2);
    per[t] = per[t] || { cells: 0, under: 0 };
    per[t].cells++;
    if (b.dps < a.dps * tol) {
      per[t].under++;
      under.push(`${k} live ${a.dps} → ${b.dps} (×${(b.dps / Math.max(1, a.dps)).toFixed(3)})`);
    }
  }
  console.log(`${cells} cells compared; under live ×${tol}: ${under.length}`);
  for (const [t, v] of Object.entries(per).sort()) console.log(`  ${t}: ${v.cells} cells, ${v.under} under`);
  for (const u of under) console.log(`  UNDER ${u}`);
  return under.length;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (argv.includes('--compare')) {
    const i = argv.indexOf('--compare');
    process.exitCode = compare(argv[i + 1], argv[i + 2]) ? 1 : 0;
  } else await measureAll();
}

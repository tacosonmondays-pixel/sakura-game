// Hero track helper (docs/specs/HERO_REWORK.md §3.1).
//
//   node tools/heroTrack.mjs <heroId>            the hero's 25-level track + the rule-5 report
//   node tools/heroTrack.mjs --draft <file.mjs>  a draft track (canonical order) for a hero still
//                                                written with 3 upgrade paths + 10 milestones (the
//                                                module's default export is that UnitDef)
//
// Rule 5 (counters come early): for each capability in the hero's pathCapabilities, the first level
// that grants it must be Lv ≤ 10, or cost ≤ 1.5× the old cheapest path price to buy from Lv 1.
// A capability only a tier 5 granted stays on its tier-5 level.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { getUnit } from '../src/data/units.js';
import { HERO_LEVEL_PRICES } from '../src/data/heroTracks.js';
import { resolveStats } from '../src/sim/mods.js';
import { statsCapabilities } from '../src/sim/report.js';

/** Canonical order: [level, ref] with A/B/C = paths 0..2 and M = old milestones. */
const ORDER = [
  [2, 'M2'], [3, 'M3'], [4, 'A1'], [5, 'B1'], [6, 'C1'], [7, 'M4'], [8, 'A2'], [9, 'B2'], [10, 'C2'], [11, 'M5'], [12, 'A3'], [13, 'M6'],
  [14, 'B3'], [15, 'C3'], [16, 'M7'], [17, 'A4'], [18, 'M8'], [19, 'B4'], [20, 'C4'], [21, 'M9'], [22, 'A5'], [23, 'B5'], [24, 'C5'], [25, 'M10'],
];

/** Live (pre-rework) cheapest path price of each capability of the three original heroes. */
const OLD_CHEAPEST = {
  hikari: { armorPen: 1420, reveal: 4740, silence: 1540, buff: 140, cleanse: 4740, antiAir: 1400 },
  luna: { armorPen: 1600, slow: 140, stun: 4840, buff: 150, detection: 1670 },
  nami: { armorPen: 1380, stun: 460, buff: 120 },
};

const priceTo = (level, prices = HERO_LEVEL_PRICES) => prices.slice(0, level - 1).reduce((a, b) => a + b, 0);
const grants = (st, cap) => statsCapabilities(st).has(cap) || (cap === 'detection' && !!st.aura?.detection);

/** Draft track for a hero with paths: canonical order, then the rule-5 report on the draft. */
function draft(def) {
  const levels = [{ level: 1, from: 'base', desc: def.hero.levels?.[0]?.desc || 'Base attack.', mods: {} }];
  for (const [level, ref] of ORDER) {
    if (ref[0] === 'M') {
      const m = def.hero.levels.find((l) => l.level === Number(ref.slice(1)));
      levels.push({ level, from: `L${ref.slice(1)}`, desc: m?.desc || '', mods: m?.mods || {} });
    } else {
      const p = 'ABC'.indexOf(ref[0]);
      const t = Number(ref[1]);
      const tier = def.paths[p].tiers[t - 1];
      levels.push({ level, from: `${def.paths[p].id}.${t}`, desc: `${tier.name}: ${tier.desc}`, mods: tier.mods });
    }
  }
  const oldCheapest = {};
  for (const cap of def.pathCapabilities) {
    let best = Infinity;
    def.paths.forEach((path, p) => {
      for (let t = 1; t <= 5; t++) {
        const tiers = [0, 0, 0];
        tiers[p] = t;
        if (grants(resolveStats({ ...def, hero: undefined }, { tiers }), cap)) {
          best = Math.min(best, path.tiers.slice(0, t).reduce((a, x) => a + x.cost, 0));
          break;
        }
      }
    });
    oldCheapest[cap] = best;
  }
  return { levels, oldCheapest, tracked: { ...def, paths: [], hero: { ...def.hero, levels } } };
}

function report(def, levels, oldCheapest = null) {
  console.log(`\n${def.name}: 25-level track`);
  for (const l of levels) console.log(`  Lv ${String(l.level).padStart(2)}  ${String(l.from).padEnd(16)} ${l.desc}`);
  console.log('\nRule 5 (counters early):');
  let bad = 0;
  for (const cap of def.pathCapabilities) {
    let first = 0;
    for (let L = 1; L <= 25 && !first; L++) if (grants(resolveStats({ ...def, hero: { ...def.hero, levels } }, { heroLevel: L }), cap)) first = L;
    if (!first) {
      console.log(`  ${cap.padEnd(10)} never granted  FAIL`);
      bad++;
      continue;
    }
    const coins = priceTo(first);
    const capstone = /\.5$/.test(levels[first - 1].from);
    const old = oldCheapest?.[cap];
    const ok = first <= 10 || capstone || (old != null && coins <= 1.5 * old);
    if (!ok) bad++;
    console.log(`  ${cap.padEnd(10)} Lv ${String(first).padStart(2)} (${coins.toLocaleString('en-US')} coins from Lv 1)${old != null && Number.isFinite(old) ? ` · old cheapest ${old.toLocaleString('en-US')}` : ''}${capstone ? ' · tier-5 only' : ''}  ${ok ? 'pass' : 'FAIL'}`);
  }
  return bad;
}

const args = process.argv.slice(2);
let bad = 0;
if (args[0] === '--draft') {
  const mod = await import(pathToFileURL(resolve(args[1])).href);
  const def = mod.default;
  const d = draft(def);
  bad = report(def, d.levels, d.oldCheapest);
  console.log('\nDraft only: apply curation rules 1–5 (one attack, trimmed stacks, top-ups, counters early) by hand.');
} else {
  const def = getUnit(args[0] || 'hikari');
  if (def.kind !== 'hero') throw new Error(`${def.id} is not a hero`);
  bad = report(def, def.hero.levels, OLD_CHEAPEST[def.id]);
}
process.exit(bad ? 1 : 0);

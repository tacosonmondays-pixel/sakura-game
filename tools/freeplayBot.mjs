// Solo freeplay calibration bot (headless). Plays a campaign stage in solo Freeplay on one tier
// with a scripted build until it falls, spending its cash greedily (cheapest useful buy first:
// a new girl on the best-covered free spot, or the next step of a girl's upgrade plan), and
// prints one line per wave plus a final JSON summary.
//
//   node tools/freeplayBot.mjs --stage 4-5 --tier blossom --build team [--difficulty normal]
//        [--maxWave 400] [--seed 7] [--towers 60] [--coop] [--potential 6]
//
// Builds: team  = 8 girls (Kage, Shiro, Aoi, Akane, Miko, Momo, Sango, Yuki) + Hikari, all maxed
//         kage  = Kage only (+ Hikari), all maxed: the "one carry, all in" build
// "Maxed" = ★5, legendary +10 gear, average rolls (the same build tests/sim/perf.freeplay.test.js
// uses). --coop runs the co-op stage (HP ×1.6) with the same single bot, for comparison only.
// --potential N puts every girl at Potential N (1…6, src/data/potential.js; default 1 = as before).
import { Sim } from '../src/sim/Sim.js';
import { samplePath } from '../src/sim/path.js';
import { STAGE_MAP } from '../src/data/stages.js';
import { freeplayTable } from '../src/data/freeplay.js';
import { coopStage } from '../src/data/coop.js';
import { soloFreeplayStage } from '../src/data/freeplaySolo.js';

export const MAXED = { damageMul: 2.87, rateMul: 1.53, rangeMul: 1, critChance: 0.39, critMul: 1.48, armorPen: 2, costMul: 1, ultHaste: 0, awakenPassive: true, level: 60, awaken: 5 };

/** [unitId, main path, crosspath] in placement order (cycled). */
export const BUILDS = {
  team: {
    girls: ['kage', 'shiro', 'aoi', 'akane', 'miko', 'momo', 'sango', 'yuki'],
    hero: 'hikari',
    cycle: [['kage', 0, 2], ['shiro', 0, 2], ['aoi', 1, 2], ['akane', 0, 2], ['momo', 1, 0], ['sango', 0, 2], ['miko', 0, 2], ['yuki', 0, 2], ['kage', 0, 2], ['shiro', 2, 0], ['aoi', 2, 1], ['akane', 0, 2]],
  },
  kage: {
    girls: ['kage'],
    hero: 'hikari',
    cycle: [['kage', 0, 2], ['kage', 2, 0], ['kage', 0, 1]],
  },
};

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return v == null || v.startsWith('--') ? true : v;
}

export function runBot({ stageId, tier, build = 'team', difficulty = 'normal', maxWave = 400, seed = 7, towers = 60, coop = false, potential = 1, log = () => {} }) {
  const b = BUILDS[build];
  const stats = potential > 1 ? { ...MAXED, potential } : MAXED;
  const stage = coop ? coopStage(stageId, { freeplay: tier }) : soloFreeplayStage(stageId, tier);
  if (!stage?.freeplay) throw new Error(`no freeplay for ${stageId}/${tier}`);
  const sim = new Sim({
    stageId, difficulty, seed,
    loadout: b.girls.map((unitId) => ({ unitId, stats })),
    hero: b.hero ? { unitId: b.hero, stats } : null,
    options: { freeplay: true, autoStart: false },
    data: { stage },
  });
  const samples = sim.pathData.flatMap((p) => samplePath(p, 0.5)).filter((s) => !s.hidden);
  const lattice = [];
  for (let y = 0.3; y < sim.map.height; y += 0.25) for (let x = 0.3; x < sim.map.width; x += 0.25) lattice.push({ x: x + 0.013, y: y + 0.007 });
  const ranked = new Map();
  const best = (r) => {
    if (!ranked.has(r)) {
      ranked.set(r, lattice.map((c) => ({ ...c, cov: samples.reduce((a, s) => a + ((s.x - c.x) ** 2 + (s.y - c.y) ** 2 <= r * r ? 1 : 0), 0) }))
        .filter((c) => c.cov > 0).sort((p, q) => q.cov - p.cov));
    }
    return ranked.get(r);
  };
  const plans = new Map(); // uid -> [main, cross]
  let next = 0;
  let placed = 0;
  const spotFor = (u) => best(Math.min(6, sim.data.unit(u).base.range || 3)).find((c) => sim.canPlace(u, c.x, c.y).ok);
  const placeCost = (u) => sim.canPlace(u, -99, -99).cost ?? sim.data.unit(u).base.cost;

  function spend() {
    if (b.hero && !sim.hero) {
      const s = best(3).find((c) => sim.canPlace(b.hero, c.x, c.y).ok);
      if (s && sim.cash >= placeCost(b.hero)) sim.placeTower(b.hero, s.x, s.y);
    }
    for (let guard = 0; guard < 200; guard++) {
      const opts = [];
      if (placed < towers) {
        const [u, main, cross] = b.cycle[next % b.cycle.length];
        opts.push({ cost: placeCost(u), go: () => {
          const s = spotFor(u);
          if (!s) { placed = towers; return false; }
          const t = sim.placeTower(u, s.x, s.y);
          if (!t) return false;
          plans.set(t.uid, [main, cross]);
          if (u === 'shiro') sim.setTargetMode(t.uid, 'strong');
          next++; placed++;
          return true;
        } });
      }
      for (const t of sim.towers) {
        const plan = t.isHero ? [0, 2] : plans.get(t.uid);
        if (!plan) continue;
        for (const [path, cap] of [[plan[0], 5], [plan[1], 2]]) {
          if ((t.tiers?.[path] ?? 0) >= cap) continue;
          const st = sim.upgradeStatus(t.uid, path);
          // one final tier per path: a copy whose main path's tier 5 is held finishes her crosspath
          if (st.reason === 'onePerPath') continue;
          if (st.next && !(st.locked && st.reason !== 'cash')) opts.push({ cost: st.cost, go: () => sim.upgradeTower(t.uid, path) });
          break; // main first, then cross
        }
      }
      const ok = opts.filter((o) => o.cost <= sim.cash).sort((p, q) => p.cost - q.cost);
      if (!ok.length || !ok[0].go()) break;
    }
  }

  const t0 = Date.now();
  const waves = [];
  let lastWave = 0;
  let waveT = 0;
  let waveSim = 0;
  let maxStepMs = 0;
  let bad = null;
  let acc = 0;
  while (sim.state !== 'lost' && sim.state !== 'won') {
    if (sim.state === 'prep' || sim.state === 'between') {
      spend();
      if (sim.wavesCleared >= maxWave) break;
      sim.startNextWave();
      waveT = Date.now();
      waveSim = sim.time;
    }
    const s0 = performance.now();
    sim.update(0.25);
    maxStepMs = Math.max(maxStepMs, (performance.now() - s0) / 15);
    sim.drainEvents();
    acc += 0.25;
    if (acc >= 1) { acc = 0; spend(); }
    for (const e of sim.enemies) if (!Number.isFinite(e.hp) || !Number.isFinite(e.maxHp)) bad ||= { wave: sim.wave, id: e.id, hp: e.hp, maxHp: e.maxHp };
    if (sim.wave !== lastWave && (sim.state === 'between' || sim.state === 'lost' || sim.state === 'wave')) {
      if (sim.wavesCleared >= sim.wave || sim.state === 'lost') {
        const row = { wave: sim.wave, lives: sim.lives, towers: sim.towers.length, simSec: +(sim.time - waveSim).toFixed(1), ms: Date.now() - waveT };
        waves.push(row);
        log(row);
        lastWave = sim.wave;
      }
    }
  }
  const r = sim.result();
  return {
    stageId, tier, build, difficulty, coop, potential,
    fell: sim.state === 'lost' ? sim.wave : null, cleared: sim.wavesCleared, goal: sim.totalWaves,
    towers: sim.towers.length, simTime: Math.round(sim.time), wallSec: Math.round((Date.now() - t0) / 1000),
    maxStepMs: +maxStepMs.toFixed(2), bad, cashEarned: Math.round(r.stats?.cashEarned || 0), waves,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const stageId = arg('stage', '1-5');
  if (!STAGE_MAP[stageId] || !freeplayTable(arg('tier', 'blossom'))) throw new Error('bad --stage / --tier');
  const out = runBot({
    stageId, tier: arg('tier', 'blossom'), build: arg('build', 'team'), difficulty: arg('difficulty', 'normal'),
    maxWave: Number(arg('maxWave', 400)), seed: Number(arg('seed', 7)), towers: Number(arg('towers', 60)), coop: !!arg('coop', false), potential: Number(arg('potential', 1)),
    log: arg('quiet', false) ? () => {} : (row) => console.log(JSON.stringify(row)),
  });
  const { waves, ...summary } = out;
  console.log('RESULT ' + JSON.stringify(summary));
}

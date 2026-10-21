// Kaede vs Chika bench (Kaede's AoE rework, docs/BALANCE.md "Kaede"): the owner's bar is Kaede within
// about ±10 % of the reworked Chika on her boss path and on her crowd path at equal coins and gear, and
// Potential gate B7 (Kaede / Chika within ±10 % at P1 and at P6).
// Same harness as tools/potentialBench.mjs: one girl on the best-covered spot of 4-5, the same strong
// stats for both, 15 s warm-up then 40 s of damage, seeds 9 and 21. Targets never die:
//   crowd  an Orc Grunt every 0.1 s walking the road
//   held   one Royal Guard Slime (elite) held at the road point nearest her
//   boss   one Iron Colossus (boss, armor 6) held there
//
//   node --import ./tools/simLoader.mjs tools/kaedeBench.mjs [--builds kaede:5-0-2,chika:2-0-5,…]
//        [--kinds crowd,held,boss] [--ps 1,6] [--seeds 9,21] [--pierce 0] [--json]
// --pierce k: gear Pierce in hundredths for both girls (100 = +100 %).
// Prints one row per girl × build × kind × P: DPS (seed mean), coins, DPS per 10k coins.

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);

const { Sim } = await import('../src/sim/Sim.js');
const { samplePath } = await import('../src/sim/path.js');
const { UNIT_MAP } = await import('../src/data/units.js');

const PIERCE = Number(opt('pierce', 0));
const STRONG = { damageMul: 2.2, rateMul: 1.24, rangeMul: 1.08, critChance: 0.2, critMul: 1.3, armorPen: 1, awakenPassive: true, level: 60, awaken: 3, pierceK: PIERCE };
const BUILDS = opt('builds', 'kaede:5-0-2,kaede:5-2-0,kaede:2-5-0,kaede:0-5-2,kaede:2-0-5,chika:5-0-2,chika:2-0-5,chika:0-2-5').split(',').map((s) => {
  const [id, b] = s.split(':');
  return { id, tiers: b.split('-').map(Number) };
});
const KINDS = opt('kinds', 'crowd,held,boss').split(',');
const PS = opt('ps', '1,6').split(',').map(Number);
const SEEDS = opt('seeds', '9,21').split(',').map(Number);
const TARGET = { held: 'slime_courtier', boss: 'iron_colossus' };

function bestSpot(sim, unitId) {
  const r = Math.min(6, UNIT_MAP[unitId].base.range || 3);
  const samples = sim.pathData.flatMap((p) => samplePath(p, 0.5)).filter((s) => !s.hidden);
  let best = null;
  for (let y = 0.3; y < sim.map.height; y += 0.25) {
    for (let x = 0.3; x < sim.map.width; x += 0.25) {
      const c = { x: x + 0.013, y: y + 0.007 };
      if (!sim.canPlace(unitId, c.x, c.y).ok) continue;
      const cov = samples.reduce((a, s) => a + ((s.x - c.x) ** 2 + (s.y - c.y) ** 2 <= r * r ? 1 : 0), 0);
      if (!best || cov > best.cov) best = { ...c, cov };
    }
  }
  return best;
}

function cost(id, tiers) {
  const def = UNIT_MAP[id];
  let c = def.base.cost;
  tiers.forEach((n, p) => { for (let k = 0; k < n; k++) c += def.paths[p].tiers[k].cost; });
  return c;
}

function run(id, tiers, kind, potential, seed) {
  const sim = new Sim({ stageId: '4-5', difficulty: 'normal', seed, loadout: [{ unitId: id, stats: { ...STRONG, potential } }], hero: null, options: { autoStart: false } });
  sim.lives = 1e9;
  sim.cash = 1e9;
  const spot = bestSpot(sim, id);
  const t = sim.placeTower(id, spot.x, spot.y);
  for (let p = 0; p < 3; p++) for (let k = 0; k < tiers[p]; k++) sim.upgradeTower(t.uid, p);
  const open = () => {
    sim.startNextWave();
    sim._spawnQueue = [];
  };
  open();
  let held = null;
  if (kind !== 'crowd') {
    let bestD = Infinity;
    for (let i = 0; i < sim.pathData.length; i++) {
      for (const s of samplePath(sim.pathData[i], 0.1)) {
        const d = (s.x - spot.x) ** 2 + (s.y - spot.y) ** 2;
        if (!s.hidden && d < bestD) {
          bestD = d;
          held = { i, dist: s.d };
        }
      }
    }
  }
  let acc = 0;
  let e = null;
  let start = 0;
  const dt = 0.05;
  for (let time = 0; time < 55; time += dt) {
    if (time >= 15 && !start) start = t.damageDealt || 1e-9;
    if (kind === 'crowd') {
      acc += dt;
      while (acc >= 0.1) {
        acc -= 0.1;
        sim.spawnEnemy('orc_grunt', { hpMul: 1e6 });
      }
    } else if (!e || e.dead || e.removed || !sim.enemies.includes(e)) {
      e = sim.spawnEnemy(TARGET[kind], { hpMul: 1e6, pathIndex: held.i, dist: held.dist });
    }
    if (e && kind !== 'crowd') {
      e.speed = 0;
      e.baseSpeed = 0;
    }
    sim.update(dt);
    sim.drainEvents();
    if (sim.state !== 'wave') open();
  }
  return { dps: (t.damageDealt - start) / 40, tiers: t.tiers.join('-') };
}

const rows = [];
for (const b of BUILDS) {
  for (const kind of KINDS) {
    for (const p of PS) {
      let sum = 0;
      let got = '';
      for (const seed of SEEDS) {
        const r = run(b.id, b.tiers, kind, p, seed);
        sum += r.dps;
        got = r.tiers;
      }
      const dps = sum / SEEDS.length;
      const coins = cost(b.id, b.tiers);
      rows.push({ id: b.id, build: b.tiers.join('-'), got, kind, p, dps: Math.round(dps * 10) / 10, coins, per10k: Math.round((dps / coins) * 1e5) / 10 });
    }
  }
}
if (args.includes('--json')) for (const r of rows) console.log(JSON.stringify(r));
else {
  console.log('| girl | build | coins | kind | P | DPS | DPS / 10k coins |');
  console.log('|---|---|---:|---|---:|---:|---:|');
  for (const r of rows) console.log(`| ${r.id} | ${r.build}${r.got !== r.build ? ` (got ${r.got})` : ''} | ${r.coins} | ${r.kind} | P${r.p} | ${r.dps} | ${r.per10k} |`);
}

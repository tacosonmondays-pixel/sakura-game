// Tenka's Joint Research with a full lab team (the release audit's question on her LR row, Oct 30): fully maxed girls
// of every lab class placed in her reach at their tier 5 first (their coins feed the weapons), then Tenka (fully
// maxed, LR on or off) bought up Joint Research to tier 5 (5-0-2: both absorbs), then Umeko 2-5-0 and Midori 5-0-2
// beside her as on the round-5 bench. Her DPS (the honest readout) on a held boss and on a late crowd, ÷ the best
// Kage tier 5 on the same bench (tools/balance/r5Bench.mjs), seeds 9/1/2.
//
//   node --import ./tools/simLoader.mjs tools/balance/labBench.mjs [--members kage:5-0-2,akane:5-0-2,…] [--json]
import { Sim } from '../../src/sim/Sim.js';
import { defaultData } from '../../src/sim/data.js';
import { samplePath } from '../../src/sim/path.js';
import { withDetMath } from '../../src/core/detMath.js';
import { placeOnPath } from '../../src/sim/enemies.js';
import { maxedStats, RESONANCE_ON } from './maxedProfile.mjs';
import { measure as r5Measure } from './r5Bench.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
// one girl of each lab class (dps, frag, control, support, economy), each at a tier-5 build
const MEMBERS = opt('members', 'kage:5-0-2,akane:5-0-2,yuki:2-5-0,miko:5-2-0,momo:5-0-2').split(',').map((m) => {
  const [id, b] = m.split(':');
  return [id, b.split('-').map(Number)];
});
const SEEDS = [9, 1, 2];
const BOSS_HP = 3e7;
const CROWD_HP = 2e6;

function run(d, target, lr, seed) {
  const stats = (id) => maxedStats(id, RESONANCE_ON, { lr: id === 'tenka' ? lr : true });
  const loadout = ['tenka', ...MEMBERS.map(([id]) => id), 'umeko', 'midori'].map((unitId) => ({ unitId, stats: stats(unitId) }));
  const sim = withDetMath(() => new Sim({ stageId: '4-5', loadout, hero: null, seed }));
  sim.cash = 1e15;
  sim.lives = 1e15;
  let out = null;
  withDetMath(() => {
    const path0 = samplePath(sim.pathData[0], 0.5).filter((s) => !s.hidden);
    const lattice = [];
    for (let y = 0.3; y < sim.map.height; y += 0.25) for (let x = 0.3; x < sim.map.width; x += 0.25) lattice.push({ x: x + 0.013, y: y + 0.007 });
    const cov = (c, r) => path0.reduce((a, s) => a + ((s.x - c.x) ** 2 + (s.y - c.y) ** 2 <= r * r ? 1 : 0), 0);
    const spot = lattice.map((c) => ({ ...c, cov: cov(c, 3.4) })).sort((a, b) => b.cov - a.cov).find((c) => sim.canPlace('tenka', c.x, c.y).ok);
    const t = sim.placeTower('tenka', spot.x, spot.y);
    const up = (tw, tiers) => {
      const order = [0, 1, 2].sort((a, b) => tiers[a] - tiers[b]);
      for (const p of order) for (let i = 0; i < tiers[p]; i++) sim.upgradeTower(tw.uid, p);
    };
    // her members in her reach (her base range: the absorb reads her effective range when she buys the tier)
    for (const [id, tiers] of MEMBERS) {
      const c = lattice.filter((q) => (q.x - spot.x) ** 2 + (q.y - spot.y) ** 2 < 2.4 * 2.4).find((q) => sim.canPlace(id, q.x, q.y).ok);
      if (!c) continue;
      up(sim.placeTower(id, c.x, c.y), tiers);
    }
    up(t, [5, 0, 2]);
    const lab = t.lab ? { rounds: t.lab.rounds, members: { ...t.lab.members } } : null;
    for (const [sid, tiers] of [['umeko', [2, 5, 0]], ['midori', [5, 0, 2]]]) {
      const c = lattice.filter((q) => (q.x - spot.x) ** 2 + (q.y - spot.y) ** 2 < 1.6 * 1.6).find((q) => sim.canPlace(sid, q.x, q.y).ok);
      if (c) up(sim.placeTower(sid, c.x, c.y), tiers);
    }
    sim.update(0.5);
    const near = path0.reduce((b, s) => {
      const dd = (s.x - spot.x) ** 2 + (s.y - spot.y) ** 2;
      return dd < b.dd ? { dd, s } : b;
    }, { dd: 1e9 }).s;
    const hp = (id) => sim.data.enemy(id)?.hp || 1;
    let d0 = 0;
    const warm = 15;
    const runS = 40;
    for (let step = 0; step < (warm + runS) * 60; step++) {
      if (target === 'crowd' && step % 30 === 0) sim.spawnEnemy('orc_grunt', { pathIndex: 0, dist: 0, hpMul: CROWD_HP / hp('orc_grunt') });
      if (target === 'boss' && !sim.enemies.some((e) => !e.dead && e.id === 'dragon_ashwing')) {
        const e = sim.spawnEnemy('dragon_ashwing', { pathIndex: 0, dist: 0, hpMul: BOSS_HP / hp('dragon_ashwing') });
        if (e) e.dist = Math.max(0, (near.d ?? 0) - 1.5);
      }
      if (sim.state !== 'wave') sim.state = 'wave';
      sim.update(1 / 60);
      sim.drainEvents();
      for (const e of sim.enemies) {
        if (e.dead) continue;
        e.hp = e.maxHp;
        if (e.id === 'dragon_ashwing') {
          e.dist = near.d ?? 0;
          placeOnPath(e, sim.pathData[0]);
        }
      }
      if (step === warm * 60) d0 = t.damageDealt || 0;
    }
    out = { dps: ((t.damageDealt || 0) - d0) / runS, lab, tiers: t.tiers.join('-') };
  });
  return out;
}

const d = defaultData();
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const kage = {};
for (const target of ['crowd', 'boss']) {
  kage[target] = Math.max(...['p0t5', 'p1t5', 'p2t5'].map((b) => mean(SEEDS.map((seed) => r5Measure({ d, unitId: 'kage', build: [+b[1], +b[3]], target, seed }).dps))));
}
const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : `${(n / 1e3).toFixed(1)}k`);
console.log(`best Kage T5: crowd ${fmt(kage.crowd)} boss ${fmt(kage.boss)}; lab members ${MEMBERS.map(([id, b]) => `${id} ${b.join('-')}`).join(', ')}`);
for (const lr of [false, true]) {
  const row = {};
  let lab = null;
  for (const target of ['crowd', 'boss']) {
    const rs = SEEDS.map((seed) => run(d, target, lr, seed));
    row[target] = mean(rs.map((r) => r.dps));
    lab = rs[0].lab;
  }
  const line = { lr, crowd: Math.round(row.crowd), boss: Math.round(row.boss), xCrowd: +(row.crowd / kage.crowd).toFixed(2), xBoss: +(row.boss / kage.boss).toFixed(2), lab };
  console.log(argv.includes('--json') ? JSON.stringify(line) : `Tenka Joint Research 5-0-2 ${lr ? 'LR   ' : 'no-LR'}: crowd ${fmt(row.crowd)} (×${line.xCrowd}) boss ${fmt(row.boss)} (×${line.xBoss}) lab ${JSON.stringify(lab)}`);
}

// Team crowd bench (Ena's spreading hex, owner Oct 30: "kill-only effects are weak in teams"): a girl beside a
// partner who takes the kills, on a stream that DIES (no healing, unlike tools/balance/r5Bench.mjs's crowd). Both
// fully maxed (tools/balance/maxedProfile.mjs), Umeko 2-5-0 and Midori 5-0-2 beside her, on 4-5's best-covered
// spot; the partner on the next-best spot down the road from her. An Orc Grunt every --every s at --hp HP walks
// path 0; the run is --warm + --run seconds. Prints each girl's credited DPS over the run, her kills and the leaks.
//
//   node --import ./tools/simLoader.mjs tools/balance/teamCrowd.mjs [girl] [--build p0t5] [--partner kage:p0t5|none]
//        [--hp 4e5] [--every 0.25] [--seeds 9,1,2] [--warm 15] [--run 40] [--json]
import { Sim } from '../../src/sim/Sim.js';
import { defaultData } from '../../src/sim/data.js';
import { samplePath } from '../../src/sim/path.js';
import { withDetMath } from '../../src/core/detMath.js';
import { maxedStats, RESONANCE_ON } from './maxedProfile.mjs';

const argv = process.argv.slice(2);
const VALUED = ['--build', '--partner', '--hp', '--every', '--seeds', '--warm', '--run', '--stage'];
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const names = argv.filter((a, i) => !a.startsWith('--') && !VALUED.includes(argv[i - 1]));
Date.now = () => RESONANCE_ON; // UR Resonance on, as r5Bench

const CROSS = [2, 0, 0];
const parseBuild = (b) => {
  const m = /^p(\d)t(\d)$/.exec(b);
  return [+m[1], +m[2]];
};
const SUP = [['umeko', [1, 5, 0, 2]], ['midori', [0, 5, 2, 2]]];

function upgrade(sim, t, [mp, mt]) {
  for (let i = 0; i < 2; i++) sim.upgradeTower(t.uid, CROSS[mp]);
  for (let i = 0; i < mt; i++) sim.upgradeTower(t.uid, mp);
}

export function measure({ unitId, build, partner, hp, every, seed, warm, run, stageId = '4-5' }) {
  const d = defaultData();
  const part = partner === 'none' ? null : partner.split(':');
  const ids = [unitId, ...(part ? [part[0]] : []), ...SUP.map(([id]) => id)].filter((v, i, a) => a.indexOf(v) === i);
  const loadout = ids.map((id) => ({ unitId: id, stats: maxedStats(id) }));
  const sim = withDetMath(() => new Sim({ stageId, loadout, hero: null, seed }));
  sim.cash = 1e15;
  sim.lives = 1e15;
  let out = null;
  withDetMath(() => {
    const path0 = samplePath(sim.pathData[0], 0.5).filter((s) => !s.hidden);
    const lattice = [];
    for (let y = 0.3; y < sim.map.height; y += 0.25) for (let x = 0.3; x < sim.map.width; x += 0.25) lattice.push({ x: x + 0.013, y: y + 0.007 });
    const cov = (c, r) => path0.reduce((a, s) => a + ((s.x - c.x) ** 2 + (s.y - c.y) ** 2 <= r * r ? 1 : 0), 0);
    const r = Math.min(4, d.units[unitId].base.range || 3);
    const spots = lattice.map((c) => ({ ...c, cov: cov(c, r) })).sort((a, b) => b.cov - a.cov);
    const spot = spots.find((c) => sim.canPlace(unitId, c.x, c.y).ok);
    const t = sim.placeTower(unitId, spot.x, spot.y);
    upgrade(sim, t, build);
    let p = null;
    if (part) {
      // the partner stands at least 2 tiles from her, on the most road she covers: she shares the stream
      const ps = spots.find((c) => (c.x - spot.x) ** 2 + (c.y - spot.y) ** 2 > 4 && sim.canPlace(part[0], c.x, c.y).ok);
      p = sim.placeTower(part[0], ps.x, ps.y);
      upgrade(sim, p, parseBuild(part[1]));
    }
    for (const [sid, [p1, t1, p2, t2]] of SUP) {
      if (sid === unitId) continue;
      const ss = lattice.filter((c) => (c.x - spot.x) ** 2 + (c.y - spot.y) ** 2 < 1.6 * 1.6).map((c) => ({ ...c, cov: cov(c, 3) }))
        .sort((a, b) => b.cov - a.cov).find((c) => sim.canPlace(sid, c.x, c.y).ok);
      if (!ss) continue;
      const st = sim.placeTower(sid, ss.x, ss.y);
      for (let i = 0; i < t2; i++) sim.upgradeTower(st.uid, p2);
      for (let i = 0; i < t1; i++) sim.upgradeTower(st.uid, p1);
    }
    sim.update(0.5);
    const hpMul = hp / (sim.data.enemy('orc_grunt')?.hp || 1);
    const gap = Math.round(60 * every);
    let d0 = 0;
    let p0 = 0;
    let k0 = 0;
    let pk0 = 0;
    let l0 = 0;
    const leaks = () => (sim.stats.leakLog || []).length;
    for (let step = 0; step < (warm + run) * 60; step++) {
      if (step % gap === 0) sim.spawnEnemy('orc_grunt', { pathIndex: 0, dist: 0, hpMul });
      if (sim.state !== 'wave') sim.state = 'wave';
      sim.update(1 / 60);
      sim.drainEvents();
      if (step === warm * 60) {
        d0 = t.damageDealt;
        p0 = p ? p.damageDealt : 0;
        k0 = t.kills;
        pk0 = p ? p.kills : 0;
        l0 = leaks();
      }
    }
    out = {
      dps: Math.round((t.damageDealt - d0) / run), partnerDps: p ? Math.round((p.damageDealt - p0) / run) : 0,
      kills: t.kills - k0, partnerKills: p ? p.kills - pk0 : 0, leaks: leaks() - l0, tiers: t.tiers.join('-'),
    };
  });
  return out;
}

const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));

if (import.meta.url === `file://${process.argv[1]}`) {
  const common = {
    partner: opt('partner', 'kage:p0t5'), hp: Number(opt('hp', 4e5)), every: Number(opt('every', 0.25)),
    warm: Number(opt('warm', 15)), run: Number(opt('run', 40)), stageId: opt('stage', '4-5'),
  };
  const seeds = opt('seeds', '9,1,2').split(',').map(Number);
  for (const unitId of names.length ? names : ['ena']) {
    for (const b of opt('build', 'p0t5,p1t5,p2t5').split(',')) {
      const rs = seeds.map((seed) => measure({ ...common, unitId, build: parseBuild(b), seed }));
      const mean = (k) => Math.round(rs.reduce((a, r) => a + r[k], 0) / rs.length);
      const row = { unitId, build: b, tiers: rs[0].tiers, partner: common.partner, hp: common.hp, dps: mean('dps'), partnerDps: mean('partnerDps'), kills: mean('kills'), partnerKills: mean('partnerKills'), leaks: mean('leaks') };
      console.log(argv.includes('--json') ? JSON.stringify(row) : `${unitId} ${b} ${row.tiers} beside ${row.partner} @${fmt(common.hp)}: ${fmt(row.dps)} (kills ${row.kills}) · partner ${fmt(row.partnerDps)} (kills ${row.partnerKills}) · leaks ${row.leaks}`);
    }
  }
}

// scratch: stage path lengths and how much of each path a girl's measure.mjs spot covers
import { Sim } from '../src/sim/Sim.js';
import { samplePath } from '../src/sim/path.js';
import { withDetMath } from '../src/core/detMath.js';
import { soloFreeplayStage } from '../src/data/freeplaySolo.js';
import { defaultData } from '../src/sim/data.js';
import { maxProfile, parseBuild } from './benchLib.mjs';

const d = defaultData();
const [stageId, ...specs] = process.argv.slice(2);
const stage = soloFreeplayStage(stageId, 'blossom');
for (const spec of specs) {
  const [id, build] = spec.split(':');
  const sim = withDetMath(() => new Sim({ stageId, difficulty: 'normal', loadout: [{ unitId: id, stats: maxProfile(id).stats }], hero: null, seed: 9, options: { freeplay: true, autoStart: false }, data: { stage } }));
  sim.cash = 1e15;
  const samples = sim.pathData.flatMap((p) => samplePath(p, 0.5)).filter((s) => !s.hidden);
  const lens = sim.pathData.map((p, i) => samples.filter((s) => s.pathIndex === i).length * 0.5);
  const r = Math.min(4, d.units[id].base.range || 3);
  const lat = [];
  for (let y = 0.3; y < sim.map.height; y += 0.25) for (let x = 0.3; x < sim.map.width; x += 0.25) lat.push({ x: x + 0.013, y: y + 0.007 });
  const cov = (c, rr) => samples.reduce((a, s) => a + ((s.x - c.x) ** 2 + (s.y - c.y) ** 2 <= rr * rr ? 1 : 0), 0);
  let t = null;
  withDetMath(() => {
    const spot = lat.map((c) => ({ ...c, cov: cov(c, r) })).sort((a, b) => b.cov - a.cov).find((c) => sim.canPlace(id, c.x, c.y).ok);
    t = sim.placeTower(id, spot.x, spot.y);
    const [mp, mt, cp, ct] = parseBuild(build);
    for (let i = 0; i < ct; i++) sim.upgradeTower(t.uid, cp);
    for (let i = 0; i < mt; i++) sim.upgradeTower(t.uid, mp);
    sim.update(0.1);
  });
  const R = sim.towerStats(t.uid).range;
  const per = sim.pathData.map((p, i) => samples.filter((s) => s.pathIndex === i && (s.x - t.x) ** 2 + (s.y - t.y) ** 2 <= R * R).length * 0.5);
  console.log(JSON.stringify({ stageId, id, build, spot: [+t.x.toFixed(2), +t.y.toFixed(2)], reach: +R.toFixed(2), pathLen: lens, tilesInReach: per }));
}

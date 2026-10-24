// scratch probe (not committed): Noa's patched aura and how many enemies carry her mark during a wave
import { Sim } from '../src/sim/Sim.js';
import { defaultData } from '../src/sim/data.js';
import { withDetMath } from '../src/core/detMath.js';
import { soloFreeplayStage } from '../src/data/freeplaySolo.js';
import { maxProfile, parseBuild, releaseAbilities } from './benchLib.mjs';
import { clone, applyProposal } from '../../notes/balance/proposal/patch.mjs';

const d = defaultData();
const noa = applyProposal(clone(d.units.noa), 'noa');
const stage = soloFreeplayStage('4-5', 'blossom');
const ids = ['kage', 'noa'];
const loadout = ids.map((unitId) => ({ unitId, stats: maxProfile(unitId, { rolls: 'mid' }).stats }));
const sim = withDetMath(() => new Sim({ stageId: '4-5', difficulty: 'normal', loadout, seed: 9, options: { freeplay: true, autoStart: false }, data: { stage, units: { noa } } }));
sim.cash = 1e15; sim.lives = 1e15;
withDetMath(() => {
  const k = sim.placeTower('kage', 9.013, 6.007) || null;
  console.log('kage placed', !!k);
});
// find a spot near the road for both
import('../src/sim/path.js').then(() => {});
const { samplePath } = await import('../src/sim/path.js');
const samples = sim.pathData.flatMap((p) => samplePath(p, 0.5)).filter((s) => !s.hidden);
const tryPlace = (id) => {
  const lat = [];
  for (let y = 0.3; y < sim.map.height; y += 0.25) for (let x = 0.3; x < sim.map.width; x += 0.25) lat.push({ x: x + 0.013, y: y + 0.007, cov: samples.reduce((a, s) => a + ((s.x - x) ** 2 + (s.y - y) ** 2 <= 9 ? 1 : 0), 0) });
  lat.sort((a, b) => b.cov - a.cov);
  for (const c of lat) if (sim.canPlace(id, c.x, c.y).ok) return withDetMath(() => sim.placeTower(id, c.x, c.y));
  return null;
};
const n = sim.towers.find((t) => t.unitId === 'noa') || tryPlace('noa');
withDetMath(() => { const [mp, mt, cp, ct] = parseBuild('2-5-0'); for (let i = 0; i < ct; i++) sim.upgradeTower(n.uid, cp); for (let i = 0; i < mt; i++) sim.upgradeTower(n.uid, mp); sim.update(0.5); });
console.log('noa tiers', n.tiers.join('-'), 'aura', JSON.stringify(n.stats.aura));
withDetMath(() => {
  releaseAbilities(sim, true);
  sim.wave = 149; sim.wavesCleared = 149; sim.state = 'between'; sim.startNextWave();
  let marked = 0, seen = 0;
  for (let s = 0; s < 400 && sim.state === 'wave'; s++) {
    sim.update(0.25); sim.drainEvents();
    for (const e of sim.enemies) { if (e.dead) continue; seen++; if (e.statuses.mark) marked++; }
  }
  console.log('enemy-steps', seen, 'marked', marked);
});

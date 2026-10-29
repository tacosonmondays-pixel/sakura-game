// Cost of Iroha's mirror reflection (src/sim/mirrors.js): a full board of shots crossing mirrors. 26 Aois at Rapid
// Volley tier 5 and 4 Irohas at Mirror Hall tier 5 (Infinite Reflection: every panel reflects for good, and each one's
// Mirror Shift adds a second mirror, so 8 mirrors stand in the crowd) against 200 unkillable enemies packed on one leg
// of a serpentine road (so nearly every shot flies through a mirror), measured as wall time per 1/60 s step; against the same board with the Irohas at tier 4 (their ability
// unlocked, so the per-step gather runs, but no mirror reflects). A split shot is a real second shot (more flight,
// more hits), so the bound is on the whole step; the per-shot test itself is a few multiplies against at most 8 points.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STAGE, ENEMIES } from './fixtures.js';
import { defaultData } from '../../src/sim/data.js';
import { abilityPathOf } from '../../src/sim/abilities.js';
import { collectMirrors } from '../../src/sim/mirrors.js';

const D = defaultData();
const MAP = {
  id: 'perf-mirror-map',
  name: 'Perf',
  theme: 'sakura',
  tier: 'expert',
  width: 22,
  height: 13,
  rows: Array.from({ length: 13 }, () => '......................'),
  paths: [[[-1, 1], [20, 1], [20, 5], [1, 5], [1, 9], [20, 9], [20, 13]]],
};
const BLOB = { ...ENEMIES.slime, id: 'blob', hp: 1e9, speed: 0.4 };

function board(irohaTier) {
  const sim = new Sim({
    stageId: 'perf-mirror', seed: 11, loadout: [{ unitId: 'aoi' }, { unitId: 'iroha' }],
    data: { stage: { ...STAGE, id: 'perf-mirror', mapId: MAP.id, waves: 99 }, map: MAP, units: D.units, enemies: { ...ENEMIES, blob: BLOB } },
  });
  sim.cash = 1e12;
  // the crowd: 200 enemies packed on the middle leg (row 5, x 9.5–16.5); the girls on both sides of it
  const spots = [];
  for (const ty of [3.4, 7.6, 2.6, 8.4, 3.9, 7.1]) for (let tx = 6.6; tx < 19.5; tx += 0.85) spots.push([tx, ty]);
  const irohas = [];
  let aois = 0;
  for (let i = 0; i < spots.length && aois + irohas.length < 30; i++) {
    const id = irohas.length < 4 && i % 7 === 3 ? 'iroha' : 'aoi';
    if (id === 'aoi' && aois >= 26) continue;
    const t = sim.placeTower(id, spots[i][0], spots[i][1]);
    if (!t) continue;
    const p = abilityPathOf(t.def);
    for (let k = 0; k < (id === 'iroha' ? irohaTier : 5); k++) sim.upgradeTower(t.uid, p, { restoring: true });
    if (id === 'iroha') irohas.push(t);
    else aois++;
  }
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [{ t: 1e9, enemy: 'blob' }];
  sim._spawnIndex = 0;
  // the middle leg runs from x 20.5 (dist 25) to x 1.5 (dist 44): dist 29–36 is x 16.5–9.5
  for (let i = 0; i < 200; i++) {
    const e = sim.spawnEnemy('blob', { dist: 29 + (i / 200) * 7 });
    e.baseSpeed = 0;
    e.speed = 0;
  }
  sim.update(1 / 60);
  // each Iroha's panel aimed into the crowd, then her Mirror Shift on another crowd spot (tier 5: a second mirror;
  // tier 4: the panel jumps there and reflects for 8 s)
  irohas.forEach((t, i) => {
    sim.setAim(t.uid, 10 + i * 2, 5.5);
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid, { aim: [11 + i * 2, 5.5] }).ok).toBe(true);
  });
  return { sim, irohas, aois };
}

function measure(sim, steps) {
  let splits = 0;
  let maxProj = 0;
  const t0 = performance.now();
  for (let i = 0; i < steps; i++) {
    sim.update(1 / 60);
    for (const ev of sim.drainEvents()) if (ev.type === 'mirrorSplit') splits++;
    if (sim.projectiles.length > maxProj) maxProj = sim.projectiles.length;
  }
  return { ms: (performance.now() - t0) / steps, splits, maxProj };
}

describe('mirror reflection at full board (wall time per step)', () => {
  test('8 reflecting mirrors over 26 tier-5 Aois and 4 Irohas: the step stays within budget and at most ×2.5 of the board without reflection', () => {
    measure(board(5).sim, 120); // warm-up (the JIT), not counted
    const runs = { 4: [], 5: [] };
    for (const tier of [4, 5, 4, 5]) {
      const { sim, irohas, aois } = board(tier);
      expect(aois).toBe(26);
      expect(irohas.length).toBe(4);
      expect(collectMirrors(sim)).toBe(tier === 5 ? 8 : 4); // tier 4: the 8 s windows are open right after the casts
      measure(sim, 8 * 60 + 5); // past tier 4's 8 s window (tier 5's second mirrors live 10 s)
      expect(collectMirrors(sim)).toBe(tier === 5 ? 8 : 0);
      runs[tier].push(measure(sim, 90));
    }
    const best = (k) => Math.min(...runs[k].map((r) => r.ms));
    const ratio = best(5) / best(4);
    console.log(`[perf mirror] tier 4 ${runs[4].map((r) => r.ms.toFixed(3)).join(' / ')} ms/step (≤ ${runs[4][0].maxProj} shots), tier 5 ${runs[5].map((r) => r.ms.toFixed(3)).join(' / ')} ms/step (≤ ${runs[5][0].maxProj} shots, ${runs[5][0].splits} splits in 1.5 s) → ×${ratio.toFixed(2)}`);
    expect(runs[4][0].splits).toBe(0);
    expect(runs[5][0].splits).toBeGreaterThan(100);
    expect(best(5)).toBeLessThan(process.env.CI ? 12 : 5);
    expect(ratio).toBeLessThanOrEqual(process.env.CI ? 3.5 : 2.5);
  }, 120000);
});

// Cost of Fuu's Backdraft Fan (the move kind's push, src/sim/abilities.js MOVES.push) on a full board: 300 sturdy
// enemies (walkers, flyers, minibosses) along the serpentine perf map and 8 Fuus at Returning Gale tier 5, every one of
// them casting on EVERY step (her cooldown reset each time: far past anything a battle allows, 32 s at tier 5), so each
// step blows hundreds of enemies back along their road. Measured as wall time per 1/60 s step against the same board
// with the casts off; both stay inside the budgets of tests/sim/perf.test.js.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STAGE } from './fixtures.js';
import { defaultData } from '../../src/sim/data.js';

const D = defaultData();
const PERF_MAP = {
  id: 'perf-map',
  name: 'Perf',
  theme: 'sakura',
  tier: 'expert',
  width: 22,
  height: 13,
  rows: Array.from({ length: 13 }, () => '......................'),
  paths: [[[-1, 1], [20, 1], [20, 5], [1, 5], [1, 9], [20, 9], [20, 13]]],
};
const KINDS = ['orc_grunt', 'orc_grunt', 'slime_bubble', 'orc_grunt', 'slime_bubble', 'orc_general'];

function board() {
  const sim = new Sim({
    stageId: 'perf', difficulty: 'normal', seed: 11, loadout: [{ unitId: 'fuu' }],
    data: { stage: { ...STAGE, id: 'perf', mapId: 'perf-map', waves: 99 }, map: PERF_MAP, units: D.units, enemies: D.enemies },
  });
  sim.cash = 1e9;
  const fuus = [];
  for (const [x, y] of [[4, 3], [10, 3], [16, 3], [4, 7], [10, 7], [16, 7], [7, 11], [13, 11]]) {
    const t = sim.placeTower('fuu', x, y);
    expect(t, `fuu at ${x},${y}`).toBeTruthy();
    // (eight final tiers is past the one-final-tier-per-path rule: the board buys them with `restoring`, the battle-save
    // path that skips that check, as perf.tenka.test.js does)
    for (let i = 0; i < 5; i++) expect(sim.upgradeTower(t.uid, 0, { restoring: true })).toBe(true);
    expect(t.abil.t5).toBe(true);
    fuus.push(t);
  }
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [];
  const len = sim.pathData[0].length;
  for (let i = 0; i < 300; i++) sim.spawnEnemy(KINDS[i % KINDS.length], { dist: 4 + (i / 300) * (len - 12), hpMul: 1e5 });
  return { sim, fuus };
}

/** ms per step over `steps` steps; `cast`: every Fuu casts on every step. */
function measure(sim, fuus, steps, cast) {
  let casts = 0;
  let moved = 0;
  const t0 = performance.now();
  for (let i = 0; i < steps; i++) {
    if (cast) {
      for (const t of fuus) {
        t.abil.cd = 0;
        if (sim.castAbility(t.uid).ok) casts++;
      }
    }
    sim.update(1 / 60);
    for (const ev of sim.drainEvents()) if (ev.type === 'ability') moved += ev.moved || 0;
  }
  return { ms: (performance.now() - t0) / steps, casts, moved };
}

describe('Backdraft Fan on a full board', () => {
  test('8 Fuus at tier 5 casting every step over 300 enemies: a step stays well under the perf budget', () => {
    const quiet = board();
    measure(quiet.sim, quiet.fuus, 120, false); // warm-up (the JIT)
    const base = measure(quiet.sim, quiet.fuus, 600, false);
    const busy = board();
    measure(busy.sim, busy.fuus, 120, true);
    const r = measure(busy.sim, busy.fuus, 600, true);
    console.log(`[perf backdraft] ${busy.sim.enemies.length} enemies, 8 Fuus: ${base.ms.toFixed(3)} ms/step without casts, ${r.ms.toFixed(3)} ms/step with ${r.casts} casts (${r.moved} pushes)`);
    expect(busy.sim.enemies.length).toBe(300);
    expect(r.casts).toBe(8 * 600);
    expect(r.moved).toBeGreaterThan(1000); // the push lock lets each enemy move once per 1.5 s (minibosses 3 s)
    // Shared CI runners are slow and noisy, so the wall-clock budget is looser there (CI=true).
    expect(r.ms).toBeLessThan(process.env.CI ? 6 : 2);
  }, 120000);
});

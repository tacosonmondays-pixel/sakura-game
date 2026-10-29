// Performance of the A4 deploys (src/sim/deploys.js): enough Kages, Suzus and Chikas on their ⚡ paths (one
// copy of each at tier 5, the rest at tier 4: one final tier per path), recast the moment each ability ends, to fill every sim-wide cap (DOUBLES_PER_SIM, BELL_TRAPS_PER_SIM,
// SURGE_DRONES_PER_SIM) on a road of 200 walkers. The caps must hold and a step must stay inside the budget.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP, DOUBLES_PER_SIM, BELL_TRAPS_PER_SIM, SURGE_DRONES_PER_SIM } from '../../src/sim/constants.js';
import { abilityPathOf } from '../../src/sim/abilities.js';

const TEAM = { kage: 21, suzu: 10, chika: 12 };

function scenario() {
  const sim = new Sim({ stageId: '4-5', difficulty: 'normal', loadout: Object.keys(TEAM).map((unitId) => ({ unitId, stats: { costMul: 0.01 } })), seed: 3, options: {} });
  sim.cash = 1e12;
  // (round robin, so every kind stands all along the road)
  const want = [];
  for (let i = 0; want.length < Object.values(TEAM).reduce((x, y) => x + y, 0); i++) for (const [id, n] of Object.entries(TEAM)) if (i < n) want.push(id);
  let k = 0;
  for (let y = 0.5; y < sim.map.height && k < want.length; y += 0.5) {
    for (let x = 0.5; x < sim.map.width && k < want.length; x += 0.5) {
      const id = want[k];
      if (sim.placement.pathDistance(x, y) > 1.6 || !sim.canPlace(id, x, y).ok) continue;
      const t = sim.placeTower(id, x, y);
      if (!t) continue;
      const p = abilityPathOf(t.def);
      for (let i = 0; i < 5; i++) sim.upgradeTower(t.uid, p);
      k++;
    }
  }
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [];
  const len = sim.pathData[0].length;
  for (let i = 0; i < 200; i++) {
    const e = sim.spawnEnemy(i % 3 ? 'orc_grunt' : 'slime_green', { pathIndex: 0, dist: (i / 200) * (len - 2), hpMul: 1e5 });
    e.baseSpeed *= 0.3;
  }
  return { sim, placed: k };
}

/** Every girl whose ability is not running recasts at once (the cooldown skipped). */
function recast(sim) {
  for (const t of sim.towers) {
    if (!t.abil || t.abil.active > 0) continue;
    t.abil.cd = 0;
    sim.castAbility(t.uid);
  }
}

const count = (sim) => ({
  doubles: (sim.deployables || []).length,
  traps: sim.traps.filter((tr) => tr.extra && !tr.strip).length,
  surge: sim.towers.reduce((a, t) => a + t.turrets.filter((d) => d.temp).length, 0),
});

describe('performance budget: the A4 deploys at their caps', () => {
  test('43 deploy girls recasting non-stop on 200 walkers: the caps hold and a step stays inside the budget', () => {
    const { sim, placed } = scenario();
    expect(placed).toBe(43);
    let most = { doubles: 0, traps: 0, surge: 0 };
    const note = () => {
      const c = count(sim);
      most = { doubles: Math.max(most.doubles, c.doubles), traps: Math.max(most.traps, c.traps), surge: Math.max(most.surge, c.surge) };
    };
    // (Bell Carpet traps fire once: on a busy road they go off about as fast as they are laid)
    let laid = 0;
    for (let i = 0; i < 240; i++) {
      recast(sim);
      sim.update(STEP);
      for (const e of sim.drainEvents()) if (e.type === 'trapPlaced' && e.extra) laid++;
      note();
    }
    const n = 1500; // 25 s: every girl recasts at least once (Bell Carpet runs 20 s)
    let ms = 0;
    for (let i = 0; i < n; i++) {
      recast(sim);
      const t0 = performance.now();
      sim.update(STEP);
      ms += performance.now() - t0;
      for (const e of sim.drainEvents()) if (e.type === 'trapPlaced' && e.extra) laid++;
      note();
    }
    const perStep = ms / n;
    console.log(`[perf] deploys at their caps (${most.doubles} doubles, ${most.traps} Bell Carpet traps at once of ${laid} laid, ${most.surge} surge drones), ${sim.enemies.length} enemies, ${sim.projectiles.length} projectiles: ${perStep.toFixed(3)} ms/step`);
    // the field fills up to (about) the doubles' and the surge's caps, and nothing ever passes one (the exact cap
    // rule: tests/sim/deploys.test.js)
    expect(most.doubles).toBeGreaterThanOrEqual(Math.floor(DOUBLES_PER_SIM * 0.9));
    expect(most.doubles).toBeLessThanOrEqual(DOUBLES_PER_SIM);
    expect(most.traps).toBeLessThanOrEqual(BELL_TRAPS_PER_SIM);
    expect(laid).toBeGreaterThan(100);
    expect(most.surge).toBeGreaterThanOrEqual(Math.floor(SURGE_DRONES_PER_SIM * 0.9));
    expect(most.surge).toBeLessThanOrEqual(SURGE_DRONES_PER_SIM);
    expect(sim.enemies.length).toBeGreaterThan(150);
    // Shared CI runners are slow and noisy, so the wall-clock budget is looser there (CI=true).
    expect(perStep).toBeLessThan(process.env.CI ? 12 : 6);
  }, 120000);
});

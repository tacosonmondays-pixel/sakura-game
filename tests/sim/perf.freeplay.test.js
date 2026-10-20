// Cost of late co-op freeplay waves (no cap on counts, owner, Oct 14): a fully built late board
// (60 girls, max gear) at wave 200 on 8-5 and wave 250 on 5-5 (hundreds of scheduled spawns, hundreds
// alive at once). Measured as this process's CPU time per 1/60 s step over the first 60 s of the wave
// (its whole spawn window), which a loaded machine distorts far less than wall time. At 3× speed the
// sim runs 180 steps per real second.
// The board is the cap-legal worst case (one final tier per path per girl type, owner Oct 15): every
// copy aims for its main path's tier 5, later copies of a type rotate their main path so each type
// holds as many tier 5s as the rule allows (the rest stop at 4-x-2), and two Midoris (brews on 3 and
// 4 girls) and a Chika (tune-up links + overclock) keep the limited-buff code in the budget.
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { samplePath } from '../../src/sim/path.js';
import { coopStage } from '../../src/data/coop.js';

// ★5, legendary +10 gear, average rolls (the "maxed" calibration build)
const MAXED = { damageMul: 2.87, rateMul: 1.53, rangeMul: 1, critChance: 0.39, critMul: 1.48, armorPen: 2, costMul: 1, ultHaste: 0, awakenPassive: true, level: 60, awaken: 5 };
const GIRLS = ['kage', 'shiro', 'aoi', 'akane', 'miko', 'momo', 'sango', 'yuki', 'umeko', 'midori', 'hotaru', 'chika'];
const CARRY = [
  ['kage', 0, 2], ['shiro', 0, 2], ['aoi', 1, 2], ['shiro', 2, 0], ['akane', 0, 2], ['kage', 2, 0], ['momo', 2, 0], ['sango', 1, 2],
  ['yuki', 0, 2], ['midori', 0, 2], ['miko', 0, 2], ['umeko', 0, 2], ['hotaru', 0, 2], ['midori', 2, 0], ['chika', 1, 2], ['kage', 1, 0],
  ['aoi', 0, 2], ['akane', 2, 0],
];

// gear's worst case (docs/specs/GEAR_STATS.md §D.4 perf a): UR_LATE's fastest rate (1.83, gear-awaken §7.5), Pierce at its
// cap and Pyrotechnics on every girl (Finale Pop everywhere, one battle-wide budget), burns × 1.25
const UR_CROWD = { ...MAXED, damageMul: 3.97, rateMul: 1.83, rangeMul: 1.3, critChance: 0.58, critMul: 2.23, armorPen: 6.6, pierceK: 150, dotMul: 1.25, club: 'pyro', clubN: 3 };

function lateBoard(stageId, tier, wave, towers, stats = MAXED) {
  const stage = coopStage(stageId, { freeplay: tier });
  const sim = new Sim({ stageId, loadout: GIRLS.map((unitId) => ({ unitId, stats })), hero: { unitId: 'hikari', stats }, seed: 5, options: { freeplay: true }, data: { stage } });
  sim.cash = 1e15;
  const samples = sim.pathData.flatMap((p) => samplePath(p, 0.5)).filter((s) => !s.hidden);
  const lattice = [];
  for (let y = 0.3; y < sim.map.height; y += 0.25) for (let x = 0.3; x < sim.map.width; x += 0.25) lattice.push({ x: x + 0.013, y: y + 0.007 });
  const ranked = new Map();
  const best = (r) => {
    if (!ranked.has(r)) {
      ranked.set(r, lattice.map((c) => ({ ...c, cov: samples.reduce((a, s) => a + ((s.x - c.x) * (s.x - c.x) + (s.y - c.y) * (s.y - c.y) <= r * r ? 1 : 0), 0) }))
        .filter((c) => c.cov > 0).sort((a, b) => b.cov - a.cov));
    }
    return ranked.get(r);
  };
  const hs = best(3).find((c) => sim.canPlace('hikari', c.x, c.y).ok);
  if (hs) sim.placeTower('hikari', hs.x, hs.y);
  let placed = 0;
  for (let i = 0; placed < towers && i < 600; i++) {
    const [u, main, cross] = CARRY[i % CARRY.length];
    const spot = best(sim.data.unit(u).base.range || 3).find((c) => sim.canPlace(u, c.x, c.y).ok);
    if (!spot) continue;
    const t = sim.placeTower(u, spot.x, spot.y);
    if (!t) continue;
    placed++;
    for (let k = 0; k < 5; k++) sim.upgradeTower(t.uid, main); // a held final tier stops this copy at 4
    for (let k = 0; k < 2; k++) sim.upgradeTower(t.uid, cross);
    if (u === 'shiro' && main === 0) sim.setTargetMode(t.uid, 'strong');
  }
  sim.lives = 1e12; // simulate the whole wave, leaks and all
  sim.wave = wave - 1;
  sim.wavesCleared = wave - 1;
  sim.state = 'between';
  sim.startNextWave();
  return { sim, placed };
}

function measure(sim, steps) {
  let maxAlive = 0;
  let maxProj = 0;
  const c0 = process.cpuUsage();
  let n = 0;
  for (; n < steps && sim.state === 'wave'; n++) {
    sim.update(1 / 60);
    sim.drainEvents();
    maxAlive = Math.max(maxAlive, sim.enemies.length);
    maxProj = Math.max(maxProj, sim.projectiles.length);
  }
  const c = process.cpuUsage(c0);
  return { msPerStep: (c.user + c.system) / 1000 / Math.max(1, n), steps: n, maxAlive, maxProj };
}

describe('late freeplay cost (CPU per step)', () => {
  it('wave 200 on 8-5 (Blossom, the Matriarch) with 60 upgraded girls stays under 2 ms a step', () => {
    const { sim, placed } = lateBoard('8-5', 'blossom', 200, 60);
    expect(placed).toBe(60);
    const r = measure(sim, 3600);
    console.log(`[perf freeplay] 8-5 wave 200: ${r.msPerStep.toFixed(3)} ms/step over ${r.steps} steps, ${r.maxAlive} alive, ${r.maxProj} projectiles`);
    expect(r.msPerStep).toBeLessThan(process.env.CI ? 6 : 2);
  }, 240000);

  it('the same board in rainbow gear, Pierce at its cap and Pyrotechnics on every girl stays under 2 ms a step', () => {
    const { sim, placed } = lateBoard('8-5', 'blossom', 200, 60, UR_CROWD);
    expect(placed).toBe(60);
    const r = measure(sim, 3600);
    console.log(`[perf freeplay] 8-5 wave 200, UR + Pierce + Pyrotechnics: ${r.msPerStep.toFixed(3)} ms/step over ${r.steps} steps, ${r.maxAlive} alive, ${r.maxProj} projectiles, pop budget ${sim.popBudget}`);
    expect(r.msPerStep).toBeLessThan(process.env.CI ? 6 : 2);
  }, 240000);

  // The peak of the heaviest wave we know: all 908 spawns enter within 50 s and (at ×760k HP) none
  // of them dies, so ~900 enemies walk at once. The owner accepts lag this deep (no cap), so this
  // is a regression guard, not a frame budget: 4.5-5 ms a step measured on a loaded 4-core box
  // (~1.1× real time at 3× speed).
  it('wave 250 on 5-5 (908 scheduled spawns, no cap) stays under 8 ms a step at its peak', () => {
    const { sim, placed } = lateBoard('5-5', 'blossom', 250, 60);
    expect(placed).toBe(60);
    expect(sim._getWave(250).spawns.length).toBeGreaterThan(800);
    const r = measure(sim, 3600);
    console.log(`[perf freeplay] 5-5 wave 250: ${r.msPerStep.toFixed(3)} ms/step over ${r.steps} steps, ${r.maxAlive} alive, ${r.maxProj} projectiles`);
    expect(r.maxAlive).toBeGreaterThan(300);
    expect(r.msPerStep).toBeLessThan(process.env.CI ? 20 : 8);
  }, 240000);
});

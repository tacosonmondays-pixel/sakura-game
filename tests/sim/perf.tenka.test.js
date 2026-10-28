// Cost of Tenka's zones at late co-op freeplay density (BUILD_PLAN 6.9 T1, GAPS 7.2): the late board of
// perf.freeplay.test.js (60 upgraded girls, max gear) on its heaviest wave (250 on 5-5: 908 scheduled
// spawns, hundreds alive at once) plus 6
// Tenkas at 0-2-5 (Gravity Well + Deep Well + Last Line: 6 wells and 6 Last Lines, the per-player zone
// cap), against the same board with the 6 at 0-2-2. Singularity tiers 3-5 add only the zone keys, so
// 0-2-2 is the battle this branch played before T1 (tests/sim/tenka.test.js pins that 0-2-2 opens
// nothing and never checks the exit). Measured as this process's CPU time per 1/60 s step over the
// first 120 s of the wave (its spawn window, then the stretch where the crowd reaches the exits, so Last
// Line opens and swallows inside the window), after a short warm-up run; the two boards interleaved twice,
// the faster run of each kept.
// Six copies of her final tier is past the one-final-tier-per-path rule (a player holds one Last Line;
// co-op two): the board buys them with `restoring`, the battle-save path that skips that check.
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { samplePath } from '../../src/sim/path.js';
import { coopStage } from '../../src/data/coop.js';

const MAXED = { damageMul: 2.87, rateMul: 1.53, rangeMul: 1, critChance: 0.39, critMul: 1.48, armorPen: 2, costMul: 1, ultHaste: 0, awakenPassive: true, level: 60, awaken: 5 };
const GIRLS = ['kage', 'shiro', 'aoi', 'akane', 'miko', 'momo', 'sango', 'yuki', 'umeko', 'midori', 'hotaru', 'chika', 'tenka'];
const CARRY = [
  ['kage', 0, 2], ['shiro', 0, 2], ['aoi', 1, 2], ['shiro', 2, 0], ['akane', 0, 2], ['kage', 2, 0], ['momo', 2, 0], ['sango', 1, 2],
  ['yuki', 0, 2], ['midori', 0, 2], ['miko', 0, 2], ['umeko', 0, 2], ['hotaru', 0, 2], ['midori', 2, 0], ['chika', 1, 2], ['kage', 1, 0],
  ['aoi', 0, 2], ['akane', 2, 0],
];
const TENKAS = 6;
const RAILS = 1;
const SING = 2;

function board(sing) {
  const stage = coopStage('5-5', { freeplay: 'blossom' });
  const sim = new Sim({ stageId: '5-5', loadout: GIRLS.map((unitId) => ({ unitId, stats: MAXED })), hero: { unitId: 'hikari', stats: MAXED }, seed: 5, options: { freeplay: true }, data: { stage } });
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
  for (let i = 0; placed < 60 && i < 600; i++) {
    const [u, main, cross] = CARRY[i % CARRY.length];
    const spot = best(sim.data.unit(u).base.range || 3).find((c) => sim.canPlace(u, c.x, c.y).ok);
    if (!spot) continue;
    const t = sim.placeTower(u, spot.x, spot.y);
    if (!t) continue;
    placed++;
    for (let k = 0; k < 5; k++) sim.upgradeTower(t.uid, main);
    for (let k = 0; k < 2; k++) sim.upgradeTower(t.uid, cross);
    if (u === 'shiro' && main === 0) sim.setTargetMode(t.uid, 'strong');
  }
  const tenkas = [];
  for (let i = 0; tenkas.length < TENKAS && i < 40; i++) {
    const spot = best(3.4).find((c) => sim.canPlace('tenka', c.x, c.y).ok);
    if (!spot) break;
    const t = sim.placeTower('tenka', spot.x, spot.y);
    for (let k = 0; k < 2; k++) sim.upgradeTower(t.uid, RAILS);
    for (let k = 0; k < sing; k++) sim.upgradeTower(t.uid, SING, { restoring: true });
    tenkas.push(t);
  }
  sim.lives = 1e12; // simulate the whole wave, leaks and all
  sim.wave = 249;
  sim.wavesCleared = 249;
  sim.state = 'between';
  sim.startNextWave();
  return { sim, placed, tenkas };
}

function measure(sim, steps) {
  let maxAlive = 0;
  let maxZones = 0;
  const c0 = process.cpuUsage();
  let n = 0;
  for (; n < steps && sim.state === 'wave'; n++) {
    sim.update(1 / 60);
    sim.drainEvents();
    if (sim.enemies.length > maxAlive) maxAlive = sim.enemies.length;
    if (sim.zones && sim.zones.length > maxZones) maxZones = sim.zones.length;
  }
  const c = process.cpuUsage(c0);
  return { usPerStep: (c.user + c.system) / Math.max(1, n), steps: n, maxAlive, maxZones };
}

describe('Tenka zones at late freeplay density (CPU per step)', () => {
  it('6 Tenkas at 0-2-5 cost at most +10% a step over the same board at 0-2-2', () => {
    const runs = { 2: [], 5: [] };
    let last = null;
    measure(board(5).sim, 600); // warm-up (the JIT), not counted
    for (const sing of [2, 5, 2, 5]) {
      const { sim, placed, tenkas } = board(sing);
      expect(placed).toBe(60);
      expect(tenkas.map((t) => t.tiers.join('-'))).toEqual(Array(TENKAS).fill(`0-2-${sing}`));
      const r = measure(sim, 7200);
      expect(r.maxAlive).toBeGreaterThan(300);
      if (sing === 5) {
        expect(r.maxZones).toBeGreaterThan(1);
        expect(sim.stats.wells).toBeGreaterThan(TENKAS);
        expect(sim.stats.lastLines).toBeGreaterThan(0);
        expect(sim.stats.swallowed).toBeGreaterThan(0);
        last = { wells: sim.stats.wells, lastLines: sim.stats.lastLines || 0, swallowed: sim.stats.swallowed || 0, leaks: sim.stats.enemiesLeaked };
      } else {
        expect(sim.zones).toBeUndefined();
        r.leaks = sim.stats.enemiesLeaked;
      }
      runs[sing].push(r);
    }
    const best = (k) => Math.min(...runs[k].map((r) => r.usPerStep));
    const ratio = best(5) / best(2);
    console.log(`[perf tenka] 5-5 wave 250 + 6 Tenkas: 0-2-2 ${runs[2].map((r) => r.usPerStep.toFixed(0)).join(' / ')} µs/step, 0-2-5 ${runs[5].map((r) => r.usPerStep.toFixed(0)).join(' / ')} µs/step`
      + ` → ×${ratio.toFixed(3)}; alive ≤ ${runs[5][0].maxAlive} (0-2-2: ${runs[2][0].maxAlive}), zones ≤ ${runs[5][0].maxZones}; wells ${last.wells}, Last Lines ${last.lastLines}, swallowed ${last.swallowed}, leaked ${last.leaks} (0-2-2: ${runs[2][0].leaks})`);
    expect(ratio).toBeLessThanOrEqual(process.env.CI ? 1.5 : 1.1);
  }, 600000);
});

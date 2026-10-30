// Cost of Iroha's mirror network (src/sim/mirrors.js, docs/specs/IROHA_MIRRORS.md §6): a full board of shots
// crossing mirrors. 24 Aois at Rapid Volley tier 5 and 6 Irohas at Mirror Hall tier 5 + Shattered Glass 2 (5 mirrors
// each, all placed in the crowd; Infinite Reflection: every mirror reflects allies' shots for good, each copy bounces
// twice; their routed bolts bounce 5 times; their Laser Webs run, 10 beams each) against 300 unkillable enemies packed
// on one leg of a serpentine road, measured as wall time per 1/60 s step; against the same board with the Irohas at
// tier 4 (4 mirrors, routed bolts, their webs over and no reflection). A split shot is a real second shot (more flight,
// more hits), so the bound is on the whole step.
import { describe, test, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STAGE, ENEMIES } from './fixtures.js';
import { defaultData } from '../../src/sim/data.js';
import { abilityPathOf } from '../../src/sim/abilities.js';
import { collectMirrors, MIRROR_GATHER } from '../../src/sim/mirrors.js';

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
const BLOB = { ...ENEMIES.slime, id: 'blob', hp: 1e12, speed: 0.4 };

function board(irohaTier, { kaleido = false } = {}) {
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
    const id = irohas.length < 6 && i % 7 === 3 ? 'iroha' : 'aoi';
    if (id === 'aoi' && aois >= 24) continue;
    const t = sim.placeTower(id, spots[i][0], spots[i][1]);
    if (!t) continue;
    const p = abilityPathOf(t.def);
    if (id === 'iroha' && kaleido) {
      // Shattered Glass 5 + Mirror Hall 2 (2-0-5): splash and two shards on every bounce, three mirrors
      for (let k = 0; k < 5; k++) sim.upgradeTower(t.uid, 2, { restoring: true });
      for (let k = 0; k < 2; k++) sim.upgradeTower(t.uid, 0, { restoring: true });
    } else {
      for (let k = 0; k < (id === 'iroha' ? irohaTier : 5); k++) sim.upgradeTower(t.uid, p, { restoring: true });
      if (id === 'iroha') for (let k = 0; k < 2; k++) sim.upgradeTower(t.uid, 2, { restoring: true });
    }
    if (id === 'iroha') irohas.push(t);
    else aois++;
  }
  sim.state = 'wave';
  sim.wave = 1;
  sim._spawnQueue = [{ t: 1e9, enemy: 'blob' }];
  sim._spawnIndex = 0;
  // the middle leg runs from x 20.5 (dist 25) to x 1.5 (dist 44): dist 29–36 is x 16.5–9.5
  for (let i = 0; i < 300; i++) {
    const e = sim.spawnEnemy('blob', { dist: 29 + (i / 300) * 7 });
    e.baseSpeed = 0;
    e.speed = 0;
  }
  sim.update(1 / 60);
  // each Iroha's mirrors placed along the crowd (clamped to her reach), then her Laser Web
  irohas.forEach((t, i) => {
    for (let k = 0; k < t.mirrors.length; k++) expect(sim.setAim(t.uid, 9.5 + ((i + k * 3) % 8), 5 + (k % 2) * 0.5, k)).toBe(true);
    if (!t.abil) return;
    t.abil.cd = 0;
    expect(sim.castAbility(t.uid).ok).toBe(true);
  });
  return { sim, irohas, aois };
}

function measure(sim, steps) {
  let splits = 0;
  let bounces = 0;
  let maxProj = 0;
  let worst = 0;
  const each = [];
  const t0 = performance.now();
  for (let i = 0; i < steps; i++) {
    const s0 = performance.now();
    sim.update(1 / 60);
    const d = performance.now() - s0;
    if (d > worst) worst = d;
    each.push(d);
    for (const ev of sim.drainEvents()) {
      if (ev.type === 'mirrorSplit') splits++;
      else if (ev.type === 'mirrorBounce') bounces++;
    }
    if (sim.projectiles.length > maxProj) maxProj = sim.projectiles.length;
  }
  each.sort((a, b) => a - b);
  // (the worst single step carries a GC pause now and then: p99 is the step bound, the max only a loose one)
  const p99 = each[Math.min(each.length - 1, Math.floor(each.length * 0.99))];
  return { ms: (performance.now() - t0) / steps, worst, p99, splits, bounces, maxProj };
}

describe('mirror network at full board (wall time per step)', () => {
  test('30 mirrors over 24 tier-5 Aois and 6 tier-5 Irohas (all reflecting, under MIRROR_GATHER): the step stays within budget and at most ×3 of the tier-4 board', () => {
    measure(board(5).sim, 120); // warm-up (the JIT), not counted
    const runs = { 4: [], 5: [] };
    for (const tier of [4, 5, 4, 5]) {
      const { sim, irohas, aois } = board(tier);
      expect(aois).toBe(24);
      expect(irohas.length).toBe(6);
      for (const t of irohas) expect(t.mirrors).toHaveLength(tier);
      // tier 4: the windows are open right after the casts
      expect(collectMirrors(sim)).toBe(Math.min(MIRROR_GATHER, 6 * tier));
      runs[tier].push(measure(sim, 90)); // inside the webs
      measure(sim, 9 * 60); // past both windows
      expect(collectMirrors(sim)).toBe(tier === 5 ? Math.min(MIRROR_GATHER, 30) : 0);
      runs[tier].push(measure(sim, 90));
    }
    const best = (k) => Math.min(...runs[k].map((r) => r.ms));
    const worst = (k) => Math.max(...runs[k].map((r) => r.ms));
    const ratio = best(5) / best(4);
    console.log(`[perf mirror] tier 4 ${runs[4].map((r) => r.ms.toFixed(3)).join(' / ')} ms/step (≤ ${runs[4][0].maxProj} shots, ${runs[4][0].bounces} bounces), tier 5 ${runs[5].map((r) => r.ms.toFixed(3)).join(' / ')} ms/step (≤ ${runs[5][0].maxProj} shots, ${runs[5][1].splits} splits, ${runs[5][1].bounces} bounces in 1.5 s) → ×${ratio.toFixed(2)}`);
    expect(runs[4][1].splits).toBe(0);
    expect(runs[4][0].bounces).toBeGreaterThan(100);
    expect(runs[5][1].splits).toBeGreaterThan(100);
    expect(worst(5)).toBeLessThan(process.env.CI ? 16 : 8);
    expect(ratio).toBeLessThanOrEqual(process.env.CI ? 4 : 3);
    // the worst single step (the webs' ticks land on one step: 6 webs × 10 beams of grid queries)
    const peak = Math.max(...runs[5].map((r) => r.worst));
    const p99 = Math.min(...runs[5].map((r) => r.p99));
    console.log(`[perf mirror] tier-5 step p99 ${p99.toFixed(2)} ms, worst ${peak.toFixed(2)} ms`);
    expect(p99).toBeLessThan(process.env.CI ? 24 : 12);
    expect(peak).toBeLessThan(process.env.CI ? 150 : 80);
  }, 180000);

  test('6 Kaleidoscope Irohas (2-0-5: splash and two shards a bounce) over the same board: within budget, shards capped', () => {
    measure(board(0, { kaleido: true }).sim, 60);
    const { sim, irohas } = board(0, { kaleido: true });
    for (const t of irohas) expect(t.stats.relay.shards).toBe(2);
    const r = measure(sim, 180);
    console.log(`[perf mirror] kaleidoscope ${r.ms.toFixed(3)} ms/step, p99 ${r.p99.toFixed(2)} ms, worst ${r.worst.toFixed(2)} ms (≤ ${r.maxProj} shots, ${r.bounces} bounces in 3 s)`);
    expect(r.bounces).toBeGreaterThan(100);
    expect(r.ms).toBeLessThan(process.env.CI ? 16 : 8);
    expect(r.p99).toBeLessThan(process.env.CI ? 24 : 12);
    expect(r.worst).toBeLessThan(process.env.CI ? 150 : 80);
  }, 180000);
});

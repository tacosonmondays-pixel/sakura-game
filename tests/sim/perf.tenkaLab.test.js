// Cost of Tenka's lab weapons at late co-op freeplay density (T2 review refactor-2; UNIT_GAPS §8 wave 3 and
// §7.2: her own performance gate, next to perf.tenka.test.js's zones gate). The late board of
// perf.tenka.test.js (60 upgraded girls, max gear, wave 250 on 5-5: hundreds alive at once) with its 6 Tenkas
// at 5-2-0: Joint Research has the girls around each one join her lab team (every class across the six), the
// first buys Unified Theory normally (a second absorb), the other five take tier 5 with `restoring` (past the
// one-final-tier rule, as in perf.tenka.test.js; a restore never absorbs).
// The Sim's own updateLab call is gated off (sim._labOn = 0) and the test calls updateLab itself right after
// each step, timing only that call: the lab's own cost on one workload, rather than two battles that diverge
// as soon as the grenades start killing. That covers the frag grenades (her aim while nobody is in range,
// bestTarget, explode) and the control field (grid.each, the slow status). Not timed here: the dps weapon's
// extra bolts and the support aura, which are ordinary projectiles and auras (updateTower, recomputeBuffs).
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { updateLab } from '../../src/sim/lab.js';
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
const LAB = 0;
const RAILS = 1;

function board() {
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
    for (let k = 0; k < 5; k++) sim.upgradeTower(t.uid, LAB, k === 4 && tenkas.length > 0 ? { restoring: true } : undefined);
    tenkas.push(t);
  }
  sim.lives = 1e12; // simulate the whole wave, leaks and all
  sim.wave = 249;
  sim.wavesCleared = 249;
  sim.state = 'between';
  sim.startNextWave();
  sim.drainEvents();
  return { sim, placed, tenkas };
}

/** Steps the wave with the Sim's own lab pass gated off, timing the step and a separate updateLab call. */
function measure(sim, steps) {
  let stepNs = 0n;
  let labNs = 0n;
  let frags = 0;
  let reArmed = 0;
  let maxAlive = 0;
  let n = 0;
  sim._labOn = 0;
  for (; n < steps && sim.state === 'wave'; n++) {
    const a = process.hrtime.bigint();
    sim.update(1 / 60);
    const b = process.hrtime.bigint();
    // (a refresh mid-wave re-arms the Sim's own pass: gate it off again so only the timed call runs)
    if (sim._labOn) {
      reArmed++;
      sim._labOn = 0;
    }
    updateLab(sim);
    const c = process.hrtime.bigint();
    stepNs += b - a;
    labNs += c - b;
    for (const ev of sim.drainEvents()) if (ev.type === 'labFrag') frags++;
    if (sim.enemies.length > maxAlive) maxAlive = sim.enemies.length;
  }
  return { steps: n, stepUs: Number(stepNs) / n / 1000, labUs: Number(labNs) / n / 1000, share: Number(labNs) / Number(stepNs), frags, reArmed, maxAlive };
}

describe('Tenka\'s lab weapons at late freeplay density (time per step)', () => {
  it('6 lab Tenkas: their frag and control weapons (updateLab) take at most 3% of a step', () => {
    measure(board().sim, 600); // warm-up (the JIT), not counted
    const runs = [];
    for (let rep = 0; rep < 2; rep++) {
      const { sim, placed, tenkas } = board();
      expect(placed).toBe(60);
      expect(tenkas.map((t) => t.tiers.join('-'))).toEqual(Array(TENKAS).fill('5-2-0'));
      // every one has a lab; between them her girls joined in numbers, and both timed weapons are armed
      expect(tenkas.every((t) => t.lab && t.lab.rounds >= 1)).toBe(true);
      expect(tenkas[0].lab.rounds).toBe(2);
      expect(tenkas.reduce((s, t) => s + t.lab.uids.length, 0)).toBeGreaterThan(20);
      expect(tenkas.some((t) => t.labAtk.frag > 0)).toBe(true);
      expect(tenkas.some((t) => t.labAtk.slow > 0)).toBe(true);
      const r = measure(sim, 4000);
      expect(r.steps).toBe(4000);
      expect(r.maxAlive).toBeGreaterThan(300);
      expect(r.frags).toBeGreaterThan(0);
      runs.push({ ...r, joined: tenkas.map((t) => t.lab.uids.length) });
    }
    const share = Math.min(...runs.map((r) => r.share));
    console.log(`[perf tenka lab] 5-5 wave 250 + 6 Tenkas at 5-2-0 (joined ${runs[0].joined.join('/')}): step ${runs.map((r) => r.stepUs.toFixed(0)).join(' / ')} µs,`
      + ` updateLab ${runs.map((r) => r.labUs.toFixed(2)).join(' / ')} µs → ${(100 * share).toFixed(2)}% of a step; grenades ${runs[0].frags}, alive ≤ ${runs[0].maxAlive}, re-armed ${runs[0].reArmed}`);
    expect(share).toBeLessThanOrEqual(process.env.CI ? 0.1 : 0.03);
  }, 600000);
});

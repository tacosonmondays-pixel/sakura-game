// Potential's live rows in the battle panel (src/ui/battle/potentialRows.js; docs/specs/POTENTIAL.md
// v3 §11, v2 §7.5): a real battle with Kage and Chika at P6 (and Aoi at P1), stepped until they have
// attacked. The rows read the same sim fields the battle uses; the DOM is driven in e2e/potential.mjs.
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP } from '../../src/sim/constants.js';
import { unitBattleStats } from '../../src/systems/progression.js';
import { potentialRows, potentialRowText, ordinal } from '../../src/ui/battle/potentialRows.js';

const stats = (id, p) => ({ ...unitBattleStats(null, id), potential: p });

/** Steps the battle (starting each next wave) until `done()`, at most `max` steps. */
function runUntil(sim, done, max = 60000) {
  for (let i = 0; i < max && !done(); i++) {
    if (sim.state === 'between' || sim.state === 'prep') sim.startNextWave();
    sim.update(STEP);
  }
}

function battle() {
  const sim = new Sim({
    stageId: '1-3',
    difficulty: 'normal',
    loadout: [{ unitId: 'kage', stats: stats('kage', 6) }, { unitId: 'chika', stats: stats('chika', 6) }, { unitId: 'aoi', stats: stats('aoi', 1) }],
    hero: null,
    seed: 77,
    options: { autoStart: false },
  });
  sim.cash = 1e6;
  const placed = {};
  for (const id of ['kage', 'chika', 'aoi']) {
    for (let y = 0.5; y < sim.map.height && !placed[id]; y += 0.5) {
      for (let x = 0.5; x < sim.map.width && !placed[id]; x += 0.5) {
        if (sim.canPlace(id, x, y).ok && sim.placement.pathDistance(x, y) < 1.2) placed[id] = sim.placeTower(id, x, y);
      }
    }
  }
  return { sim, ...placed };
}

describe('battle panel: Potential rows', () => {
  it('Kage P6: storm pips (every 6th), tempo pips (6), shuriken per throw with the carry; Aoi P1: none', () => {
    const { sim, kage, aoi } = battle();
    expect(kage && aoi).toBeTruthy();
    const st0 = sim.towerStats(kage.uid);
    const rows0 = potentialRows(kage, st0);
    expect(rows0.map((r) => r.key)).toEqual(['rhythm', 'tempo', 'shots']);
    expect(rows0[0]).toMatchObject({ name: 'Shuriken Storm', every: 6, count: 0, of: 'attack' });
    expect(rows0[1]).toMatchObject({ name: 'Shadow Tempo', stacks: 0, max: 6, bonus: 0 });
    expect(rows0[2]).toMatchObject({ label: 'Shuriken', base: st0.projectiles });
    expect(rows0[2].avg).toBeCloseTo(st0.projectiles * 1.12, 12);
    expect(potentialRowText(rows0[0])).toBe('every 6th');
    expect(potentialRowText(rows0[2])).toBe(`${st0.projectiles} → ${+(st0.projectiles * 1.12).toFixed(2)} / throw`);
    expect(potentialRows(aoi, sim.towerStats(aoi.uid))).toEqual([]);

    // (a moment inside an unbroken run: tempo fades after 1 s without a throw)
    runUntil(sim, () => (kage.potCount || 0) >= 9 && kage.tempoStacks > 1);
    const st = sim.towerStats(kage.uid);
    const rows = potentialRows(kage, st);
    // the pips are her throws since the last storm; the tempo pips her unbroken run
    expect(rows[0].count).toBe(kage.potCount % 6);
    expect(rows[1].stacks).toBe(kage.tempoStacks);
    expect(rows[1].stacks).toBeGreaterThan(0);
    expect(rows[1].stacks).toBeLessThanOrEqual(6);
    expect(potentialRowText(rows[1])).toBe(`+${Math.round(kage.tempoStacks)}%`);
  });

  it('Chika P6: her drones\' overclock counts down to the next burst, then shows the time left', () => {
    const { sim, chika } = battle();
    expect(chika).toBeTruthy();
    const r0 = potentialRows(chika, sim.towerStats(chika.uid)).find((r) => r.key === 'overclock');
    // the data's every / time / rate after step order: P6's every 20 and ×1.75, P4's 6 s
    expect(r0).toMatchObject({ name: 'Throttle Up', left: 0, rateMul: 1.75 });
    expect(r0.next).toBe(20 - 6);
    expect(potentialRowText(r0)).toBe('in 14 s');
    runUntil(sim, () => chika.potOc?.left > 0);
    const r1 = potentialRows(chika, sim.towerStats(chika.uid)).find((r) => r.key === 'overclock');
    expect(r1.left).toBeGreaterThan(0);
    expect(potentialRowText(r1)).toMatch(/^\+75% · [1-6] s left$/);
  });

  it('ordinals', () => {
    expect([1, 2, 3, 4, 5, 6, 10, 11, 12, 13, 21, 22, 23].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '5th', '6th', '10th', '11th', '12th', '13th', '21st', '22nd', '23rd']);
    expect(potentialRowText({ key: 'rhythm', every: 4, of: 'trap' })).toBe('every 4th trap');
  });
});

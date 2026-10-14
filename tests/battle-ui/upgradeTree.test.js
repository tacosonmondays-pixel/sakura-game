// In-battle Upgrade Tree (owner request #152): the prices it shows must be the sim's prices,
// its locks must be the sim's locks, and reading it must never change the battle.
import { describe, it, expect } from 'vitest';
import { Sim, roundCost } from '../../src/sim/Sim.js';
import { createBattleSim } from '../../src/ui/battle/setup.js';
import { createProfile } from '../../src/systems/save.js';
import { unitBattleStats } from '../../src/systems/progression.js';
import { UNIT_MAP } from '../../src/data/units.js';
import { buildTreeModel } from '../../src/ui/treeModel.js';
import { liveCostOf, previewCostOf, treeArgs, unitStatsFor } from '../../src/ui/battle/upgradeTree.js';

/** First free spot for `unitId`, optionally within `r` tiles of (cx, cy). */
function spotFor(sim, unitId, near = null, r = 0) {
  for (let y = 0; y < sim.map.height; y++) {
    for (let x = 0; x < sim.map.width; x++) {
      if (near && Math.hypot(x + 0.5 - near[0], y + 0.5 - near[1]) > r) continue;
      if (sim.canPlace(unitId, x, y).ok) return [x, y];
    }
  }
  return null;
}

function soloSim({ difficulty = 'hard', loadout = null } = {}) {
  const profile = createProfile();
  if (!loadout) return createBattleSim(profile, { stageId: '1-1', difficulty, seed: 11 }).sim;
  return new Sim({
    stageId: '1-1',
    difficulty,
    loadout: loadout.map((unitId) => ({ unitId, stats: unitBattleStats(profile, unitId) })),
    hero: null,
    seed: 11,
  });
}

const snapshot = (sim) => JSON.stringify({ cash: sim.cash, state: sim.state, towers: sim.towers.map((t) => ({ uid: t.uid, tiers: t.tiers, spent: t.spent })) });

describe('upgrade tree costs match the sim', () => {
  it('live cost equals upgradeStatus().cost for every open path, across tier combinations', () => {
    const sim = soloSim();
    sim.cash = 1e9;
    const unitId = [...sim.loadout.keys()][0];
    const spot = spotFor(sim, unitId);
    expect(spot).toBeTruthy();
    for (const combo of [[0, 0, 0], [2, 0, 0], [0, 2, 3], [5, 2, 0]]) {
      const t = sim.placeTower(unitId, ...spot);
      for (let p = 0; p < 3; p++) for (let k = 0; k < combo[p]; k++) expect(sim.upgradeTower(t.uid, p)).toBe(true);
      const costOf = liveCostOf(sim, t);
      const model = buildTreeModel(treeArgs(sim, { uid: t.uid }));
      for (let p = 0; p < 3; p++) {
        const st = sim.upgradeStatus(t.uid, p);
        if (!st.next) continue;
        expect(costOf(st.next)).toBe(st.cost);
        expect(model.rows[p].cells[t.tiers[p]].cost).toBe(st.cost);
        // locks agree: the next cell is blocked exactly when the sim says crosspath
        expect(model.rows[p].cells[t.tiers[p]].state === 'blocked').toBe(st.reason === 'crosspath');
      }
      sim.sellTower(t.uid);
    }
  });

  it('applies a discount aura the same way the sim does (and not to the girl giving it)', () => {
    const sim = soloSim({ loadout: ['momo', 'aoi'] });
    sim.cash = 1e9;
    const mSpot = spotFor(sim, 'momo');
    const momo = sim.placeTower('momo', ...mSpot);
    // Savings Pact (path 2) to T3: a cost-cut aura
    for (let k = 0; k < 3; k++) expect(sim.upgradeTower(momo.uid, 1)).toBe(true);
    const aSpot = spotFor(sim, 'aoi', [momo.x, momo.y], 1.8);
    expect(aSpot).toBeTruthy();
    const aoi = sim.placeTower('aoi', ...aSpot);
    expect(aoi.buff?.costCut || 0).toBeGreaterThan(0);
    for (const [t, label] of [[aoi, 'aoi'], [momo, 'momo']]) {
      const costOf = liveCostOf(sim, t);
      for (let p = 0; p < 3; p++) {
        const st = sim.upgradeStatus(t.uid, p);
        if (st.next) expect(costOf(st.next), `${label} path ${p}`).toBe(st.cost);
      }
    }
    expect(momo.buff?.costCut || 0).toBe(0);
  });

  it('preview cost uses the stage difficulty and her formation stats', () => {
    const sim = soloSim({ difficulty: 'hard' });
    for (const unitId of sim.loadout.keys()) {
      const us = unitStatsFor(sim, unitId);
      const costOf = previewCostOf(sim, unitId);
      for (const path of UNIT_MAP[unitId].paths) {
        for (const tier of path.tiers) {
          expect(costOf(tier)).toBe(roundCost(tier.cost * (sim.diff.costMul ?? 1) * (us?.costMul ?? 1)));
        }
      }
      const args = treeArgs(sim, { unitId });
      expect(args.mode).toBe('preview');
      expect(args.deployCost).toBe(sim.placeCost(unitId));
    }
  });

  it('reading the tree 100 times never changes the battle', () => {
    const sim = soloSim();
    sim.cash = 5000;
    const unitId = [...sim.loadout.keys()][0];
    const t = sim.placeTower(unitId, ...spotFor(sim, unitId));
    sim.upgradeTower(t.uid, 0);
    for (let i = 0; i < 30; i++) sim.update(0.1);
    const before = snapshot(sim);
    const rng = JSON.stringify(sim.rng);
    for (let i = 0; i < 100; i++) {
      buildTreeModel(treeArgs(sim, { uid: t.uid }));
      buildTreeModel(treeArgs(sim, { unitId }));
    }
    expect(snapshot(sim)).toBe(before);
    expect(JSON.stringify(sim.rng)).toBe(rng);
  });

  it('a co-op ally girl reads as view-only with no affordability', () => {
    const sim = soloSim();
    sim.cash = 5000;
    const unitId = [...sim.loadout.keys()][0];
    const t = sim.placeTower(unitId, ...spotFor(sim, unitId));
    const coop = { isMine: () => false, ownerName: () => 'Chuu' };
    const model = buildTreeModel(treeArgs(sim, { uid: t.uid }, { coop }));
    expect(model.mode).toBe('ally');
    expect(model.ownerName).toBe('Chuu');
    expect(model.rows.flatMap((r) => r.cells).every((c) => c.afford === null)).toBe(true);
  });
});

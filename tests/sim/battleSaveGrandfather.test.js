// Battle saves made before the one-per-path rule (train A, src/ui/battle/snapshot.js restoreSim) replay
// every saved girl's tiers through Sim.upgradeTower and drop (and refund) a girl whose replay fails. A save
// holding two copies with the same final tier must restore both: the restore passes { restoring: true }.
// This file emulates train A's restore loop on this base (the snapshot module is not here) so the hook the
// train-C integrator wires is pinned: see docs/merge/PATH_CAP.md "Battle saves".
import { describe, test, expect } from 'vitest';
import { makeSim } from './fixtures.js';

/** train A restoreSim's per-girl loop (placeTower, tiers highest path first, all or nothing). */
function replay(sim, saved, { restoring }) {
  const dropped = [];
  for (const o of [...saved].sort((a, b) => a.uid - b.uid)) {
    sim._uid = o.uid;
    const t = sim.placeTower(o.u, o.x, o.y);
    if (!t) {
      dropped.push(o.uid);
      continue;
    }
    const order = [0, 1, 2].sort((p, q) => o.tiers[q] - o.tiers[p]);
    let ok = true;
    for (const p of order) for (let k = 0; k < o.tiers[p] && ok; k++) ok = sim.upgradeTower(t.uid, p, restoring ? { restoring: true } : undefined);
    if (!ok) {
      sim.sellTower(t.uid);
      dropped.push(o.uid);
    }
  }
  return dropped;
}

const SAVE = [
  { uid: 10, u: 'archer', x: 1.5, y: 1.5, tiers: [5, 2, 0] },
  { uid: 11, u: 'archer', x: 9.5, y: 1.5, tiers: [5, 0, 2] }, // a second 5-x-x: legal before the rule
  { uid: 12, u: 'archer', x: 1.5, y: 6.5, tiers: [4, 0, 2] },
];

describe('battle-save grandfathering (the restoring hook)', () => {
  test('without the hook the second holder would be dropped', () => {
    const sim = makeSim({ cash: 1e12 });
    expect(replay(sim, SAVE, { restoring: false })).toEqual([11]);
  });

  test('with { restoring: true } both copies keep their tier 5; play goes on under the rule', () => {
    const sim = makeSim({ cash: 1e12 });
    expect(replay(sim, SAVE, { restoring: true })).toEqual([]);
    expect(sim.towers.map((t) => t.tiers.join('-'))).toEqual(['5-2-0', '5-0-2', '4-0-2']);
    // a third copy at tier 4 sees the lock, holder = the lowest uid
    expect(sim.upgradeStatus(12, 0)).toMatchObject({ reason: 'onePerPath', holder: 10 });
    // selling one holder leaves the other holding
    sim.sellTower(10);
    expect(sim.upgradeStatus(12, 0)).toMatchObject({ reason: 'onePerPath', holder: 11 });
    sim.sellTower(11);
    expect(sim.upgradeTower(12, 0)).toBe(true);
  });

  test('an edited save (a crosspath break) is still refused while restoring', () => {
    const sim = makeSim({ cash: 1e12 });
    expect(replay(sim, [{ uid: 20, u: 'archer', x: 1.5, y: 1.5, tiers: [5, 3, 0] }], { restoring: true })).toEqual([20]);
  });
});

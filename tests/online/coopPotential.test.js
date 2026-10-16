// Potential in co-op: a girl fights at her OWNER's Potential (it travels in the loadout's
// unitBattleStats like awakenPassive), and both clients still agree on every hash.
import { describe, it, expect } from 'vitest';
import { createCoopSim, quantize } from '../../src/online/coop/commands.js';
import { withDetMath } from '../../src/online/coop/detMath.js';

const start = {
  seed: 91,
  stageId: '1-3',
  difficulty: 'normal',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'aoi', stats: { potential: 1 } }], hero: null },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'aoi', stats: { potential: 6 } }], hero: null },
  ],
};

let seq = 0;
const cmd = (p, k, a = [], t = 0) => ({ t, p, s: seq++, k, a });

function spots(c, n) {
  const out = [];
  withDetMath(() => {
    for (let y = 0.55; y < c.sim.map.height && out.length < n; y += 0.35) {
      for (let x = 0.55; x < c.sim.map.width && out.length < n; x += 0.35) {
        const q = quantize(x, y);
        if (c.sim.placementReason('aoi', q[0] / 1024, q[1] / 1024)) continue;
        if (out.some(([a, b]) => Math.hypot(a - q[0], b - q[1]) < 1.5 * 1024)) continue;
        out.push(q);
      }
    }
  });
  return out;
}

describe('co-op: the same girl at two Potentials', () => {
  it('per-owner stats differ, the two clients hash the same, each tower keeps its owner P', () => {
    const A = createCoopSim(start, { mySlot: 0 });
    const B = createCoopSim(start, { mySlot: 1 });
    const [s0, s1] = spots(A, 2);
    for (const c of [A, B]) {
      expect(c.apply(cmd(0, 'place', ['aoi', ...s0])).ok).toBe(true);
      expect(c.apply(cmd(1, 'place', ['aoi', ...s1])).ok).toBe(true);
    }
    const [h, g] = A.sim.towers;
    expect(h.unitStats.potential).toBe(1);
    expect(g.unitStats.potential).toBe(6);
    // Aoi's v3 ladder at P6: damage ×1.04×1.04×1.05, +6 % crit, her Twin Fletch / hawk rhythm
    expect(g.stats.damage).toBeCloseTo(h.stats.damage * 1.04 * 1.04 * 1.05, 12);
    expect(g.stats.crit.chance).toBeCloseTo(h.stats.crit.chance + 0.06, 12);
    expect(g.stats.proc?.every).toBe(10);
    expect(h.stats.proc).toBeUndefined();
    expect(A.hash()).toBe(B.hash());
    for (const c of [A, B]) c.apply(cmd(0, 'wave'));
    for (let i = 0; i < 600; i++) {
      A.step();
      B.step();
    }
    expect(A.sim.wave).toBeGreaterThan(0);
    expect(A.hash()).toBe(B.hash());
  });

});

// Potential in co-op: a girl fights at her OWNER's Potential and level (both travel in the loadout's
// unitBattleStats like awakenPassive), team effects (auras, Moonfall) help the partner's girls, the
// coins a Potential step earns (harvest, bounty aura) are pooled and split like every coin, and both
// clients still agree on every hash (v3 §6.3, §13.3).
import { describe, it, expect } from 'vitest';
import { createCoopSim, quantize } from '../../src/online/coop/commands.js';
import { withDetMath } from '../../src/online/coop/detMath.js';
import { unitBattleStats } from '../../src/systems/progression.js';
import { ultEffect } from '../../src/sim/hero.js';
import { bountyMulAt } from '../../src/sim/potential.js';
import { rederiveStats } from '../../src/online/coop/lockstep.js';
import { snapshotDigest } from '../../src/sim/snapshot.js';

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


  it('two levels and two Potentials per owner; Miko\'s aura and Luna\'s Moonfall help the partner; Momo\'s harvest and bounty coins are pooled; hashes agree', () => {
    // the host's Kage at level 60 P6 and the guest's at level 20 P2; Miko P6 and Luna P6 are the
    // host's, Momo P6 the guest's (profiles as the lobby reads them: unitBattleStats)
    const host = { units: { kage: { level: 60, breakthrough: 5, dupes: 5 }, miko: { level: 40, breakthrough: 3, dupes: 5 }, luna: { level: 40, breakthrough: 3, dupes: 5 } }, gear: {} };
    const guest = { units: { kage: { level: 20, breakthrough: 1, dupes: 1 }, momo: { level: 30, breakthrough: 2, dupes: 5 } }, gear: {} };
    const lo = (prof, ids) => ids.map((unitId) => ({ unitId, stats: { ...unitBattleStats(prof, unitId), damageMul: unitBattleStats(prof, unitId).damageMul * 3, costMul: 0.25 } }));
    const start2 = {
      seed: 4040,
      stageId: '1-3',
      difficulty: 'normal',
      players: [
        { slot: 0, uid: 'host', name: 'Host', loadout: lo(host, ['kage', 'miko']), hero: { unitId: 'luna', stats: unitBattleStats(host, 'luna') } },
        { slot: 1, uid: 'guest', name: 'Guest', loadout: lo(guest, ['kage', 'momo']), hero: null },
      ],
    };
    const A = createCoopSim(start2, { mySlot: 0 });
    const B = createCoopSim(start2, { mySlot: 1 });
    // spots: the guest's Kage within Miko's aura, Momo by the path near the start, the rest apart
    const sp = spots(A, 40);
    const pairs = [];
    for (const a of sp) for (const b of sp) if (a !== b) pairs.push([a, b, Math.hypot(a[0] - b[0], a[1] - b[1]) / 1024]);
    const [mikoAt, guestKageAt] = pairs.sort((x, y) => x[2] - y[2])[0];
    // (the others: the free spots nearest the path, so the host's Kage and Momo meet the waves)
    const far = (q) => [mikoAt, guestKageAt].every((o) => Math.hypot(o[0] - q[0], o[1] - q[1]) >= 1.5 * 1024);
    const pathDist = (q) => withDetMath(() => A.sim.placement.pathDistance(q[0] / 1024, q[1] / 1024));
    const rest = sp.filter(far).sort((a, b) => pathDist(a) - pathDist(b));
    for (const c of [A, B]) {
      expect(c.apply(cmd(0, 'place', ['miko', ...mikoAt])).ok).toBe(true);
      expect(c.apply(cmd(1, 'place', ['kage', ...guestKageAt])).ok).toBe(true);
      expect(c.apply(cmd(0, 'place', ['kage', ...rest[0]])).ok).toBe(true);
      expect(c.apply(cmd(1, 'place', ['momo', ...rest[1]])).ok).toBe(true);
    }
    const lunaAt = rest.slice(2).find((q) => withDetMath(() => A.sim.canPlace('luna', q[0] / 1024, q[1] / 1024).ok));
    for (const c of [A, B]) expect(c.apply(cmd(0, 'place', ['luna', ...lunaAt])).ok).toBe(true);
    const of = (c, id, slot) => c.sim.towers.find((t) => t.unitId === id && c.ownerOf(t.uid) === slot);
    const [hk, gk, miko, momo, luna] = [of(A, 'kage', 0), of(A, 'kage', 1), of(A, 'miko', 0), of(A, 'momo', 1), of(A, 'luna', 0)];
    // her owner's level and Potential: the host's Kage has tempo, more shuriken and +2 pierce; the guest's only her P2 speed
    expect([hk.unitStats.level, hk.unitStats.potential, gk.unitStats.level, gk.unitStats.potential]).toEqual([60, 6, 20, 2]);
    expect(hk.stats.tempo).toEqual({ per: 0.01, max: 0.06, idle: 1 });
    expect(hk.stats.projScale).toBeCloseTo(0.12, 12);
    expect(hk.stats.proc?.name).toBe('Shuriken Storm');
    expect(gk.stats.tempo).toBeUndefined();
    expect(gk.stats.proc).toBeUndefined();
    expect(hk.stats.pierce - gk.stats.pierce).toBe(2);
    expect(hk.stats.rate / gk.stats.rate).toBeCloseTo((unitBattleStats(host, 'kage').rateMul * 1.04 * 1.05 * 1.05 * 1.06 * 1.07) / (unitBattleStats(guest, 'kage').rateMul * 1.04), 9);
    // the host's Miko P6 lifts the guest's Kage (her aura, her five aura steps)
    A.step();
    B.step();
    expect(gk.buffBy.dmg).toBe(miko.uid);
    expect(gk.buff.dmgMul).toBeCloseTo(miko.stats.aura.dmgMul, 12);
    expect(miko.stats.aura.dmgMul).toBeCloseTo(1.1 * 1.03 ** 5, 12);
    expect(A.hash()).toBe(B.hash());
    // Luna P6's Moonfall (her own steps: +0.05 and +0.05 haste on its rate bonus) reaches the guest's girls too
    for (const c of [A, B]) {
      const h = c.sim.towers.find((t) => t.unitId === 'luna');
      h.ultUnlocked = true;
      h.ultCooldown = 0;
      expect(c.apply(cmd(0, 'ult')).ok).toBe(true);
    }
    const p1 = ultEffect({ def: luna.def, level: luna.level, stats: {} });
    const rb1 = p1.rateBuff ?? 0.25;
    const want = (rb1 > 1 ? rb1 : 1 + rb1) + 0.1;
    expect(A.sim.globalRateMul).toBeCloseTo(want, 12);
    A.step();
    B.step();
    for (const t of [gk, hk, momo]) expect(t._globalRate).toBeCloseTo(want, 12);
    expect(A.hash()).toBe(B.hash());
    // waves with Auto on: every coin the battle pays is pooled and split, Momo's harvest (every 6th wave)
    // and her bounty aura (kills inside her range pay ×1.1) included
    for (const c of [A, B]) {
      c.apply(cmd(0, 'auto', [true]));
      c.apply(cmd(1, 'speed', [3]));
      c.apply(cmd(0, 'wave'));
    }
    let harvests = 0;
    let bounties = 0;
    for (let i = 0; i < 60 * 60 * 30 && A.sim.wavesCleared < 13 && A.sim.state !== 'lost' && A.sim.state !== 'won'; i++) {
      const before = A.wallets;
      A.step();
      B.step();
      const ev = A.sim.drainEvents();
      B.sim.drainEvents();
      const after = A.wallets;
      const dA = after[0] - before[0];
      const dB = after[1] - before[1];
      const harvest = ev.some((e) => e.type === 'cash' && e.reason === 'harvest' && e.towerUid === momo.uid);
      const bounty = ev.some((e) => e.type === 'death' && bountyMulAt(A.sim, e.x, e.y) > 1);
      if (harvest || bounty) {
        // her owner gets no more than the partner: one pool, split (an odd coin alternates)
        expect(Math.abs(dA - dB), `step ${i}`).toBeLessThanOrEqual(1);
        expect(dA + dB).toBeGreaterThan(0);
        if (harvest) harvests++;
        if (bounty) bounties++;
      }
      if (i % 600 === 0) expect(A.hash()).toBe(B.hash());
    }
    expect(A.sim.wavesCleared).toBeGreaterThanOrEqual(12);
    expect(harvests).toBeGreaterThanOrEqual(2); // waves 6 and 12
    expect(bounties).toBeGreaterThan(0);
    // the host's Kage threw with tempo and the carry; the guest's never did
    expect(hk.potCount).toBeGreaterThan(0);
    expect(Number.isInteger(hk.projCarry)).toBe(true);
    expect(gk.potCount).toBeUndefined();
    expect(gk.projCarry).toBeUndefined();
    expect(A.hash()).toBe(B.hash());
    expect(B.wallets).toEqual(A.wallets);
    // an honest checkpoint of this battle (Miko's Brittle aura, Kage's tempo and storm, Momo's harvest
    // mid-run) restores with every girl's stats as her loadout entry gives them: the resync's check
    // (lockstep.js rederiveStats) rebuilds nobody, and the restored copy stays in lockstep
    const C = createCoopSim(start2, { mySlot: 1 });
    C.restore(A.snapshot());
    expect(rederiveStats(C.sim)).toBe(0);
    for (let i = 0; i < 1800; i++) {
      A.step();
      C.step();
    }
    expect(C.hash()).toBe(A.hash());
    expect(snapshotDigest(C.snapshot())).toBe(snapshotDigest(A.snapshot()));
  });
});

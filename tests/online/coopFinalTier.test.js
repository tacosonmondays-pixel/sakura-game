// One final tier per path in co-op: per player (each partner may own her own final tier of the same girl
// type), and an illegal tier-5 command is refused identically on every client.
import { describe, it, expect } from 'vitest';
import { createCoopSim, quantize } from '../../src/online/coop/commands.js';

// costMul 0.01 (a profile bonus the Sim supports) so a script can afford tier 5s from the start cash
const CHEAP = { costMul: 0.01 };
const START = {
  seed: 4242,
  stageId: '1-3',
  difficulty: 'normal',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'aoi', stats: CHEAP }, { unitId: 'midori', stats: CHEAP }], hero: { unitId: 'hikari', stats: CHEAP } },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'aoi', stats: CHEAP }, { unitId: 'yuki', stats: CHEAP }], hero: null },
  ],
};

/** Legal spots for Aoi next to the path, 1.3 tiles apart (geometry only). */
function spots(n) {
  const c = createCoopSim(START);
  const cands = [];
  for (let y = 0.55; y < c.sim.map.height; y += 0.35) {
    for (let x = 0.55; x < c.sim.map.width; x += 0.35) {
      if (!c.sim.placementReason('aoi', x, y)) cands.push([x, y, c.sim.placement.pathDistance(x, y)]);
    }
  }
  cands.sort((a, b) => a[2] - b[2]);
  const out = [];
  for (const [x, y] of cands) {
    if (out.length >= n) break;
    if (out.some(([tx, ty]) => Math.hypot(tx - x, ty - y) < 1.3)) continue;
    out.push([x, y]);
  }
  return out;
}

const SPOTS = spots(4);

/** Runs the same command script on two independent clients; returns both and every result pair. */
function twoClients() {
  const A = createCoopSim(START, { mySlot: 0 });
  const B = createCoopSim(START, { mySlot: 1 });
  const results = [];
  let seq = 0;
  const both = (p, k, a, t = 0) => {
    const cmd = { t, p, s: seq++, k, a };
    const ra = A.apply(cmd);
    const rb = B.apply(cmd);
    results.push([ra, rb]);
    expect({ ok: ra.ok, reason: ra.reason, holder: ra.holder }).toEqual({ ok: rb.ok, reason: rb.reason, holder: rb.holder });
    return ra;
  };
  const place = (p, i) => both(p, 'place', ['aoi', ...quantize(...SPOTS[i])]).tower.uid;
  const upg = (p, uid, path, n = 1) => {
    let r = null;
    for (let k = 0; k < n; k++) r = both(p, 'upg', [uid, path]);
    return r;
  };
  return { A, B, both, place, upg };
}

describe('co-op: one final tier per path per player', () => {
  it('towers carry their owner, set by the place command on every client', () => {
    const { A, B, place } = twoClients();
    const u0 = place(0, 0);
    const u1 = place(1, 1);
    for (const c of [A, B]) {
      expect(c.sim.getTower(u0).owner).toBe(0);
      expect(c.sim.getTower(u1).owner).toBe(1);
    }
  });

  it('a partner\'s final tier never blocks mine; my second copy is refused on both clients alike', () => {
    const { A, B, place, upg } = twoClients();
    const p0a = place(0, 0);
    const p1a = place(1, 1);
    const p0b = place(0, 2);
    expect(upg(0, p0a, 0, 5).ok).toBe(true);
    expect(upg(1, p1a, 0, 5).ok).toBe(true); // per player: the guest's Aoi has her own slot
    expect(upg(0, p0b, 0, 4).ok).toBe(true);
    const wallet = A.wallets[0];
    const r = upg(0, p0b, 0);
    expect(r).toMatchObject({ ok: false, reason: 'onePerPath', holder: p0a });
    expect(A.wallets[0]).toBe(wallet);
    for (const c of [A, B]) {
      expect(c.sim.getTower(p0b).tiers).toEqual([4, 0, 0]);
      expect(c.sim.getTower(p1a).tiers).toEqual([5, 0, 0]);
    }
    expect(A.hash()).toBe(B.hash());
  });

  it('two tier-5 orders in one tick resolve in command order on every client', () => {
    const { A, B, place, upg, both } = twoClients();
    const a = place(0, 0);
    const b = place(0, 1);
    upg(0, a, 0, 4);
    upg(0, b, 0, 4);
    // same tick 7, sequence 100 then 101: the first wins, the second is refused 'onePerPath'
    const r1 = both(0, 'upg', [a, 0], 7);
    const r2 = both(0, 'upg', [b, 0], 7);
    expect(r1.ok).toBe(true);
    expect(r2).toMatchObject({ ok: false, reason: 'onePerPath', holder: a });
    expect(A.hash()).toBe(B.hash());
  });

  it('a checkpoint keeps the owners and the rule; selling the holder frees the slot', () => {
    const { A, place, upg } = twoClients();
    const a = place(0, 0);
    const b = place(0, 1);
    upg(0, a, 0, 5);
    upg(0, b, 0, 4);
    for (let i = 0; i < 30; i++) A.step();
    const snap = JSON.parse(JSON.stringify(A.snapshot()));
    const C = createCoopSim(START, { mySlot: 0 }).restore(snap);
    expect(C.sim.getTower(a).owner).toBe(0);
    expect(C.hash()).toBe(A.hash());
    expect(C.sim.upgradeStatus(b, 0)).toMatchObject({ reason: 'onePerPath', holder: a });
    let s = 1000;
    const cmd = (k, args) => ({ t: C.tick, p: 0, s: s++, k, a: args });
    expect(C.apply(cmd('upg', [b, 0])).reason).toBe('onePerPath');
    expect(C.apply(cmd('sell', [a])).ok).toBe(true);
    expect(C.apply(cmd('upg', [b, 0])).ok).toBe(true);
    expect(C.sim.getTower(b).tiers[0]).toBe(5);
  });

  it('only the owner upgrades; network args never carry a bypass', () => {
    const { A, place, both } = twoClients();
    const a = place(0, 0);
    const b = place(0, 1);
    for (let i = 0; i < 5; i++) both(0, 'upg', [a, 0]);
    for (let i = 0; i < 4; i++) both(0, 'upg', [b, 0]);
    expect(both(1, 'upg', [b, 0]).reason).toBe('notYours');
    // a third argument ({ restoring: true } in the Sim) is ignored on the network
    expect(both(0, 'upg', [b, 0, { restoring: true }]).reason).toBe('onePerPath');
    expect(A.sim.getTower(b).tiers[0]).toBe(4);
  });
});

describe('co-op: the pick command (limited buffs)', () => {
  /** A spot for Midori within reach of SPOTS[1] and out of reach of SPOTS[3] (geometry only). */
  function midoriSpot() {
    const c = createCoopSim(START);
    const reach = 3.0;
    for (let y = 0.55; y < c.sim.map.height; y += 0.35) {
      for (let x = 0.55; x < c.sim.map.width; x += 0.35) {
        if (c.sim.placementReason('midori', x, y)) continue;
        if (SPOTS.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 1)) continue;
        const d1 = Math.hypot(SPOTS[1][0] - x, SPOTS[1][1] - y);
        const d3 = Math.hypot(SPOTS[3][0] - x, SPOTS[3][1] - y);
        if (d1 < reach - 0.3 && d3 > reach + 0.5) return [x, y];
      }
    }
    return null;
  }

  it('owner check on the brewer, an ally\'s girl as the target, the same refusals on both clients', () => {
    const at = midoriSpot();
    expect(at).toBeTruthy();
    const { A, B, both } = twoClients();
    const ally = both(1, 'place', ['aoi', ...quantize(...SPOTS[1])]).tower.uid;
    const far = both(1, 'place', ['aoi', ...quantize(...SPOTS[3])]).tower.uid;
    const m = both(0, 'place', ['midori', ...quantize(...at)]).tower.uid;
    expect(both(0, 'upg', [m, 0]).ok).toBe(true); // Concentrate: Toxic Tonic brews 1 girl
    expect(both(1, 'pick', [m, ally]).reason).toBe('notYours');
    expect(both(0, 'pick', [m, far]).reason).toBe('range');
    expect(both(0, 'pick', [m, m]).reason).toBe('self');
    expect(both(0, 'pick', [m, 'x']).reason).toBe('invalid');
    expect(both(0, 'pick', [ally, m]).reason).toBe('notYours');
    expect(both(0, 'pick', [m, ally])).toMatchObject({ ok: true });
    for (let i = 0; i < 20; i++) {
      A.step();
      B.step();
    }
    for (const c of [A, B]) {
      expect(c.sim.getTower(m).buffPick).toBe(ally);
      expect(c.sim.getTower(ally).limIn.brew).toBe(m);
    }
    expect(A.hash()).toBe(B.hash());
    expect(both(0, 'pick', [m, -1]).ok).toBe(true);
  });
});

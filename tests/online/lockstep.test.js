import { describe, it, expect } from 'vitest';
import { Lockstep } from '../../src/online/coop/lockstep.js';
import { createCoopSim, quantize } from '../../src/online/coop/commands.js';
import { COOP, coopStage, coopStartCash } from '../../src/data/coop.js';
import { STAGE_MAP } from '../../src/data/stages.js';
import { createRng } from '../../src/core/rng.js';

const STAGE = '1-3';
const CHEAP = { costMul: 0.5 };
const START = {
  seed: 12345,
  stageId: STAGE,
  difficulty: 'normal',
  players: [
    // costMul 0.5 (a profile bonus the Sim already supports) so the script can afford its girls
    { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'aoi', stats: CHEAP }, { unitId: 'rei', stats: CHEAP }], hero: { unitId: 'hikari', stats: CHEAP } },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'rei', stats: { ...CHEAP, damageMul: 1.2 } }, { unitId: 'yuki', stats: CHEAP }], hero: null },
  ],
};

/** Legal spots for a unit next to the path, at least 1.3 tiles apart (geometry only). */
const taken = [];
function spots(unitId, n) {
  const c = createCoopSim(START);
  const cands = [];
  for (let y = 0.55; y < c.sim.map.height; y += 0.35) {
    for (let x = 0.55; x < c.sim.map.width; x += 0.35) {
      if (!c.sim.placementReason(unitId, x, y)) cands.push([x, y, c.sim.placement.pathDistance(x, y)]);
    }
  }
  cands.sort((a, b) => a[2] - b[2]);
  const out = [];
  for (const [x, y] of cands) {
    if (out.length >= n) break;
    if (taken.some(([tx, ty]) => Math.hypot(tx - x, ty - y) < 1.3)) continue;
    out.push([x, y]);
    taken.push([x, y]);
  }
  return out;
}

/**
 * Two lockstep clients over a fake network: each message is delivered after a random
 * 0–9 frame delay (out of order allowed), optionally dropped.
 */
function harness({ seed = 7, drop = 0, maxLag = 9 } = {}) {
  const rng = createRng(seed);
  const clock = { t: 0 };
  const queue = [];
  const failed = [];
  let frame = 0;
  const mk = (slot) => new Lockstep({
    start: START,
    mySlot: slot,
    now: () => clock.t,
    hooks: { onApplied: (c, r) => { if (!r.ok) failed.push({ slot, c, r: r.reason }); } },
    send: (msg) => {
      if (drop && rng.next() < drop) return;
      queue.push({ at: frame + Math.floor(rng.next() * (maxLag + 1)), to: 1 - slot, msg: JSON.parse(JSON.stringify(msg)) });
    },
  });
  const clients = [mk(0), mk(1)];
  function stepFrame() {
    frame++;
    clock.t += 1000 / 60;
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].at <= frame) {
        const { to, msg } = queue.splice(i, 1)[0];
        clients[to].receive(msg);
      }
    }
    for (const c of clients) c.advance(1 / 60);
  }
  return { clients, stepFrame, clock, failed, get frame() { return frame; } };
}

function script(h) {
  const [A, B] = h.clients;
  const aoi = spots('aoi', 3);
  const yuki = spots('yuki', 3);
  const actions = {
    5: () => A.queue('place', ['aoi', ...quantize(...aoi[0])]),
    6: () => B.queue('place', ['yuki', ...quantize(...yuki[0])]),
    20: () => A.queue('wave'),
    1300: () => B.queue('place', ['rei', ...quantize(...yuki[1])]),
    1400: () => A.queue('place', ['rei', ...quantize(...aoi[1])]),
    1900: () => {
      const mine = B.sim.towers.find((t) => B.coop.isMine(t.uid));
      B.queue('upg', [mine.uid, 0]);
      B.queue('tgt', [mine.uid, 'strong']);
    },
    // A tries to sell B's girl: refused on both clients
    1950: () => A.queue('sell', [A.sim.towers.find((t) => !A.coop.isMine(t.uid)).uid]),
    2000: () => B.queue('speed', [2]),
    2100: () => A.queue('auto', [true]),
  };
  return actions;
}

describe('co-op lockstep', () => {
  it('two clients with random latency stay identical (hashes every 120 ticks)', () => {
    const h = harness();
    const actions = script(h);
    for (let f = 0; f < 2700; f++) {
      actions[h.frame]?.();
      h.stepFrame();
    }
    const [A, B] = h.clients;
    expect(h.failed.filter((f) => f.c.k !== 'sell')).toEqual([]);
    expect(A.tick).toBeGreaterThan(2000);
    // both ran the same ticks: compare at the common tick
    const pairs = A.hashPairs();
    expect(pairs.length).toBeGreaterThan(10);
    for (const p of pairs) expect(p.mine).toBe(p.theirs);
    for (const p of B.hashPairs()) expect(p.mine).toBe(p.theirs);
    expect(A.resyncs + B.resyncs).toBe(0);
    expect(A.desynced || B.desynced).toBe(false);
    // the scripted placements happened, ownership is per player
    expect(A.sim.towers.length).toBe(4);
    expect(A.sim.towers.filter((t) => A.coop.ownerOf(t.uid) === 1).length).toBe(2);
    expect(A.sim.towers.some((t) => t.tiers[0] === 1)).toBe(true);
    expect(A.sim.wave).toBeGreaterThan(1);
    expect(A.coop.speed).toBe(2);
  });

  it('runs a whole battle in sync to the end and both see the same result', () => {
    const h = harness({ seed: 3, maxLag: 4 });
    const actions = script(h);
    for (let f = 0; f < 60 * 60 * 20 && !(h.clients[0].finished && h.clients[1].finished); f++) {
      actions[h.frame]?.();
      h.stepFrame();
    }
    const [A, B] = h.clients;
    // let the last horizon/hash messages land
    for (let f = 0; f < 20; f++) h.stepFrame();
    expect(A.finished && B.finished).toBe(true);
    expect(A.sim.state).toBe(B.sim.state);
    expect(A.tick).toBe(B.tick);
    expect(A.coop.hash()).toBe(B.coop.hash());
    expect(A.coop.wallets).toEqual(B.coop.wallets);
  }, 60000);

  it('survives a lossy link (commands are re-sent until acknowledged)', () => {
    const h = harness({ seed: 11, drop: 0.25 });
    const actions = script(h);
    for (let f = 0; f < 2700; f++) {
      actions[h.frame]?.();
      h.stepFrame();
    }
    const [A, B] = h.clients;
    expect(A.sim.towers.length).toBe(4);
    for (const p of A.hashPairs()) expect(p.mine).toBe(p.theirs);
    expect(A.resyncs + B.resyncs).toBe(0);
  });

  it('a desync is detected by the hash check and repaired from the host', () => {
    const h = harness({ seed: 5 });
    const actions = script(h);
    for (let f = 0; f < 700; f++) {
      actions[h.frame]?.();
      h.stepFrame();
      if (f === 300) h.clients[1].sim.lives -= 7; // corrupt the guest's state
    }
    const [A, B] = h.clients;
    expect(B.resyncs).toBe(1);
    expect(B.sim.lives).toBe(A.sim.lives === B.sim.lives ? A.sim.lives : NaN);
    for (let f = 0; f < 400; f++) h.stepFrame();
    const late = B.hashPairs().filter((p) => p.t > 600);
    expect(late.length).toBeGreaterThan(0);
    for (const p of late) expect(p.mine).toBe(p.theirs);
    expect(B.desynced).toBe(false);
  });

  it('when the ally disconnects the survivor keeps playing and gets all income', () => {
    const h = harness({ seed: 9 });
    const actions = script(h);
    for (let f = 0; f < 300; f++) {
      actions[h.frame]?.();
      h.stepFrame();
    }
    const [A, B] = h.clients;
    const before = A.tick;
    // B vanishes: nothing more is delivered from it and it stops ticking
    h.clients[1] = { receive() {}, advance() {} };
    let stalledSeen = false;
    for (let f = 0; f < 60 * 8; f++) {
      h.stepFrame();
      if (A.stalled) stalledSeen = true;
    }
    expect(stalledSeen).toBe(true);
    expect(A.peers.get(1).gone).toBe(true);
    const t1 = A.tick;
    const w1 = A.coop.wallets;
    for (let f = 0; f < 600; f++) h.stepFrame();
    expect(A.tick).toBeGreaterThan(t1 + 500);
    expect(A.tick).toBeGreaterThan(before);
    // B's wallet is frozen; A earned everything since
    expect(A.coop.wallets[1]).toBe(w1[1]);
    expect(B.sim.towers.length).toBeGreaterThan(0); // B's towers stay on A's board
    expect(A.sim.towers.filter((t) => A.coop.ownerOf(t.uid) === 1).length).toBe(1);
  });
});

describe('co-op sim (wallets, HP scaling)', () => {
  it('scales enemy HP ×1.6 through data and splits start cash', () => {
    expect(coopStage(STAGE).hpScale).toBeCloseTo((STAGE_MAP[STAGE].hpScale ?? 1) * COOP.hpMul);
    const c = createCoopSim(START, { mySlot: 1 });
    expect(c.wallets).toEqual([coopStartCash(STAGE_MAP[STAGE]), coopStartCash(STAGE_MAP[STAGE])]);
    expect(c.sim.cash).toBe(c.wallets[1]);
    // the guest only sees her own cards and no hero
    expect([...c.sim.loadout.keys()].sort()).toEqual(['rei', 'yuki']);
    expect(c.sim.heroConfig).toBe(null);
    expect(c.sim.loadout.get('rei').damageMul).toBe(1.2);
  });

  it('only lets players place their own girls and spend their own coins', () => {
    const c = createCoopSim(START, { mySlot: 0 });
    const [x, y] = spots('yuki', 1)[0];
    expect(c.apply({ t: 0, p: 0, s: 0, k: 'place', a: ['yuki', ...quantize(x, y)] }).reason).toBe('notInLoadout');
    const before = c.wallets;
    const r = c.apply({ t: 0, p: 1, s: 0, k: 'place', a: ['yuki', ...quantize(x, y)] });
    expect(r.ok).toBe(true);
    expect(c.wallets[0]).toBe(before[0]);
    expect(c.wallets[1]).toBeLessThan(before[1]);
    expect(c.apply({ t: 0, p: 0, s: 1, k: 'sell', a: [r.tower.uid] }).reason).toBe('notYours');
    expect(c.apply({ t: 0, p: 1, s: 1, k: 'ult', a: [] }).reason).toBe('noHero');
  });

  it('income is conserved and split evenly', () => {
    const c = createCoopSim(START);
    c.apply({ t: 0, p: 0, s: 0, k: 'wave', a: [] });
    const [x, y] = spots('aoi', 1)[0];
    c.apply({ t: 0, p: 0, s: 1, k: 'place', a: ['aoi', ...quantize(x, y)] });
    const w0 = c.wallets;
    const earned0 = c.sim.stats.cashEarned;
    for (let i = 0; i < 60 * 40; i++) c.step();
    const earned = c.sim.stats.cashEarned - earned0;
    const w = c.wallets;
    expect(earned).toBeGreaterThan(0);
    expect(w[0] + w[1] - w0[0] - w0[1]).toBe(earned);
    expect(Math.abs((w[0] - w0[0]) - (w[1] - w0[1]))).toBeLessThanOrEqual(1);
  });
});

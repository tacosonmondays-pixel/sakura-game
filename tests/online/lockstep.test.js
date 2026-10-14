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
function harness({ seed = 7, drop = 0, maxLag = 9, net = null } = {}) {
  const rng = createRng(seed);
  const clock = { t: 0 };
  const queue = [];
  const failed = [];
  const events = [];
  // link[from] = false cuts everything that client sends; frozen clients neither run nor read
  // (their mail waits, like a page whose main thread is blocked)
  const link = [true, true];
  const frozen = new Set();
  let frame = 0;
  const sent = [[], []];
  const mk = (slot) => new Lockstep({
    start: START,
    mySlot: slot,
    now: () => clock.t,
    ...(net ? { delay: net.inputDelay, heartbeatMs: net.heartbeatMs, keepaliveMs: net.keepaliveMs } : {}),
    hooks: {
      onApplied: (c, r) => { if (!r.ok) failed.push({ slot, c, r: r.reason }); },
      onPeerGone: (s, why) => events.push({ slot, ev: 'gone', why, frame }),
      onPeerBack: () => events.push({ slot, ev: 'back', frame }),
      onResync: () => events.push({ slot, ev: 'resync', frame }),
    },
    send: (msg) => {
      sent[slot].push({ frame, type: msg.type });
      if (!link[slot] || (drop && rng.next() < drop)) return;
      queue.push({ at: frame + Math.floor(rng.next() * (maxLag + 1)), to: 1 - slot, msg: JSON.parse(JSON.stringify(msg)) });
    },
  });
  const clients = [mk(0), mk(1)];
  function stepFrame() {
    frame++;
    clock.t += 1000 / 60;
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].at <= frame && !frozen.has(queue[i].to)) {
        const { to, msg } = queue.splice(i, 1)[0];
        clients[to].receive(msg);
      }
    }
    clients.forEach((c, i) => { if (!frozen.has(i)) c.advance(1 / 60); });
  }
  return { clients, stepFrame, clock, failed, events, link, frozen, sent, get frame() { return frame; } };
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

  it('Supabase profile: ~4 packets a second per player (not 20), hashes ride along, still in sync', () => {
    // the Supabase adapter's net profile, ~150 ms one-way latency with jitter, 10% loss
    const h = harness({ seed: 13, maxLag: 9, drop: 0.1, net: { heartbeatMs: 250, inputDelay: 30, keepaliveMs: 1000 } });
    const mark = taken.length;
    const actions = script(h);
    taken.length = mark; // (the spots are only reserved across tests that share one board)
    for (let f = 0; f < 2700; f++) {
      actions[h.frame]?.();
      h.stepFrame();
    }
    const [A, B] = h.clients;
    expect(h.failed.filter((f) => f.c.k !== 'sell')).toEqual([]);
    expect(A.sim.towers.length).toBe(4);
    const pairs = A.hashPairs();
    expect(pairs.length).toBeGreaterThan(8);
    for (const p of pairs) expect(p.mine).toBe(p.theirs);
    for (const p of B.hashPairs()) expect(p.mine).toBe(p.theirs);
    expect(A.resyncs + B.resyncs).toBe(0);
    // no packet types besides the heartbeat (hashes are folded into it)
    for (const list of h.sent) expect(new Set(list.map((m) => m.type))).toEqual(new Set(['in']));
    const seconds = 2700 / 60;
    for (const list of h.sent) expect(list.length / seconds).toBeLessThan(5.5);
    // and it barely stalled: lockstep kept up with real time
    expect(A.tick).toBeGreaterThan(2700 * 0.9 + 600); // speed 2× from frame 2000 on
  });

  it('Supabase profile: a peer with nothing new to say only sends a keepalive a second', () => {
    const h = harness({ seed: 14, maxLag: 2, net: { heartbeatMs: 250, inputDelay: 30, keepaliveMs: 1000 } });
    for (let f = 0; f < 120; f++) h.stepFrame();
    const [A] = h.clients;
    // B stops running ticks (but still reads): A stalls on B's horizon and B stays quiet
    const B = h.clients[1];
    h.clients[1] = { receive: (m) => B.receive(m), advance: () => B.beat() };
    const n0 = h.sent[1].length;
    for (let f = 0; f < 600; f++) h.stepFrame();
    expect(A.stalled).toBe(true);
    expect(h.sent[1].length - n0).toBeLessThanOrEqual(11); // ~1 a second (keepalive)
    expect(A.peers.get(1).gone).toBe(false);
  });

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
    // silence longer than the (adaptive) timeout: COOP.timeoutMs plus slack
    for (let f = 0; f < Math.ceil((COOP.timeoutMs / 1000 + 3) * 60); f++) {
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

  it('rejects junk from the network: prototype keys as target modes, unknown upgrade paths, bad shapes', () => {
    const c = createCoopSim(START, { mySlot: 0 });
    const mark = taken.length;
    const [x, y] = spots('aoi', 1)[0];
    taken.length = mark;
    const r = c.apply({ t: 0, p: 0, s: 0, k: 'place', a: ['aoi', ...quantize(x, y)] });
    const uid = r.tower.uid;
    for (const mode of ['toString', 'constructor', '__proto__', 'hasOwnProperty', 7, null]) {
      expect(c.apply({ t: 0, p: 0, s: 1, k: 'tgt', a: [uid, mode] }).ok, String(mode)).toBe(false);
    }
    expect(c.sim.getTower(uid).targetMode).not.toBe('toString');
    expect(c.apply({ t: 0, p: 0, s: 2, k: 'tgt', a: [uid, 'strong'] }).ok).toBe(true);
    const cash = c.wallets[0];
    for (const path of [3, -1, '0', 0.5, null]) expect(c.apply({ t: 0, p: 0, s: 3, k: 'upg', a: [uid, path] }).ok, String(path)).toBe(false);
    expect(c.wallets[0]).toBe(cash);
    for (const a of [[{}, 1, 2], ['aoi', '512', 2048], ['aoi', 1.5, 2]]) expect(c.apply({ t: 0, p: 0, s: 4, k: 'place', a }).ok).toBe(false);
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

describe('co-op lockstep: slow devices', () => {
  it('a long freeze of THIS client (loading, shader compile) never drops a healthy ally', () => {
    const h = harness({ seed: 21, maxLag: 3 });
    for (let f = 0; f < 200; f++) h.stepFrame();
    const [A, B] = h.clients;
    // A's page freezes for longer than the timeout: no frames, no messages handled
    h.clock.t += COOP.timeoutMs + 4000;
    for (let f = 0; f < 120; f++) h.stepFrame();
    expect(A.peers.get(1).gone).toBe(false);
    expect(B.peers.get(0).gone).toBe(false);
    expect(A.tick).toBeGreaterThan(250);
  });

  it('an ally whose battle is still loading gets the long load timeout', () => {
    const h = harness({ seed: 22 });
    const [A] = h.clients;
    h.clients[1] = { receive() {}, advance() {} }; // B never sends its first packet
    for (let f = 0; f < Math.ceil((COOP.timeoutMs / 1000 + 2) * 60); f++) h.stepFrame();
    expect(A.peers.get(1).gone).toBe(false);
    expect(A.stalled).toBe(true);
    for (let f = 0; f < Math.ceil((COOP.loadTimeoutMs / 1000) * 60); f++) h.stepFrame();
    expect(A.peers.get(1).gone).toBe(true);
    expect(A.stalled).toBe(false);
  });

  it('the timeout adapts to a laggy ally (3× its worst recent packet gap)', () => {
    const h = harness({ seed: 23 });
    for (let f = 0; f < 60; f++) h.stepFrame();
    const [A] = h.clients;
    const peer = A.peers.get(1);
    peer.jitter = 6000;
    expect(A.timeoutFor(peer)).toBe(Math.min(COOP.maxTimeoutMs, 18000));
    peer.jitter = 10;
    expect(A.timeoutFor(peer)).toBe(COOP.timeoutMs);
  });
});

describe('co-op lockstep: reconnecting', () => {
  const run = (h, actions, n) => {
    for (let f = 0; f < n; f++) {
      actions?.[h.frame]?.();
      h.stepFrame();
    }
  };
  /** Both clients agree again: same tick-aligned hashes after `fromTick`, nobody gone. */
  const inSync = (h, fromTick) => {
    const [A, B] = h.clients;
    const late = A.hashPairs().filter((p) => p.t > fromTick);
    return late.length > 0 && late.every((p) => p.mine === p.theirs) && !A.peers.get(1).gone && !B.peers.get(0).gone;
  };

  it('a guest frozen longer than the timeout is re-admitted and both agree again', () => {
    const h = harness({ seed: 31, maxLag: 3 });
    const actions = script(h);
    run(h, actions, 400);
    const [A] = h.clients;
    // B's tab stops dead (switched apps / huge GC): A drops it after the timeout and plays on
    h.frozen.add(1);
    run(h, null, Math.ceil((COOP.maxTimeoutMs / 1000 + 3) * 60)); // (a frozen B issues nothing)
    expect(A.peers.get(1).gone).toBe(true);
    const soloTick = A.tick;
    // B wakes up: it reads A's "timeout" goodbye, keeps beating, A offers its timeline, B adopts it
    h.frozen.delete(1);
    run(h, actions, 60 * 6);
    const B = h.clients[1];
    expect(A.rejoins).toBe(1);
    expect(B.rejoins).toBe(1);
    expect(B.epoch).toBe(A.epoch);
    // a frozen B never ran a tick of its own while apart, so its battle is still a prefix of
    // A's timeline: it fast-forwards in place (no battle-screen rebuild), like the loading case
    expect(h.events.some((e) => e.slot === 1 && e.ev === 'resync')).toBe(false);
    expect(h.events.some((e) => e.slot === 1 && e.ev === 'back')).toBe(true);
    expect(h.events.some((e) => e.slot === 0 && e.ev === 'back')).toBe(true);
    expect(B.tick).toBeGreaterThan(soloTick);
    // the scripted commands after the return (B places, upgrades…) work on both again
    run(h, actions, 2400);
    expect(inSync(h, soloTick + 60)).toBe(true);
    expect(A.sim.towers.length).toBe(B.sim.towers.length);
    expect(A.sim.towers.filter((t) => A.coop.ownerOf(t.uid) === 1).length).toBeGreaterThanOrEqual(1);
  });

  it('a network cut both ways: each plays solo, then the host re-admits the guest and income is shared again', () => {
    const h = harness({ seed: 32, maxLag: 3 });
    const actions = script(h);
    run(h, actions, 400);
    const [A, B] = h.clients;
    h.link[0] = false;
    h.link[1] = false;
    run(h, null, Math.ceil((COOP.maxTimeoutMs / 1000 + 3) * 60));
    expect(A.peers.get(1).gone).toBe(true);
    expect(B.peers.get(0).gone).toBe(true);
    const w = A.coop.wallets;
    run(h, null, 300);
    expect(A.coop.wallets[1]).toBe(w[1]); // while apart, the host keeps all income
    h.link[0] = true;
    h.link[1] = true;
    run(h, actions, 60 * 8);
    expect(A.peers.get(1).gone).toBe(false);
    expect(h.clients[1].peers.get(0).gone).toBe(false);
    // B played on alone (its own timeline): it had to rebuild from A's log
    expect(h.events.some((e) => e.slot === 1 && e.ev === 'resync')).toBe(true);
    const cut = A.tick;
    run(h, actions, 60 * 30);
    expect(inSync(h, cut)).toBe(true);
    expect(A.coop.wallets[1]).toBeGreaterThan(w[1]); // shared again
  });

  it('a one-way cut (the host cannot reach the guest) never freezes the host for long', () => {
    const h = harness({ seed: 33, maxLag: 3 });
    run(h, null, 300);
    const [A, B] = h.clients;
    h.link[0] = false; // A → B lost, B → A fine
    // B stops hearing A (both stall: no promises from A reach B), drops it after the timeout and
    // says so; A hears that, offers a rejoin that cannot arrive, withdraws it and plays on solo
    let longest = 0;
    let streak = 0;
    let t0 = null;
    for (let f = 0; f < 60 * 45; f++) {
      h.stepFrame();
      if (!B.peers.get(0).gone) continue;
      t0 ??= A.tick;
      streak = A.stalled ? streak + 1 : 0;
      longest = Math.max(longest, streak);
    }
    expect(B.peers.get(0).gone).toBe(true);
    expect(t0).not.toBe(null);
    expect(longest).toBeLessThanOrEqual(60 * 7); // never more than the 6 s offer window (+ slack)
    expect(A.tick - t0).toBeGreaterThan(60 * 15);
    h.link[0] = true;
    run(h, null, 60 * 70); // the next offer (after its doubling cool-down) gets through
    const healed = A.tick;
    run(h, null, 60 * 10);
    expect(inSync(h, healed)).toBe(true);
  });

  it('a guest dropped while its battle was still loading catches up in place (no rebuild)', () => {
    const h = harness({ seed: 36, maxLag: 3 });
    const [A, B] = h.clients;
    // B's battle screen takes longer than the load allowance: A gives up on it and starts alone
    h.frozen.add(1);
    run(h, null, Math.ceil((COOP.loadTimeoutMs / 1000 + 3) * 60));
    expect(A.peers.get(1).gone).toBe(true);
    expect(B.tick).toBe(0);
    h.frozen.delete(1);
    run(h, null, 60 * 4);
    expect(A.rejoins).toBe(1);
    expect(B.rejoins).toBe(1);
    // B never left A's timeline, so the same battle just fast-forwarded: no rebuild / reload
    expect(h.events.some((e) => e.slot === 1 && e.ev === 'resync')).toBe(false);
    expect(h.events.some((e) => e.slot === 1 && e.ev === 'back')).toBe(true);
    const from = A.tick;
    run(h, null, 60 * 8);
    expect(inSync(h, from)).toBe(true);
  });

  it('orders given around a freeze (just before it, and while the host waits) still run on both after the rejoin', () => {
    const h = harness({ seed: 37, maxLag: 3 });
    const [A, B] = h.clients;
    const reserved = taken.length;
    const [pa1, pa2] = spots('aoi', 2);
    const [pb] = spots('yuki', 1);
    taken.length = reserved; // a harness of its own: the spots stay free for the other tests
    run(h, null, 120);
    // both deploy, then the guest's tab freezes before the orders have even crossed the wire
    A.queue('place', ['aoi', ...quantize(...pa1)]);
    B.queue('place', ['yuki', ...quantize(...pb)]);
    h.frozen.add(1);
    run(h, null, 20);
    // the host, stalled on the frozen guest, deploys again while it waits
    A.queue('place', ['rei', ...quantize(...pa2)]);
    run(h, null, Math.ceil((COOP.maxTimeoutMs / 1000 + 3) * 60));
    expect(A.peers.get(1).gone).toBe(true);
    h.frozen.delete(1);
    run(h, null, 60 * 8);
    expect(A.rejoins).toBe(1);
    expect(B.rejoins).toBe(1);
    const owners = (c) => c.sim.towers.map((t) => c.coop.ownerOf(t.uid)).sort();
    // queue() sends at once, so the guest's order reached the host before the freeze: all three
    // girls stand, on both screens, and none of the host's orders failed
    expect(owners(A)).toEqual([0, 0, 1]);
    expect(owners(B)).toEqual(owners(A));
    expect(h.failed.filter((f) => f.slot === 0)).toEqual([]);
    const from = A.tick;
    run(h, null, 60 * 6);
    expect(inSync(h, from)).toBe(true);
  });

  it('after an in-place catch-up both players still deploy and start the wave together', () => {
    const h = harness({ seed: 38, maxLag: 3 });
    const [A, B] = h.clients;
    const reserved = taken.length;
    const [pa] = spots('aoi', 1);
    const [pb] = spots('yuki', 1);
    taken.length = reserved;
    // the guest's battle screen loads too slowly: the host drops it, then takes it back
    h.frozen.add(1);
    run(h, null, Math.ceil((COOP.loadTimeoutMs / 1000 + 3) * 60));
    h.frozen.delete(1);
    run(h, null, 60 * 4);
    expect(A.rejoins).toBe(1);
    A.queue('place', ['aoi', ...quantize(...pa)]);
    B.queue('place', ['yuki', ...quantize(...pb)]);
    run(h, null, 60);
    A.queue('wave');
    run(h, null, 120);
    for (const c of [A, B]) {
      expect(c.sim.towers.map((t) => c.coop.ownerOf(t.uid)).sort()).toEqual([0, 1]);
      expect(c.sim.state).toBe('wave');
      expect(c.sim.wave).toBe(1);
    }
    expect(h.failed).toEqual([]);
    expect(inSync(h, A.tick - 240)).toBe(true);
  });

  it('the adaptive input delay steps back down after a quiet spell (one hiccup does not slow the whole battle)', () => {
    // the Supabase profile: a 30-tick base delay
    const h = harness({ seed: 41, maxLag: 4, net: { heartbeatMs: 250, inputDelay: 30, keepaliveMs: 1000 } });
    run(h, null, 300);
    const [A, B] = h.clients;
    expect(A.delay).toBe(30);
    // a 5 s silent cut both ways (shorter than the drop timeout): both stall, both raise the delay
    h.link[0] = false;
    h.link[1] = false;
    run(h, null, 60 * 5);
    h.link[0] = true;
    h.link[1] = true;
    run(h, null, 60);
    const raised = A.delay;
    expect(raised).toBeGreaterThan(30);
    expect(A.peers.get(1).gone || B.peers.get(0).gone).toBe(false);
    // a quiet minute: back to the base, step by step (never below it)
    let min = Infinity;
    for (let f = 0; f < 60 * 70; f++) {
      h.stepFrame();
      min = Math.min(min, A.delay, B.delay);
    }
    expect(A.delay).toBe(30);
    expect(B.delay).toBe(30);
    expect(min).toBe(30);
    // and orders issued while it stepped down still ran on both clients in sync
    const t0 = A.tick;
    const spot = spots('aoi', 1)[0];
    A.queue('place', ['aoi', ...quantize(...spot)]);
    run(h, null, 60 * 5);
    expect(A.sim.towers.length).toBe(1);
    expect(B.sim.towers.length).toBe(1);
    expect(h.failed).toEqual([]);
    expect(inSync(h, t0)).toBe(true);
  });

  it('leaving on purpose is final: no rejoin', () => {
    const h = harness({ seed: 34, maxLag: 3 });
    run(h, null, 200);
    const [A, B] = h.clients;
    B.leave(); // "bye" without a reason (Leave button, closing the tab)
    run(h, null, 30);
    expect(A.peers.get(1).gone).toBe(true);
    expect(A.peers.get(1).why).toBe('left');
    // a stray late packet from B does not bring it back
    for (let f = 0; f < 120; f++) {
      B.beat(true);
      h.stepFrame();
    }
    expect(A.peers.get(1).gone).toBe(true);
    expect(A.rejoins).toBe(0);
  });

  it('the drop and the return are markers in the host log, so a replay reproduces the wallets', () => {
    const h = harness({ seed: 35, maxLag: 3 });
    const actions = script(h);
    run(h, actions, 400);
    const [A] = h.clients;
    h.frozen.add(1);
    run(h, null, Math.ceil((COOP.maxTimeoutMs / 1000 + 3) * 60));
    h.frozen.delete(1);
    run(h, actions, 60 * 6);
    const marks = A.log.filter((c) => c.k === 'gone' || c.k === 'join').map((c) => c.k);
    expect(marks).toEqual(['gone', 'join']);
    // replay the host's log headless: same wallets and hash at the same tick
    const copy = new Lockstep({ start: START, mySlot: 0, send: () => {}, now: () => 0 });
    copy.rebuild(START, A.log, A.tick);
    expect(copy.coop.wallets).toEqual(A.coop.wallets);
    expect(copy.coop.hash()).toBe(A.coop.hash());
  });
});

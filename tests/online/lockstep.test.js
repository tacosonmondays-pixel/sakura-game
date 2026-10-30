import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Lockstep, REBUILD_TIMEOUT_MS } from '../../src/online/coop/lockstep.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { defaultData } from '../../src/sim/data.js';
import { VIADUCT_FIXTURE, VIADUCT_CROSSING, viaductStage } from '../../previews/viaductMaps.js';
import { createCoopSim, quantize } from '../../src/online/coop/commands.js';
import { withDetMath } from '../../src/online/coop/detMath.js';
import { COOP, coopStage, coopStartCash } from '../../src/data/coop.js';
import { STAGE_MAP } from '../../src/data/stages.js';
import { createRng } from '../../src/core/rng.js';
import { ENEMY_MAP } from '../../src/data/enemies.js';

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
function harness({ seed = 7, drop = 0, maxLag = 9, net = null, start = START, opts = {}, budget = null } = {}) {
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
  let lose = null; // (slot, msg) => true drops that message (set through the returned object)
  const sent = [[], []];
  const absorbed = [[], []]; // Tenka's lab absorbs each client ran: { t, p, uids }
  const mk = (slot) => new Lockstep({
    start,
    mySlot: slot,
    now: () => clock.t,
    ...(net ? { delay: net.inputDelay, heartbeatMs: net.heartbeatMs, keepaliveMs: net.keepaliveMs } : {}),
    ...opts,
    hooks: {
      onApplied: (c, r) => {
        if (!r.ok) failed.push({ slot, c, r: r.reason });
        if (r.absorbed) absorbed[slot].push({ t: c.t, p: c.p, uids: r.absorbed });
      },
      onPeerGone: (s, why) => events.push({ slot, ev: 'gone', why, frame }),
      onPeerBack: () => events.push({ slot, ev: 'back', frame }),
      onResync: () => events.push({ slot, ev: 'resync', frame }),
    },
    send: (msg) => {
      sent[slot].push({ frame, type: msg.type, bytes: JSON.stringify(msg).length });
      if (!link[slot] || (drop && rng.next() < drop) || lose?.(slot, msg)) return;
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
    clients.forEach((c, i) => { if (!frozen.has(i)) c.advance(1 / 60, budget == null ? undefined : { budgetMs: budget }); });
  }
  return {
    clients, stepFrame, clock, failed, events, link, frozen, sent, absorbed,
    get frame() { return frame; },
    set lose(fn) { lose = fn; },
    set budget(v) { budget = v; },
  };
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

  it('a fatal desync says so in its goodbye: the ally drops it as "desync" (not "left") and offers no rejoin', () => {
    // in order, like one sender's messages on a Realtime channel (the goodbye before its next beats)
    const h = harness({ seed: 36, maxLag: 0 });
    run(h, null, 200);
    const [A, B] = h.clients;
    // the guest's hash check failed twice in a row (no state is touched: only the verdict)
    B.flagMismatch(); // first strike: it asks the host for its state…
    run(h, null, 60);
    expect(B.resyncs).toBe(1);
    B.flagMismatch(); // …second strike shortly after: the engines disagree, it gives up
    expect(B.desynced).toBe(true);
    expect(B.peers.get(0)).toMatchObject({ gone: true, why: 'desync' });
    run(h, null, 30);
    // the host was not left: the guest's battle runs on solo (and so does the host's)
    expect(A.peers.get(1)).toMatchObject({ gone: true, why: 'desync' });
    expect(h.events.filter((e) => e.slot === 0 && e.ev === 'gone').map((e) => e.why)).toEqual(['desync']);
    run(h, null, 300); // the guest keeps beating: final all the same
    expect(A.rejoins).toBe(0);
    expect(A.peers.get(1).why).toBe('desync');
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

// Co-op freeplay through the lockstep (owner, Oct 14: "once you get past what you need like 15/15
// … 16/15"). The room's tier rides in the start message, so both clients — and every resync and
// rejoin, which rebuild from it — run the same waves past the stage's goal; the Finish vote ('end')
// travels like any other command and ends the run on the same tick everywhere.
describe('co-op lockstep: freeplay', () => {
  // test-only profile bonuses so a scripted pair of six girls lives well past the goal
  const STRONG = { damageMul: 60, costMul: 0.2, rangeMul: 1.3 };
  const fpStart = (freeplay, stageId = '1-1') => ({
    seed: 4242,
    stageId,
    difficulty: 'normal',
    freeplay,
    players: [
      { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'aoi', stats: STRONG }, { unitId: 'rei', stats: STRONG }], hero: { unitId: 'hikari', stats: STRONG } },
      { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'rei', stats: STRONG }, { unitId: 'yuki', stats: STRONG }], hero: null },
    ],
  });
  /** Three legal spots for `unitId` next to the path of the start's map (1.3 tiles apart). */
  function board(start) {
    const c = createCoopSim(start);
    const cands = [];
    for (let y = 0.55; y < c.sim.map.height; y += 0.35) {
      for (let x = 0.55; x < c.sim.map.width; x += 0.35) {
        if (!c.sim.placementReason('aoi', x, y) && !c.sim.placementReason('yuki', x, y)) cands.push([x, y, c.sim.placement.pathDistance(x, y)]);
      }
    }
    cands.sort((a, b) => a[2] - b[2]);
    const out = [];
    for (const [x, y] of cands) {
      if (out.length >= 6) break;
      if (!out.some(([tx, ty]) => Math.hypot(tx - x, ty - y) < 1.3)) out.push([x, y]);
    }
    return { aoi: out.slice(0, 3), yuki: out.slice(3, 6) };
  }
  /** Drains both clients' battle events (as their battle screens do) and keeps what the tests read. */
  function watcher(h) {
    const seen = h.clients.map(() => ({ goal: [], won: [], bosses: new Set() }));
    const each = () => h.clients.forEach((c, i) => {
      if (!c.sim) return;
      for (const e of c.sim.drainEvents()) {
        if (e.type === 'goal') seen[i].goal.push(e.wave);
        else if (e.type === 'won') seen[i].won.push(e);
        else if (e.type === 'spawn' && !['normal', 'elite'].includes(ENEMY_MAP[e.id]?.tier)) seen[i].bosses.add(`${c.sim.wave}:${e.id}`);
      }
    });
    return { seen, each };
  }
  /** Frames until cond() holds (or max frames): true when it held. */
  function runUntil(h, cond, max, each) {
    for (let f = 0; f < max && !cond(); f++) {
      h.stepFrame();
      each?.();
    }
    return cond();
  }
  /** Both deploy three strong girls, the host starts at 3× with Auto on; runs until both cleared the goal. */
  function toGoal(h, start, each) {
    const [A, B] = h.clients;
    const { aoi, yuki } = board(start);
    for (const p of aoi) A.queue('place', ['aoi', ...quantize(...p)]);
    for (const p of yuki) B.queue('place', ['yuki', ...quantize(...p)]);
    A.queue('speed', [3]);
    A.queue('wave');
    A.queue('auto', [true]);
    const done = () => A.sim.wavesCleared >= A.sim.totalWaves && B.sim.wavesCleared >= B.sim.totalWaves;
    expect(runUntil(h, done, 60 * 60 * 10, each)).toBe(true);
  }
  const allEqual = (c) => c.hashPairs().every((p) => p.mine === p.theirs);

  it('a start without freeplay is a normal battle; with a tier both clients build the freeplay battle', () => {
    expect(harness().clients[0].sim.freeplay).toBe(false);
    const h = harness({ start: fpStart('tempest') });
    for (const c of h.clients) {
      expect(c.sim.freeplay).toBe(true);
      expect(c.sim.stage.freeplay.id).toBe('tempest');
      expect(c.sim.totalWaves).toBe(STAGE_MAP['1-1'].waves);
    }
  });

  it('both play through the goal and 20 freeplay waves in sync (bosses on the way), then both vote Finish: won on the same tick', () => {
    const start = fpStart('crimson');
    const h = harness({ seed: 51, maxLag: 4, start });
    const [A, B] = h.clients;
    const w = watcher(h);
    // a Finish vote before the goal is refused on both clients and counts for nothing
    runUntil(h, () => false, 10, w.each);
    B.queue('end', [true]);
    toGoal(h, start, w.each);
    expect(h.failed.filter((f) => f.c.k === 'end').map((f) => [f.slot, f.r]).sort()).toEqual([[0, 'notYet'], [1, 'notYet']]);
    expect(h.failed.filter((f) => f.c.k !== 'end')).toEqual([]);
    expect(A.coop.endVotes()).toEqual([false, false]);
    const goal = A.sim.totalWaves;
    // the goal is a clear, not the end: the 'goal' event once on each screen, the battle goes on
    for (const s of w.seen) expect(s.goal).toEqual([goal]);
    expect(A.sim.state).not.toBe('won');
    // 20 waves past it (Auto on): visitors, armor, bosses (crimson 1-1: a miniboss at 20 and 30)
    expect(runUntil(h, () => A.sim.wave >= goal + 20 && B.sim.wave >= goal + 20, 60 * 60 * 30, w.each)).toBe(true);
    expect(A.finished || B.finished).toBe(false);
    expect(A.sim.freeplayInfo(goal + 20).pressure.armor).toBeGreaterThan(0);
    for (const s of w.seen) {
      const waves = [...new Set([...s.bosses].map((k) => Number(k.split(':')[0])))];
      expect(waves.filter((n) => n > goal).length).toBeGreaterThanOrEqual(2);
    }
    expect(w.seen[1].bosses).toEqual(w.seen[0].bosses);
    // one vote is not enough…
    A.queue('end', [true]);
    runUntil(h, () => false, 60, w.each);
    expect(A.coop.endVotes()).toEqual([true, false]);
    expect(B.coop.endVotes()).toEqual([true, false]);
    expect(A.finished || B.finished).toBe(false);
    // …both end the run, on the same tick on both screens
    B.queue('end', [true]);
    expect(runUntil(h, () => A.finished && B.finished, 600, w.each)).toBe(true);
    runUntil(h, () => false, 20, w.each); // the last horizons and hashes land
    expect(A.tick).toBe(B.tick);
    expect(A.coop.hash()).toBe(B.coop.hash());
    expect(A.sim.result()).toEqual(B.sim.result());
    expect(A.sim.result()).toMatchObject({ won: true, finished: true, freeplay: 'crimson', goal, goalReached: true });
    for (const s of w.seen) expect(s.won).toEqual([{ type: 'won', finished: true }]);
    // in sync all along: hash pairs every 120 ticks, no resync, no desync
    expect(A.hashPairs().length).toBeGreaterThan(20);
    expect(allEqual(A) && allEqual(B)).toBe(true);
    expect(A.resyncs + B.resyncs).toBe(0);
    expect(A.desynced || B.desynced).toBe(false);
  }, 180000);

  it('a resync after the goal rebuilds the freeplay battle (and the votes cast so far) from the start message', () => {
    const start = fpStart('blossom');
    const h = harness({ seed: 52, maxLag: 3, start });
    const [A, B] = h.clients;
    const w = watcher(h);
    toGoal(h, start, w.each);
    const goal = A.sim.totalWaves;
    runUntil(h, () => A.sim.wave > goal && B.sim.wave > goal, 60 * 60, w.each);
    B.queue('end', [true]);
    runUntil(h, () => false, 60, w.each);
    expect(A.coop.endVotes()).toEqual([false, true]);
    B.sim.lives -= 7; // corrupt the guest's state: the hash check catches it, the host's log repairs it
    expect(runUntil(h, () => B.resyncs > 0, 60 * 10, w.each)).toBe(true);
    const B2 = h.clients[1];
    expect(B2.sim.freeplay).toBe(true);
    expect(B2.sim.stage.freeplay.id).toBe('blossom');
    expect(B2.sim.lives).toBe(A.sim.lives);
    expect(B2.coop.endVotes()).toEqual([false, true]);
    const t = A.tick;
    A.queue('end', [true]);
    expect(runUntil(h, () => A.finished && B2.finished, 600, w.each)).toBe(true);
    runUntil(h, () => false, 20, w.each);
    expect(A.tick).toBe(B2.tick);
    expect(A.coop.hash()).toBe(B2.coop.hash());
    expect(A.sim.finished && B2.sim.finished).toBe(true);
    expect(B2.hashPairs().filter((p) => p.t > t - 240).every((p) => p.mine === p.theirs)).toBe(true);
    expect(B2.desynced).toBe(false);
  }, 120000);

  it('an ally who drops out does not block the Finish: her drop re-checks the votes and the one left finishes alone', () => {
    const start = fpStart('blossom');
    const h = harness({ seed: 53, maxLag: 3, start });
    const [A, B] = h.clients;
    const w = watcher(h);
    toGoal(h, start, w.each);
    A.queue('end', [true]);
    runUntil(h, () => false, 60, w.each);
    expect(A.coop.endVotes()).toEqual([true, false]);
    expect(A.finished).toBe(false);
    // the guest's tab dies: after the timeout the host drops it, and its own vote is enough
    h.clients[1] = { receive() {}, advance() {} };
    expect(runUntil(h, () => A.finished, Math.ceil((COOP.maxTimeoutMs / 1000 + 3) * 60), w.each)).toBe(true);
    expect(A.peers.get(1).gone).toBe(true);
    expect(A.sim.result()).toMatchObject({ won: true, finished: true, goalReached: true });
    // the drop is a marker in the host's log: a replay of it ends on the same tick
    const copy = new Lockstep({ start, mySlot: 0, send: () => {}, now: () => 0 });
    copy.rebuild(start, A.log, A.tick);
    expect(copy.sim.finished).toBe(true);
    expect(copy.coop.hash()).toBe(A.coop.hash());
    expect(B.sim.finished).toBe(false); // (the guest's own battle never saw the end)
  }, 120000);

  it('a guest frozen past the timeout after the goal comes back into the same freeplay run; her earlier vote still counts', () => {
    const start = fpStart('tempest');
    const h = harness({ seed: 54, maxLag: 3, start });
    const [A, B] = h.clients;
    const w = watcher(h);
    toGoal(h, start, w.each);
    B.queue('end', [true]);
    runUntil(h, () => false, 60, w.each);
    expect(A.coop.endVotes()).toEqual([false, true]);
    h.frozen.add(1);
    runUntil(h, () => false, Math.ceil((COOP.maxTimeoutMs / 1000 + 3) * 60), w.each);
    expect(A.peers.get(1).gone).toBe(true);
    expect(A.finished).toBe(false); // the host had not voted: the run goes on alone
    h.frozen.delete(1);
    expect(runUntil(h, () => A.rejoins === 1 && B.rejoins === 1, 60 * 8, w.each)).toBe(true);
    expect(B.sim.freeplay).toBe(true);
    expect(B.coop.endVotes()).toEqual([false, true]);
    A.queue('end', [true]);
    expect(runUntil(h, () => A.finished && B.finished, 60 * 5, w.each)).toBe(true);
    runUntil(h, () => false, 20, w.each);
    expect(A.tick).toBe(B.tick);
    expect(A.coop.hash()).toBe(B.coop.hash());
    expect(B.sim.result()).toMatchObject({ won: true, finished: true, freeplay: 'tempest' });
  }, 120000);

  it('a guest that finished alone during a two-way cut stays finished when the link heals (no rejoin pulls it back)', () => {
    const start = fpStart('tempest');
    const h = harness({ seed: 54, maxLag: 3, start });
    const [A, B] = h.clients;
    const w = watcher(h);
    toGoal(h, start, w.each);
    B.queue('end', [true]);
    runUntil(h, () => false, 60, w.each);
    expect(A.coop.endVotes()).toEqual([false, true]);
    // both pages keep running, nothing gets through: each drops the other; the guest's own
    // 'gone' marker re-checks the votes and its run ends (its result is shown and paid)
    h.link[0] = false;
    h.link[1] = false;
    runUntil(h, () => false, Math.ceil((COOP.maxTimeoutMs / 1000 + 8) * 60), w.each);
    expect(B.finished).toBe(true);
    expect(B.sim.result()).toMatchObject({ won: true, finished: true });
    expect(A.finished).toBe(false);
    const bTick = B.tick;
    const bHash = B.coop.hash();
    // the link heals: the host hears the finished guest ('done') and offers nothing; an offer
    // from an older build would be ignored by the guest anyway
    h.link[0] = true;
    h.link[1] = true;
    runUntil(h, () => false, 60 * 15, w.each);
    expect(A.rejoins).toBe(0);
    expect(B.rejoins).toBe(0);
    expect(B.finished).toBe(true);
    expect(B.tick).toBe(bTick);
    expect(B.coop.hash()).toBe(bHash);
    expect(h.events.filter((e) => e.slot === 1 && e.ev === 'resync')).toEqual([]);
    expect(A.sim.wave).toBeGreaterThan(B.sim.wave - 1); // the host plays on alone
    // a rejoin offer reaching a finished guest (older host) is ignored too
    const ep = B.epoch;
    B.receive({ type: 'rejoin', from: 0, ep: ep + 5, start, T: A.tick, w: A.sim.wave, cmds: A.log, ck: null });
    expect(B.job).toBe(null);
    expect(B.finished).toBe(true);
    expect(B.epoch).toBe(ep);
  }, 120000);
  // ---- long runs: wave-end checkpoints, background rebuilds (spec §12, M5 + M6) ----------------

  /** Plays on until both clients cleared `n` more waves than now (Auto on). */
  const moreWaves = (h, n, each) => {
    const [A, B] = h.clients;
    const to = Math.max(A.sim.wavesCleared, B.sim.wavesCleared) + n;
    return runUntil(h, () => h.clients[0].sim.wavesCleared >= to && h.clients[1].sim.wavesCleared >= to, 60 * 60 * 40, each);
  };
  /** Both clients' common hashes after tick t all agree (and there are some). */
  const agreeAfter = (h, t) => {
    const all = h.clients.flatMap((c) => c.hashPairs().filter((p) => p.t > t));
    return all.length > 0 && all.every((p) => p.mine === p.theirs);
  };

  it('a resync deep in a freeplay run restores the host\'s last wave-end checkpoint and replays one wave, not the run; then 10 waves in sync', () => {
    const start = fpStart('blossom');
    const h = harness({ seed: 61, maxLag: 3, start });
    const [A, B] = h.clients;
    const w = watcher(h);
    toGoal(h, start, w.each);
    expect(moreWaves(h, 5, w.each)).toBe(true);
    // the host keeps a checkpoint at every wave end (the guest does not need any)
    expect(A.ck).toBeTruthy();
    expect(A.ck.wave).toBe(A.sim.wavesCleared);
    expect(B.ck).toBe(null);
    B.sim.lives -= 3; // corrupt the guest: the hash check catches it, the host's checkpoint repairs it
    expect(runUntil(h, () => B.resyncs > 0, 60 * 20, w.each)).toBe(true);
    const r = B.lastRebuild;
    expect(r).toMatchObject({ kind: 'resync', restored: true });
    expect(r.from).toBeGreaterThan(0);
    expect(r.ticks).toBeLessThan(r.T / 4); // only since the last wave end
    expect(B.sim.lives).toBe(A.sim.lives);
    const t = A.tick;
    // 10 more waves past it: same battle on both (bosses on the way), no second resync
    expect(moreWaves(h, 10, w.each)).toBe(true);
    runUntil(h, () => false, 30, w.each);
    expect(agreeAfter(h, t)).toBe(true);
    expect(B.resyncs).toBe(1);
    expect(A.desynced || B.desynced).toBe(false);
    expect(A.sim.towers.length).toBe(B.sim.towers.length);
    // the guest's battle is a fresh one (its own Sim object, the old screen's is gone)
    expect(h.events.filter((e) => e.slot === 1 && e.ev === 'resync').length).toBe(1);
  }, 300000);

  it('a network cut deep in freeplay: both play on alone, then the guest rejoins through the host\'s checkpoint and both agree for 10 more waves', () => {
    const start = fpStart('tempest');
    const h = harness({ seed: 62, maxLag: 3, start });
    const [A, B] = h.clients;
    const w = watcher(h);
    toGoal(h, start, w.each);
    expect(moreWaves(h, 3, w.each)).toBe(true);
    h.link[0] = false;
    h.link[1] = false;
    runUntil(h, () => false, Math.ceil((COOP.maxTimeoutMs / 1000 + 4) * 60), w.each);
    expect(A.peers.get(1).gone && B.peers.get(0).gone).toBe(true);
    const apartWaves = A.sim.wavesCleared;
    h.link[0] = true;
    h.link[1] = true;
    expect(runUntil(h, () => A.rejoins === 1 && B.rejoins === 1 && !A.peers.get(1).gone && !B.job, 60 * 20, w.each)).toBe(true);
    // the guest had played on alone (its own 'gone' marker): not the host's timeline, so it
    // rebuilt — from the host's newest checkpoint, replaying only since that wave end
    const r = B.lastRebuild;
    expect(r).toMatchObject({ kind: 'rejoin', restored: true });
    expect(r.from).toBeGreaterThan(0);
    expect(r.T - r.from).toBeLessThan(60 * 60 * 3);
    expect(r.ticks).toBe(r.T - r.from);
    expect(A.sim.wavesCleared).toBeGreaterThanOrEqual(apartWaves);
    const t = A.tick;
    expect(moreWaves(h, 10, w.each)).toBe(true);
    runUntil(h, () => false, 30, w.each);
    expect(agreeAfter(h, t)).toBe(true);
    expect(A.coop.wallets[1]).toBeGreaterThan(0);
    expect(A.desynced || B.desynced).toBe(false);
  }, 300000);

  it('a rebuild runs in slices (the page stays responsive) and reaches the same battle as replaying in one go, from tick 0 or from the checkpoint', () => {
    const start = fpStart('crimson');
    const h = harness({ seed: 63, maxLag: 3, start });
    const [A] = h.clients;
    const w = watcher(h);
    toGoal(h, start, w.each);
    expect(moreWaves(h, 3, w.each)).toBe(true);
    runUntil(h, () => A.sim.state === 'wave' && A.sim.enemies.length > 3, 60 * 60, w.each); // mid-wave
    const T = A.tick;
    const want = A.coop.hash();
    const copy = () => new Lockstep({ start, mySlot: 1, send: () => {}, now: () => 0 });
    // in one go, from tick 0 (what every resync did before)
    const whole = copy();
    let t0 = performance.now();
    whole.rebuild(start, A.log, T);
    const wholeMs = performance.now() - t0;
    expect(whole.tick).toBe(T);
    expect(whole.coop.hash()).toBe(want);
    // as a background job from tick 0: many slices, none of them long, the same battle
    const sliced = copy();
    sliced.startRebuild('resync', start, A.log, T, null, A.sim.wave, null);
    let slices = 0;
    let longest = 0;
    while (sliced.job) {
      t0 = performance.now();
      sliced.runJob(4);
      longest = Math.max(longest, performance.now() - t0);
      slices++;
      expect(sliced.rebuilding === null || sliced.rebuilding.done < sliced.rebuilding.total).toBe(true);
    }
    expect(slices).toBeGreaterThan(20);
    expect(longest).toBeLessThan(Math.max(250, wholeMs / 10)); // (a loaded machine stretches a 4 ms slice)
    expect(sliced.tick).toBe(T);
    expect(sliced.coop.hash()).toBe(want);
    // from the host's checkpoint: a fraction of the replay, the same battle
    const ck = JSON.parse(JSON.stringify(A.checkpointMsg()));
    expect(ck.t).toBeGreaterThan(T / 2);
    const fast = copy();
    fast.rebuild(start, A.log, T, ck);
    expect(fast.lastRebuild).toMatchObject({ restored: true, from: ck.t, ticks: T - ck.t });
    expect(fast.tick).toBe(T);
    expect(fast.coop.hash()).toBe(want);
    expect(JSON.stringify(fast.coop.snapshot())).toBe(JSON.stringify(A.coop.snapshot()));
  }, 300000);

  it('a slow rebuild (no checkpoint, a starved page) keeps the host waiting: busy beats, no drop, then in sync', () => {
    const start = fpStart('blossom');
    const h = harness({ seed: 64, maxLag: 3, start });
    const [A, B] = h.clients;
    const w = watcher(h);
    toGoal(h, start, w.each);
    expect(moreWaves(h, 8, w.each)).toBe(true);
    // no checkpoint (as if snapshots had failed): the guest replays the whole run, 32 ticks a frame
    A.ckOff = true;
    A.ck = null;
    h.budget = 0;
    B.sim.lives -= 1;
    expect(runUntil(h, () => !!B.job, 60 * 10, w.each)).toBe(true);
    let busySeen = 0;
    let frames = 0;
    let maxDone = 0;
    while (B.job && frames < 60 * 120) {
      h.stepFrame();
      w.each();
      frames++;
      const busy = A.peers.get(1).busy;
      if (busy) {
        busySeen++;
        maxDone = Math.max(maxDone, busy.at / busy.of);
      }
      expect(A.peers.get(1).gone).toBe(false);
    }
    expect(B.job).toBe(null);
    expect(B.lastRebuild).toMatchObject({ kind: 'resync', restored: false, from: 0 });
    expect(frames).toBeGreaterThan(Math.ceil(COOP.timeoutMs / 1000 * 60)); // longer than the drop timeout
    expect(busySeen).toBeGreaterThan(0);
    expect(maxDone).toBeGreaterThan(0.5); // the host saw the progress ("Rin is re-syncing… 70%")
    h.budget = null;
    const t = A.tick;
    runUntil(h, () => A.tick > t + 600 && B.tick > t + 600, 60 * 60, w.each);
    expect(agreeAfter(h, t)).toBe(true);
    expect(A.peers.get(1).busy).toBe(null);
    expect(B.desynced).toBe(false);
  }, 300000);
});

describe('co-op lockstep: big messages and the idle saver', () => {
  it('a resync too big for one message travels in parts (reordered, one lost: the guest asks again) and repairs the guest', () => {
    const h = harness({ seed: 71, maxLag: 6, opts: { maxMessageBytes: 300 } });
    // two girls of each player's on spots of their own (the shared board above may be full by now)
    const c = createCoopSim(START);
    const free = [];
    for (let y = 0.55; y < c.sim.map.height && free.length < 2; y += 0.35) {
      for (let x = 0.55; x < c.sim.map.width && free.length < 2; x += 0.35) {
        if (!c.sim.placementReason('aoi', x, y) && !c.sim.placementReason('yuki', x, y) && c.sim.placement.pathDistance(x, y) < 1.6
          && !free.some(([fx, fy]) => Math.hypot(fx - x, fy - y) < 1.5)) free.push([x, y]);
      }
    }
    const actions = {
      5: () => h.clients[0].queue('place', ['aoi', ...quantize(...free[0])]),
      6: () => h.clients[1].queue('place', ['yuki', ...quantize(...free[1])]),
      20: () => h.clients[0].queue('wave'),
      30: () => h.clients[0].queue('auto', [true]),
    };
    let lost = 0;
    h.lose = (slot, msg) => {
      if (slot === 0 && msg.type === 'part' && msg.i === 2 && !lost) {
        lost++;
        return true;
      }
      return false;
    };
    for (let f = 0; f < 1500; f++) {
      actions[h.frame]?.();
      h.stepFrame();
      if (f === 400) h.clients[1].sim.lives -= 5;
    }
    const [A, B] = h.clients;
    const parts = h.sent[0].filter((m) => m.type === 'part');
    expect(lost).toBe(1);
    expect(parts.length).toBeGreaterThanOrEqual(4);
    expect(h.sent[0].filter((m) => m.type === 'resync').length).toBe(0); // (every answer went in parts)
    expect(Math.max(...parts.map((m) => m.bytes))).toBeLessThan(600); // ~300 characters of JSON each + the envelope
    expect(B.resyncs).toBe(1);
    expect(h.sent[1].filter((m) => m.type === 'resync?').length).toBeGreaterThanOrEqual(2); // the retry
    for (let f = 0; f < 300; f++) h.stepFrame();
    const late = B.hashPairs().filter((p) => p.t > A.tick - 400);
    expect(late.length).toBeGreaterThan(0);
    expect(late.every((p) => p.mine === p.theirs)).toBe(true);
    expect(B.desynced).toBe(false);
  });

  it('after a rebuild the ally waits up to REBUILD_TIMEOUT_MS for the battle screen to reload (not the 12–20 s drop timeout)', () => {
    const h = harness({ seed: 73, maxLag: 3 });
    const [A, B] = h.clients;
    for (let f = 0; f < 600; f++) {
      if (h.frame === 20) A.queue('wave');
      h.stepFrame();
    }
    B.sim.lives -= 2;
    let f = 0;
    while (!B.resyncs && f++ < 60 * 20) h.stepFrame();
    expect(B.resyncs).toBe(1);
    // the guest's page blocks while its battle screen reloads (a phone compiling shaders): its last
    // packets (busy, then "not live yet") still arrive
    h.frozen.add(1);
    for (let i = 0; i < 12; i++) h.stepFrame();
    expect(A.peers.get(1).ready).toBe(false);
    expect(A.peers.get(1).rebuilt).toBe(true);
    for (let i = 0; i < Math.ceil((COOP.loadTimeoutMs / 1000 + 10) * 60); i++) h.stepFrame();
    expect(A.peers.get(1).gone).toBe(false); // longer than the load timeout, still waited for
    for (let i = 0; i < Math.ceil(((REBUILD_TIMEOUT_MS - COOP.loadTimeoutMs) / 1000) * 60); i++) h.stepFrame();
    expect(A.peers.get(1).gone).toBe(true); // …but not for ever
    expect(A.peers.get(1).why).toBe('timeout');
  });

  it('idle saver (Supabase rooms): with no orders for 10 s each client beats ~2× a second, not ~4×; the next order still runs on both', () => {
    const supa = { heartbeatMs: 250, inputDelay: 30, keepaliveMs: 1000 };
    const idle = { idleAfterMs: 10000, idleLeadTicks: 60, idleKeepaliveMs: 2000 };
    const rate = (withSaver) => {
      const h = harness({ seed: 72, maxLag: 9, net: supa, opts: withSaver ? idle : {} });
      const [A, B] = h.clients;
      for (let f = 0; f < 70 * 60; f++) {
        if (h.frame === 5) A.queue('speed', [3]);
        if (h.frame === 6) A.queue('wave');
        h.stepFrame();
      }
      const window = (list) => list.filter((m) => m.frame >= 15 * 60 && m.frame < 70 * 60).length / 55;
      return { h, A, B, rates: h.sent.map(window) };
    };
    const before = rate(false);
    const after = rate(true);
    for (const r of after.rates) expect(r).toBeLessThan(2.4);
    for (let i = 0; i < 2; i++) expect(after.rates[i]).toBeLessThan(before.rates[i] * 0.65);
    // still in lockstep while idle (no stalls beyond the first second), hashes agree
    const { h, A, B } = after;
    expect(A.tick).toBeGreaterThan(70 * 60 * 2.5);
    expect(A.hashPairs().every((p) => p.mine === p.theirs)).toBe(true);
    // the guest's first order after the idle spell lands within ~1 s (+ the input delay) on both
    const order = B.queue('auto', [true]);
    expect(order.t - B.tick).toBeLessThanOrEqual(60 * 3 + 30 * 3);
    for (let f = 0; f < 4 * 60; f++) h.stepFrame();
    expect(A.sim.options.autoStart && B.sim.options.autoStart).toBe(true);
    expect(A.hashPairs().slice(-3).every((p) => p.mine === p.theirs)).toBe(true);
    console.log(`idle saver: messages/s per client ${before.rates.map((r) => r.toFixed(2)).join(' / ')} → ${after.rates.map((r) => r.toFixed(2)).join(' / ')}`);
  }, 120000);
});

// T3 review coop-1 (the review's probe notes/t3-review/coop-lockstep.test.js part C, folded in): Tenka's lab
// team through the network flow, not only through CoopSim views and one-go rebuilds. The host buys Unified
// Theory (the second absorb) while the guest is dropped, the guest rejoins (the host's offer, her catch-up
// through that absorb), a corrupted lab.interest on the guest is caught by the hash and repaired by a resync
// from the host's checkpoint, and rebuilds from that checkpoint and from tick 0 reach the host's battle.
describe('co-op lockstep: Tenka\'s lab team through a drop, a rejoin and a resync', () => {
  const cheap = (ids) => ids.map((unitId) => ({ unitId, stats: { costMul: unitId === 'tenka' ? 0.01 : 0.05 } }));
  const TENKA = {
    seed: 777,
    stageId: '2-5',
    difficulty: 'normal',
    players: [
      { slot: 0, uid: 'host', name: 'Host', loadout: cheap(['tenka', 'momo', 'aoi', 'akane']), hero: null },
      { slot: 1, uid: 'guest', name: 'Guest', loadout: cheap(['rei', 'yuki']), hero: null },
    ],
  };
  /** Her spot (nearest the road with room) and spots for `units` within `maxD` of her, ≥ 1.3 tiles apart. */
  function layout(start, units, maxD) {
    return withDetMath(() => {
      const sim = createCoopSim(start).sim;
      const cand = (u) => {
        const out = [];
        for (let y = 0.55; y < sim.map.height; y += 0.35) {
          for (let x = 0.55; x < sim.map.width; x += 0.35) {
            const q = quantize(x, y);
            if (!sim.placementReason(u, q[0] / 1024, q[1] / 1024)) out.push(q);
          }
        }
        return out;
      };
      const order = (a, b) => a[0] - b[0] || a[1][1] - b[1][1] || a[1][0] - b[1][0];
      const tk = cand('tenka').map((q) => [sim.placement.pathDistance(q[0] / 1024, q[1] / 1024), q]).sort(order);
      for (const [, q] of tk) {
        const taken = [[q[0] / 1024, q[1] / 1024]];
        const out = { tenka: q };
        for (const u of units) {
          const best = cand(u).map((p) => [((p[0] - q[0]) / 1024) ** 2 + ((p[1] - q[1]) / 1024) ** 2, p])
            .filter(([d2, p]) => d2 <= maxD * maxD && !taken.some(([x, y]) => (x - p[0] / 1024) ** 2 + (y - p[1] / 1024) ** 2 < 1.69))
            .sort(order)[0];
          if (!best) break;
          out[u] = best[1];
          taken.push([best[1][0] / 1024, best[1][1] / 1024]);
        }
        if (units.every((u) => out[u])) return out;
      }
      throw new Error('no layout for Tenka and her girls');
    });
  }
  const runUntil = (h, pred, max, each = null) => {
    for (let f = 0; f < max; f++) {
      if (pred()) return true;
      h.stepFrame();
      each?.();
    }
    return pred();
  };

  it('Unified Theory while the guest is gone, her rejoin (a catch-up through that absorb), a resync after a corrupted lab.interest: one battle on both', () => {
    const L = layout(TENKA, ['momo', 'aoi', 'rei', 'akane'], 3.6);
    const h = harness({ seed: 91, maxLag: 6, start: TENKA });
    const [A, B] = h.clients;
    const mineOf = (c, slot, unitId) => c.sim.towers.find((t) => t.unitId === unitId && t.owner === slot) || null;
    const distTo = (sim, a, b) => {
      const p = sim.getTower(a);
      const q = sim.getTower(b);
      return Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
    };
    // the orders, each given once its effect shows on the client that gave it (again after 90 frames if not):
    // her Tenka, the guest's Rei in her range, Momo with Merch Table (interest) and Aoi, Joint Research, the
    // waves on Auto, then Akane, who waits for Unified Theory
    const plan = [
      { p: 0, place: 'tenka' }, { p: 1, place: 'rei' }, { p: 0, place: 'momo' }, { p: 0, place: 'aoi' },
      { p: 0, upg: 'momo', path: 1, to: 1 }, { p: 0, upg: 'momo', path: 1, to: 2 },
      { p: 0, upg: 'tenka', path: 0, to: 1 }, { p: 0, upg: 'tenka', path: 0, to: 2 }, { p: 0, upg: 'tenka', path: 0, to: 3 },
      { p: 0, auto: true }, { p: 0, wave: true }, { p: 0, place: 'akane' }, { p: 0, upg: 'tenka', path: 0, to: 4 },
    ];
    let next = 0;
    let at = -1e9;
    const uidOf = {}; // the host's girls, as they stood
    const isDone = (s) => {
      const c = h.clients[s.p];
      if (s.place) return !!mineOf(c, s.p, s.place);
      if (s.upg) return (mineOf(c, s.p, s.upg)?.tiers[s.path] ?? 0) >= s.to;
      if (s.auto) return c.sim.options.autoStart === true;
      return c.sim.wave >= 1;
    };
    const drive = () => {
      for (const t of A.sim.towers) if (t.owner === 0) uidOf[t.unitId] = t.uid;
      while (next < plan.length && isDone(plan[next])) next++;
      if (next >= plan.length || h.frame - at < 90) return;
      const s = plan[next];
      const c = h.clients[s.p];
      at = h.frame;
      if (s.place) c.queue('place', [s.place, ...L[s.place]]);
      else if (s.upg) {
        const t = mineOf(c, s.p, s.upg);
        if (t) c.queue('upg', [t.uid, s.path]);
      } else if (s.auto) c.queue('auto', [true]);
      else c.queue('wave');
    };
    expect(runUntil(h, () => next >= plan.length && A.sim.wavesCleared >= 2 && A.ck, 60 * 60 * 6, drive)).toBe(true);
    const tk = mineOf(A, 0, 'tenka').uid;
    const rei = mineOf(B, 1, 'rei').uid;
    const akane = mineOf(A, 0, 'akane').uid;
    const range = A.sim.getTower(tk).eff.range;
    // Joint Research took her Momo and Aoi; the guest's Rei stood in her range and stays the guest's
    expect(distTo(A.sim, rei, tk)).toBeLessThanOrEqual(range);
    expect(distTo(A.sim, akane, tk)).toBeLessThanOrEqual(range);
    expect(h.absorbed[0]).toHaveLength(1);
    expect(h.absorbed[0][0].uids).toEqual([uidOf.momo, uidOf.aoi].sort((a, b) => a - b));
    expect(h.absorbed[1]).toEqual(h.absorbed[0]); // the guest's client ran the same absorb
    expect(B.coop.ownerOf(uidOf.momo)).toBeUndefined();
    expect(A.sim.getTower(tk).lab.interest).toHaveLength(1); // Momo's Merch Table
    // the guest's tab freezes mid-wave until the host drops her
    expect(runUntil(h, () => A.sim.state === 'wave' && A.sim._waveTime > 3, 60 * 60)).toBe(true);
    h.frozen.add(1);
    expect(runUntil(h, () => A.peers.get(1).gone, Math.ceil((COOP.maxTimeoutMs / 1000 + 3) * 60))).toBe(true);
    // the host buys Unified Theory mid-wave while she is gone: Akane joins
    let ut = null;
    expect(runUntil(h, () => (A.sim.getTower(tk)?.tiers[0] ?? 0) >= 5, 60 * 60 * 3, () => {
      if (A.sim.state === 'wave' && (ut == null || h.frame - ut.f > 90) && !A.sim.upgradeStatus(tk, 0).locked) {
        ut = { f: h.frame, wave: A.sim.wave, guestGone: A.peers.get(1).gone };
        A.queue('upg', [tk, 0]);
      }
    })).toBe(true);
    expect(ut.guestGone).toBe(true);
    expect(h.absorbed[0].slice(1).map((x) => x.uids)).toEqual([[akane]]);
    expect(A.coop.ownerOf(akane)).toBeUndefined();
    expect(A.sim.getTower(tk).lab.rounds).toBe(2);
    // the guest wakes up and adopts the host's timeline: a frozen tab never ran a tick of its own, so she
    // catches up in place, replaying the host's log on her own battle, Unified Theory's absorb included
    h.frozen.delete(1);
    expect(runUntil(h, () => A.rejoins >= 1 && B.rejoins >= 1 && !B.job, 60 * 20)).toBe(true);
    expect(B.lastRebuild).toMatchObject({ kind: 'catchup' });
    expect(B.lastRebuild.T).toBeGreaterThan(h.absorbed[0][1].t);
    runUntil(h, () => false, 400);
    expect(B.coop.ownerOf(akane)).toBeUndefined();
    expect(B.coop.ownerOf(rei)).toBe(1);
    expect(B.sim.getTower(tk).lab).toEqual(A.sim.getTower(tk).lab);
    expect(B.hashPairs().slice(-3).every((p) => p.mine === p.theirs)).toBe(true);
    // a drift in the field T3 added (her lab's interest rates), on the guest only, mid-wave: the hash
    // catches it and one resync, rebuilt from the host's checkpoint (which holds her lab), repairs it
    expect(runUntil(h, () => A.sim.state === 'wave' && B.sim.state === 'wave' && B.sim._waveTime > 2, 60 * 60)).toBe(true);
    const resyncs = B.resyncs;
    const wave = A.sim.wave;
    B.sim.getTower(tk).lab.interest.push(0.0137);
    const badTick = B.tick;
    expect(runUntil(h, () => B.resyncs > resyncs && !B.job, 60 * 30)).toBe(true);
    expect(B.resyncs).toBe(resyncs + 1);
    // caught by the hash's own lab fold, before the clear could pay the wrong interest into a wallet
    expect([A.sim.wave, A.sim.state]).toEqual([wave, 'wave']);
    expect(B.lastRebuild).toMatchObject({ kind: 'resync', restored: true });
    expect(B.sim.getTower(tk).lab.interest).toEqual(A.sim.getTower(tk).lab.interest);
    expect(B.sim.getTower(tk).lab).toEqual(A.sim.getTower(tk).lab);
    expect(A.hashPairs().some((p) => p.t > badTick && p.mine !== p.theirs)).toBe(true); // (it was the hash)
    // two more waves, then both agree tick for tick since the repair, and both rebuilds reach the host
    const target = A.sim.wavesCleared + 2;
    expect(runUntil(h, () => A.sim.wavesCleared >= target && B.sim.wavesCleared >= target, 60 * 60 * 6)).toBe(true);
    expect(runUntil(h, () => A.tick === B.tick, 600)).toBe(true);
    const repaired = B.trace.filter((x) => x.ev === 'rebuilt').pop().tick;
    const after = [...A.hashPairs(), ...B.hashPairs()].filter((p) => p.t > repaired);
    expect(after.length).toBeGreaterThan(5);
    expect(after.every((p) => p.mine === p.theirs)).toBe(true);
    expect(B.coop.hash()).toBe(A.coop.hash());
    expect(B.coop.wallets).toEqual(A.coop.wallets);
    const fromCk = new Lockstep({ start: TENKA, mySlot: 1, send: () => {}, now: () => 0 });
    fromCk.rebuild(TENKA, A.log, A.tick, { t: A.ck.t, snap: JSON.parse(JSON.stringify(A.ck.snap)) });
    const fromZero = new Lockstep({ start: TENKA, mySlot: 1, send: () => {}, now: () => 0 });
    fromZero.rebuild(TENKA, A.log, A.tick, null);
    expect(fromCk.lastRebuild?.restored).toBe(true);
    expect(fromCk.coop.hash()).toBe(A.coop.hash());
    expect(fromZero.coop.hash()).toBe(A.coop.hash());
    expect(A.desynced || B.desynced).toBe(false);
    expect(h.failed).toEqual([]);
  }, 120000);
});

// Gate Arc Step 6 S6v: the viaduct (STEP6_BUILD_PLAN §4) is geometry computed once per map: two clients on
// the viaduct fixture (previews/viaductMaps.js; not in MAPS, so it is registered in the sim's data source
// here) with the same command log stay bit-identical while enemies climb onto it and walk under it.
describe('co-op lockstep: the viaduct board', () => {
  const VSTART = {
    seed: 4242,
    stageId: 'fixture:viaduct',
    difficulty: 'normal',
    players: [
      { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'aoi', stats: CHEAP }, { unitId: 'rei', stats: CHEAP }], hero: null },
      { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'yuki', stats: CHEAP }], hero: null },
    ],
  };
  const maps = defaultData().maps;
  beforeAll(() => { maps[VIADUCT_FIXTURE.id] = VIADUCT_FIXTURE; });
  afterAll(() => { delete maps[VIADUCT_FIXTURE.id]; });

  it('two CoopSims with the same command log keep identical checksums', () => {
    const stage = viaductStage();
    const A = createCoopSim(VSTART, { mySlot: 0, stage });
    const B = createCoopSim(VSTART, { mySlot: 1, stage });
    expect(A.sim.map.id).toBe(VIADUCT_FIXTURE.id);
    // legal spots near the crossing (beside the viaduct's flat top and the return road), nearest the road first
    const cands = [];
    for (let y = 0.55; y < A.sim.map.height; y += 0.35) {
      for (let x = 0.55; x < A.sim.map.width; x += 0.35) {
        if (!A.sim.placementReason('aoi', x, y)) cands.push([x, y, A.sim.placement.pathDistance(x, y), Math.hypot(x - VIADUCT_CROSSING.x, y - VIADUCT_CROSSING.y)]);
      }
    }
    cands.sort((p, q) => p[2] - q[2] || p[3] - q[3]);
    const spots = [];
    for (const c of cands) if (spots.length < 3 && c[3] < 3.5 && spots.every((s) => Math.hypot(s[0] - c[0], s[1] - c[1]) >= 1.3)) spots.push(c);
    expect(spots.length).toBe(3);
    const log = [
      { t: 0, p: 0, s: 0, k: 'place', a: ['aoi', ...quantize(spots[0][0], spots[0][1])] },
      { t: 0, p: 1, s: 0, k: 'place', a: ['yuki', ...quantize(spots[1][0], spots[1][1])] },
      { t: 0, p: 0, s: 1, k: 'wave', a: [] },
      { t: 600, p: 0, s: 2, k: 'place', a: ['rei', ...quantize(spots[2][0], spots[2][1])] },
    ];
    const hashes = [[], []];
    let raisedHit = false;
    let underSeen = false;
    let seq = 10;
    for (let tick = 0; tick < 60 * 50; tick++) {
      for (const cmd of log) if (cmd.t === tick) for (const c of [A, B]) expect(c.apply(cmd).ok).toBe(true);
      if (tick > 0 && (A.sim.state === 'between' || A.sim.state === 'prep')) {
        const next = { t: tick, p: 0, s: seq++, k: 'wave', a: [] };
        for (const c of [A, B]) c.apply(next);
      }
      for (const c of [A, B]) c.step();
      for (const e of A.sim.enemies) {
        if (e.elev > 0.5 && e.hp < e.maxHp) raisedHit = true;
        if (e.underDeck) underSeen = true;
      }
      if (tick % 60 === 59) [A, B].forEach((c, i) => hashes[i].push(hashSim(c.sim, { tick: c.tick, wallets: c.wallets })));
    }
    expect(A.sim.towers.length).toBe(3);
    expect(raisedHit).toBe(true);
    expect(underSeen).toBe(true);
    expect(hashes[0].length).toBe(50);
    expect(hashes[1]).toEqual(hashes[0]);
  });
});

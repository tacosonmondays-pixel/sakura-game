// A whole scripted co-op battle, engine-agnostic: two Lockstep clients over a deterministic fake
// network (seeded 0–9 frame delays, out-of-order delivery), the same script of commands from
// both players (place, upgrade, retarget, ult, wave, speed, auto-start), run to the end. Returns
// every state hash the clients exchanged plus the final state, so e2e/engines.mjs can run it in
// V8 (Node, Chromium), JavaScriptCore (Bun, WebKit) and SpiderMonkey (Firefox) and compare.
//
// Also probes the math the sim depends on: the deterministic ports (detMath.js, what co-op runs
// on) must give the same bits everywhere; the engine's own Math.sin / atan2 / hypot are reported
// for information (they are allowed to differ, which is why co-op does not use them).
//
// Plain ES module: no Vite-only imports, so Node and Bun can import it straight from disk and a
// browser through the Vite dev server.
import { Lockstep } from '../../src/online/coop/lockstep.js';
import { createCoopSim, quantize } from '../../src/online/coop/commands.js';
import { withDetMath, DET_MATH } from '../../src/online/coop/detMath.js';
import { createRng } from '../../src/core/rng.js';
import { coopVersion } from '../../src/online/coop/version.js';

const CHEAP = { costMul: 0.5 };
export const START = Object.freeze({
  seed: 424242,
  stageId: '1-3',
  difficulty: 'normal',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'aoi', stats: CHEAP }, { unitId: 'rei', stats: CHEAP }], hero: { unitId: 'hikari', stats: CHEAP } },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'rei', stats: { ...CHEAP, damageMul: 1.2 } }, { unitId: 'yuki', stats: CHEAP }], hero: null },
  ],
});

/** FNV-1a over the bit patterns of a list of doubles → 8 hex digits. */
export function bitsHash(values) {
  const buf = new DataView(new ArrayBuffer(8));
  let h = 0x811c9dc5;
  for (const v of values) {
    buf.setFloat64(0, v);
    for (let i = 0; i < 8; i++) {
      h ^= buf.getUint8(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h.toString(16).padStart(8, '0');
}

/** Arguments like the sim's: angles of turret rings / shot spreads, map-sized deltas. */
function probeArgs() {
  const rng = createRng(99);
  const out = [];
  for (let i = 0; i < 4000; i++) out.push([(rng.next() - 0.5) * 40, (rng.next() - 0.5) * 40]);
  return out;
}

/** @returns {{ det: object, native: object }} hashes per function */
export function mathProbe() {
  const args = probeArgs();
  const run = (M) => ({
    sin: bitsHash(args.map(([a]) => M.sin(a))),
    cos: bitsHash(args.map(([a]) => M.cos(a))),
    atan2: bitsHash(args.map(([a, b]) => M.atan2(a, b))),
    hypot: bitsHash(args.map(([a, b]) => M.hypot(a, b))),
    acos: bitsHash(args.map(([a, b]) => M.acos(Math.max(-1, Math.min(1, a / (Math.abs(b) + Math.abs(a) + 1)))))),
  });
  return { det: run(DET_MATH), native: run(Math) };
}

/** Legal spots for a unit next to the path, ≥ 1.3 tiles apart (computed with the det math). */
function spotsFor(start, units) {
  return withDetMath(() => {
    const c = createCoopSim(start);
    const cands = [];
    for (let y = 0.55; y < c.sim.map.height; y += 0.35) {
      for (let x = 0.55; x < c.sim.map.width; x += 0.35) {
        const r = c.sim.placementReason(units[0], x, y);
        if (!r) cands.push([x, y, c.sim.placement.pathDistance(x, y)]);
      }
    }
    cands.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
    const taken = [];
    const out = {};
    for (const u of units) {
      out[u] = [];
      for (const [x, y] of cands) {
        if (out[u].length >= 2) break;
        if (taken.some(([tx, ty]) => Math.hypot(tx - x, ty - y) < 1.3)) continue;
        // checked where the command will put her: on the 1/1024 grid (next to the path a
        // rounding step can matter)
        const q = quantize(x, y);
        if (c.sim.placementReason(u, q[0] / 1024, q[1] / 1024)) continue;
        out[u].push(q);
        taken.push([x, y]);
      }
    }
    return out;
  });
}

/**
 * @param {{ maxFrames?: number }} [opts]
 * @returns {{ engine: string, ticks: number, state: string, wave: number, towers: number, final: string,
 *   hashes: string, checkpoints: number, agree: boolean, failed: number, math: object, ms: number }}
 */
export function runScriptedBattle({ maxFrames = 60 * 60 * 12 } = {}) {
  const t0 = Date.now();
  const rng = createRng(7);
  const clock = { t: 0 };
  const queue = [];
  let frame = 0;
  const refused = [];
  const mk = (slot) => new Lockstep({
    start: START,
    mySlot: slot,
    now: () => clock.t,
    // (slot 0's view only: both clients apply every command)
    hooks: { onApplied: (c, r) => { if (!r.ok && c.k !== 'sell' && slot === 0) refused.push(`${c.k}@${c.t}:${r.reason}`); } },
    send: (msg) => queue.push({ at: frame + Math.floor(rng.next() * 10), seq: queue.length, to: 1 - slot, msg: JSON.parse(JSON.stringify(msg)) }),
  });
  const [A, B] = [mk(0), mk(1)];
  const clients = [A, B];
  const spots = spotsFor(START, ['aoi', 'yuki', 'rei', 'hikari']);
  const mine = (c) => c.sim.towers.find((t) => c.coop.isMine(t.uid));
  const script = {
    5: () => A.queue('place', ['aoi', ...spots.aoi[0]]),
    6: () => B.queue('place', ['yuki', ...spots.yuki[0]]),
    8: () => A.queue('place', ['hikari', ...spots.hikari[0]]),
    20: () => A.queue('wave'),
    900: () => B.queue('place', ['rei', ...spots.rei[0]]),
    1000: () => later.push([A, 'rei', spots.rei[1]]),
    1400: () => { const t = mine(B); if (t) { B.queue('upg', [t.uid, 0]); B.queue('tgt', [t.uid, 'strong']); } },
    1500: () => { const t = mine(A); if (t) A.queue('upg', [t.uid, 1]); },
    1700: () => A.queue('sell', [A.sim.towers.find((t) => !A.coop.isMine(t.uid))?.uid ?? -1]), // refused: not hers
    1800: () => B.queue('speed', [2]),
    1900: () => A.queue('auto', [true]),
    2600: () => later.push([B, 'yuki', spots.yuki[1]]),
    3200: () => { const t = mine(A); if (t) A.queue('tgt', [t.uid, 'last']); },
  };
  // placements a player makes as soon as her own coins allow (her view of the Sim shows her wallet)
  const later = [];
  let ults = 0;
  let lastUlt = -1e9;
  while (frame < maxFrames && !(A.finished && B.finished)) {
    script[frame]?.();
    for (let i = later.length - 1; i >= 0; i--) {
      const [c, unit, [qx, qy]] = later[i];
      if (c.sim.canPlace(unit, qx / 1024, qy / 1024).ok) {
        c.queue('place', [unit, qx, qy]);
        later.splice(i, 1);
      }
    }
    // the host fires the hero's ult whenever it is ready (checked on her own view, like a player)
    if (frame % 30 === 0 && A.sim.hero && A.sim.heroUltStatus().ready && A.tick > lastUlt + 120) {
      lastUlt = A.tick;
      A.queue('ult');
      ults++;
    }
    frame++;
    clock.t += 1000 / 60;
    // deliver in (due frame, send order): deterministic on every engine
    const due = queue.filter((m) => m.at <= frame).sort((a, b) => a.at - b.at || a.seq - b.seq);
    for (const m of due) {
      queue.splice(queue.indexOf(m), 1);
      clients[m.to].receive(m.msg);
    }
    for (const c of clients) c.advance(1 / 60);
  }
  for (let f = 0; f < 30; f++) {
    frame++;
    clock.t += 1000 / 60;
    for (const m of queue.splice(0)) clients[m.to].receive(m.msg);
    for (const c of clients) c.advance(1 / 60);
  }
  const pairs = A.hashPairs();
  return {
    engine: typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : (typeof Bun !== 'undefined' ? `Bun ${Bun.version}` : `Node ${process.version}`),
    ticks: A.tick,
    state: A.sim.state,
    wave: A.sim.wave,
    towers: A.sim.towers.length,
    wallets: A.coop.wallets.join('/'),
    final: A.coop.hash(),
    finalB: B.coop.hash(),
    hashes: bitsHash(pairs.map((p) => Number.parseInt(p.mine, 16) || 0)),
    checkpoints: pairs.length,
    agree: pairs.every((p) => p.mine === p.theirs) && A.coop.hash() === B.coop.hash(),
    ults,
    failed: refused.length,
    refused: refused.join(' '),
    math: mathProbe(),
    // the co-op lobby's battle-data hash: the maps are built at load time, outside the battle, and
    // must hash the same on every engine or the lobby refuses to pair (Chrome + iPhone Safari did)
    lobby: coopVersion().data,
    ms: Date.now() - t0,
  };
}

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
import { createCoopSim, quantize, flyArgs } from '../../src/online/coop/commands.js';
import { withDetMath, DET_MATH } from '../../src/online/coop/detMath.js';
import { createRng } from '../../src/core/rng.js';
import { coopVersion } from '../../src/online/coop/version.js';
import { generateWave } from '../../src/sim/waves.js';
import { generateFreeplayWave, freeplayHpRamp, freeplayPressure, freeplaySpeed } from '../../src/sim/freeplay.js';
import { STAGES, CAMPAIGN_IDS } from '../../src/data/stages.js';
import { ENEMY_MAP } from '../../src/data/enemies.js';
import { coopStage } from '../../src/data/coop.js';
import { FREEPLAY_TIERS } from '../../src/data/freeplay.js';
import { snapshotDigest } from '../../src/sim/snapshot.js';

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

/**
 * Every stage's wave table (its co-op version, every wave, plus 30 endless waves of the solo
 * stage), FNV-1a over the JSON (which spells each double exactly): the battle above only plays
 * stage 1-3, but every stage's budgets and HP multipliers are whole powers (growth^wave) that
 * must come out bit-identical on every engine (src/sim/waves.js powInt).
 */
export function waveTables() {
  const look = (id) => ENEMY_MAP[id] || null;
  let h = 0x811c9dc5;
  let n = 0;
  const mix = (text) => {
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  };
  for (const st of STAGES) {
    const cs = coopStage(st.id);
    const waves = Number.isFinite(cs.waves) ? cs.waves : 30;
    for (let w = 1; w <= waves; w++, n++) mix(JSON.stringify(generateWave(cs, w, look, { pathCount: 2, pathLengths: [30, 40] })));
    if (Number.isFinite(st.waves)) for (let w = st.waves + 1; w <= st.waves + 30; w++, n++) mix(JSON.stringify(generateWave(st, w, look)));
  }
  return `${n}:${h.toString(16).padStart(8, '0')}`;
}

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
function spotsFor(start, units, per = 2) {
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
        if (out[u].length >= per) break;
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
    waves: waveTables(),
    ms: Date.now() - t0,
  };
}

// ---------------------------------------------------------------------------
// Co-op freeplay (waves past a stage's last wave, src/sim/freeplay.js)
// ---------------------------------------------------------------------------

/**
 * Freeplay wave tables of every campaign stage on every tier, FNV-1a over the JSON (groups, HP,
 * budget, boss content, pressure and every 16th spawn): every wave from the goal to goal + 20,
 * then waves ending in 0 (boss waves) and 7 up to 260, and 300 and 400 —
 * every HP band, the spawn-window packing, the boss ladder up to the Wyrm. Plus the HP ramp,
 * armor / Resolve and speed of every wave to 400 as raw bits. Paths of fractional lengths, three
 * of them, so the boss path pick and the round-robin are exercised.
 */
export function freeplayTables() {
  const look = (id) => ENEMY_MAP[id] || null;
  const opts = { pathCount: 3, pathLengths: [37.25, 41.125, 29.875] };
  let h = 0x811c9dc5;
  let n = 0;
  const mix = (text) => {
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  };
  const curve = [];
  for (const id of CAMPAIGN_IDS) {
    for (const tier of FREEPLAY_TIERS) {
      const st = coopStage(id, { freeplay: tier });
      const G = st.waves;
      for (let w = G + 1; w <= 400; w++) {
        const p = freeplayPressure(st, w);
        curve.push(freeplayHpRamp(st, w), freeplaySpeed(st, w), p.armor, p.cc, p.kb);
        if (w <= G + 20 || (w <= 260 && (w % 10 === 0 || w % 10 === 7)) || w === 300 || w === 400) {
          // the whole wave but every 16th spawn (late waves hold thousands; each spawn's time is
          // one multiply-add of its group's start and spacing, which are hashed in full)
          const { spawns, ...rest } = generateFreeplayWave(st, w, look, opts);
          mix(JSON.stringify(rest));
          mix(JSON.stringify(spawns.filter((_, i) => i % 16 === 0 || i === spawns.length - 1)));
          mix(String(spawns.length));
          n++;
        }
      }
    }
  }
  return `${n}:${h.toString(16).padStart(8, '0')}:${bitsHash(curve)}`;
}

export const FREEPLAY_START = Object.freeze({
  seed: 909090,
  stageId: '1-3',
  difficulty: 'normal',
  freeplay: 'crimson',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'aoi', stats: { costMul: 0.2, damageMul: 9, rateMul: 1.4 } }, { unitId: 'kage', stats: { costMul: 0.2, damageMul: 9, rateMul: 1.4 } }], hero: { unitId: 'hikari', stats: { costMul: 0.2, damageMul: 9 } } },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'rei', stats: { costMul: 0.2, damageMul: 9, rateMul: 1.4 } }, { unitId: 'yuki', stats: { costMul: 0.2, damageMul: 9, rateMul: 1.4 } }], hero: null },
  ],
});

/**
 * A whole co-op FREEPLAY battle (Crimson Moon on 1-3): two Lockstep clients over the same seeded
 * fake network as runScriptedBattle, girls placed and upgraded as coins allow, Auto on at 3×,
 * through the goal (15/15) and past it into the boss waves; once wave `finishAfter` is cleared both
 * players vote Finish ('end'), which must end the run on the same tick on both clients. Every state
 * hash either client computed is collected, so the whole run is compared, not only the last 64.
 * The checkpoint check: the host's wave-end checkpoint after wave `checkpointAt` (the snapshot a
 * resync or rejoin would carry) is kept as JSON; after the run a fresh client restores it and
 * replays the host's commands since, to the last tick — the same battle as the one that ran on,
 * and the same checkpoint JSON in every engine (so one engine's checkpoint restores in another).
 */
export function runFreeplayBattle({ finishAfter = 52, checkpointAt = 40, maxFrames = 60 * 60 * 40 } = {}) {
  const t0 = Date.now();
  const rng = createRng(11);
  const clock = { t: 0 };
  const queue = [];
  let frame = 0;
  const mk = (slot) => new Lockstep({
    start: FREEPLAY_START,
    mySlot: slot,
    now: () => clock.t,
    send: (msg) => queue.push({ at: frame + Math.floor(rng.next() * 10), seq: queue.length, to: 1 - slot, msg: JSON.parse(JSON.stringify(msg)) }),
  });
  const [A, B] = [mk(0), mk(1)];
  const clients = [A, B];
  const units = { 0: ['aoi', 'kage', 'hikari'], 1: ['rei', 'yuki'] };
  const spots = spotsFor(FREEPLAY_START, ['kage', 'yuki', 'aoi', 'rei', 'hikari'], 4);
  const want = [];
  for (const slot of [0, 1]) for (const u of units[slot]) for (const q of spots[u] || []) want.push([slot, u, q]);
  const seen = [new Map(), new Map()];
  const bosses = new Set();
  let voted = false;
  let goalTick = -1;
  let endTick = [-1, -1];
  let ck = null; // { json, t, wave }
  while (frame < maxFrames && !(A.finished && B.finished)) {
    if (frame === 20) A.queue('auto', [true]);
    if (frame === 21) B.queue('speed', [3]);
    if (frame === 22) A.queue('wave');
    // each player places her girls as soon as her own wallet allows, then upgrades them in turn
    if (frame % 15 === 0) {
      for (let i = want.length - 1; i >= 0; i--) {
        const [slot, u, [qx, qy]] = want[i];
        const c = clients[slot];
        if (c.sim.canPlace(u, qx / 1024, qy / 1024).ok) {
          c.queue('place', [u, qx, qy]);
          want.splice(i, 1);
        }
      }
    }
    if (frame % 90 === 45) {
      for (const c of clients) {
        const own = c.sim.towers.filter((t) => c.coop.isMine(t.uid));
        for (const t of own) {
          const path = t.uid % 2;
          const st = c.sim.upgradeStatus(t.uid, path);
          if (!st.locked) {
            c.queue('upg', [t.uid, path]);
            break;
          }
        }
      }
    }
    if (frame % 30 === 0 && A.sim.hero && A.sim.heroUltStatus().ready) A.queue('ult');
    if (!voted && A.sim.wavesCleared >= finishAfter && B.sim.wavesCleared >= finishAfter) {
      voted = true;
      A.queue('end', [true]);
      B.queue('end', [true]);
    }
    frame++;
    clock.t += 1000 / 60;
    const due = queue.filter((m) => m.at <= frame).sort((a, b) => a.at - b.at || a.seq - b.seq);
    for (const m of due) {
      queue.splice(queue.indexOf(m), 1);
      clients[m.to].receive(m.msg);
    }
    clients.forEach((c, i) => {
      const was = c.sim.state;
      c.advance(1 / 60);
      for (const [t, hv] of c.hashes) seen[i].set(t, hv);
      if (i === 0) {
        for (const ev of c.sim.events) if (ev.type === 'goal' && goalTick < 0) goalTick = c.tick;
        const b = c.sim.freeplayInfo(c.sim.wave);
        if (b?.boss && c.sim.wave > c.sim.totalWaves) bosses.add(`${c.sim.wave}:${b.boss.kind}`);
      }
      if (was !== 'won' && c.sim.state === 'won') endTick[i] = c.tick;
    });
    for (const c of clients) c.sim.events.length = 0;
    if (!ck && A.ck && A.ck.wave >= checkpointAt) ck = { json: JSON.stringify(A.ck.snap), t: A.ck.t, wave: A.ck.wave };
  }
  for (let f = 0; f < 30; f++) {
    frame++;
    clock.t += 1000 / 60;
    for (const m of queue.splice(0)) clients[m.to].receive(m.msg);
    for (const c of clients) c.advance(1 / 60);
  }
  // restore the checkpoint into a fresh client, replay the host's log since it to the last tick
  const tc = Date.now();
  const copy = new Lockstep({ start: FREEPLAY_START, mySlot: 1, send: () => {}, now: () => 0 });
  copy.rebuild(FREEPLAY_START, A.log, A.tick, ck ? { t: ck.t, snap: JSON.parse(ck.json) } : null);
  const ckReplayMs = Date.now() - tc;
  const finalDigest = snapshotDigest(A.coop.snapshot());
  const ticks = [...seen[0].keys()].filter((t) => seen[1].has(t)).sort((a, b) => a - b);
  return {
    ticks: A.tick,
    state: A.sim.state,
    stateB: B.sim.state,
    finished: A.sim.finished && B.sim.finished,
    wave: A.sim.wave,
    cleared: A.sim.wavesCleared,
    goal: A.sim.totalWaves,
    goalTick,
    endTicks: endTick.join('/'),
    towers: A.sim.towers.length,
    wallets: A.coop.wallets.join('/'),
    lives: A.sim.lives,
    bosses: bosses.size,
    final: A.coop.hash(),
    finalB: B.coop.hash(),
    hashes: bitsHash(ticks.map((t) => seen[0].get(t))),
    checkpoints: ticks.length,
    agree: ticks.every((t) => seen[0].get(t) === seen[1].get(t)) && A.coop.hash() === B.coop.hash(),
    // the checkpoint: its wave and tick, its JSON's digest and size, the replay from it
    ckWave: ck?.wave ?? -1,
    ckTick: ck?.t ?? -1,
    ckDigest: ck ? snapshotDigest(ck.json) : 'none',
    ckKb: ck ? Math.round(ck.json.length / 1024) : 0,
    ckReplay: copy.lastRebuild ? `${copy.lastRebuild.from}+${copy.lastRebuild.ticks}` : 'none',
    ckSame: !!ck && copy.lastRebuild?.restored === true && copy.tick === A.tick && copy.coop.hash() === A.coop.hash() && snapshotDigest(copy.coop.snapshot()) === finalDigest,
    finalDigest,
    ckReplayMs,
    ms: Date.now() - t0,
  };
}

// ---------------------------------------------------------------------------
// Roaming drones and flight modes (Chika: docs/specs/CHIKA_REWORK.md §16)
// ---------------------------------------------------------------------------

const DRONE_STATS = { costMul: 0.15, damageMul: 4, rateMul: 1.3 };
export const DRONES_START = Object.freeze({
  seed: 616161,
  stageId: '6-5',
  difficulty: 'easy',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'chika', stats: DRONE_STATS }, { unitId: 'aoi', stats: DRONE_STATS }], hero: null },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'chika', stats: { ...DRONE_STATS, rangeMul: 1.1 } }, { unitId: 'yuki', stats: DRONE_STATS }], hero: null },
  ],
});

/**
 * A whole co-op battle with roaming drones on a sapper stage (6-5): the host flies a Chika toward
 * 5-0-2 through every flight mode (Hover → Hold → Patrol → Pursuit, points around her) while
 * cycling all five target modes; the guest's Chika goes 0-0-5 (Tesla) on Strong in Pursuit. Two
 * Lockstep clients over the same seeded fake network; every state hash is collected (they fold
 * every drone's position and the wing's flight mode). The host's checkpoint after wave
 * `checkpointAt` (drones mid-flight, maybe jammed) is restored into a fresh client and replayed.
 */
export function runDronesBattle({ checkpointAt = 8, maxFrames = 60 * 60 * 14 } = {}) {
  const t0 = Date.now();
  const rng = createRng(17);
  const clock = { t: 0 };
  const queue = [];
  let frame = 0;
  const refused = [];
  const mk = (slot) => new Lockstep({
    start: DRONES_START,
    mySlot: slot,
    now: () => clock.t,
    hooks: { onApplied: (c, r) => { if (!r.ok && c.k === 'fly') refused.push(`${c.k}@${c.t}:${r.reason}`); } },
    send: (msg) => queue.push({ at: frame + Math.floor(rng.next() * 10), seq: queue.length, to: 1 - slot, msg: JSON.parse(JSON.stringify(msg)) }),
  });
  const [A, B] = [mk(0), mk(1)];
  const clients = [A, B];
  const spots = spotsFor(DRONES_START, ['chika', 'aoi', 'yuki'], 2);
  const want = [[0, 'chika', spots.chika[0]], [1, 'chika', spots.chika[1]], [0, 'aoi', spots.aoi[0]], [1, 'yuki', spots.yuki[0]]];
  // upgrade orders: the host's Chika 5-0-2, the guest's 0-0-5 (+2 sentry), the others path 0
  const ORDER = { 0: [0, 0, 0, 0, 0, 2, 2], 1: [2, 2, 2, 2, 2, 0, 0] };
  const MODES = ['first', 'strong', 'last', 'close', 'elite'];
  const FLY = ['hold', 'patrol', 'pursuit', 'hover'];
  const seen = [new Map(), new Map()];
  let ck = null;
  let jams = 0;
  let flies = 0;
  const chikaOf = (c) => c.sim.towers.find((t) => t.unitId === 'chika' && c.coop.isMine(t.uid));
  while (frame < maxFrames && !(A.finished && B.finished)) {
    if (frame === 20) A.queue('auto', [true]);
    if (frame === 21) B.queue('speed', [3]);
    if (frame === 22) A.queue('wave');
    if (frame % 15 === 0) {
      for (let i = want.length - 1; i >= 0; i--) {
        const [slot, u, [qx, qy]] = want[i];
        const c = clients[slot];
        if (c.sim.canPlace(u, qx / 1024, qy / 1024).ok) {
          c.queue('place', [u, qx, qy]);
          want.splice(i, 1);
        }
      }
    }
    if (frame % 90 === 45) {
      clients.forEach((c, slot) => {
        for (const t of c.sim.towers.filter((x) => c.coop.isMine(x.uid))) {
          const order = t.unitId === 'chika' ? ORDER[slot] : [0, 0, 0];
          const done = t.tiers.reduce((a, b) => a + b, 0);
          const path = order[done];
          if (path == null || c.sim.upgradeStatus(t.uid, path).locked) continue;
          c.queue('upg', [t.uid, path]);
          break;
        }
      });
    }
    // the host's Chika: a new target mode every 1100 frames, a new flight mode every 1500
    const ha = chikaOf(A);
    if (ha && frame % 1100 === 600) A.queue('tgt', [ha.uid, MODES[Math.floor(frame / 1100) % MODES.length]]);
    if (ha && frame % 1500 === 900) {
      const mode = FLY[Math.floor(frame / 1500) % FLY.length];
      A.queue('fly', flyArgs(ha.uid, mode, [ha.x + 2.75, ha.y - 1.5], [ha.x - 3.5, ha.y + 2.25]));
      flies++;
    }
    const gb = chikaOf(B);
    if (gb && frame === 2400) {
      B.queue('tgt', [gb.uid, 'strong']);
      B.queue('fly', flyArgs(gb.uid, 'pursuit'));
      flies++;
    }
    frame++;
    clock.t += 1000 / 60;
    const due = queue.filter((m) => m.at <= frame).sort((a, b) => a.at - b.at || a.seq - b.seq);
    for (const m of due) {
      queue.splice(queue.indexOf(m), 1);
      clients[m.to].receive(m.msg);
    }
    clients.forEach((c, i) => {
      c.advance(1 / 60);
      for (const [t, hv] of c.hashes) seen[i].set(t, hv);
      if (i === 0) for (const ev of c.sim.events) if (ev.type === 'sabotage' && ev.turretUid != null) jams++;
    });
    for (const c of clients) c.sim.events.length = 0;
    if (!ck && A.ck && A.ck.wave >= checkpointAt) ck = { json: JSON.stringify(A.ck.snap), t: A.ck.t, wave: A.ck.wave };
  }
  for (let f = 0; f < 30; f++) {
    frame++;
    clock.t += 1000 / 60;
    for (const m of queue.splice(0)) clients[m.to].receive(m.msg);
    for (const c of clients) c.advance(1 / 60);
  }
  const copy = new Lockstep({ start: DRONES_START, mySlot: 1, send: () => {}, now: () => 0 });
  copy.rebuild(DRONES_START, A.log, A.tick, ck ? { t: ck.t, snap: JSON.parse(ck.json) } : null);
  const finalDigest = snapshotDigest(A.coop.snapshot());
  const ticks = [...seen[0].keys()].filter((t) => seen[1].has(t)).sort((a, b) => a - b);
  const chikas = A.sim.towers.filter((t) => t.unitId === 'chika');
  return {
    ticks: A.tick,
    state: A.sim.state,
    wave: A.sim.wave,
    towers: A.sim.towers.length,
    drones: chikas.reduce((a, t) => a + t.turrets.length, 0),
    droneDmg: Math.round(chikas.reduce((a, t) => a + t.droneDmg, 0)),
    droneShots: chikas.reduce((a, t) => a + t.droneShots, 0),
    tiers: chikas.map((t) => t.tiers.join('-')).join(' '),
    flies,
    refused: refused.join(' '),
    jams,
    wallets: A.coop.wallets.join('/'),
    lives: A.sim.lives,
    final: A.coop.hash(),
    finalB: B.coop.hash(),
    hashes: bitsHash(ticks.map((t) => seen[0].get(t))),
    checkpoints: ticks.length,
    agree: ticks.every((t) => seen[0].get(t) === seen[1].get(t)) && A.coop.hash() === B.coop.hash(),
    ckWave: ck?.wave ?? -1,
    ckDigest: ck ? snapshotDigest(ck.json) : 'none',
    ckSame: !!ck && copy.lastRebuild?.restored === true && copy.tick === A.tick && copy.coop.hash() === A.coop.hash() && snapshotDigest(copy.coop.snapshot()) === finalDigest,
    finalDigest,
    ms: Date.now() - t0,
  };
}

/** Everything e2e/engines.mjs compares between engines: the campaign co-op battle, freeplay and drones. */
export function runEngineChecks() {
  const r = runScriptedBattle();
  const t0 = Date.now();
  const tables = freeplayTables();
  const battle = runFreeplayBattle();
  const freeplayMs = Date.now() - t0;
  return { ...r, freeplay: { tables, battle, ms: freeplayMs }, drones: runDronesBattle() };
}

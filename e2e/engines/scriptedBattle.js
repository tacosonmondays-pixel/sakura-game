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
import { generateWave } from '../../src/sim/waves.js';
import { generateFreeplayWave, freeplayHpRamp, freeplayPressure, freeplaySpeed } from '../../src/sim/freeplay.js';
import { STAGES, CAMPAIGN_IDS } from '../../src/data/stages.js';
import { ENEMY_MAP } from '../../src/data/enemies.js';
import { coopStage } from '../../src/data/coop.js';
import { FREEPLAY_TIERS } from '../../src/data/freeplay.js';
import { snapshotDigest } from '../../src/sim/snapshot.js';
import { Sim } from '../../src/sim/Sim.js';
import { autoPlan } from '../../src/sim/headless.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { stageRule } from '../../src/data/rules.js';

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

/**
 * Deep freeplay, far past what the scripted run reaches: a co-op battle on 8-5 (Blossom) jumped to
 * wave 250 with a fixed test-stat board (both players' girls placed by headless.autoPlan, upgraded
 * a few rounds), run with Auto on at 3× into the Eclipse Wyrm + Gloom Regent wave (250) for
 * `ticks` ticks. Every 60 ticks the raw bits of every enemy's HP, position, armor, barrier, Resolve
 * budgets and speed are hashed, plus the wallets. Also counts non-finite values and the largest HP
 * (must stay below 2^53, where doubles stop being exact integers).
 */
export function runDeepFreeplay({ stageId = '8-5', tier = 'blossom', fromWave = 250, ticks = 3600 } = {}) {
  const t0 = Date.now();
  const P1 = ['kage', 'shiro', 'aoi', 'akane', 'miko', 'yuki'];
  const P2 = ['momo', 'sango', 'umeko', 'midori', 'hotaru', 'rei'];
  const stats = { damageMul: 3000, costMul: 0.001, rangeMul: 1.2, rateMul: 1.5 };
  const start = {
    seed: 777, stageId, difficulty: 'normal', freeplay: tier,
    players: [
      { slot: 0, uid: 'a', name: 'A', loadout: P1.map((unitId) => ({ unitId, stats })), hero: { unitId: 'hikari', stats } },
      { slot: 1, uid: 'b', name: 'B', loadout: P2.map((unitId) => ({ unitId, stats })), hero: null },
    ],
  };
  const c = createCoopSim(start);
  const sim = c.sim;
  const plan = withDetMath(() => autoPlan(stageId, [...P1, ...P2, 'hikari'], { data: { stage: coopStage(stageId, { freeplay: tier }) }, maxCopies: 3 }));
  let s = 0;
  const cmd = (p, k, a) => c.apply({ t: 0, p, s: s++, k, a });
  for (const a of plan) {
    if (a.action !== 'place') continue;
    cmd(P2.includes(a.unitId) ? 1 : 0, 'place', [a.unitId, ...quantize(a.x ?? a.tx, a.y ?? a.ty)]);
  }
  for (let round = 0; round < 8; round++) {
    for (const tw of sim.towers) {
      const p = c.ownerOf(tw.uid);
      if (p != null) cmd(p, 'upg', [tw.uid, round < 5 ? 0 : 1]);
    }
  }
  sim.wave = fromWave - 1;
  sim.wavesCleared = fromWave - 1;
  sim.lives = 1e9;
  sim.maxLives = 1e9;
  cmd(0, 'speed', [3]);
  cmd(0, 'auto', [true]);
  cmd(0, 'wave', []);
  const vals = [];
  const bosses = new Set();
  let bad = 0;
  let maxHp = 0;
  let maxAlive = 0;
  for (let n = 1; n <= ticks && sim.state !== 'won' && sim.state !== 'lost'; n++) {
    c.step();
    sim.events.length = 0;
    maxAlive = Math.max(maxAlive, sim.enemies.length);
    if (n % 60 !== 0) continue;
    vals.push(n, sim.wave, sim.lives, sim.enemies.length, ...c.wallets);
    for (const e of sim.enemies) {
      if (![e.hp, e.maxHp, e.x, e.y, e.armor, e.barrier ?? 0, e.speed].every(Number.isFinite)) bad++;
      if (e.tier === 'boss' || e.tier === 'miniboss') bosses.add(e.id);
      maxHp = Math.max(maxHp, e.maxHp);
      vals.push(e.uid, e.hp, e.x, e.y, e.armor, e.barrier ?? -1, e.ccLeft ?? -1, e.kbLeft ?? -1, e.speed);
    }
  }
  return {
    stageId, tier, fromWave, towers: sim.towers.length, wave: sim.wave, cleared: sim.wavesCleared, lives: sim.lives,
    maxAlive, maxHp, bad, bosses: [...bosses].sort().join(','), digest: bitsHash(vals), final: c.hash(), ms: Date.now() - t0,
  };
}

// ---------------------------------------------------------------------------
// Battle modes and map rules (docs/specs/CODEX_MODES.md §6.5, §10 "Engines")
// ---------------------------------------------------------------------------

const MODE_UNITS = ['aoi', 'rei', 'yuki', 'kage', 'akane', 'chika', 'hikari'];

/**
 * The MODES_* scenarios: every mode and every rule effect key (vents, pads with a sale of the pad
 * owner, rifts, affinity, ambush in both modes, range, speed, bonusEvery, the Petal Sanctuary heal
 * path) and an endless run past the goal. [name, stage, difficulty, mode, extra]
 */
export const MODES_SCENARIOS = Object.freeze([
  ['MODES_VENTS_IRONCLAD', '6-3', 'normal', 'ironclad'],
  ['MODES_AMBUSH', '4-2', 'hard', 'standard'],
  ['MODES_AMBUSH_REVERSE', '4-2', 'hard', 'reverse'],
  ['MODES_PADS_SALE', '6-1', 'hard', 'standard', { padSale: true }],
  ['MODES_RIFTS_RUSH', '8-4', 'normal', 'rush'],
  ['MODES_BLIZZARD_FRUGAL', '4-1', 'normal', 'frugal'],
  ['MODES_MIRAGE', '6-2', 'hard', 'standard'],
  ['MODES_SUPPLY', '2-4', 'normal', 'standard'],
  ['MODES_ENCORE', '7-1', 'normal', 'standard'],
  ['MODES_PETAL_HEAL', '1-4', 'hard', 'standard', { weak: true }],
  ['MODES_TIDES_RUSH', '2-1', 'hard', 'rush'],
  ['MODES_ECLIPSE_IRONCLAD', '3-3', 'normal', 'ironclad'],
  ['MODES_MIST_FRUGAL', '5-1', 'normal', 'frugal'],
  ['MODES_TAILWIND_REVERSE', '8-1', 'normal', 'reverse'],
  ['MODES_ENDLESS_PAST_GOAL', '1-4', 'easy', 'standard', { endless: true, waves: 31 }],
]);

/** One MODES_* battle (inside withDetMath): state hash every 600 steps and the final snapshot digest. */
export function runModeBattle([name, stageId, difficulty, mode, extra = {}]) {
  return withDetMath(() => {
    const units = extra.weak ? ['aoi'] : MODE_UNITS;
    const sim = new Sim({
      stageId, difficulty, seed: 31, loadout: units.filter((u) => u !== 'hikari').map((unitId) => ({ unitId })),
      hero: units.includes('hikari') ? { unitId: 'hikari' } : null, options: { mode, endless: !!extra.endless },
    });
    let plan = autoPlan(stageId, units).filter((a) => a.action === 'place' || a.action === 'upgrade');
    if (extra.weak) plan = plan.slice(0, 2);
    if (extra.padSale) {
      const p = stageRule(stageId).pads[0];
      plan = [{ action: 'place', unitId: 'rei', x: p.x, y: p.y, at: 1 }, { action: 'place', unitId: 'aoi', x: p.x + 0.85, y: p.y, at: 1 }, ...plan];
      plan.splice(6, 0, { action: 'sell', x: p.x, y: p.y, at: 4 });
    }
    const hashes = [];
    let steps = 0;
    const kinds = new Set();
    while (sim.state !== 'won' && sim.state !== 'lost' && steps < 60 * 60 * 40 && !(extra.waves && sim.wave > extra.waves)) {
      while (plan.length && (plan[0].at ?? 1) <= sim.wave + 1) {
        const a = plan[0];
        if (a.action === 'place') {
          const c = sim.canPlace(a.unitId, a.x, a.y);
          if (!c.ok && c.reason === 'cash') break;
          if (c.ok) sim.placeTower(a.unitId, a.x, a.y);
        } else if (a.action === 'upgrade') {
          const t = sim.towerAt(a.x, a.y);
          const st = t && sim.upgradeStatus(t.uid, a.path ?? 0);
          if (st && st.reason === 'cash') break;
          if (st && !st.locked) sim.upgradeTower(t.uid, a.path ?? 0);
        } else if (a.action === 'sell') {
          const t = sim.towerAt(a.x, a.y);
          if (t) sim.sellTower(t.uid);
        }
        plan.shift();
      }
      if (sim.state === 'prep' || sim.state === 'between') sim.startNextWave();
      if (sim.hero && sim.heroUltStatus().ready) sim.activateUlt();
      sim.update(1 / 60);
      steps++;
      for (const e of sim.drainEvents()) if (e.type === 'ruleState' || e.type === 'ruleBonus' || e.type === 'rift' || (e.type === 'cash' && e.reason === 'rule')) kinds.add(e.type === 'cash' ? 'ruleCash' : e.type);
      if (steps % 600 === 0) hashes.push(hashSim(sim, { tick: steps }));
    }
    return {
      name, state: sim.state, wave: sim.wave, lives: sim.lives, cash: sim.cash, steps,
      hashes: bitsHash(hashes), checkpoints: hashes.length, final: snapshotDigest(sim.snapshot()),
      events: [...kinds].sort().join(','),
    };
  });
}

export function runModeBattles() {
  const t0 = Date.now();
  const battles = MODES_SCENARIOS.map(runModeBattle);
  return { battles, digest: bitsHash(battles.flatMap((b) => [Number.parseInt(b.final, 16) || 0, b.hashes.length ? Number.parseInt(String(b.hashes).slice(0, 8), 16) || 0 : 0, b.steps])), ms: Date.now() - t0 };
}

/** Everything e2e/engines.mjs compares between engines: the campaign co-op battle, freeplay (scripted and deep) and the mode battles. */
export function runEngineChecks() {
  const r = runScriptedBattle();
  const t0 = Date.now();
  const tables = freeplayTables();
  const battle = runFreeplayBattle();
  const deep = runDeepFreeplay();
  const modes = runModeBattles();
  return { ...r, freeplay: { tables, battle, deep, ms: Date.now() - t0 }, modes };
}

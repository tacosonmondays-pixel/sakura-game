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
import { runCoop as runTryoutCoop, coopStart as tryoutStart } from '../../tools/tryoutBot.mjs';
import { Lockstep } from '../../src/online/coop/lockstep.js';
import { createCoopSim, quantize, flyArgs, abilArgs } from '../../src/online/coop/commands.js';
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
import { abilityPathOf } from '../../src/sim/abilities.js';
import { LAB_CLASSES } from '../../src/sim/lab.js';
import { pointAt } from '../../src/sim/path.js';

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
function spotsFor(start, units, per = 2, { water = false } = {}) {
  return withDetMath(() => {
    const c = createCoopSim(start);
    const cands = [];
    for (let y = 0.55; y < c.sim.map.height; y += 0.35) {
      for (let x = 0.55; x < c.sim.map.width; x += 0.35) {
        const r = c.sim.placementReason(units[0], x, y);
        // water: only spots a land girl may not take (an amphibious girl, Nami or Sango since v0.1.40,
        // would otherwise pick the land spots another call already handed out)
        if (!r && (!water || c.sim.placementReason('aoi', x, y) === 'needsLand')) cands.push([x, y, c.sim.placement.pathDistance(x, y)]);
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
// Two heroes (hero rework): both players bring Hikari
// ---------------------------------------------------------------------------

const HERO_STATS = { costMul: 0.6 };
export const HERO2_START = Object.freeze({
  seed: 313131,
  stageId: '2-5',
  difficulty: 'normal',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'aoi', stats: HERO_STATS }, { unitId: 'kage', stats: HERO_STATS }], hero: { unitId: 'hikari', stats: HERO_STATS } },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'rei', stats: HERO_STATS }, { unitId: 'yuki', stats: HERO_STATS }], hero: { unitId: 'hikari', stats: { ...HERO_STATS, damageMul: 1.1 } } },
  ],
});

/**
 * A co-op battle where both players bring a hero (the same one): auto-start on, each player buys
 * her hero's levels with the level and price she saw 270 ticks (4.5 s) earlier (so some buys come
 * back 'stale'), moves her hero once before the first wave and repeatedly during waves, fires her
 * ult when it is ready, upgrades her girls and tries to sell her hero (refused). To wave `toWave`.
 */
export function runHeroBattle({ toWave = 16, maxFrames = 60 * 60 * 20 } = {}) {
  const t0 = Date.now();
  const rng = createRng(23);
  const clock = { t: 0 };
  const queue = [];
  let frame = 0;
  const counts = { hlv: 0, bought: 0, stale: 0, cash: 0, other: 0, hmv: 0, moved: 0, ult: 0, sell: '' };
  const mk = (slot) => new Lockstep({
    start: HERO2_START,
    mySlot: slot,
    now: () => clock.t,
    hooks: {
      onApplied: (c, r) => {
        if (slot !== 0) return;
        if (c.k === 'hlv') {
          counts.hlv++;
          if (r.ok) counts.bought++;
          else if (r.reason === 'stale' || r.reason === 'cash') counts[r.reason]++;
          else counts.other++;
        } else if (c.k === 'hmv') {
          counts.hmv++;
          if (r.ok) counts.moved++;
        } else if (c.k === 'sell') counts.sell = r.ok ? 'sold' : r.reason;
      },
    },
    send: (msg) => queue.push({ at: frame + Math.floor(rng.next() * 10), seq: queue.length, to: 1 - slot, msg: JSON.parse(JSON.stringify(msg)) }),
  });
  const [A, B] = [mk(0), mk(1)];
  const clients = [A, B];
  const spots = spotsFor(HERO2_START, ['hikari', 'aoi', 'kage', 'rei', 'yuki'], 4);
  const heroSpots = [[spots.hikari[0], spots.hikari[2]], [spots.hikari[1], spots.hikari[3]]];
  const want = [[0, 'aoi', spots.aoi[0]], [0, 'kage', spots.kage[0]], [1, 'rei', spots.rei[0]], [1, 'yuki', spots.yuki[0]], [0, 'aoi', spots.aoi[1]], [1, 'rei', spots.rei[1]]];
  const seenAt = [[], []]; // [frame, level, price] each player saw, queued 270 frames later
  const moveTurn = [0, 0];
  while (frame < maxFrames && !(A.finished && B.finished) && Math.min(A.sim.wavesCleared, B.sim.wavesCleared) < toWave) {
    if (frame === 4) A.queue('place', ['hikari', ...heroSpots[0][0]]);
    if (frame === 5) B.queue('place', ['hikari', ...heroSpots[1][0]]);
    if (frame === 30) B.queue('hmv', heroSpots[1][1]); // a move in prep: free and instant
    if (frame === 40) A.queue('auto', [true]);
    if (frame === 41) B.queue('speed', [3]);
    if (frame === 42) A.queue('wave');
    if (frame === 600) A.queue('sell', [A.sim.hero?.uid ?? -1]); // refused: heroes cannot be sold
    if (frame % 20 === 0) {
      for (let i = want.length - 1; i >= 0; i--) {
        const [slot, u, [qx, qy]] = want[i];
        const c = clients[slot];
        if (c.sim.canPlace(u, qx / 1024, qy / 1024).ok) {
          c.queue('place', [u, qx, qy]);
          want.splice(i, 1);
        }
      }
    }
    clients.forEach((c, i) => {
      if (frame % 150 === 75 + i * 10) {
        const st = c.sim.heroLevelStatus();
        if (!st.reason || st.reason === 'cash') seenAt[i].push([frame + 270, st.level + 1, st.price]);
      }
      while (seenAt[i].length && seenAt[i][0][0] <= frame) {
        const [, level, price] = seenAt[i].shift();
        c.queue('hlv', [level, price]);
      }
      if (frame % 30 === 15 + i && c.sim.hero && c.sim.heroUltStatus().ready) {
        c.queue('ult');
        counts.ult++;
      }
      if (frame % 700 === 350 + i * 40 && c.sim.hero && c.sim.state === 'wave') {
        moveTurn[i] ^= 1;
        c.queue('hmv', heroSpots[i][moveTurn[i]]);
      }
      if (frame % 240 === 120 + i * 7) {
        const own = c.sim.towers.filter((t) => c.coop.isMine(t.uid) && !t.isHero);
        for (const t of own) {
          const st = c.sim.upgradeStatus(t.uid, t.uid % 2);
          if (!st.locked) {
            c.queue('upg', [t.uid, t.uid % 2]);
            break;
          }
        }
      }
    });
    frame++;
    clock.t += 1000 / 60;
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
    ticks: A.tick,
    state: A.sim.state,
    wave: A.sim.wave,
    levels: A.sim.heroes.map((h) => h?.level ?? 0).join('/'),
    wallets: A.coop.wallets.join('/'),
    // the run stops mid-wave, so the two clients may sit a few ticks apart: they are compared at
    // every tick both hashed (the host's own final hash is what engines compare)
    final: A.coop.hash(),
    hashes: bitsHash(pairs.map((p) => Number.parseInt(p.mine, 16) || 0)),
    checkpoints: pairs.length,
    agree: pairs.length > 0 && pairs.every((p) => p.mine === p.theirs),
    buys: `${counts.hlv} hlv: ${counts.bought} bought, ${counts.stale} stale, ${counts.cash} cash, ${counts.other} other`,
    stale: counts.stale,
    bought: counts.bought,
    moves: `${counts.moved}/${counts.hmv}`,
    moved: counts.moved,
    ults: counts.ult,
    sell: counts.sell,
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

// ---------------------------------------------------------------------------
// Abilities (src/sim/abilities.js; ABILITIES_SPEC §7.4, BUILD_PLAN §4.5): every live kind in one battle
// ---------------------------------------------------------------------------

// cheap girls (every one reaches her ⚡ tier 3 early) at half damage (so crowds form and Auto's rules hold);
// the guest's also carry Skill Haste 0.3 (gear ultHaste: her abilities charge faster, a rounded division
// in chargeRate, and her hero's ult cooldown is shorter), so the haste path runs on every engine too
const ABIL_STATS = { costMul: 0.2, damageMul: 0.5 };
const ABIL_STATS_HASTE = { ...ABIL_STATS, ultHaste: 0.3 };
const abilLoadout = (ids, stats = ABIL_STATS) => ids.map((unitId) => ({ unitId, stats }));
/** The host fires her girls and Luna by hand; the guest plays on Auto-cast and taps her ready girls. */
export const ABILITIES_START = Object.freeze({
  seed: 454545,
  stageId: '4-5',
  difficulty: 'normal',
  players: [
    // (A5: Fuu joins as a sixth girl, so Backdraft Fan, the move kind's push, runs on every engine)
    { slot: 0, uid: 'host', name: 'Host', loadout: abilLoadout(['aoi', 'akane', 'momo', 'hotaru', 'midori', 'fuu']), hero: { unitId: 'luna', stats: ABIL_STATS } },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: abilLoadout(['yuki', 'rei', 'miko', 'sango', 'shiro'], ABIL_STATS_HASTE), hero: { unitId: 'nami', stats: ABIL_STATS_HASTE } },
  ],
});
/** Refusals a scripted tap may meet (the sim re-checks at the command's tick); anything else fails the run. */
const ABIL_REASONS = Object.freeze(['cooldown', 'notWave', 'active', 'noTarget', 'cap', 'disabled', 'moving']);

/**
 * A whole co-op battle with abilities (stage 4-5 Normal, to `toWave` waves cleared): the host takes
 * Aoi 0-3-0, Akane 3-0-0, Momo 3-0-0, Hotaru 0-3-0, Midori 3-0-0 and Fuu 3-0-0 (each to her ⚡ tier 3) and hero
 * Luna to Lv 7 (Moonbrand), and taps one of them by hand every 7 s in a round robin (some taps are
 * group taps, some carry an aim point, some land on a recharging girl and are refused); from wave 4
 * her Momo is on Auto. The guest takes Yuki, Rei, Miko 3-0-0, Sango 0-3-0, Shiro 3-0-0 and hero Nami
 * (Lv 7, Frost Net; she and Sango stand on the water), all with Skill Haste 0.3, with `acast[0, 1]` (everything on Auto), taps one
 * of her ready girls every 4 s as well, and switches Shiro off and on once. Two Lockstep clients over
 * the seeded fake network; every state hash collected (they fold the ability state once cast or on
 * Auto); the host's checkpoint after wave `checkpointAt` is restored into a fresh client and replayed.
 * `casts` / `kinds` count the `ability` events (both players' casts, auto and manual).
 */
export function runAbilitiesBattle({ toWave = 12, checkpointAt = 8, maxFrames = 60 * 60 * 20 } = {}) {
  const t0 = Date.now();
  const rng = createRng(29);
  const clock = { t: 0 };
  const queue = [];
  let frame = 0;
  const taps = { abil: 0, ok: 0, acast: 0, reasons: {} };
  const odd = [];
  const mk = (slot) => new Lockstep({
    start: ABILITIES_START,
    mySlot: slot,
    now: () => clock.t,
    hooks: {
      onApplied: (c, r) => {
        if (slot !== 0) return;
        if (c.k === 'abil') {
          taps.abil++;
          if (r.ok) taps.ok++;
          else {
            taps.reasons[r.reason] = (taps.reasons[r.reason] || 0) + 1;
            if (!ABIL_REASONS.includes(r.reason)) odd.push(`abil@${c.t}:${r.reason}`);
          }
        } else if (c.k === 'acast') {
          taps.acast++;
          if (!r.ok) odd.push(`acast@${c.t}:${r.reason}`);
        } else if (!r.ok && c.k !== 'hlv' && c.k !== 'upg' && !(c.k === 'place' && r.reason === 'cash')) odd.push(`${c.k}@${c.t}:${r.reason}`);
      },
    },
    send: (msg) => queue.push({ at: frame + Math.floor(rng.next() * 10), seq: queue.length, to: 1 - slot, msg: JSON.parse(JSON.stringify(msg)) }),
  });
  const [A, B] = [mk(0), mk(1)];
  const clients = [A, B];
  const girls = [['aoi', 'akane', 'momo', 'hotaru', 'midori', 'fuu'], ['yuki', 'rei', 'miko', 'sango', 'shiro']];
  // land spots (two each: the second when the first is taken); Nami and Sango stand on the water
  const spots = { ...spotsFor(ABILITIES_START, ['luna', ...girls[0], 'yuki', 'rei', 'miko', 'shiro'], 2), ...spotsFor(ABILITIES_START, ['nami', 'sango'], 2, { water: true }) };
  // [slot, unitId, spots, retry frame]: a place her view could afford can still meet a wallet that
  // changed by its tick (refused 'cash'): she is tried again until she stands
  const want = [];
  for (let i = 0; i < 6; i++) for (const slot of [0, 1]) if (girls[slot][i]) want.push([slot, girls[slot][i], spots[girls[slot][i]], 0]);
  const seen = [new Map(), new Map()];
  const byKind = {};
  const byOwner = [0, 0];
  let ck = null;
  let turn = 0;
  let guestTurn = 0;
  const toggles = { momo: false, off: false, on: false };
  const mine = (c) => c.sim.towers.filter((t) => c.coop.isMine(t.uid));
  while (frame < maxFrames && !(A.finished && B.finished) && Math.min(A.sim.wavesCleared, B.sim.wavesCleared) < toWave) {
    if (frame === 4) A.queue('place', ['luna', ...spots.luna[0]]);
    if (frame === 5) B.queue('place', ['nami', ...spots.nami[0]]);
    if (frame === 20) A.queue('auto', [true]);
    if (frame === 21) B.queue('acast', [0, 1]);
    if (frame === 24) A.queue('wave');
    if (frame % 15 === 0) {
      for (let i = want.length - 1; i >= 0; i--) if (mine(clients[want[i][0]]).some((t) => t.unitId === want[i][1])) want.splice(i, 1);
      for (const w of want) {
        const [slot, u, list, next] = w;
        const c = clients[slot];
        if (frame < next) break;
        const q = list.find(([qx, qy]) => !c.sim.placementReason(u, qx / 1024, qy / 1024));
        if (q && c.sim.canPlace(u, q[0] / 1024, q[1] / 1024).ok) {
          c.queue('place', [u, ...q]);
          w[3] = frame + 120;
          break;
        }
      }
    }
    clients.forEach((c, slot) => {
      // one ⚡-path tier at a time, each girl to tier 3
      if (frame % 60 === 30 + slot * 7) {
        for (const t of mine(c)) {
          if (t.isHero) continue;
          const path = abilityPathOf(t.def);
          if (t.tiers[path] >= 3 || c.sim.upgradeStatus(t.uid, path).locked) continue;
          c.queue('upg', [t.uid, path]);
          break;
        }
      }
      // her hero to Lv 8 (her skill at Lv 7)
      if (frame % 150 === 75 + slot * 10 && c.sim.hero && c.sim.hero.level < 8) {
        const st = c.sim.heroLevelStatus();
        if (!st.reason) c.queue('hlv', [st.level + 1, st.price]);
      }
    });
    // the host taps a girl every 7 s, round robin; some group taps, some aimed at the girl herself
    if (frame % 420 === 210 && A.sim.state === 'wave') {
      const casters = mine(A).filter((t) => t.abil).sort((p, q) => p.uid - q.uid);
      if (casters.length) {
        const t = casters[turn % casters.length];
        A.queue('abil', abilArgs(t.uid, { group: turn % 3 === 1, aim: turn % 4 === 2 ? [t.x, t.y] : null }));
        turn++;
      }
    }
    // the guest taps too, every 4 s, one of her girls her view shows ready (Auto waits for its own
    // moment; a tap fires whenever there is a target)
    if (frame % 240 === 120 && B.sim.state === 'wave') {
      const ready = mine(B).filter((t) => t.abil && !t.isHero && B.sim.abilityStatus(t.uid).ready).sort((p, q) => p.uid - q.uid);
      if (ready.length) B.queue('abil', abilArgs(ready[guestTurn++ % ready.length].uid));
    }
    // switches: from wave 4 the host's Momo on Auto; the guest's Shiro off after wave 5, on again after wave 7
    if (frame % 60 === 0) {
      const momo = mine(A).find((t) => t.unitId === 'momo' && t.abil);
      if (momo && !toggles.momo && A.sim.wavesCleared >= 4) {
        A.queue('acast', [momo.uid, 1]);
        toggles.momo = true;
      }
      const shiro = mine(B).find((t) => t.unitId === 'shiro' && t.abil);
      if (shiro && !toggles.off && B.sim.wavesCleared >= 5) {
        B.queue('acast', [shiro.uid, 0]);
        toggles.off = true;
      }
      if (shiro && toggles.off && !toggles.on && B.sim.wavesCleared >= 7) {
        B.queue('acast', [shiro.uid, 1]);
        toggles.on = true;
      }
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
      if (i === 0) {
        for (const ev of c.sim.events) {
          if (ev.type !== 'ability') continue;
          byKind[ev.kind] = (byKind[ev.kind] || 0) + 1;
          byOwner[ev.owner]++;
        }
      }
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
  const copy = new Lockstep({ start: ABILITIES_START, mySlot: 1, send: () => {}, now: () => 0 });
  copy.rebuild(ABILITIES_START, A.log, A.tick, ck ? { t: ck.t, snap: JSON.parse(ck.json) } : null);
  const finalDigest = snapshotDigest(A.coop.snapshot());
  const ticks = [...seen[0].keys()].filter((t) => seen[1].has(t)).sort((a, b) => a - b);
  const kinds = Object.keys(byKind).sort();
  const casts = kinds.reduce((a, k) => a + byKind[k], 0);
  return {
    ticks: A.tick,
    state: A.sim.state,
    wave: A.sim.wave,
    cleared: A.sim.wavesCleared,
    towers: A.sim.towers.map((t) => `${t.unitId}:${t.isHero ? `Lv${t.level}` : t.tiers.join('')}${t.abil ? `+${t.abil.n}` : ''}`).join(' '),
    casts,
    kinds: kinds.join(','),
    byKind: kinds.map((k) => `${k} ${byKind[k]}`).join(' · '),
    byOwner: byOwner.join('/'),
    taps: `${taps.abil} abil: ${taps.ok} cast, ${Object.keys(taps.reasons).sort().map((k) => `${taps.reasons[k]} ${k}`).join(', ')} · ${taps.acast} acast`,
    refused: odd.join(' '),
    wallets: A.coop.wallets.join('/'),
    lives: A.sim.lives,
    final: A.coop.hash(),
    hashes: bitsHash(ticks.map((t) => seen[0].get(t))),
    checkpoints: ticks.length,
    agree: ticks.length > 0 && ticks.every((t) => seen[0].get(t) === seen[1].get(t)),
    ckWave: ck?.wave ?? -1,
    ckDigest: ck ? snapshotDigest(ck.json) : 'none',
    ckSame: !!ck && copy.lastRebuild?.restored === true && copy.tick === A.tick && copy.coop.hash() === A.coop.hash() && snapshotDigest(copy.coop.snapshot()) === finalDigest,
    finalDigest,
    ms: Date.now() - t0,
  };
}

// ---------------------------------------------------------------------------
// Tenka (src/sim/lab.js, zones.js; BUILD_PLAN 6.1 T0–T3): her lab team in co-op, wells and Last Line, a
// second absorb mid-wave after a checkpoint, the economy weapon (owner decision #146) and a sale
// ---------------------------------------------------------------------------

// cheap Tenkas (both reach their tier 5 inside the run) and a cheap team, at half damage so the crowds
// reach her wells and the exit
const TENKA_STATS = Object.freeze({ costMul: 0.03, damageMul: 0.4 });
const TENKA_TEAM = Object.freeze({ costMul: 0.2, damageMul: 0.5 });
const tenkaLoadout = (ids) => ids.map((unitId) => ({ unitId, stats: unitId === 'tenka' ? TENKA_STATS : TENKA_TEAM }));
/**
 * The host (P1) brings Tenka for Joint Research and one girl of every lab class; the guest (P2) brings her
 * own Tenka for Singularity (wells, Last Line) and Rei, who stands in the host's Tenka's range and never joins.
 */
export const TENKA_START = Object.freeze({
  seed: 525252,
  stageId: '2-5',
  difficulty: 'normal',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: tenkaLoadout(['tenka', 'aoi', 'akane', 'yuki', 'miko', 'momo']), hero: null },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: tenkaLoadout(['tenka', 'rei', 'umeko']), hero: null },
  ],
});

/**
 * Legal spots for `units` around a centre (within `maxD` tiles of it, nearest first), ≥ 1.3 tiles from each
 * other and from `taken` (quantized; the det math), one each.
 */
function spotsAround(start, centre, units, maxD, taken) {
  return withDetMath(() => {
    const c = createCoopSim(start);
    const out = {};
    const cx = centre[0] / 1024;
    const cy = centre[1] / 1024;
    for (const u of units) {
      const cands = [];
      for (let y = 0.55; y < c.sim.map.height; y += 0.35) {
        for (let x = 0.55; x < c.sim.map.width; x += 0.35) {
          const q = quantize(x, y);
          const qx = q[0] / 1024;
          const qy = q[1] / 1024;
          const d2 = (qx - cx) * (qx - cx) + (qy - cy) * (qy - cy);
          if (d2 > maxD * maxD || taken.some(([tx, ty]) => (tx - qx) * (tx - qx) + (ty - qy) * (ty - qy) < 1.69)) continue;
          if (c.sim.placementReason(u, qx, qy)) continue;
          cands.push([d2, q]);
        }
      }
      cands.sort((a, b) => a[0] - b[0] || a[1][1] - b[1][1] || a[1][0] - b[1][0]);
      if (!cands.length) throw new Error(`[tenka battle] no spot for ${u} within ${maxD} of ${centre}`);
      out[u] = cands[0][1];
      taken.push([cands[0][1][0] / 1024, cands[0][1][1] / 1024]);
    }
    return out;
  });
}

/**
 * A whole co-op battle with Tenka (TENKA_START on 2-5 Normal, to `toWave` waves cleared). The host places her
 * Tenka by the road and Aoi (dps), Akane (frag) and Yuki (control) around her; the guest places Rei in her
 * range too, and her own Tenka down the road. The host buys Focus Lens, Long Rails and, once her three girls
 * stand, Joint Research (they join her lab team; Rei stays the guest's), then places Miko (support) and Momo
 * (economy, with Merch Table's interest) beside her and buys Grand Lab. The guest takes her Tenka through
 * Singularity to Last Line (wells open) and Rapid Cycle / Twin Rails. After the host's wave-`checkpointAt`
 * checkpoint, the host buys Unified Theory mid-wave (Miko and Momo join: every class has joined, and the
 * economy weapon pays her wallet), and `saleAfter` waves later sells her Tenka mid-wave (70% of her own coins;
 * the lab team does not come back), after which the crowds reach the exit and Last Line swallows them. Two
 * Lockstep clients over the seeded fake network; every state hash collected (they fold her lab, the zones and
 * the zone timers); the checkpoint restored into a fresh client and replayed through the second absorb and
 * the sale.
 */
export function runTenkaBattle({ toWave = 14, checkpointAt = 7, saleAfter = 2, maxFrames = 60 * 60 * 20 } = {}) {
  const t0 = Date.now();
  const rng = createRng(31);
  const clock = { t: 0 };
  const queue = [];
  let frame = 0;
  const odd = [];
  const absorbed = [];
  let sale = null;
  const mk = (slot) => new Lockstep({
    start: TENKA_START,
    mySlot: slot,
    now: () => clock.t,
    hooks: {
      onApplied: (c, r) => {
        if (slot !== 0) return;
        // who joined, in which wave and whether mid-wave (from the host's view, at the command's tick)
        const at = `w${A.sim.wave}${A.sim.state === 'wave' ? ' mid-wave' : ` ${A.sim.state}`}`;
        if (c.k === 'upg' && r.ok && r.absorbed) absorbed.push(`${c.p}:${r.absorbed.join(',')} (${at})`);
        if (c.k === 'sell') sale = r.ok ? `${r.refund} (${at})` : `refused ${r.reason}`;
        // placements and upgrades a wallet could not pay by their tick are tried again
        if (!r.ok && c.k !== 'upg' && !(c.k === 'place' && r.reason === 'cash')) odd.push(`${c.k}@${c.t}:${r.reason}`);
      },
    },
    send: (msg) => queue.push({ at: frame + Math.floor(rng.next() * 10), seq: queue.length, to: 1 - slot, msg: JSON.parse(JSON.stringify(msg)) }),
  });
  const [A, B] = [mk(0), mk(1)];
  const clients = [A, B];
  // her Tenka on the spot nearest the road with room for her six (inside 3.8 tiles: in her range of 4 from
  // Long Rails on); the guest's Tenka on the nearest road spot at least 5 tiles from hers
  const near = spotsFor(TENKA_START, ['tenka'], 40).tenka;
  let hostTenka = null;
  let guestTenka = null;
  let taken = null;
  let ring = null;
  for (const q of near) {
    const far = near.find(([qx, qy]) => (qx - q[0]) * (qx - q[0]) + (qy - q[1]) * (qy - q[1]) >= 25 * 1024 * 1024);
    if (!far) continue;
    const tk = [[q[0] / 1024, q[1] / 1024], [far[0] / 1024, far[1] / 1024]];
    try {
      ring = spotsAround(TENKA_START, q, ['aoi', 'akane', 'yuki', 'rei', 'miko', 'momo'], 3.8, tk);
    } catch {
      continue;
    }
    [hostTenka, guestTenka, taken] = [q, far, tk];
    break;
  }
  const umeko = spotsAround(TENKA_START, guestTenka, ['umeko'], 3, taken).umeko;
  // [slot, unitId, spot, retry frame]; the second wave of the host's girls waits for Joint Research
  const want = [[0, 'tenka', hostTenka, 0], [1, 'tenka', guestTenka, 0], [1, 'rei', ring.rei, 0], [0, 'aoi', ring.aoi, 0], [0, 'akane', ring.akane, 0], [0, 'yuki', ring.yuki, 0], [1, 'umeko', umeko, 0]];
  const later = [[0, 'miko', ring.miko, 0], [0, 'momo', ring.momo, 0]];
  const seen = [new Map(), new Map()];
  const count = { labJoin: 0, labFrag: 0, zoneOpen: 0, lastLine: 0, swallow: 0, labCash: 0 };
  const joins = [];
  let members = 'none'; // her lab's girls per class after the last absorb (labJoin), LAB_CLASSES order
  let ck = null;
  let unified = null; // the tick Unified Theory was queued at
  let utWave = 0; // the wave she bought it in
  let saleQueued = false;
  const mine = (c) => c.sim.towers.filter((t) => c.coop.isMine(t.uid));
  const tenkaOf = (c) => mine(c).find((t) => t.unitId === 'tenka');
  while (frame < maxFrames && !(A.finished && B.finished) && Math.min(A.sim.wavesCleared, B.sim.wavesCleared) < toWave) {
    if (frame === 20) A.queue('auto', [true]);
    if (frame === 24) A.queue('wave');
    if (frame % 15 === 0) {
      for (const list of [want, later]) for (let i = list.length - 1; i >= 0; i--) if (mine(clients[list[i][0]]).some((t) => t.unitId === list[i][1])) list.splice(i, 1);
      const hostTk = tenkaOf(A);
      if (hostTk?.lab && later.length) want.push(...later.splice(0));
      for (const w of want) {
        const [slot, u, [qx, qy], next] = w;
        const c = clients[slot];
        if (frame < next || !c.sim.canPlace(u, qx / 1024, qy / 1024).ok) continue;
        c.queue('place', [u, qx, qy]);
        w[3] = frame + 120;
        break;
      }
    }
    clients.forEach((c, slot) => {
      if (frame % 60 !== 30 + slot * 7) return;
      const t = tenkaOf(c);
      if (!t) return;
      let path = -1;
      if (slot === 1) {
        // the guest: Singularity to Last Line, then Rapid Cycle and Twin Rails; her Umeko's first tier
        path = t.tiers[2] < 5 ? 2 : t.tiers[1] < 2 ? 1 : -1;
        const um = mine(c).find((x) => x.unitId === 'umeko');
        if (path < 0 && um && um.tiers[0] < 1 && !c.sim.upgradeStatus(um.uid, 0).locked) c.queue('upg', [um.uid, 0]);
      } else {
        const team = mine(c).filter((x) => x.unitId !== 'tenka').map((x) => x.unitId);
        const momo = mine(c).find((x) => x.unitId === 'momo');
        if (t.tiers[0] < 2) path = 0;
        // Joint Research once Aoi, Akane and Yuki stand; Momo's Merch Table (interest), then Grand Lab
        else if (t.tiers[0] === 2 && ['aoi', 'akane', 'yuki'].every((u) => team.includes(u))) path = 0;
        else if (momo && momo.tiers[1] < 2) {
          if (!c.sim.upgradeStatus(momo.uid, 1).locked) c.queue('upg', [momo.uid, 1]);
        } else if (t.tiers[0] === 3 && team.includes('miko') && momo) path = 0;
      }
      if (path >= 0 && !c.sim.upgradeStatus(t.uid, path).locked) c.queue('upg', [t.uid, path]);
    });
    // after the checkpoint, Unified Theory mid-wave (8 s into a wave), tried until it is bought
    const ht = tenkaOf(A);
    if (ck && ht && ht.tiers[0] === 4 && A.sim.state === 'wave' && A.sim._waveTime > 8 && (unified == null || A.tick > unified + 120)
      && !A.sim.upgradeStatus(ht.uid, 0).locked) {
      A.queue('upg', [ht.uid, 0]);
      unified = A.tick;
    }
    // `saleAfter` waves after Unified Theory, she is sold 10 s into a wave
    if (ht && ht.tiers[0] === 5 && !utWave) utWave = A.sim.wave;
    if (ht && utWave && !saleQueued && A.sim.state === 'wave' && A.sim._waveTime > 10 && A.sim.wave >= utWave + saleAfter) {
      A.queue('sell', [ht.uid]);
      saleQueued = true;
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
      if (i === 0) {
        for (const ev of c.sim.events) {
          if (ev.type === 'labJoin') {
            count.labJoin++;
            joins.push(`r${ev.round}:${ev.uids.length}`);
            members = LAB_CLASSES.map((cls) => `${cls}:${ev.members[cls]}`).join(' ');
          } else if (ev.type === 'zoneOpen') {
            count.zoneOpen++;
            if (ev.kind === 'lastLine') count.lastLine++;
          } else if (ev.type === 'labFrag' || ev.type === 'swallow') count[ev.type]++;
          else if (ev.type === 'cash' && ev.reason === 'lab') count.labCash += ev.amount;
        }
      }
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
  const copy = new Lockstep({ start: TENKA_START, mySlot: 1, send: () => {}, now: () => 0 });
  copy.rebuild(TENKA_START, A.log, A.tick, ck ? { t: ck.t, snap: JSON.parse(ck.json) } : null);
  const finalDigest = snapshotDigest(A.coop.snapshot());
  const ticks = [...seen[0].keys()].filter((t) => seen[1].has(t)).sort((a, b) => a - b);
  const st = A.sim.stats;
  return {
    ticks: A.tick,
    state: A.sim.state,
    wave: A.sim.wave,
    cleared: A.sim.wavesCleared,
    towers: A.sim.towers.map((t) => `${A.coop.ownerOf(t.uid) ?? '-'}:${t.unitId}:${t.tiers.join('')}`).join(' '),
    absorbed: absorbed.join(' '),
    joins: joins.join(' '),
    joined: st.labJoined || 0,
    // who her lab team was by class, after the second absorb (her lab is sold before the run ends)
    members,
    labFrags: count.labFrag,
    labCash: count.labCash,
    wells: st.wells || 0,
    lastLines: st.lastLines || 0,
    swallowed: st.swallowed || 0,
    sale: String(sale),
    refused: odd.join(' '),
    wallets: A.coop.wallets.join('/'),
    lives: A.sim.lives,
    final: A.coop.hash(),
    finalB: B.coop.hash(),
    hashes: bitsHash(ticks.map((t) => seen[0].get(t))),
    checkpoints: ticks.length,
    agree: ticks.length > 0 && ticks.every((t) => seen[0].get(t) === seen[1].get(t)) && A.coop.hash() === B.coop.hash(),
    ckWave: ck?.wave ?? -1,
    ckDigest: ck ? snapshotDigest(ck.json) : 'none',
    ckSame: !!ck && copy.lastRebuild?.restored === true && copy.tick === A.tick && copy.coop.hash() === A.coop.hash() && snapshotDigest(copy.coop.snapshot()) === finalDigest,
    finalDigest,
    ms: Date.now() - t0,
  };
}

/**
 * What a runTenkaBattle result must have exercised, beyond matching its pins (e2e/engines.mjs and
 * tests/online/engines.test.js both check it, so a re-pin cannot quietly lose it): both absorbs, a girl of
 * EVERY lab class in her team (a role moved to another category would leave one empty), her grenades and
 * the economy weapon's coins, the guest's wells and Last Line, and a mid-wave sale.
 * @returns {string[]} what is missing (empty: all of it ran)
 */
export function tenkaCoverage(b) {
  const miss = [];
  if (!(b.joined >= 5) || String(b.joins).split(' ').length < 2) miss.push(`her lab team: ${b.joins}, ${b.joined} joined (want both absorbs)`);
  const n = {};
  for (const [, cls, k] of String(b.members).matchAll(/(\w+):(\d+)/g)) n[cls] = Number(k);
  const none = LAB_CLASSES.filter((cls) => !(n[cls] > 0));
  if (none.length) miss.push(`her lab team (${b.members}): nobody joined as ${none.join(', ')}`);
  if (!(b.labFrags > 0)) miss.push('her lab never threw a grenade');
  if (!(b.labCash > 0)) miss.push('her economy weapon never paid');
  if (!(b.wells > 0 && b.lastLines > 0 && b.swallowed > 0)) miss.push(`wells ${b.wells}, Last Lines ${b.lastLines}, swallowed ${b.swallowed}`);
  if (!/mid-wave/.test(b.sale)) miss.push(`her sale: ${b.sale}`);
  return miss;
}

// ---------------------------------------------------------------------------
// The returning girls (roster B3, track 5): relay origins, two firing points, grounding + Air,
// gather and the push lock, curse spread with the burst budget, the sky-dragon runner, the hexing
// tide and the co-op `aim` command, in one co-op battle on a flyer stage
// ---------------------------------------------------------------------------

const ROSTER_STATS = { costMul: 0.2, damageMul: 3, rateMul: 1.2 };
export const ROSTER_START = Object.freeze({
  seed: 525252,
  stageId: '8-1',
  difficulty: 'easy',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: ['iroha', 'ena', 'ruri', 'hana'].map((unitId) => ({ unitId, stats: ROSTER_STATS })), hero: { unitId: 'seiran', stats: ROSTER_STATS } },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: ['fuu', 'noa', 'ena'].map((unitId) => ({ unitId, stats: ROSTER_STATS })), hero: { unitId: 'yoriko', stats: ROSTER_STATS } },
  ],
});

/**
 * A co-op battle with the returning girls (8-1 Easy, wyverns): the host aims Iroha's mirror and
 * Seiran's dragon and casts Dragonflight whenever it is ready; the guest's Fuu gathers and pushes,
 * Ena curses, Yoriko's Dream Detour hexes. Two Lockstep clients over a seeded fake network; the
 * host's checkpoint after wave `checkpointAt` is restored into a fresh client and replayed.
 */
export function runRosterBattle({ checkpointAt = 6, toWave = 14, maxFrames = 60 * 60 * 14 } = {}) {
  const t0 = Date.now();
  const rng = createRng(23);
  const clock = { t: 0 };
  const queue = [];
  let frame = 0;
  const mk = (slot) => new Lockstep({
    start: ROSTER_START,
    mySlot: slot,
    now: () => clock.t,
    send: (msg) => queue.push({ at: frame + Math.floor(rng.next() * 10), seq: queue.length, to: 1 - slot, msg: JSON.parse(JSON.stringify(msg)) }),
  });
  const [A, B] = [mk(0), mk(1)];
  const clients = [A, B];
  const ids = ['seiran', 'iroha', 'ena', 'ruri', 'hana', 'yoriko', 'fuu', 'noa'];
  const spots = spotsFor(ROSTER_START, ids, 2);
  const want = [[0, 'seiran', spots.seiran[0]], [0, 'iroha', spots.iroha[0]], [0, 'ena', spots.ena[0]], [0, 'ruri', spots.ruri[0]], [0, 'hana', spots.hana[0]],
    [1, 'yoriko', spots.yoriko[0]], [1, 'fuu', spots.fuu[0]], [1, 'noa', spots.noa[0]], [1, 'ena', spots.ena[1]]];
  const seen = [new Map(), new Map()];
  let ck = null;
  let aims = 0;
  let ults = 0;
  const mech = { curseBurst: 0, runner: 0, relay: 0, abilityUnlock: 0, ability: 0 };
  const mine = (c, u) => c.sim.towers.find((t) => t.unitId === u && c.coop.isMine(t.uid));
  while (frame < maxFrames && !(A.finished && B.finished) && A.sim.wave < toWave) {
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
      clients.forEach((c) => {
        for (const t of c.sim.towers.filter((x) => c.coop.isMine(x.uid) && !x.isHero)) {
          const path = t.tiers[0] < 3 ? 0 : t.tiers[2] < 2 ? 2 : null;
          if (path == null || c.sim.upgradeStatus(t.uid, path).locked) continue;
          c.queue('upg', [t.uid, path]);
          break;
        }
      });
    }
    const iroha = mine(A, 'iroha');
    if (iroha && frame % 1300 === 400) {
      A.queue('aim', [iroha.uid, Math.round((iroha.x + (frame % 2600 === 400 ? 2.5 : -2.5)) * 1024), Math.round((iroha.y + 1.25) * 1024)]);
      aims++;
    }
    const seiran = A.sim.heroes?.[0];
    if (seiran && frame % 1700 === 800) {
      const e = A.sim.enemies.find((x) => !x.dead && !x.hidden);
      A.queue('aim', e ? [seiran.uid, Math.round(e.x * 1024), Math.round(e.y * 1024)] : [seiran.uid, null]);
      aims++;
    }
    if (frame % 240 === 120) {
      A.queue('ult');
      B.queue('ult');
      ults++;
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
      if (i === 0) for (const ev of c.sim.events) if (mech[ev.type] != null) mech[ev.type]++;
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
  const copy = new Lockstep({ start: ROSTER_START, mySlot: 1, send: () => {}, now: () => 0 });
  copy.rebuild(ROSTER_START, A.log, A.tick, ck ? { t: ck.t, snap: JSON.parse(ck.json) } : null);
  const finalDigest = snapshotDigest(A.coop.snapshot());
  const ticks = [...seen[0].keys()].filter((t) => seen[1].has(t)).sort((a, b) => a - b);
  return {
    ticks: A.tick,
    state: A.sim.state,
    wave: A.sim.wave,
    towers: A.sim.towers.length,
    damage: Math.round(A.sim.towers.reduce((a, t) => a + t.damageDealt, 0)),
    aims,
    ults,
    curseBursts: mech.curseBurst,
    runners: mech.runner,
    relays: mech.relay,
    // (A3 M3: the returning girls' abilities unlock here — on both clients' girls — and are never cast)
    abilityUnlocks: mech.abilityUnlock,
    abilityCasts: mech.ability,
    lives: A.sim.lives,
    wallets: A.coop.wallets.join('/'),
    final: A.coop.hash(),
    hashes: bitsHash(ticks.map((t) => seen[0].get(t))),
    checkpoints: ticks.length,
    // (stopped mid-battle: the guest may be a few ticks behind, so the hashes both clients took agree)
    agree: ticks.every((t) => seen[0].get(t) === seen[1].get(t)) && (A.tick !== B.tick || A.coop.hash() === B.coop.hash()),
    agreeTicks: ticks.every((t) => seen[0].get(t) === seen[1].get(t)),
    tickGap: A.tick - B.tick,
    ckWave: ck?.wave ?? -1,
    ckDigest: ck ? snapshotDigest(ck.json) : 'none',
    ckSame: !!ck && copy.lastRebuild?.restored === true && copy.tick === A.tick && copy.coop.hash() === A.coop.hash() && snapshotDigest(copy.coop.snapshot()) === finalDigest,
    finalDigest,
    ms: Date.now() - t0,
  };
}

// ---------------------------------------------------------------------------
// The returning girls' abilities (A3 M3): Kaze's Swoop, Moon Pounce from Kon's spot, First Aid Call (lives from
// kills), Omen Card (curse bursts), Puppet Hex and Storm Lance (hero skills, ranked at Lv 17), in one co-op battle
// ---------------------------------------------------------------------------

// cheap (every girl reaches her ⚡ tier 5 inside the run); the girls arrive after wave 1, which leaks a little with
// only the two heroes out, so First Aid Call has lives to bring back
const RETURNING_ABIL_STATS = Object.freeze({ costMul: 0.06, damageMul: 0.8, rateMul: 1.1 });
// (the heroes start weak: alone in wave 1 they let some through)
const RETURNING_ABIL_HERO = Object.freeze({ costMul: 0.06, damageMul: 0.15 });
const retLoadout = (ids) => ids.map((unitId) => ({ unitId, stats: RETURNING_ABIL_STATS }));
/** The host brings Hana, Ruri (Moonhound), Noa and Seiran and taps by hand; the guest Ena, Aoi and Yoriko on Auto-cast. */
export const RETURNING_ABIL_START = Object.freeze({
  seed: 535353,
  stageId: '2-5',
  difficulty: 'normal',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: retLoadout(['hana', 'ruri', 'noa']), hero: { unitId: 'seiran', stats: RETURNING_ABIL_HERO } },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: retLoadout(['ena', 'aoi']), hero: { unitId: 'yoriko', stats: RETURNING_ABIL_HERO } },
  ],
});
/** The returning abilities that run (the scenario must cast each of them). */
export const RETURNING_ABIL_IDS = Object.freeze(['ena.omenCard', 'hana.swoop', 'noa.firstAid', 'ruri.moonPounce', 'seiran.stormLance', 'yoriko.puppetHex']);

/**
 * A whole co-op battle with the returning girls' abilities (2-5 Normal, to `toWave` waves cleared): the two heroes
 * alone through wave 1 (a life slips through), then every girl to her ⚡ tier 3 (tier 5 from wave 6 when her coins
 * allow) around Noa; both heroes to Lv 7, then Lv 18 (the Lv 17 ranks). The host taps one of her casters every 4 s
 * in a round robin (Seiran's lance through her hero's uid; some group taps; many land on a recharging girl or find
 * nothing and are refused) and fires Noa's First Aid Call when 6 enemies stand within 3 tiles of her (her view's
 * count), so its kills bring a life back; the guest plays on Auto-cast (`acast[0, 1]`) and taps her ready girls every
 * 5 s. Two Lockstep clients over the seeded fake network; the host's checkpoint after wave `checkpointAt` restored
 * into a fresh client and replayed. `byId` counts the `ability` events per ability; `crowd` / `rallyKills` (the most
 * enemies by Noa, the most kills one rally counted) say how close the lives part came.
 */
export function runReturningAbilBattle({ toWave = 14, checkpointAt = 8, maxFrames = 60 * 60 * 20, start = RETURNING_ABIL_START } = {}) {
  const t0 = Date.now();
  const rng = createRng(31);
  const clock = { t: 0 };
  const queue = [];
  let frame = 0;
  const taps = { abil: 0, ok: 0, reasons: {} };
  const odd = [];
  const mk = (slot) => new Lockstep({
    start,
    mySlot: slot,
    now: () => clock.t,
    hooks: {
      onApplied: (c, r) => {
        if (slot !== 0) return;
        if (c.k === 'abil') {
          taps.abil++;
          if (r.ok) taps.ok++;
          else {
            taps.reasons[r.reason] = (taps.reasons[r.reason] || 0) + 1;
            if (!ABIL_REASONS.includes(r.reason)) odd.push(`abil@${c.t}:${r.reason}`);
          }
        } else if (c.k === 'acast' && !r.ok) odd.push(`acast@${c.t}:${r.reason}`);
        else if (!r.ok && c.k !== 'hlv' && c.k !== 'upg' && !(c.k === 'place' && r.reason === 'cash')) odd.push(`${c.k}@${c.t}:${r.reason}`);
      },
    },
    send: (msg) => queue.push({ at: frame + Math.floor(rng.next() * 10), seq: queue.length, to: 1 - slot, msg: JSON.parse(JSON.stringify(msg)) }),
  });
  const [A, B] = [mk(0), mk(1)];
  const clients = [A, B];
  const girls = [['hana', 'ruri', 'noa'], ['ena', 'aoi']];
  // Noa takes the spot nearest the road and the four damage girls the nearest free spots around her, so the killing
  // happens at her feet and her rally's kills can bring lives back; the heroes take the next road spots
  const spots = spotsFor(start, ['noa', 'seiran', 'yoriko'], 3);
  const taken = Object.values(spots).flat().map(([qx, qy]) => [qx / 1024, qy / 1024]);
  const around = spotsAround(start, spots.noa[0], ['hana', 'ena', 'aoi', 'ruri'], 6, taken);
  for (const u of ['hana', 'ena', 'aoi', 'ruri']) spots[u] = [around[u]];
  const want = [];
  for (let i = 0; i < 3; i++) for (const slot of [0, 1]) if (girls[slot][i]) want.push([slot, girls[slot][i], spots[girls[slot][i]], 0]);
  const seen = [new Map(), new Map()];
  const byId = {};
  const mech = { lifeRestored: 0, curseBurst: 0, hexed: 0, crowd: 0, rallyKills: 0 };
  let ck = null;
  let turn = 0;
  let guestTurn = 0;
  const NOA_CROWD = 6;
  const mine = (c) => c.sim.towers.filter((t) => c.coop.isMine(t.uid));
  while (frame < maxFrames && !(A.finished && B.finished) && Math.min(A.sim.wavesCleared, B.sim.wavesCleared) < toWave) {
    if (frame === 4) A.queue('place', ['seiran', ...spots.seiran[0]]);
    if (frame === 5) B.queue('place', ['yoriko', ...spots.yoriko[0]]);
    if (frame === 20) A.queue('auto', [true]);
    if (frame === 21) B.queue('acast', [0, 1]);
    if (frame === 24) A.queue('wave');
    if (frame % 15 === 0 && A.sim.wavesCleared >= 1) {
      for (let i = want.length - 1; i >= 0; i--) if (mine(clients[want[i][0]]).some((t) => t.unitId === want[i][1])) want.splice(i, 1);
      for (const w of want) {
        const [slot, u, list, next] = w;
        const c = clients[slot];
        if (frame < next) break;
        const q = list.find(([qx, qy]) => !c.sim.placementReason(u, qx / 1024, qy / 1024));
        if (q && c.sim.canPlace(u, q[0] / 1024, q[1] / 1024).ok) {
          c.queue('place', [u, ...q]);
          w[3] = frame + 120;
          break;
        }
      }
    }
    clients.forEach((c, slot) => {
      // one ⚡-path tier at a time: each girl to tier 3, then to tier 5 from wave 6
      if (frame % 60 === 30 + slot * 7) {
        const cap = c.sim.wavesCleared >= 6 ? 5 : 3;
        for (const t of mine(c)) {
          if (t.isHero) continue;
          const path = abilityPathOf(t.def);
          if (t.tiers[path] >= cap || c.sim.upgradeStatus(t.uid, path).locked) continue;
          c.queue('upg', [t.uid, path]);
          break;
        }
      }
      // her hero to Lv 8 (her skill at Lv 7), then to Lv 18 from wave 6 (its rank at Lv 17)
      const lv = c.sim.wavesCleared >= 6 ? 18 : 8;
      if (frame % 150 === 75 + slot * 10 && c.sim.hero && c.sim.hero.level < lv) {
        const st = c.sim.heroLevelStatus();
        if (!st.reason) c.queue('hlv', [st.level + 1, st.price]);
      }
    });
    // the host taps one of her casters every 4 s, round robin (her hero too); some group taps. Noa waits for a crowd
    // at her feet (8 enemies within 3 tiles: her view's count), so her rally's kills can bring a life back
    if (frame % 240 === 200 && A.sim.state === 'wave') {
      const casters = mine(A).filter((t) => t.abil && t.unitId !== 'noa').sort((p, q) => p.uid - q.uid);
      if (casters.length) {
        const t = casters[turn % casters.length];
        A.queue('abil', abilArgs(t.uid, { group: turn % 3 === 1 }));
        turn++;
      }
    }
    const noa = frame % 10 === 5 && A.sim.state === 'wave' ? mine(A).find((t) => t.unitId === 'noa' && t.abil) : null;
    const crowd = noa ? A.sim.enemies.filter((e) => !e.dead && !e.hidden && (e.x - noa.x) * (e.x - noa.x) + (e.y - noa.y) * (e.y - noa.y) <= 9).length : 0;
    if (crowd > mech.crowd) mech.crowd = crowd;
    for (const r of A.sim._rallies) if (r.life && r.life.kills > mech.rallyKills) mech.rallyKills = r.life.kills;
    if (noa && crowd >= NOA_CROWD && A.sim.abilityStatus(noa.uid).ready) A.queue('abil', abilArgs(noa.uid));
    // the guest taps one of her ready girls every 5 s (Auto waits for its own moment)
    if (frame % 300 === 150 && B.sim.state === 'wave') {
      const ready = mine(B).filter((t) => t.abil && B.sim.abilityStatus(t.uid).ready).sort((p, q) => p.uid - q.uid);
      if (ready.length) B.queue('abil', abilArgs(ready[guestTurn++ % ready.length].uid));
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
      if (i === 0) {
        for (const ev of c.sim.events) {
          if (ev.type === 'ability') byId[ev.id] = (byId[ev.id] || 0) + 1;
          else if (ev.type === 'lifeRestored' && ev.id) mech.lifeRestored++;
          else if (ev.type === 'curseBurst') mech.curseBurst++;
          else if (ev.type === 'status' && ev.status === 'hex') mech.hexed++;
        }
      }
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
  const copy = new Lockstep({ start, mySlot: 1, send: () => {}, now: () => 0 });
  copy.rebuild(start, A.log, A.tick, ck ? { t: ck.t, snap: JSON.parse(ck.json) } : null);
  const finalDigest = snapshotDigest(A.coop.snapshot());
  const ticks = [...seen[0].keys()].filter((t) => seen[1].has(t)).sort((a, b) => a - b);
  const ids = Object.keys(byId).sort();
  return {
    ticks: A.tick,
    state: A.sim.state,
    wave: A.sim.wave,
    cleared: A.sim.wavesCleared,
    towers: A.sim.towers.map((t) => `${t.owner}:${t.unitId}:${t.isHero ? `Lv${t.level}` : t.tiers.join('')}${t.abil ? `+${t.abil.n}${t.abil.t5 ? '*' : ''}` : ''}`).join(' '),
    casts: ids.reduce((a, k) => a + byId[k], 0),
    ids: ids.join(','),
    byId: ids.map((k) => `${k} ${byId[k]}`).join(' · '),
    lifeRestored: mech.lifeRestored,
    curseBursts: mech.curseBurst,
    hexed: mech.hexed,
    crowd: mech.crowd,
    rallyKills: mech.rallyKills,
    taps: `${taps.abil} abil: ${taps.ok} cast, ${Object.keys(taps.reasons).sort().map((k) => `${taps.reasons[k]} ${k}`).join(', ')}`,
    refused: odd.join(' '),
    wallets: A.coop.wallets.join('/'),
    lives: A.sim.lives,
    final: A.coop.hash(),
    hashes: bitsHash(ticks.map((t) => seen[0].get(t))),
    checkpoints: ticks.length,
    agree: ticks.length > 0 && ticks.every((t) => seen[0].get(t) === seen[1].get(t)),
    ckWave: ck?.wave ?? -1,
    ckDigest: ck ? snapshotDigest(ck.json) : 'none',
    ckSame: !!ck && copy.lastRebuild?.restored === true && copy.tick === A.tick && copy.coop.hash() === A.coop.hash() && snapshotDigest(copy.coop.snapshot()) === finalDigest,
    finalDigest,
    ms: Date.now() - t0,
  };
}

// ---------------------------------------------------------------------------
// Potential (src/data/potential.js): every kind of step in one co-op battle
// ---------------------------------------------------------------------------

const P = (potential, more = {}) => ({ ...CHEAP, potential, ...more });
/**
 * Potential's scenario (docs/specs/POTENTIAL.md v3 §6.3, §13.3): drones and their overclock
 * (Chika), traps and a trap rhythm (Suzu), an aura, its Brittle and aura boost (Miko), a kept focus
 * (Kaede), Moonfall with its Brittle (hero Luna), coins and harvest (Momo), silence (Hotaru), range
 * (Yuki), Kage at P6 (more shuriken per throw through the carry, tempo, the storm's echo volley),
 * Rei at P6 in Duelist Stance (the echo at a share of a duel strike), and the SAME girl at two
 * Potentials: host Aoi P1, guest Aoi P6. Stage 1-3 has no spectral enemy and no boss: Hotaru's
 * ×spectral and Kaede's ×boss fight in POTENTIAL_BOSS_START below. (Umeko's aura steps need water,
 * which 1-3 lacks; tests/sim/mods.test.js covers them.) START stays as it is, so its digest keeps
 * meaning "P1 changes nothing".
 */
export const POTENTIAL_START = Object.freeze({
  seed: 616161,
  stageId: '1-3',
  difficulty: 'hard',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'kaede', stats: P(6) }, { unitId: 'chika', stats: P(6) }, { unitId: 'miko', stats: P(6) }, { unitId: 'suzu', stats: P(6) }, { unitId: 'aoi', stats: P(1) }], hero: { unitId: 'luna', stats: P(6) } },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'kage', stats: P(6) }, { unitId: 'rei', stats: P(6, { costMul: 0.08 }) }, { unitId: 'aoi', stats: P(6, { damageMul: 1.1 }) }, { unitId: 'hotaru', stats: P(6) }, { unitId: 'momo', stats: P(6) }, { unitId: 'yuki', stats: P(6) }], hero: null },
  ],
});
/** Who gets the spots nearest the path first (the girls whose v3 mechanics this battle is about). */
const POTENTIAL_SPOTS_FIRST = Object.freeze(['kage', 'kaede', 'rei', 'miko', 'hotaru', 'suzu', 'chika']);
/** Upgrades [slot, girl, path] in order, each once its player can pay (Rei: four on path 1 = Duelist Stance). */
const POTENTIAL_UPGRADES = Object.freeze([
  [1, 'rei', 1], [1, 'rei', 1], [1, 'rei', 1], [1, 'rei', 1], [0, 'chika', 0], [0, 'suzu', 0], [1, 'aoi', 0],
  [0, 'miko', 1], [1, 'kage', 0], [1, 'momo', 2], [1, 'aoi', 1],
]);

const PB = (potential, more = {}) => ({ costMul: 0.4, damageMul: 4, rateMul: 1.2, potential, ...more });
/**
 * Potential against a spectral boss (v3 §6.3): Total Assault: Grave Lych (every wave spectral
 * ghouls, the Lych a spectral boss at wave 15), so Hotaru's Lantern Rite (×1.2 vs spectral) and
 * Kaede's One Blade, One Foe (×1.2 vs bosses) fight; Kage, Rei (Duelist Stance) and Akane (an echo
 * at half a Grand Starburst, leaping burns) at P6 too, hero Hikari P6 (her rhythm, a wider Bloom).
 */
export const POTENTIAL_BOSS_START = Object.freeze({
  seed: 717171,
  stageId: 'boss-lych',
  difficulty: 'normal',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'hotaru', stats: PB(6) }, { unitId: 'kaede', stats: PB(6) }, { unitId: 'kage', stats: PB(6) }, { unitId: 'miko', stats: PB(6) }, { unitId: 'chika', stats: PB(6) }], hero: { unitId: 'hikari', stats: PB(6) } },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'rei', stats: PB(6) }, { unitId: 'akane', stats: PB(6) }, { unitId: 'hotaru', stats: PB(2) }, { unitId: 'kaede', stats: PB(1) }, { unitId: 'aoi', stats: PB(6) }, { unitId: 'yuki', stats: PB(6) }], hero: null },
  ],
});
const POTENTIAL_BOSS_UPGRADES = Object.freeze([
  [1, 'rei', 1], [1, 'rei', 1], [1, 'rei', 1], [1, 'rei', 1], [0, 'kage', 0], [0, 'kage', 0], [0, 'hotaru', 0], [0, 'kaede', 1],
  [1, 'akane', 0], [1, 'akane', 0], [0, 'miko', 1], [1, 'aoi', 0], [0, 'chika', 0], [1, 'hotaru', 0], [1, 'kaede', 1],
]);

/**
 * A Potential start to the end: each player places her girls as her own coins allow (in list
 * order), then upgrades them in `upgrades` order as her coins allow, auto-start and 2× speed; the
 * host fires her hero's ult when ready. Counts what the v3 mechanics did on the host's client
 * (rhythms, echo volleys, tempo changes, shuriken carried over, hits on spectral enemies and bosses
 * by Hotaru / Kaede at P6).
 * @returns {object} the same fields as runScriptedBattle plus `aoi` (both Aois' resolved stats) and `mech`
 */
export function runPotentialBattle({ start = POTENTIAL_START, upgrades = POTENTIAL_UPGRADES, spotsFirst = POTENTIAL_SPOTS_FIRST, maxFrames = 60 * 60 * 14, probe = null, script = null, ultInWave = false } = {}) {
  const t0 = Date.now();
  const rng = createRng(11);
  const clock = { t: 0 };
  const queue = [];
  let frame = 0;
  const refused = [];
  const mk = (slot) => new Lockstep({
    start,
    mySlot: slot,
    now: () => clock.t,
    hooks: { onApplied: (c, r) => { if (!r.ok && slot === 0) refused.push(`${c.k}@${c.t}:${r.reason}`); } },
    send: (msg) => queue.push({ at: frame + Math.floor(rng.next() * 10), seq: queue.length, to: 1 - slot, msg: JSON.parse(JSON.stringify(msg)) }),
  });
  const [A, B] = [mk(0), mk(1)];
  const clients = [A, B];
  const units = start.players.map((p) => [...(p.hero ? [p.hero.unitId] : []), ...p.loadout.map((e) => e.unitId)]);
  const all = [...new Set([...spotsFirst.filter((u) => units.flat().includes(u)), ...units.flat()])];
  const sp = spotsFor(start, all, 2);
  const used = new Set();
  const spotOf = (u) => {
    const q = sp[u].find((x) => !used.has(x.join()));
    if (q) used.add(q.join());
    return q;
  };
  const later = units.flatMap((list, i) => list.map((u) => [clients[i], u, spotOf(u)])).filter((x) => x[2]);
  const todo = upgrades.map(([slot, unit, path]) => [clients[slot], unit, path]);
  let ults = 0;
  let lastUlt = -1e9;
  let aoi = '';
  const mech = { proc: 0, echo: 0, tempo: 0, carry: 0, spectral: 0, boss: 0 };
  const hostOf = (id) => A.sim.towers.find((t) => t.def.id === id && t.unitStats?.potential === 6);
  // (hits by Hotaru's ×spectral and Kaede's ×boss at P6, counted on the host's copy; the call itself
  // is untouched, and the counter is not an own enumerable field, so checkpoints never see it)
  const hit0 = A.sim._hit;
  Object.defineProperty(A.sim, '_hit', {
    configurable: true,
    writable: true,
    enumerable: false,
    value: function hit(e, tower, spec, ...rest) {
      if (tower?.unitStats?.potential === 6 && e && !e.dead) {
        if (tower.def.id === 'hotaru' && spec?.classMul?.[e.armorClass] > 1) mech.spectral++;
        if (tower.def.id === 'kaede' && spec?.bossMul > 1 && (e.tier === 'boss' || e.tier === 'miniboss')) mech.boss++;
      }
      return hit0.call(this, e, tower, spec, ...rest);
    },
  });
  // (an optional observer of the host's copy, installed the same way: it never changes the battle)
  probe?.(A.sim);
  while (frame < maxFrames && !(A.finished && B.finished)) {
    if (frame === 20) A.queue('wave');
    if (frame === 30) A.queue('auto', [true]);
    if (frame === 40) B.queue('speed', [2]);
    // (an optional script of extra commands: the duo battle's Auto-cast and aim)
    script?.(frame, A, B);
    // each player: her next girl when her own wallet allows it; one in flight at a time, and a
    // girl leaves the list only once she stands on the map (a refused place is tried again)
    for (const c of clients) {
      const i = later.findIndex((x) => x[0] === c);
      if (i < 0 || frame % 15) continue;
      const [, unit, [qx, qy], sent] = later[i];
      if (c.sim.towers.some((t) => t.def.id === unit && c.coop.isMine(t.uid))) {
        later.splice(i, 1);
        continue;
      }
      if (frame - (sent ?? -1e9) < 120) continue;
      if (c.sim.canPlace(unit, qx / 1024, qy / 1024).ok) {
        c.queue('place', [unit, qx, qy]);
        later[i][3] = frame;
      }
    }
    // the next upgrade once its girl stands and her player can pay for it (one in flight); a girl
    // still waiting for her spot keeps her upgrades waiting, one that never gets one drops them. A
    // player with a girl's placement still in flight waits too: that placement spends her coins first
    // (both orders execute after the input delay), so an upgrade sent now could arrive unaffordable
    if (todo.length && frame % 60 === 0) {
      const [c, unit, path, sent] = todo[0];
      const t = c.sim.towers.find((x) => x.def.id === unit && c.coop.isMine(x.uid));
      const st = t ? c.sim.upgradeStatus(t.uid, path) : null;
      const waiting = !t && later.some((x) => x[0] === c && x[1] === unit);
      const placing = later.some((x) => x[0] === c && x[3] != null && frame - x[3] < 120);
      if (sent != null) {
        if (frame - sent >= 120) todo.shift();
      } else if (placing) {
        // (her placement lands first)
      } else if (st && !st.locked) {
        c.queue('upg', [t.uid, path]);
        todo[0][3] = frame;
      } else if (!waiting && (!st || st.reason !== 'cash')) todo.shift(); // never placed, maxed or locked: skip
    }
    // (ultInWave: a hero whose ult only works during a wave, Norika's Hold the Line, casts in waves only)
    if (frame % 30 === 0 && A.sim.hero && A.sim.heroUltStatus().ready && A.tick > lastUlt + 120 && (!ultInWave || (A.sim.state === 'wave' && A.sim.enemies.length > 3))) {
      lastUlt = A.tick;
      A.queue('ult');
      ults++;
    }
    if (!aoi && A.sim.towers.filter((t) => t.def.id === 'aoi').length === 2) {
      const [x, y] = A.sim.towers.filter((t) => t.def.id === 'aoi').map((t) => t.stats);
      aoi = [x, y].map((st) => `${st.damage}/${st.rate}/${st.range}/${st.crit.chance}`).join(' | ');
    }
    frame++;
    clock.t += 1000 / 60;
    const due = queue.filter((m) => m.at <= frame).sort((a, b) => a.at - b.at || a.seq - b.seq);
    for (const m of due) {
      queue.splice(queue.indexOf(m), 1);
      clients[m.to].receive(m.msg);
    }
    const kage = hostOf('kage');
    const carry0 = kage?.projCarry;
    for (const c of clients) c.advance(1 / 60);
    // what the v3 mechanics did, from the host's client (its events; the guest's are dropped)
    for (const ev of A.sim.events) {
      if (ev.type === 'proc') mech.proc++;
      else if (ev.type === 'attack' && ev.echo) mech.echo++;
      else if (ev.type === 'tempo') mech.tempo++;
    }
    if (kage && carry0 != null && kage.projCarry < carry0) mech.carry++;
    for (const c of clients) c.sim.events.length = 0;
  }
  for (let f = 0; f < 30; f++) {
    frame++;
    clock.t += 1000 / 60;
    for (const m of queue.splice(0)) clients[m.to].receive(m.msg);
    for (const c of clients) c.advance(1 / 60);
  }
  const pairs = A.hashPairs();
  return {
    ticks: A.tick,
    state: A.sim.state,
    wave: A.sim.wave,
    towers: A.sim.towers.map((t) => `${t.def.id}:P${t.unitStats?.potential ?? 1}`).join(' '),
    tiers: A.sim.towers.map((t) => t.tiers.join('')).join(' '),
    // damage and rhythm count per girl (information: who fought)
    dealt: A.sim.towers.map((t) => `${t.def.id}:${Math.round(t.damageDealt)}/${t.potCount || 0}`).join(' '),
    wallets: A.coop.wallets.join('/'),
    final: A.coop.hash(),
    hashes: bitsHash(pairs.map((p) => Number.parseInt(p.mine, 16) || 0)),
    checkpoints: pairs.length,
    agree: pairs.every((p) => p.mine === p.theirs) && A.coop.hash() === B.coop.hash(),
    ults,
    aoi,
    mech,
    failed: refused.length,
    refused: refused.join(' '),
    ms: Date.now() - t0,
  };
}

/** POTENTIAL_BOSS_START to the end (Hotaru vs spectral, Kaede vs the Lych). */
export function runPotentialBossBattle({ maxFrames = 60 * 60 * 20 } = {}) {
  return runPotentialBattle({ start: POTENTIAL_BOSS_START, upgrades: POTENTIAL_BOSS_UPGRADES, spotsFirst: ['kaede', 'hotaru', 'rei', 'kage', 'akane'], maxFrames });
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

// ---------------------------------------------------------------------------
// Gear (docs/specs/GEAR_STATS.md §F.4): GEAR_START, the clubs lineup with Pierce and Aura Power
// ---------------------------------------------------------------------------

const G = (more = {}) => ({ costMul: 0.4, damageMul: 3, rateMul: 1.2, ...more });
/**
 * Every gear rule in one co-op battle (4-5, crowds and a Matriarch-free wave table): Pierce on shots
 * (Archery Aoi with Follow-Through), a sweep (Fencing Rei: Finishing Thrust), blasts (Pyrotechnics
 * Akane: Finale Pop and the pop budget, her burn × dotMul), traps (Taiko Suzu: Big Beat on traps),
 * drones (Taiko Chika: drone Pierce and Big Beat on drone shots), a half-rate sniper (Shiro), an aura
 * with Aura Power and the fill-in radius (Tea Miko: Second Cup), and a duel with a club (Kaede).
 */
export const GEAR_START = Object.freeze({
  seed: 818181,
  stageId: '4-5',
  difficulty: 'normal',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: [
      { unitId: 'aoi', stats: G({ pierceK: 76, club: 'archery', clubN: 3 }) },
      { unitId: 'akane', stats: G({ pierceK: 46, dotMul: 1.25, club: 'pyro', clubN: 3 }) },
      { unitId: 'miko', stats: G({ auraPct: 0.2, auraRangeMul: 1.05, club: 'tea', clubN: 3 }) },
      { unitId: 'suzu', stats: G({ pierceK: 30, club: 'taiko', clubN: 3 }) },
    ], hero: { unitId: 'hikari', stats: G({ pierceK: 46 }) } },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: [
      { unitId: 'rei', stats: G({ pierceK: 46, club: 'fencing', clubN: 3 }) },
      { unitId: 'chika', stats: G({ pierceK: 100, club: 'taiko', clubN: 3 }) },
      { unitId: 'shiro', stats: G({ pierceK: 150, club: 'fencing', clubN: 2 }) },
      { unitId: 'kaede', stats: G({ club: 'fencing', clubN: 3 }) },
    ], hero: null },
  ],
});
const GEAR_UPGRADES = Object.freeze([[0, 'aoi', 0], [0, 'akane', 0], [1, 'chika', 0], [1, 'rei', 0], [0, 'suzu', 0], [1, 'shiro', 0]]);

/** GEAR_START to the end (or 14 minutes): the same fields as runPotentialBattle. */
export function runGearBattle({ maxFrames = 60 * 60 * 14 } = {}) {
  const t0 = Date.now();
  const r = runPotentialBattle({ start: GEAR_START, upgrades: GEAR_UPGRADES, spotsFirst: ['aoi', 'rei', 'akane', 'chika', 'suzu', 'miko', 'shiro', 'kaede'], maxFrames });
  r.ms = Date.now() - t0;
  return r;
}

// ---------------------------------------------------------------------------
// The returning girls in gear: GEAR_GIRLS_START (towers.js paths merged from the roster wave)
// ---------------------------------------------------------------------------

/**
 * The nine returning girls wearing gear in one co-op battle (4-5 Normal, as GEAR_START): Iroha's two
 * firing points (her mirror and where she stands), each volley taking gear Pierce and Archery's
 * Follow-Through; Ena and Ruri's shots with Pierce; Noa's sanctuary with Aura Power (her base aura
 * gives +8 % damage, so it is real); Fuu, Hana and the three staff heroes with their clubs' tricks;
 * pulse / beam / chain Pierce measured from the relay origin (t.ox / t.oy). Aoi joins as the live
 * girl beside them. Kanna is the host's hero, Seiran the guest's.
 */
export const GEAR_GIRLS_START = Object.freeze({
  seed: 424242,
  stageId: '4-5',
  difficulty: 'normal',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: [
      { unitId: 'iroha', stats: G({ pierceK: 76, club: 'archery', clubN: 3 }) },
      { unitId: 'ena', stats: G({ pierceK: 46, club: 'fencing', clubN: 3 }) },
      { unitId: 'noa', stats: G({ auraPct: 0.2, auraRangeMul: 1.05, club: 'tea', clubN: 3 }) },
      { unitId: 'fuu', stats: G({ pierceK: 30, club: 'taiko', clubN: 3 }) },
    ], hero: { unitId: 'kanna', stats: G({ pierceK: 46, club: 'taiko', clubN: 3 }) } },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: [
      { unitId: 'hana', stats: G({ pierceK: 100, club: 'pyro', clubN: 3 }) },
      { unitId: 'ruri', stats: G({ pierceK: 150, club: 'archery', clubN: 3 }) },
      { unitId: 'aoi', stats: G({ pierceK: 76, club: 'archery', clubN: 3 }) },
    ], hero: { unitId: 'seiran', stats: G({ pierceK: 46, club: 'fencing', clubN: 3 }) } },
  ],
});
const GEAR_GIRLS_UPGRADES = Object.freeze([[0, 'iroha', 0], [0, 'ena', 0], [1, 'hana', 0], [1, 'ruri', 0], [0, 'noa', 0], [0, 'iroha', 1]]);

/**
 * GEAR_GIRLS_START to the end (or 10 minutes): the runPotentialBattle fields plus `iroha` (her shots
 * from the mirror / from where she stands / with gear Pierce, counted on the host's copy as they are
 * fired) and `tricks` (club tricks by girl and kind).
 */
export function runGearGirlsBattle({ maxFrames = 60 * 60 * 10 } = {}) {
  const t0 = Date.now();
  const iroha = { mirror: 0, own: 0, pierced: 0 };
  const tricks = {};
  const probe = (sim) => {
    const shots = sim.projectiles;
    const push0 = shots.push;
    Object.defineProperty(shots, 'push', {
      configurable: true,
      writable: true,
      enumerable: false,
      value: function push(...ps) {
        for (const p of ps) {
          const t = p?.owner;
          if (t?.def?.id !== 'iroha') continue;
          if (p.x === t.ox && p.y === t.oy && (t.ox !== t.x || t.oy !== t.y)) iroha.mirror++;
          else if (p.x === t.x && p.y === t.y) iroha.own++;
          if (p.pierce > p.spec.pierce) iroha.pierced++;
        }
        return push0.apply(this, ps);
      },
    });
    const emit0 = sim._emit;
    Object.defineProperty(sim, '_emit', {
      configurable: true,
      writable: true,
      enumerable: false,
      value: function emit(type, ev, ...rest) {
        if (type === 'clubTrick') {
          const id = sim.towers.find((t) => t.uid === ev?.towerUid)?.def.id || '?';
          tricks[`${id}:${ev.kind}`] = (tricks[`${id}:${ev.kind}`] || 0) + 1;
        }
        return emit0.call(this, type, ev, ...rest);
      },
    });
  };
  const r = runPotentialBattle({ start: GEAR_GIRLS_START, upgrades: GEAR_GIRLS_UPGRADES, spotsFirst: ['iroha', 'ena', 'noa', 'fuu', 'hana', 'ruri', 'aoi'], maxFrames, probe });
  r.iroha = `${iroha.mirror}/${iroha.own}/${iroha.pierced}`;
  r.tricks = Object.keys(tricks).sort().map((k) => `${k}=${tricks[k]}`).join(' ');
  r.ms = Date.now() - t0;
  return r;
}

// ---------------------------------------------------------------------------
// Marumi's Glow Bowl: GLOW_BOWL_START (her ricochet rework, v0.1.41)
// ---------------------------------------------------------------------------

/**
 * Two Marumis in one co-op battle (5-4 Normal, to the end or 10 minutes): the host's on Spin Shot to
 * Glow Bowl (bounces, the finale, Hook Spin onto the other lane), the guest's on Heavy Ball to Bowling
 * Thunder (stun, the push, Wrecking Ball, the blast share), with Aoi and Akane beside them.
 */
const BOWL_STATS = { costMul: 0.15, damageMul: 4, rateMul: 1.3 };
export const GLOW_BOWL_START = Object.freeze({
  seed: 515151,
  stageId: '5-4',
  difficulty: 'normal',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'marumi', stats: BOWL_STATS }, { unitId: 'aoi', stats: BOWL_STATS }], hero: null },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'marumi', stats: BOWL_STATS }, { unitId: 'akane', stats: BOWL_STATS }], hero: null },
  ],
});
const GLOW_BOWL_UPGRADES = Object.freeze([[0, 2], [1, 0], [0, 2], [1, 0], [0, 2], [1, 2], [0, 2], [1, 0], [0, 0], [1, 0], [0, 2], [1, 0], [0, 0]].map(([slot, p]) => [slot, 'marumi', p]));

/**
 * GLOW_BOWL_START to the end (or 10 minutes): the runPotentialBattle fields plus `bowl` (ball pops /
 * bounced pops / Glow Bowl finales / lobs, counted on the host's copy as they happen).
 */
export function runGlowBowlBattle({ maxFrames = 60 * 60 * 10 } = {}) {
  const t0 = Date.now();
  const bowl = { pops: 0, bounced: 0, finales: 0, lobs: 0 };
  const probe = (sim) => {
    const emit0 = sim._emit;
    Object.defineProperty(sim, '_emit', {
      configurable: true,
      writable: true,
      enumerable: false,
      value: function emit(type, ev, ...rest) {
        if (type === 'ballPop') {
          bowl.pops++;
          if (ev.n > 1) bowl.bounced++;
          if (ev.fin) bowl.finales++;
        } else if (type === 'attack' && ev?.kind === 'lob') bowl.lobs++;
        return emit0.call(this, type, ev, ...rest);
      },
    });
  };
  const r = runPotentialBattle({ start: GLOW_BOWL_START, upgrades: GLOW_BOWL_UPGRADES, spotsFirst: ['marumi', 'aoi', 'akane'], maxFrames, probe });
  r.bowl = `${bowl.pops}/${bowl.bounced}/${bowl.finales}/${bowl.lobs}`;
  r.ms = Date.now() - t0;
  return r;
}

// ---------------------------------------------------------------------------
// The duo Kohaku & Tsubaki (docs/specs/DUO_LR.md §4 "Engines scenario DUO_START"): Refraction (the shell counter and
// the fixed shard table), Kohaku's beam on its tick timer, Prismfall on Auto-cast and its LR form Twin Star
// ---------------------------------------------------------------------------

const DUO_STATS = { costMul: 0.12, damageMul: 3, rateMul: 1.2 };
/**
 * The host's duo carries the LR flag (`lr: true`: Prismfall · Twin Star), the guest's is P6 (every 8th volley splits
 * completely) without it; both go Refraction ⚡ to tier 3 (Prismfall) and the host's on to tier 5, the guest's takes
 * Prism Corridor 2 beside it. 2-5 Normal has flyers for the beam and the shards.
 */
export const DUO_START = Object.freeze({
  seed: 545454,
  stageId: '2-5',
  difficulty: 'normal',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'kohaku_tsubaki', stats: { ...DUO_STATS, lr: true } }, { unitId: 'aoi', stats: DUO_STATS }], hero: null },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'kohaku_tsubaki', stats: { ...DUO_STATS, potential: 6 } }, { unitId: 'akane', stats: DUO_STATS }], hero: null },
  ],
});
const DUO_UPGRADES = Object.freeze([
  [0, 'kohaku_tsubaki', 2], [1, 'kohaku_tsubaki', 2], [0, 'kohaku_tsubaki', 2], [1, 'kohaku_tsubaki', 2], [0, 'kohaku_tsubaki', 2],
  [1, 'kohaku_tsubaki', 2], [1, 'kohaku_tsubaki', 1], [1, 'kohaku_tsubaki', 1], [0, 'kohaku_tsubaki', 2], [0, 'kohaku_tsubaki', 2],
]);

/**
 * DUO_START to the end (or 10 minutes): the runPotentialBattle fields plus `duo` (refractions / shards / beams /
 * Prismfall casts / Twin Star shells / mortar aims, counted on the host's copy). Both players switch Auto-cast on;
 * the host aims her duo's mortar at the road once, a little after the first wave starts.
 */
export function runDuoBattle({ maxFrames = 60 * 60 * 10 } = {}) {
  const t0 = Date.now();
  const duo = { refract: 0, shards: 0, beams: 0, casts: 0, twinStar: 0, aims: 0 };
  const probe = (sim) => {
    const emit0 = sim._emit;
    Object.defineProperty(sim, '_emit', {
      configurable: true,
      writable: true,
      enumerable: false,
      value: function emit(type, ev, ...rest) {
        if (type === 'refract') {
          duo.refract++;
          duo.shards += ev.shards;
        } else if (type === 'attack' && ev?.kind === 'beam' && sim.getTower(ev.towerUid)?.def.id === 'kohaku_tsubaki') duo.beams++;
        else if (type === 'ability' && ev?.id === 'kohaku_tsubaki.prismfall') duo.casts++;
        else if (type === 'abilityShell' && ev?.finale) duo.twinStar++;
        return emit0.call(this, type, ev, ...rest);
      },
    });
  };
  let aimed = false;
  const script = (frame, A, B) => {
    if (frame === 21) A.queue('acast', [0, 1]);
    if (frame === 22) B.queue('acast', [0, 1]);
    if (!aimed && frame > 600 && frame % 60 === 0) {
      const t = A.sim.towers.find((x) => x.def.id === 'kohaku_tsubaki' && A.coop.isMine(x.uid));
      const e = t && A.sim.enemies.find((x) => !x.dead && !x.hidden && !x.airborne);
      if (e) {
        A.queue('aim', [t.uid, Math.round(e.x * 1024), Math.round(e.y * 1024)]);
        aimed = true;
        duo.aims++;
      }
    }
  };
  const r = runPotentialBattle({ start: DUO_START, upgrades: DUO_UPGRADES, spotsFirst: ['kohaku_tsubaki', 'aoi', 'akane'], maxFrames, probe, script });
  r.duo = `${duo.refract}/${duo.shards}/${duo.beams}/${duo.casts}/${duo.twinStar}/${duo.aims}`;
  r.ms = Date.now() - t0;
  return r;
}

// The staff heroes (docs/specs/BANNERS.md §D.6 "Each hero wave adds co-op engines scenarios"): Norika's barricades on a
// forked map (2-2, lake_reeds: two roads from one start, so her Detour Sign can switch walkers to the longer one), Hold
// the Line, and Kogane's Clear the Road plow with its push and her Moves (Treads, Overdrive at P6), in one co-op battle.
// Both players buy hero levels with their coins; the host's ult fires through runPotentialBattle, the guest's ult and
// Moves through the script.
const STAFF_STATS = Object.freeze({ costMul: 0.3, damageMul: 2, rateMul: 1.1 });
export const STAFF_START = Object.freeze({
  seed: 565656,
  stageId: '2-2',
  difficulty: 'normal',
  players: [
    { slot: 0, uid: 'host', name: 'Host', loadout: [{ unitId: 'aoi', stats: STAFF_STATS }, { unitId: 'yuki', stats: STAFF_STATS }], hero: { unitId: 'norika', stats: { ...STAFF_STATS, potential: 6 } } },
    { slot: 1, uid: 'guest', name: 'Guest', loadout: [{ unitId: 'rei', stats: STAFF_STATS }, { unitId: 'akane', stats: STAFF_STATS }], hero: { unitId: 'kogane', stats: { ...STAFF_STATS, potential: 6 } } },
  ],
});

/**
 * STAFF_START to the end (or 10 minutes): the runPotentialBattle fields plus `staff` (held walkers, sampled every second /
 * barricade breaks / Hold the Line
 * barricades / One-Way Street sends / detours / plows / Kogane's mid-wave Moves, counted on the host's copy) and
 * `heroLevels` (Norika / Kogane at the end).
 */
export function runStaffBattle({ maxFrames = 60 * 60 * 10 } = {}) {
  const t0 = Date.now();
  const st = { held: 0, breaks: 0, lines: 0, oneWay: 0, detours: 0, plows: 0, moves: 0 };
  let host = null;
  let aimed = false;
  const probe = (sim) => {
    host = sim;
    const emit0 = sim._emit;
    Object.defineProperty(sim, '_emit', {
      configurable: true,
      writable: true,
      enumerable: false,
      value: function emit(type, ev, ...rest) {
        if (type === 'barricadeBreak') st.breaks++;
        else if (type === 'barricade' && ev?.kind === 'line') st.lines++;
        else if (type === 'oneWay') st.oneWay++;
        else if (type === 'detour') st.detours++;
        else if (type === 'runner' && ev?.kind === 'plow') st.plows++;
        else if (type === 'heroMove' && ev?.downtime > 0) st.moves++;
        return emit0.call(this, type, ev, ...rest);
      },
    });
  };
  let home = null;
  const script = (frame, A, B) => {
    // walkers held at her barricades, sampled every second on the host's copy
    if (frame % 60 === 0) for (const e of A.sim.enemies) if (e.heldBy) st.held++;
    // the host aims Norika once, at the shorter road a few tiles past the shared start (Hold the Line lands there)
    const n = A.sim.hero;
    if (n && !aimed && frame === 300) {
      const road = A.sim.pathData[A.sim.pathData.length > 1 ? 1 : 0];
      const p = pointAt(road, Math.min(road.length - 1, 4), {});
      A.queue('aim', [n.uid, Math.round(p.x * 1024), Math.round(p.y * 1024)]);
      aimed = true;
    }
    // both buy a hero level whenever their wallet allows it (one every 2 s)
    if (frame % 120 === 60) {
      for (const c of [A, B]) {
        if (!c.sim.hero) continue;
        const s = c.sim.heroLevelStatus();
        if (!s.reason) c.queue('hlv', [s.level + 1, s.price]);
      }
    }
    const k = B.sim.hero;
    if (!k) return;
    if (frame % 240 === 200 && B.sim.heroUltStatus().ready) B.queue('ult');
    // the guest moves Kogane between her spot and one beside it during the waves
    if (B.sim.state === 'wave' && frame % 900 === 450 && !(k.moveCd > 0)) {
      if (!home) home = { x: k.x, y: k.y };
      const away = k.x === home.x && k.y === home.y;
      for (const [dx, dy] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) {
        const x = away ? home.x + dx : home.x;
        const y = away ? home.y + dy : home.y;
        if (B.sim.canMoveHero(x, y).ok) {
          B.queue('hmv', [Math.round(x * 1024), Math.round(y * 1024)]);
          break;
        }
      }
    }
  };
  const r = runPotentialBattle({ start: STAFF_START, upgrades: [], spotsFirst: ['norika', 'kogane', 'aoi', 'rei'], maxFrames, probe, script, ultInWave: true });
  r.staff = `${st.held}/${st.breaks}/${st.lines}/${st.oneWay}/${st.detours}/${st.plows}/${st.moves}`;
  r.heroLevels = host ? host.heroes.map((h) => h?.level ?? 0).join('/') : '';
  r.ms = Date.now() - t0;
  return r;
}

/**
 * Tryout Day (docs/specs/TRYOUT_DAY.md §15): one 2-player co-op run on two lockstep views (tools/tryoutBot.mjs runCoop: personal
 * picks, a Tryout join, Hall Pass moves at Recess, Snack, the seats), a third client rejoining from the wave-9 checkpoint
 * after a mid-run join, to wave 16. Every engine must reach the same digests and hashes.
 */
export function runTryoutBattle({ maxWaves = 16, checkpointAt = 9 } = {}) {
  const { views, digests, hashes } = runTryoutCoop({ start: tryoutStart({ seed: 2026 }), policy: 'random', maxWaves, checkpointAt });
  const sim = views[0].sim;
  return {
    wave: sim.wave, lives: sim.lives, score: sim.tryout.score, squads: sim.tryout.players.map((p) => p.squad.join(',')),
    lastDigest: digests[0][digests[0].length - 1], digests: digests[0].length, sameViews: JSON.stringify(digests[0]) === JSON.stringify(digests[1]),
    hash: hashes[0][hashes[0].length - 1],
  };
}

/** Everything e2e/engines.mjs compares between engines: the campaign co-op battle, Potential (1-3 and the spectral boss), gear (live and returning girls), Marumi's Glow Bowl, the duo (DUO_START), the staff heroes (STAFF_START), freeplay (scripted and deep), two heroes, drones, the returning girls, abilities, the returning girls' abilities, Tenka, Tryout Day and the mode battles. */
export function runEngineChecks() {
  const r = runScriptedBattle();
  const t1 = Date.now();
  const potential = runPotentialBattle();
  potential.ms = Date.now() - t1;
  const potentialBoss = runPotentialBossBattle();
  const t0 = Date.now();
  const tables = freeplayTables();
  const battle = runFreeplayBattle();
  const deep = runDeepFreeplay();
  const freeplayMs = Date.now() - t0;
  const heroes = runHeroBattle();
  const modes = runModeBattles();
  return { ...r, potential, potentialBoss, gear: runGearBattle(), gearGirls: runGearGirlsBattle(), glowBowl: runGlowBowlBattle(), duo: runDuoBattle(), staff: runStaffBattle(), freeplay: { tables, battle, deep, ms: freeplayMs }, heroes, drones: runDronesBattle(), roster: runRosterBattle(), abilities: runAbilitiesBattle(), returningAbil: runReturningAbilBattle(), tenka: runTenkaBattle(), tryout: runTryoutBattle(), modes };
}

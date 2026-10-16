// Battle save snapshot (src/ui/battle/snapshot.js): a wave-start snapshot round-trips through
// JSON into an identical calm state, a restored battle plays on exactly like the original (same
// per-wave random streams, same commands → same end), stale saves are refused or refunded, and
// guards fail as soon as the Sim grows state the snapshot does not classify.
//
// The driver plays like the battle controller: random 7–45 ms frames at speeds 1/2/3, autoPlan
// placements and upgrades, target changes, the ult, hero level buys and Moves, a sell, manual waves
// and then auto-start, with sim.startNextWave wrapped on the instance (the controller's
// battleSaver does the same). The checkpoint digest reads sim.heroes, never the view getter
// sim.hero: an auto-start snapshot is taken inside the step, where the view trap throws.
// Chika rework (M6): her roaming drones fly through every flight mode (the `fly` command:
// Hover, Hold, Patrol, Pursuit), so the checkpoints catch drones flying home, jammed or far out.
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP } from '../../src/sim/constants.js';
import { autoPlan } from '../../src/sim/headless.js';
import { createRng } from '../../src/core/rng.js';
import { TARGET_MODES } from '../../src/data/types.js';
import { STAGE_MAP } from '../../src/data/stages.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { coopStage } from '../../src/data/coop.js';
import { unitBattleStats } from '../../src/systems/progression.js';
import { RECORD_V, SNAP_V, SNAP_V_P1, slotKey } from '../../src/systems/battleSave.js';
import { xpToReach } from '../../src/sim/hero.js';
import { FLIGHT_MODES } from '../../src/sim/constants.js';
import {
  snapshotSim, restoreSim, useWaveStream, StaleSaveError, KNOWN_SIM_KEYS, KNOWN_TOWER_KEYS, KNOWN_DRONE_KEYS,
} from '../../src/ui/battle/snapshot.js';

const SCEN = {
  '3-5 normal': { stageId: '3-5', difficulty: 'normal', towers: ['aoi', 'rei', 'akane', 'sango', 'umeko', 'kaede'], hero: 'hikari', stats: { damageMul: 1.6, rateMul: 1.1 }, seed: 12345, forks: [6, 15] },
  '8-5 hard (drones)': { stageId: '8-5', difficulty: 'hard', towers: ['aoi', 'rei', 'akane', 'sango', 'umeko', 'kaede', 'hotaru', 'chika'], hero: 'luna', stats: { damageMul: 4, rateMul: 1.3 }, seed: 777, forks: [9, 20] },
  '4-5 normal (traps, drones)': { stageId: '4-5', difficulty: 'normal', towers: ['suzu', 'aoi', 'rei', 'akane', 'chika'], hero: 'hikari', stats: { damageMul: 2.5, rateMul: 1.2 }, seed: 99, forks: [5, 12] },
  // battle modes + map rules: Reverse Route on Rear Ambush (the route turns every wave: `rr`), and
  // Ironclad on crystal pads (pads follow the girls, the hero's Moves included)
  '4-2 hard reverse (Rear Ambush)': { stageId: '4-2', difficulty: 'hard', mode: 'reverse', towers: ['aoi', 'rei', 'akane', 'kaede', 'chika'], hero: 'hikari', stats: { damageMul: 3, rateMul: 1.2 }, seed: 4202, forks: [5, 8] },
  '6-1 normal ironclad (pads)': { stageId: '6-1', difficulty: 'normal', mode: 'ironclad', towers: ['aoi', 'rei', 'akane', 'sango', 'yuki'], hero: 'luna', stats: { damageMul: 3, rateMul: 1.2 }, seed: 6102, forks: [4, 9] },
  'colosseum to wave 30': { stageId: 'challenge', difficulty: 'normal', endless: true, towers: ['aoi', 'rei', 'akane', 'sango', 'umeko', 'kaede', 'hotaru', 'chika'], hero: 'hikari', stats: { damageMul: 6, rateMul: 1.4 }, seed: 4242, maxCopies: 4, maxWave: 30, forks: [10, 22] },
  // Potential v3 (format 3): every girl at P6, so rhythms, echoes, tempo, the shuriken carry, a kept
  // focus, aura boosts and drone overclocks run (and their counters cross the calm points)
  '3-5 hard (Potential P6)': { stageId: '3-5', difficulty: 'hard', towers: ['kage', 'rei', 'kaede', 'suzu', 'chika', 'akane', 'miko', 'hotaru'], hero: 'luna', stats: { damageMul: 1.6, rateMul: 1.2, potential: 6 }, seed: 3506, forks: [6, 14] },
};

/** The frozen team of a scenario, as createBattleSim builds it (full unitBattleStats + boosts). */
const team = (c) => ({
  loadout: c.towers.map((unitId) => ({ unitId, stats: { ...unitBattleStats(null, unitId), ...c.stats } })),
  hero: c.hero ? { unitId: c.hero, stats: { ...unitBattleStats(null, c.hero), ...c.stats } } : null,
});
const makeSim = (c) => new Sim({ stageId: c.stageId, difficulty: c.difficulty, ...team(c), seed: c.seed, options: { endless: !!c.endless, autoStart: false, mode: c.mode } });
const recordOf = (c, snap) => ({
  v: RECORD_V, id: 'bs-test', slot: slotKey(c.stageId, !!c.endless), stageId: c.stageId, endless: !!c.endless,
  difficulty: c.difficulty, ...(c.mode ? { mode: c.mode } : {}), seed: c.seed, ...team(c), createdAt: 1, updatedAt: 1, resumes: 0, snap,
});

/** Applies one command exactly like the solo ctx.act / ctx.* handlers. */
function exec(sim, k, a) {
  switch (k) {
    case 'place': return !!sim.placeTower(a[0], a[1], a[2]);
    case 'upg': return sim.upgradeTower(a[0], a[1]);
    case 'sell': return sim.sellTower(a[0]) > 0;
    case 'tgt': return sim.setTargetMode(a[0], a[1]);
    case 'ult': return !!sim.activateUlt();
    case 'hlv': return sim.buyHeroLevel().ok;
    case 'hmv': return sim.moveHero(a[0], a[1]).ok;
    case 'fly': return sim.setFlight(a[0], a[1], a[2], a[3], a[4], a[5]);
    case 'wave': return sim.startNextWave();
    case 'auto':
      sim.options.autoStart = !!a[0];
      if (a[0] && sim.state === 'between') sim.startNextWave();
      return true;
    default: return false;
  }
}

const plain = (v) => {
  if (v instanceof Set) return [...v].sort();
  if (v instanceof Map) return [...v.entries()];
  return v === undefined ? null : JSON.parse(JSON.stringify(v));
};
// references and per-step scratch (the round trip compares state, not identity)
// (own functions are the test's and the controller's instance wrappers: _step, startNextWave)
// (heroes: tower references, compared below by uid; _stepping is true for a snapshot taken inside the step)
const SIM_SKIP = new Set(['data', 'stage', 'map', 'diff', 'options', 'pathData', 'paths', 'pathTiles', 'placement', 'loadout', 'heroConfigs', '_heroConfig', 'grid',
  'rng', '_statusCtx', 'events', '_waveCache', '_scratch', '_scratch2', '_hitOut', '_dotOut', '_capSources', '_towerByUid', 'heroes', 'towers', 'traps',
  'enemies', 'projectiles', 'fields', '_acc', '_stepping']);
// a calm point resets these anyway (startNextWave overwrites the spawn cursor and timers)
// (_waveTick: a map rule's step clock, restarted at every wave start)
const CALM_SKIP = new Set(['_autoTimer', '_spawnQueue', '_spawnIndex', '_waveTime', '_waveHpMul', '_buffTimer', '_buffsDirty', '_waveTick']);
// derived per-tower references / caches, and the harmless stale target memory of a calm point
// (_pool / _poolS: a roaming wing's per-step target pool, enemy references)
const TOWER_SKIP = new Set(['def', 'targetUid', 'rampTarget', 'rampStacks', 'trapSpots', 'trapSpotsRange', '_pool', '_poolS']);
// reset at a calm point: the pool's reuse counter (moot with no enemy alive)
const TOWER_CALM_SKIP = new Set(['_poolLeft', '_poolMode']);
// map-rule fields a girl only carries once a pad or the rule's range touched her: absent = neutral
// (src/sim/rules.js, towers.js), so a girl who had them and is back to neutral equals one who never had them
const TOWER_NEUTRAL = { padIndex: -1, onPad: false, padMul: 1, padRangeAdd: 0, envRangeMul: 1, envRangeAdd: 0 };
// a roaming drone at a calm point: its quarry, motion flag and position one step earlier are reset
const DRONE_CALM_SKIP = new Set(Object.keys(KNOWN_DRONE_KEYS).filter((k) => KNOWN_DRONE_KEYS[k] === 'calm'));
/** A tower's drones for a digest (a drone's quarry is an enemy: compared by uid). */
const dronesOf = (t, calm) => t.turrets.map((d) => {
  const o = {};
  for (const k of Object.keys(d)) if (!(calm && DRONE_CALM_SKIP.has(k))) o[k] = k === 'tgt' ? d.tgt?.uid ?? null : plain(d[k]);
  return o;
});

/**
 * stats.leakLog as the debrief reads it: counts per (wave, enemy, lives) in first-seen order (a
 * snapshot keeps it grouped that way; the entries' unread `time` is not kept).
 */
function leakDigest(log) {
  const m = new Map();
  for (const l of log || []) {
    const k = `${l.wave}|${l.enemyId}|${l.lives}`;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()];
}

/** Generic digest: every own Sim field (minus references / scratch) and every JSON-able tower field. */
function digest(sim, { calm = false } = {}) {
  const out = {};
  for (const k of Object.keys(sim)) if (!SIM_SKIP.has(k) && !(calm && CALM_SKIP.has(k)) && typeof sim[k] !== 'function') out[k] = plain(sim[k]);
  if (out.stats) out.stats.leakLog = leakDigest(out.stats.leakLog);
  out.towers = sim.towers.map((t) => {
    const o = {};
    for (const k of Object.keys(t)) if (!TOWER_SKIP.has(k) && !(calm && TOWER_CALM_SKIP.has(k))) o[k] = plain(t[k]);
    if (sim.rule) for (const [k, v] of Object.entries(TOWER_NEUTRAL)) o[k] = t[k] ?? v;
    o.turrets = dronesOf(t, calm);
    return o;
  });
  out.traps = sim.traps.map(({ owner, ...tr }) => ({ ...tr, owner: owner?.uid ?? null }));
  out.enemies = sim.enemies.map((e) => ({ uid: e.uid, id: e.id, x: e.x, y: e.y, hp: e.hp, dist: e.dist, barrier: e.barrier }));
  out.projectiles = sim.projectiles.length;
  out.fields = sim.fields.length;
  out.heroes = sim.heroes.map((h) => h?.uid ?? null);
  return out;
}

/** First differing leaf paths of two digests. */
function diffPaths(a, b, path = '', out = [], n = 20) {
  if (out.length >= n) return out;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    if (!Object.is(a, b)) out.push(`${path}: ${JSON.stringify(a)?.slice(0, 60)} vs ${JSON.stringify(b)?.slice(0, 60)}`);
    return out;
  }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diffPaths(a[k], b[k], `${path}.${k}`, out, n);
  return out;
}

/** Wraps startNextWave like the battle controller: snapshot at the calm point, then the wave's stream. */
function wrapWaves(sim, seed, onCalm) {
  const original = sim.startNextWave.bind(sim);
  sim.startNextWave = () => {
    if (sim.state !== 'prep' && sim.state !== 'between') return original();
    onCalm?.();
    useWaveStream(sim, seed, sim.wave + 1);
    return original();
  };
}

const STOP = Symbol('stop');

/**
 * Plays a scenario like the controller. Logs every command with the Sim step it followed, takes
 * a checkpoint (snapshot JSON + digest) at every wave start, and can stop at the start of wave
 * `stopAt` (the Sim is left at that calm point, before the wave starts).
 */
function play(c, { stopAt = Infinity } = {}) {
  const sim = makeSim(c);
  let steps = 0;
  const step0 = sim._step;
  sim._step = function step(dt) {
    steps++;
    return step0.call(this, dt);
  };
  const log = [];
  const cps = [];
  let inCmd = null;
  let autoStarts = 0;
  let armed = true;
  wrapWaves(sim, c.seed, () => {
    if (armed && sim.wave + 1 === stopAt) {
      armed = false;
      throw STOP;
    }
    if (!inCmd) autoStarts++;
    const json = JSON.stringify(snapshotSim(sim));
    cps.push({ wave: sim.wave, json, digest: digest(sim, { calm: true }), t: steps, cmd: log.length, manual: inCmd === 'wave', autoStart: sim.options.autoStart, proj: sim.projectiles.length });
  });
  const plan = autoPlan(c.stageId, [...c.towers, c.hero].filter(Boolean), { maxCopies: c.maxCopies ?? 3 });
  const fr = createRng((c.seed ^ 0x9e3779b9) >>> 0);
  const modes = Object.keys(TARGET_MODES);
  const issue = (k, ...a) => {
    inCmd = k;
    try {
      exec(sim, k, a);
    } finally {
      inCmd = null;
    }
    log.push({ t: steps, k, a });
  };
  let speed = 1;
  let wait = 0;
  let pi = 0;
  let autoOn = false;
  let sold = false;
  const maxWave = c.maxWave ?? Infinity;
  try {
    while (sim.state !== 'won' && sim.state !== 'lost' && sim.wave <= maxWave) {
      const dt = Math.min(0.1, fr.range(0.007, 0.045));
      if (fr.chance(0.003)) speed = [1, 2, 3][fr.int(0, 2)];
      sim.update(dt * speed);
      sim.drainEvents();
      while (pi < plan.length) {
        const p = plan[pi];
        if ((p.at ?? 1) > sim.wave + 1) break;
        if (p.action === 'place') {
          if (sim.canPlace(p.unitId, p.x, p.y).reason === 'cash') break;
          issue('place', p.unitId, p.x, p.y);
          pi++;
        } else if (p.action === 'upgrade') {
          const t = sim.towerAt(p.x, p.y);
          if (!t) {
            pi++;
            continue;
          }
          if (sim.upgradeStatus(t.uid, p.path ?? 0).reason === 'cash') break;
          issue('upg', t.uid, p.path ?? 0);
          pi++;
        } else pi++;
      }
      if (fr.chance(0.002) && sim.towers.length) issue('tgt', sim.towers[fr.int(0, sim.towers.length - 1)].uid, modes[fr.int(0, modes.length - 1)]);
      if (sim.hero && sim.heroUltStatus().ready && fr.chance(0.03)) issue('ult');
      // hero rework: buy her next level now and then, and Move her (between waves: free; in a wave:
      // a pause and a cooldown) to a free spot a tile or two away
      if (sim.hero && !sim.heroLevelStatus().reason && fr.chance(0.004)) issue('hlv');
      if (sim.hero && fr.chance(0.002)) {
        const h = sim.hero;
        const [dx, dy] = [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5], [2, 1], [-2, -1]][fr.int(0, 5)];
        if (sim.canMoveHero(h.x + dx, h.y + dy).ok) issue('hmv', h.x + dx, h.y + dy);
      }
      // Chika's wing: now and then a new flight mode (Hold / Patrol points a few tiles from her)
      if (fr.chance(0.004)) {
        const ch = sim.towers.find((t) => t.turretSpec?.leash > 0);
        if (ch) {
          const mode = FLIGHT_MODES[fr.int(0, FLIGHT_MODES.length - 1)];
          const pt = () => [ch.x + fr.range(-3, 3), ch.y + fr.range(-3, 3)];
          const [ax, ay] = pt();
          const [bx, by] = pt();
          issue('fly', ch.uid, mode, ax, ay, bx, by);
        }
      }
      if (!sold && sim.wave === 6 && sim.state === 'between' && sim.towers.length > 3) {
        sold = true;
        issue('sell', sim.towers[sim.towers.length - 1].uid);
      }
      // (a wave can end with shots still flying at the last enemy's spot; this player taps Start, or
      // turns Auto on, once they have landed: the calm point the snapshot is defined for)
      if (!autoOn && sim.wave >= 4 && sim.state === 'between' && !sim.projectiles.length) {
        issue('auto', true);
        autoOn = true;
      }
      if ((sim.state === 'prep' || sim.state === 'between') && !sim.options.autoStart && ++wait > 25 && !sim.projectiles.length) {
        wait = 0;
        issue('wave');
      }
    }
  } catch (e) {
    if (e !== STOP) throw e;
    return { sim, log, cps, steps, stopped: true, autoStarts };
  }
  return { sim, log, cps, steps, stopped: false, autoStarts };
}

/** Plays on with no input in fixed 1/60 steps, starting each wave at once, until the end (or wave `until`). */
function autoplay(sim, until = Infinity) {
  let guard = 0;
  while (sim.state !== 'won' && sim.state !== 'lost' && guard++ < 5e6) {
    if (sim.state === 'prep' || sim.state === 'between') {
      if (sim.wave >= until) break;
      sim.startNextWave();
    }
    sim.update(STEP);
    if ((guard & 63) === 0) sim.drainEvents();
  }
  sim.drainEvents();
}

// full battles played in Node: slow on a loaded machine
const SLOW = { timeout: 600000 };

const runs = new Map();
/** The uninterrupted run of a scenario (shared by the tests below). */
const fullRun = (name) => {
  if (!runs.has(name)) runs.set(name, play(SCEN[name]));
  return runs.get(name);
};

describe('battle save snapshot', SLOW, () => {
  for (const [name, c] of Object.entries(SCEN)) {
    describe(name, () => {
      it('round-trips at every wave start: same calm state, identical re-snapshot, under 8 KB', () => {
        const run = fullRun(name);
        expect(run.cps.length).toBeGreaterThan(5);
        let drones = 0;
        let traps = 0;
        const rrs = new Set();
        for (const cp of run.cps) {
          expect(cp.proj, `wave ${cp.wave}: shots in flight at a calm point`).toBe(0);
          expect(cp.json.length, `wave ${cp.wave} snapshot size`).toBeLessThan(8 * 1024);
          const snap = JSON.parse(cp.json);
          drones += snap.towers.reduce((a, t) => a + (t.dr?.length || 0), 0);
          traps += snap.towers.reduce((a, t) => a + (t.tr?.length || 0), 0);
          if (snap.rr != null) rrs.add(snap.rr);
          const { sim, dropped, refunded } = restoreSim(recordOf(c, snap), { settings: { autoStart: cp.autoStart } });
          expect(dropped).toEqual([]);
          expect(refunded).toBe(0);
          expect(diffPaths(cp.digest, digest(sim, { calm: true })), `wave ${cp.wave}`).toEqual([]);
          expect(JSON.stringify(snapshotSim(sim)), `wave ${cp.wave} re-snapshot`).toBe(cp.json);
          expect(sim.drainEvents()).toEqual([]);
          expect(sim.seed).toBe(c.seed);
        }
        if (name.includes('drones')) expect(drones).toBeGreaterThan(0);
        if (name.includes('traps')) expect(traps).toBeGreaterThan(0);
        // battle modes + map rules: the route turned both ways between checkpoints; a girl held a pad
        if (name.includes('Rear Ambush')) expect([...rrs].sort()).toEqual([0, 1]);
        else expect(rrs.size).toBe(0); // (no other scenario has a route that turns: no `rr` in its snapshots)
        if (name.includes('pads')) expect(run.sim.towers.some((t) => t.onPad)).toBe(true);
      });

      it('the wrapper sees auto-starts inside Sim._step', () => {
        expect(fullRun(name).autoStarts).toBeGreaterThan(0);
      });

      for (const K of c.forks) {
        it(`same future after a restore at the start of wave ${K}`, () => {
          const run = play(c, { stopAt: K });
          expect(run.stopped).toBe(true);
          const orig = run.sim;
          const { sim: rest } = restoreSim(recordOf(c, JSON.parse(JSON.stringify(snapshotSim(orig)))), { settings: { autoStart: orig.options.autoStart } });
          wrapWaves(rest, c.seed);
          const until = c.endless ? K + 5 : Infinity;
          autoplay(orig, until);
          autoplay(rest, until);
          expect(diffPaths(digest(orig), digest(rest))).toEqual([]);
          expect(hashSim(rest)).toBe(hashSim(orig));
          expect(rest.state).toBe(orig.state);
        });

        it(`same future with the same commands after Continue at wave ${K}`, () => {
          const run = fullRun(name);
          const cp = run.cps.find((x) => x.wave === K - 1);
          expect(cp, `checkpoint before wave ${K}`).toBeTruthy();
          const { sim } = restoreSim(recordOf(c, JSON.parse(cp.json)), { settings: { autoStart: cp.autoStart } });
          wrapWaves(sim, c.seed);
          let steps = cp.t;
          const step0 = sim._step;
          sim._step = function step(dt) {
            steps++;
            return step0.call(this, dt);
          };
          // Continue lands between waves; the player taps Start (the wave the save was taken at)
          expect(sim.startNextWave()).toBe(true);
          const rest = run.log.slice(cp.manual ? cp.cmd + 1 : cp.cmd);
          for (const cmd of rest) {
            while (steps < cmd.t) sim.update(STEP);
            exec(sim, cmd.k, cmd.a);
          }
          while (steps < run.steps && sim.state !== 'won' && sim.state !== 'lost') sim.update(STEP);
          sim.drainEvents();
          expect(steps).toBe(run.steps);
          expect(diffPaths(digest(run.sim), digest(sim))).toEqual([]);
          expect(hashSim(sim)).toBe(hashSim(run.sim));
        });
      }
    });
  }
});

describe('battle save restore: stale saves and refunds', SLOW, () => {
  const c = SCEN['3-5 normal'];
  const cpAt = (wave) => JSON.parse(fullRun('3-5 normal').cps.find((x) => x.wave === wave).json);

  it('refunds a girl who cannot return (unit not in the team, unreachable tiers) and keeps the others', () => {
    const snap = cpAt(10);
    expect(snap.towers.length).toBeGreaterThan(3);
    const [a, b] = snap.towers.filter((t) => !t.xp);
    const rec = recordOf(c, snap);
    rec.loadout = rec.loadout.filter((e) => e.unitId !== a.u); // her unit is gone after an update (every copy of her)
    b.tiers = [5, 5, 0];
    const lost = snap.towers.filter((t) => t.u === a.u || t === b);
    const { sim, refunded, dropped } = restoreSim(rec);
    expect(dropped.sort()).toEqual(lost.map((t) => t.u).sort());
    expect(refunded).toBe(lost.reduce((s, t) => s + t.spent, 0));
    expect(sim.cash).toBe(snap.cash + refunded);
    expect(sim.towers.map((t) => t.uid)).toEqual(snap.towers.filter((t) => !lost.includes(t)).map((t) => t.uid));
    for (const t of sim.towers) {
      const o = snap.towers.find((x) => x.uid === t.uid);
      expect(t.tiers).toEqual(o.tiers);
      expect(t.spent).toBe(o.spent);
    }
  });

  it('refuses a wave past the end, an unknown stage and a newer format', () => {
    const snap = cpAt(4);
    expect(() => restoreSim(recordOf(c, { ...snap, wave: STAGE_MAP['3-5'].waves }))).toThrow(StaleSaveError);
    expect(() => restoreSim({ ...recordOf(c, snap), stageId: 'gone-9' })).toThrow(StaleSaveError);
    expect(() => restoreSim({ ...recordOf(c, snap), v: RECORD_V + 1 })).toThrow(StaleSaveError);
    expect(() => restoreSim(recordOf(c, { ...snap, v: 99 }))).toThrow(StaleSaveError);
  });

  it('a frozen stats object missing a key (added by a later build) gets the neutral value', () => {
    const snap = cpAt(4);
    const rec = recordOf(c, snap);
    // critMul, and potential (Potential M1, landing plan §8): a record frozen before Potential restores her at P1
    for (const e of [...rec.loadout, rec.hero]) {
      delete e.stats.critMul;
      delete e.stats.potential;
    }
    const { sim } = restoreSim(rec);
    const ref = restoreSim(recordOf(c, cpAt(4))).sim;
    for (const t of sim.towers) {
      expect(t.unitStats.critMul).toBe(1);
      expect(t.unitStats.potential).toBe(1);
      expect(t.unitStats.damageMul).toBe(c.stats.damageMul);
      // P1 = no Potential: the same resolved stats as the record that carries potential: 1
      expect(t.stats).toEqual(ref.towers.find((x) => x.uid === t.uid).stats);
    }
  });

  it('Potential travels in the frozen stats: a girl saved at P6 comes back at P6', () => {
    const snap = cpAt(4);
    const rec = recordOf(c, snap);
    const aoi = rec.loadout.find((e) => e.unitId === 'aoi');
    aoi.stats = { ...aoi.stats, potential: 6 };
    const { sim } = restoreSim(rec);
    const ref = restoreSim(recordOf(c, cpAt(4))).sim;
    const mine = sim.towers.filter((t) => t.def.id === 'aoi');
    expect(mine.length).toBeGreaterThan(0);
    for (const t of mine) {
      const p1 = ref.towers.find((x) => x.uid === t.uid);
      expect(t.unitStats.potential).toBe(6);
      // Aoi's v3 ladder: damage ×1.04×1.04×1.05, +6 % crit, her rhythm
      expect(t.stats.damage).toBeCloseTo(p1.stats.damage * 1.04 * 1.04 * 1.05, 9);
      expect(t.stats.crit.chance).toBeCloseTo(p1.stats.crit.chance + 0.06, 9);
      expect(t.stats.proc?.name).toBe('Twin Fletch');
    }
    for (const t of sim.towers.filter((x) => x.def.id !== 'aoi')) expect(t.stats).toEqual(ref.towers.find((x) => x.uid === t.uid).stats);
  });

  it('a save from before Potential v3 with a girl at P2+ says so on Continue (potentialNew); none otherwise', () => {
    const at = (v, pot) => {
      const snap = cpAt(4);
      snap.v = v;
      const rec = recordOf(c, snap);
      const aoi = rec.loadout.find((e) => e.unitId === 'aoi');
      aoi.stats = { ...aoi.stats, potential: pot };
      return restoreSim(rec).potentialNew;
    };
    expect(at(2, 4)).toBe(true);
    expect(at(SNAP_V, 4)).toBe(false); // saved by a v3 build: her steps were already the v3 ones
    expect(at(2, 1)).toBe(false); // nobody at P2+: nothing changed for this run
  });

  it('a long endless run with hundreds of leaks stays small and keeps the defeat debrief exact', () => {
    const col = SCEN['colosseum to wave 30'];
    const cp = fullRun('colosseum to wave 30').cps.at(-1);
    const { sim } = restoreSim(recordOf(col, JSON.parse(cp.json)));
    // a 120-wave Colosseum run that leaked every wave: ~1000 leaks of six kinds, a boss among them
    const kinds = ['slime_green', 'goblin_scout', 'ghost_wisp', 'orc_brute', 'beast_wolf', 'oni_red'].filter((id) => sim.data.enemy(id));
    const boss = Object.keys(sim.kills).find((id) => sim.data.enemy(id)?.tier === 'boss') || kinds[0];
    sim.stats.leakLog = [];
    for (let w = 1; w <= 120; w++) {
      for (let i = 0; i < 8; i++) sim.stats.leakLog.push({ wave: w, enemyId: kinds[(w + i) % kinds.length], lives: 1 + (i % 2), time: w * 61.123456789 + i });
      if (w % 10 === 0) sim.stats.leakLog.push({ wave: w, enemyId: boss, lives: 25, time: w * 61.5 });
    }
    sim.stats.leaks = sim.stats.leakLog.reduce((a, l) => a + l.lives, 0);
    const json = JSON.stringify(snapshotSim(sim));
    expect(json.length, 'snapshot size').toBeLessThan(8 * 1024);
    // the newest groups are the ones kept; a short run keeps them all, so its debrief is the same
    const recent = sim.stats.leakLog.filter((l) => l.wave > 100);
    sim.stats.leakLog = recent;
    sim.stats.leaks = recent.reduce((a, l) => a + l.lives, 0);
    const { sim: back } = restoreSim(recordOf(col, JSON.parse(JSON.stringify(snapshotSim(sim)))));
    expect(leakDigest(back.stats.leakLog)).toEqual(leakDigest(recent));
    expect(back.debrief().lines).toEqual(sim.debrief().lines);
    expect(back.debrief().leaks).toEqual(sim.debrief().leaks);
  });

  it('restores the hero: XP, level, ult unlock and cooldown, with no events left over', () => {
    const run = fullRun('3-5 normal');
    const cp = [...run.cps].reverse().find((x) => JSON.parse(x.json).towers.some((t) => t.ultOn));
    expect(cp, 'a checkpoint with the ult unlocked').toBeTruthy();
    const snap = JSON.parse(cp.json);
    const h = snap.towers.find((t) => t.xp != null);
    const { sim } = restoreSim(recordOf(c, snap));
    expect(sim.hero).toBeTruthy();
    expect(sim.hero.uid).toBe(h.uid);
    expect(sim.hero.xp).toBe(h.xp);
    expect(sim.hero.level).toBe(h.lvl);
    expect(sim.hero.level).toBeGreaterThan(1);
    expect(sim.hero.ultUnlocked).toBe(true);
    expect(sim.hero.ultCooldown).toBe(h.ult);
    expect(sim.hero.spent).toBe(0);
    expect(sim.hero.levelSpent).toBe(h.ls);
    expect(sim.hero.levelsBought).toBe(h.lb);
    expect(sim.hero.moveCd).toBe(h.mc);
    expect(sim.drainEvents()).toEqual([]);
  });

  it('the scenarios bought hero levels and moved her (so the round trips above cover it)', () => {
    let bought = 0;
    let moved = 0;
    for (const name of Object.keys(SCEN)) {
      const run = fullRun(name);
      bought += run.log.filter((x) => x.k === 'hlv').length;
      moved += run.log.filter((x) => x.k === 'hmv').length;
    }
    expect(bought).toBeGreaterThan(0);
    expect(moved).toBeGreaterThan(0);
    const snaps = Object.keys(SCEN).flatMap((name) => fullRun(name).cps.map((cp) => JSON.parse(cp.json)));
    const heroes = snaps.flatMap((sn) => sn.towers.filter((t) => t.xp != null));
    expect(heroes.some((t) => t.lb > 0 && t.ls > 0)).toBe(true);
    for (const t of heroes) expect(t.tiers).toEqual([0, 0, 0]);
  });

  it('a hero is never sold to undo a restore, and a hero who cannot return refunds her bought levels', () => {
    const snap = cpAt(10);
    const h = snap.towers.find((t) => t.xp != null);
    expect(h).toBeTruthy();
    h.ls = 500;
    // her old tiers in an edited save are ignored (heroes have none): she comes back
    h.tiers = [5, 5, 5];
    const back = restoreSim(recordOf(c, JSON.parse(JSON.stringify(snap))));
    expect(back.dropped).toEqual([]);
    expect(back.sim.hero?.uid).toBe(h.uid);
    expect(back.sim.hero.tiers).toEqual([0, 0, 0]);
    // her unit is gone from the team after an update: dropped, the coins of her levels come back
    const rec = recordOf(c, JSON.parse(JSON.stringify(snap)));
    rec.hero = null;
    const { sim, dropped, refunded } = restoreSim(rec);
    expect(dropped).toEqual([h.u]);
    expect(refunded).toBe(500);
    expect(sim.cash).toBe(snap.cash + 500);
    expect(sim.hero).toBe(null);
  });

  it(`a format-1 save (before the hero rework): her old level, tiers ignored, never dropped, all she cost refunded (now ${SNAP_V})`, () => {
    expect(SNAP_V).toBe(3); // 3: Potential v3 (a format-2 save restores the same way, its heroes on the new track)
    const snap = cpAt(10);
    snap.v = 1;
    const h = snap.towers.find((t) => t.xp != null);
    // an old-scale Lv 7 hero (XP 1 per HP) with tiers 2/1/0 bought, 1,240 coins in her, ult charging
    Object.assign(h, { lvl: 7, xp: 2480, tiers: [2, 1, 0], spent: 1240, ultOn: true, ult: 12.5 });
    for (const k of ['ls', 'lb', 'mc', 'ml']) delete h[k];
    const { sim, dropped, refunded, heroes } = restoreSim(recordOf(c, snap));
    expect(dropped).toEqual([]);
    expect(refunded).toBe(1240);
    expect(heroes).toEqual([{ unitId: h.u, level: 7, refunded: 1240 }]);
    expect(sim.cash).toBe(snap.cash + 1240);
    const hero = sim.hero;
    expect(hero.uid).toBe(h.uid);
    expect([hero.x, hero.y]).toEqual([h.x, h.y]);
    expect(hero.level).toBe(7);
    expect(hero.xp).toBe(xpToReach(hero.def.hero, 7));
    expect(hero.tiers).toEqual([0, 0, 0]);
    expect(hero.spent).toBe(0);
    expect(hero.levelSpent).toBe(0);
    expect(hero.ultUnlocked).toBe(true);
    expect(hero.ultCooldown).toBe(12.5);
    expect(sim.drainEvents()).toEqual([]);
    // the others come back exactly as saved
    for (const t of sim.towers.filter((x) => !x.isHero)) expect(t.spent).toBe(snap.towers.find((x) => x.uid === t.uid).spent);
    // and the next snapshot is the current format for an all-P1 team (format 2: see below)
    expect(snapshotSim(sim).v).toBe(SNAP_V_P1);
  });

  it('an all-P1 run is written as format 2, which a build from before Potential v3 continues; a girl at P2+ makes it format 3', () => {
    // v0.1.35's rule (its battleSave.js cleanRecord): a snapshot newer than its SNAP_V 2 is dropped on load
    const keptByOlderBuild = (snap) => snap.v <= 2;
    const fresh = (edit = () => {}) => {
      const rec = recordOf(c, cpAt(4));
      edit(rec);
      return JSON.parse(JSON.stringify(snapshotSim(restoreSim(rec).sim)));
    };
    const p1 = fresh();
    expect([SNAP_V_P1, p1.v, keptByOlderBuild(p1)]).toEqual([2, 2, true]);
    // and this build continues its own format-2 save exactly as it was
    const again = restoreSim(recordOf(c, p1)).sim;
    expect(JSON.stringify(snapshotSim(again))).toBe(JSON.stringify(p1));
    // a girl at P2+ in the loadout (placed or not) or as the hero: format 3, which an older build drops
    const p2 = fresh((rec) => { rec.loadout.find((e) => e.unitId === 'kaede').stats.potential = 2; });
    expect([p2.v, keptByOlderBuild(p2)]).toEqual([SNAP_V, false]);
    expect(fresh((rec) => { rec.hero.stats.potential = 3; }).v).toBe(SNAP_V);
    expect(fresh((rec) => { rec.loadout.forEach((e) => { e.stats.potential = 1; }); }).v).toBe(SNAP_V_P1);
  });
});

describe('battle save: Chika\'s roaming drones and flight modes (Chika rework M6)', SLOW, () => {
  const name = '8-5 hard (drones)';
  const c = SCEN[name];
  /** Checkpoints whose Chika has drones (and, when asked, a flight mode other than plain Hover). */
  const withDrones = (flight = false) => fullRun(name).cps.map((cp) => JSON.parse(cp.json)).filter((sn) => sn.towers.some((t) => t.u === 'chika' && t.dr?.length && (!flight || t.fl)));

  it('the run flew her wing through the flight modes and saved them', () => {
    const run = fullRun(name);
    const modes = new Set(run.log.filter((x) => x.k === 'fly').map((x) => x.a[1]));
    expect(modes.size).toBeGreaterThanOrEqual(3);
    expect(withDrones(true).length).toBeGreaterThan(0);
  });

  it('restores every drone (number, slot, counters, wave built, jam) and her totals, serial and flight mode', () => {
    for (const snap of withDrones()) {
      const o = snap.towers.find((t) => t.u === 'chika' && t.dr?.length);
      for (const row of o.dr) expect(row).toHaveLength(12);
      const { sim } = restoreSim(recordOf(c, JSON.parse(JSON.stringify(snap))));
      const t = sim.getTower(o.uid);
      expect(t.turrets.map((d) => [d.uid, d.x, d.y, d.facing, d.cooldown, d.n, d.slot, d.dmg, d.kills, d.shots, d.born, d.jam])).toEqual(o.dr);
      for (const d of t.turrets) {
        expect([d.px, d.py, d.moving, d.tgt]).toEqual([d.x, d.y, false, null]);
        expect(d.hx ** 2 + d.hy ** 2).toBeGreaterThan(0);
      }
      expect([t.droneDmg, t.droneKills, t.droneShots, t.droneSerial]).toEqual(o.ds);
      expect(t.flight ? [t.flight.mode, t.flight.ax, t.flight.ay, t.flight.bx, t.flight.by, t.flight.cx, t.flight.cy, t.flight.leg] : undefined).toEqual(o.fl);
    }
  });

  it('an older save (5-field drone rows, no totals, no flight) restores with zero counters, numbered by position, as Hover', () => {
    const snap = withDrones().at(-1);
    const o = snap.towers.find((t) => t.u === 'chika' && t.dr?.length);
    o.dr = o.dr.map((row) => row.slice(0, 5));
    delete o.ds;
    delete o.fl;
    const { sim, dropped } = restoreSim(recordOf(c, snap));
    expect(dropped).toEqual([]);
    const t = sim.getTower(o.uid);
    expect(t.turrets.map((d) => [d.n, d.slot, d.dmg, d.kills, d.shots, d.born, d.jam])).toEqual(o.dr.map((_, i) => [i + 1, i, 0, 0, 0, 0, 0]));
    expect(t.turrets.map((d) => [d.uid, d.x, d.y])).toEqual(o.dr.map((row) => [row[0], row[1], row[2]]));
    // the next drone she builds gets a fresh number
    expect(t.droneSerial).toBe(o.dr.length);
    expect([t.droneDmg, t.droneKills, t.droneShots]).toEqual([0, 0, 0]);
    expect(t.flight).toBe(null);
    expect(sim.flightInfo(o.uid).mode).toBe('hover');
  });

  it('a hand-edited drone row cannot put non-numbers into the sim (no position: the drone starts on her)', () => {
    const snap = withDrones().at(-1);
    const o = snap.towers.find((t) => t.u === 'chika' && t.dr?.length);
    o.dr[0] = [o.dr[0][0], 'x', null, 'f', {}, 'n', null, 'dmg', [], null, 'born', 'jam'];
    if (o.dr[1]) o.dr[1] = [o.dr[1][0]];
    const { sim } = restoreSim(recordOf(c, snap));
    const t = sim.getTower(o.uid);
    for (const d of t.turrets) {
      for (const k of ['uid', 'x', 'y', 'px', 'py', 'facing', 'cooldown', 'n', 'slot', 'dmg', 'kills', 'shots', 'born', 'jam']) expect(Number.isFinite(d[k]), `${k}=${d[k]}`).toBe(true);
    }
    expect([t.turrets[0].x, t.turrets[0].y, t.turrets[0].n]).toEqual([t.x, t.y, 1]);
    if (o.dr[1]) expect([t.turrets[1].x, t.turrets[1].y, t.turrets[1].n, t.turrets[1].slot]).toEqual([t.x, t.y, 2, 1]);
    // and the battle runs on
    for (let i = 0; i < 600 && sim.state !== 'won' && sim.state !== 'lost'; i++) sim.update(1 / 60);
    for (const d of t.turrets) expect(Number.isFinite(d.x) && Number.isFinite(d.y)).toBe(true);
  });
});

describe('battle save and the path cap (one final tier per path, brews, tune-up links)', SLOW, () => {
  it('a save from before the one-final-tier-per-path rule keeps both copies\' tier 5 (no refund, nothing dropped)', () => {
    // a checkpoint with two copies of one girl (autoPlan places up to 3 of a kind)
    let found = null;
    for (const name of Object.keys(SCEN)) {
      for (const cp of fullRun(name).cps) {
        const snap = JSON.parse(cp.json);
        const groups = new Map();
        for (const t of snap.towers.filter((x) => x.xp == null)) groups.set(t.u, [...(groups.get(t.u) || []), t]);
        const pair = [...groups.values()].find((g) => g.length >= 2);
        if (pair) {
          found = { c: SCEN[name], snap, pair };
          break;
        }
      }
      if (found) break;
    }
    expect(found, 'two copies of one girl in a checkpoint').toBeTruthy();
    const { c, snap, pair: [a, b] } = found;
    // both 5-x-0 on the same path: legal before the rule, refused by it now
    a.tiers = [5, 2, 0];
    b.tiers = [5, 0, 2];
    const { sim, dropped, refunded } = restoreSim(recordOf(c, JSON.parse(JSON.stringify(snap))));
    expect(dropped).toEqual([]);
    expect(refunded).toBe(0);
    expect(sim.getTower(a.uid).tiers).toEqual([5, 2, 0]);
    expect(sim.getTower(b.uid).tiers).toEqual([5, 0, 2]);
    // play goes on under the rule: each holds it for the other
    expect(sim.finalTierHolder(a.uid, 0)?.uid).toBe(b.uid);
    expect(sim.finalTierHolder(b.uid, 0)?.uid).toBe(a.uid);
    // an edited save (a crosspath break) is still refused while restoring
    const bad = JSON.parse(JSON.stringify(snap));
    bad.towers.find((t) => t.uid === a.uid).tiers = [5, 3, 0];
    expect(restoreSim(recordOf(c, bad)).dropped).toEqual([a.u]);
  });

  it('Midori\'s brews and Chika\'s tune-up links (overclock included) come back exactly and play on the same', () => {
    const c = { stageId: '2-5', difficulty: 'normal', towers: ['midori', 'chika', 'kage', 'aoi', 'rei'], hero: 'hikari', stats: { damageMul: 3, rateMul: 1.2 }, seed: 2468 };
    const sim = makeSim(c);
    sim.cash = 5e6;
    const placed = {};
    for (const p of autoPlan(c.stageId, [...c.towers, c.hero], { maxCopies: 1 })) {
      if (p.action !== 'place' || placed[p.unitId]) continue;
      placed[p.unitId] = sim.placeTower(p.unitId, p.x, p.y);
    }
    for (const id of c.towers) expect(placed[id], id).toBeTruthy();
    // Chika on Repair Bay to tier 5 (two links + overclock), Midori brewing 2 girls, a pick pinned
    for (let k = 0; k < 5; k++) expect(sim.upgradeTower(placed.chika.uid, 1)).toBe(true);
    for (let k = 0; k < 3; k++) expect(sim.upgradeTower(placed.midori.uid, 0)).toBe(true);
    expect(sim.setBuffPick(placed.midori.uid, placed.aoi.uid).ok || sim.setBuffPick(placed.midori.uid, placed.kage.uid).ok).toBe(true);
    wrapWaves(sim, c.seed);
    let held = 0;
    for (let w = 0; w < 6 && sim.state !== 'lost'; w++) {
      sim.startNextWave();
      for (let i = 0; i < 60 * 600 && sim.state === 'wave'; i++) sim.update(STEP);
      // the controller saves at the next wave's start: no shot still in flight by then
      for (let i = 0; i < 60 * 5 && sim.state === 'between' && sim.projectiles.length; i++) sim.update(STEP);
      sim.drainEvents();
      // a calm point: check what the save carries, then restore and compare everything
      const snap = JSON.parse(JSON.stringify(snapshotSim(sim)));
      held += snap.towers.filter((t) => t.li).length;
      const { sim: back, dropped } = restoreSim(recordOf(c, snap), { settings: { autoStart: false } });
      expect(dropped).toEqual([]);
      expect(diffPaths(digest(sim, { calm: true }), digest(back, { calm: true })), `wave ${sim.wave}`).toEqual([]);
      expect(JSON.stringify(snapshotSim(back))).toBe(JSON.stringify(snap));
    }
    expect(held).toBeGreaterThan(0);
    const ch = sim.getTower(placed.chika.uid);
    expect(ch.lim?.kind).toBe('link');
    expect(ch.lim.targets.length).toBeGreaterThan(0);
    expect(sim.getTower(placed.midori.uid).lim?.kind).toBe('brew');
    // the same future from the last calm point
    const { sim: rest } = restoreSim(recordOf(c, JSON.parse(JSON.stringify(snapshotSim(sim)))), { settings: { autoStart: false } });
    wrapWaves(rest, c.seed);
    autoplay(sim, sim.wave + 3);
    autoplay(rest, rest.wave + 3);
    expect(diffPaths(digest(sim), digest(rest))).toEqual([]);
    expect(hashSim(rest)).toBe(hashSim(sim));
  });

  it('an older save without the brew / link fields restores with nothing held and the window at its start', () => {
    const c = SCEN['3-5 normal'];
    const snap = JSON.parse(fullRun('3-5 normal').cps.find((x) => x.wave === 6).json);
    for (const t of snap.towers) for (const k of ['pk', 'lm', 'li', 'rd']) delete t[k];
    delete snap.dps;
    snap.buffs = (snap.buffs || []).map((b) => b.slice(0, 2));
    const { sim, dropped } = restoreSim(recordOf(c, snap));
    expect(dropped).toEqual([]);
    for (const t of sim.towers) {
      expect([t.buffPick, t.lim, t.limIn, t.recentDps, t._dmgMark]).toEqual([-1, null, null, 0, 0]);
    }
    for (const b of sim._globalBuffs) expect(b.src).toBe(-1);
  });
});

/** Free spots nearest the path, 1.6 apart (so every girl of a test team meets the waves). */
function nearPath(sim, units) {
  const cands = [];
  for (let y = 0.55; y < sim.map.height; y += 0.35) {
    for (let x = 0.55; x < sim.map.width; x += 0.35) if (!sim.placementReason(units[0], x, y)) cands.push([x, y, sim.placement.pathDistance(x, y)]);
  }
  cands.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  const out = {};
  for (const u of units) {
    const c = cands.find(([x, y]) => !Object.values(out).some(([tx, ty]) => Math.hypot(tx - x, ty - y) < 1.6) && !sim.placementReason(u, x, y));
    if (c) out[u] = [c[0], c[1]];
  }
  return out;
}

/** Potential v3 test team: every girl at P6 by the path on 4-5 Hard (a blizzard rule, a kept focus). */
const POT = { stageId: '4-5', difficulty: 'hard', towers: ['kage', 'rei', 'kaede', 'momo', 'suzu', 'chika', 'akane'], hero: 'luna', stats: { damageMul: 1.5, rateMul: 1.2, potential: 6 }, seed: 4545 };
/** The team on spots by the path, tier 2 on path 0, the waves' own streams (as the controller). */
function potBuild() {
  const sim = makeSim(POT);
  sim.cash = 5e6;
  const placed = {};
  for (const [u, [x, y]] of Object.entries(nearPath(sim, [...POT.towers, POT.hero]))) placed[u] = sim.placeTower(u, x, y);
  for (const id of POT.towers) for (let k = 0; k < 2; k++) expect(sim.upgradeTower(placed[id].uid, 0), id).toBe(true);
  sim.cash = 4000;
  wrapWaves(sim, POT.seed);
  return { sim, placed };
}
/** Plays wave by wave; at each wave's end (shots landed), `onCalm(sim)`. */
function potWaves(sim, n, onCalm) {
  for (let w = 0; w < n && sim.state !== 'lost' && sim.state !== 'won'; w++) {
    sim.startNextWave();
    for (let i = 0; i < 60 * 300 && sim.state === 'wave'; i++) {
      sim.update(STEP);
      if (sim.hero && sim.heroUltStatus().ready) sim.activateUlt();
      sim.drainEvents();
    }
    // the controller saves at the next wave's start; a quick Start comes right after the last shot
    for (let i = 0; i < 60 * 5 && sim.state === 'between' && sim.projectiles.length; i++) sim.update(STEP);
    // (and one more step: a level-up on the last kill refreshes the auras at the next step, which
    // a restore does at once; the controller's Start tap never lands inside the step)
    if (sim.state === 'between') sim.update(STEP);
    sim.drainEvents();
    onCalm(sim);
  }
}
let potPlayed = null;
/** The Potential team after a few waves (for the field guard below). */
const potRun = () => (potPlayed ??= (() => {
  const { sim } = potBuild();
  potWaves(sim, 4, () => {});
  return sim;
})());

describe('battle save and Potential v3 (format 3: rhythms, tempo, shuriken carry, kept focus, overclock)', SLOW, () => {
  const c = POT;
  const build = potBuild;
  const waves = potWaves;

  it('every counter and timer comes back exactly, and a split run plays on like the straight one', () => {
    const { sim, placed } = build();
    const seen = { midTempo: 0, carry: 0, fallen: 0, kept: 0, rhythm: 0, overclock: 0, forkFallen: 0, forkTempo: 0 };
    waves(sim, 10, () => {
      const snap = JSON.parse(JSON.stringify(snapshotSim(sim)));
      expect(snap.v).toBe(3);
      const row = (u) => snap.towers.find((t) => t.u === u);
      const kage = row('kage');
      // Kage between throws: tempo stacks still up (idle < 1 s) and a part-way shuriken carry
      if (kage.tp?.[1] > 0 && kage.tp[0] < 60) seen.midTempo++;
      if (kage.pj > 0 && kage.pj < 100) seen.carry++;
      // Kaede's last target fell and her next swing has not yet carried her focus over
      if (row('kaede').rt?.[0] === 1 && row('kaede').rt[1] > 0) seen.fallen++;
      if (row('kaede').rk > 0) seen.kept++;
      seen.rhythm += snap.towers.filter((t) => t.pc > 0).length;
      if (row('chika').oc) seen.overclock++;
      // a P1-style girl carries none of it (Luna's steps have no counter)
      for (const k of ['pc', 'tp', 'pj', 'rk', 'rt', 'ab', 'oc']) expect(row('luna')).not.toHaveProperty(k);
      const { sim: back, dropped } = restoreSim(recordOf(c, snap), { settings: { autoStart: false } });
      expect(dropped).toEqual([]);
      expect(diffPaths(digest(sim, { calm: true }), digest(back, { calm: true })), `wave ${sim.wave}`).toEqual([]);
      expect(JSON.stringify(snapshotSim(back))).toBe(JSON.stringify(snap));
      // split here when it is interesting: the restored run and the straight one play two waves alike
      const midTempo = kage.tp?.[1] > 0 && kage.tp[0] < 60;
      const fallen = row('kaede').rt?.[0] === 1;
      if ((fallen && seen.forkFallen < 2) || (midTempo && seen.forkTempo < 2)) {
        if (fallen) seen.forkFallen++;
        if (midTempo) seen.forkTempo++;
        wrapWaves(back, c.seed);
        autoplay(sim, sim.wave + 2);
        autoplay(back, back.wave + 2);
        expect(diffPaths(digest(sim), digest(back)), `split at wave ${snap.wave}`).toEqual([]);
        expect(hashSim(back)).toBe(hashSim(sim));
        expect(back.getTower(placed.kage.uid).tempoStacks).toBe(placed.kage.tempoStacks);
        expect(back.getTower(placed.kage.uid).projCarry).toBe(placed.kage.projCarry);
        expect(back.getTower(placed.kaede.uid).rampKeep).toBe(placed.kaede.rampKeep);
      }
    });
    for (const k of ['midTempo', 'carry', 'fallen', 'kept', 'rhythm', 'overclock', 'forkFallen', 'forkTempo']) expect(seen[k], k).toBeGreaterThan(0);
  });

  it('a format-2 save (before Potential v3) restores with every counter at its start and plays on', () => {
    const { sim } = build();
    let snap = null;
    waves(sim, 3, () => {
      snap = JSON.parse(JSON.stringify(snapshotSim(sim)));
    });
    expect(snap.towers.some((t) => t.pc > 0)).toBe(true);
    snap.v = 2;
    for (const t of snap.towers) for (const k of ['pc', 'tp', 'pj', 'rk', 'rt', 'ab', 'oc']) delete t[k];
    const { sim: back, dropped } = restoreSim(recordOf(c, snap));
    expect(dropped).toEqual([]);
    for (const t of back.towers) for (const k of ['potCount', 'tempoStacks', 'tempoIdle', 'projCarry', 'rampKeep', 'auraBoostLeft', 'potOc']) expect(t[k], `${t.unitId} ${k}`).toBeUndefined();
    // her rhythm specs are derived: there at once
    expect(back.towers.find((t) => t.unitId === 'kage').effProc).toBeTruthy();
    expect(back.towers.find((t) => t.unitId === 'rei').effEcho.damage).toBeCloseTo(back.towers.find((t) => t.unitId === 'rei').effProc.damage * 0.3, 9);
    expect(back.towers.find((t) => t.unitId === 'suzu').trapSpecProc).toBeTruthy();
    wrapWaves(back, c.seed);
    autoplay(back, back.wave + 2);
    expect(back.state).not.toBe('lost');
    expect(back.towers.filter((t) => t.potCount > 0).length).toBeGreaterThan(0);
    expect(snapshotSim(back).v).toBe(SNAP_V);
  });

  it('a hand-edited Potential row cannot put non-numbers or negative counts into the sim', () => {
    const { sim } = build();
    let snap = null;
    waves(sim, 2, () => {
      snap = JSON.parse(JSON.stringify(snapshotSim(sim)));
    });
    for (const t of snap.towers) Object.assign(t, { pc: 'x', tp: [null, -4], pj: {}, rk: -9, ab: 'soon', oc: ['a', null] });
    const { sim: back } = restoreSim(recordOf(c, snap));
    for (const t of back.towers) {
      for (const k of ['potCount', 'tempoStacks', 'projCarry', 'rampKeep', 'auraBoostLeft']) expect(Number.isFinite(t[k]) && t[k] >= 0, `${t.unitId} ${k}=${t[k]}`).toBe(true);
      expect(Number.isFinite(t.potOc.cd) && Number.isFinite(t.potOc.left)).toBe(true);
    }
    autoplay(back, back.wave + 1);
    expect(['between', 'won', 'lost']).toContain(back.state);
  });
});

describe('battle save guards (new Sim state must be classified in snapshot.js)', SLOW, () => {
  it('every own Sim field is classified in KNOWN_SIM_KEYS (and nothing else is)', () => {
    // (own functions are instance wrappers: the controller's startNextWave, this test's step counter)
    const fields = (o) => Object.keys(o).filter((k) => typeof o[k] !== 'function');
    const keys = new Set(fields(makeSim(SCEN['3-5 normal'])));
    for (const name of Object.keys(SCEN)) {
      const { sim } = fullRun(name);
      sim.waveWarnings(sim.wave + 1); // fills the scouting cache too
      for (const k of fields(sim)) keys.add(k);
    }
    expect([...keys].sort()).toEqual(Object.keys(KNOWN_SIM_KEYS).sort());
  });

  it('every own field of a placed girl is classified in KNOWN_TOWER_KEYS', () => {
    const keys = new Set();
    for (const name of Object.keys(SCEN)) for (const t of fullRun(name).sim.towers) for (const k of Object.keys(t)) keys.add(k);
    // (and the Potential team: Suzu's trap rhythm, Kage's tempo and carry, Kaede's kept focus …)
    for (const t of potRun().towers) for (const k of Object.keys(t)) keys.add(k);
    expect([...keys].sort()).toEqual(Object.keys(KNOWN_TOWER_KEYS).sort());
  });

  it('every own field of a roaming drone is classified in KNOWN_DRONE_KEYS', () => {
    const keys = new Set();
    let n = 0;
    for (const name of Object.keys(SCEN)) {
      for (const t of fullRun(name).sim.towers) {
        for (const d of t.turrets) {
          n++;
          for (const k of Object.keys(d)) keys.add(k);
        }
      }
    }
    expect(n).toBeGreaterThan(0);
    expect([...keys].sort()).toEqual(Object.keys(KNOWN_DRONE_KEYS).sort());
  });

  it('useWaveStream replaces every reference to the old stream (one level deep)', () => {
    const { sim } = fullRun('4-5 normal (traps, drones)');
    const old = sim.rng;
    useWaveStream(sim, 99, 50);
    const holders = [];
    for (const [k, v] of Object.entries(sim)) {
      if (v === old) holders.push(k);
      if (v && typeof v === 'object' && !(v instanceof Map) && !(v instanceof Set)) {
        for (const [k2, v2] of Object.entries(v)) if (v2 === old) holders.push(`${k}.${k2}`);
      }
    }
    expect(holders).toEqual([]);
    expect(sim.rng).not.toBe(old);
    expect(sim._statusCtx.rng).toBe(sim.rng);
  });

  it('per-wave streams depend only on (run seed, wave)', () => {
    const a = makeSim(SCEN['3-5 normal']);
    const b = makeSim(SCEN['3-5 normal']);
    a.rng.next();
    useWaveStream(a, 7, 3);
    useWaveStream(b, 7, 3);
    expect(a.rng.next()).toBe(b.rng.next());
    useWaveStream(b, 7, 4);
    expect(a.rng.next()).not.toBe(b.rng.next());
  });
});

describe('battle save and co-op freeplay: a solo save never carries freeplay state', SLOW, () => {
  /** A co-op freeplay Sim (Blossom on 1-3, goal 15), as the co-op start message builds it. */
  const fpSim = () => new Sim({ stageId: '1-3', seed: 31, options: { freeplay: true }, data: { stage: coopStage('1-3', { freeplay: 'blossom' }) } });
  /** Plays one wave with every enemy struck down at once (splits and summons included). */
  const clearWave = (sim) => {
    if (sim.state === 'prep' || sim.state === 'between') sim.startNextWave();
    for (let i = 0; i < 20000 && sim.state === 'wave'; i++) {
      for (const e of [...sim.enemies]) if (!e.dead) sim._killEnemy(e, null);
      sim.update(0.25);
      sim.drainEvents();
    }
  };
  /** A freeplay Sim between waves past its goal (wave 17 of 15 cleared: pressure set). */
  const pastGoal = () => {
    const sim = fpSim();
    sim.wave = 14;
    sim.wavesCleared = 14;
    sim.state = 'between';
    for (let i = 0; i < 3; i++) clearWave(sim);
    return sim;
  };

  it('every own field of a freeplay Sim past its goal is classified in KNOWN_SIM_KEYS', () => {
    const sim = pastGoal();
    expect(sim.state).toBe('between');
    expect(sim.wavesCleared).toBe(17);
    expect(sim._fp).toBeTruthy(); // the last freeplay wave's pressure is still there between waves
    const own = Object.keys(sim).filter((k) => typeof sim[k] !== 'function');
    expect(own.filter((k) => !(k in KNOWN_SIM_KEYS))).toEqual([]);
    expect(KNOWN_SIM_KEYS).toMatchObject({ freeplay: 'config', lastWave: 'config', _fp: 'calm', finished: 'calm' });
  });

  it('snapshotSim refuses a freeplay Sim, before and after its goal', () => {
    const before = fpSim();
    expect(() => snapshotSim(before)).toThrow(/freeplay/);
    expect(() => snapshotSim(pastGoal())).toThrow(/freeplay/);
  });

  it('a solo save holds no freeplay field, and its restore is a plain solo Sim (even from an edited record)', () => {
    const c = SCEN['3-5 normal'];
    const cp = fullRun('3-5 normal').cps.find((x) => x.wave === 6);
    const snap = JSON.parse(cp.json);
    for (const k of ['freeplay', 'lastWave', '_fp', 'fp', 'finished', 'goal']) expect(snap).not.toHaveProperty(k);
    // a record edited to ask for freeplay (and a snapshot with freeplay fields) still restores solo
    const rec = { ...recordOf(c, { ...snap, freeplay: 'blossom', _fp: { armor: 99 }, finished: true }), freeplay: 'blossom', options: { freeplay: true } };
    const { sim } = restoreSim(rec);
    expect(sim.freeplay).toBe(false);
    expect(sim.lastWave).toBe(sim.totalWaves);
    expect(sim._fp).toBe(null);
    expect(sim.finished).toBe(false);
    expect(sim.options.freeplay).toBeFalsy();
    expect(sim.freeplayInfo(sim.totalWaves + 1)).toBe(null);
    expect(sim.result().freeplay).toBe(null);
    // and it plays out to a plain ending: no wave past the stage's last one
    autoplay(sim);
    expect(['won', 'lost']).toContain(sim.state);
    expect(sim.wave).toBeLessThanOrEqual(sim.totalWaves);
  });
});

// Battle save snapshot (src/ui/battle/snapshot.js): a wave-start snapshot round-trips through
// JSON into an identical calm state, a restored battle plays on exactly like the original (same
// per-wave random streams, same commands → same end), stale saves are refused or refunded, and
// guards fail as soon as the Sim grows state the snapshot does not classify.
//
// The driver plays like the battle controller: random 7–45 ms frames at speeds 1/2/3, autoPlan
// placements and upgrades, target changes, the ult, a sell, manual waves and then auto-start, with
// sim.startNextWave wrapped on the instance (the controller's battleSaver does the same).
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { STEP } from '../../src/sim/constants.js';
import { autoPlan } from '../../src/sim/headless.js';
import { createRng } from '../../src/core/rng.js';
import { TARGET_MODES } from '../../src/data/types.js';
import { STAGE_MAP } from '../../src/data/stages.js';
import { hashSim } from '../../src/online/coop/simHash.js';
import { unitBattleStats } from '../../src/systems/progression.js';
import { RECORD_V, slotKey } from '../../src/systems/battleSave.js';
import {
  snapshotSim, restoreSim, useWaveStream, StaleSaveError, KNOWN_SIM_KEYS, KNOWN_TOWER_KEYS,
} from '../../src/ui/battle/snapshot.js';

const SCEN = {
  '3-5 normal': { stageId: '3-5', difficulty: 'normal', towers: ['aoi', 'rei', 'akane', 'sango', 'umeko', 'kaede'], hero: 'hikari', stats: { damageMul: 1.6, rateMul: 1.1 }, seed: 12345, forks: [6, 15] },
  '8-5 hard (drones)': { stageId: '8-5', difficulty: 'hard', towers: ['aoi', 'rei', 'akane', 'sango', 'umeko', 'kaede', 'hotaru', 'chika'], hero: 'luna', stats: { damageMul: 4, rateMul: 1.3 }, seed: 777, forks: [9, 20] },
  '4-5 normal (traps, drones)': { stageId: '4-5', difficulty: 'normal', towers: ['suzu', 'aoi', 'rei', 'akane', 'chika'], hero: 'hikari', stats: { damageMul: 2.5, rateMul: 1.2 }, seed: 99, forks: [5, 12] },
  'colosseum to wave 30': { stageId: 'challenge', difficulty: 'normal', endless: true, towers: ['aoi', 'rei', 'akane', 'sango', 'umeko', 'kaede', 'hotaru', 'chika'], hero: 'hikari', stats: { damageMul: 6, rateMul: 1.4 }, seed: 4242, maxCopies: 4, maxWave: 30, forks: [10, 22] },
};

/** The frozen team of a scenario, as createBattleSim builds it (full unitBattleStats + boosts). */
const team = (c) => ({
  loadout: c.towers.map((unitId) => ({ unitId, stats: { ...unitBattleStats(null, unitId), ...c.stats } })),
  hero: c.hero ? { unitId: c.hero, stats: { ...unitBattleStats(null, c.hero), ...c.stats } } : null,
});
const makeSim = (c) => new Sim({ stageId: c.stageId, difficulty: c.difficulty, ...team(c), seed: c.seed, options: { endless: !!c.endless, autoStart: false } });
const recordOf = (c, snap) => ({
  v: RECORD_V, id: 'bs-test', slot: slotKey(c.stageId, !!c.endless), stageId: c.stageId, endless: !!c.endless,
  difficulty: c.difficulty, seed: c.seed, ...team(c), createdAt: 1, updatedAt: 1, resumes: 0, snap,
});

/** Applies one command exactly like the solo ctx.act / ctx.* handlers. */
function exec(sim, k, a) {
  switch (k) {
    case 'place': return !!sim.placeTower(a[0], a[1], a[2]);
    case 'upg': return sim.upgradeTower(a[0], a[1]);
    case 'sell': return sim.sellTower(a[0]) > 0;
    case 'tgt': return sim.setTargetMode(a[0], a[1]);
    case 'ult': return !!sim.activateUlt();
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
const SIM_SKIP = new Set(['data', 'stage', 'map', 'diff', 'options', 'pathData', 'paths', 'pathTiles', 'placement', 'loadout', 'heroConfig', 'grid',
  'rng', '_statusCtx', 'events', '_waveCache', '_scratch', '_scratch2', '_hitOut', '_dotOut', '_capSources', '_towerByUid', 'hero', 'towers', 'traps',
  'enemies', 'projectiles', 'fields', '_acc']);
// a calm point resets these anyway (startNextWave overwrites the spawn cursor and timers)
const CALM_SKIP = new Set(['_autoTimer', '_spawnQueue', '_spawnIndex', '_waveTime', '_waveHpMul', '_buffTimer', '_buffsDirty']);
// derived per-tower references / caches, and the harmless stale target memory of a calm point
const TOWER_SKIP = new Set(['def', 'targetUid', 'rampTarget', 'rampStacks', 'trapSpots', 'trapSpotsRange']);

/** Generic digest: every own Sim field (minus references / scratch) and every JSON-able tower field. */
function digest(sim, { calm = false } = {}) {
  const out = {};
  for (const k of Object.keys(sim)) if (!SIM_SKIP.has(k) && !(calm && CALM_SKIP.has(k)) && typeof sim[k] !== 'function') out[k] = plain(sim[k]);
  out.towers = sim.towers.map((t) => {
    const o = {};
    for (const k of Object.keys(t)) if (!TOWER_SKIP.has(k)) o[k] = plain(t[k]);
    return o;
  });
  out.traps = sim.traps.map(({ owner, ...tr }) => ({ ...tr, owner: owner?.uid ?? null }));
  out.enemies = sim.enemies.map((e) => ({ uid: e.uid, id: e.id, x: e.x, y: e.y, hp: e.hp, dist: e.dist, barrier: e.barrier }));
  out.projectiles = sim.projectiles.length;
  out.fields = sim.fields.length;
  out.hero = sim.hero?.uid ?? null;
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
      if (!sold && sim.wave === 6 && sim.state === 'between' && sim.towers.length > 3) {
        sold = true;
        issue('sell', sim.towers[sim.towers.length - 1].uid);
      }
      if (!autoOn && sim.wave >= 4 && sim.state === 'between') {
        issue('auto', true);
        autoOn = true;
      }
      if ((sim.state === 'prep' || sim.state === 'between') && !sim.options.autoStart && ++wait > 25) {
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
        for (const cp of run.cps) {
          expect(cp.proj, `wave ${cp.wave}: shots in flight at a calm point`).toBe(0);
          expect(cp.json.length, `wave ${cp.wave} snapshot size`).toBeLessThan(8 * 1024);
          const snap = JSON.parse(cp.json);
          drones += snap.towers.reduce((a, t) => a + (t.dr?.length || 0), 0);
          traps += snap.towers.reduce((a, t) => a + (t.tr?.length || 0), 0);
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
    for (const e of [...rec.loadout, rec.hero]) delete e.stats.critMul;
    const { sim } = restoreSim(rec);
    for (const t of sim.towers) {
      expect(t.unitStats.critMul).toBe(1);
      expect(t.unitStats.damageMul).toBe(c.stats.damageMul);
    }
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
    expect(sim.drainEvents()).toEqual([]);
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
    expect([...keys].sort()).toEqual(Object.keys(KNOWN_TOWER_KEYS).sort());
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

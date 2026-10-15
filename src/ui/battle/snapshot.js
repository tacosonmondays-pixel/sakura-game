// Battle save snapshot (docs/BATTLE_SAVE.md): the battle at a calm point, as plain JSON, and the
// rebuild of a Sim from it through the public Sim API.
//
// A calm point is 'prep' or 'between' waves: no enemies (a wave ends only when the field is
// empty), no shots in flight, aura fields rebuilt every tick, ult cooldowns frozen. So the
// snapshot only carries the player's build (girls, tiers, targeting, hero XP, drones, traps) and
// the run's counters; everything else is empty or reset there and is rebuilt.
//
// This file lives outside the co-op compatibility graph (tools/simId.mjs) on purpose. It reads
// and writes a short, documented list of Sim fields; KNOWN_SIM_KEYS / KNOWN_TOWER_KEYS classify
// every field the Sim has, and tests/battle-ui/snapshot.test.js fails when a new one appears that
// is not classified here (add it to the table and, if it is state, to snapshotSim/restoreSim).
import { Sim } from '../../sim/Sim.js';
import { gainHeroXp } from '../../sim/hero.js';
import { createRng, hashString } from '../../core/rng.js';
import { STAGE_MAP } from '../../data/stages.js';
import { unitBattleStats } from '../../systems/progression.js';
import { SNAP_V, RECORD_V } from '../../systems/battleSave.js';

/**
 * Leak groups a snapshot keeps (the most recent ones): stats.leakLog is stored grouped by
 * (wave, enemy, lives), which keeps everything the defeat debrief reads (sums per enemy, wave and
 * trait, and the first boss leak) in a few KB even after hundreds of leaks in a long endless run.
 */
const LEAK_GROUPS_KEEP = 160;
/** Leak entries a restore rebuilds at most (a damaged or edited save cannot blow up memory). */
const LEAK_ENTRIES_MAX = 5000;

/**
 * stats.leakLog as [wave, enemyId, lives, count] groups, in the order each group first appears.
 * The entries' `time` is left out (nothing reads it).
 */
export function packLeaks(log) {
  const groups = new Map();
  for (const l of Array.isArray(log) ? log : []) {
    if (!l || typeof l.enemyId !== 'string') continue;
    const key = `${l.wave}|${l.enemyId}|${l.lives}`;
    const g = groups.get(key);
    if (g) g[3]++;
    else groups.set(key, [r(l.wave), l.enemyId, r(l.lives), 1]);
  }
  return [...groups.values()].slice(-LEAK_GROUPS_KEEP);
}

/** The leak log of packed groups (see packLeaks), `time` 0. */
export function unpackLeaks(groups) {
  const out = [];
  for (const g of Array.isArray(groups) ? groups : []) {
    if (!Array.isArray(g) || typeof g[1] !== 'string') continue;
    for (let i = 0; i < Math.min(r(g[3]), LEAK_ENTRIES_MAX) && out.length < LEAK_ENTRIES_MAX; i++) out.push({ wave: r(g[0]), enemyId: g[1], lives: r(g[2]), time: 0 });
  }
  return out;
}

/** A save this build cannot restore (stage gone, wave past the end, format too new …). */
export class StaleSaveError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StaleSaveError';
  }
}

/**
 * Every own field of a Sim, and how a battle save treats it:
 * - snap:    carried in the snapshot (or rebuilt from it: the hero, the tower index)
 * - config:  rebuilt by the constructor from the record (stage, difficulty, seed, team …)
 * - calm:    empty or reset at a calm point (enemies, spawn cursor, timers)
 * - derived: recomputed from the state above (aura buffs, the global rate multiplier)
 * - stream:  the random stream, replaced at every wave start (useWaveStream)
 * - scratch: per-step scratch space, caches and the event backlog
 */
export const KNOWN_SIM_KEYS = Object.freeze({
  data: 'config', stage: 'config', stageId: 'config', map: 'config', difficulty: 'config', diff: 'config', options: 'config',
  seed: 'config', pathData: 'config', paths: 'config', pathTiles: 'config', placement: 'config', loadout: 'config',
  heroConfig: 'config', endless: 'config', totalWaves: 'config', maxLives: 'config', cashScale: 'config', grid: 'config',
  rng: 'stream', _statusCtx: 'stream',
  lives: 'snap', cash: 'snap', state: 'snap', wave: 'snap', wavesCleared: 'snap', time: 'snap', towers: 'snap', traps: 'snap',
  hero: 'snap', encountered: 'snap', kills: 'snap', stats: 'snap', _uid: 'snap', _cashCarry: 'snap', _globalBuffs: 'snap',
  _towerByUid: 'snap',
  enemies: 'calm', projectiles: 'calm', fields: 'calm', warnings: 'calm', _spawnQueue: 'calm', _spawnIndex: 'calm',
  _waveTime: 'calm', _waveHpMul: 'calm', _autoTimer: 'calm', _acc: 'calm',
  globalRateMul: 'derived', _buffTimer: 'derived', _buffsDirty: 'derived',
  events: 'scratch', _waveCache: 'scratch', _scratch: 'scratch', _scratch2: 'scratch', _hitOut: 'scratch', _dotOut: 'scratch',
  _capSources: 'scratch',
  // Co-op freeplay (src/sim/freeplay.js). Battle saves are solo only and a solo battle is never a
  // freeplay Sim (options.freeplay is set by the co-op start message alone), so none of this is
  // saved: snapshotSim refuses a freeplay Sim, and restoreSim builds one without options.freeplay.
  //   freeplay: the constructor's flag (options.freeplay + the stage's tier table) — false in solo;
  //   lastWave: the constructor's last playable wave (totalWaves outside freeplay);
  //   _fp: the current freeplay wave's pressure (flat armor, Resolve budgets), set at every wave
  //        start before its first spawn — null outside freeplay;
  //   finished: set only by finish() (a Finish vote), which ends the battle — false at a calm point.
  freeplay: 'config', lastWave: 'config', _fp: 'calm', finished: 'calm',
});

/** Every own field of a placed girl (TowerRT), classified like KNOWN_SIM_KEYS. */
export const KNOWN_TOWER_KEYS = Object.freeze({
  uid: 'snap', unitId: 'snap', x: 'snap', y: 'snap', tiers: 'snap', targetMode: 'snap', spent: 'snap', kills: 'snap',
  damageDealt: 'snap', cooldown: 'snap', disabled: 'snap', facing: 'snap', buildTimer: 'snap', xp: 'snap', level: 'snap',
  ultUnlocked: 'snap', ultCooldown: 'snap', turrets: 'snap', trapCount: 'snap',
  def: 'config', isHero: 'config', unitStats: 'config', radius: 'config', tx: 'derived', ty: 'derived',
  stats: 'derived', eff: 'derived', buff: 'derived', buffed: 'derived', trapSpec: 'derived', turretSpec: 'derived',
  projKind: 'derived', removed: 'derived', _globalRate: 'derived',
  targetUid: 'calm', rampTarget: 'calm', rampStacks: 'calm',
  trapSpots: 'scratch', trapSpotsRange: 'scratch',
});

/**
 * Seeds the random stream of wave `n` of a saved run: crits, procs and trap spots in that wave
 * come from hash(run seed, n) whatever happened before it, so leaving and continuing at its start
 * replays the same luck (and the same actions give the same results).
 */
export function useWaveStream(sim, seed, n) {
  const rng = createRng(hashString(`${seed >>> 0}:wave:${n}`));
  sim.rng = rng;
  sim._statusCtx.rng = rng;
  return rng;
}

const r = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Snapshot of a battle at a calm point (state 'prep' or 'between'): plain JSON.
 * @param {Sim} sim
 */
export function snapshotSim(sim) {
  if (sim.state !== 'prep' && sim.state !== 'between') throw new Error(`[battleSave] no snapshot while ${sim.state}`);
  // co-op freeplay state (goal, pressure, Finish) has no place in a solo save (see KNOWN_SIM_KEYS)
  if (sim.freeplay) throw new Error('[battleSave] a freeplay battle is co-op only and never saved');
  const { leakLog, ...stats } = JSON.parse(JSON.stringify(sim.stats));
  return {
    v: SNAP_V,
    wave: sim.wave,
    wavesCleared: sim.wavesCleared,
    state: sim.state,
    time: sim.time,
    cash: sim.cash,
    carry: sim._cashCarry,
    lives: sim.lives,
    uid: sim._uid,
    buffs: sim._globalBuffs.filter((b) => b.left > 0).map((b) => [b.mul, b.left]),
    towers: sim.towers.map((t) => {
      const o = {
        uid: t.uid, u: t.unitId, x: t.x, y: t.y, tiers: [...t.tiers], tm: t.targetMode, spent: t.spent,
        kills: t.kills, dmg: t.damageDealt, cd: t.cooldown, dis: t.disabled, face: t.facing, bt: t.buildTimer,
      };
      if (t.isHero) Object.assign(o, { xp: t.xp, lvl: t.level, ultOn: t.ultUnlocked, ult: t.ultCooldown });
      if (t.turrets.length) o.dr = t.turrets.map((d) => [d.uid, d.x, d.y, d.facing, d.cooldown]);
      const traps = sim.traps.filter((tr) => tr.ownerUid === t.uid);
      if (traps.length) o.tr = traps.map((tr) => [tr.uid, tr.x, tr.y, tr.armed ? 1 : 0, tr.armLeft]);
      return o;
    }),
    kills: { ...sim.kills },
    enc: [...sim.encountered],
    stats,
    leakGroups: packLeaks(leakLog),
  };
}

/** A frozen team entry with every stat key this build knows (a newer key gets its neutral value). */
function teamEntry(e) {
  if (!e?.unitId) return null;
  return { unitId: e.unitId, stats: { ...unitBattleStats(null, e.unitId), ...(e.stats || {}) } };
}

/**
 * Rebuilds the Sim of a saved run (record: src/systems/battleSave.js) at its snapshot: the same
 * girls on the same spots with the same tiers, targeting, hero XP, drones and traps, coins,
 * lives and counters, in state 'between' (or 'prep' before the first wave) with no FX pending.
 * A girl who cannot return after an update (unit gone, spot or tiers no longer valid) is left out
 * and what was spent on her is refunded.
 * @param {object} rec battle save record
 * @param {object} [profile] for settings.autoStart
 * @returns {{ sim: Sim, refunded: number, dropped: string[] }}
 * @throws {StaleSaveError}
 */
export function restoreSim(rec, profile = null) {
  const s = rec?.snap;
  const stage = STAGE_MAP[rec?.stageId];
  if (!stage) throw new StaleSaveError(`unknown stage ${rec?.stageId}`);
  if (!s || !(rec.v <= RECORD_V) || !(s.v <= SNAP_V)) throw new StaleSaveError('save format from a newer build');
  let sim;
  try {
    sim = new Sim({
      stageId: rec.stageId,
      difficulty: rec.difficulty,
      loadout: (rec.loadout || []).map(teamEntry).filter(Boolean),
      hero: teamEntry(rec.hero),
      seed: rec.seed,
      // never options.freeplay: a battle save is a solo run (co-op freeplay is not saved)
      options: { endless: !!rec.endless, autoStart: !!profile?.settings?.autoStart },
    });
  } catch (e) {
    throw new StaleSaveError(`stage cannot be built: ${e.message}`);
  }
  if (!sim.endless && s.wave >= sim.totalWaves) throw new StaleSaveError(`wave ${s.wave} is past the end (${sim.totalWaves})`);
  const dropped = [];
  let refunded = 0;
  sim.cash = Number.MAX_SAFE_INTEGER; // costs do not matter while rebuilding: `spent` comes back below
  for (const b of s.buffs || []) if (b?.[1] > 0) sim.addGlobalRateBuff(b[0], b[1]);
  const drop = (o) => {
    dropped.push(o.u);
    refunded += Math.max(0, Math.floor(r(o.spent)));
  };
  for (const o of [...s.towers].sort((a, b) => a.uid - b.uid)) {
    sim._uid = o.uid; // the same uids: stats.damageByTower / towerUnits and drone / trap owners stay valid
    let t = null;
    try {
      t = sim.placeTower(o.u, o.x, o.y);
    } catch {
      t = null;
    }
    if (!t) {
      drop(o);
      continue;
    }
    const tiers = Array.isArray(o.tiers) ? o.tiers : [0, 0, 0];
    const order = [0, 1, 2].sort((p, q) => r(tiers[q]) - r(tiers[p]));
    let ok = true;
    for (const p of order) for (let k = 0; k < r(tiers[p]) && ok; k++) ok = sim.upgradeTower(t.uid, p);
    if (!ok) {
      sim.sellTower(t.uid); // all or nothing per girl
      drop(o);
      continue;
    }
    if (o.tm) sim.setTargetMode(t.uid, o.tm);
    t.spent = r(o.spent);
    t.kills = r(o.kills);
    t.damageDealt = r(o.dmg);
    t.cooldown = r(o.cd);
    t.disabled = r(o.dis);
    t.facing = r(o.face);
    t.buildTimer = r(o.bt);
    if (t.isHero) {
      if (o.xp > 0) gainHeroXp(sim, t, o.xp);
      t.ultUnlocked = !!o.ultOn;
      t.ultCooldown = r(o.ult);
    }
    const maxDr = t.stats.turret?.max ?? 0;
    for (const d of (o.dr || []).slice(0, maxDr)) t.turrets.push({ uid: d[0], x: d[1], y: d[2], facing: d[3], cooldown: d[4] });
    const maxTr = t.stats.trap?.max ?? 0;
    for (const tr of (o.tr || []).slice(0, maxTr)) {
      sim.traps.push({ uid: tr[0], x: tr[1], y: tr[2], ownerUid: t.uid, armed: !!tr[3], armLeft: tr[4], owner: t });
      t.trapCount++;
    }
  }
  sim.traps.sort((a, b) => a.uid - b.uid); // the order they were laid in (uids only grow)
  sim._uid = Math.max(r(s.uid), sim._uid);
  sim.cash = r(s.cash) + refunded;
  sim._cashCarry = r(s.carry);
  sim.lives = r(s.lives);
  sim.wave = r(s.wave);
  sim.wavesCleared = r(s.wavesCleared);
  sim.state = sim.wave > 0 ? 'between' : 'prep';
  sim.time = r(s.time);
  sim.kills = { ...(s.kills || {}) };
  sim.encountered = new Set(s.enc || []);
  if (s.stats && typeof s.stats === 'object') sim.stats = { ...sim.stats, ...JSON.parse(JSON.stringify(s.stats)) };
  if (Array.isArray(s.leakGroups)) sim.stats.leakLog = unpackLeaks(s.leakGroups);
  if (!Array.isArray(sim.stats.leakLog)) sim.stats.leakLog = [];
  sim.drainEvents(); // no placement, upgrade or level-up FX / audio for the rebuild
  return { sim, refunded, dropped };
}

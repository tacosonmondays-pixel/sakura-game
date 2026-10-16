// Battle save snapshot (docs/BATTLE_SAVE.md): the battle at a calm point, as plain JSON, and the
// rebuild of a Sim from it through the public Sim API.
//
// A calm point is 'prep' or 'between' waves: no enemies (a wave ends only when the field is
// empty), no shots in flight, aura fields rebuilt every tick, ult cooldowns frozen. So the
// snapshot only carries the player's build (girls, tiers, targeting, hero XP and bought levels,
// drones, traps) and the run's counters; everything else is empty or reset there and is rebuilt.
//
// Format 2 (the hero rework): a hero has no tiers and is never sold; she comes back by her XP
// (her level and Mastery follow), with the coins she spent on levels and her Move timers.
// A format-1 save holds a hero of the old 10-level scale with path tiers: she is restored at her
// old level on the new track (bar empty) and everything she cost comes back as coins.
// Roaming drones (Chika rework, same format 2, additive): a drone row carries its number, home
// slot, counters, the wave it was built in and a running jam; the girl's drone totals and serial
// (`ds`) and her wing's flight mode (`fl`, absent = Hover) come along. Older 5-field rows restore
// with zero counters, numbered by position.
// Path cap (same format 2, additive; src/sim/buffs.js): tiers are replayed with `{ restoring: true }`,
// so a save made before the one-final-tier-per-path rule keeps every tier 5 it had. The limited
// buffs travel with the girls: Midori's / Chika's pick (`pk`), what her brew / tune-up is doing
// (`lm`: timers and targets), the brew / link a girl holds (`li`), and the recent-DPS window that
// picks the strongest girl (`rd`, the Sim's `dps` timer), so the first re-pick after Continue is
// the one the run would have made. Global rate buffs keep who cast them (the buff icons). A save
// without these fields restores with no brew / link held and the window at its start.
//
// This file lives outside the co-op compatibility graph (tools/simId.mjs) on purpose. It reads
// and writes a short, documented list of Sim fields; KNOWN_SIM_KEYS / KNOWN_TOWER_KEYS classify
// every field the Sim has, and tests/battle-ui/snapshot.test.js fails when a new one appears that
// is not classified here (add it to the table and, if it is state, to snapshotSim/restoreSim).
import { Sim } from '../../sim/Sim.js';
import { gainHeroXp, xpToReach } from '../../sim/hero.js';
import { restoreDrone, recomputeBuffs } from '../../sim/towers.js';
import { FLIGHT_MODES } from '../../sim/constants.js';
import { BATTLE } from '../../data/types.js';
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
  heroConfigs: 'config', _heroConfig: 'config', endless: 'config', totalWaves: 'config', maxLives: 'config', cashScale: 'config', grid: 'config',
  rng: 'stream', _statusCtx: 'stream',
  lives: 'snap', cash: 'snap', state: 'snap', wave: 'snap', wavesCleared: 'snap', time: 'snap', towers: 'snap', traps: 'snap',
  heroes: 'snap', encountered: 'snap', kills: 'snap', stats: 'snap', _uid: 'snap', _cashCarry: 'snap', _globalBuffs: 'snap',
  _towerByUid: 'snap',
  // path cap (src/sim/buffs.js): the recent-DPS window's timer (which girl a brew / link picks)
  _dpsTimer: 'snap',
  enemies: 'calm', projectiles: 'calm', fields: 'calm', warnings: 'calm', _spawnQueue: 'calm', _spawnIndex: 'calm',
  _waveTime: 'calm', _waveHpMul: 'calm', _autoTimer: 'calm', _acc: 'calm',
  globalRateMul: 'derived', _buffTimer: 'derived', _buffsDirty: 'derived',
  events: 'scratch', _waveCache: 'scratch', _scratch: 'scratch', _scratch2: 'scratch', _hitOut: 'scratch', _dotOut: 'scratch',
  _capSources: 'scratch', _stepping: 'scratch',
  // Heroes (hero rework): `hero` / `heroConfig` are prototype getters on `heroes` / `_heroConfig`
  // (the viewing player's), not own fields; `heroes` is rebuilt by placing her (restoreSim).
  // Freeplay (src/sim/freeplay.js): co-op, and solo freeplay (freeplay=<tier>, Keep going). Neither
  // is ever saved (co-op battles never save; isSavableRun is false for a solo freeplay run, and a
  // Keep going run's save is deleted by its win), so none of this is saved: snapshotSim refuses a
  // freeplay Sim, and restoreSim builds one without options.freeplay.
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
  levelSpent: 'snap', levelsBought: 'snap', moveCd: 'snap', moveLock: 'snap',
  // roaming drones (Chika rework): the drone totals and numbering, the wing's flight mode; the
  // target pool is per-step scratch, and its reuse counter only matters while enemies are alive
  // (a pool of dead enemies is never reused, so it is moot at a calm point)
  droneDmg: 'snap', droneKills: 'snap', droneShots: 'snap', droneSerial: 'snap', flight: 'snap',
  _pool: 'scratch', _poolS: 'scratch', _poolLeft: 'calm', _poolMode: 'calm',
  // path cap (src/sim/buffs.js): her co-op owner (0 solo), the aura winner per buff key (recomputed),
  // her pick, her own brew / link state, the brew / link she holds, her recent-DPS window
  owner: 'config', buffBy: 'derived', buffPick: 'snap', lim: 'snap', limIn: 'snap', recentDps: 'snap', _dmgMark: 'snap',
  def: 'config', isHero: 'config', heroIndex: 'config', unitStats: 'config', radius: 'config', tx: 'derived', ty: 'derived',
  stats: 'derived', eff: 'derived', buff: 'derived', buffed: 'derived', trapSpec: 'derived', turretSpec: 'derived',
  projKind: 'derived', removed: 'derived', _globalRate: 'derived', mastery: 'derived',
  targetUid: 'calm', rampTarget: 'calm', rampStacks: 'calm',
  trapSpots: 'scratch', trapSpotsRange: 'scratch',
});

/**
 * Every own field of a roaming drone (src/sim/towers.js makeDrone), classified like the tables
 * above: its home offset follows from its slot; its quarry, motion flag and position one step
 * earlier are reset at a calm point (there is no enemy left to chase and the next step overwrites
 * them). A jam can still be running at a calm point, so it is kept.
 */
export const KNOWN_DRONE_KEYS = Object.freeze({
  uid: 'snap', n: 'snap', slot: 'snap', x: 'snap', y: 'snap', facing: 'snap', cooldown: 'snap',
  dmg: 'snap', kills: 'snap', shots: 'snap', born: 'snap', jam: 'snap',
  hx: 'derived', hy: 'derived',
  tgt: 'calm', targetUid: 'calm', moving: 'calm', px: 'calm', py: 'calm',
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
  // freeplay state (goal, pressure, Finish) has no place in a battle save (see KNOWN_SIM_KEYS)
  if (sim.freeplay) throw new Error('[battleSave] a freeplay battle (co-op or solo) is never saved');
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
    buffs: sim._globalBuffs.filter((b) => b.left > 0).map((b) => [b.mul, b.left, b.src ?? -1]),
    dps: sim._dpsTimer,
    towers: sim.towers.map((t) => {
      const o = {
        uid: t.uid, u: t.unitId, x: t.x, y: t.y, tiers: [...t.tiers], tm: t.targetMode, spent: t.spent,
        kills: t.kills, dmg: t.damageDealt, cd: t.cooldown, dis: t.disabled, face: t.facing, bt: t.buildTimer,
      };
      if (t.isHero) Object.assign(o, { xp: t.xp, lvl: t.level, ultOn: t.ultUnlocked, ult: t.ultCooldown, ls: t.levelSpent || 0, lb: t.levelsBought || 0, mc: t.moveCd || 0, ml: t.moveLock || 0 });
      if (t.turrets.length) {
        o.dr = t.turrets.map((d) => (d.n != null
          ? [d.uid, d.x, d.y, d.facing, d.cooldown, d.n, d.slot, d.dmg, d.kills, d.shots, d.born, d.jam]
          : [d.uid, d.x, d.y, d.facing, d.cooldown]));
      }
      if (t.droneDmg || t.droneKills || t.droneShots || t.droneSerial) o.ds = [t.droneDmg, t.droneKills, t.droneShots, t.droneSerial];
      if (t.flight) {
        const f = t.flight;
        o.fl = [f.mode, f.ax, f.ay, f.bx, f.by, f.cx, f.cy, f.leg];
      }
      const traps = sim.traps.filter((tr) => tr.ownerUid === t.uid);
      if (traps.length) o.tr = traps.map((tr) => [tr.uid, tr.x, tr.y, tr.armed ? 1 : 0, tr.armLeft]);
      // limited buffs (path cap): her pick, her brew / link timers and targets, what she holds
      if (t.buffPick >= 0) o.pk = t.buffPick;
      if (t.lim) o.lm = packLim(t.lim);
      if (t.limIn) o.li = [t.limIn.brew, t.limIn.brewLeft, t.limIn.link, t.limIn.oc ? 1 : 0];
      if (t.recentDps || t._dmgMark) o.rd = [t.recentDps, t._dmgMark];
      return o;
    }),
    kills: { ...sim.kills },
    enc: [...sim.encountered],
    stats,
    leakGroups: packLeaks(leakLog),
  };
}

/** A brewer's / linker's own state (src/sim/buffs.js brewTick / linkTick) as a short row. */
function packLim(l) {
  if (l.kind === 'brew') return ['b', l.cd, l.repick ? 1 : 0, ...l.targets];
  return ['l', l.scan, l.ocCd, l.ocLeft, l.repick ? 1 : 0, ...l.targets];
}

/** The row of packLim back as the object brewTick / linkTick keep (same key order), or null. */
function unpackLim(row) {
  if (!Array.isArray(row)) return null;
  const ids = (a) => a.filter((v) => Number.isInteger(v));
  if (row[0] === 'b') return { kind: 'brew', cd: r(row[1]), repick: !!row[2], targets: ids(row.slice(3)) };
  if (row[0] === 'l') return { kind: 'link', targets: ids(row.slice(5)), repick: !!row[4], scan: r(row[1]), ocCd: r(row[2]), ocLeft: r(row[3]) };
  return null;
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
 * and what was spent on her is refunded. A hero from a format-1 save (before the hero rework)
 * returns at her old level and what she cost is refunded too (`heroes`, for the notice).
 * @param {object} rec battle save record
 * @param {object} [profile] for settings.autoStart
 * @returns {{ sim: Sim, refunded: number, dropped: string[], heroes: { unitId: string, level: number, refunded: number }[] }}
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
      // never options.freeplay: freeplay runs (co-op or solo) are never saved
      options: { endless: !!rec.endless, autoStart: !!profile?.settings?.autoStart },
    });
  } catch (e) {
    throw new StaleSaveError(`stage cannot be built: ${e.message}`);
  }
  if (!sim.endless && s.wave >= sim.totalWaves) throw new StaleSaveError(`wave ${s.wave} is past the end (${sim.totalWaves})`);
  const dropped = [];
  let refunded = 0;
  // format 1: heroes of the old scale (10 levels, XP 1 per HP, path tiers bought with coins)
  const oldHeroes = !(s.v >= 2);
  const migrated = [];
  sim.cash = Number.MAX_SAFE_INTEGER; // costs do not matter while rebuilding: `spent` comes back below
  // (who cast it: an older save has no caster, as the restore had none placed yet)
  for (const b of s.buffs || []) if (b?.[1] > 0) sim.addGlobalRateBuff(b[0], b[1], Number.isInteger(b[2]) ? b[2] : -1);
  const drop = (o) => {
    dropped.push(o.u);
    // (a hero's levels bought with coins come back too: her placement was free)
    refunded += Math.max(0, Math.floor(r(o.spent))) + Math.max(0, Math.floor(r(o.ls)));
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
    if (!t.isHero) {
      // (a hero has no tiers and is never sold: sellTower refuses her)
      const tiers = Array.isArray(o.tiers) ? o.tiers : [0, 0, 0];
      const order = [0, 1, 2].sort((p, q) => r(tiers[q]) - r(tiers[p]));
      let ok = true;
      // { restoring: true }: a save from before the one-final-tier-per-path rule keeps every tier 5
      // it had (crosspath and the tier order are still checked, so an edited save stays refused)
      for (const p of order) for (let k = 0; k < r(tiers[p]) && ok; k++) ok = sim.upgradeTower(t.uid, p, { restoring: true });
      if (!ok) {
        sim.sellTower(t.uid); // all or nothing per girl
        drop(o);
        continue;
      }
    }
    if (o.tm) sim.setTargetMode(t.uid, o.tm);
    t.spent = r(o.spent);
    t.kills = r(o.kills);
    t.damageDealt = r(o.dmg);
    t.cooldown = r(o.cd);
    t.disabled = r(o.dis);
    t.facing = r(o.face);
    t.buildTimer = r(o.bt);
    if (t.isHero && oldHeroes) {
      // her old level on the new track, bar empty (old XP is on another scale); she deploys free
      // now, so her placement and tiers come back as coins
      const level = Math.max(1, Math.min(BATTLE.maxHeroLevel, Math.floor(r(o.lvl)) || 1));
      if (level > 1) gainHeroXp(sim, t, xpToReach(t.def.hero, level), 'restore');
      const back = Math.max(0, Math.floor(r(o.spent)));
      t.spent = 0;
      refunded += back;
      migrated.push({ unitId: t.unitId, level: t.level, refunded: back });
      if (o.ultOn) {
        t.ultUnlocked = true;
        t.ultCooldown = r(o.ult);
      }
    } else if (t.isHero) {
      if (o.xp > 0) gainHeroXp(sim, t, o.xp, 'restore');
      t.ultUnlocked = !!o.ultOn;
      t.ultCooldown = r(o.ult);
      t.levelSpent = r(o.ls);
      t.levelsBought = r(o.lb);
      t.moveCd = r(o.mc);
      // (a Move late in a wave can still be pausing her when the next one is started)
      t.moveLock = r(o.ml);
    }
    const maxDr = t.stats.turret?.max ?? 0;
    const roam = t.turretSpec?.leash > 0;
    (o.dr || []).slice(0, maxDr).forEach((d, i) => {
      if (!Array.isArray(d)) return;
      // roaming drones keep their number, slot and counters (an old 5-field row: counters 0,
      // numbered by position); anchored drones are plain points
      t.turrets.push(roam ? restoreDrone(t, d, i) : { uid: d[0], x: d[1], y: d[2], facing: d[3], cooldown: d[4] });
    });
    if (roam) {
      const ds = Array.isArray(o.ds) ? o.ds : [];
      t.droneDmg = r(ds[0]);
      t.droneKills = r(ds[1]);
      t.droneShots = r(ds[2]);
      // never hand out a drone number twice (an old save has no serial)
      t.droneSerial = Math.max(Math.floor(r(ds[3])), ...t.turrets.map((d) => Math.floor(r(d.n))), 0);
      // her wing's flight mode, before the first step (an older save: Hover)
      const fl = o.fl;
      if (Array.isArray(fl) && FLIGHT_MODES.includes(fl[0])) {
        t.flight = { mode: fl[0], ax: r(fl[1]), ay: r(fl[2]), bx: r(fl[3]), by: r(fl[4]), cx: r(fl[5]), cy: r(fl[6]), leg: fl[7] ? 1 : 0 };
      }
    }
    const maxTr = t.stats.trap?.max ?? 0;
    for (const tr of (o.tr || []).slice(0, maxTr)) {
      sim.traps.push({ uid: tr[0], x: tr[1], y: tr[2], ownerUid: t.uid, armed: !!tr[3], armLeft: tr[4], owner: t });
      t.trapCount++;
    }
  }
  sim.traps.sort((a, b) => a.uid - b.uid); // the order they were laid in (uids only grow)
  // limited buffs (path cap), once every girl is back (they name each other by uid): a uid of a girl
  // who could not return is harmless (the sim skips and clears it on the next step)
  for (const o of s.towers) {
    const t = sim.getTower(o.uid);
    if (!t || t.unitId !== o.u) continue;
    t.buffPick = Number.isInteger(o.pk) ? o.pk : -1;
    t.lim = unpackLim(o.lm);
    t.limIn = Array.isArray(o.li) ? { brew: Number.isInteger(o.li[0]) ? o.li[0] : -1, brewLeft: r(o.li[1]), link: Number.isInteger(o.li[2]) ? o.li[2] : -1, oc: !!o.li[3] } : null;
    const rd = Array.isArray(o.rd) ? o.rd : [];
    t.recentDps = r(rd[0]);
    t._dmgMark = r(rd[1]);
  }
  if (typeof s.dps === 'number' && Number.isFinite(s.dps)) sim._dpsTimer = s.dps;
  recomputeBuffs(sim); // the brews / links held now multiply on top of the auras
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
  return { sim, refunded, dropped, heroes: migrated };
}

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
// Battle modes and map rules (same format 2, additive; docs/specs/CODEX_MODES.md): the record names
// the run's mode (`mode`, absent = Standard) and the Sim is rebuilt in it; the map rule rides on
// the stage. At a calm point the rule runtime is back to its between-waves state (ruleWaveEnd), so
// the snapshot only adds the route orientation of the last wave (`rr`, battles with a reversible
// route only); crystal pads and rule range are derived from the girls' spots.
// Path cap (same format 2, additive; src/sim/buffs.js): tiers are replayed with `{ restoring: true }`,
// so a save made before the one-final-tier-per-path rule keeps every tier 5 it had. The limited
// buffs travel with the girls: Midori's / Chika's pick (`pk`), what her brew / tune-up is doing
// (`lm`: timers and targets), the brew / link a girl holds (`li`), and the recent-DPS window that
// picks the strongest girl (`rd`, the Sim's `dps` timer), so the first re-pick after Continue is
// the one the run would have made. Global rate buffs keep who cast them (the buff icons). A save
// without these fields restores with no brew / link held and the window at its start.
// Format 3 (Potential v3, src/sim/potential.js): a girl at P2+ fights with rhythms, tempo, extra
// projectiles, a kept focus, aura boosts and drone overclocks, whose counters and timers run on
// between waves; they travel with her (`pc` rhythm count, `tp` tempo idle steps and stacks, `pj`
// projectile carry, `rk` kept focus, `rt` a fallen target's focus not yet carried over, `ab` aura
// boost left, `oc` overclock timers), each only when she has it. The specs they build (`effProc`,
// `effEcho`, `trapSpecProc`) are derived from her stats. A format-1 or format-2 save (no such
// fields) restores with every counter at its start.
// Abilities (src/sim/abilities.js; same formats, additive): a girl's ability row (`ak`: cooldown left in
// charge points, Auto, casts) and the map-scope cooldowns of the run (`ag`). Lasting effects (boosts,
// rallies, queued shells) end at every wave clear, so a calm point has none; the tier replay unlocks
// each ability (with its first charge) before `ak` puts the saved state back. A save without them
// restores every ability at its first charge, Auto from the setting.
// Tenka (src/sim/lab.js, zones.js; same formats, additive): her lab team's record (`lb`: rounds, members and
// coins per class, the joiners' income, who joined, their interest rates) and her well / Last Line timers
// (`zc`). The tier replay runs with { restoring: true }, which never absorbs, so the girls placed after her
// Joint Research stay on the field and the record comes back as saved; her lab weapons follow from it.
// Wells and Last Line zones end at every wave clear (nothing to save). A save without these fields restores
// her tiers with no lab team and fresh timers.
//
// The duo (src/sim/duo.js; additive): her Refraction counter, her volley count and Kohaku's beam timer (`du`).
// A save without it restores her with fresh counters.
//
// The staff heroes (BANNERS §D.6; additive): Norika's own barricades, their spots, budgets and rebuild timers (`br`;
// at a calm point they all stand at full budget, since the wave clear refills them). Her Hold the Line barricades and
// One-Way Street's count end at every wave clear, and Kogane's Overdrive ends with the wave, so a calm point holds
// none of them; Kogane's Move cooldown is the hero's `mc` (her shorter `moveCd` recharge is data). A save without
// `br` restores Norika's barricades at the spots her restored range picks.
//
// This file lives outside the co-op compatibility graph (tools/simId.mjs) on purpose. It reads
// and writes a short, documented list of Sim fields; KNOWN_SIM_KEYS / KNOWN_TOWER_KEYS classify
// every field the Sim has, and tests/battle-ui/snapshot.test.js fails when a new one appears that
// is not classified here (add it to the table and, if it is state, to snapshotSim/restoreSim).
import { Sim } from '../../sim/Sim.js';
import { gainHeroXp, xpToReach } from '../../sim/hero.js';
import { restoreDrone, recomputeBuffs } from '../../sim/towers.js';
import { FLIGHT_MODES } from '../../sim/constants.js';
import { POP_BUDGET_MAX } from '../../sim/gearRules.js';
import { BATTLE } from '../../data/types.js';
import { createRng, hashString } from '../../core/rng.js';
import { STAGE_MAP } from '../../data/stages.js';
import { unitBattleStats } from '../../systems/progression.js';
import { SNAP_V, SNAP_V_P1, RECORD_V } from '../../systems/battleSave.js';
import { eventBattleStage } from '../../data/events/wire.js';
import { modeId } from '../../data/modes.js';
import { LAB_CLASSES, emptyLab } from '../../sim/lab.js';
import { barricadeMax } from '../../sim/barricades.js';

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
  // balance round 5 is off in a titan battle (src/data/balance.js TITAN_POWER): set from the stage
  _powerOff: 'config',
  heroConfigs: 'config', _heroConfig: 'config', endless: 'config', totalWaves: 'config', maxLives: 'config', cashScale: 'config', grid: 'config',
  rng: 'stream', _statusCtx: 'stream',
  lives: 'snap', cash: 'snap', state: 'snap', wave: 'snap', wavesCleared: 'snap', time: 'snap', towers: 'snap', traps: 'snap',
  heroes: 'snap', encountered: 'snap', kills: 'snap', stats: 'snap', _uid: 'snap', _cashCarry: 'snap', _globalBuffs: 'snap',
  _towerByUid: 'snap',
  // path cap (src/sim/buffs.js): the recent-DPS window's timer (which girl a brew / link picks)
  _dpsTimer: 'snap',
  // gear (src/sim/gearRules.js): Finale Pop's budget for the whole battle
  popBudget: 'snap',
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
  // Battle modes and map rules (src/sim/rules.js): the mode and the rule runtime come from the record
  // and the stage (ruleWaveEnd puts the runtime back to its fresh between-waves state), both route
  // orientations are built by the constructor, and the orientation in use is kept (`rr`); the rule
  // tables are rebuilt from the runtime, and the rule's step clock restarts at every wave start.
  mode: 'config', incomeMul: 'config', _modeArmor: 'config', _ruleGoal: 'config', _bountyAdd: 'config',
  _pathsFwd: 'config', _pathsRev: 'config', rule: 'config', routeReversed: 'snap',
  _ruleMul: 'derived', _ruleMove: 'derived', _ruleRange: 'derived', _rulePortal: 'derived', _waveTick: 'calm',
  // abilities (src/sim/abilities.js): map-scope cooldowns travel (`ag`); econ casts per wave restart at
  // every wave start; rallies, queued shells and owner coins (co-op only) are empty at a calm point; the
  // Auto-cast setting comes from the profile; the count of girls with an ability follows the tier replay
  abilGroups: 'snap', abilUses: 'calm', _rallies: 'calm', _abilQueue: 'calm', ownerCash: 'calm',
  abilityAutoDefault: 'config', _abilOn: 'derived',
  // roster B3 (aim, mortar, relay, curse, team damage buff): shells end at the wave clear, the curse
  // queue is flushed inside the step, the relay samples are a cache of the forward paths, and the
  // team damage multiplier follows the saved buffs ('db')
  shells: 'calm', _curseQueue: 'calm', _flushingCurses: 'calm', _curseCtx: 'scratch', _scratch3: 'scratch',
  _relaySamples: 'scratch', globalDmgMul: 'derived', runners: 'calm', _curseBudget: 'calm', _leadPt: 'scratch',
  // Tenka's lab team (src/sim/lab.js): how many girls have one follows their restored records (`lb`)
  _labOn: 'derived',
  // Tenka's wells and Last Line (src/sim/zones.js): every zone ends at the wave clear (the tier replay
  // makes the list again, empty), and the near-exit count follows the girls with Last Line. (Both are
  // created lazily and never deleted: after her sale they stay [] / 0, where a restore has none, which
  // runs the same.)
  zones: 'calm', _nearExitOn: 'derived',
  // Norika's barricades (src/sim/barricades.js): how many heroes have them follows the restored hero
  _blockOn: 'derived',
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
  // map rules: crystal pads follow the girls' spots (assignPads), rule range follows the rule's
  // state (recomputeBuffs); absent = neutral (no pad, range unchanged)
  padIndex: 'derived', onPad: 'derived', padMul: 'derived', padRangeAdd: 'derived', envRangeMul: 'derived', envRangeAdd: 'derived',
  // Potential v3 (format 3; only on a girl whose steps use them): her rhythm's count, tempo, the
  // projectile carry, a kept focus, an aura boost and her drones' overclock run on between waves;
  // the rhythm's specs follow her stats and buffs (refreshEffective)
  potCount: 'snap', tempoStacks: 'snap', tempoIdle: 'snap', projCarry: 'snap', rampKeep: 'snap', auraBoostLeft: 'snap', potOc: 'snap',
  effProc: 'derived', effEcho: 'derived', trapSpecProc: 'derived',
  // abilities: her ability's state (`ak`); a boost runs only during a wave
  abil: 'snap', abilMods: 'calm',
  // gear (src/sim/gearRules.js): her Pierce carries (shots, drones), her club trick's count, Big Beat's
  // trap / drone counts and Follow-Through's trap count — only on a girl whose gear uses them
  pierceCarry: 'snap', droneCarry: 'snap', trickN: 'snap', trapBeatN: 'snap', droneBeatN: 'snap', trapFtN: 'snap',
  // Kaede's blade arts: her strike count toward the next Maple Cleave ('kb')
  bladeN: 'snap',
  // roster B3: her aim point stays (a mirror's spot, a mortar's centre; GAPS §7.3), and her attack
  // origin follows from it and her spot (updateRelayOrigin)
  aim: 'snap', origin: 'derived', ox: 'derived', oy: 'derived', _globalDmg: 'derived',
  // the new girls (UNIT_GAPS §5): Azami's Spread cursor stays ('sc'); her flyer and blast specs follow
  // her stats (refreshEffective). Her carried strips ride in 'tr'.
  stripCursor: 'snap', stripAirSpec: 'derived', stripBoomSpec: 'derived',
  // Kinu: her ring's turn stays ('rg'); heat rings end at the wave clear; the scissors' spec follows her stats
  ringTurn: 'snap', rings: 'calm', scissorSpec: 'derived',
  // Wakaba: a girl's drink ends at the wave clear; the towel's spec follows her stats
  hydrated: 'calm', towelSpec: 'derived',
  // Yuzuha: sentries end at the wave clear; her nets stay ('nt'); the sentry, burst and net specs follow her stats
  sentries: 'calm', nets: 'snap', sentrySpecs: 'derived', sentryBurstSpec: 'derived', netSpec: 'derived',
  // Ouka: her banners stay ('bn', planted again in order through setAim); a covered girl's rules follow
  // the hubs around her (recomputeBuffs)
  banners: 'snap', rules: 'derived',
  // Chigusa: her vine timer starts over, her held enemy, thorn beds and Bloom Rush end at the wave clear;
  // the vine and bed specs follow her stats
  vineCd: 'calm', vineHold: 'calm', beds: 'calm', bloomT: 'calm', bloomIdle: 'calm', vineSpec: 'derived', bedSpec: 'derived',
  // Marumi: her balls end at the wave clear; the ball, blast, pin and lob specs follow her stats
  balls: 'calm', ballSpec: 'derived', blastSpec: 'derived', pinSpec: 'derived', lobSpec: 'derived',
  // Tenka: her lab team's record travels (`lb`; the girls who joined are not on the field, and the tier
  // replay never absorbs); her frag / field weapons follow from it and her stats (syncLab; both timers are 0
  // at every wave clear, so a calm point's labAtk is exactly what the restore builds). Her well and Last
  // Line timers count wave time only, so they run on across calm points and travel (`zc`).
  lab: 'snap', labAtk: 'derived', wellCd: 'snap', lastLineCd: 'snap',
  // the duo (src/sim/duo.js): her Refraction counter, her volley count (Potential's full split) and Kohaku's beam
  // timer travel (`du`); the beam's spec follows her stats and buffs (refreshEffective)
  prismN: 'snap', duoVolley: 'snap', duoCd: 'snap', beamSpec: 'derived',
  // the staff heroes (BANNERS §D.6): Norika's own barricades travel (`br`); Hold the Line and One-Way Street's
  // count end at the wave clear; Kogane's Overdrive ends with the wave
  bars: 'snap', lines: 'calm', oneWayN: 'calm', overdriveLeft: 'calm',
});

/**
 * Where a duelist's target was at a calm point (no enemy left: it fell or leaked) and her keepRamp
 * has not yet carried part of her focus over: her next attack does that (src/sim/towers.js
 * attackDuel), so the restore puts back a stand-in that reads as gone the same way.
 */
const GONE_TARGET = Object.freeze({ dead: true, leaked: false });
const LEAKED_TARGET = Object.freeze({ dead: true, leaked: true });

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
  const towers = sim.towers.map((t) => packTower(sim, t));
  return {
    v: snapFormat(sim, towers),
    wave: sim.wave,
    wavesCleared: sim.wavesCleared,
    state: sim.state,
    time: sim.time,
    cash: sim.cash,
    carry: sim._cashCarry,
    lives: sim.lives,
    uid: sim._uid,
    buffs: sim._globalBuffs.filter((b) => b.left > 0 && b.kind !== 'dmg').map((b) => [b.mul, b.left, b.src ?? -1]),
    // team damage buffs in their own key (a build from before them ignores it, never reads it as haste)
    ...(sim._globalBuffs.some((b) => b.left > 0 && b.kind === 'dmg') ? { db: sim._globalBuffs.filter((b) => b.left > 0 && b.kind === 'dmg').map((b) => [b.mul, b.left, b.src ?? -1]) } : {}),
    dps: sim._dpsTimer,
    ...(sim.popBudget != null && sim.popBudget !== POP_BUDGET_MAX ? { pb: sim.popBudget } : {}),
    towers,
    kills: { ...sim.kills },
    enc: [...sim.encountered],
    stats,
    leakGroups: packLeaks(leakLog),
    // the route orientation of the last wave (Reverse Route, Rear Ambush): only where it can turn
    ...(sim._pathsRev ? { rr: sim.routeReversed ? 1 : 0 } : {}),
    // map-scope ability cooldowns still charging (frozen between waves)
    ...(sim.abilGroups?.size ? { ag: [...sim.abilGroups].map(([k, g]) => [k, g.cd, g.cdMax, g.rate]) } : {}),
  };
}

/** One girl's row of the snapshot. */
function packTower(sim, t) {
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
  // (a spike strip adds its hits and lifetime left; only Sticky Tar strips are on the road at a calm point)
  if (traps.length) o.tr = traps.map((tr) => (tr.strip ? [tr.uid, tr.x, tr.y, tr.armed ? 1 : 0, tr.armLeft, tr.hits, tr.ttl] : [tr.uid, tr.x, tr.y, tr.armed ? 1 : 0, tr.armLeft]));
  if (t.stripCursor) o.sc = t.stripCursor;
  if (t.ringTurn) o.rg = t.ringTurn;
  if (t.nets?.length) o.nt = t.nets.map((n) => [n.x, n.y, n.left, n.wave]);
  // limited buffs (path cap): her pick, her brew / link timers and targets, what she holds
  if (t.buffPick >= 0) o.pk = t.buffPick;
  if (t.lim) o.lm = packLim(t.lim);
  if (t.limIn) o.li = [t.limIn.brew, t.limIn.brewLeft, t.limIn.link, t.limIn.oc ? 1 : 0];
  if (t.recentDps || t._dmgMark) o.rd = [t.recentDps, t._dmgMark];
  if (t.banners?.length) o.bn = t.banners.map((b) => [b.x, b.y]);
  else if (t.aim) o.am = [t.aim.x, t.aim.y];
  packPotential(t, o);
  // her ability: cooldown left (charge points), Auto, casts this battle
  if (t.abil) o.ak = [t.abil.cd, t.abil.auto ? 1 : 0, t.abil.n];
  packGear(t, o);
  // Kaede's blade-art count (src/sim/towers.js bladeArts): her next Maple Cleave lands on the same strike
  if (t.bladeN != null) o.kb = t.bladeN;
  // Tenka's lab team (never a hero's row, whose `lb` is her levels bought): rounds, members and coins per
  // class (LAB_CLASSES order), the joiners' wave income, who joined, the joiners' interest rates
  const lab = t.lab;
  if (lab && !t.isHero) o.lb = [lab.rounds, LAB_CLASSES.map((k) => lab.members[k]), LAB_CLASSES.map((k) => lab.coins[k]), lab.income, lab.uids.slice(), (lab.interest || []).slice()];
  // Tenka's well and Last Line timers (wave-time ticks; -1: she has none yet)
  if (t.wellCd != null || t.lastLineCd != null) o.zc = [t.wellCd ?? -1, t.lastLineCd ?? -1];
  // the duo: shells since the last split, volleys since the last full split, Kohaku's beam timer (ticks)
  if (t.prismN != null || t.duoVolley != null || t.duoCd != null) o.du = [t.prismN ?? -1, t.duoVolley ?? -1, t.duoCd ?? -1];
  // Norika's barricades: uid, spot, budget left (drain units), ticks to rebuild
  if (t.bars?.length) o.br = t.bars.map((b) => [b.uid, b.x, b.y, b.hp, b.down]);
  return o;
}

/**
 * packTower's `lb` row back as a lab record (numbers only), or null. `rounds` is at most what her tiers give
 * (`maxRounds`): a lab record never claims an absorb her tiers do not have.
 */
function unpackLab(row, maxRounds) {
  if (!Array.isArray(row)) return null;
  const lab = emptyLab();
  const whole = (v) => Math.max(0, Math.floor(r(v)));
  lab.rounds = Math.min(whole(row[0]), maxRounds);
  LAB_CLASSES.forEach((k, i) => {
    lab.members[k] = whole(Array.isArray(row[1]) ? row[1][i] : 0);
    lab.coins[k] = Math.max(0, r(Array.isArray(row[2]) ? row[2][i] : 0));
  });
  lab.income = Math.max(0, r(row[3]));
  lab.uids = Array.isArray(row[4]) ? row[4].filter((v) => Number.isInteger(v)) : [];
  lab.interest = Array.isArray(row[5]) ? row[5].filter((v) => typeof v === 'number' && v > 0 && v < 1) : [];
  return lab;
}

/** The fields format 3 adds on a girl's row (packPotential). */
const POTENTIAL_FIELDS = ['pc', 'tp', 'pj', 'rk', 'rt', 'ab', 'oc'];

/**
 * The format a snapshot is written in: 3 (SNAP_V) when some girl of the run's team (her loadout or
 * hero entry, or a placed girl) is at P2+ or a row carries a Potential counter; else 2 (SNAP_V_P1).
 * Format 3 only adds Potential's fields and P1 fights bit-identically, so an all-P1 run written as
 * format 2 is one a build from before Potential v3 continues exactly; that build drops a format-3
 * record when it loads the save (cleanRecord, with its dropped-save notice).
 */
function snapFormat(sim, rows) {
  const atP2 = (st) => (Number(st?.potential) || 1) >= 2;
  if ([...sim.loadout.values()].some(atP2)) return SNAP_V;
  if ((sim.heroConfigs || []).some((c) => atP2(c?.stats))) return SNAP_V;
  if (sim.towers.some((t) => atP2(t.unitStats))) return SNAP_V;
  if (rows.some((o) => POTENTIAL_FIELDS.some((k) => k in o))) return SNAP_V;
  return SNAP_V_P1;
}

/**
 * A girl's Potential counters and timers (format 3), each only when she has it (a field she has is
 * kept even at 0, so the restored girl carries exactly the fields the saved one did).
 */
function packPotential(t, o) {
  if (t.potCount != null) o.pc = t.potCount;
  if (t.tempoIdle != null || t.tempoStacks != null) o.tp = t.tempoStacks != null ? [t.tempoIdle ?? -1, t.tempoStacks] : [t.tempoIdle];
  if (t.projCarry != null) o.pj = t.projCarry;
  if (t.rampKeep != null) o.rk = t.rampKeep;
  if (t.rampTarget && t.stats?.keepRamp > 0) o.rt = [t.rampTarget.leaked ? 0 : 1, t.rampStacks];
  if (t.auraBoostLeft != null) o.ab = t.auraBoostLeft;
  if (t.potOc) o.oc = [t.potOc.cd, t.potOc.left];
}

/** packPotential's fields back on a restored girl (numbers only; whole counters as integers). */
function unpackPotential(t, o) {
  const whole = (v) => Math.max(0, Math.floor(r(v)));
  if (o.pc != null) t.potCount = whole(o.pc);
  if (Array.isArray(o.tp)) {
    if (o.tp[0] >= 0) t.tempoIdle = whole(o.tp[0]);
    if (o.tp.length > 1) t.tempoStacks = whole(o.tp[1]);
  }
  if (o.pj != null) t.projCarry = whole(o.pj);
  if (o.rk != null) t.rampKeep = whole(o.rk);
  if (Array.isArray(o.rt)) {
    t.rampTarget = o.rt[0] ? GONE_TARGET : LEAKED_TARGET;
    t.rampStacks = whole(o.rt[1]);
  }
  if (o.ab != null) t.auraBoostLeft = Math.max(0, r(o.ab));
  if (Array.isArray(o.oc)) t.potOc = { cd: r(o.oc[0]), left: Math.max(0, r(o.oc[1])) };
}

/** Gear's counters on a girl (`gr`), each only when she has it: [key, value] pairs. */
// index-coded in the save (`gr`): append only, never reorder
const GEAR_FIELDS = ['pierceCarry', 'droneCarry', 'trickN', 'trapBeatN', 'droneBeatN', 'trapFtN'];
function packGear(t, o) {
  const gr = [];
  GEAR_FIELDS.forEach((k, i) => { if (t[k] != null) gr.push(i, t[k]); });
  if (gr.length) o.gr = gr;
}
function unpackGear(t, o) {
  if (!Array.isArray(o.gr)) return;
  for (let j = 0; j + 1 < o.gr.length; j += 2) {
    const k = GEAR_FIELDS[o.gr[j]];
    if (k) t[k] = Math.max(0, Math.floor(r(o.gr[j + 1])));
  }
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
 * `potentialNew`: the save is from before Potential v3 and a girl in it is at P2+.
 * @returns {{ sim: Sim, refunded: number, dropped: string[], heroes: { unitId: string, level: number, refunded: number }[], potentialNew: boolean }}
 * @throws {StaleSaveError}
 */
export function restoreSim(rec, profile = null) {
  const s = rec?.snap;
  const stage = STAGE_MAP[rec?.stageId];
  if (!stage) throw new StaleSaveError(`unknown stage ${rec?.stageId}`);
  if (!s || !(rec.v <= RECORD_V) || !(s.v <= SNAP_V)) throw new StaleSaveError('save format from a newer build');
  // [events] a difficulty with its own waves (the Golem's Nightmare) restores on that stage, as
  // createBattleSim built it (src/ui/battle/setup.js), so the wave tables match after Continue
  const evStage = eventBattleStage(rec.stageId, rec.difficulty);
  let sim;
  try {
    sim = new Sim({
      stageId: rec.stageId,
      difficulty: rec.difficulty,
      loadout: (rec.loadout || []).map(teamEntry).filter(Boolean),
      hero: teamEntry(rec.hero),
      seed: rec.seed,
      // never options.freeplay: freeplay runs (co-op or solo) are never saved; the run's own battle
      // mode (a record without one: Standard); the Auto-cast setting for abilities unlocked later
      options: {
        endless: !!rec.endless, autoStart: !!profile?.settings?.autoStart, mode: modeId(rec.mode),
        ...(profile?.settings?.autoCastAbilities ? { autoAbilities: true } : null),
      },
      ...(evStage ? { data: { stage: evStage } } : {}),
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
  for (const b of Array.isArray(s.db) ? s.db : []) if (b?.[1] > 0) sim.addGlobalDamageBuff(r(b[0]), r(b[1]), Number.isInteger(b[2]) ? b[2] : -1);
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
    // Tenka's lab team as it was (the tier replay above never absorbs: { restoring: true }), only on a girl
    // whose restored tiers really give her a lab (T2 review saves-4: an edited row, or one on a girl whose
    // tiers did not come back, never hands her lab weapons); then her weapons and the lab count follow
    const labTier = !t.isHero && t.stats.lab?.rounds > 0 ? t.stats.lab.rounds : 0;
    const lab = labTier ? unpackLab(o.lb, labTier) : null;
    if (lab) {
      t.lab = lab;
      sim._refreshTower(t);
    }
    // her well and Last Line timers (wave time), only for a girl whose tiers give her that one
    if (Array.isArray(o.zc)) {
      const whole = (v) => Math.max(0, Math.floor(r(v)));
      if (t.stats.well && Number.isFinite(o.zc[0]) && o.zc[0] >= 0) t.wellCd = whole(o.zc[0]);
      if (t.stats.lastLine && Number.isFinite(o.zc[1]) && o.zc[1] >= 0) t.lastLineCd = whole(o.zc[1]);
    }
    // the duo's counters, only on a girl whose stats carry the duo block (a whole number each; -1: none yet)
    if (Array.isArray(o.du) && t.stats.duo) {
      const whole = (v) => Math.max(0, Math.floor(r(v)));
      if (o.du[0] >= 0) t.prismN = Math.min(whole(o.du[0]), Math.max(0, t.stats.duo.every - 1));
      if (o.du[1] >= 0) t.duoVolley = Math.min(whole(o.du[1]), Math.max(0, t.stats.duo.fullEvery - 1));
      if (o.du[2] >= 0) t.duoCd = Math.min(whole(o.du[2]), 600);
    }
    if (o.tm) sim.setTargetMode(t.uid, o.tm);
    if (Array.isArray(o.am) && Number.isFinite(o.am[0]) && Number.isFinite(o.am[1])) sim.setAim(t.uid, o.am[0], o.am[1]);
    // Ouka's banners, oldest first (setAim keeps at most her count)
    if (Array.isArray(o.bn)) for (const b of o.bn.slice(0, 4)) if (Array.isArray(b) && Number.isFinite(b[0]) && Number.isFinite(b[1])) sim.setAim(t.uid, b[0], b[1]);
    t.spent = r(o.spent);
    t.kills = r(o.kills);
    t.damageDealt = r(o.dmg);
    t.cooldown = r(o.cd);
    t.disabled = r(o.dis);
    t.facing = r(o.face);
    t.buildTimer = r(o.bt);
    unpackPotential(t, o);
    unpackGear(t, o);
    if (o.kb != null) t.bladeN = Math.max(0, Math.floor(r(o.kb)));
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
    // her ability (the tier replay / hero XP above unlocked it at its first charge): the saved state
    if (t.abil && Array.isArray(o.ak)) {
      t.abil.cd = Math.min(t.abil.cdMax, Math.max(0, Math.floor(r(o.ak[0]))));
      t.abil.auto = !!o.ak[1];
      t.abil.n = Math.max(0, Math.floor(r(o.ak[2])));
    }
    const maxDr = t.stats.turret?.max ?? 0;
    const roam = t.turretSpec?.leash > 0;
    (o.dr || []).slice(0, maxDr).forEach((row, i) => {
      if (!Array.isArray(row) || !Number.isInteger(row[0])) return;
      // numbers only, like the rest of the restore: a field that is not a number takes its default
      // (as in an older, shorter row), and a drone with no usable position starts on her
      const d = Array.from({ length: Math.max(3, Math.min(12, row.length)) }, (_, k) => {
        const v = row[k];
        if (k === 1 || k === 2) return Number.isFinite(v) ? v : k === 1 ? t.x : t.y;
        return Number.isFinite(v) ? v : undefined;
      });
      // roaming drones keep their number, slot and counters (an old 5-field row: counters 0,
      // numbered by position); anchored drones are plain points
      t.turrets.push(roam ? restoreDrone(t, d, i) : { uid: d[0], x: d[1] ?? t.x, y: d[2] ?? t.y, facing: d[3] ?? 0, cooldown: d[4] ?? 0 });
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
      if (t.stats.strip) {
        // a carried spike strip (src/sim/strips.js): its hits and lifetime left; it forgot who it hit
        sim.traps.push({
          uid: tr[0], x: tr[1], y: tr[2], ownerUid: t.uid, owner: t, strip: true, extra: false,
          armed: !!tr[3], armLeft: r(tr[4]), hits: Math.max(0, Math.floor(r(tr[5]))), ttl: r(tr[6]), hitUids: [],
        });
      } else sim.traps.push({ uid: tr[0], x: tr[1], y: tr[2], ownerUid: t.uid, armed: !!tr[3], armLeft: tr[4], owner: t });
      t.trapCount++;
    }
    if (Number.isInteger(o.sc) && o.sc > 0) t.stripCursor = o.sc;
    if (Number.isInteger(o.rg) && o.rg > 0 && o.rg < 16) t.ringTurn = o.rg;
    // Norika's barricades, at most her count, each held to her full budget (an older save: fresh spots on the first step)
    if (Array.isArray(o.br) && t.bars && t.stats.barricade) {
      const max = barricadeMax(sim, t.stats.barricade);
      const whole = (v) => Math.max(0, Math.floor(r(v)));
      for (const b of o.br.slice(0, t.stats.barricade.count)) {
        if (!Array.isArray(b) || !Number.isInteger(b[0]) || !Number.isFinite(b[1]) || !Number.isFinite(b[2])) continue;
        const down = Math.min(whole(b[4]), 600);
        t.bars.push({ uid: b[0], x: b[1], y: b[2], hp: down > 0 ? 0 : Math.max(1, Math.min(max, whole(b[3]))), max, down });
      }
    }
    if (Array.isArray(o.nt) && t.nets) {
      for (const n of o.nt.slice(0, t.stats.sentry?.nets ?? 0)) t.nets.push({ x: r(n[0]), y: r(n[1]), left: r(n[2]), wave: Math.floor(r(n[3])) });
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
  // map-scope ability cooldowns ("<owner>|<id>" → points left, full, points a tick)
  for (const g of Array.isArray(s.ag) ? s.ag : []) {
    if (!Array.isArray(g) || typeof g[0] !== 'string' || !/^\d+\|[\w.]+$/.test(g[0])) continue;
    const cdMax = Math.max(0, Math.floor(r(g[2])));
    const cd = Math.min(cdMax, Math.max(0, Math.floor(r(g[1]))));
    const rate = Math.max(1, Math.floor(r(g[3])) || 100);
    if (cd > 0) sim.abilGroups.set(g[0], { cd, cdMax, rate });
  }
  sim.popBudget = s.pb != null ? Math.max(0, Math.min(POP_BUDGET_MAX, Math.floor(r(s.pb)))) : POP_BUDGET_MAX;
  recomputeBuffs(sim); // the brews / links held now multiply on top of the auras
  sim._uid = Math.max(r(s.uid), sim._uid);
  sim.cash = r(s.cash) + refunded;
  sim._cashCarry = r(s.carry);
  sim.lives = r(s.lives);
  sim.wave = r(s.wave);
  sim.wavesCleared = r(s.wavesCleared);
  sim.state = sim.wave > 0 ? 'between' : 'prep';
  sim.time = r(s.time);
  // the route as the last wave walked it (a save without `rr`: that wave's orientation)
  if (sim._pathsRev) sim.setRouteOrientation(s.rr != null ? !!s.rr : sim.routeReversedFor(Math.max(1, sim.wave)));
  sim.kills = { ...(s.kills || {}) };
  sim.encountered = new Set(s.enc || []);
  if (s.stats && typeof s.stats === 'object') sim.stats = { ...sim.stats, ...JSON.parse(JSON.stringify(s.stats)) };
  if (Array.isArray(s.leakGroups)) sim.stats.leakLog = unpackLeaks(s.leakGroups);
  if (!Array.isArray(sim.stats.leakLog)) sim.stats.leakLog = [];
  sim.drainEvents(); // no placement, upgrade or level-up FX / audio for the rebuild
  // a save from before Potential v3 (format 1–2) with a girl at P2+: her frozen Potential now has
  // the v3 steps (the Continue notice says so, docs/specs/POTENTIAL.md v2 §8)
  const potentialNew = !(s.v >= 3) && [...(rec.loadout || []), rec.hero].some((e) => (e?.stats?.potential || 1) >= 2);
  return { sim, refunded, dropped, heroes: migrated, potentialNew };
}

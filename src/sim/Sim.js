// Battle simulation (CONTRACTS.md §6). Pure JS, deterministic for a given seed and
// sequence of player actions, fixed 1/60 s internal timestep.

import { DIFFICULTIES, BATTLE, TARGET_MODES } from '../data/types.js';
import { createRng } from '../core/rng.js';
import {
  STEP, MAX_STEPS_PER_UPDATE, HOLY_SILENCE, AUTO_START_DELAY,
  BUFF_REFRESH, DEFAULT_UNIT_STATS, KNOCKBACK_RESIST, HERO_PUSH_LOCK, FLIGHT_POINT_ROAM_MUL, DPS_WINDOW,
  INCOME_INTEREST_MAX,
} from './constants.js';
import {
  AIM_QUANT, PUSH_LOCK, PUSH_LOCK_KITS, GATHER_RADIUS, GATHER_MAX, CURSE_DECAY, CURSE_MAX_DEPTH, CURSE_BURSTS_PER_TICK, HEX_TIER_MUL,
} from './constants.js';
import { createDataSource } from './data.js';
import { buildPaths, pathTileSet } from './path.js';
import { createPlacementRules, footprintRadius, footprintAt, isTileCall } from './placement.js';
import { SpatialGrid } from './grid.js';
import { crosspathBlock } from './mods.js';
import { finalTierOf, findFinalHolder } from './finalTier.js';
import { updateLimited, limitedRange, buffSources, buffTargets, aurasCovering } from './buffs.js';
import {
  computeHit, applyHitResult, computeDot, BARRIER_BROKE, SHELL_BROKE,
} from './combat.js';
import { applyStatus } from './status.js';
import {
  createEnemy, placeOnPath, updateEnemy, updateEnemyAuras, onEnemyDeath, checkPhases, endPhasing,
  syncStatusFlags, applySpawnMods, applyPressure,
} from './enemies.js';
import {
  createTower, refreshTowerStats, recomputeBuffs, costCutAt, updateTower,
  updateProjectiles, updateTraps, baseCost, setFlight, flightMode, signalRange, hasRoamingDrones, finalePop,
} from './towers.js';
import { POP_BUDGET_MAX, POP_COST } from './gearRules.js';
import { updateShells, aimMode, updateRelayOrigin } from './towers.js';
import { updateRunners } from './runners.js';
import {
  initHero, gainHeroXp, tickHero, heroUltStatus, activateUlt as fireUlt, heroXpInfo, heroPace, waveClearXp,
  damageXp, heroLevelStatus, buyHeroLevel, canMoveHero, moveHero, ultRank,
} from './hero.js';
import { generateWave, summarizeWave, openLanes } from './waves.js';
import { generateFreeplayWave } from './freeplay.js';
import { buildWaveWarnings, buildDebrief } from './report.js';
import { snapshotSim, restoreSim } from './snapshot.js';
import {
  syncAbility, tickAbilities, castAbility as castAbilityOn, abilityStatus as abilityStatusOf, setAbilityAuto as setAbilityAutoOn,
  setAbilityAutoAll as setAbilityAutoAllOn, abilitySlots as abilitySlotsOf, startAbilityWave, endAbilityWave, clearAbilityEffects,
  abilityKill,
} from './abilities.js';
import { applyFoeVuln, bountyMulAt, spreadDot } from './potential.js';
import { syncZones, updateZones, endZoneWave, clearZones, nearExit } from './zones.js';
import { syncLab, absorbInto, updateLab, labIncome, endLabWave } from './lab.js';
import { BATTLE_MODES, modeArmor } from '../data/modes.js';
import { endStripWave } from './strips.js';
import { endRingWave } from './rings.js';
import { endDrinkWave, clearDrinksFrom } from './drinks.js';
import { endSentryWave } from './sentries.js';
import { isFreeTier, payHubBounty, plantBanner, clearBanners } from './hubs.js';
import { onVineKill, endVineWave } from './vines.js';
import { endBallWave } from './balls.js';
import { syncBarricades, updateBarricades, endBarricadeWave, detourOnHit } from './barricades.js';
import {
  createRuleRuntime, routeReversedFor, routeFlippedFor, reversePath, rebuildRuleTables, ruleStep, ruleWaveStart,
  ruleWaveEnd, ruleWaveClear, ruleBountyAdd, ruleHitScale, ruleDotScale, assignPads, ruleInfo, ruleAffinityFor,
} from './rules.js';
import {
  createTryout, tryoutLoadouts, tryoutCanStart, tryoutWaveStart, tryoutWaveEnd, tryoutTick, tryoutSpawn, tryoutKill, tryoutLeak,
  tryoutCount, tryoutPlaceCost, tryoutPlaced, tryoutTowerMods, tryoutUpgradeCost, tryoutUpgraded, tryoutResult, tryoutCommand,
  tryoutMove, windowOpen, tryoutBackGate, tryoutCanHeal,
} from './tryout/index.js';
import { assignSeats, nextSeats } from './tryout/breaks.js';
import { hasCards, refreshRunMods } from './tryout/pep.js';

const MAX_EVENT_BACKLOG = 20000;

/** Rounds coin costs to a multiple of 5 (min 5). */
export function roundCost(c) {
  return Math.max(5, Math.round(c / 5) * 5);
}

/** Sim → the last openLanes() answer (render-side cache; outside the Sim's fields and its snapshots). */
const LANE_MEMO = new WeakMap();

export class Sim {
  /**
   * @param {{ stageId?: string, difficulty?: string, loadout?: {unitId: string, stats?: object}[],
   *   hero?: {unitId: string, stats?: object}|null, heroes?: ({unitId: string, stats?: object}|null)[],
   *   seed?: number, options?: { endless?: boolean, autoStart?: boolean, freeplay?: boolean, mode?: string, rule?: object|null },
   *   data?: { stage?, map?, units?, enemies? } }} opts
   * `heroes` (co-op): one hero per player, by player index; `hero` is the solo form (= heroes[0]).
   */
  constructor({ stageId, difficulty = 'normal', loadout = [], hero = null, heroes = null, seed = 1, options = {}, data = {} } = {}) {
    const ds = createDataSource(stageId ?? data.stage?.id, data || {});
    this.data = ds;
    this.stage = ds.stage;
    this.stageId = ds.stage.id;
    this.map = ds.map;
    this.difficulty = DIFFICULTIES[difficulty] ? difficulty : 'normal';
    this.diff = DIFFICULTIES[this.difficulty];
    // Tryout Day (src/sim/tryout): its config is read once here and never kept in options (a snapshot stores options)
    const { tryout: tryoutCfg = null, ...opts } = options;
    this.options = { endless: false, autoStart: false, ...opts };
    this.seed = seed;
    this.rng = createRng(seed);

    // Battle mode (src/data/modes.js) and map rule (src/data/rules.js; options.rule overrides the
    // stage's for tests and headless runs, null = no rule). docs/specs/CODEX_MODES.md §6.
    this.mode = BATTLE_MODES[this.options.mode] && Object.hasOwn(BATTLE_MODES, this.options.mode) ? BATTLE_MODES[this.options.mode] : BATTLE_MODES.standard;
    this.incomeMul = this.mode.incomeMul ?? 1;
    this._modeArmor = modeArmor(this.mode, this.stage, this.difficulty);
    this.rule = createRuleRuntime(this.options.rule !== undefined ? this.options.rule : this.stage.rule ?? null);
    // geometry caches (placement, wave lengths, pads, vents) come from the forward paths; only the
    // live pathData (what enemies walk) turns with Reverse Route and Rear Ambush
    this._pathsFwd = buildPaths(this.map);
    if (!this._pathsFwd.length) throw new Error(`[sim] map "${this.map.id}" has no paths`);
    this._pathsRev = this.mode.reverse || this.rule?.reverseEvenWaves ? this._pathsFwd.map(reversePath) : null;
    this.routeReversed = routeReversedFor(this, 1);
    this.pathData = this.routeReversed ? this._pathsRev : this._pathsFwd;
    this.paths = this.pathData.map((p) => p.points.map((pt) => [pt[0], pt[1]]));
    this.pathTiles = pathTileSet(this.map);
    this.placement = createPlacementRules(this.map, this._pathsFwd);

    this.loadout = new Map();
    // Heroes, one per player (co-op: index = player index). heroConfigs[i] = { unitId, stats, index };
    // heroes[i] = her placed tower or null. `hero` / `heroConfig` are getters for the active
    // (viewing or commanding) player's: never read them inside the step (see the view trap below).
    const heroCfg = (h) => (h && ds.unit(h.unitId) ? { unitId: h.unitId, stats: { ...DEFAULT_UNIT_STATS, ...(h.stats || {}) } } : null);
    let fromLoadout = null;
    for (const entry of loadout || []) {
      const def = entry && ds.unit(entry.unitId);
      if (!def) continue;
      const stats = { ...DEFAULT_UNIT_STATS, ...(entry.stats || {}) };
      if (def.kind === 'hero') {
        if (!fromLoadout) fromLoadout = { unitId: def.id, stats };
      } else this.loadout.set(def.id, stats);
    }
    const cfgs = Array.isArray(heroes) ? heroes.slice(0, 2).map(heroCfg) : [heroCfg(hero) || (hero ? null : fromLoadout)];
    this.heroConfigs = cfgs.map((c, i) => (c ? { ...c, index: i } : null));
    this._heroConfig = this.heroConfigs[0] || null;
    this.heroes = this.heroConfigs.map(() => null);
    this._stepping = false;

    this.endless = !!this.options.endless || !Number.isFinite(this.stage.waves);
    this.totalWaves = this.endless ? Infinity : this.stage.waves ?? 10;
    // Co-op freeplay (options.freeplay + stage.freeplay = the tier's table, src/data/freeplay.js):
    // totalWaves stays the goal (the "15" of 16/15). Clearing it emits a non-terminal 'goal' event;
    // waves past it come from generateFreeplayWave, and the run ends on defeat or finish() (a
    // Finish vote) — there is no last wave unless the table sets maxWave.
    this.freeplay = !this.endless && !!this.options.freeplay && !!this.stage.freeplay && Number.isFinite(this.totalWaves);
    this.lastWave = this.freeplay ? Math.max(this.totalWaves, this.stage.freeplay.maxWave ?? Infinity) : this.totalWaves;
    /** Past this wave (freeplay, solo endless on a campaign map) a rule keeps only its combat effects. */
    this._ruleGoal = Number.isFinite(this.stage.waves) ? this.stage.waves : Infinity;
    /** Freeplay pressure of the current wave (flat armor, Resolve budgets) for every enemy entering it. */
    this._fp = null;
    /** A freeplay run ended by finish() (state 'won' after the goal), not by defeat. */
    this.finished = false;
    this.maxLives = this.mode.oneLife ? 1 : this.diff.lives ?? this.stage.lives ?? 100;
    this.lives = this.maxLives;
    this.cash = Math.round(this.stage.startCash ?? 650);
    // Stage economy scale (kill bounties + wave-clear bonus). Late stages pay more so tier 4–5
    // upgrades (1.8k–16k coins) become reachable as enemy HP grows; tower income is unscaled.
    this.cashScale = Number.isFinite(this.stage.cashScale) && this.stage.cashScale > 0 ? this.stage.cashScale : 1;
    this.state = 'prep';
    this.wave = 0;
    this.wavesCleared = 0;
    this.time = 0;

    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.traps = [];
    this.fields = [];
    this.encountered = new Set();
    this.kills = {};
    // leaks = lives lost; leakLog/leaksByEnemy/leaksByWave feed the defeat debrief.
    this.stats = {
      damageByTower: {}, damageByType: {}, leaks: 0, cashEarned: 0, cashSpent: 0, enemiesLeaked: 0, towersPlaced: 0,
      upgrades: 0, ultsUsed: 0, leakLog: [], leaksByEnemy: {}, leaksByWave: {}, towerUnits: {},
      heroXp: { time: 0, wave: 0, damage: 0, bought: 0, restore: 0 }, heroLevelsBought: 0,
    };
    this.warnings = [];
    this.globalRateMul = 1;
    // roster merge mechanics (ROSTER_SPEC §6): mortar shells in flight, the team damage buff
    this.shells = [];
    this.globalDmgMul = 1;

    this.events = [];
    this._uid = 1;
    this._acc = 0;
    this._cashCarry = 0;
    this._towerByUid = new Map();
    this._spawnQueue = [];
    this._spawnIndex = 0;
    this._waveTime = 0;
    this._waveHpMul = 1;
    this._waveCache = new Map();
    this._autoTimer = -1;
    this._buffTimer = 0;
    this._buffsDirty = true;
    this._globalBuffs = [];
    // Abilities (src/sim/abilities.js): map-scope cooldowns per player ("<owner>|<id>" → { cd, cdMax,
    // rate }), econ casts per player this wave, running rallies and queued hits / shells (both empty at
    // every calm point), owner-credited coins (null solo: straight to cash; co-op sets [0, 0] and moves
    // them into the wallets after every command and step), each player's Auto-cast setting (default
    // Off) and how many girls have an ability (0: the step skips it all).
    this.abilGroups = new Map();
    this.abilUses = [0, 0];
    this._rallies = [];
    this._abilQueue = [];
    this.ownerCash = null;
    this.abilityAutoDefault = [!!this.options.autoAbilities, false];
    this._abilOn = 0;
    /** Seconds until every girl's recentDps is re-measured (src/sim/buffs.js). */
    this._dpsTimer = DPS_WINDOW;
    /** Finale Pop's budget for the whole battle, in half-pops (src/sim/gearRules.js). */
    this.popBudget = POP_BUDGET_MAX;
    this._scratch = [];
    this._scratch2 = [];
    this._hitOut = {};
    this._dotOut = {};
    this._statusCtx = { rng: this.rng, element: null, attackType: null, sourceUid: null, hitDamage: 0, curseDepth: 0 };
    this._curseCtx = { rng: this.rng, element: null, attackType: 'mystic', sourceUid: null, hitDamage: 0, curseDepth: 0 };
    this._curseQueue = [];
    this._flushingCurses = false;
    this._curseBudget = CURSE_BURSTS_PER_TICK; // bursts left this step (refilled at every step)
    this.runners = []; // path runners in flight (Seiran's sky dragon): end with the wave
    this._leadPt = {}; // scratch point (a mortar's lead)
    this._scratch3 = [];
    this._relaySamples = null;
    this.grid = new SpatialGrid(-3, -3, (this.map.width || 20) + 3, (this.map.height || 12) + 3, 2);
    if (this.rule) {
      this._waveTick = 0;
      this._bountyAdd = ruleBountyAdd(this.rule.def, this);
      rebuildRuleTables(this);
    }
    if (tryoutCfg) this._initTryout(tryoutCfg);
  }

  /**
   * Tryout Day (docs/specs/TRYOUT_DAY.md): `cfg` = { seed, grade, length, mapId, players: [{ squad }], pools:
   * [{ girlId: account stats }], squads?, period? } (squads / period: a restore's, §12.2). The heroes come in
   * the usual hero arguments with their account stats; the run bands them. Fields the snapshot skips
   * (REBUILT): _tryoutCfg (the pools and the heroes' account stats), _loadouts (each player's loadout map),
   * viewOwner (the viewing or commanding player; co-op's view() sets it).
   */
  _initTryout(cfg) {
    const n = Math.max(1, Math.min(2, cfg.players?.length || 1));
    const players = (cfg.players || [{}]).slice(0, n);
    this._tryoutCfg = { ...cfg, players, pools: (cfg.pools || []).slice(0, n), heroAcct: this.heroConfigs.map((c) => (c ? { ...c.stats } : null)) };
    this.viewOwner = 0;
    this.loadout.clear();
    this._loadouts = players.map((_, i) => (i === 0 ? this.loadout : new Map()));
    tryoutLoadouts(this, cfg.squads || players.map((p) => p.squad || []), cfg.period || 1);
    createTryout(this, this._tryoutCfg);
    if (cfg.squads) this.tryout.players.forEach((p, i) => { p.squad = cfg.squads[i].slice(); });
    // Back Gate (History) flips even waves: the reversed paths, built when any period may offer it
    if (!this._pathsRev && tryoutBackGate(this)) {
      this._pathsRev = this._pathsFwd.map(reversePath);
    }
  }

  /** A Tryout Day run command for player `slot` (solo: 0): see src/sim/tryout/index.js tryoutCommand. */
  tryoutCommand(slot, op, args = []) {
    return this.tryout ? tryoutCommand(this, slot, op, args) : { ok: false, reason: 'noRun' };
  }

  /** A Tryout Day Hall Pass move for player `slot`. */
  tryoutMove(slot, uid, x, y) {
    return this.tryout ? tryoutMove(this, slot, uid, x, y) : { ok: false, reason: 'noRun' };
  }

  /** Is a Tryout Day pick or break open (the next wave waits)? */
  tryoutWindowOpen() {
    return !!this.tryout && windowOpen(this);
  }

  /** The run's seat assigner (rules.js assignPads hands runs over to it). */
  tryoutSeats() {
    // placement cards (Desk Partners, Quiet Corner) read where the girls stand: re-folded on every placement, sale and move
    if (hasCards(this, (c) => c?.group === 'placement')) refreshRunMods(this);
    assignSeats(this);
  }

  /** A run's per-player counter (hero.js: ults). */
  tryoutCount(owner, key, n = 1) {
    if (this.tryout) tryoutCount(this, owner, key, n);
  }

  // -------------------------------------------------------------------------
  // The active player's hero (view-dependent: never read inside the step)
  // -------------------------------------------------------------------------

  /** The active player's placed hero (solo: the hero; co-op: the viewing / commanding player's). */
  get hero() {
    if (this._stepping && globalThis.__SIM_VIEW_TRAP__) throw new Error('[sim] sim.hero read inside the step (use sim.heroes or the tower)');
    const c = this._heroConfig;
    return c ? this.heroes[c.index] || null : null;
  }

  /** The active player's hero config ({ unitId, stats, index }) or null. */
  get heroConfig() {
    if (this._stepping && globalThis.__SIM_VIEW_TRAP__) throw new Error('[sim] sim.heroConfig read inside the step (use sim.heroConfigs)');
    return this._heroConfig;
  }

  set heroConfig(c) {
    this._heroConfig = c || null;
  }

  // -------------------------------------------------------------------------
  // Main loop
  // -------------------------------------------------------------------------

  /** Advances game time by dt seconds (fixed 1/60 steps; dt up to 1 s per call is safe). */
  update(dt) {
    if (!(dt > 0)) return;
    this._acc += Math.min(dt, 1);
    let steps = 0;
    while (this._acc >= STEP - 1e-9 && steps < MAX_STEPS_PER_UPDATE) {
      this._acc -= STEP;
      steps++;
      if (this.state === 'won' || this.state === 'lost') {
        this._acc = 0;
        break;
      }
      this._step(STEP);
    }
    if (steps >= MAX_STEPS_PER_UPDATE) this._acc = 0;
  }

  _step(dt) {
    this._stepping = true;
    try {
      this._step1(dt);
    } finally {
      this._stepping = false;
    }
  }

  _step1(dt) {
    this.time += dt;
    if (this.popBudget < POP_BUDGET_MAX) this.popBudget += 1;
    if (this.state === 'wave') this._spawnTick(dt);
    this.grid.rebuild(this.enemies);
    if (this.rule) ruleStep(this, dt);
    // curse bursts that spilled over the last step's budget go first, in FIFO order
    this._curseBudget = CURSE_BURSTS_PER_TICK;
    if (this._curseQueue.length && !this._flushingCurses) this._flushCurses();
    updateEnemyAuras(this);
    // Norika's barricades: spots, rebuilds and Hold the Line timers, before the enemies move into them
    if (this._blockOn) updateBarricades(this);
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.dead) updateEnemy(this, e, dt);
      if (this.state === 'lost') return;
    }
    this._updateBuffs(dt);
    // abilities: charge, expire, queued shells, auto-cast — before the girls attack, so a boost or a
    // rally cast this step applies this step
    if (this._abilOn > 0 || this.abilGroups.size > 0) tickAbilities(this);
    for (let i = 0; i < this.towers.length; i++) updateTower(this, this.towers[i], dt);
    // Tenka's lab weapons (src/sim/lab.js): only once a girl has a lab team
    if (this._labOn) updateLab(this);
    updateProjectiles(this, dt);
    updateTraps(this, dt);
    // zones (Tenka's wells and Last Line, src/sim/zones.js): only once a girl with one was placed
    if (this.zones) updateZones(this, dt);
    updateShells(this, dt);
    if (this.runners.length) updateRunners(this, dt);
    this._removeDead();
    tickHero(this, dt);
    this._checkWaveEnd();
    if (this.tryout) tryoutTick(this);
    if (this.state === 'between' && this._autoTimer >= 0) {
      this._autoTimer -= dt;
      if (this._autoTimer <= 0) {
        this._autoTimer = -1;
        this.startNextWave();
      }
    }
  }

  _removeDead() {
    const list = this.enemies;
    let n = 0;
    for (let i = 0; i < list.length; i++) if (!list[i].dead) list[n++] = list[i];
    list.length = n;
  }

  _updateBuffs(dt) {
    updateLimited(this, dt);
    if (this._globalBuffs.length) {
      let rate = 1;
      let dmg = 1;
      for (const b of this._globalBuffs) {
        b.left -= dt;
        if (b.left <= 0) continue;
        if (b.kind === 'dmg') dmg = Math.max(dmg, b.mul);
        else rate = Math.max(rate, b.mul);
      }
      this._globalBuffs = this._globalBuffs.filter((b) => b.left > 0);
      if (rate !== this.globalRateMul || dmg !== this.globalDmgMul) {
        this.globalRateMul = rate;
        this.globalDmgMul = dmg;
        this._buffsDirty = true;
      }
    }
    this._buffTimer -= dt;
    if (this._buffsDirty || this._buffTimer <= 0) {
      recomputeBuffs(this);
      this._buffsDirty = false;
      this._buffTimer = BUFF_REFRESH;
      // Potential N6 (Miko's Shimenawa Circle): enemies inside her aura turn Brittle, on every refresh
      applyFoeVuln(this);
    }
  }

  /**
   * Multiplies every tower's attack rate for `duration` seconds (strongest active buff wins). `src` = the
   * uid of the girl who cast it (the buff icons; the hero ultimate passes its caster), -1 = nobody. No
   * default from the view getter `sim.hero`: in co-op both players' heroes can cast it.
   */
  addGlobalRateBuff(mul, duration, src = -1) {
    this._globalBuffs.push({ kind: 'rate', mul, left: duration, src });
    this.globalRateMul = Math.max(this.globalRateMul, mul);
    this._buffsDirty = true;
  }

  /**
   * Multiplies every girl's damage (incl. traps/turrets) for `duration` seconds (strongest active
   * wins). `src` = the caster's uid (the buff icons), -1 = nobody.
   */
  addGlobalDamageBuff(mul, duration, src = -1) {
    if (!(mul > 1) || !(duration > 0)) return;
    this._globalBuffs.push({ kind: 'dmg', mul, left: duration, src });
    this.globalDmgMul = Math.max(this.globalDmgMul, mul);
    this._buffsDirty = true;
  }

  // -------------------------------------------------------------------------
  // Events / ids / cash
  // -------------------------------------------------------------------------

  /** Queues an event. A payload built for it that already carries this `type` first (a hit) is queued as is, uncopied. */
  _emit(type, payload) {
    if (this.events.length >= MAX_EVENT_BACKLOG) this.events.splice(0, this.events.length >> 1);
    this.events.push(payload.type === type ? payload : { type, ...payload });
  }

  /** Returns and clears every event since the last call. */
  drainEvents() {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  _nextUid() {
    return this._uid++;
  }

  _gainCash(amount) {
    if (!(amount > 0)) return 0;
    this._cashCarry += amount;
    const whole = Math.floor(this._cashCarry + 1e-9);
    this._cashCarry -= whole;
    this.cash += whole;
    this.stats.cashEarned += whole;
    return whole;
  }

  /**
   * Owner-credited coins (an econ ability; GAPS P-16): whole coins for player `owner`. Solo: straight
   * into cash. Co-op (ownerCash set): into ownerCash[owner], which the command layer moves into that
   * player's wallet, never into the pooled cash a step splits between the players.
   * @returns {number} coins credited
   */
  _gainCashFor(owner, amount) {
    if (!(amount > 0)) return 0;
    const whole = Math.floor(amount + 1e-9);
    if (!(whole > 0)) return 0;
    this.stats.cashEarned += whole;
    if (this.ownerCash) this.ownerCash[owner] = (this.ownerCash[owner] || 0) + whole;
    else this.cash += whole;
    return whole;
  }

  _spend(amount) {
    this.cash -= amount;
    this.stats.cashSpent += amount;
  }

  // -------------------------------------------------------------------------
  // Enemies
  // -------------------------------------------------------------------------

  /**
   * Spawns an enemy (waves, broods, summons, decoys; also handy for tests/debug).
   * `hpMul` is absolute (summons, splits); `waveHpMul` replaces the wave's HP multiplier for this
   * spawn only (freeplay bosses carry their rank factor; what they summon still gets the wave's);
   * `childHpMul` (absolute) is what this enemy's own summons / brood get (default: hpMul).
   * The bosses a freeplay titan breaks into carry the titan's pool multiplier on that way.
   * `speedMul`, `leak` and `mods` (a freeplay affix) come from freeplay wave spawns.
   * @param {string} enemyId
   * @param {{ pathIndex?: number, dist?: number, hpMul?: number, waveHpMul?: number, childHpMul?: number, speedMul?: number,
   *   leak?: number, mods?: object, parent?: object }} o
   * @returns {object|null} EnemyRT
   */
  spawnEnemy(enemyId, o = {}) {
    const def = this.data.enemy(enemyId);
    if (!def) {
      this.warnings.push(`unknown enemy "${enemyId}"`);
      return null;
    }
    const pathIndex = ((o.pathIndex ?? 0) % this.pathData.length + this.pathData.length) % this.pathData.length;
    const base = (this.stage.hpScale ?? 1) * this.diff.hpMul;
    const hpMul = o.hpMul ?? base * (o.waveHpMul ?? this._waveHpMul);
    const childHpMul = o.childHpMul ?? o.hpMul ?? base * this._waveHpMul;
    const e = createEnemy(def, {
      uid: this._nextUid(),
      pathIndex,
      dist: o.dist ?? 0,
      hpMul,
      childHpMul,
      speedMul: (this.diff.speedMul ?? 1) * (o.speedMul ?? 1) * (this.mode.speedMul ?? 1),
      cashMul: (this.diff.cashMul ?? 1) * this.cashScale * this.incomeMul,
      time: this.time,
      rng: this.rng,
      wave: this.wave,
    });
    if (o.parent) e.parentUid = o.parent.uid;
    if (o.leak != null) e.leak = o.leak;
    if (o.mods) applySpawnMods(e, o.mods);
    if (this.tryout) tryoutSpawn(this, e);
    if (this._fp) applyPressure(e, this._fp);
    if (this._modeArmor) {
      const add = e.tier === 'boss' || e.tier === 'miniboss' ? this._modeArmor * (this.mode.bossArmorMul ?? 1) : this._modeArmor;
      e.armor += add;
      e.armorBonus = (e.armorBonus || 0) + add;
    }
    if (this._bountyAdd && e.bounty > 0 && this.wave <= this._ruleGoal) e.bounty += this._bountyAdd;
    placeOnPath(e, this.pathData[pathIndex]);
    this.enemies.push(e);
    this.encountered.add(def.id);
    this._emit('spawn', { uid: e.uid, id: def.id, pathIndex, x: e.x, y: e.y, parentUid: e.parentUid });
    return e;
  }

  _spawnTick(dt) {
    this._waveTime += dt;
    const q = this._spawnQueue;
    while (this._spawnIndex < q.length && q[this._spawnIndex].t <= this._waveTime) {
      const s = q[this._spawnIndex++];
      this.spawnEnemy(s.enemyId, { pathIndex: s.pathIndex, dist: 0, waveHpMul: s.hpMul, speedMul: s.speedMul, leak: s.leak, mods: s.mods });
    }
  }

  /**
   * Resolves one direct hit from a tower (or hero/trap/turret spec) on an enemy, then
   * applies on-hit effects. `drone`: the roaming drone that fired it (per-drone credit).
   * @returns {number} damage dealt, -1 if the enemy was not eligible
   */
  _hit(e, tower, spec, scale = 1, drone = null) {
    if (e.dead) return -1;
    const roll = spec.critChance > 0 ? this.rng.next() : 1;
    if (this._ruleMul) scale *= ruleHitScale(this._ruleMul, tower, spec.attackType, spec.element);
    const res = computeHit(e, spec, roll, scale, this._hitOut);
    if (!res) return -1;
    const hpBefore = e.hp;
    const flags = applyHitResult(e, res, spec.share);
    const dealt = Math.min(res.toHp, Math.max(0, hpBefore)) + res.toBarrier;
    e.flash = 1;
    e.lastDamageAt = this.time;
    // (`tick`: a constant beam's damage tick, src/sim/duo.js: the display sums those instead of popping each)
    // (one object per hit event: built with its type, so _emit queues it uncopied)
    if (spec.tick) {
      this._emit('hit', {
        type: 'hit', uid: e.uid, x: e.x, y: e.y, amount: res.toHp + res.toBarrier, crit: res.crit, attackType: spec.attackType, effective: res.effective, tick: true,
      });
    } else {
      this._emit('hit', {
        type: 'hit', uid: e.uid, x: e.x, y: e.y, amount: res.toHp + res.toBarrier, crit: res.crit, attackType: spec.attackType, effective: res.effective,
      });
    }
    if (flags & BARRIER_BROKE) this._emit('barrierBreak', { uid: e.uid });
    if (flags & SHELL_BROKE) this._emit('shellBreak', { uid: e.uid });
    this._credit(tower, dealt, e, drone);
    this.stats.damageByType[spec.attackType] = (this.stats.damageByType[spec.attackType] || 0) + dealt;
    if (e.hp <= 0) {
      this._killEnemy(e, tower, drone);
      return dealt;
    }
    this._onHitEffects(e, tower, spec);
    checkPhases(this, e);
    return dealt;
  }

  _applyStatusEvent(e, spec, ctx) {
    const r = applyStatus(e, spec, ctx);
    if (r === 'new') this._emit('status', { uid: e.uid, status: spec.type });
    if (r && spec.type === 'silence' && e.phasing) endPhasing(this, e);
    return r;
  }

  _onHitEffects(e, tower, spec) {
    const ctx = this._statusCtx;
    ctx.element = spec.element || null;
    ctx.attackType = spec.attackType;
    ctx.sourceUid = tower ? tower.uid : null;
    ctx.hitDamage = spec.damage || 0; // curse burst = burstMul × this hit (after buffs, before crit/ramp)
    ctx.curseDepth = 0;
    const list = spec.status;
    if (list) for (let i = 0; i < list.length; i++) this._applyStatusEvent(e, list[i], ctx);
    // a Potential rhythm's own statuses (src/sim/potential.js N3): after hers and never merged into
    // them, so a rhythm freeze is sure while her own chance freeze still rolls
    const pst = spec.procStatus;
    if (pst) for (let i = 0; i < pst.length; i++) this._applyStatusEvent(e, pst[i], ctx);
    if (spec.mark && spec.mark.bonus > 0) this._applyStatusEvent(e, { type: 'mark', bonus: spec.mark.bonus, duration: spec.mark.duration || 3 }, ctx);
    if (spec.silence > 0) this._applyStatusEvent(e, { type: 'silence', duration: spec.silence }, ctx);
    if (spec.reveal > 0) this._applyStatusEvent(e, { type: 'reveal', duration: spec.reveal }, ctx);
    if (spec.attackType === 'holy') {
      if (e.phasing) endPhasing(this, e);
      if (e.traits.field) this._applyStatusEvent(e, { type: 'silence', duration: HOLY_SILENCE }, ctx);
    }
    // push lock (roster B3): a girl in PUSH_LOCK_KITS (Fuu; or a spec with `pushLock`) moves an enemy at most once
    // per PUSH_LOCK window; a hero's own push-back has its own shorter lock (HERO_PUSH_LOCK, hero
    // rework). The two never block each other, and the live girls' pushes stay unlocked, as on live.
    if (spec.knockback > 0) {
      const hero = !!tower?.isHero;
      const locks = !hero && (PUSH_LOCK_KITS.includes(tower?.unitId) || spec.pushLock === true);
      if (!(hero ? e.heroPushLock > this.time : locks && e.pushLock > 0)) {
        // (Marumi's Bowling Thunder, spec.pushBig: minibosses take the whole push)
        let amt = spec.knockback * (spec.pushBig === true && e.tier === 'miniboss' ? 1 : (KNOCKBACK_RESIST[e.tier] ?? 1));
        if (e.kbLeft != null) { amt = Math.min(amt, e.kbLeft); e.kbLeft -= amt; }
        if (amt > 0) {
          e.dist = Math.max(0, e.dist - amt);
          placeOnPath(e, this.pathData[e.pathIndex]);
          if (hero) e.heroPushLock = this.time + HERO_PUSH_LOCK;
          else if (locks) e.pushLock = PUSH_LOCK[e.tier] ?? PUSH_LOCK.normal;
        }
      }
    }
    if (spec.gather > 0 && !e.dead) this._gather(e, spec.gather);
    // Norika's Detour Sign: her waves send an enemy still before a fork down the longer branch
    if (spec.barricade?.detour && !e.dead) detourOnHit(this, e);
    syncStatusFlags(e);
  }

  /**
   * Gather: enemies AHEAD of `e` on its path within GATHER_RADIUS are pulled back toward it by
   * `amount` of the gap (max GATHER_MAX). Never minibosses/bosses, never past `e`, push lock respected.
   */
  _gather(e, amount) {
    const f = Math.min(GATHER_MAX, amount);
    const path = this.pathData[e.pathIndex];
    const near = this._scratch3;
    near.length = 0;
    this.grid.query(e.x, e.y, GATHER_RADIUS, near);
    for (let i = 0; i < near.length; i++) {
      const q = near[i];
      if (q === e || q.dead || q.hidden || q.pathIndex !== e.pathIndex) continue;
      if (q.tier === 'miniboss' || q.tier === 'boss') continue;
      if (q.dist <= e.dist || q.pushLock > 0) continue;
      q.dist -= (q.dist - e.dist) * f;
      placeOnPath(q, path);
      q.pushLock = PUSH_LOCK[q.tier] ?? PUSH_LOCK.normal;
    }
    near.length = 0;
  }

  /**
   * Hex tick (UNIT_GAPS P-15): pct × max HP × the tier factor per second, straight off HP (plain
   * arithmetic: no armor, barrier or type chart), never more than the application's cap.
   */
  _hex(e, st, dt) {
    let amount = st.pct * e.maxHp * (HEX_TIER_MUL[e.tier] ?? 1) * dt;
    if (amount > st.cap) amount = st.cap;
    if (!(amount > 0)) return;
    st.cap -= amount;
    const before = e.hp;
    e.hp -= amount;
    e.lastDamageAt = this.time;
    const tower = st.sourceUid != null ? this._towerByUid.get(st.sourceUid) || null : null;
    const dealt = Math.min(amount, Math.max(0, before));
    this._credit(tower, dealt, e);
    this.stats.damageByType.hex = (this.stats.damageByType.hex || 0) + dealt;
    if (e.hp <= 0) this._killEnemy(e, tower);
    else checkPhases(this, e);
  }

  /** Burn/poison tick. */
  _dot(e, kind, amount, status) {
    if (!(amount > 0) || e.dead) return;
    // rule scaling for girls' burns and poison (a vent's burn has no source and is not scaled)
    if (this._ruleMul && status.sourceUid != null) amount *= ruleDotScale(this._ruleMul, this._towerByUid.get(status.sourceUid) || null, kind);
    const res = computeDot(e, kind, amount, status.attackType, this._dotOut);
    const hpBefore = e.hp;
    if (res.toBarrier > 0) {
      e.barrier -= res.toBarrier;
      if (e.barrier <= 1e-6) {
        e.barrier = 0;
        this._emit('barrierBreak', { uid: e.uid });
      }
    }
    e.hp -= res.toHp;
    e.lastDamageAt = this.time;
    const tower = status.sourceUid != null ? this._towerByUid.get(status.sourceUid) || null : null;
    const dealt = Math.min(res.toHp, Math.max(0, hpBefore)) + res.toBarrier;
    this._credit(tower, dealt, e);
    this.stats.damageByType[kind] = (this.stats.damageByType[kind] || 0) + dealt;
    if (e.hp <= 0) this._killEnemy(e, tower);
    else checkPhases(this, e);
  }

  /**
   * Credits damage to a girl. Seam S1 (docs/specs/LANDING_PLAN.md §4): `e` is the enemy hit (a
   * hero's damage XP is measured in its base HP), `drone` the roaming drone that dealt it (its
   * counters and the girl's droneDmg; DoTs always credit the girl).
   */
  _credit(tower, dealt, e = null, drone = null) {
    if (!tower || !(dealt > 0)) return;
    tower.damageDealt += dealt;
    if (drone) {
      drone.dmg += dealt;
      tower.droneDmg += dealt;
    }
    this.stats.damageByTower[tower.uid] = (this.stats.damageByTower[tower.uid] || 0) + dealt;
    if (tower.isHero && !tower.removed) gainHeroXp(this, tower, damageXp(dealt, e), 'damage');
  }

  _killEnemy(e, tower, drone = null) {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    // Potential N7 (Momo's Lucky Pouch): a kill inside her range pays × her bounty aura (1 = none)
    const bm = bountyMulAt(this, e.x, e.y);
    const bounty = this._gainCash(bm > 1 ? e.bounty * bm : e.bounty);
    if (this._hubBounty) payHubBounty(this, e); // Ouka's Sponsorship (src/sim/hubs.js)
    this.kills[e.id] = (this.kills[e.id] || 0) + 1;
    if (this.tryout) tryoutKill(this, e);
    // a rally that brings lives back counts the kills near its caster (Noa's First Aid Call; only while a rally runs)
    if (this._rallies.length) abilityKill(this, e);
    if (tower && !tower.removed) {
      tower.kills++;
      if (!drone && tower.stats?.vine) onVineKill(this, tower, e); // Chigusa's thorn beds (src/sim/vines.js)
      if (drone) {
        drone.kills++;
        tower.droneKills++;
      }
    }
    this._emit('death', { uid: e.uid, id: e.id, x: e.x, y: e.y, bounty });
    // Pyrotechnics' Finale Pop (gear-stats §C.3)
    if (tower && this.popBudget >= POP_COST) finalePop(this, tower, e);
    // Potential N9 (Akane's Ember Leap): her burn leaps on to the nearest enemy
    if (e.statuses.burn || e.statuses.poison) spreadDot(this, e);
    onEnemyDeath(this, e);
    const c = e.statuses.curse;
    if (c && c.burst > 0) {
      this._curseQueue.push({
        x: e.x, y: e.y, burst: c.burst, radius: c.radius, duration: c.duration, depth: c.depth || 0, sourceUid: c.sourceUid ?? null,
      });
      if (!this._flushingCurses) this._flushCurses();
    }
  }

  /**
   * Curse bursts, FIFO: each entry hits every living, visible enemy within its radius for its
   * burst (mystic, ignores veils/air) and survivors catch a CURSE_DECAY-weaker curse while the
   * generation stays ≤ CURSE_MAX_DEPTH. Kills inside the loop only enqueue (no recursion). At most
   * CURSE_BURSTS_PER_TICK bursts per step; the rest wait in the queue for the next step.
   */
  _flushCurses() {
    this._flushingCurses = true;
    const queue = this._curseQueue;
    const ctx = this._curseCtx;
    let i = 0;
    for (; i < queue.length && this._curseBudget > 0; i++) {
      this._curseBudget--;
      const c = queue[i];
      const src = c.sourceUid != null ? this._towerByUid.get(c.sourceUid) || null : null;
      const spec = {
        damage: c.burst, attackType: 'mystic', element: null, critChance: 0, critMul: 1, armorPen: 0,
        eliteMul: 1, bossMul: 1, barrierMul: 1, detection: true, canHitAir: true, status: [], mark: null,
        silence: 0, reveal: 0, knockback: 0, gather: 0, airMul: 1,
      };
      const spread = c.depth + 1 <= CURSE_MAX_DEPTH;
      this._emit('curseBurst', { x: c.x, y: c.y, radius: c.radius, depth: c.depth, towerUid: c.sourceUid });
      const victims = this.grid.query(c.x, c.y, c.radius, []);
      for (let j = 0; j < victims.length; j++) {
        const q = victims[j];
        if (q.dead || q.hidden) continue;
        this._hit(q, src, spec, 1);
        if (!spread || q.dead) continue;
        ctx.sourceUid = c.sourceUid;
        ctx.curseDepth = c.depth + 1;
        this._applyStatusEvent(q, { type: 'curse', burst: c.burst * CURSE_DECAY, radius: c.radius, duration: c.duration }, ctx);
      }
    }
    // the rest (over this step's budget) waits for the next step, still in FIFO order
    if (i >= queue.length) queue.length = 0;
    else queue.splice(0, i);
    this._flushingCurses = false;
  }

  /** The near-exit hook (GAPS P-14; src/sim/enemies.js, only while _nearExitOn): Last Line listens. */
  _nearExit(e) {
    nearExit(this, e);
  }

  _leak(e) {
    if (e.dead) return;
    e.dead = true;
    e.leaked = true;
    const lost = Math.min(this.lives, e.leak === Infinity ? this.lives : e.leak);
    this.lives -= lost;
    this.stats.leaks += lost;
    this.stats.enemiesLeaked++;
    if (this.tryout) tryoutLeak(this, e);
    const wave = e.wave || this.wave;
    this.stats.leakLog.push({ wave, enemyId: e.id, lives: lost, time: this.time });
    this.stats.leaksByEnemy[e.id] = (this.stats.leaksByEnemy[e.id] || 0) + lost;
    this.stats.leaksByWave[wave] = (this.stats.leaksByWave[wave] || 0) + lost;
    this._emit('leak', { uid: e.uid, id: e.id, lives: lost });
    if (this.lives <= 0 && this.state !== 'lost' && this.state !== 'won') {
      this.lives = 0;
      this.state = 'lost';
      this._emit('lost', {});
    }
  }

  /** Towers inside a cleanse aura (and cleansers themselves) ignore sabotage and volatile stuns. */
  _isCleansed(t) {
    return !!(t.buff?.cleanse || t.stats?.aura?.cleanse);
  }

  // -------------------------------------------------------------------------
  // Waves
  // -------------------------------------------------------------------------

  _getWave(n) {
    let w = this._waveCache.get(n);
    if (!w) {
      const opts = { pathCount: this._pathsFwd.length, pathLengths: this._pathsFwd.map((p) => p.length), spacingMul: this.mode.spacingMul ?? 1 };
      w = this.freeplay && n > this.totalWaves ? generateFreeplayWave(this.stage, n, this.data.enemy, opts) : generateWave(this.stage, n, this.data.enemy, opts);
      this._waveCache.set(n, w);
    }
    return w;
  }

  /** Starts the next wave (only in 'prep' or 'between'). @returns {boolean} */
  startNextWave() {
    if (this.state !== 'prep' && this.state !== 'between') return false;
    if (!this.endless && this.wave >= this.lastWave) return false;
    if (this.tryout && !tryoutCanStart(this)) return false;
    this.wave++;
    if (this.tryout) tryoutWaveStart(this); // (first: a Subject's rule can flip the route, Back Gate)
    if (this._pathsRev) this.setRouteOrientation(routeReversedFor(this, this.wave));
    // a long freeplay run would keep every past wave's spawn list: keep only the waves around now
    // (the cache is a pure function of the wave number, so dropping it changes nothing)
    if (this.freeplay) for (const k of this._waveCache.keys()) if (k < this.wave - 1) this._waveCache.delete(k);
    const w = this._getWave(this.wave);
    this._spawnQueue = w.spawns;
    this._spawnIndex = 0;
    this._waveTime = 0;
    this._waveHpMul = w.hpMul;
    this._fp = w.freeplay?.pressure || null;
    this._autoTimer = -1;
    this.state = 'wave';
    startAbilityWave(this);
    if (this.rule) {
      this._waveTick = 0;
      ruleWaveStart(this);
    }
    // a lane schedule (Gate Arc): which lanes this wave walks (absent on stages without one)
    this._emit('waveStart', { wave: this.wave, reversed: this.routeReversed, flipped: routeFlippedFor(this, this.wave), ...(w.lanes ? { lanes: w.lanes } : {}) });
    this._spawnTick(0);
    return true;
  }

  /**
   * The lanes open on wave `n` under the stage's lane schedule (waves.js openLanes; a pure function
   * of the stage and the wave, so a restored battle reads the same): by default the wave running
   * now, or the next one between waves (a level crossing's barrier shows it before the column
   * arrives). null = every lane open (no schedule).
   * @param {number} [n]
   * @returns {number[]|null}
   */
  openLanes(n = this.state === 'wave' ? this.wave : this.wave + 1) {
    if (!this.stage.waveGen?.laneCycle) return null;
    const w = Math.max(1, n);
    // (asked every frame by the renderer: the last answer is kept beside the Sim, never on it, so a
    // snapshot, which copies the Sim's own fields, stays exactly as before)
    const memo = LANE_MEMO.get(this);
    if (memo?.w === w) return memo.lanes;
    const lanes = openLanes(this.stage, w, this._pathsFwd.length);
    LANE_MEMO.set(this, { w, lanes });
    return lanes;
  }

  _checkWaveEnd() {
    if (this.state !== 'wave') return;
    if (this._spawnIndex < this._spawnQueue.length || this.enemies.length > 0) return;
    const cashMul = this.diff.cashMul ?? 1;
    const bonus = this._gainCash((BATTLE.waveClearBonusBase + 6 * this.wave) * cashMul * this.cashScale * this.incomeMul);
    this._emit('cash', { amount: bonus, reason: 'waveBonus' });
    if (!this.diff.noIncome) {
      for (const t of this.towers) {
        const inc = t.stats.income;
        if (!inc || t.disabled > 0) continue;
        const interest = Math.min(INCOME_INTEREST_MAX, (inc.interest || 0) * this.cash);
        const amount = this._gainCash(((inc.perWave || 0) * cashMul + interest) * this.incomeMul);
        if (amount > 0) this._emit('cash', { amount, reason: 'income', towerUid: t.uid });
        // Potential N8 (Momo's Golden Harvest): every Nth wave clear her wave income once more (no interest)
        const hv = t.stats.harvest;
        if (hv && hv.every > 0 && this.wave % hv.every === 0) {
          const extra = this._gainCash((inc.perWave || 0) * cashMul * (hv.share ?? 1) * this.incomeMul);
          if (extra > 0) this._emit('cash', { amount: extra, reason: 'harvest', towerUid: t.uid });
        }
      }
      // Tenka's economy weapon (src/sim/lab.js): every joiner's income and interest (owner decision #146),
      // owner-credited, never on a noIncome difficulty
      if (this._labOn) labIncome(this, cashMul);
    }
    // every placed hero (both players' in co-op), never the view-dependent sim.hero
    const k = heroPace(this);
    for (const h of this.heroes) if (h && !h.removed) gainHeroXp(this, h, waveClearXp(this.wave, k), 'wave');
    // shells still falling would land on an empty road, a runner has nothing left to hit and a
    // queued curse burst nobody to burst on: they end with the wave (GAPS §7.3)
    this.shells.length = 0;
    this.runners.length = 0;
    // spike strips end too, except Sticky Tar ones (src/sim/strips.js); Suzu's traps stay
    if (this.traps.length) endStripWave(this);
    // Kinu's pins, blades, sparks and heat rings end with the wave (src/sim/rings.js)
    endRingWave(this);
    // Wakaba's drinks end; Recovery Plan may give a life back (src/sim/drinks.js)
    endDrinkWave(this);
    // Yuzuha's sentries end; her nets stay (src/sim/sentries.js)
    endSentryWave(this);
    // Chigusa's thorn beds and holds end; her harvest gives lives back (src/sim/vines.js)
    endVineWave(this);
    // Marumi's balls end (src/sim/balls.js)
    endBallWave(this);
    // Hold the Line ends; Norika's own barricades stand again at full budget (src/sim/barricades.js)
    if (this._blockOn) endBarricadeWave(this);
    this._curseQueue.length = 0;
    this.wavesCleared = this.wave;
    this._emit('waveEnd', { wave: this.wave, bonus });
    // Freeplay: the stage's own last wave is the goal — the clear is banked, the battle goes on.
    const goal = this.freeplay && this.wave === this.totalWaves;
    if (goal) this._emit('goal', { wave: this.wave });
    if (this.rule) {
      ruleWaveClear(this);
      ruleWaveEnd(this);
    }
    // every lasting ability effect ends with the wave (the calm point holds none)
    endAbilityWave(this);
    if (this.zones) endZoneWave(this);
    if (this._labOn) endLabWave(this);
    if (this.tryout) tryoutWaveEnd(this);
    if (!this.endless && this.wave >= this.lastWave) {
      this.state = 'won';
      this._emit('won', {});
      return;
    }
    this.state = 'between';
    if (this.options.autoStart) this._autoTimer = goal ? this.stage.freeplay.clearPause ?? AUTO_START_DELAY : AUTO_START_DELAY;
    // a Tryout Day pick or break holds the next wave until every player has resolved it
    if (this.tryout && windowOpen(this)) this._autoTimer = -1;
  }

  /**
   * What freeplay wave n is made of (tier, depth, visitors, affix, boss content, speed and
   * pressure), for the scout, banners and the pressure chip; null outside freeplay or at/before
   * the goal.
   */
  freeplayInfo(n = this.wave + 1) {
    return this.freeplay && n > this.totalWaves ? this._getWave(n).freeplay : null;
  }

  /**
   * Ends a freeplay run on purpose (every player voted Finish): only once the goal has been
   * cleared and while the battle is still on. The battle ends 'won' with finished = true.
   * @returns {boolean}
   */
  finish() {
    if (!this.freeplay || this.wavesCleared < this.totalWaves || this.state === 'won' || this.state === 'lost') return false;
    this.finished = true;
    this.state = 'won';
    this._autoTimer = -1;
    this._emit('won', { finished: true });
    return true;
  }

  /** Scouting info for wave n: [{ enemyId, count, traits, tier }]. */
  waveInfo(n) {
    if (!(n >= 1) || (!this.endless && n > this.lastWave)) return [];
    return summarizeWave(this._getWave(n), this.data.enemy);
  }

  /** Scouting info for the upcoming wave. */
  nextWavePreview() {
    return this.waveInfo(this.wave + 1);
  }

  // -------------------------------------------------------------------------
  // Towers
  // -------------------------------------------------------------------------

  _unitStats(unitId) {
    if (this.heroConfig && unitId === this.heroConfig.unitId) return this.heroConfig.stats;
    return this.loadout.get(unitId) || null;
  }

  /**
   * Placement cost of a unit, optionally at a world position (applies cost-cut auras there).
   * Two integer arguments are read as a tile (legacy): its centre is used.
   */
  placeCost(unitId, x = null, y = null) {
    const def = this.data.unit(unitId);
    if (!def) return Infinity;
    // heroes deploy for free (a 0-cost unit costs 0, never the rounding floor of 5); a difficulty
    // may put a deploy price back on heroes (DIFFICULTIES[d].heroCost, default none)
    let raw = baseCost(def);
    if (def.kind === 'hero' && this.diff.heroCost > 0) raw = this.diff.heroCost;
    if (!(raw > 0)) return 0;
    const us = this._unitStats(unitId) || DEFAULT_UNIT_STATS;
    let cut = 0;
    if (x != null && y != null) {
      if (isTileCall(x, y)) {
        x += 0.5;
        y += 0.5;
      }
      cut = costCutAt(this, x, y);
    }
    const price = raw * (this.diff.costMul ?? 1) * (us.costMul ?? 1) * (1 - cut);
    if (this.tryout && def.kind !== 'hero') {
      // Tryout Day: a girl's voucher places her free; Scholarship cuts her price (the viewing player's)
      const run = tryoutPlaceCost(this, this.viewOwner, unitId);
      if (run.free) return 0;
      if (run.cut > 0) return roundCost(price * (1 - run.cut));
    }
    return roundCost(price);
  }

  /** Terrain char at a tile ('X' outside the map). */
  tileAt(tx, ty) {
    const row = this.map.rows?.[ty];
    if (!row || tx < 0 || tx >= row.length) return 'X';
    return row[tx];
  }

  /** Footprint radius (tiles) a unit would occupy. */
  footprintRadius(unitId) {
    return footprintRadius(this.data.unit(unitId));
  }

  /**
   * Geometry-only placement verdict at a world position: ignores cash, loadout and the
   * hero-already-placed rule. Used by the forbidden-zone overlay and autoPlan.
   * @returns {null|'outOfBounds'|'occupied'|'path'|'blocked'|'needsWater'|'needsLand'}
   */
  placementReason(unitId, x, y) {
    const def = this.data.unit(unitId);
    if (!def) return 'outOfBounds';
    if (isTileCall(x, y)) {
      x += 0.5;
      y += 0.5;
    }
    return this.placement.check(def, x, y, this.towers);
  }

  /**
   * Can `unitId` stand with her footprint centred at world (x, y)? Free placement: any
   * continuous point is a candidate. Two INTEGER arguments are read as a tile (tx, ty)
   * and resolve to its centre (legacy wrapper; new code passes real coordinates).
   * @returns {{ ok: boolean, reason: null|'occupied'|'path'|'blocked'|'needsWater'|'needsLand'|'cash'|'heroPlaced'|'notInLoadout'|'outOfBounds', cost?: number, x?: number, y?: number }}
   */
  canPlace(unitId, x, y) {
    if (isTileCall(x, y)) {
      x += 0.5;
      y += 0.5;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y) || !this.placement.inBounds(x, y)) {
      return { ok: false, reason: 'outOfBounds' };
    }
    const def = this.data.unit(unitId);
    const isHero = !!this.heroConfig && unitId === this.heroConfig.unitId;
    if (!def || (!isHero && !this.loadout.has(unitId))) return { ok: false, reason: 'notInLoadout' };
    if (isHero && this.hero) return { ok: false, reason: 'heroPlaced' };
    const geo = this.placement.check(def, x, y, this.towers);
    if (geo) return { ok: false, reason: geo, x, y };
    const cost = this.placeCost(unitId, x, y);
    if (this.cash < cost) return { ok: false, reason: 'cash', cost, x, y };
    return { ok: true, reason: null, cost, x, y };
  }

  /** Legacy tile wrapper: canPlace at the centre of tile (tx, ty). */
  canPlaceTile(unitId, tx, ty) {
    return this.canPlace(unitId, Math.floor(tx) + 0.5, Math.floor(ty) + 0.5);
  }

  /**
   * Places a girl with her footprint centred at world (x, y). Two integer arguments are a
   * tile (legacy) and resolve to its centre. `owner`: her player (co-op's `place` command passes the
   * slot), set before anything reads it — her ability's Auto default and unlock event (a fixture that
   * unlocks at tier 0) already see it.
   * @param {{ owner?: number }} [opts]
   * @returns {object|null} TowerRT
   */
  placeTower(unitId, x, y, { owner = 0 } = {}) {
    if (this.state === 'won' || this.state === 'lost') return null;
    const chk = this.canPlace(unitId, x, y);
    if (!chk.ok) return null;
    x = chk.x;
    y = chk.y;
    const def = this.data.unit(unitId);
    const isHero = !!this.heroConfig && unitId === this.heroConfig.unitId;
    this._spend(chk.cost);
    const t = createTower(def, { uid: this._nextUid(), x, y, radius: footprintRadius(def), isHero, unitStats: this._unitStats(unitId), cost: chk.cost, owner });
    if (isHero) {
      initHero(t);
      t.heroIndex = this._heroConfig.index;
      this.heroes[t.heroIndex] = t;
    }
    if (this.tryout) tryoutTowerMods(this, t);
    refreshTowerStats(t, this.globalRateMul, this.globalDmgMul);
    this.towers.push(t);
    this._towerByUid.set(t.uid, t);
    if (this.rule) assignPads(this);
    this._buffsDirty = true;
    recomputeBuffs(this);
    this.stats.towersPlaced++;
    this.stats.towerUnits[t.uid] = unitId;
    if (this.tryout) tryoutPlaced(this, owner, t, chk.cost);
    this._emit('place', { towerUid: t.uid, unitId, x, y, tx: t.tx, ty: t.ty });
    updateRelayOrigin(this, t);
    syncAbility(this, t); // (a fixture girl whose ability unlocks at tier 0)
    syncZones(this, t);
    syncBarricades(this, t);
    return t;
  }

  /** Legacy tile wrapper: placeTower at the centre of tile (tx, ty). */
  placeTowerTile(unitId, tx, ty) {
    return this.placeTower(unitId, Math.floor(tx) + 0.5, Math.floor(ty) + 0.5);
  }

  /** Re-resolves stats (upgrades / hero levels) and keeps buffs consistent. */
  _refreshTower(t) {
    refreshTowerStats(t, this.globalRateMul, this.globalDmgMul);
    updateRelayOrigin(this, t); // relay reach may have grown
    this._buffsDirty = true;
    // an upgrade or a hero level: her ability unlocks (tier 3 / Lv 7) or upgrades (tier 5 / Lv 17)
    syncAbility(this, t);
    // a well or Last Line (Singularity tier 3 / 5): the zone list and the near-exit hook
    syncZones(this, t);
    // her lab team's frag and control weapons follow her lab power (Grand Lab, Unified Theory)
    syncLab(this, t);
    // Norika's barricade lists (src/sim/barricades.js)
    syncBarricades(this, t);
  }

  /**
   * Nearest girl whose footprint contains world (x, y), or null. Two integer arguments are
   * a tile (legacy): the tile centre is tested first, then any girl standing on that tile.
   * @returns {object|null} TowerRT
   */
  towerAt(x, y) {
    if (isTileCall(x, y)) {
      const hit = footprintAt(this.towers, x + 0.5, y + 0.5);
      if (hit) return hit;
      for (const t of this.towers) if (t.tx === x && t.ty === y) return t;
      return null;
    }
    return footprintAt(this.towers, x, y);
  }

  getTower(uid) {
    return this._towerByUid.get(uid) || null;
  }

  /**
   * One final tier per path (src/sim/finalTier.js): the OTHER girl of this girl's type and player
   * that holds `path`'s final tier, or null (always null for heroes).
   * @returns {object|null} TowerRT
   */
  finalTierHolder(uid, path) {
    const t = this.getTower(uid);
    if (!t || t.isHero) return null;
    return findFinalHolder(this.towers, t.unitId, t.owner ?? 0, path, t.uid);
  }

  /**
   * Who holds each path's final tier for a girl type and player (a card not placed yet: the tree
   * says "held by your Chika 5-0-2" before she is deployed). @returns {(number|null)[]} uids by path
   */
  finalTierHolders(unitId, owner = 0) {
    return [0, 1, 2].map((p) => findFinalHolder(this.towers, unitId, owner, p)?.uid ?? null);
  }

  /** Every buff a girl has and who gives it (src/sim/buffs.js buffSources; read-only, for the UI). */
  buffSources(uid) {
    return buffSources(this, uid);
  }

  /** The girls a girl currently buffs (brew / link targets first, then aura winners; read-only). */
  buffTargets(uid) {
    return buffTargets(this, uid);
  }

  /** Every aura in range of a girl, the weaker ones that do not stack included (read-only). */
  aurasCovering(uid) {
    return aurasCovering(this, uid);
  }

  /**
   * Pins the girl Midori brews / Chika links first (the pick command). `targetUid` -1 = back to auto
   * (the strongest girl in reach). The target must be another placed girl in reach now (brew: Midori's
   * range; link: Chika's aura); selling her clears the pin, leaving reach only skips her.
   * @returns {{ ok: boolean, reason: null|'noBuff'|'self'|'gone'|'range' }}
   */
  setBuffPick(uid, targetUid) {
    const t = this.getTower(uid);
    if (!t || (!t.stats?.brew && !t.stats?.link)) return { ok: false, reason: 'noBuff' };
    if (targetUid == null || targetUid === -1) {
      t.buffPick = -1;
      if (t.lim) t.lim.repick = true;
      this._buffsDirty = true;
      return { ok: true, reason: null };
    }
    if (targetUid === uid) return { ok: false, reason: 'self' };
    const o = this.getTower(targetUid);
    if (!o) return { ok: false, reason: 'gone' };
    const r = limitedRange(t);
    const dx = o.x - t.x;
    const dy = o.y - t.y;
    if (dx * dx + dy * dy > r * r) return { ok: false, reason: 'range' };
    t.buffPick = targetUid;
    if (t.lim) t.lim.repick = true;
    this._buffsDirty = true;
    return { ok: true, reason: null };
  }

  /** Upgrade cost for the next tier of a path (applies difficulty, profile and cost-cut auras). */
  _upgradeCost(t, tier, index = null) {
    if (t.rules && isFreeTier(t, index)) return 0; // Ouka's Club Grants (src/sim/hubs.js)
    const us = t.unitStats || DEFAULT_UNIT_STATS;
    const cut = Math.min(0.5, t.buff?.costCut || 0);
    const price = (tier.cost || 0) * (this.diff.costMul ?? 1) * (us.costMul ?? 1) * (1 - cut);
    if (this.tryout) {
      // Tryout Day: Free Refills (tiers 1-3) and Scholarship
      const run = tryoutUpgradeCost(this, t, index);
      if (run.free) return 0;
      if (run.cut > 0) return roundCost(price * (1 - run.cut));
    }
    return roundCost(price);
  }

  /**
   * Can this girl buy the next tier of `path`? Reasons, in order: 'max' → 'crosspath' → 'onePerPath'
   * (another girl of her type and player holds this path's final tier: `holder` is her uid) → 'cash'.
   * `restoring` (a battle-save restore only, never from the network) skips 'onePerPath' so a save from
   * before the rule keeps every final tier it had.
   * @param {number} uid
   * @param {number} path
   * @param {{ restoring?: boolean }} [opts]
   * @returns {{ tier: number, next: object|null, cost: number, locked: boolean,
   *   reason: null|'max'|'crosspath'|'onePerPath'|'cash', holder: number|null }}
   */
  upgradeStatus(uid, path, { restoring = false } = {}) {
    const t = this.getTower(uid);
    if (!t || !(path >= 0 && path <= 2)) return { tier: 0, next: null, cost: 0, locked: true, reason: 'max', holder: null };
    const tier = t.tiers[path];
    const tiersDef = t.def.paths?.[path]?.tiers || [];
    if (!tiersDef.length) return { tier, next: null, cost: 0, locked: true, reason: 'max', holder: null };
    const block = crosspathBlock(t.tiers, path, Math.min(5, tiersDef.length));
    const next = tiersDef[tier] || null;
    if (block === 'max' || !next) return { tier, next: null, cost: 0, locked: true, reason: 'max', holder: null };
    const cost = this._upgradeCost(t, next, tier);
    if (block) return { tier, next, cost, locked: true, reason: block, holder: null };
    if (!restoring && !t.isHero && tier + 1 >= finalTierOf(t.def, path)) {
      const holder = findFinalHolder(this.towers, t.unitId, t.owner ?? 0, path, t.uid);
      if (holder) return { tier, next, cost, locked: true, reason: 'onePerPath', holder: holder.uid };
    }
    if (this.cash < cost) return { tier, next, cost, locked: true, reason: 'cash', holder: null };
    return { tier, next, cost, locked: false, reason: null, holder: null };
  }

  /**
   * Buys the next tier of `path`. `opts.restoring`: see upgradeStatus (battle-save restore only).
   * A tier that raises Tenka's lab rounds (Joint Research, Unified Theory; src/sim/lab.js) has her owner's
   * girls in range join her lab team, never under `restoring`; who joined is the new tail of her
   * `t.lab.uids` (and the labJoin event), for the caller (T3: the co-op layer forgets them as owners).
   * @returns {boolean}
   */
  upgradeTower(uid, path, opts = {}) {
    if (this.state === 'won' || this.state === 'lost') return false;
    const st = this.upgradeStatus(uid, path, opts);
    if (st.locked) return false;
    const t = this.getTower(uid);
    const rounds = t.stats.lab ? t.stats.lab.rounds : 0;
    this._spend(st.cost);
    t.spent += st.cost;
    if (this.tryout) tryoutUpgraded(this, t, st.cost, t.tiers[path]);
    t.tiers[path]++;
    this._refreshTower(t);
    recomputeBuffs(this);
    this.stats.upgrades++;
    this._emit('upgrade', { towerUid: uid, path, tier: t.tiers[path] });
    if (!opts.restoring && t.stats.lab && t.stats.lab.rounds > rounds) {
      absorbInto(this, t);
      recomputeBuffs(this);
    }
    return true;
  }

  /** Coins returned when selling (70% of everything spent on the tower). */
  sellValue(uid) {
    const t = this.getTower(uid);
    if (!t) return 0;
    // Ouka's rules (src/sim/hubs.js) may raise the share for a girl she covers
    return Math.floor(t.spent * (t.rules?.sellMul > BATTLE.sellRefund ? t.rules.sellMul : BATTLE.sellRefund));
  }

  /**
   * Can this girl be sold? Heroes cannot (they deploy for free; move her instead).
   * @returns {{ ok: boolean, reason: null|'none'|'hero'|'ended' }}
   */
  canSell(uid) {
    const t = this.getTower(uid);
    if (!t) return { ok: false, reason: 'none' };
    if (t.isHero) return { ok: false, reason: 'hero' };
    if (this.state === 'won' || this.state === 'lost') return { ok: false, reason: 'ended' };
    return { ok: true, reason: null };
  }

  /** Sells a tower. @returns {number|false} refund (0 for an unknown uid or an ended battle), false for a hero */
  sellTower(uid) {
    const t = this.getTower(uid);
    if (t && t.isHero) return false;
    if (!t || this.state === 'won' || this.state === 'lost') return 0;
    // (Tenka: 70% of her own spent coins; her lab team does not come back this battle)
    const refund = this.sellValue(uid);
    if (this.tryout) tryoutCount(this, t.owner, 'sells');
    this.cash += refund;
    this._removeTower(t);
    this._emit('sell', { towerUid: uid, refund });
    return refund;
  }

  /**
   * Takes a girl off the field: a sale (sellTower) and a girl who joins Tenka's lab team (src/sim/lab.js
   * absorbInto) leave exactly the same way. Her rallies, queued shots and drinks end; she is flagged
   * `removed` (her projectiles and runners in flight fizzle, her drones, sentries, balls and rings go
   * with her); her traps and strips, zones and pending shells go; the final tier she held is free again
   * (finalTier.js skips her); brews / links she gave or held and pins on her fall away on the next step;
   * pads and auras are rebuilt. No coins: the caller pays any refund.
   */
  _removeTower(t) {
    const uid = t.uid;
    clearAbilityEffects(this, t);
    clearDrinksFrom(this, t);
    t.removed = true;
    this.towers = this.towers.filter((x) => x !== t);
    this._towerByUid.delete(uid);
    this.traps = this.traps.filter((tr) => tr.ownerUid !== uid);
    if (this.zones) clearZones(this, t);
    this.shells = this.shells.filter((sh) => sh.ownerUid !== uid); // pending shells never land
    t.turrets = [];
    if (this._labOn) syncLab(this, null); // (a girl with a lab team leaves: the count follows)
    if (this.rule) assignPads(this);
    this._buffsDirty = true;
    recomputeBuffs(this);
  }

  /**
   * Puts a girl somewhere else (a hero's Move). The one place for every position-derived field:
   * traps, targets, drones and auras here; other features add theirs (landing plan seam S5).
   */
  _relocate(t, x, y) {
    const dx = x - t.x;
    const dy = y - t.y;
    t.x = x;
    t.y = y;
    t.tx = Math.floor(x);
    t.ty = Math.floor(y);
    t.trapSpots = null;
    t.trapSpotsRange = -1;
    t.targetUid = null;
    t.rampTarget = null;
    t.rampStacks = 0;
    for (const d of t.turrets || []) {
      if (typeof d.x === 'number') d.x += dx;
      if (typeof d.y === 'number') d.y += dy;
    }
    // crystal pads are position-derived (landing plan S5): a hero's Move re-assigns them
    if (this.rule) assignPads(this);
    this._buffsDirty = true;
    recomputeBuffs(this);
    // her attack origin (and a familiar / mirror spot) is position-derived too (roster B3)
    updateRelayOrigin(this, t);
  }

  /**
   * Sets a tower's aim point (mortar centre, mirror spot, aimed hero ult). Quantised to the
   * co-op grid (1/1024), clamped into the map; a mirror is clamped to its reach circle.
   * @returns {boolean} false for unknown towers, towers without an aim mode, a finished battle or bad numbers
   */
  setAim(uid, x, y) {
    const t = this.getTower(uid);
    if (!t || this.state === 'won' || this.state === 'lost') return false;
    const mode = aimMode(t);
    if (!mode || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    let ax = Math.round(x * AIM_QUANT) / AIM_QUANT;
    let ay = Math.round(y * AIM_QUANT) / AIM_QUANT;
    ax = Math.min(this.map.width || 0, Math.max(0, ax));
    ay = Math.min(this.map.height || 0, Math.max(0, ay));
    if (mode === 'mirror' || mode === 'checkpoint') {
      // a mirror stays within its reach, a checkpoint within her range
      const reach = mode === 'mirror' ? t.stats.relay.reach : t.eff.range;
      const dx = ax - t.x;
      const dy = ay - t.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > reach * reach) {
        const k = reach / Math.sqrt(d2);
        ax = t.x + dx * k;
        ay = t.y + dy * k;
      }
    }
    if (mode === 'banner') {
      // Ouka's Rally Banner: a banner there (the oldest moves past her count; src/sim/hubs.js)
      const b = plantBanner(this, t, ax, ay);
      recomputeBuffs(this);
      this._emit('aim', { towerUid: uid, x: b.x, y: b.y, banners: t.banners.map((o) => [o.x, o.y]) });
      return true;
    }
    t.aim = { x: ax, y: ay };
    if (mode === 'mirror') updateRelayOrigin(this, t);
    this._emit('aim', { towerUid: uid, x: ax, y: ay });
    return true;
  }

  /** Back to automatic aim (mortar leads its target, mirror goes to the nearest lane edge, ult picks the leader). */
  clearAim(uid) {
    const t = this.getTower(uid);
    if (!t || this.state === 'won' || this.state === 'lost' || !aimMode(t)) return false;
    t.aim = null;
    if (t.banners) {
      clearBanners(this, t);
      recomputeBuffs(this);
    }
    updateRelayOrigin(this, t);
    this._emit('aim', { towerUid: uid, x: null, y: null });
    return true;
  }

  setTargetMode(uid, mode) {
    const t = this.getTower(uid);
    if (!t || !TARGET_MODES[mode]) return false;
    t.targetMode = mode;
    t.rampTarget = null;
    t.rampStacks = 0;
    if (t.rampKeep) t.rampKeep = 0; // switching by choice drops a kept focus too (Potential N10)
    return true;
  }

  /**
   * Flight mode of a girl's drone wing (docs/specs/CHIKA_REWORK.md §16): 'hover' (around her),
   * 'hold' (around point a), 'patrol' (between points a and b) or 'pursuit' (map-wide). Points
   * are world coordinates, pulled inside her signal range. Co-op: the `fly` command.
   * @returns {boolean}
   */
  setFlight(uid, mode, ax = null, ay = null, bx = null, by = null) {
    if (this.state === 'won' || this.state === 'lost') return false;
    return setFlight(this, this.getTower(uid), mode, ax, ay, bx, by);
  }

  /** Where a girl's wing flies (UI): mode, points, the patrol position and her signal range; null without roaming drones. */
  flightInfo(uid) {
    const t = this.getTower(uid);
    if (!t || !hasRoamingDrones(t)) return null;
    const fl = t.flight;
    return {
      mode: flightMode(t),
      a: fl ? [fl.ax, fl.ay] : null,
      b: fl ? [fl.bx, fl.by] : null,
      at: fl && (fl.mode === 'hold' || fl.mode === 'patrol') ? [fl.cx, fl.cy] : [t.x, t.y],
      signal: signalRange(t),
      roam: fl && (fl.mode === 'hold' || fl.mode === 'patrol') ? t.turretSpec.leash * FLIGHT_POINT_ROAM_MUL : fl?.mode === 'pursuit' ? Infinity : t.turretSpec.leash,
    };
  }

  /**
   * Every roaming drone of a girl, in build order (UI; allocates): position (and the position one
   * step earlier, for drawing between steps), state, quarry and counters.
   * state: 'hunting' (has a quarry) | 'returning' (flying, no quarry) | 'home' | 'jammed' (a sapper) | 'stalled' (she is sabotaged)
   */
  droneStats(towerUid) {
    const t = this.getTower(towerUid);
    if (!t || !hasRoamingDrones(t)) return [];
    return t.turrets.map((d) => ({
      uid: d.uid,
      n: d.n,
      x: d.x,
      y: d.y,
      px: d.px,
      py: d.py,
      facing: d.facing,
      state: t.disabled > 0 ? 'stalled' : d.jam > 0 ? 'jammed' : d.tgt ? 'hunting' : d.moving ? 'returning' : 'home',
      jam: d.jam,
      targetUid: d.targetUid,
      targetId: d.tgt ? d.tgt.id : null,
      dmg: d.dmg,
      kills: d.kills,
      shots: d.shots,
      born: d.born,
    }));
  }

  /** The girl and roaming drone with this uid, or null. */
  findDrone(uid) {
    for (const t of this.towers) {
      if (!hasRoamingDrones(t)) continue;
      for (const d of t.turrets) if (d.uid === uid) return { tower: t, drone: d };
    }
    return null;
  }

  /** Effective stats for the UI panel (after upgrades, levels and buffs). */
  towerStats(uid) {
    const t = this.getTower(uid);
    if (!t) return null;
    const e = t.eff;
    // damage × attacks a second × projectiles (crit and a rhythm's harder hit not included). Potential
    // adds what changes how many attacks and projectiles she makes: N13 her shuriken per throw
    // × (1 + projScale) on average, N14 her tempo as it stands now (1 + per × stacks), and a rhythm's
    // echo volley (N3 / N15: every Nth attack repeats in full or at a share s, × (1 + s / N))
    let dps = e.behavior === 'none' || e.behavior === 'trap' ? 0 : e.damage * e.rate * (e.behavior === 'pulse' ? 1 : e.projectiles * (e.projScale > 0 ? 1 + e.projScale : 1));
    // a bowler (Marumi, src/sim/balls.js): every blast of a ball (the first, one per bounce, the Glow
    // Bowl finale × its share) and its pins, like a volley's projectiles
    const ball = t.stats.ball;
    if (ball && e.behavior === 'roll') {
      const blasts = 1 + ball.bounce + (ball.finish > 0 && ball.bounce > 0 ? ball.finish - 1 : 0);
      dps = e.rate * (e.damage * blasts + ball.pins * (t.pinSpec?.damage ?? 0));
    }
    if (dps > 0 && e.tempo) dps *= 1 + e.tempo.per * (t.tempoStacks || 0);
    const echo = e.proc && e.proc.of !== 'trap' && e.proc.every > 0 ? (e.proc.echo === true ? 1 : typeof e.proc.echo === 'number' ? e.proc.echo : 0) : 0;
    if (dps > 0 && echo > 0) dps *= 1 + echo / e.proc.every;
    const ts = t.turretSpec;
    const roam = !!ts && ts.leash > 0;
    let turret = null;
    if (e.turret) {
      turret = { ...e.turret, damage: ts?.damage ?? e.turret.damage, active: t.turrets.length };
      if (roam) {
        Object.assign(turret, {
          rate: ts.rate, range: ts.range, leash: ts.leash, speed: ts.speed, build: ts.build || 1 / Math.max(0.05, t.def.base?.rate || 0.25),
          dealt: t.droneDmg, kills: t.droneKills, shots: t.droneShots,
          nextIn: this.state === 'wave' && t.turrets.length < e.turret.max ? Math.max(0, t.buildTimer) : 0,
          flight: flightMode(t),
        });
      }
    }
    return {
      uid: t.uid,
      unitId: t.unitId,
      name: t.def.name,
      isHero: t.isHero,
      level: t.level,
      xp: t.isHero ? heroXpInfo(t) : null,
      tiers: [...t.tiers],
      targetMode: t.targetMode,
      behavior: e.behavior,
      attackType: e.attackType,
      element: e.element,
      damage: e.damage,
      rate: e.rate,
      range: e.range,
      dps,
      projectiles: e.projectiles,
      pierce: e.pierce,
      splash: e.splash,
      chain: e.chain,
      maxTargets: e.maxTargets,
      projectileSpeed: e.projectileSpeed,
      armorPen: e.armorPen,
      canHitAir: e.canHitAir,
      detection: e.detection,
      crit: { ...e.crit },
      eliteMul: e.eliteMul,
      bossMul: e.bossMul,
      barrierMul: e.barrierMul,
      status: e.status.map((s) => ({ ...s })),
      aura: e.aura ? { ...e.aura } : null,
      income: e.income ? { ...e.income } : null,
      trap: e.trap ? { ...e.trap, damage: t.trapSpec?.damage ?? e.trap.damage, placed: t.trapCount } : null,
      turret,
      // her own attack, apart from the drones (the panel's Chika tab)
      own: { dps, dealt: t.damageDealt - t.droneDmg, kills: t.kills - t.droneKills },
      ramp: e.ramp ? { ...e.ramp } : null,
      mark: e.mark ? { ...e.mark } : null,
      silence: e.silence,
      reveal: e.reveal,
      knockback: e.knockback,
      airMul: e.airMul,
      gather: e.gather,
      relay: e.relay ? { ...e.relay } : null,
      aim: t.aim ? { ...t.aim } : null,
      aimMode: aimMode(t),
      origin: t.origin ? { ...t.origin } : null,
      buff: { ...t.buff, globalRateMul: this.globalRateMul, globalDmgMul: this.globalDmgMul },
      buffed: t.buffed,
      disabled: t.disabled,
      kills: t.kills,
      damageDealt: t.damageDealt,
      spent: t.spent,
      sellValue: t.isHero ? 0 : this.sellValue(uid),
      canSell: !t.isHero,
      heroLevel: t.isHero ? heroLevelStatus(this, t) : null,
      ultRank: t.isHero ? ultRank(t) : 0,
      mastery: t.isHero ? t.mastery || 0 : 0,
      levelsBought: t.isHero ? t.levelsBought || 0 : 0,
      levelSpent: t.isHero ? t.levelSpent || 0 : 0,
      moveCd: t.isHero ? t.moveCd || 0 : 0,
      moveLock: t.isHero ? t.moveLock || 0 : 0,
      // her ⚡ ability (null without one; a locked one is the teaser): src/sim/abilities.js abilityStatus
      ability: abilityStatusOf(this, t),
      // Potential (only on a girl whose steps have them): her rhythm and its count, tempo, extra projectiles
      ...(e.proc ? { proc: { name: e.proc.name, every: e.proc.every, of: e.proc.of, count: t.potCount || 0 } } : null),
      ...(e.tempo ? { tempo: { stacks: t.tempoStacks || 0, max: Math.round(e.tempo.max / e.tempo.per), per: e.tempo.per } } : null),
      ...(e.projScale > 0 ? { projScale: e.projScale } : null),
      // Ouka's office (src/sim/hubs.js; only on a hub girl): the panel's Office line reads it
      ...(e.hub ? { hub: { ...e.hub } } : null),
    };
  }

  // -------------------------------------------------------------------------
  // Battle mode and map rule (docs/specs/CODEX_MODES.md)
  // -------------------------------------------------------------------------

  /** The map rule's HUD state (numbers and ids only), or null without a rule. */
  ruleInfo() {
    const info = ruleInfo(this);
    // Tryout Day: during a break the next block's Window Seats show too (dashed)
    if (info && this.tryout) info.nextPads = nextSeats(this);
    return info;
  }

  /** Absolute route orientation of wave n (true = walked backwards). */
  routeReversedFor(n) {
    return routeReversedFor(this, n);
  }

  /** Is wave n flipped relative to this battle's usual direction (Rear Ambush's even waves)? */
  routeFlippedFor(n) {
    return routeFlippedFor(this, n);
  }

  /** Shifting Stars' favoured power on wave n, or null. */
  ruleAffinityFor(n) {
    return ruleAffinityFor(this, n);
  }

  /** Can hearts come back? (Not in Last Petal, nor in a Grade 12 Tryout Day run.) */
  canHeal() {
    return !this.mode.noHeal && !(this.tryout && !tryoutCanHeal(this));
  }

  /**
   * Sets the route orientation (absolute). Swaps pathData/paths and drops every cache ordered by
   * the goal direction (trap spots). No-op on a battle without a reversible route.
   */
  setRouteOrientation(rev) {
    if (!this._pathsRev) return;
    rev = !!rev;
    const changed = rev !== this.routeReversed;
    this.routeReversed = rev;
    this._applyRoute();
    if (changed) {
      for (const t of this.towers) {
        t.trapSpots = null;
        t.trapSpotsRange = -1;
      }
      this._relaySamples = null; // (a backstop: the samples come from the forward paths)
    }
  }

  /** pathData/paths for the current orientation (after a restore, which builds wave 1's). */
  _applyRoute() {
    if (!this._pathsRev) return;
    const want = this.routeReversed ? this._pathsRev : this._pathsFwd;
    if (this.pathData === want) return;
    this.pathData = want;
    this.paths = want.map((p) => p.points.map((pt) => [pt[0], pt[1]]));
  }

  // -------------------------------------------------------------------------
  // Hero
  // -------------------------------------------------------------------------

  activateUlt() {
    return fireUlt(this);
  }

  heroUltStatus() {
    return heroUltStatus(this);
  }

  /** The active hero's next-level price and state; `want` = { level, maxPrice } (see hero.js). */
  heroLevelStatus(want = null) {
    return heroLevelStatus(this, this.hero, want);
  }

  /** Buys the rest of the active hero's level. @returns {{ ok, reason, price }} */
  buyHeroLevel(want = null) {
    return buyHeroLevel(this, this.hero, want);
  }

  /** Can the active hero move to world (x, y)? (two integers = a tile centre) */
  canMoveHero(x, y) {
    if (isTileCall(x, y)) {
      x += 0.5;
      y += 0.5;
    }
    return canMoveHero(this, x, y, this.hero);
  }

  /** Moves the active hero. @returns {{ ok, reason }} */
  moveHero(x, y) {
    if (isTileCall(x, y)) {
      x += 0.5;
      y += 0.5;
    }
    return moveHero(this, x, y, this.hero);
  }

  // -------------------------------------------------------------------------
  // Abilities (src/sim/abilities.js; co-op: the abil / acast commands)
  // -------------------------------------------------------------------------

  /** A girl's ability for the UI (null: she has none; a locked one is the teaser). */
  abilityStatus(uid) {
    return abilityStatusOf(this, this.getTower(uid));
  }

  /**
   * Fires a girl's ability (only during a wave). `group`: the best ready copy of the same girl and
   * player; `owner`: the commanding player (co-op), refused `notYours` for another player's girl.
   * @param {number} uid
   * @param {{ group?: boolean, owner?: number|null, auto?: boolean, aim?: number[]|null }} [opts]
   * @returns {{ ok: boolean, reason: null|'ended'|'locked'|'notYours'|'notWave'|'disabled'|'moving'|'active'|'cooldown'|'cap'|'noIncome'|'noTarget', casterUid: number|null }}
   */
  castAbility(uid, opts = {}) {
    return castAbilityOn(this, this.getTower(uid), opts);
  }

  /** A girl's Auto switch. @returns {{ ok: boolean, reason: null|'locked' }} */
  setAbilityAuto(uid, on) {
    return setAbilityAutoOn(this, this.getTower(uid), on);
  }

  /** A player's Auto-cast setting: every girl of hers now, and the default for later unlocks. */
  setAbilityAutoAll(owner, on) {
    return setAbilityAutoAllOn(this, owner, on);
  }

  /** A player's ability bar (UI only; allocates): one slot per ability, copies grouped. */
  abilitySlots(owner = 0) {
    return abilitySlotsOf(this, owner);
  }

  // -------------------------------------------------------------------------
  // Scouting warnings and debrief
  // -------------------------------------------------------------------------

  /**
   * Pre-wave warnings for wave n (default: the next wave): new enemies, bosses, and
   * traits the current defence cannot answer, with formation units that can.
   * @returns {{ kind: 'boss'|'new'|'counter', severity: 'info'|'warn'|'danger', text: string,
   *   enemyId?: string, enemyIds?: string[], trait?: string, capabilities?: string[], suggest?: string[] }[]}
   */
  waveWarnings(n = this.wave + 1) {
    return buildWaveWarnings(this, n);
  }

  /** Evidence-based battle summary (leaks by enemy/wave/trait, top damage, plain-language lines). */
  debrief() {
    return buildDebrief(this);
  }

  // -------------------------------------------------------------------------
  // Snapshots (src/sim/snapshot.js)
  // -------------------------------------------------------------------------

  /**
   * The whole battle state as plain JSON (towers, enemies, projectiles, statuses, rng, stats…),
   * taken between steps. Co-op keeps one at every wave end as a checkpoint.
   * @returns {{ v: number, root: any, o: any[] }}
   */
  snapshot(config) {
    return snapshotSim(this, config);
  }

  /**
   * Continues a battle from snapshot(): call it on a fresh Sim built with the same arguments
   * (stage, difficulty, loadout, hero, seed, options). `config`: see src/sim/snapshot.js (co-op
   * passes every player's loadout). @returns {Sim} this
   */
  restore(snap, config) {
    return restoreSim(this, snap, config);
  }

  // -------------------------------------------------------------------------
  // Result
  // -------------------------------------------------------------------------

  /** Battle result for applyBattleResult (CONTRACTS.md §5). */
  result() {
    return {
      stageId: this.stageId,
      difficulty: this.difficulty,
      won: this.state === 'won',
      wave: this.wave,
      wavesCleared: this.wavesCleared,
      livesLeft: this.lives,
      maxLives: this.maxLives,
      encountered: [...this.encountered],
      kills: { ...this.kills },
      stats: {
        ...this.stats,
        damageByTower: { ...this.stats.damageByTower },
        damageByType: { ...this.stats.damageByType },
        leakLog: this.stats.leakLog.map((l) => ({ ...l })),
        leaksByEnemy: { ...this.stats.leaksByEnemy },
        leaksByWave: { ...this.stats.leaksByWave },
        towerUnits: { ...this.stats.towerUnits },
        // abilities (only once one was cast: a battle without casts keeps its result exactly)
        ...(this.stats.abilityByTower ? { abilityByTower: { ...this.stats.abilityByTower } } : null),
        time: this.time,
        heroLevel: this.hero ? this.hero.level : 0,
        heroLevels: this.heroes.map((h) => (h ? h.level : 0)),
        endless: this.endless,
      },
      // per hero, by player index: her own counters (the results line reads the local player's)
      heroes: this.heroes.map((h) => (h ? { unitId: h.unitId, level: h.level, levelsBought: h.levelsBought || 0, levelSpent: h.levelSpent || 0 } : null)),
      // co-op freeplay: the tier, the goal (the stage's last wave), whether it was cleared, and
      // whether the run ended on a Finish vote (otherwise it fell)
      freeplay: this.freeplay ? this.stage.freeplay.id : null,
      goal: this.freeplay ? this.totalWaves : null,
      goalReached: this.freeplay && this.wavesCleared >= this.totalWaves,
      finished: this.finished,
      mode: this.mode.id,
      rule: this.rule?.id ?? null,
      ...(this.tryout ? { tryout: tryoutResult(this) } : null),
    };
  }
}


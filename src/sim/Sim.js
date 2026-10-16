// Battle simulation (CONTRACTS.md §6). Pure JS, deterministic for a given seed and
// sequence of player actions, fixed 1/60 s internal timestep.

import { DIFFICULTIES, BATTLE, TARGET_MODES } from '../data/types.js';
import { createRng } from '../core/rng.js';
import {
  STEP, MAX_STEPS_PER_UPDATE, HOLY_SILENCE, AUTO_START_DELAY,
  BUFF_REFRESH, DEFAULT_UNIT_STATS, KNOCKBACK_RESIST, HERO_PUSH_LOCK, FLIGHT_POINT_ROAM_MUL, DPS_WINDOW,
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
  updateProjectiles, updateTraps, baseCost, setFlight, flightMode, signalRange, hasRoamingDrones,
} from './towers.js';
import {
  initHero, gainHeroXp, tickHero, heroUltStatus, activateUlt as fireUlt, heroXpInfo, heroPace, waveClearXp,
  damageXp, heroLevelStatus, buyHeroLevel, canMoveHero, moveHero, ultRank,
} from './hero.js';
import { generateWave, summarizeWave } from './waves.js';
import { generateFreeplayWave } from './freeplay.js';
import { buildWaveWarnings, buildDebrief } from './report.js';
import { snapshotSim, restoreSim } from './snapshot.js';

const MAX_EVENT_BACKLOG = 20000;

/** Rounds coin costs to a multiple of 5 (min 5). */
export function roundCost(c) {
  return Math.max(5, Math.round(c / 5) * 5);
}

export class Sim {
  /**
   * @param {{ stageId?: string, difficulty?: string, loadout?: {unitId: string, stats?: object}[],
   *   hero?: {unitId: string, stats?: object}|null, heroes?: ({unitId: string, stats?: object}|null)[],
   *   seed?: number, options?: { endless?: boolean, autoStart?: boolean, freeplay?: boolean },
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
    this.options = { endless: false, autoStart: false, ...options };
    this.seed = seed;
    this.rng = createRng(seed);

    this.pathData = buildPaths(this.map);
    if (!this.pathData.length) throw new Error(`[sim] map "${this.map.id}" has no paths`);
    this.paths = this.pathData.map((p) => p.points.map((pt) => [pt[0], pt[1]]));
    this.pathTiles = pathTileSet(this.map);
    this.placement = createPlacementRules(this.map, this.pathData);

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
    /** Freeplay pressure of the current wave (flat armor, Resolve budgets) for every enemy entering it. */
    this._fp = null;
    /** A freeplay run ended by finish() (state 'won' after the goal), not by defeat. */
    this.finished = false;
    this.maxLives = this.diff.lives ?? this.stage.lives ?? 100;
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
    /** Seconds until every girl's recentDps is re-measured (src/sim/buffs.js). */
    this._dpsTimer = DPS_WINDOW;
    this._scratch = [];
    this._scratch2 = [];
    this._hitOut = {};
    this._dotOut = {};
    this._statusCtx = { rng: this.rng, element: null, attackType: null, sourceUid: null };
    this.grid = new SpatialGrid(-3, -3, (this.map.width || 20) + 3, (this.map.height || 12) + 3, 2);
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
    if (this.state === 'wave') this._spawnTick(dt);
    this.grid.rebuild(this.enemies);
    updateEnemyAuras(this);
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.dead) updateEnemy(this, e, dt);
      if (this.state === 'lost') return;
    }
    this._updateBuffs(dt);
    for (let i = 0; i < this.towers.length; i++) updateTower(this, this.towers[i], dt);
    updateProjectiles(this, dt);
    updateTraps(this, dt);
    this._removeDead();
    tickHero(this, dt);
    this._checkWaveEnd();
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
      let mul = 1;
      for (const b of this._globalBuffs) {
        b.left -= dt;
        if (b.left > 0) mul = Math.max(mul, b.mul);
      }
      this._globalBuffs = this._globalBuffs.filter((b) => b.left > 0);
      if (mul !== this.globalRateMul) {
        this.globalRateMul = mul;
        this._buffsDirty = true;
      }
    }
    this._buffTimer -= dt;
    if (this._buffsDirty || this._buffTimer <= 0) {
      recomputeBuffs(this);
      this._buffsDirty = false;
      this._buffTimer = BUFF_REFRESH;
    }
  }

  /**
   * Multiplies every tower's attack rate for `duration` seconds (strongest active buff wins). `src` = the
   * girl who cast it (the buff icons; default the hero).
   */
  addGlobalRateBuff(mul, duration, src = this.hero?.uid ?? -1) {
    this._globalBuffs.push({ mul, left: duration, src });
    this.globalRateMul = Math.max(this.globalRateMul, mul);
    this._buffsDirty = true;
  }

  // -------------------------------------------------------------------------
  // Events / ids / cash
  // -------------------------------------------------------------------------

  _emit(type, payload) {
    if (this.events.length >= MAX_EVENT_BACKLOG) this.events.splice(0, this.events.length >> 1);
    this.events.push({ type, ...payload });
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
      speedMul: (this.diff.speedMul ?? 1) * (o.speedMul ?? 1),
      cashMul: (this.diff.cashMul ?? 1) * this.cashScale,
      time: this.time,
      rng: this.rng,
      wave: this.wave,
    });
    if (o.parent) e.parentUid = o.parent.uid;
    if (o.leak != null) e.leak = o.leak;
    if (o.mods) applySpawnMods(e, o.mods);
    if (this._fp) applyPressure(e, this._fp);
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
    const res = computeHit(e, spec, roll, scale, this._hitOut);
    if (!res) return -1;
    const hpBefore = e.hp;
    const flags = applyHitResult(e, res);
    const dealt = Math.min(res.toHp, Math.max(0, hpBefore)) + res.toBarrier;
    e.flash = 1;
    e.lastDamageAt = this.time;
    this._emit('hit', {
      uid: e.uid, x: e.x, y: e.y, amount: res.toHp + res.toBarrier, crit: res.crit, attackType: spec.attackType, effective: res.effective,
    });
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
    const list = spec.status;
    if (list) for (let i = 0; i < list.length; i++) this._applyStatusEvent(e, list[i], ctx);
    if (spec.mark && spec.mark.bonus > 0) this._applyStatusEvent(e, { type: 'mark', bonus: spec.mark.bonus, duration: spec.mark.duration || 3 }, ctx);
    if (spec.silence > 0) this._applyStatusEvent(e, { type: 'silence', duration: spec.silence }, ctx);
    if (spec.reveal > 0) this._applyStatusEvent(e, { type: 'reveal', duration: spec.reveal }, ctx);
    if (spec.attackType === 'holy') {
      if (e.phasing) endPhasing(this, e);
      if (e.traits.field) this._applyStatusEvent(e, { type: 'silence', duration: HOLY_SILENCE }, ctx);
    }
    if (spec.knockback > 0) {
      let amt = spec.knockback * (KNOCKBACK_RESIST[e.tier] ?? 1);
      if (e.kbLeft != null) { amt = Math.min(amt, e.kbLeft); e.kbLeft -= amt; }
      // a hero's push-back holds off for HERO_PUSH_LOCK seconds per enemy, so she cannot pin a lane
      if (tower?.isHero && amt > 0) {
        if (e.pushLock > this.time) amt = 0;
        else e.pushLock = this.time + HERO_PUSH_LOCK;
      }
      if (amt > 0) {
        e.dist = Math.max(0, e.dist - amt);
        placeOnPath(e, this.pathData[e.pathIndex]);
      }
    }
    syncStatusFlags(e);
  }

  /** Burn/poison tick. */
  _dot(e, kind, amount, status) {
    if (!(amount > 0) || e.dead) return;
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
    const bounty = this._gainCash(e.bounty);
    this.kills[e.id] = (this.kills[e.id] || 0) + 1;
    if (tower && !tower.removed) {
      tower.kills++;
      if (drone) {
        drone.kills++;
        tower.droneKills++;
      }
    }
    this._emit('death', { uid: e.uid, id: e.id, x: e.x, y: e.y, bounty });
    onEnemyDeath(this, e);
  }

  _leak(e) {
    if (e.dead) return;
    e.dead = true;
    e.leaked = true;
    const lost = Math.min(this.lives, e.leak === Infinity ? this.lives : e.leak);
    this.lives -= lost;
    this.stats.leaks += lost;
    this.stats.enemiesLeaked++;
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
      const opts = { pathCount: this.pathData.length, pathLengths: this.pathData.map((p) => p.length) };
      w = this.freeplay && n > this.totalWaves ? generateFreeplayWave(this.stage, n, this.data.enemy, opts) : generateWave(this.stage, n, this.data.enemy, opts);
      this._waveCache.set(n, w);
    }
    return w;
  }

  /** Starts the next wave (only in 'prep' or 'between'). @returns {boolean} */
  startNextWave() {
    if (this.state !== 'prep' && this.state !== 'between') return false;
    if (!this.endless && this.wave >= this.lastWave) return false;
    this.wave++;
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
    this._emit('waveStart', { wave: this.wave });
    this._spawnTick(0);
    return true;
  }

  _checkWaveEnd() {
    if (this.state !== 'wave') return;
    if (this._spawnIndex < this._spawnQueue.length || this.enemies.length > 0) return;
    const cashMul = this.diff.cashMul ?? 1;
    const bonus = this._gainCash((BATTLE.waveClearBonusBase + 6 * this.wave) * cashMul * this.cashScale);
    this._emit('cash', { amount: bonus, reason: 'waveBonus' });
    if (!this.diff.noIncome) {
      for (const t of this.towers) {
        const inc = t.stats.income;
        if (!inc || t.disabled > 0) continue;
        const interest = Math.min(150, (inc.interest || 0) * this.cash);
        const amount = this._gainCash((inc.perWave || 0) * cashMul + interest);
        if (amount > 0) this._emit('cash', { amount, reason: 'income', towerUid: t.uid });
      }
    }
    // every placed hero (both players' in co-op), never the view-dependent sim.hero
    const k = heroPace(this);
    for (const h of this.heroes) if (h && !h.removed) gainHeroXp(this, h, waveClearXp(this.wave, k), 'wave');
    this.wavesCleared = this.wave;
    this._emit('waveEnd', { wave: this.wave, bonus });
    // Freeplay: the stage's own last wave is the goal — the clear is banked, the battle goes on.
    const goal = this.freeplay && this.wave === this.totalWaves;
    if (goal) this._emit('goal', { wave: this.wave });
    if (!this.endless && this.wave >= this.lastWave) {
      this.state = 'won';
      this._emit('won', {});
      return;
    }
    this.state = 'between';
    if (this.options.autoStart) this._autoTimer = goal ? this.stage.freeplay.clearPause ?? AUTO_START_DELAY : AUTO_START_DELAY;
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
    return roundCost(raw * (this.diff.costMul ?? 1) * (us.costMul ?? 1) * (1 - cut));
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
   * tile (legacy) and resolve to its centre.
   * @returns {object|null} TowerRT
   */
  placeTower(unitId, x, y) {
    if (this.state === 'won' || this.state === 'lost') return null;
    const chk = this.canPlace(unitId, x, y);
    if (!chk.ok) return null;
    x = chk.x;
    y = chk.y;
    const def = this.data.unit(unitId);
    const isHero = !!this.heroConfig && unitId === this.heroConfig.unitId;
    this._spend(chk.cost);
    const t = createTower(def, { uid: this._nextUid(), x, y, radius: footprintRadius(def), isHero, unitStats: this._unitStats(unitId), cost: chk.cost });
    if (isHero) {
      initHero(t);
      t.heroIndex = this._heroConfig.index;
      this.heroes[t.heroIndex] = t;
    }
    refreshTowerStats(t, this.globalRateMul);
    this.towers.push(t);
    this._towerByUid.set(t.uid, t);
    this._buffsDirty = true;
    recomputeBuffs(this);
    this.stats.towersPlaced++;
    this.stats.towerUnits[t.uid] = unitId;
    this._emit('place', { towerUid: t.uid, unitId, x, y, tx: t.tx, ty: t.ty });
    return t;
  }

  /** Legacy tile wrapper: placeTower at the centre of tile (tx, ty). */
  placeTowerTile(unitId, tx, ty) {
    return this.placeTower(unitId, Math.floor(tx) + 0.5, Math.floor(ty) + 0.5);
  }

  /** Re-resolves stats (upgrades / hero levels) and keeps buffs consistent. */
  _refreshTower(t) {
    refreshTowerStats(t, this.globalRateMul);
    this._buffsDirty = true;
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
  _upgradeCost(t, tier) {
    const us = t.unitStats || DEFAULT_UNIT_STATS;
    const cut = Math.min(0.5, t.buff?.costCut || 0);
    return roundCost((tier.cost || 0) * (this.diff.costMul ?? 1) * (us.costMul ?? 1) * (1 - cut));
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
    const cost = this._upgradeCost(t, next);
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
   * @returns {boolean}
   */
  upgradeTower(uid, path, opts = {}) {
    if (this.state === 'won' || this.state === 'lost') return false;
    const st = this.upgradeStatus(uid, path, opts);
    if (st.locked) return false;
    const t = this.getTower(uid);
    this._spend(st.cost);
    t.spent += st.cost;
    t.tiers[path]++;
    this._refreshTower(t);
    recomputeBuffs(this);
    this.stats.upgrades++;
    this._emit('upgrade', { towerUid: uid, path, tier: t.tiers[path] });
    return true;
  }

  /** Coins returned when selling (70% of everything spent on the tower). */
  sellValue(uid) {
    const t = this.getTower(uid);
    return t ? Math.floor(t.spent * BATTLE.sellRefund) : 0;
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
    const refund = this.sellValue(uid);
    this.cash += refund;
    t.removed = true;
    this.towers = this.towers.filter((x) => x !== t);
    this._towerByUid.delete(uid);
    this.traps = this.traps.filter((tr) => tr.ownerUid !== uid);
    t.turrets = [];
    this._buffsDirty = true;
    recomputeBuffs(this);
    this._emit('sell', { towerUid: uid, refund });
    return refund;
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
    this._buffsDirty = true;
    recomputeBuffs(this);
  }

  setTargetMode(uid, mode) {
    const t = this.getTower(uid);
    if (!t || !TARGET_MODES[mode]) return false;
    t.targetMode = mode;
    t.rampTarget = null;
    t.rampStacks = 0;
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
    const dps = e.behavior === 'none' || e.behavior === 'trap' ? 0 : e.damage * e.rate * (e.behavior === 'pulse' ? 1 : e.projectiles);
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
      buff: { ...t.buff, globalRateMul: this.globalRateMul },
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
    };
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
    };
  }
}


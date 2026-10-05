// Battle simulation (CONTRACTS.md §6). Pure JS, deterministic for a given seed and
// sequence of player actions, fixed 1/60 s internal timestep.

import { DIFFICULTIES, BATTLE, TARGET_MODES } from '../data/types.js';
import { createRng } from '../core/rng.js';
import {
  STEP, MAX_STEPS_PER_UPDATE, HOLY_SILENCE, HERO_XP_PER_DAMAGE, heroWaveXp, AUTO_START_DELAY,
  BUFF_REFRESH, DEFAULT_UNIT_STATS, KNOCKBACK_RESIST,
} from './constants.js';
import { createDataSource } from './data.js';
import { buildPaths, pathTileSet } from './path.js';
import { SpatialGrid } from './grid.js';
import { crosspathBlock } from './mods.js';
import {
  computeHit, applyHitResult, computeDot, BARRIER_BROKE, SHELL_BROKE,
} from './combat.js';
import { applyStatus } from './status.js';
import {
  createEnemy, placeOnPath, updateEnemy, updateEnemyAuras, onEnemyDeath, checkPhases, endPhasing,
  syncStatusFlags,
} from './enemies.js';
import {
  createTower, refreshTowerStats, recomputeBuffs, costCutAt, updateTower,
  updateProjectiles, updateTraps, baseCost,
} from './towers.js';
import {
  initHero, gainHeroXp, tickHero, heroUltStatus, activateUlt as fireUlt, heroXpInfo,
} from './hero.js';
import { generateWave, summarizeWave } from './waves.js';
import { buildWaveWarnings, buildDebrief } from './report.js';

const MAX_EVENT_BACKLOG = 20000;

/** Rounds coin costs to a multiple of 5 (min 5), BTD6-style. */
export function roundCost(c) {
  return Math.max(5, Math.round(c / 5) * 5);
}

export class Sim {
  /**
   * @param {{ stageId?: string, difficulty?: string, loadout?: {unitId: string, stats?: object}[],
   *   hero?: {unitId: string, stats?: object}|null, seed?: number,
   *   options?: { endless?: boolean, autoStart?: boolean },
   *   data?: { stage?, map?, units?, enemies? } }} opts
   */
  constructor({ stageId, difficulty = 'normal', loadout = [], hero = null, seed = 1, options = {}, data = {} } = {}) {
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

    this.loadout = new Map();
    this.heroConfig = null;
    for (const entry of loadout || []) {
      const def = entry && ds.unit(entry.unitId);
      if (!def) continue;
      const stats = { ...DEFAULT_UNIT_STATS, ...(entry.stats || {}) };
      if (def.kind === 'hero') {
        if (!hero && !this.heroConfig) this.heroConfig = { unitId: def.id, stats };
      } else this.loadout.set(def.id, stats);
    }
    if (hero && ds.unit(hero.unitId)) this.heroConfig = { unitId: hero.unitId, stats: { ...DEFAULT_UNIT_STATS, ...(hero.stats || {}) } };

    this.endless = !!this.options.endless || !Number.isFinite(this.stage.waves);
    this.totalWaves = this.endless ? Infinity : this.stage.waves ?? 10;
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
    this.hero = null;
    this.encountered = new Set();
    this.kills = {};
    // leaks = lives lost; leakLog/leaksByEnemy/leaksByWave feed the defeat debrief.
    this.stats = {
      damageByTower: {}, damageByType: {}, leaks: 0, cashEarned: 0, cashSpent: 0, enemiesLeaked: 0, towersPlaced: 0,
      upgrades: 0, ultsUsed: 0, leakLog: [], leaksByEnemy: {}, leaksByWave: {}, towerUnits: {},
    };
    this.warnings = [];
    this.globalRateMul = 1;

    this.events = [];
    this._uid = 1;
    this._acc = 0;
    this._cashCarry = 0;
    this._occupied = new Map();
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
    this._scratch = [];
    this._scratch2 = [];
    this._hitOut = {};
    this._dotOut = {};
    this._statusCtx = { rng: this.rng, element: null, attackType: null, sourceUid: null };
    this.grid = new SpatialGrid(-3, -3, (this.map.width || 20) + 3, (this.map.height || 12) + 3, 2);
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

  /** Multiplies every tower's attack rate for `duration` seconds (strongest active buff wins). */
  addGlobalRateBuff(mul, duration) {
    this._globalBuffs.push({ mul, left: duration });
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
   * @param {string} enemyId
   * @param {{ pathIndex?: number, dist?: number, hpMul?: number, parent?: object }} o
   * @returns {object|null} EnemyRT
   */
  spawnEnemy(enemyId, o = {}) {
    const def = this.data.enemy(enemyId);
    if (!def) {
      this.warnings.push(`unknown enemy "${enemyId}"`);
      return null;
    }
    const pathIndex = ((o.pathIndex ?? 0) % this.pathData.length + this.pathData.length) % this.pathData.length;
    const hpMul = o.hpMul ?? (this.stage.hpScale ?? 1) * this.diff.hpMul * this._waveHpMul;
    const e = createEnemy(def, {
      uid: this._nextUid(),
      pathIndex,
      dist: o.dist ?? 0,
      hpMul,
      speedMul: this.diff.speedMul ?? 1,
      cashMul: (this.diff.cashMul ?? 1) * this.cashScale,
      time: this.time,
      rng: this.rng,
      wave: this.wave,
    });
    if (o.parent) e.parentUid = o.parent.uid;
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
      this.spawnEnemy(s.enemyId, { pathIndex: s.pathIndex, dist: 0 });
    }
  }

  /**
   * Resolves one direct hit from a tower (or hero/trap/turret spec) on an enemy, then
   * applies on-hit effects. @returns {number} damage dealt, -1 if the enemy was not eligible
   */
  _hit(e, tower, spec, scale = 1) {
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
    this._credit(tower, dealt);
    this.stats.damageByType[spec.attackType] = (this.stats.damageByType[spec.attackType] || 0) + dealt;
    if (e.hp <= 0) {
      this._killEnemy(e, tower);
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
      const amt = spec.knockback * (KNOCKBACK_RESIST[e.tier] ?? 1);
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
    this._credit(tower, dealt);
    this.stats.damageByType[kind] = (this.stats.damageByType[kind] || 0) + dealt;
    if (e.hp <= 0) this._killEnemy(e, tower);
    else checkPhases(this, e);
  }

  _credit(tower, dealt) {
    if (!tower || !(dealt > 0)) return;
    tower.damageDealt += dealt;
    this.stats.damageByTower[tower.uid] = (this.stats.damageByTower[tower.uid] || 0) + dealt;
    if (tower.isHero && !tower.removed) gainHeroXp(this, tower, dealt * HERO_XP_PER_DAMAGE);
  }

  _killEnemy(e, tower) {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    const bounty = this._gainCash(e.bounty);
    this.kills[e.id] = (this.kills[e.id] || 0) + 1;
    if (tower && !tower.removed) tower.kills++;
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
      w = generateWave(this.stage, n, this.data.enemy, { pathCount: this.pathData.length, pathLengths: this.pathData.map((p) => p.length) });
      this._waveCache.set(n, w);
    }
    return w;
  }

  /** Starts the next wave (only in 'prep' or 'between'). @returns {boolean} */
  startNextWave() {
    if (this.state !== 'prep' && this.state !== 'between') return false;
    if (!this.endless && this.wave >= this.totalWaves) return false;
    this.wave++;
    const w = this._getWave(this.wave);
    this._spawnQueue = w.spawns;
    this._spawnIndex = 0;
    this._waveTime = 0;
    this._waveHpMul = w.hpMul;
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
    if (this.hero && !this.hero.removed) gainHeroXp(this, this.hero, heroWaveXp(this.wave));
    this.wavesCleared = this.wave;
    this._emit('waveEnd', { wave: this.wave, bonus });
    if (!this.endless && this.wave >= this.totalWaves) {
      this.state = 'won';
      this._emit('won', {});
      return;
    }
    this.state = 'between';
    if (this.options.autoStart) this._autoTimer = AUTO_START_DELAY;
  }

  /** Scouting info for wave n: [{ enemyId, count, traits, tier }]. */
  waveInfo(n) {
    if (!(n >= 1) || (!this.endless && n > this.totalWaves)) return [];
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

  /** Placement cost of a unit (optionally at a tile, which applies cost-cut auras). */
  placeCost(unitId, tx = null, ty = null) {
    const def = this.data.unit(unitId);
    if (!def) return Infinity;
    const us = this._unitStats(unitId) || DEFAULT_UNIT_STATS;
    const cut = tx == null ? 0 : costCutAt(this, tx + 0.5, ty + 0.5);
    return roundCost(baseCost(def) * (this.diff.costMul ?? 1) * (us.costMul ?? 1) * (1 - cut));
  }

  /** Terrain char at a tile ('X' outside the map). */
  tileAt(tx, ty) {
    const row = this.map.rows?.[ty];
    if (!row || tx < 0 || tx >= row.length) return 'X';
    return row[tx];
  }

  /**
   * @returns {{ ok: boolean, reason: null|'occupied'|'path'|'blocked'|'needsWater'|'needsLand'|'cash'|'heroPlaced'|'notInLoadout'|'outOfBounds', cost?: number }}
   */
  canPlace(unitId, tx, ty) {
    if (!Number.isInteger(tx) || !Number.isInteger(ty) || tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) {
      return { ok: false, reason: 'outOfBounds' };
    }
    const def = this.data.unit(unitId);
    const isHero = !!this.heroConfig && unitId === this.heroConfig.unitId;
    if (!def || (!isHero && !this.loadout.has(unitId))) return { ok: false, reason: 'notInLoadout' };
    if (isHero && this.hero) return { ok: false, reason: 'heroPlaced' };
    if (this._occupied.has(`${tx},${ty}`)) return { ok: false, reason: 'occupied' };
    if (this.pathTiles.has(`${tx},${ty}`)) return { ok: false, reason: 'path' };
    const ch = this.tileAt(tx, ty);
    const water = ch === '~';
    const land = ch === '.' || ch === ',';
    if (!water && !land) return { ok: false, reason: 'blocked' };
    const placement = def.placement || 'land';
    if (placement === 'water' && !water) return { ok: false, reason: 'needsWater' };
    if (placement === 'land' && !land) return { ok: false, reason: 'needsLand' };
    const cost = this.placeCost(unitId, tx, ty);
    if (this.cash < cost) return { ok: false, reason: 'cash', cost };
    return { ok: true, reason: null, cost };
  }

  /** @returns {object|null} TowerRT */
  placeTower(unitId, tx, ty) {
    if (this.state === 'won' || this.state === 'lost') return null;
    const chk = this.canPlace(unitId, tx, ty);
    if (!chk.ok) return null;
    const def = this.data.unit(unitId);
    const isHero = !!this.heroConfig && unitId === this.heroConfig.unitId;
    this._spend(chk.cost);
    const t = createTower(def, { uid: this._nextUid(), tx, ty, isHero, unitStats: this._unitStats(unitId), cost: chk.cost });
    if (isHero) initHero(t);
    refreshTowerStats(t, this.globalRateMul);
    this.towers.push(t);
    this._occupied.set(`${tx},${ty}`, t);
    this._towerByUid.set(t.uid, t);
    if (isHero) this.hero = t;
    this._buffsDirty = true;
    recomputeBuffs(this);
    this.stats.towersPlaced++;
    this.stats.towerUnits[t.uid] = unitId;
    this._emit('place', { towerUid: t.uid, unitId, tx, ty });
    return t;
  }

  /** Re-resolves stats (upgrades / hero levels) and keeps buffs consistent. */
  _refreshTower(t) {
    refreshTowerStats(t, this.globalRateMul);
    this._buffsDirty = true;
  }

  towerAt(tx, ty) {
    return this._occupied.get(`${tx},${ty}`) || null;
  }

  getTower(uid) {
    return this._towerByUid.get(uid) || null;
  }

  /** Upgrade cost for the next tier of a path (applies difficulty, profile and cost-cut auras). */
  _upgradeCost(t, tier) {
    const us = t.unitStats || DEFAULT_UNIT_STATS;
    const cut = Math.min(0.5, t.buff?.costCut || 0);
    return roundCost((tier.cost || 0) * (this.diff.costMul ?? 1) * (us.costMul ?? 1) * (1 - cut));
  }

  /**
   * @returns {{ tier: number, next: object|null, cost: number, locked: boolean, reason: null|'max'|'crosspath'|'cash' }}
   */
  upgradeStatus(uid, path) {
    const t = this.getTower(uid);
    if (!t || !(path >= 0 && path <= 2)) return { tier: 0, next: null, cost: 0, locked: true, reason: 'max' };
    const tier = t.tiers[path];
    const tiersDef = t.def.paths?.[path]?.tiers || [];
    if (!tiersDef.length) return { tier, next: null, cost: 0, locked: true, reason: 'max' };
    const block = crosspathBlock(t.tiers, path, Math.min(5, tiersDef.length));
    const next = tiersDef[tier] || null;
    if (block === 'max' || !next) return { tier, next: null, cost: 0, locked: true, reason: 'max' };
    const cost = this._upgradeCost(t, next);
    if (block) return { tier, next, cost, locked: true, reason: block };
    if (this.cash < cost) return { tier, next, cost, locked: true, reason: 'cash' };
    return { tier, next, cost, locked: false, reason: null };
  }

  /** @returns {boolean} */
  upgradeTower(uid, path) {
    if (this.state === 'won' || this.state === 'lost') return false;
    const st = this.upgradeStatus(uid, path);
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

  /** Sells a tower. @returns {number} refund */
  sellTower(uid) {
    const t = this.getTower(uid);
    if (!t || this.state === 'won' || this.state === 'lost') return 0;
    const refund = this.sellValue(uid);
    this.cash += refund;
    t.removed = true;
    this.towers = this.towers.filter((x) => x !== t);
    this._occupied.delete(`${t.tx},${t.ty}`);
    this._towerByUid.delete(uid);
    this.traps = this.traps.filter((tr) => tr.ownerUid !== uid);
    t.turrets = [];
    if (this.hero === t) this.hero = null;
    this._buffsDirty = true;
    recomputeBuffs(this);
    this._emit('sell', { towerUid: uid, refund });
    return refund;
  }

  setTargetMode(uid, mode) {
    const t = this.getTower(uid);
    if (!t || !TARGET_MODES[mode]) return false;
    t.targetMode = mode;
    t.rampTarget = null;
    t.rampStacks = 0;
    return true;
  }

  /** Effective stats for the UI panel (after upgrades, levels and buffs). */
  towerStats(uid) {
    const t = this.getTower(uid);
    if (!t) return null;
    const e = t.eff;
    const dps = e.behavior === 'none' || e.behavior === 'trap' ? 0 : e.damage * e.rate * (e.behavior === 'pulse' ? 1 : e.projectiles);
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
      turret: e.turret ? { ...e.turret, damage: t.turretSpec?.damage ?? e.turret.damage, active: t.turrets.length } : null,
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
      sellValue: this.sellValue(uid),
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
        endless: this.endless,
      },
    };
  }
}


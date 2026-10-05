// EnemyRT creation and every enemy trait: armor, barrier, crystal, veil, regen, hasty,
// volatile, airborne, ward, brood/splitter, siphon, blink, fields, phasing, guardian,
// sabotage, decoy, enrage, summoner and boss phases.
//
// Functions take the Sim as context and use only these members of it:
//   time, rng, grid, towers, enemies, fields, pathData, _scratch,
//   _emit(type, payload), spawnEnemy(id, opts), _dot(enemy, kind, amount, status),
//   _leak(enemy), _isCleansed(tower)

import {
  AIR_ALT, BLINK_WARN, BLINK_INTERRUPTS, BARRIER_REGEN_RATE, ENRAGE_RADIUS, DEFAULT_LEAK,
} from './constants.js';
import { pointAt } from './path.js';
import {
  tickStatusDurations, isImmobile, slowAmount, abilitiesBlocked, hasAnyStatus,
} from './status.js';

const TRAIT_ORDER = [
  'armored', 'barrier', 'crystal', 'veiled', 'regen', 'hasty', 'volatile', 'airborne', 'ward', 'brood',
  'splitter', 'siphon', 'blink', 'field', 'phasing', 'guardian', 'sabotage', 'decoy', 'enrage', 'summoner',
];

/**
 * Trait keys of an EnemyDef for previews/UI ('armored' is derived from armor > 0).
 * @returns {string[]}
 */
export function enemyTraitKeys(def) {
  if (!def) return [];
  const t = def.traits || {};
  const keys = TRAIT_ORDER.filter((k) => (k === 'armored' ? (def.armor || 0) > 0 || !!t.armored : !!t[k]));
  for (const k of Object.keys(t)) if (t[k] && !keys.includes(k)) keys.push(k);
  for (const ph of def.phases || []) {
    for (const k of Object.keys(ph.set?.traits || {})) if (ph.set.traits[k] && !keys.includes(k)) keys.push(k);
  }
  return keys;
}

/** Field casters, siphoners and summoners — first picks for 'elite' targeting. */
export function isCaster(e) {
  const t = e.traits;
  return !!(t.field || t.siphon || t.summoner);
}

/** Lives an enemy takes when it leaks. */
export function leakAmount(def) {
  const tier = def.tier || 'normal';
  if (tier === 'boss') return Infinity;
  return def.leak ?? DEFAULT_LEAK[tier] ?? 1;
}

/**
 * Creates a runtime enemy.
 * @param {object} def EnemyDef
 * @param {{ uid: number, pathIndex: number, dist: number, hpMul: number, speedMul: number,
 *   cashMul: number, time: number, rng: { next(): number }, wave?: number }} o
 */
export function createEnemy(def, o) {
  const maxHp = Math.max(1, (def.hp || 1) * o.hpMul);
  const traits = { ...(def.traits || {}) };
  const e = {
    uid: o.uid,
    id: def.id,
    def,
    tier: def.tier || 'normal',
    family: def.family || null,
    x: 0,
    y: 0,
    alt: 0,
    dist: Math.max(0, o.dist || 0),
    pathIndex: o.pathIndex || 0,
    remaining: 0,
    seg: 0,
    hp: maxHp,
    maxHp,
    barrier: 0,
    maxBarrier: 0,
    armor: def.armor || 0,
    armorClass: def.armorClass || 'light',
    baseSpeed: (def.speed ?? 1) * o.speedMul,
    speed: (def.speed ?? 1) * o.speedMul,
    speedMul: o.speedMul,
    statuses: {},
    veiled: false,
    revealed: false,
    phasing: false,
    silenced: false,
    facing: 0,
    flash: 0,
    traits,
    ward: null,
    airborne: false,
    crystalCap: 0,
    crystalHits: 0,
    bounty: (def.bounty || 0) * o.cashMul,
    leak: leakAmount(def),
    hpMul: o.hpMul,
    wave: o.wave || 0,
    dead: false,
    leaked: false,
    isDecoy: false,
    parentUid: null,
    lastDamageAt: -1e9,
    // aura modifiers (recomputed every step)
    guard: 0,
    shield: 0,
    fieldHaste: 0,
    fieldRegen: 0,
    // ability timers (randomised phase so packs do not act in lockstep)
    hastyTimer: (o.rng ? o.rng.next() : 0) * (traits.hasty?.every || 1),
    hastyLeft: 0,
    bursting: false,
    blinkTimer: 0,
    blinkWarned: false,
    blinkWarnLeft: 0,
    blinkDest: 0,
    phaseTimer: (o.rng ? o.rng.next() : 0) * (traits.phasing?.every || 1) * 0.5,
    phaseLeft: 0,
    summonTimer: 0,
    decoyTimer: 0,
    sabotageCd: 0,
    fieldTimer: 0,
    fieldIndex: 0,
    enrageStacks: 0,
    nextPhase: 0,
    phases: [...(def.phases || [])].sort((a, b) => b.atHp - a.atHp),
    _crystalDef: null,
    _barrierDef: null,
  };
  initTraitState(e);
  return e;
}

/** (Re)derives runtime flags from e.traits. Called at creation and after boss phases. */
export function initTraitState(e) {
  const t = e.traits;
  e.veiled = !!t.veiled;
  e.airborne = !!t.airborne;
  e.alt = e.airborne ? AIR_ALT : 0;
  e.ward = t.ward || null;
  if (t.crystal !== e._crystalDef) {
    e._crystalDef = t.crystal || null;
    e.crystalCap = t.crystal ? t.crystal.cap ?? 1 : 0;
    e.crystalHits = t.crystal ? t.crystal.hits ?? 10 : 0;
  }
  if (t.barrier !== e._barrierDef) {
    e._barrierDef = t.barrier || null;
    e.maxBarrier = t.barrier ? Math.max(1, (t.barrier.hp || 0) * e.hpMul) : 0;
    e.barrier = e.maxBarrier;
  }
  if (!t.phasing) e.phasing = false;
  if (!t.blink) e.blinkWarned = false;
}

/** Places the enemy at its current path distance. */
export function placeOnPath(e, path) {
  const p = pointAt(path, e.dist, e._pt || (e._pt = {}), e.seg);
  e.x = p.x;
  e.y = p.y;
  e.facing = p.facing;
  e.seg = p.seg;
  e.remaining = path.length - e.dist;
}

/** Boss phases: applies every phase whose hp threshold has been crossed. */
export function checkPhases(sim, e) {
  while (e.nextPhase < e.phases.length && e.hp > 0 && e.hp / e.maxHp <= e.phases[e.nextPhase].atHp) {
    const ph = e.phases[e.nextPhase++];
    const set = ph.set || {};
    if (set.speed != null) e.baseSpeed = set.speed * e.speedMul;
    if (set.armor != null) e.armor = set.armor;
    if (set.armorClass) e.armorClass = set.armorClass;
    if (set.traits) {
      for (const k of Object.keys(set.traits)) {
        const v = set.traits[k];
        if (v === null || v === false) delete e.traits[k];
        else e.traits[k] = v;
      }
    }
    initTraitState(e);
    sim._emit('bossPhase', { uid: e.uid, announce: ph.announce || '' });
  }
}

/** Field currently projected (supports optional rotation: field.kinds + field.every). */
export function activeField(e) {
  const f = e.traits.field;
  if (!f) return null;
  if (Array.isArray(f.kinds) && f.kinds.length) {
    return { kind: f.kinds[e.fieldIndex % f.kinds.length], radius: f.radius ?? 2, amount: f.amount ?? 0.25 };
  }
  return f;
}

/**
 * Oni fields and guardians. Resets and recomputes every enemy's haste/shield/regen/guard
 * modifiers and rebuilds sim.fields (for renderer rings). The strongest source wins.
 */
export function updateEnemyAuras(sim) {
  const list = sim.enemies;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    e.guard = 0;
    e.shield = 0;
    e.fieldHaste = 0;
    e.fieldRegen = 0;
  }
  sim.fields.length = 0;
  const near = sim._scratch;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.dead) continue;
    const f = activeField(e);
    if (f) {
      const off = abilitiesBlocked(e);
      const radius = f.radius ?? 2;
      sim.fields.push({ uid: e.uid, x: e.x, y: e.y, radius, kind: f.kind, silenced: off });
      if (!off) {
        near.length = 0;
        sim.grid.query(e.x, e.y, radius, near);
        const amt = f.amount ?? 0.25;
        for (let j = 0; j < near.length; j++) {
          const o = near[j];
          if (f.kind === 'haste') o.fieldHaste = Math.max(o.fieldHaste, amt);
          else if (f.kind === 'shield') o.shield = Math.max(o.shield, amt);
          else if (f.kind === 'regen') o.fieldRegen = Math.max(o.fieldRegen, amt);
        }
      }
    }
    const g = e.traits.guardian;
    if (g && !isImmobile(e)) {
      near.length = 0;
      sim.grid.query(e.x, e.y, g.radius ?? 1.5, near);
      for (let j = 0; j < near.length; j++) {
        const o = near[j];
        if (o !== e) o.guard = Math.max(o.guard, g.reduction ?? 0.3);
      }
    }
  }
}

function enrageBonus(en, stacks) {
  const per = en.mul ?? 0.1;
  const cap = en.max == null ? 1 : en.max > 1 ? en.max - 1 : en.max;
  return Math.min(stacks * per, cap);
}

function tryBlink(sim, e, b, path, dt) {
  if (e.blinkWarned) {
    if (hasAnyStatus(e, BLINK_INTERRUPTS)) {
      e.blinkWarned = false;
      e.blinkTimer = 0;
      sim._emit('blinkInterrupted', { uid: e.uid });
      return;
    }
    e.blinkWarnLeft -= dt;
    if (e.blinkWarnLeft <= 0) {
      const fromX = e.x;
      const fromY = e.y;
      e.dist = Math.max(e.dist, e.blinkDest);
      placeOnPath(e, path);
      e.blinkWarned = false;
      e.blinkTimer = 0;
      sim._emit('blink', { uid: e.uid, fromX, fromY, x: e.x, y: e.y });
    }
    return;
  }
  e.blinkTimer += dt;
  const every = Math.max(BLINK_WARN + 0.1, b.every ?? 4);
  if (e.blinkTimer < every - BLINK_WARN) return;
  if (hasAnyStatus(e, BLINK_INTERRUPTS)) {
    e.blinkTimer = 0;
    return;
  }
  const dest = Math.min(path.length - 0.25, e.dist + (b.distance ?? 2) + e.speed * BLINK_WARN);
  e.blinkDest = dest;
  e.blinkWarned = true;
  e.blinkWarnLeft = BLINK_WARN;
  const p = pointAt(path, dest, {});
  sim._emit('teleportWarn', { uid: e.uid, x: p.x, y: p.y });
}

function updateAbilities(sim, e, path, dt) {
  const t = e.traits;
  const blocked = abilitiesBlocked(e);

  if (t.hasty) {
    if (e.hastyLeft > 0) e.hastyLeft -= dt;
    else if (!blocked) {
      e.hastyTimer += dt;
      if (e.hastyTimer >= (t.hasty.every ?? 4)) {
        e.hastyTimer = 0;
        e.hastyLeft = t.hasty.duration ?? 1;
      }
    }
    e.bursting = e.hastyLeft > 0;
  }

  if (t.blink) tryBlink(sim, e, t.blink, path, dt);

  if (t.phasing) {
    if (e.phasing) {
      e.phaseLeft -= dt;
      if (e.phaseLeft <= 0 || e.statuses.silence) endPhasing(sim, e);
    } else {
      e.phaseTimer += dt;
      if (e.phaseTimer >= (t.phasing.every ?? 5)) {
        e.phaseTimer = 0;
        if (!blocked) {
          e.phasing = true;
          e.phaseLeft = t.phasing.duration ?? 2;
          sim._emit('phase', { uid: e.uid, on: true });
        }
      }
    }
  }

  if (t.siphon && !blocked && !e.statuses.poison) {
    const near = sim._scratch;
    near.length = 0;
    sim.grid.query(e.x, e.y, t.siphon.radius ?? 1.5, near);
    const per = (t.siphon.rate ?? 2) * e.hpMul * dt;
    let drained = 0;
    for (let j = 0; j < near.length; j++) {
      const o = near[j];
      if (o === e) continue;
      const d = Math.min(per, o.hp - 1);
      if (d > 0) {
        o.hp -= d;
        drained += d;
      }
    }
    if (drained > 0) e.hp = Math.min(e.maxHp, e.hp + drained);
  }

  if (t.field && Array.isArray(t.field.kinds) && t.field.kinds.length > 1 && !blocked) {
    e.fieldTimer += dt;
    if (e.fieldTimer >= (t.field.every ?? 6)) {
      e.fieldTimer = 0;
      e.fieldIndex++;
    }
  }

  if (t.summoner && !blocked) {
    e.summonTimer += dt;
    if (e.summonTimer >= (t.summoner.every ?? 6)) {
      e.summonTimer = 0;
      const n = t.summoner.count ?? 1;
      for (let i = 0; i < n; i++) {
        sim.spawnEnemy(t.summoner.spawn, { pathIndex: e.pathIndex, dist: Math.max(0, e.dist - 0.4 - 0.35 * i), hpMul: e.hpMul, parent: e });
      }
    }
  }

  if (t.decoy && !blocked) {
    e.decoyTimer += dt;
    if (e.decoyTimer >= (t.decoy.every ?? 6)) {
      e.decoyTimer = 0;
      const n = t.decoy.count ?? 2;
      for (let i = 0; i < n; i++) {
        const d = sim.spawnEnemy(t.decoy.spawn, { pathIndex: e.pathIndex, dist: Math.min(path.length - 0.5, e.dist + 0.35 * (i + 1)), hpMul: e.hpMul, parent: e });
        if (d) d.isDecoy = true;
      }
    }
  }

  if (t.sabotage) {
    if (e.sabotageCd > 0) e.sabotageCd -= dt;
    else if (!blocked) {
      const r = t.sabotage.radius ?? 1.5;
      let best = null;
      let bestD = r * r;
      for (const tw of sim.towers) {
        if (tw.disabled > 0 || sim._isCleansed(tw)) continue;
        const dx = tw.x - e.x;
        const dy = tw.y - e.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= bestD) {
          bestD = d2;
          best = tw;
        }
      }
      if (best) {
        best.disabled = Math.max(best.disabled, t.sabotage.duration ?? 3);
        e.sabotageCd = t.sabotage.cooldown ?? 6;
        sim._emit('sabotage', { towerUid: best.uid, enemyUid: e.uid });
      }
    }
  }
}

/** Ends phasing (holy hit, silence or timer). */
export function endPhasing(sim, e) {
  if (!e.phasing) return;
  e.phasing = false;
  e.phaseLeft = 0;
  e.phaseTimer = 0;
  sim._emit('phase', { uid: e.uid, on: false });
}

/** Mirrors status-derived flags onto the EnemyRT. */
export function syncStatusFlags(e) {
  e.revealed = !!e.statuses.reveal;
  e.silenced = !!e.statuses.silence;
}

/**
 * One fixed step for one enemy: damage over time, status timers, healing, abilities and
 * movement (leaks are handed to sim._leak).
 */
export function updateEnemy(sim, e, dt) {
  const st = e.statuses;
  if (st.burn) sim._dot(e, 'burn', st.burn.dps * dt, st.burn);
  if (!e.dead && st.poison) sim._dot(e, 'poison', st.poison.dps * dt, st.poison);
  if (e.dead) return;
  tickStatusDurations(e, dt);
  syncStatusFlags(e);

  const t = e.traits;
  if (!st.poison && e.hp < e.maxHp) {
    let heal = 0;
    if (t.regen && sim.time - e.lastDamageAt >= (t.regen.delay ?? 2)) heal += e.maxHp * (t.regen.pct ?? 0.02) * dt;
    if (e.fieldRegen > 0) heal += e.maxHp * e.fieldRegen * dt;
    if (heal > 0) e.hp = Math.min(e.maxHp, e.hp + heal);
  }
  if (t.barrier && t.barrier.regenDelay != null && e.maxBarrier > 0 && e.barrier < e.maxBarrier
    && sim.time - e.lastDamageAt >= t.barrier.regenDelay) {
    e.barrier = Math.min(e.maxBarrier, e.barrier + e.maxBarrier * BARRIER_REGEN_RATE * dt);
  }

  const path = sim.pathData[e.pathIndex];
  updateAbilities(sim, e, path, dt);
  if (e.dead) return;

  let mul;
  if (isImmobile(e)) mul = 0;
  else {
    mul = 1 - slowAmount(e);
    if (e.fieldHaste > 0) mul *= 1 + e.fieldHaste;
    if (e.hastyLeft > 0) mul *= t.hasty?.mul ?? 2;
    if (t.enrage && e.enrageStacks > 0) mul *= 1 + enrageBonus(t.enrage, e.enrageStacks);
  }
  e.speed = e.baseSpeed * mul;
  e.dist += e.speed * dt;
  if (e.dist >= path.length) {
    sim._leak(e);
    return;
  }
  placeOnPath(e, path);
  if (e.flash > 0) e.flash = Math.max(0, e.flash - dt * 6);
}

/**
 * Death side effects: volatile stun, brood/splitter children, enrage packmates.
 * Bounty, kill counters and the 'death' event are handled by the Sim.
 */
export function onEnemyDeath(sim, e) {
  const t = e.traits;
  if (t.volatile) {
    const r = t.volatile.radius ?? 1.5;
    for (const tw of sim.towers) {
      if (sim._isCleansed(tw)) continue;
      if (Math.hypot(tw.x - e.x, tw.y - e.y) <= r) tw.disabled = Math.max(tw.disabled, t.volatile.stun ?? 1.5);
    }
    sim._emit('explode', { x: e.x, y: e.y, radius: r, element: 'fire', volatile: true });
  }
  for (const key of ['brood', 'splitter']) {
    const b = t[key];
    if (!b || !b.spawn) continue;
    const n = b.count ?? 2;
    const children = [];
    for (let i = 0; i < n; i++) {
      const offset = (i - (n - 1) / 2) * 0.3;
      const c = sim.spawnEnemy(b.spawn, { pathIndex: e.pathIndex, dist: Math.max(0, e.dist + offset), hpMul: e.hpMul, parent: e });
      if (c) children.push(c.uid);
    }
    if (children.length) sim._emit('split', { uid: e.uid, children });
  }
  if (e.family) {
    const r2 = ENRAGE_RADIUS * ENRAGE_RADIUS;
    for (const o of sim.enemies) {
      if (o === e || o.dead || !o.traits.enrage || o.family !== e.family) continue;
      const dx = o.x - e.x;
      const dy = o.y - e.y;
      if (dx * dx + dy * dy <= r2) o.enrageStacks++;
    }
  }
}

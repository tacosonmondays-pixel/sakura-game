// Status effects on enemies: application (with ward immunity, boss resistance, chance
// rolls and "keep the stronger values" merging), duration ticking and query helpers.

import { CC_RESIST, SLOW_RESIST, MAX_SLOW, SHRED_MAX_STACKS, HEX_BOSS_CAP, CURSE_SPREAD_STEPS } from './constants.js';

const STATUS_ELEMENT = { burn: 'fire', poison: 'poison', freeze: 'frost', shock: 'lightning', soak: 'water' };
// Statuses whose duration bosses/minibosses resist (CC_RESIST). 'ground' is not immobilising.
// 'hold' (Chigusa's vines, UNIT_GAPS P-10): the enemy cannot move; bosses and flyers are immune.
const CC_TYPES = { freeze: true, stun: true, shock: true, ground: true, hold: true };

/** Element a status belongs to (for ward immunity). Slow/vulnerable are frost only when the source is frost. */
export function statusElement(type, sourceElement) {
  if (type === 'slow' || type === 'vulnerable') return sourceElement === 'frost' ? 'frost' : null;
  return STATUS_ELEMENT[type] || null;
}

/**
 * Applies a StatusSpec to an enemy.
 * @param {object} enemy EnemyRT
 * @param {object} spec StatusSpec ({ type, amount|dps|bonus, duration, chance? })
 * @param {{ rng?: { next(): number }, element?: string|null, attackType?: string, sourceUid?: number|null,
 *   hitDamage?: number, curseDepth?: number }} ctx  hitDamage/curseDepth: curse burst + generation
 * @returns {'new'|'refresh'|null} null when not applied (chance failed, warded, dead)
 */
export function applyStatus(enemy, spec, ctx = {}) {
  if (!spec || !spec.type || enemy.dead) return null;
  if (spec.type === 'ground' && !enemy.airborne) return null; // only flyers can be grounded
  if (spec.type === 'hold' && (enemy.airborne || enemy.tier === 'boss')) return null; // vines hold walkers, never a boss
  if (spec.chance !== undefined && spec.chance < 1) {
    const roll = ctx.rng ? ctx.rng.next() : 0;
    if (!(roll < spec.chance)) return null;
  }
  const type = spec.type;
  const el = statusElement(type, ctx.element ?? null);
  if (el && enemy.ward === el) return null;

  const tier = enemy.tier || 'normal';
  let duration = spec.duration ?? 1;
  if (CC_TYPES[type]) {
    duration *= CC_RESIST[tier] ?? 1;
    if (enemy.ccLeft != null) { duration = Math.min(duration, enemy.ccLeft); enemy.ccLeft -= duration; }
  }
  if (duration <= 0) return null;

  const incoming = { type, duration, left: duration };
  if (type === 'slow') incoming.amount = Math.min(MAX_SLOW, (spec.amount ?? 0.3) * (SLOW_RESIST[tier] ?? 1));
  if (type === 'burn' || type === 'poison') {
    incoming.dps = spec.dps ?? 0;
    if (spec.pct > 0) incoming.pct = spec.pct; // fraction of max HP per second (src/sim/enemies.js)
  }
  if (type === 'shred') incoming.amount = spec.amount ?? 0;
  if (type === 'mark' || type === 'vulnerable') incoming.bonus = spec.bonus ?? 0;
  if (ctx.attackType) incoming.attackType = ctx.attackType;
  if (ctx.sourceUid != null) incoming.sourceUid = ctx.sourceUid;
  if (type === 'hex') {
    // a share of max HP per second (UNIT_GAPS P-15); `cap` = what one application may still take
    incoming.pct = spec.pct ?? 0;
    incoming.cap = tier === 'miniboss' || tier === 'boss' ? HEX_BOSS_CAP * enemy.maxHp : Infinity;
  }
  if (type === 'curse') {
    // burst = a share of the hit that applied it (spread curses carry an absolute burst)
    incoming.burst = spec.burst ?? (spec.burstMul ?? 0) * (ctx.hitDamage ?? 0);
    incoming.radius = spec.radius ?? 1;
    incoming.depth = ctx.curseDepth ?? 0;
    // rot: a share of the cursing hit a second while it lives (a passed curse carries an absolute rotDps); a
    // rotting curse also spreads while its enemy lives (src/sim/Sim.js _curseTick), first after a full interval
    incoming.rotDps = spec.rotDps ?? (spec.rot ?? 0) * (ctx.hitDamage ?? 0);
    if (incoming.rotDps > 0) incoming.spreadIn = CURSE_SPREAD_STEPS;
  }

  const cur = enemy.statuses[type];
  if (!cur) {
    if (type === 'shred') incoming.stacks = 1;
    enemy.statuses[type] = incoming;
    return 'new';
  }
  if (type === 'hex') {
    // a new application: the stronger share, a fresh timer and a fresh per-application cap
    if (incoming.pct >= cur.pct) {
      cur.pct = incoming.pct;
      if (incoming.sourceUid != null) cur.sourceUid = incoming.sourceUid;
    }
    cur.cap = incoming.cap;
    cur.duration = Math.max(cur.duration ?? 0, duration);
    cur.left = Math.max(cur.left, duration);
    return 'refresh';
  }
  if (type === 'curse') {
    // keep the larger burst (with its source and generation), the larger radius, the longer timer
    if (incoming.burst > cur.burst || (incoming.burst === cur.burst && incoming.depth < cur.depth)) {
      cur.burst = incoming.burst;
      cur.depth = incoming.depth;
      if (incoming.sourceUid != null) cur.sourceUid = incoming.sourceUid;
    }
    if (incoming.rotDps > (cur.rotDps ?? 0)) {
      cur.rotDps = incoming.rotDps;
      if (cur.spreadIn == null) cur.spreadIn = CURSE_SPREAD_STEPS;
    }
    cur.radius = Math.max(cur.radius, incoming.radius);
    cur.duration = Math.max(cur.duration ?? 0, duration);
    cur.left = Math.max(cur.left, duration);
    return 'refresh';
  }
  for (const k of ['amount', 'dps', 'bonus', 'pct']) {
    if (incoming[k] !== undefined) {
      if (incoming[k] >= (cur[k] ?? 0)) {
        cur[k] = incoming[k];
        if (incoming.attackType) cur.attackType = incoming.attackType;
        if (incoming.sourceUid != null) cur.sourceUid = incoming.sourceUid;
      }
    }
  }
  cur.duration = Math.max(cur.duration ?? 0, duration);
  cur.left = Math.max(cur.left, duration);
  if (type === 'shred') cur.stacks = Math.min(SHRED_MAX_STACKS, (cur.stacks || 1) + 1);
  return 'refresh';
}

/** Removes a status if present. */
export function clearStatus(enemy, type) {
  delete enemy.statuses[type];
}

/**
 * Counts down every status. Expired statuses are deleted.
 * @returns {boolean} true when at least one status expired
 */
export function tickStatusDurations(enemy, dt) {
  let expired = false;
  const st = enemy.statuses;
  for (const k in st) {
    st[k].left -= dt;
    if (st[k].left <= 0) {
      delete st[k];
      expired = true;
    }
  }
  return expired;
}

/** Frozen, stunned or shocked enemies cannot move or use abilities. */
export function isImmobile(enemy) {
  const st = enemy.statuses;
  return !!(st.freeze || st.stun || st.shock);
}

/** Held by a vine (Chigusa): cannot move, but keeps its abilities (unlike a stun). */
export function isHeld(enemy) {
  return !!enemy.statuses.hold;
}

/** Current slow fraction (0 = none). */
export function slowAmount(enemy) {
  return enemy.statuses.slow ? enemy.statuses.slow.amount || 0 : 0;
}

/** Abilities (fields, siphon, blink, phasing, summons, sabotage) are off while silenced or stunned. */
export function abilitiesBlocked(enemy) {
  return !!enemy.statuses.silence || isImmobile(enemy);
}

/** True if the enemy currently has any of the listed statuses. */
export function hasAnyStatus(enemy, types) {
  const st = enemy.statuses;
  for (let i = 0; i < types.length; i++) if (st[types[i]]) return true;
  return false;
}

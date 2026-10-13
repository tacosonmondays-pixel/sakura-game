// Tower runtime: creation, stat resolution + aura buffs, targeting, the attack behaviors
// (projectile, pulse, duel, beam, chain, trap, turret, mortar), projectiles (travel, pierce,
// splash, swept collision), traps, turrets, mortar shells, aim points and relay origins
// (familiars / mirrors attack from a point near the lane: t.ox, t.oy).
//
// Uses these Sim members: time, state, rng, grid, enemies, towers, projectiles, traps, shells,
// pathData, map, globalRateMul, globalDmgMul, _scratch, _scratch2, _relaySamples, _nextUid(), _emit(),
// _hit(e, tower, spec, scale)

import { ATTACK_TYPES, ELEMENTS } from '../data/types.js';
import {
  TIER_RANK, CHAIN_JUMP_RANGE, BEAM_HALF_WIDTH, LINE_HALF_WIDTH, TURRET_PROJECTILE_SPEED, TURRET_RING,
  PROJECTILE_Z, MORTAR_DELAY, MORTAR_AIM_SLACK, MORTAR_SCATTER, FAMILIAR_STANDOFF, RELAY_SAMPLE_STEP,
  ROLE_TARGET_MODE,
} from './constants.js';
import { resolveStats, normalizeBase } from './mods.js';
import { isEligible } from './combat.js';
import { isCaster } from './enemies.js';
import { segDistSq, projectOnSegment, samplePath, pointAt } from './path.js';

const WEAPON_KIND = {
  bow: 'arrow', rifle: 'bullet', cannon: 'shell', shuriken: 'shuriken', flask: 'flask', wrench: 'bolt',
  staff: 'orb', tome: 'orb', lantern: 'spark', bell: 'spark', gohei: 'spark', fan: 'needle', parasol: 'needle',
  trident: 'orb', rapier: 'needle', katana: 'shuriken', sword: 'shuriken', coinPurse: 'bullet',
  mic: 'spark', shield: 'spark', mirror: 'orb', spear: 'bolt', mallet: 'shuriken', puppet: 'needle', cards: 'shuriken',
};
const TYPE_KIND = { blast: 'shell', pierce: 'arrow', slash: 'shuriken', mystic: 'orb', holy: 'spark' };
const ARC_KINDS = { shell: true, fireball: true, flask: true };

/** Visual projectile kind for a unit (from its weapon, element and attack type). */
export function projectileKind(def, stats) {
  let kind = WEAPON_KIND[def.look?.weapon] || TYPE_KIND[stats.attackType] || 'arrow';
  if ((kind === 'shell' || stats.attackType === 'blast') && stats.element === 'fire') kind = 'fireball';
  if (stats.element === 'lightning' && (kind === 'orb' || kind === 'bullet')) kind = 'bolt';
  return kind;
}

/** Enemy collision radius for projectiles/beams. */
export function hitRadius(e) {
  return 0.3 + 0.06 * (e.def.size ?? 1);
}

function emptyBuff() {
  return { dmgMul: 1, rateMul: 1, rangeMul: 1, detection: false, costCut: 0, cleanse: false };
}

/**
 * Creates a TowerRT (contract fields + internals). Position is continuous world (x, y)
 * (free placement); `tx`/`ty` = the tile under the footprint centre (legacy consumers).
 * A caller that only passes `tx`/`ty` gets the tile centre.
 * @param {object} def UnitDef
 * @param {{ uid, x?, y?, tx?, ty?, radius?, isHero, unitStats, cost }} o
 */
export function createTower(def, o) {
  const x = o.x ?? (o.tx ?? 0) + 0.5;
  const y = o.y ?? (o.ty ?? 0) + 0.5;
  const t = {
    uid: o.uid,
    unitId: def.id,
    def,
    x,
    y,
    tx: Math.floor(x),
    ty: Math.floor(y),
    radius: o.radius ?? (o.isHero ? 0.5 : 0.42),
    isHero: !!o.isHero,
    tiers: [0, 0, 0],
    targetMode: ROLE_TARGET_MODE[def.role] || 'first',
    targetUid: null,
    facing: 0,
    cooldown: 0,
    disabled: 0,
    buffed: false,
    level: o.isHero ? 1 : 0,
    xp: 0,
    kills: 0,
    damageDealt: 0,
    spent: o.cost || 0,
    turrets: [],
    // internals
    unitStats: o.unitStats,
    stats: null,
    eff: null,
    buff: emptyBuff(),
    trapSpec: null,
    turretSpec: null,
    trapCount: 0,
    trapSpots: null,
    trapSpotsRange: -1,
    rampTarget: null,
    rampStacks: 0,
    buildTimer: 0,
    projKind: 'arrow',
    ultUnlocked: false,
    ultCooldown: 0,
    removed: false,
    // aim point (mortar / mirror / aimed hero ult) and relay origin (familiar / mirror)
    aim: null,
    origin: null,
    ox: x,
    oy: y,
  };
  return t;
}

/** Re-resolves a tower's stats after an upgrade / hero level / placement. */
export function refreshTowerStats(t, globalRateMul = 1, globalDmgMul = 1) {
  t.stats = resolveStats(t.def, { tiers: t.tiers, heroLevel: t.isHero ? t.level : 0, unitStats: t.unitStats });
  t.projKind = projectileKind(t.def, t.stats);
  refreshEffective(t, globalRateMul, globalDmgMul);
}

function hitSpecFrom(s, extra) {
  return {
    damage: s.damage,
    attackType: s.attackType,
    element: s.element,
    critChance: s.crit.chance,
    critMul: s.crit.mul,
    armorPen: s.armorPen,
    eliteMul: s.eliteMul,
    bossMul: s.bossMul,
    barrierMul: s.barrierMul,
    detection: s.detection,
    canHitAir: s.canHitAir,
    status: s.status,
    mark: s.mark,
    silence: s.silence,
    reveal: s.reveal,
    knockback: s.knockback,
    airMul: s.airMul,
    gather: s.gather,
    ...extra,
  };
}

/**
 * Builds tower.eff (stats × buffs × the global ult buffs) plus the trap and turret hit specs.
 * eff objects are never mutated after this: holding one is a snapshot (mortar shells do).
 */
export function refreshEffective(t, globalRateMul = 1, globalDmgMul = 1) {
  const s = t.stats;
  const b = t.buff;
  const detection = s.detection || b.detection;
  const dmgMul = b.dmgMul * globalDmgMul;
  t.eff = {
    ...s,
    damage: s.damage * dmgMul,
    rate: s.rate * b.rateMul * globalRateMul,
    range: s.range * b.rangeMul,
    detection,
    critChance: s.crit.chance,
    critMul: s.crit.mul,
  };
  const trapStatus = s.trap ? mergeLists(s.trap.status, s.status) : null;
  t.trapSpec = s.trap ? hitSpecFrom(s, {
    damage: s.trap.damage * dmgMul,
    // spirit-revealing seals can trigger on veiled enemies
    detection: detection || s.reveal > 0 || trapStatus.some((x) => x.type === 'reveal'),
    canHitAir: false,
    critChance: 0,
    knockback: 0,
    gather: 0,
    status: trapStatus,
    triggerRadius: s.trap.triggerRadius,
    splash: s.trap.splash,
    armTime: s.trap.armTime,
  }) : null;
  t.turretSpec = s.turret ? hitSpecFrom(s, {
    damage: s.turret.damage * dmgMul,
    rate: s.turret.rate * b.rateMul * globalRateMul,
    range: s.turret.range * b.rangeMul,
    attackType: s.turret.attackType || s.attackType,
    detection,
    canHitAir: true,
    knockback: 0,
    gather: 0,
    status: mergeLists(s.turret.status, s.status),
    pierce: 1,
    splash: 0,
  }) : null;
}

function mergeLists(a, b) {
  if (!b || !b.length) return a;
  if (!a || !a.length) return b;
  const types = new Set(a.map((s) => s.type));
  return [...a, ...b.filter((s) => !types.has(s.type))];
}

/**
 * Recomputes aura buffs (strongest source per key, no self-buff) and the global ult
 * rate buff. Disabled towers project no aura. Cleanse auras clear disables.
 * @returns {boolean} whether any tower's buff changed
 */
export function recomputeBuffs(sim) {
  const towers = sim.towers;
  let changed = false;
  for (const t of towers) {
    const nb = emptyBuff();
    for (const a of towers) {
      if (a === t || !a.stats?.aura || a.disabled > 0) continue;
      const au = a.stats.aura;
      const dx = a.x - t.x;
      const dy = a.y - t.y;
      if (dx * dx + dy * dy > au.range * au.range) continue;
      nb.dmgMul = Math.max(nb.dmgMul, au.dmgMul);
      nb.rateMul = Math.max(nb.rateMul, au.rateMul);
      nb.rangeMul = Math.max(nb.rangeMul, au.rangeMul);
      nb.detection = nb.detection || au.detection;
      nb.costCut = Math.max(nb.costCut, au.costCut);
      nb.cleanse = nb.cleanse || au.cleanse;
    }
    if (nb.cleanse && t.disabled > 0) t.disabled = 0;
    const ob = t.buff;
    const differs = ob.dmgMul !== nb.dmgMul || ob.rateMul !== nb.rateMul || ob.rangeMul !== nb.rangeMul
      || ob.detection !== nb.detection || ob.costCut !== nb.costCut || ob.cleanse !== nb.cleanse;
    const gDmg = sim.globalDmgMul ?? 1;
    if (differs || t._globalRate !== sim.globalRateMul || t._globalDmg !== gDmg) {
      t.buff = nb;
      t._globalRate = sim.globalRateMul;
      t._globalDmg = gDmg;
      refreshEffective(t, sim.globalRateMul, gDmg);
      changed = true;
    }
    t.buffed = nb.dmgMul > 1 || nb.rateMul > 1 || nb.rangeMul > 1 || nb.detection || nb.costCut > 0 || nb.cleanse
      || sim.globalRateMul > 1 || gDmg > 1;
  }
  return changed;
}

/** Strongest cost cut from auras covering tile centre (x, y). */
export function costCutAt(sim, x, y) {
  let cut = 0;
  for (const a of sim.towers) {
    const au = a.stats?.aura;
    if (!au || !au.costCut || a.disabled > 0) continue;
    if (Math.hypot(a.x - x, a.y - y) <= au.range) cut = Math.max(cut, au.costCut);
  }
  return Math.min(0.5, cut);
}

// ---------------------------------------------------------------------------
// Targeting
// ---------------------------------------------------------------------------

function priorityClass(e) {
  if (isCaster(e)) return 4;
  if (e.tier === 'boss' || e.tier === 'miniboss') return 3;
  if (e.tier === 'elite') return 2;
  return 0;
}

/** Higher = preferred. */
export function targetScore(mode, x, y, e) {
  switch (mode) {
    case 'last':
      return e.remaining;
    case 'strong':
      return (TIER_RANK[e.tier] || 0) * 1e8 + e.maxHp * 10 - e.remaining * 1e-3;
    case 'close': {
      const dx = e.x - x;
      const dy = e.y - y;
      return -(dx * dx + dy * dy);
    }
    case 'elite':
      return priorityClass(e) * 1e6 - e.remaining;
    case 'air': // flyers still in the sky first, then the leader
      return (e.airborne && !e.grounded ? 1e6 : 0) - e.remaining;
    default:
      return -e.remaining;
  }
}

/** Eligible enemies within `range` of (x, y) for `spec`, written into `out`. */
export function gatherTargets(sim, x, y, range, spec, out) {
  out.length = 0;
  sim.grid.query(x, y, range, out);
  let n = 0;
  for (let i = 0; i < out.length; i++) if (isEligible(out[i], spec)) out[n++] = out[i];
  out.length = n;
  return out;
}

/** Best single target or null. */
export function bestTarget(sim, x, y, range, spec, mode) {
  const c = gatherTargets(sim, x, y, range, spec, sim._scratch);
  let best = null;
  let bestS = -Infinity;
  for (let i = 0; i < c.length; i++) {
    const s = targetScore(mode, x, y, c[i]);
    if (s > bestS) {
      bestS = s;
      best = c[i];
    }
  }
  return best;
}

/** Up to `n` distinct targets sorted by preference (new array). */
export function selectTargets(sim, x, y, range, spec, mode, n) {
  if (n <= 1) {
    const b = bestTarget(sim, x, y, range, spec, mode);
    return b ? [b] : [];
  }
  const c = gatherTargets(sim, x, y, range, spec, sim._scratch);
  const arr = c.slice();
  arr.sort((a, b) => targetScore(mode, x, y, b) - targetScore(mode, x, y, a));
  if (arr.length > n) arr.length = n;
  return arr;
}

/** The girl turns toward her target (from where she stands, even when a familiar/mirror attacks). */
function face(t, e) {
  t.facing = Math.atan2(e.x - t.x, e.y - t.y);
  t.targetUid = e.uid;
}

function attackColor(spec) {
  return (spec.element && ELEMENTS[spec.element]?.color) || ATTACK_TYPES[spec.attackType]?.color || '#ffffff';
}

// ---------------------------------------------------------------------------
// Behaviors
// ---------------------------------------------------------------------------

/** Area hit centred on (x, y); emits 'explode'. */
export function explode(sim, tower, spec, x, y, radius) {
  const victims = sim.grid.query(x, y, radius, []);
  for (const e of victims) if (!e.dead) sim._hit(e, tower, spec, 1);
  sim._emit('explode', { x, y, radius, element: spec.element || null, attackType: spec.attackType });
}

function spawnProjectile(sim, t, spec, target, fromX, fromY, opts = {}) {
  const speed = opts.speed ?? spec.projectileSpeed;
  let dx = target.x - fromX;
  let dy = target.y - fromY;
  const d = Math.hypot(dx, dy) || 1e-6;
  dx /= d;
  dy /= d;
  if (opts.spread) {
    const c = Math.cos(opts.spread);
    const s = Math.sin(opts.spread);
    const nx = dx * c - dy * s;
    dy = dx * s + dy * c;
    dx = nx;
  }
  const kind = opts.kind || t.projKind;
  const range = opts.range ?? spec.range;
  const p = {
    uid: sim._nextUid(),
    kind,
    x: fromX,
    y: fromY,
    z: PROJECTILE_Z,
    vx: dx * speed,
    vy: dy * speed,
    ownerUid: t.uid,
    element: spec.element || null,
    attackType: spec.attackType,
    turretUid: opts.turretUid ?? null,
    // internals
    owner: t,
    spec,
    target,
    tx: target.x,
    ty: target.y,
    speed,
    pierce: opts.pierce ?? spec.pierce,
    splash: opts.splash ?? spec.splash,
    hits: [],
    travel: 0,
    maxTravel: range * 1.4 + 2,
    est: d,
    arc: ARC_KINDS[kind] ? Math.min(2.4, 0.6 + d * 0.22) : 0,
    targetAlt: target.alt || 0,
    dead: false,
  };
  sim.projectiles.push(p);
  return p;
}

function linePierce(sim, t, spec, target, length, halfWidth, pierce) {
  const sx = t.ox;
  const sy = t.oy;
  const dx = target.x - sx;
  const dy = target.y - sy;
  const d = Math.hypot(dx, dy) || 1e-6;
  const ex = sx + (dx / d) * length;
  const ey = sy + (dy / d) * length;
  const near = sim.grid.query((sx + ex) / 2, (sy + ey) / 2, length / 2 + 1, []);
  const hits = [];
  for (const e of near) {
    if (!isEligible(e, spec)) continue;
    const hr = halfWidth + hitRadius(e);
    if (segDistSq(e.x, e.y, sx, sy, ex, ey) <= hr * hr) hits.push(e);
  }
  hits.sort((a, b) => projectOnSegment(a.x, a.y, sx, sy, ex, ey) - projectOnSegment(b.x, b.y, sx, sy, ex, ey));
  if (!hits.includes(target)) hits.unshift(target);
  if (hits.length > pierce) hits.length = pierce;
  return { hits, ex, ey };
}

function attackProjectile(sim, t) {
  const spec = t.eff;
  const n = spec.projectiles;
  const targets = selectTargets(sim, t.ox, t.oy, spec.range, spec, t.targetMode, n);
  if (!targets.length) return false;
  face(t, targets[0]);
  for (let i = 0; i < n; i++) {
    const tgt = targets[i % targets.length];
    const dup = Math.floor(i / targets.length);
    if (spec.projectileSpeed <= 0) {
      if (tgt.dead) continue;
      if (spec.splash > 0) explode(sim, t, spec, tgt.x, tgt.y, spec.splash);
      else if (spec.pierce > 1) {
        const { hits } = linePierce(sim, t, spec, tgt, spec.range + 1, LINE_HALF_WIDTH, spec.pierce);
        for (const e of hits) if (!e.dead) sim._hit(e, t, spec, 1);
      } else sim._hit(tgt, t, spec, 1);
    } else {
      const spread = dup === 0 ? 0 : (dup % 2 ? 1 : -1) * 0.12 * Math.ceil(dup / 2);
      spawnProjectile(sim, t, spec, tgt, t.ox, t.oy, { spread });
    }
  }
  sim._emit('attack', { towerUid: t.uid, targetUid: targets[0].uid, kind: t.projKind });
  return true;
}

function attackPulse(sim, t) {
  const spec = t.eff;
  const c = gatherTargets(sim, t.ox, t.oy, spec.range, spec, sim._scratch);
  if (!c.length) return false;
  let victims = c.slice();
  if (victims.length > spec.maxTargets) {
    victims.sort((a, b) => targetScore(t.targetMode, t.ox, t.oy, b) - targetScore(t.targetMode, t.ox, t.oy, a));
    victims.length = spec.maxTargets;
  }
  face(t, victims[0]);
  for (const e of victims) if (!e.dead) sim._hit(e, t, spec, 1);
  sim._emit('pulse', { x: t.ox, y: t.oy, radius: spec.range, element: spec.element || null, attackType: spec.attackType, towerUid: t.uid });
  sim._emit('attack', { towerUid: t.uid, targetUid: victims[0].uid, kind: 'pulse' });
  return true;
}

function attackDuel(sim, t) {
  const spec = t.eff;
  let tgt = t.rampTarget;
  if (!tgt || tgt.dead || !isEligible(tgt, spec) || Math.hypot(tgt.x - t.ox, tgt.y - t.oy) > spec.range) {
    tgt = bestTarget(sim, t.ox, t.oy, spec.range, spec, t.targetMode);
  }
  if (!tgt) {
    t.rampTarget = null;
    t.rampStacks = 0;
    return false;
  }
  if (tgt !== t.rampTarget) {
    t.rampTarget = tgt;
    t.rampStacks = 0;
  }
  face(t, tgt);
  const ramp = spec.ramp;
  const scale = 1 + (ramp ? Math.min(ramp.per * t.rampStacks, ramp.max) : 0);
  const tx = tgt.x;
  const ty = tgt.y;
  sim._hit(tgt, t, spec, scale);
  t.rampStacks++;
  if (spec.splash > 0) {
    const near = sim.grid.query(tx, ty, spec.splash, []);
    for (const e of near) if (e !== tgt && !e.dead && isEligible(e, spec)) sim._hit(e, t, spec, 1);
  }
  sim._emit('attack', { towerUid: t.uid, targetUid: tgt.uid, kind: 'slash', ramp: t.rampStacks });
  return true;
}

function attackBeam(sim, t) {
  const spec = t.eff;
  const targets = selectTargets(sim, t.ox, t.oy, spec.range, spec, t.targetMode, spec.projectiles);
  if (!targets.length) {
    t.rampTarget = null;
    t.rampStacks = 0;
    return false;
  }
  face(t, targets[0]);
  // Resonant focus (ramp): builds while the lead target stays the same, resets on a switch
  const ramp = spec.ramp;
  let scale = 1;
  if (ramp) {
    if (targets[0] !== t.rampTarget) {
      t.rampTarget = targets[0];
      t.rampStacks = 0;
    }
    scale = 1 + Math.min(ramp.per * t.rampStacks, ramp.max);
  }
  const color = attackColor(spec);
  const width = 0.12 + 0.04 * Math.min(6, spec.pierce);
  for (const tgt of targets) {
    if (tgt.dead) continue;
    const { hits, ex, ey } = linePierce(sim, t, spec, tgt, spec.range, BEAM_HALF_WIDTH, spec.pierce);
    for (const e of hits) if (!e.dead) sim._hit(e, t, spec, scale);
    sim._emit('beam', { from: [t.ox, t.oy], to: [ex, ey], width, color, towerUid: t.uid, ramp: ramp ? t.rampStacks : 0 });
  }
  if (ramp) t.rampStacks++;
  sim._emit('attack', { towerUid: t.uid, targetUid: targets[0].uid, kind: 'beam' });
  return true;
}

function attackChain(sim, t) {
  const spec = t.eff;
  const targets = selectTargets(sim, t.ox, t.oy, spec.range, spec, t.targetMode, spec.projectiles);
  if (!targets.length) return false;
  face(t, targets[0]);
  const jump = CHAIN_JUMP_RANGE + spec.splash;
  for (const start of targets) {
    if (start.dead) continue;
    const points = [[t.ox, t.oy]];
    const hitSet = new Set();
    let cur = start;
    for (let j = 0; j <= spec.chain && cur; j++) {
      hitSet.add(cur.uid);
      points.push([cur.x, cur.y]);
      const cx = cur.x;
      const cy = cur.y;
      sim._hit(cur, t, spec, 1);
      if (j === spec.chain) break;
      const near = sim.grid.query(cx, cy, jump, sim._scratch2);
      let next = null;
      let bestD = Infinity;
      for (const e of near) {
        if (hitSet.has(e.uid) || !isEligible(e, spec)) continue;
        const d = (e.x - cx) ** 2 + (e.y - cy) ** 2;
        if (d < bestD) {
          bestD = d;
          next = e;
        }
      }
      sim._scratch2.length = 0;
      cur = next;
    }
    sim._emit('chain', { points, element: spec.element || null, towerUid: t.uid });
  }
  sim._emit('attack', { towerUid: t.uid, targetUid: targets[0].uid, kind: 'chain' });
  return true;
}

/** Path sample points within range, nearest-to-exit first (trap candidate spots). */
function trapSpots(sim, t) {
  const range = t.eff.range;
  if (t.trapSpots && t.trapSpotsRange === range) return t.trapSpots;
  const spots = [];
  for (const path of sim.pathData) {
    for (const s of samplePath(path, 0.5)) {
      if (s.hidden) continue; // no traps inside tunnels
      if (Math.hypot(s.x - t.x, s.y - t.y) <= range) spots.push({ x: s.x, y: s.y, remaining: path.length - s.d });
    }
  }
  spots.sort((a, b) => a.remaining - b.remaining);
  t.trapSpots = spots;
  t.trapSpotsRange = range;
  return spots;
}

function placeTrap(sim, t) {
  const trap = t.stats.trap;
  if (!trap || sim.state !== 'wave' || t.trapCount >= trap.max) return false;
  const spots = trapSpots(sim, t);
  const free = [];
  for (const s of spots) {
    let ok = true;
    for (const tr of sim.traps) {
      if ((tr.x - s.x) ** 2 + (tr.y - s.y) ** 2 < 0.45 * 0.45) {
        ok = false;
        break;
      }
    }
    if (ok) free.push(s);
    if (free.length >= 4) break;
  }
  if (!free.length) return false;
  const s = free[Math.floor(sim.rng.next() * free.length)];
  const jx = (sim.rng.next() - 0.5) * 0.3;
  const jy = (sim.rng.next() - 0.5) * 0.3;
  const tr = { uid: sim._nextUid(), x: s.x + jx, y: s.y + jy, ownerUid: t.uid, armed: false, armLeft: trap.armTime, owner: t };
  sim.traps.push(tr);
  t.trapCount++;
  t.facing = Math.atan2(tr.x - t.x, tr.y - t.y);
  sim._emit('trapPlaced', { uid: tr.uid, x: tr.x, y: tr.y, ownerUid: t.uid });
  sim._emit('attack', { towerUid: t.uid, targetUid: null, kind: 'trap' });
  return true;
}

function spawnTurret(sim, t) {
  const n = t.turrets.length;
  const ang = n * 2.39996 + 0.6;
  const tu = { uid: sim._nextUid(), x: t.x + Math.sin(ang) * TURRET_RING, y: t.y + Math.cos(ang) * TURRET_RING, facing: ang, cooldown: 0.3 };
  t.turrets.push(tu);
  sim._emit('attack', { towerUid: t.uid, targetUid: null, kind: 'build', turretUid: tu.uid });
  return true;
}

function attackTurret(sim, t) {
  const tur = t.stats.turret;
  if (tur && sim.state === 'wave' && t.turrets.length < tur.max) return spawnTurret(sim, t);
  if (t.eff.damage > 0) return attackProjectile(sim, t);
  return false;
}

// ---------------------------------------------------------------------------
// Mortar: aimed, delayed shells (ROSTER_SPEC §6.4)
// ---------------------------------------------------------------------------

/**
 * Fires a volley of shells. With an aim point she waits until an eligible enemy is near it
 * (no wasted shells); without one she leads her best target by MORTAR_DELAY seconds of travel.
 * Shells land MORTAR_DELAY later at centre + MORTAR_SCATTER[i] × splash.
 */
function attackMortar(sim, t) {
  const spec = t.eff;
  let cx;
  let cy;
  let targetUid = null;
  if (t.aim) {
    const near = gatherTargets(sim, t.aim.x, t.aim.y, spec.splash + MORTAR_AIM_SLACK, spec, sim._scratch);
    if (!near.length) return false;
    cx = t.aim.x;
    cy = t.aim.y;
    t.facing = Math.atan2(cx - t.x, cy - t.y);
  } else {
    const tgt = bestTarget(sim, t.ox, t.oy, spec.range, spec, t.targetMode);
    if (!tgt) return false;
    const path = sim.pathData[tgt.pathIndex];
    const p = pointAt(path, Math.min(path.length, tgt.dist + tgt.speed * MORTAR_DELAY), sim._leadPt || (sim._leadPt = {}), tgt.seg);
    cx = p.x;
    cy = p.y;
    face(t, tgt);
    targetUid = tgt.uid;
  }
  const snap = { ...spec }; // later upgrades / buffs do not change shells in flight
  const n = Math.max(1, spec.projectiles);
  const radius = spec.splash;
  for (let i = 0; i < n; i++) {
    const off = MORTAR_SCATTER[i % MORTAR_SCATTER.length];
    const sh = {
      uid: sim._nextUid(),
      x: cx + off[0] * radius,
      y: cy + off[1] * radius,
      radius,
      left: MORTAR_DELAY,
      delay: MORTAR_DELAY,
      ownerUid: t.uid,
      fromX: t.ox,
      fromY: t.oy,
      element: spec.element || null,
      attackType: spec.attackType,
      // internals
      owner: t,
      spec: snap,
      fresh: true, // skips the countdown of the step it was fired in: lands exactly MORTAR_DELAY later
      dead: false,
    };
    sim.shells.push(sh);
    sim._emit('mortarWarn', { uid: sh.uid, x: sh.x, y: sh.y, radius, delay: MORTAR_DELAY, towerUid: t.uid });
  }
  sim._emit('attack', { towerUid: t.uid, targetUid, kind: 'mortar' });
  return true;
}

/** Counts every pending shell down; landed shells explode (eligibility as usual: no flyers for ground-only). */
export function updateShells(sim, dt) {
  const list = sim.shells;
  if (!list.length) return;
  for (let i = 0; i < list.length; i++) {
    const sh = list[i];
    if (sh.dead) continue;
    if (sh.owner.removed) {
      sh.dead = true; // sold: the shell never lands
      continue;
    }
    if (sh.fresh) {
      sh.fresh = false;
      continue;
    }
    sh.left -= dt;
    if (sh.left > 1e-9) continue;
    sh.dead = true;
    explode(sim, sh.owner, sh.spec, sh.x, sh.y, sh.radius);
    sim._emit('shellLand', { uid: sh.uid, x: sh.x, y: sh.y, towerUid: sh.ownerUid });
  }
  let n = 0;
  for (let i = 0; i < list.length; i++) if (!list[i].dead) list[n++] = list[i];
  list.length = n;
}

// ---------------------------------------------------------------------------
// Aim points and relay origins (ROSTER_SPEC §6.3, §6.5)
// ---------------------------------------------------------------------------

/** What a tower's aim point is for: 'mortar' | 'mirror' | 'ult' (aimed hero ult) | null. */
export function aimMode(t) {
  if (!t) return null;
  if (t.eff?.behavior === 'mortar') return 'mortar';
  if (t.stats?.relay?.kind === 'mirror') return 'mirror';
  if (t.isHero && t.def?.hero?.ult?.effect?.center === 'aim') return 'ult';
  return null;
}

/**
 * Visible lane samples for relay origins: every RELAY_SAMPLE_STEP tiles of every path, tunnel
 * samples skipped, in path order then distance order (that order breaks ties).
 * @param {object[]} pathData
 * @returns {{ x: number, y: number, d: number, pathIndex: number }[]}
 */
export function relaySamples(pathData) {
  const out = [];
  for (const path of pathData || []) {
    for (const s of samplePath(path, RELAY_SAMPLE_STEP)) if (!s.hidden) out.push({ x: s.x, y: s.y, d: s.d, pathIndex: s.pathIndex });
  }
  return out;
}

/**
 * Where a familiar / mirror stands for a girl at (x, y). Pure (the placement ghost uses it too).
 * Mirror with an aim → the aim (already clamped). Otherwise the nearest visible lane sample:
 * within FAMILIAR_STANDOFF of it → the girl herself; else the point min(d − standoff, reach)
 * tiles from her toward it.
 * @param {object[]} samples from relaySamples()
 * @param {number} x @param {number} y girl position
 * @param {{ kind: string, reach: number }|null} relay
 * @param {{ x: number, y: number }|null} [aim]
 * @returns {{ x: number, y: number }|null} null for girls without a relay
 */
export function relayOrigin(samples, x, y, relay, aim = null) {
  if (!relay) return null;
  if (relay.kind === 'mirror' && aim) return { x: aim.x, y: aim.y };
  let best = null;
  let bestD2 = Infinity;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const dx = s.x - x;
    const dy = s.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = s;
    }
  }
  if (!best) return { x, y };
  const d = Math.sqrt(bestD2);
  if (d <= FAMILIAR_STANDOFF) return { x, y };
  const k = Math.max(0, Math.min(d - FAMILIAR_STANDOFF, relay.reach)) / d;
  return { x: x + (best.x - x) * k, y: y + (best.y - y) * k };
}

/** Recomputes a tower's relay origin (placement, upgrades, aim); emits 'relay' when it moved. */
export function updateRelayOrigin(sim, t) {
  const relay = t.stats?.relay || null;
  let o = null;
  if (relay) {
    if (!sim._relaySamples) sim._relaySamples = relaySamples(sim.pathData);
    o = relayOrigin(sim._relaySamples, t.x, t.y, relay, t.aim);
  }
  const ox = o ? o.x : t.x;
  const oy = o ? o.y : t.y;
  const moved = (o === null) !== (t.origin === null) || ox !== t.ox || oy !== t.oy;
  t.origin = o;
  t.ox = ox;
  t.oy = oy;
  if (moved && relay) sim._emit('relay', { towerUid: t.uid, x: ox, y: oy, kind: relay.kind });
  return moved;
}

const BEHAVIORS = {
  projectile: attackProjectile,
  pulse: attackPulse,
  duel: attackDuel,
  beam: attackBeam,
  chain: attackChain,
  trap: placeTrap,
  turret: attackTurret,
  mortar: attackMortar,
};

function updateTurrets(sim, t, dt) {
  const spec = t.turretSpec;
  if (!spec || !t.turrets.length) return;
  for (const tu of t.turrets) {
    if (tu.cooldown > 0) tu.cooldown -= dt;
    if (tu.cooldown > 0) continue;
    const tgt = bestTarget(sim, tu.x, tu.y, spec.range, spec, t.targetMode);
    if (!tgt) {
      tu.cooldown = 0;
      continue;
    }
    tu.facing = Math.atan2(tgt.x - tu.x, tgt.y - tu.y);
    spawnProjectile(sim, t, spec, tgt, tu.x, tu.y, {
      kind: 'bullet', speed: TURRET_PROJECTILE_SPEED, pierce: 1, splash: 0, range: spec.range, turretUid: tu.uid,
    });
    tu.cooldown += 1 / Math.max(0.05, spec.rate);
    sim._emit('attack', { towerUid: t.uid, targetUid: tgt.uid, kind: 'bullet', turretUid: tu.uid });
  }
}

/**
 * Towers that own drones but attack with another behavior (e.g. after a tier-4
 * transformation) keep building drones on their own timer (1 / base rate seconds).
 */
function buildDrones(sim, t, dt) {
  const tur = t.stats.turret;
  if (!tur || t.eff.behavior === 'turret' || sim.state !== 'wave' || t.turrets.length >= tur.max) return;
  t.buildTimer -= dt;
  if (t.buildTimer > 0) return;
  spawnTurret(sim, t);
  t.buildTimer = 1 / Math.max(0.05, t.def.base?.rate || 0.25);
}

/** One fixed step of a tower: disable timer, turrets, cooldown and attacks. */
export function updateTower(sim, t, dt) {
  if (t.disabled > 0) {
    t.disabled = Math.max(0, t.disabled - dt);
    return;
  }
  buildDrones(sim, t, dt);
  updateTurrets(sim, t, dt);
  const fn = BEHAVIORS[t.eff.behavior];
  if (!fn) return;
  if (t.cooldown > 0) t.cooldown -= dt;
  let guard = 0;
  while (t.cooldown <= 0 && guard++ < 4) {
    if (!fn(sim, t)) {
      t.cooldown = 0;
      break;
    }
    t.cooldown += 1 / Math.max(0.05, t.eff.rate);
  }
}

// ---------------------------------------------------------------------------
// Projectiles and traps
// ---------------------------------------------------------------------------

function projectileStep(sim, p, dt) {
  const tgt = p.target;
  if (tgt) {
    // Stop homing on targets that died, were already hit, or turned intangible/hidden mid-flight.
    if (tgt.dead || p.hits.includes(tgt.uid) || !isEligible(tgt, p.spec)) p.target = null;
    else {
      p.tx = tgt.x;
      p.ty = tgt.y;
      p.targetAlt = tgt.alt || 0;
    }
  }
  const homing = !!p.target || (p.splash > 0 && p.hits.length === 0);
  if (homing) {
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 1e-5) {
      p.vx = (dx / d) * p.speed;
      p.vy = (dy / d) * p.speed;
    }
  }
  const ax = p.x;
  const ay = p.y;
  const stepLen = p.speed * dt;
  // A splash shell whose target vanished lands on the last known spot.
  if (!p.target && p.splash > 0) {
    const dl = Math.hypot(p.tx - ax, p.ty - ay);
    if (dl <= stepLen) {
      p.x = p.tx;
      p.y = p.ty;
      explode(sim, p.owner, p.spec, p.x, p.y, p.splash);
      p.dead = true;
      return;
    }
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.travel += stepLen;

  // Swept collision along the segment travelled this step (no tunnelling at any speed).
  const near = sim.grid.query((ax + p.x) / 2, (ay + p.y) / 2, stepLen / 2 + 0.9, sim._scratch2);
  let contacts = null;
  for (let i = 0; i < near.length; i++) {
    const e = near[i];
    if (p.hits.includes(e.uid)) continue;
    const hr = hitRadius(e);
    if (segDistSq(e.x, e.y, ax, ay, p.x, p.y) > hr * hr) continue;
    if (!isEligible(e, p.spec)) continue;
    (contacts || (contacts = [])).push(e);
  }
  sim._scratch2.length = 0;
  if (contacts) {
    if (contacts.length > 1) {
      contacts.sort((a, b) => projectOnSegment(a.x, a.y, ax, ay, p.x, p.y) - projectOnSegment(b.x, b.y, ax, ay, p.x, p.y));
    }
    for (const e of contacts) {
      if (e.dead) continue;
      if (p.splash > 0) {
        p.hits.push(e.uid);
        explode(sim, p.owner, p.spec, e.x, e.y, p.splash);
        p.dead = true;
        return;
      }
      p.hits.push(e.uid);
      sim._hit(e, p.owner, p.spec, 1);
      p.pierce--;
      if (p.pierce <= 0) {
        p.dead = true;
        return;
      }
    }
  }
  if (p.travel >= p.maxTravel) {
    p.dead = true;
    return;
  }
  const f = Math.min(1, p.travel / Math.max(0.5, p.est));
  p.z = p.arc > 0 ? PROJECTILE_Z + p.arc * 4 * f * (1 - f) : PROJECTILE_Z + p.targetAlt * f;
}

/** Moves every projectile, resolves contacts, removes spent ones. */
export function updateProjectiles(sim, dt) {
  const list = sim.projectiles;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (p.owner.removed && !p.dead) p.dead = true;
    if (!p.dead) projectileStep(sim, p, dt);
  }
  let n = 0;
  for (let i = 0; i < list.length; i++) if (!list[i].dead) list[n++] = list[i];
  list.length = n;
}

/** Arms traps and triggers armed traps on the first eligible ground enemy in reach. */
export function updateTraps(sim, dt) {
  const list = sim.traps;
  let removedAny = false;
  for (let i = 0; i < list.length; i++) {
    const tr = list[i];
    if (!tr.armed) {
      tr.armLeft -= dt;
      if (tr.armLeft <= 0) tr.armed = true;
      continue;
    }
    const spec = tr.owner.trapSpec;
    if (!spec) continue;
    let trigger = null;
    sim.grid.each(tr.x, tr.y, spec.triggerRadius, (e) => {
      if (isEligible(e, spec)) {
        trigger = e;
        return true;
      }
      return false;
    });
    if (!trigger) continue;
    tr.dead = true;
    removedAny = true;
    tr.owner.trapCount = Math.max(0, tr.owner.trapCount - 1);
    sim._emit('trapTriggered', { uid: tr.uid, x: tr.x, y: tr.y, ownerUid: tr.ownerUid });
    explode(sim, tr.owner, spec, tr.x, tr.y, Math.max(spec.splash, spec.triggerRadius));
  }
  if (removedAny) {
    let n = 0;
    for (let i = 0; i < list.length; i++) if (!list[i].dead) list[n++] = list[i];
    list.length = n;
  }
}

/** Base cost of a unit before difficulty/profile multipliers. */
export function baseCost(def) {
  return normalizeBase(def.base, def).cost;
}

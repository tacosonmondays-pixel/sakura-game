// Tower runtime: creation, stat resolution + aura buffs, targeting, the eight attack
// behaviors, projectiles (travel, pierce, splash, swept collision), traps and turrets.
//
// Uses these Sim members: time, state, rng, grid, enemies, towers, projectiles, traps,
// pathData, globalRateMul, _scratch, _scratch2, _nextUid(), _emit(), _hit(e, tower, spec, scale)

import { ATTACK_TYPES, ELEMENTS } from '../data/types.js';
import {
  TIER_RANK, CHAIN_JUMP_RANGE, BEAM_HALF_WIDTH, LINE_HALF_WIDTH, TURRET_PROJECTILE_SPEED, TURRET_RING,
  PROJECTILE_Z, STEP, DRONE_SLOTS, DRONE_STANDOFF, DRONE_RETHINK_STEPS, DRONE_IDLE_STEPS, DRONE_OPP_STEPS,
  DRONE_POOL_STEPS, FLIGHT_MODES, FLIGHT_SIGNAL_MUL, FLIGHT_POINT_ROAM_MUL, FLIGHT_PATROL_SPEED_MUL, FLIGHT_PURSUIT_RATE_MUL,
} from './constants.js';
import { resolveStats, normalizeBase } from './mods.js';
import { isEligible } from './combat.js';
import { isCaster } from './enemies.js';
import { segDistSq, projectOnSegment, samplePath } from './path.js';
import { applyBuffExtras, applyLimited, emptyBuffBy } from './buffs.js';

const WEAPON_KIND = {
  bow: 'arrow', rifle: 'bullet', cannon: 'shell', shuriken: 'shuriken', flask: 'flask', wrench: 'bolt',
  staff: 'orb', tome: 'orb', lantern: 'spark', bell: 'spark', gohei: 'spark', fan: 'needle', parasol: 'needle',
  trident: 'orb', rapier: 'needle', katana: 'shuriken', sword: 'shuriken', coinPurse: 'bullet',
};
const TYPE_KIND = { blast: 'shell', pierce: 'arrow', slash: 'shuriken', mystic: 'orb', holy: 'spark' };
const ARC_KINDS = { shell: true, fireball: true, flask: true };

/** Visual projectile kind for a unit (from its weapon, element and attack type). */
export function projectileKind(def, stats) {
  let kind = WEAPON_KIND[def.look?.weapon] || TYPE_KIND[stats.attackType] || 'arrow';
  if (kind === 'shell' && stats.element === 'fire') kind = 'fireball';
  if (stats.element === 'lightning' && (kind === 'orb' || kind === 'bullet')) kind = 'bolt';
  return kind;
}

/** Enemy collision radius for projectiles/beams. */
export function hitRadius(e) {
  return 0.3 + 0.06 * (e.def.size ?? 1);
}

function emptyBuff() {
  return { dmgMul: 1, rateMul: 1, rangeMul: 1, detection: false, costCut: 0, cleanse: false, armorPen: 0, critChance: 0 };
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
    owner: o.owner ?? 0, // player index (co-op; set by the 'place' command); 0 solo
    // buffs (src/sim/buffs.js): aura winner uid per key, the girl her brew / link should pick first (-1 auto),
    // what her own limited buff is doing, the brew / link she holds, her DPS over the last DPS_WINDOW s
    buffBy: emptyBuffBy(),
    buffPick: -1,
    lim: null,
    limIn: null,
    recentDps: 0,
    _dmgMark: 0,
    tiers: [0, 0, 0],
    targetMode: def.role === 'sniper' ? 'elite' : 'first',
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
    // roaming drones: totals of every drone's hits (her own = damageDealt − droneDmg), the drone
    // numbering, and the wing's flight mode (null = Hover; setFlight / the co-op `fly` command)
    droneDmg: 0,
    droneKills: 0,
    droneShots: 0,
    droneSerial: 0,
    flight: null,
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
    // drone target pool (top candidates, reused for a few steps)
    _pool: null,
    _poolS: null,
    _poolLeft: 0,
    _poolMode: null,
    projKind: 'arrow',
    ultUnlocked: false,
    ultCooldown: 0,
    removed: false,
  };
  return t;
}

/** Re-resolves a tower's stats after an upgrade / hero level / placement. */
export function refreshTowerStats(t, globalRateMul = 1) {
  t.stats = resolveStats(t.def, { tiers: t.tiers, heroLevel: t.isHero ? t.level : 0, unitStats: t.unitStats, heroMastery: t.isHero ? t.mastery || 0 : 0 });
  t.projKind = projectileKind(t.def, t.stats);
  refreshEffective(t, globalRateMul);
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
    ...extra,
  };
}

/** Builds tower.eff (stats × buffs) plus the trap and turret hit specs. */
export function refreshEffective(t, globalRateMul = 1) {
  const s = t.stats;
  const b = t.buff;
  const detection = s.detection || b.detection;
  t.eff = {
    ...s,
    damage: s.damage * b.dmgMul,
    rate: s.rate * b.rateMul * globalRateMul,
    range: s.range * b.rangeMul,
    detection,
    critChance: s.crit.chance,
    critMul: s.crit.mul,
  };
  const trapStatus = s.trap ? mergeLists(s.trap.status, s.status) : null;
  t.trapSpec = s.trap ? hitSpecFrom(s, {
    damage: s.trap.damage * b.dmgMul,
    // spirit-revealing seals can trigger on veiled enemies
    detection: detection || s.reveal > 0 || trapStatus.some((x) => x.type === 'reveal'),
    canHitAir: false,
    critChance: 0,
    knockback: 0,
    status: trapStatus,
    triggerRadius: s.trap.triggerRadius,
    splash: s.trap.splash,
    armTime: s.trap.armTime,
  }) : null;
  t.turretSpec = s.turret ? hitSpecFrom(s, {
    damage: s.turret.damage * b.dmgMul,
    rate: s.turret.rate * b.rateMul * globalRateMul,
    range: s.turret.range * b.rangeMul,
    // roaming drones: roam radius, flight speed and seconds per drone, after buffs (build speed
    // follows attack-speed buffs, as it did when it rode on her attack rate)
    leash: s.turret.leash > 0 ? Math.max(1, s.turret.leash) * b.rangeMul : 0,
    speed: s.turret.speed,
    build: s.turret.build > 0 ? s.turret.build / Math.max(0.05, b.rateMul * globalRateMul) : 0,
    attackType: s.turret.attackType || s.attackType,
    detection,
    canHitAir: true,
    knockback: 0,
    status: mergeLists(s.turret.status, s.status),
    pierce: 1,
    splash: 0,
  }) : null;
  applyBuffExtras(t, b);
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
    // who won each key (the buff icons): a strictly stronger aura replaces the winner, so ties go to the
    // girl placed first
    const by = t.buffBy || (t.buffBy = emptyBuffBy());
    by.dmg = by.rate = by.range = by.pen = by.crit = by.det = by.cost = by.cleanse = -1;
    for (const a of towers) {
      if (a === t || !a.stats?.aura || a.disabled > 0) continue;
      const au = a.stats.aura;
      const dx = a.x - t.x;
      const dy = a.y - t.y;
      if (dx * dx + dy * dy > au.range * au.range) continue;
      if (au.dmgMul > nb.dmgMul) { nb.dmgMul = au.dmgMul; by.dmg = a.uid; }
      if (au.rateMul > nb.rateMul) { nb.rateMul = au.rateMul; by.rate = a.uid; }
      if (au.rangeMul > nb.rangeMul) { nb.rangeMul = au.rangeMul; by.range = a.uid; }
      if (au.detection && !nb.detection) { nb.detection = true; by.det = a.uid; }
      if (au.costCut > nb.costCut) { nb.costCut = au.costCut; by.cost = a.uid; }
      if (au.cleanse && !nb.cleanse) { nb.cleanse = true; by.cleanse = a.uid; }
      if (au.armorPen > nb.armorPen) { nb.armorPen = au.armorPen; by.pen = a.uid; }
      if (au.critChance > nb.critChance) { nb.critChance = au.critChance; by.crit = a.uid; }
    }
    // limited buffs (Midori's brew, Chika's link) multiply on top of the auras
    applyLimited(sim, t, nb);
    if (nb.cleanse && t.disabled > 0) t.disabled = 0;
    const ob = t.buff;
    const differs = ob.dmgMul !== nb.dmgMul || ob.rateMul !== nb.rateMul || ob.rangeMul !== nb.rangeMul
      || ob.detection !== nb.detection || ob.costCut !== nb.costCut || ob.cleanse !== nb.cleanse
      || ob.armorPen !== nb.armorPen || ob.critChance !== nb.critChance;
    if (differs || t._globalRate !== sim.globalRateMul) {
      t.buff = nb;
      t._globalRate = sim.globalRateMul;
      refreshEffective(t, sim.globalRateMul);
      changed = true;
    }
    t.buffed = nb.dmgMul > 1 || nb.rateMul > 1 || nb.rangeMul > 1 || nb.detection || nb.costCut > 0 || nb.cleanse
      || nb.armorPen > 0 || nb.critChance > 0 || sim.globalRateMul > 1 || (t.limIn != null && (t.limIn.brew >= 0 || t.limIn.link >= 0));
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
      return (TIER_RANK[e.tier] || 0) * 1e8 + Math.min(e.maxHp, 9.99e6) * 10 - e.remaining * 1e-3;
    case 'close': {
      const dx = e.x - x;
      const dy = e.y - y;
      return -(dx * dx + dy * dy);
    }
    case 'elite':
      return priorityClass(e) * 1e6 - e.remaining;
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

/**
 * The best `k` eligible enemies within `reach` of (x, y) (Infinity = the whole map), best first,
 * written into `out` with their scores in `outS`: exactly what a stable sort + truncate of
 * gatherTargets gives (selectTargets), in O(N·k) and without allocating.
 */
export function topTargets(sim, x, y, reach, spec, mode, k, out, outS) {
  out.length = 0;
  outS.length = 0;
  const c = gatherTargets(sim, x, y, reach, spec, sim._scratch);
  for (let i = 0; i < c.length; i++) {
    const e = c[i];
    const sc = targetScore(mode, x, y, e);
    let j = out.length;
    if (j < k) {
      out.push(e);
      outS.push(sc);
    } else if (sc > outS[k - 1]) j = k - 1;
    else continue;
    // shift down past every entry scoring < sc (stable: an earlier candidate wins a tie)
    while (j > 0 && outS[j - 1] < sc) {
      out[j] = out[j - 1];
      outS[j] = outS[j - 1];
      j--;
    }
    out[j] = e;
    outS[j] = sc;
  }
  c.length = 0;
  return out;
}

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
    drone: opts.drone ?? null, // the roaming drone that fired it (per-drone credit)
    guided: !!opts.guided, // hits only its own target; fizzles when that target is gone
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
  const dx = target.x - t.x;
  const dy = target.y - t.y;
  const d = Math.hypot(dx, dy) || 1e-6;
  const ex = t.x + (dx / d) * length;
  const ey = t.y + (dy / d) * length;
  const near = sim.grid.query((t.x + ex) / 2, (t.y + ey) / 2, length / 2 + 1, []);
  const hits = [];
  for (const e of near) {
    if (!isEligible(e, spec)) continue;
    const hr = halfWidth + hitRadius(e);
    if (segDistSq(e.x, e.y, t.x, t.y, ex, ey) <= hr * hr) hits.push(e);
  }
  hits.sort((a, b) => projectOnSegment(a.x, a.y, t.x, t.y, ex, ey) - projectOnSegment(b.x, b.y, t.x, t.y, ex, ey));
  if (!hits.includes(target)) hits.unshift(target);
  if (hits.length > pierce) hits.length = pierce;
  return { hits, ex, ey };
}

function attackProjectile(sim, t) {
  const spec = t.eff;
  const n = spec.projectiles;
  const targets = selectTargets(sim, t.x, t.y, spec.range, spec, t.targetMode, n);
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
      spawnProjectile(sim, t, spec, tgt, t.x, t.y, { spread });
    }
  }
  sim._emit('attack', { towerUid: t.uid, targetUid: targets[0].uid, kind: t.projKind });
  return true;
}

function attackPulse(sim, t) {
  const spec = t.eff;
  const c = gatherTargets(sim, t.x, t.y, spec.range, spec, sim._scratch);
  if (!c.length) return false;
  let victims = c.slice();
  if (victims.length > spec.maxTargets) {
    victims.sort((a, b) => targetScore(t.targetMode, t.x, t.y, b) - targetScore(t.targetMode, t.x, t.y, a));
    victims.length = spec.maxTargets;
  }
  face(t, victims[0]);
  for (const e of victims) if (!e.dead) sim._hit(e, t, spec, 1);
  sim._emit('pulse', { x: t.x, y: t.y, radius: spec.range, element: spec.element || null, attackType: spec.attackType, towerUid: t.uid });
  sim._emit('attack', { towerUid: t.uid, targetUid: victims[0].uid, kind: 'pulse' });
  return true;
}

function attackDuel(sim, t) {
  const spec = t.eff;
  let tgt = t.rampTarget;
  if (!tgt || tgt.dead || !isEligible(tgt, spec) || Math.hypot(tgt.x - t.x, tgt.y - t.y) > spec.range) {
    tgt = bestTarget(sim, t.x, t.y, spec.range, spec, t.targetMode);
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
  const targets = selectTargets(sim, t.x, t.y, spec.range, spec, t.targetMode, spec.projectiles);
  if (!targets.length) return false;
  face(t, targets[0]);
  const color = attackColor(spec);
  const width = 0.12 + 0.04 * Math.min(6, spec.pierce);
  for (const tgt of targets) {
    if (tgt.dead) continue;
    const { hits, ex, ey } = linePierce(sim, t, spec, tgt, spec.range, BEAM_HALF_WIDTH, spec.pierce);
    for (const e of hits) if (!e.dead) sim._hit(e, t, spec, 1);
    sim._emit('beam', { from: [t.x, t.y], to: [ex, ey], width, color, towerUid: t.uid });
  }
  sim._emit('attack', { towerUid: t.uid, targetUid: targets[0].uid, kind: 'beam' });
  return true;
}

function attackChain(sim, t) {
  const spec = t.eff;
  const targets = selectTargets(sim, t.x, t.y, spec.range, spec, t.targetMode, spec.projectiles);
  if (!targets.length) return false;
  face(t, targets[0]);
  const jump = CHAIN_JUMP_RANGE + spec.splash;
  for (const start of targets) {
    if (start.dead) continue;
    const points = [[t.x, t.y]];
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

// ---------------------------------------------------------------------------
// Drones. Anchored turrets (turret.leash 0: the test engineer) sit on a ring around their girl
// and shoot from there. Roaming drones (leash > 0: Chika) fly in the sim: each one hunts its own
// quarry inside the wing's roam area, follows it and shoots it with guided bullets. Where the
// wing roams is the girl's flight mode (setFlight, the co-op `fly` command):
//   hover   (default) within `leash` of her
//   hold    within leash × FLIGHT_POINT_ROAM_MUL of a point inside her signal range
//   patrol  the same, around a position travelling between two points
//   pursuit anywhere on the map, chasing her target mode's best enemies
// No rng, no per-drone timers (schedules come from the step number), only + − × ÷ and sqrt in
// the flight maths, so every JS engine flies them the same (atan2 only sets the facing).
// docs/specs/CHIKA_REWORK.md §3 and §16 (flight modes).
// ---------------------------------------------------------------------------

/** One factory for roaming drones: building, battle-save restore and tests use it. */
export function makeDrone(t, uid, n, slot, born = 0) {
  const s = DRONE_SLOTS[slot % DRONE_SLOTS.length];
  const ring = TURRET_RING * (1 + 0.5 * Math.floor(slot / DRONE_SLOTS.length));
  const hx = s[0] * ring;
  const hy = s[1] * ring;
  const x = t.x + hx;
  const y = t.y + hy;
  return {
    uid, n, slot, x, y, px: x, py: y, hx, hy, facing: 0, cooldown: 0.3,
    jam: 0, // seconds left jammed by a sapper
    tgt: null, targetUid: null, moving: false,
    dmg: 0, kills: 0, shots: 0, born, // per-drone stats (born = the wave it was built in)
  };
}

/**
 * A drone from a battle-save row [uid, x, y, facing, cooldown, n?, slot?, dmg?, kills?, shots?,
 * born?, jam?] (old 5-field rows: counters 0, numbered by position).
 */
export function restoreDrone(t, row, i) {
  const [uid, x, y, facing, cooldown, n, slot, dmg, kills, shots, born, jam] = row;
  const d = makeDrone(t, uid, n ?? i + 1, slot ?? i, born ?? 0);
  d.x = d.px = x;
  d.y = d.py = y;
  d.facing = facing ?? 0;
  d.cooldown = cooldown ?? 0;
  d.dmg = dmg ?? 0;
  d.kills = kills ?? 0;
  d.shots = shots ?? 0;
  d.jam = jam ?? 0;
  return d;
}

/** Does this girl fly roaming drones (Chika)? */
export function hasRoamingDrones(t) {
  return !!t.turretSpec && t.turretSpec.leash > 0;
}

function spawnTurret(sim, t) {
  const n = t.turrets.length;
  let tu;
  if (hasRoamingDrones(t)) {
    t.droneSerial++;
    tu = makeDrone(t, sim._nextUid(), t.droneSerial, n, sim.wave);
  } else {
    const ang = n * 2.39996 + 0.6;
    tu = { uid: sim._nextUid(), x: t.x + Math.sin(ang) * TURRET_RING, y: t.y + Math.cos(ang) * TURRET_RING, facing: ang, cooldown: 0.3 };
  }
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

const BEHAVIORS = {
  projectile: attackProjectile,
  pulse: attackPulse,
  duel: attackDuel,
  beam: attackBeam,
  chain: attackChain,
  trap: placeTrap,
  turret: attackTurret,
};

function updateTurrets(sim, t, dt) {
  const spec = t.turretSpec;
  if (!spec || !t.turrets.length) return;
  if (spec.leash > 0) {
    updateRoamingDrones(sim, t, spec, dt);
    return;
  }
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

// --- flight modes ----------------------------------------------------------

/** A girl's flight mode ('hover' when none was set). */
export function flightMode(t) {
  return t.flight ? t.flight.mode : 'hover';
}

/** How far from her Hold / Patrol points may be (her signal range, tiles). */
export function signalRange(t) {
  return hasRoamingDrones(t) ? t.turretSpec.leash * FLIGHT_SIGNAL_MUL : 0;
}

/** (x, y) pulled inside her signal range and the map, into out[0..1]. */
function clampPoint(sim, t, x, y, out) {
  const sig = signalRange(t);
  let dx = x - t.x;
  let dy = y - t.y;
  const d2 = dx * dx + dy * dy;
  if (d2 > sig * sig) {
    const k = sig / Math.sqrt(d2);
    dx *= k;
    dy *= k;
  }
  const w = sim.map.width || 20;
  const h = sim.map.height || 12;
  out[0] = Math.min(w, Math.max(0, t.x + dx));
  out[1] = Math.min(h, Math.max(0, t.y + dy));
  return out;
}

/**
 * Sets a girl's flight mode. Hold uses (ax, ay); Patrol flies between (ax, ay) and (bx, by);
 * points are pulled inside her signal range. Hover and Pursuit keep the points last set (so
 * switching back to Hold returns to the same spot). @returns {boolean}
 */
export function setFlight(sim, t, mode, ax, ay, bx, by) {
  if (!t || !hasRoamingDrones(t) || !FLIGHT_MODES.includes(mode)) return false;
  const pts = mode === 'hold' || mode === 'patrol';
  if (pts && !(Number.isFinite(ax) && Number.isFinite(ay))) return false;
  if (mode === 'patrol' && !(Number.isFinite(bx) && Number.isFinite(by))) return false;
  const fl = t.flight || (t.flight = { mode: 'hover', ax: t.x, ay: t.y, bx: t.x, by: t.y, cx: t.x, cy: t.y, leg: 1 });
  const p = [0, 0];
  if (pts) {
    clampPoint(sim, t, ax, ay, p);
    fl.ax = p[0];
    fl.ay = p[1];
    if (mode === 'patrol') {
      clampPoint(sim, t, bx, by, p);
      fl.bx = p[0];
      fl.by = p[1];
    } else {
      fl.bx = fl.ax;
      fl.by = fl.ay;
    }
    // the wing's centre jumps to the (first) point; the drones themselves fly there at their speed
    fl.cx = fl.ax;
    fl.cy = fl.ay;
    fl.leg = 1;
  }
  fl.mode = mode;
  t._poolLeft = 0;
  for (const d of t.turrets) {
    d.tgt = null;
    d.targetUid = null;
  }
  return true;
}

// Per step: where the wing is (centre), how far drones may roam from it (L) and how far they
// look for quarries (reach), for one girl. Reused scratch (the sim is single-threaded).
const FRAME = { cx: 0, cy: 0, L: 0, reach: 0, hx: 0, hy: 0 };
const PT = [0, 0];

function wingFrame(sim, t, spec, dt) {
  const f = FRAME;
  const fl = t.flight;
  const mode = fl ? fl.mode : 'hover';
  if (mode === 'hold' || mode === 'patrol') {
    if (mode === 'patrol') {
      // the patrol position travels A → B → A …, kept inside the (possibly shrunk) signal range
      const a = clampPoint(sim, t, fl.ax, fl.ay, PT);
      const ax = a[0];
      const ay = a[1];
      const b = clampPoint(sim, t, fl.bx, fl.by, PT);
      const tx = fl.leg ? b[0] : ax;
      const ty = fl.leg ? b[1] : ay;
      const dx = tx - fl.cx;
      const dy = ty - fl.cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      const stepLen = spec.speed * FLIGHT_PATROL_SPEED_MUL * dt;
      if (d <= stepLen) {
        fl.cx = tx;
        fl.cy = ty;
        fl.leg = fl.leg ? 0 : 1;
      } else {
        fl.cx += (dx / d) * stepLen;
        fl.cy += (dy / d) * stepLen;
      }
      f.cx = fl.cx;
      f.cy = fl.cy;
    } else {
      clampPoint(sim, t, fl.ax, fl.ay, PT);
      f.cx = PT[0];
      f.cy = PT[1];
    }
    f.L = spec.leash * FLIGHT_POINT_ROAM_MUL;
    f.reach = f.L + spec.range;
  } else if (mode === 'pursuit') {
    f.cx = t.x;
    f.cy = t.y;
    f.L = Infinity;
    f.reach = Infinity;
  } else {
    f.cx = t.x;
    f.cy = t.y;
    f.L = spec.leash;
    f.reach = f.L + spec.range;
  }
  return f;
}

function validQuarry(e, spec, f) {
  if (e.dead || !isEligible(e, spec)) return false;
  if (f.reach === Infinity) return true;
  const dx = e.x - f.cx;
  const dy = e.y - f.cy;
  return dx * dx + dy * dy <= f.reach * f.reach;
}

/** The girl's target pool for this step: computed at most once per step, reused up to DRONE_POOL_STEPS. */
function dronePool(sim, t, spec, f, st) {
  if (st.fresh) return t._pool;
  const pool = t._pool;
  if (t._poolLeft > 0 && t._poolMode === t.targetMode) {
    for (let i = 0; i < pool.length; i++) if (validQuarry(pool[i], spec, f)) return pool;
  }
  topTargets(sim, f.cx, f.cy, f.reach, spec, t.targetMode, t.turrets.length + 2, pool, t._poolS);
  t._poolLeft = DRONE_POOL_STEPS;
  t._poolMode = t.targetMode;
  st.fresh = true;
  return pool;
}

const POOL_STATE = { fresh: false };

function pickQuarry(sim, t, d, spec, f, focus) {
  const pool = dronePool(sim, t, spec, f, POOL_STATE);
  if (focus) {
    // the wing focuses: everyone on the pool's best valid enemy
    for (let i = 0; i < pool.length; i++) if (validQuarry(pool[i], spec, f)) return pool[i];
    return null;
  }
  // the wing spreads: keep a quarry still among the first max(2, n) valid entries, else take the
  // valid entry with the fewest siblings on it (ties: nearest to this drone for First / Close,
  // better rank otherwise)
  const keepN = Math.max(2, t.turrets.length);
  let seen = 0;
  for (let i = 0; i < pool.length && seen < keepN; i++) {
    if (!validQuarry(pool[i], spec, f)) continue;
    if (pool[i] === d.tgt) return d.tgt;
    seen++;
  }
  const near = t.targetMode === 'first' || t.targetMode === 'close';
  let best = null;
  let bestN = Infinity;
  let bestD = Infinity;
  for (let i = 0; i < pool.length; i++) {
    const e = pool[i];
    if (!validQuarry(e, spec, f)) continue;
    let n = 0;
    for (const o of t.turrets) if (o !== d && o.tgt === e) n++;
    let dd = 0;
    if (near) {
      const dx = e.x - d.x;
      const dy = e.y - d.y;
      dd = dx * dx + dy * dy;
    }
    if (n < bestN || (n === bestN && near && dd < bestD)) {
      best = e;
      bestN = n;
      bestD = dd;
    }
  }
  return best;
}

/** Closest eligible enemy within the gun's range of a drone (a target of opportunity). */
function opportunity(sim, d, spec) {
  const c = gatherTargets(sim, d.x, d.y, spec.range, spec, sim._scratch);
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < c.length; i++) {
    const dx = c[i].x - d.x;
    const dy = c[i].y - d.y;
    const dd = dx * dx + dy * dy;
    if (dd < bestD) {
      bestD = dd;
      best = c[i];
    }
  }
  c.length = 0;
  return best;
}

function updateRoamingDrones(sim, t, spec, dt) {
  if (!t._pool) {
    t._pool = [];
    t._poolS = [];
  }
  if (t._poolLeft > 0) t._poolLeft--;
  POOL_STATE.fresh = false;
  const f = wingFrame(sim, t, spec, dt);
  const tick = Math.round(sim.time / STEP);
  const focus = t.targetMode === 'strong' || t.targetMode === 'elite';
  const R = spec.range;
  const L = f.L;
  const standoff = R * DRONE_STANDOFF;
  const moveLen = spec.speed * dt;
  const anyEnemy = sim.enemies.length > 0;
  const reload = 1 / Math.max(0.05, spec.rate * (f.L === Infinity ? FLIGHT_PURSUIT_RATE_MUL : 1));
  for (const d of t.turrets) {
    d.px = d.x;
    d.py = d.y;
    if (d.cooldown > 0) d.cooldown -= dt;
    if (d.jam > 0) {
      d.jam = Math.max(0, d.jam - dt);
      d.tgt = null;
      d.targetUid = null;
      d.moving = false;
      continue;
    }
    // 1. drop a quarry that died, turned ineligible or left the wing's reach
    let q = d.tgt;
    if (q && (!anyEnemy || !validQuarry(q, spec, f))) q = null;
    const lost = !q && !!d.tgt;
    // 2. look for a quarry on this drone's own schedule
    if (!lost && anyEnemy) {
      const look = q
        ? (tick + 7 * d.slot) % DRONE_RETHINK_STEPS === 0
        : (tick + d.slot) % DRONE_IDLE_STEPS === 0;
      if (look) q = pickQuarry(sim, t, d, spec, f, focus);
    }
    d.tgt = q;
    d.targetUid = q ? q.uid : null;
    // 3. where to be
    let gx;
    let gy;
    let ox = d.x - f.cx;
    let oy = d.y - f.cy;
    const od2 = ox * ox + oy * oy;
    if (od2 > L * L + 1e-9) {
      // outside the roam area (it moved or shrank): straight back to its edge first
      const k = L / Math.sqrt(od2);
      gx = f.cx + ox * k;
      gy = f.cy + oy * k;
    } else if (q) {
      const dx = d.x - q.x;
      const dy = d.y - q.y;
      const dq = Math.sqrt(dx * dx + dy * dy);
      if (dq > standoff) {
        gx = q.x + (dx / dq) * standoff;
        gy = q.y + (dy / dq) * standoff;
        ox = gx - f.cx;
        oy = gy - f.cy;
        const g2 = ox * ox + oy * oy;
        if (g2 > L * L) {
          const k = L / Math.sqrt(g2);
          gx = f.cx + ox * k;
          gy = f.cy + oy * k;
        }
      } else {
        gx = d.x;
        gy = d.y;
      }
    } else {
      gx = f.cx + d.hx;
      gy = f.cy + d.hy;
    }
    // 4. fly there (straight line, constant speed, exact arrival)
    const mx = gx - d.x;
    const my = gy - d.y;
    const md = Math.sqrt(mx * mx + my * my);
    if (md <= moveLen) {
      d.x = gx;
      d.y = gy;
    } else {
      d.x += (mx / md) * moveLen;
      d.y += (my / md) * moveLen;
    }
    d.moving = md > 1e-9;
    // 5. fire: at the quarry in gun range, else now and then at the closest enemy on the way
    // (never while the wing flies to a focus target)
    if (d.cooldown > 0) continue;
    let shot = null;
    if (q) {
      const dx = q.x - d.x;
      const dy = q.y - d.y;
      if (dx * dx + dy * dy <= R * R) shot = q;
    }
    if (!shot && !(focus && q) && anyEnemy && (tick + d.slot) % DRONE_OPP_STEPS === 0) shot = opportunity(sim, d, spec);
    if (!shot) {
      d.cooldown = 0;
      continue;
    }
    d.facing = Math.atan2(shot.x - d.x, shot.y - d.y);
    spawnProjectile(sim, t, spec, shot, d.x, d.y, {
      kind: 'bullet', speed: TURRET_PROJECTILE_SPEED, pierce: 1, splash: 0, range: R + 1, turretUid: d.uid, drone: d, guided: true,
    });
    d.shots++;
    t.droneShots++;
    d.cooldown += reload;
    sim._emit('attack', { towerUid: t.uid, targetUid: shot.uid, kind: 'bullet', turretUid: d.uid });
  }
}

/**
 * Girls with drones whose attack is another behavior (Chika's bolt, her Tesla coil) build them on
 * their own timer: turret.build seconds (after buffs), else 1 / base rate. Only during waves.
 */
function buildDrones(sim, t, dt) {
  const tur = t.stats.turret;
  if (!tur || t.eff.behavior === 'turret' || sim.state !== 'wave' || t.turrets.length >= tur.max) return;
  t.buildTimer -= dt;
  if (t.buildTimer > 0) return;
  spawnTurret(sim, t);
  t.buildTimer = t.turretSpec.build > 0 ? t.turretSpec.build : 1 / Math.max(0.05, t.def.base?.rate || 0.25);
}

/** One fixed step of a tower: disable timer, turrets, cooldown and attacks. */
export function updateTower(sim, t, dt) {
  if (t.disabled > 0) {
    t.disabled = Math.max(0, t.disabled - dt);
    return;
  }
  if (t.moveLock > 0) return; // a hero repositioning mid-wave (hero.js moveHero)
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

/** A guided drone bullet: flies at its own target, can hit only it, fizzles once it is gone. */
function guidedStep(sim, p, dt) {
  const tgt = p.target;
  if (!tgt || tgt.dead || !isEligible(tgt, p.spec)) {
    p.dead = true;
    sim._emit('fizzle', { uid: p.uid, x: p.x, y: p.y, turretUid: p.turretUid });
    return;
  }
  const ax = p.x;
  const ay = p.y;
  const dx = tgt.x - ax;
  const dy = tgt.y - ay;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 1e-5) {
    p.vx = (dx / d) * p.speed;
    p.vy = (dy / d) * p.speed;
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.travel += p.speed * dt;
  p.targetAlt = tgt.alt || 0;
  const hr = hitRadius(tgt);
  if (segDistSq(tgt.x, tgt.y, ax, ay, p.x, p.y) <= hr * hr) {
    p.dead = true;
    p.hits.push(tgt.uid);
    sim._hit(tgt, p.owner, p.spec, 1, p.drone);
    return;
  }
  if (p.travel >= p.maxTravel) {
    p.dead = true;
    return;
  }
  const f = Math.min(1, p.travel / Math.max(0.5, p.est));
  p.z = PROJECTILE_Z + p.targetAlt * f;
}

function projectileStep(sim, p, dt) {
  if (p.guided) {
    guidedStep(sim, p, dt);
    return;
  }
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

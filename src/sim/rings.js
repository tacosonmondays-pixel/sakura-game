// The 360° ring shooter (Kinu, Pin-Burst Seamstress; docs/specs/UNIT_GAPS.md §5.4, primitive P-7):
// while an enemy is in her range she fires a ring of straight pins outward (no homing), one per
// direction of a fixed table. Her paths turn the ring (Twin Spools), turn the pins into an expanding
// heat ring (Iron Ring), add more pins, and set orbiting scissors around her; her ⚡ Blade Spiral (a
// boost, src/sim/abilities.js) adds a turning spiral of blades on top.
//
// Determinism:
//   - directions come from the shared 240-step table of unit vectors (src/sim/dirs.js), built once at
//     load with the deterministic sin / cos, so every engine flies the same pins; 240 holds
//     the 8, 10, 16 and 24-pin rings, the 16-step turn and the 16-step spiral exactly;
//   - the scissors' orbit and the spiral are read from the step number (no state to save);
//   - the heat ring grows by speed × dt and hits each enemy between the last and the new radius
//     once (squared distances); no rng anywhere.
// Caps (UNIT_GAPS §7.2): straight shots per girl (KINU_SHOTS), per player and per sim, the oldest
// shot (lowest uid) removed first. Everything here ends at the wave clear (§7.3).

import { dir } from './dirs.js';
import { isEligible } from './combat.js';
import {
  STEP, PROJECTILE_Z, RING_DIRS, RING_PIN_SPEED, HEAT_RING_SPEED, SCISSOR_RADIUS, SCISSOR_REACH, SCISSOR_STEPS,
  SCISSOR_EVERY, SPIRAL_EVERY, STRAIGHT_PER_GIRL, STRAIGHT_PER_PLAYER, STRAIGHT_PER_SIM, SPARKS_PER_STEP,
} from './constants.js';

/** Direction k of the table (wrapped): the shared table of src/sim/dirs.js. @returns {[number, number]} */
export const ringDir = dir;

const stepNo = (sim) => Math.round(sim.time / STEP);

/**
 * Makes room for `n` more straight shots of girl `t`: her own cap, her player's and the sim's, the
 * oldest shot first (the projectile list is in uid order). Evicted shots are marked dead and leave
 * at the next compaction.
 */
export function straightRoom(sim, t, n) {
  const owner = t.owner ?? 0;
  let mine = 0;
  let player = 0;
  let all = 0;
  const list = sim.projectiles;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    // attack shapes S5 (rule 5): live caps never count a shape shot (src/sim/s5shapes.js shapeRoom)
    if (!p.straight || p.dead || p.shape) continue;
    all++;
    if ((p.owner.owner ?? 0) === owner) player++;
    if (p.owner === t) mine++;
  }
  let over = Math.max(mine + n - STRAIGHT_PER_GIRL, player + n - STRAIGHT_PER_PLAYER, all + n - STRAIGHT_PER_SIM, 0);
  // oldest first: hers while she is over her cap, then her player's, then anyone's
  for (let pass = 0; pass < 3 && over > 0; pass++) {
    for (let i = 0; i < list.length && over > 0; i++) {
      const p = list[i];
      if (!p.straight || p.dead || p.shape) continue;
      if (pass === 0 && p.owner !== t) continue;
      if (pass === 1 && (p.owner.owner ?? 0) !== owner) continue;
      p.dead = true;
      over--;
    }
  }
}

/**
 * Room for `n` more shape shots of girl `t` (attack shapes S5, rule 5): live and shape straight shots count against the
 * per-player and per-sim caps, hers against `perGirl`, but only shape shots are evicted (hers, then her player's, then
 * anyone's, oldest first). A live shot is never evicted. @returns {number} how many of the `n` fit (the caller skips the rest)
 */
export function shapeRoom(sim, t, n, perGirl) {
  const owner = t.owner ?? 0;
  let mine = 0;
  let player = 0;
  let all = 0;
  const list = sim.projectiles;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (!p.straight || p.dead) continue;
    all++;
    if ((p.owner.owner ?? 0) === owner) player++;
    if (p.shape && p.owner === t) mine++;
  }
  // her own cap is met by her own shape shots only; her player's cap by hers, then her player's (passes 0–1); the sim's cap
  // by hers, then her player's, then anyone's (pass 2: another player's shot frees no room under her player's cap)
  let overMine = Math.max(mine + n - perGirl, 0);
  let overPlayer = Math.max(player + n - STRAIGHT_PER_PLAYER, 0);
  let overAll = Math.max(all + n - STRAIGHT_PER_SIM, 0);
  const wants = (pass) => overAll > 0 || (pass < 2 && overPlayer > 0) || (pass === 0 && overMine > 0);
  for (let pass = 0; pass < 3 && wants(pass); pass++) {
    for (let i = 0; i < list.length; i++) {
      if (!wants(pass)) break;
      const p = list[i];
      if (!p.straight || p.dead || !p.shape) continue;
      if (pass === 0 && p.owner !== t) continue;
      if (pass === 1 && (p.owner.owner ?? 0) !== owner) continue;
      p.dead = true;
      if (overAll > 0) overAll--;
      if (pass < 2 && overPlayer > 0) overPlayer--;
      if (pass === 0 && overMine > 0) overMine--;
    }
  }
  return Math.max(0, n - Math.max(overMine, overPlayer, overAll));
}

/**
 * A straight shot from (x, y) along direction k, `travel` tiles long: the same projectile record as a
 * targeted shot (src/sim/towers.js spawnProjectile) with no target, so projectileStep flies it
 * straight with swept collision and pierce until it has travelled `travel`. `scale` multiplies each of
 * its hits (sim._hit's scale; the attack shapes' per-shot damage, src/sim/wheels.js); a shot without
 * one hits at 1.
 */
export function spawnStraight(sim, t, spec, x, y, k, travel, { pierce = spec.pierce, kind = 'needle', speed = RING_PIN_SPEED, scale = 0 } = {}) {
  const [dx, dy] = ringDir(k);
  const p = {
    uid: sim._nextUid(),
    kind,
    x,
    y,
    z: PROJECTILE_Z,
    vx: dx * speed,
    vy: dy * speed,
    ownerUid: t.uid,
    element: spec.element || null,
    attackType: spec.attackType,
    turretUid: null,
    owner: t,
    drone: null,
    guided: false,
    spec,
    target: null,
    tx: x + dx * travel,
    ty: y + dy * travel,
    speed,
    pierce,
    splash: 0,
    hits: [],
    travel: 0,
    maxTravel: travel,
    est: travel,
    arc: 0,
    targetAlt: 0,
    dead: false,
    straight: true,
  };
  if (scale > 0) p.scale = scale;
  sim.projectiles.push(p);
  return p;
}

/** The 'ring' behaviour: a ring of pins (or a heat ring) while an eligible enemy is in her range. */
export function attackRing(sim, t) {
  const spec = t.eff;
  const r = t.stats.ring;
  if (!r) return false;
  let any = false;
  sim.grid.each(t.x, t.y, spec.range, (e) => (any = isEligible(e, spec)));
  if (!any) return false;
  if (r.heat) {
    // Iron Ring: the pins become an expanding heat ring (two with Molten Hem, the second a beat later)
    const rings = t.rings;
    for (let i = 0; i < (r.double ? 2 : 1); i++) rings.push({ x: t.x, y: t.y, r: -i * 0.6, max: spec.range, hit: [] });
  } else {
    const n = spec.projectiles;
    const turn = r.turn ? t.ringTurn * (RING_DIRS / 16) : 0;
    straightRoom(sim, t, n);
    for (let i = 0; i < n; i++) spawnStraight(sim, t, spec, t.x, t.y, Math.floor((i * RING_DIRS) / n) + turn, r.travel);
    if (r.turn) t.ringTurn = (t.ringTurn + 1) % 16;
  }
  sim._emit('attack', { towerUid: t.uid, targetUid: null, kind: r.heat ? 'heatRing' : 'ring' });
  return true;
}

/** Spark scratch per sim and step: Molten Hem's sparks are budgeted per step (SPARKS_PER_STEP). */
const SPARKS = new WeakMap();

function sparkBurst(sim, t, e) {
  const step = stepNo(sim);
  let b = SPARKS.get(sim);
  if (!b || b.step !== step) SPARKS.set(sim, (b = { step, n: 0 }));
  if (b.n >= SPARKS_PER_STEP) return;
  b.n++;
  straightRoom(sim, t, 4);
  for (let i = 0; i < 4; i++) spawnStraight(sim, t, t.eff, e.x, e.y, (i * RING_DIRS) / 4 + RING_DIRS / 8, 1.2, { kind: 'spark', pierce: 1 });
}

/** One step of her heat rings: each grows and hits every enemy it crosses once. */
function stepHeatRings(sim, t, dt) {
  const rings = t.rings;
  const spec = t.eff; // (Iron Ring grants her flyers: canHitAir on the tier)
  if (!rings?.length) return;
  const sparks = t.stats.ring.sparks;
  let n = 0;
  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    const prev = ring.r;
    ring.r = Math.min(ring.max, ring.r + HEAT_RING_SPEED * dt);
    if (ring.r > 0) {
      const lo = prev > 0 ? prev * prev : -1;
      const hi = ring.r * ring.r;
      const near = sim.grid.query(ring.x, ring.y, ring.r, []);
      for (const e of near) {
        if (e.dead || ring.hit.includes(e.uid) || !isEligible(e, spec)) continue;
        const dx = e.x - ring.x;
        const dy = e.y - ring.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= lo || d2 > hi) continue;
        ring.hit.push(e.uid);
        sim._hit(e, t, spec, 1);
        if (sparks && e.dead && e.statuses.burn) sparkBurst(sim, t, e);
      }
    }
    if (ring.r < ring.max) rings[n++] = ring;
  }
  rings.length = n;
}

/** Where scissors j of `pairs` is at step `step` (SCISSOR_REACH from her). */
export function scissorPos(t, j, pairs, step) {
  const [dx, dy] = ringDir(step * SCISSOR_STEPS + Math.floor((j * RING_DIRS) / pairs));
  return [t.x + dx * SCISSOR_REACH, t.y + dy * SCISSOR_REACH];
}

/** Orbit Scissors: each pair cuts the enemies it touches, each enemy at most once every SCISSOR_EVERY s. */
function stepScissors(sim, t) {
  const pairs = t.stats.ring.scissors;
  const spec = t.scissorSpec;
  if (!(pairs > 0) || !spec) return;
  const step = stepNo(sim);
  const gap = Math.round(SCISSOR_EVERY / STEP);
  for (let j = 0; j < pairs; j++) {
    const [x, y] = scissorPos(t, j, pairs, step);
    const near = sim.grid.query(x, y, SCISSOR_RADIUS, []);
    for (const e of near) {
      if (e.dead || !isEligible(e, spec) || (e.scissorAt ?? -Infinity) + gap > step) continue;
      e.scissorAt = step;
      sim._hit(e, t, spec, 1);
    }
  }
}

/** Blade Spiral (her ⚡ boost, ring.spiral spirals): two blades every SPIRAL_EVERY s along a turning spiral. */
function stepSpiral(sim, t) {
  const r = t.stats.ring;
  const step = stepNo(sim);
  const every = Math.round(SPIRAL_EVERY / STEP);
  if (!(r.spiral > 0) || step % every !== 0) return;
  const k = (Math.floor(step / every) * (RING_DIRS / 16)) % RING_DIRS;
  const dirs = r.spiral > 1 ? [k, k + RING_DIRS / 2, RING_DIRS - k, RING_DIRS / 2 - k] : [k, k + RING_DIRS / 2];
  straightRoom(sim, t, dirs.length);
  for (const d of dirs) spawnStraight(sim, t, t.eff, t.x, t.y, d, t.eff.range * 2, { kind: 'blade', pierce: r.spiralPierce });
}

/** Every step of a ring girl (src/sim/towers.js updateTower): heat rings, scissors, the spiral. */
export function ringTick(sim, t, dt) {
  if (t.rings?.length) stepHeatRings(sim, t, dt);
  if (sim.state !== 'wave') return;
  stepScissors(sim, t);
  stepSpiral(sim, t);
}

/** Wave clear: straight shots, heat rings (and an enemy's scissors mark with the enemies) end. */
export function endRingWave(sim) {
  let any = false;
  for (const p of sim.projectiles) {
    if (p.straight && !p.dead) {
      p.dead = true;
      any = true;
    }
  }
  if (any) {
    let n = 0;
    const list = sim.projectiles;
    for (let i = 0; i < list.length; i++) if (!list[i].dead) list[n++] = list[i];
    list.length = n;
  }
  for (const t of sim.towers) if (t.rings?.length) t.rings.length = 0;
}

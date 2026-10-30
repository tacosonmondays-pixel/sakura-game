// Attack shapes, batch S1 "Wheels" (docs/specs/ATTACK_SHAPES.md §5.1, §5.2, §5.5, §7.2):
//   - Blossom Wheel (behaviour 'wheel'): every attack, `wheel.spokes` straight shots leave her at once,
//     evenly round from her target; her toss's own coins (one per projectile, at her targets in turn) lead,
//     each hitting its target alone × wheel.lead, and the wheel's other spokes pierce × wheel.mul.
//   - Pinwheel Stream (behaviour 'spin'): every attack (her own rate) each of `spin.arms` arms fires one
//     straight shot along its direction and the arms turn spin.turn table steps, only spin.lock while an
//     arm has an enemy on its line (the stream lingers on crowds); with a single eligible enemy in range
//     the arms fold into one stream that follows it. An attack carries her volley's damage (damage ×
//     projectiles), split over the arms × spin.mul, or whole × spin.fold when folded. Never below her aimed
//     volley (owner: no nerfs): when her shuriken thrown at her targets would land more than the arms (a packed
//     crowd meets one arm, capped at her pierce), that attack is her aimed volley instead (spinVolleyBetter).
//   - Petal Halo (kit `halo`, beside her own attack): `halo.pieces` pieces orbit her at HALO_REACH; each
//     cuts the enemies it touches, each enemy at most once per piece every HALO_GAP steps (a re-hit list
//     per piece, §4.4), for damage × rate × halo.mul. The pieces only cut: t.haloSpec (src/sim/towers.js)
//     drops her statuses, marks, pushes and crits, which stay on her own attack. Her attack type's own
//     on-hit rules still apply (a holy cut ends phasing and silences field casters, like any holy hit).
//
// Determinism (§2.4): directions from the shared table (src/sim/dirs.js; aiming by nearestDir, no
// atan2); the orbit read from the step number; squared distances; integer step timers; no rng of our
// own (sim._hit still rolls crits); victims in the grid's own order. Per-girl state is t.spinK (an
// integer) and t.haloHits (per piece [uid, step] pairs, at most HALO_HITS), both dropped at the wave
// clear (endWheelWave), so calm-point saves and co-op checkpoints carry none.

import { isEligible } from './combat.js';
import { dir, wrapDir, nearestDir, turnToward, DIR_X, DIR_Y } from './dirs.js';
import { inDisc, onLine, hitRadius } from './shapes.js';
import { straightRoom, spawnStraight } from './rings.js';
import {
  STEP, RING_DIRS, WHEEL_SPEED, SPIN_HALF_WIDTH, SPIN_SPEED, SPIN_FOLD_TURN, SPIN_AIM_MARGIN,
  HALO_STEPS, HALO_REACH, HALO_RADIUS, HALO_GAP, HALO_HITS, HALO_MAX,
} from './constants.js';

const stepNo = (sim) => Math.round(sim.time / STEP);
const TAU = 2 * Math.PI;

/** Her facing from a table index (the renderer's facing angle; k × 2π / 240, no trig). */
function faceDir(t, k) {
  const a = (TAU * wrapDir(k)) / RING_DIRS;
  t.facing = a > Math.PI ? a - TAU : a;
}

/**
 * The 'wheel' behaviour (Blossom Wheel). `spec` is her attack spec for this attack (gear tricks applied),
 * `targets` her targets by target mode, best first, up to her projectiles (src/sim/towers.js picks them),
 * `extraPierce` her gear Pierce. Her toss's coins stay: one lead coin per projectile at her targets in turn
 * (a lone target takes them all), each for its target alone (pierce 1, × lead); the wheel adds spokes - 1
 * coins evenly round from the first lead's direction, carrying her pierce (× mul).
 */
export function attackWheel(sim, t, spec, targets, extraPierce = 0) {
  const w = t.stats.wheel;
  if (!w || !targets.length) return false;
  const n = Math.max(1, w.spokes);
  const leads = Math.max(1, spec.projectiles);
  const k0 = nearestDir(targets[0].x - t.ox, targets[0].y - t.oy);
  faceDir(t, k0);
  t.targetUid = targets[0].uid;
  const travel = spec.range;
  const pierce = spec.pierce + extraPierce;
  straightRoom(sim, t, leads + n - 1);
  for (let j = 0; j < leads; j++) {
    const e = targets[j % targets.length];
    const k = j === 0 ? k0 : nearestDir(e.x - t.ox, e.y - t.oy);
    spawnStraight(sim, t, spec, t.ox, t.oy, k, travel, { pierce, kind: t.projKind, speed: WHEEL_SPEED, scale: w.lead });
  }
  for (let i = 1; i < n; i++) {
    const k = k0 + Math.floor((i * RING_DIRS) / n);
    spawnStraight(sim, t, spec, t.ox, t.oy, k, travel, { pierce: 1, kind: t.projKind, speed: WHEEL_SPEED, scale: w.mul });
  }
  sim._emit('attack', { towerUid: t.uid, targetUid: targets[0].uid, kind: 'wheel', k: k0, spokes: n, leads });
  return true;
}

const SPIN_SCRATCH = [];

/**
 * The 'spin' behaviour (Pinwheel Stream), one attack at her own rate (so her attack speed, tempo,
 * rhythm echoes, gear tricks and drinks work as for any attack). `spec` is her attack spec for this
 * attack, `extraPierce()` her gear Pierce (asked only once she shoots: it advances a carry). One
 * attack's damage is her volley's: damage × projectiles
 * (× 1 + projScale, Potential's extra shuriken). With exactly one eligible enemy in range the arms fold
 * into one shot along a stream that turns toward it (turnToward to nearestDir, SPIN_FOLD_TURN a shot)
 * carrying the whole volley × spin.fold; otherwise each arm shoots along its direction carrying
 * volley × spin.mul / arms, and the arms turn spin.turn table steps, only spin.lock while an arm has an
 * enemy on its line.
 */
export function attackSpin(sim, t, spec, extraPierce = () => 0, aimed = null) {
  const sp = t.stats.spin;
  if (!sp) return false;
  const near = sim.grid.query(t.ox, t.oy, spec.range, SPIN_SCRATCH);
  let first = null;
  let count = 0;
  for (let j = 0; j < near.length && count < 2; j++) {
    const e = near[j];
    if (e.dead || !isEligible(e, spec)) continue;
    if (!first) first = e;
    count++;
  }
  if (!count) {
    SPIN_SCRATCH.length = 0;
    return false;
  }
  const arms = Math.max(1, sp.arms);
  const volley = Math.max(1, spec.projectiles) * (1 + (spec.projScale || 0));
  const pierce = spec.pierce + extraPierce();
  let k = t.spinK ?? 0;
  if (count === 1) {
    k = turnToward(k, nearestDir(first.x - t.ox, first.y - t.oy), SPIN_FOLD_TURN);
    straightRoom(sim, t, 1);
    spawnStraight(sim, t, spec, t.ox, t.oy, k, spec.range, { pierce, kind: t.projKind, speed: SPIN_SPEED, scale: volley * sp.fold });
  } else {
    // her aimed volley when it lands more than the arms would (the arms keep their turn: they did not shoot)
    if (aimed && spinVolleyBetter(sim, t, spec, near, k, arms, volley, sp.mul, aimed.targets)) {
      SPIN_SCRATCH.length = 0;
      return aimed.volley();
    }
    const scale = (volley * sp.mul) / arms;
    straightRoom(sim, t, arms);
    for (let a = 0; a < arms; a++) {
      spawnStraight(sim, t, spec, t.ox, t.oy, k + Math.floor((a * RING_DIRS) / arms), spec.range, { pierce, kind: t.projKind, speed: SPIN_SPEED, scale });
    }
    // the lock: an arm with an eligible enemy on its line turns spin.lock, otherwise spin.turn
    let locked = false;
    for (let a = 0; a < arms && !locked; a++) {
      const i = wrapDir(k + Math.floor((a * RING_DIRS) / arms));
      for (let j = 0; j < near.length; j++) {
        const e = near[j];
        if (e.dead || !isEligible(e, spec)) continue;
        if (onLine(e.x - t.ox, e.y - t.oy, DIR_X[i], DIR_Y[i], spec.range, SPIN_HALF_WIDTH, hitRadius(e))) {
          locked = true;
          break;
        }
      }
    }
    k = wrapDir(k + (locked ? sp.lock : sp.turn));
  }
  SPIN_SCRATCH.length = 0;
  t.spinK = k;
  faceDir(t, k);
  t.targetUid = first.uid;
  sim._emit('attack', { towerUid: t.uid, targetUid: count === 1 ? first.uid : null, kind: 'spin', k, arms: count === 1 ? 1 : arms });
  return true;
}

const AIM_SCRATCH = [];

/**
 * Would her aimed volley (her shuriken at her targets, each piercing along its line) land more damage than the
 * arms now? Counted, not simulated: per arm the eligible enemies on its line (at most her pierce) × the arm's share;
 * per shuriken (her volley, targets in turn) the eligible enemies on the line from her through its target out to
 * her reach + 1 (at most her pierce) × 1. Table directions and squared distances only (deterministic).
 */
export function spinVolleyBetter(sim, t, spec, near, k, arms, volley, mul, targetsOf) {
  const P = Math.max(1, spec.pierce);
  let armHits = 0;
  for (let a = 0; a < arms; a++) {
    const i = wrapDir(k + Math.floor((a * RING_DIRS) / arms));
    let c = 0;
    for (let j = 0; j < near.length && c < P; j++) {
      const e = near[j];
      if (e.dead || !isEligible(e, spec)) continue;
      if (onLine(e.x - t.ox, e.y - t.oy, DIR_X[i], DIR_Y[i], spec.range, SPIN_HALF_WIDTH, hitRadius(e))) c++;
    }
    armHits += c;
  }
  const armDmg = (armHits * volley * mul) / arms;
  const shots = Math.max(1, spec.projectiles);
  const targets = targetsOf(shots, AIM_SCRATCH);
  if (!targets.length) return false;
  let aimHits = 0;
  for (let s = 0; s < shots; s++) {
    const tg = targets[s % targets.length];
    const i = nearestDir(tg.x - t.ox, tg.y - t.oy);
    let c = 0;
    for (let j = 0; j < near.length && c < P; j++) {
      const e = near[j];
      if (e.dead || !isEligible(e, spec)) continue;
      if (e === tg || onLine(e.x - t.ox, e.y - t.oy, DIR_X[i], DIR_Y[i], spec.range + 1, SPIN_HALF_WIDTH, hitRadius(e))) c++;
    }
    aimHits += c;
  }
  AIM_SCRATCH.length = 0;
  // (her volley's extra shuriken, Potential's projScale, ride both the same way; the volley only when it is clearly
  // more, SPIN_AIM_MARGIN, so a near tie keeps the arms the round-5 rulers measured)
  return aimHits * (volley / shots) > armDmg * SPIN_AIM_MARGIN;
}

/** Where piece j of n is at step `step`: HALO_REACH × reach from her, read from the step number. */
export function haloPos(t, j, n, step, reach = HALO_REACH) {
  const [dx, dy] = dir(step * HALO_STEPS + Math.floor((j * RING_DIRS) / n));
  return [t.x + dx * reach, t.y + dy * reach];
}

const HALO_SCRATCH = [];

/** One step of Petal Halo: each piece cuts what it touches, per piece at most once every HALO_GAP steps. */
function stepHalo(sim, t, step) {
  const h = t.stats.halo;
  const n = Math.min(HALO_MAX, h.pieces);
  if (!(n > 0)) return;
  const spec = t.haloSpec || t.eff;
  const reach = HALO_REACH + h.reach;
  const scale = spec.rate * h.mul;
  let hits = t.haloHits;
  if (!hits || hits.length !== n) {
    const old = hits || [];
    hits = t.haloHits = [];
    for (let j = 0; j < n; j++) hits.push(old[j] || []);
  }
  for (let j = 0; j < n; j++) {
    const [x, y] = haloPos(t, j, n, step, reach);
    const near = sim.grid.query(x, y, HALO_RADIUS + 0.9, HALO_SCRATCH);
    const list = hits[j];
    for (let q = 0; q < near.length; q++) {
      const e = near[q];
      if (e.dead || !isEligible(e, spec) || !inDisc(x, y, HALO_RADIUS, e.x, e.y, hitRadius(e))) continue;
      let at = -1;
      for (let i = 0; i < list.length; i += 2) {
        if (list[i] === e.uid) {
          at = i;
          break;
        }
      }
      if (at >= 0 && step - list[at + 1] < HALO_GAP) continue;
      if (at >= 0) list.splice(at, 2);
      list.push(e.uid, step);
      if (list.length > 2 * HALO_HITS) list.splice(0, 2); // the oldest entry goes first
      sim._hit(e, t, spec, scale);
    }
    HALO_SCRATCH.length = 0;
  }
}

/**
 * Her paper DPS on one target with a wheel-batch shape, from `perTarget` (damage × rate × projectiles, as
 * the panel computes it for a volley; × (1 + projScale) for a spin): a wheel's toss coins (her projectiles
 * × lead, all on a lone target), a spin's folded stream (× fold), plus a halo's cuts on an enemy on its ring (each piece passes
 * it once a turn: pieces × HALO_STEPS × 60 / 240 cuts a second, × damage × rate × mul). Unchanged otherwise.
 */
export function shapeDps(t, e, perTarget) {
  let d = perTarget;
  if (e.behavior === 'wheel' && t.stats.wheel) d = e.damage * e.rate * Math.max(1, e.projectiles) * t.stats.wheel.lead;
  else if (e.behavior === 'spin' && t.stats.spin) d = perTarget * t.stats.spin.fold;
  const h = t.stats.halo;
  if (h?.pieces > 0) {
    const hs = t.haloSpec || e;
    d += (hs.damage * e.rate * h.mul * Math.min(HALO_MAX, h.pieces) * HALO_STEPS) / STEP / RING_DIRS;
  }
  return d;
}

/** Every step of a girl with a Petal Halo (src/sim/towers.js updateTower). */
export function wheelTick(sim, t) {
  if (sim.state !== 'wave') return;
  if (t.stats.halo) stepHalo(sim, t, stepNo(sim));
}

/** Wave clear: every girl's spin index and halo memory end (straight shots end in endRingWave). */
export function endWheelWave(sim) {
  for (const t of sim.towers) {
    // (deleted, not nulled: both are calm keys a battle save leaves out, so a restored run has them absent)
    if (t.spinK != null) delete t.spinK;
    if (t.haloHits) delete t.haloHits;
  }
}

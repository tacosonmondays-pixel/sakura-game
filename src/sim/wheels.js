// Attack shapes, batch S1 "Wheels" (docs/specs/ATTACK_SHAPES.md §5.1, §5.2, §5.5, §7.2):
//   - Blossom Wheel (behaviour 'wheel'): every attack, `wheel.spokes` straight shots leave her at once,
//     evenly round; the first spoke points at her target and hits it alone × wheel.lead, the rest pierce
//     × wheel.mul.
//   - Pinwheel Stream (behaviour 'spin'): every attack (her own rate) each of `spin.arms` arms fires one
//     straight shot along its direction and the arms turn spin.turn table steps, only spin.lock while an
//     arm has an enemy on its line (the stream lingers on crowds); with a single eligible enemy in range
//     the arms fold into one stream that follows it. An attack carries her volley's damage (damage ×
//     projectiles), split over the arms × spin.mul, or whole × spin.fold when folded.
//   - Petal Halo (kit `halo`, beside her own attack): `halo.pieces` pieces orbit her at HALO_REACH; each
//     cuts the enemies it touches, each enemy at most once per piece every HALO_GAP steps (a re-hit list
//     per piece, §4.4), for damage × rate × halo.mul. The pieces only cut: t.haloSpec (src/sim/towers.js)
//     drops her statuses, marks, pushes and crits, which stay on her own attack.
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
  STEP, RING_DIRS, WHEEL_SPEED, SPIN_HALF_WIDTH, SPIN_SPEED, SPIN_FOLD_TURN,
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
 * `target` her target by target mode (src/sim/towers.js picks it), `extraPierce` her gear Pierce.
 */
export function attackWheel(sim, t, spec, target, extraPierce = 0) {
  const w = t.stats.wheel;
  if (!w || !target) return false;
  const n = Math.max(1, w.spokes);
  const k0 = nearestDir(target.x - t.ox, target.y - t.oy);
  faceDir(t, k0);
  t.targetUid = target.uid;
  const travel = spec.range;
  const pierce = spec.pierce + extraPierce;
  straightRoom(sim, t, n);
  for (let i = 0; i < n; i++) {
    const k = k0 + Math.floor((i * RING_DIRS) / n);
    // the lead spoke is for her target alone (pierce 1, × lead); the wheel's other spokes carry her pierce
    spawnStraight(sim, t, spec, t.ox, t.oy, k, travel, { pierce: i === 0 ? 1 : pierce, kind: t.projKind, speed: WHEEL_SPEED, scale: i === 0 ? w.lead : w.mul });
  }
  sim._emit('attack', { towerUid: t.uid, targetUid: target.uid, kind: 'wheel', k: k0, spokes: n });
  return true;
}

/** Is any eligible enemy within `range` of (x, y)? */
function anyIn(sim, x, y, range, spec) {
  let any = false;
  sim.grid.each(x, y, range, (e) => {
    if (!any && isEligible(e, spec)) any = true;
  });
  return any;
}

const SPIN_SCRATCH = [];

/**
 * The 'spin' behaviour (Pinwheel Stream), one attack at her own rate (so her attack speed, tempo,
 * rhythm echoes, gear tricks and drinks work as for any attack). `spec` is her attack spec for this
 * attack, `extraPierce` her gear Pierce. One attack's damage is her volley's: damage × projectiles
 * (× 1 + projScale, Potential's extra shuriken). With exactly one eligible enemy in range the arms fold
 * into one shot along a stream that turns toward it (turnToward to nearestDir, SPIN_FOLD_TURN a shot)
 * carrying the whole volley × spin.fold; otherwise each arm shoots along its direction carrying
 * volley × spin.mul / arms, and the arms turn spin.turn table steps, only spin.lock while an arm has an
 * enemy on its line.
 */
export function attackSpin(sim, t, spec, extraPierce = 0) {
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
  const pierce = spec.pierce + extraPierce;
  let k = t.spinK ?? 0;
  if (count === 1) {
    k = turnToward(k, nearestDir(first.x - t.ox, first.y - t.oy), SPIN_FOLD_TURN);
    straightRoom(sim, t, 1);
    spawnStraight(sim, t, spec, t.ox, t.oy, k, spec.range, { pierce, kind: t.projKind, speed: SPIN_SPEED, scale: volley * sp.fold });
  } else {
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

/** Every step of a girl with a Petal Halo (src/sim/towers.js updateTower). */
export function wheelTick(sim, t) {
  if (sim.state !== 'wave') return;
  if (t.stats.halo) stepHalo(sim, t, stepNo(sim));
}

/** Wave clear: every girl's spin index and halo memory end (straight shots end in endRingWave). */
export function endWheelWave(sim) {
  for (const t of sim.towers) {
    if (t.spinK != null) t.spinK = null;
    if (t.haloHits) t.haloHits = null;
  }
}

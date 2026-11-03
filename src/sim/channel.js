// The held channel (docs/specs/ATTACK_SHAPES.md §4.3): the shared primitive of the held attack shapes (batch S2
// "Held": Hearth Stream, Searchlight Sweep; src/sim/held.js). Modelled on Kohaku's constant beam (src/sim/duo.js):
// a lock on one enemy, damage in integer ticks, a share of one hit per tick (combat.js computeHit `share`: flat
// armour, the 1-damage floor and the crystal shell's count × the share), a ramp by time on target, a grace after
// losing the enemy, and on-lock cadences. Kohaku's beam keeps its own code: her beams are several holds picked
// again from her targets every tick, with no turn and no grace, and her share rounds to whole flash intervals
// (duo.js beamTicks), so moving her here would change who she hits and when (docs/specs/ATTACK_SHAPES.md A7).
//
// A girl with a held attack keeps one small record, every field an integer (hashSim folds it; it ends at the
// wave clear, so calm-point saves and co-op checkpoints carry none):
//   t.ch = { uid, k, lock, tick, grace, src, trick, set, px, c, ph, pass, n, hits }
//     uid    the locked enemy's uid (-1 while in grace)
//     k      her aim, a table index (src/sim/dirs.js), turned toward her enemy a few steps a sim step
//     lock   sim steps she has held the same enemy (a new enemy starts it over at 0)
//     tick   sim steps to the next damage tick (0: this step)
//     grace  sim steps since she lost her enemy (0 while she has one; at CH_GRACE she lets go: t.ch = null)
//     src    1 while the last counted attack was a rhythm one (Potential: the channel carries t.effProc), else 0
//     trick  the gear trick of the last counted attack (0 none, 1 Finishing Thrust, 2 Big Beat)
//     set    her gear set's passives on the last counted attack (bits: 1 Right Angle, the channel carries its sure crit
//            until her next attack; 2 a Confetti Burst, on her ticks until one bursts)
//     px     the extra victims her gear Pierce gave the last counted attack (a stream's tick cap, a sweep's pass cap)
//     c, ph  a sweep's centre index and swing phase (0 for a stream)
//     pass, n  a sweep's pass count (one swing from end to end of its arc; odd: swinging back) and the enemies
//            struck on this pass
//     hits   a flat [uid, step, …] re-hit memory (a sweep's: [uid, pass, …]; at most CH_HITS pairs, oldest dropped first)
//
// Determinism (§2.4): integers, squared distances, + − × ÷ and compares only; no trig, no rng of its own.

import { isEligible } from './combat.js';
import { STEP, CH_GRACE, CH_HITS } from './constants.js';

/** Opens a channel on enemy `uid`, aimed at table index k. */
export function chOpen(t, uid, k) {
  t.ch = { uid, k, lock: 0, tick: 0, grace: 0, src: 0, trick: 0, set: 0, px: 0, c: k, ph: 0, pass: 0, n: 0, hits: [] };
  return t.ch;
}

/** The share of one hit a tick carries when it lands every `steps` sim steps at `rate` attacks a second (§4.3 DPS parity). */
export function chShare(rate, steps) {
  return (rate > 0 ? rate : 0) * steps * STEP;
}

/**
 * The ramp with time on target: 1 + min(per × rate × lock × STEP, max), so after any whole number of seconds the
 * channel has the ramp the discrete attack had after the same number of hits (ramp: { per, max } or null).
 */
export function chRamp(ramp, rate, lock) {
  return ramp ? 1 + Math.min(ramp.per * rate * lock * STEP, ramp.max) : 1;
}

/** An "on lock and every N steps" effect is due: on the lock's first step and every `every` steps it holds. */
export function chCadence(lock, every) {
  return lock === 0 || (every > 0 && lock % every === 0);
}

/** The live enemy with this uid, or null (a scan of sim.enemies: uids are unique). */
export function chEnemy(sim, uid) {
  if (uid < 0) return null;
  const L = sim.enemies;
  for (let i = 0; i < L.length; i++) if (L[i].uid === uid) return L[i].dead ? null : L[i];
  return null;
}

/** Can the channel keep enemy e: alive, eligible for `spec` and within its range of (x, y)? */
export function chKeeps(e, x, y, spec) {
  if (!e || e.dead || !isEligible(e, spec)) return false;
  const dx = e.x - x;
  const dy = e.y - y;
  return dx * dx + dy * dy <= spec.range * spec.range;
}

/**
 * One step of the lock. Keeps her enemy while chKeeps; otherwise `find()` gives a new one (a switch: lock 0) or
 * none (grace counts up, and at CH_GRACE the channel lets go: t.ch = null). `emit(e)` is called on a switch and
 * `emit(null)` on the release. @returns {object|null} the locked enemy this step
 */
export function chLock(t, e, keeps, find, emit) {
  const ch = t.ch;
  if (!keeps) {
    const n = find();
    if (n) {
      ch.uid = n.uid;
      ch.lock = 0;
      ch.grace = 0;
      emit(n);
      return n;
    }
    ch.uid = -1;
    ch.lock = 0;
    if (++ch.grace >= CH_GRACE) {
      t.ch = null;
      emit(null);
    }
    return null;
  }
  ch.grace = 0;
  return e;
}

/** The re-hit memory (§4.4): did the channel hit enemy `uid` less than `gap` before `step` (steps, or a sweep's passes)? */
export function chRecent(list, uid, step, gap) {
  for (let i = 0; i < list.length; i += 2) if (list[i] === uid) return step - list[i + 1] < gap;
  return false;
}

/** Remembers a hit on `uid` at `step` (its old entry replaced; the oldest pair dropped past CH_HITS). */
export function chRemember(list, uid, step) {
  for (let i = 0; i < list.length; i += 2) {
    if (list[i] === uid) {
      list.splice(i, 2);
      break;
    }
  }
  list.push(uid, step);
  if (list.length > 2 * CH_HITS) list.splice(0, 2);
}

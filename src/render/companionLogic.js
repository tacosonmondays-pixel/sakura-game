// Pure state rules of the companion actors (src/render/companions.js): no three.js, no DOM, no sim
// writes, so they are unit-tested in node (tests/render/companions.test.js). Positions are world units
// on the board: x = sim x, z = sim y, y = height.
//
//   Kon (Ruri):  home (sits by her) → travel (bounds along the ground: konGait, a dust puff per stride) → spot
//                (sits at her relay origin); Moon Pounce (pounceStep): crouch → arc leap → impact at the target → hop
//                back to where he stood
//   Kaze (Hana): a swoop (stoopStep) = climb, stoop down onto the target she shot, swing back up to her shoulder;
//                one in flight at a time, at most one more waiting (perch*: the latest target, a flyer kept over a
//                walker), a short rest on her shoulder between swoops;
//                Kaze's Swoop: a queue of quick dives, one per target within her reach (none on Reduce motion)
//   trails:      a fixed ring of recent positions per companion (trail*), drawn as fading ribbons
//   doll (Yoriko): a dash = the same out-and-back, short and low, stopping short of the target

/** Kon's running speed (tiles / s): slow enough that a 1.5-tile run reads (about a second on screen). */
export const KON_SPEED = 1.5;
/** One bound of his run (tiles): a hop, a dust puff where he lands. */
export const KON_STRIDE = 0.36;
/** How high a bound lifts him (tiles) and how far he pitches (radians, nose up on take-off). */
export const KON_HOP = 0.1;
export const KON_PITCH = 0.22;
/** A relay origin this close to Ruri means no relay spot: Kon sits by her. */
export const KON_SELF = 0.3;
/** Kaze's swoop: seconds out and back, arc height (tiles). */
export const SWOOP_TIME = 1.0;
export const SWOOP_LIFT = 0.45;
/** His swoop's shape (stoopStep): the climb ends at STOOP_UP (as a fraction of the flight), the strike lands at
 * STOOP_HIT; the climb's top sits STOOP_APEX of the way out, STOOP_RISE tiles over the higher end. */
export const STOOP_UP = 0.26;
export const STOOP_HIT = 0.5;
export const STOOP_APEX = 0.42;
export const STOOP_RISE = 0.6;
/** Seconds he rests on her shoulder between two swoops (a queued one waits for it). */
export const SWOOP_REST = 0.18;
/** The doll's dash: seconds out and back, how far it goes at most, how short of the target it stops. */
export const DASH_TIME = 0.67;
export const DASH_REACH = 1.3;
export const DASH_STOP = 0.35;
export const DASH_LIFT = 0.12;
/** Kaze's Swoop (Hana's ⚡): one quick dive per target, in strike order (seconds out and back), at most MAX_DIVES. */
export const DIVE_TIME = 0.6;
export const MAX_DIVES = 8;
/**
 * How far past her own range a dive may go (tiles): Kaze dives only as far as his plain swoops (her reach), never
 * across the map — a target beyond it takes abilityFx's feather strike from the sky. The dive's flight is capped there.
 */
export const DIVE_SLACK = 0.5;
/** Kon's Moon Pounce (Ruri's ⚡): seconds in all, how short of the target he lands, the leap's height. */
export const POUNCE_TIME = 1.2;
export const POUNCE_STOP = 0.22;
export const POUNCE_LIFT = 0.7;
/** Its beats, as fractions of POUNCE_TIME: the crouch ends, the leap lands (impact), the impact ends (hop back). */
export const POUNCE_CROUCH = 0.22;
export const POUNCE_LAND = 0.5;
export const POUNCE_REBOUND = 0.64;
/** Trails: how many recent positions a companion keeps, how long a point shows (s). */
export const TRAIL_N = 12;
export const TRAIL_LIFE = 0.32;

/**
 * The dives a Swoop queues: its targets within her reach (`inReach`), in strike order (the sim's `ability` event
 * lists them), at most MAX_DIVES. A Swoop is map-wide, but Kaze never crosses the map for it: the far targets take
 * abilityFx's feather strike from the sky. Reduce motion: none at all — he stays on her shoulder and calls the strike
 * (his attack clip), the strikes are still fades on the targets (the owner is motion-sensitive; Kon stays put for
 * Moon Pounce the same way).
 * @param {number[]} targets enemy uids
 * @param {{ reduceMotion?: boolean, inReach?: ((uid: number) => boolean)|null }} [o]
 */
export function swoopDives(targets, { reduceMotion = false, inReach = null } = {}) {
  if (reduceMotion) return [];
  const list = Array.isArray(targets) ? targets.filter((u) => u != null && (!inReach || inReach(u))) : [];
  return list.slice(0, MAX_DIVES);
}

/** How far Kaze's dives go for a Hana of range `range` (her reach + DIVE_SLACK): the queue's filter and the flight cap. */
export function diveReach(range) {
  return Math.max(0, range || 0) + DIVE_SLACK;
}

/** @returns {{ mode: 'home'|'travel'|'spot', x: number, z: number, tx: number, tz: number, hold: number, placed: boolean, dx: number, dz: number }} */
export function konState() {
  return { mode: 'home', x: 0, z: 0, tx: 0, tz: 0, hold: 0, placed: false, dx: 0, dz: 1, run: 0, steps: 0 };
}

/**
 * Ruri's relay spot for Kon, or null when her origin is at (or right by) her own spot.
 * @param {{ x: number, y: number, ox?: number, oy?: number, origin?: object|null }} t sim tower (read only)
 * @param {{ x: number, z: number }} out
 */
export function konSpot(t, out) {
  if (!t || !t.origin || t.ox == null || t.oy == null) return null;
  if (Math.hypot(t.ox - t.x, t.oy - t.y) < KON_SELF) return null;
  out.x = t.ox;
  out.z = t.oy;
  return out;
}

/**
 * One frame of Kon. He starts by Ruri (his appear plays there, `hold` seconds), then runs to her relay spot,
 * sits there, runs to a new spot when it moves, and runs back when the spot goes away.
 * @param {ReturnType<typeof konState>} s mutated
 * @param {number} dt
 * @param {number} homeX @param {number} homeZ where he sits by Ruri this frame
 * @param {{ x: number, z: number }|null} spot
 * @param {number} [speed]
 */
export function konStep(s, dt, homeX, homeZ, spot, speed = KON_SPEED) {
  if (!s.placed) {
    s.placed = true;
    s.mode = 'home';
    s.x = homeX;
    s.z = homeZ;
  }
  if (s.hold > 0) {
    s.hold = Math.max(0, s.hold - dt);
    if (s.mode === 'home') {
      s.x = homeX;
      s.z = homeZ;
      return s;
    }
  }
  const toHome = !spot;
  const tx = toHome ? homeX : spot.x;
  const tz = toHome ? homeZ : spot.z;
  if (toHome && s.mode === 'home') {
    s.x = homeX;
    s.z = homeZ;
    return s;
  }
  if (!toHome && s.mode === 'spot' && Math.abs(s.tx - tx) < 1e-6 && Math.abs(s.tz - tz) < 1e-6) return s;
  s.mode = 'travel';
  s.tx = tx;
  s.tz = tz;
  const dx = tx - s.x;
  const dz = tz - s.z;
  const d = Math.hypot(dx, dz);
  const step = Math.max(0, speed * dt);
  if (d > 1e-6) {
    s.dx = dx;
    s.dz = dz;
  }
  // (the run's length so far: his bounds and their dust puffs follow it)
  s.run += Math.min(d, step);
  s.steps = Math.floor(s.run / KON_STRIDE);
  if (d <= step || d < 1e-4) {
    s.x = tx;
    s.z = tz;
    s.mode = toHome ? 'home' : 'spot';
  } else {
    s.x += (dx / d) * step;
    s.z += (dz / d) * step;
  }
  return s;
}

/**
 * Kon's bounding run: how high this bound lifts him, his pitch (nose up on take-off, down on landing) and a stretch
 * of his body in the air; all 0 (stretch 1) unless he is running.
 * @param {ReturnType<typeof konState>} s
 * @param {{ lift: number, pitch: number, stretch: number }} out
 */
export function konGait(s, out) {
  if (s.mode !== 'travel') {
    out.lift = 0;
    out.pitch = 0;
    out.stretch = 1;
    return out;
  }
  const ph = (s.run / KON_STRIDE) % 1;
  const up = Math.sin(Math.PI * ph);
  out.lift = KON_HOP * up;
  out.pitch = KON_PITCH * Math.cos(Math.PI * ph);
  out.stretch = 1 + 0.14 * up;
  return out;
}

/** Kon plays his attack on Ruri's bolts only while he sits at her relay spot (they leap out of him). */
export function konAttacks(s) {
  return s.mode === 'spot';
}

/** @returns {{ busy: boolean, t: number, dur: number, tx: number, ty: number, tz: number, uid: number|null, k: number }} */
export function sortieState() {
  return { busy: false, t: 0, dur: 0, tx: 0, ty: 0, tz: 0, uid: null, k: 0, lx: 0, ly: 0, lz: 0, hit: false };
}

/**
 * Starts a sortie (Kaze's swoop / the doll's dash) at a target, unless one is already in flight: attacks that
 * come while it is busy are skipped. @returns {boolean} started
 */
export function startSortie(s, tx, ty, tz, dur, uid = null) {
  if (s.busy || !(dur > 0)) return false;
  s.busy = true;
  s.t = 0;
  s.dur = dur;
  s.tx = tx;
  s.ty = ty;
  s.tz = tz;
  s.uid = uid;
  s.k = 0;
  s.hit = false;
  return true;
}

/** Follows a moving target while the sortie flies (the enemy walks on). */
export function retarget(s, tx, ty, tz) {
  if (!s.busy) return;
  s.tx = tx;
  s.ty = ty;
  s.tz = tz;
}

/**
 * One frame of a sortie from the home point (hx, hy, hz). Writes where the companion is into `out`
 * ({ x, y, z, out: true while heading to the target }); at home when idle. `reach` caps how far it goes,
 * `stop` keeps it that far short of the target, `lift` is the arc height.
 */
export function sortieStep(s, dt, hx, hy, hz, out, { reach = Infinity, stop = 0, lift = SWOOP_LIFT } = {}) {
  out.out = false;
  if (s.busy) {
    s.t += dt;
    s.k = s.t / s.dur;
    if (s.k >= 1) {
      s.busy = false;
      s.k = 0;
      s.uid = null;
    }
  }
  if (!s.busy) {
    out.x = hx;
    out.y = hy;
    out.z = hz;
    return out;
  }
  const k = s.k;
  const dx = s.tx - hx;
  const dz = s.tz - hz;
  const len = Math.hypot(dx, dz);
  const go = Math.max(0, Math.min(len - stop, reach));
  const f = len > 1e-6 ? go / len : 0;
  // out and back: u rises 0 → 1 by the middle of the sortie and falls back to 0, eased at both ends
  const u = Math.sin(Math.PI * k);
  out.x = hx + dx * f * u;
  out.z = hz + dz * f * u;
  out.y = hy + (s.ty - hy) * f * u + lift * 4 * u * (1 - u);
  out.out = k < 0.5;
  return out;
}

const smooth = (u) => u * u * (3 - 2 * u);
const clamp01 = (u) => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Advances a sortie's clock; false (and idle) once it is done. Sets `out.hit` on the frame `k` crosses `hitAt`. */
function tick(s, dt, out, hitAt) {
  out.hit = false;
  if (!s.busy) return false;
  s.t += dt;
  s.k = s.t / s.dur;
  if (!s.hit && s.k >= hitAt) {
    s.hit = true;
    out.hit = true;
  }
  if (s.k >= 1) {
    s.busy = false;
    s.k = 0;
    s.uid = null;
    return false;
  }
  return true;
}

/** Where a flight from (hx, hz) toward the sortie's target ends: `stop` short of it, at most `reach` out. Writes s.lx/ly/lz. */
function landing(s, hx, hy, hz, reach, stop) {
  const dx = s.tx - hx;
  const dz = s.tz - hz;
  const len = Math.hypot(dx, dz);
  const go = Math.max(0, Math.min(len - stop, reach));
  const f = len > 1e-6 ? go / len : 0;
  s.lx = hx + dx * f;
  s.lz = hz + dz * f;
  s.ly = hy + (s.ty - hy) * f;
}

/**
 * One frame of Kon's Moon Pounce from where he stands (hx, hy, hz). The beats: a crouch on the spot (squash), an arc
 * leap to just short of the target (stretch; it follows a target that walks on until he lands), the impact there
 * (`out.hit` on its first frame; squash), then a lower hop back. `out`: { x, y, z, out: heading at the target,
 * phase: 'crouch'|'leap'|'impact'|'return'|null, squash: the figure's height factor, hit }.
 */
export function pounceStep(s, dt, hx, hy, hz, out, { stop = POUNCE_STOP, lift = POUNCE_LIFT, reach = Infinity } = {}) {
  out.out = false;
  out.phase = null;
  out.squash = 1;
  if (!tick(s, dt, out, POUNCE_LAND)) {
    out.x = hx;
    out.y = hy;
    out.z = hz;
    return out;
  }
  const k = s.k;
  // the landing spot follows the target until he lands, then stays put for the hop back
  if (k < POUNCE_LAND || out.hit) landing(s, hx, hy, hz, reach, stop);
  if (k < POUNCE_CROUCH) {
    const u = smooth(k / POUNCE_CROUCH);
    out.x = hx;
    out.y = hy;
    out.z = hz;
    out.squash = 1 - 0.32 * u;
    out.phase = 'crouch';
    out.out = true;
  } else if (k < POUNCE_LAND) {
    const u = (k - POUNCE_CROUCH) / (POUNCE_LAND - POUNCE_CROUCH);
    const e = 1 - (1 - u) * (1 - u); // fast off the ground, settling onto the target
    out.x = hx + (s.lx - hx) * e;
    out.z = hz + (s.lz - hz) * e;
    out.y = hy + (s.ly - hy) * e + lift * 4 * u * (1 - u);
    out.squash = 1 + 0.2 * Math.sin(Math.PI * u);
    out.phase = 'leap';
    out.out = true;
  } else if (k < POUNCE_REBOUND) {
    const u = (k - POUNCE_LAND) / (POUNCE_REBOUND - POUNCE_LAND);
    out.x = s.lx;
    out.y = s.ly;
    out.z = s.lz;
    out.squash = 0.72 + 0.28 * smooth(u);
    out.phase = 'impact';
    out.out = true;
  } else {
    const u = (k - POUNCE_REBOUND) / (1 - POUNCE_REBOUND);
    const e = smooth(u);
    out.x = s.lx + (hx - s.lx) * e;
    out.z = s.lz + (hz - s.lz) * e;
    out.y = s.ly + (hy - s.ly) * e + lift * 0.45 * 4 * u * (1 - u);
    out.squash = 1 + 0.08 * Math.sin(Math.PI * u);
    out.phase = 'return';
  }
  return out;
}

/**
 * One frame of Kaze's swoop (his plain swoops and his Swoop dives) from his perch (hx, hy, hz): a climb out to a top
 * STOOP_APEX of the way and STOOP_RISE up, a stoop down onto the target (`out.hit` as it lands, at STOOP_HIT), then a
 * swing back up to the perch. `reach` caps how far out he goes, `stop` keeps him that far short. `out`: { x, y, z,
 * out: heading at the target, phase: 'climb'|'stoop'|'return'|null, pitch: nose down > 0, hit }.
 */
export function stoopStep(s, dt, hx, hy, hz, out, { reach = Infinity, stop = 0, rise = STOOP_RISE, lift = SWOOP_LIFT } = {}) {
  out.out = false;
  out.phase = null;
  out.pitch = 0;
  if (!tick(s, dt, out, STOOP_HIT)) {
    out.x = hx;
    out.y = hy;
    out.z = hz;
    return out;
  }
  const k = s.k;
  // (the strike point follows the target until he strikes; the swing home starts from where he struck)
  if (k < STOOP_HIT || out.hit) landing(s, hx, hy, hz, reach, stop);
  const ax = hx + (s.lx - hx) * STOOP_APEX;
  const az = hz + (s.lz - hz) * STOOP_APEX;
  const ay = Math.max(hy, s.ly) + rise;
  if (k < STOOP_UP) {
    const u = k / STOOP_UP;
    const e = Math.sin((u * Math.PI) / 2); // off her shoulder, easing into the top
    out.x = hx + (ax - hx) * e;
    out.z = hz + (az - hz) * e;
    out.y = hy + (ay - hy) * e;
    out.pitch = -0.35 * (1 - u);
    out.phase = 'climb';
    out.out = true;
  } else if (k < STOOP_HIT) {
    const u = (k - STOOP_UP) / (STOOP_HIT - STOOP_UP);
    const e = u ** 1.1; // gathering speed as he drops
    out.x = ax + (s.lx - ax) * e;
    out.z = az + (s.lz - az) * e;
    out.y = ay + (s.ly - ay) * e;
    out.pitch = 0.75;
    out.phase = 'stoop';
    out.out = true;
  } else {
    const u = (k - STOOP_HIT) / (1 - STOOP_HIT);
    const e = smooth(u);
    out.x = s.lx + (hx - s.lx) * e;
    out.z = s.lz + (hz - s.lz) * e;
    out.y = s.ly + (hy - s.ly) * e + lift * 4 * u * (1 - u);
    out.pitch = -0.3 * Math.sin(Math.PI * u);
    out.phase = 'return';
  }
  return out;
}

/**
 * Kaze's perch between swoops: one swoop in flight, at most one waiting (the latest target she shot; a flyer is
 * kept over a walker, as she shoots flyers first), a SWOOP_REST on her shoulder after each landing.
 * @returns {{ next: number|null, nextAir: boolean, rest: number, was: boolean }}
 */
export function perchState() {
  return { next: null, nextAir: false, rest: 0, was: false };
}

/** Remembers a target she shot while he cannot set off (busy or resting): the latest one, flyers first. */
export function queueSwoop(p, uid, air = false) {
  if (uid == null) return;
  if (p.next != null && p.nextAir && !air) return;
  p.next = uid;
  p.nextAir = !!air;
}

/** True when a swoop may start now (not flying, rested). */
export function perchFree(p, busy) {
  return !busy && !p.was && p.rest <= 0;
}

/**
 * One frame of the perch (after the flight's own step): starts his rest when he lands, counts it down, then hands
 * out the waiting target (uid, once) or null.
 */
export function perchStep(p, dt, busy) {
  if (busy) {
    p.was = true;
    return null;
  }
  if (p.was) {
    p.was = false;
    p.rest = SWOOP_REST;
    return null;
  }
  if (p.rest > 0) {
    p.rest = Math.max(0, p.rest - dt);
    if (p.rest > 0) return null;
  }
  if (p.next == null) return null;
  const u = p.next;
  p.next = null;
  p.nextAir = false;
  return u;
}

/** Forgets the waiting target (her ⚡ dives take over). */
export function perchClear(p) {
  p.next = null;
  p.nextAir = false;
}

/** A fixed ring of a companion's recent positions (no allocation after this). */
export function trailState(n = TRAIL_N) {
  return { n, x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), t: new Float32Array(n), head: 0, count: 0 };
}

/** Adds a point (time `time`, seconds) unless the last one is within `minGap` tiles (then it is only kept fresh). */
export function trailPush(tr, x, y, z, time, minGap = 0.06) {
  if (tr.count) {
    const i = (tr.head + tr.n - 1) % tr.n;
    if (Math.abs(tr.x[i] - x) + Math.abs(tr.y[i] - y) + Math.abs(tr.z[i] - z) < minGap) return false;
  }
  tr.x[tr.head] = x;
  tr.y[tr.head] = y;
  tr.z[tr.head] = z;
  tr.t[tr.head] = time;
  tr.head = (tr.head + 1) % tr.n;
  tr.count = Math.min(tr.n, tr.count + 1);
  return true;
}

/** The trail's i-th newest point as an index into its arrays (0 = newest), or -1. */
export function trailAt(tr, i) {
  if (i < 0 || i >= tr.count) return -1;
  return (tr.head + tr.n - 1 - i) % tr.n;
}

/** How bright a trail point of time `t` is at `now` (1 fresh → 0 after `life`). */
export function trailFade(t, now, life = TRAIL_LIFE) {
  return clamp01(1 - (now - t) / life);
}

export function trailClear(tr) {
  tr.count = 0;
  tr.head = 0;
}

/**
 * Reconciles the actors with the girls on the board: makes one for every tower that has a companion and a
 * view, keeps the rest, drops the ones whose girl is gone (sold, removed, a new battle).
 * @param {Map<number, object>} actors uid -> actor (mutated)
 * @param {{ uid: number, unitId: string }[]} towers sim towers (read only)
 * @param {(unitId: string) => string|null} companionOf
 * @param {(t: object, cid: string) => object|null} make null = not yet (files loading, no view)
 * @param {(actor: object) => void} drop
 * @param {number} stamp a number unique to this call (frame counter)
 */
export function reconcile(actors, towers, companionOf, make, drop, stamp) {
  for (let i = 0; i < towers.length; i++) {
    const t = towers[i];
    const cid = companionOf(t.unitId);
    if (!cid) continue;
    let a = actors.get(t.uid);
    if (a && a.cid !== cid) {
      drop(a);
      actors.delete(t.uid);
      a = null;
    }
    if (!a) {
      a = make(t, cid);
      if (!a) continue;
      a.cid = cid;
      actors.set(t.uid, a);
    }
    a.stamp = stamp;
  }
  for (const [uid, a] of actors) {
    if (a.stamp !== stamp) {
      drop(a);
      actors.delete(uid);
    }
  }
}

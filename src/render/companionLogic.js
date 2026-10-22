// Pure state rules of the companion actors (src/render/companions.js): no three.js, no DOM, no sim
// writes, so they are unit-tested in node (tests/render/companions.test.js). Positions are world units
// on the board: x = sim x, z = sim y, y = height.
//
//   Kon (Ruri):  home (sits by her) → travel (runs along the ground) → spot (sits at her relay origin);
//                Moon Pounce: a leap from where he is to the target and back (a sortie of his own)
//   Kaze (Hana): a swoop = out to the target and back in a short arc; one in flight at a time;
//                Kaze's Swoop: a queue of quick dives, one per target within her reach (none on Reduce motion)
//   doll (Yoriko): a dash = the same out-and-back, short and low, stopping short of the target

/** Kon's running speed (tiles / s). */
export const KON_SPEED = 2.4;
/** A relay origin this close to Ruri means no relay spot: Kon sits by her. */
export const KON_SELF = 0.3;
/** Kaze's swoop: seconds out and back, arc height (tiles). */
export const SWOOP_TIME = 0.95;
export const SWOOP_LIFT = 0.45;
/** The doll's dash: seconds out and back, how far it goes at most, how short of the target it stops. */
export const DASH_TIME = 0.67;
export const DASH_REACH = 1.3;
export const DASH_STOP = 0.35;
export const DASH_LIFT = 0.12;
/** Kaze's Swoop (Hana's ⚡): one quick dive per target, in strike order (seconds out and back), at most MAX_DIVES. */
export const DIVE_TIME = 0.55;
export const MAX_DIVES = 8;
/**
 * How far past her own range a dive may go (tiles): Kaze dives only as far as his plain swoops (her reach), never
 * across the map — a target beyond it is only marked (abilityFx). The dive's flight is capped there too.
 */
export const DIVE_SLACK = 0.5;
/** Kon's Moon Pounce (Ruri's ⚡): seconds out and back, how short of the target he lands, the leap's height. */
export const POUNCE_TIME = 0.6;
export const POUNCE_STOP = 0.22;
export const POUNCE_LIFT = 0.55;

/**
 * The dives a Swoop queues: its targets within her reach (`inReach`), in strike order (the sim's `ability` event
 * lists them), at most MAX_DIVES. A Swoop is map-wide, but Kaze never crosses the map for it: the far targets are
 * only marked. Reduce motion: none at all — he stays on her shoulder and calls the strike (his attack clip), the
 * marks fade in on the targets (the owner is motion-sensitive; Kon stays put for Moon Pounce the same way).
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
  return { mode: 'home', x: 0, z: 0, tx: 0, tz: 0, hold: 0, placed: false, dx: 0, dz: 1 };
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

/** Kon plays his attack on Ruri's bolts only while he sits at her relay spot (they leap out of him). */
export function konAttacks(s) {
  return s.mode === 'spot';
}

/** @returns {{ busy: boolean, t: number, dur: number, tx: number, ty: number, tz: number, uid: number|null, k: number }} */
export function sortieState() {
  return { busy: false, t: 0, dur: 0, tx: 0, ty: 0, tz: 0, uid: null, k: 0 };
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

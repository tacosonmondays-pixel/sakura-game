// Pure state rules of the companion actors (src/render/companions.js): no three.js, no DOM, no sim
// writes, so they are unit-tested in node (tests/render/companions.test.js). Positions are world units
// on the board: x = sim x, z = sim y, y = height.
//
//   Kon (Ruri):  home (sits by her) → travel (bounds along the ground: konGait, a dust puff per stride; an arc that
//                bows toward the camera early and comes in straight, konArc, so the run crosses open ground in
//                front of her and not the props by the spot; a target that jumps mid-run: konRetarget, a new arc
//                along his heading, or a skid-turn or a pivot first when it lands behind him) → spot
//                (sits at her relay origin); Moon Pounce (pounceStep): crouch → arc leap → impact at the target → hop
//                back to where he stood
//   Kaze (Hana): a swoop (stoopStep) = climb, stoop down onto the target she shot, swing back up to her shoulder;
//                one in flight at a time, at most one more waiting (perch*: the latest target, a flyer kept over a
//                walker), a short rest on her shoulder between swoops;
//                Kaze's Swoop: a queue of quick dives, one per target within her reach (none on Reduce motion)
//   trails:      a fixed ring of recent positions per companion (trail*), drawn as fading ribbons
//   doll (Yoriko): a dash = the same out-and-back, short and low, stopping short of the target

/** Kon's running speed (tiles / s): slow enough that a 1.5-tile run reads (over a second on screen). */
export const KON_SPEED = 1.25;
/** One bound of his run (tiles): a hop, a dust puff where he lands. */
export const KON_STRIDE = 0.36;
/** How high a bound lifts him (tiles) and how far he pitches (radians, nose up on take-off). */
export const KON_HOP = 0.1;
export const KON_PITCH = 0.22;
/**
 * His run bows toward the camera (display only, the same start and arrival): the bow's peak sits KON_ARC of the run's
 * length off the straight line, at most KON_ARC_MAX tiles, so a short run to a spot about a tile from Ruri crosses the
 * open ground in front of her instead of her body. The bow comes early (a cubic: its first control point KON_ARC_IN
 * along the line and off it to the camera side), where clearing her matters; the second sits KON_ARC_OUT along, so he
 * comes in near-straight and does not swing wide through props beside his spot. A run that heads toward the camera
 * leaves her behind it anyway: its bow shrinks by as much, and it comes in from straight behind the spot on screen
 * (so a prop in front of the spot and to one side never cuts through him on the way in). A target that jumps more
 * than KON_RETARGET tiles starts a new run from where he is (konRetarget: along the way he is already running, or a
 * skid-turn or a pivot first for a target behind him); a smaller move (her home point turning with her) only moves the arc's end.
 */
export const KON_ARC = 0.3;
export const KON_ARC_MAX = 0.6;
export const KON_ARC_IN = 1 / 3;
export const KON_ARC_OUT = 0.65;
export const KON_RETARGET = 0.25;
/**
 * A target that jumps mid-run (konRetarget). Ahead of him or beside him: a new arc that leaves along his heading
 * (konTurn; a circle of at least KON_TURN_R tiles' radius), so his facing turns a few degrees a frame instead of
 * snapping. Behind him (or too close beside him for that circle) and closer than KON_SKID_NEAR: a skid-turn, he plants,
 * slides at most KON_SKID_SLIDE tiles on while he swings round over KON_SKID seconds (KON_SKID_MAX for the long way
 * round), a small dust puff, then a run from rest (konArc); a run after it shorter than KON_SKID_SHORT is aimed at
 * straight (the skid swings him to face the target itself). Behind him and further: he turns on a circle of KON_PIVOT
 * tiles' radius until he faces the target, then runs in along his heading. Both turn the short way round unless it
 * comes within KON_PIVOT + KON_CLEAR tiles of Ruri: a skid whose swing sweeps his facing across her, near him; a pivot
 * whose circle and run in pass that close to her, when the other way keeps further off. Then the other way, a skid at
 * most KON_SKID_LONG radians round (the short way when the long way is further than that). Dead behind: away from her.
 */
export const KON_TURN = 0.6;
export const KON_TURN_R = 0.15;
export const KON_SKID_NEAR = 1;
export const KON_SKID = 0.15;
export const KON_SKID_MAX = 0.2;
export const KON_SKID_SLIDE = 0.04;
export const KON_PIVOT = 0.25;
export const KON_CLEAR = 0.35;
export const KON_SKID_LONG = (200 * Math.PI) / 180;
export const KON_SKID_SHORT = 0.2;
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

/**
 * sx / sz: where this run started; cx / cz: its arc's first control point; ex / ez: its second, relative to the
 * target (konArc); u: how far along it he is (0..1). A skid-turn (konRetarget): skid (seconds left of it, 0: none) of
 * skidDur, from (kx, kz) facing angle ka by kda radians (he ends at sx / sz, facing the arc that follows); skids
 * counts them (a dust puff each); r0: his run where the last one ended (his bounds ease back in over a stride). A
 * pivot: piv (radians of turn left in its budget, 0: none), round (qx, qz) at angle qa, qs: +1 counterclockwise
 * (toward +z from +x), -1 clockwise.
 * @returns {{ mode: 'home'|'travel'|'spot', x: number, z: number, tx: number, tz: number, hold: number, placed: boolean, dx: number, dz: number }}
 */
export function konState() {
  return {
    mode: 'home', x: 0, z: 0, tx: 0, tz: 0, hold: 0, placed: false, dx: 0, dz: 1, run: 0, steps: 0,
    sx: 0, sz: 0, cx: 0, cz: 0, ex: 0, ez: 0, u: 0,
    skid: 0, skidDur: 0, kx: 0, kz: 0, ka: 0, kda: 0, skids: 0, r0: -1e9, piv: 0, qx: 0, qz: 0, qa: 0, qs: 1,
  };
}

/**
 * Starts a run from where Kon is to (tx, tz): a cubic (see KON_ARC) toward the camera (`cam`: the ground direction
 * toward the camera, unit length; null: a straight run). The first control point sits KON_ARC_IN along the straight
 * line and off it on the camera's side, by more the more the run crosses the view (a run straight at the camera or
 * away from it stays straight) and by less the more it heads toward the camera. The second sits KON_ARC_OUT along:
 * on the line, or for a run that heads toward the camera turned toward the camera's axis by as much (ex / ez,
 * relative to the target). Mid-run (`hx, hz`: his heading, any length; 0, 0: from rest) an arc to a target ahead of
 * him or beside him leaves along his heading instead (konTurn).
 * @param {ReturnType<typeof konState>} s mutated
 * @param {{ x: number, z: number }|null} [cam]
 * @param {number} [hx] @param {number} [hz]
 */
export function konArc(s, tx, tz, cam = null, hx = 0, hz = 0) {
  s.sx = s.x;
  s.sz = s.z;
  s.u = 0;
  const dx = tx - s.x;
  const dz = tz - s.z;
  const d = Math.hypot(dx, dz);
  let px = 0;
  let pz = 0;
  // his arrival direction (unit): along the line
  let ax = d > 1e-6 ? dx / d : 0;
  let az = d > 1e-6 ? dz / d : 0;
  if (cam && d > 1e-6) {
    // the run's normal on the camera's side, weighted by how much of the view it crosses
    px = -az;
    pz = ax;
    const dot = px * cam.x + pz * cam.z;
    // how much it heads toward the camera (0: across the view or away, 1: straight at it): a run that does leaves her
    // figure behind it anyway, so its bow shrinks by as much (a bow there only swings him wide beside his spot)
    const near = Math.max(0, ax * cam.x + az * cam.z);
    // (with the second control point on the line, the bow peaks at u = 1/3, 4/9 of the first one's offset)
    const k = 2.25 * Math.min(KON_ARC * d, KON_ARC_MAX) * dot * (1 - near);
    px *= k;
    pz *= k;
    // and it comes in from straight behind the spot on screen (its arrival turned toward the camera's axis by as
    // much), so a prop in front of the spot and to one side never cuts through him on the way in
    const bx = ax * (1 - near) + cam.x * near;
    const bz = az * (1 - near) + cam.z * near;
    const l = Math.hypot(bx, bz);
    if (l > 1e-6) {
      ax = bx / l;
      az = bz / l;
    }
  }
  s.cx = s.x + dx * KON_ARC_IN + px;
  s.cz = s.z + dz * KON_ARC_IN + pz;
  // the second control point, KON_ARC_OUT along (relative to the target): he arrives along (ax, az)
  s.ex = -ax * d * (1 - KON_ARC_OUT);
  s.ez = -az * d * (1 - KON_ARC_OUT);
  const hl = Math.hypot(hx, hz);
  konTurned = hl > 1e-9 && d > 1e-6 && konTurn(s, dx / d, dz / d, d, hx / hl, hz / hl);
  return s;
}

/**
 * A new arc mid-run that leaves along his heading (hx, hz, unit), so it joins the run he was on smoothly (no corner)
 * and his facing turns a few degrees a frame instead of snapping. For a target ahead of him or to one side: a circular
 * arc, tangent to his heading and through the target (a radius of at least KON_TURN_R). A target well ahead (within
 * 60° of his heading and at least KON_TURN away) keeps the arrival konArc gave it (near-straight, or from behind the
 * spot on screen: clear of props beside the spot) and only leaves along his heading, its first leg half the run
 * long. A target behind him, or too close beside him for that circle, keeps konArc's shape: konRetarget skid-turns
 * or pivots him round first. With his pace even (konStep), his facing turns under 9° a frame on these arcs at
 * 60 fps (a true KON_TURN_R circle would be 8°; the cubic's tightest case measures 8.9°; a pivot: 4.8°). (cx, cz:
 * the unit direction to the target, d: how far it is.)
 */
function konTurn(s, cx, cz, d, hx, hz) {
  const cos = hx * cx + hz * cz;
  const sin = Math.sqrt(Math.max(0, 1 - cos * cos));
  // (a far target barely ahead of beside him pivots too: this circle would bulge out wide for it)
  if (cos < -1e-9 || d < 2 * sin * KON_TURN_R || (cos < 0.25 && d >= KON_SKID_NEAR)) return false;
  let l1;
  if (cos >= 0.5 && d >= KON_TURN) {
    // well ahead: only the first control point moves (onto his heading); he arrives as konArc set it
    l1 = d * KON_ARC_IN * 1.5;
  } else {
    // a circular arc (radius d / (2 sin φ)): both control legs (4/3)·tan(φ/2)·r long; he arrives along his heading
    // mirrored in the line to the target
    l1 = (2 * d) / (3 * (1 + cos));
    s.ex = -(2 * cos * cx - hx) * l1;
    s.ez = -(2 * cos * cz - hz) * l1;
  }
  s.cx = s.x + hx * l1;
  s.cz = s.z + hz * l1;
  return true;
}
/** Whether the last konArc left along a heading (konTurn took it); otherwise it kept the shape of a run from rest. */
let konTurned = false;

/**
 * Which way he turns round (+1: counterclockwise, toward +z from +x; -1: clockwise) when he is at (x, z) heading
 * (hx, hz): away from Ruri (`ruri`, her ground spot); with her on his line (or not given), toward the camera; with
 * neither, toward the target (tdx, tdz: the way to it).
 */
function konSide(x, z, hx, hz, cam, ruri, tdx, tdz) {
  if (ruri) {
    const c = hx * (ruri.z - z) - hz * (ruri.x - x);
    if (Math.abs(c) > 0.02) return c > 0 ? -1 : 1;
  }
  if (cam) {
    const c = hx * cam.z - hz * cam.x;
    if (Math.abs(c) > 1e-3) return c > 0 ? 1 : -1;
  }
  return hx * tdz - hz * tdx < 0 ? -1 : 1;
}

/** An angle wrapped into (-π, π]. */
function konWrap(a) {
  a %= 2 * Math.PI;
  if (a > Math.PI) a -= 2 * Math.PI;
  else if (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * How close a pivot on `side` from (x, z) heading (hx, hz) to (tx, tz) would come to Ruri (rx, rz): round its KON_PIVOT
 * circle to where he faces the target, then (near enough) straight in.
 */
function konPivotClear(x, z, hx, hz, side, tx, tz, rx, rz) {
  const qx = x - hz * KON_PIVOT * side;
  const qz = z + hx * KON_PIVOT * side;
  const D = Math.hypot(tx - qx, tz - qz);
  // where he leaves the circle: the tangent point toward the target (a target inside the circle: where he is)
  const a0 = Math.atan2(z - qz, x - qx);
  const at = D > KON_PIVOT ? Math.atan2(tz - qz, tx - qx) - side * Math.acos(KON_PIVOT / D) : a0;
  const lx = qx + KON_PIVOT * Math.cos(at);
  const lz = qz + KON_PIVOT * Math.sin(at);
  const sweep = (((side * (at - a0)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const ra = (((side * (Math.atan2(rz - qz, rx - qx) - a0)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let m = ra <= sweep ? Math.abs(Math.hypot(rx - qx, rz - qz) - KON_PIVOT) : Math.hypot(rx - x, rz - z);
  const sx = tx - lx;
  const sz = tz - lz;
  const l2 = sx * sx + sz * sz;
  const t = l2 > 1e-12 ? Math.min(1, Math.max(0, ((rx - lx) * sx + (rz - lz) * sz) / l2)) : 0;
  m = Math.min(m, Math.hypot(rx - lx - sx * t, rz - lz - sz * t));
  return m;
}

/**
 * His target jumped more than KON_RETARGET tiles mid-run (see KON_TURN): ahead or beside him, a new arc along his
 * heading (konTurn); behind him and near, a skid-turn; behind him and further, a pivot on a KON_PIVOT circle. Either
 * turns the short way round unless that way comes near Ruri (see KON_CLEAR); with the target dead behind him, away
 * from her (konSide).
 */
function konRetarget(s, tx, tz, cam, ruri) {
  // (mid-skid: his bound carries on easing back in from where the skid left it, konGait)
  if (s.skid > 0) s.r0 = s.run - KON_STRIDE * (s.skid / s.skidDur);
  s.skid = 0;
  s.piv = 0;
  const hl = Math.hypot(s.dx, s.dz);
  const dx = tx - s.x;
  const dz = tz - s.z;
  const d = Math.hypot(dx, dz);
  if (hl < 1e-9 || d < 1e-6) {
    konArc(s, tx, tz, cam);
    return;
  }
  const hx = s.dx / hl;
  const hz = s.dz / hl;
  konArc(s, tx, tz, cam, hx, hz);
  if (konTurned) return;
  // (with the target dead behind him: away from her, konSide)
  let side = konSide(s.x, s.z, hx, hz, cam, ruri, dx, dz);
  if (d < KON_SKID_NEAR) {
    konSkid(s, tx, tz, cam, hx, hz, side, ruri);
    return;
  }
  const c = hx * dz - hz * dx;
  if (Math.abs(c) > 0.02 * d) {
    // the target is off his line, so one way round is shorter: that way, unless its circle and run in pass within
    // KON_PIVOT + KON_CLEAR of her and the other way keeps further off
    const short = c > 0 ? 1 : -1;
    side = short;
    if (ruri) {
      const m = konPivotClear(s.x, s.z, hx, hz, short, tx, tz, ruri.x, ruri.z);
      if (m < KON_PIVOT + KON_CLEAR && konPivotClear(s.x, s.z, hx, hz, -short, tx, tz, ruri.x, ruri.z) > m + 0.05) {
        side = -short;
      }
    }
  }
  // a pivot: round a KON_PIVOT circle on that side, at his pace, until he faces the target (konPivot)
  s.qs = side;
  s.qx = s.x - hz * KON_PIVOT * side;
  s.qz = s.z + hx * KON_PIVOT * side;
  s.qa = Math.atan2(s.z - s.qz, s.x - s.qx);
  s.piv = 2 * Math.PI;
}

/**
 * Starts a skid-turn: he will slide KON_SKID_SLIDE on along his heading (hx, hz), decelerating, and swing round to
 * face the take-off of a run from rest that starts where he stops (built now; one shorter than KON_SKID_SHORT is a
 * straight line, so he faces the target itself). He swings the short way round, unless Ruri (`ruri`, or null) stands
 * within KON_PIVOT + KON_CLEAR of him inside that swing: then the other way, if that is no further round than
 * KON_SKID_LONG. With the take-off dead behind him: `away`. A small dust puff (skids).
 */
function konSkid(s, tx, tz, cam, hx, hz, away, ruri) {
  const x = s.x;
  const z = s.z;
  s.x = x + hx * KON_SKID_SLIDE;
  s.z = z + hz * KON_SKID_SLIDE;
  konArc(s, tx, tz, cam);
  s.x = x;
  s.z = z;
  const lx = tx - s.sx;
  const lz = tz - s.sz;
  if (lx * lx + lz * lz < KON_SKID_SHORT * KON_SKID_SHORT) {
    // too short a run for that bow (it would turn him tens of degrees a frame): straight at the target
    s.cx = s.sx + lx / 3;
    s.cz = s.sz + lz / 3;
    s.ex = -lx / 3;
    s.ez = -lz / 3;
  }
  s.kx = x;
  s.kz = z;
  s.ka = Math.atan2(hz, hx);
  let a1 = s.ka;
  const ox = s.cx - s.sx;
  const oz = s.cz - s.sz;
  if (ox * ox + oz * oz > 1e-12) a1 = Math.atan2(oz, ox);
  else if (Math.hypot(tx - s.sx, tz - s.sz) > 1e-9) a1 = Math.atan2(tz - s.sz, tx - s.sx);
  let da = konWrap(a1 - s.ka);
  let side = da < 0 ? -1 : 1;
  if (Math.abs(da) > Math.PI - 0.02) side = away;
  else if (ruri && Math.hypot(ruri.x - x, ruri.z - z) < KON_PIVOT + KON_CLEAR) {
    // (his facing would sweep across her)
    const ra = konWrap(Math.atan2(ruri.z - z, ruri.x - x) - s.ka);
    if (ra * da > 0 && Math.abs(ra) <= Math.abs(da)) side = -side;
  }
  if (da * side < 0 && Math.abs(da + side * 2 * Math.PI) <= KON_SKID_LONG) da += side * 2 * Math.PI;
  s.kda = da;
  s.skidDur = Math.min(KON_SKID_MAX, KON_SKID + ((KON_SKID_MAX - KON_SKID) * Math.abs(da)) / Math.PI);
  s.skid = s.skidDur;
  s.skids++;
}

/** One frame of a skid-turn: he slides to a stop (easing out) while his facing swings round (eased in and out). */
function konSkidStep(s, dt) {
  s.skid = Math.max(0, s.skid - Math.max(0, dt));
  const k = 1 - s.skid / s.skidDur;
  const e = 1 - (1 - k) * (1 - k);
  const nx = s.skid > 0 ? s.kx + (s.sx - s.kx) * e : s.sx;
  const nz = s.skid > 0 ? s.kz + (s.sz - s.kz) * e : s.sz;
  s.run += Math.hypot(nx - s.x, nz - s.z);
  s.steps = Math.floor(s.run / KON_STRIDE);
  s.x = nx;
  s.z = nz;
  const a = s.ka + s.kda * k * k * (3 - 2 * k);
  s.dx = Math.cos(a);
  s.dz = Math.sin(a);
  if (s.skid === 0) s.r0 = s.run;
}

/**
 * One frame of a pivot (`step` tiles round its circle). Once he faces the target (within this frame's turn), or
 * after a full circle, he runs in along his heading (konTurn) and the rest of the frame is up to konStep's arc; it
 * returns the step left for that (0 while he is still pivoting).
 */
function konPivot(s, step, tx, tz, cam) {
  const w = step / KON_PIVOT;
  const hx = -Math.sin(s.qa) * s.qs;
  const hz = Math.cos(s.qa) * s.qs;
  const rest = (((s.qs * (Math.atan2(tz - s.z, tx - s.x) - Math.atan2(hz, hx))) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  if (rest <= w || rest >= 2 * Math.PI - 2 * w || s.piv <= 0) {
    s.piv = 0;
    s.dx = hx;
    s.dz = hz;
    konArc(s, tx, tz, cam, hx, hz);
    if (!konTurned) konSkid(s, tx, tz, cam, hx, hz, s.qs, null);
    return s.skid > 0 ? 0 : step;
  }
  s.piv -= w;
  s.qa += w * s.qs;
  const nx = s.qx + KON_PIVOT * Math.cos(s.qa);
  const nz = s.qz + KON_PIVOT * Math.sin(s.qa);
  s.run += Math.hypot(nx - s.x, nz - s.z);
  s.steps = Math.floor(s.run / KON_STRIDE);
  s.x = nx;
  s.z = nz;
  s.dx = -Math.sin(s.qa) * s.qs;
  s.dz = Math.cos(s.qa) * s.qs;
  return 0;
}

/** The arc's speed (|dB/du|) at u, toward (tx, tz). */
function konArcSpeed(s, u, tx, tz) {
  const v = 1 - u;
  const ex = tx + s.ex;
  const ez = tz + s.ez;
  const p = v * v;
  const q = 2 * u * v;
  const r = u * u;
  const fx = p * (s.cx - s.sx) + q * (ex - s.cx) + r * (tx - ex);
  const fz = p * (s.cz - s.sz) + q * (ez - s.cz) + r * (tz - ez);
  return 3 * Math.hypot(fx, fz);
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
 * @param {{ x: number, z: number }|null} [cam] the ground direction toward the camera (unit): his run bows that way
 * @param {{ x: number, z: number }|null} [ruri] where Ruri stands: a skid-turn or a pivot turns away from her when the
 *   short way round would come near her
 */
export function konStep(s, dt, homeX, homeZ, spot, speed = KON_SPEED, cam = null, ruri = null) {
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
  // a new run (from where he sits, or a target that jumped): a new arc from here (or first a skid-turn or a pivot,
  // konRetarget); a small move only moves its end
  if (s.mode !== 'travel') konArc(s, tx, tz, cam);
  else if (Math.hypot(tx - s.tx, tz - s.tz) > KON_RETARGET) konRetarget(s, tx, tz, cam, ruri);
  s.mode = 'travel';
  s.tx = tx;
  s.tz = tz;
  if (s.skid > 0) {
    konSkidStep(s, dt);
    return s;
  }
  let step = Math.max(0, speed * dt);
  if (s.piv > 0) {
    step = konPivot(s, step, tx, tz, cam);
    if (s.skid > 0 || s.piv > 0) return s;
  }
  // the arc: a cubic from (sx, sz) through its control points to the target. u advances by arc length (a midpoint
  // step on its speed), so his pace is even along it; the run counts the distance he really moved
  const u0 = s.u;
  const sp0 = konArcSpeed(s, u0, tx, tz);
  let du = sp0 > 1e-6 ? step / sp0 : 1;
  const spm = konArcSpeed(s, Math.min(1, u0 + du / 2), tx, tz);
  du = spm > 1e-6 ? step / spm : 1;
  const u = u0 + Math.min(du, 0.5);
  if (u >= 1 || Math.hypot(tx - s.x, tz - s.z) < 1e-4) {
    // (the bounds and their dust puffs follow the run's length)
    s.run += Math.hypot(tx - s.x, tz - s.z);
    s.steps = Math.floor(s.run / KON_STRIDE);
    s.x = tx;
    s.z = tz;
    s.u = 1;
    s.mode = toHome ? 'home' : 'spot';
    return s;
  }
  s.u = u;
  const v = 1 - u;
  const ex = tx + s.ex;
  const ez = tz + s.ez;
  const b0 = v * v * v;
  const b1 = 3 * u * v * v;
  const b2 = 3 * u * u * v;
  const b3 = u * u * u;
  const nx = b0 * s.sx + b1 * s.cx + b2 * ex + b3 * tx;
  const nz = b0 * s.sz + b1 * s.cz + b2 * ez + b3 * tz;
  s.run += Math.hypot(nx - s.x, nz - s.z);
  s.steps = Math.floor(s.run / KON_STRIDE);
  s.x = nx;
  s.z = nz;
  // he faces along the arc (its tangent)
  const p = v * v;
  const q = 2 * u * v;
  const r = u * u;
  const fx = p * (s.cx - s.sx) + q * (ex - s.cx) + r * (tx - ex);
  const fz = p * (s.cz - s.sz) + q * (ez - s.cz) + r * (tz - ez);
  if (fx * fx + fz * fz > 1e-12) {
    s.dx = fx;
    s.dz = fz;
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
  // a skid-turn: his bound settles to the ground as he plants, and eases back in over his first stride after it
  // (a skid that starts within that stride, or a retarget mid-skid, carries on from there: the lower of the two)
  const k = Math.min(s.skid > 0 ? s.skid / s.skidDur : 1, (s.run - s.r0) / KON_STRIDE);
  if (k < 1) {
    const g = Math.max(0, k);
    out.lift *= g;
    out.pitch *= g;
    out.stretch = 1 + (out.stretch - 1) * g;
  }
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

/** Adds a point (time `time`, seconds) unless the last one is within `minGap` tiles (then nothing changes, so a
 *  companion standing still lets its trail fade out). */
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

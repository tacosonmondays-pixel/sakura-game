// Pure rules of Yoriko's marionette (drawn by src/render/marionette.js): no three.js, no DOM, no sim writes,
// so they are unit-tested in node (tests/render/marionette.test.js). Positions are offsets from the doll's
// home point (in front of her raised hand) in world units: x = sim x, z = sim y, y = height.
//
// One attack = four stages inside her attack interval, then a settle:
//   command  a flick of her control bar: the doll is pulled back a little and tilts
//   extend   the doll glides on an arc toward the target (the strings stretch, they stay tied to the bar)
//   strike   the attack pose, the strings snap taut (the slash flash on the sim's hit is attackFx's, not here)
//   reel     a curved path home (the other side of the arc)
//   settle   a pendulum swing under the bar that dies out
// The sim's hit sets the clock: Command + Extend end on it (planStages), and a hit that lands sooner than
// planned pulls the strike forward (landMarionette). One doll, one sequence: an attack that comes while it is
// out (command / extend / strike) is skipped; one during reel or settle starts again from where the doll is.
// A target that dies before the strike: the doll takes the enemy by its last spot (the needle flies on there)
// or reels home from where it is (loseTarget).

/** The stages in order ('idle' = hanging at home). */
export const STAGES = ['command', 'extend', 'strike', 'reel', 'settle'];
/** Base length of each stage (game seconds): 1.10 s in all, her base attack interval is 1 / 0.9 = 1.11 s. */
export const BASE_TIMES = Object.freeze({ command: 0.12, extend: 0.24, strike: 0.14, reel: 0.3, settle: 0.3 });
export const BASE_TOTAL = BASE_TIMES.command + BASE_TIMES.extend + BASE_TIMES.strike + BASE_TIMES.reel + BASE_TIMES.settle;
/** The whole sequence uses at most this share of her attack interval (so the next attack finds the doll home). */
export const FILL = 0.92;
/** Floor: at high attack speed the stages shrink in proportion, never below this share of their base length. */
export const MIN_SCALE = 0.25;
/**
 * Early start: the doll sets off before her attack, from the tower's own cooldown (read only), so Extend ends on
 * the needle's projected hit instead of darting there in the ~0.1 s her fast needle takes. If the attack does not
 * come by the end of Extend, the doll hovers at most HOLD_MAX, then reels home; after such a miss it waits
 * EARLY_PAUSE before setting off early again.
 */
export const HOLD_MAX = 0.2;
export const EARLY_PAUSE = 0.6;
/** Command + Extend never take less than this (s), even when the sim's hit is due sooner. */
export const LEAD_MIN = 0.06;
/** How fast a strike that the sim's hit beat to it is pulled in (s). */
export const CATCH_UP = 0.08;
/** Where the doll clip's chop sits (s from the start of its attack clip). */
export const CHOP_AT = 0.25;
/** How far the doll glides at most (tiles from home), how short of the target it stops, its shortest glide. */
export const REACH = 1.3;
export const STOP = 0.35;
export const MIN_REACH = 0.7;
/** Glide speed used to size the glide to the time it has (tiles / s). */
export const GLIDE_SPEED = 5.5;
/** The arc: height and sideways bulge of the glide out (tiles at full reach); the reel bulges the other way. */
export const ARC_LIFT = 0.16;
export const ARC_SIDE = 0.24;
/** Command's pull-back (tiles) and the strike's lunge (tiles). */
export const PULL = 0.06;
export const LUNGE = 0.07;
/** The pendulum settle: amplitude (tiles), frequency (Hz), damping (1 / s). */
export const SWING = 0.11;
export const SWING_HZ = 2.6;
export const SWING_DAMP = 4;
/** Tilts (radians, + = leaning toward the target). */
export const TILT_COMMAND = -0.32;
export const TILT_EXTEND = 0.42;
export const TILT_STRIKE = 0.38;
export const TILT_REEL = -0.22;
export const TILT_SWING = 0.34;
/** Reduce motion: the doll stays home and only tilts, at this share. */
export const CALM_TILT = 0.5;

/**
 * The stage lengths for one attack (game seconds).
 * @param {number} interval her attack interval (1 / rate)
 * @param {number|null} eta seconds until the sim's hit lands (null: no hit to wait for, e.g. Dream Detour)
 * @param {object} [out]
 * @returns {{ command: number, extend: number, strike: number, reel: number, settle: number, lead: number, total: number, scale: number }}
 */
export function planStages(interval, eta, out = {}) {
  const budget = interval > 0 ? interval * FILL : BASE_TOTAL;
  const k = Math.max(MIN_SCALE, Math.min(1, budget / BASE_TOTAL));
  out.scale = k;
  out.command = BASE_TIMES.command * k;
  out.extend = BASE_TIMES.extend * k;
  out.strike = BASE_TIMES.strike * k;
  out.reel = BASE_TIMES.reel * k;
  out.settle = BASE_TIMES.settle * k;
  if (eta != null && eta >= 0) {
    const lead = out.command + out.extend;
    const want = Math.max(LEAD_MIN, eta);
    if (lead > want) {
      // the hit comes sooner than a full glide: Command and Extend shrink together to end on it
      const f = want / lead;
      out.command *= f;
      out.extend *= f;
    } else if (lead < want) {
      // a slow or far hit: the glide takes longer, as far as the interval allows
      const total = lead + out.strike + out.reel + out.settle;
      out.extend += Math.min(want - lead, Math.max(0, budget - total));
    }
  }
  // still longer than her interval at the floor (very high attack speed): no settle, so the doll rests between attacks
  if (out.command + out.extend + out.strike + out.reel + out.settle > budget) out.settle = 0;
  out.lead = out.command + out.extend;
  out.total = out.lead + out.strike + out.reel + out.settle;
  return out;
}

/** @returns {object} a doll hanging at home */
export function marionetteState() {
  return {
    stage: 'idle', u: 0, rate: 0, elapsed: 0, n: 0,
    plan: { command: 0, extend: 0, strike: 0, reel: 0, settle: 0, lead: 0, total: 0, scale: 1 },
    uid: null, tx: 0, ty: 0, tz: 0, // the target (world) and the enemy it is
    hx: 0, hy: 0, hz: 0, // home (world) at the last aim
    dirx: 0, dirz: 1, go: 0, side: 1, // toward the target, how far the glide goes, which side the arc bulges
    sx: 0, sy: 0, sz: 0, // strike point (offset)
    fx: 0, fy: 0, fz: 0, ft: 0, // where the sequence started (offset) and its tilt
    rx: 0, ry: 0, rz: 0, rt: 0, rk: 1, // where the reel started (offset), its tilt and string tension
    ox: 0, oy: 0, oz: 0, tilt: 0, taut: 0, flick: 0, // output: offset, tilt, string tension 0..1, bar flick 0..1
    early: false, hold: 0, missed: false, // set off early (no attack seen yet), time hovering at the end of Extend
    calm: false, simple: false, landed: false, clipAt: 0, clipOffset: 0, clipDue: false, clipFired: false,
  };
}

/** True while the doll is out (command, extend or strike): a new attack is skipped. */
export function marionetteBusy(s) {
  return s.stage === 'command' || s.stage === 'extend' || s.stage === 'strike';
}

/** True from the command to the end of the settle. */
export function marionetteActive(s) {
  return s.stage !== 'idle';
}

/**
 * Points the sequence at the target: direction, how far the glide goes (sized to the Extend time, capped at
 * REACH, STOP short of the target) and the strike point. Home (hx, hy, hz) is the doll's rest point this frame.
 */
export function aimMarionette(s, tx, ty, tz, hx, hy, hz) {
  s.tx = tx;
  s.ty = ty;
  s.tz = tz;
  s.hx = hx;
  s.hy = hy;
  s.hz = hz;
  const dx = tx - hx;
  const dz = tz - hz;
  const len = Math.hypot(dx, dz);
  if (len > 1e-6) {
    s.dirx = dx / len;
    s.dirz = dz / len;
  }
  const reach = s.calm ? 0 : Math.max(MIN_REACH, Math.min(REACH, s.plan.extend * GLIDE_SPEED));
  s.go = Math.max(0, Math.min(len - STOP, reach));
  const f = len > 1e-6 ? s.go / len : 0;
  s.sx = s.dirx * s.go;
  s.sz = s.dirz * s.go;
  // down toward the target's body as far as the glide goes, never below it
  s.sy = Math.max(-0.45, Math.min(0.1, (ty - hy) * f));
  return s;
}

/**
 * Starts an attack (the sim's 'attack' event). Skipped while the doll is out; from reel / settle it starts
 * again from where the doll is. @returns {boolean} started
 * @param {object} s marionetteState
 * @param {{ interval: number, eta?: number|null, tx: number, ty: number, tz: number, hx: number, hy: number, hz: number,
 *   uid?: number|null, calm?: boolean, simple?: boolean }} o
 */
export function startMarionette(s, o) {
  if (marionetteBusy(s)) return false;
  s.calm = !!o.calm;
  s.simple = !!o.simple;
  s.early = !!o.early;
  s.hold = 0;
  planStages(o.interval, o.eta ?? null, s.plan);
  s.n++;
  s.side = s.simple ? 0 : (s.n & 1 ? 1 : -1);
  s.uid = o.uid ?? null;
  s.fx = s.ox;
  s.fy = s.oy;
  s.fz = s.oz;
  s.ft = s.tilt;
  s.landed = false;
  s.elapsed = 0;
  // the doll clip's chop lands on the strike: it starts CHOP_AT before it (or right away, partway in)
  s.clipAt = Math.max(0, s.plan.lead - CHOP_AT);
  s.clipOffset = Math.min(0.2, Math.max(0, CHOP_AT - s.plan.lead));
  s.clipDue = false;
  s.clipFired = false;
  aimMarionette(s, o.tx, o.ty, o.tz, o.hx, o.hy, o.hz);
  enter(s, 'command');
  return true;
}

/** Follows the target while the doll is on its way (the enemy walks on); frozen from the strike. */
export function retargetMarionette(s, tx, ty, tz, hx, hy, hz) {
  if (s.stage !== 'command' && s.stage !== 'extend') return false;
  aimMarionette(s, tx, ty, tz, hx, hy, hz);
  return true;
}

/**
 * The target is gone before the strike. `next` ({ uid, x, y, z } or null): the enemy the needle flies on to
 * (by the dead one's last spot) — the doll follows it; none: the doll reels home from where it is.
 * After the strike nothing changes (it finishes and reels).
 * @returns {'retarget'|'reel'|'none'}
 */
export function loseTarget(s, next) {
  if (s.stage !== 'command' && s.stage !== 'extend') return 'none';
  s.hold = 0;
  if (next) {
    s.uid = next.uid ?? null;
    aimMarionette(s, next.x, next.y, next.z, s.hx, s.hy, s.hz);
    return 'retarget';
  }
  s.uid = null;
  s.rx = s.ox;
  s.ry = s.oy;
  s.rz = s.oz;
  s.rt = s.tilt;
  s.rk = s.taut;
  enter(s, 'reel');
  return 'reel';
}

/**
 * Her attack came while the doll is on its way after an early start: it now strikes the enemy her needle flies at
 * (call retargetMarionette with it), and the rest of Command + Extend is fitted to end on that needle's hit, `eta`
 * seconds away (null: as planned). @returns {boolean} adopted (false when the doll was not waiting for an attack)
 */
export function adoptAttack(s, eta = null) {
  if (!s.early || (s.stage !== 'command' && s.stage !== 'extend')) return false;
  s.early = false;
  s.hold = 0;
  if (eta == null) return true;
  const want = Math.max(1 / 240, eta);
  if (s.stage === 'command') {
    const leftC = (1 - s.u) / s.rate;
    const total = leftC + s.plan.extend;
    const f = want / Math.max(1e-6, total);
    s.rate = (1 - s.u) / Math.max(1e-6, leftC * f);
    s.plan.extend *= f;
  } else if (s.u < 1) {
    s.rate = (1 - s.u) / want;
  }
  return true;
}

/** The sim's hit has landed (her needle resolved): a strike still on its way is pulled in to it. */
export function landMarionette(s) {
  s.landed = true;
  if (s.stage === 'command') {
    // the rest of Command is skipped; Extend gets CATCH_UP
    s.plan.extend = Math.min(s.plan.extend, CATCH_UP);
    enter(s, 'extend');
    return true;
  }
  if (s.stage === 'extend') {
    const left = (1 - s.u) / s.rate;
    if (left > CATCH_UP) s.rate = (1 - s.u) / CATCH_UP;
    return true;
  }
  return false;
}

function enter(s, stage) {
  s.stage = stage;
  s.u = 0;
  const d = stage === 'idle' ? 0 : s.plan[stage];
  s.rate = d > 1e-6 ? 1 / d : Infinity;
}

const next = { command: 'extend', extend: 'strike', strike: 'reel', reel: 'settle', settle: 'idle' };

function smooth(u) {
  return u * u * (3 - 2 * u);
}

/**
 * One frame (game seconds). Writes the doll's offset from home (ox, oy, oz), its tilt, the strings' tension
 * (taut 0 = slack and sagging, 1 = straight) and the bar flick; sets clipDue once when the doll's attack clip
 * should start. @returns {object} s
 */
export function stepMarionette(s, dt) {
  if (s.stage === 'idle') {
    s.ox = s.oy = s.oz = 0;
    s.tilt = 0;
    s.taut = 0;
    s.flick = 0;
    return s;
  }
  s.elapsed += dt;
  if (!s.clipFired && s.elapsed >= s.clipAt) {
    s.clipFired = true;
    s.clipDue = true;
  }
  let left = dt;
  // a stage that ends inside this frame hands the rest of the frame to the next one
  for (let guard = 0; guard < 6 && s.stage !== 'idle'; guard++) {
    const room = (1 - s.u) / s.rate;
    if (left < room) {
      s.u += left * s.rate;
      break;
    }
    left -= room;
    s.u = 1;
    // set off early and her attack has not come: hover at the end of the glide a moment, then reel home
    if (s.stage === 'extend' && s.early) {
      s.hold += left;
      left = 0;
      if (s.hold < HOLD_MAX) break;
      s.early = false;
      s.uid = null;
      s.missed = true;
      s.rx = s.ox;
      s.ry = s.oy;
      s.rz = s.oz;
      s.rt = s.tilt;
      s.rk = s.taut;
      enter(s, 'reel');
      continue;
    }
    if (s.stage === 'strike') {
      s.rx = s.sx;
      s.ry = s.sy;
      s.rz = s.sz;
      s.rt = s.calm ? TILT_EXTEND * CALM_TILT : TILT_EXTEND;
      s.rk = 1;
    }
    enter(s, next[s.stage]);
  }
  pose(s);
  return s;
}

/** The pose of the current stage at its progress u. */
function pose(s) {
  const u = Math.min(1, Math.max(0, s.u));
  const calm = s.calm;
  const tk = calm ? CALM_TILT : 1;
  const bend = Math.min(1, s.go / REACH); // a short glide gets a flatter arc
  const px = -s.dirz * s.side;
  const pz = s.dirx * s.side;
  switch (s.stage) {
    case 'idle':
      s.ox = s.oy = s.oz = 0;
      s.tilt = s.taut = s.flick = 0;
      return;
    case 'command': {
      const b = Math.sin(Math.PI * u);
      const back = calm ? 0 : PULL * b;
      s.ox = s.fx - s.dirx * back;
      s.oz = s.fz - s.dirz * back;
      s.oy = s.fy + (calm ? 0 : 0.03 * b);
      s.tilt = s.ft * (1 - u) + TILT_COMMAND * tk * b;
      s.taut = 0.25 + 0.45 * u;
      s.flick = b;
      return;
    }
    case 'extend': {
      const e = smooth(u);
      const w = 1 - e;
      // quadratic Bézier from the start point over a lifted, sideways control point to the strike point
      const cx = (s.fx + s.sx) * 0.5 + px * ARC_SIDE * bend;
      const cz = (s.fz + s.sz) * 0.5 + pz * ARC_SIDE * bend;
      const cy = (s.fy + s.sy) * 0.5 + ARC_LIFT * bend;
      s.ox = w * w * s.fx + 2 * w * e * cx + e * e * s.sx;
      s.oz = w * w * s.fz + 2 * w * e * cz + e * e * s.sz;
      s.oy = w * w * s.fy + 2 * w * e * cy + e * e * s.sy;
      s.tilt = TILT_EXTEND * tk * e;
      s.taut = 0.7 + 0.25 * e;
      s.flick = 0;
      return;
    }
    case 'strike': {
      const b = Math.sin(Math.PI * u);
      const l = calm ? 0 : LUNGE * b;
      s.ox = s.sx + s.dirx * l;
      s.oz = s.sz + s.dirz * l;
      s.oy = s.sy - (calm ? 0 : 0.02 * b);
      s.tilt = (TILT_EXTEND + TILT_STRIKE * b) * tk;
      s.taut = 1;
      s.flick = 0;
      return;
    }
    case 'reel': {
      const e = smooth(u);
      const w = 1 - e;
      // home on the other side of the arc, a little lower: a loop, never the same line back
      const cx = s.rx * 0.5 - px * ARC_SIDE * 0.8 * bend;
      const cz = s.rz * 0.5 - pz * ARC_SIDE * 0.8 * bend;
      const cy = s.ry * 0.5 + ARC_LIFT * 0.35 * bend;
      s.ox = w * w * s.rx + 2 * w * e * cx;
      s.oz = w * w * s.rz + 2 * w * e * cz;
      s.oy = w * w * s.ry + 2 * w * e * cy;
      s.tilt = s.rt * w + TILT_REEL * tk * Math.sin(Math.PI * u);
      s.taut = s.rk + (0.35 - s.rk) * e;
      s.flick = 0;
      return;
    }
    case 'settle': {
      // a damped pendulum under the bar, past home and back, faded to rest by the end of the stage
      const t = u / s.rate;
      const env = Math.exp(-SWING_DAMP * t) * (1 - u);
      const sw = Math.sin(2 * Math.PI * SWING_HZ * t) * env;
      const a = calm || s.simple ? 0 : SWING * Math.max(0.6, bend);
      s.ox = -s.dirx * a * sw;
      s.oz = -s.dirz * a * sw;
      s.oy = a * 0.25 * sw * sw;
      s.tilt = -TILT_SWING * tk * sw * (calm || s.simple ? 0.4 : 1);
      s.taut = 0.35 * (1 - u);
      s.flick = 0;
      return;
    }
    default:
  }
}

/**
 * The point on a string at u (0 = the bar, 1 = the doll) between top a and bottom b, sagging below the straight
 * line by `sag` × its length × 4u(1-u) (none when taut). Writes [x, y, z] into out (a 3-array) at offset o.
 */
export function stringPoint(ax, ay, az, bx, by, bz, u, sag, out, o = 0) {
  const len = Math.hypot(bx - ax, by - ay, bz - az);
  out[o] = ax + (bx - ax) * u;
  out[o + 1] = ay + (by - ay) * u - sag * len * 4 * u * (1 - u);
  out[o + 2] = az + (bz - az) * u;
  return out;
}

/** How far a string sags (share of its length at the middle) for a tension 0..1. */
export const SAG = 0.09;
export function sagFor(taut) {
  return SAG * (1 - Math.max(0, Math.min(1, taut)));
}

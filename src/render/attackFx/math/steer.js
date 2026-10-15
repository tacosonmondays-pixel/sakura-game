// Kinematic steering for flying familiars (pure, no THREE, no allocation).
//
// A body flies along its heading like a little plane: it can only turn at `turnMax` rad/s and
// change speed at `aMax` tiles/s², so chasing a target draws loops instead of snapping. Every
// function works in game time and tiles; callers integrate with a fixed step (see drones.js)
// so the paths are identical at 30, 60 and 144 Hz.
//
// Body shape: { x, y, vx, vy, heading, speed, turn }  (heading 0 = +y, like tower facing)

const PI = Math.PI;
const TAU = PI * 2;

export function wrapAngle(a) {
  a = (a + PI) % TAU;
  if (a < 0) a += TAU;
  return a - PI;
}

/**
 * Steers the body toward a desired velocity and integrates one step.
 * Heading changes by at most `turnMax·dt`; speed by at most `aMax·dt`. Hard turns slow the
 * body down a little, which tightens the loop like a banking plane.
 */
export function steerToward(b, dvx, dvy, aMax, turnMax, dt) {
  const want = Math.sqrt(dvx * dvx + dvy * dvy);
  let target = 0;
  if (want > 1e-6) {
    const diff = wrapAngle(Math.atan2(dvx, dvy) - b.heading);
    const lim = turnMax * dt;
    const turn = diff > lim ? lim : diff < -lim ? -lim : diff;
    b.heading = wrapAngle(b.heading + turn);
    b.turn = dt > 0 ? turn / dt : 0;
    const rest = Math.abs(diff - turn);
    target = want * (rest > 1.2 ? 0.45 : 1 - (0.55 * rest) / 1.2);
  } else {
    b.turn = 0;
  }
  const ds = target - b.speed;
  const la = aMax * dt;
  b.speed += ds > la ? la : ds < -la ? -la : ds;
  if (b.speed < 0) b.speed = 0;
  b.vx = Math.sin(b.heading) * b.speed;
  b.vy = Math.cos(b.heading) * b.speed;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
}

/**
 * Desired velocity to arrive at (gx, gy) and stop there (or ride along a moving goal with
 * feed-forward velocity ffx, ffy). Writes out.x / out.y.
 */
export function arriveVelocity(b, gx, gy, vmax, aMax, out, ffx = 0, ffy = 0, gain = 4) {
  const dx = gx - b.x;
  const dy = gy - b.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  let s = Math.min(vmax, d * gain, Math.sqrt(aMax * d));
  let x = ffx;
  let y = ffy;
  if (d > 1e-6) {
    x += (dx / d) * s;
    y += (dy / d) * s;
  }
  s = Math.sqrt(x * x + y * y);
  if (s > vmax) {
    x *= vmax / s;
    y *= vmax / s;
  }
  out.x = x;
  out.y = y;
  return out;
}

/** Desired velocity straight at (gx, gy) at full speed. */
export function seekVelocity(b, gx, gy, vmax, out) {
  const dx = gx - b.x;
  const dy = gy - b.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 1e-6) {
    out.x = (dx / d) * vmax;
    out.y = (dy / d) * vmax;
  } else {
    out.x = 0;
    out.y = 0;
  }
  return out;
}

/** Clamps a goal point into the disc (cx, cy, R). Writes out.x / out.y. */
export function clampToDisc(x, y, cx, cy, R, out) {
  const dx = x - cx;
  const dy = y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 > R * R && d2 > 0) {
    const k = R / Math.sqrt(d2);
    out.x = cx + dx * k;
    out.y = cy + dy * k;
  } else {
    out.x = x;
    out.y = y;
  }
  return out;
}

/**
 * Hard leash: keeps the body inside the disc (cx, cy, L) and removes the outward part of its
 * velocity. @returns {boolean} true when the clamp fired
 */
export function leash(b, cx, cy, L) {
  const dx = b.x - cx;
  const dy = b.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 <= L * L) return false;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  b.x = cx + nx * L;
  b.y = cy + ny * L;
  const vr = b.vx * nx + b.vy * ny;
  if (vr > 0) {
    b.vx -= vr * nx;
    b.vy -= vr * ny;
    b.speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (b.speed > 1e-6) b.heading = Math.atan2(b.vx, b.vy);
  }
  return true;
}

/**
 * Separation push for body i against the others in `list[0..n)` (same owner): adds to out.x/y
 * a velocity bias away from neighbours closer than `radius` (strength in tiles/s at contact).
 */
export function separation(list, n, i, radius, strength, out) {
  const b = list[i];
  let sx = 0;
  let sy = 0;
  for (let j = 0; j < n; j++) {
    if (j === i) continue;
    const o = list[j];
    const dx = b.x - o.x;
    const dy = b.y - o.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    const d = Math.sqrt(d2) || 1e-3;
    const k = (1 - d / radius) * strength;
    // exact overlap: push sideways by index so twins split deterministically
    sx += d2 > 1e-8 ? (dx / d) * k : (i > j ? k : -k);
    sy += d2 > 1e-8 ? (dy / d) * k : 0;
  }
  out.x += sx;
  out.y += sy;
  return out;
}

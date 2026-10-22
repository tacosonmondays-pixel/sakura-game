// Pure maths for placed objects and thrown props (docs/ATTACK_FX.md "Placed objects and thrown
// props"): arcs, no-slip spin, bounce legs, squash, staggers and springs. No three.js, no DOM, no sim
// access, so every rule here is unit-tested in node (tests/render/placed-math.test.js).
//
// Positions follow the board: x = sim x, y = sim y (ground), h = height.

export const TAU = Math.PI * 2;

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Smoothstep of clamp01(v): 0 → 1 with zero slope at both ends. */
export function smooth01(v) {
  const k = clamp01(v);
  return k * k * (3 - 2 * k);
}

/** Ease-out with an overshoot (1 at k = 1, peaks a little above 1 before it). */
export function easeOutBack(k, s = 1.70158) {
  const t = clamp01(k) - 1;
  return 1 + (s + 1) * t * t * t + s * t * t;
}

/** Ease-out (quadratic). */
export function easeOut(k) {
  const t = clamp01(k);
  return 1 - (1 - t) * (1 - t);
}

/**
 * Overshoot pulse: 0 → peak at `at` → 1 (eased both ways), e.g. spikes rising 0 → 1.2 → 1.
 * @param {number} k 0..1 @param {number} peak value at `at` @param {number} at where the peak sits
 */
export function overshoot(k, peak = 1.2, at = 0.6) {
  const t = clamp01(k);
  if (t <= at) return peak * smooth01(t / at);
  return peak + (1 - peak) * smooth01((t - at) / (1 - at));
}

/** A jab: 1 → peak → 1 over [0, 1] (a fast rise, a softer fall). */
export function jab(k, peak = 1.35) {
  const t = clamp01(k);
  if (t >= 1) return 1;
  const up = 0.3;
  if (t < up) return 1 + (peak - 1) * smooth01(t / up);
  return peak + (1 - peak) * smooth01((t - up) / (1 - up));
}

/**
 * A point on a thrown arc from (x0, h0, y0) to (x1, h1, y1): straight on the ground, a parabola of
 * height `apex` above the straight line between the two heights. Writes out.x / out.y / out.h.
 */
export function arcPoint(k, x0, h0, y0, x1, h1, y1, apex, out) {
  const t = clamp01(k);
  out.x = x0 + (x1 - x0) * t;
  out.y = y0 + (y1 - y0) * t;
  out.h = h0 + (h1 - h0) * t + apex * 4 * t * (1 - t);
  return out;
}

/** Velocity along arcPoint per unit of k (multiply by 1 / duration for per-second). out.x/.y/.h */
export function arcVelocity(k, x0, h0, y0, x1, h1, y1, apex, out) {
  const t = clamp01(k);
  out.x = x1 - x0;
  out.y = y1 - y0;
  out.h = h1 - h0 + apex * 4 * (1 - 2 * t);
  return out;
}

/**
 * No-slip roll: a ball of radius r that travels dDist along the ground turns dDist / r radians.
 * @returns {number} the new spin angle (wrapped into [0, 2π))
 */
export function rollAngle(angle, dDist, r) {
  if (!(r > 0)) return angle;
  let a = angle + dDist / r;
  a %= TAU;
  if (a < 0) a += TAU;
  return a;
}

/** Turns a second at `speed` tiles a second for a ball of radius r (no slip). */
export function turnsPerSecond(speed, r) {
  return r > 0 ? speed / (TAU * r) : 0;
}

/** Height of a bounce leg: the parabola 4·H·u(1−u), 0 at both ends, H at the middle. */
export function bounceHeight(u, H) {
  const t = clamp01(u);
  return 4 * H * t * (1 - t);
}

/**
 * Progress along a leg whose target moves: u = flown / (flown + remaining). It never goes back
 * further than the caller lets it (the caller keeps the max), and it is 1 on arrival.
 */
export function legProgress(flown, remaining) {
  const f = Math.max(0, flown);
  const r = Math.max(0, remaining);
  return f + r > 1e-9 ? f / (f + r) : 1;
}

/**
 * Squash and stretch along one axis with the volume kept: { s: scale along the axis, w: across }.
 * s > 1 stretches, s < 1 squashes.
 */
export function volumeScale(s, out) {
  out.s = s;
  out.w = 1 / Math.sqrt(Math.max(0.05, s));
  return out;
}

/**
 * A landing squash: at t = 0 the body is `depth` squashed (scale y = 1 − depth), then it springs
 * back through a small stretch and settles by `dur`. Returns the y scale (1 = rest).
 */
export function landSquash(t, dur = 0.12, depth = 0.2) {
  if (!(t >= 0) || t >= dur) return 1;
  const k = t / dur;
  // a damped half-cosine: −depth → +depth/3 → 0
  return 1 - depth * Math.cos(k * Math.PI * 1.5) * (1 - k);
}

/** Local progress of item i in a staggered sequence (gap seconds apart, dur each), at time t. */
export function stagger(t, i, gap, dur) {
  return clamp01((t - i * gap) / Math.max(1e-6, dur));
}

/**
 * The pre-blast swell of a ball: 1 until `window` seconds before contact, then up to `peak` at
 * contact (time to contact ttc ≤ 0). Infinity / NaN → 1.
 */
export function swell(ttc, window = 0.08, peak = 1.25) {
  if (!(ttc < window)) return 1;
  return 1 + (peak - 1) * smooth01(1 - Math.max(0, ttc) / window);
}

/**
 * A damped spring stepped with semi-implicit Euler (x'' = −ω²(x − x₀) − 2ζωx'), dt clamped to 1/30.
 * @param {{ x: number, v: number }} s mutated @returns {number} s.x
 */
export function springStep(s, target, dt, w = 30, z = 0.5) {
  const h = Math.min(Math.max(dt, 0), 1 / 30);
  if (h <= 0) return s.x;
  s.v += (-w * w * (s.x - target) - 2 * z * w * s.v) * h;
  s.x += s.v * h;
  return s.x;
}

/** Shortest signed angle from a to b (radians, in (−π, π]). */
export function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

/** Turns `a` toward `b` by at most `maxStep` radians. */
export function turnToward(a, b, maxStep) {
  const d = angleDelta(a, b);
  if (Math.abs(d) <= maxStep) return b;
  return a + Math.sign(d) * maxStep;
}

/**
 * Scan sweep of a sentry head: ±amp around `base` at `hz`, pausing `pause` seconds at each end.
 * Pure function of time (the same sweep at every frame rate).
 */
export function scanYaw(t, base, amp = 0.61, hz = 0.5, pause = 0.3) {
  const half = 0.5 / hz; // one side to the other
  const move = Math.max(1e-3, half - pause);
  const period = 2 * half;
  let u = t % period;
  if (u < 0) u += period;
  // 0..half: −amp → +amp (move, then pause); half..period: back
  if (u < half) {
    const k = Math.min(1, u / move);
    return base - amp + 2 * amp * smooth01(k);
  }
  const k = Math.min(1, (u - half) / move);
  return base + amp - 2 * amp * smooth01(k);
}

/** Which of n plates laid along a line (spacing apart, centred on cx, cy, along dx, dy) is nearest (px, py). */
export function nearestPlate(px, py, cx, cy, dx, dy, n, spacing) {
  const along = (px - cx) * dx + (py - cy) * dy;
  const i = Math.round(along / spacing + (n - 1) / 2);
  return i < 0 ? 0 : i >= n ? n - 1 : i;
}

/** Number of spike rows still up on a strip with `left` of `max` hits (ceil, at least 1 while any hit is left). */
export function rowsLeft(left, max, rows) {
  if (!(left > 0)) return 0;
  if (!(max > 0)) return rows;
  return Math.max(1, Math.min(rows, Math.ceil((left / max) * rows)));
}

/** Seeded display randomness per uid and counter (never Math.random): a value in [0, 1). */
export function hash01(uid, n = 0) {
  let h = (Math.imul((uid | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(n | 0, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

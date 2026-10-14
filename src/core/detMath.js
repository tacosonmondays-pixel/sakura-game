// Deterministic Math for co-op battles and the map builder. Lockstep needs both clients to compute bit-identical
// states, but ECMAScript does not require Math.sin / cos / atan2 / hypot … to be correctly
// rounded, so V8 (Chrome, Android), JavaScriptCore (iPhone Safari) and SpiderMonkey (Firefox)
// may differ in the last bit — enough to flip a range check hours into a battle. The sim
// (src/sim, shared with single player and other teams) calls Math.* directly, so instead of
// editing it, the co-op layer runs every Sim call inside withDetMath(): for that synchronous
// stretch the transcendental functions are swapped for the ports below, built only from + − × ÷
// and Math.sqrt, which IEEE-754 does fix to the bit on every engine. (The `**` operator cannot
// be swapped: the sim only uses it for squares, x ** 2 === x * x on every engine, and the wave
// generator raises to whole powers with powInt() in src/sim/waves.js instead.)
//
// The map builder (src/core/track.js, src/data/maps.js) calls DET_MATH directly: map geometry is
// computed when the game loads, outside any withDetMath() stretch, and must come out bit-identical
// on every engine too (iPhone Safari and desktop Chrome built different road samples, so the co-op
// lobby's data hash refused to pair them).
//
// sin / cos / atan / atan2 follow FreeBSD msun (fdlibm): same polynomial kernels, ~1 ulp.

const PIO2_1 = 1.57079632673412561417e+00; // first 33 bits of π/2
const PIO2_1T = 6.07710050650619224932e-11; // π/2 − PIO2_1
const INVPIO2 = 6.36619772367581382433e-01; // 2/π
const PI = 3.1415926535897931160e+00;
const PI_LO = 1.2246467991473531772e-16;

const S1 = -1.66666666666666324348e-01;
const S2 = 8.33333333332248946124e-03;
const S3 = -1.98412698298579493134e-04;
const S4 = 2.75573137070700676789e-06;
const S5 = -2.50507602534068634195e-08;
const S6 = 1.58969099521155010221e-10;

const C1 = 4.16666666666666019037e-02;
const C2 = -1.38888888888741095749e-03;
const C3 = 2.48015872894767294178e-05;
const C4 = -2.75573143513906633035e-07;
const C5 = 2.08757232129817482790e-09;
const C6 = -1.13596475577881948265e-11;

/** sin on [−π/4, π/4] (msun k_sin.c, y = 0). */
function kSin(x) {
  const z = x * x;
  const w = z * z;
  const r = S2 + z * (S3 + z * S4) + z * w * (S5 + z * S6);
  const v = z * x;
  return x + v * (S1 + z * r);
}

/** cos on [−π/4, π/4] (msun k_cos.c, y = 0). */
function kCos(x) {
  const z = x * x;
  let w = z * z;
  const r = z * (C1 + z * (C2 + z * C3)) + w * w * (C4 + z * (C5 + z * C6));
  const hz = 0.5 * z;
  w = 1.0 - hz;
  return w + (((1.0 - w) - hz) + z * r);
}

/**
 * x = n·π/2 + r with |r| ≤ ~π/4 (Cody–Waite, two-part π/2: exact enough for |x| < 2^19,
 * far beyond any angle the sim uses). @returns {[number, number]} [n mod 4, r]
 */
function reduce(x) {
  const n = Math.floor(x * INVPIO2 + 0.5);
  const r = (x - n * PIO2_1) - n * PIO2_1T;
  return [((n % 4) + 4) % 4, r];
}

export function sin(x) {
  x = +x;
  if (!Number.isFinite(x)) return NaN;
  if (Math.abs(x) <= 0.7853981633974483) return x === 0 ? x : kSin(x);
  const [n, r] = reduce(x);
  switch (n) {
    case 0: return kSin(r);
    case 1: return kCos(r);
    case 2: return -kSin(r);
    default: return -kCos(r);
  }
}

export function cos(x) {
  x = +x;
  if (!Number.isFinite(x)) return NaN;
  if (Math.abs(x) <= 0.7853981633974483) return kCos(x);
  const [n, r] = reduce(x);
  switch (n) {
    case 0: return kCos(r);
    case 1: return -kSin(r);
    case 2: return -kCos(r);
    default: return kSin(r);
  }
}

export function tan(x) {
  return sin(x) / cos(x);
}

const ATANHI = [4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00];
const ATANLO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const AT = [
  3.33333333333329318027e-01, -1.99999999998764832476e-01, 1.42857142725034663711e-01, -1.11111104054623557880e-01,
  9.09088713343650656196e-02, -7.69187620504482999495e-02, 6.66107313738753120669e-02, -5.83357013379057348645e-02,
  4.97687799461593236017e-02, -3.65315727442169155270e-02, 1.62858201153657823623e-02,
];

/** msun s_atan.c */
export function atan(x) {
  x = +x;
  if (Number.isNaN(x)) return NaN;
  const neg = x < 0 || Object.is(x, -0);
  let a = Math.abs(x);
  if (a >= 7.378697629483821e19) return neg ? -(ATANHI[3] + ATANLO[3]) : ATANHI[3] + ATANLO[3]; // 2^66
  let id;
  if (a < 0.4375) {
    if (a < 7.450580596923828e-9) return x; // 2^-27
    id = -1;
  } else if (a < 1.1875) {
    if (a < 0.6875) {
      id = 0;
      a = (2.0 * a - 1.0) / (2.0 + a);
    } else {
      id = 1;
      a = (a - 1.0) / (a + 1.0);
    }
  } else if (a < 2.4375) {
    id = 2;
    a = (a - 1.5) / (1.0 + 1.5 * a);
  } else {
    id = 3;
    a = -1.0 / a;
  }
  const z = a * a;
  const w = z * z;
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  if (id < 0) return (neg ? -1 : 1) * (a - a * (s1 + s2));
  const r = ATANHI[id] - ((a * (s1 + s2) - ATANLO[id]) - a);
  return neg ? -r : r;
}

/** msun e_atan2.c (same special cases; the exponent test is done on the ratio). */
export function atan2(y, x) {
  y = +y;
  x = +x;
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
  if (x === 1) return atan(y);
  const yNeg = y < 0 || Object.is(y, -0);
  const xNeg = x < 0 || Object.is(x, -0);
  const m = (yNeg ? 1 : 0) | (xNeg ? 2 : 0);
  if (y === 0) {
    if (m === 0 || m === 1) return y; // atan(±0, +anything) = ±0
    return m === 2 ? PI : -PI; // atan(±0, −anything) = ±π
  }
  if (x === 0) return yNeg ? -PI / 2 : PI / 2;
  if (!Number.isFinite(x)) {
    if (!Number.isFinite(y)) {
      const q = PI / 4;
      return [q, -q, 3 * q, -3 * q][m];
    }
    return [0, -0, PI, -PI][m];
  }
  if (!Number.isFinite(y)) return yNeg ? -PI / 2 : PI / 2;
  const ratio = Math.abs(y / x);
  let a;
  if (ratio > 1.152921504606847e18) a = PI / 2 + 0.5 * PI_LO; // |y/x| > 2^60
  else if (xNeg && ratio < 8.673617379884035e-19) a = 0; // |y|/x < −2^−60
  else a = atan(ratio);
  switch (m) {
    case 0: return a;
    case 1: return -a;
    case 2: return PI - (a - PI_LO);
    default: return (a - PI_LO) - PI;
  }
}

export function asin(x) {
  x = +x;
  if (!(Math.abs(x) <= 1)) return NaN;
  return atan2(x, Math.sqrt((1 - x) * (1 + x)));
}

export function acos(x) {
  x = +x;
  if (!(Math.abs(x) <= 1)) return NaN;
  return atan2(Math.sqrt((1 - x) * (1 + x)), x);
}

/** √(a² + b² + …): IEEE sqrt of IEEE sums is bit-exact everywhere (Math.hypot is not). */
export function hypot(a, b, ...rest) {
  if (rest.length === 0) {
    const x = +a || 0;
    const y = +b || 0;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return Math.abs(x) === Infinity || Math.abs(y) === Infinity ? Infinity : NaN;
    return Math.sqrt(x * x + y * y);
  }
  let s = 0;
  for (const v of [a, b, ...rest]) {
    const n = +v;
    if (Math.abs(n) === Infinity) return Infinity;
    s += n * n;
  }
  return Math.sqrt(s);
}

export const DET_MATH = Object.freeze({ sin, cos, tan, atan, atan2, asin, acos, hypot });
const NAMES = Object.keys(DET_MATH);
const saved = {};
let depth = 0;

/**
 * Runs fn() with Math's transcendental functions swapped for the deterministic ports above
 * (nesting is fine). Synchronous only: nothing else can run in between, and the originals are
 * always restored.
 * @template T @param {() => T} fn @returns {T}
 */
export function withDetMath(fn) {
  if (depth++ === 0) {
    for (const k of NAMES) {
      saved[k] = Math[k];
      Math[k] = DET_MATH[k];
    }
  }
  try {
    return fn();
  } finally {
    if (--depth === 0) for (const k of NAMES) Math[k] = saved[k];
  }
}

/** True while withDetMath() is running (tests). */
export function detMathActive() {
  return depth > 0;
}

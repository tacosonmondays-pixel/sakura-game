// The shared toon core (docs/VFX.md "Toon core"; display only). The tornado's fragment ideas, lifted out so every
// eroding-shape effect draws in the same house look: GLSL chunks (plain strings, no imports, nothing to resolve) and
// the small painters and tier helpers that feed them. A family builds its own vertex shader (rings, a crown, droplets,
// a ground ring) and its fragment shader from these pieces:
//
//   - noise:  two painted octave sets (R, G) sampled twice and pushed through a smoothstep: fewer, bolder tongues;
//             plus two optional baked channels, Worley F2 − F1 cells (B) and a domain-warped swirl (A)
//   - erosion: heat = band × (0.3 + n); a threshold `cut` rising with age; a hard step (0 or 1, no soft fringe, no
//             discard): a shape leaves by eroding, never by a plain fade
//   - ramp:   heat above the cut indexes a few flat bands (an 8-texel NearestFilter ramp); the darkest band sits where
//             heat − cut is small, the edge of every eroded shape, so every shape gets its own dark ink rim
//   - alpha:  the fade in over the first 10 % of an age and out over the last 18 %; young shapes (walker height) cover
//             little; the two blends: cover (premultiplied over, every band in its own colour) and add + light body
//   - tiers:  high draws more shapes, each sparser (`toonSparse`, the mask only, never the colour index); cover / add
//   - Reduce Motion: shapes hold still (`toonHold`: no turn, sway or scroll; `TOON_REDUCE`: slower, dimmer lives),
//             and in shaders whose motion runs on the GPU the `uStill` hold
//
// Credits (licence texts, with their authors and copyright notices, in public/licenses/):
//   - toonCellular (the Worley F2 − F1 channel) is a JavaScript port of cellular2D.glsl from webgl-noise (MIT), made
//     periodic so the painted channel tiles.  → webgl-noise-MIT.txt
//   - the swirl channel is the domain warp f(p) = fbm(p + 4·r), r = fbm2(p + 4·q), q = fbm2(p), from a "domain warping"
//     article whose code snippets are under the MIT license.  → domain-warp-MIT.txt
// Everything else here is the tornado's own maths (src/render/vfx/tornado.js), moved without a change.

/** Size of the painted noise texture (texels a side). */
export const TOON_NOISE_N = 128;
/** Texels a ramp row: bands are spread evenly across it (NearestFilter: flat steps). */
export const TOON_RAMP_W = 8;
/** How far heat above the cut walks along the ramp (k = (heat − cut) × TOON_SLOPE). */
export const TOON_SLOPE = 1.6;
/** The band at k ≥ TOON_HOT is the hot one: pure added light on the add blend, the HDR boost on high with bloom. */
export const TOON_HOT = 0.8;
/**
 * High draws more shapes than medium, so each one is sparser: its threshold starts this much higher × (1 − medium's
 * count ÷ high's), the same for every shape of the tier (a uniform). The mask only, never the colour index.
 */
export const TOON_SPARSE_ERODE = 0.32;
/** Reduce Motion: lives this much longer (a slower rise) and this much dimmer. */
export const TOON_REDUCE = Object.freeze({ life: 2.2, alpha: 0.7 });

/** The tier's sparser erosion: (1 − base ÷ count) × k, never below 0 (medium and low: 0). */
export function toonSparse(count, base, k = TOON_SPARSE_ERODE) {
  return Math.max(0, 1 - base / count) * k;
}

/** Reduce Motion hold: 0 for anything that turns, sways or scrolls; the value as given otherwise. */
export function toonHold(reduceMotion, v) {
  return reduceMotion ? 0 : v;
}

/** Reduce Motion scales for a whole effect: { life, alpha, move } (move 0 = held still). */
export function toonMotion(reduceMotion) {
  return reduceMotion ? { life: TOON_REDUCE.life, alpha: TOON_REDUCE.alpha, move: 0 } : { life: 1, alpha: 1, move: 1 };
}

/** smoothstep, as GLSL has it (the JS mirrors below and the tests). */
export function toonSmooth(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** JS mirror of toonFade(): in over the first 10 % of an age, out over the last 18 %. */
export function toonFadeAt(age) {
  return toonSmooth(0, 0.1, age) * (1 - toonSmooth(0.82, 1, age));
}

// ------------------------------------------------------------------------------------------------ painters

/** Integer hash → [0, 1) (the tornado's: a few multiplies, the same on every engine). */
export function toonHash(x, y, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Tileable value noise at (x, y) with an integer period, smooth (cubic) between the lattice points. */
function valueNoise(x, y, period, s) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let fx = x - xi;
  let fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const w = (i) => ((i % period) + period) % period;
  const a = toonHash(w(xi), w(yi), s);
  const b = toonHash(w(xi + 1), w(yi), s);
  const c = toonHash(w(xi), w(yi + 1), s);
  const d = toonHash(w(xi + 1), w(yi + 1), s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Tileable fBm over the unit tile (u, v in tile units): `oct` octaves from `base` cells a side. */
export function toonFbm(u, v, base, oct, s) {
  let sum = 0;
  let amp = 0.5;
  let tot = 0;
  for (let o = 0; o < oct; o++) {
    const p = base << o;
    sum += valueNoise(u * p, v * p, p, s + o) * amp;
    tot += amp;
    amp *= 0.5;
  }
  return sum / tot;
}

const mod289 = (x) => x - Math.floor(x * (1 / 289)) * 289;
const mod7 = (x) => x - Math.floor(x * (1 / 7)) * 7;
const permute = (x) => mod289((34 * x + 10) * x);

/**
 * Cellular ("Worley") noise in 2D: [F1, F2], the distances to the nearest and the second nearest feature point.
 * A port of cellular2D.glsl (webgl-noise, MIT; see the header), with the cell lattice wrapped to
 * `period` cells so the result tiles. Same 3 × 3 search window and jitter as the original.
 */
export function toonCellular(x, y, period = 0) {
  const K = 0.142857142857; // 1/7
  const Ko = 0.428571428571; // 3/7
  const jitter = 1.0;
  const wrap = (i) => (period > 0 ? ((i % period) + period) % period : mod289(i));
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  let f1 = Infinity;
  let f2 = Infinity;
  for (let i = -1; i <= 1; i++) {
    const px = permute(wrap(ix + i));
    for (let j = -1; j <= 1; j++) {
      const p = permute(px + wrap(iy + j));
      const ox = (p * K - Math.floor(p * K)) - Ko;
      const oy = mod7(Math.floor(p * K)) * K - Ko;
      // (cellular2D: dx = Pf.x - (i + 0.5) + jitter·ox for the columns i = -1, 0, 1; dy likewise with `of`)
      const dx = fx - (i + 0.5) + jitter * ox;
      const dy = fy - (j + 0.5) + jitter * oy;
      const d = dx * dx + dy * dy;
      if (d < f1) {
        f2 = f1;
        f1 = d;
      } else if (d < f2) f2 = d;
    }
  }
  return [Math.sqrt(f1), Math.sqrt(f2)];
}

/**
 * The domain-warped swirl at (u, v) in tile units, 0..1: fbm(p + w·r), r = fbm2(p + w·q), q = fbm2(p) (the article's
 * domain warp; see the header). The warp is itself periodic, so the swirl tiles like the noise under it.
 */
export function toonSwirlAt(u, v, base = 3, seed = 23, w = 0.22) {
  const f = (a, b, s) => toonFbm(a, b, base, 3, s);
  const qx = f(u, v, seed);
  const qy = f(u + 0.37, v + 0.71, seed + 5);
  const rx = f(u + w * qx + 0.11, v + w * qy + 0.53, seed + 9);
  const ry = f(u + w * qx + 0.83, v + w * qy + 0.29, seed + 13);
  return f(u + w * rx, v + w * ry, seed + 17);
}

/**
 * The noise texture (RGBA bytes, n × n, tileable), painted once: no image files.
 *   R: value-noise fBm, base 4 cells × 3 octaves; G: base 8 × 2 (the tornado's two octave sets)
 *   B: Worley F2 − F1 at `cells` cells a side (0: none, the channel stays 0): 0 on a cell's edge, bright in its middle
 *   A: the domain-warped swirl (`swirl`: true), else 255
 * With no options it is exactly the tornado's texture.
 */
export function paintToonNoise(n = TOON_NOISE_N, seed = 7, { cells = 0, swirl = false } = {}) {
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n;
      const v = y / n;
      const i = (y * n + x) * 4;
      data[i] = Math.round(toonFbm(u, v, 4, 3, seed) * 255);
      data[i + 1] = Math.round(toonFbm(u, v, 8, 2, seed + 11) * 255);
      if (cells > 0) {
        const [f1, f2] = toonCellular(u * cells, v * cells, cells);
        data[i + 2] = Math.round(Math.min(1, (f2 - f1) * 1.6) * 255);
      } else data[i + 2] = 0;
      data[i + 3] = swirl ? Math.round(toonSwirlAt(u, v, 3, seed + 29) * 255) : 255;
    }
  }
  return data;
}

/**
 * Ramp rows (RGBA bytes, `width` × rows.length): each row's bands spread evenly (flat steps), sRGB hex exactly as
 * drawn, painted as sRGB bytes (the texture is decoded once, on the GPU). `gains` (optional, coolest → hottest) scales
 * each band in display bytes, clamped: the hottest band takes the last gain whatever the ramp's length.
 * @param {{ bands: string[], gains?: number[] }[]} rows
 */
export function paintToonRamp(rows, width = TOON_RAMP_W) {
  const data = new Uint8Array(width * rows.length * 4);
  rows.forEach(({ bands, gains = null }, r) => {
    for (let x = 0; x < width; x++) {
      const band = Math.min(bands.length - 1, Math.floor((x / width) * bands.length));
      const hex = bands[band].replace('#', '');
      const rgb = [0, 2, 4].map((o) => parseInt(hex.slice(o, o + 2), 16));
      const g = gains ? gains[Math.round((band / Math.max(1, bands.length - 1)) * (gains.length - 1))] : 1;
      const i = (r * width + x) * 4;
      data[i] = Math.min(255, Math.round(rgb[0] * g));
      data[i + 1] = Math.min(255, Math.round(rgb[1] * g));
      data[i + 2] = Math.min(255, Math.round(rgb[2] * g));
      data[i + 3] = 255;
    }
  });
  return data;
}

// ------------------------------------------------------------------------------------------------ GLSL chunks

/** Noise: the house noise (R + G, bolder), the Worley cells (B), the swirl (A) and a polar twirl. */
export const TOON_NOISE = /* glsl */`
// [toon core] noise: R (85 %) at the uv, G (15 %) at a second scale and drift, pushed through a smoothstep (fewer,
// bolder tongues). Whole-number uv scales round a ring wrap seamlessly (the texture tiles).
float toonNoise(sampler2D tex, vec2 uv, float drift) {
  float n = texture2D(tex, uv).r * 0.85 + texture2D(tex, uv * vec2(2.0, 1.7) + vec2(0.37, drift)).g * 0.15;
  return smoothstep(0.25, 0.75, n);
}
// [toon core] Worley F2 - F1 (B, painted with cells > 0): 0 on a cell's edge, bright in its middle (foam, bubbles)
float toonCells(sampler2D tex, vec2 uv) {
  return texture2D(tex, uv).b;
}
// [toon core] swirl: the uv pushed along the painted domain-warp field (A, painted with swirl: true) by amount
vec2 toonSwirl(sampler2D tex, vec2 uv, float amount) {
  float a = texture2D(tex, uv).a * 6.2831853;
  return uv + amount * vec2(cos(a), sin(a));
}
// [toon core] polar twirl round the origin: the angle turns by turns x 2pi at the middle, 0 at radius 1 and beyond
vec2 toonTwirl(vec2 p, float turns) {
  float a = turns * 6.2831853 * (1.0 - min(length(p), 1.0));
  float c = cos(a), s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}
`;

/** Erosion: heat from a band profile and the noise, a threshold rising with age, a hard step. */
export const TOON_ERODE = /* glsl */`
// [toon core] heat: the band profile (0 at a shape's edges, 1 in its middle) lifted by the noise
float toonHeat(float band, float n) {
  return band * (0.3 + 1.0 * n);
}
// [toon core] the erosion threshold, young -> old (a young shape is whole, an old one breaks into tongues, then wisps)
float toonCut(vec2 erode, float age) {
  return mix(erode.x, erode.y, age);
}
// [toon core] the hard toon edge: in or out, no soft fringe and no discard (the mask multiplies the colour)
float toonMask(float heat, float cut) {
  return step(cut, heat);
}
`;

/** Ramp: heat above the cut → a few flat bands; the darkest band is the ink rim, the hottest the light. */
export const TOON_RAMP = /* glsl */`
// [toon core] the ramp index: heat above the cut x 1.6 (TOON_SLOPE) x a gain (the camera-facing arc brighter); the
// darkest band sits where heat - cut is small, the edge of every shape: its own dark ink rim
float toonIndex(float above, float gain) {
  return clamp(above * 1.6, 0.0, 0.999) * gain;
}
// [toon core] the same with a family's own slope (a thicker or thinner ink rim)
float toonIndexS(float above, float slope, float gain) {
  return clamp(above * slope, 0.0, 0.999) * gain;
}
vec3 toonRamp(sampler2D ramp, float k, float row) {
  return texture2D(ramp, vec2(k, row)).rgb;
}
// [toon core] the hot band (k >= 0.8, TOON_HOT): pure added light on the add blend, the HDR boost on high with bloom
float toonHot(float k) {
  return step(0.8, k);
}
`;

/** Alpha shaping and the two blends (premultiplied: One, OneMinusSrcAlpha). */
export const TOON_ALPHA = /* glsl */`
// [toon core] in over the first 10 % of an age, out over the last 18 % (the shape is already eroding away)
float toonFade(float age) {
  return smoothstep(0.0, 0.1, age) * (1.0 - smoothstep(0.82, 1.0, age));
}
// [toon core] readability: young shapes (low, where the walkers are) cover little
float toonYoung(float age) {
  return smoothstep(0.12, 0.45, age);
}
// [toon core] cover (high): a toon layer over the board in its own colour (stacked shapes settle on the ramp colour)
vec4 toonCover(vec3 col, float A) {
  return vec4(col * A, A);
}
// [toon core] add + light body (medium, low): the colour added x strength, the cooler bands covering a little (body)
vec4 toonAdd(vec3 col, float a, float strength, float body) {
  return vec4(col * a * strength, a * body);
}
`;

/** Tier switches every family shares (uniforms; set from the tier on the CPU). */
export const TOON_TIER = /* glsl */`
uniform float uSparse; // [toon core] the tier's sparser erosion (high): the mask only, never the colour
uniform float uCover;  // [toon core] 1 on high: every band covers the board in its own colour
`;

/** Reduce Motion hold for motion that runs in a shader (uStill 1: no scroll, no turn; erosion and fades still run). */
export const TOON_MOTION = /* glsl */`
uniform float uStill; // [toon core] 1 under Reduce Motion
float toonMove(float v) {
  return v * (1.0 - uStill);
}
`;

/** The fragment helpers in the order a shader includes them (after its own uniforms and varyings). */
export const TOON_CORE = [TOON_NOISE, TOON_ERODE, TOON_RAMP, TOON_ALPHA].join('');

/** Every chunk by name (the tests hash them: a change here is a change in every family's look). */
export const TOON_CHUNKS = Object.freeze({ TOON_NOISE, TOON_ERODE, TOON_RAMP, TOON_ALPHA, TOON_TIER, TOON_MOTION });

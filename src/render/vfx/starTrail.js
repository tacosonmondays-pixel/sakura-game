// Star trail VFX (docs/VFX.md "Star trail"; display only, not wired into the game yet). A shooting star flies a known
// curve and lands: a concave 4-point star with its halo and axis flares, a soft iridescent ribbon behind it, a crescent
// riding just ahead, then a swell and a ring of glassy shards. Hand-written: no particle library, no image files.
//
//   const trail = createStarTrail({ parent, quality, reduceMotion, rand });
//   trail.setView(w, h)                                 // the host's view in its own units (the recruit: CSS px)
//   trail.launch('prism', [x0, y0], [x1, y1], { onLand, accent })
//   trail.update(dt)                                    // the host's visual-clock dt, once a frame, before it renders
//   trail.stats()  →  { calls, meshes, joints, sprites, fragArea, screens, peakScreens, phase, alive }
//   trail.dispose()
//
// Scene-agnostic: everything is drawn in the parent's local XY plane (z = 0), in the host's units, either way up (the
// recruit host uses an orthographic camera in CSS px with y down). Two draw calls while a star is up, none otherwise:
//   1. the ribbon: one triangle strip (2 vertices a joint). Its joints are sampled backwards in time along the known
//      flight curve (a quadratic Bézier, eased), so there is no history buffer: a tap that jumps to the landing, a held
//      frame or a stepped capture clock all draw the exact ribbon for that moment. The fragment shader draws the body:
//      a core gaussian plus a wide gaussian glow (the "blur", with no blur pass), a thin-film hue band at the edges
//      looked up in a painted ramp along and across the strip, up to 3 mirrored waving strands (≥ 1 CSS px wide through
//      fwidth) and the tail fade.
//   2. the sprites: one instanced quad, an SDF per instance: STAR4 (concave, fwidth anti-aliased), FLARE (the star's
//      axis flares, separate stretched instances so the star's own quad stays small), GLOW (a clamped halo), CRESCENT
//      (ahead of the head) and SHARD (the landing burst's kites, one glassy edge).
// Both end with the shared soft-shoulder tone curve (tone.js) and write premultiplied light with alpha = max(rgb)
// (blend One, OneMinusSrcAlpha): a light term then covers what is behind it by its own brightness, so the canvas never
// holds a colour brighter than its alpha (undefined on a premultiplied canvas), and overlaps roll off instead of
// stacking to white.
//
// Buffers are sized once for the high tier and written in place every frame: no allocation per frame, no growth.
// Randomness: the stream the host hands in (createVisualRandom fork), drawn at launch only; never Math.random.
// Time: only the dt the host passes (never performance.now).
import * as THREE from 'three';
import { TONE_GLSL } from './tone.js';
import { createVisualRandom, visualSeed } from './random.js';
import {
  STAR_TRAIL_PRESETS, STAR_TRAIL_TIERS, STAR_TRAIL_CALM, MAX_JOINTS, MAX_SPRITES, MAX_SHARDS, MAX_STRANDS,
  RAMP_W, RAMP_ROWS, accentTint,
} from './starTrailPresets.js';

/** Sprite shapes (the instance's shape id). */
export const SHAPE = Object.freeze({ STAR4: 0, GLOW: 1, CRESCENT: 2, SHARD: 3, FLARE: 4 });
/** The halo quad never grows past this share of the view's short side (fragment budget). */
export const HALO_CAP = 0.2;
/** …nor at the top of the landing swell. */
export const HALO_SWELL_CAP = 0.26;

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const easeOutCubic = (t) => {
  const u = 1 - clamp01(t);
  return 1 - u * u * u;
};

/**
 * The flight's ease: half smoothstep, half ease-out cubic. It leaves already moving (speed 1.5× the average, so the
 * ribbon unrolls at once), never stops on the way, and settles onto the landing with zero speed.
 */
export function flightEase(t) {
  const x = clamp01(t);
  const u = 1 - x;
  return 0.5 * (x * x * (3 - 2 * x)) + 0.5 * (1 - u * u * u);
}

/**
 * A point on the flight curve: a quadratic Bézier from → to whose control point sits off the chord's middle by
 * bend × the chord's length (positive bend: to the chord's left, turning (dx, dy) by +90°). @param {number} s 0..1
 * @param {number[]} out [x, y] (written, returned)
 */
export function flightPoint(from, to, bend, s, out) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const cx = from[0] + dx * 0.5 - dy * bend;
  const cy = from[1] + dy * 0.5 + dx * bend;
  const u = 1 - s;
  out[0] = u * u * from[0] + 2 * u * s * cx + s * s * to[0];
  out[1] = u * u * from[1] + 2 * u * s * cy + s * s * to[1];
  return out;
}

/** The curve's unit direction at s (the chord's for a zero-length curve). @param {number[]} out [x, y] */
export function flightTangent(from, to, bend, s, out) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const cx = from[0] + dx * 0.5 - dy * bend;
  const cy = from[1] + dy * 0.5 + dx * bend;
  let tx = 2 * (1 - s) * (cx - from[0]) + 2 * s * (to[0] - cx);
  let ty = 2 * (1 - s) * (cy - from[1]) + 2 * s * (to[1] - cy);
  let l = Math.hypot(tx, ty);
  if (l < 1e-9) {
    tx = dx;
    ty = dy;
    l = Math.hypot(tx, ty);
  }
  if (l < 1e-9) {
    out[0] = 1;
    out[1] = 0;
  } else {
    out[0] = tx / l;
    out[1] = ty / l;
  }
  return out;
}

const hexBytes = (hex) => {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  return [0, 2, 4].map((o) => parseInt(h.slice(o, o + 2), 16));
};

/**
 * The 64×4 hue ramp: one row per preset (rows past the presets repeat the first), the preset's 4 stops spread round
 * the row as a loop (stop k at texel 64·k/4, linear between them, the last back to the first), so the shader's hue
 * lookup wraps with no seam.
 *
 * Colour space (decided here): the bytes are the stops' sRGB display bytes, unconverted, and the texture is uploaded
 * with no colour space (THREE.NoColorSpace: never decoded to linear). The star trail composes in display space from
 * start to finish: a ShaderMaterial gets no output conversion from three by itself, and the host's canvas is
 * composited by the browser in sRGB, so what the presets say is what reaches the screen, and the ramp blends between
 * stops like a CSS gradient does. (The tone curve then runs on display values: its knee sits at 0.82 of display white.)
 * @param {string[]} ids preset ids, at most RAMP_ROWS
 * @returns {Uint8Array} RAMP_W × RAMP_ROWS RGBA
 */
export function paintStarRamp(ids, presets = STAR_TRAIL_PRESETS) {
  const data = new Uint8Array(RAMP_W * RAMP_ROWS * 4);
  for (let row = 0; row < RAMP_ROWS; row++) {
    const p = presets[ids[row] ?? ids[0]];
    const stops = p.ribbon.ramp.map(hexBytes);
    const n = stops.length;
    for (let x = 0; x < RAMP_W; x++) {
      const pos = (x * n) / RAMP_W;
      const k0 = Math.floor(pos) % n;
      const k1 = (k0 + 1) % n;
      const f = pos - Math.floor(pos);
      const i = (row * RAMP_W + x) * 4;
      for (let c = 0; c < 3; c++) data[i + c] = Math.round(stops[k0][c] + (stops[k1][c] - stops[k0][c]) * f);
      data[i + 3] = 255;
    }
  }
  return data;
}

const RIBBON_VERT = /* glsl */`
attribute vec4 aData; // u (0 head → 1 tail), v × q (v: −1 / +1 across), fade, flight time this point was laid
attribute float aQ;   // q: the joint's half-width (× the strip's): v is interpolated projectively, v·q and q
varying vec4 vData;
varying float vQ;
void main() {
  vData = aData;
  vQ = aQ;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const RIBBON_FRAG = /* glsl */`
uniform sampler2D uRamp;
uniform float uRow;     // the preset's ramp row (texture v)
uniform float uTime;
uniform float uAlpha;   // the whole ribbon (fades out over the landing)
uniform vec3 uCore;     // core colour (display)
uniform vec4 uBody;     // core sigma, glow sigma (both × the half-width), glow gain, band gain
uniform vec2 uBand;     // the colour band's centre |v| and width
uniform vec3 uHue;      // turns per second of flight laid, turns across, drift a second
uniform vec3 uStrand;   // strand colour
uniform vec4 uStrandP;  // count, strength, half-width (v), wobble
uniform vec4 uRim;      // covering edge colour, strength (0: none)
varying vec4 vData;
varying float vQ;
${TONE_GLSL}
float hash1(float n) { return fract(sin(n) * 43758.5453); }
float vnoise(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash1(i), hash1(i + 1.0), f);
}
void main() {
  float u = vData.x;
  float tl = vData.w;
  // (v / q: exact across a joint-to-joint quad whose two ends differ in width; plain interpolation would kink every
  // strand at the quad's diagonal)
  float v = vData.y / vQ;
  // a slow hand-painted waver, growing towards the tail
  float vv = v + (vnoise(tl * 9.0 + uTime * 1.3) - 0.5) * uStrandP.w * u;
  float av = abs(vv);
  float sc = uBody.x * (1.0 - 0.45 * u);
  float core = exp(-(vv * vv) / (sc * sc));
  float glow = uBody.z * exp(-(vv * vv) / (uBody.y * uBody.y));
  float bd = (av - uBand.x) / uBand.y;
  float band = uBody.w * exp(-bd * bd) * (1.0 - 0.35 * u);
  // thin film: the hue rides the flight time each point was laid (it stays on the path) and shifts across it
  float h = fract(tl * uHue.x + vv * uHue.y + uTime * uHue.z);
  vec3 film = texture2D(uRamp, vec2(h, uRow)).rgb;
  vec3 col = uCore * core + film * (glow + band);
  // strands: they meet at the head (u^0.6) and fan out, waving; a mirrored pair, and a third weaving across the middle
  float fw = fwidth(vv);
  float sw = max(uStrandP.z, 0.6 * fw);
  float env = pow(u, 0.6);
  float s = 0.0;
  if (uStrandP.x > 0.5) {
    float c0 = 0.4 * env + 0.09 * u * sin(14.0 * u - 9.0 * uTime);
    s = 1.0 - smoothstep(sw, sw + fw, abs(vv - c0));
    s = max(s, 1.0 - smoothstep(sw, sw + fw, abs(vv + c0)));
  }
  if (uStrandP.x > 2.5) {
    float c2 = 0.26 * u * sin(10.0 * u - 6.5 * uTime + 1.3);
    s = max(s, 1.0 - smoothstep(sw, sw + fw, abs(vv - c2)));
  }
  col += uStrand * s * uStrandP.y * pow(1.0 - u, 1.2) * smoothstep(0.0, 0.08, u);
  float fade = vData.z * uAlpha * (1.0 - smoothstep(0.55, 1.0, u)) * smoothstep(0.0, 0.035, u);
  col = vfxTone(col * fade);
  float a = max(col.r, max(col.g, col.b));
  // the covering rim sits under the light (light over rim, premultiplied)
  float rim = uRim.a * smoothstep(0.42, 0.8, av) * (1.0 - smoothstep(0.82, 1.0, av)) * fade;
  gl_FragColor = vec4(col + uRim.rgb * rim * (1.0 - a), a + rim * (1.0 - a));
}`;

const SPRITE_VERT = /* glsl */`
attribute vec4 iA; // x, y, rotation, shape
attribute vec4 iB; // half-size x, half-size y, p1, p2
attribute vec4 iC; // r, g, b (display), strength
varying vec2 vP;
varying vec4 vB;
varying vec4 vC;
varying float vShape;
void main() {
  vec2 l = position.xy * iB.xy;
  float c = cos(iA.z);
  float s = sin(iA.z);
  vec2 w = vec2(c * l.x - s * l.y, s * l.x + c * l.y) + iA.xy;
  vP = position.xy;
  vB = iB;
  vC = iC;
  vShape = iA.w;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(w, 0.0, 1.0);
}`;

const SPRITE_FRAG = /* glsl */`
varying vec2 vP;
varying vec4 vB;
varying vec4 vC;
varying float vShape;
${TONE_GLSL}
void main() {
  vec2 p = vP;
  vec3 light;
  if (vShape < 0.5) {
    // STAR4: a concave 4-point star, |x|^q + |y|^q = 1, anti-aliased on fwidth of its own field (capped: the field
    // is steep along the axes, where only the very tips soften)
    float q = vB.z;
    float f = pow(pow(abs(p.x), q) + pow(abs(p.y), q), 1.0 / q) - 1.0;
    float aa = clamp(fwidth(f), 0.002, 0.3);
    float body = 1.0 - smoothstep(-aa, aa, f);
    // a hot white heart fading out to the tinted edge; the edge's level (p2) drops as the star swells, so a big
    // star reads as light, not as a flat sticker
    float heat = pow(1.0 - smoothstep(-1.0, 0.0, f), 0.8);
    light = mix(vC.rgb * vB.w, vec3(1.15), heat) * body;
  } else if (vShape < 1.5) {
    // GLOW: a gaussian halo, faded to nothing at the quad's edge (the quad is clamped in size)
    float r2 = dot(p, p);
    light = vC.rgb * exp(-r2 * vB.z) * (1.0 - smoothstep(0.6, 1.0, sqrt(r2)));
  } else if (vShape < 2.5) {
    // CRESCENT: a disc minus the same disc shifted back: the front sliver, horns trailing; brighter at the front
    float d = max(length(p) - 0.92, -(length(p + vec2(vB.z, 0.0)) - 0.9));
    float aa = fwidth(d);
    float m = 1.0 - smoothstep(-aa, aa, d);
    light = vC.rgb * m * (0.55 + 0.45 * smoothstep(-0.3, 0.9, p.x));
  } else if (vShape < 3.5) {
    // SHARD: a kite (tip at +x), glass: one face lit, a bright edge on that side
    float x = p.x - 0.35;
    float f = max(abs(p.y) / 0.9 + x / 0.65, abs(p.y) / 0.9 - x / 1.35) - 1.0;
    float aa = fwidth(f);
    float m = 1.0 - smoothstep(-aa, aa, f);
    float lit = step(0.0, p.y);
    float edge = smoothstep(-0.28, -0.02, f) * (0.35 + 0.65 * lit);
    light = (vC.rgb * (0.62 + 0.38 * lit) + vec3(edge * vB.w)) * m;
  } else {
    // FLARE: a thin gaussian line along local x, falling off to its ends
    light = vC.rgb * exp(-p.y * p.y * vB.z) * pow(max(0.0, 1.0 - abs(p.x)), vB.w);
  }
  light = vfxTone(light * vC.a);
  gl_FragColor = vec4(light, max(light.r, max(light.g, light.b)));
}`;

/** Display-space RGB 0..1 of a hex colour into a Vector3 (no colour management: the effect works in display space). */
function setHex(v3, hex) {
  const b = hexBytes(hex);
  return v3.set(b[0] / 255, b[1] / 255, b[2] / 255);
}

/**
 * @param {{ parent: THREE.Object3D, quality?: 'high'|'medium'|'low', reduceMotion?: boolean, rand?: Function,
 *   presets?: object, renderOrder?: number }} o
 */
export function createStarTrail({ parent, quality = 'high', reduceMotion = false, rand = null, presets = STAR_TRAIL_PRESETS, renderOrder = 0 }) {
  const ids = Object.keys(presets).slice(0, RAMP_ROWS);
  const rnd = rand || createVisualRandom(visualSeed('starTrail'));
  let tier = STAR_TRAIL_TIERS[quality] || STAR_TRAIL_TIERS.high;
  let calmMode = !!reduceMotion;
  let viewW = 844;
  let viewH = 390;
  let unit = 390;
  let disposed = false;
  let held = false;
  let time = 0;
  let frameCalls = 0;
  let callMark = 0;

  // ---- the ribbon: one strip, MAX_JOINTS joints, 2 vertices each (written in place)
  const ribbonGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAX_JOINTS * 2 * 3);
  const dat = new Float32Array(MAX_JOINTS * 2 * 4);
  const qq = new Float32Array(MAX_JOINTS * 2);
  const idx = new Uint16Array((MAX_JOINTS - 1) * 6);
  for (let i = 0; i < MAX_JOINTS - 1; i++) {
    const a = i * 2;
    idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6);
  }
  const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const datAttr = new THREE.BufferAttribute(dat, 4).setUsage(THREE.DynamicDrawUsage);
  const qAttr = new THREE.BufferAttribute(qq, 1).setUsage(THREE.DynamicDrawUsage);
  ribbonGeo.setAttribute('position', posAttr);
  ribbonGeo.setAttribute('aData', datAttr);
  ribbonGeo.setAttribute('aQ', qAttr);
  ribbonGeo.setIndex(new THREE.BufferAttribute(idx, 1));

  const ramp = new THREE.DataTexture(paintStarRamp(ids, presets), RAMP_W, RAMP_ROWS, THREE.RGBAFormat);
  ramp.colorSpace = THREE.NoColorSpace;
  ramp.magFilter = THREE.LinearFilter;
  ramp.minFilter = THREE.LinearFilter;
  ramp.generateMipmaps = false;
  ramp.wrapS = THREE.RepeatWrapping;
  ramp.wrapT = THREE.ClampToEdgeWrapping;
  ramp.needsUpdate = true;

  const blend = {
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, toneMapped: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
  };
  const U = {
    uRamp: { value: ramp }, uRow: { value: 0.125 }, uTime: { value: 0 }, uAlpha: { value: 1 },
    uCore: { value: new THREE.Vector3(1, 1, 1) }, uBody: { value: new THREE.Vector4(0.2, 0.6, 0.3, 0.9) },
    uBand: { value: new THREE.Vector2(0.36, 0.2) }, uHue: { value: new THREE.Vector3(1.5, 0.4, 0.2) },
    uStrand: { value: new THREE.Vector3(1, 1, 1) }, uStrandP: { value: new THREE.Vector4(0, 0.8, 0.02, 0.08) },
    uRim: { value: new THREE.Vector4(0, 0, 0, 0) },
  };
  const ribbonMat = new THREE.ShaderMaterial({ name: 'starTrailRibbon', uniforms: U, vertexShader: RIBBON_VERT, fragmentShader: RIBBON_FRAG, ...blend });
  const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbon.name = 'starTrailRibbon';

  // ---- the sprites: one instanced quad, MAX_SPRITES instances
  const quad = new THREE.InstancedBufferGeometry();
  quad.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  quad.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1));
  const iA = new Float32Array(MAX_SPRITES * 4);
  const iB = new Float32Array(MAX_SPRITES * 4);
  const iC = new Float32Array(MAX_SPRITES * 4);
  const iAattr = new THREE.InstancedBufferAttribute(iA, 4).setUsage(THREE.DynamicDrawUsage);
  const iBattr = new THREE.InstancedBufferAttribute(iB, 4).setUsage(THREE.DynamicDrawUsage);
  const iCattr = new THREE.InstancedBufferAttribute(iC, 4).setUsage(THREE.DynamicDrawUsage);
  quad.setAttribute('iA', iAattr);
  quad.setAttribute('iB', iBattr);
  quad.setAttribute('iC', iCattr);
  quad.instanceCount = 0;
  const spriteMat = new THREE.ShaderMaterial({ name: 'starTrailSprites', vertexShader: SPRITE_VERT, fragmentShader: SPRITE_FRAG, ...blend });
  const sprites = new THREE.Mesh(quad, spriteMat);
  sprites.name = 'starTrailSprites';

  for (const [k, m] of [[0, ribbon], [1, sprites]]) {
    m.frustumCulled = false;
    m.visible = false;
    m.renderOrder = renderOrder + k;
    // calls come from the renderer's own count, taken around this mesh's draw (exact even on a shared renderer)
    m.onBeforeRender = (r) => {
      callMark = r.info.render.calls;
    };
    m.onAfterRender = (r) => {
      frameCalls += r.info.render.calls - callMark;
    };
    parent.add(m);
  }

  // ---- one flight at a time (a new launch replaces it); everything per launch lives in preallocated slots
  const run = {
    on: false, mode: 'flight', id: null, p: null, t: 0, landed: false, onLand: null, size: 1,
    from: [0, 0], to: [0, 0], bend: 0, dur: 1, trail: 0.3, shards: 0,
    halo: new THREE.Vector3(), strand: new THREE.Vector3(), star: new THREE.Vector3(), flare: new THREE.Vector3(), crescent: new THREE.Vector3(),
  };
  const shard = new Float32Array(MAX_SHARDS * 8); // angle, reach, spin, size, r, g, b, phase
  const P = [0, 0];
  const D = [0, 0];
  const stat = { fragArea: 0, screens: 0, peakScreens: 0, phase: 'idle', sprites: 0, joints: 0 };

  function setView(w, h) {
    viewW = Math.max(1, w);
    viewH = Math.max(1, h);
    unit = Math.min(viewW, viewH);
  }

  function setQuality(q) {
    tier = STAR_TRAIL_TIERS[q] || STAR_TRAIL_TIERS.high;
  }

  function setReduceMotion(on) {
    calmMode = !!on;
  }

  function begin(id, from, to, o) {
    const p = presets[id];
    if (!p || disposed || !tier.webgl) return false;
    run.id = id;
    run.p = p;
    run.from[0] = from[0];
    run.from[1] = from[1];
    run.to[0] = to[0];
    run.to[1] = to[1];
    run.bend = o.bend ?? p.flight.bend;
    run.dur = Math.max(0.05, o.duration ?? p.flight.seconds);
    run.trail = p.flight.trail * (run.dur / p.flight.seconds);
    run.size = o.size ?? 1;
    run.onLand = typeof o.onLand === 'function' ? o.onLand : null;
    run.landed = false;
    run.t = 0;
    run.on = true;
    stat.peakScreens = 0;
    const tint = accentTint(p, o.accent);
    setHex(run.halo, tint.halo);
    setHex(run.strand, tint.strand);
    setHex(run.star, p.star.color);
    setHex(run.flare, p.star.flare.color);
    setHex(run.crescent, p.crescent.color);
    // the ribbon's look for this preset and tier
    const r = p.ribbon;
    const wScale = 0.55 + 0.45 * tier.glow;
    U.uRow.value = (Math.max(0, ids.indexOf(id)) + 0.5) / RAMP_ROWS;
    setHex(U.uCore.value, r.core);
    U.uBody.value.set(r.coreSigma / wScale, (r.glowSigma * tier.glow) / wScale, r.glow, r.band);
    U.uBand.value.set(r.bandAt / wScale, r.bandWidth / wScale);
    U.uHue.value.set(r.hue[0], r.hue[1], calmMode ? 0 : r.hue[2]);
    U.uStrand.value.copy(run.strand);
    U.uStrandP.value.set(Math.min(tier.strands, MAX_STRANDS), p.strands.alpha, p.strands.width / wScale, r.wobble);
    if (r.rim) {
      setHex(U.uRim.value, r.rim.color);
      U.uRim.value.w = r.rim.alpha;
    } else U.uRim.value.set(0, 0, 0, 0);
    // the landing shards, drawn from the seeded stream now (never per frame)
    const n = Math.min(MAX_SHARDS, tier.shards + (p.burst.extra || 0), Math.max(0, tier.sprites - 6));
    run.shards = n;
    for (let k = 0; k < n; k++) {
      const c = hexBytes(p.burst.colors[Math.floor(rnd() * p.burst.colors.length) % p.burst.colors.length]);
      shard.set([
        (k / n) * TAU + (rnd() - 0.5) * (TAU / n) * 0.6,
        0.72 + 0.28 * rnd(),
        (rnd() < 0.5 ? -1 : 1) * (2 + 4 * rnd()),
        0.8 + 0.4 * rnd(),
        c[0] / 255, c[1] / 255, c[2] / 255,
        rnd() * 0.08,
      ], k * 8);
    }
    return true;
  }

  /**
   * A shooting star along a curve from → to (host units), landing with the swell and shards. With Reduce Motion: a
   * still star and crescent fade in at `to` instead (no flight, no ribbon, no shards). `onLand` runs once, on the
   * landing (or once the still star is in). @returns {boolean} false on low (the host draws its 2D fallback)
   */
  function launch(id, from, to, o = {}) {
    if (!begin(id, from, to, o)) return false;
    run.mode = calmMode ? 'calm' : 'flight';
    return true;
  }

  /** The landing burst on its own (swell, then shards) at `at`; with Reduce Motion the still star instead. */
  function burst(at, id = 'prism', o = {}) {
    if (!begin(id, at, at, o)) return false;
    run.mode = calmMode ? 'calm' : 'burst';
    return true;
  }

  /** Jumps a flight to its landing (a tap): the ribbon drains into the landing point from there. */
  function land() {
    if (run.on && run.mode === 'flight' && run.t < run.dur) run.t = run.dur;
  }

  function stop() {
    run.on = false;
  }

  /** Impact frames / a paused host: the star holds still (the buffers keep their last frame). */
  function hold(on) {
    held = !!on;
  }

  // ---- per frame
  let nSpr = 0;
  let area = 0;
  function put(shape, x, y, rot, sx, sy, p1, p2, r, g, b, a) {
    if (nSpr >= tier.sprites || a <= 0.003) return;
    const i = nSpr * 4;
    iA[i] = x;
    iA[i + 1] = y;
    iA[i + 2] = rot;
    iA[i + 3] = shape;
    iB[i] = sx;
    iB[i + 1] = sy;
    iB[i + 2] = p1;
    iB[i + 3] = p2;
    iC[i] = r;
    iC[i + 1] = g;
    iC[i + 2] = b;
    iC[i + 3] = a;
    area += 4 * sx * sy;
    nSpr++;
  }

  /** The star, its halo, flares and crescent at (x, y), heading (dx, dy). */
  function drawStar(x, y, dx, dy, R, scale, alpha, haloK, flareK, crescentA, crescentK, rot) {
    const p = run.p;
    const h = p.star.halo;
    const haloR = Math.min(R * h.size * haloK, unit * (haloK > 1.001 ? HALO_SWELL_CAP : HALO_CAP)) * tier.halo;
    put(SHAPE.GLOW, x, y, 0, haloR, haloR, 4.2, 0, run.halo.x, run.halo.y, run.halo.z, h.alpha * alpha);
    const fl = p.star.flare;
    const len = R * fl.length * flareK;
    const thick = Math.max(R * 0.16 * Math.sqrt(scale), 1.6);
    for (let k = 0; k < 2; k++) {
      put(SHAPE.FLARE, x, y, rot + k * Math.PI * 0.5, len, thick, 3.2, 2.2, run.flare.x, run.flare.y, run.flare.z, fl.alpha * alpha);
    }
    const rs = R * scale;
    // (swelling: its edge tints towards the halo and goes translucent, its heart stays white)
    const sw = clamp01((scale - 1.2) / 1.6);
    const er = run.star.x + (run.halo.x - run.star.x) * sw * 0.7;
    const eg = run.star.y + (run.halo.y - run.star.y) * sw * 0.7;
    const eb = run.star.z + (run.halo.z - run.star.z) * sw * 0.7;
    put(SHAPE.STAR4, x, y, rot, rs, rs, p.star.q, 1 - 0.55 * sw, er, eg, eb, alpha);
    if (crescentA > 0) {
      const c = p.crescent;
      const ahead = R * c.ahead * Math.max(1, scale * 0.8);
      const cr = R * c.size * crescentK;
      put(SHAPE.CRESCENT, x + dx * ahead, y + dy * ahead, Math.atan2(dy, dx), cr, cr, 0.22, 0,
        run.crescent.x, run.crescent.y, run.crescent.z, c.alpha * crescentA);
    }
  }

  function twinkle(base) {
    if (calmMode) return 0;
    const tq = Math.floor(time * 12) / 12; // a stepped beat, like the toon effects
    return Math.sin(TAU * base * tq);
  }

  function writeRibbon(alpha) {
    const J = Math.max(2, Math.min(tier.joints, MAX_JOINTS));
    const r = run.p.ribbon;
    const W = r.width * unit * run.size * (0.55 + 0.45 * tier.glow);
    let prevX = 0;
    let prevY = 0;
    let prevW = 0;
    for (let i = 0; i < J; i++) {
      const u = i / (J - 1);
      const tu = run.t - u * run.trail; // the flight time this point of the ribbon was laid
      const tl = tu < 0 ? 0 : tu > run.dur ? run.dur : tu;
      const s = flightEase(tl / run.dur);
      flightPoint(run.from, run.to, run.bend, s, P);
      flightTangent(run.from, run.to, run.bend, s, D);
      // (the stretch laid just after the launch tapers to a point and fades in: no flat cap where it started)
      const start = smooth(-0.01, 0.12, tu);
      const w = W * (r.head + (1 - r.head) * smooth(0, 0.55, u)) * (1 - 0.3 * smooth(0.6, 1, u)) * (0.15 + 0.85 * start);
      const nx = -D[1] * w;
      const ny = D[0] * w;
      const fade = smooth(0, 0.1, tu);
      const a = i * 6;
      pos[a] = P[0] + nx;
      pos[a + 1] = P[1] + ny;
      pos[a + 2] = 0;
      pos[a + 3] = P[0] - nx;
      pos[a + 4] = P[1] - ny;
      pos[a + 5] = 0;
      const q = Math.max(1e-3, w / W);
      const b = i * 8;
      dat[b] = u;
      dat[b + 1] = q;
      dat[b + 2] = fade;
      dat[b + 3] = tl;
      dat[b + 4] = u;
      dat[b + 5] = -q;
      dat[b + 6] = fade;
      dat[b + 7] = tl;
      qq[i * 2] = q;
      qq[i * 2 + 1] = q;
      if (i > 0 && fade > 0) area += (prevW + w) * Math.hypot(P[0] - prevX, P[1] - prevY);
      prevX = P[0];
      prevY = P[1];
      prevW = w;
    }
    ribbonGeo.setDrawRange(0, (J - 1) * 6);
    posAttr.needsUpdate = true;
    datAttr.needsUpdate = true;
    qAttr.needsUpdate = true;
    U.uAlpha.value = alpha;
    U.uTime.value = time;
    ribbon.visible = alpha > 0.003;
    if (!ribbon.visible) area = 0;
    stat.joints = ribbon.visible ? J : 0;
  }

  function update(dt) {
    frameCalls = 0;
    if (disposed) return;
    nSpr = 0;
    area = 0;
    ribbon.visible = false;
    stat.joints = 0;
    if (!run.on) return finish('idle');
    const step = held || !(dt > 0) ? 0 : Math.min(dt, 0.1);
    run.t += step;
    time += step;
    const p = run.p;
    const t = run.t;
    const R = p.star.radius * unit * run.size;
    const tw = 1 + p.star.twinkle[0] * twinkle(p.star.twinkle[1]);
    const turn = p.star.turn * DEG + (calmMode ? 0 : 0.06 * twinkle(p.star.twinkle[1] * 0.5));

    if (run.mode === 'calm') {
      const C = STAR_TRAIL_CALM;
      const end = C.fadeIn + C.hold + C.fadeOut;
      if (t >= C.fadeIn) landOnce();
      if (t >= end) {
        run.on = false;
        return finish('idle');
      }
      const a = smooth(0, C.fadeIn, t) * (1 - smooth(C.fadeIn + C.hold, end, t));
      const dx = run.to[0] - run.from[0];
      const dy = run.to[1] - run.from[1];
      const l = Math.hypot(dx, dy) || 1;
      drawStar(run.to[0], run.to[1], l > 1 ? dx / l : 1, l > 1 ? dy / l : 0, R, C.scale, a, C.halo, C.flare, a, 1, p.star.turn * DEG);
      return finish('calm');
    }

    const T1 = run.mode === 'burst' ? 0 : run.dur;
    const T2 = T1 + p.burst.swell;
    const T3 = T2 + p.burst.seconds;
    if (t >= T1) landOnce();
    if (t >= T3) {
      run.on = false;
      return finish('idle');
    }
    // the ribbon: whole during the flight, draining into the landing and fading over the swell
    if (run.mode === 'flight') {
      const ra = smooth(0, 0.05, t) * (t < T1 ? 1 : 1 - smooth(T1, T2 + 0.12, t));
      writeRibbon(ra);
    }
    if (t < T1) {
      // flight: the head on the curve, growing a little as it comes in
      const s = flightEase(t / run.dur);
      flightPoint(run.from, run.to, run.bend, s, P);
      flightTangent(run.from, run.to, run.bend, s, D);
      const a = smooth(0, 0.06, t);
      drawStar(P[0], P[1], D[0], D[1], R, (1 + 0.12 * s) * tw, a, 1, 1, a, 0.9 + 0.15 * s, turn);
      const f = t / run.dur;
      return finish(f < 0.2 ? 'launch' : f < 0.62 ? 'flight' : 'approach');
    }
    const x = run.to[0];
    const y = run.to[1];
    flightTangent(run.from, run.to, run.bend, 1, D);
    if (t < T2) {
      // the swell: towards the camera, its halo blooming; the crescent goes
      const k = (t - T1) / p.burst.swell;
      const e = easeOutCubic(k);
      const sc = 1.12 + (p.burst.scale - 1.12) * e;
      drawStar(x, y, D[0], D[1], R, sc, 1, 1 + (p.burst.halo - 1) * e, 1 + 0.6 * e, 1 - smooth(0, 0.6, k), 1.05, turn);
      return finish('swell');
    }
    // the shards: out from the swollen star, spinning, shrinking, fading; the star settles back and goes
    const k = (t - T2) / p.burst.seconds;
    const e = easeOutCubic(k);
    const fadeStar = Math.pow(1 - k, 1.5);
    drawStar(x, y, D[0], D[1], R, p.burst.scale + (1.1 - p.burst.scale) * e, fadeStar, p.burst.halo, 1.6 - 0.6 * e, 0, 1, turn);
    const reach = p.burst.reach * unit * run.size;
    const sz = p.burst.size * unit * run.size;
    for (let j = 0; j < run.shards; j++) {
      const o = j * 8;
      const kk = clamp01((k - shard[o + 7]) / (1 - shard[o + 7]));
      if (kk <= 0) continue;
      const ek = easeOutCubic(kk);
      const ang = shard[o];
      const d = R * 1.2 + reach * shard[o + 1] * ek;
      const L = sz * shard[o + 3] * (1 - 0.5 * kk);
      const a = Math.pow(1 - kk, 1.2) * smooth(0, 0.06, kk);
      put(SHAPE.SHARD, x + Math.cos(ang) * d, y + Math.sin(ang) * d, ang + shard[o + 2] * kk * p.burst.seconds, L, L * 0.36, 0, 1,
        shard[o + 4], shard[o + 5], shard[o + 6], a);
    }
    return finish('shards');
  }

  function landOnce() {
    if (run.landed) return;
    run.landed = true;
    const cb = run.onLand;
    if (cb) cb(run.id);
  }

  function finish(phase) {
    quad.instanceCount = nSpr;
    sprites.visible = nSpr > 0;
    if (nSpr > 0) {
      iAattr.needsUpdate = true;
      iBattr.needsUpdate = true;
      iCattr.needsUpdate = true;
    }
    if (!ribbon.visible) stat.joints = 0;
    stat.phase = phase;
    stat.sprites = nSpr;
    stat.fragArea = area;
    stat.screens = area / (viewW * viewH);
    if (stat.screens > stat.peakScreens) stat.peakScreens = stat.screens;
  }

  /**
   * calls: the draw calls the renderer made for this effect in its last render (renderer.info, read around each
   * mesh's draw); meshes: how many it will draw (0 while idle); fragArea: the estimated area its quads and strip cover
   * (host units², i.e. CSS px² for the recruit; × DPR² for device fragments); screens: that ÷ the view.
   */
  function stats() {
    return {
      calls: frameCalls,
      meshes: (ribbon.visible ? 1 : 0) + (sprites.visible ? 1 : 0),
      joints: stat.joints,
      sprites: stat.sprites,
      fragArea: stat.fragArea,
      screens: stat.screens,
      peakScreens: stat.peakScreens,
      phase: stat.phase,
      alive: run.on,
      tier: Object.keys(STAR_TRAIL_TIERS).find((k) => STAR_TRAIL_TIERS[k] === tier),
    };
  }

  /** Everything this effect made: meshes off the parent, geometry, materials, the ramp. Safe to call twice. */
  function dispose() {
    if (disposed) return;
    disposed = true;
    run.on = false;
    for (const m of [ribbon, sprites]) {
      m.visible = false;
      m.removeFromParent();
    }
    ribbonGeo.dispose();
    quad.dispose();
    ribbonMat.dispose();
    spriteMat.dispose();
    ramp.dispose();
  }

  return {
    launch, burst, land, stop, hold, update, step: update, stats, dispose, setView, setQuality, setReduceMotion,
    ribbon, sprites, ramp,
    /** (read-only, for tests and the lab) the buffers written each frame */
    buffers: { pos, dat, q: qq, iA, iB, iC },
    get phase() {
      return stat.phase;
    },
    get t() {
      return run.t;
    },
    get disposed() {
      return disposed;
    },
  };
}

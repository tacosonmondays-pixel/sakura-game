// Toon strokes (docs/VFX.md "VFX library"; display only): the shared line renderer of the styled effects. Every stroke
// is a capsule between two world points (round caps, so joints are clean), drawn in one instanced draw call for the
// whole battle. Its edge is crisp and anti-aliased, with no soft sprite fringe. An effect draws a line as stacked layers,
// back to front: a dark ink line, the body colour, a white-hot core. It pushes all of one layer, then all of the next, so
// a later layer covers an earlier one.
//
//   const strokes = createStrokes({ scene });
//   strokes.begin();                     // once a frame, with the sprite batches' begin()
//   strokes.push(S);                     // S: a scratch stroke (see STROKE below), copied in
//   strokes.end(time);                   // with the batches' end(): upload, show or hide
//
// Per stroke: the two ends and their half widths (world units); the colour (linear) and strength; kind (SOLID, GLOW: a
// soft added halo, BANDS: solid with bright bands scrolling from a to b); u along the stroke at each end (any unit; head,
// tail and the erosion noise use the same), the leader's head (nothing past it yet) and tail (nothing before it any
// more); cut (erosion: 0 whole, 1 gone, the stroke breaks into dashes on the way); the noise scale and seed; hdr (the
// colour × (1 + hdr): over white for the bloom on high); minPx (thinnest it is drawn, in CSS px); band frequency and speed.
import * as THREE from 'three';

/** The band clock wraps every this many seconds (band speeds must be multiples of 0.1 a second). */
export const BAND_WRAP = 10;

export const SOLID = 0;
export const GLOW = 1;
export const BANDS = 2;

/** A scratch stroke to fill and push (push copies it). */
export function stroke() {
  return {
    ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, wa: 0.05, wb: 0.05,
    r: 1, g: 1, b: 1, a: 1, kind: SOLID, seed: 0, hdr: 0, minPx: 0,
    ua: 0, ub: 1, head: 99, tail: -99, cut: 0, noise: 9, bandFreq: 0, bandSpeed: 0,
  };
}

const VERT = /* glsl */`
attribute vec4 iA; // a: x, y, z, half width
attribute vec4 iB; // b: x, y, z, half width
attribute vec4 iC; // u at a, u at b, head, tail
attribute vec4 iD; // linear colour, strength
attribute vec4 iE; // kind, seed, hdr, thinnest half width (px)
attribute vec4 iF; // cut, noise scale, band frequency, band speed
uniform float uPx; // world units per CSS pixel (0: no floor)
varying vec2 vQ;   // the pixel in the capsule's frame: along from a, across (world units)
varying float vLen;
varying vec2 vW;
varying vec4 vU;   // u at a, u at b, head, tail
varying vec4 vCol;
varying vec4 vE;
varying vec4 vF;
void main() {
  vec4 a = modelViewMatrix * vec4(iA.xyz, 1.0);
  vec4 b = modelViewMatrix * vec4(iB.xyz, 1.0);
  vec2 d = b.xy - a.xy;
  float len = length(d);
  vec2 dir = len > 1e-5 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float floorW = iE.w * uPx;
  float wa = max(iA.w, floorW);
  float wb = max(iB.w, floorW);
  // the quad runs one half width past each end (the round caps), plus a pixel and a half for the edge's anti-aliasing
  float w = max(wa, wb) + 1.5 * uPx;
  float s = position.x; // 0 at a, 1 at b
  vec2 p = mix(a.xy - dir * w, b.xy + dir * w, s) + nrm * (w * position.y);
  gl_Position = projectionMatrix * vec4(p, mix(a.z, b.z, s), 1.0);
  vQ = vec2(mix(-w, len + w, s), w * position.y);
  vLen = len;
  vW = vec2(wa, wb);
  vU = iC;
  vCol = iD;
  vE = iE;
  vF = iF;
}`;

const FRAG = /* glsl */`
uniform float uTime;
varying vec2 vQ;
varying float vLen;
varying vec2 vW;
varying vec4 vU;
varying vec4 vCol;
varying vec4 vE;
varying vec4 vF;
float h1(float x) { return fract(sin(x * 91.3458) * 47453.5453); }
float vn(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(h1(i), h1(i + 1.0), f);
}
void main() {
  float t = clamp(vQ.x / max(vLen, 1e-5), 0.0, 1.0);
  float dist = length(vec2(vQ.x - t * vLen, vQ.y));
  float r = mix(vW.x, vW.y, t);
  float u = mix(vU.x, vU.y, t);
  // the leader's head (nothing past it yet) and the tail (nothing before it any more)
  float on = step(u, vU.z) * step(vU.w, u);
  // erosion: a hard cut through a noise along the stroke (one seed for all of a line's layers: the dashes line up)
  float n = vn(u * vF.y + vE.y) * 0.7 + vn(u * vF.y * 2.55 + vE.y * 1.7) * 0.3;
  on *= step(vF.x, n);
  float m;
  vec3 col = vCol.rgb;
  if (abs(vE.x - 1.0) < 0.5) {
    float g = clamp(1.0 - dist / r, 0.0, 1.0);
    m = g * g;
  } else {
    float aa = fwidth(dist) * 0.75;
    m = 1.0 - smoothstep(r - aa, r + aa, dist); // a crisp toon edge, anti-aliased
    // bands: bright stripes running from a to b (the energy in a beam)
    if (vE.x > 1.5) col = mix(col, vec3(1.0), 0.45 * step(0.5, fract(u * vF.z - uTime * vF.w)));
  }
  float a = m * on * vCol.a;
  // the colour goes to the output's space first, then it is premultiplied (One, OneMinusSrcAlpha): solid layers cover
  // what is behind them (anti-aliased edges and part-strength layers blend right), the glow is added light
  gl_FragColor = vec4(col * (1.0 + vE.z), 1.0);
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * a, abs(vE.x - 1.0) < 0.5 ? 0.0 : a);
}`;

/**
 * @param {{ scene: THREE.Object3D, max?: number, renderOrder?: number, name?: string }} o
 */
export function createStrokes({ scene, max = 6144, renderOrder = 24, name = 'toonStrokes' }) {
  const quad = new THREE.BufferGeometry();
  quad.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0], 3));
  quad.setIndex([0, 1, 2, 2, 1, 3]);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  const attrs = {};
  for (const k of ['iA', 'iB', 'iC', 'iD', 'iE', 'iF']) {
    attrs[k] = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute(k, attrs[k]);
  }
  geo.instanceCount = 0;
  const material = new THREE.ShaderMaterial({
    uniforms: { uPx: { value: 0 }, uTime: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquation: THREE.AddEquation,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  mesh.visible = false;
  mesh.name = name;
  scene.add(mesh);
  const attrList = Object.values(attrs);
  const A = attrs.iA.array;
  const B = attrs.iB.array;
  const C = attrs.iC.array;
  const D = attrs.iD.array;
  const E = attrs.iE.array;
  const F = attrs.iF.array;
  let n = 0;
  let held = false;
  let refused = 0;

  return {
    /** Starts a frame (with the sprite batches' begin). */
    begin() {
      n = 0;
    },
    /** Strokes that still fit this frame (a producer trims to it, so its lines keep all their layers). */
    room() {
      return max - n;
    },
    /** Copies a stroke in. @returns {boolean} false when full (the stroke is not drawn) */
    push(s) {
      if (n >= max) {
        refused++;
        return false;
      }
      const q = n * 4;
      A[q] = s.ax; A[q + 1] = s.ay; A[q + 2] = s.az; A[q + 3] = s.wa;
      B[q] = s.bx; B[q + 1] = s.by; B[q + 2] = s.bz; B[q + 3] = s.wb;
      C[q] = s.ua; C[q + 1] = s.ub; C[q + 2] = s.head; C[q + 3] = s.tail;
      D[q] = s.r; D[q + 1] = s.g; D[q + 2] = s.b; D[q + 3] = s.a;
      E[q] = s.kind; E[q + 1] = s.seed; E[q + 2] = s.hdr; E[q + 3] = s.minPx;
      F[q] = s.cut; F[q + 1] = s.noise; F[q + 2] = s.bandFreq; F[q + 3] = s.bandSpeed;
      n++;
      return true;
    },
    /** Ends the frame: uploads what was pushed and shows the mesh (hidden while held, or with nothing to draw). */
    end(time = 0) {
      geo.instanceCount = n;
      // (wrapped: a long battle never runs mediump floats out of precision; band speeds are multiples of 0.1, so a
      // 10 s wrap is seamless)
      material.uniforms.uTime.value = time % BAND_WRAP;
      for (const a of attrList) {
        a.clearUpdateRanges();
        if (n) a.addUpdateRange(0, n * 4);
        a.needsUpdate = n > 0;
      }
      mesh.visible = n > 0 && !held;
    },
    /** Impact frames: the strokes sit them out (end() keeps the mesh hidden while held). */
    hold(on) {
      held = !!on;
      if (held) mesh.visible = false;
    },
    /** World units per CSS pixel (the camera rig's scale): the thinnest a stroke is drawn. */
    setPixel(worldPerPx) {
      material.uniforms.uPx.value = worldPerPx > 0 ? worldPerPx : 0;
    },
    get mesh() {
      return mesh;
    },
    /** Strokes pushed this frame so far. */
    get count() {
      return n;
    },
    get capacity() {
      return max;
    },
    /** Strokes refused for want of room (all frames). */
    get refused() {
      return refused;
    },
    dispose() {
      scene.remove(mesh);
      geo.dispose();
      quad.dispose();
      material.dispose();
    },
  };
}

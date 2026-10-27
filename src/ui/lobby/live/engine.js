// [ui-ink] The home's living scene (UI v2 "Ink & Paper" V2; the build plan's step 5, C4): the living-scene prototype
// (notes/live2d/proto/main.js, three r186 layers and a mesh-warp idle, no Live2D runtime) ported onto the game's own
// three (0.186.1), with only the calm set (src/ui/lobby/liveSlot.js calmAmounts). Loaded by dynamic import from the
// lobby, never part of its first load.
//
//   const live = await createLiveScene(canvas, def, { quality, layout })    def: a scene (./marumi.js)
//   live.layout({ W, H, place, side })   the screen and where her figure stands (place: her texture's rect, CSS px;
//                                  side: the side the home's controls take, home layout C: the scrims follow it)
//   live.start() / live.stop()     the clock (paused on its own while the page is hidden)
//   live.renderAt(t)               one frame at t seconds, the clock held (shots, tests)
//   live.setGirlVisible(on)        her layers only (the art-clearance probe diffs the plate with and without her)
//   live.dispose()                 geometry, materials, textures, the renderer, and the context lost: one context at most
//
// What moves (C4): her breath, blinks, the sway of her hair, ribbon and skirt (each weighted by its mask; her face never
// sways), the ball's float, the flame's flicker, the lamps' shimmer on the plate, a few motes in the lamp light and the
// fuse's sparks. Nothing else: no camera drift, roll or dolly, no pointer or gyro parallax, no petals, no bokeh, no head
// sway, no floor sheen. Every motion is a pure function of t, so renderAt(t) draws the same frame every time.
// Caps: device pixel ratio 1.5, 30 frames a second (src/ui/lobby/liveSlot.js LIVE_CAPS); Medium halves the motes.
import * as THREE from 'three';
import { calmAmounts, LIVE_CAPS } from '../liveSlot.js';

/** The motion loop (s): every period is a whole divisor of it (the prototype's), so a long capture loops cleanly. */
export const LOOP = 48;
const W = (target) => (2 * Math.PI * Math.max(1, Math.round(LOOP / target))) / LOOP;

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Her blinks: every 3 to 6 s, sometimes a double blink; seeded, never across the loop's seam. */
export const BLINKS = (() => {
  const rnd = mulberry32(11);
  const out = [];
  let t = 1.1 + rnd() * 0.8;
  while (t < LOOP - 0.8) {
    out.push(t);
    if (rnd() < 0.3) out.push(t + 0.24);
    t += 3 + rnd() * 3;
  }
  return out;
})();
/** 0 open .. 1 shut at t (170 ms a blink: 50 close, 45 hold, 75 open, smoothed). */
export function blinkAt(t) {
  const tt = ((t % LOOP) + LOOP) % LOOP;
  let b = 0;
  for (const s of BLINKS) {
    const d = tt - s;
    if (d < 0 || d > 0.17) continue;
    let v = d < 0.05 ? d / 0.05 : d < 0.095 ? 1 : 1 - (d - 0.095) / 0.075;
    v = v * v * (3 - 2 * v);
    b = Math.max(b, v);
  }
  return b;
}

// screen px (y down) from a rect transform: uniform vec3 (left, top, px per art px)
const PLACE = /* glsl */ 'vec4 placeAt(vec3 T, vec2 ip){ vec2 s = T.xy + ip * T.z; return projectionMatrix * modelViewMatrix * vec4(s.x, -s.y, 0.0, 1.0); }';
const PREM = { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor };
const ADD = { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor };

function plateMesh(def, tex) {
  const { FRAME, RIG } = def;
  const m = new THREE.ShaderMaterial({
    uniforms: { tPlate: { value: tex }, uT: { value: new THREE.Vector3() }, uShim: { value: 1 }, uLamps: { value: RIG.lamps.map(([x, y]) => new THREE.Vector2(x, y)) }, uLampK: { value: new Array(6).fill(0.55) } },
    vertexShader: /* glsl */ `uniform vec3 uT; varying vec2 vIp; ${PLACE}
      void main(){ vIp = position.xy; gl_Position = placeAt(uT, position.xy); }`,
    fragmentShader: /* glsl */ `uniform sampler2D tPlate; uniform float uShim; uniform vec2 uLamps[6]; uniform float uLampK[6]; varying vec2 vIp;
      void main(){
        vec3 c = texture2D(tPlate, vec2(vIp.x / ${FRAME.w}.0, 1.0 - vIp.y / ${FRAME.h}.0)).rgb;
        float glow = 0.0;
        for (int i = 0; i < 6; i++) { vec2 d = vIp - uLamps[i]; glow += exp(-dot(d, d) / 6050.0) * uLampK[i]; }
        c += vec3(1.0, 0.78, 0.45) * glow * 0.07 * uShim;
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthTest: false, depthWrite: false, side: THREE.DoubleSide,
  });
  // the plate's own quad in art px (y down): 0..w x 0..h
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, FRAME.w, 0, 0, FRAME.w, FRAME.h, 0, 0, FRAME.h, 0], 3));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 0;
  return mesh;
}

/**
 * The home's left, top and right scrims (base.css --scrim-l / -t / -r), drawn between the plate and her: the CSS scrims
 * would lie over her too (the canvas is one layer), and a host is never graded (5.5). The lobby hides those three CSS
 * scrims while the scene shows; the bottom one stays over her, as over every host. Home layout C: the side the
 * controls' block takes keeps its wide scrim, her side only an edge wash under the caption (0.8 for 40 px, gone by 88;
 * uWide: 1 wide, 0 the wash; x left, y right), as home.css draws them.
 */
function scrimMesh() {
  const m = new THREE.ShaderMaterial({
    uniforms: { uSize: { value: new THREE.Vector2(1, 1) }, uWide: { value: new THREE.Vector2(1, 1) } },
    vertexShader: /* glsl */ `uniform vec2 uSize; varying vec2 vP;
      void main(){ vP = position.xy * uSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(vP.x, -vP.y, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `uniform vec2 uSize; uniform vec2 uWide; varying vec2 vP;
      float ramp(float t, float a0, float t1, float a1, float t2){ return t < t1 ? mix(a0, a1, t / t1) : mix(a1, 0.0, clamp((t - t1) / (t2 - t1), 0.0, 1.0)); }
      float wash(float px){ return 0.8 * (1.0 - clamp((px - 40.0) / 48.0, 0.0, 1.0)); }
      void main(){
        float l = mix(wash(vP.x), ramp(vP.x / uSize.x, 0.82, 0.26, 0.58, 0.50), uWide.x);
        float t = ramp(vP.y, 0.62, 48.0, 0.5, 104.0);
        float r = mix(wash(uSize.x - vP.x), ramp((uSize.x - vP.x) / uSize.x, 0.62, 0.28, 0.5, 0.46), uWide.y);
        float a = 1.0 - (1.0 - l) * (1.0 - t) * (1.0 - r);
        gl_FragColor = vec4(vec3(14.0, 25.0, 48.0) / 255.0 * a, a);
      }`,
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, ...PREM,
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return mesh;
}

function gridGeometry(x0, x1, h, step) {
  const nx = Math.max(1, Math.round((x1 - x0) / step));
  const ny = Math.max(1, Math.round(h / step));
  const pos = new Float32Array((nx + 1) * (ny + 1) * 3);
  let k = 0;
  for (let j = 0; j <= ny; j++) {
    const y = (j * h) / ny;
    for (let i = 0; i <= nx; i++) {
      pos[k++] = x0 + (i * (x1 - x0)) / nx; pos[k++] = y; pos[k++] = 0;
    }
  }
  const idx = new Uint32Array(nx * ny * 6);
  let n = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i;
    const b = a + 1;
    const c = a + nx + 1;
    const d = c + 1;
    idx[n++] = a; idx[n++] = c; idx[n++] = b; idx[n++] = b; idx[n++] = c; idx[n++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

function girlMesh(def, t, step) {
  const { FRAME, RIG, MESH_X } = def;
  const TH = FRAME.h + FRAME.ext;
  const eb = RIG.eyeBox;
  const m = new THREE.ShaderMaterial({
    uniforms: {
      tGirl: { value: t.girl }, tEyes: { value: t.eyes }, tWipe: { value: t.wipe },
      mBreath: { value: t.breath }, mHead: { value: t.head }, mHair: { value: t.hair }, mRibbon: { value: t.ribbon },
      mSkirt: { value: t.skirt }, mBall: { value: t.ball }, mLock: { value: t.lock },
      uT: { value: new THREE.Vector3() },
      uEyeBox: { value: new THREE.Vector4(eb.x, eb.y, eb.w, eb.h) },
      uTexel: { value: new THREE.Vector2(1 / FRAME.w, 1 / TH) },
      uPivot: { value: new THREE.Vector2(...RIG.pivot) }, uCrown: { value: new THREE.Vector2(...RIG.crown) },
      uBreath: { value: 0 }, uHeadAng: { value: 0 }, uHairPh: { value: 0 }, uHairPh2: { value: 0 }, uHairAmp: { value: 0 },
      uRibPh: { value: 0 }, uRibAmp: { value: 0 }, uSkirtPh: { value: 0 }, uSkirtAmp: { value: 0 },
      uBallOff: { value: new THREE.Vector2() }, uBlink: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform sampler2D mBreath, mHead, mHair, mRibbon, mSkirt, mBall, mLock;
      uniform vec3 uT; uniform vec2 uPivot, uCrown, uBallOff;
      uniform float uBreath, uHeadAng, uHairPh, uHairPh2, uHairAmp, uRibPh, uRibAmp, uSkirtPh, uSkirtAmp;
      varying vec2 vIp;
      ${PLACE}
      float mk(sampler2D s, vec2 u){ return textureLod(s, u, 0.0).r; }
      void main(){
        vec2 ip = position.xy;
        vec2 mu = vec2(ip.x / ${FRAME.w}.0, clamp(1.0 - ip.y / ${FRAME.h}.0, 0.0, 1.0));
        float wB = mk(mBreath, mu), wH = mk(mHead, mu), wHair = mk(mHair, mu), wR = mk(mRibbon, mu);
        float wS = mk(mSkirt, mu), wBall = mk(mBall, mu), wL = mk(mLock, mu);
        float free = 1.0 - wL;
        vec2 d = vec2(0.0);
        float cd = length(ip - uCrown);
        d.x += free * wHair * uHairAmp * (sin(uHairPh - cd * 0.018) + 0.3 * sin(uHairPh2 - cd * 0.03));
        d.y += free * wHair * uHairAmp * 0.3 * sin(uHairPh - cd * 0.018 + 1.3);
        d.x += free * wR * uRibAmp * sin(uRibPh - (ip.y - 276.0) * 0.04);
        d.x += free * wS * uSkirtAmp * sin(uSkirtPh - (ip.y - 470.0) * 0.006);
        d += wBall * uBallOff;
        vec2 p = ip + d;
        float a = uHeadAng * wH;
        vec2 r = p - uPivot; float c = cos(a), s = sin(a);
        p = uPivot + vec2(c * r.x - s * r.y, s * r.x + c * r.y);
        p.y -= uBreath * wB;
        vIp = ip;
        gl_Position = placeAt(uT, p);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tGirl, tEyes, tWipe;
      uniform vec4 uEyeBox; uniform vec2 uTexel; uniform float uBlink;
      varying vec2 vIp;
      void main(){
        vec2 uv = vec2(vIp.x / ${FRAME.w}.0, 1.0 - vIp.y / ${TH}.0);
        vec4 c = texture2D(tGirl, uv);
        vec2 e = vec2((vIp.x - uEyeBox.x) / uEyeBox.z, 1.0 - (vIp.y - uEyeBox.y) / uEyeBox.w);
        if (uBlink > 0.001 && e.x > 0.0 && e.y > 0.0 && e.x < 1.0 && e.y < 1.0) {
          vec4 ec = texture2D(tEyes, e);
          vec2 wo = texture2D(tWipe, e).rg;
          float w = wo.r;
          float s = 0.16, lid = uBlink * (1.0 + 2.0 * s) - s;
          float k = 1.0 - smoothstep(lid - s * 0.5, lid + s * 0.5, w);
          c.rgb = mix(c.rgb, ec.rgb * c.a, ec.a * k);
          float moving = smoothstep(0.02, 0.15, uBlink) * (1.0 - smoothstep(0.85, 0.98, uBlink));
          float band = 1.0 - smoothstep(0.0, 0.075, abs(w - lid));
          c.rgb = mix(c.rgb, vec3(0.29, 0.17, 0.15) * c.a, band * wo.g * moving * 0.9);
        }
        // the warm rim the lamps leave on her upper-left edges (still: no glint runs along it)
        float aUL = texture2D(tGirl, uv + vec2(-2.0, 2.0) * uTexel).a;
        float rim = clamp(c.a - aUL, 0.0, 1.0) * c.a;
        c.rgb = mix(c.rgb, vec3(1.0, 0.769, 0.42) * c.a, rim * 0.5);
        gl_FragColor = c;
      }`,
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, ...PREM,
  });
  const mesh = new THREE.Mesh(gridGeometry(MESH_X[0], MESH_X[1], TH, step), m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  mesh.userData.step = step;
  return mesh;
}

function haloMesh(def, tex) {
  const b = def.RIG.haloBox;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([b.x, b.y + b.h, 0, b.x + b.w, b.y + b.h, 0, b.x + b.w, b.y, 0, b.x, b.y, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const m = new THREE.ShaderMaterial({
    uniforms: { tHalo: { value: tex }, uT: { value: new THREE.Vector3() }, uBreath: { value: 0 }, uFlick: { value: 0 }, uGlow: { value: 0 } },
    vertexShader: /* glsl */ `uniform vec3 uT; uniform float uBreath, uFlick; varying vec2 vUv; ${PLACE}
      void main(){
        vec2 ip = position.xy;
        ip.y = 118.0 + (ip.y - 118.0) * (1.0 + uFlick);
        ip.y -= uBreath;
        vUv = uv; gl_Position = placeAt(uT, ip);
      }`,
    fragmentShader: /* glsl */ 'uniform sampler2D tHalo; uniform float uGlow; varying vec2 vUv; void main(){ vec4 c = texture2D(tHalo, vUv); c.rgb *= 1.0 + uGlow; gl_FragColor = c; }',
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, ...PREM,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return mesh;
}

// particles: instanced quads, stateless (position = f(seed, cycle, age)); positions in art px of their layer
const PHEAD = /* glsl */ `
  attribute vec4 aSeed; attribute vec2 aLifeK; attribute float aIdx;
  uniform float uTime, uCount; uniform vec3 uT;
  varying vec2 vQ; varying float vA; varying vec3 vC; varying float vR;
  ${PLACE}
  float h1(float n){ return fract(sin(n) * 43758.5453123); }
  void emit(vec2 ip, float size){ vQ = position.xy * 2.0; gl_Position = placeAt(uT, ip + position.xy * size); }
  #define CYCLE float L = aLifeK.x, K = aLifeK.y; float u = uTime / L + aSeed.w; \\
    float cyc = mod(floor(u), K); float age = fract(u); float tl = age * L; \\
    float r1 = h1(aSeed.x * 17.0 + cyc * 1.37), r2 = h1(aSeed.y * 29.0 + cyc * 2.11), r3 = h1(aSeed.z * 41.0 + cyc * 0.77); \\
    float on = step(aIdx + 0.5, uCount);
`;

function particles({ count, life, seed, vert, frag, blend, order, extra = {} }) {
  const rnd = mulberry32(seed);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const s = new Float32Array(count * 4);
  const lk = new Float32Array(count * 2);
  const ix = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    s[i * 4] = rnd() * 100; s[i * 4 + 1] = rnd() * 100; s[i * 4 + 2] = rnd() * 100; s[i * 4 + 3] = rnd();
    const k = Math.max(1, Math.round(LOOP / (life * (0.8 + 0.4 * rnd()))));
    lk[i * 2] = LOOP / k; lk[i * 2 + 1] = k; ix[i] = i;
  }
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(s, 4));
  g.setAttribute('aLifeK', new THREE.InstancedBufferAttribute(lk, 2));
  g.setAttribute('aIdx', new THREE.InstancedBufferAttribute(ix, 1));
  g.instanceCount = count;
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCount: { value: count }, uT: { value: new THREE.Vector3() }, ...extra },
    vertexShader: PHEAD + vert,
    fragmentShader: `varying vec2 vQ; varying float vA; varying vec3 vC; varying float vR;\n${frag}`,
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, ...blend,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = order;
  return mesh;
}

function motesMesh() {
  // light motes drifting up through the lamp light, in front of her (the room's layer)
  return particles({
    count: 12, life: 8, seed: 5, order: 5, blend: ADD,
    vert: /* glsl */ `void main(){ CYCLE
      vec2 ip = vec2(mix(30.0, 1650.0, r1), mix(40.0, 640.0, r2 * r2)) + vec2(-4.0 - 6.0 * r3, -9.0 - 10.0 * r3) * tl
              + vec2(sin(tl * 0.9 + r1 * 6.28) * 9.0, sin(tl * 0.7 + r2 * 6.28) * 4.0);
      float tw = 0.65 + 0.35 * sin(tl * (2.0 + 2.0 * r3) + r2 * 6.28);
      vA = on * smoothstep(0.0, 0.2, age) * smoothstep(1.0, 0.75, age) * tw * (0.35 + 0.45 * r3);
      vC = mix(vec3(1.0, 0.84, 0.58), vec3(1.0, 0.97, 0.9), r2);
      emit(ip, 5.0 + 8.0 * r3 * r3); }`,
    frag: /* glsl */ `void main(){ float d = length(vQ); float a = exp(-d * d * 6.0) + 0.6 * exp(-d * d * 40.0);
      gl_FragColor = vec4(vC * a * vA * step(d, 1.0), 0.0); }`,
  });
}

function sparksMesh(def) {
  // the fuse's sparks and a small warm glow at its tip (her layer: they ride on the ball's float)
  return particles({
    count: 10, life: 0.8, seed: 13, order: 4, blend: PREM,
    extra: { uTip: { value: new THREE.Vector2(...def.RIG.fuseTip) } },
    vert: /* glsl */ `uniform vec2 uTip; void main(){ CYCLE
      if (aIdx < 0.5) { vA = 0.42 + 0.06 * sin(uTime * ${W(0.9).toFixed(5)}); vC = vec3(1.0, 0.62, 0.25); vR = 1.0; emit(uTip, 34.0); return; }
      float th = -1.5708 + (r1 - 0.5) * 1.9; float sp = 40.0 + 55.0 * r2;
      vec2 ip = uTip + vec2(cos(th), sin(th)) * sp * tl + vec2(0.0, 90.0) * tl * tl;
      vA = on * (1.0 - age) * (1.0 - age) * (0.8 + 0.2 * r3); vC = mix(vec3(1.0, 0.5, 0.12), vec3(1.0, 0.8, 0.35), r3); vR = 0.0;
      emit(ip, 4.5 + 3.0 * r3); }`,
    frag: /* glsl */ `void main(){ float d = length(vQ); float core = exp(-d * d * 30.0);
      float a = (vR > 0.5 ? exp(-d * d * 4.0) : min(1.0, exp(-d * d * 6.0) + core)) * step(d, 1.0) * vA;
      vec3 col = mix(vC, vec3(1.0, 0.97, 0.85), vR > 0.5 ? 0.0 : core);
      gl_FragColor = vec4(col * a, a); }`,
  });
}

/** Live scenes made and disposed in this page (the e2e checks one context at most). */
export const liveStats = { created: 0, disposed: 0, lost: 0 };

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} def a scene (./marumi.js default export)
 * @param {{ quality?: string, base?: string, layout?: { W: number, H: number, place: { left: number, top: number, width: number, height: number } }, onLost?: Function }} o
 *   base: the deploy base the scene's dir is under ('./')
 */
export async function createLiveScene(canvas, def, { quality = 'high', base = './', layout: first = null, onLost = null } = {}) {
  const A = calmAmounts(quality);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false });
  liveStats.created++;
  let disposed = false;
  const lostHandler = (e) => {
    e.preventDefault?.();
    if (!disposed) onLost?.();
  };
  canvas.addEventListener('webglcontextlost', lostHandler);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // the art passes through untouched
  renderer.setClearColor(0x0e1930, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);
  const loader = new THREE.TextureLoader();
  const url = (f) => `${base}${def.dir}${f}`;
  const load = (f, opts = {}) => loader.loadAsync(url(f)).then((t) => { Object.assign(t, opts); t.needsUpdate = true; return t; });
  const MASK = { generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const F = def.FILES;
  const textures = [];
  let L;
  try {
    const names = Object.keys(F.masks);
    const got = await Promise.all([
      load(F.plate), load(F.girl, { premultiplyAlpha: true }), load(F.halo, { premultiplyAlpha: true }), load(F.eyes, MASK), load(F.wipe, MASK),
      ...names.map((k) => load(F.masks[k], MASK)),
    ]);
    textures.push(...got);
    const [plate, girl, halo, eyes, wipe, ...masks] = got;
    const mk = Object.fromEntries(names.map((k, i) => [k, masks[i]]));
    L = {
      plate: plateMesh(def, plate),
      scrim: scrimMesh(),
      halo: haloMesh(def, halo),
      girl: girlMesh(def, { girl, eyes, wipe, ...mk }, quality === 'medium' ? 6 : 4),
      sparks: sparksMesh(def),
      motes: motesMesh(),
    };
    for (const m of Object.values(L)) scene.add(m);
  } catch (e) {
    canvas.removeEventListener('webglcontextlost', lostHandler);
    disposeAll();
    throw e;
  }

  let size = { W: 1, H: 1 };
  let place = null;
  function layout({ W, H, place: p, side = null }) {
    size = { W, H };
    place = p;
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, LIVE_CAPS.dpr));
    renderer.setSize(W, H, false);
    camera.left = 0; camera.right = W; camera.top = 0; camera.bottom = -H;
    camera.updateProjectionMatrix();
    const { FRAME } = def;
    const cs = Math.max(W / FRAME.w, H / FRAME.h);
    const plateT = new THREE.Vector3((W - FRAME.w * cs) / 2, (H - FRAME.h * cs) / 2, cs);
    const s = p.width / FRAME.w;
    const girlT = new THREE.Vector3(p.left, p.top, s);
    L.plate.material.uniforms.uT.value.copy(plateT);
    L.motes.material.uniforms.uT.value.copy(plateT);
    L.scrim.material.uniforms.uSize.value.set(W, H);
    // (home layout C: the block's side keeps the wide scrim, her side the edge wash; no side: both wide, as before)
    L.scrim.material.uniforms.uWide.value.set(side === 'r' ? 0 : 1, side === 'l' ? 0 : 1);
    for (const m of [L.girl, L.halo, L.sparks]) m.material.uniforms.uT.value.copy(girlT);
    // her figure runs on past the frame's bottom to the screen's edge (its last rows repeat: the bottom scrim lies over them)
    const need = Math.max(FRAME.h + FRAME.ext, Math.ceil((H - p.top) / s) + 4);
    const step = L.girl.userData.step;
    const have = L.girl.geometry.userData.h || FRAME.h + FRAME.ext;
    if (need > have + 0.5 || !L.girl.geometry.userData.h) {
      L.girl.geometry.dispose();
      L.girl.geometry = gridGeometry(def.MESH_X[0], def.MESH_X[1], need, step);
      L.girl.geometry.userData.h = need;
    }
    if (held != null) draw(held);
  }

  function update(t) {
    const u = L.girl.material.uniforms;
    const br = 0.5 - 0.5 * Math.cos(W(4) * t);
    u.uBreath.value = A.breath * br;
    u.uHeadAng.value = 0; // (C4: no head sway)
    u.uHairPh.value = W(3.2) * t; u.uHairPh2.value = W(1.9) * t + 1.1; u.uHairAmp.value = A.hair;
    u.uRibPh.value = W(2.7) * t + 0.4; u.uRibAmp.value = A.ribbon;
    u.uSkirtPh.value = W(4.4) * t + 2.0; u.uSkirtAmp.value = A.skirt;
    const bx = A.ball * 0.8 * Math.sin(W(5) * t + 0.5);
    const by = A.ball * 1.6 * Math.sin(W(5) * t);
    u.uBallOff.value.set(bx, by);
    u.uBlink.value = A.blink ? blinkAt(t) : 0;
    const h = L.halo.material.uniforms;
    h.uBreath.value = A.breath * br;
    h.uFlick.value = A.flicker * Math.sin(W(1.1) * t) + A.flicker * 0.5 * Math.sin(W(0.7) * t + 0.3);
    h.uGlow.value = 0.05 * A.shimmer * Math.sin(W(2.2) * t);
    const p = L.plate.material.uniforms;
    p.uShim.value = A.shimmer;
    for (let i = 0; i < 6; i++) p.uLampK.value[i] = 0.55 + 0.45 * Math.sin(W(5 + i * 0.7) * t + i * 1.7) * A.shimmer;
    for (const m of [L.motes, L.sparks]) m.material.uniforms.uTime.value = t;
    L.motes.material.uniforms.uCount.value = A.motes;
    L.sparks.material.uniforms.uCount.value = A.sparks ? 10 : 1;
    L.sparks.material.uniforms.uTip.value.set(def.RIG.fuseTip[0] + bx, def.RIG.fuseTip[1] + by);
  }

  function draw(t) {
    if (disposed || !place) return;
    update(t);
    renderer.render(scene, camera);
  }

  // the clock: 30 frames a second at most, paused while the page is hidden
  let raf = 0;
  let running = false;
  let held = null;
  let t0 = 0;
  let pausedAt = 0;
  let last = 0;
  const minDt = 1000 / LIVE_CAPS.fps - 1;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    if (now - last < minDt) return;
    last = now;
    draw((now - t0) / 1000);
  };
  const onVis = () => {
    if (!running) return;
    if (document.hidden) pausedAt = performance.now();
    else if (pausedAt) { t0 += performance.now() - pausedAt; pausedAt = 0; }
  };
  document.addEventListener('visibilitychange', onVis);
  function start() {
    if (disposed || running) return;
    held = null;
    running = true;
    t0 = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }
  function renderAt(t) {
    stop();
    held = Number(t) || 0;
    draw(held);
  }
  function setGirlVisible(on) {
    for (const m of [L.girl, L.halo, L.sparks]) m.visible = !!on;
    if (held != null) draw(held);
  }

  function disposeAll() {
    for (const t of textures) t.dispose();
    scene.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose();
        o.material?.dispose();
      }
    });
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch { /* already lost */ }
    liveStats.lost++;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    document.removeEventListener('visibilitychange', onVis);
    canvas.removeEventListener('webglcontextlost', lostHandler);
    disposeAll();
    liveStats.disposed++;
  }

  if (first) layout(first);
  return { layout, start, stop, renderAt, setGirlVisible, dispose, get size() { return size; }, get place() { return place; } };
}

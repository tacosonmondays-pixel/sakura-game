// The final pass on high quality (docs/VFX.md §M1): tone mapping and one colour grade per map
// theme, folded into the pass that already ends the chain (it replaces three's OutputPass, so the
// frame costs no extra full-screen pass). Medium and low have no post chain at all: they get
// neither, and no new pass.
//
// Tone mapping: a hue-keeping soft shoulder. Everything the scene lights stays exactly as it was
// below KNEE; above it, light rolls off towards white instead of clipping, and effect cores pushed
// past white (src/render/batch.js hdr) burn towards white like film — the hot middle of a spark
// reads white-gold instead of flat yellow.
//
// Grade (display space, after the sRGB curve): split toning (a tint in the shadows and one in the
// highlights), contrast around mid grey, saturation, then lift / gain. Every theme's grade is
// gentle on purpose — enemies, the road and health bars must read exactly as well as before
// (tests/render/vfx-m1.test.js checks the road / ground contrast of every theme).
//
// gradePixel() is the same maths in JS for the tests.
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/** Below this (linear) nothing changes; above it, light rolls off to 1. */
export const KNEE = 0.82;
/** How far very hot values (≥ 3) bleach to white. */
export const WHITE_HOT = 0.55;

const ID = { shadow: [0, 0, 0], high: [0, 0, 0], contrast: 1, sat: 1, lift: [0, 0, 0], gain: [1, 1, 1] };

/**
 * One grade per map theme (src/render/themes.js THEMES): shadow / highlight tint (display-space
 * offsets, ± a few %), contrast, saturation, lift, gain.
 */
export const GRADES = {
  sakura: { shadow: [0.012, -0.004, 0.018], high: [0.014, 0.004, 0.0], contrast: 1.05, sat: 1.07 },
  lake: { shadow: [-0.01, 0.006, 0.02], high: [0.006, 0.006, -0.004], contrast: 1.04, sat: 1.06 },
  shrine: { shadow: [0.01, -0.002, 0.012], high: [0.018, 0.008, -0.012], contrast: 1.06, sat: 1.05 },
  mountain: { shadow: [-0.008, 0.002, 0.018], high: [0.008, 0.008, 0.002], contrast: 1.07, sat: 1.02 },
  marsh: { shadow: [-0.006, 0.012, 0.01], high: [0.01, 0.01, -0.01], contrast: 1.04, sat: 1.0 },
  foundry: { shadow: [-0.012, 0.004, 0.02], high: [0.022, 0.008, -0.016], contrast: 1.08, sat: 1.04 },
  festival: { shadow: [0.014, -0.006, 0.016], high: [0.018, 0.006, -0.008], contrast: 1.05, sat: 1.1 },
  snow: { shadow: [-0.012, 0.004, 0.024], high: [0.004, 0.006, 0.01], contrast: 1.05, sat: 1.03 },
  volcano: { shadow: [0.016, -0.006, 0.0], high: [0.024, 0.006, -0.018], contrast: 1.08, sat: 1.05 },
  night: { shadow: [-0.006, -0.002, 0.026], high: [0.016, 0.0, 0.016], contrast: 1.05, sat: 1.06 },
  arena: { shadow: [0.004, 0.0, 0.012], high: [0.014, 0.008, -0.006], contrast: 1.07, sat: 1.05 },
  // Gate Arc: the city's cool stone and the campus's warm brick and lawns
  city: { shadow: [-0.008, 0.0, 0.02], high: [0.01, 0.006, -0.004], contrast: 1.06, sat: 1.03 },
  campus: { shadow: [0.01, -0.002, 0.014], high: [0.016, 0.008, -0.008], contrast: 1.05, sat: 1.06 },
};

/**
 * The grade for a resolved look (theme + night / fog variants): night stages lean blue in the
 * shadows, fog lowers the contrast a little. Missing fields are the identity.
 * @param {{ theme?: string, night?: boolean, fog?: boolean }} look
 */
export function gradeFor(look = {}) {
  const g = { ...ID, ...(GRADES[look.theme] || GRADES.sakura) };
  g.shadow = [...g.shadow];
  g.high = [...g.high];
  if (look.night && look.theme !== 'night') {
    g.shadow = [g.shadow[0] - 0.006, g.shadow[1] - 0.002, g.shadow[2] + 0.014];
    g.sat *= 1.02;
  }
  if (look.fog) {
    g.contrast = 1 + (g.contrast - 1) * 0.5;
    g.sat *= 0.98;
  }
  return g;
}

const srgb = (x) => (x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055);

/**
 * The final pass's maths on one linear RGB colour (tests): tone map, sRGB, grade.
 * @returns {number[]} display RGB 0..1
 */
export function gradePixel(rgb, grade = ID) {
  let [r, g, b] = rgb;
  const peak = Math.max(r, g, b);
  if (peak > KNEE) {
    const w = 1 - KNEE;
    const np = KNEE + w * (1 - Math.exp(-(peak - KNEE) / w));
    const k = np / peak;
    const hot = Math.min(1, Math.max(0, (peak - 1) * 0.5)) * WHITE_HOT;
    r = r * k + (np - r * k) * hot;
    g = g * k + (np - g * k) * hot;
    b = b * k + (np - b * k) * hot;
  }
  let c = [srgb(Math.max(0, r)), srgb(Math.max(0, g)), srgb(Math.max(0, b))];
  return gradeDisplay(c, grade);
}

/** The grade on a display-space colour (after the sRGB curve). */
export function gradeDisplay(c, grade = ID) {
  const G = { ...ID, ...grade };
  const L = (v) => 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  const smooth = (e0, e1, x) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  let l = L(c);
  const ws = 1 - smooth(0, 0.55, l);
  const wh = smooth(0.45, 1, l);
  c = c.map((v, i) => v + G.shadow[i] * ws + G.high[i] * wh);
  c = c.map((v) => (v - 0.5) * G.contrast + 0.5);
  l = L(c);
  c = c.map((v) => l + (v - l) * G.sat);
  c = c.map((v, i) => v * G.gain[i] + G.lift[i] * (1 - v));
  return c.map((v) => Math.min(1, Math.max(0, v)));
}

const GradeShader = {
  name: 'VfxGradeShader',
  uniforms: {
    tDiffuse: { value: null },
    uExposure: { value: 1 },
    uShadow: { value: new THREE.Vector3() },
    uHigh: { value: new THREE.Vector3() },
    uContrast: { value: 1 },
    uSat: { value: 1 },
    uLift: { value: new THREE.Vector3() },
    uGain: { value: new THREE.Vector3(1, 1, 1) },
  },
  vertexShader: /* glsl */`
    precision highp float;
    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;
    attribute vec3 position;
    attribute vec2 uv;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uExposure;
    uniform vec3 uShadow;
    uniform vec3 uHigh;
    uniform float uContrast;
    uniform float uSat;
    uniform vec3 uLift;
    uniform vec3 uGain;
    varying vec2 vUv;
    const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
    vec3 toSRGB(vec3 c) {
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
    }
    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 c = max(tex.rgb * uExposure, 0.0);
      // tone mapping: exact below the knee, a soft hue-keeping shoulder above, hot cores bleach
      float peak = max(c.r, max(c.g, c.b));
      if (peak > ${KNEE.toFixed(4)}) {
        float w = ${(1 - KNEE).toFixed(4)};
        float np = ${KNEE.toFixed(4)} + w * (1.0 - exp(-(peak - ${KNEE.toFixed(4)}) / w));
        vec3 s = c * (np / peak);
        float hot = clamp((peak - 1.0) * 0.5, 0.0, 1.0) * ${WHITE_HOT.toFixed(4)};
        c = mix(s, vec3(np), hot);
      }
      c = toSRGB(c);
      // grade (display space)
      float l = dot(c, LUMA);
      c += uShadow * (1.0 - smoothstep(0.0, 0.55, l)) + uHigh * smoothstep(0.45, 1.0, l);
      c = (c - 0.5) * uContrast + 0.5;
      l = dot(c, LUMA);
      c = mix(vec3(l), c, uSat);
      c = c * uGain + uLift * (1.0 - c);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), tex.a);
    }`,
};

/**
 * The last pass of the high-quality chain: tone mapping + this map's grade, written as sRGB
 * (it takes the OutputPass's place; set renderer.toneMapping stays NoToneMapping).
 */
export class GradePass extends Pass {
  constructor(grade = ID) {
    super();
    this.isOutputPass = true;
    this.uniforms = THREE.UniformsUtils.clone(GradeShader.uniforms);
    this.material = new THREE.RawShaderMaterial({
      name: GradeShader.name,
      uniforms: this.uniforms,
      vertexShader: GradeShader.vertexShader,
      fragmentShader: GradeShader.fragmentShader,
    });
    this._fsQuad = new FullScreenQuad(this.material);
    this.setGrade(grade);
  }

  setGrade(grade) {
    const G = { ...ID, ...grade };
    const u = this.uniforms;
    u.uShadow.value.fromArray(G.shadow);
    u.uHigh.value.fromArray(G.high);
    u.uContrast.value = G.contrast;
    u.uSat.value = G.sat;
    u.uLift.value.fromArray(G.lift);
    u.uGain.value.fromArray(G.gain);
    this.grade = G;
  }

  render(renderer, writeBuffer, readBuffer) {
    this.uniforms.tDiffuse.value = readBuffer.texture;
    this.uniforms.uExposure.value = renderer.toneMappingExposure;
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this._fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
      this._fsQuad.render(renderer);
    }
  }

  dispose() {
    this.material.dispose();
    this._fsQuad.dispose();
  }
}

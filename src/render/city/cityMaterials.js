// Modern-city kit (prototype): the three materials every city mesh shares, and CityAcc, the
// accumulator the kit bakes its geometry into.
//
//   facade  ONE lit material for every building, sidewalk, train and street-side box. The
//           windows are not geometry or a texture: each face carries `fuv` (its own coordinates
//           in world units: u along the face, v up from the ground) and `fkind` (which facade
//           pattern), and the fragment shader draws glass curtain walls, ribbon windows, school
//           windows, shop fronts, flats, awning stripes and solar panels procedurally (crisp at
//           any zoom, one draw call for the whole skyline).
//   holo    unlit, alpha-blended hologram panels (sign icons from a tiny canvas atlas) that
//           blink and scroll; one draw call for every sign on the map.
//   portal  the swirling inside of the gate ring (animated shader disc).
import * as THREE from 'three';

/** Facade pattern ids (the `fkind` attribute). */
export const FK = {
  plain: 0, glass: 1, office: 2, school: 3, shop: 4, flats: 5, awning: 6, solar: 7, lobby: 8, gym: 9, paving: 10, ruin: 11,
};

// ---------------------------------------------------------------------------
// facade material
// ---------------------------------------------------------------------------

const FACADE_VERT_HEAD = /* glsl */`
attribute vec2 fuv;
attribute float fkind;
varying vec2 vFuv;
varying float vFkind;
`;

const FACADE_FRAG_HEAD = /* glsl */`
uniform vec3 uGlassA;
uniform vec3 uGlassB;
uniform vec3 uWarm;
uniform float uTime;
varying vec2 vFuv;
varying float vFkind;
float fhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// 1 inside a pane, 0 on its frame (t = frame half-thickness, cell units), antialiased
float pane(vec2 g, vec2 t) {
  vec2 d = 0.5 - abs(fract(g) - 0.5);
  vec2 w = fwidth(g) * 0.75 + 1e-4;
  vec2 m = smoothstep(t, t + w, d);
  return m.x * m.y;
}
// soft band in [a, b] of x (antialiased)
float band(float x, float a, float b) {
  float w = fwidth(x) * 0.75 + 1e-4;
  return smoothstep(a, a + w, x) * (1.0 - smoothstep(b - w, b, x));
}
// glass: sky gradient, per-pane tint and a diagonal reflection glint
vec3 glassCol(vec2 f, vec2 cell) {
  float h = fhash(cell);
  vec3 g = mix(uGlassA, uGlassB, clamp(f.y * 0.16 + h * 0.25, 0.0, 1.0));
  float s = fract((f.x * 0.55 + f.y * 0.32) * 0.42 + 0.13);
  float glint = smoothstep(0.0, 0.05, s) * (1.0 - smoothstep(0.11, 0.2, s));
  return mix(g, vec3(1.0), glint * 0.55 + h * 0.06);
}
`;

const FACADE_FRAG_BODY = /* glsl */`
{
  vec2 f = vFuv;
  float k = floor(vFkind + 0.5);
  vec3 base = diffuseColor.rgb;
  vec3 col = base;
  float glow = 0.0;
  if (k == 1.0) {
    // glass curtain wall: tall panes, slim white mullions, a thicker spandrel every floor
    vec2 g = vec2(f.x / 0.26, f.y / 0.34);
    float p = pane(g, vec2(0.05, 0.09));
    vec3 gl = glassCol(f, floor(g));
    col = mix(base, gl, p);
    glow = p * 0.22;
  } else if (k == 2.0) {
    // office: white floors with ribbon windows, mullions every 0.32
    float fy = fract(f.y / 0.34);
    float b = band(fy, 0.3, 0.86);
    float m = pane(vec2(f.x / 0.32, 0.5), vec2(0.045, 0.0));
    float p = b * m;
    col = mix(base, glassCol(f, floor(vec2(f.x / 0.32, f.y / 0.34))), p);
    // a soft shadow line under each ribbon
    col *= 1.0 - band(fy, 0.24, 0.3) * 0.12;
    glow = p * 0.18;
  } else if (k == 3.0) {
    // school: cream walls, big framed windows in rows, a pale stripe at every floor
    vec2 g = vec2(f.x / 0.42, f.y / 0.38);
    float fy = fract(g.y);
    float fx = fract(g.x);
    float win = band(fy, 0.32, 0.86) * band(fx, 0.12, 0.88);
    float bar = band(fx, 0.485, 0.515) * win;
    vec3 gl = mix(glassCol(f, floor(g)), uWarm, 0.18);
    col = mix(base, gl, win * (1.0 - bar));
    col = mix(col, vec3(1.0), band(fy, 0.0, 0.06) * 0.7);
    glow = win * 0.15;
  } else if (k == 4.0 || k == 8.0) {
    // shop front / lobby: a big glass display along the ground floor, a fascia above
    float h = k == 4.0 ? 0.3 : 0.32;
    float s = k == 4.0 ? 0.36 : 0.3;
    vec2 g = vec2(f.x / s, f.y / h);
    float win = band(f.y, 0.04, h) * pane(vec2(g.x, 0.5), vec2(0.05, 0.0));
    vec3 inside = mix(uWarm, glassCol(f, floor(g)), 0.45 + 0.4 * smoothstep(0.0, h, f.y));
    col = mix(base, inside, win);
    glow = win * 0.35;
  } else if (k == 5.0) {
    // flats: small windows, a white balcony slab under each floor
    vec2 g = vec2(f.x / 0.3, f.y / 0.3);
    float fy = fract(g.y);
    float win = band(fy, 0.34, 0.82) * band(fract(g.x), 0.22, 0.78);
    col = mix(base, glassCol(f, floor(g)), win);
    col = mix(col, vec3(1.0), band(fy, 0.0, 0.12) * 0.85);
    col *= 1.0 - band(fy, 0.12, 0.17) * 0.18;
    glow = win * 0.14;
  } else if (k == 6.0) {
    // awning stripes
    float s = band(fract(f.x / 0.16), 0.5, 1.0);
    col = mix(base, vec3(1.0), s);
  } else if (k == 7.0) {
    // solar panels: navy cells on a pale frame
    float p = pane(f / 0.12, vec2(0.08));
    col = mix(base, vec3(0.08, 0.16, 0.38), p);
    float s = fract((f.x + f.y) * 0.9);
    col += vec3(0.25, 0.32, 0.4) * p * smoothstep(0.0, 0.08, s) * (1.0 - smoothstep(0.12, 0.2, s));
  } else if (k == 9.0) {
    // gym: tall vertical window slots
    vec2 g = vec2(f.x / 0.3, f.y / 0.9);
    float win = band(fract(g.x), 0.25, 0.75) * band(f.y, 0.18, 0.98);
    col = mix(base, glassCol(f, floor(g)), win);
    glow = win * 0.16;
  } else if (k == 10.0) {
    // sidewalk paving: small slabs, slim seams
    float p = pane(vec2(f.x / 0.26, f.y / 0.18 + 0.5), vec2(0.05));
    col = base * mix(0.86, 1.0, p);
  } else if (k == 11.0) {
    // burnt-out glass: dark broken panes, a few still catching the fire light
    vec2 g = vec2(f.x / 0.26, f.y / 0.34);
    float p = pane(g, vec2(0.06, 0.1));
    float h = fhash(floor(g));
    vec3 pc = h > 0.82 ? uWarm * 0.9 : mix(vec3(0.12, 0.11, 0.14), uGlassA, h * 0.6);
    col = mix(base, pc, p);
    glow = p * (h > 0.82 ? 0.55 : 0.0);
  }
  diffuseColor.rgb = col;
  facadeGlow = col * glow;
}
`;

/**
 * Lit, vertex-coloured material drawing procedural facades (see FK).
 * @param {{ glassA?: string, glassB?: string, warm?: string }} [o]
 */
export function createFacadeMaterial(o = {}) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const uniforms = {
    uGlassA: { value: new THREE.Color(o.glassA || '#7cc4ec') },
    uGlassB: { value: new THREE.Color(o.glassB || '#d8f1ff') },
    uWarm: { value: new THREE.Color(o.warm || '#fff0d6') },
    uTime: { value: 0 },
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = FACADE_VERT_HEAD + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n  vFuv = fuv;\n  vFkind = fkind;',
    );
    shader.fragmentShader = FACADE_FRAG_HEAD + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>\n  vec3 facadeGlow = vec3(0.0);\n${FACADE_FRAG_BODY}`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += facadeGlow;');
  };
  mat.customProgramCacheKey = () => 'cityFacade2';
  return mat;
}

// ---------------------------------------------------------------------------
// hologram signs
// ---------------------------------------------------------------------------

/** Atlas cells of the hologram texture (u0, v0, u1, v1). 4 × 2 cells. */
export const HOLO_CELLS = {
  heart: 0, star: 1, arrow: 2, cup: 3, note: 4, bolt: 5, flower: 6, shield: 7,
};

function holoTexture() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S * 4;
  c.height = S * 2;
  const g = c.getContext('2d');
  const cell = (i, draw) => {
    const x0 = (i % 4) * S;
    const y0 = Math.floor(i / 4) * S;
    g.save();
    g.translate(x0, y0);
    // panel: soft gradient, bright rim, faint scanlines
    const gr = g.createLinearGradient(0, 0, 0, S);
    gr.addColorStop(0, 'rgba(255,255,255,0.78)');
    gr.addColorStop(1, 'rgba(255,255,255,0.42)');
    g.fillStyle = gr;
    g.beginPath();
    g.roundRect(6, 6, S - 12, S - 12, 18);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,1)';
    g.lineWidth = 6;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.18)';
    for (let y = 12; y < S - 10; y += 8) g.fillRect(10, y, S - 20, 2);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#ffffff';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.translate(S / 2, S / 2);
    draw(g);
    g.restore();
  };
  cell(0, (k) => { // heart
    k.beginPath();
    k.moveTo(0, 30);
    k.bezierCurveTo(-46, 0, -30, -38, 0, -16);
    k.bezierCurveTo(30, -38, 46, 0, 0, 30);
    k.fill();
  });
  cell(1, (k) => { // star
    k.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 15 : 36;
      k.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    k.closePath();
    k.fill();
  });
  cell(2, (k) => { // arrow
    k.lineWidth = 14;
    k.beginPath();
    k.moveTo(-30, 0);
    k.lineTo(26, 0);
    k.moveTo(6, -22);
    k.lineTo(28, 0);
    k.lineTo(6, 22);
    k.stroke();
  });
  cell(3, (k) => { // cup
    k.beginPath();
    k.roundRect(-26, -14, 40, 38, 8);
    k.fill();
    k.lineWidth = 8;
    k.beginPath();
    k.arc(18, 4, 11, -Math.PI / 2, Math.PI / 2);
    k.stroke();
    k.lineWidth = 5;
    for (const x of [-14, -2, 10]) {
      k.beginPath();
      k.moveTo(x - 4, -34);
      k.quadraticCurveTo(x + 4, -28, x - 2, -20);
      k.stroke();
    }
  });
  cell(4, (k) => { // note
    k.lineWidth = 9;
    k.beginPath();
    k.moveTo(-8, 20);
    k.lineTo(-8, -28);
    k.lineTo(24, -36);
    k.lineTo(24, 12);
    k.stroke();
    k.beginPath();
    k.ellipse(-16, 22, 12, 9, -0.4, 0, Math.PI * 2);
    k.ellipse(16, 14, 12, 9, -0.4, 0, Math.PI * 2);
    k.fill();
  });
  cell(5, (k) => { // bolt
    k.beginPath();
    k.moveTo(8, -38);
    k.lineTo(-22, 6);
    k.lineTo(-2, 6);
    k.lineTo(-10, 38);
    k.lineTo(22, -8);
    k.lineTo(2, -8);
    k.closePath();
    k.fill();
  });
  cell(6, (k) => { // flower (five petals)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      k.beginPath();
      k.ellipse(Math.cos(a) * 18, Math.sin(a) * 18, 15, 11, a, 0, Math.PI * 2);
      k.fill();
    }
    k.globalCompositeOperation = 'destination-out';
    k.beginPath();
    k.arc(0, 0, 8, 0, Math.PI * 2);
    k.fill();
    k.globalCompositeOperation = 'source-over';
  });
  cell(7, (k) => { // shield
    k.beginPath();
    k.moveTo(0, -36);
    k.lineTo(30, -24);
    k.quadraticCurveTo(30, 18, 0, 38);
    k.quadraticCurveTo(-30, 18, -30, -24);
    k.closePath();
    k.fill();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Unlit hologram panels: vertex colour × atlas, blinking per `blink` phase, scrolling scanline. */
export function createHoloMaterial() {
  const map = holoTexture();
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true, map, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  const uniforms = { uTime: { value: 0 } };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'attribute float blink;\nvarying float vBlink;\nvarying float vY;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n  vBlink = blink;\n  vY = position.y;',
    );
    shader.fragmentShader = 'uniform float uTime;\nvarying float vBlink;\nvarying float vY;\n' + shader.fragmentShader.replace(
      '#include <alphatest_fragment>',
      `{
        float ph = uTime * (0.9 + vBlink * 0.35) + vBlink * 6.28;
        float on = 0.72 + 0.28 * step(0.18, fract(ph * 0.5));
        float scan = 0.88 + 0.12 * smoothstep(0.0, 0.08, abs(fract(vY * 2.5 - uTime * 0.6) - 0.5));
        diffuseColor.a *= on * scan;
        diffuseColor.rgb *= 1.0 + 0.25 * on;
      }
      #include <alphatest_fragment>`,
    );
  };
  mat.customProgramCacheKey = () => 'cityHolo1';
  return mat;
}

// ---------------------------------------------------------------------------
// gate portal
// ---------------------------------------------------------------------------

const PORTAL_VERT = /* glsl */`
varying vec2 vP;
void main() {
  vP = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const PORTAL_FRAG = /* glsl */`
uniform float uTime;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
varying vec2 vP;
float h21(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
void main() {
  float r = length(vP);
  if (r > 1.0) discard;
  float a = atan(vP.y, vP.x);
  // two swirling arms + a slow counter-swirl
  float sw = sin(a * 3.0 + r * 9.0 - uTime * 2.2) * 0.5 + 0.5;
  float sw2 = sin(-a * 2.0 + r * 5.0 - uTime * 1.3 + 1.7) * 0.5 + 0.5;
  vec3 col = mix(uA, uB, sw);
  col = mix(col, uC, sw2 * 0.45 * smoothstep(0.2, 0.9, r));
  // bright heart, soft rim
  col = mix(col, vec3(1.0, 0.97, 1.0), smoothstep(0.42, 0.0, r) * 0.85);
  // twinkles on a polar grid
  vec2 q = vec2(a * 2.5 + uTime * 0.4, r * 9.0 - uTime * 0.7);
  vec2 id = floor(q);
  vec2 fq = fract(q) - 0.5;
  float tw = step(0.86, h21(id)) * smoothstep(0.18, 0.0, length(fq)) * (0.6 + 0.4 * sin(uTime * 6.0 + h21(id + 3.0) * 6.28));
  col += tw * 0.8;
  float alpha = mix(0.92, 0.7, smoothstep(0.3, 1.0, r)) * smoothstep(1.0, 0.94, r);
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`;

/** The swirling portal disc inside the gate ring. */
export function createPortalMaterial(colors = ['#ff9ad5', '#a98bff', '#7fe3ff']) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uA: { value: new THREE.Color(colors[0]) },
      uB: { value: new THREE.Color(colors[1]) },
      uC: { value: new THREE.Color(colors[2]) },
    },
    vertexShader: PORTAL_VERT,
    fragmentShader: PORTAL_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

// ---------------------------------------------------------------------------
// geometry accumulator
// ---------------------------------------------------------------------------

const _n = new THREE.Vector3();
const _m3 = new THREE.Matrix3();

/**
 * Non-indexed triangle soup with position, normal, colour, facade uv (`fuv`, world units) and
 * facade kind (`fkind`). Everything a city mesh needs for the facade material.
 */
export class CityAcc {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.fuv = [];
    this.fk = [];
  }

  get empty() {
    return this.pos.length === 0;
  }

  /** One triangle: a, b, c = [x, y, z]; ua.. = [u, v] facade coords. */
  tri(a, b, c, color, kind = 0, ua = [0, 0], ub = [0, 0], uc = [0, 0], n = null) {
    let nx;
    let ny;
    let nz;
    if (n) [nx, ny, nz] = n;
    else {
      const ux = b[0] - a[0];
      const uy = b[1] - a[1];
      const uz = b[2] - a[2];
      const vx = c[0] - a[0];
      const vy = c[1] - a[1];
      const vz = c[2] - a[2];
      nx = uy * vz - uz * vy;
      ny = uz * vx - ux * vz;
      nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l;
      ny /= l;
      nz /= l;
    }
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    this.col.push(color.r, color.g, color.b, color.r, color.g, color.b, color.r, color.g, color.b);
    this.fuv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
    this.fk.push(kind, kind, kind);
  }

  /** Quad a b c d (counter-clockwise seen from the front). */
  quad(a, b, c, d, color, kind = 0, uvs = null) {
    const u = uvs || [[0, 0], [0, 0], [0, 0], [0, 0]];
    this.tri(a, b, c, color, kind, u[0], u[1], u[2]);
    this.tri(a, c, d, color, kind, u[0], u[2], u[3]);
  }

  /**
   * Box standing on y (bottom), centred on (x, z), yaw ry. Side faces get facade coords
   * (u along the face from its left edge + uOff, v = height above `v0`).
   * @param {object} o { ry, color, top (Color), side (kind), topKind, uOff, v0, bottom, faces: [+z, +x, -z, -x] booleans }
   */
  box(x, y, z, w, h, d, o = {}) {
    const ry = o.ry || 0;
    const cs = Math.cos(ry);
    const sn = Math.sin(ry);
    const P = (lx, ly, lz) => [x + lx * cs + lz * sn, y + ly, z - lx * sn + lz * cs];
    const hw = w / 2;
    const hd = d / 2;
    const col = o.color;
    const top = o.top || col;
    const kind = o.side ?? 0;
    const v0 = (o.v0 ?? 0) + 0;
    const vb = y - (o.ground ?? 0) + v0;
    const vt = vb + h;
    const uo = o.uOff || 0;
    const faces = o.faces || [true, true, true, true];
    // +z (front)
    if (faces[0]) this.quad(P(-hw, 0, hd), P(hw, 0, hd), P(hw, h, hd), P(-hw, h, hd), col, kind, [[uo, vb], [uo + w, vb], [uo + w, vt], [uo, vt]]);
    // +x (right)
    if (faces[1]) this.quad(P(hw, 0, hd), P(hw, 0, -hd), P(hw, h, -hd), P(hw, h, hd), o.colorSide || col, kind, [[uo, vb], [uo + d, vb], [uo + d, vt], [uo, vt]]);
    // -z (back)
    if (faces[2]) this.quad(P(hw, 0, -hd), P(-hw, 0, -hd), P(-hw, h, -hd), P(hw, h, -hd), col, kind, [[uo, vb], [uo + w, vb], [uo + w, vt], [uo, vt]]);
    // -x (left)
    if (faces[3]) this.quad(P(-hw, 0, -hd), P(-hw, 0, hd), P(-hw, h, hd), P(-hw, h, -hd), o.colorSide || col, kind, [[uo, vb], [uo + d, vb], [uo + d, vt], [uo, vt]]);
    // top
    if (o.noTop !== true) this.quad(P(-hw, h, hd), P(hw, h, hd), P(hw, h, -hd), P(-hw, h, -hd), top, o.topKind ?? 0, [[-hw, hd], [hw, hd], [hw, -hd], [-hw, -hd]]);
    if (o.bottom) this.quad(P(-hw, 0, -hd), P(hw, 0, -hd), P(hw, 0, hd), P(-hw, 0, hd), col, 0);
  }

  /** Appends a THREE geometry (any primitive) transformed by `matrix`, flat colour + kind. */
  geo(geom, matrix, color, kind = 0) {
    let g = geom.index ? geom.toNonIndexed() : geom;
    g = g.clone();
    g.applyMatrix4(matrix);
    g.computeVertexNormals();
    const p = g.attributes.position;
    const n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      this.pos.push(p.getX(i), p.getY(i), p.getZ(i));
      this.nor.push(n.getX(i), n.getY(i), n.getZ(i));
      this.col.push(color.r, color.g, color.b);
      this.fuv.push(p.getX(i), p.getY(i));
      this.fk.push(kind);
    }
    g.dispose();
    if (geom.index) geom.dispose();
  }

  /** Appends a vertex-coloured BufferGeometry (e.g. a baked prop) as plain facade. */
  appendColored(geom, matrix) {
    const g = geom.clone();
    g.applyMatrix4(matrix);
    _m3.getNormalMatrix(matrix);
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      this.pos.push(p.getX(i), p.getY(i), p.getZ(i));
      _n.set(n.getX(i), n.getY(i), n.getZ(i)).normalize();
      this.nor.push(_n.x, _n.y, _n.z);
      this.col.push(c.getX(i), c.getY(i), c.getZ(i));
      this.fuv.push(0, 0);
      this.fk.push(0);
    }
    g.dispose();
  }

  build() {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('fuv', new THREE.Float32BufferAttribute(this.fuv, 2));
    g.setAttribute('fkind', new THREE.Float32BufferAttribute(this.fk, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}


// City kit (Gate Arc, Noon `city` theme): the facade material every city building shares, and
// CityAcc, the accumulator facade geometry is baked into.
//
//   facade  ONE lit, opaque material for every building, kerb, rail and train car. The windows
//           are not geometry or a texture: each face carries `fuv` (its own coordinates in world
//           units: u along the face, v up from the ground) and `fkind` (which facade pattern), and
//           the fragment shader draws glass, ribbon windows, shop fronts, flats with balconies,
//           brick courses, shutters and awning stripes procedurally (crisp at any zoom, one draw
//           call for every building on the map). At night (`uNight` 1) the windows light up warm.
//
// No transparency anywhere in the kit: glass is opaque and tinted (phone budget, GATE_ARC §18.7).
import * as THREE from 'three';

/** Facade pattern ids (the `fkind` attribute). */
export const FK = {
  plain: 0, glass: 1, office: 2, school: 3, shop: 4, flats: 5, awning: 6, solar: 7, lobby: 8, gym: 9, paving: 10,
  brick: 11, shutter: 12, sleepers: 13,
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
uniform float uNight;
uniform float uLit;
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
// glass: sky gradient, per-pane tint and a diagonal reflection glint; warm and lit at night
vec3 glassCol(vec2 f, vec2 cell) {
  float h = fhash(cell);
  vec3 g = mix(uGlassA, uGlassB, clamp(f.y * 0.16 + h * 0.25, 0.0, 1.0));
  float s = fract((f.x * 0.55 + f.y * 0.32) * 0.42 + 0.13);
  float glint = smoothstep(0.0, 0.05, s) * (1.0 - smoothstep(0.11, 0.2, s));
  g = mix(g, vec3(1.0), glint * 0.55 * (1.0 - uNight) + h * 0.06);
  // at night two windows in three are lit
  return mix(g, uWarm * (0.85 + 0.3 * h), uNight * uLit * step(0.34, h));
}
`;

const FACADE_FRAG_BODY = /* glsl */`
{
  vec2 f = vFuv;
  float k = floor(vFkind + 0.5);
  vec3 base = diffuseColor.rgb;
  vec3 col = base;
  float glow = 0.0;
  float lit = 0.18 + 0.7 * uNight * uLit;
  if (k == 1.0) {
    // glass curtain wall: tall panes, slim mullions, a thicker spandrel every floor
    vec2 g = vec2(f.x / 0.26, f.y / 0.34);
    float p = pane(g, vec2(0.05, 0.09));
    col = mix(base, glassCol(f, floor(g)), p);
    glow = p * lit;
  } else if (k == 2.0) {
    // office: floors with ribbon windows, mullions every 0.32
    float fy = fract(f.y / 0.34);
    float b = band(fy, 0.3, 0.86);
    float m = pane(vec2(f.x / 0.32, 0.5), vec2(0.045, 0.0));
    float p = b * m;
    col = mix(base, glassCol(f, floor(vec2(f.x / 0.32, f.y / 0.34))), p);
    col *= 1.0 - band(fy, 0.24, 0.3) * 0.12;
    glow = p * lit;
  } else if (k == 3.0) {
    // school: big framed windows in rows, a pale stripe at every floor
    vec2 g = vec2(f.x / 0.42, f.y / 0.38);
    float fy = fract(g.y);
    float fx = fract(g.x);
    float win = band(fy, 0.32, 0.86) * band(fx, 0.12, 0.88);
    float bar = band(fx, 0.485, 0.515) * win;
    vec3 gl = mix(glassCol(f, floor(g)), uWarm, 0.18);
    col = mix(base, gl, win * (1.0 - bar));
    col = mix(col, vec3(1.0), band(fy, 0.0, 0.06) * 0.7);
    glow = win * lit;
  } else if (k == 4.0 || k == 8.0) {
    // shop front / lobby: a big glass display along the ground floor, warm inside
    float h = k == 4.0 ? 0.3 : 0.32;
    float s = k == 4.0 ? 0.36 : 0.3;
    vec2 g = vec2(f.x / s, f.y / h);
    float win = band(f.y, 0.04, h) * pane(vec2(g.x, 0.5), vec2(0.05, 0.0));
    vec3 inside = mix(uWarm, glassCol(f, floor(g)), 0.45 + 0.4 * smoothstep(0.0, h, f.y));
    col = mix(base, inside, win);
    glow = win * (0.35 + 0.5 * uNight * uLit);
  } else if (k == 5.0) {
    // flats: small windows, a pale balcony slab under each floor
    vec2 g = vec2(f.x / 0.3, f.y / 0.3);
    float fy = fract(g.y);
    float win = band(fy, 0.34, 0.82) * band(fract(g.x), 0.22, 0.78);
    col = mix(base, glassCol(f, floor(g)), win);
    col = mix(col, vec3(0.97, 0.96, 0.93), band(fy, 0.0, 0.12) * 0.85);
    col *= 1.0 - band(fy, 0.12, 0.17) * 0.18;
    glow = win * lit;
  } else if (k == 6.0) {
    // awning stripes
    float s = band(fract(f.x / 0.16), 0.5, 1.0);
    col = mix(base, vec3(1.0), s * 0.85);
  } else if (k == 7.0) {
    // solar panels: navy cells on a pale frame
    float p = pane(f / 0.12, vec2(0.08));
    col = mix(base, vec3(0.08, 0.16, 0.38), p);
  } else if (k == 9.0) {
    // gym / hall: tall window slots
    vec2 g = vec2(f.x / 0.3, f.y / 0.9);
    float win = band(fract(g.x), 0.25, 0.75) * band(f.y, 0.18, 0.98);
    col = mix(base, glassCol(f, floor(g)), win);
    glow = win * lit;
  } else if (k == 10.0) {
    // sidewalk paving: small slabs, slim seams
    float p = pane(vec2(f.x / 0.26, f.y / 0.18 + 0.5), vec2(0.05));
    col = base * mix(0.88, 1.0, p);
  } else if (k == 11.0) {
    // brick courses: running bond, mortar lines a little lighter, a window every 0.3 per floor
    vec2 b = vec2(f.x / 0.09 + 0.5 * mod(floor(f.y / 0.04), 2.0), f.y / 0.04);
    float brick = pane(b, vec2(0.06, 0.1));
    col = mix(base * 1.12, base * (0.92 + 0.12 * fhash(floor(b))), brick);
    vec2 g = vec2(f.x / 0.3, f.y / 0.3);
    float win = band(fract(g.y), 0.36, 0.8) * band(fract(g.x), 0.26, 0.74) * step(0.3, f.y);
    col = mix(col, glassCol(f, floor(g)), win);
    glow = win * lit;
  } else if (k == 12.0) {
    // rolling shutter: fine horizontal slats
    float s = band(fract(f.y / 0.035), 0.0, 0.35);
    col = base * (1.0 - s * 0.18);
  } else if (k == 13.0) {
    // railway sleepers across the ballast (top face: u runs along the line)
    float s = band(fract(f.x / 0.3), 0.0, 0.38) * band(abs(f.y), 0.0, 0.3);
    col = mix(base, vec3(0.42, 0.33, 0.26), s);
  }
  diffuseColor.rgb = col;
  facadeGlow = col * glow;
}
`;

/**
 * Lit, vertex-coloured, opaque material drawing procedural facades (see FK).
 * @param {{ glassA?: string, glassB?: string, warm?: string, night?: boolean }} [o]
 */
export function createFacadeMaterial(o = {}) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const uniforms = {
    uGlassA: { value: new THREE.Color(o.glassA || '#86b9d6') },
    uGlassB: { value: new THREE.Color(o.glassB || '#e2f1f8') },
    uWarm: { value: new THREE.Color(o.warm || '#ffe6bf') },
    uNight: { value: o.night ? 1 : 0 },
    // blackout dimming (terrain setDim): 1 = the windows lit as usual, toward 0 = lights out
    uLit: { value: 1 },
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
  mat.customProgramCacheKey = () => 'cityFacade4';
  return mat;
}

// ---------------------------------------------------------------------------
// geometry accumulator
// ---------------------------------------------------------------------------

const _n = new THREE.Vector3();
const _m3 = new THREE.Matrix3();
const _mm = new THREE.Matrix4();
const _e = new THREE.Euler();
const ALL_FACES = [true, true, true, true];
const _colors = new Map();

/** '#rrggbb' or a THREE.Color → a (cached, shared) THREE.Color. */
export function toColor(c) {
  if (typeof c !== 'string') return c;
  let col = _colors.get(c);
  if (!col) {
    col = new THREE.Color(c);
    _colors.set(c, col);
  }
  return col;
}

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
    color = toColor(color);
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
    color = toColor(color);
    const u = uvs || [[0, 0], [0, 0], [0, 0], [0, 0]];
    this.tri(a, b, c, color, kind, u[0], u[1], u[2]);
    this.tri(a, c, d, color, kind, u[0], u[2], u[3]);
  }

  /**
   * Box standing on y (bottom), centred on (x, z), turned by (rx, ry, rz) about its bottom
   * centre. Side faces get facade coords (u along the face from its left edge + uOff, v = height
   * above the ground + v0), so window patterns line up floor by floor.
   * @param {object} o { ry, rx, rz, color, colorSide, top, side (kind), topKind, uOff, v0, noTop,
   *   bottom, faces: [+z, +x, -z, -x] booleans }
   */
  box(x, y, z, w, h, d, o = {}) {
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ');
    _mm.makeRotationFromEuler(_e);
    const el = _mm.elements;
    const P = (lx, ly, lz) => [
      x + el[0] * lx + el[4] * ly + el[8] * lz,
      y + el[1] * lx + el[5] * ly + el[9] * lz,
      z + el[2] * lx + el[6] * ly + el[10] * lz,
    ];
    const hw = w / 2;
    const hd = d / 2;
    const col = toColor(o.color || '#ffffff');
    const colS = o.colorSide ? toColor(o.colorSide) : col;
    const top = o.top ? toColor(o.top) : col;
    const kind = o.side ?? 0;
    const vb = y + (o.v0 ?? 0);
    const vt = vb + h;
    const uo = o.uOff || 0;
    const faces = o.faces || ALL_FACES;
    if (faces[0]) this.quad(P(-hw, 0, hd), P(hw, 0, hd), P(hw, h, hd), P(-hw, h, hd), col, kind, [[uo, vb], [uo + w, vb], [uo + w, vt], [uo, vt]]);
    if (faces[1]) this.quad(P(hw, 0, hd), P(hw, 0, -hd), P(hw, h, -hd), P(hw, h, hd), colS, kind, [[uo, vb], [uo + d, vb], [uo + d, vt], [uo, vt]]);
    if (faces[2]) this.quad(P(hw, 0, -hd), P(-hw, 0, -hd), P(-hw, h, -hd), P(hw, h, -hd), col, kind, [[uo, vb], [uo + w, vb], [uo + w, vt], [uo, vt]]);
    if (faces[3]) this.quad(P(-hw, 0, -hd), P(-hw, 0, hd), P(-hw, h, hd), P(-hw, h, -hd), colS, kind, [[uo, vb], [uo + d, vb], [uo + d, vt], [uo, vt]]);
    if (o.noTop !== true) this.quad(P(-hw, h, hd), P(hw, h, hd), P(hw, h, -hd), P(-hw, h, -hd), top, o.topKind ?? 0, [[-hw, hd], [hw, hd], [hw, -hd], [-hw, -hd]]);
    if (o.bottom) this.quad(P(-hw, 0, -hd), P(hw, 0, -hd), P(hw, 0, hd), P(-hw, 0, hd), col, 0);
    return this;
  }

  /** Appends a THREE geometry (any primitive) transformed by `matrix`, flat colour + kind. */
  geo(geom, matrix, color, kind = 0) {
    color = toColor(color);
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


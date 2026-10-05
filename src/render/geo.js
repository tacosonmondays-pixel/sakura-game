// Geometry helpers for the battle renderer: a tiny builder that bakes transformed,
// vertex-coloured primitives into one BufferGeometry (position + normal + color), so a
// whole map's props become a handful of draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();
const _c2 = new THREE.Color();

/** Small deterministic PRNG (mulberry32) — renderer randomness stays stable per map. */
export function makeRand(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
  next.pick = (arr) => arr[Math.floor(next() * arr.length) % arr.length];
  return next;
}

/** Stable hash of a string or numbers → uint32. */
export function hash(...parts) {
  let h = 2166136261;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Collects primitives and merges them. Every primitive gets a flat colour (optionally
 * jittered per vertex for an organic look). Extra float attributes (e.g. `sway`) can be
 * attached per primitive.
 */
export class GeoBuilder {
  constructor({ flat = true, extra = [] } = {}) {
    this.flat = flat;
    this.extra = extra; // names of 1-component float attributes
    this.parts = [];
  }

  /**
   * Adds a geometry with a transform and colour.
   * @param {THREE.BufferGeometry} geom consumed (do not reuse)
   * @param {{ x?, y?, z?, rx?, ry?, rz?, sx?, sy?, sz?, s?, color?, color2?, jitter?, gradient?, rand?, attrs? }} o
   *   gradient: blend from `color` (bottom) to `color2` (top) over the part's height.
   */
  add(geom, o = {}) {
    let g = geom;
    if (g.index && this.flat) g = g.toNonIndexed();
    g.deleteAttribute('uv');
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    const s = o.s ?? 1;
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ');
    _q.setFromEuler(_e);
    _s.set((o.sx ?? 1) * s, (o.sy ?? 1) * s, (o.sz ?? 1) * s);
    _p.set(o.x || 0, o.y || 0, o.z || 0);
    _m.compose(_p, _q, _s);
    if (o.matrix) _m.premultiply(o.matrix);
    g.applyMatrix4(_m);
    if (this.flat) g.computeVertexNormals();
    const n = g.attributes.position.count;
    const colors = new Float32Array(n * 3);
    _c.set(o.color || '#ffffff');
    const pos = g.attributes.position;
    let minY = Infinity;
    let maxY = -Infinity;
    if (o.color2) {
      for (let i = 0; i < n; i++) {
        const y = pos.getY(i);
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      _c2.set(o.color2);
    }
    const jitter = o.jitter || 0;
    const rand = o.rand || Math.random;
    // Jitter per triangle (flat look) rather than per vertex.
    let jr = 0;
    let jg = 0;
    let jb = 0;
    for (let i = 0; i < n; i++) {
      let r = _c.r;
      let gg = _c.g;
      let b = _c.b;
      if (o.color2) {
        const t = maxY > minY ? (pos.getY(i) - minY) / (maxY - minY) : 0;
        r += (_c2.r - r) * t;
        gg += (_c2.g - gg) * t;
        b += (_c2.b - b) * t;
      }
      if (jitter) {
        if (!this.flat || i % 3 === 0) {
          const k = 1 + (rand() - 0.5) * 2 * jitter;
          jr = k;
          jg = k;
          jb = k * (1 + (rand() - 0.5) * jitter * 0.5);
        }
        r *= jr;
        gg *= jg;
        b *= jb;
      }
      colors[i * 3] = r;
      colors[i * 3 + 1] = gg;
      colors[i * 3 + 2] = b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    for (const name of this.extra) {
      const v = o.attrs?.[name];
      const arr = new Float32Array(n);
      if (typeof v === 'function') for (let i = 0; i < n; i++) arr[i] = v(pos.getX(i), pos.getY(i), pos.getZ(i));
      else arr.fill(v ?? 0);
      g.setAttribute(name, new THREE.BufferAttribute(arr, 1));
    }
    this.parts.push(g);
    return this;
  }

  box(w, h, d, o = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0);
    return this.add(g, o);
  }

  /** Cylinder standing on y=0. */
  cyl(rTop, rBot, h, seg = 8, o = {}) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, !!o.open);
    g.translate(0, h / 2, 0);
    return this.add(g, o);
  }

  cone(r, h, seg = 8, o = {}) {
    const g = new THREE.ConeGeometry(r, h, seg);
    g.translate(0, h / 2, 0);
    return this.add(g, o);
  }

  /** Low-poly blob (icosahedron), centred at (x,y,z). */
  blob(r, o = {}) {
    const g = new THREE.IcosahedronGeometry(r, o.detail ?? 0);
    if (o.wobble) {
      const pos = g.attributes.position;
      const rand = o.rand || Math.random;
      const seen = new Map();
      for (let i = 0; i < pos.count; i++) {
        const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
        let k = seen.get(key);
        if (k === undefined) {
          k = 1 + (rand() - 0.5) * o.wobble;
          seen.set(key, k);
        }
        pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
      }
    }
    return this.add(g, o);
  }

  sphere(r, ws = 10, hs = 8, o = {}) {
    return this.add(new THREE.SphereGeometry(r, ws, hs), o);
  }

  rock(r, o = {}) {
    const g = new THREE.DodecahedronGeometry(r, 0);
    return this.add(g, o);
  }

  torus(r, tube, rs = 6, ts = 12, o = {}) {
    return this.add(new THREE.TorusGeometry(r, tube, rs, ts, o.arc ?? Math.PI * 2), o);
  }

  /** Flat quad on the XZ plane at height y (facing up). */
  quad(w, d, o = {}) {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    return this.add(g, o);
  }

  /** Vertical plane (both sides visible needs DoubleSide material; we add two faces). */
  panel(w, h, o = {}) {
    const g = new THREE.PlaneGeometry(w, h);
    g.translate(0, h / 2, 0);
    const back = g.clone();
    back.rotateY(Math.PI);
    this.add(g, o);
    return this.add(back, o);
  }

  /** Extruded 2D shape (points in XY), extruded along z by depth, standing on y=0. */
  extrude(points, depth, o = {}) {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: o.curveSegments ?? 6 });
    g.translate(0, 0, -depth / 2);
    return this.add(g, o);
  }

  /** Appends another builder's parts transformed by a matrix (prop placement). */
  append(other, matrix) {
    for (const p of other.parts) {
      const g = p.clone();
      g.applyMatrix4(matrix);
      this.parts.push(g);
    }
    return this;
  }

  get empty() {
    return this.parts.length === 0;
  }

  /** Merges everything into one geometry (null when empty). */
  finish() {
    if (!this.parts.length) return null;
    const merged = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    return merged;
  }
}

/** Matrix for placing a prop at (x, y, z) with yaw and uniform scale. */
export function placeMatrix(x, y, z, ry = 0, s = 1, out = new THREE.Matrix4()) {
  _e.set(0, ry, 0);
  _q.setFromEuler(_e);
  _s.set(s, s, s);
  _p.set(x, y, z);
  return out.compose(_p, _q, _s);
}

/** Shortest-angle lerp. */
export function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

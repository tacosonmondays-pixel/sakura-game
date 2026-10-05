// Geometry helpers: vertex-coloured primitives, rigid bone binding and merging.
// All procedural parts carry the same attribute layout so they can be merged into a
// single draw call per character: position, normal, color, skinIndex, skinWeight.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _c = new THREE.Color();

/** Segment counts per quality level. */
export function seg(quality, high, medium = Math.max(4, Math.round(high * 0.7)), low = Math.max(3, Math.round(high * 0.5))) {
  if (quality === 'low') return low;
  if (quality === 'medium') return medium;
  return high;
}

/** Ensures the geometry is indexed and strips attributes we do not use. */
export function clean(geo) {
  let g = geo;
  for (const name of Object.keys(g.attributes)) {
    if (!['position', 'normal', 'color', 'skinIndex', 'skinWeight'].includes(name)) g.deleteAttribute(name);
  }
  if (!g.index) {
    const count = g.attributes.position.count;
    const idx = new (count > 65535 ? Uint32Array : Uint16Array)(count);
    for (let i = 0; i < count; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

/**
 * Paints vertex colours. `color` may be a hex/THREE.Color or fn(pos, normal, i) -> THREE.Color.
 */
export function paint(geo, color) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const arr = new Float32Array(pos.count * 3);
  const fixed = typeof color === 'function' ? null : (color instanceof THREE.Color ? color : new THREE.Color(color));
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    let c = fixed;
    if (!c) {
      p.fromBufferAttribute(pos, i);
      if (nor) n.fromBufferAttribute(nor, i);
      c = color(p, n, i);
    }
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** Rigidly binds every vertex to one bone. */
export function bindBone(geo, bone) {
  const count = geo.attributes.position.count;
  const si = new Uint16Array(count * 4);
  const sw = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    si[i * 4] = bone;
    sw[i * 4] = 1;
  }
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  return geo;
}

/**
 * Applies position/rotation/scale to a geometry in place.
 * @param {object} t { pos:[x,y,z], rot:[x,y,z] (euler XYZ), scale:number|[x,y,z], order }
 */
export function xform(geo, t = {}) {
  const { pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, order = 'XYZ' } = t;
  const s = Array.isArray(scale) ? scale : [scale, scale, scale];
  _e.set(rot[0], rot[1], rot[2], order);
  _q.setFromEuler(_e);
  _m.compose(_v.set(pos[0], pos[1], pos[2]), _q, _n.set(s[0], s[1], s[2]));
  geo.applyMatrix4(_m);
  return geo;
}

/** Makes a ready-to-merge part: cleaned, coloured, bone-bound and transformed. */
export function part(geo, { color = '#ffffff', bone = 0, ...t } = {}) {
  clean(geo);
  xform(geo, t);
  paint(geo, color);
  bindBone(geo, bone);
  return geo;
}

/** Merges parts (all must use the standard attribute layout). */
export function merge(parts) {
  const list = parts.filter(Boolean).map((g) => {
    clean(g);
    if (!g.attributes.color) paint(g, '#ffffff');
    if (!g.attributes.skinIndex) bindBone(g, 0);
    // mergeGeometries needs identical index typing; normalise to 32-bit when large.
    return g;
  });
  if (!list.length) return null;
  const total = list.reduce((s, g) => s + g.attributes.position.count, 0);
  if (total > 65535) {
    for (const g of list) {
      if (!(g.index.array instanceof Uint32Array)) g.setIndex(new THREE.BufferAttribute(new Uint32Array(g.index.array), 1));
    }
  }
  const merged = mergeGeometries(list, false);
  for (const g of list) g.dispose();
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

// ---------------------------------------------------------------------------
// Primitive factories (return fresh, un-coloured geometries)
// ---------------------------------------------------------------------------

export function sphere(r = 1, ws = 16, hs = 12, phiStart, phiLength, thetaStart, thetaLength) {
  return new THREE.SphereGeometry(r, ws, hs, phiStart, phiLength, thetaStart, thetaLength);
}

export function ellipsoid(rx, ry, rz, ws = 16, hs = 12) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(rx, ry, rz);
  return g;
}

export function cyl(rt, rb, h, rs = 12, open = false) {
  return new THREE.CylinderGeometry(rt, rb, h, rs, 1, open);
}

export function cone(r, h, rs = 10) {
  return new THREE.ConeGeometry(r, h, rs);
}

export function torus(r, tube, rs = 8, ts = 24, arc = Math.PI * 2) {
  return new THREE.TorusGeometry(r, tube, rs, ts, arc);
}

export function box(w, h, d, ws = 1, hs = 1, ds = 1) {
  return new THREE.BoxGeometry(w, h, d, ws, hs, ds);
}

export function capsule(r, len, cs = 6, rs = 12) {
  return new THREE.CapsuleGeometry(r, len, cs, rs);
}

/** Lathe from [[r, y], ...] profile. */
export function lathe(profile, segs = 16, phiStart = 0, phiLength = Math.PI * 2) {
  // Faces point outward when the (r, y) polygon winds counter-clockwise; fix clockwise input.
  let area = 0;
  for (let i = 0; i < profile.length; i++) {
    const [r0, y0] = profile[i];
    const [r1, y1] = profile[(i + 1) % profile.length];
    area += r0 * y1 - r1 * y0;
  }
  if (area < 0) profile = profile.slice().reverse();
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), segs, phiStart, phiLength);
}

/** Extrudes a 2D shape (THREE.Shape) with optional bevel; centred on z. */
export function extrude(shape, depth = 0.1, bevel = 0, curveSegments = 8) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments,
  });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

/**
 * Tapered, flattened tube along a polyline: the building block for hair locks, tails,
 * horns, tentacles and vines. `profile(t)` returns [halfWidth, halfThickness].
 * `up(t, point)` returns the direction the flat side faces (e.g. away from the head).
 */
export function strand(points, profile, { radial = 8, up = null, closeStart = true, sides = 1 } = {}) {
  const pts = points.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2])));
  const n = pts.length;
  const positions = [];
  const indices = [];
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  let prevNormal = null;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    tangent.subVectors(b, a).normalize();
    if (up) {
      normal.copy(up(t, pts[i]));
    } else if (prevNormal) {
      normal.copy(prevNormal);
    } else {
      normal.set(0, 0, 1);
      if (Math.abs(tangent.dot(normal)) > 0.9) normal.set(1, 0, 0);
    }
    // Gram-Schmidt: make the facing direction perpendicular to the tangent.
    normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
    binormal.crossVectors(tangent, normal).normalize();
    prevNormal = normal.clone();
    const [hw, ht] = profile(t);
    for (let j = 0; j < radial; j++) {
      const ang = (j / radial) * Math.PI * 2;
      const cx = Math.cos(ang) * hw;
      const cy = Math.sin(ang) * ht * sides;
      positions.push(
        pts[i].x + binormal.x * cx + normal.x * cy,
        pts[i].y + binormal.y * cx + normal.y * cy,
        pts[i].z + binormal.z * cx + normal.z * cy,
      );
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + ((j + 1) % radial);
      indices.push(a, c, b, b, c, d);
    }
  }
  // End caps (fan to centre points).
  const startCenter = positions.length / 3;
  positions.push(pts[0].x, pts[0].y, pts[0].z);
  const endCenter = startCenter + 1;
  positions.push(pts[n - 1].x, pts[n - 1].y, pts[n - 1].z);
  for (let j = 0; j < radial; j++) {
    const j2 = (j + 1) % radial;
    if (closeStart) indices.push(startCenter, j2, j);
    indices.push(endCenter, (n - 1) * radial + j, (n - 1) * radial + j2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** Catmull-Rom resample of control points into `count` smooth points. */
export function smoothPath(ctrl, count = 12) {
  const curve = new THREE.CatmullRomCurve3(ctrl.map((p) => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2]))), false, 'centripetal');
  return curve.getPoints(count - 1);
}

/** Vertical gradient colour function between two hex colours over [y0, y1]. */
export function vGradient(top, bottom, y0, y1) {
  const a = new THREE.Color(top);
  const b = new THREE.Color(bottom);
  return (p) => _c.copy(b).lerp(a, THREE.MathUtils.clamp((p.y - y0) / (y1 - y0), 0, 1)).clone();
}

export function smoothstep(a, b, x) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export function star(points = 5, outer = 1, inner = 0.45, rot = Math.PI / 2) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i / (points * 2)) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

export function circlePath(r, segments = 32, clockwise = false) {
  const p = new THREE.Path();
  p.absarc(0, 0, r, 0, Math.PI * 2, clockwise);
  return p;
}

// Procedural anime hair built from broad, smoothly tapered locks that hug the actual head
// surface (sampled from the base mesh). Styles: twintails, ponytail, long, bob, braid, buns,
// short, side, hime, wavy. Bangs: straight, swept, split, hime, messy.
import * as THREE from 'three';
import { BONES, LM } from './body.js';
import {
  part, strand, smoothPath, seg, smoothstep, ellipsoid, sphere, torus,
} from './geom.js';
import { col } from './toon.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = LM.headCenter;

function dirFrom(theta, phi) {
  return V(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi));
}

/** Point on the (hair-inflated) head surface. theta from top, phi from front (+z) towards +x. */
function onHead(ctx, theta, phi, off = 0) {
  const d = dirFrom(theta, phi);
  return C.clone().addScaledVector(d, ctx.hs(d) + off);
}

function outward(p) {
  return p.clone().sub(C).normalize();
}

function horizontalOut(p) {
  const v = V(p.x, 0, p.z - C.z * 0.5);
  if (v.lengthSq() < 1e-6) v.set(0, 0, -1);
  return v.normalize();
}

/** Colour function shared by all head hair: vertical gradient, underside shade, angel ring. */
function hairColor(ctx, { ring = true, tipDark = 0.75 } = {}) {
  const hair = col(ctx.pal.hair);
  const shadeC = col(ctx.pal.hairShade);
  const light = hair.clone().lerp(col('#ffffff'), 0.42);
  const tmp = new THREE.Vector3();
  return (p, n) => {
    const c = hair.clone().lerp(shadeC, smoothstep(3.4, 0.9, p.y) * tipDark);
    tmp.copy(p).sub(C);
    const r = tmp.length();
    if (n && r > 0.01) {
      const facing = n.dot(tmp.divideScalar(r));
      if (facing < -0.25) c.lerp(shadeC, 0.55);
    }
    if (ring && p.y > C.y) {
      const th = Math.acos(THREE.MathUtils.clamp((p.y - C.y) / Math.max(r, 1e-3), -1, 1));
      const phi = Math.atan2(p.x, p.z - C.z);
      const center = 0.3 * Math.PI + Math.sin(phi * 9) * 0.03;
      const d = Math.abs(th - center);
      if (d < 0.055 && Math.cos(phi) > -0.2) c.lerp(light, 0.85 * (1 - d / 0.055));
    }
    return c;
  };
}

/** Width/thickness profile for locks: swell near root, taper to the tip. */
function lockProfile(wMax, thick, { tip = 0.08, root = 0.6, peak = 0.25, blunt = false } = {}) {
  return (t) => {
    let w;
    if (t < peak) w = THREE.MathUtils.lerp(root, 1, smoothstep(0, peak, t));
    else w = blunt ? 1 - 0.15 * ((t - peak) / (1 - peak)) : THREE.MathUtils.lerp(1, tip, Math.pow((t - peak) / (1 - peak), 1.25));
    const th = thick * (blunt ? 1 : Math.max(0.35, w));
    return [wMax * w, th];
  };
}

/** A lock that runs along the head surface from (θ0,φ0) to (θ1,φ1). */
function surfaceLock(ctx, { th0, ph0, th1, ph1, off0 = 0.14, off1 = 0.05, w = 0.26, thick = 0.06, tip = 0.1, curl = 0.05, blunt = false, steps = 9, bone = BONES.head, color }) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const e = t * t * (3 - 2 * t);
    const th = THREE.MathUtils.lerp(th0, th1, t);
    const ph = THREE.MathUtils.lerp(ph0, ph1, e);
    const off = THREE.MathUtils.lerp(off0, off1, t) + (t > 0.75 ? curl * ((t - 0.75) / 0.25) ** 2 : 0);
    pts.push(onHead(ctx, th, ph, off));
  }
  const g = strand(smoothPath(pts, seg(ctx.quality, 12, 9, 6)), lockProfile(w, thick, { tip, blunt }), {
    radial: seg(ctx.quality, 8, 6, 5), up: (t, p) => outward(p),
  });
  return part(g, { color: color || hairColor(ctx), bone });
}

/** A hanging strand through explicit control points (back hair, tails, side locks). */
function hangLock(ctx, ctrl, { w = 0.28, thick = 0.12, tip = 0.06, peak = 0.25, root = 0.6, blunt = false, bone = BONES.head, up = null, color, count } = {}) {
  const pts = smoothPath(ctrl, count || seg(ctx.quality, 16, 12, 8));
  const g = strand(pts, lockProfile(w, thick, { tip, peak, root, blunt }), {
    radial: seg(ctx.quality, 8, 7, 5), up: up || ((t, p) => horizontalOut(p)),
  });
  return part(g, { color: color || hairColor(ctx), bone });
}

/** Skull cap: parametric shell over the head that tucks into the skin at the hairline. */
function cap(ctx, { volume = 0.12, back = 0.8 } = {}) {
  const PH = seg(ctx.quality, 44, 32, 22);
  const TH = seg(ctx.quality, 18, 14, 10);
  const positions = [];
  const indices = [];
  const hairline = (phi) => {
    const s = (1 - Math.cos(phi)) / 2; // 0 front, 1 back
    return Math.PI * (0.4 + (back - 0.4) * Math.pow(s, 0.7));
  };
  for (let j = 0; j <= TH; j++) {
    for (let i = 0; i <= PH; i++) {
      const phi = -Math.PI + (i / PH) * Math.PI * 2;
      const tMax = hairline(phi) + 0.06;
      const th = (j / TH) * tMax;
      const tuck = 1 - smoothstep(tMax - 0.2, tMax, th);
      const off = 0.02 + volume * tuck * (0.75 + 0.25 * Math.cos(th));
      const p = onHead(ctx, Math.max(th, 0.001), phi, off - (1 - tuck) * 0.03);
      positions.push(p.x, p.y, p.z);
    }
  }
  for (let j = 0; j < TH; j++) {
    for (let i = 0; i < PH; i++) {
      const a = j * (PH + 1) + i;
      const b = a + 1;
      const c = a + PH + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  // Fix the seam at phi = ±π by averaging normals of duplicated columns.
  const nor = g.attributes.normal;
  for (let j = 0; j <= TH; j++) {
    const a = j * (PH + 1);
    const b = a + PH;
    const n = V(nor.getX(a) + nor.getX(b), nor.getY(a) + nor.getY(b), nor.getZ(a) + nor.getZ(b)).normalize();
    nor.setXYZ(a, n.x, n.y, n.z);
    nor.setXYZ(b, n.x, n.y, n.z);
  }
  return part(g, { color: hairColor(ctx), bone: BONES.head });
}

// ---------------------------------------------------------------------------
// Bangs
// ---------------------------------------------------------------------------

function bangs(ctx, style) {
  const parts = [];
  const add = (o) => parts.push(surfaceLock(ctx, o));
  const browTh = 0.555 * Math.PI; // bang tips just over the brows
  switch (style) {
    case 'swept': {
      const n = 5;
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1);
        const ph0 = -0.95 + f * 1.7;
        add({ th0: 0.12 * Math.PI, ph0: ph0 - 0.25, th1: browTh - 0.04 * Math.PI * (1 - f) + 0.02 * Math.PI * f, ph1: ph0 + 0.32, w: 0.34, thick: 0.06, tip: 0.08 });
      }
      // A longer lock sweeping across.
      add({ th0: 0.15 * Math.PI, ph0: -0.5, th1: 0.6 * Math.PI, ph1: 0.15, w: 0.24, thick: 0.06, tip: 0.05, curl: 0.07 });
      break;
    }
    case 'split': {
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const ph0 = side * (0.12 + i * 0.32);
          add({ th0: 0.1 * Math.PI, ph0: ph0 * 0.5, th1: browTh + (i === 0 ? 0.02 : -0.01) * Math.PI, ph1: ph0 + side * 0.32, w: 0.31, thick: 0.06, tip: 0.07, curl: 0.06 });
        }
      }
      break;
    }
    case 'hime': {
      const n = 7;
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1);
        const ph = -0.95 + f * 1.9;
        add({ th0: 0.12 * Math.PI, ph0: ph * 0.7, th1: browTh, ph1: ph, w: 0.2, thick: 0.06, tip: 0.85, blunt: true, curl: 0.02 });
      }
      break;
    }
    case 'messy': {
      const offs = [0.02, -0.05, 0.04, -0.02, 0.05, -0.04, 0.01];
      const n = 7;
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1);
        const ph = -1.0 + f * 2.0;
        add({ th0: 0.1 * Math.PI, ph0: ph * 0.6, th1: browTh + offs[i] * Math.PI, ph1: ph + offs[(i + 3) % n] * 3, w: 0.24, thick: 0.065, tip: 0.04, curl: 0.12 });
      }
      break;
    }
    case 'straight':
    default: {
      const n = 6;
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1);
        const ph = -0.98 + f * 1.96;
        add({ th0: 0.1 * Math.PI, ph0: ph * 0.6, th1: browTh + (i % 2 ? 0.015 : 0) * Math.PI, ph1: ph, w: 0.3, thick: 0.06, tip: 0.12, curl: 0.04 });
      }
    }
  }
  return parts;
}

/** Locks framing the face in front of the ears. */
function sideLocks(ctx, { length = 2.05, w = 0.2, blunt = false, swing = 0 } = {}) {
  const parts = [];
  for (const side of [-1, 1]) {
    const a = onHead(ctx, 0.3 * Math.PI, side * 1.05, 0.12);
    const b = onHead(ctx, 0.5 * Math.PI, side * 1.18, 0.1);
    const c = onHead(ctx, 0.62 * Math.PI, side * 1.2, 0.1);
    const d = V(c.x + side * 0.02, Math.min(c.y - 0.2, (c.y + length) / 2), c.z + 0.08);
    const e = V(c.x - side * 0.04 + side * swing, length, c.z + 0.12);
    parts.push(hangLock(ctx, [a, b, c, d, e], {
      w, thick: 0.07, tip: blunt ? 0.9 : 0.12, blunt, count: seg(ctx.quality, 12, 9, 6),
      up: (t, p) => V(side, 0, 0.35).normalize(),
    }));
  }
  return parts;
}

// ---------------------------------------------------------------------------
// Back hair styles
// ---------------------------------------------------------------------------

/** Curtain of long strands down the back. */
function longBack(ctx, { endY = 0.75, wave = 0, blunt = false, n = 11, spread = 1.5, w = 0.34, endFlare = 0.06 } = {}) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const phi = Math.PI + (f - 0.5) * 2 * spread;
    const p0 = onHead(ctx, 0.36 * Math.PI, phi, 0.1);
    const p1 = onHead(ctx, 0.56 * Math.PI, phi, 0.15);
    const p2 = onHead(ctx, 0.7 * Math.PI, phi, 0.2);
    const out = horizontalOut(p2);
    const ctrl = [p0, p1, p2];
    const segs = 4;
    const len = ctx.adult ? 1.15 : 1;
    const yEnd = endY - (Math.abs(f - 0.5) * 0.35) * (blunt ? 0 : 1);
    for (let k = 1; k <= segs; k++) {
      const t = k / segs;
      const y = THREE.MathUtils.lerp(p2.y, yEnd / len, t);
      const flare = 0.02 + endFlare * t;
      const wv = wave ? Math.sin(t * Math.PI * 2.4 + f * 3) * wave : 0;
      ctrl.push(V((p2.x + out.x * (flare + wv)) * (1 - 0.12 * t * (1 - Math.abs(f - 0.5) * 2)), y, Math.min(p2.z + out.z * (flare + wv), -0.7 - 0.06 * t)));
    }
    parts.push(hangLock(ctx, ctrl, { w, thick: 0.11, tip: blunt ? 0.95 : 0.1, blunt, bone: BONES.tailB }));
  }
  return parts;
}

/** Bob / short: locks around the back and sides ending around the jaw, tips tucked in. */
function bobBack(ctx, { endY = 2.0, n = 9, tuck = 0.12, pointy = false } = {}) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const phi = Math.PI + (f - 0.5) * 2 * 1.75;
    const p0 = onHead(ctx, 0.35 * Math.PI, phi, 0.1);
    const p1 = onHead(ctx, 0.6 * Math.PI, phi, 0.17);
    const out = horizontalOut(p1);
    const y2 = endY + (pointy ? (i % 2) * 0.12 : 0);
    const p2 = V(p1.x + out.x * 0.04, (p1.y + y2) / 2, p1.z + out.z * 0.04);
    const p3 = V(p1.x - out.x * tuck, y2, p1.z - out.z * tuck);
    parts.push(hangLock(ctx, [p0, p1, p2, p3], { w: 0.33, thick: 0.12, tip: pointy ? 0.05 : 0.3, count: seg(ctx.quality, 10, 8, 6) }));
  }
  return parts;
}

/** A thick spindle tail (twintail / ponytail / side tail). */
function tail(ctx, { root, ctrl, w = 0.3, thick = 0.24, bone, tieColor, axis = V(0, 0, 1) }) {
  const parts = [];
  parts.push(hangLock(ctx, [root, ...ctrl], { w, thick, tip: 0.05, peak: 0.3, root: 0.45, bone, up: () => axis }));
  // Hair tie (scrunchie).
  const tie = torus(0.12, 0.06, 6, seg(ctx.quality, 14, 10, 8));
  const dir = (ctrl[0].clone ? ctrl[0].clone() : V(...ctrl[0])).sub(root).normalize();
  tie.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), dir));
  parts.push(part(tie, { pos: [root.x, root.y, root.z], color: col(tieColor), bone }));
  return parts;
}

function braid(ctx, { from, to, bone, tieColor }) {
  const parts = [];
  const n = seg(ctx.quality, 9, 7, 5);
  const color = hairColor(ctx, { ring: false, tipDark: 0.4 });
  const path = smoothPath([from, from.clone().lerp(to, 0.5).add(V(0, 0, 0.12)), to], n + 2);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const p = path[i + 1];
    const s = 0.2 * (1 - t * 0.35);
    const g = ellipsoid(s, s * 0.85, s * 0.8, seg(ctx.quality, 10, 8, 6), seg(ctx.quality, 8, 6, 5));
    g.rotateZ((i % 2 ? 1 : -1) * 0.45);
    parts.push(part(g, { pos: [p.x, p.y, p.z], color, bone }));
  }
  const end = path[path.length - 1];
  parts.push(part(torus(0.08, 0.04, 6, 12), { pos: [end.x, end.y + 0.06, end.z], rot: [Math.PI / 2, 0, 0], color: col(tieColor), bone }));
  parts.push(hangLock(ctx, [end, V(end.x, end.y - 0.18, end.z + 0.02), V(end.x, end.y - 0.36, end.z + 0.03)], { w: 0.14, thick: 0.1, tip: 0.1, peak: 0.4, bone }));
  return parts;
}

function bun(ctx, pos, tieColor) {
  const parts = [];
  const g = sphere(0.36, seg(ctx.quality, 16, 12, 8), seg(ctx.quality, 12, 9, 6));
  // Swirl grooves via displacement.
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x) + y * 6;
    const k = 1 + Math.sin(a * 2) * 0.04;
    p.setXYZ(i, x * k, y, z * k);
  }
  g.computeVertexNormals();
  parts.push(part(g, { pos: [pos.x, pos.y, pos.z], color: hairColor(ctx, { ring: false, tipDark: 0.3 }), bone: BONES.head }));
  parts.push(part(torus(0.3, 0.05, 6, 16), { pos: [pos.x, pos.y - 0.18, pos.z], rot: [Math.PI / 2 - 0.2, 0, 0], color: col(tieColor), bone: BONES.head }));
  return parts;
}

function ahoge(ctx) {
  const p0 = onHead(ctx, 0.05 * Math.PI, 0.3, 0.12);
  const ctrl = [p0, V(p0.x + 0.05, p0.y + 0.3, p0.z + 0.05), V(p0.x + 0.22, p0.y + 0.42, p0.z + 0.2), V(p0.x + 0.3, p0.y + 0.3, p0.z + 0.34)];
  return hangLock(ctx, ctrl, { w: 0.09, thick: 0.05, tip: 0.05, peak: 0.2, root: 1, up: () => V(1, 0, 0), count: 8 });
}

// ---------------------------------------------------------------------------

/**
 * Builds hair for a unit. -> { parts, tails: { tailL?, tailR?, tailB? } (bone pivots) }
 */
export function buildHair(ctx) {
  const { look, pal } = ctx;
  const parts = [];
  const tails = {};
  const add = (x) => (Array.isArray(x) ? parts.push(...x) : parts.push(x));
  const tieColor = pal.accent || pal.hairShade;
  const style = look.hairStyle || 'bob';

  add(cap(ctx, { volume: style === 'short' ? 0.1 : 0.13, back: style === 'short' ? 0.72 : 0.8 }));
  add(bangs(ctx, look.bangs || 'straight'));

  switch (style) {
    case 'twintails': {
      add(bobBack(ctx, { endY: 2.15, n: 7 }));
      add(sideLocks(ctx, { length: 2.1 }));
      for (const side of [-1, 1]) {
        const root = onHead(ctx, 0.3 * Math.PI, side * 1.75, 0.12);
        const bone = side > 0 ? BONES.tailL : BONES.tailR;
        tails[side > 0 ? 'tailL' : 'tailR'] = root.clone();
        const len = ctx.adult ? 1.25 : 1;
        add(tail(ctx, {
          root,
          ctrl: [V(root.x + side * 0.4, root.y + 0.05, root.z - 0.1), V(root.x + side * 0.62, root.y - 0.6 * len, root.z - 0.2), V(root.x + side * 0.55, root.y - 1.4 * len, root.z - 0.15), V(root.x + side * 0.72, root.y - 1.9 * len, root.z - 0.05)],
          w: 0.3, thick: 0.25, bone, tieColor,
        }));
      }
      break;
    }
    case 'ponytail': {
      add(bobBack(ctx, { endY: 2.2, n: 7 }));
      add(sideLocks(ctx, { length: 2.05 }));
      const root = onHead(ctx, 0.42 * Math.PI, Math.PI, 0.12);
      tails.tailB = root.clone();
      add(tail(ctx, {
        root,
        ctrl: [V(0, root.y + 0.15, root.z - 0.35), V(0.05, root.y - 0.45, root.z - 0.55), V(-0.05, root.y - 1.2, root.z - 0.45), V(0.08, root.y - 1.75, root.z - 0.3)],
        w: 0.34, thick: 0.3, bone: BONES.tailB, tieColor, axis: V(1, 0, 0),
      }));
      break;
    }
    case 'long': {
      tails.tailB = onHead(ctx, 0.5 * Math.PI, Math.PI, 0);
      add(longBack(ctx, { endY: 0.8 }));
      add(sideLocks(ctx, { length: 1.75, w: 0.21 }));
      break;
    }
    case 'wavy': {
      tails.tailB = onHead(ctx, 0.5 * Math.PI, Math.PI, 0);
      add(longBack(ctx, { endY: 0.85, wave: 0.1, w: 0.32, endFlare: 0.14 }));
      add(sideLocks(ctx, { length: 1.85, w: 0.22, swing: 0.08 }));
      break;
    }
    case 'hime': {
      tails.tailB = onHead(ctx, 0.5 * Math.PI, Math.PI, 0);
      add(longBack(ctx, { endY: 0.6, blunt: true, n: 11, w: 0.33, endFlare: 0.02 }));
      add(sideLocks(ctx, { length: 2.0, w: 0.24, blunt: true }));
      break;
    }
    case 'braid': {
      add(bobBack(ctx, { endY: 2.15, n: 7 }));
      add(sideLocks(ctx, { length: 2.1 }));
      const from = onHead(ctx, 0.62 * Math.PI, -2.1, 0.12);
      tails.tailR = from.clone();
      add(braid(ctx, { from, to: V(-0.72, 1.05, 0.18), bone: BONES.tailR, tieColor }));
      break;
    }
    case 'buns': {
      add(bobBack(ctx, { endY: 2.2, n: 7 }));
      add(sideLocks(ctx, { length: 2.15 }));
      for (const side of [-1, 1]) add(bun(ctx, onHead(ctx, 0.2 * Math.PI, side * 1.95, 0.26), tieColor));
      break;
    }
    case 'side': {
      add(bobBack(ctx, { endY: 2.1, n: 7 }));
      add(sideLocks(ctx, { length: 2.05 }));
      const root = onHead(ctx, 0.36 * Math.PI, 1.95, 0.12);
      tails.tailL = root.clone();
      add(tail(ctx, {
        root,
        ctrl: [V(root.x + 0.35, root.y - 0.05, root.z - 0.05), V(root.x + 0.5, root.y - 0.7, root.z), V(root.x + 0.42, root.y - 1.35, root.z + 0.08), V(root.x + 0.55, root.y - 1.8, root.z + 0.15)],
        w: 0.32, thick: 0.26, bone: BONES.tailL, tieColor,
      }));
      break;
    }
    case 'short': {
      add(bobBack(ctx, { endY: 2.3, n: 9, tuck: 0.05, pointy: true }));
      add(sideLocks(ctx, { length: 2.25, w: 0.18 }));
      break;
    }
    case 'bob':
    default: {
      add(bobBack(ctx, { endY: 1.95, n: 9, tuck: 0.14 }));
      add(sideLocks(ctx, { length: 1.98, w: 0.22 }));
    }
  }
  if (look.expression === 'cheerful' || look.bangs === 'messy') add(ahoge(ctx));
  return { parts, tails, style };
}

export { onHead, dirFrom };

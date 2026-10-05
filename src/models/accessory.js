// Head accessories: ribbon, bunny/cat/fox ears, hairpin, beret, witch hat, horns, flower,
// goggles, hood, headband, crown.
import * as THREE from 'three';
import { BONES, LM } from './body.js';
import {
  part, ellipsoid, sphere, cone, cyl, torus, strand, smoothPath, seg, lathe, star, extrude,
} from './geom.js';
import { col } from './toon.js';
import { onHead, dirFrom } from './hair.js';
import { bow } from './outfit.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = LM.headCenter;

/** Quaternion that turns +y to point along the outward head normal at (θ, φ). */
function alignOut(theta, phi, extraTilt = 0) {
  const d = dirFrom(theta + extraTilt, phi);
  return new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d);
}

function placed(g, q, p) {
  g.applyQuaternion(q);
  g.translate(p.x, p.y, p.z);
  return g;
}

function animalEar(ctx, side, { kind }) {
  const parts = [];
  const hair = col(ctx.pal.hair);
  const inner = col('#ffb3c7');
  const th = kind === 'bunny' ? 0.1 * Math.PI : 0.2 * Math.PI;
  const ph = side * (kind === 'bunny' ? 0.45 : 0.85);
  const base = onHead(ctx, th, ph, 0.08);
  const q = alignOut(th, ph, kind === 'bunny' ? -0.15 : 0.05);
  const s = seg(ctx.quality, 12, 10, 7);
  if (kind === 'bunny') {
    const outer = ellipsoid(0.17, 0.62, 0.09, s, s);
    outer.translate(0, 0.52, 0);
    if (side < 0) {
      // one floppy ear
      const p = outer.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        if (y > 0.6) {
          const t = (y - 0.6);
          p.setXYZ(i, p.getX(i) - t * 0.6, 0.6 + t * 0.6, p.getZ(i) + t * 0.5);
        }
      }
      outer.computeVertexNormals();
    }
    const innerG = ellipsoid(0.1, 0.45, 0.05, s, s);
    innerG.translate(0, 0.5, 0.06);
    if (side < 0) {
      const p = innerG.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        if (y > 0.6) {
          const t = (y - 0.6);
          p.setXYZ(i, p.getX(i) - t * 0.6, 0.6 + t * 0.6, p.getZ(i) + t * 0.5);
        }
      }
      innerG.computeVertexNormals();
    }
    const white = col('#fdfbff');
    parts.push(part(placed(outer, q, base), { color: white, bone: BONES.head }));
    parts.push(part(placed(innerG, q, base), { color: inner, bone: BONES.head }));
  } else {
    const fox = kind === 'fox';
    const h = fox ? 0.62 : 0.46;
    const r = fox ? 0.3 : 0.27;
    const outer = cone(r, h, 4);
    outer.rotateY(Math.PI / 4);
    outer.scale(1, 1, 0.45);
    outer.translate(0, h / 2, 0);
    const innerG = cone(r * 0.6, h * 0.7, 4);
    innerG.rotateY(Math.PI / 4);
    innerG.scale(1, 1, 0.3);
    innerG.translate(0, h * 0.35, 0.06);
    const tip = fox ? col('#fff7ef') : hair;
    parts.push(part(placed(outer, q, base), { color: (p) => (p.distanceTo(base) > h * 0.72 && fox ? tip : hair), bone: BONES.head }));
    parts.push(part(placed(innerG, q, base), { color: fox ? col('#fff2e6') : inner, bone: BONES.head }));
  }
  return parts;
}

/** Builds the accessory for ctx.look.accessory. -> { parts } */
export function buildAccessory(ctx) {
  const { look, pal } = ctx;
  const parts = [];
  const add = (x) => (Array.isArray(x) ? parts.push(...x) : x && parts.push(x));
  const acc = col(pal.accent);
  const s = seg(ctx.quality, 16, 12, 8);
  switch (look.accessory) {
    case 'ribbon': {
      const th = 0.24 * Math.PI;
      const ph = Math.PI * 0.82;
      const p = onHead(ctx, th, ph, 0.16);
      const d = dirFrom(th, ph);
      add(bow(ctx, { pos: [p.x, p.y, p.z], size: 0.42, color: pal.accent, bone: BONES.head, rot: [-0.5, Math.atan2(d.x, d.z), 0] }));
      break;
    }
    case 'bunnyEars':
      for (const side of [-1, 1]) add(animalEar(ctx, side, { kind: 'bunny' }));
      add(part(torus(1.02, 0.04, 6, s * 2, Math.PI), { pos: [C.x, C.y + 0.15, C.z - 0.05], rot: [0, Math.PI / 2, Math.PI / 2], scale: [1.08, 1.04, 1.04], color: acc, bone: BONES.head }));
      break;
    case 'catEars':
      for (const side of [-1, 1]) add(animalEar(ctx, side, { kind: 'cat' }));
      break;
    case 'foxEars':
      for (const side of [-1, 1]) add(animalEar(ctx, side, { kind: 'fox' }));
      break;
    case 'hairpin': {
      const th = 0.4 * Math.PI;
      const ph = 0.82;
      const p = onHead(ctx, th, ph, 0.13);
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), dirFrom(th, ph));
      for (const r of [0.6, -0.6]) {
        const g = cyl(0.025, 0.025, 0.36, 6);
        g.rotateZ(r);
        add(part(placed(g, q, p), { color: acc, bone: BONES.head }));
      }
      const st = extrude(star(5, 0.13, 0.06), 0.05);
      add(part(placed(st, q, p.clone().addScaledVector(dirFrom(th, ph), 0.03).add(V(0.12, 0.1, 0))), { color: col('#ffe066'), bone: BONES.head }));
      break;
    }
    case 'beret': {
      const top = onHead(ctx, 0.12 * Math.PI, -0.4, 0.14);
      const g = lathe([[0.0, 0.18], [0.5, 0.15], [0.86, 0.04], [0.9, -0.02], [0.72, -0.08], [0.55, -0.05], [0.0, -0.02]], s * 2);
      add(part(g, { pos: [top.x, top.y + 0.02, top.z - 0.05], rot: [-0.25, 0, 0.22], color: acc.clone().lerp(col('#1d2440'), 0.15), bone: BONES.head }));
      add(part(cyl(0.03, 0.05, 0.12, 6), { pos: [top.x + 0.03, top.y + 0.24, top.z - 0.08], color: acc, bone: BONES.head }));
      break;
    }
    case 'witchHat': {
      const top = V(0, C.y + 1.12 + (ctx.adult ? 0.02 : 0), C.z - 0.05);
      const purple = col(pal.outfit);
      const band = acc;
      const brim = lathe([[0.0, 0.03], [1.25, 0.02], [1.55, -0.04], [1.5, -0.08], [1.0, -0.04], [0.0, -0.02]], s * 2);
      add(part(brim, { pos: [top.x, top.y - 0.08, top.z], rot: [-0.18, 0, 0.08], color: purple, bone: BONES.head }));
      // Bent cone built from a strand with a wide base.
      const ctrl = smoothPath([[0, 0, 0], [0, 0.6, -0.05], [0.05, 1.05, -0.25], [0.35, 1.25, -0.5]], 12);
      const cone2 = strand(ctrl, (t) => [0.78 * (1 - t) + 0.02, 0.78 * (1 - t) + 0.02], { radial: s, up: () => V(0, 0, 1) });
      add(part(cone2, { pos: [top.x, top.y - 0.08, top.z], rot: [-0.18, 0, 0.08], color: (p) => (p.y < top.y + 0.12 && p.y > top.y - 0.02 ? band : purple), bone: BONES.head }));
      add(part(extrude(star(5, 0.16, 0.07), 0.05), { pos: [top.x + 0.35, top.y + 0.12, top.z + 0.62], rot: [-0.2, 0, 0], color: col('#ffe066'), bone: BONES.head }));
      break;
    }
    case 'horns': {
      for (const side of [-1, 1]) {
        const b = onHead(ctx, 0.2 * Math.PI, side * 0.7, 0.05);
        const pts = smoothPath([b, b.clone().add(V(side * 0.12, 0.3, -0.05)), b.clone().add(V(side * 0.32, 0.5, -0.2)), b.clone().add(V(side * 0.5, 0.56, -0.38))], 10);
        const g = strand(pts, (t) => [0.13 * (1 - t) + 0.01, 0.13 * (1 - t) + 0.01], { radial: 8 });
        const dark = acc.clone().lerp(col('#2a1418'), 0.45);
        add(part(g, { color: (p) => (p.distanceTo(b) > 0.45 ? acc.clone().lerp(col('#ffffff'), 0.25) : dark), bone: BONES.head }));
      }
      break;
    }
    case 'flower': {
      const th = 0.4 * Math.PI;
      const ph = 1.05;
      const p = onHead(ctx, th, ph, 0.16);
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), dirFrom(th, ph));
      const petal = col(pal.accent);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const g = ellipsoid(0.14, 0.09, 0.04, 10, 6);
        g.translate(0.13, 0, 0);
        g.rotateZ(a);
        add(part(placed(g, q, p), { color: petal.clone().lerp(col('#ffffff'), 0.25), bone: BONES.head }));
      }
      add(part(placed(sphere(0.07, 8, 6), q, p.clone().addScaledVector(dirFrom(th, ph), 0.03)), { color: col('#ffd84d'), bone: BONES.head }));
      // A leaf.
      const leaf = ellipsoid(0.12, 0.05, 0.02, 8, 4);
      leaf.translate(0.24, -0.12, -0.02);
      leaf.rotateZ(-0.6);
      add(part(placed(leaf, q, p), { color: col('#5cb85c'), bone: BONES.head }));
      break;
    }
    case 'goggles': {
      const th = 0.22 * Math.PI;
      const strap = torus(1.0, 0.05, 6, s * 3);
      strap.rotateX(Math.PI / 2);
      strap.scale(1.12, 1, 1.08);
      strap.rotateX(-0.75);
      const dark = col('#3a3442');
      add(part(strap, { pos: [C.x, C.y + 0.62, C.z - 0.12], color: dark, bone: BONES.head }));
      for (const side of [-1, 1]) {
        const ph = side * 0.36;
        const p = onHead(ctx, th, ph, 0.12);
        const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dirFrom(th, ph));
        const rim = cyl(0.2, 0.22, 0.14, s);
        add(part(placed(rim, q, p), { color: acc.clone().lerp(col('#999aa8'), 0.3), bone: BONES.head }));
        const lens = sphere(0.17, s, 6, 0, Math.PI * 2, 0, Math.PI / 2);
        lens.scale(1, 0.45, 1);
        lens.translate(0, 0.07, 0);
        add(part(placed(lens, q, p), { color: col('#9be7ff'), bone: BONES.head }));
      }
      break;
    }
    case 'hood': {
      const PH = seg(ctx.quality, 36, 26, 18);
      const TH = seg(ctx.quality, 14, 10, 8);
      const pos = [];
      const idx = [];
      const outerC = col(pal.outfit);
      const lining = acc.clone().lerp(col(pal.outfit), 0.3);
      for (let j = 0; j <= TH; j++) {
        for (let i = 0; i <= PH; i++) {
          const phi = -Math.PI + (i / PH) * Math.PI * 2;
          const front = (1 + Math.cos(phi)) / 2;
          const tMax = Math.PI * (0.86 - 0.62 * Math.pow(front, 1.2));
          const th = (j / TH) * tMax;
          const p = onHead(ctx, Math.max(th, 0.001), phi, 0.2 + 0.05 * Math.sin(th));
          if (phi > 2.4 || phi < -2.4) p.y += 0.0;
          pos.push(p.x, p.y, p.z);
        }
      }
      for (let j = 0; j < TH; j++) {
        for (let i = 0; i < PH; i++) {
          const a = j * (PH + 1) + i;
          idx.push(a, a + PH + 1, a + 1, a + 1, a + PH + 1, a + PH + 2);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      add(part(g, { color: outerC, bone: BONES.head }));
      // Rim trim around the face opening.
      const rimPts = [];
      for (let i = 0; i <= PH; i++) {
        const phi = -Math.PI * 0.62 + (i / PH) * Math.PI * 1.24;
        const front = (1 + Math.cos(phi)) / 2;
        const tMax = Math.PI * (0.86 - 0.62 * Math.pow(front, 1.2));
        rimPts.push(onHead(ctx, tMax, phi, 0.23));
      }
      add(part(strand(rimPts, () => [0.07, 0.07], { radial: 6 }), { color: lining, bone: BONES.head }));
      // Little bobble on top for the younger girls.
      if (!ctx.adult) add(part(sphere(0.14, 10, 8), { pos: [0, C.y + 1.36, C.z - 0.45], color: col('#ffffff'), bone: BONES.head }));
      break;
    }
    case 'headband': {
      const band = torus(1.0, 0.07, 6, s * 3);
      band.rotateX(Math.PI / 2);
      band.scale(1.13, 1, 1.1);
      band.rotateX(-0.45);
      add(part(band, { pos: [C.x, C.y + 0.5, C.z + 0.05], color: acc, bone: BONES.head }));
      // Knot tails flowing behind.
      const k = onHead(ctx, 0.48 * Math.PI, Math.PI, 0.14);
      for (const side of [-1, 1]) {
        const pts = smoothPath([k, k.clone().add(V(side * 0.18, -0.2, -0.2)), k.clone().add(V(side * 0.35, -0.6, -0.35))], 8);
        add(part(strand(pts, (t) => [0.08 - 0.02 * t, 0.025], { radial: 6, up: () => V(0, 0, -1) }), { color: acc, bone: BONES.tailB }));
      }
      break;
    }
    case 'crown': {
      const gold = col(pal.accent);
      const base = onHead(ctx, 0.2 * Math.PI, 0, 0.24);
      const ring = torus(0.5, 0.045, 6, s * 2, Math.PI * 1.1);
      ring.rotateZ(-Math.PI * 0.05);
      add(part(ring, { pos: [base.x, base.y - 0.05, base.z - 0.25], rot: [-0.9, 0, 0], color: gold, bone: BONES.head }));
      for (let i = -2; i <= 2; i++) {
        const a = i * 0.32;
        const h = i === 0 ? 0.48 : 0.32 - Math.abs(i) * 0.04;
        const c = cone(0.06, h, 5);
        c.translate(0, h / 2, 0);
        c.rotateZ(-a * 0.6);
        const px = Math.sin(a) * 0.5;
        add(part(c, { pos: [base.x + px, base.y + 0.02 - Math.abs(i) * 0.05, base.z + Math.cos(a) * 0.08 - 0.12], rot: [-0.35, 0, 0], color: gold, bone: BONES.head }));
      }
      add(part(ellipsoid(0.08, 0.1, 0.05, 8, 6), { pos: [base.x, base.y + 0.06, base.z + 0.02], color: col('#7fd6ff'), bone: BONES.head }));
      break;
    }
    default:
      break;
  }
  return { parts };
}

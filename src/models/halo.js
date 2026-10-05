// Floating Blue-Archive-style halos. Flat emissive shapes built from 2D outlines, lying in
// the XZ plane around the halo bone pivot. Shapes: ring, star, petal, gear, moon, flame,
// wave, crown, snow, bolt, leaf, eye.
import * as THREE from 'three';
import { BONES, LM } from './body.js';
import { bindBone, clean, paint, merge, star as starShape, seg, cone, sphere, xform } from './geom.js';

function radialShape(rOut, fn, steps = 96) {
  const s = new THREE.Shape();
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = rOut * fn(a);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  return s;
}

function hole(r, steps = 64) {
  const p = new THREE.Path();
  for (let i = 0; i <= steps; i++) {
    const a = -(i / steps) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
  }
  return p;
}

function annulus(rOut, rIn, fn = () => 1, steps = 96) {
  const s = radialShape(rOut, fn, steps);
  s.holes.push(hole(rIn, Math.max(32, steps / 2)));
  return s;
}

function flat(shapes, depth = 0.05, curveSegments = 12) {
  const list = Array.isArray(shapes) ? shapes : [shapes];
  const g = new THREE.ExtrudeGeometry(list, { depth, bevelEnabled: false, curveSegments });
  g.translate(0, 0, -depth / 2);
  g.rotateX(-Math.PI / 2);
  return g;
}

function ellipseShape(cx, cy, rx, ry, rot = 0, steps = 24) {
  const s = new THREE.Shape();
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x0 = Math.cos(a) * rx;
    const y0 = Math.sin(a) * ry;
    const x = cx + x0 * Math.cos(rot) - y0 * Math.sin(rot);
    const y = cy + x0 * Math.sin(rot) + y0 * Math.cos(rot);
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  return s;
}

function moved(shape, x, y, rot = 0, scale = 1) {
  const pts = shape.getPoints(16);
  const s = new THREE.Shape();
  pts.forEach((p, i) => {
    const px = (p.x * Math.cos(rot) - p.y * Math.sin(rot)) * scale + x;
    const py = (p.x * Math.sin(rot) + p.y * Math.cos(rot)) * scale + y;
    if (i === 0) s.moveTo(px, py); else s.lineTo(px, py);
  });
  return s;
}

/** Builds the halo geometry for ctx.look.halo. -> { geometry, glowGeometry, color } */
export function buildHalo(ctx) {
  const kind = ctx.look.halo || 'ring';
  const color = ctx.pal.halo || '#bfe8ff';
  const R = ctx.adult ? 0.78 : 0.72;
  const steps = seg(ctx.quality, 128, 96, 64);
  const geos = [];
  switch (kind) {
    case 'star': {
      geos.push(flat(annulus(R, R - 0.07, () => 1, steps)));
      const st = starShape(5, 0.2, 0.08);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
        geos.push(flat(moved(st, Math.cos(a) * R, Math.sin(a) * R, a - Math.PI / 2)));
      }
      break;
    }
    case 'petal': {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        geos.push(flat(ellipseShape(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9, 0.2, 0.09, a)));
      }
      geos.push(flat(annulus(R * 0.62, R * 0.56, () => 1, steps)));
      break;
    }
    case 'gear':
      geos.push(flat(annulus(R, R - 0.17, (a) => (Math.cos(a * 12) > 0.2 ? 1 : 0.86), steps * 2)));
      break;
    case 'moon': {
      const s = radialShape(R, () => 1, steps);
      const cut = new THREE.Path();
      for (let i = 0; i <= 48; i++) {
        const a = -(i / 48) * Math.PI * 2;
        const x = Math.cos(a) * R * 0.86 + R * 0.28;
        const y = Math.sin(a) * R * 0.86 + R * 0.08;
        if (i === 0) cut.moveTo(x, y); else cut.lineTo(x, y);
      }
      s.holes.push(cut);
      geos.push(flat(s));
      geos.push(flat(moved(starShape(4, 0.16, 0.05), R * 0.55, -R * 0.1, 0)));
      break;
    }
    case 'flame':
      geos.push(flat(annulus(R, R - 0.22, (a) => 0.82 + 0.18 * Math.pow(Math.abs(Math.sin(a * 4.5)), 3), steps * 2)));
      break;
    case 'wave':
      geos.push(flat(annulus(R, R - 0.14, (a) => 0.92 + 0.08 * Math.sin(a * 10), steps * 2)));
      geos.push(flat(annulus(R * 0.7, R * 0.66, () => 1, steps)));
      break;
    case 'crown': {
      geos.push(flat(annulus(R, R - 0.08, () => 1, steps), 0.08));
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const c = cone(0.07, 0.28, 6);
        xform(c, { pos: [Math.cos(a) * (R - 0.04), 0.16, -Math.sin(a) * (R - 0.04)] });
        geos.push(c);
        geos.push(xform(sphere(0.045, 6, 4), { pos: [Math.cos(a) * (R - 0.04), 0.32, -Math.sin(a) * (R - 0.04)] }));
      }
      break;
    }
    case 'snow': {
      geos.push(flat(annulus(R, R - 0.05, () => 1, steps)));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const arm = new THREE.Shape();
        arm.moveTo(0, -0.03); arm.lineTo(R * 0.55, -0.03); arm.lineTo(R * 0.6, 0); arm.lineTo(R * 0.55, 0.03); arm.lineTo(0, 0.03);
        geos.push(flat(moved(arm, Math.cos(a) * R * 0.98, Math.sin(a) * R * 0.98, a, 0.5)));
        geos.push(flat(moved(starShape(6, 0.1, 0.04), Math.cos(a + Math.PI / 6) * R, Math.sin(a + Math.PI / 6) * R, 0)));
      }
      break;
    }
    case 'bolt':
      geos.push(flat(annulus(R, R - 0.12, (a) => {
        const k = ((a / (Math.PI * 2)) * 10) % 1;
        return 0.88 + (k < 0.5 ? k : 1 - k) * 0.3;
      }, steps * 2)));
      break;
    case 'leaf': {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        geos.push(flat(ellipseShape(Math.cos(a) * R, Math.sin(a) * R, 0.17, 0.07, a + 0.6)));
      }
      geos.push(flat(annulus(R - 0.02, R - 0.07, () => 1, steps)));
      break;
    }
    case 'eye': {
      geos.push(flat(annulus(R, R - 0.06, () => 1, steps)));
      const eye = new THREE.Shape();
      eye.moveTo(-R * 0.55, 0);
      eye.quadraticCurveTo(0, R * 0.42, R * 0.55, 0);
      eye.quadraticCurveTo(0, -R * 0.42, -R * 0.55, 0);
      eye.holes.push(hole(R * 0.17, 24));
      geos.push(flat(eye));
      geos.push(flat(ellipseShape(0, 0, R * 0.08, R * 0.08)));
      break;
    }
    case 'ring':
    default: {
      geos.push(flat(annulus(R, R - 0.08, () => 1, steps)));
      geos.push(flat(annulus(R - 0.15, R - 0.19, () => 1, steps)));
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        geos.push(flat(moved(starShape(4, 0.1, 0.035), Math.cos(a) * (R + 0.09), Math.sin(a) * (R + 0.09), a)));
      }
    }
  }
  const P = LM.halo;
  const parts = geos.map((g) => {
    clean(g);
    g.translate(P.x, P.y, P.z);
    paint(g, '#ffffff');
    bindBone(g, BONES.halo);
    return g;
  });
  const geometry = merge(parts);
  // Soft glow: a thin flat disc ring slightly bigger than the halo.
  const glow = new THREE.RingGeometry(R * 0.55, R * 1.22, seg(ctx.quality, 48, 32, 24), 1);
  glow.rotateX(-Math.PI / 2);
  const gp = glow.attributes.position;
  const colors = new Float32Array(gp.count * 3);
  for (let i = 0; i < gp.count; i++) {
    const r = Math.hypot(gp.getX(i), gp.getZ(i));
    const f = 1 - Math.min(1, Math.abs(r - R * 0.92) / (R * 0.32));
    colors.set([f, f, f], i * 3);
  }
  glow.translate(P.x, P.y, P.z);
  clean(glow);
  glow.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  bindBone(glow, BONES.halo);
  return { geometry, glowGeometry: glow, color };
}

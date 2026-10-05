// Outfits: per-region body colours + 3D costume pieces (collars, skirts, sleeves, armour…).
// All coordinates are girl space (see body.js). Pieces are bound rigidly to one bone.
import * as THREE from 'three';
import { REGION, BONES } from './body.js';
import {
  part, sphere, ellipsoid, cyl, torus, box, strand, smoothPath, seg, lathe,
} from './geom.js';
import { col, mix } from './toon.js';

const SOCKS_WHITE = '#f6f6fb';
const TIGHTS_DARK = '#2e2c3c';
const LOAFER = '#4a3134';

const BODY_Z = -0.2; // torso centre line in z

/**
 * Region colours (THREE.Color per REGION id) and outfit metadata for a unit.
 */
export function outfitSpec(unit, pal, look) {
  const skin = col(pal.skin);
  const r = new Array(10).fill(skin);
  r[REGION.HEAD] = skin;
  r[REGION.NECK] = skin;
  r[REGION.HAND] = skin;
  const set = (torso, upper, fore, hips, thigh, shin, foot) => {
    r[REGION.TORSO] = col(torso);
    r[REGION.UPPERARM] = col(upper);
    r[REGION.FOREARM] = col(fore);
    r[REGION.HIPS] = col(hips);
    r[REGION.THIGH] = col(thigh);
    r[REGION.SHIN] = col(shin);
    r[REGION.FOOT] = col(foot);
  };
  const dark = (c, f = 0.55) => `#${col(c).multiplyScalar(f).getHexString()}`;
  switch (look.outfit) {
    case 'blazer':
      set(pal.outfit, pal.outfit, pal.outfit, pal.outfitShade, TIGHTS_DARK, TIGHTS_DARK, '#241c22');
      break;
    case 'miko':
      set(pal.outfit, pal.outfit, pal.outfit, pal.accent, pal.accent, pal.accent, '#f4f1ec');
      break;
    case 'kimono':
      set(pal.outfit, pal.outfit, pal.outfit, pal.outfit, pal.skin, SOCKS_WHITE, dark(pal.accent, 0.6));
      break;
    case 'hoodie':
      set(pal.outfit, pal.outfit, pal.outfit, pal.outfitShade, pal.skin, '#3a3850', mixHexCol(pal.accent, '#ffffff', 0.15));
      break;
    case 'dress':
      set(pal.outfit, pal.outfit, pal.skin, pal.outfit, pal.skin, SOCKS_WHITE, dark(pal.accent, 0.7));
      break;
    case 'armor':
      set(pal.outfit, pal.outfitShade, pal.outfit, pal.outfitShade, pal.outfitShade, pal.outfit, pal.accent);
      break;
    case 'coat':
      set(pal.outfit, pal.outfit, pal.outfit, pal.outfitShade, TIGHTS_DARK, dark(pal.outfit, 0.8), dark(pal.outfit, 0.6));
      break;
    case 'apron':
      set(mixHexCol(pal.accent, '#ffffff', 0.25), pal.outfit, pal.skin, mixHexCol(pal.accent, '#ffffff', 0.25), pal.skin, SOCKS_WHITE, LOAFER);
      break;
    case 'jumpsuit':
      set(pal.outfit, pal.outfit, pal.skin, pal.outfit, pal.outfit, pal.outfitShade, '#3a3440');
      break;
    case 'robe':
      set(pal.outfit, pal.outfit, pal.outfit, pal.outfit, pal.outfit, pal.outfitShade, dark(pal.outfitShade, 0.7));
      break;
    case 'sailor':
    default:
      set(pal.outfit, pal.outfit, pal.outfit, pal.outfitShade, pal.skin, SOCKS_WHITE, LOAFER);
  }
  return { regions: r };
}

function mixHexCol(a, b, t) {
  return `#${mix(a, b, t).getHexString()}`;
}

// ---------------------------------------------------------------------------
// Shared costume builders
// ---------------------------------------------------------------------------

/**
 * Closed (thick) skirt shell by lathe. `flare` widens the hem; pleats add zig-zag folds.
 * colorFn(y, phi) -> THREE.Color lets us paint plaid, hems and stripes.
 */
function skirt(ctx, { top = 1.02, bottom = 0.5, rTop = 0.62, rBot = 0.98, pleats = 14, depth = 0.04, zScale = 0.82, colorFn, openFront = 0, bone = BONES.skirt, curve = 0.6 }) {
  const rings = 7;
  const radial = seg(ctx.quality, 48, 36, 24);
  const outer = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const y = top + (bottom - top) * t;
    const rr = rTop + (rBot - rTop) * Math.pow(t, curve);
    outer.push([rr, y]);
  }
  // Profile: outer surface downwards, then the hem, then inner surface upwards.
  const prof = [...outer, ...outer.slice().reverse().map(([rr, y]) => [rr - depth, y])];
  const phiStart = openFront > 0 ? openFront / 2 : 0;
  const phiLen = Math.PI * 2 - openFront;
  const g = lathe(prof.map(([rr, y]) => [rr, y]), radial, phiStart, phiLen);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const phi = Math.atan2(v.x, v.z);
    const t = THREE.MathUtils.clamp((top - v.y) / (top - bottom), 0, 1);
    const pleat = pleats ? Math.abs(Math.sin((phi * pleats) / 2)) * 0.05 * t : 0;
    const k = 1 + pleat;
    v.x *= k;
    v.z *= k * zScale;
    pos.setXYZ(i, v.x, v.y, v.z + BODY_Z);
  }
  g.computeVertexNormals();
  return part(g, {
    bone,
    color: (p) => colorFn(p.y, Math.atan2(p.x, p.z - BODY_Z), THREE.MathUtils.clamp((top - p.y) / (top - bottom), 0, 1)),
  });
}

/** Elliptic band around the torso (belts, obi, hems). */
function band(ctx, y, h, rx, rz, color, bone = BONES.hips) {
  const g = cyl(1, 1, h, seg(ctx.quality, 32, 24, 16));
  g.scale(rx, 1, rz);
  return part(g, { pos: [0, y, BODY_Z], color, bone });
}

/** A ribbon bow (two loops, knot, two tails), facing +z unless rotated. */
export function bow(ctx, { pos, size = 0.22, color, bone, rot = [0, 0, 0], tails = true }) {
  const parts = [];
  const c = col(color);
  const dark = c.clone().multiplyScalar(0.8);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
  const P = new THREE.Vector3(...pos);
  const place = (g) => {
    g.applyQuaternion(q);
    g.translate(P.x, P.y, P.z);
    return g;
  };
  const s = seg(ctx.quality, 14, 10, 8);
  for (const side of [-1, 1]) {
    const loop = ellipsoid(size * 0.62, size * 0.42, size * 0.2, s, Math.max(6, s - 4));
    loop.rotateZ(side * -0.35);
    loop.translate(side * size * 0.58, size * 0.06, 0);
    parts.push(part(place(loop), { color: (p) => c.clone().lerp(dark, 0.3), bone }));
    if (tails) {
      const pts = smoothPath([[side * size * 0.1, -size * 0.05, 0.02], [side * size * 0.35, -size * 0.55, 0.0], [side * size * 0.5, -size * 1.0, -0.02]], 6);
      const tail = strand(pts, (t) => [size * (0.2 + 0.08 * t), size * 0.05], { radial: 6, up: () => new THREE.Vector3(0, 0, 1) });
      // Notched end: shorten one side by tilting the last ring.
      parts.push(part(place(tail), { color: dark, bone }));
    }
  }
  const knot = ellipsoid(size * 0.22, size * 0.26, size * 0.2, s, Math.max(6, s - 4));
  parts.push(part(place(knot), { color: c, bone }));
  return parts;
}

/** Arm frame helper: shoulder, hand, and a point at fraction t along the arm. */
function armPoint(ctx, side, t) {
  const sh = new THREE.Vector3(side * 0.53, 1.31, -0.2);
  const hand = side > 0 ? ctx.base.handL : ctx.base.handR;
  return sh.clone().lerp(hand, t);
}

function armDir(ctx, side) {
  const sh = new THREE.Vector3(side * 0.53, 1.31, -0.2);
  const hand = side > 0 ? ctx.base.handL : ctx.base.handR;
  return hand.clone().sub(sh).normalize();
}

/** Ring around the arm at fraction t (cuffs). */
function cuff(ctx, side, t, radius, tube, color) {
  const g = torus(radius, tube, seg(ctx.quality, 8, 6, 5), seg(ctx.quality, 18, 14, 10));
  g.rotateX(Math.PI / 2);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), armDir(ctx, side)));
  const p = armPoint(ctx, side, t);
  return part(g, { pos: [p.x, p.y, p.z], color, bone: side > 0 ? BONES.armL : BONES.armR });
}

/** Puffy shoulder sleeve. */
function puff(ctx, side, color, size = 0.26) {
  const p = armPoint(ctx, side, 0.12);
  const g = ellipsoid(size, size * 0.9, size * 0.95, seg(ctx.quality, 14, 10, 8), seg(ctx.quality, 10, 8, 6));
  return part(g, { pos: [p.x + side * 0.02, p.y + 0.02, p.z], color, bone: side > 0 ? BONES.armL : BONES.armR });
}

/** Wide hanging sleeve (kimono/miko/robe): a flared bell hanging from the forearm. */
function wideSleeve(ctx, side, color, trim, length = 0.62) {
  const dir = armDir(ctx, side);
  const p0 = armPoint(ctx, side, 0.35);
  const radial = seg(ctx.quality, 16, 12, 8);
  const g = lathe([[0.15, 0.0], [0.22, -0.18], [0.3, -length * 0.7], [0.32, -length], [0.28, -length], [0.2, -length * 0.6], [0.11, -0.05]], radial);
  g.scale(1, 1, 0.8);
  // Align bell axis roughly with the arm, then let it droop a little towards vertical.
  const axis = dir.clone().lerp(new THREE.Vector3(0, -1, 0), 0.5).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), axis));
  const tr = col(trim);
  const c = col(color);
  return part(g, {
    pos: [p0.x, p0.y, p0.z],
    bone: side > 0 ? BONES.armL : BONES.armR,
    color: (p) => ((p0.y - p.y) > length * 0.62 ? tr : c),
  });
}

/** Flat panel following the front of the torso (aprons, tabards). */
function frontPanel(ctx, { yTop, yBot, wTop, wBot, z = 0.17, color, bone = BONES.chest, curve = 0.5 }) {
  const shape = new THREE.Shape();
  shape.moveTo(-wTop, 0);
  shape.lineTo(wTop, 0);
  shape.quadraticCurveTo(wBot * 1.05, (yBot - yTop) * 0.5, wBot, yBot - yTop);
  shape.quadraticCurveTo(0, (yBot - yTop) - 0.06, -wBot, yBot - yTop);
  shape.quadraticCurveTo(-wBot * 1.05, (yBot - yTop) * 0.5, -wTop, 0);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1, curveSegments: seg(ctx.quality, 10, 8, 5) });
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    // wrap around the body
    const bend = curve * x * x;
    pos.setZ(i, pos.getZ(i) - bend);
  }
  g.computeVertexNormals();
  return part(g, { pos: [0, yTop, z], color, bone });
}

/** Back flap of a sailor collar + the two front lapels. */
function sailorCollar(ctx, color, stripe) {
  const parts = [];
  const c = col(color);
  const st = col(stripe);
  // Back flap: a slightly curved square resting on the shoulders.
  const g = box(0.9, 0.48, 0.05, 8, 4, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, pos.getZ(i) + x * x * 0.35);
  }
  g.rotateX(-0.25);
  g.computeVertexNormals();
  parts.push(part(g, {
    pos: [0, 1.42, -0.6], bone: BONES.chest,
    color: (p) => {
      const ex = 0.45 - Math.abs(p.x);
      const ey = p.y - 1.2;
      return ex < 0.07 && ex > 0.035 || (ey < 0.08 && ey > 0.045) ? st : c;
    },
  }));
  // Lapels: broad ribbons from shoulders to the V at the chest.
  for (const side of [-1, 1]) {
    const pts = smoothPath([[side * 0.36, 1.6, -0.35], [side * 0.42, 1.55, -0.02], [side * 0.22, 1.42, 0.11], [side * 0.03, 1.24, 0.15]], 8);
    const lap = strand(pts, (t) => [0.13 - 0.07 * t, 0.025], { radial: 6, up: (t, p) => new THREE.Vector3(p.x * 0.6, 0.5, 1).normalize() });
    parts.push(part(lap, { color: (p, n, i) => (i % 6 === 0 || i % 6 === 3 ? st : c), bone: BONES.chest }));
  }
  return parts;
}

/** Shirt collar points (blazer / dress). */
function shirtCollar(ctx, color) {
  const parts = [];
  for (const side of [-1, 1]) {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(side * 0.2, 0.02);
    s.lineTo(side * 0.07, -0.16);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false });
    g.rotateX(-0.5);
    parts.push(part(g, { pos: [side * 0.03, 1.6, 0.06], color, bone: BONES.chest }));
  }
  parts.push(band(ctx, 1.6, 0.07, 0.3, 0.28, color, BONES.chest));
  return parts;
}

function necktie(ctx, color) {
  const pts = smoothPath([[0, 1.56, 0.12], [0, 1.4, 0.15], [0, 1.18, 0.17]], 6);
  const g = strand(pts, (t) => [0.04 + 0.06 * t, 0.02], { radial: 6, up: () => new THREE.Vector3(0, 0, 1) });
  return [part(g, { color, bone: BONES.chest }), part(sphere(0.05, 8, 6), { pos: [0, 1.56, 0.12], color, bone: BONES.chest })];
}

function buttons(ctx, xs, ys, z, color, bone = BONES.chest) {
  const parts = [];
  for (const y of ys) {
    for (const x of xs) parts.push(part(sphere(0.035, 6, 4), { pos: [x, y, z], color, bone }));
  }
  return parts;
}

/** Cape: a thick shell hanging from the shoulders around the back (open at the front). */
function cape(ctx, color, lining, length = 1.0) {
  const c = col(color);
  const l = col(lining);
  const top = 1.62;
  return [
    skirt(ctx, {
      top, bottom: Math.max(0.08, top - length), rTop: 0.5, rBot: 1.08, pleats: 6, depth: 0.05, zScale: 0.95,
      openFront: Math.PI * 2 - 2.7, bone: BONES.chest, curve: 0.7,
      colorFn: (y, phi, t) => (t > 0.94 ? l : c),
    }),
    band(ctx, top - 0.02, 0.08, 0.42, 0.36, l, BONES.chest),
  ];
}

// ---------------------------------------------------------------------------
// Outfits
// ---------------------------------------------------------------------------

/** Builds costume pieces for the unit's outfit. -> { parts } */
export function buildOutfit(ctx) {
  const { pal, look, adult } = ctx;
  const parts = [];
  const o = col(pal.outfit);
  const os = col(pal.outfitShade);
  const acc = col(pal.accent);
  const white = col('#fbfbff');
  const add = (x) => (Array.isArray(x) ? parts.push(...x.filter(Boolean)) : x && parts.push(x));

  switch (look.outfit) {
    case 'sailor': {
      const navy = mix(pal.outfitShade, '#22336b', 0.85);
      add(sailorCollar(ctx, navy, '#ffffff'));
      add(bow(ctx, { pos: [0, 1.27, 0.2], size: 0.2, color: pal.accent, bone: BONES.chest }));
      add(skirt(ctx, { top: 1.0, bottom: 0.5, rTop: 0.6, rBot: 0.95, pleats: 16, colorFn: (y, phi, t) => (t > 0.82 && t < 0.9 ? white : navy.clone().lerp(o, 0.12)) }));
      add(cuff(ctx, 1, 0.66, 0.13, 0.035, navy));
      add(cuff(ctx, -1, 0.66, 0.13, 0.035, navy));
      break;
    }
    case 'blazer': {
      const plaid = (y, phi) => {
        const a = Math.sin(phi * 10) > 0.6;
        const b = Math.sin(y * 40) > 0.75;
        const base = os.clone();
        if (a && b) return base.lerp(acc, 0.7);
        if (a || b) return base.lerp(acc, 0.32);
        return base;
      };
      add(skirt(ctx, { top: 1.0, bottom: 0.52, rTop: 0.6, rBot: 0.92, pleats: 18, colorFn: plaid }));
      add(shirtCollar(ctx, white));
      add(necktie(ctx, acc));
      // Lapels as a deep V in the jacket colour.
      for (const side of [-1, 1]) {
        const pts = smoothPath([[side * 0.2, 1.6, 0.06], [side * 0.18, 1.42, 0.13], [side * 0.06, 1.18, 0.17]], 6);
        add(part(strand(pts, (t) => [0.07 + 0.03 * Math.sin(t * Math.PI), 0.025], { radial: 6, up: () => new THREE.Vector3(0, 0.3, 1).normalize() }), { color: o.clone().multiplyScalar(0.8), bone: BONES.chest }));
      }
      add(buttons(ctx, [-0.08], [1.08, 0.96], 0.17, acc));
      add(band(ctx, 0.96, 0.18, 0.62, 0.4, o, BONES.hips));
      add(cuff(ctx, 1, 0.68, 0.13, 0.04, white));
      add(cuff(ctx, -1, 0.68, 0.13, 0.04, white));
      break;
    }
    case 'miko': {
      const red = acc;
      add(skirt(ctx, { top: 1.0, bottom: 0.1, rTop: 0.6, rBot: 0.8, pleats: 10, curve: 0.8, colorFn: () => red }));
      add(band(ctx, 1.0, 0.12, 0.6, 0.39, red, BONES.hips));
      add(bow(ctx, { pos: [0, 1.0, 0.2], size: 0.16, color: pal.accent, bone: BONES.hips, tails: true }));
      add(wideSleeve(ctx, 1, o, red, 0.66));
      add(wideSleeve(ctx, -1, o, red, 0.66));
      // Red V lining at the collar.
      for (const side of [-1, 1]) {
        const pts = smoothPath([[side * 0.24, 1.62, -0.02], [side * 0.12, 1.42, 0.12], [side * 0.0, 1.2, 0.15]], 6);
        add(part(strand(pts, () => [0.045, 0.02], { radial: 5, up: () => new THREE.Vector3(0, 0, 1) }), { color: red, bone: BONES.chest }));
      }
      break;
    }
    case 'kimono': {
      add(skirt(ctx, { top: 1.0, bottom: 0.42, rTop: 0.6, rBot: 0.82, pleats: 0, colorFn: (y, phi, t) => (t > 0.85 ? acc : (Math.sin(phi * 6 + y * 12) > 0.93 ? col('#ffffff') : o)) }));
      add(band(ctx, 1.08, 0.24, 0.6, 0.39, acc, BONES.hips));
      add(band(ctx, 1.08, 0.05, 0.61, 0.4, col('#ffd166'), BONES.hips));
      add(bow(ctx, { pos: [0, 1.1, -0.62], size: 0.3, color: pal.accent, bone: BONES.hips, rot: [0, Math.PI, 0] }));
      add(wideSleeve(ctx, 1, o, acc, 0.5));
      add(wideSleeve(ctx, -1, o, acc, 0.5));
      for (const side of [-1, 1]) {
        const pts = smoothPath([[side * 0.24, 1.62, -0.02], [side * 0.12, 1.42, 0.12], [side * -0.02, 1.2, 0.15]], 6);
        add(part(strand(pts, () => [0.05, 0.02], { radial: 5, up: () => new THREE.Vector3(0, 0, 1) }), { color: acc, bone: BONES.chest }));
      }
      break;
    }
    case 'hoodie': {
      // Oversized hoodie hem + hood + strings + pocket.
      add(skirt(ctx, { top: 1.05, bottom: 0.62, rTop: 0.62, rBot: 0.7, pleats: 0, depth: 0.08, colorFn: (y, phi, t) => (t > 0.8 ? o.clone().multiplyScalar(0.82) : o) }));
      const hood = sphere(0.5, seg(ctx.quality, 18, 14, 10), seg(ctx.quality, 10, 8, 6), 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.5);
      hood.scale(1, 0.7, 0.8);
      add(part(hood, { pos: [0, 1.62, -0.52], rot: [-0.9, 0, 0], color: (p) => (p.z > -0.4 ? acc.clone().lerp(o, 0.4) : o.clone().multiplyScalar(0.92)), bone: BONES.chest }));
      for (const side of [-1, 1]) {
        const pts = smoothPath([[side * 0.12, 1.58, 0.1], [side * 0.13, 1.4, 0.15], [side * 0.15, 1.26, 0.16]], 5);
        add(part(strand(pts, () => [0.018, 0.018], { radial: 5 }), { color: white, bone: BONES.chest }));
        add(part(sphere(0.035, 6, 4), { pos: [side * 0.15, 1.25, 0.16], color: acc, bone: BONES.chest }));
      }
      add(frontPanel(ctx, { yTop: 0.98, yBot: 0.76, wTop: 0.3, wBot: 0.34, z: 0.16, color: o.clone().multiplyScalar(0.88), bone: BONES.hips, curve: 0.6 }));
      add(cuff(ctx, 1, 0.7, 0.14, 0.05, o.clone().multiplyScalar(0.85)));
      add(cuff(ctx, -1, 0.7, 0.14, 0.05, o.clone().multiplyScalar(0.85)));
      break;
    }
    case 'dress': {
      const frill = white;
      add(skirt(ctx, { top: 1.02, bottom: 0.42, rTop: 0.6, rBot: 1.02, pleats: 12, colorFn: (y, phi, t) => (t > 0.86 ? frill : o) }));
      add(skirt(ctx, { top: 0.52, bottom: 0.4, rTop: 0.96, rBot: 1.06, pleats: 22, depth: 0.03, colorFn: () => frill }));
      add(band(ctx, 1.02, 0.1, 0.6, 0.39, acc, BONES.hips));
      add(bow(ctx, { pos: [0, 1.04, -0.6], size: 0.26, color: pal.accent, bone: BONES.hips, rot: [0, Math.PI, 0] }));
      add(puff(ctx, 1, o));
      add(puff(ctx, -1, o));
      add(shirtCollar(ctx, frill));
      add(bow(ctx, { pos: [0, 1.5, 0.15], size: 0.12, color: pal.accent, bone: BONES.chest, tails: false }));
      break;
    }
    case 'armor': {
      const gold = acc;
      // Long elegant skirt under tassets.
      add(skirt(ctx, { top: 1.0, bottom: adult ? 0.18 : 0.4, rTop: 0.6, rBot: 0.95, pleats: 8, colorFn: (y, phi, t) => (t > 0.9 ? gold : os.clone().lerp(o, 0.4)) }));
      // Tassets: four plates.
      for (let i = 0; i < 5; i++) {
        const phi = (-0.5 + i * 0.25) * Math.PI * 0.9;
        const plate = box(0.3, 0.32, 0.04);
        add(part(plate, { pos: [Math.sin(phi) * 0.66, 0.84, Math.cos(phi) * 0.48 + BODY_Z], rot: [0.25, phi, 0], color: (p) => (p.y < 0.72 ? gold : o), bone: BONES.skirt }));
      }
      // Breastplate.
      const plate = sphere(0.62, seg(ctx.quality, 20, 16, 10), seg(ctx.quality, 12, 10, 6), -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.25, Math.PI * 0.45);
      plate.scale(0.95, 0.75, 0.62);
      add(part(plate, { pos: [0, 1.27, -0.2], color: (p) => (p.y < 1.03 || p.y > 1.48 ? gold : o), bone: BONES.chest }));
      // Pauldrons.
      for (const side of [-1, 1]) {
        const pa = sphere(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
        pa.scale(1.1, 0.8, 1.05);
        const p = armPoint(ctx, side, 0.05);
        add(part(pa, { pos: [p.x + side * 0.05, p.y + 0.06, p.z], rot: [0, 0, -side * 0.5], color: (q) => (q.y < p.y + 0.08 ? gold : o), bone: side > 0 ? BONES.armL : BONES.armR }));
        add(cuff(ctx, side, 0.68, 0.14, 0.05, gold));
      }
      add(cape(ctx, pal.accent, '#ffffff', adult ? 1.3 : 1.0));
      add(band(ctx, 1.0, 0.09, 0.61, 0.4, gold, BONES.hips));
      add(part(sphere(0.06, 8, 6), { pos: [0, 1.0, 0.2], color: col('#7fd6ff'), bone: BONES.hips }));
      break;
    }
    case 'coat': {
      // Long coat open at the front with trim and buttons.
      const trim = acc;
      add(skirt(ctx, { top: 1.02, bottom: adult ? 0.12 : 0.36, rTop: 0.62, rBot: 0.96, pleats: 6, openFront: 0.9, colorFn: (y, phi, t) => (t > 0.9 || Math.abs(Math.abs(phi) - 0.45) < 0.06 ? trim : o) }));
      add(skirt(ctx, { top: 1.0, bottom: 0.66, rTop: 0.6, rBot: 0.8, pleats: 10, colorFn: () => os }));
      add(band(ctx, 1.0, 0.1, 0.61, 0.4, col('#3a2a24'), BONES.hips));
      add(part(box(0.1, 0.08, 0.04), { pos: [0, 1.0, 0.2], color: trim, bone: BONES.hips }));
      add(buttons(ctx, [-0.1, 0.1], [1.42, 1.26, 1.12], 0.15, trim));
      for (const side of [-1, 1]) {
        const pts = smoothPath([[side * 0.24, 1.66, 0.0], [side * 0.3, 1.5, 0.1], [side * 0.14, 1.3, 0.15]], 6);
        add(part(strand(pts, (t) => [0.1 - 0.04 * t, 0.03], { radial: 6, up: () => new THREE.Vector3(0, 0.2, 1).normalize() }), { color: trim, bone: BONES.chest }));
        add(cuff(ctx, side, 0.66, 0.145, 0.05, trim));
      }
      add(band(ctx, 1.64, 0.1, 0.32, 0.3, o, BONES.chest));
      break;
    }
    case 'apron': {
      add(skirt(ctx, { top: 1.0, bottom: 0.48, rTop: 0.6, rBot: 0.96, pleats: 12, colorFn: (y, phi, t) => (t > 0.88 ? white : mix(pal.accent, '#ffffff', 0.25)) }));
      add(frontPanel(ctx, { yTop: 1.02, yBot: 0.46, wTop: 0.36, wBot: 0.52, z: 0.17, color: o, bone: BONES.skirt, curve: 0.55 }));
      add(frontPanel(ctx, { yTop: 1.45, yBot: 1.0, wTop: 0.22, wBot: 0.28, z: 0.13, color: o, bone: BONES.chest, curve: 0.5 }));
      add(band(ctx, 1.02, 0.07, 0.61, 0.4, o, BONES.hips));
      add(bow(ctx, { pos: [0, 1.04, -0.6], size: 0.26, color: pal.outfit, bone: BONES.hips, rot: [0, Math.PI, 0] }));
      add(puff(ctx, 1, o, 0.22));
      add(puff(ctx, -1, o, 0.22));
      add(part(sphere(0.05, 8, 6), { pos: [0, 1.3, 0.16], color: acc, bone: BONES.chest }));
      break;
    }
    case 'jumpsuit': {
      add(band(ctx, 1.0, 0.12, 0.62, 0.41, acc, BONES.hips));
      add(part(box(0.14, 0.1, 0.05), { pos: [0, 1.0, 0.21], color: col('#d9d9e3'), bone: BONES.hips }));
      // Collar + zip.
      add(band(ctx, 1.6, 0.1, 0.3, 0.28, os, BONES.chest));
      add(part(box(0.03, 0.45, 0.02), { pos: [0, 1.38, 0.13], color: col('#d9d9e3'), bone: BONES.chest }));
      // Pockets on the thighs + rolled sleeves.
      for (const side of [-1, 1]) {
        add(part(box(0.16, 0.14, 0.05), { pos: [side * 0.42, 0.62, 0.08], rot: [0, side * 0.4, 0], color: os, bone: side > 0 ? BONES.legL : BONES.legR }));
        add(cuff(ctx, side, 0.5, 0.14, 0.06, os));
      }
      // Tool belt pouch.
      add(part(box(0.2, 0.18, 0.12), { pos: [-0.5, 0.92, -0.05], color: col('#6b4b3a'), bone: BONES.hips }));
      break;
    }
    case 'robe': {
      const trim = acc;
      add(skirt(ctx, { top: 1.04, bottom: 0.06, rTop: 0.6, rBot: adult ? 1.0 : 0.88, pleats: 6, curve: 0.9, colorFn: (y, phi, t) => (t > 0.93 || Math.abs(phi) < 0.05 ? trim : o) }));
      add(band(ctx, 1.04, 0.1, 0.61, 0.4, trim, BONES.hips));
      add(wideSleeve(ctx, 1, o, trim, 0.62));
      add(wideSleeve(ctx, -1, o, trim, 0.62));
      // Mantle collar.
      const mantle = lathe([[0.3, 0.08], [0.5, 0.0], [0.62, -0.12], [0.6, -0.16], [0.28, -0.02]], seg(ctx.quality, 28, 20, 14));
      mantle.scale(1, 1, 0.75);
      add(part(mantle, { pos: [0, 1.62, -0.2], color: (p) => (p.y < 1.5 ? trim : o.clone().multiplyScalar(0.9)), bone: BONES.chest }));
      add(part(sphere(0.07, 8, 6), { pos: [0, 1.5, 0.12], color: trim, bone: BONES.chest }));
      if (adult) add(cape(ctx, pal.outfitShade, pal.accent, 1.5));
      break;
    }
    default:
      break;
  }
  // Shoes get a little toe cap / strap shine.
  for (const side of [-1, 1]) {
    const g = ellipsoid(0.19, 0.08, 0.13, 10, 6);
    add(part(g, { pos: [side * 0.27, 0.07, 0.0], color: ctx.spec.regions[REGION.FOOT].clone().multiplyScalar(1.12), bone: side > 0 ? BONES.legL : BONES.legR }));
  }
  return { parts };
}

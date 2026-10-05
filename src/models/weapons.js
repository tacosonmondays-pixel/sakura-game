// Weapons (built in hand-local space: grip along +y, front = +z) and the matching attack
// animation styles (anticipation -> strike -> recovery keyframes per bone).
import * as THREE from 'three';
import { BONES } from './body.js';
import {
  part, cyl, sphere, ellipsoid, box, torus, cone, strand, smoothPath, seg, lathe, star, extrude,
} from './geom.js';
import { col } from './toon.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const WEAPON_SCALE = 1.2;

/**
 * Animation style per weapon. `keys` entries: [bone, axis, windUp, strike].
 * `ready` entries: [bone, axis, value] (idle/attack stance). Durations in seconds.
 */
const STYLES = {
  slash: {
    duration: 0.55, lunge: 0.22, lean: 0.12,
    ready: [['armR', 'x', -0.35]],
    keys: [['armR', 'x', -2.3, 0.45], ['armR', 'z', -0.35, 0.1], ['chest', 'y', 0.35, -0.45], ['head', 'x', -0.05, 0.08]],
  },
  thrust: {
    duration: 0.45, lunge: 0.35, lean: 0.14,
    ready: [['armR', 'x', -0.6], ['armL', 'z', 0.4]],
    keys: [['armR', 'x', -0.6, -1.0], ['chest', 'y', 0.45, -0.35], ['armL', 'z', 0.3, 0.6]],
  },
  sweep: {
    duration: 0.5, lunge: 0.12, lean: 0.06,
    ready: [['armR', 'x', -0.5]],
    keys: [['armR', 'z', -1.3, 0.3], ['armR', 'x', -0.3, -1.1], ['chest', 'y', 0.4, -0.5]],
  },
  spear: {
    duration: 0.55, lunge: 0.3, lean: 0.1,
    ready: [['armR', 'x', -0.7], ['armL', 'x', -0.9], ['armL', 'z', -0.3]],
    keys: [['armR', 'x', 0.35, -0.5], ['armL', 'x', 0.3, -0.4], ['chest', 'y', 0.25, -0.2]],
  },
  bow: {
    duration: 0.6, recoil: 0.05,
    ready: [['armL', 'x', -1.35], ['armL', 'z', -0.15], ['armR', 'x', -1.25], ['armR', 'z', 0.25]],
    keys: [['armR', 'z', -0.55, -0.2], ['armR', 'x', 0.15, 0], ['chest', 'y', 0.2, 0], ['head', 'y', 0.1, 0]],
  },
  gun: {
    duration: 0.4, recoil: 0.1,
    ready: [['armR', 'x', -1.3], ['armL', 'x', -1.4], ['armL', 'z', -0.45], ['head', 'x', 0.05]],
    keys: [['armR', 'x', 0.0, 0.3], ['armL', 'x', 0, 0.3], ['chest', 'x', 0, -0.12]],
  },
  cannon: {
    duration: 0.55, recoil: 0.22,
    ready: [['armR', 'x', -1.0], ['armL', 'x', -0.9], ['armL', 'z', -0.4]],
    keys: [['armR', 'x', -0.1, 0.35], ['chest', 'x', 0.05, -0.2], ['head', 'x', 0, -0.1]],
  },
  throw: {
    duration: 0.45, lunge: 0.08, lean: 0.12,
    ready: [['armR', 'x', -0.3]],
    keys: [['armR', 'x', -2.7, 0.9], ['armR', 'z', -0.3, 0.1], ['chest', 'y', 0.4, -0.35], ['armL', 'x', -0.6, 0.3]],
  },
  toss: {
    duration: 0.55,
    ready: [['armR', 'x', -0.5]],
    keys: [['armR', 'x', 0.35, -2.1], ['chest', 'x', 0.06, -0.08]],
  },
  cast: {
    duration: 0.6, lean: -0.05,
    ready: [['armR', 'x', -0.55], ['armR', 'z', -0.1]],
    keys: [['armR', 'x', -0.2, -1.9], ['armR', 'z', -0.2, -0.2], ['armL', 'z', 0.3, 0.7], ['chest', 'x', -0.04, -0.08]],
  },
  book: {
    duration: 0.6, lean: -0.04,
    ready: [['armL', 'x', -1.2], ['armL', 'z', -0.35]],
    keys: [['armR', 'x', -0.4, -1.8], ['armR', 'z', -0.3, -0.5], ['head', 'x', 0.1, -0.1]],
  },
  shake: {
    duration: 0.55,
    ready: [['armR', 'x', -0.9]],
    keys: [['armR', 'x', -0.5, -1.2], ['armR', 'z', -0.5, 0.4], ['head', 'z', 0.1, -0.1]],
  },
};

const WEAPON_STYLE = {
  bow: 'bow', katana: 'slash', sword: 'slash', wrench: 'slash', rapier: 'thrust', fan: 'sweep', gohei: 'sweep',
  trident: 'spear', parasol: 'cast', rifle: 'gun', cannon: 'cannon', shuriken: 'throw', flask: 'throw',
  coinPurse: 'toss', staff: 'cast', lantern: 'cast', tome: 'book', bell: 'shake',
};

/** Attack style descriptor for a weapon key. */
export function weaponStyle(weapon) {
  return STYLES[WEAPON_STYLE[weapon] || 'cast'];
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

function blade(len, width, color, edge, curve = 0) {
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(V(0, t * len, curve * Math.sin(t * Math.PI * 0.5) * len * 0.12));
  }
  const g = strand(pts, (t) => [width * (t > 0.85 ? (1 - t) / 0.15 * 0.9 + 0.1 : 1), 0.025], { radial: 6, up: () => V(0, 0, 1), sides: 1 });
  // Edge lighter along +x side.
  const c = col(color);
  const e = col(edge);
  return part(g, { color: (p) => (p.x > width * 0.3 ? e : c) });
}

/** Builds weapon parts in hand-local space. Returns { parts, hand: 'R'|'L', rot } */
function weaponParts(ctx, kind) {
  const w = col(ctx.pal.weapon);
  const acc = col(ctx.pal.accent);
  const dark = col('#3b3040');
  const gold = col('#f2c14e');
  const s = seg(ctx.quality, 12, 9, 6);
  const P = [];
  let hand = 'R';
  let rot = [0.5, 0, 0.15];
  let offset = [0, 0, 0];
  switch (kind) {
    case 'bow': {
      hand = 'L';
      rot = [0, 0.9, 0];
      const R = 0.95;
      const half = Math.PI * 0.36;
      const arc = torus(R, 0.045, 6, seg(ctx.quality, 28, 20, 14), half * 2);
      arc.rotateZ(-half);
      arc.translate(-R, 0, 0);
      arc.rotateY(-Math.PI / 2);
      P.push(part(arc, { color: w }));
      P.push(part(cyl(0.065, 0.065, 0.3, 8), { color: acc }));
      const tipZ = R * Math.cos(half) - R;
      const tipY = R * Math.sin(half);
      P.push(part(cyl(0.01, 0.01, tipY * 2, 4), { pos: [0, 0, tipZ], color: col('#ffffff') }));
      for (const sy of [-1, 1]) P.push(part(extrude(star(5, 0.09, 0.04), 0.03), { pos: [0, sy * tipY, tipZ + 0.03], rot: [0, Math.PI / 2, 0], color: acc }));
      break;
    }
    case 'katana': {
      rot = [0.9, 0, 0.1];
      offset = [0, -0.12, 0];
      P.push(part(cyl(0.05, 0.05, 0.42, 8), { pos: [0, 0.05, 0], color: (p) => (Math.sin(p.y * 60) > 0 ? dark : acc) }));
      P.push(part(cyl(0.12, 0.12, 0.03, 12), { pos: [0, 0.28, 0], color: gold }));
      const b = blade(1.35, 0.06, ctx.pal.weapon, '#ffffff', 1);
      b.translate(0, 0.3, 0);
      P.push(b);
      break;
    }
    case 'sword': {
      rot = [0.75, 0, 0.12];
      offset = [0, -0.1, 0];
      P.push(part(cyl(0.05, 0.05, 0.36, 8), { pos: [0, 0.02, 0], color: col('#5a3a6a') }));
      P.push(part(sphere(0.08, 8, 6), { pos: [0, -0.2, 0], color: col('#7fd6ff') }));
      const guard = new THREE.Shape();
      guard.moveTo(-0.3, 0.06); guard.quadraticCurveTo(0, -0.02, 0.3, 0.06); guard.lineTo(0.22, -0.04); guard.quadraticCurveTo(0, -0.08, -0.22, -0.04); guard.closePath();
      P.push(part(extrude(guard, 0.08), { pos: [0, 0.22, 0], color: gold }));
      const b = blade(1.45, 0.11, ctx.pal.weapon, '#ffffff', 0);
      b.translate(0, 0.24, 0);
      P.push(b);
      P.push(part(box(0.04, 0.9, 0.055), { pos: [0, 0.75, 0], color: gold }));
      break;
    }
    case 'rapier': {
      rot = [1.55, 0, 0.45];
      P.push(part(cyl(0.045, 0.045, 0.32, 8), { color: dark }));
      P.push(part(torus(0.15, 0.025, 6, 16, Math.PI * 1.3), { pos: [0, 0.12, 0.02], rot: [0, Math.PI / 2, 0], color: gold }));
      P.push(part(cyl(0.11, 0.11, 0.025, 12), { pos: [0, 0.18, 0], color: gold }));
      P.push(part(cyl(0.012, 0.03, 1.4, 6), { pos: [0, 0.9, 0], color: w }));
      P.push(part(sphere(0.06, 8, 6), { pos: [0, -0.18, 0], color: acc }));
      break;
    }
    case 'staff': {
      rot = [0.15, 0, 0.42];
      offset = [0.12, 0.1, 0.05];
      P.push(part(cyl(0.045, 0.05, 2.1, 8), { pos: [0, 0.15, 0], color: col('#ffffff').lerp(w, 0.35) }));
      P.push(part(torus(0.2, 0.035, 6, 16), { pos: [0, 1.32, 0], color: acc }));
      const gem = new THREE.OctahedronGeometry(0.2, 0);
      gem.scale(0.8, 1.3, 0.8);
      P.push(part(gem, { pos: [0, 1.36, 0], color: w.clone().lerp(col('#ffffff'), 0.3) }));
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        P.push(part(sphere(0.05, 6, 4), { pos: [Math.cos(a) * 0.2, 1.32, Math.sin(a) * 0.2], color: w }));
      }
      break;
    }
    case 'cannon': {
      rot = [1.3, 0, 0.05];
      offset = [0.05, 0.15, 0.1];
      P.push(part(cyl(0.22, 0.26, 1.15, s), { pos: [0, 0.45, 0], color: w }));
      P.push(part(torus(0.24, 0.05, 6, s), { pos: [0, 1.0, 0], rot: [Math.PI / 2, 0, 0], color: acc }));
      P.push(part(torus(0.27, 0.05, 6, s), { pos: [0, 0.1, 0], rot: [Math.PI / 2, 0, 0], color: acc }));
      P.push(part(cyl(0.15, 0.15, 0.06, s), { pos: [0, 1.04, 0], color: dark }));
      P.push(part(box(0.12, 0.3, 0.12), { pos: [0.0, 0.3, -0.27], color: dark }));
      P.push(part(sphere(0.26, s, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), { pos: [0, -0.12, 0], color: w.clone().multiplyScalar(0.85) }));
      break;
    }
    case 'rifle': {
      rot = [1.45, 0, 0.0];
      offset = [0.08, 0.1, 0];
      P.push(part(box(0.1, 0.55, 0.16), { pos: [0, 0.0, 0], color: col('#6b4b3a') }));
      P.push(part(box(0.12, 0.28, 0.12), { pos: [0, -0.35, -0.02], color: col('#6b4b3a') }));
      P.push(part(cyl(0.035, 0.04, 1.2, 8), { pos: [0, 0.85, 0.02], color: w }));
      P.push(part(cyl(0.05, 0.05, 0.32, 8), { pos: [0, 0.3, 0.13], color: dark }));
      P.push(part(cyl(0.055, 0.055, 0.03, 8), { pos: [0, 0.45, 0.13], color: acc }));
      break;
    }
    case 'shuriken': {
      rot = [Math.PI / 2, 0, 0];
      offset = [0, 0, 0.12];
      P.push(part(extrude(star(4, 0.3, 0.08, 0), 0.04, 0.01), { color: w }));
      P.push(part(cyl(0.06, 0.06, 0.06, 10), { rot: [Math.PI / 2, 0, 0], color: acc }));
      break;
    }
    case 'tome': {
      hand = 'L';
      rot = [0.25, 0, 0];
      offset = [0, 0.2, 0.15];
      P.push(part(box(0.5, 0.62, 0.1), { color: w }));
      P.push(part(box(0.46, 0.58, 0.12), { pos: [0.02, 0, 0], color: col('#fff8e8') }));
      P.push(part(box(0.06, 0.62, 0.13), { pos: [-0.24, 0, 0], color: w.clone().multiplyScalar(0.7) }));
      P.push(part(extrude(star(6, 0.12, 0.06), 0.03), { pos: [0, 0, -0.07], color: gold }));
      P.push(part(extrude(star(6, 0.12, 0.06), 0.03), { pos: [0, 0, 0.07], color: gold }));
      break;
    }
    case 'bell': {
      rot = [0.3, 0, 0.1];
      P.push(part(cyl(0.04, 0.04, 0.6, 8), { pos: [0, 0.15, 0], color: col('#c0392b') }));
      const pos = [[0, 0.5, 0], [0.12, 0.62, 0], [-0.12, 0.62, 0], [0, 0.74, 0], [0.12, 0.86, 0], [-0.12, 0.86, 0], [0, 0.98, 0]];
      for (const p of pos) P.push(part(sphere(0.085, 8, 6), { pos: p, color: gold }));
      for (const sx of [-1, 1]) {
        const pts = smoothPath([[0, -0.12, 0], [sx * 0.12, -0.35, 0.05], [sx * 0.08, -0.6, 0.1]], 6);
        P.push(part(strand(pts, () => [0.04, 0.012], { radial: 4, up: () => V(0, 0, 1) }), { color: sx > 0 ? acc : col('#ffffff') }));
      }
      break;
    }
    case 'wrench': {
      rot = [0.7, 0, 0.12];
      offset = [0, -0.1, 0];
      P.push(part(box(0.1, 1.0, 0.06), { pos: [0, 0.3, 0], color: w }));
      P.push(part(box(0.11, 0.3, 0.08), { pos: [0, -0.05, 0], color: acc }));
      const jaw = new THREE.Shape();
      jaw.absarc(0, 0, 0.2, 0, Math.PI * 2, false);
      const hole = new THREE.Path();
      hole.moveTo(-0.07, 0.25); hole.lineTo(-0.07, 0.02); hole.lineTo(0.07, 0.02); hole.lineTo(0.07, 0.25); hole.closePath();
      jaw.holes.push(hole);
      P.push(part(extrude(jaw, 0.07), { pos: [0, 0.86, 0], color: w }));
      break;
    }
    case 'lantern': {
      rot = [0.25, 0, 0.3];
      offset = [0, -0.05, 0.05];
      P.push(part(cyl(0.035, 0.035, 0.55, 6), { pos: [0, 0.25, 0], color: col('#6b4b3a') }));
      P.push(part(torus(0.1, 0.02, 4, 10, Math.PI), { pos: [0, 0.52, 0.0], rot: [0, 0, Math.PI], color: dark }));
      const body = lathe([[0.05, 0.32], [0.2, 0.26], [0.26, 0.0], [0.2, -0.26], [0.05, -0.32]], s);
      P.push(part(body, { pos: [0, 0.12, 0.0], color: (p) => (Math.sin(p.y * 40) > 0.85 ? col('#e6a700') : col('#fff3b0')) }));
      P.push(part(cyl(0.12, 0.12, 0.06, s), { pos: [0, 0.45, 0], color: col('#c0392b') }));
      P.push(part(cyl(0.12, 0.12, 0.06, s), { pos: [0, -0.21, 0], color: col('#c0392b') }));
      break;
    }
    case 'flask': {
      rot = [0.2, 0, 0.1];
      offset = [0, 0.12, 0.08];
      const body = lathe([[0.04, 0.42], [0.06, 0.38], [0.07, 0.22], [0.22, 0.08], [0.24, -0.06], [0.18, -0.18], [0.02, -0.2]], s);
      P.push(part(body, { color: (p) => (p.y < 0.05 ? w : col('#e8fbff')) }));
      P.push(part(cyl(0.065, 0.06, 0.1, 8), { pos: [0, 0.45, 0], color: col('#a0764a') }));
      P.push(part(sphere(0.05, 6, 4), { pos: [0.08, 0.1, 0.17], color: col('#ffffff') }));
      break;
    }
    case 'parasol': {
      rot = [-0.75, 0, 0.3];
      offset = [0, 0.1, 0];
      P.push(part(cyl(0.03, 0.03, 2.0, 6), { pos: [0, 0.85, 0], color: col('#6b4b3a') }));
      const canopy = lathe([[0.02, 0.34], [0.45, 0.24], [0.85, 0.02], [0.95, -0.06], [0.82, -0.14], [0.42, -0.02], [0.02, 0.1]], seg(ctx.quality, 16, 12, 8));
      const cp = canopy.attributes.position;
      for (let i = 0; i < cp.count; i++) {
        const x = cp.getX(i);
        const z = cp.getZ(i);
        const r = Math.hypot(x, z);
        const a = Math.atan2(z, x);
        const sc = 1 - 0.06 * Math.abs(Math.sin(a * 4)) * (r / 0.95);
        cp.setXYZ(i, x * sc, cp.getY(i) - Math.abs(Math.sin(a * 4)) * 0.05 * (r / 0.95), z * sc);
      }
      canopy.computeVertexNormals();
      P.push(part(canopy, { pos: [0, 1.75, 0], color: (p) => (Math.hypot(p.x, p.z) > 0.82 ? col('#ffffff') : w) }));
      P.push(part(sphere(0.06, 6, 4), { pos: [0, 2.1, 0], color: acc }));
      P.push(part(torus(0.08, 0.025, 4, 10, Math.PI), { pos: [0.08, -0.15, 0], rot: [0, 0, Math.PI], color: col('#6b4b3a') }));
      break;
    }
    case 'trident': {
      rot = [0.18, 0, 0.4];
      offset = [0.12, 0.15, 0.05];
      P.push(part(cyl(0.04, 0.04, 2.3, 8), { pos: [0, 0.25, 0], color: w.clone().lerp(col('#1d3557'), 0.4) }));
      P.push(part(box(0.5, 0.06, 0.06), { pos: [0, 1.4, 0], color: w }));
      for (const x of [-0.24, 0, 0.24]) {
        const h = x === 0 ? 0.45 : 0.32;
        P.push(part(cyl(0.03, 0.035, h, 6), { pos: [x, 1.4 + h / 2, 0], color: w }));
        P.push(part(cone(0.06, 0.16, 6), { pos: [x, 1.4 + h + 0.06, 0], color: w }));
      }
      P.push(part(sphere(0.08, 8, 6), { pos: [0, 1.32, 0], color: col('#4cc9f0') }));
      break;
    }
    case 'fan': {
      rot = [0.6, 0, 0.3];
      offset = [0, 0.05, 0.05];
      const sector = new THREE.Shape();
      sector.moveTo(0, 0);
      sector.absarc(0, 0, 0.7, Math.PI * 0.18, Math.PI * 0.82, false);
      sector.lineTo(0, 0);
      const g = extrude(sector, 0.03);
      P.push(part(g, { pos: [0, 0.05, 0], color: (p) => {
        const r = Math.hypot(p.x, p.y - 0.05);
        if (r > 0.6) return acc;
        return Math.sin(Math.atan2(p.y - 0.05, p.x) * 22) > 0.7 ? w.clone().multiplyScalar(0.75) : w;
      } }));
      P.push(part(cyl(0.035, 0.035, 0.3, 6), { pos: [0, -0.05, 0], color: dark }));
      break;
    }
    case 'gohei': {
      rot = [0.35, 0, 0.4];
      P.push(part(cyl(0.03, 0.035, 1.1, 6), { pos: [0, 0.35, 0], color: col('#c8a26b') }));
      for (const sx of [-1, 1]) {
        for (let k = 0; k < 2; k++) {
          const zig = [];
          const x0 = sx * (0.05 + k * 0.1);
          for (let i = 0; i < 6; i++) zig.push([x0 + (i % 2 ? sx * 0.07 : 0), 0.85 - i * 0.11, 0]);
          P.push(part(strand(smoothPath(zig, 10), () => [0.05, 0.01], { radial: 4, up: () => V(0, 0, 1) }), { color: col('#ffffff') }));
        }
      }
      P.push(part(box(0.1, 0.08, 0.04), { pos: [0, 0.9, 0], color: col('#ffd23f') }));
      break;
    }
    case 'coinPurse': {
      rot = [0, 0, 0];
      offset = [0, -0.05, 0.12];
      P.push(part(ellipsoid(0.25, 0.22, 0.2, s, 8), { color: w.clone().lerp(col('#c98f2b'), 0.2) }));
      P.push(part(cone(0.12, 0.14, 8), { pos: [0, 0.24, 0], rot: [Math.PI, 0, 0], color: acc }));
      P.push(part(torus(0.08, 0.025, 4, 10), { pos: [0, 0.22, 0], rot: [Math.PI / 2, 0, 0], color: acc }));
      P.push(part(cyl(0.12, 0.12, 0.03, 12), { pos: [0.14, 0.32, 0.12], rot: [Math.PI / 2, 0, 0.4], color: col('#ffd23f') }));
      P.push(part(extrude(star(5, 0.08, 0.035), 0.03), { pos: [0, 0, 0.2], color: col('#ffd23f') }));
      break;
    }
    default:
      P.push(part(cyl(0.04, 0.04, 1.2, 6), { pos: [0, 0.3, 0], color: w }));
  }
  return { parts: P, hand, rot, offset };
}

/** Rotation of an arm in the weapon's ready stance (sum of `ready` entries for that arm). */
function readyRotation(style, armBone) {
  const e = [0, 0, 0];
  for (const [bone, axis, val] of style.ready) {
    if (bone === armBone) e['xyz'.indexOf(axis)] += val;
  }
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0], e[1], e[2], 'XYZ'));
}

/**
 * Builds the weapon in girl space. The weapon is authored as seen in the ready stance
 * (arm raised, weapon at the hand with orientation `rot`) and then carried back into the
 * bind pose by the inverse arm rotation, so the stance reproduces the authored look.
 * Also adds round chibi fists to both hands. -> { parts, hand }
 */
export function buildWeapon(ctx) {
  const kind = ctx.look.weapon;
  const style = weaponStyle(kind);
  const { parts, hand, rot, offset } = weaponParts(ctx, kind);
  const left = hand === 'L';
  const handPos = left ? ctx.base.handL : ctx.base.handR;
  const bone = left ? BONES.handL : BONES.handR;
  const side = left ? 1 : -1;
  const shoulder = new THREE.Vector3(side * 0.53, 1.31, -0.2);
  const ready = readyRotation(style, left ? 'armL' : 'armR');
  const readyHand = handPos.clone().sub(shoulder).applyQuaternion(ready).add(shoulder);
  const inv = ready.clone().invert();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1] * -side, rot[2] * -side));
  const m = new THREE.Matrix4();
  for (const g of parts) {
    g.scale(WEAPON_SCALE, WEAPON_SCALE, WEAPON_SCALE);
    g.applyQuaternion(q);
    g.translate(readyHand.x + offset[0] * side, readyHand.y + offset[1], readyHand.z + offset[2]);
    // back to bind pose
    g.translate(-shoulder.x, -shoulder.y, -shoulder.z);
    g.applyMatrix4(m.makeRotationFromQuaternion(inv));
    g.translate(shoulder.x, shoulder.y, shoulder.z);
    const si = g.attributes.skinIndex;
    for (let i = 0; i < si.count; i++) si.setX(i, bone);
  }
  const fists = [];
  const s = seg(ctx.quality, 12, 10, 8);
  for (const sd of [1, -1]) {
    const hp = sd > 0 ? ctx.base.handL : ctx.base.handR;
    fists.push(part(ellipsoid(0.15, 0.16, 0.15, s, Math.max(6, s - 2)), { pos: [hp.x, hp.y - 0.02, hp.z + 0.01], color: col(ctx.pal.skin), bone: sd > 0 ? BONES.handL : BONES.handR }));
  }
  return { parts: [...fists, ...parts], hand };
}

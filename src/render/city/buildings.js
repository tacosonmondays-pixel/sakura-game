// Modern-city kit (prototype): procedural buildings baked into a CityAcc (one facade mesh for
// the whole skyline). Windows, glass and shop fronts come from the facade shader (FK kinds), so a
// tower is a handful of boxes. Kinds: glassTower, office, flats (residential), shop, school,
// gym, clockTower, clubhouse. Rooftops: helipad, garden, solar, ac.
import * as THREE from 'three';
import { FK } from './cityMaterials.js';

/** Storey height (world units; a girl is ≈ 0.9 tall). */
export const FLOOR = 0.34;

const cache = new Map();
export function C(hex) {
  let c = cache.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    cache.set(hex, c);
  }
  return c;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

/** Appends a primitive geometry with a transform to the acc. */
export function prim(acc, geom, o, color, kind = 0) {
  _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ');
  _q.setFromEuler(_e);
  _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
  _p.set(o.x || 0, o.y || 0, o.z || 0);
  _m.compose(_p, _q, _s);
  acc.geo(geom, _m, color, kind);
  geom.dispose();
}

export const AWNINGS = {
  pink: '#ff9cc2', mint: '#7fd8b8', lemon: '#ffd96a', sky: '#7fc8f5', lilac: '#c3a8ff',
};
const SIGN_GLOWS = ['#ffd6e8', '#d6f3ff', '#fff2c8', '#e6dcff'];

/**
 * One building. `b` = { cx, cz, w, d, kind, floors, roof, front: 'z'|'-z'|'x'|'-x', tint, awning, seed }
 * acc = facade CityAcc, glow = GeoBuilder-like sink for unlit parts (glowBox(x,y,z,w,h,d,color)),
 * extras = { holo(x, y, z, w, h, ry, cell, color), prop(type, x, y, z, ry, s, variant), lights(x,y,z,color,size) }
 */
export function buildBuilding(acc, b, ex, rand) {
  const kind = b.kind || 'office';
  const fn = KINDS[kind] || KINDS.office;
  fn(acc, b, ex, rand);
}

function frontInfo(b) {
  // yaw that turns local +z to the building's front
  return { z: 0, x: Math.PI / 2, '-z': Math.PI, '-x': -Math.PI / 2 }[b.front || 'z'] ?? 0;
}

/** Local → world for a building with yaw ry around (cx, cz). */
function L(b, ry) {
  const cs = Math.cos(ry);
  const sn = Math.sin(ry);
  return (lx, lz) => [b.cx + lx * cs + lz * sn, b.cz - lx * sn + lz * cs];
}

function parapet(acc, b, y, col, inset = 0, t = 0.05, h = 0.07) {
  const w = b.w - inset * 2;
  const d = b.d - inset * 2;
  acc.box(b.cx, y, b.cz + d / 2 - t / 2, w, h, t, { color: col });
  acc.box(b.cx, y, b.cz - d / 2 + t / 2, w, h, t, { color: col });
  acc.box(b.cx + w / 2 - t / 2, y, b.cz, t, h, d - t * 2, { color: col });
  acc.box(b.cx - w / 2 + t / 2, y, b.cz, t, h, d - t * 2, { color: col });
}

function roof(acc, b, y, ex, rand, inset = 0.06) {
  const type = b.roof || 'ac';
  const w = b.w - inset * 2;
  const d = b.d - inset * 2;
  parapet(acc, b, y, C('#ffffff'), inset);
  if (type === 'helipad') {
    const s = Math.min(w, d) * 0.8;
    acc.box(b.cx, y, b.cz, s, 0.02, s, { color: C('#8a95aa') });
    prim(acc, new THREE.TorusGeometry(s * 0.34, 0.018, 3, 28), { x: b.cx, y: y + 0.025, z: b.cz, rx: Math.PI / 2 }, C('#ffffff'));
    acc.box(b.cx - s * 0.11, y + 0.02, b.cz, 0.04, 0.012, s * 0.32, { color: C('#ffffff') });
    acc.box(b.cx + s * 0.11, y + 0.02, b.cz, 0.04, 0.012, s * 0.32, { color: C('#ffffff') });
    acc.box(b.cx, y + 0.02, b.cz, s * 0.22, 0.012, 0.04, { color: C('#ffffff') });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ex.glowBox(b.cx + sx * s * 0.45, y + 0.02, b.cz + sz * s * 0.45, 0.04, 0.04, 0.04, '#ff9cc2');
  } else if (type === 'garden') {
    acc.box(b.cx, y, b.cz, w - 0.1, 0.04, d - 0.1, { color: C('#8fd672') });
    const n = Math.max(1, Math.round((w * d) / 1.2));
    for (let i = 0; i < n; i++) {
      const x = b.cx + (rand() - 0.5) * (w - 0.5);
      const z = b.cz + (rand() - 0.5) * (d - 0.5);
      ex.prop(i % 2 ? 'lawnShrub' : 'planterSakura', x, y + 0.03, z, rand() * 6.28, 0.7, Math.floor(rand() * 4));
    }
  } else if (type === 'solar') {
    const rows = Math.max(1, Math.floor((d - 0.2) / 0.3));
    for (let r = 0; r < rows; r++) {
      acc.box(b.cx, y + 0.06, b.cz - d / 2 + 0.22 + r * 0.3, w - 0.24, 0.02, 0.2, { color: C('#e6ecf5'), topKind: FK.solar });
      acc.box(b.cx, y, b.cz - d / 2 + 0.22 + r * 0.3, 0.03, 0.06, 0.03, { color: C('#c3cbd8') });
    }
  } else {
    // ac units + a water tank
    const n = Math.max(1, Math.round(w * d * 1.4));
    for (let i = 0; i < n; i++) {
      const x = b.cx + (rand() - 0.5) * (w - 0.4);
      const z = b.cz + (rand() - 0.5) * (d - 0.4);
      acc.box(x, y, z, 0.2, 0.12, 0.16, { color: C('#e9edf3') });
      prim(acc, new THREE.CylinderGeometry(0.055, 0.055, 0.01, 10), { x, y: y + 0.125, z }, C('#9aa6b8'));
    }
    if (w * d > 1.5) {
      const x = b.cx + w * 0.25;
      const z = b.cz - d * 0.2;
      prim(acc, new THREE.CylinderGeometry(0.13, 0.13, 0.26, 12), { x, y: y + 0.15, z }, C('#cfeaf8'));
      for (const s of [-1, 1]) acc.box(x + s * 0.08, y, z, 0.03, 0.15, 0.03, { color: C('#c3cbd8') });
    }
  }
}

function shopFront(acc, b, ex, rand, ry, h) {
  // awning over the front face + a glowing sign on the fascia
  const P = L(b, ry);
  const wf = (b.front === 'x' || b.front === '-x') ? b.d : b.w;
  const df = (b.front === 'x' || b.front === '-x') ? b.w : b.d;
  const awn = new THREE.Color(AWNINGS[b.awning] || AWNINGS.pink);
  if (b.war) awn.multiplyScalar(0.55);
  const [ax, az] = P(0, df / 2 + 0.11);
  acc.box(ax, h * 0.62, az, wf - 0.12, 0.035, 0.24, { ry, rx: 0.32, color: awn, side: FK.awning, topKind: FK.awning, uOff: 0 });
  const [vx, vz] = P(0, df / 2 + 0.22);
  acc.box(vx, h * 0.6, vz, wf - 0.1, 0.05, 0.01, { ry, color: awn, side: FK.awning });
  const [sx, sz] = P(0, df / 2 + 0.012);
  if (!b.war) ex.glowBox(sx, h * 0.8, sz, Math.min(0.7, wf * 0.55), 0.08, 0.012, SIGN_GLOWS[b.seed % SIGN_GLOWS.length], ry);
}

const KINDS = {
  // ----- modern era (present-day home town): warm, lived-in, low-rise ----------------------
  house(acc, b, ex, rand) {
    // a two-storey family house: plaster walls, a pitched tile roof, a little porch roof
    const walls = ['#fbf1e2', '#f6ece6', '#eef3ea', '#fdf6dc'];
    const roofs = ['#6f8fb8', '#c46a52', '#6f9a78', '#8a7fa8', '#b8644e'];
    const col = C(b.tint || walls[b.seed % walls.length]);
    const H = (b.floors || 2) * 0.36;
    acc.box(b.cx, 0, b.cz, b.w, 0.06, b.d, { color: C('#d9cfc0') });
    acc.box(b.cx, 0.06, b.cz, b.w - 0.08, H - 0.06, b.d - 0.08, { color: col, side: FK.flats, v0: 0.2 });
    const along = b.w >= b.d;
    gable(acc, b.cx, H, b.cz, b.w + 0.14, b.d + 0.14, 0.66, C(roofs[(b.seed * 3 + 1) % roofs.length]), along ? 0 : Math.PI / 2);
    const ry = frontInfo(b);
    const P = L(b, ry);
    const fd = (b.front === 'x' || b.front === '-x') ? b.w : b.d;
    const [px, pz] = P(b.w * 0.18, fd / 2 + 0.1);
    acc.box(px, 0.36, pz, 0.4, 0.03, 0.22, { ry, color: C('#e6dccd') });
    const [dx, dz] = P(b.w * 0.18, fd / 2 - 0.035);
    acc.box(dx, 0.06, dz, 0.16, 0.28, 0.02, { ry, color: C('#9a6e4c') });
    // an air-con unit and a potted plant
    const [ax, az] = P(-b.w * 0.3, fd / 2 - 0.02);
    acc.box(ax, 0.06, az + 0.04 * Math.cos(ry), 0.18, 0.13, 0.08, { ry, color: C('#f2f2ee') });
    if (b.seed % 2) ex.prop('lawnShrub', b.cx - b.w * 0.42, 0.02, b.cz + b.d * 0.42, rand() * 6, 0.55, 1);
  },
  apartment(acc, b, ex, rand) {
    // an ordinary low apartment block: beige tiles, balconies with laundry rails, stair core
    const H = (b.floors || 3) * 0.34;
    const col = C(b.tint || ['#efe4d2', '#e9e2d8', '#f1e8dc'][b.seed % 3]);
    acc.box(b.cx, 0, b.cz, b.w, H, b.d, { color: col, side: FK.flats });
    acc.box(b.cx, H, b.cz, b.w + 0.04, 0.05, b.d + 0.04, { color: C('#d8ccba') });
    acc.box(b.cx + b.w / 2 - 0.12, 0, b.cz + b.d / 2 + 0.02, 0.24, H + 0.15, 0.2, { color: C('#e2d6c4') });
    for (let k = 1; k < (b.floors || 3); k++) acc.box(b.cx - 0.12, k * 0.34 - 0.02, b.cz + b.d / 2 + 0.05, b.w - 0.34, 0.03, 0.12, { color: C('#ffffff') });
    roof(acc, { ...b, roof: 'ac' }, H + 0.05, ex, rand);
  },
  cornerStore(acc, b, ex, rand) {
    // a neighbourhood convenience store: glass front, a bright stripe band, a lit sign
    const h = 0.48;
    const ry = frontInfo(b);
    acc.box(b.cx, 0, b.cz, b.w - 0.06, h, b.d - 0.06, { color: C('#ffffff'), side: FK.shop });
    acc.box(b.cx, h, b.cz, b.w, 0.06, b.d, { color: C('#f4f6f2') });
    const P = L(b, ry);
    const fd = (b.front === 'x' || b.front === '-x') ? b.w : b.d;
    const wf = (b.front === 'x' || b.front === '-x') ? b.d : b.w;
    const stripes = [['#5fbf7a', '#ff9a4a'], ['#4f8fd8', '#ffd24a'], ['#e86a6a', '#ffffff']][b.seed % 3];
    for (let k = 0; k < 2; k++) {
      const [x, z] = P(0, fd / 2 - 0.02);
      acc.box(x, h - 0.12 + k * 0.05, z, wf - 0.04, 0.045, 0.02, { ry, color: C(stripes[k]) });
    }
    const [sx, sz] = P(0, fd / 2 + 0.005);
    ex.glowBox(sx, h + 0.07, sz, wf * 0.5, 0.11, 0.02, '#fff8e6', ry);
    const [vx, vz] = P(wf / 2 - 0.12, fd / 2 + 0.2);
    ex.prop('vending', vx, 0, vz, ry, 0.75, 1);
    roof(acc, { ...b, roof: 'ac' }, h + 0.06, ex, rand);
  },
  glassTower(acc, b, ex, rand) {
    const H = Math.max(2, b.floors || 10) * FLOOR;
    const lob = 0.36;
    const white = C('#f7f9fc');
    acc.box(b.cx, 0, b.cz, b.w - 0.14, lob, b.d - 0.14, { color: white, side: FK.lobby });
    acc.box(b.cx, lob, b.cz, b.w, 0.05, b.d, { color: white });
    acc.box(b.cx, lob + 0.05, b.cz, b.w - 0.04, H - lob - 0.05, b.d - 0.04, { color: white, side: FK.glass, v0: -lob - 0.05 });
    // white corner fins
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) acc.box(b.cx + sx * (b.w / 2 - 0.03), lob, b.cz + sz * (b.d / 2 - 0.03), 0.07, H - lob, 0.07, { color: white });
    let top = H;
    if ((b.floors || 0) >= 8) {
      // a stepped crown
      acc.box(b.cx, H, b.cz, b.w, 0.06, b.d, { color: white });
      acc.box(b.cx, H + 0.06, b.cz, b.w * 0.74, FLOOR * 2, b.d * 0.74, { color: white, side: FK.glass });
      ex.glowBox(b.cx, H + 0.06 + FLOOR * 2 - 0.04, b.cz + b.d * 0.37 + 0.005, b.w * 0.74, 0.025, 0.01, '#ffb8de');
      top = H + 0.06 + FLOOR * 2;
      acc.box(b.cx, top, b.cz, b.w * 0.78, 0.05, b.d * 0.78, { color: white });
      roof(acc, { ...b, w: b.w * 0.78, d: b.d * 0.78 }, top + 0.05, ex, rand, 0.04);
      if (b.roof === 'helipad') return;
      // antenna
      prim(acc, new THREE.CylinderGeometry(0.012, 0.02, 0.6, 5), { x: b.cx + b.w * 0.2, y: top + 0.35, z: b.cz }, white);
      ex.glowBox(b.cx + b.w * 0.2, top + 0.65, b.cz, 0.04, 0.04, 0.04, '#ff9cc2');
    } else {
      acc.box(b.cx, H, b.cz, b.w, 0.05, b.d, { color: white });
      roof(acc, b, H + 0.05, ex, rand);
    }
  },
  office(acc, b, ex, rand) {
    const H = Math.max(2, b.floors || 6) * FLOOR;
    const col = C(b.tint || '#f6f7fa');
    acc.box(b.cx, 0, b.cz, b.w, 0.36, b.d, { color: col, side: FK.lobby });
    acc.box(b.cx, 0.36, b.cz, b.w, H - 0.36, b.d, { color: col, side: FK.office, v0: -0.36 });
    acc.box(b.cx, H, b.cz, b.w + 0.04, 0.05, b.d + 0.04, { color: C('#ffffff') });
    // a sky-blue glass corner bay
    acc.box(b.cx + b.w / 2 - 0.2, 0.36, b.cz + b.d / 2 - 0.2, 0.44, H - 0.36, 0.44, { color: C('#ffffff'), side: FK.glass });
    roof(acc, b, H + 0.05, ex, rand);
  },
  residential(acc, b, ex, rand) {
    const H = Math.max(2, b.floors || 6) * FLOOR;
    const tints = ['#fff7f9', '#f4fbf8', '#f7f6ff', '#fffaf0'];
    const col = C(b.tint || tints[b.seed % tints.length]);
    acc.box(b.cx, 0, b.cz, b.w, 0.34, b.d, { color: col, side: FK.shop });
    acc.box(b.cx, 0.34, b.cz, b.w, H - 0.34, b.d, { color: col, side: FK.flats, v0: -0.34 });
    acc.box(b.cx, H, b.cz, b.w + 0.03, 0.05, b.d + 0.03, { color: C('#ffffff') });
    // a pastel stripe up the corner
    const accent = C(['#ffc4d9', '#a8e6d0', '#c9b8ff', '#ffe08a'][b.seed % 4]);
    acc.box(b.cx - b.w / 2 + 0.06, 0.34, b.cz + b.d / 2 + 0.001, 0.1, H - 0.34, 0.02, { color: accent });
    roof(acc, b, H + 0.05, ex, rand);
  },
  shop(acc, b, ex, rand) {
    const h = 0.5;
    const ry = frontInfo(b);
    const fascia = C(b.war ? '#a39ea8' : ['#fffaf5', '#f5fbff', '#fff6fa', '#f7fff9'][b.seed % 4]);
    acc.box(b.cx, 0, b.cz, b.w - 0.06, h, b.d - 0.06, { color: fascia, side: FK.shop });
    // a pastel roof (the camera mostly sees roofs) with a white rim
    const roofCol = new THREE.Color(AWNINGS[b.awning] || AWNINGS.pink).lerp(C(b.war ? '#8a8590' : '#ffffff'), b.war ? 0.75 : 0.62);
    acc.box(b.cx, h, b.cz, b.w, 0.05, b.d, { color: C('#ffffff') });
    acc.box(b.cx, h + 0.05, b.cz, b.w - 0.12, 0.012, b.d - 0.12, { color: roofCol });
    if ((b.floors || 1) > 1) {
      acc.box(b.cx, h + 0.05, b.cz, b.w - 0.1, FLOOR * (b.floors - 1), b.d - 0.1, { color: fascia, side: FK.flats });
      acc.box(b.cx, h + 0.05 + FLOOR * (b.floors - 1), b.cz, b.w, 0.04, b.d, { color: C('#ffffff') });
    } else {
      // rooftop: a little terrace with planters
      ex.prop(b.war ? 'rubble' : 'lawnShrub', b.cx - b.w * 0.25, h + 0.06, b.cz - b.d * 0.15, rand() * 6, 0.6, 1);
      acc.box(b.cx + b.w * 0.2, h + 0.06, b.cz - b.d * 0.15, 0.24, 0.1, 0.18, { color: C('#e9edf3') });
      if (!b.war && b.w * b.d > 2.5) {
        // a little roof café: parasol + table
        const px = b.cx + b.w * 0.05;
        const pz = b.cz + b.d * 0.1;
        acc.box(px, h + 0.06, pz, 0.02, 0.3, 0.02, { color: C('#ffffff') });
        prim(acc, new THREE.ConeGeometry(0.26, 0.1, 8), { x: px, y: h + 0.41, z: pz }, C(AWNINGS[b.awning] || AWNINGS.pink));
        prim(acc, new THREE.CylinderGeometry(0.1, 0.1, 0.02, 10), { x: px, y: h + 0.2, z: pz }, C('#ffffff'));
      }
    }
    shopFront(acc, b, ex, rand, ry, h);
  },
  kiosk(acc, b, ex) {
    ex.prop('kiosk', b.cx, 0, b.cz, frontInfo(b), 1, b.seed);
  },
  school(acc, b, ex, rand) {
    const floors = b.floors || 4;
    const H = floors * 0.38;
    const cream = C('#fbf5ea');
    const trim = C('#ffffff');
    acc.box(b.cx, 0, b.cz, b.w, 0.06, b.d, { color: C('#e8e0d2') });
    acc.box(b.cx, 0.06, b.cz, b.w - 0.08, H - 0.06, b.d - 0.08, { color: cream, side: FK.school, v0: -0.06 });
    acc.box(b.cx, H, b.cz, b.w, 0.06, b.d, { color: trim });
    parapet(acc, b, H + 0.06, C('#c3cbd8'), 0.04, 0.02, 0.12);
    // a soft mint band under the roof line
    acc.box(b.cx, H - 0.1, b.cz + b.d / 2 - 0.035, b.w - 0.06, 0.05, 0.02, { color: C('#a8e6d0') });
    // central clock tower + entrance canopy
    const tw = 1.1;
    const th = H + 0.62;
    acc.box(b.cx, 0.06, b.cz + 0.08, tw, th - 0.06, b.d - 0.06, { color: cream, side: FK.school, v0: -0.06 });
    acc.box(b.cx, th, b.cz + 0.08, tw + 0.08, 0.06, b.d + 0.02, { color: trim });
    // pointed pink roof cap
    prim(acc, new THREE.ConeGeometry(0.56, 0.32, 4), { x: b.cx, y: th + 0.22, z: b.cz + 0.08, ry: Math.PI / 4, sz: 1.2 }, C('#ff9cc2'));
    if (b.clock) clockFace(acc, ex, b.cx, th - 0.32, b.cz + 0.08 + b.d / 2 - 0.01, 0.24, 0);
    acc.box(b.cx, 0.36, b.cz + b.d / 2 + 0.16, 0.9, 0.04, 0.36, { color: trim });
    for (const s of [-1, 1]) acc.box(b.cx + s * 0.4, 0.06, b.cz + b.d / 2 + 0.3, 0.04, 0.3, 0.04, { color: trim });
    ex.glowBox(b.cx, 0.44, b.cz + b.d / 2 + 0.02, 0.5, 0.06, 0.01, '#fff2c8');
  },
  gym(acc, b, ex) {
    const H = (b.floors || 3) * 0.34;
    const col = C('#f7f9fc');
    acc.box(b.cx, 0, b.cz, b.w, H, b.d, { color: col, side: FK.gym });
    acc.box(b.cx, 0, b.cz + b.d / 2 + 0.001, b.w, 0.14, 0.02, { color: C('#7fc8f5') });
    // barrel roof along x
    const r = b.d / 2;
    prim(acc, new THREE.CylinderGeometry(r, r, b.w, 16, 1, false, 0, Math.PI), { x: b.cx, y: H, z: b.cz, rz: Math.PI / 2, sx: 0.42 }, C('#a9dcf5'));
    for (let i = 1; i < 4; i++) prim(acc, new THREE.TorusGeometry(r * 1.005, 0.015, 3, 16, Math.PI), { x: b.cx - b.w / 2 + (b.w * i) / 4, y: H, z: b.cz, ry: Math.PI / 2, sy: 0.42 }, C('#ffffff'));
    ex.glowBox(b.cx, H - 0.2, b.cz + b.d / 2 + 0.012, 0.8, 0.12, 0.01, '#d6f3ff');
  },
  ruin(acc, b, ex, rand) {
    // a broken tower: burnt-out glass, a jagged top of half-fallen floors, a slab hanging off,
    // smoke rising from the stump (war-torn surge)
    const floors = Math.max(3, b.floors || 8);
    const H = floors * FLOOR;
    const shell = C(b.tint || '#b9b4bd');
    acc.box(b.cx, 0, b.cz, b.w - 0.14, 0.36, b.d - 0.14, { color: C('#8f8a94'), side: FK.ruin });
    // solid lower part
    const keep = H * (0.45 + rand() * 0.2);
    acc.box(b.cx, 0.36, b.cz, b.w - 0.04, keep - 0.36, b.d - 0.04, { color: shell, side: FK.ruin, v0: -0.36 });
    // jagged crown: columns of varying height
    const cols = 3;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < 2; j++) {
        const w = (b.w - 0.04) / cols;
        const d = (b.d - 0.04) / 2;
        const h = (H - keep) * (0.15 + rand() * 0.85);
        if (h < 0.08) continue;
        acc.box(b.cx - (b.w - 0.04) / 2 + w * (i + 0.5), keep, b.cz - (b.d - 0.04) / 2 + d * (j + 0.5), w, h, d, { color: shell, side: FK.ruin, v0: -keep + keep });
      }
    }
    // exposed floor plates sticking out, one slab hanging askew
    for (let k = 0; k < 3; k++) acc.box(b.cx + (rand() - 0.5) * 0.2, keep + k * FLOOR * 0.8, b.cz + b.d / 2 - 0.05, b.w * (0.5 + rand() * 0.4), 0.04, 0.16, { color: C('#d2ced6') });
    acc.box(b.cx + b.w * 0.3, keep - 0.1, b.cz + b.d / 2 + 0.05, b.w * 0.45, 0.05, 0.5, { rx: 0.9, rz: 0.2, color: C('#a8a3ae') });
    // charred bands
    acc.box(b.cx, keep - 0.2, b.cz + b.d / 2 - 0.01, b.w - 0.02, 0.18, 0.04, { color: C('#3a343e') });
    // smoke from the top, a glow of fire inside
    // (only a few columns per map: every emitter costs particles from the shared pool)
    if (b.smoke) ex.prop('smokeColumn', b.cx + (rand() - 0.5) * 0.4, keep + 0.02, b.cz, 0, 1.1, 0);
    ex.light(b.cx, keep * 0.6, b.cz + b.d / 2 + 0.1, '#ff8a3a', 1.6, 0.4);
  },
  clubhouse(acc, b, ex, rand) {
    KINDS.residential(acc, { ...b, roof: 'ac', tint: '#fffaf2' }, ex, rand);
  },
  clockTower(acc, b, ex) {
    // free-standing clock tower on a little paved square
    const H = (b.floors || 4) * FLOOR + 0.3;
    const s = 0.62;
    acc.box(b.cx, 0, b.cz, s + 0.4, 0.1, s + 0.4, { color: C('#eef1f6') });
    acc.box(b.cx, 0.1, b.cz, s, H, s, { color: C('#fbf5ea'), side: FK.school, v0: -0.1 });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) acc.box(b.cx + sx * (s / 2), 0.1, b.cz + sz * (s / 2), 0.07, H, 0.07, { color: C('#ffffff') });
    const top = H + 0.1;
    acc.box(b.cx, top, b.cz, s + 0.12, 0.06, s + 0.12, { color: C('#ffffff') });
    acc.box(b.cx, top + 0.06, b.cz, s, 0.5, s, { color: C('#fbf5ea') });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      clockFace(acc, ex, b.cx + Math.sin(a) * (s / 2 + 0.005), top + 0.31, b.cz + Math.cos(a) * (s / 2 + 0.005), 0.2, a);
    }
    acc.box(b.cx, top + 0.56, b.cz, s + 0.1, 0.05, s + 0.1, { color: C('#ffffff') });
    prim(acc, new THREE.ConeGeometry(0.5, 0.55, 4), { x: b.cx, y: top + 0.88, z: b.cz, ry: Math.PI / 4 }, C('#ff9cc2'));
    prim(acc, new THREE.SphereGeometry(0.05, 8, 6), { x: b.cx, y: top + 1.18, z: b.cz }, C('#ffe27a'));
    // planters at the foot
    for (const [sx, sz] of [[-1, 1], [1, 1]]) ex.prop('lawnShrub', b.cx + sx * 0.62, 0.02, b.cz + sz * 0.62, 0, 0.7, 2);
  },
};

/** A clock face (white dial, pink rim, navy hands) facing yaw `ry` (+z when 0). */
function clockFace(acc, ex, x, y, z, r, ry) {
  const cs = Math.cos(ry);
  const sn = Math.sin(ry);
  const at = (lx, ly, lz) => ({ x: x + lx * cs + lz * sn, y: y + ly, z: z - lx * sn + lz * cs });
  prim(acc, new THREE.CylinderGeometry(r, r, 0.03, 20), { ...at(0, 0, 0.01), rx: Math.PI / 2, ry }, C('#ffffff'));
  prim(acc, new THREE.TorusGeometry(r, 0.03, 4, 20), { ...at(0, 0, 0.03), ry }, C('#ff9cc2'));
  for (let i = 0; i < 12; i += 3) {
    const a = (i / 12) * Math.PI * 2;
    prim(acc, new THREE.BoxGeometry(0.025, 0.05, 0.01), { ...at(Math.sin(a) * r * 0.78, Math.cos(a) * r * 0.78, 0.03), ry, rz: -a }, C('#34405e'));
  }
  // hands at ten past ten
  prim(acc, new THREE.BoxGeometry(0.022, r * 0.55, 0.012), { ...at(-r * 0.2, r * 0.13, 0.036), ry, rz: 1.0 }, C('#34405e'));
  prim(acc, new THREE.BoxGeometry(0.018, r * 0.78, 0.012), { ...at(r * 0.24, r * 0.22, 0.04), ry, rz: -0.75 }, C('#34405e'));
  const c = at(0, 0, 0.05);
  ex.glowBox(c.x, c.y - 0.02, c.z, 0.04, 0.04, 0.02, '#ff9cc2', ry);
}

/** Gable roof: ridge along local x (yaw ry), eaves w × d, ridge height h, standing on y. */
function gable(acc, cx, y, cz, w, d, h, color, ry = 0) {
  const cs = Math.cos(ry);
  const sn = Math.sin(ry);
  const P = (lx, ly, lz) => [cx + lx * cs + lz * sn, y + ly, cz - lx * sn + lz * cs];
  const hw = w / 2;
  const hd = d / 2;
  const dark = color.clone().multiplyScalar(0.7);
  acc.quad(P(-hw, 0, hd), P(hw, 0, hd), P(hw, h, 0), P(-hw, h, 0), color.clone().multiplyScalar(1.08));
  // tile courses across the front slope
  const tile = color.clone().multiplyScalar(0.86);
  for (let k = 1; k < 4; k++) {
    const t = k / 4;
    acc.quad(P(-hw, h * t, hd * (1 - t) + 0.004), P(hw, h * t, hd * (1 - t) + 0.004), P(hw, h * t + 0.02, hd * (1 - t) - 0.03), P(-hw, h * t + 0.02, hd * (1 - t) - 0.03), tile);
  }
  acc.quad(P(hw, 0, -hd), P(-hw, 0, -hd), P(-hw, h, 0), P(hw, h, 0), dark);
  const wall = C('#f3eadb');
  acc.tri(P(-hw + 0.07, 0, -hd + 0.07), P(-hw + 0.07, 0, hd - 0.07), P(-hw + 0.07, h - 0.04, 0), wall);
  acc.tri(P(hw - 0.07, 0, hd - 0.07), P(hw - 0.07, 0, -hd + 0.07), P(hw - 0.07, h - 0.04, 0), wall);
  // ridge cap
  acc.box(cx, y + h - 0.02, cz, w * Math.abs(cs) + 0.04 * Math.abs(sn), 0.04, w * Math.abs(sn) + 0.04 * Math.abs(cs), { color: dark });
}

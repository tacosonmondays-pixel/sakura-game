// Cute carved jack-o'-lantern pumpkins (Halloween event): a flattened, ribbed sphere with a
// stem, plus a glowing carved face (triangle eyes + a toothy smile) laid over its front like a
// sticker. Shared by the `pumpkins` scenery prop (props.js) and the enemy costumes
// (costumes.js). Everything is baked into GeoBuilders (vertex colours), so it costs nothing
// extra per instance.
import * as THREE from 'three';

/** Pumpkin palette (sRGB hex). */
export const PUMPKIN_COLORS = {
  skin: '#f28c28',
  skinDark: '#d4691a',
  stem: '#5f7d3a',
  leaf: '#7fb24a',
  glow: '#ffc24a',
};

/**
 * Ribbed, flattened sphere centred on the origin (radius r, height 2·r·sy).
 * @param {number} r radius
 * @param {{ ribs?: number, sy?: number, ws?: number, hs?: number }} [o]
 */
export function pumpkinGeometry(r, { ribs = 8, sy = 0.8, ws = 16, hs = 10 } = {}) {
  const g = new THREE.SphereGeometry(r, ws, hs);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    // grooves between the lobes
    const k = 0.9 + 0.1 * Math.pow(Math.abs(Math.sin(a * ribs * 0.5)), 0.6);
    const hr = Math.hypot(x, z) / r;
    // dimpled top and bottom (stem socket)
    const dimple = Math.sign(y) * 0.14 * r * (1 - hr) * (1 - hr);
    p.setXYZ(i, x * k, y * sy - dimple, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** Height of the pumpkin's front surface at (x, y) (for laying the face over it). */
function surfaceZ(r, sy, x, y) {
  const u = x / r;
  const v = y / (r * sy);
  return r * Math.sqrt(Math.max(0.04, 1 - u * u - v * v));
}

/** A flat outline (points in units of r) wrapped onto the pumpkin's front. */
function faceSticker(points, r, sy, lift) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x * r, y * r)));
  const g = new THREE.ShapeGeometry(shape);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, surfaceZ(r, sy, p.getX(i), p.getY(i)) + lift * r);
  return g;
}

function smilePoints(w = 0.5, teeth = 2) {
  // upper edge (left → right) with little square teeth hanging down, lower edge back
  const pts = [];
  const n = 10;
  const top = (t) => -0.1 + 0.16 * t * t;
  const bot = (t) => -0.36 + 0.24 * t * t;
  for (let i = 0; i <= n; i++) {
    const t = -1 + (2 * i) / n;
    pts.push([t * w, top(t)]);
    if (teeth && i < n) {
      const tm = t + 1 / n;
      const isTooth = teeth === 1 ? Math.abs(tm) < 0.05 : Math.abs(Math.abs(tm) - 0.4) < 0.05;
      if (isTooth) {
        pts.push([(tm - 0.07) * w, top(tm) - 0.09]);
        pts.push([(tm + 0.07) * w, top(tm) - 0.09]);
      }
    }
  }
  for (let i = n; i >= 0; i--) {
    const t = -1 + (2 * i) / n;
    pts.push([t * w * 0.94, bot(t)]);
  }
  return pts;
}

/**
 * Adds a pumpkin to a solid + glow builder pair.
 * @param {import('./geo.js').GeoBuilder} solid lit parts
 * @param {import('./geo.js').GeoBuilder|null} glow unlit parts (the carved face); null = uncarved
 * @param {object} o
 * @param {number} o.r radius
 * @param {number} [o.x] centre x
 * @param {number} [o.y] centre y (default: resting on y = 0)
 * @param {number} [o.z] centre z
 * @param {number} [o.ry] yaw
 * @param {number} [o.sy] flattening
 * @param {'smile'|'grin'|'boss'|null} [o.face]
 * @param {string} [o.color] skin colour
 * @param {string} [o.eyeColor] eye glow colour
 * @param {string} [o.mouthColor] mouth glow colour
 * @param {boolean} [o.leaf] add a little leaf + curly vine by the stem
 * @param {number} [o.ws] sphere segments around
 */
export function addPumpkin(solid, glow, o) {
  const r = o.r;
  const sy = o.sy ?? 0.8;
  const x = o.x || 0;
  const z = o.z || 0;
  const y = o.y ?? r * sy * 0.92;
  const ry = o.ry || 0;
  const color = o.color || PUMPKIN_COLORS.skin;
  const hs = o.hs ?? 10;
  const ws = o.ws ?? 16;
  solid.add(pumpkinGeometry(r, { sy, ws, hs }), { x, y, z, ry, color, color2: o.color2 });
  // stem
  const stemH = r * 0.32;
  solid.cyl(r * 0.07, r * 0.11, stemH, 6, { x, y: y + r * sy * 0.78, z, rz: 0.22, ry, color: PUMPKIN_COLORS.stem });
  if (o.leaf) {
    const cy = Math.cos(ry);
    const sny = Math.sin(ry);
    const lx = r * 0.22;
    const lz = -r * 0.05;
    solid.sphere(r * 0.2, 6, 4, { x: x + lx * cy + lz * sny, y: y + r * sy * 0.9, z: z - lx * sny + lz * cy, sx: 1.2, sy: 0.22, sz: 0.62, ry: ry + 0.5, rz: -0.3, color: PUMPKIN_COLORS.leaf });
    solid.torus(r * 0.12, r * 0.022, 3, 8, { x: x - r * 0.2 * cy, y: y + r * sy * 0.98, z: z + r * 0.2 * sny, ry: ry + 1.2, rx: 0.4, arc: Math.PI * 1.5, color: PUMPKIN_COLORS.stem });
  }
  if (!glow || !o.face) return;
  const eye = o.eyeColor || PUMPKIN_COLORS.glow;
  const mouth = o.mouthColor || eye;
  const lift = 0.04;
  const place = { x, y, z, ry };
  if (o.face === 'boss') {
    // angry-cute: slanted triangle eyes, a wide jagged grin
    // (set high on the face: the battle camera looks down on it)
    for (const side of [-1, 1]) {
      const pts = [[side * 0.1, 0.18], [side * 0.52, 0.5], [side * 0.48, 0.12]];
      glow.add(faceSticker(pts, r, sy, lift), { ...place, color: eye });
    }
    glow.add(faceSticker([[-0.08, 0.1], [0.08, 0.1], [0, -0.02]], r, sy, lift), { ...place, color: mouth });
    glow.add(faceSticker(smilePoints(0.64, 2).map(([px, py]) => [px, py * 1.25 + 0.04]), r, sy, lift), { ...place, color: mouth });
    return;
  }
  for (const side of [-1, 1]) {
    const cx = side * 0.3;
    const pts = [[cx - 0.14, 0.04], [cx + 0.14, 0.04], [cx, 0.28]];
    glow.add(faceSticker(pts, r, sy, lift), { ...place, color: eye });
  }
  glow.add(faceSticker(smilePoints(0.46, o.face === 'grin' ? 2 : 1), r, sy, lift), { ...place, color: mouth });
}

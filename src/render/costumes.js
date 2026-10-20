// Halloween event costumes (render only, never touches the sim): little witch hats, pumpkin
// hats / pumpkin heads, capes and ghost bedsheets worn by ordinary monsters on stages whose
// StageDef.look.costumes is true, plus per-enemy render extras (the Gourdlight Golem's big
// carved pumpkin head) that show wherever that enemy appears.
//
//   costumeFor(def, seed)     → { kind, variant } | null   (pure + deterministic per instance)
//   enemyExtraFor(def)        → extra kind | null           (ENEMY_EXTRAS, by enemy id)
//   buildCostume(kind, variant, { quality }) → THREE.Group  (attach with model.userData.attach)
//
// Rules: never on a boss / miniboss; never over armour or ward signs (helmets, crowns, hoods
// and masks keep their head bare; armour, shields, shells and wards get no sheet or cape; capes
// skip bodies with wings / packs / shells on the back); costumes are picked per family so they
// fit the body (no sheets on dragons, no bedsheet on an actual ghost).
// Geometries and materials are shared (cached per kind + colour variant): one costume is two
// or three meshes of a few hundred triangles.
import * as THREE from 'three';
import { GeoBuilder, hash } from './geo.js';
import { addPumpkin, PUMPKIN_COLORS } from './pumpkin.js';
import { gradientMap } from '../models/toon.js';

/** Which attachment slot each costume rides on (models: userData.attach(obj, slot)). */
export const COSTUME_SLOT = {
  witchHat: 'head', pumpkinHat: 'head', pumpkinHead: 'head', sheet: 'head', cape: 'back', bossPumpkin: 'head',
};

/** Costumes that suit each enemy family's body. */
export const FAMILY_COSTUMES = {
  slime: ['witchHat', 'pumpkinHat'],
  goblin: ['witchHat', 'pumpkinHead', 'cape', 'sheet'],
  orc: ['witchHat', 'pumpkinHead', 'cape'],
  lizard: ['witchHat', 'pumpkinHead', 'cape'],
  ghost: ['witchHat', 'pumpkinHat'],
  ghoul: ['witchHat', 'pumpkinHead', 'cape', 'sheet'],
  beast: ['witchHat', 'pumpkinHat'],
  oni: ['witchHat', 'pumpkinHead', 'cape'],
  fae: ['witchHat', 'pumpkinHat', 'sheet'],
  plant: ['witchHat', 'pumpkinHat'],
  construct: ['witchHat', 'pumpkinHead'],
  dragon: ['witchHat'],
};

/** Render-only extras keyed by enemy id (shown on every stage, costumes or not). */
export const ENEMY_EXTRAS = { construct_gourdlight: 'bossPumpkin' };

const HEADWEAR = ['helmet', 'crown', 'hood', 'mask', 'tiara', 'goggles'];
const ARMOUR = ['armor', 'shield', 'towerShield', 'shell'];
const BACKWEAR = ['cape', 'wings', 'backpack', 'shell', 'crystals', 'bomb', 'chimney', 'mane'];
/** 1 in PLAIN monsters keeps its everyday look (so a wave reads as a mixed costume parade). */
const PLAIN = 7;

/** Costumes this enemy may wear (empty for bosses / minibosses). */
export function costumeOptions(def) {
  if (!def) return [];
  if (def.tier === 'boss' || def.tier === 'miniboss') return [];
  const fam = def.model?.base || def.family;
  const list = FAMILY_COSTUMES[fam];
  if (!list) return [];
  const props = new Set(def.model?.props || def.props || []);
  const variant = String(def.model?.variant || def.variant || '').toLowerCase();
  const headwear = HEADWEAR.some((p) => props.has(p)) || (fam === 'slime' && (def.armor > 0 || variant.includes('iron')));
  const armoured = def.armor > 0 || ARMOUR.some((p) => props.has(p)) || !!def.traits?.guardian;
  const warded = !!def.traits?.ward;
  return list.filter((k) => {
    if (k === 'cape') return !armoured && !warded && !BACKWEAR.some((p) => props.has(p));
    if (k === 'sheet') return fam !== 'ghost' && !armoured && !warded && !headwear && !props.has('wings') && !props.has('cape');
    return !headwear;
  });
}

/**
 * Deterministic costume for one enemy instance.
 * @param {object} def EnemyDef
 * @param {number|string} seed per-instance id (the actor's uid)
 * @returns {{ kind: string, variant: number }|null}
 */
export function costumeFor(def, seed) {
  const opts = costumeOptions(def);
  if (!opts.length) return null;
  const h = hash('costume', seed, def.id);
  if (h % PLAIN === 0) return null;
  return { kind: opts[(h >>> 4) % opts.length], variant: (h >>> 12) % 2 };
}

/** The render extra an enemy always wears (by id), or null. */
export function enemyExtraFor(def) {
  return (def && ENEMY_EXTRAS[def.id]) || null;
}

// ---------------------------------------------------------------------------
// Geometry (built in slot units: origin = slot centre, 1 = slot radius, +z forward)
// ---------------------------------------------------------------------------

const OUTLINE = 0.06;

function witchHat(B, G, v) {
  const main = v ? '#4b3a86' : '#8a52e6';
  const band = v ? '#ff9a3d' : '#ffc14d';
  B.cyl(1.22, 1.28, 0.1, 18, { color: main });
  B.cyl(0.6, 0.7, 0.55, 14, { y: 0.06, color: main });
  B.cyl(0.72, 0.73, 0.17, 14, { y: 0.1, color: band });
  B.box(0.24, 0.22, 0.08, { y: 0.07, z: 0.7, color: '#ffe066' });
  B.cyl(0.36, 0.6, 0.42, 12, { y: 0.6, color: main });
  B.cone(0.37, 0.62, 10, { y: 1.0, rx: -0.75, color: main });
  // a tiny glowing star dangling off the bent tip
  G.add(new THREE.OctahedronGeometry(0.11, 0), { y: 1.18, z: -0.62, color: '#ffe680' });
}

function pumpkinHat(B, G, v) {
  addPumpkin(B, G, { r: 0.62, y: 0, sy: 0.8, face: v ? 'grin' : 'smile', leaf: true, ws: 14, hs: 9 });
}

function pumpkinHead(B, G, v) {
  addPumpkin(B, G, { r: 1, y: 0, sy: 0.86, face: v ? 'grin' : 'smile', leaf: !v, ws: 16, hs: 10, color: v ? '#f59a2f' : PUMPKIN_COLORS.skin });
}

function bossPumpkin(B, G) {
  addPumpkin(B, G, { r: 1, y: 0, sy: 0.82, face: 'boss', leaf: true, ws: 22, hs: 13, color: '#f28c28', eyeColor: '#d49bff', mouthColor: '#ffb43a' });
  // a curly vine wrapped around the crown + a second leaf
  B.torus(0.42, 0.035, 4, 16, { y: 0.66, rx: Math.PI / 2 + 0.15, arc: Math.PI * 1.4, color: PUMPKIN_COLORS.stem });
  B.sphere(0.2, 6, 4, { x: -0.3, y: 0.74, z: 0.2, sx: 1.2, sy: 0.22, sz: 0.6, ry: -0.7, rz: 0.35, color: PUMPKIN_COLORS.leaf });
}

function sheet(B, G, v) {
  const prof = [[1.42, -1.45], [1.3, -1.0], [1.14, -0.3], [0.98, 0.3], [0.72, 0.78], [0.36, 1.04], [0, 1.1]].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(prof, 16);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < -1.4) p.setY(i, y + 0.13 * Math.sin(6 * Math.atan2(p.getZ(i), p.getX(i))));
  }
  g.computeVertexNormals();
  // a cool white: the warm lantern key light would turn a warm white pink
  B.add(g, { color: v ? '#e2fff6' : '#e6f9ff' });
  // eye holes + a little "o" mouth
  for (const side of [-1, 1]) B.sphere(0.14, 8, 6, { x: side * 0.34, y: 0.3, z: 0.92, sx: 0.75, sy: 1.15, sz: 0.4, color: '#2a2238' });
  B.sphere(0.08, 8, 6, { y: -0.02, z: 1.02, sy: 1.2, sz: 0.4, color: '#2a2238' });
}

function cape(B, G, v) {
  const main = v ? '#5b3a8c' : '#ff8a3d';
  const lining = v ? '#ff9a3d' : '#6b3fa6';
  const pts = [[-0.72, 0], [0.72, 0], [1.05, -1.7]];
  for (let i = 0; i <= 6; i++) {
    const x = 1.05 - (2.1 * i) / 6;
    pts.push([x, i % 2 ? -1.95 : -1.7]);
  }
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const outer = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
  outer.translate(0, 0, -0.12);
  B.add(outer, { rx: 0.22, color: main });
  const inner = new THREE.ShapeGeometry(shape);
  inner.scale(0.94, 0.97, 1);
  B.add(inner, { rx: 0.22, z: -0.035, color: lining });
  B.box(1.6, 0.2, 0.32, { y: -0.12, z: 0.04, color: main });
  B.sphere(0.12, 8, 6, { y: -0.02, z: 0.22, color: '#ffe066' });
}

const BUILDERS = { witchHat, pumpkinHat, pumpkinHead, bossPumpkin, sheet, cape };

/** Pumpkin radius whose (flattened) sphere reaches the corner of the slot's box. */
function corner(d, sy) {
  return Math.hypot(Math.min(d.side, 1.4), d.top / sy, d.front);
}

/** Places a costume's meshes for the slot's half extents (dims, in slot units). */
const FITS = {
  witchHat: (o, d) => {
    // a blob body (slime / ghost / plant) wears a smaller hat perched on its crown
    o.position.set(0, d.top * (d.blob ? 0.82 : 0.74), d.blob ? 0 : -0.05);
    o.rotation.set(-0.08, 0, 0.16);
    o.scale.setScalar(d.blob ? 0.6 : 0.92);
  },
  pumpkinHat: (o, d) => {
    o.position.set(0.05, d.top + (d.blob ? 0.2 : 0.32), 0);
    o.rotation.set(0, 0, -0.12);
    o.scale.setScalar(d.blob ? 0.75 : 1);
  },
  pumpkinHead: (o, d) => {
    // big enough to swallow a boxy head's corners (constructs), not just a round one
    const s = Math.max(1.08 * Math.max(1, d.top / 0.86, d.front / 0.94), 0.85 * corner(d, 0.86));
    o.position.set(0, 0.02, 0.04);
    o.scale.setScalar(s);
  },
  bossPumpkin: (o, d) => {
    const s = Math.max(1.2 * Math.max(1, d.top / 0.82, d.front / 0.94), 0.95 * corner(d, 0.82));
    o.position.set(0, d.top * 0.25, 0.05);
    o.scale.setScalar(s);
  },
  sheet: (o, d) => {
    o.position.set(0, 0.05, 0);
    // (wide ears / horns poke out instead of stretching the sheet)
    o.scale.set(Math.min(1.25, Math.max(1, d.side * 0.95)), Math.min(1.3, Math.max(1, d.top)), Math.min(1.3, Math.max(1, d.front)));
  },
  cape: (o, d) => {
    // hangs from the shoulders, a bit wider than the back
    o.position.set(0, d.top * 1.25, -d.back * 1.02);
    o.scale.setScalar(1.25);
  },
};

let materials = null;
function sharedMaterials() {
  if (materials) return materials;
  const solid = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap(3) });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const outline = new THREE.MeshBasicMaterial({ color: '#2a1f3d', side: THREE.BackSide });
  // the bedsheet glows a little on its own, so it stays sheet-white under the violet / orange lantern light
  const sheetMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap(3), emissive: '#4a5878' });
  for (const m of [solid, glow, outline, sheetMat]) m.userData.shared = true;
  materials = { solid, glow, outline, sheet: sheetMat };
  return materials;
}

const geoCache = new Map();
function costumeGeometry(kind, variant) {
  const key = `${kind}|${variant}`;
  let g = geoCache.get(key);
  if (g) return g;
  const B = new GeoBuilder({ flat: false });
  const G = new GeoBuilder({ flat: false });
  (BUILDERS[kind] || witchHat)(B, G, variant);
  // primitives come indexed and not (extrusions, polyhedra): merge them all non-indexed
  for (const b of [B, G]) b.parts = b.parts.map((x) => (x.index ? x.toNonIndexed() : x));
  const solid = B.finish();
  const glow = G.finish();
  let outline = null;
  if (solid) {
    // inverted hull: the body pushed out along its normals
    outline = solid.clone();
    const p = outline.attributes.position;
    const n = outline.attributes.normal;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * OUTLINE, p.getY(i) + n.getY(i) * OUTLINE, p.getZ(i) + n.getZ(i) * OUTLINE);
    outline.deleteAttribute('color');
  }
  for (const x of [solid, glow, outline]) if (x) x.userData.shared = true;
  g = { solid, glow, outline };
  geoCache.set(key, g);
  return g;
}

/**
 * A costume instance (shared geometry + materials). Attach it with
 * `model.userData.attach(costume, COSTUME_SLOT[kind])`; the model calls `userData.fit(dims)`.
 * @param {string} kind costume / extra kind
 * @param {number} [variant] colour variant (0 | 1)
 * @param {{ quality?: string }} [opts]
 */
export function buildCostume(kind, variant = 0, { quality = 'high' } = {}) {
  const geo = costumeGeometry(kind, variant);
  const mats = sharedMaterials();
  const root = new THREE.Group();
  root.name = `costume:${kind}`;
  const inner = new THREE.Group();
  root.add(inner);
  if (geo.solid) inner.add(new THREE.Mesh(geo.solid, kind === 'sheet' ? mats.sheet : mats.solid));
  if (geo.outline && quality !== 'low') {
    const o = new THREE.Mesh(geo.outline, mats.outline);
    o.userData.isOutline = true;
    inner.add(o);
  }
  if (geo.glow) {
    const gl = new THREE.Mesh(geo.glow, mats.glow);
    gl.userData.fx = true;
    inner.add(gl);
  }
  for (const m of inner.children) m.frustumCulled = false;
  root.userData.costume = kind;
  root.userData.slot = COSTUME_SLOT[kind] || 'head';
  root.userData.fit = (dims) => (FITS[kind] || FITS.witchHat)(inner, { top: 1, front: 1, back: 1, side: 1, ...(dims || {}) });
  root.userData.fit({});
  return root;
}

/** Frees the shared costume geometries + materials (last renderer disposed). */
export function clearCostumeCache() {
  for (const g of geoCache.values()) for (const x of [g.solid, g.glow, g.outline]) x?.dispose();
  geoCache.clear();
  if (materials) for (const m of Object.values(materials)) m.dispose();
  materials = null;
}

// Procedural low-poly props for battle maps (trees, rocks, shrines, stalls, machinery…).
// Each prop is baked into up to three geometries — solid (lit), foliage (lit + wind sway)
// and glow (unlit emissive) — plus glow sprites and particle emitters in local space.
// Origin = tile centre on the ground, +y up, footprint ≈ 1 tile.
import * as THREE from 'three';
import { GeoBuilder, makeRand, hash } from './geo.js';

const swayW = (x, y) => Math.max(0, Math.min(1, (y - 0.25) * 0.9));

const cache = new Map();

/**
 * Builds (or returns cached) prop geometry.
 * @param {string} type prop type
 * @param {object} look resolved theme look (themes.js)
 * @param {number} variant small integer for variation
 * @returns {{ solid, foliage, glow, glows: object[], emitters: object[] }}
 */
export function buildProp(type, look, variant = 0) {
  const key = `${type}|${look.theme}|${look.night ? 'n' : 'd'}|${variant}`;
  let p = cache.get(key);
  if (p) return p;
  const ctx = {
    solid: new GeoBuilder(),
    foliage: new GeoBuilder({ extra: ['sway'] }),
    glow: new GeoBuilder(),
    glows: [],
    emitters: [],
    rand: makeRand(hash(type, look.theme, variant)),
    look,
    variant,
  };
  const fn = BUILDERS[type] || BUILDERS.rock;
  fn(ctx);
  p = {
    solid: ctx.solid.finish(),
    foliage: ctx.foliage.finish(),
    glow: ctx.glow.finish(),
    glows: ctx.glows,
    emitters: ctx.emitters,
  };
  cache.set(key, p);
  return p;
}

/** Frees cached prop geometry (call when the last renderer is disposed). */
export function clearPropCache() {
  for (const p of cache.values()) {
    p.solid?.dispose();
    p.foliage?.dispose();
    p.glow?.dispose();
  }
  cache.clear();
}

export function hasProp(type) {
  return !!BUILDERS[type];
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function leaf(c, r, o) {
  c.foliage.blob(r, { detail: 1, wobble: 0.22, jitter: 0.07, rand: c.rand, attrs: { sway: swayW }, ...o });
}

function trunk(c, h, r, color, o = {}) {
  c.solid.cyl(r * 0.7, r, h, 6, { color, jitter: 0.05, rand: c.rand, ...o });
}

function glowPoint(c, x, y, z, color, size = 0.6, flicker = 0.15) {
  c.glows.push({ x, y, z, color, size, flicker });
}

function roofPrism(B, w, d, h, o) {
  // gable roof: triangular prism along x
  const g = new THREE.BufferGeometry();
  const hw = w / 2;
  const hd = d / 2;
  const v = [
    // left slope
    -hw, 0, hd, hw, 0, hd, hw, h, 0, -hw, 0, hd, hw, h, 0, -hw, h, 0,
    // right slope
    hw, 0, -hd, -hw, 0, -hd, -hw, h, 0, hw, 0, -hd, -hw, h, 0, hw, h, 0,
    // gables
    -hw, 0, -hd, -hw, 0, hd, -hw, h, 0,
    hw, 0, hd, hw, 0, -hd, hw, h, 0,
  ];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  B.add(g, o);
}

/** Japanese curved-eave roof approximated by two stacked, flaring prisms. */
function shrineRoof(B, w, d, y, color, trim) {
  roofPrism(B, w * 1.2, d * 1.25, 0.12, { y, color: trim });
  roofPrism(B, w * 1.12, d * 1.15, 0.34, { y: y + 0.06, color });
  B.box(w * 0.9, 0.05, 0.06, { y: y + 0.38, color: trim });
}

// ---------------------------------------------------------------------------
// builders
// ---------------------------------------------------------------------------

const BUILDERS = {
  // ----- trees ---------------------------------------------------------------
  sakura(c) {
    const { trunk: tc } = { trunk: '#7d5240' };
    const s = 0.9 + c.rand() * 0.25;
    trunk(c, 0.55 * s, 0.09 * s, tc);
    c.solid.cyl(0.03, 0.05, 0.32 * s, 5, { x: 0.08, y: 0.4 * s, rz: -0.7, color: tc });
    c.solid.cyl(0.03, 0.05, 0.3 * s, 5, { x: -0.06, y: 0.42 * s, rz: 0.8, color: tc });
    const pinks = ['#ffc2d8', '#ffaecb', '#ff97bd', '#ffd6e6'];
    const blobs = [[0, 0.82, 0, 0.36], [0.24, 0.72, 0.08, 0.27], [-0.24, 0.74, -0.04, 0.28], [0.06, 0.74, 0.24, 0.26], [-0.05, 0.7, -0.24, 0.25], [0.02, 1.02, 0.02, 0.24]];
    blobs.forEach(([x, y, z, r], i) => leaf(c, r * s, { x: x * s, y: y * s, z: z * s, color: pinks[(i + c.variant) % pinks.length], sy: 0.85 }));
  },
  round(c) {
    const { leaf: l1, leaf2: l2, trunk: tc } = c.look.treeColors;
    const L1 = c.look.theme === 'sakura' || c.look.theme === 'arena' ? '#72c45e' : l1;
    const L2 = c.look.theme === 'sakura' || c.look.theme === 'arena' ? '#58ad4f' : l2;
    const s = 0.85 + c.rand() * 0.3;
    trunk(c, 0.5 * s, 0.08 * s, c.look.theme === 'sakura' ? '#7a5236' : tc);
    leaf(c, 0.38 * s, { y: 0.78 * s, color: L1 });
    leaf(c, 0.26 * s, { x: 0.2 * s, y: 0.66 * s, z: 0.12 * s, color: L2 });
    leaf(c, 0.25 * s, { x: -0.18 * s, y: 0.7 * s, z: -0.1 * s, color: L2 });
    leaf(c, 0.22 * s, { x: 0.02, y: 1.02 * s, color: L1 });
  },
  maple(c) {
    const s = 0.85 + c.rand() * 0.3;
    trunk(c, 0.5 * s, 0.08 * s, '#6d4433');
    const cols = ['#ff8a4c', '#f0643a', '#ffb347', '#e8553a'];
    [[0, 0.8, 0, 0.36], [0.2, 0.68, 0.1, 0.26], [-0.2, 0.7, -0.08, 0.26], [0, 1.02, 0, 0.22]]
      .forEach(([x, y, z, r], i) => leaf(c, r * s, { x: x * s, y: y * s, z: z * s, color: cols[(i + c.variant) % 4] }));
  },
  pine(c) {
    const { leaf: l1, leaf2: l2 } = c.look.treeColors;
    const s = 0.85 + c.rand() * 0.35;
    trunk(c, 0.3 * s, 0.07 * s, '#6a4a36');
    const tiers = [[0.42, 0.25, 0.55], [0.34, 0.55, 0.5], [0.24, 0.82, 0.45]];
    tiers.forEach(([r, y, h], i) => c.foliage.cone(r * s, h * s, 7, {
      y: y * s, color: i % 2 ? l1 : l2, jitter: 0.06, rand: c.rand, attrs: { sway: swayW }, ry: i,
    }));
  },
  snowPine(c) {
    const { leaf: l1, leaf2: l2 } = c.look.treeColors;
    const s = 0.85 + c.rand() * 0.35;
    trunk(c, 0.3 * s, 0.07 * s, '#5e4636');
    const tiers = [[0.42, 0.25, 0.55], [0.34, 0.55, 0.5], [0.24, 0.82, 0.45]];
    tiers.forEach(([r, y, h], i) => {
      c.foliage.cone(r * s, h * s, 7, { y: y * s, color: i % 2 ? l1 : l2, jitter: 0.05, rand: c.rand, attrs: { sway: swayW }, ry: i });
      c.foliage.cone(r * s * 0.72, h * s * 0.42, 7, { y: (y + h * 0.6) * s, color: '#f4f9ff', attrs: { sway: swayW }, ry: i });
    });
  },
  cedar(c) {
    const { leaf: l1, leaf2: l2 } = c.look.treeColors;
    const s = 0.9 + c.rand() * 0.3;
    trunk(c, 0.45 * s, 0.08 * s, '#6a4632');
    leaf(c, 0.3 * s, { y: 0.55 * s, sy: 1.1, color: l2 });
    leaf(c, 0.26 * s, { y: 0.88 * s, sy: 1.1, color: l1 });
    leaf(c, 0.19 * s, { y: 1.16 * s, sy: 1.2, color: l2 });
  },
  willow(c) {
    const { leaf: l1, leaf2: l2 } = c.look.treeColors;
    const s = 0.9 + c.rand() * 0.25;
    trunk(c, 0.6 * s, 0.1 * s, '#5f4a38');
    leaf(c, 0.42 * s, { y: 0.85 * s, sy: 0.7, color: l1 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + c.rand() * 0.3;
      const r = 0.36 * s;
      c.foliage.box(0.07, 0.5 * s, 0.07, {
        x: Math.cos(a) * r, y: 0.32 * s, z: Math.sin(a) * r, ry: a, color: i % 2 ? l1 : l2, attrs: { sway: (x, y) => 0.4 + swayW(x, y) },
      });
    }
  },
  dead(c) {
    const s = 0.85 + c.rand() * 0.3;
    const col = c.look.theme === 'marsh' ? '#6b5a50' : '#5c4f55';
    trunk(c, 0.7 * s, 0.09 * s, col);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + c.rand();
      c.foliage.cyl(0.015, 0.04, 0.38 * s, 4, {
        x: Math.cos(a) * 0.08, y: (0.45 + i * 0.07) * s, z: Math.sin(a) * 0.08, ry: a, rz: 0.9, color: col, attrs: { sway: swayW },
      });
    }
    if (c.look.theme === 'marsh' && c.variant % 2 === 0) leaf(c, 0.16, { x: 0.12, y: 0.82 * s, color: '#7f9a62' });
  },
  charred(c) {
    const s = 0.85 + c.rand() * 0.3;
    trunk(c, 0.62 * s, 0.09 * s, '#2e2424');
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + c.rand();
      c.solid.cyl(0.015, 0.04, 0.32 * s, 4, { x: Math.cos(a) * 0.06, y: (0.4 + i * 0.08) * s, z: Math.sin(a) * 0.06, ry: a, rz: 0.9, color: '#3a2e2a' });
    }
    c.glow.sphere(0.035, 6, 4, { y: 0.66 * s, x: 0.1, color: '#ff8a3d' });
    glowPoint(c, 0.1, 0.66 * s, 0, '#ff7a33', 0.35, 0.4);
  },
  scrap(c) {
    c.solid.box(0.42, 0.32, 0.42, { x: -0.12, z: 0.08, ry: 0.3, color: '#9b7a52', jitter: 0.05, rand: c.rand });
    c.solid.box(0.3, 0.26, 0.3, { x: 0.18, z: -0.12, ry: -0.2, color: '#8a6c48' });
    c.solid.cyl(0.14, 0.14, 0.42, 10, { x: 0.16, z: 0.22, color: '#6f7682' });
    c.solid.cyl(0.15, 0.15, 0.03, 10, { x: 0.16, y: 0.42, z: 0.22, color: '#ffcc33' });
  },
  bamboo(c) {
    for (let i = 0; i < 6; i++) {
      const a = c.rand() * Math.PI * 2;
      const r = c.rand() * 0.25;
      const h = 0.8 + c.rand() * 0.5;
      c.foliage.cyl(0.03, 0.035, h, 5, { x: Math.cos(a) * r, z: Math.sin(a) * r, color: '#7dbb5a', attrs: { sway: swayW } });
      leaf(c, 0.1, { x: Math.cos(a) * r, y: h, z: Math.sin(a) * r, color: '#5fae4a', sy: 0.5 });
    }
  },

  // ----- ground detail ----------------------------------------------------------------
  tuft(c) {
    const base = new THREE.Color(c.look.ground[0]);
    const dark = `#${base.clone().multiplyScalar(0.72).getHexString()}`;
    const light = `#${base.clone().lerp(new THREE.Color('#ffffff'), 0.12).getHexString()}`;
    const n = 4 + (c.variant % 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + c.rand();
      const r = 0.03 + c.rand() * 0.05;
      const h = 0.09 + c.rand() * 0.08;
      c.foliage.cone(0.022, h, 3, {
        x: Math.cos(a) * r, z: Math.sin(a) * r, rx: Math.sin(a) * 0.3, rz: -Math.cos(a) * 0.3, color: i % 2 ? dark : light,
        attrs: { sway: (x, y) => y * 4 },
      });
    }
  },
  crack(c) {
    let x = -0.3;
    let z = (c.rand() - 0.5) * 0.3;
    for (let i = 0; i < 4; i++) {
      const len = 0.16 + c.rand() * 0.14;
      const a = (c.rand() - 0.5) * 1.6;
      const nx = x + Math.cos(a) * len;
      const nz = z + Math.sin(a) * len;
      c.glow.box(len, 0.006, 0.03, { x: (x + nx) / 2, y: 0.002, z: (z + nz) / 2, ry: -a, color: i % 2 ? '#ff7a2a' : '#ffb347' });
      x = nx;
      z = nz;
    }
    c.solid.rock(0.05, { x: 0.25, y: 0.01, z: 0.15, sy: 0.5, color: '#3a2e2e' });
  },
  pebbles(c) {
    for (let i = 0; i < 4; i++) {
      c.solid.rock(0.03 + c.rand() * 0.03, { x: (c.rand() - 0.5) * 0.4, y: 0.01, z: (c.rand() - 0.5) * 0.4, sy: 0.6, color: c.look.rock, jitter: 0.1, rand: c.rand });
    }
  },

  // ----- rocks & nature -----------------------------------------------------------
  rock(c) {
    const col = c.look.rock;
    const n = 1 + (c.variant % 3);
    for (let i = 0; i < n; i++) {
      const r = (i === 0 ? 0.28 : 0.16) + c.rand() * 0.1;
      const x = i === 0 ? 0 : (c.rand() - 0.5) * 0.6;
      const z = i === 0 ? 0 : (c.rand() - 0.5) * 0.6;
      c.solid.rock(r, { x, y: r * 0.5, z, sy: 0.7, ry: c.rand() * 6, rx: c.rand() * 0.4, color: col, jitter: 0.08, rand: c.rand });
      if (c.look.theme === 'snow' || c.look.theme === 'mountain') {
        c.solid.rock(r * 0.8, { x, y: r * 0.82, z, sy: 0.3, ry: c.rand() * 6, color: '#f4f8fc' });
      }
    }
  },
  boulder(c) {
    const col = c.look.rock;
    c.solid.rock(0.46, { y: 0.3, sy: 0.75, ry: c.rand() * 6, color: col, jitter: 0.08, rand: c.rand });
    c.solid.rock(0.24, { x: 0.32, y: 0.12, z: 0.2, sy: 0.7, color: col, jitter: 0.08, rand: c.rand });
    if (c.look.theme === 'snow' || c.look.theme === 'mountain') c.solid.rock(0.36, { y: 0.52, sy: 0.3, color: '#f4f8fc' });
    if (c.look.theme === 'volcano' && c.variant % 2) {
      c.glow.box(0.04, 0.3, 0.02, { x: 0.1, y: 0.15, z: 0.42, rz: 0.3, color: '#ff7a33' });
      glowPoint(c, 0.1, 0.25, 0.42, '#ff6a2a', 0.4, 0.3);
    }
  },
  crystal(c) {
    const cols = c.look.theme === 'volcano' ? ['#ff8a5c', '#ffb36b'] : ['#8ff0ff', '#c4a6ff', '#7fd8ff'];
    c.solid.rock(0.2, { y: 0.06, sy: 0.4, color: c.look.rock });
    const n = 3 + (c.variant % 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const h = i === 0 ? 0.62 : 0.3 + c.rand() * 0.25;
      const g = new THREE.OctahedronGeometry(0.1, 0);
      c.glow.add(g, {
        x: i === 0 ? 0 : Math.cos(a) * 0.14, y: h * 0.5, z: i === 0 ? 0 : Math.sin(a) * 0.14, sy: h * 5, sx: 0.9, sz: 0.9,
        rz: i === 0 ? 0 : Math.cos(a) * 0.4, rx: i === 0 ? 0 : Math.sin(a) * 0.4, color: cols[i % cols.length], color2: '#ffffff',
      });
    }
    glowPoint(c, 0, 0.35, 0, cols[0], 0.9, 0.12);
    c.emitters.push({ kind: 'sparkle', x: 0, y: 0.5, z: 0, color: cols[0] });
  },
  reeds(c) {
    for (let i = 0; i < 7; i++) {
      const a = c.rand() * Math.PI * 2;
      const r = c.rand() * 0.22;
      const h = 0.3 + c.rand() * 0.3;
      c.foliage.cone(0.025, h, 3, { x: Math.cos(a) * r, z: Math.sin(a) * r, color: i % 2 ? '#7fae5a' : '#9cc46a', attrs: { sway: (x, y) => y * 1.2 } });
      if (i % 3 === 0) c.foliage.cyl(0.025, 0.025, 0.09, 5, { x: Math.cos(a) * r, y: h * 0.85, z: Math.sin(a) * r, color: '#7a5236', attrs: { sway: () => h } });
    }
  },
  lilyPad(c) {
    for (let i = 0; i < 3; i++) {
      const g = new THREE.CircleGeometry(0.1 + c.rand() * 0.06, 9, 0.4, Math.PI * 1.8);
      g.rotateX(-Math.PI / 2);
      c.solid.add(g, { x: (c.rand() - 0.5) * 0.6, y: 0.005, z: (c.rand() - 0.5) * 0.6, ry: c.rand() * 6, color: '#5fae5a' });
    }
    if (c.variant % 2 === 0) c.solid.blob(0.045, { x: 0.05, y: 0.04, z: 0.02, color: '#ffc2d8' });
  },
  mushroom(c) {
    for (let i = 0; i < 3; i++) {
      const x = (c.rand() - 0.5) * 0.4;
      const z = (c.rand() - 0.5) * 0.4;
      const s = 0.6 + c.rand() * 0.6;
      c.solid.cyl(0.03 * s, 0.035 * s, 0.12 * s, 5, { x, z, color: '#f2e8d8' });
      c.glow.sphere(0.08 * s, 8, 5, { x, y: 0.12 * s, z, sy: 0.6, color: c.look.night ? '#9bf0ff' : '#ff6b6b' });
    }
    if (c.look.night) glowPoint(c, 0, 0.15, 0, '#7fe8ff', 0.5, 0.2);
  },
  flowersPatch(c) {
    const cols = c.look.flowers;
    for (let i = 0; i < 9; i++) {
      const x = (c.rand() - 0.5) * 0.8;
      const z = (c.rand() - 0.5) * 0.8;
      c.foliage.cyl(0.008, 0.008, 0.08, 3, { x, z, color: '#4f9a45', attrs: { sway: () => 0.2 } });
      c.foliage.blob(0.035, { x, y: 0.09, z, color: cols[(i + c.variant) % cols.length], attrs: { sway: () => 0.3 } });
    }
  },
  snowdrift(c) {
    c.solid.blob(0.3, { y: 0.02, sy: 0.35, sx: 1.4, color: '#f6faff', detail: 1, wobble: 0.15, rand: c.rand });
  },
  bramble(c) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      c.foliage.torus(0.18, 0.025, 4, 10, { x: Math.cos(a) * 0.15, y: 0.15, z: Math.sin(a) * 0.15, ry: a, rx: 0.5, color: '#4d5a36', arc: Math.PI * 1.3, attrs: { sway: () => 0.2 } });
    }
    c.solid.blob(0.04, { y: 0.32, color: '#b0304a' });
  },
  seedPod(c) {
    c.solid.cyl(0.02, 0.03, 0.3, 5, { color: '#5f7f3a' });
    c.foliage.blob(0.16, { y: 0.38, sy: 1.2, color: '#7fae4a', detail: 1, attrs: { sway: () => 0.5 } });
    c.glow.sphere(0.04, 6, 4, { y: 0.38, z: 0.14, color: '#e8ff7a' });
  },

  // ----- lights & shrine ----------------------------------------------------------
  stoneLantern(c) {
    const s = '#b9b4ac';
    const d = '#9d978e';
    c.solid.box(0.34, 0.08, 0.34, { color: d });
    c.solid.cyl(0.07, 0.09, 0.3, 6, { y: 0.08, color: s });
    c.solid.box(0.28, 0.05, 0.28, { y: 0.38, color: d });
    c.solid.box(0.06, 0.16, 0.06, { x: 0.1, y: 0.43, z: 0.1, color: s });
    c.solid.box(0.06, 0.16, 0.06, { x: -0.1, y: 0.43, z: 0.1, color: s });
    c.solid.box(0.06, 0.16, 0.06, { x: 0.1, y: 0.43, z: -0.1, color: s });
    c.solid.box(0.06, 0.16, 0.06, { x: -0.1, y: 0.43, z: -0.1, color: s });
    c.glow.box(0.15, 0.13, 0.15, { y: 0.445, color: '#ffd98a' });
    c.solid.cone(0.26, 0.16, 4, { y: 0.59, ry: Math.PI / 4, color: d });
    c.solid.sphere(0.04, 6, 4, { y: 0.77, color: s });
    glowPoint(c, 0, 0.5, 0, '#ffcf6b', 0.8, 0.12);
  },
  lantern(c) {
    c.solid.cyl(0.025, 0.03, 0.9, 5, { color: '#5a3a2a' });
    c.solid.box(0.3, 0.025, 0.025, { x: 0.12, y: 0.86, color: '#5a3a2a' });
    c.glow.sphere(0.11, 10, 8, { x: 0.24, y: 0.66, sy: 1.25, color: '#ff6a55', color2: '#ffb08a' });
    c.solid.cyl(0.06, 0.06, 0.03, 8, { x: 0.24, y: 0.79, color: '#2a1a1a' });
    c.solid.cyl(0.06, 0.06, 0.03, 8, { x: 0.24, y: 0.51, color: '#2a1a1a' });
    glowPoint(c, 0.24, 0.66, 0, '#ff8a5c', 0.9, 0.15);
  },
  paperLantern(c) {
    BUILDERS.lantern(c);
  },
  bridgeLantern(c) {
    c.solid.box(0.1, 0.5, 0.1, { color: '#7e2a26' });
    c.glow.box(0.14, 0.14, 0.14, { y: 0.5, color: '#ffd98a' });
    c.solid.cone(0.13, 0.1, 4, { y: 0.64, ry: Math.PI / 4, color: '#3a2a2a' });
    glowPoint(c, 0, 0.56, 0, '#ffcf6b', 0.7, 0.15);
  },
  candle(c) {
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.1;
      const h = 0.12 + (i % 2) * 0.06;
      c.solid.cyl(0.028, 0.03, h, 6, { x, z: (i % 2) * 0.06, color: '#f6efe0' });
      c.glow.sphere(0.025, 6, 4, { x, y: h + 0.03, z: (i % 2) * 0.06, sy: 1.6, color: '#ffd27a' });
    }
    glowPoint(c, 0, 0.2, 0.03, '#ffc36b', 0.55, 0.3);
  },
  spiritCandle(c) {
    c.solid.cyl(0.04, 0.045, 0.16, 6, { color: '#e8eef8' });
    c.glow.sphere(0.04, 8, 6, { y: 0.21, sy: 1.6, color: '#9fdcff' });
    glowPoint(c, 0, 0.22, 0, '#8fd0ff', 0.6, 0.3);
  },
  bogLight(c) {
    c.solid.cyl(0.02, 0.03, 0.35, 4, { color: '#4d4236' });
    c.glow.sphere(0.06, 8, 6, { y: 0.42, color: '#b8ff9a' });
    glowPoint(c, 0, 0.42, 0, '#9bff8a', 0.8, 0.35);
    c.emitters.push({ kind: 'wisp', x: 0, y: 0.5, z: 0, color: '#b8ff9a' });
  },
  torii(c) {
    const red = '#d6403a';
    const dark = '#2a2026';
    c.solid.cyl(0.055, 0.06, 1.05, 8, { x: -0.42, color: red });
    c.solid.cyl(0.055, 0.06, 1.05, 8, { x: 0.42, color: red });
    c.solid.cyl(0.075, 0.075, 0.08, 8, { x: -0.42, color: dark });
    c.solid.cyl(0.075, 0.075, 0.08, 8, { x: 0.42, color: dark });
    c.solid.box(1.08, 0.07, 0.1, { y: 0.8, color: red });
    c.solid.box(1.3, 0.08, 0.14, { y: 1.02, color: red });
    c.solid.box(1.38, 0.05, 0.17, { y: 1.1, color: dark });
    c.solid.box(0.07, 0.16, 0.08, { y: 0.88, color: red });
  },
  shrine(c) {
    c.solid.box(0.92, 0.12, 0.84, { color: '#b9b4ac', jitter: 0.03, rand: c.rand });
    c.solid.box(0.66, 0.42, 0.56, { y: 0.12, color: '#f2e6d0' });
    for (const [x, z] of [[-0.33, 0.28], [0.33, 0.28], [-0.33, -0.28], [0.33, -0.28]]) c.solid.cyl(0.035, 0.035, 0.46, 6, { x, y: 0.12, z, color: '#c4473e' });
    c.solid.box(0.3, 0.3, 0.02, { y: 0.14, z: 0.285, color: '#6b3d2a' });
    const roofs = c.look.roofs || ['#3f8f86', '#b8463e', '#4a6fa8'];
    shrineRoof(c.solid, 0.72, 0.62, 0.54, roofs[c.variant % roofs.length], '#3a3440');
    c.solid.box(0.12, 0.06, 0.06, { y: 0.93, color: '#e8c35a' });
    c.glow.box(0.08, 0.08, 0.02, { y: 0.4, z: 0.3, color: '#ffd98a' });
    glowPoint(c, 0, 0.4, 0.32, '#ffcf6b', 0.5, 0.1);
  },
  bell(c) {
    c.solid.box(0.06, 0.8, 0.06, { x: -0.3, color: '#7e2a26' });
    c.solid.box(0.06, 0.8, 0.06, { x: 0.3, color: '#7e2a26' });
    c.solid.box(0.75, 0.07, 0.1, { y: 0.8, color: '#2a2026' });
    c.solid.cyl(0.13, 0.18, 0.3, 10, { y: 0.42, color: '#c9a24a' });
    c.solid.cyl(0.02, 0.02, 0.1, 4, { y: 0.72, color: '#2a2026' });
  },
  statue(c) {
    c.solid.box(0.4, 0.22, 0.4, { color: '#a7a39b' });
    c.solid.box(0.32, 0.06, 0.32, { y: 0.22, color: '#bdb8af' });
    // guardian fox
    c.solid.blob(0.14, { y: 0.4, sy: 1.2, color: '#d9d4cb', detail: 1 });
    c.solid.blob(0.1, { y: 0.6, z: 0.04, color: '#d9d4cb', detail: 1 });
    c.solid.cone(0.04, 0.1, 4, { x: -0.06, y: 0.66, color: '#d9d4cb' });
    c.solid.cone(0.04, 0.1, 4, { x: 0.06, y: 0.66, color: '#d9d4cb' });
    c.solid.box(0.16, 0.05, 0.02, { y: 0.48, z: 0.13, color: '#c4473e' });
  },
  gravestone(c) {
    c.solid.box(0.24, 0.32, 0.08, { rz: (c.rand() - 0.5) * 0.2, color: '#8e939e', jitter: 0.04, rand: c.rand });
    c.solid.cyl(0.12, 0.12, 0.08, 8, { y: 0.3, rx: Math.PI / 2, sz: 0.5, color: '#8e939e' });
    c.solid.box(0.3, 0.04, 0.2, { color: '#6d727c' });
  },
  incense(c) {
    c.solid.cyl(0.14, 0.12, 0.14, 8, { color: '#5a5f6b' });
    c.solid.cyl(0.15, 0.15, 0.02, 8, { y: 0.14, color: '#3a3f4b' });
    c.glow.cyl(0.01, 0.01, 0.12, 3, { y: 0.14, color: '#ff8a5c' });
    c.emitters.push({ kind: 'incense', x: 0, y: 0.28, z: 0 });
  },
  runeStone(c) {
    c.solid.box(0.22, 0.5, 0.14, { rz: 0.05, color: '#7f8798', jitter: 0.05, rand: c.rand });
    c.glow.box(0.08, 0.2, 0.01, { y: 0.24, z: 0.075, color: '#b197fc' });
    glowPoint(c, 0, 0.3, 0.1, '#b197fc', 0.6, 0.2);
  },

  // ----- buildings -----------------------------------------------------------------
  house(c) {
    const roofs = ['#4f7fd6', '#d65a6a', '#5aa0d6'];
    const roof = roofs[c.variant % roofs.length];
    c.solid.box(0.8, 0.46, 0.66, { color: '#fbf3e6' });
    c.solid.box(0.82, 0.06, 0.68, { color: '#d9cdb8' });
    roofPrism(c.solid, 0.96, 0.82, 0.36, { y: 0.46, color: roof, jitter: 0.03, rand: c.rand });
    c.solid.box(0.16, 0.24, 0.02, { y: 0.02, z: 0.335, color: '#8a5a3a' });
    for (const x of [-0.24, 0.24]) {
      c.solid.box(0.16, 0.14, 0.02, { x, y: 0.22, z: 0.335, color: c.look.night ? '#ffe39a' : '#7fb8e6' });
      if (c.look.night) glowPoint(c, x, 0.29, 0.36, '#ffd27a', 0.45, 0.05);
    }
    c.solid.box(0.1, 0.22, 0.1, { x: 0.26, y: 0.6, z: -0.1, color: '#a8584a' });
  },
  hut(c) {
    c.solid.box(0.7, 0.4, 0.6, { color: '#b98f62', jitter: 0.05, rand: c.rand });
    c.solid.cone(0.62, 0.42, 4, { y: 0.4, ry: Math.PI / 4, sx: 1.1, color: '#d8c084', jitter: 0.06, rand: c.rand });
    c.solid.box(0.16, 0.24, 0.02, { z: 0.305, color: '#5a3a2a' });
    if (c.look.night) {
      c.glow.box(0.14, 0.12, 0.02, { x: 0.2, y: 0.2, z: 0.305, color: '#ffd27a' });
      glowPoint(c, 0.2, 0.26, 0.33, '#ffd27a', 0.45, 0.08);
    }
  },
  stiltHut(c) {
    for (const [x, z] of [[-0.28, 0.24], [0.28, 0.24], [-0.28, -0.24], [0.28, -0.24]]) c.solid.cyl(0.03, 0.035, 0.32, 5, { x, z, color: '#5a4636' });
    c.solid.box(0.72, 0.05, 0.62, { y: 0.3, color: '#7a6248' });
    c.solid.box(0.6, 0.34, 0.5, { y: 0.35, color: '#8f7656', jitter: 0.05, rand: c.rand });
    c.solid.cone(0.56, 0.36, 4, { y: 0.69, ry: Math.PI / 4, sx: 1.1, color: '#7f8a5a', jitter: 0.06, rand: c.rand });
    c.glow.box(0.12, 0.1, 0.02, { y: 0.48, z: 0.255, color: '#c8ff9a' });
    glowPoint(c, 0, 0.53, 0.28, '#b8ff9a', 0.45, 0.2);
  },
  tower(c) {
    c.solid.cyl(0.32, 0.36, 0.8, 8, { color: '#a7a39b', jitter: 0.05, rand: c.rand });
    c.solid.cyl(0.38, 0.38, 0.08, 8, { y: 0.8, color: '#8d8981' });
    c.solid.cone(0.42, 0.42, 8, { y: 0.88, color: '#6d4a3a' });
    c.solid.box(0.12, 0.22, 0.02, { y: 0.02, z: 0.35, color: '#5a3a2a' });
    c.solid.box(0.08, 0.12, 0.02, { y: 0.5, z: 0.33, color: c.look.night ? '#ffe39a' : '#3a3f4b' });
    c.solid.cyl(0.01, 0.01, 0.35, 3, { y: 1.25, color: '#5a3a2a' });
    c.solid.box(0.18, 0.1, 0.01, { x: 0.09, y: 1.48, color: '#d6403a' });
  },
  snowHouse(c) {
    c.solid.box(0.78, 0.44, 0.64, { color: '#c49a72' });
    roofPrism(c.solid, 0.96, 0.82, 0.38, { y: 0.44, color: '#f4f8fc' });
    c.solid.box(0.16, 0.24, 0.02, { z: 0.325, color: '#6a4632' });
    c.glow.box(0.14, 0.12, 0.02, { x: 0.24, y: 0.22, z: 0.325, color: '#ffd27a' });
    glowPoint(c, 0.24, 0.28, 0.35, '#ffcf6b', 0.45, 0.06);
    c.solid.box(0.1, 0.24, 0.1, { x: -0.24, y: 0.6, color: '#8a6a5a' });
    c.emitters.push({ kind: 'smoke', x: -0.24, y: 0.86, z: 0 });
  },
  stall(c) {
    const stripes = [['#e8504a', '#fff6ee'], ['#3d7fd6', '#fff6ee'], ['#f2a33a', '#fff6ee']][c.variant % 3];
    c.solid.box(0.8, 0.32, 0.4, { z: 0.12, color: '#b9875a', jitter: 0.04, rand: c.rand });
    c.solid.box(0.84, 0.04, 0.44, { y: 0.32, z: 0.12, color: '#8a5a36' });
    for (const [x, z] of [[-0.38, 0.32], [0.38, 0.32], [-0.38, -0.28], [0.38, -0.28]]) c.solid.cyl(0.025, 0.025, 0.72, 5, { x, z, color: '#6d4433' });
    for (let i = 0; i < 6; i++) {
      c.solid.box(0.15, 0.03, 0.72, { x: -0.375 + i * 0.15, y: 0.74, z: 0.02, rx: -0.25, color: stripes[i % 2] });
    }
    c.solid.box(0.9, 0.08, 0.03, { y: 0.66, z: 0.38, color: stripes[0] });
    // goods
    for (let i = 0; i < 4; i++) c.solid.blob(0.05, { x: -0.25 + i * 0.16, y: 0.38, z: 0.18, color: ['#ff6b6b', '#ffd43b', '#7bd389', '#ffb3cf'][i] });
    for (const x of [-0.3, 0, 0.3]) {
      c.glow.sphere(0.05, 8, 6, { x, y: 0.6, z: 0.4, sy: 1.2, color: '#ff7a5a' });
      glowPoint(c, x, 0.6, 0.42, '#ff9a6b', 0.4, 0.15);
    }
  },
  tent(c) {
    c.solid.cone(0.5, 0.6, 6, { color: '#e8dcc0', jitter: 0.04, rand: c.rand });
    c.solid.box(0.18, 0.3, 0.02, { z: 0.38, rx: -0.5, color: '#6d4433' });
    c.solid.cyl(0.015, 0.015, 0.25, 3, { y: 0.55, color: '#5a3a2a' });
    c.solid.box(0.14, 0.08, 0.01, { x: 0.07, y: 0.74, color: '#d6403a' });
  },
  machine(c) {
    const steel = '#8a909b';
    const dark = '#5a606b';
    c.solid.box(0.86, 0.5, 0.8, { color: steel, jitter: 0.03, rand: c.rand });
    c.solid.box(0.9, 0.06, 0.84, { y: 0.5, color: dark });
    c.solid.box(0.88, 0.06, 0.04, { y: 0.06, z: 0.41, color: '#ffcc33' });
    c.solid.torus(0.16, 0.04, 5, 12, { x: -0.18, y: 0.3, z: 0.42, color: '#b8a070' });
    c.solid.cyl(0.05, 0.05, 0.05, 6, { x: -0.18, y: 0.3, z: 0.42, rx: Math.PI / 2, color: dark });
    c.solid.cyl(0.06, 0.06, 0.6, 6, { x: 0.3, y: 0.5, z: -0.2, color: dark });
    c.solid.cyl(0.08, 0.08, 0.05, 6, { x: 0.3, y: 1.1, z: -0.2, color: '#3a3f4b' });
    c.glow.box(0.18, 0.1, 0.02, { x: 0.2, y: 0.28, z: 0.41, color: '#ff9a3d' });
    glowPoint(c, 0.2, 0.33, 0.44, '#ff8a3d', 0.45, 0.25);
    if (c.variant % 2 === 0) c.emitters.push({ kind: 'smoke', x: 0.3, y: 1.15, z: -0.2 });
  },
  obsidian(c) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + c.rand();
      const h = 0.4 + c.rand() * 0.5;
      const g = new THREE.ConeGeometry(0.14, h, 5);
      g.translate(0, h / 2, 0);
      c.solid.add(g, { x: Math.cos(a) * 0.16, z: Math.sin(a) * 0.16, rz: Math.cos(a) * 0.15, color: '#2c2530', jitter: 0.1, rand: c.rand });
    }
    c.glow.sphere(0.07, 8, 6, { y: 0.06, color: '#ff6a2a' });
    glowPoint(c, 0, 0.1, 0, '#ff5a1a', 0.7, 0.3);
  },
  stands(c) {
    for (let i = 0; i < 3; i++) c.solid.box(0.96, 0.18, 0.3, { y: i * 0.16, z: -0.3 + i * 0.0 - i * 0.12 + 0.3, color: i % 2 ? '#d9cdb8' : '#e8dcc6' });
    c.solid.box(0.04, 0.5, 0.04, { x: 0.4, y: 0.4, z: -0.25, color: '#6d4433' });
    c.solid.box(0.24, 0.14, 0.01, { x: 0.28, y: 0.78, z: -0.25, color: ['#ff6b8b', '#4cc9f0', '#ffd43b'][c.variant % 3] });
  },
  bookshelf(c) {
    c.solid.box(0.7, 0.62, 0.26, { color: '#8a5a36' });
    const cols = ['#d65a6a', '#4f7fd6', '#7bd389', '#ffd43b', '#b197fc'];
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 6; i++) {
        c.solid.box(0.08, 0.14, 0.2, { x: -0.25 + i * 0.1, y: 0.04 + row * 0.2, z: 0.04, color: cols[(i + row) % 5] });
      }
    }
  },

  // ----- walls (map-border 'H' tiles) -----------------------------------------------
  hedge(c) {
    c.foliage.box(1.0, 0.42, 0.7, { color: '#5fae4f', jitter: 0.06, rand: c.rand, attrs: { sway: () => 0.05 } });
    for (let i = 0; i < 4; i++) c.foliage.blob(0.16, { x: -0.36 + i * 0.24, y: 0.42, color: i % 2 ? '#6cbc58' : '#58a84a', attrs: { sway: () => 0.1 } });
    if (c.variant % 3 === 0) c.foliage.blob(0.05, { x: 0.1, y: 0.5, z: 0.3, color: '#ffc2d8', attrs: { sway: () => 0.1 } });
  },
  reedFence(c) {
    for (let i = 0; i < 9; i++) c.solid.cyl(0.035, 0.04, 0.5 + (i % 3) * 0.06, 5, { x: -0.44 + i * 0.11, color: i % 2 ? '#b09060' : '#9a7c50' });
    c.solid.box(1.0, 0.04, 0.08, { y: 0.32, color: '#6d5236' });
    BUILDERS.reeds({ ...c, foliage: c.foliage });
  },
  shrineWall(c) {
    c.solid.box(1.0, 0.5, 0.36, { color: '#f2ece0' });
    c.solid.box(1.0, 0.08, 0.36, { color: '#9aa1ad' });
    roofPrism(c.solid, 1.02, 0.5, 0.14, { y: 0.5, color: '#3d4a63' });
  },
  stoneWall(c) {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        c.solid.box(0.32, 0.22, 0.42, { x: -0.33 + i * 0.33 + (j ? 0.08 : 0), y: j * 0.22, color: c.look.rock, jitter: 0.08, rand: c.rand });
      }
    }
    if (c.look.theme === 'snow' || c.look.theme === 'mountain') c.solid.box(1.0, 0.06, 0.44, { y: 0.44, color: '#f4f8fc' });
  },
  brickWall(c) {
    c.solid.box(1.0, 0.62, 0.5, { color: '#a5654f', jitter: 0.04, rand: c.rand });
    c.solid.box(1.02, 0.06, 0.52, { y: 0.62, color: '#5a606b' });
    c.solid.cyl(0.05, 0.05, 1.0, 6, { y: 0.45, z: 0.28, rz: Math.PI / 2, color: '#8a909b' });
    if (c.variant % 3 === 0) {
      c.glow.box(0.22, 0.16, 0.02, { y: 0.24, z: 0.26, color: '#ff9a3d' });
      glowPoint(c, 0, 0.3, 0.3, '#ff8a3d', 0.5, 0.2);
    }
  },
  festivalWall(c) {
    c.solid.box(1.0, 0.36, 0.12, { color: '#b9875a', jitter: 0.04, rand: c.rand });
    for (let i = 0; i < 3; i++) c.solid.box(0.08, 0.6, 0.08, { x: -0.45 + i * 0.45, color: '#7e2a26' });
    c.solid.cyl(0.008, 0.008, 1.0, 3, { y: 0.58, rz: Math.PI / 2, color: '#3a2a2a' });
    for (const x of [-0.25, 0.22]) {
      c.glow.sphere(0.06, 8, 6, { x, y: 0.5, z: 0.02, sy: 1.25, color: x < 0 ? '#ff6a55' : '#ffb347' });
      glowPoint(c, x, 0.5, 0.05, '#ff8a5c', 0.45, 0.15);
    }
  },
  basaltWall(c) {
    for (let i = 0; i < 4; i++) {
      const h = 0.4 + c.rand() * 0.35;
      c.solid.cyl(0.13, 0.15, h, 6, { x: -0.36 + i * 0.24, color: '#3d3438', jitter: 0.08, rand: c.rand });
    }
  },

  // ----- set pieces ------------------------------------------------------------------
  bench(c) {
    c.solid.box(0.6, 0.04, 0.2, { y: 0.2, color: '#b98a5a' });
    c.solid.box(0.6, 0.14, 0.03, { y: 0.26, z: -0.09, color: '#a87a4a' });
    for (const x of [-0.25, 0.25]) c.solid.box(0.04, 0.2, 0.18, { x, color: '#5a606b' });
  },
  signpost(c) {
    c.solid.cyl(0.03, 0.03, 0.7, 5, { color: '#7a5236' });
    c.solid.box(0.42, 0.13, 0.03, { y: 0.52, x: 0.12, color: '#e9d2a8' });
    c.solid.box(0.36, 0.11, 0.03, { y: 0.36, x: -0.1, ry: 0.2, color: '#d9be8e' });
  },
  well(c) {
    c.solid.cyl(0.3, 0.32, 0.3, 10, { color: '#a7a39b', jitter: 0.04, rand: c.rand });
    c.solid.cyl(0.24, 0.24, 0.02, 10, { y: 0.27, color: '#3d7fb0' });
    for (const x of [-0.26, 0.26]) c.solid.box(0.05, 0.6, 0.05, { x, y: 0.2, color: '#7a5236' });
    roofPrism(c.solid, 0.72, 0.5, 0.2, { y: 0.78, color: '#c4473e' });
  },
  fountain(c) {
    c.solid.cyl(0.46, 0.48, 0.18, 14, { color: '#d9d4cb' });
    c.glow.cyl(0.4, 0.4, 0.02, 14, { y: 0.16, color: '#8fe0ff' });
    c.solid.cyl(0.08, 0.1, 0.42, 8, { color: '#cfc9bf' });
    c.solid.cyl(0.22, 0.12, 0.08, 10, { y: 0.42, color: '#d9d4cb' });
    c.glow.cyl(0.18, 0.18, 0.02, 10, { y: 0.49, color: '#bff0ff' });
    c.emitters.push({ kind: 'fountain', x: 0, y: 0.55, z: 0 });
  },
  waterwheel(c) {
    c.solid.box(0.5, 0.5, 0.5, { x: -0.25, color: '#b98f62' });
    roofPrism(c.solid, 0.6, 0.62, 0.22, { x: -0.25, y: 0.5, color: '#6d4a3a' });
    const wheel = new GeoBuilder();
    wheel.torus(0.36, 0.03, 4, 16, { color: '#7a5236' });
    for (let i = 0; i < 8; i++) wheel.box(0.06, 0.34, 0.12, { ry: 0, rz: (i / 8) * Math.PI * 2, color: '#8a6040' });
    const m = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(0.12, 0.36, 0);
    c.solid.append(wheel, m);
    c.solid.cyl(0.04, 0.04, 0.3, 6, { x: 0.02, y: 0.36, rz: Math.PI / 2, color: '#5a3a2a' });
  },
  boat(c) {
    const hull = [[-0.42, 0.08], [-0.3, -0.06], [0.3, -0.06], [0.46, 0.1], [0.3, 0.06], [-0.3, 0.06]];
    c.solid.extrude(hull, 0.3, { color: '#a8714a', y: 0.02, jitter: 0.04, rand: c.rand });
    c.solid.box(0.5, 0.02, 0.22, { y: 0.07, color: '#c48f62' });
    c.solid.cyl(0.015, 0.015, 0.5, 4, { y: 0.06, color: '#5a3a2a' });
    c.solid.cone(0.12, 0.3, 3, { x: 0.1, y: 0.22, rz: -Math.PI / 2, sx: 0.1, color: '#f4efe4' });
    if (c.look.night || c.look.theme === 'festival') {
      c.glow.sphere(0.04, 8, 6, { y: 0.5, color: '#ffb36b' });
      glowPoint(c, 0, 0.5, 0, '#ffb36b', 0.5, 0.15);
    }
  },
  pier(c) {
    for (const [x, z] of [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]]) c.solid.cyl(0.04, 0.04, 0.32, 6, { x, y: -0.2, z, color: '#5a4030' });
    for (let i = 0; i < 6; i++) c.solid.box(0.16, 0.04, 0.8, { x: -0.4 + i * 0.16, y: 0.08, color: i % 2 ? '#b48a5e' : '#a77d52', jitter: 0.04, rand: c.rand });
  },
  banner(c) {
    const cols = ['#d6403a', '#3d7fd6', '#7b4fd6', '#2f9a6a'];
    c.solid.cyl(0.025, 0.03, 1.0, 5, { color: '#5a3a2a' });
    c.solid.box(0.32, 0.03, 0.03, { y: 0.92, color: '#5a3a2a' });
    c.foliage.box(0.28, 0.5, 0.02, { y: 0.42, x: 0.0, z: 0.03, color: cols[c.variant % cols.length], attrs: { sway: (x, y) => (0.95 - y) * 0.6 } });
    c.solid.box(0.1, 0.1, 0.01, { y: 0.66, z: 0.05, color: '#f2e6d0' });
  },
  flag(c) {
    const cols = ['#ff6b8b', '#4cc9f0', '#ffd43b', '#7bd389'];
    c.solid.cyl(0.02, 0.025, 1.0, 5, { color: '#8a909b' });
    c.foliage.box(0.32, 0.2, 0.015, { x: 0.17, y: 0.76, color: cols[c.variant % cols.length], attrs: { sway: (x) => Math.max(0, x) * 1.6 } });
  },
  pennants(c) {
    const cols = ['#ff6b8b', '#4cc9f0', '#ffd43b', '#7bd389', '#b197fc'];
    c.solid.cyl(0.015, 0.02, 0.8, 4, { x: -0.45, color: '#7a5236' });
    c.solid.cyl(0.015, 0.02, 0.8, 4, { x: 0.45, color: '#7a5236' });
    for (let i = 0; i < 6; i++) {
      const x = -0.38 + i * 0.152;
      const y = 0.74 - Math.sin((i + 0.5) / 6 * Math.PI) * 0.1;
      c.foliage.cone(0.06, 0.14, 3, { x, y: y - 0.14, rx: Math.PI, ry: Math.PI / 6, sz: 0.2, color: cols[i % 5], attrs: { sway: () => 0.35 } });
    }
  },
  taiko(c) {
    c.solid.cyl(0.24, 0.24, 0.34, 14, { y: 0.32, rx: Math.PI / 2, color: '#a8584a' });
    c.solid.cyl(0.25, 0.25, 0.02, 14, { y: 0.32, z: 0.17, rx: Math.PI / 2, color: '#f4efe4' });
    for (const x of [-0.2, 0.2]) c.solid.box(0.05, 0.36, 0.3, { x, color: '#3a2a2a' });
    c.solid.cyl(0.012, 0.012, 0.3, 4, { x: 0.12, y: 0.6, z: 0.2, rz: 0.5, color: '#e8d4a6' });
  },
  crane(c) {
    c.solid.box(0.3, 0.12, 0.3, { color: '#5a606b' });
    for (const [x, z] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]]) c.solid.box(0.03, 1.2, 0.03, { x, z, color: '#ffcc33' });
    c.solid.box(0.9, 0.06, 0.06, { x: 0.25, y: 1.2, color: '#ffcc33' });
    c.solid.box(0.2, 0.18, 0.14, { x: -0.12, y: 1.1, color: '#5a606b' });
    c.solid.cyl(0.006, 0.006, 0.6, 3, { x: 0.6, y: 0.6, color: '#2a2a2a' });
    c.solid.box(0.18, 0.12, 0.18, { x: 0.6, y: 0.5, color: '#9b7a52' });
  },
  chimney(c) {
    c.solid.cyl(0.18, 0.24, 1.4, 8, { color: '#a5654f', jitter: 0.04, rand: c.rand });
    c.solid.cyl(0.22, 0.22, 0.08, 8, { y: 1.4, color: '#5a606b' });
    c.solid.cyl(0.22, 0.22, 0.05, 8, { y: 0.9, color: '#ffcc33' });
    c.emitters.push({ kind: 'smoke', x: 0, y: 1.5, z: 0 });
  },
  gearTower(c) {
    c.solid.box(0.4, 0.9, 0.4, { color: '#8a909b' });
    c.solid.box(0.46, 0.06, 0.46, { y: 0.9, color: '#5a606b' });
    const gear = new GeoBuilder();
    gear.cyl(0.26, 0.26, 0.06, 12, { rx: Math.PI / 2, color: '#c9a24a' });
    for (let i = 0; i < 8; i++) gear.box(0.08, 0.08, 0.06, { x: Math.cos((i / 8) * Math.PI * 2) * 0.3, y: Math.sin((i / 8) * Math.PI * 2) * 0.3 - 0.04, rz: (i / 8) * Math.PI * 2, color: '#c9a24a' });
    c.solid.append(gear, new THREE.Matrix4().setPosition(0, 0.6, 0.24));
    c.glow.box(0.12, 0.12, 0.02, { y: 1.0, z: 0.2, color: '#7ff0ff' });
    glowPoint(c, 0, 1.0, 0.24, '#7ff0ff', 0.5, 0.2);
  },
  pylon(c) {
    c.solid.cyl(0.1, 0.16, 0.12, 6, { color: '#5a606b' });
    c.solid.cyl(0.04, 0.06, 0.7, 6, { y: 0.12, color: '#8a909b' });
    c.glow.sphere(0.09, 10, 8, { y: 0.88, color: '#9ec5ff' });
    c.glow.torus(0.14, 0.015, 4, 14, { y: 0.88, rx: Math.PI / 2, color: '#c8e0ff' });
    glowPoint(c, 0, 0.88, 0, '#8ab8ff', 0.8, 0.25);
  },
  nest(c) {
    c.solid.torus(0.26, 0.1, 5, 12, { y: 0.08, rx: Math.PI / 2, color: '#8a6a44', jitter: 0.12, rand: c.rand });
    for (let i = 0; i < 3; i++) c.solid.sphere(0.07, 8, 6, { x: (i - 1) * 0.1, y: 0.1, z: (i % 2) * 0.06, sy: 1.25, color: c.look.theme === 'volcano' ? '#ffb38a' : '#f4ead8' });
    if (c.look.theme === 'volcano') {
      c.glow.sphere(0.03, 6, 4, { y: 0.14, color: '#ff7a33' });
      glowPoint(c, 0, 0.12, 0, '#ff7a33', 0.5, 0.3);
    }
  },
  bones(c) {
    const col = '#efe6d2';
    c.solid.cyl(0.03, 0.03, 0.7, 5, { y: 0.06, rz: Math.PI / 2, color: col });
    for (let i = 0; i < 4; i++) c.solid.torus(0.18 - i * 0.02, 0.022, 4, 10, { x: -0.24 + i * 0.15, y: 0.06, ry: Math.PI / 2, arc: Math.PI, color: col });
    c.solid.blob(0.13, { x: 0.42, y: 0.1, sx: 1.4, color: col });
    c.solid.cone(0.03, 0.18, 4, { x: 0.46, y: 0.16, z: 0.08, rx: 0.8, color: col });
  },
  vent(c) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      c.solid.rock(0.11, { x: Math.cos(a) * 0.2, y: 0.05, z: Math.sin(a) * 0.2, color: c.look.rock, jitter: 0.1, rand: c.rand });
    }
    const hot = c.look.theme === 'volcano' || c.look.theme === 'foundry';
    c.glow.cyl(0.14, 0.14, 0.02, 8, { y: 0.03, color: hot ? '#ff7a33' : '#cfefff' });
    if (hot) glowPoint(c, 0, 0.1, 0, '#ff6a2a', 0.8, 0.35);
    c.emitters.push({ kind: hot ? 'embers' : 'steam', x: 0, y: 0.1, z: 0 });
    c.emitters.push({ kind: 'steam', x: 0, y: 0.1, z: 0 });
  },
  campfire(c) {
    for (let i = 0; i < 4; i++) c.solid.cyl(0.03, 0.035, 0.36, 5, { y: 0.04, ry: (i / 4) * Math.PI, rz: Math.PI / 2, color: '#6d4433' });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      c.solid.rock(0.06, { x: Math.cos(a) * 0.24, y: 0.03, z: Math.sin(a) * 0.24, color: '#8d8981' });
    }
    c.glow.cone(0.1, 0.26, 6, { y: 0.06, color: '#ff7a33', color2: '#ffe08a' });
    glowPoint(c, 0, 0.18, 0, '#ff8a3d', 1.0, 0.35);
    c.emitters.push({ kind: 'embers', x: 0, y: 0.2, z: 0 });
  },
  crate(c) {
    c.solid.box(0.3, 0.3, 0.3, { ry: c.rand(), color: '#b98a5a', jitter: 0.05, rand: c.rand });
    c.solid.box(0.24, 0.24, 0.24, { x: 0.22, ry: c.rand(), color: '#a87a4a' });
    c.solid.box(0.2, 0.2, 0.2, { x: 0.05, y: 0.3, ry: c.rand(), color: '#c49a6a' });
  },
  barrel(c) {
    for (let i = 0; i < 3; i++) {
      c.solid.cyl(0.12, 0.12, 0.3, 8, { x: (i - 1) * 0.22, z: (i % 2) * 0.12, color: '#8a5a36' });
      c.solid.cyl(0.125, 0.125, 0.03, 8, { x: (i - 1) * 0.22, y: 0.22, z: (i % 2) * 0.12, color: '#3a3f4b' });
    }
  },
  sack(c) {
    for (let i = 0; i < 3; i++) c.solid.blob(0.14, { x: (i - 1) * 0.2, y: 0.12, z: (i % 2) * 0.1, sy: 0.9, color: '#c9ae7b', detail: 1, jitter: 0.05, rand: c.rand });
    c.solid.cyl(0.02, 0.04, 0.06, 5, { y: 0.24, color: '#8a6a44' });
  },
  chest(c) {
    c.solid.box(0.4, 0.22, 0.28, { color: '#a8584a' });
    c.solid.cyl(0.14, 0.14, 0.4, 8, { y: 0.22, rz: Math.PI / 2, sy: 0.6, color: '#b8684a' });
    c.solid.box(0.42, 0.04, 0.3, { y: 0.1, color: '#e8c35a' });
    c.glow.box(0.08, 0.08, 0.02, { y: 0.2, z: 0.15, color: '#ffe066' });
    glowPoint(c, 0, 0.25, 0.15, '#ffd84d', 0.5, 0.1);
  },
  totem(c) {
    const cols = ['#3d9a6a', '#e8604a', '#f2c14e', '#4f9ad6'];
    c.solid.cyl(0.11, 0.13, 0.25, 6, { color: '#7a5236', jitter: 0.05, rand: c.rand });
    for (let i = 0; i < 3; i++) {
      const y = 0.25 + i * 0.2;
      c.solid.cyl(0.12, 0.12, 0.2, 6, { y, color: cols[(i + c.variant) % cols.length] });
      c.solid.box(0.06, 0.04, 0.02, { x: -0.05, y: y + 0.12, z: 0.11, color: '#1d2b4f' });
      c.solid.box(0.06, 0.04, 0.02, { x: 0.05, y: y + 0.12, z: 0.11, color: '#1d2b4f' });
      c.solid.box(0.1, 0.03, 0.02, { y: y + 0.05, z: 0.115, color: '#f4efe4' });
    }
    c.solid.box(0.5, 0.06, 0.06, { y: 0.72, color: '#7a5236' });
    for (const x of [-0.24, 0.24]) c.foliage.cone(0.05, 0.22, 4, { x, y: 0.62, rx: Math.PI, color: '#f4efe4', attrs: { sway: () => 0.4 } });
    c.solid.cone(0.13, 0.16, 6, { y: 0.85, color: '#3d9a6a' });
  },
  palisade(c) {
    for (let i = 0; i < 6; i++) c.solid.cyl(0.07, 0.08, 0.7 + (i % 2) * 0.08, 6, { x: -0.42 + i * 0.17, color: '#8a6040', jitter: 0.05, rand: c.rand });
    for (let i = 0; i < 6; i++) c.solid.cone(0.07, 0.12, 6, { x: -0.42 + i * 0.17, y: 0.7 + (i % 2) * 0.08, color: '#8a6040' });
    c.solid.box(1.0, 0.06, 0.04, { y: 0.4, z: 0.08, color: '#5a3a2a' });
  },
  kite(c) {
    c.solid.cyl(0.005, 0.005, 1.2, 3, { color: '#f4efe4', rz: 0.3 });
  },
  mirror(c) {
    c.solid.box(0.06, 0.6, 0.06, { color: '#7e2a26' });
    c.solid.cyl(0.2, 0.2, 0.04, 14, { y: 0.66, rx: Math.PI / 2, color: '#c9a24a' });
    c.glow.cyl(0.17, 0.17, 0.02, 14, { y: 0.66, z: 0.02, rx: Math.PI / 2, color: '#e8f4ff' });
    glowPoint(c, 0, 0.66, 0.05, '#d8ecff', 0.55, 0.2);
  },
  hotSpring(c) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      c.solid.rock(0.1, { x: Math.cos(a) * 0.32, y: 0.04, z: Math.sin(a) * 0.32, color: c.look.rock, jitter: 0.08, rand: c.rand });
    }
    c.glow.cyl(0.3, 0.3, 0.02, 12, { y: 0.02, color: '#8fe8e8' });
    c.emitters.push({ kind: 'steam', x: 0, y: 0.05, z: 0 });
  },
  fireworkPost(c) {
    c.solid.box(0.2, 0.2, 0.2, { color: '#a8584a' });
    c.solid.cyl(0.04, 0.04, 0.3, 6, { y: 0.2, rx: -0.2, color: '#3a3f4b' });
    c.emitters.push({ kind: 'firework', x: 0, y: 0.5, z: 0 });
  },
};

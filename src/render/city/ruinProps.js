// Ruins kit (Gate Arc S3a, the `ruined: 'burning'` look of 3-9 and 3-10; GATE_ARC §18.1, §18.3,
// §18.6): the burnt shells, the rubble and the wrecks as ordinary prop builders (props.js BUILDERS),
// the HAMMER tear over the sanctum, and the burning layer (burningLayer: the fire glows on the
// ruins away from the road, the smoke columns in the skirt, scorch marks, the stray cat's spot).
//
// Grim, but readable (§18.6): the road stays the clearest band (nothing here stands on it and no
// fire burns within FIRE_CLEAR tiles of a road's centreline), smoke rises only from the skirt and
// fades within 2 tiles of height, fire is amber so it never reads as an oni's red, and loss is told
// by places (a shell with an empty window, a bus shelter's frame), never by anyone: no bodies, no
// wounds. Nothing here is transparent. Every builder keeps to RUIN_VARIANTS[type] variants (≤ 6)
// and a triangle cap (tests/render/burning.test.js); the shells on the board stay ≤ BOARD_MAX_H.
//
// Local frame: origin = tile centre on the ground, +y up, +z = the front (the road side).
import * as THREE from 'three';
import { hash } from '../geo.js';
import { wire } from './cityProps.js';

/** Variants per builder (`c.variant % n`). */
export const RUIN_VARIANTS = { ruinBlock: 6, rubble: 3, burntCar: 2, fallenPole: 1, debris: 3, hammerTear: 1 };
/** ruinBlock variants low enough for the board (≤ BOARD_MAX_H); variant 5, the broken tower, is skirt only. */
export const RUIN_ON_BOARD = [0, 1, 2, 3, 4];
/** Per ruinBlock variant: [window openings, openings with fire in them] (fire in at most one window in four). */
export const RUIN_WINDOWS = [[4, 1], [4, 0], [4, 1], [8, 2], [4, 0], [8, 2]];
/** No fire glow burns closer than this to any road's centreline (tiles; GATE_ARC §18.6.2). */
export const FIRE_CLEAR = 1.5;
/** At most this many fire glows and smoke columns per board (GATE_ARC §18.7). */
export const MAX_FIRES = 12;
export const MAX_SMOKE = 6;
/** Smoke columns fade out below this height (tiles). */
export const SMOKE_TOP = 2;
/** One smoke-column puff (ambient.js 'smokeColumn'): start height, rise speed, drag, life (s). It tops out at y + vy·(1 − e^(−drag·life)) / drag < SMOKE_TOP. */
export const SMOKE_PUFF = Object.freeze({ y: 0.2, vy: 0.62, drag: 0.25, life: 3.0 });
/** The fire's amber (never an oni's red) and the tear's black-violet. */
export const FIRE = { glow: '#ffb347', hot: '#ffd27a', ember: '#ffc46b' };
export const TEAR = { core: '#0b0610', edge: '#8f4dff', rim: '#d9b8ff', spark: '#c9a2ff' };

const RU = {
  char: '#2b2624', charLight: '#3d3734', soot: '#4a4542', plaster: '#8d857a', plasterDark: '#6e675e',
  brick: '#6a4a3e', beam: '#33281f', stone: '#77716a', stoneDark: '#5d5852', rust: '#6a3f2c', metal: '#4b4d52',
};

const v = (c, type) => c.variant % RUIN_VARIANTS[type];

function glowPoint(c, x, y, z, color, size, flicker, extra = null) {
  c.glows.push({ x, y, z, color, size, flicker, ...(extra || {}) });
}

/** A burnt wall run along local x at depth z: segments of jagged height with window openings. */
function jaggedWall(c, x0, x1, z, heights, { openings = [], fires = [], thick = 0.06, color = RU.plaster } = {}) {
  const F = c.facade;
  const n = heights.length;
  const seg = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const h = heights[i];
    if (h <= 0) continue;
    F.box(x0 + seg * (i + 0.5), 0, z, seg + 0.002, h, thick, { color: i % 2 ? color : RU.plasterDark, top: RU.char });
  }
  // window openings: dark holes on the face; some of them with fire behind (glow geometry)
  openings.forEach(([x, y], k) => {
    F.box(x, y, z + thick / 2 + 0.002, 0.13, 0.12, 0.006, { color: RU.char, noTop: true });
    if (fires.includes(k)) c.glow.box(0.1, 0.09, 0.01, { x, y: y + 0.015, z: z + thick / 2 + 0.006, color: FIRE.glow });
  });
}

/** A charred beam leaning across the shell. */
function beam(c, x, y, z, len, rz, ry = 0) {
  c.facade.box(x, y, z, len, 0.04, 0.04, { color: RU.beam, rz, ry });
}

/** A low heap of broken blocks (dodecahedra and a few bricks), radius r. */
function heap(c, r, n, { x = 0, z = 0, cols = [RU.stone, RU.stoneDark, RU.plasterDark] } = {}) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + c.rand() * 0.6;
    const d = r * (0.2 + c.rand() * 0.7);
    const s = 0.05 + c.rand() * 0.06;
    c.solid.rock(s, { x: x + Math.cos(a) * d, y: s * 0.5, z: z + Math.sin(a) * d, sy: 0.7, color: cols[i % cols.length], jitter: 0.06, rand: c.rand });
  }
}

/** The jagged seam of the tear (a vertical ribbon facing +z) as a geometry, width scaled by `k`. */
function tearRibbon(k, z, y0 = 1.0, y1 = 2.5) {
  const pts = [[0, y0], [0.12, 1.25], [-0.05, 1.5], [0.16, 1.72], [-0.02, 1.95], [0.1, 2.18], [-0.04, y1]];
  const widths = [0.02, 0.1, 0.18, 0.24, 0.17, 0.1, 0.02];
  const pos = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const wa = widths[i - 1] * k;
    const wb = widths[i] * k;
    // jagged edge: the two sides step out unevenly
    const a0 = [ax - wa * 1.1, ay, z];
    const a1 = [ax + wa * 0.9, ay, z];
    const b0 = [bx - wb * 0.85, by, z];
    const b1 = [bx + wb * 1.15, by, z];
    pos.push(...a0, ...a1, ...b1, ...a0, ...b1, ...b0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

export const RUIN_BUILDERS = {
  ruinBlock(c) {
    const k = v(c, 'ruinBlock');
    const F = c.facade;
    const far = c.lod === 'far';
    const [nWin, nFire] = RUIN_WINDOWS[k];
    const fires = [];
    for (let i = 0; i < nFire; i++) fires.push((i * 4 + (k % 3)) % nWin);
    // the plinth: ash-grey slab with scorched rubble inside the shell
    F.box(0, 0, 0, 0.92, 0.03, 0.84, { color: RU.soot });
    if (k === 5) {
      // the broken tower (skirt only): a tall shell, its top floors gone at an angle
      const h = [1.9, 1.6, 1.25, 1.0];
      jaggedWall(c, -0.7, 0.7, 0.62, h, { openings: [[-0.45, 0.4], [-0.15, 0.75], [0.15, 0.4], [0.45, 0.75], [-0.45, 1.1], [-0.15, 1.45], [0.15, 0.95], [0.45, 0.4]], fires, thick: 0.08, color: '#7d766c' });
      jaggedWall(c, -0.7, 0.7, -0.62, [1.0, 1.4, 1.8, 1.5], { thick: 0.08, color: '#7d766c' });
      F.box(-0.66, 0, 0, 0.08, 1.7, 1.2, { color: RU.plasterDark, top: RU.char });
      F.box(0.66, 0, 0, 0.08, 0.95, 1.2, { color: RU.plasterDark, top: RU.char });
      if (!far) beam(c, 0, 1.2, 0, 1.2, 0.5);
      return;
    }
    if (k === 2) {
      // a timber house burnt to its frame (Old Town): posts and a fallen ridge beam, plaster stubs
      for (const [x, z, h] of [[-0.4, 0.36, 0.62], [0.4, 0.36, 0.38], [-0.4, -0.36, 0.5], [0.4, -0.36, 0.7], [0, 0.36, 0.28]]) F.box(x, 0, z, 0.06, h, 0.06, { color: RU.beam, top: RU.char });
      jaggedWall(c, -0.42, 0.42, 0.38, [0.22, 0.12, 0.3, 0.16], { openings: [[-0.2, 0.08], [0.2, 0.1], [-0.05, 0.14], [0.3, 0.06]], fires, thick: 0.05, color: '#6f6559' });
      if (!far) {
        beam(c, 0, 0.38, 0, 1.0, 0.55, 0.3);
        beam(c, 0.1, 0.1, -0.15, 0.7, -0.1, -0.6);
        heap(c, 0.3, 7, { z: -0.05 });
      }
      return;
    }
    // the masonry shells: front wall with window openings, side walls, a missing corner on 1 / 3
    const tall = k === 3;
    const front = tall ? [0.84, 0.7, 0.55, 0.78] : k === 4 ? [0.3, 0.44, 0.24, 0.36] : [0.62, 0.5, 0.66, 0.42];
    const openings = tall
      ? [[-0.3, 0.12], [-0.1, 0.12], [0.1, 0.12], [0.3, 0.12], [-0.3, 0.46], [-0.1, 0.42], [0.1, 0.34], [0.3, 0.52]]
      : [[-0.3, 0.14], [-0.1, 0.16], [0.1, 0.14], [0.3, 0.12]];
    jaggedWall(c, -0.44, 0.44, 0.38, front, { openings: openings.slice(0, nWin), fires, color: k === 4 ? RU.brick : RU.plaster });
    const side = tall ? [0.8, 0.62, 0.45] : [0.56, 0.4, 0.3];
    const missing = k === 1 || k === 3;
    F.box(-0.41, 0, -0.04, 0.06, side[0], 0.76, { color: RU.plasterDark, top: RU.char });
    if (missing) F.box(0.41, 0, -0.22, 0.06, side[2], 0.4, { color: RU.plasterDark, top: RU.char });
    else F.box(0.41, 0, -0.04, 0.06, side[1], 0.76, { color: RU.plasterDark, top: RU.char });
    jaggedWall(c, -0.44, missing ? 0.1 : 0.44, -0.38, tall ? [0.7, 0.82, 0.5] : [0.5, 0.36, 0.44], { color: RU.plasterDark });
    if (far) return;
    // inside: charred beams fallen across, a heap of broken blocks; a bus shelter's empty frame on 4
    beam(c, -0.05, 0.22, 0.05, 0.86, 0.32, 0.4);
    if (tall) beam(c, 0.1, 0.5, -0.1, 0.8, -0.25, -0.3);
    heap(c, 0.32, 8);
    if (k === 4) {
      // the shop's awning frame, bent (the awning itself burnt away)
      F.box(0, 0.28, 0.5, 0.8, 0.025, 0.025, { color: RU.metal, rz: 0.12 });
      for (const x of [-0.36, 0.36]) F.box(x, 0, 0.5, 0.025, 0.28 + (x > 0 ? 0.05 : 0), 0.025, { color: RU.metal });
    }
  },
  rubble(c) {
    const k = v(c, 'rubble');
    heap(c, 0.42, 12 + k * 3, { cols: k === 1 ? [RU.brick, '#7a5444', RU.stoneDark] : [RU.stone, RU.stoneDark, RU.plasterDark, RU.soot] });
    c.solid.rock(0.16, { y: 0.06, sy: 0.6, color: RU.stoneDark, jitter: 0.05, rand: c.rand });
    beam(c, 0.05, 0.08, 0.1, 0.62, 0.25, 0.7 + k);
    if (k === 2) {
      // a slab of wall lying in the heap
      c.facade.box(-0.1, 0.02, -0.05, 0.44, 0.05, 0.3, { color: RU.plaster, ry: 0.5, rz: 0.15 });
    }
  },
  burntCar(c) {
    const k = v(c, 'burntCar');
    const body = k ? '#3a3533' : RU.char;
    const L = k ? 0.66 : 0.58;
    c.solid.box(0.32, 0.12, L, { y: 0.05, color: body, jitter: 0.05, rand: c.rand });
    c.solid.box(0.28, 0.1, L * 0.55, { y: 0.17, z: -0.03, color: RU.rust });
    c.solid.box(0.22, 0.07, L * 0.4, { y: 0.17, z: -0.03, color: '#151313' });
    for (const [x, z] of [[-0.15, L * 0.33], [0.15, L * 0.33], [-0.15, -L * 0.33], [0.15, -L * 0.33]]) {
      c.solid.cyl(0.05, 0.05, 0.035, 6, { x, y: 0.05, z, rz: Math.PI / 2, sy: 0.9, color: '#1c1a1a' });
    }
    // ash on the bonnet
    c.solid.box(0.26, 0.01, L * 0.22, { y: 0.17, z: L * 0.32, color: '#7a746d' });
  },
  fallenPole(c) {
    // a utility pole snapped and leaning across a lot, its wire trailing to the ground
    c.solid.cyl(0.035, 0.04, 0.3, 5, { color: '#5a554e' });
    c.solid.cyl(0.03, 0.035, 1.2, 5, { x: 0.02, y: 0.28, rz: -1.05, color: '#5a554e' });
    c.solid.box(0.3, 0.025, 0.04, { x: 0.86, y: 0.9, rz: -1.05, color: RU.metal });
    wire(c.facade, [0.95, 0.85, 0], [0.6, 0.0, 0.4], '#2b2b30');
  },
  debris(c) {
    const k = v(c, 'debris');
    for (let i = 0; i < 4 + k; i++) {
      const a = (i / (4 + k)) * Math.PI * 2 + c.rand();
      const d = 0.12 + c.rand() * 0.25;
      c.solid.box(0.06 + c.rand() * 0.08, 0.03, 0.05 + c.rand() * 0.06, { x: Math.cos(a) * d, z: Math.sin(a) * d, ry: c.rand() * 3, color: [RU.stone, RU.soot, RU.brick][(i + k) % 3] });
    }
    if (k === 1) c.solid.box(0.3, 0.012, 0.2, { x: 0.05, y: 0.035, ry: 0.4, rz: 0.1, color: RU.metal });
    if (k === 2) beam(c, 0, 0.02, 0, 0.5, 0.06, 1.1);
  },
  hammerTear(c) {
    // HAMMER's tear (GATE_ARC §18.4): a jagged black-violet seam hanging in the air over the
    // sanctum, no ring; violet glow layers round a black core, sparks crackling off it. Every vertex
    // belongs to the tear, so the terrain marks it for the rule pulse (terrain.setTear).
    const layers = [[2.2, 0.0, TEAR.edge], [1.45, 0.012, TEAR.rim], [1.0, 0.024, TEAR.core]];
    for (const [k, z, col] of layers) c.glow.add(tearRibbon(k, z), { color: col });
    glowPoint(c, 0.05, 1.75, 0.05, TEAR.edge, 1.6, 0.25, { tear: true });
    glowPoint(c, 0.0, 1.25, 0.05, TEAR.rim, 0.8, 0.3, { tear: true });
    glowPoint(c, 0.02, 2.2, 0.05, TEAR.rim, 0.7, 0.3, { tear: true });
    c.emitters.push({ kind: 'tearSparks', x: 0.04, y: 1.75, z: 0.06, r: 0.7, color: TEAR.spark });
    c.emitters.push({ kind: 'debris', x: 0.04, y: 1.75, z: 0.06, r: 0.45 });
  },
};

/**
 * The burning layer of a `ruined: 'burning'` board: fire glows on the ruins (H / X tiles at least
 * FIRE_CLEAR from every road centreline, ≤ MAX_FIRES, spread apart), embers over half of them,
 * smoke columns from the skirt (≤ MAX_SMOKE, clear of the run-outs), scorch marks beside the lanes
 * (off the road) and one spot in the rubble for the stray cat. Deterministic per map id.
 * @param {object} o
 * @param {object} o.map MapDef
 * @param {object} o.plan planRoads() result (the centrelines, run-outs included)
 * @param {(x: number, y: number) => boolean} o.isPath
 * @param {(x: number, y: number) => boolean} o.isWater
 * @param {Set<string>} [o.occupied] tiles with a prop
 * @param {string} [o.quality]
 * @returns {{ fires: object[], glows: object[], emitters: object[], marks: object[], cat: { x: number, z: number }|null }}
 */
export function burningLayer({ map, plan, isPath, isWater, occupied = new Set(), quality = 'high' }) {
  const W = map.width;
  const H = map.height;
  const pts = [];
  for (const r of plan.roads) r.pts.forEach((p, i) => { if (!r.tunnel?.[i]) pts.push(p); });
  const roadDist = (x, z) => {
    let best = Infinity;
    for (const [px, pz] of pts) {
      const d = Math.hypot(px - x, pz - z);
      if (d < best) best = d;
    }
    return best;
  };
  const pick = (cands, n, spacing) => {
    cands.sort((a, b) => a.h - b.h);
    const out = [];
    for (const c of cands) {
      if (out.length >= n) break;
      if (out.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < spacing)) continue;
      out.push(c);
    }
    return out;
  };
  // fire on the ruins: H (a burnt shell) and X (a collapsed house) tiles away from the road
  const fireCands = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = map.rows[y][x];
      if ((ch !== 'H' && ch !== 'X') || isPath(x, y)) continue;
      const cx = x + 0.5;
      const cz = y + 0.5;
      if (roadDist(cx, cz) < FIRE_CLEAR) continue;
      fireCands.push({ x: cx, z: cz, h: hash(map.id, 'fire', x, y) });
    }
  }
  const nFires = quality === 'low' ? 8 : MAX_FIRES;
  const fires = pick(fireCands, nFires, 2.2);
  const glows = [];
  const emitters = [];
  fires.forEach((f, i) => {
    glows.push({ x: f.x, y: 0.42, z: f.z, color: new THREE.Color(i % 3 ? FIRE.glow : FIRE.hot), size: 1.05, flicker: 0.38, phase: (f.h % 628) / 100, fire: true });
    if (i % 2 === 0) emitters.push({ kind: 'embers', x: f.x, y: 0.35, z: f.z, color: FIRE.ember });
  });
  // smoke columns from the skirt: behind the far edge and in the back corners, clear of every road
  const smokeCands = [];
  for (let z = -3.5; z <= -1.5; z += 1) {
    for (let x = -2.5; x <= W + 2.5; x += 1) {
      if (roadDist(x, z) < 1.8 || isWater(Math.floor(x), Math.floor(z))) continue;
      smokeCands.push({ x, z, h: hash(map.id, 'smoke', Math.round(x * 2), Math.round(z * 2)) });
    }
  }
  for (const x of [-2.5, W + 2.5]) {
    for (let z = 0.5; z < H * 0.5; z += 1) {
      if (roadDist(x, z) < 1.8 || isWater(Math.floor(x), Math.floor(z))) continue;
      smokeCands.push({ x, z, h: hash(map.id, 'smoke', Math.round(x * 2), Math.round(z * 2)) });
    }
  }
  const smoke = pick(smokeCands, quality === 'low' ? 4 : MAX_SMOKE, 3.2);
  for (const s of smoke) emitters.push({ kind: 'smokeColumn', x: s.x, y: 0.2, z: s.z });
  // scorch marks on the open ground beside the lanes (never on the road)
  const marks = [];
  const scorchCands = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = map.rows[y][x];
      if (ch !== '.' || isPath(x, y) || occupied.has(`${x},${y}`)) continue;
      const d = roadDist(x + 0.5, y + 0.5);
      if (d < 1.15) continue;
      scorchCands.push({ x: x + 0.5, z: y + 0.5, h: hash(map.id, 'scorch', x, y) });
    }
  }
  for (const s of pick(scorchCands, 10, 2.5)) marks.push({ kind: 'scorch', x: s.x, z: s.z, rot: (s.h % 628) / 100 });
  // the stray cat: on a ruin tile in the rubble, away from the road
  const catTiles = fireCands.filter((f) => !fires.some((o) => Math.hypot(o.x - f.x, o.z - f.z) < 1.2));
  const cat = catTiles.length ? catTiles[hash(map.id, 'cat') % catTiles.length] : null;
  return { fires, glows, emitters, marks, cat: cat ? { x: cat.x, z: cat.z } : null };
}

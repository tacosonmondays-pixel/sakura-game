// The Potential Board's layout (docs/specs/POTENTIAL_BOARD.md; UI_V2_MENUS.md section 6). Pure: no DOM. It turns a girl
// into a node map in a 100 x 64 box (her family's layout, variant and mirror from src/data/potentialBoards.js), places
// the ten gates and the level dots on its light paths, and maps all of it to pixels for a render box, with label and
// token spots that keep clear of every node and gate. draw.js (SVG) and index.js (the sheet) read what this returns.
//
// The route (the real level rule, src/systems/progression.js: gate k >= 6 needs P(k - 4)):
//   P1 -> gates 1-5 with LV 1-60 -> P2 -> gate 6 -> LV 61-63 -> P3 -> gate 7 -> 64-67 -> P4 -> gate 8 -> 68-72 -> P5
//   -> gate 9 -> 73-78 -> P6 -> gate 10 -> 79-84 -> the LV 85 ring (-> the LR crest point, LR units only)
// Band k runs from node Pk to the next node; band 1 holds gates 1-5 (one card, `g15`), bands 2-6 one gate each.
// Nodes light from her Potential, gates from her breakthroughs, dots from her level, so "P4 but behind on gates" reads
// at a glance.
//
// Units: x 0-100 right, y 0-64 down. Every tappable item (six nodes, the gates, the ring, the crest point) keeps a
// 44 px hit circle clear of every other one at the phone box (PHONE_BOX: 3.72 px a unit), so the board is never drawn
// below MIN_SCALE; boardIssues() checks all of it (tests/ui/potentialBoardLayout.test.js runs it for every girl).

import { BOARD_FAMILIES, boardRow, hasLrStep } from '../../data/potentialBoards.js';
import { GATE_CAPS, BASE_GATES, MAX_BREAKTHROUGH, MAX_LEVEL, gatePotential } from '../../systems/progression.js';

/** The layout box (units). */
export const BOX = Object.freeze({ w: 100, h: 64 });

/** The five families (src/data/potentialBoards.js), each with VARIANTS layouts. */
export const FAMILIES = BOARD_FAMILIES;
export const VARIANTS = 3;

/**
 * The Board's drawing box at the phone size, 844 x 390: it opens as a sheet over the tabs and the content window (about
 * x 244-836, y 44-390: 592 x 346 px; the art band and nameplate stay), less 8 px padding, a 196 px card column with an
 * 8 px gap and a 36 px header: 372 x 294. The 100 x 64 board fills its width at 3.72 px a unit (372 x 238); the box
 * counts 240 px high so rounding never pulls the scale under 3.72.
 */
export const PHONE_BOX = Object.freeze({ w: 372, h: 240 });
/**
 * Reference boxes for the other checked sizes: 1280 x 720 (the sheet beside a 28 % art band, less a 300 px card
 * column) and the upright 390 x 844 fallback (the board across the sheet's full width, the card below it).
 */
export const DESKTOP_BOX = Object.freeze({ w: 570, h: 365 });
export const UPRIGHT_BOX = Object.freeze({ w: 374, h: 239 });
/**
 * px a unit below which a 44 px target no longer fits between neighbours. A narrower screen (667 x 375) gives the board
 * more room instead: the card overlays the board's right side rather than taking a column beside it.
 */
export const MIN_SCALE = 3.72;
/** px: every hit target is a circle of at least this radius (44 px across). */
export const HIT_R = 22;
/** px: labels and her token keep at least this much clear of nodes, gates, the ring, the crest, the socket and each other. */
export const CLEAR_PX = 2;

// ---------------------------------------------------------------------------------------------------------------------
// The route
// ---------------------------------------------------------------------------------------------------------------------

/**
 * The bands in order, from the level rule: band 1 P1 -> P2 (LV 1-60, gates 1-5); band k (2-6) Pk -> next (gate k + 4,
 * LV just above the cap before it up to the cap it opens). Band 6 ends at the LV 85 ring.
 * @type {ReadonlyArray<{ band: number, from: string, to: string, lo: number, hi: number, gates: number[] }>}
 */
export const ROUTE = Object.freeze([
  Object.freeze({ band: 1, from: 'p1', to: 'p2', lo: 1, hi: GATE_CAPS[BASE_GATES], gates: Object.freeze(Array.from({ length: BASE_GATES }, (_, i) => i + 1)) }),
  ...[2, 3, 4, 5, 6].map((k) => {
    const gate = BASE_GATES + k - 1;
    return Object.freeze({ band: k, from: `p${k}`, to: k < 6 ? `p${k + 1}` : 'end', lo: GATE_CAPS[gate - 1] + 1, hi: GATE_CAPS[gate], gates: Object.freeze([gate]) });
  }),
]);
/** The LR step after the ring (LR units only): no gates, no levels. */
export const LR_BAND = Object.freeze({ band: 7, from: 'end', to: 'lr', lo: MAX_LEVEL, hi: MAX_LEVEL, gates: Object.freeze([]) });

/** The card id a gate opens: gates 1-5 share one card (`g15`), gates 6-10 their own (`g6`...`g10`). */
export const gateSel = (gate) => (gate <= BASE_GATES ? 'g15' : `g${gate}`);
/** Every selection id the Board knows (route params `sel=`): p1-p6, g15, g6-g10, end, lr. */
export const SELS = Object.freeze(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'g15', 'g6', 'g7', 'g8', 'g9', 'g10', 'end', 'lr']);

/** The band a level sits in (1-6); out-of-range levels clamp. */
export function bandOfLevel(level) {
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1)));
  return ROUTE.find((b) => lv >= b.lo && lv <= b.hi).band;
}

// ---------------------------------------------------------------------------------------------------------------------
// Her pick: a stable hash of her id
// ---------------------------------------------------------------------------------------------------------------------

/** FNV-1a over her id with a final mix: the same number on every device and every build. */
export function boardHash(id) {
  let h = 0x811c9dc5;
  for (const ch of String(id ?? '')) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Her variant (0..VARIANTS-1) and mirror flag from the hash (what src/data/potentialBoards.js wrote in for the 35). */
export function boardPick(id) {
  const h = boardHash(id);
  return { variant: h % VARIANTS, mirror: ((h >>> 16) & 1) === 1 };
}

// ---------------------------------------------------------------------------------------------------------------------
// Geometry helpers (units)
// ---------------------------------------------------------------------------------------------------------------------

const r2 = (v) => Math.round(v * 100) / 100;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const rad = (deg) => (deg * Math.PI) / 180;

/** A point on an ellipse at `deg` (0 = right, 90 = down). */
const ell = (cx, cy, rx, ry, deg) => [cx + rx * Math.cos(rad(deg)), cy + ry * Math.sin(rad(deg))];

/** Points along an ellipse arc from a0 to a1 degrees (either way), both ends included. */
function arc(cx, cy, rx, ry, a0, a1, step = 3) {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / step));
  return Array.from({ length: n + 1 }, (_, i) => ell(cx, cy, rx, ry, a0 + ((a1 - a0) * i) / n));
}

/** A polyline with its 45-degree corners cut (the kit's chamfer, S1): each listed corner gets a cut of `c` units. */
function chamfer(pts, c = 2.2) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, b, d] = [pts[i - 1], pts[i], pts[i + 1]];
    const l1 = dist(a, b);
    const l2 = dist(b, d);
    const k = Math.min(c, l1 / 3, l2 / 3);
    out.push([b[0] + ((a[0] - b[0]) * k) / l1, b[1] + ((a[1] - b[1]) * k) / l1]);
    out.push([b[0] + ((d[0] - b[0]) * k) / l2, b[1] + ((d[1] - b[1]) * k) / l2]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Arc-length tools for one polyline. */
function measure(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  const len = cum[cum.length - 1];
  const at = (s) => {
    const t = Math.max(0, Math.min(len, s));
    let i = 1;
    while (i < cum.length - 1 && cum[i] < t) i++;
    const seg = cum[i] - cum[i - 1] || 1;
    const f = (t - cum[i - 1]) / seg;
    const [a, b] = [pts[i - 1], pts[i]];
    return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI };
  };
  return { len, at };
}

// ---------------------------------------------------------------------------------------------------------------------
// Visual sizes (units at MIN_SCALE; metrics() turns them into px for a box)
// ---------------------------------------------------------------------------------------------------------------------

/** Radii in units: node hex, P6 hex, LV 85 ring, LR crest, gate diamond (half its diagonal), level dot, socket. */
export const SIZE = Object.freeze({ node: 3.4, p6: 3.9, end: 3.0, crest: 3.0, gate: 1.25, dot: 0.5, socket: 4.2 });
/** Station spacing (units): stations keep this far apart (a 44 px hit circle at MIN_SCALE is 11.83 units). */
const D = 12.2;

// ---------------------------------------------------------------------------------------------------------------------
// The families. Each variant returns stations `st` (p1-p6, end, lr), the polyline of each band `path` (1-6, 7 = LR),
// the emblem socket and faint structure lines `deco`. Paths start and end on their stations.
// ---------------------------------------------------------------------------------------------------------------------

const P = (...pts) => pts;

/** Points along a polyline from arc position s0 to s1 (its vertices in between kept; s1 < s0 runs backwards). */
function slice(pts, s0, s1) {
  const m = measure(pts);
  const a = Math.max(0, Math.min(s0, s1));
  const b = Math.min(m.len, Math.max(s0, s1));
  const out = [[m.at(a).x, m.at(a).y]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    acc += dist(pts[i - 1], pts[i]);
    if (acc > a + 1e-6 && acc < b - 1e-6) out.push(pts[i]);
  }
  out.push([m.at(b).x, m.at(b).y]);
  return s0 <= s1 ? out : out.reverse();
}
const pointAt = (pts, s) => {
  const q = measure(pts).at(s);
  return [q.x, q.y];
};

/** A quadratic curve from a through m (its middle) to b, as points. */
function curve(a, m, b, n = 24) {
  const c = [2 * m[0] - (a[0] + b[0]) / 2, 2 * m[1] - (a[1] + b[1]) / 2];
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
  });
}

/** Spear: nodes climb a forward-leaning spine to a tip; P6 at the tip. Gates 6-9 sit on the tooth tips. */
const SPEAR = [
  // 0: a hooked start rising into a sawtooth (nodes on the lower rail, gates on the upper rail); the ring hangs below the tip
  () => {
    const st = { p1: [8, 26], p2: [35.5, 46], p3: [47.6, 39], p4: [59.8, 32], p5: [71.9, 25], p6: [84, 18], end: [88, 46], lr: [72, 56] };
    const tip = [[34.55, 30.38], [46.7, 23.38], [58.85, 16.38], [70.95, 9.38], [90, 29]];
    return {
      st,
      path: {
        1: chamfer(P(st.p1, [8, 48], [14, 56], [28, 56], st.p2)),
        2: P(st.p2, tip[0], st.p3),
        3: P(st.p3, tip[1], st.p4),
        4: P(st.p4, tip[2], st.p5),
        5: P(st.p5, tip[3], st.p6),
        6: P(st.p6, tip[4], st.end),
        7: P(st.end, st.lr),
      },
      gateAt: { 2: tip[0], 3: tip[1], 4: tip[2], 5: tip[3], 6: tip[4] },
      socket: { at: [62, 50], on: null },
      deco: [{ kind: 'line', pts: [[26, 51.5], [92, 13.4]] }],
    };
  },
  // 1: down the left edge, then a sawtooth with the nodes on the upper rail and the gates below; the ring runs off the tip
  () => {
    const st = { p1: [8, 8], p2: [24, 40], p3: [36.4, 33.4], p4: [48.8, 26.8], p5: [61.2, 20.2], p6: [73.6, 13.6], end: [90, 26], lr: [89, 42] };
    const tip = [[36.77, 49.06], [49.17, 42.46], [61.57, 35.86], [73.97, 29.26], [86, 9]];
    return {
      st,
      path: {
        1: chamfer(P(st.p1, [8, 40], st.p2)),
        2: P(st.p2, tip[0], st.p3),
        3: P(st.p3, tip[1], st.p4),
        4: P(st.p4, tip[2], st.p5),
        5: P(st.p5, tip[3], st.p6),
        6: P(st.p6, tip[4], st.end),
        7: P(st.end, st.lr),
      },
      gateAt: { 2: tip[0], 3: tip[1], 4: tip[2], 5: tip[3], 6: tip[4] },
      socket: { at: [20, 54], on: null },
      deco: [{ kind: 'line', pts: [[15, 44.8], [82, 9.2]] }],
    };
  },
  // 2: nodes on a straight leaning spine, the light path weaving out to each gate on alternate sides
  () => {
    const o = [13, 47];
    const u = [0.94, -0.342];
    const n = [0.342, 0.94];
    const at = (s, k = 0) => [o[0] + s * u[0] + k * n[0], o[1] + s * u[1] + k * n[1]];
    const st = { p1: at(0), p2: at(18), p3: at(31), p4: at(44), p5: at(57), p6: at(70), end: at(83), lr: [90, 6] };
    const tip = [at(24.5, 14), at(37.5, -14), at(50.5, 14), at(63.5, -14), at(76.5, 14)];
    return {
      st,
      path: {
        1: chamfer(P(st.p1, at(0, -15), at(18, -15), st.p2)),
        2: P(st.p2, tip[0], st.p3),
        3: P(st.p3, tip[1], st.p4),
        4: P(st.p4, tip[2], st.p5),
        5: P(st.p5, tip[3], st.p6),
        6: P(st.p6, tip[4], st.end),
        7: P(st.end, st.lr),
      },
      gateAt: { 2: tip[0], 3: tip[1], 4: tip[2], 5: tip[3], 6: tip[4] },
      socket: { at: [22, 56], on: null },
      deco: [{ kind: 'line', pts: [at(-4), at(88)] }],
    };
  },
];

/**
 * A route along one polyline: stations at the given arc positions (P1 at 0), each band the stretch between two.
 * @returns {{ st: object, path: object }}
 */
function splitRoute(pts, cuts) {
  const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'end', 'lr'];
  const st = Object.fromEntries(cuts.map((s, i) => [ids[i], pointAt(pts, s)]));
  const path = {};
  for (let i = 1; i < cuts.length; i++) path[i] = slice(pts, cuts[i - 1], cuts[i]);
  return { st, path };
}

/** A spiral around c: angle t0 (deg, 0 = right) turning `dir` (+1 clockwise on screen), radius r0 growing `grow` a turn. */
function spiralPts(c, kx, t0, dir, r0, grow, turnDeg, step = 2) {
  const n = Math.ceil(turnDeg / step);
  return Array.from({ length: n + 1 }, (_, i) => {
    const d = (turnDeg * i) / n;
    const r = r0 + (grow * d) / 360;
    const t = t0 + dir * d;
    return [c[0] + kx * r * Math.cos(rad(t)), c[1] + r * Math.sin(rad(t))];
  });
}

/** Band lengths (units) a spiral route spends: band 1 (with the ray out of the centre), 2-6, then the LR step. */
const SPIRAL_LEN = [47, 27.5, 27.5, 28.5, 30.5, 29.5, 15];

/** Burst: P1 in the centre, nodes on a spiral of rays; P6 on the outer crown. */
function burst(t0, dir, { kx = 1.66, r0 = 12.6, grow = 12.6, chord = 0 } = {}) {
  const c = [50, 32];
  let sp = spiralPts(c, kx, t0, dir, r0, grow, 470, 2);
  if (chord) sp = sp.filter((_, i) => i % (chord / 2) === 0);
  // the ray curves out of the centre and meets the spiral along its tangent (no sharp corner for the gates)
  const s0 = sp[0];
  const tl = dist(sp[0], sp[1]);
  const k = 0.45 * dist(c, s0);
  const q = [s0[0] - ((sp[1][0] - s0[0]) / tl) * k, s0[1] - ((sp[1][1] - s0[1]) / tl) * k];
  const ray = Array.from({ length: 13 }, (_, i) => {
    const t = i / 12;
    const u = 1 - t;
    return [u * u * c[0] + 2 * u * t * q[0] + t * t * s0[0], u * u * c[1] + 2 * u * t * q[1] + t * t * s0[1]];
  });
  const pts = [...ray, ...sp.slice(1)];
  const cuts = SPIRAL_LEN.reduce((a, l) => [...a, a[a.length - 1] + l], [0]);
  const { st, path } = splitRoute(pts, cuts);
  const rays = Array.from({ length: 16 }, (_, i) => ({ kind: 'line', pts: [ell(c[0], c[1], 6, 6, i * 22.5), ell(c[0], c[1], 46, 30, i * 22.5)] }));
  return { st, path, socket: { at: c, on: 'p1' }, deco: rays };
}
const BURST = [
  // 0: the ray leaves to the right
  () => burst(0, 1),
  // 1: the ray leaves up and to the right; a tighter turn
  () => burst(-45, 1, { kx: 1.6 }),
  // 2: straight chords between the rays
  () => burst(20, 1, { chord: 30 }),
];

/** Ring: nodes on a ring around a centre socket; P6 in the centre. */
function ring({ rx, ry, ang, cx = 50, cy = 32 }) {
  const st = { ...Object.fromEntries(Object.entries(ang).map(([k, t]) => [k, ell(cx, cy, rx, ry, t)])), p6: [cx, cy] };
  return {
    st,
    path: {
      1: arc(cx, cy, rx, ry, ang.p1, ang.p2),
      2: arc(cx, cy, rx, ry, ang.p2, ang.p3),
      3: arc(cx, cy, rx, ry, ang.p3, ang.p4),
      4: arc(cx, cy, rx, ry, ang.p4, ang.p5),
      5: P(st.p5, st.p6),
      6: P(st.p6, st.end),
      7: arc(cx, cy, rx, ry, ang.end, ang.lr),
    },
    socket: { at: [cx, cy], on: 'p6' },
    deco: [{ kind: 'ellipse', cx, cy, rx, ry }, { kind: 'ellipse', cx, cy, rx: 8.5, ry: 8.5 }],
  };
}
const flipY = (g) => ({
  ...g,
  st: Object.fromEntries(Object.entries(g.st).map(([k, p]) => [k, [p[0], BOX.h - p[1]]])),
  path: Object.fromEntries(Object.entries(g.path).map(([k, pts]) => [k, pts.map((p) => [p[0], BOX.h - p[1]])])),
  socket: { ...g.socket, at: [g.socket.at[0], BOX.h - g.socket.at[1]] },
  deco: g.deco.map((d) => (d.kind === 'ellipse' ? { ...d, cy: BOX.h - d.cy } : d.pts ? { ...d, pts: d.pts.map((p) => [p[0], BOX.h - p[1]]) } : d)),
});
const RING_A = { rx: 43, ry: 25.5, ang: { p1: -72, p2: 22, p3: 74, p4: 126, p5: 180, end: -130, lr: -101 } };
const RING = [
  // 0: five nodes round the right, bottom and left; P5 to the centre and out to the ring at the top left
  () => ring(RING_A),
  // 1: the same, opened at the bottom
  () => flipY(ring(RING_A)),
  // 2: five nodes over the top; the two spokes meet in the centre from below
  () => ring({ rx: 41, ry: 24.5, ang: { p1: 165, p2: 260, p3: 315, p4: 368, p5: 422, end: 122, lr: 93 } }),
];

/** Circuit: nodes on a right-angled circuit trace; P6 on the chip. */
const chip = (p) => ({ kind: 'rect', x: p[0] - 7, y: p[1] - 7, w: 14, h: 14 });
const CIRCUIT = [
  // 0: three rows, back and forth, the chip on the top row
  () => {
    const st = { p1: [8, 56], p2: [60, 56], p3: [60, 34], p4: [32, 34], p5: [34, 12], p6: [64, 12], end: [88, 30], lr: [88, 47] };
    return {
      st,
      path: {
        1: P(st.p1, st.p2),
        2: chamfer(P(st.p2, [80, 56], [80, 34], st.p3)),
        3: P(st.p3, st.p4),
        4: chamfer(P(st.p4, [14, 34], [14, 12], st.p5)),
        5: P(st.p5, st.p6),
        6: chamfer(P(st.p6, [88, 12], st.end)),
        7: P(st.end, st.lr),
      },
      socket: { at: st.p6, on: 'p6' },
      deco: [chip(st.p6)],
    };
  },
  // 1: a square spiral inward to the chip in the centre
  () => {
    const st = { p1: [8, 56], p2: [66, 56], p3: [90, 32], p4: [70, 8], p5: [30, 8], p6: [50, 32], end: [72, 44], lr: [56, 44] };
    return {
      st,
      path: {
        1: P(st.p1, st.p2),
        2: chamfer(P(st.p2, [90, 56], st.p3)),
        3: chamfer(P(st.p3, [90, 8], st.p4)),
        4: P(st.p4, st.p5),
        5: chamfer(P(st.p5, [10, 8], [10, 32], st.p6)),
        6: chamfer(P(st.p6, [72, 32], st.end)),
        7: P(st.end, st.lr),
      },
      socket: { at: st.p6, on: 'p6' },
      deco: [chip(st.p6)],
    };
  },
  // 2: up and down in columns, the chip on the last column
  () => {
    const st = { p1: [10, 8], p2: [34, 56], p3: [34, 24], p4: [58, 18], p5: [58, 48], p6: [82, 38], end: [82, 8], lr: [68, 8] };
    return {
      st,
      path: {
        1: chamfer(P(st.p1, [10, 56], st.p2)),
        2: P(st.p2, st.p3),
        3: chamfer(P(st.p3, [34, 8], [58, 8], st.p4)),
        4: P(st.p4, st.p5),
        5: chamfer(P(st.p5, [58, 56], [82, 56], st.p6)),
        6: P(st.p6, st.end),
        7: P(st.end, st.lr),
      },
      socket: { at: st.p6, on: 'p6' },
      deco: [chip(st.p6)],
    };
  },
];

/**
 * Crest: a symmetric crest; P6 at the top. Three tiers, each drawn left to right by `tier(a, apex, b)` (a chevron, an
 * arch or a flat-topped gable): P1 -> P2 over the lowest tier, P3 and P4 on the middle tier's arms, P5, P6 (its top)
 * and the ring on the top tier; the bands climb between tiers up the right side, then up the left.
 */
function crest(tier, { q2 = 8, q3 = 10, lr = [92, 30] } = {}) {
  const t1 = tier([10, 57], [50, 41], [90, 57]);
  const t2 = tier([16, 38], [50, 22], [84, 38]);
  const t3 = tier([8, 20], [50, 6.5], [92, 20]);
  const [l2, l3] = [measure(t2).len, measure(t3).len];
  const st = {
    p1: t1[0], p2: t1[t1.length - 1],
    p3: pointAt(t2, l2 - q2), p4: pointAt(t2, q2),
    p5: pointAt(t3, q3), p6: pointAt(t3, l3 / 2), end: pointAt(t3, l3 - q3),
    lr,
  };
  return {
    st,
    path: {
      1: t1,
      2: [st.p2, ...slice(t2, l2, l2 - q2)],
      3: slice(t2, l2 - q2, q2),
      4: [...slice(t2, q2, 0), ...slice(t3, 0, q3)],
      5: slice(t3, q3, l3 / 2),
      6: slice(t3, l3 / 2, l3 - q3),
      7: [...slice(t3, l3 - q3, l3), lr],
    },
    socket: { at: [50, 31.5], on: null },
    deco: [{ kind: 'line', pts: [[50, 26], [50, 37]] }],
  };
}
const CREST = [
  // 0: three chevrons
  () => crest((a, m, b) => [a, m, b]),
  // 1: three arches
  () => crest((a, m, b) => curve(a, [m[0], m[1] + 1.5], b)),
  // 2: three flat-topped gables
  () => crest((a, m, b) => [a, [m[0] - 9, m[1] + 2.5], [m[0] + 9, m[1] + 2.5], b]),
];

const GEOMETRY = Object.freeze({ spear: SPEAR, burst: BURST, ring: RING, circuit: CIRCUIT, crest: CREST });

// ---------------------------------------------------------------------------------------------------------------------
// Items on the paths
// ---------------------------------------------------------------------------------------------------------------------

/** Radius (units) of the station at an id. */
const stationR = (id) => (id === 'p6' ? SIZE.p6 : id === 'end' ? SIZE.end : id === 'lr' ? SIZE.crest : SIZE.node);
/** One px in units at MIN_SCALE (clearances are counted there). */
const PXU = 1 / MIN_SCALE;

/** First arc position s in [from, len] at which the path is at least `d` from point `p`. */
function firstClear(m, p, d, from = 0) {
  for (let s = from; s <= m.len; s += 0.05) {
    const q = m.at(s);
    if (Math.hypot(q.x - p[0], q.y - p[1]) >= d) return s;
  }
  return null;
}
/** Last arc position s in [0, upto] at which the path is at least `d` from point `p`. */
function lastClear(m, p, d, upto = m.len) {
  for (let s = upto; s >= 0; s -= 0.05) {
    const q = m.at(s);
    if (Math.hypot(q.x - p[0], q.y - p[1]) >= d) return s;
  }
  return null;
}
/** The arc position on the path nearest a point. */
function nearestS(m, p) {
  let best = 0;
  let bd = Infinity;
  for (let s = 0; s <= m.len; s += 0.05) {
    const q = m.at(s);
    const d = Math.hypot(q.x - p[0], q.y - p[1]);
    if (d < bd) [best, bd] = [s, d];
  }
  return best;
}
const ptOf = (m, s) => {
  const q = m.at(s);
  return [q.x, q.y];
};

/**
 * Place gates and level dots on one band. Band 1: gates 1-5 centred in the stretch that keeps D from both nodes, 4.4
 * to 5.2 units apart, and one dot for each ten-level stretch around them. Bands 2-6: the gate where the variant pins it
 * (a sawtooth's tooth tip) or where the path first clears D from its start node, then one dot a level after it (band 6
 * stops at 84: the ring is 85). Every clearance is a straight-line distance, so a corner never squeezes two items.
 */
function placeBand(b, pts, st, pin, problems) {
  const m = measure(pts);
  const start = st[b.from];
  const end = st[b.to];
  const gates = [];
  const dots = [];
  const anchors = []; // [level, s] for routeAt
  const startClear = stationR(b.from) + SIZE.dot + 2 * PXU;
  const endClear = stationR(b.to) + SIZE.dot + 2 * PXU;
  const gateClear = SIZE.gate + SIZE.dot + 2 * PXU;
  const sStart = firstClear(m, start, startClear) ?? 0;
  const sEnd = lastClear(m, end, endClear) ?? m.len;
  if (b.band === 1) {
    const a = firstClear(m, start, D);
    const z = lastClear(m, end, D);
    if (a == null || z == null || z - a < 4 * 4.4) problems.push(`band 1: no room for gates 1-5 (${a?.toFixed(1)}..${z?.toFixed(1)})`);
    const lo = a ?? 0;
    const hi = z ?? m.len;
    const gap = Math.min(5.2, Math.max(0, (hi - lo) / 4));
    const mid = (lo + hi) / 2;
    const sg = b.gates.map((g, i) => mid + (i - 2) * gap);
    b.gates.forEach((g, i) => gates.push({ gate: g, s: sg[i] }));
    // stretches: LV 1-10 before gate 1, 11-20 between gates 1 and 2, ..., 51-60 after gate 5
    for (let j = 0; j <= b.gates.length; j++) {
      const lv0 = j === 0 ? 1 : GATE_CAPS[j - 1] + 1;
      const lv1 = GATE_CAPS[j];
      const s0 = j === 0 ? sStart : firstClear(m, ptOf(m, sg[j - 1]), gateClear, sg[j - 1]) ?? sg[j - 1];
      const s1 = j === b.gates.length ? sEnd : lastClear(m, ptOf(m, sg[j]), gateClear, sg[j]) ?? sg[j];
      dots.push({ level: lv1, lo: lv0, hi: lv1, s: (s0 + s1) / 2 });
      anchors.push([lv0, Math.min(s0, s1)], [lv1, Math.max(s0, s1)]);
    }
  } else {
    const g = b.gates[0];
    const sg = pin ? nearestS(m, pin) : firstClear(m, start, D);
    const gp = sg == null ? null : ptOf(m, sg);
    if (gp == null || dist(gp, start) < D || dist(gp, end) < D) problems.push(`band ${b.band}: gate ${g} cannot keep ${D} from both nodes`);
    const s = sg ?? m.len / 2;
    gates.push({ gate: g, s });
    const top = b.to === 'end' ? b.hi - 1 : b.hi;
    const n = top - b.lo + 1;
    const s0 = firstClear(m, ptOf(m, s), gateClear, s) ?? s;
    const span = sEnd - s0;
    const step = n > 1 ? Math.min(2.6, span / (n - 1)) : 0;
    if (n > 1 && step < 1.6) problems.push(`band ${b.band}: ${n} dots need ${(1.6 * (n - 1)).toFixed(1)} units, have ${span.toFixed(1)}`);
    const first = s0 + (span - step * (n - 1)) / 2;
    for (let i = 0; i < n; i++) {
      const lv = b.lo + i;
      dots.push({ level: lv, lo: lv, hi: lv, s: first + i * step });
      anchors.push([lv, first + i * step]);
    }
    if (b.to === 'end') anchors.push([b.hi, m.len]);
  }
  const at = (s) => m.at(s);
  return {
    len: m.len,
    gates: gates.map((x) => ({ ...x, ...at(x.s) })),
    dots: dots.map((x) => ({ ...x, ...at(x.s) })),
    anchors,
    at,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------------------------------------------------

const mirrorPt = (p) => [BOX.w - p[0], p[1]];
const roundPt = (p) => [r2(p[0]), r2(p[1])];
const svgD = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${r2(p[0])} ${r2(p[1])}`).join(' ');

function mirrorDeco(d) {
  if (d.kind === 'line' || d.kind === 'poly') return { ...d, pts: d.pts.map(mirrorPt) };
  if (d.kind === 'ellipse') return { ...d, cx: BOX.w - d.cx };
  if (d.kind === 'rect') return { ...d, x: BOX.w - d.x - d.w };
  return d;
}

/**
 * Her Board in units.
 * @param {object} def her unit def (`id`, `role`, `kind`, `rarity`); anything with an id works (class defaults)
 * @param {{ lr?: boolean, family?: string, variant?: number, mirror?: boolean }} [o] lr: draw the LR crest point
 *   (default: hasLrStep(def)); family / variant / mirror: overrides for previews and tests
 * @returns {object} { id, family, variant, mirror, hue, emblem, lr, nodes, end, crest, socket, bands, gates, dots, deco, problems }
 */
export function boardFor(def, o = {}) {
  const row = boardRow(def);
  const pick = boardPick(row.id);
  const family = FAMILIES.includes(o.family) ? o.family : row.family;
  const variant = Number.isInteger(o.variant) ? ((o.variant % VARIANTS) + VARIANTS) % VARIANTS : (o.family ? pick.variant : row.variant ?? pick.variant);
  const mirror = typeof o.mirror === 'boolean' ? o.mirror : (o.family ? pick.mirror : row.mirror ?? pick.mirror);
  const lr = typeof o.lr === 'boolean' ? o.lr : hasLrStep(def);
  const raw = GEOMETRY[family][variant]();
  const tx = mirror ? mirrorPt : (p) => p;
  const st = Object.fromEntries(Object.entries(raw.st).map(([k, p]) => [k, tx(p)]));
  const problems = [];
  const bands = [];
  const gates = [];
  const dots = [];
  const anchors = {};
  for (const b of ROUTE) {
    const pts = raw.path[b.band].map(tx);
    const pin = raw.gateAt?.[b.band] ? tx(raw.gateAt[b.band]) : null;
    const placed = placeBand(b, pts, st, pin, problems);
    bands.push({ ...b, pts: pts.map(roundPt), len: r2(placed.len), d: svgD(pts) });
    for (const g of placed.gates) {
      gates.push({ sel: gateSel(g.gate), gate: g.gate, band: b.band, x: r2(g.x), y: r2(g.y), s: r2(g.s), angle: r2(g.angle), cap: GATE_CAPS[g.gate], needP: gatePotential(g.gate) });
    }
    for (const d of placed.dots) dots.push({ band: b.band, level: d.level, lo: d.lo, hi: d.hi, x: r2(d.x), y: r2(d.y), s: r2(d.s) });
    anchors[b.band] = { anchors: placed.anchors, at: placed.at, len: placed.len };
  }
  if (lr) {
    const pts = raw.path[7].map(tx);
    bands.push({ ...LR_BAND, pts: pts.map(roundPt), len: r2(measure(pts).len), d: svgD(pts) });
  }
  const socketAt = raw.socket.on ? st[raw.socket.on] : tx(raw.socket.at);
  const board = {
    id: row.id,
    family,
    variant,
    mirror,
    hue: row.hue,
    emblem: row.emblem,
    lr,
    box: BOX,
    nodes: [1, 2, 3, 4, 5, 6].map((k) => ({ sel: `p${k}`, step: k, x: r2(st[`p${k}`][0]), y: r2(st[`p${k}`][1]), r: k === 6 ? SIZE.p6 : SIZE.node })),
    end: { sel: 'end', level: MAX_LEVEL, x: r2(st.end[0]), y: r2(st.end[1]), r: SIZE.end },
    crest: lr ? { sel: 'lr', x: r2(st.lr[0]), y: r2(st.lr[1]), r: SIZE.crest } : null,
    socket: { x: r2(socketAt[0]), y: r2(socketAt[1]), r: raw.socket.on ? stationR(raw.socket.on) : SIZE.socket, on: raw.socket.on },
    bands,
    gates,
    dots,
    deco: (raw.deco || []).map((d) => (mirror ? mirrorDeco(d) : d)),
    problems,
  };
  Object.defineProperty(board, 'route', { value: anchors, enumerable: false });
  return board;
}

/**
 * Where a level sits on her route (units): band 1-6, the arc position `s` along that band and the point; LV 85 is the
 * ring. Her token goes beside it. `board` is the object boardFor() returned (its route lives on it, not enumerable).
 * @returns {{ band: number, s: number, x: number, y: number, angle: number }}
 */
export function routeAt(board, level) {
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1)));
  const band = bandOfLevel(lv);
  if (lv >= MAX_LEVEL) return { band, s: r2(board.route[band].len), x: board.end.x, y: board.end.y, angle: 0 };
  const r = board.route[band];
  const a = r.anchors;
  let s = a[0][1];
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] === lv) {
      s = a[i][1];
      break;
    }
    if (a[i][0] > lv) {
      const [l0, s0] = a[i - 1] || a[i];
      const [l1, s1] = a[i];
      s = l1 === l0 ? s1 : s0 + ((s1 - s0) * (lv - l0)) / (l1 - l0);
      break;
    }
    s = a[i][1];
  }
  const p = r.at(s);
  return { band, s: r2(s), x: r2(p.x), y: r2(p.y), angle: r2(p.angle) };
}

/**
 * What is lit for her state (display only): nodes from her Potential, gates from her breakthroughs, dots from her
 * level, a band's path once the node it leads to is hers, the ring at LV 85 with all ten gates, the crest once her LR
 * step is done. `next`: the node Raise ignites next (null at P6). "P4 but behind on gates" is P4's nodes lit with
 * gates 6 and 7 dark.
 * @param {object} board boardFor()
 * @param {{ p?: number, gates?: number, level?: number, lrDone?: boolean }} s
 */
export function boardLights(board, { p = 1, gates = 0, level = 1, lrDone = false } = {}) {
  const pp = Math.max(1, Math.min(6, Math.floor(Number(p) || 1)));
  const gg = Math.max(0, Math.min(MAX_BREAKTHROUGH, Math.floor(Number(gates) || 0)));
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1)));
  return {
    nodes: Object.fromEntries(board.nodes.map((n) => [n.sel, n.step <= pp])),
    gates: Object.fromEntries(board.gates.map((g) => [g.gate, g.gate <= gg])),
    dots: board.dots.map((d) => lv >= d.hi),
    bands: Object.fromEntries(board.bands.map((b) => [b.band, b.band === 7 ? lrDone : b.band < 6 ? pp > b.band : lv >= MAX_LEVEL && gg >= MAX_BREAKTHROUGH])),
    end: lv >= MAX_LEVEL && gg >= MAX_BREAKTHROUGH,
    lr: !!board.crest && lrDone,
    next: pp < 6 ? `p${pp + 1}` : null,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Pixels
// ---------------------------------------------------------------------------------------------------------------------

/** How the 100 x 64 box sits in a render box: scale (px a unit) and offsets, centred. */
export function fitBox(box) {
  const scale = Math.min(box.w / BOX.w, box.h / BOX.h);
  return { scale, ox: (box.w - BOX.w * scale) / 2, oy: (box.h - BOX.h * scale) / 2, w: box.w, h: box.h };
}

/** Sizes in px for a scale (px a unit): radii, the hit radius, label type. */
export function metrics(scale) {
  const c = (u, lo, hi) => Math.max(lo, Math.min(hi, u * scale));
  const font = scale >= 5 ? 13 : 12;
  return {
    scale,
    node: c(SIZE.node, 12, 20),
    p6: c(SIZE.p6, 14, 23),
    end: c(SIZE.end, 10.5, 17),
    crest: c(SIZE.crest, 10.5, 17),
    gate: c(SIZE.gate, 4.5, 7),
    dot: c(SIZE.dot, 1.8, 3),
    socket: c(SIZE.socket, 14, 24),
    token: c(3.8, 14, 22),
    hit: HIT_R,
    font,
    labelH: font + 6,
    charW: font * 0.62,
  };
}

/**
 * Her Board in px for a render box: every station, gate and dot with its radius, plus the fit and the sizes.
 * @param {object} board boardFor()
 * @param {{ w: number, h: number }} box
 */
export function boardPixels(board, box) {
  const f = fitBox(box);
  const m = metrics(f.scale);
  const X = (x) => f.ox + x * f.scale;
  const Y = (y) => f.oy + y * f.scale;
  const pt = (o, r, extra = {}) => ({ ...extra, x: X(o.x), y: Y(o.y), r });
  return {
    fit: f,
    m,
    X,
    Y,
    nodes: board.nodes.map((n) => pt(n, n.step === 6 ? m.p6 : m.node, { sel: n.sel, step: n.step })),
    end: pt(board.end, m.end, { sel: 'end' }),
    crest: board.crest ? pt(board.crest, m.crest, { sel: 'lr' }) : null,
    socket: board.socket.on ? null : pt(board.socket, m.socket, { sel: 'socket' }),
    gates: board.gates.map((g) => pt(g, m.gate, { sel: g.sel, gate: g.gate, angle: g.angle })),
    dots: board.dots.map((d) => pt(d, m.dot, { band: d.band, level: d.level })),
  };
}

/** The hit circles (px): one per node, gate, the ring and the crest; gates 1-5 all answer `g15`. */
export function hitTargets(board, box) {
  const px = boardPixels(board, box);
  const r = (v) => Math.max(HIT_R, v + 4);
  return [
    ...px.nodes.map((n) => ({ sel: n.sel, x: n.x, y: n.y, r: r(n.r) })),
    ...px.gates.map((g) => ({ sel: g.sel, x: g.x, y: g.y, r: r(g.r) })),
    { sel: 'end', x: px.end.x, y: px.end.y, r: r(px.end.r) },
    ...(px.crest ? [{ sel: 'lr', x: px.crest.x, y: px.crest.y, r: r(px.crest.r) }] : []),
  ];
}

/** The tappable item nearest a px point within its hit circle, or null. */
export function hitAt(board, box, x, y) {
  let best = null;
  for (const t of hitTargets(board, box)) {
    const d = Math.hypot(t.x - x, t.y - y);
    if (d <= t.r && (!best || d < best.d)) best = { sel: t.sel, d };
  }
  return best ? best.sel : null;
}

/** Everything a label or the token must keep clear of (px circles). */
function obstacles(px) {
  return [
    ...px.nodes,
    ...px.gates,
    px.end,
    ...(px.crest ? [px.crest] : []),
    ...(px.socket ? [px.socket] : []),
  ];
}

/** Distance from a circle centre to a rect (0 inside). */
const rectDist = (c, r) => Math.hypot(Math.max(r.x - c.x, 0, c.x - (r.x + r.w)), Math.max(r.y - c.y, 0, c.y - (r.y + r.h)));
const rectsGap = (a, b) => Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), a.y - (b.y + b.h), b.y - (a.y + a.h));

/** Phones label only the next node; a roomy box labels all six. */
export const labelsAll = (box) => fitBox(box).scale >= 5;

/**
 * Label spots (px rects) for her nodes: phones (scale under 5) only the next node, roomy boxes every node. Each label
 * takes the nearest spot around its node (12 directions, right and left first, at four distances) that stays inside the
 * box and CLEAR_PX from every node, gate, the ring, the crest, the socket, her token and the other labels. A label set
 * away from its node has `leader` (draw a thin line from the node's edge to `anchor`); one with no clear spot is left
 * out (`dropped`).
 * @param {object} board
 * @param {{ w: number, h: number }} box
 * @param {{ next?: number|null, text?: (step: number) => string, all?: boolean, token?: { x: number, y: number, r: number }|null }} [o]
 *   next: her next step (2-6; null at P6), text: the label of a step (default "P<n>")
 * @returns {{ labels: { sel: string, step: number, text: string, x: number, y: number, w: number, h: number, leader: boolean, anchor: { x: number, y: number } }[], dropped: string[] }}
 */
export function placeLabels(board, box, { next = null, text = (k) => `P${k}`, all = labelsAll(box), token = null } = {}) {
  const px = boardPixels(board, box);
  const { m } = px;
  const obs = obstacles(px);
  if (token) obs.push(token);
  const steps = all ? [1, 2, 3, 4, 5, 6] : next ? [next] : [];
  const labels = [];
  const dropped = [];
  // right, left, up, down, then the diagonals and the rest
  const angles = [0, 180, -90, 90, -30, -150, 30, 150, -60, -120, 60, 120];
  for (const k of steps) {
    const n = px.nodes[k - 1];
    const t = String(text(k));
    const w = Math.ceil(10 + t.length * m.charW);
    const h = m.labelH;
    const ok = (rc) => rc.x >= 0 && rc.y >= 0 && rc.x + rc.w <= box.w && rc.y + rc.h <= box.h
      && obs.every((c) => rectDist(c, rc) >= c.r + CLEAR_PX)
      && labels.every((l) => rectsGap(l, rc) >= CLEAR_PX);
    let spot = null;
    for (const d of [n.r + 4, n.r + 12, n.r + 22, n.r + 34]) {
      for (const a of angles) {
        const [ux, uy] = [Math.cos(rad(a)), Math.sin(rad(a))];
        // the rect's centre sits so its nearest side is about d from the node's centre
        const reach = d + (w / 2) * Math.abs(ux) + (h / 2) * Math.abs(uy);
        const rc = { x: Math.round(n.x + ux * reach - w / 2), y: Math.round(n.y + uy * reach - h / 2), w, h };
        if (ok(rc)) {
          spot = { ...rc, leader: d > n.r + 4, anchor: { x: Math.round(n.x + ux * n.r), y: Math.round(n.y + uy * n.r) } };
          break;
        }
      }
      if (spot) break;
    }
    if (spot) labels.push({ sel: `p${k}`, step: k, text: t, ...spot });
    else dropped.push(`p${k}`);
  }
  return { labels, dropped };
}

/**
 * Her token (thumb portrait) beside where her level sits on the route: the first spot around that point, along the
 * path's normal first, that stays inside the box and CLEAR_PX from every node, gate, the ring, the crest, the socket
 * and the labels given. `at` is the route point it marks.
 * @returns {{ x: number, y: number, r: number, at: { x: number, y: number }, band: number }}
 */
export function placeToken(board, box, { level = 1, labels = [] } = {}) {
  const px = boardPixels(board, box);
  const { m } = px;
  const p = routeAt(board, level);
  const at = { x: px.X(p.x), y: px.Y(p.y) };
  const r = m.token;
  const obs = obstacles(px);
  const free = (c) => c.x - r >= 0 && c.y - r >= 0 && c.x + r <= box.w && c.y + r <= box.h
    && obs.every((o) => Math.hypot(o.x - c.x, o.y - c.y) >= o.r + r + CLEAR_PX)
    && labels.every((l) => rectDist(c, l) >= r + CLEAR_PX);
  const nx = -Math.sin(rad(p.angle));
  const ny = Math.cos(rad(p.angle));
  for (let k = 1; k <= 12; k++) {
    const d = r + 3 + (k - 1) * 6;
    const tries = [[nx, ny], [-nx, -ny]];
    for (let a = 15; a < 360; a += 15) if (a !== 180) tries.push([Math.cos(rad(p.angle + 90 + a)), Math.sin(rad(p.angle + 90 + a))]);
    for (const [ux, uy] of tries) {
      const c = { x: Math.round(at.x + ux * d), y: Math.round(at.y + uy * d) };
      if (free(c)) return { x: c.x, y: c.y, r, at, band: p.band };
    }
  }
  return { x: Math.round(at.x), y: Math.round(at.y), r, at, band: p.band, crowded: true };
}

// ---------------------------------------------------------------------------------------------------------------------
// The checks (tests/ui/potentialBoardLayout.test.js runs them for every girl at PHONE_BOX)
// ---------------------------------------------------------------------------------------------------------------------

function segsCross(a, b, c, d) {
  const o = (p, q, r) => { const v = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return v > 0 ? 1 : v < 0 ? -1 : 0; };
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}
const segPointDist = (a, b, p) => {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]);
};

/**
 * Every rule the Board's geometry must keep, for one render box (px), as a list of readable problems ([] = fine):
 * points inside the box; hit circles of different items never overlap (so each is a whole 44 px target) and stay in
 * the box; dots clear of gates, nodes and each other; no path crosses another or runs through a station that is not
 * its own.
 */
export function boardIssues(board, box = PHONE_BOX) {
  const out = [...board.problems];
  const inBox = (o, what) => {
    if (!(o.x >= 0 && o.x <= BOX.w && o.y >= 0 && o.y <= BOX.h)) out.push(`${what} outside the box (${o.x}, ${o.y})`);
  };
  board.nodes.forEach((n) => inBox(n, n.sel));
  inBox(board.end, 'end');
  if (board.crest) inBox(board.crest, 'lr');
  inBox(board.socket, 'socket');
  board.gates.forEach((g) => inBox(g, `gate ${g.gate}`));
  board.dots.forEach((d) => inBox(d, `dot ${d.level}`));
  board.bands.forEach((b) => b.pts.forEach((p) => inBox({ x: p[0], y: p[1] }, `band ${b.band} path`)));

  const px = boardPixels(board, box);
  const hits = hitTargets(board, box);
  for (let i = 0; i < hits.length; i++) {
    const a = hits[i];
    if (a.x - a.r < -0.5 || a.y - a.r < -0.5 || a.x + a.r > box.w + 0.5 || a.y + a.r > box.h + 0.5) out.push(`${a.sel} hit circle leaves the box`);
    for (let j = i + 1; j < hits.length; j++) {
      const b = hits[j];
      if (a.sel === b.sel) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < a.r + b.r - 0.01) out.push(`${a.sel} and ${b.sel} hit circles overlap (${d.toFixed(1)} px apart)`);
    }
  }
  const solid = [...px.nodes, ...px.gates, px.end, ...(px.crest ? [px.crest] : []), ...(px.socket ? [px.socket] : [])];
  for (const d of px.dots) {
    for (const s of solid) {
      if (Math.hypot(d.x - s.x, d.y - s.y) < d.r + s.r + 1.5) out.push(`dot ${d.level} touches ${s.sel}${s.gate ? ` ${s.gate}` : ''}`);
    }
  }
  for (let i = 0; i < px.dots.length; i++) {
    for (let j = i + 1; j < px.dots.length; j++) {
      const [a, b] = [px.dots[i], px.dots[j]];
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + 1.5) out.push(`dots ${a.level} and ${b.level} touch`);
    }
  }
  // paths: no crossings between bands; no path through a station it does not start or end at
  const segs = board.bands.flatMap((b) => b.pts.slice(1).map((p, i) => ({ band: b.band, a: b.pts[i], b: p, from: b.from, to: b.to })));
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      if (segs[i].band === segs[j].band) continue;
      if (segsCross(segs[i].a, segs[i].b, segs[j].a, segs[j].b)) out.push(`bands ${segs[i].band} and ${segs[j].band} cross`);
    }
  }
  const stations = [...board.nodes, board.end, ...(board.crest ? [board.crest] : [])];
  for (const s of segs) {
    for (const n of stations) {
      if (n.sel === s.from || n.sel === s.to) continue;
      if (segPointDist(s.a, s.b, [n.x, n.y]) < n.r + 1.2) out.push(`band ${s.band} runs through ${n.sel}`);
    }
    if (!board.socket.on && segPointDist(s.a, s.b, [board.socket.x, board.socket.y]) < board.socket.r + 0.8) out.push(`band ${s.band} runs through the socket`);
  }
  return [...new Set(out)];
}

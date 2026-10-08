// Tracks v3 — the ONE canonical road centreline shared by the map data, the battle sim, the
// 3D renderer and the stage thumbnails (no re-smoothing anywhere downstream).
//
// Maps author each path as smooth curves through control points in WORLD coordinates
// (tile (tx, ty) covers [tx, tx+1) × [ty, ty+1); its centre is (tx + 0.5, ty + 0.5)):
//
//   [x, y]            a control point the centreline passes through (centripetal Catmull-Rom)
//   LINE ('-')        between two points: that section is an exact straight, and the curves on
//                     either side leave / enter it tangentially
//   TUNNEL_IN ('[')   a tunnel starts at the previous control point …
//   TUNNEL_OUT (']')  … and ends at the previous control point (enemies inside are hidden and
//                     cannot be targeted, like Bloons TD6 tunnels)
//   ...arc(cx, cy, r, a0, a1)        control points along a circle (degrees, 0 = +x, 90 = +y/south)
//   ...spiral(cx, cy, r0, r1, a0, a1) the same with a radius that changes with the angle
//
// A path spec is either that node list, or { nodes, fork?, join? } where
//   fork: { path: i, at: [x, y] }  the path starts ON path i (shares its entrance) and leaves it
//                                  tangentially at the point of path i nearest to `at`;
//   join: { path: i, at: [x, y] }  the path merges tangentially into path i and then follows it.
// Paths may only fork from / join earlier paths.
//
// Everything is sampled ONCE into a dense polyline (TRACK_STEP spacing): the sim walks it by
// distance, the renderer extrudes the road ribbon along the same points, the thumbnails draw it.
// Self-crossings and crossings between paths are found automatically; each is either a flat
// junction or a bridge (the later pass rises over the earlier one: an elevation profile).
//
// Pure functions, no DOM / three.js — safe in Node (tests) and the browser.

/** Spacing (tiles) of the dense centreline samples. */
export const TRACK_STEP = 0.1;
/** Half-width of the sim's forbidden placement band (CONTRACTS §6, PATH_HALF_WIDTH). */
export const BAND_HALF_WIDTH = 0.55;
/** Half-width used to rasterise path TILES: every tile whose square the visible road (incl. bevel) touches. */
export const STAMP_HALF_WIDTH = 0.5;
/** Overpass deck height (world units) and its profile: flat top ± BRIDGE_FLAT, ramps of BRIDGE_RAMP. */
export const BRIDGE_HEIGHT = 0.62;
export const BRIDGE_FLAT = 0.8;
export const BRIDGE_RAMP = 1.3;

/** Half-width of an overpass deck (world units): the lower pass is "under the deck" within it. */
export const DECK_HALF = 0.62;

/** Marker: the section to the next control point is an exact straight. */
export const LINE = '-';
/** Marker: a tunnel starts at the previous control point. */
export const TUNNEL_IN = '[';
/** Marker: the tunnel ends at the previous control point. */
export const TUNNEL_OUT = ']';

const DEG = Math.PI / 180;
const r4 = (v) => Math.round(v * 1e4) / 1e4;

// ---------------------------------------------------------------------------
// Authoring helpers
// ---------------------------------------------------------------------------

/**
 * Control points along a circular (or, with `sy`, elliptical) arc — both ends included.
 * @param {number} cx @param {number} cy centre (world)
 * @param {number} r radius (tiles; the x radius when `sy` ≠ 1)
 * @param {number} a0 @param {number} a1 start / end angle in degrees (0 = +x, 90 = +y i.e. down on screen);
 *   a1 > a0 runs clockwise on screen, a1 < a0 counter-clockwise; |a1 - a0| may exceed 360 (loops)
 * @param {number} [stepDeg=30] spacing of the control points
 * @param {number} [sy=1] vertical squash: y radius = r × sy
 * @returns {number[][]}
 */
export function arc(cx, cy, r, a0, a1, stepDeg = 30, sy = 1) {
  return spiral(cx, cy, r, r, a0, a1, stepDeg, sy);
}

/**
 * Control points along a spiral: the radius goes linearly from r0 to r1 with the angle.
 * @returns {number[][]}
 */
export function spiral(cx, cy, r0, r1, a0, a1, stepDeg = 30, sy = 1) {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / stepDeg));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = (a0 + (a1 - a0) * t) * DEG;
    const r = r0 + (r1 - r0) * t;
    out.push([r4(cx + Math.cos(a) * r), r4(cy + Math.sin(a) * r * sy)]);
  }
  return out;
}

/**
 * Control points sampled from any parametric curve (knots, rosettes, garlands …).
 * @param {(t: number) => number[]} fn t → [x, y]
 * @param {number} t0 @param {number} t1 parameter range
 * @param {number} n number of segments (n + 1 points)
 * @returns {number[][]}
 */
export function curve(fn, t0, t1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const [x, y] = fn(t0 + ((t1 - t0) * i) / n);
    out.push([r4(x), r4(y)]);
  }
  return out;
}

/** Unit "loop-the-loop" template: arrives heading +x, circles once on its left (−y) side, crosses its own approach and leaves heading +x. */
const LOOP_TEMPLATE = [[-1.55, 0.6], [-0.33, 0.64], [0.79, 0.39], [1.15, -0.27], [0.73, -0.85], [-0.12, -0.94], [-0.85, -0.7], [-1.15, -0.03], [-0.94, 0.73], [-0.3, 1.21], [0.6, 1.35]];

/**
 * Control points of a loop-the-loop (the path circles once and crosses its own approach).
 * @param {number} cx @param {number} cy loop centre
 * @param {number} size radius-ish scale (tiles)
 * @param {number} [headingDeg=0] travel direction (0 = +x, 90 = +y); the loop bulges to the left of travel
 * @param {boolean} [mirror=false] bulge to the right of travel instead
 * @returns {number[][]}
 */
export function loopNodes(cx, cy, size, headingDeg = 0, mirror = false) {
  const a = headingDeg * DEG;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return LOOP_TEMPLATE.map(([x, y]) => {
    const yy = mirror ? -y : y;
    return [r4(cx + (x * c - yy * s) * size), r4(cy + (x * s + yy * c) * size)];
  });
}

// ---------------------------------------------------------------------------
// Polyline helpers
// ---------------------------------------------------------------------------

/** Cumulative distances of a polyline. */
export function cumulative(points) {
  const cum = new Array(points.length);
  cum[0] = 0;
  for (let i = 1; i < points.length; i++) cum[i] = cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return cum;
}

/** Index i of the segment [i, i+1] containing distance d (binary search). */
export function segmentIndex(cum, d) {
  let lo = 0;
  let hi = cum.length - 2;
  if (hi <= 0) return 0;
  if (d <= cum[0]) return 0;
  if (d >= cum[hi]) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Point and unit tangent at distance d along a polyline.
 * @returns {{ x: number, y: number, dx: number, dy: number, i: number }}
 */
export function pointAtDistance(points, cum, d, out = {}) {
  const i = segmentIndex(cum, d);
  const a = points[i];
  const b = points[Math.min(points.length - 1, i + 1)];
  const len = cum[i + 1] - cum[i] || 1e-9;
  const t = Math.max(0, Math.min(1, (d - cum[i]) / len));
  out.x = a[0] + (b[0] - a[0]) * t;
  out.y = a[1] + (b[1] - a[1]) * t;
  out.dx = (b[0] - a[0]) / len;
  out.dy = (b[1] - a[1]) / len;
  out.i = i;
  return out;
}

/**
 * Nearest point of a polyline to (x, y).
 * @returns {{ x: number, y: number, d: number, dist: number, i: number }}
 */
export function nearestOnPolyline(points, cum, x, y) {
  let best = { x: points[0][0], y: points[0][1], d: 0, dist: Infinity, i: 0 };
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + dx * t;
    const py = ay + dy * t;
    const dist = Math.hypot(px - x, py - y);
    if (dist < best.dist) best = { x: px, y: py, d: cum[i] + Math.sqrt(l2) * t, dist, i };
  }
  return best;
}

/** Resamples a polyline every `step` along its length (first and last point kept). */
export function resample(points, step = TRACK_STEP) {
  if (points.length < 2) return points.map((p) => [p[0], p[1]]);
  const cum = cumulative(points);
  const L = cum[cum.length - 1];
  const n = Math.max(1, Math.round(L / step));
  const out = [];
  const tmp = {};
  for (let k = 0; k <= n; k++) {
    pointAtDistance(points, cum, (L * k) / n, tmp);
    out.push([tmp.x, tmp.y]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Spline sampling
// ---------------------------------------------------------------------------

function flattenNodes(nodes) {
  const flat = [];
  const walk = (list) => {
    for (const n of list) {
      if (Array.isArray(n) && Array.isArray(n[0])) walk(n);
      else flat.push(n);
    }
  };
  walk(nodes || []);
  return flat;
}

/** Splits a node list into control points, straight flags and tunnel markers. */
export function parseNodes(nodes) {
  const pts = [];
  const straight = [];
  const marks = [];
  for (const n of flattenNodes(nodes)) {
    if (typeof n === 'string') {
      if (!pts.length) throw new Error(`track marker '${n}' before the first point`);
      if (n === LINE) straight[pts.length - 1] = true;
      else if (n === TUNNEL_IN || n === TUNNEL_OUT) marks.push({ kind: n, at: pts.length - 1 });
      else throw new Error(`unknown track marker '${n}'`);
      continue;
    }
    if (!Array.isArray(n) || n.length < 2 || !Number.isFinite(n[0]) || !Number.isFinite(n[1])) throw new Error(`bad track node ${JSON.stringify(n)}`);
    const last = pts[pts.length - 1];
    if (last && Math.hypot(n[0] - last[0], n[1] - last[1]) < 1e-6) continue;
    pts.push([n[0], n[1]]);
  }
  return { pts, straight, marks };
}

const unit = (dx, dy) => {
  const l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
};

/**
 * Samples the curve through control points into a fine polyline.
 * Centripetal Catmull-Rom tangents (alpha 0.5, no cusps or self-loops inside a segment) in
 * Hermite form, so tangents can be overridden next to straights and at forks / joins.
 * @param {number[][]} pts control points
 * @param {boolean[]} straight straight[i] = segment i→i+1 is a straight
 * @param {number[]|null} startDir unit tangent forced at the first point
 * @param {number[]|null} endDir unit tangent forced at the last point
 * @returns {{ points: number[][], at: number[] }} fine polyline + index of every control point in it
 */
export function sampleSpline(pts, straight = [], startDir = null, endDir = null) {
  const n = pts.length;
  if (n === 0) return { points: [], at: [] };
  if (n === 1) return { points: [[pts[0][0], pts[0][1]]], at: [0] };
  const over = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (i > 0 && straight[i - 1]) over[i] = unit(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    else if (i < n - 1 && straight[i]) over[i] = unit(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  }
  if (startDir && !straight[0]) over[0] = unit(startDir[0], startDir[1]);
  if (endDir && !straight[n - 2]) over[n - 1] = unit(endDir[0], endDir[1]);
  const out = [[pts[0][0], pts[0][1]]];
  const at = [0];
  const P = (i) => pts[i];
  for (let i = 0; i < n - 1; i++) {
    const P1 = P(i);
    const P2 = P(i + 1);
    const chord = Math.hypot(P2[0] - P1[0], P2[1] - P1[1]);
    const steps = Math.max(6, Math.ceil(chord / 0.04));
    if (straight[i]) {
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        out.push([P1[0] + (P2[0] - P1[0]) * t, P1[1] + (P2[1] - P1[1]) * t]);
      }
      at.push(out.length - 1);
      continue;
    }
    const P0 = i > 0 ? P(i - 1) : [2 * P1[0] - P2[0], 2 * P1[1] - P2[1]];
    const P3 = i + 2 < n ? P(i + 2) : [2 * P2[0] - P1[0], 2 * P2[1] - P1[1]];
    const d01 = Math.max(1e-4, Math.sqrt(Math.hypot(P1[0] - P0[0], P1[1] - P0[1])));
    const d12 = Math.max(1e-4, Math.sqrt(chord));
    const d23 = Math.max(1e-4, Math.sqrt(Math.hypot(P3[0] - P2[0], P3[1] - P2[1])));
    let m1;
    let m2;
    if (over[i]) m1 = [over[i][0] * chord, over[i][1] * chord];
    else {
      m1 = [0, 1].map((k) => ((P1[k] - P0[k]) / d01 - (P2[k] - P0[k]) / (d01 + d12) + (P2[k] - P1[k]) / d12) * d12);
    }
    if (over[i + 1]) m2 = [over[i + 1][0] * chord, over[i + 1][1] * chord];
    else {
      m2 = [0, 1].map((k) => ((P2[k] - P1[k]) / d12 - (P3[k] - P1[k]) / (d12 + d23) + (P3[k] - P2[k]) / d23) * d12);
    }
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;
      out.push([
        h00 * P1[0] + h10 * m1[0] + h01 * P2[0] + h11 * m2[0],
        h00 * P1[1] + h10 * m1[1] + h01 * P2[1] + h11 * m2[1],
      ]);
    }
    at.push(out.length - 1);
  }
  return { points: out, at };
}

/** Resamples [from, to] of a fine polyline at TRACK_STEP (both ends kept). */
function resampleRange(points, cum, from, to, step) {
  const L = to - from;
  const n = Math.max(1, Math.round(L / step));
  const out = [];
  const tmp = {};
  for (let k = 0; k <= n; k++) {
    pointAtDistance(points, cum, from + (L * k) / n, tmp);
    out.push([tmp.x, tmp.y]);
  }
  return out;
}

/**
 * @typedef {{ points: number[][], cum: number[], length: number, tunnels: number[][],
 *   forkD: number, joinD: number, fork: {path: number, d: number}|null, join: {path: number, d: number}|null,
 *   elev: number[]|null, control: number[][] }} Track
 */

/**
 * Samples one path spec into a dense Track.
 * @param {Array|object} spec node list or { nodes, fork?, join? }
 * @param {Track[]} prior already built paths (forks / joins refer to them)
 * @param {{ step?: number }} [o]
 * @returns {Track}
 */
export function buildTrack(spec, prior = [], { step = TRACK_STEP } = {}) {
  const s = Array.isArray(spec) ? { nodes: spec } : spec || {};
  const { pts, straight, marks } = parseNodes(s.nodes || []);
  let startDir = null;
  let endDir = null;
  let prefix = [];
  let suffix = [];
  let fork = null;
  let join = null;
  let joinTarget = null;
  let joinNear = null;
  if (s.fork) {
    const parent = prior[s.fork.path];
    if (!parent) throw new Error(`fork from unknown path ${s.fork.path}`);
    const near = nearestOnPolyline(parent.points, parent.cum, s.fork.at[0], s.fork.at[1]);
    const t = pointAtDistance(parent.points, parent.cum, near.d);
    startDir = [t.dx, t.dy];
    for (let i = 0; i < parent.points.length && parent.cum[i] < near.d - 1e-6; i++) prefix.push([parent.points[i][0], parent.points[i][1]]);
    if (pts.length && Math.hypot(pts[0][0] - near.x, pts[0][1] - near.y) < 0.05) pts.shift();
    pts.unshift([near.x, near.y]);
    straight.unshift(false);
    for (const m of marks) m.at++;
    fork = { path: s.fork.path, d: near.d };
  }
  if (s.join) {
    joinTarget = prior[s.join.path];
    if (!joinTarget) throw new Error(`join into unknown path ${s.join.path}`);
    joinNear = nearestOnPolyline(joinTarget.points, joinTarget.cum, s.join.at[0], s.join.at[1]);
    const t = pointAtDistance(joinTarget.points, joinTarget.cum, joinNear.d);
    endDir = [t.dx, t.dy];
    if (pts.length && Math.hypot(pts[pts.length - 1][0] - joinNear.x, pts[pts.length - 1][1] - joinNear.y) < 0.05) pts.pop();
    pts.push([joinNear.x, joinNear.y]);
    for (let i = 0; i < joinTarget.points.length; i++) if (joinTarget.cum[i] > joinNear.d + 1e-6) suffix.push([joinTarget.points[i][0], joinTarget.points[i][1]]);
    join = { path: s.join.path, d: joinNear.d };
  }
  if (pts.length < 2) throw new Error('a track needs at least two points');
  const fine = sampleSpline(pts, straight, startDir, endDir);
  const fcum = cumulative(fine.points);
  const mid = resampleRange(fine.points, fcum, 0, fcum[fcum.length - 1], step);
  const points = [...prefix, ...mid, ...suffix];
  // drop accidental duplicates at the seams
  const clean = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const p = clean[clean.length - 1];
    if (Math.hypot(points[i][0] - p[0], points[i][1] - p[1]) > 1e-6) clean.push(points[i]);
  }
  const rounded = clean.map(([x, y]) => [r4(x), r4(y)]);
  const cum = cumulative(rounded);
  const prefixLen = prefix.length ? cumulative([...prefix, mid[0]]).pop() : 0;
  const midLen = cumulative(mid).pop();
  const tunnels = [];
  let open = null;
  for (const m of marks) {
    const d = prefixLen + fcum[fine.at[m.at]] * (midLen / (fcum[fcum.length - 1] || 1));
    if (m.kind === TUNNEL_IN) open = d;
    else if (open != null) {
      tunnels.push([open, d]);
      open = null;
    }
  }
  if (open != null) throw new Error('tunnel without an end marker');
  const length = cum[cum.length - 1];
  // shared sections inherit the parent's tunnels
  if (fork) {
    const parent = prior[fork.path];
    for (const [a, b] of parent.tunnels || []) if (a < fork.d) tunnels.push([a, Math.min(b, prefixLen)]);
  }
  if (join) {
    const shift = prefixLen + midLen - join.d;
    for (const [a, b] of joinTarget.tunnels || []) if (b > join.d) tunnels.push([Math.max(a, join.d) + shift, b + shift]);
  }
  tunnels.sort((p, q) => p[0] - q[0]);
  return {
    points: rounded,
    cum,
    length,
    tunnels: tunnels.map(([a, b]) => [r4(a), r4(b)]),
    forkD: fork ? r4(prefixLen) : 0,
    joinD: join ? r4(prefixLen + midLen) : r4(length),
    fork,
    join,
    elev: null,
    control: pts.map(([x, y]) => [r4(x), r4(y)]),
  };
}

/** Builds every path spec of a map in order (forks / joins may refer to earlier ones). */
export function buildTracks(specs) {
  const out = [];
  for (const spec of specs || []) out.push(buildTrack(spec, out));
  return out;
}

// ---------------------------------------------------------------------------
// Crossings and overpasses
// ---------------------------------------------------------------------------

/** Is distance d of this track part of a section it shares with another path (fork prefix / join suffix)? */
export function isShared(track, d, margin = 0) {
  if (track.fork && d < track.forkD + margin) return true;
  if (track.join && d > track.joinD - margin) return true;
  return false;
}

/**
 * Every place where the centreline crosses itself or another path (shared fork / join
 * sections excluded). Sorted by path then distance.
 * @param {Track[]} tracks
 * @returns {{ x: number, y: number, a: {path: number, d: number}, b: {path: number, d: number}, angle: number }[]}
 */
export function findCrossings(tracks) {
  const segs = [];
  const cells = new Map();
  tracks.forEach((t, ti) => {
    for (let i = 0; i < t.points.length - 1; i++) {
      const [ax, ay] = t.points[i];
      const [bx, by] = t.points[i + 1];
      const idx = segs.length;
      segs.push({ ti, i, ax, ay, bx, by, d: t.cum[i], len: t.cum[i + 1] - t.cum[i] });
      for (let cy = Math.floor(Math.min(ay, by)); cy <= Math.floor(Math.max(ay, by)); cy++) {
        for (let cx = Math.floor(Math.min(ax, bx)); cx <= Math.floor(Math.max(ax, bx)); cx++) {
          const key = cx * 4096 + cy;
          let list = cells.get(key);
          if (!list) cells.set(key, (list = []));
          list.push(idx);
        }
      }
    }
  });
  const tested = new Set();
  const raw = [];
  for (const list of cells.values()) {
    for (let p = 0; p < list.length; p++) {
      for (let q = p + 1; q < list.length; q++) {
        const A = segs[list[p]];
        const B = segs[list[q]];
        const key = list[p] < list[q] ? `${list[p]}:${list[q]}` : `${list[q]}:${list[p]}`;
        if (tested.has(key)) continue;
        tested.add(key);
        if (A.ti === B.ti && Math.abs(A.d - B.d) < 2.5) continue;
        const rx = A.bx - A.ax;
        const ry = A.by - A.ay;
        const sx = B.bx - B.ax;
        const sy = B.by - B.ay;
        const den = rx * sy - ry * sx;
        if (Math.abs(den) < 1e-12) continue;
        const qx = B.ax - A.ax;
        const qy = B.ay - A.ay;
        const t = (qx * sy - qy * sx) / den;
        const u = (qx * ry - qy * rx) / den;
        if (t < 0 || t >= 1 || u < 0 || u >= 1) continue;
        const da = A.d + A.len * t;
        const db = B.d + B.len * u;
        if (isShared(tracks[A.ti], da, 1) || isShared(tracks[B.ti], db, 1)) continue;
        let a = { path: A.ti, d: da };
        let b = { path: B.ti, d: db };
        if (a.path > b.path || (a.path === b.path && a.d > b.d)) [a, b] = [b, a];
        const cos = Math.abs((rx * sx + ry * sy) / (Math.hypot(rx, ry) * Math.hypot(sx, sy)));
        raw.push({ x: A.ax + rx * t, y: A.ay + ry * t, a, b, angle: Math.round(Math.acos(Math.min(1, cos)) / DEG) });
      }
    }
  }
  raw.sort((p, q) => p.a.path - q.a.path || p.a.d - q.a.d || p.b.path - q.b.path || p.b.d - q.b.d);
  const out = [];
  for (const c of raw) {
    const dup = out.find((o) => o.a.path === c.a.path && o.b.path === c.b.path && Math.abs(o.a.d - c.a.d) < 0.6 && Math.abs(o.b.d - c.b.d) < 0.6);
    if (!dup) out.push(c);
  }
  return out.map((c) => ({ x: r4(c.x), y: r4(c.y), a: { path: c.a.path, d: r4(c.a.d) }, b: { path: c.b.path, d: r4(c.b.d) }, angle: c.angle }));
}

/** Overpass height profile at |d - crossing| = u. */
export function bridgeProfile(u) {
  const a = Math.abs(u);
  if (a <= BRIDGE_FLAT) return 1;
  const t = (a - BRIDGE_FLAT) / BRIDGE_RAMP;
  if (t >= 1) return 0;
  const s = 1 - t;
  return s * s * (3 - 2 * s);
}

/**
 * Resolves every crossing into a flat junction or a bridge and writes the overpass elevation
 * profiles into the tracks (`track.elev`, one value per point, null when flat everywhere).
 * @param {Track[]} tracks
 * @param {object[]} crossings from findCrossings (mutated: gets `mode` and `over`)
 * @param {string|string[]} [modes='bridge'] one mode for all, or one per crossing:
 *   'bridge' (the later pass goes over), 'bridgeUnder' (the earlier pass goes over) or 'flat'.
 *   A crossing where one pass is inside a tunnel always becomes 'tunnel' (the other pass runs
 *   over the buried one; `over` names the surface pass).
 */
export function applyCrossings(tracks, crossings, modes = 'bridge') {
  crossings.forEach((c, k) => {
    const m = Array.isArray(modes) ? modes[k] ?? 'bridge' : modes;
    if (inTunnel(tracks[c.a.path], c.a.d) || inTunnel(tracks[c.b.path], c.b.d)) {
      // one pass is underground: the other simply runs over the tunnel
      c.mode = 'tunnel';
      c.over = inTunnel(tracks[c.a.path], c.a.d) ? 'b' : 'a';
      return;
    }
    c.mode = m === 'flat' ? 'flat' : 'bridge';
    c.over = c.mode === 'flat' ? null : m === 'bridgeUnder' ? 'a' : 'b';
  });
  for (const t of tracks) {
    t.elev = null;
    t.under = [];
  }
  for (const c of crossings) {
    if (c.mode !== 'bridge') continue;
    // the lower pass is under the deck for the deck's width (measured along the lower road)
    const low = c[c.over === 'a' ? 'b' : 'a'];
    const sin = Math.max(0.35, Math.sin((c.angle || 90) * DEG));
    const w = Math.min(1.6, DECK_HALF / sin);
    tracks[low.path].under.push([r4(Math.max(0, low.d - w)), r4(low.d + w)]);
    const pass = c[c.over];
    const t = tracks[pass.path];
    if (!t.elev) t.elev = new Array(t.points.length).fill(0);
    for (let i = 0; i < t.points.length; i++) {
      const u = t.cum[i] - pass.d;
      if (Math.abs(u) > BRIDGE_FLAT + BRIDGE_RAMP) continue;
      t.elev[i] = Math.max(t.elev[i], r4(BRIDGE_HEIGHT * bridgeProfile(u)));
    }
  }
  // shared fork prefixes / join suffixes follow their parent's elevation
  tracks.forEach((t) => {
    for (const [link, from, to] of [[t.fork, 0, t.forkD], [t.join, t.joinD, t.length]]) {
      if (!link) continue;
      const p = tracks[link.path];
      if (!p.elev) continue;
      if (!t.elev) t.elev = new Array(t.points.length).fill(0);
      const off = link === t.fork ? 0 : link.d - t.joinD;
      for (let i = 0; i < t.points.length; i++) {
        const d = t.cum[i];
        if (d < from - 1e-6 || d > to + 1e-6) continue;
        t.elev[i] = Math.max(t.elev[i], elevationAt(p, d + off));
      }
    }
  });
  // … and the parent's under-deck spans
  tracks.forEach((t) => {
    if (t.fork) for (const [a, b] of tracks[t.fork.path].under) if (a < t.forkD) t.under.push([a, Math.min(b, t.forkD)]);
    if (t.join) {
      const shift = t.joinD - t.join.d;
      for (const [a, b] of tracks[t.join.path].under) if (b > t.join.d) t.under.push([r4(Math.max(a, t.join.d) + shift), r4(b + shift)]);
    }
    t.under.sort((p, q) => p[0] - q[0]);
  });
  for (const c of crossings) {
    if (c.mode !== 'bridge') continue;
    const under = c[c.over === 'a' ? 'b' : 'a'];
    if (elevationAt(tracks[under.path], under.d) > 0.05) {
      throw new Error(`crossing at (${c.x.toFixed(2)}, ${c.y.toFixed(2)}): the lower pass is itself on a bridge ramp`);
    }
  }
  return crossings;
}

/** Overpass elevation of a track at distance d (0 on the ground). */
export function elevationAt(track, d) {
  const e = track.elev;
  if (!e) return 0;
  const i = segmentIndex(track.cum, d);
  const j = Math.min(e.length - 1, i + 1);
  const len = track.cum[j] - track.cum[i] || 1;
  const t = Math.max(0, Math.min(1, (d - track.cum[i]) / len));
  return e[i] + (e[j] - e[i]) * t;
}

/** Is distance d of this track under an overpass deck (drawn hidden by the renderer, still targetable)? */
export function underDeck(track, d) {
  for (const [a, b] of track.under || []) if (d >= a && d <= b) return true;
  return false;
}

/** Is distance d inside one of the track's tunnels? */
export function inTunnel(track, d) {
  for (const [a, b] of track.tunnels || []) if (d >= a && d <= b) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Rasterising the band into tiles
// ---------------------------------------------------------------------------

/** Distance from point to an axis-aligned box. */
function pointBoxDist(px, py, x0, y0, x1, y1) {
  const dx = Math.max(x0 - px, 0, px - x1);
  const dy = Math.max(y0 - py, 0, py - y1);
  return Math.hypot(dx, dy);
}

function pointSegDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(ax + dx * t - px, ay + dy * t - py);
}

/** Does segment AB intersect the box (Liang–Barsky)? */
function segHitsBox(ax, ay, bx, by, x0, y0, x1, y1) {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  const clip = (p, q) => {
    if (Math.abs(p) < 1e-12) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return clip(-dx, ax - x0) && clip(dx, x1 - ax) && clip(-dy, ay - y0) && clip(dy, y1 - ay) && t0 <= t1;
}

/** Minimum distance between segment AB and the box. */
export function segBoxDist(ax, ay, bx, by, x0, y0, x1, y1) {
  if (segHitsBox(ax, ay, bx, by, x0, y0, x1, y1)) return 0;
  return Math.min(
    pointBoxDist(ax, ay, x0, y0, x1, y1),
    pointBoxDist(bx, by, x0, y0, x1, y1),
    pointSegDist(x0, y0, ax, ay, bx, by),
    pointSegDist(x1, y0, ax, ay, bx, by),
    pointSegDist(x0, y1, ax, ay, bx, by),
    pointSegDist(x1, y1, ax, ay, bx, by),
  );
}

/**
 * Every tile whose square the band (half-width `half` around the polyline) intersects.
 * @param {number[][]} points world polyline
 * @param {number} [half=STAMP_HALF_WIDTH]
 * @param {Set<string>} [into]
 * @returns {Set<string>} "tx,ty" keys (tiles off the board included)
 */
export function stampBand(points, half = STAMP_HALF_WIDTH, into = new Set()) {
  const done = new Set();
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    const tx0 = Math.floor(Math.min(ax, bx) - half);
    const tx1 = Math.floor(Math.max(ax, bx) + half);
    const ty0 = Math.floor(Math.min(ay, by) - half);
    const ty1 = Math.floor(Math.max(ay, by) + half);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const key = `${tx},${ty}`;
        if (done.has(key)) continue;
        if (segBoxDist(ax, ay, bx, by, tx, ty, tx + 1, ty + 1) < half - 1e-9) {
          done.add(key);
          into.add(key);
        }
      }
    }
  }
  if (points.length === 1) into.add(`${Math.floor(points[0][0])},${Math.floor(points[0][1])}`);
  return into;
}

/** Union of the stamped tiles of every track. */
export function stampTracks(tracks, half = STAMP_HALF_WIDTH) {
  const set = new Set();
  for (const t of tracks || []) stampBand(t.points, half, set);
  return set;
}

/**
 * Builds the complete track bundle of a map: dense tracks, crossings (with modes applied) and
 * the stamped tile set.
 * @param {Array} specs path specs
 * @param {string|string[]} [crossingModes]
 */
export function buildMapTracks(specs, crossingModes = 'bridge') {
  const tracks = buildTracks(specs);
  const crossings = applyCrossings(tracks, findCrossings(tracks), crossingModes);
  return { tracks, crossings, tiles: stampTracks(tracks) };
}

/**
 * Track view of a legacy MapDef whose `paths` are orthogonal tile waypoints (no `tracks`):
 * straight polylines through tile centres. Lets old fixtures keep working.
 */
export function legacyTracks(paths) {
  return (paths || []).map((wps) => {
    const points = [];
    for (const [x, y] of wps || []) {
      const p = [x + 0.5, y + 0.5];
      const last = points[points.length - 1];
      if (!last || last[0] !== p[0] || last[1] !== p[1]) points.push(p);
    }
    if (points.length === 1) points.push([points[0][0] + 1, points[0][1]]);
    const cum = cumulative(points);
    return { points, cum, length: cum[cum.length - 1], tunnels: [], forkD: 0, joinD: cum[cum.length - 1], fork: null, join: null, elev: null, control: points };
  });
}

/** The map's tracks (MapDef.tracks, or the legacy waypoint view). */
export function mapTracks(map) {
  if (map?.tracks?.length) return map.tracks;
  return legacyTracks(map?.paths);
}

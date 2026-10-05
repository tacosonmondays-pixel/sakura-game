// Path geometry: MapDef waypoints (tile coords) → world polylines through tile centres,
// distance → position lookups, path tile stamping and sampling helpers.

/**
 * @typedef {{ index: number, points: number[][], cum: number[], length: number,
 *   dirs: number[][], facings: number[] }} PathData
 */

/**
 * Builds a polyline from tile waypoints. World point = tile centre (x + 0.5, y + 0.5).
 * @param {number[][]} waypoints [[x, y], ...]
 * @param {number} index
 * @returns {PathData}
 */
export function buildPath(waypoints, index = 0) {
  const points = [];
  for (const wp of waypoints || []) {
    const x = wp[0] + 0.5;
    const y = wp[1] + 0.5;
    const last = points[points.length - 1];
    if (last && last[0] === x && last[1] === y) continue;
    points.push([x, y]);
  }
  if (points.length === 1) points.push([points[0][0] + 1, points[0][1]]);
  const cum = [0];
  const dirs = [];
  const facings = [];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    const len = Math.hypot(dx, dy) || 1e-6;
    cum.push(cum[i - 1] + len);
    dirs.push([dx / len, dy / len]);
    facings.push(Math.atan2(dx, dy));
  }
  return { index, points, cum, length: cum[cum.length - 1], dirs, facings };
}

/** @param {{ paths: number[][][] }} map @returns {PathData[]} */
export function buildPaths(map) {
  return (map.paths || []).map((wps, i) => buildPath(wps, i));
}

/**
 * Finds the segment containing distance `d`, starting the search at `hint`.
 * @returns {number} segment index (0-based, between points[i] and points[i+1])
 */
export function segmentAt(path, d, hint = 0) {
  const { cum } = path;
  const last = cum.length - 2;
  let i = Math.max(0, Math.min(hint, last));
  while (i < last && d > cum[i + 1]) i++;
  while (i > 0 && d < cum[i]) i--;
  return i;
}

/**
 * Position at distance `d` along the path. Writes into `out` ({ x, y, facing, seg }).
 * Facing is atan2(dx, dy) so it can be used directly as a three.js rotation.y
 * (models face +z; sim y maps to world z).
 */
export function pointAt(path, d, out = {}, hint = 0) {
  const dd = Math.max(0, Math.min(d, path.length));
  const seg = segmentAt(path, dd, hint);
  const p = path.points[seg];
  const dir = path.dirs[seg];
  const t = dd - path.cum[seg];
  out.x = p[0] + dir[0] * t;
  out.y = p[1] + dir[1] * t;
  out.facing = path.facings[seg];
  out.seg = seg;
  return out;
}

/**
 * Tiles covered by the paths, as a Set of "x,y" strings. Stamps every tile on each
 * segment between consecutive waypoints (including tiles just outside the grid, where
 * spawns/exits live). Non-orthogonal segments are stamped with a DDA walk.
 * @param {{ paths: number[][][] }} map
 * @returns {Set<string>}
 */
export function pathTileSet(map) {
  const set = new Set();
  for (const wps of map.paths || []) {
    for (let i = 0; i < wps.length; i++) {
      const [x0, y0] = wps[i];
      if (i === 0) set.add(`${x0},${y0}`);
      if (i === 0) continue;
      const [px, py] = wps[i - 1];
      const steps = Math.max(Math.abs(x0 - px), Math.abs(y0 - py));
      for (let s = 1; s <= steps; s++) {
        const x = Math.round(px + ((x0 - px) * s) / steps);
        const y = Math.round(py + ((y0 - py) * s) / steps);
        set.add(`${x},${y}`);
      }
    }
  }
  return set;
}

/**
 * Samples a path every `step` tiles. @returns {{ x, y, d, pathIndex }[]}
 */
export function samplePath(path, step = 0.25) {
  const out = [];
  const tmp = {};
  for (let d = 0; d <= path.length; d += step) {
    pointAt(path, d, tmp);
    out.push({ x: tmp.x, y: tmp.y, d, pathIndex: path.index });
  }
  return out;
}

/** Squared distance from point (px, py) to segment (ax, ay)-(bx, by). */
export function segDistSq(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + dx * t - px;
  const cy = ay + dy * t - py;
  return cx * cx + cy * cy;
}

/** Projection parameter of point onto segment (unclamped, in segment-length units). */
export function projectOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1e-6;
  return ((px - ax) * dx + (py - ay) * dy) / len;
}

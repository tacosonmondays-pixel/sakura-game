// Path geometry for the sim: the map's canonical dense centrelines (MapDef.tracks, built once by
// src/core/track.js — the same points the renderer draws) → PathData with distance lookups,
// tunnels and overpass elevation; plus path tile stamping and sampling helpers.
// Legacy MapDefs without `tracks` (old orthogonal tile waypoints in tests) still work.

import { mapTracks, stampTracks, legacyTracks, inTunnel, elevationAt } from '../core/track.js';

/**
 * @typedef {{ index: number, points: number[][], cum: number[], length: number,
 *   dirs: number[][], facings: number[], tunnels: number[][], elev: number[]|null,
 *   track: object }} PathData
 */

/**
 * Wraps a track (dense world polyline) as PathData.
 * @param {{ points: number[][], tunnels?: number[][], elev?: number[]|null }} track
 * @param {number} index
 * @returns {PathData}
 */
export function pathFromTrack(track, index = 0) {
  const points = [];
  const keep = [];
  (track.points || []).forEach((p, i) => {
    const last = points[points.length - 1];
    if (last && last[0] === p[0] && last[1] === p[1]) return;
    points.push([p[0], p[1]]);
    keep.push(i);
  });
  if (points.length === 1) {
    points.push([points[0][0] + 1, points[0][1]]);
    keep.push(keep[0]);
  }
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
  const elev = track.elev ? keep.map((k) => track.elev[k] || 0) : null;
  const tunnels = (track.tunnels || []).map(([a, b]) => [a, b]);
  return { index, points, cum, length: cum[cum.length - 1], dirs, facings, tunnels, elev, track: { points, cum, tunnels, elev } };
}

/**
 * Builds a polyline from legacy tile waypoints. World point = tile centre (x + 0.5, y + 0.5).
 * @param {number[][]} waypoints [[x, y], ...]
 * @param {number} index
 * @returns {PathData}
 */
export function buildPath(waypoints, index = 0) {
  return pathFromTrack(legacyTracks([waypoints])[0], index);
}

/** @param {{ tracks?: object[], paths?: number[][][] }} map @returns {PathData[]} */
export function buildPaths(map) {
  return mapTracks(map).map((t, i) => pathFromTrack(t, i));
}

/**
 * Finds the segment containing distance `d`, starting the search at `hint`.
 * @returns {number} segment index (0-based, between points[i] and points[i+1])
 */
export function segmentAt(path, d, hint = 0) {
  const { cum } = path;
  const last = cum.length - 2;
  let i = Math.max(0, Math.min(hint, last));
  if (Math.abs(cum[i] - d) > 4) {
    // far jump (knockback, blink, fresh spawn): binary search
    let lo = 0;
    let hi = last;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (cum[mid] <= d) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }
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

/** Is distance d inside one of the path's tunnels (enemies hidden + untargetable)? */
export function pathInTunnel(path, d) {
  return path.tunnels?.length ? inTunnel(path, d) : false;
}

/** Overpass elevation at distance d (0 on the ground). */
export function pathElevation(path, d) {
  return path.elev ? elevationAt(path.track, d) : 0;
}

/**
 * Tiles covered by the paths, as a Set of "x,y" strings: every tile whose square the road
 * band touches (curves and diagonals rasterised exactly), including tiles just outside the
 * grid where spawns/exits live. Same set as maps.js pathTiles().
 * @param {{ tracks?: object[], paths?: number[][][] }} map
 * @returns {Set<string>}
 */
export function pathTileSet(map) {
  return stampTracks(mapTracks(map));
}

/**
 * Samples a path every `step` tiles. @returns {{ x, y, d, pathIndex, hidden }[]}
 * (`hidden` = inside a tunnel, where towers cannot see the enemies)
 */
export function samplePath(path, step = 0.25) {
  const out = [];
  const tmp = {};
  for (let d = 0; d <= path.length; d += step) {
    pointAt(path, d, tmp);
    out.push({ x: tmp.x, y: tmp.y, d, pathIndex: path.index, hidden: pathInTunnel(path, d) });
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

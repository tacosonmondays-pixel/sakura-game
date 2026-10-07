// Free (Bloons-style) placement geometry. Girls stand at continuous world positions and
// own a circular footprint; nothing snaps to tiles. Pure functions — shared by Sim.canPlace,
// headless.autoPlan, the renderer's forbidden-zone overlay and the tests.
//
// A spot (x, y) is legal for a unit with footprint radius r when
//   * the centre is inside the map rectangle                       (else 'outOfBounds')
//   * no other girl's footprint overlaps: dist >= r + r2          (else 'occupied')
//   * the footprint stays off the path band: dist(path) >= PATH_HALF_WIDTH + r   (else 'path')
//   * it clears map obstacles: trees (discs), rocks / buildings / void (tile squares)  (else 'blocked')
//   * the terrain under the CENTRE matches her placement type ('~' / 'B' water, '.' / ',' land)
//     (else 'needsWater' / 'needsLand'; amphibious girls take either)
// Bridges are path tiles: the band excludes the road itself, and the open water of a 'B' tile
// the curved road only grazes still takes water girls.

import { segDistSq } from './path.js';
import { BAND_HALF_WIDTH } from '../core/track.js';

/** Footprint radius (tiles) of an ordinary tower. */
export const TOWER_RADIUS = 0.42;
/** Footprint radius (tiles) of a hero (bigger model). */
export const HERO_RADIUS = 0.5;
/** Half-width of the forbidden band around every path centre line (tiles). */
export const PATH_HALF_WIDTH = BAND_HALF_WIDTH; // 0.55
/** Trees block a disc of this radius around their tile centre. */
export const TREE_RADIUS = 0.45;

/** Terrain characters that block placement as a full tile square. */
const SQUARE_BLOCKERS = { R: true, H: true, X: true };

/**
 * Footprint radius for a unit definition.
 * @param {{ kind?: string, footprint?: number }|null|undefined} def UnitDef (an explicit `footprint` wins)
 * @returns {number}
 */
export function footprintRadius(def) {
  if (def && Number.isFinite(def.footprint) && def.footprint > 0) return def.footprint;
  return def?.kind === 'hero' ? HERO_RADIUS : TOWER_RADIUS;
}

/** Legacy tile call → tile centre. Both coordinates integers = a (tx, ty) tile. */
export function isTileCall(x, y) {
  return Number.isInteger(x) && Number.isInteger(y);
}

/**
 * Builds the static placement geometry of a map.
 * @param {{ width: number, height: number, rows?: string[] }} map MapDef
 * @param {{ points: number[][] }[]} pathData world-space polylines (buildPaths(map))
 */
export function createPlacementRules(map, pathData) {
  const W = map.width || 0;
  const H = map.height || 0;
  const rows = map.rows || [];
  const segs = [];
  for (const p of pathData || []) {
    const pts = p.points || p;
    for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]]);
  }

  /** Terrain char at a tile ('X' outside the map). */
  const charAt = (tx, ty) => {
    const row = rows[ty];
    if (!row || tx < 0 || tx >= row.length) return 'X';
    return row[tx];
  };

  // Dense curved centrelines have hundreds of short segments: bucket them in 1-tile cells
  // (each segment registered in every cell its bbox ± REACH touches). A query only scans its
  // own cell; a hit closer than REACH is exact, otherwise it falls back to the full scan.
  const REACH = 2.5;
  const buckets = new Map();
  segs.forEach((s, i) => {
    const x0 = Math.floor(Math.min(s[0], s[2]) - REACH);
    const x1 = Math.floor(Math.max(s[0], s[2]) + REACH);
    const y0 = Math.floor(Math.min(s[1], s[3]) - REACH);
    const y1 = Math.floor(Math.max(s[1], s[3]) + REACH);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const key = cx * 8192 + cy;
        let list = buckets.get(key);
        if (!list) buckets.set(key, (list = []));
        list.push(i);
      }
    }
  });

  /** Distance from a point to the nearest path centre line. */
  const pathDistance = (x, y) => {
    let best = Infinity;
    const list = buckets.get(Math.floor(x) * 8192 + Math.floor(y));
    if (list) {
      for (let k = 0; k < list.length; k++) {
        const s = segs[list[k]];
        const d = segDistSq(x, y, s[0], s[1], s[2], s[3]);
        if (d < best) best = d;
      }
      if (best <= REACH * REACH) return Math.sqrt(best);
    }
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const d = segDistSq(x, y, s[0], s[1], s[2], s[3]);
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  };

  /**
   * Distance from a point to the nearest obstacle surface (0 when inside one). Only tiles
   * inside the map count — the board edge is handled by 'outOfBounds'.
   */
  const obstacleDistance = (x, y) => {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    let best = Infinity;
    for (let ty = cy - 1; ty <= cy + 1; ty++) {
      if (ty < 0 || ty >= H) continue;
      for (let tx = cx - 1; tx <= cx + 1; tx++) {
        if (tx < 0 || tx >= W) continue;
        const ch = charAt(tx, ty);
        let d;
        if (ch === 'T') d = Math.hypot(x - (tx + 0.5), y - (ty + 0.5)) - TREE_RADIUS;
        else if (SQUARE_BLOCKERS[ch]) {
          const dx = Math.max(tx - x, 0, x - (tx + 1));
          const dy = Math.max(ty - y, 0, y - (ty + 1));
          d = Math.hypot(dx, dy);
        } else continue;
        if (d < best) best = d;
      }
    }
    return Math.max(0, best);
  };

  const terrainAt = (x, y) => charAt(Math.floor(x), Math.floor(y));
  const inBounds = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

  /**
   * Geometry-only check (no cash / loadout / hero rules).
   * @param {object} def UnitDef (placement + kind)
   * @param {number} x @param {number} y footprint centre (world tiles)
   * @param {{ x: number, y: number, radius?: number }[]} others footprints already on the board
   * @returns {null|'outOfBounds'|'occupied'|'path'|'blocked'|'needsWater'|'needsLand'}
   */
  const check = (def, x, y, others = []) => {
    if (!inBounds(x, y)) return 'outOfBounds';
    const r = footprintRadius(def);
    for (let i = 0; i < others.length; i++) {
      const o = others[i];
      const rr = r + (o.radius ?? TOWER_RADIUS);
      const dx = o.x - x;
      const dy = o.y - y;
      if (dx * dx + dy * dy < rr * rr - 1e-9) return 'occupied';
    }
    if (pathDistance(x, y) < PATH_HALF_WIDTH + r - 1e-9) return 'path';
    if (obstacleDistance(x, y) < r - 1e-9) return 'blocked';
    const ch = terrainAt(x, y);
    // 'B' = a water tile the road crosses or grazes: off the band it is still open water
    const water = ch === '~' || ch === 'B';
    const land = ch === '.' || ch === ',';
    if (!water && !land) return 'blocked';
    const placement = def?.placement || 'land';
    if (placement === 'water' && !water) return 'needsWater';
    if (placement === 'land' && !land) return 'needsLand';
    return null;
  };

  return { width: W, height: H, segments: segs, charAt, pathDistance, obstacleDistance, terrainAt, inBounds, check };
}

/**
 * Nearest footprint containing the point, or null.
 * @param {{ x: number, y: number, radius?: number }[]} towers
 */
export function footprintAt(towers, x, y) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < towers.length; i++) {
    const t = towers[i];
    const r = t.radius ?? TOWER_RADIUS;
    const dx = t.x - x;
    const dy = t.y - y;
    const d = dx * dx + dy * dy;
    if (d <= r * r && d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

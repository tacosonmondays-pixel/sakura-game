// City kit (Gate Arc, Noon `city` theme): what a `look.city` board adds on top of the usual
// terrain (terrain.js calls these when the theme has a `city` block):
//
//   • cityBuildingFor / cityWallVariant: which building stands on each H tile (shop fronts and
//     shop rows on the street, apartments and offices behind; every on-board building is low,
//     BOARD_MAX_H), which wall on the border,
//   • raised kerbs and sidewalks along every road on the ground (high and medium; the painted
//     sidewalk under them carries low quality), crosswalks, stop lines and box markings (ground
//     marks drawn by the ambient batches: 0 draw calls),
//   • street furniture: traffic signals at the corners, utility poles with a lamp arm along the
//     roads and the overhead wires between them (pigeons sitting on a few spans), a cat napping
//     on a wall, subway signs at tunnel mouths,
//   • the skyline in the skirt (tall at the back, low in front so the board stays clear),
//   • a railway with level crossings where a road crosses it, only where the map places one
//     (map.city.railway): the battle frames the board tightly between the HUD and the tower bar,
//     so a rail behind the board is only seen in the thin strip just past its far edge,
//   • up to three instanced movers (one draw call each): the commuter train every 40 s (with the
//     railway), a water-bus on the canal, and Brigade patrol drones circling high over the side
//     skirts — dressing only: they never fire, never target anything and never hang over the
//     board or a road, so they cannot be read as monsters or cover a gate (GATE_ARC §7.3, §18.5),
//   • the lane schedule (Gate Arc S1c): each level crossing guards the lane whose road crosses the
//     line (an underpass or a deck has none); setLanes(open) lowers the barrier arms of closed
//     lanes, blinks their lamps and runs the train through while one is closed (on a line with
//     crossings the train only runs then). The arms live in the facade mesh (armsPart, appended
//     last by terrain.js) and are re-posed on the CPU only while they swing: 0 extra draw calls,
//   • rooftops (Gate Arc S1c): buildRoofs draws one flat-roofed block ROOF_Y tall under each
//     connected region of 'U' tiles (walls and a parapet on its outline only, a little dressing),
//     into the same facade mesh; terrain.js calls it on every theme.
//
// Static geometry goes into the terrain's shared meshes (props, foliage, glow props and the one
// facade mesh), so the kit adds one draw call (the facade) plus the movers. Nothing is
// transparent. Deterministic per map id (no Math.random).
import * as THREE from 'three';
import { makeRand, hash } from '../geo.js';
import { CityAcc, FK, createFacadeMaterial } from './cityMaterials.js';
import { CITY_BUILDERS, CITY_VARIANTS, wire, trainCarGeometry, droneGeometry, ROOF_Y, CROSSING_ARM } from './cityProps.js';
import { prim } from './buildings.js';

export { ROOF_Y };
import { crosswalkMarks } from '../groundFeatures.js';

const PATH_H = 0.05;
/** Sidewalk: from the road edge out to SW_OUT, top at SW_Y (the kerb is the step up from the road). */
export const SW_IN = 0.47;
export const SW_OUT = 0.84;
export const SW_Y = 0.07;
const KERB = 0.06;
/** Height of the overhead wires on the utility poles. */
const WIRE_Y = 1.46;
/** Train: cars, car length, period (s) and the part of it spent crossing. */
const TRAIN = { cars: 5, len: 1.24, period: 40, run: 0.32 };
/** While a lane schedule holds a crossing shut: a pass takes `pass` s, the next follows `gap` s later, the first `lead` s after the arms start down. */
const BUSY = { pass: 6.4, gap: 4.5, lead: 1.3 };
/** Barrier arm: up angle (rad, about the hub) and swing speed (rad/s). */
const ARM_UP = Math.PI / 2;
const ARM_SPEED = 2.4;

/**
 * Connected rooftop regions of a map ('U' tiles, 4-neighbour), in reading order.
 * @param {{ rows: string[] }} map
 * @returns {{ tiles: number[][] }[]}
 */
export function roofRegions(map) {
  const rows = map.rows || [];
  const seen = new Set();
  const out = [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      if (rows[y][x] !== 'U' || seen.has(`${x},${y}`)) continue;
      const tiles = [];
      const stack = [[x, y]];
      seen.add(`${x},${y}`);
      while (stack.length) {
        const [tx, ty] = stack.pop();
        tiles.push([tx, ty]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = tx + dx;
          const ny = ty + dy;
          if (rows[ny]?.[nx] === 'U' && !seen.has(`${nx},${ny}`)) {
            seen.add(`${nx},${ny}`);
            stack.push([nx, ny]);
          }
        }
      }
      tiles.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      out.push({ tiles });
    }
  }
  return out;
}

/**
 * The blocks under the rooftops ('U' tiles): per connected region one flat roof ROOF_Y high, its
 * shop or flat walls and a low parapet on the region's outline only (no seams between its tiles,
 * so a girl may stand across them), and a little dressing in a corner (an AC unit; a water tank on
 * bigger roofs). Facade geometry into `acc`; deterministic per map.
 * @param {object} map MapDef
 * @param {CityAcc} acc facade accumulator
 * @param {{ quality?: string }} [o]
 * @returns {{ regions: number, tiles: number }}
 */
export function buildRoofs(map, acc, { quality = 'high' } = {}) {
  const regions = roofRegions(map);
  const isRoof = (x, y) => map.rows[y]?.[x] === 'U';
  const T = 0.035;
  const PH = 0.05;
  let tiles = 0;
  regions.forEach((reg, ri) => {
    const h = hash(map.id, 'roof', reg.tiles[0][0], reg.tiles[0][1]);
    const flats = h % 2 === 1;
    const side = flats ? FK.flats : FK.shop;
    const wall = flats ? '#efe7da' : '#e9d9bf';
    const top = ['#cfc8bb', '#c9c2b6', '#d3cdc2'][h % 3];
    for (const [x, y] of reg.tiles) {
      tiles++;
      // the roof surface
      acc.quad([x, ROOF_Y, y + 1], [x + 1, ROOF_Y, y + 1], [x + 1, ROOF_Y, y], [x, ROOF_Y, y], top, 0);
      const H = ROOF_Y;
      // walls and parapet on the outline: north (-z), south (+z), west (-x), east (+x)
      if (!isRoof(x, y - 1)) {
        acc.quad([x + 1, 0, y], [x, 0, y], [x, H, y], [x + 1, H, y], wall, side, [[x + 1, 0], [x, 0], [x, H], [x + 1, H]]);
        acc.box(x + 0.5, H, y + T / 2, 1, PH, T, { color: PAL_PARAPET });
      }
      if (!isRoof(x, y + 1)) {
        acc.quad([x, 0, y + 1], [x + 1, 0, y + 1], [x + 1, H, y + 1], [x, H, y + 1], wall, side, [[x, 0], [x + 1, 0], [x + 1, H], [x, H]]);
        acc.box(x + 0.5, H, y + 1 - T / 2, 1, PH, T, { color: PAL_PARAPET });
      }
      if (!isRoof(x - 1, y)) {
        acc.quad([x, 0, y], [x, 0, y + 1], [x, H, y + 1], [x, H, y], wall, side, [[y, 0], [y + 1, 0], [y + 1, H], [y, H]]);
        acc.box(x + T / 2, H, y + 0.5, T, PH, 1, { color: PAL_PARAPET });
      }
      if (!isRoof(x + 1, y)) {
        acc.quad([x + 1, 0, y + 1], [x + 1, 0, y], [x + 1, H, y], [x + 1, H, y + 1], wall, side, [[y + 1, 0], [y, 0], [y, H], [y + 1, H]]);
        acc.box(x + 1 - T / 2, H, y + 0.5, T, PH, 1, { color: PAL_PARAPET });
      }
    }
    if (quality === 'low') return;
    // dressing tucked into the first tile's outer corner (a girl's footprint stays clear of the edge
    // band, so it seldom meets her), and a water tank in the last tile's on a roof of 3+ tiles
    const [ax, ay] = reg.tiles[0];
    const cx = !isRoof(ax - 1, ay) ? ax + 0.17 : ax + 0.83;
    const cz = !isRoof(ax, ay - 1) ? ay + 0.15 : ay + 0.85;
    acc.box(cx, ROOF_Y, cz, 0.18, 0.1, 0.13, { color: '#e9e6df' });
    acc.box(cx, ROOF_Y + 0.1, cz, 0.12, 0.012, 0.09, { color: '#9aa3ae' });
    if (reg.tiles.length >= 3) {
      const [bx, by] = reg.tiles[reg.tiles.length - 1];
      const tx = !isRoof(bx + 1, by) ? bx + 0.82 : bx + 0.18;
      const tz = !isRoof(bx, by + 1) ? by + 0.82 : by + 0.18;
      prim(acc, new THREE.CylinderGeometry(0.075, 0.075, 0.15, 7), { x: tx, y: ROOF_Y + 0.075, z: tz }, ri % 2 ? '#cfd6dc' : '#d8d2c4');
    }
  });
  return { regions: regions.length, tiles };
}

const PAL_PARAPET = '#f1ede4';

/**
 * Which building stands on an interior H tile: shops along the street (shopFront, the shop-row
 * and corner kinds of cityBlock), homes and offices one row back. Every kind is ≤ BOARD_MAX_H.
 * @param {object} map MapDef
 * @param {number} x tile
 * @param {number} y tile
 * @param {(x: number, y: number) => boolean} isPath
 * @returns {{ type: string, variant: number }}
 */
export function cityBuildingFor(map, x, y, isPath) {
  let d = 9;
  for (let r = 1; r <= 3 && d === 9; r++) {
    for (let dy = -r; dy <= r && d === 9; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && isPath(x + dx, y + dy)) {
          d = r;
          break;
        }
      }
    }
  }
  const h = hash(map.id, 'block', x, y);
  const roll = h % 100;
  if (d <= 1) {
    // on the street: mostly shop fronts, now and then a shop row, a convenience store, a clinic,
    // a police box or a small office
    if (roll < 52) return { type: 'shopFront', variant: (h >>> 8) % CITY_VARIANTS.shopFront };
    if (roll < 68) return { type: 'cityBlock', variant: 0 };
    if (roll < 78) return { type: 'cityBlock', variant: 3 };
    if (roll < 86) return { type: 'cityBlock', variant: 4 };
    if (roll < 91) return { type: 'cityBlock', variant: 5 };
    return { type: 'cityBlock', variant: 2 };
  }
  // one row back: apartments and offices
  return { type: 'cityBlock', variant: roll < 62 ? 1 : 2 };
}

/** Which cityWall a border H tile gets (retaining wall + hedge, construction fence, brick wall). */
export function cityWallVariant(map, x, y) {
  return hash(map.id, 'wall', x, y) % CITY_VARIANTS.cityWall;
}

/** Top of each cityWall variant (where a cat can sit), null when there is no ledge. */
const WALL_TOP = [0.27, null, 0.375];

/**
 * Builds the city layer of a `look.city` board.
 * @param {object} o
 * @param {object} o.map MapDef (map.city: optional render hints { railway: { z }, waterBus: { z, x0, x1 }, areas, goalGate, goalVariant };
 *   no railway unless the map gives one: z ≈ -1.2…-0.5 is the strip the battle shows past the board's far edge)
 * @param {object} o.look resolved look (look.city)
 * @param {object} o.plan planRoads() result
 * @param {(x: number, y: number) => boolean} o.isPath tile on a road
 * @param {(x: number, y: number) => boolean} o.isWater tile is water (board and skirt)
 * @param {Set<string>} o.occupied tiles with a prop (the kit adds its own)
 * @param {object[]} o.gates terrain gate markers ({ kind, x, z, dir })
 * @param {object[]} o.portals tunnel portals ({ x, z, dir, end })
 * @param {Function} o.place terrain prop placer (type, x, y, z, ry, s, variant, target, lod)
 * @param {THREE.BufferGeometry[]} o.facadeParts the terrain's facade parts (merged into one mesh)
 * @param {string} [o.quality]
 * @param {number} [o.margin] how far the terrain reaches outside the board
 * @param {THREE.Material} [o.facadeMaterial] the terrain's facade material (shared by the movers)
 * @returns {{ meshes: THREE.Mesh[], glows: object[], marks: object[], furniture: number[][], flyers: { x: number, y: number, z: number }[], update(t: number): void, dispose(): void, stats: object }}
 */
export function buildCity(o) {
  const { map, look, plan, isPath, isWater, occupied, gates, portals, place, facadeParts } = o;
  const quality = o.quality || 'high';
  const margin = o.margin ?? 8;
  const W = map.width;
  const H = map.height;
  const cfg = { ...(look.city || {}), ...(map.city || {}) };
  const rand = makeRand(hash(map.id, 'city'));
  const inMap = (x, z) => x >= 0 && z >= 0 && x < W && z < H;
  const outsideDist = (x, z) => Math.hypot(Math.max(0, -x, x - W), Math.max(0, -z, z - H));
  const wet = (x, z) => isWater(Math.floor(x), Math.floor(z));
  const acc = new CityAcc();
  const disposables = [];
  const meshes = [];
  const glows = [];
  const marks = [];
  const furniture = [];
  // the facade material: the terrain's (shared with the buildings) or one of the kit's own
  let facadeMat = o.facadeMaterial || null;
  function getFacade() {
    if (!facadeMat) {
      facadeMat = createFacadeMaterial({ ...(look.city?.glass || {}), night: look.night });
      disposables.push(facadeMat);
    }
    return facadeMat;
  }

  // ----- road samples on the ground (clearances) -----------------------------------------
  const ground = [];
  plan.roads.forEach((r) => {
    r.pts.forEach(([x, z], i) => {
      if (!r.tunnel[i] && r.elev[i] < 0.05) ground.push({ x, z, r: r.index, i });
    });
  });
  const grid = new Map();
  for (const p of ground) {
    const k = `${Math.floor(p.x)},${Math.floor(p.z)}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(p);
  }
  /** Distance to the nearest road on the ground, ignoring road `r`'s own samples near index `i`. */
  const roadDist = (x, z, r = -1, i = -1, skip = 14) => {
    let best = Infinity;
    const fx = Math.floor(x);
    const fz = Math.floor(z);
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const list = grid.get(`${fx + dx},${fz + dz}`);
        if (!list) continue;
        for (const p of list) {
          if (p.r === r && Math.abs(p.i - i) < skip) continue;
          const d = Math.hypot(p.x - x, p.z - z);
          if (d < best) best = d;
        }
      }
    }
    return best;
  };
  const crossings = (map.crossings || []).map((c) => [c.x, c.y]);
  const nearCrossing = (x, z, d) => crossings.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < d);
  const nearGate = (x, z, d) => gates.some((g) => Math.hypot(g.x - x, g.z - z) < d);
  const nearPortal = (x, z, d) => portals.some((p) => Math.hypot(p.x - x, p.z - z) < d);
  const normalAt = (r, i) => {
    const a = r.pts[Math.max(0, i - 1)];
    const b = r.pts[Math.min(r.pts.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l, (b[0] - a[0]) / l, (b[1] - a[1]) / l];
  };
  const freeSpot = (x, z, d = 0.7) => !furniture.some(([fx, fz]) => Math.hypot(fx - x, fz - z) < d)
    && !occupied.has(`${Math.floor(x)},${Math.floor(z)}`) && !wet(x, z);

  // ----- corners (heading turns ≥ ~50°) ------------------------------------------------------
  const corners = [];
  for (const r of plan.roads) {
    const P = r.pts;
    const K = 5;
    let best = null;
    for (let i = K; i < P.length - K; i++) {
      const ax = P[i][0] - P[i - K][0];
      const az = P[i][1] - P[i - K][1];
      const bx = P[i + K][0] - P[i][0];
      const bz = P[i + K][1] - P[i][1];
      const la = Math.hypot(ax, az) || 1;
      const lb = Math.hypot(bx, bz) || 1;
      const turn = Math.acos(Math.max(-1, Math.min(1, (ax * bx + az * bz) / (la * lb))));
      if (turn > 0.85 && !r.tunnel[i] && r.elev[i] < 0.01) {
        if (!best || turn > best.turn) best = { i, turn, ax: ax / la, az: az / la, bx: bx / lb, bz: bz / lb };
      } else if (best) {
        const [x, z] = P[best.i];
        let ox = best.ax - best.bx;
        let oz = best.az - best.bz;
        const l = Math.hypot(ox, oz) || 1;
        ox /= l;
        oz /= l;
        corners.push({ road: r, i: best.i, x, z, ox, oz });
        best = null;
      }
    }
  }

  // ----- raised kerbs + sidewalks (high / medium; low keeps the painted sidewalk) -----------
  const walkOk = (r, i, side) => {
    if (r.tunnel[i] || r.elev[i] > 0.01 || r.lift[i]) return false;
    const [x, z] = r.pts[i];
    if (outsideDist(x, z) > 6) return false;
    const [nx, nz] = normalAt(r, i);
    const ox = x + nx * side * SW_OUT;
    const oz = z + nz * side * SW_OUT;
    if (wet(ox, oz) || wet(x + nx * side * SW_IN, z + nz * side * SW_IN)) return false;
    if (roadDist(ox, oz, r.index, i) < SW_IN + 0.02) return false;
    if (nearPortal(x, z, 0.4)) return false;
    if (gates.some((g) => g.kind === 'spawn' && Math.hypot(g.x - x, g.z - z) < 0.9)) return false;
    return true;
  };
  let kerbTris = 0;
  if (quality !== 'low') {
    const cWalk = look.city?.sidewalk || '#e6dccb';
    const cKerb = look.city?.kerb || '#f4f1ea';
    const cKerbSide = look.city?.kerbSide || '#c9c1b2';
    const before = acc.pos.length;
    for (const r of plan.roads) {
      const P = r.pts;
      // every second sample (0.4 tiles) keeps the kerb inside its triangle budget
      const idx = [];
      for (let i = 0; i < P.length; i += 2) idx.push(i);
      if (idx[idx.length - 1] !== P.length - 1) idx.push(P.length - 1);
      const N = idx.map((i) => normalAt(r, i));
      for (const side of [-1, 1]) {
        const ok = idx.map((i) => walkOk(r, i, side));
        for (let k = 1; k < idx.length; k++) {
          if (!ok[k] || !ok[k - 1]) continue;
          const a = idx[k - 1];
          const b = idx[k];
          const pt = (kk, i, off, y) => [P[i][0] + N[kk][0] * side * off, y, P[i][1] + N[kk][1] * side * off];
          const quadUp = (p0, p1, p2, p3, col, kind = 0, uvs = null) => {
            // wind so the face points up whatever the side
            if (side > 0) acc.quad(p0, p3, p2, p1, col, kind, uvs ? [uvs[0], uvs[3], uvs[2], uvs[1]] : null);
            else acc.quad(p0, p1, p2, p3, col, kind, uvs);
          };
          const kIn = SW_IN;
          const kOut = SW_IN + KERB;
          quadUp(pt(k - 1, a, kIn, SW_Y), pt(k, b, kIn, SW_Y), pt(k, b, kOut, SW_Y), pt(k - 1, a, kOut, SW_Y), cKerb);
          quadUp(pt(k - 1, a, kOut, SW_Y), pt(k, b, kOut, SW_Y), pt(k, b, SW_OUT, SW_Y), pt(k - 1, a, SW_OUT, SW_Y), cWalk);
          // kerb face toward the road, and the low outer edge
          const f0 = pt(k - 1, a, kIn, PATH_H - 0.02);
          const f1 = pt(k, b, kIn, PATH_H - 0.02);
          const f2 = pt(k, b, kIn, SW_Y);
          const f3 = pt(k - 1, a, kIn, SW_Y);
          if (side > 0) acc.quad(f0, f1, f2, f3, cKerbSide);
          else acc.quad(f0, f3, f2, f1, cKerbSide);
          const e0 = pt(k - 1, a, SW_OUT, 0);
          const e1 = pt(k, b, SW_OUT, 0);
          const e2 = pt(k, b, SW_OUT, SW_Y);
          const e3 = pt(k - 1, a, SW_OUT, SW_Y);
          if (side > 0) acc.quad(e0, e3, e2, e1, cKerbSide);
          else acc.quad(e0, e1, e2, e3, cKerbSide);
        }
      }
    }
    kerbTris = (acc.pos.length - before) / 9;
  }

  // ----- crosswalks: on every flat junction's arms, and beside a few corners -----------------
  for (const m of crosswalkMarks(map)) marks.push(m);
  let cornerWalks = 0;
  for (const c of corners) {
    if (cornerWalks >= 6) break;
    const r = c.road;
    for (const dir of [-1, 1]) {
      const k = c.i + dir * 9;
      if (k < 1 || k >= r.pts.length - 1 || cornerWalks >= 6) continue;
      const [x, z] = r.pts[k];
      if (!inMap(x, z) || r.tunnel[k] || r.elev[k] > 0.005 || r.lift[k] || nearCrossing(x, z, 1.8) || nearGate(x, z, 1.4) || nearPortal(x, z, 0.8)) continue;
      if (marks.some((mk) => mk.kind === 'zebra' && Math.hypot(mk.x - x, mk.z - z) < 2.2)) continue;
      const [nx, nz, tx, tz] = normalAt(r, k);
      marks.push({ kind: 'zebra', x, z, rot: Math.atan2(-nz, nx) });
      // the stop line on the approach side
      const sx = x - tx * 0.34 * -dir;
      const sz = z - tz * 0.34 * -dir;
      marks.push({ kind: 'stopLine', x: sx, z: sz, rot: Math.atan2(-nz, nx) });
      cornerWalks++;
    }
  }
  // the rift's cracks on the road at every spawn gate
  for (const g of gates) {
    if (g.kind !== 'spawn') continue;
    marks.push({ kind: 'cracks', x: g.x + g.dir[0] * 0.55, z: g.z + g.dir[1] * 0.55, rot: Math.atan2(-g.dir[1], g.dir[0]), color: look.gate?.spawn || '#b46cff' });
  }

  // ----- traffic signals at the corners --------------------------------------------------
  let signals = 0;
  for (const c of corners) {
    if (signals >= 6) break;
    const x = c.x + c.ox * 0.78;
    const z = c.z + c.oz * 0.78;
    if (!inMap(x, z) && outsideDist(x, z) > 1.5) continue;
    if (nearCrossing(x, z, 1.2) || nearGate(x, z, 1.4) || roadDist(x, z, c.road.index, c.i, 30) < 0.8 || !freeSpot(x, z)) continue;
    furniture.push([x, z]);
    place('trafficLight', x, quality === 'low' ? 0 : SW_Y, z, Math.atan2(-c.ox, -c.oz), 1, 0);
    signals++;
  }

  // ----- utility poles with a lamp arm along the roads, wires between them --------------------
  const runs = [];
  for (const r of plan.roads) {
    let dist = 1.4;
    let run = [];
    runs.push(run);
    const side = hash(map.id, 'poles', r.index) % 2 ? 1 : -1;
    for (let i = 1; i < r.pts.length - 1; i++) {
      dist += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
      if (dist < 3.0) continue;
      const [x, z] = r.pts[i];
      const breakRun = () => {
        if (run.length) {
          run = [];
          runs.push(run);
        }
      };
      if (outsideDist(x, z) > 3.5 || r.tunnel[i] || r.elev[i] > 0.01 || corners.some((c) => Math.hypot(c.x - x, c.z - z) < 1.1)) {
        breakRun();
        continue;
      }
      const [nx, nz] = normalAt(r, i);
      const px = x + nx * side * 0.72;
      const pz = z + nz * side * 0.72;
      if (!walkOk(r, i, side) || nearGate(px, pz, 1.5) || nearCrossing(px, pz, 1.3) || nearPortal(px, pz, 0.9) || !freeSpot(px, pz, 1.0)
        || marks.some((m) => m.kind === 'zebra' && Math.hypot(m.x - px, m.z - pz) < 0.9)) {
        breakRun();
        continue;
      }
      const last = run[run.length - 1];
      if (last && Math.hypot(last[0] - px, last[1] - pz) > 4.0) breakRun();
      furniture.push([px, pz]);
      const ry = Math.atan2(-nx * side, -nz * side);
      run.push([px, pz, ry]);
      place('powerPole', px, quality === 'low' ? 0 : SW_Y, pz, ry, 1, 0);
      dist = 0;
    }
  }
  const cWire = '#45424a';
  let spans = 0;
  for (const run of runs) {
    for (let k = 1; k < run.length; k++) {
      const [ax, az, ar] = run[k - 1];
      const [bx, bz, br] = run[k];
      const y0 = (quality === 'low' ? 0 : SW_Y) + WIRE_Y;
      for (const off of [-0.22, 0.22]) {
        const a = [ax + Math.cos(ar) * off, y0, az - Math.sin(ar) * off];
        const b = [bx + Math.cos(br) * off, y0, bz - Math.sin(br) * off];
        const m = [(a[0] + b[0]) / 2, y0 - 0.1, (a[2] + b[2]) / 2];
        wire(acc, a, m, cWire);
        wire(acc, m, b, cWire);
        // pigeons sit on every third span
        if (off > 0 && spans % 3 === 1) {
          for (let p = 0; p < 3; p++) {
            const t = 0.3 + p * 0.12;
            const px = a[0] + (b[0] - a[0]) * t;
            const pz = a[2] + (b[2] - a[2]) * t;
            const py = y0 - 0.1 * Math.sin(Math.PI * t) + 0.035;
            prim(acc, new THREE.OctahedronGeometry(0.035, 0), { x: px, y: py, z: pz, sy: 1.1, sz: 1.3, ry: ar }, p % 2 ? '#8a8f9a' : '#a3a8b2');
          }
        }
      }
      spans++;
    }
  }

  // ----- a cat napping on a wall ---------------------------------------------------------
  {
    const walls = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const border = x === 0 || y === 0 || x === W - 1 || y === H - 1;
        if (!border || map.rows[y][x] !== 'H' || isPath(x, y)) continue;
        const top = WALL_TOP[cityWallVariant(map, x, y)];
        if (top != null) walls.push([x, y, top]);
      }
    }
    if (walls.length) {
      const [x, y, top] = walls[hash(map.id, 'cat') % walls.length];
      const alongX = y === 0 || y === H - 1;
      place('catOnWall', x + 0.5, top, y + 0.5, alongX ? 0 : Math.PI / 2, 1, hash(map.id, 'catv') % 2);
    }
  }

  // ----- subway signs at the tunnel mouths ------------------------------------------------
  for (const p of portals) {
    const [dx, dz] = p.dir;
    const nx = -dz;
    const nz = dx;
    const sgn = p.end === 'in' ? -1 : 1;
    const x = p.x + nx * 0.98 + dx * sgn * 0.3;
    const z = p.z + nz * 0.98 + dz * sgn * 0.3;
    if (roadDist(x, z) < 0.6 || wet(x, z) || map.rows[Math.floor(z)]?.[Math.floor(x)] === 'U') continue;
    const ry = Math.atan2(dx * sgn, dz * sgn);
    acc.box(x, 0, z, 0.05, 0.62, 0.05, { color: '#9aa3ae' });
    acc.box(x, 0.6, z, 0.24, 0.22, 0.04, { ry, color: '#3d6a9a' });
    furniture.push([x, z]);
    glows.push({ x, y: 0.72, z, color: new THREE.Color('#cfe6ff'), size: 0.45, flicker: 0.04, phase: rand() * 6 });
  }

  // ----- skyline in the skirt -------------------------------------------------------------
  const rail = Number.isFinite(cfg.railway?.z) ? { z: cfg.railway.z } : null;
  // (a railway may cross a canal on its own bridge; it only gives way to open water mid-board)
  if (rail && wet(W / 2, rail.z)) rail.z = null;
  const STEP = 2.1;
  const lots = [];
  const lotFree = (cx, cz, half) => {
    for (const [dx, dz] of [[0, 0], [-half, -half], [half, -half], [-half, half], [half, half], [0, -half], [0, half], [-half, 0], [half, 0]]) {
      if (roadDist(cx + dx, cz + dz) < 1.05 || wet(cx + dx, cz + dz)) return false;
    }
    if (rail?.z != null && Math.abs(cz - rail.z) < half + 0.6) return false;
    return true;
  };
  const reach = Math.min(margin - 1.2, 6.6);
  for (let cz = -reach; cz <= H + 2.7 + 1e-6; cz += STEP) {
    for (let cx = -reach; cx <= W + reach + 1e-6; cx += STEP) {
      if (cx > -2.0 && cx < W + 2.0 && cz > -2.0 && cz < H + 2.0) continue;
      if (!lotFree(cx, cz, 0.85)) continue;
      lots.push([cx, cz]);
    }
  }
  lots.forEach(([cx, cz], k) => {
    const h = hash(map.id, 'lot', k);
    const back = cz < 0;
    const front = cz > H;
    const depth = back ? Math.round(-cz / STEP) : Math.round(Math.max(-cx, cx - W) / STEP);
    let variant;
    if (front) {
      // in front of the board (near the camera): low houses and street trees only
      if (h % 3 === 0) {
        place('streetTree', cx, 0, cz, (h % 628) / 100, 1.2, h % 2, null, 'far');
        return;
      }
      variant = 5;
    } else if (back) variant = depth >= 2 ? [0, 3, 4, 3, 0][h % 5] : [1, 2, 4, 1][h % 4];
    else variant = depth >= 2 ? [0, 1, 2, 4][h % 4] : [1, 2, 5, 2][h % 4];
    const lod = quality === 'high' && outsideDist(cx, cz) < 3 ? 'near' : 'far';
    place('cityTower', cx, 0, cz, 0, 1, variant, null, lod);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) occupied.add(`${Math.floor(cx) + dx},${Math.floor(cz) + dz}`);
  });

  // ----- the railway (when the map places one), level crossings, the commuter train ---------------
  let train = null;
  /** Level crossings: { lane, posts: [{ x, z, ry, glow }], angle, target, base } (the lane schedule drives them). */
  const levelCrossings = [];
  if (rail?.z != null) {
    const rz = rail.z;
    const x0 = -margin - 2;
    const x1 = W + margin + 2;
    acc.box((x0 + x1) / 2, 0, rz, x1 - x0, 0.03, 0.78, { color: '#a49d93', top: '#9a9389', topKind: FK.sleepers });
    for (const s of [-1, 1]) acc.box((x0 + x1) / 2, 0.03, rz + s * 0.19, x1 - x0, 0.03, 0.035, { color: '#c7ccd2' });
    for (let x = Math.ceil(x0 / 4) * 4; x < x1; x += 4) occupied.add(`${Math.floor(x)},${Math.floor(rz)}`);
    // a line across the board itself keeps every tile it runs over free of props
    if (rz > 0 && rz < H) for (let x = 0; x < W; x++) occupied.add(`${x},${Math.floor(rz)}`);
    for (const r of plan.roads) {
      for (let i = 1; i < r.pts.length; i++) {
        const [ax, az] = r.pts[i - 1];
        const [bx, bz] = r.pts[i];
        if ((az - rz) * (bz - rz) > 0 || az === bz) continue;
        // a road that passes under the line (an underpass) or over it on a deck has no level crossing
        if (r.tunnel[i - 1] || r.tunnel[i] || r.elev[i - 1] > 0.01 || r.elev[i] > 0.01) continue;
        const cx = ax + ((rz - az) / (bz - az)) * (bx - ax);
        acc.box(cx, PATH_H - 0.01, rz, 1.0, 0.03, 0.8, { color: '#7f7a75' });
        for (const s of [-1, 1]) acc.box(cx, 0.06, rz + s * 0.19, 1.0, 0.012, 0.035, { color: '#c7ccd2' });
        // the posts (variant 2: without their arm, which the kit swings) on either side of the road
        const posts = [[cx - 0.7, rz - 0.55, 0], [cx + 0.7, rz + 0.55, Math.PI]].map(([x, z, ry]) => {
          place('levelCrossing', x, 0, z, ry, 1, 2);
          furniture.push([x, z]);
          // its lamps' light: dim while the road is open, blinking while the barrier is down
          const glow = { x: x + Math.sin(ry) * 0.08, y: 0.85, z: z + Math.cos(ry) * 0.08, color: new THREE.Color('#ff4d5e'), size: 0.16, flicker: 0, phase: ry ? Math.PI : 0 };
          glows.push(glow);
          return { x, z, ry, glow };
        });
        levelCrossings.push({ lane: r.index, x: cx, z: rz, posts, angle: ARM_UP, target: ARM_UP, base: 0 });
      }
    }
    const geo = trainCarGeometry(new CityAcc());
    disposables.push(geo);
    train = new THREE.InstancedMesh(geo, getFacade(), TRAIN.cars);
    train.name = 'cityTrain';
    train.frustumCulled = false;
    train.userData = { cast: true, z: rz, x0: x0 - TRAIN.cars * TRAIN.len, x1: x1 + TRAIN.len };
    meshes.push(train);
  }

  // ----- the water-bus on the canal --------------------------------------------------------
  let boat = null;
  const wb = cfg.waterBus;
  // a lane along z (x0 → x1 at depth z) or along x (z0 → z1 at column x)
  const alongX = wb && wb.x == null;
  if (wb && (alongX ? wet(((wb.x0 ?? 0) + (wb.x1 ?? W)) / 2, wb.z) : wet(wb.x, ((wb.z0 ?? 0) + (wb.z1 ?? H)) / 2))) {
    const tmpAcc = new CityAcc();
    // the waterBus prop's facade geometry (a fresh context, so the prop cache stays untouched;
    // its headlight glow is left out: the moving boat is one facade mesh)
    const ctx = { facade: tmpAcc, glow: { box() {} }, glows: [], emitters: [], variant: 0, look, lod: 'near' };
    CITY_BUILDERS.waterBus(ctx);
    const geo = tmpAcc.build();
    disposables.push(geo);
    boat = new THREE.InstancedMesh(geo, getFacade(), 1);
    boat.name = 'cityWaterBus';
    boat.frustumCulled = false;
    boat.userData = alongX
      ? { cast: false, alongX, c: wb.z, a0: wb.x0 ?? -3, a1: wb.x1 ?? W + 3, period: wb.period ?? 36 }
      : { cast: false, alongX, c: wb.x, a0: wb.z0 ?? -3, a1: wb.z1 ?? H + 3, period: wb.period ?? 36 };
    meshes.push(boat);
  }

  // ----- Brigade patrol drones holding station over the side skirts (dressing only) --------
  const nDrones = cfg.drones === false ? 0 : quality === 'high' ? 4 : quality === 'medium' ? 3 : 2;
  let drones = null;
  const flights = [];
  /** Where each drone is now ({ x, y, z }): the actor layer drops a soft shadow under each, which
   * is what tells the near top-down camera that they fly high (without one they read as standing). */
  const flyers = [];
  if (nDrones > 0) {
    const geo = droneGeometry(new CityAcc());
    disposables.push(geo);
    drones = new THREE.InstancedMesh(geo, getFacade(), nDrones);
    drones.name = 'cityDrones';
    drones.frustumCulled = false;
    drones.userData.cast = false;
    meshes.push(drones);
    const dr = makeRand(hash(map.id, 'drones'));
    // Each drone holds station over a side skirt (west, east, west…), circling slowly: never over
    // the board (from the near top-down battle camera a drone over it sits there like a monster)
    // and never over a road where it crosses that side (it would read as one walking in). The
    // camera lifts a thing y high by ≈ 0.9·y tiles up the screen, so a drone is placed by where it
    // appears (az), 0.9·y further back. The east station keeps further out: in portrait the
    // camera turns and that lift carries it toward the board from the east side.
    const LIFT = 0.9;
    const R = 0.45;
    for (let i = 0; i < nDrones; i++) {
      const west = i % 2 === 0;
      const off = west ? 1.8 + dr() * 1.0 : 4.0 + dr() * 0.8;
      const y = 3.3 + dr() * 0.6;
      const roadsHere = gates.filter((g) => (west ? g.x < 0.5 : g.x > W - 0.5)).map((g) => g.z);
      let az = H / 2;
      let best = -1;
      for (const c of [1.6, H / 2, H - 1.6, 3.2, H - 3.2]) {
        const d = roadsHere.length ? Math.min(...roadsHere.map((z) => Math.abs(z - c))) : 99;
        if (d > best + 0.5) {
          best = d;
          az = c;
        }
      }
      // a pair on the same side keeps a little apart
      az += i >= 2 ? (az < H / 2 ? 1.1 : -1.1) : 0;
      flights.push({ cx: west ? -off : W + off, cz: az + LIFT * y, y, r: R, w: (i % 2 ? -1 : 1) * (0.28 + dr() * 0.1), ph: dr() * 6.28 });
      flyers.push({ x: 0, y: 0, z: 0 });
    }
  }

  // ----- the barrier arms (facade geometry of their own, appended last to the facade mesh) ----------
  // Built at the up pose; bindFacade() points them at the merged mesh, then update() re-poses only
  // the arms that swing (their vertex range alone is uploaded).
  const ARM = CROSSING_ARM;
  const armTpl = new CityAcc();
  for (let i = 0; i < ARM.segs; i++) {
    // down pose, about the hub (its axis through the arm's middle): the road side is local +x
    armTpl.box(ARM.seg / 2 + 0.02 + i * ARM.seg, -ARM.w / 2, 0, ARM.seg, ARM.w, ARM.w, { color: i % 2 ? '#e84a4a' : '#f7f4ee' });
  }
  const tplGeo = armTpl.build();
  disposables.push(tplGeo);
  const tplPos = tplGeo.attributes.position.array;
  const tplNor = tplGeo.attributes.normal.array;
  const armVerts = tplGeo.attributes.position.count;
  let armsPart = null;
  /** Writes the arms of crossing `c` at its current angle into position/normal arrays from vertex `at`. */
  const poseArms = (c, pos, nor, at) => {
    const ca = Math.cos(c.angle);
    const sa = Math.sin(c.angle);
    c.posts.forEach((p, k) => {
      const cy = Math.cos(p.ry);
      const sy = Math.sin(p.ry);
      // the hub in the post's frame, then the post on the board
      const hx = ARM.hubX;
      const hy = ARM.hubY + ARM.w / 2;
      const o = (at + k * armVerts) * 3;
      for (let v = 0; v < armVerts * 3; v += 3) {
        // turn about the hub's z axis (up = the road side swings to the sky), then about y with the post
        const lx = tplPos[v] * ca - tplPos[v + 1] * sa + hx;
        const ly = tplPos[v] * sa + tplPos[v + 1] * ca + hy;
        const lz = tplPos[v + 2];
        pos[o + v] = p.x + lx * cy + lz * sy;
        pos[o + v + 1] = ly;
        pos[o + v + 2] = p.z - lx * sy + lz * cy;
        const nx = tplNor[v] * ca - tplNor[v + 1] * sa;
        const ny = tplNor[v] * sa + tplNor[v + 1] * ca;
        const nz = tplNor[v + 2];
        nor[o + v] = nx * cy + nz * sy;
        nor[o + v + 1] = ny;
        nor[o + v + 2] = -nx * sy + nz * cy;
      }
    });
  };
  if (levelCrossings.length) {
    const n = levelCrossings.length * 2 * armVerts;
    const pos = new Float32Array(n * 3);
    const nor = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    levelCrossings.forEach((c, i) => {
      c.base = i * 2 * armVerts;
      poseArms(c, pos, nor, c.base);
      for (let k = 0; k < 2; k++) col.set(tplGeo.attributes.color.array, (c.base + k * armVerts) * 3);
    });
    armsPart = new THREE.BufferGeometry();
    armsPart.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    armsPart.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    armsPart.setAttribute('color', new THREE.BufferAttribute(col, 3));
    armsPart.setAttribute('fuv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    armsPart.setAttribute('fkind', new THREE.BufferAttribute(new Float32Array(n), 1));
    armsPart.computeBoundingSphere();
    armsPart.computeBoundingBox();
  }
  /** The merged facade mesh's attributes and where the arms start in it (bindFacade). */
  let armBind = null;

  // ----- the facade parts ---------------------------------------------------------------
  const geo = acc.build();
  if (geo) facadeParts.push(geo);


  // ----- per frame ---------------------------------------------------------------------
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eu = new THREE.Euler();
  const sc = new THREE.Vector3(1, 1, 1);
  const pv = new THREE.Vector3();
  // ----- the lane schedule: which crossings are shut ------------------------------------------
  let lastTime = 0;
  let lanesKey = '';
  /** The current pass of the train while a crossing is shut ({ t0 }), and when the next may start. */
  let pass = null;
  let nextPass = Infinity;
  const anyShut = () => levelCrossings.some((c) => c.target === 0);
  /**
   * The lanes open now (Sim.openLanes(): null = every lane). A closed lane's crossing lowers its arms
   * and blinks its lamps, and the train runs through while one is shut; an open lane's rises again.
   * @param {number[]|null} open
   */
  function setLanes(open) {
    const key = open ? open.join(',') : '*';
    if (key === lanesKey) return;
    lanesKey = key;
    const wasShut = anyShut();
    for (const c of levelCrossings) {
      const shut = !!open && !open.includes(c.lane);
      c.target = shut ? 0 : ARM_UP;
      for (const p of c.posts) {
        p.glow.size = shut ? 0.5 : 0.16;
        p.glow.flicker = shut ? 0.9 : 0;
      }
    }
    if (anyShut() && !wasShut) nextPass = Math.min(nextPass, lastTime + BUSY.lead);
    if (!anyShut()) nextPass = Infinity;
  }
  /** Points the arms at the merged facade mesh (terrain.js, after merging the parts: armsPart last). */
  function bindFacade(geometry, offset) {
    if (!armsPart || !geometry) return;
    armBind = { pos: geometry.attributes.position, nor: geometry.attributes.normal, offset };
  }
  const placeTrain = (head, z) => {
    for (let i = 0; i < TRAIN.cars; i++) {
      m4.compose(pv.set(head - i * (TRAIN.len + 0.04), 0.09, z), q.identity(), sc);
      train.setMatrixAt(i, m4);
    }
    train.instanceMatrix.needsUpdate = true;
  };

  function update(time) {
    const dt = Math.max(0, Math.min(0.1, time - lastTime));
    lastTime = time;
    // the barrier arms swing toward their target; only a swinging crossing's vertices are uploaded
    for (const c of levelCrossings) {
      if (c.angle === c.target) continue;
      const step = ARM_SPEED * dt;
      c.angle = Math.abs(c.target - c.angle) <= step ? c.target : c.angle + Math.sign(c.target - c.angle) * step;
      if (!armBind) continue;
      poseArms(c, armBind.pos.array, armBind.nor.array, armBind.offset + c.base);
      const start = (armBind.offset + c.base) * 3;
      armBind.pos.addUpdateRange(start, 2 * armVerts * 3);
      armBind.nor.addUpdateRange(start, 2 * armVerts * 3);
      armBind.pos.needsUpdate = true;
      armBind.nor.needsUpdate = true;
    }
    if (train && !levelCrossings.length) {
      // a line with no crossing: the commuter timetable (every 40 s)
      const u = train.userData;
      const k = (time % TRAIN.period) / TRAIN.period;
      // glide across in the first part of the period, then wait off screen
      const t = Math.min(1, k / TRAIN.run);
      placeTrain(u.x0 + (u.x1 - u.x0) * (t * t * (3 - 2 * t) * 0.25 + t * 0.75), u.z);
    } else if (train) {
      // a line with crossings runs only while one is shut (the column takes the long way round):
      // a pass, a gap, the next pass; the pass under way finishes when the crossings open again
      const u = train.userData;
      if (!pass && anyShut() && time >= nextPass) pass = { t0: time };
      if (pass) {
        const t = Math.min(1, (time - pass.t0) / BUSY.pass);
        placeTrain(u.x0 + (u.x1 - u.x0) * (t * t * (3 - 2 * t) * 0.25 + t * 0.75), u.z);
        if (t >= 1) {
          pass = null;
          nextPass = anyShut() ? time + BUSY.gap : Infinity;
        }
      } else placeTrain(u.x1 + TRAIN.len * TRAIN.cars, u.z);
    }
    if (boat) {
      const u = boat.userData;
      const k = (time % u.period) / u.period;
      // there and back, turning round at each end
      const t = k < 0.5 ? k * 2 : 2 - k * 2;
      const e = t * t * (3 - 2 * t);
      const a = u.a0 + (u.a1 - u.a0) * e;
      // the hull's bow is local +z: face the way it is going
      const fwd = k < 0.5 ? 1 : -1;
      eu.set(0, u.alongX ? fwd * Math.PI / 2 : (fwd > 0 ? 0 : Math.PI), Math.sin(time * 1.3) * 0.02);
      q.setFromEuler(eu);
      const y = 0.03 + Math.sin(time * 1.7) * 0.008;
      if (u.alongX) m4.compose(pv.set(a, y, u.c), q, sc);
      else m4.compose(pv.set(u.c, y, a), q, sc);
      boat.setMatrixAt(0, m4);
      boat.instanceMatrix.needsUpdate = true;
    }
    if (drones) {
      flights.forEach((f, i) => {
        const a = time * f.w + f.ph;
        const x = f.cx + Math.cos(a) * f.r;
        const z = f.cz + Math.sin(a) * f.r;
        const y = f.y + Math.sin(time * 1.9 + f.ph) * 0.05;
        // nose along the circle
        eu.set(0.08, Math.atan2(-Math.sin(a) * f.w, Math.cos(a) * f.w), Math.sin(time * 1.4 + i) * 0.05);
        q.setFromEuler(eu);
        m4.compose(pv.set(x, y, z), q, sc);
        drones.setMatrixAt(i, m4);
        const fl = flyers[i];
        fl.x = x;
        fl.y = y;
        fl.z = z;
      });
      drones.instanceMatrix.needsUpdate = true;
    }
  }
  update(0);

  return {
    meshes,
    glows,
    marks,
    furniture,
    flyers,
    update,
    setLanes,
    /** The barrier arms' facade geometry (null without level crossings): terrain.js appends it last, then calls bindFacade. */
    armsPart,
    bindFacade,
    /** Level crossings for tests and previews: { lane, x, z, angle, target }. */
    levelCrossings,
    getFacadeMaterial: getFacade,
    dispose() {
      for (const d of disposables) d.dispose?.();
    },
    stats: {
      corners: corners.length, signals, poles: runs.reduce((n, r) => n + r.length, 0), spans, lots: lots.length,
      kerbTris, marks: marks.length, train: !!train, waterBus: !!boat, drones: nDrones, crossings: levelCrossings.length,
    },
  };
}

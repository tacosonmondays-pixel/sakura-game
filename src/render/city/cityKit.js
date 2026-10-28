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
//     crossings and a schedule the train only runs then; without a schedule it keeps the commuter
//     timetable and the arms dip for each pass). A fork's shared trunk gets one crossing for all
//     its lanes, shut only when all of them are closed. The arms live in the facade mesh (armsPart, appended
//     last by terrain.js) and are re-posed on the CPU only while they swing: 0 extra draw calls,
//   • rooftops (Gate Arc S1c): buildRoofs draws one flat-roofed block ROOF_Y tall under each
//     connected region of 'U' tiles (walls and a parapet on its outline only, a little dressing),
//     into the same facade mesh; terrain.js calls it on every theme,
//   • the campus (Gate Arc S2a, look.city.kit 'campus': Hilltop High by the lake): the same layout
//     with the school set (campusProps.js): classroom wings, the gym and club huts on the board, a
//     skyline of tall wings, the gym and one clock tower in the skirt, lamp posts along the roads
//     instead of utility poles and wires, no traffic signals, subway signs or drones; school
//     classrooms under the rooftops with flower boxes on them; and two map hints:
//     map.city.pieces (free-standing set pieces: a finish gantry, a clock tower behind the far edge)
//     and map.city.searchlight (a searchlight on the shore whose beam the ambient layer sweeps over
//     the water: 0 draw calls),
//   • Old Town (Gate Arc S3a, MapDef.district 'oldtown', themes.DISTRICTS): wooden houses with tiled
//     roofs on the board (oldTownProps.js oldHouse), stone gutters instead of raised kerbs, no
//     traffic signals, and paper lantern strings on bamboo posts along the lanes where the city
//     would stand its utility poles (glow geometry; every fourth lantern a sprite); tiled timber
//     blocks under the rooftops,
//   • the burning look (Gate Arc S3a, look.ruined 'burning'): burnt shells on the board and broken
//     towers in the skirt (ruinProps.js), rubble in front, a charred lantern string at every other
//     spot; terrain.js adds the fire, the smoke and the scorch (ruinProps.burningLayer),
//   • the mountain highway (Gate Arc S4a, MapDef.district 'highway', themes.DISTRICTS): embankments,
//     rock cuts and depots on the board (highwayProps.js roadsideBlock), steel crash barriers along
//     the roads instead of raised kerbs, highway lamps instead of utility poles and wires, no signals
//     or painted crossings, the bore dressing (tunnelPortal) at every highway tunnel mouth, toll
//     canopies under 'U' roofs (the booth islands girls stand on), a concrete flyover on its piers
//     down one side skirt, rock cuts, depots and pines round the rest,
//   • checkpoint barriers (Gate Arc S4a, map.city.barriers: [{ lane, at? }]): a barrier arm across one
//     lane past its fork (Azami's checkpoint, 4-7), on two Brigade posts, lowered by the lane schedule
//     exactly like a level crossing's arms (setLanes), its amber beacons blinking while it is down,
//     a checkpoint hut beside it. No train runs for a barrier.
//
// Static geometry goes into the terrain's shared meshes (props, foliage, glow props and the one
// facade mesh), so the kit adds one draw call (the facade) plus the movers. Nothing is
// transparent. Deterministic per map id (no Math.random).
import * as THREE from 'three';
import { makeRand, hash } from '../geo.js';
import { CityAcc, FK, createFacadeMaterial } from './cityMaterials.js';
import { CITY_BUILDERS, CITY_VARIANTS, wire, trainCarGeometry, droneGeometry, ROOF_Y, CROSSING_ARM } from './cityProps.js';
import { CAMPUS } from './campusProps.js';
import { prim } from './buildings.js';
import { OLD, LANTERN_STRINGS } from './oldTownProps.js';
import { RUIN_ON_BOARD } from './ruinProps.js';
import { BARRIER_ARM, HW, barrierArmBoxes } from './highwayProps.js';

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
export function buildRoofs(map, acc, { quality = 'high', kit = null, district = null, ruined = null } = {}) {
  const regions = roofRegions(map);
  // the campus: classrooms under the roofs (school windows, cream walls) and flower boxes on them
  const campus = kit === 'campus';
  // Old Town: timber blocks with a tiled terrace and a tiled pent eave round the outline (charred
  // when the street burns)
  const oldtown = district === 'oldtown';
  const isRoof = (x, y) => map.rows[y]?.[x] === 'U';
  const T = 0.035;
  const PH = 0.05;
  let tiles = 0;
  if (district === 'highway') return buildTollCanopies(map, regions, acc, isRoof);
  regions.forEach((reg, ri) => {
    const h = hash(map.id, 'roof', reg.tiles[0][0], reg.tiles[0][1]);
    const flats = h % 2 === 1;
    const side = campus ? FK.school : oldtown ? (ruined ? FK.plain : FK.wood) : flats ? FK.flats : FK.shop;
    const wall = campus ? CAMPUS.wall : oldtown ? (ruined ? '#4a4240' : h % 2 ? OLD.timber : OLD.timberPale) : flats ? '#efe7da' : '#e9d9bf';
    const top = oldtown ? (ruined ? '#5a5450' : ['#6a7380', '#646d7a', '#707986'][h % 3]) : ['#cfc8bb', '#c9c2b6', '#d3cdc2'][h % 3];
    const parapetCol = oldtown ? (ruined ? '#3d3734' : OLD.tileDark) : PAL_PARAPET;
    for (const [x, y] of reg.tiles) {
      tiles++;
      // the roof surface
      if (oldtown) acc.quad([x, ROOF_Y, y + 1], [x + 1, ROOF_Y, y + 1], [x + 1, ROOF_Y, y], [x, ROOF_Y, y], top, FK.roofTile, [[x, y + 1], [x + 1, y + 1], [x + 1, y], [x, y]]);
      else acc.quad([x, ROOF_Y, y + 1], [x + 1, ROOF_Y, y + 1], [x + 1, ROOF_Y, y], [x, ROOF_Y, y], top, 0);
      const H = ROOF_Y;
      // walls and parapet on the outline: north (-z), south (+z), west (-x), east (+x)
      if (!isRoof(x, y - 1)) {
        acc.quad([x + 1, 0, y], [x, 0, y], [x, H, y], [x + 1, H, y], wall, side, [[x + 1, 0], [x, 0], [x, H], [x + 1, H]]);
        acc.box(x + 0.5, H, y + T / 2, 1, PH, T, { color: parapetCol });
      }
      if (!isRoof(x, y + 1)) {
        acc.quad([x, 0, y + 1], [x + 1, 0, y + 1], [x + 1, H, y + 1], [x, H, y + 1], wall, side, [[x, 0], [x + 1, 0], [x + 1, H], [x, H]]);
        acc.box(x + 0.5, H, y + 1 - T / 2, 1, PH, T, { color: parapetCol });
        // Old Town: a tiled pent eave over the street side, between the floors
        if (oldtown && !ruined) acc.quad([x, 0.28, y + 1.14], [x + 1, 0.28, y + 1.14], [x + 1, 0.34, y + 1], [x, 0.34, y + 1], OLD.tile, FK.roofTile, [[0, 0], [1, 0], [1, 0.15], [0, 0.15]]);
      }
      if (!isRoof(x - 1, y)) {
        acc.quad([x, 0, y], [x, 0, y + 1], [x, H, y + 1], [x, H, y], wall, side, [[y, 0], [y + 1, 0], [y + 1, H], [y, H]]);
        acc.box(x + T / 2, H, y + 0.5, T, PH, 1, { color: parapetCol });
      }
      if (!isRoof(x + 1, y)) {
        acc.quad([x + 1, 0, y + 1], [x + 1, 0, y], [x + 1, H, y], [x + 1, H, y + 1], wall, side, [[y + 1, 0], [y, 0], [y, H], [y + 1, H]]);
        acc.box(x + 1 - T / 2, H, y + 0.5, T, PH, 1, { color: parapetCol });
      }
    }
    if (quality === 'low' || oldtown) return;
    if (campus) {
      // flower boxes along the parapet facing the camera (+z), tucked against it: a terracotta
      // trough with a green top and blossom dots, low (0.08) so a girl standing by it stays clear
      for (const [x, y] of reg.tiles) {
        if (isRoof(x, y + 1)) continue;
        acc.box(x + 0.5, ROOF_Y, y + 1 - T - 0.05, 0.62, 0.07, 0.08, { color: '#c98a6e', top: '#5f8f4f' });
        for (let k = 0; k < 3; k++) acc.box(x + 0.32 + k * 0.18, ROOF_Y + 0.07, y + 1 - T - 0.05, 0.05, 0.03, 0.05, { color: ['#ff9ec4', '#ffe680', '#ffffff'][(k + x) % 3] });
      }
      return;
    }
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
 * The highway's booth islands (Gate Arc 4-6, 'U' tiles on a `district: 'highway'` map): per region a
 * toll canopy whose flat top is the roof girls stand on (ROOF_Y), an amber fascia round it, pillars
 * at its outer corners, a booth on its island under every tile, and a lit price board on the front
 * edge (its glow sprite comes back in `glows`). Facade geometry into `acc`; deterministic per map.
 */
function buildTollCanopies(map, regions, acc, isRoof) {
  const glows = [];
  let tiles = 0;
  const Y = ROOF_Y;
  regions.forEach((reg) => {
    let maxZ = -Infinity;
    let sx = 0;
    for (const [x, y] of reg.tiles) {
      tiles++;
      maxZ = Math.max(maxZ, y + 1);
      sx += x + 0.5;
      acc.quad([x, Y, y + 1], [x + 1, Y, y + 1], [x + 1, Y, y], [x, Y, y], '#e4e2dc', 0);
      // the slab's edge on the outline: an amber fascia under a white lip
      const edge = (a, b) => {
        acc.quad([a[0], Y - 0.07, a[1]], [b[0], Y - 0.07, b[1]], [b[0], Y, b[1]], [a[0], Y, a[1]], HW.amber);
      };
      if (!isRoof(x, y - 1)) edge([x + 1, y], [x, y]);
      if (!isRoof(x, y + 1)) edge([x, y + 1], [x + 1, y + 1]);
      if (!isRoof(x - 1, y)) edge([x, y], [x, y + 1]);
      if (!isRoof(x + 1, y)) edge([x + 1, y + 1], [x + 1, y]);
      // pillars at the outer corners
      for (const [cx, cy, dx, dy] of [[x, y, -1, -1], [x + 1, y, 1, -1], [x, y + 1, -1, 1], [x + 1, y + 1, 1, 1]]) {
        if (isRoof(x + dx, y) || isRoof(x, y + dy)) continue;
        acc.box(cx - dx * 0.12, 0, cy - dy * 0.12, 0.06, Y - 0.07, 0.06, { color: HW.steel });
      }
      // the island under it (striped nose to the front) and its booth
      acc.box(x + 0.5, 0, y + 0.5, 0.36, 0.05, 0.86, { color: HW.concreteDark });
      for (let i = 0; i < 3; i++) acc.box(x + 0.5, 0.001, y + 0.87 - i * 0.1, 0.362, 0.05, 0.05, { color: i % 2 ? '#2b2b2b' : '#ffd84d' });
      acc.box(x + 0.5, 0.05, y + 0.45, 0.26, 0.3, 0.34, { color: HW.white, side: FK.plain, top: HW.navy });
      acc.box(x + 0.5, 0.2, y + 0.45, 0.265, 0.08, 0.345, { color: HW.glassDark, noTop: true });
    }
    // the price board on the front edge, hung under the fascia
    const cx = sx / reg.tiles.length;
    acc.box(cx, Y - 0.2, maxZ + 0.02, 0.36, 0.13, 0.03, { color: '#1f2733' });
    for (let i = 0; i < 2; i++) acc.box(cx, Y - 0.18 + i * 0.05, maxZ + 0.037, 0.26 - i * 0.06, 0.025, 0.004, { color: i ? '#7fe0a8' : HW.sodium });
    glows.push({ x: cx, y: Y - 0.13, z: maxZ + 0.08, color: new THREE.Color('#9ff0c0'), size: 0.4, flicker: 0.03, phase: (hash(map.id, 'toll', cx) % 628) / 100 });
  });
  return { regions: regions.length, tiles, glows };
}

/**
 * Which building stands on an interior H tile: shops along the street (shopFront, the shop-row
 * and corner kinds of cityBlock), homes and offices one row back. Every kind is ≤ BOARD_MAX_H.
 * @param {object} map MapDef
 * @param {number} x tile
 * @param {number} y tile
 * @param {(x: number, y: number) => boolean} isPath
 * @returns {{ type: string, variant: number, ry?: number, s?: number, lod?: string }} (ry / s / lod: a
 *   turn, scale and LOD of its own instead of facing the road: the highway's mountain rock)
 */
export function cityBuildingFor(map, x, y, isPath, kit = null, look = null) {
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
  if (look?.ruined) {
    // the street burnt: shells of every kind (the timber frames in Old Town), all low
    if (look.district === 'oldtown' && roll < 45) return { type: 'ruinBlock', variant: 2 };
    return { type: 'ruinBlock', variant: RUIN_ON_BOARD[(h >>> 8) % RUIN_ON_BOARD.length] };
  }
  if (look?.district === 'oldtown') {
    // Old Town: shop houses, lantern shops and merchant houses on the lane; storehouses, a shrine
    // hall and the bathhouse one row back (oldTownProps OLD_HOUSE_KINDS, every one ≤ BOARD_MAX_H)
    if (d <= 1) return { type: 'oldHouse', variant: roll < 50 ? 0 : roll < 72 ? 4 : 1 };
    return { type: 'oldHouse', variant: roll < 45 ? 2 : roll < 70 ? 1 : roll < 88 ? 5 : 3 };
  }
  if (look?.district === 'highway') {
    // the highway: embankments with sound walls and rock cuts along the road, now and then the
    // control hut or the rest stop; one row back the depot, the salt dome, more rock (highwayProps
    // ROADSIDE_KINDS, every one ≤ BOARD_MAX_H)
    // (inside a big block of H, the mountain the bores run through: all rock)
    let mass = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && map.rows[y + dy]?.[x + dx] === 'H') mass++;
    if (mass >= 6) return { type: 'roadsideBlock', variant: 1, lod: 'far', ry: (h % 4) * (Math.PI / 2) + ((h >>> 4) % 40) / 100, s: 1.08 + ((h >>> 9) % 20) / 100 };
    if (d <= 1) return { type: 'roadsideBlock', variant: roll < 46 ? 0 : roll < 78 ? 1 : roll < 90 ? 4 : 5 };
    return { type: 'roadsideBlock', variant: roll < 40 ? 1 : roll < 62 ? 2 : roll < 80 ? 3 : 0 };
  }
  if (kit === 'campus') {
    // the school: classroom wings along the roads, now and then a club hut or a bay of the gym;
    // one row back the gym and the wings (every one of them low: campusProps SCHOOL_ON_BOARD)
    if (d <= 1) return { type: 'schoolBlock', variant: roll < 44 ? 0 : roll < 74 ? 1 : roll < 88 ? 4 : 2 };
    return { type: 'schoolBlock', variant: roll < 40 ? 2 : roll < 75 ? 0 : 1 };
  }
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

/** Which cityWall a border H tile gets (retaining wall + hedge, construction fence, brick wall; the campus: no construction fence). */
export function cityWallVariant(map, x, y, kit = null) {
  const h = hash(map.id, 'wall', x, y);
  if (kit === 'campus') return h % 2 ? 2 : 0;
  return h % CITY_VARIANTS.cityWall;
}

/** Top of each cityWall variant (where a cat can sit), null when there is no ledge. */
const WALL_TOP = [0.27, null, 0.375];

/**
 * Builds the city layer of a `look.city` board.
 * @param {object} o
 * @param {object} o.map MapDef (map.city: optional render hints { railway: { z }, waterBus: { z, x0, x1 }, areas, goalGate, goalVariant,
 *   road ('track': terrain.js), pieces: [{ type, x, z, rot?, variant?, s? }], searchlight: { x, z, rot?, sweep?, reach?, period?, variant? } | [...] };
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
 * @returns {{ meshes: THREE.Mesh[], glows: object[], marks: object[], furniture: number[][], flyers: { x: number, y: number, z: number }[], searchlights: object[], update(t: number): void, dispose(): void, stats: object }}
 */
export function buildCity(o) {
  const { map, look, plan, isPath, isWater, occupied, gates, portals, place, facadeParts } = o;
  const quality = o.quality || 'high';
  const margin = o.margin ?? 8;
  const W = map.width;
  const H = map.height;
  const cfg = { ...(look.city || {}), ...(map.city || {}) };
  // the campus set (Hilltop High): lamp posts, no signals / wires / subway signs, a school skyline
  const campus = cfg.kit === 'campus';
  // Old Town (look.district 'oldtown'): stone gutters (no raised kerbs), no signals, lantern strings
  const oldtown = look.district === 'oldtown';
  // the highway (look.district 'highway'): crash barriers, highway lamps, no signals or crossings
  const highway = look.district === 'highway';
  const ruined = !!look.ruined;
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
  if (quality !== 'low' && cfg.kerbs !== false) {
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

  // ----- checkpoint barriers (map.city.barriers: Azami's checkpoint, 4-7) ----------------------
  // Each guards one lane past its fork: by default the first point of that lane's road on the
  // ground, on the board, ≥ 1.4 tiles from every other road and clear of forks, joins, gates and
  // tunnel mouths (or the point of the lane nearest `at`). Its `lanes` are every lane whose road
  // passes through it (a shared trunk), so it shuts only when all of them are closed.
  const links = plan.links || [];
  const barrierSpots = [];
  for (const b of cfg.barriers || []) {
    const r = plan.roads.find((o) => o.index === b.lane);
    if (!r) continue;
    const clearOf = (i) => {
      const [x, z] = r.pts[i];
      if (!inMap(x, z) || r.tunnel[i] || r.elev[i] > 0.01 || r.lift[i] || r.d[i] < 0) return false;
      if (links.some((l) => Math.hypot(l.x - x, l.y - z) < 1.6) || nearGate(x, z, 1.8) || nearPortal(x, z, 1.4) || nearCrossing(x, z, 1.8)) return false;
      return roadDist(x, z, r.index, i, 99999) >= 1.4;
    };
    let k = -1;
    if (Array.isArray(b.at)) {
      for (let i = 0; i < r.pts.length; i++) if (k < 0 || Math.hypot(r.pts[i][0] - b.at[0], r.pts[i][1] - b.at[1]) < Math.hypot(r.pts[k][0] - b.at[0], r.pts[k][1] - b.at[1])) k = i;
    } else {
      for (let i = 1; i < r.pts.length - 1 && k < 0; i++) if (clearOf(i)) k = Math.min(r.pts.length - 2, i + 2);
    }
    if (k < 1) continue;
    const [x, z] = r.pts[k];
    const [nx, nz, tx, tz] = normalAt(r, k);
    const lanes = plan.roads.filter((o) => o.pts.some(([px, pz], i) => !o.tunnel[i] && Math.hypot(px - x, pz - z) < 0.35)).map((o) => o.index);
    if (!lanes.includes(r.index)) lanes.push(r.index);
    barrierSpots.push({ lane: r.index, lanes, x, z, nx, nz, tx, tz });
  }
  const nearBarrier = (x, z, d) => barrierSpots.some((b) => Math.hypot(b.x - x, b.z - z) < d);

  // ----- the highway's crash barriers: a steel W-beam on posts along both sides of every road on the
  // ground (instead of raised kerbs), broken at forks, joins, gates, tunnel mouths and checkpoints ----
  let railTris = 0;
  if (highway) {
    const before = acc.pos.length;
    const OFF = 0.64;
    const RY = 0.17;
    const cRail = HW.rail;
    const cPost = HW.steelDark;
    const cTop = look.frost ? HW.rime : HW.steel;
    for (const r of plan.roads) {
      const P = r.pts;
      const idx = [];
      for (let i = 0; i < P.length; i += 2) idx.push(i);
      for (const side of [-1, 1]) {
        const ok = idx.map((i) => {
          const [x, z] = P[i];
          return walkOk(r, i, side) && outsideDist(x, z) < 4.5 && !links.some((l) => Math.hypot(l.x - x, l.y - z) < 1.3)
            && !nearGate(x, z, 1.3) && !nearPortal(x, z, 1.1) && !nearBarrier(x, z, 1.3) && !nearCrossing(x, z, 1.5);
        });
        let run = 0;
        for (let k = 1; k < idx.length; k++) {
          if (!ok[k] || !ok[k - 1]) {
            run = 0;
            continue;
          }
          const a = idx[k - 1];
          const b = idx[k];
          const [anx, anz] = normalAt(r, a);
          const [bnx, bnz] = normalAt(r, b);
          const A = [P[a][0] + anx * side * OFF, P[a][1] + anz * side * OFF];
          const B = [P[b][0] + bnx * side * OFF, P[b][1] + bnz * side * OFF];
          // the beam: its face toward the road, its back, a top strip (rime on a frost stage)
          const f0 = [A[0], RY - 0.07, A[1]];
          const f1 = [B[0], RY - 0.07, B[1]];
          const f2 = [B[0], RY, B[1]];
          const f3 = [A[0], RY, A[1]];
          if (side > 0) {
            acc.quad(f0, f3, f2, f1, cRail);
            acc.quad(f0, f1, f2, f3, HW.steel);
          } else {
            acc.quad(f0, f1, f2, f3, cRail);
            acc.quad(f0, f3, f2, f1, HW.steel);
          }
          const t0 = [A[0], RY, A[1]];
          const t1 = [B[0], RY, B[1]];
          const t2 = [B[0] + bnx * side * 0.03, RY, B[1] + bnz * side * 0.03];
          const t3 = [A[0] + anx * side * 0.03, RY, A[1] + anz * side * 0.03];
          if (side > 0) acc.quad(t0, t3, t2, t1, cTop);
          else acc.quad(t0, t1, t2, t3, cTop);
          if (run++ % 3 === 0) acc.box(A[0] + anx * side * 0.03, 0, A[1] + anz * side * 0.03, 0.035, RY, 0.035, { color: cPost });
        }
      }
    }
    railTris = (acc.pos.length - before) / 9;
  }

  // ----- crosswalks: on every flat junction's arms, and beside a few corners -----------------
  // (Old Town's stone lanes and the highway carry no painted crossings)
  if (!oldtown && !highway) for (const m of crosswalkMarks(map)) marks.push(m);
  let cornerWalks = 0;
  for (const c of corners) {
    if (oldtown || highway || cornerWalks >= 6) break;
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
    // (a rift standing on the water, a mid-board lane's start on a jetty: no cracked road under it)
    if (g.kind !== 'spawn' || g.onWater) continue;
    marks.push({ kind: 'cracks', x: g.x + g.dir[0] * 0.55, z: g.z + g.dir[1] * 0.55, rot: Math.atan2(-g.dir[1], g.dir[0]), color: look.gate?.spawn || '#b46cff' });
  }

  // ----- traffic signals at the corners --------------------------------------------------
  let signals = 0;
  for (const c of corners) {
    if (campus || oldtown || highway || signals >= 6) break;
    const x = c.x + c.ox * 0.78;
    const z = c.z + c.oz * 0.78;
    if (!inMap(x, z) && outsideDist(x, z) > 1.5) continue;
    if (nearCrossing(x, z, 1.2) || nearGate(x, z, 1.4) || roadDist(x, z, c.road.index, c.i, 30) < 0.8 || !freeSpot(x, z)) continue;
    furniture.push([x, z]);
    place('trafficLight', x, quality === 'low' ? 0 : SW_Y, z, Math.atan2(-c.ox, -c.oz), 1, 0);
    signals++;
  }

  // ----- utility poles with a lamp arm along the roads, wires between them --------------------
  // (Old Town: lantern strings on bamboo posts instead, see below)
  const runs = [];
  let lanterns = 0;
  let lanternSpots = 0;
  for (const r of plan.roads) {
    let dist = 1.4;
    let run = [];
    runs.push(run);
    const side = hash(map.id, 'poles', r.index) % 2 ? 1 : -1;
    for (let i = 1; i < r.pts.length - 1; i++) {
      dist += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
      if (dist < (campus ? 3.4 : highway ? 3.8 : 3.0)) continue;
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
      const px = x + nx * side * (highway ? 0.88 : 0.72);
      const pz = z + nz * side * (highway ? 0.88 : 0.72);
      if (!walkOk(r, i, side) || nearGate(px, pz, 1.5) || nearBarrier(px, pz, 1.3) || nearCrossing(px, pz, 1.3) || nearPortal(px, pz, 0.9) || !freeSpot(px, pz, 1.0)
        || marks.some((m) => m.kind === 'zebra' && Math.hypot(m.x - px, m.z - pz) < 0.9)) {
        breakRun();
        continue;
      }
      const last = run[run.length - 1];
      if (last && Math.hypot(last[0] - px, last[1] - pz) > 4.0) breakRun();
      const ry = Math.atan2(-nx * side, -nz * side);
      if (oldtown) {
        // Old Town: a lantern string on two bamboo posts along the lane instead of a pole (burning:
        // a charred one at every other spot); both ends must stand clear like the pole would
        const [, , tx, tz] = normalAt(r, i);
        const L = LANTERN_STRINGS[1][0];
        const ends = [[px - tx * L / 2, pz - tz * L / 2], [px + tx * L / 2, pz + tz * L / 2]];
        if (ends.some(([ex, ez]) => !freeSpot(ex, ez, 0.6) || roadDist(ex, ez) < 0.6 || nearGate(ex, ez, 1.5) || nearPortal(ex, ez, 0.9))) {
          breakRun();
          continue;
        }
        dist = 0;
        if (ruined && lanternSpots++ % 2 === 1) continue;
        for (const e of ends) furniture.push(e);
        furniture.push([px, pz]);
        place('lanternString', px, quality === 'low' ? 0 : SW_Y, pz, Math.atan2(-tz, tx), 1, ruined ? 4 : 1);
        lanterns++;
        continue;
      }
      furniture.push([px, pz]);
      run.push([px, pz, ry]);
      // (the campus: a lamp post with its arm over the road, no wires)
      place(campus ? 'streetLamp' : highway ? 'highwayLamp' : 'powerPole', px, quality === 'low' || highway ? 0 : SW_Y, pz, ry, 1, 0);
      dist = 0;
    }
  }
  const cWire = '#45424a';
  let spans = 0;
  for (const run of campus || oldtown || highway ? [] : runs) {
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
        const top = WALL_TOP[cityWallVariant(map, x, y, cfg.kit)];
        if (top != null) walls.push([x, y, top]);
      }
    }
    if (walls.length && !highway) {
      const [x, y, top] = walls[hash(map.id, 'cat') % walls.length];
      const alongX = y === 0 || y === H - 1;
      place('catOnWall', x + 0.5, top, y + 0.5, alongX ? 0 : Math.PI / 2, 1, hash(map.id, 'catv') % 2);
    }
  }

  // ----- the highway bores' dressing (jet fans, sodium lamps, a lane sign) at every tunnel mouth -----
  for (const p of highway ? portals : []) {
    const [dx, dz] = p.dir;
    const out = p.end === 'in' ? -1 : 1;
    place('tunnelPortal', p.x, 0, p.z, Math.atan2(dx * out, dz * out), 1, 0);
    furniture.push([p.x, p.z]);
  }

  // ----- subway signs at the tunnel mouths ------------------------------------------------
  for (const p of campus || highway ? [] : portals) {
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
  // the campus skyline: one clock tower on the back lot nearest the board's middle
  const towerLot = campus && !(cfg.pieces || []).some((p) => p.type === 'schoolBlock' && p.variant === 3)
    ? lots.reduce((best, [cx, cz], k) => (cz < 0 && (best < 0 || Math.abs(cx - W / 2) + Math.abs(cz + 2.5) < Math.abs(lots[best][0] - W / 2) + Math.abs(lots[best][1] + 2.5)) ? k : best), -1)
    : -1;
  // the highway: a concrete flyover on its piers down the first column of one side skirt (the lots
  // chain into one elevated road), rock cuts, depots and pines round the rest
  const flyWest = hash(map.id, 'flyover') % 2 === 0;
  const flyX = highway ? lots.reduce((best, [cx]) => (flyWest ? (cx < -2.0 && (best == null || cx > best) ? cx : best) : (cx > W + 2.0 && (best == null || cx < best) ? cx : best)), null) : null;
  let flyovers = 0;
  lots.forEach(([cx, cz], k) => {
    const h = hash(map.id, 'lot', k);
    const back = cz < 0;
    const front = cz > H;
    const depth = back ? Math.round(-cz / STEP) : Math.round(Math.max(-cx, cx - W) / STEP);
    const lod = quality === 'high' && outsideDist(cx, cz) < 3 ? 'near' : 'far';
    if (highway) {
      const claim = () => {
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) occupied.add(`${Math.floor(cx) + dx},${Math.floor(cz) + dz}`);
      };
      if (flyX != null && Math.abs(cx - flyX) < 0.01 && cz > -2.6 && cz < H + 0.6) {
        place('flyover', cx, 0, cz, Math.PI / 2, 1, flyovers++ % 3 === 2 ? 1 : 0, null, lod);
        claim();
        return;
      }
      if (front) {
        // in front of the board (near the camera): pines and boulders only, low
        place(h % 4 === 0 ? 'boulder' : 'pine', cx, 0, cz, (h % 628) / 100, 1.05, h % 4, null, 'far');
        return;
      }
      if (h % 3 === 0) {
        place(back && depth >= 2 ? 'cliff' : 'pine', cx, 0, cz, (h % 628) / 100, 1.2, h % 4, null, 'far');
        return;
      }
      const variant = back ? [1, 1, 0, 2][h % 4] : [0, 2, 3, 1][h % 4];
      place('roadsideBlock', cx, 0, cz, back ? 0 : cx < 0 ? Math.PI / 2 : -Math.PI / 2, 1.5, variant, null, lod);
      claim();
      return;
    }
    if (campus) {
      // the school round the board: cherry trees and hedges in front (near the camera), tall
      // classroom wings and the gym behind and at the sides, the clock tower over the back
      if (front || (!back && h % 4 === 0)) {
        place(h % 3 ? 'sakura' : 'streetTree', cx, 0, cz, (h % 628) / 100, 1.15, h % 4, null, 'far');
        return;
      }
      const variant = k === towerLot ? 3 : back ? [5, 5, 2, 0][h % 4] : [2, 5, 0, 1][h % 4];
      place('schoolBlock', cx, 0, cz, back ? 0 : cx < 0 ? Math.PI / 2 : -Math.PI / 2, 1.5, variant, null, lod);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) occupied.add(`${Math.floor(cx) + dx},${Math.floor(cz) + dz}`);
      return;
    }
    if (ruined) {
      // the city burnt: broken towers behind, burnt shells at the sides, rubble in front
      if (front) {
        place(h % 3 ? 'rubble' : 'burntCar', cx, 0, cz, (h % 628) / 100, 1.3, h % 3, null, 'far');
        return;
      }
      if (back && depth >= 2) place('ruinBlock', cx, 0, cz, (h % 4) * 0.2 - 0.3, 1.0, 5, null, lod);
      else place('ruinBlock', cx, 0, cz, back ? 0 : cx < 0 ? Math.PI / 2 : -Math.PI / 2, 1.5, RUIN_ON_BOARD[h % RUIN_ON_BOARD.length], null, lod);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) occupied.add(`${Math.floor(cx) + dx},${Math.floor(cz) + dz}`);
      return;
    }
    if (oldtown && (front || depth < 2)) {
      // Old Town round the board: wooden houses with tiled roofs (cherry trees in front); the
      // modern city's towers only further back
      if (front && h % 3 === 0) {
        place('sakura', cx, 0, cz, (h % 628) / 100, 1.15, h % 4, null, 'far');
        return;
      }
      place('oldHouse', cx, 0, cz, back ? 0 : front ? Math.PI : cx < 0 ? Math.PI / 2 : -Math.PI / 2, 1.6, [0, 1, 2, 5, 3, 4][h % 6], null, lod);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) occupied.add(`${Math.floor(cx) + dx},${Math.floor(cz) + dz}`);
      return;
    }
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
    place('cityTower', cx, 0, cz, 0, 1, variant, null, lod);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) occupied.add(`${Math.floor(cx) + dx},${Math.floor(cz) + dz}`);
  });

  // ----- free-standing set pieces (map.city.pieces): a finish gantry over the track, a clock tower… --
  for (const p of cfg.pieces || []) {
    place(p.type, p.x, p.y ?? 0, p.z, p.rot ?? 0, p.s ?? 1, p.variant ?? 0, null, quality === 'high' ? 'near' : 'far');
    furniture.push([p.x, p.z]);
    occupied.add(`${Math.floor(p.x)},${Math.floor(p.z)}`);
  }

  // ----- searchlights (map.city.searchlight): the lamp on the shore, its sweep for the ambient layer --
  /** { x, y, z, a0, a1, period, reach, phase }: the beam turns between yaw a0 and a1 (radians, 0 = +z). */
  const searchlights = [];
  for (const sl of [].concat(cfg.searchlight || [])) {
    const rot = sl.rot ?? 0;
    const sweep = sl.sweep ?? 1.0;
    const variant = sl.variant ?? 0;
    place('searchlight', sl.x, 0, sl.z, rot, 1, variant);
    furniture.push([sl.x, sl.z]);
    occupied.add(`${Math.floor(sl.x)},${Math.floor(sl.z)}`);
    searchlights.push({
      x: sl.x, y: variant ? 1.02 : 0.58, z: sl.z, a0: rot - sweep / 2, a1: rot + sweep / 2,
      period: sl.period ?? 14, reach: sl.reach ?? 4.5, phase: (hash(map.id, 'sweep', searchlights.length) % 628) / 100,
    });
  }

  // ----- the railway (when the map places one), level crossings, the commuter train ---------------
  let train = null;
  /** Level crossings: { lane, lanes, posts: [{ x, z, ry, glow }], angle, target, base } (the lane schedule drives them; `lanes`: every lane on that road, `lane` the first). */
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
        // a fork's shared trunk crosses the line once for every lane drawn along it: one crossing
        // guards them all (it shuts only when every lane on it is closed)
        const same = levelCrossings.find((c) => Math.abs(c.x - cx) < 0.6);
        if (same) {
          if (!same.lanes.includes(r.index)) same.lanes.push(r.index);
          continue;
        }
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
        levelCrossings.push({ lane: r.index, lanes: [r.index], x: cx, z: rz, posts, angle: ARM_UP, target: ARM_UP, base: 0 });
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

  // ----- checkpoint barrier posts (their arms swing with the crossings' below) ---------------------
  /** Checkpoint barriers: { lane, lanes, x, z, posts, angle, target, base, barrier: true } (setLanes drives them; no train). */
  const barriers = [];
  for (const b of barrierSpots) {
    // two Brigade posts staggered either side of the lane, each arm reaching past the middle
    const posts = [[-1, -0.25], [1, 0.25]].map(([s, along]) => {
      const x = b.x + b.nx * s * 0.72 + b.tx * along;
      const z = b.z + b.nz * s * 0.72 + b.tz * along;
      // the arm (local +x) points across the lane, toward its middle
      const ry = Math.atan2(b.nz * s, -b.nx * s);
      place('barrierArm', x, 0, z, ry, 1, 0);
      furniture.push([x, z]);
      occupied.add(`${Math.floor(x)},${Math.floor(z)}`);
      // its amber beacon: dim while the lane is open, blinking while the arm is down
      const glow = { x, y: 0.47, z, color: new THREE.Color(HW.amber), size: 0.16, flicker: 0, phase: s > 0 ? Math.PI : 0 };
      glows.push(glow);
      return { x, z, ry, glow };
    });
    barriers.push({ lane: b.lane, lanes: b.lanes, x: b.x, z: b.z, posts, angle: ARM_UP, target: ARM_UP, base: 0, barrier: true });
    // the checkpoint hut beside the first post, where it stands clear of every road
    const hx = b.x - b.nx * 1.45;
    const hz = b.z - b.nz * 1.45;
    const ch = map.rows[Math.floor(hz)]?.[Math.floor(hx)];
    if (roadDist(hx, hz) > 0.85 && (ch === '.' || ch === ',') && !wet(hx, hz) && !furniture.some(([fx, fz]) => Math.hypot(fx - hx, fz - hz) < 0.6)) {
      place('checkpointHut', hx, 0, hz, Math.atan2(b.nx, b.nz), 1, 0);
      furniture.push([hx, hz]);
      occupied.add(`${Math.floor(hx)},${Math.floor(hz)}`);
    }
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
  /** An arm template: its lowered geometry about the hub, posed per post by poseArms. */
  const armTemplate = (acc, A) => {
    const geo = acc.build();
    disposables.push(geo);
    return { pos: geo.attributes.position.array, nor: geo.attributes.normal.array, col: geo.attributes.color.array, verts: geo.attributes.position.count, hx: A.hubX, hy: A.hubY + A.w / 2 };
  };
  // the level crossing's arm: red and white segments
  const crossingAcc = new CityAcc();
  for (let i = 0; i < ARM.segs; i++) {
    // down pose, about the hub (its axis through the arm's middle): the road side is local +x
    crossingAcc.box(ARM.seg / 2 + 0.02 + i * ARM.seg, -ARM.w / 2, 0, ARM.seg, ARM.w, ARM.w, { color: i % 2 ? '#e84a4a' : '#f7f4ee' });
  }
  const crossingTpl = armTemplate(crossingAcc, ARM);
  // the checkpoint's arm: twice as thick, a navy core banded white and Brigade amber, a STOP plate at
  // the tip (highwayProps BARRIER_ARM / barrierArmBoxes); built only when the map has a barrier
  const barrierTpl = barrierSpots.length
    ? (() => {
      const acc = new CityAcc();
      for (const b of barrierArmBoxes()) acc.box(b.x, b.y, b.z, b.w, b.h, b.d, { color: b.color, rz: b.rz });
      return armTemplate(acc, BARRIER_ARM);
    })()
    : null;
  for (const c of levelCrossings) c.tpl = crossingTpl;
  for (const c of barriers) c.tpl = barrierTpl;
  /** Every swinging arm: the level crossings', then the checkpoint barriers'. */
  const arms = levelCrossings.concat(barriers);
  let armsPart = null;
  /** Writes the arms of crossing `c` at its current angle into position/normal arrays from vertex `at`. */
  const poseArms = (c, pos, nor, at) => {
    const ca = Math.cos(c.angle);
    const sa = Math.sin(c.angle);
    const T = c.tpl;
    const tplPos = T.pos;
    const tplNor = T.nor;
    c.posts.forEach((p, k) => {
      const cy = Math.cos(p.ry);
      const sy = Math.sin(p.ry);
      // the hub in the post's frame, then the post on the board
      const hx = T.hx;
      const hy = T.hy;
      const o = (at + k * T.verts) * 3;
      for (let v = 0; v < T.verts * 3; v += 3) {
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
  if (arms.length) {
    let n = 0;
    for (const c of arms) {
      c.base = n;
      n += 2 * c.tpl.verts;
    }
    const pos = new Float32Array(n * 3);
    const nor = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (const c of arms) {
      poseArms(c, pos, nor, c.base);
      for (let k = 0; k < 2; k++) col.set(c.tpl.col, (c.base + k * c.tpl.verts) * 3);
    }
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
  /** Has a lane schedule ever spoken? Until one does, a line with crossings keeps the commuter timetable. */
  let scheduled = false;
  const shutCrossing = (c, shut) => {
    c.target = shut ? 0 : ARM_UP;
    for (const p of c.posts) {
      p.glow.size = shut ? 0.5 : 0.16;
      p.glow.flicker = shut ? 0.9 : 0;
    }
  };
  /** The last `open` array seen (the Sim hands the same one back all wave: no key string per frame). */
  let lastOpen;
  function setLanes(open) {
    if (open === lastOpen) return;
    lastOpen = open;
    const key = open ? open.join(',') : '*';
    if (key === lanesKey) return;
    lanesKey = key;
    if (open) scheduled = true;
    if (!scheduled) return;
    const wasShut = anyShut();
    // (a checkpoint barrier shuts the same way, but no train runs for it)
    for (const c of arms) shutCrossing(c, !!open && c.lanes.every((l) => !open.includes(l)));
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
    for (const c of arms) {
      if (c.angle === c.target) continue;
      const step = ARM_SPEED * dt;
      c.angle = Math.abs(c.target - c.angle) <= step ? c.target : c.angle + Math.sign(c.target - c.angle) * step;
      if (!armBind) continue;
      poseArms(c, armBind.pos.array, armBind.nor.array, armBind.offset + c.base);
      const start = (armBind.offset + c.base) * 3;
      armBind.pos.addUpdateRange(start, 2 * c.tpl.verts * 3);
      armBind.nor.addUpdateRange(start, 2 * c.tpl.verts * 3);
      armBind.pos.needsUpdate = true;
      armBind.nor.needsUpdate = true;
    }
    if (train && (!levelCrossings.length || !scheduled)) {
      // a line with no crossing, or no lane schedule: the commuter timetable (every 40 s); its
      // crossings come down just before the train and rise once it has passed (display only)
      const u = train.userData;
      const k = (time % TRAIN.period) / TRAIN.period;
      if (levelCrossings.length) {
        const down = k < TRAIN.run || k > 1 - BUSY.lead / TRAIN.period;
        for (const c of levelCrossings) if ((c.target === 0) !== down) shutCrossing(c, down);
      }
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
    searchlights,
    update,
    setLanes,
    /** The barrier arms' facade geometry (null without level crossings): terrain.js appends it last, then calls bindFacade. */
    armsPart,
    bindFacade,
    /** Level crossings for tests and previews: { lane, x, z, angle, target }. */
    levelCrossings,
    /** Checkpoint barriers (map.city.barriers) for tests and previews: { lane, lanes, x, z, angle, target, posts }. */
    barriers,
    getFacadeMaterial: getFacade,
    dispose() {
      for (const d of disposables) d.dispose?.();
    },
    stats: {
      corners: corners.length, signals, poles: runs.reduce((n, r) => n + r.length, 0), spans, lots: lots.length,
      kerbTris, marks: marks.length, train: !!train, waterBus: !!boat, drones: nDrones, crossings: levelCrossings.length,
      kit: campus ? 'campus' : 'city', searchlights: searchlights.length, pieces: (cfg.pieces || []).length,
      district: look.district || null, ruined: look.ruined || null, lanterns, barriers: barriers.length, railTris, flyovers,
    },
  };
}

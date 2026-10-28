// Preview fixtures for the Gate Arc city look (previews/city.html). NOT game data: nothing in
// src/ imports this file, these boards are never in src/data/maps.js MAPS or STAGES (both feed
// the co-op data hash and the sim id), and vite.config.js builds no previews/ input, so they stay
// out of the game bundle. The real Act 1 maps arrive with the Act 1 content (Gate Arc Step 1, S1d).
//
// Rows use the usual legend (src/data/maps.js): '.' paving (buildable), ',' planted verge
// (buildable), 'T' street tree, 'R' bollards / planter, 'H' building (border H = a wall),
// '~' water, 'U' a shop roof girls stand on. Roads run 1 tile past the board edge at each end, as
// every shipped map's do (so the gates on the edge read as they do there). `city` carries the
// kit's render hints (src/render/city/cityKit.js).
import { buildMapTracks, LINE, TUNNEL_IN, TUNNEL_OUT } from '../src/core/track.js';
import { STAGE_MAP } from '../src/data/stages.js';

const L = LINE;
const IN = TUNNEL_IN;
const OUT = TUNNEL_OUT;

/**
 * Track nodes for a city street: straight runs between the corner points, each corner rounded
 * with radius `r` (a quarter circle for right angles). `tunnel` = [from, to], two points on one
 * straight where the subway section starts and ends.
 * @param {number[][]} corners [start, corner…, end]
 * @param {{ r?: number, tunnel?: number[][] }} [o]
 */
export function street(corners, { r = 0.85, tunnel = null } = {}) {
  const out = [corners[0]];
  const unit = (a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  };
  const onRun = (a, b, p) => {
    const u = unit(a, b);
    const t = (p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const off = Math.abs((p[0] - a[0]) * u[1] - (p[1] - a[1]) * u[0]);
    return off < 1e-6 && t > 0 && t < len;
  };
  for (let i = 1; i < corners.length; i++) {
    const a = corners[i - 1];
    const c = corners[i];
    const last = i === corners.length - 1;
    const u = unit(a, c);
    out.push(L);
    if (tunnel && onRun(a, c, tunnel[0]) && onRun(a, c, tunnel[1])) out.push(tunnel[0], IN, L, tunnel[1], OUT, L);
    if (last) {
      out.push(c);
      break;
    }
    const v = unit(c, corners[i + 1]);
    const A = [c[0] - u[0] * r, c[1] - u[1] * r];
    const B = [c[0] + v[0] * r, c[1] + v[1] * r];
    const O = [A[0] + v[0] * r, A[1] + v[1] * r];
    const k = r / Math.SQRT2;
    const M = [O[0] + (u[0] - v[0]) * k, O[1] + (u[1] - v[1]) * k];
    out.push(A, M, B);
  }
  return out.map((p) => (Array.isArray(p) ? [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4] : p));
}

/** The same stamping as src/data/maps.js defineMap (kept in step by hand; preview only). */
export function defineFixtureMap(o) {
  const grid = o.rows.map((r) => r.split(''));
  const height = grid.length;
  const width = grid[0].length;
  for (const r of grid) if (r.length !== width) throw new Error(`${o.id}: ragged rows`);
  const { tracks, crossings, tiles: onPath } = buildMapTracks(o.paths, o.crossings ?? 'bridge');
  for (const key of onPath) {
    const [x, y] = key.split(',').map(Number);
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const ch = grid[y][x];
    if (ch === '~') grid[y][x] = 'B';
    else if (ch === 'T' || ch === 'R' || ch === 'H' || ch === ',') grid[y][x] = '.';
  }
  for (const d of o.decor || []) {
    const ch = grid[d.y]?.[d.x];
    if ((ch === '.' || ch === ',') && !onPath.has(`${d.x},${d.y}`)) grid[d.y][d.x] = 'H';
  }
  return {
    id: o.id,
    name: o.name,
    theme: o.theme,
    tier: 'intermediate',
    width,
    height,
    rows: grid.map((r) => r.join('')),
    tracks,
    crossings,
    paths: tracks.map((t) => t.points.map(([x, y]) => [Math.round((x - 0.5) * 1e4) / 1e4, Math.round((y - 0.5) * 1e4) / 1e4])),
    decor: o.decor || [],
    city: o.city || {},
    desc: o.desc,
    concept: o.concept || '',
  };
}

// ---------------------------------------------------------------------------
// (a) Downtown Itomachi by day: a scramble crossing, the shopping street, the subway station and
// the commuter line just past the far edge (the strip the battle shows between its HUD and the board)
// ---------------------------------------------------------------------------
const downtown = defineFixtureMap({
  id: 'fixture_city_downtown',
  name: 'Itomachi Downtown',
  theme: 'city',
  desc: 'Preview board: in from the west along the shopping street, round the block, back across the scramble crossing and under the station to the shelter; the commuter line runs behind the back row.',
  rows: [
    'HHHH,HHHT.HHHHHHHHHH',
    'H..HH..,..HHHHHH..TH',
    'HHH...,...........HH',
    '.HH.......HHHHH....H',
    '..........,,T,,....H',
    '.HHH......HHHHH....H',
    '....................',
    '.HHHHHHH.,,.....HHH.',
    '.......,..,.HHHH,...',
    '....................',
    '.HH..HH..,..HHHH..R.',
    '~~~~~~~~~~~~~~~~~~~~',
  ],
  paths: [
    street([[-1, 6.5], [15.5, 6.5], [15.5, 2.5], [9.5, 2.5], [9.5, 9.5], [21, 9.5]], { tunnel: [[12.3, 9.5], [15.7, 9.5]] }),
  ],
  crossings: 'flat',
  decor: [
    { type: 'busStop', x: 4, y: 5, rot: 0 },
    { type: 'vendingMachine', x: 8, y: 7, rot: Math.PI },
    { type: 'missingPoster', x: 17, y: 8, rot: Math.PI },
    { type: 'waterBus', x: 3, y: 11, rot: Math.PI / 2 },
  ],
  city: {
    areas: [{ type: 'plaza', x: 16.2, y: 2.2, w: 2.6, h: 2.6 }],
    waterBus: { z: 12.7, x0: -6, x1: 26, period: 34 },
    railway: { z: -0.85 },
  },
});

// ---------------------------------------------------------------------------
// (b) The canal quarter: a flyover, and the canal (quays on both banks) narrowing at its lock
// ---------------------------------------------------------------------------
const canal = defineFixtureMap({
  id: 'fixture_city_canal',
  name: 'Canal Quarter',
  theme: 'city',
  desc: 'Preview board: in from the north, down past the shops, along the canal quay and back over the flyover to the shelter in the west; the canal runs north to south between two quays and narrows at its lock.',
  rows: [
    'HHHH.HHHHH.HHHH..~~,',
    'H.......HHH......~~,',
    'HH..HH...........~~,',
    '....HH...,,,.T...~~,',
    '.........,T,.....~~,',
    'HH.HHH...,,,.....~~,',
    '..........HHH.....~,',
    '.HH..HH..........~~,',
    '..........,......~~,',
    '.H...............~~,',
    '.HHH.HHHHH.HHHH..~~,',
    'HHHHHHHHHHHHHHHH.~~,',
  ],
  paths: [
    street([[6.5, -1], [6.5, 8.5], [14.5, 8.5], [14.5, 3.5], [3.5, 3.5], [3.5, 1.5], [-1, 1.5]]),
  ],
  crossings: 'bridge',
  decor: [
    { type: 'lockGate', x: 18, y: 6, rot: 0 },
    { type: 'waterBus', x: 18, y: 2, rot: 0 },
    { type: 'ticketGates', x: 11, y: 1, rot: 0 },
    { type: 'bunSteamer', x: 8, y: 9, rot: Math.PI },
    { type: 'roofBlock', x: 12, y: 6, rot: 0 },
    { type: 'arcadeRibs', x: 1, y: 6, rot: Math.PI / 2 },
  ],
  city: {
    // up the canal from the north and back, turning short of the lock (the moored one is at 18,2)
    waterBus: { x: 17.5, z0: -7, z1: 4.6, period: 30 },
    goalVariant: 1,
  },
});

// ---------------------------------------------------------------------------
// (c) The level crossing (Gate Arc S1c: rooftops and the lane schedule on one board): the road
// comes down from the north and forks; the short lane runs straight over the level crossing, the
// long lane swings east round two shop blocks and dives under the line through an underpass, and
// they meet again before the shelter in the south. Its stage closes the short lane on even waves
// (laneCycle [[0, 1], [1]]): the barrier comes down, a train rolls through and the column takes
// the long way round. Girls can stand on the two shop roofs ('U') between the lanes.
// ---------------------------------------------------------------------------
const crossing = defineFixtureMap({
  id: 'fixture_city_crossing',
  name: 'Level Crossing',
  theme: 'city',
  desc: 'Preview board: in from the north, the short lane straight over the level crossing, the long lane round the shop roofs and under the line; both meet before the shelter in the south.',
  rows: [
    'HHHHH.HHHHHHHHHHHHHH',
    'H...........,,,....H',
    'H.HH...............H',
    '.HH................H',
    '.HH....UUU.....,...H',
    '.......UUU.....,...H',
    '....................',
    '.HHH......UUU.......',
    '.,,.......UUU.......',
    'H.HH...HH...........',
    'H..................H',
    'HHHHH.HHHHHHHHHHHHHH',
  ],
  paths: [
    [[5.5, -1], L, [5.5, 13]],
    { fork: { path: 0, at: [5.5, 1.3] }, nodes: [[7.4, 2.6], [10.5, 3.0], [13.0, 3.2], [14.5, 4.6], L, [14.5, 5.0], IN, L, [14.5, 8.2], OUT, L, [14.5, 8.8], [13.7, 9.8], [10.5, 10.0], [7.5, 9.9]], join: { path: 0, at: [5.5, 11.2] } },
  ],
  crossings: 'bridge',
  decor: [
    { type: 'vendingMachine', x: 3, y: 5, rot: Math.PI / 2 },
    { type: 'busStop', x: 7, y: 1, rot: 0 },
  ],
  city: {
    railway: { z: 6.5 },
  },
});

/** Variant key (preview URL) → fixture map. */
export const CITY_FIXTURES = { downtown, canal, crossing };

/** The crossing board's lane schedule: the short lane (0) closes on even waves. */
export const CROSSING_LANES = [[0, 1], [1]];

/** The city keywords the preview stage dresses its boards with (src/render/terrain.js SCENERY). */
export const PREVIEW_KEYWORDS = ['streetLamps', 'busStops', 'vendingMachines', 'parkedCars', 'strays', 'laundry', 'billboards', 'bikeRacks'];

/**
 * A stage to run a fixture in the real Sim (`new Sim({ data: { stage, map } })`): an existing
 * campaign stage's waves (Act 1's families: slime, goblin) on the fixture board, with the city
 * keywords. Never added to STAGES.
 */
export function fixtureStage(map, baseId = '1-3') {
  const base = STAGE_MAP[baseId] || Object.values(STAGE_MAP)[0];
  return {
    ...base,
    id: `preview:${map.id}`,
    name: map.name,
    mapId: map.id,
    scenery: { props: PREVIEW_KEYWORDS },
    introduces: [],
    rule: null,
    // the crossing board runs the lane schedule (src/sim/waves.js openLanes)
    ...(map.id === 'fixture_city_crossing' ? { waveGen: { ...base.waveGen, laneCycle: CROSSING_LANES } } : {}),
  };
}

// PROTOTYPE — "modern city" look test (branch proto/modern-city). Not part of the game:
// nothing imports this module except previews/modern-city.js, and these maps / stages are
// deliberately NOT in src/data/maps.js MAPS or src/data/stages.js STAGES (those feed the co-op
// compatibility hash, tools/simId.mjs). Three maps, one per variant of the city kit
// (src/render/city/): downtown by day, the academy campus, and the city after the gate surge.
//
// Every route is a city grid: right-angle streets with rounded kerb corners, one flyover where
// the route crosses itself (the later pass rises, src/core/track.js) and one short subway
// tunnel. Map rows use the usual legend (src/data/maps.js): '.' paving (buildable), ',' lawn
// (buildable), 'T' planter tree, 'R' rubble / bollards, 'H' building (the city kit draws one
// building per rectangular block of H tiles), '~' water.
//
// `city` carries the kit's per-map layout hints: which H blocks are what (`blocks`), the
// elevated maglev line (`maglev`), painted ground areas (`areas`: plaza / lawn / field / court).
import { buildMapTracks, LINE, TUNNEL_IN, TUNNEL_OUT } from '../core/track.js';
import { STAGE_MAP } from '../data/stages.js';

const L = LINE;
const IN = TUNNEL_IN;
const OUT = TUNNEL_OUT;

/**
 * Track nodes for a city street: straight runs between the given corner points, each corner
 * rounded with radius `r` (a quarter circle for right angles). `tunnels` = [[from, to]] pairs of
 * points on straights (they must lie on a run) where the subway section starts / ends.
 * @param {number[][]} corners [start, corner…, end]
 * @param {{ r?: number, tunnel?: number[][] }} [o]
 */
function street(corners, { r = 0.85, tunnel = null } = {}) {
  const out = [corners[0]];
  const unit = (a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  };
  const onRun = (a, b, p) => {
    // p lies on segment a→b (axis aligned, within the run)
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
    // the run into this corner: straight, with the tunnel markers on it
    out.push(L);
    if (tunnel && onRun(a, c, tunnel[0]) && onRun(a, c, tunnel[1])) {
      out.push(tunnel[0], IN, L, tunnel[1], OUT, L);
    }
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

/** Same stamping as src/data/maps.js defineMap (kept in step by hand; prototype only). */
function defineProtoMap(spec) {
  let o = spec;
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
  // maglev pillars standing on the board block their tile (drawn by the city kit, no prop)
  const decor = [...(o.decor || [])];
  const mg = o.city?.maglev;
  for (const px of mg?.pillars || []) {
    const x = Math.floor(px);
    const y = Math.floor(mg.z);
    if (x >= 0 && y >= 0 && x < width && y < height && !onPath.has(`${x},${y}`)) decor.push({ type: 'maglevPillar', x, y });
  }
  o = { ...o, decor };
  for (const d of o.decor || []) {
    const ch = grid[d.y]?.[d.x];
    if ((ch === '.' || ch === ',') && !onPath.has(`${d.x},${d.y}`)) grid[d.y][d.x] = 'H';
  }
  return {
    id: o.id,
    name: o.name,
    theme: o.theme,
    tier: o.tier || 'intermediate',
    width,
    height,
    rows: grid.map((r) => r.join('')),
    tracks,
    crossings,
    paths: tracks.map((t) => t.points.map(([x, y]) => [Math.round((x - 0.5) * 1e4) / 1e4, Math.round((y - 0.5) * 1e4) / 1e4])),
    decor: o.decor || [],
    ...(o.bridge ? { bridge: o.bridge } : {}),
    ...(o.path ? { path: o.path } : {}),
    ...(o.tunnel ? { tunnel: o.tunnel } : {}),
    city: o.city || {},
    desc: o.desc,
    concept: o.concept || '',
  };
}

// ---------------------------------------------------------------------------
// (a) Downtown, day
// ---------------------------------------------------------------------------
const downtown = defineProtoMap({
  id: 'proto_city_downtown', name: 'Gateway Avenue', theme: 'city',
  desc: 'The gate has opened over the avenue. Monsters march down from the ring, loop the central plaza, dive through the subway and climb the flyover toward the station.',
  concept: 'City block loop: down, east, south, west through the subway, north over the flyover, out east',
  rows: [
    'HHHH.H..T.HHHH..HHH.',
    'HHHH.H..T...........',
    '...,,.....,.....,...',
    '.....H......T...HHH.',
    '....................',
    'HH..,,,.............',
    'HH..,,,......,......',
    '..........,.....T.HH',
    'T...T...........T.HH',
    '....................',
    '.HHH...HH...HH...HHH',
    'THHHTTTHHTTTHHTTTHHH',
  ],
  paths: [
    street([[4.5, -1.6], [4.5, 4.5], [15.5, 4.5], [15.5, 9.5], [8.5, 9.5], [8.5, 1.5], [21.6, 1.5]], { tunnel: [[13.6, 9.5], [10.6, 9.5]] }),
  ],
  decor: [
    { type: 'busStop', x: 6, y: 3, rot: 0 },
    { type: 'fountainPlaza', x: 11, y: 6 },
    { type: 'holoSign', x: 13, y: 3, rot: 0 },
    { type: 'van', x: 17, y: 5, rot: Math.PI / 2 },
    { type: 'scooters', x: 2, y: 9 },
    { type: 'holoSign', x: 6, y: 8, rot: 0 },
  ],
  city: {
    variant: 'downtown',
    // H blocks (x, y = top-left tile): kind + storeys
    blocks: [
      { x: 0, y: 0, w: 3, h: 2, kind: 'glassTower', floors: 14, roof: 'helipad' },
      { x: 10, y: 0, w: 4, h: 1, kind: 'office', floors: 9, roof: 'garden' },
      { x: 16, y: 0, w: 3, h: 1, kind: 'glassTower', floors: 11, roof: 'solar' },
      { x: 5, y: 3, w: 1, h: 1, kind: 'kiosk', floors: 1 },
      { x: 16, y: 3, w: 3, h: 1, kind: 'office', floors: 4, roof: 'ac' },
      { x: 0, y: 5, w: 2, h: 2, kind: 'residential', floors: 6, roof: 'garden' },
      { x: 18, y: 7, w: 2, h: 2, kind: 'glassTower', floors: 7, roof: 'ac' },
      { x: 1, y: 10, w: 3, h: 2, kind: 'shop', floors: 1, awning: 'pink' },
      { x: 7, y: 10, w: 2, h: 2, kind: 'shop', floors: 1, awning: 'mint' },
      { x: 12, y: 10, w: 2, h: 2, kind: 'shop', floors: 1, awning: 'lemon' },
      { x: 17, y: 10, w: 3, h: 2, kind: 'shop', floors: 1, awning: 'sky' },
    ],
    maglev: { z: 12.75, h: 1.95, pillars: [-3.5, 1.5, 6.5, 11.5, 16.5, 21.5] },
    areas: [
      { type: 'plaza', x: 9.2, y: 5.2, w: 5.6, h: 3.6 },
      { type: 'lawn', x: 3.6, y: 5.2, w: 3.8, h: 2.2 },
    ],
  },
});

// ---------------------------------------------------------------------------
// (b) Academy campus
// ---------------------------------------------------------------------------
const campus = defineProtoMap({
  id: 'proto_city_campus', name: 'Academy Grounds', theme: 'campus',
  desc: 'Down from the gate past the gym, west along the main building, round the sports field, under the covered walkway and back over the flyover to the school gate.',
  concept: 'School grounds: down past the gym, west, round the track field, under the walkway, north over the flyover to the school gate',
  rows: [
    '.HHHHHHHH.....H.HHHH',
    '.HHHHHHHH.....H.HHHH',
    '.T...........T...HHH',
    '....................',
    '....,,,,,,,.........',
    '....,,,,,,,.......HH',
    '....,,,,,,,.......HH',
    '....,,,,,,,.......HH',
    'T...............T.HH',
    '....................',
    '..T....HH....T...T..',
    'TTRTRTTHHTRTTRTRTTTT',
  ],
  paths: [
    street([[15.5, -1.6], [15.5, 3.5], [2.5, 3.5], [2.5, 9.5], [12.5, 9.5], [12.5, -1.6]], { tunnel: [[5.4, 9.5], [9.4, 9.5]] }),
  ],
  decor: [
    { type: 'busStop', x: 17, y: 4, rot: Math.PI },
    { type: 'bench', x: 11, y: 2 },
    { type: 'vending', x: 1, y: 5 },
    { type: 'bikeRack', x: 1, y: 7 },
    { type: 'holoSign', x: 14, y: 6, rot: 0 },
    { type: 'scooters', x: 15, y: 10 },
  ],
  city: {
    variant: 'campus',
    blocks: [
      { x: 1, y: 0, w: 8, h: 2, kind: 'school', floors: 4, clock: true },
      { x: 17, y: 0, w: 3, h: 3, kind: 'gym', floors: 3 },
      { x: 18, y: 5, w: 2, h: 4, kind: 'clockTower', floors: 4 },
      { x: 7, y: 10, w: 2, h: 2, kind: 'shop', floors: 1, awning: 'pink' },
    ],
    goalGate: 'schoolGate',
    maglev: { z: 12.75, h: 1.95, pillars: [-3.5, 2.5, 8.5, 14.5, 20.5] },
    areas: [
      { type: 'field', x: 3.6, y: 4.4, w: 7.8, h: 4.2 },
      { type: 'court', x: 13.8, y: 5.0, w: 3.6, h: 3.0 },
    ],
  },
});

// ---------------------------------------------------------------------------
// (c) City after the gate surge
// ---------------------------------------------------------------------------
const surge = defineProtoMap({
  id: 'proto_city_surge', name: 'Crystal Crossing', theme: 'citySurge',
  desc: 'The surge hit the avenue hard: towers broken, wrecks burning, the gate crystals spreading through the rubble. Monsters pour down past the barricades, under the station and over the cracked flyover.',
  concept: 'Evacuated avenue: a long zig down from the gate, round the barricaded square, subway dive, flyover back out',
  rows: [
    'HHHH...H.HHHHH..HHHH',
    'HHHH...H.H...R......',
    '.....R..............',
    '..R.......,,,...R...',
    '..........,,,.......',
    'HH..R...............',
    'HH........R.....R.HH',
    '........R.........HH',
    '..R.................',
    '....R.......R.......',
    '.HHH..HH...R...HHH..',
    'RHHHRRHHRRTRRRRHHHRR',
  ],
  paths: [
    street([[8.5, -1.6], [8.5, 4.5], [3.5, 4.5], [3.5, 8.5], [16.5, 8.5], [16.5, 2.5], [11.5, 2.5], [11.5, 6.5], [21.6, 6.5]], { tunnel: [[6.2, 8.5], [9.8, 8.5]] }),
  ],
  decor: [
    { type: 'barricade', x: 13, y: 5, rot: 0 },
    { type: 'toppledSign', x: 6, y: 2 },
    { type: 'wreckVan', x: 1, y: 3, rot: 0.3 },
    { type: 'fireSmall', x: 13, y: 3 },
    { type: 'smokeColumn', x: 2, y: 8 },
    { type: 'barricade', x: 1, y: 7, rot: Math.PI / 2 },
    { type: 'gateCrystal', x: 14, y: 4 },
    { type: 'gateCrystal', x: 6, y: 6 },
  ],
  city: {
    variant: 'surge',
    blocks: [
      { x: 0, y: 0, w: 4, h: 2, kind: 'glassTower', floors: 12, roof: 'helipad' },
      { x: 10, y: 0, w: 4, h: 1, kind: 'office', floors: 8, roof: 'ac' },
      { x: 16, y: 0, w: 4, h: 1, kind: 'residential', floors: 9, roof: 'garden' },
      { x: 0, y: 5, w: 2, h: 2, kind: 'office', floors: 5, roof: 'ac' },
      { x: 18, y: 6, w: 2, h: 2, kind: 'glassTower', floors: 6, roof: 'solar' },
      { x: 1, y: 10, w: 3, h: 2, kind: 'shop', floors: 1, awning: 'pink' },
      { x: 6, y: 10, w: 2, h: 2, kind: 'shop', floors: 1, awning: 'mint' },
      { x: 15, y: 10, w: 3, h: 2, kind: 'shop', floors: 1, awning: 'lemon' },
    ],
    maglev: { z: 12.75, h: 1.95, pillars: [-3.5, 2.5, 13.5, 19.5], broken: [6.2, 11.2] },
    areas: [
      { type: 'plaza', x: 9.6, y: 3.2, w: 3.8, h: 2.6 },
    ],
  },
});

// ---------------------------------------------------------------------------
// (d) Modern era: Sensei's home town
// ---------------------------------------------------------------------------
const town = defineProtoMap({
  id: 'proto_city_town', name: 'Blossom Hill Block', theme: 'town',
  desc: 'An ordinary afternoon in Sensei\'s home town: down past the houses, along the shops, round the school sports ground, under the station underpass, over the bridge and out across the railway crossing.',
  concept: 'Home-town blocks: down past the houses, east along the shops, round the school ground, over the bridge, out over the level crossing',
  rows: [
    'HHHHHHH.THHHHHHH..HH',
    'HHHHHHH..HHHHHHH..HH',
    '..,...T.........T...',
    'HH................HH',
    'HH................HH',
    '....,.........T...HH',
    '..............T...HH',
    'HH......HH....HH....',
    'HH......HH....HH..T.',
    'HH..................',
    '..T..HH.....T...,...',
    'HHHHHHHHHHHHHHHHHHHH',
  ],
  paths: [
    street([[3.5, -1.6], [3.5, 6.5], [13.5, 6.5], [13.5, 2.5], [7.5, 2.5], [7.5, 9.5], [17.5, 9.5], [17.5, 13.6]], { tunnel: [[10.0, 9.5], [13.4, 9.5]] }),
  ],
  decor: [
    { type: 'vending', x: 5, y: 5, rot: 0 },
    { type: 'bikeRack', x: 16, y: 5 },
    { type: 'cityBench', x: 11, y: 8 },
    { type: 'busStop', x: 5, y: 7, rot: Math.PI },
  ],
  city: {
    variant: 'town',
    blocks: [
      { x: 0, y: 0, w: 2, h: 2, kind: 'house' },
      { x: 5, y: 0, w: 2, h: 2, kind: 'house' },
      { x: 9, y: 0, w: 7, h: 2, kind: 'school', floors: 3, clock: true },
      { x: 18, y: 0, w: 2, h: 2, kind: 'house' },
      { x: 0, y: 3, w: 2, h: 2, kind: 'house' },
      { x: 18, y: 3, w: 2, h: 4, kind: 'apartment', floors: 3 },
      { x: 0, y: 7, w: 2, h: 3, kind: 'apartment', floors: 3 },
      { x: 8, y: 7, w: 2, h: 2, kind: 'cornerStore' },
      { x: 14, y: 7, w: 2, h: 2, kind: 'house' },
      { x: 5, y: 10, w: 2, h: 1, kind: 'house' },
    ],
    railway: { z: 11.5 },
    areas: [
      { type: 'field', x: 8.4, y: 3.4, w: 4.2, h: 2.2 },
    ],
  },
});

export const PROTO_CITY_MAPS = [downtown, campus, surge, town];
export const PROTO_CITY_MAP = Object.fromEntries(PROTO_CITY_MAPS.map((m) => [m.id, m]));

/** Variant key (preview URL) → map. */
export const PROTO_CITY_VARIANTS = { downtown, campus, surge, town };

/**
 * A stage to run a proto map in the real Sim (`new Sim({ data: { stage, map } })`): an existing
 * campaign stage's waves (existing enemy families) on the proto map. Never added to STAGES.
 */
export function protoStage(map, baseId = '2-2') {
  const base = STAGE_MAP[baseId] || Object.values(STAGE_MAP)[0];
  return {
    ...base,
    id: `proto:${map.id}`,
    name: map.name,
    mapId: map.id,
    // weather from the theme (petals in the city, embers after the surge)
    scenery: { props: [] },
    introduces: [],
    rule: null,
  };
}

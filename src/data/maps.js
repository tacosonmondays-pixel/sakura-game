// Sakura Sentinels — battle maps (owner: world). See CONTRACTS.md §4.
//
// Legend for `rows`:
//   '.' grass/stone (buildable)   ',' flowers / decor (buildable)   '~' water (water units only)
//   'T' tree   'R' rock   'H' building / shrine / machinery   'X' void, lava or furnace (blocked)
//   'B' bridge: a water tile the road crosses or grazes (stamped automatically from the paths)
//   'U' rooftop (Gate Arc): a low flat roof girls stand on, their whole footprint on the roof; a wall
//       for a girl on the ground (src/sim/placement.js). Like void it is never cleared under a road:
//       tests fail if a path runs over a roof. A map drops its roofs (the rollout's fallback) by
//       turning its 'U' tiles into '.' (open yards): data only, the route stays the same.
//
// Tracks v3: every path is authored as a smooth curve in WORLD coordinates (tile (x, y) covers
// [x, x+1) × [y, y+1); its centre is (x + 0.5, y + 0.5)) — control points the centreline passes
// through (centripetal Catmull-Rom), `L` straights, `IN` / `OUT` tunnel markers and the
// arc / spiral / curve / loopNodes helpers, or { nodes, fork, join } for lanes that split from
// or merge into an earlier path (src/core/track.js documents the format). The first point sits
// just outside the board (spawn), the last is the exit. Crossings are found automatically: each
// is a bridge (the later pass rises over the earlier one) unless the map asks for 'flat', or a
// tunnel pass runs underneath. The sampled dense centreline (MapDef.tracks) is THE road — the
// sim walks it, the renderer draws it, the thumbnails trace it.
//
// `defineMap` stamps the paths into the terrain so the data stays honest: every tile the road
// touches is path; water there becomes 'B' (a bridge or boardwalk) and trees/rocks/buildings/
// flowers are cleared to '.'. Void ('X') is never cleared — tests fail if a path runs through it.
//
// `decor` lists a handful of composed set pieces per map for the renderer (V2 directive:
// "five beautifully composed features beat fifty random props"). A set piece on land turns its
// tile into 'H' (blocked) so the renderer draws the set piece there instead of a generic
// building; set pieces on water (boats, piers) float and stay purely visual. Types: torii, lantern,
// stoneLantern, sakura, willow, pine, boat, pier, waterwheel, shrine, bell, banner, tent,
// stall, taiko, crane, chimney, gearTower, crystal, nest, bones, statue, signpost, well,
// bench, fountain, bookshelf, vent, campfire, flag, bridgeLantern, candle.
//
// `concept` names each map's track silhouette (Tracks v3 plan: no two maps share one).
//
// Gate Arc fields (optional): `city` carries the city kit's render hints (src/render/city/cityKit.js);
// `echoOf` names the Act I map an echo map re-skins (the same place in another era: its rows, paths,
// crossings and tunnels stay literal, so the silhouette tests exempt the declared pair only) and
// `echoDiff` lists the tiles whose terrain the story changed ([{ x, y, from, to }], e.g. the dry
// fountain basin '~' → '.').

import {
  buildMapTracks, stampTracks, mapTracks, BAND_HALF_WIDTH, arc, spiral, curve, loopNodes, LINE, TUNNEL_IN, TUNNEL_OUT,
} from '../core/track.js';
// engine-independent trig (core/detMath.js): map geometry must be bit-identical on every device
import { DET_MATH as DM } from '../core/detMath.js';

// Track authoring shorthands (src/core/track.js): L = the next section is an exact straight,
// IN / OUT = a tunnel starts / ends at the previous control point.
const L = LINE;
const IN = TUNNEL_IN;
const OUT = TUNNEL_OUT;

/**
 * Track nodes for a city street (Gate Arc): straight runs between the corner points, each corner
 * rounded with radius `r` (a quarter circle for a right angle; a list gives one radius per corner).
 * `tunnel` = [from, to], two points on one straight where an underpass starts and ends.
 * @param {number[][]} corners [start, corner…, end]
 * @param {{ r?: number|number[], tunnel?: number[][]|null }} [o]
 */
function street(corners, { r = 1.8, tunnel = null } = {}) {
  const out = [corners[0]];
  const unit = (a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = DM.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  };
  const onRun = (a, b, p) => {
    const u = unit(a, b);
    const t = (p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1];
    const len = DM.hypot(b[0] - a[0], b[1] - a[1]);
    const off = Math.abs((p[0] - a[0]) * u[1] - (p[1] - a[1]) * u[0]);
    return off < 1e-6 && t > 0 && t < len;
  };
  for (let i = 1; i < corners.length; i++) {
    const a = corners[i - 1];
    const c = corners[i];
    const u = unit(a, c);
    const rr = Array.isArray(r) ? r[i - 1] : r;
    out.push(L);
    if (tunnel && onRun(a, c, tunnel[0]) && onRun(a, c, tunnel[1])) out.push(tunnel[0], IN, L, tunnel[1], OUT, L);
    if (i === corners.length - 1) {
      out.push(c);
      break;
    }
    const v = unit(c, corners[i + 1]);
    const A = [c[0] - u[0] * rr, c[1] - u[1] * rr];
    const B = [c[0] + v[0] * rr, c[1] + v[1] * rr];
    const O = [A[0] + v[0] * rr, A[1] + v[1] * rr];
    const k = rr / Math.SQRT2;
    const M = [O[0] + (u[0] - v[0]) * k, O[1] + (u[1] - v[1]) * k];
    out.push(A, M, B);
  }
  return out.map((p) => (Array.isArray(p) ? [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4] : p));
}

/**
 * A declared echo (Gate Arc): the Act I map `spec` in another era. The rows stay literal except
 * the tiles `echoDiff` lists ([{ x, y, w?, h?, from, to }], written in place here), the paths and
 * crossings are the original's own objects, and the rest (theme, decor, words, city hints) is new.
 */
function echoMap(spec, o) {
  const rows = spec.rows.map((r) => r.split(''));
  for (const d of o.echoDiff) {
    for (let y = d.y; y < d.y + (d.h ?? 1); y++) for (let x = d.x; x < d.x + (d.w ?? 1); x++) rows[y][x] = d.to;
  }
  return { ...o, echoOf: spec.id, rows: rows.map((r) => r.join('')), paths: spec.paths, crossings: spec.crossings };
}

/** Footprint radius of an ordinary girl (sim/placement.js TOWER_RADIUS) — for buildable-tile counts. */
const TOWER_R = 0.42;

/**
 * Builds a MapDef: samples the authored path specs into dense centrelines (src/core/track.js),
 * resolves crossings (flat junction or bridge), then stamps the paths into the terrain rows so
 * the data stays honest: water under the road becomes 'B' (a bridge or boardwalk) and
 * trees/rocks/buildings/flowers under it are cleared to '.'. Void ('X') is never cleared —
 * tests fail if a path runs through it.
 * @param {object} o map fields; `rows` are the unstamped terrain rows, `paths` the path specs
 * @returns {object} MapDef
 */
export function defineMap(o) {
  const grid = o.rows.map((r) => r.split(''));
  const height = grid.length;
  const width = grid[0].length;
  const { tracks, crossings, tiles: onPath } = buildMapTracks(o.paths, o.crossings ?? 'bridge');
  // Gate Arc Step 3: a lane that starts inside the board (a rift on the lake, 3-8). The sim spawns at a track's first
  // point anyway (track.js ignores the key); the renderer drops the head run-out and stands the rift gate there.
  (o.paths || []).forEach((spec, i) => { if (spec && !Array.isArray(spec) && spec.inside) tracks[i].inside = true; });
  for (const key of onPath) {
    const [x, y] = key.split(',').map(Number);
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const ch = grid[y][x];
    if (ch === '~') grid[y][x] = 'B';
    else if (ch === 'T' || ch === 'R' || ch === 'H' || ch === ',') grid[y][x] = '.';
    // void ('X') and rooftops ('U') stay: a road may not run through either (tests)
  }
  // Set pieces on land occupy their tile (drawn instead of a generic building).
  for (const d of o.decor || []) {
    const ch = grid[d.y]?.[d.x];
    if ((ch === '.' || ch === ',') && !onPath.has(`${d.x},${d.y}`)) grid[d.y][d.x] = 'H';
  }
  return {
    id: o.id,
    name: o.name,
    theme: o.theme,
    tier: o.tier,
    width,
    height,
    rows: grid.map((r) => r.join('')),
    // Canonical centrelines (world coords, dense): what the sim walks and the renderer draws.
    tracks,
    // Where paths cross: { x, y, a: {path, d}, b: {path, d}, angle, mode: 'flat'|'bridge', over: 'a'|'b'|null }
    crossings,
    // Legacy view: the same dense centrelines in tile coordinates (tile centre = integer), so
    // older readers that add 0.5 still land on the canonical curve.
    paths: tracks.map((t) => t.points.map(([x, y]) => [Math.round((x - 0.5) * 1e4) / 1e4, Math.round((y - 0.5) * 1e4) / 1e4])),
    decor: o.decor || [],
    // optional per-map looks merged over the theme's (src/render/terrain.js): `bridge` (e.g.
    // { overpass, girder, grating: true } for a steel-grating overpass), `path` (e.g. { style:
    // 'belt' } for conveyor belts) and `tunnel` (e.g. ice-cave colours)
    ...(o.bridge ? { bridge: o.bridge } : {}),
    ...(o.path ? { path: o.path } : {}),
    ...(o.tunnel ? { tunnel: o.tunnel } : {}),
    // optional composed ground features (src/render/groundFeatures.js): { type: 'vat', x, y, w, h }
    // machined tank rim, { type: 'icefall', x0, x1, y } frozen falls, { type: 'runeRing', x, y, r }
    ...(o.ground ? { ground: o.ground } : {}),
    // Gate Arc (see the header): the city kit's render hints and a declared echo of an Act I map
    ...(o.city ? { city: o.city } : {}),
    // Gate Arc Step 3: a district of its theme ('oldtown' on city maps: the old-house block set, STEP3_BUILD_PLAN §2.5)
    ...(o.district ? { district: o.district } : {}),
    ...(o.echoOf ? { echoOf: o.echoOf, echoDiff: o.echoDiff || [] } : {}),
    desc: o.desc,
    concept: o.concept || '',
  };
}

/** Blossom Court (1-5): its own map, and the ground the Dry Fountain (1-10) echoes. */
const BLOSSOM_COURT = {
  id: 'sakura_court', name: 'Blossom Court', theme: 'sakura', tier: 'intermediate',
  desc: 'The academy\'s grand courtyard. The road spirals in around the fountain, bridges over its own outer ring and leaves under the arcade.',
  concept: 'Fountain spiral, bridge over the outer ring, arcade tunnel',
  rows: [
    'TTTTT,,TTTTTT,,TTTTT',
    'T.....,......,.....T',
    'T..................T',
    'T.,...,....,....,..T',
    'T........,.........T',
    'T.......~~~........T',
    '.......~~~~~.....,.T',
    'T.......~~~........T',
    'T..,...........,...T',
    'T..................T',
    'T.,....,.....,...,.T',
    'TTTTTTTTHHHHHTTTTTTT',
  ],
  paths: [
    [[-1, 2.5], L, [1.0, 2.5], [4.2, 1.6], [8.0, 1.3], [12.0, 1.4], [15.4, 2.0], [17.2, 4.0], [17.2, 7.2], [15.6, 9.4], [12.4, 10.1], [8.4, 10.1], [5.0, 9.4], [3.2, 7.6], [3.4, 5.2], [5.2, 3.7], [8.2, 3.3], [11.4, 3.5], [13.6, 4.6], [14.0, 6.6], [12.4, 8.0], [10.6, 8.3], [10.0, 9.2], IN, [10.0, 11.2], OUT, L, [10.0, 13.0]],
  ],
  decor: [
    { type: 'fountain', x: 9, y: 6 }, { type: 'sakura', x: 0, y: 3 }, { type: 'sakura', x: 19, y: 8 },
    { type: 'stoneLantern', x: 6, y: 6 }, { type: 'bench', x: 15, y: 6 },
  ],
};

/** Inner Sanctum (3-5): its own map, and the ground the Lakeside Shrine (3-10) echoes. */
const SHRINE_SANCTUM = {
  id: 'shrine_sanctum', name: 'Inner Sanctum', theme: 'shrine', tier: 'advanced',
  desc: 'Two pilgrim roads sweep in past the mirror ponds, meet before the sanctum doors, pass beneath the sanctum itself and wind down past the bell garden.',
  concept: 'Y + sanctum tunnel: two roads merge, then run under the sanctum',
  rows: [
    'TTTTT,TTTTTTTTT,TTTT',
    '...............,...T',
    'T.,..~~~.,......~~.T',
    'T...~~~~~.......~~.T',
    'T..,.~~~....HHH.,..T',
    'T...........HHH....T',
    'T..,.......HHHHH....',
    'T...........HHH....T',
    'T.,..~~~....HHH....T',
    'T...~~~~~.......,..T',
    '.....~~~.......,...T',
    'TTTTT,TTTTTTTTT,TTTT',
  ],
  paths: [
    [[-1, 1.0], L, [0.6, 1.0], [2.3, 1.8], [3.0, 3.6], [4.3, 5.3], [6.4, 6.3], [8.0, 6.6], L, [12.3, 6.6], IN, L, [14.7, 6.6], OUT, L, [15.4, 6.6], [17.0, 7.3], [17.6, 8.9], [16.4, 10.1], [14.2, 9.8], [12.2, 9.7], [10.9, 10.4], [10.5, 11.6], L, [10.5, 13]],
    { nodes: [[-1, 11.2], L, [0.6, 11.2], [2.3, 10.4], [3.0, 8.6], [4.3, 7.6], [6.4, 6.9]], join: { path: 0, at: [8.6, 6.6] } },
  ],
  decor: [
    { type: 'torii', x: 11, y: 4 }, { type: 'bell', x: 17, y: 4 }, { type: 'stoneLantern', x: 11, y: 3 },
    { type: 'stoneLantern', x: 1, y: 5 }, { type: 'sakura', x: 18, y: 1 },
  ],
};

export const MAPS = [
  // -------------------------------------------------------------------------
  // Chapter 1 — Sakura Gardens (sakura)
  // -------------------------------------------------------------------------
  defineMap({
    id: 'sakura_terrace', name: 'Academy Terrace', theme: 'sakura', tier: 'beginner',
    desc: 'A gentle S along the upper terrace, one switchback down the steps beside the lily pond, and a stroll back to the lower gate. A girl inside the switchback covers both terraces — the perfect first defense.',
    concept: 'Terrace switchback: a gentle S out along the upper terrace, one hairpin down the steps, back along the lower terrace',
    rows: [
      'TTTT,..TTTTT..,.TTTT',
      'T.....,.......,....T',
      '..,......,.........T',
      'T.........,........T',
      'T.,.......,........T',
      'T.....,............T',
      'T..~~~.............T',
      'T.~~~~..,......,...T',
      'T..~~...........,..T',
      'TT..,....,.....,..TT',
      'TTTTTT..TTTTTT,TTTTT',
    ],
    paths: [
      [[-1, 2.2], L, [1.0, 2.2], [4.0, 2.5], [7.4, 3.6], [10.8, 3.5], [13.4, 2.9], [15.2, 3.6], [15.7, 5.2], [14.4, 6.5], [11.4, 6.9], [8.6, 7.1], [7.2, 8.2], [6.9, 9.6], L, [6.9, 12]],
    ],
    decor: [
      { type: 'sakura', x: 17, y: 5 }, { type: 'bench', x: 17, y: 8 }, { type: 'stoneLantern', x: 9, y: 9 },
      { type: 'signpost', x: 1, y: 4 }, { type: 'sakura', x: 3, y: 4 },
    ],
  }),
  defineMap({
    id: 'sakura_lane', name: 'Petal Lane', theme: 'sakura', tier: 'beginner',
    desc: 'A brook-side lane that meanders in three soft loops through the academy gardens, the koi pond in the middle bend.',
    concept: 'Meandering brook: three soft lobes, koi pond in the middle one',
    rows: [
      'TTT..,...TTT.,.TTT',
      'TT.......,......TT',
      '.................T',
      '.,...,.....,.....T',
      '.................T',
      'R......~~~.......R',
      '......~~~~~.......',
      'T.,....~~~...,...T',
      '..................',
      'TT..,....TT...,.TT',
      'TTTT.TTTTTTT.TTTTT',
    ],
    paths: [
      [[-1, 7.5], L, [1, 7.5], [2.6, 6.3], [3.1, 4.0], [4.6, 2.4], [6.6, 2.6], [7.5, 4.1], [6.2, 5.9], [5.6, 7.9], [7.3, 9.1], [10.2, 9.0], [11.7, 7.6], [11.3, 5.3], [11.6, 3.2], [13.3, 2.2], [15.2, 2.7], [16.0, 4.5], L, [16.0, 5.0], [16.6, 6.2], [17.6, 6.5], L, [19, 6.5]],
    ],
    decor: [
      { type: 'sakura', x: 1, y: 9 }, { type: 'sakura', x: 16, y: 0 }, { type: 'stoneLantern', x: 9, y: 4 },
      { type: 'bench', x: 14, y: 5 }, { type: 'signpost', x: 0, y: 3 },
    ],
  }),
  defineMap({
    id: 'sakura_loop', name: 'Blossom Loop', theme: 'sakura', tier: 'beginner',
    desc: 'The path loops once around the oldest cherry grove and crosses its own tail on a little wooden bridge.',
    concept: 'Loop-the-loop around the grove, bridge over its own tail',
    rows: [
      'TTTT..,.TTTT..,TTT',
      'T.....,......,...T',
      '...,..............',
      'T......TTT......,.',
      '..,....T~~T.......',
      '.......T~~T.......',
      'T.,......,.....,.T',
      '..................',
      '..~~~.............',
      '.~~~~.............',
      'TTTT,.TTTT...TTTTT',
    ],
    paths: [
      [[-1, 6.5], L, [3.5, 6.5], [7.5, 6.6], [11.2, 5.8], [12.4, 3.6], [11.0, 1.7], [8.2, 1.4], [5.8, 2.2], [4.8, 4.4], [5.5, 6.9], [7.6, 8.5], [11.0, 8.9], [14.4, 8.5], [16.6, 7.6], L, [19, 7.6]],
    ],
    decor: [
      { type: 'sakura', x: 9, y: 3 }, { type: 'well', x: 14, y: 4 }, { type: 'bench', x: 14, y: 6 },
      { type: 'stoneLantern', x: 3, y: 4 }, { type: 'sakura', x: 1, y: 0 },
    ],
  }),
  defineMap({
    id: 'sakura_creek', name: 'Sakura Creek', theme: 'sakura', tier: 'beginner',
    desc: 'The lane follows the petal-strewn creek down one bank and back up the other, crossing it on two little bridges — the first place water girls can stand.',
    concept: 'Creek-hugger: follows both banks, two bridges (river idea)',
    rows: [
      'TTT..,...~~..,..TTTT',
      '.........~~.........',
      'T.,......~~......,.T',
      'TT......,~~,.......T',
      '.........~~.........',
      '..R.....~~~.....,..T',
      'T.,.....~~~~......TT',
      '.........~~.........',
      'TT......,~~.....,...',
      'T........~~~.......T',
      '.........~~.........',
      'TTTT..TT.~~.TTT..TTT',
    ],
    paths: [
      [[-1, 1.5], L, [2, 1.5], [5.4, 1.7], [7.2, 3.0], [7.3, 5.2], [8.6, 6.6], [10.4, 6.9], [12.3, 5.9], [12.5, 3.6], [13.6, 1.8], [16.2, 1.5], [17.8, 3.2], [17.6, 6.0], [16.4, 8.6], [13.8, 9.8], [10.4, 10.2], [7.2, 9.7], [4.8, 8.8], [3.4, 7.0], [1.6, 6.2], L, [-1, 6.2]],
    ],
    decor: [
      { type: 'waterwheel', x: 10, y: 3 }, { type: 'sakura', x: 0, y: 8 }, { type: 'sakura', x: 18, y: 0 },
      { type: 'stoneLantern', x: 5, y: 5 }, { type: 'bench', x: 15, y: 5 },
    ],
  }),
  defineMap(BLOSSOM_COURT),

  // -------------------------------------------------------------------------
  // Chapter 2 — Moonlit Lakeshore (lake) — lots of water
  // -------------------------------------------------------------------------
  defineMap({
    id: 'lake_shore', name: 'Moonlit Shore', theme: 'lake', tier: 'beginner',
    desc: 'The path traces the shoreline, then runs all the way out along the lighthouse spit and back. Half the map is water for Sango and Nami; the spit tip covers both passes.',
    concept: 'Coastline: hugs the shore, then runs out and back along the lighthouse spit',
    rows: [
      'TTTT..,....TTT..,TTT',
      'T......,.......,...T',
      '.........R..........',
      'T.,.................',
      '.....,..........,...',
      '~~~.........,.....~~',
      '~~~~~...........~~~~',
      '~~~~~~~......~~~~~~~',
      '~~~~~~~~....~~~~~~~~',
      '~~~~~~~~....~~~~~~~~',
      '~~~~~~~~~..~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~',
    ],
    paths: [
      [[-1, 4.2], L, [1.2, 4.2], [3.4, 4.6], [5.4, 5.6], [7.0, 6.9], [7.9, 8.6], [8.6, 10.2], [9.9, 10.9], [11.2, 10.2], [11.7, 8.6], [12.4, 6.9], [14.0, 5.6], [16.2, 4.7], [18.4, 4.2], L, [21, 4.2]],
    ],
    decor: [
      { type: 'pier', x: 13, y: 10 }, { type: 'boat', x: 5, y: 9 }, { type: 'stoneLantern', x: 8, y: 2 },
      { type: 'willow', x: 2, y: 0 }, { type: 'boat', x: 15, y: 9 },
    ],
  }),
  defineMap({
    id: 'lake_reeds', name: 'Reed Maze', theme: 'lake', tier: 'intermediate',
    desc: 'The boardwalk winds down from the north shore and splits around the great reed bed — two lanes, then one again. Every gap is water.',
    concept: 'Reed eye: the boardwalk forks around the reed bed and rejoins',
    rows: [
      '~~TT~~~TT~~~~TT~~~~~',
      '~.,..~~..,.~~..,.~~~',
      '......~~~.......~~~~',
      '~~..,.~~~~.,..,.~~~~',
      '~~~...~~~~..~~~..~~~',
      '~~~~.~~~~~..~~~~.~~~',
      '~~~..~~~~,..~~~..~~~',
      '~~,..~~~~...~~~~.,~~',
      '~~...~~~~~.~~~~...~~',
      '~~....~~..~~~.......',
      '~~..,..~~~~~~.,..~~~',
      '~~~~TT~~~~~~TT~~~~~~',
    ],
    paths: [
      [[9.5, -1], L, [9.5, 0.3], [8.0, 1.6], [5.4, 1.5], [3.2, 2.4], [2.4, 4.6], [3.4, 7.6], [5.6, 8.8], [7.6, 7.8], [8.6, 5.8], [10.2, 3.4], [12.6, 2.6], [15.0, 3.4], [16.4, 5.6], [16.8, 7.8], [17.6, 9.2], [19.0, 9.6], L, [21, 9.6]],
      { fork: { path: 0, at: [7.0, 8.3] }, nodes: [[9.8, 9.5], [12.6, 10.1], [15.6, 10.1]], join: { path: 0, at: [19.8, 9.6] } },
    ],
    decor: [
      { type: 'boat', x: 7, y: 4 }, { type: 'lantern', x: 6, y: 5 }, { type: 'willow', x: 13, y: 0 },
      { type: 'pier', x: 18, y: 6 }, { type: 'lantern', x: 13, y: 6 },
    ],
  }),
  defineMap({
    id: 'lake_isles', name: 'Lantern Isles', theme: 'lake', tier: 'intermediate',
    desc: 'Three lantern-lit islands joined by long curving bridges. Land is scarce; the lake is yours.',
    concept: 'Island hop: three islands, long diagonal bridges',
    rows: [
      '~~~~~~~~~~~~~~~~~~~~',
      '~~TT,..~~~~~~~T.,.~~',
      '~~....~~~~~~~~....~~',
      '~.,..R.~~~~~~~.,..~~',
      '~.T....~~~~~~~....T~',
      '.......~~~~~~~~...~~',
      '~~..,..~~~~~~~~..~~~',
      '~~~....~~...~~~..~~~',
      '~~~~~~~~...,..~..~~~',
      '~~~~~~.T......~..~~~',
      '~~~~~~~TT...~~~..~~~',
      '~~~~~~~~~~~~~~~..~~~',
    ],
    paths: [
      [[-1, 5.5], L, [1.0, 5.5], [3.2, 4.6], [4.4, 2.8], [6.4, 2.6], [8.4, 4.4], [9.4, 7.0], [10.6, 9.0], [12.6, 8.8], [13.6, 6.6], [14.4, 3.8], [15.8, 2.2], [17.6, 2.8], [18.0, 4.8], [17.2, 7.0], [16.6, 9.4], L, [16.6, 13.0]],
    ],
    decor: [
      { type: 'lantern', x: 10, y: 10 }, { type: 'lantern', x: 15, y: 4 }, { type: 'shrine', x: 2, y: 6 },
      { type: 'boat', x: 4, y: 9 }, { type: 'boat', x: 12, y: 3 },
    ],
  }),
  defineMap({
    id: 'lake_ferry', name: 'Twin Ferry', theme: 'lake', tier: 'intermediate',
    desc: 'Two ferry roads wind along opposite banks and cross the wide river together, one ferry bridge riding over the other mid-stream. Enemies arrive on both lanes at once.',
    concept: 'Ferry hourglass: two lanes from the north bank cross the river once, one ferry bridge over the other, and leave by the far bank',
    rows: [
      'TTT..,....TTT..,.TTT',
      '....................',
      'T.,......TTTT.....,T',
      '~~~~..~~~~~~~~..~~~~',
      '~~~~~~~~~~~~~~~~~~~~',
      '~~~..~~~~~~~~~~..~~~',
      '~~~..~~~~~~~~~~..~~~',
      '~~~~~~~~~~~~~~~~~~~~',
      '~~~~..~~~~~~~~..~~~~',
      'T.,......TTTT.....,T',
      '....................',
      'TTT..,....TTT..,.TTT',
    ],
    paths: [
      [[2.5, -1], L, [2.5, 0.2], [3.1, 2.0], [4.7, 3.3], [6.4, 2.5], [7.4, 1.2], [8.8, 1.5], [9.0, 3.4], [10.0, 6.0], [11.0, 8.6], [11.4, 10.5], [12.8, 10.7], [13.8, 9.5], [15.3, 8.7], [16.9, 9.9], [17.5, 11.6], L, [17.5, 13]],
      [[17.5, -1], L, [17.5, 0.2], [16.9, 2.0], [15.3, 3.3], [13.6, 2.5], [12.6, 1.2], [11.2, 1.5], [11.0, 3.4], [10.0, 6.0], [9.0, 8.6], [8.6, 10.5], [7.2, 10.7], [6.2, 9.5], [4.7, 8.7], [3.1, 9.9], [2.5, 11.6], L, [2.5, 13]],
    ],
    decor: [
      { type: 'boat', x: 3, y: 6 }, { type: 'boat', x: 16, y: 5 }, { type: 'pier', x: 1, y: 4 },
      { type: 'pier', x: 18, y: 7 }, { type: 'willow', x: 0, y: 9 },
    ],
  }),
  defineMap({
    id: 'lake_moonpier', name: 'Moonlight Pier', theme: 'lake', tier: 'advanced',
    desc: 'The road follows the whole moon-lake shore, then turns out along the old moon pier straight across the water — and leaves under the shore road\'s little bridge. Water girls rule both halves of the lake.',
    concept: 'Slashed O: one lap of the lake shore, then a diagonal pier across the water and out under the shore road',
    crossings: ['bridgeUnder'],
    rows: [
      'TTTT,,TTTTTTTT,,TTTT',
      '...................T',
      'T..,.....~~~..,....T',
      'T.....~~~~~~~~~....T',
      'T...~~~~~~~~~~~~...T',
      'T..~~~~~~~~~~~~~~..T',
      'T..~~~~~~~~~~~~~~..T',
      'T..~~~~~~~~~~~~~~..T',
      'T....~~~~~~~~~~....T',
      'T,.................T',
      'T..................T',
      'TTTT,,TTTT..TTTTTTTT',
    ],
    paths: [
      [[-1, 1.5], L, [1.0, 1.5], [4.0, 1.3], [8.0, 1.1], [12.0, 1.2], [15.6, 1.6], [17.8, 3.4], [18.3, 6.0], [17.6, 8.6], [15.4, 9.9], [11.6, 10.2], [7.6, 10.2], [4.2, 9.8], [2.1, 8.4], [1.5, 6.4], [2.0, 4.5], [3.6, 3.7], [5.4, 4.4], [7.4, 6.3], [9.2, 8.6], [10.2, 10.2], [10.6, 11.4], L, [10.6, 13]],
    ],
    decor: [
      { type: 'shrine', x: 13, y: 5 }, { type: 'boat', x: 5, y: 7 }, { type: 'lantern', x: 6, y: 2 },
      { type: 'willow', x: 18, y: 10 }, { type: 'boat', x: 14, y: 8 },
    ],
  }),

  // -------------------------------------------------------------------------
  // Chapter 3 — Moonveil Shrine (shrine)
  // -------------------------------------------------------------------------
  defineMap({
    id: 'shrine_gate', name: 'Torii Corridor', theme: 'shrine', tier: 'intermediate',
    desc: 'Two long straights beneath a hundred torii gates narrow into a keyhole loop around the spirit pond. Veils hang thick between the pillars.',
    concept: 'Torii keyhole: two beam lanes, a narrow neck and a round loop at the end',
    rows: [
      'TTTTTTT,TTTTTTTTTTTT',
      'T.H...H...H........T',
      '...................T',
      'T.H...H...H........T',
      'T..,..........~~...T',
      'T...,........~~~~..T',
      'T..,..........~~...T',
      'T.H...H...H........T',
      '...................T',
      'T.H...H...H....,...T',
      'TTTTTTTTTTTT,TTTTTTT',
    ],
    paths: [
      [[-1, 2.5], L, [9.4, 2.5], [11.8, 3.5], [13.6, 2.2], [16.2, 1.9], [18.0, 3.6], [18.2, 5.4], [17.6, 7.4], [15.8, 8.8], [13.6, 8.6], [11.8, 7.5], [9.4, 8.5], L, [-1, 8.5]],
    ],
    decor: [
      { type: 'shrine', x: 14, y: 4 }, { type: 'stoneLantern', x: 4, y: 5 }, { type: 'stoneLantern', x: 9, y: 5 },
      { type: 'bell', x: 1, y: 5 }, { type: 'sakura', x: 12, y: 10 },
    ],
  }),
  defineMap({
    id: 'shrine_steps', name: 'Thousand Steps', theme: 'shrine', tier: 'intermediate',
    desc: 'Stone stairs switch back down the shrine hill past a misty koi pond; one bend dives through the hill itself.',
    concept: 'Hillside switchbacks with a short tunnel through the hill',
    rows: [
      'TTTTTT.HH.TTTT,TTT',
      '.....,.....,...TTT',
      'TT..,...H.....,.TT',
      'T................T',
      'RRR.....,......,.T',
      'RRRR..............',
      'RRR.........,....R',
      '.~~~............R.',
      '.~~~~~....H......T',
      'T.~~~~.......,...T',
      'TT.~~..,...TT...TT',
      'TTTT,..TTTTTTT..TT',
    ],
    paths: [
      [[-1, 1.5], L, [1.0, 1.5], [3.6, 1.6], [5.6, 2.3], [5.9, 3.8], [4.4, 4.6], [3.2, 4.6], IN, [1.5, 5.1], [1.4, 6.6], OUT, [3.2, 7.2], [6.6, 7.0], [9.6, 6.4], [12.0, 6.8], [13.0, 8.6], L, [13.0, 13.0]],
    ],
    decor: [
      { type: 'torii', x: 6, y: 0 }, { type: 'stoneLantern', x: 8, y: 4 }, { type: 'stoneLantern', x: 11, y: 9 },
      { type: 'bell', x: 9, y: 9 }, { type: 'sakura', x: 0, y: 9 },
    ],
  }),
  defineMap({
    id: 'shrine_spiral', name: 'Moonveil Spiral', theme: 'shrine', tier: 'intermediate',
    desc: 'The pilgrim road spirals twice around the inner sanctum, then climbs straight out over its own rings on a raised stone causeway.',
    concept: 'Spiral & causeway: two rounded rings in, a raised causeway bridging every ring out',
    rows: [
      'TTTTTT,TT..TTTTT,TTT',
      '...................T',
      'TT.,....H..H....,..T',
      'T..................T',
      'T..,......~.....,..T',
      'T..................T',
      'T..,...~~~~~~...,..T',
      'T......~~~~~~~.....T',
      'T..................T',
      'T..,.........,.....T',
      'T..................T',
      'TTT~~~TTTTTTT,,TTTTT',
    ],
    paths: [
      [[-1, 1.3], L, [15.4, 1.3], [17.6, 2.2], [18.4, 4.4], L, [18.4, 7.6], [17.6, 9.8], [15.4, 10.7], L, [4.6, 10.7], [2.4, 9.8], [1.6, 7.6], L, [1.6, 5.6], [2.4, 4.0], [4.4, 3.4], L, [13.6, 3.4], [15.6, 4.2], [16.2, 6.0], [15.6, 7.8], [13.6, 8.5], L, [6.4, 8.5], [4.6, 7.8], [4.0, 6.6], [4.8, 5.6], [6.4, 5.4], L, [10.0, 5.4], [11.6, 5.0], [12.0, 3.6], L, [12.0, -1]],
    ],
    decor: [
      { type: 'shrine', x: 9, y: 6 }, { type: 'torii', x: 7, y: 6 }, { type: 'stoneLantern', x: 12, y: 6 },
      { type: 'bell', x: 14, y: 6 }, { type: 'sakura', x: 19, y: 11 },
    ],
  }),
  defineMap({
    id: 'shrine_garden', name: 'Koi Garden', theme: 'shrine', tier: 'advanced',
    desc: 'A figure-eight garden walk around two koi ponds. The waist where it crosses itself, under a stone bridge, is the key spot.',
    concept: 'Figure-eight around two koi ponds, stone bridge at the waist',
    rows: [
      'TTT,,TTTTT..TTT,TTTT',
      'T.......H...H......T',
      '...................T',
      'T...~~~~.......,...T',
      'T..~~~~~~....~~~~..T',
      'T...~~~~....~~~~~~.T',
      'T..........,.~~~~..T',
      'TT.................T',
      'T..R......,........T',
      'T..................T',
      'TT..,....,....,...TT',
      'TTT..TTTTTTTTTTTTTTT',
    ],
    paths: [
      [[-1, 2.0], L, [1.0, 2.0], [3.6, 1.6], [7.0, 1.8], [9.0, 3.4], [10.2, 5.6], [11.6, 7.8], [14.0, 8.8], [16.8, 8.2], [18.2, 6.0], [17.6, 3.6], [15.4, 2.4], [12.6, 2.6], [10.8, 4.4], [9.4, 6.6], [7.6, 8.4], [5.0, 8.6], [2.8, 8.0], [1.8, 9.4], [2.4, 11.0], L, [2.4, 13.0]],
    ],
    decor: [
      { type: 'torii', x: 1, y: 3 }, { type: 'stoneLantern', x: 9, y: 10 }, { type: 'bridgeLantern', x: 7, y: 5 },
      { type: 'sakura', x: 13, y: 6 }, { type: 'shrine', x: 5, y: 6 },
    ],
  }),
  defineMap(SHRINE_SANCTUM),

  // -------------------------------------------------------------------------
  // Chapter 4 — Ironhold Pass (mountain)
  // -------------------------------------------------------------------------
  defineMap({
    id: 'mountain_pass', name: 'Ironhold Switchbacks', theme: 'mountain', tier: 'intermediate',
    desc: 'Round hairpins climb the pass, the road crosses the snowmelt river on a single bridge, ducks through a rock tunnel and runs down the far side.',
    concept: 'Alpine switchbacks: stacked hairpins, one river bridge, a rock tunnel',
    rows: [
      'RRRR..RRRRR~~RRRRRRR',
      'RR.......,.~~..RRRRR',
      'R..........~~.....RR',
      'R.,........~~.....,R',
      'R..........~~~.....R',
      'RR.....R..~~~~.....R',
      'R......R..~~~..,...R',
      'R.,....R...~~......R',
      'RR........~~~......R',
      'R...,......~~...,..R',
      '...........~~.......',
      'RRRRRRR..RR~~RRRRRRR',
    ],
    paths: [
      [[-1, 10.2], L, [5.0, 10.2], [7.2, 9.6], [7.8, 8.2], [6.6, 7.2], L, [4.4, 7.2], [2.6, 6.6], [2.2, 5.2], [3.2, 4.2], L, [5.4, 4.0], [9.0, 4.2], [12.0, 4.6], [14.6, 4.2], [15.8, 3.0], IN, [16.6, 1.6], [18.2, 1.4], [18.8, 3.0], OUT, [18.4, 5.0], [16.6, 6.2], [14.6, 6.7], [13.8, 8.3], [15.0, 9.7], [17.4, 10.2], [18.8, 10.4], L, [21, 10.4]],
    ],
    decor: [
      { type: 'pine', x: 5, y: 1 }, { type: 'banner', x: 4, y: 8 }, { type: 'flag', x: 16, y: 8 },
      { type: 'waterwheel', x: 12, y: 9 }, { type: 'campfire', x: 5, y: 5 },
    ],
  }),
  defineMap({
    id: 'mountain_bridge', name: 'Sky Bridge', theme: 'mountain', tier: 'advanced',
    desc: 'The road dives down into the gorge and climbs out the other side on one long rope bridge over the roaring river — the only way across for orc and girl alike.',
    concept: 'Ravine dip: swoops down, one long diagonal rope bridge, climbs out',
    rows: [
      'RRRRRRRR.~~~~.RRRRRRRR',
      'R......,.~~~~.....,.RR',
      'R..,.....~~~~..,.....R',
      '........R~~~~R........',
      'R.,....R.~~~~.R....,.R',
      'RR.......~~~~.......RR',
      'R...,....~~~~...,....R',
      'R.......~~~~~~......RR',
      'R..,....~~~~~~..,...RR',
      'R........~~~~.......RR',
      'R.,..R...~~~~...R.,.RR',
      'RRRRRRRR.~~~~.RRRRRRRR',
    ],
    paths: [
      [[-1, 2.6], L, [1.4, 2.6], [4.2, 3.4], [6.0, 5.6], [6.4, 8.4], L, [6.6, 9.2], [8.0, 9.6], L, [14.2, 5.2], [16.0, 4.8], [17.6, 6.4], ...arc(19.1, 8.2, 1.45, 180, 0, 45), L, [20.55, 5.0], L, [20.55, -1]],
    ],
    decor: [
      { type: 'pine', x: 2, y: 6 }, { type: 'pine', x: 16, y: 8 }, { type: 'flag', x: 4, y: 10 },
      { type: 'campfire', x: 17, y: 1 }, { type: 'statue', x: 3, y: 8 },
    ],
  }),
  defineMap({
    id: 'mountain_gorge', name: 'Twin Gorge', theme: 'mountain', tier: 'advanced',
    desc: 'Two canyons tumble down from the high corners and meet at the valley floor; the joined road climbs back up past the mountain tarn. Watch both entrances.',
    concept: 'Trident: two canyons fall to the valley floor and merge, the road climbs out the middle',
    rows: [
      'RRRR.RRRRR.RRRRR.RRR',
      'R..........~~~.....R',
      'R.....R...~~~~~....R',
      'R..,..R....~~~...R.R',
      'RR....,..........,.R',
      'R....R.............R',
      'R..RR...........,..R',
      'R..................R',
      'RR..,...........R..R',
      'R..................R',
      'R..,.....R....,....R',
      'RRRRRRRRRRRRRRRRRRRR',
    ],
    paths: [
      [[4.5, -1], L, [4.5, 0.6], [3.6, 2.4], [2.6, 4.4], [2.6, 6.8], [4.0, 8.8], [6.6, 9.8], [9.0, 9.4], [10.0, 7.8], [9.6, 5.8], [8.4, 4.2], [8.6, 2.2], [10.2, 0.6], L, [10.5, -1]],
      { nodes: [[16.5, -1], L, [16.5, 0.6], [17.4, 2.4], [17.6, 4.8], [16.6, 7.6], [14.2, 9.6], [11.6, 9.4]], join: { path: 0, at: [10.0, 7.6] } },
    ],
    decor: [
      { type: 'pine', x: 1, y: 2 }, { type: 'pine', x: 18, y: 7 }, { type: 'banner', x: 6, y: 6 },
      { type: 'statue', x: 13, y: 6 }, { type: 'campfire', x: 6, y: 2 },
    ],
  }),
  defineMap({
    id: 'mountain_fortress', name: 'Ironhold Gate', theme: 'mountain', tier: 'advanced',
    desc: 'Two mountain roads hook around the castle moats like pincers, meet before the Ironhold gate and run beneath the gatehouse.',
    concept: 'Pincer: two roads hook round the two moats, meet, then pass under the gatehouse',
    rows: [
      'RRRRR,RRRRRRRRR,RRRR',
      'R.....,.....,......R',
      'R.................,R',
      'R...~~~~...H...H...R',
      'R..~~~~~~..........R',
      'R...~~~~....HHH....R',
      'R...........HHH.....',
      'R...~~~~....HHH....R',
      'R..~~~~~~..........R',
      'R...~~~~...H...H.,.R',
      'R.....,.....,......R',
      'RRRRR,RRRRRRRRR,RRRR',
    ],
    paths: [
      [[8.5, -1], L, [8.5, 0.2], [7.4, 1.4], [4.8, 1.6], [2.6, 2.0], [1.4, 3.6], [1.8, 5.2], [3.8, 6.0], L, [9.6, 6.2], [11.0, 6.4], L, [11.6, 6.4], IN, L, [15.2, 6.4], OUT, L, [21, 6.4]],
      { nodes: [[8.5, 13], L, [8.5, 11.8], [7.4, 10.6], [4.8, 10.4], [2.6, 10.0], [1.4, 8.4], [1.8, 7.1], [3.6, 6.4]], join: { path: 0, at: [6.0, 6.0] } },
    ],
    decor: [
      { type: 'banner', x: 10, y: 3 }, { type: 'banner', x: 10, y: 9 }, { type: 'flag', x: 17, y: 2 },
      { type: 'campfire', x: 7, y: 4 }, { type: 'statue', x: 17, y: 9 },
    ],
  }),
  defineMap({
    id: 'mountain_bastion', name: 'Stone Bastion', theme: 'mountain', tier: 'advanced',
    desc: 'The road switchbacks up the bastion\'s flank in two tight hairpins, crosses the gorge at the top, swings down the far side and charges back across the gorge — straight over its own way in on the keep\'s stone bridge. Melee girls inside the hairpins hit two lanes at once.',
    concept: 'Switchback climb: two hairpins up the flank, over the gorge, down the far side and back over its own entrance',
    rows: [
      'RRRRR~~RRRR,RRRRRR',
      'R....~~..........R',
      'R....~~......,...R',
      'R....~~..........R',
      'R....~~..........R',
      'R....~~..R.....,.R',
      '.....~~..........R',
      'R....~~.....,....R',
      'R....~~..........R',
      'R....~~..........R',
      'R..,.~~...........',
      'RRRRR~~RRRRRR.RRRR',
    ],
    paths: [
      [[19, 11.0], L, [15.8, 11.0], ...arc(15.8, 9.2, 1.8, 90, 180, 30), ...arc(12.2, 9.2, 1.8, 0, -90, 30), L, [9.8, 7.4], ...arc(9.8, 5.9, 1.5, 90, 270, 30), L, [13.6, 4.4], ...arc(13.6, 2.9, 1.5, 90, -90, 30), L, [3.8, 1.4], ...arc(3.8, 3.4, 2.0, -90, -180, 30), L, [1.8, 7.6], ...arc(3.8, 7.6, 2.0, 180, 90, 30), L, [12.6, 9.6], [14.0, 9.6], [15.3, 9.4], [16.4, 8.6], [17.2, 7.6], [18.0, 7.2], L, [19, 7.2]],
    ],
    decor: [
      { type: 'banner', x: 14, y: 6 }, { type: 'flag', x: 16, y: 6 }, { type: 'campfire', x: 3, y: 6 },
      { type: 'pine', x: 16, y: 1 }, { type: 'statue', x: 3, y: 3 },
    ],
  }),

  // -------------------------------------------------------------------------
  // Chapter 5 — Gloomfen Marsh (marsh)
  // -------------------------------------------------------------------------
  defineMap({
    id: 'marsh_boardwalk', name: 'Gloomfen Boardwalk', theme: 'marsh', tier: 'intermediate',
    desc: 'A wandering path that wobbles from hummock to hummock on creaking boardwalks over black bog water. Few dry tiles, many wet ones.',
    concept: 'Bog wander: an organic wobble with long boardwalks over the pools',
    rows: [
      'TT~~~TT,~~~~TT~~~TTT',
      'T~~~...~~~~~..~~~..T',
      '~~.....~~~...,..~~~~',
      '~~~~~.....~~~...~~~~',
      '~~...~.,.~~~~..~~~~~',
      'T~~~~~..~~~~~...~~~T',
      'T~~,....~~~~~.,..~~T',
      '~~~...~.~~~~..~~~~~~',
      '~~~..........~~~~~~~',
      '~~~~~...~~~~~~......',
      'T~~~~TT~~~~~T,~~~~~T',
      'TT~~TTTT~~~~TTT~~TTT',
    ],
    paths: [
      [[-1, 2.6], L, [1.0, 2.6], [3.4, 2.2], [5.6, 3.2], [7.0, 5.4], [6.6, 7.6], [8.0, 9.0], [10.4, 8.4], [11.2, 6.2], [12.6, 4.2], [14.8, 3.6], [16.2, 5.2], [15.8, 7.2], [16.8, 8.8], [18.4, 9.4], L, [21, 9.4]],
    ],
    decor: [
      { type: 'willow', x: 0, y: 5 }, { type: 'lantern', x: 4, y: 6 }, { type: 'bones', x: 13, y: 7 },
      { type: 'willow', x: 13, y: 10 }, { type: 'lantern', x: 18, y: 1 },
    ],
  }),
  defineMap({
    id: 'marsh_mire', name: 'Lantern Mire', theme: 'marsh', tier: 'advanced',
    desc: 'Two causeways meet at right angles in the middle of the mire — one rides over the other on a log bridge. Lanterns mark the only dry ground.',
    concept: 'Crossroads: a west-east and a north-south causeway, one bridging the other',
    rows: [
      'TT~~TTT~~~TTTT~~~TTT',
      'T~~...,..~~~..~~~..T',
      '.............~~~~..T',
      '~~~..~~~~,...~~~~~~~',
      '~~~~~~..............',
      '~~~,..~...~~..~~~~~T',
      'T~~...~..,~~..~~~..T',
      '~~~..~~~~~~~..~~~~~~',
      'T~~..,~~~~~~..~~~..T',
      '......~~~~~~........',
      'T~~~..~~TT~~~..~~~~T',
      'TTT~~~TTTT~~~TTTT~~T',
    ],
    paths: [
      [[-1, 4.6], L, [1.0, 4.6], [3.6, 3.4], [6.4, 4.2], [8.6, 6.4], [11.4, 7.2], [13.8, 5.4], [16.2, 3.8], [18.2, 4.8], [18.8, 6.8], [19.6, 7.6], L, [21, 7.6]],
      [[10.5, -1], L, [10.5, 0.2], [11.4, 1.5], [12.9, 2.4], [13.2, 3.9], [11.6, 5.4], [9.6, 7.6], [7.2, 8.4], [4.8, 8.2], [3.6, 9.6], [4.6, 11.0], [6.6, 11.3], [7.6, 12.2], L, [7.6, 13]],
    ],
    decor: [
      { type: 'lantern', x: 3, y: 6 }, { type: 'lantern', x: 16, y: 1 }, { type: 'willow', x: 15, y: 10 },
      { type: 'bones', x: 6, y: 1 }, { type: 'lantern', x: 14, y: 8 },
    ],
  }),
  defineMap({
    id: 'marsh_tangle', name: 'Witchroot Tangle', theme: 'marsh', tier: 'advanced',
    desc: 'Two roads braid through the fen like twisted roots, swapping sides twice — once over a root bridge, once at a muddy crossing. Ghouls blink across the gaps.',
    concept: 'Braid: two roads swap sides twice (one bridge, one flat crossing)',
    crossings: ['bridge', 'flat'],
    rows: [
      'TTTT~.TTTTTTT~~~TTTT',
      'T~~~~.~~...,..~~~..T',
      'T~~..,....~~~...~~.T',
      '...............~~..T',
      '~~~....~~~~~..,.~~~~',
      '~~~,...~~~~~~..~~~~~',
      'T~~...~~~~~~~..~~..T',
      '~~~................~',
      '~~~~..~~~~~~~..~~.~~',
      'T~~~~~~~~~~~~.......',
      'TT~~~~TT~~~~~..~~.~T',
      'TTT~~TTTTT~~~TT~~.TT',
    ],
    paths: [
      [[-1, 2.6], L, [1.0, 2.6], [3.6, 3.0], [6.0, 5.0], [8.0, 8.0], [10.4, 9.4], [13.0, 8.6], [14.6, 6.2], [16.4, 3.4], [18.2, 2.6], L, [21, 2.6]],
      [[-1, 9.4], L, [1.0, 9.4], [3.6, 9.0], [6.0, 7.0], [8.0, 4.0], [10.4, 2.6], [13.0, 3.4], [14.6, 5.8], [16.4, 8.6], [18.2, 9.4], L, [21, 9.4]],
    ],
    decor: [
      { type: 'willow', x: 10, y: 5 }, { type: 'bones', x: 2, y: 6 }, { type: 'lantern', x: 10, y: 11 },
      { type: 'willow', x: 18, y: 5 }, { type: 'statue', x: 10, y: 0 },
    ],
  }),
  defineMap({
    id: 'marsh_hollow', name: 'Sunken Hollow', theme: 'marsh', tier: 'advanced',
    desc: 'The road drops straight through the sunken pool, under the island inside a hollow fallen log, swings round in a great hook and curls back over itself on a log bridge. The pocket inside the curl sees everything.',
    concept: 'Fish-hook: a straight shank down through the pool island (hollow-log tunnel), a big bend, a barb that curls back over its own arm',
    rows: [
      'TTTT~~.TT,TTTT..TTTT',
      'T~~......,.......~~T',
      'T~~~~~~~~~...,.....T',
      'T~~~~~~~~~.........T',
      '~~~~~...~~~..,.....T',
      '.~~~~...~~~........T',
      'T~~~~...~~~.....,..T',
      'T~~~~...~~~........T',
      'T,~~~~~~~~.....,...T',
      'T..~~~~~~....~~....T',
      'T.,.........,.~~...T',
      'TTTT~~TTTTTTTTTTTTTT',
    ],
    paths: [
      [[6.0, -1], L, [6.0, 1.2], [6.1, 3.0], [6.2, 4.3], IN, [6.2, 7.1], OUT, [6.6, 8.6], [8.4, 9.9], [11.5, 10.2], [14.4, 9.4], [16.1, 7.4], [16.2, 4.8], [15.0, 2.5], [12.6, 1.8], [10.8, 3.2], [11.0, 5.4], [12.8, 6.6], [15.0, 6.4], [17.4, 6.2], L, [21, 6.2]],
    ],
    decor: [
      { type: 'willow', x: 2, y: 9 }, { type: 'lantern', x: 13, y: 4 }, { type: 'bones', x: 9, y: 7 },
      { type: 'willow', x: 18, y: 2 }, { type: 'boat', x: 2, y: 4 },
    ],
  }),
  defineMap({
    id: 'marsh_willow', name: 'Drowned Willow', theme: 'marsh', tier: 'expert',
    desc: 'A double-spiral boardwalk: in around the great drowned willow, a turn in the heart of the bog, and back out between its own rings. Dry land is precious here.',
    concept: 'Double spiral: in around the willow and back out between its own rings',
    rows: [
      'TTTTTT.TTTT~~TTTTTTT',
      'T~................~T',
      'T~.~~..,..~~~~.,~.~T',
      'T~.~,..~~TT~~,..~.~T',
      'T~.~~.........~~~.~T',
      'T~.,..~~~TTT~.,.~.~T',
      'T~.~,..~~TT~~.,.~.~T',
      'T~............~~~.~T',
      'T~~..,..~~~~.,....~T',
      'T~~..~~~~,..~~,...~T',
      '..................~T',
      'TTT~~TTTTT~~~TTTTTTT',
    ],
    paths: [
      [[-1, 9.2], L, [-0.5, 8.4], ...spiral(10, 6.0, 9.2, 1.5, 195, 585, 30, 0.6), ...spiral(10, 6.0, 1.5, 9.2, 765, 360, 30, 0.6), L, [21, 6.0]],
    ],
    decor: [
      { type: 'willow', x: 13, y: 6 }, { type: 'lantern', x: 5, y: 6 }, { type: 'bones', x: 13, y: 4 },
      { type: 'boat', x: 1, y: 8 }, { type: 'lantern', x: 18, y: 10 },
    ],
  }),

  // -------------------------------------------------------------------------
  // Chapter 6 — Clockwork Foundry (foundry)
  // -------------------------------------------------------------------------
  defineMap({
    id: 'foundry_vats', name: 'Crystal Vats', theme: 'foundry', tier: 'intermediate',
    desc: 'The path drops in from the top and writes a big S, wrapping three quarters of the way around each glowing crystal vat. Quartz slimes are born here.',
    concept: 'Vat S: an S that wraps each crystal vat by three quarters',
    rows: [
      'HHHRRHHHHHHHR.HHHHHH',
      'H....,....,....,...H',
      'H.,...........R.,..H',
      'H..R.....~~........H',
      'H.,.....~~~~.......H',
      'H........~~....,...H',
      'H..................H',
      'H.R...........R....H',
      'H..........~~......H',
      '..........~~~~.....H',
      'H..R.......~~..R...H',
      'HHHHHRRHHHHHHHRRHHHH',
    ],
    paths: [
      [[13.5, -1], L, [13.5, 0.4], [12.2, 1.7], [9.4, 1.6], [7.0, 2.5], [6.3, 4.4], [7.6, 6.0], [10.4, 6.3], [13.2, 6.4], [14.7, 8.0], [13.9, 9.8], [11.2, 10.4], [8.4, 10.0], [6.4, 8.9], [3.6, 8.6], [1.0, 8.8], L, [-1, 8.8]],
    ],
    decor: [
      { type: 'crystal', x: 10, y: 4 }, { type: 'crystal', x: 11, y: 8 }, { type: 'chimney', x: 1, y: 0 },
      { type: 'gearTower', x: 17, y: 4 }, { type: 'vent', x: 3, y: 4 },
    ],
  }),
  defineMap({
    id: 'foundry_belt', name: 'Conveyor Line', theme: 'foundry', tier: 'intermediate',
    desc: 'A square figure-eight of conveyor belts: one loop round the coolant tank, the other round the furnace crucible and through the furnace hall, both diagonals meeting at the waist where one belt rides over the other on a steel-grating overpass. Perfect for beams and lines of fire.',
    concept: 'Belt figure-eight: a square conveyor loop round the coolant tank, another round the furnace crucible and through the furnace hall, a steel-grating overpass at the waist',
    rows: [
      'HHH..RRHHH...HHH..RHHH',
      'H......,.......,.....H',
      'H....................H',
      'H....R.........R.....H',
      'H...~~~~.....XXXX.H..H',
      'H...~~~~.....XXXX.H..H',
      'H...~~~~.....XXXX.H..H',
      'H...~~~~.....XXXX.H..H',
      'H.,..R.........R...,.H',
      'H.....,........,.....H',
      'H....................H',
      'HHH..RRHHHHH..HHHRRHHH',
    ],
    paths: [
      [[3.6, -1], L, [3.6, 0.3], ...arc(5.2, 0.3, 1.6, 180, 90, 30), L, [7.6, 1.9], [9.4, 2.7], [11.0, 6.0], [12.6, 9.3], [14.4, 10.1], L, [17.6, 10.1], ...arc(17.6, 8.1, 2.0, 90, 0, 30), IN, L, [19.6, 3.9], OUT, ...arc(17.6, 3.9, 2.0, 0, -90, 30), L, [14.4, 1.9], [12.6, 2.7], [11.0, 6.0], [9.4, 9.3], [7.6, 10.1], L, [4.0, 10.1], ...arc(4.0, 8.1, 2.0, 90, 180, 30), L, [2.0, 6.2], ...arc(0.4, 6.2, 1.6, 0, -90, 30), L, [-1, 4.6]],
    ],
    path: { style: 'belt', color: '#9aa1ab', side: '#4d535c' },
    bridge: { overpass: '#a4adb8', girder: '#3c4250', grating: true },
    ground: [{ type: 'vat', x: 4, y: 4, w: 4, h: 4 }, { type: 'vat', x: 13, y: 4, w: 4, h: 4 }],
    decor: [
      { type: 'chimney', x: 8, y: 0 }, { type: 'gearTower', x: 11, y: 10 }, { type: 'crane', x: 11, y: 1 },
      { type: 'vent', x: 15, y: 8 }, { type: 'chimney', x: 17, y: 3 },
    ],
  }),
  defineMap({
    id: 'foundry_crossing', name: 'Gearworks Crossing', theme: 'foundry', tier: 'advanced',
    desc: 'A cloverleaf interchange by the coolant canal: the second assembly line comes up from below, passes under the main line, loops round and merges into it before the overpass. Sappers love the junction.',
    concept: 'Cloverleaf: a looping on-ramp passes under the main line, then merges into it',
    rows: [
      'HHHHRR..HHHHHHR..HHH',
      'H......,..,......,.H',
      '...........~~~....,H',
      'H..R.......~~~.....H',
      'H..,..R....~~~..,..H',
      'H..........~~~.....H',
      'H..,.R.....~~~..R..H',
      'H..........~~~...,.H',
      'H..R..,....~~~.....H',
      '.......,...~~~..R..H',
      'H..........~~~......',
      'HHHHRRHHHHH~~~HHRHHH',
    ],
    paths: [
      [[-1, 4.4], L, [2.0, 4.4], [5.4, 4.6], [8.0, 5.0], [11.0, 5.6], [14.4, 6.0], [17.0, 7.0], [18.6, 8.6], [19.8, 9.4], L, [21, 9.4]],
      { nodes: [[9.5, 13], L, [9.5, 10.8], [9.5, 8.0], [9.7, 4.8], [10.0, 2.6], [8.8, 1.2], [6.4, 1.0], [4.6, 1.8], [4.2, 3.2], [5.2, 4.4]], join: { path: 0, at: [6.8, 4.8] } },
    ],
    crossings: ['bridgeUnder'],
    decor: [
      { type: 'gearTower', x: 2, y: 5 }, { type: 'crane', x: 15, y: 9 }, { type: 'chimney', x: 1, y: 11 },
      { type: 'vent', x: 7, y: 2 }, { type: 'gearTower', x: 17, y: 2 },
    ],
  }),
  defineMap({
    id: 'foundry_core', name: 'Furnace Core', theme: 'foundry', tier: 'expert',
    desc: 'A tall serpentine of service corridors around the coolant tanks, right above the furnace. Two of its turns run through the machinery itself.',
    concept: 'Service corridors: tall serpentine whose turns dive under machinery (two tunnels)',
    rows: [
      'HHHHHHRRHHHHHHRHHHHH',
      '.....HRH.....H,H....',
      'H...,.~~..,...~~..RH',
      'H.....~~......~~...H',
      'H...,.~~..,...~~...H',
      'H.R...~~....R.~~...H',
      'H.....~~..,......,.H',
      'H.,.....R....R.....H',
      'H..........,.......H',
      'HR..,.......,..R..RH',
      'H..................H',
      'HHHHHHHHHXXHHHHHHHHH',
    ],
    paths: [
      [[-1, 1.5], L, [1.6, 1.5], [3.4, 2.4], [4.2, 4.6], [4.0, 7.4], [4.6, 9.2], [5.6, 10.2], IN, [7.0, 10.6], [8.4, 10.2], OUT, [9.4, 8.8], [9.6, 7.4], [9.2, 4.8], [9.6, 2.4], [11.6, 1.2], [13.4, 2.2], [12.6, 4.4], [12.2, 6.8], [12.8, 9.0], [13.8, 10.2], IN, [15.2, 10.6], [16.6, 10.0], OUT, [17.4, 8.4], [17.4, 6.8], [17.0, 4.4], [17.6, 2.4], [18.8, 1.6], L, [21, 1.6]],
    ],
    decor: [
      { type: 'vent', x: 10, y: 11 }, { type: 'chimney', x: 6, y: 0 }, { type: 'gearTower', x: 14, y: 1 },
      { type: 'crane', x: 1, y: 7 }, { type: 'vent', x: 7, y: 6 },
    ],
  }),
  defineMap({
    id: 'foundry_hangar', name: 'Machine Hangar', theme: 'foundry', tier: 'expert',
    desc: 'The Goblin Machine\'s hangar: the test track coils through the hangar like a spring — two big loops, each riding back over itself on a steel overpass above the coolant pits.',
    concept: 'Coil spring: two loops in a row, each crossing itself on an overpass',
    rows: [
      'HHHHHRRHHHHHHHHRRHHHHH',
      'H......,....,.....,..H',
      '...................,.H',
      'H.,.R.~~......~~.....H',
      'H....~~~.....~~~.....H',
      'H....~~~.....~~~......',
      'H.,...~.......~...,..H',
      'H.,.R...........R....H',
      'H......,.......,.....H',
      'H....................H',
      'H..R...,......,...R..H',
      'HHHHHRRHHHHHHHHRRHHHHH',
    ],
    paths: [
      [[-1, 9.2], L, [1.4, 9.2], [4.6, 9.0], [7.8, 8.0], [9.6, 5.6], [9.2, 2.8], [7.0, 1.2], [4.4, 1.4], [2.6, 3.2], [2.8, 6.0], [4.8, 8.2], [8.0, 9.8], [11.6, 9.8], [14.6, 8.6], [16.6, 6.0], [16.4, 3.0], [14.6, 1.4], [12.0, 1.8], [10.8, 4.0], [11.6, 6.8], [14.0, 9.0], [17.2, 10.2], [19.6, 10.2], L, [23, 10.2]],
    ],
    decor: [
      { type: 'crane', x: 1, y: 7 }, { type: 'gearTower', x: 19, y: 4 }, { type: 'chimney', x: 21, y: 11 },
      { type: 'vent', x: 5, y: 6 }, { type: 'gearTower', x: 13, y: 6 },
    ],
  }),

  // -------------------------------------------------------------------------
  // Chapter 7 — Oni Festival (festival)
  // -------------------------------------------------------------------------
  defineMap({
    id: 'festival_street', name: 'Lantern Street', theme: 'festival', tier: 'intermediate',
    desc: 'Two parade routes — one down from the shrine hill, one along the boat canal — sweep into the festival square, merge and march out together.',
    concept: 'Lambda: two parades merge in the square and leave as one',
    rows: [
      'HHH,HH..HHHHH,HH.HHH',
      'H.....,.......,....H',
      '.........,........,H',
      'H.,....H.....H..,..H',
      '~~~~~~.......,.....H',
      '~~~~~~~............H',
      '~~~~~~~..,...H.....H',
      '~~~~~~..H...........',
      'H.,....~~~~...,....H',
      'H......~~~~.H......H',
      '...................H',
      'HHH.HHHH,HHHHHH.HHHH',
    ],
    paths: [
      [[6.5, -1], L, [6.5, 0.6], [5.4, 2.1], [6.3, 3.7], [8.4, 3.5], [10.0, 2.2], [12.2, 2.3], [13.0, 4.2], [11.8, 5.8], [11.6, 7.6], [13.0, 9.4], [15.6, 9.8], [17.8, 9.2], [19.2, 8.0], L, [21, 8.0]],
      { nodes: [[-1, 10.2], L, [1.0, 10.2], [3.2, 10.0], [5.0, 8.8], [7.2, 8.4], [8.8, 9.6], [10.8, 10.4]], join: { path: 0, at: [14.2, 9.8] } },
    ],
    decor: [
      { type: 'stall', x: 3, y: 1 }, { type: 'stall', x: 16, y: 3 }, { type: 'taiko', x: 14, y: 6 },
      { type: 'boat', x: 2, y: 5 }, { type: 'lantern', x: 9, y: 6 },
    ],
  }),
  defineMap({
    id: 'festival_square', name: 'Fireworks Square', theme: 'festival', tier: 'advanced',
    desc: 'The parade traces a three-lobed knot through the fireworks square, meeting itself at three street junctions.',
    concept: 'Trefoil: a three-lobed knot with three flat junctions',
    crossings: 'flat',
    rows: [
      'HHHH,HHHHHH,HHHHHHHH',
      'H...........,..,...H',
      'H.,.......,....H...H',
      'H.........~~~.....,H',
      '...................H',
      'H.,....,...,....,..H',
      'H.....~~~~.........H',
      'H..H~~........~~...H',
      'H.,~~~~......~~~~..H',
      'H..................H',
      'H.,....,...,...,...H',
      'HHHHHHHHHHH.HHHHHHHH',
    ],
    paths: [
      [[-1, 7.6], L, [0.4, 7.6], ...curve((t) => [10 + 2.95 * (DM.sin(t) + 2 * DM.sin(2 * t)), 6.4 + 1.8 * (DM.cos(t) - 2 * DM.cos(2 * t))], 5.7, 5.7 + 5.62, 30), [2.4, 10.8], L, [2.4, 13]],
    ],
    decor: [
      { type: 'taiko', x: 9, y: 6 }, { type: 'stall', x: 18, y: 2 }, { type: 'stall', x: 1, y: 2 },
      { type: 'lantern', x: 16, y: 3 }, { type: 'banner', x: 9, y: 3 },
    ],
  }),
  defineMap({
    id: 'festival_bridge', name: 'Moon Bridge', theme: 'festival', tier: 'advanced',
    desc: 'The parade weaves back and forth across the meandering moon river three times over red arched bridges.',
    concept: 'River weave: crosses the meandering river three times on arched bridges',
    rows: [
      'HH,HHH.HH~~HH,HHHHHH',
      'H.......,~~.......,H',
      '........~~.........H',
      'H.,..H..~~...,..H..H',
      'H........~~........H',
      'H.........~~.......H',
      'H.,.......~~....,..H',
      'H..H.....~~....H...H',
      'H.......~~.........H',
      'H.,.~~..~~.....,...H',
      'H..~~~..~~......,..H',
      'HH~~HHHH~~HHHHHH..HH',
    ],
    paths: [
      [[-1, 2.0], L, [1.0, 2.0], [5.0, 1.8], [9.4, 2.2], [13.6, 1.8], [16.4, 2.4], [17.4, 4.2], [16.2, 5.8], [13.0, 5.6], [10.4, 5.4], [7.0, 5.8], [3.6, 6.0], [2.2, 7.4], [3.0, 9.0], [5.8, 9.2], [9.2, 9.4], [13.0, 9.6], [16.2, 9.6], [17.6, 10.6], L, [17.6, 13]],
    ],
    decor: [
      { type: 'lantern', x: 7, y: 4 }, { type: 'lantern', x: 12, y: 7 }, { type: 'taiko', x: 3, y: 4 },
      { type: 'stall', x: 13, y: 11 }, { type: 'boat', x: 9, y: 11 },
    ],
  }),
  defineMap({
    id: 'festival_maze', name: 'Shrine Maze', theme: 'festival', tier: 'expert',
    desc: 'The parade swings out into four great petal loops, crossing the little square in the middle four times: twice over arched festival bridges, twice straight across the cobbles. Every girl has a choke point — and so does every oni.',
    concept: 'Four-leaf pinwheel: four petal loops round a central square, two arched bridges and two flat junctions',
    crossings: ['flat', 'bridge', 'flat', 'bridge'],
    rows: [
      'HHHH,HHH,HHH,HHHHH',
      '...H.H.....H.H...H',
      'H..,..,.~~,...,..H',
      'H.,..........,...H',
      'H................H',
      'H~~,..........~~.H',
      'H~~...........~~.H',
      'H.............~~.H',
      'H.,.........,....H',
      'H..~~~...........H',
      'H........~~~......',
      'HHHHH,HHHHHHHHHHHH',
    ],
    paths: [
      [[-1, 10.6], L, [1.4, 10.6], ...curve((t) => [9 + 1.2 * (4.0 * DM.cos(t) + 2.8 * DM.cos(-3 * t + Math.PI)), 6 + 0.96 * (4.0 * DM.sin(t) + 2.8 * DM.sin(-3 * t + Math.PI))], 2.5, 2.0 + 2 * Math.PI, 48), [1.8, 8.4], L, [-1, 8.4]],
    ],
    decor: [
      { type: 'taiko', x: 8, y: 0 }, { type: 'stall', x: 8, y: 1 }, { type: 'stall', x: 8, y: 10 },
      { type: 'lantern', x: 1, y: 5 }, { type: 'banner', x: 16, y: 5 },
    ],
  }),
  defineMap({
    id: 'festival_arena', name: 'Champion\'s Stage', theme: 'festival', tier: 'expert',
    desc: 'The tournament stage of the Oni Festival. Parades from the west gate and the south gate join, run a full lap of honour round the champion\'s stage, and leave over the festival bridge across their own way in — under the champion\'s nose the whole time.',
    concept: 'Lap of honour: two gates merge, lap the stage once and leave over their own entry on a bridge (a lasso)',
    rows: [
      'HHH,HHHHHHHHHHHH,HHH',
      'H....,..........,..H',
      'H.~~...............H',
      '..~~...,..........,.',
      'H.....,.HHHH.,.....H',
      'H.......HHHH.......H',
      'H.,.....HHHH...,~~.H',
      'H..,............~~.H',
      'H.................,H',
      'H.,.........,......H',
      '........,....,.....H',
      'HHHHHHHH,HHHHHHHHHHH',
    ],
    paths: [
      [[-1, 7.4], L, [1.0, 7.4], [3.2, 7.6], [5.2, 8.2], [7.6, 8.7], [10.4, 8.8], [13.0, 8.4], [14.7, 6.9], [15.0, 4.6], [13.8, 2.6], [11.4, 1.7], [8.6, 1.7], [6.4, 2.5], [5.4, 4.3], [5.7, 6.4], [6.8, 8.4], [7.8, 9.8], [9.6, 10.4], [12.4, 10.5], [16.0, 10.4], [18.4, 10.3], L, [21, 10.3]],
      { nodes: [[2.4, 13], L, [2.4, 11.4], [2.6, 9.8]], join: { path: 0, at: [4.4, 7.9] } },
    ],
    decor: [
      { type: 'taiko', x: 10, y: 3 }, { type: 'banner', x: 2, y: 5 }, { type: 'banner', x: 17, y: 4 },
      { type: 'lantern', x: 4, y: 1 }, { type: 'stall', x: 17, y: 1 },
    ],
  }),
  defineMap({
    id: 'peaks_ascent', name: 'Ashwing Ascent', theme: 'snow', tier: 'advanced',
    desc: 'A snowy climb: two long switchback legs up the slope, then a corkscrew loop round the steaming hot spring that rides over itself before the summit gate. Wyverns cut across the bends.',
    concept: 'Corkscrew climb: two switchback legs, then a loop round the hot spring over its own track',
    rows: [
      'RRRTTRRRR,RRTTRRRRRR',
      'R..T......,....T...R',
      'RT..,..........T....',
      'R..........~~~...R.R',
      'R.T.,.....~~~~.....R',
      'RR....,...~~~~~....R',
      'R.....T....~~~.....R',
      'R..........,.......R',
      'R..T..............TR',
      'RR..,..T....,...~~~R',
      '.......T......~~~~~R',
      'RRRRTTRRRRRRR~~~RRRR',
    ],
    paths: [
      [[-1, 10.3], L, [1.0, 10.3], [4.0, 9.6], [6.6, 8.0], [6.6, 6.2], [4.6, 5.4], [2.8, 4.4], [3.2, 2.4], [6.0, 1.6], [9.4, 2.2], [12.4, 2.0], [14.8, 2.8], [16.0, 4.8], [15.2, 7.0], [12.8, 7.6], [10.8, 6.2], [11.0, 3.6], [13.0, 1.4], [16.4, 1.0], [18.6, 1.8], L, [21, 1.8]],
    ],
    decor: [
      { type: 'pine', x: 3, y: 7 }, { type: 'pine', x: 7, y: 10 }, { type: 'vent', x: 13, y: 5 },
      { type: 'nest', x: 18, y: 6 }, { type: 'flag', x: 1, y: 8 },
    ],
  }),
  defineMap({
    id: 'peaks_glacier', name: 'Frozen Falls', theme: 'snow', tier: 'advanced',
    desc: 'The road climbs the left bank, ducks into the ice cave above the frozen falls where the glacier river is born, and comes down the far bank — an omega around the river. Nothing can hit the monsters inside the ice.',
    concept: 'Omega: up one bank, through the ice cave above the frozen falls, down the other',
    rows: [
      'RRRRTTRRRRRRRRTTRRRR',
      '..................TR',
      'R.T..,.......,..T..R',
      'R......~~~~~.......R',
      'RT..,...~~~...,..T.R',
      'R.......~~~........R',
      'R..T...~~~~~..T....R',
      'R.,.....~~~...,..T.R',
      'RR..T...~~~.....,..R',
      'R.......~~~.........',
      'RT..,..~~~~~..T..,.R',
      'RRRRTTR~~~~~RRRTTRRR',
    ],
    paths: [
      [[-1, 10.0], L, [1.0, 10.0], [4.4, 9.8], [6.4, 8.4], [5.6, 6.6], [3.8, 4.8], [3.8, 2.6], [5.2, 1.7], [6.8, 1.6], ...arc(9.9, 3.0, 2.4, 226, 236, 10), IN, ...arc(9.9, 3.0, 2.4, 254, 286, 16), ...arc(9.9, 3.0, 2.4, 304, 304), OUT, ...arc(9.9, 3.0, 2.4, 314, 314), [13.0, 1.6], [14.6, 1.7], [16.2, 2.8], [16.2, 4.8], [14.4, 6.6], [13.6, 8.4], [15.0, 9.8], [17.0, 9.5], [18.4, 8.4], [19.2, 6.9], [20.2, 6.2], L, [21.5, 6.2]],
    ],
    // the river is born under the glacier: an ice cave over the road, the frozen falls below it
    tunnel: { top: '#d4efff', side: '#7fb8e2', portal: '#5fa3d6', dark: '#0a1a2e', crystals: true },
    ground: [{ type: 'icefall', x0: 6.95, x1: 12.05, y: 3.02 }],
    decor: [
      { type: 'pine', x: 2, y: 4 }, { type: 'pine', x: 17, y: 5 }, { type: 'nest', x: 18, y: 11 },
      { type: 'flag', x: 1, y: 7 }, { type: 'crystal', x: 12, y: 3 },
    ],
  }),
  defineMap({
    id: 'peaks_caldera', name: 'Caldera Rim', theme: 'volcano', tier: 'expert',
    desc: 'The road drops in from the north, circles the rim of the horseshoe lava lake, dives up the obsidian spit into its heart and back, and climbs out over its own entrance on an obsidian bridge.',
    concept: 'Caldera kidney: a stem from the north, a rim lap that dives up the obsidian spit into the lava horseshoe, out over its own entrance',
    rows: [
      'RRR.RRRR,RRRRR,RRRRR',
      'R~~.......,......~~R',
      '...................R',
      'R~.........,......~R',
      'R..................R',
      'R....XX......XX....R',
      'R...XXX......XXX...R',
      'R...XX........XX.,.R',
      'R~.........,......~R',
      'R~...............~~R',
      'R~~~...,.....,...~~R',
      'RRRRRRRRRRRRRRRRRRRR',
    ],
    paths: [
      [[12.5, -1], L, [12.5, 2.9], ...arc(11.0, 2.9, 1.5, 0, 90, 30), L, [6.4, 4.4], [3.6, 4.8], [2.3, 6.6], [3.2, 8.7], [5.8, 9.5], [7.4, 9.0], [8.4, 7.8], [9.5, 7.2], [10.6, 7.8], [11.6, 9.0], [13.2, 9.6], [15.8, 9.1], [17.3, 6.8], [17.0, 4.4], [15.6, 2.7], [13.8, 2.3], L, [10.8, 2.3], [9.2, 1.6], [8.6, 0.2], L, [8.6, -1]],
    ],
    decor: [
      { type: 'vent', x: 10, y: 10 }, { type: 'vent', x: 14, y: 7 }, { type: 'crystal', x: 10, y: 5 },
      { type: 'crystal', x: 18, y: 5 }, { type: 'nest', x: 17, y: 1 },
    ],
  }),
  defineMap({
    id: 'peaks_ridge', name: 'Dragonback Ridge', theme: 'volcano', tier: 'expert',
    desc: 'Two trails climb the dragon\'s spine: they swap sides on a stone bridge, swing wide past the smoking vents, merge on the ridge and drop down the dragon\'s tail.',
    concept: 'Dragon spine: two trails cross once on a bridge, swing apart and merge',
    rows: [
      'RRRRRRRR,RRRRRRR,RRRRR',
      'R~~....,......R...~~RR',
      '.......,...........,.R',
      'R..R.......XXX...R...R',
      'R.,.......XXXXX......R',
      'RR.........XXX..~~...R',
      'R....................R',
      'R..,....~~~.....,.R..R',
      'RR.....~~~~~..R.......',
      '...........,....,....R',
      'R..R....~~~...,.......',
      'RRRRRRRR~~~RRRRRRRRRRR',
    ],
    paths: [
      [[-1, 2.4], L, [1.0, 2.4], [3.4, 2.8], [5.4, 4.6], [7.0, 7.4], [9.4, 9.4], [12.6, 9.6], [15.2, 8.4], [16.8, 6.6], [18.4, 6.1], [19.8, 7.3], [19.7, 9.2], [18.4, 10.3], L, [18.0, 13]],
      { nodes: [[-1, 9.6], L, [1.0, 9.6], [3.4, 9.2], [5.4, 7.4], [7.0, 4.6], [9.2, 2.4], [12.4, 2.0], [15.0, 2.8], [16.6, 4.4]], join: { path: 0, at: [18.4, 6.0] } },
    ],
    decor: [
      { type: 'vent', x: 12, y: 4 }, { type: 'nest', x: 19, y: 3 }, { type: 'bones', x: 2, y: 6 },
      { type: 'crystal', x: 12, y: 6 }, { type: 'pine', x: 15, y: 10 },
    ],
  }),
  defineMap({
    id: 'peaks_nest', name: 'Matriarch\'s Nest', theme: 'volcano', tier: 'expert',
    desc: 'Three trails — two from the western cliffs, one down the northern pass — converge below the Matriarch\'s nest and charge the eastern ridge together. Hold the merge or lose the peak.',
    concept: 'Three lanes converge on one choke, then run out together (Dark Castle idea)',
    rows: [
      'RRRRRRR,RRRRRRR.RRRRRR',
      'R~~......,...R..,...RR',
      '.........,....T....,.R',
      'R..T.....~~~.........R',
      'R.,......~~~~...,....R',
      'RR....T...~~..T......R',
      'R.....................',
      'R..,.....~~~~....T...R',
      'RR.......~~~~~...,...R',
      'R..T.....~~~.....T..RR',
      '.........,...,...~~~RR',
      'R~~..T......,.....~~RR',
      'RRRRRRRRRRRRRRRRRRRRRR',
    ],
    paths: [
      [[-1, 2.4], L, [1.0, 2.4], [4.0, 2.6], [6.6, 4.0], [7.8, 6.4], [9.6, 7.0], [12.4, 6.8], [14.6, 7.6], [16.6, 9.2], [19.0, 9.4], L, [23, 9.4]],
      { nodes: [[-1, 10.4], L, [1.0, 10.4], [4.0, 10.2], [6.6, 9.0], [7.8, 7.4]], join: { path: 0, at: [9.2, 7.0] } },
      { nodes: [[12.5, -1], L, [12.5, 0.6], [12.2, 2.4], [11.0, 4.4], [11.2, 6.0]], join: { path: 0, at: [12.8, 6.8] } },
    ],
    decor: [
      { type: 'nest', x: 16, y: 4 }, { type: 'bones', x: 4, y: 6 }, { type: 'vent', x: 13, y: 10 },
      { type: 'crystal', x: 3, y: 4 }, { type: 'pine', x: 20, y: 4 },
    ],
  }),

  // -------------------------------------------------------------------------
  // Chapter 1 · Act II — Rush Hour (city: Itomachi downtown by day; Gate Arc, docs/specs/gate-arc/MAPS.md §1.2)
  // -------------------------------------------------------------------------
  defineMap({
    id: 'noon_station_plaza', name: 'Station Plaza', theme: 'city', tier: 'beginner',
    desc: 'In from the bus lanes on the west, one wide hairpin round the taxi rank, then back under the station concourse and out north through the ticket gates. The far mouth of the underpass is the place to stand.',
    concept: 'Taxi-rank hairpin: east along the bus lane, one wide hairpin, back west under the station concourse, out north',
    rows: [
      'HHHH.,HHHHHHHHTTHHHH',
      'H...,.,....,..T.HHHH',
      'H.HH...HHHHHH.....HH',
      'H.HH..............,H',
      'H.,....HHHHH......HH',
      'H.HH..,,.T.,.......H',
      'H.HH..,...........HH',
      'H......T.,......,.HH',
      '...................H',
      'H.HHH..HHH..,HHH.HHH',
      '.,..T..,....,....,..',
      '~~~~~~~~~~~~~~~~~~~~',
    ],
    paths: [
      street([[-1, 8.5], [15.5, 8.5], [15.5, 3.5], [4.5, 3.5], [4.5, -1]], { r: [2.5, 2.5, 1.8, 1.8], tunnel: [[11.5, 3.5], [8.5, 3.5]] }),
    ],
    decor: [
      { type: 'ticketGates', x: 6, y: 1, rot: 0 }, { type: 'clockTower', x: 17, y: 2, rot: 0 },
      { type: 'missingPoster', x: 6, y: 4, rot: Math.PI }, { type: 'busStop', x: 2, y: 7, rot: 0 },
      { type: 'parkedCar', x: 12, y: 6, rot: Math.PI / 2 }, { type: 'waterBus', x: 5, y: 11, rot: Math.PI / 2 },
    ],
    city: {
      areas: [{ type: 'plaza', x: 5.2, y: 0.3, w: 3.6, h: 1.5 }, { type: 'lawn', x: 11.2, y: 5.2, w: 2.6, h: 1.6 }],
      waterBus: { z: 11.5, x0: -6, x1: 26, period: 34 },
    },
  }),
  defineMap({
    id: 'noon_covered_arcade', name: 'The Covered Arcade', theme: 'city', tier: 'intermediate',
    desc: 'In from the station end of the shopping arcade, three narrow side alleys dropping south and climbing back, out at the far end. Two flat shop roofs stand between the alleys: a girl up there covers both.',
    concept: 'Comb: the arcade street along the north, three deep narrow U-teeth hanging off it, in and out by the north edge',
    rows: [
      'H.HHHHHHHHHHHHHHHHHH.H',
      'H....,.......,.......H',
      'H....................H',
      'H.....,.......,......H',
      'H.....H........H.....H',
      'H.....H.UU..H.UU.....H',
      'H.....H.UU..H.UU.....H',
      'H.,...H.UU..H.UU...,.H',
      'H.......UU....UU.....H',
      'H....................H',
      'H~~~~~~~~~...~~~~~~~~H',
      'HHHHHHHHHHHHHHHHHHHHHH',
    ],
    paths: [
      street([[1.0, -1], [1.0, 2.5], [4.0, 2.5], [4.0, 8], [7.0, 8], [7.0, 2.5], [10.5, 2.5], [10.5, 8], [13.5, 8], [13.5, 2.5], [17.0, 2.5], [17.0, 8], [20.0, 8], [20.0, -1]], { r: 1.5 }),
    ],
    decor: [
      { type: 'arcadeRibs', x: 9, y: 1, rot: 0 }, { type: 'arcadeRibs', x: 15, y: 1, rot: 0 },
      { type: 'bunSteamer', x: 12, y: 4, rot: Math.PI }, { type: 'lantern', x: 5, y: 4 }, { type: 'lantern', x: 18, y: 4 },
      { type: 'catOnWall', x: 12, y: 5, rot: 0 },
    ],
  }),
  defineMap({
    id: 'noon_corner_store', name: 'Convenience Corner', theme: 'city', tier: 'intermediate',
    desc: 'Up the avenue from the south, round the convenience store\'s block, and back across its own approach at the scramble crossing in front of the store, out west over the canal. Every enemy passes the corner twice.',
    concept: 'Alpha at the scramble: up the avenue, round the block, back across its own approach at a flat four-way crossing',
    rows: [
      'HHHHHHHHHHHHHHHHHHHH',
      '~~H.T...,..........H',
      '~~H....,..........HH',
      '~~H.,.........,...HH',
      '~~H..HH......~~,..HH',
      '~~H..HH..HHH.~~...HH',
      '~~H......HHH,.....HH',
      '~~.................H',
      '~~H.,.HH.....HH.,..H',
      '~~H.T.HH..,..HH..HHH',
      '~~H..,.....,.....HHH',
      'HHHHHHHH..HHHHHHHHHH',
    ],
    crossings: 'flat',
    paths: [
      street([[8.5, 13], [8.5, 1.5], [17.0, 1.5], [17.0, 7.5], [-1, 7.5]], { r: 1.8 }),
    ],
    decor: [
      { type: 'trafficLight', x: 7, y: 6, rot: Math.PI / 2 }, { type: 'trafficLight', x: 9, y: 8, rot: -Math.PI / 2 },
      { type: 'vendingMachine', x: 12, y: 6, rot: 0 }, { type: 'bikeRack', x: 9, y: 9, rot: 0 },
      { type: 'trashBin', x: 7, y: 2, rot: 0 },
    ],
    city: {
      areas: [{ type: 'lawn', x: 12.2, y: 3.2, w: 3.8, h: 2.6 }],
    },
  }),
  defineMap({
    id: 'noon_canal_crossing', name: 'Canal Crossing', theme: 'city', tier: 'intermediate',
    desc: 'Down from the north to the railway, where the road forks: the short lane runs straight over the level crossing, the long lane swings east round the canal basin, under the line and back over the canal bridge. When the barrier is down, the column takes the long way.',
    concept: 'Level-crossing bypass: one lane dead straight over the railway, the other a wide D round the canal basin, rejoining at the south exit',
    rows: [
      'HHHHH.HHHHHHHHHHHHHH',
      'H...,.......,......H',
      'H.HH...........,...H',
      'H.HH...HHH...HHH...H',
      '....................',
      'H.HH...~~~~~~~~~...H',
      'H..,...~~~~~~~~~...H',
      'H......~~~~~~~~~...H',
      'H.HH...~~~~~~~...,.H',
      'H..........~~......H',
      'H..,.....~~~~~~~...H',
      'HHHHH.HHHHH~~HHHHHHH',
    ],
    crossings: 'bridge',
    paths: [
      [[5.5, -1], L, [5.5, 13]],
      {
        fork: { path: 0, at: [5.5, 1.4] },
        nodes: [[7.0, 2.4], [10.0, 2.5], L, [15.0, 2.5], [16.9, 3.1], [17.5, 4.0], IN, L, [17.5, 5.2], OUT, L, [17.5, 7.6], [16.9, 9.0], [15.0, 9.5], L, [7.6, 9.5], [6.1, 10.1]],
        join: { path: 0, at: [5.5, 11.4] },
      },
    ],
    decor: [
      { type: 'lockGate', x: 13, y: 10, rot: Math.PI / 2 }, { type: 'waterBus', x: 9, y: 6, rot: Math.PI / 2 },
      { type: 'busStop', x: 4, y: 7, rot: Math.PI / 2 }, { type: 'vendingMachine', x: 18, y: 1, rot: 0 },
    ],
    city: {
      railway: { z: 4.5 },
      waterBus: { z: 7.5, x0: 8.2, x1: 14.8, period: 30 },
    },
  }),
  defineMap(echoMap(BLOSSOM_COURT, {
    id: 'noon_dry_fountain', name: 'The Dry Fountain', theme: 'city', tier: 'advanced',
    desc: 'The old plaza in the middle of town. The road spirals in round the dry fountain, crosses its own outer ring on the pedestrian deck and leaves through the shopping-arcade underpass. Something dark sits in the basin.',
    concept: 'Echo of Blossom Court: the fountain spiral round a dry basin, the pedestrian deck over the outer ring, the arcade underpass',
    // the fountain's water is long gone: its basin is a blocked stone hollow (the dryFountain set
    // piece draws it) and the road's edge of it is dry paving
    echoDiff: [
      { x: 8, y: 5, w: 3, h: 1, from: '~', to: 'H' },
      { x: 7, y: 6, w: 5, h: 1, from: '~', to: 'H' },
      { x: 8, y: 7, w: 2, h: 1, from: '~', to: 'H' },
      { x: 10, y: 7, from: 'B', to: '.' },
    ],
    decor: [
      { type: 'dryFountain', x: 9, y: 6, r: 2.6 }, { type: 'pigeonGroup', x: 6, y: 6, rot: 0 },
      { type: 'vendingMachine', x: 15, y: 6, rot: -Math.PI / 2 },
    ],
    city: {
      areas: [{ type: 'plaza', x: 5.6, y: 4.6, w: 8.8, h: 3.8 }],
    },
  })),

  // -------------------------------------------------------------------------
  // Chapter 2 · Act II — Hilltop After Dark (campus: Itomachi Hilltop High at night, lakeside; MAPS.md §1.3)
  // -------------------------------------------------------------------------
  defineMap({
    id: 'noon_school_gate', name: 'School Gate', theme: 'campus', tier: 'intermediate',
    desc: 'Up the hill road from the south, an S round the front-court flowerbeds, then through the corridor under the main building and out at Shelter 3\'s door. The classroom wing beside the corridor has a flat roof a girl can stand on.',
    concept: 'Hill-road chicane: up from the south, two flat S-bends round the front court, the corridor tunnel north under the main building',
    rows: [
      'HHHHHH.HHHHHH~~~~~~~',
      'H.,..H.H.UU.,~~~~~~~',
      'H.T..H.H.UU..~~~~~~~',
      'H....H.H.UU.,~~~~~~~',
      'H.,..H.H......~~~~~~',
      'H............~~~~~~~',
      'H.T...........~~~~~~',
      'H.....,......~~~~~~~',
      'H.,..T..,.....~~~~~~',
      'H............~~~~~~~',
      'H.............~~~~~~',
      'HHHH.HHHHHHHH~~~~~~~',
    ],
    paths: [
      street([[4.5, 13], [4.5, 10.5], [11.5, 10.5], [11.5, 6.5], [6.5, 6.5], [6.5, -1]], { r: 1.6, tunnel: [[6.5, 4.5], [6.5, 0.5]] }),
    ],
    decor: [
      { type: 'flagpole', x: 2, y: 5, rot: 0 }, { type: 'bikeShed', x: 1, y: 8, rot: Math.PI / 2 },
      { type: 'lantern', x: 9, y: 8 }, { type: 'lantern', x: 12, y: 4 },
    ],
    city: {
      searchlight: { x: 12.8, z: 8.6, rot: -0.2, sweep: 1.4, reach: 3.6, period: 13 },
      // the main building's clock tower over the corridor, in the strip past the north edge
      pieces: [{ type: 'schoolBlock', variant: 3, x: 6.5, z: -1.7, s: 1.4 }],
    },
  }),
  defineMap({
    id: 'noon_rowing_jetty', name: 'Rowing Jetty', theme: 'campus', tier: 'intermediate',
    desc: 'Two columns climb out of the lake on the rowing club\'s twin jetties and meet at the boat ramp. From there one road runs east along the shore, doubles back past the boathouse and leaves north. The water between the jetties is the place for swimmers.',
    concept: 'Twin jetties: two lanes up parallel decks over the lake, merging at the boat ramp, then a Z of one hairpin and one bend out north',
    rows: [
      'HHH.HHHHHHHHHHHHHHHH',
      'H.....,......,.....H',
      'H.T.....HHH........H',
      'H..................H',
      'H...,....HHH....,..H',
      'H.................HH',
      'H..................H',
      'H.,......,.........H',
      '~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~',
    ],
    crossings: 'bridge',
    paths: [
      street([[5.5, 13], [5.5, 6.5], [16.5, 6.5], [16.5, 3.5], [3.5, 3.5], [3.5, -1]], { r: 1.5 }),
      { nodes: [[9.5, 13], L, [9.5, 8.8], [9.8, 7.6], [10.6, 6.8]], join: { path: 0, at: [12.0, 6.5] } },
    ],
    decor: [
      { type: 'boatRack', x: 1, y: 6, rot: Math.PI / 2 }, { type: 'boatRack', x: 13, y: 7, rot: 0 },
      { type: 'lantern', x: 12, y: 5 }, { type: 'bench', x: 14, y: 2 },
    ],
    city: {
      searchlight: { x: 17.6, z: 7.6, rot: Math.PI / 2 + 0.3, sweep: 1.5, reach: 3.6, period: 14, variant: 1 },
    },
  }),
  defineMap({
    id: 'noon_footbridges', name: 'Canal Footbridges', theme: 'campus', tier: 'intermediate',
    desc: 'Down the club-hut lanes from the north-west, a staircase of short runs, each drop crossing a mill canal on a little footbridge, and a last run over the boiler-house cut to the south gate.',
    concept: 'Staircase of footbridges: a stepped diagonal from north-west to south-east, every step down crossing a canal',
    rows: [
      'HHHHHHHHHHHHH~~HHHHH',
      '..........,..~~...,H',
      'H.T..........~~....H',
      '~~~~~~~~~~~~~~~~~~~~',
      'H...,.......,~~....H',
      'H.......,....~~.T..H',
      '~~~~~~~~~~~~~~~~~~~~',
      'H..,.........~~..,.H',
      'H......T.....~~....H',
      '~~~~~~~~~~~~~~~~~~~~',
      'H...,........~~....H',
      'HHHHHHHHHHHHH~~..HHH',
    ],
    crossings: 'bridge',
    paths: [
      street([[-1, 1.5], [3.5, 1.5], [3.5, 4.5], [7.5, 4.5], [7.5, 7.5], [11.5, 7.5], [11.5, 10.5], [15.5, 10.5], [15.5, 13]], { r: 1.5 }),
    ],
    decor: [
      { type: 'clubHut', x: 9, y: 1, rot: Math.PI }, { type: 'clubHut', x: 2, y: 5, rot: 0 },
      { type: 'clubHut', x: 17, y: 8, rot: -Math.PI / 2 }, { type: 'lantern', x: 6, y: 2 },
    ],
  }),
  defineMap({
    id: 'noon_running_track', name: 'The Running Track', theme: 'campus', tier: 'advanced',
    desc: 'In through the marathon gate under the grandstand, straight across the infield, then one lap of the running track: down the home bend, along the back straight, over its own entry on the grandstand footbridge, and out north past the finish gantry.',
    concept: 'One lap: an infield straight, then a clockwise lap of the oval that crosses its own entry on a footbridge and leaves north',
    rows: [
      '~~~~~~~~~~~~~~~~.~~~',
      '~~~~~~~~~~~~~~~~.~~~',
      'HH.................H',
      'H..................H',
      'H........~~~~~.....H',
      'HHH......~~~~~.....H',
      '..................HH',
      'HHH......~~~~~.....H',
      'H........~~~~~.....H',
      '~~~~~..............H',
      '~~~~~..............H',
      'HHHHHHHHHHHHHHHHHHHH',
    ],
    crossings: 'bridge',
    paths: [
      [[-1, 6.5], L, [0.2, 6.5], IN, L, [2.4, 6.5], OUT, L, [15.0, 6.5], [17.1, 7.3], [18.1, 8.6], [17.5, 10.0], [15.5, 10.4], L, [10.0, 10.4], [8.0, 9.9], [7.0, 8.5], [6.9, 6.5], [7.2, 4.5], [8.2, 3.4], [10.0, 2.9], L, [14.5, 2.9], [16.0, 2.4], [16.6, 1.3], L, [16.7, -1]],
    ],
    decor: [
      { type: 'lantern', x: 17, y: 3 }, { type: 'bench', x: 3, y: 3 },
    ],
    city: {
      road: 'track',
      pieces: [
        { type: 'finishGantry', x: 12.5, z: 10.4, rot: Math.PI / 2 },
        { type: 'scoreboard', x: 2.2, z: 1.0, rot: 0.4 },
      ],
      searchlight: { x: 18.6, z: 1.6, rot: Math.PI + 0.5, sweep: 1.2, reach: 3.0, period: 15, variant: 1 },
    },
  }),
  defineMap({
    id: 'noon_boathouse_lamp', name: 'The Boathouse Lamp', theme: 'campus', tier: 'advanced',
    desc: 'Along the shore road from the east, out along the stone breakwater, once round the old iron lamp at its end, back across the breakwater head and up the timber pier into the boathouse, out west. The lizardfolk curl round the lamp like cats on a stove.',
    concept: 'Breakwater curl: out along a breakwater, a 270° curl round the old lamp, back across the breakwater head, a diagonal pier into the boathouse tunnel',
    rows: [
      'HHHHHHHHHHHHHHHHHHHH',
      'H...,......,........',
      'H.T.....,...........',
      '........HHH........H',
      'H...HHH.~~~~~..~~~~~',
      'H.,.....~~~~~.....~~',
      'H.....~~~~~~.......~',
      'H...~~~~~~~~.......~',
      'H..~~~~~~~~~.......~',
      'H.~~~~~~~~~~.......~',
      '~~~~~~~~~~~~.......~',
      '~~~~~~~~~~~~~~~~~~~~',
    ],
    crossings: 'flat',
    paths: [
      [[21, 2.5], L, [15.0, 2.5], [13.9, 3.0], [13.5, 4.0], L, [13.5, 7.6], [13.9, 9.1], [15.5, 10.0], [17.1, 9.1], [17.5, 7.8], [17.1, 6.6], [15.5, 6.0], L, [12.4, 6.0], [11.2, 5.6], L, [8.6, 3.8], [7.8, 3.5], L, [7.4, 3.5], IN, L, [3.6, 3.5], OUT, L, [-1, 3.5]],
    ],
    decor: [
      { type: 'oldLamp', x: 15, y: 8, rot: 0, s: 1.7 }, { type: 'boatRack', x: 2, y: 5, rot: Math.PI / 2 },
      { type: 'lantern', x: 3, y: 1 }, { type: 'bench', x: 10, y: 1 },
    ],
    city: {
      searchlight: { x: 18.5, z: 4.6, rot: Math.PI - 0.3, sweep: 1.3, reach: 3.4, period: 14 },
    },
  }),

  // -------------------------------------------------------------------------
  // Chapter 3 · Act II — The Bell Festival (city, the Old Town district at night; MAPS.md, STEP3_BUILD_PLAN §4)
  // -------------------------------------------------------------------------
  defineMap({
    id: 'noon_old_town', name: 'Old Town Lanes', theme: 'city', district: 'oldtown', tier: 'intermediate',
    desc: 'In from the west through the Old Town lanes: up and round one block of old houses, down and round the next, up and round a third, and out east to the festival street. The flat roofs inside each loop are the place to stand.',
    concept: 'Alternating keys: three hooked lanes round blocks of old houses, north, south, north, with flat roofs inside the hooks',
    rows: [
      'HHHHHHHHHHHHHHHHHHHH',
      'H.........,........H',
      'H..................H',
      'H.........,........H',
      'H..........H........',
      'H..UU..........UU..H',
      'H..UU..........UU..H',
      '...................H',
      'H.,................H',
      'H.............~~~..H',
      'H.............~~~..H',
      '~~~~~~~~~~~~~~~~~~~~',
    ],
    paths: [
      street([[-1, 7.0], [2.5, 7.0], [2.5, 2.5], [5.5, 2.5], [5.5, 7.0], [8.5, 7.0], [8.5, 10.5], [11.5, 10.5], [11.5, 7.0], [14.5, 7.0], [14.5, 2.5], [18.0, 2.5], [18.0, 5.5], [21, 5.5]], { r: 1.5 }),
    ],
    decor: [
      { type: 'lantern', x: 9, y: 2 }, { type: 'lantern', x: 12, y: 4 }, { type: 'bench', x: 1, y: 9 },
    ],
  }),
  defineMap({
    id: 'noon_takoyaki_row', name: 'Takoyaki Row', theme: 'city', district: 'oldtown', tier: 'intermediate',
    desc: 'Down the festival street from the north-west in one long diagonal past the stalls, a wide turn by the ring toss, back up another diagonal to the bowing-contest stage, round again and down to the south-east gate. The road crosses the stall rows twice; mind the griddles.',
    concept: 'Lantern N: three long diagonals joined by two wide reversals, crossing the two stall rows',
    rows: [
      'HHHHHHHHHHHHHHHHHHHH',
      '...................H',
      'H..................H',
      'H.....,........,...H',
      '~~.................H',
      '~~.......,.........H',
      '~~.................H',
      '~~~....,......,....H',
      '~~~................H',
      '~~~................H',
      '~~~..........,......',
      '~~~HHHHHHHHHHHHHHHHH',
    ],
    paths: [
      [[-1, 1.5], L, [0.5, 1.5], [1.7, 2.2], L, [5.3, 7.9], [6.2, 9.4], [7.6, 10.1], [9.0, 9.5], [9.8, 8.2], L, [12.2, 3.6], [13.1, 2.4], [14.5, 2.0], [15.8, 2.7], [16.5, 4.0], L, [18.8, 9.2], [19.6, 10.3], L, [21, 10.5]],
    ],
    decor: [
      { type: 'lantern', x: 4, y: 2 }, { type: 'lantern', x: 11, y: 7 }, { type: 'bench', x: 16, y: 7 },
    ],
  }),
  defineMap({
    id: 'noon_shrine_steps', name: 'The Lake Steps', theme: 'city', tier: 'advanced',
    desc: 'Two fronts in the lake fog. The town road comes in from the west to the foot of the shrine steps; a rift opens in the middle of the lake, and a second column wades ashore along the old jetty and joins it there. Then one climb: east along the lower terrace, back west along the upper one, and up through the precinct gate.',
    concept: 'Two fronts, one climb: a town road and a lake lane meet at the foot of the steps, then a Z up two terraces to the gate',
    rows: [
      'HHHHHHHHHHH.HHHHHHHH',
      'H..................H',
      'H.......,..........H',
      'H..................H',
      'H...HHH.........,..H',
      'H..,...............H',
      'H..................H',
      'H........,.........H',
      'H.........~~~~~~~~~~',
      '..........~~~~~~~~~~',
      'H..,.....~~~~~~~~~~~',
      'HHHHHHH~~~~~~~~~~~~~',
    ],
    crossings: 'bridge',
    paths: [
      street([[-1, 9.5], [6.0, 9.5], [6.0, 6.0], [16.0, 6.0], [16.0, 3.0], [11.5, 3.0], [11.5, -1]], { r: 1.5 }),
      // the rift lane: a tear in the lake opens mid-water, and the column wades ashore along the old jetty
      { inside: true, nodes: [[16.5, 10.5], L, [10.0, 10.5], [8.3, 10.3], [7.1, 9.6], [6.4, 8.6]], join: { path: 0, at: [6.0, 7.8] } },
    ],
    decor: [
      { type: 'torii', x: 14, y: 1 }, { type: 'stoneLantern', x: 9, y: 1 }, { type: 'stoneLantern', x: 16, y: 1 },
    ],
  }),
  defineMap({
    id: 'noon_old_town_burning', name: 'Old Town, Burning', theme: 'city', district: 'oldtown', tier: 'advanced',
    desc: 'The same lanes, the night it burns. Two blocks have fallen into the street, so the column takes one long S from the west round the rubble and out north, under the smoke. Hoses run down to the mill race.',
    concept: 'Broken fret: one long S round two fallen blocks of Old Town, the mill race along the south',
    rows: [
      'HHHHHHHHHHHHHHHHHHHH',
      'H.........,.........',
      'H..................H',
      'H..XXX.............H',
      'H..XXXX............H',
      'H...XX.............H',
      'H..................H',
      '...................H',
      'H.,......UU..XXX...H',
      'H........UU.XXXX,..H',
      'H.....~~~....XX....H',
      '~~~~~~~~~~~~~~~~~~~~',
    ],
    paths: [
      [[-1, 7.5], L, [1.2, 7.5], [3.4, 7.9], [5.6, 8.2], [7.6, 7.4], [8.6, 6.8], [10.6, 5.7], [13.0, 5.6], [15.4, 6.2], [16.9, 5.4], [17.8, 4.0], [18.1, 2.4], L, [18.2, -1]],
    ],
    decor: [
      { type: 'lantern', x: 7, y: 10 }, { type: 'bench', x: 12, y: 9 },
    ],
  }),
  defineMap(echoMap(SHRINE_SANCTUM, {
    id: 'noon_lakeside_shrine', name: 'The Lakeside Shrine', theme: 'city', tier: 'advanced',
    desc: 'The old shrine on the lake, the night of the fire. The two pilgrim roads still sweep in past the mirror ponds, meet before the sanctum and pass beneath it, while the sky above the roof tears open.',
    concept: 'Echo of Inner Sanctum: the same Y and sanctum tunnel, a thousand years later, burning, under the tear',
    echoDiff: [],
    decor: [
      { type: 'torii', x: 11, y: 4 }, { type: 'bell', x: 17, y: 4 }, { type: 'stoneLantern', x: 11, y: 3 },
      { type: 'stoneLantern', x: 1, y: 5 }, { type: 'stoneLantern', x: 18, y: 1 },
      // the tear over the burning sanctum (pulses with The Tear, src/render/tear.js)
      { type: 'hammerTear', x: 13, y: 5 },
    ],
  })),

  // -------------------------------------------------------------------------
  // Chapter 4 · Act II — The Checkpoint (city, the highway district, then the far north on `snow`; MAPS.md §1.5,
  // STEP4_BUILD_PLAN §4)
  // -------------------------------------------------------------------------
  defineMap({
    id: 'noon_toll_plaza', name: 'Toll Plaza', theme: 'city', district: 'highway', tier: 'intermediate',
    desc: 'Down off the mountain pass from the north-east to the toll plaza, where the highway fans out into three toll lanes through the booths and closes up again past the barrier, then leaves down the off-ramp to the south-west. The booth roofs are a good place to stand.',
    concept: 'Three-booth lens: one road splits into three toll lanes round two booth islands and closes up again, then the off-ramp',
    rows: [
      '~~~~~~~~~~~~~~~~HHHHHH',
      'H.....,...............',
      'H....................H',
      'H.........UU.........H',
      'H.........UU.........H',
      'H....................H',
      'H.........UU.........H',
      'H.........UU.........H',
      'H....................H',
      'H..,.........~~~~....H',
      '............~~~~~....H',
      'HHHHHHHHHHHH~~~~~HHHHH',
    ],
    paths: [
      street([[23, 1.5], [20.0, 1.5], [20.0, 5.5], [2.5, 5.5], [2.5, 10.5], [-1, 10.5]], { r: [1.8, 1.8, 1.5, 1.5] }),
      { fork: { path: 0, at: [17.6, 5.5] }, nodes: [[15.8, 4.4], [14.0, 2.2], L, [9.6, 2.2], [7.8, 4.4]], join: { path: 0, at: [6.4, 5.5] } },
      { fork: { path: 0, at: [15.6, 5.5] }, nodes: [[13.8, 6.6], [12.0, 8.8], L, [8.0, 8.8], [6.2, 6.6]], join: { path: 0, at: [4.4, 5.5] } },
    ],
    decor: [
      { type: 'vendingMachine', x: 4, y: 2, rot: Math.PI }, { type: 'vendingMachine', x: 5, y: 2, rot: Math.PI },
      { type: 'signpost', x: 17, y: 3 }, { type: 'lantern', x: 16, y: 7 },
    ],
  }),
  defineMap({
    id: 'noon_checkpoint', name: 'Azami\'s Checkpoint', theme: 'city', district: 'highway', tier: 'advanced',
    desc: 'Down the pass road from the north to the Brigade\'s barricade line. The short lane runs straight through the checkpoint gate; the long lane swings west round the barricade blocks and comes back to rejoin it below. When Azami\'s barrier is down, the column takes the long way.',
    concept: 'Barrier chicane: one lane dead straight through the gate, the other a wide hook west round the barricades, rejoining below',
    rows: [
      'HHHHHHHHHHHHHH.HH~~H',
      'H.....,.......,..~~H',
      'H................~~H',
      'H................~~H',
      'H........HH......~~H',
      'H..,.....HH......~~H',
      'H................~~H',
      'H................~~H',
      'H.~~~......,.....~~H',
      'H.~~~............~~H',
      'H.~~~..,.........~~H',
      'HHHHHHHHHHHHHH.HH~~H',
    ],
    paths: [
      [[14.5, -1], L, [14.5, 13]],
      {
        fork: { path: 0, at: [14.5, 1.2] },
        nodes: [[13.4, 2.6], [11.0, 3.1], L, [7.6, 3.1], [5.8, 3.9], [5.2, 5.4], [6.0, 6.7], [7.8, 7.3], L, [10.6, 7.3], [12.6, 7.9]],
        join: { path: 0, at: [14.5, 10.2] },
      },
    ],
    decor: [
      { type: 'tent', x: 3, y: 1 }, { type: 'tent', x: 2, y: 6 }, { type: 'lantern', x: 16, y: 4 },
      { type: 'parkedCar', x: 8, y: 9, rot: 0 }, { type: 'parkedCar', x: 11, y: 9, rot: 0 },
    ],
    city: { barriers: [{ lane: 0 }] },
  }),
  defineMap({
    id: 'noon_tunnel_mouth', name: 'Tunnel Mouth', theme: 'city', district: 'highway', tier: 'advanced',
    desc: 'Two carriageways come out of two bores in the mountain wall and run side by side: south, east along the valley floor and south again to two exits, one inside the other. The central reservation between them covers both.',
    concept: 'Dual carriageway: two parallel lanes out of two tunnel bores, nested steps south-east, two exits',
    rows: [
      'HH.HH.HHHHHHHHHHHHHHHH',
      'HH.HH.HHHHHHHHHHHHHHHH',
      'HH.HH.HHHHHHHHHHHHHHHH',
      'HH.HH.HHHHHHHHHHHHHHHH',
      'H~.................,.H',
      'H~...................H',
      'H~...................H',
      'H~..........,.......~H',
      'H~..................~H',
      'H~.......,..........~H',
      'H~..................~H',
      'H~...................H',
      'HHHHHHHHHHHHHHH.HHH.HH',
    ],
    paths: [
      street([[2.5, -1], [2.5, 10.5], [15.5, 10.5], [15.5, 14]], { r: 2.0, tunnel: [[2.5, 0.4], [2.5, 3.6]] }),
      street([[5.5, -1], [5.5, 7.0], [19.5, 7.0], [19.5, 14]], { r: 2.0, tunnel: [[5.5, 0.4], [5.5, 3.6]] }),
    ],
    decor: [
      { type: 'lantern', x: 4, y: 4 }, { type: 'lantern', x: 7, y: 4 }, { type: 'parkedCar', x: 17, y: 4, rot: 0 },
    ],
    city: { snowRows: 6 },
  }),
  defineMap({
    id: 'north_frozen_villages', name: 'The Frozen Villages', theme: 'snow', tier: 'advanced',
    desc: 'Out of the Petal Gate\'s north mouth, past the Brigade\'s sandbags, straight up the old sled run, round the frozen village square in one wide horseshoe and out north-east past the cairn, on the road to the camp where the children are.',
    concept: 'Climb and horseshoe: a straight climb up the sled run, a wide clockwise horseshoe over the village square, a hook out north-east',
    rows: [
      'TTTTTTTTTTTTTTTTTT.T',
      'T..................T',
      'T..................T',
      'T........~~........T',
      'T........~~........T',
      'T~~................T',
      'T~~......,.........T',
      'T~~................T',
      'T~~................T',
      'T~~................T',
      'T~~................T',
      'TTTT.TTTTTTTTTTTTTTT',
    ],
    paths: [
      [[4.5, 13], L, [4.5, 5.5], ...curve((t) => [10.0 - 5.5 * DM.cos(t), 5.5 - 4.5 * DM.sin(t)], 0, Math.PI, 30), L, [15.5, 8.5], [16.0, 9.6], [17.0, 10.0], [18.0, 9.6], [18.5, 8.5], L, [18.5, -1]],
    ],
    decor: [
      { type: 'campfire', x: 10, y: 7 }, { type: 'tent', x: 16, y: 3 }, { type: 'pine', x: 1, y: 2 },
      { type: 'flag', x: 6, y: 10 },
    ],
    city: { spawnGate: 'petalRift' },
  }),
  defineMap({
    id: 'north_snow_bridge', name: 'The Snow Bridge', theme: 'snow', tier: 'expert',
    desc: 'Two columns of the Host, one along the gorge rim from the west and one down the frozen riverbed from the north-east, meet at the bridgehead and cross the ravine as one on the Brigade\'s long folding bridge, south to the gate.',
    concept: 'Two columns, one bridge: two lanes meet at the bridgehead, then one long straight deck over the ravine',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTT',
      '......................',
      'T.....................',
      'T....................T',
      'T....~~~~~~~~~~~~~...T',
      'T....~~~~~~~~~~~~~...T',
      'T....~~~~~~~~~~~~~...T',
      'T....~~~~~~~~~~~~~...T',
      'T....~~~~~~~~~~~~~...T',
      'T....~~~~~~~~~~~~~...T',
      'T....~~~~~~~~~~~~~...T',
      'TTTTT~~~~~~~~~~~~~TTTT',
    ],
    crossings: 'bridge',
    paths: [
      street([[-1, 1.5], [11.5, 1.5], [11.5, 13]], { r: 2.0 }),
      { nodes: [[23, 1.2], L, [15.0, 1.2], [13.0, 1.9]], join: { path: 0, at: [11.5, 3.9] } },
    ],
    decor: [
      { type: 'banner', x: 8, y: 3 }, { type: 'tent', x: 19, y: 9 }, { type: 'tent', x: 2, y: 9 },
      { type: 'pine', x: 2, y: 5 }, { type: 'flag', x: 20, y: 6 },
    ],
    city: { spawnGate: 'petalRift' },
  }),

  // -------------------------------------------------------------------------
  // Chapter 5 · Act II — The Drowned Line (`drowned`: the flooded Line 2 under Itomachi, then the reservoir park on
  // `city` with `district: 'park'`; MAPS.md §1.6, STEP5_BUILD_PLAN §4)
  // -------------------------------------------------------------------------
  defineMap({
    id: 'noon_flooded_platform', name: 'Flooded Platform', theme: 'drowned', tier: 'intermediate',
    desc: 'Line 2\'s old station, half under black water. The column comes out of the dark bore in the middle of the board, west along the platform deck over the flooded tracks, up the station stairs at the far end and back east along the street above the station block.',
    concept: 'Up from the platform: out of a bore mid-board, west along a deck over the flooded tracks, up the stairs, back east along the street above',
    rows: [
      'HHHHHHHHHHHHHHHHHHHH',
      'H.......,...........',
      'H...................',
      'H.....HHHHHHHHHHH..H',
      'H..,..HHHHHHHHHHH..H',
      'H..................H',
      '~~~~~~~~~~~~~~~HHHHH',
      '~~~~~~~~~~~~~~~HHHHH',
      '~~~~~~~~~~~~~~~HHHHH',
      'H.......,..........H',
      'HHHHHHHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHHHHHH',
    ],
    // the subway spawn (decision 7): the lane starts inside the bore, so the column is hidden until the OUT mouth
    paths: [
      { inside: true, nodes: street([[17.4, 7.5], [3.5, 7.5], [3.5, 2.0], [21, 2.0]], { r: 1.8, tunnel: [[17.3, 7.5], [14.6, 7.5]] }) },
    ],
    decor: [
      { type: 'vendingMachine', x: 12, y: 5, rot: Math.PI }, { type: 'signpost', x: 7, y: 5 },
      { type: 'missingPoster', x: 10, y: 9, rot: Math.PI }, { type: 'bench', x: 16, y: 9 },
    ],
  }),
  defineMap({
    id: 'noon_line2_tunnels', name: 'Line 2 Tunnels', theme: 'drowned', tier: 'intermediate',
    desc: 'The flooded Line 2 runs under the city blocks in one long gentle sag. The column is out of sight in four bores and in view only in the three open vent cuttings between them and the short run up to the goal. Hold the cuttings.',
    concept: 'Dashed line: one gentle sag across the board, four bores under city blocks, three open vent cuttings',
    rows: [
      'HHHHHHHHHHHHHHHHHHHH',
      'HHHHHH...,....HHHHHH',
      'HHHHHH~.......HHHHHH',
      'HHHHHH~~..........HH',
      'H~.....HHH.HHHH.~~.H',
      'H~.....HHH.HHHH.~~.H',
      'H.,....HHH.HHHH....H',
      'H......HHH.HHHH....H',
      'H..~~.........~~.,.H',
      'H..~~..........~...H',
      '~~~~~~~~~~~~~~~~~~~~',
      'HHHHHHHHHHHHHHHHHHHH',
    ],
    paths: [
      [[-1, 2.5], L, [0.6, 2.5], IN, L, [4.4, 2.5], OUT, [5.8, 3.1], [6.8, 4.4], IN, [7.6, 6.2], [8.8, 7.6], OUT, [10.6, 8.2], [12.2, 7.6], IN, [13.4, 6.2], [14.4, 4.6], OUT, [15.6, 3.6], [17.0, 3.2], IN, L, [19.0, 3.2], OUT, L, [21, 3.2]],
    ],
    decor: [
      { type: 'signpost', x: 9, y: 1 }, { type: 'lantern', x: 17, y: 7 }, { type: 'trashBin', x: 2, y: 7 },
    ],
  }),
  defineMap({
    id: 'noon_pump_station', name: 'Pump Station', theme: 'drowned', tier: 'advanced',
    desc: 'Something cold breathes out of a gate on the north wall of the old pump station. The column comes south past the pump hall, east along the sump, north through the hall itself, back west over its own first leg on the pipe gantry, then south and out west.',
    concept: 'Pipe-gantry loop: south, east, north through the pump hall, west over its own first leg on a gantry, then out west',
    rows: [
      'HHHHHHHHH.HHHHHHHHHH',
      'H........,.........H',
      'H..................H',
      'H..................H',
      'H.....,....~~~~....H',
      'H..........~~~~HHH.H',
      'H..........~~~~HHH.H',
      'H..........~~~~....H',
      '...................H',
      '~~~~~~.,...........H',
      '~~~~~~.............H',
      '~~~~~~HHHHHHHHHHHHHH',
    ],
    crossings: 'bridge',
    paths: [
      street([[9.5, -1], [9.5, 9.5], [16.5, 9.5], [16.5, 3.0], [2.5, 3.0], [2.5, 7.5], [-1, 7.5]], { r: 1.8, tunnel: [[16.5, 7.4], [16.5, 5.4]] }),
    ],
    // the pipe gantry where the loop rides over its own first leg
    bridge: { overpass: '#b9c4cc', girder: '#3a4650', grating: true },
    decor: [
      { type: 'gearTower', x: 13, y: 1 }, { type: 'chimney', x: 5, y: 1 }, { type: 'vent', x: 6, y: 9 },
      { type: 'crane', x: 18, y: 1 },
    ],
    city: { spawnGate: 'noonGate' },
  }),
  defineMap({
    id: 'noon_reservoir_park', name: 'Reservoir Park', theme: 'city', district: 'park', tier: 'expert',
    desc: 'Fog on the reservoir. The column comes along the dam crest from the west, down the spillway steps into the park, back west across the lawns and north through the dam\'s service tunnel under its own first leg, then up the west promenade and out.',
    concept: 'Spillway turn under the dam: east along the crest, down the steps, west across the bowl, north through a tunnel under its own first leg',
    rows: [
      'H....~~~~~~~~~~~~~~~',
      'H....~~~~~~~~~~~~~~~',
      'H....~~~~~~~~~~~~~~~',
      'H.....~~~~~~~~~~~~~~',
      '...................H',
      'HHHHHHHHHHHHHHH...HH',
      'H..................H',
      'H.....,......,.....H',
      'H..................H',
      'H..................H',
      'H.......~~~~~~.....H',
      'H..,....~~~~~~...,.H',
    ],
    paths: [
      street([[-1, 4.5], [16.5, 4.5], [16.5, 9.0], [3.5, 9.0], [3.5, -1]], { r: 1.5, tunnel: [[3.5, 6.6], [3.5, 2.6]] }),
    ],
    decor: [
      { type: 'bench', x: 10, y: 7 }, { type: 'boat', x: 11, y: 1 }, { type: 'lantern', x: 7, y: 6 },
      { type: 'lantern', x: 14, y: 6 }, { type: 'willow', x: 18, y: 2 },
    ],
  }),
  defineMap({
    id: 'noon_reservoir_willow', name: 'The Reservoir Willow', theme: 'city', district: 'park', tier: 'expert',
    desc: 'Night and fog on the reservoir, and a great willow on its island in the middle. Two columns come off the two dam walls: one along the north causeway, round the willow\'s east side and out east; the other along the south causeway, round its west side and out west. The lanes never meet.',
    concept: 'Two curls round the willow: two S-shaped causeways, one over the island\'s north and east sides, one under its south and west sides, never crossing',
    rows: [
      '...~~~~~~~~~~~~~~~~~',
      '..~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~......~~~~~~~',
      '~~~~~~~......~~~~~~~',
      '~~~~~~~......~~~~~~~',
      '~~~~~~~......~~~~~~~',
      '~~~~~~~......~~~~~~~',
      '~~~~~~~......~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~..',
      '~~~~~~~~~~~~~~~~~...',
    ],
    paths: [
      // lane 0 (the Willow's: the longer one, with a wiggle on the way out)
      [...street([[-1, 2.0], [14.0, 2.0], [14.0, 7.0], [15.7, 7.0]], { r: [3.0, 1.7] }), [17.2, 6.5], [18.7, 7.0], L, [21, 7.0]],
      street([[21, 10.0], [6.0, 10.0], [6.0, 5.0], [-1, 5.0]], { r: [3.0, 1.7] }),
    ],
    decor: [
      { type: 'willow', x: 10, y: 6 }, { type: 'boat', x: 16, y: 4 }, { type: 'boat', x: 3, y: 7 },
      { type: 'lantern', x: 1, y: 0 }, { type: 'lantern', x: 18, y: 11 },
    ],
  }),

  // -------------------------------------------------------------------------
  // Bounty (resource) arenas
  // -------------------------------------------------------------------------
  defineMap({
    id: 'arena_library', name: 'Library Courtyard', theme: 'sakura', tier: 'intermediate',
    desc: 'Bounty arena behind the academy library. Two book carts trundle down the outer aisles of the courtyard, meet at the far wall and roll back up the centre aisle — under the reading room — to where they came from. Lost study books wash up in the fountain.',
    concept: 'Three aisles (E): two lanes run out along the outer aisles, merge at the far wall, return down the centre aisle under the reading room',
    rows: [
      'HHHHHH,HHHHHH,HHHH',
      'H.....,.....,....H',
      'H..T.............H',
      'H.......,..~~.,..H',
      'H.,....HHH.......H',
      '.................H',
      'H......HHH...,...H',
      'H.,.......,......H',
      'H..............,.H',
      'H..T....,.....T..H',
      'HHHHHHHHHHHHHHHHHH',
    ],
    paths: [
      [[-1, 2.0], L, [0.8, 2.0], [4.4, 1.6], [8.6, 2.4], [12.2, 1.9], [14.4, 2.4], [15.7, 3.8], [15.2, 5.0], [13.8, 5.5], L, [9.8, 5.5], IN, L, [6.6, 5.5], OUT, L, [-1, 5.5]],
      { nodes: [[-1, 9.0], L, [0.8, 9.0], [4.4, 9.4], [8.6, 8.6], [12.2, 9.1], [14.4, 8.6], [15.7, 7.2], [15.2, 6.0]], join: { path: 0, at: [13.6, 5.5] } },
    ],
    decor: [
      { type: 'bookshelf', x: 3, y: 4 }, { type: 'fountain', x: 12, y: 7 }, { type: 'sakura', x: 15, y: 1 },
      { type: 'bench', x: 7, y: 3 }, { type: 'bookshelf', x: 3, y: 6 },
    ],
  }),
  defineMap({
    id: 'arena_market', name: 'Market Canal', theme: 'lake', tier: 'intermediate',
    desc: 'Bounty arena on the merchant canal. One gate, then the crowd splits: half crosses the north bridge, half the south bridge, and they leave by different gates. Plenty of coins.',
    concept: 'Market fork: one entrance splits around the canal market into two exits',
    rows: [
      'HHHH,HHHHHH~~HH.HHHH',
      'H......,...~~.....,H',
      '..........,~~......H',
      'H..,.......~~..,...H',
      'H..........~~......H',
      '...........~~......H',
      'H.,...H....~~..H...H',
      'H..........~~....,.H',
      '...........~~.......',
      'H..,....H..~~...,..H',
      'HHHHHHHHHHH~~HHHHHHH',
    ],
    paths: [
      [[-1, 5.5], L, [1.4, 5.5], [4.0, 5.4], [5.9, 4.3], [6.6, 2.2], [8.4, 1.0], [10.0, 1.9], [11.5, 3.4], [13.2, 4.0], [14.8, 3.0], [15.6, 1.4], [17.4, 1.0], [19.0, 1.6], L, [21, 1.6]],
      { fork: { path: 0, at: [4.0, 5.4] }, nodes: [[5.9, 6.5], [6.6, 8.4], [8.4, 9.4], [10.0, 8.7], [11.5, 7.4], [13.2, 6.8], [14.8, 7.8], [15.6, 9.2], [17.4, 9.6], [19.0, 9.0], L, [21, 9.0]] },
    ],
    decor: [
      { type: 'stall', x: 2, y: 3 }, { type: 'boat', x: 12, y: 5 }, { type: 'stall', x: 17, y: 5 },
      { type: 'lantern', x: 7, y: 5 }, { type: 'boat', x: 11, y: 0 },
    ],
  }),
  defineMap({
    id: 'arena_workshop', name: 'Workshop Yard', theme: 'foundry', tier: 'advanced',
    desc: 'Bounty arena in the gear workshop: the belt road runs once round the yard like a conveyor, then cuts straight through the middle — under the gear press — and leaves over its own belt on a steel ramp.',
    concept: 'Conveyor loop: one lap round the yard, then through the gear-press tunnel in the middle and out over the belt',
    rows: [
      'HHHRRHHHH,HHHHRRHHHH',
      'H......,.........R.H',
      'H.,..R.....,....~~.H',
      'H..,......,.....~~.H',
      'H.,.....HHH....,...H',
      'H.....,..........,.H',
      'H...~~..HHH........H',
      'H..R~~..,..........H',
      'H.,.............,..H',
      '...........,.......H',
      'HHHHRRHHHH,HHHHHH.HH',
    ],
    paths: [
      [[-1, 8.6], L, [1.6, 8.6], L, [12.0, 8.6], ...arc(12.0, 6.6, 2.0, 90, 0, 30), L, ...arc(12.0, 4.0, 2.0, 0, -90, 30), L, [5.0, 2.0], ...arc(5.0, 4.0, 2.0, -90, -180, 30), ...arc(4.5, 4.0, 1.5, 180, 90, 30), L, [7.6, 5.5], IN, L, [10.6, 5.5], OUT, L, [15.4, 5.5], ...arc(15.4, 7.5, 2.0, -90, 0, 30), L, [17.4, 12]],
    ],
    decor: [
      { type: 'gearTower', x: 7, y: 7 }, { type: 'crane', x: 18, y: 4 }, { type: 'chimney', x: 1, y: 3 },
      { type: 'vent', x: 12, y: 4 }, { type: 'gearTower', x: 18, y: 8 },
    ],
  }),
  defineMap({
    id: 'arena_meadow', name: 'Wildflower Meadow', theme: 'mountain', tier: 'intermediate',
    desc: 'Bounty arena in a high meadow where feathers, blades, embers and rime crystals gather. The path folds like a paperclip, two hairpins nested inside each other, then escapes over its own bottom run and strolls out along the southern edge of the meadow.',
    concept: 'Paperclip: two nested hairpins spiralling in, then out over the bottom run and along the south edge',
    rows: [
      'TTTTTT,,TTTTT,,,TTTT',
      'T.,.......,.,....,.T',
      '...,,.....,...,..,.T',
      'T.,..........,..,..T',
      'T..,..........,.....',
      'T..........,.....~~T',
      'T.~~.....,......~~~T',
      'T.~,....,......~~..T',
      'TT.,..,...,.......,T',
      'T..,.....,.........T',
      'TTTTT,,TTTTTTT,,TTTT',
    ],
    paths: [
      [[-1, 1.8], L, [1.0, 1.8], L, [11.4, 1.8], ...arc(11.4, 4.6, 2.8, -90, 90, 30), L, [6.4, 7.4], ...arc(6.4, 5.8, 1.6, 90, 270, 30), L, [8.4, 4.2], [10.2, 4.9], [11.2, 6.3], [11.6, 7.8], ...arc(13.2, 7.8, 1.6, 180, 90, 30), L, [21, 9.4]],
    ],
    decor: [
      { type: 'pine', x: 1, y: 4 }, { type: 'flag', x: 7, y: 5 }, { type: 'campfire', x: 2, y: 8 },
      { type: 'statue', x: 17, y: 3 }, { type: 'pine', x: 4, y: 9 },
    ],
  }),
  defineMap({
    id: 'arena_runegarden', name: 'Rune Garden', theme: 'night', tier: 'advanced',
    desc: 'Bounty arena in a moonlit garden of charms, runes and cogs. Two serpentine paths curl round the moon pools and cross at the rune circle in the middle.',
    concept: 'Twin serpents: two S-curves curling round the moon pools, crossing at the rune circle',
    crossings: 'flat',
    rows: [
      'TTTTHTTTT,TTTTTTT.TT',
      'T......,..H.....,..T',
      '..............,....T',
      'T..~~~.....,...~~..T',
      'T..~~~~.,......~~..T',
      'T..................T',
      'T.,..H.....,..~~~..T',
      'T.....,......~~~~..T',
      '.......,...,...H...T',
      'T..H...,............',
      'TTTTTTTTHTTTTTTTTTTT',
    ],
    paths: [
      [[-1, 2.0], L, [0.8, 2.0], [3.4, 1.6], [6.8, 2.2], [8.2, 4.2], [9.6, 5.6], [11.4, 6.6], [12.2, 8.6], [14.2, 9.4], [17.4, 9.2], [19.0, 9.4], L, [21, 9.4]],
      [[-1, 8.6], L, [0.8, 8.6], [3.4, 9.2], [6.4, 8.8], [7.8, 6.8], [9.6, 5.6], [11.8, 4.2], [12.4, 2.4], [14.4, 1.4], [17.6, 1.6], [18.6, 0.4], L, [18.6, -1]],
    ],
    ground: [{ type: 'runeRing', x: 9.6, y: 5.6, r: 1.35, color: '#b48cff' }],
    decor: [
      { type: 'stoneLantern', x: 10, y: 1 }, { type: 'crystal', x: 4, y: 5 }, { type: 'shrine', x: 15, y: 5 },
      { type: 'lantern', x: 5, y: 6 }, { type: 'statue', x: 2, y: 6 },
    ],
  }),

  // -------------------------------------------------------------------------
  // Total Assault (boss) arenas
  // -------------------------------------------------------------------------
  defineMap({
    id: 'arena_crypt', name: 'Lych Crypt', theme: 'night', tier: 'expert',
    desc: 'The Grave Lych\'s candlelit crypt garden. The dead rise from the crypt in the middle — up a buried passage — and spiral out through the bog pools to the gate.',
    concept: 'Rising from the crypt: a buried passage to the centre, then a spiral outward',
    rows: [
      'TTTHHTTTT,TTTHHTTTTT',
      'T....,...H....,....T',
      '...................T',
      'T..~~~.....,....,..T',
      'T..~~~~..H....~~...T',
      'T.,.~~.....,..~~...T',
      'T..................T',
      'T..,....~~~~...,...T',
      'TH.....~~~~~~...H..T',
      'T..,....~~~~.....,.T',
      'T...................',
      'TTTHHTTTTTTTTTTTTTTT',
    ],
    paths: [
      [[7.7, -1], L, [7.7, 0.2], IN, L, [7.7, 4.5], OUT, ...spiral(10, 6.0, 2.3, 8.6, 180, -300, 30, 0.6), [16.8, 9.8], [19.4, 9.6], L, [21, 9.6]],
    ],
    decor: [
      { type: 'bones', x: 11, y: 4 }, { type: 'candle', x: 1, y: 8 }, { type: 'statue', x: 10, y: 6 },
      { type: 'willow', x: 1, y: 2 }, { type: 'lantern', x: 16, y: 7 },
    ],
  }),
  defineMap({
    id: 'arena_forge', name: 'Colossus Forge', theme: 'foundry', tier: 'expert',
    desc: 'The Iron Colossus\'s forge floor. Its long march climbs out of the furnace pit, hooks right round the coolant reservoir and stamps off west — a giant question mark.',
    concept: 'Question mark: up out of the forge tunnel, a hook round the reservoir, off to the west',
    rows: [
      'HHHHHHRRHHHHHHHHRRHH',
      'H..................H',
      'H.,.....,..~~~.....H',
      'H...R.....~~~~~....H',
      'H.......R.~~~~~.R..H',
      '....,.....~~~~~....H',
      'H.R......,~~~~~.....',
      'H.........~~~~~..R.H',
      'H..,..R....~~~.....H',
      'H..R...........,...H',
      'H.......HHHH.......H',
      'HHHHHHXXXHHXXXHHHHHH',
    ],
    paths: [
      [[9.5, 13], L, [9.5, 11.8], IN, L, [9.5, 9.8], OUT, [9.9, 8.7], [11.6, 8.5], [14.4, 9.3], [17.0, 8.6], [17.8, 5.8], [16.8, 2.8], [14.4, 1.2], [10.6, 1.0], [7.2, 1.4], [5.4, 3.2], [5.8, 5.6], [6.8, 7.4], [5.6, 8.6], [3.4, 8.0], [1.6, 6.8], L, [-1, 6.8]],
    ],
    decor: [
      { type: 'chimney', x: 1, y: 9 }, { type: 'gearTower', x: 2, y: 2 }, { type: 'vent', x: 13, y: 11 },
      { type: 'crane', x: 15, y: 4 }, { type: 'crystal', x: 12, y: 4 },
    ],
  }),
  defineMap({
    id: 'arena_summit', name: 'Ashwing Summit', theme: 'volcano', tier: 'expert',
    desc: 'The Matriarch\'s summit: the trail zig-zags down the peak like a lightning bolt between lava vents and hot springs, and halfway down it curls once round the old cinder cone, crossing itself on a basalt bridge — nowhere to hide from the sky.',
    concept: 'Lightning bolt with a curl: two slanted legs and an alpha curl at the lower switchback that crosses itself',
    rows: [
      'RRRRRRRRRRRRRRRRRRRR',
      'R~~......R.......~~R',
      'R..,...........,....',
      'R......,...........R',
      'R.....,........,...R',
      'R.................XR',
      'R.....,..........XXR',
      'R..,.........~~...XR',
      'R............~~R...R',
      '...................R',
      'R~~~...,.....,..~~~R',
      'RRRRRRRRRRRRRRRRRRRR',
    ],
    paths: [
      [[3.0, -1], L, [3.0, 0.6], [4.4, 1.8], [8.0, 2.4], [12.0, 2.6], [14.6, 3.0], [16.2, 4.4], [15.6, 6.0], [13.0, 6.5], [9.6, 6.5], [7.2, 6.8], [5.4, 7.4], [3.6, 8.0], [2.2, 7.2], [2.0, 5.6], [3.2, 4.6], [4.8, 4.9], [5.6, 6.4], [5.8, 8.2], [7.0, 9.4], [9.0, 9.7], [13.6, 9.6], [17.4, 9.2], [18.6, 8.6], L, [21, 8.6]],
    ],
    // a pale basalt slab with ember-red parapets, so the curl's bridge stands out on the dark ash
    bridge: { overpass: '#bba899', girder: '#2b2020', overRail: '#e0703a' },
    decor: [
      { type: 'nest', x: 17, y: 2 }, { type: 'vent', x: 8, y: 8 }, { type: 'bones', x: 3, y: 6 },
      { type: 'crystal', x: 16, y: 7 }, { type: 'vent', x: 9, y: 4 },
    ],
  }),
  defineMap({
    id: 'arena_colosseum', name: 'Sakura Colosseum', theme: 'arena', tier: 'intermediate',
    desc: 'The academy\'s practice colosseum: four ring arenas, and the challenge road loops the loop around each one in turn — built for endless runs.',
    concept: 'Four rings: a loop-the-loop round each of four ring arenas in turn',
    crossings: 'bridge',
    rows: [
      'HHHHHHHH,,,HHHHHHHHH',
      '...................H',
      'H.,.~...,..,.~...,.H',
      'H.......T.......T..H',
      'H..................H',
      'H.,.............,..H',
      'H.......,,,........H',
      'H..................H',
      'H.,..T~....,..T.~,.H',
      'H..................H',
      'H..................H',
      'HHHH.HHHHHHHHHHHHHHH',
    ],
    paths: [
      [[-1, 4.4], L, [0.2, 4.4], ...loopNodes(4.4, 3.2, 2.0, 0), ...loopNodes(13.6, 3.0, 2.0, 0), [15.6, 5.2], ...loopNodes(16.6, 8.4, 1.7, 90, true), [16.4, 10.6], [13.2, 10.4], ...loopNodes(6.2, 8.8, 1.9, 180, true), [1.0, 10.8], L, [-1, 10.8]],
    ],
    decor: [
      { type: 'flag', x: 8, y: 0 }, { type: 'sakura', x: 1, y: 6 }, { type: 'sakura', x: 19, y: 3 },
      { type: 'fountain', x: 8, y: 2 }, { type: 'banner', x: 10, y: 0 },
    ],
  }),
];

export const MAP_MAP = Object.fromEntries(MAPS.map((m) => [m.id, m]));

/**
 * Look up a map definition.
 * @param {string} id map id, e.g. 'sakura_lane'
 * @returns {object} MapDef
 * @throws {Error} when the id is unknown
 */
export function getMap(id) {
  const m = MAP_MAP[id];
  if (!m) throw new Error(`Unknown map: ${id}`);
  return m;
}

/**
 * Tiles covered by a map's paths: every tile whose square the road band touches (curves and
 * diagonals rasterised exactly; src/core/track.js stampBand).
 * @param {object} map MapDef (or any { tracks } / legacy { paths } object)
 * @returns {Set<string>} "x,y" strings (includes off-grid spawn/exit tiles)
 */
export function pathTiles(map) {
  return stampTracks(mapTracks(map));
}

/** Distance from (x, y) to the nearest centreline of the given tracks. */
function centrelineDistance(tracks, x, y) {
  let best = Infinity;
  for (const t of tracks) {
    const p = t.points;
    for (let i = 0; i < p.length - 1; i++) {
      const ax = p[i][0];
      const ay = p[i][1];
      const dx = p[i + 1][0] - ax;
      const dy = p[i + 1][1] - ay;
      if (Math.abs(ax - x) > 3 || Math.abs(ay - y) > 3) continue;
      const l2 = dx * dx + dy * dy;
      let u = l2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const d = DM.hypot(ax + dx * u - x, ay + dy * u - y);
      if (d < best) best = d;
    }
  }
  return best;
}

/**
 * Buildable tile counts for UI badges / recommendations: tiles whose CENTRE is a legal spot
 * for an ordinary girl as far as the road band goes (free placement), by terrain. A rooftop
 * ('U') counts as land.
 * @param {object} map MapDef
 * @returns {{ land: number, water: number }}
 */
export function buildableTiles(map) {
  const tracks = mapTracks(map);
  const clear = BAND_HALF_WIDTH + TOWER_R;
  let land = 0;
  let water = 0;
  map.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const isLand = ch === '.' || ch === ',' || ch === 'U';
      const isWater = ch === '~' || ch === 'B';
      if (!isLand && !isWater) continue;
      if (centrelineDistance(tracks, x + 0.5, y + 0.5) < clear) continue;
      if (isLand) land++;
      else water++;
    }
  });
  return { land, water };
}

// Sakura Sentinels — battle maps (owner: world). See CONTRACTS.md §4.
//
// Legend for `rows`:
//   '.' grass/stone (buildable)   ',' flowers / decor (buildable)   '~' water (water units only)
//   'T' tree   'R' rock   'H' building / shrine / machinery   'X' void, lava or furnace (blocked)
//   'B' bridge: a water tile the road crosses or grazes (stamped automatically from the paths)
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

import {
  buildMapTracks, stampTracks, mapTracks, BAND_HALF_WIDTH, arc, spiral, curve, loopNodes, LINE, TUNNEL_IN, TUNNEL_OUT,
} from '../core/track.js';

// Track authoring shorthands (src/core/track.js): L = the next section is an exact straight,
// IN / OUT = a tunnel starts / ends at the previous control point.
const L = LINE;
const IN = TUNNEL_IN;
const OUT = TUNNEL_OUT;

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
function defineMap(o) {
  const grid = o.rows.map((r) => r.split(''));
  const height = grid.length;
  const width = grid[0].length;
  const { tracks, crossings, tiles: onPath } = buildMapTracks(o.paths, o.crossings ?? 'bridge');
  for (const key of onPath) {
    const [x, y] = key.split(',').map(Number);
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const ch = grid[y][x];
    if (ch === '~') grid[y][x] = 'B';
    else if (ch === 'T' || ch === 'R' || ch === 'H' || ch === ',') grid[y][x] = '.';
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
    desc: o.desc,
    concept: o.concept || '',
  };
}

export const MAPS = [
  // -------------------------------------------------------------------------
  // Chapter 1 — Sakura Gardens (sakura)
  // -------------------------------------------------------------------------
  defineMap({
    id: 'sakura_terrace', name: 'Academy Terrace', theme: 'sakura', tier: 'beginner',
    desc: 'One lazy curve that dips under the lily pond and climbs back up. The perfect first defense.',
    concept: 'Lazy smile: one broad S cradling the lily pond',
    rows: [
      'TTTT,..TTTTT..,.TTTT',
      'T.....,.......,....T',
      '..,......T.....,...T',
      '..........,.........',
      'T.,....,...~~~.....T',
      'T.......,.~~~~~..,.T',
      'T..,.......~~~.....T',
      'T......,...........T',
      'T..................T',
      'TT..,....,.....,..TT',
      'TTTTTT..TTTTTT,TTTTT',
    ],
    paths: [
      [[-1, 2.5], L, [1.5, 2.5], [4.6, 3.1], [6.9, 5.4], [9.2, 7.7], [12.4, 8.3], [15.4, 7.1], [17.2, 4.6], [18.6, 3.5], L, [21, 3.5]],
    ],
    decor: [
      { type: 'sakura', x: 0, y: 5 }, { type: 'bench', x: 5, y: 6 }, { type: 'stoneLantern', x: 14, y: 3 },
      { type: 'signpost', x: 1, y: 1 }, { type: 'sakura', x: 17, y: 0 },
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
  defineMap({
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
  }),

  // -------------------------------------------------------------------------
  // Chapter 2 — Moonlit Lakeshore (lake) — lots of water
  // -------------------------------------------------------------------------
  defineMap({
    id: 'lake_shore', name: 'Moonlit Shore', theme: 'lake', tier: 'beginner',
    desc: 'The path hugs the curving lakeshore bay by bay and rides out along a pier. Half the map is water for Sango and Nami.',
    concept: 'Shoreline crescent: hugs the bays, ends along the pier',
    rows: [
      'TTTT..,....TTT..,TTT',
      'T......,.......,...T',
      '...............R....',
      'T.,.................',
      '......,.............',
      '..,.........,.......',
      '~~~...........,.....',
      '~~~~~.......~~......',
      '~~~~~~~~...~~~~~~...',
      '~~~~..~~~~~~~..~~~~~',
      '~~~T..~~~~~~~..T~~~~',
      '~~~~~~~~~~~~~~~~~~~~',
    ],
    paths: [
      [[-1, 3.5], L, [1.0, 3.5], [3.4, 4.2], [5.4, 6.0], [7.6, 7.6], [10.0, 7.6], [11.8, 5.8], [13.6, 3.8], [15.8, 3.4], [17.4, 5.0], [17.6, 7.6], L, [17.6, 9.8], [18.6, 10.6], L, [21, 10.6]],
    ],
    decor: [
      { type: 'pier', x: 13, y: 10 }, { type: 'boat', x: 9, y: 10 }, { type: 'stoneLantern', x: 8, y: 2 },
      { type: 'willow', x: 2, y: 0 }, { type: 'boat', x: 1, y: 9 },
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
      [[9.5, -1], L, [9.5, 0.3], [8.0, 1.6], [5.4, 1.5], [3.2, 2.4], [2.4, 4.6], [3.4, 7.6], [5.6, 8.8], [7.6, 7.8], [8.6, 5.8], [10.2, 3.4], [12.6, 2.6], [15.0, 3.4], [16.4, 5.6], [17.0, 8.0], [18.0, 9.6], L, [21, 9.6]],
      { fork: { path: 0, at: [7.0, 8.3] }, nodes: [[9.8, 9.5], [12.6, 10.1], [15.6, 10.1]], join: { path: 0, at: [19.0, 9.6] } },
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
      '~~TT,.~~~~~~~~T.,~~~',
      '~~....~~~~~~~~....~~',
      '~.,..R.~~~~~~~.,..~~',
      '~.T....~~~~~~~....T~',
      '.......~~~~~~~~...~~',
      '~~..,..~~~~~~~~..~~~',
      '~~~...~~~..~~~~..~~~',
      '~~~~~~~~...,..~..~~~',
      '~~~~~~~T.....~~..~~~',
      '~~~~~~~TT..~~~~..~~~',
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
    desc: 'Two ferry roads swap river banks: each crosses the wide river on a ferry bridge, one high over the other. Enemies arrive on both lanes at once.',
    concept: 'Ferry X: two lanes swap banks, one bridge over the other mid-river',
    rows: [
      'TTT..,....TTT..,.TTT',
      '....................',
      'T.,......TTTT.....,T',
      '~~~~..~~~~~~~~..~~~~',
      '~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~',
      '~~~~..~~~~~~~~..~~~~',
      'T.,......TTTT.....,T',
      '....................',
      'TTT..,....TTT..,.TTT',
    ],
    paths: [
      [[-1, 1.5], L, [3.0, 1.5], [5.6, 2.2], [8.2, 4.4], [10.0, 6.0], [11.8, 7.6], [14.4, 9.6], [17.0, 10.4], L, [21, 10.4]],
      [[-1, 10.5], L, [3.0, 10.5], [5.6, 9.8], [8.2, 7.6], [10.0, 6.0], [11.8, 4.4], [14.4, 2.4], [17.0, 1.6], L, [21, 1.6]],
    ],
    decor: [
      { type: 'boat', x: 3, y: 6 }, { type: 'boat', x: 16, y: 5 }, { type: 'pier', x: 1, y: 4 },
      { type: 'pier', x: 18, y: 7 }, { type: 'willow', x: 0, y: 9 },
    ],
  }),
  defineMap({
    id: 'lake_moonpier', name: 'Moonlight Pier', theme: 'lake', tier: 'advanced',
    desc: 'The road rings the whole moon lake, then leaves straight across it along the old pier — bridging its own ring on the way out. Water girls rule both halves of the lake.',
    concept: 'Theta: a ring round the moon lake, out along the pier through the middle',
    rows: [
      'TTT~~TTTT,,TTTT~~TTT',
      'T..................T',
      'T..,.~~~~~~~~~~...,T',
      'T....~~~~,.~~~~~~..T',
      'T...~~~~...,~~~~~..T',
      'T....~~~~~~~~~~....T',
      '....................',
      'T....~~~~~~~~~~....T',
      'T...~~~~~,..~~~~~..T',
      'T..,..~~~~~~~~~...,T',
      'T,.................T',
      'TTTTTT~~TTTT~~TTTTTT',
    ],
    paths: [
      [[-1, 6.2], L, [0.4, 6.2], [1.8, 5.2], [2.6, 3.0], [4.6, 1.5], [8.6, 1.1], [13.0, 1.2], [16.4, 2.2], [17.8, 4.6], [17.8, 7.6], [16.4, 9.9], [13.0, 10.8], [8.6, 10.8], [4.6, 10.4], [2.6, 9.0], [2.8, 7.4], [4.4, 6.4], L, [6.0, 6.2], L, [15.0, 6.2], L, [21, 6.2]],
    ],
    decor: [
      { type: 'shrine', x: 10, y: 4 }, { type: 'boat', x: 14, y: 8 }, { type: 'lantern', x: 9, y: 3 },
      { type: 'willow', x: 0, y: 8 }, { type: 'pier', x: 6, y: 8 },
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
  defineMap({
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
  }),

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
      [[-1, 2.6], L, [1.4, 2.6], [4.2, 3.4], [6.0, 5.6], [6.4, 8.4], L, [6.6, 9.2], [8.0, 9.6], L, [14.2, 5.2], [16.0, 4.8], [17.6, 6.4], [18.2, 8.6], [19.6, 9.3], [20.6, 7.6], L, [20.6, 5.0], L, [20.6, -1]],
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
      'R...~~~~....HHH....R',
      'R..~~~~~~...HHH....R',
      'R...~~~~...HHHHH...R',
      'R...........HHH.....',
      'R...~~~~...HHHHH...R',
      'R..~~~~~~...HHH....R',
      'R...~~~~....HHH..,.R',
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
    desc: 'The road coils in tight S-bends around a rock spur, the old orc keep and its watchtower — melee girls inside the bends hit two lanes at once.',
    concept: 'Bastion serpent: tight vertical S-bends wrapping three strongpoints (Hedge idea)',
    rows: [
      'RRRRR,RRRRRR,RRRRR',
      'R......,.........R',
      'R.........,......R',
      'R...,...........RR',
      'R.RR.....H.......R',
      'R.RR....HHH.~~...R',
      '....,....H..~~~..R',
      'R........,...~~..R',
      'R..~~.........R..R',
      'R..~~.........RR..',
      'R..,......,......R',
      'RRRRRRRR,RRRRRRRRR',
    ],
    paths: [
      [[-1, 10.0], L, [-0.2, 10.0], [1.2, 8.8], [1.2, 6.6], [0.9, 4.4], [1.2, 2.2], [2.8, 1.2], [4.4, 2.2], [5.2, 4.6], [5.8, 7.6], [7.2, 9.4], [9.4, 9.6], [11.6, 9.2], [12.0, 7.4], [11.0, 6.0], [11.4, 3.4], [12.8, 1.6], [15.0, 1.6], [16.4, 3.4], [16.6, 5.8], [16.0, 7.4], [16.6, 9.0], [17.4, 9.6], L, [19, 9.6]],
    ],
    decor: [
      { type: 'banner', x: 8, y: 3 }, { type: 'flag', x: 9, y: 7 }, { type: 'campfire', x: 3, y: 10 },
      { type: 'pine', x: 7, y: 1 }, { type: 'statue', x: 14, y: 4 },
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
      '~~.....~~~~..,..~~~~',
      '~~~~~.....~~~...~~~~',
      '~~..~~.,.~~~~..~~~~~',
      'T~~~~~..~~~~~...~~~T',
      'T~~,.~..~~~~~.,.~~~T',
      '~~~...~.~~~~..~~~~~~',
      '~~~..........~~~~~~~',
      '~~~~~~..~~~~~~......',
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
      [[10.5, -1], L, [10.5, 0.6], [12.6, 1.8], [13.2, 3.8], [11.6, 5.4], [9.6, 7.6], [7.6, 8.8], [7.0, 10.4], [7.6, 11.8], L, [7.6, 13]],
    ],
    decor: [
      { type: 'lantern', x: 4, y: 7 }, { type: 'lantern', x: 16, y: 1 }, { type: 'willow', x: 15, y: 10 },
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
    desc: 'The road rings the sunken pool in a great horseshoe, ducking through a hollow fallen log on the way. Water girls in the middle cover every side.',
    concept: 'Horseshoe ring round the pool, through a hollow-log tunnel',
    rows: [
      'TTT~~TTT,TTTT~~TTTTT',
      'T~~...............~T',
      'T~~,..............~T',
      'T~..,..~~~~~~~..,.~T',
      '~~....~~~TT~~~~..~~~',
      '.....~~~~,.~~~~~.~~~',
      'T~~..~~~~~~~~~~..~~T',
      'T~~,..~~~~~~~~...~~T',
      'TT.....~~~~~~....~~T',
      'T~~....,......,...~T',
      'T~~.....,..........T',
      'TTTT~~TT.TTTT~~TTTTT',
    ],
    paths: [
      [[-1, 4.4], L, [0.8, 4.4], [2.8, 3.6], [4.2, 1.8], [7.0, 1.4], [10.4, 1.4], [13.6, 1.6], [15.6, 2.6], IN, [16.4, 4.4], [16.4, 6.6], OUT, [15.8, 8.6], [13.8, 9.8], [10.4, 10.0], [7.0, 9.8], [4.6, 9.2], [3.4, 7.8], [1.8, 7.2], L, [-1, 7.2]],
    ],
    decor: [
      { type: 'willow', x: 9, y: 4 }, { type: 'lantern', x: 10, y: 5 }, { type: 'bones', x: 5, y: 7 },
      { type: 'willow', x: 18, y: 4 }, { type: 'boat', x: 12, y: 7 },
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
      [[-1, 7.4], L, [-0.2, 7.4], ...spiral(10, 6.0, 9.2, 1.5, 195, 585, 30, 0.6), ...spiral(10, 6.0, 1.5, 9.2, 765, 360, 30, 0.6), L, [21, 6.0]],
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
    desc: 'Three long straights along the conveyor belts, joined by banked U-turns — the middle turn runs right through the furnace. Perfect for beams and lines of fire.',
    concept: 'Conveyor serpentine: three belt straights, banked turns, one turn inside the furnace',
    rows: [
      'HHH..RRHHH...HHH..RHHH',
      'H......,.......,.....H',
      '.....................H',
      'H..~~~~~~~~~~~~~~~...H',
      'H.,..R.......R...,...H',
      'H...................,H',
      'H....................H',
      'H...~~~~~~~~~~~~~~~~.H',
      'H..,...R.......R..,..H',
      'H.....,........,.....H',
      'H.....................',
      'HHH..RRHHHHH..HHHRRHHH',
    ],
    paths: [
      [[-1, 1.8], L, [17.6, 1.8], [20.0, 2.6], [20.6, 4.0], [20.0, 5.4], [17.6, 5.8], L, [3.6, 5.8], [1.6, 6.6], IN, [1.0, 8.0], [1.6, 9.4], OUT, [3.6, 10.2], L, [23, 10.2]],
    ],
    decor: [
      { type: 'chimney', x: 8, y: 0 }, { type: 'gearTower', x: 14, y: 11 }, { type: 'crane', x: 0, y: 4 },
      { type: 'vent', x: 10, y: 8 }, { type: 'chimney', x: 20, y: 11 },
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
      'H...,.~...,...~~..RH',
      'H.....~~.....~~~...H',
      'H...,.~~..,..~~~...H',
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
      [[6.5, -1], L, [6.5, 0.6], [7.4, 2.4], [9.6, 3.6], [11.4, 5.4], [11.6, 7.6], [13.0, 9.4], [15.6, 9.8], [17.8, 9.2], [19.2, 8.0], L, [21, 8.0]],
      { nodes: [[-1, 10.2], L, [1.0, 10.2], [3.6, 10.4], [6.4, 10.4], [9.4, 10.2]], join: { path: 0, at: [12.8, 9.2] } },
    ],
    decor: [
      { type: 'stall', x: 3, y: 1 }, { type: 'stall', x: 16, y: 3 }, { type: 'taiko', x: 14, y: 6 },
      { type: 'boat', x: 2, y: 5 }, { type: 'lantern', x: 5, y: 8 },
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
      [[-1, 4.4], L, [0.8, 4.4], ...curve((t) => [10 + 2.95 * (Math.sin(t) + 2 * Math.sin(2 * t)), 6.4 + 1.8 * (Math.cos(t) - 2 * Math.cos(2 * t))], 5.7, 5.7 + 5.62, 30), [2.4, 10.8], L, [2.4, 13]],
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
    desc: 'The parade swings out into four great petal loops around the taiko stage, crossing the little square in front of it four times. Every girl has a choke point — and so does every oni.',
    concept: 'Four-leaf pinwheel: four petal loops round a central square (four flat junctions)',
    crossings: 'flat',
    rows: [
      'HHHH,HHH,HHH,HHHHH',
      '...H.H.....H.H...H',
      'H..,..,.~~,...,..H',
      'H.,..........~~..H',
      'H................H',
      'H..,...HHHH...,..H',
      'H~~....~~~~....~~H',
      'H................H',
      'H.,....H....,....H',
      'H..~~~..~~.......H',
      'H........~~~......',
      'HHHHH,HHHHHHHHHHHH',
    ],
    paths: [
      [[-1, 10.2], L, [0.4, 10.2], ...curve((t) => [9 + 1.22 * (3.6 * Math.cos(t) + 2.9 * Math.cos(-3 * t + Math.PI)), 6 + 0.8 * (3.6 * Math.sin(t) + 2.9 * Math.sin(-3 * t + Math.PI))], 2.5, 2.5 + 5.84, 48), [1.4, 7.9], L, [-1, 7.9]],
    ],
    decor: [
      { type: 'taiko', x: 8, y: 0 }, { type: 'stall', x: 8, y: 1 }, { type: 'stall', x: 8, y: 10 },
      { type: 'lantern', x: 1, y: 5 }, { type: 'banner', x: 16, y: 5 },
    ],
  }),
  defineMap({
    id: 'festival_arena', name: 'Champion\'s Stage', theme: 'festival', tier: 'expert',
    desc: 'The tournament stage of the Oni Festival. Parades from the west gate and the south gate join beside the stage and circle it under the champion\'s nose before leaving.',
    concept: 'Two gates, one stage: parades from the west and the south merge and circle the stage',
    rows: [
      'HHH,HHHHHHHHHHHH,HHH',
      'H....,....H.....,..H',
      'H.,...~~......~~...H',
      '.......,.......,....',
      'H..~~.,.HHHH.,..~~.H',
      'H..~~...HHHH.....~~H',
      'H.,.....HHHH...,...H',
      'H..,..........,....H',
      'H.................,H',
      'H.,..~~~.....~~~...H',
      '........,....,.....H',
      'HHHHHHHH,HHHHHHHHHHH',
    ],
    paths: [
      [[-1, 7.6], L, [1.0, 7.6], [3.6, 7.4], [5.6, 6.0], [6.0, 3.4], [7.8, 1.8], [10.4, 1.4], [13.2, 1.8], [15.0, 3.6], [15.2, 6.4], [16.4, 8.4], [18.6, 9.0], L, [21, 9.0]],
      { nodes: [[5.5, 13], L, [5.5, 11.6], [4.4, 10.0], [4.6, 8.6]], join: { path: 0, at: [5.6, 6.0] } },
    ],
    decor: [
      { type: 'taiko', x: 12, y: 8 }, { type: 'banner', x: 2, y: 5 }, { type: 'banner', x: 17, y: 6 },
      { type: 'lantern', x: 3, y: 1 }, { type: 'stall', x: 17, y: 2 },
    ],
  }),

  // -------------------------------------------------------------------------
  // Chapter 8 — Ashwing Peaks (snow / volcano)
  // -------------------------------------------------------------------------
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
    desc: 'The road climbs the left bank, runs behind the frozen falls in an ice cave at the top of the glacier and comes down the far bank — an omega around the glacier river.',
    concept: 'Omega: up one bank, behind the frozen falls in an ice tunnel, down the other',
    rows: [
      'RRRRTTRR~~~RRRTTRRRR',
      '........~~~.......TR',
      'R.T..,..~~~..,..T..R',
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
      [[-1, 10.0], L, [1.0, 10.0], [4.4, 9.8], [6.4, 8.4], [5.6, 6.6], [3.8, 4.8], [3.8, 2.6], [5.8, 1.2], [7.4, 0.9], [8.6, 0.8], IN, L, [11.2, 0.8], OUT, [12.6, 0.9], [14.4, 1.4], [16.2, 2.8], [16.2, 4.8], [14.4, 6.6], [13.6, 8.4], [15.0, 9.8], [17.0, 9.5], [18.4, 8.4], [19.2, 6.9], [20.2, 6.2], L, [21.5, 6.2]],
    ],
    decor: [
      { type: 'pine', x: 2, y: 4 }, { type: 'pine', x: 17, y: 5 }, { type: 'nest', x: 18, y: 11 },
      { type: 'flag', x: 1, y: 7 }, { type: 'crystal', x: 12, y: 3 },
    ],
  }),
  defineMap({
    id: 'peaks_caldera', name: 'Caldera Rim', theme: 'volcano', tier: 'expert',
    desc: 'The road drops in from the north, circles the whole rim of the lava lake and climbs out over its own entrance on an obsidian bridge. Hot springs steam in the corners.',
    concept: 'Caldera six: a stem from the north, one lap of the rim, out over its own entrance',
    rows: [
      'RRR.RRRR,RRRRR,RRRRR',
      'R~~.......,......~~R',
      '...................R',
      'R~.........,.....~~R',
      'R.....XXXXXXXX.....R',
      'R..,.XXXXXXXXXX....R',
      'R....XXXXXXXXXX..,.R',
      'R.....XXXXXXXX.....R',
      'R~..........,.....~R',
      'R~~..............~~R',
      'R~~~...,.....,...~~R',
      'RRRRRRRRRRRRRRRRRRRR',
    ],
    paths: [
      [[12.5, -1], L, [12.5, 0.6], [11.6, 2.2], [9.0, 2.8], [5.6, 2.8], [3.2, 4.0], [2.8, 6.8], [4.4, 9.0], [8.0, 9.8], [12.0, 9.8], [15.6, 9.0], [17.2, 6.6], [16.8, 4.0], [14.8, 2.2], [12.4, 1.2], [10.2, 0.8], [8.8, 0.2], L, [8.0, -1]],
    ],
    decor: [
      { type: 'vent', x: 5, y: 4 }, { type: 'vent', x: 14, y: 7 }, { type: 'bones', x: 10, y: 8 },
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
  // Bounty (resource) arenas
  // -------------------------------------------------------------------------
  defineMap({
    id: 'arena_library', name: 'Library Courtyard', theme: 'sakura', tier: 'intermediate',
    desc: 'Bounty arena behind the academy library. The path dips twice through the courtyard like a W, around the fountain and the reading lawn. Lost study books wash up in the fountain.',
    concept: 'Courtyard W: two soft dips either side of the fountain',
    rows: [
      'HHHHHH,HHHHHH,HHHH',
      'H.....,.....,....H',
      'H..T.......T.....H',
      '..................',
      'H.,.....~~....,..H',
      'H......~~~~......H',
      'H..T....~~.....T.H',
      'H...,.........,..H',
      'H.....,......,...H',
      'H..T....,.....T..H',
      'HHHHHHHHHHHHHHHHHH',
    ],
    paths: [
      [[-1, 2.6], L, [0.8, 2.6], [2.8, 3.4], [3.6, 5.8], [4.8, 7.8], [6.6, 7.9], [7.6, 6.0], [7.9, 3.6], [9.2, 2.3], [10.5, 3.6], [10.8, 6.0], [11.8, 7.9], [13.6, 7.8], [14.6, 5.8], [15.4, 3.4], [17.2, 2.6], L, [19, 2.6]],
    ],
    decor: [
      { type: 'bookshelf', x: 2, y: 1 }, { type: 'fountain', x: 9, y: 5 }, { type: 'sakura', x: 16, y: 6 },
      { type: 'bench', x: 1, y: 7 }, { type: 'bookshelf', x: 15, y: 1 },
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
      [[-1, 5.5], L, [1.4, 5.5], [4.4, 5.2], [7.0, 3.6], [9.6, 2.4], [13.6, 2.2], [16.6, 2.8], [18.6, 2.2], L, [21, 2.2]],
      { fork: { path: 0, at: [4.6, 5.2] }, nodes: [[7.2, 7.2], [9.8, 8.4], [13.8, 8.6], [16.8, 8.2], [18.8, 8.6], L, [21, 8.6]] },
    ],
    decor: [
      { type: 'stall', x: 2, y: 3 }, { type: 'boat', x: 12, y: 5 }, { type: 'stall', x: 17, y: 5 },
      { type: 'lantern', x: 7, y: 5 }, { type: 'boat', x: 11, y: 6 },
    ],
  }),
  defineMap({
    id: 'arena_workshop', name: 'Workshop Yard', theme: 'foundry', tier: 'advanced',
    desc: 'Bounty arena in the gear workshop: the belt road runs round the great cog in the middle of the yard, tooth by tooth, over the coolant channels.',
    concept: 'Cog: a horseshoe round the giant gear, its rim stepping in and out like teeth',
    rows: [
      'HHHRRHHHH,HHHHRRHHHH',
      '..................,H',
      'H.,..R.....,....R..H',
      'H...~~~~~~~~~~~....H',
      'H.,.....R......,...H',
      'H..................H',
      'H..R....,.....R....H',
      'H....~~~~~~~~~~~...H',
      'H.,....R......,....H',
      'H...................',
      'HHHHRRHHHH,HHHHHRRHH',
    ],
    paths: [
      [[-1, 2.4], L, [0.2, 2.4], ...curve((t) => { const k = Math.min(1, (t - 3.7) / 0.6, (8.25 - t) / 0.6); const r = 1 + 0.14 * k * Math.cos(6 * t); return [10 + 8.3 * r * Math.cos(t), 5.5 + 4.25 * r * Math.sin(t)]; }, 3.7, 8.25, 66), [1.0, 9.6], L, [-1, 9.6]],
    ],
    decor: [
      { type: 'gearTower', x: 9, y: 5 }, { type: 'crane', x: 13, y: 5 }, { type: 'chimney', x: 0, y: 4 },
      { type: 'vent', x: 6, y: 5 }, { type: 'gearTower', x: 16, y: 5 },
    ],
  }),
  defineMap({
    id: 'arena_meadow', name: 'Wildflower Meadow', theme: 'mountain', tier: 'intermediate',
    desc: 'Bounty arena in a high meadow where feathers, blades, embers and rime crystals gather. The path starts as a ripple and swells into great lazy swings.',
    concept: 'Swelling wave: little ripples at the gate growing into huge lazy swings',
    rows: [
      'TTTTTT,,TTTTT,,,TTTT',
      'T.,.......,.,....,.T',
      'T..,,.~~~.,...,..,.T',
      'T.,...~~~~..,..,...T',
      'T..,..~~~...,.......',
      '.....,.~~..,..~~...T',
      'T.,...,..,...~~~..,T',
      'T..,....,...~~~..,.T',
      'TT.,..,...,..~~.,..T',
      'T..,.....,.........T',
      'TTTTT,,TTTTTTT,,TTTT',
    ],
    paths: [
      [[-1, 5.4], L, [0.2, 5.4], [1.6, 4.7], [4.6, 7.0], [8.6, 2.8], [13.4, 8.9], [17.4, 4.6], [19.0, 3.6], L, [21, 3.6]],
    ],
    decor: [
      { type: 'pine', x: 1, y: 3 }, { type: 'flag', x: 9, y: 7 }, { type: 'campfire', x: 4, y: 8 },
      { type: 'statue', x: 15, y: 3 }, { type: 'pine', x: 17, y: 8 },
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
      [[8.1, -1], L, [8.1, 0.2], IN, L, [8.1, 4.5], OUT, ...spiral(10, 6.0, 1.9, 8.6, 180, -300, 30, 0.6), [16.8, 9.8], [19.4, 9.6], L, [21, 9.6]],
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
    desc: 'The Matriarch\'s summit: the trail zig-zags down the peak like a lightning bolt between lava vents and hot springs — nowhere to hide from the sky.',
    concept: 'Lightning bolt: two long slanted legs joined by sharp switchback turns',
    rows: [
      'RRRRRRRRRRRRRRRRRRRR',
      'R~~......R.......~~R',
      'R..,...........,....',
      'R..........~~......R',
      'R.....,....~~~~,...R',
      'R...........~~~..XXR',
      'R.....,....~~~...XXR',
      'R..,.........,....XR',
      'R.~~..........R....R',
      '...................R',
      'R~~~...,.....,..~~~R',
      'RRRRRRRRRRRRRRRRRRRR',
    ],
    paths: [
      [[-1, 2.2], L, [1.0, 2.2], [5.6, 2.8], [10.4, 3.6], [14.4, 4.0], [15.8, 5.0], [15.2, 6.4], [12.6, 6.6], [8.6, 6.4], [5.6, 6.6], [4.2, 7.6], [5.0, 9.0], [8.6, 9.6], [13.6, 9.6], [17.4, 9.2], [18.6, 8.6], L, [21, 8.6]],
    ],
    decor: [
      { type: 'nest', x: 17, y: 2 }, { type: 'vent', x: 8, y: 7 }, { type: 'bones', x: 2, y: 9 },
      { type: 'crystal', x: 11, y: 8 }, { type: 'vent', x: 1, y: 4 },
    ],
  }),

  // -------------------------------------------------------------------------
  // Tactical Challenge (endless)
  // -------------------------------------------------------------------------
  defineMap({
    id: 'arena_colosseum', name: 'Sakura Colosseum', theme: 'arena', tier: 'intermediate',
    desc: 'The academy\'s practice colosseum: four ring arenas, and the challenge road loops the loop around each one in turn — built for endless runs.',
    concept: 'Four rings: a loop-the-loop round each of four ring arenas in turn',
    crossings: 'bridge',
    rows: [
      'HHHHHHHH,,,HHHHHHHHH',
      '...................H',
      'H.,.....,..,.....,.H',
      'H..T....~~~~....T..H',
      'H..................H',
      'H.,..~~~...~~~..,..H',
      'H....~~~,,,~~~.....H',
      'H..................H',
      'H.,..T.....,..T..,.H',
      'H.......~~~~.......H',
      'H..................H',
      'HHHH.HHHHHHHHHHHHHHH',
    ],
    paths: [
      [[-1, 4.6], L, [0.0, 4.6], ...loopNodes(3.9, 3.4, 2.0, 0), ...loopNodes(12.0, 3.4, 2.0, 0), [15.2, 5.4], ...loopNodes(16.2, 8.2, 1.7, 90, true), [16.4, 10.6], [13.2, 10.4], ...loopNodes(7.6, 8.4, 1.9, 180, true), [1.0, 10.8], L, [-1, 10.8]],
    ],
    decor: [
      { type: 'flag', x: 8, y: 0 }, { type: 'sakura', x: 3, y: 3 }, { type: 'sakura', x: 19, y: 3 },
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
      const d = Math.hypot(ax + dx * u - x, ay + dy * u - y);
      if (d < best) best = d;
    }
  }
  return best;
}

/**
 * Buildable tile counts for UI badges / recommendations: tiles whose CENTRE is a legal spot
 * for an ordinary girl as far as the road band goes (free placement), by terrain.
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
      const isLand = ch === '.' || ch === ',';
      const isWater = ch === '~' || ch === 'B';
      if (!isLand && !isWater) continue;
      if (centrelineDistance(tracks, x + 0.5, y + 0.5) < clear) continue;
      if (isLand) land++;
      else water++;
    }
  });
  return { land, water };
}

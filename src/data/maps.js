// Sakura Sentinels — battle maps (owner: world). See CONTRACTS.md §4.
//
// Legend for `rows`:
//   '.' grass/stone (buildable)   ',' flowers / decor (buildable)   '~' water (water units only)
//   'T' tree   'R' rock   'H' building / shrine / machinery   'X' void, lava or furnace (blocked)
//   'B' bridge: a path tile over water (stamped automatically from the paths below)
//
// Paths are lists of tile waypoints. Consecutive points share x or y (orthogonal segments).
// The first point sits on or just outside the map edge (spawn), the last is the exit. Paths
// may cross or merge (crossing tiles stay path). Path tiles are never buildable.
//
// `defineMap` stamps the paths into the terrain so the data stays honest: water under a path
// becomes 'B' (a bridge or boardwalk) and trees/rocks/buildings/flowers under a path are
// cleared to '.'. Void ('X') is never cleared — tests fail if a path runs through it.
//
// `decor` lists a handful of composed set pieces per map for the renderer (V2 directive:
// "five beautifully composed features beat fifty random props"). A set piece on land turns its
// tile into 'H' (blocked) so the renderer draws the set piece there instead of a generic
// building; set pieces on water (boats, piers) float and stay purely visual. Types: torii, lantern,
// stoneLantern, sakura, willow, pine, boat, pier, waterwheel, shrine, bell, banner, tent,
// stall, taiko, crane, chimney, gearTower, crystal, nest, bones, statue, signpost, well,
// bench, fountain, bookshelf, vent, campfire, flag, bridgeLantern, candle.

/**
 * Stamps paths into terrain rows and returns a MapDef.
 * @param {object} o map fields; `rows` are the unstamped terrain rows
 * @returns {object} MapDef
 */
function defineMap(o) {
  const grid = o.rows.map((r) => r.split(''));
  const height = grid.length;
  const width = grid[0].length;
  const onPath = stampPaths(o.paths);
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
    paths: o.paths,
    decor: o.decor || [],
    desc: o.desc,
  };
}

/** Every tile covered by orthogonal path segments, as "x,y" strings (spawn/exit tiles included). */
function stampPaths(paths) {
  const set = new Set();
  for (const wps of paths || []) {
    for (let i = 0; i < wps.length; i++) {
      const [x, y] = wps[i];
      if (i === 0) {
        set.add(`${x},${y}`);
        continue;
      }
      const [px, py] = wps[i - 1];
      const dx = Math.sign(x - px);
      const dy = Math.sign(y - py);
      const steps = Math.max(Math.abs(x - px), Math.abs(y - py));
      for (let s = 1; s <= steps; s++) set.add(`${px + dx * s},${py + dy * s}`);
    }
  }
  return set;
}

export const MAPS = [
  // -------------------------------------------------------------------------
  // Chapter 1 — Sakura Gardens (sakura)
  // -------------------------------------------------------------------------
  defineMap({
    id: 'sakura_terrace', name: 'Academy Terrace', theme: 'sakura', tier: 'beginner',
    desc: 'One long terrace walk and a single turn past the lily pond. The perfect first defense.',
    rows: [
      'TTTT,..TTTTT..,.TTTT',
      'T.....,.......,....T',
      '..,......T.....,...T',
      '..........,........T',
      'T.,....,...~~~.....T',
      'T.......,.~~~~~..,.T',
      'T..,.......~~~.....T',
      'T......,...........T',
      'T...................',
      'TT..,....,.....,..TT',
      'TTTTTT..TTTTTT,TTTTT',
    ],
    paths: [[[-1, 3], [8, 3], [8, 8], [20, 8]]],
    decor: [
      { type: 'sakura', x: 0, y: 5 }, { type: 'bench', x: 5, y: 5 }, { type: 'stoneLantern', x: 12, y: 3 },
      { type: 'signpost', x: 1, y: 2 }, { type: 'sakura', x: 17, y: 0 },
    ],
  }),
  defineMap({
    id: 'sakura_lane', name: 'Petal Lane', theme: 'sakura', tier: 'beginner',
    desc: 'A gentle switchback through the academy gardens with a koi pond in the middle.',
    rows: [
      'TTT..,...TTT.,.TTT',
      'TT.......,......TT',
      '.................T',
      '.,...,.....,.....T',
      '......~~~.....,...',
      'R....~~~~~......R.',
      '.....,~~~.........',
      'T.,..........,...T',
      '..................',
      'TT..,....TT...,.TT',
      'TTTT.TTTTTTT.TTTTT',
    ],
    paths: [[[-1, 2], [4, 2], [4, 8], [10, 8], [10, 2], [14, 2], [14, 8], [18, 8]]],
    decor: [
      { type: 'sakura', x: 1, y: 9 }, { type: 'sakura', x: 16, y: 0 }, { type: 'stoneLantern', x: 9, y: 5 },
      { type: 'bench', x: 7, y: 3 }, { type: 'signpost', x: 0, y: 3 },
    ],
  }),
  defineMap({
    id: 'sakura_loop', name: 'Blossom Loop', theme: 'sakura', tier: 'beginner',
    desc: 'The path circles the oldest cherry grove and crosses itself — towers in the middle see it twice.',
    rows: [
      'TTTT..,.TTTT..,TTT',
      'T.....,......,...T',
      '...,..............',
      'T......TTTTT....,.',
      '..,....T~~~T......',
      '..................',
      'T.,......,.....,.T',
      '..~~~.........R...',
      '.~~~~.............',
      'T.~~.....,....TTTT',
      'TTTT,.TTTT...TTTTT',
    ],
    paths: [[[-1, 5], [12, 5], [12, 2], [6, 2], [6, 8], [18, 8]]],
    decor: [
      { type: 'sakura', x: 9, y: 3 }, { type: 'well', x: 9, y: 4 }, { type: 'bench', x: 14, y: 6 },
      { type: 'stoneLantern', x: 5, y: 7 }, { type: 'sakura', x: 1, y: 0 },
    ],
  }),
  defineMap({
    id: 'sakura_creek', name: 'Sakura Creek', theme: 'sakura', tier: 'beginner',
    desc: 'A long zigzag that crosses a petal-strewn creek four times — the first place water girls can stand.',
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
    paths: [[[-1, 1], [16, 1], [16, 4], [3, 4], [3, 7], [16, 7], [16, 10], [20, 10]]],
    decor: [
      { type: 'waterwheel', x: 11, y: 6 }, { type: 'sakura', x: 0, y: 6 }, { type: 'sakura', x: 18, y: 0 },
      { type: 'stoneLantern', x: 7, y: 5 }, { type: 'bench', x: 13, y: 2 },
    ],
  }),
  defineMap({
    id: 'sakura_court', name: 'Blossom Court', theme: 'sakura', tier: 'intermediate',
    desc: 'The academy\'s grand courtyard. The road spirals around the fountain and crosses its own tail.',
    rows: [
      'TTTTT,,TTTTTT,,TTTTT',
      'T.....,......,.....T',
      'T..................T',
      'T.,...,....,....,..T',
      'T........,.........T',
      'T..................T',
      '...,...~~~~~.....,.T',
      'T......~~~~~.......T',
      'T..,...~~~~~...,...T',
      'T..................T',
      'T.,....,.....,...,.T',
      'TTTTTTTTT,,,.TTTTTTT',
    ],
    paths: [[[-1, 6], [3, 6], [3, 2], [16, 2], [16, 9], [6, 9], [6, 5], [13, 5], [13, 12]]],
    decor: [
      { type: 'fountain', x: 9, y: 7 }, { type: 'sakura', x: 0, y: 3 }, { type: 'sakura', x: 19, y: 8 },
      { type: 'stoneLantern', x: 10, y: 4 }, { type: 'bench', x: 9, y: 10 },
    ],
  }),

  // -------------------------------------------------------------------------
  // Chapter 2 — Moonlit Lakeshore (lake) — lots of water
  // -------------------------------------------------------------------------
  defineMap({
    id: 'lake_shore', name: 'Moonlit Shore', theme: 'lake', tier: 'beginner',
    desc: 'The path hugs the lakeshore and runs out along a pier. Half the map is water for Sango and Nami.',
    rows: [
      'TTTT..,....TTT..,TTT',
      'T......,.......,...T',
      '...............R....',
      'T.,....~~~..........',
      '......~~~~~......,..',
      '..,...~~~~~...R.....',
      'T...................',
      '~~~.........~~~~....',
      '~~~~~~~~...~~~~~~~~~',
      '~~~~..~~~~~~~..~~~~~',
      '~~~T..~~~~~~~..T~~~~',
      '~~~~~~~~~~~~~~~~~~~~',
    ],
    paths: [[[-1, 2], [5, 2], [5, 6], [11, 6], [11, 3], [16, 3], [16, 8], [20, 8]]],
    decor: [
      { type: 'pier', x: 18, y: 9 }, { type: 'boat', x: 9, y: 10 }, { type: 'stoneLantern', x: 8, y: 2 },
      { type: 'willow', x: 2, y: 0 }, { type: 'boat', x: 1, y: 9 },
    ],
  }),
  defineMap({
    id: 'lake_reeds', name: 'Reed Maze', theme: 'lake', tier: 'intermediate',
    desc: 'A boardwalk zigzags through the reed beds. Every gap between the lanes is water.',
    rows: [
      '~~TT~~~TT~~~~TT~~~~~',
      '~.,..~~..,.~~..,.~~~',
      '......~~~.......~~~~',
      '~~..,.~~~~.,..,.~~~~',
      '~~~...~~~~..~~~..~~~',
      '~~~~.~~~~~.,~~~~.~~~',
      '~~~..~~~~,..~~~..~~~',
      '~~,..~~~~...~~~~.,~~',
      '~~...~~~~~.~~~~...~~',
      '~~....~~..~~~.......',
      '~~..,..~~~~~~.,..~~~',
      '~~~~TT~~~~~~TT~~~~~~',
    ],
    paths: [[[-1, 2], [5, 2], [5, 9], [10, 9], [10, 2], [15, 2], [15, 9], [20, 9]]],
    decor: [
      { type: 'boat', x: 7, y: 5 }, { type: 'lantern', x: 3, y: 4 }, { type: 'willow', x: 13, y: 0 },
      { type: 'pier', x: 17, y: 4 }, { type: 'lantern', x: 12, y: 6 },
    ],
  }),
  defineMap({
    id: 'lake_isles', name: 'Lantern Isles', theme: 'lake', tier: 'intermediate',
    desc: 'Lantern-lit islands joined by long wooden bridges. Land is scarce; the lake is yours.',
    rows: [
      '~~~~~~~~~~~~~~~~~~~~',
      '~~TT,.~~~~~~~T..~~~~',
      '~~....~~...~~~...~~~',
      '~~.,..~~..~~~~,.~~~~',
      '~...R.~~..~~~~..~~~~',
      '...T..~~..~~~~.~~~~~',
      '~~....~~..~~~~.....~',
      '~~~,..~~..~~~~..T~~~',
      '~~~~~~~~..~~~~.~~~~~',
      '~~~~~~~T...~~..~~~~~',
      '~~~~~~~TT.~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~',
    ],
    paths: [[[-1, 5], [3, 5], [3, 2], [8, 2], [8, 9], [13, 9], [13, 2], [17, 2], [17, 6], [20, 6]]],
    decor: [
      { type: 'lantern', x: 9, y: 3 }, { type: 'lantern', x: 14, y: 7 }, { type: 'shrine', x: 2, y: 4 },
      { type: 'boat', x: 4, y: 9 }, { type: 'boat', x: 16, y: 10 },
    ],
  }),
  defineMap({
    id: 'lake_ferry', name: 'Twin Ferry', theme: 'lake', tier: 'intermediate',
    desc: 'Two ferry roads on either bank of a wide river. Enemies arrive on both lanes at once.',
    rows: [
      'TTT..,....TTT..,.TTT',
      '....................',
      'T.,......TTTT.....,T',
      '......,.............',
      '~~~...~~~~..~~~~..~~',
      '~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~',
      '~~..~~~~..~~~~~...~~',
      '......,.............',
      'T.,......TTTT.....,T',
      '....................',
      'TTT..,....TTT..,.TTT',
    ],
    paths: [
      [[-1, 1], [8, 1], [8, 3], [14, 3], [14, 1], [20, 1]],
      [[-1, 10], [8, 10], [8, 8], [14, 8], [14, 10], [20, 10]],
    ],
    decor: [
      { type: 'boat', x: 4, y: 5 }, { type: 'boat', x: 15, y: 6 }, { type: 'pier', x: 10, y: 4 },
      { type: 'pier', x: 10, y: 7 }, { type: 'willow', x: 0, y: 3 },
    ],
  }),
  defineMap({
    id: 'lake_moonpier', name: 'Moonlight Pier', theme: 'lake', tier: 'advanced',
    desc: 'The road rings the moon lake and leaves along the old pier. Water girls rule the middle.',
    rows: [
      'TTT~~TTTT,,TTTT~~TTT',
      '..................~T',
      'T~~..,......,...~.~T',
      'T~...~~~....,..~~.~T',
      'T~...........~~~..~T',
      'T~.~~~~~~~~.~~~~~.~T',
      'T~.~~~..~~~.~~~~~.~T',
      'T~.~~~.,.~~.~~,~~.~T',
      'T..~~~~..~~.~~~~~.~T',
      'T~.~~~~~~~~.~~~~~..T',
      'T~................~T',
      'TTT~~TTTTTTT.TTTTTTT',
    ],
    paths: [[[-1, 1], [17, 1], [17, 10], [2, 10], [2, 4], [12, 4], [12, 12]]],
    decor: [
      { type: 'shrine', x: 7, y: 6 }, { type: 'boat', x: 14, y: 7 }, { type: 'lantern', x: 11, y: 3 },
      { type: 'willow', x: 0, y: 8 }, { type: 'pier', x: 4, y: 7 },
    ],
  }),

  // -------------------------------------------------------------------------
  // Chapter 3 — Moonveil Shrine (shrine)
  // -------------------------------------------------------------------------
  defineMap({
    id: 'shrine_gate', name: 'Torii Corridor', theme: 'shrine', tier: 'intermediate',
    desc: 'Two long straights beneath a hundred torii gates. Veils hang thick between the pillars.',
    rows: [
      'TTTTTTT,TTTTTTTTTTTT',
      'T.H...H...H...H....T',
      '..................,T',
      'T.H...H...H...H....T',
      'T..,....~~~~....,..T',
      'T...,..~~~~~~..,...T',
      'T..,....~~~~....,..T',
      'T.H...H...H...H....T',
      '..................,T',
      'T.H...H...H...H....T',
      'TTTTTTTTTTTT,TTTTTTT',
    ],
    paths: [[[-1, 2], [17, 2], [17, 8], [-1, 8]]],
    decor: [
      { type: 'shrine', x: 18, y: 5 }, { type: 'stoneLantern', x: 4, y: 5 }, { type: 'stoneLantern', x: 15, y: 5 },
      { type: 'bell', x: 1, y: 5 }, { type: 'sakura', x: 12, y: 10 },
    ],
  }),
  defineMap({
    id: 'shrine_steps', name: 'Thousand Steps', theme: 'shrine', tier: 'intermediate',
    desc: 'Stone stairs zigzag down the shrine hill past a misty koi pond.',
    rows: [
      'TTTTTT.HH.TTTT,TTT',
      '.....,.....,...TTT',
      'TT..,...H.....,.TT',
      'T................T',
      'T.~~....,......,.T',
      '.~~~~.............',
      '.~~~~~......,....R',
      '.~~~~~~.........R.',
      '..~~~~~...H......T',
      'T..~~~.......,...T',
      'TT.....,...TT...TT',
      'TTTT,..TTTTTTT..TT',
    ],
    paths: [[[-1, 1], [4, 1], [4, 3], [8, 3], [8, 5], [12, 5], [12, 7], [16, 7], [16, 12]]],
    decor: [
      { type: 'torii', x: 6, y: 0 }, { type: 'stoneLantern', x: 7, y: 6 }, { type: 'stoneLantern', x: 13, y: 9 },
      { type: 'bell', x: 10, y: 8 }, { type: 'sakura', x: 0, y: 9 },
    ],
  }),
  defineMap({
    id: 'shrine_spiral', name: 'Moonveil Spiral', theme: 'shrine', tier: 'intermediate',
    desc: 'The pilgrim road spirals into the inner sanctum and bursts straight back out, crossing every ring.',
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
    paths: [[[-1, 1], [18, 1], [18, 10], [2, 10], [2, 3], [15, 3], [15, 8], [5, 8], [5, 5], [11, 5], [11, -1]]],
    decor: [
      { type: 'shrine', x: 9, y: 6 }, { type: 'torii', x: 10, y: 0 }, { type: 'stoneLantern', x: 8, y: 2 },
      { type: 'stoneLantern', x: 12, y: 2 }, { type: 'bell', x: 16, y: 9 },
    ],
  }),
  defineMap({
    id: 'shrine_garden', name: 'Koi Garden', theme: 'shrine', tier: 'advanced',
    desc: 'A figure-eight garden walk around two koi ponds. The central crossing is the key tile.',
    rows: [
      'TTT,,TTTTT..TTT,TTTT',
      'T.......H...H......T',
      '...........,......TT',
      'T...~~~~~.....,....T',
      'T..,~~~~~~.........T',
      'T..................T',
      'T..,.......~~~~...,T',
      'TT.........~~~~~...T',
      'T..R......,~~~~....T',
      'T..................T',
      'TT..,....,....,...TT',
      'TTT..TTTTTTTTTTTTTTT',
    ],
    paths: [[[-1, 2], [10, 2], [10, 9], [16, 9], [16, 5], [4, 5], [4, 12]]],
    decor: [
      { type: 'torii', x: 8, y: 1 }, { type: 'stoneLantern', x: 12, y: 1 }, { type: 'bridgeLantern', x: 9, y: 4 },
      { type: 'sakura', x: 18, y: 6 }, { type: 'shrine', x: 2, y: 8 },
    ],
  }),
  defineMap({
    id: 'shrine_sanctum', name: 'Inner Sanctum', theme: 'shrine', tier: 'advanced',
    desc: 'Two pilgrim roads meet before the sanctum doors. Mirror ponds flank the meeting point.',
    rows: [
      'TTTTT,TTTTTTTTT,TTTT',
      '..........H....,...T',
      'T.,..~~~.,.H....~~.T',
      'T...~~~~~......~~~.T',
      'T..,.~~~..H.H...,..T',
      'T................,.T',
      'T..,.~~~..H.H......T',
      'T...~~~~~.....,....T',
      'T.,..~~~.,..........',
      'T..........H...~~..T',
      '..........H....,...T',
      'TTTTT,TTTTTTTTT,TTTT',
    ],
    paths: [
      [[-1, 1], [9, 1], [9, 5], [14, 5], [14, 8], [20, 8]],
      [[-1, 10], [9, 10], [9, 5], [14, 5], [14, 8], [20, 8]],
    ],
    decor: [
      { type: 'shrine', x: 11, y: 3 }, { type: 'torii', x: 10, y: 4 }, { type: 'bell', x: 12, y: 6 },
      { type: 'stoneLantern', x: 6, y: 5 }, { type: 'sakura', x: 17, y: 4 },
    ],
  }),

  // -------------------------------------------------------------------------
  // Chapter 4 — Ironhold Pass (mountain)
  // -------------------------------------------------------------------------
  defineMap({
    id: 'mountain_pass', name: 'Ironhold Switchbacks', theme: 'mountain', tier: 'intermediate',
    desc: 'Switchbacks climb the pass and cross a snowmelt river on a single bridge.',
    rows: [
      'RRRR..RRRRR~~RRR..RR',
      'RR.......,.~~...,.RR',
      'R..........~~......R',
      'R.,...R....~~.....,R',
      'R...RR.,...~~~.....R',
      'RR.....R..~~~~.....R',
      'R......R..~~~..,...R',
      'R.,....R...~~......R',
      'RR........~~~......R',
      'R...,......~~...,..R',
      '...........~~.......',
      'RRRRRRR..RR~~RRRRRRR',
    ],
    paths: [[[-1, 10], [5, 10], [5, 6], [2, 6], [2, 2], [9, 2], [9, 8], [14, 8], [14, 2], [17, 2], [17, 10], [20, 10]]],
    decor: [
      { type: 'pine', x: 7, y: 1 }, { type: 'banner', x: 4, y: 8 }, { type: 'flag', x: 16, y: 1 },
      { type: 'waterwheel', x: 13, y: 9 }, { type: 'campfire', x: 7, y: 4 },
    ],
  }),
  defineMap({
    id: 'mountain_bridge', name: 'Sky Bridge', theme: 'mountain', tier: 'advanced',
    desc: 'A rope bridge spans the roaring gorge river — the only way across for orc and girl alike.',
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
    paths: [[[-1, 3], [7, 3], [7, 9], [16, 9], [16, 3], [22, 3]]],
    decor: [
      { type: 'pine', x: 2, y: 5 }, { type: 'pine', x: 19, y: 6 }, { type: 'flag', x: 5, y: 10 },
      { type: 'campfire', x: 18, y: 1 }, { type: 'statue', x: 3, y: 8 },
    ],
  }),
  defineMap({
    id: 'mountain_gorge', name: 'Twin Gorge', theme: 'mountain', tier: 'advanced',
    desc: 'Two canyons merge into one road past a mountain tarn. Watch both entrances.',
    rows: [
      'RRRRRRRR,RRRRRRRRRRR',
      'R.......,....~~~~~.R',
      '......R....,.~~~~~~R',
      'R..,..R.......~~~..R',
      'RR....,.....,......R',
      'R....R.............R',
      'R..RR....~~~....,..R',
      'R........~~~~......R',
      'RR..,....~~~R......R',
      '....................',
      'R..,.....R....,....R',
      'RRRRRR..RRRRRRR.RRRR',
    ],
    paths: [
      [[-1, 2], [6, 2], [6, 5], [13, 5], [13, 9], [20, 9]],
      [[-1, 9], [8, 9], [8, 5], [13, 5], [13, 9], [20, 9]],
    ],
    decor: [
      { type: 'pine', x: 2, y: 4 }, { type: 'pine', x: 17, y: 4 }, { type: 'banner', x: 7, y: 4 },
      { type: 'statue', x: 16, y: 10 }, { type: 'campfire', x: 3, y: 7 },
    ],
  }),
  defineMap({
    id: 'mountain_fortress', name: 'Ironhold Gate', theme: 'mountain', tier: 'advanced',
    desc: 'Both mountain roads funnel through the Ironhold gate and across its moat.',
    rows: [
      'RRRRR,RRRRRRRRR,RRRR',
      'R.....,....RRR.....R',
      '...........HHH.....R',
      'R.,....~~.HHHHH..,.R',
      'R....~~~~..~~~~~...R',
      'R..,.~~~...~~~~~.,.R',
      'R...................',
      'R..,.~~~...~~~~~...R',
      'R....~~~~..~~~~~.,.R',
      'R.,....~~.HHHHH....R',
      '...........HHH.....R',
      'RRRRR,RRRRRRRRR,RRRR',
    ],
    paths: [
      [[-1, 2], [10, 2], [10, 6], [20, 6]],
      [[-1, 10], [10, 10], [10, 6], [20, 6]],
    ],
    decor: [
      { type: 'banner', x: 13, y: 3 }, { type: 'banner', x: 13, y: 9 }, { type: 'flag', x: 17, y: 1 },
      { type: 'campfire', x: 3, y: 6 }, { type: 'statue', x: 17, y: 10 },
    ],
  }),
  defineMap({
    id: 'mountain_bastion', name: 'Stone Bastion', theme: 'mountain', tier: 'advanced',
    desc: 'The road snakes tightly around the old orc bastion — melee girls between the turns hit every lane.',
    rows: [
      'RRRRR,RRRRRR,RRRRR',
      'R......,.........R',
      'R.........,......R',
      'R...,...........RR',
      'R........H..~~...R',
      'R...,...HHH.~~~..R',
      '....,....H..~~~..R',
      'R........,...~~..R',
      'R..~~...........,R',
      'R..~~.............',
      'R..,......,......R',
      'RRRRRRRR,RRRRRRRRR',
    ],
    paths: [[[-1, 6], [3, 6], [3, 2], [7, 2], [7, 9], [11, 9], [11, 2], [15, 2], [15, 9], [18, 9]]],
    decor: [
      { type: 'banner', x: 9, y: 3 }, { type: 'flag', x: 9, y: 7 }, { type: 'campfire', x: 5, y: 10 },
      { type: 'pine', x: 1, y: 1 }, { type: 'statue', x: 16, y: 4 },
    ],
  }),

  // -------------------------------------------------------------------------
  // Chapter 5 — Gloomfen Marsh (marsh)
  // -------------------------------------------------------------------------
  defineMap({
    id: 'marsh_boardwalk', name: 'Gloomfen Boardwalk', theme: 'marsh', tier: 'intermediate',
    desc: 'Creaking boardwalks over black bog water. Few dry tiles, many wet ones.',
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
    paths: [[[-1, 3], [6, 3], [6, 8], [12, 8], [12, 3], [16, 3], [16, 9], [20, 9]]],
    decor: [
      { type: 'willow', x: 0, y: 5 }, { type: 'lantern', x: 7, y: 6 }, { type: 'bones', x: 14, y: 6 },
      { type: 'willow', x: 13, y: 10 }, { type: 'lantern', x: 18, y: 1 },
    ],
  }),
  defineMap({
    id: 'marsh_mire', name: 'Lantern Mire', theme: 'marsh', tier: 'advanced',
    desc: 'Two causeways cross in the middle of the mire. Lanterns mark the only dry ground.',
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
      [[-1, 2], [12, 2], [12, 9], [20, 9]],
      [[-1, 9], [6, 9], [6, 4], [20, 4]],
    ],
    decor: [
      { type: 'lantern', x: 4, y: 6 }, { type: 'lantern', x: 16, y: 1 }, { type: 'willow', x: 8, y: 10 },
      { type: 'bones', x: 9, y: 6 }, { type: 'lantern', x: 17, y: 8 },
    ],
  }),
  defineMap({
    id: 'marsh_tangle', name: 'Witchroot Tangle', theme: 'marsh', tier: 'advanced',
    desc: 'Two roads knot through the fen and cross twice. Ghouls blink across the gaps.',
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
      [[-1, 3], [14, 3], [14, 9], [20, 9]],
      [[5, -1], [5, 7], [17, 7], [17, 12]],
    ],
    decor: [
      { type: 'willow', x: 9, y: 1 }, { type: 'bones', x: 2, y: 2 }, { type: 'lantern', x: 13, y: 8 },
      { type: 'willow', x: 18, y: 2 }, { type: 'statue', x: 3, y: 5 },
    ],
  }),
  defineMap({
    id: 'marsh_hollow', name: 'Sunken Hollow', theme: 'marsh', tier: 'advanced',
    desc: 'The road rings a sunken pool. Water girls in the middle cover every side.',
    rows: [
      'TTT~~TTT,TTTT~~TTTTT',
      'T~~...............~T',
      'T~~...~~~~~~~~~..~~T',
      'T~...,~~~~~~~~~...~T',
      '~~....~~~TT~~~~..~~~',
      '......~~~,.~~~~..~~~',
      'T~~...~~~~~~~~~..~~T',
      'T~~,..~~~~~~~~~...~T',
      'TT....~~~~~~~~~..~~T',
      'T~~...~~~~~~~~~...~T',
      'T~~.....,.........~T',
      'TTTT~~TT.TTTT~~TTTTT',
    ],
    paths: [[[-1, 5], [5, 5], [5, 1], [15, 1], [15, 10], [8, 10], [8, 12]]],
    decor: [
      { type: 'willow', x: 9, y: 4 }, { type: 'lantern', x: 10, y: 5 }, { type: 'bones', x: 3, y: 8 },
      { type: 'willow', x: 17, y: 7 }, { type: 'boat', x: 12, y: 7 },
    ],
  }),
  defineMap({
    id: 'marsh_willow', name: 'Drowned Willow', theme: 'marsh', tier: 'expert',
    desc: 'A spiral boardwalk around the great drowned willow. Dry land is precious here.',
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
    paths: [[[-1, 10], [17, 10], [17, 1], [2, 1], [2, 7], [13, 7], [13, 4], [6, 4], [6, -1]]],
    decor: [
      { type: 'willow', x: 10, y: 5 }, { type: 'lantern', x: 5, y: 6 }, { type: 'bones', x: 10, y: 9 },
      { type: 'boat', x: 4, y: 3 }, { type: 'lantern', x: 16, y: 3 },
    ],
  }),

  // -------------------------------------------------------------------------
  // Chapter 6 — Clockwork Foundry (foundry)
  // -------------------------------------------------------------------------
  defineMap({
    id: 'foundry_vats', name: 'Crystal Vats', theme: 'foundry', tier: 'intermediate',
    desc: 'The path winds between two glowing crystal vats. Quartz slimes are born here.',
    rows: [
      'HHHRRHHHHHHHRRHHHHHH',
      'H....,....,....,...H',
      'H.,...........R.,..H',
      'H..R........~~~....H',
      'H.,...~~~...~~~.....',
      'H.....~~~...~~~..,.H',
      '.....,~~~...~~~....H',
      'H.R...~~~.,.~~~....H',
      'H.....~~~..........H',
      'H..,.......,.......H',
      'H..R.....,.....R...H',
      'HHHHHRRHHHHHHHRRHHHH',
    ],
    paths: [[[-1, 6], [4, 6], [4, 2], [10, 2], [10, 9], [16, 9], [16, 4], [20, 4]]],
    decor: [
      { type: 'crystal', x: 7, y: 9 }, { type: 'crystal', x: 13, y: 8 }, { type: 'chimney', x: 1, y: 0 },
      { type: 'gearTower', x: 18, y: 7 }, { type: 'vent', x: 2, y: 8 },
    ],
  }),
  defineMap({
    id: 'foundry_belt', name: 'Conveyor Line', theme: 'foundry', tier: 'intermediate',
    desc: 'Three long straights along the conveyor belts — perfect for beams and lines of fire.',
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
    paths: [[[-1, 2], [20, 2], [20, 6], [1, 6], [1, 10], [22, 10]]],
    decor: [
      { type: 'chimney', x: 8, y: 0 }, { type: 'gearTower', x: 14, y: 11 }, { type: 'crane', x: 0, y: 4 },
      { type: 'vent', x: 10, y: 8 }, { type: 'chimney', x: 20, y: 11 },
    ],
  }),
  defineMap({
    id: 'foundry_crossing', name: 'Gearworks Crossing', theme: 'foundry', tier: 'advanced',
    desc: 'Two assembly lines cross over the coolant canal. Sappers love the junction.',
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
      [[-1, 2], [10, 2], [10, 10], [20, 10]],
      [[-1, 9], [6, 9], [6, 5], [16, 5], [16, -1]],
    ],
    decor: [
      { type: 'gearTower', x: 3, y: 3 }, { type: 'crane', x: 18, y: 7 }, { type: 'chimney', x: 1, y: 11 },
      { type: 'vent', x: 8, y: 7 }, { type: 'gearTower', x: 17, y: 2 },
    ],
  }),
  defineMap({
    id: 'foundry_core', name: 'Furnace Core', theme: 'foundry', tier: 'expert',
    desc: 'A serpentine of service corridors around coolant tanks, right above the furnace.',
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
    paths: [[[-1, 1], [4, 1], [4, 10], [8, 10], [8, 1], [12, 1], [12, 10], [16, 10], [16, 1], [20, 1]]],
    decor: [
      { type: 'vent', x: 9, y: 11 }, { type: 'chimney', x: 6, y: 0 }, { type: 'gearTower', x: 14, y: 1 },
      { type: 'crane', x: 18, y: 5 }, { type: 'vent', x: 10, y: 6 },
    ],
  }),
  defineMap({
    id: 'foundry_hangar', name: 'Machine Hangar', theme: 'foundry', tier: 'expert',
    desc: 'The Goblin Machine\'s hangar: a huge loop that crosses itself above the coolant pits.',
    rows: [
      'HHHHHRRHHHHHHHHRRHHHHH',
      'H......,....,.....,..H',
      '...................,.H',
      'H.,.R....~~~~....R...H',
      'H.......~~~~~~.......H',
      'H.....................',
      'H......~~~~~~.....,..H',
      'H.,.R...~~~~....R....H',
      'H......,.......,.....H',
      'H....................H',
      'H..R...,......,...R..H',
      'HHHHHRRHHHHHHHHRRHHHHH',
    ],
    paths: [[[-1, 2], [18, 2], [18, 9], [3, 9], [3, 5], [22, 5]]],
    decor: [
      { type: 'crane', x: 1, y: 7 }, { type: 'gearTower', x: 10, y: 8 }, { type: 'chimney', x: 20, y: 11 },
      { type: 'vent', x: 13, y: 3 }, { type: 'gearTower', x: 20, y: 7 },
    ],
  }),

  // -------------------------------------------------------------------------
  // Chapter 7 — Oni Festival (festival)
  // -------------------------------------------------------------------------
  defineMap({
    id: 'festival_street', name: 'Lantern Street', theme: 'festival', tier: 'intermediate',
    desc: 'Two parade routes meet in the festival square beside the boat canal.',
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
      [[-1, 2], [8, 2], [8, 5], [14, 5], [14, 7], [20, 7]],
      [[-1, 10], [11, 10], [11, 7], [20, 7]],
    ],
    decor: [
      { type: 'stall', x: 3, y: 1 }, { type: 'stall', x: 16, y: 3 }, { type: 'taiko', x: 12, y: 6 },
      { type: 'boat', x: 2, y: 5 }, { type: 'lantern', x: 9, y: 8 },
    ],
  }),
  defineMap({
    id: 'festival_square', name: 'Fireworks Square', theme: 'festival', tier: 'advanced',
    desc: 'The parade loops the fireworks square and crosses itself three times.',
    rows: [
      'HHHH,HHHHHH,HHHHHHHH',
      'H...........,..,...H',
      'H.,.......,....H...H',
      'H.....~~~~..,......H',
      '.................,.H',
      'H.,....,...,....,..H',
      'H.....~~~~.....~~..H',
      'H..H..~~~~..H..~~..H',
      'H.,.......,......,.H',
      'H..................H',
      'H.,....,...,...,...H',
      'HHHHHHHHHHH.HHHHHHHH',
    ],
    paths: [[[-1, 4], [16, 4], [16, 9], [4, 9], [4, 1], [11, 1], [11, 12]]],
    decor: [
      { type: 'taiko', x: 8, y: 6 }, { type: 'stall', x: 18, y: 2 }, { type: 'stall', x: 1, y: 7 },
      { type: 'lantern', x: 14, y: 6 }, { type: 'banner', x: 7, y: 2 },
    ],
  }),
  defineMap({
    id: 'festival_bridge', name: 'Moon Bridge', theme: 'festival', tier: 'advanced',
    desc: 'The parade crosses the moon river three times over red arched bridges.',
    rows: [
      'HH,HHH.HH~~HH,HHHHHH',
      'H.......,~~.......,H',
      '.........~~........H',
      'H.,..H...~~..,..H..H',
      'H.......~~~~.......H',
      'H........~~........H',
      'H.,.....~~~~....,..H',
      'H..H.....~~....H...H',
      'H........~~........H',
      'H.,.~~..~~~~...,...H',
      'H..~~~...~~.....,..H',
      'HH~~HHHHH~~HHHHHH..H',
    ],
    paths: [[[-1, 2], [15, 2], [15, 8], [5, 8], [5, 5], [18, 5], [18, 12]]],
    decor: [
      { type: 'lantern', x: 8, y: 4 }, { type: 'lantern', x: 12, y: 6 }, { type: 'taiko', x: 3, y: 6 },
      { type: 'stall', x: 13, y: 10 }, { type: 'boat', x: 9, y: 10 },
    ],
  }),
  defineMap({
    id: 'festival_maze', name: 'Shrine Maze', theme: 'festival', tier: 'expert',
    desc: 'Tight corners between the festival stalls. Every girl has a choke point — and so does every oni.',
    rows: [
      'HHHH,HHH,HHH,HHHHH',
      '...H.H.....H.H...H',
      'H..,..,...,...,..H',
      'H.,.~~.,.,..~~...H',
      'H................H',
      'H..,...HHHH...,..H',
      'H......~~~~.....,H',
      'H................H',
      'H.,....H....,....H',
      'H..~~~.....~~~...H',
      'H.................',
      'HHHHH,HHHHHHH,HHHH',
    ],
    paths: [[[-1, 1], [2, 1], [2, 4], [6, 4], [6, 1], [10, 1], [10, 4], [14, 4], [14, 1], [16, 1], [16, 7], [1, 7], [1, 10], [18, 10]]],
    decor: [
      { type: 'taiko', x: 8, y: 5 }, { type: 'stall', x: 4, y: 2 }, { type: 'stall', x: 12, y: 2 },
      { type: 'lantern', x: 7, y: 8 }, { type: 'banner', x: 15, y: 9 },
    ],
  }),
  defineMap({
    id: 'festival_arena', name: 'Champion\'s Stage', theme: 'festival', tier: 'expert',
    desc: 'The tournament stage of the Oni Festival. Two parades join right under the champion\'s nose.',
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
      [[-1, 3], [6, 3], [6, 8], [13, 8], [13, 3], [20, 3]],
      [[-1, 10], [9, 10], [9, 8], [13, 8], [13, 3], [20, 3]],
    ],
    decor: [
      { type: 'taiko', x: 10, y: 7 }, { type: 'banner', x: 4, y: 7 }, { type: 'banner', x: 16, y: 7 },
      { type: 'lantern', x: 3, y: 1 }, { type: 'stall', x: 17, y: 10 },
    ],
  }),

  // -------------------------------------------------------------------------
  // Chapter 8 — Ashwing Peaks (snow / volcano)
  // -------------------------------------------------------------------------
  defineMap({
    id: 'peaks_ascent', name: 'Ashwing Ascent', theme: 'snow', tier: 'advanced',
    desc: 'A snowy climb past a steaming hot spring. Wyverns cut across the switchbacks.',
    rows: [
      'RRRTTRRRR,RRTTRRRRRR',
      'R..T......,....T...R',
      'RT..,..........T....',
      'R..........~~~...R.R',
      'R.T.,......~~~~....R',
      'RR....,....~~~~~...R',
      'R.....T....~~~~....R',
      'R..........,.......R',
      'R..T..............TR',
      'RR..,..T....,...~~~R',
      '.......T......~~~~~R',
      'RRRRTTRRRRRRR~~~RRRR',
    ],
    paths: [[[-1, 10], [6, 10], [6, 7], [2, 7], [2, 3], [10, 3], [10, 8], [16, 8], [16, 2], [20, 2]]],
    decor: [
      { type: 'pine', x: 3, y: 1 }, { type: 'pine', x: 7, y: 10 }, { type: 'vent', x: 13, y: 6 },
      { type: 'nest', x: 18, y: 0 }, { type: 'flag', x: 1, y: 9 },
    ],
  }),
  defineMap({
    id: 'peaks_glacier', name: 'Frozen Falls', theme: 'snow', tier: 'advanced',
    desc: 'A glacier river tumbles through the middle; the road crosses it three times.',
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
    paths: [[[-1, 1], [14, 1], [14, 5], [4, 5], [4, 9], [20, 9]]],
    decor: [
      { type: 'pine', x: 2, y: 2 }, { type: 'pine', x: 17, y: 4 }, { type: 'nest', x: 18, y: 11 },
      { type: 'flag', x: 1, y: 7 }, { type: 'crystal', x: 13, y: 7 },
    ],
  }),
  defineMap({
    id: 'peaks_caldera', name: 'Caldera Rim', theme: 'volcano', tier: 'expert',
    desc: 'The road circles a lava lake and climbs out across its own entrance. Hot springs in the corners.',
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
    paths: [[[-1, 2], [16, 2], [16, 9], [3, 9], [3, -1]]],
    decor: [
      { type: 'vent', x: 5, y: 4 }, { type: 'vent', x: 14, y: 7 }, { type: 'bones', x: 10, y: 8 },
      { type: 'crystal', x: 18, y: 5 }, { type: 'nest', x: 8, y: 0 },
    ],
  }),
  defineMap({
    id: 'peaks_ridge', name: 'Dragonback Ridge', theme: 'volcano', tier: 'expert',
    desc: 'Two trails climb the dragon\'s spine past smoking vents and merge on the ridge.',
    rows: [
      'RRRRRRRR,RRRRRRR,RRRRR',
      'R~~....,......R...~~RR',
      '.......,...........,.R',
      'R..R.....XXX.....R...R',
      'R.,.....XXXXX.,......R',
      'RR.......XXX....~~...R',
      'R....................R',
      'R..,....~~~.....,.R..R',
      'RR.....~~~~~..R.......',
      '...........,....,....R',
      'R..R....~~~...,.......',
      'RRRRRRRR~~~RRRRRRRRRRR',
    ],
    paths: [
      [[-1, 2], [6, 2], [6, 6], [16, 6], [16, 10], [22, 10]],
      [[-1, 9], [11, 9], [11, 6], [16, 6], [16, 10], [22, 10]],
    ],
    decor: [
      { type: 'vent', x: 10, y: 4 }, { type: 'nest', x: 19, y: 3 }, { type: 'bones', x: 3, y: 7 },
      { type: 'crystal', x: 13, y: 3 }, { type: 'pine', x: 20, y: 8 },
    ],
  }),
  defineMap({
    id: 'peaks_nest', name: 'Matriarch\'s Nest', theme: 'volcano', tier: 'expert',
    desc: 'Three trails converge on the Matriarch\'s nest. Hold the merge or lose the peak.',
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
      [[-1, 2], [8, 2], [8, 6], [22, 6]],
      [[-1, 10], [8, 10], [8, 6], [22, 6]],
      [[15, -1], [15, 6], [22, 6]],
    ],
    decor: [
      { type: 'nest', x: 19, y: 3 }, { type: 'bones', x: 12, y: 8 }, { type: 'vent', x: 5, y: 7 },
      { type: 'crystal', x: 3, y: 4 }, { type: 'pine', x: 17, y: 9 },
    ],
  }),

  // -------------------------------------------------------------------------
  // Bounty (resource) arenas
  // -------------------------------------------------------------------------
  defineMap({
    id: 'arena_library', name: 'Library Courtyard', theme: 'sakura', tier: 'intermediate',
    desc: 'Bounty arena behind the academy library. Lost study books wash up in the fountain.',
    rows: [
      'HHHHHH,HHHHHH,HHHH',
      'H.....,.....,....H',
      'H..T.......T.....H',
      '..................',
      'H.,....~~~~...,..H',
      'H......~~~~......H',
      'H..T...,~~.....T.H',
      'H...,.........,..H',
      'H.....,......,...H',
      'H..T....,.....T..H',
      'HHHHHHHHHHHHHHHHHH',
    ],
    paths: [[[-1, 3], [6, 3], [6, 8], [12, 8], [12, 3], [18, 3]]],
    decor: [
      { type: 'bookshelf', x: 2, y: 1 }, { type: 'fountain', x: 9, y: 5 }, { type: 'sakura', x: 15, y: 6 },
      { type: 'bench', x: 4, y: 7 }, { type: 'bookshelf', x: 15, y: 1 },
    ],
  }),
  defineMap({
    id: 'arena_market', name: 'Market Canal', theme: 'lake', tier: 'intermediate',
    desc: 'Bounty arena on the merchant canal. Two lanes, one crossing, plenty of coins.',
    rows: [
      'HHHH,HHHHHH~~HH.HHHH',
      'H......,...~~.....,H',
      '..........,~~......H',
      'H..,.......~~..,...H',
      'H..........~~......H',
      'H..........~~......H',
      'H.,...H....~~..H...H',
      'H..........~~....,.H',
      '...........~~.......',
      'H..,....H..~~...,..H',
      'HHHHHHHHHHH~~HHHHHHH',
    ],
    paths: [
      [[-1, 2], [9, 2], [9, 8], [20, 8]],
      [[-1, 8], [4, 8], [4, 5], [15, 5], [15, -1]],
    ],
    decor: [
      { type: 'stall', x: 2, y: 3 }, { type: 'boat', x: 12, y: 3 }, { type: 'stall', x: 17, y: 6 },
      { type: 'lantern', x: 7, y: 6 }, { type: 'boat', x: 11, y: 9 },
    ],
  }),
  defineMap({
    id: 'arena_workshop', name: 'Workshop Yard', theme: 'foundry', tier: 'advanced',
    desc: 'Bounty arena in the gear workshop. Long straights over coolant channels.',
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
    paths: [[[-1, 1], [17, 1], [17, 5], [2, 5], [2, 9], [20, 9]]],
    decor: [
      { type: 'gearTower', x: 9, y: 4 }, { type: 'crane', x: 18, y: 7 }, { type: 'chimney', x: 0, y: 3 },
      { type: 'vent', x: 12, y: 8 }, { type: 'gearTower', x: 5, y: 6 },
    ],
  }),
  defineMap({
    id: 'arena_meadow', name: 'Wildflower Meadow', theme: 'mountain', tier: 'intermediate',
    desc: 'Bounty arena in a high meadow where feathers, blades, embers and rime crystals gather.',
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
    paths: [[[-1, 5], [4, 5], [4, 1], [10, 1], [10, 9], [16, 9], [16, 4], [20, 4]]],
    decor: [
      { type: 'pine', x: 1, y: 3 }, { type: 'flag', x: 12, y: 3 }, { type: 'campfire', x: 7, y: 7 },
      { type: 'statue', x: 18, y: 7 }, { type: 'pine', x: 14, y: 1 },
    ],
  }),
  defineMap({
    id: 'arena_runegarden', name: 'Rune Garden', theme: 'night', tier: 'advanced',
    desc: 'Bounty arena in a moonlit garden of charms, runes and cogs. Two crossing paths.',
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
      [[-1, 2], [12, 2], [12, 9], [20, 9]],
      [[-1, 8], [6, 8], [6, 5], [17, 5], [17, -1]],
    ],
    decor: [
      { type: 'stoneLantern', x: 10, y: 1 }, { type: 'crystal', x: 4, y: 4 }, { type: 'shrine', x: 15, y: 8 },
      { type: 'lantern', x: 5, y: 6 }, { type: 'statue', x: 3, y: 9 },
    ],
  }),

  // -------------------------------------------------------------------------
  // Total Assault (boss) arenas
  // -------------------------------------------------------------------------
  defineMap({
    id: 'arena_crypt', name: 'Lych Crypt', theme: 'night', tier: 'expert',
    desc: 'The Grave Lych\'s candlelit crypt garden. A long winding road through bog pools.',
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
      'TTTHHTTTTTTTTTHHTTTT',
    ],
    paths: [[[-1, 2], [16, 2], [16, 6], [3, 6], [3, 10], [20, 10]]],
    decor: [
      { type: 'bones', x: 9, y: 4 }, { type: 'candle', x: 1, y: 8 }, { type: 'statue', x: 16, y: 8 },
      { type: 'willow', x: 4, y: 3 }, { type: 'lantern', x: 12, y: 9 },
    ],
  }),
  defineMap({
    id: 'arena_forge', name: 'Colossus Forge', theme: 'foundry', tier: 'expert',
    desc: 'The Iron Colossus\'s forge floor. Its long march passes a coolant reservoir.',
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
      'H..................H',
      'HHHHHHXXXXXXXXHHHHHH',
    ],
    paths: [[[-1, 5], [3, 5], [3, 1], [9, 1], [9, 10], [15, 10], [15, 1], [18, 1], [18, 6], [20, 6]]],
    decor: [
      { type: 'chimney', x: 6, y: 0 }, { type: 'gearTower', x: 5, y: 7 }, { type: 'vent', x: 11, y: 11 },
      { type: 'crane', x: 17, y: 8 }, { type: 'crystal', x: 12, y: 4 },
    ],
  }),
  defineMap({
    id: 'arena_summit', name: 'Ashwing Summit', theme: 'volcano', tier: 'expert',
    desc: 'The Matriarch\'s summit: lava vents, hot springs and nowhere to hide from the sky.',
    rows: [
      'RRRRRRRRRRRRRRRRRRRR',
      'R~~......R.......~~R',
      'R..,...........,....',
      'R.XX.......~~......R',
      'R.XX..,....~~~~,...R',
      'R..X........~~~..XXR',
      'R.....,....~~~...XXR',
      'R..,.........,....XR',
      'R.~~..........R....R',
      '...................R',
      'R~~~...,.....,..~~~R',
      'RRRRRRRRRRRRRRRRRRRR',
    ],
    paths: [[[-1, 9], [4, 9], [4, 2], [10, 2], [10, 9], [16, 9], [16, 2], [20, 2]]],
    decor: [
      { type: 'nest', x: 13, y: 7 }, { type: 'vent', x: 3, y: 4 }, { type: 'bones', x: 7, y: 6 },
      { type: 'crystal', x: 18, y: 7 }, { type: 'vent', x: 17, y: 5 },
    ],
  }),

  // -------------------------------------------------------------------------
  // Tactical Challenge (endless)
  // -------------------------------------------------------------------------
  defineMap({
    id: 'arena_colosseum', name: 'Sakura Colosseum', theme: 'arena', tier: 'intermediate',
    desc: 'The academy\'s practice colosseum: a long spiral built for endless challenge runs.',
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
    paths: [[[-1, 1], [18, 1], [18, 10], [1, 10], [1, 4], [15, 4], [15, 7], [4, 7], [4, 12]]],
    decor: [
      { type: 'flag', x: 8, y: 0 }, { type: 'sakura', x: 3, y: 3 }, { type: 'sakura', x: 16, y: 3 },
      { type: 'fountain', x: 9, y: 6 }, { type: 'banner', x: 10, y: 0 },
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
 * Tiles covered by a map's paths.
 * @param {object} map MapDef
 * @returns {Set<string>} "x,y" strings (includes off-grid spawn/exit tiles)
 */
export function pathTiles(map) {
  return stampPaths(map.paths);
}

/**
 * Buildable tile counts for UI badges / recommendations.
 * @param {object} map MapDef
 * @returns {{ land: number, water: number }}
 */
export function buildableTiles(map) {
  const path = pathTiles(map);
  let land = 0;
  let water = 0;
  map.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (path.has(`${x},${y}`)) continue;
      const ch = row[x];
      if (ch === '.' || ch === ',') land++;
      else if (ch === '~') water++;
    }
  });
  return { land, water };
}

// Preview fixtures for the Gate Arc Step 3 looks (previews/oldtown.html): Old Town by night, the
// same ground burning, and a lane that starts at a rift in the middle of the lake. NOT game data:
// nothing in src/ imports this file, these boards are never in src/data/maps.js MAPS or STAGES (both
// feed the co-op data hash and the sim id), and vite.config.js builds no previews/ input. The real
// Act 3 maps (3-6…3-10) arrive with Gate Arc Step 3 S3b.
//
// Rows use the usual legend (src/data/maps.js): '.' paving (buildable), ',' verge, 'T' tree, 'H'
// building (border H = a wall), '~' water, 'U' a tiled roof girls stand on, 'X' (on a city map) a
// collapsed house: a rubble heap. Two Gate Arc fields the maps of S3b carry (CONTRACTS.md §4):
//   district: 'oldtown'           MapDef: the Old Town district on a `city` map (themes.DISTRICTS)
//   { nodes, inside: true, … }    path spec → MapDef.tracks[i].inside: the lane starts inside the
//                                 board (a mid-board rift): no run-out, its gate where it begins
import { LINE } from '../src/core/track.js';
import { MAP_RULES } from '../src/data/rules.js';
import { ENEMY_MAP } from '../src/data/enemies.js';
import { street, defineFixtureMap, fixtureStage } from './cityMaps.js';

const L = LINE;

/**
 * defineFixtureMap plus the two Step 3 fields, carried the way src/data/maps.js defineMap will carry
 * them: `district` on the MapDef, and a path spec's `inside: true` onto its track.
 */
export function defineStep3Fixture(o) {
  const map = defineFixtureMap(o);
  o.paths.forEach((spec, i) => {
    if (spec && !Array.isArray(spec) && spec.inside) map.tracks[i].inside = true;
  });
  if (o.district) map.district = o.district;
  return map;
}

// ---------------------------------------------------------------------------
// (a) Old Town lanes by night: a fret of alternating keys (north, south, north) through the
// festival quarter, tiled roofs ('U') inside the keys, the mill race along the south lane, a stone
// basin, stalls and a shrine hall one row back. The keys alternate so the road is not a meander.
// ---------------------------------------------------------------------------
const LANES_ROWS = [
  'HHHHHHHHHHHHHHHHHHHH',
  'H.HHH..HHH.HHHH...HH',
  'H..................H',
  'HH...........H..U..H',
  'HH.UUU...H.H...UUU.H',
  'H..UUU.....H...UUU.H',
  '....................',
  'HHH......UUU....H...',
  'H.T.HH....U.....H.TH',
  'H.....,............H',
  'H..~~~~~~~~~~~~~~..H',
  'HHHHHHHHHHHHHHHHHHHH',
];
const LANES_PATH = street([[-1, 6.5], [1.5, 6.5], [1.5, 2.5], [6.5, 2.5], [6.5, 6.5], [8.5, 6.5], [8.5, 9.5], [12.5, 9.5], [12.5, 6.5], [14.5, 6.5], [14.5, 2.5], [18.5, 2.5], [18.5, 5.5], [21, 5.5]], { r: 1 });

const lanes = defineStep3Fixture({
  id: 'fixture_oldtown_lanes',
  name: 'Old Town Lanes',
  theme: 'city',
  district: 'oldtown',
  desc: 'Preview board: the festival quarter by night, a fret of alternating keys with tiled roofs inside them, the mill race along the south.',
  rows: LANES_ROWS,
  paths: [LANES_PATH],
  crossings: 'bridge',
  decor: [
    { type: 'stoneBasin', x: 11, y: 5, rot: 0 },
    { type: 'griddleStall', x: 7, y: 9, rot: 0 },
    { type: 'ringToss', x: 15, y: 9, rot: 0 },
    { type: 'festivalPoster', x: 2, y: 9, rot: 0 },
    { type: 'easel', x: 12, y: 4, rot: -0.4 },
  ],
  city: { drones: false },
});

// ---------------------------------------------------------------------------
// (b) The same ground burning: the roofs girls stood on are gone (collapsed houses, 'X'), the
// houses are shells; HAMMER's tear hangs over the back of the quarter (a hammerTear set piece).
// ---------------------------------------------------------------------------
const BURNING_ROWS = LANES_ROWS.map((r, y) => r.split('').map((c, x) => {
  if (c === 'U') return 'X';
  if (c === 'H' && y > 0 && y < 11 && x > 0 && x < 19 && (x * 7 + y * 3) % 5 === 0) return 'X';
  if (c === ',') return '.';
  return c;
}).join(''));

const burning = defineStep3Fixture({
  id: 'fixture_oldtown_burning',
  name: 'Old Town, Burning',
  theme: 'city',
  district: 'oldtown',
  desc: 'Preview board: the festival quarter after the barrage, the same lanes, the roofs fallen in, the tear over the back of the quarter.',
  rows: BURNING_ROWS,
  paths: [LANES_PATH],
  crossings: 'bridge',
  decor: [
    { type: 'hammerTear', x: 9, y: 1, rot: 0 },
    { type: 'stoneBasin', x: 11, y: 5, rot: 0 },
  ],
  city: {},
});

// ---------------------------------------------------------------------------
// (c) The lake rift (3-8's gimmick): the town road comes in from the west to the foot of the shrine
// steps; a second lane starts at a rift in the middle of the foggy lake, comes ashore on a jetty
// deck and joins it there; together they climb two switchbacks to the precinct gate (exit north).
// ---------------------------------------------------------------------------
const rift = defineStep3Fixture({
  id: 'fixture_lake_rift',
  name: 'The Lake Rift',
  theme: 'city',
  desc: 'Preview board: the town road from the west, a lane that starts at a rift in the middle of the lake and comes ashore on a jetty, two switchbacks up to the precinct gate.',
  rows: [
    'HHHHHHHHHHH..HHHHHHH',
    'H...T..........T...H',
    'H..................H',
    'H.HH..H..HHH..T....H',
    'H.HH..H..HHH.......H',
    'H.........,,.......H',
    'H..T..HH.....~~~~~~~',
    'H.....HH....~~~~~~~~',
    '...........~~~~~~~~~',
    'H.HH.......~~~~~~~~~',
    'H.HH..T.....~~~~~~~~',
    'HHHHHHHHHHH~~~~~~~~~',
  ],
  paths: [
    street([[-1, 8.5], [9, 8.5], [9, 5], [4, 5], [4, 2], [12, 2], [12, -1]], { r: 1.25 }),
    { inside: true, nodes: [[16.5, 9.5], L, [11.6, 9.5], [9.9, 8.7]], join: { path: 0, at: [9, 6.6] } },
  ],
  crossings: 'bridge',
  decor: [
    { type: 'stoneBasin', x: 6, y: 9, rot: 0 },
  ],
  city: {},
});

/** Variant key (preview URL) → fixture map. */
export const OLD_TOWN_FIXTURES = { lanes, burning, rift };

/** The scenery keywords each fixture's preview stage dresses its board with (src/render/terrain.js SCENERY). */
export const OLD_TOWN_KEYWORDS = {
  lanes: ['festivalStalls', 'shopCurtains', 'roofCats', 'streetLamps'],
  burning: ['scorchedCurtains', 'posterFaceDown', 'easelFallen', 'rubbleHeaps', 'burntCars'],
  rift: ['streetLamps', 'stoneBasins'],
};

/**
 * A stand-in for the Gnat (Gate Arc S3c ships the real def in src/data/enemies.js): the goblin
 * runner's numbers, drawn on the shipped construct GLB's cogling with gears, navy with an amber
 * stripe, knee height. Its id is what the render keys on (fall style, barks). Preview only.
 */
export const FIXTURE_GNAT = (() => {
  const base = ENEMY_MAP.goblin_runner || {};
  return {
    ...base,
    id: 'brigade_gnat',
    name: 'Gnat',
    family: 'construct',
    size: 0.55,
    color: '#2b3a5c',
    accent: '#f4a62a',
    variant: 'cogling',
    props: ['gears'],
    model: { base: 'construct', variant: 'cogling', props: ['gears'] },
    lore: 'Watches everything. Understands nothing. Reports both.',
    traits: base.traits || {},
  };
})();

/**
 * A night stage to run a fixture in the real Sim: an existing campaign stage's waves on the
 * fixture board, the Step 3 keywords, night (the burning board: `ruined: 'burning'`; the rift:
 * fog) and a map rule whose ACTIVE phase the preview drives from its buttons (the tear pulses with
 * it, as 3-10's will). Never added to STAGES.
 * @param {object} map an OLD_TOWN_FIXTURES board
 */
export function oldTownStage(map) {
  const key = Object.keys(OLD_TOWN_FIXTURES).find((k) => OLD_TOWN_FIXTURES[k] === map) || 'lanes';
  const base = fixtureStage(map, '3-3');
  return {
    ...base,
    scenery: {
      props: OLD_TOWN_KEYWORDS[key],
      night: true,
      ...(key === 'burning' ? { ruined: 'burning' } : {}),
      ...(key === 'rift' ? { fog: true } : {}),
    },
    rule: key === 'burning' ? { ...MAP_RULES.lunar_eclipse, zones: [], pads: [], cycle: [100000, 1] } : null,
    look: null,
  };
}

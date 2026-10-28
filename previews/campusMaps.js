// Preview fixtures for the Gate Arc campus look (previews/campus.html). NOT game data: nothing in
// src/ imports this file, these boards are never in src/data/maps.js MAPS or STAGES (both feed
// the co-op data hash and the sim id), and vite.config.js builds no previews/ input, so they stay
// out of the game bundle. The real Act 2 maps (2-6…2-10) arrive with Gate Arc Step 2 S2b.
//
// Rows use the usual legend (src/data/maps.js): '.' lawn (buildable), ',' flower bed (buildable),
// 'T' tree, 'R' flower boxes, 'H' school building (border H = a wall), '~' the lake, 'U' a
// classroom roof girls stand on. `city` carries the kit's render hints (src/render/city/cityKit.js):
// `road: 'track'` paves a map's road as the running track, `searchlight` puts the school's
// searchlight on the shore (its beam sweeps the lake), `pieces` stands set pieces anywhere.
import { LINE, arc } from '../src/core/track.js';
import { MAP_RULES } from '../src/data/rules.js';
import { street, defineFixtureMap, fixtureStage as cityFixtureStage } from './cityMaps.js';

const L = LINE;

// ---------------------------------------------------------------------------
// (a) The lakeside court at night: up the hill road from the south, round the front-court flower
// beds, along the classrooms and north through the corridor under the main building to Shelter 3;
// the lake fills the east, the searchlight sweeps it from the shore, classroom roofs ('U') beside
// the corridor carry flower boxes.
// ---------------------------------------------------------------------------
const court = defineFixtureMap({
  id: 'fixture_campus_court',
  name: 'Lakeside Court',
  theme: 'campus',
  desc: 'Preview board: up the hill road from the south, round the front-court flower beds, along the classroom wing and north through the corridor under the main building; the lake fills the east.',
  rows: [
    'HHHHHHHHHHHHHH.~~~~~',
    'H....HHHHUUU...~~~~~',
    'H.T..HHHHUUU..~~~~~~',
    'H....HHHH......~~~~~',
    'H.HH.........T.~~~~~',
    'H.HH...........~~~~~',
    'H.......,,,.....~~~~',
    'H..T...,,,,,....~~~~',
    'H...............~~~~',
    'H.HH.....HHH.....~~~',
    'H.HH.....HHH..T..~~~',
    'HHHH.HHHHHHHHHHH.~~~',
  ],
  paths: [
    street([[3.5, 13], [3.5, 8.5], [12.5, 8.5], [12.5, 5.0], [7.5, 5.0], [7.5, -1]], { r: 1.5, tunnel: [[7.5, 3.6], [7.5, 0.4]] }),
  ],
  crossings: 'bridge',
  decor: [
    { type: 'flagpole', x: 1, y: 6, rot: 0 },
    { type: 'boatRack', x: 14, y: 3, rot: -Math.PI / 2 },
    { type: 'boatRack', x: 15, y: 9, rot: -Math.PI / 2 },
    { type: 'bikeShed', x: 1, y: 8, rot: Math.PI / 2 },
  ],
  city: {
    searchlight: { x: 14.6, z: 6.6, rot: Math.PI / 2 + 0.25, sweep: 1.5, reach: 3.4, period: 13 },
    // the clock tower over the main building, in the strip past the far edge
    pieces: [{ type: 'schoolBlock', variant: 3, x: 3.2, z: -1.7, s: 1.4 }],
  },
});

// ---------------------------------------------------------------------------
// (b) The running track: in from the west, one anticlockwise lap of the track (the road painted
// as four red lanes), over its own entry on a footbridge, and out south; the lake behind the back
// straight, goal posts and a steeplechase water jump in the infield, the finish gantry over the
// home straight.
// ---------------------------------------------------------------------------
const track = defineFixtureMap({
  id: 'fixture_campus_track',
  name: 'Running Track',
  theme: 'campus',
  desc: 'Preview board: in from the west, one lap of the running track, over its own entry on a footbridge and out to the south; the lake lies behind the back straight.',
  rows: [
    'HHHHHHHH~~~~~~~~~~~~',
    'H.......~~~~~~~~~~~~',
    'H..T......,,,,~~~~~~',
    'H...................',
    'H...................',
    'H..........~~.......',
    '...................H',
    'H..................H',
    'H...........,......H',
    'H..................H',
    'H....T.........T...H',
    'HH.HHHHHHHHHHHHHHHHH',
  ],
  paths: [
    [[-1, 6.2], L, [3.4, 6.2], [5.2, 8.3], [7.2, 9.3], L, [13.5, 9.3], ...arc(13.5, 6.2, 3.1, 60, -90, 30), L, [7.0, 3.1], [4.6, 3.5], [2.9, 5.0], [2.3, 6.2], [2.1, 8.4], L, [2.1, 13]],
  ],
  crossings: 'bridge',
  decor: [
    { type: 'goalPosts', x: 7, y: 6, rot: Math.PI / 2 },
    { type: 'goalPosts', x: 14, y: 6, rot: -Math.PI / 2 },
    { type: 'stands', x: 9, y: 11, rot: 0 },
    { type: 'stands', x: 10, y: 11, rot: 0 },
  ],
  city: {
    road: 'track',
    pieces: [
      { type: 'finishGantry', x: 10.6, z: 9.3, rot: Math.PI / 2 },
      { type: 'scoreboard', x: 17.6, z: 1.6, rot: -0.5 },
    ],
    searchlight: { x: 17.4, z: 2.6, rot: Math.PI + 0.6, sweep: 1.2, reach: 3.0, period: 15, variant: 1 },
  },
});

/** Variant key (preview URL) → fixture map. */
export const CAMPUS_FIXTURES = { court, track };

/** The campus keywords the preview stage dresses its boards with (src/render/terrain.js SCENERY). */
export const CAMPUS_KEYWORDS = {
  court: ['schoolGrounds', 'clubHuts', 'lakeLamps', 'rowingClub', 'fireflies'],
  track: ['sportsField', 'schoolGrounds', 'lakeLamps', 'fireflies'],
};

/**
 * A night stage to run a fixture in the real Sim: an existing campaign stage's waves on the
 * fixture board, the campus keywords, night, and the blackout rule (`lunar_eclipse` with the
 * render-only look.blackout, as 2-7 will use it). Never added to STAGES.
 * @param {object} map a CAMPUS_FIXTURES board
 * @param {{ blackout?: boolean }} [o]
 */
export function campusStage(map, { blackout = true } = {}) {
  const key = Object.keys(CAMPUS_FIXTURES).find((k) => CAMPUS_FIXTURES[k] === map) || 'court';
  const base = cityFixtureStage(map, '2-2');
  return {
    ...base,
    scenery: { props: CAMPUS_KEYWORDS[key], night: true },
    rule: blackout ? { ...MAP_RULES.lunar_eclipse, zones: [], pads: [] } : null,
    look: blackout ? { blackout: true } : null,
  };
}

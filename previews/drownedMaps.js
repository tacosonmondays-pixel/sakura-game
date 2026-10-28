// Preview fixtures for the Gate Arc Step 5 looks (S5a, previews/drowned.html): the flooded platform with
// the subway spawn at a bore's mouth, the Line 2 tunnels in a blackout, the pump station with the Noon
// Gate and two steam valves, and the reservoir park at night round the willow. NOT game data: nothing in
// src/ imports this file, these boards are never in src/data/maps.js MAPS or STAGES (both feed the
// co-op data hash and the sim id), and vite.config.js builds no previews/ input. The real Act 5 maps
// (5-6…5-10) arrive with Gate Arc Step 5 S5b.
//
// Rows use the usual legend (src/data/maps.js): '.' ground (buildable), ',' verge, 'T' tree, 'H'
// building (border H = a wall: the Drowned Line's retaining walls), '~' water. The Step 5 render
// fields these boards carry (CONTRACTS.md, STEP5_BUILD_PLAN §3):
//   theme: 'drowned'                          MapDef: the Drowned Line (themes.THEMES.drowned)
//   district: 'park'                          MapDef: the reservoir park on a `city` map
//   { inside: true, nodes: [start, IN, …] }   path spec: a lane that opens in a tunnel (the subway
//                                             spawn: the seam glows at the OUT mouth, no run-out)
//   city.spawnGate: 'noonGate'                MapDef: the Noon Gate is the spawn gate (5-8)
//   decor { type: 'greatWillow', s }          MapDef: the great willow (a big tree takes its decor `s`)
//   look: { blackout: true }                  StageDef: the lamps dim while the rule is ACTIVE (5-7)
//   scenery.fog / .night                      StageDef: fog on every drowned stage; 5-10 at night
//   scenery.props: 'floodedPlatform', 'line2Cuttings', 'pumpStation', 'noonGateFrost', 'emergencyLights',
//     'steamValves', 'reservoirDam', 'reservoirWillow', 'searchBoats', …   (src/render/terrain.js SCENERY)
//   rule.zones (forge_vents)                  StageDef rule: the steam valves stand beside each zone
import { LINE, TUNNEL_IN, TUNNEL_OUT } from '../src/core/track.js';
import { MAP_RULES } from '../src/data/rules.js';
import { ENEMY_MAP } from '../src/data/enemies.js';
import { street, fixtureStage } from './cityMaps.js';
import { defineStep3Fixture } from './oldTownMaps.js';

const L = LINE;
const IN = TUNNEL_IN;
const OUT = TUNNEL_OUT;

// ---------------------------------------------------------------------------
// (a) The flooded platform (5-6's look): the lane opens inside the bore under the portal block (east,
// rows 6-8) and comes out of its mouth mid-board, runs west along the platform deck over the flooded
// track bed, climbs the station stairs at x 3.5 and runs east along the street to the exit. The
// station block between, retaining walls along the south.
// ---------------------------------------------------------------------------
const platform = defineStep3Fixture({
  id: 'fixture_drowned_platform',
  name: 'Flooded Platform',
  theme: 'drowned',
  desc: 'Preview board: out of the bore mid-board, west along the platform over the flooded tracks, up the stairs and east along the street.',
  rows: [
    'HHHHHHHHHHHHHHHHHHHH',
    'H..................H',
    'H..................H',
    'H.....HHHHHHHHHHH..H',
    'H.....HHHHHHHHHHH..H',
    'H..................H',
    'H...~~~~~~~~~~~HHHHH',
    'H...~~~~~~~~~~~HHHHH',
    'H...~~~~~~~~~~~HHHHH',
    'H.......,..........H',
    'HHHHHHHHHHHHHHHHHHHH',
    'HHHHHHHHHHHHHHHHHHHH',
  ],
  paths: [{ inside: true, nodes: street([[17.4, 7.5], [3.5, 7.5], [3.5, 2.5], [21, 2.5]], { r: 1.8, tunnel: [[17.3, 7.5], [14.6, 7.5]] }) }],
  crossings: 'bridge',
  decor: [],
  city: {},
});

// ---------------------------------------------------------------------------
// (b) The Line 2 tunnels (5-7's look, in a blackout): one gentle sag across the board through four
// bores under the blocks, three open cuttings between them, flooded cuttings and a drain.
// ---------------------------------------------------------------------------
const tunnels = defineStep3Fixture({
  id: 'fixture_drowned_tunnels',
  name: 'Line 2 Tunnels',
  theme: 'drowned',
  desc: 'Preview board: a dashed line of four bores and three open cuttings; the lights fail with the rule.',
  rows: [
    'HHHHHHHHHHHHHHHHHHHH',
    'HHHHHH...........HHH',
    'HHHHHH..........HHHH',
    'HHHHHH..~.......HHHH',
    'H.....HHHH..HHH.HHHH',
    'H.~...HHHH..HHH~...H',
    'H.~...HHHH~.HHH~...H',
    'H.....HHHH~.HHH....H',
    'H..........,.......H',
    'H...~~.........~~..H',
    'H~~~~~~~~~~~~~~~~~~H',
    'HHHHHHHHHHHHHHHHHHHH',
  ],
  paths: [
    [[-1, 2.5], L, [0.6, 2.5], IN, L, [4.4, 2.5], OUT, [5.8, 3.1], [6.8, 4.4], IN, [7.6, 6.2], [8.8, 7.6], OUT, [10.6, 8.2], [12.2, 7.6], IN, [13.4, 6.2], [14.4, 4.6], OUT, [15.6, 3.6], [17.0, 3.2], IN, L, [19.0, 3.2], OUT, L, [21, 3.2]],
  ],
  crossings: 'bridge',
  decor: [],
  city: {},
});

// ---------------------------------------------------------------------------
// (c) The pump station (5-8's look): out of the Noon Gate on the north edge, south past the pumps,
// east along the sump, north through the pump hall (a tunnel), west over its own first leg on the pipe
// gantry, then south and out west. Two steam valves at the vent zones on the road.
// ---------------------------------------------------------------------------
const pumps = defineStep3Fixture({
  id: 'fixture_drowned_pumps',
  name: 'Pump Station',
  theme: 'drowned',
  desc: 'Preview board: out of the Noon Gate, round the sump, through the pump hall and back over the first leg on the pipe gantry.',
  rows: [
    'HHHHHHHHH.HHHHHHHHHH',
    'H..................H',
    'H..................H',
    'H..................H',
    'H....HH.....HH.....H',
    'H....HH....~~~~HHH.H',
    'H..........~~~~HHH.H',
    '...........~~~~....H',
    'H..........~~~~....H',
    'H~~~~~.............H',
    'H~~~~~.............H',
    'HHHHHHHHHHHHHHHHHHHH',
  ],
  paths: [street([[9.5, -1], [9.5, 9.5], [16.5, 9.5], [16.5, 3.0], [2.5, 3.0], [2.5, 7.5], [-1, 7.5]], { r: 1.8, tunnel: [[16.5, 7.4], [16.5, 5.4]] })],
  crossings: 'bridge',
  decor: [],
  city: { spawnGate: 'noonGate' },
});

/** The pump station's two vent zones on the road (the stage rule's, forge_vents: the steam valves). */
export const PUMP_ZONES = [{ x: 9.5, y: 6.5, r: 1.6 }, { x: 13.0, y: 9.5, r: 1.6 }];

// ---------------------------------------------------------------------------
// (d) The reservoir park round the willow (5-10's look, at night in fog; `?night=0` the park by day,
// 5-9's look): two lanes curling round the willow's island from two dam causeways, never crossing.
// The ground is drawn from the lanes: land along them and round the island, the reservoir elsewhere,
// the dam walls in the north-west and south-east corners.
// ---------------------------------------------------------------------------
const WILLOW_LANES = [
  [[-1, 1.5], [2.5, 1.7], [6.0, 2.5], [9.0, 3.1], [11.8, 3.6], [13.4, 4.8], [13.8, 6.6], [15.6, 7.4], [18.0, 7.5], L, [21, 7.5]],
  [[21, 10.5], [17.5, 10.3], [14.0, 9.4], [11.0, 8.9], [8.2, 8.4], [6.6, 7.2], [6.2, 5.4], [4.4, 4.6], [2.0, 4.5], L, [-1, 4.5]],
];

/** Land along the lanes and round the island, water elsewhere, the two dam walls (a board drawn from its lanes). */
function willowRows() {
  const pts = WILLOW_LANES.map((lane) => lane.filter((p) => Array.isArray(p)));
  const segDist = (x, y, [ax, ay], [bx, by]) => {
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(x - ax - dx * t, y - ay - dy * t);
  };
  const rows = [];
  for (let y = 0; y < 12; y++) {
    let r = '';
    for (let x = 0; x < 20; x++) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      let d = Infinity;
      for (const lane of pts) for (let i = 1; i < lane.length; i++) d = Math.min(d, segDist(cx, cy, lane[i - 1], lane[i]));
      const isle = Math.hypot(cx - 10, cy - 6);
      if ((x <= 4 && y === 0) || (x >= 15 && y === 11)) r += 'H';
      else if (isle < 1.9) r += isle < 1.0 ? '.' : ',';
      else if (d < 1.15) r += '.';
      else r += '~';
    }
    rows.push(r);
  }
  return rows;
}

const willow = defineStep3Fixture({
  id: 'fixture_park_willow',
  name: 'The Reservoir Willow',
  theme: 'city',
  district: 'park',
  desc: 'Preview board: two lanes from the two dams curl round the willow\'s island in the reservoir; they never cross.',
  rows: willowRows(),
  paths: WILLOW_LANES,
  crossings: 'bridge',
  decor: [{ type: 'greatWillow', x: 10, y: 6, s: 1.25 }],
  city: {},
});

/** Variant key (preview URL) → fixture map. */
export const DROWNED_FIXTURES = { platform, tunnels, pumps, willow };

/** The scenery keywords each fixture's preview stage dresses its board with (src/render/terrain.js SCENERY). */
export const DROWNED_KEYWORDS = {
  platform: ['floodedPlatform'],
  tunnels: ['line2Cuttings'],
  pumps: ['pumpStation', 'noonGateFrost', 'emergencyLights'],
  willow: ['reservoirWillow', 'searchBoats'],
  // (the park by day in fog: 5-9's dressing on the same board)
  willowDay: ['reservoirDam', 'searchBoats'],
};

/**
 * Stand-ins for the three Vesperline machines (Gate Arc S5c ships the real defs in src/data/enemies.js):
 * the construct numbers they stand in for, on the shipped construct GLB (cogling, sentry), in the
 * plan's white glass and cyan with outlines. Their ids are what the render keys on (the fall style).
 * Preview only.
 */
export const FIXTURE_VESPER = (() => {
  const make = (id, name, baseId, o) => {
    const base = ENEMY_MAP[baseId] || {};
    return { ...base, id, name, family: 'construct', traits: {}, ...o, model: { base: 'construct', variant: o.variant, props: o.props } };
  };
  return {
    vesper_patrol_orb: make('vesper_patrol_orb', 'Patrol Orb', 'construct_cogling', { color: '#f2f7fb', accent: '#3fd0e8', line: '#1f3b4d', size: 0.75, variant: 'cogling', props: ['gears'] }),
    vesper_halo_drone: make('vesper_halo_drone', 'Halo Drone', 'construct_cogling', { color: '#17607a', accent: '#7ff0ff', line: '#e9fbff', size: 0.72, variant: 'cogling', props: ['crystals'] }),
    vesper_line_sentry: make('vesper_line_sentry', 'Line Sentry', 'construct_sentry', { color: '#e9f1f6', accent: '#2ec4e6', line: '#1f3b4d', size: 1.05, variant: 'sentry', props: ['gears'] }),
  };
})();

/**
 * A stage to run a fixture in the real Sim: an existing chapter-5 stage's waves on the fixture board,
 * fog on every board, the Step 5 keywords, the tunnels' blackout (lunar_eclipse, look.blackout), the
 * pump station's vents (forge_vents with two zones), the willow at night (`night: false`: the park by
 * day, 5-9's look). Never added to STAGES.
 * @param {object} map a DROWNED_FIXTURES board
 * @param {{ night?: boolean }} [o]
 */
export function drownedStage(map, { night = true } = {}) {
  const key = Object.keys(DROWNED_FIXTURES).find((k) => DROWNED_FIXTURES[k] === map) || 'platform';
  const base = fixtureStage(map, '5-3');
  const day = key === 'willow' && !night;
  return {
    ...base,
    scenery: { props: DROWNED_KEYWORDS[day ? 'willowDay' : key], fog: true, ...(key === 'willow' && night ? { night: true } : {}) },
    look: key === 'tunnels' ? { blackout: true } : null,
    rule: key === 'tunnels' ? { ...MAP_RULES.lunar_eclipse, zones: [], pads: [] }
      : key === 'pumps' ? { ...MAP_RULES.forge_vents, zones: PUMP_ZONES.map((z) => ({ ...z })), pads: [] }
        : null,
  };
}

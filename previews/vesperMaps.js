// Preview fixtures for the Gate Arc Step 6 looks (S6a, previews/vesper.html): Vesperline frozen (theme 'vesper' with
// `scenery.ruined: 'frozen'`) on seven boards: the causeway with two light-bridges and three prism batteries, the
// sky-rail with a hand-written viaduct span (S6v not needed) and an under-crossing, the museum in a blackout, the
// tower ring with transit pads, the Spindle's foot with the Vesper Gate, the Starfall Deck at night, and one LIVING
// board (morning, cherry courtyards). NOT game data: nothing in src/ imports this file, these boards are never in
// src/data/maps.js MAPS or STAGES (both feed the co-op data hash and the sim id), and vite.config.js builds no
// previews/ input. The real Act 6 maps (6-6…6-10, the side map) arrive with Gate Arc Step 6 S6b.
//
// Rows use the usual legend (src/data/maps.js): '.' ground (buildable), ',' verge, 'T' tree, 'H' building, '~' water.
// The Step 6 render fields these boards carry (CONTRACTS.md, STEP6_BUILD_PLAN §3), for S6b / S6c to set:
//   theme: 'vesper'                          MapDef: Vesperline (themes.THEMES.vesper; the living city)
//   scenery.ruined: 'frozen'                 StageDef: the frozen table (themes.FROZEN) on every Act 6 stage
//   city: { spawnGate: 'vesperGate' }        MapDef: the Vesper Gate (6-10); else the theme's sentry bay
//   bridge: { skyRail: true }                MapDef: the sky-rail girder look on raised runs (6-7); water decks and
//                                            overpasses are the theme's glass light-bridge by default
//   track.viaducts: [[a, b]]                 Track (S6v, src/core/track.js): the viaduct spans (distances); this file
//                                            writes them by hand with the S6v profile (viaduct below)
//   decor { type: 'spindle', variant: 0, r } MapDef: the Spindle's foot on the board (decor `variant` and `r`)
//   decor { type: 'doorieStatue' }           MapDef: Doorie in the museum rotunda (any vesperProps type may be decor)
//   look: { blackout: true }                 StageDef: the holo signs and exhibits go dark while the rule is ACTIVE
//   scenery.night                            StageDef: the Starfall Deck at night
//   scenery.props: 'frostCauseway', 'prismBatteries', 'skyRailViaduct', 'frozenCanal', 'museumWings',
//     'doorieStatue', 'reflectingPools', 'towerRing', 'transitPads', 'cleaningRobot', 'spindleFoot',
//     'vesperTerminal', 'frozenNest', 'warmWindow', 'starDome', 'coldAurora', 'holoSigns', 'frostHaze'
//     (src/render/terrain.js SCENERY)
//   rule.pads (prism_conduits)               StageDef rule: the prism batteries stand round each pad
//   rule shifting_stars                      the transit pads at `at` and `at + jump` (render: RuleDecals `transit`)
import { LINE, TUNNEL_IN, TUNNEL_OUT, arc, spiral, BRIDGE_HEIGHT, BRIDGE_RAMP, elevationAt } from '../src/core/track.js';
import { MAP_RULES } from '../src/data/rules.js';
import { ENEMY_MAP } from '../src/data/enemies.js';
import { street, defineFixtureMap, fixtureStage } from './cityMaps.js';

const L = LINE;
const IN = TUNNEL_IN;
const OUT = TUNNEL_OUT;

/** Rows from a per-tile rule (x, y) → char. */
function rowsOf(w, h, fn) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) r += fn(x, y);
    rows.push(r);
  }
  return rows;
}

/** S6v's ramp (STEP6_BUILD_PLAN §4): the shipped smoothstep over BRIDGE_RAMP, 0 at the foot, 1 on the top. */
function ramp(u) {
  if (u <= 0) return 0;
  if (u >= BRIDGE_RAMP) return 1;
  const t = u / BRIDGE_RAMP;
  return t * t * (3 - 2 * t);
}

/**
 * Writes a viaduct by hand onto a fixture track, the way S6v's `buildTrack` / `applyCrossings` will (§4):
 * `track.viaducts = [[a, b]]` and `elev(d) = BRIDGE_HEIGHT × ramp(d − a) × ramp(b − d)` on [a, b] (kept with any
 * overpass profile already there). The fixture's crossing under the span is authored 'bridgeUnder' so the viaduct
 * pass is `over` and the ground pass already has its `under` span. Preview only.
 */
export function viaduct(map, pathIndex, a, b) {
  const t = map.tracks[pathIndex];
  t.viaducts = [[a, b]];
  if (!t.elev) t.elev = new Array(t.points.length).fill(0);
  for (let i = 0; i < t.points.length; i++) {
    const d = t.cum[i];
    if (d < a || d > b) continue;
    t.elev[i] = Math.max(t.elev[i], Math.round(BRIDGE_HEIGHT * ramp(d - a) * ramp(b - d) * 1e4) / 1e4);
  }
  return map;
}

// (a) The causeway (6-6's look): west to east over the frozen lake, the causeway broken twice by open leads (two
// light-bridges), three prism batteries on the islands, the city gate's lecture halls at the east end.
const causeway = defineFixtureMap({
  id: 'fixture_vesper_causeway',
  name: 'Frost Causeway',
  theme: 'vesper',
  desc: 'Preview board: over the frozen lake on a causeway broken by two open leads, mended with light-bridges.',
  rows: rowsOf(20, 12, (x, y) => {
    if (x >= 5 && x <= 7) return '~';
    if (x >= 13 && x <= 14) return '~';
    if (y === 0 && x < 12) return '~';
    if ((x >= 17 && (y === 2 || y === 3)) || (x >= 16 && y >= 10)) return 'H';
    return '.';
  }),
  paths: [[[-1, 6.0], L, [1.5, 6.0], [3.6, 7.0], [5.4, 8.4], [7.4, 8.6], [9.4, 7.2], [11.0, 5.4], [13.0, 4.8], [15.2, 5.6], [17.0, 6.8], [18.6, 7.0], L, [21, 7.0]]],
  crossings: 'bridge',
  decor: [],
  city: {},
});
const CAUSEWAY_PADS = [{ x: 2.5, y: 4.0, r: 0.9 }, { x: 10.5, y: 9.5, r: 0.9 }, { x: 16.5, y: 4.5, r: 0.9 }];

// (b) The sky-rail (6-7's look): in from the west straight up onto the rail (a viaduct of ≈ 11 tiles along row 3.5),
// a hook down the east side, back west along row 8 and north again UNDER its own viaduct at (10.5, 3.5), out north.
// The frozen canal along rows 5-6. `map.bridge.skyRail`: the box girder on single pylons.
const skyrail = viaduct(defineFixtureMap({
  id: 'fixture_vesper_skyrail',
  name: 'Sky-Rail Viaduct',
  theme: 'vesper',
  desc: 'Preview board: up onto the sky-rail, round the hook and back underneath its own viaduct.',
  rows: rowsOf(22, 12, (x, y) => {
    if ((y === 5 || y === 6) && x >= 1 && x <= 15) return '~';
    if (y >= 10 && x >= 14) return 'H';
    if (y === 1 && x >= 13 && x <= 16) return 'H';
    return '.';
  }),
  paths: [street([[-1, 3.5], [17.5, 3.5], [17.5, 8.5], [10.5, 8.5], [10.5, -1]], { r: 1.6 })],
  crossings: 'bridgeUnder',
  decor: [],
  city: {},
}), 0, 4.0, 15.4);
skyrail.bridge = { skyRail: true };

// (c) The museum (6-8's look, in a blackout): in from the forecourt east through the east wing (a gallery tunnel),
// half round the rotunda (Doorie on her plinth among the reflecting pools), through the west wing, out west.
const museum = defineFixtureMap({
  id: 'fixture_vesper_museum',
  name: 'Museum of Noon',
  theme: 'vesper',
  desc: 'Preview board: through the east wing, half round the rotunda and Doorie, through the west wing.',
  rows: rowsOf(20, 12, (x, y) => {
    if (y >= 8 && y <= 10 && ((x >= 14 && x <= 17) || (x >= 3 && x <= 5))) return 'H';
    if (x === 10 && y === 6) return '.';
    if (x >= 8 && x <= 12 && y >= 5 && y <= 7) return '~';
    return '.';
  }),
  paths: [[[21, 9.0], L, [17.8, 9.0], IN, L, [14.6, 9.0], OUT, [13.4, 8.4], ...arc(10, 6.0, 3.4, 30, -210, 30).slice(1, -1), [6.6, 8.2], [5.8, 9.0], IN, L, [3.4, 9.0], OUT, [2.4, 9.6], [1.6, 10.4], L, [-1, 10.4]]],
  crossings: 'bridge',
  decor: [{ type: 'doorieStatue', x: 10, y: 6, s: 1.3 }],
  city: {},
});

// (d) The tower ring (6-9's look): in from the south, round a lap of the ring past the lecture podiums, then east
// across the plaza over the ring's east side on a light-bridge; the transit pads at the rule's points.
const towers = defineFixtureMap({
  id: 'fixture_vesper_towers',
  name: 'Lecture Tower Ring',
  theme: 'vesper',
  desc: 'Preview board: a lap of the ring road between the lecture towers, out across the plaza; transit pads fire.',
  rows: rowsOf(20, 12, (x, y) => {
    if (x >= 9 && x <= 13 && y >= 4 && y <= 4) return 'H';
    if (x >= 17 && y >= 9) return '~';
    if (x === 18 && y >= 1 && y <= 4) return 'H';
    return '.';
  }),
  paths: [street([[4.5, 13], [4.5, 2.5], [15.5, 2.5], [15.5, 9.0], [7.5, 9.0], [7.5, 6.5], [21, 6.5]], { r: 1.6 })],
  crossings: 'bridge',
  decor: [],
  city: {},
});

// (e) The Spindle's foot (6-10's look): two columns out of the Vesper Gate's terminal on the north edge, round either
// side of the Spindle's foot in its ring moat, meeting before the shelter's door on the south edge.
const SPINDLE_AT = [11, 5];
const spindle = defineFixtureMap({
  id: 'fixture_vesper_spindle',
  name: "The Spindle's Foot",
  theme: 'vesper',
  desc: "Preview board: two columns out of the Vesper Gate round the Spindle's foot, meeting before the shelter.",
  rows: rowsOf(22, 12, (x, y) => {
    const d = Math.hypot(x - SPINDLE_AT[0], y - SPINDLE_AT[1]);
    if (x === SPINDLE_AT[0] && y === SPINDLE_AT[1]) return '.';
    if (d <= 2) return 'H';
    if (d > 2 && d <= 3.2) return '~';
    return '.';
  }),
  paths: [
    [[5.5, -1], L, [5.5, 1.0], [6.9, 2.8], [7.1, 5.2], [7.5, 7.6], [9.0, 9.4], [11.0, 10.4], L, [11.0, 13]],
    { nodes: [[16.5, -1], L, [16.5, 1.0], [15.1, 2.8], [14.9, 5.2], [14.5, 7.6], [13.0, 9.4], [11.6, 10.6]], join: { path: 0, at: [11.0, 11.4] } },
  ],
  crossings: 'bridge',
  decor: [{ type: 'spindle', x: SPINDLE_AT[0], y: SPINDLE_AT[1], r: 2, variant: 0 }],
  city: { spawnGate: 'vesperGate' },
});

// (f) The Starfall Deck (the side map's look, at night): in from the west, three quarters of the outer ring, a quarter
// turn inward over the star-map pool (a light-bridge), three quarters of the inner ring, out south through a tunnel
// under the outer ring. Meteor zones (forge_vents) on the ground road.
const STAR_C = [12.0, 5.8];
const starfall = defineFixtureMap({
  id: 'fixture_vesper_starfall',
  name: 'The Starfall Deck',
  theme: 'vesper',
  desc: 'Preview board: the observatory deck at night, round the orrery rings and out under the outer ring.',
  rows: rowsOf(20, 12, (x, y) => {
    const d = Math.hypot(x + 0.5 - STAR_C[0], y + 0.5 - STAR_C[1]);
    if (d >= 2.8 && d <= 3.7) return '~';
    return '.';
  }),
  paths: [[[-1, 9.4], L, [4.4, 9.4], [6.4, 8.6], ...arc(STAR_C[0], STAR_C[1], 4.6, 180, 450, 30), ...spiral(STAR_C[0], STAR_C[1], 4.6, 2.0, 450, 540, 30).slice(1), ...arc(STAR_C[0], STAR_C[1], 2.0, 540, 790, 30).slice(1), [11.0, 8.6], [10.6, 9.2], IN, L, [10.6, 11.8], OUT, L, [10.6, 13]]],
  crossings: 'bridge',
  decor: [],
  city: {},
});
const STAR_ZONES = [{ x: 16.6, y: 5.8, r: 1.4 }, { x: 12.0, y: 1.2, r: 1.4 }, { x: 3.0, y: 9.4, r: 1.4 }];

// (g) The living city (Arc 2's look, a fixture only): a morning lane between cherry courtyards, a pool, lecture halls.
const living = defineFixtureMap({
  id: 'fixture_vesper_living',
  name: 'Vesperline Morning',
  theme: 'vesper',
  desc: 'Preview board: the living city of glass on a bright morning, cherry trees in glass courtyards.',
  rows: rowsOf(20, 12, (x, y) => {
    if (x >= 8 && x <= 11 && y >= 7 && y <= 9) return '~';
    if ((x + y * 3) % 7 === 0 && y > 0 && y < 11 && x > 0 && x < 19) return 'T';
    if ((y === 1 || y === 10) && x >= 13 && x <= 17) return 'H';
    return '.';
  }),
  paths: [street([[-1, 4.5], [6.5, 4.5], [6.5, 10.5], [13.5, 10.5], [13.5, 4.5], [21, 4.5]], { r: 1.6 })],
  crossings: 'bridge',
  decor: [],
  city: {},
});

/** Variant key (preview URL) → fixture map. */
export const VESPER_FIXTURES = { causeway, skyrail, museum, towers, spindle, starfall, living };

/** The scenery keywords each fixture's preview stage dresses its board with (src/render/terrain.js SCENERY). */
export const VESPER_KEYWORDS = {
  causeway: ['frostCauseway', 'prismBatteries', 'holoSigns'],
  skyrail: ['skyRailViaduct', 'frozenCanal', 'frostHaze'],
  museum: ['museumWings', 'reflectingPools'],
  towers: ['towerRing', 'transitPads', 'cleaningRobot'],
  spindle: ['spindleFoot', 'frozenNest', 'warmWindow'],
  starfall: ['starDome'],
  living: ['holoSigns', 'cleaningRobot'],
};

/** The preview rules: their pads, zones and points. */
export const VESPER_RULE_SPOTS = { causewayPads: CAUSEWAY_PADS, starZones: STAR_ZONES };

/**
 * Stand-ins for the Step 6 machines and the Rime Wisp (S6c ships the real defs in src/data/enemies.js), on the
 * shipped GLBs with the plan's colours (STEP6_BUILD_PLAN decision 4), next to the three shipped Step 5 machines.
 * Their ids are what the render keys on (the fall styles). Preview only.
 */
export const FIXTURE_VESPER6 = (() => {
  const make = (id, name, baseId, o) => {
    const base = ENEMY_MAP[baseId] || {};
    const family = o.family || 'construct';
    return { ...base, id, name, family, traits: {}, ...o, model: { base: family, variant: o.variant, props: o.props } };
  };
  return {
    vesper_lattice_shell: make('vesper_lattice_shell', 'Lattice Shell', 'construct_shellback', { color: '#dbe9f2', accent: '#5fe1f2', line: '#1f3b4d', size: 1.0, variant: 'beetle', props: ['crystals'] }),
    vesper_aegis: make('vesper_aegis', 'Vesper Aegis', 'construct_aegis', { color: '#b9d6e6', accent: '#7ff0ff', line: '#14303f', size: 1.0, variant: 'automaton', props: ['shield', 'gears'] }),
    vesper_warden: make('vesper_warden', 'Vesper Warden', 'construct_warden', { color: '#eef5fa', accent: '#3fd0e8', line: '#1f3b4d', size: 1.45, variant: 'warden', props: ['crystals', 'shield'] }),
    vesper_gatekeeper: make('vesper_gatekeeper', 'Gatekeeper Unit 01', 'iron_colossus', { color: '#dfe8ee', accent: '#ffb347', line: '#1f3b4d', size: 2.5, hp: 3950, tier: 'miniboss', variant: 'colossus', props: ['crystals', 'gears', 'chimney'] }),
    rime_wisp: make('rime_wisp', 'Rime Wisp', 'ghost_wisp', { family: 'ghost', color: '#3d2f6b', accent: '#b9a8ff', line: '#e8e4ff', size: 0.62, variant: 'wisp', props: [] }),
  };
})();

/** The machines the preview's "Machines" button sends: the shipped Step 5 three and the Step 6 stand-ins. */
export const MACHINE_IDS = ['vesper_patrol_orb', 'vesper_halo_drone', 'vesper_line_sentry', 'vesper_lattice_shell', 'vesper_aegis', 'vesper_warden', 'rime_wisp', 'vesper_gatekeeper'];

/**
 * A stage to run a fixture in the real Sim: an existing chapter-6 stage's waves on the fixture board, frozen (the
 * living board excepted), the Step 6 keywords, the board's rule: the causeway's prism batteries (prism_conduits with
 * three pads), the sky-rail's frost haze (heat_mirage), the museum's blackout (lunar_eclipse, look.blackout), the
 * tower ring's transit pads (shifting_stars), the Starfall Deck's meteor zones (forge_vents) at night. Never in STAGES.
 * @param {string} key a VESPER_FIXTURES key
 */
export function vesperStage(key) {
  const map = VESPER_FIXTURES[key];
  const base = fixtureStage(map, '6-5');
  const living = key === 'living';
  const rule = key === 'causeway' ? { ...MAP_RULES.prism_conduits, pads: CAUSEWAY_PADS.map((p) => ({ ...p })), zones: [] }
    : key === 'skyrail' ? { ...MAP_RULES.heat_mirage, zones: [], pads: [] }
      : key === 'museum' ? { ...MAP_RULES.lunar_eclipse, zones: [], pads: [] }
        : key === 'towers' ? { ...MAP_RULES.shifting_stars, zones: [], pads: [] }
          : key === 'starfall' ? { ...MAP_RULES.forge_vents, zones: STAR_ZONES.map((z) => ({ ...z })), pads: [] }
            : null;
  return {
    ...base,
    scenery: { props: VESPER_KEYWORDS[key], ...(living ? {} : { ruined: 'frozen' }), ...(key === 'starfall' ? { night: true } : {}) },
    look: key === 'museum' ? { blackout: true } : null,
    rule,
  };
}

/** The viaduct span written on the sky-rail fixture (distances along its one lane), for tests. */
export const SKYRAIL_VIADUCT = Object.freeze([4.0, 15.4]);
export { elevationAt };

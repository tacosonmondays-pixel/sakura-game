// Fixture boards for the viaduct (Gate Arc Step 6 S6v, src/core/track.js RAISE / LOWER). NOT game
// data: nothing in src/ imports this file, these boards are never in src/data/maps.js MAPS or STAGES
// (both feed the co-op data hash and the sim id) and vite.config.js builds no previews/ input. The
// sim, lockstep and world tests run them until a real map raises a viaduct (6-7, S6b); S6a may draw
// them for the deck look.
//
// Authoring (the same shorthands maps.js uses): `UP` (= RAISE '^') after a point starts a viaduct
// there, `DOWN` (= LOWER 'v') after a later point ends it. Between them the road climbs a smooth
// VIADUCT_RAMP (1.3-tile) ramp to the overpass height (BRIDGE_HEIGHT 0.62), runs at that height and
// comes down the same ramp. A road that crosses under its flat top always passes under it, whatever
// `crossings` says.
import { LINE, RAISE, LOWER } from '../src/core/track.js';
import { defineMap } from '../src/data/maps.js';
import { STAGE_MAP } from '../src/data/stages.js';
import { MAP_RULES } from '../src/data/rules.js';

const L = LINE;
const UP = RAISE;
const DOWN = LOWER;

/**
 * Sky-rail test board (16×10): in from the north, up onto a straight viaduct running south-east
 * across the board (≈ 9.9 tiles foot to foot), down at its far end, a hook back up the east side and
 * west along row 5 UNDER the viaduct's flat top at (8.5, 5.0) (45°), out on the west edge.
 * `crossings: 'flat'` is authored on purpose: the viaduct rule overrides it (bridge, viaduct over).
 */
export const VIADUCT_FIXTURE = defineMap({
  id: 'fixture_viaduct',
  name: 'Viaduct Test Board',
  theme: 'sakura',
  tier: 'beginner',
  rows: [
    '..T.............',
    '................',
    '..........T.....',
    '................',
    '................',
    '................',
    '..~~~...........',
    '..~~~.......T...',
    '................',
    '.....T..........',
  ],
  paths: [
    [[3.5, -1], L, [3.5, 0.2], [5, 1.5], UP, L, [12, 8.5], DOWN, [13.5, 9.2], [14.8, 8.2], [14.6, 6.2], [13.2, 5.0], L, [-1, 5.0]],
  ],
  crossings: 'flat',
  decor: [],
  desc: 'Viaduct fixture (tests only).',
  concept: 'fixture viaduct',
});

/** The fixture's one crossing: the viaduct over the row-5 return. */
export const VIADUCT_CROSSING = VIADUCT_FIXTURE.crossings[0];

/**
 * A stage to run the fixture in the real Sim (`new Sim({ data: { stage, map } })`) or a CoopSim
 * (`createCoopSim(start, { stage })` with the map registered in the sim's data source): an Act I
 * stage's waves on the fixture board. `vents` adds a forge_vents rule with those zones. Never in
 * STAGES.
 */
export function viaductStage({ baseId = '1-3', vents = null } = {}) {
  const base = STAGE_MAP[baseId];
  return {
    ...base,
    id: 'fixture:viaduct',
    name: VIADUCT_FIXTURE.name,
    mapId: VIADUCT_FIXTURE.id,
    introduces: [],
    rule: vents ? { ...MAP_RULES.forge_vents, zones: vents } : null,
  };
}

// Preview fixtures for the Gate Arc Step 4 looks (S4a, previews/highway.html): the toll plaza on the
// mountain highway (frost), Azami's checkpoint at dusk with the barrier arm on a lane schedule, the
// tunnel mouth under snow, and a frozen village of the far north on the Morning's `snow` theme. NOT
// game data: nothing in src/ imports this file, these boards are never in src/data/maps.js MAPS or
// STAGES (both feed the co-op data hash and the sim id), and vite.config.js builds no previews/
// input. The real Act 4 maps (4-6…4-10) arrive with Gate Arc Step 4 S4b.
//
// Rows use the usual legend (src/data/maps.js): '.' ground (buildable), ',' verge, 'T' tree, 'H'
// building (border H = a wall: the highway's sound walls), '~' water, 'U' a roof girls stand on (on
// the highway: a toll canopy over a booth island). The Step 4 render fields these boards carry
// (CONTRACTS.md §4, §9):
//   district: 'highway'                      MapDef: the highway district on a `city` map
//   city.barriers: [{ lane, at? }]           MapDef: a checkpoint barrier arm across `lane` (4-7)
//   city.snowRows                            MapDef: how many north rows the snow covers (default 5)
//   look: { dusk: true }                     StageDef: the dusk light (4-7)
//   scenery.props: 'frost', 'snowCover', 'tollPlaza', 'checkpoint', 'tunnelPortals', 'beachhead',
//     'frozenVillage', 'villageHearths', 'snowBridge', 'vastShadow', …   (src/render/terrain.js SCENERY)
import { LINE, TUNNEL_IN, TUNNEL_OUT } from '../src/core/track.js';
import { MAP_RULES } from '../src/data/rules.js';
import { ENEMY_MAP } from '../src/data/enemies.js';
import { defineFixtureMap, fixtureStage } from './cityMaps.js';

const L = LINE;
const IN = TUNNEL_IN;
const OUT = TUNNEL_OUT;

/** defineFixtureMap plus `district`, carried the way src/data/maps.js defineMap carries it. */
function defineStep4Fixture(o) {
  const map = defineFixtureMap(o);
  if (o.district) map.district = o.district;
  return map;
}

// ---------------------------------------------------------------------------
// (a) The toll plaza (4-6's look): down off the pass from the north-east, the road fans into three
// toll lanes round two booth islands (toll canopies on 'U' tiles) and merges again past them, then
// swings down the off-ramp to the south-west. Frost on the rails, a pond by the depot.
// ---------------------------------------------------------------------------
const tolls = defineStep4Fixture({
  id: 'fixture_highway_tolls',
  name: 'Toll Plaza',
  theme: 'city',
  district: 'highway',
  desc: 'Preview board: off the pass from the north-east, three toll lanes round two booth islands, merging again before the off-ramp to the south-west.',
  rows: [
    'HHHHHHHHHHHHHHHHHHHHHH',
    'H.....................',
    'H..HH................H',
    'H..HH.........,......H',
    'H.........UUU......HHH',
    '.....................H',
    '..........UUU........H',
    'H....HH..............H',
    'H....HH.........~~~..H',
    'H..............~~~~..H',
    '...............~~~...H',
    'HHHHHHHHHHHHHHHHHHHHHH',
  ],
  paths: [
    [[23, 1.5], L, [21.0, 1.5], [19.7, 2.2], [19.0, 3.6], [18.4, 5.0], [17.2, 5.5], L, [7.4, 5.5], [5.6, 5.8], [4.0, 6.8], [2.8, 8.4], [1.6, 9.9], [0.2, 10.5], L, [-1, 10.5]],
    { fork: { path: 0, at: [16.0, 5.5] }, nodes: [[14.6, 4.5], [13.4, 3.3], L, [9.4, 3.3], [8.2, 4.3]], join: { path: 0, at: [7.0, 5.5] } },
    { fork: { path: 0, at: [13.6, 5.5] }, nodes: [[12.6, 6.6], [11.6, 7.6], L, [9.2, 7.6], [7.6, 7.0]], join: { path: 0, at: [5.0, 6.0] } },
  ],
  crossings: 'flat',
  decor: [],
  city: { drones: true },
});

// ---------------------------------------------------------------------------
// (b) Azami's checkpoint (4-7's gimmick, mirrored from 1-9): in from the pass in the north; the
// short lane runs straight down through the checkpoint barrier, the long lane snakes west round two
// barricade blocks in two S-bends and rejoins it before the exit. The stage shuts the barrier on odd
// waves (laneCycle [[1], [0, 1]]): the arm comes down and the column walks the chicane. Dusk.
// ---------------------------------------------------------------------------
const checkpoint = defineStep4Fixture({
  id: 'fixture_highway_checkpoint',
  name: 'The Checkpoint',
  theme: 'city',
  district: 'highway',
  desc: 'Preview board: the straight lane through the checkpoint barrier, the long lane a chicane round two barricade blocks; the barrier is down on odd waves.',
  rows: [
    'HHHHHHHHHHHHH.HHHHHH',
    'H............,....,H',
    'H.................~H',
    'H..HH.............~H',
    'H.......HHH.......~H',
    'H.......HHH.......~H',
    'H.................~H',
    'H..HH.............~H',
    'H~~......HH.......~H',
    'H~~...............~H',
    'H.................~H',
    'HHHHHHHHHHHHH.HHHHHH',
  ],
  paths: [
    [[13.5, -1], L, [13.5, 13]],
    { fork: { path: 0, at: [13.5, 2.0] }, nodes: [[11.6, 2.7], [8.4, 3.0], [6.2, 4.2], [6.4, 6.0], [8.6, 6.8], [11.0, 7.4], [11.6, 8.6], [10.6, 9.6]], join: { path: 0, at: [13.5, 10.6] } },
  ],
  crossings: 'flat',
  decor: [],
  city: { barriers: [{ lane: 0 }] },
});

/** The checkpoint board's lane schedule: the straight (0) is shut on odd waves. */
export const CHECKPOINT_LANES = [[1], [0, 1]];

// ---------------------------------------------------------------------------
// (c) The tunnel mouth (4-8's look): two bores through the mountain on the north rows (snow on
// them), two carriageways out of them side by side with the central reservation between, a gentle
// shared S, two exits south; snow blows out of the bores; a stopped lorry; frost creeping south.
// ---------------------------------------------------------------------------
const tunnel = defineStep4Fixture({
  id: 'fixture_highway_tunnel',
  name: 'Tunnel Mouth',
  theme: 'city',
  district: 'highway',
  desc: 'Preview board: two highway bores through the snowy mountain, two carriageways south with the reservation between them.',
  rows: [
    'HHHHHHHHHHHHHHHHHHHH',
    'HHHHHHHHHHHHHHHHHHHH',
    'HHHHHHHHHHHHHHHHHHHH',
    'HHHHHHHHHHHHHHHHHHHH',
    'HHHHHHHHHHHHHHHHHHHH',
    'H..................H',
    '~~~................H',
    '~~~~.......,......~H',
    '~~~~..............~H',
    '~~~...............~H',
    '~~~...............~H',
    'HHHHHHHHHHHHHHHHHHHH',
  ],
  paths: [
    [[6.5, -1], L, [6.5, 0.4], IN, L, [6.5, 4.6], OUT, L, [6.5, 6.0], [7.1, 7.5], [8.1, 8.7], [8.5, 10.0], L, [8.5, 13]],
    [[12.5, -1], L, [12.5, 0.4], IN, L, [12.5, 4.6], OUT, L, [12.5, 6.0], [13.1, 7.5], [14.1, 8.7], [14.5, 10.0], L, [14.5, 13]],
  ],
  crossings: 'bridge',
  decor: [],
  city: { snowRows: 6.5 },
});

// ---------------------------------------------------------------------------
// (d) A frozen village of the far north (4-9 / 4-10's looks on the Morning's `snow`): the Brigade's
// sandbagged beachhead at the Petal Gate's mouth in the south, the old sled run north, a wide
// horseshoe round the village square with its three hearths (the stage rule's relay pads) and the
// hot spring, then east over the stream on the Brigade's folding bridge (the old stone bridge's
// piers beside it) and north past the cairn. Frozen huts, a fire going out, sleds, the vast shadow.
// ---------------------------------------------------------------------------
const north = defineStep4Fixture({
  id: 'fixture_north_village',
  name: 'The Frozen Village',
  theme: 'snow',
  desc: 'Preview board: up from the Petal Gate\'s north mouth, round the frozen village square and its three hearths, over the stream on the folding bridge and away north.',
  rows: [
    'TTTTTTTTTTTTTTTTTT.T',
    'T..................T',
    'T....H.......H.....T',
    'T..................~',
    'T.......H.....H...~~',
    '~~...............~~~',
    '~~........,.....~~~~',
    '~.......H...H......T',
    '~..................T',
    'T..HH...........HH.T',
    'T..................T',
    'TTTT.TTTTTTTTTTTTTTT',
  ],
  paths: [
    [[4.5, 13], L, [4.5, 6.8], [5.0, 4.0], [6.8, 2.2], [9.6, 1.5], [12.4, 1.6], [14.8, 2.6], [16.0, 4.6], [16.2, 6.8], [16.6, 8.4], [17.6, 8.9], [18.4, 8.0], L, [18.5, -1]],
  ],
  crossings: 'bridge',
  decor: [
    { type: 'hotSpring', x: 10, y: 5 },
  ],
  city: { spawnGate: 'petalRift' },
});

/** Variant key (preview URL) → fixture map. */
export const HIGHWAY_FIXTURES = { tolls, checkpoint, tunnel, north };

/** The scenery keywords each fixture's preview stage dresses its board with (src/render/terrain.js SCENERY). */
export const HIGHWAY_KEYWORDS = {
  tolls: ['tollPlaza', 'frost'],
  checkpoint: ['checkpoint'],
  tunnel: ['tunnelPortals', 'snowCover', 'frost'],
  north: ['beachhead', 'frozenVillage', 'villageHearths', 'brigadeCamp', 'snowBridge', 'passCairn', 'hostBanners', 'vastShadow', 'snowPines'],
};

/** The village board's three hearths: the relay pads of its preview rule (prism_conduits). */
export const NORTH_PADS = [{ x: 7.5, y: 4.2, r: 0.9 }, { x: 13.0, y: 4.0, r: 0.9 }, { x: 10.5, y: 8.2, r: 0.9 }];

/**
 * A stand-in for the Response Trooper (Gate Arc S4c ships the real def in src/data/enemies.js): the
 * orc grunt's numbers on the shipped construct GLB's sentry, Brigade navy with amber and the white
 * visor accent. Its id is what the render keys on (fall style, barks). Preview only.
 */
export const FIXTURE_TROOPER = (() => {
  const base = ENEMY_MAP.orc_grunt || {};
  return {
    ...base,
    id: 'brigade_trooper',
    name: 'Response Trooper',
    family: 'construct',
    size: 0.9,
    color: '#2b3a5c',
    accent: '#f4a62a',
    variant: 'sentry',
    props: ['helmet'],
    model: { base: 'construct', variant: 'sentry', props: ['helmet'] },
    lore: 'Signed up for floods and fires. Got a gate instead. Still says sorry.',
    traits: {},
  };
})();

/**
 * A stage to run a fixture in the real Sim: an existing chapter-4 stage's waves on the fixture
 * board, its Step 4 keywords, the checkpoint's lane schedule and dusk, the village's hearth pads.
 * Never added to STAGES.
 * @param {object} map a HIGHWAY_FIXTURES board
 */
export function highwayStage(map) {
  const key = Object.keys(HIGHWAY_FIXTURES).find((k) => HIGHWAY_FIXTURES[k] === map) || 'tolls';
  const base = fixtureStage(map, '4-3');
  return {
    ...base,
    scenery: { props: HIGHWAY_KEYWORDS[key] },
    ...(key === 'checkpoint' ? { waveGen: { ...base.waveGen, laneCycle: CHECKPOINT_LANES }, look: { dusk: true } } : { look: null }),
    rule: key === 'north' ? { ...MAP_RULES.prism_conduits, zones: [], pads: NORTH_PADS.map((p) => ({ ...p })) } : null,
  };
}

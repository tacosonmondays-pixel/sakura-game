// Builds the battlefield terrain from a MapDef (V2 "lively maps"):
//   • one hand-painted ground texture per map (colour mottling, clover, flower drifts, worn
//     dirt and pebbles beside the road, wet sand around water) — no tile grid,
//   • the road as a ribbon extruded along the map's canonical centreline (MapDef.tracks — the
//     same points the sim walks; softly wavy edges, bevelled sides, texture flowing along the
//     road), with flat junctions, raised overpasses, plank decks over water and buried tunnel
//     sections with portal arches (trackMesh.js),
//   • animated water / lava surfaces, auto lily pads,
//   • the map's composed set pieces, theme props, stage scenery keywords, a framing ring
//     (fences / hedges / flower beds / rocks) around the board with gaps for the road, and
//     a spawn gate + goal gate at every entrance / exit.
// Everything static is merged into a handful of meshes; glows, emitters and gates are
// returned for the ambient / FX layers.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildProp, hasProp } from './props.js';
import { makeRand, hash, placeMatrix } from './geo.js';
import { detailTexture, pathTexture, maskTexture, paintGround } from './textures.js';
import { planRoads, buildDecks, buildTunnels, WATER_CLEAR } from './trackMesh.js';
import { buildGroundFeatures } from './groundFeatures.js';
import { buildCity, cityBuildingFor, cityWallVariant, buildRoofs } from './city/cityKit.js';
import { riftPlacement, ROOF_Y } from './city/cityProps.js';
import { cityGroundPainter } from './city/cityGround.js';
import { burningLayer } from './city/ruinProps.js';
import { TEAR_REST } from './tear.js';
import { createFacadeMaterial, CityAcc } from './city/cityMaterials.js';
import { stampTracks, mapTracks } from '../core/track.js';

export const PATH_H = 0.05;
export const WATER_Y = 0.012;
/** Top of a rooftop ('U' tiles): where a girl standing on one stands (src/render/city/cityKit.js buildRoofs). */
export { ROOF_Y };
export const LAVA_Y = 0.01;
const MARGIN = 8;
/** Half width of the road slab in tiles (the sim's path tiles are 1 wide). */
export const ROAD_HALF = 0.46;
const ROAD_BEVEL = 0.11;

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ---------------------------------------------------------------------------
// Scenery keywords (stage.scenery.props + derived from stage.introduces)
// ---------------------------------------------------------------------------

/**
 * keyword → placement recipe. slot: pathside | skirt | grass | shore | water | entrance | nook
 * (a corner of an in-board tree / rock tile) | none; alt: a second slot filled once the first
 * runs out; face: turn the prop's +z front toward the camera (with a little jitter).
 */
export const SCENERY = {
  sakuraTrees: { prop: 'sakura', slot: 'skirt', n: 7, s: 1.1 },
  benches: { prop: 'bench', slot: 'skirt', n: 2 },
  stoneLanterns: { prop: 'stoneLantern', slot: 'pathside', n: 6, s: 0.62 },
  lanterns: { prop: 'lantern', slot: 'pathside', n: 8, s: 0.75 },
  paperLanterns: { prop: 'lantern', slot: 'pathside', n: 10, s: 0.75 },
  bridgeLanterns: { prop: 'bridgeLantern', slot: 'pathside', n: 6, s: 0.7 },
  moonBridges: { prop: 'bridgeLantern', slot: 'pathside', n: 6, s: 0.7 },
  spiritCandles: { prop: 'spiritCandle', slot: 'pathside', n: 10, s: 1 },
  candles: { prop: 'candle', slot: 'pathside', n: 8, s: 1 },
  incense: { prop: 'incense', slot: 'skirt', n: 3 },
  torii: { prop: 'torii', slot: 'entrance', n: 3 },
  shrineBells: { prop: 'bell', slot: 'skirt', n: 2 },
  stoneSteps: { prop: 'stoneLantern', slot: 'pathside', n: 4, s: 0.62 },
  racePennants: { prop: 'pennants', slot: 'skirt', n: 4 },
  royalBanners: { prop: 'banner', slot: 'pathside', n: 4, s: 0.75, variant: 2 },
  warBanners: { prop: 'banner', slot: 'pathside', n: 5, s: 0.75, variant: 0 },
  banners: { prop: 'banner', slot: 'skirt', n: 5, variant: 1 },
  goblinFlags: { prop: 'flag', slot: 'skirt', n: 4, variant: 3 },
  prayerFlags: { prop: 'pennants', slot: 'skirt', n: 4 },
  flags: { prop: 'flag', slot: 'skirt', n: 4 },
  kites: { prop: 'flag', slot: 'skirt', n: 3 },
  goblinSacks: { prop: 'sack', slot: 'skirt', n: 4 },
  slimePuddles: { prop: 'puddle', slot: 'grass', n: 6 },
  trampledFlowers: { prop: 'flowersPatch', slot: 'grass', n: 6 },
  wildflowers: { prop: 'flowersPatch', slot: 'grass', n: 9 },
  waterwheel: { prop: 'waterwheel', slot: 'shore', n: 1 },
  fountain: { prop: 'fountain', slot: 'skirt', n: 1 },
  reeds: { prop: 'reeds', slot: 'shore', n: 12 },
  lilyPads: { prop: 'lilyPad', slot: 'water', n: 12 },
  boats: { prop: 'boat', slot: 'water', n: 3 },
  festivalBoats: { prop: 'boat', slot: 'water', n: 4 },
  boardwalk: { prop: 'pier', slot: 'shore', n: 2 },
  lizardTotems: { prop: 'totem', slot: 'skirt', n: 4 },
  fishingNets: { prop: 'crate', slot: 'skirt', n: 3 },
  ferryPosts: { prop: 'pier', slot: 'shore', n: 2 },
  pier: { prop: 'pier', slot: 'shore', n: 2 },
  sunRocks: { prop: 'rock', slot: 'skirt', n: 5 },
  basiliskBones: { prop: 'bones', slot: 'skirt', n: 3 },
  bones: { prop: 'bones', slot: 'skirt', n: 3 },
  dragonBones: { prop: 'bones', slot: 'skirt', n: 4, s: 1.4 },
  sanctumDoors: { prop: 'statue', slot: 'skirt', n: 2 },
  samuraiArmor: { prop: 'statue', slot: 'skirt', n: 2 },
  pines: { prop: 'pine', slot: 'skirt', n: 8 },
  snowPines: { prop: 'snowPine', slot: 'skirt', n: 8 },
  palisade: { prop: 'palisade', slot: 'skirt', n: 6 },
  bastionWalls: { prop: 'palisade', slot: 'skirt', n: 6 },
  fortressGate: { prop: 'palisade', slot: 'skirt', n: 6 },
  siegeLadders: { prop: 'palisade', slot: 'skirt', n: 4 },
  ironPlates: { prop: 'barrel', slot: 'skirt', n: 3 },
  brokenShields: { prop: 'crate', slot: 'skirt', n: 3 },
  wolfDens: { prop: 'boulder', slot: 'skirt', n: 3 },
  snowdrifts: { prop: 'snowdrift', slot: 'grass', n: 6 },
  gorgeCliffs: { prop: 'cliff', slot: 'skirt', n: 6 },
  warCamp: { prop: 'tent', slot: 'skirt', n: 3 },
  deadTrees: { prop: 'dead', slot: 'skirt', n: 7 },
  willows: { prop: 'willow', slot: 'skirt', n: 4 },
  drownedWillow: { prop: 'willow', slot: 'shore', n: 3 },
  bogLights: { prop: 'bogLight', slot: 'pathside', n: 6, s: 1 },
  // Halloween event: carved jack-o'-lanterns tucked beside the board's trees / rocks (blocked
  // tiles, never the road or a build tile), the rest in the skirt; faces turned to the camera
  pumpkins: { prop: 'pumpkin', slot: 'nook', alt: 'skirt', n: 10, s: 1.3, face: true },
  seedPods: { prop: 'seedPod', slot: 'skirt', n: 5 },
  mushrooms: { prop: 'mushroom', slot: 'grass', n: 8 },
  thornBrambles: { prop: 'bramble', slot: 'skirt', n: 6 },
  graveStones: { prop: 'gravestone', slot: 'skirt', n: 7 },
  crypt: { prop: 'statue', slot: 'skirt', n: 2 },
  crystalClusters: { prop: 'crystal', slot: 'skirt', n: 5 },
  frozenFalls: { prop: 'crystal', slot: 'skirt', n: 3 },
  icicles: { prop: 'crystal', slot: 'skirt', n: 3 },
  gears: { prop: 'crate', slot: 'skirt', n: 3 },
  cogs: { prop: 'crate', slot: 'skirt', n: 2 },
  wrenches: { prop: 'crate', slot: 'skirt', n: 2 },
  crates: { prop: 'crate', slot: 'skirt', n: 3 },
  conveyors: { prop: 'crate', slot: 'skirt', n: 3 },
  pipes: { prop: 'pipes', slot: 'skirt', n: 4 },
  steamVents: { prop: 'vent', slot: 'skirt', n: 3 },
  barrierPylons: { prop: 'pylon', slot: 'pathside', n: 5, s: 0.8 },
  cranes: { prop: 'crane', slot: 'skirt', n: 2 },
  hangarDoors: { prop: 'machine', slot: 'skirt', n: 2 },
  powderKegs: { prop: 'barrel', slot: 'skirt', n: 4 },
  furnaces: { prop: 'machine', slot: 'skirt', n: 2 },
  forge: { prop: 'machine', slot: 'skirt', n: 2 },
  stalls: { prop: 'stall', slot: 'skirt', n: 4 },
  fireworks: { prop: 'fireworkPost', slot: 'skirt', n: 3 },
  taikoDrums: { prop: 'taiko', slot: 'skirt', n: 2 },
  tournamentStage: { prop: 'stands', slot: 'skirt', n: 3 },
  mirrors: { prop: 'mirror', slot: 'pathside', n: 4, s: 0.8 },
  prizeChests: { prop: 'chest', slot: 'skirt', n: 3 },
  coinChests: { prop: 'chest', slot: 'skirt', n: 3 },
  nests: { prop: 'nest', slot: 'skirt', n: 4 },
  dragonNest: { prop: 'nest', slot: 'skirt', n: 3, s: 1.6 },
  eggs: { prop: 'nest', slot: 'skirt', n: 2 },
  hotSprings: { prop: 'hotSpring', slot: 'skirt', n: 2 },
  lavaVents: { prop: 'vent', slot: 'skirt', n: 4 },
  obsidian: { prop: 'obsidian', slot: 'skirt', n: 4 },
  smoke: { prop: 'vent', slot: 'skirt', n: 2 },
  bookshelves: { prop: 'bookshelf', slot: 'skirt', n: 3 },
  runeStones: { prop: 'runeStone', slot: 'skirt', n: 5 },
  charms: { prop: 'runeStone', slot: 'pathside', n: 3, s: 0.7 },
  campfire: { prop: 'campfire', slot: 'skirt', n: 1 },
  ropeBridge: { prop: 'pennants', slot: 'skirt', n: 3 },
  moat: { prop: 'reeds', slot: 'shore', n: 6 },
  coolantCanal: { prop: 'pylon', slot: 'pathside', n: 3, s: 0.8 },
  bridges: { prop: 'bridgeLantern', slot: 'pathside', n: 4, s: 0.7 },
  koiPond: { ambient: 'koi' },
  mirrorPonds: { ambient: 'koi' },
  moonPond: { ambient: 'moon' },
  prismSparkles: { ambient: 'sparkles' },
  featherDrifts: { ambient: 'feathers' },
  // the city kit (Gate Arc, Noon `city` theme): street furniture beside the roads and in the skirt
  streetLamps: { prop: 'streetLamp', slot: 'pathside', n: 6 },
  trafficLights: { prop: 'trafficLight', slot: 'pathside', n: 3 },
  vendingMachines: { prop: 'vendingMachine', slot: 'grass', alt: 'skirt', n: 3, face: true },
  busStops: { prop: 'busStop', slot: 'pathside', n: 2 },
  parkedCars: { prop: 'parkedCar', slot: 'skirt', n: 5 },
  roadWorks: { prop: 'roadCone', slot: 'pathside', n: 5, s: 0.9 },
  streetBits: { prop: 'trashBin', slot: 'grass', n: 4, s: 0.9 },
  mailboxes: { prop: 'mailbox', slot: 'grass', n: 2 },
  bikeRacks: { prop: 'bikeRack', slot: 'grass', alt: 'skirt', n: 2, face: true },
  powerLines: { prop: 'powerPole', slot: 'skirt', n: 4 },
  strays: { prop: 'pigeonGroup', slot: 'grass', n: 3 },
  laundry: { prop: 'laundryLine', slot: 'skirt', n: 3, face: true },
  billboards: { prop: 'billboard', slot: 'skirt', n: 3, face: true },
  missingPosters: { prop: 'missingPoster', slot: 'grass', n: 2, face: true },
  // the campus kit (Gate Arc, Noon `campus` theme, src/render/city/campusProps.js); `props` cycles
  // through several props for one keyword
  schoolGrounds: { props: ['bikeShed', 'flagpole', 'bikeShed'], slot: 'skirt', n: 3, face: true },
  clubHuts: { prop: 'clubHut', slot: 'skirt', n: 3, face: true },
  rowingClub: { prop: 'boatRack', slot: 'grass', alt: 'skirt', n: 3, face: true },
  sportsField: { props: ['goalPosts', 'scoreboard', 'stands'], slot: 'skirt', n: 3, face: true },
  lakeLamps: { prop: 'streetLamp', slot: 'pathside', n: 6 },
  fireflies: { ambient: 'fireflies' },
  // Old Town (Gate Arc S3a, `district: 'oldtown'`, src/render/city/oldTownProps.js): the Bell
  // Festival's stalls and dressing; the lantern strings hang on the poles (the kit), cats sit on the
  // tiled roofs ('roof' slot: the outer corner of a rooftop, on its parapet)
  festivalStalls: { prop: 'griddleStall', slot: 'grass', alt: 'skirt', n: 3, face: true },
  ringToss: { prop: 'ringToss', slot: 'grass', alt: 'skirt', n: 1, face: true, variant: 0 },
  bowStage: { prop: 'bowStage', slot: 'skirt', n: 1, face: true, variant: 0 },
  shopCurtains: { prop: 'shopCurtain', slot: 'pathside', n: 4, variant: 0 },
  stoneBasins: { prop: 'stoneBasin', slot: 'grass', alt: 'skirt', n: 2, face: true, variant: 0 },
  festivalPoster: { prop: 'festivalPoster', slot: 'grass', alt: 'skirt', n: 1, face: true, variant: 0 },
  easel: { prop: 'easel', slot: 'grass', alt: 'skirt', n: 1, face: true, variant: 0 },
  roofCats: { prop: 'catOnWall', slot: 'roof', n: 2 },
  // the same streets burning (`scenery.ruined: 'burning'`, src/render/city/ruinProps.js): what is
  // left of what people loved, never anyone
  scorchedCurtains: { prop: 'shopCurtain', slot: 'pathside', n: 3, variant: 2 },
  posterFaceDown: { prop: 'festivalPoster', slot: 'grass', alt: 'skirt', n: 1, face: true, variant: 1 },
  easelFallen: { prop: 'easel', slot: 'grass', alt: 'skirt', n: 1, face: true, variant: 1 },
  dryBasins: { prop: 'stoneBasin', slot: 'grass', alt: 'skirt', n: 1, face: true, variant: 1 },
  rubbleHeaps: { prop: 'rubble', slot: 'grass', alt: 'skirt', n: 4 },
  burntCars: { prop: 'burntCar', slot: 'skirt', n: 3 },
  fallenPoles: { prop: 'fallenPole', slot: 'skirt', n: 2, variant: 0 },
  debrisScatter: { prop: 'debris', slot: 'grass', n: 4 },
  // the highway (Gate Arc S4a, `district: 'highway'`, src/render/city/highwayProps.js), the Brigade's
  // dressing (src/render/city/brigadeProps.js) and the far north (src/render/northProps.js). `also`
  // dresses the board with more keywords; `look` keywords only re-dress the look (themes.js) or are
  // drawn by code here. Slots of their own: 'span' (across a straight on-ground road: the gantries),
  // 'pad' (the stage rule's relay pads), 'deckside' (the water beside a deck, along the river),
  // 'gateside' / 'goalside' (beside the road just inside a spawn / goal gate), 'north' (the snowy rows).
  tollPlaza: { prop: 'tollBooth', slot: 'pathside', n: 4, s: 0.9, also: ['signGantries', 'restStops'] },
  signGantries: { prop: 'signGantry', slot: 'span', n: 2 },
  restStops: { prop: 'restStop', slot: 'skirt', n: 2, face: true },
  jerseyBarriers: { prop: 'jerseyBarrier', slot: 'pathside', n: 8, s: 0.9 },
  checkpoint: { prop: 'citationStand', slot: 'grass', alt: 'skirt', n: 1, face: true, variant: 0, also: ['jerseyBarriers', 'brigadeCamp'] },
  brigadeCamp: { props: ['brigadeTent', 'tortoiseVan', 'searchlightTower', 'brigadeTent', 'droneDock', 'tortoiseVan'], slot: 'skirt', n: 6, face: true },
  tunnelPortals: { prop: 'stoppedLorry', slot: 'skirt', n: 1, face: true },
  frost: { look: true },
  snowCover: { prop: 'snowdrift', slot: 'north', n: 6 },
  frozenVillage: { prop: 'frozenHut', slot: 'skirt', n: 5, face: true, also: ['villageBits'] },
  villageBits: { props: ['sled', 'dyingFire', 'sled'], slot: 'grass', alt: 'skirt', n: 3, face: true },
  villageHearths: { prop: 'villageHearth', slot: 'pad', n: 3, variant: 0 },
  beachhead: { props: ['sandbagPit', 'searchlightTower', 'sandbagPit'], variants: [0, 1, 1], slot: 'gateside', n: 3 },
  gateSandbags: { prop: 'sandbagPit', slot: 'goalside', n: 2, variant: 1 },
  hostBanners: { prop: 'warBanner', slot: 'pathside', n: 4, s: 0.8 },
  passCairn: { prop: 'passCairn', slot: 'grass', alt: 'skirt', n: 1, variant: 0 },
  snowBridge: { prop: 'stoneBridgePier', slot: 'deckside', n: 4 },
  vastShadow: { ambient: 'vastShadow' },
};

/** Prop types whose glows (sprites and glow geometry) a blackout never dims: the gates stay readable. */
const KEEP_LIT = new Set(['petalRift', 'shelterDoor', 'spawnGate', 'goalGate', 'toriiGate']);
/** Prop types whose glow geometry pulses with the rule (the tear over 3-10's sanctum: terrain.setTear). */
const TEAR_TYPES = new Set(['hammerTear']);

/** Per-map road surfaces (MapDef.city.road): the campus running track. */
const ROAD_STYLES = {
  track: { style: 'track', base: '#7a3428', side: '#7d5a50', plainJunction: false },
};

/** Trait / family → keyword that dresses the stage when that enemy is introduced. */
const INTRO_KEYWORDS = {
  veiled: 'lanterns', phasing: 'spiritCandles', airborne: 'nests', crystal: 'crystalClusters',
  barrier: 'barrierPylons', siphon: 'bogLights', blink: 'bogLights', field: 'paperLanterns',
  splitter: 'slimePuddles', sabotage: 'crates', hasty: 'racePennants', regen: 'reeds',
  brood: 'seedPods', summoner: 'graveStones', decoy: 'mirrors', enrage: 'wolfDens',
  guardian: 'warBanners', armored: 'warBanners', ward: 'runeStones', volatile: 'powderKegs',
};
const FAMILY_KEYWORDS = {
  slime: 'slimePuddles', goblin: 'goblinSacks', orc: 'warBanners', lizard: 'lizardTotems', ghost: 'spiritCandles',
  ghoul: 'graveStones', oni: 'paperLanterns', construct: 'crates', dragon: 'nests', beast: 'wolfDens',
  fae: 'mirrors', plant: 'seedPods',
};

/**
 * Resolves the stage's scenery: curated props first, then up to two keywords derived from
 * the enemies/traits the stage introduces (so new monsters change the scenery), plus
 * fog/night/weather flags.
 * @param {object|null} stage StageDef
 * @param {(id: string) => string|null} familyOf enemy id → family id
 */
export function resolveScenery(stage, familyOf = () => null) {
  const sc = stage?.scenery || {};
  const keywords = [...(sc.props || [])];
  const derived = [];
  let fog = !!sc.fog;
  for (const key of stage?.introduces || []) {
    let kw = INTRO_KEYWORDS[key];
    if (!kw) kw = FAMILY_KEYWORDS[familyOf(key)] || null;
    if (key === 'veiled') fog = true;
    if (kw && !keywords.includes(kw) && !derived.includes(kw)) derived.push(kw);
  }
  keywords.push(...derived.slice(0, 2));
  // (the stage rule's relay pads: the far north's village hearths stand round them, slot 'pad')
  const pads = (stage?.rule?.pads || []).map((p) => ({ x: p.x, y: p.y, r: p.r }));
  return { keywords, fog, night: !!sc.night, weather: sc.weather, ruined: sc.ruined || null, pads };
}

/**
 * Builds the terrain.
 * @param {object} map MapDef
 * @param {object} look resolved theme look
 * @param {{ keywords: string[] }} scenery
 * @param {{ quality?: string, shadows?: boolean }} opts
 */
export function buildTerrain(map, look, scenery, { shadows = false, quality = 'high', reverse = false } = {}) {
  // a map may restyle its bridges (e.g. a steel-grating overpass on a timber-deck theme)
  if (map.bridge) look = { ...look, bridge: { ...look.bridge, ...map.bridge } };
  // … its road surface (e.g. conveyor belts) and its tunnels (e.g. an ice cave)
  if (map.path) look = { ...look, path: { ...look.path, ...map.path } };
  if (map.tunnel) look = { ...look, tunnel: { ...look.tunnel, ...map.tunnel } };
  // … and a city map may pave its road differently (the campus running track: map.city.road)
  if (look.city && ROAD_STYLES[map.city?.road]) look = { ...look, path: { ...look.path, ...ROAD_STYLES[map.city.road] } };
  // composed ground features (tanks, icefalls, rune circles) + junction chevrons
  const features = buildGroundFeatures(map);
  const W = map.width;
  const H = map.height;
  const rows = map.rows;
  const rand = makeRand(hash(map.id, 'terrain'));
  const group = new THREE.Group();
  group.name = 'terrain';
  const disposables = [];
  const glows = [];
  const emitters = [];
  const ambient = new Set();
  const gates = [];

  // ----- roads: the canonical centrelines (MapDef.tracks), run out past the board ------
  const plan = planRoads(map, { margin: MARGIN });
  const pathSet = new Set([...stampTracks(mapTracks(map)), ...plan.extraTiles]);
  // Reverse Route (docs/specs/CODEX_MODES.md §8.4): the arches show this battle's usual start and
  // goal, so the road's exits become the entrances (travel direction turned round) and back
  const turn = (g) => ({ ...g, dir: [-g.dir[0], -g.dir[1]] });
  const entrances = reverse ? plan.exits.map(turn) : plan.entrances;
  const exits = reverse ? plan.entrances.map(turn) : plan.exits;
  const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  // centreline pieces for the painter (buried tunnel sections excluded)
  const roads = [];
  for (const r of plan.roads) {
    let cur = [];
    r.pts.forEach((p, i) => {
      if (r.tunnel[i]) {
        if (cur.length > 1) roads.push(cur);
        cur = [];
      } else cur.push(p);
    });
    if (cur.length > 1) roads.push(cur);
  }

  // ----- extended char grid ------------------------------------------------------
  const X0 = -MARGIN;
  const Y0 = -MARGIN;
  const EW = W + MARGIN * 2;
  const EH = H + MARGIN * 2;
  const charAt = (x, y) => {
    if (inMap(x, y)) return rows[y][x];
    const cx = Math.max(0, Math.min(W - 1, x));
    const cy = Math.max(0, Math.min(H - 1, y));
    const c = rows[cy][cx];
    if (c === '~' || c === 'B') return '~';
    return 'o'; // outside land
  };
  const isPath = (x, y) => pathSet.has(`${x},${y}`);
  const isWater = (x, y) => {
    if (x < X0 || y < Y0 || x >= X0 + EW || y >= Y0 + EH) return false;
    const c = charAt(x, y);
    return c === '~' || c === 'B';
  };
  const isLava = (x, y) => inMap(x, y) && rows[y][x] === 'X';
  const outsideDist = (x, y) => {
    const dx = Math.max(0, -x, x - W);
    const dy = Math.max(0, -y, y - H);
    return Math.sqrt(dx * dx + dy * dy);
  };

  const decorAt = new Map();
  for (const d of map.decor || []) decorAt.set(`${d.x},${d.y}`, d);

  // ----- colours ---------------------------------------------------------------------
  const cBg = new THREE.Color(look.bg);
  const cPath = new THREE.Color(look.path.color);
  const cPathSide = new THREE.Color(look.path.side);
  const cBridgeSide = new THREE.Color(look.bridge.post);
  const tmp = new THREE.Color();
  /** Fades colours outside the playable rectangle toward the background (soft vignette). */
  const fade = (col, x, z) => {
    const d = outsideDist(x, z);
    if (d <= 1.2) return col;
    const t = Math.min(1, (d - 1.2) / (MARGIN - 1.5));
    col.multiplyScalar(1 - 0.1 * t);
    return col.lerp(cBg, t * t * 0.85);
  };

  // ----- painted ground --------------------------------------------------------------------
  const px = quality === 'low' ? 20 : quality === 'medium' ? 26 : 32;
  const painted = paintGround({
    look, x0: X0, y0: Y0, w: EW, h: EH, charAt, isPath, isWater, roads, px, seed: hash(map.id, 'paint') % 100000,
    // the city kit paints planted verges and plazas on top (src/render/city/cityGround.js); snow
    // cover (Gate Arc 4-8) is painted over the north rows last
    extra: chainPainters(look.city ? cityGroundPainter(map, look, charAt, isPath) : null, look.snowCover ? snowCoverPainter(map, look, roads) : null),
  });
  disposables.push(painted.texture);
  const groundGeo = new THREE.PlaneGeometry(EW, EH, EW, EH);
  groundGeo.rotateX(-Math.PI / 2);
  groundGeo.translate(X0 + EW / 2, 0, Y0 + EH / 2);
  {
    const pos = groundGeo.attributes.position;
    const uv = groundGeo.attributes.uv;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      uv.setXY(i, (x - X0) / EW, 1 - (z - Y0) / EH);
      const c = fade(tmp.set('#ffffff'), x, z);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const detailTex = detailTexture(look.groundStyle || 'grass', hash(map.id) % 1000 + 1);
  detailTex.colorSpace = THREE.NoColorSpace;
  const pathTex = pathTexture(look.path.style, hash(map.id, 'p') % 1000 + 1, { tone: look.path.tone });
  pathTex.colorSpace = THREE.NoColorSpace;
  disposables.push(detailTex, pathTex);
  const groundMat = createGroundMaterial(painted.texture, detailTex);
  const pathMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: pathTex });
  const sideMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  disposables.push(groundMat, pathMat, sideMat);
  const addMesh = (geo, mat, { cast = false, receive = true, name } = {}) => {
    if (!geo) return null;
    const m = new THREE.Mesh(geo, mat);
    m.name = name || '';
    m.receiveShadow = shadows && receive;
    m.castShadow = shadows && cast;
    m.matrixAutoUpdate = false;
    group.add(m);
    disposables.push(geo);
    return m;
  };
  addMesh(groundGeo, groundMat, { name: 'ground' });

  // ----- road ribbon + decks ---------------------------------------------------------------
  const waterAt = (x, z) => isWater(Math.floor(x), Math.floor(z));
  const decks = buildDecks(plan.roads, waterAt, look, { pathH: PATH_H, waterY: WATER_Y, crossings: plan.crossings, links: plan.links });
  const road = new MeshData(true);
  plan.roads.forEach((r, ri) => {
    buildRibbon(road, r.pts, {
      half: ROAD_HALF, bevel: ROAD_BEVEL, h: PATH_H + ri * 0.004, seed: hash(map.id, 'road', ri),
      elev: r.elev, lift: r.lift, noSide: r.noSide,
      // city roads: crisp edges, and a plain junction box where a flat crossing's later pass is lifted
      wobble: look.path.crisp ? 0 : 1,
      plain: look.path.plainJunction ? (i) => r.lift[i] > 0 : null,
      skip: (i) => r.tunnel[i] || decks.waterSections.has(`${r.index}:${i}`),
      colorTop: (x, z, s) => fade(tmp.copy(cPath).multiplyScalar(0.97 + 0.03 * Math.sin(s * 1.3 + ri)).clone(), x, z),
      colorSide: (x, z, e) => fade(tmp.copy(e > 0.05 ? cBridgeSide : cPathSide).clone(), x, z),
    });
  });
  addMesh(road.build(1), pathMat, { name: 'path' });

  // ----- water + lava ------------------------------------------------------------------
  let waterMat = null;
  let lavaMat = null;
  const waterTiles = [];
  for (let y = Y0; y < Y0 + EH; y++) for (let x = X0; x < X0 + EW; x++) if (isWater(x, y)) waterTiles.push([x, y]);
  if (waterTiles.length) {
    // the water keeps clear of every road on the ground (decks, overpasses and tunnels excepted),
    // so a road that grazes a pond corner or runs along a bank reads as a shore road
    const carve = [];
    for (const r of plan.roads) {
      let cur = [];
      r.pts.forEach(([x, z], i) => {
        if (r.tunnel[i] || r.elev[i] > 0.015 || decks.waterSections.has(`${r.index}:${i}`)) {
          if (cur.length > 1) carve.push(cur);
          cur = [];
        } else cur.push([x - X0, z - Y0]);
      });
      if (cur.length > 1) carve.push(cur);
    }
    const sharp = features.sharp.filter((r) => r.kind === 'water').map((r) => ({ x: r.x - X0, y: r.y - Y0, w: r.w, h: r.h }));
    const mask = maskTexture(EW, EH, (gx, gy) => isWater(gx + X0, gy + Y0), { px: 16, blur: 4, carve, carveHalf: WATER_CLEAR, sharp });
    disposables.push(mask);
    waterMat = createWaterMaterial(mask, look, { x0: X0, y0: Y0, w: EW, h: EH });
    const geo = new THREE.PlaneGeometry(EW, EH, 1, 1);
    geo.rotateX(-Math.PI / 2);
    geo.translate(X0 + EW / 2, WATER_Y, Y0 + EH / 2);
    const m = addMesh(geo, waterMat, { name: 'water' });
    m.receiveShadow = false;
    disposables.push(waterMat);
  }
  let hasLava = false;
  // (a city's 'X' tiles are collapsed houses, not lava: rubble heaps, placed with the props)
  for (let y = 0; y < H && !hasLava && !look.city; y++) for (let x = 0; x < W; x++) if (rows[y][x] === 'X') { hasLava = true; break; }
  if (hasLava) {
    const sharp = features.sharp.filter((r) => r.kind === 'lava').map((r) => ({ x: r.x + 1, y: r.y + 1, w: r.w, h: r.h }));
    const mask = maskTexture(W + 2, H + 2, (gx, gy) => isLava(gx - 1, gy - 1), { px: 16, blur: 5, sharp });
    disposables.push(mask);
    lavaMat = createLavaMaterial(mask, { x0: -1, y0: -1, w: W + 2, h: H + 2 });
    const geo = new THREE.PlaneGeometry(W + 2, H + 2);
    geo.rotateX(-Math.PI / 2);
    geo.translate(W / 2, LAVA_Y, H / 2);
    addMesh(geo, lavaMat, { name: 'lava', receive: false });
    disposables.push(lavaMat);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (rows[y][x] !== 'X') continue;
        if ((x + y) % 2 === 0) glows.push({ x: x + 0.5, y: 0.05, z: y + 0.5, color: new THREE.Color('#ff6a1a'), size: 1.6, flicker: 0.25, phase: rand() * 6 });
        if ((x * 7 + y * 3) % 5 === 0) emitters.push({ kind: 'embers', x: x + 0.5, y: 0, z: y + 0.5 });
      }
    }
  }

  // ----- props --------------------------------------------------------------------------
  const solidParts = [];
  const foliageParts = [];
  const glowParts = [];
  // city kit buildings (shader windows): merged into one facade mesh (src/render/city/)
  const facadeParts = [];
  const occupied = new Set(); // tiles with a prop (outside slots avoid them)
  const m4 = new THREE.Matrix4();
  const v3 = new THREE.Vector3();
  const puddles = [];
  const mats = {};
  mats.solid = new THREE.MeshLambertMaterial({ vertexColors: true });
  mats.foliage = createFoliageMaterial();
  mats.glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  disposables.push(mats.solid, mats.foliage, mats.glow);
  // blackout stages (look.blackout): the glow geometry carries a per-vertex `dimk` (1 = dims with
  // the lights, 0 = a gate: stays lit) and the glow material scales by uDim (setDim, 0 calls)
  const glowDim = look.blackout ? { value: 1 } : null;
  // the tear (hammerTear, Gate Arc S3a): its glow geometry carries `tearK` = 1 and the glow material
  // scales it by uTear (setTear, 0 calls); only a board with a tear gets the attribute at all
  const tearPulse = { value: TEAR_REST };
  let tearParts = 0;
  /** Patches the glow material for the blackout's `dimk` and / or the tear's `tearK` (once the props are placed). */
  const patchGlow = (dim, tear) => {
    if (!dim && !tear) return;
    mats.glow.onBeforeCompile = (shader) => {
      let vh = '';
      let vb = '';
      let fh = '';
      let fb = '';
      if (dim) {
        shader.uniforms.uDim = glowDim;
        vh += 'attribute float dimk;\nvarying float vDimk;\n';
        vb += '\n  vDimk = dimk;';
        fh += 'uniform float uDim;\nvarying float vDimk;\n';
        fb += '\n  diffuseColor.rgb *= mix(1.0, uDim, vDimk);';
      }
      if (tear) {
        shader.uniforms.uTear = tearPulse;
        vh += 'attribute float tearK;\nvarying float vTearK;\n';
        vb += '\n  vTearK = tearK;';
        fh += 'uniform float uTear;\nvarying float vTearK;\n';
        fb += '\n  diffuseColor.rgb *= mix(1.0, uTear, vTearK);';
      }
      shader.vertexShader = vh + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>${vb}`);
      shader.fragmentShader = fh + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>${fb}`);
    };
    mats.glow.customProgramCacheKey = () => (dim && tear ? 'glowDimTear' : dim ? 'glowDim' : 'glowTear');
  };
  // city buildings: one opaque facade material (shader windows), shared with the kit's movers
  mats.facade = look.city ? createFacadeMaterial({ ...(look.city.glass || {}), night: look.night }) : null;
  if (mats.facade) disposables.push(mats.facade);
  const place = (type, x, y, z, ry = 0, s = 1, variant = 0, target = null, lod = 'near') => {
    if (!hasProp(type) && type !== 'puddle') return;
    if (type === 'puddle') {
      puddles.push({ x, z, s, color: ['#9be36a', '#ff9ec4', '#8fd0ff', '#ffd84d', '#c4a6ff'][variant % 5] });
      return;
    }
    const p = buildProp(type, look, variant, lod);
    placeMatrix(x, y, z, ry, s, m4);
    const push = (src, list) => {
      if (!src) return;
      const g = src.clone();
      g.applyMatrix4(m4);
      list.push(g);
    };
    if (target) {
      // separate object (water set pieces that hide under water girls)
      const sub = new THREE.Group();
      for (const [src, mat] of [[p.solid, 'solid'], [p.foliage, 'foliage'], [p.glow, 'glow'], [p.facade, 'facade']]) {
        if (!src || !mats[mat]) continue;
        const mesh = new THREE.Mesh(src, mats[mat]);
        mesh.castShadow = shadows && mat !== 'glow';
        sub.add(mesh);
      }
      sub.position.set(x, y, z);
      sub.rotation.y = ry;
      sub.scale.setScalar(s);
      group.add(sub);
      target.push(sub);
    } else {
      push(p.solid, solidParts);
      push(p.foliage, foliageParts);
      push(p.glow, glowParts);
      if (glowDim && p.glow) {
        const g = glowParts[glowParts.length - 1];
        g.setAttribute('dimk', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(KEEP_LIT.has(type) ? 0 : 1), 1));
      }
      if (TEAR_TYPES.has(type) && p.glow) {
        const g = glowParts[glowParts.length - 1];
        g.setAttribute('tearK', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(1), 1));
        tearParts++;
      }
      push(p.facade, facadeParts);
    }
    const keep = KEEP_LIT.has(type);
    for (const gl of p.glows) {
      v3.set(gl.x, gl.y, gl.z).applyMatrix4(m4);
      glows.push({ x: v3.x, y: v3.y, z: v3.z, color: new THREE.Color(gl.color), size: gl.size * s, flicker: gl.flicker, phase: rand() * 6, owner: target ? target[target.length - 1] : null, ...(gl.cycle ? { cycle: gl.cycle } : {}), ...(keep ? { keep } : {}), ...(gl.tear ? { tear: true } : {}) });
    }
    for (const em of p.emitters) {
      v3.set(em.x, em.y, em.z).applyMatrix4(m4);
      emitters.push({ kind: em.kind, x: v3.x, y: v3.y, z: v3.z, color: em.color, owner: target ? target[target.length - 1] : null, ...(em.r ? { r: em.r * s } : {}) });
    }
  };

  const waterDecor = new Map(); // "x,y" → [objects]
  const treeTypes = look.trees;

  /** Yaw so a building's +z front faces the nearest path tile. */
  function facePath(x, y) {
    let best = null;
    for (let r = 1; r <= 4 && !best; r++) {
      for (const [dx, dy] of DIRS) {
        if (isPath(x + dx * r, y + dy * r)) {
          best = [dx, dy];
          break;
        }
      }
    }
    if (!best) return 0;
    return Math.atan2(best[0], best[1]);
  }

  // a set piece with a radius (decor `r`, e.g. 1-10's dry fountain) draws the building tiles
  // around it itself: no generic building stands on them
  const covers = (map.decor || []).filter((d) => d.r > 0);
  const coveredBy = (x, y) => covers.some((d) => Math.hypot(x - d.x, y - d.y) <= d.r);

  // tunnels first: a tunnel under buildings gets one composed hall, so skip those tiles' props
  const tunnels = buildTunnels(map, look);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = rows[y][x];
      const cx = x + 0.5;
      const cz = y + 0.5;
      const key = `${x},${y}`;
      const h = hash(map.id, x, y);
      const r01 = (h % 1000) / 1000;
      const deco = decorAt.get(key);
      if (isPath(x, y)) continue;
      if (deco) {
        if (c === '~' || c === 'B') {
          const list = [];
          const floatY = deco.type === 'pier' ? 0.02 : WATER_Y + 0.01;
          place(deco.type, cx, floatY, cz, deco.rot ?? r01 * 0.6 - 0.3, 1, h % 3, list);
          waterDecor.set(key, list);
        } else {
          const big = deco.type === 'sakura' || deco.type === 'willow' || deco.type === 'pine';
          place(deco.type, cx, 0, cz, deco.rot ?? facePath(x, y), big ? 1.3 : (deco.s ?? 1), h % 4);
        }
        occupied.add(key);
        continue;
      }
      if (c === 'H' && coveredBy(x, y)) {
        // a big set piece's own ground (decor r: the dry fountain's basin): it draws these tiles
        occupied.add(key);
        continue;
      }
      if (c === 'T') {
        const type = treeTypes[h % treeTypes.length];
        place(type, cx + (r01 - 0.5) * 0.2, 0, cz + (((h >> 10) % 100) / 100 - 0.5) * 0.2, r01 * 6.28, 0.95 + ((h >> 4) % 20) / 100, h % 4);
        occupied.add(key);
      } else if (c === 'R') {
        let n = 0;
        for (const [dx, dy] of DIRS) if (inMap(x + dx, y + dy) && rows[y + dy][x + dx] === 'R') n++;
        const rocks = look.rocks || ['rock', 'boulder'];
        place(n >= 2 ? rocks[1] : rocks[0], cx, 0, cz, r01 * 6.28, 1, h % 5);
        occupied.add(key);
      } else if (c === 'H' && tunnels.hallTiles.has(key)) {
        occupied.add(key);
      } else if (c === 'H') {
        const border = x === 0 || y === 0 || x === W - 1 || y === H - 1;
        if (border) {
          const alongX = y === 0 || y === H - 1;
          place(look.wall, cx, 0, cz, alongX ? (y === 0 ? Math.PI : 0) : (x === 0 ? Math.PI / 2 : -Math.PI / 2), 1, look.city ? cityWallVariant(map, x, y, look.city.kit) : h % 4);
        } else if (look.city) {
          // the city kit picks the building: shops on the street, homes and offices behind (the
          // campus: classroom wings, the gym, club huts; Old Town: wooden houses; burning: shells)
          const b = cityBuildingFor(map, x, y, isPath, look.city.kit, look);
          place(b.type, cx, 0, cz, b.ry ?? facePath(x, y), b.s ?? 1, b.variant, null, b.lod || 'near');
        } else {
          place(look.building, cx, 0, cz, facePath(x, y), 1, h % 3);
        }
        occupied.add(key);
      } else if (c === ',') {
        // the painted ground already shows a flower drift here; add a few 3D blossoms on top
        if (h % 3 === 0) place('flowersPatch', cx, 0, cz, r01 * 6.28, 0.75, h % 4);
      } else if (c === 'U') {
        // a rooftop: its block is built per region below; nothing else stands on the tile
        occupied.add(key);
      } else if (c === 'X' && look.city) {
        // a collapsed house (Gate Arc 3-9): a rubble heap where it stood
        place('rubble', cx, 0, cz, r01 * 6.28, 1.05, h % 3);
        occupied.add(key);
      }
    }
  }

  // ----- rooftops ('U'): one low flat-roofed block per connected region, on any theme --------
  let roofStats = null;
  if (rows.some((r) => r.includes('U'))) {
    const roofAcc = new CityAcc();
    roofStats = buildRoofs(map, roofAcc, { quality, kit: look.city?.kit, district: look.district, ruined: look.ruined });
    const rg = roofAcc.build();
    if (rg) facadeParts.push(rg);
    // (the highway's toll canopies light their price boards)
    for (const gl of roofStats.glows || []) glows.push(gl);
  }
  const isRoofTile = (x, y) => inMap(x, y) && rows[y][x] === 'U';

  // ----- bridges / boardwalks / overpass rails + tunnels ----------------------------------
  if (decks.geometry) solidParts.push(decks.geometry);
  if (decks.shadow) {
    // the city keeps every terrain mesh out of the sorted transparent pass (phone budget): its
    // overpass shadow multiplies the frame buffer instead (the same darkening as black at the
    // same opacity), drawn right after the ground in the opaque pass
    const shadowMat = look.city ? createMultiplyMaterial(1 - (look.bridge.shadow ?? 0.36))
      : new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: look.bridge.shadow ?? 0.36, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    disposables.push(shadowMat);
    const m = addMesh(decks.shadow, shadowMat, { name: 'overpassShadow', receive: false });
    m.renderOrder = 2;
  }
  for (const gl of decks.glows) glows.push({ ...gl, color: new THREE.Color(gl.color), phase: rand() * 6 });
  if (tunnels.geometry) solidParts.push(tunnels.geometry);
  if (features.geometry) solidParts.push(features.geometry);

  // ----- auto lily pads on pond shores (grass-family themes) --------------------------
  if (look.life.koi && waterTiles.length >= 4) {
    let n = 0;
    for (const [x, y] of waterTiles) {
      if (!inMap(x, y) || isPath(x, y) || decorAt.has(`${x},${y}`)) continue;
      let shore = false;
      for (const [dx, dy] of DIRS) if (!isWater(x + dx, y + dy) && !isPath(x + dx, y + dy)) shore = true;
      if (!shore) continue;
      const h = hash(map.id, 'lily', x, y);
      if (h % 100 > 34 || n >= 16) continue;
      place('lilyPad', x + 0.5, WATER_Y + 0.004, y + 0.5, (h % 628) / 100, 0.9 + (h % 30) / 100, h % 4);
      n++;
    }
    if (n > 0) ambient.add('koi');
  }

  // ----- framing ring around the board (fences / hedges / flower beds / rocks) ---------
  const frame = look.frame || [];
  // a city map's railway (map.city.railway, cityKit.js) may run just past the board edge: keep the
  // ring out of its band
  const railZ = look.city ? map.city?.railway?.z : undefined;
  if (frame.length) {
    const ring = [];
    for (let x = -1; x <= W; x++) {
      ring.push([x, -1, 0]);
      ring.push([x, H, 1]);
    }
    for (let y = 0; y < H; y++) {
      ring.push([-1, y, 2]);
      ring.push([W, y, 3]);
    }
    let i = 0;
    for (const [x, y, side] of ring) {
      i++;
      // leave the road exits open, keep off water and away from set pieces on the border
      if (isPath(x, y) || isWater(x, y)) continue;
      if (Number.isFinite(railZ) && Math.abs(y + 0.5 - railZ) < 0.9) continue;
      let nearPath = false;
      for (const [dx, dy] of DIRS) if (isPath(x + dx, y + dy)) nearPath = true;
      if (nearPath) continue;
      const corner = (x === -1 || x === W) && (y === -1 || y === H);
      const h = hash(map.id, 'frame', x, y);
      const type = corner ? 'framePost' : frame[(Math.floor(i / 2) + (h % 2)) % frame.length];
      if (!hasProp(type)) continue;
      const ry = side === 0 ? Math.PI : side === 1 ? 0 : side === 2 ? Math.PI / 2 : -Math.PI / 2;
      place(type, x + 0.5, 0, y + 0.5, corner ? 0 : ry, 1, h % 4);
      occupied.add(`${x},${y}`);
    }
  }

  // ----- gates: where monsters come from, what we protect --------------------------------
  // The arch straddles the board edge (0.62 tiles out) so it stays inside the camera frame.
  // Gates sit where the centreline crosses the board edge (curved tracks meet it at any angle).
  const gateInfo = (g, outward) => {
    const [dx, dy] = g.dir;
    const k = outward ? 0.06 : -0.06;
    const gx = g.x + dx * k;
    const gz = g.z + dy * k;
    return { x: gx, z: gz, dir: [dx, dy], ry: Math.atan2(dx, dy) };
  };
  for (const e of entrances) {
    // a lane that starts inside the board (a mid-board rift, Gate Arc 3-8) gets its gate where the
    // lane begins: the Petal Gate's rift on a city board (standing on the water when the lane starts
    // on a jetty over it), the theme's spawn gate elsewhere
    const gi = e.inside ? { x: e.x, z: e.z, dir: e.dir, ry: Math.atan2(e.dir[0], e.dir[1]) } : gateInfo(e, false);
    const type = !e.inside && scenery.keywords?.includes('torii') ? 'toriiGate' : (map.city?.spawnGate || look.spawnGate || 'spawnGate');
    // the city's rift leans its disc toward the camera whichever edge it stands on (cityProps.riftPlacement)
    const rift = type === 'petalRift' ? riftPlacement(gi.dir) : null;
    if (rift && !e.inside) {
      gi.x += gi.dir[0] * rift.inset;
      gi.z += gi.dir[1] * rift.inset;
    }
    const onWater = isWater(Math.floor(gi.x), Math.floor(gi.z));
    place(type, gi.x, onWater ? PATH_H : 0, gi.z, gi.ry, 1, rift ? rift.variant : 0);
    gates.push({ kind: 'spawn', x: gi.x, z: gi.z, dir: gi.dir, color: look.gate.spawn, ...(e.inside ? { inside: true, onWater } : {}) });
  }
  for (const e of exits) {
    const gi = gateInfo(e, true);
    const onWater = isWater(Math.floor(gi.x), Math.floor(gi.z));
    place(map.city?.goalGate || look.goalGate || 'goalGate', gi.x, onWater ? PATH_H : 0, gi.z, gi.ry, 1, map.city?.goalVariant ?? look.goalVariant ?? 0);
    gates.push({ kind: 'goal', x: gi.x, z: gi.z, dir: gi.dir, color: look.gate.goal });
  }

  // ----- the city kit: kerbs, crossings, street furniture, skyline, railway, movers --------
  const city = look.city ? buildCity({
    map, look, plan, isPath, isWater, occupied, gates, portals: tunnels.portals, place, facadeParts, quality, margin: MARGIN, facadeMaterial: mats.facade,
  }) : null;
  if (city) {
    for (const m of city.meshes) group.add(m);
    for (const gl of city.glows) glows.push(gl);
  }

  // ----- the burning layer (scenery.ruined 'burning', Gate Arc S3a): fire on the ruins away from
  // the road, smoke from the skirt, scorch marks, the stray cat in the rubble ----------------------
  const burning = look.ruined === 'burning' ? burningLayer({ map, plan, isPath, isWater, occupied, quality }) : null;
  if (burning) {
    for (const gl of burning.glows) glows.push(gl);
    for (const em of burning.emitters) emitters.push(em);
    if (burning.cat) place('catOnWall', burning.cat.x, 0.06, burning.cat.z + 0.28, 0.4, 1, hash(map.id, 'stray') % 2);
  }

  // ----- outside scatter (frames the board) ------------------------------------------
  const outsideFree = (x, y) => !isPath(x, y) && !isWater(x, y) && !inMap(x, y)
    && !isPath(x + 1, y) && !isPath(x - 1, y) && !isPath(x, y + 1) && !isPath(x, y - 1);
  for (let y = Y0; y < Y0 + EH; y++) {
    for (let x = X0; x < X0 + EW; x++) {
      if (!outsideFree(x, y) || occupied.has(`${x},${y}`)) continue;
      const d = outsideDist(x + 0.5, y + 0.5);
      if (d < 1.4) continue;
      const h = hash(map.id, 'o', x, y);
      const r01 = (h % 1000) / 1000;
      // clustered: denser where a slow noise is high, so the skirt reads as groves + clearings
      const cluster = valueNoise(x * 0.3 + 3, y * 0.3 + 9, 5);
      const p = Math.min(0.7, (0.1 + d * 0.1) * (0.5 + cluster)) * (look.scatterDensity ?? 1) * (quality === 'low' ? 0.6 : 1);
      if (r01 > p) continue;
      const roll = (h >> 12) % 100;
      const cx = x + 0.5 + ((((h >> 3) % 100) / 100) - 0.5) * 0.5;
      const cz = y + 0.5 + ((((h >> 7) % 100) / 100) - 0.5) * 0.5;
      const scatter = look.scatter || treeTypes;
      const lod = d > 2.2 || quality !== 'high' ? 'far' : 'near';
      if (roll < 80) place(scatter[h % scatter.length], cx, 0, cz, r01 * 6.28, 0.95 + (roll % 30) / 100, h % 4, null, lod);
      else place('rock', cx, 0, cz, r01 * 6.28, 0.9, h % 5, null, lod);
      occupied.add(`${x},${y}`);
    }
  }

  // ----- ground detail: grass tufts / pebbles / glowing cracks ---------------------
  const detail = look.detail || 'tuft';
  for (let y = Y0; y < Y0 + EH; y++) {
    for (let x = X0; x < X0 + EW; x++) {
      if (isPath(x, y) || isWater(x, y) || isLava(x, y) || occupied.has(`${x},${y}`)) continue;
      const c = charAt(x, y);
      if (c !== '.' && c !== ',' && c !== 'o') continue;
      if (outsideDist(x + 0.5, y + 0.5) > 3) continue;
      const h = hash(map.id, 'd', x, y);
      if ((h % 100) / 100 > (look.detailDensity ?? 0.3) * (quality === 'low' ? 0.35 : 1)) continue;
      // keep the tile centre clear: details sit in a corner
      const ox = ((h >> 8) & 1 ? 0.3 : -0.3) + ((((h >> 9) % 20) / 20) - 0.5) * 0.12;
      const oz = ((h >> 10) & 1 ? 0.3 : -0.3) + ((((h >> 11) % 20) / 20) - 0.5) * 0.12;
      place(detail, x + 0.5 + ox, 0, y + 0.5 + oz, ((h >> 4) % 628) / 100, 1, h % 3);
    }
  }

  // ----- scenery keywords --------------------------------------------------------------
  const slots = buildSlots();
  // a keyword may dress the board with more keywords (`also`), each once
  const dressing = [];
  const addKeyword = (kw) => {
    if (dressing.includes(kw)) return;
    dressing.push(kw);
    for (const a of SCENERY[kw]?.also || []) addKeyword(a);
  };
  for (const kw of scenery.keywords || []) addKeyword(kw);
  for (const kw of dressing) {
    const rec = SCENERY[kw];
    if (!rec || rec.look) continue;
    if (rec.ambient) {
      ambient.add(rec.ambient);
      continue;
    }
    const r = makeRand(hash(map.id, kw));
    let n = 0;
    for (const slot of rec.alt ? [rec.slot, rec.alt] : [rec.slot]) {
      const list = slots[slot] || [];
      shuffle(list, r);
      for (const spot of list) {
        if (n >= rec.n) break;
        if (spot.used) continue;
        if (city && city.furniture.some(([fx, fz]) => Math.hypot(fx - spot.x, fz - spot.z) < 0.75)) continue;
        spot.used = true;
        for (const o of list) if (!o.used && Math.abs(o.x - spot.x) + Math.abs(o.z - spot.z) < 1.2) o.used = true;
        const s = (rec.s ?? 1) * (spot.s ?? 1);
        const ry = rec.face ? (r() - 0.5) * 0.7 : spot.ry ?? r() * 6.28;
        place(rec.props ? rec.props[n % rec.props.length] : rec.prop, spot.x, spot.y ?? 0, spot.z, ry, s, rec.variants ? rec.variants[n % rec.variants.length] : rec.variant ?? Math.floor(r() * 4));
        n++;
      }
    }
  }

  // the highway bores breathe snow out over the board (scenery keyword 'tunnelPortals', Gate Arc 4-8)
  if (dressing.includes('tunnelPortals')) {
    for (const p of tunnels.portals) {
      if (p.end !== 'out') continue;
      emitters.push({ kind: 'snowGust', x: p.x + p.dir[0] * 0.2, y: 0.32, z: p.z + p.dir[1] * 0.2, dx: p.dir[0], dz: p.dir[1] });
    }
  }

  function buildSlots() {
    const out = {
      pathside: [], skirt: [], grass: [], shore: [], water: [], entrance: [], nook: [], roof: [],
      span: [], pad: [], deckside: [], gateside: [], goalside: [], north: [],
    };
    // pad: the stage rule's relay pads (the far north's village hearths ring them)
    for (const p of scenery.pads || []) out.pad.push({ x: p.x, z: p.y, y: 0, ry: 0, s: 1 });
    // span: across a straight stretch of road on the ground, clear of every other road, fork, join,
    // gate, tunnel mouth and crossing (a sign gantry's posts stand either side of it)
    const spanClear = (x, z, r, i) => {
      if (!inMap(Math.floor(x), Math.floor(z))) return false;
      if ((plan.links || []).some((l) => Math.hypot(l.x - x, l.y - z) < 2.0)) return false;
      if (gates.some((g) => Math.hypot(g.x - x, g.z - z) < 2.2)) return false;
      if (tunnels.portals.some((p) => Math.hypot(p.x - x, p.z - z) < 2.0)) return false;
      if ((map.crossings || []).some((c) => Math.hypot(c.x - x, c.y - z) < 2.0)) return false;
      for (const o of plan.roads) {
        for (let k = 0; k < o.pts.length; k += 2) {
          if (o === r && Math.abs(k - i) < 30) continue;
          if (Math.hypot(o.pts[k][0] - x, o.pts[k][1] - z) < 1.4) return false;
        }
      }
      return true;
    };
    for (const r of plan.roads) {
      let acc = 0;
      for (let i = 6; i < r.pts.length - 6; i++) {
        acc += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
        if (acc < 1.5) continue;
        if (r.tunnel[i] || r.elev[i] > 0.01 || r.lift[i] || r.tunnel[i - 5] || r.tunnel[i + 5]) continue;
        const a = r.pts[i - 5];
        const b = r.pts[i + 5];
        const [x, z] = r.pts[i];
        const ax = x - a[0];
        const az = z - a[1];
        const bx = b[0] - x;
        const bz = b[1] - z;
        const turn = Math.acos(Math.max(-1, Math.min(1, (ax * bx + az * bz) / ((Math.hypot(ax, az) * Math.hypot(bx, bz)) || 1))));
        if (turn > 0.12 || !spanClear(x, z, r, i)) continue;
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const nx = -(b[1] - a[1]) / l;
        const nz = (b[0] - a[0]) / l;
        // (its posts stand on open ground: never in the water, on a roof or in a building)
        const blocked = (s) => {
          const tx = Math.floor(x + nx * s);
          const tz = Math.floor(z + nz * s);
          return isWater(tx, tz) || isRoofTile(tx, tz) || (inMap(tx, tz) && rows[tz][tx] === 'H');
        };
        if (blocked(-0.86) || blocked(0.86)) continue;
        acc = 0;
        out.span.push({ x, z, y: 0, ry: Math.atan2(-nz, nx), s: 1 });
      }
    }
    // deckside: the water either side of a deck, along the river (the old bridge's piers, 4-10)
    for (const r of plan.roads) {
      let acc = 0;
      for (let i = 1; i < r.pts.length - 1; i++) {
        acc += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
        if (acc < 1.8 || !decks.waterSections.has(`${r.index}:${i}`)) continue;
        const [x, z] = r.pts[i];
        if (!isWater(Math.floor(x), Math.floor(z))) continue;
        acc = 0;
        const a = r.pts[i - 1];
        const b = r.pts[i + 1];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const nx = -(b[1] - a[1]) / l;
        const nz = (b[0] - a[0]) / l;
        for (const sd of [-1, 1]) {
          const px = x + nx * sd * 1.35;
          const pz = z + nz * sd * 1.35;
          if (!isWater(Math.floor(px), Math.floor(pz)) || isPath(Math.floor(px), Math.floor(pz))) continue;
          if (plan.roads.some((o) => o !== r && o.pts.some(([qx, qz]) => Math.hypot(qx - px, qz - pz) < 1.0))) continue;
          out.deckside.push({ x: px, z: pz, y: WATER_Y, ry: Math.atan2(nx, nz), s: 1 });
        }
      }
    }
    // gateside / goalside: beside the road just inside a spawn / goal gate, facing the road
    for (const [list, sign] of [[entrances, 1], [exits, -1]]) {
      for (const e of list) {
        const gi = gates.find((g) => Math.hypot(g.x - e.x, g.z - e.z) < 1.2) || { x: e.x, z: e.z };
        const [dx, dz] = e.dir;
        const nx = -dz;
        const nz = dx;
        for (const along of [1.0, 2.1]) {
          for (const sd of [-1, 1]) {
            const px = gi.x + dx * sign * along + nx * sd * 1.2;
            const pz = gi.z + dz * sign * along + nz * sd * 1.2;
            const tx = Math.floor(px);
            const tz = Math.floor(pz);
            if (isPath(tx, tz) || isWater(tx, tz) || isRoofTile(tx, tz)) continue;
            (sign > 0 ? out.gateside : out.goalside).push({ x: px, z: pz, y: 0, ry: Math.atan2(-nx * sd, -nz * sd), s: 1 });
          }
        }
      }
    }
    // roof: the outer front corner of a rooftop, on its parapet (a cat dozing there, Old Town)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isRoofTile(x, y) || isRoofTile(x, y + 1)) continue;
        const west = !isRoofTile(x - 1, y);
        const east = !isRoofTile(x + 1, y);
        if (!west && !east) continue;
        out.roof.push({ x: x + (west ? 0.16 : 0.84), z: y + 0.97, y: ROOF_Y + 0.05, ry: west ? 0 : Math.PI, s: 1 });
      }
    }
    // pathside: just beside the road, every ~1.6 tiles along the centreline, both sides
    for (const r of plan.roads) {
      let acc = 0;
      for (let i = 1; i < r.pts.length - 1; i++) {
        const [x, z] = r.pts[i];
        acc += Math.hypot(x - r.pts[i - 1][0], z - r.pts[i - 1][1]);
        if (acc < 1.6) continue;
        acc = 0;
        if (r.tunnel[i] || r.elev[i] > 0.02 || !inMap(Math.floor(x), Math.floor(z))) continue;
        const a = r.pts[i - 1];
        const b = r.pts[i + 1];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const nx = -(b[1] - a[1]) / l;
        const nz = (b[0] - a[0]) / l;
        for (const sd of [-1, 1]) {
          const px = x + nx * sd * 0.66;
          const pz = z + nz * sd * 0.66;
          const tx = Math.floor(px);
          const tz = Math.floor(pz);
          if (!inMap(tx, tz) || isWater(tx, tz) || isLava(tx, tz) || isRoofTile(tx, tz)) continue;
          // (nor on a city railway that crosses the board)
          if (look.city && Number.isFinite(railZ) && Math.abs(pz - railZ) < 0.7) continue;
          // stay off every other road
          let clear = true;
          for (const o of plan.roads) {
            for (let k = 0; k < o.pts.length && clear; k += 2) {
              if (o === r && Math.abs(k - i) < 8) continue;
              if (Math.hypot(o.pts[k][0] - px, o.pts[k][1] - pz) < 0.75) clear = false;
            }
          }
          if (clear) out.pathside.push({ x: px, z: pz, y: 0, ry: Math.atan2(-nx * sd, -nz * sd) });
        }
      }
    }
    for (let y = Y0; y < Y0 + EH; y++) {
      for (let x = X0; x < X0 + EW; x++) {
        const key = `${x},${y}`;
        const cx = x + 0.5;
        const cz = y + 0.5;
        if (isPath(x, y) || isLava(x, y)) continue;
        if (isWater(x, y)) {
          let shore = false;
          for (const [dx, dy] of DIRS) if (!isWater(x + dx, y + dy) && !isPath(x + dx, y + dy)) shore = true;
          if (!decorAt.has(key)) {
            if (shore) out.shore.push({ x: cx, z: cz, y: WATER_Y });
            else out.water.push({ x: cx, z: cz, y: WATER_Y + 0.02 });
          }
          continue;
        }
        // nook: the front corner of an in-board tree / rock tile (blocked for building), only
        // when the tile in front of it is not road (keeps the prop clear of walkers)
        if (inMap(x, y) && (rows[y][x] === 'T' || rows[y][x] === 'R') && !decorAt.has(key)) {
          const sx = hash(x, y, 'n') % 2 ? 0.27 : -0.27;
          if (!isPath(x, y + 1)) out.nook.push({ x: cx + sx, z: cz + 0.26, s: 0.6 });
        }
        if (occupied.has(key)) continue;
        const d = outsideDist(cx, cz);
        if (!inMap(x, y) && d > 1.3 && d < 3.4 && outsideFree(x, y)) out.skirt.push({ x: cx, z: cz });
        if (inMap(x, y) && (rows[y][x] === '.' || rows[y][x] === ',')) {
          const ox = (hash(x, y, 'g') % 2 ? 0.33 : -0.33);
          const oz = (hash(y, x, 'g') % 2 ? 0.33 : -0.33);
          out.grass.push({ x: cx + ox, z: cz + oz, s: 0.6 });
        }
        // north: the snowy rows of a snow-covered board (board corners and the far skirt)
        if (look.snowCover && cz < (Number.isFinite(map.city?.snowRows) ? map.city.snowRows : look.snowCover.rows) - 0.6) {
          if (inMap(x, y) ? rows[y][x] === '.' : d > 1.3 && d < 3.4 && outsideFree(x, y)) out.north.push({ x: cx + (hash(x, y, 'sn') % 2 ? 0.3 : -0.3), z: cz, s: inMap(x, y) ? 0.7 : 1 });
        }
      }
    }
    for (const e of entrances) {
      // torii two tiles out along the road (the spawn gate sits on the board edge)
      out.entrance.push({ x: e.x - e.dir[0] * 2.0, z: e.z - e.dir[1] * 2.0, y: PATH_H, ry: Math.atan2(e.dir[0], e.dir[1]), s: 1 });
    }
    return out;
  }

  // puddles as flat glossy discs
  if (puddles.length) {
    const pb = new MeshData(false);
    for (const p of puddles) pb.disc(p.x, 0.012, p.z, 0.28 * p.s, new THREE.Color(p.color));
    // (city: opaque, the colour pre-mixed with the paving, so nothing joins the sorted pass)
    if (look.city) for (const p of puddles) p.color = mixHexColor(look.ground[0], p.color, 0.42);
    const pm = look.city ? new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
      : new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.42, depthWrite: false });
    disposables.push(pm);
    addMesh(pb.build(0), pm, { name: 'puddles', receive: false });
  }

  // ----- merge prop groups -------------------------------------------------------------
  // (merging needs one attribute set: with a tear, every other glow part gets tearK = 0)
  if (tearParts) {
    for (const g of glowParts) {
      if (!g.attributes.tearK) g.setAttribute('tearK', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
    }
  }
  patchGlow(!!glowDim, tearParts > 0);
  const solidGeo = solidParts.length ? mergeGeometries(solidParts) : null;
  const foliageGeo = foliageParts.length ? mergeGeometries(foliageParts) : null;
  const glowGeo = glowParts.length ? mergeGeometries(glowParts) : null;
  for (const g of [...solidParts, ...foliageParts, ...glowParts]) g.dispose();
  addMesh(solidGeo, mats.solid, { cast: true, name: 'props' });
  addMesh(foliageGeo, mats.foliage, { cast: true, name: 'foliage' });
  addMesh(glowGeo, mats.glow, { receive: false, name: 'glowProps' });
  // the level crossings' barrier arms go last, so the kit can re-pose their vertex range in place
  let armsOffset = -1;
  if (city?.armsPart) {
    armsOffset = facadeParts.reduce((n, g) => n + g.attributes.position.count, 0);
    facadeParts.push(city.armsPart);
  }
  if (facadeParts.length) {
    const facadeGeo = mergeGeometries(facadeParts);
    if (armsOffset >= 0) city.bindFacade(facadeGeo, armsOffset);
    for (const g of facadeParts) g.dispose();
    let facadeMat = mats.facade;
    if (!facadeMat) {
      // (a city prop on a non-city theme: a facade material of its own)
      facadeMat = createFacadeMaterial({});
      disposables.push(facadeMat);
    }
    addMesh(facadeGeo, facadeMat, { cast: true, name: 'cityFacade' });
  }

  // ----- per-frame update ----------------------------------------------------------------
  const update = (time) => {
    mats.foliage.userData.uTime.value = time;
    if (waterMat) waterMat.uniforms.uTime.value = time;
    if (lavaMat) lavaMat.uniforms.uTime.value = time;
    city?.update(time);
  };

  const setShadows = (on) => {
    group.traverse((o) => {
      if (!o.isMesh) return;
      o.receiveShadow = on && o.name !== 'water' && o.name !== 'glowProps' && o.name !== 'lava' && o.name !== 'cityDrones';
      o.castShadow = on && (o.name === 'props' || o.name === 'foliage' || o.name === 'cityFacade' || o.name === 'cityTrain' || o.parent !== group);
    });
  };

  return {
    group,
    update,
    setShadows,
    /** Wind gust strength 0..1+ (foliage sway amplitude), driven by the ambient system. */
    setWind(g) {
      mats.foliage.userData.uGust.value = g;
    },
    glows,
    emitters,
    ambient,
    entrances,
    exits,
    /** Gate markers (1 tile outside the board): { kind: 'spawn'|'goal', x, z, dir, color }. */
    gates,
    /** Painted ground marks drawn by the ambient batches: rune circles, junction chevrons, city crossings. */
    marks: burning ? [...features.marks, ...(city ? city.marks : []), ...burning.marks] : city ? [...features.marks, ...city.marks] : features.marks,
    /** City kit layout counts (null on other themes). */
    city: city ? city.stats : null,
    /** Live positions of the city's patrol drones ({ x, y, z }, updated by update(); empty elsewhere): the actor layer shadows them. */
    flyers: city ? city.flyers : [],
    /** The campus searchlights (map.city.searchlight): { x, y, z, a0, a1, period, reach, phase }; the ambient layer sweeps their beams. */
    searchlights: city ? city.searchlights : [],
    /**
     * Blackout dimming (look.blackout stages only, src/render/blackout.js): scales the glow geometry
     * (the gates excepted) and the lit windows by k (1 = normal). Uniforms only: no draw call, no
     * allocation; the road, the ground and every other material stay as they are.
     * @param {number} k
     */
    setDim(k) {
      if (!look.blackout) return;
      if (glowDim) glowDim.value = k;
      const u = mats.facade?.userData.uniforms;
      if (u?.uLit) u.uLit.value = k;
    },
    /** Does this board carry HAMMER's tear (a hammerTear prop)? Its glow pulses through setTear. */
    tear: tearParts > 0,
    /**
     * The tear's pulse (src/render/tear.js): scales the tear's glow geometry by k (TEAR_REST at rest,
     * brighter while the rule pulses). A uniform only: no draw call, no allocation.
     * @param {number} k
     */
    setTear(k) {
      if (tearParts) tearPulse.value = k;
    },
    /** The burning layer's fires and smoke columns ({ x, z }; tests and previews; null when not burning). */
    burning: burning ? { fires: burning.fires.map((f) => ({ x: f.x, z: f.z })), smoke: burning.emitters.filter((e) => e.kind === 'smokeColumn').map((e) => ({ x: e.x, z: e.z })) } : null,
    /** Rooftop layout ({ regions, tiles }, null without 'U' tiles). */
    roofs: roofStats,
    /** Height a girl stands at on the board point (x, y): ROOF_Y on a rooftop tile, else 0. */
    roofAt: (x, y) => (isRoofTile(Math.floor(x), Math.floor(y)) ? ROOF_Y : 0),
    /** The city's checkpoint barriers (map.city.barriers; tests and previews): { lane, lanes, x, z, angle, target }. */
    barriers: city ? city.barriers : [],
    /** The lane schedule's open lanes (Sim.openLanes(); null = every lane): the city's level crossings and checkpoint barriers follow it. */
    setLanes(open) {
      city?.setLanes(open);
    },
    /** Road centreline pieces in world coords (the canonical tracks, run out past the board, tunnels cut out). */
    roads,
    /** Drawing plan per track (points, elevation, tunnel flags) and tunnel portals. */
    plan,
    portals: tunnels.portals,
    waterDecor,
    waterTiles: waterTiles.filter(([x, y]) => inMap(x, y) && !isPath(x, y)),
    isWater: (x, y) => isWater(x, y),
    isPath: (x, y) => isPath(x, y),
    extent: { x0: X0, y0: Y0, w: EW, h: EH },
    waterMaterial: waterMat,
    dispose() {
      for (const d of disposables) d.dispose?.();
      city?.dispose();
      group.clear();
    },
  };
}

/** Runs ground painters (textures.paintGround `extra`) in order; null when there are none. */
function chainPainters(...fns) {
  const list = fns.filter(Boolean);
  if (!list.length) return null;
  if (list.length === 1) return list[0];
  return (g, toPx, px, rnd) => {
    for (const fn of list) fn(g, toPx, px, rnd);
  };
}

/**
 * Snow over a highway board's north rows (scenery keyword 'snowCover', Gate Arc 4-8; themes
 * SNOW_COVER): a snow field from the far edge down to `map.city.snowRows` (default SNOW_COVER.rows)
 * with a ragged, drifting southern edge and wind streaks, its colour kept under the road's tone; by
 * the road it turns to grey slush, so the hard shoulder and the road stay the clearest band.
 */
function snowCoverPainter(map, look, roads) {
  const S = look.snowCover;
  const rows = Number.isFinite(map.city?.snowRows) ? map.city.snowRows : S.rows;
  return (g, toPx, px, rnd) => {
    const x0 = -MARGIN - 1;
    const x1 = map.width + MARGIN + 1;
    const edge = [];
    for (let x = x0; x <= x1; x += 0.5) edge.push([x, rows + Math.sin(x * 0.9) * 0.35 + Math.sin(x * 2.3 + 1) * 0.18 + (rnd() - 0.5) * 0.2]);
    const area = () => {
      g.beginPath();
      const [ax, ay] = toPx(x0, -MARGIN - 1);
      g.moveTo(ax, ay);
      for (const [x, z] of edge) {
        const [sx, sy] = toPx(x, z);
        g.lineTo(sx, sy);
      }
      const [bx, by] = toPx(x1, -MARGIN - 1);
      g.lineTo(bx, by);
      g.closePath();
    };
    g.save();
    area();
    g.fillStyle = S.color;
    g.globalAlpha = 0.92;
    g.fill();
    g.globalAlpha = 1;
    area();
    g.clip();
    // wind streaks and drifts
    for (let i = 0; i < 70; i++) {
      const [sx, sy] = toPx(x0 + rnd() * (x1 - x0), -MARGIN + rnd() * (rows + MARGIN));
      g.fillStyle = rnd() > 0.5 ? '#ffffff' : S.shade;
      g.globalAlpha = 0.35;
      g.beginPath();
      g.ellipse(sx, sy, px * (0.3 + rnd() * 0.5), px * (0.06 + rnd() * 0.08), -0.2 + rnd() * 0.4, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    // grey slush by the road: the shoulder band again, in wet tones
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const [w, col] of [[px * 1.6, '#9aa2ab'], [px * 1.1, '#6f757d']]) {
      g.strokeStyle = col;
      g.lineWidth = w;
      for (const road of roads) {
        g.beginPath();
        road.forEach(([x, z], i) => {
          const [sx, sy] = toPx(x, z);
          if (i === 0) g.moveTo(sx, sy);
          else g.lineTo(sx, sy);
        });
        g.stroke();
      }
    }
    g.restore();
  };
}

function shuffle(arr, r) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function valueNoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const h = (a, b) => (hash(a, b, seed) % 1000) / 1000;
  const s = (t) => t * t * (3 - 2 * t);
  const a = h(xi, yi);
  const b = h(xi + 1, yi);
  const c = h(xi, yi + 1);
  const d = h(xi + 1, yi + 1);
  return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
}

// ---------------------------------------------------------------------------
// Road ribbon: a raised slab following the smooth centreline with wavy edges + bevels.
// ---------------------------------------------------------------------------

/**
 * Appends a road ribbon to `md`.
 * @param {MeshData} md accumulator (with uv)
 * @param {number[][]} pts centreline [[x, z], ...]
 * @param {object} o { half, bevel, h, seed, colorTop(x,z,s), colorSide(x,z,elev),
 *   elev?: number[] (overpass height per point), lift?: number[] (flat-junction lift, 0/1),
 *   noSide?: boolean[] (no bevels: the upper pass of a flat junction),
 *   skip?(i) (section i-1→i not drawn: tunnels, plank decks), skipAt?(x,z) (legacy),
 *   wobble?: number (edge waviness, 1 = default, 0 = crisp city kerbs), plain?(i) (top uses the
 *   texture's plain band: a city junction box) }
 */
export function buildRibbon(md, pts, o) {
  if (pts.length < 2) return;
  const r = makeRand(o.seed || 1);
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28];
  const wk = o.wobble ?? 1;
  const wob = (s, k) => wk * (0.03 * Math.sin(s * 1.9 + ph[k]) + 0.022 * Math.sin(s * 4.1 + ph[k + 2]));
  const up = [0, 1, 0];
  const sections = [];
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b[0] - a[0];
    let tz = b[1] - a[1];
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    if (i > 0) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    const nx = -tz;
    const nz = tx;
    const e = o.elev ? o.elev[i] || 0 : 0;
    const k = Math.min(1, e / 0.15); // 0 on the ground → 1 on a raised deck
    const top = o.h + e + (o.lift ? o.lift[i] * 0.006 : 0);
    const bevel = o.bevel * (1 - k) + 0.015 * k;
    const bottom = -0.012 * (1 - k) + (top - 0.13) * k;
    const hl = o.half + wob(s, 0) * (1 - k);
    const hr = o.half + wob(s, 1) * (1 - k);
    const ct = o.colorTop(p[0], p[1], s);
    const cs = o.colorSide(p[0], p[1], e);
    // normals of the bevels (outward + up)
    const bl = norm3([nx * (top - bottom), bevel, nz * (top - bottom)]);
    const br = norm3([-nx * (top - bottom), bevel, -nz * (top - bottom)]);
    sections.push({
      s,
      x: p[0], z: p[1],
      noSide: !!(o.noSide && o.noSide[i]),
      v: [
        { p: [p[0] + nx * (hl + bevel), bottom, p[1] + nz * (hl + bevel)], c: cs, uv: [s, 1.1], n: bl },
        { p: [p[0] + nx * hl, top, p[1] + nz * hl], c: ct, uv: [s, 1], n: up },
        { p: [p[0] - nx * hr, top, p[1] - nz * hr], c: ct, uv: [s, 0], n: up },
        { p: [p[0] - nx * (hr + bevel), bottom, p[1] - nz * (hr + bevel)], c: cs, uv: [s, -0.1], n: br },
      ],
      sideL: bl,
      sideR: br,
    });
  }
  for (let i = 1; i < sections.length; i++) {
    const A = sections[i - 1];
    const B = sections[i];
    if (o.skip && o.skip(i)) continue;
    if (o.skipAt && (o.skipAt((A.x + B.x) / 2, (A.z + B.z) / 2))) continue;
    // a plain section (a flat junction's box): the top samples a band of the road texture
    // without lines (asphalt: v 0.2-0.4)
    const plain = o.plain && (o.plain(i) || o.plain(i - 1));
    for (let k = 0; k < 3; k++) {
      if (k !== 1 && (A.noSide || B.noSide)) continue;
      const a0 = A.v[k];
      const a1 = A.v[k + 1];
      const b0 = B.v[k];
      const b1 = B.v[k + 1];
      const n = k === 1 ? up : k === 0 ? A.sideL : A.sideR;
      const uv = (q) => (plain && k === 1 ? [q.uv[0], 0.22 + q.uv[1] * 0.16] : q.uv);
      md.triUV(a0.p, b0.p, b1.p, n, a0.c, b0.c, b1.c, uv(a0), uv(b0), uv(b1));
      md.triUV(a0.p, b1.p, a1.p, n, a0.c, b1.c, a1.c, uv(a0), uv(b1), uv(a1));
    }
  }
}

function norm3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

// ---------------------------------------------------------------------------
// Mesh accumulation helpers (non-indexed, vertex colours)
// ---------------------------------------------------------------------------

export class MeshData {
  constructor(withUv) {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.uv = withUv ? [] : null;
  }

  tri(a, b, c, n, ca, cb, cc) {
    this.pos.push(...a, ...b, ...c);
    this.nor.push(...n, ...n, ...n);
    this.col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
    if (this.uv) this.uv.push(a[0], a[2], b[0], b[2], c[0], c[2]);
  }

  /** Triangle with explicit uvs (world-independent). */
  triUV(a, b, c, n, ca, cb, cc, ua, ub, uc) {
    this.pos.push(...a, ...b, ...c);
    this.nor.push(...n, ...n, ...n);
    this.col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
    if (this.uv) this.uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
  }

  /** Top-facing quad covering tile [x,x+w]×[z,z+d] at height y. colorFn(vx, vz) → Color */
  quadTop(x, z, w, d, y, colorFn) {
    const p00 = [x, y, z];
    const p10 = [x + w, y, z];
    const p01 = [x, y, z + d];
    const p11 = [x + w, y, z + d];
    const c00 = colorFn(x, z);
    const c10 = colorFn(x + w, z);
    const c01 = colorFn(x, z + d);
    const c11 = colorFn(x + w, z + d);
    const n = [0, 1, 0];
    this.tri(p00, p01, p11, n, c00, c01, c11);
    this.tri(p00, p11, p10, n, c00, c11, c10);
  }

  disc(x, y, z, r, color, seg = 14) {
    const n = [0, 1, 0];
    const c2 = color.clone().multiplyScalar(1.15);
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const k0 = 1 + 0.15 * Math.sin(a0 * 3 + x);
      const k1 = 1 + 0.15 * Math.sin(a1 * 3 + x);
      this.tri([x, y, z], [x + Math.cos(a1) * r * k1, y, z + Math.sin(a1) * r * k1], [x + Math.cos(a0) * r * k0, y, z + Math.sin(a0) * r * k0], n, c2, color, color);
    }
  }

  build(uvScale) {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (this.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvScale === 1 ? this.uv : this.uv.map((v) => v * uvScale), 2));
    g.computeBoundingSphere();
    return g;
  }
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

/** Lambert ground: painted macro texture × tileable detail sampled by world position. */
function createGroundMaterial(macro, detail) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: macro });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDetail = { value: detail };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWorldXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;\nvarying vec2 vWorldXZ;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 det = texture2D(uDetail, vWorldXZ).rgb;
        diffuseColor.rgb *= mix(vec3(1.0), det * 1.06, 0.9);`);
  };
  mat.customProgramCacheKey = () => 'sakura-ground';
  return mat;
}

/** Lambert with gentle wind sway (vertex attribute `sway` = bend weight) and gusts. */
function createFoliageMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const uTime = { value: 0 };
  const uGust = { value: 0 };
  mat.userData.uTime = uTime;
  mat.userData.uGust = uGust;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.uniforms.uGust = uGust;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float sway;\nuniform float uTime;\nuniform float uGust;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph = position.x * 0.73 + position.z * 0.51;
        float amp = 0.035 * (1.0 + uGust * 2.2);
        float wv = sin(uTime * 1.7 + ph) * 0.6 + sin(uTime * 2.9 + ph * 1.7) * 0.4 + uGust * 0.8;
        transformed.x += wv * amp * sway;
        transformed.z += (cos(uTime * 1.3 + ph) * 0.022 + uGust * 0.015) * sway;
        transformed.y -= abs(wv) * amp * 0.25 * sway;`);
  };
  mat.customProgramCacheKey = () => 'sakura-foliage';
  return mat;
}

const WATER_VERT = /* glsl */`
#include <common>
#include <fog_pars_vertex>
varying vec2 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const WATER_FRAG = /* glsl */`
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform sampler2D uMask;
uniform vec4 uRect; // x0 y0 w h
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec3 uShore;
uniform float uFoamAmt;
uniform float uCaustic;
uniform float uGlow;
uniform float uMoon;
varying vec2 vWorld;

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
}

void main() {
  vec2 uv = (vWorld - uRect.xy) / uRect.zw;
  uv.y = 1.0 - uv.y;
  float m = texture2D(uMask, uv).r;
  float t = uTime;
  // slow diagonal flow with two drifting noise layers
  vec2 flow = vec2(t * 0.2, t * 0.13);
  float n1 = noise(vWorld * 1.15 + flow);
  float n2 = noise(vWorld * 2.4 - flow * 1.35 + 7.0);
  float wob = (noise(vWorld * 3.0) - 0.5) * 0.05;
  if (m < 0.5 + wob) discard;
  float depth = smoothstep(0.58, 1.0, m + (n1 - 0.5) * 0.12);
  vec3 col = mix(uShallow, uDeep, depth);
  // inner shade under the bank (reads as a step down into the water)
  col *= mix(0.78, 1.0, smoothstep(0.54, 0.72, m));
  // caustic web: bright where two drifting noise layers meet
  float web = 1.0 - abs(n1 - n2) * 8.0;
  col += clamp(web, 0.0, 1.0) * 0.07 * (0.45 + depth) * uCaustic;
  // sun glints
  float rip = sin(vWorld.x * 2.6 + n1 * 5.0 + t * 1.4) * sin(vWorld.y * 2.2 - n2 * 4.0 + t * 1.1);
  col += smoothstep(0.8, 0.98, rip) * 0.12 * uCaustic;
  // hand-painted wave lines drifting with the flow
  float wave = sin((vWorld.x * 0.9 + vWorld.y * 0.55 + n1 * 1.6) * 4.2 - t * 1.5);
  col += smoothstep(0.86, 1.0, wave) * 0.07 * uCaustic * (0.3 + depth);
  // shoreline: wet bank rim, then a wobbly foam line, then a soft band drifting outward
  float bank = 1.0 - smoothstep(0.53 + wob, 0.56 + wob, m);
  float edge = 0.6 + (n2 - 0.5) * 0.05;
  float foam = smoothstep(edge - 0.06, edge - 0.02, m) * (1.0 - smoothstep(edge - 0.01, edge + 0.012, m));
  float pulse = fract(t * 0.22);
  float band = smoothstep(0.03, 0.0, abs(m - (0.66 + pulse * 0.18))) * (1.0 - pulse) * 0.45;
  float pulse2 = fract(t * 0.22 + 0.5);
  band += smoothstep(0.03, 0.0, abs(m - (0.66 + pulse2 * 0.18))) * (1.0 - pulse2) * 0.3;
  col = mix(col, uFoam * 0.9, clamp((foam * 0.85 + band * 0.6 * step(0.55, n1 + 0.25)) * uFoamAmt, 0.0, 0.85));
  col = mix(col, uShore, bank);
  // moon reflection
  if (uMoon > 0.5) {
    float d = length((vWorld - vec2(uRect.x + uRect.z * 0.62, uRect.y + uRect.w * 0.35)) * vec2(1.0, 1.6));
    col += vec3(0.5, 0.55, 0.7) * smoothstep(1.4, 0.2, d + (n2 - 0.5) * 0.4) * 0.45;
  }
  col += uShallow * uGlow * (0.4 + 0.4 * n1);
  gl_FragColor = vec4(min(col, vec3(0.9)), 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function createWaterMaterial(mask, look, rect) {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uMask: { value: null },
        uRect: { value: new THREE.Vector4(rect.x0, rect.y0, rect.w, rect.h) },
        uDeep: { value: new THREE.Color(look.water.deep) },
        uShallow: { value: new THREE.Color(look.water.shallow) },
        uFoam: { value: new THREE.Color(look.water.foam) },
        uShore: { value: new THREE.Color(look.shore || look.bank) },
        uFoamAmt: { value: look.water.foamAmt ?? 1 },
        uCaustic: { value: look.water.caustic ?? 1 },
        uGlow: { value: look.water.glow || 0 },
        uMoon: { value: 0 },
      },
    ]),
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    fog: true,
  });
  mat.uniforms.uMask.value = mask; // textures must not go through UniformsUtils.merge (it clones)
  return mat;
}

const LAVA_FRAG = /* glsl */`
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform sampler2D uMask;
uniform vec4 uRect;
varying vec2 vWorld;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  vec2 uv = (vWorld - uRect.xy) / uRect.zw;
  uv.y = 1.0 - uv.y;
  float m = texture2D(uMask, uv).r;
  float wob = (noise(vWorld * 3.0) - 0.5) * 0.06;
  if (m < 0.5 + wob) discard;
  float t = uTime;
  vec2 p = vWorld * 1.6;
  float n = noise(p + vec2(t * 0.15, t * 0.1)) * 0.6 + noise(p * 2.3 - vec2(t * 0.22, 0.0)) * 0.4;
  float crust = smoothstep(0.4, 0.58, n);
  float vein = smoothstep(0.06, 0.0, abs(n - 0.4));
  vec3 hot = mix(vec3(0.85, 0.2, 0.04), vec3(1.0, 0.62, 0.15), vein);
  float pulse = 0.5 + 0.5 * sin(t * 1.3 + n * 6.0);
  hot *= 0.85 + 0.3 * pulse;
  vec3 col = mix(hot, vec3(0.2, 0.07, 0.06), crust * 0.9);
  col += vec3(1.0, 0.45, 0.1) * (1.0 - smoothstep(0.58, 0.75, m)) * 0.45;
  col = mix(col, vec3(0.16, 0.1, 0.1), 1.0 - smoothstep(0.52 + wob, 0.57 + wob, m));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function createLavaMaterial(mask, rect) {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uTime: { value: 0 }, uMask: { value: null }, uRect: { value: new THREE.Vector4(rect.x0, rect.y0, rect.w, rect.h) } },
    ]),
    vertexShader: WATER_VERT,
    fragmentShader: LAVA_FRAG,
    fog: true,
  });
  mat.uniforms.uMask.value = mask;
  return mat;
}

/**
 * An opaque-pass material that multiplies what is already drawn by `k` (0..1): the same
 * darkening as black at opacity 1 − k with normal blending, in whatever space the frame buffer is,
 * without joining the sorted transparent pass. Drawn after the ground (renderOrder 2).
 */
function createMultiplyMaterial(k) {
  return new THREE.ShaderMaterial({
    uniforms: { uK: { value: k } },
    vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uK; void main() { gl_FragColor = vec4(vec3(uK), 1.0); }',
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.ZeroFactor,
    blendDst: THREE.SrcColorFactor,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/** '#rrggbb' mixed toward another by t. */
function mixHexColor(a, b, t) {
  return `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
}

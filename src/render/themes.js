// Visual themes for battle maps (MapDef.theme). Colours are sRGB hex strings.
// `night`/`fog` variants come from the stage's scenery and are derived in `resolveLook`.
//
// V2 fields (painted ground + composed scenery):
//   groundStyle  painter style: grass | moss | sand | snow | ash | metal (textures.paintGround)
//   groundShade  darker ground tone for dips, clover: clover / moss patch colour, wet: puddle colour
//   dirt         worn earth beside the road, pebble: road-edge pebbles
//   frame        prop types cycled around the map border (fence / hedge / flower bed / rocks…)
//   life         ambient life flags: butterflies, birds, koi, clouds, fireflies, sparkle
//   gate         { spawn, goal } colours for the entrance / exit gates
//
// Gate Arc (the city, src/render/city/):
//   spawnGate / goalGate  prop types for the entrance / exit (default spawnGate / goalGate); like the
//                shipped gates they stand on the board edge, where the road leaves the board
//   rocks        [single, cluster] props for 'R' tiles (default rock / boulder)
//   nightLight   this theme's own night lighting (default: the shared moonlit preset)
//   weatherColors petal-weather particle colours (the city mixes in paper litter)
//   city         the city kit's config: sidewalk / kerb colours, lawn, glass tints (cityKit.js);
//                `kit: 'campus'` picks the school set (campusProps.js), `drones: false` no drones
//   goalVariant  the goalGate prop's variant (a map's city.goalVariant wins)
//   groundPaint  overrides of the ground painter's style flags (textures.paintGround, e.g. kerb bands on grass)
//   nightGround  ground colours used at night instead (the campus lawns go dark green);
//   nightCity    city kit colours used at night instead (the campus beds and sidewalk bands)
//
// Gate Arc Step 3 (S3a):
//   DISTRICTS    a map's district on a theme (MapDef.district, e.g. 'oldtown' on `city`): its own
//                ground, road and building set, merged by resolveLook when the map is given
//   BURNING      the `ruined: 'burning'` table (StageDef.scenery.ruined), resolved last: an ash-dusted
//                board under a dark sky, the road kept the lightest band, amber the one accent
//
// Gate Arc Step 4 (S4a):
//   DISTRICTS.highway  the mountain highway (MapDef.district 'highway' on `city`): gravel verges, a
//                pale `concrete` road with a dark hard shoulder, roadside embankments and depots,
//                sound walls on the border, crash barriers instead of kerbs, highway lamps, the
//                `highway` tunnel style (concrete portals, jet fans, sodium lamps), a concrete flyover
//   DUSK         StageDef.look.dusk: a warm low sun under a violet sky (4-7), never night
//   FROST        scenery keyword 'frost': a cold wash on the ground, frost on the rails, flurries
//   BRIDGE_LAYER scenery keyword 'snowBridge': the Brigade's folding military deck (navy steel,
//                amber hazard rails) over the water instead of the theme's planks (4-10)
//   'snowCover'  scenery keyword: snow on the board's north rows (terrain.js paints it), flurries
//
// Gate Arc Step 5 (S5a):
//   THEMES.drowned  the flooded Line 2 under Itomachi (MapDef.theme 'drowned'): the city kit with its own
//                set (`city.kit: 'drowned'`, src/render/city/drownedProps.js), wet station tiles, a pale
//                `grating` road (the lightest band), retaining walls, the `subway` tunnel style with red
//                emergency lamps, dark teal flood water; lit underground (`forceNight`, its own light)
//   EMERGENCY    the drowned kit's small accent lamps (red, amber): never on the road
//   DISTRICTS.park  the reservoir park (MapDef.district 'park' on `city`): mown lawns with paved bands,
//                park lamps, the dam wall on its H tiles, willows, the reservoir (parkProps.js)
//   'noonGateFrost'  scenery keyword: rime on the pipes round the Noon Gate (look.frost) without snow

const BASE = {
  ground: ['#9fd77a', '#93cf6f'], // two tones blended by noise (no checker any more)
  groundSpeck: '#b7e48f',
  groundShade: '#72b45a',
  clover: '#5fa64f',
  wet: '#4f8a52',
  dirt: '#c9aa78',
  pebble: '#c6bba9',
  groundStyle: 'grass',
  flowers: ['#ffffff', '#ffd1e3', '#ffe680', '#ff9ec4'],
  bank: '#a47b58',
  bankDark: '#7a5a40',
  shore: '#e2cfa4',
  path: { style: 'flagstone', color: '#efe3cf', curb: '#c8b89f', side: '#b8a68a' },
  bridge: { deck: '#c58f5a', rail: '#8a5a36', post: '#7a4a2a', lacquer: false, overpass: '#d9b98c', girder: '#8b7660' },
  // Tracks v3 tunnels: the mound over a buried section (top → side) and the portal arch stones
  tunnel: { top: '#86c46a', side: '#8d7a62', portal: '#cfc6b8', dark: '#1c1822' },
  water: { deep: '#2f9fd0', shallow: '#78dcef', foam: '#ffffff', glow: 0 },
  void: 'lava',
  bg: '#bfe6ff',
  trees: ['round'],
  treeColors: { leaf: '#6cc45a', leaf2: '#4fae4a', trunk: '#8a5a3a' },
  rock: '#a9adb8',
  building: 'house',
  wall: 'hedge',
  frame: ['fence', 'fence', 'flowerBed', 'fence', 'hedge'],
  life: { butterflies: true, birds: true, koi: true, clouds: true, fireflies: true, sparkle: false },
  gate: { spawn: '#b56bff', goal: '#ff7aa2' },
  light: { sky: '#ffffff', ground: '#a6c79a', hemi: 1.15, key: '#fff0d8', keyI: 1.55, fill: '#cfe6ff', fillI: 0.35 },
  weather: null,
  ambient: null,
};

/** Theme table. Each entry overrides BASE. */
export const THEMES = {
  sakura: {
    ground: ['#a3dc78', '#8fcf66'],
    groundSpeck: '#c9ec98',
    groundShade: '#74b85c',
    clover: '#62a853',
    dirt: '#cfae7c',
    pebble: '#cfc3b0',
    path: { style: 'flagstone', color: '#f4e7d2', curb: '#d6c3a5', side: '#c3ab8a' },
    tunnel: { top: '#94d06c', side: '#9a8468', portal: '#efe3cf' },
    trees: ['sakura', 'sakura', 'round'],
    treeColors: { leaf: '#ffb3cf', leaf2: '#ff8fb8', trunk: '#7d5240' },
    building: 'house',
    wall: 'hedge',
    frame: ['fence', 'fence', 'flowerBed', 'fence', 'hedge', 'flowerBed'],
    weather: 'petals',
    bg: '#c9ecff',
  },
  lake: {
    ground: ['#95d47f', '#86c975'],
    groundSpeck: '#b9e69e',
    groundShade: '#6aae62',
    clover: '#579e5a',
    dirt: '#c7a97a',
    pebble: '#c2b8a8',
    path: { style: 'dirt', color: '#ead7aa', curb: '#c9ae7b', side: '#b29466' },
    tunnel: { top: '#86c975', side: '#8f7a5c', portal: '#d9cbb0' },
    water: { deep: '#2b8fc8', shallow: '#6fd3ea', foam: '#f4ffff', glow: 0 },
    trees: ['round', 'willow', 'round'],
    treeColors: { leaf: '#5fbf62', leaf2: '#3f9f55', trunk: '#7a5236' },
    building: 'hut',
    wall: 'reedFence',
    frame: ['reedFence', 'reedFence', 'flowerBed', 'reedFence', 'rock'],
    bg: '#b8e3f5',
  },
  shrine: {
    ground: ['#8cc87a', '#7fbc70'],
    groundSpeck: '#aedb92',
    groundShade: '#5f9a56',
    clover: '#4f8f52',
    dirt: '#b7a48a',
    pebble: '#b9bcc4',
    shore: '#b4b8c0',
    path: { style: 'flagstone', color: '#dde1e8', curb: '#aeb4bf', side: '#9aa1ad' },
    tunnel: { top: '#7fbc70', side: '#7a7066', portal: '#c4473e', hall: '#efe4cf', roof: '#4a4f5c' },
    bridge: { deck: '#c4473e', rail: '#a83832', post: '#7e2a26', lacquer: true, overpass: '#c4473e', girder: '#5e3a32' },
    trees: ['cedar', 'sakura', 'cedar'],
    treeColors: { leaf: '#3f8f5a', leaf2: '#2f7449', trunk: '#6a4632' },
    building: 'shrine',
    wall: 'shrineWall',
    frame: ['shrineWall', 'shrineWall', 'stoneLanternPost', 'shrineWall', 'hedge'],
    rock: '#9ca3ae',
    roofs: ['#3f8f86', '#b8463e', '#4a6fa8'],
    bg: '#c7d9ee',
  },
  mountain: {
    ground: ['#b1d08e', '#a3c684'],
    groundSpeck: '#e4eee2',
    groundShade: '#7f9f6c',
    clover: '#6d9a5e',
    dirt: '#b8ab92',
    pebble: '#aeb2b8',
    shore: '#a7a49c',
    path: { style: 'cobble', color: '#c8c2b8', curb: '#9d968b', side: '#8a8378' },
    tunnel: { top: '#9fa3ab', side: '#7c7f86', portal: '#c8c2b8', hall: '#a8a196', roof: '#56606e' },
    trees: ['pine', 'pine', 'cedar'],
    scatter: ['pine', 'cliff', 'pine', 'cliff', 'cedar', 'boulder'],
    treeColors: { leaf: '#3d7f5a', leaf2: '#2e6a4b', trunk: '#6a4a36' },
    rock: '#9fa3ab',
    building: 'tower',
    wall: 'stoneWall',
    frame: ['stoneWall', 'stoneWall', 'rock', 'stoneWall', 'pineSmall'],
    weather: 'snow',
    bg: '#d6e6f2',
  },
  marsh: {
    ground: ['#86ad6a', '#78a05f'],
    groundSpeck: '#a2c47f',
    groundShade: '#5d8249',
    clover: '#4e7a44',
    wet: '#43603c',
    dirt: '#8f7a56',
    pebble: '#8f9484',
    groundStyle: 'moss',
    bank: '#6f5a40',
    bankDark: '#4f3f2c',
    shore: '#6f5d45',
    path: { style: 'planks', color: '#bd9d74', curb: '#8a6e4c', side: '#755b3d' },
    tunnel: { top: '#7a5c3c', side: '#5e452c', portal: '#9c7a52', dark: '#16130f' },
    // boardwalks run on over short soggy patches; raised spans are old stone causeway bridges
    // (grey slabs, stone parapets, dark fascia) so over / under never blur into one tangle of planks
    bridge: { deck: '#9c7a52', rail: '#6d5236', post: '#574029', lacquer: false, overpass: '#a3a69c', girder: '#4a4c47', overRail: '#c9cbc2', boardwalk: true, shadow: 0.5 },
    water: { deep: '#245a52', shallow: '#3f8a70', foam: '#9cc8a8', glow: 0, foamAmt: 0.45, caustic: 0.3 },
    trees: ['willow', 'dead', 'willow'],
    treeColors: { leaf: '#6f9a55', leaf2: '#557f45', trunk: '#5a4636' },
    rock: '#8c9289',
    building: 'stiltHut',
    fogTint: '#c8d8cc',
    wall: 'reedFence',
    frame: ['reedFence', 'reeds', 'reedFence', 'rock', 'reeds'],
    life: { butterflies: false, birds: false, koi: false, clouds: false, fireflies: true, sparkle: false },
    bg: '#a9c2b4',
  },
  foundry: {
    ground: ['#b3ada2', '#a69f94'],
    groundSpeck: '#c9c3b8',
    groundShade: '#7f7a74',
    clover: '#8d8a84',
    wet: '#4e4a52',
    rust: '#9a6a48',
    dirt: '#8f8678',
    pebble: '#6f7682',
    groundStyle: 'metal',
    flowers: ['#ffd43b', '#ff9f43', '#ffffff'],
    bank: '#6c6a70',
    bankDark: '#4a4850',
    shore: '#8a909b',
    path: { style: 'metal', color: '#9ea5b0', curb: '#ffcc33', side: '#6f7682' },
    tunnel: { top: '#7d8590', side: '#5d636d', portal: '#ffcc33', dark: '#121318', hall: '#8a919c', roof: '#3c4250' },
    bridge: { deck: '#7d8590', rail: '#ffcc33', post: '#4d535c', lacquer: false, overpass: '#b5743a', girder: '#3c4250' },
    water: { deep: '#1f8fa8', shallow: '#53e0f0', foam: '#d8ffff', glow: 0.35 },
    trees: ['scrap'],
    scatter: ['rock', 'boulder', 'barrel', 'pipes', 'crate'],
    scatterDensity: 0.5,
    treeColors: { leaf: '#7a7f88', leaf2: '#5c6169', trunk: '#4d535c' },
    rock: '#8d8478',
    building: 'machine',
    detail: 'pebbles',
    detailDensity: 0.2,
    wall: 'brickWall',
    frame: ['hazardRail', 'hazardRail', 'brickWall', 'hazardRail', 'pipes'],
    life: { butterflies: false, birds: false, koi: false, clouds: false, fireflies: false, sparkle: false },
    gate: { spawn: '#ff8a3d', goal: '#4cc9f0' },
    weather: 'embers',
    bg: '#c9c4bd',
    light: { sky: '#fff4e6', ground: '#a19a90', hemi: 1.1, key: '#ffe2c0', keyI: 1.5, fill: '#cfe0ff', fillI: 0.3 },
  },
  festival: {
    ground: ['#a3d97d', '#93cf70'],
    groundSpeck: '#c6ea9c',
    groundShade: '#73b35c',
    clover: '#62a552',
    dirt: '#c9a06f',
    pebble: '#c9b4a0',
    path: { style: 'brick', color: '#ecc9a6', curb: '#c58a6a', side: '#a87458' },
    tunnel: { top: '#d24b45', side: '#a87458', portal: '#ecc9a6' },
    bridge: { deck: '#d24b45', rail: '#b33a36', post: '#7e2a26', lacquer: true, overpass: '#d24b45', girder: '#5e3a32' },
    trees: ['maple', 'sakura', 'maple'],
    treeColors: { leaf: '#ff8a4c', leaf2: '#f0643a', trunk: '#6d4433' },
    building: 'stall',
    wall: 'festivalWall',
    frame: ['festivalWall', 'bunting', 'festivalWall', 'bunting', 'flowerBed'],
    gate: { spawn: '#b56bff', goal: '#ffd84d' },
    bg: '#ffe2c9',
  },
  snow: {
    ground: ['#f1f6fc', '#e4edf7'],
    groundSpeck: '#ffffff',
    groundShade: '#c3d4e8',
    clover: '#d3e2f2',
    dirt: '#c9c4c0',
    pebble: '#a7b3c2',
    groundStyle: 'snow',
    flowers: ['#bfe3ff', '#ffffff', '#d7c9ff'],
    bank: '#9fb4c8',
    bankDark: '#7b90a6',
    shore: '#dfe8f3',
    path: { style: 'cobble', color: '#bcb9c8', curb: '#8f8ca0', side: '#7d7a8e' },
    tunnel: { top: '#eef6fb', side: '#a9c2d6', portal: '#8fb9e6', dark: '#1d2a3e' },
    // (a notch darker than the snow in greyscale: the river reads as water, not a paler drift)
    water: { deep: '#2a6c9c', shallow: '#6fb2d2', foam: '#ffffff', glow: 0 },
    trees: ['snowPine', 'snowPine', 'pine'],
    scatter: ['snowPine', 'cliff', 'snowPine', 'boulder', 'snowPine'],
    treeColors: { leaf: '#3c7a62', leaf2: '#2f6552', trunk: '#5e4636' },
    rock: '#a7b3c2',
    building: 'snowHouse',
    detail: 'pebbles',
    detailDensity: 0.12,
    wall: 'stoneWall',
    frame: ['snowFence', 'snowFence', 'rock', 'snowFence', 'pineSmall'],
    life: { butterflies: false, birds: true, koi: false, clouds: true, fireflies: false, sparkle: true },
    gate: { spawn: '#b56bff', goal: '#7fd0ff' },
    weather: 'snow',
    bg: '#dfeaf6',
    light: { sky: '#ffffff', ground: '#c9d6e6', hemi: 1.05, key: '#fff6ea', keyI: 1.45, fill: '#d6e8ff', fillI: 0.4 },
  },
  volcano: {
    ground: ['#6a5a5a', '#5c4e4e'],
    groundSpeck: '#8a7876',
    groundShade: '#3f3434',
    clover: '#4a3f42',
    dirt: '#4e4040',
    pebble: '#6d5f5f',
    groundStyle: 'ash',
    flowers: ['#ff9f43', '#ffd43b', '#ff6b35'],
    bank: '#4a3c3c',
    bankDark: '#2e2424',
    shore: '#4a3c3c',
    path: { style: 'cobble', color: '#ab9a8d', curb: '#7d6c62', side: '#5f5048' },
    tunnel: { top: '#5a4a44', side: '#3d302c', portal: '#ab9a8d', dark: '#140c0a' },
    bridge: { deck: '#7a6458', rail: '#3d302c', post: '#2e2424', lacquer: false, overpass: '#8a7266', girder: '#2e2424' },
    water: { deep: '#2f9fb0', shallow: '#7fe0e0', foam: '#ffffff', glow: 0.15 },
    trees: ['charred', 'pine'],
    scatter: ['charred', 'cliff', 'boulder', 'cliff', 'obsidian'],
    treeColors: { leaf: '#4f6b4f', leaf2: '#3d553f', trunk: '#3a2e2a' },
    rock: '#4d4246',
    building: 'obsidian',
    detail: 'crack',
    detailDensity: 0.2,
    wall: 'basaltWall',
    frame: ['basaltWall', 'rock', 'basaltWall', 'obsidian', 'basaltWall'],
    life: { butterflies: false, birds: false, koi: false, clouds: false, fireflies: false, sparkle: false },
    gate: { spawn: '#ff6a2a', goal: '#ffd84d' },
    weather: 'embers',
    bg: '#5d4a4a',
    light: { sky: '#ffe2cc', ground: '#6b4a40', hemi: 1.0, key: '#ffc58f', keyI: 1.5, fill: '#ff8a5c', fillI: 0.35 },
  },
  night: {
    ground: ['#6f9e7c', '#639272'],
    groundSpeck: '#8ab896',
    groundShade: '#4a7458',
    clover: '#3f6a4f',
    dirt: '#8c8c7c',
    pebble: '#9aa2b4',
    shore: '#8e94a6',
    path: { style: 'flagstone', color: '#bcc2d3', curb: '#8e95aa', side: '#7a8197' },
    tunnel: { top: '#4f6f8f', side: '#3d5068', portal: '#bcc2d3' },
    trees: ['cedar', 'dead', 'cedar'],
    treeColors: { leaf: '#3e6d63', leaf2: '#2f5850', trunk: '#4d3d3a' },
    rock: '#8790a3',
    building: 'shrine',
    wall: 'shrineWall',
    frame: ['shrineWall', 'stoneLanternPost', 'shrineWall', 'hedge', 'shrineWall'],
    life: { butterflies: false, birds: false, koi: true, clouds: false, fireflies: true, sparkle: false },
    bg: '#2a3350',
    forceNight: true,
  },
  arena: {
    ground: ['#e6d5ae', '#dcc9a0'],
    groundSpeck: '#f3e7cb',
    groundShade: '#c4ad82',
    clover: '#cbb98f',
    dirt: '#cdb98f',
    pebble: '#d6c8ae',
    groundStyle: 'sand',
    path: { style: 'flagstone', color: '#f8ecd8', curb: '#d1b98f', side: '#bca47a' },
    tunnel: { top: '#e3cfa0', side: '#bca47a', portal: '#f8ecd8' },
    trees: ['sakura', 'round'],
    treeColors: { leaf: '#ffb3cf', leaf2: '#ff8fb8', trunk: '#7d5240' },
    building: 'stands',
    wall: 'stands',
    frame: ['stands', 'stands', 'bunting', 'stands', 'flowerBed'],
    weather: 'petals',
    bg: '#cfeaff',
  },
  // ----- Gate Arc · Noon: Itomachi, Sensei's present-day city (src/render/city/) -------
  // Warm and lived-in: pale paving with slab seams, asphalt streets with lane markings and
  // kerbs, shop fronts with green and red awnings, utility poles and wires, cherry street trees,
  // a railway where the map lays one (map.city.railway) and the Brigade's patrol drones circling
  // over the side skirts. The Petal Gate tears open in the street (petalRift); the goal is the
  // shelter door (shelterDoor). No map uses it before the Gate Arc's Act II stages.
  city: {
    ground: ['#e9e6e0', '#e1ddd5'],
    groundSpeck: '#f4f2ee',
    groundShade: '#c4beb3',
    clover: '#8fbf6a',
    wet: '#b9c3c9',
    dirt: '#e4dbcc',
    pebble: '#c9c0b0',
    groundStyle: 'paved',
    flowers: ['#7cc96a', '#5fae55', '#ffd166', '#ff9ec4'],
    bank: '#a8a093',
    bankDark: '#857d71',
    shore: '#d2cabb',
    path: { style: 'asphalt', color: '#ffffff', curb: '#f4f1ea', side: '#8a8d96', base: '#4b505b', crisp: true, plainJunction: true },
    bridge: { deck: '#bdb7ac', rail: '#eef0f2', post: '#8f8a80', lacquer: false, overpass: '#cbc5ba', girder: '#7d7870', overRail: '#e9ecef', grating: false, shadow: 0.32 },
    tunnel: { style: 'subway', top: '#d8d0c2', side: '#c4bcae', portal: '#f2efe8', dark: '#22252e', stripe: '#4f9a62', hall: '#f3e7d0', roof: '#8fa3b8', glass: '#9cc4d8' },
    water: { deep: '#2f7fae', shallow: '#68b8d0', foam: '#eef8ff', glow: 0.02 },
    trees: ['streetTree'],
    scatter: ['streetTree'],
    scatterDensity: 0.3,
    treeColors: { leaf: '#ffb3cf', leaf2: '#ff8fb8', trunk: '#7d5240' },
    rocks: ['bollard', 'planterBox'],
    rock: '#a9a49a',
    building: 'cityBlock',
    wall: 'cityWall',
    frame: ['guardRail', 'guardRail', 'planterBox', 'guardRail', 'bollard'],
    detail: 'manhole',
    detailDensity: 0.05,
    life: { butterflies: false, birds: true, koi: false, clouds: true, fireflies: false, sparkle: false },
    gate: { spawn: '#b46cff', goal: '#ff7aa2' },
    // on the board edge like every shipped gate: the column walks out of the rift's leaning ring
    // onto the board, and into the shelter's doorway as it leaves (the block stands in the skirt)
    spawnGate: 'petalRift',
    goalGate: 'shelterDoor',
    weather: 'petals',
    weatherColors: ['#ffc2d8', '#ffb3cf', '#ffd6e6', '#ffffff', '#f2ead8'],
    light: { sky: '#fff8ee', ground: '#b8ae9c', hemi: 1.05, key: '#fff0dc', keyI: 1.45, fill: '#d6e4ff', fillI: 0.34 },
    nightLight: { sky: '#9fb2ff', ground: '#2c3150', hemi: 0.75, key: '#cdd6ff', keyI: 0.95, fill: '#ff8fd6', fillI: 0.4 },
    bg: '#cfe1f2',
    city: {
      sidewalk: '#ddd3c2', kerb: '#f6f4ef', kerbSide: '#b9b0a2', lawn: '#9fcf7c', plaza: ['#efe4d2', '#e6d2bc'],
      glass: { glassA: '#86b9d6', glassB: '#e2f1f8', warm: '#ffe6bf' },
    },
  },
  // ----- Gate Arc · Noon: Itomachi Hilltop High, Sensei's old school on the hill by the lake --------
  // The city kit with a campus set (kit 'campus', src/render/city/campusProps.js): mown lawns with
  // paved bands along a pale campus road (a red running track where a map asks: map.city.road),
  // classroom wings with big framed windows, the gym, club huts, bike sheds, a flagpole, cherry
  // trees and a lakeshore with boat racks. Every Act 2 stage is a night stage: its own cool blue
  // night, warm windows, fireflies over the reeds and a searchlight sweeping the water
  // (map.city.searchlight). The lawns go deep green at night so the road stays the lightest band.
  campus: {
    ground: ['#93c97c', '#88bf72'],
    groundSpeck: '#b4dc98',
    groundShade: '#6ca85c',
    clover: '#5f9d52',
    wet: '#7fa08a',
    dirt: '#c9c2b4',
    pebble: '#b9b2a4',
    groundStyle: 'grass',
    // the painter's sidewalk bands along every road (the city's kerb flag) on mown lawn
    groundPaint: { kerb: 1, flowers: 0.35, cloverAmt: 0.45 },
    // lawns at night: deep green, well under the road's tone (resolveLook)
    nightGround: { ground: ['#4d7a5f', '#467257'], groundSpeck: '#5a876a', groundShade: '#3a5f4c', clover: '#416b54' },
    // … and the kit's painted beds and bands with them
    nightCity: { lawn: '#4f8a5c', sidewalk: '#8f8c84' },
    flowers: ['#ffffff', '#ffd1e3', '#ffe680', '#ff9ec4'],
    bank: '#9a968c',
    bankDark: '#76726a',
    shore: '#b8b2a4',
    // a pale campus road (its texture tone: textures.pathTexture asphalt `tone`), white edge lines
    path: { style: 'asphalt', color: '#ffffff', curb: '#f4f1ea', side: '#9a9da6', base: '#6d727c', crisp: true, plainJunction: true, tone: 1.95 },
    bridge: { deck: '#b9a283', rail: '#eef0f2', post: '#7d6a55', lacquer: false, overpass: '#c9c3b8', girder: '#6f6a62', overRail: '#e9ecef', grating: false, shadow: 0.32 },
    // the corridor under the main building: the composed hall (school cream, navy band, a pale roof)
    tunnel: { style: 'subway', top: '#d9d2c4', side: '#c4bcae', portal: '#f2efe8', dark: '#1f2430', stripe: '#3d5a8a', hall: '#efe6d6', roof: '#7d8a9a', glass: '#a8c8dc' },
    // the lake at night: deep and calm (a soft caustic web) so the road stays the lightest band
    water: { deep: '#245f8c', shallow: '#4c90ae', foam: '#dfeefa', glow: 0.03, caustic: 0.45, foamAmt: 0.7 },
    trees: ['streetTree', 'sakura'],
    scatter: ['sakura', 'streetTree', 'round'],
    scatterDensity: 0.45,
    treeColors: { leaf: '#ffb3cf', leaf2: '#ff8fb8', trunk: '#7d5240' },
    rocks: ['planterBox', 'flowerBoxes'],
    rock: '#a9a49a',
    building: 'schoolBlock',
    wall: 'cityWall',
    frame: ['planterBox', 'guardRail', 'hedge', 'planterBox', 'hedge'],
    detail: 'tuft',
    detailDensity: 0.12,
    life: { butterflies: false, birds: false, koi: false, clouds: true, fireflies: true, sparkle: false },
    gate: { spawn: '#b46cff', goal: '#ff7aa2' },
    spawnGate: 'petalRift',
    goalGate: 'shelterDoor',
    /** shelterDoor variant: the school's main entrance (cityProps SHELTER_KINDS) */
    goalVariant: 1,
    weather: 'petals',
    weatherColors: ['#ffc2d8', '#ffb3cf', '#ffd6e6', '#ffffff'],
    light: { sky: '#fff8ee', ground: '#a8b89c', hemi: 1.08, key: '#fff0dc', keyI: 1.45, fill: '#d6e4ff', fillI: 0.34 },
    // a cool blue lakeside night; the warm fill is the classroom windows
    nightLight: { sky: '#a6bcff', ground: '#2e3a56', hemi: 0.9, key: '#d2dcff', keyI: 1.1, fill: '#ffc89a', fillI: 0.32 },
    bg: '#cfe4ef',
    city: {
      kit: 'campus',
      sidewalk: '#a7a399', kerb: '#eeebe4', kerbSide: '#8f8b82', lawn: '#7fb86c', plaza: ['#cfc8ba', '#c4bdae'],
      glass: { glassA: '#8fb9cf', glassB: '#e2eef4', warm: '#ffe2b0' },
      // no Brigade drones over the school (dressing stays the city's)
      drones: false,
    },
  },
  // ----- Gate Arc · Noon: the Drowned Line, Itomachi's old Line 2 under the city, flooded --------------
  // The city kit with the drowned set (kit 'drowned', src/render/city/drownedProps.js): wet station
  // tiles with grout lines and puddles, a pale galvanised `grating` road (the lightest band, a yellow
  // platform edge), the painted platform band along it, station blocks, retaining walls on the
  // border, pump halls and the lake mosaic in the skirt, work lamps and red emergency lamps along the
  // lanes, the `subway` tunnel style, dark teal flood water. Underground: always lit by its own lamps
  // (forceNight with its own cool light), fog on every drowned stage (StageDef.scenery.fog). The
  // Petal Gate tears open in the street as in the city; the goal is the station exit (goalVariant 3).
  drowned: {
    ground: ['#66777a', '#5e6f72'],
    groundSpeck: '#738487',
    groundShade: '#4b5a5f',
    clover: '#506259',
    wet: '#3e4f58',
    dirt: '#6d7575',
    pebble: '#7d8584',
    groundStyle: 'tile',
    flowers: ['#5d6d6a', '#6a7a76'],
    bank: '#4a5458',
    bankDark: '#353d42',
    shore: '#56636a',
    // the grating carries its own colour (textures.pathTexture 'grating'): the theme's tint is white
    path: { style: 'grating', color: '#ffffff', curb: '#e7c64a', side: '#4f565c', base: '#454b51', crisp: true, plainJunction: true },
    // decks over the flooded track bed are platform slabs (concrete, a yellow edge, no rails: trackMesh
    // `platform`); an overpass is the pipe gantry (steel grating with pipes along its girders)
    bridge: { deck: '#a7aaa6', rail: '#e7c64a', post: '#5a6066', lacquer: false, overpass: '#b4b9bd', girder: '#40464c', overRail: '#e7c64a', grating: true, platform: true, pipes: true, shadow: 0.34 },
    // the Line 2 bores: square portals, the line's blue band, red emergency lamps (the kit hangs them)
    tunnel: { style: 'subway', top: '#58626a', side: '#465057', portal: '#c4c2b8', dark: '#0b0f13', stripe: '#3f8fbf', hall: '#7f888c', roof: '#3a434a', glass: '#3c5560', lamp: '#ff4d5a' },
    // flood water: deep, dark teal, a soft caustic web (darker than the tiles in greyscale)
    water: { deep: '#0f363e', shallow: '#1d5660', foam: '#8fbcbc', glow: 0.04, caustic: 0.35, foamAmt: 0.45 },
    trees: ['pumpUnit', 'pipes'],
    scatter: ['pipeRun', 'maintenanceCart', 'pipes', 'crate', 'pumpUnit'],
    scatterDensity: 0.3,
    treeColors: { leaf: '#5d6d6a', leaf2: '#4d5d5a', trunk: '#4d535c' },
    rocks: ['maintenanceCart', 'pumpUnit'],
    rock: '#7d8584',
    building: 'stationBox',
    wall: 'retainingWall',
    frame: ['pipeRun', 'pipeRun', 'bollard', 'pipeRun', 'crate'],
    detail: 'manhole',
    detailDensity: 0.03,
    life: { butterflies: false, birds: false, koi: false, clouds: false, fireflies: false, sparkle: false },
    gate: { spawn: '#b46cff', goal: '#ff7aa2' },
    spawnGate: 'petalRift',
    goalGate: 'shelterDoor',
    /** shelterDoor variant: the Line 2 station exit (cityProps SHELTER_KINDS) */
    goalVariant: 3,
    weather: null,
    // underground: always lit by its own lamps, never by the sky (its dark keeps its own colour)
    forceNight: true,
    underground: true,
    light: { sky: '#cfe2ea', ground: '#3a4a52', hemi: 1.0, key: '#e6f0f4', keyI: 1.2, fill: '#ffb48a', fillI: 0.3 },
    nightLight: { sky: '#a9cad6', ground: '#25333b', hemi: 1.0, key: '#dcebf2', keyI: 1.2, fill: '#ff9a7a', fillI: 0.34 },
    /** the fog down here (StageDef.scenery.fog): a dark teal haze, not the moonlit blue */
    nightFog: '#2f434b',
    bg: '#0d171b',
    city: {
      kit: 'drowned', drones: false, kerbs: false,
      // the painted platform band along every lane (textures.paintGround kerb band) and its yellow edge
      sidewalk: '#7f878a', kerb: '#d9b740', kerbSide: '#4a5056', lawn: '#4f6159', plaza: ['#6c7779', '#667173'],
      glass: { glassA: '#3c5a66', glassB: '#7fa2ae', warm: '#ffe2b0' },
    },
  },
};

/**
 * The drowned kit's small accent lamps (Gate Arc S5a, src/render/city/drownedProps.js): red emergency
 * lamps (they stay lit and pulse through a blackout) and amber beacons. Small lamps only, never on the road.
 */
export const EMERGENCY = Object.freeze({ red: '#ff4d5a', amber: '#ffb347' });

/**
 * `stage.look.night === 'lantern'` (Halloween event stages): night re-lit warm — a deep
 * indigo / violet sky, fog and ambient, a warm orange key light (lanterns, pumpkins) and a
 * slightly orange-tinted hemisphere. Kept bright enough that the road, the tiles and the
 * monsters read clearly.
 */
export const LANTERN_NIGHT = {
  light: { sky: '#a98ee8', ground: '#6a3c34', hemi: 0.8, key: '#ffb46a', keyI: 1.3, fill: '#8f72f0', fillI: 0.38 },
  bg: '#2a1d4a',
  fogColor: '#4b3670',
  groundTint: '#5e4c84',
  shadeTint: '#3a2856',
  waterDeep: '#22175a',
  waterShallow: '#5a4a9a',
  firefly: '#ffad4a',
  gate: { spawn: '#b56bff', goal: '#ff9a3d' },
};

/**
 * Map districts (Gate Arc, `MapDef.district`): a district re-dresses its theme's board. Old Town
 * (`city` maps of the Bell Festival, GATE_ARC §18.1): plaster and stone ground with a stone gutter
 * along every lane (no raised kerbs), pale stone setts on the road (the lightest band, by day and
 * by night), wooden houses with tiled roofs (oldTownProps.js), cherry trees, lantern strings on
 * the poles instead of bare wires. Keys merge over the theme (path / city merge field by field).
 */
export const DISTRICTS = {
  oldtown: {
    ground: ['#b8ad98', '#b0a48f'],
    groundSpeck: '#c6bca8',
    groundShade: '#978a74',
    clover: '#8fae6a',
    wet: '#a9aeb0',
    dirt: '#cfc2ab',
    pebble: '#b3a690',
    groundStyle: 'stone',
    shore: '#c4b8a2',
    bank: '#9a8f7e',
    bankDark: '#776d5f',
    // stone setts carry their own colour (textures.pathTexture 'setts'): the theme's tint is white
    path: { style: 'setts', color: '#ffffff', curb: '#efe6d2', side: '#8f8474', base: '#837867', crisp: true, plainJunction: false },
    trees: ['sakura', 'streetTree'],
    scatter: ['sakura', 'streetTree'],
    building: 'oldHouse',
    frame: ['planterBox', 'bollard', 'planterBox', 'guardRail', 'bollard'],
    // the stone ground darkens at night under the setts' tone (the road stays the lightest band)
    nightGround: { ground: ['#9a917f', '#928a78'], groundSpeck: '#a59c8a', groundShade: '#7b7364', clover: '#5f7a52' },
    nightCity: { sidewalk: '#8a8170', kerb: '#766e60', lawn: '#56784c' },
    city: {
      district: 'oldtown', kerbs: false, lanterns: true,
      sidewalk: '#b9ad97', kerb: '#9f937e', kerbSide: '#8a7f6c', lawn: '#8fb46e', plaza: ['#d9cdb6', '#cdbfa6'],
    },
  },
};

/**
 * The mountain highway (Gate Arc S4a, `MapDef.district: 'highway'` on `city` maps of Act 4,
 * GATE_ARC §18.1): gravel verges with scrub grass, a pale concrete road (the lightest band: its own
 * colour, textures.pathTexture 'concrete') with a dark hard shoulder painted along it, steel crash
 * barriers instead of raised kerbs, roadside embankments, rock cuts and depots on the board
 * (highwayProps.js roadsideBlock), sound walls on the border, highway lamps instead of utility
 * poles, pines and a concrete flyover in the skirt, concrete tunnel portals with jet fans.
 */
const HIGHWAY = {
  ground: ['#8f8a80', '#878278'],
  groundSpeck: '#a29d93',
  groundShade: '#6f6a62',
  clover: '#7f8b5e',
  wet: '#7b7b78',
  dirt: '#9b958b',
  pebble: '#a49e93',
  groundStyle: 'gravel',
  shore: '#9e998f',
  bank: '#807b73',
  bankDark: '#635f59',
  // concrete slabs carry their own colour (textures.pathTexture 'concrete'): the theme's tint is white
  path: { style: 'concrete', color: '#ffffff', curb: '#e8e6e0', side: '#7a7c80', base: '#64666b', crisp: true, plainJunction: true },
  // a concrete flyover: pale deck, pale parapet rails, grey piers
  bridge: { deck: '#c4c1b9', rail: '#dfe2e5', post: '#8b8882', overpass: '#cdcac2', girder: '#76746f', overRail: '#e4e6e8', grating: false, shadow: 0.32 },
  // the highway bores (trackMesh.buildTunnels style 'highway'): a rock ridge over the bore, a
  // concrete headwall with the Brigade-amber hazard band, jet fans and sodium lamps in the mouth
  tunnel: { style: 'highway', top: '#8c8f94', side: '#74767b', portal: '#cbc8c0', dark: '#1b1e26', stripe: '#f4a62a', hall: '#bdb9b0', roof: '#686b70', lamp: '#ffc46b' },
  // mountain water a notch darker than the city's, so it never reads as more pale concrete
  water: { deep: '#22557c', shallow: '#4a88a8', foam: '#e4eef6', glow: 0.02 },
  trees: ['pine', 'pine', 'cedar'],
  scatter: ['pine', 'pine', 'cliff', 'boulder', 'pine', 'cedar'],
  scatterDensity: 0.45,
  treeColors: { leaf: '#3d7f5a', leaf2: '#2e6a4b', trunk: '#6a4a36' },
  rocks: ['jerseyBarrier', 'boulder'],
  rock: '#9fa3ab',
  building: 'roadsideBlock',
  wall: 'soundWall',
  frame: ['crashBarrier', 'crashBarrier', 'jerseyBarrier', 'crashBarrier', 'pineSmall'],
  detail: 'pebbles',
  detailDensity: 0.12,
  weather: null,
  life: { butterflies: false, birds: true, koi: false, clouds: true, fireflies: false, sparkle: false },
  city: {
    district: 'highway', kerbs: false,
    // the painted hard shoulder (textures.paintGround kerb band) and its dark seam by the road
    sidewalk: '#77797e', kerb: '#55575c', kerbSide: '#55575c', lawn: '#7f8b5e', plaza: ['#a8a59e', '#9c9992'],
  },
};
DISTRICTS.highway = HIGHWAY;

/**
 * The reservoir park (Gate Arc S5a, `MapDef.district: 'park'` on `city` maps of Act 5, GATE_ARC §18.1):
 * mown lawns with paved bands along the paths, a pale park road (the lightest band, by day, in fog and
 * at night), park lamps instead of utility poles and wires, willows and cherries, the dam wall on the
 * board's H tiles (parkProps.js damWall), the reservoir's cold water, the city beyond the trees in the
 * skirt. At night the lawns go deep green so the road stays the lightest band; fireflies over the water.
 */
const PARK = {
  // (mown lawn a shade deeper than the campus's: the pale park road stays the lightest band by day)
  ground: ['#7cb068', '#73a760'],
  groundSpeck: '#93c47e',
  groundShade: '#5f9652',
  clover: '#548f4a',
  wet: '#7c9e88',
  dirt: '#c6bfb1',
  pebble: '#b6afa1',
  groundStyle: 'grass',
  groundPaint: { kerb: 1, flowers: 0.3, cloverAmt: 0.45 },
  shore: '#b4aea0',
  bank: '#97938a',
  bankDark: '#736f68',
  path: { style: 'asphalt', color: '#ffffff', curb: '#f4f1ea', side: '#9a9da6', base: '#6d727c', crisp: true, plainJunction: true, tone: 2.5 },
  // the reservoir: cold and deep, a notch darker than the lawns in greyscale
  water: { deep: '#245a74', shallow: '#4a879c', foam: '#e2f0f4', glow: 0.03, caustic: 0.26, foamAmt: 0.55 },
  trees: ['willow', 'sakura', 'round'],
  scatter: ['round', 'willow', 'sakura', 'streetTree'],
  scatterDensity: 0.45,
  treeColors: { leaf: '#86b86a', leaf2: '#6a9e58', trunk: '#6a4a36' },
  rocks: ['planterBox', 'rescueBuoy'],
  building: 'damWall',
  frame: ['hedge', 'planterBox', 'hedge', 'bollard', 'hedge'],
  detail: 'tuft',
  detailDensity: 0.12,
  life: { butterflies: true, birds: true, koi: false, clouds: true, fireflies: true, sparkle: false },
  // lawns at night: deep green, well under the road's tone (resolveLook)
  nightGround: { ground: ['#4b785c', '#447055'], groundSpeck: '#588568', groundShade: '#385d4a', clover: '#3f6952' },
  nightCity: { lawn: '#4d8859', sidewalk: '#8d8a82' },
  city: {
    district: 'park', kit: 'park', kerbs: false,
    // (the paved bands and plazas a notch under the park road's tone)
    sidewalk: '#b5afa2', kerb: '#e9e5dc', kerbSide: '#8f8b82', lawn: '#7fb86c', plaza: ['#b3ad9f', '#aaa496'],
  },
};
DISTRICTS.park = PARK;

/**
 * `stage.look.dusk` (Gate Arc 4-7, Azami's checkpoint): evening, not noon. The sun low (keyY: the key
 * light comes in from just over the horizon, so shadows run long) and orange under a violet sky, a
 * violet hemisphere and fill, a light violet wash on the ground, and the highway lamps already on
 * (ambient.js lights their glows and pools at dusk). Not night (no lit windows, no fireflies); the
 * board stays readable, the road the lightest band.
 */
export const DUSK = {
  light: { sky: '#c8a6dc', ground: '#4a3f62', hemi: 0.9, key: '#ff9a5c', keyI: 1.35, fill: '#7f78e6', fillI: 0.46, keyY: 5 },
  bg: '#8a6496',
  fogColor: '#9a7896',
  groundTint: '#8a6aa8',
  groundAmt: 0.1,
};

/**
 * Scenery keyword 'frost' (Gate Arc 4-6, 4-8): a cold wash over the ground (it stays under the road's
 * tone), cooler light, frost on the rails (props read look.frost), snow flurries.
 */
export const FROST = {
  tint: '#d2dce6',
  amount: 0.3,
  key: '#eef3ff',
  weather: 'snow',
};

/**
 * Scenery keyword 'snowBridge' (Gate Arc 4-10): the Brigade's bridge-layer deck over the ravine
 * (trackMesh.buildDecks `layer`): navy steel treadway in folding sections, amber hazard rails.
 */
export const BRIDGE_LAYER = { deck: '#66707f', rail: '#f4a62a', post: '#2b3a5c', overpass: '#66707f', girder: '#2b3a5c', overRail: '#f4a62a', lacquer: false, grating: false, boardwalk: false, layer: true };

/** Snow over the north rows (scenery keyword 'snowCover'): its colour stays under the road's tone. */
export const SNOW_COVER = { color: '#c9d1db', shade: '#b3bdc9', rows: 6 };

/**
 * `stage.scenery.ruined === 'burning'` (Gate Arc 3-9, 3-10; GATE_ARC §18.1, §18.6): the city after
 * HAMMER's barrage. The sky goes dark, not the board: an ash-dusted, desaturated ground, a low warm
 * key light ≥ 1.2, the road an ash-grey kept lighter than the ground (asphalt paler, setts dimmed a
 * little), amber the one accent (fire glows, embers; never an oni's red), ash falling, the gates
 * untouched (the brightest things on the board). Buildings become ruinBlock shells, the skirt's
 * scatter rubble and wrecks, trees charred (ruinProps.js); the burning layer adds fire and smoke.
 */
export const BURNING = {
  light: { sky: '#c4a294', ground: '#3a3030', hemi: 0.82, key: '#ffd6b0', keyI: 1.3, fill: '#7c6c9c', fillI: 0.3 },
  bg: '#2a1e22',
  fogColor: '#4d3a3a',
  ground: ['#6b6560', '#635d58'],
  groundSpeck: '#7a746d',
  groundShade: '#4f4a46',
  clover: '#57544a',
  wet: '#4a4846',
  dirt: '#6d6862',
  pebble: '#6a645e',
  shore: '#5b5550',
  bank: '#55504a',
  bankDark: '#3f3b37',
  water: { deep: '#1d2736', shallow: '#3a4858', glow: 0.12 },
  /** asphalt brightened to ash-grey, setts dimmed a little: both stay well over the ground */
  pathTone: { asphalt: 1.55, setts: 0.9 },
  pathSide: '#55504b',
  city: { sidewalk: '#7a746c', kerb: '#8f8981', kerbSide: '#5d5852', lawn: '#59574a', plaza: ['#716b64', '#69635c'] },
  trees: ['charred'],
  scatter: ['rubble', 'debris', 'burntCar', 'rubble', 'fallenPole'],
  scatterDensity: 0.32,
  building: 'ruinBlock',
  frame: ['barricade', 'guardRail', 'debris', 'barricade', 'bollard'],
  weather: 'ash',
  emberColor: '#ffc46b',
  /** the hall over a tunnel, charred (3-10's sanctum): never lighter than the road */
  tunnel: { top: '#4f4844', side: '#3d3734', hall: '#5a524c', roof: '#3a3431', portal: '#6b625a', stripe: '#8a3a2a', glass: '#3b2c26' },
  life: { butterflies: false, birds: false, koi: false, clouds: false, fireflies: false, sparkle: false },
};

/**
 * Resolves the final look for a map + stage scenery: merged theme, night/fog flags,
 * weather and lighting.
 * @param {string} themeId
 * @param {{ night?: boolean, fog?: boolean, weather?: string|null, ruined?: string|null, keywords?: string[] }} scenery
 *   ruined 'burning' = the burning table (BURNING; implies a dark sky); keywords 'frost', 'snowCover'
 *   and 'snowBridge' re-dress the look (FROST, SNOW_COVER, BRIDGE_LAYER)
 * @param {{ night?: string, costumes?: boolean, dusk?: boolean }|null} [stageLook] the stage's render-only
 *   `look` (StageDef.look): night 'lantern' = warm lantern-lit night (implies night); dusk = DUSK
 * @param {{ district?: string }|null} [map] the MapDef (its `district`, e.g. 'oldtown')
 */
export function resolveLook(themeId, scenery = {}, stageLook = null, map = null) {
  const t = THEMES[themeId] || THEMES.sakura;
  const look = {
    ...BASE,
    ...t,
    path: { ...BASE.path, ...(t.path || {}) },
    bridge: { ...BASE.bridge, ...(t.bridge || {}) },
    tunnel: { ...BASE.tunnel, ...(t.tunnel || {}) },
    water: { ...BASE.water, ...(t.water || {}) },
    light: { ...BASE.light, ...(t.light || {}) },
    treeColors: { ...BASE.treeColors, ...(t.treeColors || {}) },
    life: { ...BASE.life, ...(t.life || {}) },
    gate: { ...BASE.gate, ...(t.gate || {}) },
    ...(t.city ? { city: { ...t.city } } : {}),
    theme: THEMES[themeId] ? themeId : 'sakura',
  };
  // a map's district (Old Town on a city map): its ground, road, buildings and kit hints
  const dist = DISTRICTS[map?.district] || null;
  if (dist) {
    const { path, city, nightGround, nightCity, bridge, tunnel, treeColors, life, ...rest } = dist;
    Object.assign(look, rest);
    look.path = { ...look.path, ...path };
    if (bridge) look.bridge = { ...look.bridge, ...bridge };
    if (tunnel) look.tunnel = { ...look.tunnel, ...tunnel };
    if (treeColors) look.treeColors = { ...look.treeColors, ...treeColors };
    if (life) look.life = { ...look.life, ...life };
    if (look.city) look.city = { ...look.city, ...city };
    look.district = map.district;
  }
  // Gate Arc S4a scenery keywords that re-dress the look (frost, the bridge-layer deck, snow cover)
  const kw = scenery.keywords || [];
  const ruined = scenery.ruined === 'burning' ? 'burning' : null;
  const lantern = stageLook?.night === 'lantern';
  look.lantern = lantern;
  look.night = !!(scenery.night || t.forceNight || lantern || ruined);
  // a theme whose lawns go dark at night (the campus: the road stays the lightest band)
  const nightGround = dist?.nightGround || t.nightGround;
  const nightCity = dist?.nightCity || t.nightCity;
  if (look.night && nightGround) Object.assign(look, nightGround);
  if (look.night && nightCity && look.city) look.city = { ...look.city, ...nightCity };
  look.ground = [look.ground[0], mixBg(look.ground[1], look.ground[0], 0.35)];
  // blackout dimming (StageDef.look.blackout, Gate Arc): the renderer dims the lamps and windows
  // while the stage's rule is active (src/render/blackout.js)
  look.blackout = !!stageLook?.blackout;
  look.fog = !!scenery.fog;
  look.weather = scenery.weather !== undefined ? scenery.weather : look.weather;
  if (look.night) {
    // a theme may bring its own night (the city's warm neon night); otherwise the moonlit preset
    look.light = t.nightLight ? { ...t.nightLight } : {
      sky: '#aebfff', ground: '#39406a', hemi: 0.8, key: '#d8e2ff', keyI: 1.15, fill: '#ffb8de', fillI: 0.35,
    };
    look.bg = themeId === 'night' || t.underground ? look.bg : mixBg(look.bg, '#232c52', 0.75);
    look.ground = look.ground.map((g) => mixBg(g, '#4f8fb0', 0.08));
    look.groundShade = mixBg(look.groundShade, '#2c3a66', 0.2);
    look.clover = mixBg(look.clover, '#2c3a66', 0.15);
    look.shore = mixBg(look.shore, '#3a4670', 0.35);
    look.water = { ...look.water, deep: mixBg(look.water.deep, '#16285a', 0.4), shallow: mixBg(look.water.shallow, '#3a5c9a', 0.35), glow: Math.max(look.water.glow, 0.1) };
    look.life = { ...look.life, butterflies: false, birds: false, clouds: false };
  }
  if (lantern) {
    // re-light the night warm: violet sky and fog, orange key light and fireflies; the ground
    // keeps its own colours (only a light violet wash) so the board stays readable
    const L = LANTERN_NIGHT;
    look.light = { ...L.light };
    look.bg = L.bg;
    look.ground = look.ground.map((g) => mixBg(g, L.groundTint, 0.24));
    look.groundShade = mixBg(look.groundShade, L.shadeTint, 0.18);
    look.shore = mixBg(look.shore, L.shadeTint, 0.2);
    look.water = { ...look.water, deep: mixBg(look.water.deep, L.waterDeep, 0.35), shallow: mixBg(look.water.shallow, L.waterShallow, 0.3) };
    look.gate = { ...look.gate, ...L.gate };
    look.fireflyColor = L.firefly;
    look.life = { ...look.life, fireflies: true };
  }
  if (ruined) {
    // the city burning (BURNING): ash ground, dark sky, warm low key, the road kept the lightest band
    const B = BURNING;
    look.ruined = ruined;
    look.light = { ...B.light };
    look.bg = B.bg;
    Object.assign(look, {
      ground: [...B.ground], groundSpeck: B.groundSpeck, groundShade: B.groundShade, clover: B.clover, wet: B.wet,
      dirt: B.dirt, pebble: B.pebble, shore: B.shore, bank: B.bank, bankDark: B.bankDark,
      trees: [...B.trees], scatter: [...B.scatter], scatterDensity: B.scatterDensity, building: B.building, frame: [...B.frame],
      emberColor: B.emberColor, flowers: ['#6d6862', '#77716a'],
    });
    look.water = { ...look.water, ...B.water };
    look.path = { ...look.path, side: B.pathSide, tone: B.pathTone[look.path.style] ?? look.path.tone };
    if (look.city) look.city = { ...look.city, ...B.city };
    look.tunnel = { ...look.tunnel, ...B.tunnel };
    look.life = { ...B.life };
    if (scenery.weather === undefined) look.weather = B.weather;
  }
  // dusk (stage.look.dusk, Gate Arc 4-7): a warm low sun, never on a night stage
  const dusk = !!stageLook?.dusk && !look.night;
  if (dusk) {
    const D = DUSK;
    look.dusk = true;
    look.light = { ...D.light };
    look.bg = D.bg;
    look.ground = look.ground.map((g) => mixBg(g, D.groundTint, D.groundAmt));
    look.groundShade = mixBg(look.groundShade, D.groundTint, D.groundAmt);
    look.life = { ...look.life, butterflies: false };
  }
  // frost (scenery keyword 'frost', Gate Arc 4-6 / 4-8): a cold wash, cooler key light, flurries
  if (kw.includes('frost')) {
    const F = FROST;
    look.frost = true;
    look.ground = look.ground.map((g) => mixBg(g, F.tint, F.amount));
    look.groundSpeck = mixBg(look.groundSpeck, '#ffffff', F.amount);
    look.groundShade = mixBg(look.groundShade, F.tint, F.amount * 0.6);
    look.clover = mixBg(look.clover, F.tint, F.amount);
    if (!look.night && !dusk) look.light = { ...look.light, key: mixBg(look.light.key, F.key, 0.6) };
    look.life = { ...look.life, butterflies: false };
    if (scenery.weather === undefined) look.weather = F.weather;
  }
  // snow over the north rows (scenery keyword 'snowCover', Gate Arc 4-8): terrain.js paints it
  if (kw.includes('snowCover')) {
    look.snowCover = { ...SNOW_COVER };
    // (the ridges over the bores sit in the snowy north rows)
    look.tunnel = { ...look.tunnel, top: SNOW_COVER.color };
    if (scenery.weather === undefined) look.weather = 'snow';
  }
  // the frozen villages (scenery keyword 'frozenVillage', Gate Arc 4-9): the board's houses are the
  // villagers' huts, gone cold (northProps.js frozenHut)
  if (kw.includes('frozenVillage')) look.building = 'frozenHut';
  // the Brigade's bridge-layer deck over the water (scenery keyword 'snowBridge', Gate Arc 4-10)
  if (kw.includes('snowBridge')) look.bridge = { ...look.bridge, ...BRIDGE_LAYER };
  // the Noon Gate's cold (scenery keyword 'noonGateFrost', Gate Arc 5-8): rime on the pipes and rails
  // (props read look.frost) and a light cold wash on the tiles; no snow falls underground
  if (kw.includes('noonGateFrost')) {
    look.frost = true;
    look.ground = look.ground.map((g) => mixBg(g, FROST.tint, 0.12));
    look.groundShade = mixBg(look.groundShade, FROST.tint, 0.08);
  }
  if (look.fog) {
    look.fogColor = ruined ? BURNING.fogColor : lantern ? LANTERN_NIGHT.fogColor : dusk ? DUSK.fogColor : look.night ? (t.nightFog || '#4a5378') : (t.fogTint || '#dfe7ef');
  }
  return look;
}

function mixBg(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p, s) => (p >> s) & 255;
  const m = (s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return `#${((m(16) << 16) | (m(8) << 8) | m(0)).toString(16).padStart(6, '0')}`;
}

/** Field ring colours by oni field kind. */
export const FIELD_COLORS = { haste: '#ffd84d', shield: '#4cc9f0', regen: '#80ed99' };

/** Colours for attack types / elements (projectiles, sparks, numbers). */
export const FX_COLORS = {
  blast: '#ff9a4a', pierce: '#5ab8ff', slash: '#ff5d7a', mystic: '#b48cff', holy: '#ffe066',
  fire: '#ff7a3a', frost: '#8fe3ff', lightning: '#ffe45c', poison: '#7be08a', water: '#4cc9f0',
};

export function fxColor(element, attackType, fallback = '#ffffff') {
  return FX_COLORS[element] || FX_COLORS[attackType] || fallback;
}

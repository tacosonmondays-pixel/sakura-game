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
    bridge: { deck: '#9c7a52', rail: '#6d5236', post: '#574029', lacquer: false, overpass: '#b08a5c', girder: '#4a3826' },
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
    water: { deep: '#3d8fc6', shallow: '#a8e4f5', foam: '#ffffff', glow: 0 },
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
};

/**
 * Resolves the final look for a map + stage scenery: merged theme, night/fog flags,
 * weather and lighting.
 * @param {string} themeId
 * @param {{ night?: boolean, fog?: boolean, weather?: string|null }} scenery
 */
export function resolveLook(themeId, scenery = {}) {
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
    theme: THEMES[themeId] ? themeId : 'sakura',
  };
  look.ground = [look.ground[0], mixBg(look.ground[1], look.ground[0], 0.35)];
  look.night = !!(scenery.night || t.forceNight);
  look.fog = !!scenery.fog;
  look.weather = scenery.weather !== undefined ? scenery.weather : look.weather;
  if (look.night) {
    look.light = {
      sky: '#aebfff', ground: '#39406a', hemi: 0.8, key: '#d8e2ff', keyI: 1.15, fill: '#ffb8de', fillI: 0.35,
    };
    look.bg = themeId === 'night' ? look.bg : mixBg(look.bg, '#232c52', 0.75);
    look.ground = look.ground.map((g) => mixBg(g, '#4f8fb0', 0.08));
    look.groundShade = mixBg(look.groundShade, '#2c3a66', 0.2);
    look.clover = mixBg(look.clover, '#2c3a66', 0.15);
    look.shore = mixBg(look.shore, '#3a4670', 0.35);
    look.water = { ...look.water, deep: mixBg(look.water.deep, '#16285a', 0.4), shallow: mixBg(look.water.shallow, '#3a5c9a', 0.35), glow: Math.max(look.water.glow, 0.1) };
    look.life = { ...look.life, butterflies: false, birds: false, clouds: false };
  }
  if (look.fog) {
    look.fogColor = look.night ? '#4a5378' : (t.fogTint || '#dfe7ef');
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

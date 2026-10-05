// Visual themes for battle maps (MapDef.theme). Colours are sRGB hex strings.
// `night`/`fog` variants come from the stage's scenery and are derived in `resolveLook`.

const BASE = {
  ground: ['#9fd77a', '#93cf6f'], // two-tone checker
  groundSpeck: '#b7e48f',
  flowers: ['#ffffff', '#ffd1e3', '#ffe680', '#ff9ec4'],
  bank: '#a47b58',
  bankDark: '#7a5a40',
  shore: '#e2cfa4',
  path: { style: 'flagstone', color: '#efe3cf', curb: '#c8b89f', side: '#b8a68a' },
  bridge: { deck: '#c58f5a', rail: '#8a5a36', post: '#7a4a2a', lacquer: false },
  water: { deep: '#2f9fd0', shallow: '#78dcef', foam: '#ffffff', glow: 0 },
  void: 'lava',
  bg: '#bfe6ff',
  trees: ['round'],
  treeColors: { leaf: '#6cc45a', leaf2: '#4fae4a', trunk: '#8a5a3a' },
  rock: '#a9adb8',
  building: 'house',
  wall: 'hedge',
  light: { sky: '#ffffff', ground: '#a6c79a', hemi: 1.15, key: '#fff0d8', keyI: 1.55, fill: '#cfe6ff', fillI: 0.35 },
  weather: null,
  ambient: null,
};

/** Theme table. Each entry overrides BASE. */
export const THEMES = {
  sakura: {
    ground: ['#a4dc7c', '#97d371'],
    groundSpeck: '#c4ea98',
    path: { style: 'flagstone', color: '#f3e6d2', curb: '#d6c3a5', side: '#c0aa8a' },
    trees: ['sakura', 'sakura', 'round'],
    treeColors: { leaf: '#ffb3cf', leaf2: '#ff8fb8', trunk: '#7d5240' },
    building: 'house',
    wall: 'hedge',
    weather: 'petals',
    bg: '#c9ecff',
  },
  lake: {
    ground: ['#96d281', '#8acb78'],
    groundSpeck: '#b5e39a',
    path: { style: 'dirt', color: '#e8d4a6', curb: '#c9ae7b', side: '#b29466' },
    water: { deep: '#2b8fc8', shallow: '#6fd3ea', foam: '#f4ffff', glow: 0 },
    trees: ['round', 'willow', 'round'],
    treeColors: { leaf: '#5fbf62', leaf2: '#3f9f55', trunk: '#7a5236' },
    building: 'hut',
    wall: 'reedFence',
    bg: '#b8e3f5',
  },
  shrine: {
    ground: ['#8cc479', '#82bb70'],
    groundSpeck: '#a9d68e',
    shore: '#b4b8c0',
    path: { style: 'flagstone', color: '#d9dde3', curb: '#aeb4bf', side: '#9aa1ad' },
    bridge: { deck: '#c4473e', rail: '#a83832', post: '#7e2a26', lacquer: true },
    trees: ['cedar', 'sakura', 'cedar'],
    treeColors: { leaf: '#3f8f5a', leaf2: '#2f7449', trunk: '#6a4632' },
    building: 'shrine',
    wall: 'shrineWall',
    rock: '#9ca3ae',
    roofs: ['#3f8f86', '#b8463e', '#4a6fa8'],
    bg: '#c7d9ee',
  },
  mountain: {
    ground: ['#b3cf91', '#a8c787'],
    groundSpeck: '#e9f1ee',
    shore: '#a7a49c',
    path: { style: 'cobble', color: '#c4beb4', curb: '#9d968b', side: '#8a8378' },
    trees: ['pine', 'pine', 'cedar'],
    treeColors: { leaf: '#3d7f5a', leaf2: '#2e6a4b', trunk: '#6a4a36' },
    rock: '#9fa3ab',
    building: 'tower',
    wall: 'stoneWall',
    weather: 'snow',
    bg: '#d6e6f2',
  },
  marsh: {
    ground: ['#86a86c', '#7c9f63'],
    groundSpeck: '#9cbd7c',
    bank: '#6f5a40',
    bankDark: '#4f3f2c',
    shore: '#6f5d45',
    path: { style: 'planks', color: '#b89a72', curb: '#8a6e4c', side: '#755b3d' },
    bridge: { deck: '#9c7a52', rail: '#6d5236', post: '#574029', lacquer: false },
    water: { deep: '#245a52', shallow: '#3f8a70', foam: '#9cc8a8', glow: 0, foamAmt: 0.45, caustic: 0.3 },
    trees: ['willow', 'dead', 'willow'],
    treeColors: { leaf: '#6f9a55', leaf2: '#557f45', trunk: '#5a4636' },
    rock: '#8c9289',
    building: 'stiltHut',
    fogTint: '#c8d8cc',
    wall: 'reedFence',
    bg: '#a9c2b4',
  },
  foundry: {
    ground: ['#b5afa3', '#aca598'],
    groundSpeck: '#c6c0b4',
    flowers: ['#ffd43b', '#ff9f43', '#ffffff'],
    bank: '#6c6a70',
    bankDark: '#4a4850',
    shore: '#8a909b',
    path: { style: 'metal', color: '#9aa1ad', curb: '#ffcc33', side: '#6f7682' },
    bridge: { deck: '#7d8590', rail: '#ffcc33', post: '#4d535c', lacquer: false },
    water: { deep: '#1f8fa8', shallow: '#53e0f0', foam: '#d8ffff', glow: 0.35 },
    trees: ['scrap'],
    scatter: ['rock', 'boulder', 'barrel', 'rock'],
    scatterDensity: 0.55,
    treeColors: { leaf: '#7a7f88', leaf2: '#5c6169', trunk: '#4d535c' },
    rock: '#8d8478',
    building: 'machine',
    detail: 'pebbles',
    detailDensity: 0.25,
    wall: 'brickWall',
    weather: 'embers',
    bg: '#c9c4bd',
    light: { sky: '#fff4e6', ground: '#a19a90', hemi: 1.1, key: '#ffe2c0', keyI: 1.5, fill: '#cfe0ff', fillI: 0.3 },
  },
  festival: {
    ground: ['#a2d77d', '#96cf72'],
    groundSpeck: '#c0e89a',
    path: { style: 'brick', color: '#e9c9a8', curb: '#c58a6a', side: '#a87458' },
    bridge: { deck: '#d24b45', rail: '#b33a36', post: '#7e2a26', lacquer: true },
    trees: ['maple', 'sakura', 'maple'],
    treeColors: { leaf: '#ff8a4c', leaf2: '#f0643a', trunk: '#6d4433' },
    building: 'stall',
    wall: 'festivalWall',
    bg: '#ffe2c9',
  },
  snow: {
    ground: ['#eef4fa', '#e5eef7'],
    groundSpeck: '#ffffff',
    flowers: ['#bfe3ff', '#ffffff', '#d7c9ff'],
    bank: '#9fb4c8',
    bankDark: '#7b90a6',
    shore: '#e6eef8',
    path: { style: 'cobble', color: '#b9b6c4', curb: '#8f8ca0', side: '#7d7a8e' },
    water: { deep: '#3d8fc6', shallow: '#a8e4f5', foam: '#ffffff', glow: 0 },
    trees: ['snowPine', 'snowPine', 'pine'],
    treeColors: { leaf: '#3c7a62', leaf2: '#2f6552', trunk: '#5e4636' },
    rock: '#a7b3c2',
    building: 'snowHouse',
    detail: 'pebbles',
    detailDensity: 0.15,
    wall: 'stoneWall',
    weather: 'snow',
    bg: '#dfeaf6',
    light: { sky: '#ffffff', ground: '#c9d6e6', hemi: 1.05, key: '#fff6ea', keyI: 1.45, fill: '#d6e8ff', fillI: 0.4 },
  },
  volcano: {
    ground: ['#6e6060', '#665858'],
    groundSpeck: '#857472',
    flowers: ['#ff9f43', '#ffd43b', '#ff6b35'],
    bank: '#4a3c3c',
    bankDark: '#2e2424',
    shore: '#4a3c3c',
    path: { style: 'cobble', color: '#a8968a', curb: '#7d6c62', side: '#5f5048' },
    bridge: { deck: '#5a4a44', rail: '#3d302c', post: '#2e2424', lacquer: false },
    water: { deep: '#2f9fb0', shallow: '#7fe0e0', foam: '#ffffff', glow: 0.15 },
    trees: ['charred', 'pine'],
    treeColors: { leaf: '#4f6b4f', leaf2: '#3d553f', trunk: '#3a2e2a' },
    rock: '#4d4246',
    building: 'obsidian',
    detail: 'crack',
    detailDensity: 0.3,
    wall: 'basaltWall',
    weather: 'embers',
    bg: '#5d4a4a',
    light: { sky: '#ffe2cc', ground: '#6b4a40', hemi: 1.0, key: '#ffc58f', keyI: 1.5, fill: '#ff8a5c', fillI: 0.35 },
  },
  night: {
    ground: ['#6f9a7a', '#668f71'],
    groundSpeck: '#88b494',
    shore: '#8e94a6',
    path: { style: 'flagstone', color: '#b9bfd0', curb: '#8e95aa', side: '#7a8197' },
    trees: ['cedar', 'dead', 'cedar'],
    treeColors: { leaf: '#3e6d63', leaf2: '#2f5850', trunk: '#4d3d3a' },
    rock: '#8790a3',
    building: 'shrine',
    wall: 'shrineWall',
    bg: '#2a3350',
    forceNight: true,
  },
  arena: {
    ground: ['#e3d2ad', '#dccaa3'],
    groundSpeck: '#efe2c4',
    path: { style: 'flagstone', color: '#f6ead6', curb: '#d1b98f', side: '#bca47a' },
    trees: ['sakura', 'round'],
    treeColors: { leaf: '#ffb3cf', leaf2: '#ff8fb8', trunk: '#7d5240' },
    building: 'stands',
    wall: 'stands',
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
    water: { ...BASE.water, ...(t.water || {}) },
    light: { ...BASE.light, ...(t.light || {}) },
    treeColors: { ...BASE.treeColors, ...(t.treeColors || {}) },
    theme: THEMES[themeId] ? themeId : 'sakura',
  };
  // soften the tile checker so it reads as lawn, not a chess board
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
    look.shore = mixBg(look.shore, '#3a4670', 0.35);
    look.water = { ...look.water, deep: mixBg(look.water.deep, '#16285a', 0.4), shallow: mixBg(look.water.shallow, '#3a5c9a', 0.35), glow: Math.max(look.water.glow, 0.1) };
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

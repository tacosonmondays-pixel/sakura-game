// Builds the battlefield terrain from a MapDef (V2 "lively maps"):
//   • one hand-painted ground texture per map (colour mottling, clover, flower drifts, worn
//     dirt and pebbles beside the road, wet sand around water) — no tile grid,
//   • the road as a smooth ribbon built from the path polyline (rounded corners, softly wavy
//     edges, bevelled sides, texture flowing along the road) instead of tile stamps,
//   • animated water / lava surfaces, plank bridges, auto lily pads,
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

export const PATH_H = 0.05;
export const WATER_Y = 0.012;
export const LAVA_Y = 0.01;
const MARGIN = 8;
/** Half width of the road slab in tiles (the sim's path tiles are 1 wide). */
export const ROAD_HALF = 0.46;
const ROAD_BEVEL = 0.11;

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ---------------------------------------------------------------------------
// Scenery keywords (stage.scenery.props + derived from stage.introduces)
// ---------------------------------------------------------------------------

/** keyword → placement recipe. slot: pathside | skirt | grass | shore | water | entrance | none */
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
  return { keywords, fog, night: !!sc.night, weather: sc.weather };
}

// ---------------------------------------------------------------------------
// Grid analysis
// ---------------------------------------------------------------------------

function stampPathTiles(paths) {
  const set = new Set();
  const ordered = [];
  for (const wps of paths || []) {
    const list = [];
    for (let i = 0; i < wps.length; i++) {
      const [x, y] = wps[i];
      if (i === 0) {
        list.push([x, y]);
        continue;
      }
      const [px, py] = wps[i - 1];
      const dx = Math.sign(x - px);
      const dy = Math.sign(y - py);
      const steps = Math.max(Math.abs(x - px), Math.abs(y - py));
      for (let s = 1; s <= steps; s++) list.push([px + dx * s, py + dy * s]);
    }
    for (const [x, y] of list) set.add(`${x},${y}`);
    ordered.push(list);
  }
  return { set, ordered };
}

/**
 * Turns an orthogonal tile path (consecutive tiles) into a smooth world-space centreline:
 * corners are rounded with arcs and the result is resampled at a fixed step.
 * @param {number[][]} tiles consecutive tile coords [[tx, ty], ...]
 * @param {{ radius?: number, step?: number }} [o] corner radius and sample spacing (tiles)
 * @returns {number[][]} points [[x, z], ...] through tile centres
 */
export function smoothRoad(tiles, { radius = 0.62, step = 0.2 } = {}) {
  if (!tiles || tiles.length === 0) return [];
  // corners only (direction changes)
  const corners = [tiles[0]];
  for (let i = 1; i < tiles.length - 1; i++) {
    const [ax, ay] = tiles[i - 1];
    const [bx, by] = tiles[i];
    const [cx, cy] = tiles[i + 1];
    if (Math.sign(bx - ax) !== Math.sign(cx - bx) || Math.sign(by - ay) !== Math.sign(cy - by)) corners.push(tiles[i]);
  }
  if (tiles.length > 1) corners.push(tiles[tiles.length - 1]);
  const pts = corners.map(([x, y]) => [x + 0.5, y + 0.5]);
  if (pts.length === 1) return [pts[0]];
  // rounded polyline
  const poly = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const A = pts[i - 1];
    const P = pts[i];
    const B = pts[i + 1];
    const d1 = Math.hypot(P[0] - A[0], P[1] - A[1]);
    const d2 = Math.hypot(B[0] - P[0], B[1] - P[1]);
    const r = Math.min(radius, d1 / 2, d2 / 2);
    if (r < 1e-3) {
      poly.push(P);
      continue;
    }
    const s = [P[0] + ((A[0] - P[0]) / d1) * r, P[1] + ((A[1] - P[1]) / d1) * r];
    const e = [P[0] + ((B[0] - P[0]) / d2) * r, P[1] + ((B[1] - P[1]) / d2) * r];
    const n = 7;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const u = 1 - t;
      poly.push([u * u * s[0] + 2 * u * t * P[0] + t * t * e[0], u * u * s[1] + 2 * u * t * P[1] + t * t * e[1]]);
    }
  }
  poly.push(pts[pts.length - 1]);
  // resample
  const out = [poly[0]];
  let carry = 0;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1];
    const b = poly[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-6) continue;
    let d = carry;
    while (d + step <= len) {
      d += step;
      out.push([a[0] + ((b[0] - a[0]) * d) / len, a[1] + ((b[1] - a[1]) * d) / len]);
    }
    carry = d - len;
  }
  const last = poly[poly.length - 1];
  const prev = out[out.length - 1];
  if (Math.hypot(last[0] - prev[0], last[1] - prev[1]) > step * 0.3) out.push(last);
  return out;
}

/**
 * Builds the terrain.
 * @param {object} map MapDef
 * @param {object} look resolved theme look
 * @param {{ keywords: string[] }} scenery
 * @param {{ quality?: string, shadows?: boolean }} opts
 */
export function buildTerrain(map, look, scenery, { shadows = false, quality = 'high' } = {}) {
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

  // ----- path tiles (inside + extended off-map) -----------------------------------
  const { set: stamped, ordered } = stampPathTiles(map.paths);
  const pathSet = new Set(stamped);
  const entrances = [];
  const exits = [];
  const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const extendedLists = [];
  for (const list of ordered) {
    if (list.length < 2) continue;
    const ext = [...list];
    const extend = (a, b, front) => {
      const dx = Math.sign(a[0] - b[0]);
      const dy = Math.sign(a[1] - b[1]);
      let [x, y] = a;
      for (let i = 0; i < MARGIN + 2; i++) {
        x += dx;
        y += dy;
        pathSet.add(`${x},${y}`);
        if (front) ext.unshift([x, y]);
        else ext.push([x, y]);
      }
    };
    extend(list[0], list[1], true);
    extend(list[list.length - 1], list[list.length - 2], false);
    extendedLists.push(ext);
    const firstIn = list.findIndex(([x, y]) => inMap(x, y));
    let lastIn = -1;
    for (let i = list.length - 1; i >= 0; i--) if (inMap(list[i][0], list[i][1])) { lastIn = i; break; }
    if (firstIn >= 0) {
      const [x, y] = list[firstIn];
      const nb = list[Math.min(list.length - 1, firstIn + 1)];
      const dir = [Math.sign(nb[0] - x) || 0, Math.sign(nb[1] - y) || 0];
      const prev = list[Math.max(0, firstIn - 1)];
      const inDir = firstIn > 0 ? [x - prev[0], y - prev[1]] : dir;
      entrances.push({ tx: x, ty: y, dir: inDir });
    }
    if (lastIn >= 0) {
      const [x, y] = list[lastIn];
      const nx = list[Math.min(list.length - 1, lastIn + 1)];
      const pv = list[Math.max(0, lastIn - 1)];
      const outDir = lastIn < list.length - 1 ? [nx[0] - x, nx[1] - y] : [x - pv[0], y - pv[1]];
      if (!exits.some((e) => e.tx === x && e.ty === y)) exits.push({ tx: x, ty: y, dir: outDir });
    }
  }
  const roads = extendedLists.map((list) => smoothRoad(list));

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
  const pathTex = pathTexture(look.path.style, hash(map.id, 'p') % 1000 + 1);
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

  // ----- road ribbon ----------------------------------------------------------------------
  const road = new MeshData(true);
  roads.forEach((pts, ri) => {
    buildRibbon(road, pts, {
      half: ROAD_HALF, bevel: ROAD_BEVEL, h: PATH_H + ri * 0.004, seed: hash(map.id, 'road', ri),
      skipAt: (x, z) => isWater(Math.floor(x), Math.floor(z)),
      colorTop: (x, z, s) => fade(tmp.copy(cPath).multiplyScalar(0.97 + 0.03 * Math.sin(s * 1.3 + ri)).clone(), x, z),
      colorSide: (x, z) => fade(tmp.copy(cPathSide).clone(), x, z),
    });
  });
  addMesh(road.build(1), pathMat, { name: 'path' });

  // ----- water + lava ------------------------------------------------------------------
  let waterMat = null;
  let lavaMat = null;
  const waterTiles = [];
  for (let y = Y0; y < Y0 + EH; y++) for (let x = X0; x < X0 + EW; x++) if (isWater(x, y)) waterTiles.push([x, y]);
  if (waterTiles.length) {
    const mask = maskTexture(EW, EH, (gx, gy) => isWater(gx + X0, gy + Y0), { px: 16, blur: 4 });
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
  for (let y = 0; y < H && !hasLava; y++) for (let x = 0; x < W; x++) if (rows[y][x] === 'X') { hasLava = true; break; }
  if (hasLava) {
    const mask = maskTexture(W + 2, H + 2, (gx, gy) => isLava(gx - 1, gy - 1), { px: 16, blur: 5 });
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
  const occupied = new Set(); // tiles with a prop (outside slots avoid them)
  const m4 = new THREE.Matrix4();
  const v3 = new THREE.Vector3();
  const puddles = [];
  const mats = {};
  mats.solid = new THREE.MeshLambertMaterial({ vertexColors: true });
  mats.foliage = createFoliageMaterial();
  mats.glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  disposables.push(mats.solid, mats.foliage, mats.glow);
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
      for (const [src, mat] of [[p.solid, 'solid'], [p.foliage, 'foliage'], [p.glow, 'glow']]) {
        if (!src) continue;
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
    }
    for (const gl of p.glows) {
      v3.set(gl.x, gl.y, gl.z).applyMatrix4(m4);
      glows.push({ x: v3.x, y: v3.y, z: v3.z, color: new THREE.Color(gl.color), size: gl.size * s, flicker: gl.flicker, phase: rand() * 6, owner: target ? target[target.length - 1] : null });
    }
    for (const em of p.emitters) {
      v3.set(em.x, em.y, em.z).applyMatrix4(m4);
      emitters.push({ kind: em.kind, x: v3.x, y: v3.y, z: v3.z, color: em.color, owner: target ? target[target.length - 1] : null });
    }
  };

  const waterDecor = new Map(); // "x,y" → [objects]
  const treeTypes = look.trees;
  const bridgeTiles = [];

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

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = rows[y][x];
      const cx = x + 0.5;
      const cz = y + 0.5;
      const key = `${x},${y}`;
      const h = hash(map.id, x, y);
      const r01 = (h % 1000) / 1000;
      const deco = decorAt.get(key);
      if (isPath(x, y)) {
        if (isWater(x, y)) bridgeTiles.push([x, y]);
        continue;
      }
      if (deco) {
        if (c === '~' || c === 'B') {
          const list = [];
          const floatY = deco.type === 'pier' ? 0.02 : WATER_Y + 0.01;
          place(deco.type, cx, floatY, cz, deco.rot ?? r01 * 0.6 - 0.3, 1, h % 3, list);
          waterDecor.set(key, list);
        } else {
          const big = deco.type === 'sakura' || deco.type === 'willow' || deco.type === 'pine';
          place(deco.type, cx, 0, cz, deco.rot ?? facePath(x, y), big ? 1.3 : 1, h % 4);
        }
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
        place(n >= 2 ? 'boulder' : 'rock', cx, 0, cz, r01 * 6.28, 1, h % 5);
        occupied.add(key);
      } else if (c === 'H') {
        const border = x === 0 || y === 0 || x === W - 1 || y === H - 1;
        if (border) {
          const alongX = y === 0 || y === H - 1;
          place(look.wall, cx, 0, cz, alongX ? (y === 0 ? Math.PI : 0) : (x === 0 ? Math.PI / 2 : -Math.PI / 2), 1, h % 4);
        } else {
          place(look.building, cx, 0, cz, facePath(x, y), 1, h % 3);
        }
        occupied.add(key);
      } else if (c === ',') {
        // the painted ground already shows a flower drift here; add a few 3D blossoms on top
        if (h % 3 === 0) place('flowersPatch', cx, 0, cz, r01 * 6.28, 0.75, h % 4);
      }
    }
  }

  // ----- bridges -----------------------------------------------------------------------
  const bridge = buildBridges(bridgeTiles, isPath, look);
  if (bridge.solid) solidParts.push(bridge.solid);
  for (const gl of bridge.glows) glows.push({ ...gl, color: new THREE.Color(gl.color), phase: rand() * 6 });

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
  const gateInfo = (g, outward) => {
    const [dx, dy] = g.dir;
    const k = outward ? 0.56 : -0.56;
    const gx = g.tx + 0.5 + dx * k;
    const gz = g.ty + 0.5 + dy * k;
    return { x: gx, z: gz, dir: [dx, dy], ry: Math.atan2(dx, dy) };
  };
  for (const e of entrances) {
    const gi = gateInfo(e, false);
    const onWater = isWater(Math.floor(gi.x), Math.floor(gi.z));
    const type = scenery.keywords?.includes('torii') ? 'toriiGate' : 'spawnGate';
    place(type, gi.x, onWater ? PATH_H : 0, gi.z, gi.ry, 1, 0);
    gates.push({ kind: 'spawn', x: gi.x, z: gi.z, dir: gi.dir, color: look.gate.spawn });
  }
  for (const e of exits) {
    const gi = gateInfo(e, true);
    const onWater = isWater(Math.floor(gi.x), Math.floor(gi.z));
    place('goalGate', gi.x, onWater ? PATH_H : 0, gi.z, gi.ry, 1, 0);
    gates.push({ kind: 'goal', x: gi.x, z: gi.z, dir: gi.dir, color: look.gate.goal });
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
  for (const kw of scenery.keywords || []) {
    const rec = SCENERY[kw];
    if (!rec) continue;
    if (rec.ambient) {
      ambient.add(rec.ambient);
      continue;
    }
    const list = slots[rec.slot] || [];
    const r = makeRand(hash(map.id, kw));
    shuffle(list, r);
    let n = 0;
    for (const spot of list) {
      if (n >= rec.n) break;
      if (spot.used) continue;
      spot.used = true;
      for (const o of list) if (!o.used && Math.abs(o.x - spot.x) + Math.abs(o.z - spot.z) < 1.2) o.used = true;
      const s = (rec.s ?? 1) * (spot.s ?? 1);
      place(rec.prop, spot.x, spot.y ?? 0, spot.z, spot.ry ?? r() * 6.28, s, rec.variant ?? Math.floor(r() * 4));
      n++;
    }
  }

  function buildSlots() {
    const out = { pathside: [], skirt: [], grass: [], shore: [], water: [], entrance: [] };
    // pathside: just beside the road, every few tiles
    for (const list of ordered) {
      list.forEach(([x, y], i) => {
        if (!inMap(x, y) || isWater(x, y) || i % 3 !== 1) return;
        for (const [dx, dy] of DIRS) {
          const nx = x + dx;
          const ny = y + dy;
          if (isPath(nx, ny) || isWater(nx, ny) || isLava(nx, ny)) continue;
          out.pathside.push({ x: x + 0.5 + dx * 0.56, z: y + 0.5 + dy * 0.56, y: 0, ry: Math.atan2(-dx, -dy) });
        }
      });
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
        if (occupied.has(key)) continue;
        const d = outsideDist(cx, cz);
        if (!inMap(x, y) && d > 1.3 && d < 3.4 && outsideFree(x, y)) out.skirt.push({ x: cx, z: cz });
        if (inMap(x, y) && (rows[y][x] === '.' || rows[y][x] === ',')) {
          const ox = (hash(x, y, 'g') % 2 ? 0.33 : -0.33);
          const oz = (hash(y, x, 'g') % 2 ? 0.33 : -0.33);
          out.grass.push({ x: cx + ox, z: cz + oz, s: 0.6 });
        }
      }
    }
    for (const e of entrances) {
      // torii two tiles out (the spawn gate sits one tile out)
      const ox = e.tx - e.dir[0] * 2.5;
      const oy = e.ty - e.dir[1] * 2.5;
      out.entrance.push({ x: ox + 0.5, z: oy + 0.5, y: PATH_H, ry: Math.atan2(e.dir[0], e.dir[1]), s: 1 });
    }
    return out;
  }

  // puddles as flat glossy discs
  if (puddles.length) {
    const pb = new MeshData(false);
    for (const p of puddles) pb.disc(p.x, 0.012, p.z, 0.28 * p.s, new THREE.Color(p.color));
    const pm = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.42, depthWrite: false });
    disposables.push(pm);
    addMesh(pb.build(0), pm, { name: 'puddles', receive: false });
  }

  // ----- merge prop groups -------------------------------------------------------------
  const solidGeo = solidParts.length ? mergeGeometries(solidParts) : null;
  const foliageGeo = foliageParts.length ? mergeGeometries(foliageParts) : null;
  const glowGeo = glowParts.length ? mergeGeometries(glowParts) : null;
  for (const g of [...solidParts, ...foliageParts, ...glowParts]) g.dispose();
  addMesh(solidGeo, mats.solid, { cast: true, name: 'props' });
  addMesh(foliageGeo, mats.foliage, { cast: true, name: 'foliage' });
  addMesh(glowGeo, mats.glow, { receive: false, name: 'glowProps' });

  // ----- per-frame update ----------------------------------------------------------------
  const update = (time) => {
    mats.foliage.userData.uTime.value = time;
    if (waterMat) waterMat.uniforms.uTime.value = time;
    if (lavaMat) lavaMat.uniforms.uTime.value = time;
  };

  const setShadows = (on) => {
    group.traverse((o) => {
      if (!o.isMesh) return;
      o.receiveShadow = on && o.name !== 'water' && o.name !== 'glowProps' && o.name !== 'lava';
      o.castShadow = on && (o.name === 'props' || o.name === 'foliage' || o.parent !== group);
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
    /** Smooth road centrelines in world coords (one per path, extended off-board). */
    roads,
    waterDecor,
    waterTiles: waterTiles.filter(([x, y]) => inMap(x, y) && !isPath(x, y)),
    isWater: (x, y) => isWater(x, y),
    isPath: (x, y) => isPath(x, y),
    extent: { x0: X0, y0: Y0, w: EW, h: EH },
    waterMaterial: waterMat,
    dispose() {
      for (const d of disposables) d.dispose?.();
      group.clear();
    },
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
 * @param {object} o { half, bevel, h, seed, skipAt(x,z), colorTop(x,z,s), colorSide(x,z) }
 */
export function buildRibbon(md, pts, o) {
  if (pts.length < 2) return;
  const r = makeRand(o.seed || 1);
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28];
  const wob = (s, k) => 0.03 * Math.sin(s * 1.9 + ph[k]) + 0.022 * Math.sin(s * 4.1 + ph[k + 2]);
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
    const hl = o.half + wob(s, 0);
    const hr = o.half + wob(s, 1);
    const ct = o.colorTop(p[0], p[1], s);
    const cs = o.colorSide(p[0], p[1]);
    // normals of the bevels (outward + up)
    const bl = norm3([nx * o.h, o.bevel, nz * o.h]);
    const br = norm3([-nx * o.h, o.bevel, -nz * o.h]);
    sections.push({
      s,
      x: p[0], z: p[1],
      v: [
        { p: [p[0] + nx * (hl + o.bevel), -0.012, p[1] + nz * (hl + o.bevel)], c: cs, uv: [s, 1.1], n: bl },
        { p: [p[0] + nx * hl, o.h, p[1] + nz * hl], c: ct, uv: [s, 1], n: up },
        { p: [p[0] - nx * hr, o.h, p[1] - nz * hr], c: ct, uv: [s, 0], n: up },
        { p: [p[0] - nx * (hr + o.bevel), -0.012, p[1] - nz * (hr + o.bevel)], c: cs, uv: [s, -0.1], n: br },
      ],
      sideL: bl,
      sideR: br,
    });
  }
  for (let i = 1; i < sections.length; i++) {
    const A = sections[i - 1];
    const B = sections[i];
    if (o.skipAt && (o.skipAt((A.x + B.x) / 2, (A.z + B.z) / 2))) continue;
    for (let k = 0; k < 3; k++) {
      const a0 = A.v[k];
      const a1 = A.v[k + 1];
      const b0 = B.v[k];
      const b1 = B.v[k + 1];
      const n = k === 1 ? up : k === 0 ? A.sideL : A.sideR;
      md.triUV(a0.p, b0.p, b1.p, n, a0.c, b0.c, b1.c, a0.uv, b0.uv, b1.uv);
      md.triUV(a0.p, b1.p, a1.p, n, a0.c, b1.c, a1.c, a0.uv, b1.uv, a1.uv);
    }
  }
}

function norm3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

// ---------------------------------------------------------------------------
// Bridges: plank decks with rails and posts, oriented along the path.
// ---------------------------------------------------------------------------

function buildBridges(tiles, isPath, look) {
  const glows = [];
  if (!tiles.length) return { solid: null, glows };
  const parts = [];
  const deck = new THREE.Color(look.bridge.deck);
  const rail = new THREE.Color(look.bridge.rail);
  const post = new THREE.Color(look.bridge.post);
  const add = (geo, x, y, z, color, ry = 0) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.deleteAttribute('uv');
    g.rotateY(ry);
    g.translate(x, y, z);
    g.computeVertexNormals();
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = color.r;
      arr[i * 3 + 1] = color.g;
      arr[i * 3 + 2] = color.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    parts.push(g);
  };
  const c2 = new THREE.Color();
  for (const [x, y] of tiles) {
    const alongX = isPath(x - 1, y) || isPath(x + 1, y);
    const alongZ = isPath(x, y - 1) || isPath(x, y + 1);
    const runX = alongX && !alongZ ? true : !alongZ;
    const cx = x + 0.5;
    const cz = y + 0.5;
    // planks across the walking direction (slightly wider than the road so the ribbon ends tuck under)
    for (let i = 0; i < 5; i++) {
      const off = -0.4 + i * 0.2;
      c2.copy(deck).multiplyScalar(0.92 + ((x * 7 + y * 3 + i) % 4) * 0.04);
      if (runX) add(new THREE.BoxGeometry(0.19, 0.06, 1.04), cx + off, PATH_H - 0.03, cz, c2);
      else add(new THREE.BoxGeometry(1.04, 0.06, 0.19), cx, PATH_H - 0.03, cz + off, c2);
    }
    // beams under the deck
    add(new THREE.BoxGeometry(runX ? 1 : 0.08, 0.08, runX ? 0.08 : 1), cx + (runX ? 0 : 0.42), PATH_H - 0.1, cz + (runX ? 0.42 : 0), post);
    add(new THREE.BoxGeometry(runX ? 1 : 0.08, 0.08, runX ? 0.08 : 1), cx - (runX ? 0 : 0.42), PATH_H - 0.1, cz - (runX ? 0.42 : 0), post);
    // rails on sides that face water (not path)
    for (const [dx, dy] of DIRS) {
      if (isPath(x + dx, y + dy)) continue;
      const ex = cx + dx * 0.47;
      const ez = cz + dy * 0.47;
      const along = dx === 0; // rail runs along x
      add(new THREE.BoxGeometry(along ? 1.0 : 0.06, 0.05, along ? 0.06 : 1.0), ex, PATH_H + 0.24, ez, rail);
      add(new THREE.BoxGeometry(along ? 1.0 : 0.04, 0.03, along ? 0.04 : 1.0), ex, PATH_H + 0.12, ez, rail);
      for (const t of [-0.47, 0.47]) {
        const px = along ? cx + t : ex;
        const pz = along ? ez : cz + t;
        add(new THREE.BoxGeometry(0.07, 0.62, 0.07), px, PATH_H - 0.08, pz, post);
      }
      if (look.bridge.lacquer && (x + y) % 3 === 0) {
        glows.push({ x: ex, y: PATH_H + 0.36, z: ez, color: '#ffcf6b', size: 0.5, flicker: 0.12 });
        add(new THREE.BoxGeometry(0.09, 0.1, 0.09), ex, PATH_H + 0.3, ez, new THREE.Color('#ffd98a'));
      }
    }
    // piles into the water
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), cx + (runX ? 0 : 0.42), WATER_Y - 0.25, cz + (runX ? 0.42 : 0), post);
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), cx - (runX ? 0 : 0.42), WATER_Y - 0.25, cz - (runX ? 0.42 : 0), post);
  }
  const solid = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return { solid, glows };
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

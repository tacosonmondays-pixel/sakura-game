// Old Town kit (Gate Arc S3a, `MapDef.district: 'oldtown'` on a `city` map; GATE_ARC §18.1, §18.3):
// the festival quarter's wooden houses and its stalls as ordinary prop builders (props.js
// BUILDERS), on the city kit's materials. Houses bake into the `facade` accumulator: their timber
// boards, paper lattice windows (warm at night) and tiled roofs are facade patterns
// (cityMaterials.js FK.wood / FK.roofTile), so a whole lane costs one draw call. Lanterns are glow
// geometry (every fourth one also a glow sprite), cloth sways with the wind (foliage), the griddle
// stalls steam.
//
// Every builder keeps to OLD_TOWN_VARIANTS[type] variants (≤ 6, `c.variant % n`) and to a triangle
// cap (tests/render/oldTown.test.js); the houses on the board stay ≤ BOARD_MAX_H. Nothing here is
// transparent. Burnt variants (the same lane after the barrage, 3-9) are dark and unlit: loss is
// told by objects (a poster face down, an easel knocked over), never by anyone.
//
// Local frame: origin = tile centre on the ground, +y up, +z = the front (the lane side).
import * as THREE from 'three';
import { FK } from './cityMaterials.js';

/** Variants per builder (`c.variant % n`); the kit and the tests read this. */
export const OLD_TOWN_VARIANTS = {
  oldHouse: 6, lanternString: 6, shopCurtain: 3, stoneBasin: 2, ringToss: 1, bowStage: 1, griddleStall: 2,
  festivalPoster: 2, easel: 2,
};

/** oldHouse variant → house (STEP3_BUILD_PLAN §3). */
export const OLD_HOUSE_KINDS = ['shopHouse', 'merchantHouse', 'storehouse', 'shrineHall', 'lanternShop', 'bathhouse'];
/** lanternString variant → [length in tiles, burnt]: three lengths, festival then burnt. */
export const LANTERN_STRINGS = [[1.8, false], [2.4, false], [3.0, false], [1.8, true], [2.4, true], [3.0, true]];
/** Height of a lantern string's cord at its two bamboo posts (tiles). */
export const LANTERN_CORD_Y = 1.18;
/** Lantern spacing along a string (tiles); every fourth lantern also carries a glow sprite. */
export const LANTERN_STEP = 0.4;

/** The Old Town palette: dark timber, pale plaster, blue-grey tiles, festival red and white. */
export const OLD = {
  timber: '#8a5a3a',
  timberDark: '#5e3c28',
  timberPale: '#a87a52',
  plaster: '#efe6d2',
  stone: '#a8a093',
  stoneDark: '#7d766b',
  tile: '#56606e',
  tileDark: '#434b57',
  shrineRed: '#b5473a',
  indigo: '#2f4a73',
  red: '#d9473f',
  white: '#f7f2e6',
  lanternRed: '#ff6a4d',
  lanternWarm: '#ffc46b',
  char: '#2b2624',
  ash: '#5a5450',
};

const v = (c, type) => c.variant % OLD_TOWN_VARIANTS[type];
const swayCloth = () => 0.55;

function glowPoint(c, x, y, z, color, size = 0.5, flicker = 0.12) {
  c.glows.push({ x, y, z, color, size, flicker });
}

/**
 * A tiled gable (ridge along local x) whose two slopes carry the roof-tile pattern: eaves w × d,
 * ridge h above y, the gable ends closed in `end` colour.
 */
export function tiledGable(F, y, w, d, h, color = OLD.tile, end = OLD.plaster) {
  const hw = w / 2;
  const hd = d / 2;
  const base = new THREE.Color(color);
  const front = base.clone().multiplyScalar(1.08);
  const back = base.clone().multiplyScalar(0.78);
  const slope = Math.hypot(hd, h);
  // u along the eaves, v up the slope (FK.roofTile draws tile rows across v)
  F.quad([-hw, y, hd], [hw, y, hd], [hw, y + h, 0], [-hw, y + h, 0], front, FK.roofTile, [[0, 0], [w, 0], [w, slope], [0, slope]]);
  F.quad([hw, y, -hd], [-hw, y, -hd], [-hw, y + h, 0], [hw, y + h, 0], back, FK.roofTile, [[0, 0], [w, 0], [w, slope], [0, slope]]);
  F.tri([-hw + 0.06, y, -hd + 0.06], [-hw + 0.06, y, hd - 0.06], [-hw + 0.06, y + h - 0.03, 0], end);
  F.tri([hw - 0.06, y, hd - 0.06], [hw - 0.06, y, -hd + 0.06], [hw - 0.06, y + h - 0.03, 0], end);
  // the ridge
  F.box(0, y + h - 0.02, 0, w + 0.02, 0.035, 0.05, { color: OLD.tileDark });
}

/** A short tiled pent eave over the front face (+z) at height y, sloping down and out. */
export function pentEave(F, w, d, y, color = OLD.tile, depth = 0.16) {
  const z0 = d / 2;
  F.quad([-w / 2, y - 0.06, z0 + depth], [w / 2, y - 0.06, z0 + depth], [w / 2, y, z0], [-w / 2, y, z0], color, FK.roofTile, [[0, 0], [w, 0], [w, depth], [0, depth]]);
  F.box(0, y - 0.075, z0 + depth - 0.01, w, 0.018, 0.02, { color: OLD.tileDark, noTop: true });
}

/** A noren (shop curtain): `n` cloth panels on a rod at height y in front of the face (sway). */
function noren(c, w, y, z, color, n = 3, h = 0.13, crest = null) {
  c.solid.box(w + 0.04, 0.012, 0.012, { y: y + 0.004, z, color: OLD.timberDark });
  const pw = w / n;
  for (let i = 0; i < n; i++) {
    c.foliage.box(pw - 0.012, h, 0.008, { x: -w / 2 + pw * (i + 0.5), y: y - h, z, color, attrs: { sway: swayCloth } });
    if (crest && i === Math.floor(n / 2)) c.foliage.box(0.04, 0.04, 0.01, { x: -w / 2 + pw * (i + 0.5), y: y - h * 0.55, z: z + 0.002, color: crest, attrs: { sway: swayCloth } });
  }
}

/** A paper lantern: glow body, dark caps (solid), optional glow sprite. */
function lantern(c, x, y, z, color, { r = 0.045, h = 0.09, sprite = false, burnt = false } = {}) {
  if (burnt) {
    c.solid.cyl(r * 0.9, r * 0.8, h * 0.8, 5, { x, y: y - h * 0.4, z, color: OLD.char });
    return;
  }
  c.glow.cyl(r, r, h, 6, { x, y: y - h / 2, z, color });
  c.solid.cyl(r * 0.7, r * 0.7, 0.014, 5, { x, y: y + h / 2 - 0.007, z, color: OLD.char });
  c.solid.cyl(r * 0.7, r * 0.7, 0.014, 5, { x, y: y - h / 2 - 0.014, z, color: OLD.char });
  if (sprite) glowPoint(c, x, y, z, color, 0.42, 0.15);
}

/** Walls of a w × d house from y0 up h (timber boards and lattice windows by default). */
function walls(F, w, d, y0, h, color, kind = FK.wood) {
  F.box(0, y0, 0, w, h, d, { color, side: kind, noTop: true });
}

export const OLD_TOWN_BUILDERS = {
  // ----- the houses (≤ BOARD_MAX_H on the board; `far` in the skirt: walls and roof only) --------
  oldHouse(c) {
    const k = v(c, 'oldHouse');
    const kind = OLD_HOUSE_KINDS[k];
    const F = c.facade;
    const far = c.lod === 'far';
    const w = kind === 'bathhouse' ? 0.96 : 0.9;
    const d = 0.8;
    if (kind === 'storehouse') {
      // a white plaster storehouse: stone base, small barred window, heavy tiled roof
      F.box(0, 0, 0, w, 0.12, d, { color: OLD.stone });
      F.box(0, 0.12, 0, w - 0.04, 0.46, d - 0.04, { color: OLD.plaster, noTop: true });
      F.box(0, 0.42, 0, w - 0.02, 0.025, d - 0.02, { color: OLD.tileDark });
      tiledGable(F, 0.58, w + 0.1, d + 0.12, 0.28, OLD.tileDark, OLD.plaster);
      if (far) return;
      F.box(0, 0.26, d / 2 - 0.02, 0.16, 0.12, 0.02, { color: OLD.char, noTop: true });
      for (let i = 0; i < 3; i++) F.box(-0.05 + i * 0.05, 0.26, d / 2 - 0.005, 0.012, 0.12, 0.012, { color: OLD.stoneDark });
      F.box(0, 0.12, d / 2 - 0.018, 0.22, 0.22, 0.02, { color: OLD.timberDark, noTop: true });
      return;
    }
    if (kind === 'shrineHall') {
      // a small shrine hall on a stone plinth: red pillars, a swept tiled roof, a lantern
      F.box(0, 0, 0, w, 0.08, d, { color: OLD.stone, top: '#bdb5a8' });
      F.box(0, 0.08, -0.04, w - 0.2, 0.36, d - 0.26, { color: OLD.timber, side: FK.wood, v0: -0.08, noTop: true });
      for (const [x, z] of [[-0.36, 0.3], [0.36, 0.3], [-0.36, -0.3], [0.36, -0.3]]) F.box(x, 0.08, z, 0.05, 0.38, 0.05, { color: OLD.shrineRed });
      F.box(0, 0.44, 0, w - 0.02, 0.04, d - 0.02, { color: OLD.shrineRed });
      tiledGable(F, 0.48, w + 0.24, d + 0.26, 0.34, OLD.tileDark, OLD.shrineRed);
      if (far) return;
      // steps, an offering box, a rope with paper streamers, a lantern under the eave
      F.box(0, 0, d / 2 + 0.05, 0.3, 0.05, 0.12, { color: '#bdb5a8' });
      F.box(0, 0.08, d / 2 - 0.08, 0.2, 0.1, 0.08, { color: OLD.timberDark });
      c.solid.box(0.5, 0.02, 0.02, { y: 0.4, z: d / 2 - 0.1, color: '#e8dcc0' });
      for (const x of [-0.14, 0, 0.14]) c.foliage.box(0.03, 0.07, 0.006, { x, y: 0.33, z: d / 2 - 0.09, color: OLD.white, attrs: { sway: swayCloth } });
      lantern(c, 0.3, 0.42, d / 2 - 0.02, OLD.lanternWarm, { sprite: true });
      return;
    }
    // the timber houses: a shop floor, a pent eave, an upper floor, a tiled gable
    const H1 = 0.3;
    const H2 = kind === 'bathhouse' ? 0.2 : 0.22;
    const upper = kind === 'merchantHouse' ? OLD.plaster : OLD.timber;
    walls(F, w, d, 0, H1, kind === 'lanternShop' ? OLD.timberPale : OLD.timber);
    F.box(0, H1, 0, w, H2, d, { color: upper, side: kind === 'merchantHouse' ? FK.plain : FK.wood, v0: 0, noTop: true });
    F.box(0, H1 - 0.01, 0, w + 0.02, 0.02, d + 0.02, { color: OLD.timberDark });
    tiledGable(F, H1 + H2, w + 0.12, d + 0.14, kind === 'bathhouse' ? 0.24 : 0.26, kind === 'merchantHouse' ? OLD.tileDark : OLD.tile, upper);
    if (far) return;
    pentEave(F, w, d, H1 + 0.02, OLD.tile);
    if (kind === 'merchantHouse') {
      // plaster upper floor with a timber grille window, a long indigo curtain across the front
      F.box(0, H1 + 0.06, d / 2 + 0.005, 0.4, 0.1, 0.012, { color: OLD.timberDark, noTop: true });
      for (let i = 0; i < 6; i++) F.box(-0.17 + i * 0.068, H1 + 0.06, d / 2 + 0.014, 0.014, 0.1, 0.012, { color: OLD.timberPale, noTop: true });
      noren(c, 0.7, H1 - 0.02, d / 2 + 0.04, OLD.indigo, 4, 0.16, OLD.white);
    } else if (kind === 'shopHouse') {
      noren(c, 0.42, H1 - 0.04, d / 2 + 0.03, [OLD.indigo, OLD.red, '#3d6a5a'][(c.variant >> 1) % 3], 3, 0.12, OLD.white);
      c.solid.box(0.36, 0.1, 0.12, { x: 0.18, y: 0, z: d / 2 + 0.07, color: OLD.timberDark });
    } else if (kind === 'lanternShop') {
      // lanterns hung under the eave, more on the counter
      for (let i = 0; i < 4; i++) lantern(c, -0.3 + i * 0.2, H1 - 0.04, d / 2 + 0.1, i % 2 ? OLD.lanternRed : OLD.lanternWarm, { sprite: i === 1 });
      c.solid.box(0.6, 0.1, 0.12, { y: 0, z: d / 2 + 0.07, color: OLD.timberDark });
      for (let i = 0; i < 3; i++) c.glow.sphere(0.035, 6, 4, { x: -0.18 + i * 0.18, y: 0.14, z: d / 2 + 0.07, color: i % 2 ? OLD.lanternRed : OLD.lanternWarm });
    } else if (kind === 'bathhouse') {
      // the bathhouse: a white curtain with a wave crest, a short brick chimney with its steam
      noren(c, 0.5, H1 - 0.02, d / 2 + 0.03, OLD.white, 2, 0.15, '#3d6a9a');
      F.box(w / 2 - 0.14, H1 + H2, -d / 2 + 0.16, 0.1, 0.36, 0.1, { color: '#b8674e', side: FK.brick });
      c.emitters.push({ kind: 'steam', x: w / 2 - 0.14, y: H1 + H2 + 0.36, z: -d / 2 + 0.16 });
    }
  },

  // ----- festival dressing -------------------------------------------------------------------
  lanternString(c) {
    // a slack cord of paper lanterns along local x between two bamboo posts (the kit stands it
    // along a lane, beside the road): glow geometry, every fourth lantern a sprite; burnt: the
    // posts charred, the lanterns dark and some of them gone
    const [L, burnt] = LANTERN_STRINGS[v(c, 'lanternString')];
    const F = c.facade;
    const sag = 0.12;
    const Y = LANTERN_CORD_Y;
    const yAt = (x) => Y - sag * (1 - (2 * x / L) ** 2);
    for (const x of [-L / 2, L / 2]) {
      c.solid.cyl(0.018, 0.022, Y + 0.06, 5, { x, color: burnt ? OLD.char : '#9a8a5a' });
      c.solid.box(0.06, 0.025, 0.025, { x, y: Y - 0.02, color: burnt ? OLD.char : OLD.timberDark });
    }
    const n = 8;
    for (let i = 0; i < n; i++) {
      const xa = -L / 2 + (L * i) / n;
      const xb = -L / 2 + (L * (i + 1)) / n;
      F.box((xa + xb) / 2, (yAt(xa) + yAt(xb)) / 2, 0, xb - xa + 0.01, 0.012, 0.012, { color: burnt ? OLD.char : '#3d3a40', rz: Math.atan2(yAt(xb) - yAt(xa), xb - xa), noTop: false });
    }
    const count = Math.floor(L / LANTERN_STEP);
    for (let i = 0; i < count; i++) {
      const x = -L / 2 + LANTERN_STEP * (i + 0.5) + (L - count * LANTERN_STEP) / 2;
      if (burnt && i % 3 === 1) continue;
      const col = burnt ? OLD.char : [OLD.lanternRed, OLD.white, OLD.lanternWarm][i % 3];
      lantern(c, x, yAt(x) - 0.03, 0, col, { sprite: !burnt && i % 4 === 1, burnt });
    }
  },
  shopCurtain(c) {
    // a stall doorway: two posts, a rod and its curtain (indigo, red; 2 = scorched and torn)
    const k = v(c, 'shopCurtain');
    const post = k === 2 ? OLD.char : OLD.timberDark;
    for (const x of [-0.3, 0.3]) c.solid.box(0.04, 0.5, 0.04, { x, color: post });
    c.solid.box(0.66, 0.04, 0.05, { y: 0.5, color: post });
    if (k === 2) {
      for (const [x, h] of [[-0.2, 0.12], [0.02, 0.07], [0.2, 0.1]]) c.foliage.box(0.16, h, 0.008, { x, y: 0.48 - h, z: 0.02, color: '#3a3836', attrs: { sway: swayCloth } });
      return;
    }
    noren(c, 0.58, 0.48, 0.02, k ? OLD.red : OLD.indigo, 3, 0.2, OLD.white);
  },
  stoneBasin(c) {
    // a stone washing basin with a bamboo spout (1 = ash-dusted, dry)
    const dry = v(c, 'stoneBasin') === 1;
    c.solid.box(0.5, 0.2, 0.32, { color: dry ? '#77716a' : OLD.stone, jitter: 0.04, rand: c.rand });
    c.solid.box(0.42, 0.012, 0.24, { y: 0.2, color: dry ? '#4a4642' : '#4f8fb0' });
    c.solid.cyl(0.02, 0.02, 0.36, 5, { x: 0.3, color: dry ? OLD.char : '#7d9a55' });
    c.solid.cyl(0.018, 0.018, 0.22, 5, { x: 0.22, y: 0.34, rz: Math.PI / 2 - 0.2, color: dry ? OLD.char : '#8fae62' });
    for (let i = 0; i < 2; i++) c.solid.cyl(0.03, 0.03, 0.02, 6, { x: -0.12 + i * 0.1, y: 0.2, z: -0.04, color: dry ? '#5a5450' : OLD.timberPale });
  },
  ringToss(c) {
    // the ring-toss booth: a counter, prize shelves, a striped backboard, rings, one lantern
    c.solid.box(0.84, 0.22, 0.24, { z: 0.24, color: OLD.timberPale });
    c.solid.box(0.88, 0.5, 0.04, { z: -0.3, color: OLD.white });
    for (let i = 0; i < 5; i++) c.solid.box(0.1, 0.5, 0.042, { x: -0.36 + i * 0.18, z: -0.3, color: OLD.red });
    for (let s = 0; s < 2; s++) {
      c.solid.box(0.8, 0.02, 0.18, { y: 0.16 + s * 0.16, z: -0.18, color: OLD.timberDark });
      for (let i = 0; i < 5; i++) c.solid.box(0.07, 0.07, 0.07, { x: -0.3 + i * 0.15, y: 0.18 + s * 0.16, z: -0.18, color: ['#ffd166', '#7bd389', '#ff9ec4', '#8fd0ff', '#ffb347'][(i + s) % 5] });
    }
    for (let i = 0; i < 3; i++) c.solid.torus(0.04, 0.008, 4, 8, { x: -0.2 + i * 0.12, y: 0.23, z: 0.26, rx: Math.PI / 2, color: ['#ff6b6b', '#ffd43b', '#4cc9f0'][i] });
    for (const x of [-0.42, 0.42]) c.solid.box(0.035, 0.7, 0.035, { x, z: 0.34, color: OLD.timberDark });
    c.solid.box(0.9, 0.06, 0.04, { y: 0.66, z: 0.34, color: OLD.red });
    lantern(c, 0, 0.62, 0.36, OLD.lanternWarm, { sprite: true });
  },
  bowStage(c) {
    // the bowing-contest stage: a low timber stage, a red-and-white skirt, two banner poles
    c.solid.box(0.92, 0.16, 0.7, { color: OLD.timberPale, top: '#c9a27a' });
    for (let i = 0; i < 8; i++) c.solid.box(0.115, 0.13, 0.012, { x: -0.4 + i * 0.115, y: 0.01, z: 0.355, color: i % 2 ? OLD.white : OLD.red });
    c.solid.box(0.3, 0.06, 0.14, { y: 0, z: 0.42, color: OLD.timberDark });
    for (const x of [-0.42, 0.42]) {
      c.solid.cyl(0.015, 0.015, 0.7, 4, { x, y: 0.16, z: -0.3, color: OLD.timberDark });
      c.foliage.box(0.012, 0.36, 0.1, { x: x + (x < 0 ? 0.01 : -0.01), y: 0.46, z: -0.24, color: x < 0 ? OLD.red : OLD.indigo, attrs: { sway: swayCloth } });
    }
    c.solid.box(0.6, 0.012, 0.3, { y: 0.16, z: -0.1, color: '#e8dcc0' });
  },
  griddleStall(c) {
    // a festival stall with a hot griddle (takoyaki / yakisoba): the plate glows amber, it steams
    const k = v(c, 'griddleStall');
    const stripes = k ? ['#3d6a9a', OLD.white] : [OLD.red, OLD.white];
    c.solid.box(0.8, 0.3, 0.4, { z: 0.12, color: '#b9875a', jitter: 0.04, rand: c.rand });
    c.solid.box(0.84, 0.04, 0.44, { y: 0.3, z: 0.12, color: OLD.timberDark });
    for (const [x, z] of [[-0.38, 0.32], [0.38, 0.32], [-0.38, -0.28], [0.38, -0.28]]) c.solid.cyl(0.025, 0.025, 0.72, 5, { x, z, color: '#6d4433' });
    for (let i = 0; i < 6; i++) c.solid.box(0.15, 0.03, 0.72, { x: -0.375 + i * 0.15, y: 0.74, z: 0.02, rx: -0.25, color: stripes[i % 2] });
    c.solid.box(0.9, 0.08, 0.03, { y: 0.66, z: 0.38, color: stripes[0] });
    // the griddle: a dark plate on the counter, its hot face as glow geometry
    c.solid.box(0.44, 0.03, 0.24, { y: 0.34, z: 0.1, color: '#2e2a28' });
    c.glow.box(0.38, 0.008, 0.18, { y: 0.372, z: 0.1, color: '#ffb347' });
    if (k === 0) for (let i = 0; i < 6; i++) c.solid.sphere(0.022, 5, 4, { x: -0.13 + (i % 3) * 0.13, y: 0.39, z: 0.05 + Math.floor(i / 3) * 0.1, color: '#c98a4a' });
    else c.solid.box(0.3, 0.02, 0.12, { y: 0.38, z: 0.1, color: '#c9a26a' });
    glowPoint(c, 0, 0.42, 0.1, '#ffb347', 0.45, 0.2);
    c.emitters.push({ kind: 'steam', x: 0, y: 0.42, z: 0.1 });
    lantern(c, -0.3, 0.64, 0.4, OLD.lanternRed);
    lantern(c, 0.3, 0.64, 0.4, OLD.lanternWarm);
  },
  festivalPoster(c) {
    // the festival poster on its board (1 = after the barrage: the board fallen, the poster face down)
    if (v(c, 'festivalPoster') === 1) {
      c.solid.box(0.42, 0.02, 0.52, { x: 0.05, y: 0, color: '#4a4440', ry: 0.3 });
      c.solid.box(0.36, 0.008, 0.46, { x: 0.05, y: 0.02, color: '#d8d0c0', ry: 0.3 });
      c.solid.box(0.04, 0.04, 0.5, { x: -0.25, y: 0, z: 0.1, ry: 0.9, color: OLD.char });
      return;
    }
    for (const x of [-0.2, 0.2]) c.solid.box(0.035, 0.62, 0.035, { x, color: OLD.timberDark });
    c.solid.box(0.46, 0.5, 0.02, { y: 0.3, color: OLD.timberDark });
    c.solid.add(new THREE.PlaneGeometry(0.4, 0.44), { y: 0.55, z: 0.012, color: '#fff1d6', color2: '#ff9ec4' });
    // the bell and a lantern on the poster
    c.solid.cyl(0.04, 0.06, 0.08, 6, { y: 0.56, z: 0.018, color: '#e3b04a' });
    c.solid.box(0.3, 0.04, 0.005, { y: 0.4, z: 0.016, color: OLD.red });
  },
  easel(c) {
    // a painter's easel on a corner with a canvas of the lane (1 = knocked over)
    if (v(c, 'easel') === 1) {
      c.solid.box(0.04, 0.03, 0.62, { x: -0.1, y: 0, ry: 0.4, color: OLD.char });
      c.solid.box(0.04, 0.03, 0.56, { x: 0.06, y: 0, ry: -0.3, color: OLD.char });
      c.solid.box(0.34, 0.02, 0.28, { x: 0.18, y: 0, z: 0.16, ry: 0.7, color: '#5a5450' });
      return;
    }
    const lean = -0.18;
    for (const x of [-0.14, 0.14]) c.solid.box(0.03, 0.64, 0.03, { x, z: 0.04, rx: lean, color: OLD.timberPale });
    c.solid.box(0.03, 0.62, 0.03, { z: -0.14, rx: 0.32, color: OLD.timberPale });
    c.solid.box(0.36, 0.03, 0.06, { y: 0.24, z: 0.1, color: OLD.timberPale });
    c.solid.box(0.34, 0.28, 0.02, { y: 0.27, z: 0.09, rx: lean, color: '#f7f2e6' });
    c.solid.box(0.3, 0.08, 0.004, { y: 0.4, z: 0.085, rx: lean, color: '#ffb3cf' });
    c.solid.box(0.3, 0.06, 0.004, { y: 0.31, z: 0.1, rx: lean, color: '#56606e' });
  },
};

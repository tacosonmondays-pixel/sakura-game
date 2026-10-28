// City kit (Gate Arc, Noon `city` theme): the building library. Every building is a few boxes
// baked into the prop context's `facade` accumulator (cityMaterials.js CityAcc): windows, shop
// fronts, brick courses and awning stripes come from the facade shader, so a whole street costs
// one draw call. Signs, lamps and lit windows that must glow are unlit `glow` geometry.
//
// Itomachi is warm and lived-in (GATE_ARC §18.1): cream and tan plaster, brick, terracotta,
// green and red awnings, laundry on the balconies. Buildings on the board stay low (the 48°
// battle camera hides ≈ 0.9 h tiles behind a building of height h): every on-board kind is at
// most BOARD_MAX_H tall. The tall skyline lives in the skirt outside the board.
//
// Local frame: origin = tile centre on the ground, +y up, +z = the front (the street side).
import * as THREE from 'three';
import { FK } from './cityMaterials.js';

/** Storey height of an on-board building (a girl is ≈ 0.9 tall). */
export const FLOOR = 0.3;
/** Tallest on-board building (interior H next to a road; GATE_ARC §18.6, TECH §3.5). */
export const BOARD_MAX_H = 0.9;

/** Warm Noon palette shared by the city kit. */
export const PAL = {
  cream: '#f3e7d0',
  plaster: '#ecdcc0',
  tan: '#dcc29c',
  sand: '#e8d6b4',
  terracotta: '#d4876a',
  brick: '#b8674e',
  brickDark: '#94503c',
  sage: '#cdd8bf',
  mint: '#cfe6d8',
  white: '#f7f4ee',
  concrete: '#bdb6aa',
  parapet: '#d8d0c2',
  roofGrey: '#9c968c',
  steel: '#9aa3ae',
  steelDark: '#6b7480',
  navy: '#34405e',
  wood: '#a87a52',
  green: '#4f9a62',
  greenDeep: '#3d7f52',
  red: '#d9604a',
  mustard: '#e3b04a',
  sky: '#7fb8dc',
  pink: '#f08aa8',
  tileBlue: '#5e7896',
  tileRed: '#b9644e',
  tileGrey: '#5f646c',
};

/** Awning colours of the shop rows (green first: GATE_ARC §18.1 "green awnings"). */
export const AWNINGS = ['#4f9a62', '#d9604a', '#3d6a9a', '#e3b04a', '#3d7f52', '#f08aa8'];
/** Warm sign glows for shop fascias. */
export const SIGN_GLOWS = ['#fff1cf', '#ffe2c4', '#e8f6ff', '#ffe8f0'];

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

/** Appends a primitive geometry with a transform to a CityAcc (the geometry is consumed). */
export function prim(acc, geom, o, color, kind = 0) {
  _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ');
  _q.setFromEuler(_e);
  _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
  _p.set(o.x || 0, o.y || 0, o.z || 0);
  _m.compose(_p, _q, _s);
  acc.geo(geom, _m, color, kind);
  geom.dispose();
}

// ---------------------------------------------------------------------------
// shared pieces
// ---------------------------------------------------------------------------

/** Four thin walls round a flat roof (top at y + h). */
export function parapet(F, w, d, y, color = PAL.white, t = 0.04, h = 0.05) {
  F.box(0, y, d / 2 - t / 2, w, h, t, { color });
  F.box(0, y, -d / 2 + t / 2, w, h, t, { color });
  F.box(w / 2 - t / 2, y, 0, t, h, d - t * 2, { color });
  F.box(-w / 2 + t / 2, y, 0, t, h, d - t * 2, { color });
}

/** Flat-roof dressing: an AC unit, sometimes a water tank or a little stair hut. */
/** Flat-roof finishes seen from the battle camera (it mostly sees roofs): warm, varied. */
export const ROOFS = ['#c98a6e', '#9fb59a', '#b9c3cc', '#d9c49a', '#a7a0b8', '#c4b5a2'];

export function roofKit(c, w, d, y, kind = 0) {
  const F = c.facade;
  F.box(0, y, 0, w - 0.06, 0.012, d - 0.06, { color: ROOFS[kind % ROOFS.length], noTop: false });
  // (dressing stays ≤ 0.12 tall so an on-board building keeps under BOARD_MAX_H)
  if (kind % 3 === 0) {
    F.box(-w * 0.22, y, -d * 0.18, 0.16, 0.08, 0.12, { color: '#e9e6df' });
  } else if (kind % 3 === 1) {
    prim(F, new THREE.CylinderGeometry(0.07, 0.07, 0.12, 6), { x: w * 0.2, y: y + 0.06, z: -d * 0.18 }, '#cfd6dc');
    F.box(-w * 0.2, y, d * 0.1, 0.14, 0.07, 0.1, { color: '#e9e6df' });
  } else {
    F.box(w * 0.18, y, -d * 0.15, 0.2, 0.1, 0.18, { color: PAL.plaster });
  }
}

/** A sloped awning over the front face (local +z), striped by the facade shader. */
export function awning(c, w, d, y, color, depth = 0.22) {
  c.facade.box(0, y, d / 2 + depth * 0.42, w, 0.025, depth, { rx: 0.42, color, side: FK.awning, topKind: FK.awning });
}

/** Gable roof (ridge along local x), eaves w × d, ridge height h, standing on y. */
export function gable(F, y, w, d, h, color) {
  const hw = w / 2;
  const hd = d / 2;
  const base = new THREE.Color(color);
  const front = base.clone().multiplyScalar(1.06);
  const back = base.clone().multiplyScalar(0.72);
  F.quad([-hw, y, hd], [hw, y, hd], [hw, y + h, 0], [-hw, y + h, 0], front);
  F.quad([hw, y, -hd], [-hw, y, -hd], [-hw, y + h, 0], [hw, y + h, 0], back);
  const wall = PAL.plaster;
  F.tri([-hw + 0.04, y, -hd + 0.04], [-hw + 0.04, y, hd - 0.04], [-hw + 0.04, y + h - 0.03, 0], wall);
  F.tri([hw - 0.04, y, hd - 0.04], [hw - 0.04, y, -hd + 0.04], [hw - 0.04, y + h - 0.03, 0], wall);
}

// ---------------------------------------------------------------------------
// on-board buildings (cityBlock variants; all ≤ BOARD_MAX_H)
// ---------------------------------------------------------------------------

/**
 * Shop row unit: a shop on the ground floor (glass front, striped awning, lit sign), one floor
 * of flats above, a flat roof with an AC unit. 0.74 tall.
 * @param {object} c prop context (facade, glow, foliage, glows)
 * @param {{ tone?: number, awn?: string, sign?: string }} [o]
 */
export function shopRow(c, o = {}) {
  const F = c.facade;
  const w = 0.92;
  const d = 0.84;
  const tone = o.tone ?? 0;
  const walls = [PAL.cream, PAL.tan, PAL.sage, PAL.plaster];
  const wall = walls[tone % walls.length];
  const H1 = 0.34;
  const H2 = FLOOR;
  F.box(0, 0, 0, w, H1, d, { color: wall, side: FK.shop, faces: [true, false, false, false], noTop: true });
  F.box(0, 0, 0, w, H1, d, { color: wall, faces: [false, true, true, true], noTop: true });
  F.box(0, H1, 0, w, H2, d, { color: tone % 2 ? PAL.brick : wall, side: tone % 2 ? FK.brick : FK.flats, v0: -H1 });
  F.box(0, H1 - 0.012, 0, w + 0.02, 0.024, d + 0.02, { color: PAL.white });
  parapet(F, w, d, H1 + H2);
  roofKit(c, w, d, H1 + H2, tone);
  awning(c, w - 0.04, d, H1 - 0.1, o.awn || AWNINGS[tone % AWNINGS.length]);
  c.glow.box(w * 0.56, 0.06, 0.01, { y: H1 - 0.03, z: d / 2 + 0.006, color: o.sign || SIGN_GLOWS[tone % SIGN_GLOWS.length] });
}

/** Low apartment: two floors of flats over a ground floor, balconies with laundry. 0.87 tall. */
export function apartment(c, o = {}) {
  const F = c.facade;
  const w = 0.9;
  const d = 0.8;
  const tone = o.tone ?? 0;
  const wall = [PAL.plaster, PAL.sand, PAL.mint][tone % 3];
  const H = FLOOR * 2.4;
  F.box(0, 0, 0, w, H, d, { color: wall, side: FK.flats });
  F.box(0, H, 0, w + 0.02, 0.03, d + 0.02, { color: PAL.parapet });
  // stair core on one side, a little taller
  F.box(w / 2 - 0.1, 0, -d / 2 + 0.12, 0.2, H + 0.06, 0.24, { color: PAL.concrete });
  // balcony slabs + rails on the front
  for (let k = 1; k < 3; k++) {
    const y = k * FLOOR - 0.01;
    F.box(-0.04, y, d / 2 + 0.06, w - 0.16, 0.025, 0.12, { color: PAL.white });
    F.box(-0.04, y + 0.025, d / 2 + 0.115, w - 0.16, 0.07, 0.012, { color: PAL.steel });
  }
  // laundry on the upper rail (sways with the wind: foliage)
  const cloth = ['#ffffff', '#ffd6e2', '#cfe6ff', '#fff2b8'];
  for (let i = 0; i < 3; i++) {
    c.foliage.box(0.1, 0.1, 0.012, { x: -0.3 + i * 0.16, y: 2 * FLOOR - 0.02, z: d / 2 + 0.13, color: cloth[(i + tone) % 4], attrs: { sway: () => 0.6 } });
  }
  roofKit(c, w, d, H + 0.03, tone + 1);
}

/** Small office: a glass lobby, ribbon windows above, a glass corner bay. 0.88 tall. */
export function office(c, o = {}) {
  const F = c.facade;
  const w = 0.88;
  const d = 0.82;
  const tone = o.tone ?? 0;
  const wall = [PAL.white, PAL.sand][tone % 2];
  F.box(0, 0, 0, w, 0.3, d, { color: wall, side: FK.lobby });
  F.box(0, 0.3, 0, w, 0.44, d, { color: wall, side: FK.office, v0: -0.3 });
  F.box(w / 2 - 0.16, 0.3, d / 2 - 0.16, 0.34, 0.44, 0.34, { color: PAL.white, side: FK.glass, noTop: true });
  F.box(0, 0.74, 0, w + 0.03, 0.04, d + 0.03, { color: PAL.white });
  roofKit(c, w, d, 0.78, 2);
  c.glow.box(0.32, 0.05, 0.01, { x: -0.18, y: 0.24, z: d / 2 + 0.006, color: '#e8f6ff' });
}

/** Convenience store: one storey, glass front, a coloured stripe band, a lit sign. 0.56 tall. */
export function convenienceStore(c, o = {}) {
  const F = c.facade;
  const w = 0.94;
  const d = 0.86;
  const h = 0.46;
  const stripes = [['#4f9a62', '#e8823a'], ['#3d6a9a', '#e3b04a'], ['#d9604a', '#f7f4ee']][(o.tone ?? 0) % 3];
  F.box(0, 0, 0, w, h, d, { color: PAL.white, side: FK.shop, faces: [true, false, false, false], noTop: true });
  F.box(0, 0, 0, w, h, d, { color: PAL.white, faces: [false, true, true, true], noTop: true });
  F.box(0, h, 0, w + 0.02, 0.07, d + 0.02, { color: '#f1efea' });
  F.box(0, h - 0.11, d / 2 + 0.008, w - 0.02, 0.04, 0.012, { color: stripes[0], noTop: true });
  F.box(0, h - 0.07, d / 2 + 0.008, w - 0.02, 0.03, 0.012, { color: stripes[1], noTop: true });
  c.glow.box(w * 0.5, 0.07, 0.012, { y: h + 0.005, z: d / 2 + 0.014, color: '#fff8e6' });
  c.glows.push({ x: 0, y: h, z: d / 2 + 0.1, color: '#fff3dc', size: 0.5, flicker: 0.04 });
  F.box(0, h + 0.07, 0, w - 0.1, 0.01, d - 0.1, { color: ROOFS[2] });
  F.box(w * 0.25, h + 0.07, -d * 0.2, 0.18, 0.09, 0.14, { color: '#e9e6df' });
}

/** Clinic: two pale storeys, a green cross sign, a small entrance canopy. 0.72 tall. */
export function clinic(c) {
  const F = c.facade;
  const w = 0.86;
  const d = 0.8;
  const H = 0.66;
  F.box(0, 0, 0, w, 0.3, d, { color: PAL.white, side: FK.lobby });
  F.box(0, 0.3, 0, w, H - 0.3, d, { color: PAL.mint, side: FK.flats, v0: -0.3 });
  F.box(0, H, 0, w + 0.02, 0.04, d + 0.02, { color: PAL.white });
  F.box(-0.18, 0.28, d / 2 + 0.09, 0.36, 0.025, 0.18, { color: PAL.white });
  // green cross (unlit backing + glowing bars)
  F.box(0.26, 0.42, d / 2 + 0.01, 0.16, 0.16, 0.02, { color: PAL.white });
  c.glow.box(0.12, 0.035, 0.012, { x: 0.26, y: 0.483, z: d / 2 + 0.024, color: '#5fd38a' });
  c.glow.box(0.035, 0.12, 0.012, { x: 0.26, y: 0.44, z: d / 2 + 0.024, color: '#5fd38a' });
  roofKit(c, w, d, H + 0.04, 1);
}

/** Police box: a small one-room post with a red lamp over the door, a bicycle beside it. */
export function policeBox(c) {
  const F = c.facade;
  const w = 0.56;
  const d = 0.5;
  F.box(0, 0, 0, 0.9, 0.02, 0.84, { color: '#d9d3c8' });
  F.box(0, 0.02, -0.1, w, 0.42, d, { color: PAL.white, side: FK.lobby });
  F.box(0, 0.44, -0.1, w + 0.08, 0.06, d + 0.08, { color: PAL.navy });
  F.box(0, 0.5, -0.1, w - 0.1, 0.05, d - 0.1, { color: '#4a5878' });
  F.box(0, 0.33, 0.16, 0.36, 0.06, 0.02, { color: PAL.navy, noTop: true });
  c.glow.box(0.26, 0.03, 0.01, { y: 0.345, z: 0.173, color: '#e8f2ff' });
  c.glow.sphere(0.045, 6, 4, { y: 0.6, z: -0.1, color: '#ff5a4e' });
  c.glows.push({ x: 0, y: 0.62, z: -0.1, color: '#ff6a5a', size: 0.45, flicker: 0.05 });
  // a bicycle by the door
  F.box(0.36, 0.02, 0.22, 0.03, 0.12, 0.3, { color: '#3d6a9a' });
  F.box(0.36, 0.14, 0.22, 0.03, 0.02, 0.18, { color: PAL.navy });
}

// ---------------------------------------------------------------------------
// houses and skyline (skirt; may be tall)
// ---------------------------------------------------------------------------

/** A two-storey family house with a pitched tile roof and a porch (`far`: no porch or door). */
export function house(c, o = {}) {
  const F = c.facade;
  const tone = o.tone ?? 0;
  const w = o.w ?? 0.86;
  const d = o.d ?? 0.74;
  const walls = [PAL.cream, PAL.plaster, PAL.sage, PAL.sand];
  const roofs = [PAL.tileBlue, PAL.tileRed, PAL.tileGrey, '#7a6a9a'];
  const H = 0.62;
  F.box(0, 0, 0, w, H, d, { color: walls[tone % 4], side: FK.flats, v0: 0.16 });
  gable(F, H, w + 0.12, d + 0.14, 0.32, roofs[(tone + 1) % 4]);
  if (o.far) return;
  F.box(w * 0.18, 0.3, d / 2 + 0.06, 0.32, 0.025, 0.14, { color: PAL.plaster });
  F.box(w * 0.18, 0, d / 2 + 0.005, 0.13, 0.25, 0.012, { color: PAL.wood, noTop: true });
}

/**
 * Skyline building for the skirt: `floors` storeys of the given style. Far LOD skips the roof
 * dressing.
 * @param {object} c prop context
 * @param {{ style: 'office'|'flats'|'brick'|'glass'|'store', floors: number, w?: number, d?: number, tone?: number, far?: boolean }} o
 */
export function tower(c, o) {
  const F = c.facade;
  const w = o.w ?? 1.5;
  const d = o.d ?? 1.4;
  const H = o.floors * 0.34;
  const tone = o.tone ?? 0;
  const style = o.style;
  if (style === 'glass') {
    F.box(0, 0, 0, w - 0.1, 0.34, d - 0.1, { color: PAL.white, side: FK.lobby });
    F.box(0, 0.34, 0, w, H - 0.34, d, { color: '#e8ecef', side: FK.glass, v0: -0.34 });
  } else if (style === 'office') {
    F.box(0, 0, 0, w, 0.34, d, { color: PAL.sand, side: FK.lobby });
    F.box(0, 0.34, 0, w, H - 0.34, d, { color: [PAL.sand, PAL.white, PAL.plaster][tone % 3], side: FK.office, v0: -0.34 });
  } else if (style === 'brick') {
    F.box(0, 0, 0, w, H, d, { color: tone % 2 ? PAL.brick : PAL.terracotta, side: FK.brick });
  } else if (style === 'store') {
    F.box(0, 0, 0, w, 0.36, d, { color: PAL.white, side: FK.shop });
    F.box(0, 0.36, 0, w, H - 0.36, d, { color: PAL.cream, side: FK.gym, v0: -0.36 });
  } else {
    F.box(0, 0, 0, w, H, d, { color: [PAL.plaster, PAL.mint, PAL.sand][tone % 3], side: FK.flats });
  }
  F.box(0, H, 0, w + 0.04, 0.05, d + 0.04, { color: PAL.parapet });
  if (o.far) return;
  if (style === 'store') {
    // a rooftop sign frame with a lit face
    F.box(0, H + 0.05, -d * 0.3, w * 0.7, 0.04, 0.05, { color: PAL.steelDark });
    for (const s of [-1, 1]) F.box(s * w * 0.3, H + 0.05, -d * 0.3, 0.04, 0.3, 0.04, { color: PAL.steelDark });
    c.glow.box(w * 0.62, 0.22, 0.02, { y: H + 0.2, z: -d * 0.3 + 0.03, color: ['#ffe2c4', '#e8f6ff', '#ffe8f0'][tone % 3] });
  } else {
    roofKit(c, w, d, H + 0.05, tone);
  }
}

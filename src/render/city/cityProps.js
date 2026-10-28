// City kit (Gate Arc, Noon `city` theme): street furniture, Act 1 set pieces and the two city
// gates as ordinary prop builders (props.js BUILDERS). Each builder bakes into the prop
// context's geometries: `solid` (lit), `foliage` (lit + wind sway: leaves, laundry, a cat's
// tail), `glow` (unlit: lamps, signs, the rift), `facade` (cityMaterials.js: buildings with
// shader windows), plus glow sprites and particle emitters. Props are cached per (type, theme,
// day/night, variant, LOD) and merged into the terrain's shared meshes, so a hundred lamps cost
// no extra draw call.
//
// Every builder keeps to CITY_VARIANTS[type] variants (≤ 6, `c.variant % n`) and to a triangle
// cap (tests/render/cityKit.test.js). Nothing here is transparent. The Brigade appears only as
// dressing (the drones overhead, cityKit.js); nothing here fights or targets anything.
import * as THREE from 'three';
import { FK } from './cityMaterials.js';
import {
  PAL, ROOFS, SIGN_GLOWS, shopRow, apartment, office, convenienceStore, clinic, policeBox, house, tower, parapet, awning, prim,
} from './buildings.js';

const swayW = (x, y) => Math.max(0, Math.min(1, (y - 0.25) * 0.9));

/** Variants per builder (`c.variant % n`); the kit and the tests read this. */
export const CITY_VARIANTS = {
  // street
  cityBlock: 6, cityTower: 6, cityWall: 3, shopFront: 6, streetLamp: 1, trafficLight: 1, vendingMachine: 3,
  busStop: 2, billboard: 3, parkedCar: 4, roadCone: 1, barricade: 1, bollard: 1, hydrant: 1, mailbox: 1,
  trashBin: 1, bikeRack: 1, streetTree: 2, powerPole: 1, planterBox: 2, guardRail: 1, laundryLine: 3,
  catOnWall: 2, pigeonGroup: 2, missingPoster: 4, manhole: 1, bunSteamer: 1,
  // Act 1 set pieces
  stationHall: 1, ticketGates: 1, clockTower: 1, levelCrossing: 3, waterBus: 1, lockGate: 1, arcadeRibs: 1, roofBlock: 2,
  dryFountain: 1,
  // gates
  petalRift: 2, shelterDoor: 3,
};

/** Height of a rooftop ('U' tile, src/sim/placement.js): girls stand on it, so it stays low (≤ 0.6) and readable. */
export const ROOF_Y = 0.56;

/**
 * The level crossing's barrier arm, in the post's frame (levelCrossing; cityKit animates it): the
 * hub it turns on, its length (the road side is local +x) and its striped segments.
 */
export const CROSSING_ARM = { hubX: 0.1, hubY: 0.44, segs: 6, seg: 0.16, w: 0.035 };

/** cityBlock variant → kind (GATE_ARC §18.3). */
export const BLOCK_KINDS = ['shopRow', 'apartment', 'office', 'convenienceStore', 'clinic', 'policeBox'];
/** shopFront variant → shop (MAPS §3.3). */
export const SHOP_KINDS = ['bakery', 'bookshop', 'bunStall', 'florist', 'pharmacy', 'toyShop'];
/** shelterDoor variant → door (GATE_ARC §18.4). */
export const SHELTER_KINDS = ['stationShelter', 'schoolMain', 'schoolBack'];
/** The traffic signal's sprite cycles through these (ambient.js reads `cycle`). */
export const SIGNAL_CYCLE = { colors: ['#5fe0a8', '#5fe0a8', '#ffd54f', '#ff6f8a', '#ff6f8a'], period: 10 };

const RIFT = { violet: '#b46cff', pink: '#ff8fcf', core: '#ffe6f6', frost: '#d8f2ff' };
/** How far the rift's ring leans from upright (radians). */
export const RIFT_TILT = 0.9;
/** Lean per petalRift variant (+ = top back over the street the column came down): 0 on a side or
 * the far edge (leaning back turns the disc up toward the camera), 1 on the near edge, where
 * leaning back would show the camera the disc's rim: there the top leans forward over the board. */
const RIFT_LEANS = [RIFT_TILT, -RIFT_TILT];

/**
 * Where the petalRift stands for a spawn gate walking in along `dir` (board coords: +z is toward
 * the battle camera, down the screen in landscape): its variant, and how far in from the board
 * edge its foot stands (tiles). It stands on the edge like every shipped gate, so the column is
 * not seen on the street behind it, except on the far edge: there what lies behind it is under
 * the HUD (landscape) or past the screen's edge (portrait) and its own disc hides the last of
 * the street, so it stands a little in, which keeps its leaning ring on screen.
 * @param {number[]} dir [dx, dz] unit walk direction at the gate
 * @returns {{ variant: number, inset: number }}
 */
export function riftPlacement(dir) {
  if (dir[1] < -0.7) return { variant: 1, inset: 0 };
  if (dir[1] > 0.7) return { variant: 0, inset: 0.55 };
  return { variant: 0, inset: 0 };
}

function glowPoint(c, x, y, z, color, size = 0.6, flicker = 0.15, extra = null) {
  c.glows.push({ x, y, z, color, size, flicker, ...(extra || {}) });
}

function leaf(c, r, o) {
  c.foliage.blob(r, { detail: c.lod === 'far' ? 0 : 1, wobble: 0.22, jitter: 0.06, rand: c.rand, attrs: { sway: swayW }, ...o });
}

const v = (c, type) => c.variant % CITY_VARIANTS[type];

/** A thin dark wire between two points (two crossed quads), baked into a facade accumulator. */
export function wire(F, p, q, col = '#3d3a40', t = 0.01) {
  const dx = q[0] - p[0];
  const dz = q[2] - p[2];
  const l = Math.hypot(dx, dz) || 1;
  const nx = (-dz / l) * t;
  const nz = (dx / l) * t;
  F.quad([p[0] - nx, p[1], p[2] - nz], [q[0] - nx, q[1], q[2] - nz], [q[0] + nx, q[1], q[2] + nz], [p[0] + nx, p[1], p[2] + nz], col);
  F.quad([p[0] + nx, p[1], p[2] + nz], [q[0] + nx, q[1], q[2] + nz], [q[0] - nx, q[1], q[2] - nz], [p[0] - nx, p[1], p[2] - nz], col);
  F.quad([p[0], p[1] - t, p[2]], [q[0], q[1] - t, q[2]], [q[0], q[1] + t, q[2]], [p[0], p[1] + t, p[2]], col);
  F.quad([p[0], p[1] + t, p[2]], [q[0], q[1] + t, q[2]], [q[0], q[1] - t, q[2]], [p[0], p[1] - t, p[2]], col);
}

export const CITY_BUILDERS = {
  // ----- buildings ------------------------------------------------------------------------
  cityBlock(c) {
    const k = BLOCK_KINDS[v(c, 'cityBlock')];
    if (k === 'shopRow') shopRow(c, { tone: 0 });
    else if (k === 'apartment') apartment(c, { tone: 1 });
    else if (k === 'office') office(c, { tone: 1 });
    else if (k === 'convenienceStore') convenienceStore(c, { tone: 0 });
    else if (k === 'clinic') clinic(c);
    else policeBox(c);
  },
  shopFront(c) {
    // one shop unit of a shopping street: the awning colour and the display tell the shops apart
    const k = v(c, 'shopFront');
    const F = c.facade;
    const awn = [PAL.mustard, PAL.greenDeep, PAL.red, PAL.green, '#3d6a9a', PAL.pink][k];
    const two = k % 2 === 1;
    if (two) {
      shopRow(c, { tone: k, awn, sign: SIGN_GLOWS[k % 4] });
    } else {
      const w = 0.92;
      const d = 0.8;
      const h = 0.4;
      const wall = [PAL.cream, PAL.white, PAL.tan][k / 2];
      F.box(0, 0, 0, w, h, d, { color: wall, side: FK.shop, faces: [true, false, false, false], noTop: true });
      F.box(0, 0, 0, w, h, d, { color: wall, faces: [false, true, true, true], noTop: true });
      F.box(0, h, 0, w + 0.02, 0.1, d + 0.02, { color: wall });
      F.box(0, h + 0.1, -0.08, w - 0.1, 0.012, d - 0.24, { color: ROOFS[k] });
      awning(c, w - 0.04, d, h - 0.08, awn);
      c.glow.box(w * 0.6, 0.07, 0.012, { y: h + 0.015, z: d / 2 + 0.012, color: SIGN_GLOWS[k % 4] });
    }
    // the display in front (bread, books, buns, flowers, a green cross, toys)
    const z = 0.47;
    if (k === 0) for (let i = 0; i < 3; i++) c.solid.box(0.08, 0.05, 0.06, { x: -0.12 + i * 0.12, y: 0.12, z, color: '#d8a060' });
    if (k === 0 || k === 1 || k === 4) c.solid.box(0.42, 0.12, 0.1, { y: 0, z, color: PAL.wood });
    if (k === 1) for (let i = 0; i < 4; i++) c.solid.box(0.07, 0.03, 0.08, { x: -0.15 + i * 0.1, y: 0.12, z, color: ['#3d6a9a', '#d9604a', '#e3b04a', '#4f9a62'][i] });
    if (k === 2) {
      CITY_BUILDERS.bunSteamer(c);
    }
    if (k === 3) {
      for (let i = 0; i < 3; i++) {
        c.solid.box(0.12, 0.08, 0.12, { x: -0.16 + i * 0.16, y: 0, z, color: PAL.terracotta });
        leaf(c, 0.07, { x: -0.16 + i * 0.16, y: 0.14, z, color: ['#ff9ec4', '#ffe680', '#ffffff'][i] });
      }
    }
    if (k === 4) c.glow.box(0.05, 0.14, 0.012, { x: 0.3, y: 0.28, z: 0.415, color: '#5fd38a' });
    if (k === 5) for (let i = 0; i < 2; i++) c.solid.sphere(0.05, 6, 4, { x: -0.08 + i * 0.16, y: 0.17, z, color: ['#ff9ec4', '#7fd0ff'][i] });
  },
  cityTower(c) {
    const k = v(c, 'cityTower');
    const far = c.lod === 'far';
    if (k === 5) {
      // a pair of small houses (the low front rows of the skirt), shifted apart in place
      const F = c.facade;
      for (const [x, z, t] of [[-0.42, 0.1, 0], [0.48, -0.12, 1]]) {
        const before = F.pos.length;
        house(c, { tone: t + 1, w: 0.8, d: 0.7, far });
        for (let i = before; i < F.pos.length; i += 3) {
          F.pos[i] += x;
          F.pos[i + 2] += z;
        }
      }
      return;
    }
    const spec = [
      { style: 'office', floors: 6, tone: 0 },
      { style: 'flats', floors: 5, tone: 1 },
      { style: 'brick', floors: 4, tone: 1 },
      { style: 'glass', floors: 9, tone: 0 },
      { style: 'store', floors: 5, tone: 2 },
    ][k];
    tower(c, { ...spec, far });
  },
  cityWall(c) {
    // border H tiles: a low retaining wall with a hedge, a construction fence, a brick wall
    const k = v(c, 'cityWall');
    if (k === 0) {
      c.solid.box(1.0, 0.24, 0.3, { color: PAL.concrete });
      c.solid.box(1.02, 0.03, 0.32, { y: 0.24, color: PAL.parapet });
      c.solid.box(0.94, 0.16, 0.22, { y: 0.27, z: -0.02, color: '#64a656', jitter: 0.06, rand: c.rand });
    } else if (k === 1) {
      for (let i = 0; i < 2; i++) c.solid.box(0.48, 0.42, 0.04, { x: -0.25 + i * 0.5, color: i % 2 ? '#e9e6df' : '#dcd8cf' });
      c.solid.box(1.0, 0.06, 0.05, { y: 0.06, z: 0.005, color: PAL.mustard });
      c.solid.box(1.0, 0.04, 0.05, { y: 0.36, z: 0.005, color: '#3d6a9a' });
      for (const x of [-0.5, 0, 0.5]) c.solid.box(0.04, 0.46, 0.06, { x, color: PAL.steel });
    } else {
      c.facade.box(0, 0, 0, 1.0, 0.34, 0.26, { color: PAL.brick, side: FK.brick });
      c.facade.box(0, 0.34, 0, 1.04, 0.035, 0.3, { color: PAL.parapet });
      c.solid.box(0.36, 0.12, 0.16, { x: 0.22, y: 0.375, color: PAL.terracotta });
      c.foliage.blob(0.11, { x: 0.22, y: 0.52, detail: 0, color: '#6caa5a', attrs: { sway: swayW } });
    }
  },

  // ----- street furniture (low-poly: triangle caps in tests/render/cityKit.test.js) ----
  streetLamp(c) {
    // slim pole, an arm over the road (+z), a flat lamp head with a warm glow
    c.solid.cyl(0.024, 0.032, 1.18, 6, { color: PAL.steelDark });
    c.solid.box(0.02, 0.02, 0.32, { y: 1.18, z: 0.15, color: PAL.steelDark });
    c.solid.box(0.12, 0.04, 0.2, { y: 1.14, z: 0.32, color: PAL.steelDark });
    c.glow.box(0.09, 0.012, 0.16, { y: 1.128, z: 0.32, color: '#fff2d6' });
    glowPoint(c, 0, 1.1, 0.32, '#ffe9c4', 0.55, 0.05);
  },
  trafficLight(c) {
    // a pole with an arm over the road and a three-lamp head; the lit lamp cycles (ambient.js)
    c.solid.cyl(0.03, 0.035, 1.1, 6, { color: PAL.steel });
    c.solid.box(0.02, 0.02, 0.5, { y: 1.06, z: 0.24, color: PAL.steel });
    c.solid.box(0.34, 0.12, 0.08, { y: 0.98, z: 0.46, color: PAL.navy });
    for (let i = 0; i < 3; i++) c.solid.box(0.07, 0.07, 0.012, { x: -0.11 + i * 0.11, y: 1.005, z: 0.505, color: ['#2f6f58', '#7a6a2a', '#7a2f3a'][i] });
    glowPoint(c, 0, 1.04, 0.54, SIGNAL_CYCLE.colors[0], 0.4, 0.04, { cycle: SIGNAL_CYCLE });
  },
  vendingMachine(c) {
    const k = v(c, 'vendingMachine');
    c.solid.box(0.4, 0.66, 0.3, { color: ['#e8473f', '#3d6ab0', '#f2f0ea'][k] });
    c.solid.box(0.42, 0.04, 0.32, { y: 0.66, color: PAL.steelDark });
    c.glow.box(0.3, 0.3, 0.01, { y: 0.28, z: 0.152, color: '#eaf6ff' });
    c.solid.box(0.3, 0.06, 0.02, { y: 0.06, z: 0.15, color: '#2c3446' });
    glowPoint(c, 0, 0.42, 0.22, '#e6f4ff', 0.45, 0.05);
  },
  busStop(c) {
    const k = v(c, 'busStop');
    if (k === 0) {
      // shelter: an opaque tinted back panel on one post, a roof, a bench, a lit ad panel
      c.solid.box(0.94, 0.62, 0.02, { y: 0.02, z: -0.2, color: '#bcd6e2' });
      c.solid.box(0.03, 0.64, 0.03, { x: 0.46, z: -0.19, color: PAL.steel });
      c.solid.box(1.06, 0.04, 0.5, { y: 0.64, z: -0.02, color: PAL.greenDeep });
      c.glow.box(0.28, 0.34, 0.01, { x: 0.26, y: 0.14, z: -0.187, color: '#ffe8d8' });
      glowPoint(c, 0.26, 0.32, -0.12, '#ffe8d8', 0.4, 0.05);
    }
    c.solid.box(0.56, 0.04, 0.16, { y: 0.2, z: -0.1, color: PAL.wood });
    // the stop sign: a post with a plate
    c.solid.box(0.03, 0.86, 0.03, { x: 0.6, z: 0.12, color: PAL.steel });
    c.solid.box(0.18, 0.18, 0.02, { x: 0.6, y: 0.78, z: 0.12, color: '#f7f4ee' });
    c.glow.box(0.12, 0.05, 0.012, { x: 0.6, y: 0.88, z: 0.135, color: '#7fb8dc' });
  },
  billboard(c) {
    const k = v(c, 'billboard');
    c.solid.box(0.06, 0.62, 0.06, { color: PAL.steelDark });
    c.solid.box(0.92, 0.5, 0.06, { y: 0.6, color: '#e9e6df' });
    c.glow.box(0.84, 0.42, 0.01, { y: 0.64, z: 0.032, color: ['#ffd6e2', '#d6f0ff', '#fff0c8'][k] });
    c.solid.box(0.4, 0.1, 0.012, { x: -0.12, y: 0.74, z: 0.04, color: ['#d9604a', '#3d6a9a', '#4f9a62'][k] });
  },
  parkedCar(c) {
    const k = v(c, 'parkedCar');
    const paint = ['#e8eef2', '#7fb8dc', '#f2f0ea', '#e3b04a'][k];
    const glass = '#5f7f96';
    if (k === 0) {
      // compact
      c.solid.box(0.4, 0.16, 0.7, { y: 0.06, color: paint });
      c.solid.box(0.36, 0.13, 0.38, { y: 0.22, z: -0.04, color: glass });
      c.solid.box(0.38, 0.03, 0.4, { y: 0.35, z: -0.04, color: paint });
    } else if (k === 1) {
      // van
      c.solid.box(0.42, 0.42, 0.82, { y: 0.06, color: paint });
      c.solid.box(0.43, 0.12, 0.22, { y: 0.3, z: 0.3, color: glass });
      c.solid.box(0.425, 0.04, 0.82, { y: 0.14, color: '#3d6a9a' });
    } else if (k === 2) {
      // mini truck with a small load
      c.solid.box(0.4, 0.34, 0.26, { y: 0.06, z: 0.28, color: paint });
      c.solid.box(0.41, 0.12, 0.2, { y: 0.24, z: 0.3, color: glass });
      c.solid.box(0.42, 0.06, 0.56, { y: 0.12, z: -0.14, color: PAL.steel });
      c.solid.box(0.3, 0.12, 0.24, { y: 0.18, z: -0.18, color: PAL.wood });
    } else {
      // delivery cart (a three-wheeler with a box)
      c.solid.box(0.3, 0.3, 0.36, { y: 0.08, z: -0.1, color: paint });
      c.solid.box(0.18, 0.16, 0.24, { y: 0.08, z: 0.24, color: PAL.navy });
      c.solid.box(0.3, 0.06, 0.02, { y: 0.26, z: 0.09, color: PAL.red });
    }
    const wheels = k === 3 ? [[-0.15, -0.18], [0.15, -0.18], [0, 0.26]] : [[-0.2, 0.24], [0.2, 0.24], [-0.2, -0.24], [0.2, -0.24]];
    for (const [x, z] of wheels) c.solid.box(0.06, 0.12, 0.12, { x, z, color: '#2a2d34' });
    c.glow.box(0.26, 0.03, 0.01, { y: 0.16, z: k === 1 ? 0.415 : k === 2 ? 0.415 : k === 3 ? 0.365 : 0.355, color: '#fff6d6' });
  },
  roadCone(c) {
    c.solid.box(0.16, 0.02, 0.16, { color: '#e8823a' });
    c.solid.cone(0.07, 0.26, 4, { y: 0.02, ry: Math.PI / 4, color: '#e8823a' });
  },
  barricade(c) {
    for (const x of [-0.34, 0.34]) c.solid.box(0.04, 0.34, 0.24, { x, color: PAL.steel });
    c.solid.box(0.76, 0.1, 0.03, { y: 0.22, color: '#f7f4ee' });
    c.solid.box(0.76, 0.04, 0.035, { y: 0.25, color: '#e8823a' });
  },
  bollard(c) {
    for (const x of [-0.25, 0.25]) c.solid.box(0.08, 0.26, 0.08, { x, color: PAL.steelDark });
  },
  hydrant(c) {
    c.solid.cyl(0.06, 0.07, 0.26, 6, { color: '#d9483e' });
    c.solid.cyl(0.05, 0.065, 0.06, 6, { y: 0.26, color: '#c23e36' });
    c.solid.box(0.22, 0.05, 0.05, { y: 0.15, color: '#c23e36' });
  },
  mailbox(c) {
    c.solid.box(0.06, 0.32, 0.06, { color: '#c23e36' });
    c.solid.cyl(0.11, 0.11, 0.3, 6, { y: 0.32, color: '#d9483e' });
    c.solid.box(0.14, 0.02, 0.04, { y: 0.52, z: 0.1, color: '#2c3446' });
  },
  trashBin(c) {
    c.solid.cyl(0.1, 0.09, 0.3, 6, { color: '#4f8a6a' });
    c.solid.cyl(0.11, 0.11, 0.03, 6, { y: 0.3, color: '#3d6f55' });
  },
  bikeRack(c) {
    c.solid.box(0.9, 0.06, 0.04, { y: 0.02, color: PAL.steel });
    for (let i = 0; i < 2; i++) {
      const x = -0.2 + i * 0.4;
      c.solid.box(0.025, 0.12, 0.32, { x, y: 0.04, color: ['#3d6a9a', '#d9604a'][i] });
      c.solid.box(0.12, 0.025, 0.025, { x, y: 0.18, z: 0.12, color: PAL.navy });
    }
  },
  streetTree(c) {
    // a street tree in a square tree grate: cherry (variant 0) or green
    const cherry = v(c, 'streetTree') === 0;
    c.solid.box(0.36, 0.02, 0.36, { color: '#8c8478' });
    c.solid.cyl(0.035, 0.05, 0.52, 5, { y: 0.02, color: '#7d5240' });
    const cols = cherry ? ['#ffc4d9', '#ffadc9', '#ff9ac0', '#ffd8e6'] : ['#6cb85a', '#5aa64f', '#7cc466', '#4f9a4a'];
    leaf(c, 0.26, { y: 0.66, sy: 0.85, color: cols[0] });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      leaf(c, 0.17, { x: Math.cos(a) * 0.17, y: 0.6 + (i % 2) * 0.08, z: Math.sin(a) * 0.17, color: cols[i + 1] });
    }
  },
  powerPole(c) {
    // concrete utility pole: a cross-arm (the city kit strings the wires), a transformer and a
    // small lamp arm over the road (+z)
    c.solid.cyl(0.032, 0.045, 1.52, 6, { color: '#cbc4b8' });
    c.solid.box(0.5, 0.04, 0.05, { y: 1.42, color: '#8f887c' });
    c.solid.box(0.12, 0.18, 0.12, { x: 0.08, y: 1.0, z: -0.06, color: '#9aa29a' });
    c.solid.box(0.06, 0.03, 0.34, { y: 0.95, z: 0.16, color: PAL.steelDark });
    c.glow.box(0.05, 0.01, 0.1, { y: 0.944, z: 0.28, color: '#fff2d6' });
    glowPoint(c, 0, 0.92, 0.28, '#ffe9c4', 0.42, 0.05);
  },
  planterBox(c) {
    const k = v(c, 'planterBox');
    c.solid.box(0.92, 0.18, 0.32, { color: k ? PAL.terracotta : '#d9d3c8' });
    c.solid.box(0.84, 0.14, 0.24, { y: 0.16, color: k ? '#5f9e52' : '#6caa5a', jitter: 0.06, rand: c.rand });
    if (k) c.solid.box(0.7, 0.04, 0.18, { y: 0.3, color: '#ff9ec4' });
  },
  guardRail(c) {
    for (const x of [-0.4, 0.1]) c.solid.box(0.04, 0.28, 0.04, { x, color: PAL.steel });
    c.solid.box(1.0, 0.08, 0.025, { y: 0.18, z: 0.025, color: '#e9ecef' });
  },
  laundryLine(c) {
    // a post and a line (tied to a wall behind) with washing that sways in the wind
    const k = v(c, 'laundryLine');
    c.solid.box(0.03, 0.56, 0.03, { x: 0.42, color: PAL.steel });
    c.solid.box(0.84, 0.01, 0.01, { y: 0.54, color: '#e9e6df' });
    const cloth = [['#ffffff', '#ffd6e2', '#cfe6ff'], ['#fff2b8', '#ffffff', '#d6f0d6'], ['#cfe6ff', '#ffe6cc', '#ffffff']][k];
    for (let i = 0; i < 3; i++) {
      c.foliage.panel(0.16, 0.16 + (i % 2) * 0.05, { x: -0.24 + i * 0.24, y: 0.38 - (i % 2) * 0.05, color: cloth[i], attrs: { sway: () => 0.8 } });
    }
  },
  catOnWall(c) {
    // a cat napping (placed on top of a wall or a roof edge by the kit); the tail sways
    const fur = v(c, 'catOnWall') ? '#3a3a40' : '#e0a060';
    c.solid.add(new THREE.OctahedronGeometry(0.06, 0), { x: 0.05, y: 0.04, sx: 1.6, sy: 0.7, color: fur });
    c.solid.add(new THREE.OctahedronGeometry(0.045, 0), { x: -0.06, y: 0.07, color: fur });
    for (const z of [-0.022, 0.022]) c.solid.add(new THREE.TetrahedronGeometry(0.022, 0), { x: -0.065, y: 0.115, z, color: fur });
    c.foliage.add(new THREE.TetrahedronGeometry(0.03, 0), { x: 0.16, y: 0.03, z: 0.04, sx: 2.4, sy: 0.5, sz: 0.5, ry: 0.5, color: fur, attrs: { sway: () => 0.6 } });
  },
  pigeonGroup(c) {
    // three pigeons pecking at the paving
    const k = v(c, 'pigeonGroup');
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + k * 1.3;
      const x = Math.cos(a) * 0.2;
      const z = Math.sin(a) * 0.16;
      c.solid.add(new THREE.OctahedronGeometry(0.04, 0), { x, y: 0.035, z, ry: a, sz: 1.5, color: i % 2 ? '#8a8f9a' : '#a3a8b2' });
      c.solid.add(new THREE.TetrahedronGeometry(0.025, 0), { x: x + Math.sin(a) * 0.05, y: 0.07, z: z + Math.cos(a) * 0.05, color: '#6f7480' });
    }
  },
  missingPoster(c) {
    // "MISSING": a poster on a post (pigeon, slime, parking-sticker, lantern-girl sticker covers)
    const pic = ['#8a8f9a', '#7cc96a', '#e3b04a', '#ffc46b'][v(c, 'missingPoster')];
    c.solid.box(0.04, 0.42, 0.04, { color: PAL.steel });
    c.solid.add(new THREE.PlaneGeometry(0.3, 0.36), { y: 0.5, z: 0.025, color: '#f7f4ee', color2: pic });
  },
  manhole(c) {
    c.solid.add(new THREE.CircleGeometry(0.13, 8), { y: 0.006, rx: -Math.PI / 2, color: '#8f8a84' });
    c.solid.add(new THREE.CircleGeometry(0.09, 8), { y: 0.009, rx: -Math.PI / 2, color: '#7d7872' });
  },
  bunSteamer(c) {
    // a street steamer: a cart with a stack of steamer baskets and a little steam
    c.solid.box(0.34, 0.26, 0.22, { x: -0.2, z: 0.3, color: '#c9b08a' });
    c.solid.cyl(0.1, 0.1, 0.07, 6, { x: -0.2, y: 0.26, z: 0.3, color: '#d9c49a' });
    c.solid.cyl(0.1, 0.1, 0.07, 6, { x: -0.2, y: 0.34, z: 0.3, color: '#cfb68a' });
    c.emitters.push({ kind: 'steam', x: -0.2, y: 0.45, z: 0.3 });
  },

  // ----- Act 1 set pieces ------------------------------------------------------------
  stationHall(c) {
    // the station front: a long, low hall with a deep canopy, a clock and the station sign;
    // ≈ 2.6 wide, so it is placed on a run of H tiles (or over a subway: trackMesh.js)
    const F = c.facade;
    F.box(0, 0, -0.1, 2.6, 0.62, 1.0, { color: PAL.cream, side: FK.gym, v0: -0.1 });
    F.box(0, 0.62, -0.1, 2.7, 0.06, 1.1, { color: PAL.white });
    F.box(0, 0.68, -0.1, 2.4, 0.18, 0.8, { color: PAL.tan, side: FK.office });
    F.box(0, 0.4, 0.5, 2.2, 0.04, 0.4, { color: PAL.greenDeep });
    for (const x of [-1.0, 0, 1.0]) F.box(x, 0, 0.66, 0.05, 0.4, 0.05, { color: PAL.steel });
    c.glow.box(1.0, 0.12, 0.02, { y: 0.74, z: 0.31, color: '#f2f8ff' });
    // a round clock over the sign
    prim(F, new THREE.CylinderGeometry(0.11, 0.11, 0.03, 12), { y: 0.98, z: 0.22, rx: Math.PI / 2 }, PAL.white);
    c.solid.box(0.015, 0.07, 0.01, { y: 0.98, z: 0.24, color: PAL.navy });
    c.solid.box(0.05, 0.015, 0.01, { x: 0.02, y: 0.98, z: 0.24, color: PAL.navy });
    F.box(0, 0.86, -0.1, 0.4, 0.2, 0.3, { color: PAL.cream });
    glowPoint(c, 0, 0.74, 0.4, '#f2f8ff', 0.7, 0.04);
  },
  ticketGates(c) {
    // a row of waist-high ticket gates with green "go" lights
    for (let i = 0; i < 4; i++) {
      const x = -0.36 + i * 0.24;
      c.solid.box(0.07, 0.26, 0.4, { x, color: '#d9dde2' });
      c.solid.box(0.075, 0.02, 0.4, { x, y: 0.26, color: PAL.steelDark });
      c.glow.box(0.04, 0.02, 0.05, { x, y: 0.27, z: 0.14, color: '#5fe0a8' });
    }
    glowPoint(c, 0, 0.3, 0.1, '#bff5dc', 0.5, 0.05);
  },
  clockTower(c) {
    // the station clock tower (skirt set piece): a slim tower with four clock faces
    const F = c.facade;
    F.box(0, 0, 0, 0.62, 0.08, 0.62, { color: PAL.parapet });
    F.box(0, 0.08, 0, 0.44, 1.3, 0.44, { color: PAL.brick, side: FK.brick, v0: -0.08 });
    F.box(0, 1.38, 0, 0.52, 0.04, 0.52, { color: PAL.white });
    F.box(0, 1.42, 0, 0.46, 0.36, 0.46, { color: PAL.cream });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      prim(F, new THREE.CylinderGeometry(0.15, 0.15, 0.02, 12), { x: Math.sin(a) * 0.235, y: 1.6, z: Math.cos(a) * 0.235, rx: Math.PI / 2, ry: a }, PAL.white);
      c.solid.box(0.015, 0.1, 0.01, { x: Math.sin(a) * 0.25, y: 1.6, z: Math.cos(a) * 0.25, ry: a, color: PAL.navy });
    }
    prim(F, new THREE.ConeGeometry(0.4, 0.4, 4), { y: 1.98, ry: Math.PI / 4 }, PAL.tileGrey);
    c.glow.sphere(0.035, 6, 4, { y: 2.2, color: '#ffd8a0' });
  },
  levelCrossing(c) {
    // a crossing post (striped, crossbuck, twin red lamps) and its barrier arm: variant 0 up,
    // variant 1 down across the road (+x); variant 2 is the post alone, its lamp light and arm left
    // to the city kit, which lowers and raises the arm with the lane schedule (cityKit setLanes).
    const k = v(c, 'levelCrossing');
    const down = k === 1;
    c.solid.box(0.12, 0.08, 0.12, { color: '#6f6f6f' });
    for (let i = 0; i < 4; i++) c.solid.box(0.05, 0.22, 0.05, { y: 0.08 + i * 0.22, color: i % 2 ? '#2b2b2b' : '#ffd84d' });
    c.solid.box(0.36, 0.04, 0.02, { y: 1.02, rz: 0.6, z: 0.03, color: '#f7f4ee' });
    c.solid.box(0.36, 0.04, 0.02, { y: 1.02, rz: -0.6, z: 0.03, color: '#f7f4ee' });
    c.solid.box(0.3, 0.1, 0.04, { y: 0.8, z: 0.03, color: '#2b2b2b' });
    for (const x of [-0.09, 0.09]) c.glow.box(0.06, 0.06, 0.012, { x, y: 0.85, z: 0.055, color: '#ff4d5e' });
    c.solid.box(0.1, 0.1, 0.1, { x: 0.08, y: 0.4, color: '#4a4a4a' });
    if (k === 2) return;
    glowPoint(c, 0, 0.85, 0.08, '#ff4d5e', 0.45, down ? 0.5 : 0.08);
    const A = CROSSING_ARM;
    const arm = (i) => (down
      ? { x: A.hubX + A.seg / 2 + 0.02 + i * A.seg, y: A.hubY, color: i % 2 ? '#e84a4a' : '#f7f4ee' }
      : { x: A.hubX, y: A.hubY + 0.06 + i * A.seg, color: i % 2 ? '#e84a4a' : '#f7f4ee' });
    for (let i = 0; i < A.segs; i++) {
      const a = arm(i);
      c.solid.box(down ? A.seg : A.w, down ? A.w : A.seg, A.w, { ...a });
    }
  },
  waterBus(c) {
    // a little canal water-bus: a white hull, a cabin with opaque tinted windows, a red stripe
    const F = c.facade;
    F.box(0, -0.04, 0, 0.42, 0.14, 1.2, { color: PAL.white });
    F.box(0, 0.06, 0, 0.425, 0.03, 1.21, { color: PAL.red, noTop: true });
    prim(F, new THREE.ConeGeometry(0.21, 0.3, 4), { y: 0.03, z: 0.74, rx: Math.PI / 2, ry: Math.PI / 4, sx: 1, sz: 0.5 }, PAL.white);
    F.box(0, 0.1, -0.1, 0.36, 0.2, 0.7, { color: '#f2f0ea', side: FK.glass, v0: -0.2 });
    F.box(0, 0.3, -0.1, 0.4, 0.03, 0.76, { color: '#3d6a9a' });
  },
  lockGate(c) {
    // canal lock gates: two timber leaves meeting in a shallow V, a walkway rail and a winch post;
    // a rim of frost along the top
    for (const s of [-1, 1]) {
      c.solid.box(0.5, 0.36, 0.08, { x: s * 0.25, y: -0.14, z: s * 0.03, ry: s * 0.14, color: '#7a5a40' });
      c.solid.box(0.5, 0.03, 0.1, { x: s * 0.25, y: 0.22, z: s * 0.03, ry: s * 0.14, color: '#eaf6ff' });
      c.solid.box(0.04, 0.22, 0.04, { x: s * 0.46, y: 0.22, color: PAL.steel });
    }
    c.solid.box(0.96, 0.02, 0.02, { y: 0.42, color: PAL.steel });
    c.solid.cyl(0.05, 0.05, 0.26, 6, { x: 0.56, color: PAL.steelDark });
    c.solid.box(0.18, 0.02, 0.02, { x: 0.56, y: 0.27, color: PAL.mustard });
  },
  arcadeRibs(c) {
    // the covered arcade's glass ribs: arched frames only (never a roof over the road)
    for (const z of [-0.3, 0.3]) {
      c.solid.torus(0.62, 0.025, 4, 12, { y: 0.5, z, arc: Math.PI, color: PAL.steel });
      for (const x of [-0.62, 0.62]) c.solid.box(0.04, 0.5, 0.04, { x, z, color: PAL.steel });
    }
    c.solid.box(0.02, 0.02, 0.62, { y: 1.12, color: PAL.steel });
    c.glow.box(0.3, 0.04, 0.01, { y: 0.98, z: 0.32, color: '#ffe6c4' });
  },
  roofBlock(c) {
    // a lone flat-roofed block ROOF_Y tall with a parapet and AC units, as a set piece (decor). The
    // rooftops girls stand on ('U' tiles) are built per connected region by the city kit (buildRoofs).
    const k = v(c, 'roofBlock');
    const F = c.facade;
    const H = ROOF_Y;
    F.box(0, 0, 0, 0.98, H, 0.98, { color: k ? PAL.plaster : PAL.tan, side: k ? FK.flats : FK.shop, top: '#c9c2b6', topKind: 0 });
    parapet(F, 0.98, 0.98, H, PAL.parapet, 0.035, 0.045);
    F.box(0.32, H, -0.32, 0.16, 0.1, 0.12, { color: '#e9e6df' });
    if (k) prim(F, new THREE.CylinderGeometry(0.07, 0.07, 0.14, 6), { x: -0.3, y: H + 0.07, z: -0.3 }, '#cfd6dc');
    else c.glow.box(0.22, 0.012, 0.16, { x: -0.2, y: H + 0.01, z: 0.2, color: '#d6f0ff' });
  },

  dryFountain(c) {
    // 1-10's plaza fountain, dry for a thousand years: an oval stone rim over the blocked basin
    // tiles (decor r covers them, terrain.js), a cracked dry floor, frost along the rim, and in the
    // middle the wardstone, dark and cold (no glow: it wakes only in the story after the battle)
    const RX = 2.35;
    const RZ = 1.38;
    const N = 16;
    c.solid.cyl(1, 1, 0.03, 16, { y: 0.015, sx: RX - 0.05, sz: RZ - 0.05, color: '#a69d8d' });
    for (let i = 0; i < N; i++) {
      const a = ((i + 0.5) / N) * Math.PI * 2;
      const x = Math.cos(a) * RX;
      const z = Math.sin(a) * RZ;
      // tangent of the ellipse at a → the slab's yaw; its length covers the arc to the next slab
      const tx = -Math.sin(a) * RX;
      const tz = Math.cos(a) * RZ;
      const len = (Math.hypot(tx, tz) * Math.PI * 2) / N + 0.04;
      const ry = -Math.atan2(tz, tx);
      c.solid.box(len, 0.2, 0.2, { x, z, ry, color: i % 2 ? '#d6cfc2' : '#cbc3b5' });
      if (i % 3 === 0) c.solid.box(len * 0.8, 0.03, 0.16, { x, y: 0.2, z, ry, color: '#eaf6ff' });
    }
    for (const [x, z, ry, l] of [[-1.2, 0.3, 0.5, 0.7], [0.9, -0.5, -0.4, 0.6], [1.3, 0.6, 1.1, 0.5], [-0.5, -0.7, 2.2, 0.5]]) {
      c.solid.box(l, 0.012, 0.03, { x, y: 0.035, z, ry, color: '#7b7366' });
    }
    // the wardstone on its round step: a squat dark eight-sided stone with a slanted cap
    c.solid.cyl(0.5, 0.56, 0.12, 12, { y: 0.06, color: '#bdb4a4' });
    c.solid.cyl(0.24, 0.3, 0.62, 8, { y: 0.43, color: '#34303f' });
    c.solid.cyl(0.02, 0.25, 0.2, 8, { y: 0.84, rz: 0.12, color: '#2a2633' });
    c.solid.box(0.3, 0.02, 0.05, { y: 0.5, z: 0.27, color: '#dfeefa' });
  },

  // ----- gates ------------------------------------------------------------------------
  petalRift(c) {
    // a Petal Gate mouth torn open in the street: a ragged ring of asphalt slabs leaning over the
    // road (variant 0 back over the street behind, 1 forward on the near edge: riftPlacement), so
    // the battle camera sees the disc on any edge, landscape or portrait,
    // violet-pink seams and the portal disc as glow geometry, a bent street sign and a lamp post
    // leaning into it (local +z = the way the monsters walk out of it)
    const R = 0.62;
    const cy = 0.76;
    const col = c.look.gate?.spawn || RIFT.violet;
    // the ring leans about its foot on the road, toward the camera's side (RIFT_LEANS)
    const T = new THREE.Matrix4().makeTranslation(0, 0.06, 0)
      .multiply(new THREE.Matrix4().makeRotationX(-RIFT_LEANS[v(c, 'petalRift')]))
      .multiply(new THREE.Matrix4().makeTranslation(0, -0.06, 0));
    const disc = (r, z, color) => {
      c.glow.add(new THREE.CircleGeometry(r, 18), { y: cy, z, color, matrix: T });
      c.glow.add(new THREE.CircleGeometry(r, 18), { y: cy, z: -z, ry: Math.PI, color, matrix: T });
    };
    disc(R - 0.05, 0.004, col);
    disc(R * 0.64, 0.014, RIFT.pink);
    disc(R * 0.3, 0.024, RIFT.core);
    // the torn ring: chunks of asphalt slab round the disc, ragged by a fixed jitter
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const jr = R + ((i * 37) % 7) * 0.012;
      c.solid.box(0.16, 0.12 + ((i * 13) % 5) * 0.025, 0.12, {
        x: Math.cos(a) * jr, y: cy + Math.sin(a) * jr - 0.06, rz: a + 0.3 * ((i % 3) - 1), color: i % 2 ? '#4a4f5c' : '#5a6070', matrix: T,
      });
    }
    // glowing seams between the chunks
    for (let i = 0; i < 12; i++) {
      const a = ((i + 0.5) / 12) * Math.PI * 2;
      c.glow.box(0.026, 0.14, 0.14, { x: Math.cos(a) * R, y: cy + Math.sin(a) * R - 0.07, rz: a, color: i % 2 ? RIFT.pink : col, matrix: T });
    }
    // frost on the rim (the Night's cold rides through the Merge)
    for (const a of [1.2, 1.9, 2.6]) c.solid.box(0.12, 0.03, 0.15, { x: Math.cos(a) * (R + 0.08), y: cy + Math.sin(a) * (R + 0.08), color: '#eaf6ff', matrix: T });
    // lifted asphalt slabs (with their lane paint) round the foot of the ring
    for (const [x, z, ry, rz] of [[-0.66, 0.12, 0.3, 0.32], [0.7, 0.02, -0.4, -0.28], [-0.32, 0.4, 0.9, 0.12]]) {
      c.solid.box(0.34, 0.05, 0.24, { x, y: 0.02, z, ry, rz, color: '#555a66' });
      c.solid.box(0.3, 0.012, 0.02, { x, y: 0.072, z: z + 0.04, ry, rz, color: '#e8e8e2' });
    }
    // a bent street sign leaning into the ring (left) and a lamp post (right)
    c.solid.box(0.03, 0.62, 0.03, { x: -0.9, rz: -0.32, z: -0.2, color: PAL.steel });
    c.solid.box(0.03, 0.3, 0.2, { x: -0.66, y: 0.58, z: -0.2, rz: -0.9, color: '#3d6a9a' });
    c.solid.cyl(0.022, 0.03, 1.0, 5, { x: 0.9, z: -0.25, rz: 0.34, color: PAL.steelDark });
    c.solid.box(0.1, 0.04, 0.16, { x: 0.58, y: 0.94, z: -0.22, rz: 0.34, color: PAL.steelDark });
    // where the disc's middle ends up after the lean (glows and emitters sit there)
    const mid = new THREE.Vector3(0, cy, 0.05).applyMatrix4(T);
    glowPoint(c, mid.x, mid.y, mid.z, col, 1.9, 0.18);
    glowPoint(c, 0, 0.12, 0.45, RIFT.pink, 1.2, 0.12);
    c.emitters.push({ kind: 'portal', x: 0, y: 0.2, z: 0.3, color: col });
    c.emitters.push({ kind: 'debris', x: mid.x, y: mid.y, z: mid.z, r: R });
    c.emitters.push({ kind: 'riftPetals', x: mid.x, y: mid.y + 0.1, z: mid.z + 0.1 });
    c.emitters.push({ kind: 'frost', x: mid.x, y: mid.y, z: mid.z + 0.1, r: R });
  },
  shelterDoor(c) {
    // the goal: a low shelter block over the end of the road with its steel door rolled up (or a
    // school entrance), the doorway facing the road; the camera mostly sees the roof, so the roof
    // carries the colours and a big glowing heart, and the shipped heart sign hangs over the door
    // (local +z = the way the road leads in, so the doorway faces -z… the road enters from -z)
    const k = v(c, 'shelterDoor');
    const pink = c.look.gate?.goal || '#ff7aa2';
    const F = c.facade;
    // deep enough that the column's last tile of road (every road runs 1 tile past the board) ends
    // inside the block: they go in at the door and are not seen again
    const depth = 0.95;
    const wall = k === 0 ? '#b9b4aa' : PAL.cream;
    const roof = k === 0 ? '#5f9a72' : k === 1 ? '#c98a6e' : '#9fb59a';
    const H = k === 0 ? 0.62 : 0.68;
    // the block sits just beyond the board edge (+z half), the doorway on its -z face
    for (const s of [-1, 1]) F.box(s * 0.62, 0, depth / 2, 0.3, H, depth, { color: wall, side: k === 0 ? FK.shutter : FK.school });
    F.box(0, H - 0.18, depth / 2, 0.94, 0.18, depth, { color: wall });
    // the dark interior seen through the doorway, and the open door (rolled up / swung back)
    F.box(0, 0, depth - 0.04, 0.94, H - 0.18, 0.04, { color: '#2a2e38', noTop: true });
    if (k === 0) F.box(0, H - 0.22, 0.04, 0.92, 0.06, 0.08, { color: '#7f8894', side: FK.shutter });
    else for (const s of [-1, 1]) F.box(s * 0.4, 0, 0.05, 0.3, H - 0.2, 0.03, { ry: s * 1.1, color: '#8fb7cf', side: FK.glass });
    // roof: the colour band, a white rim, the hazard stripe over the door (shelter)
    F.box(0, H, depth / 2, 1.6, 0.05, depth + 0.1, { color: roof });
    F.box(0, H + 0.05, depth / 2, 1.4, 0.012, depth - 0.1, { color: PAL.white });
    if (k === 0) for (let i = 0; i < 6; i++) F.box(-0.62 + i * 0.25, H - 0.08, -0.004, 0.12, 0.06, 0.012, { color: i % 2 ? '#2b2f36' : '#ffcc33', noTop: true });
    // a big heart lying on the roof (what the camera sees from above)
    c.glow.add(heartGeometry(0.2), { y: H + 0.068, z: depth / 2, rx: -Math.PI / 2, color: pink });
    // the shipped heart sign hanging over the doorway
    c.solid.box(0.02, 0.1, 0.02, { y: H - 0.12, z: -0.06, color: '#c9b89a' });
    c.glow.sphere(0.06, 8, 6, { x: -0.052, y: H - 0.2, z: -0.06, color: pink });
    c.glow.sphere(0.06, 8, 6, { x: 0.052, y: H - 0.2, z: -0.06, color: pink });
    c.glow.cone(0.1, 0.12, 4, { y: H - 0.32, z: -0.06, rx: Math.PI, ry: Math.PI / 4, color: pink });
    glowPoint(c, 0, H + 0.1, depth / 2, pink, 0.9, 0.1);
    glowPoint(c, 0, 0.3, 0.2, '#fff2d6', 0.6, 0.05);
    c.emitters.push({ kind: 'goal', x: 0, y: H, z: depth / 2, color: pink });
  },
};

/** A flat heart (in the xy plane, point at -y), `size` tall: the shelter's roof mark. */
function heartGeometry(size) {
  const k = size / 2;
  const sh = new THREE.Shape();
  sh.moveTo(0, -k);
  sh.bezierCurveTo(-k * 0.2, -k * 0.55, -k * 1.1, -k * 0.2, -k * 1.0, k * 0.35);
  sh.bezierCurveTo(-k * 0.95, k * 0.95, -k * 0.15, k * 1.0, 0, k * 0.45);
  sh.bezierCurveTo(k * 0.15, k * 1.0, k * 0.95, k * 0.95, k * 1.0, k * 0.35);
  sh.bezierCurveTo(k * 1.1, -k * 0.2, k * 0.2, -k * 0.55, 0, -k);
  return new THREE.ShapeGeometry(sh, 4);
}

// ---------------------------------------------------------------------------
// moving dressing (instanced by the city kit: one draw call each)
// ---------------------------------------------------------------------------

/** One commuter train car (cream and green, opaque tinted windows), length 1.2, facade geometry. */
export function trainCarGeometry(acc) {
  acc.box(0, 0, 0, 1.2, 0.36, 0.42, { color: '#f3efe2', side: FK.office, v0: 0.12 });
  acc.box(0, 0.05, 0, 1.204, 0.06, 0.424, { color: '#4f9a62', noTop: true });
  acc.box(0, 0.24, 0, 1.204, 0.02, 0.424, { color: '#e3b04a', noTop: true });
  acc.box(0, 0.36, 0, 1.14, 0.04, 0.38, { color: '#c9c4b8' });
  acc.box(0.3, 0.4, 0, 0.3, 0.05, 0.16, { color: '#8f8a80' });
  return acc.build();
}

/** A Brigade patrol drone (navy and amber; dressing only, high overhead), facade geometry. */
export function droneGeometry(acc) {
  acc.box(0, -0.05, 0, 0.2, 0.08, 0.2, { color: '#2e3a56' });
  acc.box(0, 0.03, 0, 0.12, 0.03, 0.12, { color: '#e3a03a' });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    acc.box(sx * 0.11, -0.02, sz * 0.11, 0.2, 0.02, 0.025, { ry: (Math.PI / 4) * sx * sz, color: '#3d4a68' });
    acc.box(sx * 0.18, 0.0, sz * 0.18, 0.13, 0.008, 0.13, { color: '#4a5878' });
  }
  acc.box(0, -0.1, 0.06, 0.05, 0.03, 0.05, { color: '#ffb84a' });
  return acc.build();
}

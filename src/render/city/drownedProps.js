// The Drowned Line (Gate Arc S5a, `MapDef.theme: 'drowned'`; GATE_ARC §18.1, §18.3): Itomachi's old
// Line 2 under the city, flooded, as ordinary prop builders (props.js BUILDERS) on the city kit's
// materials. On the board: station blocks (a platform office, the ticket hall, a shuttered kiosk, a
// stair head up to the street, a vent shaft, the control room; stationBox, all ≤ BOARD_MAX_H) and
// retaining walls on the border; along the lanes the work lamps and the red emergency lamps
// (emergencyLight), railway signals, a maintenance cart; in the skirt the pump halls, the lake mosaic
// and stair-and-canopy entrances; in the water a train half sunk; in the pump station the giant
// pumps, pipe runs and the steam valves (the vent-zone look: a red valve wheel on a pipe stack and a
// steam column that reads at phone size); and the glass shards that came through with the Noon Gate
// (opaque white glass, a cyan edge glow). Nobody is shown.
//
// Every builder keeps to DROWNED_VARIANTS[type] variants (≤ 6, `c.variant % n`) and to a triangle cap
// (tests/render/drowned.test.js); nothing is transparent. A red emergency lamp stays lit and pulses
// through a blackout (its glow sprites carry `keep` and `pulse`, the prop `keepLit`); every other
// lamp dims with the lights. On a frosty board (look.frost: the Noon Gate's cold) the pipes rime over.
//
// Local frame: origin = tile centre on the ground, +y up, +z = the front (the road side).
import { FK } from './cityMaterials.js';
import { EMERGENCY } from '../themes.js';

/** Variants per builder (`c.variant % n`); the kit and the tests read this. */
export const DROWNED_VARIANTS = {
  stationBox: 6, retainingWall: 3, stationStairs: 2, mosaicWall: 2, sunkenTrain: 2, emergencyLight: 3,
  signalLamp: 2, maintenanceCart: 2, pumpHall: 2, pumpUnit: 3, pipeRun: 2, steamValve: 2, glassShards: 3,
};

/** stationBox variant → kind. */
export const STATION_KINDS = ['platformOffice', 'ticketHall', 'kiosk', 'stairHead', 'ventShaft', 'controlRoom'];

/** emergencyLight variant → kind (0 and the low lamp of 2 are the red lamps that stay lit). */
export const EMERGENCY_KINDS = ['redLamp', 'amberBeacon', 'workLamp'];

/** The Drowned Line's palette: wet concrete, white station tiles, Line 2 blue, steel, rust, Vesperline glass. */
export const DR = {
  concrete: '#a9aca6',
  concreteDark: '#7f8480',
  concreteShade: '#61676a',
  tile: '#d6dad4',
  tileCream: '#e3dccb',
  tileDark: '#9aa29e',
  line2: '#3f8fbf',
  line2Dark: '#2b6a92',
  steel: '#9aa3ab',
  steelDark: '#555c63',
  rust: '#8a5a3a',
  pipe: '#5f7a72',
  pipeDark: '#475c56',
  yellow: '#e7c64a',
  black: '#1c2126',
  stain: '#4f5a55',
  valve: '#d9473f',
  red: EMERGENCY.red,
  amber: EMERGENCY.amber,
  work: '#e2f2ff',
  rime: '#eef5fa',
  glass: '#e9f4f8',
  glassShade: '#bfe4ee',
  cyan: '#7ff0ff',
  train: '#ece6d6',
};

const v = (c, type) => c.variant % DROWNED_VARIANTS[type];

function glowPoint(c, x, y, z, color, size = 0.5, flicker = 0.08, extra = null) {
  c.glows.push({ x, y, z, color, size, flicker, ...(extra || {}) });
}

/** A red emergency lamp's glow sprite: it stays lit through a blackout and pulses (ambient.js). */
function redLamp(c, x, y, z, size = 0.42) {
  c.glow.sphere(0.03, 6, 4, { x, y, z, color: '#ff8088' });
  glowPoint(c, x, y, z, DR.red, size, 0.05, { keep: true, pulse: 1 });
}

/** Rime on a pipe's top when the board is frosty (the Noon Gate's cold). */
function rime(c, w, y, z = 0, d = 0.06, x = 0) {
  if (c.look.frost) c.solid.box(w, 0.012, d, { x, y, z, color: DR.rime });
}

/** A pipe along local x from x0 to x1 at height y, depth z (radius r). */
function pipe(c, x0, x1, y, z, r = 0.05, color = DR.pipe) {
  // (a cylinder stands on its foot: turned by rz = π/2 it runs from x back to x - length)
  c.solid.cyl(r, r, x1 - x0, 6, { x: x1, y, z, rz: Math.PI / 2, color });
  rime(c, x1 - x0, y + r - 0.004, z, r * 1.2, (x0 + x1) / 2);
}

/** The Line 2 roundel: a blue disc with a white ring on a sign plate facing +z. */
function roundel(c, x, y, z, r = 0.08) {
  c.solid.cyl(r, r, 0.012, 10, { x, y, z, rx: Math.PI / 2, color: DR.line2 });
  c.solid.cyl(r * 0.62, r * 0.62, 0.014, 10, { x, y, z, rx: Math.PI / 2, color: '#f4f6f2' });
  c.solid.cyl(r * 0.36, r * 0.36, 0.016, 8, { x, y, z, rx: Math.PI / 2, color: DR.line2 });
}

export const DROWNED_BUILDERS = {
  // ----- on the board (≤ BOARD_MAX_H; `far` in the skirt: the mass only) ---------------------
  stationBox(c) {
    const kind = STATION_KINDS[v(c, 'stationBox')];
    const far = c.lod === 'far';
    const F = c.facade;
    if (kind === 'platformOffice') {
      // the station staff office on the platform: tiled walls, ribbon windows (lit), the Line 2 band
      F.box(0, 0, -0.06, 0.82, 0.52, 0.62, { color: DR.tile, side: FK.office, top: DR.concreteShade });
      F.box(0, 0.52, -0.06, 0.86, 0.05, 0.66, { color: DR.line2 });
      if (far) return;
      F.box(0, 0.36, 0.255, 0.82, 0.05, 0.012, { color: DR.line2, noTop: true });
      roundel(c, 0.3, 0.44, 0.262);
      c.solid.box(0.18, 0.3, 0.012, { x: -0.22, z: 0.256, color: DR.steelDark });
      glowPoint(c, 0, 0.3, 0.32, '#ffe2b0', 0.4, 0.04);
      return;
    }
    if (kind === 'ticketHall') {
      // the ticket hall: a long low hall, a lit glass front, a canopy with the line's band
      F.box(0, 0, -0.1, 0.92, 0.42, 0.56, { color: DR.tileCream, side: FK.lobby, top: DR.concreteShade });
      F.box(0, 0.42, 0.02, 0.96, 0.04, 0.8, { color: DR.concreteDark });
      if (far) return;
      F.box(0, 0.38, 0.4, 0.96, 0.05, 0.02, { color: DR.line2, noTop: true });
      for (const x of [-0.44, 0.44]) c.solid.box(0.04, 0.42, 0.04, { x, z: 0.38, color: DR.steel });
      for (let i = 0; i < 3; i++) c.solid.box(0.04, 0.16, 0.18, { x: -0.24 + i * 0.24, z: 0.24, color: DR.steelDark });
      glowPoint(c, 0, 0.24, 0.24, '#ffe2b0', 0.45, 0.04);
      return;
    }
    if (kind === 'kiosk') {
      // a shuttered kiosk, its sign still lit
      F.box(0, 0, 0, 0.6, 0.4, 0.5, { color: DR.tileCream, side: FK.shutter, top: DR.concreteShade });
      if (far) return;
      F.box(0, 0.4, 0.05, 0.66, 0.03, 0.62, { color: DR.line2Dark });
      c.solid.box(0.4, 0.1, 0.02, { y: 0.42, z: 0.26, color: '#2b2f36' });
      c.glow.box(0.32, 0.05, 0.01, { y: 0.445, z: 0.272, color: '#fff2cf' });
      glowPoint(c, 0, 0.47, 0.3, '#fff2cf', 0.35, 0.05);
      return;
    }
    if (kind === 'stairHead') {
      // the stairs up to the street: a concrete well with steps climbing away from the road, a
      // handrail, the roundel on a post
      F.box(-0.36, 0, -0.05, 0.08, 0.5, 0.86, { color: DR.concrete });
      F.box(0.36, 0, -0.05, 0.08, 0.5, 0.86, { color: DR.concrete });
      for (let i = 0; i < 6; i++) c.solid.box(0.64, 0.08 + i * 0.07, 0.14, { z: 0.3 - i * 0.13, color: i % 2 ? DR.concreteDark : DR.concrete });
      if (far) return;
      for (const x of [-0.28, 0.28]) c.solid.box(0.02, 0.02, 0.86, { x, y: 0.5, z: -0.05, rx: 0.48, color: DR.steel });
      c.solid.box(0.03, 0.62, 0.03, { x: 0.36, z: 0.42, color: DR.steelDark });
      roundel(c, 0.36, 0.64, 0.44, 0.07);
      return;
    }
    if (kind === 'ventShaft') {
      // a vent shaft: a louvred concrete stack, water dripping from its grille
      F.box(0, 0, 0, 0.56, 0.7, 0.56, { color: DR.concreteDark, top: DR.concreteShade });
      if (far) return;
      for (let i = 0; i < 4; i++) c.solid.box(0.46, 0.03, 0.04, { y: 0.24 + i * 0.1, z: 0.29, rx: -0.4, color: DR.steelDark });
      c.solid.box(0.6, 0.04, 0.6, { y: 0.7, color: DR.steel });
      c.solid.box(0.5, 0.012, 0.012, { y: 0.16, z: 0.285, color: DR.stain });
      c.emitters.push({ kind: 'drip', x: 0.1, y: 0.22, z: 0.36 });
      return;
    }
    // controlRoom: the line's control room, its big window lit, a red lamp over the door
    F.box(0, 0, -0.05, 0.84, 0.56, 0.6, { color: DR.concrete, side: FK.office, top: DR.concreteShade });
    F.box(0, 0.56, -0.05, 0.88, 0.04, 0.64, { color: DR.steelDark });
    if (far) return;
    c.solid.box(0.5, 0.2, 0.012, { x: -0.1, y: 0.26, z: 0.256, color: '#24303a' });
    c.glow.box(0.46, 0.16, 0.01, { x: -0.1, y: 0.28, z: 0.264, color: '#bfe6ff' });
    glowPoint(c, -0.1, 0.36, 0.32, '#cfeaff', 0.5, 0.03);
    redLamp(c, 0.3, 0.5, 0.27, 0.32);
  },

  retainingWall(c) {
    // border H tiles: the retaining wall, the street along its top (0: a concrete wall with a railing
    // on top, 1: a tiled wall with the line's band, 2: a wall with a drain outlet and its stain)
    const k = v(c, 'retainingWall');
    c.solid.box(1.0, 0.56, 0.34, { color: k === 1 ? DR.tile : DR.concreteDark });
    c.solid.box(1.02, 0.05, 0.38, { y: 0.56, color: DR.concrete });
    if (k === 0) {
      for (const x of [-0.45, 0, 0.45]) c.solid.box(0.025, 0.16, 0.025, { x, y: 0.61, z: 0.12, color: DR.steelDark });
      c.solid.box(1.0, 0.022, 0.025, { y: 0.76, z: 0.12, color: DR.steel });
    } else if (k === 1) {
      c.solid.box(1.0, 0.05, 0.02, { y: 0.34, z: 0.17, color: DR.line2 });
      c.solid.box(1.0, 0.012, 0.02, { y: 0.14, z: 0.17, color: DR.tileDark });
    } else {
      c.solid.cyl(0.06, 0.06, 0.08, 8, { y: 0.2, z: 0.2, rx: Math.PI / 2, color: DR.steelDark });
      c.solid.cyl(0.04, 0.04, 0.082, 8, { y: 0.2, z: 0.2, rx: Math.PI / 2, color: DR.black });
      c.solid.box(0.1, 0.2, 0.01, { z: 0.172, color: DR.stain });
    }
  },

  // ----- dressing ----------------------------------------------------------------------
  stationStairs(c) {
    // a stair-and-canopy entrance (the line's stairs down from the street): a glass canopy on steel
    // posts with the roundel, the steps going down under it (1: no canopy, a gate across, chained)
    const k = v(c, 'stationStairs');
    for (const x of [-0.38, 0.38]) c.solid.box(0.06, 0.24, 0.9, { x, color: DR.concrete });
    for (let i = 0; i < 5; i++) c.solid.box(0.7, 0.02, 0.16, { y: 0.2 - i * 0.045, z: 0.32 - i * 0.16, color: i % 2 ? DR.concreteDark : DR.concrete });
    if (k === 0) {
      for (const [x, z] of [[-0.4, 0.42], [0.4, 0.42], [-0.4, -0.4], [0.4, -0.4]]) c.solid.box(0.03, 0.62, 0.03, { x, z, color: DR.steelDark });
      c.solid.box(0.9, 0.03, 0.92, { y: 0.62, color: '#5f7f8f' });
      c.solid.box(0.92, 0.06, 0.04, { y: 0.6, z: 0.46, color: DR.line2 });
      roundel(c, 0, 0.74, 0.46, 0.08);
      c.solid.box(0.03, 0.1, 0.03, { y: 0.64, z: 0.46, color: DR.steelDark });
      return;
    }
    for (let i = 0; i < 5; i++) c.solid.box(0.024, 0.34, 0.024, { x: -0.3 + i * 0.15, y: 0.2, z: 0.44, color: DR.steelDark });
    c.solid.box(0.7, 0.03, 0.03, { y: 0.52, z: 0.44, color: DR.steelDark });
    c.solid.box(0.4, 0.012, 0.012, { y: 0.36, z: 0.46, rz: 0.4, color: '#8a8f94' });
  },

  mosaicWall(c) {
    // the lake mosaic on the station's back wall (white tiles, the lake in blues, a willow and the
    // sun over the water; 1: half of it fallen, the wall behind showing): facade quads, cheap
    const k = v(c, 'mosaicWall');
    const F = c.facade;
    const W = 1.9;
    const H = 0.9;
    F.box(0, 0, 0, W, H, 0.12, { color: DR.tile, top: DR.concreteShade });
    const z = 0.062;
    const cell = (x, y, w, h, col) => F.quad([x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z], col);
    // the lake: three bands of blue, lighter to the horizon
    cell(-0.85, 0.12, 1.7, 0.12, '#2f6f9e');
    cell(-0.85, 0.24, 1.7, 0.1, '#4f8fbf');
    cell(-0.85, 0.34, 1.7, 0.06, '#8fc4e0');
    // the far hills and the sun
    cell(-0.85, 0.4, 0.7, 0.08, '#6f9f7a');
    cell(0.2, 0.4, 0.65, 0.06, '#7fae86');
    cell(-0.06, 0.56, 0.14, 0.14, '#f2c94c');
    // the willow on the near shore: trunk and the falling crown
    cell(0.5, 0.12, 0.04, 0.3, '#6a4a36');
    cell(0.36, 0.38, 0.3, 0.16, '#5f9a55');
    for (let i = 0; i < 4; i++) cell(0.36 + i * 0.08, 0.2, 0.04, 0.2, i % 2 ? '#4f8a4a' : '#6aaa5f');
    // the border band in the line's blue
    cell(-0.95, 0.78, 1.9, 0.06, DR.line2);
    cell(-0.95, 0.04, 1.9, 0.05, DR.line2);
    if (k === 1) {
      // fallen tiles: the bare concrete behind, a heap of tiles at the foot
      cell(-0.85, 0.1, 0.5, 0.36, DR.concreteShade);
      for (let i = 0; i < 4; i++) c.solid.box(0.12, 0.03, 0.1, { x: -0.7 + i * 0.12, z: 0.14, ry: i, color: i % 2 ? DR.tile : '#4f8fbf' });
    }
    if (c.lod !== 'far') c.emitters.push({ kind: 'drip', x: -0.5, y: 0.85, z: 0.12 });
  },

  sunkenTrain(c) {
    // a Line 2 car half sunk in the flood at the far end, nose down (1: lying on its side), its
    // windows dark; one marker lamp still on
    const k = v(c, 'sunkenTrain');
    const F = c.facade;
    const rz = k === 0 ? 0.0 : 0.5;
    const rx = k === 0 ? -0.16 : 0.0;
    F.box(0, -0.16, 0, 0.44, 0.4, 1.3, { rx, rz, color: DR.train, side: FK.office });
    F.box(0, -0.16 + 0.1, 0, 0.446, 0.05, 1.304, { rx, rz, color: DR.line2, noTop: true });
    F.box(0, -0.16 + 0.4, 0, 0.4, 0.04, 1.24, { rx, rz, color: '#b9b4a8' });
    if (c.lod === 'far') return;
    c.glow.sphere(0.03, 6, 4, { x: k === 0 ? 0.12 : 0.2, y: 0.18, z: 0.62, color: '#ffd9a0' });
    glowPoint(c, k === 0 ? 0.12 : 0.2, 0.18, 0.66, DR.amber, 0.32, 0.1);
  },

  emergencyLight(c) {
    // 0: a red emergency lamp on a short post (it stays lit and pulses in a blackout), 1: an amber
    // beacon on a post (it blinks, and dims with the lights), 2: a work lamp on a tall post (a cool
    // white head over the lane, dims) with a red emergency lamp half way up (stays lit)
    const k = v(c, 'emergencyLight');
    c.solid.box(0.12, 0.04, 0.12, { color: DR.concreteShade });
    if (k === 0) {
      c.keepLit = true;
      c.solid.box(0.04, 0.44, 0.04, { y: 0.04, color: DR.steelDark });
      c.solid.box(0.1, 0.08, 0.07, { y: 0.44, z: 0.02, color: '#3a3f46' });
      redLamp(c, 0, 0.48, 0.07, 0.48);
      return;
    }
    if (k === 1) {
      c.solid.box(0.04, 0.4, 0.04, { y: 0.04, color: DR.steelDark });
      c.glow.cyl(0.035, 0.035, 0.05, 6, { y: 0.44, color: DR.amber });
      glowPoint(c, 0, 0.47, 0, DR.amber, 0.38, 0.6);
      return;
    }
    c.solid.cyl(0.018, 0.026, 1.12, 6, { y: 0.04, color: DR.steelDark });
    c.solid.box(0.016, 0.016, 0.3, { y: 1.14, z: 0.13, color: DR.steelDark });
    c.solid.box(0.12, 0.04, 0.14, { y: 1.12, z: 0.28, color: '#3a3f46' });
    c.glow.box(0.1, 0.01, 0.12, { y: 1.11, z: 0.28, color: DR.work });
    glowPoint(c, 0, 1.08, 0.28, '#cfe6ff', 0.5, 0.03);
    c.solid.box(0.07, 0.06, 0.05, { y: 0.5, z: 0.03, color: '#3a3f46' });
    redLamp(c, 0, 0.53, 0.07, 0.34);
  },

  signalLamp(c) {
    // a Line 2 signal on its post beside the track: a dark head with two lamps (0: red lit,
    // 1: green lit), a hood over each
    const k = v(c, 'signalLamp');
    c.solid.box(0.12, 0.04, 0.12, { color: DR.concreteShade });
    c.solid.box(0.035, 0.62, 0.035, { y: 0.04, color: DR.steelDark });
    c.solid.box(0.12, 0.24, 0.08, { y: 0.56, z: 0.02, color: DR.black });
    const lit = k === 0 ? '#ff5a5a' : '#5fe0a8';
    for (let i = 0; i < 2; i++) {
      const y = 0.62 + i * 0.11;
      const on = (k === 0 && i === 1) || (k === 1 && i === 0);
      c.solid.box(0.07, 0.012, 0.04, { y: y + 0.04, z: 0.07, color: DR.black });
      if (on) c.glow.cyl(0.03, 0.03, 0.012, 8, { y, z: 0.065, rx: Math.PI / 2, color: lit });
      else c.solid.cyl(0.03, 0.03, 0.012, 8, { y, z: 0.065, rx: Math.PI / 2, color: '#3a3f46' });
    }
    glowPoint(c, 0, k === 0 ? 0.73 : 0.62, 0.1, lit, 0.4, 0.04);
  },

  maintenanceCart(c) {
    // the line's maintenance cart: a flatbed on rail wheels, a toolbox, an amber beacon (1: a
    // cable drum on it and a jack at its side)
    const k = v(c, 'maintenanceCart');
    c.solid.box(0.6, 0.06, 0.38, { y: 0.08, color: DR.yellow });
    for (const x of [-0.2, 0.2]) for (const z of [-0.15, 0.15]) c.solid.cyl(0.06, 0.06, 0.04, 8, { x, y: 0.06, z, rx: Math.PI / 2, color: DR.black });
    c.solid.box(0.04, 0.22, 0.32, { x: -0.3, y: 0.14, color: DR.steelDark });
    if (k === 0) {
      c.solid.box(0.24, 0.12, 0.16, { x: 0.1, y: 0.14, color: '#c94a3a' });
      c.solid.box(0.26, 0.012, 0.17, { x: 0.1, y: 0.26, color: '#8a2a22' });
    } else {
      c.solid.cyl(0.13, 0.13, 0.16, 10, { x: 0.08, y: 0.27, z: -0.08, rx: Math.PI / 2, color: '#6a4a36' });
      c.solid.cyl(0.08, 0.08, 0.17, 8, { x: 0.08, y: 0.27, z: -0.085, rx: Math.PI / 2, color: '#2b2f36' });
    }
    c.glow.cyl(0.025, 0.025, 0.04, 6, { x: -0.3, y: 0.38, color: DR.amber });
    glowPoint(c, -0.3, 0.4, 0, DR.amber, 0.3, 0.6);
  },

  // ----- the pump station ----------------------------------------------------------------
  pumpHall(c) {
    // the skirt's pump hall: a tall concrete hall with high windows, a pipe bundle out of its side,
    // a red lamp over the door (1: the control block, its big window lit)
    const k = v(c, 'pumpHall');
    const far = c.lod === 'far';
    const F = c.facade;
    if (k === 0) {
      F.box(0, 0, 0, 1.6, 1.5, 1.2, { color: DR.concreteDark, side: FK.gym, top: DR.concreteShade });
      F.box(0, 1.5, 0, 1.66, 0.08, 1.26, { color: DR.steelDark });
      if (far) return;
      for (let i = 0; i < 3; i++) pipe(c, -1.0, 0.6, 0.3 + i * 0.16, 0.66, 0.06, i % 2 ? DR.pipe : DR.rust);
      redLamp(c, 0.5, 0.82, 0.62, 0.4);
      return;
    }
    F.box(0, 0, 0, 1.4, 1.1, 1.0, { color: DR.concrete, side: FK.office, top: DR.concreteShade });
    if (far) return;
    c.solid.box(0.9, 0.34, 0.012, { y: 0.56, z: 0.506, color: '#24303a' });
    c.glow.box(0.84, 0.28, 0.01, { y: 0.59, z: 0.514, color: '#bfe6ff' });
    glowPoint(c, 0, 0.72, 0.6, '#cfeaff', 0.7, 0.03);
  },

  pumpUnit(c) {
    // a giant pump (0: an upright volute on a plinth with its motor on top, 1: a horizontal pump
    // with its intake and outlet pipes, 2: a cluster of valves on a manifold); frost on top round the gate
    const k = v(c, 'pumpUnit');
    const far = c.lod === 'far';
    c.solid.box(0.8, 0.08, 0.7, { color: DR.concreteShade });
    if (k === 0) {
      c.solid.cyl(0.3, 0.32, 0.4, far ? 8 : 12, { y: 0.08, color: DR.pipe });
      c.solid.cyl(0.2, 0.2, 0.26, far ? 6 : 10, { y: 0.48, color: '#3d5a8a' });
      if (far) return;
      c.solid.cyl(0.33, 0.33, 0.04, 12, { y: 0.24, color: DR.pipeDark });
      pipe(c, 0.3, 0.5, 0.2, 0, 0.09, DR.pipe);
      c.solid.box(0.06, 0.06, 0.06, { x: -0.2, y: 0.74, color: DR.yellow });
      if (c.look.frost) c.solid.cyl(0.2, 0.2, 0.012, 10, { y: 0.74, color: DR.rime });
      return;
    }
    if (k === 1) {
      c.solid.cyl(0.18, 0.18, 0.6, far ? 8 : 12, { x: 0.3, y: 0.28, rz: Math.PI / 2, color: DR.pipe });
      c.solid.box(0.26, 0.28, 0.28, { x: -0.3, y: 0.08, color: '#3d5a8a' });
      if (far) return;
      pipe(c, 0.3, 0.5, 0.28, 0, 0.12, DR.rust);
      c.solid.cyl(0.08, 0.08, 0.4, 8, { x: 0.1, y: 0.42, color: DR.pipeDark });
      rime(c, 0.6, 0.46, 0, 0.2);
      return;
    }
    for (let i = 0; i < 3; i++) {
      c.solid.cyl(0.06, 0.06, 0.4, 8, { x: -0.24 + i * 0.24, y: 0.08, color: DR.pipe });
      c.solid.torus(0.08, 0.016, 4, 10, { x: -0.24 + i * 0.24, y: 0.5, rx: Math.PI / 2, color: DR.valve });
    }
    pipe(c, -0.36, 0.36, 0.42, 0, 0.07, DR.pipeDark);
  },

  pipeRun(c) {
    // a run of pipes along local x on low supports (1: one of them elbows up into the dark)
    const k = v(c, 'pipeRun');
    for (const x of [-0.36, 0.36]) c.solid.box(0.06, 0.2, 0.3, { x, color: DR.steelDark });
    pipe(c, -0.5, 0.5, 0.24, -0.06, 0.07, DR.pipe);
    pipe(c, -0.5, 0.5, 0.24, 0.1, 0.05, DR.rust);
    if (k === 1) {
      c.solid.cyl(0.07, 0.07, 0.5, 6, { x: 0.3, y: 0.24, z: -0.06, color: DR.pipe });
      c.solid.cyl(0.09, 0.09, 0.05, 6, { x: 0.3, y: 0.5, z: -0.06, color: DR.pipeDark });
    }
  },

  steamValve(c) {
    // the vent-zone look on the Drowned Line (forge_vents: the relief valves on the road): a pipe
    // stack with a big red valve wheel, a pressure gauge and a steam column out of its top that reads
    // at phone size (1: two stacks, two wheels)
    const k = v(c, 'steamValve');
    const stacks = k === 0 ? [0] : [-0.2, 0.2];
    c.solid.box(0.56, 0.06, 0.4, { color: DR.concreteShade });
    for (const x of stacks) {
      c.solid.cyl(0.08, 0.09, 0.78, 8, { x, y: 0.06, color: DR.pipe });
      c.solid.cyl(0.11, 0.11, 0.05, 8, { x, y: 0.32, color: DR.pipeDark });
      c.solid.cyl(0.1, 0.1, 0.06, 8, { x, y: 0.82, color: DR.steelDark });
      c.solid.torus(0.14, 0.022, 4, 12, { x, y: 0.5, z: 0.13, color: DR.valve });
      c.solid.box(0.3, 0.02, 0.02, { x, y: 0.5, z: 0.13, color: DR.valve });
      c.solid.box(0.02, 0.3, 0.02, { x, y: 0.36, z: 0.13, color: DR.valve });
      rime(c, 0.18, 0.88, 0, 0.18, x);
      c.emitters.push({ kind: 'steamColumn', x, y: 0.9, z: 0 });
    }
    c.solid.cyl(0.05, 0.05, 0.02, 10, { x: k === 0 ? 0.16 : 0, y: 0.68, z: 0.08, rx: Math.PI / 2, color: '#f4f6f2' });
    c.solid.box(0.006, 0.04, 0.004, { x: k === 0 ? 0.16 : 0, y: 0.66, z: 0.092, rz: 0.6, color: DR.black });
  },

  glassShards(c) {
    // glass that came through with the Noon Gate: opaque white shards with a cyan edge glow (0: a
    // cluster standing out of the water, 1: one big shard leaning, 2: shards lying flat)
    const k = v(c, 'glassShards');
    const shard = (x, y, z, r, h, rx, rz, ry) => {
      c.solid.cone(r, h, 4, { x, y, z, rx, rz, ry, color: DR.glass });
      c.glow.cone(r * 0.35, h * 0.92, 4, { x, y: y + 0.004, z, rx, rz, ry: ry + 0.4, color: DR.cyan });
    };
    if (k === 0) {
      shard(0, -0.05, 0, 0.09, 0.42, 0.1, -0.12, 0.2);
      shard(0.16, -0.05, 0.1, 0.06, 0.28, -0.2, 0.3, 1.1);
      shard(-0.14, -0.05, -0.06, 0.05, 0.22, 0.25, 0.2, 2.0);
    } else if (k === 1) {
      shard(0, 0, 0, 0.12, 0.62, 0.0, 0.5, 0.6);
      shard(0.22, 0, 0.14, 0.04, 0.16, 0.3, -0.4, 1.4);
    } else {
      for (let i = 0; i < 4; i++) shard(-0.24 + i * 0.16, 0.02, (i % 2) * 0.12 - 0.06, 0.05, 0.22, Math.PI / 2 - 0.1, 0, i * 1.3);
    }
    glowPoint(c, 0, 0.2, 0, DR.cyan, 0.36, 0.12);
  },
};

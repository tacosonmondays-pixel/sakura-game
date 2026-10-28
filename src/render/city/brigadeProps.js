// Brigade dressing (Gate Arc S4a; GATE_ARC §18.3 "Brigade", §7.3): the Gate Response Brigade's
// gear as ordinary prop builders (props.js BUILDERS), usable on the Noon highway and on the
// Morning's far north alike. Our own city's responders, signed up for floods and fires: navy and
// amber with a white visor stripe and the gate-ring emblem, never a real army's look (no
// camouflage, no weapons on display). Sandbag pits, a searchlight tower, the Tortoise van parked
// (one of Azami's tickets under the wiper of every one), field tents, a drone dock, a checkpoint
// hut and Azami's citation stand. Dressing only: the Brigade's units on the road are enemy models.
//
// Every builder keeps to BRIGADE_VARIANTS[type] variants (≤ 6, `c.variant % n`) and to a triangle
// cap (tests/render/highway.test.js); nothing is transparent.
//
// Local frame: origin = tile centre on the ground, +y up, +z = the front.
import { FK } from './cityMaterials.js';

/** Variants per builder (`c.variant % n`); the kit and the tests read this. */
export const BRIGADE_VARIANTS = {
  sandbagPit: 2, searchlightTower: 2, tortoiseVan: 3, brigadeTent: 2, droneDock: 1, checkpointHut: 1, citationStand: 1,
};

/** The Brigade palette (GATE_ARC §18.9): navy, amber, the white visor stripe; sandbag tan. */
export const BRIGADE = {
  navy: '#2b3a5c',
  navyDark: '#1f2a44',
  navyLight: '#3d4f78',
  amber: '#f4a62a',
  white: '#eef3f8',
  glass: '#2e3a4c',
  sand: '#c9b48a',
  sandDark: '#a8936a',
  steel: '#8d949c',
  steelDark: '#5f666e',
  tyre: '#24272d',
  ticket: '#fff8e6',
  lamp: '#fff2cf',
};

const v = (c, type) => c.variant % BRIGADE_VARIANTS[type];

function glowPoint(c, x, y, z, color, size = 0.5, flicker = 0.08) {
  c.glows.push({ x, y, z, color, size, flicker });
}

/** The gate-ring emblem: an amber ring with a white dot, on a face at depth z facing +z. */
function emblem(c, x, y, z, r = 0.05) {
  c.solid.torus(r, r * 0.22, 4, 10, { x, y, z, color: BRIGADE.amber });
  c.solid.box(r * 0.6, r * 0.6, 0.006, { x, y: y - r * 0.3, z, color: BRIGADE.white });
}

/** One sandbag (a flattened, slightly bulged block). */
function bag(c, x, y, z, ry, col) {
  c.solid.box(0.15, 0.06, 0.09, { x, y, z, ry, color: col, jitter: 0.04, rand: c.rand });
}

export const BRIGADE_BUILDERS = {
  sandbagPit(c) {
    // a horseshoe of sandbags two courses high, open to the front, the Brigade's pennant (1: a
    // straight sandbag wall, for lining the gate's mouth)
    const k = v(c, 'sandbagPit');
    const far = c.lod === 'far';
    if (k === 1) {
      for (let row = 0; row < (far ? 1 : 2); row++) {
        for (let i = 0; i < 6; i++) bag(c, -0.42 + i * 0.165 + (row % 2) * 0.08, row * 0.06, 0, 0, row % 2 ? BRIGADE.sandDark : BRIGADE.sand);
      }
      return;
    }
    const n = far ? 7 : 10;
    for (let row = 0; row < (far ? 1 : 2); row++) {
      for (let i = 0; i < n; i++) {
        const a = Math.PI * 0.2 + (i / (n - 1)) * Math.PI * 1.6 + (row % 2) * 0.12;
        bag(c, Math.sin(a) * 0.36, row * 0.06, -Math.cos(a) * 0.36, -a, (i + row) % 3 ? BRIGADE.sand : BRIGADE.sandDark);
      }
    }
    if (far) return;
    c.solid.cyl(0.01, 0.012, 0.62, 4, { x: -0.3, z: -0.2, color: BRIGADE.steelDark });
    c.foliage.box(0.18, 0.11, 0.01, { x: -0.21, y: 0.52, z: -0.2, color: BRIGADE.navy, attrs: { sway: (x) => Math.max(0, x + 0.3) * 1.4 } });
    c.foliage.box(0.18, 0.025, 0.012, { x: -0.21, y: 0.5, z: -0.2, color: BRIGADE.amber, attrs: { sway: (x) => Math.max(0, x + 0.3) * 1.4 } });
  },
  searchlightTower(c) {
    // a light scaffold tower: four legs, a platform with a rail, a searchlight drum aimed at the
    // front with its lens lit, an amber beacon (1: a tripod searchlight on the ground)
    const k = v(c, 'searchlightTower');
    if (k === 1) {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        c.solid.box(0.02, 0.42, 0.02, { x: Math.sin(a) * 0.1, z: Math.cos(a) * 0.1, rx: Math.cos(a) * 0.25, rz: -Math.sin(a) * 0.25, color: BRIGADE.steelDark });
      }
      c.solid.cyl(0.08, 0.08, 0.14, 8, { y: 0.44, z: 0.0, rx: Math.PI / 2 - 0.2, color: BRIGADE.navy });
      c.glow.cyl(0.065, 0.065, 0.01, 8, { y: 0.455, z: 0.075, rx: Math.PI / 2 - 0.2, color: BRIGADE.lamp });
      glowPoint(c, 0, 0.46, 0.12, BRIGADE.lamp, 0.55, 0.04);
      return;
    }
    const Y = 1.0;
    for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) c.solid.box(0.03, Y, 0.03, { x, z, color: BRIGADE.steel });
    if (c.lod !== 'far') {
      for (const y of [0.3, 0.65]) {
        c.solid.box(0.4, 0.015, 0.015, { y, z: 0.18, color: BRIGADE.steelDark });
        c.solid.box(0.4, 0.015, 0.015, { y, z: -0.18, color: BRIGADE.steelDark });
        c.solid.box(0.015, 0.015, 0.4, { y, x: 0.18, color: BRIGADE.steelDark });
        c.solid.box(0.015, 0.015, 0.4, { y, x: -0.18, color: BRIGADE.steelDark });
      }
    }
    c.solid.box(0.46, 0.04, 0.46, { y: Y, color: BRIGADE.navy });
    c.solid.box(0.46, 0.012, 0.012, { y: Y + 0.14, z: 0.22, color: BRIGADE.amber });
    c.solid.cyl(0.1, 0.1, 0.16, 8, { y: Y + 0.14, z: 0.02, rx: Math.PI / 2 - 0.25, color: BRIGADE.navyLight });
    c.glow.cyl(0.085, 0.085, 0.01, 8, { y: Y + 0.16, z: 0.1, rx: Math.PI / 2 - 0.25, color: BRIGADE.lamp });
    glowPoint(c, 0, Y + 0.16, 0.16, BRIGADE.lamp, 0.7, 0.04);
    c.glow.sphere(0.025, 5, 4, { x: -0.18, y: Y + 0.08, z: -0.18, color: BRIGADE.amber });
    glowPoint(c, -0.18, Y + 0.08, -0.18, BRIGADE.amber, 0.3, 0.6);
  },
  tortoiseVan(c) {
    // the Brigade's armoured van, parked: a navy body with an amber band and the white visor stripe
    // of its windscreen, a roof light bar, wheels, and Azami's ticket under the wiper; 1 carries a
    // searchlight on the roof; 2 is the bridge-layer truck with its deck sections folded on its back
    const k = v(c, 'tortoiseVan');
    const far = c.lod === 'far';
    const long = k === 2;
    const L = long ? 1.3 : 0.9;
    c.solid.box(0.46, 0.08, L, { y: 0.06, color: BRIGADE.navyDark });
    c.solid.box(0.44, 0.28, long ? 0.36 : L - 0.04, { y: 0.12, z: long ? L / 2 - 0.2 : 0, color: BRIGADE.navy });
    c.solid.box(0.445, 0.04, long ? 0.36 : L - 0.04, { y: 0.22, z: long ? L / 2 - 0.2 : 0, color: BRIGADE.amber });
    // the windscreen: a dark band with the white visor stripe over it
    const fz = L / 2 - 0.01;
    c.solid.box(0.4, 0.1, 0.02, { y: 0.28, z: fz, color: BRIGADE.glass });
    c.solid.box(0.42, 0.02, 0.022, { y: 0.385, z: fz, color: BRIGADE.white });
    // the ticket tucked under the wiper (every one of them)
    c.solid.box(0.07, 0.045, 0.006, { x: 0.1, y: 0.285, z: fz + 0.012, rz: 0.15, color: BRIGADE.ticket });
    if (!long) {
      c.solid.box(0.4, 0.04, L - 0.12, { y: 0.4, color: BRIGADE.navyDark });
      emblem(c, -0.1, 0.18, fz - 0.02 + 0.03, 0.035);
    } else {
      // the folded bridge sections on the flatbed
      for (let i = 0; i < 3; i++) c.solid.box(0.42, 0.05, 0.8, { y: 0.14 + i * 0.055, z: -0.22, color: i % 2 ? '#5c6577' : '#66707f' });
      c.solid.box(0.44, 0.012, 0.82, { y: 0.31, z: -0.22, color: BRIGADE.amber });
    }
    if (far) return;
    for (const z of long ? [L / 2 - 0.2, -0.2, -0.5] : [L / 2 - 0.2, -L / 2 + 0.2]) {
      for (const x of [-0.23, 0.23]) c.solid.box(0.06, 0.13, 0.14, { x, z, color: BRIGADE.tyre });
    }
    // the roof light bar, dark (parked), and the headlamps
    const ry = long ? 0.4 : 0.44;
    c.solid.box(0.26, 0.03, 0.06, { y: ry, z: long ? L / 2 - 0.2 : 0.1, color: '#5a4a2a' });
    for (const x of [-0.15, 0.15]) c.glow.box(0.07, 0.03, 0.01, { x, y: 0.16, z: L / 2 + 0.002, color: BRIGADE.lamp });
    if (k === 1) {
      c.solid.cyl(0.06, 0.06, 0.1, 8, { y: 0.47, z: -0.12, rx: Math.PI / 2 - 0.3, color: BRIGADE.navyLight });
      c.glow.cyl(0.05, 0.05, 0.008, 8, { y: 0.48, z: -0.07, rx: Math.PI / 2 - 0.3, color: BRIGADE.lamp });
      glowPoint(c, 0, 0.48, -0.03, BRIGADE.lamp, 0.45, 0.04);
    }
    if (c.look.frost || c.look.theme === 'snow') c.solid.box(0.38, 0.015, long ? 0.3 : L - 0.18, { y: long ? 0.4 : 0.42, z: long ? L / 2 - 0.2 : 0, color: '#f4f8fc' });
  },
  brigadeTent(c) {
    // a navy field tent: a ridge tent with an amber stripe and the emblem over the door, guy lines
    // (1: the larger command tent with an awning, a lamp lit inside)
    const k = v(c, 'brigadeTent');
    const w = k ? 0.8 : 0.6;
    const d = k ? 0.7 : 0.56;
    const h = k ? 0.46 : 0.36;
    const F = c.facade;
    F.quad([-w / 2, 0, d / 2], [w / 2, 0, d / 2], [w / 2, h, 0], [-w / 2, h, 0], BRIGADE.navy);
    F.quad([w / 2, 0, -d / 2], [-w / 2, 0, -d / 2], [-w / 2, h, 0], [w / 2, h, 0], BRIGADE.navyDark);
    F.tri([-w / 2, 0, -d / 2], [-w / 2, 0, d / 2], [-w / 2, h, 0], BRIGADE.navyLight);
    F.tri([w / 2, 0, d / 2], [w / 2, 0, -d / 2], [w / 2, h, 0], BRIGADE.navyLight);
    F.quad([-w / 2, h * 0.42 + 0.004, d * 0.29 + 0.005], [w / 2, h * 0.42 + 0.004, d * 0.29 + 0.005], [w / 2, h * 0.5 + 0.004, d * 0.25 + 0.005], [-w / 2, h * 0.5 + 0.004, d * 0.25 + 0.005], BRIGADE.amber);
    if (c.lod === 'far') return;
    // the door on the +x gable, the emblem above it
    c.solid.box(0.006, h * 0.5, 0.16, { x: w / 2 + 0.004, color: '#18203a' });
    emblem(c, w / 2 + 0.01, h * 0.66, 0, 0.03);
    for (const [x, z] of [[-w / 2 - 0.12, d / 2 + 0.1], [w / 2 + 0.12, -d / 2 - 0.1], [-w / 2 - 0.12, -d / 2 - 0.1], [w / 2 + 0.12, d / 2 + 0.1]]) {
      c.solid.box(0.006, 0.006, 0.3, { x: x * 0.8, y: h * 0.3, z: z * 0.8, rx: z > 0 ? 0.9 : -0.9, color: '#9aa3ae' });
    }
    if (k) {
      c.solid.box(0.5, 0.02, 0.3, { x: 0, y: h * 0.62, z: d / 2 + 0.12, rx: 0.25, color: BRIGADE.amber });
      for (const x of [-0.24, 0.24]) c.solid.box(0.02, h * 0.62, 0.02, { x, z: d / 2 + 0.24, color: BRIGADE.steel });
      c.glow.box(0.12, 0.08, 0.01, { y: h * 0.2, z: d * 0.38, color: BRIGADE.lamp });
      glowPoint(c, 0, h * 0.24, d / 2 + 0.05, BRIGADE.lamp, 0.4, 0.08);
    }
    if (c.look.theme === 'snow' || c.look.frost) c.solid.box(w * 0.9, 0.01, 0.12, { y: h - 0.03, color: '#f4f8fc' });
  },
  droneDock(c) {
    // a drone landing pad: a low case with the amber ring painted on it, a drone resting, a charge
    // post with its status light
    c.solid.box(0.5, 0.08, 0.5, { color: BRIGADE.navyDark });
    c.solid.torus(0.17, 0.018, 3, 12, { y: 0.085, rx: Math.PI / 2, color: BRIGADE.amber });
    c.solid.box(0.12, 0.05, 0.12, { y: 0.09, color: '#2e3a56' });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      c.solid.box(0.14, 0.012, 0.018, { x: sx * 0.07, y: 0.12, z: sz * 0.07, ry: (Math.PI / 4) * sx * sz, color: '#3d4a68' });
      c.solid.cyl(0.05, 0.05, 0.006, 8, { x: sx * 0.12, y: 0.13, z: sz * 0.12, color: '#4a5878' });
    }
    c.solid.box(0.05, 0.3, 0.05, { x: 0.2, z: -0.2, color: BRIGADE.steelDark });
    c.glow.box(0.03, 0.03, 0.012, { x: 0.2, y: 0.26, z: -0.17, color: '#7fe0a8' });
    glowPoint(c, 0.2, 0.27, -0.16, '#7fe0a8', 0.28, 0.3);
  },
  checkpointHut(c) {
    // a checkpoint hut: a white booth with a navy band and windows all round, a lamp over the door,
    // the Brigade's pennant on the roof
    const F = c.facade;
    F.box(0, 0, 0, 0.42, 0.42, 0.42, { color: BRIGADE.white, side: FK.plain, top: BRIGADE.navyDark });
    F.box(0, 0.22, 0, 0.425, 0.12, 0.425, { color: BRIGADE.glass, noTop: true });
    F.box(0, 0.12, 0, 0.428, 0.04, 0.428, { color: BRIGADE.navy, noTop: true });
    F.box(0, 0.42, 0, 0.48, 0.04, 0.48, { color: BRIGADE.navy });
    c.glow.box(0.32, 0.08, 0.008, { y: 0.24, z: 0.215, color: '#fff2cf' });
    glowPoint(c, 0, 0.3, 0.26, BRIGADE.lamp, 0.38, 0.05);
    if (c.lod === 'far') return;
    emblem(c, 0, 0.36, 0.218, 0.03);
    c.solid.cyl(0.008, 0.008, 0.3, 4, { x: 0.18, y: 0.46, z: -0.18, color: BRIGADE.steelDark });
    c.foliage.box(0.14, 0.08, 0.008, { x: 0.25, y: 0.68, z: -0.18, color: BRIGADE.amber, attrs: { sway: (x) => Math.max(0, x - 0.18) * 2 } });
  },
  citationStand(c) {
    // Azami's citation stand: a folding table with a pad of tickets, a stamp and its ink, a mug, and
    // an A-frame sign beside it (a whistle drawn on it)
    c.solid.box(0.5, 0.025, 0.3, { y: 0.3, color: '#e9e6df' });
    for (const [x, z] of [[-0.22, -0.12], [0.22, -0.12], [-0.22, 0.12], [0.22, 0.12]]) c.solid.box(0.02, 0.3, 0.02, { x, z, color: BRIGADE.steelDark });
    c.solid.box(0.12, 0.03, 0.16, { x: -0.1, y: 0.325, color: BRIGADE.ticket });
    c.solid.box(0.12, 0.004, 0.16, { x: -0.1, y: 0.356, color: BRIGADE.amber });
    c.solid.cyl(0.025, 0.025, 0.05, 6, { x: 0.08, y: 0.325, z: 0.04, color: '#d9473f' });
    c.solid.box(0.06, 0.012, 0.06, { x: 0.16, y: 0.325, z: -0.06, color: BRIGADE.navyDark });
    c.solid.cyl(0.025, 0.022, 0.06, 6, { x: 0.18, y: 0.325, z: 0.08, color: BRIGADE.white });
    // the A-frame sign
    c.solid.box(0.24, 0.32, 0.02, { x: 0.42, y: 0.0, z: 0.1, rx: -0.2, color: BRIGADE.navy });
    c.solid.box(0.24, 0.32, 0.02, { x: 0.42, y: 0.0, z: 0.0, rx: 0.2, color: BRIGADE.navy });
    c.solid.box(0.18, 0.06, 0.01, { x: 0.42, y: 0.2, z: 0.13, rx: -0.2, color: BRIGADE.amber });
    c.solid.cyl(0.03, 0.03, 0.05, 6, { x: 0.42, y: 0.1, z: 0.14, rx: Math.PI / 2 - 0.2, color: BRIGADE.white });
  },
};

// The reservoir park (Gate Arc S5a, `MapDef.district: 'park'` on a `city` map; GATE_ARC §18.1, §18.3):
// the park round Itomachi's reservoir as ordinary prop builders (props.js BUILDERS) on the city kit's
// materials. The dam wall on the board's H tiles (its face, a sluice gate, the valve tower, the
// spillway chute; damWall, all ≤ BOARD_MAX_H), the spillway steps with white water down them, the
// bandstand, park lamps along the paths (instead of utility poles and wires), rowing boats chained to
// a post, rescue buoys, and the Brigade's search boats on the water (their searchlight's sweep is a
// ground quad the ambient layer turns: terrain.js `searchBoats`, 0 draw calls), and the great willow
// on its island (greatWillow: the shipped willow's shape at the reservoir's scale, a broad sage crown
// and long weeping strands that sway, a pale stone in its roots; map decor, its `s` honoured).
//
// Every builder keeps to PARK_VARIANTS[type] variants (≤ 6, `c.variant % n`) and to a triangle cap
// (tests/render/park.test.js); nothing is transparent.
//
// Local frame: origin = tile centre on the ground (on the water for the boats), +y up, +z = the front.
import { FK } from './cityMaterials.js';

/** Variants per builder (`c.variant % n`); the kit and the tests read this. */
export const PARK_VARIANTS = {
  damWall: 4, spillwaySteps: 1, bandstand: 1, parkLamp: 1, chainedBoats: 2, rescueBuoy: 2, searchBoat: 1, greatWillow: 1,
};

/** damWall variant → kind. */
export const DAM_KINDS = ['face', 'sluice', 'valveTower', 'chute'];

/** The park's palette: dam concrete, park green ironwork, lamp warmth, boat timber, buoy orange, Brigade navy. */
export const PK = {
  dam: '#b9b6ad',
  damDark: '#8f8c84',
  damShade: '#6f6d67',
  stain: '#7d8278',
  iron: '#2f4a3c',
  ironLight: '#4a6a58',
  lamp: '#ffd98f',
  roof: '#3f7a5a',
  roofTrim: '#e9e3d4',
  wood: '#8a6a4a',
  woodDark: '#6a4f36',
  boat: '#e8e1d4',
  boatBand: '#3d5a8a',
  buoy: '#ff7a2a',
  white: '#f4f2ec',
  foam: '#eef6f8',
  navy: '#2b3a5c',
  amber: '#f4a62a',
  steel: '#9aa3ab',
};

const v = (c, type) => c.variant % PARK_VARIANTS[type];

function glowPoint(c, x, y, z, color, size = 0.5, flicker = 0.06) {
  c.glows.push({ x, y, z, color, size, flicker });
}

/** Weeping strands sway more toward their tips (foliage `sway` attribute). */
const strandSway = (x, y) => Math.max(0.2, Math.min(1, 1.6 - y * 0.8));

export const PARK_BUILDERS = {
  // ----- the dam (board H tiles; `far` in the skirt: the mass only) ---------------------------
  damWall(c) {
    // the reservoir dam: a battered concrete face toward the road (+z), the crest walk on top with
    // a railing, water stains down the face (1: a steel sluice gate in it, 2: the valve tower on the
    // crest, 3: the spillway chute, stepped)
    const kind = DAM_KINDS[v(c, 'damWall')];
    const far = c.lod === 'far';
    const F = c.facade;
    // the face leans back from its foot (+z) to the crest (-z)
    F.quad([-0.5, 0, 0.46], [0.5, 0, 0.46], [0.5, 0.62, 0.08], [-0.5, 0.62, 0.08], kind === 'chute' ? PK.damDark : PK.dam);
    F.box(0, 0, -0.22, 1.0, 0.62, 0.6, { color: PK.damDark, top: PK.dam, faces: [false, true, true, true] });
    F.box(0, 0.62, -0.1, 1.0, 0.03, 0.38, { color: PK.damShade });
    if (far) return;
    for (const x of [-0.45, 0, 0.45]) c.solid.box(0.02, 0.14, 0.02, { x, y: 0.65, z: 0.06, color: PK.iron });
    c.solid.box(1.0, 0.018, 0.022, { y: 0.78, z: 0.06, color: PK.ironLight });
    if (kind === 'face') {
      for (const x of [-0.3, 0.2]) c.solid.box(0.08, 0.4, 0.012, { x, y: 0.12, z: 0.34, rx: -0.55, color: PK.stain });
      return;
    }
    if (kind === 'sluice') {
      c.solid.box(0.4, 0.34, 0.03, { y: 0.08, z: 0.36, rx: -0.55, color: '#5f6870' });
      for (let i = 0; i < 3; i++) c.solid.box(0.42, 0.02, 0.035, { y: 0.12 + i * 0.1, z: 0.37 - i * 0.06, rx: -0.55, color: PK.steel });
      c.solid.box(0.3, 0.06, 0.04, { y: 0.0, z: 0.52, color: PK.foam });
      return;
    }
    if (kind === 'valveTower') {
      F.box(0.1, 0.62, -0.18, 0.36, 0.26, 0.32, { color: PK.dam, side: FK.office, top: PK.roof });
      c.solid.cyl(0.03, 0.03, 0.12, 6, { x: -0.25, y: 0.62, z: -0.1, color: PK.iron });
      c.solid.torus(0.06, 0.012, 3, 8, { x: -0.25, y: 0.76, z: -0.1, rx: Math.PI / 2, color: '#c94a3a' });
      return;
    }
    // chute: steps down the face, white water over them
    for (let i = 0; i < 4; i++) c.solid.box(0.6, 0.06, 0.1, { y: 0.5 - i * 0.15, z: 0.14 + i * 0.09, color: i % 2 ? PK.damShade : PK.damDark });
    for (let i = 0; i < 4; i++) c.solid.box(0.5, 0.012, 0.08, { y: 0.562 - i * 0.15, z: 0.14 + i * 0.09, color: PK.foam });
  },

  spillwaySteps(c) {
    // the spillway steps down the dam (a decor piece beside the road): broad concrete steps with a
    // sheet of white water down them, low walls either side, spray at the foot
    for (const x of [-0.46, 0.46]) c.solid.box(0.08, 0.5, 1.0, { x, color: PK.damDark });
    for (let i = 0; i < 5; i++) {
      c.solid.box(0.84, 0.44 - i * 0.1, 0.2, { z: -0.4 + i * 0.2, color: i % 2 ? PK.dam : PK.damDark });
      c.solid.box(0.7, 0.014, 0.18, { y: 0.44 - i * 0.1, z: -0.4 + i * 0.2, color: PK.foam });
    }
    c.emitters.push({ kind: 'steam', x: 0, y: 0.05, z: 0.5 });
  },

  bandstand(c) {
    // the park's bandstand: an octagonal stone base, eight slim iron posts, a green conical roof with
    // a white trim and a finial, a lamp in it (glows in the fog and at night)
    c.solid.cyl(0.46, 0.5, 0.12, 8, { color: PK.dam });
    c.solid.cyl(0.44, 0.44, 0.012, 8, { y: 0.12, color: '#c9c2b2' });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      c.solid.cyl(0.016, 0.016, 0.5, 4, { x: Math.cos(a) * 0.4, y: 0.12, z: Math.sin(a) * 0.4, color: PK.iron });
    }
    c.solid.cyl(0.52, 0.52, 0.05, 8, { y: 0.6, color: PK.roofTrim });
    c.solid.cone(0.54, 0.3, 8, { y: 0.65, color: PK.roof });
    c.solid.cyl(0.015, 0.015, 0.12, 4, { y: 0.94, color: PK.iron });
    c.glow.sphere(0.04, 6, 4, { y: 0.54, color: PK.lamp });
    glowPoint(c, 0, 0.5, 0, PK.lamp, 0.6, 0.04);
    if (c.lod !== 'far') for (let i = 0; i < 3; i++) c.solid.box(0.16, 0.05, 0.05, { x: -0.18 + i * 0.18, y: 0.12, z: -0.18, color: PK.wood });
  },

  parkLamp(c) {
    // a park lamp along the path: a green iron post, a lantern head with a warm light
    c.solid.box(0.1, 0.04, 0.1, { color: PK.damDark });
    c.solid.cyl(0.018, 0.026, 0.82, 6, { y: 0.04, color: PK.iron });
    c.solid.cyl(0.05, 0.035, 0.03, 6, { y: 0.84, color: PK.iron });
    c.glow.cyl(0.045, 0.035, 0.1, 6, { y: 0.87, color: PK.lamp });
    c.solid.cone(0.07, 0.06, 6, { y: 0.97, color: PK.iron });
    glowPoint(c, 0, 0.92, 0, PK.lamp, 0.52, 0.05);
  },

  chainedBoats(c) {
    // rowing boats chained to a mooring post at the shore (0: two side by side, 1: one, upturned
    // on the bank beside the post)
    const k = v(c, 'chainedBoats');
    c.solid.cyl(0.03, 0.035, 0.3, 6, { x: -0.38, y: -0.02, z: -0.1, color: PK.woodDark });
    const hull = (x, z, ry, up = false) => {
      c.solid.box(0.24, 0.07, 0.62, { x, y: up ? 0.0 : 0.0, z, ry, color: up ? PK.boatBand : PK.boat });
      c.solid.box(0.25, 0.02, 0.63, { x, y: 0.05, z, ry, color: up ? PK.boat : PK.boatBand });
      if (!up) c.solid.box(0.18, 0.02, 0.06, { x, y: 0.05, z, ry, color: PK.wood });
    };
    if (k === 0) {
      hull(0.0, 0.05, 0.25);
      hull(0.3, 0.1, 0.1);
    } else hull(0.1, 0.0, 0.6, true);
    c.solid.box(0.4, 0.008, 0.008, { x: -0.18, y: 0.12, z: -0.02, ry: -0.3, color: '#5a5f66' });
  },

  rescueBuoy(c) {
    // a rescue buoy on its post by the water (0: an orange ring on a post, 1: a red-and-white ring
    // on a board with a lamp)
    const k = v(c, 'rescueBuoy');
    c.solid.box(0.04, 0.5, 0.04, { color: k ? PK.white : PK.woodDark });
    if (k === 0) {
      c.solid.torus(0.11, 0.035, 5, 12, { y: 0.4, z: 0.04, color: PK.buoy });
      for (let i = 0; i < 4; i++) c.solid.box(0.04, 0.074, 0.08, { x: Math.cos((i * Math.PI) / 2) * 0.11, y: 0.4 + Math.sin((i * Math.PI) / 2) * 0.11 - 0.037, z: 0.04, color: PK.white });
      return;
    }
    c.solid.box(0.3, 0.32, 0.03, { y: 0.24, color: PK.white });
    c.solid.torus(0.1, 0.03, 5, 12, { y: 0.4, z: 0.04, color: '#d62828' });
    c.glow.sphere(0.025, 6, 4, { y: 0.6, color: PK.lamp });
    glowPoint(c, 0, 0.6, 0, PK.lamp, 0.32, 0.05);
  },

  greatWillow(c) {
    // the great willow on the reservoir's island (about two tiles across at s 1): a short thick trunk
    // on spreading roots, a fluffy low crown of sage green, two rings of long weeping
    // strands hanging almost to the ground (foliage: they sway), a pale stone half buried in the roots
    const far = c.lod === 'far';
    const bark = '#5f4a38';
    c.solid.cyl(0.13, 0.2, 0.8, 7, { color: bark });
    c.solid.cyl(0.06, 0.1, 0.5, 5, { x: 0.12, y: 0.6, rz: -0.7, color: bark });
    c.solid.cyl(0.06, 0.1, 0.5, 5, { x: -0.12, y: 0.62, rz: 0.75, rx: 0.2, color: bark });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      c.solid.box(0.42, 0.08, 0.1, { x: Math.cos(a) * 0.24, z: Math.sin(a) * 0.24, ry: -a, rz: 0.12, color: '#544132' });
    }
    // the stone in its roots: pale, faintly cold
    c.solid.sphere(0.12, 6, 4, { x: 0.18, y: 0.04, z: 0.22, sy: 0.7, color: '#d9e4ea' });
    c.glow.sphere(0.04, 5, 4, { x: 0.18, y: 0.1, z: 0.32, color: '#e6f6ff' });
    glowPoint(c, 0.18, 0.12, 0.34, '#d8f0ff', 0.4, 0.1);
    // a fluffy crown (a broad low heart, four side puffs, a top), sage green kept light enough to read
    // on a night-and-fog board, and the strands round its rim, outside it, so the fringe shows from above
    const leaf = ['#86b394', '#76a585', '#a3c9ad'];
    const blob = (r, x, y, z, sy, col, detail) => c.foliage.blob(r, { x, y, z, sy, detail, wobble: 0.2, jitter: 0.05, rand: c.rand, color: col, attrs: { sway: () => 0.3 } });
    blob(0.72, 0, 1.12, 0, 0.55, leaf[1], far ? 0 : 1);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      blob(0.4, Math.cos(a) * 0.5, 1.2 + (i % 2) * 0.06, Math.sin(a) * 0.5, 0.6, leaf[i % 2 ? 0 : 2], 0);
    }
    blob(0.36, 0.06, 1.48, -0.04, 0.65, leaf[2], 0);
    // the weeping strands: a curtain of long, fine tapered falls from under the crown's rim, each
    // splayed a little outward so from above they fan out like a skirt (never stand like spikes,
    // never bend like legs). A fall's +y axis is turned to hang `tilt` off straight down, outward
    // along its own bearing: rz π + tilt, then ry −bearing.
    const rings = far ? [[0.84, 14, 0.3]] : [[0.86, 24, 0.3], [0.62, 12, 0.2]];
    for (const [r, n, tilt] of rings) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r;
        const len = 0.88 + ((i * 7) % 5) * 0.045;
        c.foliage.cone(0.03, len, 3, {
          x: Math.cos(a) * r, y: 1.08, z: Math.sin(a) * r, rz: Math.PI + tilt + ((i * 3) % 4) * 0.03, ry: -a,
          color: leaf[(i + Math.round(r * 10)) % 3], attrs: { sway: strandSway },
        });
      }
    }
  },

  searchBoat(c) {
    // a Brigade search boat on the reservoir: a navy hull with the amber band, a white cabin, a
    // searchlight on its roof (lit; the terrain sweeps its beam over the water), a mast lamp
    c.solid.box(0.4, 0.12, 0.9, { y: -0.03, color: PK.navy });
    c.solid.box(0.41, 0.04, 0.91, { y: 0.06, color: PK.amber });
    c.solid.cone(0.2, 0.22, 4, { y: -0.03, z: 0.55, rx: Math.PI / 2, ry: Math.PI / 4, sx: 1, sz: 0.4, color: PK.navy });
    c.solid.box(0.28, 0.2, 0.32, { y: 0.1, z: -0.12, color: '#eef3f8' });
    c.solid.box(0.29, 0.07, 0.33, { y: 0.2, z: -0.12, color: '#33404f' });
    c.solid.cyl(0.05, 0.06, 0.08, 8, { y: 0.3, z: -0.04, color: '#5a5f66' });
    c.glow.cyl(0.045, 0.045, 0.012, 8, { y: 0.34, z: 0.02, rx: Math.PI / 2, color: '#f4f8ff' });
    c.solid.box(0.015, 0.3, 0.015, { y: 0.3, z: -0.24, color: '#5a5f66' });
    c.glow.sphere(0.02, 6, 4, { y: 0.61, z: -0.24, color: PK.amber });
    glowPoint(c, 0, 0.36, 0.08, '#eaf2ff', 0.55, 0.03);
    glowPoint(c, 0, 0.61, -0.24, PK.amber, 0.3, 0.6);
  },
};

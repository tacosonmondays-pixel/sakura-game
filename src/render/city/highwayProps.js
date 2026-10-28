// Highway kit (Gate Arc S4a, `MapDef.district: 'highway'` on a `city` map; GATE_ARC §18.1, §18.3):
// the mountain highway of Act 4 as ordinary prop builders (props.js BUILDERS), on the city kit's
// materials. On the board: roadside embankments with sound walls, rock cuts, a maintenance depot, a
// salt dome, a control hut and a rest stop (roadsideBlock, all ≤ BOARD_MAX_H); sound walls on the
// border; steel crash barriers and jersey barriers; highway lamps; toll booths with a lit price
// board; sign gantries over the road; the checkpoint's barrier-arm post (the kit swings its arm on
// the lane schedule, as the level crossing's); the dressing of a highway bore (jet fans, sodium
// lamps); a stopped lorry; a rest-stop vending row; and in the skirt a concrete flyover on its
// piers. Brigade dressing lives in brigadeProps.js, the far north in ../northProps.js.
//
// Every builder keeps to HIGHWAY_VARIANTS[type] variants (≤ 6, `c.variant % n`) and to a triangle
// cap (tests/render/highway.test.js); nothing is transparent. On a frost stage (look.frost) the
// rails and barriers carry a white rime on top.
//
// Local frame: origin = tile centre on the ground, +y up, +z = the front (the road side).
import { FK } from './cityMaterials.js';
import { CROSSING_ARM } from './cityProps.js';

/** Variants per builder (`c.variant % n`); the kit and the tests read this. */
export const HIGHWAY_VARIANTS = {
  roadsideBlock: 6, soundWall: 3, jerseyBarrier: 2, crashBarrier: 1, highwayLamp: 1, tollBooth: 3, signGantry: 3,
  barrierArm: 2, tunnelPortal: 1, stoppedLorry: 2, restStop: 2, flyover: 2,
};

/** roadsideBlock variant → kind (STEP4_BUILD_PLAN §3). */
export const ROADSIDE_KINDS = ['soundBank', 'rockCut', 'depot', 'saltDome', 'controlHut', 'restStop'];

/**
 * The checkpoint barrier arm (barrierArm; cityKit swings it with the lane schedule): the hub sits
 * where the level crossing's does (cityProps CROSSING_ARM), so the kit poses both with one routine.
 */
export const BARRIER_ARM = { ...CROSSING_ARM, colors: ['#f7f4ee', '#f4a62a'] };

/** The flyover's deck height in the skirt (tiles). */
export const FLYOVER_Y = 1.15;

/** The highway palette: pale concrete, steel, sodium amber, sign green; Brigade navy and amber. */
export const HW = {
  concrete: '#cfccc4',
  concreteDark: '#a9a69e',
  concreteShade: '#8e8b84',
  steel: '#b9bfc6',
  steelDark: '#6d737b',
  rail: '#d3d8de',
  gravel: '#8f8a80',
  bank: '#7f8b5e',
  bankDark: '#6a7550',
  rock: '#8d9097',
  rockDark: '#6f7279',
  wallGreen: '#7a9a8c',
  signGreen: '#2f6f52',
  signBlue: '#2f5a94',
  signText: '#eef3f0',
  sodium: '#ffc46b',
  amber: '#f4a62a',
  navy: '#2b3a5c',
  white: '#eef3f8',
  orange: '#e8823a',
  rime: '#f4f8fc',
  glassDark: '#33404f',
};

const v = (c, type) => c.variant % HIGHWAY_VARIANTS[type];

function glowPoint(c, x, y, z, color, size = 0.5, flicker = 0.08) {
  c.glows.push({ x, y, z, color, size, flicker });
}

/** White rime along a rail's top when the stage is frosty (look.frost). */
function rime(c, w, y, z = 0, d = 0.04) {
  if (c.look.frost) c.solid.box(w, 0.012, d, { y, z, color: HW.rime });
}

/** A steel W-beam guard rail along local x, length L, beam at height y (posts every ~0.5). */
export function wBeam(c, L, y = 0.16, z = 0) {
  const n = Math.max(2, Math.round(L / 0.5) + 1);
  for (let i = 0; i < n; i++) c.solid.box(0.035, y + 0.03, 0.035, { x: -L / 2 + (L * i) / (n - 1), z: z - 0.03, color: HW.steelDark });
  c.solid.box(L, 0.07, 0.025, { y: y - 0.035, z, color: HW.rail });
  c.solid.box(L, 0.012, 0.03, { y: y - 0.004, z: z + 0.004, color: HW.steel });
  rime(c, L, y + 0.035, z, 0.03);
}

export const HIGHWAY_BUILDERS = {
  // ----- on the board (≤ BOARD_MAX_H; `far` in the skirt: the mass only) ---------------------
  roadsideBlock(c) {
    const kind = ROADSIDE_KINDS[v(c, 'roadsideBlock')];
    const far = c.lod === 'far';
    const F = c.facade;
    if (kind === 'soundBank') {
      // a gravel-and-grass embankment, a sound wall on its crest facing the road
      F.quad([-0.5, 0, 0.42], [0.5, 0, 0.42], [0.5, 0.3, 0.1], [-0.5, 0.3, 0.1], HW.bank);
      F.quad([-0.5, 0.3, -0.42], [0.5, 0.3, -0.42], [0.5, 0, -0.5], [-0.5, 0, -0.5], HW.bankDark);
      F.box(0, 0, -0.16, 1.0, 0.3, 0.52, { color: HW.bankDark, top: HW.bank, faces: [false, true, false, true] });
      F.box(0, 0.3, 0.02, 1.0, 0.42, 0.06, { color: HW.wallGreen, side: FK.plain });
      if (far) return;
      for (const x of [-0.48, 0, 0.48]) F.box(x, 0.3, 0.06, 0.05, 0.46, 0.05, { color: HW.concreteDark });
      F.box(0, 0.72, 0.02, 1.02, 0.03, 0.08, { color: HW.concreteDark });
      for (let i = 0; i < 3; i++) c.foliage.blob(0.07, { x: -0.3 + i * 0.3, y: 0.08, z: 0.3, detail: 0, color: i % 2 ? '#6f7f4f' : '#7f8f5a', attrs: { sway: () => 0.3 } });
      return;
    }
    if (kind === 'rockCut') {
      // the mountain the road was cut through: grey rock filling the tile (snow on its tops on a
      // frost stage), a concrete toe wall and rockfall netting toward the road (`far`: the rock
      // alone; the kit uses it, turned and scaled per tile, inside a big block of H: the mountain)
      const snowy = c.look.frost;
      for (const [x, y, z, r] of [[-0.26, 0.2, -0.2, 0.34], [0.24, 0.24, -0.24, 0.36], [0.0, 0.46, -0.04, 0.3], [0.28, 0.14, 0.2, 0.26], [-0.28, 0.12, 0.22, 0.24]]) {
        c.solid.rock(r, { x, y, z, sy: 0.85, ry: x * 3 + z, color: y > 0.3 ? (snowy ? '#c9d0d8' : HW.rock) : HW.rockDark, jitter: 0.08, rand: c.rand });
      }
      if (far) return;
      F.box(0, 0, 0.36, 1.0, 0.16, 0.08, { color: HW.concrete });
      for (let i = 0; i < 4; i++) c.solid.box(0.008, 0.5, 0.008, { x: -0.36 + i * 0.24, y: 0.16, z: 0.22, rx: -0.5, color: '#4a4f57' });
      c.solid.box(0.8, 0.008, 0.008, { y: 0.58, z: -0.02, color: '#4a4f57' });
      return;
    }
    if (kind === 'depot') {
      // the highway maintenance depot: a long shed with orange roller doors, a salt heap, a plough blade
      F.box(-0.1, 0, -0.1, 0.72, 0.42, 0.6, { color: '#d9d4c8', side: FK.plain, top: '#9aa0a8' });
      F.box(-0.1, 0.42, -0.1, 0.76, 0.04, 0.64, { color: HW.steelDark });
      if (far) return;
      for (const x of [-0.28, 0.08]) F.box(x, 0.02, 0.205, 0.26, 0.3, 0.012, { color: HW.orange, side: FK.shutter });
      F.box(-0.1, 0.36, 0.21, 0.6, 0.03, 0.012, { color: HW.amber });
      c.solid.cone(0.16, 0.18, 7, { x: 0.36, z: 0.24, color: '#e9e6df', jitter: 0.05, rand: c.rand });
      c.solid.box(0.3, 0.1, 0.04, { x: 0.34, y: 0.02, z: -0.3, ry: 0.4, color: HW.orange });
      c.glow.box(0.05, 0.03, 0.02, { x: -0.1, y: 0.4, z: 0.22, color: HW.sodium });
      glowPoint(c, -0.1, 0.4, 0.26, HW.sodium, 0.35, 0.04);
      return;
    }
    if (kind === 'saltDome') {
      // the road-salt barn: a dome on a low concrete ring, a wide door
      F.box(0, 0, 0, 0.8, 0.12, 0.8, { color: HW.concrete });
      c.solid.sphere(0.4, far ? 8 : 12, far ? 4 : 6, { y: 0.12, sy: 0.95, color: '#b9a98e' });
      if (far) return;
      c.solid.box(0.3, 0.28, 0.16, { y: 0.06, z: 0.3, color: '#a89878' });
      c.solid.box(0.22, 0.2, 0.02, { y: 0.08, z: 0.385, color: '#4a4440' });
      c.solid.cone(0.05, 0.1, 6, { y: 0.47, color: '#9a8a70' });
      if (c.look.frost) c.solid.sphere(0.26, 10, 4, { y: 0.34, sy: 0.5, color: HW.rime });
      return;
    }
    if (kind === 'controlHut') {
      // the road authority's control hut: office windows, a radio mast with a red lamp
      F.box(0, 0, -0.05, 0.62, 0.46, 0.5, { color: '#e3dfd6', side: FK.office, top: '#a7adb5' });
      F.box(0, 0.46, -0.05, 0.66, 0.04, 0.54, { color: HW.steelDark });
      if (far) return;
      F.box(0, 0, 0.21, 0.16, 0.26, 0.012, { color: HW.navy });
      c.solid.cyl(0.012, 0.018, 0.34, 4, { x: 0.22, y: 0.5, z: -0.2, color: HW.steelDark });
      c.glow.sphere(0.022, 5, 4, { x: 0.22, y: 0.85, z: -0.2, color: '#ff5d5d' });
      glowPoint(c, 0.22, 0.85, -0.2, '#ff6b6b', 0.3, 0.5);
      return;
    }
    // restStop: a low pavilion, a vending row under its canopy, a bench
    F.box(0, 0, -0.2, 0.84, 0.38, 0.4, { color: '#ece6da', side: FK.shop, top: '#9aa0a8' });
    F.box(0, 0.38, -0.02, 0.92, 0.04, 0.78, { color: '#3d6a9a' });
    if (far) return;
    for (const x of [-0.42, 0.42]) c.solid.box(0.03, 0.38, 0.03, { x, z: 0.34, color: HW.steelDark });
    for (let i = 0; i < 3; i++) {
      c.solid.box(0.16, 0.3, 0.12, { x: -0.22 + i * 0.22, z: 0.06, color: ['#e9ecef', '#d9604a', '#3d6a9a'][i] });
      c.glow.box(0.12, 0.16, 0.01, { x: -0.22 + i * 0.22, y: 0.1, z: 0.125, color: ['#d6f0ff', '#fff0c8', '#d6f0ff'][i] });
    }
    glowPoint(c, 0, 0.2, 0.2, '#e6f2ff', 0.45, 0.03);
    c.solid.box(0.36, 0.06, 0.1, { x: 0.18, y: 0.08, z: 0.3, color: '#8a6a4a' });
  },

  soundWall(c) {
    // border H tiles: a sound wall along the highway (concrete panels, green steel panels, or
    // panels over a planted bank)
    const k = v(c, 'soundWall');
    if (k === 0) {
      c.solid.box(1.0, 0.1, 0.22, { color: HW.concreteShade });
      for (let i = 0; i < 2; i++) c.solid.box(0.48, 0.5, 0.08, { x: -0.25 + i * 0.5, y: 0.1, color: i % 2 ? HW.concrete : '#c6c3bb' });
      for (const x of [-0.5, 0, 0.5]) c.solid.box(0.06, 0.62, 0.1, { x, color: HW.concreteDark });
    } else if (k === 1) {
      c.solid.box(1.0, 0.12, 0.2, { color: HW.concreteShade });
      for (let i = 0; i < 4; i++) c.solid.box(0.24, 0.46, 0.05, { x: -0.375 + i * 0.25, y: 0.12, color: i % 2 ? HW.wallGreen : '#6f8f80' });
      for (const x of [-0.5, 0, 0.5]) c.solid.box(0.04, 0.6, 0.06, { x, color: HW.steelDark });
      c.solid.box(1.0, 0.03, 0.07, { y: 0.58, color: HW.steelDark });
    } else {
      c.solid.box(1.0, 0.22, 0.34, { color: HW.bankDark, jitter: 0.04, rand: c.rand });
      c.solid.box(1.0, 0.36, 0.06, { y: 0.22, z: -0.08, color: HW.concrete });
      c.foliage.blob(0.12, { x: -0.2, y: 0.26, z: 0.08, detail: 0, color: '#6f8f55', attrs: { sway: () => 0.3 } });
      c.foliage.blob(0.1, { x: 0.26, y: 0.24, z: 0.1, detail: 0, color: '#7f9a5f', attrs: { sway: () => 0.3 } });
    }
    rime(c, 1.0, k === 2 ? 0.58 : 0.61, k === 2 ? -0.08 : 0, 0.08);
  },

  // ----- road furniture -----------------------------------------------------------------
  jerseyBarrier(c) {
    // a concrete jersey barrier (0) or the Brigade's water-filled barrier, amber and white (1)
    const k = v(c, 'jerseyBarrier');
    if (k === 0) {
      c.solid.box(0.9, 0.06, 0.2, { color: HW.concreteDark });
      c.solid.box(0.9, 0.16, 0.1, { y: 0.06, color: HW.concrete });
      c.solid.box(0.9, 0.012, 0.012, { y: 0.11, z: 0.052, color: HW.amber });
      rime(c, 0.9, 0.22, 0, 0.1);
      return;
    }
    for (let i = 0; i < 2; i++) {
      c.solid.box(0.42, 0.2, 0.18, { x: -0.22 + i * 0.44, color: i % 2 ? HW.white : HW.amber });
      c.solid.box(0.42, 0.012, 0.12, { x: -0.22 + i * 0.44, y: 0.2, color: i % 2 ? '#d9dee4' : '#d98e1f' });
    }
    rime(c, 0.9, 0.212, 0, 0.12);
  },
  crashBarrier(c) {
    // the frame ring's steel guard rail (the kit draws the long runs beside the road itself)
    wBeam(c, 1.0, 0.17, 0.04);
  },
  highwayLamp(c) {
    // a tall highway lamp: a tapered pole, a long arm over the road (+z), a sodium lamp head
    c.solid.box(0.12, 0.05, 0.12, { color: HW.concreteShade });
    c.solid.cyl(0.018, 0.03, 1.36, 6, { y: 0.05, color: HW.steelDark });
    c.solid.box(0.018, 0.018, 0.44, { y: 1.38, z: 0.2, rx: -0.12, color: HW.steelDark });
    c.solid.box(0.1, 0.035, 0.18, { y: 1.4, z: 0.42, color: HW.steelDark });
    c.glow.box(0.08, 0.01, 0.15, { y: 1.39, z: 0.42, color: '#ffd9a0' });
    glowPoint(c, 0, 1.36, 0.42, HW.sodium, 0.55, 0.04);
  },
  tollBooth(c) {
    // a toll booth on its island along the road (local x): a striped island nose, the cabin with its
    // window lit, a canopy on two pillars with an amber fascia, a lit price board on a post facing
    // the road (+z) (1: the booth's own barrier arm raised; 2: closed, shutter down)
    const k = v(c, 'tollBooth');
    c.solid.box(0.86, 0.06, 0.3, { color: HW.concreteDark });
    for (let i = 0; i < 3; i++) c.solid.box(0.06, 0.062, 0.3, { y: 0.001, x: 0.4 - i * 0.12, color: i % 2 ? '#2b2b2b' : '#ffd84d' });
    c.facade.box(-0.08, 0.06, -0.01, 0.36, 0.34, 0.24, { color: HW.white, side: k === 2 ? FK.shutter : FK.plain });
    if (k !== 2) c.glow.box(0.24, 0.12, 0.012, { x: -0.08, y: 0.22, z: 0.112, color: '#fff2cf' });
    c.solid.box(0.42, 0.03, 0.28, { x: -0.08, y: 0.4, color: HW.navy });
    for (const x of [-0.36, 0.3]) c.solid.box(0.05, 0.5, 0.05, { x, y: 0.06, z: -0.08, color: HW.steel });
    c.solid.box(0.9, 0.05, 0.44, { y: 0.56, z: -0.02, color: '#e9e6df' });
    c.solid.box(0.92, 0.05, 0.46, { y: 0.51, z: -0.02, color: HW.amber });
    rime(c, 0.9, 0.61, -0.02, 0.44);
    // the price board: a dark panel facing the road, its numbers as glow bars
    c.solid.box(0.03, 0.42, 0.03, { x: 0.36, z: 0.08, color: HW.steelDark });
    c.solid.box(0.24, 0.18, 0.04, { x: 0.36, y: 0.42, z: 0.08, color: '#1f2733' });
    if (k !== 2) {
      for (let i = 0; i < 3; i++) c.glow.box(0.16 - i * 0.03, 0.025, 0.01, { x: 0.36, y: 0.46 + i * 0.045, z: 0.102, color: i ? '#7fe0a8' : HW.sodium });
      glowPoint(c, 0.36, 0.5, 0.12, '#9ff0c0', 0.32, 0.03);
    }
    if (k === 1) {
      const A = BARRIER_ARM;
      for (let i = 0; i < 4; i++) c.solid.box(A.w, A.seg, A.w, { x: 0.42, y: 0.18 + i * A.seg, z: 0.12, color: A.colors[i % 2] });
    }
  },
  signGantry(c) {
    // a sign gantry across the road (local x): two posts clear of the road edges, a truss beam, the
    // signs on its front face (0 green, 1 blue expressway, 2 a dark message board with amber text)
    const k = v(c, 'signGantry');
    const X = 0.86;
    const Y = 1.02;
    for (const x of [-X, X]) {
      c.solid.box(0.12, 0.06, 0.12, { x, color: HW.concreteShade });
      c.solid.box(0.05, Y + 0.12, 0.05, { x, y: 0.06, color: HW.steel });
    }
    c.solid.box(2 * X + 0.08, 0.04, 0.04, { y: Y, z: -0.04, color: HW.steel });
    c.solid.box(2 * X + 0.08, 0.04, 0.04, { y: Y + 0.14, z: -0.04, color: HW.steel });
    for (let i = 0; i < 6; i++) c.solid.box(0.016, 0.16, 0.016, { x: -X + 0.15 + i * 0.29, y: Y, z: -0.04, rz: i % 2 ? 0.7 : -0.7, color: HW.steelDark });
    if (k === 2) {
      c.solid.box(0.9, 0.26, 0.04, { y: Y - 0.04, z: 0.01, color: '#1f2430' });
      for (let i = 0; i < 2; i++) c.glow.box(0.66 - i * 0.2, 0.035, 0.01, { y: Y + 0.03 + i * 0.07, z: 0.034, color: HW.amber });
      glowPoint(c, 0, Y + 0.06, 0.05, HW.amber, 0.4, 0.06);
      return;
    }
    const col = k === 1 ? HW.signBlue : HW.signGreen;
    for (const [x, w] of [[-0.42, 0.62], [0.36, 0.7]]) {
      c.solid.box(w, 0.28, 0.03, { x, y: Y - 0.06, z: 0.01, color: col });
      c.solid.box(w - 0.06, 0.01, 0.032, { x, y: Y + 0.19, z: 0.012, color: HW.signText });
      c.solid.box(w * 0.55, 0.035, 0.032, { x: x - w * 0.12, y: Y + 0.09, z: 0.012, color: HW.signText });
      c.solid.box(w * 0.4, 0.03, 0.032, { x: x - w * 0.18, y: Y + 0.02, z: 0.012, color: HW.signText });
      c.solid.box(0.06, 0.06, 0.032, { x: x + w * 0.34, y: Y + 0.03, z: 0.012, rz: Math.PI / 4, color: HW.signText });
    }
    rime(c, 2 * X + 0.08, Y + 0.16, -0.04, 0.05);
  },
  barrierArm(c) {
    // the checkpoint's barrier post in Brigade navy and amber, a beacon on top; variant 0 is the post
    // alone (the city kit swings its arm with the lane schedule), 1 has its arm down across the road
    const A = BARRIER_ARM;
    c.solid.box(0.18, 0.05, 0.18, { color: HW.concreteShade });
    c.solid.box(0.13, 0.36, 0.13, { y: 0.05, color: HW.navy });
    c.solid.box(0.135, 0.04, 0.135, { y: 0.22, color: HW.amber });
    c.solid.box(0.1, 0.1, 0.1, { x: -0.05, y: 0.36, color: '#3d4a68' });
    c.solid.box(0.02, 0.04, 0.02, { y: 0.41, color: HW.steelDark });
    c.glow.cyl(0.03, 0.03, 0.04, 6, { y: 0.45, color: HW.amber });
    if (v(c, 'barrierArm') === 0) return;
    glowPoint(c, 0, 0.48, 0, HW.amber, 0.42, 0.6);
    for (let i = 0; i < A.segs; i++) c.solid.box(A.seg, A.w, A.w, { x: A.hubX + A.seg / 2 + 0.02 + i * A.seg, y: A.hubY, color: A.colors[i % 2] });
  },
  tunnelPortal(c) {
    // a highway bore's dressing (trackMesh draws the headwall and its dark mouth): a short concrete
    // hood out over the road with two jet fans hung under it, sodium lamps either side of the mouth,
    // a lane sign on the lintel; local +z points out of the bore
    c.solid.box(1.08, 0.06, 0.42, { y: 0.66, z: 0.27, color: HW.concrete });
    c.solid.box(1.08, 0.03, 0.03, { y: 0.69, z: 0.48, color: HW.amber });
    for (const x of [-0.51, 0.51]) c.solid.box(0.06, 0.66, 0.06, { x, z: 0.44, color: HW.concreteDark });
    for (const x of [-0.22, 0.22]) {
      c.solid.cyl(0.055, 0.055, 0.26, 8, { x, y: 0.59, z: 0.24, rx: Math.PI / 2, color: '#5d636b' });
      c.solid.cyl(0.04, 0.04, 0.262, 8, { x, y: 0.59, z: 0.24, rx: Math.PI / 2, color: '#2a2e35' });
    }
    for (const x of [-0.72, 0.72]) {
      c.solid.box(0.08, 0.06, 0.06, { x, y: 0.5, z: 0.1, color: HW.steelDark });
      c.glow.box(0.06, 0.03, 0.012, { x, y: 0.5, z: 0.132, color: '#ffd9a0' });
      glowPoint(c, x, 0.5, 0.16, HW.sodium, 0.42, 0.05);
    }
    c.solid.box(0.56, 0.14, 0.03, { y: 0.82, z: 0.09, color: HW.signGreen });
    c.solid.box(0.4, 0.03, 0.032, { y: 0.87, z: 0.091, color: HW.signText });
    c.solid.box(0.24, 0.025, 0.032, { x: -0.06, y: 0.83, z: 0.091, color: HW.signText });
    rime(c, 1.08, 0.72, 0.27, 0.42);
  },

  // ----- roadside set pieces ---------------------------------------------------------------
  stoppedLorry(c) {
    // a lorry stopped on the hard shoulder, hazard lights blinking (1: a flatbed under a tarp)
    const k = v(c, 'stoppedLorry');
    const far = c.lod === 'far';
    c.solid.box(0.44, 0.34, 0.36, { y: 0.08, z: 0.6, color: k ? '#d9604a' : '#e9ecef' });
    c.solid.box(0.45, 0.13, 0.12, { y: 0.26, z: 0.72, color: HW.glassDark });
    c.solid.box(0.46, 0.06, 0.38, { y: 0.06, z: 0.6, color: '#2a2d34' });
    if (k === 0) {
      c.solid.box(0.46, 0.48, 1.1, { y: 0.1, z: -0.18, color: '#dcd8cf' });
      c.solid.box(0.462, 0.06, 1.1, { y: 0.3, z: -0.18, color: '#3d6a9a' });
    } else {
      c.solid.box(0.46, 0.06, 1.1, { y: 0.1, z: -0.18, color: HW.steelDark });
      c.solid.box(0.42, 0.26, 0.96, { y: 0.16, z: -0.2, color: '#5f7a5a', jitter: 0.05, rand: c.rand });
    }
    if (c.look.frost) c.solid.box(0.44, 0.02, 1.06, { y: k ? 0.42 : 0.58, z: -0.18, color: HW.rime });
    if (far) return;
    for (const z of [0.6, -0.1, -0.5]) for (const x of [-0.22, 0.22]) c.solid.box(0.06, 0.12, 0.14, { x, z, color: '#24272d' });
    for (const [x, z] of [[-0.2, 0.78], [0.2, 0.78], [-0.2, -0.74], [0.2, -0.74]]) {
      c.glow.box(0.05, 0.03, 0.012, { x, y: 0.18, z, color: HW.amber });
    }
    glowPoint(c, -0.2, 0.2, 0.8, HW.amber, 0.3, 0.9);
    glowPoint(c, 0.2, 0.2, -0.76, HW.amber, 0.3, 0.9);
    // a warning triangle behind it
    c.solid.cone(0.06, 0.1, 3, { y: 0, z: -1.0, color: '#ff6b5a' });
  },
  restStop(c) {
    // a rest-stop vending row: five machines under a canopy, a bench (1: a noodle kiosk with steam)
    const k = v(c, 'restStop');
    c.solid.box(1.0, 0.04, 0.5, { color: HW.concreteDark });
    for (const x of [-0.46, 0.46]) c.solid.box(0.04, 0.5, 0.04, { x, z: 0.2, color: HW.steelDark });
    c.solid.box(1.04, 0.04, 0.56, { y: 0.5, color: '#3d6a9a' });
    if (k === 0) {
      for (let i = 0; i < 5; i++) {
        c.solid.box(0.17, 0.36, 0.14, { x: -0.38 + i * 0.19, y: 0.04, z: -0.12, color: ['#e9ecef', '#d9604a', '#3d6a9a', '#e9ecef', '#e3b04a'][i] });
        c.glow.box(0.12, 0.2, 0.01, { x: -0.38 + i * 0.19, y: 0.14, z: -0.048, color: i % 2 ? '#fff0c8' : '#d6f0ff' });
      }
      glowPoint(c, 0, 0.3, 0, '#e6f2ff', 0.55, 0.03);
      c.solid.box(0.4, 0.06, 0.12, { x: 0.2, y: 0.1, z: 0.16, color: '#8a6a4a' });
      return;
    }
    c.facade.box(0, 0.04, -0.1, 0.7, 0.34, 0.26, { color: '#f3e7d0', side: FK.shop });
    c.solid.box(0.72, 0.08, 0.06, { y: 0.4, z: 0.04, color: '#d9473f' });
    c.glow.box(0.3, 0.05, 0.01, { y: 0.42, z: 0.075, color: '#fff0c8' });
    c.solid.box(0.6, 0.04, 0.12, { y: 0.24, z: 0.1, color: '#8a6a4a' });
    c.emitters.push({ kind: 'steam', x: 0.2, y: 0.3, z: 0.1 });
    glowPoint(c, 0, 0.36, 0.1, HW.sodium, 0.4, 0.06);
  },

  // ----- the skirt -------------------------------------------------------------------------
  flyover(c) {
    // a concrete flyover segment along local x (2.1 long: the skirt lots chain into one elevated
    // road): the deck, parapets with a lamp, a T-shaped pier (1: two slim piers and a sign)
    const k = v(c, 'flyover');
    const far = c.lod === 'far';
    const Y = FLYOVER_Y;
    const L = 2.12;
    c.solid.box(L, 0.16, 0.96, { y: Y - 0.16, color: HW.concreteDark });
    c.solid.box(L, 0.012, 0.8, { y: Y, color: '#9fa1a6' });
    for (const z of [-0.45, 0.45]) c.solid.box(L, 0.1, 0.06, { y: Y, z, color: HW.concrete });
    if (k === 0) {
      c.solid.box(0.24, Y - 0.3, 0.24, { color: HW.concreteShade });
      c.solid.box(0.3, 0.14, 0.8, { y: Y - 0.3, color: HW.concreteDark });
    } else {
      for (const x of [-0.6, 0.6]) c.solid.box(0.14, Y - 0.16, 0.14, { x, color: HW.concreteShade });
    }
    if (far) return;
    c.solid.box(L, 0.012, 0.012, { y: Y + 0.013, color: '#f2f0ea' });
    c.solid.cyl(0.012, 0.016, 0.42, 5, { x: 0.5, y: Y + 0.1, z: 0.45, color: HW.steelDark });
    c.glow.box(0.06, 0.012, 0.1, { x: 0.5, y: Y + 0.5, z: 0.4, color: '#ffd9a0' });
    glowPoint(c, 0.5, Y + 0.48, 0.4, HW.sodium, 0.4, 0.04);
    if (k === 1) {
      c.solid.box(0.6, 0.22, 0.03, { x: -0.4, y: Y + 0.12, z: 0.47, color: HW.signGreen });
      c.solid.box(0.44, 0.03, 0.032, { x: -0.4, y: Y + 0.24, z: 0.472, color: HW.signText });
    }
    rime(c, L, Y + 0.1, -0.45, 0.06);
    rime(c, L, Y + 0.1, 0.45, 0.06);
  },
};

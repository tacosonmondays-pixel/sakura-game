// The far north (Gate Arc S4a, the Morning side of the Petal Gate; GATE_ARC §18.3 "Far north"):
// the frozen villages of the people running from the cold, as ordinary prop builders (props.js
// BUILDERS) on the shipped `snow` theme. Frozen huts with horned-family charms by their doors, a
// fire going out, the three village hearths (relay pads: a ring of hearth stones round the pad, its
// embers as glow geometry; the girl on the pad stands in the clear middle), small sleds, the Host's
// war banners, the old stone bridge's piers beside the Brigade's military deck, and the pass cairn.
// Nobody is shown: loss is told by what was left (a sled tipped over, a fire nobody tends).
//
// Every builder keeps to NORTH_VARIANTS[type] variants (≤ 6, `c.variant % n`) and to a triangle
// cap (tests/render/north.test.js); nothing is transparent.
//
// Local frame: origin = tile centre on the ground (on the water for the piers), +y up, +z = the front.

/** Variants per builder (`c.variant % n`); the kit and the tests read this. */
export const NORTH_VARIANTS = {
  frozenHut: 3, dyingFire: 1, villageHearth: 1, sled: 2, warBanner: 2, stoneBridgePier: 2, passCairn: 1,
};

/** frozenHut variant → kind. */
export const HUT_KINDS = ['roundHut', 'longhouse', 'stiltStore'];

/** The hearth's stone ring (tiles): the relay pad's girl stands inside it (rules pads r ≈ 0.9). */
export const HEARTH_RING = 0.74;

/** The far north's palette: weathered timber, thatch under snow, cold stone, ember amber. */
export const NORTH = {
  timber: '#6e5442',
  timberDark: '#4f3b2f',
  thatch: '#9a8462',
  snow: '#f4f8fc',
  snowShade: '#d9e4ef',
  stone: '#9aa3ae',
  stoneDark: '#77808c',
  ember: '#ff9a3d',
  emberHot: '#ffd27a',
  char: '#2f2a28',
  charm: '#e8dcc0',
  charmRed: '#b5473a',
  banner: '#6a2f2f',
  bannerDark: '#4a2424',
  iron: '#5a5f66',
  bone: '#e6dccb',
};

const v = (c, type) => c.variant % NORTH_VARIANTS[type];

function glowPoint(c, x, y, z, color, size = 0.5, flicker = 0.12) {
  c.glows.push({ x, y, z, color, size, flicker });
}

/** A horned-family charm hung by a door: a small ring with two horns and a red cord. */
function charm(c, x, y, z) {
  c.solid.torus(0.03, 0.008, 3, 8, { x, y, z, color: NORTH.charm });
  for (const s of [-1, 1]) c.solid.cone(0.012, 0.05, 4, { x: x + s * 0.028, y: y + 0.01, z, rz: -s * 0.5, color: NORTH.bone });
  c.solid.box(0.006, 0.06, 0.006, { x, y: y - 0.08, z, color: NORTH.charmRed });
}

export const NORTH_BUILDERS = {
  frozenHut(c) {
    // a village hut gone cold: snow on the roof, a dark doorway, a horned-family charm by the door,
    // no light inside (0 round hut with a conical thatch, 1 longhouse, 2 a storehouse on stilts)
    const kind = HUT_KINDS[v(c, 'frozenHut')];
    const far = c.lod === 'far';
    if (kind === 'roundHut') {
      c.solid.cyl(0.34, 0.36, 0.3, far ? 6 : 9, { color: NORTH.stone, jitter: 0.05, rand: c.rand });
      c.solid.cone(0.46, 0.44, far ? 6 : 9, { y: 0.3, color: NORTH.thatch, jitter: 0.04, rand: c.rand });
      c.solid.cone(0.3, 0.3, far ? 6 : 9, { y: 0.45, color: NORTH.snow });
      if (far) return;
      c.solid.box(0.14, 0.22, 0.02, { z: 0.345, color: NORTH.char });
      c.solid.box(0.18, 0.03, 0.04, { y: 0.22, z: 0.35, color: NORTH.timberDark });
      charm(c, 0.14, 0.24, 0.37);
      c.solid.box(0.3, 0.03, 0.12, { y: 0.0, z: 0.42, color: NORTH.snowShade });
      return;
    }
    if (kind === 'longhouse') {
      c.solid.box(0.86, 0.3, 0.56, { color: NORTH.timber, jitter: 0.04, rand: c.rand });
      // the roof: two slopes heavy with snow, the ridge beam's ends carved as horns
      c.solid.box(0.94, 0.04, 0.4, { y: 0.36, z: 0.14, rx: -0.6, color: NORTH.snow });
      c.solid.box(0.94, 0.04, 0.4, { y: 0.36, z: -0.14, rx: 0.6, color: NORTH.snowShade });
      c.solid.box(0.94, 0.06, 0.36, { y: 0.31, z: 0.14, rx: -0.6, color: NORTH.thatch });
      c.solid.box(0.94, 0.06, 0.36, { y: 0.31, z: -0.14, rx: 0.6, color: NORTH.thatch });
      if (far) return;
      for (const s of [-1, 1]) {
        c.solid.cone(0.025, 0.14, 4, { x: s * 0.46, y: 0.52, rz: -s * 0.5, color: NORTH.timberDark });
        c.solid.box(0.04, 0.26, 0.04, { x: s * 0.44, z: 0.27, color: NORTH.timberDark });
      }
      c.solid.box(0.16, 0.22, 0.02, { x: -0.18, z: 0.285, color: NORTH.char });
      c.solid.box(0.12, 0.08, 0.02, { x: 0.2, y: 0.12, z: 0.285, color: '#3a3f4a' });
      charm(c, 0.0, 0.22, 0.3);
      // firewood stacked by the wall, half under snow
      for (let i = 0; i < 3; i++) c.solid.cyl(0.03, 0.03, 0.26, 5, { x: 0.3, y: 0.03 + i * 0.05, z: 0.34, rz: Math.PI / 2, color: '#7a5a3e' });
      c.solid.box(0.28, 0.02, 0.08, { x: 0.3, y: 0.16, z: 0.34, color: NORTH.snow });
      return;
    }
    // a storehouse on four stilts, a ladder, snow on the roof
    for (const [x, z] of [[-0.24, -0.2], [0.24, -0.2], [-0.24, 0.2], [0.24, 0.2]]) c.solid.box(0.05, 0.26, 0.05, { x, z, color: NORTH.timberDark });
    c.solid.box(0.58, 0.04, 0.5, { y: 0.26, color: NORTH.timberDark });
    c.solid.box(0.52, 0.26, 0.44, { y: 0.3, color: NORTH.timber, jitter: 0.04, rand: c.rand });
    c.solid.box(0.66, 0.06, 0.58, { y: 0.56, color: NORTH.thatch });
    c.solid.box(0.62, 0.05, 0.54, { y: 0.62, color: NORTH.snow });
    if (far) return;
    for (const x of [-0.08, 0.08]) c.solid.box(0.02, 0.36, 0.02, { x, y: 0, z: 0.34, rx: -0.35, color: NORTH.timberDark });
    for (let i = 0; i < 3; i++) c.solid.box(0.16, 0.015, 0.015, { y: 0.08 + i * 0.1, z: 0.36 - i * 0.035, color: NORTH.timberDark });
    charm(c, 0.18, 0.46, 0.23);
  },
  dyingFire(c) {
    // a fire going out: a stone ring, charred logs, a low ember glow, thin smoke
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      c.solid.rock(0.055, { x: Math.cos(a) * 0.2, y: 0.03, z: Math.sin(a) * 0.2, color: NORTH.stoneDark });
    }
    for (let i = 0; i < 3; i++) c.solid.cyl(0.025, 0.03, 0.3, 5, { y: 0.03, ry: (i / 3) * Math.PI, rz: Math.PI / 2, color: NORTH.char });
    c.glow.cone(0.06, 0.08, 6, { y: 0.03, color: '#c4572a', color2: NORTH.ember });
    glowPoint(c, 0, 0.1, 0, NORTH.ember, 0.55, 0.4);
    c.emitters.push({ kind: 'smoke', x: 0, y: 0.12, z: 0 });
  },
  villageHearth(c) {
    // one of the village's three last warm hearths (a relay pad on 4-9): a ring of flat hearth
    // stones, embers glowing in the joints, three ember bowls; the middle stays clear for the girl
    const R = HEARTH_RING;
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      c.solid.box(0.24, 0.06, 0.12, { x: Math.cos(a) * R, z: Math.sin(a) * R, ry: -a + Math.PI / 2, color: i % 2 ? NORTH.stone : NORTH.stoneDark, jitter: 0.04, rand: c.rand });
      c.glow.box(0.06, 0.02, 0.05, { x: Math.cos(a + Math.PI / n) * R, y: 0.005, z: Math.sin(a + Math.PI / n) * R, ry: -a, color: i % 3 ? NORTH.ember : NORTH.emberHot });
    }
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const x = Math.cos(a) * (R + 0.16);
      const z = Math.sin(a) * (R + 0.16);
      c.solid.cyl(0.08, 0.06, 0.08, 7, { x, z, color: NORTH.iron });
      c.glow.cyl(0.065, 0.065, 0.01, 7, { x, y: 0.08, z, color: NORTH.emberHot });
      glowPoint(c, x, 0.14, z, NORTH.ember, 0.5, 0.3);
    }
  },
  sled(c) {
    // a small wooden sled with a bundle tied on (1: tipped over in the snow, the bundle spilt)
    const tipped = v(c, 'sled') === 1;
    const rz = tipped ? 1.3 : 0;
    const y0 = tipped ? 0.12 : 0;
    for (const x of [-0.13, 0.13]) {
      c.solid.box(0.025, 0.04, 0.56, { x: tipped ? x * 0.2 : x, y: tipped ? y0 + x : 0, rz, color: NORTH.timberDark });
      if (!tipped) c.solid.box(0.025, 0.08, 0.025, { x, y: 0.0, z: 0.3, rx: 0.8, color: NORTH.timberDark });
    }
    c.solid.box(0.32, 0.025, 0.46, { y: tipped ? 0.12 : 0.06, x: tipped ? -0.02 : 0, rz, color: NORTH.timber });
    if (tipped) {
      c.solid.blob(0.09, { x: 0.24, y: 0.06, z: 0.12, color: '#8a5a4a', sy: 0.7 });
      c.solid.box(0.18, 0.02, 0.14, { x: 0.3, y: 0.0, z: -0.12, ry: 0.5, color: '#c9b48a' });
      return;
    }
    c.solid.blob(0.11, { y: 0.16, z: -0.06, sy: 0.75, color: '#8a5a4a' });
    c.solid.box(0.26, 0.012, 0.03, { y: 0.2, z: -0.06, color: NORTH.charmRed });
    c.solid.box(0.02, 0.02, 0.4, { x: 0.0, y: 0.06, z: 0.42, rx: -0.4, color: '#c9b48a' });
  },
  warBanner(c) {
    // the Host's war banner: a tall pole, a crossbar, a long dark cloth with a pale horned sign (1:
    // tattered, its pole leaning)
    const k = v(c, 'warBanner');
    const lean = k ? 0.12 : 0;
    c.solid.cyl(0.025, 0.032, 1.3, 5, { rz: lean, color: NORTH.timberDark });
    c.solid.box(0.42, 0.03, 0.03, { x: -lean * 1.2, y: 1.18, rz: lean, color: NORTH.timberDark });
    const sway = (x, y) => Math.max(0, 1.18 - y) * 0.7;
    const h = k ? 0.5 : 0.66;
    c.foliage.box(0.36, h, 0.015, { x: -lean * 1.1, y: 1.17 - h, z: 0.03, rz: lean, color: k ? NORTH.bannerDark : NORTH.banner, attrs: { sway } });
    c.foliage.box(0.12, 0.12, 0.018, { x: -lean * 1.1, y: 0.92, z: 0.035, rz: lean, color: NORTH.bone, attrs: { sway } });
    for (const s of [-1, 1]) c.foliage.cone(0.02, 0.08, 4, { x: -lean * 1.1 + s * 0.06, y: 1.0, z: 0.04, rz: -s * 0.5 + lean, color: NORTH.bone, attrs: { sway } });
    c.solid.cone(0.04, 0.1, 4, { y: 1.3, color: NORTH.iron });
    if (c.look.theme === 'snow') c.solid.box(0.4, 0.012, 0.035, { x: -lean * 1.2, y: 1.2, rz: lean, color: NORTH.snow });
  },
  stoneBridgePier(c) {
    // a pier of the old stone bridge standing in the river beside the Brigade's deck: a tapered
    // stone column with a cutwater, the stub of its arch on top, snow on it (1: broken off lower)
    const broken = v(c, 'stoneBridgePier') === 1;
    const H = broken ? 0.42 : 0.7;
    c.solid.box(0.42, 0.3, 0.6, { y: -0.3, color: NORTH.stoneDark, jitter: 0.04, rand: c.rand });
    c.solid.box(0.36, H, 0.5, { color: NORTH.stone, jitter: 0.05, rand: c.rand });
    c.solid.box(0.3, H * 0.6, 0.3, { z: 0.26, ry: Math.PI / 4, sx: 0.9, color: NORTH.stoneDark });
    if (!broken) {
      for (const s of [-1, 1]) c.solid.box(0.3, 0.12, 0.5, { x: s * 0.24, y: H - 0.06, rz: s * 0.5, color: NORTH.stone, jitter: 0.05, rand: c.rand });
    } else {
      for (let i = 0; i < 3; i++) c.solid.rock(0.07, { x: -0.1 + i * 0.1, y: H + 0.02, z: (i - 1) * 0.12, color: NORTH.stoneDark });
    }
    c.solid.box(0.38, 0.03, 0.52, { y: H, color: NORTH.snow });
  },
  passCairn(c) {
    // the pass cairn: a stack of flat stones with a strip of red cloth (where the natives come down)
    let y = 0;
    for (let i = 0; i < 5; i++) {
      const r = 0.2 - i * 0.03;
      c.solid.cyl(r, r + 0.02, 0.09, 6, { y, ry: i * 0.6, color: i % 2 ? NORTH.stone : NORTH.stoneDark, jitter: 0.05, rand: c.rand });
      y += 0.09;
    }
    c.solid.cyl(0.006, 0.006, 0.3, 4, { y, color: NORTH.timberDark });
    c.foliage.box(0.12, 0.04, 0.008, { x: 0.06, y: y + 0.24, color: NORTH.charmRed, attrs: { sway: (x) => Math.max(0, x) * 2 } });
    c.solid.cyl(0.12, 0.14, 0.03, 6, { y, color: NORTH.snow });
  },
};

// Vesperline (Gate Arc S6a, `MapDef.theme: 'vesper'`; GATE_ARC §18.1-§18.4): the city of glass on the lake, as
// ordinary prop builders (props.js BUILDERS) on the city kit's materials. One set serves both looks: the LIVING
// city (white glass, sky blue, cherry trees in glass courtyards; the theme itself) and the FROZEN city
// (`scenery.ruined: 'frozen'`, themes.FROZEN: `c.look.frozen`): snow on every ledge, ice on the fountains, the
// cherry crowns frosted white, the holo signs flickering, a few of them dead.
//
// On the board (≤ BOARD_MAX_H): lecture halls and podiums, frosted glass panes on the border, holo signs along
// the lanes (the kit's lane lamps), cherry trees in their glass courtyards, frozen fountains, halo statues. Set
// pieces a map places (decor or scenery keywords): the Doorie statue (a round, faceless, lantern-carrying mascot
// with a keychain cast at her belt: mascot-simple, no body detail), a Doorie bus, the prism batteries round a
// relay pad, transit pads, the gate terminal, the Spindle (its foot on the board, its shaft in the skirt: the
// tallest prop in the game, far LOD), the frozen nest (far too big for any bird; no eggs), one thin grey thread
// in the ice (small on purpose), a sky-rail station canopy, a pod left hanging at a broken sky-rail end, the
// observatory's cracked dome, its star-map shards and the orrery's brass rings. In the skirt: glass towers
// (far LOD). Nobody is shown.
//
// Every builder keeps to VESPER_VARIANTS[type] variants (≤ 6, `c.variant % n`) and to a triangle cap
// (tests/render/vesper.test.js); nothing is transparent. Glow geometry is unlit; the holo signs' sprites
// flicker (strongly when frozen) and dim in a blackout, the shelter's warm window and the gates keep theirs
// (terrain.js KEEP_LIT).
//
// Local frame: origin = tile centre on the ground, +y up, +z = the front (the road side).
import { FK } from './cityMaterials.js';

/** Variants per builder (`c.variant % n`); the kit and the tests read this. */
export const VESPER_VARIANTS = {
  glassTower: 4, podium: 3, lectureHall: 4, holoSign: 4, haloStatue: 2, doorieStatue: 1, doorieBus: 2,
  prismBattery: 1, transitPad: 2, frozenFountain: 2, frostedPane: 4, vesperTerminal: 2, spindle: 2,
  frozenNest: 1, greyWool: 1, stationCanopy: 2, starDome: 3, courtyardTree: 3, skyRailPod: 2,
};

/** lectureHall variant → kind. */
export const HALL_KINDS = ['lectureHall', 'entranceHall', 'library', 'observatoryAnnex'];
/** holoSign variant → kind (3: a dead sign, no light). */
export const HOLO_KINDS = ['laneLamp', 'billboard', 'arrowKiosk', 'deadSign'];
/** spindle variant → part (0 on the board, 1 in the skirt). */
export const SPINDLE_PARTS = ['foot', 'shaft'];
/** starDome variant → piece. */
export const STAR_DOME_KINDS = ['domeRibs', 'starShards', 'orreryRings'];

/** The Spindle's shaft height (the tallest prop in the game) and its foot's radius (tiles). */
export const SPINDLE = Object.freeze({ shaftH: 12, footR: 1.85, footH: 0.86 });

/** Vesperline's palette: white glass, frost, cyan light, the halos' pale gold, the one warm amber. */
export const VS = {
  glass: '#e4eff5',
  glassMid: '#c7d9e4',
  glassShade: '#9db3c2',
  glassDark: '#5a6f81',
  frame: '#f2f6f9',
  steel: '#8a9cab',
  steelDark: '#3d4b58',
  black: '#18202c',
  snow: '#f1f5f9',
  ice: '#cde4ee',
  icicle: '#e2f2f8',
  cyan: '#5fe1f2',
  holo: '#7ff0ff',
  holoPink: '#ff9ed8',
  halo: '#fff1c4',
  gold: '#d9b45a',
  brass: '#c79a4a',
  red: '#ff4d5a',
  amber: '#ffb347',
  warm: '#ffd9a0',
  violet: '#b9a8ff',
  blossom: '#ffb3cf',
  blossom2: '#ff8fb8',
  frostBloom: '#e2ecf4',
  frostBloom2: '#cddbe8',
  trunk: '#6f5a52',
  trunkFrost: '#8a8e96',
  twig: '#7a6248',
  twigDark: '#5a4632',
  wool: '#8e8e92',
  stone: '#d8dde2',
  stoneShade: '#b4bcc4',
  doorieCoat: '#f4c27a',
  doorieCap: '#e2645a',
  pod: '#eef3f6',
  podBand: '#2ec4e6',
};

const v = (c, type) => c.variant % VESPER_VARIANTS[type];
const swayW = (x, y) => Math.max(0, Math.min(1, (y - 0.25) * 0.9));

function glowPoint(c, x, y, z, color, size = 0.5, flicker = 0.08, extra = null) {
  c.glows.push({ x, y, z, color, size, flicker, ...(extra || {}) });
}

/** Snow on a ledge when the city is frozen (a thin white slab a hair over the top). */
function snowCap(c, w, d, y, x = 0, z = 0) {
  if (c.look.frozen) c.solid.box(w, 0.025, d, { x, y, z, color: VS.snow });
}

/** A few icicles under a ledge when frozen (near LOD only). */
function icicles(c, x0, x1, y, z, n = 3) {
  if (!c.look.frozen || c.lod === 'far') return;
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / n;
    c.solid.cone(0.018, 0.09 + (i % 2) * 0.05, 4, { x, y: y - 0.12 - (i % 2) * 0.05, z, rx: Math.PI, color: VS.icicle });
  }
}

/** A holo panel's flicker: the frozen city's signs stutter, the living city's barely do. */
const holoFlicker = (c) => (c.look.frozen ? 0.55 : 0.08);

/** A halo ring (glow geometry) floating over a point, lying nearly flat. */
function halo(c, x, y, z, r = 0.12) {
  c.glow.torus(r, 0.014, 4, 14, { x, y, z, rx: Math.PI / 2 - 0.25, color: VS.halo });
  glowPoint(c, x, y, z, VS.halo, 0.32, 0.05);
}

export const VESPER_BUILDERS = {
  // ----- the skirt's skyline (far LOD: the mass only) -------------------------------------------
  glassTower(c) {
    // a glass tower (0: a slab, 1: stepped, 2: twin towers with a sky bridge, 3: a slim spire): white
    // frames, glass sides (facade windows), snow on every ledge and icicles when frozen
    const k = v(c, 'glassTower');
    const far = c.lod === 'far';
    const F = c.facade;
    const tower = (x, z, w, h, d) => {
      F.box(x, 0, z, w, h, d, { color: VS.glassMid, side: FK.glass, top: VS.glassShade });
      F.box(x, h, z, w + 0.06, 0.06, d + 0.06, { color: VS.frame });
      snowCap(c, w + 0.04, d + 0.04, h + 0.06, x, z);
    };
    if (k === 0) tower(0, 0, 1.2, 2.6, 1.0);
    else if (k === 1) {
      tower(0, 0, 1.4, 1.6, 1.2);
      tower(0, -0.1, 0.9, 3.0, 0.8);
    } else if (k === 2) {
      tower(-0.42, 0, 0.66, 2.9, 0.8);
      tower(0.46, 0, 0.62, 2.4, 0.8);
      F.box(0, 1.7, 0, 0.36, 0.18, 0.36, { color: VS.frame, side: FK.glass });
    } else {
      tower(0, 0, 0.7, 3.4, 0.7);
      if (!far) c.solid.cone(0.08, 0.6, 6, { y: 3.46, color: VS.frame });
    }
    if (far) return;
    // a halo emblem on the crown, its light out when frozen
    const top = k === 1 ? 3.06 : k === 0 ? 2.66 : k === 2 ? 2.96 : 3.46;
    if (!c.look.frozen) halo(c, 0, top + 0.18, 0, 0.16);
    icicles(c, -0.4, 0.4, top, 0.42, 3);
  },

  // ----- on the board (≤ BOARD_MAX_H) ------------------------------------------------------------
  lectureHall(c) {
    // a low academy hall facing the road (HALL_KINDS): a glass lecture hall in a white frame, an entrance
    // hall under a canopy with the halo emblem, the library block, an observatory annex with a small dome
    const kind = HALL_KINDS[v(c, 'lectureHall')];
    const far = c.lod === 'far';
    const F = c.facade;
    const frozen = !!c.look.frozen;
    if (kind === 'lectureHall') {
      F.box(0, 0, -0.04, 0.86, 0.5, 0.7, { color: VS.glass, side: FK.glass, top: VS.glassShade });
      F.box(0, 0.5, -0.04, 0.9, 0.05, 0.74, { color: VS.frame });
      snowCap(c, 0.86, 0.7, 0.55, 0, -0.04);
      if (far) return;
      for (const x of [-0.43, 0, 0.43]) c.solid.box(0.04, 0.5, 0.04, { x, z: 0.31, color: VS.frame });
      c.solid.box(0.86, 0.04, 0.04, { y: 0.24, z: 0.31, color: VS.frame });
      icicles(c, -0.35, 0.35, 0.55, 0.33, 3);
      return;
    }
    if (kind === 'entranceHall') {
      F.box(0, 0, -0.12, 0.9, 0.56, 0.6, { color: VS.glassMid, side: FK.lobby, top: VS.glassShade });
      F.box(0, 0.56, -0.12, 0.94, 0.05, 0.64, { color: VS.frame });
      snowCap(c, 0.9, 0.6, 0.61, 0, -0.12);
      if (far) return;
      // the canopy over the doors on two slim posts, the halo emblem over the door
      c.solid.box(0.7, 0.03, 0.3, { y: 0.4, z: 0.32, color: VS.frame });
      for (const x of [-0.32, 0.32]) c.solid.box(0.03, 0.4, 0.03, { x, z: 0.45, color: VS.steel });
      snowCap(c, 0.7, 0.3, 0.43, 0, 0.32);
      c.solid.cyl(0.08, 0.08, 0.02, 10, { y: 0.48, z: 0.19, rx: Math.PI / 2, color: VS.gold });
      if (!frozen) glowPoint(c, 0, 0.3, 0.4, VS.warm, 0.4, 0.04);
      return;
    }
    if (kind === 'library') {
      F.box(0, 0, -0.06, 0.82, 0.62, 0.66, { color: VS.frame, side: FK.office, top: VS.glassShade });
      F.box(0, 0.62, -0.06, 0.86, 0.04, 0.7, { color: VS.glassDark });
      snowCap(c, 0.82, 0.66, 0.66, 0, -0.06);
      if (far) return;
      c.solid.box(0.5, 0.16, 0.02, { y: 0.06, z: 0.28, color: VS.glassDark });
      icicles(c, -0.3, 0.3, 0.66, 0.28, 2);
      return;
    }
    // observatoryAnnex: a low block with a small dome on top (its slit a cyan line)
    F.box(0, 0, 0, 0.78, 0.44, 0.7, { color: VS.glass, side: FK.office, top: VS.glassShade });
    c.solid.sphere(0.26, far ? 8 : 12, far ? 4 : 6, { y: 0.44, sy: 0.9, color: frozen ? VS.snow : VS.frame });
    if (far) return;
    c.glow.box(0.03, 0.2, 0.012, { y: 0.56, z: 0.22, rx: -0.5, color: VS.cyan });
  },

  podium(c) {
    // a lecture podium in a courtyard (0: three wide steps with a lectern, 1: a podium with a holo screen,
    // 2: tiers of seating round a low stage): low and wide, readable as a platform
    const k = v(c, 'podium');
    const far = c.lod === 'far';
    for (let i = 0; i < 3; i++) c.solid.box(0.9 - i * 0.18, 0.08, 0.8 - i * 0.16, { y: i * 0.08, z: -0.04 * i, color: i % 2 ? VS.glassMid : VS.glass });
    snowCap(c, 0.54, 0.48, 0.24, 0, -0.08);
    if (far) return;
    if (k === 0) {
      c.solid.box(0.12, 0.26, 0.1, { y: 0.24, z: 0.02, color: VS.frame });
      c.solid.box(0.16, 0.02, 0.12, { y: 0.5, z: 0.0, rx: -0.3, color: VS.glassDark });
      halo(c, 0, 0.66, -0.06, 0.1);
      return;
    }
    if (k === 1) {
      for (const x of [-0.24, 0.24]) c.solid.box(0.03, 0.5, 0.03, { x, y: 0.24, z: -0.22, color: VS.steel });
      c.solid.box(0.52, 0.28, 0.02, { y: 0.44, z: -0.22, color: VS.black });
      c.glow.box(0.46, 0.22, 0.01, { y: 0.47, z: -0.205, color: VS.holo });
      glowPoint(c, 0, 0.58, -0.16, VS.holo, 0.42, holoFlicker(c));
      return;
    }
    for (let i = 0; i < 3; i++) c.solid.torus(0.36 + i * 0.08, 0.035, 3, 10, { y: 0.26 + i * 0.07, z: -0.04, rx: Math.PI / 2, arc: Math.PI, rz: 0, color: i % 2 ? VS.glass : VS.glassMid });
  },

  holoSign(c) {
    // a holo sign (HOLO_KINDS): the lane lamp (a slim white post, a small holo plate at its head: the kit's
    // lamps along the lanes), a holo billboard on two posts, an arrow kiosk, a dead sign (its frame only,
    // cracked: no light). Frozen, the lit ones stutter (their sprites flicker hard) and dim in a blackout.
    const kind = HOLO_KINDS[v(c, 'holoSign')];
    const fl = holoFlicker(c);
    c.solid.box(0.12, 0.03, 0.12, { color: VS.steelDark });
    if (kind === 'laneLamp') {
      c.solid.cyl(0.016, 0.024, 1.0, 6, { y: 0.03, color: VS.frame });
      c.solid.box(0.016, 0.016, 0.26, { y: 1.02, z: 0.11, color: VS.frame });
      c.glow.box(0.12, 0.012, 0.14, { y: 1.0, z: 0.23, color: VS.holo });
      c.glow.box(0.16, 0.1, 0.008, { y: 0.7, z: 0.02, color: c.variant % 2 ? VS.holoPink : VS.holo });
      glowPoint(c, 0, 0.98, 0.23, VS.holo, 0.5, fl);
      return;
    }
    if (kind === 'billboard') {
      for (const x of [-0.3, 0.3]) c.solid.box(0.03, 0.72, 0.03, { x, y: 0.03, color: VS.steel });
      c.solid.box(0.66, 0.36, 0.02, { y: 0.56, color: VS.black });
      c.glow.box(0.6, 0.3, 0.008, { y: 0.59, z: 0.012, color: VS.holoPink });
      c.glow.box(0.42, 0.04, 0.01, { y: 0.66, z: 0.018, color: VS.holo });
      glowPoint(c, 0, 0.74, 0.08, VS.holoPink, 0.56, fl);
      return;
    }
    if (kind === 'arrowKiosk') {
      c.solid.box(0.18, 0.5, 0.14, { y: 0.03, color: VS.frame });
      c.glow.box(0.14, 0.05, 0.01, { y: 0.4, z: 0.075, color: VS.holo });
      c.glow.cone(0.06, 0.08, 3, { x: 0.1, y: 0.4, z: 0.075, rz: -Math.PI / 2, color: VS.holo });
      glowPoint(c, 0, 0.44, 0.12, VS.holo, 0.36, fl);
      return;
    }
    // deadSign: the frame of a holo board, cracked across, its glass dark
    for (const x of [-0.26, 0.26]) c.solid.box(0.03, 0.62, 0.03, { x, y: 0.03, color: VS.steel });
    c.solid.box(0.56, 0.3, 0.02, { y: 0.44, color: VS.glassDark });
    c.solid.box(0.5, 0.012, 0.024, { y: 0.6, rz: 0.4, color: VS.glassShade });
    snowCap(c, 0.58, 0.04, 0.74);
  },

  haloStatue(c) {
    // a halo statue (0: a guardian figure, robed and faceless, on a plinth, a halo floating over its head;
    // 1: the empty plinth, only the halo left hovering). Halos on every statue: the city's emblem
    const k = v(c, 'haloStatue');
    const stone = c.look.frozen ? VS.stoneShade : VS.stone;
    c.solid.box(0.4, 0.22, 0.4, { color: VS.glassShade });
    c.solid.box(0.44, 0.04, 0.44, { y: 0.22, color: VS.frame });
    snowCap(c, 0.42, 0.42, 0.26);
    if (k === 0) {
      c.solid.cyl(0.1, 0.16, 0.42, 8, { y: 0.26, color: stone });
      c.solid.sphere(0.09, 8, 6, { y: 0.76, color: stone });
      if (c.look.frozen) c.solid.sphere(0.08, 6, 4, { y: 0.8, sy: 0.4, color: VS.snow });
      halo(c, 0, 0.94, 0, 0.11);
      return;
    }
    halo(c, 0, 0.62, 0, 0.13);
  },

  courtyardTree(c) {
    // a cherry tree in its glass courtyard (a low glass planter box, a white frame): pink by day in the
    // living city, its crown frosted white with icicles when frozen (0-2: crown sizes)
    const k = v(c, 'courtyardTree');
    const far = c.lod === 'far';
    const frozen = !!c.look.frozen;
    c.solid.box(0.62, 0.1, 0.62, { color: VS.glassMid });
    if (!far) for (const [x, z] of [[-0.31, -0.31], [0.31, -0.31], [-0.31, 0.31], [0.31, 0.31]]) c.solid.box(0.03, 0.16, 0.03, { x, z, color: VS.frame });
    c.solid.cyl(0.04, 0.06, 0.5 + k * 0.08, 5, { y: 0.1, color: frozen ? VS.trunkFrost : VS.trunk });
    const top = 0.6 + k * 0.08;
    const [a, b] = frozen ? [VS.frostBloom, VS.frostBloom2] : [VS.blossom, VS.blossom2];
    const r = 0.26 + k * 0.03;
    c.foliage.blob(r, { y: top, detail: far ? 0 : 1, wobble: 0.22, jitter: 0.06, rand: c.rand, color: a, attrs: { sway: swayW } });
    if (!far) {
      c.foliage.blob(r * 0.66, { x: 0.16, y: top - 0.06, z: 0.08, detail: 0, wobble: 0.2, rand: c.rand, color: b, attrs: { sway: swayW } });
      c.foliage.blob(r * 0.6, { x: -0.15, y: top - 0.04, z: -0.06, detail: 0, wobble: 0.2, rand: c.rand, color: b, attrs: { sway: swayW } });
    }
    if (frozen && !far) for (let i = 0; i < 3; i++) c.solid.cone(0.02, 0.1, 4, { x: -0.12 + i * 0.12, y: top - r - 0.06, z: 0.1, rx: Math.PI, color: VS.icicle });
  },

  frozenFountain(c) {
    // a courtyard fountain (0: a round basin, 1: two tiers): its jets ice spikes when frozen, pale water and
    // thin jets in the living city
    const k = v(c, 'frozenFountain');
    const far = c.lod === 'far';
    const frozen = !!c.look.frozen;
    c.solid.cyl(0.4, 0.42, 0.12, far ? 10 : 16, { color: VS.glassMid });
    c.solid.cyl(0.36, 0.36, 0.01, far ? 10 : 16, { y: 0.11, color: frozen ? VS.ice : '#8fc8e4' });
    if (k === 1) {
      c.solid.cyl(0.06, 0.08, 0.3, 8, { y: 0.12, color: VS.frame });
      c.solid.cyl(0.2, 0.22, 0.06, 12, { y: 0.4, color: VS.glassMid });
    }
    if (far) return;
    const y0 = k === 1 ? 0.46 : 0.12;
    if (frozen) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        c.solid.cone(0.04, 0.22 + (i % 2) * 0.1, 4, { x: Math.cos(a) * 0.1, y: y0, z: Math.sin(a) * 0.1, rx: Math.sin(a) * 0.4, rz: -Math.cos(a) * 0.4, color: VS.icicle });
      }
      c.solid.cone(0.05, 0.36, 5, { y: y0, color: VS.ice });
      return;
    }
    c.solid.cyl(0.015, 0.02, 0.3, 5, { y: y0, color: '#cfeaf6' });
    c.emitters.push({ kind: 'steam', x: 0, y: y0 + 0.3, z: 0 });
  },

  frostedPane(c) {
    // the border: frosted glass panes in a white steel frame (0: plain, 1: with a cyan holo strip, 2: cracked,
    // 3: a low pane over a planter); low (≤ 0.8) so the board behind reads
    const k = v(c, 'frostedPane');
    const h = k === 3 ? 0.36 : 0.62;
    c.solid.box(1.0, 0.06, 0.2, { color: VS.steelDark });
    c.solid.box(0.96, h, 0.05, { y: 0.06, color: VS.glassShade });
    for (const x of [-0.48, 0.48]) c.solid.box(0.04, h + 0.04, 0.08, { x, y: 0.06, color: VS.frame });
    c.solid.box(1.0, 0.04, 0.08, { y: h + 0.06, color: VS.frame });
    snowCap(c, 1.0, 0.1, h + 0.1);
    if (k === 1) c.glow.box(0.9, 0.035, 0.012, { y: h * 0.62, z: 0.03, color: VS.cyan });
    if (k === 2) {
      c.solid.box(0.6, 0.012, 0.06, { y: h * 0.5, rz: 0.5, color: VS.frame });
      c.solid.box(0.4, 0.012, 0.06, { x: 0.2, y: h * 0.4, rz: -0.7, color: VS.frame });
    }
    if (k === 3) c.solid.box(0.9, 0.08, 0.2, { y: 0.06, z: 0.1, color: c.look.frozen ? VS.snow : '#7fb86c' });
  },

  // ----- set pieces ---------------------------------------------------------------------------------
  doorieStatue(c) {
    // Doorie (the city's mascot, GATE_ARC §12): a round, faceless cartoon girl on a plinth, a round head under
    // a little cap, a bell-shaped coat, one stubby arm holding up a lantern, a keychain cast at her belt.
    // Mascot-simple: no face, no body detail. Weathered pale stone in the frozen museum (snow on her cap,
    // her lantern dark); painted in the living city (her lantern lit warm).
    const frozen = !!c.look.frozen;
    const coat = frozen ? VS.stone : VS.doorieCoat;
    const cap = frozen ? VS.stoneShade : VS.doorieCap;
    const skin = frozen ? VS.stone : '#ffe6cf';
    c.solid.cyl(0.34, 0.38, 0.16, 12, { color: VS.glassShade });
    c.solid.cyl(0.36, 0.36, 0.03, 12, { y: 0.16, color: VS.frame });
    c.solid.cone(0.24, 0.42, 12, { y: 0.19, color: coat });
    c.solid.cyl(0.12, 0.2, 0.06, 10, { y: 0.19, color: coat });
    c.solid.sphere(0.17, 12, 8, { y: 0.7, color: skin });
    c.solid.sphere(0.175, 12, 6, { y: 0.74, sy: 0.62, color: cap });
    c.solid.sphere(0.04, 6, 4, { y: 0.9, color: cap });
    // the arm up to the lantern's pole, the lantern
    c.solid.cyl(0.035, 0.035, 0.2, 6, { x: 0.18, y: 0.42, z: 0.04, rz: -0.8, color: coat });
    c.solid.box(0.016, 0.34, 0.016, { x: 0.3, y: 0.42, z: 0.06, color: VS.steelDark });
    c.solid.box(0.12, 0.016, 0.016, { x: 0.36, y: 0.76, z: 0.06, color: VS.steelDark });
    c.solid.box(0.1, 0.02, 0.1, { x: 0.42, y: 0.66, z: 0.06, color: VS.steelDark });
    if (frozen) c.solid.box(0.08, 0.1, 0.08, { x: 0.42, y: 0.56, z: 0.06, color: VS.stoneShade });
    else {
      c.glow.box(0.08, 0.1, 0.08, { x: 0.42, y: 0.56, z: 0.06, color: VS.warm });
      glowPoint(c, 0.42, 0.6, 0.12, VS.amber, 0.45, 0.08);
    }
    // the keychain cast at her belt: a ring and a little round charm
    c.solid.torus(0.035, 0.008, 4, 10, { x: -0.1, y: 0.36, z: 0.19, color: frozen ? VS.stoneShade : VS.gold });
    c.solid.sphere(0.028, 6, 4, { x: -0.1, y: 0.31, z: 0.2, color: frozen ? VS.stoneShade : VS.blossom2 });
    if (frozen) {
      c.solid.sphere(0.13, 8, 4, { y: 0.82, sy: 0.35, color: VS.snow });
      c.solid.cyl(0.3, 0.34, 0.02, 12, { y: 0.19, color: VS.snow });
    }
  },

  doorieBus(c) {
    // the little Doorie bus (0: standing where it stopped, snowed over when frozen; 1: tipped on its side):
    // a round-nosed white bus with the cap-red band and a round lantern emblem on its side (no face)
    const tipped = v(c, 'doorieBus') === 1;
    const far = c.lod === 'far';
    const F = c.facade;
    const rz = tipped ? Math.PI / 2 - 0.08 : 0;
    const y0 = tipped ? 0.0 : 0.06;
    const x0 = tipped ? 0.16 : 0;
    F.box(x0, y0, 0, 0.34, 0.32, 0.86, { rz, color: '#f6f2ea', side: FK.office });
    F.box(x0, y0 + (tipped ? 0 : 0.2), 0, tipped ? 0.34 : 0.344, 0.05, 0.864, { rz, color: VS.doorieCap, noTop: true });
    if (!tipped) F.box(0, 0.38, 0.02, 0.3, 0.04, 0.78, { color: c.look.frozen ? VS.snow : '#eae4d8' });
    if (far) return;
    if (!tipped) {
      for (const z of [-0.28, 0.28]) for (const x of [-0.17, 0.17]) c.solid.cyl(0.06, 0.06, 0.04, 8, { x, y: 0.06, z, rz: Math.PI / 2, color: VS.black });
      c.solid.cyl(0.07, 0.07, 0.01, 10, { x: 0.176, y: 0.18, z: 0.12, rz: Math.PI / 2, color: VS.gold });
    }
    snowCap(c, 0.32, 0.8, tipped ? 0.36 : 0.42, x0);
  },

  prismBattery(c) {
    // a prism battery round a relay pad (prism_conduits; slot 'pad'): a low steel ring on the pad's rim and
    // three charged prisms on it (white glass, a cyan core), cables between; the middle stays clear for the girl
    const R = 0.78;
    c.solid.torus(R, 0.035, 3, 18, { y: 0.02, rx: Math.PI / 2, color: VS.steelDark });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const x = Math.cos(a) * (R + 0.06);
      const z = Math.sin(a) * (R + 0.06);
      c.solid.cyl(0.08, 0.1, 0.06, 6, { x, z, color: VS.steel });
      c.solid.cone(0.07, 0.42, 4, { x, y: 0.06, z, ry: a, color: VS.glass });
      c.glow.cone(0.03, 0.36, 4, { x, y: 0.07, z, ry: a + 0.4, color: VS.cyan });
      glowPoint(c, x, 0.3, z, VS.cyan, 0.42, 0.1);
    }
    if (c.look.frozen) for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
      c.solid.box(0.18, 0.02, 0.08, { x: Math.cos(a) * (R + 0.04), y: 0.02, z: Math.sin(a) * (R + 0.04), ry: -a, color: VS.snow });
    }
  },

  transitPad(c) {
    // a transit pad's floor ring (dressing; the rule's pads are drawn on the road by ruleDecals): a steel ring
    // with a cyan light inset (1: broken, half its light out, sparks now and then)
    const broken = v(c, 'transitPad') === 1;
    c.solid.cyl(0.62, 0.66, 0.04, 16, { color: VS.steelDark });
    c.solid.cyl(0.5, 0.5, 0.012, 16, { y: 0.04, color: VS.glassDark });
    c.glow.torus(0.56, 0.02, 3, broken ? 8 : 18, { y: 0.05, rx: Math.PI / 2, arc: broken ? Math.PI : Math.PI * 2, color: VS.cyan });
    glowPoint(c, 0, 0.12, 0, VS.cyan, broken ? 0.4 : 0.6, broken ? 0.5 : 0.08);
    if (broken) {
      c.solid.box(0.4, 0.02, 0.05, { y: 0.045, rz: 0, ry: 0.7, color: VS.glassShade });
      c.emitters.push({ kind: 'sparkle', x: 0.3, y: 0.08, z: 0.2, color: VS.holo });
    }
  },

  vesperTerminal(c) {
    // the gate's terminal (0: a bay of the terminal's ring hall: white arches over a dark doorway, a glass
    // roof; 1: the terminal console: a dark screen, red bars still glowing on it)
    const k = v(c, 'vesperTerminal');
    const far = c.lod === 'far';
    const F = c.facade;
    if (k === 0) {
      F.box(0, 0, 0, 1.6, 0.9, 0.9, { color: VS.glass, side: FK.lobby, top: VS.glassShade });
      F.box(0, 0.9, 0, 1.66, 0.06, 0.96, { color: VS.frame });
      snowCap(c, 1.6, 0.9, 0.96);
      if (far) return;
      for (const x of [-0.54, 0, 0.54]) c.solid.torus(0.22, 0.03, 3, 8, { x, y: 0.4, z: 0.46, arc: Math.PI, color: VS.frame });
      icicles(c, -0.7, 0.7, 0.96, 0.46, 4);
      return;
    }
    c.solid.box(0.42, 0.42, 0.16, { color: VS.frame });
    c.solid.box(0.38, 0.26, 0.02, { y: 0.24, z: 0.09, rx: -0.2, color: VS.black });
    for (let i = 0; i < 3; i++) c.glow.box(0.28 - i * 0.06, 0.03, 0.008, { y: 0.32 + i * 0.05, z: 0.1, rx: -0.2, color: VS.red });
    glowPoint(c, 0, 0.36, 0.18, VS.red, 0.4, 0.2);
    snowCap(c, 0.42, 0.16, 0.42);
  },

  spindle(c) {
    // the Spindle, the white tower (SPINDLE_PARTS). 0, the foot on the board (decor with `r`: it draws its
    // own tiles): a broad white drum with glass bands and a dark door, the shaft's base rising out of it,
    // low enough (≤ SPINDLE.footH) to keep the board behind it readable. 1, the shaft in the skirt behind the
    // board (SCENERY 'spindleFoot', slot 'spire'): the tallest prop in the game, white, ringed, cracked, a
    // pale light at its top; far LOD (a handful of cylinders)
    const part = SPINDLE_PARTS[v(c, 'spindle')];
    const far = c.lod === 'far';
    if (part === 'foot') {
      const R = SPINDLE.footR;
      c.solid.cyl(R, R + 0.08, 0.36, 24, { color: VS.glass });
      c.solid.cyl(R + 0.02, R + 0.02, 0.05, 24, { y: 0.36, color: VS.frame });
      c.solid.cyl(R * 0.72, R * 0.8, 0.3, 20, { y: 0.41, color: VS.glassMid });
      c.solid.cyl(0.9, 0.98, SPINDLE.footH - 0.71, 16, { y: 0.71, color: VS.frame });
      if (c.look.frozen) c.solid.cyl(R * 0.98, R * 0.98, 0.02, 24, { y: 0.41, color: VS.snow });
      if (far) return;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        c.solid.box(0.14, 0.3, 0.02, { x: Math.cos(a) * (R + 0.075), y: 0.03, z: Math.sin(a) * (R + 0.075), ry: -a + Math.PI / 2, color: VS.glassDark });
      }
      // the door (south, toward the camera) and a band of cyan light round the shaft's base
      c.solid.box(0.4, 0.32, 0.04, { y: 0.0, z: R + 0.09, color: VS.black });
      c.glow.torus(0.92, 0.016, 3, 20, { y: 0.74, rx: Math.PI / 2, color: VS.cyan });
      glowPoint(c, 0, 0.8, 0.9, VS.cyan, 0.6, 0.06);
      return;
    }
    const H = SPINDLE.shaftH;
    c.solid.cyl(0.62, 0.95, H, far ? 10 : 14, { color: VS.frame });
    for (let i = 1; i < 6; i++) c.solid.cyl(0.95 - i * 0.055, 0.95 - i * 0.055, 0.08, far ? 10 : 14, { y: i * (H / 6), color: VS.glassShade });
    c.solid.cone(0.62, 1.1, far ? 10 : 14, { y: H, color: VS.glass });
    // a long crack down its face (the side toward the board)
    c.solid.box(0.04, H * 0.4, 0.02, { y: H * 0.35, z: 0.84, rz: 0.06, color: VS.glassDark });
    c.glow.sphere(0.12, 8, 6, { y: H + 1.1, color: VS.halo });
    glowPoint(c, 0, H + 1.1, 0, VS.halo, 1.4, 0.05);
  },

  frozenNest(c) {
    // a nest, frozen into the ice at the Spindle's foot (6-10): the shipped nest's woven ring made far too big
    // for any bird, crusted with ice, icicles hanging off its rim; empty
    c.solid.cyl(1.1, 1.2, 0.04, 16, { color: VS.ice });
    c.solid.torus(0.78, 0.26, 5, 14, { y: 0.24, rx: Math.PI / 2, color: VS.twig, jitter: 0.12, rand: c.rand });
    c.solid.torus(0.62, 0.12, 4, 12, { y: 0.4, rx: Math.PI / 2, color: VS.twigDark, jitter: 0.12, rand: c.rand });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      c.solid.sphere(0.2, 6, 4, { x: Math.cos(a) * 0.8, y: 0.42, z: Math.sin(a) * 0.8, sy: 0.4, color: VS.snow });
    }
    if (c.lod === 'far') return;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      c.solid.cone(0.04, 0.2, 4, { x: Math.cos(a) * 1.0, y: 0.08, z: Math.sin(a) * 1.0, rx: Math.PI, color: VS.icicle });
    }
    c.solid.cyl(0.5, 0.5, 0.02, 12, { y: 0.18, color: VS.ice });
  },

  greyWool(c) {
    // one thread of grey knitted wool caught in the ice (6-10 only; small on purpose): a cracked slab of ice
    // and the thread lying across it in a loose zigzag
    c.solid.box(0.38, 0.05, 0.26, { ry: 0.3, color: VS.ice });
    c.solid.box(0.3, 0.008, 0.012, { y: 0.05, ry: 0.3, color: VS.glassShade });
    const pts = [[-0.14, -0.04], [-0.06, 0.04], [0.02, -0.03], [0.1, 0.05], [0.16, -0.01]];
    for (let i = 1; i < pts.length; i++) {
      const [x0, z0] = pts[i - 1];
      const [x1, z1] = pts[i];
      const len = Math.hypot(x1 - x0, z1 - z0);
      c.solid.box(len + 0.01, 0.012, 0.012, { x: (x0 + x1) / 2, y: 0.052, z: (z0 + z1) / 2, ry: -Math.atan2(z1 - z0, x1 - x0) + 0.3, color: VS.wool });
    }
  },

  stationCanopy(c) {
    // a sky-rail station canopy (0: a long glass canopy on slim posts with a holo route sign; 1: the canopy
    // fallen at one end, its sign dead)
    const fallen = v(c, 'stationCanopy') === 1;
    for (const x of [-0.6, 0.6]) c.solid.box(0.04, fallen && x > 0 ? 0.3 : 0.74, 0.04, { x, z: -0.2, color: VS.steel });
    c.solid.box(1.5, 0.04, 0.6, { y: 0.74, rz: fallen ? 0.36 : 0, color: VS.glassMid });
    c.solid.box(1.5, 0.05, 0.04, { y: 0.71, z: 0.3, rz: fallen ? 0.36 : 0, color: VS.frame });
    snowCap(c, 1.4, 0.56, fallen ? 0.78 : 0.78);
    c.solid.box(0.9, 0.06, 0.3, { y: 0.0, z: -0.2, color: VS.glassShade });
    if (fallen) return;
    c.solid.box(0.36, 0.14, 0.02, { y: 0.52, z: 0.3, color: VS.black });
    c.glow.box(0.32, 0.1, 0.008, { y: 0.54, z: 0.312, color: VS.holo });
    glowPoint(c, 0, 0.6, 0.36, VS.holo, 0.4, holoFlicker(c));
  },

  skyRailPod(c) {
    // a sky-rail pod (0: left hanging at a broken end of the old rail: a white pylon, a girder stub with a
    // jagged end, the pod hung under it on its bogie, a red marker lamp; 1: a pod fallen on its side, its
    // windows dark, snow drifted against it)
    const fallen = v(c, 'skyRailPod') === 1;
    const far = c.lod === 'far';
    const F = c.facade;
    if (fallen) {
      F.box(0, 0, 0, 0.42, 0.34, 0.9, { rz: Math.PI / 2 - 0.1, x: 0.17, color: VS.pod, side: FK.office });
      F.box(0.19, 0.0, 0, 0.06, 0.34, 0.904, { rz: Math.PI / 2 - 0.1, color: VS.podBand, noTop: true });
      if (!far && c.look.frozen) c.solid.sphere(0.24, 6, 4, { x: -0.2, y: 0.02, z: 0.2, sy: 0.5, color: VS.snow });
      return;
    }
    c.solid.cyl(0.1, 0.14, 1.32, 8, { color: VS.frame });
    c.solid.box(0.3, 0.14, 1.5, { y: 1.3, z: 0.45, color: VS.glassMid });
    c.solid.box(0.26, 0.04, 1.46, { y: 1.26, z: 0.45, color: VS.glassDark });
    snowCap(c, 0.28, 1.4, 1.44, 0, 0.45);
    if (!far) for (let i = 0; i < 3; i++) c.solid.cone(0.06, 0.16 + i * 0.05, 4, { x: -0.1 + i * 0.1, y: 1.24, z: 1.2, rx: -Math.PI / 2, color: VS.glassMid });
    // the hanger and the pod, swung a little
    c.solid.box(0.04, 0.24, 0.04, { y: 1.02, z: 0.95, color: VS.steelDark });
    F.box(0, 0.62, 0.95, 0.36, 0.42, 0.62, { rx: 0.12, color: VS.pod, side: FK.office });
    F.box(0, 0.78, 0.95, 0.364, 0.05, 0.624, { rx: 0.12, color: VS.podBand, noTop: true });
    if (far) return;
    c.glow.sphere(0.03, 6, 4, { y: 0.6, z: 1.27, color: '#ff8088' });
    glowPoint(c, 0, 0.6, 1.3, VS.red, 0.36, 0.3);
  },

  starDome(c) {
    // the observatory deck (the side map, STAR_DOME_KINDS): 0 the cracked dome's ribs (white arcs, two of them
    // broken off short), 1 shards of the star map lying in the snow (dark glass, star points of light), 2 the
    // orrery's brass rings, nested and tilted
    const k = STAR_DOME_KINDS[v(c, 'starDome')];
    const far = c.lod === 'far';
    if (k === 'domeRibs') {
      for (let i = 0; i < 5; i++) {
        const arc = i === 1 || i === 3 ? Math.PI * 0.55 : Math.PI;
        c.solid.torus(1.1, 0.05, 3, far ? 8 : 14, { y: 0, ry: (i / 5) * Math.PI, arc, color: VS.frame });
      }
      c.solid.torus(1.1, 0.06, 3, far ? 10 : 18, { y: 0.02, rx: Math.PI / 2, color: VS.glassShade });
      snowCap(c, 0.4, 0.4, 1.12);
      return;
    }
    if (k === 'starShards') {
      for (let i = 0; i < 4; i++) {
        const a = i * 1.7;
        c.solid.box(0.34 - i * 0.04, 0.03, 0.24, { x: Math.cos(a) * 0.3, y: 0.01 + i * 0.012, z: Math.sin(a) * 0.24, ry: a, rx: 0.12, color: '#1f2a44' });
        c.glow.sphere(0.02, 4, 3, { x: Math.cos(a) * 0.3 + 0.05, y: 0.06, z: Math.sin(a) * 0.24, color: VS.halo });
      }
      glowPoint(c, 0, 0.1, 0, '#cfe6ff', 0.4, 0.3);
      return;
    }
    // orreryRings
    c.solid.cyl(0.1, 0.16, 0.5, 8, { color: VS.brass });
    for (let i = 0; i < 3; i++) c.solid.torus(0.36 + i * 0.16, 0.025, 3, far ? 10 : 16, { y: 0.66, rx: 0.4 + i * 0.5, ry: i * 0.8, color: i % 2 ? VS.gold : VS.brass });
    c.solid.sphere(0.08, 8, 6, { y: 0.66, color: VS.halo });
  },
};

/**
 * The cleaning robot that still circles the plaza (scenery 'cleaningRobot', the city kit's one instanced mover
 * on a vesper board): a round white body on a dark skirt, a cyan visor band, a spinning brush in front.
 * Facade geometry (the kit's movers share the facade material).
 * @param {import('./cityMaterials.js').CityAcc} acc
 */
export function cleaningRobotGeometry(acc) {
  acc.box(0, 0, 0, 0.3, 0.05, 0.3, { color: VS.steelDark });
  acc.box(0, 0.05, 0, 0.26, 0.14, 0.26, { color: VS.pod });
  acc.box(0, 0.13, 0.131, 0.2, 0.03, 0.01, { color: VS.cyan, noTop: true });
  acc.box(0, 0.19, 0, 0.18, 0.03, 0.18, { color: VS.frame });
  acc.box(0, 0, 0.17, 0.24, 0.03, 0.06, { color: '#4a90a8' });
  return acc.build();
}

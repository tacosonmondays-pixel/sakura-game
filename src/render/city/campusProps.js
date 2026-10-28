// Campus kit (Gate Arc, Noon `campus` theme: Itomachi Hilltop High at night, by the lake): the
// school buildings and the grounds' set pieces as ordinary prop builders (props.js BUILDERS), on
// the city kit's materials. Buildings bake into the `facade` accumulator (cityMaterials.js: the
// classroom windows, gym slots and club-hut windows are drawn by the facade shader and light up
// warm at night); small things into `solid` / `foliage`; what must shine (the clock face, the
// scoreboard digits, lamp heads) into `glow`, plus glow sprites. Props are cached per (type, theme,
// day/night, variant, LOD) and merged into the terrain's shared meshes: no extra draw call.
//
// Every builder keeps to CAMPUS_VARIANTS[type] variants (≤ 6, `c.variant % n`) and to a triangle
// cap (tests/render/cityKit.test.js). Nothing here is transparent. The searchlight's beam and the
// spot it sweeps over the water are ground quads drawn by the ambient layer (ambient.js: 0 calls).
//
// Local frame: origin = tile centre on the ground, +y up, +z = the front (the road side).
import * as THREE from 'three';
import { FK } from './cityMaterials.js';
import { PAL, parapet, gable, prim } from './buildings.js';

/** Variants per builder (`c.variant % n`); the kit and the tests read this. */
export const CAMPUS_VARIANTS = {
  schoolBlock: 6, flowerBoxes: 2, bikeShed: 2, flagpole: 1, goalPosts: 1, scoreboard: 1, finishGantry: 1,
  boatRack: 2, oldLamp: 1, searchlight: 2, clubHut: 3,
};

/** schoolBlock variant → building (GATE_ARC §18.3 `schoolBlock`). */
export const SCHOOL_KINDS = ['classroomWing', 'stairWing', 'gym', 'clockTower', 'clubHut', 'tallWing'];
/** The schoolBlock variants low enough to stand on the board (≤ buildings.BOARD_MAX_H); the rest are skirt only. */
export const SCHOOL_ON_BOARD = [0, 1, 2, 4];
/** clubHut variant → club (MAPS §1.3: art, science, handicraft). */
export const CLUB_KINDS = ['art', 'science', 'handicraft'];

/** Hilltop's palette: cream walls, the navy school band, pale roofs, warm timber. */
export const CAMPUS = {
  wall: '#efe6d6',
  wall2: '#e6dccb',
  band: '#3d5a8a',
  roof: '#c9c4bb',
  roofTile: '#6f8fa8',
  trim: '#f7f4ee',
  timber: '#a87a52',
  timberDark: '#7d5a3c',
  iron: '#3a3d46',
};

const v = (c, type) => c.variant % CAMPUS_VARIANTS[type];

function glowPoint(c, x, y, z, color, size = 0.6, flicker = 0.1) {
  c.glows.push({ x, y, z, color, size, flicker });
}

/** Low flower blobs (icosahedra, detail 0) along a box top. */
function blossoms(c, n, w, y, z, cols) {
  for (let i = 0; i < n; i++) {
    c.foliage.blob(0.055, { x: -w / 2 + (w * (i + 0.5)) / n, y, z, sy: 0.8, color: cols[i % cols.length], attrs: { sway: () => 0.15 } });
  }
}

/** A classroom wing: two floors of big framed windows, the navy band, a flat roof with a parapet. */
function wing(c, { w = 0.94, d = 0.84, floors = 2, tone = 0, far = false } = {}) {
  const F = c.facade;
  const H = floors * 0.38;
  const wall = tone ? CAMPUS.wall2 : CAMPUS.wall;
  F.box(0, 0, 0, w, H, d, { color: wall, side: FK.school });
  // the school band under the roof and a pale plinth
  F.box(0, H - 0.05, 0, w + 0.012, 0.05, d + 0.012, { color: CAMPUS.band, noTop: true });
  F.box(0, 0, 0, w + 0.012, 0.04, d + 0.012, { color: '#cfc6b6', noTop: true });
  F.box(0, H, 0, w + 0.03, 0.025, d + 0.03, { color: CAMPUS.trim });
  if (far) return H + 0.025;
  parapet(F, w + 0.03, d + 0.03, H + 0.025, CAMPUS.trim, 0.03, 0.04);
  F.box(0, H + 0.025, 0, w - 0.04, 0.01, d - 0.04, { color: CAMPUS.roof });
  return H + 0.065;
}

export const CAMPUS_BUILDERS = {
  // ----- the school buildings ---------------------------------------------------------------
  schoolBlock(c) {
    const k = v(c, 'schoolBlock');
    const F = c.facade;
    const far = c.lod === 'far';
    if (k === 0) {
      // classroom wing: two floors, an AC unit on the roof
      const top = wing(c, { far });
      if (!far) F.box(-0.24, top - 0.04, -0.16, 0.16, 0.08, 0.12, { color: '#e9e6df' });
    } else if (k === 1) {
      // classroom wing with a stair core at one end and flower boxes along the front parapet
      const top = wing(c, { w: 0.94, tone: 1, far });
      F.box(0.33, 0, -0.18, 0.26, 0.86, 0.3, { color: '#ddd4c2', side: FK.plain });
      if (!far) {
        c.solid.box(0.5, 0.06, 0.08, { x: -0.18, y: top - 0.04, z: 0.37, color: PAL.terracotta });
        blossoms(c, 4, 0.48, top + 0.02, 0.37, ['#ff9ec4', '#ffe680', '#ffffff', '#ff9ec4']);
      }
    } else if (k === 2) {
      // the gym (Shelter 3): a tall hall with window slots, a low arched roof and the shelter banner
      F.box(0, 0, 0, 0.96, 0.62, 0.9, { color: '#e8e0d0', side: FK.gym });
      F.box(0, 0, 0, 0.97, 0.05, 0.91, { color: '#cfc6b6', noTop: true });
      gable(F, 0.62, 1.02, 0.96, 0.2, CAMPUS.roofTile);
      if (!far) {
        // the banner on the front: a pale cloth with a pink band and the shelter's heart
        c.solid.box(0.56, 0.14, 0.012, { y: 0.4, z: 0.456, color: '#f7f4ee' });
        c.solid.box(0.56, 0.03, 0.014, { y: 0.4, z: 0.457, color: '#ff7aa2' });
        c.glow.sphere(0.03, 6, 4, { x: -0.2, y: 0.47, z: 0.465, color: '#ff7aa2' });
      }
    } else if (k === 3) {
      // the clock tower (skirt only): a slim tower, four lit clock faces, a pyramid roof
      F.box(0, 0, 0, 0.62, 0.06, 0.62, { color: '#cfc6b6' });
      F.box(0, 0.06, 0, 0.46, 1.3, 0.46, { color: CAMPUS.wall, side: FK.school, v0: -0.06 });
      F.box(0, 1.3, 0, 0.5, 0.05, 0.5, { color: CAMPUS.band, noTop: true });
      F.box(0, 1.36, 0, 0.54, 0.04, 0.54, { color: CAMPUS.trim });
      F.box(0, 1.4, 0, 0.48, 0.36, 0.48, { color: CAMPUS.wall2 });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const sx = Math.sin(a);
        const sz = Math.cos(a);
        // a lit face (unlit glow geometry: it reads at night) and its two hands
        c.glow.add(new THREE.CircleGeometry(0.14, far ? 8 : 12), { x: sx * 0.243, y: 1.58, z: sz * 0.243, ry: a, color: '#fff3d0' });
        if (!far) {
          c.solid.box(0.016, 0.1, 0.008, { x: sx * 0.25, y: 1.58, z: sz * 0.25, ry: a, color: CAMPUS.iron });
          c.solid.box(0.07, 0.016, 0.008, { x: sx * 0.25 + Math.cos(a) * 0.03, y: 1.572, z: sz * 0.25 - Math.sin(a) * 0.03, ry: a, color: CAMPUS.iron });
        }
      }
      prim(F, new THREE.ConeGeometry(0.4, 0.42, 4), { y: 1.97, ry: Math.PI / 4 }, CAMPUS.roofTile);
      glowPoint(c, 0, 1.58, 0.36, '#fff0c8', 0.7, 0.03);
    } else if (k === 4) {
      // a club hut among the wings
      CAMPUS_BUILDERS.clubHut(c);
    } else {
      // a tall classroom block (skirt only): four floors and a water tank
      const top = wing(c, { floors: 4, tone: 1, w: 1.0, d: 0.9, far });
      if (!far) prim(F, new THREE.CylinderGeometry(0.08, 0.08, 0.16, 6), { x: 0.26, y: top + 0.04, z: -0.2 }, '#cfd6dc');
    }
  },

  clubHut(c) {
    // a one-room club hut with a pitched roof, a door and a lit window; outside, the club's things
    const k = v(c, 'clubHut');
    const F = c.facade;
    const wall = ['#f0dcc0', '#dfe8ee', '#e9e2cf'][k];
    const roof = ['#c96a5a', '#5f7f9a', '#7f9a62'][k];
    F.box(0, 0, -0.08, 0.72, 0.4, 0.56, { color: wall, side: FK.flats, v0: 0.06 });
    gable(F, 0.4, 0.84, 0.7, 0.2, roof);
    F.box(-0.18, 0, 0.2, 0.14, 0.26, 0.012, { color: CAMPUS.timberDark, noTop: true });
    c.solid.box(0.3, 0.07, 0.012, { x: 0.12, y: 0.3, z: 0.205, color: ['#ff9ec4', '#7fd0ff', '#ffd166'][k] });
    if (c.lod === 'far') return;
    if (k === 0) {
      // art: an easel with a canvas and two paint pots
      c.solid.box(0.02, 0.32, 0.02, { x: 0.26, z: 0.34, rx: -0.15, color: CAMPUS.timber });
      c.solid.box(0.16, 0.13, 0.015, { x: 0.26, y: 0.17, z: 0.32, rx: -0.15, color: '#fff6e8' });
      c.solid.box(0.1, 0.05, 0.016, { x: 0.25, y: 0.2, z: 0.33, rx: -0.15, color: '#7fd0ff' });
      for (const [x, col] of [[0.06, '#ff5d73'], [0.12, '#ffd166']]) c.solid.cyl(0.03, 0.03, 0.05, 6, { x, z: 0.34, color: col });
    } else if (k === 1) {
      // science: a sensor mast on the roof with a small dish and a status lamp
      // (the hut also stands on the board as schoolBlock 4: everything stays under BOARD_MAX_H)
      c.solid.cyl(0.012, 0.016, 0.3, 5, { x: 0.24, y: 0.46, z: -0.2, color: '#9aa3ae' });
      c.solid.cone(0.07, 0.04, 6, { x: 0.24, y: 0.7, z: -0.16, rx: 1.1, color: '#e9ecef' });
      c.glow.sphere(0.022, 6, 4, { x: 0.24, y: 0.79, z: -0.2, color: '#5fe0a8' });
    } else {
      // handicraft: a workbench and a basket of yarn
      c.solid.box(0.3, 0.16, 0.12, { x: 0.18, z: 0.34, color: CAMPUS.timber });
      for (const [x, col] of [[0.1, '#ff9ec4'], [0.2, '#9be7ff'], [0.28, '#ffe680']]) c.solid.box(0.06, 0.05, 0.06, { x, y: 0.16, z: 0.34, color: col });
    }
    glowPoint(c, 0.12, 0.22, 0.26, '#ffe6bf', 0.42, 0.05);
  },

  // ----- the grounds ---------------------------------------------------------------------------
  flowerBoxes(c) {
    // a row of three planter boxes in bloom (rooftop dressing, and R tiles on the campus)
    const k = v(c, 'flowerBoxes');
    const cols = k ? ['#ffe680', '#ffffff', '#ff9ec4'] : ['#ff9ec4', '#ffd1e3', '#ffffff'];
    for (let i = 0; i < 3; i++) {
      const x = -0.3 + i * 0.3;
      c.solid.box(0.26, 0.12, 0.2, { x, color: i % 2 ? PAL.terracotta : '#c98a6e' });
      c.solid.box(0.22, 0.03, 0.16, { x, y: 0.12, color: '#5f8f4f' });
      blossoms(c, 2, 0.18, 0.17, 0, [cols[i], cols[(i + 1) % 3]]);
    }
  },
  bikeShed(c) {
    // a lean-to roof on four posts over a rack of bicycles
    const k = v(c, 'bikeShed');
    const roof = k ? '#5f7f9a' : '#5f9a72';
    for (const x of [-0.44, 0.44]) for (const z of [-0.2, 0.2]) c.solid.box(0.035, z < 0 ? 0.5 : 0.42, 0.035, { x, z, color: PAL.steel });
    c.solid.box(1.0, 0.03, 0.56, { y: 0.44, rx: 0.14, color: roof });
    c.solid.box(0.94, 0.26, 0.015, { y: 0.06, z: -0.22, color: '#c9d6dc' });
    const bikes = ['#d9604a', '#3d6a9a', '#e3b04a', '#4f9a62'];
    for (let i = 0; i < 4; i++) {
      const x = -0.3 + i * 0.2;
      c.solid.box(0.025, 0.16, 0.34, { x, y: 0.04, color: bikes[(i + k) % 4] });
      c.solid.box(0.1, 0.02, 0.02, { x, y: 0.22, z: 0.12, color: CAMPUS.iron });
    }
  },
  flagpole(c) {
    // the school flag on a white pole (the flag sways)
    c.solid.box(0.24, 0.06, 0.24, { color: '#cfc6b6' });
    c.solid.cyl(0.018, 0.024, 1.5, 6, { y: 0.06, color: CAMPUS.trim });
    c.solid.sphere(0.03, 6, 4, { y: 1.57, color: '#e3b04a' });
    c.foliage.panel(0.3, 0.2, { x: 0.16, y: 1.28, color: CAMPUS.band, attrs: { sway: () => 0.7 } });
    c.foliage.panel(0.3, 0.05, { x: 0.16, y: 1.355, z: 0.002, color: '#f7f4ee', attrs: { sway: () => 0.7 } });
  },
  goalPosts(c) {
    // a football goal: white posts and crossbar, a net of thin cords behind
    const w = 0.9;
    const h = 0.4;
    for (const x of [-w / 2, w / 2]) c.solid.box(0.035, h, 0.035, { x, color: '#f7f4ee' });
    c.solid.box(w + 0.035, 0.035, 0.035, { y: h, color: '#f7f4ee' });
    for (const x of [-w / 2, w / 2]) c.solid.box(0.02, 0.02, 0.3, { x, y: h - 0.02, z: -0.15, rx: 0.55, color: '#d9dde2' });
    for (let i = 1; i < 5; i++) c.solid.box(0.008, h * 0.86, 0.008, { x: -w / 2 + (w * i) / 5, z: -0.24, rx: -0.42, color: '#e9ecef' });
    c.solid.box(w, 0.008, 0.008, { y: h * 0.45, z: -0.18, color: '#e9ecef' });
  },
  scoreboard(c) {
    // the sports-field scoreboard on two posts: a dark board with glowing digits
    for (const x of [-0.36, 0.36]) c.solid.box(0.05, 0.62, 0.05, { x, color: PAL.steelDark });
    c.solid.box(0.9, 0.42, 0.06, { y: 0.56, color: '#262a34' });
    c.solid.box(0.94, 0.05, 0.08, { y: 0.98, color: CAMPUS.band });
    // HOME 3 · 2 AWAY as glowing blocks
    c.glow.box(0.26, 0.04, 0.01, { x: -0.24, y: 0.88, z: 0.032, color: '#ffe6a0' });
    c.glow.box(0.26, 0.04, 0.01, { x: 0.24, y: 0.88, z: 0.032, color: '#ffe6a0' });
    for (const x of [-0.24, 0.24]) c.glow.box(0.12, 0.2, 0.01, { x, y: 0.62, z: 0.032, color: x < 0 ? '#ff8a5c' : '#7fd0ff' });
    c.glow.box(0.04, 0.04, 0.01, { y: 0.7, z: 0.032, color: '#ffe6a0' });
    glowPoint(c, 0, 0.76, 0.18, '#ffe6c0', 0.8, 0.04);
  },
  finishGantry(c) {
    // the finish gantry over the track: two slim posts, a thin beam high up with the banner and
    // a lit race clock (thin, so a column walking under it stays in view)
    const span = 1.36;
    for (const x of [-span / 2, span / 2]) {
      c.solid.box(0.06, 1.3, 0.06, { x, color: PAL.steel });
      c.solid.box(0.14, 0.04, 0.14, { x, color: PAL.steelDark });
    }
    c.solid.box(span + 0.06, 0.05, 0.06, { y: 1.3, color: PAL.steel });
    c.solid.box(span - 0.2, 0.12, 0.012, { y: 1.16, z: 0.03, color: '#f7f4ee' });
    for (let i = 0; i < 8; i++) c.solid.box(0.07, 0.12, 0.014, { x: -0.49 + i * 0.14, y: 1.16, z: 0.031, color: i % 2 ? '#262a34' : '#f7f4ee' });
    c.solid.box(0.3, 0.1, 0.05, { y: 1.35, color: '#262a34' });
    c.glow.box(0.24, 0.06, 0.01, { y: 1.37, z: 0.027, color: '#ff8a5c' });
    glowPoint(c, 0, 1.4, 0.1, '#ffb88a', 0.45, 0.04);
  },
  boatRack(c) {
    // the rowing club's rack: a timber frame with two racing shells stacked upside down
    const k = v(c, 'boatRack');
    for (const x of [-0.42, 0.42]) {
      c.solid.box(0.04, 0.42, 0.04, { x, z: -0.12, color: CAMPUS.timberDark });
      c.solid.box(0.04, 0.42, 0.04, { x, z: 0.12, color: CAMPUS.timberDark });
      for (const y of [0.16, 0.34]) c.solid.box(0.06, 0.025, 0.34, { x, y, color: CAMPUS.timber });
    }
    const hulls = k ? ['#f7f4ee', '#e3b04a'] : ['#d9604a', '#f7f4ee'];
    for (let i = 0; i < 2; i++) {
      const y = 0.185 + i * 0.18;
      c.solid.cyl(0.07, 0.07, 1.06, 6, { y, rz: Math.PI / 2, x: 0.53, sz: 0.55, color: hulls[i] });
      c.solid.box(1.0, 0.012, 0.05, { y: y + 0.038, color: CAMPUS.band });
    }
    c.solid.box(0.42, 0.02, 0.06, { x: 0.2, y: 0.02, z: 0.26, ry: 0.3, color: CAMPUS.timber });
  },
  oldLamp(c) {
    // 2-10's old lamp at the breakwater head: a round stone plinth, an iron lamp post and, in its
    // lantern cage, the wardstone, dark and cold (no glow: it wakes only in the story afterwards)
    c.solid.cyl(0.62, 0.68, 0.12, 12, { color: '#a69d8d' });
    c.solid.cyl(0.5, 0.56, 0.06, 12, { y: 0.12, color: '#bdb4a4' });
    c.solid.box(0.24, 0.2, 0.24, { y: 0.18, color: '#8f8679' });
    c.solid.cyl(0.04, 0.06, 0.92, 8, { y: 0.38, color: CAMPUS.iron });
    c.solid.torus(0.06, 0.012, 4, 8, { y: 0.9, rx: Math.PI / 2, color: CAMPUS.iron });
    // the cage: four bars, a cap and a finial
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      c.solid.box(0.016, 0.26, 0.016, { x: Math.cos(a) * 0.11, y: 1.3, z: Math.sin(a) * 0.11, color: CAMPUS.iron });
    }
    c.solid.cyl(0.13, 0.13, 0.03, 8, { y: 1.28, color: CAMPUS.iron });
    c.solid.cone(0.17, 0.14, 8, { y: 1.56, color: CAMPUS.iron });
    c.solid.sphere(0.03, 6, 4, { y: 1.73, color: CAMPUS.iron });
    // the wardstone: a squat dark eight-sided stone with a pale rime line
    c.solid.cyl(0.06, 0.08, 0.18, 8, { y: 1.33, color: '#34303f' });
    c.solid.box(0.1, 0.012, 0.02, { y: 1.44, z: 0.06, color: '#dfeefa' });
    // a life ring hung on the plinth
    c.solid.torus(0.09, 0.025, 4, 10, { y: 0.28, z: 0.14, color: '#ff7a5a' });
  },
  searchlight(c) {
    // the school's searchlight: a drum lamp on a stand (0: a tripod on the shore, 1: a short tower),
    // turned toward +z; the ambient layer sweeps its beam and the spot on the water
    const k = v(c, 'searchlight');
    const y = k ? 0.86 : 0.42;
    if (k) {
      for (const [x, z] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) c.solid.box(0.035, y, 0.035, { x, z, color: PAL.steel });
      c.solid.box(0.42, 0.04, 0.42, { y: y - 0.04, color: PAL.steelDark });
    } else {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        c.solid.box(0.03, 0.46, 0.03, { x: Math.cos(a) * 0.12, z: Math.sin(a) * 0.12, rx: Math.sin(a) * 0.25, rz: -Math.cos(a) * 0.25, color: PAL.steelDark });
      }
    }
    c.solid.cyl(0.11, 0.11, 0.2, 8, { y: y + 0.12, rx: Math.PI / 2 - 0.3, z: -0.02, color: '#4a5260' });
    c.glow.add(new THREE.CircleGeometry(0.09, 10), { y: y + 0.155, z: 0.08, rx: -0.3, color: '#fff6dc' });
    glowPoint(c, 0, y + 0.16, 0.12, '#fff2cc', 0.5, 0.02);
  },
};

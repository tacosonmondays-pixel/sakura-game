// Modern-city kit (prototype): street furniture and set pieces as ordinary props (props.js
// builders: solid / foliage / glow geometry + glow sprites + emitters, cached and merged into the
// terrain's three prop meshes, so a hundred streetlights cost no extra draw calls).
// Clean white and glass, sky blue, sakura-pink accents; everything rounded and toy-like.
import * as THREE from 'three';

const swayW = (x, y) => Math.max(0, Math.min(1, (y - 0.25) * 0.9));

export const CITY = {
  white: '#f7f8fb',
  white2: '#e9edf3',
  steel: '#c3cbd8',
  steelDark: '#8d98ab',
  navy: '#34405e',
  glass: '#a9dcf5',
  glassDark: '#5a8fb8',
  pink: '#ff8fb8',
  pinkSoft: '#ffc4d9',
  pinkDeep: '#ff6f9f',
  sky: '#7fd0ff',
  mint: '#8fe0c4',
  lemon: '#ffe27a',
  wood: '#d8b089',
  green: '#7ccf62',
  green2: '#5db552',
  soil: '#9b7a5c',
  cone: '#ffb27a',
};

const CRYSTAL_COLS = ['#ff9ad5', '#b996ff', '#8fe4ff', '#ffc6e8'];

function glowPoint(c, x, y, z, color, size = 0.6, flicker = 0.15) {
  c.glows.push({ x, y, z, color, size, flicker });
}

function leaf(c, r, o) {
  c.foliage.blob(r, { detail: c.lod === 'far' ? 0 : 1, wobble: 0.2, jitter: 0.06, rand: c.rand, attrs: { sway: swayW }, ...o });
}

/** A young sakura: slim trunk, a small rounded pink crown. */
function youngSakura(c, x, z, s = 1) {
  c.solid.cyl(0.03 * s, 0.045 * s, 0.5 * s, 6, { x, z, y: 0.16, color: '#8a5a44' });
  const pinks = ['#ffc4d9', '#ffadc9', '#ff9ac0', '#ffd8e6'];
  leaf(c, 0.22 * s, { x, z, y: 0.68 * s + 0.1, sy: 0.85, color: pinks[c.variant % 4] });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + c.variant;
    leaf(c, 0.14 * s, { x: x + Math.cos(a) * 0.14 * s, z: z + Math.sin(a) * 0.14 * s, y: (0.6 + (i % 2) * 0.07) * s + 0.1, color: pinks[(i + c.variant + 1) % 4] });
  }
  leaf(c, 0.12 * s, { x: x + 0.02, z, y: 0.86 * s + 0.1, color: '#ffe3ee' });
}

/** Faceted gate crystal (glowing core + pale shell), leaning by (lx, lz). */
function crystal(c, x, y, z, r, h, col, lx = 0, lz = 0) {
  c.glow.add(new THREE.OctahedronGeometry(r, 0), { x, y: y + h * 0.5, z, sy: h / (2 * r), rx: lz, rz: -lx, color: col, color2: '#ffffff' });
  c.solid.add(new THREE.OctahedronGeometry(r * 1.18, 0), { x, y: y + h * 0.42, z, sy: (h * 0.6) / (2 * r), rx: lz, rz: -lx, color: '#ffffff', jitter: 0.04, rand: c.rand });
}

/** Cluster of crystals pushing up through cracked paving slabs. */
function crystalCluster(c, size = 1, n = 5) {
  const col = CRYSTAL_COLS[c.variant % CRYSTAL_COLS.length];
  const col2 = CRYSTAL_COLS[(c.variant + 1) % CRYSTAL_COLS.length];
  // lifted paving chunks
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + c.rand() * 0.8;
    c.solid.box(0.2 * size, 0.04, 0.16 * size, { x: Math.cos(a) * 0.24 * size, z: Math.sin(a) * 0.24 * size, ry: a, rx: 0.25, color: i % 2 ? '#e9edf3' : '#dde3ec' });
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + c.rand() * 0.6;
    const rr = i === 0 ? 0 : 0.11 + c.rand() * 0.12;
    const h = (i === 0 ? 0.75 : 0.32 + c.rand() * 0.28) * size;
    const lean = i === 0 ? 0 : 0.35;
    crystal(c, Math.cos(a) * rr * size, 0, Math.sin(a) * rr * size, (i === 0 ? 0.11 : 0.07) * size, h, i % 2 ? col2 : col, Math.cos(a) * lean, Math.sin(a) * lean);
  }
  glowPoint(c, 0, 0.45 * size, 0, col, 1.1 * size, 0.18);
}

export const CITY_BUILDERS = {
  // ----- greenery ----------------------------------------------------------------------
  planterSakura(c) {
    c.solid.box(0.56, 0.2, 0.56, { color: CITY.white, jitter: 0.02, rand: c.rand });
    c.solid.box(0.6, 0.04, 0.6, { y: 0.2, color: CITY.white2 });
    c.solid.box(0.48, 0.02, 0.48, { y: 0.2, color: CITY.soil });
    c.solid.box(0.58, 0.035, 0.012, { y: 0.1, z: 0.285, color: CITY.pink });
    leaf(c, 0.09, { x: -0.16, y: 0.25, z: 0.14, color: CITY.green });
    leaf(c, 0.08, { x: 0.17, y: 0.25, z: -0.12, color: CITY.green2 });
    youngSakura(c, 0, 0, 1.1);
  },
  planterBox(c) {
    // long low planter (frame ring): hedge + pink blossoms
    c.solid.box(0.92, 0.18, 0.34, { color: CITY.white });
    c.solid.box(0.96, 0.03, 0.38, { y: 0.18, color: CITY.white2 });
    for (let i = 0; i < 4; i++) {
      leaf(c, 0.12, { x: -0.33 + i * 0.22, y: 0.27, color: i % 2 ? CITY.green : CITY.green2 });
      if (i % 2 === 0) leaf(c, 0.06, { x: -0.3 + i * 0.22, y: 0.36, z: 0.06, color: CITY.pinkSoft });
    }
  },
  lawnShrub(c) {
    leaf(c, 0.16, { y: 0.12, color: CITY.green });
    leaf(c, 0.11, { x: 0.14, y: 0.1, z: 0.05, color: CITY.green2 });
    leaf(c, 0.05, { x: 0.02, y: 0.25, z: 0.08, color: CITY.pinkSoft });
  },

  // ----- street furniture ------------------------------------------------------------------
  streetLight(c) {
    // slim white pole, an arm curving out over the road (+z), a flat lamp with a warm glow
    c.solid.cyl(0.05, 0.06, 0.06, 8, { color: CITY.steel });
    c.solid.cyl(0.022, 0.03, 1.18, 8, { y: 0.05, color: CITY.white });
    c.solid.box(0.02, 0.02, 0.36, { y: 1.22, z: 0.16, color: CITY.white });
    c.solid.box(0.12, 0.035, 0.22, { y: 1.19, z: 0.33, color: CITY.white });
    c.glow.box(0.09, 0.012, 0.17, { y: 1.178, z: 0.33, color: '#fff6e0' });
    c.solid.box(0.035, 0.12, 0.01, { y: 0.75, z: 0.03, color: CITY.pink });
    glowPoint(c, 0, 1.14, 0.33, '#fff2d6', 0.55, 0.05);
  },
  trafficLight(c) {
    c.solid.cyl(0.03, 0.035, 1.1, 8, { color: CITY.white });
    c.solid.box(0.02, 0.02, 0.5, { y: 1.05, z: 0.24, color: CITY.white });
    // signal head hanging over the road
    c.solid.box(0.34, 0.12, 0.08, { y: 0.98, z: 0.46, color: CITY.navy });
    c.solid.box(0.38, 0.02, 0.1, { y: 1.1, z: 0.46, color: CITY.white });
    const lamps = [['#ff6f8a', 0.25], ['#ffd54f', 0.25], ['#5fe0a8', 1]];
    lamps.forEach(([col, on], i) => {
      const color = on < 1 ? new THREE.Color(col).multiplyScalar(0.35).getStyle() : col;
      (on < 1 ? c.solid : c.glow).cyl(0.035, 0.035, 0.012, 10, { x: -0.11 + i * 0.11, y: 1.04, z: 0.505, rx: Math.PI / 2, color });
    });
    glowPoint(c, 0.11, 1.04, 0.52, '#5fe0a8', 0.35, 0.05);
    // pedestrian signal on the pole
    c.solid.box(0.1, 0.16, 0.06, { y: 0.62, z: 0.05, color: CITY.navy });
    c.glow.box(0.06, 0.05, 0.01, { y: 0.67, z: 0.08, color: '#5fe0a8' });
  },
  cityBench(c) {
    for (const x of [-0.24, 0.24]) c.solid.box(0.04, 0.16, 0.2, { x, color: CITY.steel });
    c.solid.box(0.6, 0.04, 0.22, { y: 0.16, color: CITY.wood });
    c.solid.box(0.6, 0.12, 0.03, { y: 0.2, z: -0.1, color: CITY.wood });
    c.solid.box(0.62, 0.02, 0.02, { y: 0.32, z: -0.1, color: CITY.white });
  },
  busStop(c) {
    // glass shelter, white roof with a pink edge, a bench and a route sign
    c.solid.box(1.0, 0.03, 0.46, { y: 0.005, color: CITY.white2 });
    for (const x of [-0.46, 0.46]) c.solid.box(0.03, 0.66, 0.03, { x, z: -0.2, color: CITY.white });
    c.solid.box(0.96, 0.6, 0.02, { y: 0.05, z: -0.21, color: '#cdeefc' });
    c.solid.box(0.02, 0.5, 0.36, { x: -0.47, y: 0.1, color: '#cdeefc' });
    c.solid.box(1.08, 0.05, 0.52, { y: 0.66, z: -0.02, color: CITY.white });
    c.solid.box(1.08, 0.03, 0.02, { y: 0.66, z: 0.245, color: CITY.pink });
    c.solid.box(0.6, 0.04, 0.16, { y: 0.2, z: -0.12, color: CITY.wood });
    // ad panel (glowing)
    c.glow.box(0.3, 0.36, 0.01, { x: 0.25, y: 0.16, z: -0.198, color: '#ffd6e8' });
    // sign pole with a round stop marker
    c.solid.cyl(0.018, 0.018, 0.9, 6, { x: 0.62, z: 0.12, color: CITY.white });
    c.glow.cyl(0.09, 0.09, 0.02, 14, { x: 0.62, y: 0.86, z: 0.12, rx: Math.PI / 2, color: CITY.sky });
    c.solid.cyl(0.065, 0.065, 0.024, 14, { x: 0.62, y: 0.86, z: 0.12, rx: Math.PI / 2, color: CITY.white });
    glowPoint(c, 0.25, 0.4, -0.15, '#ffd6e8', 0.5, 0.05);
  },
  holoSign(c) {
    // projector plinth (the hologram panel itself is drawn by the city kit's holo layer)
    c.solid.cyl(0.13, 0.16, 0.1, 12, { color: CITY.white });
    c.solid.cyl(0.03, 0.04, 0.42, 8, { y: 0.1, color: CITY.steel });
    c.glow.cyl(0.11, 0.11, 0.015, 14, { y: 0.1, color: CITY.sky });
    glowPoint(c, 0, 0.8, 0, '#9fe6ff', 0.9, 0.1);
  },
  van(c) {
    // a chunky, rounded delivery van: white with a pink lower band
    const body = CITY.white;
    c.solid.box(0.42, 0.06, 0.82, { y: 0.07, color: CITY.pinkSoft });
    c.solid.box(0.42, 0.3, 0.82, { y: 0.13, color: body });
    c.solid.box(0.4, 0.14, 0.3, { y: 0.43, z: -0.22, color: body });
    c.solid.box(0.4, 0.1, 0.5, { y: 0.43, z: 0.12, color: body });
    c.solid.box(0.41, 0.1, 0.18, { y: 0.4, z: 0.33, color: '#7fb6db' });
    c.solid.box(0.43, 0.07, 0.4, { y: 0.31, z: -0.05, color: '#7fb6db' });
    c.solid.box(0.425, 0.05, 0.82, { y: 0.16, color: CITY.pink });
    for (const [x, z] of [[-0.2, 0.25], [0.2, 0.25], [-0.2, -0.27], [0.2, -0.27]]) {
      c.solid.cyl(0.07, 0.07, 0.06, 10, { x, y: 0.07, z, rz: Math.PI / 2, color: '#4a5266' });
    }
    c.glow.box(0.08, 0.04, 0.01, { x: -0.13, y: 0.24, z: 0.415, color: '#fff6d6' });
    c.glow.box(0.08, 0.04, 0.01, { x: 0.13, y: 0.24, z: 0.415, color: '#fff6d6' });
  },
  scooters(c) {
    const cols = [CITY.pink, CITY.sky, CITY.mint];
    for (let i = 0; i < 3; i++) {
      const x = -0.28 + i * 0.28;
      const col = cols[(i + c.variant) % 3];
      c.solid.box(0.06, 0.05, 0.34, { x, y: 0.06, color: col });
      c.solid.box(0.07, 0.12, 0.1, { x, y: 0.1, z: -0.1, color: col });
      c.solid.box(0.05, 0.03, 0.12, { x, y: 0.22, z: -0.1, color: CITY.white });
      c.solid.cyl(0.012, 0.012, 0.3, 5, { x, y: 0.08, z: 0.15, rx: -0.25, color: CITY.steel });
      c.solid.box(0.18, 0.015, 0.015, { x, y: 0.37, z: 0.22, color: CITY.navy });
      for (const z of [-0.15, 0.17]) c.solid.cyl(0.045, 0.045, 0.03, 10, { x, y: 0.045, z, rz: Math.PI / 2, color: '#4a5266' });
    }
  },
  vending(c) {
    c.solid.box(0.42, 0.62, 0.3, { color: CITY.white });
    c.solid.box(0.44, 0.04, 0.32, { y: 0.62, color: CITY.pink });
    c.glow.box(0.3, 0.3, 0.01, { y: 0.24, z: 0.152, color: '#d9f3ff' });
    for (let i = 0; i < 6; i++) c.glow.box(0.04, 0.06, 0.012, { x: -0.1 + (i % 3) * 0.1, y: 0.3 + Math.floor(i / 3) * 0.12, z: 0.158, color: [CITY.pink, CITY.lemon, CITY.mint][i % 3] });
    c.solid.box(0.3, 0.06, 0.02, { y: 0.06, z: 0.15, color: CITY.navy });
    glowPoint(c, 0, 0.4, 0.2, '#d9f3ff', 0.5, 0.05);
  },
  bikeRack(c) {
    for (let i = 0; i < 3; i++) {
      const x = -0.3 + i * 0.3;
      c.solid.torus(0.12, 0.012, 4, 10, { x, y: 0.0, ry: Math.PI / 2, arc: Math.PI, color: CITY.steel });
      if (i < 2) {
        const col = [CITY.sky, CITY.pink][i];
        for (const z of [-0.14, 0.14]) c.solid.torus(0.085, 0.014, 4, 12, { x: x + 0.15, y: 0.09, z, ry: Math.PI / 2, color: '#4a5266' });
        c.solid.box(0.02, 0.02, 0.26, { x: x + 0.15, y: 0.16, color: col });
        c.solid.box(0.02, 0.1, 0.02, { x: x + 0.15, y: 0.15, z: 0.1, color: col });
        c.solid.box(0.12, 0.015, 0.015, { x: x + 0.15, y: 0.26, z: 0.12, color: CITY.navy });
      }
    }
  },
  kiosk(c) {
    c.solid.box(0.66, 0.5, 0.56, { color: CITY.white });
    c.solid.box(0.58, 0.24, 0.02, { y: 0.16, z: 0.28, color: '#cdeefc' });
    c.solid.box(0.76, 0.06, 0.66, { y: 0.5, color: CITY.pink });
    c.solid.box(0.7, 0.12, 0.6, { y: 0.56, color: CITY.white });
    c.glow.box(0.4, 0.07, 0.01, { y: 0.6, z: 0.305, color: '#ffe0ec' });
    glowPoint(c, 0, 0.3, 0.32, '#fff0d6', 0.5, 0.05);
  },
  fountainPlaza(c) {
    // modern round fountain: white rings, a pale water disc, a jet
    c.solid.cyl(0.48, 0.5, 0.12, 20, { color: CITY.white });
    c.glow.cyl(0.42, 0.42, 0.01, 20, { y: 0.115, color: '#bfeaff' });
    c.solid.cyl(0.18, 0.2, 0.22, 14, { color: CITY.white2 });
    c.solid.cyl(0.22, 0.22, 0.03, 14, { y: 0.22, color: CITY.pinkSoft });
    c.glow.cyl(0.03, 0.05, 0.3, 8, { y: 0.24, color: '#e8f8ff' });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      c.solid.box(0.06, 0.05, 0.06, { x: Math.cos(a) * 0.45, y: 0.12, z: Math.sin(a) * 0.45, color: CITY.pink });
    }
    c.emitters.push({ kind: 'fountain', x: 0, y: 0.5, z: 0 });
    glowPoint(c, 0, 0.3, 0, '#bfeaff', 0.8, 0.08);
  },
  manhole(c) {
    c.solid.cyl(0.13, 0.13, 0.008, 12, { color: '#b9c1ce' });
    c.solid.cyl(0.09, 0.09, 0.01, 12, { color: '#a3adbd' });
  },

  // ----- frame ring --------------------------------------------------------------------
  bollard(c) {
    for (const x of [-0.25, 0.25]) {
      c.solid.cyl(0.05, 0.055, 0.24, 8, { x, color: CITY.white });
      c.solid.sphere(0.05, 8, 4, { x, y: 0.24, color: CITY.white });
      c.solid.cyl(0.056, 0.056, 0.03, 8, { x, y: 0.15, color: CITY.pink });
    }
  },
  cityRail(c) {
    for (const x of [-0.45, 0.05]) c.solid.box(0.04, 0.3, 0.04, { x, color: CITY.white });
    c.solid.box(1.0, 0.035, 0.035, { y: 0.28, color: CITY.white });
    c.solid.box(1.0, 0.02, 0.02, { y: 0.16, color: CITY.sky });
  },

  // ----- after the surge (cute, evacuated, safe) ------------------------------------
  barricade(c) {
    const stripe = c.look.city?.war ? '#ff8a3a' : CITY.pink;
    for (const x of [-0.34, 0.34]) {
      c.solid.box(0.04, 0.32, 0.04, { x, color: CITY.white });
      c.solid.box(0.04, 0.03, 0.26, { x, color: CITY.white });
    }
    for (let i = 0; i < 6; i++) c.solid.box(0.14, 0.1, 0.03, { x: -0.35 + i * 0.14, y: 0.22, color: i % 2 ? CITY.white : stripe });
    c.glow.sphere(0.03, 6, 4, { x: -0.34, y: 0.35, color: '#ffd54f' });
    c.glow.sphere(0.03, 6, 4, { x: 0.34, y: 0.35, color: '#ffd54f' });
    for (const [x, z] of [[-0.5, 0.2], [0.48, 0.18]]) {
      c.solid.cyl(0.0, 0.07, 0.2, 10, { x, z, color: CITY.cone });
      c.solid.cyl(0.04, 0.05, 0.04, 10, { x, z, y: 0.08, color: CITY.white });
      c.solid.box(0.15, 0.015, 0.15, { x, z, color: CITY.cone });
    }
  },
  toppledSign(c) {
    // a street sign that tipped over, resting on a little pile of slabs
    c.solid.box(0.22, 0.06, 0.16, { x: -0.2, color: '#dde3ec', ry: 0.4 });
    c.solid.box(0.16, 0.05, 0.12, { x: 0.25, z: 0.12, color: '#e9edf3', ry: -0.3 });
    c.solid.cyl(0.02, 0.02, 0.85, 6, { x: -0.36, y: 0.05, rz: -Math.PI / 2 + 0.14, color: CITY.white });
    c.solid.box(0.04, 0.3, 0.3, { x: 0.36, y: 0.05, rz: 0.14, color: CITY.sky });
    c.solid.box(0.045, 0.22, 0.22, { x: 0.36, y: 0.09, rz: 0.14, color: CITY.white });
    crystal(c, 0.1, 0, -0.22, 0.05, 0.3, CRYSTAL_COLS[c.variant % 4], 0.3, -0.2);
  },
  rubble(c) {
    // pastel concrete chunks + a traffic cone (no fire, nothing grim)
    const n = 4 + (c.variant % 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + c.rand();
      const r = 0.08 + c.rand() * 0.16;
      const s = 0.1 + c.rand() * 0.1;
      c.solid.box(s * 1.4, s * 0.8, s, { x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r, ry: a, rx: c.rand() * 0.4, rz: c.rand() * 0.4, color: i % 2 ? '#e3e8ef' : '#cfd6e2', jitter: 0.05, rand: c.rand });
    }
    if (c.variant % 2 === 0) {
      c.solid.cyl(0.0, 0.065, 0.2, 10, { x: 0.25, z: 0.22, color: CITY.cone });
      c.solid.cyl(0.035, 0.045, 0.04, 10, { x: 0.25, z: 0.22, y: 0.08, color: CITY.white });
    } else {
      crystal(c, -0.05, 0, 0.05, 0.05, 0.32, CRYSTAL_COLS[(c.variant + 2) % 4], 0.2, 0.1);
    }
  },
  gateCrystal(c) {
    crystalCluster(c, 1.25, 6);
    c.emitters.push({ kind: 'sparkle', x: 0, y: 0.5, z: 0, color: '#ffd6f0' });
  },
  crystalSmall(c) {
    crystalCluster(c, 0.62, 4);
  },


  // ----- the war-torn surge (no people, no gore: the ruin and the light carry it) ------
  wreckVan(c) {
    // a burnt-out van tipped on its side, dented panels, a crumpled bonnet
    const burnt = '#4a4650';
    const paint = ['#c9c4cc', '#9fb3c8', '#c7a7b4'][c.variant % 3];
    c.solid.box(0.3, 0.42, 0.8, { y: 0.0, rz: Math.PI / 2 - 0.05, x: 0.21, color: paint, jitter: 0.08, rand: c.rand });
    c.solid.box(0.24, 0.36, 0.5, { y: 0.3, x: 0.16, rz: Math.PI / 2 - 0.05, color: burnt });
    c.solid.box(0.02, 0.3, 0.6, { x: 0.42, y: 0.06, color: '#2e2a34' });
    for (const z of [-0.26, 0.26]) c.solid.cyl(0.07, 0.07, 0.06, 8, { x: -0.06, y: 0.3, z, color: '#2a2830' });
    c.solid.box(0.18, 0.04, 0.12, { x: -0.3, y: 0.0, z: 0.36, ry: 0.6, color: paint });
    c.solid.box(0.12, 0.03, 0.1, { x: 0.45, y: 0.0, z: -0.4, ry: -0.4, color: '#6c6872' });
  },
  wreckCar(c) {
    const paint = ['#b94a4a', '#5f7fa8', '#d9d4d8', '#7c8a5c'][c.variant % 4];
    c.solid.box(0.36, 0.14, 0.62, { y: 0.05, ry: 0.15, rz: 0.08, color: paint, jitter: 0.1, rand: c.rand });
    c.solid.box(0.3, 0.1, 0.32, { y: 0.17, z: -0.04, ry: 0.15, rz: 0.12, rx: 0.1, color: '#3a3640' });
    for (const [x, z] of [[-0.17, 0.2], [0.17, 0.22], [-0.17, -0.22]]) c.solid.cyl(0.055, 0.055, 0.05, 8, { x, y: 0.05, z, rz: Math.PI / 2, color: '#2a2830' });
    c.solid.box(0.2, 0.03, 0.14, { x: 0.28, z: 0.35, ry: 0.9, color: paint });
  },
  fireSmall(c) {
    // a small fire in the rubble: glowing flame cones, embers and a smoke plume
    c.solid.box(0.3, 0.06, 0.18, { ry: 0.4, color: '#3a3238' });
    c.solid.box(0.24, 0.05, 0.14, { ry: -0.7, x: 0.08, color: '#4a4048' });
    const flames = [[0, 0, 0.34, '#ff9a3a'], [0.09, 0.05, 0.24, '#ffc95a'], [-0.08, -0.03, 0.22, '#ff7a2a'], [0.02, 0.0, 0.16, '#fff0b0']];
    for (const [x, z, h, col] of flames) c.glow.cone(0.07 * (h / 0.3), h, 5, { x, y: 0.05, z, color: col, color2: '#fff3c0' });
    glowPoint(c, 0, 0.25, 0, '#ff8a3a', 1.4, 0.45);
    c.emitters.push({ kind: 'embers', x: 0, y: 0.2, z: 0 });
    c.emitters.push({ kind: 'smoke', x: 0, y: 0.4, z: 0 });
  },
  smokeColumn(c) {
    // a smouldering heap that sends a tall smoke column up
    c.solid.rock(0.16, { y: 0.06, sy: 0.5, color: '#3e3840' });
    c.glow.blob(0.06, { y: 0.06, color: '#ff7a2a' });
    glowPoint(c, 0, 0.12, 0, '#ff7a2a', 0.8, 0.5);
    c.emitters.push({ kind: 'smoke', x: 0, y: 0.15, z: 0 });
  },
  deadSapling(c) {
    // a street tree stripped bare, in its cracked planter
    c.solid.box(0.56, 0.2, 0.56, { color: '#8f8b94', jitter: 0.05, rand: c.rand });
    c.solid.box(0.3, 0.05, 0.1, { y: 0.2, x: 0.22, rz: 0.6, color: '#7d7a84' });
    c.solid.cyl(0.03, 0.045, 0.62, 5, { y: 0.18, rz: 0.12, color: '#3e342e' });
    c.solid.cyl(0.015, 0.025, 0.3, 4, { y: 0.55, rz: -0.8, color: '#3e342e' });
    c.solid.cyl(0.012, 0.02, 0.26, 4, { y: 0.6, rz: 0.9, rx: 0.3, color: '#3e342e' });
  },
  concreteBarrier(c) {
    for (const x of [-0.26, 0.26]) {
      c.solid.extrude([[-0.12, 0], [0.12, 0], [0.05, 0.28], [-0.05, 0.28]], 0.5, { x, ry: Math.PI / 2, color: '#b9b5bd', jitter: 0.05, rand: c.rand });
      c.solid.box(0.5, 0.04, 0.012, { x, y: 0.16, z: 0.075, color: '#ff8a3a' });
    }
  },

  // ----- gates -----------------------------------------------------------------------
  cityGate(c) {
    // THE GATE: a huge ring portal standing over the road (local z = travel direction). The
    // swirling disc inside is the city kit's portal layer; this is the frame, plinth and glows.
    const R = 1.12;
    const cy = 1.22;
    const col = c.look.gate?.spawn || '#c48cff';
    // plinth: two white tiers with a pink light strip, a ramp down onto the road
    c.solid.box(3.0, 0.08, 1.0, { color: CITY.white2 });
    c.solid.box(2.6, 0.08, 0.8, { y: 0.08, color: CITY.white });
    c.glow.box(2.62, 0.015, 0.82, { y: 0.075, color: '#ffb8de' });
    // side pylons cradling the ring
    for (const s of [-1, 1]) {
      c.solid.box(0.36, 0.62, 0.5, { x: s * 1.05, y: 0.12, color: CITY.white });
      c.solid.box(0.3, 0.06, 0.44, { x: s * 1.05, y: 0.74, color: CITY.white2 });
      c.glow.box(0.04, 0.42, 0.52, { x: s * 1.24, y: 0.2, color: CITY.sky });
    }
    // the ring: white outer band, a glowing inner band
    c.solid.torus(R, 0.13, 8, 40, { y: cy, color: CITY.white });
    c.glow.torus(R - 0.11, 0.045, 6, 40, { y: cy, color: col });
    c.glow.torus(R + 0.12, 0.022, 4, 40, { y: cy, color: '#ffb8de' });
    // mechanical segments + gems round the ring
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const x = Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      c.solid.box(0.18, 0.3, 0.34, { x, y: y - 0.15, rz: a - Math.PI / 2, color: i % 2 ? CITY.white : CITY.white2 });
      if (i % 2 === 0) c.glow.add(new THREE.OctahedronGeometry(0.07, 0), { x: Math.cos(a) * (R + 0.2), y: cy + Math.sin(a) * (R + 0.2), z: 0, sy: 1.6, rz: a - Math.PI / 2, color: CRYSTAL_COLS[(i / 2) % 4], color2: '#ffffff' });
    }
    // crown crystal on top
    c.glow.add(new THREE.OctahedronGeometry(0.14, 0), { y: cy + R + 0.36, sy: 2.0, color: '#ffc6ee', color2: '#ffffff' });
    glowPoint(c, 0, cy, 0, col, 3.2, 0.22);
    glowPoint(c, 0, cy + R + 0.36, 0, '#ffc6ee', 1.2, 0.2);
    glowPoint(c, 0, 0.2, 0.3, '#ffb8de', 2.2, 0.15);
    c.emitters.push({ kind: 'portal', x: 0, y: 0.25, z: 0.35, color: col });
    c.emitters.push({ kind: 'sparkle', x: -0.9, y: 1.6, z: 0, color: '#ffe0f4' });
    c.emitters.push({ kind: 'sparkle', x: 0.9, y: 0.9, z: 0, color: '#d6f4ff' });
    // fantasy crystals growing out of the paving around the gate
    const spots = [[-1.65, -0.2, 0.55, 0.13, 0], [-1.45, 0.45, 0.38, 0.09, 1], [1.62, 0.1, 0.62, 0.14, 2], [1.4, 0.55, 0.32, 0.08, 3], [-1.9, 0.5, 0.28, 0.07, 1], [1.95, -0.35, 0.36, 0.09, 0]];
    for (const [x, z, h, r, k] of spots) {
      crystal(c, x, 0, z, r, h * 1.4, CRYSTAL_COLS[k], x > 0 ? 0.25 : -0.25, 0.1);
      crystal(c, x + 0.12, 0, z - 0.1, r * 0.6, h * 0.8, CRYSTAL_COLS[(k + 1) % 4], x > 0 ? 0.5 : -0.5, -0.2);
    }
    glowPoint(c, -1.6, 0.4, 0.1, '#ff9ad5', 1.2, 0.2);
    glowPoint(c, 1.6, 0.4, 0.1, '#8fe4ff', 1.2, 0.2);
  },
  cityGoal(c) {
    // the station the girls defend: a white arch, pink light, a shield crest
    const pink = c.look.gate?.goal || '#ff7aa2';
    for (const x of [-0.58, 0.58]) {
      c.solid.box(0.16, 1.0, 0.22, { x, color: CITY.white });
      c.solid.box(0.22, 0.06, 0.28, { x, color: CITY.white2 });
      c.glow.box(0.02, 0.8, 0.23, { x: x * 0.86, y: 0.1, color: CITY.pinkSoft });
    }
    c.solid.box(1.4, 0.16, 0.28, { y: 1.0, color: CITY.white });
    c.glow.box(1.2, 0.03, 0.29, { y: 1.04, color: pink });
    c.solid.cyl(0.17, 0.17, 0.05, 16, { y: 1.3, z: 0.02, rx: Math.PI / 2, color: CITY.white });
    c.glow.add(new THREE.OctahedronGeometry(0.1, 0), { y: 1.3, z: 0.06, sy: 1.2, color: pink, color2: '#ffffff' });
    glowPoint(c, 0, 1.2, 0, pink, 1.0, 0.1);
    c.emitters.push({ kind: 'goal', x: 0, y: 0.05, z: 0, color: pink });
  },
  schoolGate(c) {
    // academy gate: two stone-white posts with caps, a low sliding gate pulled aside, a nameplate
    const pink = c.look.gate?.goal || '#ff7aa2';
    for (const x of [-0.62, 0.62]) {
      c.solid.box(0.24, 0.78, 0.24, { x, color: '#f4efe6' });
      c.solid.box(0.3, 0.06, 0.3, { x, y: 0.78, color: '#e2d9ca' });
      c.solid.box(0.12, 0.08, 0.12, { x, y: 0.84, color: '#e2d9ca' });
      c.glow.sphere(0.05, 8, 6, { x, y: 0.97, color: '#fff2c8' });
    }
    c.solid.box(0.04, 0.26, 0.2, { x: -0.5, y: 0.44, z: 0.13, color: '#c9a77a' });
    c.glow.box(0.012, 0.18, 0.14, { x: -0.47, y: 0.48, z: 0.13, color: '#fff7e8' });
    // sliding gate folded beside the left post
    for (let i = 0; i < 4; i++) c.solid.box(0.02, 0.36, 0.02, { x: -0.9 - i * 0.08, z: 0.05, color: CITY.steel });
    c.solid.box(0.32, 0.02, 0.03, { x: -1.02, y: 0.34, z: 0.05, color: CITY.steel });
    c.glow.box(0.6, 0.03, 0.03, { y: 0.02, z: 0.0, color: pink });
    glowPoint(c, 0, 0.9, 0, '#fff2c8', 0.8, 0.08);
    c.emitters.push({ kind: 'goal', x: 0, y: 0.05, z: 0, color: pink });
  },
};

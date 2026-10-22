// Code-built geometry for placed objects and thrown props (FX-1, docs/ATTACK_FX.md "Placed objects
// and thrown props"): merged, vertex-coloured toon parts, made once per renderer and shared by every
// instance. No textures and no downloads: every shape is a few primitives, sized to read at phone
// scale (shot heads ≥ 0.15 units, the thinnest spike ≥ 6 % of a girl's height).
//
// Local axes of every part: +y up, +z forward (the way it travels or faces), x across.
import * as THREE from 'three';
import { GeoBuilder } from '../geo.js';

const TAU = Math.PI * 2;

/** Marumi's ball radius (world units). Display only: the sim ball has its own BALL_RADIUS reach. */
export const BALL_R = 0.2;
/** Strip: plates across the road, spacing between hinges, plate length / width (world units). */
export const PLATES = 5;
export const PLATE_STEP = 0.165;
export const PLATE_LEN = 0.155;
export const PLATE_W = 0.22;
/** Pin height. */
export const PIN_H = 0.24;

const C = {
  // Marumi: a navy bomb-bowling ball, a bold red band, a cream sakura decal
  ballNavy: '#353a5a', ballBand: '#e2434f', ballDecal: '#fff3e2', ballPetal: '#ff9cbc', ballHole: '#1c1f33',
  capSteel: '#8e96a8', capRim: '#c9cfdb', fuse: '#d9b27a',
  pinWhite: '#fbf7ef', pinRed: '#e2434f',
  // Azami: dark steel plates, thistle-purple caps (no hazard stripes)
  plate: '#434a5a', plateEdge: '#6f788c', hinge: '#2b303c', spike: '#9aa3b5', spikeCap: '#a57cc4',
  roll: '#3d4352', rollBand: '#a57cc4',
  // Yuzuha: navy, cream and safety orange, a teal lens
  navy: '#2a3c66', navyDark: '#1b2744', cream: '#f2ead8', orange: '#ff8a2a', steel: '#5a6478', charm: '#ff8fb5',
  dart: '#e8fbff', dartFin: '#5fd6ff',
};

/** Colours each triangle of a smooth, non-indexed geometry by its centroid (crisp edges, smooth normals). */
function paintTriangles(geo, colorOf) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position;
  const n = pos.count;
  const colors = new Float32Array(n * 3);
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    v.set(
      (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3,
      (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3,
      (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3,
    );
    c.set(colorOf(v));
    for (let k = 0; k < 3; k++) {
      colors[(i + k) * 3] = c.r;
      colors[(i + k) * 3 + 1] = c.g;
      colors[(i + k) * 3 + 2] = c.b;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  g.computeBoundingSphere();
  return g;
}

/** Inside a five-petal sakura of radius rf at polar (rho, phi)? */
function inSakura(rho, phi, rf) {
  const petal = 0.62 + 0.38 * Math.abs(Math.cos(2.5 * phi));
  // a small notch at each petal tip
  const notch = 1 - 0.18 * Math.max(0, Math.cos(5 * phi)) ** 12;
  return rho < rf * petal * notch;
}

/**
 * The ball: a navy sphere, a bold band on the great circle through the spin axis (local x), so the
 * spin reads as the band flips over, and a big cream sakura decal on one side with three finger holes.
 */
export function ballGeometry(r = BALL_R) {
  const sphere = new THREE.SphereGeometry(r, 28, 18);
  return paintTriangles(sphere, (v) => {
    const d = v.clone().normalize();
    if (Math.abs(d.z) < 0.2) return C.ballBand; // the band: plane z = 0 contains the spin axis (x)
    // the decal: centred on +z+y/−y alternately would need two; one big one on +z reads at 12 px
    if (d.z > 0.55) {
      const rho = Math.sqrt(d.x * d.x + d.y * d.y);
      const phi = Math.atan2(d.y, d.x);
      if (rho < 0.12) return C.ballPetal;
      if (inSakura(rho, phi, 0.66)) return C.ballDecal;
    }
    if (d.z < -0.6) {
      // three finger holes on the far side
      const hx = [0, -0.2, 0.2];
      const hy = [0.24, -0.1, -0.1];
      for (let i = 0; i < 3; i++) if ((d.x - hx[i]) ** 2 + (d.y - hy[i]) ** 2 < 0.075 ** 2) return C.ballHole;
    }
    return C.ballNavy;
  });
}

/** The fuse cap (stays upright while the ball spins under it): a steel cap, a rim and a bent fuse. */
export function capGeometry() {
  const b = new GeoBuilder({ flat: false })
    .cyl(0.052, 0.06, 0.035, 10, { color: C.capSteel })
    .torus(0.056, 0.012, 4, 12, { rx: Math.PI / 2, y: 0.035, color: C.capRim })
    .cyl(0.013, 0.013, 0.06, 5, { y: 0.03, rz: 0.25, color: C.fuse })
    .cyl(0.012, 0.012, 0.05, 5, { y: 0.085, x: -0.012, rz: -0.45, color: C.fuse });
  return b.finish();
}

/** A bowling pin (white, two red neck stripes), standing on y = 0. */
export function pinGeometry(h = PIN_H) {
  const prof = [
    [0.0, 0], [0.032, 0], [0.042, 0.02], [0.05, 0.06], [0.048, 0.095], [0.034, 0.13], [0.022, 0.155],
    [0.021, 0.17], [0.03, 0.19], [0.033, 0.21], [0.026, 0.23], [0.0, 0.24],
  ].map(([x, y]) => new THREE.Vector2(x * (h / 0.24), y * (h / 0.24)));
  const lathe = new THREE.LatheGeometry(prof, 10);
  return paintTriangles(lathe, (v) => {
    const y = v.y / h;
    if ((y > 0.6 && y < 0.65) || (y > 0.69 && y < 0.74)) return C.pinRed;
    return C.pinWhite;
  });
}

/**
 * One strip plate (a hinged steel segment), centred on its own middle, lying flat: length along x
 * (across the road), width along z (along the road). The hinge pin sits on its −x edge.
 */
export function plateGeometry() {
  return new GeoBuilder({ flat: false })
    .box(PLATE_LEN, 0.022, PLATE_W, { color: C.plate })
    .box(PLATE_LEN * 0.92, 0.008, PLATE_W * 0.18, { y: 0.022, z: PLATE_W * 0.36, color: C.plateEdge })
    .box(PLATE_LEN * 0.92, 0.008, PLATE_W * 0.18, { y: 0.022, z: -PLATE_W * 0.36, color: C.plateEdge })
    .cyl(0.014, 0.014, PLATE_W * 0.9, 6, { rx: Math.PI / 2, x: -PLATE_LEN / 2, y: 0.011, z: -PLATE_W * 0.45, color: C.hinge })
    .finish();
}

/** The spike row of one plate: two chunky rounded cones with thistle-purple caps, standing on y = 0. */
export function spikeRowGeometry() {
  const b = new GeoBuilder({ flat: false });
  for (const z of [-0.055, 0.055]) {
    b.cone(0.04, 0.1, 8, { z, color: C.spike });
    b.sphere(0.022, 8, 6, { z, y: 0.092, color: C.spikeCap });
  }
  return b.finish();
}

/** Azami's thrown prop: the rolled strip (a steel roll with a thistle band), its axis along x. */
export function stripRollGeometry() {
  return new GeoBuilder({ flat: false })
    .cyl(0.065, 0.065, 0.24, 10, { rz: Math.PI / 2, x: 0.12, color: C.roll })
    .cyl(0.068, 0.068, 0.05, 10, { rz: Math.PI / 2, x: 0.025, color: C.rollBand })
    .cyl(0.02, 0.02, 0.27, 6, { rz: Math.PI / 2, x: 0.135, color: C.hinge })
    .finish();
}

/** Yuzuha's folded sentry case: a navy box, a cream panel, a safety-orange stripe and a handle. */
export function sentryCaseGeometry() {
  return new GeoBuilder({ flat: false })
    .box(0.2, 0.12, 0.16, { color: C.navy })
    .box(0.205, 0.03, 0.165, { y: 0.045, color: C.orange })
    .box(0.12, 0.004, 0.1, { y: 0.12, color: C.cream })
    .box(0.08, 0.025, 0.02, { y: 0.12, color: C.navyDark })
    .finish();
}

/** The unfolded sentry's hub (sits on its legs; the head turns above it). y = 0 at the hub's base. */
export function sentryBodyGeometry() {
  return new GeoBuilder({ flat: false })
    .cyl(0.075, 0.085, 0.07, 10, { color: C.navy })
    .torus(0.08, 0.012, 4, 12, { rx: Math.PI / 2, y: 0.05, color: C.orange })
    // the mast the head telescopes up on (its top hides inside the head until it rises)
    .cyl(0.028, 0.038, 0.13, 8, { y: 0.07, color: C.navyDark })
    .finish();
}

/** One leg, hinged at its top (y = 0), hanging down along −y; rotated out by the rig. */
export function sentryLegGeometry() {
  return new GeoBuilder({ flat: false })
    .box(0.026, 0.19, 0.03, { y: -0.19, color: C.steel })
    .sphere(0.022, 6, 4, { y: -0.19, color: C.navyDark })
    .finish();
}

/** The head: a cream housing, a navy visor band and an antenna with a sakura charm; the lens is its own part. */
export function sentryHeadGeometry() {
  return new GeoBuilder({ flat: false })
    .box(0.15, 0.085, 0.13, { y: -0.0425, color: C.cream })
    .box(0.152, 0.03, 0.132, { y: -0.012, color: C.navy })
    .cyl(0.006, 0.006, 0.12, 4, { x: -0.05, y: 0.04, z: -0.04, color: C.steel })
    .sphere(0.022, 8, 6, { x: -0.05, y: 0.165, z: -0.04, color: C.charm })
    .finish();
}

/** The lens (unlit, coloured per instance: teal armed, amber low battery). */
export function sentryLensGeometry() {
  return new GeoBuilder({ flat: false }).sphere(0.03, 10, 8, { sz: 0.55, color: '#ffffff' }).finish();
}

/**
 * The barrel module of each sentry type, forward = +z from the head's front face. The rig kicks it
 * back along −z when the sentry fires.
 */
export function barrelGeometry(type) {
  const b = new GeoBuilder({ flat: false });
  const fwd = (o = {}) => ({ rx: Math.PI / 2, ...o });
  switch (type) {
    case 'net':
      // a launcher drum and a short wide barrel
      b.cyl(0.05, 0.05, 0.07, 10, { rz: Math.PI / 2, x: 0.035, y: -0.04, z: 0.02, color: C.navyDark });
      b.cyl(0.03, 0.035, 0.09, 8, fwd({ y: -0.04, z: 0.05, color: C.steel }));
      b.cyl(0.033, 0.033, 0.015, 8, fwd({ y: -0.04, z: 0.135, color: C.orange }));
      break;
    case 'flash':
      // a lamp dish
      b.cyl(0.02, 0.02, 0.05, 6, fwd({ y: -0.04, z: 0.05, color: C.steel }));
      b.cone(0.06, 0.05, 10, { rx: -Math.PI / 2, y: -0.04, z: 0.14, color: C.cream });
      b.sphere(0.03, 8, 6, { y: -0.04, z: 0.1, color: '#fff6c8' });
      break;
    case 'heavy':
      // twin thick barrels
      for (const x of [-0.035, 0.035]) {
        b.cyl(0.024, 0.026, 0.15, 8, fwd({ x, y: -0.045, z: 0.06, color: C.steel }));
        b.cyl(0.026, 0.026, 0.02, 8, fwd({ x, y: -0.045, z: 0.21, color: C.orange }));
      }
      break;
    case 'flak':
      // twin barrels pointing up (for flyers)
      for (const x of [-0.03, 0.03]) {
        b.cyl(0.016, 0.018, 0.15, 6, { rx: Math.PI / 2 - 0.75, x, y: -0.03, z: 0.04, color: C.steel });
        b.cyl(0.018, 0.018, 0.015, 6, { rx: Math.PI / 2 - 0.75, x, y: 0.07, z: 0.135, color: C.orange });
      }
      break;
    default:
      b.cyl(0.018, 0.02, 0.14, 8, fwd({ y: -0.042, z: 0.06, color: C.steel }));
      b.cyl(0.021, 0.021, 0.018, 8, fwd({ y: -0.042, z: 0.2, color: C.orange }));
      break;
  }
  return b.finish();
}

/** Yuzuha's dart (a projectile mesh): a pale needle body, a sharp tip and cyan fins; forward = +z. */
export function dartGeometry() {
  const b = new GeoBuilder({ flat: false })
    .cyl(0.016, 0.016, 0.14, 6, { rx: Math.PI / 2, z: -0.07, color: C.dart })
    .cone(0.022, 0.07, 6, { rx: Math.PI / 2, z: 0.07, color: '#ffffff' });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    b.box(0.006, 0.05, 0.05, { rz: a, x: Math.sin(a) * 0.022, y: Math.cos(a) * 0.022 - 0.025, z: -0.06, color: C.dartFin });
  }
  return b.finish();
}

/**
 * The Capture Net lattice: a unit disc (radius 1) of 3 rings, 8 spokes and 8 rim weights, with an
 * `aR` attribute (each vertex's radial distance 0..1) that the net shader opens, lifts and cinches
 * into a bundle. Flat on y = 0.
 */
export function netGeometry() {
  const b = new GeoBuilder({ flat: false });
  for (const r of [0.36, 0.68, 0.98]) b.torus(r, 0.022, 3, 28, { rx: Math.PI / 2, color: r > 0.9 ? '#ffffff' : '#e6eef7' });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    b.box(0.03, 0.018, 0.98, { ry: a, x: Math.sin(a) * 0.49, z: Math.cos(a) * 0.49, color: '#e6eef7' });
    b.sphere(0.055, 6, 4, { x: Math.sin(a + 0.39) * 0.98, z: Math.cos(a + 0.39) * 0.98, color: C.orange });
  }
  const g = b.finish();
  const pos = g.attributes.position;
  const r = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) r[i] = Math.min(1, Math.hypot(pos.getX(i), pos.getZ(i)));
  g.setAttribute('aR', new THREE.BufferAttribute(r, 1));
  return g;
}

/** Every part's geometry, by part name (parts.js creates the meshes lazily from these). */
export const GEOMETRY = {
  ball: () => ballGeometry(),
  cap: capGeometry,
  pin: () => pinGeometry(),
  plate: plateGeometry,
  spikes: spikeRowGeometry,
  roll: stripRollGeometry,
  case: sentryCaseGeometry,
  body: sentryBodyGeometry,
  leg: sentryLegGeometry,
  head: sentryHeadGeometry,
  lens: sentryLensGeometry,
  'barrel:plain': () => barrelGeometry('plain'),
  'barrel:net': () => barrelGeometry('net'),
  'barrel:flash': () => barrelGeometry('flash'),
  'barrel:heavy': () => barrelGeometry('heavy'),
  'barrel:flak': () => barrelGeometry('flak'),
};

export { C as PLACED_COLORS };

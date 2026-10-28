// Tracks v3 — composed ground features a map can ask for (MapDef.ground), plus the road
// markings that keep busy junctions readable:
//   • vat      { type: 'vat', x, y, w, h }          a machined tank: square steel rim with hazard
//              stripes round a rectangle of water / molten metal (its mask keeps square edges)
//   • icefall  { type: 'icefall', x0, x1, y }       a frozen waterfall at a river head: an ice
//              shelf and an icicle curtain hanging over the water along y, from x0 to x1
//   • runeRing { type: 'runeRing', x, y, r }        a glowing rune circle painted under a junction
//   • flat junction chevrons (automatic): small painted arrows on every pass of a flat
//     crossing, a tile before and after it, pointing the way the road runs
// Pure geometry builders (vertex colours, flat normals) plus 'marks' that the ambient system
// draws with its ground sprite batches (animated glow / chevrons).
import * as THREE from 'three';
import { Acc } from './trackMesh.js';
import { mapTracks, pointAtDistance, inTunnel, underDeck, elevationAt } from '../core/track.js';

const HAZARD = new THREE.Color('#ffcc33');
const HAZARD_DARK = new THREE.Color('#2b2f36');
const RIM = new THREE.Color('#77808b');
const RIM_TOP = new THREE.Color('#a3abb5');
const ICE = ['#f4fbff', '#dff1fc', '#c6e6f8', '#acd6f0'].map((c) => new THREE.Color(c));

/** Small deterministic hash → [0, 1). */
function h01(...k) {
  let h = 2166136261;
  for (const v of k) {
    h ^= Math.round(v * 1000);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function buildVat(acc, f) {
  const { x, y, w, h } = f;
  const T = 0.09; // half thickness of the rim wall
  const H = 0.09; // half height (top at 0.18)
  const edges = [
    [x + w / 2, y, w / 2 + T, 1, 0],
    [x + w / 2, y + h, w / 2 + T, 1, 0],
    [x, y + h / 2, h / 2 + T, 0, 1],
    [x + w, y + h / 2, h / 2 + T, 0, 1],
  ];
  for (const [cx, cz, half, dx, dz] of edges) {
    acc.box(cx, H, cz, half, H, T, dx, dz, RIM);
    // hazard stripes along the top of the rim
    const n = Math.max(2, Math.round((half * 2) / 0.32));
    const seg = (half * 2) / n;
    for (let k = 0; k < n; k++) {
      const s = -half + seg * (k + 0.5);
      acc.box(cx + dx * s, H * 2 + 0.012, cz + dz * s, seg / 2, 0.012, T * 0.8, dx, dz, k % 2 ? HAZARD_DARK : HAZARD);
    }
  }
  // corner posts and a few rivet blocks
  for (const [px, pz] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) acc.box(px, 0.13, pz, 0.14, 0.13, 0.14, 1, 0, RIM_TOP);
}

function buildIcefall(acc, f) {
  const { x0, x1, y } = f;
  const yTop = 0.2;
  // the shelf: a low lip of ice slabs along the edge (the ice-cave mound rises behind it)
  for (let x = x0, k = 0; x < x1 - 0.05; x += 0.42, k++) {
    const depth = 0.3 + h01(x, y, 1) * 0.22;
    const half = 0.25 + h01(x, 2) * 0.07;
    const hh = 0.05 + h01(x, 3) * 0.04;
    acc.box(x + half, yTop - hh, y - depth / 2, half, hh, depth / 2, 1, (h01(x, 4) - 0.5) * 0.25, ICE[k % 2]);
  }
  // the curtain: icicles hanging from the shelf edge down into the river
  for (let x = x0 + 0.05; x < x1 - 0.04; x += 0.1 + h01(x, 6) * 0.08) {
    const len = 0.18 + h01(x, 7) * 0.32;
    const w = 0.035 + h01(x, 8) * 0.05;
    const z = y + 0.02 + h01(x, 9) * 0.05;
    const top = yTop + 0.02;
    const bottom = Math.max(0.0, top - len);
    const apex = [x, bottom, z + 0.02];
    const q = [[x - w, top, z - w], [x + w, top, z - w], [x + w, top, z + w], [x - w, top, z + w]];
    const inside = [x, (top + bottom) / 2 + 0.02, z];
    const col = ICE[1 + (Math.round(h01(x, 10) * 2) % 3)];
    for (let i = 0; i < 4; i++) acc.triOut(q[i], q[(i + 1) % 4], apex, inside, col);
  }
}

/**
 * @param {object} map MapDef (map.ground)
 * @returns {{ geometry: THREE.BufferGeometry|null, marks: object[], sharp: { x, y, w, h }[] }}
 *   sharp: tank rectangles (tiles) whose water / lava mask keeps square edges
 */
export function buildGroundFeatures(map) {
  const acc = new Acc();
  const marks = [];
  const sharp = [];
  for (const f of map.ground || []) {
    if (f.type === 'vat') {
      buildVat(acc, f);
      // a coolant tank ('~') squares the water mask, a crucible ('X') the lava mask
      sharp.push({ x: f.x, y: f.y, w: f.w, h: f.h, kind: map.rows?.[f.y]?.[f.x] === 'X' ? 'lava' : 'water' });
    } else if (f.type === 'icefall') buildIcefall(acc, f);
    else if (f.type === 'runeRing') marks.push({ kind: 'rune', x: f.x, z: f.y, r: f.r || 1.3, color: f.color || '#b48cff' });
  }
  marks.push(...junctionChevrons(map));
  return { geometry: acc.build(), marks, sharp };
}

/**
 * Painted direction chevrons on both passes of every flat junction: one ~1.3 tiles before the
 * crossing and one after it, so the order of the roads through a knot can be followed.
 * @param {object} map MapDef
 * @returns {{ kind: 'chevron', x, z, rot, track, d }[]} rot: ground-quad yaw (texture +u along travel)
 */
export function junctionChevrons(map) {
  const tracks = mapTracks(map);
  const flats = (map.crossings || []).filter((c) => c.mode === 'flat');
  const out = [];
  const tmp = {};
  for (const c of flats) {
    for (const pass of [c.a, c.b]) {
      const t = tracks[pass.path];
      for (const off of [-1.3, 1.3]) {
        const d = pass.d + off;
        if (d < 0.6 || d > t.length - 0.6 || inTunnel(t, d) || underDeck(t, d) || elevationAt(t, d) > 0.02) continue;
        pointAtDistance(t.points, t.cum, d, tmp);
        // keep off the other junctions' crossing zones
        if (flats.some((o) => Math.hypot(o.x - tmp.x, o.y - tmp.y) < 0.9)) continue;
        if (out.some((m) => Math.hypot(m.x - tmp.x, m.z - tmp.y) < 0.6)) continue;
        out.push({ kind: 'chevron', x: tmp.x, z: tmp.y, rot: Math.atan2(-tmp.dy, tmp.dx), track: pass.path, d });
      }
    }
  }
  return out;
}

/**
 * City crossings (Gate Arc `city` theme): at every flat junction, a zebra crosswalk on each arm
 * just outside the junction (inside the travel chevrons at ±1.3, which stay: they keep a knot
 * readable) and a box marking over the crossing itself. Ground marks drawn by the ambient batches
 * (0 draw calls). `rot` turns the quad's +u across the road.
 * @param {object} map MapDef
 * @returns {{ kind: 'zebra'|'junctionBox', x, z, rot }[]}
 */
export function crosswalkMarks(map) {
  const tracks = mapTracks(map);
  const flats = (map.crossings || []).filter((c) => c.mode === 'flat');
  const out = [];
  const tmp = {};
  for (const c of flats) {
    out.push({ kind: 'junctionBox', x: c.x, z: c.y, rot: boxRot(tracks, c, tmp) });
    for (const pass of [c.a, c.b]) {
      const t = tracks[pass.path];
      // the lifted (later) pass keeps its zebra outside the lifted zone
      const off = pass === c.b ? 1.0 : 0.82;
      for (const sgn of [-1, 1]) {
        const d = pass.d + sgn * off;
        if (d < 0.6 || d > t.length - 0.6 || inTunnel(t, d) || underDeck(t, d) || elevationAt(t, d) > 0.02) continue;
        pointAtDistance(t.points, t.cum, d, tmp);
        if (flats.some((o) => o !== c && Math.hypot(o.x - tmp.x, o.y - tmp.y) < 1.0)) continue;
        const rot = Math.atan2(-tmp.dx, -tmp.dy);
        out.push({ kind: 'zebra', x: tmp.x, z: tmp.y, rot });
      }
    }
  }
  return out;
}

/** Yaw of a junction's box marking: square to the first pass. */
function boxRot(tracks, c, tmp) {
  const t = tracks[c.a.path];
  pointAtDistance(t.points, t.cum, c.a.d, tmp);
  return Math.atan2(-tmp.dy, tmp.dx);
}

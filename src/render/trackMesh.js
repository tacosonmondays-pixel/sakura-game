// Tracks v3 — how the renderer draws the canonical centrelines (MapDef.tracks, src/core/track.js).
// The road ribbon follows exactly the points the sim walks (no re-smoothing), plus:
//   • off-board run-outs at real spawns / exits (so the road leaves the frame),
//   • flat junctions: the later pass is lifted a hair and drops its side bevels, so the two
//     road tops merge into one clean crossing,
//   • overpasses: the later pass rises on its elevation profile; railings and pillars,
//   • boardwalk / bridge decks wherever the centreline is over water (curved, plank by plank),
//   • tunnels: the road is buried between two portal arches under a low mound (enemies inside
//     are hidden by the sim and the renderer).
// `planRoads` is pure (testable in Node); the mesh builders return BufferGeometries.
import * as THREE from 'three';
import { mapTracks, pointAtDistance, elevationAt, inTunnel, stampBand, DECK_HALF } from '../core/track.js';

/** Half-length (along the upper pass) of a flat junction's lifted, bevel-less zone. */
export const JUNCTION_HALF = 0.8;
/** Keep pillars / tunnel mounds this far from any crossing point. */
const CROSS_CLEAR = 0.95;

/**
 * Pure drawing plan for a map's roads.
 * @param {object} map MapDef
 * @param {{ margin?: number, step?: number }} [o] off-board run-out length, section spacing
 * @returns {{ roads: object[], entrances: object[], exits: object[], extraTiles: Set<string>, crossings: object[] }}
 *   road = { index, pts: [[x, z]], d: number[] (distance along the track; < 0 / > length on run-outs),
 *            elev: number[], tunnel: boolean[], lift: number[], noSide: boolean[] }
 *   entrance / exit = { track, x, z (where the centreline crosses the board edge), tx, ty (edge tile), dir: [dx, dz] (unit, travel) }
 */
export function planRoads(map, { margin = 8, step = 0.2 } = {}) {
  const W = map.width;
  const H = map.height;
  const tracks = mapTracks(map);
  const crossings = map.crossings || [];
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const roads = [];
  const entrances = [];
  const exits = [];
  const extraTiles = new Set();
  const links = [];
  const tmp = {};
  tracks.forEach((t, ti) => {
    const L = t.length;
    const from = t.fork ? Math.max(0, t.forkD - 0.3) : 0;
    const to = t.join ? Math.min(L, t.joinD + 0.3) : L;
    const ds = [];
    if (!t.fork) for (let k = margin + 2; k > 0; k -= step) ds.push(-k);
    const n = Math.max(1, Math.round((to - from) / step));
    for (let k = 0; k <= n; k++) ds.push(from + ((to - from) * k) / n);
    if (!t.join) for (let k = step; k <= margin + 2 + 1e-9; k += step) ds.push(L + k);
    const pts = [];
    const elev = [];
    const tunnel = [];
    const lift = [];
    const noSide = [];
    pointAtDistance(t.points, t.cum, 0, tmp);
    const s0 = { x: tmp.x, y: tmp.y, dx: tmp.dx, dy: tmp.dy };
    pointAtDistance(t.points, t.cum, L, tmp);
    const s1 = { x: tmp.x, y: tmp.y, dx: tmp.dx, dy: tmp.dy };
    const head = [];
    const tail = [];
    for (const d of ds) {
      let x;
      let y;
      if (d < 0) {
        x = s0.x + s0.dx * d;
        y = s0.y + s0.dy * d;
        head.push([x, y]);
      } else if (d > L) {
        x = s1.x + s1.dx * (d - L);
        y = s1.y + s1.dy * (d - L);
        tail.push([x, y]);
      } else {
        pointAtDistance(t.points, t.cum, d, tmp);
        x = tmp.x;
        y = tmp.y;
      }
      const dc = Math.max(0, Math.min(L, d));
      pts.push([x, y]);
      elev.push(d >= 0 && d <= L ? elevationAt(t, dc) : 0);
      tunnel.push(d >= 0 && d <= L && inTunnel(t, dc));
      let up = 0;
      let bare = false;
      for (const c of crossings) {
        if (c.mode !== 'flat' || c.b.path !== ti) continue;
        if (Math.abs(d - c.b.d) < JUNCTION_HALF) {
          up = 1;
          bare = true;
        }
      }
      lift.push(up);
      noSide.push(bare);
    }
    // run-out tiles join the path set (frame gaps, no props on the road off the board)
    if (head.length) stampBand([...head, [s0.x, s0.y]], 0.5, extraTiles);
    if (tail.length) stampBand([[s1.x, s1.y], ...tail], 0.5, extraTiles);
    roads.push({ index: ti, pts, d: ds, elev, tunnel, lift, noSide });
    // where lanes fork off / merge in (no rails or posts across the seam)
    if (t.fork) {
      pointAtDistance(t.points, t.cum, t.forkD, tmp);
      links.push({ x: tmp.x, y: tmp.y });
    }
    if (t.join) {
      pointAtDistance(t.points, t.cum, t.joinD, tmp);
      links.push({ x: tmp.x, y: tmp.y });
    }
    // entrance: where the centreline first enters the board; exit: where it last leaves
    if (!t.fork) {
      const i = t.points.findIndex(([x, y]) => inside(x, y));
      if (i >= 0) entrances.push(edgePoint(t, i, true, ti, W, H));
    }
    if (!t.join) {
      let i = -1;
      for (let k = t.points.length - 1; k >= 0; k--) if (inside(t.points[k][0], t.points[k][1])) { i = k; break; }
      if (i >= 0) {
        const e = edgePoint(t, i, false, ti, W, H);
        if (!exits.some((o) => Math.hypot(o.x - e.x, o.z - e.z) < 0.6)) exits.push(e);
      }
    }
  });
  return { roads, entrances, exits, extraTiles, crossings, links };
}

/** Board-edge crossing near point i (entering: between i-1 and i; leaving: between i and i+1). */
function edgePoint(t, i, entering, ti, W, H) {
  const p = t.points;
  const a = entering ? p[Math.max(0, i - 1)] : p[i];
  const b = entering ? p[i] : p[Math.min(p.length - 1, i + 1)];
  let dx = b[0] - a[0];
  let dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  // walk from the inside point toward the outside one until the edge
  const inPt = entering ? b : a;
  const outPt = entering ? a : b;
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 20; k++) {
    const m = (lo + hi) / 2;
    const x = inPt[0] + (outPt[0] - inPt[0]) * m;
    const y = inPt[1] + (outPt[1] - inPt[1]) * m;
    if (x >= 0 && y >= 0 && x < W && y < H) lo = m;
    else hi = m;
  }
  let x = inPt[0] + (outPt[0] - inPt[0]) * lo;
  let y = inPt[1] + (outPt[1] - inPt[1]) * lo;
  // a track that starts / ends inside the board (rare) still gets its gate at that point
  if (Math.hypot(outPt[0] - inPt[0], outPt[1] - inPt[1]) < 1e-6) {
    x = inPt[0];
    y = inPt[1];
  }
  const tx = Math.max(0, Math.min(W - 1, Math.floor(x)));
  const ty = Math.max(0, Math.min(H - 1, Math.floor(y)));
  return { track: ti, x, z: y, tx, ty, dir: [dx, dy] };
}

// ---------------------------------------------------------------------------
// Mesh accumulation (vertex colours, flat normals)
// ---------------------------------------------------------------------------

class Acc {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
  }

  tri(a, b, c, color) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    this.pos.push(...a, ...b, ...c);
    for (let k = 0; k < 3; k++) {
      this.nor.push(nx, ny, nz);
      this.col.push(color.r, color.g, color.b);
    }
  }

  quad(a, b, c, d, color) {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  /** Oriented box: centre, half sizes (along, up, across), yaw so +along = (cos, sin) in xz. */
  box(cx, cy, cz, hl, hh, hw, dirX, dirZ, color) {
    const ax = dirX;
    const az = dirZ;
    const bx = -dirZ;
    const bz = dirX;
    const P = (sl, sh, sw) => [cx + ax * hl * sl + bx * hw * sw, cy + hh * sh, cz + az * hl * sl + bz * hw * sw];
    const v = [P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1), P(-1, 1, -1), P(1, 1, -1), P(1, 1, 1), P(-1, 1, 1)];
    const top = color;
    const side = this._shade || (this._shade = new THREE.Color());
    side.copy(color).multiplyScalar(0.82);
    this.quad(v[4], v[7], v[6], v[5], top);
    this.quad(v[0], v[1], v[5], v[4], side);
    this.quad(v[1], v[2], v[6], v[5], side);
    this.quad(v[2], v[3], v[7], v[6], side);
    this.quad(v[3], v[0], v[4], v[7], side);
  }

  /** Vertical cylinder-ish post (hexagonal prism). */
  post(x, y0, y1, z, r, color) {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const p0 = [x + Math.cos(a0) * r, y0, z + Math.sin(a0) * r];
      const p1 = [x + Math.cos(a1) * r, y0, z + Math.sin(a1) * r];
      const q0 = [p0[0], y1, p0[2]];
      const q1 = [p1[0], y1, p1[2]];
      this.quad(p0, q0, q1, p1, color);
      this.tri([x, y1, z], q1, q0, color);
    }
  }

  build() {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

const tangentAt = (pts, i) => {
  const a = pts[Math.max(0, i - 1)];
  const b = pts[Math.min(pts.length - 1, i + 1)];
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const l = Math.hypot(dx, dz) || 1;
  return [dx / l, dz / l];
};

/**
 * Plank decks with rails and piles wherever a road section is over water, and railings +
 * pillars along overpass decks.
 * @param {object[]} roads planRoads().roads
 * @param {(x: number, z: number) => boolean} isWaterAt world point over a water tile
 * @param {object} look theme look (look.bridge colours)
 * @param {{ pathH: number, waterY: number, crossings: object[] }} o
 * @returns {{ geometry: THREE.BufferGeometry|null, glows: object[], waterSections: Set<string> }}
 *   waterSections: "road:index" keys of sections drawn as decks (the ribbon skips them)
 */
export function buildDecks(roads, isWaterAt, look, { pathH, waterY, crossings = [], links = [] }) {
  const acc = new Acc();
  const glows = [];
  const deck = new THREE.Color(look.bridge.deck);
  const rail = new THREE.Color(look.bridge.rail);
  const post = new THREE.Color(look.bridge.post);
  const plank = new THREE.Color();
  // land overpass decks: the theme's overpass colour (or its bridge deck), girders a shade of the posts
  const over = new THREE.Color(look.bridge.overpass || look.bridge.deck);
  const girder = new THREE.Color(look.bridge.girder || look.bridge.post);
  const waterSections = new Set();
  const nearCrossing = (x, z, r = CROSS_CLEAR) => crossings.some((c) => Math.hypot(c.x - x, c.y - z) < r);
  const nearLink = (x, z) => links.some((c) => Math.hypot(c.x - x, c.y - z) < 1.3);
  for (const r of roads) {
    const { pts, elev, tunnel } = r;
    let railAcc = 0;
    let pileAcc = 0;
    let slabPrev = null;
    for (let i = 0; i < pts.length; i++) {
      if (tunnel[i]) continue;
      const [x, z] = pts[i];
      const water = isWaterAt(x, z);
      const e = elev[i];
      const [dx, dz] = tangentAt(pts, i);
      const nx = -dz;
      const nz = dx;
      const y = pathH + e;
      const segLen = i > 0 ? Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]) : 0;
      if (water) {
        waterSections.add(`${r.index}:${i}`);
        // planks butt together (no dark gaps that read as stair treads on a curve)
        plank.copy(deck).multiplyScalar(0.9 + (((i * 7) % 5) / 5) * 0.14);
        acc.box(x, y - 0.03, z, Math.max(0.085, segLen / 2 + 0.012), 0.03, 0.54, dx, dz, plank);
        // stringers under the planks
        if (i > 0) {
          const [px, pz] = pts[i - 1];
          const mx = (x + px) / 2;
          const mz = (z + pz) / 2;
          for (const s of [-0.38, 0.38]) acc.box(mx + nx * s, y - 0.09, mz + nz * s, segLen / 2 + 0.02, 0.025, 0.035, dx, dz, post);
        }
        pileAcc += segLen;
        if (pileAcc > 1.1 && !nearLink(x, z)) {
          pileAcc = 0;
          for (const s of [-0.44, 0.44]) acc.post(x + nx * s, waterY - 0.3, y - 0.05, z + nz * s, 0.05, post);
        }
      }
      // land overpass: its own deck slab (plank / slab colour, visible thickness, girder
      // fascia) built as a continuous strip that follows the ramp, so it reads as a raised
      // bridge — not as fence rails across the lower road
      if (!water && e > 0.015) {
        const W = DECK_HALF;
        const fd = Math.min(0.2, 0.04 + e * 0.3); // fascia depth grows with height
        const sec = {
          tl: [x + nx * W, y + 0.016, z + nz * W], tr: [x - nx * W, y + 0.016, z - nz * W],
          bl: [x + nx * W, y - fd, z + nz * W], br: [x - nx * W, y - fd, z - nz * W],
        };
        if (slabPrev && slabPrev.i === i - 1) {
          const P = slabPrev;
          plank.copy(over).multiplyScalar(0.9 + (((i * 7) % 5) / 5) * 0.16);
          acc.quad(P.tl, sec.tl, sec.tr, P.tr, plank);
          acc.quad(P.tl, P.bl, sec.bl, sec.tl, girder);
          acc.quad(P.tr, sec.tr, sec.br, P.br, girder);
          acc.quad(P.bl, P.br, sec.br, sec.bl, girder);
        }
        slabPrev = { ...sec, i };
      } else slabPrev = null;
      // rails on decks over water and on raised overpasses
      const railed = (water || e > 0.14) && !nearLink(x, z);
      if (railed) {
        railAcc += segLen;
        const prevRailed = i > 0 && !tunnel[i - 1] && (isWaterAt(pts[i - 1][0], pts[i - 1][1]) || elev[i - 1] > 0.14) && !nearLink(pts[i - 1][0], pts[i - 1][1]);
        if (prevRailed) {
          const [px, pz] = pts[i - 1];
          const py = pathH + elev[i - 1];
          for (const s of [-0.53, 0.53]) {
            const ax = px + nx * s;
            const az = pz + nz * s;
            const bx = x + nx * s;
            const bz = z + nz * s;
            const len = Math.hypot(bx - ax, bz - az) / 2;
            acc.box((ax + bx) / 2, (py + y) / 2 + 0.24, (az + bz) / 2, len + 0.01, 0.025, 0.03, dx, dz, rail);
            acc.box((ax + bx) / 2, (py + y) / 2 + 0.12, (az + bz) / 2, len + 0.01, 0.015, 0.02, dx, dz, rail);
          }
        }
        if (railAcc > 0.55 || !prevRailed) {
          railAcc = 0;
          for (const s of [-0.53, 0.53]) {
            acc.post(x + nx * s, y - 0.04, y + 0.3, z + nz * s, 0.035, post);
            if (look.bridge.lacquer && ((i * 13) % 7) === 0) glows.push({ x: x + nx * s, y: y + 0.36, z: z + nz * s, color: '#ffcf6b', size: 0.5, flicker: 0.12 });
          }
        }
      } else railAcc = 0;
      // overpass piers (never on the lower road): stout pairs with a cap beam
      if (!water && e > 0.3 && i % 5 === 0 && !nearCrossing(x, z, 1.25)) {
        const top = y - 0.2;
        for (const s of [-0.42, 0.42]) acc.box(x + nx * s, top / 2, z + nz * s, 0.09, top / 2, 0.09, dx, dz, girder);
        acc.box(x, top - 0.03, z, 0.1, 0.04, 0.52, dx, dz, girder);
      }
    }
  }
  // soft shadow band where each overpass deck spans the lower road
  const sh = new Acc();
  const black = new THREE.Color(0, 0, 0);
  for (const c of crossings) {
    if (c.mode !== 'bridge') continue;
    const pass = c[c.over];
    const r = roads.find((o) => o.index === pass.path);
    if (!r) continue;
    let k = 0;
    for (let i = 1; i < r.d.length; i++) if (Math.abs(r.d[i] - pass.d) < Math.abs(r.d[k] - pass.d)) k = i;
    const [ux, uz] = tangentAt(r.pts, k);
    const vx = -uz;
    const vz = ux;
    const sin = Math.max(0.35, Math.sin(((c.angle || 90) * Math.PI) / 180));
    const along = Math.min(1.5, 0.66 / sin);
    const across = DECK_HALF + 0.06;
    // light comes from the upper left: nudge the shadow a little toward +x/+z
    const cx = c.x + 0.06;
    const cz = c.y + 0.1;
    const y = pathH + 0.03;
    const P = (a, b) => [cx + ux * a + vx * b, y, cz + uz * a + vz * b];
    sh.quad(P(-along, -across), P(-along, across), P(along, across), P(along, -across), black);
  }
  return { geometry: acc.build(), glows, waterSections, shadow: sh.build() };
}

/**
 * Tunnel mounds and portal arches.
 * @param {object} map MapDef
 * @param {object} look theme look (look.tunnel colours)
 * @returns {{ geometry: THREE.BufferGeometry|null, portals: { x, z, dir: [dx, dz], end: 'in'|'out' }[], hallTiles: Set<string> }}
 *   hallTiles: building tiles replaced by a tunnel's composed hall / gatehouse (skip their generic props)
 */
export function buildTunnels(map, look) {
  const acc = new Acc();
  const tracks = mapTracks(map);
  const crossings = map.crossings || [];
  const tl = look.tunnel || {};
  const cTop = new THREE.Color(tl.top || '#86c46a');
  const cSide = new THREE.Color(tl.side || '#8a7a68');
  const cPortal = new THREE.Color(tl.portal || '#c9c1b4');
  const cDark = new THREE.Color(tl.dark || '#1c1822');
  const c = new THREE.Color();
  const portals = [];
  const tmp = {};
  const RX = 0.8;
  const RY = 0.55;
  const SEG = 8;
  const rows = map.rows || [];
  const isH = (x, y) => rows[y]?.[x] === 'H' && x > 0 && y > 0 && x < (map.width || 0) - 1 && y < (map.height || 0) - 1;
  const hallTiles = new Set();
  const cWall = new THREE.Color(tl.hall || tl.portal || '#cfc6b8');
  const cRoof = new THREE.Color(tl.roof || '#8a4b3c');
  tracks.forEach((t) => {
    for (const [d0, d1] of t.tunnels || []) {
      // A tunnel under buildings ('H' tiles beside it) becomes ONE composed hall / gatehouse set
      // piece over the buried road (instead of a mound hidden among generic building props).
      const near = new Set();
      for (let d = d0; d <= d1; d += 0.25) {
        pointAtDistance(t.points, t.cum, d, tmp);
        for (let y = Math.floor(tmp.y - 1.8); y <= Math.floor(tmp.y + 1.8); y++) {
          for (let x = Math.floor(tmp.x - 1.8); x <= Math.floor(tmp.x + 1.8); x++) {
            if (isH(x, y) && Math.hypot(x + 0.5 - tmp.x, y + 0.5 - tmp.y) < 1.75) near.add(`${x},${y}`);
          }
        }
      }
      if (near.size >= 2) {
        for (const k of near) hallTiles.add(k);
        const a = d0 + 0.3;
        const b = d1 - 0.3;
        const m = Math.max(2, Math.round((b - a) / 0.25));
        const P = [];
        for (let k = 0; k <= m; k++) {
          pointAtDistance(t.points, t.cum, a + ((b - a) * k) / m, tmp);
          P.push([tmp.x, tmp.y, tmp.dx, tmp.dy]);
        }
        for (let k = 1; k < P.length; k++) {
          const [x0, z0] = P[k - 1];
          const [x1, z1, dx, dz] = P[k];
          const mx = (x0 + x1) / 2;
          const mz = (z0 + z1) / 2;
          const half = Math.hypot(x1 - x0, z1 - z0) / 2 + 0.02;
          c.copy(cWall).multiplyScalar(0.93 + 0.07 * ((k % 3) / 2));
          acc.box(mx, 0.42, mz, half, 0.42, 0.98, dx, dz, c);
          acc.box(mx, 0.9, mz, half, 0.07, 1.14, dx, dz, cRoof);
          c.copy(cRoof).multiplyScalar(0.8);
          acc.box(mx, 1.02, mz, half, 0.06, 0.62, dx, dz, c);
          acc.box(mx, 1.12, mz, half, 0.05, 0.22, dx, dz, c);
          // pilasters every ~0.75 along the walls
          if (k % 3 === 0) for (const s of [-1, 1]) acc.box(mx - dz * s * 1.0, 0.42, mz + dx * s * 1.0, 0.06, 0.43, 0.05, dx, dz, cPortal);
        }
        // ridge finials at both gable ends
        for (const [x, z, dx, dz] of [P[0], P[P.length - 1]]) acc.box(x, 1.22, z, 0.08, 0.08, 0.08, dx, dz, cRoof);
      }
      const hall = near.size >= 2;
      // mound: arch cross-sections every 0.2 along the buried section (gaps where a road crosses over)
      const n = hall ? 0 : Math.max(2, Math.round((d1 - d0) / 0.2));
      let prev = null;
      for (let k = 0; k <= n; k++) {
        const d = d0 + ((d1 - d0) * k) / n;
        pointAtDistance(t.points, t.cum, d, tmp);
        const { x, y, dx, dy } = tmp;
        const blocked = crossings.some((cr) => cr.mode === 'tunnel' && Math.hypot(cr.x - x, cr.y - y) < CROSS_CLEAR);
        // taper the mound into the portals
        const edge = Math.min(d - d0, d1 - d) / 0.45;
        const taper = Math.max(0.35, Math.min(1, edge));
        const ring = [];
        for (let j = 0; j <= SEG; j++) {
          const a = (j / SEG) * Math.PI;
          const off = Math.cos(a) * RX;
          ring.push([x + -dy * off, Math.sin(a) * RY * taper + 0.02, y + dx * off, Math.sin(a)]);
        }
        if (prev && !blocked && !prev.blocked) {
          for (let j = 0; j < SEG; j++) {
            const h = (ring[j][3] + ring[j + 1][3]) / 2;
            c.copy(cSide).lerp(cTop, Math.min(1, h * 1.3));
            c.multiplyScalar(0.94 + 0.06 * Math.sin(d * 3 + j));
            const A = prev.ring[j];
            const B = prev.ring[j + 1];
            const C = ring[j + 1];
            const D = ring[j];
            acc.quad([A[0], A[1], A[2]], [D[0], D[1], D[2]], [C[0], C[1], C[2]], [B[0], B[1], B[2]], c);
          }
        }
        prev = { ring, blocked };
      }
      // portals at both mouths
      for (const [d, end] of [[d0, 'in'], [d1, 'out']]) {
        pointAtDistance(t.points, t.cum, d, tmp);
        const { x, y, dx, dy } = tmp;
        const sgn = end === 'in' ? -1 : 1;
        const px = x + dx * sgn * 0.02;
        const pz = y + dy * sgn * 0.02;
        portals.push({ x: px, z: pz, dir: [dx, dy], end });
        const nx = -dy;
        const nz = dx;
        const AR = 0.62;
        const steps = 10;
        // dark opening (a half disc facing along the road)
        for (let j = 0; j < steps; j++) {
          const a0 = (j / steps) * Math.PI;
          const a1 = ((j + 1) / steps) * Math.PI;
          const p0 = [px + nx * Math.cos(a0) * (AR - 0.1), Math.sin(a0) * (AR - 0.12) + 0.04, pz + nz * Math.cos(a0) * (AR - 0.1)];
          const p1 = [px + nx * Math.cos(a1) * (AR - 0.1), Math.sin(a1) * (AR - 0.12) + 0.04, pz + nz * Math.cos(a1) * (AR - 0.1)];
          const ctr = [px, 0.04, pz];
          acc.tri(ctr, p0, p1, cDark);
          acc.tri(ctr, p1, p0, cDark);
        }
        // stone arch: voussoir blocks round the opening
        for (let j = 0; j < 7; j++) {
          const a = ((j + 0.5) / 7) * Math.PI;
          const bx = px + nx * Math.cos(a) * AR;
          const bz = pz + nz * Math.cos(a) * AR;
          const by = Math.sin(a) * AR + 0.05;
          c.copy(cPortal).multiplyScalar(0.9 + (j % 2) * 0.12);
          acc.box(bx - dx * sgn * 0.02, by, bz - dy * sgn * 0.02, 0.1, 0.09, 0.1, dx, dy, c);
        }
        // footings
        for (const s of [-1, 1]) acc.box(px + nx * s * AR, 0.08, pz + nz * s * AR, 0.12, 0.08, 0.12, dx, dy, cPortal);
      }
    }
  });
  return { geometry: acc.build(), portals, hallTiles };
}

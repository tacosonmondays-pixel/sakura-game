// Modern-city kit (prototype): everything the city themes (themes.js: city / campus /
// citySurge) add on top of the usual terrain (terrain.js calls buildCity when look.city is set):
//
//   • buildings: one per rectangular block of H tiles on the board (MapDef.city.blocks says what
//     each is: glass tower, office, flats, shops with awnings, school with a clock, gym, clock
//     tower) and a skyline in the margin (tall at the back, low in front so the board stays clear),
//   • sidewalks with white kerbs along every road (on the ground; not on ramps, decks or
//     tunnels), zebra crossings beside the corners, streetlights and traffic lights,
//   • an elevated maglev guideway with a train gliding across (MapDef.city.maglev),
//   • the gate's swirling portal disc (the ring itself is the cityGate prop),
//   • hologram signs that blink, delivery drones crossing the sky,
//   • after the surge: crystal clusters along the streets and glowing cracks around them.
//
// Static geometry is baked into ONE facade mesh (+ the terrain's shared glow mesh); the moving
// parts are one mesh each (train, drones, drone shadows, holograms, portal).
import * as THREE from 'three';
import { GeoBuilder, makeRand, hash } from '../geo.js';
import { CityAcc, FK, createFacadeMaterial, createHoloMaterial, createPortalMaterial, HOLO_CELLS } from './cityMaterials.js';
import { buildBuilding, C, prim, FLOOR } from './buildings.js';

const PATH_H = 0.05;
/** Sidewalk: from the road edge out to SW_OUT, top at SW_Y (kerb = the step up from the road). */
const SW_IN = 0.47;
const SW_OUT = 0.84;
const SW_Y = 0.088;
const KERB = 0.07;
/** Maglev deck height when the map does not say. */
const MAGLEV_H = 2.1;
/** Ring centre height of the cityGate prop (props: cityGate). */
const GATE_CY = 1.22;
const HOLO_COLS = ['#7fe3ff', '#ff9ad5', '#b9a0ff', '#8ff0cf'];

/**
 * @param {object} o
 * @param {object} o.map MapDef (map.city: { blocks, maglev, areas, variant })
 * @param {object} o.look resolved look (look.city: { variant, sidewalk, kerb, crystals })
 * @param {object} o.plan planRoads() result
 * @param {(x: number, y: number) => boolean} o.isPath tile on a road
 * @param {Set<string>} o.occupied tiles with a prop
 * @param {object[]} o.gates terrain gate markers ({ kind, x, z, dir })
 * @param {object[]} o.portals tunnel portals ({ x, z, dir, end })
 * @param {Function} o.place terrain prop placer (type, x, y, z, ry, s, variant)
 * @param {THREE.BufferGeometry[]} o.glowParts the terrain's glow parts (merged into its glow mesh)
 * @param {string} o.quality
 * @param {boolean} o.shadows
 */
export function buildCity(o) {
  const { map, look, plan, isPath, occupied, gates, portals, place, glowParts, quality } = o;
  const W = map.width;
  const H = map.height;
  const cfg = { ...(look.city || {}), ...(map.city || {}) };
  const variant = cfg.variant || 'downtown';
  const surge = variant === 'surge' || !!look.city?.crystals;
  // war-torn surge: broken towers, wrecks, small fires and smoke (look.city.war)
  const war = !!look.city?.war;
  // modern era (an ordinary present-day home town): utility poles, houses, a railway
  const town = variant === 'town';
  const rand = makeRand(hash(map.id, 'city'));
  const inMap = (x, z) => x >= 0 && z >= 0 && x < W && z < H;
  const outsideDist = (x, z) => Math.hypot(Math.max(0, -x, x - W), Math.max(0, -z, z - H));
  const lowQ = quality === 'low';

  const acc = new CityAcc();
  let facadeMat = null;
  const glowB = new GeoBuilder();
  const holoV = { pos: [], col: [], uv: [], blink: [] };
  const disposables = [];
  const meshes = [];
  const glows = [];
  const emitters = [];

  const ex = {
    glowBox(x, y, z, w, h, d, color, ry = 0) {
      glowB.box(w, h, d, { x, y, z, ry, color });
    },
    prop(type, x, y, z, ry = 0, s = 1, variant2 = 0) {
      place(type, x, y, z, ry, s, variant2);
    },
    light(x, y, z, color, size = 0.8, flicker = 0.1) {
      glows.push({ x, y, z, color: new THREE.Color(color), size, flicker, phase: rand() * 6 });
    },
  };

  // ----- road samples on the ground (for clearances) ---------------------------------
  const ground = [];
  plan.roads.forEach((r) => {
    r.pts.forEach(([x, z], i) => {
      if (!r.tunnel[i] && r.elev[i] < 0.05) ground.push({ x, z, r: r.index, i });
    });
  });
  const grid = new Map();
  const gkey = (x, z) => `${Math.floor(x)},${Math.floor(z)}`;
  for (const p of ground) {
    const k = gkey(p.x, p.z);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(p);
  }
  /** Distance to the nearest road on the ground, ignoring road `r`'s samples near index `i`. */
  const roadDist = (x, z, r = -1, i = -1, skip = 14) => {
    let best = Infinity;
    const fx = Math.floor(x);
    const fz = Math.floor(z);
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const list = grid.get(`${fx + dx},${fz + dz}`);
        if (!list) continue;
        for (const p of list) {
          if (p.r === r && Math.abs(p.i - i) < skip) continue;
          const d = Math.hypot(p.x - x, p.z - z);
          if (d < best) best = d;
        }
      }
    }
    return best;
  };
  const crossings = (map.crossings || []).map((c) => [c.x, c.y]);
  const nearCrossing = (x, z, d) => crossings.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < d);
  const spawnGates = gates.filter((g) => g.kind === 'spawn');
  const nearGate = (x, z, d) => gates.some((g) => Math.hypot(g.x - x, g.z - z) < d);

  // ----- corners (heading turns ≥ 50°) ---------------------------------------------------
  const corners = [];
  for (const r of plan.roads) {
    const P = r.pts;
    const K = 5;
    let best = null;
    for (let i = K; i < P.length - K; i++) {
      const ax = P[i][0] - P[i - K][0];
      const az = P[i][1] - P[i - K][1];
      const bx = P[i + K][0] - P[i][0];
      const bz = P[i + K][1] - P[i][1];
      const la = Math.hypot(ax, az) || 1;
      const lb = Math.hypot(bx, bz) || 1;
      const turn = Math.acos(Math.max(-1, Math.min(1, (ax * bx + az * bz) / (la * lb))));
      if (turn > 0.85) {
        if (!best || turn > best.turn) best = { i, turn, ax: ax / la, az: az / la, bx: bx / lb, bz: bz / lb };
      } else if (best) {
        const [x, z] = P[best.i];
        // outward bisector: away from the inside of the turn
        let ox = best.ax - best.bx;
        let oz = best.az - best.bz;
        const l = Math.hypot(ox, oz) || 1;
        ox /= l;
        oz /= l;
        corners.push({ road: r, i: best.i, x, z, ox, oz, inDir: [best.ax, best.az], outDir: [best.bx, best.bz] });
        best = null;
      }
    }
  }

  // ----- sidewalks + kerbs -------------------------------------------------------------
  const cWalk = C(look.city?.sidewalk || '#f4eeea');
  const cKerb = C(look.city?.kerb || '#ffffff');
  const cKerbSide = C('#dfe4ec');
  const up = [0, 1, 0];
  const faceTo = (a, b, c, d, color, kind, uvs, want) => {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] >= 0) acc.quad(a, b, c, d, color, kind, uvs);
    else acc.quad(a, d, c, b, color, kind, uvs ? [uvs[0], uvs[3], uvs[2], uvs[1]] : null);
  };
  const walkOk = (r, i, s) => {
    if (r.tunnel[i] || r.elev[i] > 0.01) return false;
    const [x, z] = r.pts[i];
    if (outsideDist(x, z) > 7) return false;
    const a = r.pts[Math.max(0, i - 1)];
    const b = r.pts[Math.min(r.pts.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / l;
    const nz = (b[0] - a[0]) / l;
    const ox = x + nx * s * (SW_OUT - 0.02);
    const oz = z + nz * s * (SW_OUT - 0.02);
    if (roadDist(ox, oz, r.index, i) < SW_IN + 0.02) return false;
    // portal mouths: leave the approach clear
    for (const p of portals) if (Math.hypot(p.x - x, p.z - z) < 0.35) return false;
    return true;
  };
  for (const r of plan.roads) {
    const P = r.pts;
    let s = 0;
    const N = P.map((p, i) => {
      const a = P[Math.max(0, i - 1)];
      const b = P[Math.min(P.length - 1, i + 1)];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
    });
    const S = P.map((p, i) => {
      if (i > 0) s += Math.hypot(p[0] - P[i - 1][0], p[1] - P[i - 1][1]);
      return s;
    });
    for (const side of [-1, 1]) {
      const ok = P.map((_, i) => walkOk(r, i, side));
      for (let i = 1; i < P.length; i++) {
        if (!ok[i] || !ok[i - 1]) continue;
        const pt = (k, off, y) => [P[k][0] + N[k][0] * side * off, y, P[k][1] + N[k][1] * side * off];
        const out = [N[i][0] * side, 0, N[i][1] * side];
        const inn = [-out[0], 0, -out[2]];
        // kerb top + paving top
        const kIn = SW_IN;
        const kOut = SW_IN + KERB;
        faceTo(pt(i - 1, kIn, SW_Y), pt(i, kIn, SW_Y), pt(i, kOut, SW_Y), pt(i - 1, kOut, SW_Y), cKerb, 0, null, up);
        faceTo(pt(i - 1, kOut, SW_Y), pt(i, kOut, SW_Y), pt(i, SW_OUT, SW_Y), pt(i - 1, SW_OUT, SW_Y), cWalk, FK.paving,
          [[S[i - 1], 0], [S[i], 0], [S[i], SW_OUT - kOut], [S[i - 1], SW_OUT - kOut]], up);
        // kerb face (toward the road) + outer edge
        faceTo(pt(i - 1, kIn, PATH_H - 0.02), pt(i, kIn, PATH_H - 0.02), pt(i, kIn, SW_Y), pt(i - 1, kIn, SW_Y), cKerbSide, 0, null, inn);
        faceTo(pt(i - 1, SW_OUT, 0), pt(i, SW_OUT, 0), pt(i, SW_OUT, SW_Y), pt(i - 1, SW_OUT, SW_Y), cKerbSide, 0, null, out);
      }
    }
  }

  // ----- zebra crossings ---------------------------------------------------------------
  const zebra = [];
  const cZebra = C('#ffffff');
  for (const c of corners) {
    const r = c.road;
    for (const dir of [-1, 1]) {
      const k = c.i + dir * 9;
      if (k < 1 || k >= r.pts.length - 1) continue;
      const [x, z] = r.pts[k];
      if (!inMap(x, z) && outsideDist(x, z) > 1.5) continue;
      if (r.tunnel[k] || r.elev[k] > 0.005 || nearCrossing(x, z, 1.8) || nearGate(x, z, 1.3)) continue;
      if (zebra.some(([zx, zz]) => Math.hypot(zx - x, zz - z) < 2.5)) continue;
      if (zebra.length >= 8) break;
      zebra.push([x, z]);
      const a = r.pts[k - 1];
      const b = r.pts[k + 1];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const tx = (b[0] - a[0]) / l;
      const tz = (b[1] - a[1]) / l;
      const nx = -tz;
      const nz = tx;
      const y = PATH_H + 0.006;
      for (let q = -3; q <= 3; q++) {
        const off = q * 0.125;
        const cx = x + nx * off;
        const cz = z + nz * off;
        const hw = 0.04;
        const hl = 0.2;
        faceTo(
          [cx - nx * hw - tx * hl, y, cz - nz * hw - tz * hl], [cx + nx * hw - tx * hl, y, cz + nz * hw - tz * hl],
          [cx + nx * hw + tx * hl, y, cz + nz * hw + tz * hl], [cx - nx * hw + tx * hl, y, cz - nz * hw + tz * hl], cZebra, 0, null, up,
        );
      }
      // stop line before it
      const sx = x - tx * 0.32 * dir;
      const sz = z - tz * 0.32 * dir;
      faceTo(
        [sx - nx * 0.42 - tx * 0.02, y, sz - nz * 0.42 - tz * 0.02], [sx + nx * 0.42 - tx * 0.02, y, sz + nz * 0.42 - tz * 0.02],
        [sx + nx * 0.42 + tx * 0.02, y, sz + nz * 0.42 + tz * 0.02], [sx - nx * 0.42 + tx * 0.02, y, sz - nz * 0.42 + tz * 0.02], cZebra, 0, null, up,
      );
    }
  }

  // ----- street lights + traffic lights ----------------------------------------------------
  const furniture = [];
  const freeSpot = (x, z, d = 0.7) => !furniture.some(([fx, fz]) => Math.hypot(fx - x, fz - z) < d)
    && !occupied.has(`${Math.floor(x)},${Math.floor(z)}`);
  for (const c of corners) {
    const x = c.x + c.ox * 0.8;
    const z = c.z + c.oz * 0.8;
    if (outsideDist(x, z) > 2 || nearCrossing(x, z, 1.2) || nearGate(x, z, 1.4) || roadDist(x, z, c.road.index, c.i, 30) < 0.75) continue;
    if (!freeSpot(x, z)) continue;
    furniture.push([x, z]);
    place('trafficLight', x, SW_Y, z, Math.atan2(-c.ox, -c.oz), 1, 0);
  }
  const poleRuns = [];
  for (const r of plan.roads) {
    let acc2 = 1.2;
    let side = 1;
    let run = [];
    poleRuns.push(run);
    for (let i = 1; i < r.pts.length - 1; i++) {
      acc2 += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
      if (acc2 < 2.9) continue;
      const [x, z] = r.pts[i];
      if (outsideDist(x, z) > 4 || r.tunnel[i] || r.elev[i] > 0.01) continue;
      if (corners.some((c) => Math.hypot(c.x - x, c.z - z) < 1.1)) continue;
      const a = r.pts[i - 1];
      const b = r.pts[i + 1];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / l;
      const nz = (b[0] - a[0]) / l;
      if (!town) side = -side;
      for (const sd of town ? [side] : [side, -side]) {
        const px = x + nx * sd * 0.72;
        const pz = z + nz * sd * 0.72;
        if (!walkOk(r, i, sd) || nearGate(px, pz, 1.6) || nearCrossing(px, pz, 1.3) || !freeSpot(px, pz, 1.0)) continue;
        if (zebra.some(([zx, zz]) => Math.hypot(zx - px, zz - pz) < 0.8)) continue;
        furniture.push([px, pz]);
        const ry = Math.atan2(-nx * sd, -nz * sd);
        if (town) {
          // the run of poles breaks where one is skipped (corners, crossings)
          const last = run[run.length - 1];
          if (last && Math.hypot(last[0] - px, last[1] - pz) > 4.2) {
            run = [];
            poleRuns.push(run);
          }
          run.push([px, pz, ry]);
          place('utilityPole', px, SW_Y, pz, ry, 1, 0);
        } else place('streetLight', px, SW_Y, pz, ry, 1, 0);
        acc2 = 0;
        break;
      }
    }
  }

  // ----- overhead wires between the utility poles (modern era) ------------------------------
  if (town) {
    const cWire = C('#3d3a40');
    for (const run of poleRuns) {
      for (let k = 1; k < run.length; k++) {
        const [ax, az, ar] = run[k - 1];
        const [bx, bz, br] = run[k];
        for (const off of [-0.22, 0, 0.22]) {
          const a = [ax + Math.cos(ar) * off, SW_Y + 1.46, az - Math.sin(ar) * off];
          const b = [bx + Math.cos(br) * off, SW_Y + 1.46, bz - Math.sin(br) * off];
          const m = [(a[0] + b[0]) / 2, a[1] - 0.12, (a[2] + b[2]) / 2];
          for (const [p, q] of [[a, m], [m, b]]) wire(p, q, cWire);
        }
      }
    }
  }
  function wire(p, q, col) {
    // a thin dark strip (two crossed quads so it reads from any angle)
    const dx = q[0] - p[0];
    const dz = q[2] - p[2];
    const l = Math.hypot(dx, dz) || 1;
    const nx = (-dz / l) * 0.012;
    const nz = (dx / l) * 0.012;
    const t = 0.012;
    acc.quad([p[0] - nx, p[1], p[2] - nz], [q[0] - nx, q[1], q[2] - nz], [q[0] + nx, q[1], q[2] + nz], [p[0] + nx, p[1], p[2] + nz], col);
    acc.quad([p[0], p[1] - t, p[2]], [q[0], q[1] - t, q[2]], [q[0], q[1] + t, q[2]], [p[0], p[1] + t, p[2]], col);
    acc.quad([p[0], p[1] + t, p[2]], [q[0], q[1] + t, q[2]], [q[0], q[1] - t, q[2]], [p[0], p[1] - t, p[2]], col);
  }

  // ----- buildings on the board ----------------------------------------------------------
  const decorAt = new Set((map.decor || []).map((d) => `${d.x},${d.y}`));
  const blocks = cfg.blocks ? cfg.blocks.slice() : autoBlocks(map, decorAt);
  const frontOf = (b) => {
    // the side of the block that faces a road (shops put their awning there)
    const scores = { z: 0, '-z': 0, x: 0, '-x': 0 };
    for (let x = b.x; x < b.x + b.w; x++) {
      for (let k = 1; k <= 2; k++) {
        if (isPath(x, b.y + b.h - 1 + k) || (k === 1 && b.y + b.h >= H)) scores.z += 3 - k;
        if (isPath(x, b.y - k)) scores['-z'] += 3 - k;
      }
    }
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let k = 1; k <= 2; k++) {
        if (isPath(b.x + b.w - 1 + k, y)) scores.x += 3 - k;
        if (isPath(b.x - k, y)) scores['-x'] += 3 - k;
      }
    }
    // the camera looks from +z: prefer fronts it can see
    scores.z += 1.5;
    scores['-z'] -= 1.5;
    return Object.entries(scores).sort((p, q) => q[1] - p[1])[0][0];
  };
  blocks.forEach((b, k) => {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) occupied.add(`${x},${y}`);
    const spec = {
      ...b, cx: b.x + b.w / 2, cz: b.y + b.h / 2, w: b.w - 0.16, d: b.h - 0.16, front: b.front || frontOf(b), seed: k + hash(map.id, k) % 7,
    };
    if (war && (b.kind === 'glassTower' || b.kind === 'office' || b.kind === 'residential') && (k % 3 !== 2)) spec.kind = 'ruin';
    if (war) {
      spec.tint = spec.tint || '#b3aeb8';
      spec.war = true;
      spec.smoke = true;
    }
    if (b.kind === 'clockTower') {
      spec.w = b.w;
      spec.d = b.h;
    }
    buildBuilding(acc, spec, ex, rand);
    // a hologram on the street face of tall glass towers / offices on the board
    if (!war && !town && (b.kind === 'glassTower' || b.kind === 'office') && (b.floors || 0) >= 6 && spec.front !== '-z') {
      const ry = { z: 0, x: Math.PI / 2, '-x': -Math.PI / 2 }[spec.front] ?? 0;
      const fd = spec.front === 'x' || spec.front === '-x' ? spec.w : spec.d;
      const cs = Math.cos(ry);
      const sn = Math.sin(ry);
      holoPanel(spec.cx + sn * (fd / 2 + 0.08), 1.0, spec.cz + cs * (fd / 2 + 0.08), Math.min(0.9, spec.w * 0.6), 0.62, ry, k + 1, HOLO_COLS[k % 4], k * 0.37);
    }
  });

  // ----- skyline in the margin ------------------------------------------------------------
  const lots = [];
  const STEP = 2.1;
  const free = (cx, cz, half) => {
    for (const [dx, dz] of [[0, 0], [-half, -half], [half, -half], [-half, half], [half, half], [0, -half], [0, half], [-half, 0], [half, 0]]) {
      if (roadDist(cx + dx, cz + dz) < 1.05) return false;
    }
    return true;
  };
  for (let cz = -2.7 - STEP * 2; cz <= H + 2.7 + 1e-6; cz += STEP) {
    for (let cx = -2.7 - STEP * 2; cx <= W + 2.7 + STEP * 2 + 1e-6; cx += STEP) {
      // skip the board, its frame ring and the sidewalk ring round it
      if (cx > -2.0 && cx < W + 2.0 && cz > -2.0 && cz < H + 2.0) continue;
      if (cz > H + 4) continue;
      if (!free(cx, cz, 0.85)) continue;
      lots.push([cx, cz]);
    }
  }
  const skyKinds = ['glassTower', 'glassTower', 'office', 'residential', 'glassTower', 'office'];
  lots.forEach(([cx, cz], k) => {
    const h = hash(map.id, 'lot', k);
    const r01 = (h % 1000) / 1000;
    const back = cz < 0;
    const front = cz > H;
    const w = 1.45 + ((h >>> 4) % 40) / 100;
    const d = 1.45 + ((h >>> 8) % 40) / 100;
    if (town) {
      // home town: houses and small apartment blocks all round, cherry trees in the gaps
      if (front && r01 > 0.5) {
        place('sakura', cx, 0, cz, r01 * 6, 1.2, h % 4);
        return;
      }
      const kind = front ? 'house' : (h % 3 === 0 ? 'apartment' : 'house');
      const floors = kind === 'apartment' ? 3 + (h % 3) : 2;
      buildBuilding(acc, { cx, cz, w: w * (kind === 'house' ? 0.8 : 1), d: d * (kind === 'house' ? 0.75 : 1), kind, floors, front: 'z', seed: h % 9 }, ex, rand);
      if (h % 4 === 1) place('sakura', cx + w * 0.45, 0, cz + d * 0.4, r01 * 6, 1.0, h % 4);
      return;
    }
    if (front) {
      // in front of the board (near the camera): low shops and little green squares only
      if (war && r01 >= 0.55) {
        place(r01 > 0.8 ? 'wreckCar' : 'rubble', cx, 0, cz, r01 * 6, 1.2, h % 4);
        return;
      }
      if (r01 < 0.55) buildBuilding(acc, { cx, cz, w, d, kind: 'shop', floors: 1, front: 'z', awning: ['pink', 'mint', 'lemon', 'sky', 'lilac'][h % 5], seed: h % 9, war }, ex, rand);
      else {
        place('planterSakura', cx - 0.4, 0, cz, r01 * 6, 1, h % 4);
        place('planterSakura', cx + 0.45, 0, cz + 0.2, r01 * 3, 0.9, (h + 1) % 4);
      }
      return;
    }
    const depth = back ? Math.min(3, Math.round(-cz / STEP)) : Math.min(3, Math.round(Math.max(-cx, cx - W) / STEP));
    let floors;
    if (back) floors = 5 + depth * 2 + (h % 7);
    else floors = 2 + depth + (h % 4);
    if (lowQ && !back) floors = Math.min(floors, 4);
    let kind = skyKinds[h % skyKinds.length];
    if (war && (h >>> 5) % 10 < 6) kind = 'ruin';
    const roofs = ['ac', 'garden', 'solar', 'helipad', 'ac'];
    // smoke only from ruins next to the board, and only some (particles are a shared pool)
    const smoke = war && kind === 'ruin' && depth <= 1 && h % 3 === 0;
    buildBuilding(acc, { cx, cz, w, d, kind, floors, roof: roofs[(h >>> 3) % roofs.length], front: 'z', seed: h % 9, tint: war ? '#a9a4ae' : undefined, smoke }, ex, rand);
    if (!war && back && kind === 'glassTower' && (h % 3 === 0)) holoPanel(cx, 0.9 + (h % 3) * 0.6, cz + d / 2 + 0.06, 0.9, 0.62, 0, h % 8, HOLO_COLS[h % 4], r01 * 3);
  });

  // ----- set-piece holograms (decor holoSign) ------------------------------------------
  for (const d of map.decor || []) {
    if (d.type !== 'holoSign') continue;
    const k = hash(map.id, 'holo', d.x, d.y);
    holoPanel(d.x + 0.5, 0.56, d.y + 0.5, 0.62, 0.48, d.rot ?? 0, k % 8, HOLO_COLS[k % 4], (k % 100) / 30);
  }

  // ----- railway at street level with a level crossing (modern era) -----------------------
  let train2 = null;
  if (cfg.railway) {
    const rz = cfg.railway.z;
    const x0 = -10;
    const x1 = W + 10;
    acc.box((x0 + x1) / 2, 0, rz, x1 - x0, 0.03, 0.72, { color: C('#a49d93') });
    // where a road crosses the line (the rails run over the road, no sleepers there)
    const cross = [];
    for (const r of plan.roads) {
      for (let i = 1; i < r.pts.length; i++) {
        const [ax, az] = r.pts[i - 1];
        const [bx, bz] = r.pts[i];
        if ((az - rz) * (bz - rz) <= 0 && az !== bz) cross.push(ax + ((rz - az) / (bz - az)) * (bx - ax));
      }
    }
    const onRoad = (x) => cross.some((c) => Math.abs(c - x) < 0.62);
    for (let x = x0 + 0.1; x < x1; x += 0.24) if (!onRoad(x)) acc.box(x, 0.03, rz, 0.08, 0.025, 0.6, { color: C('#8a6e58') });
    for (const s of [-1, 1]) acc.box((x0 + x1) / 2, 0.055, rz + s * 0.19, x1 - x0, 0.03, 0.035, { color: C('#c7ccd2') });
    for (const cx of cross) {
      // crossing deck, gates on both sides, the warning posts facing the road
      acc.box(cx, PATH_H, rz, 1.0, 0.012, 0.66, { color: C('#7f7a75') });
      place('crossingGate', cx - 0.72, SW_Y - 0.03, rz - 0.5, 0, 1, 0);
      place('crossingGate', cx + 0.72, SW_Y - 0.03, rz + 0.5, Math.PI, 1, 0);
    }
    // a cream-and-green commuter train
    const t = new CityAcc();
    const carL = 1.3;
    for (let k = 0; k < 4; k++) {
      const cx = (k - 1.5) * (carL + 0.05);
      t.box(cx, 0, 0, carL, 0.36, 0.42, { color: C('#f3efe2'), side: FK.office, v0: 0.12 });
      t.box(cx, 0.06, 0, carL + 0.004, 0.06, 0.424, { color: C('#4fae6a') });
      t.box(cx, 0.24, 0, carL + 0.004, 0.02, 0.424, { color: C('#e8a23a') });
      t.box(cx, 0.36, 0, carL - 0.06, 0.04, 0.38, { color: C('#c9c4b8') });
      t.box(cx + carL * 0.25, 0.4, 0, 0.3, 0.05, 0.16, { color: C('#8f8a80') });
    }
    const geo = t.build();
    disposables.push(geo);
    train2 = new THREE.Mesh(geo, getFacade());
    train2.name = 'cityTrain';
    train2.position.set(x0, 0.09, rz);
    train2.userData = { x0: x0 - 4, x1: x1 + 4, period: 16, cast: true };
    meshes.push(train2);
  }

  // ----- maglev ------------------------------------------------------------------------
  let train = null;
  if (cfg.maglev) {
    const mz = cfg.maglev.z;
    const mh = cfg.maglev.h ?? MAGLEV_H;
    const x0 = -10;
    const x1 = W + 10;
    const white = C('#f7f9fc');
    // spans of guideway (a broken line after the surge: a gap with one span fallen in)
    const gap = cfg.maglev.broken;
    const spans = gap ? [[x0, gap[0]], [gap[1], x1]] : [[x0, x1]];
    const deck = war ? C('#b8b3bc') : white;
    for (const [a0, a1] of spans) {
      const mx = (a0 + a1) / 2;
      const len = a1 - a0;
      acc.box(mx, mh - 0.18, mz, len, 0.18, 0.34, { color: deck });
      acc.box(mx, mh - 0.24, mz, len, 0.06, 0.22, { color: C(war ? '#8f8a94' : '#c9d6e8') });
      acc.box(mx, mh, mz - 0.13, len, 0.05, 0.04, { color: C(war ? '#a29da8' : '#dfe6f0') });
      acc.box(mx, mh, mz + 0.13, len, 0.05, 0.04, { color: C(war ? '#a29da8' : '#dfe6f0') });
      if (!war) glowB.box(len, 0.025, 0.01, { x: mx, y: mh - 0.11, z: mz + 0.172, color: '#ffb8de' });
    }
    if (gap) {
      // the fallen span leans from the broken end down to the street
      const len = gap[1] - gap[0];
      acc.box((gap[0] + gap[1]) / 2, mh * 0.42, mz + 0.1, len * 1.02, 0.18, 0.34, { rz: -Math.atan2(mh * 0.9, len), color: C('#9f9aa4') });
      place('smokeColumn', gap[0] + len * 0.75, 0, mz + 0.3, 0, 1.2, 0);
      place('rubble', gap[0] + len * 0.6, 0, mz + 0.5, 0.5, 1.4, 1);
    }
    for (const px of cfg.maglev.pillars || []) {
      acc.box(px, 0, mz, 0.22, 0.08, 0.22, { color: C('#e9edf3') });
      acc.box(px, 0.08, mz, 0.15, mh - 0.36, 0.15, { color: white });
      acc.box(px, mh - 0.36, mz, 0.24, 0.12, 0.42, { color: white });
      glowB.box(0.02, 0.6, 0.02, { x: px, y: 0.5, z: mz + 0.077, color: '#9fe6ff' });
    }
    // the train: three white cars, a sky-glass window band, a pink stripe (none after the surge)
    const t = new CityAcc();
    const carL = 1.25;
    for (let k = 0; k < 3; k++) {
      const cx = (k - 1) * (carL + 0.06);
      t.box(cx, 0, 0, carL, 0.1, 0.3, { color: C('#ffffff') });
      t.box(cx, 0.1, 0, carL, 0.13, 0.3, { color: C('#ffffff'), side: FK.glass, v0: 0.5 });
      t.box(cx, 0.23, 0, carL, 0.05, 0.28, { color: C('#eef2f8') });
      t.box(cx, 0.06, 0, carL + 0.002, 0.025, 0.302, { color: C('#ff9cc2') });
    }
    for (const s of [-1, 1]) {
      // rounded noses
      prim(t, new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI), { x: s * (1.5 * carL + 0.06), y: 0.14, ry: s > 0 ? Math.PI / 2 : -Math.PI / 2, sx: 1, sy: 0.95, sz: 1.9 }, C('#ffffff'));
      prim(t, new THREE.SphereGeometry(0.152, 12, 8, 0, Math.PI, 0, Math.PI * 0.42), { x: s * (1.5 * carL + 0.06), y: 0.14, ry: s > 0 ? Math.PI / 2 : -Math.PI / 2, sz: 1.9 }, C('#6fb4e0'));
    }
    const geo = t.build();
    const mat = getFacade();
    train = war ? null : new THREE.Mesh(geo, mat);
    if (war) geo.dispose();
  }
  if (train) {
    const mh = cfg.maglev.h ?? MAGLEV_H;
    const mz = cfg.maglev.z;
    const x0 = -10;
    const x1 = W + 10;
    const geo = train.geometry;
    train.name = 'cityTrain';
    train.position.set(x0, mh + 0.03, mz);
    train.userData = { x0: x0 - 3, x1: x1 + 3, period: 13, cast: true };
    disposables.push(geo);
    meshes.push(train);
  }

  // ----- subway portals: a roundel sign beside each mouth ------------------------------------
  for (const p of portals) {
    const [dx, dz] = p.dir;
    const nx = -dz;
    const nz = dx;
    const sgn = p.end === 'in' ? -1 : 1;
    const x = p.x + nx * 0.98 + dx * sgn * 0.25;
    const z = p.z + nz * 0.98 + dz * sgn * 0.25;
    if (roadDist(x, z) < 0.62) continue;
    acc.box(x, 0, z, 0.05, 0.62, 0.05, { color: C('#ffffff') });
    prim(acc, new THREE.CylinderGeometry(0.15, 0.15, 0.04, 18), { x, y: 0.72, z, rx: Math.PI / 2, ry: Math.atan2(dx * sgn, dz * sgn) }, C('#ffffff'));
    glowB.add(new THREE.TorusGeometry(0.15, 0.03, 4, 18), { x, y: 0.72, z, ry: Math.atan2(dx * sgn, dz * sgn), color: '#ff7fb0' });
    glowB.box(0.16, 0.04, 0.05, { x, y: 0.7, z, ry: Math.atan2(dx * sgn, dz * sgn), color: '#7fd0ff' });
    ex.light(x, 0.72, z, '#ff9cc2', 0.6, 0.05);
  }

  // ----- gate portals ----------------------------------------------------------------------
  const portalMat = createPortalMaterial(look.city?.portal);
  disposables.push(portalMat);
  for (const g of spawnGates) {
    const geo = new THREE.CircleGeometry(0.99, 48);
    disposables.push(geo);
    const m = new THREE.Mesh(geo, portalMat);
    m.name = 'cityPortal';
    m.position.set(g.x, GATE_CY, g.z);
    m.rotation.y = Math.atan2(g.dir[0], g.dir[1]);
    m.renderOrder = 4;
    m.userData.cast = false;
    meshes.push(m);
    // light pool on the paving in front of the ring
    ex.light(g.x + g.dir[0] * 0.6, 0.15, g.z + g.dir[1] * 0.6, '#ffc6ee', 2.4, 0.18);
  }

  // ----- after the surge: crystals overgrowing the streets, glowing cracks ------------
  if (surge) {
    const spots = [];
    for (const r of plan.roads) {
      let a = 0;
      for (let i = 1; i < r.pts.length - 1; i++) {
        a += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
        if (a < 1.5) continue;
        a = 0;
        const [x, z] = r.pts[i];
        if (outsideDist(x, z) > 3 || r.tunnel[i] || r.elev[i] > 0.01 || nearGate(x, z, 2.0)) continue;
        const hh = hash(map.id, 'cr', r.index, i);
        if (hh % 100 > 52) continue;
        const b = r.pts[i + 1];
        const pa = r.pts[i - 1];
        const l = Math.hypot(b[0] - pa[0], b[1] - pa[1]) || 1;
        const nx = -(b[1] - pa[1]) / l;
        const nz = (b[0] - pa[0]) / l;
        const sd = hh % 2 ? 1 : -1;
        const px = x + nx * sd * 0.78;
        const pz = z + nz * sd * 0.78;
        if (!walkOk(r, i, sd) || !freeSpot(px, pz, 0.8)) continue;
        furniture.push([px, pz]);
        spots.push([px, pz, nx * sd, nz * sd]);
        place('crystalSmall', px, SW_Y - 0.02, pz, (hh % 628) / 100, 0.85 + (hh % 30) / 100, hh % 4);
      }
    }
    // the gate's crystal field: clusters on the paving round the ring
    for (const g of spawnGates) {
      const nx = -g.dir[1];
      const nz = g.dir[0];
      for (const [along, across, s] of [[1.3, -1.7, 1.0], [1.9, 1.75, 0.85], [0.6, 2.6, 0.7], [0.7, -2.7, 0.75]]) {
        const x = g.x + g.dir[0] * along + nx * across;
        const z = g.z + g.dir[1] * along + nz * across;
        if (roadDist(x, z) < 0.8 || !freeSpot(x, z, 0.9)) continue;
        furniture.push([x, z]);
        spots.push([x, z, 0, 0]);
        place('gateCrystal', x, 0, z, along * 2, s, Math.round(across + 3));
      }
    }
    // glowing cracks: short jagged lines from each crystal across the paving / road
    const cr = makeRand(hash(map.id, 'cracks'));
    const crackCols = ['#ff9ad5', '#b996ff', '#8fe4ff'];
    for (const [x, z, ox, oz] of spots) {
      const n = 2 + Math.floor(cr() * 2);
      for (let k = 0; k < n; k++) {
        let a = Math.atan2(-oz, -ox) + (cr() - 0.5) * 2.2;
        if (!ox && !oz) a = cr() * Math.PI * 2;
        let px = x;
        let pz = z;
        const segs = 3 + Math.floor(cr() * 3);
        const col = crackCols[(k + Math.floor(cr() * 3)) % 3];
        for (let s = 0; s < segs; s++) {
          const len = 0.18 + cr() * 0.2;
          a += (cr() - 0.5) * 1.1;
          const qx = px + Math.cos(a) * len;
          const qz = pz + Math.sin(a) * len;
          const d0 = roadDist(px, pz);
          const y = d0 < SW_IN - 0.03 ? PATH_H + 0.008 : d0 < SW_OUT ? SW_Y + 0.004 : 0.006;
          const w = 0.022 * (1 - s / (segs + 1));
          const mx = (px + qx) / 2;
          const mz = (pz + qz) / 2;
          const ang = Math.atan2(qx - px, qz - pz);
          glowB.box(w, 0.004, len + 0.02, { x: mx, y, z: mz, ry: ang, color: col });
          px = qx;
          pz = qz;
        }
      }
    }
  }

  // ----- war: wrecked cars along the kerbs, small fires beside some of them ---------------
  if (war) {
    for (const r of plan.roads) {
      let a = 0;
      for (let i = 1; i < r.pts.length - 1; i++) {
        a += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
        if (a < 3.4) continue;
        const [x, z] = r.pts[i];
        if (outsideDist(x, z) > 2.5 || r.tunnel[i] || r.elev[i] > 0.01 || nearGate(x, z, 2.2)) continue;
        const hh = hash(map.id, 'wreck', r.index, i);
        if (hh % 100 > 55) continue;
        const b = r.pts[i + 1];
        const pa = r.pts[i - 1];
        const l = Math.hypot(b[0] - pa[0], b[1] - pa[1]) || 1;
        const tx = (b[0] - pa[0]) / l;
        const tz = (b[1] - pa[1]) / l;
        const sd = hh % 2 ? 1 : -1;
        const px = x - tz * sd * 0.86;
        const pz = z + tx * sd * 0.86;
        if (!walkOk(r, i, sd) || !freeSpot(px, pz, 1.0) || inMap(px, pz) && occupied.has(`${Math.floor(px)},${Math.floor(pz)}`)) continue;
        a = 0;
        furniture.push([px, pz]);
        place(hh % 3 === 0 ? 'wreckVan' : 'wreckCar', px, SW_Y - 0.03, pz, Math.atan2(tx, tz) + (hh % 7 - 3) * 0.12, 0.85, hh % 4);
        if (hh % 4 < 2) place('fireSmall', px + tx * 0.42, SW_Y, pz + tz * 0.42, 0, 0.9, 0);
      }
    }
  }

  // ----- campus: little extras on the field and court ------------------------------------
  for (const a of cfg.areas || []) {
    if (a.type === 'field') {
      // football goals at both ends of the field
      for (const s of [-1, 1]) {
        const gx = a.x + a.w / 2 + s * (a.w / 2 - 0.55);
        const gz = a.y + a.h / 2;
        for (const q of [-1, 1]) acc.box(gx, 0, gz + q * 0.42, 0.04, 0.34, 0.04, { color: C('#ffffff') });
        acc.box(gx, 0.34, gz, 0.04, 0.04, 0.88, { color: C('#ffffff') });
        acc.box(gx + s * 0.18, 0, gz, 0.02, 0.02, 0.84, { color: C('#e6ebf2') });
      }
    }
    if (a.type === 'court') {
      const gx = a.x + a.w / 2;
      for (const s of [-1, 1]) {
        const gz = a.y + a.h / 2;
        const px = gx + s * (a.w / 2 - 0.15);
        acc.box(px, 0, gz, 0.05, 0.62, 0.05, { color: C('#ffffff') });
        acc.box(px - s * 0.1, 0.55, gz, 0.16, 0.12, 0.02, { color: C('#ffffff') });
        prim(acc, new THREE.TorusGeometry(0.06, 0.01, 3, 12), { x: px - s * 0.2, y: 0.5, z: gz, rx: Math.PI / 2 }, C('#ff9cc2'));
      }
    }
  }

  // ----- drones -----------------------------------------------------------------------
  const nDrones = war || town ? 0 : quality === 'high' ? 7 : quality === 'medium' ? 4 : 2;
  let drones = null;
  let droneShadows = null;
  const flights = [];
  if (nDrones > 0) {
    const d = new CityAcc();
    d.box(0, -0.035, 0, 0.16, 0.07, 0.16, { color: C('#ffffff') });
    d.box(0, 0.035, 0, 0.1, 0.03, 0.1, { color: C('#ff9cc2') });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      d.box(sx * 0.1, -0.005, sz * 0.1, 0.16, 0.02, 0.02, { ry: Math.PI / 4 * sx * sz, color: C('#dfe6f0') });
      prim(d, new THREE.CylinderGeometry(0.075, 0.075, 0.008, 12), { x: sx * 0.16, y: 0.02, z: sz * 0.16 }, C('#cfeaf8'));
    }
    // a little parcel
    d.box(0, -0.13, 0, 0.1, 0.08, 0.1, { color: C('#ffe08a') });
    d.box(0, -0.09, 0, 0.102, 0.01, 0.03, { color: C('#ff9cc2') });
    const geo = d.build();
    disposables.push(geo);
    drones = new THREE.InstancedMesh(geo, getFacade(), nDrones);
    drones.name = 'cityDrones';
    drones.frustumCulled = false;
    drones.userData.cast = false;
    meshes.push(drones);
    const sg = new THREE.CircleGeometry(0.16, 14);
    sg.rotateX(-Math.PI / 2);
    disposables.push(sg);
    const sm = new THREE.MeshBasicMaterial({ color: 0x1a2240, transparent: true, opacity: 0.16, depthWrite: false });
    disposables.push(sm);
    droneShadows = new THREE.InstancedMesh(sg, sm, nDrones);
    droneShadows.name = 'cityDroneShadows';
    droneShadows.frustumCulled = false;
    droneShadows.renderOrder = 3;
    droneShadows.userData.cast = false;
    meshes.push(droneShadows);
    const dr = makeRand(hash(map.id, 'drones'));
    for (let i = 0; i < nDrones; i++) {
      const a = (dr() - 0.5) * 1.2 + (i % 2 ? Math.PI : 0);
      const cx = W * (0.15 + dr() * 0.7);
      const cz = H * (0.1 + dr() * 0.8);
      flights.push({ cx, cz, dx: Math.cos(a), dz: Math.sin(a), y: 2.5 + dr() * 0.9, sp: 0.9 + dr() * 0.7, ph: dr() * 100, L: W + 14 });
    }
  }

  // ----- holograms mesh --------------------------------------------------------------------
  let holoMat = null;
  if (holoV.pos.length) {
    holoMat = createHoloMaterial();
    disposables.push(holoMat, holoMat.map);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(holoV.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(holoV.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(holoV.uv, 2));
    g.setAttribute('blink', new THREE.Float32BufferAttribute(holoV.blink, 1));
    g.computeBoundingSphere();
    disposables.push(g);
    const m = new THREE.Mesh(g, holoMat);
    m.name = 'cityHolo';
    m.renderOrder = 5;
    m.userData.cast = false;
    meshes.push(m);
  }

  function holoPanel(x, y, z, w, h, ry, cell, color, phase) {
    const c = new THREE.Color(color);
    const cs = Math.cos(ry);
    const sn = Math.sin(ry);
    const P = (lx, ly) => [x + lx * cs, y + ly, z - lx * sn];
    const ci = cell % 8;
    const u0 = (ci % 4) / 4;
    const u1 = u0 + 0.25;
    const v1 = 1 - Math.floor(ci / 4) * 0.5;
    const v0 = v1 - 0.5;
    const quad = [[P(-w / 2, 0), [u0, v0]], [P(w / 2, 0), [u1, v0]], [P(w / 2, h), [u1, v1]], [P(-w / 2, h), [u0, v1]]];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      holoV.pos.push(...quad[k][0]);
      holoV.col.push(c.r, c.g, c.b);
      holoV.uv.push(...quad[k][1]);
      holoV.blink.push(phase);
    }
    // a faint beam from the base up to the panel
    glows.push({ x, y: y + h / 2, z, color: c.clone(), size: Math.max(w, h) * 1.6, flicker: 0.2, phase });
  }

  // ----- facade mesh + glow parts ----------------------------------------------------------
  function getFacade() {
    if (!facadeMat) {
      facadeMat = createFacadeMaterial(look.city?.glass);
      disposables.push(facadeMat);
    }
    return facadeMat;
  }
  const facadeGeo = acc.build();
  if (facadeGeo) {
    disposables.push(facadeGeo);
    const m = new THREE.Mesh(facadeGeo, getFacade());
    m.name = 'cityFacade';
    m.matrixAutoUpdate = false;
    m.userData.cast = true;
    meshes.unshift(m);
  }
  const glowGeo = glowB.finish();
  if (glowGeo) glowParts.push(glowGeo);

  // ----- per-frame ---------------------------------------------------------------------
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eu = new THREE.Euler();
  const sc = new THREE.Vector3(1, 1, 1);
  const pv = new THREE.Vector3();
  function update(time) {
    if (facadeMat) facadeMat.userData.uniforms.uTime.value = time;
    if (holoMat) holoMat.userData.uniforms.uTime.value = time;
    portalMat.uniforms.uTime.value = time;
    for (const tr of [train, train2]) {
      if (!tr) continue;
      const u = tr.userData;
      const k = (time % u.period) / u.period;
      // glide across in 70 % of the period, then wait off screen
      const t = Math.min(1, k / 0.7);
      const e = t * t * (3 - 2 * t) * 0.35 + t * 0.65;
      tr.position.x = u.x0 + (u.x1 - u.x0) * e;
    }
    if (drones) {
      flights.forEach((f, i) => {
        const s = ((time * f.sp + f.ph) % f.L) - f.L / 2;
        const x = f.cx + f.dx * s;
        const z = f.cz + f.dz * s;
        const y = f.y + Math.sin(time * 2.1 + f.ph) * 0.06;
        eu.set(Math.sin(time * 1.7 + i) * 0.06, Math.atan2(f.dx, f.dz), 0.08);
        q.setFromEuler(eu);
        m4.compose(pv.set(x, y, z), q, sc);
        drones.setMatrixAt(i, m4);
        m4.compose(pv.set(x + y * 0.5, 0.02, z - y * 0.58), q.identity(), sc);
        droneShadows.setMatrixAt(i, m4);
      });
      drones.instanceMatrix.needsUpdate = true;
      droneShadows.instanceMatrix.needsUpdate = true;
    }
  }
  update(0);

  return {
    meshes,
    glows,
    emitters,
    update,
    dispose() {
      for (const d of disposables) d.dispose?.();
    },
    stats: { blocks: blocks.length, lots: lots.length, lights: furniture.length, zebra: zebra.length, corners: corners.length },
  };
}

/** Rectangular blocks of H tiles (greedy), skipping set-piece tiles. */
export function autoBlocks(map, decorAt = new Set()) {
  const W = map.width;
  const H = map.height;
  const used = new Set();
  const isH = (x, y) => x >= 0 && y >= 0 && x < W && y < H && map.rows[y][x] === 'H' && !decorAt.has(`${x},${y}`) && !used.has(`${x},${y}`);
  const out = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isH(x, y)) continue;
      let w = 1;
      while (isH(x + w, y) && w < 4) w++;
      let h = 1;
      while (h < 3 && Array.from({ length: w }, (_, k) => isH(x + k, y + h)).every(Boolean)) h++;
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) used.add(`${xx},${yy}`);
      const back = y <= 1;
      out.push({ x, y, w, h, kind: back ? 'glassTower' : (y >= H - 2 ? 'shop' : 'office'), floors: back ? 8 : y >= H - 2 ? 1 : 3 });
    }
  }
  return out;
}

export { FLOOR };

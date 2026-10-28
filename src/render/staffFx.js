// The staff heroes on the board (docs/specs/BANNERS.md §D.3-§D.5): Norika's road barricades and her Hold the
// Line barricades, Kogane's Clear the Road plow and Big Yellow, her two-legged construction walker. Purely
// visual: it reads sim state (sim.heroes[].bars / .lines, sim.runners of kind 'plow', sim.towers) and a few
// sim events, and never writes to them. Everything is read from the state each frame, so a Continued battle
// (src/ui/battle/snapshot.js restores t.bars) shows the barricades straight away.
//
//   const staff = new StaffFx({ sim, scene, fx, batches, atlas, actors, quality, reduceMotion });
//   staff.handle(ev)   // every drained sim event, before rosterFx (never consumes one: returns false)
//   staff.update(dt)   // once per frame
//
// Draw calls: one InstancedMesh each for her barricades, the Hold the Line barriers, Big Yellow and the plow
// blade (built on first need), plus quads in the shared batches (shadows, budget bars, rebuild markers).
import * as THREE from 'three';
import { GeoBuilder } from './geo.js';
import { runnerSegment } from '../sim/runners.js';
import { TICKS } from '../sim/barricades.js';

/** Caps (co-op: two heroes, each ≤ 4 own barricades and ≤ 4 Hold the Line ones). */
const MAX_BARS = 8;
const MAX_LINES = 8;
const MAX_WALKERS = 4;
const MAX_BLADES = 2;
/** Seconds of the pop when a barricade (re)appears. */
const POP_TIME = 0.4;
/** Hold the Line barricades shrink away over their last this-many seconds. */
const FADE_TIME = 0.5;
/** Big Yellow's size beside her (the chibi stands in front of it) and on the road (the plow). */
const WALKER_SCALE = 1.25;
const PLOW_SCALE = 1.45;

const COL = {
  red: '#e8454a',
  white: '#f7f4ee',
  leg: '#5a6170',
  orange: '#ff8a2a',
  cone: '#ff7a1c',
  yellow: '#f2c230',
  yellowShade: '#c99b18',
  navy: '#2c3a5e',
  dark: '#2a2d36',
  steel: '#8a919c',
  glass: '#dff4ff',
  black: '#24262c',
  ult: '#ff9a3c',
  plow: '#ffd84d',
  dust: '#d9c7a4',
};

// ---------------------------------------------------------------------------
// geometry (low poly boxes and cones, merged + vertex coloured; each faces +z = along the road)
// ---------------------------------------------------------------------------

/** Norika's folding A-frame barrier: two striped planks across the road on A-frame legs. */
export function barricadeGeometry() {
  const g = new GeoBuilder({ flat: true });
  const W = 0.78;
  // A-frame legs at each end: two leaning boards meeting at the top
  for (const x of [-W / 2 + 0.04, W / 2 - 0.04]) {
    g.box(0.05, 0.44, 0.04, { x, z: 0.07, rx: -0.32, color: COL.leg });
    g.box(0.05, 0.44, 0.04, { x, z: -0.07, rx: 0.32, color: COL.leg });
    g.box(0.07, 0.03, 0.07, { x, y: 0.41, color: COL.leg }); // hinge cap
  }
  // striped planks on both faces (red / white blocks), the top one wider
  const N = 6;
  for (const [y, h] of [[0.27, 0.11], [0.11, 0.08]]) {
    for (let i = 0; i < N; i++) {
      const x = -W / 2 + (W / N) * (i + 0.5);
      const color = i % 2 ? COL.white : COL.red;
      g.box(W / N, h, 0.03, { x, y, z: 0.1, color });
      g.box(W / N, h, 0.03, { x, y, z: -0.1, color });
    }
  }
  // a little amber lamp on top
  g.box(0.07, 0.06, 0.05, { y: 0.43, color: COL.orange });
  return g.finish();
}

/** Hold the Line: a taller temporary barrier, two traffic cones with an orange / white striped bar. */
export function lineGeometry() {
  const g = new GeoBuilder({ flat: true });
  const X = 0.36;
  for (const x of [-X, X]) {
    g.box(0.2, 0.04, 0.2, { x, color: COL.black }); // base
    g.cone(0.09, 0.56, 6, { x, y: 0.03, color: COL.cone });
    g.cyl(0.052, 0.064, 0.07, 6, { x, y: 0.26, color: COL.white }); // reflective band
    g.cyl(0.032, 0.044, 0.05, 6, { x, y: 0.42, color: COL.white });
  }
  // the bar between the cones, striped
  const N = 5;
  const W = X * 2;
  for (let i = 0; i < N; i++) {
    g.box(W / N, 0.07, 0.05, { x: -W / 2 + (W / N) * (i + 0.5), y: 0.44, color: i % 2 ? COL.white : COL.orange });
  }
  g.box(0.08, 0.08, 0.06, { y: 0.5, color: '#ffd84d' }); // flasher
  return g.finish();
}

/** Big Yellow: a small two-legged construction walker with an open cockpit, facing +z (about 0.6 tall). */
export function walkerGeometry() {
  const g = new GeoBuilder({ flat: true });
  const Y = COL.yellow;
  const S = COL.yellowShade;
  for (const x of [-0.12, 0.12]) {
    g.box(0.12, 0.05, 0.2, { x, z: 0.02, color: COL.dark }); // foot
    g.box(0.07, 0.16, 0.08, { x, y: 0.04, color: COL.steel }); // shin
    g.box(0.1, 0.13, 0.11, { x, y: 0.18, color: S }); // thigh
  }
  g.box(0.3, 0.06, 0.18, { y: 0.29, color: COL.dark }); // hip
  g.box(0.36, 0.2, 0.3, { y: 0.34, color: Y }); // body
  g.box(0.37, 0.04, 0.31, { y: 0.4, color: COL.black }); // hazard band
  for (let i = 0; i < 4; i++) g.box(0.05, 0.041, 0.312, { x: -0.135 + i * 0.09, y: 0.4, rz: 0.5, color: Y });
  // the open cockpit: a seat back, a roll bar and a little panel
  g.box(0.24, 0.16, 0.04, { y: 0.54, z: -0.12, color: COL.navy });
  for (const x of [-0.16, 0.16]) g.box(0.03, 0.2, 0.03, { x, y: 0.54, z: -0.06, color: COL.dark });
  g.box(0.35, 0.03, 0.03, { y: 0.73, z: -0.06, color: COL.dark });
  g.box(0.2, 0.06, 0.06, { y: 0.54, z: 0.12, rx: -0.4, color: COL.dark });
  g.box(0.06, 0.04, 0.03, { x: -0.11, y: 0.36, z: 0.15, color: COL.glass }); // headlights
  g.box(0.06, 0.04, 0.03, { x: 0.11, y: 0.36, z: 0.15, color: COL.glass });
  g.cyl(0.035, 0.035, 0.18, 6, { x: 0.22, y: 0.42, z: 0.06, rx: Math.PI / 2, color: COL.steel }); // arm gun
  g.box(0.06, 0.08, 0.1, { x: 0.21, y: 0.38, z: -0.02, color: S });
  g.box(0.04, 0.12, 0.04, { x: -0.13, y: 0.6, z: -0.13, color: COL.orange }); // beacon post
  return g.finish();
}

/** Clear the Road's dozer blade: a wide curved yellow blade with a black / yellow edge, in front (+z) of Big Yellow. */
export function bladeGeometry() {
  const g = new GeoBuilder({ flat: true });
  const W = 0.62;
  g.box(W, 0.12, 0.04, { y: 0.02, z: 0.3, rx: 0.35, color: COL.yellow });
  g.box(W, 0.1, 0.04, { y: 0.12, z: 0.27, rx: -0.15, color: COL.yellow });
  g.box(W + 0.02, 0.03, 0.06, { y: 0.0, z: 0.33, color: COL.black }); // cutting edge
  for (const x of [-W / 2 + 0.02, W / 2 - 0.02]) g.box(0.03, 0.22, 0.06, { x, y: 0.0, z: 0.29, color: COL.yellowShade }); // end plates
  for (const x of [-0.12, 0.12]) g.box(0.04, 0.04, 0.2, { x, y: 0.16, z: 0.18, color: COL.steel }); // push arms
  return g.finish();
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _seg = {};
const _segN = {};

/** Road yaw at (x, y): the facing of the nearest road segment (local +z along the road, like the enemies). */
function roadYaw(pathData, x, y) {
  let best = Infinity;
  let yaw = 0;
  for (const path of pathData || []) {
    const pts = path.points;
    for (let i = 0; i + 1 < pts.length; i++) {
      const ax = pts[i][0];
      const ay = pts[i][1];
      const sx = pts[i + 1][0] - ax;
      const sy = pts[i + 1][1] - ay;
      const len2 = sx * sx + sy * sy;
      let t = len2 > 0 ? ((x - ax) * sx + (y - ay) * sy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = ax + sx * t - x;
      const cy = ay + sy * t - y;
      const d2 = cx * cx + cy * cy;
      if (d2 < best) {
        best = d2;
        yaw = Math.atan2(sx, sy);
      }
    }
  }
  return yaw;
}

/** A small elastic pop, 0 → 1 over k in [0, 1]. */
function pop(k) {
  if (k >= 1) return 1;
  return Math.max(0.01, 1 - Math.cos(k * Math.PI * 2.5) * Math.exp(-k * 5) * (1 - k));
}

export class StaffFx {
  /** @param {{ sim, scene, fx, batches, atlas, actors, quality?, reduceMotion? }} o */
  constructor({ sim, scene, fx, batches, atlas, actors, quality = 'medium', reduceMotion = false }) {
    this.sim = sim;
    this.fx = fx;
    this.b = batches;
    this.R = atlas.regions;
    this.actors = actors;
    this.quality = quality;
    this.reduceMotion = !!reduceMotion;
    this.time = 0;
    this.root = new THREE.Group();
    this.root.name = 'staffFx';
    scene.add(this.root);
    this._meshes = null; // built on first need
    /** per barricade uid: { x, y, yaw, t (seconds since it (re)appeared), down, downMax, hpMax, seen } */
    this._bars = new Map();
    /** per plow runner uid: { x, y, yaw, dust, seen } (its last spot, for the dust when it ends) */
    this._plows = new Map();
    /** per walker hero uid: seconds since Big Yellow came back from a plow (the pop) */
    this._walkers = new Map();
    this._frame = 0;
  }

  setQuality(q) {
    this.quality = q;
  }

  _tower(uid) {
    return uid != null && this.sim.getTower ? this.sim.getTower(uid) : null;
  }

  /** Is this Clear the Road (a `runner` ult with the plow look)? */
  isPlowUlt(ev) {
    if (ev?.type !== 'ult' || ev.effect !== 'runner') return false;
    return this._tower(ev.towerUid)?.def?.hero?.ult?.effect?.runner === 'plow';
  }

  /** The screen-flash colour for an ult this module draws, else null (the renderer's own). */
  ultColor(ev) {
    if (ev?.type !== 'ult') return null;
    if (ev.effect === 'barricade') return COL.ult;
    if (this.isPlowUlt(ev)) return COL.plow;
    return null;
  }

  // ---- events (never consumed: the renderer and rosterFx still see them) ---------------------

  handle(ev) {
    const fx = this.fx;
    switch (ev.type) {
      case 'barricadeBreak':
        if (ev.x != null) {
          fx.shards(ev.x, 0.3, ev.y, ev.kind === 'line' ? COL.orange : COL.red, this.quality === 'low' ? 4 : 8);
          fx.puff(ev.x, 0.15, ev.y, COL.white, this.quality === 'low' ? 3 : 5, 0.35, 0.3);
        }
        return false;
      case 'ult':
        if (ev.effect === 'barricade' && ev.x != null) {
          // Hold the Line: an orange ring where the line goes up
          fx.ring(ev.x, ev.y, 0.2, 1.3, 0.45, COL.ult, { uv: 'ringThick' });
          fx.sparkle(ev.x, ev.y, COL.ult, { count: this.quality === 'low' ? 6 : 12, height: 1.0, ring: false });
        } else if (this.isPlowUlt(ev) && ev.x != null) {
          // Big Yellow drives onto the road: a yellow ring and a burst of dust
          fx.ring(ev.x, ev.y, 0.2, 1.2, 0.45, COL.plow, { uv: 'ringThick' });
          fx.puff(ev.x, 0.15, ev.y, COL.dust, this.quality === 'low' ? 4 : 8, 0.5, 0.4);
        }
        return false;
      default:
        return false;
    }
  }

  // ---- meshes --------------------------------------------------------------------------------

  _ensure() {
    if (this._meshes) return this._meshes;
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const make = (geo, n, tint) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (tint) {
        for (let i = 0; i < n; i++) m.setColorAt(i, _c.setRGB(1, 1, 1));
        m.instanceColor.setUsage(THREE.DynamicDrawUsage);
      }
      m.count = 0;
      m.frustumCulled = false;
      this.root.add(m);
      return m;
    };
    this._meshes = {
      mat,
      bars: make(barricadeGeometry(), MAX_BARS, true),
      lines: make(lineGeometry(), MAX_LINES, true),
      walkers: make(walkerGeometry(), MAX_WALKERS, false),
      blades: make(bladeGeometry(), MAX_BLADES, false),
    };
    return this._meshes;
  }

  // ---- frame ---------------------------------------------------------------------------------

  update(dt) {
    this.time += dt;
    const frame = ++this._frame;
    const sim = this.sim;
    const heroes = sim.heroes || [];
    let any = !!this._meshes;
    for (const h of heroes) if (h && (h.bars?.length || h.lines?.length || h.def?.role === 'pilot')) any = true;
    if (!any && !(sim.runners && sim.runners.some((r) => r.kind === 'plow'))) return;
    const M = this._ensure();
    const counts = { bars: 0, lines: 0, walkers: 0, blades: 0 };
    for (const h of heroes) {
      if (!h || h.removed) continue;
      if (h.bars) for (const b of h.bars) this._drawBarricade(M, counts, b, false, dt, frame);
      if (h.lines) for (const l of h.lines) this._drawBarricade(M, counts, l, true, dt, frame);
    }
    this._drawPlows(M, counts, dt, frame);
    for (const h of heroes) if (h && !h.removed && h.def?.role === 'pilot') this._drawWalker(M, counts, h, dt);
    for (const [uid, s] of this._bars) if (s.seen !== frame) this._bars.delete(uid);
    for (const k of ['bars', 'lines', 'walkers', 'blades']) {
      const m = M[k];
      m.count = counts[k];
      if (counts[k]) {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    }
  }

  /** One barricade of hers (`line` = Hold the Line's) at its spot across the road. */
  _drawBarricade(M, counts, b, line, dt, frame) {
    let s = this._bars.get(b.uid);
    if (!s || s.x !== b.x || s.y !== b.y) {
      // new, or re-sited by a Move: face across the road there, pop in
      const fresh = !s;
      s = { ...(s || {}), x: b.x, y: b.y, yaw: roadYaw(this.sim.pathData, b.x, b.y), t: 0, down: 0, downMax: 0, hpMax: s?.hpMax || 0 };
      if (fresh) s.hpMax = b.max || b.hp || 1;
      this._bars.set(b.uid, s);
    }
    s.seen = frame;
    const R = this.R;
    const down = line ? 0 : b.down || 0;
    if (down > 0) {
      // broken: hidden while it is rebuilt; a faint dashed marker where it comes back (filling up)
      if (!(s.down > 0)) s.downMax = down;
      s.down = down;
      s.downMax = Math.max(s.downMax, down);
      const k = 1 - down / Math.max(1, s.downMax);
      const spin = this.reduceMotion ? 0 : this.time * 0.6;
      this.b.groundA.push(b.x, 0.07, b.y, 0.7, 0.7, R.ringDashed || R.ring, 1, 0.45, 0.4, 0.5, spin);
      this.b.groundN.push(b.x, 0.065, b.y, 0.55 * k, 0.55 * k, R.disc || R.dot, 1, 0.6, 0.5, 0.25);
      return;
    }
    if (s.down > 0) {
      // rebuilt: pop up again with a little puff
      s.down = 0;
      s.t = 0;
      if (this.quality !== 'low') this.fx.puff(b.x, 0.15, b.y, COL.white, 4, 0.3, 0.25);
    }
    s.t += dt;
    const max = line ? Math.max(s.hpMax, b.hp) : Math.max(1, b.max || s.hpMax);
    if (line) s.hpMax = max;
    const frac = Math.max(0, Math.min(1, b.hp / max));
    let sc = this.reduceMotion ? 1 : pop(s.t / POP_TIME);
    if (line && b.left != null) sc *= Math.max(0.01, Math.min(1, b.left / TICKS / FADE_TIME));
    // below half: it tints darker and leans a little (a held walker is pushing on it)
    const worn = frac < 0.5 ? (0.5 - frac) * 2 : 0;
    const lean = worn * 0.12 + (this.reduceMotion || worn === 0 ? 0 : Math.sin(this.time * 18 + b.uid) * 0.025 * worn);
    _e.set(lean, s.yaw, 0, 'YXZ');
    _q.setFromEuler(_e);
    const size = line ? 1.15 : 1.05;
    _p.set(b.x, 0.03, b.y);
    _s.set(size * sc, size * sc, size * sc);
    _m.compose(_p, _q, _s);
    const mesh = line ? M.lines : M.bars;
    const key = line ? 'lines' : 'bars';
    const cap = line ? MAX_LINES : MAX_BARS;
    if (counts[key] < cap) {
      const i = counts[key]++;
      mesh.setMatrixAt(i, _m);
      _c.setRGB(1 - 0.3 * worn, 1 - 0.42 * worn, 1 - 0.45 * worn);
      mesh.setColorAt(i, _c);
    }
    this.b.groundN.push(b.x, 0.06, b.y, 0.95 * sc, 0.45 * sc, R.shadow, 0.05, 0.05, 0.1, 0.3, -s.yaw);
    // the budget: a thin bar over it while it is being pushed
    if (frac < 0.999) {
      const ov = this.b.overlay || this.b.bbN;
      const bw = 0.5;
      const bh = 0.05;
      const y = line ? 0.85 : 0.72;
      ov.push(b.x, y, b.y, bw + 0.04, bh + 0.03, R.white, 0.07, 0.09, 0.18, 0.75);
      const fw = bw * frac;
      if (frac > 0.5) _c.setRGB(1, 0.86, 0.3);
      else if (frac > 0.25) _c.setRGB(1, 0.6, 0.2);
      else _c.setRGB(1, 0.3, 0.3);
      if (fw > 0.002) ov.push(b.x, y, b.y, fw, bh, R.white, _c.r, _c.g, _c.b, 1, 0, -(bw - fw) / 2, 0);
    }
  }

  /** Clear the Road: Big Yellow with its dozer blade, driving back up the road; dust off the blade. */
  _drawPlows(M, counts, dt, frame) {
    const runners = this.sim.runners || [];
    const R = this.R;
    for (const r of runners) {
      if (r.dead || r.kind !== 'plow') continue;
      const p = runnerSegment(this.sim, r, 0, _seg);
      if (!p) continue;
      const px = p.x;
      const py = p.y;
      // heading: toward where it is going (from a point behind it to the head)
      let yaw = p.facing != null ? p.facing + Math.PI : 0;
      const q = runnerSegment(this.sim, r, 0.5, _segN);
      if (q && (q.x !== px || q.y !== py)) yaw = Math.atan2(px - q.x, py - q.y);
      let s = this._plows.get(r.uid);
      if (!s) this._plows.set(r.uid, (s = { x: px, y: py, yaw, dust: 0, t: 0, ownerUid: r.ownerUid }));
      s.x = px;
      s.y = py;
      s.yaw = yaw;
      s.seen = frame;
      s.t += dt;
      // the walker stands a little behind the blade's edge (the head point)
      const bx = px - Math.sin(yaw) * 0.25;
      const bz = py - Math.cos(yaw) * 0.25;
      const step = this.reduceMotion ? 0 : Math.abs(Math.sin(s.t * 14)) * 0.035;
      const sway = this.reduceMotion ? 0 : Math.sin(s.t * 14) * 0.05;
      const sc = PLOW_SCALE * (this.reduceMotion ? 1 : pop(s.t / 0.3));
      _e.set(0, yaw, sway, 'YXZ');
      _q.setFromEuler(_e);
      _s.set(sc, sc, sc);
      _p.set(bx, 0.03 + step, bz);
      _m.compose(_p, _q, _s);
      if (counts.walkers < MAX_WALKERS) M.walkers.setMatrixAt(counts.walkers++, _m);
      _e.set(0, yaw, 0, 'YXZ');
      _q.setFromEuler(_e);
      _p.set(bx, 0.03, bz);
      _m.compose(_p, _q, _s);
      if (counts.blades < MAX_BLADES) M.blades.setMatrixAt(counts.blades++, _m);
      this.b.groundN.push(bx, 0.06, bz, 0.9, 0.9, R.shadow, 0.05, 0.05, 0.1, 0.35);
      // dust off both ends of the blade and a scraped trail behind it
      if (this.quality !== 'low') {
        s.dust -= dt;
        if (s.dust <= 0) {
          s.dust = this.reduceMotion ? 0.2 : this.quality === 'high' ? 0.05 : 0.08;
          const cx = Math.cos(yaw);
          const cz = -Math.sin(yaw);
          for (const side of [-1, 1]) {
            const dx = px + cx * side * 0.45;
            const dz = py + cz * side * 0.45;
            this.fx.spawn({
              batch: 'bbN', uv: R.smoke || R.disc, x: dx, y: 0.12, z: dz,
              vx: cx * side * 0.6, vy: 0.5 + Math.random() * 0.3, vz: cz * side * 0.6, drag: 2.5,
              s0: 0.2, s1: 0.45, life: 0.5, color: COL.dust, a0: 0.6,
            });
          }
        }
      }
      this.b.groundN.push(px - Math.sin(yaw) * 0.7, 0.062, py - Math.cos(yaw) * 0.7, 0.55, 0.9, R.shadow, 0.35, 0.28, 0.18, 0.18, -yaw);
    }
    // plows gone (runnerEnd, the wave clear, her removal): a last dust cloud where Big Yellow stopped
    for (const [uid, s] of this._plows) {
      if (s.seen === frame) continue;
      this._plows.delete(uid);
      this.fx.puff(s.x, 0.2, s.y, COL.dust, this.quality === 'low' ? 3 : 7, 0.45, 0.4);
      this._walkers.set(s.ownerUid, 0); // Big Yellow pops back in beside her
    }
  }

  /** Is Big Yellow out on the road for hero `uid` right now? */
  _plowing(uid) {
    for (const s of this._plows.values()) if (s.ownerUid === uid) return true;
    return false;
  }

  /** Big Yellow beside Kogane's figure (behind her, facing the same way), unless it is out plowing. */
  _drawWalker(M, counts, h, dt) {
    if (this._plowing(h.uid)) return;
    const v = this.actors?.towers?.get(h.uid);
    if (!v || !v.model) return;
    const m = v.model;
    // her figure's pop / scale (placement, a Move) carries over
    const heroK = Math.max(0.01, m.scale.x / (v.scale || 1));
    let back = this._walkers.get(h.uid);
    if (back != null) {
      back += dt;
      if (back >= 0.4) this._walkers.delete(h.uid);
      else this._walkers.set(h.uid, back);
    }
    const k = back != null && !this.reduceMotion ? pop(back / 0.4) : 1;
    const f = v.facing || 0;
    const x = m.position.x - Math.sin(f) * 0.32;
    const z = m.position.z - Math.cos(f) * 0.32;
    const bob = this.reduceMotion ? 0 : Math.sin(this.time * 2.2 + h.uid) * 0.012;
    const sc = WALKER_SCALE * heroK * k;
    _e.set(0, f, 0, 'YXZ');
    _q.setFromEuler(_e);
    _s.set(sc, sc, sc);
    _p.set(x, m.position.y - 0.02 + bob, z);
    _m.compose(_p, _q, _s);
    if (counts.walkers < MAX_WALKERS) M.walkers.setMatrixAt(counts.walkers++, _m);
    this.b.groundN.push(x, 0.058, z, 0.75 * heroK, 0.75 * heroK, this.R.shadow, 0.05, 0.05, 0.1, 0.3);
  }

  dispose() {
    if (this._meshes) {
      for (const k of ['bars', 'lines', 'walkers', 'blades']) {
        this._meshes[k].geometry.dispose();
        this._meshes[k].dispose();
      }
      this._meshes.mat.dispose();
      this._meshes = null;
    }
    this.root.parent?.remove(this.root);
    this._bars.clear();
    this._plows.clear();
    this._walkers.clear();
  }
}


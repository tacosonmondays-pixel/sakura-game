// Roster mechanics on the board (roster B3, docs/ATTACK_FX.md "Roster mechanics"): mortar warning
// rings + shell arcs, relay props (Ruri's holo fox, Iroha's mirror panel) with a dashed tether, aim
// reticles, curse bursts, Kanna's drum strike and Seiran's sky dragon. Purely visual: it reads sim
// events and sim state (towers, shells, runners, sim.time) and never writes to them.
//
//   const roster = new RosterFx({ sim, scene, fx, batches, atlas, actors, quality });
//   roster.handle(ev)   // every drained sim event (BattleRenderer.handleEvents); true = drawn here
//   roster.update(dt)   // once per frame, after the events
import * as THREE from 'three';
import { GeoBuilder } from './geo.js';
import { aimMode } from '../sim/towers.js';
import { runnerSegment } from '../sim/runners.js';

const TAU = Math.PI * 2;

/** Caps (keep draw calls and quads modest on phones). */
const MAX_WARN = 48;
const MAX_PROPS = 24;
const MAX_DRAGON_SEGS = 48;
const MAX_DRAGON_HEADS = 6;
const MAX_CURSE_PER_FRAME = 10;
/** A warning ring with no shellLand (wave clear, sold girl) disappears this long after its delay. */
const WARN_GRACE = 0.25;

const COL = {
  warn: '#ff9a3c',
  shell: '#3a3f4a',
  familiar: '#9fdcff',
  mirror: '#d8c4f0',
  aimMortar: '#ffa040',
  aimMirror: '#d8b4ff',
  aimUlt: '#9fd8ff',
  curse: '#b46cff',
  cursePetal: '#e9a8ff',
  drum: '#f589a0',
  sky: '#9fd8ff',
  gold: '#ffd77a',
};

function rgb(hex) {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}
const RGB = Object.fromEntries(Object.entries(COL).map(([k, v]) => [k, rgb(v)]));

// ---------------------------------------------------------------------------
// shared geometry (built once per renderer, merged + vertex coloured: one draw call per prop)
// ---------------------------------------------------------------------------

/** Kon: a small low-poly fox sitting up, facing +z (white with a pale-blue holo tint). */
function foxGeometry() {
  const W = '#f4fbff';
  const B = '#a8dcff';
  const K = '#1d2b4f';
  return new GeoBuilder({ flat: true })
    .blob(0.13, { y: 0.15, sx: 0.85, sy: 1.15, sz: 1.1, color: W }) // body
    .blob(0.11, { y: 0.34, z: 0.05, sx: 1.1, color: W }) // head
    .cone(0.05, 0.13, 4, { y: 0.31, z: 0.14, rx: Math.PI / 2, color: W }) // snout
    .blob(0.022, { y: 0.31, z: 0.27, color: K }) // nose
    .blob(0.022, { x: -0.05, y: 0.37, z: 0.14, color: K }) // eyes
    .blob(0.022, { x: 0.05, y: 0.37, z: 0.14, color: K })
    .cone(0.055, 0.15, 3, { x: -0.065, y: 0.4, z: 0.03, rz: 0.35, color: W }) // big ears
    .cone(0.055, 0.15, 3, { x: 0.065, y: 0.4, z: 0.03, rz: -0.35, color: W })
    .cone(0.03, 0.08, 3, { x: -0.07, y: 0.42, z: 0.045, rz: 0.35, color: B }) // inner ears
    .cone(0.03, 0.08, 3, { x: 0.07, y: 0.42, z: 0.045, rz: -0.35, color: B })
    .blob(0.09, { y: 0.2, z: -0.22, sx: 0.9, sz: 2.0, rx: 0.7, color: W }) // bushy tail, curling up
    .blob(0.06, { y: 0.33, z: -0.33, color: B }) // glowing tail tip
    .finish();
}

/** Iroha's mirror: an oval panel leaning back on a little tripod easel, facing +z. */
function mirrorGeometry() {
  const LEG = '#4a4560';
  const FRAME = '#9a6cc8';
  const GLASS = '#f4f2ff';
  const TILT = -0.5; // leans back so the glass reads from the high battle camera
  const g = new GeoBuilder({ flat: true });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + Math.PI / 6;
    g.cyl(0.012, 0.016, 0.36, 4, { x: Math.sin(a) * 0.09, z: Math.cos(a) * 0.09, rx: Math.cos(a) * 0.25, rz: -Math.sin(a) * 0.25, color: LEG });
  }
  g.torus(0.15, 0.022, 4, 18, { y: 0.52, sy: 1.4, rx: TILT, color: FRAME });
  const glass = new THREE.CircleGeometry(0.145, 18);
  const back = glass.clone();
  back.rotateY(Math.PI);
  glass.translate(0, 0, 0.005);
  back.translate(0, 0, -0.005);
  g.add(glass, { y: 0.52, sy: 1.4, rx: TILT, color: GLASS });
  g.add(back, { y: 0.52, sy: 1.4, rx: TILT, color: '#b8b0d0' });
  g.cone(0.03, 0.06, 4, { y: 0.74, z: -0.1, color: FRAME }); // little finial
  g.cyl(0.03, 0.03, 0.03, 6, { y: 0.32, color: LEG }); // easel head
  return g.finish();
}

/** Dragon head (facing +z): light-blue skull + snout, gold horns and mane. */
function dragonHeadGeometry() {
  const S = '#9fd8ff';
  const D = '#6fb4e8';
  const G = '#ffd166';
  return new GeoBuilder({ flat: true })
    .blob(0.17, { sz: 1.25, color: S })
    .box(0.17, 0.1, 0.2, { y: -0.07, z: 0.16, color: D }) // snout
    .cone(0.035, 0.22, 4, { x: -0.08, y: 0.1, z: -0.06, rx: -1.0, color: G }) // horns
    .cone(0.035, 0.22, 4, { x: 0.08, y: 0.1, z: -0.06, rx: -1.0, color: G })
    .cone(0.05, 0.16, 4, { y: 0.12, z: -0.16, rx: -1.7, color: G }) // mane tuft
    .blob(0.032, { x: -0.07, y: 0.06, z: 0.17, color: '#1d2b4f' }) // eyes
    .blob(0.032, { x: 0.07, y: 0.06, z: 0.17, color: '#1d2b4f' })
    .finish();
}

/** Dragon body segment: a light-blue bead with a gold dorsal fin. */
function dragonSegGeometry() {
  return new GeoBuilder({ flat: true })
    .blob(0.14, { sz: 1.3, color: '#86ccf6' })
    .cone(0.06, 0.16, 4, { y: 0.09, rx: -0.6, color: '#ffd166' })
    .finish();
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _seg = {};
const _segN = {};

export class RosterFx {
  /** @param {{ sim, scene, fx, batches, atlas, actors, quality? }} o */
  constructor({ sim, scene, fx, batches, atlas, actors, quality = 'medium' }) {
    this.sim = sim;
    this.fx = fx;
    this.b = batches;
    this.R = atlas.regions;
    this.actors = actors;
    this.quality = quality;
    this.time = 0;
    this.selectedUid = null;
    this.root = new THREE.Group();
    this.root.name = 'rosterFx';
    scene.add(this.root);
    /** mortar warnings: { uid, x, y, r, delay, t0, towerUid, fx, fy } */
    this.warns = [];
    /** relay props by tower uid: { kind, mesh, x, y } */
    this.props = new Map();
    this._geo = null; // built on first need
    this._mats = null;
    this._dragon = null;
    /** last head position per runner uid (for the exit sparkle) */
    this._heads = new Map();
    this._curseThisFrame = 0;
  }

  setQuality(q) {
    this.quality = q;
  }

  setSelected(uid) {
    this.selectedUid = uid ?? null;
  }

  _tower(uid) {
    return uid != null && this.sim.getTower ? this.sim.getTower(uid) : null;
  }

  // ---- events ----------------------------------------------------------------------------

  /** @returns {boolean} true when the event was fully drawn here */
  handle(ev) {
    switch (ev.type) {
      case 'mortarWarn': {
        if (this.warns.length >= MAX_WARN) this.warns.shift();
        const t = this._tower(ev.towerUid);
        this.warns.push({
          uid: ev.uid, x: ev.x, y: ev.y, r: Math.max(0.2, ev.radius || 0.5), delay: Math.max(0.05, ev.delay || 1),
          t0: this.sim.time, towerUid: ev.towerUid, fx: t ? t.ox ?? t.x : null, fy: t ? t.oy ?? t.y : null,
        });
        return true;
      }
      case 'shellLand':
        this._dropWarn((w) => w.uid === ev.uid);
        return true; // the 'explode' event draws the blast
      case 'relay': {
        const p = this.props.get(ev.towerUid);
        if (p && Math.hypot(p.x - ev.x, p.y - ev.y) > 0.5) {
          this.fx.puff(p.x, 0.2, p.y, '#ffffff', 4, 0.3, 0.25);
          this.fx.ring(ev.x, ev.y, 0.1, 0.55, 0.35, ev.kind === 'mirror' ? COL.mirror : COL.familiar);
        }
        return true;
      }
      case 'aim':
        if (ev.x != null) {
          const t = this._tower(ev.towerUid);
          this.fx.ring(ev.x, ev.y, 0.5, 0.15, 0.3, aimColor(aimMode(t)), { uv: 'ringThick' });
        }
        return true;
      case 'sell': {
        const p = this.props.get(ev.towerUid);
        if (p) {
          this.fx.puff(p.x, 0.25, p.y, '#ffffff', 5, 0.3, 0.3);
          this._dropProp(ev.towerUid);
        }
        this._dropWarn((w) => w.towerUid === ev.towerUid);
        return false; // the renderer still draws its sell puff + coin
      }
      case 'curseBurst':
        this._curse(ev);
        return true;
      case 'ult':
        // the renderer keeps its screen flash + shake; the map-wide ring is skipped for these two
        if (ev.effect === 'strike') this._strike(ev);
        else if (ev.effect === 'runner') this._dragonEnter(ev);
        return false;
      case 'runnerEnd': {
        const h = this._heads.get(ev.uid);
        if (h) {
          this.fx.sparkle(h.x, h.y, COL.sky, { count: 12, height: 1.2, ring: false });
          this.fx.puff(h.x, 0.8, h.y, '#e8f6ff', 5, 0.4, 0.35);
          this._heads.delete(ev.uid);
        }
        return true;
      }
      default:
        return false;
    }
  }

  _dropWarn(pred) {
    const w = this.warns;
    let n = 0;
    for (let i = 0; i < w.length; i++) if (!pred(w[i])) w[n++] = w[i];
    w.length = n;
  }

  _curse(ev) {
    if (this._curseThisFrame++ >= MAX_CURSE_PER_FRAME) return;
    const fx = this.fx;
    const d = Math.max(0, ev.depth || 0);
    const k = Math.max(0.4, 1 - 0.2 * d); // deeper generations: smaller + fainter
    const r = Math.max(0.3, ev.radius || 1);
    fx.ring(ev.x, ev.y, r * 0.15, r * k, 0.42, COL.curse, { a0: 0.95 * k });
    fx.spawn({ batch: 'groundA', uv: this.R.disc, x: ev.x, y: 0.05, z: ev.y, s0: r * 0.6, s1: r * 1.6 * k, life: 0.3, color: COL.curse, a0: 0.3 * k, flags: 8 });
    fx.flash(ev.x, 0.45, ev.y, COL.cursePetal, 0.8 * k, 0.16);
    const n = fx.n(Math.max(2, 6 - 2 * d));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.random() * 0.5;
      const sp = 0.9 + Math.random() * 0.6;
      fx.spawn({
        batch: i % 2 ? 'bbA' : 'bbN', uv: i % 2 ? this.R.spark : this.R.petal, x: ev.x, y: 0.4, z: ev.y,
        vx: Math.cos(a) * sp * k, vy: 0.8 + Math.random() * 0.6, vz: Math.sin(a) * sp * k, g: -2.5, drag: 1.8,
        s0: 0.16 * k, s1: 0.08, life: 0.6, color: i % 2 ? COL.curse : COL.cursePetal, a0: k, rot: a, vrot: 5,
      });
    }
  }

  /** Kanna's Festival Drumfall: a light pillar onto the struck enemy and concentric coral shockwaves. */
  _strike(ev) {
    const fx = this.fx;
    const x = ev.x;
    const z = ev.y;
    fx.spawn({ batch: 'bbA', uv: this.R.ray || this.R.beam, x, y: 1.4, z, s0: 2.8, s1: 2.4, asp: 0.22, life: 0.3, color: COL.drum, a0: 0.95 });
    fx.flash(x, 0.5, z, '#ffd0da', 1.8, 0.25);
    // concentric rings: same start, staggered speeds → three waves rolling out together
    fx.ring(x, z, 0.2, 1.0, 0.3, COL.drum, { uv: 'ringThick' });
    fx.ring(x, z, 0.2, 1.8, 0.5, COL.drum, { uv: 'ringThick', a0: 0.85 });
    fx.ring(x, z, 0.2, 2.6, 0.75, COL.drum, { uv: 'ring', a0: 0.75 });
    if (this.quality !== 'low') fx.ring(x, z, 0.1, 3.2, 0.95, '#ffffff', { uv: 'ringSoft', a0: 0.4 });
    fx.shards(x, 0.4, z, COL.drum, 8);
    if (ev.fromX != null) fx.beam([ev.fromX, ev.fromY], [x, z], 0.08, COL.drum, { life: 0.18, y: 0.7 });
  }

  _dragonEnter(ev) {
    const x = ev.x;
    const z = ev.y;
    if (x == null) return;
    this.fx.ring(x, z, 0.2, 1.4, 0.5, COL.sky, { uv: 'ringThick' });
    this.fx.sparkle(x, z, COL.gold, { count: 14, height: 1.4, ring: false });
    this.fx.flash(x, 0.9, z, '#e8f6ff', 1.6, 0.3);
  }

  // ---- shared meshes -----------------------------------------------------------------------

  _ensureGeo() {
    if (this._geo) return;
    this._geo = { fox: foxGeometry(), mirror: mirrorGeometry() };
    this._mats = {
      // the holo fox glows: emissive blue, a little see-through
      fox: new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.92, emissive: new THREE.Color('#4f86b0') }),
      mirror: new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#4a3e66') }),
    };
  }

  _ensureDragon() {
    if (this._dragon) return this._dragon;
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#2c5878') });
    const head = new THREE.InstancedMesh(dragonHeadGeometry(), mat, MAX_DRAGON_HEADS);
    const body = new THREE.InstancedMesh(dragonSegGeometry(), mat, MAX_DRAGON_SEGS);
    for (const m of [head, body]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.frustumCulled = false;
      this.root.add(m);
    }
    this._dragon = { head, body, mat };
    return this._dragon;
  }

  _dropProp(uid) {
    const p = this.props.get(uid);
    if (!p) return;
    this.root.remove(p.mesh);
    this.props.delete(uid);
  }

  // ---- frame -------------------------------------------------------------------------------

  update(dt) {
    this.time += dt;
    this._curseThisFrame = 0;
    this._drawWarns();
    this._syncProps(dt);
    this._drawAims();
    this._drawDragons();
  }

  _drawWarns() {
    const w = this.warns;
    if (!w.length) return;
    const now = this.sim.time;
    const R = this.R;
    const gA = this.b.groundA;
    const gN = this.b.groundN;
    const [r, g, b] = RGB.warn;
    let n = 0;
    for (let i = 0; i < w.length; i++) {
      const s = w[i];
      const el = now - s.t0;
      // times out on its own (a wave clear removes shells without a shellLand); a sold girl's too
      if (el < -0.01 || el > s.delay + WARN_GRACE || (s.towerUid != null && !this._tower(s.towerUid))) continue;
      w[n++] = s;
      const k = Math.max(0, Math.min(1, el / s.delay));
      const d = s.r * 2;
      gA.push(s.x, 0.08, s.y, d, d, R.ring, r, g, b, 0.9);
      gN.push(s.x, 0.075, s.y, d * k, d * k, R.disc, r, g, b, 0.18 + 0.17 * k);
      gA.push(s.x, 0.085, s.y, 0.16, 0.16, R.dot, r, g, b, 0.9);
      // the shell's arc from her firing point (a lob: high in the middle, lands at k = 1)
      if (s.fx != null) {
        const dist = Math.hypot(s.x - s.fx, s.y - s.fy);
        const hMax = 1.2 + dist * 0.12;
        const px = s.fx + (s.x - s.fx) * k;
        const pz = s.fy + (s.y - s.fy) * k;
        const ph = 0.5 * (1 - k) + 4 * hMax * k * (1 - k) + 0.1;
        const [sr, sg, sb] = RGB.shell;
        this.b.bbN.push(px, ph, pz, 0.16, 0.16, R.dot, sr, sg, sb, 1);
        this.b.bbA.push(px, ph, pz, 0.3, 0.3, R.glow, r, g, b, 0.6);
        gN.push(px, 0.06, pz, 0.22, 0.22, R.shadow, 0.05, 0.05, 0.1, 0.25 * k);
      }
    }
    w.length = n;
  }

  _syncProps(dt) {
    const sim = this.sim;
    const seen = this._seen || (this._seen = new Set());
    seen.clear();
    for (let i = 0; i < sim.towers.length; i++) {
      const t = sim.towers[i];
      const relay = t.stats?.relay;
      if (!relay || !t.origin) continue;
      seen.add(t.uid);
      let p = this.props.get(t.uid);
      if (!p) {
        if (this.props.size >= MAX_PROPS) continue;
        this._ensureGeo();
        const kind = relay.kind === 'mirror' ? 'mirror' : 'familiar';
        const mesh = new THREE.Mesh(kind === 'mirror' ? this._geo.mirror : this._geo.fox, kind === 'mirror' ? this._mats.mirror : this._mats.fox);
        mesh.frustumCulled = false;
        this.root.add(mesh);
        p = { kind, mesh, x: t.ox, y: t.oy };
        this.props.set(t.uid, p);
      }
      // glide to the sim origin (snaps when far: a new placement)
      const tx = t.ox;
      const ty = t.oy;
      const dd = Math.hypot(tx - p.x, ty - p.y);
      if (dd > 6) {
        p.x = tx;
        p.y = ty;
      } else {
        const k = 1 - Math.exp(-12 * dt);
        p.x += (tx - p.x) * k;
        p.y += (ty - p.y) * k;
      }
      this._drawProp(t, p);
    }
    for (const uid of this.props.keys()) if (!seen.has(uid)) this._dropProp(uid);
  }

  _drawProp(t, p) {
    const R = this.R;
    const v = this.actors.towers.get(t.uid);
    const facing = v ? v.facing : t.facing || 0;
    // standing on the girl (origin = her spot): step aside so both read
    let x = p.x;
    let y = p.y;
    const self = Math.hypot(x - t.x, y - t.y) < 0.3;
    if (self) {
      x = t.x + Math.cos(facing) * 0.34;
      y = t.y - Math.sin(facing) * 0.34;
    }
    const c = p.kind === 'mirror' ? RGB.mirror : RGB.familiar;
    const m = p.mesh;
    if (p.kind === 'familiar') {
      const bob = 0.12 + 0.04 * Math.sin(this.time * 3 + t.uid);
      m.position.set(x, bob, y);
      m.rotation.set(0, facing, 0);
      m.scale.setScalar(1.7);
      this.b.groundA.push(x, 0.07, y, 0.7, 0.7, R.glow, c[0], c[1], c[2], 0.5);
      this.b.groundA.push(x, 0.072, y, 0.6, 0.6, R.ring, c[0], c[1], c[2], 0.55 + 0.2 * Math.sin(this.time * 5), this.time);
      if (this.quality !== 'low') this.b.bbA.push(x, bob + 0.4, y, 0.8, 0.8, R.glow, c[0], c[1], c[2], 0.3);
    } else {
      // the glass always faces the camera side (the sim's mirror has no facing) with a slow sway
      m.position.set(x, 0.02, y);
      m.rotation.set(0, 0.25 * Math.sin(this.time * 0.7 + t.uid), 0);
      m.scale.setScalar(1.6);
      this.b.groundN.push(x, 0.06, y, 0.55, 0.55, R.shadow, 0.05, 0.05, 0.1, 0.35);
      this.b.groundA.push(x, 0.07, y, 0.6, 0.6, R.ring, c[0], c[1], c[2], 0.45, this.time * 0.5);
      // a soft sheen on the glass and a glint sweeping over it
      if (this.quality !== 'low') this.b.bbA.push(x, 0.9, y, 0.55, 0.7, R.glow, c[0], c[1], c[2], 0.22);
      const g = (this.time * 0.6 + t.uid * 0.13) % 1;
      if (g < 0.3) this.b.bbA.push(x, 0.95, y, 0.4, 0.4, R.star, 1, 1, 1, Math.sin((g / 0.3) * Math.PI) * 0.9, this.time * 3);
    }
    // dashed tether from the girl to her prop (ground dashes flowing outward)
    if (!self) this._tether(t.x, t.y, x, y, c, p.kind === 'mirror' ? 0.6 : 0.7);
  }

  _tether(x0, y0, x1, y1, c, a) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 0.45) return;
    const step = 0.26;
    const rot = Math.atan2(-dy, dx); // ground quads: local x → world x, local y → world −z
    const off = (this.time * 0.6) % step;
    const R = this.R;
    const n = Math.min(40, Math.floor(len / step));
    for (let i = 0; i < n; i++) {
      const d = 0.22 + off + i * step;
      if (d > len - 0.18) break;
      const f = d / len;
      this.b.groundN.push(x0 + dx * f, 0.075, y0 + dy * f, 0.13, 0.04, R.white, c[0], c[1], c[2], a, rot);
    }
  }

  _drawAims() {
    const sim = this.sim;
    const R = this.R;
    for (let i = 0; i < sim.towers.length; i++) {
      const t = sim.towers[i];
      if (!t.aim) continue;
      const mode = aimMode(t);
      if (!mode) continue;
      if (mode !== 'mortar' && this.selectedUid !== t.uid) continue;
      const c = RGB[mode === 'mortar' ? 'aimMortar' : mode === 'mirror' ? 'aimMirror' : 'aimUlt'];
      const sel = this.selectedUid === t.uid;
      const s = sel ? 0.75 : 0.6;
      this.b.groundA.push(t.aim.x, 0.09, t.aim.y, s, s, R.reticle || R.ringDashed, c[0], c[1], c[2], sel ? 0.95 : 0.7, this.time * 0.8);
      this.b.groundA.push(t.aim.x, 0.092, t.aim.y, 0.12, 0.12, R.dot, c[0], c[1], c[2], 0.9);
    }
  }

  _drawDragons() {
    const runners = this.sim.runners;
    const has = runners && runners.length > 0;
    if (!has && !this._dragon) return;
    const D = this._ensureDragon();
    let nh = 0;
    let nb = 0;
    const R = this.R;
    const glow = this.quality !== 'low';
    const [cr, cg, cb] = RGB.sky;
    if (has) {
      for (let i = 0; i < runners.length; i++) {
        const r = runners[i];
        if (r.dead || r.kind !== 'dragon') continue;
        const segs = Math.min(r.segments || 1, MAX_DRAGON_SEGS);
        for (let k = 0; k < segs; k++) {
          const p = runnerSegment(this.sim, r, k, _seg);
          if (!p) continue;
          const px = p.x;
          const py = p.y;
          // heading: from the next segment back toward this one (head leads, flying back along the road)
          let yaw = 0;
          const q = runnerSegment(this.sim, r, k + 0.5, _segN);
          if (q) yaw = Math.atan2(px - q.x, py - q.y);
          else if (p.facing != null) yaw = p.facing + Math.PI;
          const alt = 1.0 + 0.16 * Math.sin(this.time * 4.5 - k * 0.9);
          const head = k === 0;
          // beads ≈ the sim gap wide, so the body reads as one serpent; tapering to the tail
          const sc = head ? 2.3 : Math.max(1.0, 2.0 - 0.12 * k);
          _e.set(Math.cos(this.time * 4.5 - k * 0.9) * 0.25, yaw, 0, 'YXZ');
          _q.setFromEuler(_e);
          _p.set(px, alt, py);
          _s.set(sc, sc, sc);
          _m.compose(_p, _q, _s);
          if (head) {
            if (nh < MAX_DRAGON_HEADS) D.head.setMatrixAt(nh++, _m);
            let h = this._heads.get(r.uid);
            if (!h) this._heads.set(r.uid, (h = { x: 0, y: 0 }));
            h.x = px;
            h.y = py;
          } else if (nb < MAX_DRAGON_SEGS) D.body.setMatrixAt(nb++, _m);
          if (glow) this.b.bbA.push(px, alt, py, 0.5 * sc, 0.5 * sc, R.glow, cr, cg, cb, 0.3);
          this.b.groundN.push(px, 0.06, py, 0.3 * sc, 0.3 * sc, R.shadow, 0.05, 0.05, 0.1, 0.22);
        }
        // a few gold sparkles shed from the tail
        if (glow && Math.random() < 0.35) {
          const tp = runnerSegment(this.sim, r, segs - 1, _seg);
          if (tp) {
            this.fx.spawn({
              batch: 'bbA', uv: R.star, x: tp.x + (Math.random() - 0.5) * 0.2, y: 0.8, z: tp.y + (Math.random() - 0.5) * 0.2,
              vy: -0.3, s0: 0.14, s1: 0.04, life: 0.5, color: COL.gold, rot: Math.random() * TAU, vrot: 4,
            });
          }
        }
      }
    }
    D.head.count = nh;
    D.body.count = nb;
    if (nh) D.head.instanceMatrix.needsUpdate = true;
    if (nb) D.body.instanceMatrix.needsUpdate = true;
    // runners gone without a runnerEnd (wave clear): forget their heads
    if (!has && this._heads.size) this._heads.clear();
  }

  dispose() {
    for (const uid of [...this.props.keys()]) this._dropProp(uid);
    if (this._geo) {
      this._geo.fox.dispose();
      this._geo.mirror.dispose();
      this._mats.fox.dispose();
      this._mats.mirror.dispose();
    }
    if (this._dragon) {
      this._dragon.head.geometry.dispose();
      this._dragon.body.geometry.dispose();
      this._dragon.mat.dispose();
      this._dragon.head.dispose();
      this._dragon.body.dispose();
    }
    this.root.parent?.remove(this.root);
    this.warns.length = 0;
  }
}

function aimColor(mode) {
  return mode === 'mortar' ? COL.aimMortar : mode === 'mirror' ? COL.aimMirror : COL.aimUlt;
}

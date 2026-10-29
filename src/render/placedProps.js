// The academy girls' PLACED objects as real 3D props (display only: reads the sim every frame, never
// writes it). Models: public/models/props/*.glb, built by tools/blender/props/build_props.py (its README
// has the node / material contract). Each part loads once and draws through one InstancedMesh (plus an
// inverted-hull outline twin), so a board full of strips is a handful of draw calls.
//
//   Azami     spike strips (sim.traps with strip: true): unroll plate by plate across the road; spent
//             hits flatten plates; Spike Rain strips lilac
//   Yuzuha    sentries (t.sentries): drop in, fold their legs out, the head pops up and turns to the nearest
//             walker in reach; the band and light show the Specialist Kit type. Capture Nets (t.nets) unfurl
//             with their four weights flying out; a net whose budget is spent goes grey
//   Chigusa   thorn vines (an enemy her hold status holds): three tendrils grow around it; thorn beds
//             (t.beds) sprout out of the road
//   Ouka      her office marker (a council banner stand beside her) and her council banners (t.banners),
//             which drop in and plant; the dashed reach rings stay (actors.js)
//   Wakaba    a drink bottle by every girl her drink hydrates (t.hydrated), dropped in with a bounce
//   Kinu      her heat ring (t.rings) as a glowing seam with her pins riding it; her orbit scissors snip
//
// Every prop fades out (screen-door dither, no transparency sorting) when its sim object goes. Reduce motion:
// no deploy animation and no idle motion, only the fade. Low graphics: nothing loads and actors.js keeps the
// flat drawing (the simple version). A prop whose GLB fails to load also keeps the flat drawing
// (covers(kind) is false), and an error switches the whole layer off for the battle (BattleRenderer).
//
//   const p = new PlacedProps({ sim, scene, actors, quality, reduceMotion });
//   p.covers('strip')   // actors.js: true = skip the flat placeholder for this kind
//   p.update(dt)        // once per frame after actors.sync
//   p.setQuality(q); p.dispose();
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { gradientMap } from '../models/toon.js';
import { baseUrl, assetExt, canLoadCharacters } from '../models/glbChibi.js';
import { scissorPos } from '../sim/rings.js';
import { STEP } from '../sim/constants.js';

const TAU = Math.PI * 2;

/** Prop files (public/models/props/<file>.glb) and the girl whose presence loads each. */
export const PROP_FILES = {
  azami_strip: 'azami',
  yuzuha_sentry: 'yuzuha',
  chigusa_vines: 'chigusa',
  ouka_banners: 'ouka',
  wakaba_bottle: 'wakaba',
  kinu_pins: 'kinu',
};

/** Kind → the file its parts live in. */
export const KIND_FILE = {
  strip: 'azami_strip',
  sentry: 'yuzuha_sentry',
  net: 'yuzuha_sentry',
  vine: 'chigusa_vines',
  bed: 'chigusa_vines',
  office: 'ouka_banners',
  banner: 'ouka_banners',
  bottle: 'wakaba_bottle',
  heatRing: 'kinu_pins',
  scissor: 'kinu_pins',
};

/** The parts each file must carry (node names; `_tint` parts are coloured per instance). */
export const FILE_PARTS = {
  azami_strip: ['strip_seg', 'strip_cap'],
  yuzuha_sentry: ['sentry_leg', 'sentry_body', 'sentry_band_tint', 'sentry_head', 'sentry_light_tint', 'net_mesh', 'net_weight'],
  chigusa_vines: ['vine_tendril', 'bed_base'],
  ouka_banners: ['office_stand', 'office_flag', 'banner_pole', 'banner_flag'],
  wakaba_bottle: ['bottle_body'],
  kinu_pins: ['heatRing_band', 'pin_pin', 'scissor_half'],
};

/** Instances per part at most (the sim's own caps keep far below these). */
const CAPS = {
  strip_seg: 6 * 96, strip_cap: 2 * 96,
  sentry_leg: 3 * 32, sentry_body: 32, sentry_band_tint: 32, sentry_head: 32, sentry_light_tint: 32,
  net_mesh: 8, net_weight: 32,
  vine_tendril: 3 * 48, bed_base: 64,
  office_stand: 16, office_flag: 16, banner_pole: 16, banner_flag: 16,
  bottle_body: 64,
  heatRing_band: 32, pin_pin: 32 * 16, scissor_half: 2 * 48,
};

/** Yuzuha's Specialist Kit colours (as the flat drawing: plain / net / flash / heavy / flak). */
export const SENTRY_TINT = { plain: '#ff8c29', net: '#80d9ff', flash: '#ffffbf', heavy: '#ff594d', flak: '#bf99ff' };

const ROAD_Y = 0.056; // road objects sit on the road top (the flat decals were at 0.063-0.068)
const TOWER_Y = 0.05; // a girl's feet (actors.js), plus her roof lift
const FADE_OUT = 0.35;
const FADE_IN = 0.22; // Reduce motion: the only appearance
const STRIP_SEGS = 6;
const SEG_W = 0.11;
const STRIP_HALF = (STRIP_SEGS * SEG_W) / 2;
const SENTRY_HIP = 0.2;
const SENTRY_TOP = 0.34;
const SENTRY_SCALE = 1.3;
const NET_HALF = 0.42;
const HEAT_R = 0.9;
const OUTLINE_WIDTH = 0.0065;
const OUTLINE_TINT = '#3a2e44';

// ---------------------------------------------------------------------------
// Pure helpers (tested in node)
// ---------------------------------------------------------------------------

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Ease with a small overshoot (0 → 1, peaks ~1.08). */
export function easeOutBack(t) {
  const x = clamp01(t) - 1;
  const c = 1.70158;
  return 1 + (c + 1) * x * x * x + c * x * x;
}
export function easeOutCubic(t) {
  const x = 1 - clamp01(t);
  return 1 - x * x * x;
}
/** A drop that lands at t = 0.6 and bounces once (height factor, 1 = start height, 0 = ground). */
export function dropHeight(t) {
  const x = clamp01(t);
  if (x < 0.6) {
    const k = x / 0.6;
    return 1 - k * k;
  }
  const k = (x - 0.6) / 0.4;
  return 0.12 * Math.sin(Math.PI * k);
}

/**
 * The road's facing (three.js rotation.y: +Z along the road) at the point nearest (x, y) on any path,
 * or 0 when there is no road. Strips lie across it, nets square with it.
 */
export function roadFacing(pathData, x, y) {
  let best = Infinity;
  let facing = 0;
  for (const path of pathData || []) {
    const pts = path.points;
    for (let i = 0; i + 1 < pts.length; i++) {
      const ax = pts[i][0];
      const ay = pts[i][1];
      const dx = pts[i + 1][0] - ax;
      const dy = pts[i + 1][1] - ay;
      const l2 = dx * dx + dy * dy;
      let t = l2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = ax + dx * t - x;
      const cy = ay + dy * t - y;
      const d = cx * cx + cy * cy;
      if (d < best) {
        best = d;
        facing = Math.atan2(dx, dy);
      }
    }
  }
  return facing;
}

/**
 * Plates of a strip still standing: hits left over the hits it was first seen with, in sixths (at least
 * one while it lives).
 */
export function stripPlates(hits, hits0) {
  if (!(hits0 > 0)) return STRIP_SEGS;
  return Math.max(1, Math.min(STRIP_SEGS, Math.ceil((STRIP_SEGS * hits) / hits0 - 1e-9)));
}

/**
 * Appearance and fade of a tracked prop: `deploy` 0..1 (1 = fully out; always 1 with Reduce motion) and
 * `fade` 0..1 (the dither alpha).
 */
export function propPhase(age, dyingFor, deployTime, reduceMotion) {
  const out = dyingFor == null ? 1 : clamp01(1 - dyingFor / FADE_OUT);
  if (reduceMotion) return { deploy: 1, fade: Math.min(clamp01(age / FADE_IN), out) };
  return { deploy: clamp01(age / deployTime), fade: out };
}

// ---------------------------------------------------------------------------
// Loading (once per file per page; geometry kept for the next battle, its GPU side freed on dispose)
// ---------------------------------------------------------------------------

const files = new Map(); // file -> Promise<Map<name, part>|null>
const loaded = new Map(); // file -> Map<name, part> | null (failed)
let gltfLoader = null;

export function propUrl(file) {
  return `${baseUrl()}models/props/${file}.glb${assetExt()}`;
}

/**
 * Parts of a loaded file: name -> { name, geometry, glow, tint, rest (Matrix4 in the prop's space) }.
 * Throws when a part the runtime draws is missing (the caller keeps the flat drawing).
 */
export function partsFromScene(file, root) {
  const out = new Map();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    // a part's node sits right under its prop's root empty: its local matrix is its rest pose in the prop
    const rest = new THREE.Matrix4().copy(o.matrix);
    out.set(o.name, {
      name: o.name, geometry: o.geometry, glow: /glow/.test(o.material?.name || ''), tint: o.name.endsWith('_tint'), rest,
    });
  });
  for (const n of FILE_PARTS[file] || []) if (!out.has(n)) throw new Error(`${file}.glb: missing part ${n}`);
  return out;
}

function loadFile(file) {
  if (files.has(file)) return files.get(file);
  if (!canLoadCharacters()) return Promise.resolve(null);
  gltfLoader ??= new GLTFLoader();
  const p = gltfLoader
    .loadAsync(propUrl(file))
    .then((gltf) => {
      const parts = partsFromScene(file, gltf.scene);
      loaded.set(file, parts);
      return parts;
    })
    .catch((e) => {
      console.warn(`[props] ${file} unavailable, keeping the flat drawing`, e?.message || e);
      loaded.set(file, null);
      return null;
    });
  files.set(file, p);
  return p;
}

/** Installs parts for a file without a network (node tests). */
export function setPropFile(file, parts) {
  loaded.set(file, parts);
  files.set(file, Promise.resolve(parts));
}

// ---------------------------------------------------------------------------
// Materials: toon (vertex colours, the girls' 3-step ramp), unlit glow, outline; all with a per-instance
// screen-door fade (aFade) so instances fade without transparency sorting
// ---------------------------------------------------------------------------

const DITHER_VERT = ['#include <common>', '#include <common>\nattribute float aFade;\nvarying float vFade;'];
const DITHER_BEGIN = ['#include <begin_vertex>', '#include <begin_vertex>\nvFade = aFade;'];
const DITHER_FRAG_HEAD = `#include <common>
varying float vFade;
float ppBayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float ppBayer4(vec2 a) { return ppBayer2(0.5 * a) * 0.25 + ppBayer2(a); }`;
const DITHER_DISCARD = '#include <clipping_planes_fragment>\nif (vFade < 0.995 && ppBayer4(gl_FragCoord.xy) + 0.02 > vFade) discard;';

function dithered(mat, key, outlineWidth = 0) {
  mat.onBeforeCompile = (shader) => {
    let v = shader.vertexShader.replace(DITHER_VERT[0], DITHER_VERT[1]);
    if (outlineWidth > 0) {
      shader.uniforms.outlineWidth = { value: outlineWidth };
      v = v.replace('#include <common>', '#include <common>\nuniform float outlineWidth;')
        .replace(DITHER_BEGIN[0], `${DITHER_BEGIN[1]}\ntransformed += normalize(normal) * outlineWidth;`);
    } else {
      v = v.replace(DITHER_BEGIN[0], DITHER_BEGIN[1]);
    }
    shader.vertexShader = v;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', DITHER_FRAG_HEAD)
      .replace('#include <clipping_planes_fragment>', DITHER_DISCARD);
  };
  mat.customProgramCacheKey = () => `placed-props-${key}`;
  return mat;
}

function makeMaterials() {
  return {
    body: dithered(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap(3) }), 'body'),
    glow: dithered(new THREE.MeshBasicMaterial({ vertexColors: true }), 'glow'),
    outline: dithered(new THREE.MeshBasicMaterial({ color: OUTLINE_TINT, vertexColors: true, side: THREE.BackSide }), 'outline', OUTLINE_WIDTH),
  };
}

// ---------------------------------------------------------------------------
// One part's instances (+ its outline twin)
// ---------------------------------------------------------------------------

const _white = new THREE.Color(1, 1, 1);

class PartBatch {
  constructor(part, cap, mats, outline) {
    this.part = part;
    this.cap = cap;
    // own geometry (shares the file's buffers) carrying this batch's fade attribute
    const g = new THREE.BufferGeometry();
    const src = part.geometry;
    for (const [k, a] of Object.entries(src.attributes)) g.setAttribute(k, a);
    if (src.index) g.setIndex(src.index);
    this.fade = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    this.fade.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aFade', this.fade);
    this.geometry = g;
    this.mesh = new THREE.InstancedMesh(g, part.glow ? mats.glow : mats.body, cap);
    this.mesh.name = `prop:${part.name}`;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (part.tint || part.name.startsWith('strip') || part.name.startsWith('net') || part.name.startsWith('office') || part.name.startsWith('bottle')) {
      // per-instance colour (set before the first render so the program compiles once)
      for (let i = 0; i < cap; i++) this.mesh.setColorAt(i, _white);
      this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    this.outline = null;
    if (outline && !part.glow) {
      this.outline = new THREE.InstancedMesh(g, mats.outline, cap);
      this.outline.name = `prop:${part.name}:outline`;
      this.outline.instanceMatrix = this.mesh.instanceMatrix; // same matrices, one upload
      this.outline.userData.isOutline = true;
    }
    for (const m of [this.mesh, this.outline]) {
      if (!m) continue;
      m.count = 0;
      m.frustumCulled = false;
      m.castShadow = false;
      m.receiveShadow = false;
      m.raycast = () => {};
    }
    this.n = 0;
  }

  begin() {
    this.n = 0;
  }

  /** One instance: world matrix, fade 0..1, optional THREE.Color tint. */
  push(matrix, fade, color) {
    if (this.n >= this.cap || fade <= 0.001) return;
    const i = this.n++;
    this.mesh.setMatrixAt(i, matrix);
    this.fade.setX(i, fade);
    if (this.mesh.instanceColor) this.mesh.setColorAt(i, color || _white);
  }

  end() {
    const n = this.n;
    this.mesh.count = n;
    if (this.outline) this.outline.count = n;
    if (n) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.fade.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }

  setOutline(on) {
    if (this.outline) this.outline.visible = on;
  }

  dispose() {
    this.mesh.dispose();
    this.outline?.dispose?.();
    this.geometry.dispose();
  }
}

// ---------------------------------------------------------------------------
// The layer
// ---------------------------------------------------------------------------

const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _m3 = new THREE.Matrix4();
const _root = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _c2 = new THREE.Color();
const LILAC = new THREE.Color('#d6bfff');
const SPENT = new THREE.Color(0.55, 0.57, 0.62);
const DIM = new THREE.Color(0.62, 0.62, 0.66);
const tintCache = new Map();
const tint = (hex) => {
  let c = tintCache.get(hex);
  if (!c) tintCache.set(hex, (c = new THREE.Color(hex)));
  return c;
};

/** Matrix from position, Euler (x, y, z, order YXZ) and scale. */
function compose(out, x, y, z, rx, ry, rz, sx, sy = sx, sz = sx) {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  return out.compose(_p, _q, _s);
}

/** Deploy animation lengths (s). */
const DEPLOY = { strip: 0.42, sentry: 0.7, net: 0.5, vine: 0.4, bed: 0.45, office: 0.5, banner: 0.55, bottle: 0.55, heatRing: 0.01, scissor: 0.3 };

export class PlacedProps {
  /** @param {{ sim, scene: THREE.Scene, actors?: object, quality?: string, reduceMotion?: boolean }} o */
  constructor({ sim, scene, actors = null, quality = 'medium', reduceMotion = false }) {
    this.sim = sim;
    this.actors = actors;
    this.scene = scene;
    this.reduceMotion = !!reduceMotion;
    this.quality = quality;
    this.root = new THREE.Group();
    this.root.name = 'placedProps';
    scene.add(this.root);
    this.mats = makeMaterials();
    this.batches = new Map(); // part name -> PartBatch
    this.requested = new Set();
    this.recs = new Map(); // key -> { kind, born, dieAt, data, ... }
    this.time = 0;
    this.frame = 0;
    this.disposed = false;
    this._ids = new WeakMap();
    this._nextId = 1;
    this._facing = new Map(); // strip / net key -> road facing (computed once)
    this._since = new Map(); // file -> the frame its props started drawing
  }

  /** Low graphics keeps the flat drawing: nothing loads, nothing draws. */
  get enabled() {
    return !this.disposed && this.quality !== 'low';
  }

  /** True when this kind's prop is ready and drawn here (actors.js then skips its flat placeholder). */
  covers(kind) {
    if (!this.enabled) return false;
    const f = KIND_FILE[kind];
    return !!(f && this._ready(f));
  }

  _ready(file) {
    const parts = loaded.get(file);
    if (!parts) return false;
    if (!this.batches.has(FILE_PARTS[file][0])) {
      this._install(file, parts);
      this._since.set(file, this.frame);
    }
    return true;
  }

  _install(file, parts) {
    const outline = this.quality !== 'low';
    for (const name of FILE_PARTS[file]) {
      if (this.batches.has(name)) continue;
      const b = new PartBatch(parts.get(name), CAPS[name] || 32, this.mats, outline);
      this.batches.set(name, b);
      this.root.add(b.mesh);
      if (b.outline) this.root.add(b.outline);
    }
  }

  setQuality(q) {
    this.quality = q;
    this.root.visible = this.enabled;
  }

  _request() {
    // a girl on the board (either player's) loads her file once
    for (const t of this.sim.towers) {
      const id = t.unitId;
      for (const [file, owner] of Object.entries(PROP_FILES)) {
        if (owner !== id || this.requested.has(file)) continue;
        this.requested.add(file);
        loadFile(file);
      }
    }
  }

  _id(obj) {
    let id = this._ids.get(obj);
    if (!id) this._ids.set(obj, (id = this._nextId++));
    return id;
  }

  /** Marks a prop alive this frame; returns its record. */
  _see(key, kind, data) {
    let r = this.recs.get(key);
    if (!r || r.dieAt != null) {
      // objects already on the board when the file arrived are simply there (no deploy all at once)
      const old = !r && this._since.get(KIND_FILE[kind]) === this.frame;
      r = { key, kind, born: old ? this.time - 10 : this.time, dieAt: null, data, seed: hash(key) };
      this.recs.set(key, r);
    }
    r.data = data;
    r.frame = this.frame;
    return r;
  }

  update(dt) {
    if (!this.enabled) return;
    const d = Math.max(0, Math.min(0.1, dt || 0));
    this.time += d;
    this.frame++;
    this._request();
    this._collect();
    for (const b of this.batches.values()) b.begin();
    for (const [key, r] of this.recs) {
      if (r.frame !== this.frame && r.dieAt == null) r.dieAt = this.time;
      const dying = r.dieAt == null ? null : this.time - r.dieAt;
      if (dying != null && dying > FADE_OUT) {
        this.recs.delete(key);
        this._facing.delete(key);
        continue;
      }
      if (!this.covers(r.kind)) continue;
      const ph = propPhase(this.time - r.born, dying, DEPLOY[r.kind] || 0.4, this.reduceMotion);
      this[`_draw_${r.kind}`](r, ph.deploy, ph.fade, d);
    }
    for (const b of this.batches.values()) b.end();
  }

  // -------------------------------------------------------------------------
  // What is on the board (one pass over the sim)
  // -------------------------------------------------------------------------

  _collect() {
    const sim = this.sim;
    const fxHook = this.actors?.fxHook;
    if (this.covers('strip')) {
      for (const tr of sim.traps || []) {
        if (!tr.strip || fxHook?.trapHidden?.(tr.uid)) continue;
        const key = `s${tr.uid}`;
        const prev = this.recs.get(key);
        this._see(key, 'strip', {
          x: tr.x, y: tr.y, extra: !!tr.extra, hits: tr.hits,
          hits0: prev && prev.dieAt == null ? prev.data.hits0 : Math.max(1, tr.hits), facing: this._roadFacing(key, tr.x, tr.y),
        });
      }
    }
    const sentries = this.covers('sentry');
    const beds = this.covers('bed');
    const hubs = this.covers('office');
    const bottles = this.covers('bottle');
    const kinu = this.covers('heatRing');
    const step = Math.round(sim.time / STEP);
    for (const tw of sim.towers) {
      if (tw.removed) continue;
      if (sentries) {
        for (const sn of tw.sentries || []) this._see(`y${sn.uid}`, 'sentry', { x: sn.x, y: sn.y, type: sn.type, ttl: sn.ttl, tx: tw.x, ty: tw.y, range: tw.stats?.sentry?.range || 2 });
        (tw.nets || []).forEach((n, i) => {
          const key = `n${tw.uid}:${i}:${n.x.toFixed(2)},${n.y.toFixed(2)}`;
          this._see(key, 'net', { x: n.x, y: n.y, spent: !(n.left > 0), facing: this._roadFacing(key, n.x, n.y) });
        });
      }
      if (beds) for (const b of tw.beds || []) this._see(`b${b.uid}`, 'bed', { x: b.x, y: b.y, ttl: b.ttl });
      if (hubs && tw.stats?.hub) {
        const lift = this._lift(tw);
        this._see(`o${tw.uid}`, 'office', { x: tw.x + 0.34, y: tw.y - 0.3, h: TOWER_Y + lift, off: tw.disabled > 0 });
        (tw.banners || []).forEach((b, i) => this._see(`k${tw.uid}:${i}:${b.x.toFixed(2)},${b.y.toFixed(2)}`, 'banner', { x: b.x, y: b.y }));
      }
      if (bottles && tw.hydrated) this._see(`d${tw.uid}`, 'bottle', { x: tw.x + 0.27, y: tw.y + 0.22, h: TOWER_Y + this._lift(tw) });
      if (kinu) {
        const pins = Math.max(8, Math.min(16, tw.eff?.projectiles || tw.stats?.projectiles || 8));
        for (const ring of tw.rings || []) {
          if (!(ring.r > 0)) continue;
          this._see(`h${this._id(ring)}`, 'heatRing', { x: ring.x, y: ring.y, r: ring.r, k: ring.r / Math.max(0.01, ring.max), pins });
        }
        const sc = tw.stats?.ring?.scissors || 0;
        for (let j = 0; j < sc; j++) {
          const [sx, sy] = scissorPos(tw, j, sc, step);
          this._see(`c${tw.uid}:${j}`, 'scissor', { x: sx, y: sy, cx: tw.x, cy: tw.y, h: TOWER_Y + this._lift(tw) });
        }
      }
    }
    // Chigusa's vines: every walker held by one of her hold statuses
    if (this.covers('vine')) {
      for (const e of sim.enemies) {
        const h = e.statuses?.hold;
        if (!h || e.dead || h.sourceUid == null) continue;
        const src = sim.towers.find((o) => o.uid === h.sourceUid);
        if (!src || src.unitId !== 'chigusa') continue;
        const v = this.actors?.enemies?.get(e.uid);
        if (v?.hidden) continue;
        this._see(`v${e.uid}`, 'vine', { x: v ? v.x : e.x, y: v ? v.z : e.y, h: Math.max(ROAD_Y, (v?.ground || 0) + 0.01), size: v?.size || e.def?.size || 1 });
      }
    }
  }

  _lift(tw) {
    return this.actors?.towers?.get(tw.uid)?.lift || 0;
  }

  /**
   * The long axis (out.x, out.y) of strip `uid`'s 3D prop at (x, y): across the road, (cos f, -sin f) for its
   * rotation.y f (the same cached facing it is drawn with). Null when strips are not drawn here (Low graphics,
   * the GLB not loaded or failed): the caller keeps the flat drawing's angle.
   */
  stripAxis(uid, x, y, out) {
    if (!this.covers('strip')) return null;
    const f = this._roadFacing(`s${uid}`, x, y);
    out.x = Math.cos(f);
    out.y = -Math.sin(f);
    return out;
  }

  _roadFacing(key, x, y) {
    let f = this._facing.get(key);
    if (f == null) this._facing.set(key, (f = roadFacing(this.sim.pathData, x, y)));
    return f;
  }

  _b(name) {
    return this.batches.get(name);
  }

  // -------------------------------------------------------------------------
  // Drawing, one kind each (matrices in world space: x = sim x, z = sim y)
  // -------------------------------------------------------------------------

  _draw_strip(r, dep, fade) {
    const d = r.data;
    const seg = this._b('strip_seg');
    const cap = this._b('strip_cap');
    compose(_root, d.x, ROAD_Y, d.y, 0, d.facing, 0, 1);
    const col = d.extra ? LILAC : _white;
    const plates = stripPlates(d.hits, d.hits0);
    r.sv ??= new Float32Array(STRIP_SEGS).fill(1);
    for (let i = 0; i < STRIP_SEGS; i++) {
      // unrolling: plate i flips over its hinge from the folded stack, one after another
      const k = this.reduceMotion ? 1 : easeOutBack(clamp01(dep * 1.45 - i * 0.075));
      if (k <= 0.001) continue;
      // spent hits flatten plates from the far end (smoothly)
      const want = i < plates ? 1 : 0.3;
      r.sv[i] += (want - r.sv[i]) * Math.min(1, 0.15 + (this.reduceMotion ? 1 : 0));
      compose(_m, -STRIP_HALF + i * SEG_W, 0, 0, 0, 0, Math.PI * (1 - k), 1, r.sv[i], 1);
      seg.push(_m2.multiplyMatrices(_root, _m), fade, col);
    }
    const kc = this.reduceMotion ? 1 : easeOutBack(clamp01(dep * 2));
    compose(_m, -STRIP_HALF, 0, 0, 0, 0, 0, kc);
    cap.push(_m2.multiplyMatrices(_root, _m), fade, col);
    const kr = this.reduceMotion ? 1 : easeOutBack(clamp01(dep * 1.45 - STRIP_SEGS * 0.075));
    if (kr > 0.001) {
      compose(_m, STRIP_HALF, 0, 0, 0, Math.PI, 0, kr);
      cap.push(_m2.multiplyMatrices(_root, _m), fade, col);
    }
  }

  _draw_sentry(r, dep, fade, dt) {
    const d = r.data;
    // head: turns to the nearest walker in its reach (display only), else faces away from Yuzuha
    if (r.yaw == null) r.yaw = Math.atan2(d.x - d.tx, d.y - d.ty);
    if (!this.reduceMotion && r.dieAt == null) {
      const tgt = this._nearestEnemy(d.x, d.y, d.range);
      if (tgt) r.yaw = turnToward(r.yaw, Math.atan2(tgt.x - d.x, tgt.z - d.y), dt * 8);
    }
    const base = r.seed * TAU;
    // drop in (0-0.35), legs swing out (0.3-0.7), the head pops up spinning (0.45-1)
    const fall = this.reduceMotion ? 0 : dropHeight(clamp01(dep / 0.45)) * 0.45;
    compose(_root, d.x, ROAD_Y + fall, d.y, 0, base, 0, SENTRY_SCALE);
    const legK = this.reduceMotion ? 1 : easeOutBack(clamp01((dep - 0.3) / 0.4));
    const tilt = (Math.PI - 0.32) * (1 - legK) + 0.5 * legK;
    const leg = this._b('sentry_leg');
    for (let i = 0; i < 3; i++) {
      compose(_m, 0, SENTRY_HIP, 0, tilt, (i * TAU) / 3, 0, 1);
      leg.push(_m2.multiplyMatrices(_root, _m), fade);
    }
    this._b('sentry_body').push(_root, fade);
    const type = tint(SENTRY_TINT[d.type] || SENTRY_TINT.plain);
    this._b('sentry_band_tint').push(_root, fade, type);
    const headK = this.reduceMotion ? 1 : easeOutBack(clamp01((dep - 0.45) / 0.55));
    const spin = this.reduceMotion ? 0 : (1 - easeOutCubic(clamp01((dep - 0.45) / 0.55))) * TAU;
    compose(_m, 0, SENTRY_TOP, 0, 0, r.yaw - base + spin, 0, Math.max(0.001, headK));
    _m3.multiplyMatrices(_root, _m);
    this._b('sentry_head').push(_m3, fade);
    // the light pulses, faster in its last 3 s
    const rate = d.ttl < 3 ? 9 : 3;
    const pulse = this.reduceMotion ? 1 : 0.72 + 0.28 * Math.sin(this.time * rate + base);
    this._b('sentry_light_tint').push(_m3, fade, _c.copy(type).multiplyScalar(pulse));
  }

  _nearestEnemy(x, y, reach) {
    let best = null;
    let bd = reach * reach;
    for (const v of this.actors?.enemies?.values?.() || []) {
      if (v.hidden) continue;
      const dx = v.x - x;
      const dz = v.z - y;
      const dd = dx * dx + dz * dz;
      if (dd < bd) {
        bd = dd;
        best = v;
      }
    }
    return best;
  }

  _draw_net(r, dep, fade) {
    const d = r.data;
    const k = this.reduceMotion ? 1 : easeOutBack(dep);
    const col = d.spent ? SPENT : _white;
    compose(_root, d.x, ROAD_Y, d.y, 0, d.facing + (1 - k) * 0.8, 0, 1);
    compose(_m, 0, 0, 0, 0, 0, 0, Math.max(0.05, 0.15 + 0.85 * k), 1, Math.max(0.05, 0.15 + 0.85 * k));
    this._b('net_mesh').push(_m2.multiplyMatrices(_root, _m), fade, col);
    const w = this._b('net_weight');
    const t = this.reduceMotion ? 1 : easeOutCubic(dep);
    const hop = this.reduceMotion ? 0 : Math.sin(Math.PI * clamp01(dep)) * 0.28;
    for (let i = 0; i < 4; i++) {
      const sx = i === 0 || i === 3 ? -1 : 1;
      const sz = i < 2 ? -1 : 1;
      compose(_m, sx * NET_HALF * t, hop, sz * NET_HALF * t, 0, i * 1.3, 0, 1);
      w.push(_m2.multiplyMatrices(_root, _m), fade, col);
    }
  }

  _draw_vine(r, dep, fade) {
    const d = r.data;
    const s = 0.8 + 0.3 * Math.min(1.6, d.size);
    const grow = this.reduceMotion ? 1 : easeOutBack(dep);
    const shrink = r.dieAt != null && !this.reduceMotion ? fade : 1;
    const squeeze = this.reduceMotion ? 1 : 1 + 0.04 * Math.sin(this.time * 7 + r.seed * 9);
    const tend = this._b('vine_tendril');
    const a0 = r.seed * TAU;
    for (let i = 0; i < 3; i++) {
      const a = a0 + (i * TAU) / 3;
      const R = 0.19 * s * squeeze;
      const g = Math.max(0.001, grow * shrink);
      compose(_m, d.x + Math.cos(a) * R, d.h, d.y + Math.sin(a) * R, 0, -a + (1 - g) * 1.2, 0, s * (0.6 + 0.4 * g), s * g, s * (0.6 + 0.4 * g));
      tend.push(_m, fade);
    }
  }

  _draw_bed(r, dep, fade) {
    const d = r.data;
    const k = this.reduceMotion ? 1 : easeOutBack(dep);
    const wither = d.ttl < 1 && r.dieAt == null ? 0.75 + 0.25 * clamp01(d.ttl) : 1;
    compose(_m, d.x, ROAD_Y - 0.004, d.y, 0, r.seed * TAU, 0, 0.55 + 0.45 * k, Math.max(0.01, k * wither), 0.55 + 0.45 * k);
    this._b('bed_base').push(_m, fade);
  }

  _draw_office(r, dep, fade) {
    const d = r.data;
    const k = this.reduceMotion ? 1 : easeOutBack(dep);
    const col = d.off ? DIM : _white;
    compose(_root, d.x, d.h, d.y, 0, 0, 0, 1, Math.max(0.01, k), 1);
    this._b('office_stand').push(_root, fade, col);
    const sway = this.reduceMotion ? 0 : Math.sin(this.time * 1.7 + r.seed * 5) * 0.09 + (1 - k) * 0.6;
    const rest = this._b('office_flag').part.rest;
    _m.makeRotationX(sway);
    _m3.multiplyMatrices(rest, _m);
    this._b('office_flag').push(_m2.multiplyMatrices(_root, _m3), fade, col);
  }

  _draw_banner(r, dep, fade) {
    const d = r.data;
    // drops from above and plants with a little squash
    const fall = this.reduceMotion ? 0 : dropHeight(dep) * 1.3;
    const squash = this.reduceMotion || dep < 0.6 ? 1 : 1 - 0.12 * Math.sin(Math.PI * clamp01((dep - 0.6) / 0.4));
    compose(_root, d.x, ROAD_Y + fall, d.y, 0, -0.5 + r.seed * 0.6, 0, 1, squash, 1);
    this._b('banner_pole').push(_root, fade);
    const wave = this.reduceMotion ? 0 : Math.sin(this.time * 2.3 + r.seed * 7) * 0.22;
    const rest = this._b('banner_flag').part.rest;
    _m.makeRotationY(wave);
    _m3.multiplyMatrices(rest, _m);
    this._b('banner_flag').push(_m2.multiplyMatrices(_root, _m3), fade);
  }

  _draw_bottle(r, dep, fade) {
    const d = r.data;
    const fall = this.reduceMotion ? 0 : dropHeight(dep) * 0.9;
    const spin = this.reduceMotion ? 0 : (1 - easeOutCubic(dep)) * TAU * 1.5;
    const wob = this.reduceMotion ? 0 : Math.sin(this.time * 3 + r.seed * 6) * 0.06;
    compose(_m, d.x, d.h + fall, d.y, wob, r.seed * TAU + spin, wob * 0.5, 1.1);
    this._b('bottle_body').push(_m, fade);
  }

  _draw_heatRing(r, dep, fade) {
    const d = r.data;
    const f = fade * (1 - 0.55 * d.k * d.k);
    const s = d.r / HEAT_R;
    compose(_m, d.x, ROAD_Y + 0.02, d.y, 0, r.seed * TAU, 0, s, 1, s);
    this._b('heatRing_band').push(_m, f);
    // her pins ride the seam, pointing out
    const pin = this._b('pin_pin');
    const spin = this.reduceMotion ? 0 : this.time * 1.5;
    for (let i = 0; i < d.pins; i++) {
      const a = r.seed * TAU + spin + (i * TAU) / d.pins;
      compose(_m, d.x + Math.sin(a) * d.r, ROAD_Y + 0.12, d.y + Math.cos(a) * d.r, 0, a - Math.PI / 2, -0.35, 1.05);
      pin.push(_m, f);
    }
  }

  _draw_scissor(r, dep, fade) {
    const d = r.data;
    const k = this.reduceMotion ? 1 : easeOutBack(dep);
    // blades point along the orbit; they snip open and shut
    const ang = Math.atan2(d.x - d.cx, d.y - d.cy) + Math.PI / 2;
    const open = this.reduceMotion ? 0.4 : 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(this.time * 14 + r.seed * 6));
    compose(_root, d.x, d.h + 0.3, d.y, 0, ang - Math.PI / 2, 0, 1.25 * Math.max(0.01, k));
    const half = this._b('scissor_half');
    _m.makeRotationY(open / 2);
    half.push(_m2.multiplyMatrices(_root, _m), fade);
    _m3.makeRotationX(Math.PI);
    _m.makeRotationY(open / 2);
    _m3.multiply(_m);
    half.push(_m2.multiplyMatrices(_root, _m3), fade);
  }

  /** Every instanced mesh drawn (debug / tests). */
  stats() {
    const out = {};
    for (const [n, b] of this.batches) if (b.n) out[n] = b.n;
    return out;
  }

  clear() {
    this.recs.clear();
    for (const b of this.batches.values()) {
      b.begin();
      b.end();
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.root);
    for (const b of this.batches.values()) b.dispose();
    this.batches.clear();
    for (const m of Object.values(this.mats)) m.dispose();
    // the file geometries stay cached for the next battle; free their GPU buffers now
    for (const parts of loaded.values()) if (parts) for (const p of parts.values()) p.geometry.dispose();
    this.recs.clear();
  }
}

/** Small stable 0..1 hash of a key (per-prop variety: yaw, phase). */
export function hash(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10007) / 10007;
}

function turnToward(a, b, k) {
  const d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * Math.min(1, k);
}

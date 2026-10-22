// Instanced rigid parts for placed objects and thrown props (FX-1). One InstancedMesh per part type
// (the toon material every figure uses, plus an inverted-hull outline sharing its instance buffers on
// High and Medium), with stable slots: an object keeps its slot while it lives, and only the slots
// written this frame are uploaded. A part type with no live instance draws nothing (count 0) and is
// hidden, so an empty board costs no draw call. Display only: nothing here reads or writes the sim.
//
//   const set = new PartSet(parent, { quality });
//   const s = set.part('ball').alloc();      // a slot
//   set.part('ball').setTRS(s, x, h, y, quat, sx, sy, sz, color?);
//   set.flush();                             // once a frame: counts + uploads
//   set.part('ball').free(s);
import * as THREE from 'three';
import { toonMaterial, outlineMaterial } from '../../models/toon.js';
import { GEOMETRY, netGeometry } from './geometry.js';

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const WHITE = new THREE.Color('#ffffff');

/** Outline width (world units) and ink per part; parts not listed draw without an outline. */
const OUTLINE = {
  ball: 0.014, pin: 0.008, plate: 0.007, roll: 0.008, case: 0.009, body: 0.008, head: 0.009,
  'barrel:plain': 0.006, 'barrel:net': 0.006, 'barrel:flash': 0.006, 'barrel:heavy': 0.006, 'barrel:flak': 0.006,
};
const INK = '#2a2234';

export class PartMesh {
  /**
   * @param {string} name @param {THREE.BufferGeometry} geo @param {THREE.Object3D} parent
   * @param {{ cap?: number, outline?: number, material?: THREE.Material }} o
   */
  constructor(name, geo, parent, { cap = 64, outline = 0, material = null } = {}) {
    this.name = name;
    this.cap = cap;
    this.geo = geo;
    const mat = material || toonMaterial({ vertexColors: true });
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, WHITE);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.name = `placed:${name}`;
    parent.add(this.mesh);
    this.outline = null;
    if (outline > 0) {
      const ol = new THREE.InstancedMesh(geo, outlineMaterial(outline, INK, true), cap);
      // the hull shares the body's instance buffers: one write moves both
      ol.instanceMatrix = this.mesh.instanceMatrix;
      ol.instanceColor = this.mesh.instanceColor;
      ol.count = 0;
      ol.frustumCulled = false;
      ol.visible = false;
      ol.name = `placed:${name}:outline`;
      ol.userData.isOutline = true;
      parent.add(ol);
      this.outline = ol;
    }
    this.outlineOn = true;
    this.used = new Uint8Array(cap);
    this.freeList = [];
    for (let i = cap - 1; i >= 0; i--) this.freeList.push(i);
    this.hw = 0; // high-water mark: slots [0, hw) are drawn
    this.live = 0;
    this.lo = Infinity; // dirty range this frame
    this.hi = -1;
    this.colorDirty = false;
  }

  /** A free slot (lowest free index first), or -1 when the type is full. */
  alloc() {
    if (!this.freeList.length) return -1;
    // lowest free slot keeps hw (and the drawn count) small
    let best = 0;
    for (let i = 1; i < this.freeList.length; i++) if (this.freeList[i] < this.freeList[best]) best = i;
    const s = this.freeList[best];
    this.freeList[best] = this.freeList[this.freeList.length - 1];
    this.freeList.length--;
    this.used[s] = 1;
    this.live++;
    if (s >= this.hw) this.hw = s + 1;
    this.mesh.setMatrixAt(s, ZERO);
    this._dirty(s);
    return s;
  }

  /** Frees a slot (its instance collapses to nothing until reused). */
  free(s) {
    if (s < 0 || !this.used[s]) return;
    this.used[s] = 0;
    this.live--;
    this.freeList.push(s);
    this.mesh.setMatrixAt(s, ZERO);
    this._dirty(s);
    while (this.hw > 0 && !this.used[this.hw - 1]) this.hw--;
  }

  _dirty(s) {
    if (s < this.lo) this.lo = s;
    if (s > this.hi) this.hi = s;
  }

  /** Writes a whole matrix. */
  setMatrix(s, m) {
    if (s < 0) return;
    this.mesh.setMatrixAt(s, m);
    this._dirty(s);
  }

  /** Writes position (x, h, y = board x, height, board y), rotation and scale. */
  setTRS(s, x, h, y, q, sx = 1, sy = sx, sz = sx) {
    if (s < 0) return;
    _p.set(x, h, y);
    _s.set(sx, sy, sz);
    _m.compose(_p, q, _s);
    this.mesh.setMatrixAt(s, _m);
    this._dirty(s);
  }

  /** Writes a yaw-only transform (rotation about +y). */
  setYaw(s, x, h, y, yaw, sx = 1, sy = sx, sz = sx) {
    _q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    this.setTRS(s, x, h, y, _q, sx, sy, sz);
  }

  /** Hides a live slot this frame (zero scale; it keeps the slot). */
  hide(s) {
    if (s < 0) return;
    this.mesh.setMatrixAt(s, ZERO);
    this._dirty(s);
  }

  setColor(s, c) {
    if (s < 0) return;
    this.mesh.setColorAt(s, c);
    this.colorDirty = true;
    this._dirty(s);
  }

  /** Counts and uploads (only the slots written this frame). @returns {number} draw calls this frame */
  flush() {
    const n = this.hw;
    const on = n > 0;
    this.mesh.count = n;
    this.mesh.visible = on;
    if (this.outline) {
      this.outline.count = n;
      this.outline.visible = on && this.outlineOn;
    }
    if (this.hi >= this.lo) {
      const im = this.mesh.instanceMatrix;
      im.clearUpdateRanges();
      im.addUpdateRange(this.lo * 16, (this.hi - this.lo + 1) * 16);
      im.needsUpdate = true;
      if (this.colorDirty) {
        const ic = this.mesh.instanceColor;
        ic.clearUpdateRanges();
        ic.addUpdateRange(this.lo * 3, (this.hi - this.lo + 1) * 3);
        ic.needsUpdate = true;
      }
    }
    this.lo = Infinity;
    this.hi = -1;
    this.colorDirty = false;
    return on ? (this.outline && this.outlineOn ? 2 : 1) : 0;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.outline?.removeFromParent();
    this.mesh.dispose();
    this.outline?.dispose();
    this.geo.dispose();
    if (!this.mesh.material.userData?.shared) this.mesh.material.dispose();
  }
}

// ---- the Capture Net: one instanced lattice, opened / lifted / cinched in its vertex shader ----

/**
 * Net material: the toon look with a per-instance `aNet` = (open, lift, cinch, alpha). The lattice
 * is a unit disc; open scales it (0.15 folded → 1 spread), lift raises the rim (the drape bounce and
 * a mid-air flutter), cinch pulls every vertex up and in onto a bundle (a ball of radius 0.3 about
 * the centre, lifted 0.3), alpha fades it. One draw call for every net on the board.
 */
function netMaterial() {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aR;\nattribute vec4 aNet;\nvarying float vNetA;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  float r = aR;
  vec2 d = length(transformed.xz) > 1e-4 ? normalize(transformed.xz) : vec2(0.0, 1.0);
  vec3 flat3 = vec3(transformed.x * aNet.x, transformed.y + aNet.y * r * r, transformed.z * aNet.x);
  float th = r * 2.6;
  vec3 ball = vec3(d.x * sin(th) * 0.3, 0.3 - cos(th) * 0.3 + 0.05, d.y * sin(th) * 0.3);
  transformed = mix(flat3, ball, aNet.z);
  vNetA = aNet.w;
}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vNetA;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vNetA;');
  };
  m.customProgramCacheKey = () => 'placed-net-v1';
  m.userData.net = true;
  return m;
}

export class NetMesh extends PartMesh {
  constructor(parent, cap = 48) {
    super('net', netGeometry(), parent, { cap, material: netMaterial() });
    this.attr = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('aNet', this.attr);
  }

  /** Per-instance shape: open (0.15..1), lift, cinch (0..1), alpha. */
  setShape(s, open, lift, cinch, alpha) {
    if (s < 0) return;
    const a = this.attr.array;
    a[s * 4] = open;
    a[s * 4 + 1] = lift;
    a[s * 4 + 2] = cinch;
    a[s * 4 + 3] = alpha;
    this._dirty(s);
    this.netDirty = true;
  }

  flush() {
    const lo = this.lo;
    const hi = this.hi;
    const calls = super.flush();
    if (this.netDirty && hi >= lo) {
      this.attr.clearUpdateRanges();
      this.attr.addUpdateRange(lo * 4, (hi - lo + 1) * 4);
      this.attr.needsUpdate = true;
    }
    this.netDirty = false;
    return calls;
  }

}

/** Every part type of the placed layer, created on first use. */
export class PartSet {
  /** @param {THREE.Object3D} parent @param {{ quality?: string }} [o] */
  constructor(parent, { quality = 'high' } = {}) {
    this.parent = parent;
    this.parts = new Map();
    this.quality = quality;
    this.calls = 0;
    this.instances = 0;
  }

  /** The part type `name` (made the first time it is asked for). */
  part(name) {
    let p = this.parts.get(name);
    if (p) return p;
    if (name === 'net') {
      p = new NetMesh(this.parent);
    } else if (name === 'lens') {
      p = new PartMesh(name, GEOMETRY.lens(), this.parent, { cap: 64, material: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }) });
    } else {
      const make = GEOMETRY[name];
      if (!make) throw new Error(`placed: no part '${name}'`);
      const cap = name === 'plate' || name === 'spikes' ? 512 : name === 'pin' ? 96 : name === 'leg' ? 192 : 64;
      p = new PartMesh(name, make(), this.parent, { cap, outline: OUTLINE[name] || 0 });
    }
    p.outlineOn = this.quality !== 'low';
    this.parts.set(name, p);
    return p;
  }

  has(name) {
    return this.parts.has(name);
  }

  setQuality(q) {
    this.quality = q;
    for (const p of this.parts.values()) p.outlineOn = q !== 'low';
  }

  /** Once a frame after every write. */
  flush() {
    let calls = 0;
    let inst = 0;
    for (const p of this.parts.values()) {
      calls += p.flush();
      inst += p.live;
    }
    this.calls = calls;
    this.instances = inst;
    return calls;
  }

  dispose() {
    for (const p of this.parts.values()) p.dispose();
    this.parts.clear();
  }
}

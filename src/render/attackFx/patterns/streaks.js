// Blade streaks: thin, bright-edged crescent ribbons drawn by ONE instanced mesh (one draw call for
// every streak on the field). Each streak is an arc of a circle (centre, radius, start / end angle,
// angles like a tower facing: atan2(dx, dy)) that tapers to a point at both ends, with a hot white
// edge on its outer side fading into its colour on the inside. Three motions:
//   SWEEP  the blade draws the arc: the head races along it, the tail follows and closes it
//   FLY    a whole crescent flying straight (a wind crescent): head and tail stay open, it moves
//   SPIN   a sweep whose arc also turns round its centre (the maple storm's fast streaks)
// Lives in game time (it freezes with a paused battle, like the sim it draws). Display only: the
// records are fed from sim events by a style and never touch the sim. Fixed pool, no allocation per
// streak; the mesh, its geometry and its material are disposed with the layer.
import * as THREE from 'three';

export const SWEEP = 0;
export const FLY = 1;
export const SPIN = 2;

/** Segments along each ribbon (the taper and the curve stay smooth on a phone at 2×). */
const SEGS = 24;

/**
 * Visible window and alpha of a streak at life fraction k (pure).
 * head / tail are fractions along the arc (0 = start angle, 1 = end angle).
 * @param {number} kind SWEEP | FLY | SPIN
 * @param {number} k 0..1
 * @param {{head:number, tail:number, alpha:number}} out
 */
export function streakWindow(kind, k, out = { head: 0, tail: 0, alpha: 0 }) {
  k = k < 0 ? 0 : k > 1 ? 1 : k;
  if (kind === FLY) {
    out.head = 1;
    out.tail = 0;
    // a quick fade-in, holds, then fades over the last third
    out.alpha = Math.max(0, Math.min(1, k / 0.12) * (k < 0.66 ? 1 : 1 - (k - 0.66) / 0.34));
    return out;
  }
  // SWEEP / SPIN: the head arrives in the first 40 %, the tail chases it from 20 % on
  const h = Math.min(1, k / 0.4);
  out.head = 1 - (1 - h) * (1 - h);
  const tk = k < 0.2 ? 0 : (k - 0.2) / 0.8;
  out.tail = tk * tk * out.head;
  out.alpha = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
  return out;
}

const VERT = /* glsl */ `
attribute vec2 aSV;
attribute vec4 iArc;   // centre x, height, centre z, radius
attribute vec4 iAng;   // start angle, end angle, width, rise
attribute vec4 iAnim;  // head, tail, alpha, edge (white edge strength)
attribute vec3 iCol;
varying vec2 vSV;
varying vec4 vAnim;
varying vec3 vCol;
void main() {
  float s = aSV.x;
  float v = aSV.y;
  float ang = mix(iAng.x, iAng.y, s);
  float taper = pow(max(sin(3.14159265 * s), 0.0), 0.65);
  float r = iArc.w + v * iAng.z * 0.5 * taper;
  vec3 p = vec3(iArc.x + sin(ang) * r, iArc.y + (s - 0.5) * iAng.w, iArc.z + cos(ang) * r);
  vSV = aSV;
  vAnim = iAnim;
  vCol = iCol;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const FRAG = /* glsl */ `
varying vec2 vSV;
varying vec4 vAnim;
varying vec3 vCol;
void main() {
  float s = vSV.x;
  float v = vSV.y;
  float head = vAnim.x;
  float tail = vAnim.y;
  if (s > head || s < tail || vAnim.z <= 0.0) discard;
  float along = (s - tail) / max(head - tail, 1e-3);
  // the tail thins away, the head stays sharp
  float fade = smoothstep(0.0, 0.45, along) * (1.0 - smoothstep(0.97, 1.0, along) * 0.4);
  // across: a thin hot line near the outer edge, a soft fill toward the inside
  float d = (v - 0.7) / 0.15;
  float core = exp(-d * d);
  float fill = smoothstep(-1.0, 0.55, v);
  fill = fill * 0.95 * (1.0 - smoothstep(0.8, 1.0, v));
  float a = (core * vAnim.w + fill) * fade * vAnim.z;
  vec3 c = mix(vCol, vec3(1.0), clamp(core * core * vAnim.w, 0.0, 1.0));
  gl_FragColor = vec4(c, clamp(a, 0.0, 1.0));
}
`;

function stripGeometry(cap) {
  const g = new THREE.InstancedBufferGeometry();
  const sv = new Float32Array((SEGS + 1) * 2 * 2);
  const idx = [];
  for (let i = 0; i <= SEGS; i++) {
    const s = i / SEGS;
    sv.set([s, -1, s, 1], i * 4);
    if (i < SEGS) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  g.setAttribute('aSV', new THREE.BufferAttribute(sv, 2));
  // a position attribute only for three's bookkeeping (bounds); the shader builds the arc itself
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEGS + 1) * 2 * 3), 3));
  g.setIndex(idx);
  const inst = (n) => new THREE.InstancedBufferAttribute(new Float32Array(cap * n), n).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('iArc', inst(4));
  g.setAttribute('iAng', inst(4));
  g.setAttribute('iAnim', inst(4));
  g.setAttribute('iCol', inst(3));
  g.instanceCount = 0;
  return g;
}

const _w = { head: 0, tail: 0, alpha: 0 };

export class StreakLayer {
  /**
   * @param {THREE.Object3D|null} parent where the mesh lives (the actors root); null = no mesh (tests)
   * @param {number} cap most streaks alive at once
   */
  constructor(parent, cap = 48) {
    this.cap = cap;
    this.live = [];
    this.free = [];
    for (let i = 0; i < cap; i++) {
      this.free.push({ x: 0, h: 0, z: 0, r: 0, a0: 0, a1: 0, w: 0, rise: 0, cr: 1, cg: 1, cb: 1, edge: 1, kind: SWEEP, t: 0, life: 0.2, delay: 0, vx: 0, vz: 0, spin: 0, grow: 0 });
    }
    this.geo = stripGeometry(cap);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.name = 'bladeStreaks';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 22;
    this.mesh.visible = false;
    this.parent = parent;
    parent?.add?.(this.mesh);
    /** most streaks drawn in one frame (perf probe) */
    this.peak = 0;
  }

  get count() {
    return this.live.length;
  }

  /**
   * Adds a streak (game seconds). Returns the record (set .delay, .vx/.vz for FLY, .spin for SPIN,
   * .grow = radius growth per second, .edge = white edge strength) or null when the pool is full.
   * @param {THREE.Color} c inner colour
   */
  add(kind, x, h, z, r, a0, a1, w, rise, c, life) {
    const s = this.free.pop();
    if (!s) return null;
    s.kind = kind;
    s.x = x;
    s.h = h;
    s.z = z;
    s.r = r;
    s.a0 = a0;
    s.a1 = a1;
    s.w = w;
    s.rise = rise;
    s.cr = c.r;
    s.cg = c.g;
    s.cb = c.b;
    s.edge = 1;
    s.t = 0;
    s.life = Math.max(1e-3, life);
    s.delay = 0;
    s.vx = 0;
    s.vz = 0;
    s.spin = 0;
    s.grow = 0;
    this.live.push(s);
    return s;
  }

  update(gdt) {
    const live = this.live;
    const g = this.geo;
    const arc = g.attributes.iArc.array;
    const ang = g.attributes.iAng.array;
    const anim = g.attributes.iAnim.array;
    const col = g.attributes.iCol.array;
    let n = 0;
    let drawn = 0;
    for (let i = 0; i < live.length; i++) {
      const s = live[i];
      if (s.delay > 0) {
        s.delay -= gdt;
        live[n++] = s;
        continue;
      }
      s.t += gdt;
      if (s.t >= s.life) {
        this.free.push(s);
        continue;
      }
      live[n++] = s;
      s.x += s.vx * gdt;
      s.z += s.vz * gdt;
      s.r += s.grow * gdt;
      if (s.spin) {
        s.a0 += s.spin * gdt;
        s.a1 += s.spin * gdt;
      }
      streakWindow(s.kind, s.t / s.life, _w);
      const j = drawn++;
      arc[j * 4] = s.x;
      arc[j * 4 + 1] = s.h;
      arc[j * 4 + 2] = s.z;
      arc[j * 4 + 3] = s.r;
      ang[j * 4] = s.a0;
      ang[j * 4 + 1] = s.a1;
      ang[j * 4 + 2] = s.w;
      ang[j * 4 + 3] = s.rise;
      anim[j * 4] = _w.head;
      anim[j * 4 + 1] = _w.tail;
      anim[j * 4 + 2] = _w.alpha;
      anim[j * 4 + 3] = s.edge;
      col[j * 3] = s.cr;
      col[j * 3 + 1] = s.cg;
      col[j * 3 + 2] = s.cb;
    }
    live.length = n;
    g.instanceCount = drawn;
    if (drawn > this.peak) this.peak = drawn;
    this.mesh.visible = drawn > 0;
    if (drawn > 0) {
      g.attributes.iArc.needsUpdate = true;
      g.attributes.iAng.needsUpdate = true;
      g.attributes.iAnim.needsUpdate = true;
      g.attributes.iCol.needsUpdate = true;
    }
  }

  clear() {
    for (const s of this.live) this.free.push(s);
    this.live.length = 0;
    this.geo.instanceCount = 0;
    this.mesh.visible = false;
  }

  dispose() {
    this.clear();
    this.mesh.removeFromParent();
    this.geo.dispose();
    this.mat.dispose();
  }
}

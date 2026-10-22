// Lively figures, skeleton layer (prototype proto/rig-motion, owner decision #149: "they're super
// stiff"; switch: src/models/figureOptions.js).
//
// Runs after the AnimationMixer every frame and adds small rotations on top of the baked clip, so
// the clips stay as they are and every GLB girl (Blender-built and Meshy) gets the same life:
//  - breathing: chest and spine lift, shoulders rise, the head counter-rotates so the gaze holds
//  - weight shift: the pelvis rolls (legs kept vertical), the spine sways, the head tilts
//  - glances: every few seconds she looks somewhere else (head 60 %, neck 30 %, chest 10 %)
//  - the head leads a turn: the battle passes how far her body still has to turn (drive.turn)
//  - attack: leans back while the next attack charges (drive.windup), snaps through on release
//  - disabled: a dazed circle of the head and spine (her 'dizzy' face is on), not a jitter
//  - victory / cheer: a happy side-to-side head bob
//  - springs: the hair / tail / braid / bangs / coat bones a figure already has lag behind the
//    head's or hips' motion and settle (damped springs, swing only, clamped; Hikari's 58-bone rig
//    gets bangs, hair and coat follow-through for free)
// Every bone it touches gets its clip value back before the next mixer update, so the offsets never
// pile up on bones a clip does not animate. Display only: it reads `drive` (written by the battle
// from sim state) and writes nothing the sim can see.
import * as THREE from 'three';
import { figureOptions } from './figureOptions.js';
import { SKIRT_BONES, SKIRT_DIRS } from './livelySkirt.js';

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];

/** Body bones the layer moves (a missing one is skipped). */
const BODY = ['hips', 'spine', 'spine1', 'chest', 'neck', 'head', 'shoulder_L', 'shoulder_R', 'thigh_L', 'thigh_R'];
/** Secondary bones that spring (existing bones of the GLB). */
const CHAIN_RE = /^(hair|bangs|tail|braid|bun|coat|skirt|cape|ribbon|scarf)/i;
/**
 * Spring settings per kind: stiffness k (1/s²), damping ratio, clamp (deg), response to the
 * anchor's linear acceleration (rad per body-height/s²) and angular velocity (rad per rad/s),
 * idle breeze (deg). The skirt / coat clamp keeps a hem from lifting more than 12°.
 */
const CHAIN_KINDS = [
  [/^bangs/i, { k: 160, zeta: 0.5, max: 5, lin: 0.004, ang: 0.02, breeze: 0.3 }],
  [/^(coat|skirt|cape)/i, { k: 110, zeta: 0.42, max: 12, lin: 0.01, ang: 0.05, breeze: 0.8 }],
  [/^(ribbon|scarf)/i, { k: 80, zeta: 0.35, max: 20, lin: 0.016, ang: 0.07, breeze: 1.4 }],
  // buns (Noa's authored bun_L / bun_R, pivoting where they meet her head): a compact mass, so a small,
  // a little stiffer bob that settles quickly, never a jelly wobble
  [/^bun/i, { k: 75, zeta: 0.38, max: 10, lin: 0.012, ang: 0.05, breeze: 0.5 }],
  [/./, { k: 60, zeta: 0.3, max: 18, lin: 0.014, ang: 0.06, breeze: 1.2 }], // hair, tails, braids
];
/** The runtime skirt (livelySkirt.js): hem outward at most `max`°, inward at most `inward`°. */
const SKIRT_KIND = { k: 110, zeta: 0.4, max: 12, inward: 3, lin: 0.012, ang: 0.05, breeze: 0.7 };

/** Frame cost of the layer (the preview reads and resets it). */
export const livelyStats = { ms: 0, figures: 0 };

const _q = new THREE.Quaternion();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _w = new THREE.Vector3();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Small seeded PRNG (mulberry32) for per-instance phases. */
export function livelyRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let instances = 0;
/** A fresh per-instance seed (creation order + unit id), so copies of one girl move out of step. */
export function livelySeed(id = '') {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  instances = (instances + 1) | 0;
  return (h ^ Math.imul(instances, 0x9e3779b1)) >>> 0;
}

/**
 * Rest data of an asset's skeleton, cached on the asset: per body bone its rest rotation in the
 * figure's own frame and the figure's X / Y / Z axes in the bone's local frame; the spring chains.
 * Null when the skeleton has no head / chest (nothing to do).
 */
export function livelyRigInfo(asset) {
  if (asset.livelyInfo !== undefined) return asset.livelyInfo;
  const scene = asset.scene;
  scene.updateMatrixWorld(true);
  const rootQi = scene.getWorldQuaternion(new THREE.Quaternion()).invert();
  const rootInv = new THREE.Matrix4().copy(scene.matrixWorld).invert();
  const bones = new Map();
  scene.traverse((o) => {
    if (o.isBone && !bones.has(o.name)) bones.set(o.name, o);
  });
  if (!bones.has('head') || !bones.has('chest')) {
    asset.livelyInfo = null;
    return null;
  }
  const rest = (b) => {
    const q = b.getWorldQuaternion(new THREE.Quaternion()).premultiply(rootQi);
    const qi = q.clone().invert();
    return {
      name: b.name,
      q,
      qi,
      axes: AXES.map((a) => a.clone().applyQuaternion(qi)),
      pos: new THREE.Vector3().setFromMatrixPosition(b.matrixWorld).applyMatrix4(rootInv),
    };
  };
  const info = { body: {}, chains: [], height: 1 };
  for (const n of BODY) if (bones.has(n)) info.body[n] = rest(bones.get(n));
  // which side each shoulder / thigh is on (+1 = +X, the figure's left; she faces +Z)
  for (const n of ['shoulder_L', 'shoulder_R', 'thigh_L', 'thigh_R']) {
    const r = info.body[n];
    if (!r) continue;
    const child = bones.get(n).children.find((c) => c.isBone);
    const x = child ? rest(child).pos.x : r.pos.x;
    r.side = Math.sign(x - (info.body.chest?.pos.x ?? 0)) || (n.endsWith('_L') ? 1 : -1);
  }
  const top = info.body.head ? info.body.head.pos.y : 1;
  info.height = Math.max(0.1, top * 1.25);
  for (const b of bones.values()) {
    if (!CHAIN_RE.test(b.name) || (b.parent?.isBone && CHAIN_RE.test(b.parent.name))) continue;
    const list = [];
    for (let cur = b; cur; cur = cur.children.find((c) => c.isBone && CHAIN_RE.test(c.name)) || null) list.push(cur);
    let anchor = b.parent;
    while (anchor && !anchor.isBone) anchor = anchor.parent;
    if (!anchor) continue;
    const links = list.map(rest);
    const last = list[list.length - 1];
    const tipChild = last.children.find((c) => c.isBone);
    let dir;
    if (list.length > 1) dir = links[links.length - 1].pos.clone().sub(links[0].pos);
    else if (tipChild) dir = rest(tipChild).pos.sub(links[0].pos);
    else dir = new THREE.Vector3(0, 1, 0).applyQuaternion(links[0].q); // a leaf bone points along its +Y
    if (dir.lengthSq() < 1e-10) dir.set(0, -1, 0);
    const n = links.length;
    const weights = links.map((_, i) => (n - i) / ((n * (n + 1)) / 2));
    const kind = CHAIN_KINDS.find(([re]) => re.test(b.name))[1];
    info.chains.push({ names: list.map((x) => x.name), anchor: anchor.name, links, dir: dir.normalize(), weights, kind });
  }
  // the runtime skirt bones (livelySkirt.js): one spring, four panels that may swing outward 12°
  // but inward only 3° (they never cut into the thighs)
  if (SKIRT_BONES.every((n) => bones.has(n)) && bones.has('hips')) {
    const down = new THREE.Vector3(0, -1, 0);
    const parts = SKIRT_BONES.map((n, j) => {
      const u = new THREE.Vector3(SKIRT_DIRS[j][0], 0, SKIRT_DIRS[j][1]);
      return { u, a: down.clone().cross(u).normalize() };
    });
    info.chains.push({
      names: SKIRT_BONES.slice(), anchor: 'hips', links: SKIRT_BONES.map((n) => rest(bones.get(n))), dir: down,
      weights: [1, 1, 1, 1], kind: SKIRT_KIND, skirt: parts,
    });
  }
  asset.livelyInfo = info;
  return info;
}

/** Adds a rotation (radians) about the figure's X (pitch), Y (yaw) and Z (roll) axes to a bone. */
function addRot(bone, axes, pitch, yaw, roll) {
  if (yaw) bone.quaternion.multiply(_q.setFromAxisAngle(axes[1], yaw));
  if (pitch) bone.quaternion.multiply(_q.setFromAxisAngle(axes[0], pitch));
  if (roll) bone.quaternion.multiply(_q.setFromAxisAngle(axes[2], roll));
}

const expK = (dt, rate) => 1 - Math.exp(-dt * rate);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

/** The skeleton layer of one figure instance. `ok` is false when the rig has nothing to move. */
export class LivelyRig {
  /**
   * @param {THREE.Object3D} root the instance's GLB root (SkeletonUtils clone)
   * @param {object} asset its asset (glbChibi.js)
   * @param {number} seed per-instance seed (livelySeed)
   */
  constructor(root, asset, seed) {
    this.info = livelyRigInfo(asset);
    this.ok = !!this.info;
    if (!this.ok) return;
    const byName = new Map();
    root.traverse((o) => {
      if (o.isBone && !byName.has(o.name)) byName.set(o.name, o);
    });
    this.root = root;
    this.tracked = [];
    this.saved = [];
    this.body = {};
    for (const [n, r] of Object.entries(this.info.body)) {
      const bone = byName.get(n);
      if (!bone) continue;
      this.body[n] = { bone, r };
      this.track(bone);
    }
    this.chains = [];
    for (const c of this.info.chains) {
      const bones = c.names.map((n) => byName.get(n));
      const anchor = byName.get(c.anchor);
      if (!anchor || bones.some((b) => !b)) continue;
      for (const b of bones) this.track(b);
      this.chains.push({ c, bones, anchor, w: new THREE.Vector3(), wv: new THREE.Vector3(), phase: 0 });
    }
    const rand = livelyRandom(seed);
    this.rand = rand;
    // out-of-step rhythms: breathing ~3.6 s, weight shift ~8 s, head tilt ~5.3 s
    this.Tb = 3.3 + rand() * 0.7;
    this.Ts = 7.2 + rand() * 2;
    this.Tt = 4.6 + rand() * 1.4;
    this.pb = rand() * TAU;
    this.ps = rand() * TAU;
    this.pt = rand() * TAU;
    for (const ch of this.chains) ch.phase = rand() * TAU;
    this.glance = { yaw: 0, pitch: 0, cy: 0, cp: 0, next: 1 + rand() * 3 };
    this.glanceScale = 1;
    this.dazeHold = false;
    this.dz = 0;
    this.turn = 0;
    this.lean = 0; // attack recoil spring (deg), chest pitch
    this.leanV = 0;
    this.windup = 0;
    this.fire = 0;
    this.lastT = -1;
    this.springAcc = 0;
    this.anchorPrev = new Map(); // anchor bone -> { p, v, q, a, w }
  }

  track(bone) {
    if (this.tracked.includes(bone)) return;
    this.tracked.push(bone);
    this.saved.push(bone.quaternion.clone());
  }

  /** Puts the clip values back (call right before mixer.update). */
  restore() {
    const tr = this.tracked;
    for (let i = 0; i < tr.length; i++) tr[i].quaternion.copy(this.saved[i]);
  }

  /**
   * Adds the layer (call right after mixer.update).
   * @param {number} time seconds
   * @param {number} dt seconds
   * @param {string} state the animator's state ('idle', 'attack', 'disabled', 'victory', ...)
   * @param {{ turn?: number, engaged?: boolean, windup?: number, fire?: number }|null} drive from the battle
   */
  apply(time, dt, state, drive = null) {
    const t0 = now();
    const tr = this.tracked;
    for (let i = 0; i < tr.length; i++) this.saved[i].copy(tr[i].quaternion);
    const o = figureOptions();
    const A = o.reduceMotion ? 0.5 : 1;
    const slow = o.reduceMotion ? 0.75 : 1;
    const low = o.quality === 'low';
    const t = time;
    if (t < this.lastT) this.glance.next = t + 1; // time restarted (a new viewer)
    this.lastT = t;
    const disabled = state === 'disabled' || state === 'hurt';
    const happy = state === 'victory' || state === 'cheer';
    const engaged = !!drive?.engaged;
    const rand = this.rand;

    // rhythms
    const b = low ? 0 : Math.sin((TAU * t * slow) / this.Tb + this.pb);
    const s = Math.sin((TAU * t * slow) / this.Ts + this.ps);
    const s2 = Math.sin((TAU * t * slow) / this.Tt + this.pt);

    // glances: hold a look for 3-7 s; engaged = eyes on the target (her facing)
    const g = this.glance;
    if (t >= g.next) {
      const away = rand() < 0.5;
      g.yaw = away ? (rand() < 0.5 ? -1 : 1) * (8 + rand() * 12) : (rand() - 0.5) * 6;
      g.pitch = away ? -3 + rand() * 6 : 0;
      g.next = t + 3 + rand() * 4;
    }
    // glanceScale: < 1 on a base clip that looks around by itself (GlbAnimator.markGlances, from the
    // GLB's clipMarks: Noa's 338 idle runs them at 0.4x so the two never stack into a 40° swing);
    // Reduce motion halves them like everything else
    const gs = this.glanceScale * A;
    const gy = engaged || disabled ? 0 : g.yaw * gs;
    const gp = engaged || disabled ? 0 : g.pitch * gs;
    g.cy += (gy - g.cy) * expK(dt, 6);
    g.cp += (gp - g.cp) * expK(dt, 6);

    // the head leads a turn (drive.turn: how far her body still has to turn, rad)
    const turnT = clamp(drive?.turn || 0, -60 * D2R, 60 * D2R);
    this.turn += (turnT - this.turn) * expK(dt, 20);

    // attack: lean back while it charges, snap through on release (a damped spring, deg)
    this.windup += ((drive?.windup || 0) - this.windup) * expK(dt, 25);
    if (drive && drive.fire !== this.fire) {
      if (drive.fire > this.fire) this.leanV += 75 * A;
      this.fire = drive.fire;
    }
    {
      const k = 220;
      const c = 16;
      const n = Math.max(1, Math.ceil(dt / (1 / 60)));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        this.leanV += (-k * this.lean - c * this.leanV) * h;
        this.lean += this.leanV * h;
      }
    }
    const wind = this.windup * A;

    // dazed (disabled) and happy (victory) extras
    const w = TAU * 0.8 * slow;
    // the dazed circle eases in once the hurt one-shot is over (dazeHold, set by GlbAnimator), so a
    // new hurt clip and the circle never stack into one busy double motion
    this.dz += ((disabled && !this.dazeHold ? 1 : 0) - this.dz) * expK(dt, 4);
    const dz = this.dz;
    const hp = happy ? 1 : 0;

    const yawT = this.turn; // rad
    const B = this.body;
    // degrees below, converted once per bone
    if (B.hips) addRot(B.hips.bone, B.hips.r.axes, 0, 0, 1.2 * s * A * D2R);
    for (const n of ['thigh_L', 'thigh_R']) if (B[n] && B.hips) addRot(B[n].bone, B[n].r.axes, 0, 0, -1.2 * s * A * D2R);
    if (B.spine) {
      addRot(B.spine.bone, B.spine.r.axes, (-0.8 * b * A + 1.5 * dz) * D2R, 0, (1.6 * s * A + 3 * A * dz * Math.sin(w * t - 0.6)) * D2R);
    }
    if (B.spine1) addRot(B.spine1.bone, B.spine1.r.axes, -0.5 * b * A * D2R, 0, 0);
    if (B.chest) {
      addRot(B.chest.bone, B.chest.r.axes,
        (-1.4 * b * A - 4 * wind + this.lean * 0.6 + 2 * hp * A * Math.sin(TAU * 2.2 * t)) * D2R,
        yawT * 0.2 + 0.1 * g.cy * D2R,
        0.8 * s * A * D2R);
    }
    if (B.neck) addRot(B.neck.bone, B.neck.r.axes, 0.3 * g.cp * D2R, yawT * 0.3 + 0.3 * g.cy * D2R, -0.8 * s * A * D2R);
    if (B.head) {
      addRot(B.head.bone, B.head.r.axes,
        (0.7 * b * A + 0.7 * g.cp + 2 * wind + 4 * A * dz * Math.cos(w * t)) * D2R,
        yawT * 0.5 + 0.6 * g.cy * D2R,
        (3.5 * s2 * A - 1.0 * s * A + 7 * A * dz * Math.sin(w * t) + 6 * A * hp * Math.sin(TAU * 1.15 * t)) * D2R);
    }
    for (const n of ['shoulder_L', 'shoulder_R']) {
      const sh = B[n];
      if (sh) addRot(sh.bone, sh.r.axes, 0, 0, 1.6 * b * A * (sh.r.side || 1) * D2R);
    }

    // springs (high: every frame; medium: 30 Hz; low: off)
    if (!low && this.chains.length) {
      this.springAcc += dt;
      const step = o.quality === 'medium' ? 1 / 30 : 0;
      if (this.springAcc >= step) {
        this.stepSprings(t, this.springAcc, A);
        this.springAcc = 0;
      }
      this.applySprings();
    }
    livelyStats.ms += now() - t0;
    livelyStats.figures++;
  }

  /** Advances the chain springs from the anchors' motion (their world matrices from the last frame). */
  stepSprings(t, dt, A) {
    if (dt <= 0) return;
    dt = Math.min(dt, 0.1);
    const root = this.root;
    root.matrixWorld.decompose(_p, _qa, _s);
    const rootQi = _qa.invert(); // world -> figure frame
    const height = Math.max(1e-3, this.info.height * _s.y);
    for (const ch of this.chains) {
      let st = this.anchorPrev.get(ch.anchor);
      const p = new THREE.Vector3().setFromMatrixPosition(ch.anchor.matrixWorld);
      ch.anchor.matrixWorld.decompose(_v, _q, _s);
      if (!st) {
        st = { p, v: new THREE.Vector3(), q: _q.clone(), a: new THREE.Vector3(), w: new THREE.Vector3(), t: -1, n: 0 };
        this.anchorPrev.set(ch.anchor, st);
      }
      if (st.t !== t) {
        // once per anchor per step: velocity, acceleration (body heights / s²), angular velocity;
        // the first steps only learn where the anchor is (its matrices start at the bind pose)
        st.n++;
        _v.copy(p).sub(st.p).divideScalar(dt);
        _a.copy(_v).sub(st.v).divideScalar(dt).divideScalar(height).applyQuaternion(rootQi);
        if (st.n < 3) _a.set(0, 0, 0);
        if (_a.lengthSq() > 4e6) _a.setLength(2000); // a teleport (hero move, a new view)
        st.a.lerp(_a, 0.5);
        st.v.copy(_v);
        st.p.copy(p);
        _qb.copy(st.q).invert().premultiply(_q); // q * q_prev^-1
        if (_qb.w < 0) _qb.set(-_qb.x, -_qb.y, -_qb.z, -_qb.w);
        const ang = 2 * Math.acos(Math.min(1, _qb.w));
        const sn = Math.sqrt(Math.max(1e-12, 1 - _qb.w * _qb.w));
        _w.set(_qb.x / sn, _qb.y / sn, _qb.z / sn).multiplyScalar(ang / dt).applyQuaternion(rootQi);
        if (st.n < 3) _w.set(0, 0, 0);
        if (_w.lengthSq() > 2500) _w.setLength(50);
        st.w.lerp(_w, 0.5);
        st.q.copy(_q);
        st.t = t;
      }
      const K = ch.c.kind;
      const d = ch.c.dir;
      // target swing: away from the anchor's acceleration, lagging its rotation, plus a breeze
      const tgt = _w.copy(d).cross(st.a).multiplyScalar(-K.lin);
      _v.copy(st.w).addScaledVector(d, -st.w.dot(d)).multiplyScalar(-K.ang);
      tgt.add(_v);
      const br = K.breeze * A * D2R;
      tgt.x += br * Math.sin(TAU * 0.45 * t + ch.phase);
      tgt.z += br * 0.8 * Math.sin(TAU * 0.31 * t + ch.phase * 1.7);
      const k = K.k;
      const c = 2 * K.zeta * Math.sqrt(k);
      const n = Math.max(1, Math.ceil(dt / (1 / 60)));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        _a.copy(tgt).sub(ch.w).multiplyScalar(k).addScaledVector(ch.wv, -c);
        ch.wv.addScaledVector(_a, h);
        ch.w.addScaledVector(ch.wv, h);
      }
      const max = K.max * D2R;
      const len = ch.w.length();
      if (len > max) {
        ch.w.multiplyScalar(max / len);
        ch.wv.multiplyScalar(0.5);
      }
    }
  }

  applySprings() {
    for (const ch of this.chains) {
      const len = ch.w.length();
      if (len < 1e-5) continue;
      const links = ch.c.links;
      if (ch.c.skirt) {
        // four panels share the swing; each keeps its outward part ≤ max and inward part ≤ inward
        const K = ch.c.kind;
        for (let j = 0; j < ch.bones.length; j++) {
          const { a } = ch.c.skirt[j];
          const phi = ch.w.dot(a);
          _p.copy(ch.w);
          if (phi < -K.inward * D2R) _p.addScaledVector(a, -K.inward * D2R - phi);
          else if (phi > K.max * D2R) _p.addScaledVector(a, K.max * D2R - phi);
          const l = _p.length();
          if (l < 1e-5) continue;
          _v.copy(_p).divideScalar(l).applyQuaternion(links[j].qi);
          ch.bones[j].quaternion.multiply(_q.setFromAxisAngle(_v, l));
        }
        continue;
      }
      _w.copy(ch.w).divideScalar(len);
      for (let i = 0; i < ch.bones.length; i++) {
        _v.copy(_w).applyQuaternion(links[i].qi);
        ch.bones[i].quaternion.multiply(_q.setFromAxisAngle(_v, len * ch.c.weights[i]));
      }
    }
  }
}

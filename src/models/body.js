// Shared chibi body: the owner's base mesh (public/models/chibi_base.glb) processed once
// into a posed, region-tagged, skin-weighted geometry. A fully procedural body with the
// same landmarks is used when the GLB is unavailable (node tests, offline).
//
// All character construction happens in "girl space": the GLB's own units with the node
// transform applied (feet at y=0, head top ≈ 4.07, face towards +z). The finished model is
// scaled down to ≈0.9 world units by the caller.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { smoothstep, sphere, ellipsoid, capsule, cyl, xform, clean, merge } from './geom.js';

export const BONES = {
  root: 0, hips: 1, chest: 2, head: 3, armL: 4, armR: 5, legL: 6, legR: 7,
  halo: 8, handL: 9, handR: 10, tailL: 11, tailR: 12, tailB: 13, skirt: 14,
};
export const BONE_PARENT = [-1, 0, 1, 2, 2, 2, 1, 1, 0, 4, 5, 3, 3, 3, 1];

export const REGION = { HEAD: 0, NECK: 1, TORSO: 2, HIPS: 3, THIGH: 4, SHIN: 5, FOOT: 6, UPPERARM: 7, FOREARM: 8, HAND: 9 };

/** Landmarks in girl space (after arm posing, before the hero proportion map). */
export const LM = {
  headCenter: new THREE.Vector3(0, 2.9, -0.1),
  headRadii: new THREE.Vector3(1.12, 1.17, 1.03),
  neck: new THREE.Vector3(0, 1.68, -0.14),
  chest: new THREE.Vector3(0, 1.15, -0.2),
  hips: new THREE.Vector3(0, 0.72, -0.2),
  shoulderL: new THREE.Vector3(0.53, 1.31, -0.2),
  legL: new THREE.Vector3(0.25, 0.55, -0.2),
  halo: new THREE.Vector3(0, 4.45, -0.3),
  faceZ: 0.9,
  eyeY: 2.48,
  mouthY: 2.08,
  torsoTop: 1.6,
  waist: 1.0,
  crotch: 0.55,
  knee: 0.3,
  ankle: 0.14,
};

// Arm axis in the T-pose and the pose we bend it into.
const ARM_PIVOT = new THREE.Vector3(0.53, 1.31, -0.2);
const ARM_DIR = new THREE.Vector2(0.94, -0.34).normalize();
const ARM_DOWN = THREE.MathUtils.degToRad(47);
const ARM_FORWARD = THREE.MathUtils.degToRad(-10);
const ARM_LEN = 0.47;

let glbBase = null; // processed GLB body (girl space)
const glbLite = {}; // decimated variants per quality ('medium', 'low')
const LITE_RATIO = { medium: 0.55, low: 0.35 };
let fallbackBase = null;
let loadPromise = null;

/** Resolves the URL of the base mesh relative to the app base. */
function baseUrl() {
  let base = '/';
  try {
    base = import.meta.env?.BASE_URL ?? '/';
  } catch {
    base = '/';
  }
  return `${base.replace(/\/?$/, '/')}models/chibi_base.glb`;
}

/**
 * Loads and processes the base mesh once. Safe to call many times; resolves to true when
 * the GLB body is available and false when the procedural fallback will be used.
 */
export function loadBaseBody() {
  if (loadPromise) return loadPromise;
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    loadPromise = Promise.resolve(false);
    return loadPromise;
  }
  loadPromise = new GLTFLoader().loadAsync(baseUrl())
    .then((gltf) => {
      let mesh = null;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
      if (!mesh) return false;
      const raw = mesh.geometry.clone();
      raw.applyMatrix4(mesh.matrixWorld);
      for (const name of Object.keys(raw.attributes)) if (name !== 'position' && name !== 'normal') raw.deleteAttribute(name);
      glbBase = processGLB(raw.clone());
      mesh.geometry.dispose();
      return buildLiteBodies(raw).then(() => true);
    })
    .catch((err) => {
      if (typeof console !== 'undefined') console.warn('[models] chibi_base.glb unavailable, using procedural body', err?.message || err);
      return false;
    });
  return loadPromise;
}

/** Decimated copies of the base mesh for medium/low quality (meshoptimizer, done once). */
async function buildLiteBodies(raw) {
  try {
    const { SimplifyModifier } = await import('three/addons/modifiers/SimplifyModifier.js');
    const mod = new SimplifyModifier();
    for (const [q, ratio] of Object.entries(LITE_RATIO)) {
      const count = Math.floor(raw.attributes.position.count * (1 - ratio));
      const g = await mod.modify(raw.clone(), count);
      g.computeVertexNormals();
      glbLite[q] = processGLB(g);
    }
  } catch (err) {
    if (typeof console !== 'undefined') console.warn('[models] body decimation unavailable, using full mesh', err?.message || err);
  }
}

export function hasGLBBody() {
  return !!glbBase;
}

/** Returns the processed base body for a quality level (GLB if loaded, else procedural). */
export function baseBody(quality = 'high') {
  if (glbBase) return glbLite[quality] || glbBase;
  if (!fallbackBase) fallbackBase = buildFallbackBody();
  return fallbackBase;
}

// ---------------------------------------------------------------------------
// GLB processing
// ---------------------------------------------------------------------------

function armInfo(x, y) {
  const side = x >= 0 ? 1 : -1;
  const lx = Math.abs(x) - ARM_PIVOT.x;
  const ly = y - ARM_PIVOT.y;
  const t = lx * ARM_DIR.x + ly * ARM_DIR.y; // along the arm
  const perp = Math.abs(lx * ARM_DIR.y - ly * ARM_DIR.x); // distance from the axis
  let w = smoothstep(-0.05, 0.1, t) * (1 - smoothstep(0.2, 0.3, perp));
  if (y < 0.95) w = 0;
  return { side, t, w };
}

function processGLB(geo) {
  clean(geo);
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const count = pos.count;
  const regions = new Uint8Array(count);
  const skinIndex = new Uint16Array(count * 4);
  const skinWeight = new Float32Array(count * 4);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const qDown = new THREE.Quaternion();
  const qFwd = new THREE.Quaternion();
  const q = new THREE.Quaternion();
  const pivot = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    const { side, t, w } = armInfo(p.x, p.y);

    // --- regions (from T-pose coordinates) ---
    let region;
    if (w > 0.5) region = t > 0.3 ? REGION.HAND : (t > 0.2 ? REGION.FOREARM : REGION.UPPERARM);
    else if (p.y > 1.74) region = REGION.HEAD;
    else if (p.y > 1.56) region = REGION.NECK;
    else if (p.y > 0.86) region = REGION.TORSO;
    else if (p.y > 0.6) region = REGION.HIPS;
    else if (p.y > 0.36) region = REGION.THIGH;
    else if (p.y > 0.13) region = REGION.SHIN;
    else region = REGION.FOOT;
    regions[i] = region;

    // --- skin weights ---
    const head = smoothstep(1.6, 1.78, p.y);
    const arm = w * (1 - head);
    const leg = (1 - smoothstep(0.42, 0.72, p.y)) * (1 - arm);
    const rest = Math.max(0, 1 - head - arm - leg);
    const chestShare = smoothstep(0.78, 1.12, p.y);
    const infl = [
      [BONES.head, head],
      [side > 0 ? BONES.armL : BONES.armR, arm],
      [p.x >= 0 ? BONES.legL : BONES.legR, leg],
      [BONES.chest, rest * chestShare],
      [BONES.hips, rest * (1 - chestShare)],
    ].filter((e) => e[1] > 0.001).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = infl.reduce((s, e) => s + e[1], 0) || 1;
    infl.forEach((e, k) => {
      skinIndex[i * 4 + k] = e[0];
      skinWeight[i * 4 + k] = e[1] / sum;
    });
    if (!infl.length) {
      skinIndex[i * 4] = BONES.hips;
      skinWeight[i * 4] = 1;
    }

    // --- tuck the ears flat against the head (hair or animal ears replace them) ---
    if (p.y > 2.0 && p.y < 3.0 && Math.abs(p.x) > 1.02 && p.z > -0.75 && p.z < 0.45) {
      const ax = Math.abs(p.x);
      const lim = 1.02 + (ax - 1.02) * 0.25;
      p.x = Math.sign(p.x) * lim;
    }

    // --- shrink the detailed hands into a nub; a round chibi fist is added on top ---
    if (region === REGION.HAND) {
      const hc = handCenterT(side);
      p.sub(hc).multiplyScalar(0.32).add(hc);
    }

    // --- pose the arms down (weighted rotation about the shoulder) ---
    if (w > 0) {
      pivot.set(side * ARM_PIVOT.x, ARM_PIVOT.y, ARM_PIVOT.z);
      qDown.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -side * ARM_DOWN * w);
      qFwd.setFromAxisAngle(new THREE.Vector3(1, 0, 0), ARM_FORWARD * w);
      q.multiplyQuaternions(qFwd, qDown);
      p.sub(pivot).applyQuaternion(q).add(pivot);
      n.applyQuaternion(q);
    }
    pos.setXYZ(i, p.x, p.y, p.z);
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  geo.computeBoundingBox();
  return finishBase(geo, regions, 'glb');
}

/** Shared post-processing: landmarks + hand positions after posing. */
function finishBase(geo, regions, source) {
  const handL = handPosition(1);
  const handR = handPosition(-1);
  return {
    source, geometry: geo, regions, handL, handR,
    headSurface: makeHeadSurface(geo, regions),
  };
}

/** Hand centre in the T-pose (before posing). */
function handCenterT(side) {
  return new THREE.Vector3(side * (ARM_PIVOT.x + ARM_DIR.x * ARM_LEN), ARM_PIVOT.y + ARM_DIR.y * ARM_LEN, ARM_PIVOT.z);
}

/** Hand centre after posing for side (+1 = left / +x). */
export function handPosition(side) {
  const local = new THREE.Vector3(ARM_DIR.x * ARM_LEN * side, ARM_DIR.y * ARM_LEN, 0);
  const qDown = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -side * ARM_DOWN);
  const qFwd = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ARM_FORWARD);
  local.applyQuaternion(new THREE.Quaternion().multiplyQuaternions(qFwd, qDown));
  return new THREE.Vector3(side * ARM_PIVOT.x, ARM_PIVOT.y, ARM_PIVOT.z).add(local);
}

/**
 * Radial head-surface function sampled from the actual head vertices, so hair hugs the
 * owner's head shape (flat face, round cheeks) rather than an idealised ellipsoid.
 * Returns fn(dir: Vector3 unit) -> distance from LM.headCenter.
 */
function makeHeadSurface(geo, regions) {
  const TH = 24;
  const PH = 48;
  const grid = new Float32Array(TH * PH);
  const pos = geo.attributes.position;
  const c = LM.headCenter;
  const d = new THREE.Vector3();
  if (regions) {
    for (let i = 0; i < pos.count; i++) {
      if (regions[i] !== REGION.HEAD) continue;
      d.fromBufferAttribute(pos, i).sub(c);
      const r = d.length();
      if (r < 1e-4) continue;
      d.divideScalar(r);
      const th = Math.acos(THREE.MathUtils.clamp(d.y, -1, 1));
      const ph = Math.atan2(d.x, d.z);
      const ti = Math.min(TH - 1, Math.floor((th / Math.PI) * TH));
      const pi = ((Math.floor(((ph + Math.PI) / (Math.PI * 2)) * PH) % PH) + PH) % PH;
      const k = ti * PH + pi;
      if (r > grid[k]) grid[k] = r;
    }
  }
  // Fill holes with the analytic ellipsoid, then blur once.
  const ell = (th, ph) => {
    const dx = Math.sin(th) * Math.sin(ph);
    const dy = Math.cos(th);
    const dz = Math.sin(th) * Math.cos(ph);
    const R = LM.headRadii;
    return 1 / Math.sqrt((dx * dx) / (R.x * R.x) + (dy * dy) / (R.y * R.y) + (dz * dz) / (R.z * R.z));
  };
  for (let ti = 0; ti < TH; ti++) {
    for (let pi = 0; pi < PH; pi++) {
      const k = ti * PH + pi;
      const th = ((ti + 0.5) / TH) * Math.PI;
      if (th > Math.PI * 0.8) grid[k] = Math.max(grid[k], 0.55);
      if (!grid[k]) grid[k] = ell(th, ((pi + 0.5) / PH) * Math.PI * 2 - Math.PI);
    }
  }
  const blurred = new Float32Array(grid.length);
  for (let ti = 0; ti < TH; ti++) {
    for (let pi = 0; pi < PH; pi++) {
      let s = 0;
      let wsum = 0;
      for (let a = -1; a <= 1; a++) {
        for (let b = -1; b <= 1; b++) {
          const tj = THREE.MathUtils.clamp(ti + a, 0, TH - 1);
          const pj = (pi + b + PH) % PH;
          const w = a === 0 && b === 0 ? 2 : 1;
          s += grid[tj * PH + pj] * w;
          wsum += w;
        }
      }
      blurred[ti * PH + pi] = Math.max(grid[ti * PH + pi], s / wsum);
    }
  }
  return (dir) => {
    const th = Math.acos(THREE.MathUtils.clamp(dir.y, -1, 1));
    const ph = Math.atan2(dir.x, dir.z);
    const ft = THREE.MathUtils.clamp((th / Math.PI) * TH - 0.5, 0, TH - 1);
    const fp = ((ph + Math.PI) / (Math.PI * 2)) * PH - 0.5;
    const t0 = Math.floor(ft);
    const t1 = Math.min(TH - 1, t0 + 1);
    const p0 = ((Math.floor(fp) % PH) + PH) % PH;
    const p1 = (p0 + 1) % PH;
    const at = ft - t0;
    const ap = fp - Math.floor(fp);
    const v00 = blurred[t0 * PH + p0];
    const v01 = blurred[t0 * PH + p1];
    const v10 = blurred[t1 * PH + p0];
    const v11 = blurred[t1 * PH + p1];
    return (v00 * (1 - ap) + v01 * ap) * (1 - at) + (v10 * (1 - ap) + v11 * ap) * at;
  };
}

// ---------------------------------------------------------------------------
// Procedural fallback body (same landmarks; used in node and when offline)
// ---------------------------------------------------------------------------

function buildFallbackBody() {
  const parts = [];
  const regionsList = [];
  const add = (g, region, weights) => {
    clean(g);
    const count = g.attributes.position.count;
    const si = new Uint16Array(count * 4);
    const sw = new Float32Array(count * 4);
    const p = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      p.fromBufferAttribute(g.attributes.position, i);
      const infl = weights(p);
      infl.forEach(([b, w], k) => { si[i * 4 + k] = b; sw[i * 4 + k] = w; });
      regionsList.push(typeof region === 'function' ? region(p) : region);
    }
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    parts.push(g);
  };
  const c = LM.headCenter;
  const R = LM.headRadii;
  // Head with slightly fuller cheeks.
  const head = ellipsoid(R.x * 0.98, R.y, R.z, 32, 24);
  const hp = head.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const y = hp.getY(i);
    const z = hp.getZ(i);
    if (y < 0 && z > 0) hp.setZ(i, z * (1 + 0.08 * Math.sin(Math.min(1, -y / R.y) * Math.PI)));
  }
  head.computeVertexNormals();
  xform(head, { pos: [c.x, c.y, c.z] });
  add(head, REGION.HEAD, () => [[BONES.head, 1]]);
  add(xform(cyl(0.2, 0.24, 0.3, 12), { pos: [0, 1.66, -0.16] }), REGION.NECK, (p) => [[BONES.head, smoothstep(1.6, 1.78, p.y)], [BONES.chest, 1 - smoothstep(1.6, 1.78, p.y)]]);
  // Torso: lathe-like capsule squashed in z.
  const torso = capsule(0.5, 0.55, 8, 20);
  xform(torso, { pos: [0, 1.15, -0.2], scale: [1, 1, 0.78] });
  add(torso, (p) => (p.y > 0.86 ? REGION.TORSO : REGION.HIPS), (p) => {
    const cs = smoothstep(0.78, 1.12, p.y);
    return [[BONES.chest, cs], [BONES.hips, 1 - cs]];
  });
  const hips = ellipsoid(0.55, 0.32, 0.42, 20, 12);
  xform(hips, { pos: [0, 0.72, -0.2] });
  add(hips, REGION.HIPS, () => [[BONES.hips, 1]]);
  for (const side of [1, -1]) {
    const leg = capsule(0.2, 0.38, 6, 12);
    xform(leg, { pos: [side * 0.25, 0.42, -0.2] });
    add(leg, (p) => (p.y > 0.36 ? REGION.THIGH : (p.y > 0.13 ? REGION.SHIN : REGION.FOOT)), () => [[side > 0 ? BONES.legL : BONES.legR, 1]]);
    const foot = ellipsoid(0.2, 0.12, 0.3, 12, 8);
    xform(foot, { pos: [side * 0.25, 0.1, -0.14] });
    add(foot, REGION.FOOT, () => [[side > 0 ? BONES.legL : BONES.legR, 1]]);
    // Arm: capsule from shoulder to hand, hanging down.
    const sh = new THREE.Vector3(side * ARM_PIVOT.x, ARM_PIVOT.y, ARM_PIVOT.z);
    const hand = handPosition(side);
    const mid = sh.clone().lerp(hand, 0.5);
    const len = sh.distanceTo(hand);
    const arm = capsule(0.13, len * 0.8, 6, 10);
    const dir = hand.clone().sub(sh).normalize();
    arm.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    arm.translate(mid.x, mid.y, mid.z);
    add(arm, (p) => (p.distanceTo(sh) > len * 0.55 ? REGION.FOREARM : REGION.UPPERARM), () => [[side > 0 ? BONES.armL : BONES.armR, 1]]);
    const palm = sphere(0.15, 12, 8);
    palm.translate(hand.x, hand.y, hand.z);
    add(palm, REGION.HAND, () => [[side > 0 ? BONES.armL : BONES.armR, 1]]);
  }
  const geo = merge(parts.map((g) => {
    // merge() expects colours; paint white placeholder.
    const count = g.attributes.position.count;
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3));
    return g;
  }));
  geo.deleteAttribute('color');
  const regions = Uint8Array.from(regionsList);
  return finishBase(geo, regions, 'procedural');
}

// ---------------------------------------------------------------------------
// Proportion variants (heroes are adult guardians: taller, slimmer, smaller head)
// ---------------------------------------------------------------------------

export const PROPORTIONS = {
  girl: { stretch: 1, slim: 1, head: 1 },
  hero: { stretch: 1.34, slim: 0.9, head: 0.9 },
};

/**
 * Maps a girl-space point into the proportion variant (in place). Body below the neck is
 * stretched/slimmed; the head is uniformly scaled about the neck and carried upwards.
 */
export function mapPoint(v, prop) {
  if (prop.stretch === 1 && prop.slim === 1 && prop.head === 1) return v;
  const neckY = LM.neck.y;
  const t = smoothstep(neckY - 0.1, neckY + 0.08, v.y);
  // body mapping
  const bx = v.x * prop.slim;
  const by = v.y * prop.stretch;
  const bz = (v.z - LM.chest.z) * prop.slim + LM.chest.z;
  // head mapping
  const hx = v.x * prop.head;
  const hy = (v.y - neckY) * prop.head + neckY * prop.stretch;
  const hz = (v.z - LM.neck.z) * prop.head + LM.neck.z;
  v.set(bx + (hx - bx) * t, by + (hy - by) * t, bz + (hz - bz) * t);
  return v;
}

/** Maps a normal approximately through the variant's local scale (in place). */
export function mapNormal(n, p, prop) {
  if (prop.stretch === 1 && prop.slim === 1 && prop.head === 1) return n;
  const t = smoothstep(LM.neck.y - 0.1, LM.neck.y + 0.08, p.y);
  const sx = prop.slim + (prop.head - prop.slim) * t;
  const sy = prop.stretch + (prop.head - prop.stretch) * t;
  n.set(n.x / sx, n.y / sy, n.z / sx).normalize();
  return n;
}

/** Applies mapPoint/mapNormal to a whole geometry (in place). */
export function mapGeometry(geo, prop) {
  if (prop.stretch === 1 && prop.slim === 1 && prop.head === 1) return geo;
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    if (nor) {
      n.fromBufferAttribute(nor, i);
      mapNormal(n, p, prop);
      nor.setXYZ(i, n.x, n.y, n.z);
    }
    mapPoint(p, prop);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

/** Bone rest positions (girl space, before the proportion map). */
export function bonePivots(base, extra = {}) {
  const pts = new Array(Object.keys(BONES).length).fill(null).map(() => new THREE.Vector3());
  pts[BONES.root].set(0, 0, 0);
  pts[BONES.hips].copy(LM.hips);
  pts[BONES.chest].copy(LM.chest);
  pts[BONES.head].copy(LM.neck);
  pts[BONES.armL].set(ARM_PIVOT.x, ARM_PIVOT.y, ARM_PIVOT.z);
  pts[BONES.armR].set(-ARM_PIVOT.x, ARM_PIVOT.y, ARM_PIVOT.z);
  pts[BONES.legL].copy(LM.legL);
  pts[BONES.legR].set(-LM.legL.x, LM.legL.y, LM.legL.z);
  pts[BONES.halo].copy(LM.halo);
  pts[BONES.handL].copy(base.handL);
  pts[BONES.handR].copy(base.handR);
  pts[BONES.tailL].copy(extra.tailL || new THREE.Vector3(0.9, 3.4, -0.3));
  pts[BONES.tailR].copy(extra.tailR || new THREE.Vector3(-0.9, 3.4, -0.3));
  pts[BONES.tailB].copy(extra.tailB || new THREE.Vector3(0, 3.3, -1.0));
  pts[BONES.skirt].set(0, 1.0, -0.2);
  return pts;
}

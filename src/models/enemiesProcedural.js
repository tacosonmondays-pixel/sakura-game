// buildEnemy: procedural toon monsters for all 12 families with variant/prop handling,
// tier-based dressing (elites, minibosses, bosses) and runtime hooks (hit flash, veil
// shimmer, barrier bubble, phasing, status tints).
//
// Built in "enemy space" (a size-1 enemy is ≈1.0 tall, feet at y=0, facing +z) and scaled
// to 0.6 × def.size world units. Static pieces are merged per animated node, so a typical
// enemy is 2–6 draw calls (+ outlines on medium/high).
import * as THREE from 'three';
import {
  part, sphere, ellipsoid, cyl, cone, torus, box, capsule, strand, smoothPath, seg, lathe, star, extrude, merge,
} from './geom.js';
import { toonMaterial, outlineMaterial, col } from './toon.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const assetCache = new Map();
let seeThroughOutline = null;

const STATUS_TINT = {
  freeze: '#9fe3ff', slow: '#bfe6ff', poison: '#7bd389', burn: '#ff8a3d', shock: '#ffe066',
  stun: '#fff3a3', mark: '#ff5d73', vulnerable: '#a5f3fc', silence: '#b197fc', soak: '#4cc9f0',
  shred: '#c9a27e', reveal: '#fff59d',
};

/**
 * Builds an enemy model.
 * @param {object} def EnemyDef ({ id, family, tier, size, color, accent, model: { base, variant, props }, traits })
 * @param {{quality?: 'high'|'medium'|'low'}} [opts]
 * @returns {THREE.Group} userData: animate, hitFlash, setVeiled, setBarrier, setPhasing, setStatus
 */
export function buildEnemyProcedural(def = {}, { quality = 'high' } = {}) {
  const key = `${def.id}|${quality}|${def.model?.variant}|${(def.model?.props || []).join(',')}|${def.color}|${def.accent}|${def.size}`;
  let asset = assetCache.get(key);
  if (!asset) {
    asset = createAsset(def, quality);
    assetCache.set(key, asset);
  }
  return instantiate(asset, def, quality);
}

// ---------------------------------------------------------------------------
// Builder: collects geometry per animated node
// ---------------------------------------------------------------------------

class Builder {
  constructor(quality, def) {
    this.q = quality;
    this.def = def;
    this.nodes = new Map(); // name -> { pivot, parts: [], parent }
    this.node('body', V(0, 0, 0));
    this.anchors = {};
    this.transparent = new Set();
    this.done = new Set(); // props already drawn by a family builder
    this.main = 'body';
  }

  s(high, med, low) { return seg(this.q, high, med, low); }

  node(name, pivot, parent = 'body') {
    if (!this.nodes.has(name)) this.nodes.set(name, { pivot: pivot.clone(), parts: [], parent: name === 'body' ? null : parent, glow: [] });
    return this.nodes.get(name);
  }

  /** Adds a geometry (built in enemy space) to a node, coloured. */
  add(geo, { color = '#ffffff', node = 'body', ...t } = {}) {
    const g = part(geo, { color: color instanceof THREE.Color || typeof color === 'function' ? color : col(color), ...t });
    this.node(node).parts.push(g);
    return g;
  }

  /** Unlit glowing piece (eyes, cores, runes). */
  addGlow(geo, { color = '#ffffff', node = 'body', ...t } = {}) {
    const g = part(geo, { color: col(color), ...t });
    this.node(node).glow.push(g);
    return g;
  }
}

/** Cute big eyes: dark oval + white highlight. `style`: cute | angry | glow | sleepy */
function eyes(B, { y, z, x = 0.16, size = 0.1, node = 'body', style = 'cute', color = '#1f1a2e', glow = '#ffef8a', tilt = 0 }) {
  for (const side of [-1, 1]) {
    if (style === 'glow') {
      B.addGlow(ellipsoid(size * 0.9, size * 0.55, size * 0.4, 10, 6), { pos: [side * x, y, z], rot: [0, 0, side * (0.25 + tilt)], color: glow, node });
      continue;
    }
    B.add(ellipsoid(size * 0.75, size, size * 0.45, B.s(12, 10, 6), B.s(10, 8, 6)), { pos: [side * x, y, z], rot: [0, 0, side * tilt], color, node });
    B.add(sphere(size * 0.3, 6, 4), { pos: [side * x - size * 0.22, y + size * 0.35, z + size * 0.32], color: '#ffffff', node });
    if (style === 'angry') {
      B.add(box(size * 1.8, size * 0.32, size * 0.3), { pos: [side * x, y + size * 1.05, z + 0.01], rot: [0, 0, side * -0.45], color, node });
    }
    if (style === 'sleepy') {
      B.add(box(size * 1.7, size * 0.5, size * 0.4), { pos: [side * x, y + size * 0.6, z + 0.015], color: B.def.color || '#888888', node });
    }
  }
}

function mouth(B, { y, z, w = 0.08, node = 'body', kind = 'smile', color = '#3a1f2e' }) {
  if (kind === 'fangs') {
    B.add(box(w * 1.6, w * 0.25, w * 0.3), { pos: [0, y, z], color, node });
    for (const side of [-1, 1]) B.add(cone(w * 0.18, w * 0.5, 4), { pos: [side * w * 0.45, y - w * 0.3, z + 0.01], rot: [Math.PI, 0, 0], color: '#ffffff', node });
    return;
  }
  if (kind === 'o') {
    B.add(ellipsoid(w * 0.35, w * 0.45, w * 0.2, 8, 6), { pos: [0, y, z], color, node });
    return;
  }
  const t = torus(w * 0.5, w * 0.12, 4, 10, Math.PI);
  B.add(t, { pos: [0, y + w * 0.25, z], rot: [0, 0, Math.PI], color, node });
}

const has = (def, k) => !!def.traits?.[k];
const propsOf = (def) => new Set([...(def.model?.props || [])]);

// ---------------------------------------------------------------------------
// Shared props (hand/head/back items)
// ---------------------------------------------------------------------------

function weaponProp(B, kind, { pos, node = 'body', scale = 1, color }) {
  const s = scale;
  const wood = '#8a5a3c';
  const metal = color || '#c9d1de';
  const [x, y, z] = pos;
  switch (kind) {
    case 'club':
      B.add(cyl(0.05 * s, 0.11 * s, 0.7 * s, 8), { pos: [x, y + 0.3 * s, z], rot: [0.3, 0, 0], color: color || wood, node });
      for (let i = 0; i < 5; i++) B.add(cone(0.035 * s, 0.09 * s, 4), { pos: [x + Math.cos(i * 1.3) * 0.1 * s, y + (0.45 + i * 0.06) * s, z + 0.15 * s + Math.sin(i * 1.3) * 0.08 * s], rot: [Math.PI / 2, 0, i], color: '#e9ecef', node });
      break;
    case 'axe':
      B.add(cyl(0.035 * s, 0.035 * s, 0.8 * s, 6), { pos: [x, y + 0.25 * s, z], color: wood, node });
      B.add(extrude(halfMoon(0.22 * s), 0.04 * s), { pos: [x, y + 0.55 * s, z + 0.05 * s], rot: [0, Math.PI / 2, 0], color: metal, node });
      break;
    case 'spear':
      B.add(cyl(0.025 * s, 0.025 * s, 1.2 * s, 6), { pos: [x, y + 0.35 * s, z], color: wood, node });
      B.add(cone(0.06 * s, 0.2 * s, 6), { pos: [x, y + 1.02 * s, z], color: metal, node });
      break;
    case 'sword':
    case 'dagger': {
      const L = kind === 'dagger' ? 0.32 : 0.6;
      B.add(box(0.06 * s, L * s, 0.02 * s), { pos: [x, y + (L / 2 + 0.08) * s, z + 0.05 * s], rot: [0.5, 0, 0], color: metal, node });
      B.add(box(0.16 * s, 0.03 * s, 0.04 * s), { pos: [x, y + 0.07 * s, z + 0.01 * s], rot: [0.5, 0, 0], color: '#f2c14e', node });
      break;
    }
    case 'staff':
      B.add(cyl(0.025 * s, 0.03 * s, 1.1 * s, 6), { pos: [x, y + 0.3 * s, z], color: color || '#5c4a72', node });
      B.addGlow(sphere(0.09 * s, 10, 8), { pos: [x, y + 0.9 * s, z], color: B.def.accent || '#b197fc', node });
      B.add(torus(0.1 * s, 0.015 * s, 4, 12), { pos: [x, y + 0.9 * s, z], rot: [Math.PI / 2, 0, 0], color: '#f2c14e', node });
      break;
    case 'bow':
      B.add(torus(0.35 * s, 0.02 * s, 4, 14, Math.PI * 0.8), { pos: [x, y + 0.2 * s, z], rot: [0, Math.PI / 2, Math.PI * 0.6], color: wood, node });
      break;
    case 'bomb':
      B.add(sphere(0.13 * s, 10, 8), { pos: [x, y + 0.08 * s, z], color: '#2b2d42', node });
      B.add(cyl(0.015 * s, 0.015 * s, 0.1 * s, 4), { pos: [x, y + 0.24 * s, z], color: '#c9a27e', node });
      B.addGlow(sphere(0.035 * s, 6, 4), { pos: [x, y + 0.3 * s, z], color: '#ffd166', node });
      break;
    case 'torch':
    case 'lantern':
      B.add(cyl(0.025 * s, 0.025 * s, 0.4 * s, 6), { pos: [x, y + 0.1 * s, z], color: wood, node });
      B.addGlow(ellipsoid(0.1 * s, 0.13 * s, 0.1 * s, 8, 6), { pos: [x, y + 0.36 * s, z], color: kind === 'lantern' ? '#b8f2e6' : '#ffb347', node });
      break;
    case 'fan': {
      const sh = new THREE.Shape();
      sh.moveTo(0, 0);
      sh.absarc(0, 0, 0.3 * s, Math.PI * 0.2, Math.PI * 0.8, false);
      sh.lineTo(0, 0);
      B.add(extrude(sh, 0.02 * s), { pos: [x, y + 0.05 * s, z + 0.05 * s], color: (p) => (Math.hypot(p.x - x, p.y - y) > 0.25 * s ? col(B.def.accent || '#ffd43b') : col('#fff3e0')), node });
      break;
    }
    case 'wrench':
      B.add(box(0.05 * s, 0.4 * s, 0.03 * s), { pos: [x, y + 0.15 * s, z + 0.03], rot: [0.4, 0, 0], color: '#adb5bd', node });
      B.add(torus(0.06 * s, 0.025 * s, 4, 8, Math.PI * 1.5), { pos: [x, y + 0.38 * s, z + 0.12 * s], rot: [0.4, 0, 0], color: '#adb5bd', node });
      break;
    case 'mirror':
      B.add(cyl(0.12 * s, 0.12 * s, 0.03 * s, 14), { pos: [x, y + 0.2 * s, z + 0.05], rot: [Math.PI / 2, 0, 0], color: '#f2c14e', node });
      B.addGlow(cyl(0.095 * s, 0.095 * s, 0.035 * s, 14), { pos: [x, y + 0.2 * s, z + 0.05], rot: [Math.PI / 2, 0, 0], color: '#e3fafc', node });
      B.add(cyl(0.02 * s, 0.02 * s, 0.14 * s, 6), { pos: [x, y + 0.03 * s, z + 0.05], color: '#f2c14e', node });
      break;
    case 'towerShield':
      B.add(box(0.5 * s, 0.7 * s, 0.06 * s, 5, 7, 1), { pos: [x, y + 0.1 * s, z + 0.1 * s], color: (p) => (Math.abs(p.x - x) > 0.2 * s || Math.abs(p.y - y - 0.1 * s) > 0.3 * s ? col('#f2c14e') : col(color || '#868e96')), node });
      B.add(sphere(0.08 * s, 8, 6), { pos: [x, y + 0.12 * s, z + 0.15 * s], color: '#f2c14e', node });
      break;
    case 'shield': {
      const g = cyl(0.3 * s, 0.3 * s, 0.06 * s, B.s(16, 12, 8));
      B.add(g, { pos: [x, y + 0.15 * s, z + 0.08 * s], rot: [Math.PI / 2, 0, 0], color: (p) => (Math.hypot(p.x - x, p.y - y - 0.15 * s) > 0.25 * s ? col('#f2c14e') : col(color || '#868e96')), node });
      B.add(sphere(0.07 * s, 8, 6), { pos: [x, y + 0.15 * s, z + 0.12 * s], color: '#f2c14e', node });
      break;
    }
    default:
      break;
  }
}

function halfMoon(r) {
  const s = new THREE.Shape();
  s.moveTo(0, -r);
  s.quadraticCurveTo(r * 1.3, 0, 0, r);
  s.quadraticCurveTo(r * 0.4, 0, 0, -r);
  return s;
}

function crown(B, { pos, r = 0.18, node = 'body', color = '#ffd43b' }) {
  const [x, y, z] = pos;
  B.add(cyl(r, r * 0.9, r * 0.45, B.s(14, 10, 8), true), { pos: [x, y, z], color, node });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    B.add(cone(r * 0.22, r * 0.5, 4), { pos: [x + Math.sin(a) * r, y + r * 0.45, z + Math.cos(a) * r], color, node });
  }
  B.add(sphere(r * 0.18, 6, 4), { pos: [x, y + 0.02, z + r], color: '#ff5d73', node });
}

function cape(B, { top, width, length, z, color, node = 'body' }) {
  const g = new THREE.PlaneGeometry(width, length, 6, 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const yy = p.getY(i);
    const t = (length / 2 - yy) / length;
    p.setX(i, x * (1 + t * 0.4));
    p.setZ(i, -Math.cos((x / width) * Math.PI) * 0.12 * (1 + t) - t * 0.12);
  }
  g.translate(0, -length / 2, 0);
  g.computeVertexNormals();
  const back = g.clone();
  back.index.array.reverse();
  back.translate(0, 0, -0.02);
  B.add(g, { pos: [0, top, z], color, node });
  B.add(back, { pos: [0, top, z], color: col(color).multiplyScalar(0.7), node });
}

function helmet(B, { pos, r, color = '#9aa5b1', node = 'body', horns = false }) {
  const [x, y, z] = pos;
  B.add(sphere(r, B.s(16, 12, 8), B.s(10, 8, 6), 0, Math.PI * 2, 0, Math.PI * 0.5), { pos: [x, y, z], color, node });
  B.add(torus(r, r * 0.08, 4, B.s(18, 14, 10)), { pos: [x, y, z], rot: [Math.PI / 2, 0, 0], color: col(color).multiplyScalar(0.75), node });
  B.add(box(r * 0.15, r * 0.6, r * 0.15), { pos: [x, y - r * 0.2, z + r * 0.95], color: col(color).multiplyScalar(0.8), node });
  if (horns) {
    for (const side of [-1, 1]) {
      const pts = smoothPath([[x + side * r * 0.8, y + r * 0.3, z], [x + side * r * 1.3, y + r * 0.6, z], [x + side * r * 1.4, y + r * 1.2, z - r * 0.1]], 6);
      B.add(strand(pts, (t) => [r * 0.18 * (1 - t) + 0.005, r * 0.18 * (1 - t) + 0.005], { radial: 6 }), { color: '#f4ecd8', node });
    }
  }
}

function crystalCluster(B, { pos, n = 5, size = 0.18, color = '#a5f3fc', node = 'body', spread = 0.25, up = V(0, 1, 0) }) {
  const [x, y, z] = pos;
  B.hasCrystals = true;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + i * 0.7;
    const h = size * (1 + (i % 3) * 0.35);
    const g = cone(size * 0.35, h, 5);
    g.translate(0, h / 2, 0);
    g.rotateZ(Math.cos(a) * 0.45);
    g.rotateX(Math.sin(a) * 0.45);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), up));
    B.add(g, { pos: [x + Math.cos(a) * spread * 0.5, y, z + Math.sin(a) * spread * 0.5], color: (p) => col(color).lerp(col('#ffffff'), Math.max(0, (p.y - y) / (h + 0.001)) * 0.6), node });
  }
}

function wingPair(B, { pivotY, pivotZ, span, color, membrane, node = 'body', kind = 'bat', x = 0.15 }) {
  for (const side of [-1, 1]) {
    const name = side > 0 ? 'wingL' : 'wingR';
    B.node(name, V(side * x, pivotY, pivotZ), node);
    if (kind === 'butterfly') {
      for (const [dy, sz] of [[0.12, 1], [-0.1, 0.7]]) {
        const sh = new THREE.Shape();
        sh.moveTo(0, 0);
        sh.bezierCurveTo(side * span * 0.3 * sz, (dy + 0.3) * sz, side * span * sz, (dy + 0.25) * sz, side * span * 0.9 * sz, dy * sz);
        sh.bezierCurveTo(side * span * 0.8 * sz, (dy - 0.2) * sz, side * span * 0.3 * sz, (dy - 0.1) * sz, 0, 0);
        const g = extrude(sh, 0.02);
        B.add(g, { pos: [side * x, pivotY, pivotZ - 0.05], rot: [0.2, 0, 0], node: name, color: (p) => col(membrane).lerp(col(color), Math.min(1, Math.abs(p.x) / span)) });
      }
      continue;
    }
    // Bat/dragon wing: arm bone + scalloped membrane.
    const tipX = side * span;
    const pts = smoothPath([[side * x, pivotY, pivotZ], [side * (x + span * 0.45), pivotY + span * 0.35, pivotZ - 0.05], [tipX, pivotY + span * 0.2, pivotZ - 0.1]], 8);
    B.add(strand(pts, (t) => [0.045 * (1 - t * 0.6), 0.045 * (1 - t * 0.6)], { radial: 6 }), { color, node: name });
    const sh = new THREE.Shape();
    const fingers = 3;
    sh.moveTo(0, 0);
    sh.lineTo(side * span * 0.45, span * 0.35);
    sh.lineTo(side * span, span * 0.2);
    for (let i = fingers; i >= 1; i--) {
      const fx = side * span * (i / (fingers + 0.5));
      const fy = -span * 0.42 * (i / fingers);
      sh.quadraticCurveTo(fx + side * span * 0.1, fy * 0.4, fx, fy);
    }
    sh.quadraticCurveTo(side * span * 0.1, -span * 0.15, 0, -span * 0.05);
    const g = extrude(sh, 0.02);
    B.add(g, { pos: [side * x, pivotY, pivotZ - 0.06], rot: [0.15, 0, 0], color: membrane, node: name });
  }
}

// ---------------------------------------------------------------------------
// Families
// ---------------------------------------------------------------------------

function buildSlime(B, def) {
  const c = col(def.color || '#7bd389');
  const a = col(def.accent || '#3fa35b');
  const v = (def.model?.variant || '').toLowerCase();
  const props = propsOf(def);
  const boss = def.tier === 'miniboss' || def.tier === 'boss';
  B.slimy = true;
  B.main = 'jelly';
  B.anchors.head = [0, 0.62, 0];
  B.anchors.headR = 0.36;
  B.anchors.back = 0.5;
  const r = 0.46;
  // Drop-shaped jelly body (lathe), slightly flattened bottom.
  const prof = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const ang = -Math.PI / 2 + t * Math.PI;
    let rr = Math.cos(ang) * r;
    let y = (Math.sin(ang) + 1) * r * 0.82;
    if (t > 0.75) rr *= 1 - (t - 0.75) * (v === 'droplet' ? 2.6 : 0.6);
    if (v === 'droplet' && t > 0.75) y += (t - 0.75) * 0.6;
    if (t < 0.12) y = Math.max(0, y);
    prof.push([rr, y]);
  }
  prof[0] = [0.0, 0];
  prof[1] = [r * 0.8, 0.0];
  const prism = v.includes('prism') || has(def, 'splitter');
  B.node('jelly', V(0, 0, 0));
  B.add(lathe(prof, B.s(24, 18, 12)), {
    node: 'jelly',
    color: (p) => {
      if (prism) {
        const hue = (Math.atan2(p.x, p.z) / (Math.PI * 2) + 0.5 + p.y * 0.4) % 1;
        return new THREE.Color().setHSL(hue, 0.65, 0.68);
      }
      return c.clone().lerp(a, Math.max(0, 0.45 - p.y) * 0.9);
    },
  });
  // Gloss highlight + inner core.
  B.add(ellipsoid(0.12, 0.07, 0.05, 10, 6), { node: 'jelly', pos: [-0.17, 0.58, 0.24], rot: [-0.6, 0, 0.5], color: '#ffffff' });
  B.add(sphere(0.04, 6, 4), { node: 'jelly', pos: [-0.05, 0.66, 0.2], color: '#ffffff' });
  eyes(B, { y: 0.4, z: 0.4, x: 0.15, size: 0.085, node: 'jelly', style: boss ? 'angry' : 'cute' });
  mouth(B, { y: 0.27, z: 0.44, w: 0.07, node: 'jelly' });
  // Mimic dressing — read the variant name and traits.
  if (v.includes('iron') || props.has('helmet') || (def.armor > 0 && !v.includes('crystal'))) {
    B.done.add('helmet');
    helmet(B, { pos: [0, 0.55, 0], r: 0.33, color: '#aab3c0', node: 'jelly' });
  }
  if (v.includes('crystal') || has(def, 'crystal') || props.has('crystal')) {
    crystalCluster(B, { pos: [0, 0.6, -0.12], n: 5, size: 0.14, color: '#a5f3fc', node: 'jelly', spread: 0.4 });
  }
  if (v.includes('rose') || has(def, 'siphon')) {
    B.done.add('flower');
    for (let i = 0; i < 5; i++) {
      const g = ellipsoid(0.09, 0.06, 0.05, 8, 5);
      g.translate(0.06, 0, 0);
      g.rotateY((i / 5) * Math.PI * 2);
      B.add(g, { node: 'jelly', pos: [0.15, 0.74, -0.05], rot: [0.3, 0, 0.2], color: '#e64980' });
    }
    B.add(sphere(0.05, 6, 4), { node: 'jelly', pos: [0.15, 0.77, -0.05], color: '#a61e4d' });
    const vine = smoothPath([[-0.42, 0.15, 0.1], [-0.3, 0.42, 0.25], [0.0, 0.5, 0.36], [0.3, 0.38, 0.28]], 10);
    B.add(strand(vine, () => [0.018, 0.018], { radial: 5 }), { node: 'jelly', color: '#2f9e44' });
  }
  if (v.includes('gold') || has(def, 'hasty')) {
    wingPair(B, { pivotY: 0.45, pivotZ: -0.25, span: 0.32, color: '#fff3bf', membrane: '#ffffff', node: 'jelly', kind: 'butterfly', x: 0.2 });
  }
  if (v.includes('ember') || has(def, 'volatile')) {
    B.done.add('ember');
    const fuse = smoothPath([[0, 0.72, 0], [0.04, 0.84, -0.02], [0.1, 0.9, 0.0]], 6);
    B.add(strand(fuse, () => [0.02, 0.02], { radial: 5 }), { node: 'jelly', color: '#5c3d2e' });
    B.addGlow(sphere(0.06, 8, 6), { node: 'jelly', pos: [0.11, 0.92, 0.0], color: '#ffd166' });
    B.addGlow(sphere(0.035, 6, 4), { node: 'jelly', pos: [0.15, 0.97, 0.02], color: '#ff6b35' });
  }
  if (v.includes('veil') || v.includes('violet') || has(def, 'veiled')) {
    const ring = torus(0.42, 0.04, 5, 20);
    B.add(ring, { node: 'jelly', pos: [0, 0.3, 0], rot: [Math.PI / 2 - 0.15, 0, 0], color: col(def.accent || '#7950f2').lerp(col('#ffffff'), 0.3) });
  }
  if (v.includes('pearl') || props.has('pearl')) {
    B.add(sphere(0.1, 10, 8), { node: 'jelly', pos: [0.12, 0.74, 0], color: '#fff9f0' });
    B.add(lathe([[0.0, 0.0], [0.18, 0.02], [0.2, 0.06], [0.0, 0.02]], 10), { node: 'jelly', pos: [0.12, 0.66, 0], color: '#ffd6e7' });
  }
  if (has(def, 'regen')) B.add(torus(0.08, 0.02, 4, 10), { node: 'jelly', pos: [-0.2, 0.68, 0.05], rot: [0.4, 0, 0.6], color: '#b2f2bb' });
  if (v === 'chest' || props.has('shell')) {
    // Mimic: a treasure chest wrapped around the jelly, lid open like a mouth.
    B.add(box(0.8, 0.3, 0.62), { node: 'jelly', pos: [0, 0.15, 0], color: (q) => (Math.abs(q.x) > 0.34 || q.y < 0.04 ? col('#f2c14e') : col('#8a5a3c')) });
    B.add(box(0.8, 0.12, 0.62), { node: 'jelly', pos: [0, 0.78, -0.18], rot: [-0.55, 0, 0], color: (q) => (Math.abs(q.x) > 0.34 ? col('#f2c14e') : col('#8a5a3c')) });
    for (let i = -2; i <= 2; i++) B.add(cone(0.035, 0.08, 4), { node: 'jelly', pos: [i * 0.14, 0.27, 0.32], rot: [Math.PI, 0, 0], color: '#ffffff' });
    B.done.add('shell');
  }
  if (v === 'bubble' || props.has('bubble')) {
    B.add(torus(0.5, 0.025, 4, 20), { node: 'jelly', pos: [0, 0.4, 0], rot: [0.3, 0, 0.2], color: '#d0ebff' });
    B.add(torus(0.5, 0.025, 4, 20), { node: 'jelly', pos: [0, 0.4, 0], rot: [-0.4, 0.8, 0], color: '#e7f5ff' });
    for (let i = 0; i < 3; i++) B.add(sphere(0.05 + i * 0.02, 8, 6), { node: 'jelly', pos: [0.4 - i * 0.15, 0.8 + i * 0.1, -0.1], color: '#e7f5ff' });
    B.done.add('bubble');
  }
  if (props.has('crown') || v.includes('prince') || v.includes('royal') || v.includes('king') || boss) {
    B.done.add('crown');
    crown(B, { pos: [0, 0.74, -0.02], r: 0.17, node: 'jelly' });
  }
  if (props.has('cape') || v.includes('prince') || v.includes('royal') || v.includes('king')) {
    B.done.add('cape');
    cape(B, { top: 0.6, width: 0.7, length: 0.5, z: -0.38, color: def.accent || '#c92a2a', node: 'jelly' });
  }
  if (prism) {
    for (const side of [-1, 1]) B.add(sphere(0.12, 10, 8), { node: 'jelly', pos: [side * 0.36, 0.1, -0.15], color: c.clone().lerp(col('#ffffff'), 0.3) });
  }
  return { height: 0.8, kind: 'hop' };
}

/** Humanoid scaffold shared by goblins, orcs, oni, lizardfolk, ghouls. */
function humanoid(B, o) {
  const {
    skin, cloth, headR = 0.24, headY = 0.78, bodyW = 0.22, bodyH = 0.32, bodyY = 0.42, hunch = 0,
    legLen = 0.22, armLen = 0.32, armR = 0.06, legR = 0.07, headShape = [1, 1, 1], bulk = 1, clothShade,
  } = o;
  const s = B.s(16, 12, 8);
  B.node('torso', V(0, bodyY - bodyH * 0.4, 0));
  B.node('head', V(0, headY - headR * 0.6, hunch * 0.2), 'torso');
  // Body (chest + belly) and loincloth / tunic.
  B.add(ellipsoid(bodyW * bulk, bodyH * 0.6, bodyW * 0.85 * bulk, s, s - 2), { node: 'torso', pos: [0, bodyY, hunch * 0.15], rot: [hunch, 0, 0], color: skin });
  B.add(cyl(bodyW * 0.95 * bulk, bodyW * 1.05 * bulk, bodyH * 0.45, s), { node: 'torso', pos: [0, bodyY - bodyH * 0.38, 0], color: cloth });
  B.add(cyl(bodyW * 1.0 * bulk, bodyW * 1.0 * bulk, 0.04, s), { node: 'torso', pos: [0, bodyY - bodyH * 0.18, 0], color: clothShade || col(cloth).multiplyScalar(0.7) });
  // Head.
  B.add(ellipsoid(headR * headShape[0], headR * headShape[1], headR * headShape[2], s, s - 2), { node: 'head', pos: [0, headY, hunch * 0.25 + 0.02], color: skin });
  // Legs.
  for (const side of [-1, 1]) {
    const n = side > 0 ? 'legL' : 'legR';
    const lx = side * bodyW * 0.5 * bulk;
    B.node(n, V(lx, legLen + 0.05, 0));
    B.add(capsule(legR * bulk, legLen * 0.6, 4, 8), { node: n, pos: [lx, legLen * 0.55, 0], color: skin });
    B.add(ellipsoid(legR * 1.4 * bulk, legR * 0.8, legR * 1.8, 8, 6), { node: n, pos: [lx, legR * 0.6, legR * 0.6], color: col(cloth).multiplyScalar(0.55) });
    const an = side > 0 ? 'armL' : 'armR';
    const ax = side * (bodyW * 1.05 * bulk + armR * 0.5);
    const ay = bodyY + bodyH * 0.3;
    B.node(an, V(ax, ay, hunch * 0.15), 'torso');
    B.add(capsule(armR * bulk, armLen * 0.7, 4, 8), { node: an, pos: [ax + side * 0.03, ay - armLen * 0.45, hunch * 0.2], rot: [0, 0, side * 0.18], color: skin });
    B.add(sphere(armR * 1.35 * bulk, 8, 6), { node: an, pos: [ax + side * 0.07, ay - armLen * 0.9, hunch * 0.25], color: skin });
  }
  B.anchors.handR = [-(bodyW * 1.05 * bulk + armR * 0.5) - 0.07, bodyY + bodyH * 0.3 - armLen * 0.9, hunch * 0.25 + 0.03];
  B.anchors.handL = [(bodyW * 1.05 * bulk + armR * 0.5) + 0.07, bodyY + bodyH * 0.3 - armLen * 0.9, hunch * 0.25 + 0.03];
  B.anchors.head = [0, headY, hunch * 0.25 + 0.02];
  B.anchors.headR = headR;
}

function applyHumanoidProps(B, def, { defaultWeapon = null, scale = 1, color } = {}) {
  const props = propsOf(def);
  for (const k of ['helmet', 'crown', 'cape', 'hood', 'goggles', 'backpack', 'bomb', 'armor', 'mask', 'scarf', 'shield', 'towerShield']) B.done.add(k);
  const [hx, hy, hz] = B.anchors.head;
  const hr = B.anchors.headR;
  const weapons = ['club', 'axe', 'spear', 'sword', 'dagger', 'staff', 'bow', 'fan', 'wrench', 'mirror', 'bomb', 'torch', 'lantern'];
  const held = weapons.find((w) => props.has(w)) || defaultWeapon;
  weapons.forEach((w) => B.done.add(w));
  if (held) weaponProp(B, held, { pos: B.anchors.handR, node: 'armR', scale, color });
  if (props.has('towerShield')) weaponProp(B, 'towerShield', { pos: [B.anchors.handL[0] + 0.06, B.anchors.handL[1] - 0.1, B.anchors.handL[2] + 0.08], node: 'armL', scale, color: col(def.accent || '#868e96') });
  else if (props.has('shield')) weaponProp(B, 'shield', { pos: [B.anchors.handL[0] + 0.04, B.anchors.handL[1] - 0.1, B.anchors.handL[2] + 0.05], node: 'armL', scale: scale * 1.1, color: col(def.accent || '#868e96') });
  if (props.has('helmet')) helmet(B, { pos: [hx, hy + hr * 0.15, hz], r: hr * 1.08, node: 'head', horns: def.tier !== 'normal' });
  if (props.has('crown') || def.tier === 'boss') crown(B, { pos: [hx, hy + hr * 0.85, hz], r: hr * 0.55, node: 'head' });
  if (props.has('cape') || def.tier === 'miniboss' || def.tier === 'boss') cape(B, { top: hy - hr * 0.8, width: 0.6 * scale, length: 0.55 * scale, z: -0.2 * scale, color: def.accent || '#c92a2a', node: 'torso' });
  if (props.has('hood')) {
    B.add(sphere(hr * 1.18, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), { node: 'head', pos: [hx, hy, hz - 0.03], rot: [-0.5, 0, 0], color: col(def.accent || '#495057').multiplyScalar(0.8) });
  }
  if (props.has('goggles')) {
    for (const side of [-1, 1]) B.add(cyl(hr * 0.28, hr * 0.28, hr * 0.15, 10), { node: 'head', pos: [hx + side * hr * 0.35, hy + hr * 0.55, hz + hr * 0.72], rot: [1.0, 0, 0], color: '#9be7ff' });
    B.add(torus(hr * 1.0, hr * 0.06, 4, 18), { node: 'head', pos: [hx, hy + hr * 0.4, hz], rot: [Math.PI / 2 - 0.3, 0, 0], color: '#5c3d2e' });
  }
  if (props.has('backpack') || (props.has('bomb') && held !== 'bomb')) {
    B.add(box(0.22 * scale, 0.24 * scale, 0.14 * scale), { node: 'torso', pos: [0, B.anchors.handR[1] + 0.2 * scale, -0.22 * scale], color: '#8a5a3c' });
    if (props.has('bomb') && held !== 'bomb') weaponProp(B, 'bomb', { pos: [0.05, B.anchors.handR[1] + 0.32 * scale, -0.22 * scale], node: 'torso', scale });
  }
  if (props.has('armor')) {
    B.add(sphere(0.3 * scale, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), { node: 'torso', pos: [0, B.anchors.handR[1] + 0.12 * scale, 0], rot: [0, 0, 0], scale: [1.2, 0.8, 1.1], color: '#9aa5b1' });
    for (const side of [-1, 1]) B.add(sphere(0.11 * scale, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), { node: side > 0 ? 'armL' : 'armR', pos: [B.anchors[side > 0 ? 'handL' : 'handR'][0] * 0.85, B.anchors.handR[1] + 0.27 * scale, 0], color: '#aab3c0' });
  }
  if (props.has('mask')) {
    B.add(ellipsoid(hr * 0.8, hr * 0.85, hr * 0.3, 12, 8), { node: 'head', pos: [hx, hy - hr * 0.05, hz + hr * 0.85], color: '#f8f0e3' });
    for (const side of [-1, 1]) B.addGlow(ellipsoid(hr * 0.16, hr * 0.08, 0.02, 8, 4), { node: 'head', pos: [hx + side * hr * 0.3, hy + hr * 0.08, hz + hr * 1.1], rot: [0, 0, side * 0.3], color: '#ff4d6d' });
  }
  if (props.has('scarf')) B.add(torus(0.17 * scale, 0.05 * scale, 6, 14), { node: 'torso', pos: [0, hy - hr * 0.9, hz], rot: [Math.PI / 2, 0, 0], color: def.accent || '#c92a2a' });
}

function buildGoblin(B, def) {
  const skin = col(def.color || '#8fd16a');
  const cloth = col(def.accent || '#8a5a3c');
  const v = (def.model?.variant || '').toLowerCase();
  const props = propsOf(def);
  if (v.includes('machine') || props.has('mech')) return buildGoblinMachine(B, def);
  humanoid(B, { skin, cloth, headR: 0.25, headY: 0.74, bodyW: 0.15, bodyH: 0.26, bodyY: 0.38, legLen: 0.2, armLen: 0.28, armR: 0.045, legR: 0.05, headShape: [1.1, 0.95, 1], hunch: 0.15 });
  const [hx, hy, hz] = B.anchors.head;
  // Big pointy ears + nose.
  for (const side of [-1, 1]) {
    const g = cone(0.08, 0.34, 5);
    g.scale(1, 1, 0.45);
    g.rotateZ(-side * 1.25);
    B.add(g, { node: 'head', pos: [hx + side * 0.36, hy + 0.06, hz - 0.02], color: skin });
    const inner = cone(0.045, 0.22, 5);
    inner.scale(1, 1, 0.3);
    inner.rotateZ(-side * 1.25);
    B.add(inner, { node: 'head', pos: [hx + side * 0.34, hy + 0.06, hz + 0.02], color: '#ff9eb5' });
  }
  B.add(cone(0.05, 0.14, 6), { node: 'head', pos: [hx, hy - 0.04, hz + 0.27], rot: [1.3, 0, 0], color: skin.clone().multiplyScalar(0.9) });
  eyes(B, { y: hy + 0.03, z: hz + 0.21, x: 0.1, size: 0.07, node: 'head', style: def.tier === 'normal' ? 'cute' : 'angry', color: '#2b2010' });
  mouth(B, { y: hy - 0.12, z: hz + 0.21, w: 0.08, node: 'head', kind: 'fangs' });
  applyHumanoidProps(B, def, { defaultWeapon: has(def, 'sabotage') ? 'bomb' : 'dagger', scale: 0.9 });
  if (has(def, 'veiled') || v.includes('smoke')) {
    for (let i = 0; i < 4; i++) B.add(sphere(0.08 + i * 0.015, 8, 6), { node: 'torso', pos: [Math.cos(i * 1.7) * 0.25, 0.2 + i * 0.08, -0.15 + Math.sin(i * 1.7) * 0.15], color: '#ced4da' });
  }
  return { height: 1.0, kind: 'walk', fast: true };
}

function buildGoblinMachine(B, def) {
  const metal = col(def.accent || '#495057');
  const paint = col(def.color || '#ffa94d');
  const s = B.s(14, 10, 8);
  B.node('torso', V(0, 0.4, 0));
  // Boiler body on legs.
  B.add(box(0.7, 0.45, 0.6), { node: 'torso', pos: [0, 0.62, 0], color: paint });
  B.add(cyl(0.3, 0.3, 0.62, s), { node: 'torso', pos: [0, 0.62, 0], rot: [0, 0, Math.PI / 2], color: metal });
  B.add(cyl(0.07, 0.09, 0.4, 8), { node: 'torso', pos: [-0.22, 1.02, -0.2], color: metal });
  B.add(torus(0.09, 0.025, 4, 10), { node: 'torso', pos: [-0.22, 1.22, -0.2], rot: [Math.PI / 2, 0, 0], color: '#343a40' });
  for (const side of [-1, 1]) {
    const gear = extrude(star(10, 0.17, 0.13, 0), 0.05);
    B.add(gear, { node: 'torso', pos: [side * 0.37, 0.62, 0.05], rot: [0, Math.PI / 2, 0], color: '#f2c14e' });
    const n = side > 0 ? 'legL' : 'legR';
    B.node(n, V(side * 0.25, 0.4, 0));
    B.add(box(0.14, 0.38, 0.14), { node: n, pos: [side * 0.25, 0.22, 0], color: metal });
    B.add(box(0.22, 0.08, 0.3), { node: n, pos: [side * 0.25, 0.04, 0.05], color: paint.clone().multiplyScalar(0.7) });
    const an = side > 0 ? 'armL' : 'armR';
    B.node(an, V(side * 0.4, 0.75, 0.1), 'torso');
    B.add(cyl(0.05, 0.05, 0.35, 6), { node: an, pos: [side * 0.45, 0.6, 0.18], rot: [0.6, 0, 0], color: metal });
    B.add(cone(0.1, 0.24, 6), { node: an, pos: [side * 0.45, 0.48, 0.38], rot: [Math.PI / 2 + 0.4, 0, 0], color: '#ced4da' });
  }
  // Goblin pilot in the cockpit.
  B.node('head', V(0, 0.9, 0.05), 'torso');
  const skin = col('#8fd16a');
  B.add(sphere(0.2, s, s - 2), { node: 'head', pos: [0, 1.05, 0.05], color: skin });
  for (const side of [-1, 1]) {
    const g = cone(0.06, 0.26, 5);
    g.scale(1, 1, 0.45);
    g.rotateZ(-side * 1.25);
    B.add(g, { node: 'head', pos: [side * 0.28, 1.08, 0.03], color: skin });
  }
  eyes(B, { y: 1.08, z: 0.22, x: 0.08, size: 0.055, node: 'head', style: 'angry' });
  for (const side of [-1, 1]) B.add(cyl(0.06, 0.06, 0.04, 10), { node: 'head', pos: [side * 0.08, 1.16, 0.2], rot: [1.2, 0, 0], color: '#9be7ff' });
  B.addGlow(sphere(0.07, 8, 6), { node: 'torso', pos: [0, 0.62, 0.31], color: '#ff6b35' });
  B.add(cyl(0.08, 0.1, 0.45, 10), { node: 'torso', pos: [0.22, 0.95, 0.05], rot: [1.2, 0, 0], color: '#343a40' });
  B.add(torus(0.09, 0.025, 4, 10), { node: 'torso', pos: [0.22, 1.03, 0.26], rot: [1.2 - Math.PI / 2, 0, 0], color: paint });
  B.anchors.head = [0, 1.05, 0.05];
  B.anchors.headR = 0.2;
  B.main = 'torso';
  for (const k of ['gears', 'chimney', 'cannon', 'goggles']) B.done.add(k);
  return { height: 1.25, kind: 'stomp' };
}

function buildOrc(B, def) {
  const skin = col(def.color || '#69db7c');
  const cloth = col(def.accent || '#5c3d2e');
  humanoid(B, { skin, cloth, headR: 0.2, headY: 0.86, bodyW: 0.27, bodyH: 0.42, bodyY: 0.5, legLen: 0.22, armLen: 0.36, armR: 0.08, legR: 0.08, bulk: 1.1, headShape: [1.1, 0.9, 1] });
  const [hx, hy, hz] = B.anchors.head;
  for (const side of [-1, 1]) {
    B.add(cone(0.035, 0.13, 6), { node: 'head', pos: [hx + side * 0.09, hy - 0.06, hz + 0.18], rot: [-0.2, 0, side * -0.2], color: '#fff9db' });
    const ear = cone(0.06, 0.16, 4);
    ear.rotateZ(-side * 1.3);
    B.add(ear, { node: 'head', pos: [hx + side * 0.24, hy + 0.04, hz], color: skin });
  }
  B.add(box(0.3, 0.06, 0.1), { node: 'head', pos: [hx, hy + 0.1, hz + 0.15], rot: [0.2, 0, 0], color: skin.clone().multiplyScalar(0.8) });
  eyes(B, { y: hy + 0.03, z: hz + 0.18, x: 0.08, size: 0.05, node: 'head', style: 'angry' });
  mouth(B, { y: hy - 0.1, z: hz + 0.19, w: 0.09, node: 'head', kind: 'fangs' });
  // Shoulder plates for the visible "armored" read.
  if (def.armor > 0 || has(def, 'guardian')) {
    for (const side of [-1, 1]) {
      B.add(sphere(0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), { node: side > 0 ? 'armL' : 'armR', pos: [side * 0.33, 0.72, 0], rot: [0, 0, -side * 0.4], color: '#9aa5b1' });
    }
    B.add(box(0.42, 0.2, 0.06), { node: 'torso', pos: [0, 0.56, 0.21], color: '#868e96' });
  }
  applyHumanoidProps(B, def, { defaultWeapon: def.tier === 'miniboss' ? 'axe' : 'club', scale: 1.2 });
  return { height: 1.1, kind: 'stomp' };
}

function buildGhost(B, def) {
  const c = col(def.color || '#d0ebff');
  const a = col(def.accent || '#74c0fc');
  const props = propsOf(def);
  B.ghostly = true;
  B.main = 'wisp';
  B.anchors.head = [0, 0.82, 0.02];
  B.anchors.headR = 0.3;
  B.anchors.back = 0.6;
  B.node('wisp', V(0, 0.5, 0));
  const prof = [[0.0, 1.0], [0.18, 0.98], [0.32, 0.88], [0.38, 0.7], [0.36, 0.5], [0.3, 0.34], [0.2, 0.2], [0.1, 0.1], [0.0, 0.02]];
  const g = lathe(prof, B.s(20, 16, 10));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < 0.4) {
      const ang = Math.atan2(p.getZ(i), p.getX(i));
      const k = 1 + Math.sin(ang * 5) * 0.18 * (0.4 - y) * 2.5;
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k - (0.4 - y) * 0.35);
    }
  }
  g.computeVertexNormals();
  B.add(g, { node: 'wisp', pos: [0, 0.1, 0], color: (q) => c.clone().lerp(a, Math.max(0, 0.6 - q.y) * 1.2) });
  for (const side of [-1, 1]) B.add(ellipsoid(0.08, 0.12, 0.07, 8, 6), { node: 'wisp', pos: [side * 0.36, 0.62, 0.05], rot: [0, 0, side * 0.6], color: c });
  if (props.has('hood') || def.tier !== 'normal') {
    B.add(sphere(0.34, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), { node: 'wisp', pos: [0, 0.82, -0.04], rot: [-0.35, 0, 0], color: a.clone().multiplyScalar(0.6) });
    eyes(B, { y: 0.78, z: 0.28, x: 0.1, size: 0.07, node: 'wisp', style: 'glow', glow: '#e5dbff' });
  } else {
    eyes(B, { y: 0.78, z: 0.33, x: 0.11, size: 0.075, node: 'wisp' });
    mouth(B, { y: 0.66, z: 0.36, w: 0.07, node: 'wisp', kind: 'o' });
    B.add(ellipsoid(0.05, 0.03, 0.02, 6, 4), { node: 'wisp', pos: [-0.2, 0.7, 0.3], color: '#ffb3c7' });
    B.add(ellipsoid(0.05, 0.03, 0.02, 6, 4), { node: 'wisp', pos: [0.2, 0.7, 0.3], color: '#ffb3c7' });
  }
  if (props.has('lantern')) weaponProp(B, 'lantern', { pos: [-0.4, 0.45, 0.1], node: 'wisp' });
  if (props.has('hood')) B.done.add('hood');
  B.done.add('crown');
  if (props.has('helmet')) {
    helmet(B, { pos: [0, 0.86, 0.0], r: 0.36, color: '#495057', node: 'wisp', horns: true });
    B.done.add('helmet');
  }
  if (props.has('mask')) {
    B.add(ellipsoid(0.26, 0.16, 0.08, 12, 8), { node: 'wisp', pos: [0, 0.68, 0.33], color: '#c92a2a' });
    B.done.add('mask');
  }
  if (props.has('sword')) {
    weaponProp(B, 'sword', { pos: [-0.42, 0.45, 0.12], node: 'wisp', scale: 1.1 });
    B.done.add('sword');
  }
  if (props.has('chain') || props.has('chains')) {
    B.done.add('chains');
    const pts = smoothPath([[-0.3, 0.4, 0.1], [0, 0.3, 0.25], [0.3, 0.4, 0.1]], 10);
    B.add(strand(pts, () => [0.02, 0.02], { radial: 4 }), { node: 'wisp', color: '#868e96' });
  }
  if (props.has('crown') || def.tier === 'boss') crown(B, { pos: [0, 1.06, 0], r: 0.13, node: 'wisp' });
  return { height: 1.1, kind: 'float' };
}

function buildGhoul(B, def) {
  const skin = col(def.color || '#a9a3c9');
  const cloth = col(def.accent || '#5f3dc4');
  const v = (def.model?.variant || '').toLowerCase();
  const boss = def.tier === 'boss' || v.includes('lych') || v.includes('lich');
  if (boss) return buildLych(B, def);
  const skeleton = v.includes('skeleton');
  if (skeleton) skin.set('#f1ece0');
  humanoid(B, { skin, cloth: cloth.clone().multiplyScalar(0.6), headR: 0.2, headY: 0.68, bodyW: 0.17, bodyH: 0.34, bodyY: 0.42, legLen: 0.2, armLen: 0.48, armR: 0.045, legR: 0.05, hunch: 0.5 });
  const [hx, hy, hz] = B.anchors.head;
  eyes(B, { y: hy + 0.02, z: hz + 0.17, x: 0.08, size: 0.06, node: 'head', style: 'glow', glow: has(def, 'siphon') ? '#ff6b9a' : '#9be7ff' });
  mouth(B, { y: hy - 0.1, z: hz + 0.18, w: 0.08, node: 'head', kind: 'fangs' });
  if (skeleton) {
    for (let i = 0; i < 3; i++) B.add(torus(0.15 - i * 0.015, 0.018, 4, 12, Math.PI), { node: 'torso', pos: [0, 0.5 - i * 0.07, 0.08], rot: [0, 0, Math.PI], scale: [1, 0.6, 1], color: '#d9d2c3' });
  }
  // Ragged shawl + claws.
  const shawl = cone(0.3, 0.3, 7);
  if (!skeleton) B.add(shawl, { node: 'torso', pos: [0, 0.58, 0.08], rot: [0.5, 0, 0], color: cloth });
  for (const side of [-1, 1]) {
    const h = B.anchors[side > 0 ? 'handL' : 'handR'];
    for (let k = -1; k <= 1; k++) B.add(cone(0.015, 0.09, 4), { node: side > 0 ? 'armL' : 'armR', pos: [h[0] + k * 0.03, h[1] - 0.07, h[2] + 0.03], rot: [Math.PI - 0.3, 0, 0], color: '#f1f3f5' });
  }
  if (has(def, 'siphon')) {
    for (let i = 0; i < 3; i++) B.addGlow(sphere(0.035, 6, 4), { node: 'torso', pos: [Math.cos(i * 2.1) * 0.32, 0.75 + i * 0.05, Math.sin(i * 2.1) * 0.25], color: '#ff6b9a' });
  }
  if (has(def, 'blink')) B.add(torus(0.28, 0.02, 4, 18), { node: 'body', pos: [0, 0.03, 0], rot: [Math.PI / 2, 0, 0], color: '#748ffc' });
  applyHumanoidProps(B, def, {});
  return { height: 0.95, kind: 'shamble' };
}

function buildLych(B, def) {
  const robe = col(def.accent || '#5f3dc4');
  const bone = col(def.color || '#dee2e6');
  B.node('torso', V(0, 0.3, 0));
  const g = lathe([[0.0, 1.0], [0.18, 0.95], [0.24, 0.7], [0.3, 0.35], [0.42, 0.02], [0.0, 0.0]], B.s(18, 14, 10));
  B.add(g, { node: 'torso', color: (p) => (p.y < 0.08 ? col('#ffd43b') : robe) });
  B.node('head', V(0, 0.95, 0), 'torso');
  B.add(sphere(0.2, 14, 10), { node: 'head', pos: [0, 1.1, 0.03], color: bone });
  B.add(sphere(0.26, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), { node: 'head', pos: [0, 1.12, -0.02], rot: [-0.45, 0, 0], color: robe.clone().multiplyScalar(0.6) });
  eyes(B, { y: 1.1, z: 0.2, x: 0.075, size: 0.06, node: 'head', style: 'glow', glow: '#b197fc' });
  crown(B, { pos: [0, 1.28, 0.0], r: 0.12, node: 'head' });
  for (const side of [-1, 1]) {
    const n = side > 0 ? 'armL' : 'armR';
    B.node(n, V(side * 0.2, 0.8, 0), 'torso');
    B.add(cone(0.1, 0.4, 8), { node: n, pos: [side * 0.27, 0.62, 0.04], rot: [0, 0, side * 0.35], color: robe.clone().multiplyScalar(0.8) });
    B.add(sphere(0.05, 6, 4), { node: n, pos: [side * 0.34, 0.42, 0.08], color: bone });
  }
  weaponProp(B, 'staff', { pos: [-0.36, 0.38, 0.1], node: 'armR', scale: 1.2, color: '#343a40' });
  B.anchors.head = [0, 1.1, 0.03];
  B.anchors.headR = 0.2;
  B.main = 'torso';
  for (const k of ['crown', 'cape', 'staff', 'hood']) B.done.add(k);
  cape(B, { top: 0.95, width: 0.6, length: 0.85, z: -0.18, color: '#343a40', node: 'torso' });
  B.add(torus(0.4, 0.02, 4, 24), { node: 'body', pos: [0, 0.02, 0], rot: [Math.PI / 2, 0, 0], color: '#b197fc' });
  return { height: 1.35, kind: 'float' };
}

function buildOni(B, def) {
  const skin = col(def.color || '#ff6b6b');
  const accent = col(def.accent || '#ffd43b');
  const props = propsOf(def);
  const v = (def.model?.variant || '').toLowerCase();
  humanoid(B, { skin, cloth: col('#f8f0e3'), clothShade: col('#2b2d42'), headR: 0.23, headY: 0.86, bodyW: 0.24, bodyH: 0.4, bodyY: 0.5, legLen: 0.22, armLen: 0.36, armR: 0.075, legR: 0.075, bulk: 1.05 });
  const [hx, hy, hz] = B.anchors.head;
  // Tiger-stripe loincloth.
  B.add(cyl(0.27, 0.3, 0.16, 14), { node: 'torso', pos: [0, 0.3, 0], color: (p) => (Math.sin(Math.atan2(p.x, p.z) * 8) > 0.5 ? col('#2b2d42') : accent) });
  // Horns: one big (champion) or two.
  const hornCount = v.includes('champion') || def.tier === 'miniboss' ? 2 : (v.includes('shield') ? 1 : 2);
  for (let i = 0; i < hornCount; i++) {
    const side = hornCount === 1 ? 0 : (i ? 1 : -1);
    const b = V(hx + side * 0.12, hy + 0.18, hz);
    const pts = smoothPath([b, b.clone().add(V(side * 0.05, 0.14, 0.02)), b.clone().add(V(side * 0.1, 0.24, -0.04))], 6);
    B.add(strand(pts, (t) => [0.05 * (1 - t) + 0.005, 0.05 * (1 - t) + 0.005], { radial: 6 }), { node: 'head', color: '#fff3bf' });
  }
  // Wild hair tuft.
  B.add(sphere(0.2, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), { node: 'head', pos: [hx, hy + 0.06, hz - 0.06], rot: [-0.4, 0, 0], color: '#2b2d42' });
  eyes(B, { y: hy + 0.02, z: hz + 0.2, x: 0.085, size: 0.06, node: 'head', style: 'angry' });
  mouth(B, { y: hy - 0.1, z: hz + 0.21, w: 0.09, node: 'head', kind: 'fangs' });
  // Field emblem floating above the shoulder (tells which aura they project).
  const field = def.traits?.field;
  if (field) {
    const kinds = field.kinds || [field.kind];
    const colors = { haste: '#ffe066', shield: '#74c0fc', regen: '#8ce99a' };
    kinds.forEach((k, i) => {
      B.node(`orb${i}`, V(0, 1.25, 0));
      B.addGlow(sphere(0.07, 10, 8), { node: `orb${i}`, pos: [Math.cos(i * 2.1) * 0.35, 1.2, Math.sin(i * 2.1) * 0.35], color: colors[k] || '#ffffff' });
      B.add(torus(0.1, 0.015, 4, 12), { node: `orb${i}`, pos: [Math.cos(i * 2.1) * 0.35, 1.2, Math.sin(i * 2.1) * 0.35], rot: [Math.PI / 2, 0, 0], color: '#f2c14e' });
    });
    B.orbs = kinds.length;
  }
  applyHumanoidProps(B, def, { defaultWeapon: props.has('staff') ? null : 'club', scale: 1.15, color: '#495057' });
  return { height: 1.15, kind: 'stomp' };
}

function buildLizard(B, def) {
  const skin = col(def.color || '#63e6be');
  const accent = col(def.accent || '#087f5b');
  humanoid(B, { skin, cloth: accent, headR: 0.17, headY: 0.82, bodyW: 0.19, bodyH: 0.38, bodyY: 0.46, legLen: 0.22, armLen: 0.32, armR: 0.05, legR: 0.06, headShape: [0.9, 0.85, 1.3], hunch: 0.15 });
  const [hx, hy, hz] = B.anchors.head;
  // Snout + crest + belly scales + tail.
  B.add(ellipsoid(0.11, 0.08, 0.16, 10, 8), { node: 'head', pos: [hx, hy - 0.05, hz + 0.18], color: skin });
  for (let i = 0; i < 4; i++) B.add(cone(0.03, 0.11 - i * 0.015, 4), { node: 'head', pos: [hx, hy + 0.15 - i * 0.04, hz - 0.05 - i * 0.07], rot: [-0.6, 0, 0], color: accent });
  eyes(B, { y: hy + 0.05, z: hz + 0.1, x: 0.11, size: 0.05, node: 'head', color: '#2b2010', tilt: 0.2 });
  B.add(ellipsoid(0.12, 0.2, 0.06, 10, 8), { node: 'torso', pos: [0, 0.48, 0.15], color: col('#fff3bf').lerp(skin, 0.3) });
  B.node('tail', V(0, 0.3, -0.12));
  const tailPts = smoothPath([[0, 0.32, -0.12], [0, 0.2, -0.35], [0.05, 0.08, -0.55], [0.12, 0.04, -0.7]], 10);
  B.add(strand(tailPts, (t) => [0.09 * (1 - t) + 0.01, 0.08 * (1 - t) + 0.01], { radial: 7 }), { node: 'tail', color: skin });
  if (def.traits?.ward === 'fire') B.add(torus(0.17, 0.03, 4, 14), { node: 'torso', pos: [0, 0.68, 0], rot: [Math.PI / 2, 0, 0], color: '#ff8a3d' });
  if (has(def, 'regen')) B.add(ellipsoid(0.12, 0.05, 0.08, 8, 6), { node: 'head', pos: [hx + 0.1, hy + 0.15, hz], color: '#2f9e44' });
  applyHumanoidProps(B, def, { defaultWeapon: 'spear' });
  return { height: 1.05, kind: 'walk' };
}

function buildConstruct(B, def) {
  const stone = col(def.color || '#99e9f2');
  const accent = col(def.accent || '#1098ad');
  const v = (def.model?.variant || '').toLowerCase();
  const boss = def.tier === 'boss' || v.includes('colossus');
  B.main = 'torso';
  if (v.includes('cogling')) {
    B.node('torso', V(0, 0.35, 0));
    B.add(sphere(0.3, 14, 10), { node: 'torso', pos: [0, 0.42, 0], color: stone });
    B.add(extrude(star(10, 0.3, 0.24, 0), 0.06), { node: 'torso', pos: [0, 0.42, 0.22], color: '#f2c14e' });
    B.add(cyl(0.12, 0.12, 0.08, 12), { node: 'torso', pos: [0, 0.42, 0.26], rot: [Math.PI / 2, 0, 0], color: accent });
    eyes(B, { y: 0.45, z: 0.31, x: 0.06, size: 0.04, node: 'torso', style: 'glow', glow: '#9be7ff' });
    for (const side of [-1, 1]) {
      const ln = side > 0 ? 'legL' : 'legR';
      B.node(ln, V(side * 0.14, 0.2, 0));
      B.add(cyl(0.04, 0.04, 0.2, 6), { node: ln, pos: [side * 0.14, 0.1, 0], color: '#495057' });
      B.add(box(0.12, 0.05, 0.16), { node: ln, pos: [side * 0.14, 0.02, 0.03], color: accent });
    }
    B.add(cyl(0.015, 0.015, 0.2, 4), { node: 'torso', pos: [0, 0.78, 0], color: '#495057' });
    B.addGlow(sphere(0.04, 6, 4), { node: 'torso', pos: [0, 0.89, 0], color: '#ff6b6b' });
    B.anchors.head = [0, 0.5, 0];
    B.anchors.headR = 0.25;
    B.done.add('gears');
    return { height: 0.9, kind: 'walk' };
  }
  B.node('torso', V(0, 0.45, 0));
  B.add(box(0.56, 0.48, 0.42), { node: 'torso', pos: [0, 0.58, 0], color: stone });
  B.add(box(0.6, 0.12, 0.46), { node: 'torso', pos: [0, 0.38, 0], color: stone.clone().multiplyScalar(0.75) });
  B.addGlow(new THREE.OctahedronGeometry(0.09, 0), { node: 'torso', pos: [0, 0.6, 0.22], color: boss ? '#ffd43b' : '#9be7ff' });
  B.add(torus(0.12, 0.025, 4, 12), { node: 'torso', pos: [0, 0.6, 0.21], color: accent });
  B.node('head', V(0, 0.82, 0), 'torso');
  B.add(box(0.3, 0.22, 0.28), { node: 'head', pos: [0, 0.94, 0.02], color: stone.clone().lerp(col('#ffffff'), 0.1) });
  B.addGlow(box(0.2, 0.05, 0.02), { node: 'head', pos: [0, 0.96, 0.17], color: boss ? '#ff6b35' : '#9be7ff' });
  for (const side of [-1, 1]) {
    const an = side > 0 ? 'armL' : 'armR';
    B.node(an, V(side * 0.34, 0.75, 0), 'torso');
    B.add(box(0.16, 0.2, 0.18), { node: an, pos: [side * 0.38, 0.72, 0], color: accent });
    B.add(box(0.14, 0.32, 0.14), { node: an, pos: [side * 0.38, 0.48, 0.02], color: stone });
    B.add(box(0.18, 0.14, 0.18), { node: an, pos: [side * 0.38, 0.28, 0.04], color: stone.clone().multiplyScalar(0.8) });
    const ln = side > 0 ? 'legL' : 'legR';
    B.node(ln, V(side * 0.15, 0.32, 0));
    B.add(box(0.16, 0.3, 0.18), { node: ln, pos: [side * 0.15, 0.15, 0], color: stone.clone().multiplyScalar(0.85) });
  }
  B.anchors.handR = [-0.38, 0.28, 0.1];
  B.anchors.handL = [0.38, 0.28, 0.1];
  B.anchors.head = [0, 0.94, 0.02];
  B.anchors.headR = 0.16;
  if (has(def, 'crystal') || v.includes('crystal')) {
    crystalCluster(B, { pos: [0, 0.8, -0.12], n: 6, size: 0.16, color: '#a5f3fc', node: 'torso', spread: 0.4 });
    crystalCluster(B, { pos: [0.38, 0.8, 0], n: 3, size: 0.1, color: '#c5f6fa', node: 'armL', spread: 0.1 });
  }
  if (v.includes('beetle')) {
    B.add(sphere(0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), { node: 'torso', pos: [0, 0.6, -0.1], scale: [1, 0.8, 1.1], color: accent });
  }
  if (has(def, 'barrier') || v.includes('barrier')) {
    for (const side of [-1, 1]) B.add(torus(0.12, 0.02, 4, 12), { node: side > 0 ? 'armL' : 'armR', pos: [side * 0.38, 0.48, 0.02], rot: [Math.PI / 2, 0, 0], color: '#bac8ff' });
    B.addGlow(sphere(0.05, 6, 4), { node: 'head', pos: [0, 1.1, 0], color: '#bac8ff' });
  }
  if (boss) {
    for (const side of [-1, 1]) B.add(box(0.22, 0.08, 0.5), { node: 'torso', pos: [side * 0.3, 0.84, 0], color: '#fab005' });
    B.add(cone(0.08, 0.25, 4), { node: 'head', pos: [0, 1.14, 0], color: '#fab005' });
    B.add(cyl(0.06, 0.08, 0.3, 8), { node: 'torso', pos: [0.2, 0.92, -0.18], color: '#495057' });
  }
  applyHumanoidProps(B, def, {});
  return { height: 1.1, kind: 'stomp' };
}

function buildBeast(B, def) {
  const fur = col(def.color || '#adb5bd');
  const accent = col(def.accent || '#495057');
  const v = (def.model?.variant || '').toLowerCase();
  const boar = v.includes('boar') || propsOf(def).has('tusks');
  const bear = v.includes('bear');
  const s = B.s(14, 10, 8);
  B.main = 'torso';
  B.anchors.head = [0, 0.66, 0.4];
  B.anchors.headR = 0.19;
  if (bear) {
    B.node('torso', V(0, 0.4, 0));
    B.add(ellipsoid(0.34, 0.32, 0.42, s, s - 2), { node: 'torso', pos: [0, 0.5, -0.02], color: fur });
    B.node('head', V(0, 0.6, 0.3), 'torso');
    B.add(sphere(0.24, s, s - 2), { node: 'head', pos: [0, 0.72, 0.38], color: fur });
    B.add(ellipsoid(0.11, 0.09, 0.1, 10, 8), { node: 'head', pos: [0, 0.66, 0.58], color: col('#f8f0e3').lerp(fur, 0.3) });
    B.add(sphere(0.04, 6, 4), { node: 'head', pos: [0, 0.7, 0.67], color: '#212529' });
    eyes(B, { y: 0.78, z: 0.57, x: 0.1, size: 0.045, node: 'head', style: 'angry' });
    for (const side of [-1, 1]) {
      B.add(sphere(0.08, 8, 6), { node: 'head', pos: [side * 0.18, 0.92, 0.34], color: fur });
      B.add(sphere(0.045, 6, 4), { node: 'head', pos: [side * 0.18, 0.92, 0.39], color: accent });
      for (const fb of [1, -1]) {
        const n = `leg${side > 0 ? 'L' : 'R'}${fb > 0 ? 'F' : 'B'}`;
        B.node(n, V(side * 0.2, 0.32, fb * 0.22));
        B.add(capsule(0.09, 0.16, 4, 8), { node: n, pos: [side * 0.2, 0.15, fb * 0.22], color: accent.clone().lerp(fur, 0.5) });
      }
    }
    B.anchors.head = [0, 0.74, 0.38];
    B.anchors.headR = 0.24;
    return { height: 0.95, kind: 'gallop' };
  }
  B.node('torso', V(0, 0.4, 0));
  B.add(ellipsoid(boar ? 0.3 : 0.22, boar ? 0.26 : 0.2, 0.4, s, s - 2), { node: 'torso', pos: [0, 0.45, -0.02], color: fur });
  B.add(ellipsoid(0.2, 0.15, 0.3, 10, 8), { node: 'torso', pos: [0, 0.37, 0.0], color: col('#f8f9fa').lerp(fur, 0.5) });
  B.node('head', V(0, 0.55, 0.3), 'torso');
  B.add(sphere(boar ? 0.22 : 0.19, s, s - 2), { node: 'head', pos: [0, 0.62, 0.38], color: fur });
  B.add(ellipsoid(boar ? 0.12 : 0.08, boar ? 0.1 : 0.07, 0.13, 10, 8), { node: 'head', pos: [0, 0.56, 0.56], color: boar ? col('#ffb3c7') : fur });
  B.add(sphere(0.035, 6, 4), { node: 'head', pos: [0, 0.6, 0.68], color: '#212529' });
  eyes(B, { y: 0.68, z: 0.53, x: 0.09, size: 0.045, node: 'head', style: def.tier === 'normal' ? 'cute' : 'angry' });
  for (const side of [-1, 1]) {
    const ear = cone(0.07, boar ? 0.12 : 0.18, 4);
    B.add(ear, { node: 'head', pos: [side * 0.12, 0.82, 0.32], rot: [-0.2, 0, -side * 0.3], color: accent });
    if (boar) B.add(cone(0.025, 0.12, 5), { node: 'head', pos: [side * 0.1, 0.55, 0.6], rot: [-0.4, 0, side * -0.4], color: '#fff9db' });
    for (const fb of [1, -1]) {
      const n = `leg${side > 0 ? 'L' : 'R'}${fb > 0 ? 'F' : 'B'}`;
      B.node(n, V(side * 0.14, 0.35, fb * 0.2));
      B.add(capsule(0.055, 0.2, 4, 8), { node: n, pos: [side * 0.14, 0.17, fb * 0.2], color: accent.clone().lerp(fur, 0.5) });
    }
  }
  B.node('tail', V(0, 0.5, -0.38), 'torso');
  const tp = boar ? smoothPath([[0, 0.5, -0.4], [0.05, 0.55, -0.48], [0, 0.6, -0.5]], 6) : smoothPath([[0, 0.5, -0.38], [0, 0.62, -0.52], [0, 0.72, -0.6]], 8);
  B.add(strand(tp, (t) => (boar ? [0.02, 0.02] : [0.07 * Math.sin(Math.PI * (0.2 + t * 0.8)) + 0.02, 0.07 * Math.sin(Math.PI * (0.2 + t * 0.8)) + 0.02]), { radial: 6 }), { node: 'tail', color: boar ? accent : fur });
  if (boar) for (let i = 0; i < 5; i++) B.add(cone(0.03, 0.12, 4), { node: 'torso', pos: [0, 0.7, 0.15 - i * 0.1], rot: [-0.3, 0, 0], color: accent });
  if (has(def, 'enrage')) B.add(torus(0.16, 0.03, 4, 12), { node: 'torso', pos: [0, 0.55, 0.28], color: '#e03131' });
  return { height: 0.85, kind: 'gallop' };
}

function buildFae(B, def) {
  const c = col(def.color || '#f783ac');
  const a = col(def.accent || '#ae3ec9');
  const props = propsOf(def);
  const s = B.s(14, 10, 8);
  B.main = 'torso';
  B.anchors.head = [0, 0.8, 0.02];
  B.anchors.headR = 0.2;
  if ((def.model?.variant || '').includes('mirage')) B.ghostly = true;
  B.node('torso', V(0, 0.5, 0));
  const dress = lathe([[0.0, 0.62], [0.1, 0.6], [0.12, 0.45], [0.26, 0.24], [0.28, 0.2], [0.0, 0.2]], s);
  B.add(dress, { node: 'torso', color: (p) => (p.y < 0.26 ? a : c) });
  B.node('head', V(0, 0.65, 0), 'torso');
  B.add(sphere(0.2, s, s - 2), { node: 'head', pos: [0, 0.8, 0.02], color: '#ffe8dc' });
  B.add(sphere(0.23, s, s - 2, 0, Math.PI * 2, 0, Math.PI * 0.55), { node: 'head', pos: [0, 0.82, -0.01], rot: [-0.3, 0, 0], color: a.clone().lerp(col('#ffffff'), 0.2) });
  eyes(B, { y: 0.79, z: 0.19, x: 0.075, size: 0.055, node: 'head', color: a.clone().multiplyScalar(0.5) });
  for (const side of [-1, 1]) B.add(cone(0.03, 0.12, 4), { node: 'head', pos: [side * 0.2, 0.84, 0.0], rot: [0, 0, -side * 1.2], color: '#ffe8dc' });
  // Antennae.
  for (const side of [-1, 1]) {
    const pts = smoothPath([[side * 0.06, 0.98, 0], [side * 0.1, 1.1, 0.05], [side * 0.16, 1.15, 0.1]], 6);
    B.add(strand(pts, () => [0.01, 0.01], { radial: 4 }), { node: 'head', color: a });
    B.addGlow(sphere(0.03, 6, 4), { node: 'head', pos: [side * 0.16, 1.15, 0.1], color: '#fff3bf' });
  }
  B.done.add('wings');
  if (props.has('tiara')) {
    crown(B, { pos: [0, 0.98, 0.0], r: 0.09, node: 'head', color: '#fff3bf' });
    B.done.add('tiara');
  }
  wingPair(B, { pivotY: 0.55, pivotZ: -0.08, span: def.tier === 'elite' ? 0.55 : 0.42, color: c.clone().lerp(col('#ffffff'), 0.5), membrane: col('#e3fafc'), node: 'torso', kind: 'butterfly', x: 0.05 });
  for (const side of [-1, 1]) {
    const n = side > 0 ? 'armL' : 'armR';
    B.node(n, V(side * 0.11, 0.56, 0), 'torso');
    B.add(capsule(0.03, 0.15, 4, 6), { node: n, pos: [side * 0.15, 0.48, 0.02], rot: [0, 0, side * 0.4], color: '#ffe8dc' });
  }
  if (has(def, 'decoy') || props.has('mask')) {
    B.add(ellipsoid(0.15, 0.08, 0.04, 10, 6), { node: 'head', pos: [0, 0.8, 0.21], color: '#ffffff' });
    for (const side of [-1, 1]) B.add(ellipsoid(0.035, 0.02, 0.02, 6, 4), { node: 'head', pos: [side * 0.07, 0.8, 0.24], color: '#212529' });
  }
  if (props.has('mirror')) weaponProp(B, 'mirror', { pos: [-0.24, 0.36, 0.08], node: 'armR', scale: 0.9 });
  else if (props.has('staff') || def.tier !== 'normal') weaponProp(B, 'staff', { pos: [-0.22, 0.38, 0.05], node: 'armR', scale: 0.7, color: '#fff3bf' });
  return { height: 1.05, kind: 'flutter' };
}

function buildPlant(B, def) {
  const c = col(def.color || '#94d82d');
  const a = col(def.accent || '#e64980');
  const v = (def.model?.variant || '').toLowerCase();
  const s = B.s(14, 10, 8);
  B.node('stem', V(0, 0.1, 0));
  B.main = 'stem';
  B.anchors.head = [0, 0.6, 0];
  B.anchors.headR = 0.3;
  if (v.includes('treant')) {
    const trunk = lathe([[0.0, 1.0], [0.18, 0.95], [0.22, 0.6], [0.26, 0.3], [0.36, 0.06], [0.0, 0.04]], s);
    B.add(trunk, { node: 'stem', color: col('#7a5230') });
    B.node('flower', V(0, 1.0, 0), 'stem');
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05;
      B.add(sphere(0.24, 10, 8), { node: 'flower', pos: [Math.cos(a) * 0.25, 1.08 + (i % 2) * 0.1, Math.sin(a) * 0.22], color: c.clone().lerp(col('#2b8a3e'), (i % 3) * 0.2) });
    }
    B.add(sphere(0.26, 10, 8), { node: 'flower', pos: [0, 1.25, 0], color: c });
    eyes(B, { y: 0.62, z: 0.2, x: 0.09, size: 0.06, node: 'stem', style: 'angry', color: '#1f1a10' });
    mouth(B, { y: 0.45, z: 0.23, w: 0.08, node: 'stem', kind: 'o' });
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + 0.4;
      const pts = smoothPath([[0, 0.1, 0], [Math.sin(ang) * 0.3, 0.05, Math.cos(ang) * 0.3], [Math.sin(ang) * 0.45, 0.0, Math.cos(ang) * 0.45]], 6);
      B.add(strand(pts, (t) => [0.06 * (1 - t) + 0.01, 0.06 * (1 - t) + 0.01], { radial: 5 }), { color: '#6b4226' });
    }
    for (const side of [-1, 1]) {
      const pts = smoothPath([[side * 0.2, 0.7, 0], [side * 0.42, 0.85, 0.05], [side * 0.55, 1.0, 0.1]], 6);
      B.add(strand(pts, (t) => [0.05 * (1 - t) + 0.01, 0.05 * (1 - t) + 0.01], { radial: 5 }), { node: 'stem', color: '#7a5230' });
    }
    B.anchors.head = [0, 1.2, 0];
    B.done.add('leaves');
    return { height: 1.45, kind: 'sway' };
  }
  if (v.includes('sprout')) {
    B.add(ellipsoid(0.26, 0.24, 0.24, s, s - 2), { node: 'stem', pos: [0, 0.25, 0], color: col('#c9a27e') });
    B.node('flower', V(0, 0.48, 0), 'stem');
    B.add(cyl(0.025, 0.03, 0.2, 6), { node: 'flower', pos: [0, 0.56, 0], color: '#5c940d' });
    for (const side of [-1, 1]) B.add(ellipsoid(0.16, 0.04, 0.09, 10, 6), { node: 'flower', pos: [side * 0.13, 0.68, 0], rot: [0, 0, -side * 0.45], color: c });
    eyes(B, { y: 0.28, z: 0.22, x: 0.09, size: 0.06, node: 'stem' });
    mouth(B, { y: 0.17, z: 0.24, w: 0.06, node: 'stem' });
    B.done.add('leaves');
    return { height: 0.8, kind: 'hop' };
  }
  if (v.includes('moss')) {
    B.add(ellipsoid(0.32, 0.28, 0.3, s, s - 2), { node: 'stem', pos: [0, 0.3, 0], color: (p) => (Math.sin(p.x * 30 + p.y * 20) > 0.7 ? c.clone().multiplyScalar(0.8) : c) });
    eyes(B, { y: 0.34, z: 0.28, x: 0.1, size: 0.06, node: 'stem', style: 'sleepy' });
    B.anchors.head = [0, 0.38, 0];
    B.anchors.headR = 0.3;
    return { height: 0.8, kind: 'hop' };
  }
  if (v.includes('thorn') || v.includes('root') || def.armor > 0) {
    B.done.add('thorns');
    // Woody thornroot: knotted trunk with thorns and root legs.
    const trunk = lathe([[0.0, 0.95], [0.16, 0.9], [0.22, 0.6], [0.26, 0.3], [0.32, 0.08], [0.0, 0.05]], s);
    B.add(trunk, { node: 'stem', color: (p) => col('#7a5230').lerp(c, Math.max(0, p.y - 0.5)) });
    for (let i = 0; i < 9; i++) {
      const ang = i * 2.4;
      const y = 0.25 + (i % 4) * 0.17;
      const g = cone(0.035, 0.14, 4);
      g.rotateX(Math.PI / 2);
      g.rotateY(ang);
      B.add(g, { node: 'stem', pos: [Math.sin(ang) * 0.24, y, Math.cos(ang) * 0.24], color: a });
    }
    eyes(B, { y: 0.68, z: 0.19, x: 0.08, size: 0.055, node: 'stem', style: 'angry', color: '#1f1a10' });
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + 0.4;
      const pts = smoothPath([[0, 0.1, 0], [Math.sin(ang) * 0.25, 0.06, Math.cos(ang) * 0.25], [Math.sin(ang) * 0.4, 0.0, Math.cos(ang) * 0.4]], 6);
      B.add(strand(pts, (t) => [0.05 * (1 - t) + 0.01, 0.05 * (1 - t) + 0.01], { radial: 5 }), { color: '#6b4226' });
    }
    for (let i = 0; i < 3; i++) B.add(ellipsoid(0.16, 0.05, 0.08, 8, 6), { node: 'stem', pos: [Math.cos(i * 2.1) * 0.12, 0.98, Math.sin(i * 2.1) * 0.12], rot: [0, i * 2.1, 0.5], color: c });
    return { height: 1.05, kind: 'sway' };
  }
  if (v.includes('pod') || v.includes('seed') || has(def, 'brood')) {
    B.add(ellipsoid(0.32, 0.36, 0.3, s, s - 2), { node: 'stem', pos: [0, 0.42, 0], color: (p) => (Math.sin(Math.atan2(p.x, p.z) * 6) > 0.6 ? c.clone().multiplyScalar(0.8) : c) });
    B.add(cyl(0.12, 0.06, 0.12, 8), { node: 'stem', pos: [0, 0.8, 0], color: '#5c940d' });
    for (let i = 0; i < 4; i++) B.add(sphere(0.07, 8, 6), { node: 'stem', pos: [Math.cos(i * 1.6) * 0.3, 0.45 + Math.sin(i) * 0.15, Math.sin(i * 1.6) * 0.28], color: a });
    eyes(B, { y: 0.48, z: 0.27, x: 0.1, size: 0.07, node: 'stem' });
    mouth(B, { y: 0.34, z: 0.3, w: 0.07, node: 'stem' });
    for (const side of [-1, 1]) B.add(ellipsoid(0.18, 0.04, 0.09, 8, 6), { node: 'stem', pos: [side * 0.3, 0.12, 0.05], rot: [0, 0, -side * 0.3], color: '#5c940d' });
    return { height: 0.9, kind: 'hop' };
  }
  // Bulb flower.
  B.add(ellipsoid(0.3, 0.3, 0.28, s, s - 2), { node: 'stem', pos: [0, 0.32, 0], color: c });
  B.node('flower', V(0, 0.6, 0), 'stem');
  for (let i = 0; i < 6; i++) {
    const g = ellipsoid(0.16, 0.05, 0.1, 8, 6);
    g.translate(0.16, 0, 0);
    g.rotateZ(0.4);
    g.rotateY((i / 6) * Math.PI * 2);
    B.add(g, { node: 'flower', pos: [0, 0.68, 0], color: a });
  }
  B.add(sphere(0.09, 10, 8), { node: 'flower', pos: [0, 0.72, 0], color: '#ffd43b' });
  eyes(B, { y: 0.36, z: 0.27, x: 0.1, size: 0.065, node: 'stem' });
  mouth(B, { y: 0.24, z: 0.29, w: 0.06, node: 'stem' });
  for (const side of [-1, 1]) B.add(ellipsoid(0.2, 0.04, 0.1, 8, 6), { node: 'stem', pos: [side * 0.3, 0.1, 0], rot: [0, 0, -side * 0.25], color: '#5c940d' });
  return { height: 0.95, kind: 'sway' };
}

function buildDragon(B, def) {
  const scale = col(def.color || '#ff8787');
  const accent = col(def.accent || '#862e9c');
  const boss = def.tier === 'boss';
  const s = B.s(16, 12, 8);
  B.node('torso', V(0, 0.45, 0));
  B.add(ellipsoid(0.24, 0.24, 0.36, s, s - 2), { node: 'torso', pos: [0, 0.48, 0], color: scale });
  B.add(ellipsoid(0.17, 0.17, 0.28, 10, 8), { node: 'torso', pos: [0, 0.42, 0.06], color: col('#fff3bf').lerp(scale, 0.35) });
  // Neck + head.
  B.node('head', V(0, 0.65, 0.28), 'torso');
  const neck = smoothPath([[0, 0.58, 0.22], [0, 0.72, 0.34], [0, 0.82, 0.38]], 6);
  B.add(strand(neck, () => [0.1, 0.1], { radial: 8 }), { node: 'head', color: scale });
  B.add(ellipsoid(0.16, 0.14, 0.2, s, s - 2), { node: 'head', pos: [0, 0.88, 0.44], color: scale });
  B.add(ellipsoid(0.1, 0.08, 0.14, 10, 8), { node: 'head', pos: [0, 0.84, 0.6], color: scale });
  eyes(B, { y: 0.93, z: 0.55, x: 0.09, size: 0.045, node: 'head', style: boss ? 'glow' : 'angry', glow: '#ffd43b' });
  for (const side of [-1, 1]) {
    const pts = smoothPath([[side * 0.08, 0.98, 0.4], [side * 0.12, 1.08, 0.3], [side * 0.14, 1.12, 0.18]], 6);
    B.add(strand(pts, (t) => [0.035 * (1 - t) + 0.005, 0.035 * (1 - t) + 0.005], { radial: 5 }), { node: 'head', color: '#f8f0e3' });
  }
  for (let i = 0; i < 5; i++) B.add(cone(0.03, 0.09, 4), { node: 'torso', pos: [0, 0.72 - i * 0.02, 0.15 - i * 0.12], rot: [-0.4, 0, 0], color: accent });
  // Tail.
  B.node('tail', V(0, 0.45, -0.3), 'torso');
  const tp = smoothPath([[0, 0.45, -0.3], [0, 0.35, -0.55], [0.08, 0.3, -0.8], [0.18, 0.35, -0.95]], 10);
  B.add(strand(tp, (t) => [0.12 * (1 - t) + 0.01, 0.1 * (1 - t) + 0.01], { radial: 7 }), { node: 'tail', color: scale });
  B.add(cone(0.08, 0.16, 4), { node: 'tail', pos: [0.2, 0.36, -1.0], rot: [-Math.PI / 2, 0, 0], color: accent });
  // Legs (tucked for flight).
  const flier = propsOf(def).has('wings') || has(def, 'airborne') || boss;
  for (const side of (flier ? [-1, 1] : [])) {
    const n = side > 0 ? 'legL' : 'legR';
    B.node(n, V(side * 0.14, 0.35, -0.05));
    B.add(capsule(0.06, 0.12, 4, 8), { node: n, pos: [side * 0.15, 0.22, 0.0], rot: [0.3, 0, 0], color: scale.clone().multiplyScalar(0.85) });
  }
  B.anchors.head = [0, 0.88, 0.44];
  B.anchors.headR = 0.15;
  B.main = 'torso';
  for (const k of ['wings', 'tail', 'horns']) B.done.add(k);
  if (boss) B.done.add('crown');
  if (!flier) {
    for (const side of [-1, 1]) {
      for (const fb of [1, -1]) {
        const n = `leg${side > 0 ? 'L' : 'R'}${fb > 0 ? 'F' : 'B'}`;
        B.node(n, V(side * 0.18, 0.36, fb * 0.18));
        B.add(capsule(0.07, 0.22, 4, 8), { node: n, pos: [side * 0.18, 0.17, fb * 0.18], color: scale.clone().multiplyScalar(0.85) });
        B.add(ellipsoid(0.08, 0.04, 0.11, 8, 5), { node: n, pos: [side * 0.18, 0.03, fb * 0.18 + 0.04], color: accent });
      }
    }
    return { height: 1.0, kind: 'gallop' };
  }
  wingPair(B, { pivotY: 0.62, pivotZ: -0.02, span: boss ? 0.95 : 0.75, color: scale.clone().multiplyScalar(0.8), membrane: accent.clone().lerp(col('#ffffff'), 0.15), node: 'torso', kind: 'bat', x: 0.16 });
  if (boss) {
    for (let i = 0; i < 3; i++) B.addGlow(sphere(0.04, 6, 4), { node: 'torso', pos: [Math.cos(i) * 0.18, 0.55 + i * 0.05, 0.2], color: '#ff922b' });
    crown(B, { pos: [0, 1.03, 0.44], r: 0.09, node: 'head', color: '#ff922b' });
  }
  return { height: 1.0, kind: 'fly' };
}

/** Generic decorative props shared by all families (skips what a family already drew). */
function decorate(B, def) {
  const props = propsOf(def);
  const want = (k) => props.has(k) && !B.done.has(k);
  const headNode = B.nodes.has('head') ? 'head' : B.main;
  const bodyNode = B.nodes.has('torso') ? 'torso' : B.main;
  const [hx, hy, hz] = B.anchors.head || [0, 0.8, 0];
  const hr = B.anchors.headR || 0.25;
  const accent = col(def.accent || '#ffd43b');
  const main = col(def.color || '#cccccc');
  if (want('sparkle')) {
    for (let i = 0; i < 3; i++) {
      const a = i * 2.2 + 0.5;
      B.addGlow(extrude(star(4, 0.06, 0.02), 0.015), { node: headNode, pos: [hx + Math.cos(a) * hr * 1.5, hy + hr * (0.4 + i * 0.25), hz + Math.sin(a) * hr * 0.8], color: '#fff3bf' });
    }
  }
  if (want('candle')) {
    B.add(cyl(0.04, 0.045, 0.14, 8), { node: headNode, pos: [hx, hy + hr * 0.95 + 0.06, hz], color: '#fff9db' });
    B.addGlow(cone(0.035, 0.09, 6), { node: headNode, pos: [hx, hy + hr * 0.95 + 0.18, hz], color: '#ffd166' });
  }
  if (want('chains')) {
    const pts = smoothPath([[-0.32, 0.35, 0.05], [-0.1, 0.25, 0.3], [0.15, 0.3, 0.28], [0.34, 0.42, 0.0]], 12);
    B.add(strand(pts, () => [0.022, 0.022], { radial: 4 }), { node: bodyNode, color: '#868e96' });
    B.add(box(0.1, 0.12, 0.06), { node: bodyNode, pos: [0.0, 0.2, 0.3], color: '#495057' });
  }
  if (want('bones')) {
    for (const r of [0.6, -0.6]) B.add(capsule(0.025, 0.22, 3, 6), { node: bodyNode, pos: [0, 0.48, 0.2], rot: [0, 0, r], color: '#f8f9fa' });
  }
  if (want('moss')) {
    for (let i = 0; i < 4; i++) B.add(ellipsoid(0.1, 0.05, 0.09, 8, 5), { node: i < 2 ? headNode : bodyNode, pos: i < 2 ? [hx + (i ? 0.1 : -0.12), hy + hr * 0.85, hz - 0.03] : [(i === 2 ? 0.18 : -0.2), 0.62, -0.05], color: '#69a84f' });
  }
  if (want('mane')) {
    const dark = main.clone().lerp(col('#2b1d14'), 0.45);
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * 0.8 + (i / 8) * Math.PI * 1.6;
      const g = cone(0.06, 0.2, 4);
      g.rotateX(-Math.PI / 2 - 0.5);
      g.rotateY(a + Math.PI);
      B.add(g, { node: headNode, pos: [hx + Math.sin(a) * hr * 0.9, hy - hr * 0.3 + Math.abs(Math.cos(a)) * 0.08, hz - Math.cos(a) * hr * 0.6], color: dark });
    }
  }
  if (want('tiara') || (want('crown') && !B.done.has('crown'))) crown(B, { pos: [hx, hy + hr * 0.9, hz], r: hr * 0.45, node: headNode });
  if (want('gears')) {
    const gear = extrude(star(8, 0.12, 0.09, 0), 0.04);
    B.add(gear, { node: bodyNode, pos: [0.2, 0.55, -0.2], rot: [0, Math.PI / 2, 0], color: '#f2c14e' });
    B.add(cyl(0.035, 0.035, 0.06, 8), { node: bodyNode, pos: [0.22, 0.55, -0.2], rot: [0, 0, Math.PI / 2], color: '#495057' });
  }
  if (want('chimney')) {
    B.add(cyl(0.06, 0.08, 0.3, 8), { node: bodyNode, pos: [-0.18, 0.95, -0.2], color: '#495057' });
    for (let i = 0; i < 3; i++) B.add(sphere(0.06 + i * 0.02, 8, 6), { node: bodyNode, pos: [-0.2 - i * 0.04, 1.15 + i * 0.1, -0.22], color: '#dee2e6' });
  }
  if (want('smokePot')) {
    B.add(sphere(0.08, 8, 6), { node: bodyNode, pos: [0.2, 0.3, 0.1], color: '#5c3d2e' });
    for (let i = 0; i < 3; i++) B.add(sphere(0.05 + i * 0.015, 8, 6), { node: bodyNode, pos: [0.24 + i * 0.03, 0.4 + i * 0.08, 0.1], color: '#ced4da' });
  }
  if (want('glider')) {
    for (const side of [-1, 1]) {
      const sh = new THREE.Shape();
      sh.moveTo(0, 0); sh.lineTo(side * 0.55, 0.15); sh.lineTo(side * 0.5, -0.05); sh.closePath();
      B.add(extrude(sh, 0.015), { node: bodyNode, pos: [0, 0.72, -0.2], rot: [-0.4, 0, 0], color: (p) => (Math.abs(p.x) > 0.3 ? accent : col('#fff3e0')) });
    }
    B.add(cyl(0.015, 0.015, 1.0, 4), { node: bodyNode, pos: [0, 0.74, -0.2], rot: [0, 0, Math.PI / 2], color: '#8a5a3c' });
  }
  if (want('drum')) {
    B.add(cyl(0.22, 0.22, 0.24, 14), { node: bodyNode, pos: [0, 0.42, 0.26], rot: [Math.PI / 2, 0, 0], color: (p) => (Math.abs(p.z - 0.26) > 0.1 ? col('#fff3e0') : col('#a0522d')) });
    for (const side of [-1, 1]) B.add(cyl(0.02, 0.02, 0.3, 4), { node: side > 0 ? 'armL' : 'armR', pos: [side * 0.38, 0.5, 0.2], rot: [0.8, 0, 0], color: '#8a5a3c' });
  }
  if (want('flower')) {
    for (let i = 0; i < 5; i++) {
      const g = ellipsoid(0.06, 0.035, 0.03, 8, 5);
      g.translate(0.05, 0, 0);
      g.rotateZ((i / 5) * Math.PI * 2);
      B.add(g, { node: headNode, pos: [hx + hr * 0.7, hy + hr * 0.6, hz + 0.05], rot: [0, 0.5, 0], color: '#ff8fab' });
    }
    B.add(sphere(0.03, 6, 4), { node: headNode, pos: [hx + hr * 0.72, hy + hr * 0.6, hz + 0.08], color: '#ffd43b' });
  }
  if (want('ember')) {
    for (let i = 0; i < 4; i++) B.addGlow(sphere(0.03, 6, 4), { node: bodyNode, pos: [Math.cos(i * 1.7) * 0.3, 0.4 + i * 0.12, Math.sin(i * 1.7) * 0.3], color: i % 2 ? '#ff922b' : '#ffd43b' });
  }
  if (want('crystals') && !B.hasCrystals) crystalCluster(B, { pos: [0, (B.anchors.back || 0.6), -0.18], n: 5, size: 0.14, color: '#a5f3fc', node: bodyNode, spread: 0.35 });
  if (want('mushroom')) {
    B.add(sphere(hr * 0.9, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), { node: headNode, pos: [hx, hy + hr * 0.5, hz], scale: [1.2, 0.7, 1.2], color: (p) => (Math.sin(p.x * 40) * Math.sin(p.z * 40) > 0.6 ? col('#ffffff') : col('#e03131')) });
  }
  if (want('leaves')) {
    for (const side of [-1, 1]) B.add(ellipsoid(0.13, 0.03, 0.06, 8, 5), { node: headNode, pos: [hx + side * 0.1, hy + hr * 0.95, hz], rot: [0, 0, side * -0.6], color: '#51cf66' });
  }
  if (want('scarf')) B.add(torus(hr * 0.9, 0.045, 6, 14), { node: headNode, pos: [hx, hy - hr * 0.85, hz - 0.05], rot: [Math.PI / 2 - 0.3, 0, 0], color: accent });
  if (want('helmet')) helmet(B, { pos: [hx, hy + hr * 0.15, hz], r: hr * 1.08, node: headNode });
  if (want('cape')) cape(B, { top: hy - hr * 0.6, width: 0.6, length: 0.5, z: -0.25, color: def.accent || '#c92a2a', node: bodyNode });
  if (want('spear')) weaponProp(B, 'spear', { pos: [-hr * 1.4, 0.15, 0.1], node: bodyNode, scale: 0.8 });
}

const FAMILY_BUILDERS = {
  slime: buildSlime, goblin: buildGoblin, orc: buildOrc, ghost: buildGhost, ghoul: buildGhoul,
  oni: buildOni, lizard: buildLizard, construct: buildConstruct, beast: buildBeast, fae: buildFae,
  plant: buildPlant, dragon: buildDragon,
};

// ---------------------------------------------------------------------------
// Asset + instance
// ---------------------------------------------------------------------------

function createAsset(def, quality) {
  const family = def.model?.base || def.family || 'slime';
  const B = new Builder(quality, def);
  const build = FAMILY_BUILDERS[family] || buildSlime;
  const info = build(B, def) || { height: 1, kind: 'walk' };
  decorate(B, def);
  // Elite / boss dressing: a ground sigil.
  if (def.tier === 'elite' || def.tier === 'miniboss' || def.tier === 'boss') {
    const r = def.tier === 'elite' ? 0.36 : 0.48;
    B.add(torus(r, 0.018, 4, B.s(28, 20, 14)), { node: 'body', pos: [0, 0.012, 0], rot: [Math.PI / 2, 0, 0], color: def.tier === 'elite' ? '#ffd43b' : '#ff5d73' });
  }
  const nodes = [];
  for (const [name, n] of B.nodes) {
    const geometry = n.parts.length ? merge(n.parts) : null;
    const glow = n.glow.length ? merge(n.glow) : null;
    for (const g of [geometry, glow]) {
      if (!g) continue;
      g.deleteAttribute('skinIndex');
      g.deleteAttribute('skinWeight');
      g.translate(-n.pivot.x, -n.pivot.y, -n.pivot.z);
      g.userData.shared = true;
    }
    nodes.push({ name, pivot: n.pivot, parent: n.parent, geometry, glow });
  }
  return {
    family, nodes, info, slimy: !!B.slimy, ghostly: !!B.ghostly, orbs: B.orbs || 0,
    scale: 0.6 * (def.size || 1) / (info.height || 1),
  };
}

function instantiate(asset, def, quality) {
  const group = new THREE.Group();
  group.name = `enemy:${def.id}`;
  const model = new THREE.Group();
  model.scale.setScalar(asset.scale);
  group.add(model);
  const baseOpacity = asset.slimy ? 0.88 : (asset.ghostly ? 0.8 : 1);
  const mat = toonMaterial().clone();
  mat.userData = {};
  mat.transparent = baseOpacity < 1;
  mat.opacity = baseOpacity;
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, opacity: 1 });
  const see = baseOpacity < 1;
  let outlineMat = null;
  if (quality !== 'low') {
    outlineMat = outlineMaterial(0.022);
    if (see) {
      // Drawn after the translucent body (which writes depth) so it only shows at the rim.
      if (!seeThroughOutline) {
        seeThroughOutline = outlineMat.clone();
        seeThroughOutline.transparent = true;
        seeThroughOutline.onBeforeCompile = outlineMat.onBeforeCompile;
        seeThroughOutline.customProgramCacheKey = outlineMat.customProgramCacheKey;
        seeThroughOutline.userData.shared = true;
      }
      outlineMat = seeThroughOutline;
    }
  }
  const nodeObjs = {};
  const outlines = [];
  for (const n of asset.nodes) {
    const obj = new THREE.Group();
    obj.name = n.name;
    nodeObjs[n.name] = obj;
    obj.userData.restPos = n.pivot.clone();
  }
  for (const n of asset.nodes) {
    const obj = nodeObjs[n.name];
    const parent = n.parent ? nodeObjs[n.parent] : model;
    const parentPivot = n.parent ? asset.nodes.find((m) => m.name === n.parent).pivot : V(0, 0, 0);
    obj.position.copy(n.pivot).sub(parentPivot);
    obj.userData.restPos = obj.position.clone();
    parent.add(obj);
    if (n.geometry) {
      const m = new THREE.Mesh(n.geometry, mat);
      m.castShadow = true;
      m.renderOrder = see ? 1 : 0;
      obj.add(m);
      if (outlineMat) {
        const o = new THREE.Mesh(n.geometry, outlineMat);
        o.renderOrder = see ? 2 : 0;
        o.userData.isOutline = true;
        obj.add(o);
        outlines.push(o);
      }
    }
    if (n.glow) obj.add(new THREE.Mesh(n.glow, glowMat));
  }

  // Barrier bubble (hidden until setBarrier > 0).
  const bubbleMat = new THREE.MeshBasicMaterial({ color: '#9ec5ff', transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending });
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14), bubbleMat);
  bubble.userData.fx = true;
  bubble.position.y = (asset.info.height || 1) * 0.5;
  bubble.visible = false;
  model.add(bubble);

  const st = {
    flash: 0, veiled: false, phasing: false, barrier: 0, statuses: {}, tint: null, frozen: false,
    phase: (hash(def.id) % 1000) / 1000 * 6.28,
  };
  const baseColor = new THREE.Color('#ffffff');
  const tmp = new THREE.Color();

  const applyLook = (time) => {
    let opacity = baseOpacity;
    if (st.veiled) opacity = 0.32 + 0.12 * Math.sin(time * 6 + st.phase);
    if (st.phasing) opacity = Math.min(opacity, 0.38 + 0.08 * Math.sin(time * 9));
    mat.opacity = opacity;
    mat.transparent = opacity < 1;
    mat.depthWrite = opacity >= 0.75;
    glowMat.opacity = Math.min(1, opacity + 0.3);
    const sil = group.userData.silhouette;
    for (const o of outlines) o.visible = !(st.veiled || st.phasing || sil);
    // Tint.
    mat.color.copy(baseColor);
    mat.emissive.setRGB(0, 0, 0);
    if (st.tint) {
      mat.color.lerp(tmp.set(st.tint), st.frozen ? 0.6 : 0.4);
      const pulse = st.statuses.burn || st.statuses.shock ? 0.5 + 0.5 * Math.sin(time * 14) : 1;
      mat.emissive.copy(tmp.set(st.tint)).multiplyScalar(0.18 * pulse);
    }
    if (st.phasing) mat.emissive.add(tmp.set('#5c7cfa').multiplyScalar(0.25));
    if (st.flash > 0) mat.emissive.add(tmp.setRGB(1, 1, 1).multiplyScalar(st.flash * 0.9));
    if (st.barrier > 0) {
      bubble.visible = true;
      bubbleMat.opacity = 0.12 + 0.22 * st.barrier + 0.05 * Math.sin(time * 4);
      bubble.scale.setScalar(1 + 0.03 * Math.sin(time * 3));
    } else {
      bubble.visible = false;
    }
  };

  const kind = asset.info.kind;
  group.userData.kind = 'enemy';
  group.userData.enemyId = def.id;
  group.userData.height = 0.6 * (def.size || 1);
  group.userData.family = asset.family;
  group.userData.animate = (time, dt = 0.016, { moving = true, speed = 1 } = {}) => {
    st.flash = Math.max(0, st.flash - (dt || 0.016) * 6);
    const frozen = st.frozen || st.statuses.stun || st.statuses.shock;
    const t = frozen ? st.frozenAt ?? time : time;
    if (!frozen) st.frozenAt = time;
    const sp = THREE.MathUtils.clamp(speed || 1, 0.3, 3);
    animateNodes(nodeObjs, kind, t * (moving ? 1.6 + sp * 2.2 : 1.4) + st.phase, moving, asset);
    if (st.statuses.stun && !st.frozen) model.rotation.z = Math.sin(time * 10) * 0.05;
    else model.rotation.z = 0;
    applyLook(time);
  };
  group.userData.hitFlash = () => { st.flash = 1; };
  group.userData.setVeiled = (on) => { st.veiled = !!on; };
  group.userData.setPhasing = (on) => { st.phasing = !!on; };
  group.userData.setBarrier = (frac) => { st.barrier = Math.max(0, Math.min(1, Number(frac) || 0)); };
  group.userData.setStatus = (map) => {
    st.statuses = {};
    for (const [k, v] of Object.entries(map || {})) if (v) st.statuses[k] = v;
    const order = ['freeze', 'burn', 'poison', 'shock', 'stun', 'slow', 'silence', 'mark', 'vulnerable', 'soak', 'shred'];
    const top = order.find((k) => st.statuses[k]);
    st.tint = top ? STATUS_TINT[top] : null;
    st.frozen = !!st.statuses.freeze;
  };
  group.userData.dispose = () => {
    mat.dispose();
    glowMat.dispose();
    bubbleMat.dispose();
    bubble.geometry.dispose();
  };
  group.userData.animate(0, 0, { moving: false });
  return group;
}

/** Family-specific procedural motion on the node hierarchy. */
function animateNodes(N, kind, t, moving, asset) {
  const s = Math.sin(t);
  const c = Math.cos(t);
  const reset = (n) => {
    if (!n) return;
    n.position.copy(n.userData.restPos);
    n.rotation.set(0, 0, 0);
    n.scale.set(1, 1, 1);
  };
  for (const n of Object.values(N)) reset(n);
  const mv = moving ? 1 : 0.35;
  const legs = (amp) => {
    if (N.legL) N.legL.rotation.x = s * amp * mv;
    if (N.legR) N.legR.rotation.x = -s * amp * mv;
    if (N.armL) N.armL.rotation.x = -s * amp * 0.8 * mv;
    if (N.armR) N.armR.rotation.x = s * amp * 0.8 * mv;
  };
  switch (kind) {
    case 'hop': {
      const h = Math.abs(Math.sin(t * 0.5));
      const j = N.jelly || N.stem;
      if (j) {
        j.position.y += h * 0.18 * mv;
        const sq = 1 + (1 - h) * 0.12 * mv;
        j.scale.set(sq, 2 - sq, sq);
      }
      break;
    }
    case 'walk':
      legs(0.6);
      if (N.torso) N.torso.position.y += Math.abs(c) * 0.03 * mv;
      if (N.head) N.head.rotation.z = s * 0.06;
      if (N.tail) N.tail.rotation.y = s * 0.3;
      break;
    case 'stomp':
      legs(0.4);
      if (N.torso) {
        N.torso.position.y += Math.abs(c) * 0.025 * mv;
        N.torso.rotation.z = s * 0.06 * mv;
      }
      break;
    case 'shamble':
      legs(0.35);
      if (N.torso) N.torso.rotation.z = Math.sin(t * 0.5) * 0.08;
      if (N.armL) N.armL.rotation.x = -1.0 + Math.sin(t * 0.7) * 0.15;
      if (N.armR) N.armR.rotation.x = -1.1 + Math.sin(t * 0.7 + 1) * 0.15;
      if (N.head) N.head.rotation.z = Math.sin(t * 0.4) * 0.15;
      break;
    case 'float':
      if (N.wisp) {
        N.wisp.position.y += Math.sin(t * 0.6) * 0.06;
        N.wisp.rotation.z = Math.sin(t * 0.45) * 0.06;
      }
      if (N.torso) N.torso.position.y += Math.sin(t * 0.6) * 0.05;
      break;
    case 'gallop':
      for (const [n, ph] of [['legLF', 0], ['legRF', Math.PI], ['legLB', Math.PI * 0.5], ['legRB', Math.PI * 1.5]]) {
        if (N[n]) N[n].rotation.x = Math.sin(t * 1.4 + ph) * 0.7 * mv;
      }
      if (N.torso) N.torso.position.y += Math.abs(Math.sin(t * 1.4)) * 0.05 * mv;
      if (N.tail) N.tail.rotation.x = Math.sin(t * 2) * 0.3;
      if (N.head) N.head.rotation.x = Math.sin(t * 1.4) * 0.08;
      break;
    case 'flutter':
      if (N.torso) N.torso.position.y += Math.sin(t * 0.8) * 0.06;
      if (N.wingL) N.wingL.rotation.y = -0.3 - Math.abs(Math.sin(t * 3)) * 0.8;
      if (N.wingR) N.wingR.rotation.y = 0.3 + Math.abs(Math.sin(t * 3)) * 0.8;
      break;
    case 'fly':
      if (N.torso) N.torso.position.y += Math.sin(t * 0.9) * 0.05;
      if (N.wingL) N.wingL.rotation.z = Math.sin(t * 1.8) * 0.55;
      if (N.wingR) N.wingR.rotation.z = -Math.sin(t * 1.8) * 0.55;
      if (N.tail) N.tail.rotation.y = Math.sin(t * 0.9) * 0.25;
      if (N.head) N.head.rotation.x = Math.sin(t * 0.9 + 1) * 0.06;
      break;
    case 'sway':
      if (N.stem) N.stem.rotation.z = Math.sin(t * 0.7) * 0.08;
      if (N.flower) N.flower.rotation.y = t * 0.3;
      break;
    default:
      legs(0.5);
  }
  // Wings attached to non-flyers (gold slimes) flutter too.
  if (kind !== 'fly' && kind !== 'flutter') {
    if (N.wingL) N.wingL.rotation.y = -0.2 - Math.abs(Math.sin(t * 3)) * 0.6;
    if (N.wingR) N.wingR.rotation.y = 0.2 + Math.abs(Math.sin(t * 3)) * 0.6;
  }
  for (let i = 0; i < (asset.orbs || 0); i++) {
    const o = N[`orb${i}`];
    if (o) o.rotation.y = t * 0.6;
  }
}

function hash(id = '') {
  let h = 0;
  for (let i = 0; i < String(id).length; i++) h = (h * 31 + String(id).charCodeAt(i)) | 0;
  return h >>> 0;
}


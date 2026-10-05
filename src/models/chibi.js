// buildChibi: assembles a girl from the shared base body + procedural hair, face, outfit,
// accessory, halo and weapon, skinned to a tiny code-built skeleton so animations can bend
// the head, arms, legs and hair without any authored rig.
import * as THREE from 'three';
import {
  BONES, BONE_PARENT, LM, REGION, PROPORTIONS, baseBody, bonePivots, mapGeometry, mapPoint, hasGLBBody,
} from './body.js';
import { merge, paint } from './geom.js';
import { toonMaterial, outlineMaterial, basicMaterial } from './toon.js';
import { faceGeometry, faceTexture, setFaceCell, canDrawFaces, FACE_CELL } from './face.js';
import { buildHair } from './hair.js';
import { outfitSpec, buildOutfit } from './outfit.js';
import { buildAccessory } from './accessory.js';
import { buildWeapon, weaponStyle } from './weapons.js';
import { buildHalo } from './halo.js';
import { fallbackEyes } from './fallbackFace.js';

/** World height of a girl (feet to head top, without halo). */
export const CHIBI_HEIGHT = 0.9;
const GIRL_UNITS_TALL = 4.2; // head top incl. hair volume in girl space
const assetCache = new Map();
let highlightMat = null;

/**
 * Builds a chibi for a unit definition.
 * @param {object} unitDef UnitDef (needs id, palette, look; adult/kind for heroes)
 * @param {{quality?: 'high'|'medium'|'low', pose?: string}} [opts]
 * @returns {THREE.Group} ≈0.9 tall, feet at y=0, facing +z. userData: animate, playAttack, setHighlight
 */
export function buildChibi(unitDef, { quality = 'high', pose = 'idle' } = {}) {
  const asset = getAsset(unitDef, quality);
  return instantiate(asset, unitDef, quality, pose);
}

function getAsset(unit, quality) {
  const key = `${unit.id}|${quality}|${hasGLBBody() ? 'glb' : 'proc'}|${JSON.stringify(unit.look || {})}|${JSON.stringify(unit.palette || {})}`;
  let a = assetCache.get(key);
  if (!a) {
    a = createAsset(unit, quality);
    assetCache.set(key, a);
  }
  return a;
}

/**
 * Forgets cached character assets (e.g. after the GLB finished loading) so new builds use
 * the new body. Geometry is not disposed: models built earlier may still be on screen.
 */
export function clearChibiCache() {
  assetCache.clear();
}

function createAsset(unit, quality) {
  const base = baseBody(quality);
  const adult = !!(unit.adult || unit.kind === 'hero');
  const prop = adult ? PROPORTIONS.hero : PROPORTIONS.girl;
  const pal = { ...DEFAULT_PALETTE, ...(unit.palette || {}) };
  const look = { ...DEFAULT_LOOK, ...(unit.look || {}) };
  const spec = outfitSpec(unit, pal, look);
  const ctx = { unit, pal, look, quality, base, adult, spec, hs: base.headSurface, lm: LM };

  // Body with per-region colours.
  const body = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'skinIndex', 'skinWeight']) body.setAttribute(name, base.geometry.attributes[name].clone());
  body.setIndex(base.geometry.index.clone());
  const regionColors = spec.regions;
  paint(body, (p, n, i) => regionColors[base.regions[i]]);

  const hair = buildHair(ctx);
  const outfit = buildOutfit(ctx);
  const acc = buildAccessory(ctx);
  const weapon = buildWeapon(ctx);
  const extraFace = canDrawFaces() ? [] : fallbackEyes(ctx);
  const geometry = merge([body, ...hair.parts, ...outfit.parts, ...acc.parts, ...weapon.parts, ...extraFace]);
  mapGeometry(geometry, prop);

  let face = null;
  if (canDrawFaces()) {
    const fg = faceGeometry(base).clone();
    mapGeometry(fg, prop);
    face = { geometry: fg, texture: faceTexture(unit) };
  }
  const halo = buildHalo(ctx);
  if (halo) mapGeometry(halo.geometry, prop);

  // Cached and shared by every instance: disposeObject must leave these alone.
  for (const g of [geometry, face?.geometry, halo?.geometry, halo?.glowGeometry]) if (g) g.userData.shared = true;
  if (face) face.texture.userData.shared = true;

  const pivots = bonePivots(base, hair.tails || {}).map((p) => mapPoint(p.clone(), prop));
  const scale = CHIBI_HEIGHT / (GIRL_UNITS_TALL * (adult ? 1.07 : 1));
  return {
    geometry, face, halo, pivots, scale, adult, look, pal,
    weaponStyle: weaponStyle(look.weapon), hairInfo: hair, outlineWidth: 0.042,
  };
}

const DEFAULT_PALETTE = {
  hair: '#8a6a5a', hairShade: '#5a4038', eyes: '#4a7fd0', skin: '#ffe4d6', outfit: '#ffffff',
  outfitShade: '#d0d8e8', accent: '#ff6f91', halo: '#bfe8ff', weapon: '#c0c8d8',
};
const DEFAULT_LOOK = {
  hairStyle: 'bob', bangs: 'straight', accessory: 'none', outfit: 'sailor', weapon: 'staff',
  halo: 'ring', eyeStyle: 'round', expression: 'smile',
};

// ---------------------------------------------------------------------------
// Instancing + animation
// ---------------------------------------------------------------------------

function instantiate(asset, unit, quality, pose) {
  const group = new THREE.Group();
  group.name = `chibi:${unit.id}`;
  const model = new THREE.Group();
  model.scale.setScalar(asset.scale);
  group.add(model);

  // Skeleton.
  const bones = asset.pivots.map((p, i) => {
    const b = new THREE.Bone();
    b.name = Object.keys(BONES)[i];
    return b;
  });
  bones.forEach((b, i) => {
    const parent = BONE_PARENT[i];
    if (parent >= 0) {
      bones[parent].add(b);
      b.position.copy(asset.pivots[i]).sub(asset.pivots[parent]);
    } else {
      b.position.copy(asset.pivots[i]);
    }
  });
  const skeleton = new THREE.Skeleton(bones);

  const body = new THREE.SkinnedMesh(asset.geometry, toonMaterial());
  body.name = 'body';
  body.castShadow = true;
  body.add(bones[0]);
  model.add(body);
  model.updateMatrixWorld(true);
  body.bind(skeleton);
  const meshes = [body];

  if (quality !== 'low') {
    const outline = new THREE.SkinnedMesh(asset.geometry, outlineMaterial(asset.outlineWidth));
    outline.name = 'outline';
    outline.userData.isOutline = true;
    model.add(outline);
    outline.bind(skeleton, body.bindMatrix);
    meshes.push(outline);
  }

  let faceTex = null;
  let faceMesh = null;
  if (asset.face) {
    faceTex = asset.face.texture.clone();
    faceTex.userData = {};
    const faceMat = new THREE.MeshBasicMaterial({
      map: faceTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    faceMesh = new THREE.SkinnedMesh(asset.face.geometry, faceMat);
    faceMesh.name = 'face';
    faceMesh.renderOrder = 1;
    model.add(faceMesh);
    faceMesh.bind(skeleton, body.bindMatrix);
  }

  let haloMesh = null;
  if (asset.halo) {
    haloMesh = new THREE.SkinnedMesh(asset.halo.geometry, basicMaterial({ color: asset.halo.color, toneMapped: false }));
    haloMesh.name = 'halo';
    model.add(haloMesh);
    haloMesh.bind(skeleton, body.bindMatrix);
    if (asset.halo.glowGeometry && quality === 'high') {
      const glow = new THREE.SkinnedMesh(asset.halo.glowGeometry, basicMaterial({
        color: asset.halo.color, vertexColors: true, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }));
      glow.name = 'haloGlow';
      model.add(glow);
      glow.bind(skeleton, body.bindMatrix);
    }
  }
  for (const m of model.children) m.frustumCulled = false;

  const rest = bones.map((b) => ({ pos: b.position.clone() }));
  const anim = new ChibiAnimator({ bones, rest, asset, faceTex, unit, model, scale: asset.scale });
  group.userData.unitId = unit.id;
  group.userData.kind = 'chibi';
  group.userData.height = CHIBI_HEIGHT * (asset.adult ? 1.07 : 1);
  group.userData.bones = bones;
  group.userData.animate = (time, dt, state = 'idle') => anim.update(time, dt, state);
  group.userData.playAttack = () => anim.playAttack();
  group.userData.setHighlight = (on) => {
    if (!highlightMat) {
      highlightMat = new THREE.MeshToonMaterial({ vertexColors: true, color: '#ffffff', emissive: '#4d6dff', emissiveIntensity: 0.35 });
      highlightMat.gradientMap = toonMaterial().gradientMap;
      highlightMat.userData.shared = true;
    }
    body.material = on ? highlightMat : toonMaterial();
  };
  group.userData.dispose = () => {
    faceTex?.dispose();
    faceMesh?.material.dispose();
  };
  anim.update(0, 0, pose === 'attack' ? 'idle' : pose);
  return group;
}

const E = new THREE.Euler();
const Q = new THREE.Quaternion();

/** Procedural bone animation: idle personalities, attacks, cheer, slump, victory, walk. */
class ChibiAnimator {
  constructor({ bones, rest, asset, faceTex, unit, model }) {
    this.bones = bones;
    this.rest = rest;
    this.asset = asset;
    this.faceTex = faceTex;
    this.model = model;
    this.expression = asset.look.expression;
    this.style = asset.weaponStyle;
    this.phase = hashPhase(unit.id);
    this.attackT = -1;
    this.lastAttack = -10;
    this.blinkNext = 1.5 + this.phase;
    this.blinkT = -1;
    this.weights = { idle: 1, attack: 0, cheer: 0, disabled: 0, victory: 0, walk: 0 };
    this.time = 0;
    this.cell = -1;
    this.rot = bones.map(() => new THREE.Vector3());
  }

  playAttack() {
    this.attackT = 0;
    this.lastAttack = this.time;
  }

  update(time, dt, state) {
    this.time = time;
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    const target = this.weights[state] !== undefined ? state : 'idle';
    const k = dt > 0 ? 1 - Math.exp(-dt * 8) : 1;
    for (const key of Object.keys(this.weights)) {
      this.weights[key] += ((key === target ? 1 : 0) - this.weights[key]) * k;
    }
    if (state === 'attack' && this.attackT < 0 && time - this.lastAttack > 1.1) this.playAttack();
    if (this.attackT >= 0) {
      this.attackT += dt / this.style.duration;
      if (this.attackT >= 1) this.attackT = -1;
    }

    const R = this.rot;
    for (const r of R) r.set(0, 0, 0);
    const off = { y: 0, z: 0, x: 0 };
    let breathe = 1;
    let haloY = 0;
    let haloSpin = time * 0.6;
    const w = this.weights;
    const t = time + this.phase * 7;

    // ----- idle (personality) -----
    if (w.idle + w.attack > 0.001) {
      const wi = w.idle + w.attack;
      const b = Math.sin(t * 2.1);
      breathe = 1 + 0.018 * b * wi;
      R[BONES.head].z += Math.sin(t * 0.8) * 0.05 * wi;
      R[BONES.head].x += Math.sin(t * 1.05) * 0.02 * wi;
      R[BONES.armL].z += (0.06 + b * 0.02) * wi;
      R[BONES.armR].z -= (0.06 + b * 0.02) * wi;
      R[BONES.tailL].z += Math.sin(t * 1.7) * 0.05 * wi;
      R[BONES.tailR].z += Math.sin(t * 1.7 + 0.6) * 0.05 * wi;
      R[BONES.tailB].x += Math.sin(t * 1.4) * 0.04 * wi;
      switch (this.expression) {
        case 'cheerful': // bouncy, swinging arms
          off.y += Math.abs(Math.sin(t * 3.2)) * 0.06 * w.idle;
          R[BONES.armL].x += Math.sin(t * 3.2) * 0.25 * w.idle;
          R[BONES.armR].x -= Math.sin(t * 3.2) * 0.25 * w.idle;
          R[BONES.head].z += Math.sin(t * 3.2) * 0.06 * w.idle;
          break;
        case 'smug': // weight on one hip, head tilted, free hand on hip
          R[BONES.root].z += 0.04 * w.idle;
          R[BONES.head].z -= 0.12 * w.idle;
          R[BONES.armL].z += 0.35 * w.idle;
          R[BONES.armL].x += 0.25 * w.idle;
          break;
        case 'shy': // looks down and away, hands together in front
          R[BONES.head].x += 0.14 * w.idle;
          R[BONES.head].y += 0.18 * w.idle;
          R[BONES.armL].x -= 0.35 * w.idle;
          R[BONES.armL].z -= 0.25 * w.idle;
          R[BONES.armR].x -= 0.35 * w.idle;
          R[BONES.armR].z += 0.25 * w.idle;
          R[BONES.root].z += Math.sin(t * 0.9) * 0.025 * w.idle;
          break;
        case 'determined': // steady guard stance, slight forward lean
          R[BONES.chest].x += 0.06 * w.idle;
          R[BONES.armR].x -= 0.3 * w.idle;
          R[BONES.armL].x -= 0.15 * w.idle;
          off.y += Math.sin(t * 2.4) * 0.008 * w.idle;
          break;
        case 'calm': // slow sway, serene
          R[BONES.root].z += Math.sin(t * 0.7) * 0.03 * w.idle;
          R[BONES.head].z += Math.sin(t * 0.7 + 0.5) * 0.04 * w.idle;
          break;
        default: // smile: gentle rocking on the heels
          R[BONES.root].x += Math.sin(t * 1.3) * 0.025 * w.idle;
          R[BONES.head].z += Math.sin(t * 1.3) * 0.04 * w.idle;
      }
      // Weapon ready pose.
      const ready = this.style.ready;
      for (const [bone, axis, val] of ready) R[BONES[bone]][axis] += val * wi;
      if (w.attack > 0.01) {
        R[BONES.chest].x += 0.08 * w.attack;
        R[BONES.root].x += 0.04 * w.attack;
      }
    }

    // ----- one-shot attack (anticipation -> strike -> recovery) -----
    if (this.attackT >= 0) {
      const a = this.attackT;
      const curve = attackCurve(a);
      for (const [bone, axis, wind, strike] of this.style.keys) {
        R[BONES[bone]][axis] += wind * curve.wind + strike * curve.strike;
      }
      off.z += (this.style.lunge || 0) * curve.strike - (this.style.recoil || 0) * curve.recoilKick;
      R[BONES.root].x += (this.style.lean || 0) * curve.strike - (this.style.recoil || 0) * 0.6 * curve.recoilKick;
    }

    // ----- cheer: hop + arms up -----
    if (w.cheer > 0.001) {
      const hop = Math.abs(Math.sin(t * 5.2));
      off.y += hop * 0.22 * w.cheer;
      R[BONES.armL].z += (1.45 + Math.sin(t * 10.4) * 0.3) * w.cheer;
      R[BONES.armR].z -= (1.45 + Math.sin(t * 10.4 + 1) * 0.3) * w.cheer;
      R[BONES.armL].x -= 0.35 * w.cheer;
      R[BONES.armR].x -= 0.35 * w.cheer;
      R[BONES.legL].x += -hop * 0.25 * w.cheer;
      R[BONES.legR].x += hop * 0.15 * w.cheer;
      R[BONES.head].z += Math.sin(t * 5.2) * 0.12 * w.cheer;
      haloSpin += time * 2 * w.cheer;
    }

    // ----- victory: signature pose (weapon raised, wink-ish tilt) -----
    if (w.victory > 0.001) {
      const s = Math.sin(t * 2);
      R[BONES.armR].x -= 0.55 * w.victory;
      R[BONES.armR].z -= (1.55 + s * 0.06) * w.victory;
      R[BONES.armL].z += (0.5 + s * 0.08) * w.victory;
      R[BONES.armL].x -= 0.4 * w.victory;
      R[BONES.head].z += 0.16 * w.victory;
      R[BONES.root].z -= 0.05 * w.victory;
      off.y += Math.max(0, s) * 0.03 * w.victory;
    }

    // ----- walk -----
    if (w.walk > 0.001) {
      const s = Math.sin(t * 8);
      R[BONES.legL].x += s * 0.5 * w.walk;
      R[BONES.legR].x -= s * 0.5 * w.walk;
      R[BONES.armL].x -= s * 0.45 * w.walk;
      R[BONES.armR].x += s * 0.45 * w.walk;
      off.y += Math.abs(Math.cos(t * 8)) * 0.05 * w.walk;
      R[BONES.chest].x += 0.06 * w.walk;
    }

    // ----- disabled: slumped, dizzy -----
    if (w.disabled > 0.001) {
      const d = w.disabled;
      R[BONES.head].x += 0.42 * d;
      R[BONES.head].z += Math.sin(t * 1.6) * 0.12 * d;
      R[BONES.chest].x += 0.22 * d;
      R[BONES.armL].z -= 0.08 * d;
      R[BONES.armR].z += 0.08 * d;
      R[BONES.armL].x -= 0.1 * d;
      R[BONES.armR].x -= 0.1 * d;
      off.y -= 0.1 * d;
      breathe = breathe * (1 - d) + d * (1 + 0.01 * Math.sin(t));
      haloY -= 0.25 * d;
      haloSpin = haloSpin * (1 - d) + time * 0.1 * d;
    }

    // Hanging hair keeps hanging: counter part of the head's tilt.
    for (const tb of [BONES.tailB, BONES.tailL, BONES.tailR]) {
      R[tb].x -= R[BONES.head].x * 0.75;
      R[tb].z -= R[BONES.head].z * 0.75;
    }

    // Halo float.
    haloY += Math.sin(t * 1.6) * 0.07;

    // Apply to bones.
    const B = this.bones;
    for (let i = 0; i < B.length; i++) {
      const r = R[i];
      E.set(r.x, r.y, r.z, 'XYZ');
      B[i].quaternion.setFromEuler(E);
      B[i].position.copy(this.rest[i].pos);
    }
    B[BONES.root].position.y += off.y;
    B[BONES.root].position.z += off.z;
    B[BONES.chest].scale.set(1 + (breathe - 1) * 0.6, breathe, 1 + (breathe - 1) * 0.6);
    B[BONES.halo].position.y += haloY;
    Q.setFromAxisAngle(UP, haloSpin);
    B[BONES.halo].quaternion.multiply(Q);
    B[BONES.halo].quaternion.premultiply(HALO_TILT);

    // Face: blink / happy / dizzy.
    if (this.faceTex) {
      let cell = FACE_CELL.neutral;
      if (w.disabled > 0.5) cell = FACE_CELL.dizzy;
      else if (w.cheer > 0.5 || w.victory > 0.5) cell = FACE_CELL.happy;
      else {
        if (time >= this.blinkNext && this.blinkT < 0) this.blinkT = 0;
        if (this.blinkT >= 0) {
          this.blinkT += dt;
          cell = FACE_CELL.blink;
          if (this.blinkT > 0.12) {
            this.blinkT = -1;
            this.blinkNext = time + 2.2 + ((Math.sin(time * 12.9898 + this.phase) * 43758.5453) % 1 + 1) % 1 * 3;
          }
        }
      }
      if (cell !== this.cell) {
        this.cell = cell;
        setFaceCell(this.faceTex, cell);
      }
    }
  }
}

const UP = new THREE.Vector3(0, 1, 0);
const HALO_TILT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.32, 0, 0));

/** Attack timing: wind-up (0-0.3), strike (0.3-0.45), hold, recovery (to 1). */
function attackCurve(a) {
  const ease = (x) => x * x * (3 - 2 * x);
  let wind = 0;
  let strike = 0;
  if (a < 0.3) {
    wind = ease(a / 0.3);
  } else if (a < 0.45) {
    const s = ease((a - 0.3) / 0.15);
    wind = 1 - s;
    strike = s;
  } else if (a < 0.6) {
    strike = 1;
  } else {
    strike = 1 - ease((a - 0.6) / 0.4);
  }
  const recoilKick = a > 0.3 && a < 0.75 ? Math.sin(((a - 0.3) / 0.45) * Math.PI) : 0;
  return { wind, strike, recoilKick };
}

function hashPhase(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

export { REGION };

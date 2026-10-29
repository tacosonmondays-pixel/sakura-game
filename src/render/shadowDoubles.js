// Kage's Shadow Doubles in battle (display only: reads sim.deployables, never writes; src/sim/deploys.js).
// Each double is a second build of her own chibi (her outfit, the same model path as actors.js) dressed in
// shadow: every material cloned and tinted a deep violet, a little see-through, with a soft violet glow
// disc under her. She fades in where the sim put her, turns toward each throw (`doubleAttack` events: the
// double's facing comes from the sim) and fades out when the sim drops her. No new art files, no
// randomness: the bob phase comes from the double's uid.
//
//   const d = new ShadowDoubles({ sim, scene, batches, atlas, quality, skins });
//   d.update(dt)   // once per frame after actors.sync (adds and removes models, pushes the glow quads)
//   d.setQuality(q) / d.dispose()
import * as THREE from 'three';
import { buildChibi } from '../models/index.js';
import { lerpAngle } from './geo.js';

const SHADOW = new THREE.Color('#3a2a5c');
const RIM = new THREE.Color('#9d7bff');
const SCALE = 1.22; // the girls' TOWER_SCALE (actors.js)
const FADE_IN = 4; // 1 / s
const FADE_OUT = 3;

/**
 * Dresses a model in shadow: every material replaced by a tinted, slightly see-through copy (her textures stay
 * under the tint: the copies share them). The model's own materials are kept aside for release().
 */
function shade(model) {
  const orig = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false;
    const one = (m) => {
      if (!m) return m;
      orig.push(m);
      const c = m.clone();
      c.userData = { ...c.userData, shared: false };
      if (c.color) c.color.copy(o.userData.isOutline ? RIM : SHADOW);
      if (c.emissive) c.emissive.copy(SHADOW).multiplyScalar(0.35);
      c.transparent = true;
      c.opacity = 0;
      return c;
    };
    o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
  });
  model.userData.shadowOrig = orig;
  return model;
}

/** Frees a shaded model: its copies (never their shared textures), then her own materials as disposeObject would. */
function release(model) {
  model.userData.dispose?.();
  model.traverse((o) => {
    if (!o.isMesh) return;
    if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose?.();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m?.dispose?.();
  });
  for (const m of model.userData.shadowOrig || []) {
    if (!m || m.userData?.shared) continue;
    for (const k of ['map', 'alphaMap', 'emissiveMap']) if (m[k] && !m[k].userData?.shared) m[k].dispose?.();
    m.dispose?.();
  }
  model.removeFromParent();
}

function setOpacity(model, a) {
  model.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) if (m) m.opacity = a * (o.userData.isOutline ? 0.9 : 0.78);
  });
}

export class ShadowDoubles {
  /** @param {{ sim, scene: THREE.Scene, batches, atlas, quality: string, skins?: Object<string, string> }} o */
  constructor({ sim, scene, batches, atlas, quality, skins = {} }) {
    this.sim = sim;
    this.b = batches;
    this.R = atlas.regions;
    this.quality = quality;
    this.skins = skins || {};
    this.root = new THREE.Group();
    this.root.name = 'shadowDoubles';
    scene.add(this.root);
    this.list = new Map(); // double uid -> { model, a, gone, facing, phase }
    this.time = 0;
  }

  _create(d) {
    const t = this.sim.getTower?.(d.ownerUid);
    if (!t) return null;
    const model = shade(buildChibi(t.def, { quality: this.quality, skin: this.skins[t.unitId] }));
    model.position.set(d.x, 0.05, d.y);
    model.scale.setScalar(SCALE * 0.6);
    this.root.add(model);
    const v = { model, a: 0, gone: false, facing: d.facing || 0, phase: (d.uid * 1.37) % (Math.PI * 2) };
    this.list.set(d.uid, v);
    return v;
  }

  update(dt) {
    this.time += dt;
    const live = this.sim.deployables;
    const seen = new Set();
    if (live) {
      for (const d of live) {
        if (d.kind !== 'double') continue;
        seen.add(d.uid);
        const v = this.list.get(d.uid) || this._create(d);
        if (!v) continue;
        v.gone = false;
        v.a = Math.min(1, v.a + dt * FADE_IN);
        v.facing = lerpAngle(v.facing, d.facing || 0, Math.min(1, dt * 12));
      }
    }
    for (const [uid, v] of this.list) {
      if (!seen.has(uid)) {
        v.gone = true;
        v.a -= dt * FADE_OUT;
        if (v.a <= 0) {
          release(v.model);
          this.list.delete(uid);
          continue;
        }
      }
      const m = v.model;
      const k = Math.max(0, Math.min(1, v.a));
      m.scale.setScalar(SCALE * (0.6 + 0.4 * k));
      m.position.y = 0.05 + Math.sin(this.time * 2.4 + v.phase) * 0.03;
      m.rotation.y = v.facing;
      setOpacity(m, k);
      m.userData.animate?.(this.time, dt, 'idle');
      // a soft violet glow under her
      const R = this.R;
      if (this.b?.groundA && R?.glow) this.b.groundA.push(m.position.x, 0.06, m.position.z, 0.9, 0.9, R.glow, RIM.r, RIM.g, RIM.b, 0.45 * k);
    }
  }

  setQuality(q) {
    if (q === this.quality) return;
    this.quality = q;
    this.clear();
  }

  clear() {
    for (const v of this.list.values()) release(v.model);
    this.list.clear();
  }

  dispose() {
    this.clear();
    this.root.removeFromParent();
  }
}

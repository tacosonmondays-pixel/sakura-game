// Placement & selection overlays (free placement, Bloons-style): range circles, the
// placement ghost (translucent girl + footprint disc at a continuous position, red + shake
// when invalid), the forbidden-zone shading while a card is picked (path band, obstacles,
// wrong terrain and other girls' footprints tinted soft red; allowed ground stays clear) and
// the selected-tower highlight.
import * as THREE from 'three';
import { buildChibi, disposeObject } from '../models/index.js';
import { footprintRadius } from '../sim/placement.js';
import { WATER_Y, PATH_H } from './terrain.js';

const RANGE_VERT = /* glsl */`
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const RANGE_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uRadius;
uniform float uTime;
uniform float uAlpha;
varying vec2 vP;
void main() {
  float d = length(vP) * uRadius;           // world distance from centre
  float edge = uRadius - d;                  // >0 inside
  if (edge < -0.02) discard;
  float rim = smoothstep(0.075, 0.0, abs(edge - 0.04));
  float ang = atan(vP.y, vP.x);
  float count = max(8.0, floor(6.2831 * uRadius / 0.35));
  float dash = step(0.45, fract(ang / 6.2831 * count - uTime * 0.4));
  float inner = smoothstep(uRadius, uRadius * 0.15, d);
  float fill = 0.1 + 0.1 * (1.0 - inner);
  float a = max(fill, rim * (0.65 + 0.35 * dash));
  gl_FragColor = vec4(uColor, a * uAlpha);
  #include <colorspace_fragment>
}`;

// Forbidden-zone mask: R = 1 where the picked girl cannot stand. Sampled with bilinear
// filtering so the edge of the band is soft; a brighter rim marks the boundary.
const ZONE_VERT = /* glsl */`
varying vec2 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const ZONE_FRAG = /* glsl */`
uniform sampler2D uMask;
uniform vec4 uRect;   // x0 y0 w h (world)
uniform vec3 uColor;
uniform vec3 uRim;
uniform float uAlpha;
uniform float uTime;
varying vec2 vWorld;
void main() {
  vec2 uv = (vWorld - uRect.xy) / uRect.zw;
  float m = texture2D(uMask, uv).r;
  float fill = smoothstep(0.38, 0.62, m);
  float rim = 1.0 - smoothstep(0.0, 0.13, abs(m - 0.5));
  // slow drifting diagonal stripes inside the forbidden zone (reads as "no-go" at a glance)
  float stripe = 0.5 + 0.5 * sin((vWorld.x - vWorld.y) * 9.0 + uTime * 1.2);
  float a = fill * (0.36 + 0.07 * stripe) + rim * 0.5;
  vec3 col = mix(uColor, uRim, rim * 0.85);
  gl_FragColor = vec4(col, a * uAlpha);
  #include <colorspace_fragment>
}`;

/** Texels per tile of the forbidden-zone mask. */
const MASK_PX = 8;
/** Tiles of margin shaded around the board (out of bounds). */
const MASK_MARGIN = 1;
/** Ghost shake duration (s) and amplitude (tiles). */
const SHAKE_T = 0.42;
const SHAKE_AMP = 0.085;

/** Creates a flat range circle mesh (unit plane scaled by radius). */
function rangeCircle() {
  const geo = new THREE.PlaneGeometry(2, 2); // local xy = unit disc coords; mesh is laid flat
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#ffffff') }, uRadius: { value: 1 }, uTime: { value: 0 }, uAlpha: { value: 1 } },
    vertexShader: RANGE_VERT,
    fragmentShader: RANGE_FRAG,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 5;
  mesh.visible = false;
  mesh.frustumCulled = false;
  return mesh;
}

export class Overlays {
  /** @param {{ sim, scene, actors, terrain, batches, atlas, quality }} o */
  constructor({ sim, scene, actors, terrain, batches, atlas, quality }) {
    this.sim = sim;
    this.scene = scene;
    this.actors = actors;
    this.terrain = terrain;
    this.b = batches;
    this.R = atlas.regions;
    this.quality = quality;
    this.root = new THREE.Group();
    this.root.name = 'overlays';
    scene.add(this.root);
    this.selRange = rangeCircle();
    this.ghostRange = rangeCircle();
    this.root.add(this.selRange, this.ghostRange);
    this.selectedUid = null;
    this._hlModel = null;
    this.ghost = null; // { unitId, model, mats, def, x, y, valid, radius }
    this.ghostShake = 0;
    this.hintUnit = null;
    this.time = 0;

    // forbidden-zone plane (map + margin)
    const W = sim.map.width;
    const H = sim.map.height;
    const mw = (W + MASK_MARGIN * 2) * MASK_PX;
    const mh = (H + MASK_MARGIN * 2) * MASK_PX;
    this.maskW = mw;
    this.maskH = mh;
    this.maskData = new Uint8Array(mw * mh * 4);
    this.maskTex = new THREE.DataTexture(this.maskData, mw, mh, THREE.RGBAFormat);
    this.maskTex.magFilter = THREE.LinearFilter;
    this.maskTex.minFilter = THREE.LinearFilter;
    this.maskTex.wrapS = THREE.ClampToEdgeWrapping;
    this.maskTex.wrapT = THREE.ClampToEdgeWrapping;
    this.maskTex.needsUpdate = true;
    const rect = new THREE.Vector4(-MASK_MARGIN, -MASK_MARGIN, W + MASK_MARGIN * 2, H + MASK_MARGIN * 2);
    this.zoneMat = new THREE.ShaderMaterial({
      uniforms: {
        uMask: { value: this.maskTex },
        uRect: { value: rect },
        uColor: { value: new THREE.Color('#ff2a4f') },
        uRim: { value: new THREE.Color('#ffc4cf') },
        uAlpha: { value: 1 },
        uTime: { value: 0 },
      },
      vertexShader: ZONE_VERT,
      fragmentShader: ZONE_FRAG,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const zoneGeo = new THREE.PlaneGeometry(rect.z, rect.w);
    zoneGeo.rotateX(-Math.PI / 2);
    zoneGeo.translate(rect.x + rect.z / 2, 0, rect.y + rect.w / 2);
    this.zone = new THREE.Mesh(zoneGeo, this.zoneMat);
    this.zone.position.y = PATH_H + 0.012;
    this.zone.renderOrder = 4;
    this.zone.visible = false;
    this.zone.frustumCulled = false;
    this.root.add(this.zone);
  }

  setQuality(q) {
    this.quality = q;
    if (this.ghost) {
      const { unitId, x, y, valid } = this.ghost;
      this._clearGhostModel();
      this.ghost = null;
      this.setGhost(unitId, x, y, valid);
    }
  }

  /** Tower range in tiles (effective stats when available). */
  _towerRange(uid) {
    const t = this.sim.getTower ? this.sim.getTower(uid) : this.sim.towers.find((x) => x.uid === uid);
    if (!t) return 0;
    return t.eff?.range ?? t.stats?.range ?? t.def?.base?.range ?? 0;
  }

  setSelected(uid) {
    if (this.selectedUid != null) this.actors.setHighlight(this.selectedUid, false);
    this.selectedUid = uid ?? null;
    this._hlModel = null;
    this._applyHighlight();
  }

  /** (Re)applies the highlight — the model may be created or rebuilt after selection. */
  _applyHighlight() {
    if (this.selectedUid == null) return;
    const model = this.actors.towerView(this.selectedUid)?.model || null;
    if (model && model !== this._hlModel) {
      this.actors.setHighlight(this.selectedUid, true);
      this._hlModel = model;
    }
  }

  _clearGhostModel() {
    if (this.ghost?.model) {
      this.root.remove(this.ghost.model);
      for (const m of this.ghost.mats) m.dispose();
      disposeObject(this.ghost.model);
    }
  }

  /** Terrain under a world point is water (ghost / marker height). */
  _waterAt(x, y) {
    return this.terrain.isWater(Math.floor(x), Math.floor(y));
  }

  /**
   * Shows the placement preview for `unitId` with its footprint centred at world (x, y)
   * (continuous, no snapping). `null` hides it.
   */
  setGhost(unitId, x, y, valid) {
    if (!unitId) {
      this._clearGhostModel();
      this.ghost = null;
      this.ghostShake = 0;
      this.ghostRange.visible = false;
      return;
    }
    if (!this.ghost || this.ghost.unitId !== unitId) {
      this._clearGhostModel();
      const def = this.sim.data?.unit?.(unitId) || this.sim.towers.find((t) => t.unitId === unitId)?.def;
      let model = null;
      const mats = [];
      if (def) {
        model = buildChibi(def, { quality: this.quality === 'high' ? 'medium' : this.quality });
        model.traverse((o) => {
          if (!o.isMesh) return;
          const src = o.material;
          const m = src.clone();
          // keep shader hooks (inverted-hull outlines extrude in onBeforeCompile)
          if (src.onBeforeCompile) m.onBeforeCompile = src.onBeforeCompile;
          if (src.customProgramCacheKey) m.customProgramCacheKey = src.customProgramCacheKey;
          m.userData = {};
          m.transparent = true;
          m.opacity = o.userData.isOutline ? 0.35 : 0.72;
          m.depthWrite = !o.userData.isOutline;
          o.material = m;
          mats.push(m);
        });
        this.root.add(model);
      }
      this.ghost = { unitId, model, mats, def, x, y, valid, radius: footprintRadius(def) };
      this.ghostShake = 0;
    }
    const g = this.ghost;
    g.x = x;
    g.y = y;
    g.valid = !!valid;
    const inMap = Number.isFinite(x) && Number.isFinite(y);
    const water = inMap && this._waterAt(x, y);
    if (g.model) {
      g.model.visible = inMap;
      if (inMap) g.model.position.set(x, (water ? WATER_Y : 0) + 0.12, y);
      for (const m of g.mats) m.color?.set(g.valid ? '#ffffff' : '#ff8a8a');
    }
    const range = g.def ? this._baseRange(g.def) : 0;
    this.ghostRange.visible = inMap && range > 0;
    if (inMap) this.ghostRange.position.set(x, (water ? WATER_Y : PATH_H) + 0.03, y);
    this.ghostRange.scale.setScalar(range);
    this.ghostRange.material.uniforms.uRadius.value = range;
    this.ghostRange.material.uniforms.uColor.value.set(g.valid ? '#ffffff' : '#ff4d6d');
  }

  /** Wobbles the ghost sideways for a moment (rejected drop). */
  shakeGhost() {
    if (this.ghost) this.ghostShake = SHAKE_T;
  }

  _baseRange(def) {
    const stats = this.sim.loadout?.get?.(def.id) || this.sim.heroConfig?.stats || {};
    return (def.base?.range || 0) * (stats.rangeMul || 1);
  }

  /** Shades everywhere `unitId` could NOT stand (ignores cash); null clears. */
  showTileHints(unitId) {
    this.hintUnit = unitId || null;
    this.refreshHints();
  }

  refreshHints() {
    const unitId = this.hintUnit;
    if (!unitId || typeof this.sim.placementReason !== 'function') {
      this.zone.visible = false;
      return;
    }
    const sim = this.sim;
    const data = this.maskData;
    const w = this.maskW;
    const h = this.maskH;
    for (let j = 0; j < h; j++) {
      const y = (j + 0.5) / MASK_PX - MASK_MARGIN;
      for (let i = 0; i < w; i++) {
        const x = (i + 0.5) / MASK_PX - MASK_MARGIN;
        const reason = sim.placementReason(unitId, x, y);
        const v = reason ? 255 : 0;
        const k = (j * w + i) * 4;
        data[k] = v;
        data[k + 1] = v;
        data[k + 2] = v;
        data[k + 3] = 255;
      }
    }
    this.maskTex.needsUpdate = true;
    this.zone.visible = true;
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    this.zoneMat.uniforms.uTime.value = t;
    this.zoneMat.uniforms.uAlpha.value = 0.86 + 0.14 * Math.sin(t * 2.2);
    // selected tower
    const uid = this.selectedUid;
    const tower = uid != null ? (this.sim.getTower ? this.sim.getTower(uid) : this.sim.towers.find((x) => x.uid === uid)) : null;
    if (uid != null && !tower) this.setSelected(null);
    if (tower) {
      this._applyHighlight();
      const range = this._towerRange(uid);
      const v = this.actors.towerView(uid);
      const y = v?.water ? WATER_Y + 0.04 : PATH_H + 0.03;
      this.selRange.visible = range > 0;
      this.selRange.position.set(tower.x, y, tower.y);
      this.selRange.scale.setScalar(range);
      this.selRange.material.uniforms.uRadius.value = range;
      this.selRange.material.uniforms.uColor.value.set('#ffffff');
      const fr = (tower.radius || 0.42) * 2.3;
      this.b.groundA.push(tower.x, y + 0.01, tower.y, fr, fr, this.R.ringThick, 0.55, 0.85, 1, 0.9, t * 1.5);
      this.b.overlay.push(tower.x, 1.35 + Math.sin(t * 4) * 0.06, tower.y, 0.22, 0.22, this.R.chevron, 1, 0.85, 0.3, 1, -Math.PI / 2);
    } else {
      this.selRange.visible = false;
    }
    this.selRange.material.uniforms.uTime.value = t;
    this.ghostRange.material.uniforms.uTime.value = t;
    // ghost footprint marker + bob + shake
    const g = this.ghost;
    if (g && Number.isFinite(g.x) && Number.isFinite(g.y)) {
      let sx = 0;
      if (this.ghostShake > 0) {
        this.ghostShake = Math.max(0, this.ghostShake - dt);
        const k = this.ghostShake / SHAKE_T;
        sx = Math.sin((SHAKE_T - this.ghostShake) * 52) * SHAKE_AMP * k;
      }
      const water = this._waterAt(g.x, g.y);
      const y = (water ? WATER_Y : PATH_H) + 0.035;
      const c = g.valid ? [0.55, 1, 0.65] : [1, 0.3, 0.38];
      const d = g.radius * 2;
      const px = g.x + sx;
      this.b.groundN.push(px, y, g.y, d, d, this.R.disc, c[0], c[1], c[2], 0.42 + 0.1 * Math.sin(t * 6));
      this.b.groundA.push(px, y + 0.005, g.y, d * 1.1, d * 1.1, this.R.ring, c[0], c[1], c[2], 0.9);
      if (!g.valid) {
        // crossed-out feel: a second thin ring pulsing outward
        const ph = (t * 1.6) % 1;
        this.b.groundA.push(px, y + 0.006, g.y, d * (1.1 + ph * 0.5), d * (1.1 + ph * 0.5), this.R.ring, 1, 0.3, 0.38, 0.6 * (1 - ph));
      }
      if (g.model) {
        g.model.position.x = px;
        g.model.position.y = (water ? WATER_Y : 0) + 0.12 + Math.sin(t * 5) * 0.04;
        g.model.userData.animate?.(t, dt, 'idle');
      }
      this.ghostRange.position.x = px;
    }
  }

  dispose() {
    this._clearGhostModel();
    for (const r of [this.selRange, this.ghostRange]) {
      r.geometry.dispose();
      r.material.dispose();
    }
    this.zone.geometry.dispose();
    this.zoneMat.dispose();
    this.maskTex.dispose();
    this.scene.remove(this.root);
  }
}

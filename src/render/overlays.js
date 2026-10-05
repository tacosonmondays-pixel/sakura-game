// Placement & selection overlays: range circles, the placement ghost (translucent girl +
// tile marker, red when invalid), valid-tile hints for land / water girls and the
// selected-tower highlight.
import * as THREE from 'three';
import { buildChibi, disposeObject } from '../models/index.js';
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
    this.ghost = null; // { unitId, model, tx, ty, valid }
    this.hintUnit = null;
    this.time = 0;

    const tileGeo = new THREE.PlaneGeometry(0.9, 0.9);
    tileGeo.rotateX(-Math.PI / 2);
    this.hintGeo = tileGeo;
    this.hintMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false });
    this.hints = new THREE.InstancedMesh(tileGeo, this.hintMat, Math.max(1, sim.map.width * sim.map.height));
    this.hints.count = 0;
    this.hints.visible = false;
    this.hints.renderOrder = 4;
    this.hints.frustumCulled = false;
    this.root.add(this.hints);
  }

  setQuality(q) {
    this.quality = q;
    if (this.ghost) {
      const { unitId, tx, ty, valid } = this.ghost;
      this._clearGhostModel();
      this.ghost = null;
      this.setGhost(unitId, tx, ty, valid);
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

  setGhost(unitId, tx, ty, valid) {
    if (!unitId) {
      this._clearGhostModel();
      this.ghost = null;
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
      this.ghost = { unitId, model, mats, def, tx, ty, valid };
    }
    const g = this.ghost;
    g.tx = tx;
    g.ty = ty;
    g.valid = !!valid;
    const inMap = tx >= 0 && ty >= 0 && tx < this.sim.map.width && ty < this.sim.map.height;
    const water = inMap && this.terrain.isWater(tx, ty);
    if (g.model) {
      g.model.visible = inMap;
      g.model.position.set(tx + 0.5, (water ? WATER_Y : 0) + 0.12, ty + 0.5);
      for (const m of g.mats) m.color?.set(g.valid ? '#ffffff' : '#ff8a8a');
    }
    const range = g.def ? this._baseRange(g.def) : 0;
    this.ghostRange.visible = inMap && range > 0;
    this.ghostRange.position.set(tx + 0.5, (water ? WATER_Y : PATH_H) + 0.03, ty + 0.5);
    this.ghostRange.scale.setScalar(range);
    this.ghostRange.material.uniforms.uRadius.value = range;
    this.ghostRange.material.uniforms.uColor.value.set(g.valid ? '#ffffff' : '#ff4d6d');
  }

  _baseRange(def) {
    const stats = this.sim.loadout?.get?.(def.id) || this.sim.heroConfig?.stats || {};
    return (def.base?.range || 0) * (stats.rangeMul || 1);
  }

  /** Tints tiles where `unitId` could stand (ignores cash). */
  showTileHints(unitId) {
    this.hintUnit = unitId || null;
    this.refreshHints();
  }

  refreshHints() {
    const unitId = this.hintUnit;
    if (!unitId) {
      this.hints.visible = false;
      this.hints.count = 0;
      return;
    }
    const sim = this.sim;
    const m = new THREE.Matrix4();
    const land = new THREE.Color('#bfffcf');
    const water = new THREE.Color('#7fe8ff');
    let n = 0;
    for (let ty = 0; ty < sim.map.height; ty++) {
      for (let tx = 0; tx < sim.map.width; tx++) {
        const r = sim.canPlace(unitId, tx, ty);
        if (!r.ok && r.reason !== 'cash') continue;
        const isW = this.terrain.isWater(tx, ty);
        m.makeTranslation(tx + 0.5, isW ? WATER_Y + 0.025 : 0.02, ty + 0.5);
        this.hints.setMatrixAt(n, m);
        this.hints.setColorAt(n, isW ? water : land);
        n++;
      }
    }
    this.hints.count = n;
    this.hints.instanceMatrix.needsUpdate = true;
    if (this.hints.instanceColor) this.hints.instanceColor.needsUpdate = true;
    this.hints.visible = n > 0;
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    this.hintMat.opacity = 0.22 + 0.12 * Math.sin(t * 4);
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
      this.b.groundA.push(tower.x, y + 0.01, tower.y, 1.0, 1.0, this.R.ringThick, 0.55, 0.85, 1, 0.9, t * 1.5);
      this.b.overlay.push(tower.x, 1.35 + Math.sin(t * 4) * 0.06, tower.y, 0.22, 0.22, this.R.chevron, 1, 0.85, 0.3, 1, -Math.PI / 2);
    } else {
      this.selRange.visible = false;
    }
    this.selRange.material.uniforms.uTime.value = t;
    this.ghostRange.material.uniforms.uTime.value = t;
    // ghost tile marker + bob
    const g = this.ghost;
    if (g) {
      const inMap = g.tx >= 0 && g.ty >= 0 && g.tx < this.sim.map.width && g.ty < this.sim.map.height;
      if (inMap) {
        const water = this.terrain.isWater(g.tx, g.ty);
        const y = (water ? WATER_Y : PATH_H) + 0.035;
        const c = g.valid ? [0.55, 1, 0.65] : [1, 0.3, 0.38];
        this.b.groundN.push(g.tx + 0.5, y, g.ty + 0.5, 0.96, 0.96, this.R.white, c[0], c[1], c[2], 0.35 + 0.1 * Math.sin(t * 6));
        this.b.groundA.push(g.tx + 0.5, y + 0.005, g.ty + 0.5, 1.0, 1.0, this.R.ring, c[0], c[1], c[2], 0.8);
        if (g.model) {
          g.model.position.y = (water ? WATER_Y : 0) + 0.12 + Math.sin(t * 5) * 0.04;
          g.model.userData.animate?.(t, dt, 'idle');
        }
      }
    }
  }

  dispose() {
    this._clearGhostModel();
    for (const r of [this.selRange, this.ghostRange]) {
      r.geometry.dispose();
      r.material.dispose();
    }
    this.hintGeo.dispose();
    this.hintMat.dispose();
    this.hints.dispose();
    this.scene.remove(this.root);
  }
}

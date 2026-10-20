// Placement & selection overlays (free placement): range circles, the
// placement ghost (translucent girl with a small circle under her — white where she can
// stand, red where she can't; no zone shading) and the selected-tower highlight.
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

/** Roam ring (how far a girl's drones may fly) and signal ring (where flight points may go). */
const ROAM_COLOR = '#4cc9f0';
const SIGNAL_COLOR = '#ffb703';

/** "She is here" pulse ring duration (s). */
const PULSE_T = 1.2;
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
    // drone owners: how far her wing may fly (cyan) and, while flight points are picked, her
    // signal range (amber)
    this.roamRing = rangeCircle();
    this.signalRing = rangeCircle();
    this.roamRing.material.uniforms.uColor.value.set(ROAM_COLOR);
    this.roamRing.material.uniforms.uAlpha.value = 0.85;
    this.signalRing.material.uniforms.uColor.value.set(SIGNAL_COLOR);
    this.root.add(this.selRange, this.ghostRange, this.roamRing, this.signalRing);
    this.selectedUid = null;
    this.selectedDrone = null;
    this.flightPreview = null; // { uid, mode, a } while Hold / Patrol points are picked
    this._hlModel = null;
    this.ghost = null; // { unitId, model, mats, def, x, y, valid, radius }
    this.ghostShake = 0;
    this.showGhostRange = true;
    this.time = 0;
    /** uid → seconds left of a "she is here" pulse ring (pulseTower). */
    this.pulses = new Map();
  }

  /** A 1.2 s pulse ring on a girl (e.g. "Show ›" on a locked final tier). */
  pulseTower(uid) {
    if (uid != null) this.pulses.set(uid, PULSE_T);
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

  setSelected(uid, droneUid = null) {
    if (this.selectedUid != null) this.actors.setHighlight(this.selectedUid, false);
    this.selectedUid = uid ?? null;
    this.selectedDrone = uid != null ? droneUid ?? null : null;
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
        model = buildChibi(def, { quality: this.quality === 'high' ? 'medium' : this.quality, skin: this.actors?.skins?.[unitId] });
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
    }
    const range = g.def ? this._baseRange(g.def) : 0;
    this.ghostRange.visible = inMap && range > 0 && this.showGhostRange;
    if (inMap) this.ghostRange.position.set(x, (water ? WATER_Y : PATH_H) + 0.03, y);
    this.ghostRange.scale.setScalar(range);
    this.ghostRange.material.uniforms.uRadius.value = range;
    // the range stays neutral; only the small circle under her turns red (owner request)
    this.ghostRange.material.uniforms.uColor.value.set('#ffffff');
  }

  /** Wobbles the ghost sideways for a moment (rejected drop). */
  shakeGhost() {
    if (this.ghost) this.ghostShake = SHAKE_T;
  }

  _baseRange(def) {
    const stats = this.sim.loadout?.get?.(def.id) || this.sim.heroConfig?.stats || {};
    return (def.base?.range || 0) * (stats.rangeMul || 1);
  }

  /** Kept for API compatibility: free placement shows no zone shading (owner request). */
  showTileHints() {}

  refreshHints() {}

  update(dt) {
    this.time += dt;
    const t = this.time;
    // selected tower
    const uid = this.selectedUid;
    const tower = uid != null ? (this.sim.getTower ? this.sim.getTower(uid) : this.sim.towers.find((x) => x.uid === uid)) : null;
    if (uid != null && !tower) this.setSelected(null);
    if (tower) {
      this._applyHighlight();
      // map rules (blizzard, heat haze, crystal pads) change a girl's range mid-wave: the ring eases
      // to the new radius over about 0.3 s instead of jumping (a new selection snaps)
      const target = this._towerRange(uid);
      if (this._ringUid !== uid || !(this._ringRange > 0)) this._ringRange = target;
      else this._ringRange += (target - this._ringRange) * (1 - Math.exp(-10 * dt));
      this._ringUid = uid;
      const range = this._ringRange;
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
      this._drawWing(tower, y, t);
    } else {
      this.selRange.visible = false;
      this.roamRing.visible = false;
      this.signalRing.visible = false;
    }
    this.roamRing.material.uniforms.uTime.value = t;
    this.signalRing.material.uniforms.uTime.value = -t;
    // pulse rings: two expanding rings over 1.2 s on the girl the UI points at
    for (const [puid, left] of this.pulses) {
      const pt = this.sim.getTower ? this.sim.getTower(puid) : null;
      const nl = left - dt;
      if (!pt || nl <= 0) {
        this.pulses.delete(puid);
        continue;
      }
      this.pulses.set(puid, nl);
      const v = this.actors.towerView(puid);
      const py = (v?.water ? WATER_Y + 0.05 : PATH_H + 0.04);
      for (const ph of [0, 0.5]) {
        const k = ((PULSE_T - nl) / PULSE_T * 2 + ph) % 1;
        const d = (pt.radius || 0.42) * (2 + k * 3.2);
        this.b.groundA.push(pt.x, py, pt.y, d, d, this.R.ringThick, 1, 0.78, 0.25, (1 - k) * 0.95, 0);
      }
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
      // small circle under her: white = can stand here, red = can't
      const c = g.valid ? [1, 1, 1] : [1, 0.08, 0.16];
      const d = g.radius * 2;
      const px = g.x + sx;
      this.b.groundN.push(px, y, g.y, d, d, this.R.disc, c[0], c[1], c[2], g.valid ? 0.32 : 0.62);
      this.b.groundA.push(px, y + 0.005, g.y, d * 1.08, d * 1.08, this.R.ring, c[0], c[1], c[2], 0.95);
      if (g.model) {
        g.model.position.x = px;
        g.model.position.y = (water ? WATER_Y : 0) + 0.12 + Math.sin(t * 5) * 0.04;
        g.model.userData.animate?.(t, dt, 'idle');
      }
      this.ghostRange.position.x = px;
    }
  }

  /**
   * A selected drone owner: the roam ring (where her wing may fly: around her, the Hold point or
   * the Patrol position; none in Pursuit), the flight points, her signal ring while points are
   * picked, and for a selected drone a ring under it, a tether to her and a reticle on its quarry.
   */
  _drawWing(tower, y, t) {
    const info = tower.turretSpec?.leash > 0 ? this.sim.flightInfo?.(tower.uid) : null;
    if (!info) {
      this.roamRing.visible = false;
      this.signalRing.visible = false;
      return;
    }
    const b = this.b;
    const R = this.R;
    const ring = (mesh, x, z, r) => {
      mesh.visible = r > 0 && Number.isFinite(r);
      if (!mesh.visible) return;
      mesh.position.set(x, y + 0.005, z);
      mesh.scale.setScalar(r);
      mesh.material.uniforms.uRadius.value = r;
    };
    if (info.mode === 'pursuit') this.roamRing.visible = false;
    else ring(this.roamRing, info.at[0], info.at[1], info.roam);
    const marker = (x, z, label) => {
      b.groundA.push(x, y + 0.02, z, 0.7, 0.7, R.ringDashed, 0.3, 0.8, 0.95, 0.95, t);
      b.groundN.push(x, y + 0.015, z, 0.36, 0.36, R.disc, 0.3, 0.8, 0.95, 0.5);
      if (label) b.overlay.push(x, 0.55, z, 0.2, 0.2, R.chevron, 0.3, 0.8, 0.95, 0.95, -Math.PI / 2);
    };
    const dotted = (x0, z0, x1, z1, h, rgb, a) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.min(60, Math.floor(len / 0.35));
      for (let i = 1; i < n; i++) {
        const f = i / n;
        b.groundN.push(x0 + (x1 - x0) * f, h, z0 + (z1 - z0) * f, 0.1, 0.1, R.dot, rgb[0], rgb[1], rgb[2], a);
      }
    };
    if (info.mode === 'hold' && info.a) marker(info.a[0], info.a[1], true);
    if (info.mode === 'patrol' && info.a && info.b) {
      marker(info.a[0], info.a[1], true);
      marker(info.b[0], info.b[1], true);
      dotted(info.a[0], info.a[1], info.b[0], info.b[1], y + 0.02, [0.3, 0.8, 0.95], 0.8);
    }
    // picking flight points: her signal ring and the first patrol point
    const pv = this.flightPreview;
    if (pv && pv.uid === tower.uid) {
      ring(this.signalRing, tower.x, tower.y, info.signal);
      if (pv.a) marker(pv.a[0], pv.a[1], false);
    } else this.signalRing.visible = false;
    // a selected drone: her range ring steps back for the roam ring; ring, tether and reticle
    const d = this.selectedDrone != null ? tower.turrets.find((x) => x.uid === this.selectedDrone) : null;
    this.selRange.visible = this.selRange.visible && !d;
    if (d) {
      const at = this.actors.droneDrawn.get(d.uid) || { x: d.x, y: d.y };
      b.groundA.push(at.x, y + 0.02, at.y, 0.56, 0.56, R.ringThick, 0.3, 0.8, 0.95, 0.95, t * 2);
      dotted(tower.x, tower.y, at.x, at.y, y + 0.02, [0.3, 0.8, 0.95], 0.4);
      const q = d.tgt && !d.tgt.dead ? d.tgt : null;
      if (q) b.groundA.push(q.x, y + 0.03, q.y, 0.8, 0.8, R.ringDashed, 1, 0.45, 0.35, 0.9, -t * 2);
    }
  }

  dispose() {
    this._clearGhostModel();
    for (const r of [this.selRange, this.ghostRange, this.roamRing, this.signalRing]) {
      r.geometry.dispose();
      r.material.dispose();
    }
    this.scene.remove(this.root);
  }
}

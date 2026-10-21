// Companion actors in battle (display only: reads the sim's towers and drained events, never writes):
//   Kon (Ruri)    sits by her; runs along the ground to her relay origin (t.ox / t.oy) and sits there;
//                 her bolts leap out of him (attack clip); runs back when the spot goes away
//   Kaze (Hana)   perches on her left shoulder (rides her shoulder bone); on her attacks he swoops to the
//                 target and back in a short arc, one swoop at a time
//   the doll      (Yoriko) floats in front of her raised hand on glowing threads that stay tied to her
//                 control bar; dashes at the target and back on her needles and on Dream Detour
// One actor per placed girl who has a companion (co-op partners' girls too: they are in the shared sim);
// 'appear' plays when she is placed, the actor goes when she is sold. Models and the manifest contract:
// src/models/companions.js. Rules (pure): ./companionLogic.js.
//
//   const c = new Companions({ sim, scene, actors, terrain, quality });
//   c.handle(ev)      // every drained sim event (observes only, never consumes)
//   c.update(dt, zoom) // once per frame after actors.sync
import * as THREE from 'three';
import {
  loadCompanionManifest, companionOf, companionEntry, loadCompanion, getCompanion, buildCompanion, HomeAnchor, boneAtIdle,
} from '../models/companions.js';
import { disposeObject } from '../models/index.js';
import { lerpAngle } from './geo.js';
import { WATER_Y, PATH_H } from './terrain.js';
import {
  konState, konStep, konSpot, konAttacks, sortieState, startSortie, retarget, sortieStep, reconcile,
  SWOOP_TIME, SWOOP_LIFT, DASH_TIME, DASH_REACH, DASH_STOP, DASH_LIFT,
} from './companionLogic.js';

/** Zoom at which the full-detail files take over from the LOD ones (quality high only), with hysteresis. */
const FULL_AT = 2.0;
const LOD_AT = 1.7;
const KON_HOLD = 0.5; // his appear clip, then he may run

const _home = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _bar = new THREE.Vector3();
const _spot = { x: 0, z: 0 };
const _pos = { x: 0, y: 0, z: 0, out: false };

export class Companions {
  /** @param {{ sim, scene: THREE.Scene, actors, terrain, quality: string }} o */
  constructor({ sim, scene, actors, terrain, quality }) {
    this.sim = sim;
    this.actors = actors;
    this.terrain = terrain;
    this.quality = quality;
    this.root = new THREE.Group();
    this.root.name = 'companions';
    scene.add(this.root);
    this.list = new Map(); // tower uid -> actor
    this.ready = false;
    this.disposed = false;
    this.frame = 0;
    this.time = 0;
    this.zoom = 1;
    this.detail = 'lod';
    this.requested = new Set(); // `${cid}|${detail}` loads asked for
    this._make = (t, cid) => this._create(t, cid);
    this._drop = (a) => this._dispose(a);
    this._of = (unitId) => companionOf(unitId);
    loadCompanionManifest().then((m) => {
      if (!this.disposed) this.ready = !!m;
    });
  }

  /** Off at the lowest graphics setting (Kon falls back to rosterFx's procedural holo fox). */
  get enabled() {
    return this.ready && this.quality !== 'low';
  }

  setQuality(q) {
    if (q === this.quality) return;
    this.quality = q;
    // girls' views are rebuilt at the new detail too; companions follow on the next update
    this.clear();
  }

  /** Drops every companion (they are recreated from the sim on the next update). */
  clear() {
    for (const a of this.list.values()) this._dispose(a);
    this.list.clear();
  }

  // ---- queries (rosterFx, attackFx) ---------------------------------------------------------

  /** True when a companion figure is drawn for this girl. */
  has(uid) {
    return !!this.list.get(uid)?.group;
  }

  /** Where Kon is drawn for Ruri `uid` ({ x, z, h: muzzle height, away: not by her side }) or null. */
  konAt(uid) {
    const a = this.list.get(uid);
    if (!a || a.cid !== 'kon' || !a.group) return null;
    return a.kon.view;
  }

  /** Test / e2e probe: one row per actor. */
  probe() {
    const rows = [];
    for (const [uid, a] of this.list) {
      const g = a.group;
      rows.push({
        uid, cid: a.cid, unitId: a.unitId, detail: a.detail, visible: !!g?.visible, x: g ? +g.position.x.toFixed(3) : null,
        y: g ? +g.position.y.toFixed(3) : null, z: g ? +g.position.z.toFixed(3) : null, mode: a.kon ? a.kon.s.mode : (a.sortie?.busy ? 'sortie' : 'home'),
        homeX: +a.home.x.toFixed(3), homeY: +a.home.y.toFixed(3), homeZ: +a.home.z.toFixed(3), scale: g ? +g.scale.x.toFixed(3) : null,
        battleScale: a.battleScale,
        target: a.sortie?.busy ? [+a.sortie.tx.toFixed(3), +a.sortie.ty.toFixed(3), +a.sortie.tz.toFixed(3)] : null, height: a.height ?? null,
        // what set the sortie off: the enemy her attack hit (uid), null for a point (Dream Detour's centre)
        targetUid: a.sortie?.busy ? (a.sortie.uid ?? null) : null,
      });
    }
    return { enabled: this.enabled, quality: this.quality, detail: this.detail, actors: rows };
  }

  // ---- events --------------------------------------------------------------------------------

  /** Observes a sim event (never consumes it). */
  handle(ev) {
    if (ev.type === 'attack') {
      const a = this.list.get(ev.towerUid);
      if (a?.group) this._onAttack(a, ev.targetUid, null);
    } else if (ev.type === 'ult') {
      const a = this.list.get(ev.towerUid);
      // Dream Detour: the doll dashes toward the ult's centre
      if (a?.group && a.cid === 'doll' && ev.x != null) this._onAttack(a, null, { x: ev.x, z: ev.y });
    }
  }

  _onAttack(a, targetUid, point) {
    if (a.cid === 'kon') {
      if (!konAttacks(a.kon.s)) return;
      a.group.userData.playAttack?.();
      const e = targetUid != null ? this.actors.enemyPos(targetUid) : null;
      if (e) a.face = Math.atan2(e.x - a.group.position.x, e.z - a.group.position.z);
      a.faceT = 0.8;
      return;
    }
    let tx;
    let ty;
    let tz;
    if (point) {
      tx = point.x;
      tz = point.z;
      ty = 0.3;
      // an ult centred on her own spot: dash at the nearest monster instead (or a step ahead of her)
      if (Math.hypot(tx - a.home.x, tz - a.home.z) < 0.6) {
        const e = this._nearestEnemy(a.home.x, a.home.z, 4);
        if (e) {
          tx = e.x;
          tz = e.z;
          ty = e.y + (e.height || 0.5) * 0.5;
        } else {
          tx = a.home.x + Math.sin(a.facing) * 1.2;
          tz = a.home.z + Math.cos(a.facing) * 1.2;
        }
      }
    } else {
      const e = targetUid != null ? this.actors.enemyPos(targetUid) : null;
      if (!e) return;
      tx = e.x;
      tz = e.z;
      ty = e.y + (e.height || 0.5) * 0.5;
    }
    const dur = a.cid === 'kaze' ? SWOOP_TIME : DASH_TIME;
    if (startSortie(a.sortie, tx, ty, tz, dur, point ? null : targetUid)) a.group.userData.playAttack?.();
  }

  // ---- frame ---------------------------------------------------------------------------------

  /** @param {number} dt @param {number} [zoom] camera zoom (1 = fitted view) */
  update(dt, zoom = 1) {
    if (this.disposed) return;
    this.time += dt;
    this.frame++;
    if (!this.enabled) {
      if (this.list.size) this.clear();
      return;
    }
    // full files when zoomed in on quality high, LOD otherwise
    this.zoom = zoom;
    if (this.quality !== 'high') this.detail = 'lod';
    else if (this.detail === 'lod' && zoom >= FULL_AT) this.detail = 'full';
    else if (this.detail === 'full' && zoom <= LOD_AT) this.detail = 'lod';
    reconcile(this.list, this.sim.towers, this._of, this._make, this._drop, this.frame);
    for (const a of this.list.values()) this._update(a, dt);
  }

  /** The nearest drawn monster within `r` tiles ({ x, y, z, height }) or null. */
  _nearestEnemy(x, z, r) {
    let best = null;
    let bd = r * r;
    for (const v of this.actors.enemies.values()) {
      if (v.hidden) continue;
      const d = (v.x - x) ** 2 + (v.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  _asset(cid) {
    const exact = getCompanion(cid, this.detail, true);
    if (exact) return exact;
    const key = `${cid}|${this.detail}`;
    if (!this.requested.has(key)) {
      this.requested.add(key);
      loadCompanion(cid, this.detail).catch(() => {});
    }
    return getCompanion(cid, this.detail);
  }

  _create(t, cid) {
    const v = this.actors.towers.get(t.uid);
    const entry = companionEntry(cid);
    if (!v || !entry) return null;
    const asset = this._asset(cid);
    if (!asset) return null; // still loading: Kon's procedural fallback keeps drawing meanwhile
    const a = {
      uid: t.uid, unitId: t.unitId, cid, entry, group: null, detail: null, anchor: new HomeAnchor(entry),
      home: new THREE.Vector3(), facing: v.facing, face: 0, faceT: 0, state: 'idle', barRest: null,
      // manifest battleScale: a battle-only size factor over her scale (the student page keeps the figure's own size)
      battleScale: entry.battleScale > 0 ? entry.battleScale : 1,
      kon: cid === 'kon' ? { s: konState(), view: { x: 0, z: 0, h: 0.2, away: false } } : null,
      sortie: cid === 'kon' ? null : sortieState(),
    };
    if (a.kon) a.kon.s.hold = KON_HOLD;
    this._instance(a, asset);
    a.group.userData.playClip?.('appear');
    return a;
  }

  /** (Re)builds the figure of an actor from an asset (first time, or a detail swap). */
  _instance(a, asset) {
    if (a.group) {
      this.root.remove(a.group);
      a.group.userData.dispose?.();
      disposeObject(a.group);
    }
    const g = buildCompanion(asset, { quality: this.quality });
    a.group = g;
    a.detail = asset.detail;
    a.height = asset.height || a.entry.height || 0.2;
    // the doll's thread tops: where the bar bone sits at home, kept there while the doll dashes
    a.barRest = g.userData.bar ? boneAtIdle(asset, g.userData.bar.name) : null;
    this.root.add(g);
  }

  _dispose(a) {
    if (!a.group) return;
    this.root.remove(a.group);
    a.group.userData.dispose?.();
    disposeObject(a.group);
    a.group = null;
  }

  _groundAt(x, z) {
    const tr = this.terrain;
    const tx = Math.floor(x);
    const tz = Math.floor(z);
    if (tr?.isWater?.(tx, tz) && !tr.isPath?.(tx, tz)) return WATER_Y + 0.03;
    return tr?.isPath?.(tx, tz) ? PATH_H : 0.05;
  }

  _update(a, dt) {
    const v = this.actors.towers.get(a.uid);
    const t = this.sim.getTower ? this.sim.getTower(a.uid) : null;
    if (!a.group || !v || !t) {
      if (a.group) a.group.visible = false;
      return;
    }
    // detail swap (zoom crossed the threshold) once that file is here; the old figure is disposed, so read
    // a.group only after this
    if (a.detail !== this.detail) {
      const asset = this._asset(a.cid);
      if (asset && asset.detail !== a.detail) this._instance(a, asset);
    }
    const g = a.group;
    g.visible = true;
    const m = v.model;
    // home point in world space: the girl's current transform × the home point in her space
    a.anchor.bind(m);
    a.anchor.local(_home);
    _m.compose(m.position, m.quaternion, m.scale);
    a.home.copy(_home).applyMatrix4(_m);
    const scale = m.scale.x * a.battleScale;
    g.scale.setScalar(scale);
    let state = 'idle';
    let facing = v.facing;
    if (a.kon) {
      const s = a.kon.s;
      konStep(s, dt, a.home.x, a.home.z, konSpot(t, _spot));
      if (s.mode === 'home') {
        g.position.copy(a.home);
      } else {
        g.position.set(s.x, this._groundAt(s.x, s.z), s.z);
      }
      if (s.mode === 'travel') {
        state = 'move';
        facing = Math.atan2(s.dx, s.dz);
      } else if (s.mode === 'spot') {
        facing = a.faceT > 0 ? a.face : v.facing;
      }
      const kv = a.kon.view;
      kv.x = g.position.x;
      kv.z = g.position.z;
      kv.h = g.position.y + a.height * scale * 0.62;
      kv.away = s.mode !== 'home';
    } else {
      const s = a.sortie;
      if (s.busy && s.uid != null) {
        const e = this.actors.enemyPos(s.uid);
        if (e) retarget(s, e.x, e.y + (e.height || 0.5) * 0.5, e.z);
      }
      const opts = a.cid === 'kaze' ? SWOOP_OPTS : DASH_OPTS;
      sortieStep(s, dt, a.home.x, a.home.y, a.home.z, _pos, opts);
      g.position.set(_pos.x, _pos.y, _pos.z);
      if (s.busy) {
        state = a.cid === 'kaze' ? 'move' : 'idle';
        const dx = s.tx - a.home.x;
        const dz = s.tz - a.home.z;
        if (dx * dx + dz * dz > 1e-6) facing = Math.atan2(dx, dz) + (_pos.out || a.cid === 'doll' ? 0 : Math.PI);
      }
    }
    a.faceT = Math.max(0, a.faceT - dt);
    a.facing = lerpAngle(a.facing, facing, Math.min(1, dt * 10));
    g.rotation.y = a.facing;
    a.state = state;
    g.userData.animate?.(this.time, dt, state);
    // the doll's threads stay tied to Yoriko's control bar while it dashes
    const bar = g.userData.bar;
    if (bar && a.barRest && bar.parent) {
      _bar.copy(a.barRest).applyAxisAngle(_v.set(0, 1, 0), v.facing).multiplyScalar(scale).add(a.home);
      g.updateMatrixWorld(true);
      bar.position.copy(bar.parent.worldToLocal(_bar));
    }
  }

  dispose() {
    this.disposed = true;
    this.clear();
    this.root.removeFromParent();
  }
}

const SWOOP_OPTS = { lift: SWOOP_LIFT };
const DASH_OPTS = { reach: DASH_REACH, stop: DASH_STOP, lift: DASH_LIFT };

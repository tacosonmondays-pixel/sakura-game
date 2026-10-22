// Companion actors in battle (display only: reads the sim's towers and drained events, never writes):
//   Kon (Ruri)    appears by her and runs to his guard post (her relay origin t.ox / t.oy, or a spot in
//                 front of her when her origin is her own spot), then acts with intent (FX-1,
//                 companionLogic.js konBrainStep): he guards and tracks the nearest enemy, hops at it on
//                 every bolt (her bolts leave him), pounces on every 4th, a crit or a kill, patrols when
//                 nothing is in range, plays between waves and trots to Ruri for a pat, and naps after
//                 20 quiet seconds. Never straight behind her from the camera (her hair hid him);
//                 always within 0.6 tiles of the bolt origin. Reduce Motion: he re-projects (a short fade
//                 out and in) instead of running, and yips in place.
//   Kaze (Hana)   perches on her left shoulder (rides her shoulder bone); on her attacks he swoops to the
//                 target and back in a short arc, one swoop at a time
//   the doll      (Yoriko) floats in front of her raised hand on glowing threads that stay tied to her
//                 control bar; dashes at the target and back on her needles and on Dream Detour
// One actor per placed girl who has a companion (co-op partners' girls too: they are in the shared sim);
// 'appear' plays when she is placed, the actor goes when she is sold. Models and the manifest contract:
// src/models/companions.js. Rules (pure): ./companionLogic.js.
//
//   const c = new Companions({ sim, scene, actors, terrain, quality, camera?, fx?, reduceMotion? });
//   c.handle(ev)      // every drained sim event (observes only, never consumes)
//   c.kill(owner, uid, x, z) // a kill the renderer credited to `owner` (Kon pounces on Ruri's)
//   c.update(dt, zoom) // once per frame after actors.sync (dt: visual seconds; c.timeScale: game speed)
import * as THREE from 'three';
import {
  loadCompanionManifest, companionOf, companionEntry, loadCompanion, getCompanion, buildCompanion, HomeAnchor, boneAtIdle,
} from '../models/companions.js';
import { disposeObject } from '../models/index.js';
import { lerpAngle } from './geo.js';
import { WATER_Y, PATH_H } from './terrain.js';
import { BoneOverlay, AXIS_X, AXIS_Y } from './boneOverlay.js';
import {
  konState, konStep, konAttacks, sortieState, startSortie, retarget, sortieStep, reconcile,
  konBrain, konBrainStep, konBolt, konPounce, konPost, konHome, laneDirAt,
  SWOOP_TIME, SWOOP_LIFT, DASH_TIME, DASH_REACH, DASH_STOP, DASH_LIFT,
} from './companionLogic.js';

/** Zoom at which the full-detail files take over from the LOD ones (quality high only), with hysteresis. */
const FULL_AT = 2.0;
const LOD_AT = 1.7;
const KON_HOLD = 0.5; // his appear clip, then he may run
/** Reduce Motion: a re-projection's fade out + in (s). */
const REPROJECT = 0.3;

const _home = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _bar = new THREE.Vector3();
const _pos = { x: 0, y: 0, z: 0, out: false };
const _post = { x: 0, z: 0 };
const _homeK = { x: 0, z: 0 };
const _lane = { x: 0, z: 1 };
const _cam = new THREE.Vector3();
const _toCam = { x: 0, z: 1 };
const HOLO = '#bfe9ff';
const HEART = '#ff7aa8';

export class Companions {
  /** @param {{ sim, scene: THREE.Scene, actors, terrain, quality: string, camera?, fx?, reduceMotion?: boolean }} o */
  constructor({ sim, scene, actors, terrain, quality, camera = null, fx = null, reduceMotion = false }) {
    this.sim = sim;
    this.actors = actors;
    this.terrain = terrain;
    this.quality = quality;
    this.camera = camera;
    this.fx = fx;
    this.reduceMotion = !!reduceMotion;
    this.timeScale = 1;
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
        // Kon's intent (guard / hop / pounce / trot / patrol / sniff / play / rest / wake …) and his post
        act: a.kon ? a.kon.b.act : null, sub: a.kon ? a.kon.b.sub : null,
        post: a.kon ? [+a.kon.post.x.toFixed(3), +a.kon.post.z.toFixed(3)] : null,
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

  /** A kill the renderer credited to girl `owner`: Kon pounces on the spot of a kill of Ruri's bolts. */
  kill(owner, uid, x, z) {
    const a = this.list.get(owner);
    if (!a?.group || a.cid !== 'kon' || !konAttacks(a.kon.s)) return;
    if (a.kon.lastTarget != null && a.kon.lastTarget !== uid) return;
    konPounce(a.kon.b, x, z);
  }

  _onAttack(a, targetUid, point) {
    if (a.cid === 'kon') {
      if (!konAttacks(a.kon.s)) return;
      const e = targetUid != null ? this.actors.enemyPos(targetUid) : null;
      a.kon.lastTarget = targetUid ?? null;
      if (e) konBolt(a.kon.b, e.x, e.z, false);
      else konBolt(a.kon.b, a.kon.post.x + Math.sin(a.facing) * 0.3, a.kon.post.z + Math.cos(a.facing) * 0.3, false);
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
      kon: cid === 'kon' ? {
        s: konState(), b: konBrain(t.uid), view: { x: 0, z: 0, h: 0.2, away: false }, post: { x: t.x, z: t.y },
        ov: null, lastAct: '', lastSub: '', lastTarget: null, rp: -1, rpX: 0, rpZ: 0, heartT: 0, zzT: 0,
      } : null,
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
    if (a.kon) {
      // yaw first, then the nose-first pitch and the roll about his own axes
      g.rotation.order = 'YXZ';
      a.kon.ov = new BoneOverlay(g);
    }
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

  /** The ground direction toward the camera (x, z), +z when there is no camera (a shared object). */
  _toCamera() {
    _toCam.x = 0;
    _toCam.z = 1;
    if (this.camera?.getWorldDirection) {
      this.camera.getWorldDirection(_cam);
      const l = Math.hypot(_cam.x, _cam.z);
      if (l > 1e-4) {
        _toCam.x = -_cam.x / l;
        _toCam.z = -_cam.z / l;
      }
    }
    return _toCam;
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
    if (a.kon) {
      this._updateKon(a, t, v, dt, scale);
      return;
    }
    g.scale.setScalar(scale);
    let state = 'idle';
    let facing = v.facing;
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
    a.faceT = Math.max(0, a.faceT - dt);
    a.facing = lerpAngle(a.facing, facing, Math.min(1, dt * 10));
    g.rotation.y = a.facing;
    a.state = state;
    g.userData.animate?.(this.time, dt, state);
    // the doll's threads stay tied to Yoriko's control bar while it dashes
    const bar = g.userData.bar;
    if (bar && a.barRest && bar.parent) {
      _bar.copy(a.barRest).applyAxisAngle(_v.set(0, 1, 0), v.facing).multiplyScalar(scale);
      _bar.add(a.home);
      g.updateMatrixWorld(true);
      bar.position.copy(bar.parent.worldToLocal(_bar));
    }
  }

  /** Kon: the travel layer to his post, then his intent there (companionLogic.js konBrainStep). */
  _updateKon(a, t, v, dt, scale) {
    const g = a.group;
    const K = a.kon;
    const s = K.s;
    const b = K.b;
    const calm = this.reduceMotion;
    // his clock is game time: at 2× / 3× his hops keep pace with Ruri's bolts
    const gdt = dt * this.timeScale;
    const cam = this._toCamera();
    konPost(t, cam.x, cam.z, K.post);
    konHome(t.x, t.y, cam.x, cam.z, _homeK);
    const wasTravel = s.mode === 'travel';
    const started = s.placed;
    const px = s.x;
    const pz = s.z;
    // Reduce Motion: no run across the board, he re-projects at the new post
    konStep(s, gdt, _homeK.x, _homeK.z, K.post, calm ? 1e6 : undefined);
    if (calm && started && K.rp < 0 && Math.hypot(s.x - px, s.z - pz) > 0.05) {
      K.rp = 0;
      K.rpX = px;
      K.rpZ = pz;
    }
    let x;
    let z;
    let h = 0;
    let yaw = a.facing;
    let state = 'idle';
    let fade = 1;
    if (s.mode === 'spot') {
      if (wasTravel) b.placed = false; // he starts acting where he arrived
      const range = (t.eff?.range || 2.2);
      laneDirAt(this.sim.pathData, K.post.x, K.post.z, _lane);
      let ex = 0;
      let ez = 0;
      let enemy = false;
      let near = false;
      let bd = (range + 1.5) * (range + 1.5);
      for (const ev of this.actors.enemies.values()) {
        if (ev.hidden) continue;
        const d = (ev.x - K.post.x) ** 2 + (ev.z - K.post.z) ** 2;
        if (d < bd) {
          bd = d;
          ex = ev.x;
          ez = ev.z;
          near = true;
        }
      }
      if (near && bd <= (range + 0.5) * (range + 0.5)) enemy = true;
      const I = KON_IN;
      I.px = K.post.x;
      I.pz = K.post.z;
      I.hx = _homeK.x;
      I.hz = _homeK.z;
      I.ox = t.ox ?? t.x;
      I.oz = t.oy ?? t.y;
      I.lx = _lane.x;
      I.lz = _lane.z;
      I.enemy = enemy;
      I.ex = ex;
      I.ez = ez;
      I.near = near;
      I.wave = this.sim.state === 'wave';
      I.calm = calm;
      I.cooldown = t.cooldown ?? -1;
      I.engaged = enemy && (t.cooldown ?? 0) > 0;
      konBrainStep(b, gdt, I);
      // the travel layer starts any later run from where he really is
      s.x = b.x;
      s.z = b.z;
      x = b.x;
      z = b.z;
      h = b.h;
      yaw = b.yaw;
      state = b.clip === 'move' ? 'move' : 'idle';
      fade = b.fade;
      // the attack clip (crouch, pounce, hop) plays as each leap starts
      const leapAct = b.act === 'hop' || b.act === 'pounce' || (b.act === 'play' && b.sub === 'chase');
      if (leapAct && (K.lastAct !== b.act || K.lastSub !== b.sub || b.t < gdt + 1e-6)) g.userData.playAttack?.();
      K.lastAct = b.act;
      K.lastSub = b.sub;
    } else {
      x = s.x;
      z = s.z;
      if (s.mode === 'travel') {
        state = 'move';
        yaw = Math.atan2(s.dx, s.dz);
      } else {
        yaw = v.facing;
      }
      b.act = 'guard';
      K.lastAct = '';
    }
    // Reduce Motion re-projection: fade out where he was, in where he is
    if (K.rp >= 0) {
      K.rp += dt;
      if (K.rp < REPROJECT / 2) {
        x = K.rpX;
        z = K.rpZ;
        fade = 1 - K.rp / (REPROJECT / 2);
      } else {
        fade = Math.min(fade, (K.rp - REPROJECT / 2) / (REPROJECT / 2));
      }
      if (K.rp === dt) this._holo(K.rpX, K.rpZ);
      if (K.rp >= REPROJECT) {
        K.rp = -1;
        this._holo(x, z);
      }
    }
    const gy = this._groundAt(x, z);
    g.position.set(x, gy + h, z);
    a.facing = lerpAngle(a.facing, yaw, Math.min(1, dt * 12));
    g.rotation.set(s.mode === 'spot' ? b.pitch : 0, a.facing, s.mode === 'spot' ? b.roll : 0);
    // squash (volume kept) and the re-projection fade
    const sy = s.mode === 'spot' ? b.sy : 1;
    const f = Math.max(0.001, fade);
    const w = 1 / Math.sqrt(Math.max(0.3, sy));
    g.scale.set(scale * w * f, scale * sy * f, scale * w * f);
    a.state = state;
    K.ov.restore();
    g.userData.animate?.(this.time, dt, state);
    // head: tracks the enemy (his body already faces it while guarding), shakes, sniffs, looks up
    if (s.mode === 'spot') {
      let head = b.head;
      if (b.act === 'guard' && KON_IN.enemy) {
        let d = Math.atan2(KON_IN.ex - x, KON_IN.ez - z) - a.facing;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        head += Math.max(-0.8, Math.min(0.8, d)) * (calm ? 0.5 : 1);
      }
      if (head) K.ov.turn('head', AXIS_Y, head);
      if (b.headPitch) K.ov.turn('head', AXIS_X, b.headPitch);
      // a heart for Ruri's pat, little Z marks while he naps (decoration through the fx system)
      if (b.heart) this._spark(t.x, 1.15, t.y, HEART, 'heart', 0.22, 0.6);
      if (b.sleep) {
        K.zzT -= dt;
        if (K.zzT <= 0) {
          K.zzT = 1.1;
          this._spark(x + 0.05, gy + 0.35, z, '#ffffff', 'zz', 0.16, 1.0);
        }
      }
    }
    const kv = K.view;
    kv.x = g.position.x;
    kv.z = g.position.z;
    kv.h = gy + h + a.height * scale * 0.62;
    kv.away = s.mode !== 'home';
  }

  /** A soft holo glow (a re-projection) at (x, z). */
  _holo(x, z) {
    const R = this.fx?.R;
    if (!R) return;
    this.fx.spawn({ batch: 'bbA', uv: R.glow, x, y: 0.25, z, s0: 0.5, s1: 0.2, life: 0.18, color: HOLO, a0: 0.7 });
  }

  _spark(x, y, z, color, uv, size, life) {
    const R = this.fx?.R;
    if (!R || !R[uv]) return;
    this.fx.spawn({ batch: 'bbN', uv: R[uv], x, y, z, vy: 0.35, s0: size, s1: size * 0.8, life, color, a0: 1 });
  }

  dispose() {
    this.disposed = true;
    this.clear();
    this.root.removeFromParent();
  }
}

const SWOOP_OPTS = { lift: SWOOP_LIFT };
const DASH_OPTS = { reach: DASH_REACH, stop: DASH_STOP, lift: DASH_LIFT };
/** Kon's per-frame inputs (one object, reused). */
const KON_IN = {
  px: 0, pz: 0, hx: 0, hz: 0, ox: 0, oz: 0, lx: 1, lz: 0, enemy: false, ex: 0, ez: 0, near: false, wave: false, calm: false, cooldown: -1, engaged: false,
};

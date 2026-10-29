// Yoriko's marionette in battle (display only: reads the sim's towers, projectiles and drained events, never
// writes). The doll hangs in front of her raised hand on thin pale-lilac strings tied to her control bar (the
// doll GLB's 'bar' bone sits on it); each attack plays Command → Extend → Strike → Reel and a pendulum settle
// inside her attack interval, the strike on the sim's hit (rules: ./marionetteLogic.js). The slash flash on the
// hit is her attack style's (attackFx/styles/yoriko.js), and her needles leave the doll (dollAt).
//
// The strings are drawn here, not by the GLB: its three straight skinned threads are cut from the figure's
// geometry (per figure, attributes shared) and replaced by camera-facing ribbons that stretch from the bar to
// the doll's hands and head, sag a little when slack and go straight when taut. One pooled ribbon mesh per doll,
// made with the figure: nothing is allocated per attack or per frame.
//   Low graphics: one string (the head's) and a plain glide (no side arc, no pendulum).
//   Reduce motion: the doll stays home and only tilts on each attack (the flash still shows the hit).
//
// Used by src/render/companions.js for the doll's actor only:
//   const m = new Marionette({ sim, actors, root, quality, reduceMotion });
//   m.bind(a, asset)            // after the doll's figure is (re)built
//   m.onAttack(a, ev) / m.onPoint(a, x, z)
//   m.tick(dt)                  // once per frame, before the actors
//   m.update(a, v, t, dt, scale) // places the figure, animates it, draws the strings
//   m.release(a) / m.dispose()
import * as THREE from 'three';
import { lerpAngle } from './geo.js';
import {
  marionetteState, startMarionette, retargetMarionette, loseTarget, landMarionette, stepMarionette, marionetteBusy,
  marionetteActive, stringPoint, sagFor, adoptAttack, planStages, STOP, REACH, EARLY_PAUSE,
} from './marionetteLogic.js';

/** Segments per string (a sag needs a few). */
const SEGS = 8;
/** At most this many strings per doll (the GLB has three: both hands and the head). */
const MAX_STRINGS = 4;
/** String width: world units at the doll's scale 1, and at least this many CSS px on screen. */
const STRING_W = 0.007;
const STRING_MIN_PX = 1.2;
const LILAC = new THREE.Color('#c9b6f4');
const TAUT = new THREE.Color('#e2d6ff');
/** How near the dead target's last spot the enemy its needle flies on to must be (tiles). */
const NEXT_NEAR = 0.8;
/** An enemy's body point: this share of its height. */
const BODY = 0.5;
/** Hit radius used to time the needle (tiles). */
const HIT_R = 0.2;

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _q = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _pts = new Float32Array((SEGS + 1) * 3);
const _top = new THREE.Vector3();
const _bot = new THREE.Vector3();
const _side = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _view = new THREE.Vector3(0, 1, 0);
const _col = new THREE.Color();
const _yAxis = new THREE.Vector3(0, 1, 0);
const _at = { x: 0, z: 0, h: 0 };

/**
 * The doll's threads in an asset (cached on it): each thread's bottom (bone + point in that bone's space) and
 * top (offset from the bar bone's rest point, in the figure's root space), and the triangles that are not
 * threads (per primitive geometry) so the figure can be drawn without them.
 */
export function threadInfo(asset) {
  if (!asset?.scene) return null;
  if (asset.marionette !== undefined) return asset.marionette;
  let info = null;
  asset.scene.updateMatrixWorld(true);
  asset.scene.traverse((o) => {
    if (info || !o.isSkinnedMesh || !o.geometry?.index) return;
    const bones = o.skeleton?.bones || [];
    const bar = bones.findIndex((b) => b.name === 'bar');
    if (bar < 0) return;
    const g = o.geometry;
    const si = g.attributes.skinIndex;
    const sw = g.attributes.skinWeight;
    const pos = g.attributes.position;
    if (!si || !sw || !pos) return;
    const main = (i) => {
      let best = 0;
      let bw = -1;
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        if (w > bw) {
          bw = w;
          best = si.getComponent(i, k);
        }
      }
      return best;
    };
    const idx = g.index.array;
    const keep = [];
    const per = new Map(); // bone index -> { bot: Set, top: Set }
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t];
      const b = idx[t + 1];
      const c = idx[t + 2];
      const ma = main(a);
      const mb = main(b);
      const mc = main(c);
      if (ma !== bar && mb !== bar && mc !== bar) {
        keep.push(a, b, c);
        continue;
      }
      const other = ma !== bar ? ma : mb !== bar ? mb : mc !== bar ? mc : -1;
      if (other < 0) continue; // a cap at the bar end
      let e = per.get(other);
      if (!e) per.set(other, (e = { bot: new Set(), top: new Set() }));
      for (const [vi, mi] of [[a, ma], [b, mb], [c, mc]]) (mi === bar ? e.top : e.bot).add(vi);
    }
    if (!per.size) return;
    const bind = o.bindMatrix;
    const inv = o.skeleton.boneInverses;
    // the bar bone's rest point in bind space
    const barRest = new THREE.Vector3().setFromMatrixPosition(_m.copy(inv[bar]).invert());
    const unit = asset.unitScale || 1;
    const threads = [];
    for (const [bi, e] of per) {
      const bot = new THREE.Vector3();
      for (const vi of e.bot) bot.add(_v.fromBufferAttribute(pos, vi).applyMatrix4(bind));
      bot.multiplyScalar(1 / Math.max(1, e.bot.size));
      const top = new THREE.Vector3();
      for (const vi of e.top) top.add(_v.fromBufferAttribute(pos, vi).applyMatrix4(bind));
      top.multiplyScalar(1 / Math.max(1, e.top.size));
      threads.push({
        bone: bones[bi].name,
        // the attach point in the bone's own space: skinned positions are boneWorld × boneInverse × bindMatrix × p
        attach: bot.clone().applyMatrix4(inv[bi]),
        top: top.sub(barRest).multiplyScalar(unit),
      });
    }
    threads.sort((p, q) => (p.bone === 'head' ? -1 : q.bone === 'head' ? 1 : p.bone < q.bone ? -1 : 1));
    info = { geometry: g, keep: new (idx.length > 65535 ? Uint32Array : Uint16Array)(keep), threads: threads.slice(0, MAX_STRINGS) };
  });
  asset.marionette = info;
  return info;
}

/** The figure without its GLB threads: one geometry per figure (attributes shared with the asset), on every mesh using it. */
function cutThreads(group, info) {
  if (!info) return null;
  let cut = null;
  group.traverse((o) => {
    if (!o.isMesh || o.geometry !== info.geometry) return;
    if (!cut) {
      cut = new THREE.BufferGeometry();
      for (const [k, attr] of Object.entries(info.geometry.attributes)) cut.setAttribute(k, attr);
      cut.setIndex(new THREE.BufferAttribute(info.keep, 1));
      if (info.geometry.groups.length) cut.addGroup(0, info.keep.length, info.geometry.groups[0].materialIndex);
      cut.boundingSphere = info.geometry.boundingSphere;
      cut.boundingBox = info.geometry.boundingBox;
      cut.name = 'doll-no-threads';
    }
    o.geometry = cut;
  });
  return cut;
}

/** One doll's pooled ribbons (made with the figure). */
function makeStrings(material, n) {
  const verts = n * (SEGS + 1) * 2;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const index = new Uint16Array(n * SEGS * 6);
  let k = 0;
  for (let s = 0; s < n; s++) {
    const b = s * (SEGS + 1) * 2;
    for (let i = 0; i < SEGS; i++) {
      const v = b + i * 2;
      index[k++] = v;
      index[k++] = v + 1;
      index[k++] = v + 2;
      index[k++] = v + 1;
      index[k++] = v + 3;
      index[k++] = v + 2;
    }
  }
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'doll-strings';
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

export class Marionette {
  /** @param {{ sim, actors, root: THREE.Object3D, quality?: string, reduceMotion?: boolean }} o */
  constructor({ sim, actors, root, quality = 'high', reduceMotion = false }) {
    this.sim = sim;
    this.actors = actors;
    this.root = root;
    this.quality = quality;
    this.reduceMotion = !!reduceMotion;
    this.time = 0;
    this.gdt = 0;
    this.speed = 1;
    this.lastSim = null;
    this.strings = new Set(); // every doll's ribbons
    this.camera = null;
    this.viewH = 0;
    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    });
    this.material.name = 'doll-strings';
    // the camera that draws the strings (ribbons face it on the next frame)
    this._seeCamera = (renderer, _scene, camera) => {
      this.camera = camera;
      this.viewH = renderer?.domElement?.clientHeight || this.viewH;
    };
  }

  /** Low graphics: one string and a plain glide. */
  get simple() {
    return this.quality === 'low';
  }

  /**
   * The doll clock for this frame: game time (so the stages fit her attack interval at 2x / 3x), from the
   * renderer's visual dt (which holds at 0 while paused or in a hit-stop, so the doll holds too).
   */
  tick(dt, frameDt = dt) {
    const st = this.sim?.time;
    // the game-speed estimate uses the frame's own time (a hit-stop shortens the visual dt, not the sim step); held
    // while paused (visual dt 0), so the doll resumes at the speed it had
    if (typeof st === 'number' && this.lastSim != null && dt > 0 && frameDt > 0) {
      const est = Math.max(0, Math.min(4, (st - this.lastSim) / frameDt));
      this.speed += (est - this.speed) * 0.2;
    }
    this.lastSim = typeof st === 'number' ? st : null;
    this.gdt = dt * Math.max(1, this.speed);
    this.time += this.gdt;
    // strings show only for dolls drawn this frame (update() turns theirs back on)
    for (const st of this.strings) st.mesh.visible = false;
  }

  /** Binds an actor's (new) figure: cuts the GLB threads and makes the strings. Keeps the attack state. */
  bind(a, asset) {
    this.release(a, false);
    a.mar ??= marionetteState();
    a.attackClip = asset?.clips?.attack || null;
    const info = threadInfo(asset);
    const g = a.group;
    const threads = [];
    if (info && g) {
      cutThreads(g, info);
      for (const th of info.threads) {
        const bone = g.getObjectByName(th.bone);
        if (bone) threads.push({ bone, attach: th.attach, top: th.top });
      }
    }
    if (!threads.length) {
      a.strings = null;
      return;
    }
    const mesh = makeStrings(this.material, threads.length);
    mesh.onBeforeRender = this._seeCamera;
    this.root.add(mesh);
    a.strings = { mesh, threads, n: threads.length };
    this.strings.add(a.strings);
  }

  /** Drops an actor's strings (its figure goes or is rebuilt). */
  release(a, all = true) {
    const s = a.strings;
    if (s) {
      s.mesh.removeFromParent();
      s.mesh.geometry.dispose();
      this.strings.delete(s);
      a.strings = null;
    }
    if (all && a.mar) a.mar = marionetteState();
  }

  /** Where the doll's body is drawn ({ x, z, h }, shared) for her needles, or null. */
  at(a) {
    const g = a?.group;
    if (!g) return null;
    _at.x = g.position.x;
    _at.z = g.position.z;
    _at.h = g.position.y + (a.height || 0.3) * g.scale.y * 0.55;
    return _at;
  }

  /** Her 'attack' event: the doll strikes the enemy her needles fly at, on the needle's hit. */
  onAttack(a, ev) {
    const t = this.sim.getTower ? this.sim.getTower(a.uid) : null;
    const e = ev.targetUid != null ? this.actors.enemyPos(ev.targetUid) : null;
    if (!t || !e) return false;
    // the needle at that enemy: when it lands (the sim's hit) is when the doll strikes
    let eta = null;
    a.projUid = null;
    const list = this.sim.projectiles || [];
    let fresh = Infinity;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (p.dead || p.ownerUid !== a.uid || p.turretUid != null || p.target?.uid !== ev.targetUid) continue;
      if ((p.travel || 0) >= fresh) continue;
      fresh = p.travel || 0;
      a.projUid = p.uid;
      eta = Math.max(0, (Math.hypot(p.target.x - p.x, p.target.y - p.y) - HIT_R) / Math.max(0.1, p.speed || 10));
    }
    a.lastUid = ev.targetUid;
    const s = a.mar;
    // set off early (from her cooldown): the doll is on its way; it takes this enemy and lands on this needle
    if (s?.early && marionetteBusy(s)) {
      s.uid = ev.targetUid;
      retargetMarionette(s, e.x, e.y + (e.height || 0.5) * BODY, e.z, a.home.x, a.home.y, a.home.z);
      adoptAttack(s, eta);
      return true;
    }
    return this._start(a, t, e.x, e.y + (e.height || 0.5) * BODY, e.z, ev.targetUid, eta);
  }

  /**
   * The early start: her next attack is due in `t.cooldown` (the sim's own timer, read only) at an enemy in her
   * range (the one she shot last, else the nearest); when its needle would land within a natural Command + Extend,
   * the doll sets off now so Extend ends on that hit. Her attack event then names the real target (onAttack).
   */
  _early(a, t) {
    const s = a.mar;
    const cd = t.cooldown;
    if (marionetteBusy(s) || !(cd > 0) || this.time < (a.earlyAfter || 0) || !t.eff) return;
    const rate = t.eff.rate ?? 0.9;
    const interval = 1 / Math.max(0.05, rate);
    planStages(interval, null, PLAN);
    if (cd > PLAN.lead) return;
    const range = t.eff.range || 0;
    const ox = t.ox ?? t.x;
    const oy = t.oy ?? t.y;
    let v = a.lastUid != null ? this.actors.enemies?.get(a.lastUid) : null;
    let uid = a.lastUid;
    if (!v || v.hidden || Math.hypot(v.x - ox, v.z - oy) > range) {
      const n = this._near(ox, oy, range, null);
      if (!n) return;
      uid = n.uid;
      v = this.actors.enemies.get(uid);
      if (!v) return;
    }
    const eta = cd + Math.max(0, Math.hypot(v.x - ox, v.z - oy) - HIT_R) / Math.max(0.1, t.eff.projectileSpeed || 13);
    if (eta > PLAN.lead) return;
    a.projUid = null;
    startMarionette(s, {
      interval, eta, tx: v.x, ty: v.y + (v.height || 0.5) * BODY, tz: v.z, hx: a.home.x, hy: a.home.y, hz: a.home.z, uid,
      calm: this.reduceMotion, simple: this.simple, early: true,
    });
  }

  /** Dream Detour: the doll strikes toward the curtain's centre (or the nearest monster when that is her own spot). */
  onPoint(a, x, z, nearest) {
    const t = this.sim.getTower ? this.sim.getTower(a.uid) : null;
    if (!t) return false;
    a.projUid = null;
    let tx = x;
    let tz = z;
    let ty = 0.3;
    if (Math.hypot(tx - a.home.x, tz - a.home.z) < 0.6) {
      const e = nearest?.(a.home.x, a.home.z, 4);
      if (e) {
        tx = e.x;
        tz = e.z;
        ty = e.y + (e.height || 0.5) * BODY;
      } else {
        tx = a.home.x + Math.sin(a.facing) * 1.2;
        tz = a.home.z + Math.cos(a.facing) * 1.2;
      }
    }
    return this._start(a, t, tx, ty, tz, null, null);
  }

  _start(a, t, tx, ty, tz, uid, eta) {
    a.mar ??= marionetteState();
    const rate = t.eff?.rate ?? t.stats?.rate ?? 0.9;
    const ok = startMarionette(a.mar, {
      interval: 1 / Math.max(0.05, rate), eta, tx, ty, tz, hx: a.home.x, hy: a.home.y, hz: a.home.z, uid,
      calm: this.reduceMotion, simple: this.simple,
    });
    if (!ok) a.projUid = null;
    return ok;
  }

  /** True while her needle (the one the doll waits for) is still flying. */
  _needleFlying(a) {
    if (a.projUid == null) return false;
    const list = this.sim.projectiles || [];
    for (let i = 0; i < list.length; i++) if (list[i].uid === a.projUid) return !list[i].dead;
    return false;
  }

  /** The enemy nearest (x, z) within r, other than `skip` ({ uid, x, y, z, height }) or null. */
  _near(x, z, r, skip) {
    let best = null;
    let bu = null;
    let bd = r * r;
    for (const [uid, v] of this.actors.enemies || []) {
      if (v.hidden || uid === skip) continue;
      const d = (v.x - x) ** 2 + (v.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = v;
        bu = uid;
      }
    }
    if (!best) return null;
    NEXT.uid = bu;
    NEXT.x = best.x;
    NEXT.y = best.y + (best.height || 0.5) * BODY;
    NEXT.z = best.z;
    return NEXT;
  }

  /**
   * One frame of the doll: follows / loses / lands its target, steps the stages, places and tilts the figure,
   * animates it on the doll clock and draws the strings.
   * @param {object} a actor  @param {object} v her view  @param {object} t her tower  @param {number} dt  @param {number} scale
   */
  update(a, v, t, dt, scale) {
    const g = a.group;
    const s = (a.mar ??= marionetteState());
    const gdt = this.gdt || dt;
    if (s.missed) {
      // set off early and no attack came: not again for a moment
      s.missed = false;
      a.earlyAfter = this.time + EARLY_PAUSE;
    }
    this._early(a, t);
    if (marionetteBusy(s)) {
      if (s.uid != null) {
        const e = this.actors.enemyPos(s.uid);
        if (e) retargetMarionette(s, e.x, e.y + (e.height || 0.5) * BODY, e.z, a.home.x, a.home.y, a.home.z);
        else {
          // gone before the strike: the enemy its needle flies on to (by the last spot), or home
          const n = this._near(s.tx, s.tz, NEXT_NEAR, s.uid);
          const ok = n && Math.hypot(n.x - a.home.x, n.z - a.home.z) <= REACH + STOP + 0.6;
          loseTarget(s, ok ? n : null);
          if (!ok) a.projUid = null;
        }
      }
      if ((s.stage === 'command' || s.stage === 'extend') && a.projUid != null && !this._needleFlying(a)) {
        landMarionette(s);
        a.projUid = null;
      }
    }
    stepMarionette(s, gdt);
    if (s.clipDue) {
      s.clipDue = false;
      if (!s.calm) {
        g.userData.playAttack?.();
        // the clip's chop on the strike: started partway in when the hit comes sooner than its wind-up
        const clip = a.attackClip;
        const act = clip ? g.userData.mixer?.existingAction(clip) : null;
        if (act && s.clipOffset > 0) act.time = s.clipOffset;
      }
    }
    // tilt about the strings (the doll's head), not its feet: a hanging swing
    const hp = (a.height || 0.3) * scale * 0.85;
    const ft = marionetteActive(s) && s.stage !== 'settle' ? Math.atan2(s.dirx, s.dirz) : v.facing;
    a.facing = lerpAngle(a.facing, ft, Math.min(1, dt * 12));
    const fwd = s.tilt;
    // the tilt leans along the doll's facing; the swing is measured along the strike direction
    const sinT = Math.sin(fwd);
    const cosT = Math.cos(fwd);
    g.position.set(
      a.home.x + s.ox - Math.sin(a.facing) * hp * sinT,
      a.home.y + s.oy + hp * (1 - cosT),
      a.home.z + s.oz - Math.cos(a.facing) * hp * sinT,
    );
    g.rotation.order = 'YXZ';
    g.rotation.y = a.facing;
    g.rotation.x = fwd;
    a.state = s.stage === 'extend' || s.stage === 'reel' ? 'move' : 'idle';
    g.userData.animate?.(this.time, gdt, a.state);
    this._strings(a, v, scale);
  }

  /** The ribbons from her control bar to the doll's hands and head. */
  _strings(a, v, scale) {
    const st = a.strings;
    const g = a.group;
    if (!st || !g) return;
    const s = a.mar;
    g.updateMatrixWorld(true);
    // her control bar: where the doll's bar bone sits at home, turned with her
    if (a.barRest) _top.copy(a.barRest).applyAxisAngle(_yAxis, v.facing).multiplyScalar(scale).add(a.home);
    else _top.set(a.home.x, a.home.y + (a.height || 0.3) * scale * 1.6, a.home.z);
    // the bar flick on Command: the tops jerk up and back toward her
    const fl = s.flick * (a.height || 0.3) * scale * 0.14;
    _top.y += fl;
    _top.x -= s.dirx * fl * 0.6;
    _top.z -= s.dirz * fl * 0.6;
    const n = this.simple ? 1 : st.n;
    const cam = this.camera;
    if (cam) _view.set(cam.matrixWorld.elements[8], cam.matrixWorld.elements[9], cam.matrixWorld.elements[10]).normalize();
    // at least STRING_MIN_PX on screen (orthographic camera: world units per CSS px)
    let w = STRING_W * scale;
    if (cam?.isOrthographicCamera && this.viewH > 0) w = Math.max(w, (STRING_MIN_PX * (cam.top - cam.bottom)) / (cam.zoom * this.viewH));
    const sag = sagFor(s.taut);
    _col.copy(LILAC).lerp(TAUT, s.taut);
    const pos = st.mesh.geometry.attributes.position;
    const col = st.mesh.geometry.attributes.color;
    const P = pos.array;
    const C = col.array;
    for (let k = 0; k < n; k++) {
      const th = st.threads[k];
      _w.copy(th.top).applyAxisAngle(_yAxis, v.facing).multiplyScalar(scale).add(_top);
      _bot.copy(th.attach).applyMatrix4(th.bone.matrixWorld);
      for (let i = 0; i <= SEGS; i++) stringPoint(_w.x, _w.y, _w.z, _bot.x, _bot.y, _bot.z, i / SEGS, sag, _pts, i * 3);
      const base = k * (SEGS + 1) * 2;
      for (let i = 0; i <= SEGS; i++) {
        const i0 = Math.max(0, i - 1) * 3;
        const i1 = Math.min(SEGS, i + 1) * 3;
        _tan.set(_pts[i1] - _pts[i0], _pts[i1 + 1] - _pts[i0 + 1], _pts[i1 + 2] - _pts[i0 + 2]);
        _side.crossVectors(_tan, _view);
        if (_side.lengthSq() < 1e-10) _side.set(1, 0, 0);
        _side.normalize().multiplyScalar(w * 0.5);
        const o = (base + i * 2) * 3;
        _q.set(_pts[i * 3], _pts[i * 3 + 1], _pts[i * 3 + 2]);
        P[o] = _q.x - _side.x;
        P[o + 1] = _q.y - _side.y;
        P[o + 2] = _q.z - _side.z;
        P[o + 3] = _q.x + _side.x;
        P[o + 4] = _q.y + _side.y;
        P[o + 5] = _q.z + _side.z;
        // brighter toward the doll end when taut
        const lift = 0.85 + 0.15 * (i / SEGS);
        C[o] = C[o + 3] = _col.r * lift;
        C[o + 1] = C[o + 4] = _col.g * lift;
        C[o + 2] = C[o + 5] = _col.b * lift;
      }
    }
    st.mesh.geometry.setDrawRange(0, n * SEGS * 6);
    pos.needsUpdate = true;
    col.needsUpdate = true;
    st.mesh.visible = g.visible;
  }

  /** Test / e2e probe for one actor. */
  probe(a) {
    const s = a.mar;
    if (!s) return null;
    return {
      stage: s.stage, u: +s.u.toFixed(3), n: s.n, taut: +s.taut.toFixed(3), tilt: +s.tilt.toFixed(3), strings: a.strings ? (this.simple ? 1 : a.strings.n) : 0,
      plan: { command: +s.plan.command.toFixed(3), extend: +s.plan.extend.toFixed(3), strike: +s.plan.strike.toFixed(3), reel: +s.plan.reel.toFixed(3), settle: +s.plan.settle.toFixed(3) },
      uid: s.uid, landed: s.landed, offset: [+s.ox.toFixed(3), +s.oy.toFixed(3), +s.oz.toFixed(3)],
    };
  }

  dispose() {
    for (const st of this.strings) {
      st.mesh.removeFromParent();
      st.mesh.geometry.dispose();
    }
    this.strings.clear();
    this.material.dispose();
    this.camera = null;
  }
}

const NEXT = { uid: null, x: 0, y: 0, z: 0 };
const PLAN = {};

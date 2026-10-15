// Drone flight (Chika and any future turret owner). One visual drone per sim turret uid.
//
// The sim keeps every drone on a fixed anchor 0.62 tiles from Chika and decides each shot
// (target + timing). This module only flies a picture of it: drones orbit above her head
// inside her selection ring, and on every shot the sim reports, that drone sorties after the
// sim's target (approach → strafing pass → loop back), following it along the path, then
// returns to its slot. The bullet is drawn leaving the drone's nose and blends onto the sim's
// path (index.js), so it still lands exactly where and when the sim says.
//
// Fixed 1/60 s game-time steps with render interpolation: identical paths at 30/60/144 Hz.
import * as THREE from 'three';
import {
  steerToward, arriveVelocity, seekVelocity, clampToDisc, leash, separation, wrapAngle,
} from '../math/steer.js';
import { CORE, DECOR } from '../context.js';
import { GeoBuilder } from '../../geo.js';

const TAU = Math.PI * 2;

/**
 * Drone body: a light dome over a dark belly (reads against grass at phone scale, and keeps
 * its contrast when a tier tints the body gold), an orange ring, a cyan nose and a rotor mast.
 */
function droneGeometry() {
  return new GeoBuilder({ flat: false })
    .sphere(0.105, 12, 8, { sy: 0.8, color: '#2c3654' })
    .add(new THREE.SphereGeometry(0.113, 12, 6, 0, TAU, 0, Math.PI / 2), { sy: 0.82, y: 0.004, color: '#f4f7fc' })
    .torus(0.15, 0.024, 4, 16, { rx: Math.PI / 2, color: '#ff9f1c' })
    .sphere(0.045, 8, 6, { z: 0.1, y: 0.012, color: '#4cc9f0' })
    .box(0.02, 0.08, 0.02, { y: 0.07, color: '#3d4456' })
    .finish();
}

export const DRONE = {
  STEP: 1 / 60,
  MAX_STEPS: 12,
  R_ORB_MAX: 0.9,
  H_ORB: 1.25,
  H_ORB2: 1.5,
  W_IDLE: 1.2,
  W_CALM: 0.5,
  W_OUTER: -0.9,
  V_CRUISE: 3.6,
  V_PASS: 5.2,
  A_MAX: 14,
  TURN_MAX: 7.5,
  H_ENGAGE: 1.1,
  H_PASS: 0.95,
  LEAD: 0.25,
  PASS_TRIGGER: 0.4,
  PASS_EXIT: 1.0,
  PASS_MAX: 0.5,
  SEP_R: 0.35,
  SEP_R_ENGAGED: 0.55,
  SEP_K: 2.5,
  SPREAD: 0.45,
  SPREAD_MAX: 0.9,
  LANE_H: 0.12,
  LAYER_GAP: 0.85,
  TRIO_W: 0.28,
  TRIO_LAG: 0.45,
  AIM_SNAP: 0.08,
  AIM_HOLD: 0.15,
  LAUNCH_T: 0.5,
  DOCK_R: 0.38,
  DOCK_H: 1.45,
  DOCK_W: 2.4,
  CAP: 128,
};

export const ST_LAUNCH = 'LAUNCH';
export const ST_ORBIT = 'ORBIT';
export const ST_APPROACH = 'APPROACH';
export const ST_PASS = 'PASS';
export const ST_RETURN = 'RETURN';
export const ST_DOCK = 'DOCK';
export const ST_DIZZY = 'DIZZY';

/** Default drone look (styles may give a group its own via `group.look`). */
export const DEFAULT_DRONE_LOOK = {
  tint: new THREE.Color('#ffffff'), eye: new THREE.Color('#7fe3ff'), scale: 1.15, formation: false, layers: false,
  trail: false, command: false, patrol: 0, dockW: DRONE.DOCK_W, arcs: 0, bulletTint: 0, bulletGlow: -1,
};

const _v = { x: 0, y: 0 };
const _g = { x: 0, y: 0 };
const _slot = { x: 0, y: 0, vx: 0, vy: 0, h: 0 };
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const SHADOW = new THREE.Color(0.05, 0.05, 0.1);
const ROTOR = new THREE.Color('#eef6ff');

function easeOutBack(k) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2;
}

export class Drones {
  /**
   * @param {object} ctx attack-FX context
   * @param {THREE.Object3D} parent where the instanced mesh lives
   */
  constructor(ctx, parent) {
    this.ctx = ctx;
    const a = ctx.actors;
    this.geo = droneGeometry();
    this.mesh = new THREE.InstancedMesh(this.geo, a.droneMat, DRONE.CAP);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color('#ffffff'));
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'attackFx:drones';
    this.parent = parent;
    parent.add(this.mesh);
    this.map = new Map(); // turret uid → vis
    this.list = []; // live vis
    this.free = [];
    this.groups = new Map(); // tower uid → group
    this.groupList = [];
    this.groupFree = [];
    this.acc = 0;
    this.clock = 0;
    this.frame = 0;
    this.overflow = 0;
    this.warned = false;
    this.passes = 0;
    this.maxLeash = 0;
  }

  get count() {
    return this.list.length;
  }

  // ---------------------------------------------------------------------------------------
  // records
  // ---------------------------------------------------------------------------------------

  _group(t) {
    let g = this.groups.get(t.uid);
    if (!g) {
      g = this.groupFree.pop() || { uid: 0, list: [], n: 0, phase: 0, phase2: 0, seen: 0, tower: null, look: DEFAULT_DRONE_LOOK, L: 2.8, dock: false, dizzy: false, w1: DRONE.W_IDLE, w2: DRONE.W_OUTER };
      g.uid = t.uid;
      g.list.length = 0;
      g.n = 0;
      g.phase = 0;
      g.phase2 = 0;
      g.tower = t;
      g.look = DEFAULT_DRONE_LOOK;
      g.dock = false;
      this.groups.set(t.uid, g);
      this.groupList.push(g);
    }
    return g;
  }

  _vis(turretUid, t, slot) {
    let v = this.map.get(turretUid);
    if (v) return v;
    if (this.list.length >= DRONE.CAP) {
      this.overflow++;
      if (!this.warned) {
        this.warned = true;
        console.warn(`[attackFx] more than ${DRONE.CAP} drones: extra drones are not drawn`);
      }
      return null;
    }
    v = this.free.pop() || {};
    v.uid = turretUid;
    v.towerUid = t.uid;
    v.slot = slot;
    v.state = ST_ORBIT;
    v.stateT = 0;
    v.x = t.x;
    v.y = t.y;
    v.h = DRONE.H_ORB;
    v.px = t.x;
    v.py = t.y;
    v.ph = DRONE.H_ORB;
    v.vx = 0;
    v.vy = 0;
    v.heading = 0;
    v.speed = 0;
    v.turn = 0;
    v.yaw = 0;
    v.pyaw = 0;
    v.bank = 0;
    v.pitch = 0;
    v.grow = 1;
    v.targetUid = null;
    v.shotTarget = null;
    v.lastShot = -1e9;
    v.exitX = 0;
    v.exitY = 0;
    v.aimT = 0;
    v.aimYaw = 0;
    v.tgtPrevX = NaN;
    v.tgtPrevY = NaN;
    v.tgtVX = 0;
    v.tgtVY = 0;
    v.muzzleX = t.x;
    v.muzzleY = t.y;
    v.muzzleH = DRONE.H_ORB;
    v.launchT = -1;
    v.l0x = 0;
    v.l0y = 0;
    v.seen = this.frame;
    v.passes = 0;
    v.lane = 0;
    v.laneN = 1;
    v.dx = t.x; // drawn (interpolated) position
    v.dy = t.y;
    v.dh = DRONE.H_ORB;
    v.gi = 0;
    v.fresh = true;
    this.map.set(turretUid, v);
    this.list.push(v);
    return v;
  }

  _release(i) {
    const v = this.list[i];
    this.map.delete(v.uid);
    this.list[i] = this.list[this.list.length - 1];
    this.list.length--;
    this.free.push(v);
  }

  /** Slot point (and its velocity) of drone `v` in group `g` at the drone clock. */
  _slotPoint(v, g, t, out) {
    const look = g.look;
    const n = g.n;
    const L = g.L;
    const R = Math.min(DRONE.R_ORB_MAX, 0.45 * L);
    let layer = 0;
    let j = v.slot;
    let m = n;
    if (look.layers || n >= 6) {
      const inner = Math.ceil(n / 2);
      if (v.slot >= inner) {
        layer = 1;
        j = v.slot - inner;
        m = n - inner;
      } else m = inner;
    }
    // the outer layer flies well clear of the inner one so a full wing reads as separate drones
    let r = layer ? Math.min(R + DRONE.LAYER_GAP, L - 0.25) : R;
    let ang;
    if (g.dock) {
      r = DRONE.DOCK_R;
      ang = (v.slot / Math.max(1, n)) * TAU + g.phase;
      out.h = DRONE.DOCK_H;
    } else if (look.patrol > 0 && v.slot === 0) {
      r = Math.min(look.patrol, L) - 0.04;
      ang = g.phase * 0.5 + 0.6;
      out.h = 1.45;
    } else if (look.formation) {
      // V-trios: a leader and two wingmen trailing behind it, one further out and one further
      // in (≈ 0.45 tiles apart at full size); outer-layer trios sit half a trio-slot over
      const trios = Math.max(1, Math.ceil(m / 3));
      const k = Math.floor(j / 3);
      const mem = j % 3;
      const w = DRONE.TRIO_W * Math.min(1, R / DRONE.R_ORB_MAX);
      ang = ((k + (layer ? 0.5 : 0)) / trios) * TAU + (layer ? g.phase2 : g.phase) - (mem ? DRONE.TRIO_LAG : 0);
      if (mem === 1) r += w;
      else if (mem === 2) r -= w;
      out.h = (layer ? DRONE.H_ORB2 : DRONE.H_ORB) + (mem ? -0.05 : 0.04);
    } else {
      ang = j * 2.39996 + 0.6 + (layer ? g.phase2 : g.phase);
      out.h = layer ? DRONE.H_ORB2 : DRONE.H_ORB;
    }
    const w = g.dock ? look.dockW : layer ? g.w2 : g.w1;
    const sa = Math.sin(ang);
    const ca = Math.cos(ang);
    out.x = t.x + sa * r;
    out.y = t.y + ca * r;
    out.vx = ca * r * w;
    out.vy = -sa * r * w;
    if (g.dizzy) {
      out.x = t.x + sa * r * 0.6;
      out.y = t.y + ca * r * 0.6;
      out.h = 0.6 + 0.08 * Math.sin(this.clock * 7 + v.slot);
    }
    return out;
  }

  // ---------------------------------------------------------------------------------------
  // events
  // ---------------------------------------------------------------------------------------

  /** `attack{kind:'build', turretUid}`: the drone launches from her backpack. */
  onBuild(ev, t) {
    const g = this._group(t);
    const v = this._vis(ev.turretUid, t, t.turrets.length - 1);
    if (!v) return;
    const f = this.ctx.facing(t);
    v.state = ST_LAUNCH;
    v.stateT = 0;
    v.launchT = 0;
    v.l0x = t.x - Math.sin(f) * 0.2;
    v.l0y = t.y - Math.cos(f) * 0.2;
    v.x = v.px = v.dx = v.l0x;
    v.y = v.py = v.dy = v.l0y;
    v.h = v.ph = v.dh = 0.6;
    v.grow = 0.35;
    v.fresh = false;
    g.seen = this.frame;
    const ctx = this.ctx;
    if (ctx.cap('launch')) {
      ctx.fx.puff(v.l0x, 0.6, v.l0y, '#ffffff', 4, 0.15, 0.18);
      const s = ctx.spr(ctx.b.groundA, CORE, ctx.R.ringSoft, t.x, 0.07, t.y, 0.2, 0.9, 0.35, ctx.col('#ffd84d'), 0.8);
      if (s) s.flags = 8;
    }
  }

  /** `attack{kind:'bullet', turretUid, targetUid}`: that drone sorties after the target. */
  onShot(ev, t) {
    this._group(t);
    let v = this.map.get(ev.turretUid);
    if (!v) {
      let slot = 0;
      for (let i = 0; i < t.turrets.length; i++) if (t.turrets[i].uid === ev.turretUid) slot = i;
      v = this._vis(ev.turretUid, t, slot);
      if (!v) return null;
    }
    const ctx = this.ctx;
    v.targetUid = ev.targetUid;
    v.shotTarget = ev.targetUid;
    v.lastShot = this.clock;
    if (v.state === ST_ORBIT || v.state === ST_RETURN || v.state === ST_DOCK || v.state === ST_LAUNCH) {
      if (v.state === ST_LAUNCH) v.grow = 1;
      v.state = ST_APPROACH;
      v.stateT = 0;
    }
    const e = ctx.enemy(ev.targetUid);
    if (e) {
      v.aimYaw = Math.atan2(e.x - v.x, e.z - v.y);
      v.aimT = DRONE.AIM_SNAP + DRONE.AIM_HOLD;
      if (v.tgtPrevX !== v.tgtPrevX) {
        v.tgtPrevX = e.x;
        v.tgtPrevY = e.z;
      }
    }
    // the bullet leaves the drone's nose (drawn position, pointing at the target)
    const yaw = e ? v.aimYaw : v.yaw;
    const look = this.groups.get(t.uid)?.look || DEFAULT_DRONE_LOOK;
    const s = 0.12 * look.scale;
    v.muzzleX = v.dx + Math.sin(yaw) * s;
    v.muzzleY = v.dy + Math.cos(yaw) * s;
    v.muzzleH = v.dh;
    if (ctx.cap('muzzle')) {
      const c = look.eye;
      ctx.spr(ctx.b.bbA, CORE, ctx.R.glow, v.muzzleX, v.muzzleH, v.muzzleY, 0.18, 0.1, 0.07, c, 0.95);
      if (ctx.q.sparks) {
        for (let k = 0; k < 2; k++) {
          const p = ctx.spr(ctx.b.bbA, DECOR, ctx.R.spark, v.muzzleX, v.muzzleH, v.muzzleY, 0.1, 0.02, 0.12, c, 0.9);
          if (p) {
            p.vx = Math.sin(yaw + (k ? 0.6 : -0.6)) * 1.6;
            p.vz = Math.cos(yaw + (k ? 0.6 : -0.6)) * 1.6;
            p.vy = 0.4;
          }
        }
      }
      if (look.arcs > 0 && ctx.q.sparks) {
        for (let k = 0; k < look.arcs; k++) {
          const a = yaw + (k ? 0.9 : -0.9);
          ctx.segs.add(v.muzzleX, v.muzzleH, v.muzzleY, v.muzzleX + Math.sin(a) * 0.18, v.muzzleH + 0.05, v.muzzleY + Math.cos(a) * 0.18, 0.05, ctx.col('#d8f6ff'), 0.08, 4 | 2);
        }
      }
    }
    return v;
  }

  /** Visual muzzle of a drone bullet (sets rec.mx / my / mz). */
  muzzleFor(turretUid, rec) {
    const v = this.map.get(turretUid);
    if (!v) return false;
    rec.mx = v.muzzleX;
    rec.my = v.muzzleY;
    rec.mz = v.muzzleH;
    return true;
  }

  // ---------------------------------------------------------------------------------------
  // frame
  // ---------------------------------------------------------------------------------------

  update(gdt) {
    const ctx = this.ctx;
    const sim = ctx.sim;
    this.frame++;
    const frame = this.frame;
    // sync groups + drones with the sim's turrets (1:1 by uid)
    for (let ti = 0; ti < sim.towers.length; ti++) {
      const t = sim.towers[ti];
      const tur = t.turrets;
      if (!tur || !tur.length) {
        const g0 = this.groups.get(t.uid);
        if (g0) g0.tower = t;
        continue;
      }
      const g = this._group(t);
      g.tower = t;
      g.seen = frame;
      g.L = Math.max(1, (t.eff?.range ?? 3) - 0.2);
      g.n = tur.length;
      g.list.length = 0;
      g.dock = t.eff?.behavior === 'chain';
      g.dizzy = t.disabled > 0;
      const calm = sim.state !== 'wave';
      g.w1 = (calm ? DRONE.W_CALM : DRONE.W_IDLE) * (ctx.reduceMotion ? 0.5 : 1);
      g.w2 = (calm ? -0.4 : DRONE.W_OUTER) * (ctx.reduceMotion ? 0.5 : 1);
      if (g.dizzy) {
        g.w1 = 0.3;
        g.w2 = -0.3;
      }
      for (let i = 0; i < tur.length; i++) {
        const v = this._vis(tur[i].uid, t, i);
        if (!v) continue;
        v.slot = i;
        v.seen = frame;
        v.gi = g.list.length;
        g.list.push(v);
      }
      for (let i = 0; i < g.list.length; i++) {
        const v = g.list[i];
        if (!v.fresh) continue;
        // first sight without a launch event (renderer created mid-battle): start on the slot
        v.fresh = false;
        this._slotPoint(v, g, t, _slot);
        v.x = v.px = v.dx = _slot.x;
        v.y = v.py = v.dy = _slot.y;
        v.h = v.ph = v.dh = _slot.h;
      }
    }
    // drones whose turret vanished (sold / tower gone): poof
    for (let i = this.list.length - 1; i >= 0; i--) {
      const v = this.list[i];
      if (v.seen === frame) continue;
      if (ctx.cap('launch')) ctx.fx.puff(v.dx, v.dh, v.dy, '#ffffff', 3, 0.15, 0.16);
      this._release(i);
    }
    for (let i = this.groupList.length - 1; i >= 0; i--) {
      const g = this.groupList[i];
      if (g.seen === frame) continue;
      this.groups.delete(g.uid);
      this.groupList[i] = this.groupList[this.groupList.length - 1];
      this.groupList.length--;
      this.groupFree.push(g);
    }
    // smoothed target velocities (enemy views move once per frame)
    if (gdt > 0) {
      for (let i = 0; i < this.list.length; i++) {
        const v = this.list[i];
        if (v.targetUid == null) continue;
        const e = ctx.enemy(v.targetUid);
        if (!e) continue;
        if (v.tgtPrevX === v.tgtPrevX) {
          const rx = (e.x - v.tgtPrevX) / gdt;
          const ry = (e.z - v.tgtPrevY) / gdt;
          if (rx * rx + ry * ry < 100) {
            v.tgtVX += (rx - v.tgtVX) * 0.3;
            v.tgtVY += (ry - v.tgtVY) * 0.3;
          }
        }
        v.tgtPrevX = e.x;
        v.tgtPrevY = e.z;
      }
    }
    this._lanes();
    // fixed steps
    this.acc += gdt;
    let steps = Math.floor((this.acc + 1e-9) / DRONE.STEP);
    let dt = DRONE.STEP;
    let alpha;
    if (steps > DRONE.MAX_STEPS) {
      dt = this.acc / DRONE.MAX_STEPS;
      steps = DRONE.MAX_STEPS;
      this.acc = 0;
      alpha = 1;
    } else {
      this.acc = Math.max(0, this.acc - steps * DRONE.STEP);
      alpha = Math.min(1, this.acc / DRONE.STEP);
    }
    for (let s = 0; s < steps; s++) {
      this.clock += dt;
      for (let gi = 0; gi < this.groupList.length; gi++) {
        const g = this.groupList[gi];
        g.phase += g.w1 * dt;
        g.phase2 += g.w2 * dt;
      }
      for (let i = 0; i < this.list.length; i++) {
        const v = this.list[i];
        v.px = v.x;
        v.py = v.y;
        v.ph = v.h;
        v.pyaw = v.yaw;
        const g = this.groups.get(v.towerUid);
        if (g) this._step(v, g, g.tower, dt);
      }
    }
    this._draw(alpha);
  }

  /**
   * Strafing lanes: drones chasing the same enemy each take their own side of it (lane / laneN,
   * ordered by owner and slot so a lane never jumps when another drone leaves).
   */
  _lanes() {
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      v.lane = 0;
      v.laneN = 1;
      if (v.targetUid == null) continue;
      for (let k = 0; k < list.length; k++) {
        const o = list[k];
        if (k === i || o.targetUid !== v.targetUid) continue;
        v.laneN++;
        if (o.towerUid < v.towerUid || (o.towerUid === v.towerUid && o.slot < v.slot)) v.lane++;
      }
    }
  }

  _step(v, g, t, dt) {
    const ctx = this.ctx;
    const low = !ctx.q.pass || ctx.reduceMotion;
    const L = g.L;
    v.stateT += dt;
    let hT = DRONE.H_ORB;
    let vmax = DRONE.V_CRUISE;
    let goalSet = false;
    if (g.dizzy && v.state !== ST_LAUNCH) {
      v.state = ST_DIZZY;
    } else if (v.state === ST_DIZZY) {
      v.state = ST_RETURN;
      v.stateT = 0;
    }
    const disengage = Math.max(0.9, 2.5 / Math.max(0.05, t.turretSpec?.rate || 1));
    if (v.state === ST_APPROACH || v.state === ST_PASS) {
      const e = ctx.enemy(v.targetUid);
      if (!e || this.clock - v.lastShot > disengage) {
        v.state = ST_RETURN;
        v.stateT = 0;
        v.targetUid = null;
      }
    }
    switch (v.state) {
      case ST_LAUNCH: {
        v.launchT += dt;
        const k = Math.min(1, v.launchT / DRONE.LAUNCH_T);
        this._slotPoint(v, g, t, _slot);
        const u = 1 - k;
        const mx = (v.l0x + _slot.x) / 2;
        const my = (v.l0y + _slot.y) / 2;
        const apex = (0.6 + _slot.h) / 2 + 0.8;
        const nx = u * u * v.l0x + 2 * u * k * mx + k * k * _slot.x;
        const ny = u * u * v.l0y + 2 * u * k * my + k * k * _slot.y;
        const dx = nx - v.x;
        const dy = ny - v.y;
        v.x = nx;
        v.y = ny;
        v.h = u * u * 0.6 + 2 * u * k * apex + k * k * _slot.h;
        if (dx * dx + dy * dy > 1e-10) v.heading = Math.atan2(dx, dy);
        v.speed = Math.sqrt(dx * dx + dy * dy) / dt;
        v.vx = Math.sin(v.heading) * v.speed;
        v.vy = Math.cos(v.heading) * v.speed;
        v.grow = 0.35 + 0.65 * Math.min(1.1, easeOutBack(k));
        v.yaw = v.heading;
        if (k >= 1) {
          v.state = g.dock ? ST_DOCK : ST_ORBIT;
          v.stateT = 0;
          v.launchT = -1;
          v.grow = 1;
          v.speed = Math.min(DRONE.V_CRUISE, Math.hypot(_slot.vx, _slot.vy));
        }
        leash(v, t.x, t.y, L);
        return;
      }
      case ST_ORBIT:
      case ST_DOCK:
      case ST_DIZZY: {
        if (v.state !== ST_DIZZY) v.state = g.dock ? ST_DOCK : ST_ORBIT;
        this._slotPoint(v, g, t, _slot);
        arriveVelocity(v, _slot.x, _slot.y, DRONE.V_CRUISE, DRONE.A_MAX, _v, _slot.vx, _slot.vy, 4);
        hT = _slot.h + 0.04 * Math.sin(this.clock * 2.2 + v.slot * 1.7);
        goalSet = true;
        break;
      }
      case ST_RETURN: {
        this._slotPoint(v, g, t, _slot);
        arriveVelocity(v, _slot.x, _slot.y, DRONE.V_CRUISE, DRONE.A_MAX, _v, _slot.vx, _slot.vy, 4);
        hT = _slot.h;
        goalSet = true;
        const dx = _slot.x - v.x;
        const dy = _slot.y - v.y;
        if (dx * dx + dy * dy < 0.12 * 0.12) {
          v.state = g.dock ? ST_DOCK : ST_ORBIT;
          v.stateT = 0;
        }
        break;
      }
      case ST_APPROACH: {
        const e = ctx.enemy(v.targetUid);
        // each drone strafes its target from its own side (a slowly turning offset), so a
        // squadron on one enemy fans out instead of stacking: drones sharing a target split the
        // circle around it into lanes, wider and at staggered heights the more of them there are
        const ln = v.laneN;
        const sa = (ln > 1 ? (v.lane / ln) * TAU : v.slot * 2.39996) + this.clock * 1.2;
        const spread = ln > 1 ? Math.min(DRONE.SPREAD_MAX, DRONE.SPREAD + 0.08 * ln) : DRONE.SPREAD;
        const ex = e.x + v.tgtVX * DRONE.LEAD + Math.sin(sa) * spread;
        const ey = e.z + v.tgtVY * DRONE.LEAD + Math.cos(sa) * spread;
        hT = DRONE.H_ENGAGE + (ln > 1 ? ((v.lane % 3) - 1) * DRONE.LANE_H : 0);
        if (low) {
          // hover beside the target and strafe sideways (no loops)
          let dx = e.x - t.x;
          let dy = e.z - t.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          dx /= d;
          dy /= d;
          const lat = ln > 1 ? Math.max(-1.2, Math.min(1.2, (v.lane - (ln - 1) / 2) * 0.3)) : 0;
          const side = lat + 0.25 * Math.sin(this.clock * TAU * 1.5 + v.slot);
          if (ln > 1 && d > L - 0.3) {
            // target past her ring edge: hover in a spread along the arc facing it
            const a = Math.atan2(dx, dy) + (v.lane / (ln - 1) - 0.5) * Math.min(1.5, 0.34 * (ln - 1)) + 0.1 * Math.sin(this.clock * TAU * 0.5 + v.slot);
            const r = L - 0.2 - 0.35 * (v.lane % 2);
            _g.x = t.x + Math.sin(a) * r;
            _g.y = t.y + Math.cos(a) * r;
          } else clampToDisc(e.x - dx * 0.6 - dy * side, e.z - dy * 0.6 + dx * side, t.x, t.y, L - 0.05, _g);
          arriveVelocity(v, _g.x, _g.y, DRONE.V_CRUISE, DRONE.A_MAX, _v, v.tgtVX, v.tgtVY, 4);
        } else {
          let gx = ex;
          let gy = ey;
          const tx = e.x - t.x;
          const ty = e.z - t.y;
          if (tx * tx + ty * ty > (L - 0.3) * (L - 0.3)) {
            // target at or past her ring edge (drone shots out-range her ring): the wing spreads
            // along the arc of her ring that faces it, two rows deep, instead of piling up on
            // the one point where the leash would clamp every lane
            const a = Math.atan2(tx, ty) + (ln > 1 ? (v.lane / (ln - 1) - 0.5) * Math.min(1.5, 0.34 * (ln - 1)) : 0) + 0.18 * Math.sin(this.clock * 1.3 + v.slot);
            const r = L - 0.2 - (ln > 1 ? 0.35 * (v.lane % 2) : 0);
            gx = t.x + Math.sin(a) * r;
            gy = t.y + Math.cos(a) * r;
          } else if ((gx - t.x) * (gx - t.x) + (gy - t.y) * (gy - t.y) > (L - 0.05) * (L - 0.05)) {
            // lane outside her ring: take the mirrored lane on the near side of the target
            gx = 2 * (e.x + v.tgtVX * DRONE.LEAD) - ex;
            gy = 2 * (e.z + v.tgtVY * DRONE.LEAD) - ey;
          }
          clampToDisc(gx, gy, t.x, t.y, L - 0.05, _g);
          gx = _g.x;
          gy = _g.y;
          seekVelocity(v, gx, gy, vmax, _v);
          const hx = gx - v.x;
          const hy = gy - v.y;
          if (hx * hx + hy * hy < DRONE.PASS_TRIGGER * DRONE.PASS_TRIGGER) {
            v.state = ST_PASS;
            v.stateT = 0;
            v.passes++;
            this.passes++;
            clampToDisc(gx + Math.sin(v.heading) * DRONE.PASS_EXIT, gy + Math.cos(v.heading) * DRONE.PASS_EXIT, t.x, t.y, L - 0.05, _g);
            v.exitX = _g.x;
            v.exitY = _g.y;
          }
        }
        goalSet = true;
        break;
      }
      case ST_PASS: {
        seekVelocity(v, v.exitX, v.exitY, DRONE.V_PASS, _v);
        hT = DRONE.H_PASS;
        vmax = DRONE.V_PASS;
        goalSet = true;
        const dx = v.exitX - v.x;
        const dy = v.exitY - v.y;
        if (dx * dx + dy * dy < 0.25 * 0.25 || v.stateT > DRONE.PASS_MAX) {
          v.state = ST_APPROACH;
          v.stateT = 0;
        }
        break;
      }
      default:
        break;
    }
    if (!goalSet) {
      _v.x = 0;
      _v.y = 0;
    }
    if (ctx.q.separation && g.list.length > 1 && v.state !== ST_PASS && g.list[v.gi] === v) {
      separation(g.list, g.list.length, v.gi, v.state === ST_APPROACH ? DRONE.SEP_R_ENGAGED : DRONE.SEP_R, DRONE.SEP_K, _v);
    }
    steerToward(v, _v.x, _v.y, DRONE.A_MAX, DRONE.TURN_MAX, dt);
    leash(v, t.x, t.y, L);
    v.h += (hT - v.h) * (1 - Math.exp(-5 * dt));
    // body yaw: snap toward the target on a shot, else follow the flight direction
    let yawT = v.heading;
    if (v.aimT > 0) {
      v.aimT -= dt;
      const e = ctx.enemy(v.shotTarget);
      if (e) v.aimYaw = Math.atan2(e.x - v.x, e.z - v.y);
      yawT = v.aimYaw;
    }
    v.yaw = wrapAngle(v.yaw + wrapAngle(yawT - v.yaw) * (1 - Math.exp(-dt / (DRONE.AIM_SNAP * 0.4))));
    const bankT = ctx.q.bank ? Math.max(-0.5, Math.min(0.5, -0.08 * v.speed * v.turn)) : 0;
    v.bank += (bankT - v.bank) * (1 - Math.exp(-10 * dt));
    v.pitch += ((v.speed > 4 ? -0.15 : 0) - v.pitch) * (1 - Math.exp(-8 * dt));
  }

  _draw(alpha) {
    const ctx = this.ctx;
    const R = ctx.R;
    const mesh = this.mesh;
    const rs = ctx.readScale;
    let n = 0;
    let maxLeash = 0;
    const trailsAll = ctx.q.trails >= 2;
    for (let i = 0; i < this.list.length; i++) {
      const v = this.list[i];
      const g = this.groups.get(v.towerUid);
      if (!g) continue;
      const t = g.tower;
      const look = g.look;
      const x = v.px + (v.x - v.px) * alpha;
      const y = v.py + (v.y - v.py) * alpha;
      const h = v.ph + (v.h - v.ph) * alpha;
      v.dx = x;
      v.dy = y;
      v.dh = h;
      const lr = Math.hypot(x - t.x, y - t.y) / g.L;
      if (lr > maxLeash) maxLeash = lr;
      const cmd = look.command && v.slot === 0;
      const sc = look.scale * v.grow * rs * (cmd ? 1.3 : 1);
      const yaw = v.pyaw + wrapAngle(v.yaw - v.pyaw) * alpha;
      _e.set(v.pitch, yaw, v.bank, 'YXZ');
      _q.setFromEuler(_e);
      _p.set(x, h, y);
      _s.setScalar(sc);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(n, _m);
      mesh.setColorAt(n, look.tint);
      n++;
      // ground shadow: always drawn (true position read from the 55° camera)
      const ss = 0.3 * (1 - 0.25 * Math.min(1.6, h)) * Math.max(0.6, sc);
      ctx.quad(ctx.b.groundN, CORE, x, 0.06, y, ss, ss, R.shadow, SHADOW, 0.5);
      // eye glow (+ anticipation just before the next shot)
      const sy = Math.sin(yaw);
      const cy = Math.cos(yaw);
      let eg = 0.12;
      if ((v.state === ST_APPROACH || v.state === ST_PASS) && t.turrets) {
        const tu = t.turrets[v.slot];
        if (tu && tu.uid === v.uid && tu.cooldown > 0 && tu.cooldown <= 0.12) eg = 0.2;
      }
      ctx.quad(ctx.b.bbA, DECOR, x + sy * 0.09 * sc, h, y + cy * 0.09 * sc, eg * sc, eg * sc, R.glow, look.eye, 0.8);
      // spinning rotor over the mast (flat, additive): reads as a little craft, not a disc
      ctx.quad(ctx.b.groundA, DECOR, x, h + 0.15 * sc, y, 0.4 * sc, 0.4 * sc, R.rotor, ROTOR, 0.5, ctx.time * 31 + v.slot);
      if (cmd && Math.sin(ctx.time * 9) > 0) ctx.quad(ctx.b.bbA, DECOR, x, h + 0.13 * sc, y, 0.07, 0.07, R.glow, ctx.col('#ff6b6b'), 1);
      if ((trailsAll || (look.trail && ctx.q.trails >= 1)) && v.speed > 1.2) {
        const k = 0.35 * Math.min(1, v.speed / DRONE.V_PASS);
        ctx.line(ctx.b.bbA, DECOR, x, h, y, x - (v.vx / v.speed) * k, h + 0.02, y - (v.vy / v.speed) * k, 0.07 * sc, look.trail ? look.eye : look.tint, 0.45);
      }
    }
    mesh.count = n;
    if (n) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
    this.maxLeash = maxLeash;
    // no extra ring when she is selected: the drones never leave her own range ring
  }

  /** Snapshot for tests / e2e (allocates; not for the frame loop). */
  probe() {
    const out = [];
    for (const v of this.list) {
      const g = this.groups.get(v.towerUid);
      const t = g?.tower;
      out.push({
        uid: v.uid, towerUid: v.towerUid, x: v.dx, y: v.dy, h: v.dh, sx: v.x, sy: v.y, state: v.state, targetUid: v.targetUid,
        lastShotTarget: v.shotTarget, leash: t ? Math.hypot(v.x - t.x, v.y - t.y) / g.L : 0, passes: v.passes, slot: v.slot,
      });
    }
    return out;
  }

  dispose() {
    this.parent.remove(this.mesh);
    this.mesh.dispose();
    this.geo.dispose();
  }
}

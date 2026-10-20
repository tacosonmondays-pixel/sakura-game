// Drone layer (Chika and any other turret owner). One visual drone per sim turret uid.
//
// The sim flies every drone (docs/specs/CHIKA_REWORK.md §3 / §16): it picks a quarry, follows it,
// shoots it, flies home, and the player's flight mode moves the wing. This module never steers a
// drone of its own (Chika rework M5, §6.1): it draws each one where the sim has it, between steps
// (`p + (x − p) × α`, α = the renderer's step fraction, actors.alpha) and only adds decoration:
//   • at home: a small orbit around the drone's own home point (≤ 0.35 tiles), the wing's layers
//     at two heights; Tesla (chain) drones dock high over her coil while home;
//   • hunting: a sway across the line to its quarry (0.25 tiles); the whole decoration of a hunting
//     drone fades to 0 over the 0.15 s before each shot (its cooldown) and grows back over the
//     0.15 s after it, so the drawn drone is the sim drone when it fires;
//   • drones sharing a spot fan out (render only);
//   • states kept from the first attack-FX pass: LAUNCH (a hop from her backpack, the sim's first
//     0.3 s cooldown), DOCK (Tesla, only while home), DIZZY (she is sabotaged or this drone is
//     jammed: it sinks, wobbles and sparks).
// Truth rules (docs/ATTACK_FX.md T4 / T8): drawn = sim ± 0.35 tiles (LAUNCH excepted), the bullet
// leaves the sim position (muzzleFor), the targets are the sim's. Yaw, bank and pitch come from the
// sim velocity; heights ease in fixed 1/60 s game-time steps (identical at 30/60/144 Hz).
// Each frame the drawn positions are written to actors.droneDrawn, which picking, the drone ring /
// tether and renderer.droneScreen() read.
import * as THREE from 'three';
import { wrapAngle } from '../math/steer.js';
import { CORE, DECOR } from '../context.js';
import { GeoBuilder } from '../../geo.js';
import { STEP } from '../../../sim/constants.js';

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
  /** Decoration never moves a drawn drone further than this from the sim drone (tiles). */
  DECOR_MAX: 0.35,
  /** Home orbit around the drone's own home point (tiles, rad/s). */
  R_HOME: 0.18,
  W_IDLE: 1.6,
  W_CALM: 0.7,
  W_OUTER: -1.2,
  /** Hunting sway: amplitude (tiles), fades to 0 as the next shot comes (cooldown → 0). */
  SWAY: 0.25,
  SWAY_FADE: 0.15,
  SWAY_HZ: 0.9,
  /** Drones of one wing closer than this fan out (render only). */
  FAN_R: 0.3,
  /** Heights: home orbit (inner / outer layer), engaged, docked, dizzy. */
  H_ORB: 1.25,
  H_ORB2: 1.5,
  H_ENGAGE: 1.1,
  LANE_H: 0.1,
  DOCK_R: 0.38,
  DOCK_H: 1.45,
  DOCK_W: 2.4,
  H_DIZZY: 0.6,
  /** LAUNCH: the hop from her backpack (game seconds = the sim drone's first cooldown). */
  LAUNCH_T: 0.3,
  /** A state change cross-fades the decoration over this long (s) instead of popping. */
  BLEND_T: 0.22,
  AIM_SNAP: 0.08,
  AIM_HOLD: 0.15,
  CAP: 128,
};

export const ST_LAUNCH = 'LAUNCH';
export const ST_ORBIT = 'ORBIT';
export const ST_HUNT = 'HUNT';
export const ST_RETURN = 'RETURN';
export const ST_DOCK = 'DOCK';
export const ST_DIZZY = 'DIZZY';

/** Default drone look (styles may give a group its own via `group.look`). */
export const DEFAULT_DRONE_LOOK = {
  tint: new THREE.Color('#ffffff'), eye: new THREE.Color('#7fe3ff'), scale: 1.15, formation: false, layers: false,
  trail: false, command: false, patrol: 0, dockW: DRONE.DOCK_W, arcs: 0, bulletTint: 0, bulletGlow: -1,
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const SHADOW = new THREE.Color(0.05, 0.05, 0.1);
const ROTOR = new THREE.Color('#eef6ff');
const REPAIR = new THREE.Color('#7be08a');
const DIZZY_STAR = new THREE.Color('#ffd84d');

function easeOutBack(k) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Smoothstep of clamp01(v): 0 → 1 with zero slope at both ends. */
const smooth01 = (v) => {
  const k = clamp01(v);
  return k * k * (3 - 2 * k);
};

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
    this.shots = 0;
    this.maxDecor = 0; // largest |drawn − sim| this frame (tiles; LAUNCH excepted)
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
      g = this.groupFree.pop() || { uid: 0, list: [], n: 0, phase: 0, phase2: 0, seen: 0, tower: null, look: DEFAULT_DRONE_LOOK, dock: false, dizzy: false, w1: DRONE.W_IDLE, w2: DRONE.W_OUTER };
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

  _vis(tu, t, slot) {
    let v = this.map.get(tu.uid);
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
    v.uid = tu.uid;
    v.towerUid = t.uid;
    v.tu = tu;
    v.slot = slot;
    v.state = ST_ORBIT;
    v.bx = tu.x; // the sim drone, drawn between steps
    v.by = tu.y;
    v.ox = 0; // decoration offset (drawn = sim + this)
    v.oy = 0;
    v.gox = 0; // this state's decoration now
    v.goy = 0;
    v.fromX = 0; // the offset when the state last changed (cross-faded out over BLEND_T)
    v.fromY = 0;
    v.blend = 1;
    v.lastState = ST_ORBIT;
    v.shotK = 1;
    v.h = DRONE.H_ORB;
    v.ph = DRONE.H_ORB;
    v.yaw = tu.facing || 0;
    v.pyaw = v.yaw;
    v.bank = 0;
    v.pitch = 0;
    v.speed = 0;
    v.vx = 0;
    v.vy = 0;
    v.grow = 1;
    v.targetUid = null;
    v.shotTarget = null;
    v.lastShot = -1e9;
    v.aimT = 0;
    v.aimYaw = 0;
    v.muzzleX = tu.x;
    v.muzzleY = tu.y;
    v.muzzleH = DRONE.H_ORB;
    v.launchT = -1;
    v.l0x = 0;
    v.l0y = 0;
    v.seen = this.frame;
    v.dx = tu.x; // drawn position
    v.dy = tu.y;
    v.dh = DRONE.H_ORB;
    v.decor = 0;
    v.gi = 0;
    this.map.set(tu.uid, v);
    this.list.push(v);
    return v;
  }

  _release(i) {
    const v = this.list[i];
    this.map.delete(v.uid);
    this.list[i] = this.list[this.list.length - 1];
    this.list.length--;
    v.tu = null;
    this.free.push(v);
  }

  _turret(t, uid) {
    const tur = t.turrets || [];
    for (let i = 0; i < tur.length; i++) if (tur[i].uid === uid) return { tu: tur[i], slot: i };
    return null;
  }

  // ---------------------------------------------------------------------------------------
  // events
  // ---------------------------------------------------------------------------------------

  /** `attack{kind:'build', turretUid}`: the drone hops out of her backpack. */
  onBuild(ev, t) {
    const g = this._group(t);
    const found = this._turret(t, ev.turretUid);
    if (!found) return;
    const v = this._vis(found.tu, t, found.slot);
    if (!v) return;
    const f = this.ctx.facing(t);
    v.state = ST_LAUNCH;
    v.launchT = 0;
    v.l0x = t.x - Math.sin(f) * 0.2;
    v.l0y = t.y - Math.cos(f) * 0.2;
    v.dx = v.l0x;
    v.dy = v.l0y;
    v.h = v.ph = v.dh = 0.6;
    v.grow = 0.35;
    g.seen = this.frame;
    const ctx = this.ctx;
    if (ctx.cap('launch')) {
      ctx.fx.puff(v.l0x, 0.6, v.l0y, '#ffffff', 4, 0.15, 0.18);
      const s = ctx.spr(ctx.b.groundA, CORE, ctx.R.ringSoft, t.x, 0.07, t.y, 0.2, 0.9, 0.35, ctx.col('#ffd84d'), 0.8);
      if (s) s.flags = 8;
    }
  }

  /** `attack{kind:'bullet', turretUid, targetUid}`: that drone fired (the sim chose the target). */
  onShot(ev, t) {
    this._group(t);
    let v = this.map.get(ev.turretUid);
    if (!v) {
      const found = this._turret(t, ev.turretUid);
      if (!found) return null;
      v = this._vis(found.tu, t, found.slot);
      if (!v) return null;
    }
    const ctx = this.ctx;
    const tu = v.tu;
    this.shots++;
    v.targetUid = ev.targetUid;
    v.shotTarget = ev.targetUid;
    v.lastShot = this.clock;
    if (v.state === ST_LAUNCH) {
      v.launchT = -1;
      v.grow = 1;
    }
    // the bullet leaves the sim drone (where the sim spawned it), at the drawn height
    v.muzzleX = tu ? tu.x : v.dx;
    v.muzzleY = tu ? tu.y : v.dy;
    v.muzzleH = v.dh;
    const e = ctx.enemy(ev.targetUid);
    v.aimYaw = e ? Math.atan2(e.x - v.muzzleX, e.z - v.muzzleY) : tu ? tu.facing : v.yaw;
    v.aimT = DRONE.AIM_SNAP + DRONE.AIM_HOLD;
    if (ctx.cap('muzzle')) {
      const look = this.groups.get(t.uid)?.look || DEFAULT_DRONE_LOOK;
      const c = look.eye;
      const s = 0.12 * look.scale;
      const yaw = v.aimYaw;
      const nx = v.muzzleX + Math.sin(yaw) * s;
      const ny = v.muzzleY + Math.cos(yaw) * s;
      ctx.spr(ctx.b.bbA, CORE, ctx.R.glow, nx, v.muzzleH, ny, 0.18, 0.1, 0.07, c, 0.95);
      if (ctx.q.sparks) {
        for (let k = 0; k < 2; k++) {
          const p = ctx.spr(ctx.b.bbA, DECOR, ctx.R.spark, nx, v.muzzleH, ny, 0.1, 0.02, 0.12, c, 0.9);
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
          ctx.segs.add(nx, v.muzzleH, ny, nx + Math.sin(a) * 0.18, v.muzzleH + 0.05, ny + Math.cos(a) * 0.18, 0.05, ctx.col('#d8f6ff'), 0.08, 4 | 2);
        }
      }
    }
    return v;
  }

  /** Visual muzzle of a drone bullet (sets rec.mx / my / mz): the sim drone at its drawn height. */
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
    const alpha = clamp01(ctx.actors?.alpha ?? 1);
    const calm = sim.state !== 'wave';
    // sync groups + drones with the sim's turrets (1:1 by uid); where the sim has each one now
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
      g.n = tur.length;
      g.list.length = 0;
      g.dock = t.eff?.behavior === 'chain';
      g.dizzy = t.disabled > 0;
      g.roam = t.turretSpec?.leash > 0;
      g.w1 = (calm ? DRONE.W_CALM : DRONE.W_IDLE) * (ctx.reduceMotion ? 0.5 : 1);
      g.w2 = (calm ? -DRONE.W_CALM : DRONE.W_OUTER) * (ctx.reduceMotion ? 0.5 : 1);
      for (let i = 0; i < tur.length; i++) {
        const tu = tur[i];
        const v = this._vis(tu, t, i);
        if (!v) continue;
        v.tu = tu;
        v.slot = i;
        v.seen = frame;
        v.gi = g.list.length;
        g.list.push(v);
        // between the sim's last two steps; a stalled girl's drones did not step (px is stale)
        const still = g.dizzy || !(tu.px != null) || !g.roam;
        v.bx = still ? tu.x : tu.px + (tu.x - tu.px) * alpha;
        v.by = still ? tu.y : tu.py + (tu.y - tu.py) * alpha;
        const mvx = g.dizzy || tu.px == null ? 0 : (tu.x - tu.px) / STEP;
        const mvy = g.dizzy || tu.py == null ? 0 : (tu.y - tu.py) / STEP;
        v.vx = mvx;
        v.vy = mvy;
        v.speed = Math.sqrt(mvx * mvx + mvy * mvy);
        v.targetUid = tu.targetUid ?? null;
        if (v.launchT >= 0) v.state = ST_LAUNCH;
        else if (g.dizzy || tu.jam > 0) v.state = ST_DIZZY;
        else if (tu.tgt || tu.targetUid != null) v.state = ST_HUNT;
        else if (tu.moving) v.state = ST_RETURN;
        else v.state = g.dock ? ST_DOCK : ST_ORBIT;
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
    // fixed steps: orbit phases, eased offsets / heights / yaw
    this.acc += gdt;
    let steps = Math.floor((this.acc + 1e-9) / DRONE.STEP);
    let dt = DRONE.STEP;
    let a;
    if (steps > DRONE.MAX_STEPS) {
      dt = this.acc / DRONE.MAX_STEPS;
      steps = DRONE.MAX_STEPS;
      this.acc = 0;
      a = 1;
    } else {
      this.acc = Math.max(0, this.acc - steps * DRONE.STEP);
      a = Math.min(1, this.acc / DRONE.STEP);
    }
    for (let s = 0; s < steps; s++) {
      this.clock += dt;
      for (let gi = 0; gi < this.groupList.length; gi++) {
        const g = this.groupList[gi];
        g.phase += g.w1 * dt;
        g.phase2 += g.w2 * dt;
        this._goals(g);
      }
      for (let i = 0; i < this.list.length; i++) {
        const v = this.list[i];
        v.ph = v.h;
        v.pyaw = v.yaw;
        const g = this.groups.get(v.towerUid);
        if (g) this._step(v, g, dt);
      }
    }
    if (!steps) for (let gi = 0; gi < this.groupList.length; gi++) this._goals(this.groupList[gi]);
    this._draw(a);
  }

  /** Decoration goals of one wing (offsets from each sim drone), then the fan-out between them. */
  _goals(g) {
    const t = g.tower;
    const list = g.list;
    const n = list.length;
    const look = g.look;
    const inner = look.layers || n >= 6 ? Math.ceil(n / 2) : n;
    for (let i = 0; i < n; i++) {
      const v = list[i];
      let gx = 0;
      let gy = 0;
      if (v.state === ST_ORBIT || v.state === ST_RETURN) {
        // a small orbit around its own home point (none while flying home)
        if (v.state === ST_ORBIT) {
          const outer = v.slot >= inner;
          const ang = v.slot * 2.39996 + 0.6 + (outer ? g.phase2 : g.phase);
          const r = DRONE.R_HOME * (look.formation ? 0.8 : 1);
          gx = Math.sin(ang) * r;
          gy = Math.cos(ang) * r;
        }
      } else if (v.state === ST_DOCK) {
        // Tesla: in toward her coil (as far as the decoration allows), a quick tight spin
        const dx = t.x - v.bx;
        const dy = t.y - v.by;
        const d = Math.sqrt(dx * dx + dy * dy);
        const pull = d > 1e-6 ? Math.min(DRONE.DECOR_MAX - 0.06, Math.max(0, d - DRONE.DOCK_R)) / d : 0;
        const ang = g.phase * (look.dockW / DRONE.W_IDLE) + v.slot * 2.39996;
        gx = dx * pull + Math.sin(ang) * 0.05;
        gy = dy * pull + Math.cos(ang) * 0.05;
      } else if (v.state === ST_HUNT) {
        // sway across the line to the quarry (phase 0 at each shot)
        const amp = DRONE.SWAY * (this.ctx.reduceMotion ? 0.5 : 1);
        const e = this.ctx.enemy(v.targetUid);
        let fx = e ? e.x - v.bx : Math.sin(v.yaw);
        let fy = e ? e.z - v.by : Math.cos(v.yaw);
        const fl = Math.sqrt(fx * fx + fy * fy) || 1;
        fx /= fl;
        fy /= fl;
        const since = v.lastShot > -1e8 ? this.clock - v.lastShot : this.clock + v.slot * 0.37;
        const w = amp * Math.sin(TAU * DRONE.SWAY_HZ * since);
        gx = -fy * w;
        gy = fx * w;
      } else if (v.state === ST_DIZZY) {
        const ang = this.clock * 7 + v.slot;
        gx = Math.sin(ang) * 0.06;
        gy = Math.cos(ang * 1.3) * 0.06;
      }
      v.gox = gx;
      v.goy = gy;
    }
    // drones of the wing on (nearly) the same spot fan out by slot
    for (let i = 0; i < n; i++) {
      const vi = list[i];
      if (vi.state === ST_LAUNCH) continue;
      for (let j = i + 1; j < n; j++) {
        const vj = list[j];
        if (vj.state === ST_LAUNCH) continue;
        let dx = vj.bx - vi.bx;
        let dy = vj.by - vi.by;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= DRONE.FAN_R) continue;
        if (d > 1e-4) {
          dx /= d;
          dy /= d;
        } else {
          const ang = (vj.slot - vi.slot) * 2.39996 + vi.slot;
          dx = Math.sin(ang);
          dy = Math.cos(ang);
        }
        const push = (DRONE.FAN_R - d) * 0.5;
        vi.gox -= dx * push;
        vi.goy -= dy * push;
        vj.gox += dx * push;
        vj.goy += dy * push;
      }
    }
    for (let i = 0; i < n; i++) {
      const v = list[i];
      const l = Math.sqrt(v.gox * v.gox + v.goy * v.goy);
      if (l > DRONE.DECOR_MAX) {
        v.gox *= DRONE.DECOR_MAX / l;
        v.goy *= DRONE.DECOR_MAX / l;
      }
      // a hunting drone is its sim drone at each shot: no decoration for 0.15 s either side
      v.shotK = 1;
      if (v.state === ST_HUNT) {
        const before = smooth01((v.tu?.cooldown || 0) / DRONE.SWAY_FADE);
        const after = v.lastShot > -1e8 ? smooth01((this.clock - v.lastShot) / DRONE.SWAY_FADE) : 1;
        v.shotK = before < after ? before : after;
      }
    }
  }

  _step(v, g, dt) {
    const look = g.look;
    let hT = DRONE.H_ORB;
    if (v.state === ST_LAUNCH) {
      // The hop ends on one fixed sub-step, but update() only re-reads the state next frame: the
      // frame's later sub-steps still see LAUNCH with launchT = -1 (done). Counting on from -1 fed
      // easeOutBack a negative time and set grow to about -107 for good (the owner's giant drone at
      // 3x, Sandbox, 5-0-2), so only a running hop advances, and grow stays within the hop's range.
      if (v.launchT >= 0) {
        v.launchT += dt;
        v.grow = 0.35 + 0.65 * Math.min(1.1, easeOutBack(clamp01(v.launchT / DRONE.LAUNCH_T)));
        if (v.launchT >= DRONE.LAUNCH_T) {
          v.launchT = -1;
          v.grow = 1;
        }
      }
      hT = DRONE.H_ORB;
    } else if (v.state === ST_ORBIT) {
      const n = g.n;
      const inner = look.layers || n >= 6 ? Math.ceil(n / 2) : n;
      const outer = v.slot >= inner;
      hT = (outer ? DRONE.H_ORB2 : DRONE.H_ORB) + (look.formation ? (v.slot % 3 ? -0.05 : 0.04) : 0) + 0.04 * Math.sin(this.clock * 2.2 + v.slot * 1.7);
    } else if (v.state === ST_DOCK) {
      hT = DRONE.DOCK_H;
    } else if (v.state === ST_HUNT) {
      hT = DRONE.H_ENGAGE + ((v.slot % 3) - 1) * DRONE.LANE_H;
    } else if (v.state === ST_RETURN) {
      hT = DRONE.H_ORB;
    } else if (v.state === ST_DIZZY) {
      hT = DRONE.H_DIZZY + 0.08 * Math.sin(this.clock * 7 + v.slot);
    }
    // the decoration: this state's, cross-faded from where it was when the state changed (both
    // inside the DECOR_MAX disc, so the blend is too)
    if (v.state !== v.lastState) {
      v.lastState = v.state;
      v.fromX = v.ox;
      v.fromY = v.oy;
      v.blend = 0;
    }
    if (v.blend < 1) v.blend = Math.min(1, v.blend + dt / DRONE.BLEND_T);
    const s = smooth01(v.blend);
    const k = v.shotK ?? 1;
    v.ox = (v.fromX + (v.gox - v.fromX) * s) * k;
    v.oy = (v.fromY + (v.goy - v.fromY) * s) * k;
    v.h += (hT - v.h) * (1 - Math.exp(-5 * dt));
    // body yaw: snap toward the target on a shot, else follow the sim's flight direction
    let yawT = v.yaw;
    if (v.aimT > 0) {
      v.aimT -= dt;
      const e = this.ctx.enemy(v.shotTarget);
      if (e) v.aimYaw = Math.atan2(e.x - v.bx, e.z - v.by);
      yawT = v.aimYaw;
    } else if (v.speed > 0.3) yawT = Math.atan2(v.vx, v.vy);
    else if (v.state === ST_ORBIT || v.state === ST_DOCK) {
      // at home: nose along the little orbit
      yawT = Math.atan2(v.ox, v.oy) + (v.slot >= Math.ceil(g.n / 2) && (look.layers || g.n >= 6) ? -Math.PI / 2 : Math.PI / 2);
    }
    const turn = wrapAngle(yawT - v.yaw) * (1 - Math.exp(-dt / (DRONE.AIM_SNAP * 0.6)));
    v.yaw = wrapAngle(v.yaw + turn);
    const bankT = this.ctx.q.bank ? Math.max(-0.5, Math.min(0.5, -0.08 * v.speed * (dt > 0 ? turn / dt : 0))) : 0;
    v.bank += (bankT - v.bank) * (1 - Math.exp(-10 * dt));
    v.pitch += ((v.speed > 3 ? -0.15 : 0) - v.pitch) * (1 - Math.exp(-8 * dt));
  }

  _draw(alpha) {
    const ctx = this.ctx;
    const R = ctx.R;
    const mesh = this.mesh;
    const rs = ctx.readScale;
    const drawn = ctx.actors?.droneDrawn || null;
    let n = 0;
    let maxDecor = 0;
    const trailsAll = ctx.q.trails >= 2;
    for (let i = 0; i < this.list.length; i++) {
      const v = this.list[i];
      const g = this.groups.get(v.towerUid);
      if (!g) continue;
      const look = g.look;
      let x = v.bx + v.ox;
      let y = v.by + v.oy;
      let h = v.ph + (v.h - v.ph) * alpha;
      if (v.state === ST_LAUNCH && v.launchT >= 0) {
        // the hop: backpack → over her head → the drone's spot (an arc, then normal drawing)
        const k = Math.min(1, v.launchT / DRONE.LAUNCH_T);
        const u = 1 - k;
        const mx = (v.l0x + x) / 2;
        const my = (v.l0y + y) / 2;
        const apex = (0.6 + DRONE.H_ORB) / 2 + 0.8;
        x = u * u * v.l0x + 2 * u * k * mx + k * k * x;
        y = u * u * v.l0y + 2 * u * k * my + k * k * y;
        h = u * u * 0.6 + 2 * u * k * apex + k * k * h;
      } else {
        const dd = Math.hypot(x - v.bx, y - v.by);
        if (dd > maxDecor) maxDecor = dd;
      }
      v.dx = x;
      v.dy = y;
      v.dh = h;
      v.decor = v.state === ST_LAUNCH ? 0 : Math.hypot(x - v.bx, y - v.by);
      if (drawn) {
        const at = drawn.get(v.uid);
        if (at) {
          at.x = x;
          at.h = h;
          at.y = y;
        } else drawn.set(v.uid, { x, h, y });
      }
      const cmd = look.command && v.slot === 0;
      const sc = look.scale * v.grow * rs * (cmd ? 1.3 : 1);
      const yaw = v.pyaw + wrapAngle(v.yaw - v.pyaw) * alpha;
      const wob = v.state === ST_DIZZY ? Math.sin(ctx.time * 18 + v.slot) * 0.35 : 0;
      _e.set(v.pitch + wob, yaw, v.bank, 'YXZ');
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
      const tu = v.tu;
      if (v.state === ST_HUNT && tu && tu.cooldown > 0 && tu.cooldown <= 0.12) eg = 0.2;
      if (v.state !== ST_DIZZY) ctx.quad(ctx.b.bbA, DECOR, x + sy * 0.09 * sc, h, y + cy * 0.09 * sc, eg * sc, eg * sc, R.glow, look.eye, 0.8);
      // spinning rotor over the mast (flat, additive): reads as a little craft, not a disc
      ctx.quad(ctx.b.groundA, DECOR, x, h + 0.15 * sc, y, 0.4 * sc, 0.4 * sc, R.rotor, ROTOR, 0.5, ctx.time * (v.state === ST_DIZZY ? 9 : 31) + v.slot);
      if (cmd && Math.sin(ctx.time * 9) > 0) ctx.quad(ctx.b.bbA, DECOR, x, h + 0.13 * sc, y, 0.07, 0.07, R.glow, ctx.col('#ff6b6b'), 1);
      // Repair Bay look: the oldest drone carries a green work light
      if (look.patrol > 0 && v.slot === 0) ctx.quad(ctx.b.bbA, DECOR, x, h + 0.02, y, 0.16 * sc, 0.16 * sc, R.glow, REPAIR, 0.55 + 0.25 * Math.sin(ctx.time * 4));
      if (v.state === ST_DIZZY) {
        // jammed / she is sabotaged: a turning star over it and the odd spark
        ctx.quad(ctx.b.bbA, CORE, x, h + 0.28 * sc, y, 0.14, 0.14, R.star, DIZZY_STAR, 0.95, ctx.time * 6 + v.slot);
        if (ctx.q.sparks && ((ctx.frame + v.slot * 7) % 23) === 0) {
          const p = ctx.spr(ctx.b.bbA, DECOR, R.spark, x, h, y, 0.08, 0.02, 0.2, DIZZY_STAR, 0.9);
          if (p) p.vy = 0.8;
        }
      }
      if ((trailsAll || (look.trail && ctx.q.trails >= 1)) && v.speed > 1.2 && v.state !== ST_LAUNCH) {
        const kk = 0.35 * Math.min(1, v.speed / 5);
        ctx.line(ctx.b.bbA, DECOR, x, h, y, x - (v.vx / v.speed) * kk, h + 0.02, y - (v.vy / v.speed) * kk, 0.07 * sc, look.trail ? look.eye : look.tint, 0.45);
      }
    }
    mesh.count = n;
    if (n) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
    this.maxDecor = maxDecor;
  }

  /** Snapshot for tests / e2e (allocates; not for the frame loop). */
  probe() {
    const out = [];
    for (const v of this.list) {
      const tu = v.tu;
      out.push({
        uid: v.uid, towerUid: v.towerUid, x: v.dx, y: v.dy, h: v.dh, bx: v.bx, by: v.by, simX: tu ? tu.x : null, simY: tu ? tu.y : null,
        state: v.state, targetUid: v.targetUid, simTarget: tu ? tu.targetUid ?? null : null, lastShotTarget: v.shotTarget,
        decor: v.decor, slot: v.slot,
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

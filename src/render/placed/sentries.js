// Yuzuha's fold-out sentries and Capture Nets (FX-1), read from the sim each frame (t.sentries, t.nets,
// src/sim/sentries.js) and its events (deploy, deployEnd, attack with a turretUid, netCatch); never
// written to. Navy, cream and safety orange with a teal lens.
//   - the folded case is tossed from her hand (Emergency Deploy: cases drop from the sky), lands with a
//     bounce and dust, and unfolds in three beats: legs spring out, the head telescopes up, the lens lights;
//   - it scans with a slow sweep, turns to track its target, and its barrel kicks on every shot (the
//     bullet leaves its barrel: muzzleFor) with a safety-orange muzzle flash; each type has its own head
//     module (net drum, flash lamp, twin heavy barrels, flak barrels pointing up);
//   - the lens blinks amber in its last 3 s, then it folds away and poofs;
//   - a Capture Net arcs out as a folded ball (from her or her nearest sentry), opens in the air and
//     drapes with a bounce of its weighted rim; its tint shows how much of its budget is left; a catch
//     cinches a bundle round the walker that pops into coins;
//   - a sentry's range ring shows only while Yuzuha is selected.
// Low: static models (no unfold, sweep or kick). Reduce Motion: arrivals and departures are short fades.
import * as THREE from 'three';
import { CORE, DECOR } from '../attackFx/context.js';
import { PATH_H } from '../terrain.js';
import {
  SENTRY, NET, sentryState, sentryStep, sentryLand, sentryShot, sentryPose, lensBlink, netFlight, netDrape, netAlpha, netBundle,
} from './fsm.js';
import { SPIN_TUMBLE } from './flights.js';
import { scanYaw, turnToward, hash01, smooth01 } from './math.js';

const TEAL = new THREE.Color('#3fe0d0');
const AMBER = new THREE.Color('#ffb02e');
const LENS_OFF = new THREE.Color('#203040');
const ORANGE = new THREE.Color('#ff8a2a');
const HOT = new THREE.Color('#fff1c8');
const DUST = new THREE.Color('#d9c9ae');
const RING = new THREE.Color('#ff8a2a');
const NET_TINT = new THREE.Color('#ffffff');
const NET_LOW = new THREE.Color('#9aa4b8');
const TYPES = new Set(['plain', 'net', 'flash', 'heavy', 'flak']);
const LEG_R = 0.05;
const HUB_Y = 0.155;
/** The sentry's size over its parts (readable on a phone: about a third of a girl's height). */
const SIZE = 1.3;
const NET_R = 0.55;
const BUNDLE_R = 1.0;
const GROUND = 0.05;

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const _pose = {};
const _shape = { open: 1, lift: 0, cinch: 0 };
const _bundle = {};
const _near = { x: 0, y: 0, dx: 1, dy: 0 };

export class Sentries {
  /** @param {import('./index.js').PlacedLayer} layer */
  constructor(layer) {
    this.L = layer;
    this.ctx = layer.ctx;
    this.recs = new Map(); // sentry uid → record
    this.nets = new Map(); // `${towerUid}:${index}` → record
    this.bundles = [];
    this.frame = 0;
    this.stats = { sentries: 0, nets: 0, shots: 0, tossed: 0, catches: 0 };
  }

  _key(uid) {
    return `sentry:${uid}`;
  }

  _rec(sn, towerUid) {
    let r = this.recs.get(sn.uid);
    if (r) return r;
    const parts = this.L.parts;
    const type = sn.type || 'plain';
    // it faces the road (the nearest road point)
    this.L.roadNear(sn.x, sn.y, _near);
    const base = Math.atan2(_near.x - sn.x, _near.y - sn.y);
    r = {
      uid: sn.uid, towerUid, type, x: sn.x, y: sn.y, s: sentryState(), base, yaw: base, pitch: 0,
      target: null, targetT: -9, seen: 0, ttl: sn.ttl, extra: !!sn.extra,
      caseS: parts.part('case').alloc(), body: parts.part('body').alloc(),
      legs: [parts.part('leg').alloc(), parts.part('leg').alloc(), parts.part('leg').alloc()],
      head: parts.part('head').alloc(), lens: parts.part('lens').alloc(), barrel: parts.part(`barrel:${type}`).alloc(),
      tipX: sn.x, tipY: sn.y, tipH: 0.35, phase0: hash01(sn.uid, 1) * 10,
    };
    this.recs.set(sn.uid, r);
    return r;
  }

  _free(r) {
    const parts = this.L.parts;
    parts.part('case').free(r.caseS);
    parts.part('body').free(r.body);
    for (const l of r.legs) parts.part('leg').free(l);
    parts.part('head').free(r.head);
    parts.part('lens').free(r.lens);
    parts.part(`barrel:${r.type}`).free(r.barrel);
    this.recs.delete(r.uid);
  }

  // ---- events -------------------------------------------------------------------------------

  /**
   * A sentry was set (the sim's 'deploy' with kind 'sentry'; its `type` field holds the sentry type,
   * see PlacedLayer.onEvent): the case is tossed.
   */
  onDeploy(ev) {
    const t = this.L.sim.getTower?.(ev.towerUid);
    if (!t) return;
    let type = TYPES.has(ev.type) ? ev.type : null;
    if (!type) for (const s of t.sentries || []) if (s.uid === ev.uid) type = s.type;
    const r = this._rec({ uid: ev.uid, x: ev.x, y: ev.y, type: type || 'plain', extra: ev.extra }, ev.towerUid);
    this._tossCase(r, t);
  }

  onEvent(ev) {
    const L = this.L;
    switch (ev.type) {
      case 'deploy': {
        const t = L.sim.getTower?.(ev.towerUid);
        if (!t) return;
        if (ev.kind === 'sentry') this.onDeploy(ev);
        else if (ev.kind === 'net') this._launchNet(t, ev.x, ev.y);
        break;
      }
      case 'deployEnd': {
        const r = this.recs.get(ev.uid);
        if (r) r.s.foldT = Math.max(r.s.foldT, 0);
        break;
      }
      case 'attack': {
        if (ev.turretUid == null || ev.kind !== 'bullet') return;
        const r = this.recs.get(ev.turretUid);
        if (!r) return;
        sentryShot(r.s);
        r.target = ev.targetUid ?? null;
        r.targetT = this.ctx.time;
        // snap toward the target so the shot leaves pointing at it
        const e = this.ctx.enemy(r.target);
        if (e && L.motion() !== 'static') r.yaw = Math.atan2(e.x - r.x, e.z - r.y);
        this._muzzleFx(r);
        this.stats.shots++;
        break;
      }
      case 'netCatch':
        this._catch(ev);
        break;
      default:
        break;
    }
  }

  _tossCase(r, t) {
    const L = this.L;
    const land = () => {
      sentryLand(r.s);
      if (L.motion() !== 'calm') this._dust(r.x, r.y, 3);
    };
    if (r.extra) {
      // Emergency Deploy: the case drops from the sky
      L.flights.throw('case', r.x, 3, r.y, r.x, GROUND, r.y, {
        dur: 0.5 * (0.9 + 0.2 * hash01(r.uid, 2)), apex: 0.1, spin: 0.5, mode: SPIN_TUMBLE, key: this._key(r.uid), land, shadow: 0.3,
      });
    } else {
      const h = this.ctx.hand(t, { x: 0, y: 0, h: 0 });
      // her underhand case toss: from low, a quarter turn
      L.flights.throw('case', h.x, h.h * 0.6, h.y, r.x, GROUND, r.y, {
        dur: SENTRY.FLY, apex: SENTRY.APEX, spin: 0.25, mode: SPIN_TUMBLE, key: this._key(r.uid), land, shadow: 0.3,
      });
    }
    this.stats.tossed++;
  }

  _dust(x, y, n) {
    const ctx = this.ctx;
    const k = ctx.n(n);
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2 + hash01(i, this.frame) * 0.8;
      const p = ctx.spr(ctx.b.bbN, DECOR, ctx.R.smoke, x + Math.cos(a) * 0.16, GROUND + 0.06, y + Math.sin(a) * 0.16, 0.12, 0.28, 0.4, DUST, 0.55);
      if (!p) break;
      p.vx = Math.cos(a) * 0.45;
      p.vz = Math.sin(a) * 0.45;
      p.vy = 0.2;
      p.drag = 3;
    }
  }

  _muzzleFx(r) {
    const ctx = this.ctx;
    if (!ctx.cap('muzzle')) return;
    const p = ctx.spr(ctx.b.bbA, CORE, ctx.R.glow, r.tipX, r.tipH, r.tipY, 0.22, 0.3, 0.07, ORANGE, 1);
    if (p) p.flags = 2;
    ctx.spr(ctx.b.bbA, DECOR, ctx.R.star, r.tipX, r.tipH, r.tipY, 0.2, 0.08, 0.08, HOT, 1);
  }

  /** The bullet a sentry fires leaves its barrel tip (the projectile's visual muzzle). */
  muzzleFor(turretUid, rec) {
    const r = this.recs.get(turretUid);
    if (!r) return false;
    rec.mx = r.tipX;
    rec.my = r.tipY;
    rec.mz = r.tipH;
    return true;
  }

  // ---- nets ---------------------------------------------------------------------------------

  _launchNet(t, x, y) {
    const L = this.L;
    const nets = t.nets || [];
    let idx = nets.length - 1;
    for (let i = 0; i < nets.length; i++) if (nets[i].x === x && nets[i].y === y) idx = i;
    const key = `${t.uid}:${idx}`;
    const r = this._net(key, x, y);
    // from her, or from her sentry nearest the spot
    let fx = 0;
    let fy = 0;
    let fh = 0;
    let best = 2.5 * 2.5;
    let fromSentry = false;
    for (const s of this.recs.values()) {
      if (s.towerUid !== t.uid || s.s.phase === 'fly' || s.s.foldT >= 0) continue;
      const d = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d < best) {
        best = d;
        fx = s.tipX;
        fy = s.tipY;
        fh = s.tipH;
        fromSentry = true;
      }
    }
    if (!fromSentry) {
      const h = this.ctx.hand(t, { x: 0, y: 0, h: 0 });
      fx = h.x;
      fy = h.y;
      fh = h.h;
    }
    r.landT = -1;
    const net = L.parts.part('net');
    L.flights.throw('net', fx, fh, fy, x, GROUND + 0.01, y, {
      dur: NET.FLY, apex: NET.APEX, key: `net:${key}`, shadow: 0.3,
      shape: (f, k, pt) => {
        netFlight(k, _shape);
        _q.setFromAxisAngle(UP, k * 2);
        net.setTRS(f.slot, pt.x, pt.h, pt.y, _q, NET_R, NET_R, NET_R);
        net.setShape(f.slot, _shape.open, _shape.lift, _shape.cinch, 1);
      },
      land: () => {
        r.landT = 0;
      },
    });
  }

  _net(key, x, y) {
    let r = this.nets.get(key);
    if (r) return r;
    r = { key, x, y, slot: this.L.parts.part('net').alloc(), landT: 9, seen: 0, yaw: hash01(x * 100 + y, 3) * 6.28 };
    this.nets.set(key, r);
    return r;
  }

  _catch(ev) {
    const net = this.L.parts.part('net');
    const slot = net.alloc();
    if (slot < 0) return;
    this.bundles.push({ slot, x: ev.x, y: ev.y, t: 0, coins: false });
    this.stats.catches++;
  }

  // ---- frame --------------------------------------------------------------------------------

  update(gdt) {
    const L = this.L;
    const ctx = this.ctx;
    const sim = L.sim;
    const motion = L.motion();
    this.frame++;
    let ns = 0;
    let nn = 0;
    for (let i = 0; i < sim.towers.length; i++) {
      const t = sim.towers[i];
      if (t.sentries && t.sentries.length) {
        const range = t.stats?.sentry?.range || 2;
        const selected = ctx.selectedUid != null && ctx.selectedUid === t.uid;
        for (let k = 0; k < t.sentries.length; k++) {
          const sn = t.sentries[k];
          const fresh = !this.recs.has(sn.uid);
          const r = this._rec(sn, t.uid);
          if (fresh && !L.flights.hidden(this._key(sn.uid))) sentryLand(r.s);
          r.seen = this.frame;
          r.ttl = sn.ttl;
          sentryStep(r.s, gdt, false, motion);
          this._aim(r, gdt, range, motion);
          this._draw(r, motion);
          if (selected && r.s.phase !== 'fly') ctx.quad(ctx.b.groundN, CORE, r.x, GROUND + 0.012, r.y, range * 2, range * 2, ctx.R.ring, RING, 0.45);
          ns++;
        }
      }
      if (t.nets && t.nets.length) {
        const budget = t.stats?.sentry?.netBudget || 1;
        for (let k = 0; k < t.nets.length; k++) {
          const n = t.nets[k];
          const key = `${t.uid}:${k}`;
          const r = this._net(key, n.x, n.y);
          r.seen = this.frame;
          if (L.flights.hidden(`net:${key}`)) {
            L.parts.part('net').hide(r.slot);
            continue;
          }
          this._drawNet(r, n, budget, gdt, motion);
          nn++;
        }
      }
    }
    // folded away / gone
    for (const r of this.recs.values()) {
      if (r.seen === this.frame) continue;
      if (r.s.phase === 'fly') L.flights.cancel(this._key(r.uid));
      const alive = sentryStep(r.s, gdt, true, motion);
      if (!alive) {
        if (motion !== 'calm') this._poof(r.x, r.y);
        this._free(r);
        continue;
      }
      this._draw(r, motion);
    }
    for (const r of this.nets.values()) {
      if (r.seen === this.frame) continue;
      this.L.parts.part('net').free(r.slot);
      this.nets.delete(r.key);
    }
    this._updateBundles(gdt, motion);
    this.stats.sentries = ns;
    this.stats.nets = nn;
  }

  _poof(x, y) {
    const ctx = this.ctx;
    const p = ctx.spr(ctx.b.bbN, DECOR, ctx.R.celPuff || ctx.R.smoke, x, GROUND + 0.15, y, 0.2, 0.45, 0.3, ctx.col('#e8ecf4'), 0.8);
    if (p) p.vy = 0.3;
  }

  /** Head yaw: track its target (≤ 360°/s with a slight lag), else a slow scan toward the road. */
  _aim(r, gdt, range, motion) {
    if (motion === 'static') {
      r.yaw = r.base;
      return;
    }
    const ctx = this.ctx;
    let e = ctx.time - r.targetT < 1.2 ? ctx.enemy(r.target) : null;
    if (e && (e.x - r.x) ** 2 + (e.z - r.y) ** 2 > (range + 0.6) ** 2) e = null;
    if (!e) {
      // the nearest enemy in range keeps it alert between shots
      let bd = range * range;
      for (const v of ctx.actors.enemies.values()) {
        if (v.hidden) continue;
        const d = (v.x - r.x) ** 2 + (v.z - r.y) ** 2;
        if (d < bd) {
          bd = d;
          e = v;
        }
      }
    }
    const rate = SENTRY.TURN * (motion === 'calm' ? 0.5 : 1);
    if (e) {
      r.yaw = turnToward(r.yaw, Math.atan2(e.x - r.x, e.z - r.y), rate * gdt);
      r.pitch = e.airborne && (r.type === 'flak' || r.type === 'net') ? 0.09 : 0;
    } else {
      const want = motion === 'calm' ? r.base : scanYaw(ctx.time + r.phase0, r.base, 0.61, 0.5, 0.3);
      r.yaw = turnToward(r.yaw, want, rate * 0.6 * gdt);
      r.pitch = 0;
    }
  }

  _draw(r, motion) {
    const ctx = this.ctx;
    const parts = this.L.parts;
    const p = sentryPose(r.s, _pose, motion);
    const fade = p.fade;
    const sink = p.sink;
    // the case (landing, folding away)
    const cs = p.caseS * (motion === 'calm' ? fade : 1) * SIZE;
    if (cs > 0.001) parts.part('case').setYaw(r.caseS, r.x, GROUND + sink, r.y, r.base, cs, cs * p.squash, cs);
    else parts.part('case').hide(r.caseS);
    // (every part and offset below scales with `hub`, so SIZE sizes the whole sentry)
    const hub = p.hub * fade * SIZE;
    if (hub <= 0.001) {
      parts.part('body').hide(r.body);
      for (const l of r.legs) parts.part('leg').hide(l);
      parts.part('head').hide(r.head);
      parts.part('lens').hide(r.lens);
      parts.part(`barrel:${r.type}`).hide(r.barrel);
      return;
    }
    const hubY = GROUND + sink + HUB_Y * SIZE * (0.55 + 0.45 * p.hub);
    parts.part('body').setYaw(r.body, r.x, hubY, r.y, r.base, hub, hub, hub);
    // three legs, splayed outward from the hub's base
    const leg = parts.part('leg');
    for (let i = 0; i < 3; i++) {
      const th = r.base + (i / 3) * Math.PI * 2 + 0.5;
      _q.setFromAxisAngle(UP, th);
      _q.multiply(_q2.setFromAxisAngle(X, -p.legs));
      leg.setTRS(r.legs[i], r.x + Math.sin(th) * LEG_R * hub, hubY + 0.01, r.y + Math.cos(th) * LEG_R * hub, _q, hub, hub, hub);
    }
    // the head: telescoped up, turned to its yaw
    const hy = hubY + (0.13 + 0.0425 + p.tele) * hub;
    _q.setFromAxisAngle(UP, r.yaw);
    if (r.pitch) _q.multiply(_q2.setFromAxisAngle(X, -r.pitch));
    parts.part('head').setTRS(r.head, r.x, hy, r.y, _q, hub, hub, hub);
    // the lens: teal, amber blinks in its last seconds, dark until it lights
    _v.set(0, 0.002, 0.068 * hub).applyQuaternion(_q);
    const lens = parts.part('lens');
    lens.setTRS(r.lens, r.x + _v.x, hy + _v.y, r.y + _v.z, _q, hub, hub, hub);
    if (p.lens <= 0) lens.setColor(r.lens, LENS_OFF);
    else lens.setColor(r.lens, lensBlink(r.ttl, ctx.time) ? AMBER : TEAL);
    // the barrel module (kicks back along its own axis)
    _v.set(0, 0, -p.kick * SIZE).applyQuaternion(_q);
    parts.part(`barrel:${r.type}`).setTRS(r.barrel, r.x + _v.x, hy + _v.y, r.y + _v.z, _q, hub, hub, hub);
    // where its shots leave (for muzzleFor and the flash)
    const reach = r.type === 'heavy' ? 0.23 : r.type === 'flash' ? 0.15 : 0.22;
    _v.set(0, r.type === 'flak' ? 0.08 : -0.04, reach).multiplyScalar(hub).applyQuaternion(_q);
    r.tipX = r.x + _v.x;
    r.tipY = r.y + _v.z;
    r.tipH = hy + _v.y;
    // a soft lens glow and its contact shadow
    if (p.lens > 0 && ctx.quality !== 'low') {
      const amber = lensBlink(r.ttl, ctx.time);
      ctx.quad(ctx.b.bbA, DECOR, r.x + _v.x * 0.3, hy + 0.002, r.y + _v.z * 0.3, 0.12, 0.12, ctx.R.glow, amber ? AMBER : TEAL, 0.45);
    }
    ctx.quadRGB(ctx.b.groundN, CORE, r.x, GROUND + 0.01, r.y, 0.4 * Math.max(hub, cs), 0.4 * Math.max(hub, cs), ctx.R.shadow, 0.05, 0.05, 0.1, 0.35);
  }

  _drawNet(r, n, budget, gdt, motion) {
    const net = this.L.parts.part('net');
    if (r.landT >= 0) r.landT += gdt;
    netDrape(Math.max(0, r.landT), _shape, motion);
    let a = netAlpha(n.left, budget);
    // a net that arrived without a flight (calm, a restored battle) fades in
    if (motion === 'calm' && r.landT >= 0 && r.landT < NET.FADE) a *= r.landT / NET.FADE;
    _q.setFromAxisAngle(UP, r.yaw);
    net.setTRS(r.slot, r.x, GROUND + 0.012, r.y, _q, NET_R, NET_R, NET_R);
    net.setShape(r.slot, _shape.open, _shape.lift, _shape.cinch, a);
    _c.copy(NET_LOW).lerp(NET_TINT, n.left > 0 ? Math.min(1, n.left / budget) : 0);
    net.setColor(r.slot, _c);
  }

  _updateBundles(gdt, motion) {
    if (!this.bundles.length) return;
    const ctx = this.ctx;
    const net = this.L.parts.part('net');
    let n = 0;
    for (let i = 0; i < this.bundles.length; i++) {
      const b = this.bundles[i];
      b.t += gdt;
      netBundle(b.t, _bundle, motion);
      if (_bundle.done) {
        net.free(b.slot);
        continue;
      }
      this.bundles[n++] = b;
      if (_bundle.popped && !b.coins) {
        b.coins = true;
        // it pops into coins
        const k = ctx.n(4);
        for (let j = 0; j < k; j++) {
          const a = (j / k) * Math.PI * 2 + 0.3;
          const c = ctx.spr(ctx.b.bbN, DECOR, ctx.R.coin, b.x, 0.4, b.y, 0.2, 0.16, 0.5, ctx.col('#ffffff'), 1);
          if (!c) break;
          c.vx = Math.cos(a) * 0.9;
          c.vz = Math.sin(a) * 0.9;
          c.vy = 2;
          c.g = -8;
          c.flags = 1;
        }
        const pf = ctx.spr(ctx.b.bbN, DECOR, ctx.R.celPuff || ctx.R.smoke, b.x, 0.35, b.y, 0.3, 0.6, 0.3, ctx.col('#f4f6fb'), 0.8);
        if (pf) pf.vy = 0.2;
      }
      _q.setFromAxisAngle(UP, b.t * 3);
      // the bundle is about a walker's size (the net's own radius would wrap only its feet)
      const s = BUNDLE_R * _bundle.scale;
      net.setTRS(b.slot, b.x, GROUND, b.y, _q, s, s, s);
      net.setShape(b.slot, 1, 0, _bundle.cinch, _bundle.alpha * smooth01(Math.min(1, b.t / 0.05 + 0.3)));
      net.setColor(b.slot, NET_TINT);
    }
    this.bundles.length = n;
  }

  clear() {
    for (const r of [...this.recs.values()]) this._free(r);
    const net = this.L.parts.has('net') ? this.L.parts.part('net') : null;
    for (const r of this.nets.values()) net?.free(r.slot);
    this.nets.clear();
    for (const b of this.bundles) net?.free(b.slot);
    this.bundles.length = 0;
  }
}

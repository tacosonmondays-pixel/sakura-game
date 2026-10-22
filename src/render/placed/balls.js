// Marumi's bowling balls (FX-1): a real bomb-bowling ball for every sim ball (src/sim/balls.js), read
// from the sim each frame and never written to.
//   - hand-off: a new ball leaves her hand low (an underhand roll) and hops onto the sim ball in
//     HOP seconds, landing with a squash; after that it is exactly where the sim rolls it;
//   - roll: no slip (the spin follows the distance rolled), a 2° wobble, dust puffs at the ground and
//     a dust wake (a ribbon, High only); a Wrecking Ball walker it bowls through squashes it briefly;
//   - fuse: a steel cap that stays upright while the ball spins under it, with a spark;
//   - Spin Shot: each bounce leg the sim flies straight gets a parabola (0.5 high, from the leg's
//     progress so a moving target still ends it on contact), a stretch in flight, a shrinking shadow;
//   - swell: in the last 0.08 s before it meets its walker it swells 1 → 1.25 with a white flash;
//   - Split Pins: red-and-white pins tumble out along the road and fall over; the Glow Bowl finale
//     stands ten pins in a triangle for 0.3 s, then scatters them under a STRIKE! sticker;
//   - her lob is her own ball (the sim's shell projectile drawn as the ball, spinning, with a shadow);
//   - Giant Strike: the sim's 'giantBall' runner is a 2.5× ball with a dust wake.
import * as THREE from 'three';
import { pointAt, pathElevation } from '../../sim/path.js';
import { runnerSegment } from '../../sim/runners.js';
import { BALL_RADIUS, BOUNCE_SPEED } from '../../sim/constants.js';
import { PATH_H } from '../terrain.js';
import { CORE, DECOR, MOTE } from '../attackFx/context.js';
import { BALL_R, PIN_H } from './geometry.js';
import {
  rollAngle, bounceHeight, legProgress, landSquash, swell, smooth01, clamp01, hash01, TAU, easeOutBack,
} from './math.js';

export const BALL = {
  /** the hand-off hop (game s) and its arc */
  HOP: 0.2, HOP_APEX: 0.16,
  /** Spin Shot bounce height */
  BOUNCE_H: 0.5,
  /** stretch along the flight at mid-leg */
  STRETCH: 0.1,
  /** wobble (rad) */
  WOBBLE: 0.035,
  /** dust puffs while rolling (game s apart) */
  DUST_EVERY: 0.12,
  /** Giant Strike's ball scale */
  GIANT: 2.5,
  /** pins: life (s), how many at most per blast, the finale's stand time */
  PIN_LIFE: 0.85, PINS_MAX: 5, STAND: 0.3,
  /** the STRIKE! sticker */
  STICKER: 1.1,
};

/** A pin lying on its side: its middle sits this far above the road (its belly radius). */
const PIN_BELLY = 0.048;
const PIN_TRI = [[0, 0], [-0.5, 1], [0.5, 1], [-1, 2], [0, 2], [1, 2], [-1.5, 3], [-0.5, 3], [0.5, 3], [1.5, 3]];
const DUST = new THREE.Color('#d9c9ae');
const WHITE = new THREE.Color('#ffffff');
const SPARK = new THREE.Color('#ffc46b');
const SPARK_HOT = new THREE.Color('#fff2c0');
const PETALS = ['#ff9cbc', '#f6efe0', '#f28a3c'];

const _q = new THREE.Quaternion();
const _qa = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _r = new THREE.Matrix4();
const _s = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _ax = new THREE.Vector3();
const _pt = { x: 0, y: 0, seg: 0, facing: 0 };
const _hand = { x: 0, y: 0, h: 0 };
const UP = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);

export class Balls {
  /** @param {import('./index.js').PlacedLayer} layer */
  constructor(layer) {
    this.L = layer;
    this.ctx = layer.ctx;
    this.recs = new Map(); // ball uid (or runner 'g' + uid) → record
    this.pins = [];
    this.stickers = [];
    this.lobs = new Map(); // projectile uid → { slot, seen, spin }
    this.frame = 0;
    this.stats = { balls: 0, pins: 0, lobs: 0, hops: 0, swells: 0 };
  }

  // ---- events -------------------------------------------------------------------------------

  onEvent(ev) {
    switch (ev.type) {
      case 'ball': {
        // the hand-off: a new ball leaves her hand low and hops onto the sim ball
        const t = this.L.sim.getTower?.(ev.towerUid);
        if (!t) return;
        const r = this._rec(ev.uid, ev.towerUid);
        if (this.L.motion() === 'calm') {
          r.fade = 0;
          return;
        }
        this._release(t, _hand);
        r.hop = 0;
        r.hx = _hand.x;
        r.hh = _hand.h;
        r.hy = _hand.y;
        this.stats.hops++;
        break;
      }
      case 'ballPop': {
        const r = this.recs.get(ev.uid);
        if (r) r.popped = true;
        if (ev.fin) this.finale(ev.x, ev.y, r ? r.heading : 0);
        break;
      }
      case 'pins': {
        // pins tumble out along the road (the way the ball was going)
        let heading = 0;
        let best = Infinity;
        for (const r of this.recs.values()) {
          if (r.towerUid !== ev.towerUid) continue;
          const d = (r.x - ev.x) ** 2 + (r.y - ev.y) ** 2;
          if (d < best) {
            best = d;
            heading = r.heading;
          }
        }
        this.scatterPins(ev.x, ev.y, heading, ev.n || 3);
        break;
      }
      case 'ballEnd': {
        const r = this.recs.get(ev.uid);
        if (r) r.fizzle = true;
        break;
      }
      default:
        break;
    }
  }

  /** Where her hand lets go of an underhand roll: low, a little forward and to her right. */
  _release(t, out) {
    const ctx = this.ctx;
    const f = ctx.facing(t);
    const s = ctx.bodyScale(t);
    out.x = t.x + Math.sin(f) * 0.24 * s - Math.cos(f) * 0.1 * s;
    out.y = t.y + Math.cos(f) * 0.24 * s + Math.sin(f) * 0.1 * s;
    out.h = 0.16 * s;
    return out;
  }

  _rec(key, towerUid) {
    let r = this.recs.get(key);
    if (r) return r;
    const parts = this.L.parts;
    r = {
      key, towerUid, ball: parts.part('ball').alloc(), cap: parts.part('cap').alloc(),
      x: 0, y: 0, h: 0, px: NaN, py: NaN, spin: hash01(typeof key === 'number' ? key : 7, 1) * TAU, heading: 0,
      hop: -1, hx: 0, hh: 0, hy: 0, land: 9, squash: 9, nHit: 0, dust: 0,
      legT: Infinity, legX: 0, legY: 0, legU: 0, seen: 0, popped: false, fizzle: false, fade: 1, scale: 1, giant: false,
    };
    this.recs.set(key, r);
    return r;
  }

  _free(r) {
    const parts = this.L.parts;
    parts.part('ball').free(r.ball);
    parts.part('cap').free(r.cap);
    this.recs.delete(r.key);
  }

  // ---- frame --------------------------------------------------------------------------------

  update(gdt) {
    const L = this.L;
    const sim = L.sim;
    const motion = L.motion();
    this.frame++;
    let n = 0;
    for (let i = 0; i < sim.towers.length; i++) {
      const t = sim.towers[i];
      const list = t.balls;
      if (!list || !list.length) continue;
      const speed = t.stats?.ball?.speed || 4;
      for (let k = 0; k < list.length; k++) {
        const bl = list[k];
        const r = this._rec(bl.uid, t.uid);
        r.seen = this.frame;
        this._step(r, t, bl, speed, gdt, motion);
        n++;
      }
    }
    // Giant Strike: the sim's giantBall runners
    const runners = sim.runners;
    if (runners) {
      for (let i = 0; i < runners.length; i++) {
        const ru = runners[i];
        if (ru.dead || ru.kind !== 'giantBall') continue;
        const key = `g${ru.uid}`;
        const r = this._rec(key, ru.ownerUid);
        r.giant = true;
        r.seen = this.frame;
        this._stepGiant(r, ru, gdt, motion);
        n++;
      }
    }
    // gone: popped / fizzled / the wave ended
    for (const r of this.recs.values()) {
      if (r.seen === this.frame) continue;
      if (!r.popped && !r.fizzle) {
        // a dust puff where it ended (the blast itself is the sim's explode)
        this._puff(r.x, r.y, 0.25);
      }
      this._free(r);
    }
    this.stats.balls = n;
    this._updatePins(gdt, motion);
    this._updateStickers(gdt, motion);
    this._sweepLobs();
  }

  _groundH(path, dist) {
    return PATH_H + (path ? pathElevation(path, dist) : 0);
  }

  _step(r, t, bl, speed, gdt, motion) {
    const sim = this.L.sim;
    const ctx = this.ctx;
    const f = bl.fly;
    let sx;
    let sy;
    let base;
    let air = 0;
    let stretch = 0;
    let ttc = Infinity;
    if (f) {
      // a Spin Shot leg: straight at its walker in the sim; a parabola here
      if (f.t < r.legT) {
        r.legX = f.x;
        r.legY = f.y;
        r.legU = 0;
      }
      r.legT = f.t;
      sx = f.x;
      sy = f.y;
      base = PATH_H;
      let tx = sx;
      let ty = sy;
      for (let i = 0; i < sim.enemies.length; i++) {
        const e = sim.enemies[i];
        if (e.uid === f.uid) {
          tx = e.x;
          ty = e.y;
          break;
        }
      }
      const remaining = Math.max(0, Math.hypot(tx - sx, ty - sy) - BALL_RADIUS);
      const u = legProgress(Math.hypot(sx - r.legX, sy - r.legY), remaining);
      r.legU = Math.max(r.legU, u);
      // Reduce Motion keeps a low hop (the turn toward the next walker still reads), no stretch
      air = bounceHeight(r.legU, motion === 'calm' ? 0.15 : BALL.BOUNCE_H);
      stretch = motion === 'full' ? BALL.STRETCH * Math.sin(Math.PI * r.legU) : 0;
      ttc = remaining / BOUNCE_SPEED;
    } else {
      r.legT = Infinity;
      const path = sim.pathData[bl.pathIndex];
      if (!path) return;
      pointAt(path, bl.dist, _pt);
      sx = _pt.x;
      sy = _pt.y;
      base = this._groundH(path, bl.dist);
      if (!(bl.through > 0)) ttc = this._timeToWalker(sx, sy, bl, speed);
      // Wrecking Ball: a walker it bowls through squashes it for a moment
      const nh = bl.hit ? bl.hit.length : 0;
      if (nh > r.nHit && motion === 'full') r.squash = 0;
      r.nHit = nh;
    }
    let x = sx;
    let y = sy;
    let h = base + BALL_R + air;
    if (r.hop >= 0) {
      r.hop += gdt;
      const k = Math.min(1, r.hop / BALL.HOP);
      const e = smooth01(k);
      x = r.hx + (sx - r.hx) * e;
      y = r.hy + (sy - r.hy) * e;
      h = r.hh + BALL_R + (h - r.hh - BALL_R) * e + BALL.HOP_APEX * 4 * k * (1 - k);
      if (k >= 1) {
        r.hop = -1;
        r.land = 0;
      }
    }
    this._draw(r, x, y, h, base, gdt, motion, stretch, ttc, 1);
  }

  _stepGiant(r, ru, gdt, motion) {
    const sim = this.L.sim;
    const p = runnerSegment(sim, ru, 0, _pt);
    if (!p) return;
    const path = sim.pathData[ru.pathIndex];
    const base = this._groundH(path, ru.dist);
    const sc = BALL.GIANT;
    this._draw(r, p.x, p.y, base + BALL_R * sc, base, gdt, motion, 0, Infinity, sc);
    // a dust wake: puffs to both sides behind it
    if (motion !== 'static') {
      r.dust += gdt;
      if (r.dust >= 0.06) {
        r.dust = 0;
        const s = Math.sin(r.heading);
        const c = Math.cos(r.heading);
        for (const side of [-1, 1]) this._puff(p.x - s * 0.35 + c * side * 0.35, p.y - c * 0.35 - s * side * 0.35, 0.3);
      }
    }
  }

  /** Time until a rolling ball meets the nearest walker in front of it (display estimate; Infinity: none near). */
  _timeToWalker(x, y, bl, speed) {
    const en = this.L.sim.enemies;
    let best = Infinity;
    for (let i = 0; i < en.length; i++) {
      const e = en[i];
      if (e.dead || e.airborne || e.hidden) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1.44 || d2 >= best) continue;
      if (bl.hit && bl.hit.includes(e.uid)) continue;
      best = d2;
    }
    if (best === Infinity) return Infinity;
    return Math.max(0, Math.sqrt(best) - BALL_RADIUS) / Math.max(0.5, speed);
  }

  _draw(r, x, y, h, base, gdt, motion, stretch, ttc, scale) {
    const ctx = this.ctx;
    const parts = this.L.parts;
    // spin: no slip, from the ground distance it moved
    if (r.px === r.px) {
      const dx = x - r.px;
      const dy = y - r.py;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1e-4) {
        r.heading = Math.atan2(dx, dy);
        if (d < 1.5) r.spin = rollAngle(r.spin, d, BALL_R * scale);
      }
    }
    r.px = x;
    r.py = y;
    r.x = x;
    r.y = y;
    r.h = h;
    r.land += gdt;
    r.squash += gdt;
    if (r.fade < 1) r.fade = Math.min(1, r.fade + gdt / 0.15);
    // squash on landing / bowling through; swell before the blast
    let sy = 1;
    if (motion === 'full') {
      sy = Math.min(landSquash(r.land, 0.12, 0.2), landSquash(r.squash, 0.08, 0.15));
    }
    const sw = swell(ttc);
    if (sw > 1.01) this.stats.swells++;
    const s = scale * sw * (motion === 'calm' ? smooth01(r.fade) : 1);
    const along = 1 + stretch;
    const across = 1 / Math.sqrt(along * Math.max(0.05, sy));
    // M = T · Ryaw · S(across, sy, along) · Rx(spin) · Rz(wobble)
    const wob = motion === 'full' ? BALL.WOBBLE * Math.sin(r.spin) : 0;
    _q.setFromAxisAngle(X, r.spin);
    if (wob) _q.multiply(_qa.setFromAxisAngle(Z, wob));
    _m.makeRotationFromQuaternion(_q);
    _s.makeScale(s * across, s * sy * (stretch ? 1 / Math.sqrt(along) : 1), s * along);
    _m.premultiply(_s);
    _r.makeRotationY(r.heading);
    _r.setPosition(x, h, y);
    _m.premultiply(_r);
    parts.part('ball').setMatrix(r.ball, _m);
    // the cap stays upright on top of the ball (it never spins)
    const top = h + BALL_R * s * sy;
    _q.setFromAxisAngle(UP, r.heading);
    if (wob) _q.multiply(_qa.setFromAxisAngle(Z, wob * 0.5));
    parts.part('cap').setTRS(r.cap, x, top - 0.01 * s, y, _q, s, s, s);
    // fuse spark (a small hot core and a flickering star)
    const fx = x - Math.sin(r.heading) * 0.012 * s;
    const fy = y - Math.cos(r.heading) * 0.012 * s;
    const fh = top + 0.13 * s;
    const fl = 0.75 + 0.25 * Math.sin(ctx.time * 37 + r.spin * 3);
    ctx.quad(ctx.b.bbA, CORE, fx, fh, fy, 0.1 * s * fl, 0.1 * s * fl, ctx.R.glow, SPARK_HOT, 0.95);
    if (ctx.q.sparks || ctx.quality !== 'low') ctx.quad(ctx.b.bbA, DECOR, fx, fh, fy, 0.16 * s * fl, 0.16 * s * fl, ctx.R.star, SPARK, 0.8, ctx.time * 9);
    // the swell's flash: a small warm-white core on the ball, never a white-out over the walker
    if (sw > 1.01) ctx.quad(ctx.b.bbA, CORE, x, h, y, BALL_R * 1.7 * s, BALL_R * 1.7 * s, ctx.R.glow, SPARK_HOT, 0.4 * (sw - 1) / 0.25);
    // contact shadow, shrinking with height
    const air = Math.max(0, h - base - BALL_R * scale);
    const ss = 0.42 * scale * (1 - Math.min(0.55, air * 0.7));
    ctx.quadRGB(ctx.b.groundN, CORE, x, base + 0.012, y, ss, ss, ctx.R.shadow, 0.05, 0.05, 0.1, 0.38 - Math.min(0.2, air * 0.3));
    // dust at the ground and a dust wake (High)
    if (air < 0.03 && r.hop < 0) {
      r.dust += gdt;
      if (r.dust >= BALL.DUST_EVERY && motion !== 'static') {
        r.dust = 0;
        this._puff(x - Math.sin(r.heading) * 0.18 * scale, y - Math.cos(r.heading) * 0.18 * scale, 0.14 * scale);
      }
      const rb = this.L.ribbons.get(r, 0.26 * scale);
      this.L.ribbons.push(rb, x, y, gdt);
    }
  }

  _puff(x, y, size) {
    const ctx = this.ctx;
    const p = ctx.spr(ctx.b.bbN, MOTE, ctx.R.smoke, x, PATH_H + 0.06, y, size, size * 2.2, 0.45, DUST, 0.55);
    if (p) {
      p.vy = 0.25;
      p.drag = 2;
    }
  }

  // ---- pins and the STRIKE ------------------------------------------------------------------

  _pin(x, h, y) {
    const slot = this.L.parts.part('pin').alloc();
    if (slot < 0) return null;
    const p = {
      slot, x, h, y, vx: 0, vh: 0, vy: 0, ax: 0, ay: 1, spin: 0, w: 0, t: 0, life: BALL.PIN_LIFE, stand: 0, lie: 0, lieYaw: 0, scale: 1,
    };
    this.pins.push(p);
    return p;
  }

  /** Split Pins: n pins tumble out along `heading` from the blast and fall over. */
  scatterPins(x, y, heading, n) {
    const motion = this.L.motion();
    const k = Math.min(BALL.PINS_MAX, Math.max(1, n), this.ctx.quality === 'low' ? 2 : BALL.PINS_MAX);
    for (let i = 0; i < k; i++) {
      const p = this._pin(x, PATH_H + 0.12, y);
      if (!p) break;
      const a = heading + (i - (k - 1) / 2) * 0.5 + (hash01(i, this.frame) - 0.5) * 0.3;
      const sp = 0.9 + hash01(i + 9, this.frame) * 0.6;
      this._throwPin(p, a, sp, motion);
    }
    this.stats.pins += k;
  }

  _throwPin(p, a, sp, motion) {
    if (motion === 'calm') {
      // no tumble: the pin lies knocked over where it lands, fading in and out
      p.lie = 1;
      p.lieYaw = a;
      p.x += Math.sin(a) * 0.35;
      p.y += Math.cos(a) * 0.35;
      p.h = PATH_H;
      p.life = 0.6;
      return;
    }
    p.vx = Math.sin(a) * sp;
    p.vy = Math.cos(a) * sp;
    p.vh = 1.8 + sp * 0.4;
    // tumble about a horizontal axis across its flight, 2-3 turns a second
    p.ax = Math.cos(a);
    p.ay = -Math.sin(a);
    p.w = (2 + hash01(p.slot, 3)) * TAU;
  }

  /** The Glow Bowl finale: ten pins in a triangle for STAND s, then they scatter under a sticker. */
  finale(x, y, heading) {
    const motion = this.L.motion();
    const s = Math.sin(heading);
    const c = Math.cos(heading);
    const n = this.ctx.quality === 'low' ? 6 : PIN_TRI.length;
    for (let i = 0; i < n; i++) {
      const [col, row] = PIN_TRI[i];
      // the triangle's point faces where the ball came from
      const ax = x + (col * c - (row - 1.5) * s) * 0.17;
      const ay = y + (-col * s - (row - 1.5) * c) * 0.17;
      const p = this._pin(ax, PATH_H, ay);
      if (!p) break;
      p.stand = BALL.STAND;
      p.life = BALL.STAND + (motion === 'calm' ? 0.3 : BALL.PIN_LIFE);
      p.scatter = Math.atan2(ax - x, ay - y) + (row === 0 ? heading : 0);
    }
    this.stickers.push({ x, y, t: 0 });
    this.stats.pins += n;
  }

  /** A kill of hers: one pin knocked over at the spot, and petals in her colours. */
  knockPin(x, y) {
    const motion = this.L.motion();
    const p = this._pin(x, PATH_H + 0.15, y);
    if (p) {
      p.life = 0.8;
      this._throwPin(p, hash01(this.frame, 5) * TAU, 0.8, motion);
    }
    const ctx = this.ctx;
    const k = ctx.n(4);
    for (let i = 0; i < k; i++) {
      const a = (i / k) * TAU + hash01(i, this.frame) * 0.6;
      const q = ctx.spr(ctx.b.bbN, DECOR, ctx.R.petal, x, 0.45, y, 0.13, 0.1, 0.65, ctx.col(PETALS[i % PETALS.length]), 1);
      if (!q) break;
      q.vx = Math.cos(a) * 0.9;
      q.vz = Math.sin(a) * 0.9;
      q.vy = 0.9;
      q.g = -2.5;
      q.drag = 1.6;
      q.vrot = 6;
    }
  }

  _updatePins(gdt, motion) {
    const part = this.pins.length ? this.L.parts.part('pin') : null;
    let n = 0;
    for (let i = 0; i < this.pins.length; i++) {
      const p = this.pins[i];
      p.t += gdt;
      if (p.t >= p.life) {
        part.free(p.slot);
        continue;
      }
      this.pins[n++] = p;
      if (p.stand > 0) {
        p.stand -= gdt;
        if (p.stand <= 0) {
          if (motion === 'calm') {
            p.stand = Infinity; // Reduce Motion: they stay standing and fade out
          } else {
            const sp = 1.6 + hash01(p.slot, 11) * 1.2;
            this._throwPin(p, p.scatter, sp, motion);
            p.h = PATH_H + PIN_H * 0.5; // from here p.h is its middle (it tumbles about it)
          }
        }
      } else if (p.lie <= 0 && p.vh !== 0) {
        p.vh -= 9 * gdt;
        p.x += p.vx * gdt;
        p.y += p.vy * gdt;
        p.h += p.vh * gdt;
        p.spin += p.w * gdt;
        if (p.h <= PATH_H + PIN_BELLY && p.vh < 0) {
          p.h = PATH_H;
          p.vh = 0;
          p.lie = 0.001;
          p.lieYaw = Math.atan2(p.vx, p.vy);
        }
      } else if (p.lie > 0 && p.lie < 1) {
        p.lie = Math.min(1, p.lie + gdt / 0.12);
      }
      // fade by shrinking in the last 0.15 s (opaque toon parts); calm pins also fade in
      const end = p.life - p.t;
      let sc = end < 0.15 ? end / 0.15 : 1;
      if (motion === 'calm' && p.t < 0.15) sc *= p.t / 0.15;
      this._pinPose(part, p, sc);
    }
    this.pins.length = n;
  }

  _pinPose(part, p, sc) {
    const half = PIN_H * 0.5;
    if (p.stand > 0) {
      part.setYaw(p.slot, p.x, p.h, p.y, 0, sc, sc, sc);
      return;
    }
    if (p.lie > 0) {
      // fallen over: rotated onto its side, its belly on the ground
      const k = easeOutBack(p.lie, 1.2);
      _q.setFromAxisAngle(UP, p.lieYaw);
      _qa.setFromAxisAngle(X, (Math.PI / 2) * Math.min(1.1, k));
      _q.multiply(_qa);
      // its middle rests a belly's radius above the road (p.h is the road there)
      _v.set(0, half, 0).applyQuaternion(_q);
      part.setTRS(p.slot, p.x - _v.x, p.h + PIN_BELLY - _v.y, p.y - _v.z, _q, sc, sc, sc);
      return;
    }
    // tumbling about its middle (p.h is the middle's height)
    _ax.set(p.ax, 0, p.ay);
    _q.setFromAxisAngle(_ax, p.spin);
    _v.set(0, half, 0).applyQuaternion(_q);
    part.setTRS(p.slot, p.x - _v.x, p.h - _v.y, p.y - _v.z, _q, sc, sc, sc);
  }

  _updateStickers(gdt, motion) {
    const ctx = this.ctx;
    let n = 0;
    for (let i = 0; i < this.stickers.length; i++) {
      const s = this.stickers[i];
      s.t += gdt;
      if (s.t >= BALL.STICKER) continue;
      this.stickers[n++] = s;
      const k = s.t / BALL.STICKER;
      let size = 1;
      let a = 1;
      if (motion === 'calm') {
        a = Math.min(1, s.t / 0.15) * (1 - clamp01((s.t - (BALL.STICKER - 0.15)) / 0.15));
      } else {
        size = s.t < 0.18 ? 0.6 + 0.5 * easeOutBack(s.t / 0.18, 2.5) : 1.1 - 0.1 * clamp01((s.t - 0.18) / 0.2);
        a = 1 - clamp01((k - 0.8) / 0.2);
      }
      // ui-style sticker over the spot, never over the road centre for long (≤ 1.2 s)
      ctx.quad(ctx.b.overlay, CORE, s.x, 1.25 + (motion === 'calm' ? 0 : 0.15 * k), s.y, 1.2 * size, 0.45 * size, ctx.R.strike || ctx.R.white, WHITE, a, -0.14);
    }
    this.stickers.length = n;
  }

  // ---- her lob ------------------------------------------------------------------------------

  /** Draws her lob (the sim's shell projectile) as her ball this frame. */
  lob(uid, x, h, y, vx, vy) {
    const ctx = this.ctx;
    let l = this.lobs.get(uid);
    if (!l) {
      l = { slot: this.L.parts.part('ball').alloc(), spin: hash01(uid, 2) * TAU, seen: 0 };
      this.lobs.set(uid, l);
    }
    l.seen = this.frame;
    const heading = Math.atan2(vx || 0, vy || 1);
    l.spin += ctx.gdt * 2.5 * TAU;
    _q.setFromAxisAngle(UP, heading);
    _q.multiply(_qa.setFromAxisAngle(X, l.spin));
    const s = 0.85;
    this.L.parts.part('ball').setTRS(l.slot, x, h, y, _q, s, s, s);
    // a ground shadow under the lob that shrinks with height
    const ss = 0.36 * (1 - Math.min(0.6, h * 0.35));
    ctx.quadRGB(ctx.b.groundN, CORE, x, PATH_H + 0.012, y, ss, ss, ctx.R.shadow, 0.05, 0.05, 0.1, 0.32);
    this.stats.lobs = this.lobs.size;
  }

  _sweepLobs() {
    if (!this.lobs.size) return;
    // lobs are drawn during actors.sync (before this update): the ones not drawn since the last update are gone
    for (const [uid, l] of this.lobs) {
      if (l.seen >= this.frame - 1) continue;
      this.L.parts.part('ball').free(l.slot);
      this.lobs.delete(uid);
    }
  }

  clear() {
    for (const r of [...this.recs.values()]) this._free(r);
    const pin = this.L.parts.has('pin') ? this.L.parts.part('pin') : null;
    for (const p of this.pins) pin?.free(p.slot);
    this.pins.length = 0;
    this.stickers.length = 0;
    for (const l of this.lobs.values()) this.L.parts.part('ball').free(l.slot);
    this.lobs.clear();
  }
}

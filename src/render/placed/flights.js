// The projectile kit's thrown props (FX-1): display copies that fly from a girl's hand (or the sky)
// to where the sim put the real object, on an arc with spin, a stretch along the flight and a ground
// shadow that shrinks with height. While a copy flies, the object it stands for is hidden (its key is
// in `hiding`), and the copy hands over on landing (the `land` callback). The sim never waits: the
// object is already where the sim put it; only its look arrives late. Game time throughout.
//
// Reduce Motion: no flight; the landing happens at once (the object then fades in where it is).
import * as THREE from 'three';
import { arcPoint, arcVelocity, clamp01 } from './math.js';
import { CORE } from '../attackFx/context.js';

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _s = new THREE.Matrix4();
const _t = new THREE.Matrix4();
const _pt = { x: 0, y: 0, h: 0 };
const _v = { x: 0, y: 0, h: 0 };
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);

/** Spin modes: tumble about the flight's sideways axis, a flat spin about +y (a skimmed strip), none. */
export const SPIN_TUMBLE = 0;
export const SPIN_FLAT = 1;
export const SPIN_NONE = 2;

export class Flights {
  /** @param {object} ctx attack-FX context @param {import('./parts.js').PartSet} parts */
  constructor(ctx, parts, cap = 48) {
    this.ctx = ctx;
    this.parts = parts;
    this.live = [];
    this.free = [];
    for (let i = 0; i < cap; i++) this.free.push({});
    this.hiding = new Map(); // key → open flights standing for it
    this.thrown = 0;
  }

  /**
   * Throws a part from (x0, h0, y0) to (x1, h1, y1).
   * @param {string} part part name (parts.js)
   * @param {object} o { dur, apex, spin (turns), mode (SPIN_*), scale, stretch, key (hide key),
   *   land (fn(f) on arrival), shape (fn(f, k) for the net: sets its own instance), color (THREE.Color),
   *   shadow (size, 0 = none), yaw (initial heading override) }
   * @returns {object|null} the flight (null when the pool is full: the caller lands it at once)
   */
  throw(part, x0, h0, y0, x1, h1, y1, o) {
    const ctx = this.ctx;
    if (ctx.reduceMotion || !(o.dur > 0)) {
      o.land?.(null);
      return null;
    }
    const f = this.free.pop();
    if (!f) {
      o.land?.(null);
      return null;
    }
    const p = this.parts.part(part);
    f.part = p;
    f.slot = p.alloc();
    f.x0 = x0;
    f.h0 = h0;
    f.y0 = y0;
    f.x1 = x1;
    f.h1 = h1;
    f.y1 = y1;
    f.dur = o.dur;
    f.apex = o.apex ?? 0.35;
    f.spin = o.spin ?? 1;
    f.mode = o.mode ?? SPIN_TUMBLE;
    f.scale = o.scale ?? 1;
    f.stretch = o.stretch ?? 0;
    f.key = o.key ?? null;
    f.land = o.land || null;
    f.shape = o.shape || null;
    f.shadow = o.shadow ?? 0.22;
    f.t = 0;
    f.k = 0;
    f.yaw = o.yaw ?? Math.atan2(x1 - x0, y1 - y0);
    if (o.color && f.slot >= 0) p.setColor(f.slot, o.color);
    if (f.key != null) this.hiding.set(f.key, (this.hiding.get(f.key) || 0) + 1);
    this.live.push(f);
    this.thrown++;
    return f;
  }

  /** Is the object with this key still in the air (hidden until its copy lands)? */
  hidden(key) {
    return this.hiding.has(key);
  }

  /** Lands every flight standing for `key` now (the object went away mid-flight). */
  cancel(key) {
    for (const f of this.live) if (f.key === key) f.t = f.dur;
  }

  update(gdt) {
    const ctx = this.ctx;
    const live = this.live;
    let n = 0;
    for (let i = 0; i < live.length; i++) {
      const f = live[i];
      f.t += gdt;
      const k = clamp01(f.t / f.dur);
      f.k = k;
      if (k >= 1) {
        this._end(f);
        continue;
      }
      live[n++] = f;
      arcPoint(k, f.x0, f.h0, f.y0, f.x1, f.h1, f.y1, f.apex, _pt);
      if (f.shape) {
        f.shape(f, k, _pt);
      } else if (f.slot >= 0) {
        this._draw(f, k);
      }
      if (f.shadow > 0) {
        const ss = f.shadow * f.scale * (1 - Math.min(0.6, _pt.h * 0.45));
        ctx.quadRGB(ctx.b.groundN, CORE, _pt.x, 0.062, _pt.y, ss, ss, ctx.R.shadow, 0.05, 0.05, 0.1, 0.32);
      }
    }
    live.length = n;
  }

  _draw(f, k) {
    const turns = f.spin * k * Math.PI * 2;
    // heading frame: local +z along the flight on the ground, then the spin
    _q.setFromAxisAngle(AXIS_Y, f.yaw);
    if (f.mode === SPIN_TUMBLE) _q2.setFromAxisAngle(AXIS_X, turns);
    else if (f.mode === SPIN_FLAT) _q2.setFromAxisAngle(AXIS_Y, turns);
    else _q2.identity();
    let sAlong = 1;
    let sAcross = 1;
    if (f.stretch > 0) {
      // stretched along the flight in the middle of the arc ("smear, not blur"), round at both ends
      arcVelocity(k, f.x0, f.h0, f.y0, f.x1, f.h1, f.y1, f.apex, _v);
      const sp = Math.hypot(_v.x, _v.y, _v.h) / f.dur;
      sAlong = 1 + Math.min(f.stretch, sp * 0.012) * Math.sin(Math.PI * k);
      sAcross = 1 / Math.sqrt(sAlong);
    }
    const sc = f.scale;
    if (sAlong === 1) {
      _q.multiply(_q2);
      f.part.setTRS(f.slot, _pt.x, _pt.h, _pt.y, _q, sc, sc, sc);
      return;
    }
    // stretch in the heading frame, outside the spin: T · Ryaw · S · Rspin
    _m.makeRotationFromQuaternion(_q2);
    _s.makeScale(sc * sAcross, sc * sAcross, sc * sAlong);
    _m.premultiply(_s);
    _t.makeRotationFromQuaternion(_q);
    _t.setPosition(_pt.x, _pt.h, _pt.y);
    _m.premultiply(_t);
    f.part.setMatrix(f.slot, _m);
  }

  _end(f) {
    if (f.key != null) {
      const c = (this.hiding.get(f.key) || 1) - 1;
      if (c <= 0) this.hiding.delete(f.key);
      else this.hiding.set(f.key, c);
    }
    if (f.slot >= 0) f.part.free(f.slot);
    f.slot = -1;
    const land = f.land;
    f.land = null;
    f.shape = null;
    this.free.push(f);
    land?.(f);
  }

  clear() {
    for (const f of this.live) {
      if (f.slot >= 0) f.part.free(f.slot);
      f.slot = -1;
      f.land = null;
      f.shape = null;
      this.free.push(f);
    }
    this.live.length = 0;
    this.hiding.clear();
  }
}

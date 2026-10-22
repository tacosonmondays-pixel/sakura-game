// Azami's spike strips (FX-1): a modelled strip for every sim strip (sim.traps with `strip`, src/sim/
// strips.js), read from the sim each frame and never written to. Five hinged steel plates across the
// road, chunky round spikes with thistle-purple caps, no hazard stripes (they mean danger to the player).
//   - she skims the rolled strip from her hand (a flat spin on a 0.36 s arc); Spike Rain strips drop
//     from high on longer arcs; the strip is hidden until its toss lands;
//   - it lands with a small bounce and the folded plates unroll one after another (30 ms apart);
//   - when the sim arms it the spikes pop up row by row (overshoot) with one glint, then a glint sweeps
//     it every 2.5 s while armed (light, not motion);
//   - a bite: the plate under the walker jabs its spikes 1 → 1.35 → 1, with puncture sparks and dust;
//   - rows sink as its hits run out, so the strip shows what is left; a spent strip rolls up and fades;
//   - Charged Strips: a shiver and a hot glow in the last 0.25 s before a timed blast; Sticky Tar: a
//     glossy tar decal under it; the trigger ring shows only while Azami is selected.
// Low: the static model (no unroll or jab). Reduce Motion: arrivals and departures are short fades.
import * as THREE from 'three';
import { CORE, DECOR } from '../attackFx/context.js';
import { PATH_H } from '../terrain.js';
import { PLATES, PLATE_STEP } from './geometry.js';
import { STRIP, stripState, stripStep, stripLand, stripBite, stripPose } from './fsm.js';
import { SPIN_FLAT, SPIN_TUMBLE } from './flights.js';
import { nearestPlate, hash01 } from './math.js';

const STEEL = new THREE.Color('#d3dae4');
const THISTLE = new THREE.Color('#c9a7ff');
const GLINT = new THREE.Color('#fff0fa');
const HOT = new THREE.Color('#ffa24a');
const TAR = new THREE.Color('#2b2333');
const DUST = new THREE.Color('#d9c9ae');
const RING = new THREE.Color('#a57cc4');
const PLATE_T = 0.022;

const _q = new THREE.Quaternion();
const _qr = new THREE.Quaternion();
const _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const _pose = {};
const _near = { x: 0, y: 0, dx: 1, dy: 0 };
const _in = { armed: false, left: 0, hits0: 0, gone: false };
const _cx = new Float32Array(PLATES);
const _cy = new Float32Array(PLATES);
const _ang = new Float32Array(PLATES);
/** Events that sit between a strip's bites and its trapTriggered. */
const BETWEEN = new Set(['hit', 'death', 'status', 'barrierBreak', 'shellBreak', 'cash', 'split', 'dotSpread', 'curseBurst']);

export class Strips {
  /** @param {import('./index.js').PlacedLayer} layer */
  constructor(layer) {
    this.L = layer;
    this.ctx = layer.ctx;
    this.recs = new Map(); // trap uid → record
    this.frame = 0;
    this.stats = { strips: 0, bites: 0, tossed: 0, rain: 0 };
  }

  _key(uid) {
    return `strip:${uid}`;
  }

  /** Across-road unit vector at (x, y): the nearest road direction turned a quarter. */
  _across(x, y, out) {
    this.L.roadNear(x, y, _near);
    out.x = -_near.dy;
    out.y = _near.dx;
    return out;
  }

  _rec(tr) {
    let r = this.recs.get(tr.uid);
    if (r) return r;
    const parts = this.L.parts;
    const plate = parts.part('plate');
    const spikes = parts.part('spikes');
    const a = this._across(tr.x, tr.y, { x: 1, y: 0 });
    r = {
      uid: tr.uid, owner: tr.ownerUid, x: tr.x, y: tr.y, ax: a.x, ay: a.y, yaw: Math.atan2(-a.y, a.x),
      s: stripState(), plates: new Int16Array(PLATES), spikes: new Int16Array(PLATES), seen: 0, extra: !!tr.extra, last: NaN,
    };
    for (let i = 0; i < PLATES; i++) {
      r.plates[i] = plate.alloc();
      r.spikes[i] = spikes.alloc();
    }
    this.recs.set(tr.uid, r);
    return r;
  }

  _free(r) {
    const parts = this.L.parts;
    const plate = parts.part('plate');
    const spikes = parts.part('spikes');
    for (let i = 0; i < PLATES; i++) {
      plate.free(r.plates[i]);
      spikes.free(r.spikes[i]);
    }
    this.recs.delete(r.uid);
  }

  // ---- events -------------------------------------------------------------------------------

  onEvent(ev, i, events) {
    if (ev.type === 'trapPlaced' && ev.strip) {
      const t = this.L.sim.getTower?.(ev.ownerUid);
      const tr = this._trap(ev.uid) || ev;
      const r = this._rec({ uid: ev.uid, x: ev.x, y: ev.y, ownerUid: ev.ownerUid, extra: ev.extra });
      r.extra = !!ev.extra;
      this._toss(r, t, tr);
      return;
    }
    if (ev.type === 'trapTriggered' && ev.strip) {
      const r = this.recs.get(ev.uid);
      if (!r) return;
      // the plates under the walkers it just bit (the hits come right before the event)
      let any = false;
      for (let j = i - 1; j >= 0 && j >= i - 24; j--) {
        const e = events[j];
        if (!BETWEEN.has(e.type)) break;
        if (e.type !== 'hit') continue;
        const k = nearestPlate(e.x, e.y, r.x, r.y, r.ax, r.ay, PLATES, PLATE_STEP);
        stripBite(r.s, k);
        this._bitFx(r, k);
        any = true;
      }
      if (!any) {
        stripBite(r.s, 2);
        this._bitFx(r, 2);
      }
      this.stats.bites++;
    }
  }

  _trap(uid) {
    const traps = this.L.sim.traps;
    for (let i = 0; i < traps.length; i++) if (traps[i].uid === uid) return traps[i];
    return null;
  }

  _toss(r, t, tr) {
    const L = this.L;
    const ctx = this.ctx;
    const land = () => {
      stripLand(r.s);
      if (L.motion() !== 'calm') this._dust(r.x, r.y, 3);
    };
    if (r.extra) {
      // Spike Rain: it drops from high, on a longer arc that leans in from her side
      const bx = t ? Math.sign(r.x - t.x) * 0.5 : 0;
      const by = t ? Math.sign(r.y - t.y) * 0.5 : 0;
      L.flights.throw('roll', r.x - bx, STRIP.RAIN_H, r.y - by, r.x, PATH_H + 0.07, r.y, {
        dur: STRIP.RAIN_FLY * (0.85 + 0.3 * hash01(r.uid, 4)), apex: 0.2, spin: 1.5, mode: SPIN_TUMBLE, key: this._key(r.uid), land, shadow: 0.28,
      });
      this.stats.rain++;
      return;
    }
    if (!t) {
      land();
      return;
    }
    // her own throw prop: the rolled strip, skimmed sidearm and spinning flat
    const h = ctx.hand(t, { x: 0, y: 0, h: 0 });
    const d = Math.hypot(r.x - h.x, r.y - h.y);
    L.flights.throw('roll', h.x, h.h, h.y, r.x, PATH_H + 0.07, r.y, {
      dur: Math.min(0.45, STRIP.FLY + d * 0.02), apex: STRIP.APEX, spin: 2, mode: SPIN_FLAT, key: this._key(r.uid), land, shadow: 0.24,
    });
    this.stats.tossed++;
  }

  _dust(x, y, n) {
    const ctx = this.ctx;
    const k = ctx.n(n);
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2 + hash01(i, this.frame) * 0.8;
      const p = ctx.spr(ctx.b.bbN, DECOR, ctx.R.smoke, x + Math.cos(a) * 0.2, PATH_H + 0.06, y + Math.sin(a) * 0.2, 0.12, 0.3, 0.4, DUST, 0.55);
      if (!p) break;
      p.vx = Math.cos(a) * 0.5;
      p.vz = Math.sin(a) * 0.5;
      p.vy = 0.2;
      p.drag = 3;
    }
  }

  /**
   * A puff of dust and one puncture glint off the plate that bit (her impact preset's star and sparks come
   * from her style: tier 3, a placed-object trigger, ≤ 8 shapes in all).
   */
  _bitFx(r, k) {
    const ctx = this.ctx;
    const off = (k - (PLATES - 1) / 2) * PLATE_STEP;
    const x = r.x + r.ax * off;
    const y = r.y + r.ay * off;
    const g = ctx.spr(ctx.b.bbA, CORE, ctx.R.glow, x, 0.13, y, 0.16, 0.05, 0.12, r.extra ? THISTLE : STEEL, 1);
    if (g) g.vy = 0.8;
    const p = ctx.spr(ctx.b.bbN, DECOR, ctx.R.smoke, x, PATH_H + 0.07, y, 0.12, 0.28, 0.32, DUST, 0.5);
    if (p) p.vy = 0.3;
  }

  // ---- frame --------------------------------------------------------------------------------

  update(gdt) {
    const L = this.L;
    const ctx = this.ctx;
    const sim = L.sim;
    const motion = L.motion();
    this.frame++;
    let n = 0;
    const traps = sim.traps;
    for (let i = 0; i < traps.length; i++) {
      const tr = traps[i];
      if (!tr.strip) continue;
      const fresh = !this.recs.has(tr.uid);
      const r = this._rec(tr);
      r.seen = this.frame;
      // a strip that was already there (a restored battle, a new layer): no toss, it is simply down
      if (fresh && !L.flights.hidden(this._key(tr.uid))) stripLand(r.s);
      const owner = sim.getTower?.(tr.ownerUid);
      const hits0 = (owner?.stats?.strip?.hits) || tr.hits;
      _in.armed = !!tr.armed;
      _in.left = tr.hits;
      _in.hits0 = tr.extra ? Math.max(tr.hits, r.s.hits0) : hits0;
      _in.gone = false;
      stripStep(r.s, gdt, _in, motion);
      const boom = !!(owner?.stats?.strip?.boom > 0);
      this._draw(r, motion, tr.ttl, boom);
      // Sticky Tar: a glossy tar decal under the strip
      if (owner?.stats?.strip?.carry && !tr.extra && r.s.phase !== 'fly') {
        ctx.quad(ctx.b.groundN, DECOR, r.x, PATH_H + 0.012, r.y, 1.0, 0.5, ctx.R.disc, TAR, 0.5, r.yaw);
        ctx.quad(ctx.b.groundN, DECOR, r.x + r.ax * 0.18, PATH_H + 0.014, r.y + r.ay * 0.18, 0.28, 0.1, ctx.R.soft, GLINT, 0.28, r.yaw);
      }
      // the trigger ring, only while she is selected (range information, never clutter)
      if (ctx.selectedUid != null && ctx.selectedUid === tr.ownerUid && r.s.phase !== 'fly') {
        const d = (owner?.stats?.trap?.triggerRadius || 0.45) * 2;
        ctx.quad(ctx.b.groundN, CORE, r.x, PATH_H + 0.016, r.y, d, d, ctx.R.ring, RING, 0.55);
      }
      n++;
    }
    // gone from the sim: roll up and fade
    for (const r of this.recs.values()) {
      if (r.seen === this.frame) continue;
      if (r.s.phase === 'fly') L.flights.cancel(this._key(r.uid));
      _in.armed = false;
      _in.left = 0;
      _in.hits0 = r.s.hits0;
      _in.gone = true;
      const alive = stripStep(r.s, gdt, _in, motion);
      if (!alive) {
        this._free(r);
        continue;
      }
      this._draw(r, motion, -1, false);
    }
    this.stats.strips = n;
  }

  _draw(r, motion, ttl, boom) {
    const ctx = this.ctx;
    const parts = this.L.parts;
    const plate = parts.part('plate');
    const spikes = parts.part('spikes');
    const p = stripPose(r.s, _pose, motion, ttl, boom);
    if (p.scale <= 0.001) {
      for (let i = 0; i < PLATES; i++) {
        plate.hide(r.plates[i]);
        spikes.hide(r.spikes[i]);
      }
      r.last = NaN;
      return;
    }
    // light: the armed glint sweeping the strip, the charged glow
    if (p.glint >= 0) {
      const off = (p.glint - 0.5) * PLATES * PLATE_STEP;
      ctx.quad(ctx.b.bbA, DECOR, r.x + r.ax * off, PATH_H + 0.12, r.y + r.ay * off, 0.26, 0.26, ctx.R.star, GLINT, 0.85 * Math.sin(Math.PI * p.glint), ctx.time * 4);
    }
    if (p.shiver > 0) ctx.quad(ctx.b.groundA, CORE, r.x, PATH_H + 0.03, r.y, 1.0, 1.0, ctx.R.glow, HOT, 0.55 * p.shiver);
    // skip the matrix writes while nothing moves (an armed strip at rest)
    let sig = p.scale * 7.1 + p.lift * 13.3 + p.shiver * 3.7;
    for (let i = 0; i < PLATES; i++) sig += p.fold[i] * (i + 1.3) + p.spike[i] * (i + 2.9) * 1.7;
    if (sig === r.last && p.shiver <= 0) return;
    r.last = sig;
    // the plate chain in the strip's own frame: x across the road, y up; each plate hinged on the
    // +x edge of the one before it, folded back over it by fold[i] (an accordion that unrolls)
    const sc = p.scale;
    const half = PLATE_STEP / 2;
    _cx[0] = -2 * PLATE_STEP;
    _cy[0] = 0;
    _ang[0] = 0;
    for (let i = 1; i < PLATES; i++) {
      const a0 = _ang[i - 1];
      const a = a0 + p.fold[i] * Math.PI;
      _ang[i] = a;
      _cx[i] = _cx[i - 1] + Math.cos(a0) * half + Math.cos(a) * half;
      // a folded plate rides on top of the one before it (two plate thicknesses up)
      _cy[i] = _cy[i - 1] + Math.sin(a0) * half + Math.sin(a) * half + 2 * PLATE_T * p.fold[i];
    }
    const shiver = motion === 'full' && p.shiver > 0 ? 0.01 * Math.sin(ctx.time * 188) : 0;
    _q.setFromAxisAngle(UP, r.yaw);
    for (let i = 0; i < PLATES; i++) {
      const lx = (_cx[i] + shiver) * sc;
      const ly = _cy[i] * sc + p.lift;
      const wx = r.x + r.ax * lx;
      const wy = r.y + r.ay * lx;
      const h = PATH_H + 0.004 + ly;
      _qr.copy(_q).multiply(rollAbout(_ang[i]));
      plate.setTRS(r.plates[i], wx, h, wy, _qr, sc, sc, sc);
      const sp = p.spike[i];
      if (sp <= 0.002) {
        spikes.hide(r.spikes[i]);
      } else {
        // the spike row stands on the plate's top face
        _v.set(0, PLATE_T * sc, 0).applyQuaternion(_qr);
        spikes.setTRS(r.spikes[i], wx + _v.x, h + _v.y, wy + _v.z, _qr, sc, sc * sp, sc);
      }
    }
  }

  clear() {
    for (const r of [...this.recs.values()]) this._free(r);
  }
}

const _roll = new THREE.Quaternion();
/** Rotation about the strip's local z (the hinge axis, along the road). */
function rollAbout(a) {
  return _roll.setFromAxisAngle(Z, a);
}

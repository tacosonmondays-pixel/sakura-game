// Lively figures, whole-figure layer in battle (owner decision #149; switch and the skeleton layer:
// src/models/figureOptions.js, src/models/livelyRig.js). Works on every girl, procedural
// stand-ins included, through her view's scale / lean / height in actors.js:
//  - placement: she drops in from above (gravity), stretches as she falls, lands with a squash
//    (0.82 → 1.06 → 1) instead of the uniform elastic pop (Reduce motion: a short scale-in only)
//  - attack: while the next attack charges (the sim's cooldown, read only) she squashes and leans
//    back; on the attack event she stretches and snaps forward, then settles (damped springs)
//  - breathing: a slow, tiny squash so a still figure is never frozen
//  - disabled: she sags a little
// Display only: it reads sim state through actors.js and writes nothing back.
import { livelyRandom } from '../models/livelyRig.js';

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
/** Placement drop: height (world units), gravity (units/s²), landing spring (Hz, damping ratio). */
export const LIVELY_LAND = Object.freeze({ height: 0.9, gravity: 30, hz: 7, zeta: 0.35, squash: 10, reduceIn: 0.15 });
/** Attack springs: stiffness, damping; anticipation squash / lean; release impulses. */
export const LIVELY_ACT = Object.freeze({ k: 180, c: 12, squash: 0.05, lean: 3, stretchV: 1.0, leanV: 70, window: 0.22 });

export class LivelyPose {
  /** @param {number} seed e.g. the tower uid */
  constructor(seed = 1) {
    const rand = livelyRandom((seed * 2654435761) >>> 0);
    this.Tb = 3.3 + rand() * 0.7;
    this.pb = rand() * TAU;
    this.t = 0;
    this.spawnT = 0;
    this.fallT = Math.sqrt((2 * LIVELY_LAND.height) / LIVELY_LAND.gravity);
    this.landed = false;
    this.land = 0; // landing squash spring (y scale offset)
    this.landV = 0;
    this.act = 0; // attack squash spring
    this.actV = 0;
    this.lean = 0; // deg
    this.leanV = 0;
    this.lastFire = -10;
    // outputs
    this.sy = 1;
    this.sxz = 1;
    this.grow = 0.6;
    this.dy = LIVELY_LAND.height;
    this.leanRad = 0;
  }

  /**
   * True once she has landed (or scaled in) and the landing squash has died down: her figure is at its full
   * standing size, so things measured from it (the buff icons' head height, buffIcons.js) can be measured.
   */
  get settled() {
    return this.landed && this.grow >= 1 && Math.abs(this.land) < 0.01 && Math.abs(this.landV) < 0.15;
  }

  /** The attack event: stretch + snap forward (weaker when attacks come fast). */
  fire(reduceMotion = false) {
    const gap = this.t - this.lastFire;
    this.lastFire = this.t;
    const k = Math.max(0.25, Math.min(1, gap / 0.6)) * (reduceMotion ? 0.4 : 1);
    this.actV += LIVELY_ACT.stretchV * k;
    this.leanV += LIVELY_ACT.leanV * k;
  }

  /**
   * @param {number} dt seconds
   * @param {{ windup?: number, state?: string, reduceMotion?: boolean, low?: boolean }} o
   */
  update(dt, { windup = 0, state = 'idle', reduceMotion = false, low = false } = {}) {
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    this.t += dt;
    const L = LIVELY_LAND;
    // placement
    this.spawnT += dt;
    if (reduceMotion) {
      const k = Math.min(1, this.spawnT / L.reduceIn);
      this.grow = 0.6 + 0.4 * k * (2 - k);
      this.dy = 0;
      this.landed = true;
    } else if (!this.landed) {
      const tt = Math.min(this.spawnT, this.fallT);
      this.dy = Math.max(0, L.height - 0.5 * L.gravity * tt * tt);
      const k = tt / this.fallT;
      this.grow = 0.6 + 0.4 * k;
      if (this.spawnT >= this.fallT) {
        this.landed = true;
        this.dy = 0;
        this.grow = 1;
        this.landV = -L.squash;
      }
    } else {
      this.grow = 1;
      this.dy = 0;
    }
    // falling: stretched along the fall
    const fallStretch = !this.landed ? 0.08 * (this.spawnT / this.fallT) : 0;
    // springs (sub-stepped at 120 Hz)
    const lw = TAU * L.hz;
    const lk = lw * lw;
    const lc = 2 * L.zeta * lw;
    const A = LIVELY_ACT;
    const disabled = state === 'disabled' || state === 'hurt';
    const actT = -A.squash * windup + (disabled ? -0.03 : 0);
    const leanT = -A.lean * windup + (disabled ? 2.5 : 0);
    const n = Math.max(1, Math.ceil(dt * 120));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.landV += (-lk * this.land - lc * this.landV) * h;
      this.land += this.landV * h;
      this.actV += (-A.k * (this.act - actT) - A.c * this.actV) * h;
      this.act += this.actV * h;
      this.leanV += (-A.k * (this.lean - leanT) - A.c * this.leanV) * h;
      this.lean += this.leanV * h;
    }
    const m = reduceMotion ? 0.5 : 1;
    const breath = low ? 0 : 0.006 * m * Math.sin((TAU * this.t * (reduceMotion ? 0.75 : 1)) / this.Tb + this.pb);
    const y = (this.land + this.act) * (reduceMotion ? 0.5 : 1) + breath + fallStretch;
    this.sy = 1 + y;
    this.sxz = 1 - 0.5 * y;
    this.leanRad = this.lean * D2R * (reduceMotion ? 0.5 : 1);
  }
}

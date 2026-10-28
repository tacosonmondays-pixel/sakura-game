// Map rule decals on the board (docs/specs/CODEX_MODES.md §8.4), render only: crystal pads (cyan
// disc, slow rune ring, a floating gem; free pads pulse, a taken pad glows steadily), forge vents
// (an orange cracked ring on the road: dim embers while resting, a bright glow and ember bursts
// while ACTIVE), star rifts (two purple swirls per path at 40 % and 52 % of its length, a puff at
// both ends of every jump). Reads sim.ruleInfo() and the live paths; never writes to the sim.
import * as THREE from 'three';
import { PATH_H } from './terrain.js';
import { pointAt } from '../sim/path.js';

export class RuleDecals {
  /**
   * @param {{ sim: object, batches: object, atlas: object, fx: import('./fx.js').FxSystem, warm?: boolean }} o
   *   warm: the pads are the far north's village hearths (Gate Arc 4-9): ember amber, not crystal cyan
   */
  constructor({ sim, batches, atlas, fx, warm = false }) {
    this.sim = sim;
    // pad colours (disc, rune, ring, gem): crystal cyan, or the hearths' ember amber
    this._padCol = warm
      ? [[1, 0.58, 0.22], [1, 0.7, 0.34], [1, 0.78, 0.4], [1, 0.86, 0.5]]
      : [[0.25, 0.85, 1], [0.35, 0.92, 1], [0.4, 0.95, 1], [0.55, 1, 1]];
    this.b = batches;
    this.R = atlas.regions;
    this.fx = fx;
    this.reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._ember = 0;
    this._riftFor = null;
    this._rifts = [];
    this._tmp = {};
    this._c = new THREE.Color();
  }

  get active() {
    return !!this.sim.rule;
  }

  _riftPoints() {
    const paths = this.sim.pathData;
    if (this._riftFor === paths) return this._rifts;
    this._riftFor = paths;
    this._rifts = [];
    const portals = this.sim.rule?.def?.always?.portals;
    if (!portals) return this._rifts;
    for (const p of paths) {
      for (const f of [portals.at, portals.at + portals.jump]) {
        pointAt(p, f * p.length, this._tmp);
        this._rifts.push({ x: this._tmp.x, z: this._tmp.y });
      }
    }
    return this._rifts;
  }

  update(dt, t) {
    const info = this.sim.ruleInfo?.();
    if (!info) return;
    const R = this.R;
    const gN = this.b.groundN;
    const gA = this.b.groundA;
    const bbA = this.b.bbA;
    const slow = this.reduceMotion ? 0.25 : 1;
    // crystal pads
    for (const p of info.pads) {
      const taken = p.ownerUid != null;
      const pulse = taken ? 1 : 0.55 + 0.45 * Math.sin(t * 2.4 * slow + p.x);
      const D = p.r * 2;
      // (indexed, not destructured: no iterator per pad per frame)
      const pc = this._padCol;
      const c0 = pc[0];
      const c1 = pc[1];
      const c2 = pc[2];
      const c3 = pc[3];
      gN.push(p.x, PATH_H + 0.012, p.y, D, D, R.disc, c0[0], c0[1], c0[2], 0.42);
      gA.push(p.x, PATH_H + 0.018, p.y, D * 0.95, D * 0.95, R.rune, c1[0], c1[1], c1[2], 0.35 + 0.35 * pulse, t * 0.25 * slow);
      gA.push(p.x, PATH_H + 0.022, p.y, D * 1.05, D * 1.05, R.ringThick, c2[0], c2[1], c2[2], taken ? 0.75 : 0.3 + 0.3 * pulse);
      // a small gem: hovering over a free pad, orbiting its girl on a taken one
      const a = t * (taken ? 1.6 : 0.8) * slow;
      const gx = taken ? p.x + Math.cos(a) * 0.55 : p.x;
      const gz = taken ? p.y + Math.sin(a) * 0.55 : p.y;
      const gy = (taken ? 1.15 : 0.55) + Math.sin(t * 2 * slow) * 0.08;
      bbA.push(gx, gy, gz, 0.22, 0.22, R.star, c3[0], c3[1], c3[2], 0.9, t * slow);
    }
    // forge vents
    const on = info.active && info.inWave && !info.neutral;
    for (const z of info.zones) {
      const D = z.r * 2;
      const flick = 0.75 + 0.25 * Math.sin(t * 9 * slow + z.x);
      gN.push(z.x, PATH_H + 0.014, z.y, D, D, R.disc, 0.35, 0.08, 0.02, on ? 0.5 : 0.3);
      gA.push(z.x, PATH_H + 0.02, z.y, D, D, R.ringDashed, 1, 0.48, 0.12, on ? 0.95 * flick : 0.35, t * 0.1 * slow);
      gA.push(z.x, PATH_H + 0.024, z.y, D * 0.7, D * 0.7, R.glow, 1, 0.45, 0.1, on ? 0.75 * flick : 0.12);
    }
    if (on && info.zones.length) {
      this._ember -= dt;
      if (this._ember <= 0) {
        this._ember = 0.5;
        for (const z of info.zones) this.fx.puff(z.x, 0.25, z.y, '#ff7a1f', this.reduceMotion ? 3 : 7, z.r * 0.6, 0.3);
      }
    } else this._ember = 0;
    // star rifts
    if (info.portals) {
      for (const r of this._riftPoints()) {
        gA.push(r.x, PATH_H + 0.02, r.z, 1.1, 1.1, R.rune, 0.7, 0.45, 1, 0.55, -t * 0.8 * slow);
        gA.push(r.x, PATH_H + 0.024, r.z, 0.7, 0.7, R.ringSoft, 0.8, 0.55, 1, 0.45);
      }
    }
  }

  /** Effects for rule events (render only). */
  handle(ev) {
    if (ev.type === 'rift') {
      this.fx.puff(ev.x, 0.3, ev.y, '#b48cff', 6, 0.35, 0.3);
      this.fx.puff(ev.x2, 0.3, ev.y2, '#d9c2ff', 6, 0.35, 0.3);
      this.fx.ring(ev.x2, ev.y2, 0.1, 0.8, 0.4, '#b48cff');
    } else if (ev.type === 'ruleState' && ev.active) {
      const info = this.sim.ruleInfo?.();
      for (const z of info?.zones || []) this.fx.ring(z.x, z.y, 0.3, z.r * 1.3, 0.6, '#ff7a1f');
    }
  }
}

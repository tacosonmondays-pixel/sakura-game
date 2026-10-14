// Model offsets for melee lunges and cannon recoil (the girl's model moves, her sim position
// — selection ring, picking, range — never does). ≤ 0.25 tiles, game time.

export class Lunges {
  constructor(ctx) {
    this.ctx = ctx;
    this.map = new Map();
    this.free = [];
    this.off = { x: 0, z: 0 };
  }

  /**
   * Starts a lunge of `dist` tiles toward direction (dx, dy) (normalised here): ease out over
   * `out`, hold `hold`, ease back over `back` (game seconds). Negative dist = recoil.
   */
  start(uid, dx, dy, dist, out = 0.06, hold = 0.04, back = 0.16) {
    const ctx = this.ctx;
    if (ctx.reduceMotion) return;
    if (ctx.quality === 'low') dist *= 0.5;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1e-6) return;
    let l = this.map.get(uid);
    if (!l) {
      l = this.free.pop() || {};
      this.map.set(uid, l);
    }
    l.t = 0;
    l.dx = dx / d;
    l.dy = dy / d;
    l.dist = Math.max(-0.25, Math.min(0.25, dist));
    l.out = Math.max(1e-3, out);
    l.hold = hold;
    l.back = Math.max(1e-3, back);
  }

  /** Shared offset object {x, z} for a girl (zero when idle). */
  offset(uid) {
    const o = this.off;
    const l = this.map.get(uid);
    if (!l) {
      o.x = 0;
      o.z = 0;
      return o;
    }
    const k = curve(l);
    o.x = l.dx * l.dist * k;
    o.z = l.dy * l.dist * k;
    return o;
  }

  update(gdt) {
    if (!this.map.size) return;
    this._gdt = gdt;
    this.map.forEach(this._tick, this);
  }

  _tick(l, uid) {
    l.t += this._gdt;
    if (l.t >= l.out + l.hold + l.back) {
      this.map.delete(uid);
      this.free.push(l);
    }
  }

  clear() {
    this.map.clear();
  }
}

export function curve(l) {
  const t = l.t;
  if (t < l.out) {
    const k = t / l.out;
    return 1 - (1 - k) * (1 - k);
  }
  if (t < l.out + l.hold) return 1;
  const k = Math.min(1, (t - l.out - l.hold) / l.back);
  return 0.5 + 0.5 * Math.cos(Math.PI * k);
}

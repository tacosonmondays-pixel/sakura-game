// Ribbon trails (FX-1 kit): a strip that follows a short position history, tapering in width and
// alpha toward its tail. High quality only, at most MAX_RIBBONS live at a time; drawn as a handful of
// flat ground quads (a dust wake) through the attack-FX quad budget as decoration (shed first).
import { DECOR } from '../attackFx/context.js';

export const MAX_RIBBONS = 6;
const POINTS = 8;
/** History spacing (game seconds between samples). */
const EVERY = 0.03;

export class Ribbons {
  constructor(ctx) {
    this.ctx = ctx;
    this.list = [];
    for (let i = 0; i < MAX_RIBBONS; i++) {
      this.list.push({ owner: null, xs: new Float32Array(POINTS), ys: new Float32Array(POINTS), n: 0, head: 0, acc: 0, seen: 0, width: 0.2 });
    }
    this.frame = 0;
    this.live = 0;
  }

  /** The ribbon of `owner` (any object key), or null when all are taken / not on High. */
  get(owner, width = 0.2) {
    if (this.ctx.quality !== 'high') return null;
    let free = null;
    for (const r of this.list) {
      if (r.owner === owner) return r;
      if (!free && r.owner === null) free = r;
    }
    if (!free) return null;
    free.owner = owner;
    free.n = 0;
    free.head = 0;
    free.acc = EVERY;
    free.width = width;
    return free;
  }

  /** Feeds the owner's current ground point (call once a frame while it moves). */
  push(r, x, y, gdt) {
    if (!r) return;
    r.seen = this.frame;
    r.acc += gdt;
    if (r.acc < EVERY && r.n > 0) {
      // keep the head glued to the owner between samples
      r.xs[r.head] = x;
      r.ys[r.head] = y;
      return;
    }
    r.acc = 0;
    r.head = (r.head + 1) % POINTS;
    r.xs[r.head] = x;
    r.ys[r.head] = y;
    if (r.n < POINTS) r.n++;
  }

  /** Draws every live ribbon at ground height `h` and frees the ones not fed this frame. */
  update(color, h = 0.07, alpha = 0.42) {
    const ctx = this.ctx;
    let live = 0;
    for (const r of this.list) {
      if (r.owner === null) continue;
      if (r.seen !== this.frame) {
        r.owner = null;
        continue;
      }
      live++;
      for (let k = 0; k < r.n - 1; k++) {
        const a = (r.head - k + POINTS) % POINTS;
        const b = (a - 1 + POINTS) % POINTS;
        const dx = r.xs[b] - r.xs[a];
        const dz = r.ys[b] - r.ys[a];
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len < 0.005) continue;
        const f = 1 - k / (POINTS - 1);
        ctx.quadRGB(ctx.b.groundN, DECOR, (r.xs[a] + r.xs[b]) / 2, h, (r.ys[a] + r.ys[b]) / 2, len * 1.15, r.width * (0.35 + 0.65 * f), ctx.R.soft,
          color.r, color.g, color.b, alpha * f, Math.atan2(-dz, dx));
      }
    }
    this.live = live;
    this.frame++;
  }

  clear() {
    for (const r of this.list) r.owner = null;
    this.live = 0;
  }
}

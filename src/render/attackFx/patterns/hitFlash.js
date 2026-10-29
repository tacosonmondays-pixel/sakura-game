// Crisp hit flashes: a short star that pops white and cools to the girl's colour (≈ 80 ms), drawn
// on top of the renderer's own hit spark. Anti-strobe by construction:
//   - one flash per enemy at a time: a hit on an enemy that is still flashing (or flashed less than
//     `gap` ago) merges into that flash (it swells a little) instead of starting another;
//   - at most `perFrame` new flashes a frame and `cap` alive (by quality), the rest are skipped;
//   - Reduce motion: a soft, dimmer glow (no white star, no pop), a little longer.
// Real time (not game time): at 3× speed a game-time flash would last one or two frames and flicker.
// Fixed pool, quads pushed through the attack-FX context (budget aware), nothing allocated per hit.
import { CORE } from '../context.js';

/** Per quality: alive cap and new flashes per frame. */
export const FLASH_CAPS = {
  high: { cap: 16, perFrame: 6 },
  medium: { cap: 10, perFrame: 4 },
  low: { cap: 5, perFrame: 2 },
};
/** Flash life (real seconds) and the shortest gap between two flashes on one enemy. */
export const FLASH_LIFE = 0.08;
export const FLASH_LIFE_SOFT = 0.14;
export const FLASH_GAP = 0.12;
/** Tiles a flash is drawn toward the camera from the body centre (so the body never hides it). */
export const FLASH_PUSH = 0.42;

/**
 * Size, alpha and white→colour mix of a flash at life fraction k (pure).
 * @returns {{scale:number, alpha:number, mix:number}}
 */
export function flashShape(k, soft = false, out = { scale: 1, alpha: 1, mix: 0 }) {
  k = k < 0 ? 0 : k > 1 ? 1 : k;
  if (soft) {
    // no pop: a gentle swell and fade, already half way to the colour
    out.scale = 0.9 + 0.15 * k;
    out.alpha = 0.5 * (1 - k) * Math.min(1, k / 0.2 + 0.4);
    out.mix = 0.5 + 0.5 * k;
    return out;
  }
  // a snap to full size in the first quarter, then a slight shrink while it cools
  const p = Math.min(1, k / 0.25);
  out.scale = 0.55 + 0.6 * (1 - (1 - p) * (1 - p)) - 0.25 * k;
  out.alpha = 1 - k * k;
  out.mix = Math.min(1, k * 1.4);
  return out;
}

const _s = { scale: 1, alpha: 1, mix: 0 };

export class FlashLayer {
  /** @param {object} ctx attack-FX context (quadRGB, b, R, quality, reduceMotion) */
  constructor(ctx, pool = 16) {
    this.ctx = ctx;
    this.live = [];
    this.free = [];
    for (let i = 0; i < pool; i++) this.free.push({ uid: -1, x: 0, h: 0, z: 0, size: 0, t: 0, life: 0, r: 1, g: 1, b: 1, rot: 0, swell: 0 });
    this.newThisFrame = 0;
    /** hits merged into a live flash / skipped by a cap (perf probe) */
    this.merged = 0;
    this.skipped = 0;
  }

  get count() {
    return this.live.length;
  }

  /**
   * A flash on enemy `uid` at (x, h, z). `c` = the colour it cools to. Returns 'new', 'merged' or
   * 'skipped'.
   */
  hit(uid, x, h, z, size, c) {
    const live = this.live;
    for (let i = 0; i < live.length; i++) {
      const f = live[i];
      if (f.uid === uid && uid != null && f.t < Math.max(f.life, FLASH_GAP)) {
        f.swell = Math.min(0.35, f.swell + 0.12);
        f.x = x;
        f.h = h;
        f.z = z;
        this.merged++;
        return 'merged';
      }
    }
    const caps = FLASH_CAPS[this.ctx.quality] || FLASH_CAPS.medium;
    if (this.newThisFrame >= caps.perFrame || live.length >= caps.cap) {
      this.skipped++;
      return 'skipped';
    }
    const f = this.free.pop();
    if (!f) {
      this.skipped++;
      return 'skipped';
    }
    this.newThisFrame++;
    f.uid = uid;
    f.x = x;
    f.h = h;
    f.z = z;
    f.size = size;
    f.t = 0;
    f.life = this.ctx.reduceMotion ? FLASH_LIFE_SOFT : FLASH_LIFE;
    f.r = c.r;
    f.g = c.g;
    f.b = c.b;
    // a fixed tilt per enemy: the star does not spin, it snaps
    f.rot = (((uid | 0) * 2.399) % 6.283) * 0.25;
    f.swell = 0;
    live.push(f);
    return 'new';
  }

  /** @param {number} rdt real seconds */
  update(rdt) {
    this.newThisFrame = 0;
    const ctx = this.ctx;
    const soft = ctx.reduceMotion;
    // the camera's backward axis (world): a flash at a body centre would sit inside the body
    const m = ctx.camera?.matrixWorld?.elements;
    const px = m ? m[8] * FLASH_PUSH : 0;
    const ph = m ? m[9] * FLASH_PUSH : 0;
    const pz = m ? m[10] * FLASH_PUSH : 0;
    const live = this.live;
    let n = 0;
    for (let i = 0; i < live.length; i++) {
      const f = live[i];
      f.t += rdt;
      // (a merged flash keeps its slot until the gap has passed, drawn only while it lives)
      if (f.t >= Math.max(f.life, FLASH_GAP)) {
        this.free.push(f);
        continue;
      }
      live[n++] = f;
      if (f.t >= f.life) continue;
      flashShape(f.t / f.life, soft, _s);
      const mx = _s.mix;
      const r = 1 + (f.r - 1) * mx;
      const g = 1 + (f.g - 1) * mx;
      const b = 1 + (f.b - 1) * mx;
      const x = f.x + px;
      const h = f.h + ph;
      const z = f.z + pz;
      const s = f.size * _s.scale * (1 + f.swell);
      if (soft) {
        ctx.quadRGB(ctx.b.bbA, CORE, x, h, z, s * 1.3, s * 1.3, ctx.R.glow, f.r, f.g, f.b, _s.alpha);
        continue;
      }
      // the star, a hot white pin in its middle and a small coloured glow under it
      ctx.quadRGB(ctx.b.bbA, CORE, x, h, z, s, s, ctx.R.star, r, g, b, _s.alpha, f.rot);
      ctx.quadRGB(ctx.b.bbA, CORE, x, h, z, s * 0.42, s * 0.42, ctx.R.star, 1, 1, 1, _s.alpha, f.rot + 0.785);
      ctx.quadRGB(ctx.b.bbA, CORE, x, h, z, s * 1.1, s * 1.1, ctx.R.glow, f.r, f.g, f.b, _s.alpha * 0.45);
    }
    live.length = n;
  }

  clear() {
    for (const f of this.live) this.free.push(f);
    this.live.length = 0;
  }

  dispose() {
    this.clear();
  }
}

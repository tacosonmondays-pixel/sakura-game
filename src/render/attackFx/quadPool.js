// Pooled game-time quads with delay (rings that start staggered, reticles, decals, rays).
// Unlike FxSystem particles these live in GAME time (they freeze when the battle is paused and
// play 3× faster at 3× speed, like the enemies they point at) and count against the attack-FX
// quad budget with a shed class.

export const SPIN_X = 1; // coin flip: width oscillates
export const EASE_OUT = 2; // size grows with ease-out instead of linearly
export const FADE_IN = 4; // alpha ramps in over the first 20% of life
export const GROUND = 8; // never bounces (ground decal)

export class QuadPool {
  /** @param {object} ctx attack-FX context (quad(), batches) @param {number} cap */
  constructor(ctx, cap = 768) {
    this.ctx = ctx;
    this.cap = cap;
    this.live = [];
    this.free = [];
    for (let i = 0; i < cap; i++) this.free.push(this._blank());
  }

  _blank() {
    return {
      B: null, cls: 0, uv: null, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, drag: 0,
      s0: 0, s1: 0, asp: 1, rot: 0, vrot: 0, a0: 1, a1: 0, r: 1, gc: 1, bc: 1,
      life: 0.3, t: 0, delay: 0, flags: 0,
    };
  }

  /**
   * Spawns one quad (x, y = ground point, h = height). Returns the record so callers can set
   * extra fields (vx, vy, g, delay, rot, vrot, asp, flags, a1…), or null when the pool is full.
   * @param {object} B QuadBatch @param {number} cls shed class (ctx.CORE/DECOR/FAMILIAR/MOTE)
   */
  spawn(B, cls, uv, x, h, y, s0, s1, life, c, a0 = 1) {
    const p = this.free.pop();
    if (!p) return null;
    p.B = B;
    p.cls = cls;
    p.uv = uv;
    p.x = x;
    p.y = h;
    p.z = y;
    p.vx = 0;
    p.vy = 0;
    p.vz = 0;
    p.g = 0;
    p.drag = 0;
    p.s0 = s0;
    p.s1 = s1;
    p.asp = 1;
    p.rot = 0;
    p.vrot = 0;
    p.a0 = a0;
    p.a1 = 0;
    p.r = c.r;
    p.gc = c.g;
    p.bc = c.b;
    p.life = Math.max(1e-3, life);
    p.t = 0;
    p.delay = 0;
    p.flags = 0;
    this.live.push(p);
    return p;
  }

  get count() {
    return this.live.length;
  }

  /** Advances (game seconds) and draws every live quad through ctx.quad (budget aware). */
  update(gdt) {
    const ctx = this.ctx;
    const live = this.live;
    let n = 0;
    for (let i = 0; i < live.length; i++) {
      const p = live[i];
      if (p.delay > 0) {
        p.delay -= gdt;
        live[n++] = p;
        continue;
      }
      p.t += gdt;
      if (p.t >= p.life) {
        this.free.push(p);
        continue;
      }
      live[n++] = p;
      if (p.drag) {
        const k = Math.exp(-p.drag * gdt);
        p.vx *= k;
        p.vy *= k;
        p.vz *= k;
      }
      p.vy += p.g * gdt;
      p.x += p.vx * gdt;
      p.y += p.vy * gdt;
      p.z += p.vz * gdt;
      if (p.g && p.y < 0.04 && !(p.flags & GROUND)) {
        p.y = 0.04;
        p.vy *= -0.35;
        p.vx *= 0.6;
        p.vz *= 0.6;
      }
      p.rot += p.vrot * gdt;
      const k = p.t / p.life;
      const ks = p.flags & EASE_OUT ? 1 - (1 - k) * (1 - k) : k;
      const s = p.s0 + (p.s1 - p.s0) * ks;
      let a = p.a0 + (p.a1 - p.a0) * k;
      if (p.flags & FADE_IN && k < 0.2) a *= k / 0.2;
      let w = s * p.asp;
      if (p.flags & SPIN_X) w *= Math.abs(Math.cos(p.t * 11));
      ctx.quadRGB(p.B, p.cls, p.x, p.y, p.z, w, s, p.uv, p.r, p.gc, p.bc, a, p.rot);
    }
    live.length = n;
  }

  clear() {
    for (const p of this.live) this.free.push(p);
    this.live.length = 0;
  }
}

// Impact flourishes (added on top of the default hit / explosion effects, only for a matched
// sim hit or explode — never on a projectile that simply expired). Game-time pooled quads.
import { CORE, DECOR } from '../context.js';
import { GROUND, SPIN_X, EASE_OUT } from '../quadPool.js';

const TAU = Math.PI * 2;

/** Firework chrysanthemum: star sparks radiating out and falling, alternating colours. */
export function chrysanthemum(ctx, x, h, y, n, cols, size = 0.16, speed = 2.4) {
  const k = ctx.n(n);
  for (let i = 0; i < k; i++) {
    const a = (i / k) * TAU + ctx.rand() * 0.3;
    const up = 0.3 + ctx.rand() * 0.9;
    const c = cols[i % cols.length];
    const p = ctx.spr(ctx.b.bbA, i < 4 ? CORE : DECOR, ctx.R.star, x, h, y, size, size * 0.3, 0.55 + ctx.rand() * 0.2, c, 1);
    if (!p) continue;
    p.vx = Math.cos(a) * speed;
    p.vz = Math.sin(a) * speed;
    p.vy = up * speed * 0.6;
    p.g = -4;
    p.drag = 2.2;
    p.vrot = 6;
  }
  flash(ctx, x, h, y, 0.7 * (size / 0.16), cols[0], 0.14);
}

/** Water crown: droplets thrown up in a ring + a ground ripple. */
export function waterCrown(ctx, x, y, n, c, r = 0.5) {
  const k = ctx.n(n);
  for (let i = 0; i < k; i++) {
    const a = (i / k) * TAU;
    const p = ctx.spr(ctx.b.bbN, i < 3 ? CORE : DECOR, ctx.R.drop, x + Math.cos(a) * 0.12, 0.2, y + Math.sin(a) * 0.12, 0.12, 0.08, 0.45, c, 0.95);
    if (!p) continue;
    p.vx = Math.cos(a) * 1.1;
    p.vz = Math.sin(a) * 1.1;
    p.vy = 1.8 + ctx.rand() * 0.4;
    p.g = -9;
    p.asp = 0.7;
  }
  ripple(ctx, x, y, 0.1, r, 0.35, c, 0, 'ringSoft', true);
}

/** Paper confetti (talismans): little flipping paper quads. */
export function confetti(ctx, x, h, y, n, cols) {
  const k = ctx.n(n);
  for (let i = 0; i < k; i++) {
    const a = ctx.rand() * TAU;
    const p = ctx.spr(ctx.b.bbN, DECOR, ctx.R.white, x, h, y, 0.06, 0.06, 0.6, cols[i % cols.length], 1);
    if (!p) continue;
    p.vx = Math.cos(a) * 1.2;
    p.vz = Math.sin(a) * 1.2;
    p.vy = 1 + ctx.rand();
    p.g = -5;
    p.drag = 2;
    p.asp = 1.6;
    p.vrot = 8;
    p.flags = SPIN_X;
  }
}

/** Crystal shards bursting out (frost, armour cracks). */
export function shardBurst(ctx, x, h, y, n, c, speed = 2) {
  const k = ctx.n(n);
  for (let i = 0; i < k; i++) {
    const a = (i / k) * TAU + ctx.rand() * 0.4;
    const p = ctx.spr(ctx.b.bbA, i < 3 ? CORE : DECOR, ctx.R.shard, x, h, y, 0.17, 0.08, 0.5, c, 1);
    if (!p) continue;
    p.vx = Math.cos(a) * speed;
    p.vz = Math.sin(a) * speed;
    p.vy = 0.8 + ctx.rand() * 1.4;
    p.g = -8;
    p.rot = a;
    p.vrot = 9;
  }
}

/** Soft additive flash. */
export function flash(ctx, x, h, y, size, c, life = 0.12, cls = CORE) {
  const p = ctx.spr(ctx.b.bbA, cls, ctx.R.glow, x, h, y, size, size * 1.35, life, c, 1);
  if (p) p.flags = EASE_OUT;
  return p;
}

/** Ground ring growing r0 → r1 (radius), optionally delayed. */
export function ripple(ctx, x, y, r0, r1, life, c, delay = 0, uv = 'ringSoft', additive = true, a0 = 0.9, cls = CORE) {
  const p = ctx.spr(additive ? ctx.b.groundA : ctx.b.groundN, cls, ctx.R[uv] || ctx.R.ringSoft, x, 0.07, y, r0 * 2, r1 * 2, life, c, a0);
  if (p) {
    p.delay = delay;
    p.flags = GROUND | EASE_OUT;
  }
  return p;
}

/** Flat ground stain / scorch disc fading out. */
export function stain(ctx, x, y, r, c, a = 0.35, life = 0.9, uv = 'disc') {
  const p = ctx.spr(ctx.b.groundN, CORE, ctx.R[uv] || ctx.R.disc, x, 0.045, y, r * 1.6, r * 2, life, c, a);
  if (p) {
    p.flags = GROUND | EASE_OUT;
    p.rot = ctx.rand() * TAU;
  }
  return p;
}

/** Rising sprite (note, sparkle) that floats up and fades. */
export function rise(ctx, uv, x, h, y, size, c, life = 0.7, speed = 0.9, cls = DECOR) {
  const p = ctx.spr(ctx.b.bbA, cls, uv, x, h, y, size, size * 0.8, life, c, 1);
  if (p) {
    p.vy = speed;
    p.drag = 1.2;
  }
  return p;
}

/** A coin that hops off the target, spins and falls. */
export function coinHop(ctx, x, h, y) {
  const p = ctx.spr(ctx.b.bbN, CORE, ctx.R.coin, x, h, y, 0.26, 0.22, 0.55, ctx.col('#ffffff'), 1);
  if (p) {
    const a = ctx.rand() * TAU;
    p.vx = Math.cos(a) * 0.6;
    p.vz = Math.sin(a) * 0.6;
    p.vy = 2.2;
    p.g = -9;
    p.flags = SPIN_X;
  }
  return p;
}

/** Small spark spray (tink, sparks on a hit). */
export function sparks(ctx, x, h, y, n, c, speed = 1.6, cls = DECOR) {
  const k = ctx.n(n);
  for (let i = 0; i < k; i++) {
    const a = ctx.rand() * TAU;
    const p = ctx.spr(ctx.b.bbA, cls, ctx.R.glow, x, h, y, 0.08, 0.02, 0.28, c, 1);
    if (!p) continue;
    p.vx = Math.cos(a) * speed;
    p.vz = Math.sin(a) * speed;
    p.vy = 0.6 + ctx.rand() * 1.2;
    p.g = -6;
    p.drag = 2;
  }
}

/** Light petals / leaves drifting out in a spiral (decor). */
export function petalSpiral(ctx, uv, x, y, n, c, r = 1, life = 0.8) {
  const k = ctx.n(n);
  for (let i = 0; i < k; i++) {
    const a = (i / k) * TAU;
    const p = ctx.spr(ctx.b.bbN, DECOR, uv, x + Math.cos(a) * 0.15, 0.35 + ctx.rand() * 0.2, y + Math.sin(a) * 0.15, 0.12, 0.08, life, c, 1);
    if (!p) continue;
    const sp = r / life;
    p.vx = Math.cos(a + 0.6) * sp;
    p.vz = Math.sin(a + 0.6) * sp;
    p.vy = 0.3;
    p.drag = 1.5;
    p.vrot = 5;
    p.rot = a;
  }
}

// Small helpers shared by the girl styles (no allocation per call).
import { victimHits } from '../math/victims.js';
import { CORE } from '../context.js';

const XS = new Float32Array(64);
const YS = new Float32Array(64);
const HAND = { x: 0, y: 0, h: 0, tip: false, kind: null, dx: 0, dy: 0, dh: 0 };

/** Shared hand point of a girl (overwritten by the next call): her weapon's tip when she has one (h.tip). */
export function hand(ctx, t) {
  return ctx.hand(t, HAND);
}

/** A style's height nudge above her hand point: none at a weapon tip (the shot leaves the tip itself). */
export function tipUp(h, dz) {
  return h.tip ? 0 : dz;
}

/**
 * Victims of the pulse / hitscan event at events[i] (attributed hits, newest first) into
 * ctx.victims, and their hit positions into the shared XS / YS arrays.
 * @returns {{n:number, xs:Float32Array, ys:Float32Array, uids:number[]}}
 */
const OUT = { n: 0, xs: XS, ys: YS, uids: null };
export function victims(ctx, events, i, cx, cy, radius, attackType, max) {
  victimHits(events, i, cx, cy, radius, attackType, Math.min(64, max || 64), ctx.victims, ctx.vpos);
  const n = ctx.victims.length;
  for (let k = 0; k < n; k++) {
    XS[k] = ctx.vpos[k * 2];
    YS[k] = ctx.vpos[k * 2 + 1];
  }
  OUT.n = n;
  OUT.uids = ctx.victims;
  return OUT;
}

/** Body point of an enemy (shared {x, h, y}) or null. */
const BODY = { x: 0, h: 0, y: 0 };
export function body(ctx, uid) {
  const e = ctx.enemy(uid);
  if (!e) return null;
  BODY.x = e.x;
  BODY.y = e.z;
  BODY.h = ctx.enemyH(e);
  return BODY;
}

/** A small flash at the girl's hand, at her weapon's tip when she has one (replaces the default muzzle flash). */
export function handFlash(ctx, t, c, size = 0.32, life = 0.09) {
  if (!ctx.cap('muzzle')) return;
  const h = hand(ctx, t);
  ctx.spr(ctx.b.bbA, CORE, ctx.R.glow, h.x, h.h, h.y, size, size * 1.3, life, c, 1);
  if (h.tip) tipFlare(ctx, h, c, size, life);
}

/**
 * The weapon's own flare on top of a tip flash: a gun or a bow flashes along the weapon (a cone down the barrel, out
 * of the bow); a staff's head glows a little longer instead. `h` is a weapon tip (ctx.muzzle, or hand with h.tip).
 */
export function tipFlare(ctx, h, c, size = 0.32, life = 0.09) {
  if (h.kind === 'gun' || h.kind === 'bow') {
    if (!(h.dx || h.dy || h.dh)) return;
    const ang = ctx.screenAngle(h.x, h.h, h.y, h.dx, h.dh, h.dy);
    const k = size * 0.35;
    const p = ctx.spr(ctx.b.bbA, CORE, ctx.R.cone, h.x + h.dx * k, h.h + h.dh * k, h.y + h.dy * k, size * 1.1, size * 0.7, life, c, 0.9);
    if (p) {
      p.asp = 0.6;
      p.rot = ang - Math.PI / 2;
    }
  } else {
    ctx.spr(ctx.b.bbA, CORE, ctx.R.glow, h.x, h.h, h.y, size * 0.7, size * 1.1, life * 2.2, c, 0.55);
  }
}

/** Integer count scaled by the quality's mote factor (≥ min). */
export function moteCount(ctx, n, min = 1) {
  return Math.max(min, Math.round(n * ctx.q.motes));
}

/** Every `period` game seconds (per record accumulator in obj[key]). */
export function every(obj, key, gdt, period) {
  obj[key] = (obj[key] || 0) - gdt;
  if (obj[key] > 0) return false;
  obj[key] += period;
  if (obj[key] < 0) obj[key] = period;
  return true;
}

/** Aura radius of a girl, or 0. */
export function auraRange(t) {
  return t.stats?.aura?.range || 0;
}

/** Ground direction from (ax, ay) to (bx, by) as an angle (atan2(dx, dy)). */
export function dirAngle(ax, ay, bx, by) {
  return Math.atan2(bx - ax, by - ay);
}

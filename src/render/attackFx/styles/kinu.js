// Kinu (360° ring, src/sim/rings.js). Signature "Pin burst": every ring flashes a starburst of thin
// silver spokes at her feet, and each pin flies as a silver needle with a bright tip and a red thread
// that waves behind it. A pin that lands pricks: a small silver cross and a red thread fleck.
//   P0 Hot Iron: T1+ pins glow orange-hot (their burn flickers a small flame on the walker);
//                T3 Iron Ring: the heat ring (drawn from the sim in src/render/actors.js) carries a
//                crown of embers riding its edge out to her range; T5 Molten Hem: two crowns, and
//                the sparks a finished walker throws fly as embers
//   P1 Spinning Bobbin: T3+ Thread Cutter: the pins (the sim keeps them 'needle' shots) are drawn as
//                tiny spinning cross blades (ice-white at T4, gold at T5); Blade Spiral's blades too
//   P2 Pin Cushion: more pins (the burst gets more spokes); T4+ each orbiting pair of scissors
//                flashes two crossing blades and a glint where the sim has it
import { lookAt } from '../flair.js';
import { flash, sparks } from '../patterns/bursts.js';
import { spokes, streak, statusCue } from '../patterns/academy.js';
import { HEAT_RING_SPEED, STEP, RING_DIRS, SCISSOR_STEPS, SCISSOR_REACH } from '../../../sim/constants.js';
import { CORE, DECOR } from '../context.js';

const SILVER = '#e6eaf2';
const THREAD = '#e8475f';
const EMBER = '#ffb347';
const HOT = '#ff7a2e';
const ICE = '#bfeaff';
const GOLD = '#ffe08a';

/** Blade colour for her look. */
function bladeHex(lk) {
  const p1 = lookAt(lk, 1);
  return p1 >= 5 ? GOLD : p1 >= 4 ? ICE : SILVER;
}

/** A crown of embers riding a heat ring's edge out to `range` (game-time quads, delay for the 2nd ring). */
function emberCrown(ctx, x, y, range, n, delay, c) {
  const life = range / HEAT_RING_SPEED;
  const ph = ctx.rand() * 6.28;
  for (let i = 0; i < n; i++) {
    const a = ph + (i / n) * 6.283;
    const ux = Math.sin(a);
    const uy = Math.cos(a);
    const p = ctx.spr(ctx.b.bbA, i < 4 ? CORE : DECOR, ctx.R.glow, x + ux * 0.1, 0.16, y + uy * 0.1, 0.16, 0.08, life, c, 1);
    if (!p) continue;
    p.vx = ux * HEAT_RING_SPEED;
    p.vz = uy * HEAT_RING_SPEED;
    p.vy = 0.15;
    p.delay = delay;
    p.a1 = 0.2;
  }
}

export const kinu = {
  id: 'kinu',

  onAttack(ev, tw, t, ctx) {
    const lk = tw.look;
    if (ev.kind === 'heatRing') {
      const range = t.eff?.range || 1.8;
      const n = ctx.q.trails > 0 ? 12 : 6;
      const c = ctx.col(lookAt(lk, 0) >= 5 ? GOLD : EMBER);
      emberCrown(ctx, t.x, t.y, range, n, 0, c);
      if (t.stats?.ring?.double) emberCrown(ctx, t.x, t.y, range, n, 0.6 / HEAT_RING_SPEED, ctx.col(HOT));
      if (ctx.cap('muzzle')) flash(ctx, t.x, 0.3, t.y, 0.7, ctx.col(HOT), 0.14);
      return;
    }
    if (ev.kind !== 'ring') return;
    // the pin burst: thin spokes at her feet, one per pin (capped), and a small glint
    const pins = Math.min(16, t.eff?.projectiles || 8);
    const hot = lk.accent[0] >= 1 || lookAt(lk, 0) > 0;
    const c = ctx.col(lookAt(lk, 1) >= 3 ? bladeHex(lk) : hot ? EMBER : SILVER);
    const turn = t.stats?.ring?.turn ? ((t.ringTurn || 0) * Math.PI * 2) / 16 : 0;
    spokes(ctx, t.x, t.y, ctx.q.trails > 0 ? pins : Math.min(8, pins), 0.18, 0.62, c, 0.13, turn, 0.85, DECOR);
    if (ctx.cap('muzzle')) ctx.spr(ctx.b.bbA, CORE, ctx.R.star, t.x, 0.45, t.y, 0.25, 0.45, 0.12, c, 1);
  },

  view(p, rec, _t, v, ctx) {
    v.skip = true;
    const vl = Math.hypot(p.vx, p.vy) || 1;
    const ux = p.vx / vl;
    const uy = p.vy / vl;
    const lk = rec.tw.look;
    const B = ctx.b.bbA;
    if (p.kind === 'spark') {
      // Molten Hem's spark: a short ember streak
      const c = ctx.col(EMBER);
      ctx.line(B, CORE, v.x, v.z, v.y, v.x - ux * 0.16, v.z, v.y - uy * 0.16, 0.06, c, 1);
      ctx.quad(B, DECOR, v.x, v.z, v.y, 0.16, 0.16, ctx.R.glow, ctx.col(HOT), 0.7);
      return;
    }
    if (p.kind === 'blade' || (p.kind === 'needle' && lookAt(lk, 1) >= 3)) {
      // a tiny spinning cross blade: two crossing bright edges turning round its flight
      const c = ctx.col(bladeHex(lk));
      const a = (ctx.reduceMotion ? 0 : ctx.time * 22) + rec.uid;
      const cx = Math.cos(a) * 0.17;
      const sy = Math.sin(a) * 0.17;
      ctx.line(B, CORE, v.x - cx, v.z, v.y - sy, v.x + cx, v.z, v.y + sy, 0.075, c, 1);
      ctx.line(B, CORE, v.x + sy, v.z, v.y - cx, v.x - sy, v.z, v.y + cx, 0.075, c, 1);
      ctx.quad(B, DECOR, v.x, v.z, v.y, 0.26, 0.26, ctx.R.glow, c, 0.45);
      if (ctx.q.trails > 0) ctx.line(B, DECOR, v.x, v.z, v.y, v.x - ux * 0.36, v.z, v.y - uy * 0.36, 0.07, c, 0.4);
      return;
    }
    // a needle: silver shaft, a bright tip, a red thread waving behind
    const hot = lk.accent[0] >= 1 || lookAt(lk, 0) > 0;
    const shaft = ctx.col(hot ? EMBER : SILVER);
    ctx.line(B, CORE, v.x, v.z, v.y, v.x - ux * 0.32, v.z, v.y - uy * 0.32, 0.055, shaft, 1);
    ctx.quad(B, CORE, v.x, v.z, v.y, 0.15, 0.15, ctx.R.star, ctx.col(hot ? '#fff1d6' : '#ffffff'), 1);
    if (ctx.q.trails <= 0) return;
    const thr = ctx.col(THREAD);
    const w = ctx.reduceMotion ? 0 : Math.sin(ctx.time * 26 + rec.uid) * 0.05;
    const bx = v.x - ux * 0.32;
    const by = v.y - uy * 0.32;
    const mx = bx - ux * 0.12 - uy * w;
    const my = by - uy * 0.12 + ux * w;
    ctx.line(ctx.b.bbN, DECOR, bx, v.z, by, mx, v.z, my, 0.035, thr, 0.95, ctx.R.white);
    ctx.line(ctx.b.bbN, DECOR, mx, v.z, my, mx - ux * 0.12 + uy * w, v.z, my - uy * 0.12 - ux * w, 0.028, thr, 0.75, ctx.R.white);
  },

  onImpact(rec, x, y, crit, radius, ctx) {
    const lk = rec.tw?.look;
    if (rec.kind === 'spark') {
      flash(ctx, x, 0.3, y, 0.3, ctx.col(EMBER), 0.08);
      return;
    }
    if (rec.kind === 'blade' || (lk && lookAt(lk, 1) >= 3)) {
      const p = ctx.spr(ctx.b.bbA, CORE, ctx.R.slash, x, 0.4, y, 0.35, 0.5, 0.12, ctx.col(lk ? bladeHex(lk) : SILVER), 1);
      if (p) {
        p.asp = 2;
        p.rot = rec.uid * 1.7;
      }
      return;
    }
    // the prick: a small silver cross and a red fleck of thread
    const c = ctx.col(SILVER);
    streak(ctx, CORE, x, 0.4, y, 1, 0.6, 0, 0.22, 0.04, 0.12, c, 1, false);
    streak(ctx, CORE, x, 0.4, y, -1, 0.6, 0, 0.22, 0.04, 0.12, c, 1, false);
    if (ctx.q.sparks) sparks(ctx, x, 0.35, y, 2, ctx.col(THREAD), 1);
  },

  onStatus(ev, tw, t, ctx) {
    if (ev.status !== 'burn') return;
    const e = ctx.enemy(ev.uid);
    if (e) statusCue(ctx, ctx.R.spark || ctx.R.glow, e.x, ctx.enemyH(e) + 0.2, e.z, 0.22, ctx.col(HOT), 0.4);
  },

  update(gdt, tw, t, ctx) {
    // Orbit Scissors (Pin Cushion T4+): two crossing blades and a glint where the sim has each pair
    const pairs = t.stats?.ring?.scissors || 0;
    if (!(pairs > 0)) return;
    const step = Math.round(ctx.sim.time / STEP);
    const c = ctx.col(lookAt(tw.look, 2) >= 5 ? GOLD : SILVER);
    const B = ctx.b.bbA;
    for (let j = 0; j < pairs; j++) {
      // the sim's scissorPos (src/sim/rings.js) without its array: direction k of the ring table
      const k = (((step * SCISSOR_STEPS + Math.floor((j * RING_DIRS) / pairs)) % RING_DIRS) + RING_DIRS) % RING_DIRS;
      const ang = (2 * Math.PI * k) / RING_DIRS;
      const sx = t.x + Math.sin(ang) * SCISSOR_REACH;
      const sy = t.y + Math.cos(ang) * SCISSOR_REACH;
      const a = (ctx.reduceMotion ? 0.6 : 0.6 + 0.45 * Math.sin(ctx.time * 14 + j)) * 0.5;
      const dx = sx - t.x;
      const dy = sy - t.y;
      const d = Math.hypot(dx, dy) || 1;
      // blades along the orbit tangent, opening and closing
      const tx = -dy / d;
      const ty = dx / d;
      for (let s = -1; s <= 1; s += 2) {
        const ca = Math.cos(a * s);
        const sa = Math.sin(a * s);
        const bx = (tx * ca - ty * sa) * 0.16;
        const by = (tx * sa + ty * ca) * 0.16;
        ctx.line(B, DECOR, sx - bx, 0.35, sy - by, sx + bx, 0.35, sy + by, 0.045, c, 0.95);
      }
      ctx.quadRGB(B, DECOR, sx, 0.36, sy, 0.12, 0.12, ctx.R.star, c.r, c.g, c.b, 0.9, ctx.time * 3);
    }
  },
};

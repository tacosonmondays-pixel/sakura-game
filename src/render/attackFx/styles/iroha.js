// Iroha (projectile ×2 from her mirror panel and from herself). Signature "Mirror bolts": each
// bolt is a silver glint with a plum trail. Every bolt that leaves the panel is reported to the panel's
// own animation (src/render/mirrorFx.js via ctx.mirrors, drawn by src/render/rosterFx.js): the glass
// flips toward the shot, a glint sweeps it and a small flash marks where the bolt left (rate-limited
// there); her hand flashes when she fires too.
//   P1+ T3: a second, wider plum trail (as before)
//   Mirror Shift (her Mirror Hall ⚡) running: a bolt that left the panel draws split in two (a fainter
//      twin peeling off it) and the panel shows a ghost echo (mirrorFx)
//   P2 Shattered Glass: her splash hits scatter glinting glass shards, more with each tier —
//      Splintered Glass (T2) 3, Glass Shards (T3) 5 + a glitter ring, Glass Storm (T4) 7 + sparkles,
//      Kaleidoscope Burst (T5) 9 + a kaleidoscope flare (six blades blooming out, a turning star);
//      fewer on lower graphics (src/render/mirrorPanel.js shardCount), capped per frame
//   Tiers 1–2 of the other paths keep the plain bolts.
// Reduce motion: shards fade where they break (nothing flies), the flare does not turn.
import { lookAt } from '../flair.js';
import { flash, sparks, ripple } from '../patterns/bursts.js';
import { hand } from './util.js';
import { CORE, DECOR } from '../context.js';
import { GROUND, SPIN_X, EASE_OUT } from '../quadPool.js';
import { shardLevel, shardCount, kaleidoscope } from '../../mirrorPanel.js';
import { GLASS_H } from '../../mirrorFx.js';

const SILVER = '#eeeaff';
const PLUM = '#a46cd0';
const GLASS = ['#ffffff', '#bcd8ff', '#d8b8ff', '#eef0ff'];
const KALEI = ['#c58cff', '#9fd8ff', '#ffd0f0'];
const TAU = Math.PI * 2;
/** Per frame, every Iroha together: glass shards, and Kaleidoscope flares. */
export const SHARDS_PER_FRAME = 36;
export const FLARES_PER_FRAME = 2;
/** A girl's Kaleidoscope flares at least this many game seconds apart (a volley's bolts share one). */
const FLARE_GAP = 0.12;

/** Impact flashes: at most one per this many tiles in this many game seconds (a volley's bolts land on one spot). */
const FLASH_NEAR = 0.6;
const FLASH_GAP = 0.1;
const FLASH_RING = 8;

/** Per-frame budget of this style (on the context: one per renderer, reset when the frame moves on). */
function budget(ctx) {
  let b = ctx.irohaBudget;
  if (!b) {
    b = ctx.irohaBudget = {
      frame: -1, shards: 0, flares: 0,
      // recent impact flashes (x, y, game time), a fixed ring: stacked additive flashes bloom into a white disc
      fx: new Float32Array(FLASH_RING), fy: new Float32Array(FLASH_RING), ft: new Float64Array(FLASH_RING).fill(-1e9), fi: 0,
    };
  }
  if (b.frame !== ctx.frame) {
    b.frame = ctx.frame;
    b.shards = 0;
    b.flares = 0;
  }
  return b;
}

/** May an impact flash draw at (x, y) now? Records it when it may (no other one near there in FLASH_GAP). */
export function flashFree(b, x, y, time) {
  for (let i = 0; i < FLASH_RING; i++) {
    if (time - b.ft[i] < FLASH_GAP && time >= b.ft[i] && Math.abs(b.fx[i] - x) + Math.abs(b.fy[i] - y) < FLASH_NEAR) return false;
  }
  b.fx[b.fi] = x;
  b.fy[b.fi] = y;
  b.ft[b.fi] = time;
  b.fi = (b.fi + 1) % FLASH_RING;
  return true;
}

/** Glinting glass shards scattering from a splash at (x, y) (game-time pooled quads). */
function glassShards(ctx, x, y, n, radius, rm) {
  const r = Math.max(0.3, radius || 0.4);
  const sp = 0.9 + r * 1.5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + Math.random() * 0.5;
    const c = ctx.col(GLASS[i % GLASS.length]);
    const big = i < 2;
    // solid glass (normal blend) so the shards read over the bright splash; the first one sparkles (additive)
    const p = ctx.spr(i === 0 ? ctx.b.bbA : ctx.b.bbN, big ? CORE : DECOR, ctx.R.shard, rm ? x + Math.cos(a) * r * 0.5 : x, 0.35, rm ? y + Math.sin(a) * r * 0.5 : y, big ? 0.2 : 0.15, 0.06, rm ? 0.35 : 0.5 + Math.random() * 0.15, c, 1);
    if (!p) continue;
    p.rot = a;
    if (rm) continue;
    const s = sp * (0.75 + Math.random() * 0.5);
    p.vx = Math.cos(a) * s;
    p.vz = Math.sin(a) * s;
    p.vy = 0.9 + Math.random() * 1.3;
    p.g = -7;
    p.drag = 1.6;
    p.vrot = (i & 1 ? 1 : -1) * (8 + Math.random() * 5);
    // the facets catch the light as they tumble
    p.flags = SPIN_X;
  }
}

/** Kaleidoscope Burst: six glass blades blooming out on the ground, a turning star, a ring of glints. */
function kaleidoFlare(ctx, x, y, radius, full, rm) {
  const r = Math.max(0.5, radius || 0.8);
  // a soft lilac bloom (half strength): the blades and shards carry the read, not a white-out on the targets
  const f = flash(ctx, x, 0.45, y, 0.42, ctx.col(KALEI[0]), 0.14);
  if (f) f.a0 = 0.5;
  ripple(ctx, x, y, rm ? r : 0.2, r * 1.05, 0.38, ctx.col(KALEI[0]), 0, 'ringDashed', true, 0.8);
  if (!full) return;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.26;
    const c = ctx.col(KALEI[i % 3]);
    // ground blades: the shard sprite's long axis points out from the centre
    const p = ctx.spr(ctx.b.groundA, i < 3 ? CORE : DECOR, ctx.R.shard, x + Math.cos(a) * 0.15, 0.08, y + Math.sin(a) * 0.15, 0.3, 0.42, 0.42, c, 0.95);
    if (p) {
      p.rot = Math.atan2(-Math.cos(a), -Math.sin(a));
      p.asp = 0.6;
      p.flags = GROUND | EASE_OUT;
      if (!rm) {
        p.vx = Math.cos(a) * r * 1.4;
        p.vz = Math.sin(a) * r * 1.4;
        p.drag = 3;
      }
    }
    // a glint on the hexagon's corners
    const q = ctx.spr(ctx.b.bbA, DECOR, ctx.R.star, x + Math.cos(a) * r * 0.6, 0.3, y + Math.sin(a) * r * 0.6, 0.05, 0.3, 0.28, c, 1);
    if (q) {
      q.delay = 0.05 + 0.02 * i;
      q.flags = EASE_OUT;
      if (!rm) q.vrot = 5;
    }
  }
  // the centre star turns (Reduce motion: it keeps still)
  const st = ctx.spr(ctx.b.bbA, CORE, ctx.R.star, x, 0.5, y, 0.35, 0.95, 0.24, ctx.col('#f0e4ff'), 0.85);
  if (st) {
    st.flags = EASE_OUT;
    st.rot = 0.26;
    if (!rm) st.vrot = 3.5;
  }
}

export const iroha = {
  id: 'iroha',

  init() {
    return { flareT: -1e9 };
  },

  onAttack(ev, tw, t, ctx) {
    if (!ctx.cap('muzzle')) return;
    const x = t.ox ?? t.x;
    const y = t.oy ?? t.y;
    // the panel's own flash comes with its flip (mirrorFx, per bolt); without that layer, the old flash
    if (!ctx.mirrors) flash(ctx, x, GLASS_H, y, 0.55, ctx.col(SILVER), 0.12);
    if (t.origin && (x !== t.x || y !== t.y)) {
      const h = hand(ctx, t);
      flash(ctx, h.x, h.h, h.y, 0.3, ctx.col(PLUM), 0.1);
    }
  },

  // her two firing points: the sim spawn S is wherever this bolt really started (mirror or her)
  origin(p, t, idx, n, rec, ctx) {
    const vl = Math.hypot(p.vx, p.vy) || 1;
    const sx = p.x - (p.vx / vl) * (p.travel || 0);
    const sy = p.y - (p.vy / vl) * (p.travel || 0);
    rec.sx = sx;
    rec.sy = sy;
    rec.split = 0;
    const fromMirror = Math.hypot(sx - (t.ox ?? t.x), sy - (t.oy ?? t.y)) < Math.hypot(sx - t.x, sy - t.y) || !t.origin;
    if (fromMirror && t.origin) {
      rec.mx = sx;
      rec.my = sy;
      rec.mz = GLASS_H;
      const m = ctx.mirrors;
      if (m) {
        m.shot(t.uid, p.vx, p.vy);
        // Mirror Shift: the bolts it relays draw split in two (a twin peels off either side, by bolt uid)
        if (m.shifting(t)) rec.split = p.uid & 1 ? 1 : -1;
      }
    } else {
      const h = hand(ctx, t);
      rec.mx = h.x;
      rec.my = h.y;
      rec.mz = h.h;
    }
    return true;
  },

  view(p, rec, _t, v, ctx) {
    const vl = Math.hypot(p.vx, p.vy) || 1;
    const dx = p.vx / vl;
    const dy = p.vy / vl;
    ctx.quad(ctx.b.bbA, CORE, v.x, v.z, v.y, 0.26, 0.26, ctx.R.star, ctx.col(SILVER), 0.95, ctx.time * 6);
    ctx.line(ctx.b.bbA, DECOR, v.x, v.z, v.y, v.x - dx * 0.42, v.z, v.y - dy * 0.42, 0.09, ctx.col(PLUM), 0.8);
    if (lookAt(rec.tw.look, 1) >= 3) ctx.line(ctx.b.bbA, DECOR, v.x, v.z, v.y, v.x - dx * 0.3, v.z, v.y - dy * 0.3, 0.18, ctx.col(PLUM), 0.35);
    if (rec.split) {
      // the split twin: it peels off sideways as the bolt leaves the glass (display only; the sim's bolt is the real one)
      const off = 0.24 * Math.min(1, (rec.f || 0) * 4) * rec.split;
      const tx = v.x - dy * off;
      const ty = v.y + dx * off;
      ctx.quad(ctx.b.bbA, DECOR, tx, v.z, ty, 0.2, 0.2, ctx.R.star, ctx.col('#d8c4f0'), 0.55, -ctx.time * 6);
      ctx.line(ctx.b.bbA, DECOR, tx, v.z, ty, tx - dx * 0.34, v.z, ty - dy * 0.34, 0.07, ctx.col(PLUM), 0.4);
    }
  },

  onImpact(rec, x, y, crit, radius, ctx) {
    // a volley's bolts land on one spot in one moment: the flash, sparks, ripple and stars draw once there
    const first = flashFree(budget(ctx), x, y, ctx.time);
    if (first) {
      flash(ctx, x, 0.4, y, 0.4, ctx.col(SILVER), 0.12);
      sparks(ctx, x, 0.4, y, 3, ctx.col(PLUM), 1.4);
    }
    // Shattered Glass: only a splash bolt (the sim's explode) breaks into shards
    const tw = rec.tw;
    if (!(rec.splash > 0) || !tw) return;
    const lv = shardLevel(tw.look.tiers);
    if (!lv) return;
    const tier = lv + 1;
    const rm = ctx.reduceMotion;
    const b = budget(ctx);
    const n = Math.min(shardCount(tier, ctx.quality), SHARDS_PER_FRAME - b.shards);
    if (n > 0) {
      b.shards += n;
      glassShards(ctx, x, y, n, radius, rm);
    }
    // her shards and flare draw this hit: the generic blast's glow under it goes to half strength
    if (first) ctx.fx?.dimBlast?.(x, y, 0.5);
    if (first && tier >= 3) ripple(ctx, x, y, rm ? radius || 0.5 : 0.1, Math.max(0.3, radius || 0.5), 0.3, ctx.col('#e6dcff'), 0, 'ringSoft', true, 0.55, DECOR);
    if (first && tier >= 4 && ctx.quality !== 'low') {
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * TAU;
        const d = (radius || 0.5) * (0.3 + Math.random() * 0.6);
        const s = ctx.spr(ctx.b.bbA, DECOR, ctx.R.star, x + Math.cos(a) * d, 0.25 + Math.random() * 0.3, y + Math.sin(a) * d, 0.05, 0.24, 0.25, ctx.col('#ffffff'), 1);
        if (s) s.delay = 0.04 + 0.06 * i;
      }
    }
    const k = kaleidoscope(tier, ctx.quality);
    const d = tw.data;
    if (k && b.flares < FLARES_PER_FRAME && d && ctx.time - d.flareT >= FLARE_GAP) {
      b.flares++;
      d.flareT = ctx.time;
      kaleidoFlare(ctx, x, y, radius, k === 2, rm);
    }
  },
};

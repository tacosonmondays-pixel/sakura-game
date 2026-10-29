// Azami (spike strips, src/sim/strips.js). Signature "Checkpoint!": she flicks a folded steel strip off
// her reel; it tumbles end over end on a steel-blue arc and lands with a clack (a skid streak along
// the strip and a row of spikes snapping up). When a strip bites, its spikes jab up through the
// walker: a row of thin bright spikes along the strip and steel sparks.
//   Spike Rain (her ability, Total Lockdown): thistle strips drop out of the sky onto the road.
//   P0 Sharper Strips: T3 armor-crack chips (red crack flash); T4 the strip glows hot along its edge
//                      on every bite, and a strip that runs out goes off in an orange starburst;
//                      T5 that burst is white-gold with a stun flash
//   P2 Long Watch:     T3 a tar splat under the bite (Sticky Tar's slow)
// The strip itself (its model on the road) belongs to the placed-object pass (src/render/actors.js);
// the bite spikes follow the strip as it is drawn: the 3D prop's axis across the road (placedProps.stripAxis)
// when that layer draws strips, else the flat drawing's angle (uid × 0.7 around the vertical: Low, no GLB).
import { lookAt } from '../flair.js';
import { flash, sparks, shardBurst } from '../patterns/bursts.js';
import { decal } from '../patterns/markers.js';
import { spikes, spokes, groundStreak, hash01 } from '../patterns/academy.js';
import { hand } from './util.js';
import { CORE, DECOR } from '../context.js';

const STEEL = '#d3dae4';
const STEEL_EDGE = '#9fc4ff';
const THISTLE = '#c9a7ff';
const HOT = '#ffb347';
const CRACK = '#ff5a5a';
const TAR = '#2b2230';

/**
 * The drawn strip's long axis: the 3D prop's (src/render/placedProps.js stripAxis, across the road) when the
 * placed-props layer draws strips, else the flat ground quad's (actors.js: rotated uid × 0.7).
 */
export function stripDir(ctx, uid, x, y, out) {
  if (ctx.actors?.placedProps?.stripAxis?.(uid, x, y, out)) return out;
  const r = uid * 0.7;
  out.x = Math.cos(r);
  out.y = -Math.sin(r);
  return out;
}
const DIR = { x: 1, y: 0 };

/** Is strip `uid` a Spike Rain strip (the trigger event does not say; read the sim's trap)? */
function isExtra(ctx, uid) {
  const traps = ctx.sim.traps;
  for (let i = 0; i < traps.length; i++) if (traps[i].uid === uid) return !!traps[i].extra;
  return false;
}

/** Lob body: a folded steel bar tumbling end over end along its flight, a bright edge on top. */
function drawBar(o, x, h, y, k, ctx) {
  const dx = o.x1 - o.x0;
  const dy = o.y1 - o.y0;
  const d = Math.hypot(dx, dy) || 1;
  const c = Math.cos(o.rot) * 0.24;
  const s = Math.sin(o.rot) * 0.24;
  const ux = (dx / d) * c;
  const uy = (dy / d) * c;
  ctx.line(ctx.b.bbN, CORE, x - ux, h - s, y - uy, x + ux, h + s, y + uy, 0.1, ctx.col('#5b6270'), 1, ctx.R.white);
  ctx.line(ctx.b.bbA, CORE, x - ux, h - s + 0.02, y - uy, x + ux, h + s + 0.02, y + uy, 0.05, o.c, 1);
  ctx.quad(ctx.b.bbA, DECOR, x + ux, h + s + 0.02, y + uy, 0.12, 0.12, ctx.R.star, o.c, 1, o.rot);
}

/** Lob landing: the clack (a skid along the strip, spikes snapping up, two sparks). */
function landBar(o, ctx) {
  stripDir(ctx, o.a, o.x1, o.y1, DIR);
  groundStreak(ctx, o.x1, o.y1, DIR.x, DIR.y, 0.8, 0.12, o.c, 0.22, 0.85);
  spikes(ctx, o.x1, o.y1, DIR.x, DIR.y, 0.5, ctx.q.trails > 0 ? 3 : 2, 0.2, o.c, 0.18, DECOR, ctx.col('#2f3440'));
  if (ctx.cap('impact')) sparks(ctx, o.x1, 0.12, o.y1, 2, o.c, 1.2);
}

/** A strip that runs out with Charged Strips: an orange starburst (white-gold at T5) and spikes all round. */
function chargedBurst(ctx, x, y, lk) {
  const t5 = lookAt(lk, 0) >= 5;
  const c = ctx.col(t5 ? '#fff1b8' : HOT);
  spokes(ctx, x, y, ctx.q.trails > 0 ? 10 : 6, 0.15, t5 ? 1.25 : 1, c, 0.22, Math.random(), 0.95);
  flash(ctx, x, 0.3, y, t5 ? 1.1 : 0.8, c, 0.14);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.3;
    spikes(ctx, x + Math.sin(a) * 0.35, y + Math.cos(a) * 0.35, Math.cos(a), -Math.sin(a), 0.3, 2, 0.3, c, 0.2, DECOR);
  }
  if (t5) flash(ctx, x, 0.55, y, 0.5, ctx.col('#ffe066'), 0.2);
}

export const azami = {
  id: 'azami',

  onAttack(ev, tw, t, ctx) {
    // the reel flick: a small steel glint at her hand (the strip toss itself is onTrap)
    if (ev.kind !== 'strip' || !ctx.cap('muzzle')) return;
    const h = hand(ctx, t);
    ctx.spr(ctx.b.bbA, CORE, ctx.R.star, h.x, h.h + 0.08, h.y, 0.18, 0.3, 0.12, ctx.col(STEEL_EDGE), 1);
  },

  onTrap(ev, tw, t, ctx) {
    const extra = ev.type === 'trapPlaced' ? !!ev.extra : isExtra(ctx, ev.uid);
    const col = ctx.col(extra ? THISTLE : STEEL_EDGE);
    const lk = tw.look;
    if (ev.type === 'trapPlaced') {
      let o;
      if (extra) {
        // Spike Rain: dropped from the sky a little upwind, staggered so the row patters down
        o = ctx.lobs.throw(ev.x - 0.3, 2.6, ev.y - 0.5, ev.x, 0.08, ev.y, 0.26, 0, 0.3, col, 14, drawBar, landBar, ev.uid);
        if (o) o.delay = hash01(ev.uid) * 0.25;
      } else {
        const h = hand(ctx, t);
        const d = Math.hypot(ev.x - h.x, ev.y - h.y);
        o = ctx.lobs.throw(h.x, h.h + 0.1, h.y, ev.x, 0.08, ev.y, 0.26 + 0.04 * d, 0.4 + 0.1 * d, 0.3, col, 16, drawBar, landBar, ev.uid);
      }
      if (o) o.a = ev.uid;
      return true;
    }
    // trapTriggered: the spikes jab up through the walker
    stripDir(ctx, ev.uid, ev.x, ev.y, DIR);
    const steel = ctx.col(extra ? THISTLE : STEEL);
    const hot = lookAt(lk, 0) >= 4;
    spikes(ctx, ev.x, ev.y, DIR.x, DIR.y, 0.62, ctx.q.trails > 0 ? 5 : 3, 0.5, hot ? ctx.col(HOT) : steel, 0.24, DECOR, ctx.col('#2f3440'));
    groundStreak(ctx, ev.x, ev.y, DIR.x, DIR.y, 0.8, 0.12, steel, 0.16, 0.7, DECOR);
    if (ctx.cap('impact')) {
      sparks(ctx, ev.x, 0.2, ev.y, 3, steel, 1.5);
      flash(ctx, ev.x, 0.15, ev.y, 0.35, col, 0.08, DECOR);
    }
    if (hot) groundStreak(ctx, ev.x, ev.y, DIR.x, DIR.y, 0.78, 0.14, ctx.col(HOT), 0.2, 0.8);
    if (lookAt(lk, 0) >= 3) {
      // Shredder Strips: the armor cracks (a red crack flash and two chips)
      decal(ctx, ctx.R.crack, ev.x, ev.y, 0.3, 0.55, 0.3, ctx.col(CRACK), 0.85, ev.uid, true);
      if (ctx.q.sparks) shardBurst(ctx, ev.x, 0.25, ev.y, 2, ctx.col('#e6e9ef'), 1.4);
    }
    if (lookAt(lk, 2) >= 3) decal(ctx, ctx.R.disc, ev.x + DIR.y * 0.1, ev.y - DIR.x * 0.1, 0.25, 0.5, 0.7, ctx.col(TAR), 0.55, 0, false);
    if (ev.left != null && ev.left <= 0 && t.stats?.strip?.boom > 0) chargedBurst(ctx, ev.x, ev.y, lk);
    return true;
  },

  onOther(ev, tw, t, ctx) {
    if (ev.type === 'trapExpired') {
      if (!ev.evicted && t.stats?.strip?.boom > 0) chargedBurst(ctx, ev.x, ev.y, tw.look);
      return false;
    }
    if (ev.type === 'spikeRain') {
      // she flings the bundle up: a thistle streak from her hand into the sky
      const h = hand(ctx, t);
      ctx.segs.add(h.x, h.h, h.y, h.x - 0.2, h.h + 1.8, h.y - 0.3, 0.12, ctx.col(THISTLE), 0.22, 8 | 1);
      flash(ctx, h.x, h.h + 0.1, h.y, 0.4, ctx.col(THISTLE), 0.12);
      return false;
    }
    return false;
  },
};

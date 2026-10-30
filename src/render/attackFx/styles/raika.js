// Raika (chain lightning; Overcharge T4 → beam). Signature "Drumbeat chain": every chain
// starts with a taiko drum ring at her feet, then the hops light up one after another along
// the sim's chain points (jittered zigzags, forks flickering at each node).
//   P0 Forked: more forks; T5 a thunder column on the first target
//   P1 Overcharge: T4 a zigzag lightning beam (re-jittered every frame) with a scorch dot
//   P2 Storm Rhythm: T3 a double drum beat; T5 a triple
import { lookAt } from '../flair.js';
import { chainBolt, SEG_CORE, SEG_FLICKER, SEG_ZIGZAG } from '../patterns/segments.js';
import { drumBeat } from '../patterns/rings.js';
import { flash, stain } from '../patterns/bursts.js';
import { hand } from './util.js';
import { DECOR, CORE } from '../context.js';

const BOLT = '#ffe45c';
const DRUM = '#ffd60a';

export const raika = {
  id: 'raika',

  onChain(ev, tw, t, ctx) {
    const pts = ev.points;
    if (!pts || pts.length < 2) return false;
    const lk = tw.look;
    const c = ctx.col(BOLT);
    const beats = lookAt(lk, 2) >= 5 ? 3 : lookAt(lk, 2) >= 3 ? 2 : 1;
    if (ctx.cap('sweep')) for (let b = 0; b < beats; b++) drumBeat(ctx, t.x, t.y, ctx.col(DRUM), b * 0.08, 1 - b * 0.1);
    const h = hand(ctx, t);
    chainBolt(ctx, h.x, h.h + 0.1, h.y, pts, c, 0.018, ctx.q.zig, 0.2);
    // forks flickering at the nodes
    if (ctx.q.sparks || lookAt(lk, 0) >= 3) {
      const forks = lookAt(lk, 0) >= 3 ? 2 : 1;
      for (let k = 1; k < pts.length; k++) {
        for (let f = 0; f < forks; f++) {
          const a = ctx.rand() * Math.PI * 2;
          const s = ctx.segs.add(pts[k][0], 0.35, pts[k][1], pts[k][0] + Math.sin(a) * 0.3, 0.2 + ctx.rand() * 0.3, pts[k][1] + Math.cos(a) * 0.3, 0.08, c, 0.12, SEG_FLICKER | SEG_ZIGZAG);
          if (s) {
            s.k = 2;
            s.delay = (k - 1) * 0.018;
            s.cls = DECOR;
          }
        }
      }
    }
    if (lookAt(lk, 0) >= 5) {
      const [x, y] = pts[1];
      const s = ctx.segs.add(x, 3, y, x, 0.1, y, 0.3, ctx.col('#fff8c8'), 0.2, SEG_CORE | SEG_ZIGZAG | SEG_FLICKER);
      if (s) s.k = 4;
      flash(ctx, x, 0.3, y, 1, c, 0.15);
    }
    return true;
  },

  /** Overcharge lance: a jagged beam along the sim's beam line. */
  onBeam(ev, tw, t, ctx) {
    const h = hand(ctx, t);
    const [ex, ey] = ev.to;
    const s = ctx.segs.add(h.x, h.h + 0.1, h.y, ex, 0.35, ey, Math.max(0.2, (ev.width || 0.2) * 1.4), ctx.col(BOLT), 0.18, SEG_CORE | SEG_ZIGZAG | SEG_FLICKER);
    if (s) s.k = ctx.quality === 'low' ? 2 : 6;
    stain(ctx, ex, ey, 0.25, ctx.col('#2a2418'), 0.4, 0.6);
    flash(ctx, ex, 0.35, ey, 0.5, ctx.col(BOLT), 0.12, CORE);
    if (ctx.cap('sweep')) drumBeat(ctx, t.x, t.y, ctx.col(DRUM), 0, 0.8);
    return true;
  },
};

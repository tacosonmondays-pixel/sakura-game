// Noa (pulse holy + sanctuary aura). Signature "Sakura chime": every pulse rings out as two soft
// sakura-pink rings to the sim radius with a chime note rising over her, and a pink petal flicks
// off every enemy the pulse really hit.
//   P0 (sanctuary) T3+: a faint pink ring marks her aura edge while she is selected
//   P1 (blessing) T3+: the note is gold
import { lookAt } from '../flair.js';
import { flash, rise } from '../patterns/bursts.js';
import { rippleSet } from '../patterns/rings.js';
import { auraEdge } from '../patterns/patrol.js';
import { victims, hand, auraRange } from './util.js';
import { CORE, DECOR } from '../context.js';

const PINK = '#ffb7d0';

export const noa = {
  id: 'noa',

  onPulse(ev, tw, t, ctx, i, events) {
    const c = ctx.col(PINK);
    if (ctx.cap('sweep')) rippleSet(ctx, ev.x, ev.y, ev.radius, 2, 0.08, 0.4, c, 'ringSoft', true, 0.75, 0.2);
    const h = hand(ctx, t);
    rise(ctx, ctx.R.note, h.x, h.h + 0.4, h.y, 0.26, ctx.col(lookAt(tw.look, 1) >= 3 ? '#ffe08a' : '#ffffff'), 0.7, 0.9, CORE);
    const v = victims(ctx, events, i, ev.x, ev.y, ev.radius, ev.attackType, t.eff?.maxTargets || 6);
    for (let k = 0; k < v.n; k++) {
      flash(ctx, v.xs[k], 0.4, v.ys[k], 0.32, c, 0.12);
      const p = ctx.spr(ctx.b.bbN, DECOR, ctx.R.petal, v.xs[k], 0.5, v.ys[k], 0.14, 0.1, 0.5, c, 1);
      if (p) {
        p.vy = 0.7;
        p.vrot = 6;
        p.vx = (Math.random() - 0.5) * 0.6;
      }
    }
    return true;
  },

  update(gdt, tw, t, ctx) {
    if (lookAt(tw.look, 0) < 3 || ctx.selectedUid !== t.uid) return;
    const r = auraRange(t);
    if (r > 0) auraEdge(ctx, t, r, ctx.col(PINK), 0.25);
  },
};

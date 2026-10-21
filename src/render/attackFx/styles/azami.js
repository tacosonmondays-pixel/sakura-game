// Azami (spike strips, src/sim/strips.js). Signature "Checkpoint toss": when the sim lays a strip she
// flicks a folded steel strip from her reel; it spins through the air and lands on the strip's spot.
// When a strip bites: a small burst of steel sparks (thistle-purple on Spike Rain strips).
//   P0 Sharper Strips: T3 a red crack flash on the bite (armor cracking); T4+ a heat glow ring
//   P2 Long Watch: T3 a tar puddle decal where the strip bites (Sticky Tar)
import { lookAt } from '../flair.js';
import { flash, sparks, ripple } from '../patterns/bursts.js';
import { decal } from '../patterns/markers.js';
import { hand } from './util.js';

const STEEL = '#d3dae4';
const THISTLE = '#c9a7ff';

export const azami = {
  id: 'azami',

  onAttack() {
    // the strip toss (onTrap) is her attack picture
  },

  onTrap(ev, tw, t, ctx) {
    const col = ctx.col(ev.extra ? THISTLE : STEEL);
    if (ev.type === 'trapPlaced') {
      const h = hand(ctx, t);
      const d = Math.hypot(ev.x - h.x, ev.y - h.y);
      ctx.toss.throw(ctx.R.ofuda, h.x, h.h + 0.1, h.y, ev.x, ev.y, 0.3, 0.45 + 0.1 * d, 0.3, col, 10, ev.uid, 1, ctx.col('#5b6270'));
      return true;
    }
    // trapTriggered: the strip bites
    const lk = tw.look;
    sparks(ctx, ev.x, 0.15, ev.y, 3, col, 1.4);
    flash(ctx, ev.x, 0.12, ev.y, 0.4, col, 0.08);
    if (lookAt(lk, 0) >= 3) flash(ctx, ev.x, 0.18, ev.y, 0.3, ctx.col('#ff6b6b'), 0.07);
    if (lookAt(lk, 0) >= 4) ripple(ctx, ev.x, ev.y, 0.1, 0.5, 0.25, ctx.col('#ffb347'), 0, 'ringSoft', true, 0.6);
    if (lookAt(lk, 2) >= 3) decal(ctx, ctx.R.disc, ev.x, ev.y, 0.3, 0.45, 0.6, ctx.col('#3b2d40'), 0.4, 0, false);
    return true;
  },
};

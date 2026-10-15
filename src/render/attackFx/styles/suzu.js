// Suzu (trap). Signature "Seal toss": when the sim places a trap she tosses a paper seal that
// spins through the air and lands exactly on the trap's spot — the rune appears only when it
// lands. When the sim triggers it: gold and white bell rings, a rising note and a flash.
//   P0 Explosive Mines: T3 firework sparks; T5 a bell shockwave out to the trap's blast radius
//   P1 Binding: T3 rope lines radiating inside the trap radius; T4 a net ring
//   P2 Spirit Seals: T4 four paper seals swirl out of the trigger point
import { lookAt } from '../flair.js';
import { ripple, flash, rise, chrysanthemum } from '../patterns/bursts.js';
import { SEG_NORMAL } from '../patterns/segments.js';
import { hand } from './util.js';
import { CORE, DECOR } from '../context.js';

const GOLD = '#ffd166';

export const suzu = {
  id: 'suzu',

  onAttack(ev, tw, t, ctx) {
    // the seal toss (onTrap) is her attack picture; no extra sparkle
  },

  onTrap(ev, tw, t, ctx) {
    if (ev.type === 'trapPlaced') {
      const h = hand(ctx, t);
      const d = Math.hypot(ev.x - h.x, ev.y - h.y);
      ctx.toss.throw(ctx.R.ofuda, h.x, h.h + 0.1, h.y, ev.x, ev.y, 0.35, 0.6 + 0.12 * d, 0.32, ctx.col('#ffffff'), 12, ev.uid, 1, ctx.col('#ffb347'));
      return true;
    }
    // trapTriggered
    const lk = tw.look;
    const gold = ctx.col(GOLD);
    flash(ctx, ev.x, 0.3, ev.y, 0.9, gold, 0.16);
    ripple(ctx, ev.x, ev.y, 0.1, 0.8, 0.3, gold, 0, 'ring', true, 1);
    ripple(ctx, ev.x, ev.y, 0.1, 0.6, 0.3, ctx.col('#ffffff'), 0.06, 'ringSoft', true, 0.9);
    rise(ctx, ctx.R.note, ev.x, 0.5, ev.y, 0.22, gold, 0.6, 1.2, CORE);
    const tr = t.trapSpec || t.stats?.trap || {};
    const radius = Math.max(tr.splash || 0, tr.triggerRadius || 0.5);
    if (lookAt(lk, 0) >= 3) chrysanthemum(ctx, ev.x, 0.35, ev.y, 6, [gold, ctx.col('#ff6b6b')], 0.13, 1.2 + radius * 0.5);
    if (lookAt(lk, 0) >= 5) ripple(ctx, ev.x, ev.y, 0.2, radius, 0.35, ctx.col('#fff3b0'), 0.04, 'ringThick', true, 0.8);
    const p1 = lookAt(lk, 1);
    if (p1 >= 3) {
      const r = Math.max(0.4, tr.triggerRadius || 0.6);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + 0.4;
        const s = ctx.segs.add(ev.x, 0.15, ev.y, ev.x + Math.sin(a) * r, 0.1, ev.y + Math.cos(a) * r, 0.05, ctx.col('#e9d8a6'), 0.5, SEG_NORMAL);
        if (s) s.cls = DECOR;
      }
      if (p1 >= 4) ripple(ctx, ev.x, ev.y, r, r, 0.5, ctx.col('#e9d8a6'), 0, 'ringDashed', false, 0.8);
    }
    if (lookAt(lk, 2) >= 4) {
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        const p = ctx.spr(ctx.b.bbN, DECOR, ctx.R.ofuda, ev.x + Math.sin(a) * 0.2, 0.4, ev.y + Math.cos(a) * 0.2, 0.22, 0.16, 0.6, ctx.col('#ffffff'), 1);
        if (!p) break;
        p.asp = 0.5;
        p.vx = Math.cos(a) * 1.2;
        p.vz = -Math.sin(a) * 1.2;
        p.vy = 0.5;
        p.drag = 2;
        p.vrot = 5;
      }
    }
    return true;
  },
};

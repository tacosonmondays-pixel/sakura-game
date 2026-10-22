// Wakaba (buff thrower, src/sim/drinks.js). Signature "Water break!": each drink is a sky-blue bottle
// tossed in a high arc that lands on the girl she picked, with a splash ring the size of the drink's
// splash and a few droplets. Towel Snap: a quick white swish at the enemy.
import { ripple, sparks, flash } from '../patterns/bursts.js';
import { hand } from './util.js';

const BLUE = '#59c1e8';
const WATER = '#bff0ff';

export const wakaba = {
  id: 'wakaba',

  onAttack(ev, tw, t, ctx) {
    if (ev.kind === 'drink' && ev.x != null) {
      const h = hand(ctx, t);
      const d = Math.hypot(ev.x - h.x, ev.y - h.y);
      // no trap stands behind a drink: trapUid -1 (a made-up uid could hide a real Suzu / Azami trap
      // that happens to have that uid while the bottle flies)
      ctx.toss.throw(ctx.R.flask || ctx.R.ofuda, h.x, h.h + 0.15, h.y, ev.x, ev.y, 0.32, 0.7 + 0.15 * d, 0.45, ctx.col(BLUE), 8, -1, 1, ctx.col('#ffffff'));
      ripple(ctx, ev.x, ev.y, 0.1, t.stats?.drink?.splash || 0.8, 0.45, ctx.col(WATER), 0.45, 'ringSoft', true, 0.8);
      sparks(ctx, ev.x, 0.6, ev.y, 4, ctx.col(WATER), 1.2);
      return;
    }
    if (ev.kind === 'towel') {
      const h = hand(ctx, t);
      flash(ctx, h.x, h.h + 0.1, h.y, 0.35, ctx.col('#ffffff'), 0.1);
    }
  },
};

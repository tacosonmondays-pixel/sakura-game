// Yuzuha (taser darts + lane sentries, src/sim/sentries.js). Signature "Deploying": her darts fly as
// short electric streaks with a blue spark on impact; her sentries' bullets are the drone bullets the
// shared drone pass draws; a sentry or net that unfolds pops a safety-orange ring on its spot (drawn
// from the sim's 'deploy' events by the generic handler: the sentries themselves are drawn per frame
// in src/render/actors.js).
import { flash, sparks } from '../patterns/bursts.js';
import { hand } from './util.js';

const VOLT = '#7fe0ff';

export const yuzuha = {
  id: 'yuzuha',

  onAttack(ev, tw, t, ctx) {
    if (ev.turretUid != null || !ctx.cap('muzzle')) return;
    const h = hand(ctx, t);
    flash(ctx, h.x, h.h + 0.1, h.y, 0.25, ctx.col(VOLT), 0.08);
  },

  onImpact(rec, x, y, crit, radius, ctx) {
    sparks(ctx, x, 0.35, y, 3, ctx.col(VOLT), 1.5);
  },
};

// Marumi (rolling bomb balls, src/sim/balls.js). Signature "STRIKE!": the balls themselves are drawn per
// frame in src/render/actors.js; a blast is the shared 'explode' burst; a roll pops a little dust puff
// at her hand.
import { sparks } from '../patterns/bursts.js';
import { hand } from './util.js';

const SPARK = '#ffc46b';

export const marumi = {
  id: 'marumi',

  onAttack(ev, tw, t, ctx) {
    if (ev.kind !== 'roll' && ev.kind !== 'lob') return;
    const h = hand(ctx, t);
    sparks(ctx, h.x, h.h, h.y, 3, ctx.col(SPARK), 1);
  },
};

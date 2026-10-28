// Norika (Traffic Safety Officer · STOP waves). STAND-IN until her art and FX land (BANNERS §D.5): the
// generic attack look in her own colour, and a double ring where a wave lands (its splash).
import { genericAttack } from './generic.js';
import { doubleRing } from '../patterns/rings.js';

export const norika = {
  id: 'norika',

  onAttack(ev, tw, t, ctx) {
    genericAttack(ev, tw, t, ctx);
  },

  onImpact(rec, x, y, crit, radius, ctx) {
    doubleRing(ctx, x, y, Math.max(0.4, radius), ctx.col('#ffffff'), ctx.col('#e0453c'));
  },
};

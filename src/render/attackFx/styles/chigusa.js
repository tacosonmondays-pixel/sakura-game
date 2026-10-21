// Chigusa (thorn seeds, vines and thorn beds, src/sim/vines.js). Signature "Everything grows": her seeds
// fly as small green streaks with a leafy puff on impact; her vine grab pops a green ring on the held
// enemy (the sim's 'vine' event, drawn by the shared hold status icon); thorn beds are drawn per frame
// in src/render/actors.js.
import { sparks } from '../patterns/bursts.js';

const LEAF = '#6fcf5e';

export const chigusa = {
  id: 'chigusa',

  onAttack() {},

  onImpact(rec, x, y, crit, radius, ctx) {
    sparks(ctx, x, 0.3, y, 3, ctx.col(LEAF), 1.2);
  },
};

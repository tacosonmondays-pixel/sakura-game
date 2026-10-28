// Tenka (powerhouse · hitscan coil bolts). STAND-IN until her FX milestone (BUILD_PLAN 6.9 T4): the
// generic attack look in her own colour. T4 draws the coil bolts, Critical Mass and the wells.
import { genericAttack } from './generic.js';

export const tenka = {
  id: 'tenka',

  onAttack(ev, tw, t, ctx) {
    genericAttack(ev, tw, t, ctx);
  },
};

// Kogane (Facilities Crew Chief · rivets from Big Yellow's arm gun). STAND-IN until her art and FX land
// (BANNERS §D.5): the generic attack look in her own colour.
import { genericAttack } from './generic.js';

export const kogane = {
  id: 'kogane',

  onAttack(ev, tw, t, ctx) {
    genericAttack(ev, tw, t, ctx);
  },
};

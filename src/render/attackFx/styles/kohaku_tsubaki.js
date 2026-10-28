// Kohaku & Tsubaki (the duo · star shells + prism beam). STAND-IN until the duo's FX pass (DUO_LR §4 "Art"):
// the generic attack look (Tsubaki's muzzle flash on a volley; Kohaku's beam is the renderer's default beam, and
// the shards land as small warning rings and blasts like any shell). The shells, beam, shards and Twin Star get
// their own look in that pass.
import { genericAttack } from './generic.js';

export const kohaku_tsubaki = {
  id: 'kohaku_tsubaki',

  onAttack(ev, tw, t, ctx) {
    genericAttack(ev, tw, t, ctx);
  },
};

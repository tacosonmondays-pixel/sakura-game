// Seiran ★ (hero · chain lightning, prefers flyers). Signature "Sky chain": light-blue lightning from
// the tip of her storm lance hops target to target along the sim's chain points, with a gold spark at
// every node (the styled chain lightning when the VFX library is on, the old zig-zag otherwise). Her Dragonflight sky
// dragon is drawn by src/render/rosterFx.js from sim.runners.
import { chainBolt } from '../patterns/segments.js';
import { flash } from '../patterns/bursts.js';
import { hand, tipUp } from './util.js';
import { DECOR } from '../context.js';

const SKY = '#9fd8ff';
const GOLD = '#ffd77a';

export const seiran = {
  id: 'seiran',

  onChain(ev, tw, t, ctx) {
    const pts = ev.points;
    if (!pts || pts.length < 2) return false;
    const h = hand(ctx, t);
    let styled = false;
    if (ctx.lightning) {
      // the styled bolt (src/render/vfx/lightning.js) in her sky blue, from her lance tip: its own flare at the tip and
      // stars at every node (nothing back, e.g. the library switched off on an error: the old bolt and flash below)
      const pts3 = [[h.x, h.h + tipUp(h, 0.25), h.y]];
      for (let k = 1; k < pts.length; k++) pts3.push([pts[k][0], 0.35, pts[k][1]]);
      styled = !!ctx.lightning.strike(pts3, { color: SKY });
    }
    if (!styled) {
      chainBolt(ctx, h.x, h.h + tipUp(h, 0.25), h.y, pts, ctx.col(SKY), 0.02, ctx.q.zig, 0.2);
      flash(ctx, h.x, h.h + tipUp(h, 0.25), h.y, 0.4, ctx.col(SKY), 0.1);
    }
    // her gold spark at every node (her signature, on both looks)
    for (let k = 1; k < pts.length; k++) {
      const p = ctx.spr(ctx.b.bbA, DECOR, ctx.R.star, pts[k][0], 0.4, pts[k][1], 0.24, 0.1, 0.22, ctx.col(GOLD), 1);
      if (p) {
        p.delay = (k - 1) * 0.02;
        p.vrot = 8;
      }
    }
    return true;
  },
};

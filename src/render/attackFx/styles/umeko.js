// Umeko (pulse soak + aura). Signature "Rain ripples": three thin water rings spread out to her
// pulse radius one after another, a rain streak falls onto each enemy the pulse really hit
// with a splash ring, and paper lanterns float around her aura edge.
//   P0 Lighthouse: 3 lanterns at T3–4, 5 at T5
//   P1 Plum Rain: pink petals drift down inside her aura
//   P2 Undertow Ripples: T3 a swirl on each victim
import { lookAt } from '../flair.js';
import { rippleSet } from '../patterns/rings.js';
import { ripple } from '../patterns/bursts.js';
import { decal } from '../patterns/markers.js';
import { drawRingFamiliars } from '../patterns/patrol.js';
import { victims, every } from './util.js';
import { CORE, DECOR } from '../context.js';

const WATER = '#8fe3ff';
const LANTERN = '#ffb3d1';

export const umeko = {
  id: 'umeko',

  init() {
    return { petalT: 0 };
  },

  onPulse(ev, tw, t, ctx, i, events) {
    const v = victims(ctx, events, i, ev.x, ev.y, ev.radius, ev.attackType, t.eff?.maxTargets || 6);
    const water = ctx.col(WATER);
    if (ctx.cap('sweep')) rippleSet(ctx, ev.x, ev.y, ev.radius, ctx.quality === 'low' ? 1 : 3, 0.07, 0.45, water, 'ring', true, 0.85, 0.12);
    const swirl = lookAt(tw.look, 2) >= 3;
    for (let k = 0; k < v.n; k++) {
      const e = ctx.enemy(v.uids[k]);
      if (!e) continue;
      const h = ctx.enemyH(e);
      const p = ctx.spr(ctx.b.bbA, CORE, ctx.R.rain, e.x, h + 1.1, e.z, 0.5, 0.45, 0.12, water, 1);
      if (p) {
        p.asp = 0.16;
        p.vy = -1.1 / 0.12;
      }
      const r = ripple(ctx, e.x, e.z, 0.05, 0.35, 0.25, water, 0.1, 'ring', true, 0.9);
      if (r) r.cls = CORE;
      if (swirl) decal(ctx, ctx.R.swirl, e.x, e.z, 0.6, 0.3, 0.45, ctx.col('#4cc9f0'), 0.7, ctx.time * 4, true);
    }
    return true;
  },

  update(gdt, tw, t, ctx) {
    const aura = t.stats?.aura?.range || 0;
    if (!aura) return;
    const lk = tw.look;
    const p0 = lookAt(lk, 0);
    if (ctx.q.familiars > 0) {
      const n = Math.min(ctx.q.lanterns, p0 >= 5 ? 5 : p0 >= 3 ? 3 : 2);
      drawRingFamiliars(ctx, t, ctx.R.lantern, n, aura, 0.28, 1.0, 0.24 * ctx.readScale, ctx.col(LANTERN), ctx.selectedUid === t.uid, 0.06);
    }
    if ((lookAt(lk, 1) >= 1 || lk.accent[1] >= 1) && ctx.quality !== 'low') {
      const rate = ctx.quality === 'high' ? 3 : 1.5;
      if (every(tw.data, 'petalT', gdt, 1 / rate)) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * aura;
        const p = ctx.spr(ctx.b.bbN, DECOR, ctx.R.petal, t.x + Math.sin(a) * r, 1.6, t.y + Math.cos(a) * r, 0.12, 0.1, 0.9, ctx.col('#ffc2dd'), 1);
        if (p) {
          p.vy = -1.6;
          p.vx = 0.3;
          p.vrot = 3;
          p.flags = 8;
        }
      }
    }
  },
};

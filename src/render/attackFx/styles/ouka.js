// Ouka (campus hub, src/sim/hubs.js). She never attacks; her "attack" is the council's rules reaching
// the girls in her office. Signature "Approved": every beat a thin gold line runs from her to the
// next girl inside her radius (round the office in turn) and stamps her with a small spinning seal and
// a burst of short gold spokes at her feet.
//   P0 Club Budget: the seal carries a coin glint; T4 Sponsorship: a coin hops off her for every
//                   bounty she pays
//   P1 Assembly:    the beat quickens (T3+) and the stamped girl gets a rising tempo chevron
//   P2 Safety Code: the seal is white (T3+ the line also runs to each council banner; T4+ the
//                   stamped girl sparkles clean)
// Her office ring and the banners themselves belong to the placed-object pass (src/render/actors.js);
// the beat reads the banner spots from the sim (t.banners) and draws only the line and the stamp.
import { lookAt } from '../flair.js';
import { flash, coinHop, sparks } from '../patterns/bursts.js';
import { spokes, statusCue } from '../patterns/academy.js';
import { every } from './util.js';
import { CORE, DECOR } from '../context.js';
import { SPIN_X } from '../quadPool.js';

const GOLD = '#ffd66b';
const ROSE = '#ff9ec4';
const WHITE = '#f6f3ec';

/** The seal colour for her look. */
function sealHex(lk) {
  if (lookAt(lk, 2) >= 3 || lk.accent[2] >= 2) return WHITE;
  if (lookAt(lk, 1) >= 3) return ROSE;
  return GOLD;
}

/** The decree: a gold line from her to (x, y), a spinning seal and spokes at the spot. */
function stamp(ctx, t, x, y, h, lk, coin) {
  const c = ctx.col(sealHex(lk));
  ctx.segs.add(t.x, 0.95, t.y, x, h, y, 0.1, c, 0.45, 8 | 1 | 64);
  const p = ctx.spr(ctx.b.bbA, CORE, ctx.R.star, x, h + 0.08, y, 0.16, 0.42, 0.5, c, 1);
  if (p) {
    p.vrot = ctx.reduceMotion ? 0 : 6;
    p.delay = 0.1;
  }
  spokes(ctx, x, y, 6, 0.12, 0.38, c, 0.22, 0.26, 0.75, DECOR);
  if (coin) {
    const q = ctx.spr(ctx.b.bbN, DECOR, ctx.R.coin, x + 0.12, h + 0.2, y, 0.14, 0.12, 0.45, ctx.col('#ffffff'), 1);
    if (q) {
      q.vy = 0.5;
      q.delay = 0.12;
      q.flags = SPIN_X;
    }
  }
}

export const ouka = {
  id: 'ouka',

  init() {
    return { beatT: 0.4, next: 0, bannerT: 0.8 };
  },

  onAttack() {},

  onCash(ev, tw, t, ctx) {
    // Sponsorship / Golden Charter: a coin hops off her for each bounty
    if (ev.reason !== 'bounty') return;
    if (!ctx.cap('impact')) return;
    coinHop(ctx, t.x, 0.9, t.y);
    flash(ctx, t.x, 0.9, t.y, 0.35, ctx.col(GOLD), 0.1);
  },

  update(gdt, tw, t, ctx) {
    const hub = t.stats?.hub;
    if (!hub || t.disabled > 0 || t.removed) return;
    const d = tw.data;
    const lk = tw.look;
    const beat = lookAt(lk, 1) >= 3 ? 0.8 : 1.25;
    if (every(d, 'beatT', gdt, beat)) {
      // the next girl inside her office, in turn
      const towers = ctx.sim.towers;
      const r2 = hub.radius * hub.radius;
      const n = towers.length;
      for (let k = 0; k < n; k++) {
        const o = towers[(d.next + k) % n];
        if (o.uid === t.uid || o.removed || o.stats?.hub) continue;
        const dx = o.x - t.x;
        const dy = o.y - t.y;
        if (dx * dx + dy * dy > r2) continue;
        d.next = (d.next + k + 1) % n;
        stamp(ctx, t, o.x, o.y, 0.95, lk, lookAt(lk, 0) > 0 || lk.accent[0] >= 1);
        if (lookAt(lk, 1) >= 3 || lk.accent[1] >= 2) {
          const p = statusCue(ctx, ctx.R.chevron || ctx.R.glow, o.x, 1.1, o.y, 0.2, ctx.col(ROSE), 0.5);
          if (p) p.delay = 0.2;
        }
        if (lookAt(lk, 2) >= 4 && ctx.q.sparks) sparks(ctx, o.x, 0.8, o.y, 3, ctx.col(WHITE), 1);
        break;
      }
    }
    // Rally Banner: the line also reaches each banner now and then
    const banners = t.banners;
    if (banners && banners.length && every(d, 'bannerT', gdt, 2.4)) {
      for (let i = 0; i < banners.length; i++) stamp(ctx, t, banners[i].x, banners[i].y, 0.62, lk, false);
    }
  },
};

// Midori (projectile `flask`, the sim's own arc, splash, poison). Signature "Brew lob": a green
// reticle marks where the flask will land; on the real splash a stain spreads to the blast
// radius and fades, with a few droplets.
//   P0 Toxicology: purple-green stain with bigger bubbles; T5 a leaf burst
//   P1 Corrosion: T3 yellow hiss puffs when her shred lands
//   P2 Field Kit: T3 a mist puff as she throws; T5 she juggles three flasks over her head and
//      the throws leave from them
import { lookAt } from '../flair.js';
import { stain, petalSpiral } from '../patterns/bursts.js';
import { reticle } from '../patterns/markers.js';
import { hand } from './util.js';
import { CORE, DECOR, FAMILIAR } from '../context.js';

const GREEN = '#7be08a';

function jugglePos(ctx, t, i, out) {
  const s = ctx.bodyScale(t);
  const a = ctx.time * 5 + (i * Math.PI * 2) / 3;
  const f = ctx.facing(t);
  const lat = Math.cos(a) * 0.22;
  out.x = t.x + Math.cos(f) * lat;
  out.y = t.y - Math.sin(f) * lat;
  out.h = (1.25 + 0.22 * Math.sin(a)) * s;
  return out;
}
const J = { x: 0, y: 0, h: 0 };

export const midori = {
  id: 'midori',

  onAttack(ev, tw, t, ctx) {
    if (lookAt(tw.look, 2) >= 3 && ctx.cap('muzzle')) {
      const h = hand(ctx, t);
      const p = ctx.spr(ctx.b.bbN, DECOR, ctx.R.smoke, h.x, h.h, h.y, 0.2, 0.5, 0.5, ctx.col('#c8f7d0'), 0.6);
      if (p) p.vy = 0.4;
    }
  },

  origin(p, t, idx, n, rec, ctx) {
    if (lookAt(rec.tw.look, 2) >= 5 && ctx.q.familiars > 0) {
      jugglePos(ctx, t, rec.uid % 3, J);
      rec.mx = J.x;
      rec.my = J.y;
      rec.mz = J.h;
      return true;
    }
    const h = hand(ctx, t);
    rec.mx = h.x;
    rec.my = h.y;
    rec.mz = h.h;
    return true;
  },

  view(p, rec, _t, v, ctx) {
    const toxic = lookAt(rec.tw.look, 0) >= 3;
    reticle(ctx, p.tx ?? p.x, p.ty ?? p.y, rec.splash || 0.7, rec.f || 0, ctx.col(toxic ? '#b26bff' : GREEN), 0.85, ctx.col(GREEN));
  },

  onImpact(rec, x, y, crit, radius, ctx) {
    const lk = rec.tw.look;
    const toxic = lookAt(lk, 0) >= 3;
    const r = Math.max(0.35, radius);
    stain(ctx, x, y, r, ctx.col(toxic ? '#7a4cc2' : '#4fbf63'), 0.38, 0.9);
    for (let k = 0; k < 5; k++) {
      const p = ctx.spr(ctx.b.bbA, k < 2 ? CORE : DECOR, toxic ? ctx.R.bubble : ctx.R.drop, x, 0.25, y, toxic ? 0.16 : 0.1, 0.06, 0.45, ctx.col(GREEN), 0.95);
      if (!p) break;
      const a = (k / 5) * Math.PI * 2;
      p.vx = Math.cos(a) * 1;
      p.vz = Math.sin(a) * 1;
      p.vy = 1.5;
      p.g = -7;
    }
    if (lookAt(lk, 0) >= 5) petalSpiral(ctx, ctx.R.leaf, x, y, 8, ctx.col('#9be564'), r, 0.6);
  },

  onStatus(ev, tw, t, ctx) {
    if (ev.status !== 'shred' || lookAt(tw.look, 1) < 3) return;
    const e = ctx.enemy(ev.uid);
    if (!e) return;
    const p = ctx.spr(ctx.b.bbN, CORE, ctx.R.smoke, e.x, ctx.enemyH(e), e.z, 0.15, 0.4, 0.45, ctx.col('#ffe066'), 0.7);
    if (p) p.vy = 0.6;
  },

  update(gdt, tw, t, ctx) {
    if (lookAt(tw.look, 2) < 5 || ctx.q.familiars <= 0) return;
    for (let i = 0; i < 3; i++) {
      jugglePos(ctx, t, i, J);
      ctx.quad(ctx.b.bbN, FAMILIAR, J.x, J.h, J.y, 0.13, 0.17, ctx.R.flask, ctx.col(i === 1 ? '#c9a8ff' : '#9be5a8'), 1, Math.sin(ctx.time * 6 + i) * 0.6);
    }
  },
};

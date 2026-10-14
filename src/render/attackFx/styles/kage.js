// Kage (projectile `shuriken` ×2, pierce, fast). Signature "Shadow step": an afterimage of her
// dashes toward her first target as she throws, and her shuriken leave a dark spiral trail.
//   P0 Storm of Steel: T3 shuriken spin out of a small ring around her; T5 three shadow
//      clones stand beside and behind her while she fights, and the volley leaves from Kage
//      and her clones in turn
//   P1 Shadow Mark: a purple flash when her mark lands; T5 a crescent flash
//   P2 Kunai Craft: T3 kunai instead of shuriken; T4 a chain from her hand to each kunai
import { lookAt } from '../flair.js';
import { afterimage, drawClone } from '../patterns/clones.js';
import { flash } from '../patterns/bursts.js';
import { hand } from './util.js';
import { DECOR } from '../context.js';

const SHADOW = '#5b3fa8';
const CLONE_OFF = [[0.45, 0], [-0.45, 0], [0, -0.45]];

function clonePos(ctx, t, i, out) {
  const f = ctx.facing(t);
  const [side, back] = CLONE_OFF[i];
  out.x = t.x + Math.cos(f) * side + Math.sin(f) * back;
  out.y = t.y - Math.sin(f) * side + Math.cos(f) * back;
  return out;
}
const CP = { x: 0, y: 0 };

export const kage = {
  id: 'kage',

  onAttack(ev, tw, t, ctx) {
    const e = ctx.enemy(ev.targetUid);
    if (e && ctx.q.clones > 0 && ctx.cap('muzzle')) afterimage(ctx, t.x, t.y, e.x, e.z, ctx.col(SHADOW), 0.5, 0.15, 0.6, 0.62 * ctx.bodyScale(t));
  },

  origin(p, t, idx, n, rec, ctx) {
    const lk = rec.tw.look;
    const p0 = lookAt(lk, 0);
    const h = hand(ctx, t);
    rec.mx = h.x;
    rec.my = h.y;
    rec.mz = h.h;
    if (p0 >= 5 && ctx.q.clones > 0 && idx > 0 && ctx.inCombat(rec.tw)) {
      clonePos(ctx, t, (idx - 1) % 3, CP);
      rec.mx = CP.x;
      rec.my = CP.y;
      rec.mz = 0.5;
    } else if (p0 >= 3) {
      const f = ctx.facing(t);
      const a = f + (idx - (n - 1) / 2) * 0.9;
      rec.mx = t.x + Math.sin(a) * 0.3;
      rec.my = t.y + Math.cos(a) * 0.3;
      rec.mz = 0.6;
    }
    return true;
  },

  view(p, rec, _t, v, ctx) {
    const lk = rec.tw.look;
    const p2 = lookAt(lk, 2);
    if (p2 >= 3) {
      v.kind = 'needle';
      v.tint = 0xc0c7d6;
      v.scale = 1.25;
      const owner = p2 >= 4 && rec.idx < 2 ? ctx.sim.getTower(rec.ownerUid) : null;
      if (owner) {
        // kusarigama chain from her hand to the kunai
        const h = hand(ctx, owner);
        ctx.line(ctx.b.bbN, DECOR, h.x, h.h, h.y, v.x, v.z, v.y, 0.035, ctx.col('#8a90a0'), 0.9);
      }
    }
    if (ctx.q.trails >= 2) {
      rec.trailT -= ctx.gdt;
      if (rec.trailT <= 0) {
        rec.trailT = 0.03;
        const s = ctx.spr(ctx.b.bbN, DECOR, ctx.R.soft, v.x, v.z, v.y, 0.12, 0.04, 0.22, ctx.col(SHADOW), 0.55);
        if (s) s.vrot = 6;
      }
    }
  },

  update(gdt, tw, t, ctx) {
    if (lookAt(tw.look, 0) < 5 || ctx.q.clones <= 0 || !ctx.inCombat(tw)) return;
    const n = Math.min(3, ctx.q.clones);
    for (let i = 0; i < n; i++) {
      clonePos(ctx, t, i, CP);
      drawClone(ctx, CP.x, CP.y, ctx.col('#3b2a66'), 0.6, 0.6 * ctx.bodyScale(t), 0.02 * Math.sin(ctx.time * 3 + i));
    }
  },

  onStatus(ev, tw, t, ctx) {
    if (ev.status !== 'mark' || lookAt(tw.look, 1) < 3) return;
    const e = ctx.enemy(ev.uid);
    if (!e) return;
    const h = ctx.enemyH(e);
    flash(ctx, e.x, h, e.z, 0.6, ctx.col('#a77bff'), 0.16);
    if (lookAt(tw.look, 1) >= 5) {
      const p = ctx.spr(ctx.b.bbA, DECOR, ctx.R.slash, e.x, h + 0.1, e.z, 0.5, 0.75, 0.16, ctx.col('#c4b5fd'), 1);
      if (p) p.asp = 2;
    }
  },
};

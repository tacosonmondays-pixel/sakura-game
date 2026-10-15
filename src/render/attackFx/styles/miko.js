// Miko (projectile `spark` + blessing aura; Purification T5 → beam). Signature "Ofuda
// talisman": her shots are paper talismans that flutter as they fly, bending a little to one
// side early on and settling onto the sim's path; on a real hit, paper confetti and a holy
// flash.
//   P0 Blessing: bells patrol the aura edge; T5 a ribbon ring at the edge
//   P1 Purification: T3 bigger talismans + a holy ring on impact; T5 a sun mirror floats
//      behind her and the beam shines from it
//   P2 Sacred Grounds: note motes on the aura edge
import { lookAt } from '../flair.js';
import { confetti, flash, ripple } from '../patterns/bursts.js';
import { SEG_CORE } from '../patterns/segments.js';
import { drawRingFamiliars } from '../patterns/patrol.js';
import { hand } from './util.js';
import { CORE, DECOR, FAMILIAR } from '../context.js';

const HOLY = '#ffe066';
const RED = '#d62839';
const MIR = { x: 0, y: 0, h: 0 };

function mirrorPos(ctx, t, out) {
  const f = ctx.facing(t);
  const s = ctx.bodyScale(t);
  out.x = t.x - Math.sin(f) * 0.25 * s;
  out.y = t.y - Math.cos(f) * 0.25 * s;
  out.h = 1.25 * s + 0.04 * Math.sin(ctx.time * 1.7);
  return out;
}

export const miko = {
  id: 'miko',

  onAttack(ev, tw, t, ctx) {
    if (ev.kind === 'beam' || !ctx.cap('muzzle')) return;
    const h = hand(ctx, t);
    ctx.spr(ctx.b.bbA, CORE, ctx.R.glow, h.x, h.h + 0.1, h.y, 0.28, 0.1, 0.1, ctx.col('#fff6d0'), 1);
  },

  origin(p, t, idx, n, rec, ctx) {
    const h = hand(ctx, t);
    rec.mx = h.x;
    rec.my = h.y;
    rec.mz = h.h + 0.1;
    rec.bend = 0.25;
    return true;
  },

  view(p, rec, _t, v, ctx) {
    v.skip = true;
    const big = lookAt(rec.tw.look, 1) >= 3;
    const s = (big ? 0.34 : 0.26) * ctx.readScale;
    const fl = Math.sin(ctx.time * 12 + rec.uid) * 0.45;
    const ang = ctx.screenAngle(v.x, v.z, v.y, p.vx, 0, p.vy) - Math.PI / 2 + fl;
    ctx.quad(ctx.b.bbN, CORE, v.x, v.z, v.y, s * 0.5, s, ctx.R.ofuda, ctx.col('#ffffff'), 1, ang);
    ctx.quad(ctx.b.bbA, DECOR, v.x, v.z, v.y, s * 1.6, s * 1.6, ctx.R.glow, ctx.col(HOLY), 0.35);
    ctx.quadRGB(ctx.b.groundN, CORE, v.x, 0.065, v.y, 0.14, 0.14, ctx.R.shadow, 0.05, 0.05, 0.1, 0.22);
    if (ctx.q.trails >= 2) {
      rec.trailT -= ctx.gdt;
      if (rec.trailT <= 0) {
        rec.trailT = 0.05;
        const sp = ctx.spr(ctx.b.bbA, DECOR, ctx.R.star, v.x, v.z, v.y, 0.1, 0.02, 0.3, ctx.col('#fff3b0'), 0.9);
        if (sp) sp.vy = -0.3;
      }
    }
  },

  onImpact(rec, x, y, crit, radius, ctx) {
    const e = rec.targetUid != null ? ctx.enemy(rec.targetUid) : null;
    const h = e ? ctx.enemyH(e) : 0.45;
    confetti(ctx, x, h, y, 4, [ctx.col('#fff8e8'), ctx.col(RED), ctx.col('#fff8e8')]);
    flash(ctx, x, h, y, 0.5, ctx.col(HOLY), 0.12);
    if (lookAt(rec.tw.look, 1) >= 3) ripple(ctx, x, y, 0.1, 0.55, 0.3, ctx.col(HOLY), 0, 'ring', true, 0.9);
  },

  /** Amaterasu's mirror: the holy beam shines from the mirror over her shoulder. */
  onBeam(ev, tw, t, ctx) {
    mirrorPos(ctx, t, MIR);
    const [ex, ey] = ev.to;
    ctx.segs.add(MIR.x, MIR.h, MIR.y, ex, 0.35, ey, Math.max(0.2, (ev.width || 0.2) * 1.6), ctx.col(HOLY), 0.2, SEG_CORE);
    flash(ctx, MIR.x, MIR.h, MIR.y, 0.6, ctx.col('#fff6d0'), 0.12);
    const p = ctx.spr(ctx.b.bbA, DECOR, ctx.R.star, MIR.x, MIR.h, MIR.y, 0.4, 0.1, 0.2, ctx.col('#ffffff'), 1);
    if (p) p.vrot = 6;
    return true;
  },

  update(gdt, tw, t, ctx) {
    const lk = tw.look;
    const aura = t.stats?.aura?.range || 0;
    const sel = ctx.selectedUid === t.uid;
    const p0 = lookAt(lk, 0);
    if (aura > 0 && ctx.q.familiars > 0) {
      if (p0 >= 3) drawRingFamiliars(ctx, t, ctx.R.bell, Math.min(ctx.q.lanterns, p0 >= 5 ? 4 : p0 - 1), aura, 0.35, 0.95, 0.2 * ctx.readScale, ctx.col('#ffe9a8'), sel);
      if (p0 >= 5) ctx.quad(ctx.b.groundA, FAMILIAR, t.x, 0.075, t.y, aura * 2, aura * 2, ctx.R.ring, ctx.col('#ff8fa3'), sel ? 0.5 : 0.3, ctx.time * 0.3);
      const p2 = lookAt(lk, 2);
      if (p2 >= 3) drawRingFamiliars(ctx, t, ctx.R.note, Math.min(ctx.q.familiars, 3), aura, -0.5, 0.7, 0.18 * ctx.readScale, ctx.col('#fff3b0'), sel, 0.08);
    }
    if (lookAt(lk, 1) >= 5) {
      mirrorPos(ctx, t, MIR);
      ctx.quad(ctx.b.bbN, CORE, MIR.x, MIR.h, MIR.y, 0.34, 0.34, ctx.R.mirror, ctx.col('#fff3c4'), 1);
      if (Math.sin(ctx.time * 2.3) > 0.85) ctx.quad(ctx.b.bbA, DECOR, MIR.x + 0.06, MIR.h + 0.06, MIR.y, 0.22, 0.22, ctx.R.star, ctx.col('#ffffff'), 1, ctx.time);
    }
  },
};

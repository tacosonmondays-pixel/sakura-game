// Hikari ★ (hero · pulse cleave; Lightbringer T4 → projectile lances).
// Signature "Dawn Arc": light rays sweep across the angular span of the enemies her cleave
// really hit (never past her radius), a crescent at 0.65·r, a soft ground fan and a gold
// star landing on each victim.
//   P0 Radiant Edge  more rays; T5 a second, wider arc + sun flare
//   P1 Sanctuary     T3+ light motes patrol the aura edge; T4+ a banner behind her
//   P2 Lightbringer  T4 light lances fanned above her head, blended onto the sim path;
//                    T5 additive lance trails + a chorus ring
import { lookAt } from '../flair.js';
import { spanOf, raySweep, fanDecal, crescentSweep } from '../patterns/sweep.js';
import { flash, ripple, sparks } from '../patterns/bursts.js';
import { drawRingFamiliars } from '../patterns/patrol.js';
import { victims } from './util.js';
import { CORE, DECOR, FAMILIAR } from '../context.js';

const SPAN = { a0: 0, a1: 0, r: 1, n: 0 };
const GOLD = '#ffe08a';
const FAN = '#fff2c0';
const PALE = '#fff4c8';

export const hikari = {
  id: 'hikari',

  onPulse(ev, tw, t, ctx, i, events) {
    const v = victims(ctx, events, i, ev.x, ev.y, ev.radius, ev.attackType, t.eff?.maxTargets || 3);
    spanOf(ev.x, ev.y, v.xs, v.ys, v.n, SPAN, 0.35, 1.75, ctx.facing(t));
    const r = ev.radius;
    const p0 = lookAt(tw.look, 0);
    const I = tw.intensity;
    const gold = ctx.col(GOLD);
    if (ctx.cap('sweep')) {
      let rays = 5 + tw.look.accent[0] + (p0 >= 3 ? p0 - 2 : 0);
      if (ctx.quality === 'low') rays = 3;
      raySweep(ctx, ev.x, ev.y, SPAN.a0, SPAN.a1, r, Math.min(9, rays), 0.12, gold, 0.26 * (1 + 0.12 * p0) * Math.min(1.3, I), 0.22, 0.75);
      crescentSweep(ctx, ev.x, ev.y, SPAN.a0, SPAN.a1, r * 0.65, 0.12, ctx.col(PALE), 0.75 * Math.min(1.3, I), ctx.quality === 'low' ? 2 : 4, 0.45);
      fanDecal(ctx, ev.x, ev.y, SPAN.a0, SPAN.a1, r, ctx.col(FAN), 0.26, 0.14);
      if (p0 >= 5) {
        const pad = 0.5;
        raySweep(ctx, ev.x, ev.y, SPAN.a0 - pad, SPAN.a1 + pad, r, 7, 0.14, ctx.col('#fff0a0'), 0.22, 0.2, 0.6);
        flash(ctx, t.x, 1.1, t.y, 1.3, ctx.col('#fff3b0'), 0.18);
      }
    }
    // a gold star lands on every enemy the cleave hit
    for (let k = 0; k < v.n; k++) {
      const e = ctx.enemy(v.uids[k]);
      const x = e ? e.x : v.xs[k];
      const y = e ? e.z : v.ys[k];
      const h = e ? ctx.enemyH(e) : 0.4;
      const p = ctx.spr(ctx.b.bbA, CORE, ctx.R.star, x, h + 0.45, y, 0.26, 0.14, 0.14, gold, 1);
      if (p) {
        p.vy = -3.2;
        p.vrot = 8;
      }
      if (ctx.q.sparks) sparks(ctx, x, h, y, 2, gold, 1.2);
    }
    return true;
  },

  onAttack(ev, tw, t, ctx) {
    if (ev.kind === 'pulse') return;
    // light lances: halo flash over her head as they appear
    if (ctx.cap('muzzle')) flash(ctx, t.x, 1.45, t.y, 0.7, ctx.col(PALE), 0.12);
    if (lookAt(tw.look, 2) >= 5) ripple(ctx, t.x, t.y, 0.2, 0.9, 0.3, ctx.col(GOLD), 0, 'ring', true, 0.7);
  },

  /** Lances form a fan above her head, then blend onto the sim path. */
  origin(p, t, idx, n, rec, ctx) {
    if (t.eff?.behavior !== 'projectile') return false;
    const f = ctx.facing(t);
    const lat = (idx - (n - 1) / 2) * 0.28;
    rec.mx = t.x + Math.cos(f) * lat;
    rec.my = t.y - Math.sin(f) * lat;
    rec.mz = 1.25 + 0.1 * Math.abs(lat);
    return true;
  },

  view(p, rec, _t, v, ctx) {
    if (!rec.tw || rec.tw.behavior !== 'projectile') return;
    v.kind = 'bolt';
    v.tint = 0xffe8a0;
    v.sz = 1.6;
    v.glow = 0.5;
    if (lookAt(rec.tw.look, 2) >= 5 && ctx.q.trails >= 1) {
      const vl = Math.hypot(p.vx, p.vy) || 1;
      ctx.line(ctx.b.bbA, DECOR, v.x, v.z, v.y, v.x - (p.vx / vl) * 0.6, v.z, v.y - (p.vy / vl) * 0.6, 0.12, ctx.col(GOLD), 0.6);
    }
  },

  update(gdt, tw, t, ctx) {
    const p1 = lookAt(tw.look, 1);
    const aura = t.stats?.aura?.range || 0;
    const sel = ctx.selectedUid === t.uid;
    if (p1 >= 3 && aura > 0 && ctx.q.familiars > 0) {
      const n = Math.min(ctx.q.lanterns, p1 >= 5 ? 5 : p1 >= 4 ? 4 : 3);
      drawRingFamiliars(ctx, t, ctx.R.star, n, aura, 0.35, 0.9, 0.2 * ctx.readScale, ctx.col(PALE), sel);
    }
    if (p1 >= 4 && ctx.q.familiars > 0) {
      const f = ctx.facing(t);
      const s = ctx.bodyScale(t);
      ctx.quad(ctx.b.bbN, FAMILIAR, t.x - Math.sin(f) * 0.28 * s, 1.15 * s, t.y - Math.cos(f) * 0.28 * s, 0.32, 0.4, ctx.R.banner, ctx.col('#fff6dc'), 0.95, Math.sin(ctx.time * 2) * 0.05);
    }
  },
};

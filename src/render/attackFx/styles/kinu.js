// Kinu (360° ring, src/sim/rings.js). Signature "Pin burst": every ring flashes a little starburst at
// her feet and each pin flies as a thin silver needle with a red thread tail; blades (her Thread
// Cutter tier and Blade Spiral) as short bright slashes; Molten Hem's sparks as embers. The heat ring
// itself and her scissors are drawn from the sim each frame (src/render/actors.js reads t.rings).
//   P0 Hot Iron: T1+ pins glow orange; T3 the heat ring's attack shows a hot ripple at her feet
//   P1 Spinning Bobbin: T3+ pins are blades
import { lookAt } from '../flair.js';
import { flash, ripple, sparks } from '../patterns/bursts.js';
import { CORE, DECOR } from '../context.js';

const SILVER = '#e6eaf2';
const THREAD = '#e8475f';
const EMBER = '#ffb347';

export const kinu = {
  id: 'kinu',

  onAttack(ev, tw, t, ctx) {
    const lk = tw.look;
    if (ev.kind === 'heatRing') {
      ripple(ctx, t.x, t.y, 0.2, t.eff?.range || 1.8, 0.35, ctx.col(EMBER), 0, 'ringThick', true, 0.8);
      return;
    }
    if (!ctx.cap('muzzle')) return;
    flash(ctx, t.x, 0.35, t.y, 0.5, ctx.col(lookAt(lk, 0) >= 1 ? EMBER : SILVER), 0.1);
  },

  view(p, rec, _t, v, ctx) {
    v.skip = true;
    const vl = Math.hypot(p.vx, p.vy) || 1;
    const ux = p.vx / vl;
    const uy = p.vy / vl;
    const blade = p.kind === 'blade';
    const spark = p.kind === 'spark';
    const lk = rec.tw.look;
    const head = ctx.col(spark ? EMBER : lookAt(lk, 0) >= 1 && !blade ? EMBER : SILVER);
    const len = blade ? 0.32 : spark ? 0.14 : 0.24;
    ctx.line(ctx.b.bbA, CORE, v.x, v.z, v.y, v.x - ux * len, v.z, v.y - uy * len, blade ? 0.07 : 0.035, head, 0.95);
    if (!blade && !spark) ctx.line(ctx.b.bbA, DECOR, v.x - ux * len, v.z, v.y - uy * len, v.x - ux * (len + 0.14), v.z, v.y - uy * (len + 0.14), 0.025, ctx.col(THREAD), 0.7);
  },

  onImpact(rec, x, y, crit, radius, ctx) {
    sparks(ctx, x, 0.3, y, 2, ctx.col(rec.kind === 'spark' ? EMBER : SILVER), 1.1);
  },
};

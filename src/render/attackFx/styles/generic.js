// Generic style: today's look, unchanged (unknown / future girls, and the fallback for every
// behaviour). Pulse / beam / chain / trap events keep the renderer's default effects.
import { fxColor } from '../../themes.js';

/** The girl's attack colour (element first, then attack type), like the renderer's default. */
export function towerHex(t) {
  const s = t?.eff || t?.stats || t?.def?.base || {};
  return fxColor(s.element ?? t?.def?.element, s.attackType ?? t?.def?.attackType, '#ffffff');
}

/** Default attack visuals: duel slash, trap / build sparkle, muzzle flash toward her facing. */
export function genericAttack(ev, tw, t, ctx) {
  const v = ctx.tower(ev.towerUid);
  if (!v) return;
  const m = v.model.position;
  const fx = ctx.fx;
  if (ev.kind === 'slash') {
    const e = ctx.enemy(ev.targetUid);
    if (e) {
      const ramp = ev.ramp || 0;
      const col = towerHex(t);
      fx.slash(e.x, e.z, (Math.random() - 0.5) * 1.4, col, 0.8 + Math.min(0.6, ramp * 0.05));
      if (ramp >= 6) fx.flash(e.x, e.y + 0.4, e.z, col, 0.5, 0.12);
    }
  } else if (ev.kind === 'trap' || ev.kind === 'build') {
    fx.sparkle(m.x, m.z, '#ffd84d', { count: 5, height: 0.6, ring: false });
  } else if (ev.kind !== 'pulse' && ev.kind !== 'beam' && ev.kind !== 'chain') {
    if (!ctx.cap('muzzle')) return;
    const f = v.facing;
    fx.flash(m.x + Math.sin(f) * 0.3, m.y + 0.5, m.z + Math.cos(f) * 0.3, towerHex(t), 0.35, 0.09);
  }
}

export const generic = {
  id: 'generic',
  onAttack(ev, tw, t, ctx) {
    genericAttack(ev, tw, t, ctx);
  },
};

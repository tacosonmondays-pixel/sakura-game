// Azami (spike strips, src/sim/strips.js). Signature "Checkpoint" (FX-1): her strips are real modelled
// strips (src/render/placed/strips.js: she skims the rolled strip from her hand, it unrolls, the spikes
// pop up row by row, the plate under a walker jabs on each bite, rows sink as hits run out, a spent
// strip rolls up). This style adds the bite's flash and her path looks:
//   P0 Sharper Strips: T3 a white-pink crack flash with a thin red rim (armor cracking); T4+ a heat ring
//   P2 Long Watch: T3 a tar splash where the strip bites (Sticky Tar)
// Flashes stay white-pink (red only in rims). Her kill: steel shards and thistle petals.
import { lookAt } from '../flair.js';
import { flash, ripple, shardBurst, rise } from '../patterns/bursts.js';
import { decal } from '../patterns/markers.js';
import { DECOR } from '../context.js';
import { impactFx } from '../impacts.js';
import { hand } from './util.js';

const STEEL = '#d3dae4';
const THISTLE = '#c9a7ff';
const FLASH = '#ffe6f2';

export const azami = {
  id: 'azami',

  onAttack() {
    // the strip toss (src/render/placed/strips.js) is her attack picture
  },

  onTrap(ev, tw, t, ctx) {
    // trapPlaced: the placed layer skims the rolled strip from her hand (her own throw prop)
    if (ev.type === 'trapPlaced') return true;
    // trapTriggered: the strip bites (the placed layer jabs the plate and throws puncture sparks); her
    // impact preset is the steel shard and a white-pink flash
    const lk = tw.look;
    flash(ctx, ev.x, 0.14, ev.y, 0.36, ctx.col(ev.extra ? THISTLE : FLASH), 0.08);
    impactFx(ctx, 'azami', lookAt(lk, 0) >= 3 ? 'strong' : 'weak', ev.x, 0.16, ev.y);
    if (lookAt(lk, 0) >= 3) {
      flash(ctx, ev.x, 0.18, ev.y, 0.3, ctx.col(FLASH), 0.07);
      ripple(ctx, ev.x, ev.y, 0.08, 0.32, 0.18, ctx.col('#ff6b6b'), 0, 'ring', false, 0.7);
    }
    if (lookAt(lk, 0) >= 4) ripple(ctx, ev.x, ev.y, 0.1, 0.5, 0.25, ctx.col('#ffb347'), 0, 'ringSoft', true, 0.6);
    if (lookAt(lk, 2) >= 3) decal(ctx, ctx.R.disc, ev.x, ev.y, 0.3, 0.45, 0.6, ctx.col('#3b2d40'), 0.4, 0, false);
    return true;
  },

  onOther(ev, tw, t, ctx) {
    // Spike Rain (the ability, or Total Lockdown's automatic one): a thistle signal over her
    if (ev.type === 'spikeRain') {
      const h = hand(ctx, t);
      rise(ctx, ctx.R.star, h.x, h.h + 0.25, h.y, 0.26, ctx.col(THISTLE), 0.6, 1.1, DECOR);
      return true;
    }
    return false;
  },

  /** Her kill: steel shards and thistle petals. */
  onKill(ev, tw, t, ctx, x, h, y) {
    shardBurst(ctx, x, h, y, 4, ctx.col(STEEL), 1.6);
    const k = ctx.n(3);
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2 + 0.4;
      const p = ctx.spr(ctx.b.bbN, DECOR, ctx.R.petal, x, h, y, 0.13, 0.1, 0.6, ctx.col(THISTLE), 1);
      if (!p) break;
      p.vx = Math.cos(a) * 0.8;
      p.vz = Math.sin(a) * 0.8;
      p.vy = 0.9;
      p.g = -2.5;
      p.drag = 1.6;
      p.vrot = 6;
    }
    return true;
  },
};

// Marumi (rolling bomb balls, src/sim/balls.js). Signature "STRIKE!" (FX-1):
//   - she bowls underhand: a procedural pose on her idle (attackFx/poses.js) in place of her built
//     overhand throw; it starts early from her own countdown so the release lands on the sim's roll,
//     and the ball leaves her hand low (the hand-off hop, src/render/placed/balls.js);
//   - the ball itself, its fuse cap, the Spin Shot arcs, the pins and the STRIKE! sticker are the
//     placed layer's (src/render/placed/balls.js); a roll puffs dust at her feet;
//   - her lob for flyers is her own ball on an underhand high arc (the sim's shell, drawn as the ball);
//   - every blast of a ball ('ballPop') adds a small impact pop: a warm core flash, a quick hard ring
//     and a few sparks thrown toward the walker the ball bounces on to; the Glow Bowl finale adds a
//     firework of pin-white and orange stars and a double ring (and the renderer's one camera jolt);
//   - a kill of hers: a pin knocked over and petals in her colours (instead of the shared white puff).
// Rings are alpha-blended (cel), only the flash and sparks are additive.
import { sparks, flash, ripple, chrysanthemum } from '../patterns/bursts.js';
import { DECOR, MOTE } from '../context.js';
import { BoneOverlay } from '../../boneOverlay.js';
import { BOWL_T, RELEASE, bowlPose, fitScale, applyBowl } from '../poses.js';

const SPARK = '#ffc46b';
const PIN = '#f6efe0';
const ORANGE = '#f28a3c';
const DUST = '#d9c9ae';

/** A few sparks flung from (x, y) toward (tx, ty): the way the ball goes next. */
function toward(ctx, x, y, tx, ty, c) {
  const dx = tx - x;
  const dy = ty - y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-6) return;
  const k = ctx.n(4);
  for (let i = 0; i < k; i++) {
    const s = 2.4 + i * 0.5;
    const p = ctx.spr(ctx.b.bbA, DECOR, ctx.R.glow, x, 0.22, y, 0.1, 0.03, 0.22, c, 1);
    if (!p) continue;
    p.vx = (dx / d) * s + (i - 1.5) * 0.25 * (-dy / d);
    p.vz = (dy / d) * s + (i - 1.5) * 0.25 * (dx / d);
    p.vy = 0.5;
    p.g = -4;
    p.drag = 3;
  }
}

/** Her release point: low, a little forward and to her right. */
function release(ctx, t, out) {
  const f = ctx.facing(t);
  const s = ctx.bodyScale(t);
  out.x = t.x + Math.sin(f) * 0.24 * s - Math.cos(f) * 0.1 * s;
  out.y = t.y + Math.cos(f) * 0.24 * s + Math.sin(f) * 0.1 * s;
  out.h = 0.18 * s;
  return out;
}
const REL = { x: 0, y: 0, h: 0 };

export const marumi = {
  id: 'marumi',

  init() {
    return { ov: null, model: null, u: -1, lob: false, k: 1, dy: 0 };
  },

  /** Her rolls and lobs are posed here (underhand), not by her built overhand clip. */
  ownClip(ev) {
    return ev.kind === 'roll' || ev.kind === 'lob';
  },

  /** A roll or lob happened: keep a pose that is already at its release, else snap one in there. */
  onShotPose(ev, tw) {
    const d = tw.data;
    if (!d) return;
    d.lob = ev.kind === 'lob';
    if (d.u >= 0 && Math.abs(d.u - RELEASE) < 0.12) return;
    d.u = RELEASE - 0.05;
  },

  posePre(tw, model) {
    const d = tw.data;
    if (!d || d.model !== model) return;
    d.ov?.restore();
    if (d.dy) {
      model.position.y -= d.dy;
      d.dy = 0;
    }
  },

  pose(tw, t, model, dt, ctx) {
    const d = tw.data;
    if (!d) return;
    if (d.model !== model) {
      d.model = model;
      d.ov = new BoneOverlay(model);
      d.u = -1;
    }
    const interval = 1 / Math.max(0.05, t.eff?.rate || 0.8);
    const ts = Math.max(0.25, ctx.timeScale || 1);
    d.k = fitScale(interval, ts);
    const dur = BOWL_T / d.k; // real seconds of this bowl
    // pre-roll: while she is rolling, the wind-up starts from her own countdown (read only), so the
    // release lands on the sim's roll; the first roll after a quiet spell snaps in (onShotPose)
    if (d.u < 0 && ctx.inCombat(tw) && t.cooldown > 0) {
      const left = t.cooldown / ts; // real seconds to her next shot
      if (left <= RELEASE * dur) d.u = RELEASE - left / dur;
    }
    if (d.u < 0) return;
    d.u += dt / dur;
    if (d.u >= 1) {
      d.u = -1;
      return;
    }
    const p = bowlPose(d.u, d.lob);
    applyBowl(d.ov, p);
    if (p.hips) {
      d.dy = p.hips * (model.scale.y || 1);
      model.position.y += d.dy;
    }
  },

  onAttack(ev, tw, t, ctx) {
    if (ev.kind === 'roll') {
      // a puff of dust where the ball meets the ground at her feet
      const r = release(ctx, t, REL);
      const k = ctx.n(2);
      for (let i = 0; i < k; i++) {
        const p = ctx.spr(ctx.b.bbN, MOTE, ctx.R.smoke, r.x + (i - 0.5) * 0.12, 0.1, r.y, 0.12, 0.3, 0.4, ctx.col(DUST), 0.55);
        if (p) {
          p.vy = 0.25;
          p.vx = (i - 0.5) * 0.4;
          p.drag = 2;
        }
      }
    } else if (ev.kind === 'lob') {
      const r = release(ctx, t, REL);
      sparks(ctx, r.x, r.h + 0.1, r.y, 2, ctx.col(SPARK), 1);
    }
  },

  // her lob (the sim's shell, an arcing projectile): leaves her hand low, on a high underhand arc
  origin(p, t, idx, n, rec, ctx) {
    if (p.kind !== 'shell') return false;
    const r = release(ctx, t, REL);
    rec.mx = r.x;
    rec.my = r.y;
    rec.mz = r.h;
    rec.bump = 0.55;
    return true;
  },

  view(p, rec, _t, v, ctx) {
    if (p.kind !== 'shell') return;
    // her own ball, spinning, with a ground shadow (not the cannonball)
    v.skip = true;
    ctx.placed.balls.lob(p.uid, v.x, v.z, v.y, p.vx, p.vy);
  },

  onOther(ev, tw, t, ctx) {
    if (ev.type !== 'ballPop') return false;
    if (ev.fin) {
      chrysanthemum(ctx, ev.x, 0.35, ev.y, 10, [ctx.col(PIN), ctx.col(ORANGE), ctx.col(SPARK)], 0.18, 2.8);
      ripple(ctx, ev.x, ev.y, 0.2, 1.4, 0.4, ctx.col(ORANGE), 0, 'ringThick', false, 0.9);
      ripple(ctx, ev.x, ev.y, 0.1, 0.9, 0.35, ctx.col(PIN), 0.06, 'ring', false, 0.95);
      return false;
    }
    flash(ctx, ev.x, 0.25, ev.y, 0.55, ctx.col(SPARK), 0.1);
    ripple(ctx, ev.x, ev.y, 0.1, 0.55, 0.22, ctx.col(PIN), 0, 'ring', false, 0.95);
    if (ev.tx != null) toward(ctx, ev.x, ev.y, ev.tx, ev.ty, ctx.col(SPARK));
    return false;
  },

  /** Her kill: a knocked-over pin and petals in her colours. */
  onKill(ev, tw, t, ctx, x, h, y) {
    ctx.placed.balls.knockPin(x, y);
    return true;
  },
};

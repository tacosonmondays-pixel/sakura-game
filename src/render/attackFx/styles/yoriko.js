// Yoriko ★ (hero · twin thread needles, slow). Signature "Marionette": her doll (src/render/marionette.js) hangs
// on strings from her control bar and strikes on each attack; the needles are small silver-lilac pins the doll
// flings (they leave the doll where it is drawn, never her feet, and draw no line back to anyone), and the sim's
// hit gets a short lilac slash (a thin white edge, in front of the enemy), apart from the strings. Without the doll's figure (files loading, an
// error) the needles leave her hand. Her Dream Detour ultimate keeps the renderer's tide look.
import { ripple } from '../patterns/bursts.js';
import { hand } from './util.js';
import { CORE, DECOR } from '../context.js';

const LILAC = '#c6b8f1';
const PIN = '#f1ecff';
const SLASH = '#b89cf6';
const EDGE = '#ffffff';
/** How far in front of the enemy the slash is drawn (tiles toward the camera). */
const SLASH_FRONT = 0.3;
/** At most one slash per enemy in this many game seconds (a fast Yoriko would keep it white). */
const SLASH_EVERY = 0.15;
/** The needle's length (tiles) along its flight. */
const NEEDLE = 0.2;

export const yoriko = {
  id: 'yoriko',

  onAttack(ev, tw, t, ctx) {
    if (!ctx.cap('muzzle')) return;
    // a small glint where the needles leave: the doll's hands (or her hand without the doll)
    const d = ctx.actors?.companions?.dollAt?.(t.uid);
    if (d) ctx.spr(ctx.b.bbA, CORE, ctx.R.glow, d.x, d.h, d.z, 0.16, 0.24, 0.08, ctx.col(PIN), 0.9);
    else {
      const h = hand(ctx, t);
      ctx.spr(ctx.b.bbA, CORE, ctx.R.glow, h.x, h.h, h.y, 0.2, 0.28, 0.08, ctx.col(LILAC), 0.9);
    }
  },

  origin(p, t, idx, n, rec, ctx) {
    const d = ctx.actors?.companions?.dollAt?.(t.uid);
    if (d) {
      rec.mx = d.x;
      rec.my = d.z;
      rec.mz = d.h;
      return true;
    }
    const h = hand(ctx, t);
    rec.mx = h.x;
    rec.my = h.y;
    rec.mz = h.h + 0.2;
    return true;
  },

  // a needle: a thin bright pin along its flight with a tiny glint at the point (no thread back to the doll)
  view(p, rec, _t, v, ctx) {
    const vl = Math.hypot(p.vx || 0, p.vy || 0) || 1;
    const ux = (p.vx || 0) / vl;
    const uy = (p.vy || 0) / vl;
    ctx.line(ctx.b.bbA, CORE, v.x, v.z, v.y, v.x - ux * NEEDLE, v.z, v.y - uy * NEEDLE, 0.035, ctx.col(PIN), 0.95);
    ctx.quad(ctx.b.bbA, DECOR, v.x, v.z, v.y, 0.09, 0.09, ctx.R.glow, ctx.col(LILAC), 0.7);
  },

  // the sim's hit: a short lilac slash with a thin white edge, a little in front of the enemy (toward the camera,
  // so its own white hit flash never swallows it), at most one per SLASH_EVERY on the same enemy, and a faint ring
  onImpact(rec, x, y, crit, radius, ctx) {
    if (!slashFree(rec.tw, rec.targetUid, ctx.time)) return;
    towardCamera(ctx, _cam);
    const sx = x + _cam.x * SLASH_FRONT;
    const sy = y + _cam.z * SLASH_FRONT;
    const s = crit ? 0.48 : 0.4;
    const a = ctx.spr(ctx.b.bbA, CORE, ctx.R.slash, sx, 0.42, sy, s, s * 1.15, 0.14, ctx.col(SLASH), 0.95);
    if (a) {
      a.asp = 2.2;
      a.rot = 0.7;
    }
    const b = ctx.spr(ctx.b.bbA, CORE, ctx.R.slash, sx, 0.42, sy, s * 0.8, s * 0.95, 0.1, ctx.col(EDGE), 0.75);
    if (b) {
      b.asp = 3.4;
      b.rot = 0.7;
    }
    ripple(ctx, x, y, 0.06, 0.3, 0.2, ctx.col(LILAC), 0, 'ringSoft', true, 0.5);
  },
};

/** Ground direction toward the camera (x, z of its backward axis, normalised), or (0, 1). */
function towardCamera(ctx, out) {
  const m = ctx.camera?.matrixWorld?.elements;
  const x = m ? m[8] : 0;
  const z = m ? m[10] : 1;
  const l = Math.hypot(x, z) || 1;
  out.x = x / l;
  out.z = z / l;
  return out;
}
const _cam = { x: 0, z: 1 };

/** True (and noted) when enemy `uid` has had no slash from this girl for SLASH_EVERY (four slots per girl). */
export function slashFree(tw, uid, now) {
  if (!tw || uid == null) return true;
  const m = tw.yorikoSlash || (tw.yorikoSlash = { u: [-1, -1, -1, -1], t: [0, 0, 0, 0], i: 0 });
  for (let k = 0; k < 4; k++) {
    if (m.u[k] !== uid) continue;
    if (now - m.t[k] < SLASH_EVERY && now >= m.t[k]) return false;
    m.t[k] = now;
    return true;
  }
  m.u[m.i] = uid;
  m.t[m.i] = now;
  m.i = (m.i + 1) & 3;
  return true;
}

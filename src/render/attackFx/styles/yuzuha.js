// Yuzuha (taser darts + lane sentries, src/sim/sentries.js). Signature "Deploying": her darts fly as a
// bright cyan head with a crackling zigzag tail, and land with a taser crackle (three short electric
// forks and a flash). Each sentry shot leaves a tracer in its kit's colour and a small muzzle flash at
// the sentry. A new sentry gets a cyan uplink line from her tablet; a Burst Cell sentry going off
// crackles; a Capture Net catch snaps a net over the walker.
//   P2 Capture Net: T1+ the slow throws a small cyan net over the walker; T2+ the stun crackles in
//   yellow above its head; darts get a teal tint (T1+) and yellow sparks (T2+)
//   P0 Sentry Lab: T4+ Burst Cells crackle orange when a sentry runs out
// The sentries and nets themselves (their models on the road) belong to the placed-object pass; the
// safety-orange ring where one unfolds is src/render/deployFx.js (from the sim's 'deploy' event).
import { lookAt } from '../flair.js';
import { flash, sparks } from '../patterns/bursts.js';
import { zigzag, forks, netPatch, spokes } from '../patterns/academy.js';
import { hand } from './util.js';
import { CORE, DECOR } from '../context.js';

const VOLT = '#7fe0ff';
const TEAL = '#5ff2d6';
const STUN = '#ffe45c';
const UPLINK = '#9fdcff';
/** Tracer colours by sentry kit (the sim's sentry types). */
const KIT = { plain: '#ff9a3c', net: '#8fdcff', flash: '#fff7b0', heavy: '#ff5a4a', flak: '#c4a6ff' };
const KIT_ORDER = ['plain', 'net', 'flash', 'heavy', 'flak'];
const CUES = 8;
const NET = 1;
const ZAP = 2;

/** Adds a timed cue (net over an enemy / a spot, a stun zap) to her fixed cue slots. */
function addCue(d, kind, uid, x, y, life) {
  let best = d.cues[0];
  for (let i = 0; i < CUES; i++) {
    const c = d.cues[i];
    if (c.t >= c.life) {
      best = c;
      break;
    }
    if (c.life - c.t < best.life - best.t) best = c;
  }
  best.kind = kind;
  best.uid = uid;
  best.x = x;
  best.y = y;
  best.t = 0;
  best.life = life;
}

export const yuzuha = {
  id: 'yuzuha',

  init() {
    const cues = [];
    for (let i = 0; i < CUES; i++) cues.push({ kind: 0, uid: -1, x: 0, y: 0, t: 1, life: 1 });
    return { cues };
  },

  onAttack(ev, tw, t, ctx) {
    if (ev.turretUid != null || !ctx.cap('muzzle')) return;
    const h = hand(ctx, t);
    flash(ctx, h.x, h.h + 0.1, h.y, 0.28, ctx.col(VOLT), 0.08);
    ctx.spr(ctx.b.bbA, CORE, ctx.R.star, h.x, h.h + 0.12, h.y, 0.14, 0.28, 0.1, ctx.col('#ffffff'), 1);
  },

  onSpawn(rec, p, t, ctx) {
    if (rec.turretUid == null) return;
    // which kit fired: its tracer colour (rec.a = KIT_ORDER index + 1)
    rec.a = 1;
    const list = t.sentries || [];
    for (let i = 0; i < list.length; i++) {
      if (list[i].uid !== rec.turretUid) continue;
      rec.a = Math.max(0, KIT_ORDER.indexOf(list[i].type)) + 1;
    }
    if (ctx.cap('muzzle')) flash(ctx, rec.sx, 0.35, rec.sy, 0.3, ctx.col(KIT[KIT_ORDER[rec.a - 1]]), 0.07);
  },

  view(p, rec, _t, v, ctx) {
    const vl = Math.hypot(p.vx, p.vy) || 1;
    const ux = p.vx / vl;
    const uy = p.vy / vl;
    if (rec.turretUid != null) {
      // a sentry shot: a tracer in its kit's colour behind the bullet
      const c = ctx.col(KIT[KIT_ORDER[(rec.a || 1) - 1]]);
      ctx.line(ctx.b.bbA, CORE, v.x, v.z, v.y, v.x - ux * 0.36, v.z, v.y - uy * 0.42, 0.08, c, 0.9);
      return;
    }
    // her dart: a cyan head, a crackling zigzag tail and a white core
    v.skip = true;
    const lk = rec.tw.look;
    const net = lookAt(lk, 2) > 0 || lk.accent[2] >= 1;
    const c = ctx.col(net ? TEAL : VOLT);
    const tail = 0.55;
    ctx.quad(ctx.b.bbA, CORE, v.x, v.z, v.y, 0.34, 0.34, ctx.R.glow, c, 0.9);
    ctx.quad(ctx.b.bbA, CORE, v.x, v.z, v.y, 0.17, 0.17, ctx.R.star, ctx.col('#ffffff'), 1, ctx.time * 9);
    ctx.line(ctx.b.bbA, CORE, v.x, v.z, v.y, v.x - ux * tail * 0.6, v.z, v.y - uy * tail * 0.6, 0.05, ctx.col('#ffffff'), 0.95);
    if (ctx.q.trails > 0) zigzag(ctx, DECOR, v.x, v.z, v.y, v.x - ux * tail, v.z, v.y - uy * tail, ctx.reduceMotion ? 2 : 3, 0.07, 0.06, c, 0.95);
    if ((lookAt(lk, 2) >= 2 || lk.accent[2] >= 2) && ctx.q.sparks && ctx.rand() < ctx.gdt * 12) {
      const s = ctx.spr(ctx.b.bbA, DECOR, ctx.R.glow, v.x, v.z, v.y, 0.07, 0.02, 0.2, ctx.col(STUN), 1);
      if (s) s.g = -3;
    }
  },

  onImpact(rec, x, y, crit, radius, ctx) {
    if (rec.turretUid != null) {
      sparks(ctx, x, 0.35, y, 2, ctx.col(KIT[KIT_ORDER[(rec.a || 1) - 1]]), 1.3);
      return;
    }
    // the taser crackle
    const c = ctx.col(VOLT);
    forks(ctx, x, 0.4, y, ctx.q.trails > 0 ? 3 : 2, 0.28, c, 0.12, ctx.rand() * 6.28);
    flash(ctx, x, 0.4, y, 0.4, c, 0.08);
  },

  onStatus(ev, tw, t, ctx) {
    const e = ctx.enemy(ev.uid);
    if (!e) return;
    if (ev.status === 'slow') addCue(tw.data, NET, ev.uid, e.x, e.z, 0.6);
    else if (ev.status === 'stun') addCue(tw.data, ZAP, ev.uid, e.x, e.z, 0.35);
  },

  onOther(ev, tw, t, ctx) {
    if (ev.type === 'deploy') {
      // the uplink: a cyan line from her tablet to the new sentry / net, a pop where it lands
      const h = hand(ctx, t);
      const c = ctx.col(ev.kind === 'net' ? '#e6f7ff' : UPLINK);
      ctx.segs.add(h.x, h.h + 0.1, h.y, ev.x, 0.15, ev.y, 0.07, c, 0.22, 8 | 1);
      flash(ctx, ev.x, 0.25, ev.y, 0.45, c, 0.12);
      spokes(ctx, ev.x, ev.y, 6, 0.12, 0.42, c, 0.16, 0.3, 0.8, DECOR);
      return false;
    }
    if (ev.type === 'deployEnd' && ev.burst) {
      const c = ctx.col('#ffb347');
      forks(ctx, ev.x, 0.3, ev.y, 4, 0.5, c, 0.16, ctx.rand() * 6.28);
      flash(ctx, ev.x, 0.3, ev.y, 0.8, c, 0.14);
      return false;
    }
    if (ev.type === 'netCatch') {
      addCue(tw.data, NET, -1, ev.x, ev.y, 0.45);
      flash(ctx, ev.x, 0.35, ev.y, 0.5, ctx.col('#e6f7ff'), 0.12);
      return false;
    }
    return false;
  },

  update(gdt, tw, t, ctx) {
    const cues = tw.data.cues;
    for (let i = 0; i < CUES; i++) {
      const c = cues[i];
      if (c.t >= c.life) continue;
      c.t += gdt;
      let x = c.x;
      let y = c.y;
      let h = 0.6;
      if (c.uid >= 0) {
        const e = ctx.enemy(c.uid);
        if (!e) {
          c.t = c.life;
          continue;
        }
        x = e.x;
        y = e.z;
        h = ctx.enemyH(e);
      }
      const k = c.t / c.life;
      if (c.kind === NET) {
        // a net that drops on and draws in a little
        const s = c.uid >= 0 ? 0.26 * (1.25 - 0.25 * k) : 0.45 * (1.3 - 0.5 * k);
        netPatch(ctx, x, y, s, c.uid * 0.9 + 0.4, ctx.col(c.uid >= 0 ? TEAL : '#e6f7ff'), 0.85 * (1 - k * k));
      } else if (c.kind === ZAP) {
        // a little yellow crackle over its head
        zigzag(ctx, DECOR, x - 0.15, h + 0.3, y, x + 0.15, h + 0.36, y, 3, 0.05, 0.03, ctx.col(STUN), 1 - k);
      }
    }
  },
};

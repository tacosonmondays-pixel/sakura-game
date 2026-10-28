// Kaede (duel with a damage ramp, rapier). Signature "Maple lunge": she steps at her target with
// a rapier glint, a white thrust line and a slash sized by her ramp; maple leaves orbit her, one more for
// every two hits in a row (orange turning crimson), and scatter when the ramp resets.
//   P0 Unbroken Rhythm: T3 up to 8 leaves; T5 glowing leaves
//   P1 Flowing Blade: T5 a leaf burst on each hit
//   P2 Guard Breaker: a pommel shock ring when her stun lands on her target
// Blade arts (the sim's 'bladeArt' event, src/sim/towers.js bladeArts), in the same maple palette:
//   Maple Cleave: a wide crescent streak sweeping across her target and a faint ring the size of the cut
//   wind crescents (Flowing Blade 3+): white-gold crescents flying out along each line of the fan
//   maple storm (Flowing Blade 5): fast streaks spinning round her in a whirl of maple leaves
//   shockwave (Guard Breaker 4-5): a ground ray along the line with armor shards along it
//   maple splash (Unbroken Rhythm 3+, at full focus): crimson leaves bursting from her target
//
// Visual rework (display only; drawn from sim state and drained sim events, never written back):
//   dash afterimages  2–4 fading copies of her own figure along each lunge, maple red to amber
//                     (patterns/ghosts.js; none on low graphics or Reduce motion, which has no lunge)
//   slash streaks     thin bright-edged crescent ribbons, one instanced mesh for the whole field
//                     (patterns/streaks.js): a quick arc on every strike, a wide sweeping arc for the
//                     Maple Cleave, flying crescents along the fan, fast spinning streaks for the storm
//   hit flash         a ≈ 80 ms star popping white and cooling to maple on each enemy she cuts
//                     (patterns/hitFlash.js: one flash per enemy at a time, capped per frame; Reduce
//                     motion: a soft glow)
//   Flash Lunge (her ⚡): ghosts along her dash through the struck enemies and a flash on each
import { lookAt } from '../flair.js';
import { SEG_CORE } from '../patterns/segments.js';
import { ripple, petalSpiral, shardBurst } from '../patterns/bursts.js';
import { raySweep } from '../patterns/sweep.js';
import { afterimage } from '../patterns/clones.js';
import { StreakLayer, SWEEP, FLY, SPIN } from '../patterns/streaks.js';
import { GhostLayer } from '../patterns/ghosts.js';
import { FlashLayer } from '../patterns/hitFlash.js';
import { genericAttack } from './generic.js';
import { CORE, FAMILIAR } from '../context.js';

const ORANGE = [1, 0.55, 0.15];
const CRIMSON = [0.85, 0.1, 0.18];
/** The sim's crescent fan step (towers.js FAN_COS / FAN_SIN). */
const FAN = 0.32;
/** Streaks alive at once on the whole field (one draw call however many). */
export const STREAK_CAP = 48;
/** Spinning storm streaks per quality. */
export const STORM_STREAKS = { high: 6, medium: 4, low: 2 };
/** Events that belong to the strike they sit next to in the drained list (her hits come first). */
const HIT_RUN = new Set(['hit', 'status', 'death', 'barrierBreak', 'shellBreak']);
/** Flash sizes: her target, anyone else her cut or art reaches. */
const FLASH_MAIN = 0.45;
const FLASH_SIDE = 0.34;
const FLASH_LUNGE_ID = 'kaede.flashLunge';

/**
 * Lane angles of her wind crescents (pure): straight through her target, then pairs either side
 * (the sim's fan order: 0, +1, -1, +2, -2 … steps of FAN). Writes into out, returns it.
 */
export function crescentAngles(a, n, out = []) {
  out.length = 0;
  for (let i = 0; i < n; i++) {
    const k = Math.ceil(i / 2) * (i % 2 ? -1 : 1);
    out.push(a + k * FAN);
  }
  return out;
}

/**
 * Collects the uids of the hits drained just before event i (the sim emits a strike's hits before
 * its own event; statuses and deaths ride along). Pure. `reach` > 0 keeps the hits within it of
 * (cx, cy); `mainUid` always counts. Writes [uid, x, y, isMain, …] into out.
 */
export function hitsBefore(events, i, mainUid, cx, cy, reach, out = []) {
  out.length = 0;
  if (!events) return out;
  for (let j = i - 1; j >= 0; j--) {
    const e = events[j];
    if (!e || !HIT_RUN.has(e.type)) break;
    if (e.type !== 'hit') continue;
    const main = e.uid === mainUid;
    if (!main && reach > 0 && (e.x - cx) * (e.x - cx) + (e.y - cy) * (e.y - cy) > reach * reach) continue;
    out.push(e.uid, e.x, e.y, main ? 1 : 0);
  }
  return out;
}

/** Her field-wide layers (streaks, ghosts, flashes), made by the first Kaede, disposed with attack FX. */
export function kaedeLayers(ctx) {
  if (ctx.kaedeFx) return ctx.kaedeFx;
  const parent = ctx.actors?.root || null;
  const L = {
    streaks: new StreakLayer(parent, STREAK_CAP),
    ghosts: new GhostLayer(ctx, parent),
    flashes: new FlashLayer(ctx, 16),
    update(gdt, rdt) {
      L.streaks.update(gdt);
      L.ghosts.update(gdt);
      L.flashes.update(rdt);
    },
    dispose() {
      L.streaks.dispose();
      L.ghosts.dispose();
      L.flashes.dispose();
      if (ctx.kaedeFx === L) ctx.kaedeFx = null;
    },
  };
  ctx.kaedeFx = L;
  if (ctx.layers) ctx.layers.push(L);
  return L;
}

/** Ghost colours, oldest (left at her spot) to newest: maple red to amber. */
const GHOST_HEX = ['#d8283a', '#ff5a2e', '#ff8a2e', '#ffb347'];
const _hits = [];
const _angs = [];
const _pts = [];

function ghostCols(ctx, d) {
  if (!d.ghostCols) d.ghostCols = GHOST_HEX.map((h) => ctx.col(h));
  return d.ghostCols;
}

/** A flash on a struck enemy (its drawn body centre while it is still on the field). */
function flashOn(ctx, L, uid, x, y, size) {
  const c = ctx.col('#ff4b3a');
  const e = ctx.enemy(uid);
  if (e) L.flashes.hit(uid, e.x, ctx.enemyH(e), e.z, size * ctx.readScale, c);
  else L.flashes.hit(uid, x, 0.4, y, size * ctx.readScale, c);
}

function flashHits(ctx, L, events, i, mainUid, cx, cy, reach) {
  hitsBefore(events, i, mainUid, cx, cy, reach, _hits);
  let main = false;
  for (let k = 0; k < _hits.length; k += 4) {
    if (_hits[k + 3]) main = true;
    flashOn(ctx, L, _hits[k], _hits[k + 1], _hits[k + 2], _hits[k + 3] ? FLASH_MAIN : FLASH_SIDE);
  }
  return main;
}

export const kaede = {
  id: 'kaede',

  init(tw, t, ctx) {
    if (ctx) kaedeLayers(ctx);
    return { leaves: 0, ramp: 0, flip: 1, ghostCols: null };
  },

  onAttack(ev, tw, t, ctx, i, events) {
    if (ev.kind !== 'slash') return genericAttack(ev, tw, t, ctx);
    const L = kaedeLayers(ctx);
    const d = tw.data;
    const lk = tw.look;
    const ramp = ev.ramp || 0;
    const maxLeaves = lookAt(lk, 0) >= 3 ? 8 : 6;
    // ramp reset → the leaves scatter
    if (ramp < d.ramp && d.leaves > 0) petalSpiral(ctx, ctx.R.maple, t.x, t.y, d.leaves, ctx.col('#ff7b2e'), 1, 0.6);
    d.ramp = ramp;
    d.leaves = Math.min(maxLeaves, Math.floor(ramp / 2));
    const e = ctx.enemy(ev.targetUid);
    if (!e) return;
    const dx = e.x - t.x;
    const dy = e.z - t.y;
    const len = Math.hypot(dx, dy) || 1;
    // the lunge (her model only; Reduce motion: none) and the afterimages it leaves behind
    ctx.lunge.start(t.uid, dx, dy, 0.25, 0.05, 0.04, 0.15);
    // (the copies step out toward her target, at most 0.9 tiles, never into it)
    const dashed = !ctx.reduceMotion && L.ghosts.dash(t.uid, ghostCols(ctx, d), dx, dy, Math.min(0.9, Math.max(0, len - 0.45)));
    const h = ctx.enemyH(e);
    // base cue sized for a phone: the step forward, a rapier glint and a white thrust line that
    // holds ≈ 0.1 s, then the slash streak on her target
    const sx = t.x + (dx / len) * 0.3;
    const sy = t.y + (dy / len) * 0.3;
    if (ctx.cap('muzzle')) ctx.spr(ctx.b.bbA, CORE, ctx.R.star, sx, 0.55, sy, 0.38, 0.1, 0.1, ctx.col('#ffffff'), 1);
    ctx.segs.add(sx, 0.5, sy, e.x, h, e.z, 0.08, ctx.col('#ffffff'), 0.1, SEG_CORE);
    // the strike streak: a quick crescent across the front of her target, wider with the ramp, its
    // colour orange turning crimson; it swings the other way each strike
    const size = 0.9 + Math.min(0.7, ramp * 0.06);
    const k = Math.min(1, ramp / 12);
    const c = ctx.col('#ff9e57');
    d.flip = -d.flip;
    const mid = Math.atan2(-dx, -dy);
    const st = L.streaks.add(SWEEP, e.x, h - 0.05, e.z, 0.46 * size, mid - 1.3 * d.flip, mid + 1.3 * d.flip, 0.17 * size, 0.5 * d.flip, c, 0.18);
    if (st) {
      st.cr = ORANGE[0] + (CRIMSON[0] - ORANGE[0]) * k;
      st.cg = ORANGE[1] + (CRIMSON[1] - ORANGE[1]) * k;
      st.cb = ORANGE[2] + (CRIMSON[2] - ORANGE[2]) * k;
    }
    // the hit flash on her target (and whoever her cut around it caught)
    const reach = (t.eff?.splash || 0) + 0.6;
    if (!flashHits(ctx, L, events, i, ev.targetUid, e.x, e.z, reach)) flashOn(ctx, L, ev.targetUid, e.x, e.z, FLASH_MAIN);
    // no 3D figure to copy (or ghosts off): the flat silhouette afterimage of her Flowing Blade
    if (!dashed && !ctx.reduceMotion && lookAt(lk, 1) >= 1 && ctx.q.clones > 0 && !L.ghosts.enabled(t.uid)) {
      afterimage(ctx, t.x, t.y, e.x, e.z, ctx.col('#ff9e57'), 0.35, 0.12, 0.35, 0.6 * ctx.bodyScale(t));
    }
    if (lookAt(lk, 1) >= 5) petalSpiral(ctx, ctx.R.maple, e.x, e.z, 5, ctx.col('#ff6b2e'), 0.6, 0.45);
  },

  onOther(ev, tw, t, ctx, i, events) {
    if (ev.type === 'ability') {
      if (ev.id === FLASH_LUNGE_ID) flashLunge(ev, tw, t, ctx);
      return false; // the ability layer still draws its cue and lines
    }
    if (ev.type !== 'bladeArt') return false;
    const L = kaedeLayers(ctx);
    const low = ctx.quality === 'low';
    if (ev.kind === 'maple') {
      // full focus: crimson leaves burst from her target as far as they cut
      petalSpiral(ctx, ctx.R.maple, ev.x, ev.y, 4 + Math.min(4, ev.hits || 0), ctx.col('#e0313f'), ev.radius, 0.45);
      flashHits(ctx, L, events, i, -1, 0, 0, 0);
      return true;
    }
    const a = Math.atan2(ev.dx, ev.dy);
    const flip = (tw.data.flip = -tw.data.flip);
    // the Maple Cleave: a wide crescent sweeping across her target, sized to the cut, a thinner amber
    // edge chasing it, and a faint ring of the cut
    if (ev.radius > 0) {
      const mid = a + Math.PI;
      const r = Math.max(0.45, ev.radius * 0.8);
      L.streaks.add(SWEEP, ev.x, 0.42, ev.y, r, mid - 1.45 * flip, mid + 1.45 * flip, 0.3, 0.3 * flip, ctx.col('#ff6a2e'), 0.28);
      if (!low) {
        const s2 = L.streaks.add(SWEEP, ev.x, 0.5, ev.y, r * 0.66, mid - 1.25 * flip, mid + 1.25 * flip, 0.15, 0.24 * flip, ctx.col('#ffb347'), 0.24);
        if (s2) s2.delay = 0.035;
      }
      ripple(ctx, ev.x, ev.y, 0.2, ev.radius, 0.25, ctx.col('#ff7b2e'), 0, 'ringSoft', true, 0.3);
    }
    // wind crescents: straight through her target, then pairs either side (the sim's fan)
    const n = ev.crescents || 0;
    if (n > 0 && ev.cLen > 0) {
      const c = ctx.col(lookAt(tw.look, 1) >= 5 ? '#ffd27a' : '#ffb347');
      const life = 0.24;
      crescentAngles(a, n, _angs);
      for (let k = 0; k < _angs.length; k++) {
        const ang = _angs[k];
        const ux = Math.sin(ang);
        const uy = Math.cos(ang);
        const rc = 0.34;
        const x0 = t.x + ux * (0.35 - rc);
        const y0 = t.y + uy * (0.35 - rc);
        const s = L.streaks.add(FLY, x0, 0.45, y0, rc, ang - 1.05, ang + 1.05, 0.2, 0, c, life);
        if (s) {
          s.vx = (ux * Math.max(0, ev.cLen - 0.35)) / life;
          s.vz = (uy * Math.max(0, ev.cLen - 0.35)) / life;
          s.delay = 0.02 * Math.ceil(k / 2);
        }
        // a faint wake line along its lane
        if (!low) ctx.segs.add(t.x + ux * 0.3, 0.45, t.y + uy * 0.3, t.x + ux * ev.cLen, 0.45, t.y + uy * ev.cLen, 0.05, c, 0.12, 0, -1, 0.5);
      }
    }
    // the maple storm: fast streaks spinning round her in a whirl of leaves
    if (ev.storm > 0) {
      const m = STORM_STREAKS[ctx.quality] || STORM_STREAKS.medium;
      const cols = [ctx.col('#ff5a2e'), ctx.col('#ffb347'), ctx.col('#d8283a')];
      for (let k = 0; k < m; k++) {
        const r = ev.storm * (0.45 + 0.5 * (m > 1 ? k / (m - 1) : 0.5));
        const mid = a + k * 2.4;
        const dir = k % 2 ? -1 : 1;
        const s = L.streaks.add(SPIN, t.x, 0.32 + 0.08 * (k % 3), t.y, r, mid - 0.7 * dir, mid + 0.7 * dir, 0.16, 0.12 * dir, cols[k % 3], 0.26);
        if (s) {
          s.spin = dir * 8;
          s.delay = 0.035 * k;
        }
      }
      petalSpiral(ctx, ctx.R.maple, t.x, t.y, low ? 4 : 8, ctx.col('#ff6b2e'), ev.storm, 0.7);
      ripple(ctx, t.x, t.y, 0.4, ev.storm, 0.35, ctx.col('#e0313f'), 0.05, 'ringSoft', true, 0.3);
    }
    // the shockwave splits the ground along her line; armor shards fly where it runs
    if (ev.wave > 0) {
      raySweep(ctx, t.x, t.y, a, a, ev.wave, 1, 0, ctx.col('#ffd166'), 0.42, 0.3, 0.9);
      for (let k = 1; k <= 3; k++) {
        const dd = (ev.wave * k) / 3;
        if (ctx.cap('muzzle')) shardBurst(ctx, t.x + Math.sin(a) * dd, 0.2, t.y + Math.cos(a) * dd, 3, ctx.col('#b0b8c4'), 1.4);
      }
    }
    // a flash on everyone the arts cut (her target's flash came with her strike)
    flashHits(ctx, L, events, i, -1, 0, 0, 0);
    return true;
  },

  onStatus(ev, tw, t, ctx) {
    if (ev.status !== 'stun' || lookAt(tw.look, 2) < 1 || ev.uid !== tw.lastTargetUid) return;
    const e = ctx.enemy(ev.uid);
    if (e) ripple(ctx, e.x, e.z, 0.1, 0.6, 0.25, ctx.col('#ffe066'), 0, 'ringThick', true, 0.9);
  },

  onRemove(tw, ctx) {
    ctx.kaedeFx?.ghosts.release(tw.uid);
  },

  update(gdt, tw, t, ctx) {
    const d = tw.data;
    if (!d.leaves) return;
    const glow = lookAt(tw.look, 0) >= 5;
    const k = Math.min(1, d.ramp / 12);
    const r = ORANGE[0] + (CRIMSON[0] - ORANGE[0]) * k;
    const g = ORANGE[1] + (CRIMSON[1] - ORANGE[1]) * k;
    const b = ORANGE[2] + (CRIMSON[2] - ORANGE[2]) * k;
    const s = ctx.bodyScale(t);
    for (let i = 0; i < d.leaves; i++) {
      const a = ctx.time * 2.2 + (i / d.leaves) * Math.PI * 2;
      const x = t.x + Math.sin(a) * 0.45 * s;
      const y = t.y + Math.cos(a) * 0.45 * s;
      const h = (0.55 + 0.12 * Math.sin(a * 2 + i)) * s;
      if (!ctx.quadRGB(ctx.b.bbN, FAMILIAR, x, h, y, 0.15, 0.15, ctx.R.maple, r, g, b, 1, a)) break;
      if (glow) ctx.quadRGB(ctx.b.bbA, 1, x, h, y, 0.3, 0.3, ctx.R.glow, r, g, b, 0.5);
    }
  },
};

/**
 * Flash Lunge (her ⚡; the sim never moves her): her ghosts left along the dash through the enemies
 * it strikes, each facing the way she runs, and a flash on each of them.
 */
function flashLunge(ev, tw, t, ctx) {
  const L = kaedeLayers(ctx);
  const targets = Array.isArray(ev.targets) ? ev.targets : [];
  _pts.length = 0;
  let px = t.x;
  let py = t.y;
  for (let k = 0; k < targets.length; k++) {
    const e = ctx.enemy(targets[k]);
    if (!e) continue;
    flashOn(ctx, L, targets[k], e.x, e.z, FLASH_MAIN);
    if (ctx.reduceMotion) continue;
    // a ghost 70 % of the way to each struck enemy, facing her run
    const fx = e.x - px;
    const fy = e.z - py;
    _pts.push(px + fx * 0.7, py + fy * 0.7, Math.atan2(fx, fy));
    px = e.x;
    py = e.z;
  }
  if (_pts.length) L.ghosts.trail(t.uid, _pts, ghostCols(ctx, tw.data));
}

// Iroha's mirror panel: the pure timing rules behind its animation (display only, no THREE, no sim writes).
// src/render/mirrorFx.js draws with them; tests/render/mirrorPanel.test.js pins them.
//
//   flip    a bolt relayed through the panel turns the glass toward the shot (an ease-out-back turn with a small
//           forward tip), holds while shots keep coming, then eases back to its idle camera-facing sway.
//           Shots that come faster than a flip lasts MERGE: the running turn retargets, nothing restarts, so a fast
//           volley reads as the panel tracking its target, never as a strobe.
//   glint   a bright specular sweep across the glass, at most one per GLINT_GAP.
//   flash   the small flash where the bolt leaves the glass, at most one per FLASH_GAP.
//   Reduce motion: no turn and no tip; the glint and the flash (short fades) stay.
//
// Shattered Glass (path index 2): splash bolts scatter glinting glass shards at the impact, more with each tier:
// Splintered Glass (T2) → Glass Shards (T3) → Glass Storm (T4) → Kaleidoscope Burst (T5, plus a kaleidoscope flare).

const TAU = Math.PI * 2;

/** Seconds (real time; the board's frames, so a 3x game merges more shots, never strobes faster). */
export const FLIP = Object.freeze({
  /** the turn toward the shot */
  turn: 0.2,
  /** the glass holds toward its last shot this long after it */
  hold: 0.5,
  /** the ease back to the idle sway */
  back: 0.45,
  /** a new flip only this long after the previous one started; sooner = merged into it */
  minGap: 0.3,
  /** forward tip (radians) at the middle of a turn */
  tip: 0.22,
  /** the glint sweep's length and the least time between two */
  glint: 0.26,
  glintGap: 0.34,
  /** the leave flash's length and the least time between two */
  flash: 0.14,
  flashGap: 0.12,
});

export const KICK_FLIP = 1;
export const KICK_MERGE = 2;
export const KICK_GLINT = 4;
export const KICK_FLASH = 8;

/** Fresh per-panel state (pooled by the caller; panelReset reuses one). */
export function createPanelAnim() {
  return panelReset({});
}

export function panelReset(s) {
  s.from = 0;
  s.to = 0;
  s.t0 = -1e9;
  s.last = -1e9;
  s.glintT0 = -1e9;
  s.flashT = -1e9;
  s.flips = 0;
  s.merged = 0;
  return s;
}

/** `a` moved by whole turns to lie within π of `ref`. */
export function nearAngle(a, ref) {
  let d = (a - ref) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d < -Math.PI) d += TAU;
  return ref + d;
}

/** easeOutBack (a small overshoot that settles: the glass "snaps" to the shot). */
export function easeOutBack(k) {
  const c1 = 1.4;
  const c3 = c1 + 1;
  const u = k - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

const smooth = (k) => k * k * (3 - 2 * k);

/**
 * A bolt left the panel toward `shotYaw` (the mesh yaw that faces the shot) at `now`; `cur` is the yaw drawn this
 * frame. Updates `s` and returns KICK_* flags: FLIP (a new turn started) or MERGE (folded into the running one),
 * plus GLINT / FLASH when those may start now. Reduce motion: never FLIP / MERGE.
 */
export function panelKick(s, now, shotYaw, cur, reduce = false) {
  let out = 0;
  if (!reduce) {
    if (now - s.t0 >= FLIP.minGap) {
      s.from = cur;
      s.to = nearAngle(shotYaw, cur);
      s.t0 = now;
      s.flips++;
      out |= KICK_FLIP;
    } else {
      // mid-flip: retarget the running turn (no restart, no second glint burst)
      s.to = nearAngle(shotYaw, s.from);
      s.merged++;
      out |= KICK_MERGE;
    }
    s.last = now;
  }
  if (now - s.glintT0 >= FLIP.glintGap) {
    s.glintT0 = now;
    out |= KICK_GLINT;
  }
  if (now - s.flashT >= FLIP.flashGap) {
    s.flashT = now;
    out |= KICK_FLASH;
  }
  return out;
}

/**
 * The panel's drawn yaw and forward tip at `now`, around the idle yaw `rest`. Writes out.yaw, out.tip and
 * out.busy (true while it turns, holds or returns). Pure.
 */
export function panelPose(s, now, rest, out = { yaw: 0, tip: 0, busy: false }) {
  out.yaw = rest;
  out.tip = 0;
  out.busy = false;
  const el = now - s.t0;
  if (el < 0 || s.t0 < -1e8) return out;
  if (el < FLIP.turn) {
    const k = el / FLIP.turn;
    out.yaw = s.from + (s.to - s.from) * easeOutBack(k);
    out.tip = Math.sin(k * Math.PI) * FLIP.tip;
    out.busy = true;
    return out;
  }
  const holdEnd = Math.max(s.t0 + FLIP.turn, s.last) + FLIP.hold;
  if (now < holdEnd) {
    out.yaw = s.to;
    out.busy = true;
    return out;
  }
  const kb = (now - holdEnd) / FLIP.back;
  if (kb < 1) {
    const r = nearAngle(rest, s.to);
    out.yaw = s.to + (r - s.to) * smooth(kb);
    out.busy = true;
  }
  return out;
}

/** Glint sweep progress 0..1 at `now`, or -1 when none runs. */
export function glintPhase(s, now) {
  const k = (now - s.glintT0) / FLIP.glint;
  return k >= 0 && k < 1 ? k : -1;
}

/** Leave-flash strength 1 → 0 at `now`, or 0 when none runs. */
export function flashLevel(s, now) {
  const k = (now - s.flashT) / FLIP.flash;
  return k >= 0 && k < 1 ? 1 - k : 0;
}

/** The mesh yaw (the glass faces +z) that faces a shot going (dx, dy) on the ground. */
export function shotYaw(dx, dy) {
  return Math.atan2(dx, dy);
}

// ---- Shattered Glass shards ---------------------------------------------------------------------------------

/** Shards per splash hit by Shattered Glass tier (index = tier). */
export const SHARDS = Object.freeze([0, 0, 3, 5, 7, 9]);
/** Hard cap on one impact's shards on any setting. */
export const SHARD_CAP = 9;

/** Shard level 0..4 of a girl's path tiers [hall, silver, shard]: 0 below Splintered Glass (T2). */
export function shardLevel(tiers) {
  const t = Math.max(0, Math.min(5, (tiers && tiers[2]) | 0));
  return t >= 2 ? t - 1 : 0;
}

/** Shards one splash impact scatters at Shattered Glass tier `tier` on `quality` ('low' | 'medium' | 'high'). */
export function shardCount(tier, quality = 'medium') {
  const n = SHARDS[Math.max(0, Math.min(5, tier | 0))];
  if (!n) return 0;
  if (quality === 'low') return Math.min(3, Math.ceil(n / 2));
  if (quality === 'medium') return Math.min(SHARD_CAP, n - (n > 5 ? 2 : 0));
  return Math.min(SHARD_CAP, n);
}

/** Does this impact get the Kaleidoscope Burst flare (T5), and is it the full one (not low graphics)? 0 / 1 / 2 */
export function kaleidoscope(tier, quality = 'medium') {
  if ((tier | 0) < 5) return 0;
  return quality === 'low' ? 1 : 2;
}

// ---- Mirror Shift afterimages --------------------------------------------------------------------------------

/** Afterimage panels left along a jump, by quality (Reduce motion: one that fades where the panel was). */
export function ghostCount(quality = 'medium', reduce = false) {
  if (reduce) return 1;
  return quality === 'high' ? 4 : quality === 'low' ? 2 : 3;
}

/** Afterimage i of n along a jump from (fx, fy) to (tx, ty): its ground point (out.x, out.y) and start delay. */
export function ghostAt(i, n, fx, fy, tx, ty, reduce = false, out = { x: 0, y: 0, delay: 0 }) {
  if (reduce || n <= 1) {
    out.x = fx;
    out.y = fy;
    out.delay = 0;
    return out;
  }
  // from where it left toward where it lands, never on either end (the panel is drawn there)
  const k = (i + 0.6) / (n + 0.4);
  out.x = fx + (tx - fx) * k;
  out.y = fy + (ty - fy) * k;
  out.delay = 0.035 * i;
  return out;
}

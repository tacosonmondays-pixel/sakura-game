// State machines of the placed objects (FX-1), as pure functions of the time spent in each state:
// Azami's spike strip, Yuzuha's sentry and her Capture Net. The drivers (strips.js, sentries.js) feed
// them sim state and events and turn the poses into instance transforms; nothing here touches three.js
// or the sim, so the rules are unit-tested in node (tests/render/placed-fsm.test.js).
//
// Every state advances on game time (the attack-FX clock: frozen in a hit-stop or a pause, 3× at 3×).
// `motion` selects the full look ('full'), the static Low look ('static': no unfold, wobble or jab) or
// Reduce Motion ('calm': arrivals and departures are short fades in place, no travel or bounce).
import { clamp01, smooth01, easeOutBack, overshoot, jab, stagger, rowsLeft } from './math.js';
import { PLATES } from './geometry.js';

// ---- the spike strip ---------------------------------------------------------------------------

export const STRIP = {
  /** the rolled strip's toss (s) and its arc height; Spike Rain strips fall from higher, for longer */
  FLY: 0.36, APEX: 0.35, RAIN_FLY: 0.55, RAIN_H: 3.2,
  /** landing bounce (s), then the plates unroll one after another */
  LAND: 0.08, UNROLL_GAP: 0.03, UNROLL: 0.12,
  /** spikes rise row by row (overshoot 1.2) */
  ARM_GAP: 0.025, ARM: 0.14,
  /** a bite: the plate under the walker jabs 1 → 1.35 → 1 */
  JAB: 0.12,
  /** a sunk row eases down this fast; the spent strip rolls up and fades */
  SINK: 0.15, SPENT: 0.25,
  /** the armed glint sweeps the strip every GLINT seconds, taking GLINT_T */
  GLINT: 2.5, GLINT_T: 0.3,
  /** Charged Strips: a shiver and a hot glow in the last SHIVER seconds of a strip's life */
  SHIVER: 0.25,
  /** a fade in place (Reduce Motion arrivals / departures) */
  FADE: 0.15,
};

/** Rows sink from the ends inward as hits run out: the order rows go down in. */
export const SINK_ORDER = [0, 4, 1, 3, 2];

/** A new strip record (display state only). */
export function stripState() {
  return {
    phase: 'fly', t: 0, armedT: -1, spentT: -1, hits0: 0, left: 0, rows: PLATES,
    jab: new Float32Array(PLATES).fill(9), sink: new Float32Array(PLATES), glintT: 0,
  };
}

/**
 * One step of a strip. `armed`, `left` (hits left), `hits0` (its hit budget) come from the sim trap;
 * `gone` once it left sim.traps (spent / expired / evicted / the wave ended).
 * @returns {boolean} still drawn
 */
export function stripStep(s, dt, { armed, left, hits0, gone }, motion = 'full') {
  s.t += dt;
  if (hits0 > s.hits0) s.hits0 = hits0;
  s.left = left;
  if (gone && s.spentT < 0) s.spentT = 0;
  if (s.spentT >= 0) {
    s.spentT += dt;
    return s.spentT < (motion === 'calm' ? STRIP.FADE : STRIP.SPENT);
  }
  if (s.phase === 'fly') return true; // the toss lands it (stripLand)
  if (armed && s.armedT < 0) s.armedT = 0;
  else if (s.armedT >= 0) s.armedT += dt;
  for (let i = 0; i < PLATES; i++) s.jab[i] += dt;
  // rows still up: the ones past the budget sink from the ends inward
  const up = rowsLeft(left, Math.max(1, s.hits0), PLATES);
  for (let k = 0; k < PLATES; k++) {
    const row = SINK_ORDER[k];
    const sunk = k < PLATES - up;
    s.sink[row] = sunk ? Math.min(1, s.sink[row] + dt / STRIP.SINK) : Math.max(0, s.sink[row] - dt / STRIP.SINK);
  }
  if (s.armedT >= 0) s.glintT += dt;
  return true;
}

/** The toss landed: the strip starts unrolling (or is simply there: static and calm looks). */
export function stripLand(s) {
  if (s.phase === 'fly') {
    s.phase = 'down';
    s.t = 0;
  }
}

/** A bite on plate i. */
export function stripBite(s, i) {
  if (i >= 0 && i < PLATES) s.jab[i] = 0;
}

/**
 * The strip's pose this frame. Writes into `out`:
 *   fold[i]  0 = plate i lies flat, 1 = folded back over its neighbour (unrolling)
 *   spike[i] the spike row's height factor (0 hidden … 1 up; overshoot and jabs above 1)
 *   lift     the landing bounce (world units), scale the whole strip's scale (spent: shrinks), fade 0..1
 *   glint    −1 none, else 0..1 along the strip
 */
export function stripPose(s, out, motion = 'full', ttl = -1, boom = false) {
  const fold = out.fold || (out.fold = new Float32Array(PLATES));
  const spike = out.spike || (out.spike = new Float32Array(PLATES));
  out.lift = 0;
  out.scale = 1;
  out.fade = 1;
  out.glint = -1;
  out.shiver = 0;
  const calm = motion === 'calm';
  const still = motion === 'static';
  if (s.phase === 'fly') {
    fold.fill(1);
    spike.fill(0);
    out.scale = 0;
    return out;
  }
  const t = s.t;
  // arrival
  if (calm) {
    out.fade = smooth01(t / STRIP.FADE);
    out.scale = out.fade;
    fold.fill(0);
  } else if (still) {
    fold.fill(0);
  } else {
    const k = t / STRIP.LAND;
    out.lift = k < 1 ? 0.05 * Math.sin(Math.PI * k) : 0;
    const u = Math.max(0, t - STRIP.LAND);
    for (let i = 0; i < PLATES; i++) fold[i] = i === 0 ? 0 : 1 - smooth01(stagger(u, i - 1, STRIP.UNROLL_GAP, STRIP.UNROLL));
  }
  const unrolled = calm || still ? 0 : STRIP.LAND + (PLATES - 2) * STRIP.UNROLL_GAP + STRIP.UNROLL;
  // spikes
  for (let i = 0; i < PLATES; i++) {
    let h = 0;
    if (s.armedT >= 0) {
      const a = Math.max(0, Math.min(s.armedT, t - unrolled));
      if (still) h = 1;
      else if (calm) h = smooth01(a / STRIP.FADE);
      else h = overshoot(stagger(a, i, STRIP.ARM_GAP, STRIP.ARM), 1.2, 0.6);
    }
    h *= 1 - smooth01(s.sink[i]);
    if (!still && !calm && s.jab[i] < STRIP.JAB) h *= jab(s.jab[i] / STRIP.JAB, 1.35);
    spike[i] = h;
  }
  // the armed glint (light, not motion: it stays under Reduce Motion, off on Low)
  if (!still && s.armedT >= 0) {
    const g = s.glintT % STRIP.GLINT;
    if (s.glintT < STRIP.GLINT_T || g < STRIP.GLINT_T) out.glint = (s.glintT < STRIP.GLINT_T ? s.glintT : g) / STRIP.GLINT_T;
  }
  // Charged Strips: shiver + hot glow just before the timed blast
  if (boom && ttl >= 0 && ttl < STRIP.SHIVER && s.spentT < 0) out.shiver = 1 - ttl / STRIP.SHIVER;
  // departure: spikes retract, plates roll back up, the strip shrinks and fades
  if (s.spentT >= 0) {
    if (calm) {
      const k = clamp01(s.spentT / STRIP.FADE);
      out.fade *= 1 - k;
      out.scale *= 1 - k;
    } else {
      const k = clamp01(s.spentT / STRIP.SPENT);
      for (let i = 0; i < PLATES; i++) {
        spike[i] *= 1 - smooth01(k * 2.5);
        if (!still) fold[i] = Math.max(fold[i], i === 0 ? 0 : smooth01((k - 0.25 - (PLATES - 1 - i) * 0.08) * 3));
      }
      out.scale = 1 - smooth01((k - 0.5) * 2);
      out.fade = out.scale;
    }
  }
  return out;
}

// ---- the sentry --------------------------------------------------------------------------------

export const SENTRY = {
  /** the case toss (s) and its arc */
  FLY: 0.35, APEX: 0.42,
  /** landing bounce + squash */
  LAND: 0.1,
  /** the three beats: legs spring out (0 → LEGS), the head telescopes up, the lens lights, the charm pops */
  LEGS: 0.25, HEAD0: 0.12, HEAD1: 0.38, LENS: 0.34, CHARM: 0.42, UNFOLD: 0.5,
  /** legs splay to SPLAY rad (the spring overshoots it) */
  SPLAY: 0.62,
  /** the head telescopes this far */
  TELE: 0.06,
  /** a shot: the barrel kicks back KICK for KICK_T, then returns over KICK_BACK */
  KICK: 0.025, KICK_T: 0.04, KICK_BACK: 0.12,
  /** tracking turn rate (rad/s) */
  TURN: Math.PI * 2,
  /** the lens blinks amber at BLINK_HZ in the last LOW seconds */
  LOW: 3, BLINK_HZ: 2,
  /** folding away */
  FOLD: 0.3,
  FADE: 0.15,
};

export function sentryState() {
  return { phase: 'fly', t: 0, kick: 9, foldT: -1 };
}

/** The case landed: the unfold starts. */
export function sentryLand(s) {
  if (s.phase === 'fly') {
    s.phase = 'down';
    s.t = 0;
  }
}

/** @returns {boolean} still drawn */
export function sentryStep(s, dt, gone, motion = 'full') {
  s.t += dt;
  s.kick += dt;
  if (gone && s.foldT < 0) s.foldT = 0;
  if (s.foldT >= 0) {
    s.foldT += dt;
    return s.foldT < (motion === 'calm' ? SENTRY.FADE : SENTRY.FOLD);
  }
  return true;
}

/** A shot from this sentry (the barrel kicks). */
export function sentryShot(s) {
  s.kick = 0;
}

/**
 * The sentry's pose. Writes into `out`:
 *   caseS   the folded case's scale (1 = the closed case, 0 = gone: unfolded)
 *   legs    leg splay (rad), hub (0..1 the hub and head are out), tele (head rise, world units)
 *   lens    0 off … 1 lit, charm the charm's pop scale, squash (y scale on landing)
 *   kick    barrel kick-back (world units), sink (y offset while folding), fade 0..1
 */
export function sentryPose(s, out, motion = 'full') {
  out.caseS = 0;
  out.legs = SENTRY.SPLAY;
  out.hub = 1;
  out.tele = SENTRY.TELE;
  out.lens = 1;
  out.charm = 1;
  out.squash = 1;
  out.kick = 0;
  out.sink = 0;
  out.fade = 1;
  if (s.phase === 'fly') {
    out.caseS = 0;
    out.hub = 0;
    out.fade = 0;
    return out;
  }
  const t = s.t;
  const calm = motion === 'calm';
  if (calm) {
    out.fade = smooth01(t / SENTRY.FADE);
  } else if (motion !== 'static') {
    // land: a bounce + squash of the case, then the three beats
    if (t < SENTRY.LAND) {
      out.caseS = 1;
      out.hub = 0;
      out.legs = 0;
      out.tele = 0;
      out.lens = 0;
      const k = t / SENTRY.LAND;
      out.squash = 1 - 0.18 * Math.sin(Math.PI * k);
    } else {
      const u = t - SENTRY.LAND;
      out.caseS = 1 - smooth01(u / 0.1);
      out.hub = smooth01(u / 0.1);
      out.legs = SENTRY.SPLAY * easeOutBack(u / SENTRY.LEGS, 2.2);
      out.tele = SENTRY.TELE * smooth01((u - SENTRY.HEAD0) / (SENTRY.HEAD1 - SENTRY.HEAD0));
      out.lens = u >= SENTRY.LENS ? 1 : 0;
      out.charm = u < SENTRY.CHARM ? 0.4 : easeOutBack((u - SENTRY.CHARM) / 0.1, 3);
    }
    // the shot's kick
    if (s.kick < SENTRY.KICK_T) out.kick = SENTRY.KICK * (s.kick / SENTRY.KICK_T);
    else if (s.kick < SENTRY.KICK_T + SENTRY.KICK_BACK) out.kick = SENTRY.KICK * (1 - smooth01((s.kick - SENTRY.KICK_T) / SENTRY.KICK_BACK));
  }
  if (s.foldT >= 0) {
    if (calm) {
      out.fade *= 1 - clamp01(s.foldT / SENTRY.FADE);
    } else {
      const k = clamp01(s.foldT / SENTRY.FOLD);
      out.legs *= 1 - smooth01(k * 2);
      out.tele *= 1 - smooth01(k * 2);
      out.hub = 1 - smooth01((k - 0.35) * 3);
      out.caseS = smooth01((k - 0.35) * 3) * (1 - smooth01((k - 0.7) * 3.3));
      out.sink = -0.12 * smooth01((k - 0.6) * 2.5);
      out.lens = k < 0.3 ? 1 : 0;
      out.fade = 1 - smooth01((k - 0.7) * 3.3);
    }
  }
  return out;
}

/** Lens colour mix (0 teal … 1 amber) for a sentry with `ttl` seconds left at time `time`. */
export function lensBlink(ttl, time) {
  if (!(ttl < SENTRY.LOW)) return 0;
  return Math.sin(time * Math.PI * 2 * SENTRY.BLINK_HZ) > 0 ? 1 : 0;
}

// ---- the Capture Net ---------------------------------------------------------------------------

export const NET = {
  /** the folded net ball's flight; it opens over its last OPEN_K of the flight */
  FLY: 0.42, APEX: 0.6, OPEN_K: 0.45,
  /** draped: the rim weights bounce once */
  DRAPE: 0.28,
  /** a catch: the net cinches round the walker, holds, then pops into coins */
  CINCH: 0.15, HOLD: 0.1, POP: 0.35,
  FADE: 0.15,
};

/** Shape of the net ball in flight at progress k: { open, lift, cinch }. */
export function netFlight(k, out) {
  const o = clamp01((k - (1 - NET.OPEN_K)) / NET.OPEN_K);
  out.cinch = 1 - smooth01(o);
  out.open = 0.15 + 0.85 * smooth01(o);
  // a rim flutter while it opens
  out.lift = o > 0 && o < 1 ? 0.06 * Math.sin(o * Math.PI * 3) : 0;
  return out;
}

/** The draped net t seconds after landing: { open, lift, cinch } (the rim bounces once). */
export function netDrape(t, out, motion = 'full') {
  out.open = 1;
  out.cinch = 0;
  out.lift = 0;
  if (motion !== 'full' || t >= NET.DRAPE) return out;
  const k = t / NET.DRAPE;
  out.lift = 0.1 * Math.sin(k * Math.PI * 2) * (1 - k);
  return out;
}

/** Opacity of a lying net from what is left of its budget (the player sees how much is left). */
export function netAlpha(left, budget) {
  if (!(left > 0)) return 0.28;
  const f = budget > 0 ? clamp01(left / budget) : 1;
  return 0.45 + 0.5 * f;
}

/**
 * A catch bundle t seconds after the catch: { cinch, scale, alpha, popped } (scale and alpha fall
 * while it pops into coins). Calm: no cinch motion, a fade in and out.
 */
export function netBundle(t, out, motion = 'full') {
  const total = NET.CINCH + NET.HOLD + NET.POP;
  out.popped = t >= NET.CINCH + NET.HOLD;
  out.done = t >= total;
  if (motion === 'calm') {
    out.cinch = 1;
    out.scale = 1;
    out.alpha = t < NET.FADE ? t / NET.FADE : 1 - clamp01((t - NET.CINCH - NET.HOLD) / NET.POP);
    return out;
  }
  out.cinch = motion === 'static' ? 1 : smooth01(t / NET.CINCH);
  const p = clamp01((t - NET.CINCH - NET.HOLD) / NET.POP);
  out.scale = 1 - 0.6 * smooth01(p);
  out.alpha = 1 - smooth01(p);
  return out;
}

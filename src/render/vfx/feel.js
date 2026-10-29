// Hit feel (docs/VFX.md §M1): the one place that decides, for the battle renderer, whether a big
// moment gets a camera shake, a zoom punch, a global hit-stop, impact frames, a local hold of the
// struck enemy or a screen flash — and how soft — from the graphics tier, Reduce Motion, the
// Flashes & shake and Impact frames settings, a girl being placed and the flash budget. Kept free
// of WebGL so the rules are tested in node (tests/render/vfx-m1.test.js).
//
//   graphics tier      FEEL[tier]: high everything; medium a lighter shake, local holds, the global
//                      freeze only for boss kills, a soft tint instead of impact frames; low a small
//                      shake, no freeze or hold, no zoom punch, no impact frames, no squash
//   Reduce Motion      no shake, no zoom punch, no hit-stop or local hold, no impact frames; flashes
//                      ≤ 0.2 opacity and slower (an impact becomes a soft tint)
//   Flashes & shake    (settings.hitEffects) off: no screen flash of any kind, no impact frames, no
//                      shake, no zoom punch, no hit-stop, no local hold (read live: the battle's
//                      pause menu has it)
//   Impact frames      (settings.impactFrames, default on; read live) off: an ult or a boss kill
//                      gets the soft tint instead of the tinted impact frame
//   placing a girl     the camera holds still: no shake, no punch
import { flashColor } from './flashGuard.js';

/**
 * What each graphics tier gets. shake: trauma multiplier (the shake grows with trauma², so 0.8 ≈
 * two thirds of the size, 0.6 ≈ a third); hitStop: the global freeze kinds allowed
 * (src/render/vfx/hitStop.js); hold: the hit classes that hold the struck enemy
 * (src/render/vfx/localHold.js); impact: impact frames (else a soft tint); squash: how much a
 * struck monster squashes.
 */
export const FEEL = {
  high: { shake: 1, punch: true, hitStop: new Set(['boss', 'impact']), hold: new Set(['strong', 'crit']), impact: true, squash: 1 },
  medium: { shake: 0.8, punch: true, hitStop: new Set(['boss']), hold: new Set(['strong', 'crit']), impact: false, squash: 1 },
  low: { shake: 0.6, punch: false, hitStop: new Set(), hold: new Set(), impact: false, squash: 0 },
};

/**
 * @param {{
 *   reduceMotion: boolean, hitEffects: () => boolean, placing: () => boolean, now: () => number,
 *   impactFrames?: () => boolean, tier?: () => 'high'|'medium'|'low',
 *   guard: import('./flashGuard.js').FlashGuard, director: import('./hitStop.js').HitStopDirector,
 *   holds?: import('./localHold.js').LocalHoldDirector,
 *   rig: { kick(t: number): void, punch(a: number, s: number): void },
 *   impact: { active: boolean, start(color: string): void },
 *   tint: (color: string, opacity: number, decay: number) => void,
 * }} o
 */
export function createHitFeel(o) {
  const stats = { impacts: 0, impactsRefused: 0, softTints: 0, shakes: 0, punches: 0, flashesOff: 0, holds: 0 };
  let afterglow = null;
  const cfg = () => FEEL[o.tier?.()] || FEEL.medium;
  const on = () => o.hitEffects() !== false;
  const framesOn = () => (o.impactFrames ? o.impactFrames() !== false : true);

  const feel = {
    stats,

    /** This tier's settings (FEEL). */
    get tier() {
      return cfg();
    },

    /** Camera shake, trauma 0..1 (scaled by the tier). */
    shake(trauma) {
      if (o.reduceMotion || !on() || o.placing() || !(trauma > 0)) return false;
      o.rig.kick(Math.min(1, trauma * cfg().shake));
      stats.shakes++;
      return true;
    },

    /** Zoom punch [amount, seconds]. */
    punch([amount, seconds]) {
      if (o.reduceMotion || !on() || !cfg().punch || o.placing() || !(amount > 0)) return false;
      o.rig.punch(amount, seconds);
      stats.punches++;
      return true;
    },

    /**
     * A full-screen flash through the flash guard (reddish colours are softened and capped lower).
     * @returns {number} the opacity drawn (0 with Flashes & shake off)
     */
    flash(color, strength = 0.75, decay = 2.5) {
      if (!on()) {
        stats.flashesOff++;
        return 0;
      }
      const fc = flashColor(color);
      let s = strength;
      let d = decay;
      if (o.reduceMotion) {
        s *= 0.35;
        d = Math.min(d, 1.6); // and slower: no sudden change
      }
      const a = o.guard.flash(s, o.now(), fc.red);
      if (a > 0) o.tint(fc.color, a, d);
      return a;
    },

    /** Global hit-stop of a kind (src/render/vfx/hitStop.js) when this tier allows it; the director reads the setting itself. */
    hitStop(kind) {
      if (!cfg().hitStop.has(kind)) return 0;
      return o.director.request(kind);
    },

    /**
     * Local hold of one struck enemy (src/render/vfx/localHold.js) for a hit class this tier allows.
     * @param {number} uid @param {'weak'|'strong'|'crit'} cls @param {number} frames
     * @returns {number} rendered frames granted (0 = none); the caller holds that enemy's look
     */
    hold(uid, cls, frames) {
      if (!o.holds || !(frames > 0) || !cfg().hold.has(cls)) return 0;
      const n = o.holds.request(uid, frames);
      if (n > 0) stats.holds++;
      return n;
    },

    /**
     * Can a hit hold its enemy at all right now? Not on a tier without holds (Low), with Reduce
     * Motion or with Flashes & shake off (read live). While it can't, the renderer skips working out
     * who dealt each hit (src/render/vfx/hitSource.js).
     */
    holdsPossible() {
      return !!o.holds && !o.reduceMotion && on() && cfg().hold.size > 0;
    },

    /** How much a struck monster squashes on this tier (half with Reduce Motion). */
    squash() {
      return cfg().squash * (o.reduceMotion ? 0.5 : 1);
    },

    /**
     * A hero ult or a boss kill: the tinted impact frame + a global hit-stop when allowed (high,
     * Impact frames on), else a soft tint.
     * @returns {boolean} the impact frames run
     */
    impact(color) {
      const fc = flashColor(color);
      if (!o.reduceMotion && on() && framesOn() && cfg().impact && !o.impact.active && o.guard.impact(o.now())) {
        o.impact.start(fc.color);
        o.director.request('impact');
        // after the tinted frames the board comes back to its own brightness: the moment's colour
        // only swells in from nothing (AFTERGLOW.rise) to a faint peak, so the dimmed frames are
        // never followed by a jump above the board's normal brightness
        afterglow = { color: fc.color, a: Math.min(fc.red ? AFTERGLOW.red : AFTERGLOW.peak, o.guard.cap), rise: AFTERGLOW.rise, decay: AFTERGLOW.decay };
        stats.impacts++;
        return true;
      }
      stats.impactsRefused++;
      stats.softTints++;
      feel.flash(color, o.reduceMotion ? 0.5 : 0.45, o.reduceMotion ? 1.2 : 1.8);
      return false;
    },

    /**
     * After the last impact frame: the tint the board comes back under (once): { color, a (its
     * peak), rise (seconds it takes to swell in from 0), decay }.
     */
    takeAfterglow() {
      const a = afterglow;
      afterglow = null;
      return a;
    },
  };
  return feel;
}

/**
 * The faint tint after impact frames: it swells in from 0 over `rise` seconds to `peak` (`red` for a
 * reddish moment), then fades at `decay` a second. It starts from nothing, so the board never jumps
 * from the dimmed frame to above its own brightness.
 */
export const AFTERGLOW = { peak: 0.1, red: 0.06, rise: 0.15, decay: 1.2 };

/**
 * One step of the screen tint layer (the renderer's DOM flash), d seconds of visual time: a tint
 * with `rise` swells in from where it was (`from`) toward its `peak` first, then (like every other
 * tint) fades at `decay`. Mutates and returns `f` ({ a, decay, from?, peak?, rise?, up? }).
 */
export function stepTint(f, d) {
  if (f.rise > 0) {
    f.up = (f.up || 0) + d;
    const from = f.from || 0;
    f.a = from + (f.peak - from) * Math.min(1, f.up / f.rise);
    if (f.up >= f.rise) f.rise = 0;
    return f;
  }
  f.a = Math.max(0, f.a - d * f.decay);
  return f;
}

/** Camera trauma (0..1) for the big moments the attack-FX layer draws (the renderer's TRAUMA table). */
export const MOMENT_TRAUMA = { bladeArt: 0.3, finale: 0.34, giantStrike: 0.3, abilityBlast: 0.24 };

/**
 * Which sim events are big moments that jolt the camera once (≥ the renderer's art gap apart):
 * Kaede's maple storm / shockwave, Marumi's Glow Bowl finale (the blast after the last bounce) and
 * her Giant Strike as it starts. Marumi's ordinary blasts never shake (the camera shakes only for
 * big hits), and neither does an explosion one of her balls set off.
 * @returns {number} trauma 0..1 (0 = no jolt)
 */
export function momentTrauma(ev) {
  if (ev.type === 'bladeArt' && (ev.storm > 0 || ev.wave > 0)) return MOMENT_TRAUMA.bladeArt;
  if (ev.type === 'ballPop' && ev.fin) return MOMENT_TRAUMA.finale;
  if (ev.type === 'runner' && ev.kind === 'giantBall') return MOMENT_TRAUMA.giantStrike;
  return 0;
}

/**
 * Who set off a sim 'explode' (events[j]), read from the event and its neighbours:
 *   'enemy'    a volatile monster's death blast: no girl owns it
 *   'ability'  a girl's ability blast (the sim emits its 'abilityShell' right before it)
 *   'girl'     any other blast: her ball (towerUid), her splash shot or shell, her charged strip.
 * Every non-volatile blast the sim emits is a girl's, so this needs no projectile bookkeeping and
 * holds on every graphics tier.
 * @param {object[]} events @param {number} j
 * @returns {'enemy'|'ability'|'girl'}
 */
export function explodeSource(events, j) {
  const ev = events[j];
  if (ev.volatile) return 'enemy';
  if (ev.towerUid != null) return 'girl';
  const pv = events[j - 1];
  if (pv && pv.type === 'abilityShell' && pv.x === ev.x && pv.y === ev.y) return 'ability';
  return 'girl';
}

/**
 * Does a sim 'explode' shake the camera on its own? Only a big blast no girl owns (a volatile
 * monster's): a girl's basic splash never shakes (a basic hit is tier 1: no shake), however big, and
 * her ability blasts get one jolt through MOMENT_TRAUMA.abilityBlast instead (≥ the art gap apart).
 * @param {{ radius: number }} ev @param {number} minRadius @param {'enemy'|'ability'|'girl'} source explodeSource
 */
export function explodeShakes(ev, minRadius, source) {
  return source === 'enemy' && ev.radius >= minRadius;
}

/** A girl's ability blast jolts once when it is big (radius ≥ minRadius): its trauma, else 0. */
export function abilityBlastTrauma(ev, minRadius, source) {
  return source === 'ability' && ev.radius >= minRadius ? MOMENT_TRAUMA.abilityBlast : 0;
}

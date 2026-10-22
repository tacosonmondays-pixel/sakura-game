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
     * @returns {number} seconds granted (0 = none); the caller holds that enemy's look
     */
    hold(uid, cls, frames) {
      if (!o.holds || !(frames > 0) || !cfg().hold.has(cls)) return 0;
      const s = o.holds.request(uid, frames);
      if (s > 0) stats.holds++;
      return s;
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
        // the board comes back under a short, soft tint of the moment's colour (part of the same impact)
        afterglow = { color: fc.color, a: Math.min(fc.red ? 0.15 : 0.25, o.guard.cap), decay: 1.9 };
        stats.impacts++;
        return true;
      }
      stats.impactsRefused++;
      stats.softTints++;
      feel.flash(color, o.reduceMotion ? 0.5 : 0.45, o.reduceMotion ? 1.2 : 1.8);
      return false;
    },

    /** After the last impact frame: the tint the board comes back under (once). */
    takeAfterglow() {
      const a = afterglow;
      afterglow = null;
      return a;
    },
  };
  return feel;
}

/** Camera trauma (0..1) for the big moments the attack-FX layer draws (the renderer's TRAUMA table). */
export const MOMENT_TRAUMA = { bladeArt: 0.3, finale: 0.34, giantStrike: 0.3 };

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

/** Does a sim 'explode' shake the camera on its own? Big blasts that no girl's own moment covers. */
export function explodeShakes(ev, minRadius) {
  return ev.towerUid == null && ev.radius >= minRadius;
}

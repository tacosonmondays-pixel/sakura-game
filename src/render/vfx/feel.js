// Hit feel (docs/VFX.md §M1): the one place that decides, for the battle renderer, whether a big
// moment gets a camera shake, a zoom punch, a hit-stop, impact frames or a screen flash — and how
// soft — from Reduce Motion, the Hit effects setting, a girl being placed and the flash budget.
// Kept free of WebGL so the rules are tested in node (tests/render/vfx-m1.test.js).
//
//   Reduce Motion      no shake, no zoom punch, no hit-stop, no impact frames; flashes ≤ 0.2 opacity
//                      and slower (an impact becomes a soft tint)
//   Hit effects off    no hit-stop, no impact frames (an impact becomes a soft tint); shake stays
//   placing a girl     the camera holds still: no shake, no punch

/**
 * @param {{
 *   reduceMotion: boolean, hitEffects: () => boolean, placing: () => boolean, now: () => number,
 *   guard: import('./flashGuard.js').FlashGuard, director: import('./hitStop.js').HitStopDirector,
 *   rig: { kick(t: number): void, punch(a: number, s: number): void },
 *   impact: { active: boolean, start(color: string): void },
 *   tint: (color: string, opacity: number, decay: number) => void,
 * }} o
 */
export function createHitFeel(o) {
  const stats = { impacts: 0, impactsRefused: 0, softTints: 0, shakes: 0, punches: 0 };
  let afterglow = null;

  const feel = {
    stats,

    /** Camera shake, trauma 0..1. */
    shake(trauma) {
      if (o.reduceMotion || o.placing() || !(trauma > 0)) return false;
      o.rig.kick(trauma);
      stats.shakes++;
      return true;
    },

    /** Zoom punch [amount, seconds]. */
    punch([amount, seconds]) {
      if (o.reduceMotion || o.placing() || !(amount > 0)) return false;
      o.rig.punch(amount, seconds);
      stats.punches++;
      return true;
    },

    /** A full-screen flash through the flash guard. @returns {number} the opacity drawn */
    flash(color, strength = 0.75, decay = 2.5) {
      let s = strength;
      let d = decay;
      if (o.reduceMotion) {
        s *= 0.35;
        d = Math.min(d, 1.6); // and slower: no sudden change
      }
      const a = o.guard.flash(s, o.now());
      if (a > 0) o.tint(color, a, d);
      return a;
    },

    /** Hit-stop of a kind (src/render/vfx/hitStop.js); the director reads the setting itself. */
    hitStop(kind) {
      return o.director.request(kind);
    },

    /**
     * A hero ult or a boss kill: impact frames + a hit-stop when allowed, else a soft tint.
     * @returns {boolean} the impact frames run
     */
    impact(color) {
      if (!o.reduceMotion && o.hitEffects() && !o.impact.active && o.guard.impact(o.now())) {
        o.impact.start(color);
        o.director.request('impact');
        // the board comes back under a short tint of the moment's colour (part of the same impact)
        afterglow = { color, a: Math.min(0.4, o.guard.cap), decay: 1.9 };
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

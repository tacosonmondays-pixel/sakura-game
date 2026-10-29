// HAMMER's tear (Gate Arc 3-10 "The Tear", GATE_ARC §18.4, STEP3_BUILD_PLAN decision 8), render only.
//
// A board whose decor carries a `hammerTear` (src/render/city/ruinProps.js) shows the jagged
// black-violet seam over the burning sanctum. It pulses with the stage's map rule through the same
// `ruleState` routing as the blackout (src/render/blackout.js): while the sim says the rule is ACTIVE
// the tear's level eases up from 0 to 1 over TEAR.ease seconds and back down after, and while it is
// up the seam throbs. The battle renderer applies `glow()` to the tear's glow geometry
// (terrain.setTear: a uniform) and `level` to the ambient layer (the tear's glow sprites and the
// sparks crackling off it). Nothing else changes: no dimming of the board, the road, the enemies or
// the gates. Scalars only: no allocation per frame.

/** The tear glow's brightness at rest (the seam is always there, a little dim). */
export const TEAR_REST = 0.6;

export const TEAR = Object.freeze({
  /** Glow scale at full pulse (the throb rides on top of it). */
  peak: 1.5,
  /** Throb depth while the rule is active (± of the glow scale). */
  throb: 0.35,
  /** Throb speed (radians per second). */
  speed: 5.2,
  /** Seconds from rest to full pulse (and back). */
  ease: 0.5,
});

/**
 * @param {{ enabled?: boolean }} [o] enabled: the board carries a tear (terrain.tear) and the stage has a rule
 * @returns {{ enabled: boolean, active: boolean, level: number, time: number, handle(ev: object): void, step(dt: number): boolean, glow(): number }}
 */
export function createTear({ enabled = false } = {}) {
  const rate = 1 / TEAR.ease;
  return {
    enabled: !!enabled,
    /** Is the rule active (the tear pulsing) right now? */
    active: false,
    /** Pulse level: 0 at rest … 1 while the rule is active. */
    level: 0,
    /** Seconds the tear has run (drives the throb). */
    time: 0,
    /** Reads one sim event: `ruleState` starts and stops the pulse (others are ignored). */
    handle(ev) {
      if (!this.enabled || !ev || ev.type !== 'ruleState') return;
      this.active = !!ev.active;
    },
    /**
     * Eases the level and advances the throb. @returns {boolean} true when the glow changed (apply it then).
     * @param {number} dt seconds
     */
    step(dt) {
      if (!this.enabled) return false;
      const d = Math.max(0, dt || 0);
      const target = this.active ? 1 : 0;
      const before = this.level;
      if (this.level !== target) {
        const k = rate * d;
        this.level = Math.abs(target - this.level) <= k ? target : this.level + Math.sign(target - this.level) * k;
      }
      if (this.level > 0) this.time += d;
      return this.level > 0 || before !== this.level;
    },
    /** The tear's glow scale now (TEAR_REST at rest; up to TEAR.peak ± TEAR.throb while it pulses). */
    glow() {
      const throb = Math.sin(this.time * TEAR.speed) * TEAR.throb * this.level;
      return TEAR_REST + (TEAR.peak - TEAR_REST) * this.level + throb;
    },
  };
}

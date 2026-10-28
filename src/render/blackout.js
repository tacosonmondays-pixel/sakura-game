// Blackout dimming (Gate Arc, GATE_ARC §17 2-7 "Lights out", STEP2_BUILD_PLAN §2.2), render only.
//
// A stage opts in with its render-only look (StageDef.look.blackout: true). While the sim's
// `ruleState` events say the stage's map rule is ACTIVE, the dim level eases from 1 down to
// BLACKOUT.floor over BLACKOUT.ease seconds and back up after: the battle renderer applies it to
// the terrain's glow geometry and lit windows (terrain.setDim), the glow sprites and the warm
// light pools (AmbientSystem.dim) and the hemisphere light (hemiScale: ≈ 60 % at the floor).
// Enemies, girls, the road, the gates and the HUD are never touched, so the column, the road (the
// lightest band) and every gate stay readable in the dark. Stages without the flag never dim (the
// Act I lunar_eclipse stages look exactly as before). Scalars only: no allocation per frame.

export const BLACKOUT = Object.freeze({
  /** Glow, window and light-pool level at full blackout. */
  floor: 0.25,
  /** Hemisphere light level at full blackout. */
  hemiFloor: 0.6,
  /** Seconds from lit to dark (and back). */
  ease: 0.4,
});

/**
 * @param {{ enabled?: boolean }} [o] enabled: the stage's look.blackout
 * @returns {{ enabled: boolean, active: boolean, dim: number, handle(ev: object): void, step(dt: number): boolean, hemiScale(): number }}
 */
export function createBlackout({ enabled = false } = {}) {
  const rate = (1 - BLACKOUT.floor) / BLACKOUT.ease;
  return {
    enabled: !!enabled,
    /** Is the rule active (the lights out) right now? */
    active: false,
    /** Current dim level (1 = lit … BLACKOUT.floor = dark). */
    dim: 1,
    /** Reads one sim event: `ruleState` turns the blackout on and off (others are ignored). */
    handle(ev) {
      if (!this.enabled || !ev || ev.type !== 'ruleState') return;
      this.active = !!ev.active;
    },
    /**
     * Eases `dim` toward its target. @returns {boolean} true when it changed (apply it then).
     * @param {number} dt seconds
     */
    step(dt) {
      const target = this.enabled && this.active ? BLACKOUT.floor : 1;
      if (this.dim === target) return false;
      const d = rate * Math.max(0, dt || 0);
      this.dim = Math.abs(target - this.dim) <= d ? target : this.dim + Math.sign(target - this.dim) * d;
      return true;
    },
    /** The hemisphere light's factor for the current dim (1 lit … BLACKOUT.hemiFloor dark). */
    hemiScale() {
      const t = (1 - this.dim) / (1 - BLACKOUT.floor);
      return 1 - t * (1 - BLACKOUT.hemiFloor);
    },
  };
}

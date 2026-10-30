// The battle renderer's one visual clock (docs/VFX.md). Every render-side animation and effect
// takes its time from here (never from performance.now() or a clock of its own), so a hit-stop
// can hold everything that is drawn while the battle itself keeps running.
//
// Three timelines, all in seconds:
//   dt / t            visual time: the frame's time minus any hit-stop, times any slow motion.
//                     Effects, bodies, shake, terrain shaders and attack FX run on it.
//   frameDt / frameT  the frame time the battle handed the renderer (0 while the game is paused):
//                     board feedback that must not wait out a hit-stop (placement ghost, rings).
//   realDt / realT    wall time; it runs while the game is paused too (the info-panel slide).
//
// The sim never reads this clock, and nothing here reads the sim: a freeze or a slow motion only
// changes what is drawn. A freeze lasts at most MAX_FREEZE (60 ms) however often hits ask for one,
// the next one waits FREEZE_GAP, and with Reduce Motion there is none at all.

/** Longest hit-stop (s). */
export const MAX_FREEZE = 0.06;
/** Frame time that must pass after a hit-stop before the next one may start (s). */
export const FREEZE_GAP = 0.25;
/** Longest frame step the clock accepts (s): a hitch never fast-forwards the visuals. */
export const MAX_FRAME = 0.1;
/** Slowest slow motion (visual seconds per frame second). */
export const MIN_SLOW = 0.1;
/** Longest slow motion (frame seconds). */
export const MAX_SLOW = 1.2;

const clamp = (v, lo, hi) => (v > lo ? (v < hi ? v : hi) : lo);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export class VisualClock {
  /** @param {{ reduceMotion?: boolean }} [opts] reduceMotion: hit-stop requests are ignored */
  constructor({ reduceMotion = false } = {}) {
    this.reduceMotion = !!reduceMotion;
    this.reset();
  }

  /** Back to zero on every timeline; any freeze or slow motion ends. */
  reset() {
    this.t = 0;
    this.dt = 0;
    this.frameT = 0;
    this.frameDt = 0;
    this.realT = 0;
    this.realDt = 0;
    this.frame = 0;
    this.freezeLeft = 0;
    this.freezeUsed = 0;
    this.gapLeft = 0;
    this.slowLeft = 0;
    this.slowScale = 1;
    this._lastMs = null;
  }

  /**
   * Advances the clock once per rendered frame.
   * @param {number} frameDt seconds the battle advanced this frame (0 while paused)
   * @param {number|null} [nowMs] wall clock in ms (performance.now()); without it real time = frame time
   * @returns {number} this frame's visual dt
   */
  tick(frameDt, nowMs = null) {
    const f = clamp(num(frameDt), 0, MAX_FRAME);
    this.frameDt = f;
    this.frameT += f;
    if (typeof nowMs === 'number' && Number.isFinite(nowMs)) {
      this.realDt = this._lastMs == null ? 0 : clamp((nowMs - this._lastMs) / 1000, 0, MAX_FRAME);
      this._lastMs = nowMs;
    } else {
      this.realDt = f;
    }
    this.realT += this.realDt;

    let v = f;
    // hit-stop eats frame time (a paused game keeps its freeze for when it resumes)
    if (this.freezeLeft > 0 && v > 0) {
      const eat = Math.min(this.freezeLeft, v);
      this.freezeLeft -= eat;
      v -= eat;
      if (this.freezeLeft <= 1e-9) {
        this.freezeLeft = 0;
        this.freezeUsed = 0;
        this.gapLeft = FREEZE_GAP;
      }
    } else if (this.gapLeft > 0) {
      this.gapLeft = Math.max(0, this.gapLeft - f);
    }
    // slow motion: the frame time it spans runs at slowScale
    if (this.slowLeft > 0 && v > 0) {
      const span = Math.min(this.slowLeft, v);
      this.slowLeft -= span;
      v += span * (this.slowScale - 1);
      if (this.slowLeft <= 1e-9) {
        this.slowLeft = 0;
        this.slowScale = 1;
      }
    }
    this.dt = v;
    this.t += v;
    this.frame++;
    return v;
  }

  /**
   * Hit-stop: holds the visuals for `seconds` of frame time (capped so one freeze never passes
   * MAX_FREEZE in total, even when every hit of a frame asks). Ignored with Reduce Motion and
   * during the gap after the last freeze.
   * @param {number} seconds
   * @returns {number} the freeze left after the request (0 = refused)
   */
  hitStop(seconds) {
    const s = clamp(num(seconds), 0, MAX_FREEZE);
    if (this.reduceMotion || s <= 0) return this.freezeLeft;
    if (this.freezeLeft <= 0 && this.gapLeft > 0) return 0;
    // a running freeze may grow, but never past MAX_FREEZE from its start
    const already = this.freezeUsed - this.freezeLeft; // frame time it has held so far
    const room = Math.max(0, MAX_FREEZE - already);
    const want = Math.min(room, Math.max(this.freezeLeft, s));
    if (want > this.freezeLeft) {
      this.freezeUsed += want - this.freezeLeft;
      this.freezeLeft = want;
    }
    return this.freezeLeft;
  }

  /**
   * Slow motion: for `seconds` of frame time (≤ MAX_SLOW) the visuals run at `scale`
   * (MIN_SLOW..1). A new request replaces the running one.
   * @returns {number} the scale in force
   */
  slowMo(scale, seconds) {
    const d = clamp(num(seconds), 0, MAX_SLOW);
    if (d <= 0) return this.slowScale;
    this.slowScale = clamp(typeof scale === 'number' && Number.isFinite(scale) ? scale : 1, MIN_SLOW, 1);
    this.slowLeft = this.slowScale < 1 ? d : 0;
    return this.slowScale;
  }

  /** Is a hit-stop holding the visuals? */
  get frozen() {
    return this.freezeLeft > 0;
  }

  /** Read-only state (e2e, captures, debugging). */
  snapshot() {
    const r = (x) => Math.round(x * 1e6) / 1e6;
    return {
      t: r(this.t), dt: r(this.dt), frameT: r(this.frameT), frameDt: r(this.frameDt), realT: r(this.realT), realDt: r(this.realDt),
      frame: this.frame, freezeLeft: r(this.freezeLeft), slowLeft: r(this.slowLeft), slowScale: this.slowScale, reduceMotion: this.reduceMotion,
    };
  }
}

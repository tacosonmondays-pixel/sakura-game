// Local holds (docs/VFX.md "Hits that land"): a heavy hit or a crit holds ONLY the struck enemy's
// look — its pose, place, squash and flash — for 2-4 frames with a tiny sideways jitter, then it
// catches up within a frame or two. The board, the sim and every other enemy carry on: this is the
// "freeze the struck, not the world" rule. (The global freeze, src/render/vfx/hitStop.js, is only
// for ult impacts and boss kills.)
//
// Rate limits, so a wave gets a few of these and never a stutter:
//   - at most LOCAL_HOLD.perSecond new holds in any second of frame time (busyPerSecond when the
//     fight is busy: > BUSY_HITS hits a second), at most perFrame in one frame;
//   - the same enemy holds again only enemyGap after its last hold started;
//   - Reduce Motion or Flashes & shake off: none. Which classes a graphics tier allows is decided
//     in src/render/vfx/feel.js.

export const LOCAL_HOLD = {
  maxFrames: 4,
  perSecond: 3,
  busyPerSecond: 1,
  perFrame: 2,
  enemyGap: 0.6,
  /** sideways jitter while held (world units) */
  jitter: 0.025,
};

export class LocalHoldDirector {
  /**
   * @param {import('./clock.js').VisualClock} clock
   * @param {{ enabled?: () => boolean, busy?: () => boolean, frame?: number }} [o]
   *   enabled: the Flashes & shake setting (read live); busy: the fight is busy (HitStopDirector.busy);
   *   frame: seconds per held frame (1/60)
   */
  constructor(clock, { enabled = () => true, busy = () => false, frame = 1 / 60 } = {}) {
    this.clock = clock;
    this.enabled = enabled;
    this.busy = busy;
    this.frame = frame;
    this.starts = []; // frame times of the holds started in the last second
    this.byEnemy = new Map(); // uid → frame time its last hold started
    this.frameT = -1;
    this.inFrame = 0;
    this.granted = 0;
    this.refused = 0;
  }

  _prune(t) {
    const s = this.starts;
    let k = 0;
    while (k < s.length && s[k] <= t - 1) k++;
    if (k) s.splice(0, k);
    if (this.byEnemy.size > 96) {
      for (const [uid, at] of this.byEnemy) if (t - at > LOCAL_HOLD.enemyGap) this.byEnemy.delete(uid);
    }
  }

  /**
   * Asks to hold enemy `uid` for `frames` frames (capped at LOCAL_HOLD.maxFrames).
   * @returns {number} seconds of hold granted (0 = refused)
   */
  request(uid, frames) {
    const n = Math.min(LOCAL_HOLD.maxFrames, Math.max(0, Math.floor(frames || 0)));
    if (!n || this.clock.reduceMotion || !this.enabled()) return this._no();
    const t = this.clock.frameT;
    if (t !== this.frameT) {
      this.frameT = t;
      this.inFrame = 0;
    }
    this._prune(t);
    const cap = this.busy() ? LOCAL_HOLD.busyPerSecond : LOCAL_HOLD.perSecond;
    if (this.inFrame >= LOCAL_HOLD.perFrame || this.starts.length >= cap) return this._no();
    const last = this.byEnemy.get(uid);
    if (last != null && t - last < LOCAL_HOLD.enemyGap) return this._no();
    this.starts.push(t);
    this.byEnemy.set(uid, t);
    this.inFrame++;
    this.granted++;
    return n * this.frame;
  }

  _no() {
    this.refused++;
    return 0;
  }
}

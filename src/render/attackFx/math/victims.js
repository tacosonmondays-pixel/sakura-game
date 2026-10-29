// Hit attribution (pure). The sim's `hit` events carry no tower uid, so area girls (pulse,
// hitscan) find "their" victims by reading the hits emitted just before their own event:
// within one tower update the sim emits  hits → pulse/beam/chain → attack.

/** Events the sim may interleave between a tower's hits (on-hit side effects). */
const SKIP = { status: true, death: true, barrierBreak: true, shellBreak: true, split: true, bossPhase: true, phase: true };

/**
 * Collects the uids of enemies hit by the tower event at `events[i]` (newest first).
 * Walks back over contiguous `hit` events (skipping on-hit side effects) and keeps the ones
 * with the same attack type inside the circle (cx, cy, radius + 0.6).
 * @param {object[]} events this frame's sim events
 * @param {number} i index of the pulse / attack event
 * @param {number[]} out reused output array
 * @returns {number[]} out
 */
export function victimsFor(events, i, cx, cy, radius, attackType, max, out) {
  out.length = 0;
  const r = radius + 0.6;
  const r2 = r * r;
  for (let j = i - 1; j >= 0; j--) {
    const e = events[j];
    if (SKIP[e.type]) continue;
    if (e.tick) continue; // (a constant beam's damage tick: no other girl's victim)
    if (e.type !== 'hit') break;
    if (attackType && e.attackType !== attackType) continue;
    const dx = e.x - cx;
    const dy = e.y - cy;
    if (dx * dx + dy * dy > r2) continue;
    if (out.indexOf(e.uid) < 0) {
      out.push(e.uid);
      if (out.length >= max) break;
    }
  }
  return out;
}

/** Same walk, also returning the hit positions (x, y pairs into `pos`). */
export function victimHits(events, i, cx, cy, radius, attackType, max, out, pos) {
  victimsFor(events, i, cx, cy, radius, attackType, max, out);
  pos.length = 0;
  for (let k = 0; k < out.length; k++) {
    for (let j = i - 1; j >= 0; j--) {
      const e = events[j];
      if (e.type === 'hit' && e.uid === out[k]) {
        pos.push(e.x, e.y);
        break;
      }
    }
  }
  return out;
}

/**
 * Fixed-size ring of this frame's hit / explode events (no allocation after construction).
 * Overflow drops the oldest.
 */
export class EventRing {
  constructor(size = 64) {
    this.size = size;
    this.uid = new Float64Array(size);
    this.x = new Float64Array(size);
    this.y = new Float64Array(size);
    this.r = new Float64Array(size);
    this.crit = new Uint8Array(size);
    this.used = new Uint8Array(size);
    this.n = 0;
    this.head = 0;
  }

  clear() {
    this.n = 0;
    this.head = 0;
  }

  push(uid, x, y, r, crit) {
    const i = this.head;
    this.uid[i] = uid ?? -1;
    this.x[i] = x;
    this.y[i] = y;
    this.r[i] = r || 0;
    this.crit[i] = crit ? 1 : 0;
    this.used[i] = 0;
    this.head = (i + 1) % this.size;
    if (this.n < this.size) this.n++;
  }

  /** Index of slot k (0 = oldest kept). */
  slot(k) {
    return (this.head - this.n + k + this.size) % this.size;
  }
}

/**
 * Finds the sim event that resolved a vanished projectile (§3.6.3).
 * Splash projectiles match the nearest `explode`; others the hit on their target uid, else the
 * nearest hit — both within `tol` of the last drawn sim position. Each event is matched once.
 * @returns {number} ring slot index or -1
 */
export function matchImpact(ring, lastX, lastY, targetUid, tol) {
  const t2 = tol * tol;
  let best = -1;
  let bestD = t2;
  for (let k = 0; k < ring.n; k++) {
    const i = ring.slot(k);
    if (ring.used[i]) continue;
    const dx = ring.x[i] - lastX;
    const dy = ring.y[i] - lastY;
    const d2 = dx * dx + dy * dy;
    if (targetUid != null && ring.uid[i] === targetUid && d2 <= t2) return i;
    if (d2 <= bestD) {
      bestD = d2;
      best = i;
    }
  }
  return best;
}

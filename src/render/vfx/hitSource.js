// Who dealt a sim 'hit'? (docs/VFX.md "Hits that land"). The hit event names only the enemy, so
// the renderer works it out from what it can see, to pick the hitting girl's impact preset
// (src/render/vfx/impactPresets.js). Read-only: it never writes to the sim, and a wrong or missing
// answer only means the 'normal' preset.
//
//   1. a projectile that landed on the struck enemy since the last frame: one aimed at it that
//      vanished, or one that went through it (its hit list names it: piercing shots, pins, blades);
//   2. else the attack event that follows its hits in the same step: instant attacks (pulses,
//      beams, chains, slashes, towel snaps), a hitscan shot naming the struck enemy (Shiro), a
//      girl's own blasts (Marumi's explode / pins / ballPop), strip bites (trapTriggered), shells
//      (explode → shellLand), blade arts…;
//   3. a projectile's splash (an explode with no girl named): the vanished projectile nearest it.
//
// Cost: one pass over the live projectiles a frame and one over the ones it tracks, with nothing
// allocated per projectile per frame: each tracked projectile has a small record (pooled, reused
// when it lands) stamped with the frame it was last seen; the records are walked with a callback
// bound once (Map.forEach, no iterator or [key, value] pairs). The event scan runs only for the hits
// that could land hard (the renderer asks), and the renderer skips all of it while no hit can hold
// its enemy (Low, Reduce Motion, Flashes & shake off).

/** Events that may sit between a hit and the attack that dealt it. */
const SKIP = new Set(['hit', 'status', 'death', 'barrierBreak', 'shellBreak', 'split', 'cash', 'dotSpread', 'spawn', 'phase', 'curseBurst']);
/** Events emitted right after the hits they dealt, naming the girl (towerUid / ownerUid). */
const OWNER = new Set(['pulse', 'beam', 'chain', 'pins', 'ballPop', 'trapTriggered', 'bladeArt', 'nova', 'shellLand', 'netCatch', 'vine', 'proc', 'tempo', 'clubTrick']);
/** 'attack' kinds emitted right after their hits (the rest are emitted when a shot is fired). */
const INSTANT = new Set(['slash', 'towel', 'pulse', 'beam', 'chain']);
/** How far a projectile's last seen spot may be from its splash (tiles). */
const SPLASH_REACH = 1.2;

export class HitSource {
  constructor() {
    /** uid → { p: the projectile, n: its hit-list length when last seen, seen: frame stamp } */
    this.live = new Map();
    this.pool = []; // spare records
    this.made = 0; // records ever made (tests: they are reused, not made per frame)
    this.stamp = 0;
    this.gone = []; // projectiles seen last frame and gone now (their hits are this frame's)
    this.pierced = []; // live projectiles whose hit list grew since the last frame
    this._sweep = (rec, uid) => {
      if (rec.seen === this.stamp) return;
      this.gone.push(rec.p);
      rec.p = null;
      this.live.delete(uid);
      this.pool.push(rec);
    };
  }

  /** Once a frame, before the frame's events: which projectiles landed since the last frame. */
  frame(projectiles) {
    const stamp = ++this.stamp;
    const live = this.live;
    const pierced = this.pierced;
    pierced.length = 0;
    this.gone.length = 0;
    if (projectiles) {
      for (let i = 0; i < projectiles.length; i++) {
        const p = projectiles[i];
        const n = Array.isArray(p.hits) ? p.hits.length : 0;
        let rec = live.get(p.uid);
        if (!rec) {
          rec = this.pool.pop() || this._make();
          rec.n = 0;
          live.set(p.uid, rec);
        }
        if (n > rec.n) pierced.push(p);
        rec.p = p;
        rec.n = n;
        rec.seen = stamp;
      }
    }
    // the ones not seen this frame landed (or left): their hits are this frame's
    live.forEach(this._sweep);
  }

  _make() {
    this.made++;
    return { p: null, n: 0, seen: 0 };
  }

  /**
   * The uid of the girl who dealt events[i] (a 'hit'), or null when it cannot be told.
   * @param {object[]} events this frame's sim events @param {number} i
   */
  owner(events, i) {
    const ev = events[i];
    const gone = this.gone;
    for (let k = 0; k < gone.length; k++) {
      const p = gone[k];
      if ((p.target && p.target.uid === ev.uid) || (Array.isArray(p.hits) && p.hits.includes(ev.uid))) return p.ownerUid ?? null;
    }
    const pierced = this.pierced;
    for (let k = 0; k < pierced.length; k++) {
      const p = pierced[k];
      if (p.hits.includes(ev.uid)) return p.ownerUid ?? null;
    }
    for (let j = i + 1; j < events.length; j++) {
      const e = events[j];
      if (SKIP.has(e.type)) continue;
      if (e.type === 'explode') {
        if (e.towerUid != null) return e.towerUid;
        const nx = events[j + 1];
        if (nx && nx.type === 'shellLand') return nx.towerUid ?? null;
        return this._nearestGone(e.x, e.y);
      }
      if (OWNER.has(e.type)) return e.towerUid ?? e.ownerUid ?? null;
      // instant attacks follow their hits; so does a hitscan shot (no projectile in flight: Shiro's
      // rifle), whose attack event names the enemy it struck
      if (e.type === 'attack' && (INSTANT.has(e.kind) || (e.targetUid != null && e.targetUid === ev.uid))) return e.towerUid ?? null;
      return null;
    }
    return null;
  }

  _nearestGone(x, y) {
    let best = null;
    let bestD = SPLASH_REACH * SPLASH_REACH;
    for (let k = 0; k < this.gone.length; k++) {
      const p = this.gone[k];
      const dx = p.x - x;
      const dy = p.y - y;
      const d = dx * dx + dy * dy;
      if (d <= bestD) {
        bestD = d;
        best = p.ownerUid ?? null;
      }
    }
    return best;
  }

  /** Forgets every tracked projectile (a new battle, or holds becoming possible again). */
  clear() {
    this.live.forEach((rec) => {
      rec.p = null;
      this.pool.push(rec);
    });
    this.live.clear();
    this.gone.length = 0;
    this.pierced.length = 0;
  }
}

// Placed objects and thrown props (FX-1, docs/ATTACK_FX.md "Placed objects and thrown props"): real
// code-built models for Marumi's balls, Azami's spike strips and Yuzuha's sentries and nets, in place of
// the flat discs and dashed rings, plus the projectile kit's thrown props (the hand-to-sim hand-off).
//
// Display only. It reads the sim's state and drained events (read-only, like every attack-FX layer)
// and draws; the sim never waits for it. Owned by the attack-FX layer (src/render/attackFx/index.js):
//   placed.onEvent(ev, i, events)   observes every event (never consumes one)
//   placed.update(gdt)              once a frame, game time (the attack-FX clock)
//   placed.muzzleFor(turretUid, rec) a sentry's bullet leaves its barrel
// With attack FX off (settings.attackFx === false) none of this exists and actors.js draws the old
// marks. Budgets: every part type is one instanced mesh (two with its outline on High / Medium), drawn
// only while it has an instance; only the instances that moved this frame are uploaded.
import * as THREE from 'three';
import { PartSet } from './parts.js';
import { Flights } from './flights.js';
import { Ribbons } from './ribbons.js';
import { Balls } from './balls.js';
import { Strips } from './strips.js';
import { Sentries } from './sentries.js';

const DUST = new THREE.Color('#d9c9ae');
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class PlacedLayer {
  /** @param {object} ctx attack-FX context @param {THREE.Object3D} parent (actors.root: impact frames see it) */
  constructor(ctx, parent) {
    this.ctx = ctx;
    this.sim = ctx.sim;
    this.group = new THREE.Group();
    this.group.name = 'placed';
    parent.add(this.group);
    this.parts = new PartSet(this.group, { quality: ctx.quality });
    this.flights = new Flights(ctx, this.parts);
    this.ribbons = new Ribbons(ctx);
    this.balls = new Balls(this);
    this.strips = new Strips(this);
    this.sentries = new Sentries(this);
    this.ms = 0;
    this.msFrame = 0;
    this.disposed = false;
  }

  /** 'full' | 'static' (Low: no unfold, wobble or jab) | 'calm' (Reduce Motion: fades, no travel). */
  motion() {
    if (this.ctx.reduceMotion) return 'calm';
    return this.ctx.quality === 'low' ? 'static' : 'full';
  }

  /**
   * The road point nearest (x, y) on any path and the road's direction there. Writes out.x / out.y
   * (the point) and out.dx / out.dy (unit direction). Display helper over the sim's path data.
   */
  roadNear(x, y, out) {
    const paths = this.sim.pathData || [];
    let best = Infinity;
    out.x = x;
    out.y = y;
    out.dx = 1;
    out.dy = 0;
    for (const path of paths) {
      const pts = path.points;
      const dirs = path.dirs;
      if (!pts || !dirs) continue;
      for (let i = 0; i < pts.length - 1; i++) {
        const ax = pts[i][0];
        const ay = pts[i][1];
        const ex = pts[i + 1][0] - ax;
        const ey = pts[i + 1][1] - ay;
        const len2 = ex * ex + ey * ey;
        let k = len2 > 0 ? ((x - ax) * ex + (y - ay) * ey) / len2 : 0;
        k = k < 0 ? 0 : k > 1 ? 1 : k;
        const px = ax + ex * k;
        const py = ay + ey * k;
        const d = (px - x) * (px - x) + (py - y) * (py - y);
        if (d < best) {
          best = d;
          out.x = px;
          out.y = py;
          out.dx = dirs[i][0];
          out.dy = dirs[i][1];
        }
      }
    }
    return out;
  }

  /** (Its time is counted by the attack-FX layer's own onEvent timer: no clock reads per event here.) */
  onEvent(ev, i, events) {
    if (this.disposed) return;
    // a sentry's 'deploy' event arrives with its type field set to the sentry's type (the sim's
    // payload carries `type: 'plain' | 'net' | …`, which overwrites the event name): know it by its kind
    if (ev.kind === 'sentry' && ev.uid != null && ev.towerUid != null && ev.x != null) {
      this.sentries.onDeploy(ev);
      return;
    }
    switch (ev.type) {
      case 'ball':
      case 'ballPop':
      case 'pins':
      case 'ballEnd':
        this.balls.onEvent(ev);
        break;
      case 'trapPlaced':
      case 'trapTriggered':
        this.strips.onEvent(ev, i, events);
        break;
      case 'deploy':
      case 'deployEnd':
      case 'netCatch':
        this.sentries.onEvent(ev);
        break;
      case 'attack':
        if (ev.turretUid != null) this.sentries.onEvent(ev);
        break;
      default:
        break;
    }
  }

  muzzleFor(turretUid, rec) {
    return this.sentries.muzzleFor(turretUid, rec);
  }

  update(gdt) {
    if (this.disposed) return;
    const t0 = now();
    this.flights.update(gdt);
    this.balls.update(gdt);
    this.strips.update(gdt);
    this.sentries.update(gdt);
    this.ribbons.update(DUST);
    this.parts.flush();
    // its frame work (its events are timed inside the attack-FX layer's event time)
    this.msFrame = now() - t0;
  }

  setQuality(q) {
    this.parts.setQuality(q);
  }

  /** Counters for renderer.info.attackFx.placed (and the e2e / capture probes). */
  stats() {
    return {
      calls: this.parts.calls,
      instances: this.parts.instances,
      types: this.parts.parts.size,
      flights: this.flights.live.length,
      ribbons: this.ribbons.live,
      balls: this.balls.stats.balls,
      pins: this.balls.pins.length,
      lobs: this.balls.lobs.size,
      strips: this.strips.stats.strips,
      sentries: this.sentries.stats.sentries,
      nets: this.sentries.stats.nets,
      bundles: this.sentries.bundles.length,
      ms: this.msFrame,
    };
  }

  clear() {
    this.flights.clear();
    this.balls.clear();
    this.strips.clear();
    this.sentries.clear();
    this.ribbons.clear();
    this.parts.flush();
  }

  dispose() {
    if (this.disposed) return;
    this.clear();
    this.disposed = true;
    this.parts.dispose();
    this.group.removeFromParent();
  }
}

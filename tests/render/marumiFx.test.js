// Marumi's ricochet in the attack-FX layer (src/render/attackFx/styles/marumi.js): every blast of a
// ball pops (a flash, a ring, sparks toward the next walker) and the hooks never write to the sim
// (strict mode).
import { describe, it, expect } from 'vitest';
import { harness, gallerySim, streamer } from './attackFxHarness.js';

describe('Marumi ricochet FX', () => {
  it('ball pops draw without errors and never touch the sim', () => {
    const sim = gallerySim(['marumi'], [[2, 0, 5]]);
    expect(sim.placedIds).toEqual(['marumi']);
    const h = harness(sim, { strict: true });
    const feed = streamer(sim, 0.25, 400);
    let pops = 0;
    let turns = 0;
    let peak = 0;
    for (let i = 0; i < 1800; i++) {
      feed(1 / 30);
      h.frame(1 / 30, 1, (evs) => {
        for (const e of evs) {
          if (e.type !== 'ballPop') continue;
          pops++;
          if (e.tx != null) turns++;
        }
      });
      peak = Math.max(peak, h.fxa.stats().quads);
    }
    expect(pops).toBeGreaterThan(10);
    expect(turns).toBeGreaterThan(0); // the ball bounced on toward another walker
    expect(peak).toBeGreaterThan(0);
  });
});

// Kohaku's constant beam in the attack-FX layer (src/render/attackFx/styles/kohaku_tsubaki.js): drawn every frame
// from the sim's holds (t.prismBeams) and never written to them (strict mode: the hooks get frozen clones); one
// beam per held enemy, on across consecutive frames while it lives, gone soon after it dies; a gentle swell (none
// under reduced motion); a flat number of quads per beam.
import { describe, it, expect } from 'vitest';
import { harness, gallerySim, streamer } from './attackFxHarness.js';

const ID = 'kohaku_tsubaki';
const DT = 1 / 60;

function liveHolds(sim, t) {
  return (t.prismBeams || []).filter((b) => b.e && !b.e.dead).map((b) => b.e.uid);
}

describe('Kohaku\'s constant beam FX', () => {
  it('Grand Spectrum: a beam per held enemy on every frame, the same enemies as the sim, never touching the sim', () => {
    const sim = gallerySim([ID], [[0, 5, 2]]);
    expect(sim.placedIds).toEqual([ID]);
    const t = sim.towers.find((x) => x.unitId === ID);
    const h = harness(sim, { strict: true });
    const feed = streamer(sim, 0.3, 400);
    let run = 0;
    let longest = 0;
    let most = 0;
    let mismatched = 0;
    let checked = 0;
    const perBeam = [];
    for (let i = 0; i < 1800; i++) {
      feed(DT);
      h.frame(DT);
      const held = liveHolds(sim, t);
      const drawn = h.fxa.probe().styles[t.uid]?.beams || [];
      const steady = drawn.filter((b) => b.a >= 0.999);
      most = Math.max(most, steady.length);
      if (held.length && steady.length) run++;
      else run = 0;
      longest = Math.max(longest, run);
      // (a beam on a new lock fades in over ~5 frames, and the sim lets go up to one damage tick after a death)
      if (held.length && i > 0) {
        checked++;
        for (const b of steady) if (!held.includes(b.uid)) mismatched++;
      }
      if (drawn.length) perBeam.push((h.fxa.stats().quads - 1) / drawn.length);
    }
    expect(checked).toBeGreaterThan(300);
    expect(longest).toBeGreaterThan(120); // on for 2 s and more, frame after frame
    expect(most).toBeGreaterThanOrEqual(3);
    expect(mismatched).toBe(0);
    // flat cost: 4 quads a beam (glow, core, tail, impact glow) and one on her prism, however many beams
    expect(perBeam.length).toBeGreaterThan(0);
    expect(Math.max(...perBeam)).toBeLessThanOrEqual(5);
  });

  it('a beam stays on while its enemy lives and fades out within a few frames of its death', () => {
    const sim = gallerySim([ID], [[0, 2, 0]]);
    const t = sim.towers.find((x) => x.unitId === ID);
    const h = harness(sim, { strict: true });
    sim._spawnQueue = [{ t: 1e9, enemyId: 'slime_green' }];
    sim._spawnIndex = 0;
    for (const e of sim.enemies) e.dead = true;
    // a parked enemy on the road beside her
    let best = null;
    for (let d = 0; d < 60; d += 0.1) {
      const e = sim.spawnEnemy('slime_green', { dist: d, pathIndex: 0, hpMul: 1e5 });
      const r = Math.hypot(e.x - t.x, e.y - t.y);
      if (!best || r < best.r) best = { d, r };
      e.dead = true;
    }
    for (let i = 0; i < 3; i++) h.frame(DT);
    const e = sim.spawnEnemy('slime_green', { dist: best.d, pathIndex: 0, hpMul: 1e5 });
    e.baseSpeed = 0;
    let on = 0;
    for (let i = 0; i < 120; i++) {
      h.frame(DT);
      const drawn = h.fxa.probe().styles[t.uid]?.beams || [];
      if (i >= 8) {
        expect(drawn.map((b) => b.uid), `frame ${i}`).toEqual([e.uid]);
        expect(drawn[0].a).toBe(1);
        on++;
      }
    }
    expect(on).toBe(112);
    e.hp = 0.001;
    let gone = -1;
    for (let i = 0; i < 40 && gone < 0; i++) {
      h.frame(DT);
      if (e.dead && !(h.fxa.probe().styles[t.uid]?.beams || []).length) gone = i;
    }
    expect(gone).toBeGreaterThanOrEqual(0);
    expect(gone).toBeLessThan(15); // ~0.15 s fade
  });

  it('the swell is gentle (1.1 Hz, ±10 %) and off under reduced motion', () => {
    const widths = (reduceMotion) => {
      const sim = gallerySim([ID], [[0, 2, 0]]);
      const t = sim.towers.find((x) => x.unitId === ID);
      const h = harness(sim, { reduceMotion });
      const feed = streamer(sim, 0.6, 4000);
      const w = [];
      for (let i = 0; i < 1500; i++) {
        feed(DT);
        h.frame(DT);
        const b = (h.fxa.probe().styles[t.uid]?.beams || []).find((x) => x.i === 0);
        w.push(b && b.a === 1 ? b.w : null);
      }
      return w;
    };
    const still = widths(true).filter((x) => x != null);
    expect(still.length).toBeGreaterThan(100);
    expect(new Set(still.map((x) => x.toFixed(9))).size).toBe(1); // no ramp before Resonant Light: one steady width
    const live = widths(false);
    const mid = still[0];
    for (const x of live) if (x != null) expect(Math.abs(x / mid - 1)).toBeLessThanOrEqual(0.1 + 1e-9);
    // slow: a frame never changes it by more than 2π·1.1·0.1/60 ≈ 1.2 % (frames where it was on in both)
    let jump = 0;
    let pairs = 0;
    for (let i = 1; i < live.length; i++) {
      if (live[i] == null || live[i - 1] == null) continue;
      pairs++;
      jump = Math.max(jump, Math.abs(live[i] - live[i - 1]) / mid);
    }
    expect(pairs).toBeGreaterThan(100);
    expect(jump).toBeLessThan(0.02);
  });
});

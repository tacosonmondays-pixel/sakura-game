// The battle renderer's one visual clock (src/render/vfx/clock.js): visual time follows the
// frame, a hit-stop holds only the visuals (≤ 60 ms, a gap before the next, none with Reduce
// Motion), slow motion scales them, and the sim never reads any of it.
import { describe, it, expect } from 'vitest';
import { VisualClock, MAX_FREEZE, FREEZE_GAP, MAX_FRAME, MIN_SLOW, MAX_SLOW } from '../../src/render/vfx/clock.js';
import { simId } from '../../tools/simId.mjs';
import { Sim } from '../../src/sim/Sim.js';

const F = 1 / 60;
const run = (clock, frames, dt = F) => {
  let v = 0;
  for (let i = 0; i < frames; i++) v += clock.tick(dt);
  return v;
};

describe('visual clock', () => {
  it('follows the frame time when nothing holds it', () => {
    const c = new VisualClock();
    for (let i = 0; i < 120; i++) expect(c.tick(F)).toBeCloseTo(F, 12);
    expect(c.t).toBeCloseTo(2, 9);
    expect(c.frameT).toBeCloseTo(2, 9);
    expect(c.realT).toBeCloseTo(2, 9); // no wall clock given: real time = frame time
    expect(c.frame).toBe(120);
    expect(c.frozen).toBe(false);
  });

  it('never fast-forwards: a hitch is capped, junk input counts as zero', () => {
    const c = new VisualClock();
    expect(c.tick(5)).toBe(MAX_FRAME);
    expect(c.tick(-1)).toBe(0);
    expect(c.tick(NaN)).toBe(0);
    expect(c.tick(undefined)).toBe(0);
    expect(c.t).toBe(MAX_FRAME);
  });

  it('stands still while the game is paused, but real time (wall clock) still runs', () => {
    const c = new VisualClock();
    c.tick(F, 1000);
    for (let i = 1; i <= 30; i++) c.tick(0, 1000 + i * 16);
    expect(c.t).toBeCloseTo(F, 12);
    expect(c.frameT).toBeCloseTo(F, 12);
    expect(c.realT).toBeCloseTo(0.48, 9); // the first frame only starts the wall clock
    expect(c.realDt).toBeCloseTo(0.016, 9);
  });

  it('hit-stop holds the visuals for exactly the asked frame time, then they run on', () => {
    const c = new VisualClock();
    run(c, 10);
    expect(c.hitStop(0.05)).toBeCloseTo(0.05, 12);
    expect(c.frozen).toBe(true);
    const held = [];
    for (let i = 0; i < 6; i++) held.push(c.tick(F));
    // 3 whole frames held (50 ms), the 4th runs its last 0.0167 * 4 - 0.05 s
    expect(held.slice(0, 3)).toEqual([0, 0, 0]);
    expect(held[3]).toBeCloseTo(4 * F - 0.05, 12);
    expect(held[4]).toBeCloseTo(F, 12);
    expect(c.frozen).toBe(false);
    // the visuals lag the frame by the freeze, nothing else
    expect(c.frameT - c.t).toBeCloseTo(0.05, 12);
  });

  it('a hit-stop never lasts more than 60 ms, however often hits ask, and the next one waits', () => {
    const c = new VisualClock();
    let held = 0;
    for (let i = 0; i < 60; i++) {
      c.hitStop(0.06); // every frame of a busy fight asks for the longest freeze
      held += F - c.tick(F);
    }
    // 60 frames, 1 s: one freeze of 60 ms, then the gap, then one more
    const perSecond = Math.ceil(1 / (MAX_FREEZE + FREEZE_GAP));
    expect(held).toBeLessThanOrEqual(perSecond * MAX_FREEZE + 1e-9);
    expect(held).toBeGreaterThan(MAX_FREEZE - 1e-9);

    const d = new VisualClock();
    d.hitStop(0.2);
    expect(d.freezeLeft).toBe(MAX_FREEZE);
    run(d, 10);
    expect(d.frameT - d.t).toBeCloseTo(MAX_FREEZE, 12);
    // straight after: refused during the gap
    expect(d.hitStop(0.05)).toBe(0);
    run(d, Math.ceil(FREEZE_GAP / F) + 1);
    expect(d.hitStop(0.05)).toBeCloseTo(0.05, 12);
  });

  it('a running freeze can grow, but not past 60 ms from its start', () => {
    const c = new VisualClock();
    c.hitStop(0.03);
    c.tick(F);
    c.hitStop(0.06); // a bigger hit lands during the freeze
    run(c, 10);
    expect(c.frameT - c.t).toBeCloseTo(MAX_FREEZE, 12);
  });

  it('a paused game keeps its freeze for when it resumes', () => {
    const c = new VisualClock();
    c.hitStop(0.04);
    for (let i = 0; i < 20; i++) c.tick(0);
    expect(c.freezeLeft).toBeCloseTo(0.04, 12);
    run(c, 5);
    expect(c.frameT - c.t).toBeCloseTo(0.04, 12);
  });

  it('Reduce Motion: no hit-stop at all', () => {
    const c = new VisualClock({ reduceMotion: true });
    expect(c.hitStop(0.06)).toBe(0);
    expect(c.frozen).toBe(false);
    run(c, 10);
    expect(c.t).toBeCloseTo(c.frameT, 12);
  });

  it('slow motion scales the visuals for its span, within its limits', () => {
    const c = new VisualClock();
    c.slowMo(0.5, 0.25);
    const v = run(c, 30); // 0.5 s of frames: 0.25 s at half speed, then normal
    expect(v).toBeCloseTo(0.125 + 0.25, 9);
    expect(c.slowScale).toBe(1);

    const d = new VisualClock();
    expect(d.slowMo(0, 99)).toBe(MIN_SLOW);
    expect(d.slowLeft).toBe(MAX_SLOW);
    expect(d.slowMo(3, 1)).toBe(1); // faster than real time is not slow motion
    expect(d.slowLeft).toBe(0);
  });

  it('hit-stop and slow motion stack: the freeze first, then the slow', () => {
    const c = new VisualClock();
    c.slowMo(0.5, 1);
    c.hitStop(0.05);
    const v = run(c, 6); // 0.1 s of frames: 0.05 held, the next 0.05 at half speed
    expect(v).toBeCloseTo(0.025, 9);
  });

  it('reset() starts every timeline again', () => {
    const c = new VisualClock();
    run(c, 10);
    c.hitStop(0.05);
    c.slowMo(0.5, 1);
    c.reset();
    expect(c.snapshot()).toMatchObject({ t: 0, frameT: 0, realT: 0, frame: 0, freezeLeft: 0, slowLeft: 0, slowScale: 1 });
  });

  it('same frames in, same visual time out (screenshots line up)', () => {
    const a = new VisualClock();
    const b = new VisualClock();
    const dts = [F, F, 0.033, 0, F, 0.2, F];
    for (const dt of dts) {
      a.tick(dt);
      b.tick(dt);
      if (a.frame === 3) {
        a.hitStop(0.05);
        b.hitStop(0.05);
      }
    }
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('is render-only: the co-op sim id hashes no render file, and a freeze leaves the battle running', () => {
    const { files } = simId();
    expect(files.some((f) => f.startsWith('src/render/'))).toBe(false);
    const sim = new Sim({ stageId: '1-1', seed: 7, loadout: [{ unitId: 'aoi' }], options: { autoStart: true } });
    const clock = new VisualClock();
    for (let i = 0; i < 120; i++) {
      if (i % 20 === 0) clock.hitStop(MAX_FREEZE);
      sim.update(F);
      clock.tick(F);
    }
    expect(sim.time).toBeGreaterThan(2 - 2 * F); // the battle never waited for a freeze
    expect(clock.t).toBeLessThan(sim.time);
  });
});

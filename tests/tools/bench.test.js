// The girl bench's helpers (tools/benchLib.mjs, used by tools/bench.mjs): the walking boss enters her reach on the
// path nearest her spot, at that path's sample distance `d` (it used to read a missing `near.dist` and always
// started at the very beginning of path 0), the crowd streams on the path she covers most and warms up for the
// stage's walk, abilities stay quiet until measuring starts, and the max-investment stat block stays inside the gear caps.
import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/Sim.js';
import { samplePath } from '../../src/sim/path.js';
import { BATTLE_CAPS } from '../../src/data/gearStats.js';
import { bossEntry, streamPath, crowdWarmup, nearestSample, holdAbilities, releaseAbilities, maxProfile, MAX_INVEST, FINAL_BUILDS, parseBuild } from '../../tools/benchLib.mjs';

/** Two straight paths: path 0 along y = 0, path 1 along y = 10, samples every 0.5 tiles over 20 tiles. */
function twoPaths() {
  const out = [];
  for (let d = 0; d <= 20; d += 0.5) {
    out.push({ x: d, y: 0, d, pathIndex: 0, hidden: false });
    out.push({ x: d, y: 10, d, pathIndex: 1, hidden: false });
  }
  return out;
}

describe('bench: where the walking boss spawns', () => {
  it('uses the nearest sample\'s path and its distance d, entering half a tile before her reach', () => {
    const e = bossEntry(twoPaths(), { x: 12, y: 9 }, 3);
    expect(e.pathIndex).toBe(1);
    expect(e.near).toBe(12);
    // reach 3 around (12, 9) on y = 10: x from 12 − √8 to 12 + √8 → samples 9.5 … 14.5
    expect(e.entry).toBe(9.5);
    expect(e.exit).toBe(14.5);
    expect(e.dist).toBe(9);
    // the old bench read `near.dist` (no such key) and spawned at path 0, distance 0
    expect(e.dist).toBeGreaterThan(0);
  });

  it('never spawns before the path starts, and an out-of-reach spot falls back to the nearest sample', () => {
    expect(bossEntry(twoPaths(), { x: 0.2, y: 1 }, 3).dist).toBe(0);
    const far = bossEntry(twoPaths(), { x: 5, y: 5 }, 1);
    expect(far.entry).toBe(far.exit);
    expect(far.entry).toBe(far.near);
  });

  it('on stage 4-5 the boss stands inside her reach, not at the start of path 0', () => {
    const sim = new Sim({ stageId: '4-5', seed: 9, loadout: [{ unitId: 'kage' }], hero: null, options: { autoStart: false } });
    const samples = sim.pathData.flatMap((p) => samplePath(p, 0.5)).filter((s) => !s.hidden);
    expect(new Set(samples.map((s) => s.pathIndex)).size).toBeGreaterThan(1);
    // a spot one tile off the middle of the second path
    const mid = samples.filter((s) => s.pathIndex === 1)[Math.floor(samples.filter((s) => s.pathIndex === 1).length / 2)];
    const spot = { x: mid.x + 1, y: mid.y };
    const near = nearestSample(samples, spot);
    const e = bossEntry(samples, spot, 3);
    expect(e.pathIndex).toBe(near.pathIndex);
    expect(e.dist).toBeGreaterThan(1);
    const boss = sim.spawnEnemy('dragon_ashwing', { pathIndex: e.pathIndex, dist: e.dist });
    expect(boss.pathIndex).toBe(e.pathIndex);
    expect(boss.dist).toBeCloseTo(e.dist, 6);
    expect(Math.hypot(boss.x - spot.x, boss.y - spot.y)).toBeLessThanOrEqual(3 + 0.5 + 1e-6);
  });
});

describe('bench: the crowd stream', () => {
  it('walks the path with the most samples in her reach and knows where her reach ends', () => {
    const s = streamPath(twoPaths(), { x: 8, y: 1 }, 3);
    expect(s.pathIndex).toBe(0);
    expect(s.last).toBe(10.5);
    expect(s.first).toBe(5.5);
    expect(streamPath(twoPaths(), { x: 8, y: 8.5 }, 3).pathIndex).toBe(1);
  });

  it('warms up for as long as a grunt needs to walk past her reach, plus the ramp (the old flat 15 s ended first on 4-5)', () => {
    expect(crowdWarmup(10.5, 0.75, 10)).toBeCloseTo(24, 6);
    expect(crowdWarmup(30, 0.75, 10)).toBeGreaterThan(crowdWarmup(10, 0.75, 10));
    const sim = new Sim({ stageId: '4-5', seed: 9, loadout: [{ unitId: 'kage' }], hero: null, options: { autoStart: false } });
    const samples = sim.pathData.flatMap((p) => samplePath(p, 0.5)).filter((s) => !s.hidden);
    const far = samples.filter((s) => s.pathIndex === 1).reduce((a, s) => (s.d > a.d ? s : a));
    const st = streamPath(samples, { x: far.x, y: far.y }, 3);
    const grunt = sim.spawnEnemy('orc_grunt', { pathIndex: st.pathIndex, dist: 0 });
    expect(crowdWarmup(st.last, grunt.speed, 10)).toBeGreaterThan(15);
  });
});

describe('bench: abilities wait for the measured window', () => {
  it('holds auto-cast and charge during the warm-up, then turns auto-cast on', () => {
    const t = { uid: 3, abil: { cd: 600, auto: true } };
    const sim = { towers: [t], abilityAutoDefault: [true, false], abilGroups: new Map([['0|x', { cd: 5 }]]) };
    const pinned = new Map();
    holdAbilities(sim, pinned);
    expect(t.abil.auto).toBe(false);
    expect(sim.abilityAutoDefault[0]).toBe(false);
    expect(sim.abilGroups.size).toBe(0);
    t.abil.cd = 100; // a step charged it
    holdAbilities(sim, pinned);
    expect(t.abil.cd).toBe(600);
    releaseAbilities(sim, false);
    expect(t.abil.auto).toBe(false);
    releaseAbilities(sim, true);
    expect(t.abil.auto).toBe(true);
    expect(sim.abilityAutoDefault[0]).toBe(true);
  });
});

describe('bench: max investment', () => {
  it('is level 85, ★5, P6, all gates, and the gear stays inside BATTLE_CAPS', () => {
    for (const id of ['kage', 'shiro', 'suzu', 'umeko']) {
      const { stats, gear } = maxProfile(id);
      expect(stats.level).toBe(MAX_INVEST.level);
      expect(stats.awaken).toBe(5);
      expect(stats.potential).toBe(6);
      expect(stats.breakthrough).toBe(10);
      expect(gear).toHaveLength(3);
      expect(gear.every((g) => g.ur === 1 && g.level === 12)).toBe(true);
      expect(stats.critChance).toBeLessThanOrEqual(BATTLE_CAPS.critChance);
      expect(stats.critMul).toBeLessThanOrEqual(1 + BATTLE_CAPS.critDmg);
      expect(stats.rangeMul).toBeLessThanOrEqual(1 + BATTLE_CAPS.rangePct);
      expect(stats.pierceK).toBeLessThanOrEqual(100 * BATTLE_CAPS.piercePct);
      // level 85 · 10 gates · ★5 alone is ×2.962; the gear's ATK comes on top
      expect(stats.damageMul).toBeGreaterThan(2.962);
    }
    expect(maxProfile('umeko').stats.club).toBe('tea');
    expect(maxProfile('kage').stats.club).toBe('taiko');
    expect(maxProfile('kage', { rolls: 'max' }).stats.damageMul).toBeGreaterThan(maxProfile('kage').stats.damageMul);
  });

  it('knows the six path-cap-legal single-copy builds', () => {
    expect(FINAL_BUILDS.map((b) => b.name)).toEqual(['5-2-0', '5-0-2', '2-5-0', '0-5-2', '2-0-5', '0-2-5']);
    expect(parseBuild('2-5-0')).toEqual([1, 5, 0, 2]);
    expect(parseBuild('0-2-5')).toEqual([2, 5, 1, 2]);
    expect(() => parseBuild('6-0-0')).toThrow();
  });
});

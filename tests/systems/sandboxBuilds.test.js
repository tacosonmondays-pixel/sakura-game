// Sandbox builds and runs (docs/specs/SANDBOX_CATCHUP.md §2): the build codec, lower builds, the gear presets' max-roll
// profile, LR, the route params and the run they parse back to.
import { describe, it, expect } from 'vitest';
import { MAIN_STATS_BY_SLOT, ROLL_SLOTS } from '../../src/data/gearSlots.js';
import { coachPaths } from '../../src/systems/buildCoach.js';
import { mainStatRange, substatRange, MAX_GEAR_LEVEL } from '../../src/systems/gear.js';
import { UR_MAX_LEVEL, LR_MAX_LEVEL, TUNE_GOLD, TUNE_RAINBOW } from '../../src/data/gearAwaken.js';
import { GATE_CAPS } from '../../src/systems/progression.js';
import {
  normalizeBuild, buildToken, parseBuildToken, buildsParam, parseBuildsParam, potentialForLevel, gatesForSandboxLevel,
  sandboxGear, sandboxUnitStats, sandboxBattleParams, parseSandboxRun, SANDBOX_MAX_BUILD, gearPresetLabel, bestSetFor, buildFor,
} from '../../src/systems/sandbox.js';

describe('sandbox builds', () => {
  it('raises Potential to what the level needs, and gates follow the level', () => {
    expect(potentialForLevel(85)).toBe(6);
    expect(potentialForLevel(67)).toBe(3);
    expect(potentialForLevel(60)).toBe(1);
    expect(normalizeBuild({ level: 85, p: 1 }).p).toBe(6);
    expect(normalizeBuild({ level: 999 }).level).toBe(85);
    expect(normalizeBuild({ level: 0 }).level).toBe(1);
    for (const lv of [1, 10, 40, 60, 63, 85]) expect(GATE_CAPS[gatesForSandboxLevel(lv)]).toBeGreaterThanOrEqual(lv);
    expect(gatesForSandboxLevel(40)).toBe(3);
    const s = sandboxUnitStats('kage', { level: 40, p: 1, stars: 3, lr: false, gear: 'none' });
    expect([s.level, s.breakthrough, s.awaken, s.potential]).toEqual([40, 3, 3, 1]);
  });

  it('round-trips builds through the route (ids with underscores too)', () => {
    const b = { level: 63, p: 2, stars: 4, lr: false, gear: 'ur-treasurer', roll: 'typical' };
    expect(parseBuildToken(buildToken(b))).toEqual(b);
    expect(parseBuildToken('junk')).toEqual(normalizeBuild(SANDBOX_MAX_BUILD));
    // a token from before the roll field still reads (Max roll)
    expect(parseBuildToken('60-1-5-0-lr-geometry')).toEqual({ level: 60, p: 1, stars: 5, lr: false, gear: 'lr-geometry', roll: 'max' });
    const many = { kohaku_tsubaki: normalizeBuild({ level: 60, gear: 'blank' }), kage: normalizeBuild({ gear: 'none' }) };
    expect(parseBuildsParam(buildsParam(many))).toEqual(many);
    expect(parseBuildsParam('nobody_85-6-5-1-none')).toEqual({});
    expect(buildFor('kage', { level: 20 }, many)).toEqual(many.kage);
    expect(buildFor('aoi', { level: 20 }, many).level).toBe(20);
  });

  it('LR only for an LR unit at ★5 and Lv 60+, and it lifts her past her UR self', () => {
    expect(sandboxUnitStats('tenka').lr).toBe(true);
    expect(sandboxUnitStats('kohaku_tsubaki').lr).toBe(true);
    expect(!!sandboxUnitStats('kage').lr).toBe(false);
    expect(!!sandboxUnitStats('tenka', { ...SANDBOX_MAX_BUILD, stars: 4 }).lr).toBe(false);
    expect(!!sandboxUnitStats('tenka', { ...SANDBOX_MAX_BUILD, lr: false }).lr).toBe(false);
  });
});

describe('sandbox gear presets', () => {
  it('none is bare; best Legendary is the three rolling slots at +10, no set', () => {
    expect(sandboxGear('kage', 'none')).toEqual([]);
    const leg = sandboxGear('kage', 'leg');
    expect(leg.map((g) => g.slot)).toEqual([...ROLL_SLOTS]);
    for (const g of leg) {
      expect(g.level).toBe(MAX_GEAR_LEVEL);
      expect(g.set).toBeUndefined();
      expect(g.ur).toBeUndefined();
    }
  });

  it('main stats from her Build Coach row; every line at its best roll; growths, ✦ and pins as a maxed piece has them', () => {
    const row = coachPaths('kage')[0];
    for (const [key, level, stars] of [['leg-geometry', MAX_GEAR_LEVEL, 1], ['ur-geometry', UR_MAX_LEVEL, 2], ['lr-geometry', LR_MAX_LEVEL, 3]]) {
      const pieces = sandboxGear('kage', key);
      expect(pieces).toHaveLength(5);
      for (const g of pieces) {
        expect(g.level).toBe(level);
        expect(MAIN_STATS_BY_SLOT[g.slot]).toContain(g.main.stat);
        if (MAIN_STATS_BY_SLOT[g.slot].includes(row.mains[g.slot])) expect(g.main.stat).toBe(row.mains[g.slot]);
        expect(g.main.base).toBe(mainStatRange(g.main.stat, 'legendary')[1]);
        expect(g.main.top).toBe(1);
        expect(g.subs).toHaveLength(4);
        for (const s of g.subs) expect(s.base).toBe(substatRange(s.stat, 'legendary')[1]);
        expect(g.subs.reduce((n, s) => n + s.upgrades, 0)).toBe(Math.floor(level / 3));
        const starsOn = g.subs.reduce((n, s) => n + ((s.tuned & TUNE_GOLD) ? 1 : 0) + ((s.tuned & TUNE_RAINBOW) ? 1 : 0) + (s.night ? 1 : 0), 0);
        expect(starsOn, key).toBe(stars);
        expect(g.subs.filter((s) => s.top).length).toBe(key.startsWith('lr') ? 2 : 1);
        expect(new Set([g.main.stat, ...g.subs.map((s) => s.stat)]).size).toBe(5);
      }
    }
  });

  it('a better preset never makes her weaker (none < Legendary < UR set < LR set)', () => {
    for (const id of ['kage', 'tenka', 'hotaru', 'marumi']) {
      const d = (gear) => sandboxUnitStats(id, { ...SANDBOX_MAX_BUILD, gear }).damageMul;
      expect(d('leg')).toBeGreaterThan(d('none'));
      expect(d('ur-geometry')).toBeGreaterThan(d('leg-geometry'));
      expect(d('lr-geometry')).toBeGreaterThan(d('ur-geometry'));
    }
  });

  it('labels name the preset and her coach set', () => {
    expect(gearPresetLabel('blank')).toBe('Blank LR ×5');
    expect(gearPresetLabel('lr-spirit')).toBe('LR set · Spirit Squad');
    expect(gearPresetLabel('lr-best', 'kage')).toMatch(/^LR set · .+ \(coach\)$/);
    expect(['spirit', 'freezetag', 'geometry', 'popper', 'treasurer', 'powerbank']).toContain(bestSetFor('umeko'));
  });
});

describe('sandbox route', () => {
  it('builds params for freeplay from wave 200, and reads them back', () => {
    const p = sandboxBattleParams({ stageId: '4-5', difficulty: 'nightmare', towers: ['tenka', 'kage'], hero: 'kogane', freeplay: 'crimson', startWave: 200, build: { level: 60, gear: 'blank' }, builds: { tenka: { gear: 'lr-geometry' } } });
    expect(p).toMatchObject({ stage: '4-5', difficulty: 'nightmare', sandbox: 1, team: 'tenka.kage', hero: 'kogane', fp: 'crimson', wave: 200 });
    const run = parseSandboxRun(p, '4-5');
    expect(run).toMatchObject({ freeplay: 'crimson', startWave: 200, mode: 'standard', titan: null });
    expect(run.build).toMatchObject({ level: 60, gear: 'blank' });
    expect(run.builds.tenka.gear).toBe('lr-geometry');
    // the default build is never written into the link
    expect(sandboxBattleParams({ stageId: '1-1', towers: ['kage'], build: SANDBOX_MAX_BUILD }).sb).toBeUndefined();
  });

  it('freeplay and battle modes only on campaign stages; titans bring their own tier', () => {
    expect(sandboxBattleParams({ stageId: 'res-books-3', towers: ['kage'], freeplay: 'blossom', mode: 'rush' })).not.toHaveProperty('fp');
    expect(sandboxBattleParams({ stageId: 'res-books-3', towers: ['kage'], mode: 'rush' })).not.toHaveProperty('bmode');
    expect(sandboxBattleParams({ stageId: '2-7', towers: ['kage'], mode: 'rush' }).bmode).toBe('rush');
    expect(parseSandboxRun({ fp: 'blossom' }, 'ev-halloween-1').freeplay).toBe(null);
    const t = sandboxBattleParams({ titan: { id: 'wyrm', tier: 'mayhem', rank: 99 }, towers: ['kage'] });
    expect(t).toMatchObject({ ttn: 'wyrm', ttier: 'mayhem', trank: 30 });
    expect(t).not.toHaveProperty('stage');
    expect(parseSandboxRun(t).titan).toEqual({ id: 'wyrm', tier: 'mayhem', rank: 30 });
    expect(parseSandboxRun({ wave: 5000 }).startWave).toBe(999);
  });
});

describe('sandbox gear quality, Resonance and the late-start hero', () => {
  it('Typical roll: every line at its average roll, no pins; weaker than Max roll, stronger than no gear', () => {
    for (const g of sandboxGear('kage', 'lr-geometry', 'typical')) {
      const mid = ([a, b]) => (a + b) / 2;
      expect(g.main.base).toBeCloseTo(mid(mainStatRange(g.main.stat, 'legendary')), 9);
      expect(g.main.top).toBeUndefined();
      for (const s of g.subs) {
        expect(s.base).toBeCloseTo(mid(substatRange(s.stat, 'legendary')), 9);
        expect(s.top).toBeUndefined();
      }
    }
    const d = (roll, gear = 'lr-geometry') => sandboxUnitStats('kage', { ...SANDBOX_MAX_BUILD, gear, roll }).damageMul;
    expect(d('typical')).toBeLessThan(d('max'));
    expect(d('typical')).toBeGreaterThan(d('max', 'none'));
    expect(SANDBOX_MAX_BUILD.roll).toBe('max');
  });

  it('UR Resonance on / off forces the boost; auto follows the clock', () => {
    const on = sandboxUnitStats('hotaru', SANDBOX_MAX_BUILD, { resonance: 'on' });
    const off = sandboxUnitStats('hotaru', SANDBOX_MAX_BUILD, { resonance: 'off' });
    expect(on.damageMul / off.damageMul).toBeCloseTo(1.1, 3);
    expect(on.rateMul / off.rateMul).toBeCloseTo(1.04, 3);
    const auto = sandboxUnitStats('hotaru');
    expect([on.damageMul, off.damageMul]).toContain(auto.damageMul);
    // an LR unit gets the LR boost on top in the same week
    const lrOn = sandboxUnitStats('tenka', SANDBOX_MAX_BUILD, { resonance: 'on' });
    const lrOff = sandboxUnitStats('tenka', SANDBOX_MAX_BUILD, { resonance: 'off' });
    expect(lrOn.damageMul / lrOff.damageMul).toBeCloseTo(1.1 * 1.15, 3);
    // an R girl (no ★5 SSR) has none either way
    expect(sandboxUnitStats('aoi', SANDBOX_MAX_BUILD, { resonance: 'on' }).damageMul).toBe(sandboxUnitStats('aoi', SANDBOX_MAX_BUILD, { resonance: 'off' }).damageMul);
  });

  it('route: res and hmax ride the link only when they differ from the default', () => {
    const p = sandboxBattleParams({ stageId: '1-1', towers: ['kage'], resonance: 'on', heroMax: false, startWave: 50 });
    expect(p).toMatchObject({ res: 'on', hmax: 0, wave: 50 });
    expect(parseSandboxRun(p, '1-1')).toMatchObject({ resonance: 'on', heroMax: false });
    const d = sandboxBattleParams({ stageId: '1-1', towers: ['kage'] });
    expect(d).not.toHaveProperty('res');
    expect(d).not.toHaveProperty('hmax');
    expect(parseSandboxRun(d, '1-1')).toMatchObject({ resonance: 'auto', heroMax: true });
  });
});


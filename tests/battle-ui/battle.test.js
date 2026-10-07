import { describe, it, expect } from 'vitest';
import { crosspathReason, pathCap } from '../../src/ui/battle/rules.js';
import { resolveFormation, parseBattleParams, createBattleSim, followingStage, mapRouteFor } from '../../src/ui/battle/setup.js';
import { createProfile } from '../../src/systems/save.js';
import { STAGE_MAP } from '../../src/data/stages.js';
import { applyBattleResult } from '../../src/systems/rewards.js';
import { createRng } from '../../src/core/rng.js';

const NAMES = ['A', 'B', 'C'];

describe('crosspath rules', () => {
  it('caps the third path once two are in use', () => {
    expect(pathCap([1, 1, 0], 2)).toBe(0);
    expect(crosspathReason([1, 1, 0], 2, NAMES)).toMatch(/A \+ B/);
  });
  it('caps other paths at tier 2 when one passes tier 2', () => {
    expect(pathCap([3, 0, 0], 1)).toBe(2);
    expect(pathCap([3, 0, 0], 0)).toBe(5);
    expect(crosspathReason([3, 2, 0], 1, NAMES)).toMatch(/A is already T3/);
  });
  it('agrees with the sim for every reachable tier combination', () => {
    const profile = createProfile();
    const { sim } = createBattleSim(profile, { stageId: '1-1', difficulty: 'normal', seed: 7 });
    sim.cash = 1e9;
    const unitId = [...sim.loadout.keys()][0];
    let spot = null;
    for (let y = 0; y < sim.map.height && !spot; y++) for (let x = 0; x < sim.map.width; x++) if (sim.canPlace(unitId, x, y).ok) { spot = [x, y]; break; }
    for (const combo of [[0, 0, 0], [2, 2, 0], [3, 1, 0], [0, 2, 5], [1, 0, 1], [5, 2, 0]]) {
      const t = sim.placeTower(unitId, ...spot);
      for (let p = 0; p < 3; p++) for (let k = 0; k < combo[p]; k++) expect(sim.upgradeTower(t.uid, p)).toBe(true);
      for (let p = 0; p < 3; p++) {
        const st = sim.upgradeStatus(t.uid, p);
        const capped = t.tiers[p] >= pathCap(t.tiers, p);
        if (t.tiers[p] < 5) expect(st.reason === 'crosspath').toBe(capped);
      }
      sim.sellTower(t.uid);
    }
  });
});

describe('battle setup', () => {
  it('builds the loadout from the formation (towers ≤ 8, starter hero)', () => {
    const profile = createProfile();
    const f = resolveFormation(profile);
    expect(f.towers.length).toBeGreaterThan(0);
    expect(f.towers.length).toBeLessThanOrEqual(8);
    expect(f.hero).toBe('hikari');
  });
  it('drops units the player does not own', () => {
    const profile = createProfile();
    profile.formation.towers = ['kaede', 'aoi', 'aoi'];
    const f = resolveFormation(profile);
    expect(f.towers).toEqual(['aoi']);
  });
  it('validates route params', () => {
    const profile = createProfile();
    expect(parseBattleParams({ stage: 'nope' }, profile).error).toBeTruthy();
    const r = parseBattleParams({ stage: '1-1', difficulty: 'weird' }, profile);
    expect(r.error).toBeNull();
    expect(r.difficulty).toBe('normal');
    expect(parseBattleParams({ stage: '3-1' }, profile).practice).toBe(true);
    expect(parseBattleParams({ stage: '1-1' }, profile).practice).toBe(false);
  });
  it('only honours endless=1 where the Tactical Challenge screen offers it', () => {
    const profile = createProfile();
    // 1-1 is unlocked but not cleared yet; 8-5 is locked (practice) — no endless on either
    expect(parseBattleParams({ stage: '1-1', endless: '1' }, profile).endless).toBe(false);
    expect(parseBattleParams({ stage: '8-5', difficulty: 'easy', endless: '1' }, profile)).toMatchObject({ endless: false, practice: true });
    profile.progress.stages['1-1'] = { easy: true, normal: false, hard: false, nightmare: false, clears: 1 };
    expect(parseBattleParams({ stage: '1-1', endless: '1' }, profile).endless).toBe(true);
    expect(parseBattleParams({ stage: '1-1' }, profile).endless).toBe(false);
    // the colosseum is endless by nature (a locked one is a practice run)
    expect(parseBattleParams({ stage: 'challenge' }, profile)).toMatchObject({ endless: true, practice: true });
    // the sim follows the request
    const { sim } = createBattleSim(profile, parseBattleParams({ stage: '1-1', endless: '1' }, profile));
    expect(sim.endless).toBe(true);
  });
  it('creates a playable sim with unitBattleStats', () => {
    const profile = createProfile();
    const { sim, towers, hero } = createBattleSim(profile, { stageId: '1-1', difficulty: 'easy', seed: 3 });
    expect(sim.state).toBe('prep');
    expect([...sim.loadout.keys()]).toEqual(towers);
    expect(sim.heroConfig?.unitId).toBe(hero);
  });
  it('routes Next stage / Back to map', () => {
    expect(followingStage('1-1')).toBe('1-2');
    expect(followingStage('8-5')).toBeNull();
    expect(mapRouteFor(STAGE_MAP['1-3']).name).toBe('campaign');
    const boss = Object.values(STAGE_MAP).find((s) => s.kind === 'boss');
    expect(mapRouteFor(boss).name).toBe('assault');
  });
  it('a finished sim result feeds applyBattleResult', () => {
    const profile = createProfile();
    const { sim } = createBattleSim(profile, { stageId: '1-1', difficulty: 'easy', seed: 11 });
    for (let i = 0; i < 4000 && sim.state !== 'lost' && sim.state !== 'won'; i++) {
      if (sim.state !== 'wave') sim.startNextWave();
      sim.update(0.25);
    }
    expect(sim.state).toBe('lost');
    const out = applyBattleResult(profile, sim.result(), createRng(1), { now: new Date() });
    expect(out.firstClear).toBe(false);
    expect(Array.isArray(out.rewards)).toBe(true);
  });
});

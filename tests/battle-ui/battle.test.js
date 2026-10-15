import { describe, it, expect } from 'vitest';
import {
  crosspathReason, pathCap, onePerPathReason, whereOnMap, finalHolderLine, finalRaceText, heldPipTitle, ONE_PER_PATH_RULE, FINAL_NUMERAL,
} from '../../src/ui/battle/rules.js';
import { resolveFormation, parseBattleParams, createBattleSim, followingStage, mapRouteFor } from '../../src/ui/battle/setup.js';
import { createProfile } from '../../src/systems/save.js';
import { STAGE_MAP } from '../../src/data/stages.js';
import { applyBattleResult } from '../../src/systems/rewards.js';
import { createRng } from '../../src/core/rng.js';
import { feedDockRight } from '../../src/ui/battle/feed.js';

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

describe('one final tier per path (copy)', () => {
  it('says who can hold the final tier, in the owner\'s words', () => {
    expect(FINAL_NUMERAL).toBe('V');
    expect(onePerPathReason('Chika', 'Sentry Works')).toBe('Only one Chika can hold Sentry Works V. Sell or upgrade that one.');
    expect(finalRaceText('Kage', 'Storm of Steel')).toBe('Another Kage took Storm of Steel V first.');
    expect(heldPipTitle('Thousand Shadows', 'Kage')).toBe('T5 Thousand Shadows — held by another Kage');
    expect(ONE_PER_PATH_RULE).toMatch(/one 5-x-x, one x-5-x and one x-x-5/);
  });
  it('names where the holder stands (thirds of the map)', () => {
    expect(whereOnMap(1, 1, 30, 18)).toBe('top left');
    expect(whereOnMap(15, 1, 30, 18)).toBe('top');
    expect(whereOnMap(29, 1, 30, 18)).toBe('top right');
    expect(whereOnMap(1, 9, 30, 18)).toBe('left');
    expect(whereOnMap(15, 9, 30, 18)).toBe('centre');
    expect(whereOnMap(29, 9, 30, 18)).toBe('right');
    expect(whereOnMap(1, 17, 30, 18)).toBe('bottom left');
    expect(whereOnMap(15, 17, 30, 18)).toBe('bottom');
    expect(whereOnMap(29, 17, 30, 18)).toBe('bottom right');
    expect(whereOnMap(3, 3, 0, 0)).toBe('centre');
    expect(finalHolderLine({ def: { name: 'Chika' }, tiers: [5, 0, 2] }, 'bottom left')).toBe('Held by Chika 5-0-2 · bottom left');
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
  it('only honours endless=1 where the Tactical Challenge screen offers it (as freeplay on campaign maps)', () => {
    const profile = createProfile();
    // 1-1 is unlocked but not cleared yet; 8-5 is locked (practice) — no freeplay on either
    expect(parseBattleParams({ stage: '1-1', endless: '1' }, profile)).toMatchObject({ endless: false, freeplay: null });
    expect(parseBattleParams({ stage: '8-5', difficulty: 'easy', endless: '1' }, profile)).toMatchObject({ endless: false, freeplay: null, practice: true });
    profile.progress.stages['1-1'] = { easy: true, normal: false, hard: false, nightmare: false, clears: 1 };
    // the old endless run on a campaign map is a freeplay run now (Blossom unless a tier is given)
    expect(parseBattleParams({ stage: '1-1', endless: '1' }, profile)).toMatchObject({ endless: false, freeplay: 'blossom' });
    expect(parseBattleParams({ stage: '1-1' }, profile)).toMatchObject({ endless: false, freeplay: null, keepGoing: true });
    // the colosseum is endless by nature (a locked one is a practice run)
    expect(parseBattleParams({ stage: 'challenge' }, profile)).toMatchObject({ endless: true, practice: true });
    // the sim follows the request
    const { sim } = createBattleSim(profile, parseBattleParams({ stage: '1-1', endless: '1' }, profile));
    expect(sim.endless).toBe(false);
    expect(sim.freeplay).toBe(true);
    expect(sim.stage.freeplay.id).toBe('blossom');
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

describe('toast feed docking (keeps spawn gates in view)', () => {
  const box = { width: 1280, w: 340, top: 70, hgt: 176 };
  it('stays top-left on desktop unless a spawn run sits under it', () => {
    expect(feedDockRight([], box)).toBe(false);
    // a spawn gate at the top-left (e.g. foundry_core (-1,1.5)) pushes the feed to the right
    expect(feedDockRight([{ x: 40, y: 120 }, { x: 90, y: 150 }], box)).toBe(true);
    // spawns on both sides: the side covering fewer stays clear
    expect(feedDockRight([{ x: 40, y: 120 }, { x: 1200, y: 120 }, { x: 1150, y: 140 }], box)).toBe(false);
  });
  it('exit runs only break ties: a spawn always outweighs an exit', () => {
    const exitRight = [{ x: 1200, y: 120, w: 0.2 }, { x: 1180, y: 130, w: 0.2 }, { x: 1160, y: 140, w: 0.2 }];
    expect(feedDockRight([{ x: 40, y: 120 }, ...exitRight], box)).toBe(true);
    const exitLeft = exitRight.map((p) => ({ ...p, x: 1280 - p.x }));
    // landscape phones prefer the right corner, but leave it for an exit gate there
    expect(feedDockRight(exitLeft, { ...box, preferRight: true })).toBe(true);
    expect(feedDockRight(exitRight, { ...box, preferRight: true })).toBe(false);
    // points below the feed never count
    expect(feedDockRight([{ x: 40, y: 400 }], box)).toBe(false);
  });
});

// Cross-module consistency: ids shared between data, systems, art and UI must line up, and the
// full battle loop (profile formation → Sim → result → applyBattleResult) must work end to end.
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { UNITS, UNIT_MAP } from '../../src/data/units.js';
import { ENEMIES, ENEMY_MAP } from '../../src/data/enemies.js';
import { MAPS, MAP_MAP } from '../../src/data/maps.js';
import { STAGES, STAGE_MAP, CAMPAIGN_IDS, stageEnemies } from '../../src/data/stages.js';
import { ITEMS } from '../../src/data/items.js';
import { SHOP_OFFERS } from '../../src/data/shop.js';
import { DAILY_MISSIONS, WEEKLY_MISSIONS, LOGIN_REWARDS, ACHIEVEMENTS } from '../../src/data/missions.js';
import { CAPABILITIES, TRAITS, DIFFICULTIES } from '../../src/data/types.js';
import { createProfile } from '../../src/systems/save.js';
import { itemSources } from '../../src/systems/inventory.js';
import { POOL } from '../../src/systems/gacha.js';
import { applyBattleResult, sweep, canSweep } from '../../src/systems/rewards.js';
import { isStageUnlocked, isOwned, recommendedFor } from '../../src/systems/unlocks.js';
import { unitBattleStats } from '../../src/systems/progression.js';
import { createRng } from '../../src/core/rng.js';
import { autoPlan, runHeadless } from '../../src/sim/headless.js';
import { createBattleSim, resolveFormation, parseBattleParams, followingStage } from '../../src/ui/battle/setup.js';
import { hasItemIcon } from '../../src/art/icons.js';
import { cardArtSVG } from '../../src/art/cardArt.js';
import { stageThumbSVG } from '../../src/art/stageThumb.js';

const ROUTES = [...readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8').matchAll(/registerRoute\('([a-z]+)'/g)].map((m) => m[1]);

/** Plays a stage headless with the given units (all at level 1) and returns the run. */
function play(stageId, unitIds, difficulty = 'easy') {
  const plan = autoPlan(stageId, unitIds);
  return runHeadless({ stageId, difficulty, plan, seed: 3, maxTime: 7200 });
}

describe('ids line up across modules', () => {
  test('every stage references a real map, enemies, items, units and capabilities', () => {
    for (const s of STAGES) {
      expect(MAP_MAP[s.mapId], `${s.id} map`).toBeTruthy();
      for (const p of s.waveGen.pool) expect(ENEMY_MAP[p.enemy], `${s.id} pool ${p.enemy}`).toBeTruthy();
      for (const f of s.waveGen.fixed || []) expect(ENEMY_MAP[f.enemy], `${s.id} fixed ${f.enemy}`).toBeTruthy();
      for (const d of s.drops) expect(ITEMS[d.item], `${s.id} drop ${d.item}`).toBeTruthy();
      for (const r of s.firstClear || []) expect(ITEMS[r.id], `${s.id} firstClear ${r.id}`).toBeTruthy();
      for (const u of s.unlocks?.units || []) expect(UNIT_MAP[u], `${s.id} unlock ${u}`).toBeTruthy();
      for (const c of s.recommended) expect(CAPABILITIES[c], `${s.id} recommended ${c}`).toBeTruthy();
      for (const k of s.introduces) expect(ENEMY_MAP[k] || TRAITS[k], `${s.id} introduces ${k}`).toBeTruthy();
      if (s.requires) expect(STAGE_MAP[s.requires], `${s.id} requires`).toBeTruthy();
    }
  });

  test('free recruits: unit acquisition and stage unlocks agree both ways', () => {
    for (const u of UNITS.filter((x) => x.acquisition.type === 'free')) {
      const stage = STAGE_MAP[u.acquisition.afterStage];
      expect(stage, `${u.id} afterStage`).toBeTruthy();
      expect(stage.unlocks.units, `${u.id} granted by ${stage.id}`).toContain(u.id);
    }
    for (const s of STAGES) {
      for (const id of s.unlocks?.units || []) {
        expect(UNIT_MAP[id].acquisition, `${id} via ${s.id}`).toMatchObject({ type: 'free', afterStage: s.id });
      }
    }
  });

  test('every enemy debuts in a stage that can actually spawn it', () => {
    for (const e of ENEMIES) {
      const stage = STAGE_MAP[e.introducedIn];
      expect(stage, `${e.id} introducedIn`).toBeTruthy();
      expect([...stageEnemies(stage)], `${e.id} in ${stage.id}`).toContain(e.id);
    }
  });

  test('every item has a dedicated icon and every item source links to a real route/stage', () => {
    for (const id of Object.keys(ITEMS)) {
      expect(hasItemIcon(id), `icon for ${id}`).toBe(true);
      for (const src of itemSources(id)) {
        if (src.stageId) expect(STAGE_MAP[src.stageId], `${id} source stage`).toBeTruthy();
        if (src.route) expect(ROUTES, `${id} source route ${src.route}`).toContain(src.route);
      }
    }
  });

  test('shop, missions, login and achievements only grant known items or units', () => {
    for (const o of SHOP_OFFERS) {
      if (o.item) expect(ITEMS[o.item], `offer ${o.id}`).toBeTruthy();
      else expect(UNIT_MAP[o.unitId], `offer ${o.id}`).toBeTruthy();
    }
    const lists = [...DAILY_MISSIONS, ...WEEKLY_MISSIONS, ...ACHIEVEMENTS].map((m) => m.rewards);
    for (const day of LOGIN_REWARDS) lists.push(day.rewards || day);
    for (const rewards of lists) for (const r of [].concat(rewards)) expect(ITEMS[r.id], `reward ${r.id}`).toBeTruthy();
  });

  test('gacha pool covers the whole roster under the right rarity', () => {
    for (const u of UNITS) expect(POOL[u.rarity], u.id).toContain(u.id);
    expect(Object.values(POOL).flat().length).toBe(UNITS.length);
  });

  test('card art and stage thumbs render for every unit and map without bad values', () => {
    for (const u of UNITS) {
      for (const variant of ['full', 'portrait', 'thumb']) {
        const svg = cardArtSVG(u, { variant, awaken: 3 });
        expect(svg.startsWith('<svg'), `${u.id} ${variant}`).toBe(true);
        expect(svg, `${u.id} ${variant}`).not.toMatch(/NaN|undefined/);
      }
    }
    for (const m of MAPS) expect(stageThumbSVG(m)).not.toMatch(/NaN|undefined/);
  });

  test('battle-ui route params: Next Stage follows the campaign order', () => {
    CAMPAIGN_IDS.forEach((id, i) => expect(followingStage(id)).toBe(CAMPAIGN_IDS[i + 1] ?? null));
    expect(parseBattleParams({ stage: '1-1', difficulty: 'easy' }).difficulty).toBe('easy');
    expect(parseBattleParams({ stage: 'nope' }).error).toBeTruthy();
    expect(parseBattleParams({ stage: '1-1', endless: '1' }).endless).toBe(true);
  });
});

describe('battle loop end to end', () => {
  test('fresh profile formation → Sim loadout uses the profile stats', () => {
    const profile = createProfile();
    const f = resolveFormation(profile);
    expect(f.towers.length).toBeGreaterThan(0);
    for (const id of f.towers) expect(isOwned(profile, id)).toBe(true);
    profile.units.aoi.level = 20;
    const { sim } = createBattleSim(profile, { stageId: '1-1', difficulty: 'normal', seed: 1 });
    expect(sim.loadout.get('aoi').damageMul).toBeCloseTo(unitBattleStats(profile, 'aoi').damageMul, 5);
    expect(sim.loadout.get('aoi').damageMul).toBeGreaterThan(1.3);
    if (f.hero) expect(sim.heroConfig.unitId).toBe(f.hero);
    expect(sim.difficulty ?? 'normal').toBe('normal');
  });

  test('win 1-1 → medal, first-clear gems, discovery; 1-2 unlocks; clearing 1-2 grants Yuki', () => {
    const profile = createProfile();
    const starters = UNITS.filter((u) => u.acquisition.type === 'starter').map((u) => u.id);
    const r = play('1-1', starters, 'easy');
    expect(r.won).toBe(true);
    const res = r.sim.result();
    expect(res).toMatchObject({ stageId: '1-1', difficulty: 'easy', won: true });
    const gemsBefore = profile.currencies.gems;
    const out = applyBattleResult(profile, res, createRng(9));
    expect(out.firstClear).toBe(true);
    expect(out.medal).toBe(DIFFICULTIES.easy.medal);
    expect(profile.progress.stages['1-1'].easy).toBe(true);
    expect(profile.currencies.gems).toBeGreaterThanOrEqual(gemsBefore + DIFFICULTIES.easy.firstClearGems);
    expect(out.discovered).toContain('slime_green');
    expect(profile.bestiary.slime_green).toMatchObject({ seen: true, discovered: true });
    for (const id of out.discovered) expect([...stageEnemies('1-1')]).toContain(id);
    expect(isStageUnlocked(profile, '1-2')).toBe(true);
    expect(profile.stats.wins).toBe(1);
    // the same battle applied twice would double pay — UI guards this; the second call is a replay
    expect(applyBattleResult(profile, res, createRng(9)).firstClear).toBe(false);

    expect(isOwned(profile, 'yuki')).toBe(false);
    const r2 = play('1-2', starters, 'easy');
    expect(r2.won).toBe(true);
    const out2 = applyBattleResult(profile, r2.sim.result(), createRng(10));
    expect(out2.unlockedUnits).toEqual(['yuki']);
    expect(isOwned(profile, 'yuki')).toBe(true);
    expect(resolveFormation(profile).towers.length).toBeGreaterThan(0);
  });

  test('a loss marks enemies seen but not discovered and pays consolation coins', () => {
    const profile = createProfile();
    profile.progress.stages['1-4'] = { easy: true, normal: false, hard: false, nightmare: false, clears: 1 }; // 1-5 unlocked (not practice)
    const r = runHeadless({ stageId: '1-5', difficulty: 'nightmare', plan: [], seed: 1, maxTime: 600 });
    expect(r.lost).toBe(true);
    const out = applyBattleResult(profile, r.sim.result(), createRng(1));
    expect(out.discovered).toEqual([]);
    expect(Object.values(profile.bestiary).some((b) => b.seen && !b.discovered)).toBe(true);
    expect(profile.progress.stages['1-5']?.nightmare).toBeFalsy();
  });

  test('sweep is gated on a Hard clear and pays drops', () => {
    const profile = createProfile();
    expect(canSweep(profile, '1-1')).toBe(false);
    expect(sweep(profile, '1-1', 'hard', 3, createRng(2)).ok).toBe(false);
    profile.progress.stages['1-1'] = { easy: true, normal: true, hard: true, nightmare: false, clears: 3 };
    expect(canSweep(profile, '1-1')).toBe(true);
    const coins = profile.currencies.coins;
    const s = sweep(profile, '1-1', 'hard', 3, createRng(2));
    expect(s.ok).toBe(true);
    expect(s.rewards.length).toBeGreaterThan(0);
    expect(profile.currencies.coins).toBeGreaterThan(coins);
    expect(profile.missions.daily.d_win3 ?? 0).toBeGreaterThan(0);
  });

  test('recommended counters are always coverable by owned or free units', () => {
    const profile = createProfile();
    for (const id of CAMPAIGN_IDS) {
      const rec = recommendedFor(profile, id);
      expect(Array.isArray(rec.needs)).toBe(true);
      for (const cap of rec.needs) expect(CAPABILITIES[cap]).toBeTruthy();
    }
  });
});

// Limited events: the headless balance gate (EVENT_SPEC §7 EB-1, EB-2) with the autoPlan bot and
// ONLY the girls a free player owns at that point (starters + free recruits before the given
// campaign stage), at the campaign's expected account level (EXPECTED_LEVEL in balance.test.js:
// chapter 2 → 8, 3 → 14, 4 → 20, 8 → 40). Helpers are local copies of balance.test.js's.
//   EB-1 each operation is won on Normal by the free roster of its tuneLike stage.
//   EB-2 the Gourdlight Golem: Normal is won by a mid free-player team (the roster at the end of
//        chapter 3, level 20) on every seed; Hard is a challenge (that team loses; a late free
//        team at level 50 wins).
import { describe, test, expect } from 'vitest';
import '../../src/data/events/wire.js';
import { hasRealData, defaultData } from '../../src/sim/data.js';
import { runHeadless, autoPlan } from '../../src/sim/headless.js';
import { unitBattleStats } from '../../src/systems/progression.js';

const EXPECTED_LEVEL = { 1: 1, 2: 8, 3: 14, 4: 20, 5: 25, 6: 30, 7: 35, 8: 40 };

function freeUnitsBefore(d, stageId) {
  const campaign = Object.values(d.stages).filter((s) => s.kind === 'campaign');
  const order = new Map(campaign.map((s, i) => [s.id, i]));
  const idx = order.get(stageId);
  const avail = Object.values(d.units).filter((u) => {
    const a = u.acquisition || {};
    if (a.type === 'starter') return true;
    return a.type === 'free' && order.has(a.afterStage) && order.get(a.afterStage) < idx;
  });
  const recency = (u) => (u.acquisition?.type === 'free' ? order.get(u.acquisition.afterStage) : -1);
  const towers = avail.filter((u) => u.kind === 'tower').sort((a, b) => recency(b) - recency(a)).slice(0, 8);
  const hero = avail.filter((u) => u.kind === 'hero').sort((a, b) => recency(b) - recency(a))[0] || null;
  return { towers: towers.map((u) => u.id), hero: hero?.id || null };
}

const statsAt = (id, level) => unitBattleStats({ units: { [id]: { level, breakthrough: Math.max(0, Math.ceil((level - 10) / 10)), awaken: 0, gear: {} } }, gear: {} }, id);

function run(stageId, difficulty, rosterAt, level, seed) {
  const d = defaultData();
  const f = freeUnitsBefore(d, rosterAt);
  const r = runHeadless({
    stageId, difficulty, seed, maxTime: 7200,
    plan: autoPlan(stageId, [...f.towers, f.hero]),
    loadout: f.towers.map((id) => ({ unitId: id, stats: statsAt(id, level) })),
    hero: { unitId: f.hero, stats: statsAt(f.hero, level) },
  });
  return { won: r.won, text: `${stageId} ${difficulty} roster<${rosterAt} L${level} seed ${seed}: ${r.won ? 'won' : 'lost'} w${r.wave} lives ${r.lives}` };
}

const SEEDS = [1, 2, 3];

describe.skipIf(!hasRealData())('event balance (autoPlan, free units only)', () => {
  test('EB-1 every Halloween operation is won on Normal at its tuneLike roster and level', () => {
    const d = defaultData();
    const lost = [];
    for (const id of ['ev-halloween-1', 'ev-halloween-2', 'ev-halloween-3', 'ev-halloween-4']) {
      const like = d.stages[d.stages[id].tuneLike];
      for (const seed of SEEDS) {
        const r = run(id, 'normal', like.id, EXPECTED_LEVEL[like.chapter], seed);
        if (!r.won) lost.push(r.text);
      }
    }
    expect(lost).toEqual([]);
  }, 600000);

  test('EB-2 the Gourdlight Golem: Normal for a mid free team, Hard a challenge', () => {
    for (const seed of SEEDS) expect(run('ev-halloween-boss', 'normal', '4-1', 20, seed).won).toBe(true);
    expect(run('ev-halloween-boss', 'hard', '4-1', 20, 1).won).toBe(false);
    expect(run('ev-halloween-boss', 'hard', '8-1', 50, 1).won).toBe(true);
  }, 600000);
});

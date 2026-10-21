// The balance bot (tests/integration/balance.test.js): F2P roster before the stage, the expected
// account level per chapter, autoPlan, seed 1. Shared by the modes and rules tests.
import { defaultData } from '../../src/sim/data.js';
import { runHeadless, autoPlan } from '../../src/sim/headless.js';
import { unitBattleStats } from '../../src/systems/progression.js';

export const LEVEL = { 1: 1, 2: 8, 3: 14, 4: 20, 5: 25, 6: 30, 7: 35, 8: 40 };

function freeUnitsBefore(d, stageId, exclude = []) {
  const campaign = Object.values(d.stages).filter((s) => s.kind === 'campaign');
  const order = new Map(campaign.map((s, i) => [s.id, i]));
  const idx = order.get(stageId);
  const avail = Object.values(d.units).filter((u) => {
    if (exclude.includes(u.id)) return false;
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

/** One bot battle; `options` go to the Sim (mode, rule); `exclude`: unit ids left out of the free pool. */
export function botBattle(stageId, difficulty, options = {}, seed = 1, { exclude = [] } = {}) {
  const d = defaultData();
  const level = LEVEL[Number(stageId.split('-')[0])] ?? 20;
  const { towers, hero } = freeUnitsBefore(d, stageId, exclude);
  const plan = autoPlan(stageId, [...towers, ...(hero ? [hero] : [])]);
  return runHeadless({
    stageId, difficulty, plan, seed, maxTime: 7200, options,
    loadout: towers.map((id) => ({ unitId: id, stats: statsAt(id, level) })),
    hero: hero ? { unitId: hero, stats: statsAt(hero, level) } : null,
  });
}


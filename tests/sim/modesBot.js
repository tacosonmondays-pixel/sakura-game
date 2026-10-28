// The balance bot (tests/integration/balance.test.js): F2P roster before the stage, the expected
// account level per chapter, autoPlan, seed 1. Shared by the modes and rules tests.
import { defaultData } from '../../src/sim/data.js';
import { runHeadless, autoPlan } from '../../src/sim/headless.js';
import { unitBattleStats } from '../../src/systems/progression.js';
import { stageRequires, stageOrderKey } from '../../src/data/stages.js';
import { LEGACY_JOIN_STAGES } from '../../src/systems/catchUpJoins.js';

export const LEVEL = { 1: 1, 2: 8, 3: 14, 4: 20, 5: 25, 6: 30, 7: 35, 8: 40 };

/** Every stage that must be cleared before `id` opens (stageRequires, transitive): "earlier" never means array order. */
export function unlockAncestors(id) {
  const out = new Set();
  const stack = [...stageRequires(id)];
  while (stack.length) {
    const r = stack.pop();
    if (out.has(r)) continue;
    out.add(r);
    stack.push(...stageRequires(r));
  }
  return out;
}

/**
 * The F2P roster before a stage: starters plus the free girls whose join stage is an unlock ancestor (Yuzuha also from
 * her legacy 4-2, catchUpJoins LEGACY_JOIN_STAGES), the eight most recent towers and the most recent hero.
 */
export function freeUnitsBefore(d, stageId, exclude = []) {
  const before = unlockAncestors(stageId);
  const joinedAt = (u) => [u.acquisition.afterStage, ...(LEGACY_JOIN_STAGES[u.id] || [])].filter((id) => before.has(id));
  const avail = Object.values(d.units).filter((u) => {
    if (exclude.includes(u.id)) return false;
    const a = u.acquisition || {};
    if (a.type === 'starter') return true;
    return a.type === 'free' && joinedAt(u).length > 0;
  });
  const recency = (u) => (u.acquisition?.type === 'free' ? Math.min(...joinedAt(u).map(stageOrderKey)) : -1);
  const towers = avail.filter((u) => u.kind === 'tower').sort((a, b) => recency(b) - recency(a)).slice(0, 8);
  const hero = avail.filter((u) => u.kind === 'hero').sort((a, b) => recency(b) - recency(a))[0] || null;
  return { towers: towers.map((u) => u.id), hero: hero?.id || null };
}

const statsAt = (id, level) => unitBattleStats({ units: { [id]: { level, breakthrough: Math.max(0, Math.ceil((level - 10) / 10)), awaken: 0, gear: {} } }, gear: {} }, id);

/** One bot battle; `options` go to the Sim (mode, rule, autoAbilities), `planOpts` to autoPlan (plus
 *  `exclude`: unit ids left out of the free pool; `extra`: gacha girls added to it, for their goldens). */
export function botBattle(stageId, difficulty, options = {}, seed = 1, planOpts = {}) {
  const { exclude = [], extra = [], ...plan0 } = planOpts;
  const d = defaultData();
  const level = LEVEL[Number(stageId.split('-')[0])] ?? 20;
  const free = freeUnitsBefore(d, stageId, exclude);
  const towers = [...free.towers, ...extra];
  const { hero } = free;
  const plan = autoPlan(stageId, [...towers, ...(hero ? [hero] : [])], plan0);
  return runHeadless({
    stageId, difficulty, plan, seed, maxTime: 7200, options,
    loadout: towers.map((id) => ({ unitId: id, stats: statsAt(id, level) })),
    hero: hero ? { unitId: hero, stats: statsAt(hero, level) } : null,
  });
}


// Free-to-play roster and expected account level per campaign stage — the assumptions shared
// by the campaign balance test (tests/integration/balance.test.js) and the balance probe
// (tools/balance/measure.mjs). Change them here and both follow.
//
// Pure: no sim import (callers pass the data tables from src/sim/data.js `defaultData()`), so
// this file loads in Vitest and in plain Node alike.

import { unitBattleStats } from '../../src/systems/progression.js';

/**
 * Expected F2P account level per chapter (books from first clears, bounty sweeps and
 * commissions; docs/BALANCE.md §7). Every in-battle balance number is measured at these levels.
 */
export const EXPECTED_LEVEL = { 1: 1, 2: 5, 3: 10, 4: 15, 5: 20, 6: 24, 7: 28, 8: 32 };

const campaignOrder = (d) => {
  const campaign = Object.values(d.stages).filter((s) => s.kind === 'campaign');
  return new Map(campaign.map((s, i) => [s.id, i]));
};

/**
 * Units a free player owns before playing a campaign stage: the starters plus every free
 * recruit granted by an earlier stage (8 most recent towers + the most recent hero).
 * @param {{ units: object, stages: object }} d data tables (`defaultData()`)
 * @param {string} stageId campaign stage id
 * @returns {{ towers: string[], hero: string|null }}
 */
export function freeUnitsBefore(d, stageId) {
  const order = campaignOrder(d);
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

/**
 * Battle stats of a unit at an account level (breakthroughs as needed for that level, no
 * awakening, no gear).
 */
export function statsAtLevel(unitId, level) {
  const breakthrough = Math.max(0, Math.ceil((level - 10) / 10));
  return unitBattleStats({ units: { [unitId]: { level, breakthrough, awaken: 0, gear: {} } }, gear: {} }, unitId);
}

/**
 * Campaign stage a non-campaign stage (Bounty, Total Assault, Challenge) is played "after":
 * its `requires` stage. Campaign stages map to themselves.
 * @returns {string|null}
 */
export function campaignAnchor(d, stageId) {
  const s = d.stages[stageId];
  if (!s) return null;
  if (s.kind === 'campaign') return s.id;
  return s.requires && d.stages[s.requires]?.kind === 'campaign' ? s.requires : null;
}

/**
 * Roster and expected level for any stage. Campaign stages follow the balance test exactly;
 * other stages use the roster of a player who has just cleared their `requires` stage and the
 * level of the chapter after it (that is when they are reached).
 * @returns {{ towers: string[], hero: string|null, level: number, anchor: string|null }}
 */
export function f2pSetup(d, stageId) {
  const s = d.stages[stageId];
  if (s?.kind === 'campaign') return { ...freeUnitsBefore(d, stageId), level: EXPECTED_LEVEL[s.chapter] || 1, anchor: stageId };
  const anchor = campaignAnchor(d, stageId);
  if (!anchor) return { towers: [], hero: null, level: 1, anchor: null };
  const order = campaignOrder(d);
  const next = [...order.keys()][order.get(anchor) + 1];
  const roster = next ? freeUnitsBefore(d, next) : freeUnitsBefore(d, anchor);
  const chapter = Math.min(8, (d.stages[anchor].chapter || 1) + (next ? 1 : 0));
  return { ...roster, level: EXPECTED_LEVEL[chapter] || 1, anchor };
}

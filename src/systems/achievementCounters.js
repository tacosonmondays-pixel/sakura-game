// Achievement counters (owner: systems; docs/specs/ACHIEVEMENTS.md §1.7). Numbers in missions.counters, which every
// build keeps word for word, written with track(). They feed achievement progress, never a payout, so counting one
// extra time can only make a row ready a little early; the hooks still count each event exactly once.
//
// Never called from the simulation or the co-op protocol (src/sim, src/online/coop/*, src/data/coop.js): those are
// hashed into the co-op build id. Only result/reward processing and the UI count.

import { STAGE_MAP } from '../data/stages.js';
import { UNIT_MAP } from '../data/units.js';
import { track, recordMax } from './missions.js';

/** missions.counters keys (event words; marks use 'ach:'; rarities use '<name>:<rarity>'). */
export const ACH_COUNTERS = Object.freeze({
  coopWin: 'coopWin', ults: 'ults', flawless: 'ach:flawless', closeCall: 'ach:closeCall', squad3: 'ach:squad3',
  eventWin: 'eventWin', weeklyDone: 'weeklyDone', salvage: 'salvage', clanBossHit: 'clanBossHit', donate: 'donate',
  heroMax: 'heroMax',
  gear: (rarity) => `gear:${rarity}`, gear10: (rarity) => `gear10:${rarity}`,
});

/** Distinct students (heroes excluded) placed during a battle: stats.towerUnits is { towerUid: unitId }. */
export function studentsFielded(towerUnits) {
  const ids = new Set(Object.values(towerUnits || {}).filter((id) => typeof id === 'string' && UNIT_MAP[id]?.kind !== 'hero'));
  return ids.size;
}

/**
 * The solo battle counters, called by applyBattleResult after its practice guard (practice runs count nothing).
 * @param {object} profile
 * @param {object} result Sim.result()
 * @param {{ won: boolean, difficulty: string, eventBonus: boolean }} info
 */
export function countSoloBattle(profile, result, { won, difficulty, eventBonus }) {
  const ults = Math.max(0, Math.floor(Number(result?.stats?.ultsUsed) || 0));
  if (ults) track(profile, ACH_COUNTERS.ults, ults);
  // the highest level her hero reached in a battle, won or lost (a max, not a count; ACHIEVEMENTS.md §1.7)
  const heroLevel = Math.floor(Number(result?.stats?.heroLevel) || 0);
  if (heroLevel > 0) recordMax(profile, ACH_COUNTERS.heroMax, heroLevel);
  if (!won) return;
  const lives = Number(result.livesLeft);
  const max = Number(result.maxLives);
  if ((difficulty === 'normal' || difficulty === 'hard') && Number.isFinite(max) && max > 0 && lives === max) track(profile, ACH_COUNTERS.flawless, 1);
  if (lives === 1 && max > 1) track(profile, ACH_COUNTERS.closeCall, 1);
  const stage = STAGE_MAP[result.stageId];
  if (stage?.kind === 'campaign' && (stage.chapter || 0) >= 5 && (difficulty === 'hard' || difficulty === 'nightmare')) {
    const n = studentsFielded(result.stats?.towerUnits);
    if (n <= 3) track(profile, ACH_COUNTERS.squad3, 1);
  }
  if (eventBonus) track(profile, ACH_COUNTERS.eventWin, 1);
}

/**
 * A co-op battle won: counted once per battle even when the battle screen remounts (a resync replays it) or a
 * freeplay run is paid in two parts. `holder` outlives the battle screen (the co-op session); `key` names the battle.
 * @returns {boolean} counted now
 */
export function countCoopWin(profile, holder, key) {
  const seen = (holder.__achCounted ||= new Set());
  if (seen.has(key)) return false;
  seen.add(key);
  track(profile, ACH_COUNTERS.coopWin, 1);
  return true;
}

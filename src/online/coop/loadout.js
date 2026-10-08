// What a player brings into a co-op battle, from their own save: the host brings the formation
// hero plus COOP.towersPerPlayer towers; the guest brings one tower more instead of a hero
// (the Sim runs one hero per battle). Stats come from each player's own progression, so every
// girl fights at her owner's level, gear and awakening.
import { COOP } from '../../data/coop.js';
import { resolveFormation } from '../../ui/battle/setup.js';
import { unitBattleStats } from '../../systems/progression.js';

/**
 * @param {object} profile the local save
 * @param {boolean} isHost
 * @returns {{ loadout: { unitId: string, stats: object }[], hero: { unitId: string, stats: object }|null }}
 */
export function coopLoadout(profile, isHost) {
  const { towers, hero } = resolveFormation(profile);
  const count = COOP.towersPerPlayer + (isHost && hero ? 0 : 1);
  const loadout = towers.slice(0, count).map((unitId) => ({ unitId, stats: unitBattleStats(profile, unitId) }));
  return {
    loadout,
    hero: isHost && hero ? { unitId: hero, stats: unitBattleStats(profile, hero) } : null,
  };
}

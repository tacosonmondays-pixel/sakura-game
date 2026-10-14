// What a player brings into a co-op battle: the host brings the formation hero plus
// COOP.towersPerPlayer towers; the guest brings one tower more instead of a hero (the Sim runs
// one hero per battle). Stats come from each player's own progression (the caller passes them:
// src/ui/screens/coop.js reads the save), so every girl fights at her owner's level, gear and
// awakening; they travel in the hello / start messages, so the other player never recomputes
// them. Kept free of menu code on purpose: this file is part of the co-op compatibility id
// (tools/simId.mjs), the save / progression systems are not.
import { COOP } from '../../data/coop.js';

/**
 * @param {{ towers: string[], hero: string|null }} formation the player's resolved formation
 * @param {boolean} isHost
 * @param {(unitId: string) => object} statsOf the player's own battle stats for a girl
 * @returns {{ loadout: { unitId: string, stats: object }[], hero: { unitId: string, stats: object }|null }}
 */
export function pickLoadout({ towers = [], hero = null } = {}, isHost, statsOf) {
  const count = COOP.towersPerPlayer + (isHost && hero ? 0 : 1);
  const loadout = towers.slice(0, count).map((unitId) => ({ unitId, stats: statsOf(unitId) }));
  return {
    loadout,
    hero: isHost && hero ? { unitId: hero, stats: statsOf(hero) } : null,
  };
}

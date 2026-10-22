// A co-op ally's girl in the hold-for-info sheet (docs/specs/PROFILE.md §7.4 "Co-op room fix"): holding an ally's
// chip in the room opens HER: the ally's level, stars, gates and Potential from the loadout their game sent, with
// "<name>'s build" and no Full page. Gear is not in the loadout, so the gear cards say so instead of "No charm equipped".
import { loadoutToMiniProfile } from '../online/profileCard.js';

export const ALLY_GEAR_TEXT = 'Gear isn\'t shared in co-op rooms';

/**
 * openUnitSheet options for an ally's girl.
 * @param {string} unitId
 * @param {{ name?: string, avatar?: string }|null} ally the room player
 * @param {object|null} stats her loadout stats ({ level, breakthrough, awaken, potential, … })
 */
export function allySheet(unitId, ally, stats) {
  return {
    tab: 'build',
    profile: loadoutToMiniProfile(unitId, stats || {}),
    owner: { name: ally?.name || 'Your ally', avatar: ally?.avatar || null },
    allowFullPage: false,
    gearText: ALLY_GEAR_TEXT,
  };
}

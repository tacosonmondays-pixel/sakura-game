// The profile's view of the achievements expansion (docs/specs/ACHIEVEMENTS.md §6): titles, Honor
// Ribbons, their art and the kill count. The profile imports these names only from here, so the
// switch to feature/achievements' real honors modules is this one file.
export {
  NO_COSMETIC, TITLE_TABLE, HONOR_TOTAL, honorOf, honorSVG, earnedAchievementTitles, earnedHonors, honorCount, killsAll,
} from './profileHonorsShim.js';

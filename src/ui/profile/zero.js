// UI M5d: the Sensei Profile's empty states (docs/specs/UI_DIRECTION.md P7 "hide zero and irrelevant states"; notes/
// ui-m5/PLAN.md §5 M5d). Pure: the profile model in (src/ui/screens/profile.js ownModel / cardModel), what to show out.
// tests/ui/profileZero.test.js walks it.
//
//   - the collection stats: a stat at zero is not shown ("0% Bestiary", "0 Enemies defeated");
//   - medals: only the difficulties with a medal; none at all → no tally (your own profile says how to earn them);
//   - ribbons: the battle-mode ribbons only once one is won;
//   - Freeplay Records: only the tiers played ("Not played yet" ×3 went); a profile with none and no freeplay title or
//     frame shows no Freeplay panel (an achievement or tag title is not a freeplay record: "All titles" sits by the
//     title on the ID card);
//   - Honor Ribbons: only once one is earned;
//   - the bio: your empty bio is a button only while you can write one (online); offline it is not shown (the foot
//     note says why).
import { DIFFICULTY_ORDER } from '../../data/types.js';
import { FREEPLAY_TIERS } from '../../data/freeplay.js';

/** The collection stats' keys, in their order (students, stages cleared, bestiary %, enemies defeated). */
export const STAT_KEYS = Object.freeze(['u', 's', 'b', 'k']);

const n = (v) => Math.max(0, Number(v) || 0);

/** The stat tiles worth showing: the ones above zero. */
export function visibleStats(st = {}) {
  return STAT_KEYS.filter((k) => n(st?.[k]) > 0);
}

/** The difficulties with at least one medal (DIFFICULTY_ORDER order). */
export function medalDiffs(medals = []) {
  return DIFFICULTY_ORDER.filter((_, i) => n(medals?.[i]) > 0);
}

/** True when a battle-mode ribbon was won (a card from before the modes has none: false). */
export function ribbonsWon(ribbons) {
  return Array.isArray(ribbons) && ribbons.some((r) => n(r) > 0);
}

/** The freeplay tiers with a record (FREEPLAY_TIERS order). */
export function freeplayPlayed(fp = {}) {
  return FREEPLAY_TIERS.filter((t) => !!fp?.[t]);
}

/** A freeplay title (fp_…): the only titles the Freeplay panel lists (achievement and tag titles are not its records). */
export const isFreeplayTitle = (id) => typeof id === 'string' && id.startsWith('fp_');

/**
 * What the Freeplay panel lists besides its records (UI M5d review): your freeplay titles and frames; on someone else's
 * card, their title when it is a freeplay one, and their frame. An achievement or tag title alone lists nothing.
 */
export function freeplayEarned(m = {}) {
  if (m.own) return (m.earnedTitles || []).some(isFreeplayTitle) || (m.earnedFrames || []).length > 0;
  return isFreeplayTitle(m.title) || !!m.frame;
}

/**
 * Everything the profile shows, minus its empty states.
 * @param {object} m ownModel() / cardModel()
 * @returns {{ stats: string[], medals: string[], ribbons: boolean, freeplay: string[], earned: boolean,
 *   honors: boolean, bio: 'text'|'button'|null, trophies: boolean }} earned: freeplay titles or frames for the Freeplay
 *   panel (freeplayEarned); trophies: the Medals & Ribbons panel has something in it (or is your own: its empty line
 *   says how to earn medals)
 */
export function profileZero(m = {}) {
  const medals = medalDiffs(m.medals);
  const ribbons = ribbonsWon(m.ribbons);
  const honors = !!m.honors && n(m.honors.count) > 0;
  const pins = Array.isArray(m.pins) && m.pins.length > 0;
  const earned = freeplayEarned(m);
  let bio = null;
  if (m.bio) bio = 'text';
  else if (m.own && m.online === 'ready') bio = 'button';
  return {
    stats: visibleStats(m.st),
    medals,
    ribbons,
    freeplay: freeplayPlayed(m.fp),
    earned,
    honors,
    bio,
    trophies: !!m.own || medals.length > 0 || ribbons || pins || honors,
  };
}

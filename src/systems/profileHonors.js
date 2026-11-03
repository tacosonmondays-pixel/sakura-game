// The profile's view of the achievements expansion (docs/specs/ACHIEVEMENTS.md §6): titles, Honor Ribbons and
// the kill count, from feature/achievements' tables (src/data/honors.js, src/data/achievements.js).
//
// Pure on purpose: src/systems/save.js reaches this file (senseiSave → profileTrophies), and the main bundle must
// not pull the ribbon art or its CSS. So ownership is read here with the same rules as src/systems/honors.js
// (ownedRibbons / ownedTitles: a claimed, live, cosmetic row); tests/systems/profileHonors.test.js keeps the two
// equal. The art (ribbonArt, titlePlate) is imported by the profile UI from src/ui/honorFx.js.
import { ACHIEVEMENT_MAP, NO_COSMETIC, achievementLive } from '../data/achievements.js';
import { HONOR_RIBBONS, HONOR_MAP, TITLES } from '../data/honors.js';
import { killsAll } from './achievementMetrics.js';

export { NO_COSMETIC, killsAll };

const TIER = { standard: 'std', gold: 'gold', prism: 'prism' };
const live = (id) => !ACHIEVEMENT_MAP[id] || achievementLive(ACHIEVEMENT_MAP[id]);

/**
 * { [titleId]: { text, tier: 'std'|'gold'|'prism', how, tag? } } for every title this build contains. `tag`: a
 * player-tag title (owned from the save's 'tag:' marks, listed and counted only for its owners; titleChoices()).
 */
export const TITLE_TABLE = Object.freeze(Object.fromEntries(TITLES.filter((t) => live(t.id)).map((t) => [t.id, Object.freeze({
  text: t.name, tier: TIER[t.plate] || 'std', how: t.how || ACHIEVEMENT_MAP[t.id]?.desc || t.source || '', ...(t.tag ? { tag: t.tag } : {}),
})])));

/** Honor Ribbons this build contains (the "n / total" on screens). */
export const HONOR_TOTAL = HONOR_RIBBONS.filter((h) => live(h.id)).length;

/** @returns {{ name: string, cls: 'plain'|'shiny'|'special' }|null} */
export function honorOf(achId) {
  const h = HONOR_MAP[achId];
  return h ? { name: h.name, cls: h.class } : null;
}

const claimed = (p, id) => p?.missions?.achievements?.[id] === true && !NO_COSMETIC(id) && !!ACHIEVEMENT_MAP[id] && achievementLive(ACHIEVEMENT_MAP[id]);

/**
 * A ribbon given by a Mailbox letter (a reward 'honor:<achId>'; src/systems/mail.js claimMail): missions.counters
 * 'hgift:<achId>' = 1, which every build keeps word for word. It owns the ribbon only: the achievement, its gems
 * and its title stay unearned. Same live / cosmetic rules as a claim.
 */
export const HONOR_REWARD_PREFIX = 'honor:';
export const HONOR_GIFT_MARK = 'hgift:';
export const ribbonGifted = (p, id) => Number(p?.missions?.counters?.[HONOR_GIFT_MARK + id]) > 0 && !NO_COSMETIC(id) && !!ACHIEVEMENT_MAP[id] && achievementLive(ACHIEVEMENT_MAP[id]);

/** Claimed achievement ids that carry a title (the freeplay titles are read by profileTrophies.earnedTitles). */
export function earnedAchievementTitles(p) {
  return TITLES.filter((t) => ACHIEVEMENT_MAP[t.id] && claimed(p, t.id)).map((t) => t.id);
}

/** Claimed (or gifted) achievement ids that carry an Honor Ribbon, in case order. */
export function earnedHonors(p) {
  return HONOR_RIBBONS.filter((h) => claimed(p, h.id) || ribbonGifted(p, h.id)).map((h) => h.id);
}

/** The public card's st.h (0–999). */
export function honorCount(p) {
  return Math.min(999, earnedHonors(p).length);
}

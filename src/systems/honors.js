// Honor Ribbons and titles owned (owner: systems; docs/specs/ACHIEVEMENTS.md §2, §3.1, §6.1). Ownership is NEVER
// stored: it is derived from the achievement claims (missions.achievements[id] === true), which every build keeps
// word for word. So a past claimer owns the ribbons and titles added to shipped rows the moment this build loads,
// nothing can be dropped by an older cached tab, and nothing can pay twice.
//
// Stable interface for the Sensei Profile (feature/profile):
//   ownedRibbons(profile)  → ribbon ids (= achievement ids) in case order
//   ownedTitles(profile)   → title ids (achievement ids + fp_ashwing / fp_crimson) in plate order
//   ribbonArt(id, size, opts?) → <span class="rb"> element (SVG + effect layers); honours Reduce Motion
//   titlePlate(id, opts?)  → <span class="tp"> element on its Standard / Gold / Prism plate

import { ACHIEVEMENT_MAP, achievementLive, NO_COSMETIC } from '../data/achievements.js';
import { HONOR_RIBBONS, TITLES } from '../data/honors.js';

export { ribbonArt, titlePlate } from '../ui/honorFx.js';

/** missions.counters marks: how many ribbons / titles the player has already seen (high-water counts; R15). */
export const SEEN_HONORS_MARK = 'ach:seenHR';
export const SEEN_TITLES_MARK = 'ach:seenTT';

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const claims = (p) => (isObj(p?.missions?.achievements) ? p.missions.achievements : {});
const claimed = (p, id) => claims(p)[id] === true && !NO_COSMETIC(id) && achievementLive(ACHIEVEMENT_MAP[id]);

/** The rows of this build's list (counts are "out of what the running build contains", §2.2). */
export const liveRibbons = () => HONOR_RIBBONS.filter((h) => achievementLive(ACHIEVEMENT_MAP[h.id]));
export const liveTitles = () => TITLES.filter((t) => !ACHIEVEMENT_MAP[t.id] || achievementLive(ACHIEVEMENT_MAP[t.id]));

/** Ribbon ids owned (claimed, known and live in this build), in case order. */
export function ownedRibbons(profile) {
  return HONOR_RIBBONS.filter((h) => claimed(profile, h.id)).map((h) => h.id);
}

/** The two freeplay titles: from the 'fpm:' marks every build keeps, or the older progress.freeplay strings. */
function freeplayTitleOwned(p, id) {
  const c = isObj(p?.missions?.counters) ? p.missions.counters : {};
  const tiers = id === 'fp_crimson' ? ['crimson'] : ['blossom', 'tempest'];
  if (tiers.some((t) => Number(c[`fpm:${t}:matriarch`]) > 0)) return true;
  const titles = p?.progress?.freeplay?.titles;
  return Array.isArray(titles) && titles.includes(id === 'fp_crimson' ? 'Crimson Slayer' : 'Ashwing Slayer');
}

/** Title ids owned: claimed achievements with a title + the freeplay titles, in plate order (prism → standard). */
export function ownedTitles(profile) {
  return TITLES.filter((t) => (ACHIEVEMENT_MAP[t.id] ? claimed(profile, t.id) : freeplayTitleOwned(profile, t.id))).map((t) => t.id);
}

/** Owned ribbons as HONOR_RIBBONS rows. */
export const earnedHonors = (profile) => ownedRibbons(profile).map((id) => HONOR_RIBBONS.find((h) => h.id === id));
/** Owned achievement titles (not the freeplay ones) as TITLES rows. */
export const earnedAchievementTitles = (profile) => TITLES.filter((t) => ACHIEVEMENT_MAP[t.id] && claimed(profile, t.id));

/** Honor Ribbons owned: the public card's `st.h` (0–999). */
export function honorCount(profile) {
  return Math.min(999, ownedRibbons(profile).length);
}

/** Owned ribbons by class: { plain, shiny, special }. */
export function honorCounts(profile) {
  const out = { plain: 0, shiny: 0, special: 0 };
  for (const h of earnedHonors(profile)) out[h.class] += 1;
  return out;
}

/** The plate rule for future rows (hand overrides allowed on shipped ids; §2.5). */
export function titleTier(a) {
  return a?.honor?.cls === 'special' || a?.tier === 5 ? 'prism' : a?.tier === 4 ? 'gold' : 'std';
}

/** { [id]: { text, tier } } for the profile's TITLES table (tier: std | gold | prism). */
export function titleTable() {
  const tier = { standard: 'std', gold: 'gold', prism: 'prism' };
  return Object.fromEntries(TITLES.map((t) => [t.id, { text: t.name, tier: tier[t.plate] }]));
}

const counter = (p, key) => {
  const v = p?.missions?.counters?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
};
const setCounter = (p, key, v) => {
  const m = (p.missions ||= {});
  (m.counters ||= {})[key] = v;
};

/** Ribbons earned since the Ribbon Case was last opened. */
export const newHonorCount = (p) => Math.max(0, ownedRibbons(p).length - counter(p, SEEN_HONORS_MARK));
/** @returns {boolean} the mark moved */
export function markHonorsSeen(p) {
  const n = ownedRibbons(p).length;
  if (counter(p, SEEN_HONORS_MARK) === n) return false;
  setCounter(p, SEEN_HONORS_MARK, n);
  return true;
}

/** Titles earned since Edit Profile → Title (or the title list) was last opened. */
export const newTitleCount = (p) => Math.max(0, ownedTitles(p).length - counter(p, SEEN_TITLES_MARK));
/** @returns {boolean} the mark moved */
export function markTitlesSeen(p) {
  const n = ownedTitles(p).length;
  if (counter(p, SEEN_TITLES_MARK) === n) return false;
  setCounter(p, SEEN_TITLES_MARK, n);
  return true;
}

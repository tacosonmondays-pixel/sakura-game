// Honor Ribbons and titles owned (owner: systems; docs/specs/ACHIEVEMENTS.md §2, §3.1, §6.1). Ownership is NEVER
// stored: it is derived from the achievement claims (missions.achievements[id] === true), which every build keeps
// word for word (a ribbon a Mailbox letter gave also reads its 'hgift:' counter mark: profileHonors.ribbonGifted). So a past claimer owns the ribbons and titles added to shipped rows the moment this build loads,
// nothing can be dropped by an older cached tab, and nothing can pay twice.
//
// Stable interface for the Sensei Profile (feature/profile):
//   ownedRibbons(profile)  → ribbon ids (= achievement ids) in case order
//   ownedTitles(profile)   → title ids (achievement ids + fp_ashwing / fp_crimson + owned tag titles) in plate order
//   visibleTitles(profile) → the titles this player can see: every live title + the tag titles they own
//
// Tag titles (Developer, Alpha Tester, Beta Tester; src/data/playerTags.js) are owned from the save's 'tag:' marks
// (missions.counters, which every build keeps). Counting rule: a tag title is listed and counted ONLY for a player
// who owns it, so every "out of N" stays the same for everyone else (liveTitles() never includes them).
//   ribbonArt(id, size, opts?) → <span class="rb"> element (SVG + effect layers); honours Reduce Motion
//   titlePlate(id, opts?)  → <span class="tp"> element on its Standard / Gold / Prism plate

import { ACHIEVEMENT_MAP, achievementLive, NO_COSMETIC } from '../data/achievements.js';
import { HONOR_RIBBONS, TITLES } from '../data/honors.js';
import { markedTags, isTagTitle } from '../data/playerTags.js';
import { ALL_EVENTS } from '../data/events/index.js';
import { ribbonGifted } from './profileHonors.js';

export { ribbonArt, titlePlate } from '../ui/honorFx.js';

/** missions.counters marks: how many ribbons / titles the player has already seen (high-water counts; R15). */
export const SEEN_HONORS_MARK = 'ach:seenHR';
export const SEEN_TITLES_MARK = 'ach:seenTT';

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const claims = (p) => (isObj(p?.missions?.achievements) ? p.missions.achievements : {});
const claimed = (p, id) => claims(p)[id] === true && !NO_COSMETIC(id) && achievementLive(ACHIEVEMENT_MAP[id]);

/** The rows of this build's list (counts are "out of what the running build contains", §2.2). */
export const liveRibbons = () => HONOR_RIBBONS.filter((h) => achievementLive(ACHIEVEMENT_MAP[h.id]));
/** The titles every player can earn in this build (never the tag titles: those count only for their owners). */
export const liveTitles = () => TITLES.filter((t) => !t.tag && (!ACHIEVEMENT_MAP[t.id] || achievementLive(ACHIEVEMENT_MAP[t.id])));

/** A tag title is owned while the save holds that tag's mark (missions.counters 'tag:<kind>', set from the server). */
const tagTitleOwned = (p, t) => markedTags(p).includes(t.tag);

/**
 * Where titles come from, for the pickers: the team / tester titles are mentioned only to a player who has one, the
 * limited-event exchange titles (Pumpkin Patroller, bought with event candy) only to a player who owns one. No title
 * is ever sold for real money.
 */
export const TITLES_FROM = 'Titles come from achievements. Nothing you buy with real money gives a title.';
export const TITLES_FROM_TAGS = 'Titles come from achievements, and a few from being on the team or testing the game. Nothing you buy with real money gives a title.';
export const TITLES_FROM_EVENTS = 'Titles come from achievements and limited-event exchanges (event candy, never real money).';
export const TITLES_FROM_EVENTS_TAGS = 'Titles come from achievements, limited-event exchanges (event candy, never real money), and a few from being on the team or testing the game.';
/** Title ids sold in a limited-event exchange (src/data/events/*.js shop cosmetics). */
const EVENT_TITLE_IDS = new Set(ALL_EVENTS.flatMap((ev) => (ev.shop || []).filter((o) => o.cosmetic?.kind === 'title').map((o) => o.cosmetic.id)));
export const isEventTitle = (id) => EVENT_TITLE_IDS.has(id);
/** The line for a list of title ids: names the tag titles and the event titles only when the list holds one. */
export function titlesFromText(ids) {
  const tags = ids.some((id) => isTagTitle(id));
  if (ids.some(isEventTitle)) return tags ? TITLES_FROM_EVENTS_TAGS : TITLES_FROM_EVENTS;
  return tags ? TITLES_FROM_TAGS : TITLES_FROM;
}

/** Ribbon ids owned (claimed or gifted by a letter, known and live in this build), in case order. */
export function ownedRibbons(profile) {
  return HONOR_RIBBONS.filter((h) => claimed(profile, h.id) || ribbonGifted(profile, h.id)).map((h) => h.id);
}

/**
 * What the Case's "Earned" line adds for an owned ribbon: 'title' when the achievement was claimed and carries a
 * title, 'gift' when a Mailbox letter gave the ribbon only (its title is still unearned), otherwise null.
 */
export function ribbonEarnedNote(profile, id) {
  if (claimed(profile, id)) return ACHIEVEMENT_MAP[id]?.title ? 'title' : null;
  return ribbonGifted(profile, id) ? 'gift' : null;
}

/** The two freeplay titles: from the 'fpm:' marks every build keeps, or the older progress.freeplay strings. */
function freeplayTitleOwned(p, id) {
  const c = isObj(p?.missions?.counters) ? p.missions.counters : {};
  const tiers = id === 'fp_crimson' ? ['crimson'] : ['blossom', 'tempest'];
  if (tiers.some((t) => Number(c[`fpm:${t}:matriarch`]) > 0)) return true;
  const titles = p?.progress?.freeplay?.titles;
  return Array.isArray(titles) && titles.includes(id === 'fp_crimson' ? 'Crimson Slayer' : 'Ashwing Slayer');
}

/** Title ids owned: claimed achievements with a title + the freeplay titles + tag titles, in plate order (prism → standard). */
export function ownedTitles(profile) {
  return TITLES.filter((t) => {
    if (t.tag) return tagTitleOwned(profile, t);
    return ACHIEVEMENT_MAP[t.id] ? claimed(profile, t.id) : freeplayTitleOwned(profile, t.id);
  }).map((t) => t.id);
}

/** The titles this player sees in lists and counts: every live title + the tag titles they own, in plate order. */
export function visibleTitles(profile) {
  return TITLES.filter((t) => (t.tag ? tagTitleOwned(profile, t) : !ACHIEVEMENT_MAP[t.id] || achievementLive(ACHIEVEMENT_MAP[t.id])));
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

const PLATE_LABEL = { prism: 'Prism · rarest', gold: 'Gold', standard: 'Standard' };
/**
 * Title picker data (Edit Profile → Title, the Achievements tab's Titles sheet): the visible titles grouped by plate
 * (every live title + the tag titles this player owns), owned first inside each group, each with its "How:" line.
 * @returns {{ plate: 'prism'|'gold'|'standard', label: string, owned: number, total: number,
 *   titles: { id, name, plate, owned: boolean, how: string, source: string }[] }[]}
 */
export function titleGroups(profile) {
  const owned = new Set(ownedTitles(profile));
  const visible = visibleTitles(profile);
  return ['prism', 'gold', 'standard'].map((plate) => {
    const titles = visible.filter((t) => t.plate === plate).map((t) => {
      const a = ACHIEVEMENT_MAP[t.id];
      const how = t.how || (a ? (a.hidden && !owned.has(t.id) ? `Secret achievement: ${a.hint}` : `${a.name}: ${a.desc}`) : `${t.source}.`);
      return { id: t.id, name: t.name, plate, owned: owned.has(t.id), how, source: t.source };
    }).sort((x, y) => Number(y.owned) - Number(x.owned));
    return { plate, label: PLATE_LABEL[plate], owned: titles.filter((t) => t.owned).length, total: titles.length, titles };
  });
}

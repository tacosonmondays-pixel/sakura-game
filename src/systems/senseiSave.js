// Sensei Profile picks in the save: `profile.sensei` (docs/specs/PROFILE.md §2). Additive block, no
// SAVE_VERSION bump. An older cached build drops the whole block when it saves; migrateProfile then
// finds none and marks `lost`, and the first ready sync (M2) restores the picks from the server card.
//
// Offline safety net: every pick (not the bio, which the server owns) is also shadowed as a number in
// missions.counters ('pfs:' marks, hashes of the ids), the map every older build keeps when it saves.
// A save that lost its block comes back from those marks at once, with no server needed.
import { UNIT_MAP } from '../data/units.js';
import { BANNERS, BANNER_MAP, DEFAULT_BANNER, FRAMES, TITLES } from '../data/profileArt.js';
import { hashString } from '../core/rng.js';
import { BIO_MAX, PINS_MAX, SHOWCASE_MAX } from '../online/profileRules.js';
import { bannerUnlocked, earnedFrames, titleKeepable, pinEarned, pinOptions } from './profileTrophies.js';
import { TAG_KINDS, TAG_INFO, TAG_OF_TITLE } from '../data/playerTags.js';
import { markPbBanner, shadowedPbBanner } from './profileBanners.js';

export function newSensei() {
  return {
    avatar: null, // owned unit id; null = the secretary
    favorite: null, // owned unit id on the left; null = the secretary
    banner: DEFAULT_BANNER, // BANNERS id
    frame: null, // FRAMES id; null = Default
    title: null, // TITLES id; null = none
    showcase: [], // ≤ 8 owned unit ids, in order; [] = "my 8 strongest" (never stored)
    pins: [], // ≤ 4 pin strings; [] = "my best 4 medals" (never stored)
    bio: '', // mirror of the server bio (the server is authoritative)
    lost: false, // migrate found no block (an older build dropped it): restore once from the server
  };
}

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const owned = (p, id) => typeof id === 'string' && !!UNIT_MAP[id] && !!p?.units?.[id];

/** Trimmed, at most BIO_MAX code points ('' otherwise). Not re-checked: it only mirrors the server. */
export function cleanBio(v) {
  if (typeof v !== 'string') return '';
  const t = v.trim();
  return [...t].length <= BIO_MAX ? t : '';
}

/** Ordered, distinct, owned ids (≤ 8). */
export function cleanShowcase(list, p) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((id) => owned(p, id)))].slice(0, SHOWCASE_MAX);
}

/** Distinct pins the save has earned (≤ 4); unknown achievements that are claimed are kept. */
export function cleanPins(list, p) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((pin) => typeof pin === 'string' && pinEarned(p, pin)))].slice(0, PINS_MAX);
}

/**
 * Cleans a stored block against the (already migrated) save. Cosmetic: anything not owned or earned
 * falls back to its default. Runs in migrateProfile after units, progress, missions and secretary.
 * @param {any} raw
 * @param {object} p migrated profile
 */
export function cleanSensei(raw, p) {
  const s = newSensei();
  if (!isObj(raw)) return s;
  s.avatar = owned(p, raw.avatar) ? raw.avatar : null;
  s.favorite = owned(p, raw.favorite) ? raw.favorite : null;
  s.banner = typeof raw.banner === 'string' && BANNER_MAP[raw.banner] && bannerUnlocked(p, raw.banner) ? raw.banner : DEFAULT_BANNER;
  s.frame = typeof raw.frame === 'string' && FRAMES[raw.frame] && earnedFrames(p).includes(raw.frame) ? raw.frame : null;
  s.title = titleKeepable(p, raw.title) ? raw.title : null;
  s.showcase = cleanShowcase(raw.showcase, p);
  s.pins = cleanPins(raw.pins, p);
  s.bio = cleanBio(raw.bio);
  s.lost = raw.lost === true;
  return s;
}

// ---------------------------------------------------------------------------
// Shadow marks (missions.counters)
// ---------------------------------------------------------------------------

/** missions.counters key prefix of the pick shadows; 'pfs:v' = the save has written them. */
export const SENSEI_MARK = 'pfs:';
const ONE = ['avatar', 'favorite', 'banner', 'frame', 'title'];
const LISTS = { showcase: ['s', SHOWCASE_MAX], pins: ['p', PINS_MAX] };
const idHash = (id) => hashString(String(id)) || 1;

/**
 * missions.counters 'tagt:<kind>' = 1 while the equipped title is that tag title (Developer, Alpha /
 * Beta Tester). An older build (v0.1.32 and before) doesn't know those titles: its clean-up sets the
 * block's title to none and its own shadow writer drops the 'pfs:title' shadow, but it keeps every
 * counter and never touches this prefix, so restoreSensei puts the title back on.
 */
export const TAG_TITLE_MARK = 'tagt:';

/**
 * missions.counters 'evt:<titleId>' = 1 while the equipped title is a limited-event exchange title (Pumpkin
 * Patroller). A build from before that event (v0.1.37 and older) doesn't know the title: like the tag titles above, its
 * clean-up takes it off and rewrites the 'pfs:title' shadow, but it never touches this prefix, so restoreSensei puts
 * the title back on (it stays owned through its 'evo:' mark, src/systems/events.js).
 */
export const EVENT_TITLE_MARK = 'evt:';

/**
 * missions.counters 'pfw:f:<frameId>' / 'pfw:t:<titleId>' = 1 while that frame / title is equipped (Cosmetics 2, Oct 30).
 * A build that doesn't know a frame or title (the v0.1.67 frames, the secret titles) takes it off when it cleans the
 * block and rewrites the 'pfs:' shadows, but no older build touches this prefix, so restoreSensei puts the pick back on
 * once the frame or title is earned here (it is earned from claims, medals and counters every build keeps).
 */
export const WORN_MARK = 'pfw:';

/** The frame and title the 'pfw:' shadows say were equipped (each null when there is none). */
export function shadowedWorn(p) {
  const c = p?.missions?.counters;
  const out = { frame: null, title: null };
  if (!isObj(c)) return out;
  for (const k of Object.keys(c)) {
    if (!k.startsWith(WORN_MARK) || !(Number(c[k]) > 0)) continue;
    const [kind, ...rest] = k.slice(WORN_MARK.length).split(':');
    const id = rest.join(':');
    if (kind === 'f' && FRAMES[id] && !out.frame) out.frame = id;
    if (kind === 't' && TITLES[id] && !out.title) out.title = id;
  }
  return out;
}

/** The event title the 'evt:' shadow says was equipped, or null. */
export function shadowedEventTitle(p) {
  const c = p?.missions?.counters;
  if (!isObj(c)) return null;
  const key = Object.keys(c).find((k) => k.startsWith(EVENT_TITLE_MARK) && Number(c[k]) > 0 && TITLES[k.slice(EVENT_TITLE_MARK.length)]?.event);
  return key ? key.slice(EVENT_TITLE_MARK.length) : null;
}

/** The tag title the 'tagt:' shadow says was equipped, or null. */
export function shadowedTagTitle(p) {
  const c = p?.missions?.counters;
  if (!isObj(c)) return null;
  const kind = TAG_KINDS.find((k) => Number(c[TAG_TITLE_MARK + k]) > 0);
  return kind ? TAG_INFO[kind].title : null;
}

/** Writes the 'pfs:' shadows of `p.sensei` (stale ones removed). Call before every commit of a pick. */
export function markSensei(p) {
  if (!isObj(p?.sensei)) return;
  const c = ((p.missions ||= {}).counters ||= {});
  for (const k of Object.keys(c)) if (k.startsWith(SENSEI_MARK) || k.startsWith(TAG_TITLE_MARK) || k.startsWith(EVENT_TITLE_MARK) || k.startsWith(WORN_MARK)) delete c[k];
  c[`${SENSEI_MARK}v`] = 1;
  const tagKind = TAG_OF_TITLE[p.sensei.title];
  if (tagKind) c[TAG_TITLE_MARK + tagKind] = 1;
  if (TITLES[p.sensei.title]?.event) c[EVENT_TITLE_MARK + p.sensei.title] = 1;
  if (typeof p.sensei.frame === 'string' && FRAMES[p.sensei.frame]) c[`${WORN_MARK}f:${p.sensei.frame}`] = 1;
  if (typeof p.sensei.title === 'string' && TITLES[p.sensei.title]) c[`${WORN_MARK}t:${p.sensei.title}`] = 1;
  for (const k of ONE) if (typeof p.sensei[k] === 'string') c[SENSEI_MARK + k] = idHash(p.sensei[k]);
  for (const [k, [pre]] of Object.entries(LISTS)) {
    (Array.isArray(p.sensei[k]) ? p.sensei[k] : []).forEach((id, i) => { c[`${SENSEI_MARK}${pre}${i}`] = idHash(id); });
  }
  markPbBanner(p); // 'pbn:' (src/systems/profileBanners.js): kept by older builds, which never touch that prefix
}

/**
 * The picks rebuilt from the 'pfs:' shadows (cleaned against `p`), or null when the save never wrote
 * any. Each hash is matched against what this save could hold: owned girls, banners, frames, titles
 * (and claimed achievement ids, for titles a newer build knows), and earned pins.
 */
export function senseiFromMarks(p) {
  const c = p?.missions?.counters;
  if (!isObj(c) || !(c[`${SENSEI_MARK}v`] > 0)) return null;
  const claimedIds = Object.keys(p.missions.achievements || {}).filter((id) => p.missions.achievements[id] === true);
  const opts = pinOptions(p);
  const pool = {
    unit: Object.keys(p.units || {}),
    banner: BANNERS.map((b) => b.id),
    frame: Object.keys(FRAMES),
    title: [...Object.keys(TITLES), ...claimedIds],
    pin: [...opts.medals, ...opts.ribbons, ...claimedIds.map((id) => `ach:${id}`)],
  };
  const find = (kind, key) => {
    const v = c[SENSEI_MARK + key];
    return v > 0 ? pool[kind].find((id) => idHash(id) === v) ?? null : null;
  };
  const raw = { avatar: find('unit', 'avatar'), favorite: find('unit', 'favorite'), banner: find('banner', 'banner'), frame: find('frame', 'frame'), title: find('title', 'title') };
  raw.showcase = Array.from({ length: SHOWCASE_MAX }, (_, i) => find('unit', `s${i}`)).filter(Boolean);
  raw.pins = Array.from({ length: PINS_MAX }, (_, i) => find('pin', `p${i}`)).filter(Boolean);
  return cleanSensei(raw, p);
}

/**
 * The save's block on load (migrateProfile): the stored block cleaned, else the shadows, else an
 * empty block marked `lost` (M2 restores it from the server card). Writes the shadows again. A tag
 * title or an event title an older build took off (no title now, the 'tagt:' / 'evt:' shadow still
 * set, the title still owned) is put back on. (Taking it off on purpose in an older build looks the
 * same, and comes back too.)
 */
export function restoreSensei(raw, p) {
  const shadow = shadowedWorn(p);
  const worn = [shadowedTagTitle(p), shadowedEventTitle(p), shadow.title].find((id) => id && titleKeepable(p, id)) || null;
  let s;
  if (isObj(raw)) s = cleanSensei(raw, p);
  else s = senseiFromMarks(p) || { ...newSensei(), lost: true };
  if (s.title == null && worn) s.title = worn;
  if (s.frame == null && shadow.frame && earnedFrames(p).includes(shadow.frame)) s.frame = shadow.frame;
  // a 'pb:' banner an older build took off (it showed the default; the 'pbn:' shadow still names it) goes back on
  if (s.banner === DEFAULT_BANNER) s.banner = shadowedPbBanner(p) || s.banner;
  p.sensei = s;
  if (!s.lost || isObj(raw)) markSensei(p);
  return s;
}

/** Applies picks from the editors (already validated there), cleans them and refreshes the shadows. */
export function setSensei(p, patch) {
  p.sensei = cleanSensei({ ...(isObj(p.sensei) ? p.sensei : newSensei()), ...patch }, p);
  markSensei(p);
  return p.sensei;
}

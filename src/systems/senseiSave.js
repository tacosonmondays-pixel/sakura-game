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

/** Writes the 'pfs:' shadows of `p.sensei` (stale ones removed). Call before every commit of a pick. */
export function markSensei(p) {
  if (!isObj(p?.sensei)) return;
  const c = ((p.missions ||= {}).counters ||= {});
  for (const k of Object.keys(c)) if (k.startsWith(SENSEI_MARK)) delete c[k];
  c[`${SENSEI_MARK}v`] = 1;
  for (const k of ONE) if (typeof p.sensei[k] === 'string') c[SENSEI_MARK + k] = idHash(p.sensei[k]);
  for (const [k, [pre]] of Object.entries(LISTS)) {
    (Array.isArray(p.sensei[k]) ? p.sensei[k] : []).forEach((id, i) => { c[`${SENSEI_MARK}${pre}${i}`] = idHash(id); });
  }
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
 * empty block marked `lost` (M2 restores it from the server card). Writes the shadows again.
 */
export function restoreSensei(raw, p) {
  let s;
  if (isObj(raw)) s = cleanSensei(raw, p);
  else s = senseiFromMarks(p) || { ...newSensei(), lost: true };
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

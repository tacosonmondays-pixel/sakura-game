// Patch-note gifts (owner: systems): every game version in src/data/patchNotes.js carries a small
// gem gift, claimable once per version per save. Claims live in profile.patchGifts
// ({ [noteId]: true }) so they travel with cloud saves, backups and transfer codes.
//
// Every claim is also marked in `missions.counters['pg:<noteId>']` (= 1). Builds from before patch
// notes drop profile.patchGifts when they rewrite a save (an old cached tab, a rollback deploy, an
// older desktop app on the same address) but keep missions.counters word for word, so a claim made
// here can never be claimed again after an older build touched the save (as Potential's 'pot:' and
// Freeplay's 'fpm:' copies).
//
// Pure functions: no DOM / localStorage here (the Notice UI calls store.commit() after a claim).

import { PATCH_NOTES } from '../data/patchNotes.js';
import { addItems } from './inventory.js';

/** Gems each version's patch note gives. */
export const PATCH_GIFT_GEMS = 100;

/** missions.counters key prefix of a claimed version's gift ('pg:' + note id). */
export const PATCH_MARK = 'pg:';

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const okId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 64;

/** profile.missions.counters, created on demand. */
function counters(profile) {
  const m = isObj(profile.missions) ? profile.missions : (profile.missions = {});
  return isObj(m.counters) ? m.counters : (m.counters = {});
}

/** Ids the counters mark as claimed. */
function markedIds(counters) {
  if (!isObj(counters)) return [];
  return Object.entries(counters)
    .filter(([k, v]) => k.startsWith(PATCH_MARK) && typeof v === 'number' && v > 0)
    .map(([k]) => k.slice(PATCH_MARK.length))
    .filter(okId);
}

/**
 * Save sanitizer: keep only `{ id: true }` entries (old saves without the field → {}), plus every
 * claim marked in `counters` (missions.counters: an older build dropped profile.patchGifts).
 * @param {any} raw profile.patchGifts as stored
 * @param {object} [counters] the migrated profile's missions.counters
 */
export function cleanPatchGifts(raw, counters = null) {
  const out = {};
  if (isObj(raw)) for (const [id, v] of Object.entries(raw)) if (v === true && okId(id)) out[id] = true;
  for (const id of markedIds(counters)) out[id] = true;
  return out;
}

/** Writes the 'pg:' mark of every claim in profile.patchGifts (migrateProfile; idempotent). */
export function markPatchGifts(profile) {
  if (!isObj(profile?.patchGifts)) return;
  const c = counters(profile);
  for (const id of Object.keys(profile.patchGifts)) if (profile.patchGifts[id] === true && okId(id)) c[PATCH_MARK + id] = 1;
}

const claims = (profile) => (isObj(profile.patchGifts) ? profile.patchGifts : (profile.patchGifts = {}));

function setClaimed(profile, id) {
  claims(profile)[id] = true;
  counters(profile)[PATCH_MARK + id] = 1;
}

/** @returns {boolean} this version's gift was already claimed on this save */
export function isPatchGiftClaimed(profile, id) {
  if (isObj(profile?.patchGifts) && profile.patchGifts[id] === true) return true;
  const c = profile?.missions?.counters;
  return isObj(c) && typeof c[PATCH_MARK + id] === 'number' && c[PATCH_MARK + id] > 0;
}

/** @returns {string[]} ids of versions whose gift is still waiting, newest first */
export function unclaimedPatchGifts(profile, notes = PATCH_NOTES) {
  return notes.filter((n) => !isPatchGiftClaimed(profile, n.id)).map((n) => n.id);
}

/**
 * Claim one version's gift.
 * @returns {{ ok: boolean, error?: 'unknown'|'claimed', rewards: {id:string,count:number}[] }}
 */
export function claimPatchGift(profile, id, notes = PATCH_NOTES) {
  if (!notes.some((n) => n.id === id)) return { ok: false, error: 'unknown', rewards: [] };
  if (isPatchGiftClaimed(profile, id)) return { ok: false, error: 'claimed', rewards: [] };
  setClaimed(profile, id);
  return { ok: true, rewards: addItems(profile, [{ id: 'gems', count: PATCH_GIFT_GEMS }]) };
}

/**
 * Claim every waiting gift.
 * @returns {{ ok: boolean, count: number, rewards: {id:string,count:number}[] }}
 */
export function claimAllPatchGifts(profile, notes = PATCH_NOTES) {
  const ids = unclaimedPatchGifts(profile, notes);
  for (const id of ids) setClaimed(profile, id);
  const rewards = ids.length ? addItems(profile, [{ id: 'gems', count: PATCH_GIFT_GEMS * ids.length }]) : [];
  return { ok: ids.length > 0, count: ids.length, rewards };
}

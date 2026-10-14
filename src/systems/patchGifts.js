// Patch-note gifts (owner: systems): every game version in src/data/patchNotes.js carries a small
// gem gift, claimable once per version per save. Claims live in profile.patchGifts
// ({ [noteId]: true }) so they travel with cloud saves, backups and transfer codes.
//
// Pure functions: no DOM / localStorage here (the Notice UI calls store.commit() after a claim).

import { PATCH_NOTES } from '../data/patchNotes.js';
import { addItems } from './inventory.js';

/** Gems each version's patch note gives. */
export const PATCH_GIFT_GEMS = 100;

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

/** Save sanitizer: keep only `{ id: true }` entries (old saves without the field → {}). */
export function cleanPatchGifts(raw) {
  const out = {};
  if (!isObj(raw)) return out;
  for (const [id, v] of Object.entries(raw)) if (v === true && id.length <= 64) out[id] = true;
  return out;
}

const claims = (profile) => (isObj(profile.patchGifts) ? profile.patchGifts : (profile.patchGifts = {}));

/** @returns {boolean} this version's gift was already claimed on this save */
export function isPatchGiftClaimed(profile, id) {
  return isObj(profile?.patchGifts) && profile.patchGifts[id] === true;
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
  claims(profile)[id] = true;
  return { ok: true, rewards: addItems(profile, [{ id: 'gems', count: PATCH_GIFT_GEMS }]) };
}

/**
 * Claim every waiting gift.
 * @returns {{ ok: boolean, count: number, rewards: {id:string,count:number}[] }}
 */
export function claimAllPatchGifts(profile, notes = PATCH_NOTES) {
  const ids = unclaimedPatchGifts(profile, notes);
  for (const id of ids) claims(profile)[id] = true;
  const rewards = ids.length ? addItems(profile, [{ id: 'gems', count: PATCH_GIFT_GEMS * ids.length }]) : [];
  return { ok: ids.length > 0, count: ids.length, rewards };
}

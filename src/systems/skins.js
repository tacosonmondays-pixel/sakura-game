// Outfit ownership and choice (owner: systems). See CONTRACTS.md §5 and
// docs/merge/ROSTER_SPEC.md §3.3.
//
// Pure functions over the profile (no DOM): the UI calls setSkin, then store.commit('skin').
// profile.units[id].skin holds the equipped skin id, or null for her default outfit.
// profile.skins lists outfits owned through the shop or an event (none exist yet): defaults and
// Sentinel Style ('withUnit') are owned with the girl and never stored.

import { UNIT_MAP } from '../data/units.js';
import { SKIN_MAP, defaultSkinId, resolveSkin, skinsForUnit } from '../data/skins.js';

const STORED_TYPES = ['shop', 'event'];

/** True for a skin whose ownership lives in profile.skins (shop/event outfits). */
export function isStoredSkin(skinOrId) {
  const s = typeof skinOrId === 'string' ? SKIN_MAP[skinOrId] : skinOrId;
  return !!s && STORED_TYPES.includes(s.acquisition?.type);
}

/**
 * Does the player own this outfit? Default and with-unit outfits: when she owns the girl;
 * shop/event outfits: when profile.skins lists it.
 * @param {object} profile
 * @param {string} skinId
 * @returns {boolean}
 */
export function ownsSkin(profile, skinId) {
  const s = SKIN_MAP[skinId];
  if (!s || !profile) return false;
  if (isStoredSkin(s)) return Array.isArray(profile.skins) && profile.skins.includes(skinId);
  return !!profile.units?.[s.unitId];
}

/**
 * The equipped skin id of a girl: her stored choice when it is valid and owned, else her default.
 * @param {object} profile
 * @param {string} unitId
 * @returns {string}
 */
export function equippedSkinId(profile, unitId) {
  const id = profile?.units?.[unitId]?.skin;
  if (typeof id === 'string' && SKIN_MAP[id]?.unitId === unitId && ownsSkin(profile, id)) return id;
  return defaultSkinId(unitId);
}

/** @returns {object} SkinDef of the girl's equipped outfit. */
export function equippedSkin(profile, unitId) {
  return resolveSkin(unitId, equippedSkinId(profile, unitId));
}

/**
 * Equip an outfit (mutates the profile; the default is stored as null).
 * @param {object} profile
 * @param {string} unitId
 * @param {string|null} skinId null = her default
 * @returns {{ ok: boolean, error?: 'unknown'|'wrongUnit'|'notOwned'|'unitNotOwned' }}
 */
export function setSkin(profile, unitId, skinId) {
  if (!UNIT_MAP[unitId]) return { ok: false, error: 'unknown' };
  const u = profile?.units?.[unitId];
  if (!u) return { ok: false, error: 'unitNotOwned' };
  const id = skinId ?? defaultSkinId(unitId);
  const s = SKIN_MAP[id];
  if (!s) return { ok: false, error: 'unknown' };
  if (s.unitId !== unitId) return { ok: false, error: 'wrongUnit' };
  if (!ownsSkin(profile, id)) return { ok: false, error: 'notOwned' };
  u.skin = s.kind === 'default' ? null : id;
  return { ok: true };
}

/**
 * Give the player an outfit (shop/event later). Default and with-unit outfits need no grant.
 * @param {object} profile
 * @param {string} skinId
 * @returns {{ ok: boolean, isNew: boolean, error?: 'unknown' }}
 */
export function grantSkin(profile, skinId) {
  const s = SKIN_MAP[skinId];
  if (!s) return { ok: false, isNew: false, error: 'unknown' };
  if (!isStoredSkin(s)) return { ok: true, isNew: false };
  if (!Array.isArray(profile.skins)) profile.skins = [];
  if (profile.skins.includes(skinId)) return { ok: true, isNew: false };
  profile.skins.push(skinId);
  return { ok: true, isNew: true };
}

/** How a player gets an outfit, for chips ("short") and the outfit card ("long"). */
export function skinHow(skin) {
  const unit = UNIT_MAP[skin.unitId];
  const name = unit ? unit.name : 'her';
  switch (skin.acquisition?.type) {
    case 'default':
      return { short: 'Default', long: `${name}'s everyday outfit.` };
    case 'withUnit':
      return { short: `Free with ${name}`, long: skin.acquisition.note || `Comes free with ${name}.` };
    case 'shop':
      return { short: 'Mall', long: skin.acquisition.note || 'Sold in the Mall.' };
    case 'event':
      return { short: 'Event', long: skin.acquisition.note || 'An event reward.' };
    default:
      return { short: '', long: '' };
  }
}

/**
 * Every outfit of a girl with its state for the outfit picker (default first).
 * @param {object} profile
 * @param {string} unitId
 * @returns {{ skin: object, owned: boolean, equipped: boolean, how: { short: string, long: string } }[]}
 */
export function skinChoices(profile, unitId) {
  const eq = equippedSkinId(profile, unitId);
  return skinsForUnit(unitId).map((skin) => ({ skin, owned: ownsSkin(profile, skin.id), equipped: skin.id === eq, how: skinHow(skin) }));
}

/**
 * Equipped outfits of several girls, for preloadModels / createBattleRenderer.
 * @param {object} profile
 * @param {string[]} unitIds
 * @returns {Object<string, string>} unitId -> skin id
 */
export function formationSkins(profile, unitIds) {
  const out = {};
  for (const id of unitIds || []) if (id) out[id] = equippedSkinId(profile, id);
  return out;
}

/** Does the girl wear something other than her default outfit? (hanger badge on cards) */
export function hasOutfitOn(profile, unitId) {
  return equippedSkinId(profile, unitId) !== defaultSkinId(unitId);
}

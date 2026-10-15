// Online identity: display name (chosen once), avatar (the lobby secretary) and player level
// (account level). Kept in its own storage key, outside the save, so the save format stays
// unchanged. In local mode each tab is its own player, so the name lives in sessionStorage.
import { accountLevel } from '../ui/components.js';

export const IDENTITY_KEY = 'ss-online-v1';

function box(local) {
  try {
    return local ? globalThis.sessionStorage : globalThis.localStorage;
  } catch {
    return null;
  }
}

/** @param {boolean} perTab store per tab (local adapter) */
export function readIdentity(perTab = false) {
  try {
    const v = JSON.parse(box(perTab)?.getItem(IDENTITY_KEY) || 'null');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export function writeIdentity(patch, perTab = false) {
  const next = { ...readIdentity(perTab), ...patch };
  try {
    box(perTab)?.setItem(IDENTITY_KEY, JSON.stringify(next));
  } catch {
    /* private mode: the name is asked again next time */
  }
  return next;
}

/** Profile fields the server shows next to the name (the avatar: the Sensei Profile picture, else the secretary). */
export function profileCard(profile) {
  return { level: accountLevel(profile).level, avatar: profile?.sensei?.avatar || profile?.secretary || 'hikari' };
}

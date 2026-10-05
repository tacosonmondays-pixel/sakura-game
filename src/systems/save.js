// STUB — owned by systems. Replace with the full implementation (see CONTRACTS.md §5).
export const SAVE_KEY = 'sakura-sentinels-save-v1';
export const SAVE_VERSION = 1;
export function createProfile() {
  return { version: 1, currencies: { coins: 0, gems: 0 }, items: {}, units: {}, gear: {}, settings: {} };
}
export function migrateProfile(raw) { return raw; }
export function serializeProfile(p) { return btoa(JSON.stringify(p)); }
export function deserializeProfile(text) { return JSON.parse(atob(text)); }

// The map tiers' names as players see them: our own four (Sprout, Blossom, Storm, Oni). The tier keys
// (beginner … expert), their colours and every save stay as they are in src/data/types.js MAP_TIERS; that file is
// part of the co-op build id (tools/simId.mjs), so the shown names live here, outside it. Every screen and the wiki
// read MAP_TIER_VIEW (or mapTierName), never MAP_TIERS[key].name.
import { MAP_TIERS } from './types.js';

/** Shown name per tier key. */
export const MAP_TIER_NAMES = Object.freeze({
  beginner: 'Sprout',
  intermediate: 'Blossom',
  advanced: 'Storm',
  expert: 'Oni',
});

/** MAP_TIERS with the shown names: { [key]: { name, color } }, same keys and colours. */
export const MAP_TIER_VIEW = Object.freeze(Object.fromEntries(Object.entries(MAP_TIERS).map(([key, t]) => [key, Object.freeze({ ...t, name: MAP_TIER_NAMES[key] || t.name })])));

/** The shown name of a tier key (the key itself when unknown). */
export const mapTierName = (key) => MAP_TIER_VIEW[key]?.name || String(key ?? '');

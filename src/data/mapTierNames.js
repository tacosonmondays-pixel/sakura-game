// The map tiers' names as players see them: our own four (Sprout, Bud, Storm, Oni). The tier keys
// (beginner … expert), their colours and every save stay as they are in src/data/types.js MAP_TIERS; that file is
// part of the co-op build id (tools/simId.mjs), so the shown names live here, outside it. Every screen and the wiki
// read MAP_TIER_VIEW (or mapTierName), never MAP_TIERS[key].name.
// A shown name never repeats a Freeplay tier's or a difficulty's name (Blossom is a Freeplay tier), so one word keeps
// one meaning on the stage prep and the Endless list (tests/data/mapTierNames.test.js).
import { MAP_TIERS } from './types.js';

/** Shown name per tier key. */
export const MAP_TIER_NAMES = Object.freeze({
  beginner: 'Sprout',
  intermediate: 'Bud',
  advanced: 'Storm',
  expert: 'Oni',
});

/**
 * Text-safe colour per tier key: the tier's hue, dark enough for 4.5:1 as words on a white card or the sky
 * (VAULT §9: the MAP_TIERS colours are fills, 1.6–2.8:1 as text). Badges keep the fill and use navy letters.
 * tools/contrast.mjs checks every pair.
 */
export const MAP_TIER_TEXT = Object.freeze({
  beginner: '#166f47',
  intermediate: '#1a5f99',
  advanced: '#8f4b00',
  expert: '#b81d3b',
});

/** MAP_TIERS with the shown names: { [key]: { name, color, text } }, same keys and fill colours; `text` is for words. */
export const MAP_TIER_VIEW = Object.freeze(Object.fromEntries(Object.entries(MAP_TIERS).map(([key, t]) => [key, Object.freeze({ ...t, name: MAP_TIER_NAMES[key] || t.name, text: MAP_TIER_TEXT[key] || '#1f2a44' })])));

/** The shown name of a tier key (the key itself when unknown). */
export const mapTierName = (key) => MAP_TIER_VIEW[key]?.name || String(key ?? '');

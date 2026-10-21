// Ascension's save safety (docs/specs/ASCENSION.md §F): the mirrors that bring back what an older
// build drops when it loads and saves (owner: systems).
//
// An older build's cleanUnit is an allowlist: it drops `pl` (bought Potential), clamps
// `breakthrough` to 0–5 and the level to 60, and its migrate drops item ids it does not know. Every
// build keeps `missions.counters` word for word, so each of those values has a copy there:
//   pl:<id>   her bought Potential (1–6), written whenever it changes
//   bt:<id>   her gates when above 5
//   inv:<id>  the count of each of the 16 Ascension items (0 once spent; inventory.js setCount)
//   lvA:<id>  her level when above 60, beside P3's 'lv:' shadow (both written by progression.js shadowLevel,
//             at every level-up and every load, so only from a settled level)
// migrateProfile restores them by max (items: only when the item is missing from the save).
// Levels above 60 come back by max('lv:', 'lvA:') (progression.js settleLevels). 'lv:' alone is not
// enough: a Potential-v3 build (v0.1.37, v0.1.38) knows 'lv:' but not `pl`, so it clamps a girl whose
// bought P is above 1 + dupes to its own, lower cap and rewrites 'lv:' down to that. No build before
// Ascension writes 'lvA:', so it keeps her real level.
//
// Pure functions; save.js, inventory.js and essence.js call them.

import { ASCENSION_ITEM_IDS } from '../data/items.js';

export const PL_PREFIX = 'pl:';
export const BT_PREFIX = 'bt:';
export const INV_PREFIX = 'inv:';
/** Ascension's own level mirror (no older build writes it; progression.js reads it with 'lv:'). */
export const LEVEL_MIRROR_PREFIX = 'lvA:';
/** Most gates any girl can hold (gate 10 opens level 85). */
export const GATES_MAX = 10;
/** Highest bought Potential. */
const P_MAX = 6;

const MIRRORED = new Set(ASCENSION_ITEM_IDS);
const whole = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const counters = (profile) => ((profile.missions ||= {}).counters ||= {});

/** @returns {boolean} the item's count is mirrored in `inv:` */
export const isMirroredItem = (id) => MIRRORED.has(id);

/** Write an item's mirror (inventory.js setCount calls it for every mirrored id). */
export function mirrorItem(profile, id, count) {
  if (!MIRRORED.has(id) || !profile) return;
  counters(profile)[INV_PREFIX + id] = Math.max(0, Math.floor(count) || 0);
}

/** Write her `pl:` and `bt:` mirrors (after a Raise Potential, a gate, a migration). */
export function mirrorUnit(profile, unitId) {
  const u = profile?.units?.[unitId];
  if (!u) return;
  const c = counters(profile);
  if (u.pl != null) c[PL_PREFIX + unitId] = Math.min(P_MAX, Math.max(1, whole(u.pl)));
  if (u.breakthrough > 5) c[BT_PREFIX + unitId] = Math.min(GATES_MAX, whole(u.breakthrough));
}

/**
 * After a load: bring back `pl`, gates above 5 and the Ascension items an older build dropped.
 * Never lowers anything; a hostile mirror is clamped to the field's range (the level re-clamp to
 * her cap runs after, in save.js). Idempotent.
 * @returns {{ units: string[], items: string[] }} what was restored
 */
export function restoreAscension(profile) {
  const out = { units: [], items: [] };
  const c = profile?.missions?.counters || {};
  for (const [id, u] of Object.entries(profile?.units || {})) {
    const pl = Math.min(P_MAX, whole(c[PL_PREFIX + id]));
    const bt = Math.min(GATES_MAX, whole(c[BT_PREFIX + id]));
    let changed = false;
    if (pl >= 1 && !(whole(u.pl) >= pl)) {
      u.pl = pl;
      changed = true;
    }
    if (bt > (u.breakthrough || 0)) {
      u.breakthrough = bt;
      changed = true;
    }
    if (changed) out.units.push(id);
  }
  profile.items ||= {};
  for (const id of MIRRORED) {
    const n = whole(c[INV_PREFIX + id]);
    if (n > 0 && !(id in profile.items)) {
      profile.items[id] = n;
      out.items.push(id);
    }
  }
  return out;
}

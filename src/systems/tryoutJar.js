// The Marble Jar (docs/specs/TRYOUT_DAY.md §10.3): Tryout Day's shop between runs. Pure: no DOM, no storage.
//   desk      Desk Supplies, bought once; each has an on/off switch (profile.tryoutMeta.jar.off), and the ones on ride
//             in a new solo run's record as `perks` (src/systems/tryoutRuns.js activePerks; never in the Weekly)
//   cosmetic  bought once; ownership only (+ which one is in use: profile.tryoutMeta.jar.sel[kind])
//   material  a weekly stock (missions.counters 'ty:jw:<id>', cleared by the week's rollover)
// Ownership of once-only items is the bit mask 'ty:jar' in missions.counters (every build keeps it), so an older
// build that drops profile.tryoutMeta can lose a switch or a selection, never a purchase.
import { TRYOUT_META, JAR_MAP } from '../data/tryoutMeta.js';
import { MATERIAL_FAMILIES } from '../data/types.js';
import { addItems } from './inventory.js';
import { jarOwned, perkOn } from './tryoutRuns.js';
import { counters, marbles, spendMarbles, syncWeek } from './tryoutRewards.js';
import { tryoutMeta } from './tryoutYearbook.js';

const K = TRYOUT_META.keys;
const whole = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const FAMILIES = Object.keys(MATERIAL_FAMILIES);

export { jarOwned, perkOn };

function jarState(profile) {
  const m = tryoutMeta(profile);
  const j = (m.jar = m.jar && typeof m.jar === 'object' && !Array.isArray(m.jar) ? m.jar : {});
  if (!Array.isArray(j.off)) j.off = [];
  if (!j.sel || typeof j.sel !== 'object' || Array.isArray(j.sel)) j.sel = {};
  return j;
}

/** Weekly stock left of a material offer. */
export function stockLeft(profile, id, now = Date.now()) {
  const it = JAR_MAP[id];
  if (!it?.perWeek) return 0;
  syncWeek(profile, now);
  return Math.max(0, it.perWeek - whole(counters(profile)[K.weekJar + id]));
}

/** The Jar's shelves with each item's state. */
export function jarShelves(profile, now = Date.now()) {
  const held = marbles(profile);
  const sel = jarState(profile).sel;
  const rows = TRYOUT_META.jar.map((it) => {
    const once = it.shelf !== 'material';
    const owned = once && jarOwned(profile, it.id);
    const left = once ? (owned ? 0 : 1) : stockLeft(profile, it.id, now);
    return {
      id: it.id, shelf: it.shelf, kind: it.kind || null, price: it.price, owned, left, perWeek: it.perWeek || 0,
      canBuy: left > 0 && held >= it.price, on: it.perk ? perkOn(profile, it.perk) : null, perk: it.perk || null,
      selected: it.kind ? sel[it.kind] === it.id : false, family: !!it.family,
    };
  });
  return {
    marbles: held,
    desk: rows.filter((r) => r.shelf === 'desk'),
    cosmetic: rows.filter((r) => r.shelf === 'cosmetic'),
    material: rows.filter((r) => r.shelf === 'material'),
  };
}

/**
 * Buys one Jar item. A family pack needs `family` (a material family id).
 * @returns {{ ok: boolean, error?: 'unknown'|'owned'|'soldOut'|'funds'|'family', rewards: object[] }}
 */
export function buyJar(profile, id, { family = null, now = Date.now() } = {}) {
  const it = JAR_MAP[id];
  if (!it) return { ok: false, error: 'unknown', rewards: [] };
  const once = it.shelf !== 'material';
  if (once && jarOwned(profile, id)) return { ok: false, error: 'owned', rewards: [] };
  if (!once && stockLeft(profile, id, now) <= 0) return { ok: false, error: 'soldOut', rewards: [] };
  if (it.family && !FAMILIES.includes(family)) return { ok: false, error: 'family', rewards: [] };
  if (!spendMarbles(profile, it.price)) return { ok: false, error: 'funds', rewards: [] };
  const c = counters(profile);
  if (once) {
    c[K.jar] = whole(c[K.jar]) + 2 ** it.bit;
    if (it.kind) {
      // the first of a kind goes straight into use
      const sel = jarState(profile).sel;
      if (!sel[it.kind]) sel[it.kind] = it.id;
    }
    return { ok: true, rewards: [] };
  }
  c[K.weekJar + id] = whole(c[K.weekJar + id]) + 1;
  const items = [...(it.items || []), ...(it.mats || []).map((m) => ({ id: `mat_${family}_${m.rarity}`, count: m.count }))];
  return { ok: true, rewards: addItems(profile, items) };
}

/** Switches a Desk Supply on or off (owned or not: the switch is remembered). */
export function setPerk(profile, perk, on) {
  const j = jarState(profile);
  j.off = j.off.filter((p) => p !== perk);
  if (!on) j.off.push(perk);
  return perkOn(profile, perk);
}

/** Puts an owned cosmetic in use (or `null` for none of that kind). @returns {boolean} */
export function selectCosmetic(profile, kind, id) {
  const sel = jarState(profile).sel;
  if (id == null) {
    delete sel[kind];
    return true;
  }
  const it = JAR_MAP[id];
  if (!it || it.kind !== kind || !jarOwned(profile, id)) return false;
  sel[kind] = id;
  return true;
}

/** The cosmetic in use of a kind (owned), or null. */
export function selectedCosmetic(profile, kind) {
  const id = profile?.tryoutMeta?.jar?.sel?.[kind];
  return id && JAR_MAP[id]?.kind === kind && jarOwned(profile, id) ? id : null;
}

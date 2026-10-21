// Multi-salvage (owner: "Can you add multi salvage?"): pick many gear pieces in the Backpack and
// salvage them in one go. Each piece goes through salvageGear (src/systems/gear.js), so locked
// and equipped gear stay protected exactly as for a single salvage; rewards are merged per item.
import { salvageGear, salvageRewards } from './gear.js';
import { ITEM_RARITY_ORDER } from '../data/types.js';

/** Why a piece can't be salvaged right now, or null when it can. */
export function salvageBlock(gear) {
  if (!gear) return 'missing';
  if (gear.locked) return 'locked';
  if (gear.equippedBy) return 'equipped';
  return null;
}

/** Adds reward lists together: [{ id, count }] with one entry per item, first-seen order. */
export function mergeRewards(lists) {
  const out = new Map();
  for (const list of lists) for (const r of list) out.set(r.id, (out.get(r.id) || 0) + r.count);
  return [...out].map(([id, count]) => ({ id, count }));
}

/** Worth a second look before it goes: Mythic or better, or enhanced (+1 or more). */
export function isPrecious(gear) {
  return ITEM_RARITY_ORDER.indexOf(gear.rarity) >= ITEM_RARITY_ORDER.indexOf('mythic') || gear.level > 0;
}

/**
 * What salvaging these pieces would do (nothing changes).
 * @returns {{ uids: string[], skipped: { uid: string, why: string }[], rewards: { id, count }[],
 *   precious: string[] }} precious: the uids (of `uids`) that isPrecious
 */
export function salvagePreview(profile, uids) {
  const ok = [];
  const skipped = [];
  for (const uid of new Set(uids)) {
    const why = salvageBlock(profile.gear[uid]);
    if (why) skipped.push({ uid, why });
    else ok.push(uid);
  }
  return {
    uids: ok,
    skipped,
    rewards: mergeRewards(ok.map((uid) => salvageRewards(profile.gear[uid], profile))),
    precious: ok.filter((uid) => isPrecious(profile.gear[uid])),
  };
}

/**
 * Salvages every piece that can be salvaged.
 * @returns {{ count: number, rewards: { id, count }[], skipped: { uid: string, why: string }[] }}
 */
export function salvageMany(profile, uids) {
  const { uids: ok, skipped } = salvagePreview(profile, uids);
  const got = [];
  let count = 0;
  for (const uid of ok) {
    const res = salvageGear(profile, uid);
    if (res.ok) {
      count++;
      got.push(res.rewards);
    } else skipped.push({ uid, why: res.error });
  }
  return { count, rewards: mergeRewards(got), skipped };
}

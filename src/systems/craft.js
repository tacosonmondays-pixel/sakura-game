// The Craft Room (owner: systems): turn 3 of a family material into 1 of the next tier, or 2 of one
// family into 1 of another family at the same tier, for coins (docs/specs/ASCENSION.md §B.6, owner
// answer 4). Not "Workshop": the Workshop Yard bounty already has that name.
//
// The top steps are weekly-capped (counters 'craft:<kind>:<tier>' with 'craft:wk' = the game week):
// combining legendary → Zenith 3 a week, mythic → legendary 10; swapping legendary 5, Zenith 2.
// The week only moves forward (like the Titan keys): a clock set back never clears the caps.
// Crowns, books, fragments and Essence never go through it.

import { MATERIAL_FAMILIES, ITEM_RARITY_ORDER } from '../data/types.js';
import { ITEMS, materialId, zenithId } from '../data/items.js';
import { gameWeekNumber } from '../core/reset.js';
import { consumeItems, addItems, missingItems } from './inventory.js';
import { track } from './missions.js';

/** Family tiers in order, the seventh being Zenith. */
export const CRAFT_TIERS = Object.freeze([...ITEM_RARITY_ORDER, 'zenith']);

/** Coins per result of combining INTO each tier (3 of the tier below → 1). */
export const COMBINE_FEE = Object.freeze({ rare: 5000, superRare: 15000, mythic: 40000, legendary: 100000, zenith: 150000 });
/** Coins per result of a family swap at each tier: half the combine fee into that tier (common 1,000). */
export const SWAP_FEE = Object.freeze({ common: 1000, rare: 2500, superRare: 7500, mythic: 20000, legendary: 50000, zenith: 75000 });
export const COMBINE_IN = 3;
export const SWAP_IN = 2;
/** Weekly caps (results per game week). */
export const WEEKLY_CAP = Object.freeze({ combine: { legendary: 10, zenith: 3 }, swap: { legendary: 5, zenith: 2 } });

const FAMILIES = Object.keys(MATERIAL_FAMILIES);
const whole = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const famItem = (family, tier) => (tier === 'zenith' ? zenithId(family) : materialId(family, tier));

/** A family material's family and tier (null for anything else). */
export function craftInfo(itemId) {
  const it = ITEMS[itemId];
  if (!it || it.category !== 'material' || !it.family) return null;
  return { family: it.family, tier: it.tier === 'zenith' ? 'zenith' : it.rarity };
}

function weekCounts(profile, now) {
  const c = ((profile.missions ||= {}).counters ||= {});
  const week = gameWeekNumber(+now);
  const was = c['craft:wk'];
  if (typeof was !== 'number' || !Number.isFinite(was) || week > was) {
    for (const k of Object.keys(c)) if (k.startsWith('craft:') && k !== 'craft:wk') delete c[k];
    c['craft:wk'] = week;
  }
  return c;
}

/** Results left this week for a capped step (Infinity when uncapped). */
export function craftLeft(profile, kind, tier, now = Date.now()) {
  const max = WEEKLY_CAP[kind]?.[tier];
  if (!max) return Infinity;
  return Math.max(0, max - whole(weekCounts(profile, now)[`craft:${kind}:${tier}`]));
}

/**
 * Preview one craft. `kind` 'combine': `itemId` is the INPUT (3 → 1 of the next tier, same family).
 * `kind` 'swap': `itemId` is the input and `toFamily` the family to get (2 → 1, same tier).
 * @returns {{ ok: boolean, reason?: string, in: { id: string, count: number }, out: { id: string, count: number }, coins: number, left: number, missing: object[] }}
 */
export function craftPreview(profile, kind, itemId, times = 1, toFamily = null, now = Date.now()) {
  const info = craftInfo(itemId);
  const n = Math.max(1, Math.floor(times) || 1);
  const fail = (reason) => ({ ok: false, reason, in: { id: itemId, count: 0 }, out: { id: itemId, count: 0 }, coins: 0, left: 0, missing: [] });
  if (!info) return fail('notMaterial');
  let outTier = info.tier;
  let outFamily = info.family;
  let perIn;
  let fee;
  if (kind === 'combine') {
    const i = CRAFT_TIERS.indexOf(info.tier);
    if (i < 0 || i >= CRAFT_TIERS.length - 1) return fail('top');
    outTier = CRAFT_TIERS[i + 1];
    perIn = COMBINE_IN;
    fee = COMBINE_FEE[outTier];
  } else if (kind === 'swap') {
    if (!FAMILIES.includes(toFamily) || toFamily === info.family) return fail('family');
    outFamily = toFamily;
    perIn = SWAP_IN;
    fee = SWAP_FEE[info.tier];
  } else return fail('kind');
  const left = craftLeft(profile, kind, outTier, now);
  const costs = [{ id: itemId, count: perIn * n }, { id: 'coins', count: fee * n }];
  const missing = missingItems(profile, costs);
  const base = { in: costs[0], out: { id: famItem(outFamily, outTier), count: n }, coins: fee * n, left, missing };
  if (n > left) return { ok: false, reason: 'weekly', ...base };
  if (missing.length) return { ok: false, reason: 'missing', ...base };
  return { ok: true, ...base };
}

/** Craft (see craftPreview). @returns {{ ok: boolean, reason?: string, out?: object, coins?: number }} */
export function craft(profile, kind, itemId, times = 1, toFamily = null, now = Date.now()) {
  const p = craftPreview(profile, kind, itemId, times, toFamily, now);
  if (!p.ok) return { ok: false, reason: p.reason, missing: p.missing };
  if (!consumeItems(profile, [p.in, { id: 'coins', count: p.coins }])) return { ok: false, reason: 'missing' };
  addItems(profile, [p.out]);
  const tier = craftInfo(p.out.id).tier;
  if (WEEKLY_CAP[kind]?.[tier]) {
    const c = weekCounts(profile, now);
    c[`craft:${kind}:${tier}`] = whole(c[`craft:${kind}:${tier}`]) + p.out.count;
  }
  track(profile, 'spendCoins', p.coins);
  return { ok: true, out: p.out, coins: p.coins, in: p.in };
}

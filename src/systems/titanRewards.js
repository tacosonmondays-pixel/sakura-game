// Titan Trials rewards: damage notches, the damage table, the Victory Chest, first clears and the
// Rainbow Meter (owner: systems). Tables from docs/specs/ASCENSION.md §C.5, §C.6, §C.8, §C.9.
//
// Every roll happens OUTSIDE the sim, after the battle, from a per-attempt seed
// (titanDropSeed: titan, tier, rank, the run's sim seed and the attempt counter 'tatt'), so the same
// attempt always rolls the same drops and co-op partners (M2) roll their own loot on their own save.
// Not co-op hashed: tuning these tables never moves the co-op id.

import { materialId, zenithId, gearBoxId, getItem } from '../data/items.js';
import { TITAN_MAP, tierLabel } from '../data/titans.js';
import { hashString } from '../core/rng.js';
import { rollGear, addGear, RAINBOW_BOX_ID } from './gear.js';
import { rollSetPiece, addSetPiece } from './gearSets.js';
import { addItems } from './inventory.js';

/** Damage notches: the share of her HP reached → the share of the damage table paid (§C.5). */
export const NOTCHES = Object.freeze([
  { id: 'victory', name: 'Victory', at: 1, pays: 1 },
  { id: 'gold', name: 'Gold', at: 0.75, pays: 0.85 },
  { id: 'silver', name: 'Silver', at: 0.5, pays: 0.6 },
  { id: 'bronze', name: 'Bronze', at: 0.25, pays: 0.35 },
]);

/** @returns {{ id: string, name: string, at: number, pays: number }|null} the notch a result reached (null under 25 %) */
export function notchFor(share, victory = false) {
  if (victory) return NOTCHES[0];
  return NOTCHES.slice(1).find((n) => share >= n.at) || null;
}

/** Titan of the Week pays this many times the Assault Tokens (§C.1). */
export const TOTW_TOKEN_MUL = 1.5;
/** The Rainbow Meter: a Rainbow Gear Box at the latest on this Mayhem Victory Chest (§C.8). */
export const RAINBOW_METER = 40;
export const METER_KEY = 'pity:rain';

/**
 * The damage table per tier, paid × the notch share (a fraction rolls as a chance, so 0.2 legendary
 * is a 20 % legendary). `rank` adds the Mayhem per-rank growth. Families: `target` = the tapped one,
 * `other` = her second.
 */
export function damageTable(tier, rank = 0) {
  const r = tier === 'mayhem' ? Math.max(0, rank) : 0;
  switch (tier) {
    case 'normal': return { coins: 8000, star_fragment: 5, token_boss: 10, target: [['superRare', 3], ['rare', 2]], other: [['rare', 2]], books: [['book_superRare', 2]] };
    case 'hard': return { coins: 20000, star_fragment: 5, token_boss: 15, target: [['mythic', 1], ['superRare', 2]], other: [['superRare', 2]], books: [['book_mythic', 1]] };
    case 'nightmare': return { coins: 60000, star_fragment: 5, token_boss: 20, target: [['mythic', 1], ['legendary', 0.2]], other: [['mythic', 0.5]], books: [['book_legendary', 0.2]] };
    case 'mayhem': return { coins: 80000 + 5000 * r, star_fragment: 6, token_boss: 25 + 2 * r, target: [['mythic', 1], ['legendary', 0.5 + 0.05 * r]], other: [['legendary', 0.3]], books: [['book_legendary', 0.3]] };
    default: return null;
  }
}

const cap = (v, max) => Math.min(max, v);

/**
 * The Victory Chest per tier (§C.6): its lines (each rolls on its own) and its one gear box.
 * `box`: [kind, chance] in roll order; kinds are item rarities, or 'rainbow' (the UR box).
 */
export function victoryChest(tier, rank = 0) {
  const r = tier === 'mayhem' ? Math.max(0, rank) : 0;
  switch (tier) {
    case 'normal': return { target: [['superRare', 1]], zenith: 0, crownShard: 0, crown: 0, kindredShard: 0, box: [['rare', 0.7], ['superRare', 0.3]] };
    case 'hard': return { target: [['legendary', 0.25]], zenith: 0, crownShard: 0.1, crown: 0, kindredShard: 0, box: [['legendary', 0.03], ['mythic', 0.25], ['superRare', 0.72]] };
    case 'nightmare': return { target: [['legendary', 0.7]], zenith: 0.2, crownShard: 0.25, crown: 0, kindredShard: 0, box: [['rainbow', 0.005], ['legendary', 0.25], ['mythic', 0.595], ['superRare', 0.15]] };
    case 'mayhem': {
      const rainbow = cap(0.04 + 0.0025 * r, 0.06);
      return {
        target: [['legendary', 1]], zenith: cap(0.5 + 0.05 * r, 0.9), crownShard: 1 + 0.25 * r, crown: cap(0.01 + 0.0025 * r, 0.03), kindredShard: 0.04,
        box: [['rainbow', rainbow], ['legendary', 0.45], ['mythic', 1 - 0.45 - rainbow]], meter: true,
      };
    }
    default: return null;
  }
}

/** First clears, once per titan per tier step, on a SOLO Victory (§C.9). */
export function firstClearTable(tier, rank = 0) {
  if (tier === 'mayhem' && rank > 0) return { gems: 0, items: [['crown_rainbow_shard', 1], ['token_boss', 10]] };
  switch (tier) {
    case 'normal': return { gems: 100, items: [['kindred_r', 2], ['star_fragment', 20]] };
    case 'hard': return { gems: 150, items: [['kindred_sr', 1], ['crown_rainbow_shard', 2], ['gearbox:mythic', 1]] };
    case 'nightmare': return { gems: 250, items: [['crown_rainbow_shard', 3], ['zenith', 2], ['gearbox:legendary', 1]] };
    case 'mayhem': return { gems: 400, items: [['crown_rainbow', 1], ['zenith', 2], ['gearbox:legendary', 1]] };
    default: return null;
  }
}

/** Seed of one attempt's drops (§C.6): fixed by the attempt, so a re-applied result rolls the same. */
export function titanDropSeed(titanId, tier, rank, simSeed, attempt) {
  return hashString(`titan:${titanId}:${tier}:${rank}:${(simSeed >>> 0)}:${attempt}`);
}

/** A whole part always pays; a fraction pays one more at that chance. */
function rollAmount(rng, x) {
  const base = Math.floor(x + 1e-9);
  return base + (rng.next() < x - base ? 1 : 0);
}

/**
 * The gear-box grant (one seam for every box Titan Trials pays). Ordinary boxes open at once into
 * real gear (as battle drops do, src/systems/rewards.js), a fresh Mythic+ piece joining a random Academy
 * Club like every other drop (GEAR_STATS.md §K.2's Club Focus is not built yet). The Rainbow Gear Box
 * goes to the Backpack, where only its slot picker opens it: UR gear's `openRainbowBox`
 * (src/systems/gear.js) turns it into a Legendary piece already rainbow UR, +0, four substats, with the
 * `gbx:<uid>` mirror (ASCENSION.md §C.8).
 * The gear update (GEAR_UPDATE.md §3.6): with `set` (the titan's set), a Super Rare or better box opens into a piece of
 * that set, its slot at random among the five; Normal's Rare box stays a No-set classic piece. A box kind that is an
 * item id (a Set Box) goes to the Backpack.
 * @param {'rare'|'superRare'|'mythic'|'legendary'|'rainbow'|string} rarity
 * @param {{ set?: string|null }} [opts]
 * @returns {{ item: { id: string, count: number }|null, gear: object|null }}
 */
export function grantGearBox(profile, rarity, rng, { set = null } = {}) {
  if (rarity === 'rainbow' || getItem(rarity)?.pickSet) {
    const id = rarity === 'rainbow' ? RAINBOW_BOX_ID : rarity;
    addItems(profile, [{ id, count: 1 }]);
    return { item: { id, count: 1 }, gear: null };
  }
  const id = gearBoxId(rarity);
  if (!getItem(id)) return { item: null, gear: null };
  if (set && rarity !== 'rare') return { item: null, gear: addSetPiece(profile, rollSetPiece(rng, set, { rarity })) };
  const g = rollGear(rng, { rarity });
  const uid = addGear(profile, g, { club: 'random' });
  return { item: null, gear: profile.gear[uid] };
}

/** The family materials of a [rarity, amount] list, rolled. */
function famLines(rng, family, lines) {
  const out = [];
  for (const [r, x] of lines || []) {
    const n = rollAmount(rng, x);
    if (n > 0) out.push({ id: r === 'zenith' ? zenithId(family) : materialId(family, r), count: n });
  }
  return out;
}

/**
 * Roll one result's rewards (pure; nothing is added here). `share` is the notch's pay share; a
 * Victory adds the Victory Chest. The box is returned as a kind; the caller grants it (grantGearBox).
 * @param {{ titanId: string, tier: string, rank?: number, target: string, share: number, victory: boolean,
 *   totw?: boolean, meter?: number }} o meter = the Rainbow Meter before this chest
 * @returns {{ items: object[], box: string|null, meterAfter: number|null, rainbowForced: boolean, chest: object|null }}
 */
export function rollTitanRewards(rng, { titanId, tier, rank = 0, target, share, victory, totw = false, meter = 0 }) {
  const t = TITAN_MAP[titanId];
  const other = t.families.find((f) => f !== target) || t.families[1];
  const table = damageTable(tier, rank);
  const items = [];
  const pay = (x) => x * share;
  items.push({ id: 'coins', count: Math.round(pay(table.coins)) });
  items.push({ id: 'star_fragment', count: rollAmount(rng, pay(table.star_fragment)) });
  items.push({ id: 'token_boss', count: Math.round(pay(table.token_boss) * (totw ? TOTW_TOKEN_MUL : 1)) });
  items.push(...famLines(rng, target, table.target.map(([r, x]) => [r, pay(x)])));
  items.push(...famLines(rng, other, table.other.map(([r, x]) => [r, pay(x)])));
  for (const [id, x] of table.books) {
    const n = rollAmount(rng, pay(x));
    if (n > 0) items.push({ id, count: n });
  }
  let box = null;
  let meterAfter = null;
  let rainbowForced = false;
  let chest = null;
  if (victory) {
    const c = victoryChest(tier, rank);
    chest = { items: [] };
    chest.items.push(...famLines(rng, target, c.target));
    if (c.zenith && rng.next() < c.zenith) chest.items.push({ id: zenithId(target), count: 1 });
    if (c.crownShard) {
      const n = rollAmount(rng, c.crownShard);
      if (n > 0) chest.items.push({ id: 'crown_rainbow_shard', count: n });
    }
    if (c.crown && rng.next() < c.crown) chest.items.push({ id: 'crown_rainbow', count: 1 });
    if (c.kindredShard && rng.next() < c.kindredShard) chest.items.push({ id: 'kindred_shard_ssr', count: 1 });
    // one gear box: a single roll over the box table, in order
    let roll = rng.next();
    for (const [kind, p] of c.box) {
      if (roll < p) {
        box = kind;
        break;
      }
      roll -= p;
    }
    box ||= c.box[c.box.length - 1][0];
    if (c.meter) {
      // the Rainbow Meter: the 40th Mayhem chest without a Rainbow box is one
      if (box !== 'rainbow' && meter + 1 >= RAINBOW_METER) {
        box = 'rainbow';
        rainbowForced = true;
      }
      meterAfter = box === 'rainbow' ? 0 : meter + 1;
    } else if (box === 'rainbow') meterAfter = 0;
    items.push(...chest.items);
  }
  return { items: items.filter((i) => i.count > 0), box, meterAfter, rainbowForced, chest, label: `${t.name} — ${tierLabel(tier, rank)}` };
}

/** First-clear rewards as a list (zenith → the target family; boxes as `gearbox:<rarity>` kinds). */
export function firstClearRewards(tier, rank, target) {
  const fc = firstClearTable(tier, rank);
  if (!fc) return { items: [], boxes: [] };
  const items = fc.gems ? [{ id: 'gems', count: fc.gems }] : [];
  const boxes = [];
  for (const [id, n] of fc.items) {
    if (id === 'zenith') items.push({ id: zenithId(target), count: n });
    else if (id.startsWith('gearbox:')) for (let i = 0; i < n; i++) boxes.push(id.slice(8));
    else items.push({ id, count: n });
  }
  return { items, boxes };
}

/**
 * Expected value of one line of a table at a share (the hub's "Victory Chest" line and the tests).
 * @returns {{ legendary: number, zenith: number, crownShards: number, crown: number, rainbow: number, celestial: number, radiant: number }}
 */
export function chestOdds(tier, rank = 0) {
  const c = victoryChest(tier, rank);
  if (!c) return null;
  const box = Object.fromEntries(c.box);
  return {
    legendary: c.target.filter(([r]) => r === 'legendary').reduce((a, [, x]) => a + x, 0),
    zenith: c.zenith,
    crownShards: c.crownShard,
    crown: c.crown,
    kindredShard: c.kindredShard,
    rainbow: box.rainbow || 0,
    celestial: box.legendary || 0,
    radiant: box.mythic || 0,
  };
}

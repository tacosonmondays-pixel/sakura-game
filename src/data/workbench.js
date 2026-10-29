// The timed Workbench recipes (owner: data). docs/specs/BANNERS.md §G: start a craft, leave, come back.
// Inputs are family materials of ANY ONE family, chosen per craft, plus coins (paid up front). Outputs are
// never gems, tickets, Essence, crowns, Zenith, Rainbow Seeds or Starlight Needles (a test scans them).
//
// The ids are STABLE and APPEND-ONLY: a running craft stores only its recipe id in missions.counters
// ('wb:<slot>:r'), so an id must never be reused, renumbered or given another output (a test pins
// id → output). A save holding an id this build does not know shows "Update to collect" and keeps it.
//
// Weekly caps (§H): never higher than the matching shop rows. `everyOtherWeek`: startable on even game
// weeks only, like the Mall's ts_kindred_shard row (src/systems/shop.js offWeek).

/** Material tiers a recipe input can name ('zenith' is the seventh family tier, ASCENSION §B.3). */
export const WB_TIERS = Object.freeze(['common', 'rare', 'superRare', 'mythic', 'legendary', 'zenith']);

const HOUR = 3600000;

const r = (id, inputs, coins, out, hours, cap, extra = {}) => Object.freeze({
  id, inputs: Object.freeze(inputs.map(([tier, count]) => Object.freeze({ tier, count }))), coins,
  out: Object.freeze(out.map(([itemId, count]) => Object.freeze({ id: itemId, count }))),
  hours, ms: hours * HOUR, cap, everyOtherWeek: false, ...extra,
});

/** @type {ReadonlyArray<{ id: number, inputs: {tier: string, count: number}[], coins: number, out: {id: string, count: number}[], hours: number, ms: number, cap: number, everyOtherWeek: boolean }>} */
export const WB_RECIPES = Object.freeze([
  r(1, [['common', 6], ['rare', 2]], 4000, [['dice_reroll', 2]], 1, 3), // 2 Fortune Dice
  r(2, [['common', 10], ['rare', 2]], 6000, [['book_superRare', 3]], 4, 7), // 3 Academy Textbooks (6,000 EXP)
  r(3, [['rare', 6], ['superRare', 2]], 8000, [['book_mythic', 1]], 8, 4), // 1 Sage's Codex (8,000 EXP)
  r(4, [['rare', 4], ['superRare', 2]], 10000, [['lock_pin', 1]], 4, 2), // 1 Lock Pin
  r(5, [['superRare', 3], ['mythic', 1]], 15000, [['gearbox_superRare', 1]], 4, 2), // 1 Ornate Gear Box
  r(6, [['mythic', 2], ['legendary', 1]], 40000, [['gearbox_mythic', 1]], 8, 1), // 1 Radiant Gear Box
  r(7, [['legendary', 2], ['zenith', 1]], 60000, [['dice_prism', 1]], 12, 1, { everyOtherWeek: true }), // 1 Prism Dice
]);

/** id → recipe. */
export const WB_RECIPE_MAP = Object.freeze(Object.fromEntries(WB_RECIPES.map((x) => [x.id, x])));

/** Slots: 2, and a 3rd after the first clear of this stage. */
export const WB_BASE_SLOTS = 2;
export const WB_MAX_SLOTS = 3;
export const WB_THIRD_SLOT_STAGE = '6-5';
/** A device clock set back by more than this re-anchors every running slot (time left kept). */
export const WB_ROLLBACK_MS = 10 * 60000;
/** 'wb:seen' is written at most this often. */
export const WB_SEEN_EVERY_MS = 60000;

// The developer clan's Supply Bot (owner request: the developer clan's bot grants materials in
// any quantity). Pure grant logic, used by the sandbox panel (src/ui/online/supplyBot.js) and
// tests. Grants go into the local save like any reward; the panel is only reachable for
// members of the developer clan and is labelled as a developer sandbox.
import { getItem } from '../data/items.js';
import { addItems } from '../systems/inventory.js';

/** Largest single grant (keeps counts far below Number.MAX_SAFE_INTEGER). */
export const SUPPLY_MAX = 1_000_000_000;

/**
 * Grants `count` of an item or currency.
 * @param {object} profile
 * @param {string} id item id (materials, books, tickets, currencies, …)
 * @param {number|string} count
 * @returns {{ id: string, count: number }[]|null} what was added, or null for a bad request
 */
export function supplyGrant(profile, id, count) {
  const n = Math.floor(Number(count));
  if (!getItem(id) || !(n >= 1)) return null;
  return addItems(profile, [{ id, count: Math.min(n, SUPPLY_MAX) }]);
}

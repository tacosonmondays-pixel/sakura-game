// The five gear slots (docs/specs/GEAR_UPDATE.md §2). Not part of the co-op hash.
// GEAR_SLOTS and GEAR_MAIN_STATS in src/data/types.js stay frozen (the sim imports types.js): this file spreads them
// and adds the Hair Clip and the Necklace, which come only as set pieces. Every reader outside the sim takes its slots
// from here (tests/systems/gearSlots.test.js greps for it).
import { GEAR_SLOTS, GEAR_MAIN_STATS } from './types.js';

/** Every slot id, in card order. Append-only: mirrors store a slot's index (`gph:`, `gbx:`). */
export const SLOT_IDS = Object.freeze(['charm', 'ribbon', 'shoes', 'hair', 'necklace']);
/** The three classic slots: what a random drop rolls (rollGear with no slot), so no reward roll changes. */
export const ROLL_SLOTS = Object.freeze(['charm', 'ribbon', 'shoes']);
/** Slots that exist only as set pieces (set sources and Set Boxes). */
export const SET_ONLY_SLOTS = Object.freeze(['hair', 'necklace']);
/**
 * Slots the menus show. The reader (M0) knows all five but shows the classic three until the sets update (M2) gives
 * the Hair Clip and the Necklace their cards and sources.
 */
export const SHOWN_SLOTS = ROLL_SLOTS;

/** Name and blurb of every slot. */
export const GEAR_SLOT_DEFS = Object.freeze({
  ...GEAR_SLOTS,
  hair: Object.freeze({ name: 'Hair Clip', desc: 'Aura and focus.' }),
  necklace: Object.freeze({ name: 'Necklace', desc: 'Buffs and control.' }),
});

/**
 * Main stats by slot. The classic pools are frozen (an older build deletes a whole piece whose main stat it does not
 * know); the support stats are main stats only, never substats.
 */
export const MAIN_STATS_BY_SLOT = Object.freeze({
  ...GEAR_MAIN_STATS,
  hair: Object.freeze(['atkPct', 'critChance', 'auraPct', 'auraRangePct']),
  necklace: Object.freeze(['critDmg', 'ratePct', 'buffDurPct', 'controlPct']),
});

/** @returns {boolean} a known slot id */
export const isSlot = (slot) => SLOT_IDS.includes(slot);
/** @returns {boolean} a Hair Clip or Necklace (whole-piece mirrors, never a legacy mark) */
export const isNewSlot = (slot) => SET_ONLY_SLOTS.includes(slot);
/** @returns {string} the card name of a slot */
export const slotName = (slot) => GEAR_SLOT_DEFS[slot]?.name || slot;
/** @returns {object} an empty `unit.gear` with every slot */
export const emptySlots = () => Object.fromEntries(SLOT_IDS.map((s) => [s, null]));

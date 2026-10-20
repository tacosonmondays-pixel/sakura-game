// Limited events registry (EVENT_SPEC §3.3). Plain data: no DOM, no imports of stages.js,
// enemies.js, items.js or units.js (those join the event tables through ./wire.js).
import halloween from './halloween.js';

/** Every event ever shipped, drafts included (tests and the dev preview see all of them). */
export const ALL_EVENTS = Object.freeze([halloween]);

/** Events players can see (drafts never). */
export const EVENTS = Object.freeze(ALL_EVENTS.filter((e) => !e.draft));

export const EVENT_MAP = Object.freeze(Object.fromEntries(ALL_EVENTS.map((e) => [e.id, e])));
/** Every event stage / enemy / currency, past events included (old progress and items keep resolving). */
export const EVENT_STAGES = Object.freeze(ALL_EVENTS.flatMap((e) => e.stages));
export const EVENT_ENEMIES = Object.freeze(ALL_EVENTS.flatMap((e) => e.enemies || []));
export const EVENT_CURRENCIES = Object.freeze(ALL_EVENTS.map((e) => ({ ...e.currency, event: e.id })));

const STAGE_EVENT = Object.fromEntries(ALL_EVENTS.flatMap((e) => e.stages.map((s) => [s.id, e])));
const ITEM_EVENT = Object.fromEntries(ALL_EVENTS.map((e) => [e.currency.id, e]));

/** @returns {object|null} EventDef */
export function eventById(id) {
  return EVENT_MAP[id] || null;
}
/** @returns {object|null} the EventDef that owns a stage id */
export function eventOfStage(stageId) {
  return STAGE_EVENT[stageId] || null;
}
/** @returns {object|null} the EventDef whose currency this item is */
export function eventOfItem(itemId) {
  return ITEM_EVENT[itemId] || null;
}
/** @returns {boolean} an event stage id */
export const isEventStageId = (id) => Object.prototype.hasOwnProperty.call(STAGE_EVENT, id);

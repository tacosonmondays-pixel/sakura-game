// The timed Workbench (owner: systems). docs/specs/BANNERS.md §G. Pure functions, no DOM.
//
// Slots (2, a 3rd after the first clear of 6-5) each hold one craft. Starting one pays the inputs and the
// coins up front and uses one of the recipe's weekly crafts; Cancel (before it is done) refunds all of it,
// the weekly use included when it is still the same game week; Collect (a tap, once the timer is done)
// adds the output. No speed-ups.
//
// All state is numbers in missions.counters (an older build keeps that map word for word):
//   'wb:<slot>:r' recipe id (src/data/workbench.js, stable)   'wb:<slot>:n' family index (WB_FAMILIES)
//   'wb:<slot>:s' start ms   'wb:<slot>:e' end ms (device clock)
//   'wb:wk' the game week of the caps (forward only, like 'craft:wk')   'wb:cap:<id>' crafts started this week
//   'wb:seen' the last device time a Workbench action saw (open, start, cancel, collect; at most once a minute)
// A device clock set back by more than 10 minutes (behind 'wb:seen' or a slot's start) re-anchors every
// running slot so its time left is kept: a rollback can only delay a craft. A slot whose recipe id (or
// family index) this build does not know is never cleared: it shows "Update to collect".

import { WB_RECIPES, WB_RECIPE_MAP, WB_BASE_SLOTS, WB_MAX_SLOTS, WB_THIRD_SLOT_STAGE, WB_ROLLBACK_MS, WB_SEEN_EVERY_MS } from '../data/workbench.js';
import { materialId, zenithId } from '../data/items.js';
import { gameWeekNumber } from '../core/reset.js';
import { consumeItems, addItems, missingItems } from './inventory.js';
import { isStageCleared } from './unlocks.js';
import { track } from './missions.js';

/**
 * Family index → family (stored in 'wb:<slot>:n'). APPEND-ONLY, the order of MATERIAL_FAMILIES
 * (src/data/types.js) as it shipped; a test pins it.
 */
export const WB_FAMILIES = Object.freeze(['feather', 'blade', 'ember', 'rime', 'charm', 'rune', 'cog']);

export const WB_PREFIX = 'wb:';
const K = {
  r: (s) => `wb:${s}:r`, n: (s) => `wb:${s}:n`, s: (s) => `wb:${s}:s`, e: (s) => `wb:${s}:e`,
  cap: (id) => `wb:cap:${id}`, wk: 'wb:wk', seen: 'wb:seen',
};

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const whole = (v) => (isNum(v) && v > 0 ? Math.floor(v) : 0);
const countersOf = (profile) => ((profile.missions ||= {}).counters ||= {});
const peek = (profile) => profile?.missions?.counters || {};

/** The material id of one recipe input for a family. */
export function inputItem(family, tier) {
  return tier === 'zenith' ? zenithId(family) : materialId(family, tier);
}

/** A recipe's costs for one family: [{ id, count }] (materials, then coins). */
export function recipeCosts(recipe, family) {
  return [...recipe.inputs.map((i) => ({ id: inputItem(family, i.tier), count: i.count })), { id: 'coins', count: recipe.coins }];
}

/** Slots this profile has: 2, or 3 once 6-5 was cleared. */
export function slotCount(profile) {
  return isStageCleared(profile, WB_THIRD_SLOT_STAGE) ? WB_MAX_SLOTS : WB_BASE_SLOTS;
}

/** The game week the caps count in: forward only (a clock set back never moves it back). */
function capWeek(c, now) {
  const week = gameWeekNumber(+now);
  return isNum(c[K.wk]) && c[K.wk] > week ? c[K.wk] : week;
}

/** A newer game week clears the 'wb:cap:*' uses (never the slots). Writes. */
function rollWeek(profile, now) {
  const c = countersOf(profile);
  const week = gameWeekNumber(+now);
  if (!isNum(c[K.wk]) || week > c[K.wk]) {
    for (const k of Object.keys(c)) if (k.startsWith('wb:cap:')) delete c[k];
    c[K.wk] = week;
  }
  return c;
}

/** Crafts used this week of a recipe (0 when the stored week is older than now). */
function capUsed(c, id, now) {
  if (!isNum(c[K.wk]) || gameWeekNumber(+now) > c[K.wk]) return 0;
  return whole(c[K.cap(id)]);
}

/** The recipe is on its off week (everyOtherWeek: startable on even game weeks only, as the Mall). */
export function offWeek(recipe, profile, now = Date.now()) {
  return !!recipe?.everyOtherWeek && capWeek(peek(profile), now) % 2 === 1;
}

/** Crafts of a recipe still startable this week (0 on an off week). */
export function capLeft(profile, recipeId, now = Date.now()) {
  const recipe = WB_RECIPE_MAP[recipeId];
  if (!recipe) return 0;
  if (offWeek(recipe, profile, now)) return 0;
  return Math.max(0, recipe.cap - capUsed(peek(profile), recipeId, now));
}

/** The latest device time the Workbench has seen: 'wb:seen' and every slot's start. */
function lastKnown(c) {
  let t = isNum(c[K.seen]) ? c[K.seen] : -Infinity;
  for (let s = 1; s <= WB_MAX_SLOTS; s++) if (isNum(c[K.s(s)]) && c[K.s(s)] > t) t = c[K.s(s)];
  return t;
}

/** The device clock is behind what the Workbench saw by more than 10 minutes. */
export function rolledBack(profile, now = Date.now()) {
  return +now < lastKnown(peek(profile)) - WB_ROLLBACK_MS;
}

/** One slot's [start, end] as they read now (re-anchored, without writing, after a rollback). */
function slotTimes(c, slot, now, back, known) {
  const s0 = c[K.s(slot)];
  const e0 = c[K.e(slot)];
  if (!isNum(s0) || !isNum(e0)) return null;
  if (!back) return [s0, e0];
  const dur = Math.max(0, e0 - s0);
  const elapsed = Math.min(dur, Math.max(0, known - s0));
  const s = +now - elapsed;
  return [s, s + dur];
}

/**
 * Re-anchor every running slot after a clock set back by more than 10 minutes (time left kept), and
 * mark the Workbench seen (at most once a minute). Call on Workbench actions only. Writes.
 * @returns {boolean} a slot was re-anchored
 */
export function touchWorkbench(profile, now = Date.now()) {
  const c = countersOf(profile);
  const known = lastKnown(c);
  const back = +now < known - WB_ROLLBACK_MS;
  if (back) {
    for (let s = 1; s <= WB_MAX_SLOTS; s++) {
      const t = slotTimes(c, s, now, true, known);
      if (!t) continue;
      c[K.s(s)] = t[0];
      c[K.e(s)] = t[1];
    }
    c[K.seen] = +now;
    return true;
  }
  const seen = c[K.seen];
  if (!isNum(seen) || +now - seen >= WB_SEEN_EVERY_MS) c[K.seen] = +now;
  return false;
}

/**
 * One slot as it reads now (no writes).
 * @returns {{ slot: number, open: boolean, empty: boolean, known: boolean, recipe: object|null, recipeId: number|null,
 *   family: string|null, start: number, end: number, left: number, ready: boolean }}
 */
export function slotState(profile, slot, now = Date.now()) {
  const c = peek(profile);
  const open = slot >= 1 && slot <= slotCount(profile);
  const rid = c[K.r(slot)];
  if (!isNum(rid)) return { slot, open, empty: true, known: true, recipe: null, recipeId: null, family: null, start: 0, end: 0, left: 0, ready: false };
  const recipe = WB_RECIPE_MAP[rid] || null;
  const fam = WB_FAMILIES[c[K.n(slot)]] || null;
  const known = !!recipe && !!fam;
  const t = slotTimes(c, slot, now, rolledBack(profile, now), lastKnown(c)) || [+now, +now];
  const left = Math.max(0, t[1] - +now);
  return { slot, open: true, empty: false, known, recipe: known ? recipe : null, recipeId: rid, family: fam, start: t[0], end: t[1], left, ready: known && left <= 0 };
}

/**
 * The whole Workbench as it reads now (no writes): the slots (a running craft in a slot past the slot
 * count is still listed), each recipe's weekly use, and the next ready time.
 */
export function workbenchState(profile, now = Date.now()) {
  const count = slotCount(profile);
  const c = peek(profile);
  const slots = [];
  for (let s = 1; s <= WB_MAX_SLOTS; s++) if (s <= count || isNum(c[K.r(s)])) slots.push(slotState(profile, s, now));
  const recipes = WB_RECIPES.map((r) => ({ recipe: r, left: capLeft(profile, r.id, now), used: capUsed(c, r.id, now), off: offWeek(r, profile, now) }));
  const running = slots.filter((s) => !s.empty && s.known && !s.ready);
  return {
    slotCount: count,
    slots,
    recipes,
    ready: slots.filter((s) => s.ready).length,
    nextReadyIn: running.length ? Math.min(...running.map((s) => s.left)) : null,
  };
}

/** At least one craft is ready to collect (the lobby dot). */
export function workbenchReady(profile, now = Date.now()) {
  for (let s = 1; s <= WB_MAX_SLOTS; s++) if (slotState(profile, s, now).ready) return true;
  return false;
}

/**
 * Can this craft start? (no writes)
 * @returns {{ ok: boolean, reason?: 'slot'|'busy'|'recipe'|'family'|'offWeek'|'weekly'|'missing', costs: object[], missing: object[], left: number }}
 */
export function startPreview(profile, slot, recipeId, family, now = Date.now()) {
  const recipe = WB_RECIPE_MAP[recipeId];
  const costs = recipe && WB_FAMILIES.includes(family) ? recipeCosts(recipe, family) : [];
  const left = capLeft(profile, recipeId, now);
  const fail = (reason, missing = []) => ({ ok: false, reason, costs, missing, left });
  if (!Number.isInteger(slot) || slot < 1 || slot > slotCount(profile)) return fail('slot');
  if (!slotState(profile, slot, now).empty) return fail('busy');
  if (!recipe) return fail('recipe');
  if (!WB_FAMILIES.includes(family)) return fail('family');
  if (offWeek(recipe, profile, now)) return fail('offWeek');
  if (left <= 0) return fail('weekly');
  const missing = missingItems(profile, costs);
  if (missing.length) return fail('missing', missing);
  return { ok: true, costs, missing: [], left };
}

/** Start a craft: pays everything up front and uses one weekly craft. Writes. */
export function startCraft(profile, slot, recipeId, family, now = Date.now()) {
  touchWorkbench(profile, now);
  const p = startPreview(profile, slot, recipeId, family, now);
  if (!p.ok) return { ok: false, reason: p.reason, missing: p.missing };
  if (!consumeItems(profile, p.costs)) return { ok: false, reason: 'missing', missing: missingItems(profile, p.costs) };
  const c = rollWeek(profile, now);
  const recipe = WB_RECIPE_MAP[recipeId];
  c[K.cap(recipeId)] = whole(c[K.cap(recipeId)]) + 1;
  c[K.r(slot)] = recipeId;
  c[K.n(slot)] = WB_FAMILIES.indexOf(family);
  c[K.s(slot)] = +now;
  c[K.e(slot)] = +now + recipe.ms;
  return { ok: true, slot, recipe, end: +now + recipe.ms, costs: p.costs };
}

function clearSlot(c, slot) {
  for (const k of ['r', 'n', 's', 'e']) delete c[K[k](slot)];
}

/** Cancel a craft before it is done: refunds the inputs, the coins and (same game week) the weekly use. Writes. */
export function cancelCraft(profile, slot, now = Date.now()) {
  touchWorkbench(profile, now);
  const st = slotState(profile, slot, now);
  if (st.empty) return { ok: false, reason: 'empty' };
  if (!st.known) return { ok: false, reason: 'unknown' };
  if (st.ready) return { ok: false, reason: 'ready' };
  const c = countersOf(profile);
  const refund = recipeCosts(st.recipe, st.family);
  addItems(profile, refund);
  const startWeek = gameWeekNumber(c[K.s(slot)]);
  if (isNum(c[K.wk]) && startWeek === c[K.wk] && gameWeekNumber(+now) <= c[K.wk]) {
    const used = whole(c[K.cap(st.recipe.id)]) - 1;
    if (used > 0) c[K.cap(st.recipe.id)] = used;
    else delete c[K.cap(st.recipe.id)];
  }
  clearSlot(c, slot);
  return { ok: true, refund };
}

/** Collect a finished craft. Writes. */
export function collectCraft(profile, slot, now = Date.now()) {
  touchWorkbench(profile, now);
  const st = slotState(profile, slot, now);
  if (st.empty) return { ok: false, reason: 'empty' };
  if (!st.known) return { ok: false, reason: 'unknown' };
  if (!st.ready) return { ok: false, reason: 'running', left: st.left };
  const out = addItems(profile, st.recipe.out);
  clearSlot(countersOf(profile), slot);
  track(profile, 'spendCoins', st.recipe.coins); // counted once it is final (a cancelled craft spent nothing)
  return { ok: true, out, recipe: st.recipe };
}

/** Collect every ready slot. Writes. @returns {{ ok: boolean, out: object[], count: number }} */
export function collectAll(profile, now = Date.now()) {
  const out = [];
  let count = 0;
  for (let s = 1; s <= WB_MAX_SLOTS; s++) {
    const r = collectCraft(profile, s, now);
    if (r.ok) { out.push(...r.out); count++; }
  }
  return { ok: count > 0, out, count };
}

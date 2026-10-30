// Titan Trials, the weekly bosses: keys, tier unlocks, results, sweeps, first clears, the Rainbow
// Meter and the Titan of the Week (owner: systems). See docs/specs/ASCENSION.md §C.
//
// Everything lives in `missions.counters` (every build keeps it word for word):
//   tk:left, tk:week   Trial Keys left and the game week they were filled for (12 a week, up to 6
//                      unused carry over: 18 at most)
//   tbest:<titan>      best SOLO Victory, as tierStep + 1 (0 = none; normal 1, hard 2, nightmare 3,
//                      mayhem 4, mayhem +n 4 + n). A co-op Victory never raises it.
//   tfc:<titan>:<step> first clear paid (solo only)
//   ttgt:<titan>       the tapped target family (1 or 2 = her first or second family; 0/absent = auto)
//   tkill:<titan>      titans defeated (Titan Trials kills never count toward the bestiary's kills,
//                      so Freeplay achievements still need Freeplay)
//   tatt               attempt counter: the drop seed of each spent key or sweep
//   pity:rain          the Rainbow Meter (Mayhem Victory Chests since the last Rainbow Gear Box)
//   tk:tog, tk:togwk   Together Chests opened (co-op, 3 a week) and the game week they count for
// The week is the game week (src/core/reset.js gameWeekNumber: Sunday 7 PM Central).

import { TITANS, TITAN_MAP, TITAN_ROTATION, TITAN_TIERS, tierStep, stepTier, tierLabel, tierIndex, titanBattle, MAX_RANK } from '../data/titans.js';
import { UNIT_MAP, UNITS } from '../data/units.js';
import { ITEMS } from '../data/items.js';
import { gameWeekNumber, nextWeeklyReset } from '../core/reset.js';
import { createRng } from '../core/rng.js';
import { addItems, normalizeList, missingItems } from './inventory.js';
import { isStageCleared } from './unlocks.js';
import { track } from './missions.js';
import { fuseShards } from './essence.js';
import { breakthroughCost, MAX_BREAKTHROUGH, BASE_GATES } from './progression.js';
import { TITAN_SETS } from '../data/gearSets.js';
import { grantSetBoxGifts } from './gearSets.js';
import { rollTitanRewards, firstClearRewards, grantGearBox, notchFor, titanDropSeed, METER_KEY, RAINBOW_METER } from './titanRewards.js';

export const WEEKLY_KEYS = 12;
export const KEY_CARRY = 6;
/** Stage clears that open each tier (§C.3): Normal after 3-5, Hard after 6-5, Nightmare after 8-5. */
export const TIER_STAGE = Object.freeze({ normal: '3-5', hard: '6-5', nightmare: '8-5' });

const whole = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const counters = (profile) => ((profile.missions ||= {}).counters ||= {});
const cnt = (profile, k) => whole(profile?.missions?.counters?.[k]);

// ---------------------------------------------------------------------------
// Week, keys, Titan of the Week
// ---------------------------------------------------------------------------

/** The titan that pays +50 % Assault Tokens this game week (and is the clan board's titan). */
export function titanOfWeek(now = Date.now()) {
  return TITAN_ROTATION[((gameWeekNumber(+now) % TITAN_ROTATION.length) + TITAN_ROTATION.length) % TITAN_ROTATION.length];
}

/**
 * Fill the week's keys on the first look of a new game week: 12 + up to 6 unused. Idempotent.
 * @returns {number} keys left
 */
export function refreshKeys(profile, now = Date.now()) {
  const c = counters(profile);
  const week = gameWeekNumber(+now);
  if (c['tk:week'] !== week) {
    const had = 'tk:week' in c ? Math.min(KEY_CARRY, whole(c['tk:left'])) : 0;
    // a clock moved backwards never refills twice (the week only moves forward)
    if (!('tk:week' in c) || week > c['tk:week']) {
      c['tk:left'] = WEEKLY_KEYS + had;
      c['tk:week'] = week;
    }
  }
  return whole(c['tk:left']);
}

/** @returns {{ left: number, weekly: number, saved: number, resetsAt: number }} */
export function keyState(profile, now = Date.now()) {
  const left = refreshKeys(profile, now);
  return { left, weekly: WEEKLY_KEYS, saved: Math.max(0, left - WEEKLY_KEYS), resetsAt: nextWeeklyReset(+now) };
}

// ---------------------------------------------------------------------------
// Unlocks and progress
// ---------------------------------------------------------------------------

/** Her best SOLO Victory as a ladder step (−1 = none). */
export function bestStep(profile, titanId) {
  return cnt(profile, `tbest:${titanId}`) - 1;
}

/** The reason a tier is closed, or null when it is open. */
export function tierLock(profile, titanId, tier, rank = 0) {
  if (!TITAN_MAP[titanId] || tierIndex(tier) < 0) return 'unknown';
  const best = bestStep(profile, titanId);
  const stageGate = TIER_STAGE[tier];
  if (stageGate && !isStageCleared(profile, stageGate)) return `Clear ${stageGate} first`;
  const step = tierStep(tier, rank);
  if (step > 0 && best < step - 1) {
    const prev = stepTier(step - 1);
    return `Win ${tierLabel(prev.tier, prev.rank)} first`;
  }
  return null;
}

/** @returns {boolean} the tier is open (solo) */
export const tierOpen = (profile, titanId, tier, rank = 0) => !tierLock(profile, titanId, tier, rank);

/** Is Titan Trials open at all (the first tier of any titan)? */
export function titansUnlocked(profile) {
  return isStageCleared(profile, TIER_STAGE.normal);
}

/** The highest open step of a titan (−1 when none). */
export function topOpenStep(profile, titanId) {
  if (!tierOpen(profile, titanId, 'normal')) return -1;
  const best = bestStep(profile, titanId);
  let s = Math.min(3 + MAX_RANK, best + 1);
  while (s > 0 && !tierOpen(profile, titanId, stepTier(s).tier, stepTier(s).rank)) s--;
  return s;
}

/** The family a titan's drops target: the tapped one, else the auto pick (autoTarget). */
export function targetFamily(profile, titanId) {
  const t = TITAN_MAP[titanId];
  const pick = cnt(profile, `ttgt:${titanId}`);
  if (pick === 1 || pick === 2) return t.families[pick - 1];
  return autoTarget(profile, titanId).family;
}

/** Tap a target family chip. */
export function setTargetFamily(profile, titanId, family) {
  const t = TITAN_MAP[titanId];
  const i = t ? t.families.indexOf(family) : -1;
  if (i < 0) return false;
  counters(profile)[`ttgt:${titanId}`] = i + 1;
  return true;
}

/**
 * The girl whose next gate (6–10) is nearest to affordable, and what she still misses: the hub's
 * auto-pick ("Kage needs 2 Zenith Plume → Eclipse Wyrm"). `families` limits the girls to those
 * families. Null when no girl past gate 5 needs anything.
 * @returns {{ unitId: string, gate: number, family: string, missing: { id: string, need: number, have: number }[] }|null}
 */
export function nextGateNeed(profile, families = null) {
  let best = null;
  for (const u of UNITS) {
    const st = profile.units?.[u.id];
    if (!st || (families && !families.includes(u.materialFamily))) continue;
    const gate = (st.breakthrough || 0) + 1;
    if (gate <= BASE_GATES || gate > MAX_BREAKTHROUGH) continue;
    const missing = missingItems(profile, breakthroughCost(u.id, gate)).filter((m) => m.id !== 'coins');
    if (!missing.length) continue;
    const short = missing.reduce((a, m) => a + (m.need - m.have), 0);
    const score = [st.level || 0, -short];
    if (!best || score[0] > best.score[0] || (score[0] === best.score[0] && score[1] > best.score[1])) best = { unitId: u.id, gate, family: u.materialFamily, missing, score };
  }
  if (!best) return null;
  const { score, ...out } = best;
  return out;
}

/** Auto target for a titan: the family its next-gate girl needs, else her first family. */
export function autoTarget(profile, titanId) {
  const t = TITAN_MAP[titanId];
  const need = nextGateNeed(profile, t.families);
  return { family: need?.family || t.families[0], need };
}

/** The titan the hub opens on: the one that drops what the next gate needs, else the Titan of the Week. */
export function suggestedTitan(profile, now = Date.now()) {
  const need = nextGateNeed(profile);
  if (need) {
    const ofWeek = titanOfWeek(now);
    const fits = TITANS.filter((t) => t.families.includes(need.family));
    const pick = fits.find((t) => t.id === ofWeek) || fits[0];
    if (pick) return { titanId: pick.id, need };
  }
  return { titanId: titanOfWeek(now), need: null };
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function grantAll(profile, items, boxes, rng, set = null) {
  const out = { rewards: [], gear: [] };
  out.rewards = addItems(profile, items);
  for (const kind of boxes) {
    // (the gear update: a titan's chest boxes open into pieces of its set, GEAR_UPDATE.md §3.6)
    const g = grantGearBox(profile, kind, rng, { set });
    if (g.item) out.rewards.push(g.item);
    if (g.gear) out.gear.push(g.gear);
  }
  out.fused = fuseShards(profile);
  return out;
}

function payVictory(profile, titanId, tier, rank, rng, { share, victory, target, now }) {
  const c = counters(profile);
  const rolled = rollTitanRewards(rng, { titanId, tier, rank, target, share, victory, totw: titanOfWeek(now) === titanId, meter: whole(c[METER_KEY]) });
  const boxes = rolled.box ? [rolled.box] : [];
  if (rolled.meterAfter != null) c[METER_KEY] = rolled.meterAfter;
  return { rolled, boxes };
}

/**
 * Apply a finished titan battle (the tracker's read, src/data/titans.js createTitanTracker).
 * - under 25 %: nothing, and the key stays ("This one didn't count — try again!")
 * - Bronze / Silver / Gold: that share of the damage table; a key is used
 * - Victory: the whole table + the Victory Chest, the first clear (solo, once per tier step), a new
 *   best, the next tier opened; a key is used
 * `practice`: a run with no key (or a tier not open): plays, pays nothing, changes nothing.
 * @param {object} profile
 * @param {{ titanId: string, tier: string, rank?: number, seed: number, read: { share: number, victory: boolean, damage: number, pool: number, leaked: boolean },
 *   kills?: object, encountered?: string[], practice?: boolean, coop?: boolean }} r
 * @returns {{ ok: boolean, counted: boolean, practice: boolean, notch: object|null, rewards: object[], gear: object[], firstClear: object|null,
 *   chest: object|null, box: string|null, rainbowForced: boolean, meter: number, fused: object[], newBest: boolean, unlocked: string|null, label: string, keysLeft: number, error?: string }}
 */
export function applyTitanResult(profile, r, { now = Date.now() } = {}) {
  const { titanId, tier } = r;
  const rank = tier === 'mayhem' ? Math.max(0, Math.floor(r.rank) || 0) : 0;
  const out = { ok: true, counted: false, practice: false, notch: null, rewards: [], gear: [], firstClear: null, chest: null, box: null, rainbowForced: false, meter: cnt(profile, METER_KEY), fused: [], newBest: false, unlocked: null, label: tierLabel(tier, rank), keysLeft: refreshKeys(profile, now) };
  if (!TITAN_MAP[titanId] || tierIndex(tier) < 0) return { ...out, ok: false, error: 'unknown' };
  const read = r.read || { share: 0, victory: false };
  const victory = !!read.victory;
  const notch = notchFor(read.share || 0, victory);
  out.notch = notch;
  // the bestiary: titans become seen; kills go to tkill:, never to bestiary kills (§C.2)
  profile.bestiary ||= {};
  for (const id of r.encountered || []) (profile.bestiary[id] ||= { seen: false, discovered: false, kills: 0 }).seen = true;
  // a co-op run counts by the co-op rule (§C.11: a guest one step above her solo best, which includes
  // everything the host has open solo), a solo run by the solo one: a room a guest may join always pays
  const open = r.coop ? coopTierAllowed(profile, titanId, tier, rank) : tierOpen(profile, titanId, tier, rank);
  if (r.practice || out.keysLeft < 1 || !open) {
    out.practice = true;
    return out;
  }
  if (!notch) return out;
  const c = counters(profile);
  c['tk:left'] = out.keysLeft - 1;
  out.keysLeft -= 1;
  c.tatt = whole(c.tatt) + 1;
  out.counted = true;
  const rng = createRng(titanDropSeed(titanId, tier, rank, r.seed >>> 0, c.tatt));
  const target = targetFamily(profile, titanId);
  const { rolled, boxes } = payVictory(profile, titanId, tier, rank, rng, { share: notch.pays, victory, target, now });
  const items = [...rolled.items];
  out.chest = rolled.chest;
  out.box = rolled.box;
  out.rainbowForced = rolled.rainbowForced;
  if (victory) {
    const step = tierStep(tier, rank);
    if (!r.coop) {
      const fcKey = `tfc:${titanId}:${step}`;
      if (!cnt(profile, fcKey)) {
        const fc = firstClearRewards(tier, rank, target);
        items.push(...fc.items);
        // Nightmare's first-clear Legendary box becomes that titan's Legendary Set Box, paid by the one-time box check
        // below (su:titanbox:<titan>, §5.3), never on its own
        boxes.push(...(tier === 'nightmare' && TITAN_SETS[titanId] ? fc.boxes.filter((b) => b !== 'legendary') : fc.boxes));
        out.firstClear = fc;
        c[fcKey] = 1;
      }
      if (step + 1 > cnt(profile, `tbest:${titanId}`)) {
        c[`tbest:${titanId}`] = step + 1;
        out.newBest = true;
        const next = stepTier(step + 1);
        if (next && tierOpen(profile, titanId, next.tier, next.rank)) out.unlocked = tierLabel(next.tier, next.rank);
      }
    }
    // co-op (M2): the Together Chest, at most 3 a week
    if (r.coop) {
      const tog = payTogetherChest(profile, tier, rng, now);
      if (tog) {
        items.push(...tog);
        out.together = tog;
      }
    }
    c[`tkill:${titanId}`] = whole(c[`tkill:${titanId}`]) + 1;
    track(profile, 'battleWin', 1);
    track(profile, 'bossKill', 1);
    if (tierIndex(tier) >= tierIndex('hard')) track(profile, 'battleWinHard', 1);
    // one weekly boss loop: the Rainbow Hunt mission (src/data/missions.js w_rainbow) also counts titan wins
    track(profile, 'titanWin', 1);
  }
  const killed = Object.values(r.kills || {}).reduce((a, n) => a + (whole(n) || 0), 0);
  if (killed) track(profile, 'kill', killed);
  profile.stats ||= {};
  profile.stats.battles = whole(profile.stats.battles) + 1;
  if (victory) profile.stats.wins = whole(profile.stats.wins) + 1;
  // the one-time Set Boxes this result makes owed (a Nightmare first clear: that titan's; §5.3)
  items.push(...grantSetBoxGifts(profile, { mode: 'list' }));
  const g = grantAll(profile, normalizeList(items), boxes, rng, TITAN_SETS[titanId]);
  out.rewards = g.rewards;
  out.gear = g.gear;
  out.fused = g.fused;
  out.meter = cnt(profile, METER_KEY);
  return out;
}

// ---------------------------------------------------------------------------
// Co-op titans (M2, §C.11): the rules that need no battle wiring
// ---------------------------------------------------------------------------

/** Together Chests a player can open a game week (counters 'tk:tog', for the game week in 'tk:togwk'). */
export const TOGETHER_WEEKLY = 3;

/**
 * The Together Chest of a co-op Victory: 10 Assault Tokens, 5 Star Fragments and, from Hard, a Rainbow
 * Crown Shard half the time; at most 3 a game week. Returns the rolled items (not added) or null.
 * The cap runs on the game week (Sunday 7 PM Central), forward only, like the Trial Keys (refreshKeys):
 * not missions.weekly, which onAppStart wipes on the local week and again when the clock is set back.
 */
export function payTogetherChest(profile, tier, rng, now = Date.now()) {
  const c = counters(profile);
  const week = gameWeekNumber(+now);
  // a clock moved backwards never refills the cap (the week only moves forward)
  if (!('tk:togwk' in c) || week > c['tk:togwk']) {
    c['tk:tog'] = 0;
    c['tk:togwk'] = week;
  }
  if (whole(c['tk:tog']) >= TOGETHER_WEEKLY) return null;
  c['tk:tog'] = whole(c['tk:tog']) + 1;
  const items = [{ id: 'token_boss', count: 10 }, { id: 'star_fragment', count: 5 }];
  if (tierIndex(tier) >= tierIndex('hard') && rng.next() < 0.5) items.push({ id: 'crown_rainbow_shard', count: 1 });
  return items;
}

/**
 * May this player join a co-op titan room at this tier? The host must have it open solo; a guest may
 * join at most one step above their own solo best (a strong friend helps, never carries you past it).
 */
export function coopTierAllowed(profile, titanId, tier, rank = 0, { host = false } = {}) {
  if (host) return tierOpen(profile, titanId, tier, rank);
  const step = tierStep(tier, rank);
  return step >= 0 && step <= bestStep(profile, titanId) + 1 && isStageCleared(profile, TIER_STAGE.normal);
}

/** @returns {{ ok: boolean, reason?: string, step: number }} can this titan be swept (a solo Victory, a key)? */
export function canSweepTitan(profile, titanId, now = Date.now()) {
  const step = bestStep(profile, titanId);
  if (step < 0) return { ok: false, reason: 'Win a tier first', step };
  if (refreshKeys(profile, now) < 1) return { ok: false, reason: 'No Trial Keys left', step };
  return { ok: true, step };
}

/**
 * Sweep: one key pays a Victory at the best tier won SOLO (damage table + Victory Chest; never a
 * first clear). Fires the 'sweep' mission event.
 */
export function sweepTitan(profile, titanId, { now = Date.now(), seed = 0 } = {}) {
  const check = canSweepTitan(profile, titanId, now);
  if (!check.ok) return { ok: false, error: check.reason, rewards: [], gear: [] };
  const { tier, rank } = stepTier(check.step);
  const c = counters(profile);
  c['tk:left'] = refreshKeys(profile, now) - 1;
  c.tatt = whole(c.tatt) + 1;
  const rng = createRng(titanDropSeed(titanId, tier, rank, (seed >>> 0) ^ 0x5eed, c.tatt));
  const target = targetFamily(profile, titanId);
  const { rolled, boxes } = payVictory(profile, titanId, tier, rank, rng, { share: 1, victory: true, target, now });
  const g = grantAll(profile, normalizeList(rolled.items), boxes, rng, TITAN_SETS[titanId]);
  track(profile, 'sweep', 1);
  track(profile, 'titanWin', 1);
  return { ok: true, tier, rank, label: tierLabel(tier, rank), rewards: g.rewards, gear: g.gear, fused: g.fused, box: rolled.box, rainbowForced: rolled.rainbowForced, chest: rolled.chest, meter: cnt(profile, METER_KEY), keysLeft: whole(c['tk:left']) };
}

/** The hub's per-titan summary. */
export function titanSummary(profile, titanId, now = Date.now()) {
  const t = TITAN_MAP[titanId];
  const best = bestStep(profile, titanId);
  const top = topOpenStep(profile, titanId);
  const tiers = TITAN_TIERS.map((tier) => ({ tier, label: tierLabel(tier), open: tierOpen(profile, titanId, tier), lock: tierLock(profile, titanId, tier), won: best >= tierStep(tier), firstClear: !!cnt(profile, `tfc:${titanId}:${tierStep(tier)}`) }));
  return {
    id: titanId, name: t.name, families: t.families, target: targetFamily(profile, titanId), picked: !!cnt(profile, `ttgt:${titanId}`),
    best: best >= 0 ? { step: best, ...stepTier(best), label: tierLabel(stepTier(best).tier, stepTier(best).rank) } : null,
    top: top >= 0 ? { step: top, ...stepTier(top), label: tierLabel(stepTier(top).tier, stepTier(top).rank) } : null,
    tiers, ofWeek: titanOfWeek(now) === titanId, kills: cnt(profile, `tkill:${titanId}`),
    meter: { value: cnt(profile, METER_KEY), max: RAINBOW_METER, open: top >= tierStep('mayhem') },
  };
}

/** The battle a hub button starts (the controller passes it to the Sim's data hook). */
export { titanBattle };

/** Items Titan Trials can drop that a girl needs, for "Needed for" tags. */
export function neededFor(profile, itemId) {
  const it = ITEMS[itemId];
  if (!it) return null;
  for (const u of UNITS) {
    const st = profile.units?.[u.id];
    if (!st) continue;
    const gate = (st.breakthrough || 0) + 1;
    if (gate > MAX_BREAKTHROUGH) continue;
    if (breakthroughCost(u.id, gate).some((x) => x.id === itemId)) return `${UNIT_MAP[u.id].name} · Gate ${gate}`;
  }
  return null;
}

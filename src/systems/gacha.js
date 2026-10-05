// Recruitment (gacha) — rates, pity, ten-pull guarantee, tickets and spark (owner: systems).
// See CONTRACTS.md §5 and GACHA in src/data/types.js.
//
// Rates: SSR 1.5% · SR 18.5% · R 80%. The 90th pull without an SSR is a guaranteed SSR
// (pity resets on any SSR). Every 10× contains at least one SR or better. Each pull gives
// 1 recruit point; 200 points spark any SSR. Tickets are always spent before gems.

import { UNITS, UNIT_MAP } from '../data/units.js';
import { GACHA } from '../data/types.js';
import { grantUnit } from './unlocks.js';
import { consumeItems, itemCount } from './inventory.js';
import { track } from './missions.js';

const HISTORY_LIMIT = 100;

/** Unit ids by rarity — every unit (free ones and heroes too) is in the pool. */
export const POOL = {
  R: UNITS.filter((u) => u.rarity === 'R').map((u) => u.id),
  SR: UNITS.filter((u) => u.rarity === 'SR').map((u) => u.id),
  SSR: UNITS.filter((u) => u.rarity === 'SSR').map((u) => u.id),
};

function ensureState(state) {
  state.pity = state.pity || 0;
  state.totalPulls = state.totalPulls || 0;
  state.recruitPoints = state.recruitPoints || 0;
  state.history ||= [];
  return state;
}

/**
 * One recruitment roll. Updates pity, total pulls and recruit points (not history/units).
 * @param {object} state profile.gacha
 * @param {object} rng createRng() instance
 * @param {{ minRarity?: 'SR'|null }} [opts] used for the ten-pull guarantee
 * @returns {{ unitId: string, rarity: 'R'|'SR'|'SSR', pity: boolean }}
 */
export function rollOnce(state, rng, { minRarity = null } = {}) {
  ensureState(state);
  const roll = rng.next();
  let rarity;
  const pityHit = state.pity + 1 >= GACHA.pity;
  if (pityHit || roll < GACHA.rates.SSR) rarity = 'SSR';
  else if (roll < GACHA.rates.SSR + GACHA.rates.SR) rarity = 'SR';
  else rarity = 'R';
  if (minRarity === 'SR' && rarity === 'R') rarity = 'SR';
  state.pity = rarity === 'SSR' ? 0 : state.pity + 1;
  state.totalPulls += 1;
  state.recruitPoints += 1;
  const unitId = rng.pick(POOL[rarity]);
  return { unitId, rarity, pity: rarity === 'SSR' && pityHit && roll >= GACHA.rates.SSR };
}

/**
 * Work out how a pull would be paid: tickets first, gems for the rest.
 * @returns {{ ok: boolean, error?: string, gems: number, items: {id,count}[], tickets: number }}
 */
export function pullCost(profile, count, { useTickets = true } = {}) {
  const items = [];
  let remaining = count;
  if (useTickets) {
    if (count === 10 && itemCount(profile, 'ticket_recruit10') > 0) {
      items.push({ id: 'ticket_recruit10', count: 1 });
      remaining = 0;
    }
    const singles = Math.min(remaining, itemCount(profile, 'ticket_recruit'));
    if (singles > 0) {
      items.push({ id: 'ticket_recruit', count: singles });
      remaining -= singles;
    }
  }
  const gems = remaining === 10 ? GACHA.costTen : remaining * GACHA.costSingle;
  const tickets = items.reduce((a, i) => a + i.count, 0);
  const ok = itemCount(profile, 'gems') >= gems;
  return { ok, error: ok ? undefined : 'gems', gems, items, tickets };
}

/**
 * Recruit 1 or 10 times. Payment is taken atomically before rolling; results are written to
 * the profile (new units, fragments for duplicates, history, stats, missions).
 * @returns {{ ok: boolean, error?: string, results: {unitId, rarity, isNew, fragments}[], spent: { gems: number, tickets: number, items: object[] } }}
 */
export function pull(profile, count, rng, { useTickets = true } = {}) {
  const n = count === 10 ? 10 : count === 1 ? 1 : 0;
  const empty = { gems: 0, tickets: 0, items: [] };
  if (!n) return { ok: false, error: 'count', results: [], spent: empty };
  const cost = pullCost(profile, n, { useTickets });
  if (!cost.ok) return { ok: false, error: 'gems', results: [], spent: empty };
  if (!consumeItems(profile, [...cost.items, { id: 'gems', count: cost.gems }])) return { ok: false, error: 'gems', results: [], spent: empty };

  const state = ensureState(profile.gacha ||= {});
  const now = Date.now();
  const results = [];
  for (let i = 0; i < n; i++) {
    const needSR = n === 10 && GACHA.tenPullGuaranteeSR && i === n - 1 && results.every((r) => r.rarity === 'R');
    const roll = rollOnce(state, rng, { minRarity: needSR ? 'SR' : null });
    const grant = grantUnit(profile, roll.unitId, now);
    results.push({ unitId: roll.unitId, rarity: roll.rarity, isNew: grant.isNew, fragments: grant.fragments, pity: roll.pity });
    state.history.push({ unitId: roll.unitId, rarity: roll.rarity, at: now });
  }
  if (state.history.length > HISTORY_LIMIT) state.history.splice(0, state.history.length - HISTORY_LIMIT);
  profile.stats.pulls = (profile.stats.pulls || 0) + n;
  track(profile, 'pull', n);
  return { ok: true, results, spent: { gems: cost.gems, tickets: cost.tickets, items: cost.items } };
}

/** @returns {boolean} enough recruit points to spark */
export function canSpark(profile) {
  return (profile.gacha?.recruitPoints || 0) >= GACHA.sparkCost;
}

/**
 * Exchange 200 recruit points for an SSR of the player's choice.
 * @returns {{ ok: boolean, error?: string, unitId?: string, isNew?: boolean, fragments?: number }}
 */
export function spark(profile, unitId) {
  if (!POOL.SSR.includes(unitId)) return { ok: false, error: 'notSSR' };
  if (!canSpark(profile)) return { ok: false, error: 'points' };
  profile.gacha.recruitPoints -= GACHA.sparkCost;
  const grant = grantUnit(profile, unitId);
  profile.gacha.history.push({ unitId, rarity: UNIT_MAP[unitId].rarity, at: Date.now(), spark: true });
  if (profile.gacha.history.length > HISTORY_LIMIT) profile.gacha.history.shift();
  return { ok: true, unitId, ...grant };
}

/**
 * Consolidated SSR probability per pull including the 90-pull pity
 * (1 / expected pulls per SSR).
 * @returns {number}
 */
export function expectedSSRRate() {
  const p = GACHA.rates.SSR;
  // E[pulls per SSR] = Σ_{k=0}^{pity-1} (1-p)^k
  const expected = (1 - (1 - p) ** GACHA.pity) / p;
  return 1 / expected;
}

/** Rates table for the UI: base and consolidated, per rarity and per unit. */
export function ratesTable() {
  const ssr = expectedSSRRate();
  return {
    base: { ...GACHA.rates },
    consolidatedSSR: ssr,
    pity: GACHA.pity,
    sparkCost: GACHA.sparkCost,
    perUnit: Object.fromEntries(Object.entries(POOL).map(([r, ids]) => [r, ids.map((id) => ({ unitId: id, rate: GACHA.rates[r] / ids.length }))])),
  };
}

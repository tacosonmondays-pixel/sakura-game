// Recruitment (gacha) — rates, pity, ten-pull guarantee, tickets and spark (owner: systems).
// See CONTRACTS.md §5, GACHA in src/data/types.js and the banners (docs/specs/BANNERS.md, src/systems/banners.js).
//
// Every gem banner: SSR-class 1.5% · SR 18.5% · R 80%, drawn from the banner's integer ppm weights. One 90-pull
// pity is shared by every gem banner (it resets on any SSR or LR). Every 10× contains at least one SR or better.
// Each pull gives 1 recruit point; 200 points spark a standard SSR any day, a premium SSR in her spark window,
// never an LR unit. On an LR Banner the 300th pull counted on her banners is her (the Legend Promise).
// Tickets are always spent before gems.

import { UNITS, UNIT_MAP } from '../data/units.js';
import { GACHA } from '../data/types.js';
import { grantUnit } from './unlocks.js';
import { consumeItems, itemCount } from './inventory.js';
import { track } from './missions.js';
import {
  activeBanners, liveBanner, standardBanner, bannerDay, noteBannerDay, bannerWeights, drawWeighted, sparkRule,
  selectTicketAllowed, promiseKey, LEGEND_PROMISE, standardPool, unitClass,
  coinBanner, friendBanner, coinUnlocked, coinPullsLeft, weekOfDay, isFriendshipLive, COIN, FRIEND,
} from './banners.js';

const HISTORY_LIMIT = 100;

/**
 * Unit ids by rarity, the one-pool view (legacy rates page): every unit except LR units, who come only from their
 * LR Banner. The banners' own pools are in banners.js.
 */
const inPlainPool = (u) => !['legend', 'event', 'held'].includes(unitClass(u.id));
export const POOL = {
  R: UNITS.filter((u) => u.rarity === 'R' && inPlainPool(u)).map((u) => u.id),
  SR: UNITS.filter((u) => u.rarity === 'SR' && inPlainPool(u)).map((u) => u.id),
  SSR: UNITS.filter((u) => u.rarity === 'SSR' && inPlainPool(u)).map((u) => u.id),
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
  const unitId = rng.pick(standardPool()[rarity]);
  return { unitId, rarity, pity: rarity === 'SSR' && pityHit && roll >= GACHA.rates.SSR };
}

/**
 * One roll on a banner's ppm table (§A.1). Updates pity, total pulls, recruit points and the Legend Promise.
 * `force`: 'SSR' (pity, the Standard welcome) or 'SR' (the 10× lift) draws inside that line only.
 */
function rollBanner(profile, banner, table, rng, { minRarity = null, forceUnit = null } = {}) {
  const state = profile.gacha;
  const c = profile.missions.counters;
  const pityHit = state.pity + 1 >= GACHA.pity;
  const pk = banner.legend ? promiseKey(banner.legend) : null;
  const promised = pk && (Number(c[pk]) || 0) + 1 >= LEGEND_PROMISE;
  let e;
  let how = null;
  if (forceUnit) { e = table.find((x) => x.unitId === forceUnit) || { unitId: forceUnit, rarity: 'SSR' }; how = 'welcome'; }
  else if (promised) { e = table.find((x) => x.tag === 'legend'); how = 'promise'; }
  else {
    e = drawWeighted(table, rng);
    if (e.rarity !== 'SSR' && pityHit) { e = drawWeighted(table, rng, 'SSR'); how = 'pity'; }
    else if (minRarity === 'SR' && e.rarity === 'R') e = drawWeighted(table, rng, 'SR');
  }
  state.pity = e.rarity === 'SSR' ? 0 : state.pity + 1;
  state.totalPulls += 1;
  state.recruitPoints += 1;
  if (pk) c[pk] = e.unitId === banner.legend ? 0 : (Number(c[pk]) || 0) + 1;
  return { unitId: e.unitId, rarity: e.rarity, pity: how === 'pity', promise: how === 'promise', welcome: how === 'welcome', legend: e.unitId === banner.legend };
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
 * Recruit 1 or 10 times on a banner. Payment is taken atomically before rolling; results are written to the
 * profile (new units, Essence or spares for duplicates, history, stats, missions). `bannerId` (from
 * activeBanners) is checked against today's banners BEFORE payment: a banner that rotated away while the
 * screen was open is refused with 'rotated' (§A.1). Without a bannerId the Standard banner is used.
 * @returns {{ ok: boolean, error?: 'count'|'gems'|'rotated', banner?: object, results: object[], spent: { gems: number, tickets: number, items: object[] } }}
 */
export function pull(profile, count, rng, { useTickets = true, bannerId = null, now = Date.now() } = {}) {
  const n = count === 10 ? 10 : count === 1 ? 1 : 0;
  const empty = { gems: 0, tickets: 0, items: [] };
  if (!n) return { ok: false, error: 'count', results: [], spent: empty };
  const banner = bannerId ? liveBanner(profile, bannerId, now) : standardBanner(bannerDay(profile, now), profile);
  if (!banner) return { ok: false, error: 'rotated', results: [], spent: empty };
  const cost = pullCost(profile, n, { useTickets });
  if (!cost.ok) return { ok: false, error: 'gems', results: [], spent: empty };
  if (!consumeItems(profile, [...cost.items, { id: 'gems', count: cost.gems }])) return { ok: false, error: 'gems', results: [], spent: empty };

  const state = ensureState(profile.gacha ||= {});
  profile.missions ||= {};
  const c = (profile.missions.counters ||= {});
  noteBannerDay(profile, now);
  const table = bannerWeights(banner);
  // the Standard banner's first 10× ever guarantees a standard SSR (one she does not own yet, if any): §A.2
  const welcome = banner.slot === 'standard' && n === 10 && !c['gs:first'];
  if (welcome) c['gs:first'] = 1;
  const results = [];
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    const needSR = n === 10 && GACHA.tenPullGuaranteeSR && last && results.every((r) => r.rarity === 'R');
    let forceUnit = null;
    if (welcome && last && !results.some((r) => r.rarity === 'SSR') && state.pity + 1 < GACHA.pity) {
      const unowned = banner.pool.SSR.filter((id) => !profile.units?.[id]);
      forceUnit = rng.pick(unowned.length ? unowned : banner.pool.SSR);
    }
    const roll = rollBanner(profile, banner, table, rng, { minRarity: needSR ? 'SR' : null, forceUnit });
    const grant = grantUnit(profile, roll.unitId, now);
    results.push({ unitId: roll.unitId, rarity: roll.rarity, isNew: grant.isNew, essence: grant.essence, spare: grant.spare, readyStep: grant.readyStep, essenceHeld: grant.essenceHeld, pity: roll.pity, promise: roll.promise, welcome: roll.welcome, legend: roll.legend, potential: grant.potential, potentialUp: grant.potentialUp });
    state.history.push({ unitId: roll.unitId, rarity: roll.rarity, at: now, banner: banner.id });
  }
  if (state.history.length > HISTORY_LIMIT) state.history.splice(0, state.history.length - HISTORY_LIMIT);
  profile.stats.pulls = (profile.stats.pulls || 0) + n;
  track(profile, 'pull', n);
  return { ok: true, banner, results, spent: { gems: cost.gems, tickets: cost.tickets, items: cost.items } };
}

// ---------------------------------------------------------------------------
// Coin and Friendship pulls (§A.1b): their own roll, never pity, recruit points, totalPulls or history
// ---------------------------------------------------------------------------

/** Friend Points wallet (missions.counters 'frp:bal', clamp 0–5,000; G5 fills it). */
export const fpBalance = (profile) => Math.max(0, Math.min(FRIEND.walletCap, Number(profile?.missions?.counters?.['frp:bal']) || 0));

/** One roll on a fixed table: reads and writes no profile.gacha state. */
export function rollFixed(table, rng, { minRarity = null } = {}) {
  let e = drawWeighted(table, rng);
  if (minRarity === 'SR' && e.rarity === 'R') e = drawWeighted(table, rng, 'SR');
  return e;
}

/** Price of a Coin or Friendship pull. */
export function fixedCost(kind, count) {
  const c = kind === 'coin' ? COIN : FRIEND;
  return count === 10 ? c.ten : c.single * count;
}

/**
 * Recruit 1 or 10 times on the Coin or Friendship banner. Coin: 25,000 coins a pull, 20 pulls a game week, opens
 * after 6-5. Friendship: 100 Friend Points a pull. Spares pay coins only; no pity, no recruit points, no history,
 * no pull achievements (counted in 'gc:t' / 'frp:t').
 * @returns {{ ok: boolean, error?: 'count'|'locked'|'cap'|'funds'|'rotated', banner?: object, results: object[], spent?: number }}
 */
export function pullFixed(profile, kind, count, rng, { bannerId = null, now = Date.now() } = {}) {
  const n = count === 10 ? 10 : count === 1 ? 1 : 0;
  if (!n) return { ok: false, error: 'count', results: [] };
  const d = bannerDay(profile, now);
  if (kind === 'coin' && !coinUnlocked(profile)) return { ok: false, error: 'locked', results: [] };
  if (kind === 'friend' && !isFriendshipLive()) return { ok: false, error: 'locked', results: [] };
  const banner = kind === 'coin' ? coinBanner(d) : friendBanner(d);
  if (bannerId && bannerId !== banner.id) return { ok: false, error: 'rotated', results: [] };
  profile.missions ||= {};
  const c = (profile.missions.counters ||= {});
  if (kind === 'coin' && coinPullsLeft(profile, now) < n) return { ok: false, error: 'cap', results: [] };
  const price = fixedCost(kind, n);
  if (kind === 'coin') {
    if (!consumeItems(profile, [{ id: 'coins', count: price }])) return { ok: false, error: 'funds', results: [] };
    const w = weekOfDay(d);
    if (!(c['gc:wk'] >= w)) { c['gc:wk'] = w; c['gc:n'] = 0; }
    c['gc:n'] = (Number(c['gc:n']) || 0) + n;
    track(profile, 'spendCoins', price);
  } else {
    if (fpBalance(profile) < price) return { ok: false, error: 'funds', results: [] };
    c['frp:bal'] = fpBalance(profile) - price;
  }
  noteBannerDay(profile, now);
  const key = kind === 'coin' ? 'gc:t' : 'frp:t';
  c[key] = (Number(c[key]) || 0) + n;
  const table = bannerWeights(banner);
  const results = [];
  for (let i = 0; i < n; i++) {
    const needSR = n === 10 && i === n - 1 && results.every((r) => r.rarity === 'R');
    const e = rollFixed(table, rng, { minRarity: needSR ? 'SR' : null });
    const grant = grantUnit(profile, e.unitId, now, { source: kind });
    results.push({ unitId: e.unitId, rarity: e.rarity, isNew: grant.isNew, essence: grant.essence, spare: grant.spare, readyStep: grant.readyStep, essenceHeld: grant.essenceHeld, potential: grant.potential, potentialUp: grant.potentialUp });
  }
  return { ok: true, banner, results, spent: price };
}

/** @returns {boolean} enough recruit points to spark */
export function canSpark(profile) {
  return (profile.gacha?.recruitPoints || 0) >= GACHA.sparkCost;
}

/**
 * Exchange 200 recruit points for an SSR of the player's choice: a standard SSR any day, a premium SSR in her
 * spark window (her Spotlight day, or the 30-day grace of the five), never an LR unit or an event girl. The
 * rule lives here (not only in the UI), so a stale Mall row or a direct call is refused too.
 * @returns {{ ok: boolean, error?: 'notSSR'|'legend'|'event'|'window'|'points', days?: number|null, unitId?: string, isNew?: boolean, essence?: number, spare?: object|null }}
 */
export function spark(profile, unitId, { now = Date.now() } = {}) {
  const rule = sparkRule(profile, unitId, now);
  if (!rule.ok) return { ok: false, error: rule.error, days: rule.days ?? null };
  if (!canSpark(profile)) return { ok: false, error: 'points' };
  profile.gacha.recruitPoints -= GACHA.sparkCost;
  // one timestamp for the grant and the history entry (Potential's shadow and backfill compare them)
  const grant = grantUnit(profile, unitId, now);
  profile.gacha.history.push({ unitId, rarity: UNIT_MAP[unitId].rarity, at: now, spark: true });
  if (profile.gacha.history.length > HISTORY_LIMIT) profile.gacha.history.shift();
  return { ok: true, unitId, ...grant };
}

/** Item that lets the player choose a standard or premium SSR (never an LR unit; Beta Tester Thank-You gift). */
export const SSR_SELECT_TICKET = 'ticket_ssr_select';

/**
 * Redeem an SSR Select Ticket for the SSR of the player's choice. New girls join; owned girls
 * count as a duplicate (1 Essence of her, or a spare past her hold cap, like any duplicate).
 * @returns {{ ok: boolean, error?: 'notSSR'|'noTicket', unitId?: string, isNew?: boolean, essence?: number, spare?: object|null }}
 */
export function redeemSelectTicket(profile, unitId) {
  if (!selectTicketAllowed(unitId)) return { ok: false, error: 'notSSR' };
  if (!consumeItems(profile, [{ id: SSR_SELECT_TICKET, count: 1 }])) return { ok: false, error: 'noTicket' };
  const now = Date.now();
  const grant = grantUnit(profile, unitId, now);
  const state = ensureState(profile.gacha ||= {});
  state.history.push({ unitId, rarity: UNIT_MAP[unitId].rarity, at: now, select: true });
  if (state.history.length > HISTORY_LIMIT) state.history.shift();
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

/** Rates table of the one-pool Recruit (legacy view; the banner rates page uses bannerRates in banners.js). */
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

export { activeBanners, unitClass };

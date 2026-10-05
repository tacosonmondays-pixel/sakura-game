// Commissions, login calendar, achievements, codes, weekly event and F2P income overview
// (owner: systems). See CONTRACTS.md §5 and docs/ECONOMY.md.

import { DAILY_MISSIONS, WEEKLY_MISSIONS, LOGIN_REWARDS, ACHIEVEMENTS, REDEEM_CODES, WEEKLY_EVENTS } from '../data/missions.js';
import { SHOP_OFFERS } from '../data/shop.js';
import { STAGES, CAMPAIGN_IDS, bountyArenas, stageEnemies } from '../data/stages.js';
import { UNITS } from '../data/units.js';
import { DIFFICULTIES, DIFFICULTY_ORDER, GACHA } from '../data/types.js';
import { dayKey, weekKey } from '../core/util.js';
import { hashString } from '../core/rng.js';
import { addItems, normalizeList } from './inventory.js';

const MISSION_SETS = { daily: DAILY_MISSIONS, weekly: WEEKLY_MISSIONS };

/** Make sure profile.missions has every field (cheap; called by every entry point). */
function ensure(profile) {
  const m = (profile.missions ||= {});
  m.daily ||= {};
  m.weekly ||= {};
  m.dailyClaimed ||= [];
  m.weeklyClaimed ||= [];
  m.login ||= { lastDay: null, streak: 0, claimedDays: [] };
  m.login.claimedDays ||= [];
  m.achievements ||= {};
  m.counters ||= {};
  if (m.day === undefined) m.day = null;
  if (m.week === undefined) m.week = null;
  return m;
}

/**
 * Daily/weekly resets + the daily login event. Idempotent for the same day.
 * @param {object} profile
 * @param {Date} [now]
 * @returns {{ dailyReset: boolean, weeklyReset: boolean }}
 */
export function onAppStart(profile, now = new Date()) {
  const m = ensure(profile);
  const day = dayKey(now);
  const week = weekKey(now);
  let weeklyReset = false;
  let dailyReset = false;
  if (m.week !== week) {
    m.week = week;
    m.weekly = {};
    m.weeklyClaimed = [];
    weeklyReset = true;
  }
  if (m.day !== day) {
    m.day = day;
    m.daily = {};
    m.dailyClaimed = [];
    dailyReset = true;
    track(profile, 'login', 1);
  }
  return { dailyReset, weeklyReset };
}

/**
 * Report a game event. Updates unclaimed daily/weekly commissions and lifetime counters.
 * Events: 'battleWin','battleWinHard','pull','levelUp','gearReroll','sweep','kill','bossKill',
 * 'login','spendCoins' (+ internal 'dailyDone').
 * @param {object} profile
 * @param {string} event
 * @param {number} [amount]
 */
export function track(profile, event, amount = 1) {
  const n = Number(amount) || 0;
  if (n <= 0) return;
  const m = ensure(profile);
  m.counters[event] = (m.counters[event] || 0) + n;
  for (const [kind, list] of Object.entries(MISSION_SETS)) {
    const progress = m[kind];
    const claimed = m[`${kind}Claimed`];
    for (const mission of list) {
      if (!mission.events.includes(event) || claimed.includes(mission.id)) continue;
      progress[mission.id] = Math.min(mission.goal, (progress[mission.id] || 0) + n);
    }
  }
}

function describeMission(m, mission, kind) {
  const progress = Math.min(mission.goal, m[kind][mission.id] || 0);
  const claimed = m[`${kind}Claimed`].includes(mission.id);
  return {
    id: mission.id,
    kind,
    name: mission.name,
    desc: mission.desc,
    progress,
    goal: mission.goal,
    rewards: mission.rewards.map((r) => ({ ...r })),
    claimable: !claimed && progress >= mission.goal,
    claimed,
  };
}

/** @returns {{ daily: object[], weekly: object[] }} */
export function missionList(profile) {
  const m = ensure(profile);
  return {
    daily: DAILY_MISSIONS.map((x) => describeMission(m, x, 'daily')),
    weekly: WEEKLY_MISSIONS.map((x) => describeMission(m, x, 'weekly')),
  };
}

/**
 * Claim a finished commission.
 * @param {'daily'|'weekly'} kind
 * @returns {{ ok: boolean, error?: string, rewards: object[] }}
 */
export function claimMission(profile, kind, id) {
  const m = ensure(profile);
  const list = MISSION_SETS[kind];
  const mission = list?.find((x) => x.id === id);
  if (!mission) return { ok: false, error: 'unknown', rewards: [] };
  if (m[`${kind}Claimed`].includes(id)) return { ok: false, error: 'claimed', rewards: [] };
  if ((m[kind][id] || 0) < mission.goal) return { ok: false, error: 'incomplete', rewards: [] };
  m[`${kind}Claimed`].push(id);
  const rewards = addItems(profile, mission.rewards);
  if (kind === 'daily' && DAILY_MISSIONS.every((x) => m.dailyClaimed.includes(x.id))) track(profile, 'dailyDone', 1);
  return { ok: true, rewards };
}

/**
 * Claim every finished commission of a kind (or both when kind is omitted).
 * @returns {{ ok: boolean, rewards: object[], claimed: string[] }}
 */
export function claimAllMissions(profile, kind = null) {
  const kinds = kind ? [kind] : ['daily', 'weekly'];
  const all = [];
  const claimed = [];
  // Daily first so 'dailyDone' can complete the weekly in the same tap.
  for (const k of kinds) {
    for (const mission of MISSION_SETS[k]) {
      const r = claimMission(profile, k, mission.id);
      if (r.ok) {
        all.push(...r.rewards);
        claimed.push(mission.id);
      }
    }
  }
  return { ok: claimed.length > 0, rewards: normalizeList(all), claimed };
}

// ---------------------------------------------------------------------------
// Login calendar (7-day cycle; missed days do not reset the cycle)
// ---------------------------------------------------------------------------

function loginState(profile, now) {
  const m = ensure(profile);
  const today = dayKey(now);
  const login = m.login;
  const claimedToday = login.lastDay === today;
  let claimedDays = login.claimedDays.slice();
  // A full cycle that was finished on an earlier day starts over.
  if (!claimedToday && claimedDays.length >= LOGIN_REWARDS.length) claimedDays = [];
  const nextDay = claimedToday ? claimedDays[claimedDays.length - 1] || 1 : claimedDays.length + 1;
  return { login, today, claimedToday, claimedDays, nextDay };
}

/**
 * @param {object} profile
 * @param {Date} [now]
 * @returns {{ days: {day:number,rewards:object[],claimed:boolean,today:boolean}[], streak: number, claimable: boolean }}
 */
export function loginCalendar(profile, now = new Date()) {
  const s = loginState(profile, now);
  return {
    days: LOGIN_REWARDS.map((d) => ({ day: d.day, rewards: d.rewards.map((r) => ({ ...r })), claimed: s.claimedDays.includes(d.day), today: d.day === s.nextDay })),
    streak: s.login.streak,
    claimable: !s.claimedToday,
  };
}

/**
 * Claim today's login reward (once per calendar day).
 * @returns {{ ok: boolean, error?: string, day?: number, rewards: object[] }}
 */
export function claimLogin(profile, now = new Date()) {
  const s = loginState(profile, now);
  if (s.claimedToday) return { ok: false, error: 'claimed', rewards: [] };
  const entry = LOGIN_REWARDS[s.nextDay - 1];
  s.login.claimedDays = [...s.claimedDays, entry.day];
  s.login.lastDay = s.today;
  s.login.streak = (s.login.streak || 0) + 1;
  const rewards = addItems(profile, entry.rewards);
  return { ok: true, day: entry.day, rewards };
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

let DISCOVERABLE = null;
/** Enemy ids that can actually be met somewhere (bestiary % denominator). */
export function discoverableEnemies() {
  if (!DISCOVERABLE) {
    const set = new Set();
    for (const s of STAGES) for (const id of stageEnemies(s)) set.add(id);
    DISCOVERABLE = [...set];
  }
  return DISCOVERABLE;
}

/** Percentage (0-100, floored) of discoverable enemies discovered. */
export function bestiaryPercent(profile) {
  const all = discoverableEnemies();
  if (!all.length) return 0;
  const found = all.filter((id) => profile.bestiary?.[id]?.discovered).length;
  return Math.floor((found / all.length) * 100);
}

const cleared = (entry) => !!entry && DIFFICULTY_ORDER.some((d) => entry[d]);

function metricValue(profile, a) {
  const stages = profile.progress?.stages || {};
  const units = Object.values(profile.units || {});
  switch (a.metric) {
    case 'stagesCleared': return CAMPAIGN_IDS.filter((id) => cleared(stages[id])).length;
    case 'chapterClear': return CAMPAIGN_IDS.filter((id) => id.startsWith(`${a.param}-`) && cleared(stages[id])).length;
    case 'medals': return CAMPAIGN_IDS.filter((id) => stages[id]?.[a.param]).length;
    case 'bestiaryPct': return bestiaryPercent(profile);
    case 'pulls': return profile.gacha?.totalPulls || 0;
    case 'maxLevel': return units.reduce((mx, u) => Math.max(mx, u.level || 1), 0);
    case 'maxAwaken': return units.reduce((mx, u) => Math.max(mx, u.awaken || 0), 0);
    case 'unitsOwned': return units.length;
    case 'kills': return profile.stats?.kills || 0;
    case 'wins': return profile.stats?.wins || 0;
    case 'gearRerolls': return profile.missions?.counters?.gearReroll || 0;
    case 'bossClears': return STAGES.filter((s) => s.kind === 'boss' && cleared(stages[s.id])).length;
    default: return 0;
  }
}

/** @returns {{ id, name, desc, progress, goal, rewards, claimable, claimed }[]} */
export function achievementList(profile) {
  const m = ensure(profile);
  return ACHIEVEMENTS.map((a) => {
    const progress = Math.min(a.goal, metricValue(profile, a));
    const claimed = !!m.achievements[a.id];
    return { id: a.id, name: a.name, desc: a.desc, progress, goal: a.goal, rewards: a.rewards.map((r) => ({ ...r })), claimable: !claimed && progress >= a.goal, claimed };
  });
}

/** @returns {{ ok: boolean, error?: string, rewards: object[] }} */
export function claimAchievement(profile, id) {
  const m = ensure(profile);
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return { ok: false, error: 'unknown', rewards: [] };
  if (m.achievements[id]) return { ok: false, error: 'claimed', rewards: [] };
  if (metricValue(profile, a) < a.goal) return { ok: false, error: 'incomplete', rewards: [] };
  m.achievements[id] = true;
  return { ok: true, rewards: addItems(profile, a.rewards) };
}

// ---------------------------------------------------------------------------
// Redemption codes
// ---------------------------------------------------------------------------

/** 'reset 67' -> 'RESET67' */
export function normalizeCode(code) {
  return String(code ?? '').replace(/\s+/g, '').toUpperCase();
}

/**
 * Redeem a code once per account. Action codes (e.g. RESET67) return `action` for the UI to
 * perform after confirmation and grant nothing.
 * @returns {{ ok: boolean, error?: 'invalid'|'redeemed', rewards: object[], action?: string, desc?: string }}
 */
export function redeemCode(profile, code) {
  const key = normalizeCode(code);
  const def = REDEEM_CODES[key];
  if (!def) return { ok: false, error: 'invalid', rewards: [] };
  profile.redeemed ||= [];
  if (!def.repeatable && profile.redeemed.includes(key)) return { ok: false, error: 'redeemed', rewards: [] };
  if (def.action) return { ok: true, rewards: [], action: def.action, desc: def.desc };
  profile.redeemed.push(key);
  return { ok: true, rewards: addItems(profile, def.rewards), desc: def.desc };
}

// ---------------------------------------------------------------------------
// Weekly rotating event
// ---------------------------------------------------------------------------

/**
 * This week's double-drop Bounty arena (rotates by weekKey).
 * @param {Date} [now]
 * @returns {{ id, name, desc, stageIds: string[], dropMul: number, week: string, arena: string }}
 */
export function currentEvent(now = new Date()) {
  const week = weekKey(now);
  const ev = WEEKLY_EVENTS[hashString(week) % WEEKLY_EVENTS.length];
  const arena = bountyArenas().find((a) => a.id === ev.arena);
  return {
    id: `event-${ev.arena}-${week}`,
    name: ev.name,
    desc: ev.desc,
    arena: ev.arena,
    arenaName: arena?.name || ev.arena,
    stageIds: arena ? arena.stages.slice() : [],
    dropMul: 2,
    week,
  };
}

// ---------------------------------------------------------------------------
// F2P income overview (Honkai Star Rail style version chart)
// ---------------------------------------------------------------------------

const sumId = (rewards, id) => rewards.reduce((a, r) => a + (r.id === id ? r.count : 0), 0);
const ticketPulls = (rewards) => sumId(rewards, 'ticket_recruit') + 10 * sumId(rewards, 'ticket_recruit10');

/**
 * Free-to-play recruit income for a 28-day period (recurring) plus one-time sources.
 * Rows are computed from the live data tables so the chart never drifts from the game.
 * @returns {{ periodDays: number, rows: object[], totals: object, oneTime: object[], oneTimeTotals: object, sparkEvery: number }}
 */
export function f2pIncomeSummary() {
  const DAYS = 28;
  const WEEKS = DAYS / 7;
  const row = (source, gems, tickets, note, kind = 'recurring') => ({ source, gems, tickets, pulls: Math.round((gems / GACHA.costSingle + tickets) * 10) / 10, note, kind });

  const dailyRewards = DAILY_MISSIONS.flatMap((m) => m.rewards);
  const weeklyRewards = WEEKLY_MISSIONS.flatMap((m) => m.rewards);
  const loginRewards = LOGIN_REWARDS.flatMap((d) => d.rewards);
  const loginCycles = DAYS / LOGIN_REWARDS.length;
  const weeklyTicketOffers = SHOP_OFFERS.filter((o) => o.item === 'ticket_recruit' && o.resets === 'weekly');

  const rows = [
    row('Daily Commissions', sumId(dailyRewards, 'gems') * DAYS, ticketPulls(dailyRewards) * DAYS, `${sumId(dailyRewards, 'gems')} gems × ${DAYS} days`),
    row('Weekly Commissions', sumId(weeklyRewards, 'gems') * WEEKS, ticketPulls(weeklyRewards) * WEEKS, `${sumId(weeklyRewards, 'gems')} gems + ${ticketPulls(weeklyRewards)} ticket × ${WEEKS} weeks`),
    row('Login Calendar', sumId(loginRewards, 'gems') * loginCycles, ticketPulls(loginRewards) * loginCycles, `7-day cycle × ${loginCycles}`),
    ...weeklyTicketOffers.map((o) => row(`Mall · ${o.tab === 'general' ? 'General (coins)' : o.tab === 'boss' ? 'Boss Exchange (Assault Tokens)' : o.tab}`, 0, o.count * o.stock * WEEKS, `${o.stock} ticket / week for ${o.price.toLocaleString('en-US')} ${o.currency === 'coins' ? 'coins' : 'tokens'}`)),
  ];
  const totals = rows.reduce((t, r) => ({ gems: t.gems + r.gems, tickets: t.tickets + r.tickets }), { gems: 0, tickets: 0 });
  totals.pulls = Math.round((totals.gems / GACHA.costSingle + totals.tickets) * 10) / 10;
  totals.recruitPoints = Math.round(totals.pulls);
  totals.sparks = Math.round((totals.pulls / GACHA.sparkCost) * 100) / 100;

  // One-time sources.
  const campaign = STAGES.filter((s) => s.kind === 'campaign');
  const others = STAGES.filter((s) => s.kind === 'resource' || s.kind === 'boss');
  const diffGems = DIFFICULTY_ORDER.reduce((a, d) => a + DIFFICULTIES[d].firstClearGems, 0);
  const firstClear = (list) => list.flatMap((s) => s.firstClear || []);
  const achievementRewards = ACHIEVEMENTS.flatMap((a) => a.rewards);
  const codeRewards = Object.values(REDEEM_CODES).filter((c) => !c.dev).flatMap((c) => c.rewards);
  const oneTime = [
    row('Starter gift', 2400, 10, '2,400 gems + one 10× ticket on a new account', 'oneTime'),
    row('Campaign medals (all difficulties)', campaign.length * diffGems, 0, `${diffGems} gems per stage (Easy ${DIFFICULTIES.easy.firstClearGems} / Normal ${DIFFICULTIES.normal.firstClearGems} / Hard ${DIFFICULTIES.hard.firstClearGems} / Nightmare ${DIFFICULTIES.nightmare.firstClearGems}) × ${campaign.length}`, 'oneTime'),
    row('Chapter finales', sumId(firstClear(campaign), 'gems'), ticketPulls(firstClear(campaign)), 'First clear of each x-5 stage', 'oneTime'),
    row('Bounty & Total Assault', sumId(firstClear(others), 'gems') + others.length * diffGems, ticketPulls(firstClear(others)), 'First clears + medals', 'oneTime'),
    row('Achievements', sumId(achievementRewards, 'gems'), ticketPulls(achievementRewards), `${ACHIEVEMENTS.length} achievements`, 'oneTime'),
    row('Redemption codes', sumId(codeRewards, 'gems'), ticketPulls(codeRewards), 'SAKURA2026 · WELCOME · TACOTUESDAY', 'oneTime'),
  ];
  const oneTimeTotals = oneTime.reduce((t, r) => ({ gems: t.gems + r.gems, tickets: t.tickets + r.tickets }), { gems: 0, tickets: 0 });
  oneTimeTotals.pulls = Math.round((oneTimeTotals.gems / GACHA.costSingle + oneTimeTotals.tickets) * 10) / 10;

  return { periodDays: DAYS, rows, totals, oneTime, oneTimeTotals, sparkEvery: GACHA.sparkCost, unitsInPool: UNITS.length };
}

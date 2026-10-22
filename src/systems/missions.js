// Commissions, login calendar, achievements, codes, weekly event and F2P income overview
// (owner: systems). See CONTRACTS.md §5 and docs/ECONOMY.md.

import { DAILY_MISSIONS, WEEKLY_MISSIONS, LOGIN_REWARDS, ACHIEVEMENTS, REDEEM_CODES, WEEKLY_EVENTS } from '../data/missions.js';
import { SHOP_OFFERS } from '../data/shop.js';
import { STAGES, bountyArenas } from '../data/stages.js';
import { ACHIEVEMENT_MAP, ACHIEVEMENT_CATEGORIES, ACH_V2_LIVE, NO_COSMETIC, achievementLive } from '../data/achievements.js';
import { achievementContext, metricValue } from './achievementMetrics.js';
import { featureOpen } from './story.js';
import { UNITS } from '../data/units.js';
import { DIFFICULTIES, DIFFICULTY_ORDER, GACHA } from '../data/types.js';
import { dayKey, weekKey } from '../core/util.js';
import { hashString } from '../core/rng.js';
import { addItems, normalizeList } from './inventory.js';

const MISSION_SETS = { daily: DAILY_MISSIONS, weekly: WEEKLY_MISSIONS };
/** missions.weekly key (wiped with the weekly commissions): this week's 'weeklyDone' was counted. */
export const WEEKLY_DONE_MARK = 'wd:done';

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
/** A commission row is open once its `requires` stage is cleared (any difficulty). */
export function missionOpen(profile, mission) {
  if (!mission.requires) return true;
  const e = profile?.progress?.stages?.[mission.requires];
  return !!e && DIFFICULTY_ORDER.some((d) => e[d]);
}

export function missionList(profile) {
  const m = ensure(profile);
  return {
    daily: DAILY_MISSIONS.filter((x) => missionOpen(profile, x)).map((x) => describeMission(m, x, 'daily')),
    weekly: WEEKLY_MISSIONS.filter((x) => missionOpen(profile, x)).map((x) => describeMission(m, x, 'weekly')),
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
  if (!mission || !missionOpen(profile, mission)) return { ok: false, error: 'unknown', rewards: [] };
  if (m[`${kind}Claimed`].includes(id)) return { ok: false, error: 'claimed', rewards: [] };
  if ((m[kind][id] || 0) < mission.goal) return { ok: false, error: 'incomplete', rewards: [] };
  m[`${kind}Claimed`].push(id);
  const rewards = addItems(profile, mission.rewards);
  if (kind === 'daily' && DAILY_MISSIONS.every((x) => m.dailyClaimed.includes(x.id))) track(profile, 'dailyDone', 1);
  // every weekly that is open now (a row still behind its stage does not hold "all claimed" back); once a
  // week: a row that opens mid-week (Club Day after 2-5, Rainbow Hunt after 5-5) never counts the week twice
  if (kind === 'weekly' && !m.weekly[WEEKLY_DONE_MARK] && WEEKLY_MISSIONS.filter((x) => missionOpen(profile, x)).every((x) => m.weeklyClaimed.includes(x.id))) {
    m.weekly[WEEKLY_DONE_MARK] = 1;
    track(profile, 'weeklyDone', 1);
  }
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
// Achievements (docs/specs/ACHIEVEMENTS.md §3, §5). Metrics: src/systems/achievementMetrics.js.
// ---------------------------------------------------------------------------

export { discoverableEnemies, bestiaryPercent } from './achievementMetrics.js';

/** Reward ids that wait for a feature gate (§3.3): boxes until Equipment opens, crowns until Awakening does. */
export function achievementGate(profile, a) {
  for (const r of a.rewards) {
    if (r.id.startsWith('gearbox_') && !featureOpen(profile, 'gear')) return 'gear';
    if (r.id.startsWith('crown_') && !featureOpen(profile, 'awaken')) return 'awaken';
  }
  return null;
}

/** Steps of each series, lowest goal first (for the ladder rows). */
const SERIES = {};
for (const a of ACHIEVEMENTS) if (a.series) (SERIES[`${a.cat}:${a.series}`] ||= []).push(a.id);
for (const ids of Object.values(SERIES)) ids.sort((x, y) => ACHIEVEMENT_MAP[x].goal - ACHIEVEMENT_MAP[y].goal);

/**
 * Every achievement this build lists, with progress and state.
 * @param {object} profile
 * @param {{ includeHidden?: boolean, v2?: boolean }} [opts] includeHidden: also rows whose feature wave hasn't
 *   shipped (tests, tools); v2: override ACH_V2_LIVE (tests)
 * @returns {{ id, name, desc, progress, goal, rewards, claimable, claimed, cat, tier, series, seriesIds, honor, title,
 *   hidden, hint, since, locked: 'gear'|'awaken'|null, met, live }[]}
 */
export function achievementList(profile, { includeHidden = false, v2 = ACH_V2_LIVE } = {}) {
  const m = ensure(profile);
  const ctx = achievementContext(profile);
  const out = [];
  for (const a of ACHIEVEMENTS) {
    const live = achievementLive(a, v2);
    if (!live && !includeHidden) continue;
    const progress = Math.min(a.goal, metricValue(profile, a, ctx));
    const claimed = !!m.achievements[a.id];
    const met = progress >= a.goal;
    const locked = met && !claimed ? achievementGate(profile, a) : null;
    out.push({
      id: a.id, name: a.name, desc: a.desc, progress, goal: a.goal, rewards: a.rewards.map((r) => ({ ...r })),
      claimable: live && !claimed && met && !locked, claimed, met, live,
      cat: a.cat, tier: a.tier ?? null, series: a.series || null, seriesIds: a.series ? SERIES[`${a.cat}:${a.series}`] : null,
      honor: a.honor && !NO_COSMETIC(a.id) ? { ...a.honor } : null, title: a.title && !NO_COSMETIC(a.id) ? { ...a.title } : null,
      hidden: !!a.hidden, hint: a.hint || null, since: a.since || null, locked,
    });
  }
  return out;
}

/**
 * Claim one achievement. The claim marker is set BEFORE the payout, so a double tap answers 'claimed'.
 * @returns {{ ok: boolean, error?: 'unknown'|'notLive'|'retired'|'claimed'|'incomplete'|'locked', feature?: string, rewards: object[] }}
 */
export function claimAchievement(profile, id, { v2 = ACH_V2_LIVE } = {}) {
  const m = ensure(profile);
  const a = ACHIEVEMENT_MAP[id];
  if (!a) return { ok: false, error: 'unknown', rewards: [] };
  if (a.retired) return { ok: false, error: 'retired', rewards: [] };
  if (!achievementLive(a, v2)) return { ok: false, error: 'notLive', rewards: [] };
  if (m.achievements[id]) return { ok: false, error: 'claimed', rewards: [] };
  if (metricValue(profile, a) < a.goal) return { ok: false, error: 'incomplete', rewards: [] };
  const feature = achievementGate(profile, a);
  if (feature) return { ok: false, error: 'locked', feature, rewards: [] };
  m.achievements[id] = true;
  noticeCache = null;
  return { ok: true, rewards: addItems(profile, a.rewards) };
}

/**
 * Claim every claimable achievement in one tap, in category order then list order, repeating until nothing new is
 * claimable (so Achiever and Hall of Fame count the claims made by the same tap). `cat`: only that category (the tab's
 * Claim all claims what the picked category shows; null or 'all': everything).
 * @returns {{ ok: boolean, ids: string[], rewards: object[], honors: string[], titles: string[], skipped: string[] }}
 *   honors / titles: ids of the rows claimed that grant a ribbon / a title; skipped: met but gate-locked
 */
export function claimAllAchievements(profile, { v2 = ACH_V2_LIVE, cat = null } = {}) {
  const ids = [];
  const all = [];
  const catRank = Object.fromEntries(ACHIEVEMENT_CATEGORIES.map((c, i) => [c.id, i]));
  const only = cat && cat !== 'all' ? cat : null;
  const order = ACHIEVEMENTS.filter((a) => !only || a.cat === only)
    .map((a, i) => [a, i]).sort(([x, i], [y, j]) => (catRank[x.cat] ?? 99) - (catRank[y.cat] ?? 99) || i - j).map(([a]) => a);
  for (let pass = 0; pass < 10; pass++) {
    let any = false;
    const list = achievementList(profile, { v2 });
    const ready = new Set(list.filter((x) => x.claimable).map((x) => x.id));
    for (const a of order) {
      if (!ready.has(a.id)) continue;
      const r = claimAchievement(profile, a.id, { v2 });
      if (!r.ok) continue;
      ids.push(a.id);
      all.push(...r.rewards);
      any = true;
    }
    if (!any) break;
  }
  const skipped = achievementList(profile, { v2 }).filter((x) => x.locked).map((x) => x.id);
  const cosmetic = (id) => !NO_COSMETIC(id);
  return {
    ok: ids.length > 0,
    ids,
    rewards: normalizeList(all),
    honors: ids.filter((id) => ACHIEVEMENT_MAP[id].honor && cosmetic(id)),
    titles: ids.filter((id) => ACHIEVEMENT_MAP[id].title && cosmetic(id)),
    skipped,
  };
}

/** Ids that became ready since the previous check (for the unlock toast): pure diff, in `next` order. */
export function achievementsReady(prevReadyIds, nextReadyIds) {
  const prev = new Set(prevReadyIds || []);
  return (nextReadyIds || []).filter((id) => !prev.has(id));
}

/**
 * How many achievements Claim all would claim right now: its repeated passes run on a copy of the save, so an
 * Achiever row that the same tap completes is counted too (the button's number = the modal's "N claimed").
 */
export function claimAllCount(profile, { v2 = ACH_V2_LIVE, cat = null } = {}) {
  if (!achievementList(profile, { v2 }).some((x) => x.claimable && (!cat || cat === 'all' || x.cat === cat))) return 0;
  return claimAllAchievements(JSON.parse(JSON.stringify(profile)), { v2, cat }).ids.length;
}

/** Ids claimable right now (gate-locked rows excluded). */
export function readyAchievementIds(profile) {
  return achievementList(profile).filter((a) => a.claimable).map((a) => a.id);
}

let noticeCache = null;
/**
 * Whether the achievements tab deserves a dot, and how many rows are ready. Cached per profile state, because the
 * lobby asks up to three times per render (§5.1 Badges).
 * @returns {{ ready: number, dot: boolean }}
 */
export function achievementNotice(profile) {
  const key = noticeKey(profile);
  if (noticeCache && noticeCache.profile === profile && noticeCache.key === key) return noticeCache.value;
  const ready = readyAchievementIds(profile).length;
  const value = { ready, dot: ready > 0 };
  noticeCache = { profile, key, value };
  return value;
}

/** A cheap fingerprint of what achievement progress reads (changes whenever a commit could change the answer). */
function noticeKey(p) {
  const c = p.missions?.counters || {};
  const st = p.progress?.stages || {};
  let stages = 0;
  for (const e of Object.values(st)) stages += (e?.clears || 0) + (e?.bestWave || 0) + (e?.easy ? 1 : 0) + (e?.normal ? 2 : 0) + (e?.hard ? 4 : 0) + (e?.nightmare ? 8 : 0)
    + Object.values(e?.freeplayBest || {}).reduce((x, y) => x + y, 0) + Object.values(e?.coopBestWave || {}).reduce((x, y) => x + y, 0);
  let counters = 0;
  for (const v of Object.values(c)) counters += typeof v === 'number' ? v : 0;
  let units = 0;
  for (const u of Object.values(p.units || {})) units += (u?.level || 0) + 100 * (u?.awaken || 0) + 1000 * (u?.breakthrough || 0) + (u?.gear?.charm ? 7 : 0) + (u?.gear?.ribbon ? 11 : 0) + (u?.gear?.shoes ? 13 : 0);
  let gear = 0;
  for (const g of Object.values(p.gear || {})) gear += 1 + (g?.level || 0);
  let kills = 0;
  let found = 0;
  for (const b of Object.values(p.bestiary || {})) { kills += b?.kills || 0; found += b?.discovered ? 1 : 0; }
  return [Object.keys(p.missions?.achievements || {}).length, stages, counters, units, gear, kills, found, p.seq?.gear || 0,
    p.stats?.kills || 0, p.gacha?.totalPulls || 0, Object.keys(p.lobbyBg || {}).length, p.formation?.towers?.length || 0,
    p.story?.legacy ? 1 : 0, Object.keys(p.story?.lessons || {}).length, Object.keys(p.items || {}).filter((k) => p.items[k] > 0 && /^(gearbox|crown)_/.test(k)).length].join('|');
}

/** Keep the highest value seen in a counter (e.g. 'heroMax'); a max, not a sum. @returns {boolean} it rose */
export function recordMax(profile, key, value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return false;
  const c = ensure(profile).counters;
  if (typeof c[key] === 'number' && c[key] >= v) return false;
  c[key] = v;
  return true;
}

// ---------------------------------------------------------------------------
// Redemption codes
// ---------------------------------------------------------------------------

/** 'reset 67' -> 'RESET67' */
export function normalizeCode(code) {
  return String(code ?? '').replace(/\s+/g, '').toUpperCase();
}

/** True only in a local dev build (Vite dev server, vitest); false in every production build. */
const DEV_BUILD = !!import.meta.env?.DEV;

/**
 * Redeem a code once per account. Action codes (e.g. RESET67) return `action` for the UI to
 * perform after confirmation and grant nothing. A code marked `dev: true` answers 'invalid' in
 * production builds (defence in depth: the code table ships in the public bundle).
 * @param {{ allowDev?: boolean }} [opts] allowDev: tests only (defaults to the build's DEV flag)
 * @returns {{ ok: boolean, error?: 'invalid'|'redeemed', rewards: object[], action?: string, desc?: string }}
 */
export function redeemCode(profile, code, { allowDev = DEV_BUILD } = {}) {
  const key = normalizeCode(code);
  const def = Object.hasOwn(REDEEM_CODES, key) ? REDEEM_CODES[key] : null;
  if (!def || (def.dev && !allowDev)) return { ok: false, error: 'invalid', rewards: [] };
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
// F2P income overview (a version-by-version reward chart)
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
  // (the Memento Exchange ticket is paid with spare duplicates, not everyday income: ASCENSION.md §A.3 counts it apart)
  const weeklyTicketOffers = SHOP_OFFERS.filter((o) => o.item === 'ticket_recruit' && o.resets === 'weekly' && o.currency !== 'memento');

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
  const liveAchievements = ACHIEVEMENTS.filter((a) => achievementLive(a));
  const achievementRewards = liveAchievements.flatMap((a) => a.rewards);
  const codeRewards = Object.values(REDEEM_CODES).filter((c) => !c.dev).flatMap((c) => c.rewards);
  const oneTime = [
    row('Starter gift', 2400, 10, '2,400 gems + one 10× ticket on a new account', 'oneTime'),
    row('Campaign medals (all difficulties)', campaign.length * diffGems, 0, `${diffGems} gems per stage (Easy ${DIFFICULTIES.easy.firstClearGems} / Normal ${DIFFICULTIES.normal.firstClearGems} / Hard ${DIFFICULTIES.hard.firstClearGems} / Nightmare ${DIFFICULTIES.nightmare.firstClearGems}) × ${campaign.length}`, 'oneTime'),
    row('Chapter finales', sumId(firstClear(campaign), 'gems'), ticketPulls(firstClear(campaign)), 'First clear of each x-5 stage', 'oneTime'),
    row('Bounty & Total Assault', sumId(firstClear(others), 'gems') + others.length * diffGems, ticketPulls(firstClear(others)), 'First clears + medals', 'oneTime'),
    row('Achievements', sumId(achievementRewards, 'gems'), ticketPulls(achievementRewards), `${liveAchievements.length} achievements`, 'oneTime'),
    row('Redemption codes', sumId(codeRewards, 'gems'), ticketPulls(codeRewards), 'SAKURA2026 · WELCOME · TACOTUESDAY', 'oneTime'),
  ];
  const oneTimeTotals = oneTime.reduce((t, r) => ({ gems: t.gems + r.gems, tickets: t.tickets + r.tickets }), { gems: 0, tickets: 0 });
  oneTimeTotals.pulls = Math.round((oneTimeTotals.gems / GACHA.costSingle + oneTimeTotals.tickets) * 10) / 10;

  return { periodDays: DAYS, rows, totals, oneTime, oneTimeTotals, sparkEvery: GACHA.sparkCost, unitsInPool: UNITS.length };
}

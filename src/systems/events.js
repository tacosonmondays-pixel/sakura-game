// Limited events (EVENT_SPEC §3; Halloween 2026 is the first one): lifecycle on the 7 PM Central
// clock, operation gates, event missions, the exchange, episodes, daily login gifts, and the settle
// at the end (leftover currency → coins by mail). Pure and Node-safe: no DOM, no Date in the battle
// sim (everything here runs after sim.result(), in systems code).
//
// Save block (additive, no SAVE_VERSION bump; cleaned by cleanEvents from migrateProfile):
//   profile.events = { v: 1, byId: { [eventId]: EventState } }
//   EventState = { run, joinedAt, read: [episodeId], daily: { day, progress, claimed },
//                  total: { progress, claimed }, bought: { offerId: n }, owned: ['title:<id>', …],
//                  login: { days, last }, settled: null | { at, currency, coins } }
// Shadows in profile.missions.counters (an older build that drops the block keeps them, so settling
// stays final, bought cosmetics stay owned, stock limits and one-time claims hold and nothing pays
// twice): 'evs:<eventId>:<run>' settled, 'evo:<kind>:<id>' owned cosmetic, 'evr:<episodeId>' episode
// read, 'evb:<eventId>:<run>:<offerId>' = bought n, 'evm:<eventId>:<run>:<missionId>' one-time mission
// claimed, 'evp:<eventId>:<run>:<missionId>' = one-time mission progress. The login gifts sent are
// read back from mail.delivered ('ev:<eventId>:<run>:login:<n>'). The run's 'evb:' / 'evm:' / 'evp:'
// marks are removed once it is settled (the block is pruned then and 'evs:' keeps it final).
// Nightmare (Halloween 2026, Oct 20): its medals are progress.stages[id].nightmare, which every build's migrate keeps;
// its one-time missions are shadowed like the others, so a v0.1.38 tab that drops their ids from the block never
// makes them pay twice. Missions added mid-event are one-time only (daily claims have no shadow).

import '../data/events/wire.js';
import { ALL_EVENTS, EVENTS, EVENT_MAP, eventById, eventOfStage } from '../data/events/index.js';
import { STAGE_MAP } from '../data/stages.js';
import { getItem } from '../data/items.js';
import { DIFFICULTIES } from '../data/types.js';
import { gameDay, gameDayStart, gameDayEnd, isNewPeriod, formatCountdown } from '../core/reset.js';
import { addItems, consumeItems, itemCount, normalizeList } from './inventory.js';
import { deliverMail } from './mail.js';
import { isStageCleared, stageMedals } from './unlocks.js';

const DAY = 24 * 3600 * 1000;
const ms = (t) => (t instanceof Date ? t.getTime() : Number(t));
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const intOf = (v, min = 0) => (Number.isFinite(Number(v)) ? Math.max(min, Math.floor(Number(v))) : min);

export const SETTLE_MARK = 'evs:';
export const OWNED_MARK = 'evo:';
export const READ_MARK = 'evr:';
export const BOUGHT_MARK = 'evb:';
export const CLAIM_MARK = 'evm:';
export const PROGRESS_MARK = 'evp:';

const runKey = (mark, eventId, run, id) => `${mark}${eventId}:${run}:${id}`;
const loginId = (eventId, run, n) => `ev:${eventId}:${run}:login:${n}`;

/** How many login gifts of this event run the Mailbox ever delivered (the highest n in `delivered`). */
function loginsDelivered(ev, run, delivered) {
  if (!Array.isArray(delivered) || !delivered.length) return 0;
  const sent = new Set(delivered);
  let n = 0;
  for (let i = 1; i <= (ev.login || []).length; i++) if (sent.has(loginId(ev.id, run, i))) n = i;
  return n;
}

// ---------------------------------------------------------------------------
// Save block
// ---------------------------------------------------------------------------

/** Fresh profile.events. */
export function newEvents() {
  return { v: 1, byId: {} };
}

function newState() {
  return {
    run: 1,
    joinedAt: null,
    read: [],
    daily: { day: null, progress: {}, claimed: [] },
    total: { progress: {}, claimed: [] },
    bought: {},
    owned: [],
    login: { days: 0, last: null },
    settled: null,
  };
}

const counts = (raw, allow) => {
  const out = {};
  if (!isObj(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    const n = intOf(v);
    if (n > 0 && allow(k)) out[k] = n;
  }
  return out;
};
const ids = (raw, allow) => (Array.isArray(raw) ? [...new Set(raw.filter((x) => typeof x === 'string' && allow(x)))] : []);

function cosmeticKeys(ev) {
  return (ev.shop || []).filter((o) => o.cosmetic).map((o) => `${o.cosmetic.kind}:${o.cosmetic.id}`);
}

/**
 * Sanitize a stored profile.events (unknown events, missions and offers dropped, numbers ≥ 0,
 * `settled` kept). `counters` (profile.missions.counters) restores the shadows, and `mail`
 * (profile.mail, already cleaned) the login gifts sent: each part comes back as the larger of the
 * block and its shadow, so a block an older build dropped never reopens a stock limit or a claim.
 * @returns {{ v: 1, byId: object }}
 */
export function cleanEvents(raw, counters = {}, mail = null) {
  const out = newEvents();
  const src = isObj(raw) && isObj(raw.byId) ? raw.byId : {};
  const c = isObj(counters) ? counters : {};
  for (const ev of ALL_EVENTS) {
    const r = src[ev.id];
    const run = isObj(r) ? Math.max(1, intOf(r.run, 1)) : 1;
    const markedSettled = c[`${SETTLE_MARK}${ev.id}:${run}`] > 0;
    const ownedMarks = cosmeticKeys(ev).filter((k) => c[`${OWNED_MARK}${k}`] > 0);
    const readMarks = (ev.episodes || []).map((e) => e.id).filter((id) => c[`${READ_MARK}${id}`] > 0);
    const totalMissions = ev.missions?.total || [];
    const boughtMarks = (ev.shop || []).map((o) => [o.id, intOf(c[runKey(BOUGHT_MARK, ev.id, run, o.id)])]).filter(([, n]) => n > 0);
    const claimMarks = totalMissions.map((m) => m.id).filter((id) => c[runKey(CLAIM_MARK, ev.id, run, id)] > 0);
    const progressMarks = totalMissions.map((m) => [m.id, Math.min(m.goal, intOf(c[runKey(PROGRESS_MARK, ev.id, run, m.id)]))]).filter(([, n]) => n > 0);
    const loginsSent = loginsDelivered(ev, run, mail?.delivered);
    const shadowed = markedSettled || ownedMarks.length || readMarks.length || boughtMarks.length || claimMarks.length || progressMarks.length || loginsSent;
    if (!isObj(r) && !shadowed) continue;
    const st = newState();
    st.run = run;
    const rr = isObj(r) ? r : {};
    const dailyIds = new Set((ev.missions?.daily || []).map((m) => m.id));
    const totalIds = new Set((ev.missions?.total || []).map((m) => m.id));
    const offerIds = new Set((ev.shop || []).map((o) => o.id));
    const epIds = new Set((ev.episodes || []).map((e) => e.id));
    const keys = new Set(cosmeticKeys(ev));
    st.joinedAt = Number.isFinite(Number(rr.joinedAt)) && rr.joinedAt != null ? Math.max(0, Number(rr.joinedAt)) : null;
    st.read = ids([...(Array.isArray(rr.read) ? rr.read : []), ...readMarks], (x) => epIds.has(x));
    const d = isObj(rr.daily) ? rr.daily : {};
    st.daily = {
      day: typeof d.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.day) ? d.day : null,
      progress: counts(d.progress, (k) => dailyIds.has(k)),
      claimed: ids(d.claimed, (x) => dailyIds.has(x)),
    };
    const t = isObj(rr.total) ? rr.total : {};
    st.total = { progress: counts(t.progress, (k) => totalIds.has(k)), claimed: ids([...(Array.isArray(t.claimed) ? t.claimed : []), ...claimMarks], (x) => totalIds.has(x)) };
    for (const [id, n] of progressMarks) st.total.progress[id] = Math.max(st.total.progress[id] || 0, n);
    st.bought = counts(rr.bought, (k) => offerIds.has(k));
    for (const [id, n] of boughtMarks) st.bought[id] = Math.max(st.bought[id] || 0, n);
    st.owned = ids([...(Array.isArray(rr.owned) ? rr.owned : []), ...ownedMarks], (x) => keys.has(x));
    const l = isObj(rr.login) ? rr.login : {};
    const last = typeof l.last === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(l.last) ? l.last : null;
    st.login = { days: Math.min(Math.max(intOf(l.days), loginsSent), (ev.login || []).length), last: last ?? lastLoginDay(ev, run, mail) };
    if (isObj(rr.settled)) st.settled = { at: Math.max(0, Number(rr.settled.at) || 0), currency: intOf(rr.settled.currency), coins: intOf(rr.settled.coins) };
    else if (markedSettled) st.settled = { at: 0, currency: 0, coins: 0 };
    if (st.settled) pruneSettled(st);
    out.byId[ev.id] = st;
  }
  return out;
}

function pruneSettled(st) {
  st.daily = { day: null, progress: {}, claimed: [] };
  st.total = { progress: {}, claimed: [] };
  st.bought = {};
  st.login = { days: st.login?.days || 0, last: st.login?.last || null };
}

function block(profile) {
  if (!isObj(profile.events) || !isObj(profile.events.byId)) profile.events = newEvents();
  return profile.events;
}

/** The save state of one event (created on first use). */
export function eventState(profile, eventId) {
  const b = block(profile);
  return (b.byId[eventId] ||= newState());
}

/** Read-only peek (null when the save never touched the event). */
export function peekState(profile, eventId) {
  return profile?.events?.byId?.[eventId] || null;
}

function mark(profile, key, n = 1) {
  const c = ((profile.missions ||= {}).counters ||= {});
  if (!(c[key] >= n)) c[key] = n;
}

/** The game day the newest login gift of this run was sent (a dropped block's `login.last`), or null. */
function lastLoginDay(ev, run, mail) {
  const n = loginsDelivered(ev, run, mail?.delivered);
  if (!n) return null;
  const letter = (Array.isArray(mail?.letters) ? mail.letters : []).find((x) => x?.id === loginId(ev.id, run, n));
  return letter && Number(letter.sentAt) > 0 ? gameDay(Number(letter.sentAt)) : null;
}

/** Drops a settled run's 'evb:' / 'evm:' / 'evp:' shadows (the 'evs:' mark keeps the settle final). */
function dropRunShadows(profile, eventId, run) {
  const c = profile.missions?.counters;
  if (!isObj(c)) return;
  const heads = [BOUGHT_MARK, CLAIM_MARK, PROGRESS_MARK].map((m) => `${m}${eventId}:${run}:`);
  for (const k of Object.keys(c)) if (heads.some((h) => k.startsWith(h))) delete c[k];
}

// ---------------------------------------------------------------------------
// Time and phases
// ---------------------------------------------------------------------------

/** The window as instants (ms) on the 7 PM Central clock (EVENT_SPEC §3.2). */
export function eventWindow(ev) {
  const startAt = gameDayStart(ev.window.opens);
  return {
    teaseAt: startAt - (ev.teaseDays ?? 3) * DAY,
    startAt,
    endAt: gameDayEnd(ev.window.lastDay),
    exchangeEndAt: gameDayEnd(ev.window.exchangeLastDay),
  };
}

/**
 * 'hidden' | 'upcoming' | 'active' | 'exchange' | 'ended'. A settled event is 'ended' whatever the
 * clock says (settling is final, E12). Drafts are hidden unless `opts.drafts`.
 */
export function eventPhase(ev, now = Date.now(), profile = null, { drafts = false } = {}) {
  if (!ev || (ev.draft && !drafts)) return 'hidden';
  const t = ms(now);
  const st = profile ? peekState(profile, ev.id) : null;
  if (st?.settled) return 'ended';
  const w = eventWindow(ev);
  if (t < w.teaseAt) return 'hidden';
  if (t < w.startAt) return 'upcoming';
  if (t < w.endAt) return 'active';
  if (t < w.exchangeEndAt) return 'exchange';
  return 'ended';
}

/** The player has cleared the event's unlock stage. */
export function eventUnlocked(profile, ev) {
  return !ev.unlock?.stage || isStageCleared(profile, ev.unlock.stage);
}

/** Every non-hidden event with its phase, soonest deadline first (past events last). */
export function listEvents(profile, now = Date.now(), opts = {}) {
  const pool = opts.drafts ? ALL_EVENTS : EVENTS;
  const deadline = (ev, phase) => {
    const w = eventWindow(ev);
    return phase === 'upcoming' ? w.startAt : phase === 'active' ? w.endAt : phase === 'exchange' ? w.exchangeEndAt : Infinity;
  };
  return pool.map((ev) => ({ ev, phase: eventPhase(ev, now, profile, opts) }))
    .filter((r) => r.phase !== 'hidden')
    .map((r) => ({ ...r, deadline: deadline(r.ev, r.phase) }))
    .sort((a, b) => a.deadline - b.deadline);
}

/** Events in the active or exchange phase, next deadline first. */
export function activeEvents(profile, now = Date.now(), opts = {}) {
  return listEvents(profile, now, opts).filter((r) => r.phase === 'active' || r.phase === 'exchange');
}

/** The lobby card's event: the active event ending soonest, else the exchange event closing soonest. */
export function featuredEvent(profile, now = Date.now(), opts = {}) {
  const list = activeEvents(profile, now, opts);
  return list.find((r) => r.phase === 'active') || list[0] || null;
}

/** 'Ends in 6d 4h' / 'Exchange · 3d 2h left' / 'Opens in 2d 4h' / 'Ended'. */
export function phaseLabel(ev, phase, now = Date.now()) {
  const w = eventWindow(ev);
  const t = ms(now);
  if (phase === 'upcoming') return `Opens in ${formatCountdown(w.startAt - t)}`;
  if (phase === 'active') return `Ends in ${formatCountdown(w.endAt - t)}`;
  if (phase === 'exchange') return `Exchange · ${formatCountdown(w.exchangeEndAt - t)} left`;
  return 'Ended';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 'Oct 23' for the Chicago evening a game day starts (never a hard-coded date in copy). */
function dayLabel(key, startOfDay = false) {
  const [y, mm, dd] = key.split('-').map(Number);
  const at = new Date(Date.UTC(y, mm - 1, startOfDay ? dd - 1 : dd));
  const [m, d] = [at.getUTCMonth() + 1, at.getUTCDate()];
  return `${MONTHS[m - 1]} ${d}`;
}

/** 'Oct 23 – Nov 1 · ends 7 PM Central' and 'Nov 8, 7 PM Central' strings, from the window. */
export function windowText(ev) {
  return {
    dates: `${dayLabel(ev.window.opens, true)} – ${dayLabel(ev.window.lastDay)} · ends 7 PM Central`,
    exchangeClose: `${dayLabel(ev.window.exchangeLastDay)}, 7 PM Central`,
  };
}

// ---------------------------------------------------------------------------
// Stages: gates and battles
// ---------------------------------------------------------------------------

function episodeTitle(ev, id) {
  return ev.episodes?.find((e) => e.id === id)?.title || 'the previous episode';
}

/**
 * Can this event stage be played for rewards now?
 * @returns {{ ok: boolean, reason: null|'unknown'|'closed'|'locked'|'episode'|'previous', text: string }}
 */
export function eventStageStatus(profile, stageId, now = Date.now(), opts = {}) {
  const ev = eventOfStage(stageId);
  const stage = STAGE_MAP[stageId];
  if (!ev || !stage) return { ok: false, reason: 'unknown', text: 'Unknown event stage.' };
  const phase = eventPhase(ev, now, profile, opts);
  if (phase !== 'active') {
    return { ok: false, reason: 'closed', text: phase === 'upcoming' || phase === 'hidden' ? 'The festival hasn\'t opened yet.' : 'The event operations are over — everything you earned is yours to keep.' };
  }
  if (!eventUnlocked(profile, ev)) return { ok: false, reason: 'locked', text: `Clear ${ev.unlock.stage} to join the festival.` };
  const ep = stage.gate?.episode;
  if (ep && !eventState(profile, ev.id).read.includes(ep)) return { ok: false, reason: 'episode', text: `Read “${episodeTitle(ev, ep)}” first.` };
  if (stage.requires && !isStageCleared(profile, stage.requires)) {
    return { ok: false, reason: 'previous', text: `Clear ${STAGE_MAP[stage.requires]?.name || stage.requires} first.` };
  }
  return { ok: true, reason: null, text: '' };
}

/**
 * Does this event stage offer `difficulty` to this save now? Event stages play only their own
 * `difficulties`, and a stage's `unlockAfter` names the medal a difficulty waits for: an operation's
 * Nightmare opens after its Normal medal, the Golem's after its Hard medal. Every other stage: ok.
 * @returns {{ ok: boolean, reason: null|'difficulty'|'medal', needs: string|null, text: string }}
 *   text: "Clear Hard first" (the stage-prep picker's line)
 */
export function eventDifficultyStatus(profile, stageId, difficulty) {
  const stage = STAGE_MAP[stageId];
  if (stage?.kind !== 'event') return { ok: true, reason: null, needs: null, text: '' };
  if (Array.isArray(stage.difficulties) && !stage.difficulties.includes(difficulty)) {
    return { ok: false, reason: 'difficulty', needs: null, text: `${DIFFICULTIES[difficulty]?.name || difficulty} isn't offered here` };
  }
  const needs = stage.unlockAfter?.[difficulty] || null;
  if (needs && !stageMedals(profile, stageId)[needs]) return { ok: false, reason: 'medal', needs, text: `Clear ${DIFFICULTIES[needs].name} first` };
  return { ok: true, reason: null, needs: null, text: '' };
}

/**
 * The reward gate of a finished event battle: the stage's status at the battle's START time, so a
 * battle begun before the end still pays (EVENT_SPEC §3.2).
 * @returns {{ ok: boolean, text: string }}
 */
export function eventRunGate(profile, stage, startedAt = Date.now()) {
  if (stage?.kind !== 'event') return { ok: true, text: '' };
  const s = eventStageStatus(profile, stage.id, startedAt);
  if (s.ok) return { ok: true, text: '' };
  const ev = eventOfStage(stage.id);
  if (s.reason === 'closed') return { ok: false, text: `The ${ev?.name || 'event'} operations closed before this battle started — no rewards.` };
  return { ok: false, text: `${s.text} This run was practice — no rewards.` };
}

/**
 * Event missions + episode unlocks after an event battle (called by applyBattleResult just before
 * it adds the rewards). Only ever counts while the event is active. `eventStage` counts a stage's
 * first clear and each new medal on it (with its difficulty: "Clear Hayride on Nightmare");
 * `eventClear` and `eventBoss` carry the difficulty too.
 * @returns {{ event?: { id: string, newEpisodes: string[] } }}
 */
export function eventAfterBattle(profile, stage, { won, firstClear, newMedal = false, difficulty, totalKills = 0, now = Date.now() } = {}) {
  const ev = stage?.kind === 'event' ? eventOfStage(stage.id) : null;
  if (!ev) return {};
  if (won) {
    trackEvent(profile, ev.id, 'eventClear', 1, { now, difficulty });
    if (stage.boss) trackEvent(profile, ev.id, 'eventBoss', 1, { now, difficulty });
    if (firstClear || newMedal) trackEvent(profile, ev.id, 'eventStage', 1, { now, stageId: stage.id, difficulty });
  }
  if (totalKills > 0) trackEvent(profile, ev.id, 'eventKill', totalKills, { now });
  // episodes this first clear opened (their stage gate is this stage)
  const newEpisodes = won && firstClear ? episodeRows(profile, ev, now).filter((r) => r.state === 'new' && r.gate.stage === stage.id).map((r) => r.id) : [];
  return { event: { id: ev.id, newEpisodes } };
}

// ---------------------------------------------------------------------------
// Missions
// ---------------------------------------------------------------------------

function rollDaily(st, now) {
  const today = gameDay(ms(now));
  if (isNewPeriod(st.daily.day, today)) st.daily = { day: today, progress: {}, claimed: [] };
  return st.daily;
}

/**
 * Count an event mission event. Progress counts only while the event is active.
 * @param {string} on one of EVENT_MISSION_ON
 */
export function trackEvent(profile, eventId, on, n = 1, { now = Date.now(), stageId = null, difficulty = null } = {}) {
  const ev = eventById(eventId);
  if (!ev || eventPhase(ev, now, profile) !== 'active') return false;
  const st = eventState(profile, ev.id);
  const daily = rollDaily(st, now);
  const add = (bucket, m) => {
    if (m.on !== on) return false;
    if (m.stage && m.stage !== stageId) return false;
    if (m.difficulty && m.difficulty !== difficulty) return false;
    bucket.progress[m.id] = Math.min(m.goal, (bucket.progress[m.id] || 0) + n);
    return true;
  };
  for (const m of ev.missions?.daily || []) add(daily, m);
  for (const m of ev.missions?.total || []) {
    if (add(st.total, m)) mark(profile, runKey(PROGRESS_MARK, ev.id, st.run, m.id), st.total.progress[m.id]);
  }
  return true;
}

/** Mission rows for the Missions tab. */
export function missionRows(profile, ev, now = Date.now()) {
  const st = peekState(profile, ev.id) || newState();
  const today = gameDay(ms(now));
  const daily = st.daily.day === today || (st.daily.day && st.daily.day > today) ? st.daily : { progress: {}, claimed: [] };
  const phase = eventPhase(ev, now, profile);
  const row = (m, bucket) => {
    const progress = Math.min(m.goal, bucket.progress[m.id] || 0);
    const claimed = bucket.claimed.includes(m.id);
    return { ...m, progress, claimed, done: progress >= m.goal, claimable: phase === 'active' && progress >= m.goal && !claimed };
  };
  return {
    daily: (ev.missions?.daily || []).map((m) => row(m, daily)),
    total: (ev.missions?.total || []).map((m) => row(m, st.total)),
    resetsAt: gameDayEnd(today),
  };
}

/** Claim one finished mission (only while active). @returns {{ ok, error?, rewards }} */
export function claimEventMission(profile, eventId, missionId, now = Date.now()) {
  const ev = eventById(eventId);
  if (!ev) return { ok: false, error: 'unknown', rewards: [] };
  if (eventPhase(ev, now, profile) !== 'active') return { ok: false, error: 'closed', rewards: [] };
  const st = eventState(profile, ev.id);
  const daily = rollDaily(st, now);
  const isDaily = (ev.missions?.daily || []).find((m) => m.id === missionId);
  const m = isDaily || (ev.missions?.total || []).find((x) => x.id === missionId);
  if (!m) return { ok: false, error: 'unknown', rewards: [] };
  const bucket = isDaily ? daily : st.total;
  if (bucket.claimed.includes(m.id)) return { ok: false, error: 'claimed', rewards: [] };
  if ((bucket.progress[m.id] || 0) < m.goal) return { ok: false, error: 'notDone', rewards: [] };
  bucket.claimed.push(m.id);
  if (!isDaily) mark(profile, runKey(CLAIM_MARK, ev.id, st.run, m.id));
  return { ok: true, rewards: addItems(profile, m.rewards) };
}

/** Claim every finished mission: dailies first, then one-time missions. */
export function claimAllEventMissions(profile, eventId, now = Date.now()) {
  const ev = eventById(eventId);
  if (!ev) return { ok: false, rewards: [], count: 0 };
  const rows = missionRows(profile, ev, now);
  const got = [];
  let count = 0;
  for (const m of [...rows.daily, ...rows.total]) {
    if (!m.claimable) continue;
    const r = claimEventMission(profile, eventId, m.id, now);
    if (r.ok) { got.push(...r.rewards); count++; }
  }
  return { ok: count > 0, rewards: normalizeList(got), count };
}

// ---------------------------------------------------------------------------
// Login gifts (one per day the player visits during the event; Mailbox)
// ---------------------------------------------------------------------------

function loginLetter(ev, st, i, now) {
  const w = eventWindow(ev);
  const tpl = ev.mail?.login || { title: 'Event gift · day {n}', body: '' };
  return {
    id: loginId(ev.id, st.run, i + 1),
    from: ev.mail?.from || ev.name,
    title: tpl.title.replace('{n}', String(i + 1)),
    body: i === ev.login.length - 1 && tpl.lastBody ? tpl.lastBody : tpl.body,
    rewards: ev.login[i],
    expiresAt: w.exchangeEndAt,
  };
}

/**
 * The day's event visit: counts `eventLogin` once per game day, sends the next login gift to the
 * Mailbox, and marks the player as joined. Call it at app start, on the reset clock and on the
 * event page. Only while active and unlocked.
 * @returns {{ letters: object[] }}
 */
export function markEventLogin(profile, now = Date.now()) {
  const letters = [];
  for (const ev of EVENTS) {
    if (eventPhase(ev, now, profile) !== 'active' || !eventUnlocked(profile, ev)) continue;
    const st = eventState(profile, ev.id);
    st.joinedAt ??= ms(now);
    const today = gameDay(ms(now));
    if (!isNewPeriod(st.login.last, today)) continue;
    st.login.last = today;
    // gifts already in the Mailbox count as sent (a block an older build dropped restarts at 0)
    st.login.days = Math.min((ev.login || []).length, Math.max(st.login.days, loginsDelivered(ev, st.run, profile.mail?.delivered)));
    trackEvent(profile, ev.id, 'eventLogin', 1, { now });
    if (st.login.days < (ev.login || []).length) {
      const letter = deliverMail(profile, loginLetter(ev, st, st.login.days, now), ms(now));
      st.login.days += 1;
      if (letter) letters.push(letter);
    }
  }
  return { letters };
}

/** The login-gift strip: one entry per gift, `got` once delivered. */
export function loginRows(profile, ev) {
  const st = peekState(profile, ev.id);
  const days = st?.login?.days || 0;
  return (ev.login || []).map((rewards, i) => ({ day: i + 1, rewards, got: i < days, next: i === days }));
}

// ---------------------------------------------------------------------------
// Exchange
// ---------------------------------------------------------------------------

/** Offer rows for the Exchange tab. */
export function shopRows(profile, ev, now = Date.now()) {
  const st = peekState(profile, ev.id);
  const phase = eventPhase(ev, now, profile);
  const open = phase === 'active' || phase === 'exchange';
  const funds = itemCount(profile, ev.currency.id);
  return (ev.shop || []).map((o) => {
    const bought = st?.bought?.[o.id] || 0;
    const left = o.limit == null ? Infinity : Math.max(0, o.limit - bought);
    const locked = !!(o.requires?.stage && !isStageCleared(profile, o.requires.stage));
    const owned = !!(o.cosmetic && st?.owned?.includes(`${o.cosmetic.kind}:${o.cosmetic.id}`));
    return { ...o, bought, left, locked, owned, soldOut: left <= 0 || owned, affordable: funds >= o.price, open };
  });
}

/**
 * Buy `qty` of an offer with event currency. Allowed in the active and exchange phases. Checks stock
 * and funds before changing anything.
 * @returns {{ ok: boolean, error?: 'unknown'|'closed'|'soldOut'|'funds'|'locked', rewards: object[], cosmetic?: object }}
 */
export function buyEventOffer(profile, eventId, offerId, qty = 1, now = Date.now()) {
  const ev = eventById(eventId);
  const o = ev?.shop?.find((x) => x.id === offerId);
  if (!ev || !o) return { ok: false, error: 'unknown', rewards: [] };
  const phase = eventPhase(ev, now, profile);
  if (phase !== 'active' && phase !== 'exchange') return { ok: false, error: 'closed', rewards: [] };
  if (o.requires?.stage && !isStageCleared(profile, o.requires.stage)) return { ok: false, error: 'locked', rewards: [] };
  const n = Math.max(1, Math.floor(qty) || 1);
  const st = eventState(profile, ev.id);
  const bought = st.bought[o.id] || 0;
  const key = o.cosmetic ? `${o.cosmetic.kind}:${o.cosmetic.id}` : null;
  if (key && (st.owned.includes(key) || n > 1)) return { ok: false, error: 'soldOut', rewards: [] };
  if (o.limit != null && bought + n > o.limit) return { ok: false, error: 'soldOut', rewards: [] };
  const cost = [{ id: ev.currency.id, count: o.price * n }];
  if (!consumeItems(profile, cost)) return { ok: false, error: 'funds', rewards: [] };
  st.bought[o.id] = bought + n;
  mark(profile, runKey(BOUGHT_MARK, ev.id, st.run, o.id), st.bought[o.id]);
  if (key) {
    st.owned.push(key);
    mark(profile, `${OWNED_MARK}${key}`);
    return { ok: true, rewards: [], cosmetic: { ...o.cosmetic } };
  }
  return { ok: true, rewards: addItems(profile, [{ id: o.item, count: o.count * n }]) };
}

/**
 * Cosmetics bought in any event's exchange (titles, frames, avatars stay forever).
 * @returns {{ titles: string[], frames: string[], avatars: string[] }}
 */
export function eventCosmetics(profile) {
  const out = { titles: [], frames: [], avatars: [] };
  const c = profile?.missions?.counters || {};
  for (const ev of ALL_EVENTS) {
    const owned = new Set(peekState(profile, ev.id)?.owned || []);
    for (const o of ev.shop || []) {
      if (!o.cosmetic) continue;
      const key = `${o.cosmetic.kind}:${o.cosmetic.id}`;
      if (owned.has(key) || c[`${OWNED_MARK}${key}`] > 0) out[`${o.cosmetic.kind}s`].push(o.cosmetic.id);
    }
  }
  return out;
}

/** Every event cosmetic, owned or not: { kind, id, name, eventId, how }. */
export function allEventCosmetics() {
  return ALL_EVENTS.flatMap((ev) => (ev.shop || []).filter((o) => o.cosmetic).map((o) => ({
    ...o.cosmetic, eventId: ev.id, how: `${ev.name} event exchange (${ev.window.opens.slice(0, 4)}).`,
  })));
}

// ---------------------------------------------------------------------------
// Episodes
// ---------------------------------------------------------------------------

/** Episode rows: state 'new' | 'read' | 'locked' with the lock text. */
export function episodeRows(profile, ev, now = Date.now()) {
  const st = peekState(profile, ev.id);
  const read = new Set(st?.read || []);
  const phase = eventPhase(ev, now, profile);
  return (ev.episodes || []).map((e) => {
    if (read.has(e.id)) return { ...e, state: 'read', text: '' };
    let text = '';
    if (phase !== 'active') text = phase === 'upcoming' || phase === 'hidden' ? 'Opens with the festival.' : 'The festival is over.';
    else if (!eventUnlocked(profile, ev)) text = `Clear ${ev.unlock.stage} to join the festival.`;
    else if (e.gate.episode && !read.has(e.gate.episode)) text = `Read “${episodeTitle(ev, e.gate.episode)}” first.`;
    else if (e.gate.stage && !isStageCleared(profile, e.gate.stage)) text = `Clear ${STAGE_MAP[e.gate.stage]?.name || e.gate.stage}.`;
    return { ...e, state: text ? 'locked' : 'new', text };
  });
}

/**
 * The first read of an episode (skipping counts as reading): grants its rewards once and counts
 * `eventRead`. Replays grant nothing.
 * @returns {{ ok: boolean, error?: string, rewards: object[], first: boolean }}
 */
export function readEpisode(profile, eventId, episodeId, now = Date.now()) {
  const ev = eventById(eventId);
  const row = ev && episodeRows(profile, ev, now).find((r) => r.id === episodeId);
  if (!row) return { ok: false, error: 'unknown', rewards: [], first: false };
  if (row.state === 'read') return { ok: true, rewards: [], first: false };
  if (row.state === 'locked') return { ok: false, error: 'locked', rewards: [], first: false };
  const st = eventState(profile, ev.id);
  st.read.push(episodeId);
  mark(profile, `${READ_MARK}${episodeId}`);
  trackEvent(profile, ev.id, 'eventRead', 1, { now });
  return { ok: true, rewards: addItems(profile, row.rewards || []), first: true };
}

// ---------------------------------------------------------------------------
// Settle (mail, leftover currency, archive)
// ---------------------------------------------------------------------------

function fill(text, vars) {
  return String(text || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

/**
 * Idempotent end-of-event work, from app start and the reset clock:
 * - at endAt: one letter with every finished but unclaimed mission reward (expires with the exchange
 *   when it holds event currency). A player first back after exchangeEndAt gets it without the
 *   currency and without an expiry: that currency joins the leftover count below instead, so the
 *   letter is never born expired and nothing in it is lost. When that letter was already sent by an
 *   older build that knew fewer one-time missions (a v0.1.38 tab and the Nightmare missions), the
 *   one-time missions it left finished but unclaimed come in one follow-up letter
 *   ('ev:<eventId>:<run>:unclaimed:2'), with the same late and expiry rules and the same claims and
 *   'evm:' marks, so it is sent once. (A v0.1.38 tab that also closes the run after exchangeEndAt
 *   drops those missions' progress and marks with it: nothing is left to recover then.)
 * - at exchangeEndAt: the leftover currency is removed and mailed back as coins; `settled` is set
 *   (final: a clock rolled back never reopens it) and the state is pruned.
 * @returns {{ letters: object[], settled: string[] }}
 */
export function settleEvents(profile, now = Date.now()) {
  const t = ms(now);
  const letters = [];
  const settled = [];
  for (const ev of ALL_EVENTS) {
    if (ev.draft) continue;
    const st = peekState(profile, ev.id);
    if (st?.settled) continue;
    const w = eventWindow(ev);
    const cur = ev.currency.id;
    let lateCurrency = 0; // the unclaimed missions' currency when the exchange had already closed
    if (t >= w.endAt && st) {
      const rows = missionRows(profile, ev, Math.min(t, w.endAt - 1));
      const delivered = Array.isArray(profile.mail?.delivered) ? profile.mail.delivered : [];
      // An older build that mailed the letter first knew fewer one-time missions (v0.1.38 has no Nightmare ones)
      // and claimed only its own: the ones still finished but unclaimed go in one follow-up letter, same rules.
      const firstId = `ev:${ev.id}:${st.run}:unclaimed`;
      const followUp = delivered.includes(firstId);
      const id = followUp ? `${firstId}:2` : firstId;
      const list = (followUp ? rows.total : [...rows.daily, ...rows.total]).filter((m) => m.done && !m.claimed);
      const bucketOf = (m) => (m.kind === 'daily' ? st.daily : st.total);
      const rewards = normalizeList(list.flatMap((m) => m.rewards));
      if (rewards.length && !delivered.includes(id)) {
        const tpl = ev.mail?.unclaimed || {};
        const late = t >= w.exchangeEndAt;
        const currency = rewards.filter((r) => r.id === cur).reduce((a, r) => a + r.count, 0);
        const sent = late ? rewards.filter((r) => r.id !== cur) : rewards;
        const name = getItem(cur)?.name || 'event currency';
        const l = sent.length ? deliverMail(profile, {
          id, from: ev.mail?.from || ev.name,
          title: tpl.title || 'Unclaimed event rewards',
          body: late ? fill(tpl.lateBody || 'The event is over, but some finished missions still had rewards waiting. Here they are. Their {currency} went into your leftover {currency}, which became coins.', { currency: name }) : tpl.body || '',
          rewards: sent,
          expiresAt: !late && currency > 0 ? w.exchangeEndAt : null,
        }, t) : null;
        if (l || !sent.length) {
          if (l) letters.push(l);
          if (late) lateCurrency = currency;
          for (const m of list) {
            bucketOf(m).claimed.push(m.id);
            if (m.kind !== 'daily') mark(profile, runKey(CLAIM_MARK, ev.id, st.run, m.id));
          }
        }
      }
    }
    if (t >= w.exchangeEndAt) {
      const held = itemCount(profile, cur);
      const n = held + lateCurrency;
      if (!st && n <= 0) continue;
      const state = eventState(profile, ev.id);
      const rate = ev.currency.leftover?.rate ?? 0;
      const coins = n * rate;
      if (n > 0) {
        if (held > 0) consumeItems(profile, [{ id: cur, count: held }]);
        if (coins > 0) {
          const tpl = ev.mail?.leftover || {};
          const l = deliverMail(profile, {
            id: `ev:${ev.id}:${state.run}:leftover`, from: ev.mail?.from || ev.name,
            title: tpl.title || 'Event leftovers', body: fill(tpl.body, { n: n.toLocaleString('en-US'), coins: coins.toLocaleString('en-US') }),
            rewards: [{ id: 'coins', count: coins }], expiresAt: null,
          }, t);
          if (l) letters.push(l);
        }
      }
      state.settled = { at: t, currency: n, coins };
      pruneSettled(state);
      mark(profile, `${SETTLE_MARK}${ev.id}:${state.run}`);
      dropRunShadows(profile, ev.id, state.run);
      settled.push(ev.id);
    }
  }
  return { letters, settled };
}

/** Summary line for an ended event. */
export function endedSummary(profile, ev) {
  const st = peekState(profile, ev.id);
  const read = st?.read?.length || 0;
  const coins = st?.settled?.coins || 0;
  return `You read ${read}/${(ev.episodes || []).length} episodes · ${coins.toLocaleString('en-US')} coins from leftover ${getItem(ev.currency.id)?.name || 'currency'}`;
}

export { EVENT_MAP };

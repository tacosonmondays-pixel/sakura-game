// The home's pure model (UI v2 "Ink & Paper" V2, notes/ui-v2/UI_V2_DIRECTION.md 12.1; the build plan's C12). Pure:
// src/ui/screens/lobby.js draws it, tests/ui/homeObjective.test.js and tests/ui/homeNews.test.js walk it.
//
// [ui-ink] UI M5d's tray (Notice, Tasks, Login gift), its sticker stack and the Multiplayer button with its two girls
// are folded into the v2 home (C12): Notice is the menu sheet's Notice row, Tasks the COMMISSIONS row's red dot, the
// login gift the objective; the stickers go (Happening Now lists what runs), and Multiplayer is a row of the rail.
//
//   The objective: the one next thing, the home's one yellow (its play tile). First match wins:
//     a saved battle > today's login gift > commissions to claim > an event phase that asks for you > the next story
//     stage > medals once the story is cleared.
//   The news card: up to three cards, paged by hand only (never on its own): the event (a running limited event, or
//     this week's double drops), the recruit banner, the weekly bosses (once Titan Trials or Total Assault is open).

/** A day in ms: an event's last day turns its phase into the objective. */
const DAY = 86400e3;

/**
 * The objective's source state, read by the lobby from the save (each field optional).
 * @typedef {{
 *   save?: { name: string, mode?: string|null, wave?: number|null }|null,
 *   login?: { ready: boolean, day?: number|null }|null,
 *   commissions?: { count: number, achOnly?: boolean }|null,
 *   event?: { name: string, phase: string, msLeft?: number|null }|null,
 *   next?: { id: string, name: string }|null,
 *   chapter?: { id: number, name: string }|null,
 * }} ObjectiveState
 */

/** The order the objective's sources are tried in (the first one that has something wins). */
export const OBJECTIVE_ORDER = Object.freeze(['continue', 'login', 'commissions', 'event', 'stage', 'medals']);

/**
 * An event phase that asks for the player now: the exchange is open (trade before it closes), or the event's last day.
 * @param {{ phase: string, msLeft?: number|null }|null|undefined} ev
 */
export function eventAsks(ev) {
  if (!ev) return false;
  if (ev.phase === 'exchange') return true;
  return ev.phase === 'active' && ev.msLeft != null && ev.msLeft > 0 && ev.msLeft <= DAY;
}

/**
 * The home's objective: the first source with something to do.
 * @param {ObjectiveState} s
 * @returns {{ kind: string, kicker: string, text: string, testid: string|null }}
 *   testid: the play tile's own hook when it shows a saved battle (lobby-continue) or the login gift (login-claim)
 */
export function homeObjective(s = {}) {
  if (s.save) {
    const sub = [s.save.mode, s.save.wave ? `Wave ${s.save.wave}` : null].filter(Boolean).join(' · ');
    return { kind: 'continue', kicker: 'Continue', text: sub ? `${s.save.name} · ${sub}` : s.save.name, testid: 'lobby-continue' };
  }
  if (s.login?.ready) {
    return { kind: 'login', kicker: 'Daily gift', text: s.login.day ? `Claim your login gift: day\u00a0${s.login.day}` : 'Claim your login gift', testid: 'login-claim' };
  }
  const n = Math.max(0, Math.floor(s.commissions?.count || 0));
  if (n > 0) {
    const what = s.commissions.achOnly ? (n === 1 ? 'achievement' : 'achievements') : (n === 1 ? 'commission' : 'commissions');
    return { kind: 'commissions', kicker: 'Commissions', text: `Collect ${n} ${what}`, testid: null };
  }
  if (eventAsks(s.event)) {
    const text = s.event.phase === 'exchange' ? `${s.event.name}: exchange open` : `Last day: ${s.event.name}`;
    return { kind: 'event', kicker: 'Event', text, testid: null };
  }
  if (s.next) return { kind: 'stage', kicker: 'Next', text: `Clear ${s.next.id} ${s.next.name}`, testid: null };
  return { kind: 'medals', kicker: 'Next', text: s.chapter ? `Chase medals in Ch.${s.chapter.id}` : 'Chase Sakura medals', testid: null };
}

/**
 * The news card's source state.
 * @typedef {{
 *   limited?: { id: string, name: string, phase: string, msLeft?: number|null, art?: string|null }|null,
 *   weekly?: { name: string, arena: string, dropMul?: number, msLeft?: number|null }|null,
 *   recruit?: { pity?: number|null }|null,
 *   bosses?: { titans?: { open: boolean, name?: string|null }|null, assault?: { open: boolean }|null, msLeft?: number|null }|null,
 * }} NewsState
 */

/** At most this many cards in the news card. */
export const NEWS_MAX = 3;

/**
 * The news card's pages, in order: the event, the recruit banner, the weekly bosses.
 * @param {NewsState} s
 * @returns {{ id: string, kicker: string, short?: string, title: string, testid: string, timeTestid: string|null,
 *   msLeft: number|null, phase: string|null, art: string|null }[]}
 *   testid: the page's link (event-card for a limited event, event-strip for the week's double drops, as before);
 *   timeTestid: its countdown chip's hook; short: the kicker's short form, shown where the long one would wrap beside
 *   the countdown (the home's news chip on a phone)
 */
export function homeNews(s = {}) {
  const out = [];
  if (s.limited) {
    out.push({ id: 'event', kicker: 'Event', title: s.limited.name, testid: 'event-card', timeTestid: 'event-card-time', msLeft: s.limited.msLeft ?? null, phase: s.limited.phase, art: s.limited.art || null });
  } else if (s.weekly) {
    out.push({ id: 'weekly', kicker: `Event · ${s.weekly.dropMul || 2}× drops`, short: `${s.weekly.dropMul || 2}× drops`, title: s.weekly.name, testid: 'event-strip', timeTestid: 'event-strip-time', msLeft: s.weekly.msLeft ?? null, phase: null, art: null });
  }
  if (s.recruit) {
    out.push({ id: 'recruit', kicker: 'Recruit', title: s.recruit.pity ? `Spotlights · SSR in ${s.recruit.pity}` : 'Spotlights', testid: 'banner-recruit', timeTestid: null, msLeft: null, phase: null, art: 'ticket_recruit' });
  }
  const b = s.bosses;
  if (b?.titans?.open) {
    out.push({ id: 'bosses', kicker: 'Weekly bosses', short: 'Bosses', title: b.titans.name ? `Titan Trials · ${b.titans.name}` : 'Titan Trials', testid: 'banner-titans', timeTestid: 'banner-bosses-time', msLeft: b.msLeft ?? null, phase: null, art: 'token_boss' });
  } else if (b?.assault?.open) {
    out.push({ id: 'bosses', kicker: 'Weekly boss', short: 'Boss', title: 'Total Assault', testid: 'banner-assault', timeTestid: 'banner-bosses-time', msLeft: b.msLeft ?? null, phase: null, art: 'token_boss' });
  }
  return out.slice(0, NEWS_MAX);
}

/** The objective kinds that take a page of the home's news chip (home layout B): something to act on. The next story
 * stage and medals are the Battle plate's own job. */
export const CHIP_OBJECTIVES = Object.freeze(['continue', 'login', 'commissions', 'event']);

/** A limited event that runs now (its battles or its exchange open): it leads the news chip, so it shows at landing. */
const RUNNING = new Set(['active', 'exchange']);

/**
 * The home's news chip (home layout B "Quiet Home"): its pages in order, three at most, turned by hand only (UI v2 rule
 * 11 and P8: nothing on the home turns on its own). The page it opens on is the one the player sees at landing:
 *   - a saved battle waits: the objective (Continue) first, then the event;
 *   - a limited event runs (active, or its exchange open): the event first (its name and countdown at landing), then the
 *     objective (the login gift, commissions); an objective that is that event itself ("Last day", "exchange open") gives
 *     way to the event's own page, whose countdown says the same;
 *   - otherwise the objective first, then the event (or the week's double drops);
 * then the Main girl's next step (the Build Coach, BUILD_COACH.md §8: a filler page, never a new home element), the weekly
 * bosses, the unread Notice and the recruit banner while a page is free.
 * @param {{ objective?: { kind: string }|null, news?: { id: string, phase?: string|null }[], notice?: { id: string }|null,
 *   coach?: { id: string }|null }} s
 *   news: homeNews() pages; notice: the Notice page when it is unread; coach: the Main girl's next-step page
 * @returns {{ id: string }[]} the objective's page is { id: 'objective', o: objective }; the others are the news pages
 */
export function homeChipPages({ objective = null, news = [], notice = null, coach = null } = {}) {
  const ev = news.find((n) => n.id === 'event' || n.id === 'weekly') || null;
  const running = ev?.id === 'event' && RUNNING.has(ev.phase);
  let obj = objective && CHIP_OBJECTIVES.includes(objective.kind) ? { id: 'objective', o: objective } : null;
  if (obj && running && objective.kind === 'event') obj = null;
  const lead = running && obj?.o.kind !== 'continue' ? [ev, obj] : [obj, ev];
  const pages = [...lead, coach, ...news.filter((n) => n.id === 'bosses'), notice, ...news.filter((n) => n.id === 'recruit')];
  return pages.filter(Boolean).slice(0, NEWS_MAX);
}

/** The Multiplayer row's accessible name: "Multiplayer, 1 open invite". */
export function multiplayerLabel(count = 0) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  return n ? `Multiplayer, ${n} open invite${n === 1 ? '' : 's'}` : 'Multiplayer';
}

// UI M5c: Happening Now's model (docs/specs/UI_DIRECTION.md §5.9, §5.10 E3, E9; notes/ui-m5/PLAN.md §5 M5c; the
// reference study's "one list of everything running"). Pure apart from reading the save: src/ui/screens/rewards.js
// draws it (route #/rewards, titled "Happening Now"), tests/ui/happening.test.js walks it.
//
// In Progress (rows sorted by the deadline nearest first; rows without one, then locked rows, last):
//   - a limited event while it runs (its end is a deadline: red under 24 h), then in its exchange days;
//   - this week's double drops in one Bounty arena (a weekly rotation: never red);
//   - the Titan of the Week (Titan Trials), Total Assault, and the clan boss week (only when the social hub is ready:
//     the player went online and the server has the social update).
// Coming Up: limited events that are teased but not open yet, and the next two weeks' double-drop rotation.
// Off season (E9): no limited event is running (none active, none in its exchange days): one band with one sentence
// and the next festival's date when one is teased; the weekly rows still show under it.
// An ended event leaves In Progress; its page stays readable from the band ("Past festival").
import { listEvents, eventWindow, eventUnlocked } from '../systems/events.js';
import { currentEvent } from '../systems/missions.js';
import { titanOfWeek, titansUnlocked, TIER_STAGE } from '../systems/titans.js';
import { TITAN_MAP } from '../data/titans.js';
import { isStageUnlocked } from '../systems/unlocks.js';
import { stagesOfKind } from '../data/stages.js';
import { nextWeeklyReset } from '../core/reset.js';
import { msToWeekReset } from '../online/clanRules.js';
import { msToLocalWeekEnd } from './countdown.js';

/** The rail sections, in order: In Progress · Coming Up · Free pulls. */
export const HAPPENING_SECTIONS = Object.freeze(['now', 'soon', 'free']);

const DAY = 24 * 3600e3;
const WEEK = 7 * DAY;
/** The first Bounty arena's first stage: double drops are only worth a row once Bounty is open. */
export const BOUNTY_GATE = 'res-books-1';

/** A short date in the player's own clock: "Dec 18". */
export function shortDate(t) {
  try {
    return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

/**
 * @param {object} profile the save
 * @param {{ now?: number, eventNow?: number, social?: boolean }} [o] now: the game clock (Date.now()); eventNow: the
 *   events' clock (src/ui/events/clock.js: the same in production); social: the social hub is ready
 * @returns {{ now: object[], soon: object[], offSeason: null|{ next: null|{ id: string, name: string, at: number },
 *   past: null|{ id: string, name: string } }, running: number, endingSoon: string|null }}
 *   A row: { id, kind, title, line, msLeft (null: no chip), label, urgent, inProgress, go: { name, params }|null,
 *   locked: string|null (why it is closed), arena?: string, event?: object }
 */
export function happeningModel(profile, { now = Date.now(), eventNow = now, social = false } = {}) {
  const events = listEvents(profile, eventNow);
  const rowsNow = [];
  const rowsSoon = [];
  let endingSoon = null;
  for (const { ev, phase } of events) {
    const w = eventWindow(ev);
    if (phase === 'active') {
      const msLeft = Math.max(0, w.endAt - eventNow);
      const joined = eventUnlocked(profile, ev);
      if (msLeft < DAY && !endingSoon) endingSoon = ev.name;
      rowsNow.push({
        id: ev.id, kind: 'event', event: ev, title: ev.name,
        line: joined ? ev.subtitle : `Clear ${ev.unlock?.stage} to join`,
        msLeft, label: 'Ends in', urgent: true, inProgress: joined, go: { name: 'event', params: { id: ev.id } }, locked: null,
      });
    } else if (phase === 'exchange') {
      const msLeft = Math.max(0, w.exchangeEndAt - eventNow);
      if (msLeft < DAY && !endingSoon) endingSoon = ev.name;
      rowsNow.push({
        id: ev.id, kind: 'exchange', event: ev, title: ev.name, line: `Exchange open: spend your ${ev.currency?.plural || ev.currency?.name || 'tokens'}`,
        msLeft, label: 'Closes in', urgent: true, inProgress: false, go: { name: 'event', params: { id: ev.id, tab: 'exchange' } }, locked: null,
      });
    } else if (phase === 'upcoming') {
      rowsSoon.push({
        id: ev.id, kind: 'event', event: ev, title: ev.name, line: ev.subtitle,
        msLeft: Math.max(0, w.startAt - eventNow), label: 'Opens in', urgent: false, inProgress: false, go: { name: 'event', params: { id: ev.id } }, locked: null,
      });
    }
  }

  // this week's double drops (the weekly rotation, local Monday)
  const week = currentEvent(new Date(now));
  const bountyOpen = isStageUnlocked(profile, BOUNTY_GATE);
  rowsNow.push({
    id: 'week', kind: 'week', title: week.name, line: `${week.dropMul}× drops in ${week.arenaName}`, arena: week.arena,
    msLeft: msToLocalWeekEnd(now), label: 'Ends in', urgent: false, inProgress: false,
    go: bountyOpen ? { name: 'bounty', params: { arena: week.arena } } : null, locked: bountyOpen ? null : 'Opens with Bounty',
  });

  // the Titan of the Week (the game week, Sunday 7 PM Central)
  const titansOpen = titansUnlocked(profile);
  const titan = TITAN_MAP[titanOfWeek(now)];
  rowsNow.push({
    id: 'titans', kind: 'titans', title: 'Titan Trials', line: titan ? `${titan.name} stands this week` : 'A new titan every week',
    msLeft: Math.max(0, nextWeeklyReset(now) - now), label: 'Ends in', urgent: false, inProgress: false,
    go: titansOpen ? { name: 'titans', params: {} } : null, locked: titansOpen ? null : `Clear ${TIER_STAGE.normal} first`,
  });

  // Total Assault: always on, no deadline
  const firstBoss = stagesOfKind('boss')[0];
  const assaultOpen = !!firstBoss && isStageUnlocked(profile, firstBoss.id);
  rowsNow.push({
    id: 'assault', kind: 'assault', title: 'Total Assault', line: 'Bosses drop crowns',
    msLeft: null, label: null, urgent: false, inProgress: false,
    go: assaultOpen ? { name: 'assault', params: {} } : null, locked: assaultOpen ? null : 'Clear more stages first',
  });

  // the clan boss week (UTC Monday), only once the social hub is ready
  if (social) {
    rowsNow.push({
      id: 'clanboss', kind: 'clanboss', title: 'Clan Boss', line: 'Your clan\'s boss of the week',
      msLeft: msToWeekReset(now), label: 'Resets in', urgent: false, inProgress: false, go: { name: 'clan', params: { tab: 'boss' } }, locked: null,
    });
  }

  // the next two weeks' double drops
  for (const [i, at] of [[0, now + WEEK], [1, now + 2 * WEEK]]) {
    const wk = currentEvent(new Date(at));
    rowsSoon.push({
      id: `week-${i + 1}`, kind: 'week', title: wk.name, line: `${wk.dropMul}× drops in ${wk.arenaName}`, arena: wk.arena,
      msLeft: msToLocalWeekEnd(now) + i * WEEK, label: 'Starts in', urgent: false, inProgress: false, go: null, locked: null,
    });
  }

  const rank = (r) => (r.locked ? 2 : r.msLeft == null ? 1 : 0);
  const order = (a, b) => rank(a) - rank(b) || (a.msLeft ?? Infinity) - (b.msLeft ?? Infinity);
  rowsNow.sort(order);
  rowsSoon.sort(order);

  const limitedRunning = events.some((r) => r.phase === 'active' || r.phase === 'exchange');
  let offSeason = null;
  if (!limitedRunning) {
    const next = events.filter((r) => r.phase === 'upcoming').map((r) => ({ id: r.ev.id, name: r.ev.name, at: eventWindow(r.ev).startAt })).sort((a, b) => a.at - b.at)[0] || null;
    const ended = events.filter((r) => r.phase === 'ended').map((r) => ({ id: r.ev.id, name: r.ev.name, at: eventWindow(r.ev).exchangeEndAt })).sort((a, b) => b.at - a.at)[0] || null;
    offSeason = { next, past: ended ? { id: ended.id, name: ended.name } : null };
  }
  return {
    now: rowsNow,
    soon: rowsSoon,
    offSeason,
    running: rowsNow.filter((r) => !r.locked).length,
    endingSoon,
  };
}

/** Suzu's state (hostLines.js 'happening'). */
export function happeningHostState(model) {
  return { running: model.running, endingSoon: model.endingSoon || undefined };
}

/** The E9 band's sentence and date. */
export function offSeasonText(off) {
  if (!off) return null;
  return {
    text: off.next ? `No festival right now. ${off.next.name} is on its way!` : 'No festival right now. The next one is on its way!',
    date: off.next ? `Opens ${shortDate(off.next.at)}` : null,
  };
}

// UI M5b: what each hub tells its host girl about the player's state (the `state` of hostLines.js linesFor), read from
// the save. No DOM; the screens call these and tests/ui/hubStates.test.js walks them over real saves. (titansState
// reads keyState(), which fills the week's Trial Keys on its first look of a new week, as Titan Trials itself does.)
//
//   linesFor('commissions', commissionsState(profile))[0]   "3 commissions are ready!"
import { STAGE_MAP } from '../data/stages.js';
import { nextStage, isStageUnlocked } from '../systems/unlocks.js';
import { missionList, loginCalendar, currentEvent } from '../systems/missions.js';
import { titansUnlocked, keyState } from '../systems/titans.js';
import { stagesOfKind } from '../data/stages.js';
import { msToLocalWeekEnd } from './countdown.js';

const DAY_MS = 24 * 3600e3;

/** Missions (the secretary): the next stage, Titan Trials open, this week's double drops (once Bounty is open). */
export function missionsState(profile, { now = Date.now() } = {}) {
  const next = nextStage(profile);
  const def = next ? STAGE_MAP[next] : null;
  return {
    next: def ? `${def.id} ${def.name}` : null,
    titansOpen: titansUnlocked(profile),
    doubleDrop: isStageUnlocked(profile, 'res-books-1') ? currentEvent(new Date(now)).arenaName : null,
  };
}

/** Commissions (Miko): commissions ready on both lists, today's login gift, every daily claimed. */
export function commissionsState(profile, { now = new Date() } = {}) {
  const ml = missionList(profile);
  const ready = ml.daily.filter((m) => m.claimable).length + ml.weekly.filter((m) => m.claimable).length;
  return {
    ready,
    loginReady: loginCalendar(profile, now).claimable,
    allDone: ml.daily.length > 0 && ml.daily.every((m) => m.claimed),
  };
}

/** The Login tab (Miko): today's gift waiting, or the day stamped last. */
export function loginState(profile, { now = new Date() } = {}) {
  const cal = loginCalendar(profile, now);
  const stamped = cal.days.filter((d) => d.claimed).map((d) => d.day);
  return { claimable: cal.claimable, day: stamped.length ? Math.max(...stamped) : 0 };
}

/** Bounty (the week's guest): the double drops end within a day. */
export function bountyState({ now = Date.now() } = {}) {
  return { endsSoon: msToLocalWeekEnd(now) < DAY_MS };
}

/** Total Assault (Rei): the first boss is still locked. */
export function assaultState(profile) {
  const first = stagesOfKind('boss')[0];
  return { locked: !first || !isStageUnlocked(profile, first.id) };
}

/** Titan Trials (Kaede): locked, the Trial Keys left, a fresh week (no key used yet). */
export function titansState(profile, { now = Date.now() } = {}) {
  if (!titansUnlocked(profile)) return { locked: true };
  const keys = keyState(profile, now);
  return { locked: false, keys: keys.left, newWeek: keys.left >= keys.weekly };
}

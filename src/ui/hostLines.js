// What the host girl says (docs/specs/UI_DIRECTION.md §5.10 E1): one line of at most 60 characters, picked by the
// screen's state ("3 ready", "Event ends tomorrow", "Nothing to claim, nice work"), most urgent first. A tap shows
// the next one. Each line holds at most one number, because numbers in a bubble count toward the screen's 12 (P3).
// Pure: the screens pass their state in. Original, cute and wholesome (P9).
//
//   linesFor('mail', { gifts: 2 })   ['2 letters came with gifts!', 'Gifts stay here until you claim them.']

export const MAX_LINE = 60;

/** Numbers in a line: "2-3", "12:05" and "1,200" each count once. */
export function numberCount(line) {
  return (String(line).match(/\d+(?:[.,:/-]\d+)*/g) || []).length;
}

/** A line the bubble may show: 1-60 characters, at most one number. */
export function lineOk(line) {
  return typeof line === 'string' && line.length > 0 && line.length <= MAX_LINE && numberCount(line) <= 1;
}

const many = (n, one, more) => (n === 1 ? one : more.replace('#', String(n)));
const whole = (v) => Math.max(0, Math.floor(Number(v) || 0));

/** Per screen: state → lines, most urgent first (falsy entries are dropped). The last line always fits any state. */
export const LINES = Object.freeze({
  missions: (s) => [
    s.next && `Next up: ${s.next}. Shall we go?`,
    s.titansOpen && 'Titan Trials are open this week!',
    s.doubleDrop && `Double drops in ${s.doubleDrop} this week.`,
    'Pick a mission, Sensei. I will cheer you on!',
  ],
  commissions: (s) => [
    whole(s.ready) > 0 && many(whole(s.ready), 'A commission is ready to claim!', '# commissions are ready to claim!'),
    s.loginReady && 'Today\'s login gift is waiting, Sensei!',
    s.allDone && 'All done today. Nice work, Sensei!',
    'Little by little, every commission counts.',
  ],
  login: (s) => [
    s.claimable && 'Today\'s login gift is waiting, Sensei!',
    !s.claimable && whole(s.day) > 0 && `Day ${whole(s.day)} is stamped. See you tomorrow!`,
    'A new gift every day you drop by!',
  ],
  bounty: (s) => [
    s.endsSoon && 'The double drops end soon. Last call!',
    'Double drops here until the weekly reset!',
    'Bring a full team. The arenas hit back!',
  ],
  assault: (s) => [
    s.locked && 'Clear more stages and we can storm the bosses!',
    'The crowns are at the top, Sensei.',
    'Bosses drop crowns. Shall we try?',
  ],
  titans: (s) => [
    whole(s.keys) > 0 && many(whole(s.keys), 'One Trial Key left this week. Make it count!', '# Trial Keys this week. Ready?'),
    s.newWeek && 'A new titan stands this week. Ready?',
    'Each titan has a weak spot. Let us find it!',
  ],
  mall: (s) => [
    s.restockSoon && 'Daily stock is back soon. Need anything?',
    'Welcome in! Take your time, Sensei.',
  ],
  mail: (s) => [
    whole(s.gifts) > 0 && many(whole(s.gifts), 'A letter came with a gift!', '# letters came with gifts!'),
    whole(s.gifts) > 0 && 'Gifts stay here until you claim them.',
    'All caught up. No new mail.',
  ],
  happening: (s) => [
    s.endingSoon && `${s.endingSoon} ends soon, Sensei!`,
    whole(s.running) > 0 && many(whole(s.running), 'One thing is running right now!', '# things are running right now!'),
    'Nothing limited right now. Rest up!',
  ],
  multiplayer: (s) => [
    whole(s.invites) > 0 && many(whole(s.invites), 'A friend invited you! Want to join?', '# invites are waiting. Want to join?'),
    'Make a room and invite a friend!',
    'Two Senseis, one map. Let us team up!',
  ],
});

/**
 * The lines for `screen` in `state`, most urgent first; never empty for a known screen. Lines that would break
 * the bubble rules (a long stage name, a second number) are skipped.
 * @param {string} screen a LINES key (the same keys as hosts.js HOSTS)
 * @param {object} [state]
 * @returns {string[]}
 */
export function linesFor(screen, state = {}) {
  const make = LINES[screen];
  if (!make) return [];
  return [...new Set(make(state || {}).filter(lineOk))];
}

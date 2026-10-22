// What the host girl says (docs/specs/UI_DIRECTION.md §5.10 E1): one line, picked by the screen's state ("3 ready",
// "An event ends soon", "All caught up"), most urgent first. A tap shows the next one.
//
// Every line must be TRUE in the state it shows in, because a tap cycles through all of them: a line about an empty
// state ("All caught up", "Quiet for now") shows only in that state, a line that invites the player to act shows only
// when they can, and each screen ends with neutral lines that are true in every state. tests/ui/hostLines.test.js
// walks every state and fails on a line that contradicts it.
//
// One line means one line in her bubble at 844x390: at most 34 characters on a hub (her bubble holds about 240 px of
// text) and 24 on a list screen (26% wide: about 170 px). The spec's "at most 60" is the upper bound; the bubble is
// the real one. e2e/m5-kit.mjs measures every line at 844x390 and 1280x720. Each line holds at most one number,
// because numbers in a bubble count toward the screen's 12 (P3). Pure: the screens pass their state in. Original,
// cute and wholesome (P9).
//
//   linesFor('mail', { gifts: 2 })   ['2 letters have gifts!', "Don't forget to claim!", 'Mail from the academy!']

/** The most characters a line may have, by the kind of screen her bubble sits on. */
export const MAX_LINE = Object.freeze({ hub: 34, list: 24 });

/** The list screens (E3: a left rail, the host on the right at 26% / 30%); every other hosted screen is a hub. */
export const LIST_SCREENS = Object.freeze(['mail', 'mall', 'happening']);

/** 'list' or 'hub': the bubble width a screen's lines must fit. */
export const lineKind = (screen) => (LIST_SCREENS.includes(screen) ? 'list' : 'hub');

/** Numbers in a line: "2-3", "12:05" and "1,200" each count once. */
export function numberCount(line) {
  return (String(line).match(/\d+(?:[.,:/-]\d+)*/g) || []).length;
}

/** A line the bubble may show on a `kind` screen: 1 to MAX_LINE[kind] characters, at most one number. */
export function lineOk(line, kind = 'hub') {
  const max = MAX_LINE[kind] || MAX_LINE.hub;
  return typeof line === 'string' && line.length > 0 && line.length <= max && numberCount(line) <= 1;
}

const many = (n, one, more) => (n === 1 ? one : more.replace('#', String(n)));
/** A count the screen passed (a whole number ≥ 0), or null when it passed none: "0" is a claim, "unknown" is not. */
const count = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.floor(Number(v))));

/**
 * Per screen: state → lines, most urgent first (falsy entries are dropped). The last lines are the neutral ones:
 * true in every state.
 */
export const LINES = Object.freeze({
  missions: (s) => [
    s.next && `Next up: ${s.next}!`,
    s.titansOpen && 'Titan Trials are open this week!',
    s.doubleDrop && `Double drops in ${s.doubleDrop}!`,
    'I\'ll cheer you on, Sensei!',
  ],
  commissions: (s) => {
    const ready = count(s.ready);
    return [
      ready > 0 && many(ready, 'A commission is ready!', '# commissions are ready!'),
      s.loginReady && 'Today\'s login gift is waiting!',
      s.allDone && !(ready > 0) && !s.loginReady && 'All done today. Nice work!',
      'Little by little, it all counts!',
    ];
  },
  login: (s) => {
    const day = count(s.day);
    return [
      s.claimable && 'Today\'s login gift is waiting!',
      !s.claimable && day > 0 && `Day ${day} stamped. See you tomorrow!`,
      'A new gift every day you drop by!',
    ];
  },
  bounty: (s) => [
    s.endsSoon && 'Double drops end soon. Last call!',
    'Double drops until the reset!',
    'Bring a full team, Sensei!',
  ],
  assault: (s) => [
    s.locked && 'Clear more stages first, Sensei!',
    !s.locked && 'Bosses drop crowns. Shall we try?',
    'The crowns wait at the top!',
  ],
  titans: (s) => {
    const keys = count(s.keys);
    return [
      s.locked && 'Clear more stages first, Sensei!',
      !s.locked && keys === 1 && 'One Trial Key left. Make it count!',
      !s.locked && keys > 1 && `${keys} Trial Keys this week. Ready?`,
      !s.locked && keys === 0 && 'No keys left. More next week!',
      !s.locked && s.newWeek && 'A new titan stands this week!',
      !s.locked && keys !== 0 && 'Let\'s find its weak spot!',
      'Every titan has a weak spot.',
    ];
  },
  mall: (s) => [
    s.restockSoon && 'Fresh stock soon!',
    'Welcome in, Sensei!',
    'Take your time!',
  ],
  mail: (s) => {
    const gifts = count(s.gifts);
    return [
      gifts > 0 && s.expiring && 'A gift expires soon!', // (UI M5c: a gift under 24 h)
      gifts > 0 && many(gifts, 'A letter has a gift!', '# letters have gifts!'),
      gifts > 0 && 'Don\'t forget to claim!',
      gifts === 0 && 'All caught up, Sensei!',
      'Mail from the academy!',
    ];
  },
  happening: (s) => {
    const running = count(s.running);
    return [
      typeof s.endingSoon === 'string' && `${s.endingSoon} ends soon!`,
      s.endingSoon && 'An event ends soon!', // (a long event name does not fit the list bubble)
      running > 0 && many(running, 'One thing on right now!', '# things on right now!'),
      running === 0 && !s.endingSoon && 'Quiet for now. Rest up!',
      'Events pop up here!',
    ];
  },
  multiplayer: (s) => {
    const invites = count(s.invites);
    return [
      invites > 0 && many(invites, 'A friend invited you! Join?', '# invites are waiting!'),
      'Make a room and invite a friend!',
      'Let\'s team up, Sensei!',
    ];
  },
});

/**
 * The lines for `screen` in `state`, most urgent first; never empty for a known screen. Lines that would break
 * the bubble rules (a long stage or event name, a second number) are skipped.
 * @param {string} screen a LINES key (the same keys as hosts.js HOSTS)
 * @param {object} [state]
 * @returns {string[]}
 */
export function linesFor(screen, state = {}) {
  const make = LINES[screen];
  if (!make) return [];
  const kind = lineKind(screen);
  return [...new Set(make(state || {}).filter((l) => lineOk(l, kind)))];
}

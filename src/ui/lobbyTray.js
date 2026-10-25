// UI M5d: the lobby's fold (docs/specs/UI_DIRECTION.md §7 M5 "fold the top-left buttons into one tray"; notes/ui-m5/PLAN.md
// §5 M5d, Q11 and Q12). Pure: src/ui/screens/lobby.js draws it, tests/ui/lobbyTray.test.js walks it.
//
//   The tray: Notice · Tasks · Login gift in one glass strip under the level plate. "Buy gems" went: the gem pill's "+"
//   opens the Gem Shop too (Q11). One badge each (badges.js badgeFor: a red dot to claim or read wins over n/m).
//   The sticker stack (Q12): at most 2 stickers, one per running thing the lobby does not already show, each opening
//   Happening Now. The EVENT card shows the limited event (or this week's double drops when none runs), so the double
//   drops get a sticker only while a limited event holds the card.
//   The Multiplayer button: Momo + Sango (owner #108) and a red number for the open invites (openInvites.js).
import { badgeFor } from './badges.js';

/** The tray, in order (test ids unchanged from the four shortcuts it replaced). */
export const TRAY = Object.freeze([
  Object.freeze({ id: 'notice', label: 'Notice', icon: 'notice', testid: 'shortcut-notice' }),
  Object.freeze({ id: 'tasks', label: 'Tasks', icon: 'tasks', testid: 'shortcut-tasks' }),
  Object.freeze({ id: 'gift', label: 'Login gift', icon: 'gift', testid: 'login-claim' }),
]);

/** The girls on the lobby's Multiplayer button (owner #108). */
export const MULTIPLAYER_GIRLS = Object.freeze(['momo', 'sango']);

/** At most this many numbers on the lobby (P3), outside the currency bar and repeated tiles. */
export const LOBBY_NUMBERS_MAX = 12;
/** At most this many stickers in the stack (Q12). */
export const STICKERS_MAX = 2;

/**
 * The tray's buttons with their one badge each.
 * @param {{ noticeUnread?: boolean, tasksDone?: number, tasksTotal?: number, tasksClaim?: boolean, loginReady?: boolean }} s
 * @returns {{ id: string, label: string, icon: string, testid: string, badge: null|{ kind: string, text?: string }, ready: boolean }[]}
 */
export function trayItems({ noticeUnread = false, tasksDone = 0, tasksTotal = 0, tasksClaim = false, loginReady = false } = {}) {
  const badges = {
    notice: badgeFor({ claim: !!noticeUnread }),
    tasks: badgeFor({ claim: !!tasksClaim, progress: [tasksDone, tasksTotal] }),
    gift: badgeFor({ claim: !!loginReady }),
  };
  return TRAY.map((t) => ({ ...t, badge: badges[t.id], ready: t.id === 'gift' && !!loginReady }));
}

/**
 * The sticker stack: at most two running things the lobby does not show elsewhere, each opening Happening Now.
 * @param {{ limitedOnCard?: boolean, bountyOpen?: boolean, dropMul?: number, titansOpen?: boolean }} s
 *   limitedOnCard: a limited event holds the EVENT card (the double drops are not on screen then)
 * @returns {{ id: string, text: string, go: { name: string, params: object } }[]}
 */
export function lobbyStickers({ limitedOnCard = false, bountyOpen = false, dropMul = 2, titansOpen = false } = {}) {
  const go = { name: 'rewards', params: { tab: 'now' } };
  return [
    titansOpen ? { id: 'titans', text: 'Titans open!', go } : null,
    limitedOnCard && bountyOpen ? { id: 'drops', text: `${dropMul}× drops`, go } : null,
  ].filter(Boolean).slice(0, STICKERS_MAX);
}

/** The Multiplayer button's accessible name: "Multiplayer, 1 open invite". */
export function multiplayerLabel(count = 0) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  return n ? `Multiplayer, ${n} open invite${n === 1 ? '' : 's'}` : 'Multiplayer';
}

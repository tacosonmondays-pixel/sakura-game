// When the Journal pill (toast.js) steps aside (owner: story). The pill sits at z 350, over every modal and sheet, so
// while anything layers over the page it would sit on that layer's top row and take the taps meant for it (a girl
// in the SSR Select Ticket picker, a Notice tab, the unit-info sheet's buttons opened the Journal instead). So while
// one of these is open the pill is held: hidden, no pointer events, and its clock stops; once the last one closes it
// shows again for the time it had left (at least RESUME_MIN_MS, so it never just blinks). The lesson itself is
// unlocked either way: the pill only announces it.

/**
 * Everything that layers over the page (each is a child of <body>). A modal, a sheet or the Menu stops counting from
 * the first frame of closing (.closing: taps already go through to the page); the recruit reveal fades out still
 * taking taps, so it counts until it is gone.
 */
export const PILL_HOLD_LAYERS = [
  '.modal-overlay:not(.closing)', // every modal: Notice, mailbox and gift letters, beta gift, SSR Select Ticket, the
  //                                 unit-info hold sheet (.us-overlay), confirms, rewards, achievements
  '.ui-layer:not(.closing)', //      the sheet kit (gear, items, craft, build coach, profile parts) and the profile preview
  '.home-menu-layer:not(.closing)', // the home Menu
  '.ma-gacha', //                    the recruit reveal, its SSR / LR cinematic and the results
  '.mb-sheet-overlay', //            the bestiary sheet
  '.ol-drawer-overlay', //           the chat drawer
  '.stk-pick-overlay', //            the sticker picker
  '.sp', //                          a story scene (over a screen, or as one)
  '.ach-fanfare', //                 the special fanfare (drawn over the pill: it waits under it)
  '.rotate-overlay:not([hidden])', // the rotate reminder (the same)
];
export const PILL_HOLD_SELECTOR = PILL_HOLD_LAYERS.join(', ');

/** The shortest show after a hold, so a pill that was nearly done never blinks on and off. */
export const RESUME_MIN_MS = 1500;

/**
 * The pill's clock: counts only while it shows.
 * @param {number} ms how long it shows in all
 * @returns {{ hold(now: number): void, release(now: number): number, left(now: number): number, held: boolean }}
 *   release() returns how long it shows from now on
 */
export function pillClock(ms, now = 0) {
  let left = ms;
  let since = now; // when the current showing stretch started (null while held)
  let shown = false; // it has shown at least once
  return {
    get held() { return since == null; },
    hold(t) {
      if (since == null) return;
      if (t > since) shown = true;
      left = Math.max(0, left - (t - since));
      since = null;
    },
    release(t) {
      if (since != null) return left;
      since = t;
      if (shown) left = Math.max(left, RESUME_MIN_MS);
      return left;
    },
    left(t) { return since == null ? left : Math.max(0, left - (t - since)); },
  };
}

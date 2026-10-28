// UI M5c: the Mailroom's model (docs/specs/UI_DIRECTION.md §5.10 E3; notes/ui-m5/PLAN.md §5 M5c, Q7): which letters sit
// under each rail section, in what order, and what each row shows. Pure: the letters come from src/systems/mail.js
// mailList(); tests/ui/mailroom.test.js walks it.
//
// - Unclaimed: every gift still waiting (claimable), the ones that expire soonest first, then the newest; and a
//   notice (a letter without gifts: "Potential grew!") for its first week, so news is never filed away unread.
// - History: the rest, newest first: claimed gifts, expired ones and older notices.
// - A row's expiry is a deadline (something is lost at zero): under 24 h its countdown chip turns red (§5.9).

/** The rail sections, in order (Q7: "Unclaimed · History"). */
export const MAIL_SECTIONS = Object.freeze(['unclaimed', 'history']);

const DAY = 24 * 3600e3;
/** A notice stays under Unclaimed this long after it arrived. */
export const NOTICE_FRESH_MS = 7 * DAY;
/** Under this much time left, a gift's expiry is urgent (the chip turns red). */
export const URGENT_MS = DAY;

/**
 * What a letter is now.
 * @param {{ claimable: boolean, claimed: boolean, expired: boolean, rewards: object[] }} l a mailList() row
 * @returns {'gift'|'notice'|'claimed'|'expired'}
 */
export function letterKind(l) {
  if (l.claimable) return 'gift';
  if (l.claimed) return 'claimed';
  if (l.expired) return 'expired';
  return 'notice';
}

/** The section a letter belongs to at `now`. */
export function mailSection(l, now = Date.now()) {
  const kind = letterKind(l);
  if (kind === 'gift') return 'unclaimed';
  if (kind === 'notice' && now - (Number(l.sentAt) || 0) < NOTICE_FRESH_MS) return 'unclaimed';
  return 'history';
}

/**
 * The Mailroom's rows by section, plus what the rail and the host need.
 * @param {object[]} letters mailList(profile, now)
 * @param {number} [now]
 * @returns {{ unclaimed: object[], history: object[], gifts: number, expiring: number,
 *   dots: { unclaimed: boolean, history: boolean } }} gifts: letters with gifts waiting; expiring: of those, the ones
 *   under 24 h
 */
export function mailroomModel(letters, now = Date.now()) {
  const rows = (letters || []).map((l) => {
    const kind = letterKind(l);
    const msLeft = kind === 'gift' && l.expiresAt != null ? Math.max(0, l.expiresAt - now) : null;
    return { ...l, kind, msLeft, urgent: msLeft != null && msLeft < URGENT_MS };
  });
  const newest = (a, b) => (Number(b.sentAt) || 0) - (Number(a.sentAt) || 0);
  const unclaimed = rows.filter((r) => mailSection(r, now) === 'unclaimed').sort((a, b) => {
    // gifts before notices; among gifts the soonest expiry first; then the newest
    if ((a.kind === 'gift') !== (b.kind === 'gift')) return a.kind === 'gift' ? -1 : 1;
    const ea = a.msLeft ?? Infinity;
    const eb = b.msLeft ?? Infinity;
    if (ea !== eb) return ea - eb;
    return newest(a, b);
  });
  const history = rows.filter((r) => mailSection(r, now) === 'history').sort(newest);
  const gifts = unclaimed.filter((r) => r.kind === 'gift').length;
  return {
    unclaimed,
    history,
    gifts,
    expiring: unclaimed.filter((r) => r.urgent).length,
    // red dots only (P7): a gift to claim; History never has one
    dots: { unclaimed: gifts > 0, history: false },
  };
}

/** The host's state for hostLines.js ('mail'): gifts waiting, one expiring within a day. */
export function mailHostState(model) {
  return { gifts: model.gifts, expiring: model.expiring > 0 };
}

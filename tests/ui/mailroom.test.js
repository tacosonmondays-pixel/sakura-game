// UI M5c: the Mailroom's model (src/ui/mailroom.js): which letters sit under Unclaimed and History, their order, the
// expiry urgency (red under 24 h), the rail's red dot and Hotaru's state, on real letters from src/systems/mail.js.
import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { deliverMail, mailList, claimMail } from '../../src/systems/mail.js';
import { mailroomModel, mailSection, letterKind, mailHostState, MAIL_SECTIONS, NOTICE_FRESH_MS } from '../../src/ui/mailroom.js';
import { linesFor } from '../../src/ui/hostLines.js';

const H = 3600e3;
const NOW = Date.UTC(2026, 9, 27, 17);

function box() {
  const p = createProfile();
  p.mail = { letters: [], delivered: [], legacy: false };
  return p;
}
const gift = (id, extra = {}) => ({ id, title: id, body: 'A gift for you.', rewards: [{ id: 'gems', count: 100 }], ...extra });

describe('the Mailroom model', () => {
  it('two sections in the rail: Unclaimed · History (Q7)', () => {
    expect(MAIL_SECTIONS).toEqual(['unclaimed', 'history']);
  });

  it('a gift waits under Unclaimed; once claimed it moves to History', () => {
    const p = box();
    deliverMail(p, gift('a'), NOW - H);
    let m = mailroomModel(mailList(p, NOW), NOW);
    expect(m.unclaimed.map((l) => l.id)).toEqual(['a']);
    expect(m.history).toEqual([]);
    expect(m.gifts).toBe(1);
    expect(m.dots).toEqual({ unclaimed: true, history: false });
    expect(claimMail(p, 'a', NOW).ok).toBe(true);
    m = mailroomModel(mailList(p, NOW), NOW);
    expect(m.unclaimed).toEqual([]);
    expect(m.history.map((l) => [l.id, l.kind])).toEqual([['a', 'claimed']]);
    expect(m.dots.unclaimed).toBe(false);
  });

  it('an expired gift goes to History; it can never be claimed there', () => {
    const p = box();
    deliverMail(p, gift('old', { expiresAt: NOW - 1 }), NOW - 48 * H);
    const m = mailroomModel(mailList(p, NOW), NOW);
    expect(m.unclaimed).toEqual([]);
    expect(m.history[0].kind).toBe('expired');
  });

  it('a notice (no gift) is news for a week under Unclaimed, then History', () => {
    const p = box();
    deliverMail(p, { id: 'notice', title: 'Potential grew!', body: 'Read me.', rewards: [] }, NOW);
    const l = mailList(p, NOW)[0];
    expect(letterKind(l)).toBe('notice');
    expect(mailSection(l, NOW + NOTICE_FRESH_MS - 1)).toBe('unclaimed');
    expect(mailSection(l, NOW + NOTICE_FRESH_MS)).toBe('history');
    // a notice is never counted as a gift (no Claim all for it, no red dot)
    const m = mailroomModel(mailList(p, NOW), NOW);
    expect(m.gifts).toBe(0);
    expect(m.dots.unclaimed).toBe(false);
  });

  it('expiry urgency: under 24 h the chip turns red (a deadline); the soonest expiry comes first, notices last', () => {
    const p = box();
    deliverMail(p, gift('later', { expiresAt: NOW + 72 * H }), NOW - 3 * H);
    deliverMail(p, gift('soon', { expiresAt: NOW + 5 * H }), NOW - 2 * H);
    deliverMail(p, gift('never'), NOW - H);
    deliverMail(p, { id: 'news', title: 'News', rewards: [] }, NOW);
    const m = mailroomModel(mailList(p, NOW), NOW);
    expect(m.unclaimed.map((l) => l.id)).toEqual(['soon', 'later', 'never', 'news']);
    expect(m.unclaimed.map((l) => l.urgent)).toEqual([true, false, false, false]);
    expect(m.unclaimed[0].msLeft).toBe(5 * H);
    expect(m.unclaimed[2].msLeft).toBe(null);
    expect(m.expiring).toBe(1);
  });

  it('History is newest first', () => {
    const p = box();
    deliverMail(p, gift('first'), NOW - 3 * H);
    deliverMail(p, gift('second'), NOW - 2 * H);
    claimMail(p, 'first', NOW);
    claimMail(p, 'second', NOW);
    expect(mailroomModel(mailList(p, NOW), NOW).history.map((l) => l.id)).toEqual(['second', 'first']);
  });

  it('Hotaru: the gifts waiting, one expiring within a day, or all caught up', () => {
    const p = box();
    deliverMail(p, gift('a', { expiresAt: NOW + 2 * H }), NOW - H);
    deliverMail(p, gift('b'), NOW - H);
    const s = mailHostState(mailroomModel(mailList(p, NOW), NOW));
    expect(s).toEqual({ gifts: 2, expiring: true });
    expect(linesFor('mail', s)[0]).toBe('A gift expires soon!');
    expect(linesFor('mail', s)).toContain('2 letters have gifts!');
    const empty = mailHostState(mailroomModel([], NOW));
    expect(linesFor('mail', empty)[0]).toBe('All caught up, Sensei!');
  });
});

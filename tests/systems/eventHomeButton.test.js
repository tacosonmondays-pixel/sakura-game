// The home's Events button (owner, Oct 28: "add an events button at the bottom"): src/systems/events.js eventHomeButton
// says where it goes (the live event's page, else Happening Now), whether its red dot shows, and the time left for its
// sticker; src/ui/screens/lobby.js shortLeft writes that time short ("4d").
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createProfile } from '../../src/systems/save.js';
import { eventHomeButton, markEventLogin, eventState, trackEvent, claimAllEventMissions } from '../../src/systems/events.js';
import { EVENT_MAP } from '../../src/data/events/index.js';
import { addItems } from '../../src/systems/inventory.js';
import { claimMail } from '../../src/systems/mail.js';

const EV = EVENT_MAP['halloween-2026'];
const T = (iso) => Date.parse(iso);
const MID = T('2026-10-25T18:00:00Z');
const XMID = T('2026-11-04T18:00:00Z');
const AFTER = T('2026-12-01T18:00:00Z');
function joined() {
  const p = createProfile();
  for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5']) p.progress.stages[id] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
  return p;
}

describe('eventHomeButton', () => {
  it('with the event live it opens the event page; out of season, Happening Now', () => {
    const p = joined();
    expect(eventHomeButton(p, MID)).toMatchObject({ route: 'event', id: 'halloween-2026', phase: 'active' });
    expect(eventHomeButton(p, MID).msLeft).toBe(T('2026-11-02T01:00:00Z') - MID);
    expect(eventHomeButton(p, XMID)).toMatchObject({ route: 'event', id: 'halloween-2026', phase: 'exchange' });
    expect(eventHomeButton(p, AFTER)).toEqual({ route: 'rewards', id: null, phase: null, msLeft: null, dot: false });
  });

  it('a red dot for an unclaimed event gift in the Mailbox, and none once it and the missions are claimed', () => {
    const p = joined();
    expect(eventHomeButton(p, MID).dot).toBe(false);
    const { letters } = markEventLogin(p, MID);
    expect(letters.length).toBe(1);
    expect(eventHomeButton(p, MID).dot).toBe(true);
    // (the login also finishes the event's daily login mission: claimed too, nothing waits)
    claimAllEventMissions(p, EV.id, MID);
    expect(eventHomeButton(p, MID).dot).toBe(true);
    for (const l of letters) expect(claimMail(p, l.id, MID).ok).toBe(true);
    expect(eventHomeButton(p, MID).dot).toBe(false);
  });

  it('a red dot for a finished event mission, and in the exchange phase for an offer the player can buy', () => {
    const p = joined();
    const m = (EV.missions?.daily || [])[0] || (EV.missions?.total || [])[0];
    eventState(p, EV.id);
    trackEvent(p, EV.id, m.on, m.goal, { now: MID });
    expect(eventHomeButton(p, MID).dot).toBe(true);
    const q = joined();
    expect(eventHomeButton(q, XMID).dot).toBe(false);
    addItems(q, [{ id: EV.currency.id, count: 100000 }]);
    expect(eventHomeButton(q, XMID).dot).toBe(true);
  });

  it('shortLeft: days, hours, under an hour', () => {
    const src = readFileSync('src/ui/screens/lobby.js', 'utf8');
    const fn = new Function(`${src.match(/export function shortLeft[\s\S]*?\n}\n/)[0].replace('export ', '')}; return shortLeft;`)();
    expect(fn(4 * 86400e3 + 5)).toBe('4d');
    expect(fn(7 * 3600e3 + 1)).toBe('7h');
    expect(fn(59 * 60e3)).toBe('<1h');
    expect(fn(null)).toBe(null);
  });
});

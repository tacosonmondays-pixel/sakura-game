// UI M5c: Happening Now's model (src/ui/happening.js) on real saves and the real Halloween dates: the rows of In
// Progress sorted by the nearest deadline, an ended event leaves In Progress, the off-season state (E9) when nothing
// limited runs, Coming Up, the locks, the clan boss row only with the social hub, Suzu's state.
import { describe, it, expect } from 'vitest';
import { createProfile } from '../../src/systems/save.js';
import { happeningModel, happeningHostState, offSeasonText, HAPPENING_SECTIONS } from '../../src/ui/happening.js';
import { linesFor } from '../../src/ui/hostLines.js';
import { veteran } from '../fixtures/veterans.js';

const DAY = 24 * 3600e3;
// Halloween runs until Nov 15, 7 PM Central, its exchange until Nov 22 (extended two weeks, owner Oct 30). In its last
// week its end is the nearest deadline (the same instant as the Sunday weekly reset, and listed first).
const LIVE = Date.UTC(2026, 10, 10, 17); // Tue Nov 10, 11 AM Central: Halloween runs, its last week
const LAST_DAY = Date.UTC(2026, 10, 15, 18); // Sun Nov 15, noon Central: its last day
const EXCHANGE = Date.UTC(2026, 10, 18, 17); // Wed Nov 18: the exchange days
const AFTER = Date.UTC(2026, 11, 4, 18); // Fri Dec 4: everything closed

const ids = (rows) => rows.map((r) => r.id);

describe('Happening Now', () => {
  it('three sections in the rail: In Progress · Coming Up · Free pulls', () => {
    expect(HAPPENING_SECTIONS).toEqual(['now', 'soon', 'free']);
  });

  it('a running limited event is the first row, its end a deadline; the weekly rows follow by their deadline', () => {
    const m = happeningModel(veteran('late'), { now: LIVE, eventNow: LIVE });
    expect(m.now[0].kind).toBe('event');
    expect(m.now[0].id).toBe('halloween-2026');
    expect(m.now[0].urgent).toBe(true);
    expect(m.now[0].go).toEqual({ name: 'event', params: { id: 'halloween-2026' } });
    expect(ids(m.now)).toEqual(expect.arrayContaining(['week', 'titans', 'assault']));
    // sorted: deadlines nearest first, then rows without one (Total Assault)
    const left = m.now.filter((r) => r.msLeft != null && !r.locked).map((r) => r.msLeft);
    expect(left).toEqual([...left].sort((a, b) => a - b));
    expect(m.now.at(-1).id).toBe('assault');
    expect(m.offSeason).toBe(null);
    // recurring cycles never turn red
    for (const r of m.now.filter((x) => x.kind !== 'event' && x.kind !== 'exchange')) expect(r.urgent, r.id).toBe(false);
    // "In Progress" is said once, by the section (P7): no row carries a sticker flag
    for (const r of [...m.now, ...m.soon]) expect(r, r.id).not.toHaveProperty('inProgress');
  });

  it('its last day: "ends soon" for Suzu, and the chip is under 24 h', () => {
    const m = happeningModel(veteran('late'), { now: LAST_DAY, eventNow: LAST_DAY });
    const ev = m.now.find((r) => r.id === 'halloween-2026');
    expect(ev.msLeft).toBeLessThan(DAY);
    expect(m.endingSoon).toBe('Pumpkin Lantern Night');
    // (the name is too long for her list bubble: the general line shows)
    expect(linesFor('happening', happeningHostState(m))[0]).toBe('An event ends soon!');
  });

  it('the exchange days: the row turns to the exchange (Go opens it); still a limited row, no off-season band', () => {
    const m = happeningModel(veteran('late'), { now: EXCHANGE, eventNow: EXCHANGE });
    const ex = m.now.find((r) => r.id === 'halloween-2026');
    expect(ex.kind).toBe('exchange');
    expect(ex.go).toEqual({ name: 'event', params: { id: 'halloween-2026', tab: 'exchange' } });
    expect(m.offSeason).toBe(null);
  });

  it('an ended event leaves In Progress; with nothing limited running, the off-season band (E9) shows', () => {
    const m = happeningModel(veteran('late'), { now: AFTER, eventNow: AFTER });
    expect(ids(m.now)).not.toContain('halloween-2026');
    expect(ids(m.soon)).not.toContain('halloween-2026');
    expect(m.offSeason).toEqual({ next: null, past: { id: 'halloween-2026', name: 'Pumpkin Lantern Night' } });
    const t = offSeasonText(m.offSeason);
    expect(t.text).toMatch(/^No festival right now\./);
    expect(t.date).toBe(null);
    // the weekly rows still run under the band
    expect(ids(m.now)).toEqual(expect.arrayContaining(['week', 'titans', 'assault']));
    expect(m.running).toBeGreaterThan(0);
  });

  it('a teased event is Coming Up with its opening, and the band names it with its date', () => {
    const tease = Date.UTC(2026, 9, 19, 12); // Halloween opens Oct 19 7 PM Central (its tease started 3 days earlier)
    const m = happeningModel(veteran('late'), { now: tease, eventNow: tease });
    const up = m.soon.find((r) => r.id === 'halloween-2026');
    expect(up.label).toBe('Opens in');
    expect(up.urgent).toBe(false);
    expect(m.offSeason.next.name).toBe('Pumpkin Lantern Night');
    expect(offSeasonText(m.offSeason).date).toMatch(/^Opens [A-Z][a-z]{2} \d{1,2}$/);
  });

  it('Coming Up: the next two weeks of double drops, a week apart', () => {
    const m = happeningModel(createProfile(), { now: LIVE, eventNow: LIVE });
    const weeks = m.soon.filter((r) => r.kind === 'week');
    expect(weeks).toHaveLength(2);
    expect(weeks[1].msLeft - weeks[0].msLeft).toBe(7 * DAY);
    expect(weeks.every((r) => r.go === null)).toBe(true);
  });

  it('a new player: the modes she cannot play yet are rows with a lock and why, at the end, never a Go', () => {
    const m = happeningModel(createProfile(), { now: LIVE, eventNow: LIVE });
    const locked = m.now.filter((r) => r.locked);
    expect(ids(locked)).toEqual(expect.arrayContaining(['week', 'titans', 'assault']));
    expect(locked.every((r) => r.go === null)).toBe(true);
    const firstLocked = m.now.findIndex((r) => r.locked);
    expect(m.now.slice(firstLocked).every((r) => r.locked)).toBe(true);
    // Halloween asks to clear its unlock stage first, its Go still opens the page (it says how to join)
    const ev = m.now.find((r) => r.id === 'halloween-2026');
    expect(ev.line).toMatch(/^Clear .+ to join$/);
  });

  it('the clan boss week shows only when the social hub is ready', () => {
    const p = veteran('late');
    expect(ids(happeningModel(p, { now: LIVE, eventNow: LIVE }).now)).not.toContain('clanboss');
    const m = happeningModel(p, { now: LIVE, eventNow: LIVE, social: true });
    const cb = m.now.find((r) => r.id === 'clanboss');
    expect(cb.go).toEqual({ name: 'clan', params: { tab: 'boss' } });
    expect(cb.urgent).toBe(false);
  });

  it('Suzu counts what is on (the open rows)', () => {
    const m = happeningModel(veteran('late'), { now: LIVE, eventNow: LIVE });
    const s = happeningHostState(m);
    expect(s.running).toBe(m.now.filter((r) => !r.locked).length);
    expect(linesFor('happening', s)[0]).toBe(`${s.running} things on right now!`);
  });
});

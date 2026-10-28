// [ui-ink] UI v2 V2: the home's news card (src/ui/lobbyTray.js homeNews; notes/ui-v2/UI_V2_DIRECTION.md 12.1): up to
// three pages, paged by hand only: the event (a running limited event, or this week's double drops), the recruit
// banner, the weekly bosses (Titan Trials, or Total Assault before Titan Trials opens). The event pages keep their old
// hooks (event-card / event-strip and their countdown chips).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { homeNews, NEWS_MAX } from '../../src/ui/lobbyTray.js';

const DAY = 86400e3;
const FULL = {
  limited: { id: 'halloween-2026', name: 'Pumpkin Lantern Night', phase: 'active', msLeft: 10 * DAY, art: 'evt_halloween_candy' },
  weekly: { name: 'Bloom Week', arena: 'res-mats-a', dropMul: 2, msLeft: 3 * DAY },
  recruit: { pity: 88 },
  bosses: { titans: { open: true, name: 'Gourdlight' }, assault: { open: true }, msLeft: 3 * DAY },
};

describe('the home news card', () => {
  it('at most three pages, in order: the event, the recruit banner, the weekly bosses', () => {
    expect(NEWS_MAX).toBe(3);
    const pages = homeNews(FULL);
    expect(pages.map((p) => p.id)).toEqual(['event', 'recruit', 'bosses']);
    expect(pages.length).toBeLessThanOrEqual(NEWS_MAX);
  });

  it('a limited event takes the first page with its own hook and countdown hook; the week\'s double drops wait', () => {
    const [e] = homeNews(FULL);
    expect(e).toMatchObject({ kicker: 'Event', title: 'Pumpkin Lantern Night', testid: 'event-card', timeTestid: 'event-card-time', phase: 'active', art: 'evt_halloween_candy' });
    expect(homeNews(FULL).some((p) => p.id === 'weekly')).toBe(false);
  });

  it('without a limited event, this week\'s double drops (the old event strip\'s hooks)', () => {
    const [w] = homeNews({ ...FULL, limited: null });
    expect(w).toMatchObject({ id: 'weekly', kicker: 'Event · 2× drops', title: 'Bloom Week', testid: 'event-strip', timeTestid: 'event-strip-time' });
    expect(w.msLeft).toBe(3 * DAY);
  });

  it('the recruit banner says how far the SSR guarantee is', () => {
    expect(homeNews(FULL)[1]).toMatchObject({ kicker: 'Recruit', title: 'Enrollment · SSR in 88', testid: 'banner-recruit', msLeft: null });
    expect(homeNews({ recruit: { pity: 0 } })[0].title).toBe('Enrollment');
  });

  it('the weekly bosses: Titan Trials once open (the titan of the week), else Total Assault, else no page', () => {
    expect(homeNews(FULL)[2]).toMatchObject({ title: 'Titan Trials · Gourdlight', testid: 'banner-titans' });
    expect(homeNews({ ...FULL, bosses: { titans: { open: false }, assault: { open: true }, msLeft: DAY } })[2]).toMatchObject({ title: 'Total Assault', testid: 'banner-assault' });
    expect(homeNews({ ...FULL, bosses: { titans: { open: false }, assault: { open: false } } }).map((p) => p.id)).toEqual(['event', 'recruit']);
  });

  it('a long kicker has a short form for a phone\'s chip, where the long one would wrap beside its countdown', () => {
    expect(homeNews(FULL)[2]).toMatchObject({ kicker: 'Weekly bosses', short: 'Bosses' });
    expect(homeNews({ ...FULL, bosses: { titans: { open: false }, assault: { open: true }, msLeft: DAY } })[2]).toMatchObject({ kicker: 'Weekly boss', short: 'Boss' });
    expect(homeNews({ ...FULL, limited: null })[0]).toMatchObject({ kicker: 'Event · 2× drops', short: '2× drops' });
    for (const p of homeNews(FULL)) if (p.short) expect(p.short.length).toBeLessThan(p.kicker.length);
    const src = readFileSync('src/ui/screens/lobby.js', 'utf8');
    expect(src).toContain("card.classList.add('kshort')");
  });

  it('nothing to show: no pages (the card is not drawn)', () => {
    expect(homeNews({})).toEqual([]);
  });

  it('every title fits the card\'s two lines (the card grows to two lines; 28 characters a line)', () => {
    for (const p of homeNews(FULL)) expect(p.title.length, p.title).toBeLessThanOrEqual(56);
  });

  it('the home pages by hand only: no timer turns the pages (rule 11)', () => {
    const src = readFileSync('src/ui/screens/lobby.js', 'utf8');
    expect(src).not.toMatch(/setInterval/);
    expect(src).toContain("'lobby-news-next'");
  });
});

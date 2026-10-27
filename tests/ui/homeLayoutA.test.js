// [ui-ink] Home layout A (src/ui/screens/lobby.js, src/ui/styles/home.css): the news chip's pages (no recruit page: RECRUIT
// is a tile of its own; the notice board's latest patch while there is room), the Recruit tile's girl (a pick-up who is
// never the secretary), the dock's hooks, the home's one yellow (BATTLE's play edge) and its living scene's left scrim
// (the same ramp as the CSS corner wash, so her face is never graded).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { homeNewsPages, recruitPickup, HOME_A_SCRIM_L } from '../../src/ui/screens/lobby.js';
import { RECRUIT_FEATURED } from '../../src/ui/lobby/notice.js';
import { homeTarget } from '../../src/ui/lobby/hostPlace.js';
import { NEWS_MAX } from '../../src/ui/lobbyTray.js';

const DAY = 86400e3;
const FULL = {
  limited: { id: 'halloween-2026', name: 'Pumpkin Lantern Night', phase: 'active', msLeft: 10 * DAY, art: 'evt_halloween_candy' },
  weekly: { name: 'Bloom Week', arena: 'res-mats-a', dropMul: 2, msLeft: 3 * DAY },
  recruit: { pity: 88 },
  bosses: { titans: { open: true, name: 'Gloom Regent' }, assault: { open: true }, msLeft: 3 * DAY },
};
const LATEST = { title: 'Hubs and Hosts' };

describe('home layout A: the news chip', () => {
  it('the event, the weekly bosses, then the notice board\'s latest patch; never the recruit page', () => {
    const pages = homeNewsPages(FULL, LATEST);
    expect(pages.map((p) => p.id)).toEqual(['event', 'bosses', 'notice']);
    expect(pages.length).toBeLessThanOrEqual(NEWS_MAX);
    expect(pages[2]).toMatchObject({ kicker: 'Notice', title: 'Hubs and Hosts', testid: 'news-notice', msLeft: null });
  });
  it('the notice fills in when the bosses are not open yet; nothing when there is no patch', () => {
    const early = { ...FULL, bosses: { titans: { open: false }, assault: { open: false } } };
    expect(homeNewsPages(early, LATEST).map((p) => p.id)).toEqual(['event', 'notice']);
    expect(homeNewsPages(early, null).map((p) => p.id)).toEqual(['event']);
  });
  it('the event keeps its hooks (event-card and its countdown)', () => {
    expect(homeNewsPages(FULL, LATEST)[0]).toMatchObject({ testid: 'event-card', timeTestid: 'event-card-time' });
  });
});

describe('home layout A: the Recruit tile', () => {
  it('shows the first pick-up girl, never the secretary', () => {
    expect(recruitPickup('ruri')).toBe(RECRUIT_FEATURED[0]);
    expect(recruitPickup(RECRUIT_FEATURED[0])).toBe(RECRUIT_FEATURED[1]);
    for (const id of RECRUIT_FEATURED) expect(recruitPickup(id)).not.toBe(id);
  });
});

describe('home layout A: hooks, colour and her place', () => {
  const src = readFileSync('src/ui/screens/lobby.js', 'utf8');
  const css = readFileSync('src/ui/styles/home.css', 'utf8');
  it('the dock keeps its hooks and adds Formation; the tickets lose their "+" (no test used it)', () => {
    for (const id of ['dock-students', 'dock-formation', 'dock-commissions', 'dock-clan', 'dock-mall', 'dock-recruit', 'recruit-free', 'tile-mission', 'campaign-open', 'lobby-chapter']) {
      expect(src, id).toContain(`'${id}'`);
    }
    expect(src).not.toMatch(/plusLabel: 'Get tickets'/);
  });
  it('one yellow: BATTLE\'s play edge; the objective\'s play square is cyan', () => {
    expect(css).toMatch(/\.home-a \.bt-play \{[^}]*background: var\(--yellow\)/);
    expect(src).toContain("h('span.ui-play.cy'");
    expect((css.match(/var\(--yellow\)/g) || []).length).toBe(1);
  });
  it('her face at 0.42 of the width on a phone, 0.40 on desktop, her eye line at 0.29', () => {
    expect(homeTarget(844, 390)).toMatchObject({ x: 844 * 0.42, y: 390 * 0.29 });
    expect(homeTarget(1280, 720)).toMatchObject({ x: 512, y: 720 * 0.29 });
  });
  it('her living scene draws the same left scrim as the CSS corner wash (none from 28 %: her face is never graded)', () => {
    const [a0, t1, a1, t2] = HOME_A_SCRIM_L;
    expect(css).toContain(`rgba(14, 25, 48, ${a0}) 0, rgba(14, 25, 48, ${a1}) ${Math.round(t1 * 100)}%, rgba(14, 25, 48, 0) ${Math.round(t2 * 100)}%`);
    expect(t2).toBeLessThan(0.4 - 0.08);
    expect(readFileSync('src/ui/lobby/live/engine.js', 'utf8')).toMatch(/ramp\(vP\.x \/ uSize\.x, uL\.x, uL\.y, uL\.z, uL\.w\)/);
  });
});

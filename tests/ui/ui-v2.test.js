// UI V2 pure helpers: account level, rotate-prompt decision, lobby backdrop, glyphs.
import { describe, it, expect } from 'vitest';
import { accountLevel, accountXpForLevel, ACCOUNT_MAX_LEVEL, glyph } from '../../src/ui/components.js';
import { shouldPrompt, isLandscapeSize, LANDSCAPE_ONLY_ROUTES } from '../../src/ui/orientation.js';
import { lobbyBackdropSVG, themeBackdropSVG } from '../../src/art/backdrops.js';
import { createProfile } from '../../src/systems/save.js';
import { UI_ICON_NAMES } from '../../src/art/icons.js';

describe('accountLevel', () => {
  it('starts low for a fresh profile and grows with progress', () => {
    const p = createProfile();
    const a0 = accountLevel(p);
    expect(a0.level).toBeGreaterThanOrEqual(1);
    expect(a0.need).toBe(accountXpForLevel(a0.level));
    expect(a0.pct).toBeGreaterThanOrEqual(0);
    expect(a0.pct).toBeLessThan(1);
    p.progress.stages['1-1'] = { easy: true, normal: true, hard: true, nightmare: true, clears: 20 };
    p.stats.wins = 50;
    p.stats.pulls = 30;
    const a1 = accountLevel(p);
    expect(a1.xp).toBeGreaterThan(a0.xp);
    expect(a1.level).toBeGreaterThan(a0.level);
  });
  it('is deterministic and capped', () => {
    const p = createProfile();
    p.stats.wins = 1e6;
    const a = accountLevel(p);
    expect(a.level).toBe(ACCOUNT_MAX_LEVEL);
    expect(a.need).toBe(0);
    expect(a.pct).toBe(1);
    expect(accountLevel(p)).toEqual(a);
  });
  it('tolerates partial profiles', () => {
    expect(accountLevel({}).level).toBe(1);
    expect(accountLevel(null).level).toBe(1);
  });
});

describe('rotate prompt decision', () => {
  it('only prompts touch devices in portrait', () => {
    expect(isLandscapeSize(844, 390)).toBe(true);
    expect(isLandscapeSize(390, 844)).toBe(false);
    expect(shouldPrompt({ touch: false, width: 390, height: 844, route: 'lobby', dismissed: false }).show).toBe(false);
    expect(shouldPrompt({ touch: true, width: 844, height: 390, route: 'lobby', dismissed: false }).show).toBe(false);
    expect(shouldPrompt({ touch: true, width: 390, height: 844, route: 'lobby', dismissed: false })).toEqual({ show: true, dismissable: true });
  });
  it('respects dismissal outside battle but never in battle', () => {
    expect(shouldPrompt({ touch: true, width: 390, height: 844, route: 'lobby', dismissed: true }).show).toBe(false);
    for (const route of LANDSCAPE_ONLY_ROUTES) {
      expect(shouldPrompt({ touch: true, width: 390, height: 844, route, dismissed: true })).toEqual({ show: true, dismissable: false });
    }
  });
});

describe('backdrops', () => {
  it('lobby backdrop is a deterministic, well-formed SVG', () => {
    const a = lobbyBackdropSVG();
    expect(a.startsWith('<svg')).toBe(true);
    expect(a).toContain('viewBox="0 0 1600 900"');
    expect(a).not.toMatch(/NaN|undefined/);
    expect(lobbyBackdropSVG()).toBe(a);
    expect(a.length).toBeLessThan(60000);
  });
  it('theme banners still render for every theme', () => {
    for (const t of ['sakura', 'lake', 'shrine', 'mountain', 'marsh', 'foundry', 'festival', 'volcano', 'snow', 'night', 'arena']) {
      expect(themeBackdropSVG(t)).toContain('<svg');
    }
  });
});

describe('glyph', () => {
  it('returns inline SVG for ui icons and the extra UI-only glyphs', () => {
    for (const name of [...UI_ICON_NAMES, 'mail', 'menu', 'notice', 'tasks', 'fullscreen', 'exitFullscreen', 'rotate', 'story', 'chevron', 'account']) {
      const svg = glyph(name);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('currentColor');
    }
    expect(glyph('does-not-exist')).toContain('<svg');
  });
});

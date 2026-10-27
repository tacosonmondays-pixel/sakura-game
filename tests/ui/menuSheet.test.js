// [ui-ink] UI v2: the home's main menu side sheet (src/ui/lobby/menuSheet.js; notes/ui-v2/UI_V2_DIRECTION.md 12.2).
// SQUAD: Formation, Backpack, Bestiary, Profile; ACADEMY: Story, Journal, Notice, Wiki; SOCIAL: Clan (home layout C
// keeps it off the home; its old hook dock-clan comes with it); Settings the gear in the head. Line glyphs only, no
// numbers, no yellow. The hooks the e2e use stay; the Notice row keeps the old tray's hook. Every glyph it names is a
// line glyph, and every route it opens is a route of the game.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MENU_GROUPS, MENU_FOOT } from '../../src/ui/lobby/menuSheet.js';
import { hasLineGlyph } from '../../src/ui/lineGlyphs.js';

describe('the menu sheet', () => {
  it('two groups of four rows and Social with Clan, in the mock-up\'s order; Settings in the head', () => {
    expect(MENU_GROUPS.map((g) => [g.label, g.rows.map((r) => r.label)])).toEqual([
      ['Squad', ['Formation', 'Backpack', 'Bestiary', 'Profile']],
      ['Academy', ['Story', 'Journal', 'Notice', 'Wiki']],
      ['Social', ['Clan']],
    ]);
    expect(MENU_FOOT.label).toBe('Settings');
  });

  it('keeps the hooks: menu-formation, menu-backpack, menu-bestiary, menu-profile, menu-story, menu-journal, menu-wiki, dock-clan, settings; Notice is shortcut-notice', () => {
    const ids = [...MENU_GROUPS.flatMap((g) => g.rows.map((r) => r.testid)), MENU_FOOT.testid];
    expect(ids).toEqual(['menu-formation', 'menu-backpack', 'menu-bestiary', 'menu-profile', 'menu-story', 'menu-journal', 'shortcut-notice', 'menu-wiki', 'dock-clan', 'settings']);
  });

  it('line glyphs only, each one drawn; every route a route of the game (Notice opens its board)', () => {
    const main = readFileSync('src/main.js', 'utf8');
    for (const r of [...MENU_GROUPS.flatMap((g) => g.rows), MENU_FOOT]) {
      expect(hasLineGlyph(r.glyph), r.glyph).toBe(true);
      if (r.route) expect(main, r.route).toContain(`registerRoute('${r.route}'`);
      else expect(r.id).toBe('notice');
    }
  });

  it('no numbers and no yellow in the sheet; it closes on its X, Esc, a tap outside and a route change', () => {
    const src = readFileSync('src/ui/lobby/menuSheet.js', 'utf8');
    for (const r of MENU_GROUPS.flatMap((g) => g.rows)) expect(r.label).not.toMatch(/\d/);
    expect(src).not.toMatch(/var\(--yellow\)|ui-btn\.pri|btn-yellow/);
    expect(src).toContain("'menu-sheet-close'");
    expect(src).toContain('onEscape(close)');
    expect(src).toContain("'menu-sheet-scrim', onclick: () => close()");
    expect(src).toContain("addEventListener('hashchange', close)");
  });
});

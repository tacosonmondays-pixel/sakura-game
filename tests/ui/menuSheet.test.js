// [ui-ink] UI v2 V2: the home's main menu side sheet (src/ui/lobby/menuSheet.js; notes/ui-v2/UI_V2_DIRECTION.md 12.2;
// home layout B). SQUAD: Formation, Backpack, Bestiary, Profile; ACADEMY: Story, Journal, Notice, Wiki; SOCIAL: Clan;
// Settings on the footer; the home's tools (hide the UI, the background) in its head. Line glyphs only, no numbers, no
// yellow. The hooks the e2e use stay; the Notice row keeps the old tray's hook, Clan the old dock's. Every glyph it names
// is a line glyph, and every route it opens is a route of the game.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MENU_GROUPS, MENU_FOOT } from '../../src/ui/lobby/menuSheet.js';
import { hasLineGlyph } from '../../src/ui/lineGlyphs.js';

describe('the menu sheet', () => {
  it('two groups of four rows, SOCIAL with Clan, and the Settings footer', () => {
    expect(MENU_GROUPS.map((g) => [g.label, g.rows.map((r) => r.label)])).toEqual([
      ['Squad', ['Formation', 'Backpack', 'Bestiary', 'Profile']],
      ['Academy', ['Story', 'Journal', 'Notice', 'Wiki']],
      ['Social', ['Clan']],
    ]);
    expect(MENU_FOOT.label).toBe('Settings');
  });

  it('keeps the hooks: menu-formation, menu-backpack, menu-bestiary, menu-profile, menu-story, menu-journal, menu-wiki, settings; Notice is shortcut-notice, Clan dock-clan', () => {
    const ids = [...MENU_GROUPS.flatMap((g) => g.rows.map((r) => r.testid)), MENU_FOOT.testid];
    expect(ids).toEqual(['menu-formation', 'menu-backpack', 'menu-bestiary', 'menu-profile', 'menu-story', 'menu-journal', 'shortcut-notice', 'menu-wiki', 'dock-clan', 'settings']);
  });

  it('its head carries the home\'s tools (hide the UI, the background), each closing the sheet first', () => {
    const src = readFileSync('src/ui/lobby/menuSheet.js', 'utf8');
    expect(src).toContain('onclick: () => { close(); t.go(); }');
    const home = readFileSync('src/ui/screens/lobby.js', 'utf8');
    expect(home).toContain("testid: 'lobby-hide'");
    expect(home).toContain("testid: 'lobby-bg'");
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
    expect(src).toContain("'menu-sheet-close', onclick: () => dismiss()");
    expect(src).toContain('onEscape(dismiss)');
    expect(src).toContain("'menu-sheet-scrim', onclick: () => dismiss()");
    expect(src).toContain("addEventListener('hashchange', close)");
  });

  it('a modal dialog for the keys too: rows are buttons (Enter and Space), the page behind is inert, Tab wraps, and a dismissal gives the focus back to its opener', () => {
    const src = readFileSync('src/ui/lobby/menuSheet.js', 'utf8');
    expect(src).not.toMatch(/h\('a\.ui-hrow|role: 'button'/);
    expect(src).toContain("h('button.ui-hrow', {");
    expect(src).toContain("h('button.ui-hrow.foot', {");
    expect(src).toContain('n.inert = true;');
    expect(src).toContain('for (const n of behind) n.inert = false;');
    expect(src).toContain("e.key !== 'Tab'");
    expect(src).toMatch(/if \(how === 'dismiss'\) \{\s*const back = opener\?\.\(\);/);
    const home = readFileSync('src/ui/screens/lobby.js', 'utf8');
    expect(home).toContain("opener: () => top.querySelector('[data-testid=\"top-menu\"]')");
  });

  it('never uses the scene player\'s root class (.sp is story.css\'s fixed full-screen layer): the spacer is .ui-spacer', () => {
    for (const f of ['src/ui/lobby/menuSheet.js', 'src/ui/screens/lobby.js']) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/h\('[a-z]*\.sp['.]/);
      expect(src, f).not.toMatch(/classList\.contains\('sp'\)/);
    }
    expect(readFileSync('src/ui/lobby/menuSheet.js', 'utf8')).toContain("h('span.ui-spacer')");
    for (const f of ['src/ui/styles/ink.css', 'src/ui/styles/home.css']) expect(readFileSync(f, 'utf8'), f).not.toMatch(/\.sp\s*[{,]|\.sp\s+\{/);
  });
});

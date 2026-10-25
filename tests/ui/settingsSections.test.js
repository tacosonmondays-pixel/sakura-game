// UI M5c: the Settings rail's map (src/ui/settingsSections.js, notes Q8): every panel settings.js builds lands in
// exactly one of the five sections; a panel another branch adds stays where its builder put it; deep links land.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SETTINGS_SECTIONS, SECTION_IDS, KNOWN_PANELS, panelKey, sectionOfKey, assignSections, sectionForParam } from '../../src/ui/settingsSections.js';

/** The panels settings.js (and settingsOnline.js) build today, in page order, read from the source. */
function panelsInSource() {
  const src = readFileSync(new URL('../../src/ui/screens/settings.js', import.meta.url), 'utf8');
  const online = readFileSync(new URL('../../src/ui/online/settingsOnline.js', import.meta.url), 'utf8');
  const keys = [];
  // a panel with a data-section (display, graphics, save, about), or a titled one (Lighting, Audio, Battle)
  for (const m of src.matchAll(/h\('section\.panel',\s*(?:\{\s*'data-section':\s*'(\w+)'\s*\},\s*)?\s*h\('h3\.panel-title',\s*'([^']+)'\)/g)) keys.push(panelKey({ section: m[1] || null, title: m[2] }));
  for (const m of online.matchAll(/h\('section\.panel',\s*\{\s*'data-section':\s*'(\w+)'\s*\}/g)) keys.push(panelKey({ section: m[1] }));
  return keys;
}

describe('the Settings sections', () => {
  it('five sections in the rail: Display · Audio · Battle · Account · About', () => {
    expect(SECTION_IDS).toEqual(['display', 'audio', 'battle', 'account', 'about']);
    expect(SETTINGS_SECTIONS.map((s) => s.label)).toEqual(['Display', 'Audio', 'Battle', 'Account', 'About']);
  });

  it('every panel of today\'s Settings lands in exactly one section', () => {
    const keys = panelsInSource();
    expect([...keys].sort()).toEqual(['about', 'audio', 'battle', 'display', 'graphics', 'lighting', 'online', 'save']);
    for (const k of keys) {
      const owners = SETTINGS_SECTIONS.filter((s) => s.panels.includes(k)).map((s) => s.id);
      expect(owners, k).toHaveLength(1);
    }
    expect([...KNOWN_PANELS].sort()).toEqual([...keys].sort());
  });

  it('Display holds Display + Graphics + Lighting; Account holds Online + Save data', () => {
    expect(['display', 'graphics', 'lighting'].map(sectionOfKey)).toEqual(['display', 'display', 'display']);
    expect(['online', 'save'].map(sectionOfKey)).toEqual(['account', 'account']);
    expect(sectionOfKey('audio')).toBe('audio');
    expect(sectionOfKey('battle')).toBe('battle');
    expect(sectionOfKey('about')).toBe('about');
  });

  it('a panel key: the data-section, else the title in lower case', () => {
    expect(panelKey({ section: 'graphics', title: 'Graphics' })).toBe('graphics');
    expect(panelKey({ title: 'Lighting' })).toBe('lighting');
    expect(panelKey({ title: ' Audio ' })).toBe('audio');
    expect(panelKey({ title: 'Ultra Graphics' })).toBe('ultra-graphics');
  });

  it('a panel the map does not know joins the section before it (another branch\'s new panel merges in place)', () => {
    expect(assignSections(['display', 'graphics', 'ultra-graphics', 'lighting', 'audio', 'battle', 'accessibility', 'online', 'save', 'about']))
      .toEqual(['display', 'display', 'display', 'display', 'audio', 'battle', 'battle', 'account', 'account', 'about']);
    expect(assignSections(['brand-new', 'display'])).toEqual(['display', 'display']);
  });

  it('a deep link (?section=…) opens its section: a rail id or a panel key', () => {
    expect(sectionForParam('audio')).toBe('audio');
    expect(sectionForParam('graphics')).toBe('display');
    expect(sectionForParam('online')).toBe('account');
    expect(sectionForParam('save')).toBe('account');
    expect(sectionForParam('nowhere')).toBe('display');
    expect(sectionForParam(undefined)).toBe('display');
  });
});

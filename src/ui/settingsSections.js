// UI M5c: the Settings rail (docs/specs/UI_DIRECTION.md §5.10 E3; notes/ui-m5/PLAN.md §5 M5c, Q8): five sections over
// the panels src/ui/screens/settings.js builds. Pure: the screen wraps its panels by this map and never edits them, so
// a branch that adds a row (or a whole panel) to settings.js still merges cleanly (PLAN §4: four other writers).
// tests/ui/settingsSections.test.js checks that every panel lands in exactly one section.
//
//   Display (Display + Graphics + Lighting) · Audio · Battle · Account (Online + Save data) · About

/** The rail, in order: id (tab-<id>), word, icon (a glyphs.js name, or 'account' from components.js glyph()). */
export const SETTINGS_SECTIONS = Object.freeze([
  { id: 'display', label: 'Display', icon: 'eye', panels: ['display', 'graphics', 'lighting'] },
  { id: 'audio', label: 'Audio', icon: 'play', panels: ['audio'] },
  { id: 'battle', label: 'Battle', icon: 'sword', panels: ['battle'] },
  { id: 'account', label: 'Account', icon: 'account', panels: ['online', 'save'] },
  { id: 'about', label: 'About', icon: 'info', panels: ['about'] },
]);

export const SECTION_IDS = Object.freeze(SETTINGS_SECTIONS.map((s) => s.id));

/** Every panel key the map knows (settings.js today). */
export const KNOWN_PANELS = Object.freeze(SETTINGS_SECTIONS.flatMap((s) => s.panels));

/**
 * A panel's key: its data-section ('display', 'graphics', 'online', 'save', 'about'), else its title in lower case
 * ('Lighting' → 'lighting', 'Audio' → 'audio'), so the map never needs settings.js to change.
 * @param {{ section?: string|null, title?: string|null }} p
 */
export function panelKey({ section = null, title = null } = {}) {
  if (section) return String(section).trim().toLowerCase();
  return String(title || '').trim().toLowerCase().replace(/\s+/g, '-');
}

/** The rail section of a known panel key, or null. */
export function sectionOfKey(key) {
  return SETTINGS_SECTIONS.find((s) => s.panels.includes(key))?.id || null;
}

/**
 * Every panel's section, in page order. A panel the map does not know (a new one from another branch) joins the
 * section of the panel before it, so it stays where its builder put it (the first panel falls back to Display).
 * @param {string[]} keys panel keys in the order settings.js builds them
 * @returns {string[]} a section id per key
 */
export function assignSections(keys) {
  let last = SECTION_IDS[0];
  return keys.map((k) => {
    const s = sectionOfKey(k);
    if (s) last = s;
    return s || last;
  });
}

/**
 * The section a `?section=` deep link opens: a rail id ('audio') or a panel key ('graphics' → Display, 'online' →
 * Account); anything else: Display.
 */
export function sectionForParam(param) {
  const p = String(param || '').trim().toLowerCase();
  if (SECTION_IDS.includes(p)) return p;
  return sectionOfKey(p) || SECTION_IDS[0];
}

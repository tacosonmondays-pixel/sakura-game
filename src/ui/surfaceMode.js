// [ui-ink] The surface mode of a screen (notes/ui-v2/UI_V2_DIRECTION.md rule 1 and section 8; the build plan's scope
// fence): "night is where you play, day is where you manage". The router puts the mode on <body> as ui-night or
// ui-day, and the UI v2 rules (src/ui/styles/ink.css) live under those two classes only.
//
// - night: the home (the lobby). The battle, results and the recruit reveal are night too in the direction, but:
// - none: the battle (A3 M4 / M5 on feature/abilities own its look; it keeps exactly today's look until they opt in),
//   the title screen and the story scene player. They get no class, so no UI v2 rule reaches them.
// - day: every other screen (menus, lists, hubs, the girl page, stage prep, the backpack).
// Pure: no DOM here (applySurfaceMode in the router puts it on the body).

/** Screens with no surface mode: nothing of UI v2 reaches them. */
export const NO_MODE = Object.freeze(['battle', 'title', 'scene']);
/** Night screens (the rest are day). */
export const NIGHT = Object.freeze(['lobby']);
/** The body classes, by mode. */
export const MODE_CLASS = Object.freeze({ day: 'ui-day', night: 'ui-night' });

/**
 * @param {string|null|undefined} screen a route name (src/main.js registerRoute)
 * @returns {'day'|'night'|null} null: no mode (the battle, the title, a story scene)
 */
export function surfaceMode(screen) {
  const s = String(screen || '');
  if (!s || NO_MODE.includes(s)) return null;
  return NIGHT.includes(s) ? 'night' : 'day';
}

/**
 * Puts a screen's mode on an element (the router's <body>): ui-day, ui-night or neither, and data-surface.
 * @param {{ classList: DOMTokenList, dataset?: DOMStringMap }|null|undefined} el
 * @param {string|null|undefined} screen
 * @returns {'day'|'night'|null}
 */
export function applySurfaceMode(el, screen) {
  const mode = surfaceMode(screen);
  if (!el?.classList) return mode;
  el.classList.toggle(MODE_CLASS.day, mode === 'day');
  el.classList.toggle(MODE_CLASS.night, mode === 'night');
  if (el.dataset) {
    if (mode) el.dataset.surface = mode;
    else delete el.dataset.surface;
  }
  return mode;
}

/** True while the document wears a surface mode (a menu or the home): line glyphs and the kit apply. */
export function inkSurface(doc = globalThis.document) {
  const b = doc?.body;
  return !!b && (b.classList.contains(MODE_CLASS.day) || b.classList.contains(MODE_CLASS.night));
}

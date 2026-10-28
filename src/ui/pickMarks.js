// [ui-ink] The selected marks (UI v2 medium 3, notes/ui-v2/OPEN_FINDINGS.md 3): a selected item or gear tile keeps its
// rarity frame and carries a pink check chip in its status corner and a 3 px pink bar along its bottom, never a pink
// ring (a Mythic frame is pink too, so a ring could not say "selected"). gearTile() and itemTile() append these; the
// looks are one rule in src/ui/styles/ink.css ("THE SELECTED TILE"), which also marks the Backpack's salvage cards.
import { h } from './dom.js';

const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg>';

/** The pink check chip and the 3 px bar, as two decorative children of a selected tile. */
export function pickMarks() {
  return [h('span.ui-pick', { 'aria-hidden': 'true', html: CHECK }), h('span.ui-pickbar', { 'aria-hidden': 'true' })];
}

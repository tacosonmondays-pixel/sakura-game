// Exchange art for event cosmetics (titles, frames): code-drawn SVG, no image files.
import { frameChipSVG } from '../../art/profileArt.js';

/** SVG for an event cosmetic offer card. */
export function cosmeticArt(c) {
  if (c.kind === 'frame') return frameChipSVG(c.id);
  // a title: a little gold plate with a star
  return '<svg viewBox="0 0 100 64" aria-hidden="true"><rect x="6" y="18" width="88" height="28" rx="8" fill="#ffe08a" stroke="#b07d00" stroke-width="3"/>'
    + '<rect x="12" y="24" width="76" height="16" rx="5" fill="#fff8dc"/><path d="M50 22l3 6.2 6.8 1-4.9 4.8 1.2 6.8-6.1-3.2-6.1 3.2 1.2-6.8-4.9-4.8 6.8-1z" fill="#f28c28"/>'
    + '<path d="M20 32h18M62 32h18" stroke="#b07d00" stroke-width="3" stroke-linecap="round"/></svg>';
}

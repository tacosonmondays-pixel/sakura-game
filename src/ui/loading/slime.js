// The loading slime: a small mint-jelly mochi from our own slime family (the Green Slime's
// colours, the slime face atlas's big rounded eyes and pink blush) with a sakura petal stuck on its
// head. Pure markup (inline SVG): it draws before any 3D asset or font arrives, and index.html
// carries the same markup for the boot loader (tests/ui/transitions.test.js keeps them equal).
//
// Every moving part is its own HTML layer holding a slice of the drawing (body, eyes, the two
// mouths, the petal, the light pool under it) and animates transform or opacity only, so the
// compositor keeps it hopping while the main thread is busy (a model parse, a shader compile).
// The keyframes live in index.html's inline <style> (they must exist before any script runs).

/** Sizes (px of height): the full loader on a phone / on a big screen, the corner chip, inside a panel. */
export const SLIME_SIZES = Object.freeze({ phone: 64, desktop: 80, chip: 34, inline: 40 });

/** Shared gradients + the eye symbol, once per page (rendered, not display:none, so they resolve). */
export const SLIME_DEFS = '<svg id="ldsl-defs" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>'
  + '<linearGradient id="ldsl-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ecfff3"/><stop offset="0.36" stop-color="#b2f3c9"/><stop offset="0.78" stop-color="#76da9c"/><stop offset="1" stop-color="#4cba78"/></linearGradient>'
  + '<radialGradient id="ldsl-core" cx="0.4" cy="0.36" r="0.55"><stop offset="0" stop-color="#fff" stop-opacity="0.6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
  + '<linearGradient id="ldsl-iris" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d152b"/><stop offset="0.55" stop-color="#1b2f52"/><stop offset="1" stop-color="#2f8a8a"/></linearGradient>'
  + '<linearGradient id="ldsl-petal" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff0f5"/><stop offset="0.55" stop-color="#ffaccb"/><stop offset="1" stop-color="#ff79a7"/></linearGradient>'
  + '<symbol id="ldsl-eye" viewBox="-10 -12 20 24" overflow="visible">'
  + '<ellipse rx="8.6" ry="10.6" fill="url(#ldsl-iris)" stroke="#121a31" stroke-width="1.6"/>'
  + '<path d="M-5.8 4.6C-3 8 3 8 5.8 4.6" stroke="#93f5d0" stroke-width="1.7" fill="none" stroke-linecap="round" opacity="0.8"/>'
  + '<path d="M-8.3 -3C-7.9 -9.6 -4.4 -11.2 0 -11.2C4.4 -11.2 7.9 -9.6 8.3 -3" stroke="#0f1730" stroke-width="2.8" fill="none" stroke-linecap="round"/>'
  + '<circle cx="-2.7" cy="-4.4" r="3.8" fill="#fff"/><circle cx="3.3" cy="3.3" r="1.8" fill="#fff"/>'
  + '</symbol></defs></svg>';

const BODY = 'M22 94C10 94 5 86 7 74C10 50 30 22 60 22C90 22 110 50 113 74C115 86 110 94 98 94Z';

/** The slime's layers (no outer wrapper). */
export const SLIME_INNER = '<div class="sl-shadow"></div>'
  + '<div class="sl-hop"><div class="sl-squash">'
  + `<div class="sl-layer sl-body"><svg viewBox="0 0 120 100"><path d="${BODY}" fill="url(#ldsl-g)" stroke="#2f9c62" stroke-width="2.6" stroke-linejoin="round"/><path d="${BODY}" fill="url(#ldsl-core)"/>`
  + '<path d="M13 85C30 91.5 90 91.5 107 85C108.5 90 104.5 94 98 94H22C15.5 94 11.5 90 13 85Z" fill="#2f9c62" opacity="0.3"/>'
  + '<path d="M24 61C25 47 35 35 49 29.5" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" opacity="0.88"/>'
  + '<circle cx="22.6" cy="70" r="2.8" fill="#fff" opacity="0.85"/>'
  + '<circle cx="90" cy="81" r="4.3" fill="#fff" fill-opacity="0.16" stroke="#fff" stroke-opacity="0.6" stroke-width="1.3"/>'
  + '<circle cx="99" cy="71" r="2.3" fill="#fff" fill-opacity="0.2" stroke="#fff" stroke-opacity="0.55" stroke-width="1"/>'
  + '<ellipse cx="30.5" cy="76" rx="7" ry="3.6" fill="#ff86ad" opacity="0.75"/><ellipse cx="89.5" cy="76" rx="7" ry="3.6" fill="#ff86ad" opacity="0.75"/></svg></div>'
  + '<div class="sl-layer sl-eyes"><svg viewBox="0 0 120 100"><use href="#ldsl-eye" x="34.3" y="48.6" width="22.4" height="26.9"/><use href="#ldsl-eye" x="63.3" y="48.6" width="22.4" height="26.9"/></svg></div>'
  + '<div class="sl-layer sl-mouth-s"><svg viewBox="0 0 120 100"><path d="M55.8 75.2C58.2 78.8 61.8 78.8 64.2 75.2" fill="none" stroke="#162038" stroke-width="2.4" stroke-linecap="round"/></svg></div>'
  + '<div class="sl-layer sl-mouth-o"><svg viewBox="0 0 120 100"><ellipse cx="60" cy="77" rx="3.6" ry="4.2" fill="#6e1f36" stroke="#162038" stroke-width="1.6"/><ellipse cx="60" cy="79.2" rx="2.2" ry="1.4" fill="#ff8fb3"/></svg></div>'
  + '<div class="sl-layer sl-petal"><svg viewBox="0 0 120 100"><g transform="translate(76 25) scale(1.15)"><path d="M0 0C-8.5 -5 -11 -16.5 -5.8 -25L0 -20.6L5.8 -25C11 -16.5 8.5 -5 0 0Z" fill="url(#ldsl-petal)" stroke="#e8578b" stroke-width="1.2" stroke-linejoin="round"/><path d="M0 -3.2V-15" stroke="#fff" stroke-opacity="0.75" stroke-width="1.3" stroke-linecap="round"/></g></svg></div>'
  + '</div></div>';

/** "Loading" with the three dots that jump when the slime lands. */
export const LABEL_HTML = (text = 'Loading') => `<div class="ld-label"><span class="ld-text">${escapeText(text)}</span><span class="ld-dots" aria-hidden="true"><i></i><i></i><i></i></span></div>`;

/**
 * The slime's markup.
 * @param {{ cls?: string, size?: number|null }} [o] cls: extra classes ('on-light' on a light panel,
 *   'pop' for the pop-in); size: its height in px (default: the CSS of where it sits)
 */
export function slimeMarkup({ cls = '', size = null } = {}) {
  const style = size ? ` style="--s:${Number(size)}px"` : '';
  return `<div class="sl${cls ? ` ${cls}` : ''}" aria-hidden="true"${style}>${SLIME_INNER}</div>`;
}

/** Puts the shared defs into the page once (index.html already has them; this covers anything else). */
export function ensureSlimeDefs(doc = globalThis.document) {
  if (!doc || doc.getElementById('ldsl-defs')) return;
  const t = doc.createElement('template');
  t.innerHTML = SLIME_DEFS;
  doc.body.prepend(t.content.firstElementChild);
}

/**
 * A slime element.
 * @param {{ cls?: string, size?: number|null, doc?: Document }} [o]
 * @returns {HTMLElement}
 */
export function slimeEl({ cls = '', size = null, doc = globalThis.document } = {}) {
  ensureSlimeDefs(doc);
  const t = doc.createElement('template');
  t.innerHTML = slimeMarkup({ cls, size });
  return t.content.firstElementChild;
}

function escapeText(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

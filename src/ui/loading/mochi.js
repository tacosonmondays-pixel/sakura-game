// Mochi, the loading slime: a small jelly mochi from our own slime family (the Green Slime's
// colours, the slime face atlas's big rounded eyes and pink blush). Two looks, picked in Settings →
// Loading screen (the owner compares them): 'mint' = mint jelly with a sakura petal on its head,
// 'sakura' = sakura-pink jelly with a mint leaf. Same shape, same hop; only the colours change (and
// the petal becomes a leaf). The game never shows the name: Mochi is what the code and docs call it.
//
// Pure markup (inline SVG): it draws before any 3D asset or font arrives, and index.html carries
// the same markup for the boot loader (tests/ui/transitions.test.js keeps them equal). Every colour
// is a CSS custom property (--mochi-*, with the mint look as the fallback), and the look is picked
// page-wide by attributes on <html> (data-mochi, data-loader-bg): index.html's inline script sets
// them from the saved settings before the first paint, applyLoadingLook() whenever they change.
//
// Every moving part is its own HTML layer holding a slice of the drawing (body, eyes, the two
// mouths, the petal / leaf, the light pool under it) and animates transform or opacity only, so the
// compositor keeps it hopping while the main thread is busy (a model parse, a shader compile).
// The keyframes and the two palettes live in index.html's inline <style> (they must exist before
// any script runs).

/** Sizes (px of height): the full loader on a phone / on a big screen, the corner chip, inside a panel. */
export const MOCHI_SIZES = Object.freeze({ phone: 64, desktop: 80, chip: 34, inline: 40 });

/** Mochi's two looks (Settings → Loading screen → slime) and the loading screen's two backgrounds. */
export const MOCHI_LOOKS = Object.freeze(['mint', 'sakura']);
export const LOADER_BGS = Object.freeze(['black', 'colour']);
/** The defaults: the mint Mochi on black. */
export const LOADING_LOOK_DEFAULT = Object.freeze({ mochi: 'mint', bg: 'black' });

/** Where the look sits in the saved settings (src/systems/save.js DEFAULT_SETTINGS; index.html's inline script reads the same keys). */
export const LOOK_SETTINGS = Object.freeze({ mochi: 'loadingMochi', bg: 'loadingBg' });

/**
 * The loading screen's look from the settings (anything unknown → the default).
 * @param {object|null|undefined} settings profile.settings
 * @returns {{ mochi: 'mint'|'sakura', bg: 'black'|'colour' }}
 */
export function loadingLookOf(settings) {
  const s = settings && typeof settings === 'object' ? settings : {};
  const mochi = MOCHI_LOOKS.includes(s[LOOK_SETTINGS.mochi]) ? s[LOOK_SETTINGS.mochi] : LOADING_LOOK_DEFAULT.mochi;
  const bg = LOADER_BGS.includes(s[LOOK_SETTINGS.bg]) ? s[LOOK_SETTINGS.bg] : LOADING_LOOK_DEFAULT.bg;
  return { mochi, bg };
}

/**
 * Puts the look on <html> (data-mochi, data-loader-bg): every Mochi and loader on the page follows
 * at once (the CSS keys off the two attributes).
 * @param {object|null|undefined} settings profile.settings
 * @param {Document} [doc]
 */
export function applyLoadingLook(settings, doc = globalThis.document) {
  const look = loadingLookOf(settings);
  try {
    const el = doc.documentElement;
    if (el.getAttribute('data-mochi') !== look.mochi) el.setAttribute('data-mochi', look.mochi);
    if (el.getAttribute('data-loader-bg') !== look.bg) el.setAttribute('data-loader-bg', look.bg);
  } catch {
    /* no DOM */
  }
  return look;
}

/** A colour of the look: its custom property, the mint look's value as the fallback. */
const c = (name, mint) => `var(--mochi-${name},${mint})`;

/** Shared gradients + the eye symbol, once per page (rendered, not display:none, so they resolve). */
export const MOCHI_DEFS = '<svg id="mochi-defs" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>'
  + `<linearGradient id="mochi-jelly" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${c('jelly-1', '#ecfff3')}"/><stop offset="0.36" style="stop-color:${c('jelly-2', '#b2f3c9')}"/><stop offset="0.78" style="stop-color:${c('jelly-3', '#76da9c')}"/><stop offset="1" style="stop-color:${c('jelly-4', '#4cba78')}"/></linearGradient>`
  + '<radialGradient id="mochi-core" cx="0.4" cy="0.36" r="0.55"><stop offset="0" stop-color="#fff" stop-opacity="0.6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
  + `<linearGradient id="mochi-iris" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d152b"/><stop offset="0.55" stop-color="#1b2f52"/><stop offset="1" style="stop-color:${c('iris', '#2f8a8a')}"/></linearGradient>`
  + `<linearGradient id="mochi-sprig-g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color:${c('sprig-1', '#fff0f5')}"/><stop offset="0.55" style="stop-color:${c('sprig-2', '#ffaccb')}"/><stop offset="1" style="stop-color:${c('sprig-3', '#ff79a7')}"/></linearGradient>`
  + '<symbol id="mochi-eye" viewBox="-10 -12 20 24" overflow="visible">'
  + '<ellipse rx="8.6" ry="10.6" fill="url(#mochi-iris)" stroke="#121a31" stroke-width="1.6"/>'
  + `<path d="M-5.8 4.6C-3 8 3 8 5.8 4.6" style="stroke:${c('catch', '#93f5d0')}" stroke-width="1.7" fill="none" stroke-linecap="round" opacity="0.8"/>`
  + '<path d="M-8.3 -3C-7.9 -9.6 -4.4 -11.2 0 -11.2C4.4 -11.2 7.9 -9.6 8.3 -3" stroke="#0f1730" stroke-width="2.8" fill="none" stroke-linecap="round"/>'
  + '<circle cx="-2.7" cy="-4.4" r="3.8" fill="#fff"/><circle cx="3.3" cy="3.3" r="1.8" fill="#fff"/>'
  + '</symbol></defs></svg>';

const BODY = 'M22 94C10 94 5 86 7 74C10 50 30 22 60 22C90 22 110 50 113 74C115 86 110 94 98 94Z';
/** The sakura petal (the mint look) and the mint leaf (the sakura look): both grow from the same point on its head. */
const PETAL = 'M0 0C-8.5 -5 -11 -16.5 -5.8 -25L0 -20.6L5.8 -25C11 -16.5 8.5 -5 0 0Z';
const LEAF = 'M0 0C-9.4 -4.6 -12.2 -15.6 -3.6 -26.6C2.6 -24.6 10.8 -16.4 8.8 -7.8C7.8 -3.4 4.2 -0.6 0 0Z';
const SPRIG_EDGE = c('sprig-edge', '#e8578b');

/** Mochi's layers (no outer wrapper). */
export const MOCHI_INNER = '<div class="mochi-shadow"></div>'
  + '<div class="mochi-hop"><div class="mochi-squash">'
  + `<div class="mochi-layer mochi-body"><svg viewBox="0 0 120 100"><path d="${BODY}" fill="url(#mochi-jelly)" style="stroke:${c('edge', '#2f9c62')}" stroke-width="2.6" stroke-linejoin="round"/><path d="${BODY}" fill="url(#mochi-core)"/>`
  + `<path d="M13 85C30 91.5 90 91.5 107 85C108.5 90 104.5 94 98 94H22C15.5 94 11.5 90 13 85Z" style="fill:${c('edge', '#2f9c62')}" opacity="0.3"/>`
  + '<path d="M24 61C25 47 35 35 49 29.5" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" opacity="0.88"/>'
  + '<circle cx="22.6" cy="70" r="2.8" fill="#fff" opacity="0.85"/>'
  + '<circle cx="90" cy="81" r="4.3" fill="#fff" fill-opacity="0.16" stroke="#fff" stroke-opacity="0.6" stroke-width="1.3"/>'
  + '<circle cx="99" cy="71" r="2.3" fill="#fff" fill-opacity="0.2" stroke="#fff" stroke-opacity="0.55" stroke-width="1"/>'
  + `<ellipse cx="30.5" cy="76" rx="7" ry="3.6" style="fill:${c('blush', '#ff86ad')}" opacity="0.75"/><ellipse cx="89.5" cy="76" rx="7" ry="3.6" style="fill:${c('blush', '#ff86ad')}" opacity="0.75"/></svg></div>`
  + '<div class="mochi-layer mochi-eyes"><svg viewBox="0 0 120 100"><use href="#mochi-eye" x="34.3" y="48.6" width="22.4" height="26.9"/><use href="#mochi-eye" x="63.3" y="48.6" width="22.4" height="26.9"/></svg></div>'
  + '<div class="mochi-layer mochi-mouth-s"><svg viewBox="0 0 120 100"><path d="M55.8 75.2C58.2 78.8 61.8 78.8 64.2 75.2" fill="none" stroke="#162038" stroke-width="2.4" stroke-linecap="round"/></svg></div>'
  + '<div class="mochi-layer mochi-mouth-o"><svg viewBox="0 0 120 100"><ellipse cx="60" cy="77" rx="3.6" ry="4.2" fill="#6e1f36" stroke="#162038" stroke-width="1.6"/><ellipse cx="60" cy="79.2" rx="2.2" ry="1.4" fill="#ff8fb3"/></svg></div>'
  + '<div class="mochi-layer mochi-sprig"><svg viewBox="0 0 120 100"><g transform="translate(76 25) scale(1.15)">'
  + `<g class="mochi-petal"><path d="${PETAL}" fill="url(#mochi-sprig-g)" style="stroke:${SPRIG_EDGE}" stroke-width="1.2" stroke-linejoin="round"/><path d="M0 -3.2V-15" stroke="#fff" stroke-opacity="0.75" stroke-width="1.3" stroke-linecap="round"/></g>`
  + `<g class="mochi-leaf"><path d="${LEAF}" fill="url(#mochi-sprig-g)" style="stroke:${SPRIG_EDGE}" stroke-width="1.2" stroke-linejoin="round"/><path d="M0.3 -2.8C0.9 -10 0.2 -17.4 -2.4 -23" fill="none" stroke="#fff" stroke-opacity="0.8" stroke-width="1.3" stroke-linecap="round"/><path d="M0.6 -9.6L4.6 -12.6M0.1 -15.4L-3.9 -18.2" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="1" stroke-linecap="round"/></g>`
  + '</g></svg></div>'
  + '</div></div>';

/** "Loading" with the three dots that jump when Mochi lands. */
export const LABEL_HTML = (text = 'Loading') => `<div class="ld-label"><span class="ld-text">${escapeText(text)}</span><span class="ld-dots" aria-hidden="true"><i></i><i></i><i></i></span></div>`;

/**
 * Mochi's markup.
 * @param {{ cls?: string, size?: number|null }} [o] cls: extra classes ('on-light' on a light panel,
 *   'pop' for the pop-in); size: its height in px (default: the CSS of where it sits)
 */
export function mochiMarkup({ cls = '', size = null } = {}) {
  const style = size ? ` style="--s:${Number(size)}px"` : '';
  return `<div class="mochi${cls ? ` ${cls}` : ''}" aria-hidden="true"${style}>${MOCHI_INNER}</div>`;
}

/** Puts the shared defs into the page once (index.html already has them; this covers anything else). */
export function ensureMochiDefs(doc = globalThis.document) {
  if (!doc || doc.getElementById('mochi-defs')) return;
  const t = doc.createElement('template');
  t.innerHTML = MOCHI_DEFS;
  doc.body.prepend(t.content.firstElementChild);
}

/**
 * A Mochi element.
 * @param {{ cls?: string, size?: number|null, doc?: Document }} [o]
 * @returns {HTMLElement}
 */
export function mochiEl({ cls = '', size = null, doc = globalThis.document } = {}) {
  ensureMochiDefs(doc);
  const t = doc.createElement('template');
  t.innerHTML = mochiMarkup({ cls, size });
  return t.content.firstElementChild;
}

function escapeText(s) {
  return String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
}

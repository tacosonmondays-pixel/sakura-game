// The DOM probe of docs/specs/UI_DIRECTION.md §8 (gate 3), shared by the UI e2e scripts (ui-shots --probe, m5-kit,
// the hub and list checks). Per screen and viewport it measures, on what is visible in the viewport:
//   - minText       the smallest computed size of visible text (floor 12 px on phones, 13 px on desktop)
//   - numbers       visible text elements holding a digit, outside repeated tiles and the currency bar (≤ 12);
//                   tileMax is the most numbers inside one repeated tile or row (budgeted per tile, P3)
//   - ellipsis      numbers or rules cut by an ellipsis (0)
//   - overflowX     the page scrolls sideways (false); scrollers: elements that scroll sideways (0)
//   - content       the visible height of the screen's content window (≥ 300 px)
//   - hostShare     the host girl's width as a share of the viewport (≤ 35% hub and list, ≤ 28% detail)
//   - bubbleOverList  the host's speech bubble overlaps the list or grid (false)
//   - yellow        visible yellow primary buttons (≤ 1)
//   - smallTaps     buttons under 40 px (0); denseTaps: 40-43 px (allowed in dense rows only)
// Nothing here changes the page.
//
//   import { probe, judge } from './probe.mjs';
//   const r = await probe(page, { kind: 'hub', list: '.ma-hub-grid' });
//   const fails = judge(r);   // [] when the screen passes

/** Repeated collections (P3: budgeted per tile or row, not per screen). */
export const REPEAT = [
  '.item-tile', '.ui-gtile', '.unit-card', '.ma-offer', '.ma-mission', '.mbx-letter', '.ev-list-row', '.tt-card',
  '.ma-cal-day', '.ach-row', '.ma-stage-card', '.ma-sc', '.lb-slide', '.ma-next-row', '[data-probe="tile"]',
].join(', ');

/** Never counted: the currency bar (P3) and anything a script marks. */
export const SKIP = ['.cur-pills', '.lb-pills', '[data-probe="skip"]', '.ld', '.ld-chip', '.toast-host', '.jn-toast'].join(', ');

/**
 * @param {import('playwright').Page} page
 * @param {{ kind?: 'hub'|'list'|'detail', list?: string|null, content?: string|null, host?: string, bubble?: string,
 *   repeat?: string, skip?: string, root?: string }} [opts]
 *   list: the list or grid the bubble must stay clear of; content: the content window (default the screen body)
 */
export async function probe(page, opts = {}) {
  const o = {
    kind: 'hub', list: null, content: null, host: '.ui-host', bubble: '.ui-host-bubble', repeat: REPEAT, skip: SKIP, root: 'body',
    ...opts,
  };
  return page.evaluate(probeInPage, o);
}

/* eslint-disable no-undef */
function probeInPage(o) {
  const W = innerWidth;
  const H = innerHeight;
  const phone = H <= 480;
  const floor = phone ? 12 : 13;
  const root = document.querySelector(o.root) || document.body;
  const inView = (r) => r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < W && r.top < H;
  const shown = (el) => {
    if (!el || !el.isConnected) return false;
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    return inView(el.getBoundingClientRect());
  };
  const deco = (el) => !!el.closest('[aria-hidden="true"], .deco, script, style, noscript, template');
  const skipped = (el) => !!el.closest(o.skip);
  const label = (el) => {
    const c = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return `${el.tagName.toLowerCase()}${c ? `.${c}` : ''}`;
  };
  const clip = (s) => s.replace(/\s+/g, ' ').trim().slice(0, 40);

  // ---- text: the smallest size, the numbers, ellipses ------------------------------------------
  let minText = Infinity;
  const small = [];
  const numEls = new Set();
  const tileNums = new Map();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!/\S/.test(n.nodeValue)) continue;
    const el = n.parentElement;
    if (!el || deco(el) || skipped(el)) continue;
    range.selectNodeContents(n);
    const r = range.getBoundingClientRect();
    if (!inView(r) || !shown(el)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize) || 0;
    if (fs < minText) minText = fs;
    if (fs < floor) small.push(`${fs}px ${label(el)} "${clip(n.nodeValue)}"`);
    if (/\d/.test(n.nodeValue)) {
      const tile = el.closest(o.repeat);
      if (tile) tileNums.set(tile, (tileNums.get(tile) || new Set()).add(el));
      else numEls.add(el);
    }
  }
  const ellipsis = [];
  for (const el of root.querySelectorAll('*')) {
    if (deco(el) || skipped(el) || !shown(el)) continue;
    const txt = el.textContent || '';
    if (!/\d/.test(txt) && !/…/.test(txt)) continue;
    const cs = getComputedStyle(el);
    const cut = cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1;
    const own = [...el.childNodes].some((c) => c.nodeType === 3 && /\d/.test(c.nodeValue) && /…/.test(c.nodeValue));
    if ((cut && /\d/.test(txt)) || own) ellipsis.push(`${label(el)} "${clip(txt)}"`);
  }

  // ---- sideways overflow -------------------------------------------------------------------------
  const se = document.scrollingElement || document.documentElement;
  const overflowX = se.scrollWidth > W + 1;
  const scrollers = [];
  for (const el of root.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') continue;
    if (el.scrollWidth > el.clientWidth + 1 && shown(el) && !deco(el)) scrollers.push(label(el));
  }

  // ---- content window, host, bubble ------------------------------------------------------------
  const visH = (el) => {
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0));
  };
  const contentEl = o.content ? document.querySelector(o.content) : document.querySelector('#app .screen-body, #app [data-probe="content"], body > [data-probe="content"]');
  const content = contentEl && shown(contentEl) ? Math.round(visH(contentEl)) : null;
  const hostEl = [...document.querySelectorAll(o.host)].find(shown) || null;
  const hostShare = hostEl ? Math.round((hostEl.getBoundingClientRect().width / W) * 1000) / 1000 : null;
  const bubbleEl = [...document.querySelectorAll(o.bubble)].find(shown) || null;
  const listEl = o.list ? [...document.querySelectorAll(o.list)].find(shown) || null : null;
  let bubbleOverList = false;
  if (bubbleEl && listEl) {
    const a = bubbleEl.getBoundingClientRect();
    const b = listEl.getBoundingClientRect();
    bubbleOverList = Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
  }

  // ---- yellow primaries ----------------------------------------------------------------------------
  const isYellow = (cs) => {
    const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(cs.backgroundColor);
    const solid = m && (m[4] == null || Number(m[4]) > 0.5) && Number(m[1]) >= 240 && Number(m[2]) >= 190 && Number(m[2]) <= 245 && Number(m[3]) <= 130;
    const grad = /rgb\(255, 2(?:0\d|1\d|2\d|3\d|4\d), (?:[0-9]|[1-9]\d|1[0-2]\d)\)/.test(cs.backgroundImage);
    return solid || grad;
  };
  const yellow = [];
  for (const el of root.querySelectorAll('button, [role="button"], a[href]')) {
    if (deco(el) || skipped(el) || !shown(el)) continue;
    if (el.closest('.ui-sticker, .ui-more, .ui-bdg')) continue; // stickers and MORE are not primaries
    if (el.disabled) continue;
    if (el.classList.contains('btn-yellow') || el.hasAttribute('data-primary') || isYellow(getComputedStyle(el))) yellow.push(`${label(el)} "${clip(el.textContent || '')}"`);
  }

  // ---- tap targets ---------------------------------------------------------------------------------
  const smallTaps = [];
  const denseTaps = [];
  for (const el of root.querySelectorAll('button, a[href], [role="button"], [role="tab"], input:not([type="hidden"]), select, summary')) {
    if (skipped(el) || !shown(el) || el.closest('[aria-hidden="true"]')) continue;
    if (getComputedStyle(el).pointerEvents === 'none') continue;
    const r = el.getBoundingClientRect();
    let w = r.width;
    let h = r.height;
    // an invisible ::before hit box (the MORE sticker, small icon buttons) counts
    const pb = getComputedStyle(el, '::before');
    if (pb.content && pb.content !== 'none' && pb.position === 'absolute') {
      w = Math.max(w, parseFloat(pb.width) || 0);
      h = Math.max(h, parseFloat(pb.height) || 0);
    }
    const s = Math.min(w, h);
    if (s < 40) smallTaps.push(`${Math.round(w)}x${Math.round(h)} ${label(el)} "${clip(el.textContent || el.getAttribute('aria-label') || '')}"`);
    else if (s < 44) denseTaps.push(`${Math.round(w)}x${Math.round(h)} ${label(el)}`);
  }

  let tileMax = 0;
  for (const set of tileNums.values()) tileMax = Math.max(tileMax, set.size);
  return {
    vp: `${W}x${H}`,
    kind: o.kind,
    floor,
    minText: Number.isFinite(minText) ? minText : null,
    small: small.slice(0, 12),
    smallCount: small.length,
    numbers: numEls.size,
    numbersSample: [...numEls].slice(0, 20).map((el) => clip(el.textContent || '')),
    tileMax,
    ellipsis,
    overflowX,
    scrollers,
    content,
    hostShare,
    bubbleOverList,
    yellow,
    smallTaps: smallTaps.slice(0, 20),
    smallTapCount: smallTaps.length,
    denseTapCount: denseTaps.length,
  };
}
/* eslint-enable no-undef */

/** The limits (§1 P3, P6; §5.10 E1). */
export const LIMITS = Object.freeze({ numbers: 12, content: 300, yellow: 1, host: { hub: 0.35, list: 0.35, detail: 0.28 } });

/**
 * The failed checks of one probe result, as short strings ([] = pass).
 * @param {ReturnType<typeof probeInPage>} r
 * @param {{ skip?: string[] }} [o] skip: checks not judged on this screen ('numbers', 'taps', ...)
 */
export function judge(r, { skip = [] } = {}) {
  const fails = [];
  const on = (k) => !skip.includes(k);
  if (on('text') && r.minText != null && r.minText < r.floor) fails.push(`text ${r.minText}px < ${r.floor}px (${r.smallCount}: ${r.small.slice(0, 3).join('; ')})`);
  if (on('numbers') && r.numbers > LIMITS.numbers) fails.push(`numbers ${r.numbers} > ${LIMITS.numbers}`);
  if (on('ellipsis') && r.ellipsis.length) fails.push(`ellipsis on ${r.ellipsis.length}: ${r.ellipsis.slice(0, 3).join('; ')}`);
  if (on('overflow') && (r.overflowX || r.scrollers.length)) fails.push(`sideways overflow${r.overflowX ? ' (page)' : ''}${r.scrollers.length ? ` (${r.scrollers.slice(0, 3).join(', ')})` : ''}`);
  if (on('content') && r.content != null && r.content < LIMITS.content) fails.push(`content window ${r.content}px < ${LIMITS.content}px`);
  if (on('host') && r.hostShare != null && r.hostShare > LIMITS.host[r.kind] + 0.005) fails.push(`host ${Math.round(r.hostShare * 100)}% > ${Math.round(LIMITS.host[r.kind] * 100)}%`);
  if (on('bubble') && r.bubbleOverList) fails.push('bubble over the list');
  if (on('yellow') && r.yellow.length > LIMITS.yellow) fails.push(`${r.yellow.length} yellow primaries (${r.yellow.slice(0, 3).join('; ')})`);
  if (on('taps') && r.smallTapCount) fails.push(`${r.smallTapCount} taps under 40 px (${r.smallTaps.slice(0, 3).join('; ')})`);
  return fails;
}

/** One line for logs and reports: "text 12 · numbers 9 · yellow 1 · taps<40 0 · content 318". */
export function summary(r) {
  return [
    `text ${r.minText ?? '–'}`,
    `numbers ${r.numbers}${r.tileMax ? ` (tile ${r.tileMax})` : ''}`,
    `ellipsis ${r.ellipsis.length}`,
    `overflow ${r.overflowX || r.scrollers.length ? 'yes' : 'no'}`,
    `content ${r.content ?? '–'}`,
    `host ${r.hostShare != null ? `${Math.round(r.hostShare * 100)}%` : '–'}`,
    `yellow ${r.yellow.length}`,
    `taps<40 ${r.smallTapCount}`,
  ].join(' · ');
}

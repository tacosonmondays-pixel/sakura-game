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
//   - spills        text running past the left or right edge of the box drawn around it (its tile, chip or panel:
//                   the nearest element with a background or a border), by more than 1.5 px (0). Text an element
//                   clips or ends in "…" on the way is left to the ellipsis check (UI M5d review)
//   - overlaps      pairs of elements that must stay apart (opts.apart: [selectorA, selectorB] pairs, both shown)
//                   and overlap (0): e.g. the lobby secretary's speech bubble and the tray
//   - clipped       lines of text cut off by a box on the way up (overflow hidden or clip) without a "…" (the
//                   ellipsis check) or a deliberate fade (a mask: the Mailroom's one-line preview, P6), and lines that
//                   run past their own block under an element that is neither around them nor inside them (a title
//                   under its row's Claim) (0). Opt-in: judged when asked for (judge `only` or `also`). UI M5 merge
//                   review: the Mailroom and Profile at 390x844, where spill (which skips clipped text) saw nothing
// The item tile's small "x" (`.item-count > small`) is M3's glyph at M3's own 12 px floor (base.css "Items", owner
// #108): it is left out of the text floor; the count's digits are judged like any text.
// Nothing here changes the page.
//
//   import { probe, judge } from './probe.mjs';
//   const r = await probe(page, { kind: 'hub', list: '.ma-hub-grid' });
//   const fails = judge(r);   // [] when the screen passes
//   judge(r, { only: ['spill', 'apart'] })   // just those checks
//   judge(r, { also: ['clip'] })   // every default check, and the opt-in clip check

/** Repeated collections (P3: budgeted per tile or row, not per screen). */
export const REPEAT = [
  '.item-tile', '.ui-gtile', '.unit-card', '.ma-offer', '.ma-mission', '.mbx-letter', '.ev-list-row', '.tt-card',
  '.ma-cal-day', '.ach-row', '.ma-stage-card', '.ma-sc', '.lb-slide', '.ma-next-row', '[data-probe="tile"]',
  // UI M5b: the Bounty arena rows and tiers, the drop tiles, the boss cards, the campaign's chapter tabs
  '.ma-loc', '.ma-tier-btn', '.ma-drop', '.ma-boss-card', '.ma-chapter-tab',
  // UI M5c: the Happening Now rows, the Settings rows, the old Events page's income table rows
  '.hn-row', '.ma-set-row', '.ma-income-table tr',
  // UI M5d: the Multiplayer invite rows; Formation's squad slots, picker cards and counter rows; the profile's showcase
  // slots, medal and ribbon cells, plaques, stat tiles and freeplay rows
  '.mp-invite', '.mb-fslot', '.mb-pick', '.mb-rec', '.pf-slot', '.pf-tc', '.pf-plaque', '.pf-stat', '.pf-fp-row',
].join(', ');

/** Never counted: the currency bar (P3) and anything a script marks. */
export const SKIP = ['.cur-pills', '.lb-pills', '[data-probe="skip"]', '.ld', '.ld-chip', '.toast-host', '.jn-toast'].join(', ');

/**
 * @param {import('playwright').Page} page
 * @param {{ kind?: 'hub'|'list'|'detail', list?: string|null, content?: string|null, host?: string, bubble?: string,
 *   repeat?: string, skip?: string, root?: string, tapSkip?: string|null, apart?: [string, string][] }} [opts]
 *   list: the list or grid the bubble must stay clear of; content: the content window (default the screen body);
 *   tapSkip: controls left out of the tap check (the game's shared top bar, which no milestone screen owns);
 *   apart: pairs of selectors whose shown elements must not overlap
 */
export async function probe(page, opts = {}) {
  const o = {
    kind: 'hub', list: null, content: null, host: '.ui-host', bubble: '.ui-host-bubble', repeat: REPEAT, skip: SKIP, root: 'body', tapSkip: null, apart: [],
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

  // ---- text: the smallest size, the numbers, ellipses, spills ------------------------------------
  let minText = Infinity;
  const small = [];
  const numEls = new Set();
  const tileNums = new Map();
  const spills = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const drawsBox = (cs) => (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') || cs.backgroundImage !== 'none'
    || parseFloat(cs.borderLeftWidth) > 0 || parseFloat(cs.borderRightWidth) > 0;
  /**
   * The box drawn around this text (the nearest element with a background or a border), or null when the text ends in
   * "…" or is clipped on the way there (a box that clips at its own edge still counts: a glyph cut at a card's border).
   */
  const boxOf = (el) => {
    for (let p = el; p && p !== root.parentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.textOverflow === 'ellipsis') return null;
      if (drawsBox(cs)) return p;
      if (cs.overflowX !== 'visible') return null;
    }
    return null;
  };
  const clipped = [];
  const isInline = (cs) => cs.display.startsWith('inline') || cs.display === 'contents';
  /**
   * How a box on the way up treats this text: 'cut' (the box that clips a line, a line clipped), 'ok' (ended by "…",
   * faded by a mask or visually hidden: left alone), or null (nothing clips it). A scroller's own axis is left out.
   */
  const clipOf = (el, lines0) => {
    let lines = lines0;
    let sx = false;
    let sy = false;
    // (a line's box is the font's whole content area, taller than its ink: a tight line-height clips only that air, so
    // up and down a quarter of the font size is allowed)
    const airY = 0.25 * (parseFloat(getComputedStyle(el).fontSize) || 12);
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.textOverflow === 'ellipsis' || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none')) return { kind: 'ok' };
      if ((cs.maskImage && cs.maskImage !== 'none') || (cs.webkitMaskImage && cs.webkitMaskImage !== 'none')) return { kind: 'ok' };
      const ar = a.getBoundingClientRect();
      if (ar.width <= 2 || ar.height <= 2 || (cs.clip && cs.clip !== 'auto')) return { kind: 'ok' }; // a visually hidden label
      const cx = !sx && (cs.overflowX === 'hidden' || cs.overflowX === 'clip');
      const cy = !sy && (cs.overflowY === 'hidden' || cs.overflowY === 'clip');
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') sx = true;
      if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') sy = true;
      if (!cx && !cy) continue;
      // (a line wholly outside the box is hidden on purpose, not cut: a carousel's next slide, a folded panel; it is
      // out of the count from here up)
      lines = lines.filter((l) => Math.min(l.right, ar.right) - Math.max(l.left, ar.left) > 0.5 && Math.min(l.bottom, ar.bottom) - Math.max(l.top, ar.top) > 0.5);
      if (!lines.length) return { kind: 'ok' };
      for (const l of lines) {
        const over = Math.max(cx ? Math.max(l.right - ar.right, ar.left - l.left) : 0, cy ? Math.max(l.bottom - ar.bottom, ar.top - l.top) - airY : 0);
        if (over > 1.5) return { kind: 'cut', box: a, over };
      }
    }
    return null;
  };
  /** What can hide words or be hidden by them: a control, a picture, or an element with words of its own. */
  const solid = (e) => e.matches('button, a[href], [role="button"], input, select, textarea, img, svg, canvas')
    || [...e.childNodes].some((c) => c.nodeType === 3 && /\S/.test(c.nodeValue));
  /** A line past its own block (the element that lays it out), under or over a solid element neither around it nor in it. */
  const coverOf = (el, lines) => {
    let block = el;
    while (block && block !== root && isInline(getComputedStyle(block))) block = block.parentElement;
    if (!block) return null;
    const b = block.getBoundingClientRect();
    for (const l of lines) {
      for (const [x0, x1] of [[b.right, l.right], [l.left, b.left]]) {
        if (x1 - x0 <= 1.5) continue;
        const x = (x0 + x1) / 2;
        const y = (l.top + l.bottom) / 2;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const other = document.elementsFromPoint(x, y).find((e) => e !== el && !el.contains(e) && !e.contains(el)
          && e !== document.body && e !== document.documentElement && !deco(e) && !skipped(e) && solid(e));
        if (other) return { over: x1 - x0, other };
      }
    }
    return null;
  };
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!/\S/.test(n.nodeValue)) continue;
    const el = n.parentElement;
    if (!el || deco(el) || skipped(el)) continue;
    range.selectNodeContents(n);
    const r = range.getBoundingClientRect();
    if (!inView(r) || !shown(el)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize) || 0;
    // (M3's small "x" on an item tile keeps M3's own 12 px floor: see the header)
    if (!el.matches('.item-count > small')) {
      if (fs < minText) minText = fs;
      if (fs < floor) small.push(`${fs}px ${label(el)} "${clip(n.nodeValue)}"`);
    }
    // cut off by a box on the way up, or run under a neighbour (the opt-in clip check)
    const lines = [...range.getClientRects()].filter((l) => l.width > 0.5 && l.height > 0.5);
    const cut = clipOf(el, lines);
    if (cut?.kind === 'cut') clipped.push(`${Math.round(cut.over * 10) / 10}px ${label(el)} "${clip(n.nodeValue)}" cut by ${label(cut.box)}`);
    else if (!cut) {
      const cov = coverOf(el, lines);
      if (cov) clipped.push(`${Math.round(cov.over * 10) / 10}px ${label(el)} "${clip(n.nodeValue)}" runs under ${label(cov.other)}`);
    }
    if (/\d/.test(n.nodeValue)) {
      const tile = el.closest(o.repeat);
      if (tile) tileNums.set(tile, (tileNums.get(tile) || new Set()).add(el));
      else numEls.add(el);
    }
    // past the left or right edge of its box (a label beyond its tile's border; UI M5d review)
    const box = boxOf(el);
    if (box && box !== root && box !== document.documentElement) {
      const b = box.getBoundingClientRect();
      const over = Math.max(r.right - b.right, b.left - r.left);
      if (over > 1.5 && b.width > 0) spills.push(`${Math.round(over * 10) / 10}px ${label(el)} "${clip(n.nodeValue)}" past ${label(box)}`);
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
    if (o.tapSkip && el.closest(o.tapSkip)) continue;
    if (getComputedStyle(el).pointerEvents === 'none') continue;
    // a page tab is at least 44 × 36 (§5.3)
    if (el.getAttribute('role') === 'tab') {
      const t = el.getBoundingClientRect();
      if (t.height >= 36 && t.width >= 44) continue;
    }
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

  // ---- elements that must stay apart -----------------------------------------------------------------
  const overlaps = [];
  for (const [sa, sb] of o.apart || []) {
    for (const a of document.querySelectorAll(sa)) {
      if (!shown(a)) continue;
      const ra = a.getBoundingClientRect();
      for (const b of document.querySelectorAll(sb)) {
        if (b === a || !shown(b)) continue;
        const rb = b.getBoundingClientRect();
        const area = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left)) * Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top));
        if (area > 1) overlaps.push(`${label(a)} × ${label(b)} ${Math.round(area)}px²`);
      }
    }
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
    spills: spills.slice(0, 20),
    spillCount: spills.length,
    overlaps,
    clipped: clipped.slice(0, 20),
    clipCount: clipped.length,
  };
}
/* eslint-enable no-undef */

/** The limits (§1 P3, P6; §5.10 E1). */
export const LIMITS = Object.freeze({ numbers: 12, content: 300, yellow: 1, host: { hub: 0.35, list: 0.35, detail: 0.28 } });

/** Checks judged only when asked for by name (`only` or `also`). */
export const OPT_IN = Object.freeze(['clip']);

/**
 * The failed checks of one probe result, as short strings ([] = pass).
 * @param {ReturnType<typeof probeInPage>} r
 * @param {{ skip?: string[], only?: string[]|null, also?: string[] }} [o] skip: checks not judged on this screen
 *   ('numbers', 'taps', ...); only: judge just these checks; also: opt-in checks judged with the default ones ('clip')
 */
export function judge(r, { skip = [], only = null, also = [] } = {}) {
  const fails = [];
  const on = (k) => !skip.includes(k) && (only ? only.includes(k) : !OPT_IN.includes(k) || also.includes(k));
  if (on('text') && r.minText != null && r.minText < r.floor) fails.push(`text ${r.minText}px < ${r.floor}px (${r.smallCount}: ${r.small.slice(0, 3).join('; ')})`);
  if (on('numbers') && r.numbers > LIMITS.numbers) fails.push(`numbers ${r.numbers} > ${LIMITS.numbers}`);
  if (on('ellipsis') && r.ellipsis.length) fails.push(`ellipsis on ${r.ellipsis.length}: ${r.ellipsis.slice(0, 3).join('; ')}`);
  if (on('overflow') && (r.overflowX || r.scrollers.length)) fails.push(`sideways overflow${r.overflowX ? ' (page)' : ''}${r.scrollers.length ? ` (${r.scrollers.slice(0, 3).join(', ')})` : ''}`);
  if (on('content') && r.content != null && r.content < LIMITS.content) fails.push(`content window ${r.content}px < ${LIMITS.content}px`);
  if (on('host') && r.hostShare != null && r.hostShare > LIMITS.host[r.kind] + 0.005) fails.push(`host ${Math.round(r.hostShare * 100)}% > ${Math.round(LIMITS.host[r.kind] * 100)}%`);
  if (on('bubble') && r.bubbleOverList) fails.push('bubble over the list');
  if (on('yellow') && r.yellow.length > LIMITS.yellow) fails.push(`${r.yellow.length} yellow primaries (${r.yellow.slice(0, 3).join('; ')})`);
  if (on('taps') && r.smallTapCount) fails.push(`${r.smallTapCount} taps under 40 px (${r.smallTaps.slice(0, 3).join('; ')})`);
  if (on('spill') && r.spillCount) fails.push(`${r.spillCount} text past its box (${r.spills.slice(0, 3).join('; ')})`);
  if (on('apart') && r.overlaps?.length) fails.push(`overlap: ${r.overlaps.slice(0, 3).join('; ')}`);
  if (on('clip') && r.clipCount) fails.push(`${r.clipCount} text cut off or under a neighbour (${r.clipped.slice(0, 3).join('; ')})`);
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
    `spills ${r.spillCount ?? '–'}`,
    `clipped ${r.clipCount ?? '–'}`,
    ...(r.overlaps?.length ? [`overlaps ${r.overlaps.length}`] : []),
  ].join(' · ');
}

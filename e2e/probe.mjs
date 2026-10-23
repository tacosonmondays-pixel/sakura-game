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
// Nothing here changes the page.
//
// [ui-ink] v2 mode (UI v2 "Ink & Paper", notes/ui-v2/UI_V2_DIRECTION.md rules 3, 6-8, 10 and S5), with `v2: true`:
//   - numbersAll    visible numbers counting the top bar (≤ 10; tiles and rows still budgeted on their own)
//   - yellowFills   visible surfaces filled yellow, found by their computed colour (not by class): ≤ 1
//   - pink          surfaces painted in the four sakura tokens, each with why it may be pink (selected, a hero, the
//                   co-op partner, In Progress); pinkStray: the ones with no reason (0)
//   - radius        boxes with a corner radius that are not circles or stadiums (S5: 0 on the screens v2 rebuilt)
//   - covered       controls whose centre another element paints over (elementFromPoint at the centre, 0): a host's
//                   art or a scrim over UI
//   - taps          the real hit area of every control, measured by scanning elementFromPoint outward from its
//                   centre in 0.25 px steps; tapMin is the smallest, and the report prints exactly the number it
//                   judges (low 7: "43.8 printed while asserting 44" cannot happen: both are the same value)
//
//   import { probe, judge } from './probe.mjs';
//   const r = await probe(page, { kind: 'hub', list: '.ma-hub-grid' });
//   const fails = judge(r);   // [] when the screen passes
//   judge(r, { only: ['spill', 'apart'] })   // just those checks
//   judge(await probe(page, { v2: true }), { v2: true })   // the v2 budgets as well

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
/** [ui-ink] v2 counts the top bar's numbers too (rule 8): only these stay out of every count. */
export const SKIP_V2 = ['[data-probe="skip"]', '.ld', '.ld-chip', '.toast-host', '.jn-toast'].join(', ');
/** [ui-ink] The four sakura tokens (--pink, --pink-ink, --pink-on-ink, --pink-text) as rgb. */
export const PINK_RGB = Object.freeze([[255, 122, 168], [210, 58, 116], [255, 156, 192], [176, 23, 79]]);
/** [ui-ink] Where pink may appear (§4.1, §4.3): selected things, heroes, the co-op partner, In Progress. */
export const PINK_OK = [
  '.on', '.active', '.selected', '.sel', '[aria-selected="true"]', '[aria-pressed="true"]', '[aria-current]', '.ui-chip.pick',
  '.ui-bdg.inprog', '.tag-ribbon', '.hero', '[data-hero]', '.is-hero', '.partner', '[data-partner]',
].join(', ');

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
    v2: false, skipV2: SKIP_V2, pinkRgb: PINK_RGB, pinkOk: PINK_OK, tapScanMax: 160,
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
  const v2 = o.v2 ? probeV2(o, { root, W, H, phone, shown, deco, label, clip, inView }) : null;
  return {
    ...(v2 ? { v2 } : {}),
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
  };

  // ---- [ui-ink] the v2 mode (see the header). Nested: page.evaluate() ships only probeInPage's own source ----------
  function probeV2(opt, ctx) {
    const { root: rt, W: vw, H: vh, shown: isShown, deco: isDeco, label: nameOf, clip: cut, inView: seen } = ctx;
    const out2 = (el) => !!el.closest(opt.skipV2);
    // numbers, the top bar included (repeated tiles and rows still count on their own)
    const nums = new Set();
    const tw = document.createTreeWalker(rt, NodeFilter.SHOW_TEXT);
    const rg = document.createRange();
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!/\d/.test(n.nodeValue)) continue;
      const el = n.parentElement;
      if (!el || isDeco(el) || out2(el) || el.closest(opt.repeat)) continue;
      rg.selectNodeContents(n);
      if (!seen(rg.getBoundingClientRect()) || !isShown(el)) continue;
      nums.add(el);
    }
    // colours: the element and its two pseudo elements
    const rgbOf = (s) => {
      const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s || '');
      return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] == null ? 1 : Number(m[4])] : null;
    };
    const near = (c, t, tol) => !!c && c[3] > 0.5 && Math.abs(c[0] - t[0]) <= tol && Math.abs(c[1] - t[1]) <= tol && Math.abs(c[2] - t[2]) <= tol;
    const yellowish = (c) => !!c && c[3] > 0.5 && c[0] >= 240 && c[1] >= 190 && c[1] <= 245 && c[2] <= 130;
    const allRgb = (s) => [...String(s || '').matchAll(/rgba?\([^)]*\)/g)].map((m) => rgbOf(m[0]));
    const styles = (el) => [getComputedStyle(el), getComputedStyle(el, '::before'), getComputedStyle(el, '::after')];
    const yellowFills = [];
    const pink = [];
    const pinkStray = [];
    const radius = [];
    let radiusCount = 0;
    for (const el of rt.querySelectorAll('*')) {
      if (isDeco(el) || out2(el) || el.closest('svg')) continue;
      if (el.tagName === 'IMG' || el.tagName === 'CANVAS' || el.tagName === 'VIDEO' || el.closest('.ia, .pt-wrap, .pt-img')) continue;
      const r = el.getBoundingClientRect();
      if (!seen(r) || r.width < 2 || r.height < 2 || !isShown(el)) continue;
      const [cs, before, after] = styles(el);
      const layers = [cs, ...[before, after].filter((p) => p.content && p.content !== 'none')];
      // yellow: a filled surface (≥ 150 px²), by its computed colour
      if (r.width * r.height >= 150 && layers.some((p) => yellowish(rgbOf(p.backgroundColor)) || allRgb(p.backgroundImage).some(yellowish))) {
        yellowFills.push(`${nameOf(el)} "${cut(el.textContent || el.getAttribute('aria-label') || '')}"`);
      }
      // pink: a fill, a border, a ring (box-shadow) or an outline in one of the four sakura tokens
      const isPink = (c) => opt.pinkRgb.some((t) => near(c, t, 6));
      const hit = layers.some((p) => isPink(rgbOf(p.backgroundColor)) || allRgb(p.backgroundImage).some(isPink)
        || ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(p[`border${s}Width`]) > 0 && isPink(rgbOf(p[`border${s}Color`])))
        || allRgb(p.boxShadow).some(isPink) || (parseFloat(p.outlineWidth) > 0 && p.outlineStyle !== 'none' && isPink(rgbOf(p.outlineColor))));
      if (hit) {
        const why = el.closest(opt.pinkOk);
        const row = `${nameOf(el)}${why && why !== el ? ` in ${nameOf(why)}` : ''} "${cut(el.textContent || '')}"`;
        pink.push(row);
        if (!why) pinkStray.push(row);
      }
      // S5: a corner radius only on circles and stadiums
      const rad = ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map((k) => parseFloat(cs[`border${k}Radius`]) || 0);
      if (rad.some((v) => v > 0.5)) {
        const half = Math.min(r.width, r.height) / 2 - 1;
        if (!rad.every((v) => v >= half)) {
          radiusCount++;
          if (radius.length < 20) radius.push(`${nameOf(el)} ${rad.map((v) => Math.round(v)).join('/')}`);
        }
      }
    }
    // controls: on top at their centre, and their real hit area
    const CONTROLS = 'button, a[href], [role="button"], [role="tab"], input:not([type="hidden"]), select, summary';
    const clippedAt = (el, x, y) => {
      for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        const pcs = getComputedStyle(p);
        if (pcs.overflowX === 'visible' && pcs.overflowY === 'visible') continue;
        const b = p.getBoundingClientRect();
        if (x < b.left || x > b.right || y < b.top || y > b.bottom) return true;
      }
      return false;
    };
    const layered = '.modal-overlay, .ui-layer, .ui-scrim, .ui-scrim-full, .toast-host, .rotate-overlay';
    const covered = [];
    const taps = [];
    const STEP = 0.25;
    for (const el of rt.querySelectorAll(CONTROLS)) {
      if (out2(el) || el.closest('[aria-hidden="true"]') || !isShown(el) || el.disabled) continue;
      if (opt.tapSkip && el.closest(opt.tapSkip)) continue;
      if (getComputedStyle(el).pointerEvents === 'none') continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (cx < 0 || cy < 0 || cx > vw || cy > vh || clippedAt(el, cx, cy)) continue;
      const top = document.elementFromPoint(cx, cy);
      if (!top) continue;
      const mine = (t) => !!t && (t === el || el.contains(t));
      if (!mine(top)) {
        if (top.closest(layered) && !el.closest(layered)) continue; // a sheet or a dialog is open over the screen
        covered.push(`${nameOf(el)} "${cut(el.textContent || el.getAttribute('aria-label') || '')}" under ${nameOf(top)}`);
        continue;
      }
      // scan outward from the centre: whole px first, then the last px in 0.25 px steps
      const reach = (dx, dy) => {
        let d = 0;
        while (d < opt.tapScanMax && mine(document.elementFromPoint(cx + dx * (d + 1), cy + dy * (d + 1)))) d += 1;
        while (d < opt.tapScanMax && mine(document.elementFromPoint(cx + dx * (d + STEP), cy + dy * (d + STEP)))) d += STEP;
        return d;
      };
      const w = Math.round((reach(-1, 0) + reach(1, 0)) / STEP) * STEP;
      const hh = Math.round((reach(0, -1) + reach(0, 1)) / STEP) * STEP;
      taps.push({ w, h: hh, s: Math.min(w, hh), name: `${nameOf(el)} "${cut(el.textContent || el.getAttribute('aria-label') || '')}"` });
    }
    const fmt = (t) => `${t.w.toFixed(2)}x${t.h.toFixed(2)} ${t.name}`;
    const tapMin = taps.length ? Math.min(...taps.map((t) => t.s)) : null;
    return {
      numbersAll: nums.size,
      numbersAllSample: [...nums].slice(0, 24).map((el) => cut(el.textContent || '')),
      yellowFills,
      pink: pink.slice(0, 20),
      pinkCount: pink.length,
      pinkStray: pinkStray.slice(0, 20),
      pinkStrayCount: pinkStray.length,
      radius,
      radiusCount,
      covered: covered.slice(0, 20),
      coveredCount: covered.length,
      tapStep: STEP,
      tapCount: taps.length,
      tapMin,
      tapMinText: tapMin == null ? null : tapMin.toFixed(2),
      tapsUnder44: taps.filter((t) => t.s < 44).sort((a, b) => a.s - b.s).slice(0, 20).map(fmt),
      tapsUnder44Count: taps.filter((t) => t.s < 44).length,
      tapsUnder40Count: taps.filter((t) => t.s < 40).length,
    };
  }
}
/* eslint-enable no-undef */

/** The limits (§1 P3, P6; §5.10 E1). */
export const LIMITS = Object.freeze({ numbers: 12, content: 300, yellow: 1, host: { hub: 0.35, list: 0.35, detail: 0.28 } });
/** [ui-ink] The v2 budgets (UI_V2_DIRECTION.md rules 3, 7, 8 and S5): the top bar counts; a tap is 44 px. */
export const LIMITS_V2 = Object.freeze({ numbers: 10, yellow: 1, tap: 44 });

/**
 * The failed checks of one probe result, as short strings ([] = pass).
 * @param {ReturnType<typeof probeInPage>} r
 * @param {{ skip?: string[], only?: string[]|null, v2?: boolean }} [o] skip: checks not judged on this screen ('numbers',
 *   'taps', ...); only: judge just these checks; v2: also the v2 checks ('v2numbers', 'v2yellow', 'pink', 'radius',
 *   'covered', 'v2taps'; the result needs probe(..., { v2: true }))
 */
export function judge(r, { skip = [], only = null, v2 = false } = {}) {
  const fails = [];
  const on = (k) => !skip.includes(k) && (!only || only.includes(k));
  if (v2 && r.v2) {
    const x = r.v2;
    if (on('v2numbers') && x.numbersAll > LIMITS_V2.numbers) fails.push(`v2 numbers ${x.numbersAll} > ${LIMITS_V2.numbers} (top bar counted)`);
    if (on('v2yellow') && x.yellowFills.length > LIMITS_V2.yellow) fails.push(`${x.yellowFills.length} yellow fills (${x.yellowFills.slice(0, 3).join('; ')})`);
    if (on('pink') && x.pinkStrayCount) fails.push(`${x.pinkStrayCount} pink with no reason (${x.pinkStray.slice(0, 3).join('; ')})`);
    if (on('radius') && x.radiusCount) fails.push(`${x.radiusCount} rounded corners off a circle (${x.radius.slice(0, 3).join('; ')})`);
    if (on('covered') && x.coveredCount) fails.push(`${x.coveredCount} controls painted over (${x.covered.slice(0, 3).join('; ')})`);
    // the number printed is the number judged: both are tapMin, in 0.25 px steps
    if (on('v2taps') && x.tapMin != null && x.tapMin < LIMITS_V2.tap) fails.push(`tap ${x.tapMinText} px < ${LIMITS_V2.tap} px (${x.tapsUnder44Count}: ${x.tapsUnder44.slice(0, 3).join('; ')})`);
  }
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
    ...(r.overlaps?.length ? [`overlaps ${r.overlaps.length}`] : []),
    ...(r.v2 ? [summaryV2(r.v2)] : []),
  ].join(' · ');
}

/** [ui-ink] The v2 half of the line: "v2: numbers 9 · yellow 1 · pink 2 (stray 0) · radius 0 · covered 0 · tap min 44.00 (≥ 44)". */
export function summaryV2(x) {
  return `v2: numbers ${x.numbersAll} · yellow ${x.yellowFills.length} · pink ${x.pinkCount} (stray ${x.pinkStrayCount}) · radius ${x.radiusCount} · covered ${x.coveredCount} · tap min ${x.tapMinText ?? '–'} (asserts ≥ ${LIMITS_V2.tap}; ${x.tapsUnder44Count} under)`;
}

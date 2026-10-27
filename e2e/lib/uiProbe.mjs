// The UI condense DOM probe (docs/specs/UI_DIRECTION.md §8, gate 3), shared by the battle milestones' e2e and
// e2e/ui-shots.mjs: per screen, the visible numbers, the smallest visible text, truncated text, sideways overflow and
// the overlaps between named fixed boxes (the ability bar, the hero widget, the wave control, the feed, the panel,
// the tower bar…).
//
//   import { uiProbe, formatProbe } from './lib/uiProbe.mjs';
//   const p = await uiProbe(page, { boxes: { bar: '[data-testid="ability-bar"]', hero: '[data-testid="hero-widget"]' } });
//   p.numbers            visible text elements holding a digit (each counted once; canvas text is not in the DOM)
//   p.numberTexts        their texts (for the notes)
//   p.smallest           { px, text } the smallest computed font size of any visible text
//   p.truncated          [{ text, sel }] elements whose text is cut by an ellipsis
//   p.overflowX          the page scrolls sideways
//   p.overlaps           [{ a, b, area }] named boxes that overlap by more than 4 px²
//   p.boxes              { name: [{ x, y, w, h }] } the visible rects of each named box
//   drawerPathsInView(page)   the drawer's path rows and price buttons against its scroll body, the scroll cue (by the
//                             drawer's own rule: content below the fold, not scrollHeight), the open row's one line, each
//                             lock row's tier line and lock-line height
/**
 * @param {import('playwright').Page} page
 * @param {{ root?: string, boxes?: Record<string, string>, skip?: string }} [o]
 *   root: where to count numbers and text (default the whole document); skip: a selector whose subtree is ignored
 */
export async function uiProbe(page, { root = 'body', boxes = {}, skip = null } = {}) {
  return page.evaluate(({ root, boxes, skip }) => {
    const vw = innerWidth;
    const vh = innerHeight;
    const visible = (el) => {
      if (!el || !(el instanceof Element)) return false;
      if (skip && el.closest(skip)) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) return false;
      for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false;
        if (e.hidden) return false;
      }
      return true;
    };
    const sel = (el) => {
      const id = el.getAttribute('data-testid');
      if (id) return `[data-testid="${id}"]`;
      return `${el.tagName.toLowerCase()}${[...el.classList].slice(0, 2).map((c) => `.${c}`).join('')}`;
    };
    // (to the subpixel: scrollWidth is a whole number, and a 0.6 px overflow still draws an ellipsis; a button's
    // scrollWidth does not see its text overflow at all). Its text's width against its content box.
    const textOverflows = (el, cs) => {
      if (cs.whiteSpace !== 'nowrap' && cs.whiteSpace !== 'pre') return false;
      const rg = document.createRange();
      rg.selectNodeContents(el);
      const text = rg.getBoundingClientRect().width;
      const box = el.getBoundingClientRect().width - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)
        - (parseFloat(cs.borderLeftWidth) || 0) - (parseFloat(cs.borderRightWidth) || 0);
      return text > box + 0.05;
    };
    const base = document.querySelector(root) || document.body;
    const walker = document.createTreeWalker(base, NodeFilter.SHOW_TEXT);
    const numEls = new Set();
    const numberTexts = [];
    let smallest = { px: Infinity, text: '' };
    const truncated = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.nodeValue.trim();
      if (!text) continue;
      const el = n.parentElement;
      if (!visible(el)) continue;
      const px = parseFloat(getComputedStyle(el).fontSize) || 0;
      if (px > 0 && px < smallest.px) smallest = { px, text: text.slice(0, 40), sel: sel(el) };
      if (/\d/.test(text) && !numEls.has(el)) {
        numEls.add(el);
        numberTexts.push(text.slice(0, 32));
      }
    }
    for (const el of base.querySelectorAll('*')) {
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.textOverflow === 'ellipsis' && (el.scrollWidth > el.clientWidth + 1 || textOverflows(el, cs))) truncated.push({ text: el.textContent.trim().slice(0, 40), sel: sel(el) });
    }
    const rects = {};
    for (const [name, s] of Object.entries(boxes)) {
      rects[name] = [...document.querySelectorAll(s)].filter(visible).map((el) => {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
      });
    }
    const overlaps = [];
    const names = Object.keys(rects);
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        for (const a of rects[names[i]]) {
          for (const b of rects[names[j]]) {
            const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
            const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
            if (w > 0 && h > 0 && w * h > 4) overlaps.push({ a: names[i], b: names[j], area: w * h });
          }
        }
      }
    }
    const se = document.scrollingElement || document.documentElement;
    return {
      numbers: numEls.size,
      numberTexts,
      smallest: smallest.px === Infinity ? null : smallest,
      truncated,
      overflowX: se.scrollWidth > vw + 1,
      overlaps,
      boxes: rects,
    };
  }, { root, boxes, skip });
}

/**
 * The selected-girl drawer's path rows against its scroll body (UI_DIRECTION §6.6 "Paths: all 3 visible without
 * scrolling"; the M4 review look-1): each row and its price button (or MAX sticker / read-only price) inside the body's
 * rect, whether the body overflows and the scroll cue says so, and whether the open row stayed one whole line.
 * @param {import('playwright').Page} page
 * @returns {Promise<null | { rows: { path: number, armed: boolean, row: boolean, price: boolean|null, h: number,
 *   locked?: boolean, tier?: boolean, lockH?: number|null }[], allIn: boolean,
 *   armedIn: boolean|null, overflow: boolean, below: number, phantom: number, cue: boolean, openOneLine: boolean|null,
 *   body: number[] }>} below: px of content under the fold; phantom: scroll range past the content (tap areas only)
 */
export async function drawerPathsInView(page) {
  return page.evaluate(() => {
    const p = document.querySelector('[data-testid="tower-panel"]');
    const sc = p?.querySelector('.bt-panel-scroll');
    if (!p || p.hidden || !sc) return null;
    const a = sc.getBoundingClientRect();
    // (in view: the drawer's own rule, drawerView SCROLL_CUE_PX: a row whose last 2 px, its bottom padding, sit under
    // the fold still counts as in view, and the cue stays off; the check and the cue never disagree)
    const inside = (b) => b.top >= a.top - 1 && b.bottom <= a.bottom + 2;
    const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const rows = [...p.querySelectorAll('.bt-path')].map((r) => {
      const btn = r.querySelector('.bt-buy, .bt-dw-price, .bt-dw-max');
      const b = r.getBoundingClientRect();
      const row = { path: Number(r.dataset.path), armed: r.classList.contains('armed'), row: inside(b), price: btn ? inside(btn.getBoundingClientRect()) : null, h: Math.round(b.height) };
      if (r.classList.contains('locked')) {
        // a lock row: whether its tier line still shows, and how tall its lock line is (one line: the "i" or Show ›)
        const lock = [...r.querySelectorAll('.bt-path-lock, .bt-lock-final')].find(shown);
        row.locked = true;
        row.tier = shown(r.querySelector('.bt-path-tier'));
        row.lockH = lock ? Math.round(lock.getBoundingClientRect().height) : null;
      }
      return row;
    });
    const armed = rows.find((r) => r.armed) || null;
    const line = p.querySelector('.bt-path.armed .bt-path-chips');
    const tops = line ? [...line.children].map((c) => c.offsetTop) : [];
    // how far the body's content reaches below its scroll port: its children's rects, never scrollHeight (which also
    // counts the invisible ::after tap areas under the last row's "i" or price; the M4 re-review). The drawer's own
    // rule: drawerView.js contentBelow and SCROLL_CUE_PX (2 px: a row cut by its hairline counts as in view).
    const port = a.top + sc.clientTop + sc.clientHeight;
    const below = Math.max(-Infinity, ...[...sc.children].map((k) => k.getBoundingClientRect().bottom)) - port;
    return {
      rows,
      allIn: rows.length > 0 && rows.every((r) => r.row && r.price !== false),
      armedIn: armed ? armed.row && armed.price !== false : null,
      overflow: below > 2,
      below: Math.round(below),
      phantom: Math.max(0, Math.round(sc.scrollHeight - sc.clientHeight - sc.scrollTop - Math.max(0, below))),
      cue: p.classList.contains('bt-scroll-more') && getComputedStyle(p.querySelector('[data-testid="panel-scroll-cue"]')).display !== 'none',
      openOneLine: line ? line.scrollWidth <= line.clientWidth + 1 && tops.every((t) => Math.abs(t - tops[0]) <= 2) : null,
      // the open row's name line (its name, ⚡ chip and pips): one line
      armedTopH: armed ? Math.round(p.querySelector('.bt-path.armed .bt-path-top')?.getBoundingClientRect().height || 0) : null,
      body: [Math.round(a.top), Math.round(a.bottom)],
    };
  });
}

/** One line for a log: "numbers 9 · smallest 12px · 0 truncated · no sideways scroll · overlaps none". */
export function formatProbe(p) {
  const ov = p.overlaps.length ? p.overlaps.map((o) => `${o.a}×${o.b} ${o.area}px²`).join(', ') : 'none';
  const tr = p.truncated.length ? ` (${p.truncated.slice(0, 3).map((t) => `${t.sel} "${t.text}"`).join('; ')})` : '';
  return `numbers ${p.numbers} · smallest ${p.smallest ? `${p.smallest.px}px (${p.smallest.text} ${p.smallest.sel || ''})` : '–'} · ${p.truncated.length} truncated${tr} · ${p.overflowX ? 'SIDEWAYS SCROLL' : 'no sideways scroll'} · overlaps ${ov}`;
}

/** The battle HUD's fixed boxes (the overlap check of the ability bar milestone). */
export const BATTLE_BOXES = Object.freeze({
  bar: '[data-testid="ability-bar"]',
  hero: '[data-testid="hero-widget"]',
  wave: '.bt-wavectl',
  feed: '[data-testid="battle-feed"] .bt-toast',
  panel: '[data-testid="tower-panel"]',
  towerbar: '[data-testid="tower-bar"]',
});

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

/**
 * What a tap on each part of the girl drawer reaches (the M4 review, round r2: on a phone the target chips' hit areas
 * reached 14 px down over the stat row, so a tap on DMG or RATE changed her target, and over Iroha's MIRROR label). Hit
 * tested in the page (document.elementFromPoint) on a 2 px grid, inside the scroll body's port:
 *   dead   the stat row and the chip rows' labels (TARGET, STRIPS, MIRROR, BREW and her pick, FLIGHT): points that reach
 *          a control (none may)
 *   faces  every chip, FIRE and her ability's name: points of the control's own face that reach anything else (none may)
 *   chips  each chip's hit height and width, hit tested out from its centre
 *   foot   points of the scroll body (the rows above the footer) that reach a footer control, Sell or MORE (none may;
 *          the M4 review, round r3: Sell's hit area reached 8 px up over the last row's lock "i")
 * Also each path row's name line: its lines and whether its ⚡ chip sits on a line of its own.
 */
export async function drawerHits(page) {
  return page.evaluate(() => {
    const p = document.querySelector('[data-testid="tower-panel"]');
    const sc = p?.querySelector('.bt-panel-scroll');
    if (!p || p.hidden || !sc) return null;
    const port = sc.getBoundingClientRect();
    const CTL = 'button, [role="button"], [role="switch"], a[href], input';
    const ctlAt = (x, y) => {
      const n = document.elementFromPoint(x, y);
      const c = n?.closest?.(CTL);
      return { n, c: c && p.contains(c) ? c : null };
    };
    const name = (e) => (e ? e.getAttribute('data-testid') || e.getAttribute('data-mode') || String(e.className?.baseVal ?? e.className).split(' ')[0] : '-');
    const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
    // a box clipped to the scroll port (a part scrolled out of view takes no tap)
    const clip = (r) => ({ left: Math.max(r.left, port.left), right: Math.min(r.right, port.right), top: Math.max(r.top, port.top), bottom: Math.min(r.bottom, port.bottom) });
    const grid = (r, fn) => {
      for (let y = r.top + 0.5; y < r.bottom; y += 2) for (let x = r.left + 0.5; x < r.right; x += 2) fn(x, y);
    };
    const dead = [];
    const zones = [['stats', p.querySelector('[data-testid="drawer-stats"]')], ...[...sc.querySelectorAll('.bt-dw-row > .bt-dw-k, .bt-dw-row > .bt-buff-pick-now')].map((e) => [`label "${e.textContent.trim()}"`, e])];
    for (const [label, e] of zones) {
      if (!shown(e)) continue;
      const hits = {};
      grid(clip(e.getBoundingClientRect()), (x, y) => {
        const { c } = ctlAt(x, y);
        if (c) hits[name(c)] = (hits[name(c)] || 0) + 1;
      });
      if (Object.keys(hits).length) dead.push({ zone: label, hits });
    }
    const faces = [];
    for (const e of p.querySelectorAll('.bt-tchip, [data-testid="ability-fire"], [data-testid="ability-row-name"]')) {
      if (!shown(e)) continue;
      const r = e.getBoundingClientRect();
      const box = clip({ left: r.left + 1, right: r.right - 1, top: r.top + 1, bottom: r.bottom - 1 });
      const other = {};
      grid(box, (x, y) => {
        const { n } = ctlAt(x, y);
        if (!n || (n !== e && !e.contains(n))) {
          const k = name(n?.closest?.(CTL) || n);
          other[k] = (other[k] || 0) + 1;
        }
      });
      if (Object.keys(other).length) faces.push({ face: `${name(e)} "${e.textContent.trim().slice(0, 16)}"`, covered: other });
    }
    const foot = {};
    const footEl = p.querySelector('.bt-panel-foot');
    if (footEl) {
      const fr = footEl.getBoundingClientRect();
      grid(clip({ left: port.left, right: port.right, top: port.top, bottom: Math.min(port.bottom, fr.top) }), (x, y) => {
        const { c } = ctlAt(x, y);
        if (c && footEl.contains(c)) foot[name(c)] = (foot[name(c)] || 0) + 1;
      });
    }
    const chips = [...p.querySelectorAll('.bt-tchip')].filter(shown).map((e) => {
      const r = e.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const on = (x, y) => { const n = document.elementFromPoint(x, y); return !!n && (n === e || e.contains(n)); };
      let up = 0; while (up < 30 && on(cx, cy - up - 1)) up++;
      let dn = 0; while (dn < 30 && on(cx, cy + dn + 1)) dn++;
      let lf = 0; while (lf < 60 && on(cx - lf - 1, cy)) lf++;
      let rt = 0; while (rt < 60 && on(cx + rt + 1, cy)) rt++;
      return { chip: e.textContent.trim() || name(e), h: Math.round(r.height), hitH: up + dn + 1, hitW: lf + rt + 1 };
    });
    const lines = (e) => {
      const rg = document.createRange();
      rg.selectNodeContents(e);
      const rs = [...rg.getClientRects()].filter((q) => q.width > 0.5).sort((a, b) => a.top - b.top);
      let n = 0;
      let lb = -1e9;
      for (const q of rs) if (q.top >= lb - 3) { n++; lb = q.bottom; } else lb = Math.max(lb, q.bottom);
      return n;
    };
    const names = [...p.querySelectorAll('.bt-path')].map((row) => {
      const nm = row.querySelector('.bt-path-name');
      const bolt = row.querySelector('.bt-path-bolt');
      const nr = nm.getBoundingClientRect();
      const br = shown(bolt) ? bolt.getBoundingClientRect() : null;
      return { path: Number(row.dataset.path), name: nm.textContent.trim(), lines: lines(nm), px: parseFloat(getComputedStyle(nm).fontSize), boltOwnLine: br ? br.top >= nr.bottom - 3 : false, rowH: Math.round(row.getBoundingClientRect().height) };
    });
    return { dead, faces, foot: Object.keys(foot).length ? foot : null, chips, minChipH: chips.length ? Math.min(...chips.map((c) => c.hitH)) : null, names };
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

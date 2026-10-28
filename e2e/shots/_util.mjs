// Helpers the per-milestone shot lists share (e2e/shots/*.mjs, read by e2e/ui-shots.mjs and judged by e2e/menus.mjs).
// A shot is { hash, ready, kind?, list?, open?(page), prepare?(page), settleMs?, limit?, dense?, rebuilt?, note? }:
//   limit    the most numbers the v2 probe may count on it (top bar counted; default 10, the after board's own where
//            UI_V2_MENUS.md section 3 allows more, e.g. stage prep 11, the girl's Gear tab 12)
//   dense    selectors of rows the milestone names as dense: their taps may be 40 px instead of 44
//   rebuilt  the screen's surfaces are rebuilt in v2 (the radius check, S5, applies)

/** A layer that really opened: a kit sheet or a modal (never the hidden rotate prompt, which is a role=dialog too). */
export const LAYER = '.ui-layer .ui-sheet, .ui-sheet.on, .modal-overlay:not(.rotate-overlay) .modal';

/** A ready test for a screen id (`#app[data-screen]`). */
export const isScreen = (id) => `() => document.querySelector('#app')?.dataset.screen === '${id}'`;

/** Clicks `sel` and waits for `waitFor` (default: the same selector's sheet or dialog, any). */
export const clickOpen = (sel, waitFor = LAYER, { force = false } = {}) => async (page) => {
  // (force: the element's own click(), whatever paints over it: an earlier shot's sheet left open)
  if (force) await page.$eval(sel, (el) => el.click());
  else await page.click(sel, { timeout: 10000 });
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 10000, state: 'visible' });
};

/** Clicks each selector in turn (a tab, then a row), waiting a beat between. */
export const clicks = (...sels) => async (page) => {
  for (const s of sels) {
    await page.click(s, { timeout: 10000 });
    await page.waitForTimeout(450);
  }
};

/** Scrolls the screen's scroller (or `sel`) to its end (`to` 'end') or by `to` px. */
export const scrollBody = (to = 'end', sel = '#app .screen-body') => (page) => page.evaluate(([t, s]) => {
  const b = [...document.querySelectorAll(s)].find((e) => e.scrollHeight > e.clientHeight + 4) || document.querySelector(s);
  if (!b) return;
  // (the deepest scroller inside it that really scrolls, when the body itself does not)
  const inner = b.scrollHeight > b.clientHeight + 4 ? b : [...b.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY));
  const el = inner || b;
  el.scrollTop = t === 'end' ? el.scrollHeight : el.scrollTop + t;
}, [to, sel]);

/** The game's hold gesture (450 ms) on the first `sel`. */
export const holdOn = (sel, waitFor = LAYER) => async (page) => {
  const target = page.locator(sel).first();
  // (the same hash as the shot before keeps its scroll: bring the target into view first)
  await target.scrollIntoViewIfNeeded({ timeout: 10000 });
  const box = await target.boundingBox();
  if (!box) throw new Error(`nothing to hold: ${sel}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 10000, state: 'visible' });
};

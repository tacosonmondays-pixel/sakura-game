// UI M5b: the hubs with host girls (docs/specs/UI_DIRECTION.md §5.10 E1, §6.5; notes/ui-m5/PLAN.md §5 M5b), on two
// saves: the ui-shots save (chapters 1-3: Total Assault still locked) and a late veteran (everything open), at five
// sizes: 844x390 and 1280x720 (the milestone's two), the small landscape phones 667x375 (iPhone SE / 8) and 740x360
// (a common Android), and portrait 390x844 (the M5b review found all three unprobed); since the UI M5 final review
// also the common landscape phones 915x412 and 932x430 and the tablets in landscape 1024x768, 1024x600 and 1180x820.
// On the six hosted screens (Missions; Commissions on Daily, Weekly, Codes and its Login tab; Bounty; Total Assault;
// Titan Trials):
//   1. the probe (e2e/probe.mjs) passes: text ≥ 12 / 13 px, ≤ 12 numbers, no "…" on a number, no sideways scroll,
//      a content window ≥ 300 px, ≤ 1 yellow primary, taps ≥ 40 px (the shared top bar aside, §5.3 tabs 44 × 36),
//      and its clip check (no words cut off or run under a neighbour; portrait only until the UI M5 final review)
//   2. the host is the right girl, on the collapse rule (host.js): from 800 px of width her stand within 35%; under it
//      (or a short content window) her bust chip at the start of a header row with NO host column, the list or grid
//      taking the whole width; in portrait no host (the M5b rule) and a plate header shows its title again, on one
//      line, its words (their own line boxes, not the title's box) clear of every chip and button on its right
//   3. her bubble holds one line of ≤ 34 characters and covers no tile, list row or panel content
//   4. a tap on the bubble shows the next line; under Reduce motion the bubble does not animate (with motion: it pops)
//   5. one [data-primary] at most, the yellow one, and it is in view (Prepare / Challenge / Fight stay in view)
//   6. no title, line, label or rule is cut (an ellipsis or a clipping box) on the tiles, headers, footers and cards
//   7. Sweep is the secondary button (§5.5: white glass), its disabled state --sky-1 with a lock and one reason line,
//      never opacity; reward counts and gated drop labels never run into a neighbour, nor a boss card's words under
//      its lock or medals
//   8. no slanted tile, card or button has a corner cut flat by a scroller or the screen body (the UI M5 final review)
// Achievements (§6.5): no host; Ready first; Done collapsed; ≤ 12 + 2 visible numbers counted the audit's way;
// no "1/1" or "×1" and no bar on a ready row; ONE count (rows ready) in the Ready header, Claim all's pill and the
// category sheet, in every category; Claim all claims the picked category only and is gone where nothing is ready; the
// case button says "Ribbons"; a row opens its ladder sheet; the category sheet has 12 categories; the whole list
// scrolls at most 10 screens. The Honor Ribbon Case, the Titles sheet, Total Assault's intel sheet and Titan Trials'
// MORE sheet pass the text floor. Campaign: a stage card holds ≤ 2 numbers and no waves, ribbons, rule or mechanic chips.
//
//   node e2e/hubs.mjs [--viewport 844x390[,1024x768,...]] [--save shots|late] [--shots <dir>] [--port 5214]
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 on any failure.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchChromium } from './browser.mjs';
import { probe, judge, summary } from './probe.mjs';
import { seedUiSave, SHOT_NOW } from './uiSeed.mjs';
import { veteran } from '../tests/fixtures/veterans.js';
import { SAVE_KEY } from '../src/systems/save.js';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
// (the UI M5 final review added the common landscape phones 915x412 and 932x430, and the tablets in landscape 1024x768,
// 1024x600 and 1180x820: the 1000-1279 px widths, where its four findings hid while every gate passed)
const viewports = opt('viewport', null) ? opt('viewport').split(',').map((s) => s.trim()).filter(Boolean)
  : ['844x390', '1280x720', '667x375', '740x360', '390x844', '915x412', '932x430', '1024x768', '1024x600', '1180x820'];
const saves = opt('save', null) ? [opt('save')] : ['shots', 'late'];
const PORT = Number(opt('port', '0'));
const shots = opt('shots', null);
if (shots) mkdirSync(shots, { recursive: true });

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${msg}`);
  if (!ok) failures++;
  return ok;
};

/**
 * The hosted screens: the route, the host (a unit id, or a function of the page), what her bubble must stay clear of
 * (`clear`: as a stand; `rows`: the list's rows or tiles, as a chip in the list's own header), the list or grid that
 * must take the whole width as a chip (`main`), and the boxes whose words must never be cut (`whole`).
 */
const HOSTED = [
  { name: 'missions', hash: '#/missions', screen: 'missions', host: 'secretary', clear: '.ma-hub-grid', rows: '.ma-hub-grid', list: '.ma-hub-grid', main: '.ma-hub-grid', whole: '.ma-hub-tile' },
  { name: 'commissions-daily', hash: '#/commissions?tab=daily', screen: 'commissions', host: 'miko', clear: '.cm-panel, .cm-tabs', rows: '.ma-mission-list, .cm-tabs', list: '.cm-panel', main: '.cm-panel', whole: '.cm-tabs, .cm-panel .ui-plate-head, .cm-rwd' },
  { name: 'commissions-weekly', hash: '#/commissions?tab=weekly', screen: 'commissions', host: 'miko', clear: '.cm-panel, .cm-tabs', rows: '.ma-mission-list, .cm-tabs', list: '.cm-panel', main: '.cm-panel', whole: '.cm-tabs, .cm-panel .ui-plate-head, .cm-rwd' },
  { name: 'commissions-codes', hash: '#/commissions?tab=codes', screen: 'commissions', host: 'miko', clear: '.cm-panel, .cm-tabs', rows: '.ma-code-row, .cm-codes-line, .cm-tabs', list: '.cm-panel', main: '.cm-panel', whole: '.cm-tabs, .cm-panel .ui-plate-head' },
  { name: 'commissions-login', hash: '#/commissions?tab=login', screen: 'commissions', host: 'miko', clear: '.cm-panel, .cm-tabs', rows: '.cm-calendar, .cm-tabs', list: '.cm-panel', main: '.cm-panel', whole: '.cm-tabs, .cm-panel .ui-plate-head, .cm-rwd' },
  { name: 'bounty', hash: '#/bounty', screen: 'bounty', host: 'guest', clear: '.bn-panel', rows: '.ma-loc-list, .bn-footer', list: '.bn-panel', main: '.bn-panel', whole: '.bn-panel > .ui-plate-head, .bn-footer, .ma-drop, .ma-tier-btn' },
  { name: 'assault', hash: '#/assault', screen: 'assault', host: 'rei', clear: '.as-panel', rows: '.ma-boss-cards, .ma-boss-detail, .as-actions', list: '.as-panel', main: '.as-panel', whole: '.as-panel > .ui-plate-head, .as-actions, .ma-drop, .ma-boss-card' },
  { name: 'titans', hash: '#/titans', screen: 'titans', host: 'kaede', clear: '.tt-cards, .tt-side, .tt-show, .tt-top', rows: '.tt-cards, .tt-detail, .tt-actions', list: '.tt-side', main: '.tt-wrap', whole: '.tt-top, .tt-card, .tt-actions' },
];

const server = await createServer({ root: process.cwd(), server: { port: PORT, strictPort: PORT > 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser, label } = await launchChromium();
console.log(`browser: ${label}; clock: ${SHOT_NOW}`);

const settle = (page, ms = 700) => page.waitForTimeout(ms)
  .then(() => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 200))))));

async function go(page, hash, screen) {
  await page.evaluate((hh) => { location.hash = hh; }, hash);
  await page.waitForFunction((s) => document.querySelector('#app')?.dataset.screen === s, screen, { timeout: 60000 });
  await page.waitForFunction(() => !document.documentElement.dataset.tx && !document.querySelector('.ld-chip.on'), null, { timeout: 60000 }).catch(() => {});
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 }).catch(() => {});
  await settle(page);
}

/** A context on a save: 'shots' (the ui-shots save, seeded after load) or 'late' (a veteran, stored before load). */
async function open(save, vp, motion = 'reduce') {
  const [W, H] = vp.split('x').map(Number);
  const touch = W < 1000;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, reducedMotion: motion, deviceScaleFactor: 1, timezoneId: 'America/Chicago' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (page.clock?.setFixedTime) await page.clock.setFixedTime(new Date(SHOT_NOW));
  await page.addInitScript(() => {
    const css = '.toast-host, .jn-toast { display: none !important; }';
    document.addEventListener('DOMContentLoaded', () => document.head.append(Object.assign(document.createElement('style'), { textContent: css })));
    sessionStorage.setItem('sakura-title-seen', '1');
  });
  if (save === 'late') {
    const p = veteran('late');
    await page.addInitScript(([key, text]) => {
      if (!sessionStorage.getItem('hubs-seeded')) {
        localStorage.clear();
        localStorage.setItem(key, text);
        sessionStorage.setItem('hubs-seeded', '1');
      }
    }, [SAVE_KEY, JSON.stringify(p)]);
  }
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load', timeout: 120000 });
  if (save === 'shots') {
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load', timeout: 120000 });
  }
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 60000 });
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 8000 }).catch(() => null);
  if (later) await later.click({ force: true, timeout: 15000 }).catch(() => {});
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));
  if (save === 'shots') await seedUiSave(page, true);
  return { ctx, page, errors, touch };
}

/** Who should host `s` on this save (the same rules as src/ui/hosts.js, read from the page's own modules). */
const expectedHost = (page, s) => page.evaluate(async (host) => {
  const { hostFor } = await import('/src/ui/hosts.js');
  const { ARENA_GUEST } = await import('/src/ui/lobby/notice.js');
  const { currentEvent } = await import('/src/systems/missions.js');
  const p = window.__sakura.store.profile;
  if (host === 'secretary') return hostFor('missions', p);
  if (host === 'guest') return hostFor('bounty', p, { guest: ARENA_GUEST[currentEvent().arena] });
  return host;
}, s.host);

/** The mode the collapse rule asks for on this screen at this viewport (Titan Trials counts its titan row). */
const ruleMode = (page, s) => page.evaluate(async (name) => {
  if (name === 'titans') return (await import('/src/ui/screens/titans.js')).titanHostMode();
  // (Missions' tiles need the width too: hubHost.js WIDE_GRID_VW)
  if (name === 'missions') return (await import('/src/ui/screens/missions.js')).missionsHostMode();
  const { hubMode, viewport } = await import('/src/ui/hubHost.js');
  return hubMode(viewport());
}, s.name);

/**
 * The host, her bubble, what the bubble covers, where she sits. `over`: the `clear` elements (a stand) or the `rows`
 * elements (a chip, which sits inside the list's own header) the bubble overlaps.
 */
const hostInfo = (page, s) => page.evaluate(({ clear, rows, main }) => {
  const el = document.querySelector('#app [data-testid="host"]');
  if (!el) return null;
  const shown = el.getClientRects().length > 0;
  const r = el.getBoundingClientRect();
  const b = el.querySelector('.ui-host-bubble');
  const br = b.getBoundingClientRect();
  const line = el.querySelector('.ui-host-line');
  const bust = el.querySelector('.ui-host-bust').getBoundingClientRect();
  const chip = el.dataset.mode === 'chip';
  const overlaps = (sel) => [...document.querySelectorAll(sel)].filter((x) => x.getClientRects().length && !x.contains(el)).filter((x) => {
    const o = x.getBoundingClientRect();
    return Math.min(br.right, o.right) - Math.max(br.left, o.left) > 0.5 && Math.min(br.bottom, o.bottom) - Math.max(br.top, o.top) > 0.5;
  }).map((x) => x.className.split(' ')[0]);
  const m = document.querySelector(`#app ${main}`)?.getBoundingClientRect();
  const hb = el.closest('.hb, .ma-hub');
  return {
    id: el.dataset.host, mode: el.dataset.mode, shown, share: r.width / innerWidth, line: line.textContent, boxes: line.getClientRects().length,
    bust: [Math.round(bust.width), Math.round(bust.height)], over: shown ? overlaps(chip ? rows : clear) : [], bubble: [Math.round(br.width), Math.round(br.height)],
    inView: !shown || (bust.top >= 0 && bust.bottom <= innerHeight + 0.5 && br.right <= innerWidth + 0.5 && br.bottom <= innerHeight + 0.5),
    header: el.parentElement?.classList.contains('has-host') ? el.parentElement.className.split(' ').find((c) => c !== 'has-host') : null,
    column: !!hb && !hb.classList.contains('no-host'),
    mainShare: m ? Math.round((m.width / innerWidth) * 100) / 100 : null,
    anim: getComputedStyle(b).animationName,
  };
}, { clear: s.clear, rows: s.rows, main: s.main });

/** The [data-primary] buttons on screen, whether each is yellow, and whether it is in view. */
const primaries = (page) => page.evaluate(() => [...document.querySelectorAll('#app [data-primary]')].filter((e) => e.getClientRects().length && !e.disabled).map((e) => {
  const r = e.getBoundingClientRect();
  return { text: e.textContent.trim(), yellow: e.classList.contains('btn-yellow') || /255, 2[0-4]\d, \d{1,2}\)/.test(getComputedStyle(e).backgroundImage + getComputedStyle(e).backgroundColor), inView: r.top >= 0 && r.bottom <= innerHeight + 0.5 };
}));

/**
 * Words cut short inside `sel`: an ellipsis, a box too small for its own words, or words reaching past a box that
 * clips them (a scroller's own overflow is scrolling, not cutting). Visible text only.
 */
const cutWords = (page, sel) => page.evaluate((selector) => {
  const out = [];
  const range = document.createRange();
  for (const box of document.querySelectorAll(`#app ${selector}`)) {
    if (!box.getClientRects().length) continue;
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!/\S/.test(n.nodeValue)) continue;
      const el = n.parentElement;
      if (!el || el.closest('[aria-hidden="true"], .ui-kbd, .has-host > .ui-plate-title')) continue;
      if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (!r.width || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
      const cs = getComputedStyle(el);
      const tag = `${el.className || el.tagName} "${n.nodeValue.trim().slice(0, 28)}"`;
      if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) { out.push(`… ${tag}`); continue; }
      if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip') && el.scrollWidth > el.clientWidth + 1) { out.push(`cut ${tag}`); continue; }
      let sx = false;
      let sy = false;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const ac = getComputedStyle(a);
        const cx = !sx && (ac.overflowX === 'hidden' || ac.overflowX === 'clip');
        const cy = !sy && (ac.overflowY === 'hidden' || ac.overflowY === 'clip');
        if (ac.overflowX === 'auto' || ac.overflowX === 'scroll') sx = true;
        if (ac.overflowY === 'auto' || ac.overflowY === 'scroll') sy = true;
        if (!cx && !cy) continue;
        const ar = a.getBoundingClientRect();
        if ((cx && (r.left < ar.left - 2 || r.right > ar.right + 2)) || (cy && (r.top < ar.top - 2 || r.bottom > ar.bottom + 2))) {
          out.push(`clipped ${tag}`);
          break;
        }
      }
    }
  }
  return [...new Set(out)];
}, sel);

/** Labels that run into each other: reward counts under their tiles, a gated drop's tier under its tile. */
const collisions = (page) => page.evaluate(() => {
  const els = [...document.querySelectorAll('#app .cm-rwd-n, #app .ma-drop-chance, #app .cm-rwd > .item-tile, #app .ma-drop > .item-tile')].filter((e) => e.getClientRects().length);
  const rects = els.map((e) => [e, e.getBoundingClientRect()]);
  const out = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const [a, ra] = rects[i];
      const [b, rb] = rects[j];
      if (a.contains(b) || b.contains(a) || a.closest('.cm-rwd, .ma-drop') === b.closest('.cm-rwd, .ma-drop')) continue;
      if (Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left) > 0.5 && Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top) > 0.5) out.push(`${a.textContent.trim() || 'tile'} × ${b.textContent.trim() || 'tile'}`);
    }
  }
  return out.slice(0, 6);
});

/**
 * Total Assault's boss cards: the words of a card (its name, its requirement or HP; their line boxes less a quarter of
 * the font size of air above and below, as the probe's clip check) that run under the card's lock or medal pill.
 */
const cardMarks = (page) => page.evaluate(() => {
  const range = document.createRange();
  const out = [];
  for (const c of document.querySelectorAll('#app .ma-boss-card')) {
    const marks = [...c.querySelectorAll('.ma-boss-card-lock, .ma-boss-card-medals')].filter((x) => x.getClientRects().length).map((x) => [x, x.getBoundingClientRect()]);
    if (!marks.length) continue;
    const walker = document.createTreeWalker(c.querySelector('.ma-boss-card-text') || c, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!/\S/.test(n.nodeValue)) continue;
      const air = 0.25 * (parseFloat(getComputedStyle(n.parentElement).fontSize) || 12);
      range.selectNodeContents(n);
      for (const l of range.getClientRects()) {
        for (const [x, r] of marks) {
          const a = Math.max(0, Math.min(l.right, r.right) - Math.max(l.left, r.left)) * Math.max(0, Math.min(l.bottom - air, r.bottom) - Math.max(l.top + air, r.top));
          if (a > 0.5) out.push(`"${n.nodeValue.trim()}" under ${String(x.getAttribute('class')).split(' ')[0]} (${Math.round(a)} px²)`);
        }
      }
    }
  }
  return [...new Set(out)];
});

/**
 * Slanted (skewX) pieces that paint something (a tile, a card, a button) with a corner cut flat by a scroller or the
 * screen body: the part past that box's edge on an axis it does not scroll (the UI M5 final review, M5-2: Titan
 * Trials' scroller sliced the titan cards' and the Titan shelf button's corners at every size; the tablet chip's tall
 * Mission tile met the screen's edge). A piece clipped by its own card (a corner ribbon, a plate flush with its card's
 * edge) is the card's design and is left out.
 */
const skewCuts = (page) => page.evaluate(() => {
  const out = [];
  const name = (e) => `${e.tagName.toLowerCase()}.${String(e.className?.baseVal ?? e.className).split(' ').filter(Boolean).slice(0, 2).join('.')}${e.dataset?.testid ? `[${e.dataset.testid}]` : ''}`;
  for (const el of document.querySelectorAll('#app *')) {
    const cs = getComputedStyle(el);
    const t = cs.transform;
    if (!t || !t.startsWith('matrix(') || Math.abs(parseFloat(t.slice(7).split(',')[2])) <= 0.01) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8 || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    if (el.closest('[aria-hidden="true"]') && !el.closest('button')) continue;
    const paints = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || parseFloat(cs.borderLeftWidth) > 0 || cs.boxShadow !== 'none';
    if (!paints) continue;
    let a = el.parentElement;
    while (a && a !== document.documentElement) {
      const s = getComputedStyle(a);
      if (s.overflowX !== 'visible' || s.overflowY !== 'visible' || s.clipPath !== 'none') break;
      a = a.parentElement;
    }
    if (!a || a === document.documentElement || a === document.body) continue;
    const s = getComputedStyle(a);
    const scrollsX = /auto|scroll/.test(s.overflowX);
    const scrollsY = /auto|scroll/.test(s.overflowY);
    if (!scrollsX && !scrollsY && !a.matches('.screen-body')) continue; // (its own card: the card's design)
    const ar = a.getBoundingClientRect();
    const L = ar.left + parseFloat(s.borderLeftWidth);
    const R = ar.right - parseFloat(s.borderRightWidth);
    const T = ar.top + parseFloat(s.borderTopWidth);
    const B = ar.bottom - parseFloat(s.borderBottomWidth);
    const hits = [];
    if (!scrollsX && L - r.left > 0.75 && r.right > L + 4) hits.push(`L ${(L - r.left).toFixed(1)}`);
    if (!scrollsX && r.right - R > 0.75 && r.left < R - 4) hits.push(`R ${(r.right - R).toFixed(1)}`);
    if (!scrollsY && T - r.top > 0.75 && r.bottom > T + 4) hits.push(`T ${(T - r.top).toFixed(1)}`);
    if (!scrollsY && r.bottom - B > 0.75 && r.top < B - 4) hits.push(`B ${(r.bottom - B).toFixed(1)}`);
    if (hits.length) out.push(`${name(el)} cut ${hits.join(',')} by ${name(a)}`);
  }
  return [...new Set(out)];
});

/** The Sweep buttons: secondary (white glass), and when disabled: --sky-1, opaque, a lock and one reason line. */
const sweeps = (page) => page.evaluate(() => [...document.querySelectorAll('#app [data-testid$="-sweep"]')].filter((e) => e.getClientRects().length).map((e) => {
  const cs = getComputedStyle(e);
  const why = e.parentElement?.classList.contains('ui-sec-wrap') ? e.parentElement.querySelector('.ui-sec-why') : null;
  return {
    id: e.dataset.testid, secondary: e.classList.contains('ui-sec') && cs.backgroundImage === 'none', disabled: e.disabled, opacity: Number(cs.opacity), bg: cs.backgroundColor,
    lock: !!e.querySelector('.ui-sec-ico'), why: why?.textContent || '', whyLines: why ? Math.round(why.getBoundingClientRect().height / parseFloat(getComputedStyle(why).lineHeight || '16')) : 0,
  };
}));

/**
 * Each shown plate title, measured on its words: `words` the x range of its text, `lines` its line boxes (one per
 * distinct line), `under` each item of the header's right side (a child of .ui-plate-right: the balance, a chip, a
 * button) that a line of its words overlaps (with the px² of the overlap), `past` a line reaching past the header.
 */
const plateTitles = (page) => page.evaluate(() => {
  const range = document.createRange();
  return [...document.querySelectorAll('#app .ui-plate-head .ui-plate-title')].filter((e) => e.getClientRects().length).map((e) => {
    range.selectNodeContents(e);
    const rects = [...range.getClientRects()].filter((l) => l.width > 0.5 && l.height > 0.5);
    const lines = [];
    for (const l of rects) {
      // (the span and its text give a rect each per line: one line per distinct row)
      const row = lines.find((x) => Math.min(x.bottom, l.bottom) - Math.max(x.top, l.top) > Math.min(x.bottom - x.top, l.bottom - l.top) / 2);
      if (row) Object.assign(row, { left: Math.min(row.left, l.left), right: Math.max(row.right, l.right), top: Math.min(row.top, l.top), bottom: Math.max(row.bottom, l.bottom) });
      else lines.push({ left: l.left, right: l.right, top: l.top, bottom: l.bottom });
    }
    const head = e.parentElement.getBoundingClientRect();
    const items = [...(e.parentElement.querySelector('.ui-plate-right')?.children || [])].filter((k) => k.getClientRects().length);
    const under = [];
    for (const k of items) {
      const kr = k.getBoundingClientRect();
      const area = lines.reduce((a, l) => a + Math.max(0, Math.min(l.right, kr.right) - Math.max(l.left, kr.left)) * Math.max(0, Math.min(l.bottom, kr.bottom) - Math.max(l.top, kr.top)), 0);
      if (area > 0.5) under.push(`${String(k.className).split(' ')[0] || k.tagName.toLowerCase()} ${Math.round(area)} px²`);
    }
    return {
      text: e.innerText.trim(), w: e.getBoundingClientRect().width, lines: lines.length,
      words: lines.length ? [Math.round(Math.min(...lines.map((l) => l.left))), Math.round(Math.max(...lines.map((l) => l.right)))] : [],
      under, past: lines.some((l) => l.right > head.right + 0.5 || l.left < head.left - 0.5),
    };
  });
});

async function hostedScreen(page, s, vp, save) {
  await go(page, s.hash, s.screen);
  const [W, H] = vp.split('x').map(Number);
  const portrait = H > W;
  const r = await probe(page, { kind: 'hub', list: s.list, tapSkip: '.topbar' });
  const h1 = await hostInfo(page, s);
  const chip = h1?.mode === 'chip';
  // (the probe's clip check too: words cut off, or run under a neighbour, as on the list screens. Portrait only until
  // the UI M5 final review found "★ Titan of the Week" 40 px under its token at 1024x768, in landscape)
  const fails = judge(r, { skip: chip || portrait ? ['host', 'bubble'] : ['bubble'], also: ['clip'] });
  check(fails.length === 0, `${s.name}: probe ${summary(r)}${fails.length ? ` → ${fails.join(' | ')}` : ''}`);
  if (!check(!!h1, `${s.name}: a host girl is on the screen`)) return;
  const want = await expectedHost(page, s);
  check(h1.id === want, `${s.name}: the host is ${want} (${h1.id})`);
  const rule = await ruleMode(page, s);
  check(h1.mode === rule, `${s.name}: her mode is the collapse rule's (${h1.mode}, rule: ${rule})`);
  const cut = await cutWords(page, s.whole);
  check(cut.length === 0, `${s.name}: no word cut short on its tiles, headers, footers or cards${cut.length ? ` (${cut.slice(0, 4).join(' | ')})` : ''}`);
  const col = await collisions(page);
  check(col.length === 0, `${s.name}: no count or drop label runs into a neighbour${col.length ? ` (${col.join(' | ')})` : ''}`);
  if (s.name === 'assault') {
    const marks = await cardMarks(page);
    check(marks.length === 0, `assault: no boss card's name or line runs under its lock or medals${marks.length ? ` (${marks.slice(0, 4).join(' | ')})` : ''}`);
  }
  const sk = await skewCuts(page);
  check(sk.length === 0, `${s.name}: no slanted tile, card or button has a corner cut flat by a scroller or the screen${sk.length ? ` (${sk.slice(0, 4).join(' | ')})` : ''}`);
  const sw = await sweeps(page);
  for (const x of sw) {
    check(x.secondary && x.opacity === 1, `${s.name}: ${x.id} is the secondary button, never faded (opacity ${x.opacity})`);
    if (x.disabled) check(x.bg === 'rgb(234, 246, 255)' && x.lock && x.why && x.whyLines === 1, `${s.name}: disabled ${x.id}: --sky-1, a lock and one reason line ("${x.why}", ${x.bg})`);
  }
  const pr = await primaries(page);
  check(pr.length <= 1 && pr.every((p) => p.yellow), `${s.name}: one [data-primary], the yellow one (${pr.map((p) => p.text).join(' | ') || 'none here'})`);
  check(pr.every((p) => p.inView), `${s.name}: the primary is in view without scrolling${pr.some((p) => !p.inView) ? ` (${pr.map((p) => p.text).join(' | ')})` : ''}`);
  if (portrait) {
    // portrait: no host (the M5b rule); a plate header that would hold her shows its title on one line, clear of
    // everything on its right. Measured on the title's words themselves (Range.getClientRects: the text's line boxes),
    // never the h3's box: flex can shrink the h3 under its words, which then run on past it, under the balance chip
    // (Bounty's "Location Sele|ct" at 390x844, the final M5 review)
    const pt = await plateTitles(page);
    check(!h1.shown, `${s.name}: portrait: no host on the hub (the M5b rule)`);
    check(pt.every((t) => t.w > 1 && t.lines === 1 && !t.under.length && !t.past), `${s.name}: portrait: the plate title shows on one line, its words clear of every chip and button on its right (${pt.map((t) => `"${t.text}" ${t.lines} line, words ${t.words.join('-')}${t.under.length ? `, under ${t.under.join(', ')}` : ''}${t.past ? ', past the header' : ''}`).join('; ') || 'no plate'})`);
    if (shots) await page.screenshot({ path: join(shots, `${s.name}-${save}-${vp}.png`) });
    return;
  }
  if (chip) {
    // the collapse rule's chip: in a header row, no host column, the list or grid the whole width, all of her in view
    check(!!h1.header && !h1.column, `${s.name}: the chip sits in a header row (${h1.header}) and the hub keeps no host column`);
    check(h1.mainShare >= 0.9, `${s.name}: the list takes the whole width (${Math.round(h1.mainShare * 100)}% of the screen)`);
    check(h1.bust[0] === 40 && h1.bust[1] === 40 && h1.inView, `${s.name}: her 40 px bust and her bubble are in view (${h1.bust.join('x')})`);
  } else {
    check(h1.share <= 0.355, `${s.name}: she takes ${(h1.share * 100).toFixed(1)}% of the width (≤ 35%)`);
  }
  check(h1.line.length > 0 && h1.line.length <= 34 && h1.boxes === 1, `${s.name}: one line in her bubble, ≤ 34 characters ("${h1.line}", ${h1.line.length}, ${h1.boxes} line box)`);
  check(h1.over.length === 0, `${s.name}: the bubble covers no tile, list row or panel${h1.over.length ? ` (over ${h1.over.join(', ')})` : ''}`);
  // a tap shows the next line; no bounce under Reduce motion
  await page.click('#app [data-testid="host-bubble"]');
  await page.waitForTimeout(80);
  const h2 = await hostInfo(page, s);
  const many = await page.evaluate(() => document.querySelector('#app [data-testid="host-bubble"]').getAttribute('aria-label').includes('tap for the next line'));
  check(!many || h2.line !== h1.line, `${s.name}: a tap shows the next line ("${h2.line}")`);
  check(h2.anim === 'none', `${s.name}: no bounce under Reduce motion (animation ${h2.anim})`);
  check(h2.boxes === 1 && h2.over.length === 0 && h2.inView, `${s.name}: the next line is one line too and stays clear`);
  if (shots) await page.screenshot({ path: join(shots, `${s.name}-${save}-${vp}.png`) });
  if (s.name === 'commissions-login') await loginStamp(page, vp, save);
  if (s.name === 'assault') await sheetFloor(page, 'assault-more', 'assault-intel', `assault-intel-${save}-${vp}`);
  if (s.name === 'titans') await sheetFloor(page, 'titan-more', 'titan-details', `titans-more-${save}-${vp}`);
}

/** A Details sheet opened by MORE passes the text floor (12 / 13 px) and the probe's other checks. */
async function sheetFloor(page, moreId, sheetId, shotName) {
  const more = await page.$(`#app [data-testid="${moreId}"]`);
  if (!more) {
    console.log(`  (${sheetId}: no MORE on this save)`);
    return;
  }
  await more.click();
  const sheet = await page.waitForSelector(`[data-testid="${sheetId}"]`, { timeout: 10000 }).catch(() => null);
  if (!check(!!sheet, `${sheetId}: MORE opens it`)) return;
  await settle(page, 400);
  const r = await probe(page, { kind: 'list', root: `[data-testid="${sheetId}"]`, tapSkip: '.topbar' });
  const fails = judge(r, { skip: ['numbers', 'content', 'host', 'bubble', 'yellow'] });
  check(fails.length === 0, `${sheetId}: the sheet passes the text floor (${summary(r)}${fails.length ? ` → ${fails.join(' | ')}` : ''})`);
  if (shots) await page.screenshot({ path: join(shots, `${shotName}.png`) });
  await page.click(`[data-testid="${sheetId}-close"]`).catch(() => page.keyboard.press('Escape'));
  await page.waitForSelector(`[data-testid="${sheetId}"]`, { state: 'detached', timeout: 10000 }).catch(() => {});
  await settle(page, 300);
}

/** Claiming today's login gift stamps the day "complete!", the plate shows the next gift, and Miko says so. */
async function loginStamp(page, vp, save) {
  const btn = await page.$('#app [data-testid="login-claim-btn"]');
  if (!btn) {
    console.log('  (login: today already claimed on this save)');
    return;
  }
  const day = await page.evaluate(async () => {
    const { loginCalendar } = await import('/src/systems/missions.js');
    return loginCalendar(window.__sakura.store.profile).days.find((d) => d.today)?.day;
  });
  await btn.click();
  await page.waitForSelector('.modal-overlay', { timeout: 10000 }).catch(() => null);
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));
  await settle(page, 400);
  const after = await page.evaluate((d) => ({
    stamp: document.querySelector(`#app [data-testid="login-stamp-${d}"]`)?.textContent || '',
    chip: !!document.querySelector('#app [data-testid="login-reset"]'),
    claim: !!document.querySelector('#app [data-testid="login-claim-btn"]'),
    line: document.querySelector('#app [data-testid="host"] .ui-host-line')?.textContent || '',
  }), day);
  check(after.stamp === 'complete!' && after.chip && !after.claim, `login: day ${day} wears the "complete!" stamp and the plate shows the next gift (${JSON.stringify(after)})`);
  check(after.line === `Day ${day} stamped. See you tomorrow!`, `login: Miko says the day is stamped ("${after.line}")`);
  if (shots) await page.screenshot({ path: join(shots, `commissions-login-claimed-${save}-${vp}.png`) });
}

/** Numbers counted the audit's way (§6.5): every visible text holding a digit inside the screen, rows and currencies too. */
const auditNumbers = (page) => page.evaluate(() => {
  const els = new Set();
  const w = document.createTreeWalker(document.querySelector('#app'), NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (!/\d/.test(n.nodeValue)) continue;
    const el = n.parentElement;
    if (!el || el.closest('[aria-hidden="true"], .ld, .ld-chip')) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
    const list = el.closest('.ach-list');
    if (list) {
      const lr = list.getBoundingClientRect();
      if (r.bottom <= lr.top || r.top >= lr.bottom) continue;
    }
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    els.add(el);
  }
  return [...els].map((e) => e.textContent.trim().slice(0, 30));
});

const rowsShown = (nums) => nums.join(' · ');

/** The tab's counts as the player sees them: the Ready header, Claim all's pill, the category chip. */
const achCounts = (page) => page.evaluate(() => {
  const btn = document.querySelector('#app [data-testid="ach-claim-all"]');
  return {
    readyN: Number(document.querySelector('#app [data-testid="ach-ready-n"]')?.textContent || 0),
    readyRows: document.querySelectorAll('#app .ach-list .ach-row.ready').length,
    pill: btn ? Number(btn.querySelector('.ui-btn-n')?.textContent || -1) : null,
    pillCls: btn?.querySelector('.ui-btn-n') ? 'ui-btn-n' : null,
    cat: document.querySelector('#app [data-testid="ach-category"] .ach-catchip-name')?.textContent || '',
  };
});

/** The category sheet's counts: { id: n } (a zero shows no badge). */
async function sheetCounts(page) {
  await page.click('[data-testid="ach-category"]');
  await page.waitForSelector('[data-testid="ach-cat-sheet"]', { timeout: 10000 });
  await settle(page, 300);
  return page.$$eval('[data-testid="ach-cat-sheet"] .ach-cat', (els) => Object.fromEntries(els.map((e) => [e.dataset.testid.replace('ach-cat-', ''), Number(e.querySelector('.ach-cat-n')?.textContent || 0)])));
}

async function pickCat(page, id) {
  if (!(await page.$('[data-testid="ach-cat-sheet"]'))) {
    await page.click('[data-testid="ach-category"]');
    await page.waitForSelector('[data-testid="ach-cat-sheet"]', { timeout: 10000 });
  }
  await page.click(`[data-testid="ach-cat-${id}"]`);
  await page.waitForSelector('[data-testid="ach-cat-sheet"]', { state: 'detached', timeout: 10000 }).catch(() => {});
  await settle(page, 400);
}

async function achievements(page, vp, save) {
  await go(page, '#/commissions?tab=achievements', 'commissions');
  await page.waitForSelector('[data-testid="ach-tab"] .ach-row', { timeout: 30000 });
  await settle(page, 400);
  const r = await probe(page, { kind: 'list', list: '.ach-list', tapSkip: '.topbar' });
  const fails = judge(r);
  check(fails.length === 0, `achievements: probe ${summary(r)}${fails.length ? ` → ${fails.join(' | ')}` : ''}`);
  const info = await page.evaluate(() => {
    const list = document.querySelector('.ach-list');
    const heads = [...list.querySelectorAll('.ach-ghead')].map((x) => [...x.classList].find((c) => ['ready', 'progress', 'done'].includes(c)));
    const rows = [...list.querySelectorAll('.ach-row')];
    const texts = rows.map((x) => x.innerText.replace(/\s+/g, ' '));
    const ready = list.querySelectorAll('.ach-row.ready').length;
    const caseBtn = document.querySelector('[data-testid="ach-case"]');
    return {
      host: !!document.querySelector('#app [data-testid="host"]'),
      heads, rows: rows.length, ready,
      readyBars: list.querySelectorAll('.ach-row.ready .ach-bar').length,
      doneShown: list.querySelectorAll('.ach-row.done').length,
      doneHead: !!list.querySelector('[data-testid="ach-completed"]'),
      bad: texts.filter((t) => /×\s?1\b(?![\d,.])|(?<![\d/])1\/1(?![\d])|\b0 ?\/ ?\d/.test(t)),
      screens: Math.round((list.scrollHeight / list.clientHeight) * 10) / 10,
      window: list.clientHeight,
      rowH: Math.round(Math.min(...rows.slice(0, 6).map((x) => x.getBoundingClientRect().height))),
      caseWord: caseBtn?.innerText.trim() || '',
    };
  });
  check(!info.host, 'achievements: no host on this tab (the list needs the width, notes Q9)');
  check(info.ready === 0 || info.heads[0] === 'ready', `achievements: Ready comes first (${info.heads.join(' → ')})`);
  check(!info.doneHead || info.doneShown === 0, `achievements: Done is collapsed (${info.doneShown} done rows shown)`);
  check(info.bad.length === 0, `achievements: no "1/1", "×1" or "0/n" on a row${info.bad.length ? ` (${info.bad.slice(0, 3).join(' | ')})` : ''}`);
  check(info.readyBars === 0, `achievements: a ready row shows no bar (the mock; ${info.readyBars} bars)`);
  check(info.rowH >= 56, `achievements: rows are about 60 px (${info.rowH})`);
  check(info.caseWord === 'Ribbons', `achievements: the case button says "Ribbons" (${info.caseWord})`);
  // (the target is for the ui-shots save, §6.5; an update-day veteran has dozens ready at once: reported only)
  if (save === 'shots') check(info.screens <= 10, `achievements: the whole list scrolls ${info.screens} screens (≤ 10; window ${info.window} px)`);
  else console.log(`  info achievements: the whole list scrolls ${info.screens} screens with ${info.ready} ready (window ${info.window} px)`);
  // (P3 budgets are counted at 844x390; a taller desktop window shows more rows, each within its row budget)
  const nums = await auditNumbers(page);
  if (vp === '844x390') check(nums.length <= 14, `achievements: ${nums.length} visible numbers counted the audit's way (about 12; ${nums.join(' · ')})`);
  else console.log(`  info achievements: ${nums.length} visible numbers at ${vp} (${rowsShown(nums)})`);
  if (shots) await page.screenshot({ path: join(shots, `achievements-${save}-${vp}.png`) });

  // ---- one count everywhere: rows ready (the Ready header = Claim all's pill = the category sheet), per category ----
  const all = await achCounts(page);
  const sheet = await sheetCounts(page);
  const cats = Object.keys(sheet);
  check(cats.length === 12 && cats.includes('codex') && cats.includes('secret'), `achievements: the category sheet lists 12 categories (${cats.length})`);
  if (shots) await page.screenshot({ path: join(shots, `achievements-categories-${save}-${vp}.png`) });
  check(all.readyN === all.readyRows && (all.readyRows === 0 ? all.pill === null : all.pill === all.readyRows) && sheet.all === all.readyRows,
    `achievements: All: one count (Ready ${all.readyN}, ${all.readyRows} rows, Claim all ${all.pill}, the sheet ${sheet.all})`);
  check(all.pill === null || all.pillCls === 'ui-btn-n', 'achievements: Claim all wears the one count pill (kit btnCount, as Commissions\')');
  const withReady = cats.find((c) => c !== 'all' && sheet[c] > 0);
  const none = cats.find((c) => c !== 'all' && c !== 'secret' && !sheet[c]);
  if (withReady) {
    await pickCat(page, withReady);
    const c = await achCounts(page);
    check(c.readyN === c.readyRows && c.pill === c.readyRows && sheet[withReady] === c.readyRows, `achievements: ${withReady}: one count (Ready ${c.readyN}, ${c.readyRows} rows, Claim all ${c.pill}, the sheet ${sheet[withReady]})`);
    if (shots) await page.screenshot({ path: join(shots, `achievements-${withReady}-${save}-${vp}.png`) });
    // Claim all claims this category only (the shots save at the milestone's sizes: the late save is claimed by e2e/achievements.mjs)
    if (save === 'shots' && vp === '844x390') {
      const before = await page.evaluate(async (cat) => {
        const { achievementList } = await import('/src/systems/missions.js');
        return achievementList(window.__sakura.store.profile).filter((a) => a.claimable && a.cat !== cat).map((a) => a.id);
      }, withReady);
      await page.click('#app [data-testid="ach-claim-all"]');
      // (a special ribbon plays its fanfare first)
      const ff = await page.waitForSelector('[data-testid="ach-fanfare-skip"]', { timeout: 3000 }).catch(() => null);
      if (ff) await ff.click().catch(() => {});
      await page.waitForSelector('.modal-overlay:not(.closing) .modal-title', { timeout: 10000 }).catch(() => null);
      const title = await page.evaluate(() => [...document.querySelectorAll('.modal-overlay:not(.closing)')].pop()?.querySelector('.modal-title')?.textContent || '');
      await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));
      await settle(page, 400);
      const after = await page.evaluate(async ([cat, others]) => {
        const { achievementList } = await import('/src/systems/missions.js');
        const list = achievementList(window.__sakura.store.profile);
        return { left: list.filter((a) => a.claimable && a.cat === cat).length, othersKept: others.every((id) => list.find((a) => a.id === id)?.claimable) };
      }, [withReady, before]);
      check(after.left === 0 && after.othersKept, `achievements: Claim all in ${withReady} claimed that category only (${JSON.stringify(after)}; "${title}")`);
      check(new RegExp(`· ${c.readyRows} claimed`).test(title), `achievements: its window counts the rows it claimed ("${title}", the pill said ${c.readyRows})`);
    }
  }
  if (none) {
    await pickCat(page, none);
    const c = await achCounts(page);
    check(c.pill === null && c.readyRows === 0, `achievements: ${none} (nothing ready): no Claim all, no Ready group (${JSON.stringify(c)})`);
    if (shots) await page.screenshot({ path: join(shots, `achievements-${none}-${save}-${vp}.png`) });
  }
  await pickCat(page, 'all');
  // a row opens its ladder sheet
  await page.click('.ach-list .ach-row .ach-title');
  const ladder = await page.waitForSelector('[data-testid="ach-ladder-sheet"]', { timeout: 10000 }).catch(() => null);
  if (check(!!ladder, 'achievements: a row opens its ladder sheet')) {
    await settle(page, 300);
    const steps = await page.$$eval('[data-testid="ach-ladder-sheet"] .ach-ls-step', (els) => els.length);
    check(steps >= 1, `achievements: the sheet lists the tiers (${steps})`);
    if (shots) await page.screenshot({ path: join(shots, `achievements-ladder-${save}-${vp}.png`) });
    await page.click('[data-testid="ach-ladder-sheet-close"]');
    await settle(page, 300);
  }
  // the Honor Ribbon Case and its Titles button: the text floor (the review found "★ Titles" at 10 px)
  await page.click('[data-testid="ach-case"]');
  await page.waitForSelector('[data-testid="ach-case-view"]', { timeout: 10000 });
  await settle(page, 600);
  const cr = await probe(page, { kind: 'list', root: '[data-testid="ach-case-view"]', tapSkip: '.topbar' });
  const cf = judge(cr, { skip: ['numbers', 'content', 'host', 'bubble', 'yellow', 'taps'] });
  check(cf.length === 0, `achievements: the Honor Ribbon Case passes the text floor (${summary(cr)}${cf.length ? ` → ${cf.join(' | ')}` : ''})`);
  const titles = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="ach-titles"]');
    return b ? { text: b.innerText.trim(), size: parseFloat(getComputedStyle(b.querySelector('span:not(.ui-ico)')).fontSize) } : null;
  });
  check(!!titles && titles.text === 'Titles' && titles.size >= (vp.endsWith('x390') || Number(vp.split('x')[1]) <= 480 ? 12 : 13), `achievements: the Case's Titles button reads "Titles" at the floor (${JSON.stringify(titles)})`);
  if (shots) await page.screenshot({ path: join(shots, `achievements-case-${save}-${vp}.png`) });
  if (titles) {
    await page.click('[data-testid="ach-titles"]');
    await page.waitForSelector('[data-testid="ach-titles-sheet"]', { timeout: 10000 }).catch(() => null);
    await settle(page, 400);
    const tr = await probe(page, { kind: 'list', root: '[data-testid="ach-titles-sheet"]', tapSkip: '.topbar' });
    const tf = judge(tr, { skip: ['numbers', 'content', 'host', 'bubble', 'yellow', 'taps', 'overflow'] });
    check(tf.length === 0, `achievements: the Titles sheet passes the text floor (${summary(tr)}${tf.length ? ` → ${tf.join(' | ')}` : ''})`);
    if (shots) await page.screenshot({ path: join(shots, `achievements-titles-${save}-${vp}.png`) });
    await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));
  }
  await page.click('[data-testid="ach-case-back"]').catch(() => {});
  await settle(page, 300);
}

async function campaign(page, vp, save) {
  await go(page, '#/campaign?chapter=1', 'campaign');
  const r = await probe(page, { kind: 'hub', tapSkip: '.topbar' });
  const fails = judge(r, { skip: ['overflow'] }); // (the chapter tab rail scrolls sideways: its own design, flagged)
  check(fails.length === 0, `campaign: probe ${summary(r)}${fails.length ? ` → ${fails.join(' | ')}` : ''}`);
  const cards = await page.evaluate(() => [...document.querySelectorAll('.ma-stage-card')].map((c) => {
    const nums = new Set();
    const w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (/\d/.test(n.nodeValue)) nums.add(n.parentElement);
    return { id: c.dataset.testid, nums: nums.size, extra: !!c.querySelector('.ma-sc-mech, .ma-sc-rule, .ma-sc-ribbons') || /\bwaves\b/.test(c.innerText) };
  }));
  check(cards.length > 0 && cards.every((c) => c.nums <= 2), `campaign: every stage card holds ≤ 2 numbers (${cards.map((c) => c.nums).join(' ')})`);
  check(cards.every((c) => !c.extra), 'campaign: no waves, ribbons, rule or mechanic chips on the cards');
  if (shots) await page.screenshot({ path: join(shots, `campaign-${save}-${vp}.png`) });
}

try {
  for (const vp of viewports) {
    const [W, H] = vp.split('x').map(Number);
    for (const save of saves) {
      console.log(`\n=== ${vp} · ${save} save ===`);
      let opened;
      try {
        opened = await open(save, vp);
      } catch (e) {
        check(false, `${vp} ${save}: the game opens (${e.message.split('\n')[0]})`);
        continue;
      }
      const { ctx, page, errors } = opened;
      for (const s of HOSTED) {
        try {
          await hostedScreen(page, s, vp, save);
        } catch (e) {
          check(false, `${s.name}: ${e.message.split('\n')[0]}`);
        }
      }
      try {
        await achievements(page, vp, save);
      } catch (e) {
        check(false, `achievements: ${e.message.split('\n')[0]}`);
      }
      try {
        await campaign(page, vp, save);
      } catch (e) {
        check(false, `campaign: ${e.message.split('\n')[0]}`);
      }
      check(errors.length === 0, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
      await ctx.close();
    }
    if (H > W) continue; // (portrait shows no host)
    // with motion on, a new line pops
    const { ctx, page } = await open('shots', vp, 'no-preference');
    await go(page, '#/missions', 'missions');
    await page.click('#app [data-testid="host-bubble"]');
    await page.waitForTimeout(30);
    const anim = await page.evaluate(() => getComputedStyle(document.querySelector('#app [data-testid="host-bubble"]')).animationName);
    check(anim === 'ui-bubble-pop', `${vp}: with motion on, the next line pops (${anim})`);
    await ctx.close();
  }
} catch (e) {
  failures++;
  console.log(`  FAIL ${e.stack || e.message}`);
} finally {
  await browser.close();
  await server.close();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall hub checks passed');
process.exit(failures ? 1 : 0);

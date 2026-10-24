// [ui-ink] UI v2 "Ink & Paper" V2: the night home and its menu sheet, end to end (notes/ui-v2/UI_V2_DIRECTION.md 12.1,
// 12.2; the build plan's V2 tests). On the mock-ups' sample save (uiSeed.mjs seedInkSave), at 844x390, 1280x720 and
// 390x844, in headless Chrome (one browser):
//   1. the probe in v2 mode: at most 10 numbers counting the top bar, one yellow (the play tile), no pink at rest,
//      no control painted over, the bar whole, every tap 44 px
//   2. Ruri (with Kon) as the secretary: her art 8 px clear of every control (pixels.mjs artClearance), her face box
//      clear of every control, her bubble on a tap only (2.4 s), never over a control
//   3. the menu sheet: it opens from the menu button, closes by its X, by Esc and by a tap outside
//   4. every hook works: the rail rows, the objective, the news card and its pager, the chapter entry, the top bar's
//      mail, chat and avatar, the corner tools
//   5. Marumi as the secretary (landscape, High, motion allowed): her living scene's canvas draws, every control stays on
//      top, her art 8 px clear of every control, her face box clear; one WebGL context; leaving the home disposes it
//      and loses the context, coming back makes one again; Reduce motion (the setting and the system's) and Low
//      graphics show her still portrait with no canvas; a phone held upright too
//
//   node e2e/home.mjs [--viewport 844x390,1280x720,390x844] [--shots dir]
// Starts its own Vite dev server on a free port; exit code 1 when a check fails.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchChromium } from './browser.mjs';
import { probe, judge, summary } from './probe.mjs';
import { artClearance } from './pixels.mjs';
import { seedInkSave, inkRandomInit, INK_NOW, INK_RANDOM_SEED } from './uiSeed.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const viewports = opt('viewport', '844x390,1280x720,390x844').split(',').map((s) => s.trim());
const shots = opt('shots', null);
if (shots) mkdirSync(shots, { recursive: true });

const fails = [];
let oks = 0;
const check = (ok, msg) => {
  if (ok) { oks++; console.log(`  ok  ${msg}`); } else { fails.push(msg); console.log(`  FAIL ${msg}`); }
  return ok;
};

/** The home's controls (the boxes her art and her face keep clear of). */
const UI = '#app .home-top > *, #app .home-rail > .ui-hrow, #app .home-stack .ui-obj, #app .home-stack .ui-news, #app .home-chap, #app .home-tools > .ui-ibtn';

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser, label } = await launchChromium();
console.log(`browser: ${label}`);

async function openHome(vp, { reduced }) {
  const [W, H] = vp.split('x').map(Number);
  const touch = W < 1000;
  const context = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, reducedMotion: reduced ? 'reduce' : 'no-preference', timezoneId: 'America/Chicago' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date(INK_NOW));
  await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => document.head.append(Object.assign(document.createElement('style'), { textContent: '.toast-host, .jn-toast { display: none !important; }' }))); });
  if (H > W) await page.addInitScript(() => { try { sessionStorage.setItem('sakura-ui-rotate-dismissed', '1'); } catch { /* none */ } });
  await page.addInitScript(inkRandomInit, INK_RANDOM_SEED);
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load', timeout: 90000 });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 30000 });
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 8000 }).catch(() => null);
  if (later) await later.click({ force: true });
  await seedInkSave(page);
  return { context, page, errors, W, H };
}

const settle = (page, ms = 600) => page.waitForTimeout(ms).then(() => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
async function go(page, hash, screen) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForFunction((s) => document.querySelector('#app')?.dataset.screen === s && !document.documentElement.dataset.tx, screen, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));
  await settle(page, 900);
}
/** The home drawn fresh with these save changes (prepared on another screen). */
async function homeWith(page, patch) {
  await go(page, '#/missions', 'missions');
  await page.evaluate((pt) => {
    const { store } = window.__sakura;
    const p = store.profile;
    if (pt.secretary) p.secretary = pt.secretary;
    Object.assign(p.settings, pt.settings || {});
    document.documentElement.toggleAttribute('data-reduce-motion', !!p.settings.reduceMotion);
    store.commit('e2e');
  }, patch);
  await go(page, '#/lobby', 'lobby');
}
const screenIs = (page) => page.evaluate(() => document.querySelector('#app')?.dataset.screen);
const boxesOf = (page) => page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length).map((e) => {
  const r = e.getBoundingClientRect();
  return { name: e.dataset.testid || e.className.toString().slice(0, 30), x: r.left, y: r.top, w: r.width, h: r.height };
}), UI);
const overlaps = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);

async function shot(page, name, vp) {
  if (shots) await page.screenshot({ path: join(shots, `${name}-${vp}.png`) });
}

async function staticChecks(vp) {
  console.log(`\n== ${vp}: the home with Ruri (Reduce motion: nothing moves) ==`);
  const { context, page, errors, W, H } = await openHome(vp, { reduced: true });
  try {
    await homeWith(page, { secretary: 'ruri', settings: { quality: 'high', reduceMotion: false } });
    await shot(page, 'home', vp);
    // 1. the probe, v2
    const r = await probe(page, { kind: 'hub', v2: true, apart: [['[data-testid="secretary-bubble"]', '#app .home-rail'], ['[data-testid="secretary-bubble"]', '#app .home-stack']] });
    const f = judge(r, { only: ['v2numbers', 'v2yellow', 'pink', 'covered', 'heads', 'v2taps', 'clipped', 'overflow', 'text'], v2: true });
    check(!f.length, `${vp} probe v2: ${summary(r)}${f.length ? ` — ${f.join(' | ')}` : ''}`);
    check(r.v2.yellowFills.length === 1 && /play|Claim|Clear|Collect/i.test(r.v2.yellowFills[0] || ''), `${vp} the one yellow is the objective's play tile (${r.v2.yellowFills.join('; ')})`);
    // 2. her art and her face box clear of every control
    const art = await artClearance(page, '#app [data-testid="secretary-art"]', UI, { min: 8 });
    check(art.fails === 0, `${vp} Ruri's art (and Kon) 8 px clear of every control: ${art.checks.length - art.fails}/${art.checks.length}${art.fails ? ` — ${art.checks.filter((c) => !c.ok).map((c) => c.msg).slice(0, 3).join('; ')}` : ''}`);
    const pl = await page.evaluate(() => window.__sakura.home.placement());
    const bx = await boxesOf(page);
    const hit = bx.filter((b) => overlaps(pl.face, b));
    check(!!pl.face && !hit.length, `${vp} her face box clear of every control (${JSON.stringify(pl.face && [pl.face.x, pl.face.y, pl.face.w, pl.face.h].map(Math.round))}${hit.length ? `; under ${hit.map((b) => b.name).join(', ')}` : ''})`);
    check(pl.fits !== false && (W < H || pl.scale >= 0.8), `${vp} she stands at ${Math.round((pl.scale || 0) * 100)} % of her size, ${Math.round(pl.shift || 0)} px aside, ${Math.round(pl.drop || 0)} px down`);
    // her bubble: only after a tap, for 2.4 s, never over a control
    check(!(await page.evaluate(() => document.querySelector('[data-testid="secretary-bubble"]')?.classList.contains('show'))), `${vp} no bubble at rest`);
    const spot = await page.evaluate(() => {
      const art = document.querySelector('[data-testid="secretary-art"]');
      const r = art.getBoundingClientRect();
      for (const fy of [0.55, 0.45, 0.65, 0.35]) for (const fx of [0.5, 0.42, 0.58]) {
        const x = r.left + r.width * fx;
        const y = r.top + r.height * fy;
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
        const e = document.elementFromPoint(x, y);
        if (e && art.contains(e)) return { x, y };
      }
      return null;
    });
    if (check(!!spot, `${vp} a spot on her that nothing covers (${JSON.stringify(spot)})`)) {
      await page.mouse.click(spot.x, spot.y);
      await page.waitForTimeout(300);
      const b = await page.evaluate(() => {
        const e = document.querySelector('[data-testid="secretary-bubble"]');
        const r = e.getBoundingClientRect();
        return { show: e.classList.contains('show'), text: e.textContent, box: { x: r.left, y: r.top, w: r.width, h: r.height } };
      });
      const under = (await boxesOf(page)).filter((x) => overlaps(b.box, x));
      check(b.show && b.text.length > 3 && !under.length, `${vp} a tap: her bubble ("${b.text.slice(0, 30)}…") clear of every control${under.length ? `; over ${under.map((x) => x.name).join(', ')}` : ''}`);
      check(b.box.y >= pl.face.y + pl.face.h - 1, `${vp} … under her face box (bubble top ${Math.round(b.box.y)}, face box bottom ${Math.round(pl.face.y + pl.face.h)})`);
      await shot(page, 'home-tap', vp);
      await page.waitForTimeout(2500);
      check(!(await page.evaluate(() => document.querySelector('[data-testid="secretary-bubble"]').classList.contains('show'))), `${vp} … gone after 2.4 s`);
    }
    // 3. the menu sheet: X, Esc, a tap outside
    const sheetOpen = () => page.evaluate(() => !!document.querySelector('[data-testid="menu-sheet"]') && !document.querySelector('.home-menu-layer.closing'));
    const openSheet = async () => { await page.click('[data-testid="top-menu"]'); await page.waitForSelector('[data-testid="menu-sheet"]', { timeout: 5000 }); await settle(page, 350); };
    await openSheet();
    const sh = await page.evaluate(() => { const r = document.querySelector('[data-testid="menu-sheet"]').getBoundingClientRect(); return { x: r.left, w: r.width, h: r.height, rows: document.querySelectorAll('[data-testid="menu-sheet"] .ui-hrow').length }; });
    check(sh.rows === 9 && Math.abs(sh.x + sh.w - W) < 1 && sh.h >= H - 1, `${vp} the menu sheet: 8 rows and Settings, from the right edge, full height (x ${Math.round(sh.x)}, ${Math.round(sh.w)} wide)`);
    const rs = await probe(page, { kind: 'hub', v2: true, root: '[data-testid="menu-sheet"]' });
    check(rs.v2.numbersAll === 0 && rs.v2.yellowFills.length === 0, `${vp} the menu sheet: no numbers, no yellow (${rs.v2.numbersAll}, ${rs.v2.yellowFills.length})`);
    await shot(page, 'home-menu', vp);
    await page.click('[data-testid="menu-sheet-close"]');
    await settle(page, 300);
    check(!(await sheetOpen()), `${vp} the menu sheet closes by its X`);
    await openSheet();
    await page.keyboard.press('Escape');
    await settle(page, 300);
    check(!(await sheetOpen()), `${vp} … by Esc`);
    await openSheet();
    await page.mouse.click(Math.min(40, sh.x - 10), H / 2);
    await settle(page, 300);
    check(!(await sheetOpen()), `${vp} … and by a tap outside it`);
    check(await screenIs(page) === 'lobby', `${vp} … and the home stays (${await screenIs(page)})`);
    // 4. the hooks
    const opens = async (labelText, sel, screen, prep = null) => {
      await go(page, '#/lobby', 'lobby');
      if (prep) await prep();
      await page.click(sel, { timeout: 8000 });
      await page.waitForFunction((s) => document.querySelector('#app')?.dataset.screen === s, screen, { timeout: 20000 }).catch(() => {});
      check(await screenIs(page) === screen, `${vp} ${labelText} opens ${screen} (now ${await screenIs(page)})`);
    };
    await opens('BATTLE (tile-mission)', '[data-testid="tile-mission"]', 'missions');
    await opens('STUDENTS', '[data-testid="dock-students"]', 'students');
    await opens('RECRUIT', '[data-testid="dock-recruit"]', 'recruit');
    await opens('COMMISSIONS', '[data-testid="dock-commissions"]', 'commissions');
    await opens('MALL', '[data-testid="dock-mall"]', 'mall');
    await opens('MULTIPLAYER', '[data-testid="lobby-multiplayer"]', 'multiplayer');
    await opens('the chapter entry', '[data-testid="lobby-chapter"]', 'campaign');
    await opens('the mail button', '[data-testid="top-mail"]', 'mail');
    await opens('the avatar', '[data-testid="account-level"]', 'profile');
    await opens('the news card\'s event page', '#app [data-testid="lobby-news"] .go', 'event');
    await opens('the menu\'s Formation row', '[data-testid="menu-sheet"] [data-testid="menu-formation"]', 'formation', () => page.click('[data-testid="top-menu"]'));
    await go(page, '#/lobby', 'lobby');
    // the pager turns the news card by hand, and wraps
    const pages = [];
    for (let i = 0; i < 4; i++) {
      pages.push(await page.evaluate(() => document.querySelector('#app [data-testid="lobby-news"]')?.dataset.page));
      await page.click('[data-testid="lobby-news-next"]');
      await settle(page, 150);
    }
    check(pages.length === 4 && pages[0] === pages[3] && new Set(pages).size === 3, `${vp} the news pager turns by hand through 3 pages and wraps (${pages.join(' → ')})`);
    // the objective: the login gift first on this save; a tap claims it and the next objective takes its place
    const o0 = await page.evaluate(() => ({ kind: document.querySelector('[data-testid="lobby-objective"]')?.dataset.kind, tile: !!document.querySelector('[data-testid="lobby-objective"] [data-testid="login-claim"]') }));
    check(o0.kind === 'login' && o0.tile, `${vp} the objective: today's login gift, its play tile wears login-claim (${JSON.stringify(o0)})`);
    await page.click('[data-testid="login-claim"]');
    await page.waitForSelector('.modal-overlay', { timeout: 5000 }).catch(() => null);
    const o1 = await page.evaluate(() => ({ claimed: window.__sakura.store.profile.missions?.login?.lastDay != null || !!document.querySelector('.modal-overlay'), kind: document.querySelector('[data-testid="lobby-objective"]')?.dataset.kind }));
    check(o1.claimed && o1.kind !== 'login', `${vp} … a tap claims it and the next objective takes its place (${o1.kind})`);
    await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));
    // the corner tools: hide the UI and bring it back; the background picker
    await go(page, '#/lobby', 'lobby');
    await page.click('[data-testid="lobby-hide"]');
    await settle(page, 200);
    const hidden = await page.evaluate(() => ({ hidden: document.querySelector('#app .home')?.classList.contains('ui-hidden'), restore: !document.querySelector('[data-testid="lobby-restore"]').hidden }));
    check(hidden.hidden && hidden.restore, `${vp} hide the UI: the menus go, the restore button stays`);
    await shot(page, 'home-hidden', vp);
    await page.click('[data-testid="lobby-restore"]');
    await settle(page, 200);
    check(!(await page.evaluate(() => document.querySelector('#app .home')?.classList.contains('ui-hidden'))), `${vp} … and come back`);
    await page.click('[data-testid="lobby-bg"]');
    check(!!(await page.waitForSelector('[data-testid="bgp-done"]', { timeout: 5000 }).catch(() => null)), `${vp} the background tool opens the background and secretary picker`);
    await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));
    // Marumi as the secretary under the system's Reduce motion: her still portrait, no canvas
    await homeWith(page, { secretary: 'marumi', settings: { quality: 'high', reduceMotion: false } });
    await page.waitForTimeout(800);
    const sys = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas[data-live]').length, state: window.__sakura.live?.state, fig: !!document.querySelector('#app .home-fig img') }));
    check(sys.canvases === 0 && sys.fig, `${vp} Marumi under the system's Reduce motion: her still portrait, no canvas (${JSON.stringify(sys)})`);
    await shot(page, 'home-marumi-reduced', vp);
    check(!errors.length, `${vp} no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  } finally {
    await context.close();
  }
}

async function liveChecks(vp) {
  console.log(`\n== ${vp}: Marumi's living scene (motion allowed) ==`);
  const { context, page, errors, W, H } = await openHome(vp, { reduced: false });
  try {
    await homeWith(page, { secretary: 'marumi', settings: { quality: 'high', reduceMotion: false } });
    const state = await page.waitForFunction(() => window.__sakura?.live?.state !== 'loading' && window.__sakura?.live?.state, null, { timeout: 20000 }).then((h) => h.jsonValue()).catch(() => null);
    if (W < H) {
      const s = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas[data-live]').length, fig: !!document.querySelector('#app .home-fig img') }));
      check(s.canvases === 0 && s.fig, `${vp} a phone held upright: her still portrait (her scene is drawn for landscape) (${JSON.stringify(s)})`);
      await shot(page, 'home-marumi', vp);
      return;
    }
    if (!check(state === 'live', `${vp} Marumi on High: her living scene runs (${state})`)) return;
    await page.evaluate(() => window.__sakura.live.renderAt(0));
    await settle(page, 200);
    await shot(page, 'home-marumi', vp);
    // the canvas draws: real pixels with spread (not blank, not one colour), away from the controls
    const px = await page.evaluate(async () => {
      const c = document.querySelector('canvas[data-live]');
      const r = c.getBoundingClientRect();
      return { w: r.width, h: r.height, n: document.querySelectorAll('canvas[data-live]').length, stats: window.__sakura.live.stats };
    });
    check(px.n === 1 && px.w > 100, `${vp} one canvas, full screen (${px.w}x${px.h})`);
    check(px.stats && px.stats.created - px.stats.disposed === 1, `${vp} one live WebGL scene (${JSON.stringify(px.stats)})`);
    const buf = await page.screenshot({ clip: { x: Math.round(W * 0.3), y: Math.round(H * 0.25), width: Math.round(W * 0.3), height: Math.round(H * 0.5) } });
    const spread = await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const cv = new OffscreenCanvas(bmp.width, bmp.height);
      const cx = cv.getContext('2d');
      cx.drawImage(bmp, 0, 0);
      const d = cx.getImageData(0, 0, bmp.width, bmp.height).data;
      let s = 0;
      let s2 = 0;
      let n = 0;
      for (let i = 0; i < d.length; i += 16) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; s += l; s2 += l * l; n++; }
      const m = s / n;
      return { mean: m, sd: Math.sqrt(Math.max(0, s2 / n - m * m)) };
    }, buf.toString('base64'));
    check(spread.sd > 12 && spread.mean > 20, `${vp} the canvas draws her and her room (luminance mean ${spread.mean.toFixed(0)}, spread ${spread.sd.toFixed(0)})`);
    // every control stays on top of it
    const r = await probe(page, { kind: 'hub', v2: true });
    const f = judge(r, { only: ['covered', 'v2yellow', 'pink', 'v2numbers', 'heads'], v2: true });
    check(!f.length, `${vp} with her scene: every control on top, one yellow, no pink (${summary(r)}${f.length ? ` — ${f.join(' | ')}` : ''})`);
    // her art (the ball and both hands too) 8 px clear of every control; her face box clear
    const art = await artClearance(page, '#app [data-testid="secretary-art"]', UI, {
      min: 8,
      hide: () => page.evaluate(() => { window.__sakura.live.setGirlVisible(false); }),
      show: () => page.evaluate(() => { window.__sakura.live.setGirlVisible(true); }),
    });
    check(art.fails === 0, `${vp} Marumi's living art 8 px clear of every control: ${art.checks.length - art.fails}/${art.checks.length}${art.fails ? ` — ${art.checks.filter((c) => !c.ok).map((c) => c.msg).slice(0, 3).join('; ')}` : ''}`);
    const pl = await page.evaluate(() => window.__sakura.live.placement());
    const hit = (await boxesOf(page)).filter((b) => overlaps(pl.face, b));
    check(!hit.length && pl.fits && pl.rel >= 0.8, `${vp} her face box clear of every control, at ${Math.round(pl.rel * 100)} % of the cover fit (C5: ≥ 80 %)${hit.length ? `; under ${hit.map((b) => b.name).join(', ')}` : ''}`);
    // t = 2 s: she moved (a calm idle), nothing else did
    await page.evaluate(() => window.__sakura.live.renderAt(2));
    await settle(page, 150);
    await shot(page, 'home-marumi-2s', vp);
    // the menu sheet over her scene
    await page.click('[data-testid="top-menu"]');
    await settle(page, 300);
    check(await page.evaluate(() => !!document.querySelector('[data-testid="menu-sheet"]')), `${vp} the menu sheet opens over her scene`);
    await page.keyboard.press('Escape');
    await settle(page, 300);
    // leaving the home disposes the scene and loses its context; coming back makes one again
    await go(page, '#/missions', 'missions');
    const gone = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas[data-live]').length, stats: window.__sakura.live?.stats }));
    check(gone.canvases === 0 && gone.stats && gone.stats.disposed === gone.stats.created && gone.stats.lost >= gone.stats.created, `${vp} leaving the home: no canvas left, the scene disposed and its context lost (${JSON.stringify(gone)})`);
    await go(page, '#/lobby', 'lobby');
    await page.waitForFunction(() => window.__sakura?.live?.state === 'live', null, { timeout: 20000 }).catch(() => {});
    const back = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas[data-live]').length, stats: window.__sakura.live?.stats }));
    check(back.canvases === 1 && back.stats.created - back.stats.disposed === 1, `${vp} coming back: one canvas, one context (${JSON.stringify(back)})`);
    // Reduce motion (the game's setting) and Low graphics: her still portrait, no canvas
    await homeWith(page, { secretary: 'marumi', settings: { reduceMotion: true } });
    await page.waitForTimeout(500);
    const red = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas[data-live]').length, fig: !!document.querySelector('#app .home-fig img'), stats: window.__sakura.live?.stats }));
    check(red.canvases === 0 && red.fig && red.stats.disposed === red.stats.created, `${vp} the Reduce motion setting: her still portrait, no canvas (${JSON.stringify(red)})`);
    await homeWith(page, { secretary: 'marumi', settings: { reduceMotion: false, quality: 'low' } });
    await page.waitForTimeout(500);
    const low = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas[data-live]').length, fig: !!document.querySelector('#app .home-fig img') }));
    check(low.canvases === 0 && low.fig, `${vp} Low graphics: her still portrait, no canvas (${JSON.stringify(low)})`);
    await shot(page, 'home-low', vp);
    // Medium: her scene again (fewer motes, a coarser mesh)
    await homeWith(page, { secretary: 'marumi', settings: { quality: 'medium' } });
    await page.waitForFunction(() => window.__sakura?.live?.state !== 'loading', null, { timeout: 20000 }).catch(() => {});
    check(await page.evaluate(() => window.__sakura.live.state) === 'live', `${vp} Medium graphics: her living scene again`);
    // another girl as the secretary: still, no canvas
    await homeWith(page, { secretary: 'ruri', settings: { quality: 'high' } });
    await page.waitForTimeout(500);
    check(await page.evaluate(() => document.querySelectorAll('canvas[data-live]').length) === 0, `${vp} any other host: still, no canvas`);
    check(!errors.length, `${vp} no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  } finally {
    await context.close();
  }
}

try {
  for (const vp of viewports) {
    await staticChecks(vp);
    await liveChecks(vp);
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(`\n${oks} ok, ${fails.length} failed`);
if (fails.length) console.log(`HOME FAIL:\n  ${fails.join('\n  ')}`);
else console.log('HOME PASS');
process.exit(fails.length ? 1 : 0);

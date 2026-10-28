// [ui-ink] UI v2 "Ink & Paper": the night home (home layout B "Quiet Home") and its menu sheet, end to end
// (notes/ui-v2/UI_V2_DIRECTION.md 12.1, 12.2; the Oct 27 layout study). On the mock-ups' sample save (uiSeed.mjs
// seedInkSave), at 844x390, 1280x720 and 390x844, in headless Chrome (one browser):
//   1. the probe in v2 mode: at most 10 numbers counting the top bar, one yellow (the Battle plate's play edge), no pink
//      at rest, no control painted over, the bar whole, every tap 44 px; at most 12 controls on a landscape screen (the
//      study's count: the avatar, the gems' "+", chat, mail, menu, the news chip, four icons, the plate, CO-OP)
//   2. Ruri (with Kon) as the secretary: her art 8 px clear of every control (pixels.mjs artClearance), her face box
//      clear of every control, her bubble on a tap only (2.4 s), never over a control
//   3. the menu sheet: it opens from the menu button (from the right; from the bottom on a phone held upright), closes by
//      its X, by Esc and by a tap outside; its head holds hide the UI and the background picker
//   4. every hook works: the four icons, the Battle plate's two zones, CO-OP, the news chip (its objective page, its
//      event page and its pager), the top bar's mail and avatar, the menu's Formation and Clan rows; hide the UI from the
//      menu and by a long press on the wallpaper, the background picker from the menu
//   5. Marumi as the secretary (landscape, High, motion allowed): her living scene's canvas draws, every control stays on
//      top, her art 8 px clear of every control (the icons fold two by two for her ball), her face box clear; one WebGL
//      context; leaving the home disposes it and loses the context, coming back makes one again; Reduce motion (the
//      setting and the system's) and Low graphics show her still portrait with no canvas; a phone held upright too
//   6. the news chip turns by hand only, never on its own (motion allowed or not: UI v2 rule 11, P8); a running event
//      leads it, so the event shows at landing; a full illustration whose girl stands right of the middle keeps the
//      corners (Battle bottom right) and comes toward the middle, her face and hair clear of every control
//   7. Hikari's rampart (a bright full illustration) at 667x375, 844x390 and 1024x768: Battle bottom right, her face and
//      hair clear of every control, the icons' caps and the SNT-HQ serial at 4.5:1 or more on the pixels under them
//      (the glyphs' own pixels against the background with the halo, at the 10th percentile)
//   8. after Story and the Journal (they load the scene player's styles, whose root class is .sp), the home takes taps
//      again: the element at its centre is the home's, and Battle opens Missions (the bar's spacer is .ui-spacer)
//   9. Marumi on a small phone (667x375, High, motion allowed): where her living scene cannot keep 8 px clear of every
//      control, her still portrait shows (no canvas), 8 px clear of every control
//  10. keys (desktop): Tab reads the top bar first; the news pager keeps the focus through its page turns, and a redraw
//      keeps it on an icon; the menu sheet keeps Tab inside, its rows take Space, and closing it by Esc, its X or a tap
//      outside gives the focus back to the menu button; Esc closes the Notice opened from it
//
//   node e2e/home.mjs [--viewport 844x390,1280x720,390x844] [--rampart 667x375,844x390,1024x768] [--small 667x375] [--shots dir]
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
const rampartSizes = opt('rampart', '667x375,844x390,1024x768').split(',').map((s) => s.trim()).filter(Boolean);
const smallSizes = opt('small', '667x375').split(',').map((s) => s.trim()).filter(Boolean);
const shots = opt('shots', null);
if (shots) mkdirSync(shots, { recursive: true });

const fails = [];
let oks = 0;
const check = (ok, msg) => {
  if (ok) { oks++; console.log(`  ok  ${msg}`); } else { fails.push(msg); console.log(`  FAIL ${msg}`); }
  return ok;
};

/** The home's controls (the boxes her art and her face keep clear of). */
const UI = '#app .home-top > *, #app .home-dock > .home-ico, #app .home-news-host .ui-news, #app .home-plate, #app .home-coop';
/** The bubble keeps clear of these. */
const APART = [['[data-testid="secretary-bubble"]', '#app .home-dock'], ['[data-testid="secretary-bubble"]', '#app .home-battle'], ['[data-testid="secretary-bubble"]', '#app .home-news-host']];

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
    if (pt.lobbyBg) p.lobbyBg = { ...(p.lobbyBg || {}), ...pt.lobbyBg };
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
    const r = await probe(page, { kind: 'hub', v2: true, apart: APART });
    const f = judge(r, { only: ['v2numbers', 'v2yellow', 'pink', 'covered', 'heads', 'v2taps', 'clipped', 'overflow', 'text'], v2: true });
    check(!f.length, `${vp} probe v2: ${summary(r)}${f.length ? ` — ${f.join(' | ')}` : ''}`);
    check(r.v2.yellowFills.length === 1 && /home-play/.test(r.v2.yellowFills[0] || ''), `${vp} the one yellow is the Battle plate's play edge (${r.v2.yellowFills.join('; ')})`);
    // the quiet home's count (the study's): one per control, the chip and the plate once each (their "›" and band are
    // second hit zones of the same piece)
    const count = await page.evaluate(() => {
      const shown = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
      const zones = [...document.querySelectorAll('#app .home button, #app .home a[href], #app .home [role="button"]')].filter((e) => shown(e) && !e.closest('[aria-hidden="true"], .ghost') && !e.hidden);
      const pieces = new Set(zones.map((e) => e.closest('.home-news, .home-plate') || e));
      return { zones: zones.length, controls: pieces.size };
    });
    if (W > H) check(count.controls <= 12, `${vp} the quiet home: ${count.controls} controls (${count.zones} hit zones), at most 12`);
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
    const sh = await page.evaluate(() => { const r = document.querySelector('[data-testid="menu-sheet"]').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, rows: document.querySelectorAll('[data-testid="menu-sheet"] .ui-hrow').length, tools: document.querySelectorAll('[data-testid="menu-sheet"] .m-head [data-testid="lobby-hide"], [data-testid="menu-sheet"] .m-head [data-testid="lobby-bg"]').length }; });
    if (W > H) check(sh.rows === 10 && sh.tools === 2 && Math.abs(sh.x + sh.w - W) < 1 && sh.h >= H - 1, `${vp} the menu sheet: 9 rows and Settings, hide and background in its head, from the right edge, full height (x ${Math.round(sh.x)}, ${Math.round(sh.w)} wide)`);
    else check(sh.rows === 10 && sh.tools === 2 && Math.abs(sh.y + sh.h - H) < 1 && sh.w >= W - 1, `${vp} the menu sheet: 9 rows and Settings, hide and background in its head, from the bottom edge, full width (y ${Math.round(sh.y)}, ${Math.round(sh.h)} tall)`);
    // her face stays clear of the open sheet (her stage slides aside when it must)
    const faceVsSheet = await page.evaluate(() => {
      const pl = window.__sakura.home.placement();
      const host = document.querySelector('#app .home-stage-host');
      const dx = new DOMMatrix(getComputedStyle(host).translate === 'none' ? undefined : `translate(${getComputedStyle(host).translate.split(' ').map((v) => v || '0px').join(',')})`).m41 || 0;
      const r = document.querySelector('[data-testid="menu-sheet"]').getBoundingClientRect();
      const f = { x: pl.face.x + dx, y: pl.face.y, w: pl.face.w, h: pl.face.h };
      return { apart: f.x + f.w <= r.left || f.x >= r.right || f.y + f.h <= r.top || f.y >= r.bottom, f: [f.x, f.y, f.w, f.h].map(Math.round), sheet: [r.left, r.top].map(Math.round) };
    });
    check(faceVsSheet.apart, `${vp} the open menu sheet keeps clear of her face box (${JSON.stringify(faceVsSheet)})`);
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
    await page.mouse.click(W > H ? Math.min(40, sh.x - 10) : W / 2, W > H ? H / 2 : Math.max(10, sh.y - 40));
    await settle(page, 300);
    check(!(await sheetOpen()), `${vp} … and by a tap outside it`);
    check(await screenIs(page) === 'lobby', `${vp} … and the home stays (${await screenIs(page)})`);
    // 4. the hooks
    const opens = async (labelText, sel, screen, prep = null) => {
      await go(page, '#/lobby', 'lobby');
      if (prep) await prep();
      await page.click(sel, { timeout: 20000 });
      await page.waitForFunction((s) => document.querySelector('#app')?.dataset.screen === s, screen, { timeout: 20000 }).catch(() => {});
      check(await screenIs(page) === screen, `${vp} ${labelText} opens ${screen} (now ${await screenIs(page)})`);
    };
    await opens('BATTLE (tile-mission)', '[data-testid="tile-mission"]', 'missions');
    await opens('STUDENTS', '[data-testid="dock-students"]', 'students');
    await opens('RECRUIT', '[data-testid="dock-recruit"]', 'recruit');
    await opens('COMMISSIONS', '[data-testid="dock-commissions"]', 'commissions');
    await opens('MALL', '[data-testid="dock-mall"]', 'mall');
    await opens('CO-OP', '[data-testid="lobby-multiplayer"]', 'multiplayer');
    await opens('the Battle plate\'s chapter band', '[data-testid="lobby-chapter"]', 'campaign');
    await opens('the mail button', '[data-testid="top-mail"]', 'mail');
    await opens('the avatar', '[data-testid="account-level"]', 'profile');
    const toPage = (id) => page.evaluate(async (want) => {
      for (let k = 0; k < 4 && document.querySelector('#app [data-testid="lobby-news"]')?.dataset.page !== want; k++) {
        document.querySelector('#app [data-testid="lobby-news-next"]')?.click();
        await new Promise((r) => setTimeout(r, 60));
      }
      return document.querySelector('#app [data-testid="lobby-news"]')?.dataset.page;
    }, id);
    await opens('the news chip\'s event page', '#app [data-testid="lobby-news"] [data-testid="event-card"]', 'event', () => toPage('event'));
    await opens('the menu\'s Formation row', '[data-testid="menu-sheet"] [data-testid="menu-formation"]', 'formation', () => page.click('[data-testid="top-menu"]'));
    await opens('the menu\'s Clan row', '[data-testid="menu-sheet"] [data-testid="dock-clan"]', 'clan', () => page.click('[data-testid="top-menu"]'));
    await go(page, '#/lobby', 'lobby');
    // the pager turns the news chip by hand, and wraps
    const pages = [];
    for (let i = 0; i < 4; i++) {
      pages.push(await page.evaluate(() => document.querySelector('#app [data-testid="lobby-news"]')?.dataset.page));
      await page.click('[data-testid="lobby-news-next"]');
      await settle(page, 150);
    }
    check(pages.length === 4 && pages[0] === pages[3] && new Set(pages).size === 3 && pages[0] === 'event' && pages[1] === 'objective', `${vp} the news pager turns by hand through 3 pages (the running event first, then the objective) and wraps (${pages.join(' → ')})`);
    // under Reduce motion it never turns on its own
    const still0 = await page.evaluate(() => document.querySelector('#app [data-testid="lobby-news"]')?.dataset.page);
    await page.waitForTimeout(7000);
    check(await page.evaluate(() => document.querySelector('#app [data-testid="lobby-news"]')?.dataset.page) === still0, `${vp} Reduce motion: the news chip stays on its page (7 s)`);
    // the objective: the login gift first on this save (the chip's first page); a tap claims it and the next takes its place
    await toPage('objective');
    const o0 = await page.evaluate(() => ({ kind: document.querySelector('[data-testid="lobby-objective"]')?.dataset.kind, tile: !!document.querySelector('[data-testid="lobby-objective"] [data-testid="login-claim"]') }));
    check(o0.kind === 'login' && o0.tile, `${vp} the objective: today's login gift, its play tile wears login-claim (${JSON.stringify(o0)})`);
    await page.click('[data-testid="login-claim"]');
    await page.waitForSelector('.modal-overlay', { timeout: 5000 }).catch(() => null);
    const o1 = await page.evaluate(() => ({ claimed: window.__sakura.store.profile.missions?.login?.lastDay != null || !!document.querySelector('.modal-overlay'), kind: document.querySelector('[data-testid="lobby-objective"]')?.dataset.kind }));
    check(o1.claimed && o1.kind !== 'login', `${vp} … a tap claims it and the next objective takes its place (${o1.kind})`);
    await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));
    // the menu's tools: hide the UI and bring it back; the background picker
    await go(page, '#/lobby', 'lobby');
    await page.click('[data-testid="top-menu"]');
    await page.waitForSelector('[data-testid="menu-sheet"] [data-testid="lobby-hide"]', { timeout: 5000 });
    await settle(page, 300);
    await page.click('[data-testid="lobby-hide"]');
    await settle(page, 300);
    const hidden = await page.evaluate(() => ({ hidden: document.querySelector('#app .home')?.classList.contains('ui-hidden'), restore: !document.querySelector('[data-testid="lobby-restore"]').hidden }));
    check(hidden.hidden && hidden.restore, `${vp} hide the UI: the menus go, the restore button stays`);
    await shot(page, 'home-hidden', vp);
    await page.click('[data-testid="lobby-restore"]');
    await settle(page, 200);
    check(!(await page.evaluate(() => document.querySelector('#app .home')?.classList.contains('ui-hidden'))), `${vp} … and come back`);
    // a long press (600 ms) on the wallpaper, not on her or a control, hides the UI too; another brings it back
    // (landscape: the open sides; a phone held upright: her frame spans the width, so the strips between the bar, her
    // frame, the plate and the dock — any spot with wallpaper 6 px around it; looked for again once the UI hides, as
    // she may stand taller then)
    const findWall = () => page.evaluate(() => {
      const isWall = (x, y) => {
        const e = document.elementFromPoint(x, y);
        return !!(e && e.closest('#app .home-stage-host') && !e.closest('.home-host'));
      };
      const roomy = (x, y) => isWall(x, y) && isWall(x - 6, y) && isWall(x + 6, y) && isWall(x, y - 6) && isWall(x, y + 6);
      for (const fy of [0.45, 0.3, 0.6, 0.2]) for (const fx of [0.88, 0.12, 0.8, 0.2, 0.72, 0.28, 0.97, 0.03]) {
        if (roomy(innerWidth * fx, innerHeight * fy)) return { x: innerWidth * fx, y: innerHeight * fy };
      }
      for (let y = 12; y < innerHeight - 12; y += 4) for (let x = 12; x < innerWidth - 12; x += 8) if (roomy(x, y)) return { x, y };
      return null;
    });
    const isHidden = () => page.evaluate(() => document.querySelector('#app .home')?.classList.contains('ui-hidden'));
    // (held 1.2 s: twice the 600 ms, so a busy page's late timer still fires before the finger lifts)
    const longPress = async (at) => { await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.waitForTimeout(1200); await page.mouse.up(); await settle(page, 300); };
    const wall = await findWall();
    if (check(!!wall, `${vp} a spot on the wallpaper (${JSON.stringify(wall)})`)) {
      await longPress(wall);
      const lp = await page.evaluate(() => ({ hidden: document.querySelector('#app .home')?.classList.contains('ui-hidden'), restore: !document.querySelector('[data-testid="lobby-restore"]').hidden }));
      check(lp.hidden && lp.restore, `${vp} a long press on the wallpaper hides the UI (${JSON.stringify(lp)})`);
      const wall2 = await findWall();
      if (wall2) await longPress(wall2);
      check(!!wall2 && !(await isHidden()), `${vp} … and another brings it back (${JSON.stringify(wall2)})`);
      const wall3 = await findWall();
      if (wall3) { await page.mouse.click(wall3.x, wall3.y); await settle(page, 200); }
      check(!!wall3 && !(await isHidden()), `${vp} … a plain tap there does nothing`);
    }
    if (await isHidden()) { await page.click('[data-testid="lobby-restore"]'); await settle(page, 200); }
    await page.click('[data-testid="top-menu"]');
    await page.waitForSelector('[data-testid="menu-sheet"] [data-testid="lobby-bg"]', { timeout: 5000 });
    await settle(page, 300);
    await page.click('[data-testid="lobby-bg"]');
    check(!!(await page.waitForSelector('[data-testid="bgp-done"]', { timeout: 5000 }).catch(() => null)), `${vp} the background tool opens the background and secretary picker`);
    await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));
    // 8. Story and the Journal load the scene player's styles (story.css: .sp is a fixed full-screen layer); back on the
    // home, nothing of it covers the home: its centre is the home's, and Battle takes a tap
    for (const r of ['story', 'journal']) {
      await go(page, `#/${r}`, r);
      await go(page, '#/lobby', 'lobby');
      const c = await page.evaluate(() => {
        const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
        return { home: !!e?.closest('#app .home'), sp: document.querySelectorAll('.sp').length, el: e ? `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}` : null };
      });
      check(c.home && !c.sp, `${vp} after ${r}: the element at the home's centre is the home's (${c.el}; .sp elements ${c.sp})`);
      await page.click('[data-testid="tile-mission"]', { timeout: 15000 }).catch(() => {});
      await page.waitForFunction(() => document.querySelector('#app')?.dataset.screen === 'missions', null, { timeout: 15000 }).catch(() => {});
      check(await screenIs(page) === 'missions', `${vp} after ${r}: Battle takes a tap and opens Missions (now ${await screenIs(page)})`);
    }
    if (W >= 1000) await keyChecks(page, vp);
    // a full illustration whose girl stands right of the middle (Hikari's rampart): the corners stay (Battle bottom
    // right), her face comes toward the middle, her face and hair clear of every control (rampartChecks)
    if (W > H) {
      await homeWith(page, { secretary: 'hikari', lobbyBg: { hikari: 'hikari-rampart' } });
      await page.waitForFunction(() => window.__sakura?.home?.current?.() === 'hikari', null, { timeout: 15000 }).catch(() => {});
      await settle(page, 400);
      await rampartLayout(page, vp, W, H);
      await shot(page, 'home-illustration', vp);
      await homeWith(page, { secretary: 'hikari', lobbyBg: { hikari: 'hikari-day' } });
    }
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

/** Battle bottom right, her face toward the middle, her face (CORE) and hair (placeFull's head box) clear of every
 * control (the top bar's "+" included), and the controls clear of her body box's middle (a full illustration). */
async function rampartLayout(page, vp, W, H) {
  const m = await page.evaluate(() => {
    const pl = window.__sakura.home.placement();
    const sc = pl?.scene;
    const plate = document.querySelector('#app .home-plate').getBoundingClientRect();
    if (!sc) return null;
    const r = sc.r;
    const ctl = [...document.querySelectorAll('#app .home button, #app .home a[href]')].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => {
      const b = e.getBoundingClientRect();
      return { name: e.dataset.testid || e.className.toString().slice(0, 24), x: b.left, y: b.top, w: b.width, h: b.height };
    });
    return {
      plate: { right: plate.right, bottom: plate.bottom, left: plate.left },
      faceX: sc.faceX,
      core: { x: sc.faceX - 0.85 * r, y: sc.faceY - 0.6 * r, w: 1.7 * r, h: 1.55 * r },
      hair: { x: sc.faceX - 1.1 * r, y: sc.faceY - 1.4 * r, w: 2.2 * r, h: 2.4 * r },
      ctl,
    };
  });
  if (!check(!!m, `${vp} Hikari's rampart shows as a full illustration`)) return;
  check(m.plate.left > W / 2 && Math.abs(m.plate.right - W) < 40 && Math.abs(m.plate.bottom - H) < 40, `${vp} rampart: Battle stays bottom right (plate x ${Math.round(m.plate.left)}-${Math.round(m.plate.right)})`);
  check(Math.abs(m.faceX - W / 2) <= W * 0.12, `${vp} rampart: her face toward the middle (x ${Math.round(m.faceX)} of ${W})`);
  const hitCore = m.ctl.filter((b) => overlaps(m.core, b));
  const hitHair = m.ctl.filter((b) => overlaps(m.hair, b));
  check(!hitCore.length && !hitHair.length, `${vp} rampart: her face and hair clear of every control${hitHair.length ? `; under ${hitHair.map((b) => b.name).join(', ')}` : ''}`);
}

/**
 * Text on its real pixels: each element's glyph pixels (those that change when its colour goes transparent, its halo
 * kept) against the background under them with the halo, the WCAG ratio at the 10th percentile (the worst tenth).
 */
async function glyphContrast(page, sel) {
  const items = await page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => {
    const r = e.getBoundingClientRect();
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(getComputedStyle(e).color);
    return { text: e.textContent.trim().slice(0, 20), x: Math.max(0, Math.floor(r.left)), y: Math.max(0, Math.floor(r.top)), w: Math.ceil(r.width), h: Math.ceil(r.height), fg: m ? m.slice(1, 4).map(Number) : [0, 0, 0] };
  }), sel);
  const a = (await page.screenshot()).toString('base64');
  await page.evaluate((s) => document.head.append(Object.assign(document.createElement('style'), { id: 'e2e-glyphs', textContent: `${s} { color: transparent !important; }` })), sel);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const b = (await page.screenshot()).toString('base64');
  await page.evaluate(() => document.getElementById('e2e-glyphs')?.remove());
  return page.evaluate(async ([A, B, list]) => {
    const dec = async (b64) => {
      const bmp = await createImageBitmap(new Blob([Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))], { type: 'image/png' }));
      const cv = new OffscreenCanvas(bmp.width, bmp.height);
      const cx = cv.getContext('2d');
      cx.drawImage(bmp, 0, 0);
      return { w: bmp.width, h: bmp.height, d: cx.getImageData(0, 0, bmp.width, bmp.height).data };
    };
    const [sa, sb] = [await dec(A), await dec(B)];
    const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const L = (r, g, bl) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl);
    return list.map((it) => {
      const lf = L(...it.fg);
      const out = [];
      for (let y = it.y; y < Math.min(sa.h, it.y + it.h); y++) {
        for (let x = it.x; x < Math.min(sa.w, it.x + it.w); x++) {
          const i = (y * sa.w + x) * 4;
          if (Math.abs(sa.d[i] - sb.d[i]) + Math.abs(sa.d[i + 1] - sb.d[i + 1]) + Math.abs(sa.d[i + 2] - sb.d[i + 2]) < 45) continue;
          const lb = L(sb.d[i], sb.d[i + 1], sb.d[i + 2]);
          out.push((Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05));
        }
      }
      out.sort((p, q) => p - q);
      return { text: it.text, n: out.length, p10: out.length ? out[Math.floor(out.length * 0.1)] : null };
    });
  }, [a, b, items]);
}

async function rampartChecks(vp) {
  console.log(`\n== ${vp}: Hikari's rampart (a bright full illustration) ==`);
  const { context, page, errors, W, H } = await openHome(vp, { reduced: true });
  try {
    await homeWith(page, { secretary: 'hikari', lobbyBg: { hikari: 'hikari-rampart' }, settings: { quality: 'high', reduceMotion: false } });
    await page.waitForFunction(() => window.__sakura?.home?.current?.() === 'hikari', null, { timeout: 15000 }).catch(() => {});
    await settle(page, 600);
    await rampartLayout(page, vp, W, H);
    const c = await glyphContrast(page, '#app .home-ico .lbl, #app .home-top .serial');
    const low = c.filter((x) => x.p10 != null && x.p10 < 4.5);
    check(c.length >= 5 && !low.length, `${vp} rampart: the icons' caps and the serial at 4.5:1 or more (${c.map((x) => `${x.text} ${x.p10 == null ? '-' : x.p10.toFixed(2)}`).join(', ')})`);
    await shot(page, 'home-rampart', vp);
    check(!errors.length, `${vp} rampart: no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  } finally {
    await context.close();
  }
}

/** 10. The home by keyboard (a desktop context: no touch). */
async function keyChecks(page, vp) {
  const tid = (t) => `[data-testid="${t}"]`;
  const active = () => page.evaluate(() => { const e = document.activeElement; return !e || e === document.body ? 'BODY' : (e.dataset.testid || e.tagName); });
  await go(page, '#/lobby', 'lobby');
  await page.evaluate(() => document.activeElement?.blur());
  // (the first Tab after a screen change may stop on the page itself)
  let first = 'BODY';
  for (let i = 0; i < 3 && first === 'BODY'; i++) {
    await page.keyboard.press('Tab');
    first = await active();
  }
  check(first === 'account-level', `${vp} keys: Tab reads the top bar first (${first})`);
  // the pager keeps the focus through its page turns
  await page.focus(tid('lobby-news-next'));
  const p0 = await page.evaluate(() => document.querySelector('[data-testid="lobby-news-next"]').textContent.trim());
  await page.keyboard.press('Enter');
  await settle(page, 300);
  const f1 = await active();
  await page.keyboard.press('Enter');
  await settle(page, 300);
  const p2 = await page.evaluate(() => document.querySelector('[data-testid="lobby-news-next"]').textContent.trim());
  check(f1 === 'lobby-news-next' && (await active()) === 'lobby-news-next' && p2 !== p0, `${vp} keys: the pager keeps the focus, Enter twice turns two pages (${p0} → ${p2}, focus ${f1})`);
  // a redraw (a store change) keeps the focus on an icon
  await page.focus(tid('dock-mall'));
  await page.evaluate(() => window.__sakura.store.commit('e2e'));
  await settle(page, 200);
  check(await active() === 'dock-mall', `${vp} keys: a redraw keeps the focus on the focused icon (${await active()})`);
  // the menu sheet: Tab stays inside it; Esc gives the focus back to the menu button
  await page.focus(tid('top-menu'));
  await page.keyboard.press('Enter');
  await page.waitForSelector(tid('menu-sheet'), { timeout: 5000 });
  await settle(page, 400);
  const outside = [];
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press(i < 13 ? 'Tab' : 'Shift+Tab');
    if (!(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="menu-sheet"]')))) outside.push(await active());
  }
  check(!outside.length, `${vp} keys: Tab and Shift+Tab stay in the menu sheet (left it for ${outside.join(', ') || 'nothing'})`);
  await page.keyboard.press('Escape');
  await settle(page, 300);
  check(await active() === 'top-menu', `${vp} keys: Esc closes the sheet and the focus goes back to the menu button (${await active()})`);
  // its X and a tap outside do the same
  await page.keyboard.press('Enter');
  await page.waitForSelector(tid('menu-sheet-close'), { timeout: 5000 });
  await settle(page, 300);
  await page.focus(tid('menu-sheet-close'));
  await page.keyboard.press('Enter');
  await settle(page, 300);
  check(await active() === 'top-menu', `${vp} keys: its X gives the focus back to the menu button (${await active()})`);
  // a row takes Space; Esc closes the Notice it opens
  await page.keyboard.press('Enter');
  await page.waitForSelector(tid('shortcut-notice'), { timeout: 5000 });
  await settle(page, 300);
  await page.focus(tid('shortcut-notice'));
  await page.keyboard.press('Space');
  const notice = !!(await page.waitForSelector('.modal-overlay', { timeout: 5000 }).catch(() => null));
  await settle(page, 300);
  await page.keyboard.press('Escape');
  await settle(page, 400);
  const closed = await page.evaluate(() => !document.querySelector('.modal-overlay:not(.closing)'));
  check(notice && closed && (await screenIs(page)) === 'lobby', `${vp} keys: Space on the Notice row opens it, Esc closes it, the home stays (${notice}, ${closed})`);
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()));
}

/** 9. Marumi on a small phone: her still portrait where her living scene would reach a control. */
async function smallLiveChecks(vp) {
  console.log(`\n== ${vp}: Marumi on a small phone (motion allowed) ==`);
  const { context, page, errors } = await openHome(vp, { reduced: false });
  try {
    await homeWith(page, { secretary: 'marumi', settings: { quality: 'high', reduceMotion: false } });
    await page.waitForFunction(() => window.__sakura?.live?.state !== 'loading', null, { timeout: 20000 }).catch(() => {});
    await settle(page, 400);
    const s = await page.evaluate(() => ({ state: window.__sakura.live.state, why: window.__sakura.live.why, canvases: document.querySelectorAll('canvas[data-live]').length, fig: !!document.querySelector('#app .home-fig img') }));
    check(s.canvases === 0 && s.fig && s.state === 'static' && s.why === 'fit', `${vp} her living scene would reach a control here: her still portrait, no canvas (${JSON.stringify(s)})`);
    // (her breath paused: its layer changes how the words around are drawn, which the pixel diff would count)
    await page.evaluate(() => document.head.append(Object.assign(document.createElement('style'), { textContent: '#app .home .home-fig { animation: none !important; }' })));
    await settle(page, 200);
    const art = await artClearance(page, '#app [data-testid="secretary-art"]', UI, { min: 8 });
    check(art.fails === 0, `${vp} Marumi's still art 8 px clear of every control: ${art.checks.length - art.fails}/${art.checks.length}${art.fails ? ` — ${art.checks.filter((c) => !c.ok).map((c) => c.msg).slice(0, 3).join('; ')}` : ''}`);
    const pl = await page.evaluate(() => window.__sakura.home.placement());
    const hit = (await boxesOf(page)).filter((b) => overlaps(pl.face, b));
    check(pl.fits !== false && !hit.length, `${vp} her face box clear of every control${hit.length ? `; under ${hit.map((b) => b.name).join(', ')}` : ''}`);
    await shot(page, 'home-marumi-small', vp);
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
    await page.evaluate(() => window.__sakura.live.start());
    // the news chip never turns on its own, motion allowed too (UI v2 rule 11, P8): the running event leads it
    const p0 = await page.evaluate(() => document.querySelector('#app [data-testid="lobby-news"]')?.dataset.page);
    await page.waitForTimeout(8000);
    const p1 = await page.evaluate(() => document.querySelector('#app [data-testid="lobby-news"]')?.dataset.page);
    check(p0 === 'event' && p1 === p0, `${vp} motion allowed: the news chip opens on the running event and stays there (8 s: ${p0} → ${p1})`);
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
  for (const vp of rampartSizes) await rampartChecks(vp);
  for (const vp of smallSizes) await smallLiveChecks(vp);
} finally {
  await browser.close();
  await server.close();
}
console.log(`\n${oks} ok, ${fails.length} failed`);
if (fails.length) console.log(`HOME FAIL:\n  ${fails.join('\n  ')}`);
else console.log('HOME PASS');
process.exit(fails.length ? 1 : 0);

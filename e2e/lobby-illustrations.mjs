// Home backgrounds in two categories (owner, Oct 23: "There are two categories, like the character with the castle
// backdrop as a default and everyone will have a full illustration alt", "you dont need the speech bubbles for these
// full illustration ones"), on the UI v2 "Ink & Paper" home, layout B "Quiet Home" (src/ui/screens/lobby.js,
// src/ui/lobby/artStage.js), in the real game at phone, tablet and PC sizes, on the mock-ups' sample save
// (uiSeed.mjs seedInkSave, plus the girls with a full illustration the seed does not own: Yoriko and the seven academy
// girls), under the system's Reduce motion (so Marumi shows her still stand, not her living scene):
//   - the default for every girl (Marumi, Rei, Hikari) is her stand over the academy backdrop (its baked night copy);
//     no bubble at rest (the new home has no greeting), her bubble on a tap, a head pat line on a tap on her face; her
//     art 8 px clear of every control (pixels.mjs artClearance) and her face box clear of every control;
//   - every full illustration (src/data/lobbyIllustrations.js) fills the home: no stand, no backdrop, and no speech
//     bubble, not at rest and not for a tap; shown WHOLE as painted (placement().scene.zoom 1, the picture's rendered
//     width max(W, H * its aspect), covering the screen), her 3:4 full art on a portrait screen for a `tall` row; her
//     face core (faceX ± 0.85 r, faceY - 0.6 r .. + 0.95 r) on screen and clear of every control at every size, her hair
//     box clear where placeFull says the picture could pan (scene.clearCtl); nothing shifts while it loads; a tap on her
//     head reaches her and gives hearts (the old stage's .lb-art-heart: any element whose class names a heart counts);
//   - the picker (the menu sheet's Background tool, lobby-bg) shows a thumbnail per entry under "Backdrops" and "Full
//     illustrations", picking one there changes the home, and the choice survives a reload;
//   - during the Halloween window (event dev clock pinned) her stand has the event's painted backdrop (graded in CSS, no
//     tint) and no overlay lanterns or pumpkins anywhere; one more pass checks the home after the event (the baked
//     academy); a full illustration holds still (no running animation in the stage, no canvas, its box fixed) with
//     motion allowed, under Reduce motion and on Low graphics;
//   - every home control takes a tap at its centre (elementFromPoint is the control or inside it) at every size, and a
//     real tap on Battle, STUDENTS, mail and the menu opens the right screen (the menu sheet for the menu).
// Dropped from the old lobby script (v0.1.48-v0.1.53): the ‹ › chevrons and the carousel dots (the secretary is changed
// from the picker now), the allowed cover of the › chevron below 760 px, and "her face under the top bar" (the quiet
// home's rule is her face core clear of every control; the floating bar may pass over the top of her hair where the
// picture has no room to pan, placeFull).
// Usage: node e2e/lobby-illustrations.mjs [--shots dir] [--sizes 844x390,1280x720] [--tap-sizes 915x412,740x360]
//          [--port 5204] [--gpu]
//   --tap-sizes: more sizes for the home controls check alone (default 915x412 and 740x360 when --sizes is not given;
//     --sizes none runs only those, the after-event pass and the still checks)
//   --gpu: the system Chrome with GPU rasterising (Windows desktop); without it e2e/browser.mjs picks the browser.
// Playwright / the browser are found by e2e/browser.mjs (PLAYWRIGHT_MODULE / NODE_PATH, CHROME_PATH).
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium, loadPlaywright } from './browser.mjs';
import { artClearance } from './pixels.mjs';
import { seedInkSave, inkRandomInit, INK_NOW, INK_RANDOM_SEED } from './uiSeed.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const SHOTS = opt('shots', null);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const isSize = (s) => /^\d+x\d+$/.test(s);
// (--sizes none: the controls check at --tap-sizes, the after-event pass and the still checks only)
const SIZES = opt('sizes', '844x390,1280x720,667x375,932x430,1024x768,1180x820,390x844').split(',').filter(isSize);
const TAP_SIZES = opt('tap-sizes', args.includes('--sizes') ? '' : '915x412,740x360').split(',').filter((s) => isSize(s) && !SIZES.includes(s));
const PORT = Number(opt('port', '0'));
const DEFAULT_GIRLS = ['marumi', 'rei', 'hikari'];
/** The girls with a full illustration that the ink seed does not own (granted in the page). */
const EXTRA_GIRLS = ['yoriko', 'azami', 'chigusa', 'kinu', 'ouka', 'wakaba', 'yuzuha'];
const HEAD_PAT = /halo is not a button|one more pat|what are you doing|keep patting/i;
/** the event dev clock: inside the Halloween window (its painted backdrop is up), and after the event */
const DURING_EVENT = '2026-10-24T18:00:00Z';
const AFTER_EVENT = '2026-12-01T18:00:00Z';
/** The home's controls (as e2e/home.mjs): the boxes her art and her face keep clear of. */
const UI = '#app .home-top > *, #app .home-dock > .home-ico, #app .home-news-host .ui-news, #app .home-plate, #app .home-coop';

const server = await createServer({ root: process.cwd(), server: { port: PORT, strictPort: PORT > 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
let browser;
let label;
if (args.includes('--gpu')) {
  const { chromium } = await loadPlaywright();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
  label = `system Chrome ${browser.version()} (GPU)`;
} else ({ browser, label } = await launchChromium());
console.log(`browser: ${label}`);
const fails = [];
let oks = 0;
const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (c) oks += 1; else fails.push(m); return c; };
const overlaps = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
const settle = (page, ms = 120) => page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, t)))), ms);
const shot = async (page, name) => {
  if (!SHOTS) return;
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
};
const clean = (page) => page.evaluate(() => document.querySelectorAll('.modal-overlay, .toast, .jn-toast, .ach-toast').forEach((n) => n.remove()));
const screenIs = (page) => page.evaluate(() => document.querySelector('#app')?.dataset.screen);

/** To a route and settled (as e2e/home.mjs go). */
async function go(page, hash, screen) {
  await page.evaluate((hh) => { location.hash = hh; }, hash);
  await page.waitForFunction((s) => document.querySelector('#app')?.dataset.screen === s && !document.documentElement.dataset.tx, screen, { timeout: 30000 }).catch(() => {});
  await clean(page);
  await settle(page, 700);
}

/** The system's Reduce motion off (allowed) or on, and the home drawn again under it. */
async function setMotion(page, allowed) {
  await page.emulateMedia({ reducedMotion: allowed ? 'no-preference' : 'reduce' });
  await go(page, '#/missions', 'missions');
  await go(page, '#/lobby', 'lobby');
}

/**
 * Makes her the secretary through the live store: on her default (bg null) or on that background. Waits for the
 * picture to be in, alone. Resets the layout-shift sum first.
 */
async function secretary(page, girl, bg = null) {
  const want = await page.evaluate(async ({ girl, bg }) => {
    const { store } = window.__sakura;
    const { grantUnit } = await import('/src/systems/unlocks.js');
    const { chooseBackground, defaultBackgroundFor } = await import('/src/data/lobbyArt.js');
    const p = store.profile;
    if (!p.units[girl]) grantUnit(p, girl);
    window.__cls = 0;
    document.querySelectorAll('.modal-overlay').forEach((n) => n.remove());
    if (bg) {
      chooseBackground(p, bg);
      store.commit('lobby-bg');
      return bg;
    }
    if (p.lobbyBg) delete p.lobbyBg[girl];
    p.secretary = girl;
    store.commit('secretary');
    return defaultBackgroundFor(girl);
  }, { girl, bg });
  await page.waitForFunction(({ id, girl }) => {
    const layers = [...document.querySelectorAll('#app .home-scene-layer')];
    return layers.length === 1 && layers[0].dataset.bg === id && window.__sakura?.home?.current?.() === girl;
  }, { id: want, girl }, { timeout: 20000 });
  await page.waitForTimeout(600);
  await clean(page);
  await settle(page);
  return want;
}

/** Everything the checks need, measured in the page (px from the top-left of the screen). */
const measure = (page) => page.evaluate(() => {
  const box = (n) => { const r = n.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const host = document.querySelector('#app .home-stage-host');
  const layer = document.querySelector('#app .home-scene-layer');
  const sceneImg = layer?.querySelector('img');
  const fig = document.querySelector('#app [data-testid="secretary-art"] .home-fig img');
  const bubble = document.querySelector('#app [data-testid="secretary-bubble"]');
  const pl = window.__sakura.home.placement();
  const shown = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[aria-hidden="true"], .ghost');
  const ctl = [...document.querySelectorAll('#app .home button, #app .home a[href], #app .home [role="button"]')].filter(shown).map((e) => ({ name: e.dataset.testid || e.className.toString().slice(0, 24), ...box(e) }));
  const ui = [...document.querySelectorAll('#app .home-top > *, #app .home-dock > .home-ico, #app .home-news-host .ui-news, #app .home-plate, #app .home-coop')]
    .filter((e) => e.getClientRects().length).map((e) => ({ name: e.dataset.testid || e.className.toString().slice(0, 24), ...box(e) }));
  const [fx, fy, fr] = (host?.dataset.face || '').split(',').map(Number);
  const bs = bubble ? getComputedStyle(bubble) : null;
  return {
    bg: layer?.dataset.bg || '',
    full: !!layer?.classList.contains('full'),
    variant: layer?.dataset.variant || null,
    illustration: !!host?.classList.contains('home-illustration'),
    sceneSrc: sceneImg?.currentSrc || sceneImg?.src || '',
    sceneCls: sceneImg?.className || '',
    sceneNat: sceneImg ? [sceneImg.naturalWidth, sceneImg.naturalHeight] : null,
    sceneAttrs: sceneImg ? [sceneImg.getAttribute('width'), sceneImg.getAttribute('height')] : null,
    sceneStyle: sceneImg ? [sceneImg.style.left, sceneImg.style.top, sceneImg.style.width, sceneImg.style.height] : null,
    sceneBox: sceneImg ? box(sceneImg) : null,
    tint: !!layer?.querySelector('.home-tint'),
    stand: !!fig,
    figSrc: fig?.currentSrc || fig?.src || '',
    figNat: fig ? [fig.naturalWidth, fig.naturalHeight] : null,
    face: host?.dataset.face ? { x: fx, y: fy, r: fr } : null,
    pl: pl ? { face: pl.face || null, faceX: pl.faceX, faceY: pl.faceY, fits: pl.fits, scene: pl.scene ? { zoom: pl.scene.zoom, faceX: pl.scene.faceX, faceY: pl.scene.faceY, r: pl.scene.r, clearCtl: pl.scene.clearCtl } : null } : null,
    bubbleShown: !!bubble && bubble.classList.contains('show') && bs.display !== 'none' && Number(bs.opacity) > 0.05,
    bubbleText: bubble?.textContent || '',
    canvases: document.querySelectorAll('canvas[data-live]').length,
    ctl,
    ui,
    cls: window.__cls || 0,
  };
});

/** Taps at (x, y), counting the hearts added anywhere (any element whose class names a heart) and reading her bubble. */
async function tap(page, x, y, touch) {
  await page.evaluate(() => {
    window.__hearts = 0;
    window.__heartObs?.disconnect();
    window.__heartObs = new MutationObserver((list) => {
      for (const rec of list) {
        for (const n of rec.addedNodes) {
          if (n.nodeType !== 1) continue;
          for (const e of [n, ...n.querySelectorAll('*')]) if (/heart/i.test(String(e.className?.baseVal ?? e.className ?? ''))) window.__hearts += 1;
        }
      }
    });
    window.__heartObs.observe(document.body, { childList: true, subtree: true });
  });
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    window.__heartObs?.disconnect();
    const b = document.querySelector('#app [data-testid="secretary-bubble"]');
    return { hearts: window.__hearts, bubble: !!b?.classList.contains('show'), text: b?.textContent || '' };
  });
}

/** A point on her (inside her tap area, nothing over it) near (x, y): tried there and around, between `below` and `above`. */
const pointOnHer = (page, x, y, { below = -1e9, above = 1e9 } = {}) => page.evaluate(([x0, y0, lo, hi]) => {
  const art = document.querySelector('#app [data-testid="secretary-art"]');
  for (const dy of [0, 10, -10, 20, -20, 30, 40, 60, 80]) {
    for (const dx of [0, -12, 12, -24, 24, -40, 40]) {
      const x = Math.round(x0 + dx);
      const y = Math.round(y0 + dy);
      if (x < 2 || y < 2 || x > innerWidth - 2 || y > innerHeight - 2 || y < lo || y > hi) continue;
      const e = document.elementFromPoint(x, y);
      if (e && art.contains(e)) return [x, y];
    }
  }
  return null;
}, [x, y, below, above]);

/** Opens the picker from the menu sheet's Background tool and reads its groups. */
async function openPicker(page) {
  await page.locator('[data-testid="top-menu"]').click();
  await page.waitForSelector('[data-testid="menu-sheet"] [data-testid="lobby-bg"]', { timeout: 5000 });
  await page.waitForTimeout(350);
  await page.locator('[data-testid="lobby-bg"]').click();
  await page.waitForSelector('[data-testid="bgp-group-full"]', { timeout: 10000 });
  await page.waitForTimeout(400);
  // the tiles' thumbs are lazy: bring each into view so it loads
  await page.evaluate(async () => {
    for (const t of document.querySelectorAll('.bgp-tile')) t.scrollIntoView({ block: 'nearest' });
    document.querySelector('.bgp-groups').scrollTop = 0;
    await Promise.all([...document.querySelectorAll('.bgp-tile img')].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 4000); }))));
  });
  return page.evaluate(() => [...document.querySelectorAll('.bgp-group')].map((g) => ({
    id: g.dataset.testid,
    head: g.querySelector('.bgp-group-head')?.textContent || '',
    tiles: [...g.querySelectorAll('.bgp-tile')].map((t) => {
      const imgs = [...t.querySelectorAll('.bgp-thumb img')];
      return { id: t.dataset.testid.replace(/^bgp-/, ''), on: t.classList.contains('on'), locked: t.classList.contains('locked'), name: t.querySelector('.bgp-tile-name b')?.textContent || '', thumb: imgs.length > 0 && imgs.every((i) => i.naturalWidth > 0) };
    }),
  })));
}

/** Closes the picker by Done and waits for the home to show that background. */
async function pickerDone(page, bg) {
  await page.locator('[data-testid="bgp-done"]').click();
  await page.waitForFunction((id) => document.querySelectorAll('#app .home-scene-layer').length === 1 && document.querySelector('#app .home-scene-layer').dataset.bg === id, bg, { timeout: 15000 });
  await page.waitForTimeout(700);
  await clean(page);
}

/**
 * Every home control takes a tap at its centre: elementFromPoint there is the control or inside it (a box drawn over
 * it, even an empty one, would take the tap). Then a real tap on Battle, STUDENTS, mail and the menu opens its screen.
 */
async function controlsPass(page, tag, touch) {
  await clean(page);
  await settle(page);
  const res = await page.evaluate(() => {
    const nm = (e) => (e ? `${e.tagName.toLowerCase()}${e.dataset?.testid ? `[${e.dataset.testid}]` : `.${String(e.className?.baseVal ?? e.className).split(' ').filter(Boolean).slice(0, 2).join('.')}`}` : 'nothing');
    const home = document.querySelector('#app .home');
    const out = [];
    for (const n of home.querySelectorAll('button, [role="button"], a[href]')) {
      if (!n.getClientRects().length || getComputedStyle(n).visibility === 'hidden' || n.closest('[aria-hidden="true"], .ghost') || n.hidden) continue;
      const r = n.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const x = Math.round(r.left + r.width / 2);
      const y = Math.round(r.top + r.height / 2);
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) { out.push({ name: nm(n), id: n.dataset.testid || '', x, y, own: false, by: 'off screen' }); continue; }
      // (a piece clipped by its own scroller: its centre is clipped away, not covered)
      let clipped = false;
      for (let a = n.parentElement; a && a !== home && !clipped; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
        const ar = a.getBoundingClientRect();
        clipped = x < ar.left || x > ar.right || y < ar.top || y > ar.bottom;
      }
      if (clipped) continue;
      const t = document.elementFromPoint(x, y);
      out.push({ name: nm(n), id: n.dataset.testid || '', x, y, own: !!t && (t === n || n.contains(t)), by: nm(t) });
    }
    return out;
  });
  const covered = res.filter((c) => !c.own);
  check(res.length >= 10 && !covered.length, `${tag}: ${covered.length ? `${covered.length} of ${res.length} controls covered at their centre` : `all ${res.length} controls take a tap at their centre`}${covered.length ? `: ${covered.map((c) => `${c.name} under ${c.by}`).join(' | ')}` : ''}`);
  // a real tap at the centre of a few opens the right screen
  for (const [id, want] of [['tile-mission', 'missions'], ['dock-students', 'students'], ['top-mail', 'mail'], ['top-menu', 'menu']]) {
    const c = res.find((x) => x.id === id);
    if (!check(!!c, `${tag}: ${id} is on the home`)) continue;
    if (touch) await page.touchscreen.tap(c.x, c.y);
    else await page.mouse.click(c.x, c.y);
    let now;
    if (want === 'menu') {
      now = await page.waitForSelector('[data-testid="menu-sheet"]', { timeout: 4000 }).then(() => 'menu').catch(() => screenIs(page));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    } else {
      await page.waitForFunction((s) => document.querySelector('#app')?.dataset.screen === s, want, { timeout: 8000 }).catch(() => {});
      now = await screenIs(page);
    }
    check(now === want, `${tag}: a tap on ${id} (${c.x},${c.y}) opens ${want} (${now})`);
    if (want !== 'menu') await go(page, '#/lobby', 'lobby');
  }
  await clean(page);
}

/** Opens the home at that size with the event dev clock at `now` (the system's Reduce motion unless `motion`). */
async function openHome(W, H, now, { motion = false } = {}) {
  const touch = Math.min(W, H) < 600;
  const context = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, reducedMotion: motion ? 'no-preference' : 'reduce', timezoneId: 'America/Chicago' });
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.clock.setFixedTime(new Date(INK_NOW));
  await page.addInitScript((at) => {
    try { sessionStorage.setItem('sakura-beta-gift-shown', '1'); } catch { /* none */ }
    try { sessionStorage.setItem('sakura-ui-rotate-dismissed', '1'); } catch { /* none */ }
    try { localStorage.setItem('sakura-dev-now', at); } catch { /* none */ }
    document.addEventListener('DOMContentLoaded', () => document.head.append(Object.assign(document.createElement('style'), { textContent: '.toast-host, .jn-toast { display: none !important; }' })));
    // layout shifts while a picture swaps in (the box is reserved, so none are expected)
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls = (window.__cls || 0) + e.value; }).observe({ type: 'layout-shift' }); } catch { /* old engine */ }
  }, now);
  await page.addInitScript(inkRandomInit, INK_RANDOM_SEED);
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load', timeout: 90000 });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 30000 });
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 4000 }).catch(() => null);
  if (later) await later.click({ force: true });
  await seedInkSave(page);
  await page.evaluate(async (extra) => {
    const { store } = window.__sakura;
    const { grantUnit } = await import('/src/systems/unlocks.js');
    for (const id of extra) if (!store.profile.units[id]) grantUnit(store.profile, id, 1760000000000);
    store.commit('e2e');
    store.saveNow?.();
  }, EXTRA_GIRLS);
  await page.waitForSelector('[data-testid="lobby"][data-layout="b"]', { timeout: 60000 });
  await page.waitForTimeout(1200); // the entrance settles
  await clean(page);
  return { context, page, errs, touch };
}

/** The home controls check alone, at one more size (each default stand, the event on). */
async function controlsOnly(size) {
  const [W, H] = size.split('x').map(Number);
  console.log(`\n== ${size} controls ==`);
  const { context, page, errs, touch } = await openHome(W, H, DURING_EVENT);
  try {
    for (const girl of DEFAULT_GIRLS) {
      await secretary(page, girl);
      await controlsPass(page, `${size} controls (${girl})`, touch);
    }
    await shot(page, `${size}-controls`);
  } finally {
    check(!errs.length, `${size} controls: no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    await context.close();
  }
}

/** Her full illustration as painted (zoom 1, the cover fit), her face core on screen and clear, her hair where it can pan. */
function fullLayoutChecks(tag, m, W, H) {
  const sc = m.pl?.scene;
  if (!check(!!sc && m.sceneNat?.[0] > 0, `${tag}: placed as a full illustration (${sc ? `face ${Math.round(sc.faceX)},${Math.round(sc.faceY)} r${Math.round(sc.r)}` : 'no scene placement'})`)) return;
  const cover = Math.max(W, H * (m.sceneNat[0] / m.sceneNat[1]));
  const b = m.sceneBox;
  check(sc.zoom === 1 && Math.abs(b.w - cover) < 1 && b.x <= 0.5 && b.y <= 0.5 && b.x + b.w >= W - 0.5 && b.y + b.h >= H - 0.5,
    `${tag}: the whole picture as painted, never zoomed (zoom ${sc.zoom}, ${Math.round(b.w)}x${Math.round(b.h)} at ${Math.round(b.x)},${Math.round(b.y)}; cover ${Math.round(cover)} wide)`);
  const r = sc.r;
  const core = { x: sc.faceX - 0.85 * r, y: sc.faceY - 0.6 * r, w: 1.7 * r, h: 1.55 * r };
  const hair = { x: sc.faceX - 1.1 * r, y: sc.faceY - 1.4 * r, w: 2.2 * r, h: 2.4 * r };
  check(core.x >= 0 && core.y >= 0 && core.x + core.w <= W && core.y + core.h <= H, `${tag}: her face core on screen (${[core.x, core.y, core.w, core.h].map(Math.round).join(',')})`);
  const hitCore = m.ctl.filter((c) => overlaps(core, c));
  const hitHair = m.ctl.filter((c) => overlaps(hair, c));
  check(!hitCore.length, `${tag}: her face core clear of every control${hitCore.length ? `; under ${hitCore.map((c) => c.name).join(', ')}` : ''}`);
  check(!hitHair.length || !sc.clearCtl, `${tag}: her hair clear of every control where the picture can pan (${sc.clearCtl ? 'it can' : 'no room: the bar may pass over her hair'})${hitHair.length ? `; under ${hitHair.map((c) => c.name).join(', ')}` : ''}`);
}

/**
 * One screen size.
 * @param {string} size 'WxH'
 * @param {{ now: string, full?: boolean }} o now = the event dev clock; full = every check (else a short pass)
 */
async function sizePass(size, { now, full = true }) {
  const [W, H] = size.split('x').map(Number);
  const portrait = H > W;
  const event = now === DURING_EVENT;
  const tagSize = event ? size : `${size}-after-event`;
  console.log(`\n== ${tagSize} ==`);
  const { context, page, errs, touch } = await openHome(W, H, now);
  // the old overlay (a lantern string, two pumpkin stickers) is gone for good (owner, Oct 24: "theyre ugly")
  check(!(await page.$('[data-testid="event-decor"], .lb-ev-lanterns, .lb-ev-pumpkin')), `${tagSize}: no lantern string or pumpkin stickers over the home`);
  const rows = await page.evaluate(async () => (await import('/src/data/lobbyIllustrations.js')).FULL_ILLUSTRATIONS.map((r) => ({ id: r.id, girl: r.girl, tall: !!r.tall, file: r.file })));
  const baked = await page.evaluate(async () => [...(await import('/src/ui/lobby/artStage.js')).HOME_BAKED]);
  // (an older lobby scene with a baked night copy shows that copy: lobby/hikari.webp → lobby/hikari-home.webp)
  const wideSrc = (row) => {
    const name = row.file.startsWith('lobby/') ? row.file.slice('lobby/'.length) : null;
    return name && baked.includes(name) ? `lobby/${name.replace(/\.webp$/, '-home.webp')}` : row.file;
  };

  try {
    // ---- the default: her stand over the academy backdrop (baked night), no bubble at rest, her bubble on a tap ----
    for (const girl of full ? DEFAULT_GIRLS : ['marumi']) {
      await secretary(page, girl);
      const m = await measure(page);
      const tag = `${tagSize} ${girl} default`;
      check(m.bg === `${girl}-day` && !m.full && !m.illustration && m.stand && !m.face && m.canvases === 0, `${tag}: her stand over the backdrop (${m.bg}, canvas ${m.canvases})`);
      check(new RegExp(`portraits/${girl}-cut\\.webp`).test(m.figSrc) && m.figNat?.[0] > 0, `${tag}: her stand file (${m.figSrc.split('/').pop()} ${m.figNat?.join('x')})`);
      if (girl === 'marumi') check(m.figNat && Math.abs(m.figNat[0] / m.figNat[1] - 0.432) < 0.004, `${tag}: the restored full-body stand (${m.figNat?.join('x')}, aspect 0.432)`);
      // during Halloween her stand stands in the event's painted backdrop (graded in CSS, no tint); after it, the academy's
      // baked night copy again
      if (event) check(/lobby\/halloween\.webp/.test(m.sceneSrc) && /graded/.test(m.sceneCls) && !m.tint, `${tag}: the Halloween backdrop, no tint (${m.sceneSrc.split('/').pop()} .${m.sceneCls})`);
      else check(/lobby\/academy-home\.webp/.test(m.sceneSrc) && /baked/.test(m.sceneCls), `${tag}: the academy's night copy after the event (${m.sceneSrc.split('/').pop()} .${m.sceneCls})`);
      check(!m.bubbleShown, `${tag}: no bubble at rest (the quiet home has no greeting)`);
      const fhit = m.pl?.face ? m.ui.filter((b) => overlaps(m.pl.face, b)) : [];
      check(!!m.pl?.face && !fhit.length, `${tag}: her face box clear of every control${fhit.length ? `; under ${fhit.map((b) => b.name).join(', ')}` : ''}`);
      if (full) {
        // (the probe counts the pixels in each box grown by 8 px and rounded outward to whole device px, so art 8.0 to
        // 9 px away can be counted; a check fails here only when her nearest pixel is under 8 px away)
        const art = await artClearance(page, '#app [data-testid="secretary-art"]', UI, { min: 8 });
        const near = art.checks.filter((c) => !c.ok && !(Number(/host art ([\d.]+) px away/.exec(c.msg)?.[1]) >= 8));
        check(!near.length, `${tag}: her art 8 px clear of every control: ${art.checks.length - near.length}/${art.checks.length}${art.fails ? ` — ${art.checks.filter((c) => !c.ok).map((c) => c.msg).slice(0, 3).join('; ')}` : ''}`);
      }
      await shot(page, `${tagSize}-default-${girl}`);
      if (!full || !m.pl?.face) continue;
      // a tap on her body: her bubble; a tap on her face: a head pat line
      const f = m.pl.face;
      const body = await pointOnHer(page, m.pl.faceX, f.y + f.h + 40, { below: f.y + f.h + 4 });
      if (check(!!body, `${tag}: a point on her body that nothing covers (${body?.join(',') || 'none'})`)) {
        const t = await tap(page, body[0], body[1], touch);
        check(t.bubble && t.text.length > 3 && !HEAD_PAT.test(t.text), `${tag}: a tap on her body: her bubble ("${t.text.slice(0, 40)}")`);
      }
      const head = await pointOnHer(page, m.pl.faceX, f.y + f.h / 2, { above: f.y + f.h - 2 });
      if (check(!!head, `${tag}: a point on her face that nothing covers (${head?.join(',') || 'none'})`)) {
        const t = await tap(page, head[0], head[1], touch);
        check(t.bubble && HEAD_PAT.test(t.text), `${tag}: a tap on her face: a head pat line ("${t.text.slice(0, 40)}")`);
      }
      await page.evaluate(() => document.querySelector('#app [data-testid="secretary-bubble"]')?.classList.remove('show'));
    }
    // ---- nothing stands over a home control; a few real taps open their screens ----
    if (full) await controlsPass(page, tagSize, touch);

    // ---- every full illustration: the whole home, no stand, no backdrop, no bubble ----
    for (const row of full ? rows : rows.filter((r) => ['marumi-scene', 'yoriko-summer-breeze', 'hikari-rampart'].includes(r.id))) {
      await secretary(page, row.girl, row.id);
      const m = await measure(page);
      const tag = `${tagSize} ${row.id}`;
      const variant = portrait && row.tall ? 'tall' : 'wide';
      check(m.full && m.illustration && !m.stand && !m.tint && m.canvases === 0, `${tag}: the picture alone, no backdrop, no stand`);
      const src = variant === 'tall' ? new RegExp(`portraits/${row.girl}-full\\.webp`) : new RegExp(wideSrc(row).replace(/[.]/g, '\\.'));
      check(m.variant === variant && src.test(m.sceneSrc) && m.sceneNat?.[0] > 0, `${tag}: ${variant === 'tall' ? 'her 3:4 full art' : 'the wide picture'} (${m.variant}, ${m.sceneSrc.split('/').slice(-2).join('/')})`);
      check(!m.bubbleShown, `${tag}: no speech bubble at rest`);
      check(!!m.sceneAttrs?.[0] && !!m.sceneAttrs?.[1] && m.sceneStyle.every(Boolean) && m.cls < 0.01, `${tag}: size and place set up front, no layout shift while it loads (${m.sceneAttrs?.join('x')}, shift ${m.cls.toFixed(4)})`);
      fullLayoutChecks(tag, m, W, H);
      await shot(page, `${tagSize}-full-${row.id}`);
    }
    if (!full) return;

    // ---- taps on a full illustration: hearts, never a bubble (with motion allowed: the old stage drew no hearts under
    // Reduce motion, so the home is drawn again under the system's no-preference for these taps) ----
    await setMotion(page, true);
    for (const id of ['yoriko-summer-breeze', 'marumi-scene']) {
      const row = rows.find((r) => r.id === id);
      await secretary(page, row.girl, id);
      const m = await measure(page);
      const sc = m.pl?.scene;
      if (!sc) continue;
      const head = await pointOnHer(page, sc.faceX, sc.faceY + 0.3 * sc.r, { above: sc.faceY + sc.r - 2 });
      if (check(!!head, `${size} ${id}: a point on her head that her tap area takes (${head?.join(',') || 'none'})`)) {
        const t = await tap(page, head[0], head[1], touch);
        check(!t.bubble, `${size} ${id}: a head tap gives no bubble`);
        check(t.hearts >= 1, `${size} ${id}: a head tap gives hearts (${t.hearts})`);
      }
      const body = await pointOnHer(page, sc.faceX, Math.min(H - 60, sc.faceY + 3 * sc.r), { below: sc.faceY + sc.r + 4 });
      if (check(!!body, `${size} ${id}: a point on her body that her tap area takes (${body?.join(',') || 'none'})`)) {
        const t = await tap(page, body[0], body[1], touch);
        check(!t.bubble, `${size} ${id}: a body tap at ${body.join(',')} gives no bubble`);
      }
    }

    await setMotion(page, false);

    // ---- the picker: two groups of thumbnails; picking there changes the home; the choice persists ----
    for (const girl of ['marumi', 'yoriko']) {
      await secretary(page, girl);
      const groups = await openPicker(page);
      const tag = `${size} picker ${girl}`;
      check(groups.length === 2 && groups[0].head === 'Backdrops' && groups[1].head === 'Full illustrations', `${tag}: groups ${groups.map((g) => `"${g.head}"`).join(', ')}`);
      const back = groups[0]?.tiles.map((t) => t.id) || [];
      check(back.join() === [`${girl}-day`, `${girl}-sunset`, `${girl}-night`].join(), `${tag}: Backdrops = her three stands (${back.join(', ')})`);
      const fulls = groups[1]?.tiles || [];
      const mine = rows.filter((r) => r.girl === girl).map((r) => r.id);
      check(mine.every((id, i) => fulls[i]?.id === id && !fulls[i].locked) && fulls.length === mine.length + 2, `${tag}: Full illustrations = ${fulls.map((t) => `${t.id}${t.locked ? ' (locked)' : ''}`).join(', ')}`);
      const noThumb = groups.flatMap((g) => g.tiles).filter((t) => !t.locked && !t.thumb);
      check(!noThumb.length, `${tag}: every open tile shows its thumbnail${noThumb.length ? ` (none: ${noThumb.map((t) => t.id).join(', ')})` : ''}`);
      check(fulls[0]?.name === (girl === 'marumi' ? 'Marumi: Strike Lane' : 'Yoriko: Summer Breeze'), `${tag}: named after her and the picture ("${fulls[0]?.name}")`);
      check(groups[0]?.tiles[0]?.on, `${tag}: her default stand is the one ticked`);
      await shot(page, `${size}-picker-${girl}`);
      if (girl === 'marumi') {
        // pick her full illustration in the picker, close it: the home is the picture, with no bubble
        await page.locator('[data-testid="bgp-marumi-scene"]').click();
        await page.waitForTimeout(250);
        const on = await page.evaluate(() => document.querySelector('[data-testid="bgp-marumi-scene"]')?.classList.contains('on'));
        await pickerDone(page, 'marumi-scene');
        const m = await measure(page);
        check(on && m.full && !m.stand && !m.bubbleShown, `${tag}: picking "Strike Lane" fills the home with it, no stand, no bubble`);
        // the choice is saved: a reload opens on it
        await page.evaluate(() => window.__sakura.store.saveNow?.());
        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('[data-testid="lobby"]', { timeout: 60000 });
        await page.waitForFunction(() => document.querySelectorAll('#app .home-scene-layer').length === 1, null, { timeout: 20000 });
        await page.waitForTimeout(1500);
        await clean(page);
        const r = await measure(page);
        check(r.bg === 'marumi-scene' && r.full && !r.bubbleShown, `${tag}: after a reload the home is still "Strike Lane" (${r.bg}), with no bubble`);
        // back to her backdrop in the picker: her stand returns (and stays quiet until a tap)
        await openPicker(page);
        await page.locator('[data-testid="bgp-marumi-day"]').click();
        await page.waitForTimeout(250);
        await pickerDone(page, 'marumi-day');
        const home = await measure(page);
        check(!home.full && home.stand && !home.bubbleShown, `${tag}: back to her backdrop: her stand, no bubble until a tap`);
        await shot(page, `${size}-default-marumi-after-picker`);
      } else await clean(page);
    }

    // ---- turning the phone with a full illustration up: her 3:4 full art, her face on screen and clear ----
    if (event && size === '844x390') {
      await secretary(page, 'marumi', 'marumi-scene');
      for (const [w, h] of [[390, 844], [844, 390]]) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(1200);
        const m = await measure(page);
        const tag = `turned to ${w}x${h} marumi-scene`;
        check(m.variant === (h > w ? 'tall' : 'wide') && !m.bubbleShown, `${tag}: ${m.variant}, no bubble`);
        fullLayoutChecks(tag, m, w, h);
      }
    }
  } finally {
    check(!errs.length, `${tagSize}: no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    await context.close();
  }
}

try {
  for (const size of SIZES) await sizePass(size, { now: DURING_EVENT });
  // the home controls check at the landscape phones the main sizes leave out
  for (const size of TAP_SIZES) await controlsOnly(size);
  // the home without the event: the same layouts, the academy again
  await sizePass('844x390', { now: AFTER_EVENT, full: false });

  // a full illustration holds still (no running animation in the stage, no canvas, its box fixed): with motion allowed
  // on High, under the Reduce motion setting, and on Low graphics
  console.log('\n== still checks (844x390, motion allowed) ==');
  const { context, page, errs } = await openHome(844, 390, DURING_EVENT, { motion: true });
  try {
    for (const [name, settings] of [['High, motion allowed', { quality: 'high', reduceMotion: false }], ['Reduce motion', { quality: 'high', reduceMotion: true }], ['Low graphics', { quality: 'low', reduceMotion: false }]]) {
      await go(page, '#/missions', 'missions');
      await page.evaluate((s) => {
        const { store } = window.__sakura;
        Object.assign(store.profile.settings, s);
        document.documentElement.toggleAttribute('data-reduce-motion', !!s.reduceMotion);
        store.commit('settings');
      }, settings);
      await go(page, '#/lobby', 'lobby');
      await secretary(page, 'marumi', 'marumi-scene');
      await page.waitForTimeout(1200); // (the entrance has played)
      const a = await page.evaluate(() => {
        const img = document.querySelector('#app .home-scene-art');
        const r = img.getBoundingClientRect();
        const running = document.querySelector('#app .home-stage-host').getAnimations({ subtree: true }).filter((x) => x.playState === 'running').length;
        return { box: [r.left, r.top, r.width, r.height], anim: getComputedStyle(img).animationName, running, canvases: document.querySelectorAll('canvas[data-live]').length };
      });
      await page.waitForTimeout(1500);
      const b = await page.evaluate(() => { const r = document.querySelector('#app .home-scene-art').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
      const moved = a.box.some((v, i) => Math.abs(v - b[i]) > 0.01);
      check(a.anim === 'none' && !a.running && !a.canvases && !moved, `844x390 ${name}: the full illustration holds still (animation ${a.anim}, ${a.running} running in the stage, ${a.canvases} canvas, box ${moved ? 'moved' : 'fixed'})`);
    }
  } finally {
    check(!errs.length, `844x390 still checks: no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(fails.length ? `\nLOBBY ILLUSTRATIONS FAIL (${fails.length} of ${fails.length + oks})\n  ${fails.join('\n  ')}` : `\nLOBBY ILLUSTRATIONS PASS (${oks} checks)`);
process.exit(fails.length ? 1 : 0);

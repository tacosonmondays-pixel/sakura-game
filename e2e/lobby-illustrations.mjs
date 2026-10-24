// Lobby backgrounds in two categories (owner, Oct 23: "There are two categories, like the character with the castle
// backdrop as a default and everyone will have a full illustration alt", "you dont need the speech bubbles for these
// full illustration ones"), in the real game at phone, tablet and PC sizes:
//   - the default for every girl is her stand on the academy backdrop with her greeting bubble (Marumi on her
//     restored v0.1.46 full-body stand, Rei and Hikari as before);
//   - every full illustration (src/data/lobbyIllustrations.js) fills the whole lobby: no stand, no backdrop, and no
//     speech bubble, not for the greeting and not for a tap; her face is on screen, clear of the menus and under the
//     top bar; nothing shifts while it loads; a tap on her head still gives hearts;
//   - the picker shows a thumbnail per entry, grouped under "Backdrops" and "Full illustrations", picking one there
//     changes the lobby, and the choice survives a reload;
//   - the event's lantern string never hangs over her head (dev clock pinned inside the Halloween window), and one
//     more pass checks the lobby after the event; Reduce motion / Low graphics hold a full illustration still.
// Usage: node e2e/lobby-illustrations.mjs [--shots dir] [--sizes 844x390,1280x720] [--port 5204] [--gpu]
//   --gpu: the system Chrome with GPU rasterising (Windows desktop); without it e2e/browser.mjs picks the browser.
// Playwright / the browser are found by e2e/browser.mjs (PLAYWRIGHT_MODULE / NODE_PATH, CHROME_PATH).
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium, loadPlaywright } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const SHOTS = opt('shots', null);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const SIZES = opt('sizes', '844x390,1280x720,667x375,932x430,1024x768,1180x820,390x844').split(',');
const PORT = Number(opt('port', '0'));
const DEFAULT_GIRLS = ['marumi', 'rei', 'hikari'];
const HEAD_PAT = /halo is not a button|one more pat|what are you doing|keep patting/i;
/** the event dev clock: inside the Halloween window (its lantern string is up), and after the event */
const DURING_EVENT = '2026-10-24T18:00:00Z';
const AFTER_EVENT = '2026-12-01T18:00:00Z';

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
const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (c) oks += 1; else fails.push(m); };
const hits = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 120)))));
const shot = async (page, name) => {
  if (!SHOTS) return;
  await page.evaluate(() => document.querySelectorAll('.toast, .jn-toast').forEach((n) => n.remove()));
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

/**
 * Makes her the secretary through the live store: on her default (bg null) or on that background. Waits for the
 * picture to be in, alone, and for the greeting time to pass.
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
  await page.waitForFunction((id) => {
    const layers = [...document.querySelectorAll('.lb-art-layer')];
    return layers.length === 1 && layers[0].dataset.bg === id;
  }, want, { timeout: 20000 });
  // the greeting comes 650 ms after a new secretary's picture is in
  if (bg) await page.waitForTimeout(1300);
  else await page.waitForSelector('.lb-bubble.show', { timeout: 8000 }).catch(() => null);
  await page.waitForTimeout(350);
  await page.evaluate(() => document.querySelectorAll('.modal-overlay, .jn-toast').forEach((n) => n.remove()));
  return want;
}

/** Everything the checks need, measured in the page (px from the top-left of the screen). */
const measure = (page) => page.evaluate(() => {
  const box = (n) => { const r = n.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const host = document.querySelector('.lb-art-host');
  const layer = document.querySelector('.lb-art-layer');
  const img = layer.querySelector('.lb-art-full') || layer.querySelector('.lb-art-girl img');
  // (UI M5d: the tray took the shortcuts' place, with its sticker row under it)
  const hud = ['.lb-shortcuts', '.lb-tray', '.lb-stickers', '.lb-carousel', '.lb-eventcard-host', '.lb-br', '.lb-chev-l', '.lb-chev-r', '.lb-hide', '.lb-bgbtn']
    .map((s) => document.querySelector(s)).filter((n) => n && n.offsetParent && n.offsetWidth).map(box);
  const [fx, fy, fr] = (host.dataset.face || '').split(',').map(Number);
  const bubble = document.querySelector('.lb-bubble');
  const lan = document.querySelector('.lb-ev-lanterns');
  const lanSvg = lan?.querySelector('svg');
  return {
    lanterns: lan ? { shown: getComputedStyle(lan).visibility !== 'hidden', box: box(lan), svg: lanSvg ? box(lanSvg) : null, items: [...lan.querySelectorAll('svg g')].map(box) } : null,
    bg: layer.dataset.bg,
    cls: layer.className,
    variant: layer.dataset.variant || null,
    backdrop: !!layer.querySelector('.lb-art-bg'),
    backdropSrc: layer.querySelector('.lb-art-bg')?.currentSrc || layer.querySelector('.lb-art-bg')?.src || '',
    pumpkinsShown: [...document.querySelectorAll('.lb-ev-pumpkin')].some((n) => getComputedStyle(n).visibility !== 'hidden'),
    stand: !!layer.querySelector('.lb-art-girl'),
    src: img?.currentSrc || img?.src || '',
    nat: img ? [img.naturalWidth, img.naturalHeight] : null,
    attrs: img ? [img.getAttribute('width'), img.getAttribute('height')] : null,
    pos: img?.style.objectPosition || '',
    imgBox: img ? box(img) : null,
    anim: img ? getComputedStyle(img).animationName : '',
    face: host.dataset.face ? { x: fx, y: fy, r: fr } : null,
    bubbleShown: !!bubble && bubble.classList.contains('show') && getComputedStyle(bubble).display !== 'none' && Number(getComputedStyle(bubble).opacity) > 0.05,
    bubbleText: bubble?.textContent || '',
    hud,
    topBar: box(document.querySelector('.lb-top')).b,
    cls2: window.__cls || 0,
  };
});

/** Taps her (head: on her face; body: low on the picture), counting the hearts as they are added. */
async function tap(page, x, y, touch) {
  await page.evaluate(() => {
    window.__hearts = 0;
    window.__heartObs?.disconnect();
    window.__heartObs = new MutationObserver((list) => {
      for (const rec of list) for (const n of rec.addedNodes) if (n.classList?.contains('lb-art-heart')) window.__hearts += 1;
    });
    window.__heartObs.observe(document.querySelector('.lb-art-fx'), { childList: true });
  });
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await page.waitForTimeout(450);
  return page.evaluate(() => window.__hearts);
}

/** Opens the picker on the current secretary with the lobby's picture button and reads its groups. */
async function openPicker(page) {
  await page.locator('[data-testid="lobby-bg"]').click({ force: true });
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
      const img = t.querySelector('.bgp-thumb img');
      return { id: t.dataset.testid.replace(/^bgp-/, ''), on: t.classList.contains('on'), locked: t.classList.contains('locked'), name: t.querySelector('.bgp-tile-name b')?.textContent || '', thumb: !!img && img.naturalWidth > 0 };
    }),
  })));
}

/**
 * One screen size.
 * @param {string} size 'WxH'
 * @param {{ now: string, full?: boolean }} o now = the event dev clock; full = every check (else a short pass)
 */
async function sizePass(size, { now, full = true }) {
  const [W, H] = size.split('x').map(Number);
  const touch = Math.min(W, H) < 600;
  const portrait = H > W;
  const event = now === DURING_EVENT;
  const tagSize = event ? size : `${size}-after-event`;
  const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript((at) => {
    try { sessionStorage.setItem('sakura-beta-gift-shown', '1'); } catch { /* none */ }
    try { localStorage.setItem('sakura-dev-now', at); } catch { /* none */ }
    // layout shifts while a picture swaps in (the box is reserved, so none are expected)
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls = (window.__cls || 0) + e.value; }).observe({ type: 'layout-shift' }); } catch { /* old engine */ }
  }, now);
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="lobby"]', { timeout: 60000 });
  await page.waitForTimeout(1600); // the entrance slides settle
  check(event === !!(await page.$('[data-testid="event-decor"]')), `${tagSize}: the event's lantern decor is ${event ? 'up' : 'gone'}`);
  const rows = await page.evaluate(async () => (await import('/src/data/lobbyIllustrations.js')).FULL_ILLUSTRATIONS.map((r) => ({ id: r.id, girl: r.girl, tall: !!r.tall, file: r.file })));

  try {
    // ---- the default: her stand on the academy backdrop, with her greeting bubble ----
    for (const girl of full ? DEFAULT_GIRLS : ['marumi']) {
      await secretary(page, girl);
      const m = await measure(page);
      const tag = `${tagSize} ${girl} default`;
      check(m.bg === `${girl}-day` && m.cls.includes('stand') && m.backdrop && m.stand && !m.face, `${tag}: her stand on the academy backdrop (${m.bg})`);
      check(new RegExp(`portraits/${girl}-cut\\.webp`).test(m.src) && m.nat?.[0] > 0, `${tag}: her stand file (${m.src.split('/').pop()} ${m.nat?.join('x')})`);
      check(m.bubbleShown && m.bubbleText.length > 3, `${tag}: her greeting bubble ("${m.bubbleText.slice(0, 40)}")`);
      if (girl === 'marumi') check(m.nat && Math.abs(m.nat[0] / m.nat[1] - 0.432) < 0.004, `${tag}: the restored full-body stand (${m.nat?.join('x')}, aspect 0.432)`);
      // during Halloween her stand stands in the event's painted backdrop (a spooky tree with lanterns, pumpkins), with no
      // tint over it and no overlay lanterns or pumpkins across her; after it, the academy again
      if (event) {
        check(/lobby\/halloween\.webp/.test(m.backdropSrc) && m.cls.includes('tint-event') && !m.lanterns?.shown && !m.pumpkinsShown,
          `${tag}: the Halloween backdrop, no overlay lanterns or pumpkins over her (${m.backdropSrc.split('/').pop()})`);
      } else check(/lobby\/academy\.webp/.test(m.backdropSrc) && !m.cls.includes('tint-event'), `${tag}: the academy backdrop after the event (${m.backdropSrc.split('/').pop()})`);
      await shot(page, `${tagSize}-default-${girl}`);
    }

    // ---- every full illustration: the whole lobby, no stand, no backdrop, no bubble ----
    for (const row of full ? rows : rows.filter((r) => ['marumi-scene', 'yoriko-summer-breeze', 'hikari-rampart'].includes(r.id))) {
      await secretary(page, row.girl, row.id);
      const m = await measure(page);
      const tag = `${tagSize} ${row.id}`;
      const variant = portrait && row.tall ? 'tall' : 'wide';
      check(m.cls.includes('full') && !m.backdrop && !m.stand, `${tag}: the picture alone, no backdrop, no stand`);
      check(m.variant === variant && (variant === 'tall' ? new RegExp(`portraits/${row.girl}-full\\.webp`) : new RegExp(row.file.replace('.', '\\.'))).test(m.src) && m.nat?.[0] > 0,
        `${tag}: ${variant === 'tall' ? 'her 3:4 full art' : 'the wide picture'} (${m.src.split('/').pop()})`);
      check(!m.bubbleShown, `${tag}: no speech bubble`);
      check(!!m.attrs?.[0] && !!m.attrs?.[1] && !!m.pos && m.imgBox.l <= 0 && m.imgBox.t <= 0 && m.imgBox.r >= W && m.imgBox.b >= H, `${tag}: full bleed, size and crop set up front (${m.pos})`);
      check(m.cls2 < 0.01, `${tag}: no layout shift while it loads (${m.cls2.toFixed(4)})`);
      const f = m.face;
      check(!!f && f.x - f.r > 0 && f.x + f.r < W && f.y > 0 && f.y + f.r < H, `${tag}: her face on screen (${f && `${f.x},${f.y} r${f.r}`})`);
      if (f) {
        const core = { l: f.x - 0.85 * f.r, r: f.x + 0.85 * f.r, t: f.y - 0.6 * f.r, b: f.y + 0.95 * f.r };
        const blocked = m.hud.filter((o) => hits(o, core));
        // her brow and eyes under the top bar always; her whole face core too unless the picture has the screen's
        // own aspect (then the crop cannot move it down): within 3 px of the bar
        check(!blocked.length && f.y - 0.4 * f.r >= m.topBar && core.t >= m.topBar - 3, `${tag}: her face clear of the menus and the top bar (core top ${Math.round(core.t)}, bar ${Math.round(m.topBar)})${blocked.length ? ` ${JSON.stringify(blocked)}` : ''}`);
        if (event) {
          const L = m.lanterns;
          const head = { l: f.x - 1.9 * f.r, r: f.x + 1.9 * f.r, t: f.y - 1.7 * f.r, b: f.y + f.r };
          const over = L?.shown ? [L.svg, ...L.items].filter((o) => o && hits(o, head)) : [];
          check(!!L && !over.length && (L.shown || hits(L.box, head)), `${tag}: the lantern string clear of her head (${L?.shown ? `${L.items.length} lanterns` : 'hidden'})`);
        }
      }
      await shot(page, `${tagSize}-full-${row.id}`);
    }
    if (!full) return;

    // ---- taps on a full illustration: hearts, never a bubble ----
    for (const id of ['yoriko-summer-breeze', 'marumi-scene']) {
      const row = rows.find((r) => r.id === id);
      await secretary(page, row.girl, id);
      const { face } = await measure(page);
      const headHearts = await tap(page, face.x, Math.round(face.y + 0.5 * face.r), touch);
      const afterHead = await measure(page);
      const bodyHearts = await tap(page, Math.round(face.x), Math.min(H - 70, Math.round(face.y + 3.2 * face.r)), touch);
      const afterBody = await measure(page);
      check(headHearts >= 3 && !afterHead.bubbleShown && !HEAD_PAT.test(afterHead.bubbleText), `${size} ${id}: a head tap gives ${headHearts} hearts and no bubble`);
      check(!afterBody.bubbleShown, `${size} ${id}: a body tap gives no bubble (${bodyHearts} heart)`);
    }
    // her stand still talks: a head tap there is a head pat with its line
    await secretary(page, 'rei');
    await page.waitForTimeout(300);
    const reiFace = await page.evaluate(() => {
      const r = document.querySelector('.lb-art').getBoundingClientRect();
      return { x: r.left + 0.55 * r.width, y: r.top + 0.25 * r.height };
    });
    await tap(page, Math.round(reiFace.x), Math.round(reiFace.y), touch);
    const rei = await measure(page);
    check(rei.bubbleShown && HEAD_PAT.test(rei.bubbleText), `${size} rei: a head pat on her stand still says its line ("${rei.bubbleText.slice(0, 40)}")`);

    // ---- the picker: two groups of thumbnails; picking there changes the lobby; the choice persists ----
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
      const allTiles = groups.flatMap((g) => g.tiles);
      check(allTiles.filter((t) => !t.locked).every((t) => t.thumb), `${tag}: every open tile shows its thumbnail`);
      check(fulls[0]?.name === (girl === 'marumi' ? 'Marumi: Strike Lane' : 'Yoriko: Summer Breeze'), `${tag}: named after her and the picture ("${fulls[0]?.name}")`);
      check(groups[0]?.tiles[0]?.on, `${tag}: her default stand is the one ticked`);
      await shot(page, `${size}-picker-${girl}`);
      // a short dialog scrolls: show the Full illustrations group too
      const scrolled = await page.evaluate(() => {
        const box = document.querySelector('.bgp-groups');
        const g = document.querySelector('[data-testid="bgp-group-full"]');
        if (g.getBoundingClientRect().bottom <= box.getBoundingClientRect().bottom + 1) return false;
        box.scrollTop = g.offsetTop - box.offsetTop - 4;
        return true;
      });
      if (scrolled) await shot(page, `${size}-picker-${girl}-full-illustrations`);
      if (girl === 'marumi') {
        // pick her full illustration in the picker, close it: the lobby is the picture, with no bubble
        await page.locator('[data-testid="bgp-marumi-scene"]').click();
        await page.waitForTimeout(250);
        const on = await page.evaluate(() => document.querySelector('[data-testid="bgp-marumi-scene"]')?.classList.contains('on'));
        await page.locator('[data-testid="bgp-done"]').click({ force: true });
        await page.waitForFunction(() => document.querySelectorAll('.lb-art-layer').length === 1 && document.querySelector('.lb-art-layer').dataset.bg === 'marumi-scene', null, { timeout: 15000 });
        await page.waitForTimeout(800);
        const m = await measure(page);
        check(on && m.cls.includes('full') && !m.stand && !m.bubbleShown, `${tag}: picking "Strike Lane" fills the lobby with it, no stand, no bubble`);
        // the choice is saved: a reload opens on it
        await page.evaluate(() => window.__sakura.store.saveNow?.());
        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('[data-testid="lobby"]', { timeout: 60000 });
        await page.waitForFunction(() => document.querySelectorAll('.lb-art-layer').length === 1, null, { timeout: 20000 });
        await page.waitForTimeout(1800);
        const r = await measure(page);
        check(r.bg === 'marumi-scene' && r.cls.includes('full') && !r.bubbleShown, `${tag}: after a reload the lobby is still "Strike Lane" (${r.bg}), with no bubble`);
        // back to her backdrop in the picker: her stand returns and greets you again (the full illustration had no bubble)
        await openPicker(page);
        await page.locator('[data-testid="bgp-marumi-day"]').click();
        await page.waitForTimeout(250);
        await page.locator('[data-testid="bgp-done"]').click({ force: true });
        await page.waitForFunction(() => document.querySelectorAll('.lb-art-layer').length === 1 && document.querySelector('.lb-art-layer').dataset.bg === 'marumi-day', null, { timeout: 15000 });
        await page.waitForTimeout(1200);
        const home = await measure(page);
        check(home.cls.includes('stand') && home.stand && home.bubbleShown && home.bubbleText.length > 3, `${tag}: back to her backdrop, her stand greets you again ("${home.bubbleText.slice(0, 40)}")`);
        await shot(page, `${size}-default-marumi-after-picker`);
      }
      await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((n) => n.remove()));
    }

    // ---- turning the phone with a full illustration up: re-cropped on her face, the string follows ----
    if (event && size === '844x390') {
      await secretary(page, 'marumi', 'marumi-scene');
      for (const [w, h] of [[390, 844], [844, 390]]) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(1200);
        const m = await measure(page);
        const f = m.face;
        const head = { l: f.x - 1.9 * f.r, r: f.x + 1.9 * f.r, t: f.y - 1.7 * f.r, b: f.y + f.r };
        const L = m.lanterns;
        const over = L?.shown ? [L.svg, ...L.items].filter((o) => o && hits(o, head)) : [];
        check(m.variant === (h > w ? 'tall' : 'wide') && !m.bubbleShown && !over.length && f.x - f.r > 0 && f.x + f.r < w,
          `turned to ${w}x${h} marumi-scene: ${m.variant}, face ${f.x},${f.y}, lantern string ${L?.shown ? `${L.items.length} lanterns, clear of her head` : 'hidden'}`);
      }
    }
  } finally {
    check(!errs.length, `${tagSize}: no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    await page.close();
  }
}

try {
  for (const size of SIZES) await sizePass(size, { now: DURING_EVENT });
  // the lobby without the event: the same layouts, no lanterns
  await sizePass('844x390', { now: AFTER_EVENT, full: false });

  // Reduce motion and Low graphics: a full illustration holds still (no breathing)
  for (const [name, settings] of [['Reduce motion', { reduceMotion: true }], ['Low graphics', { quality: 'low' }]]) {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    await page.addInitScript(() => { try { sessionStorage.setItem('sakura-beta-gift-shown', '1'); } catch { /* none */ } });
    await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="lobby"]', { timeout: 60000 });
    await page.evaluate(async (s) => {
      const { store } = window.__sakura;
      const { grantUnit } = await import('/src/systems/unlocks.js');
      const { chooseBackground } = await import('/src/data/lobbyArt.js');
      if (!store.profile.units.marumi) grantUnit(store.profile, 'marumi');
      chooseBackground(store.profile, 'marumi-scene');
      Object.assign(store.profile.settings, s);
      store.commit('settings');
      location.hash = '#/missions';
    }, settings);
    await page.waitForFunction(() => !document.querySelector('[data-testid="lobby"]'), null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { location.hash = '#/lobby'; });
    await page.waitForFunction(() => (document.querySelector('.lb-art-layer')?.dataset.bg || '') === 'marumi-scene', null, { timeout: 20000 });
    await page.waitForTimeout(600);
    const m = await measure(page);
    check(m.cls.includes('full') && m.cls.includes('still') && m.anim === 'none', `844x390 ${name}: the full illustration holds still (${m.cls}, animation ${m.anim})`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(fails.length ? `\nLOBBY ILLUSTRATIONS FAIL (${fails.length} of ${fails.length + oks})` : `\nLOBBY ILLUSTRATIONS PASS (${oks} checks)`);
process.exit(fails.length ? 1 : 0);

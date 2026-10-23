// Whole-scene lobby (owner, Oct 23: "instead of the default backgrounds just show the entire art"), in the real game
// at phone, tablet and PC sizes: when one of the seven academy girls is the secretary, the lobby is her whole scene
// (her 3:4 full art on a portrait phone) with no academy backdrop and no cut-out stand; her face is on screen and
// clear of every menu; the speech bubble sits beside her face, never over it; a tap on her lower face is a head pat
// (the old lobby missed Chigusa's and Ouka's); nothing shifts while the art loads; Reduce motion / Low graphics
// hold the scene still. Girls without a scene keep the backdrop + stand (Rei) or their older scene (Hikari).
// Usage: node e2e/lobby-scenes.mjs [--shots dir] [--sizes 844x390,1280x720]
// Playwright / the browser are found by e2e/browser.mjs (PLAYWRIGHT_MODULE / NODE_PATH, CHROME_PATH).
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const SHOTS = opt('shots', null);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const SIZES = opt('sizes', '844x390,1280x720,667x375,932x430,1024x768,1180x820,390x844').split(',');
const ACADEMY = ['azami', 'chigusa', 'kinu', 'marumi', 'ouka', 'wakaba', 'yuzuha'];
const HEAD_PAT = /halo is not a button|one more pat|what are you doing|keep patting/i;

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser, label } = await launchChromium();
console.log(`browser: ${label}`);
const fails = [];
const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); };

/** Make her the secretary through the live store and wait for her art and greeting. */
async function secretary(page, id) {
  await page.evaluate(async (girl) => {
    const { store } = window.__sakura;
    const { grantUnit } = await import('/src/systems/unlocks.js');
    if (!store.profile.units[girl]) grantUnit(store.profile, girl);
    window.__cls = 0;
    store.profile.secretary = girl;
    store.commit('secretary');
  }, id);
  await page.waitForFunction((g) => {
    const layers = [...document.querySelectorAll('.lb-art-layer')];
    return layers.length === 1 && (layers[0].dataset.bg || '').startsWith(`${g}-`);
  }, id, { timeout: 20000 });
  await page.waitForSelector('.lb-bubble.show', { timeout: 8000 }).catch(() => null);
  await page.waitForTimeout(450);
  await page.evaluate(() => document.querySelectorAll('.modal-overlay, .jn-toast').forEach((n) => n.remove()));
}

/** Everything the checks need, measured in the page (px from the top-left of the screen). */
const measure = (page) => page.evaluate(() => {
  const box = (n) => { const r = n.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const host = document.querySelector('.lb-art-host');
  const layer = document.querySelector('.lb-art-layer');
  const img = layer.querySelector('img');
  const hud = ['.lb-shortcuts', '.lb-carousel', '.lb-eventcard-host', '.lb-br', '.lb-chev-l', '.lb-chev-r', '.lb-hide', '.lb-bgbtn']
    .map((s) => document.querySelector(s)).filter((n) => n && n.offsetParent && n.offsetWidth).map(box);
  const [fx, fy, fr] = (host.dataset.face || '').split(',').map(Number);
  const bubble = document.querySelector('.lb-bubble.show');
  return {
    cls: layer.className,
    variant: layer.dataset.variant || null,
    backdrop: !!layer.querySelector('.lb-art-bg'),
    stand: !!layer.querySelector('.lb-art-girl'),
    src: img?.currentSrc || img?.src || '',
    attrs: img ? [img.getAttribute('width'), img.getAttribute('height')] : null,
    pos: img?.style.objectPosition || '',
    imgBox: img ? box(img) : null,
    anim: img ? getComputedStyle(img).animationName : '',
    face: host.dataset.face ? { x: fx, y: fy, r: fr } : null,
    bubble: bubble ? { ...box(bubble), side: (bubble.className.match(/side-(\w+)/) || [])[1] || null, text: bubble.textContent } : null,
    hud,
    topBar: box(document.querySelector('.lb-top')).b,
    cls2: window.__cls || 0,
  };
});

const hits = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

try {
  for (const size of SIZES) {
    const [W, H] = size.split('x').map(Number);
    const touch = Math.min(W, H) < 600;
    const portrait = H > W;
    const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.addInitScript(() => {
      try { sessionStorage.setItem('sakura-beta-gift-shown', '1'); } catch { /* none */ }
      // layout shifts while her art swaps in (the box is reserved, so none are expected)
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls = (window.__cls || 0) + e.value; }).observe({ type: 'layout-shift' }); } catch { /* old engine */ }
    });
    await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="lobby"]', { timeout: 60000 });
    await page.waitForTimeout(1600); // the entrance slides settle

    for (const id of ACADEMY) {
      await secretary(page, id);
      const m = await measure(page);
      const tag = `${size} ${id}`;
      check(m.cls.includes('whole') && !m.backdrop && !m.stand, `${tag}: her whole scene, no backdrop, no stand`);
      check(m.variant === (portrait ? 'full' : 'scene') && (portrait ? /portraits\/\w+-full\.webp/ : /scenes\/\w+-scene\.webp/).test(m.src), `${tag}: ${portrait ? 'her 3:4 full art' : 'the wide scene'} (${m.src.split('/').pop()})`);
      check(!!m.attrs?.[0] && !!m.attrs?.[1] && !!m.pos && m.imgBox.l <= 0 && m.imgBox.t <= 0 && m.imgBox.r >= W && m.imgBox.b >= H, `${tag}: full bleed, size and crop set up front (${m.pos})`);
      check(m.cls2 < 0.01, `${tag}: no layout shift while it loads (${m.cls2.toFixed(4)})`);
      const f = m.face;
      check(!!f && f.x - f.r > 0 && f.x + f.r < W && f.y > 0 && f.y < H / 2 + f.r, `${tag}: her face on screen (${f && `${f.x},${f.y} r${f.r}`})`);
      if (!f) continue;
      const core = { l: f.x - 0.85 * f.r, r: f.x + 0.85 * f.r, t: f.y - 0.6 * f.r, b: f.y + 0.95 * f.r };
      const blocked = m.hud.filter((o) => hits(o, core));
      check(!blocked.length && core.t >= m.topBar, `${tag}: her face clear of the menus and the top bar${blocked.length ? ` (${JSON.stringify(blocked)})` : ''}`);
      if (m.bubble) {
        const b = m.bubble;
        check(!hits(b, core), `${tag}: bubble beside her face (${b.side}), not over it`);
        check(b.l >= 0 && b.r <= W && b.t >= 0 && b.b <= H, `${tag}: bubble on screen`);
        if (!portrait) check(m.hud.every((o) => !hits(o, b)), `${tag}: bubble clear of the menus`);
      } else check(false, `${tag}: greeting bubble shown`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/lobby-scenes-${size}-${id}.png` });
    }

    // the open finding: taps on the lower face of Chigusa and Ouka missed the head zone
    for (const id of ['chigusa', 'ouka']) {
      await secretary(page, id);
      const { face } = await measure(page);
      const x = face.x;
      const y = Math.round(face.y + 0.7 * face.r);
      if (touch) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
      await page.waitForTimeout(250);
      const text = await page.locator('.lb-bubble.show').innerText().catch(() => '');
      const heartCount = await page.locator('.lb-art-heart').count();
      check(HEAD_PAT.test(text) && heartCount >= 3, `${size} ${id}: a tap on her lower face is a head pat ("${text.slice(0, 40)}", ${heartCount} hearts)`);
    }

    // girls without a whole scene: Rei keeps the academy backdrop + her stand, Hikari her older landscape scene
    await secretary(page, 'rei');
    const rei = await measure(page);
    check(rei.cls.includes('stand') && rei.backdrop && rei.stand && !rei.face, `${size} rei: backdrop + stand as before`);
    await secretary(page, 'hikari');
    const hik = await measure(page);
    check(hik.cls.includes('scene') && !hik.cls.includes('whole') && /art\/lobby\/hikari\.webp/.test(hik.src), `${size} hikari: her older scene as before`);
    check(!errs.length, `${size}: no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    await page.close();
  }

  // Reduce motion and Low graphics: the whole scene holds still (no breathing)
  for (const [name, settings] of [['Reduce motion', { reduceMotion: true }], ['Low graphics', { quality: 'low' }]]) {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    await page.addInitScript(() => { try { sessionStorage.setItem('sakura-beta-gift-shown', '1'); } catch { /* none */ } });
    await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="lobby"]', { timeout: 60000 });
    await page.evaluate(async (s) => {
      const { store } = window.__sakura;
      const { grantUnit } = await import('/src/systems/unlocks.js');
      if (!store.profile.units.marumi) grantUnit(store.profile, 'marumi');
      store.profile.secretary = 'marumi';
      Object.assign(store.profile.settings, s);
      store.commit('settings');
      location.hash = '#/missions';
    }, settings);
    await page.waitForFunction(() => !document.querySelector('[data-testid="lobby"]'), null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { location.hash = '#/lobby'; });
    await page.waitForFunction(() => (document.querySelector('.lb-art-layer')?.dataset.bg || '') === 'marumi-scene', null, { timeout: 20000 });
    await page.waitForTimeout(600);
    const m = await measure(page);
    check(m.cls.includes('whole') && m.cls.includes('still') && m.anim === 'none', `844x390 ${name}: her scene holds still (${m.cls}, animation ${m.anim})`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(fails.length ? `\nLOBBY SCENES FAIL (${fails.length})` : '\nLOBBY SCENES PASS');
process.exit(fails.length ? 1 : 0);

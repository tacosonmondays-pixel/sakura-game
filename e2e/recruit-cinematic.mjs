// Recruit cinematic e2e (docs/RECRUIT_CINEMATIC.md): the Gate and the full-screen SSR / LR reveals on real pulls.
//   1× (any result: the Gate's tier matches what was pulled), 10× with an SSR (pity 89: the rainbow surge, a tap
//   speeds it up, her reveal runs silhouette → sweep → text → mark → hold), an LR 1× (the Legend Promise at 299:
//   the starlit Nightglass Gate and the LR reveal, played out untouched), Skip all (straight to the results),
//   Reduce motion (the calm version: no shake, no flashes, short) and Flashes & shake off (no shake, no flashes).
//   Every pull is saved before the Gate starts.
//
//   node e2e/recruit-cinematic.mjs                              # 844x390 (touch), 1280x720, 390x844 (touch)
//   node e2e/recruit-cinematic.mjs --viewport 844x390 --shots /tmp/rc     # one size + key frames
//   node e2e/recruit-cinematic.mjs --viewport 844x390 --video /tmp/rc     # + the owner board's recording (SSR 10×, LR 1×)
// Exit code 1 if any check fails. Starts its own Vite dev server on a free port.
import { createServer } from 'vite';
import { mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport', null) ? opt('viewport').split(',') : ['844x390', '1280x720', '390x844'];
const shotsDir = opt('shots', null);
const videoDir = opt('video', null);
for (const d of [shotsDir, videoDir]) if (d) mkdirSync(d, { recursive: true });
// Tenka's debut week (src/data/banners.js): the LR tab is up
const AT = Date.parse(opt('at', '2026-11-03T12:00:00-06:00'));

const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
}
const IGNORE = [/GPU stall/i, /WebGL/i, /favicon/i, /GroupMarkerNotSet/i, /Failed to load resource: net::ERR_(CERT|NAME|INTERNET|PROXY|TUNNEL|CONNECTION)/i];

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const base = `http://127.0.0.1:${port}/?onboarding=0`;
const { browser } = await launchChromium();

const cineState = (page) => page.evaluate(() => window.__sakura?.recruitCinematic?.state() || null);
// (timeouts are roomy: headless Chromium draws on the CPU, and a frame over 1/10 s slows the cinematic's clock)
const waitCine = (page, fn, arg, timeout = 20000) => page.waitForFunction(fn, arg, { timeout, polling: 50 }).then(() => true).catch(() => false);

async function run(vp) {
  const [w, hh] = vp.split('x').map(Number);
  log(`\n=== ${vp} ===`);
  const touch = Math.min(w, hh) < 600;
  const ctx = await browser.newContext({ viewport: { width: w, height: hh }, deviceScaleFactor: 1, hasTouch: touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.some((re) => re.test(m.text()))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: AT });
  const shot = async (name) => { if (shotsDir) await page.screenshot({ path: `${shotsDir}/${vp}-${name}.png`, timeout: 30000 }).catch((e) => log(`  (shot ${name} skipped: ${e.message.split('\n')[0]})`)); };
  const tapAt = async (x, y) => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
  const tap = async (sel) => (touch ? page.tap(sel) : page.click(sel));

  await page.goto(`${base}#/lobby`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 30000 });
  await page.evaluate(() => {
    const p = window.__sakura.store.profile;
    p.currencies.gems = 200000;
    p.settings.reduceMotion = false;
    p.settings.hitEffects = true;
    window.__sakura.store.commit('e2e');
  });
  await page.addStyleTag({ content: '.toast-host, .jn-toast { display: none !important; }' });
  const setup = async ({ pity = 0, promise = 0, reduce = false, effects = true } = {}) => {
    await page.evaluate(([pity, promise, reduce, effects]) => {
      const p = window.__sakura.store.profile;
      p.gacha.pity = pity;
      (p.missions.counters ||= {})['gl:tenka'] = promise;
      p.settings.reduceMotion = reduce;
      p.settings.hitEffects = effects;
      p.currencies.gems = Math.max(p.currencies.gems, 100000);
      window.__sakura.store.commit('e2e');
    }, [pity, promise, reduce, effects]);
  };
  const openTab = async (tab) => {
    // pop-ups a pull can leave behind (Potential-up cards, a new girl's lesson): close them first
    for (let i = 0; i < 4 && await page.$('.modal-overlay'); i++) {
      await page.keyboard.press('Escape');
      await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => [...m.querySelectorAll('button')].find((b) => /^(Close|OK|Got it|Later|Cancel)$/i.test(b.textContent.trim()))?.click()));
      await page.waitForTimeout(250);
    }
    await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
    await page.evaluate(() => { location.hash = '#/lobby'; });
    await page.waitForTimeout(200);
    await page.evaluate(() => { location.hash = '#/recruit'; });
    await page.waitForSelector('.bn-rail', { timeout: 20000 });
    await tap(`[data-testid="banner-tab-${tab}"]`);
    await page.waitForTimeout(250);
  };
  /** Press recruit ×n and confirm; returns the pull count and save before / right after the Gate started. */
  const pullN = async (n) => {
    const before = await page.evaluate(() => window.__sakura.store.profile.gacha.totalPulls || 0);
    await tap(`[data-testid="pull-${n}"]`);
    const confirm = await page.waitForSelector('[data-testid="confirm-pull"]', { timeout: 3000 }).catch(() => null);
    if (confirm) await tap('[data-testid="confirm-pull"]');
    await page.waitForSelector('.ma-gacha', { timeout: 10000 });
    const saved = await page.evaluate(() => {
      let stored = null;
      try { stored = JSON.parse(localStorage.getItem('sakura-sentinels-save-v1'))?.gacha?.totalPulls ?? null; } catch { /* another format */ }
      return { mem: window.__sakura.store.profile.gacha.totalPulls, stored, phase: window.__sakura.recruitCinematic?.state()?.gatePhase ?? null };
    });
    return { before, saved };
  };
  const closeResults = async () => {
    await page.waitForSelector('[data-testid="reveal-close"]', { state: 'attached', timeout: 30000 });
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('[data-testid="reveal-close"]')?.click());
    await page.waitForFunction(() => !document.querySelector('.ma-gacha'), null, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(200);
  };

  // ---- 1. a 1× on the Standard banner: the Gate's tier matches the pull, saved first -------------------------
  await setup();
  await openTab('standard');
  const p1 = await pullN(1);
  check(p1.saved.mem === p1.before + 1 && (p1.saved.stored == null || p1.saved.stored === p1.before + 1), `1×: the pull is saved before the Gate plays (${JSON.stringify(p1)})`);
  check(await waitCine(page, () => !!window.__sakura?.recruitCinematic), '1×: the cinematic is playing');
  const s1 = await cineState(page);
  await page.waitForSelector('.ma-gacha-grid .ma-gc', { timeout: 45000 });
  const ssr1 = await page.$$eval('.ma-gacha-grid .ma-gc.r-SSR', (e) => e.length);
  check(s1 && (ssr1 ? s1.tier !== 'blue' : s1.tier === 'blue'), `1×: the Gate's tier fits the pull (${s1?.tier}, ${ssr1} SSR)`);
  if (ssr1) await tap('[data-testid="reveal-skip"]');
  await closeResults();

  // ---- 2. a 10× with an SSR: the rainbow surge, tap to speed up, her full reveal -----------------------------
  await setup({ pity: 89 });
  await openTab('standard');
  const p2 = await pullN(10);
  check(p2.saved.mem === p2.before + 10, `10×: saved before the Gate (${JSON.stringify(p2.saved)})`);
  check(await waitCine(page, () => window.__sakura.recruitCinematic?.state()?.gatePhase === 'power'), '10×: the Gate powers on in blue');
  await page.waitForTimeout(500);
  await shot('1-gate-power');
  const st2 = await cineState(page);
  check(st2?.tier === 'rainbow' && st2.shake && st2.flashes && st2.reveals >= 1, `10×: tier rainbow, shake and flashes on, ${st2?.reveals} reveal(s) (${JSON.stringify(st2)})`);
  check(await waitCine(page, () => window.__sakura.recruitCinematic?.state()?.gatePhase === 'surge'), '10×: it surges to rainbow');
  await page.waitForTimeout(700);
  await shot('2-gate-surge');
  const shaking = await page.evaluate(() => document.querySelector('.rc-shake')?.style.transform || '');
  check(/^translate3d\(-?[\d.]+px, ?0(px)?, ?0(px)?\)$/.test(shaking), `10×: the shake is a sideways shift only (${shaking})`);
  // a tap speeds the Gate up
  await tapAt(w / 2, hh / 2);
  check((await cineState(page))?.timeScale > 1, 'a tap during the Gate speeds it up');
  check(await waitCine(page, () => document.querySelector('[data-testid="reveal-cine"]'), null, 20000), '10×: her full-screen reveal opens after the cards');
  const unit = await page.getAttribute('[data-testid="reveal-cine"]', 'data-unit');
  check(await waitCine(page, () => document.querySelector('[data-testid="reveal-cine"]')?.dataset.stage === 'silhouette', null, 8000), `reveal (${unit}): her silhouette first`);
  await page.waitForTimeout(350);
  await shot('3-reveal-silhouette');
  check(await waitCine(page, () => document.querySelector('[data-testid="reveal-cine"]')?.dataset.stage === 'sweep', null, 8000), 'reveal: her art sweeps in');
  await page.waitForTimeout(300);
  await shot('4-reveal-sweep');
  check(await waitCine(page, () => document.querySelector('[data-testid="reveal-cine"]')?.dataset.stage === 'mark', null, 8000), 'reveal: her name, then her mark stamps in');
  await page.waitForTimeout(450);
  await shot('5-reveal-mark');
  const rv = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="reveal-cine"]');
    const img = el.querySelector('img.rc-rv-paint');
    const vis = (s) => { const n = el.querySelector(s); if (!n) return false; const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(n).opacity > 0.05; };
    const inView = (s) => { const r = el.querySelector(s)?.getBoundingClientRect(); return !!r && r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; };
    return { name: el.querySelector('.rc-rv-name')?.textContent, stars: el.querySelectorAll('.rc-rv-star').length, mark: !!el.querySelector('.rc-mark-svg'),
      art: !!img && img.complete && img.naturalWidth > 0, nameVis: vis('.rc-rv-name'), markVis: vis('.rc-rv-mark'), nameIn: inView('.rc-rv-text'), markIn: inView('.rc-rv-mark'),
      lr: el.classList.contains('is-lr') };
  });
  check(rv.name && rv.stars === 5 && rv.mark && rv.art && !rv.lr, `reveal: her art, name, 5 stars and mark (${JSON.stringify(rv)})`);
  check(rv.nameVis && rv.markVis && rv.nameIn && rv.markIn, 'reveal: name and mark are on screen');
  check(await waitCine(page, () => document.querySelector('[data-testid="reveal-cine"]')?.dataset.stage === 'hold', null, 8000), 'reveal: it holds');
  await page.waitForTimeout(300);
  await shot('6-reveal-hold');
  const fl = await cineState(page);
  check(fl.flashCount <= 3, `flashes stayed within the flash guard (${fl.flashCount} in the window)`);
  // tap through: the hold moves on (to the next reveal or the results)
  const before = await page.$$eval('[data-testid="reveal-cine"]', (e) => e.length);
  await tapAt(w / 2, hh / 2);
  check(before === 1 && await waitCine(page, (u) => !document.querySelector(`[data-testid="reveal-cine"][data-unit="${u}"]:not(.rc-out)`), unit, 3000), 'a tap at the hold moves on');
  // tap mid-reveal shows it all at once (if there is another SSR)
  if (await waitCine(page, () => document.querySelector('[data-testid="reveal-cine"]:not(.rc-out)'), null, 1500)) {
    await page.waitForTimeout(200);
    await tapAt(w / 2, hh / 2);
    check(await waitCine(page, () => document.querySelector('[data-testid="reveal-cine"]:not(.rc-out)')?.dataset.stage === 'hold', null, 1500), 'a tap mid-reveal shows it all at once');
    await tap('[data-testid="reveal-skip"]').catch(() => {});
  }
  await page.waitForSelector('[data-testid="reveal-summary"]', { timeout: 20000 });
  await shot('7-results');
  await closeResults();

  // ---- 3. an LR 1×: the Nightglass Gate and the LR reveal, untouched -------------------------------------------
  await setup({ promise: 299 });
  await openTab('legend');
  const p3 = await pullN(1);
  check(p3.saved.mem === p3.before + 1, 'LR: saved before the Gate');
  check(await waitCine(page, () => window.__sakura.recruitCinematic?.state()?.tier === 'lr'), 'LR: the Gate plays its LR version');
  const t0 = Date.now();
  check(await waitCine(page, () => window.__sakura.recruitCinematic?.state()?.gatePhase === 'surge'), 'LR: blue → rainbow');
  check(await waitCine(page, () => window.__sakura.recruitCinematic?.state()?.gatePhase === 'night'), 'LR: → the starlit Nightglass');
  await page.waitForTimeout(900);
  await shot('8-lr-gate-night');
  check(await waitCine(page, () => document.querySelector('[data-testid="reveal-cine"].is-lr'), null, 20000), 'LR: her LR reveal opens');
  check(await waitCine(page, () => document.querySelector('[data-testid="reveal-cine"]')?.dataset.stage === 'sweep', null, 10000), 'LR: silhouette → sweep');
  await page.waitForTimeout(500);
  await shot('9-lr-sweep');
  check(await waitCine(page, () => document.querySelector('[data-testid="reveal-cine"]')?.dataset.stage === 'hold', null, 15000), 'LR: name and her Nightglass mark, then the hold');
  await page.waitForTimeout(300);
  await shot('10-lr-hold');
  const lr = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="reveal-cine"]');
    return { unit: el.dataset.unit, stars: el.querySelectorAll('.rc-rv-star').length, crest: !!el.querySelector('[data-testid="lr-reveal"]'), kicker: el.querySelector('[data-testid="showcase-kicker"]')?.textContent };
  });
  check(lr.unit === 'tenka' && lr.stars === 6 && lr.crest && /LR unit/.test(lr.kicker), `LR reveal: Tenka, 6 stars, the LR line (${JSON.stringify(lr)})`);
  // untouched, the hold moves on by itself
  check(await waitCine(page, () => document.querySelector('[data-testid="reveal-summary"]'), null, 20000), 'LR: the hold moves on by itself to the results');
  const lrSecs = (Date.now() - t0) / 1000;
  check(lrSecs > 6 && lrSecs < 45, `LR: the whole sequence is grand but not endless (${lrSecs.toFixed(1)} s)`);
  await closeResults();

  // ---- 4. Skip all: straight to the results ---------------------------------------------------------------------
  await setup({ pity: 89 });
  await openTab('standard');
  await pullN(10);
  await waitCine(page, () => window.__sakura.recruitCinematic?.state()?.gatePhase === 'power');
  await tap('[data-testid="reveal-skip"]');
  check(await waitCine(page, () => document.querySelector('[data-testid="reveal-summary"]'), null, 3000), 'Skip all: the results show at once');
  check(!(await page.$('[data-testid="reveal-cine"]')) && (await page.$$eval('.ma-gc.flipped', (e) => e.length)) === 10, 'Skip all: no reveal left, every card face up');
  await closeResults();

  // ---- 5. Reduce motion: the calm version -------------------------------------------------------------------
  await setup({ pity: 89, reduce: true });
  await openTab('standard');
  await pullN(10);
  const t1 = Date.now();
  const sr = await waitCine(page, () => window.__sakura.recruitCinematic).then(() => cineState(page));
  check(sr?.reduce && !sr.shake && !sr.flashes, `Reduce motion: calm (no shake, no flashes) (${JSON.stringify(sr)})`);
  let shook = false;
  const watch = setInterval(async () => { try { if (await page.evaluate(() => document.querySelector('.rc-shake')?.style.transform)) shook = true; } catch { /* closed */ } }, 120);
  check(await waitCine(page, () => document.querySelector('[data-testid="reveal-cine"].rc-calm'), null, 8000), 'Reduce motion: the reveal fades in (calm)');
  await page.waitForTimeout(700);
  await shot('11-calm-reveal');
  check(await waitCine(page, () => document.querySelector('[data-testid="reveal-summary"]'), null, 20000), 'Reduce motion: plays through to the results');
  clearInterval(watch);
  const calmSecs = (Date.now() - t1) / 1000;
  const cr = await cineState(page).catch(() => null);
  check(!shook, 'Reduce motion: nothing shook');
  check(!cr || cr.flashCount === 0, 'Reduce motion: no flashes counted');
  log(`  (calm 10× with ${sr?.reveals} SSR: ${calmSecs.toFixed(1)} s to the results)`);
  await closeResults();

  // ---- 6. Flashes & shake off ---------------------------------------------------------------------------------------
  await setup({ pity: 89, effects: false });
  await openTab('standard');
  await pullN(10);
  const se = await waitCine(page, () => window.__sakura.recruitCinematic).then(() => cineState(page));
  check(se && !se.shake && !se.flashes && !se.reduce && se.tier === 'rainbow', `Flashes & shake off: the rainbow plays without shake or flashes (${JSON.stringify(se)})`);
  await waitCine(page, () => window.__sakura.recruitCinematic?.state()?.gatePhase === 'surge');
  await page.waitForTimeout(400);
  check(!(await page.evaluate(() => document.querySelector('.rc-shake')?.style.transform)), 'Flashes & shake off: no shake in the surge');
  await tap('[data-testid="reveal-skip"]');
  await closeResults();

  check(!errors.length, `no page errors (${errors.slice(0, 3).join(' | ')})`);
  await ctx.close();
}

/** The owner board's recording: an SSR 10× and an LR 1× at this size, played as a player would (one tap a hold). */
async function record(vp) {
  const [w, hh] = vp.split('x').map(Number);
  log(`\n=== recording ${vp} ===`);
  const touch = Math.min(w, hh) < 600;
  const ctx = await browser.newContext({ viewport: { width: w, height: hh }, deviceScaleFactor: 1, hasTouch: touch, recordVideo: { dir: videoDir, size: { width: w, height: hh } } });
  const page = await ctx.newPage();
  await page.clock.install({ time: AT });
  await page.goto(`${base}#/lobby`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 30000 });
  await page.addStyleTag({ content: '.toast-host, .jn-toast { display: none !important; }' });
  const prep = (pity, promise) => page.evaluate(([pity, promise]) => {
    const p = window.__sakura.store.profile;
    p.currencies.gems = 200000;
    p.gacha.pity = pity;
    (p.missions.counters ||= {})['gl:tenka'] = promise;
    p.settings.reduceMotion = false;
    p.settings.hitEffects = true;
    window.__sakura.store.commit('e2e');
  }, [pity, promise]);
  const tap = async (sel) => (touch ? page.tap(sel) : page.click(sel));
  const go = async (tab) => {
    await page.evaluate(() => { location.hash = '#/recruit'; });
    await page.waitForSelector('.bn-rail', { timeout: 20000 });
    await tap(`[data-testid="banner-tab-${tab}"]`);
    await page.waitForTimeout(300);
  };
  const play = async (n) => {
    await tap(`[data-testid="pull-${n}"]`);
    if (await page.waitForSelector('[data-testid="confirm-pull"]', { timeout: 3000 }).catch(() => null)) await tap('[data-testid="confirm-pull"]');
    // a player taps once each hold
    for (;;) {
      const done = await page.waitForFunction(() => document.querySelector('[data-testid="reveal-summary"]') ? 'done'
        : document.querySelector('[data-testid="reveal-cine"]:not(.rc-out)')?.dataset.stage === 'hold' ? 'hold' : null, null, { timeout: 30000, polling: 50 }).then((h) => h.jsonValue());
      if (done === 'done') break;
      await page.waitForTimeout(500);
      await page.mouse.click(w / 2, hh / 2);
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(1100);
    await page.evaluate(() => document.querySelector('[data-testid="reveal-close"]')?.click());
    await page.waitForTimeout(400);
  };
  await prep(0, 0);
  await go('standard');
  await page.waitForTimeout(400);
  await prep(89, 0);
  await play(10);
  await prep(0, 299);
  await go('legend');
  await play(1);
  const video = page.video();
  await ctx.close();
  const path = await video.path();
  const out = join(videoDir, `recruit-cinematic-${vp}.webm`);
  renameSync(path, out);
  log(`  video: ${out}`);
}

try {
  for (const vp of viewports) await run(vp);
  if (videoDir) await record(viewports[0]);
} catch (e) {
  failures.push(`crashed: ${e.message}`);
  console.error(e);
} finally {
  await browser.close();
  await server.close();
}
log(failures.length ? `\n${failures.length} check(s) failed:\n - ${failures.join('\n - ')}` : '\nAll recruit cinematic checks passed.');
process.exit(failures.length ? 1 : 0);

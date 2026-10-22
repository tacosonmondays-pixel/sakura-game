// Transitions + Mochi, the loading slime e2e (owner: "cleaner and animated menu transitions, loading
// screens, like black with a cute something like slime in the corner and loading"; then "just black or
// colored ... it saying loading is enough" and "try both!! We'll pick the loading screen after"). With
// the real UI, at 844×390 (landscape phone, touch) and 1280×720:
//   1. boot: the black loader is in the very first HTML and says "Loading" (nothing else); Mochi turns
//      visible only after 150 ms and, once visible, stays at least 450 ms; it leaves for a drawn lobby
//   2. lobby → Students → a girl → the back arrow → Students: slide / slide / slide-back; a quick
//      change never shows the corner chip; the old screen leaves in place (never a second copy of
//      it, the lobby never loses its art while it is still on show); nothing is left half-faded
//   3. stage prep → Start → battle: a cut, the black loader shows ("Loading" + Mochi and nothing else:
//      no tip, no destination line; the progress line reaching the end) and leaves only once the
//      battle HUD is up. Seen in the compositor's own frames (a screencast: the page's main thread is
//      stuck in the scene build, so a script can't watch it): Mochi is on screen, and once it has
//      shown, the screen is never bare black (no Mochi) for long before the reveal. Then Pause → Quit →
//      stage prep through the cut again
//   4. a closing dialog lets taps through at once; reduced motion: only opacity moves
//   4b. battle → results: a loss (a leak on the last life) brings the DEFEAT band, then (Retry) a stage
//      win the VICTORY band (.tx-band.win): each inserted while the sheet waits under it (.bt-banded),
//      before it rises, recorded inside the page; reduced motion: no band, the sheet is up at once
//   1b/3b. UI M5 (E7): the loading corner chip keeps clear of the primary button and the lobby's bottom-right
//      cluster (on the lobby and on stage prep)
//   5. the look (Settings → Loading screen): the row is in Graphics with Mint / Pink and Black /
//      Colour (mint on black by default); a pick saves in the settings and recolours every Mochi at
//      once; after a reload the boot loader already wears it when it is parsed (index.html's inline
//      script), in all four combinations, and the game never shows the name "Mochi"
// Frames of each kind are saved for review (--shots <dir>, default: no shots).
//
//   node e2e/transitions.mjs                       # 844x390 then 1280x720 (dev server)
//   node e2e/transitions.mjs --viewport 844x390 --shots /tmp/tx
//   node e2e/transitions.mjs --prod                # the production build in dist/ (npm run build first)
//   node e2e/transitions.mjs --only looks          # only section 5 (the loading screen's looks)
// Playwright / browser discovery: e2e/browser.mjs. The game runs with the local online adapter.
import { createServer, preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport', null) ? [opt('viewport')] : ['844x390', '1280x720'];
const shotsDir = opt('shots', null);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

const IGNORE = [
  /GPU stall due to ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i, /favicon\.ico/i,
  /Failed to load resource: net::ERR_(CERT_AUTHORITY_INVALID|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|PROXY_CONNECTION_FAILED|TUNNEL_CONNECTION_FAILED|CONNECTION_REFUSED)/i,
];
const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
}

let server;
if (args.includes('--prod')) {
  server = await preview({ root: process.cwd(), preview: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
} else {
  server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
}
const { port } = server.httpServer.address();
const origin = `http://127.0.0.1:${port}/`;
const base = `${origin}?online=local&onboarding=0`;
const { browser, label } = await launchChromium();
log(`browser: ${label}`);

/**
 * Runs before the game's scripts: a timeline of the loader, the chip, the cut panel and the ghost
 * (MutationObserver + every animation frame), and every Element.animate() call (its keyframes).
 */
function recorder() {
  const t = () => Math.round(performance.now());
  const rec = { ld: [], chip: [], ghost: [], anims: [], maxP: 0, bootStart: null, outWithHud: [], dupBack: 0, bareLobby: [], textAtShow: [], lookAtBoot: null };
  window.__rec = rec;
  const orig = Element.prototype.animate;
  Element.prototype.animate = function (kf, o) {
    try {
      const frames = Array.isArray(kf) ? kf : [];
      const props = new Set();
      for (const f of frames) for (const k of Object.keys(f)) if (!['offset', 'easing', 'composite'].includes(k)) props.add(k);
      // (a single keyframe animates from / to the element's own value: its properties move)
      const moving = frames.length === 1 ? [...props] : [...props].filter((p) => new Set(frames.map((f) => String(f[p]))).size > 1);
      rec.anims.push({ t: t(), cls: String(this.className || '').slice(0, 40), moving, duration: typeof o === 'number' ? o : o?.duration });
    } catch { /* recording only */ }
    return orig.call(this, kf, o);
  };
  const sample = () => {
    const ld = document.getElementById('ld');
    if (ld) {
      const corner = ld.querySelector('.ld-corner');
      if (rec.bootStart == null && ld.classList.contains('boot')) {
        const a = corner?.getAnimations?.()[0];
        rec.bootStart = a && typeof a.startTime === 'number' ? a.startTime : 0;
      }
      const op = corner ? Number(getComputedStyle(corner).opacity) * Number(getComputedStyle(ld).opacity) : 0;
      const on = ld.classList.contains('on');
      const last = rec.ld.at(-1);
      const row = { t: t(), on, out: ld.classList.contains('out'), cls: ld.className, vis: on && getComputedStyle(ld).visibility === 'visible' && op > 0.02 };
      if (!last || last.cls !== row.cls || last.vis !== row.vis) rec.ld.push(row);
      // what the loader says the moment it turns visible: "Loading", nothing else
      if (row.vis && (!last || !last.vis)) rec.textAtShow.push(ld.textContent.replace(/\s+/g, ' ').trim());
      const p = Number(ld.querySelector('.ld-bar')?.style.getPropertyValue('--p') || 0);
      if (p > rec.maxP) rec.maxP = p;
    }
    // never two copies of a screen at once; the lobby never on show without its art
    const backs = document.querySelectorAll('[data-testid="back"]').length;
    if (backs > rec.dupBack) rec.dupBack = backs;
    const lb = document.querySelector('.lb');
    if (lb && document.documentElement.dataset.tx && !lb.querySelector('.lb-art img')) rec.bareLobby.push({ t: t(), op: Number(getComputedStyle(lb).opacity).toFixed(2) });
    const chip = document.querySelector('.ld-chip');
    if (chip) {
      const vis = chip.classList.contains('on') && Number(getComputedStyle(chip).opacity) > 0.02;
      const last = rec.chip.at(-1);
      if (!last || last.vis !== vis) rec.chip.push({ t: t(), vis });
    }
  };
  const loop = () => {
    sample();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      for (const n of m.addedNodes || []) {
        if (n.nodeType === 1 && n.classList.contains('tx-ghost')) rec.ghost.push({ t: t(), testids: n.querySelectorAll('[data-testid]').length, inert: n.inert, hidden: n.getAttribute('aria-hidden') });
      }
      if (m.type === 'attributes' && m.target.id === 'ld' && m.target.classList.contains('out')) {
        // (the loader's entrance on the compositor: started, and past its 150 ms delay, when it leaves)
        const a = m.target.querySelector('.ld-corner')?.getAnimations?.()[0];
        const ran = a && typeof a.startTime === 'number' ? Math.round(document.timeline.currentTime - a.startTime) : null;
        rec.outWithHud.push({ t: t(), hud: !!document.querySelector('#app .bt-hud'), screen: document.querySelector('#app')?.dataset.screen, ran });
      }
    }
    sample();
  });
  // (the document node exists before its <html>: this one sees the parser add the boot loader)
  const bootMo = new MutationObserver((list) => {
    for (const m of list) {
      for (const n of m.addedNodes || []) {
        if (n.nodeType === 1 && n.id === 'ld' && !rec.lookAtBoot) {
          const html = document.documentElement;
          rec.lookAtBoot = { mochi: html.getAttribute('data-mochi'), bg: html.getAttribute('data-loader-bg'), modulesRan: !!window.__sakura };
          bootMo.disconnect();
        }
      }
    }
  });
  bootMo.observe(document, { subtree: true, childList: true });
  const start = () => mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
  if (document.documentElement) start();
  else document.addEventListener('readystatechange', start, { once: true });
}

/** The compositor's own frames (CDP screencast): they keep coming while the page's main thread is busy. */
async function screencast(page, W, H) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    frames.push({ t: metadata.timestamp * 1000, data });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 55, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  return {
    async stop() {
      await cdp.send('Page.stopScreencast').catch(() => {});
      await cdp.detach().catch(() => {});
      return frames;
    },
  };
}

/**
 * Reads the screencast frames (decoded in a page of their own): a frame is "loader" when the middle
 * of the screen is black and the bottom-right corner holds the bright "Loading" + Mochi, "black"
 * when everything is black (the cover without Mochi).
 * @returns {{ loaderFrames: number, firstLoader: number|null, bareAfter: number, coverToMochi: number|null }}
 */
async function loaderPixels(frames, W, H) {
  if (!frames.length) return { loaderFrames: 0, firstLoader: null, bareAfter: 0, coverToMochi: null };
  const ctx = await browser.newContext({ viewport: { width: 320, height: 200 } });
  const p = await ctx.newPage();
  const kinds = [];
  for (let i = 0; i < frames.length; i += 40) {
    const chunk = frames.slice(i, i + 40).map((f) => f.data);
    kinds.push(...await p.evaluate(async (list) => {
      const out = [];
      for (const b64 of list) {
        const bmp = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${b64}`)).blob());
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(bmp, 0, 0);
        const luma = (x0, y0, x1, y1) => {
          const d = g.getImageData(Math.round(x0 * bmp.width), Math.round(y0 * bmp.height), Math.max(1, Math.round((x1 - x0) * bmp.width)), Math.max(1, Math.round((y1 - y0) * bmp.height))).data;
          let sum = 0;
          let bright = 0;
          for (let k = 0; k < d.length; k += 4) {
            const l = 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2];
            sum += l;
            if (l > 110) bright++;
          }
          return { mean: sum / (d.length / 4), bright: bright / (d.length / 4) };
        };
        const mid = luma(0.3, 0.25, 0.7, 0.7);
        const corner = luma(0.72, 0.72, 0.99, 0.99);
        out.push(mid.mean > 22 ? 'screen' : corner.bright > 0.012 ? 'loader' : 'black');
      }
      return out;
    }, chunk));
  }
  await ctx.close();
  const t0 = frames[0].t;
  let firstLoader = null;
  let firstBlack = null;
  let bareAfter = 0;
  let run = 0;
  for (let i = 0; i < frames.length; i++) {
    const k = kinds[i];
    if (k === 'black' && firstBlack == null) firstBlack = frames[i].t;
    if (k === 'loader' && firstLoader == null) firstLoader = frames[i].t;
    // bare black once Mochi has been up (until the next frame shows something else)
    if (firstLoader != null && k === 'black') {
      run += (frames[i + 1]?.t ?? frames[i].t) - frames[i].t;
      if (run > bareAfter) bareAfter = run;
    } else run = 0;
  }
  return {
    seq: kinds.map((k, i) => `${Math.round(frames[i].t - t0)}:${k[0]}`).join(' '),
    loaderFrames: kinds.filter((k) => k === 'loader').length,
    firstLoader: firstLoader == null ? null : Math.round(firstLoader - t0),
    bareAfter: Math.round(bareAfter),
    coverToMochi: firstLoader != null && firstBlack != null ? Math.round(firstLoader - firstBlack) : null,
  };
}

async function run(vp, { reduced = false } = {}) {
  const [W, H] = vp.split('x').map(Number);
  const touch = Math.min(W, H) < 600;
  const tag = `${vp}${reduced ? '-reduced' : ''}`;
  log(`\n=== ${tag} ===`);
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: touch, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !IGNORE.some((re) => re.test(m.text()))) errors.push(`[console] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  // the beta-gift celebration pops up 700 ms after the lobby draws, which on a slow machine can be
  // after this script has cleared the modals, over the dock it taps next: it is not part of this
  // check, so it counts as already shown this session
  await page.addInitScript(() => {
    try { sessionStorage.setItem('sakura-beta-gift-shown', '1'); } catch { /* no storage */ }
  });
  await page.addInitScript(recorder);
  const shot = async (name) => {
    if (!shotsDir) return;
    await page.screenshot({ path: `${shotsDir}/${tag}-${name}.png` }).catch(() => {});
  };
  const tap = async (sel) => {
    const el = page.locator(sel).first();
    try {
      await (touch ? el.tap({ timeout: 25000 }) : el.click({ timeout: 25000 }));
    } catch (e) {
      if (!/Timeout/.test(e.message)) throw e;
      await (touch ? el.tap({ timeout: 20000, force: true }) : el.click({ timeout: 20000, force: true }));
    }
  };
  const settled = (name, timeout = 60000) => page.waitForFunction((n) => document.querySelector('#app')?.dataset.screen === n && !document.documentElement.dataset.tx, name, { timeout, polling: 100 }).then(() => true, () => false);
  const lastTx = () => page.evaluate(() => window.__sakura.transitions.log.at(-1));
  /** Nothing left over from a transition: no cover, loader, chip or ghost, nothing half-faded. */
  const clean = () => page.evaluate(() => {
    const bad = [];
    if (document.querySelector('#ld.on')) bad.push('loader still up');
    if (document.querySelector('.tx-cut.on')) bad.push('cut panel still on');
    if (document.querySelector('.ld-chip.on')) bad.push('chip still on');
    if (document.querySelector('.tx-ghost')) bad.push('a ghost screen is left');
    if (document.querySelector('#app')?.inert) bad.push('#app inert');
    // no Web Animation (the transitions' own: CSS ones are the screens') still running or holding a frame
    const live = document.getAnimations().filter((a) => !(a instanceof CSSAnimation) && !(a instanceof CSSTransition));
    if (live.length) bad.push(`${live.length} transition animations still in effect (${live.map((a) => a.effect?.target?.className || '?').join(', ').slice(0, 120)})`);
    // the layers the transitions move are fully there
    const app = document.querySelector('#app');
    const scr = app.querySelector(':scope > .screen');
    const layers = [app, ...app.children, ...(scr?.querySelector(':scope > .topbar') ? scr.children : [])];
    const faded = layers.filter((el) => el.getAnimations().length === 0 && Number(getComputedStyle(el).opacity) < 0.99 && !el.matches('[hidden]'));
    if (faded.length) bad.push(`half-faded: ${faded.map((e) => e.className || e.tagName).join(', ').slice(0, 120)}`);
    return bad;
  });

  /**
   * UI M5 (§5.10 E7): the loading corner never covers a primary button or the lobby's bottom-right cluster. The chip
   * is armed by hand, as a slow screen download would, and measured against them (dev server only: --prod has no
   * source modules to import).
   */
  const keepClear = async (where) => {
    if (args.includes('--prod')) return;
    await page.evaluate(async () => {
      const { armChip } = await import('/src/ui/loading/loader.js');
      window.__chipTicket = armChip();
    });
    await page.waitForTimeout(450);
    await shot(`keep-clear-${where.replace(/\W+/g, '-')}`);
    const r = await page.evaluate(async () => {
      const ticket = window.__chipTicket;
      const chip = document.querySelector('.ld-chip');
      const c = chip.getBoundingClientRect();
      const vis = chip.classList.contains('on') && Number(getComputedStyle(chip).opacity) > 0.5;
      const hits = [];
      for (const el of document.querySelectorAll('[data-primary], .lb-br, .lb-campaign, .lb-eventcard, .lb-continue, .btn-yellow, [data-testid="stage-start"]')) {
        const b = el.getBoundingClientRect();
        if (!b.width || !b.height) continue;
        if (Math.min(c.right, b.right) - Math.max(c.left, b.left) > 0 && Math.min(c.bottom, b.bottom) - Math.max(c.top, b.top) > 0) hits.push(el.dataset.testid || String(el.className).slice(0, 40));
      }
      await ticket.end();
      delete window.__chipTicket;
      return { vis, chip: [c.left, c.top, c.width, c.height].map(Math.round), hits };
    });
    await page.waitForTimeout(400);
    check(r.vis && r.hits.length === 0, `${where}: the loading corner keeps clear of the primary and the bottom-right cluster (${JSON.stringify(r)})`);
  };

  // ---- 1. boot ------------------------------------------------------------------------------------
  const resp = await page.goto(`${base}#/lobby`, { waitUntil: 'commit' });
  const html = await resp.text().catch(() => '');
  check(/<div id="ld" class="ld on boot wait"/.test(html) && html.indexOf('id="ld"') < html.indexOf('id="app"'), 'boot: the black loader is in the first HTML, before the game root');
  const bootHtml = html.slice(html.indexOf('<div id="ld"'), html.indexOf('<div id="app"'));
  check(bootHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() === 'Loading' && !/ld-tip|ld-ctx|TIP/.test(bootHtml), 'boot: it says "Loading" and nothing else (no tip, no destination)');
  await page.waitForTimeout(80);
  await shot('boot-early');
  await page.waitForFunction(() => window.__rec?.ld.some((r) => r.vis), null, { timeout: 15000 }).catch(() => null);
  await shot('boot-loader');
  check(await settled('lobby', 60000), 'boot: the lobby is drawn and the boot loader is gone');
  let rec = await page.evaluate(() => window.__rec);
  const firstVis = rec.ld.find((r) => r.vis);
  const out = rec.ld.find((r) => r.out) || rec.ld.find((r, i) => i > 0 && !r.on);
  const visibleAt = (rec.bootStart ?? 0) + 150;
  if (firstVis) {
    check(firstVis.t >= 150, `boot: Mochi turns visible only after 150 ms (first seen at ${firstVis.t} ms)`);
    check(out && out.t - visibleAt >= 445, `boot: once visible it stays ≥ 450 ms (visible from ${Math.round(visibleAt)} ms, leaves at ${out?.t} ms)`);
  } else check(true, 'boot: the page was ready within 150 ms, Mochi never showed (allowed)');
  check(rec.ld.every((r, i) => i === 0 || !rec.ld[i - 1].out || !r.vis || r.on), 'boot: no flicker (never visible again after leaving)');
  check(rec.lookAtBoot?.mochi === 'mint' && rec.lookAtBoot?.bg === 'black' && !rec.lookAtBoot.modulesRan, `boot: a new player gets mint on black, set before any module script (${JSON.stringify(rec.lookAtBoot)})`);
  const boot = await lastTx();
  check(boot?.kind === 'boot', `boot: the first change is the boot hold (${boot?.kind})`);
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
  await page.waitForTimeout(300);
  check((await clean()).length === 0, `boot: nothing left over (${(await clean()).join('; ') || 'clean'})`);
  await shot('lobby');
  await keepClear('lobby');

  // ---- 2. menus: slide, slide, slide-back ------------------------------------------------------------
  await page.evaluate(() => { window.__rec.chip.length = 0; window.__rec.bareLobby.length = 0; window.__rec.dupBack = 0; });
  await tap('[data-testid="dock-students"]');
  const toStudents = await settled('students');
  if (!toStudents) {
    await shot('students-not-open');
    log(`    (after the tap: ${JSON.stringify(await page.evaluate(() => ({ hash: location.hash, screen: document.querySelector('#app')?.dataset.screen, modals: document.querySelectorAll('.modal-overlay').length, tx: document.documentElement.dataset.tx || '' })))})`);
  }
  check(toStudents, 'lobby → Students opens the Students screen');
  let tx = await lastTx();
  check(tx?.kind === 'slide', `lobby → Students slides forward (${tx?.kind})`);
  rec = await page.evaluate(() => window.__rec);
  if (!tx?.chip) check(!rec.chip.some((c) => c.vis), 'a quick menu change never shows the corner chip');
  else check(true, `the Students code took over 150 ms here: the chip showed (${JSON.stringify(rec.chip)})`);
  check(rec.ghost.length === 0, `the outgoing screen leaves in place, never as a copy (${rec.ghost.length} copies)`);
  const bare = rec.bareLobby.filter((b) => Number(b.op) > 0.05);
  check(bare.length === 0, `the lobby keeps its art until it has faded out (${JSON.stringify(bare.slice(0, 3))})`);
  await page.waitForTimeout(400);
  let left = await clean();
  check(left.length === 0, `Students: nothing left half-faded (${left.join('; ') || 'clean'})`);
  check(await page.locator('[data-testid]').evaluateAll((els) => els.filter((e) => e.dataset.testid === 'back').length === 1), 'Students: one back arrow on the page (no second copy)');
  check(rec.dupBack <= 1, `never two back arrows during a change (max ${rec.dupBack})`);

  const girl = 'aoi';
  await tap(`#app .unit-card[data-unit="${girl}"]`);
  check(await settled('student'), `Students → a girl opens her page (${girl})`);
  tx = await lastTx();
  check(tx?.kind === 'slide', `Students → a girl slides forward (${tx?.kind})`);
  await shot('student');
  await page.waitForTimeout(300);
  await tap('#app .topbar [data-testid="back"]');
  check(await settled('students'), 'the back arrow returns to Students');
  tx = await lastTx();
  check(tx?.kind === 'slide-back', `the back arrow slides back (${tx?.kind})`);
  check((await page.evaluate(() => window.__rec.dupBack)) <= 1, 'student → Students: never two back arrows on the page');
  await page.waitForTimeout(400);
  left = await clean();
  check(left.length === 0, `after the back arrow: nothing left half-faded (${left.join('; ') || 'clean'})`);

  // ---- 3. stage → battle (cut + loader) → Quit ------------------------------------------------------
  await page.evaluate(() => {
    const { store } = window.__sakura;
    Object.assign(store.profile.settings, { quality: 'low', shadows: false, bloom: false });
    store.commit('settings');
    location.hash = '#/stage/1-1';
  });
  check(await settled('stage'), 'Students → stage prep 1-1');
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
  await page.waitForTimeout(500);
  await keepClear('stage prep');
  await page.evaluate(() => { window.__rec.ld.length = 0; window.__rec.maxP = 0; window.__rec.outWithHud.length = 0; window.__rec.textAtShow.length = 0; });
  const cast = await screencast(page, W, H);
  await tap('[data-testid="stage-start"]');
  await page.waitForFunction(() => document.querySelector('.tx-cut.on'), null, { timeout: 15000 }).catch(() => null);
  await shot('cut-cover');
  await page.waitForFunction(() => window.__rec.ld.some((r) => r.vis), null, { timeout: 20000 }).catch(() => null);
  await shot('battle-loader');
  const inBattle = await page.waitForFunction(() => !!window.__battle && document.querySelector('#app .bt-hud') && !document.documentElement.dataset.tx, null, { timeout: 90000, polling: 200 }).then(() => true, () => false);
  check(inBattle, 'Start: the battle is up and the transition is over');
  tx = await lastTx();
  check(tx?.kind === 'cut' && tx.from === 'stage' && tx.to === 'battle', `stage → battle is a cut (${tx?.kind} ${tx?.from}→${tx?.to})`);
  await page.waitForTimeout(300);
  const castFrames = await cast.stop();
  rec = await page.evaluate(() => window.__rec);
  const pix = await loaderPixels(castFrames, W, H);
  log(`    (screencast: ${castFrames.length} frames, loader in ${pix.loaderFrames}, first at +${pix.firstLoader} ms, bare black after it ${pix.bareAfter} ms, cover→Mochi ${pix.coverToMochi} ms)`);
  log(`    (frames: ${pix.seq.slice(0, 600)})`);
  if (shotsDir) castFrames.forEach((f, i) => writeFileSync(`${shotsDir}/${tag}-cast-${String(i).padStart(3, '0')}.jpg`, Buffer.from(f.data, 'base64')));
  // (the gate's own record and the compositor's frames; the rAF sampler is blind while the main thread builds the scene)
  // (a loaded machine can starve the screencast of frames: then the entrance's own clock speaks for it)
  const ranAtOut = Math.max(-1, ...rec.outWithHud.map((o) => o.ran ?? -1));
  const seen = pix.loaderFrames > 0 || (castFrames.length < 20 && ranAtOut > 150 + 160);
  check(tx?.loader && seen, `the black loader showed for the battle load (gate: ${tx?.loader}, in ${pix.loaderFrames} of ${castFrames.length} compositor frames, entrance ran ${ranAtOut} ms)`);
  check(pix.bareAfter <= 350, `once Mochi is up, the screen is never bare black for long before the reveal (${pix.bareAfter} ms)`);
  const ldText = await page.evaluate(() => ({ text: document.querySelector('#ld')?.textContent.replace(/\s+/g, ' ').trim(), extra: document.querySelectorAll('#ld .ld-tip, #ld .ld-ctx, #ld .ld-left').length }));
  check(ldText.text === 'Loading' && ldText.extra === 0, `the battle loader says "Loading" and nothing else: no tip, no destination ("${ldText.text}", ${ldText.extra} extra lines)`);
  check(rec.textAtShow.every((c) => c === 'Loading'), `from its first visible frame too (${JSON.stringify(rec.textAtShow)})`);
  check(rec.maxP >= 0.999, `the progress line reached the end: the battle counts its models (max ${rec.maxP})`);
  check(rec.outWithHud.length > 0 && rec.outWithHud.every((o) => o.hud), `the loader left only once the battle HUD was up (${JSON.stringify(rec.outWithHud)})`);
  left = await clean();
  check(left.length === 0, `battle: no cover / loader left, nothing half-faded (${left.join('; ') || 'clean'})`);
  await shot('battle');
  // a tap on the HUD right away lands (nothing blocks it)
  await tap('[data-testid="pause"]');
  check(await page.waitForSelector('[data-testid="pause-menu"]:not([hidden])', { timeout: 15000 }).then(() => true, () => false), 'battle: the first tap on the HUD (Pause) lands');
  await tap('[data-testid="quit"]');
  const ok = await page.waitForSelector('[data-testid="confirm-ok"]', { timeout: 15000 }).catch(() => null);
  if (ok) await tap('[data-testid="confirm-ok"]');
  // a closing dialog lets taps through at once
  const closing = await page.evaluate(() => [...document.querySelectorAll('.modal-overlay.closing')].map((o) => `${getComputedStyle(o).pointerEvents}/${o.inert ? 'inert' : 'live'}`));
  check(closing.every((p) => p === 'none/inert'), `a closing dialog lets taps through and is inert (${JSON.stringify(closing)})`);
  check(await settled('stage', 60000), 'Pause → Quit → stage prep');
  tx = await lastTx();
  check(tx?.kind === 'cut' && tx.from === 'battle', `battle → stage prep is a cut (${tx?.kind})`);
  check(!(await page.evaluate(() => !!window.__battle)), 'the battle is gone (cleaned up under the cover)');
  await page.waitForTimeout(400);
  left = await clean();
  check(left.length === 0, `after Quit: nothing left over (${left.join('; ') || 'clean'})`);
  await shot('stage-after-quit');

  // ---- 4. motion: reduced → opacity only -----------------------------------------------------------
  rec = await page.evaluate(() => window.__rec);
  const moving = rec.anims.flatMap((a) => a.moving);
  const allowed = reduced ? ['opacity'] : ['opacity', 'transform'];
  check(moving.every((p) => allowed.includes(p)), `${reduced ? 'reduced motion: only opacity moves' : 'transitions move transform / opacity only'} (${[...new Set(moving)].join(', ')})`);
  const durations = rec.anims.map((a) => a.duration).filter((d) => typeof d === 'number');
  check(durations.every((d) => d <= 320), `every transition animation is ≤ 320 ms (max ${Math.max(0, ...durations)})`);
  if (reduced) {
    const still = await page.evaluate(() => document.querySelectorAll('.mochi *').length === 0 || [...document.querySelectorAll('.mochi *')].every((el) => getComputedStyle(el).animationName === 'none'));
    check(still, 'reduced motion: Mochi stands still');
  }

  // ---- 4b. battle → results: DEFEAT, then (Retry) VICTORY, each band before the sheet rises -------
  // A recorder in the page (MutationObserver, as e2e/ascension.mjs does for titans: a busy machine
  // cannot miss the 0.9 s band) notes when the result sheet is added and whether the overlay holds it
  // (.bt-banded), when the band (.tx-band-clip > .tx-band.<tone>) is inserted and what it says, and
  // when the sheet rises (.bt-banded comes off). Reduced motion: no band, the sheet is up at once.
  const watchResult = () => page.evaluate(() => {
    window.__resObs?.disconnect();
    const t = () => Math.round(performance.now());
    const r = { sheetAt: null, kind: null, sheetHeld: null, bandAt: null, word: null, tone: null, heldAtBand: null, riseAt: null };
    window.__res = r;
    const SHEET = '.bt-result.bt-win, .bt-result.bt-lose';
    window.__resObs = new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === 'attributes') {
          const el = m.target;
          if (r.sheetAt != null && r.riseAt == null && el.matches('.bt-result-overlay') && /\bbt-banded\b/.test(m.oldValue || '') && !el.classList.contains('bt-banded')) r.riseAt = t();
          continue;
        }
        for (const n of m.addedNodes) {
          if (!(n instanceof Element)) continue;
          const sheet = n.matches(SHEET) ? n : n.querySelector(SHEET);
          if (sheet && r.sheetAt == null) {
            r.sheetAt = t();
            r.kind = sheet.classList.contains('bt-win') ? 'win' : 'lose';
            r.sheetHeld = !!sheet.closest('.bt-result-overlay')?.classList.contains('bt-banded');
          }
          if (n.matches('.tx-band-clip') && r.bandAt == null) {
            r.bandAt = t();
            r.word = n.textContent;
            r.tone = ['win', 'lose'].find((c) => n.querySelector('.tx-band')?.classList.contains(c)) || null;
            r.heldAtBand = !!n.parentElement?.classList.contains('bt-banded');
          }
        }
      }
    });
    window.__resObs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  });
  /** Waits for the sheet (and, with motion, the band and the rise), then returns the record. */
  const resultRecord = async () => {
    await page.waitForFunction(() => window.__res?.sheetAt != null, null, { timeout: 30000 }).catch(() => null);
    if (!reduced) await page.waitForFunction(() => window.__res?.riseAt != null, null, { timeout: 30000 }).catch(() => null);
    else await page.waitForTimeout(1500); // (long enough for a band that should not come)
    return page.evaluate(() => {
      window.__resObs?.disconnect();
      return window.__res;
    });
  };
  const bandChecks = (rr, word, tone) => {
    if (reduced) {
      check(rr?.sheetAt != null && rr.word == null && rr.sheetHeld === false, `reduced motion: no ${word} band, the ${tone} sheet is up at once (${JSON.stringify(rr)})`);
      return;
    }
    check(rr?.word === word && rr.tone === tone, `the ${word} band (.tx-band.${tone}) plays at the end (${rr?.word} / ${rr?.tone})`);
    check(rr?.kind === tone && rr.sheetHeld === true && rr.heldAtBand === true, `the ${tone} sheet waits under it (.bt-banded when added and when the band comes in)`);
    check(rr?.bandAt != null && rr.riseAt != null && rr.bandAt < rr.riseAt, `the band is inserted before the sheet rises (band +${rr?.bandAt != null && rr?.sheetAt != null ? rr.bandAt - rr.sheetAt : '?'} ms, rise +${rr?.riseAt != null && rr?.sheetAt != null ? rr.riseAt - rr.sheetAt : '?'} ms after the sheet)`);
  };
  const battleUp = (old = null) => page.waitForFunction((had) => {
    const b = window.__battle;
    return !!b?.ui?.settleFinished && b !== window[had] && document.querySelector('#app .bt-hud') && !document.documentElement.dataset.tx;
  }, old, { timeout: 90000, polling: 200 }).then(() => true, () => false);

  await page.evaluate(() => {
    const { store } = window.__sakura;
    store.profile.battleSaves = {}; // the quit battle saved itself: this link starts a new one
    store.commit('battle-save');
    document.querySelectorAll('.modal-overlay').forEach((m) => m.remove());
    location.hash = '#/battle?stage=1-1&difficulty=normal';
  });
  check(await battleUp(), 'results: a new battle on 1-1');
  // a loss through the sim's own path: one life left, the first enemy on the road leaks
  await watchResult();
  const lost = await page.evaluate(async () => {
    const { sim } = window.__battle;
    if (sim.state === 'prep' || sim.state === 'between') sim.startNextWave();
    for (let i = 0; i < 400 && !sim.enemies.some((e) => !e.dead); i++) await new Promise((r) => setTimeout(r, 25));
    const e = sim.enemies.find((x) => !x.dead);
    if (!e) return sim.state;
    sim.lives = 1;
    sim._leak(e);
    return sim.state;
  });
  check(lost === 'lost', `results: the battle is lost (${lost})`);
  const lose = await resultRecord();
  await shot('result-defeat');
  bandChecks(lose, 'DEFEAT', 'lose');
  // Retry, then a stage win (the battle marked won, the controller ends it as on the last wave)
  await page.evaluate(() => { window.__oldBattle = window.__battle; });
  await tap('#app .bt-result-overlay [data-testid="retry"]');
  check(await battleUp('__oldBattle'), 'results: Retry starts the battle again');
  await watchResult();
  await page.evaluate(() => {
    const b = window.__battle;
    b.sim.state = 'won';
    b.ui.settleFinished();
  });
  const win = await resultRecord();
  await shot('result-victory');
  bandChecks(win, 'VICTORY', 'win');
  check(await page.evaluate(() => document.querySelector('.bt-result.bt-win .bt-result-ribbon')?.textContent === 'VICTORY!'), `results: the victory sheet is up${reduced ? '' : ' after the band'}`);
  left = await page.evaluate(() => (document.querySelector('.tx-band-clip') ? ['a band is left over'] : []));
  check(left.length === 0, `results: the band is gone once the sheet is up (${left.join('; ') || 'clean'})`);

  check(!(await page.evaluate(() => /mochi/i.test(document.body.innerText))), 'the game never shows the name "Mochi"');
  check(!errors.length, `no page / console errors${errors.length ? `\n       ${errors.slice(0, 6).join('\n       ')}` : ''}`);
  await context.close();
}

/**
 * 5. The loading screen's look: Settings → Loading screen (Mint / Pink, Black / Colour), saved in the
 * settings, on <html> at once, and read by index.html's inline script before the boot loader is parsed.
 */
async function looks(vp) {
  const [W, H] = vp.split('x').map(Number);
  const touch = Math.min(W, H) < 600;
  log(`\n=== ${vp} looks ===`);
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: touch });
  const errors = [];
  await context.addInitScript(() => {
    try { sessionStorage.setItem('sakura-beta-gift-shown', '1'); } catch { /* no storage */ }
  });
  await context.addInitScript(recorder);
  /** A page of this context (one storage): the reloads below each get a fresh one. */
  const openPage = async () => {
    const p = await context.newPage();
    p.on('console', (m) => {
      if (m.type() === 'error' && !IGNORE.some((re) => re.test(m.text()))) errors.push(`[console] ${m.text()}`);
    });
    p.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
    return p;
  };
  let page = await openPage();
  const settled = (name, timeout = 60000) => page.waitForFunction((n) => document.querySelector('#app')?.dataset.screen === n && !document.documentElement.dataset.tx, name, { timeout, polling: 100 }).then(() => true, () => false);
  const tapSeg = async (testid, text) => {
    const el = page.locator(`[data-testid="${testid}"] .ma-seg-btn`, { hasText: text }).first();
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await (touch ? el.tap({ timeout: 20000 }) : el.click({ timeout: 20000 }));
  };
  const lookOnHtml = () => page.evaluate(() => ({ mochi: document.documentElement.getAttribute('data-mochi'), bg: document.documentElement.getAttribute('data-loader-bg') }));
  /** What the page draws for the look: the boot loader's background colour, the jelly and the sprig shown. */
  const drawn = (sel = '#ld .mochi') => page.evaluate((s) => {
    const m = document.querySelector(s);
    const ld = document.getElementById('ld');
    const stop = document.querySelector('#mochi-jelly stop:nth-child(3)');
    return {
      bg: ld ? getComputedStyle(ld).backgroundColor : null,
      bgImage: ld ? getComputedStyle(ld).backgroundImage : null,
      jelly: stop ? getComputedStyle(stop).stopColor : null,
      jellyVar: m ? getComputedStyle(m).getPropertyValue('--mochi-jelly-3').trim() : null,
      petal: m ? getComputedStyle(m.querySelector('.mochi-petal')).display : null,
      leaf: m ? getComputedStyle(m.querySelector('.mochi-leaf')).display : null,
    };
  }, sel);

  await page.goto(`${base}#/settings`, { waitUntil: 'commit' });
  check(await settled('settings'), 'looks: Settings opens');
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
  const row = await page.evaluate(() => {
    const g = document.querySelector('[data-section="graphics"]');
    const r = g?.querySelector('[data-testid="set-loadingMochi"]')?.closest('.ma-set-row');
    const seg = (id) => [...(r?.querySelectorAll(`[data-testid="${id}"] .ma-seg-btn`) || [])].map((b) => `${b.textContent}${b.classList.contains('active') ? '*' : ''}`);
    return { label: r?.querySelector('.ma-set-label')?.textContent, mochi: seg('set-loadingMochi'), bg: seg('set-loadingBg'), preview: !!r?.querySelector('[data-testid="set-loading-preview"] .mochi') };
  });
  check(row.label === 'Loading screen' && row.preview, `looks: the "Loading screen" row is in Graphics, with a preview (${JSON.stringify(row)})`);
  check(row.mochi.join() === 'Mint*,Pink' && row.bg.join() === 'Black*,Colour', `looks: slime Mint / Pink, background Black / Colour, Mint + Black picked (${row.mochi.join(' ')} · ${row.bg.join(' ')})`);
  const def = await lookOnHtml();
  check(def.mochi === 'mint' && def.bg === 'black', `looks: <html> wears the default (${JSON.stringify(def)})`);

  await tapSeg('set-loadingMochi', 'Pink');
  await page.waitForTimeout(200);
  let now = await lookOnHtml();
  let pv = await drawn('[data-testid="set-loading-preview"] .mochi');
  check(now.mochi === 'sakura' && now.bg === 'black', `looks: Pink puts data-mochi="sakura" on <html> at once (${JSON.stringify(now)})`);
  check(pv.jellyVar === '#ff9cbf' && pv.petal === 'none' && pv.leaf !== 'none', `looks: every Mochi turns pink with a mint leaf (preview: jelly ${pv.jellyVar}, petal ${pv.petal}, leaf ${pv.leaf})`);
  await tapSeg('set-loadingBg', 'Colour');
  await page.waitForTimeout(200);
  now = await lookOnHtml();
  pv = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="set-loading-preview"]')).backgroundImage);
  check(now.bg === 'colour', `looks: Colour puts data-loader-bg="colour" on <html> (${JSON.stringify(now)})`);
  check(/radial-gradient/.test(pv), 'looks: the preview shows the night-navy background with its glow');
  const saved = await page.waitForFunction(() => {
    const t = localStorage.getItem('sakura-sentinels-save-v1') || '';
    return t.includes('"loadingMochi":"sakura"') && t.includes('"loadingBg":"colour"');
  }, null, { timeout: 10000 }).then(() => true, () => false);
  const st = await page.evaluate(() => ({ ...window.__sakura.store.profile.settings }));
  check(saved && st.loadingMochi === 'sakura' && st.loadingBg === 'colour', `looks: the pick is saved in the settings (${st.loadingMochi} + ${st.loadingBg})`);
  check(!(await page.evaluate(() => /mochi/i.test(document.body.innerText))), 'looks: Settings never shows the name "Mochi"');

  // after a reload: the boot loader wears the saved look from its first parse, in all four combinations
  const COLORS = { mint: 'rgb(118, 218, 156)', sakura: 'rgb(255, 156, 191)' };
  const BG = { black: 'rgb(5, 6, 8)', colour: 'rgb(11, 22, 48)' };
  for (const [mochi, bg] of [['mint', 'black'], ['sakura', 'black'], ['mint', 'colour'], ['sakura', 'colour']]) {
    await page.evaluate(([m, b]) => {
      const { store } = window.__sakura;
      Object.assign(store.profile.settings, { loadingMochi: m, loadingBg: b });
      store.commit('settings');
      store.saveNow();
    }, [mochi, bg]);
    // a fresh page of the same context (the same storage), once the old one has stopped loading;
    // a URL of its own: going to the same URL with only a hash would not load the page again
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.close();
    page = await openPage();
    await page.goto(`${base}&look=${mochi}-${bg}#/lobby`, { waitUntil: 'commit' });
    await page.waitForFunction(() => window.__rec?.lookAtBoot, null, { timeout: 30000 }).catch(() => null);
    const at = await page.evaluate(() => window.__rec.lookAtBoot);
    const d = await drawn();
    check(at?.mochi === mochi && at?.bg === bg && !at.modulesRan, `looks: ${mochi} + ${bg}: on <html> when the boot loader is parsed, before any module script (${JSON.stringify(at)})`);
    check(d.jelly === COLORS[mochi] && d.bg === BG[bg] && (bg === 'colour') === /radial-gradient/.test(d.bgImage) && (mochi === 'sakura') === (d.petal === 'none'), `looks: ${mochi} + ${bg}: the boot loader draws it (jelly ${d.jelly}, background ${d.bg}${/radial/.test(d.bgImage) ? ' + glow' : ''}, petal ${d.petal}, leaf ${d.leaf})`);
    check(await settled('lobby'), `looks: ${mochi} + ${bg}: the lobby comes up`);
    if (shotsDir) await page.screenshot({ path: `${shotsDir}/${vp}-look-${mochi}-${bg}.png` }).catch(() => {});
    await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
  }
  check(!errors.length, `looks: no page / console errors${errors.length ? `\n       ${errors.slice(0, 6).join('\n       ')}` : ''}`);
  await context.close();
}

const only = opt('only', null);
try {
  if (!only) {
    for (const vp of viewports) await run(vp);
    await run(viewports[0], { reduced: true });
  }
  await looks(viewports[0]);
} finally {
  await browser.close();
  await (server.close ? server.close() : new Promise((r) => server.httpServer.close(r)));
}
log(failures.length ? `\n${failures.length} check(s) failed:\n  - ${failures.join('\n  - ')}` : '\nall transition checks passed');
process.exit(failures.length ? 1 : 0);

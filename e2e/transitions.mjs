// Transitions + the loading slime e2e (owner: "cleaner and animated menu transitions, loading screens,
// like black with a cute something like slime in the corner and loading"). With the real UI, at
// 844×390 (landscape phone, touch) and 1280×720:
//   1. boot: the black loader is in the very first HTML; its slime turns visible only after 150 ms
//      and, once visible, stays at least 450 ms; it leaves for a drawn lobby
//   2. lobby → Students → a girl → the back arrow → Students: slide / slide / slide-back; a quick
//      change never shows the corner chip; the old screen leaves in place (never a second copy of
//      it, the lobby never loses its art while it is still on show); nothing is left half-faded
//   3. stage prep → Start → battle: a cut, the black loader shows ("Deploying · 1-1 …" from its
//      first frame, a tip, the progress line reaching the end) and leaves only once the battle HUD
//      is up. Seen in the compositor's own frames (a screencast: the page's main thread is stuck in
//      the scene build, so a script can't watch it): the slime is on screen, and once it has shown,
//      the screen is never bare black (no slime) for long before the reveal. Then Pause → Quit →
//      stage prep through the cut again
//   4. a closing dialog lets taps through at once; reduced motion: only opacity moves
// Frames of each kind are saved for review (--shots <dir>, default: no shots).
//
//   node e2e/transitions.mjs                       # 844x390 then 1280x720 (dev server)
//   node e2e/transitions.mjs --viewport 844x390 --shots /tmp/tx
//   node e2e/transitions.mjs --prod                # the production build in dist/ (npm run build first)
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
  const rec = { ld: [], chip: [], ghost: [], anims: [], maxP: 0, bootStart: null, outWithHud: [], dupBack: 0, bareLobby: [], ctxAtShow: [] };
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
      // what the loader says the moment it turns visible (the destination is there from the start)
      if (row.vis && (!last || !last.vis)) rec.ctxAtShow.push(ld.querySelector('.ld-ctx')?.hidden ? '' : ld.querySelector('.ld-ctx')?.textContent || '');
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
 * of the screen is black and the bottom-right corner holds the bright "Loading" + slime, "black"
 * when everything is black (the cover without the slime).
 * @returns {{ loaderFrames: number, firstLoader: number|null, bareAfter: number, coverToSlime: number|null }}
 */
async function loaderPixels(frames, W, H) {
  if (!frames.length) return { loaderFrames: 0, firstLoader: null, bareAfter: 0, coverToSlime: null };
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
    // bare black once the slime has been up (until the next frame shows something else)
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
    coverToSlime: firstLoader != null && firstBlack != null ? Math.round(firstLoader - firstBlack) : null,
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

  // ---- 1. boot ------------------------------------------------------------------------------------
  const resp = await page.goto(`${base}#/lobby`, { waitUntil: 'commit' });
  const html = await resp.text().catch(() => '');
  check(/<div id="ld" class="ld on boot wait"/.test(html) && html.indexOf('id="ld"') < html.indexOf('id="app"'), 'boot: the black loader is in the first HTML, before the game root');
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
    check(firstVis.t >= 150, `boot: the slime turns visible only after 150 ms (first seen at ${firstVis.t} ms)`);
    check(out && out.t - visibleAt >= 445, `boot: once visible it stays ≥ 450 ms (visible from ${Math.round(visibleAt)} ms, leaves at ${out?.t} ms)`);
  } else check(true, 'boot: the page was ready within 150 ms, the slime never showed (allowed)');
  check(rec.ld.every((r, i) => i === 0 || !rec.ld[i - 1].out || !r.vis || r.on), 'boot: no flicker (never visible again after leaving)');
  const boot = await lastTx();
  check(boot?.kind === 'boot', `boot: the first change is the boot hold (${boot?.kind})`);
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
  await page.waitForTimeout(300);
  check((await clean()).length === 0, `boot: nothing left over (${(await clean()).join('; ') || 'clean'})`);
  await shot('lobby');

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
  await page.evaluate(() => { window.__rec.ld.length = 0; window.__rec.maxP = 0; window.__rec.outWithHud.length = 0; window.__rec.ctxAtShow.length = 0; });
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
  log(`    (screencast: ${castFrames.length} frames, loader in ${pix.loaderFrames}, first at +${pix.firstLoader} ms, bare black after it ${pix.bareAfter} ms, cover→slime ${pix.coverToSlime} ms)`);
  log(`    (frames: ${pix.seq.slice(0, 600)})`);
  if (shotsDir) castFrames.forEach((f, i) => writeFileSync(`${shotsDir}/${tag}-cast-${String(i).padStart(3, '0')}.jpg`, Buffer.from(f.data, 'base64')));
  // (the gate's own record and the compositor's frames; the rAF sampler is blind while the main thread builds the scene)
  // (a loaded machine can starve the screencast of frames: then the entrance's own clock speaks for it)
  const ranAtOut = Math.max(-1, ...rec.outWithHud.map((o) => o.ran ?? -1));
  const seen = pix.loaderFrames > 0 || (castFrames.length < 20 && ranAtOut > 150 + 160);
  check(tx?.loader && seen, `the black loader showed for the battle load (gate: ${tx?.loader}, in ${pix.loaderFrames} of ${castFrames.length} compositor frames, entrance ran ${ranAtOut} ms)`);
  check(pix.bareAfter <= 350, `once the slime is up, the screen is never bare black for long before the reveal (${pix.bareAfter} ms)`);
  const ctxText = await page.evaluate(() => document.querySelector('#ld .ld-ctx')?.textContent || '');
  check(/Deploying/i.test(ctxText) && /1-1/.test(ctxText), `the loader names the destination ("${ctxText}")`);
  check(rec.ctxAtShow.length === 0 || rec.ctxAtShow.every((c) => /Deploying/i.test(c) && /1-1/.test(c)), `the destination is on the loader from its first visible frame (${JSON.stringify(rec.ctxAtShow)})`);
  check(rec.maxP >= 0.999, `the progress line reached the end (max ${rec.maxP})`);
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
    const slimeRunning = await page.evaluate(() => document.querySelectorAll('.sl *').length === 0 || [...document.querySelectorAll('.sl *')].every((el) => getComputedStyle(el).animationName === 'none'));
    check(slimeRunning, 'reduced motion: the slime stands still');
  }
  check(!errors.length, `no page / console errors${errors.length ? `\n       ${errors.slice(0, 6).join('\n       ')}` : ''}`);
  await context.close();
}

try {
  for (const vp of viewports) await run(vp);
  await run(viewports[0], { reduced: true });
} finally {
  await browser.close();
  await (server.close ? server.close() : new Promise((r) => server.httpServer.close(r)));
}
log(failures.length ? `\n${failures.length} check(s) failed:\n  - ${failures.join('\n  - ')}` : '\nall transition checks passed');
process.exit(failures.length ? 1 : 0);

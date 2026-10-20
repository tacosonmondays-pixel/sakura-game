// Transitions + the loading slime e2e (owner: "cleaner and animated menu transitions, loading screens,
// like black with a cute something like slime in the corner and loading"). With the real UI, at
// 844×390 (landscape phone, touch) and 1280×720:
//   1. boot: the black loader is in the very first HTML; its slime turns visible only after 150 ms
//      and, once visible, stays at least 450 ms; it leaves for a drawn lobby
//   2. lobby → Students → a girl → the back arrow → Students: slide / slide / slide-back; a quick
//      change never shows the corner chip; the outgoing ghost carries no test ids; nothing is left
//      half-faded afterwards
//   3. stage prep → Start → battle: a cut, the black loader shows ("Deploying · 1-1 …", a tip, the
//      progress line reaching the end) and leaves only once the battle HUD is up; then Pause →
//      Quit → stage prep through the cut again
//   4. a closing dialog lets taps through at once; reduced motion: only opacity moves
// Frames of each kind are saved for review (--shots <dir>, default: no shots).
//
//   node e2e/transitions.mjs                       # 844x390 then 1280x720 (dev server)
//   node e2e/transitions.mjs --viewport 844x390 --shots /tmp/tx
//   node e2e/transitions.mjs --prod                # the production build in dist/ (npm run build first)
// Playwright / browser discovery: e2e/browser.mjs. The game runs with the local online adapter.
import { createServer, preview } from 'vite';
import { mkdirSync } from 'node:fs';
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
  const rec = { ld: [], chip: [], ghost: [], anims: [], maxP: 0, bootStart: null, outWithHud: [] };
  window.__rec = rec;
  const orig = Element.prototype.animate;
  Element.prototype.animate = function (kf, o) {
    try {
      const frames = Array.isArray(kf) ? kf : [];
      const props = new Set();
      for (const f of frames) for (const k of Object.keys(f)) if (!['offset', 'easing', 'composite'].includes(k)) props.add(k);
      const moving = [...props].filter((p) => new Set(frames.map((f) => String(f[p]))).size > 1);
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
      const p = Number(ld.querySelector('.ld-bar')?.style.getPropertyValue('--p') || 0);
      if (p > rec.maxP) rec.maxP = p;
    }
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
        rec.outWithHud.push({ t: t(), hud: !!document.querySelector('#app .bt-hud'), screen: document.querySelector('#app')?.dataset.screen });
      }
    }
    sample();
  });
  const start = () => mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
  if (document.documentElement) start();
  else document.addEventListener('readystatechange', start, { once: true });
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
  await page.evaluate(() => { window.__rec.chip.length = 0; });
  await tap('[data-testid="dock-students"]');
  const toStudents = await settled('students');
  check(toStudents, 'lobby → Students opens the Students screen');
  let tx = await lastTx();
  check(tx?.kind === 'slide', `lobby → Students slides forward (${tx?.kind})`);
  rec = await page.evaluate(() => window.__rec);
  if (!tx?.chip) check(!rec.chip.some((c) => c.vis), 'a quick menu change never shows the corner chip');
  else check(true, `the Students code took over 150 ms here: the chip showed (${JSON.stringify(rec.chip)})`);
  check(rec.ghost.length > 0 && rec.ghost.every((g) => g.testids === 0 && g.inert && g.hidden === 'true'), `the outgoing screen (ghost) is inert, aria-hidden and has no test ids (${JSON.stringify(rec.ghost.slice(-1))})`);
  await page.waitForTimeout(400);
  let left = await clean();
  check(left.length === 0, `Students: nothing left half-faded (${left.join('; ') || 'clean'})`);
  check(await page.locator('[data-testid]').evaluateAll((els) => els.filter((e) => e.dataset.testid === 'back').length === 1), 'Students: one back arrow on the page (no second copy)');

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
  await page.evaluate(() => { window.__rec.ld.length = 0; window.__rec.maxP = 0; window.__rec.outWithHud.length = 0; });
  await tap('[data-testid="stage-start"]');
  await page.waitForFunction(() => document.querySelector('.tx-cut.on'), null, { timeout: 15000 }).catch(() => null);
  await shot('cut-cover');
  await page.waitForFunction(() => window.__rec.ld.some((r) => r.vis), null, { timeout: 20000 }).catch(() => null);
  await shot('battle-loader');
  const inBattle = await page.waitForFunction(() => !!window.__battle && document.querySelector('#app .bt-hud') && !document.documentElement.dataset.tx, null, { timeout: 90000, polling: 200 }).then(() => true, () => false);
  check(inBattle, 'Start: the battle is up and the transition is over');
  tx = await lastTx();
  check(tx?.kind === 'cut' && tx.from === 'stage' && tx.to === 'battle', `stage → battle is a cut (${tx?.kind} ${tx?.from}→${tx?.to})`);
  rec = await page.evaluate(() => window.__rec);
  check(tx?.loader && rec.ld.some((r) => r.vis), `the black loader showed for the battle load (gate: ${tx?.loader}, seen: ${rec.ld.some((r) => r.vis)})`);
  const ctxText = await page.evaluate(() => document.querySelector('#ld .ld-ctx')?.textContent || '');
  check(/Deploying/i.test(ctxText) && /1-1/.test(ctxText), `the loader names the destination ("${ctxText}")`);
  check(rec.maxP >= 0.999, `the progress line reached the end (max ${rec.maxP})`);
  check(rec.outWithHud.length > 0 && rec.outWithHud.every((o) => o.hud), `the loader left only once the battle HUD was up (${JSON.stringify(rec.outWithHud)})`);
  await page.waitForTimeout(300);
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
  const closing = await page.evaluate(() => [...document.querySelectorAll('.modal-overlay.closing')].map((o) => getComputedStyle(o).pointerEvents));
  check(closing.every((p) => p === 'none'), `a closing dialog lets taps through (${JSON.stringify(closing)})`);
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

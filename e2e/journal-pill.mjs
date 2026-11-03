// The Journal pill never takes a tap meant for an overlay. When a Journal lesson unlocks, Hikari's pill
// (button.jn-toast, src/ui/story/toast.js) shows for a few seconds at z 350, over every modal and sheet. Before this
// check existed, a modal opened while the pill was up had the pill sitting on its top row, so a tap meant for the
// modal opened the Journal instead (the smoke's SSR Select Ticket flake had the same cause). Now, while any overlay
// is open, the pill is hidden (not visible, no pointer events) and its clock stops; it shows again for the time it
// had left once the last overlay closes, and the lesson stays unlocked either way.
// At each viewport (844x390 and 390x844 touch, 1280x720 mouse), on a save that has cleared 1-1:
//   1. home: clear 1-2 the way a battle does (store commit 'battle-result') → the pill shows; open the Notice;
//      a tap where the pill sits lands on the Notice and the Journal does not open; the pill is hidden and takes no
//      pointer events; a components toast shown meanwhile sits at its own top (no gap left for the pill); the
//      Notice stays open longer than the pill's 4 s; on close the pill is back and a tap on it opens the Journal on
//      that lesson, which is unlocked
//   2. Students: clear 1-3 → the pill; the unit-info sheet (hold sheet) opens; the same tap stays in the sheet
//   3. the sheet kit (.ui-layer: gear, items, profile parts), the beta gift modal, the home Menu sheet: each
//      hides the pill while open and lets it back on close
//   4. every other layer that covers the page (recruit reveal, bestiary sheet, chat drawer, sticker picker, story
//      player, special fanfare, rotate reminder) hides it, and a closing modal or sheet (taps go through) does not
//
//   node e2e/journal-pill.mjs                                    # all three viewports, own Vite server on a free port
//   node e2e/journal-pill.mjs --viewport 844x390 --port 5193     # own Vite server on that port (strict)
//   node e2e/journal-pill.mjs --url http://127.0.0.1:5193/ --shots <dir> --tag after   # a running dev server
// Exit code 1 if any check fails. Screenshots (JPEG) are optional.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = (opt('viewport', '844x390,390x844,1280x720')).split(',').map((s) => s.trim()).filter(Boolean);
const shotsDir = opt('shots', null);
const tag = opt('tag', 'run');
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const PORT = Number(opt('port', '0'));
const URL_ARG = opt('url', null);

const BETA_SHOWN_KEY = 'sakura-beta-gift-shown';
const IGNORE = [
  /GPU stall due to ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i,
  /favicon\.ico/i,
  /Failed to load resource: net::ERR_(CERT_AUTHORITY_INVALID|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|PROXY_CONNECTION_FAILED|TUNNEL_CONNECTION_FAILED|CONNECTION_REFUSED)/i,
];

const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  if (cond) log(`  ok   ${msg}`);
  else {
    log(`  FAIL ${msg}`);
    failures.push(msg);
  }
  return cond;
}

let server = null;
let base = URL_ARG;
if (!base) {
  server = await createServer({ root: process.cwd(), server: { port: PORT, strictPort: PORT > 0, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
  base = `http://127.0.0.1:${server.httpServer.address().port}/`;
}
if (!base.endsWith('/')) base += '/';

// a cleared stage, as the game stores it
const stage = { clears: 1, easy: false, normal: true, hard: false, nightmare: false };

let browser;
try {
  const launched = await launchChromium();
  browser = launched.browser;
  log(`browser: ${launched.label}; server: ${base}`);
} catch (e) {
  await server?.close();
  throw e;
}

/** The pill's state as a player would meet it. */
const pillState = (page) => page.evaluate(() => {
  const el = document.querySelector('.jn-toast:not(.out)');
  if (!el) return { there: false };
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const x = r.x + r.width / 2;
  const y = r.y + r.height / 2;
  const top = document.elementFromPoint(x, y);
  return {
    there: true, visible: cs.visibility !== 'hidden' && cs.display !== 'none', pe: cs.pointerEvents,
    x, y, w: r.width, h: r.height, onTop: !!top?.closest('.jn-toast'), lessons: el.dataset.lessons || '',
  };
});

async function runViewport(vp) {
  const [w, hgt] = vp.split('x').map(Number);
  const touch = Math.min(w, hgt) < 600;
  log(`\n=== viewport ${vp}${touch ? ' (touch)' : ''} ===`);
  const context = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, reducedMotion: 'no-preference' });
  // a fresh profile (?onboarding=0: the opening and tutorial count as skipped), no beta-gift celebration, no title
  await context.addInitScript((betaKey) => {
    sessionStorage.setItem(betaKey, '1');
    sessionStorage.setItem('sakura-title-seen', '1');
  }, BETA_SHOWN_KEY);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (!IGNORE.some((re) => re.test(t))) errors.push(`[console] ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

  const shot = async (name) => {
    if (!shotsDir) return;
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 120))))).catch(() => {});
    await page.screenshot({ path: `${shotsDir}/${tag}-${vp}-${name}.jpg`, type: 'jpeg', quality: 62 }).catch((e) => log(`  (screenshot ${name} skipped: ${e.message.split('\n')[0]})`));
  };
  const tapAt = async (x, y) => {
    if (touch) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
  };
  const go = async (hash, screen) => {
    await page.evaluate((hh) => { location.hash = hh; }, hash);
    await page.waitForFunction((s) => document.querySelector('#app')?.dataset.screen === s && !document.documentElement.dataset.tx, screen, { timeout: 30000 }).catch(() => null);
    await page.waitForTimeout(300);
  };
  const noPill = async () => {
    await page.evaluate(() => document.querySelectorAll('.jn-toast').forEach((e) => e.remove()));
  };
  /** Clear a stage the way a battle result does: the store commit that runs the Journal check. */
  const clearStage = (id) => page.evaluate(([sid, stg]) => {
    const { store } = window.__sakura;
    store.profile.progress.stages[sid] = { ...stg };
    store.commit('battle-result');
  }, [id, stage]);
  // (then its 260 ms way in, so it is fully drawn)
  const waitPill = (lesson) => page.waitForSelector(`.jn-toast:not(.out)${lesson ? `[data-lessons*="${lesson}"]` : ''}`, { state: 'attached', timeout: 20000 })
    .then(() => page.waitForTimeout(320)).then(() => true, () => false);
  const hash = () => page.evaluate(() => location.hash);

  // boot on a fresh profile built by the app itself, then 1-1 cleared (its lessons unlock and toast now)
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.__sakura?.store?.profile && document.querySelector('#app')?.dataset.screen === 'lobby', null, { timeout: 90000 }).catch(() => null);
  // every story scene counts as seen, so a clear queues no after-scene that would cover the screen
  await page.evaluate(async () => {
    const { SCENE_LIST } = await import('/src/data/story/index.js');
    const { store } = window.__sakura;
    store.profile.story.seen = [...new Set([...(store.profile.story.seen || []), ...SCENE_LIST.map((sc) => sc.id)])];
    store.commit('story');
    // and the modules the checks open, loaded now so opening them later is quick
    await Promise.all(['/src/ui/lobby/notice.js', '/src/ui/unitSheet.js', '/src/ui/sheet.js', '/src/ui/lobby/mailbox.js', '/src/ui/lobby/menuSheet.js', '/src/ui/components.js', '/src/ui/story/toast.js'].map((m) => import(m)));
  });
  await clearStage('1-1');
  await go('#/lobby', 'lobby');
  // the load-time lessons' pill (and any welcome modal): out of the way before the checks
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
  await noPill();

  // ------------------------------------------------------------------ 1. home + the Notice
  await clearStage('1-2');
  check(await waitPill('formation'), 'home: clearing 1-2 unlocks a lesson and Hikari\'s pill shows');
  const p0 = await pillState(page);
  if (!p0.there) throw new Error(`no pill at ${vp}: nothing to check`);
  check(p0.there && p0.visible && p0.onTop, `home: the pill is up and on top before any overlay (${JSON.stringify({ visible: p0.visible, onTop: p0.onTop })})`);
  const shownAt = Date.now();
  await page.evaluate(async () => (await import('/src/ui/lobby/notice.js')).showNoticeModal());
  await page.waitForSelector('.modal-overlay:not(.closing) .lb-notice-modal', { timeout: 8000 }).catch(() => null);
  await page.waitForTimeout(300); // the modal's way in
  const p1 = await pillState(page);
  const under = await page.evaluate(([x, y]) => {
    const els = document.elementsFromPoint(x, y);
    const top = els[0];
    const modalHit = els.find((e) => e.closest('.modal'));
    return { top: top ? `${top.tagName.toLowerCase()}.${[...top.classList].join('.')}` : null, inOverlay: !!top?.closest('.modal-overlay'), modal: modalHit ? `${modalHit.tagName.toLowerCase()}.${[...modalHit.classList].join('.')}` : null };
  }, [p0.x, p0.y]);
  // the tap first, while the pill is surely still due (it lives 4 s; a loaded machine is slow)
  const alive = await page.evaluate(() => !!document.querySelector('.jn-toast:not(.out)'));
  const h0 = await hash();
  await tapAt(p0.x, p0.y);
  await page.waitForTimeout(700);
  const h1 = await hash();
  log(`       (where the pill sits: ${under.modal || 'the Notice backdrop'}; topmost: ${under.top}; pill still due at the tap: ${alive}, ${Date.now() - shownAt} ms after the Notice opened)`);
  check(alive, 'home + Notice: the pill was still due when the tap came (otherwise this run proves nothing)');
  check(!h1.startsWith('#/journal'), `home + Notice: a tap where the pill sits does not open the Journal (${h0} → ${h1})`);
  check(p1.there && !p1.visible && p1.pe === 'none', `home + Notice: the pill is hidden and takes no taps while the Notice is open (${JSON.stringify({ visible: p1.visible, pe: p1.pe })})`);
  check(under.inOverlay, `home + Notice: the topmost thing where the pill sits is the Notice (${under.top})`);
  // (where the pill sits outside the Notice, as at 1280x720, the tap lands on its backdrop and closes it: the modal
  // took the tap, as it should)
  const noticeUp = () => page.evaluate(() => !!document.querySelector('.modal-overlay:not(.closing) .lb-notice-modal'));
  if (!h1.startsWith('#/journal')) check((await noticeUp()) || !under.modal, 'home + Notice: the tap went to the Notice (still open, or closed by its backdrop)');
  if (h1.startsWith('#/journal')) {
    // (the bug: the Journal opened, the Notice left under it) the same picture again for the screenshot
    await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
    await go('#/lobby', 'lobby');
    await noPill();
    await page.evaluate(async () => {
      (await import('/src/ui/story/toast.js')).showJournalToast({ ids: ['formation'] });
      (await import('/src/ui/lobby/notice.js')).showNoticeModal();
    });
    await page.waitForTimeout(400);
  } else if (!(await noticeUp())) {
    await page.evaluate(async () => (await import('/src/ui/lobby/notice.js')).showNoticeModal());
    await page.waitForTimeout(400);
  }
  // a components toast meanwhile: at its own top, no room kept for a hidden pill
  const hostTop = await page.evaluate(async () => {
    (await import('/src/ui/components.js')).toast('Check', 'info', 1500);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const host = document.querySelector('.toast-host');
    return { top: host ? parseFloat(getComputedStyle(host).top) : null, pill: !!document.querySelector('.jn-toast:not(.out)') };
  });
  check(hostTop.top != null && hostTop.top < 100, `home + Notice: a toast sits at its usual top, no gap for the pill (top ${hostTop.top} px, pill due: ${hostTop.pill})`);
  await shot('notice-open');
  // held longer than the pill's own 4 s: it must still be due once the Notice closes
  const stillOpen = await page.evaluate(() => !!document.querySelector('.modal-overlay:not(.closing) .lb-notice-modal'));
  if (stillOpen) {
    await page.waitForTimeout(4600);
    await page.evaluate(() => document.querySelector('.modal-overlay:not(.closing) [data-testid="notice-close"]')?.click());
  } else {
    await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
  }
  await page.waitForTimeout(450);
  const p2 = await pillState(page);
  check(p2.there && p2.visible && p2.onTop && p2.pe !== 'none', `home: once the Notice closes (after 4.6 s) the pill shows again and takes taps (${JSON.stringify({ there: p2.there, visible: p2.visible, onTop: p2.onTop })})`);
  if (p2.there && p2.visible) {
    await tapAt(p2.x, p2.y);
    await page.waitForFunction(() => location.hash.startsWith('#/journal'), null, { timeout: 8000 }).catch(() => null);
    const hj = await hash();
    check(/^#\/journal(\/|\?id=)formation/.test(hj), `home: a tap on the pill then opens the Journal on the new lesson (${hj})`);
  }
  check(await page.evaluate(() => !!window.__sakura.store.profile.story.lessons.formation), 'home: the 1-2 lesson stays unlocked');

  // ------------------------------------------------------------------ 2. Students + the unit-info sheet
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
  await go('#/students', 'students');
  await noPill();
  await clearStage('1-3');
  check(await waitPill('recruit'), 'students: clearing 1-3 shows the pill');
  const q0 = await pillState(page);
  if (!q0.there) {
    const dump = await page.evaluate(() => ({ hash: location.hash, tx: document.documentElement.dataset.tx || null, body: [...document.body.children].map((e) => `${e.tagName.toLowerCase()}.${String(e.getAttribute('class') || '').split(' ').join('.')}${e.hidden ? '[hidden]' : ''}${e.querySelector('.modal-title') ? `(${e.querySelector('.modal-title').textContent})` : ''}`), lessons: Object.keys(window.__sakura.store.profile.story.lessons), queue: window.__sakura.store.profile.story.queue }));
    throw new Error(`no pill on Students at ${vp}: ${JSON.stringify(dump)}`);
  }
  await page.evaluate(async () => (await import('/src/ui/unitSheet.js')).openUnitSheet('aoi'));
  await page.waitForSelector('.us-overlay:not(.closing)', { timeout: 8000 }).catch(() => null);
  await page.waitForTimeout(350);
  const q1 = await pillState(page);
  const under2 = await page.evaluate(([x, y]) => {
    const top = document.elementFromPoint(x, y);
    return { top: top ? `${top.tagName.toLowerCase()}.${[...top.classList].join('.')}` : null, inSheet: !!top?.closest('.us-overlay') };
  }, [q0.x, q0.y]);
  check(q1.there && !q1.visible && q1.pe === 'none', `students + unit sheet: the pill is hidden and takes no taps (${JSON.stringify({ visible: q1.visible, pe: q1.pe })})`);
  check(under2.inSheet, `students + unit sheet: the topmost thing where the pill sits is the sheet (${under2.top})`);
  const hs0 = await hash();
  await tapAt(q0.x, q0.y);
  await page.waitForTimeout(700);
  const hs1 = await hash();
  check(!hs1.startsWith('#/journal'), `students + unit sheet: a tap where the pill sits does not open the Journal (${hs0} → ${hs1})`);
  if (!hs1.startsWith('#/journal')) await shot('unit-sheet-open');
  await page.evaluate(async () => (await import('/src/ui/unitSheet.js')).closeUnitSheet());
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
  if (!(await hash()).startsWith('#/students')) await go('#/students', 'students');

  // ------------------------------------------------------------------ 3. more real overlays, each held and let go
  const showPill = () => page.evaluate(async () => {
    (await import('/src/ui/story/toast.js')).showJournalToast({ ids: ['home'] });
  });
  const realOverlays = [
    { name: 'the sheet kit (.ui-layer)', screen: ['#/students', 'students'],
      open: async () => (await import('/src/ui/sheet.js')).openSheet({ title: 'Sheet', body: document.createTextNode('Body') }),
      close: async () => (await import('/src/ui/sheet.js')).closeSheets() },
    { name: 'the beta gift modal', screen: ['#/lobby', 'lobby'],
      open: async () => (await import('/src/ui/lobby/mailbox.js')).showBetaGiftModal({ title: 'Thank you!', body: 'A gift.', rewards: [{ id: 'gems', count: 3000 }] }),
      close: async () => document.querySelector('.modal-overlay:not(.closing) [data-testid="beta-gift-later"]')?.click() },
    { name: 'the home Menu sheet', screen: ['#/lobby', 'lobby'],
      open: async () => document.querySelector('[data-testid="top-menu"]')?.click(),
      close: async () => document.querySelector('[data-testid="menu-sheet-close"]')?.click() },
  ];
  for (const o of realOverlays) {
    if (!(await hash()).startsWith(o.screen[0])) await go(...o.screen);
    await noPill();
    await showPill();
    await page.evaluate(`(${o.open.toString()})()`);
    await page.waitForTimeout(400);
    const a = await pillState(page);
    check(a.there && !a.visible && a.pe === 'none', `${o.name}: the pill is hidden while it is open (${JSON.stringify({ there: a.there, visible: a.visible, pe: a.pe })})`);
    await page.evaluate(`(${o.close.toString()})()`);
    await page.waitForTimeout(450);
    const b = await pillState(page);
    check(b.there && b.visible && b.pe !== 'none', `${o.name}: closed, the pill is back (${JSON.stringify({ there: b.there, visible: b.visible })})`);
  }

  // ------------------------------------------------------------------ 4. every other layer over the page
  const layers = [
    ['the recruit reveal', 'div', 'ma-gacha'], ['the bestiary sheet', 'div', 'mb-sheet-overlay'], ['the chat drawer', 'div', 'ol-drawer-overlay'],
    ['the sticker picker', 'div', 'stk-pick-overlay'], ['a story scene over the screen', 'div', 'sp sp-overlay'], ['the special fanfare', 'div', 'ach-fanfare'],
    ['the rotate reminder', 'div', 'rotate-overlay'], ['a profile preview', 'div', 'pf-preview ui-layer'], ['a modal', 'div', 'modal-overlay'],
  ];
  await go('#/students', 'students');
  await noPill();
  await showPill();
  for (const [name, tagName, cls] of layers) {
    const r = await page.evaluate(async ([t, c]) => {
      const el = document.createElement(t);
      el.className = c;
      el.dataset.jpProbe = '1';
      el.style.cssText = 'position:fixed;inset:0;opacity:0';
      document.body.append(el);
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      const pill = document.querySelector('.jn-toast');
      const cs = pill ? getComputedStyle(pill) : null;
      const held = cs ? { vis: cs.visibility, pe: cs.pointerEvents } : null;
      el.remove();
      return held;
    }, [tagName, cls]);
    check(r && r.vis === 'hidden' && r.pe === 'none', `${name} (.${cls.split(' ').join('.')}) hides the pill (${JSON.stringify(r)})`);
  }
  // closing layers let taps through at once, so the pill may show while they fade
  await noPill();
  await showPill();
  for (const cls of ['modal-overlay closing', 'ui-layer closing', 'home-menu-layer closing']) {
    const r = await page.evaluate(async (c) => {
      const el = document.createElement('div');
      el.className = c;
      el.style.cssText = 'position:fixed;inset:0;opacity:0;pointer-events:none';
      document.body.append(el);
      await new Promise((res) => setTimeout(res, 450));
      const cs = getComputedStyle(document.querySelector('.jn-toast'));
      const out = { vis: cs.visibility, pe: cs.pointerEvents };
      el.remove();
      return out;
    }, cls);
    check(r.vis === 'visible' && r.pe !== 'none', `a closing layer (.${cls.split(' ').join('.')}) does not hide the pill (${JSON.stringify(r)})`);
  }

  check(!errors.length, `no errors${errors.length ? `\n       ${errors.slice(0, 5).join('\n       ')}` : ''}`);
  await context.close();
}

try {
  for (const vp of viewports) await runViewport(vp);
} finally {
  await browser.close();
  await server?.close();
}
log(`\n${failures.length ? `${failures.length} FAILED` : 'all passed'}`);
process.exit(failures.length ? 1 : 0);

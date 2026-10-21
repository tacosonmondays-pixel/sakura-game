// End-to-end checks for owner request #152 (unit info): holding a girl's card on the menu
// screens opens her info sheet without firing the card's tap action; Self / Allies / Enemies /
// Coins chips everywhere; the in-battle Upgrade Tree (hold a bar card, hold a placed girl, the
// Tree button) with its states, solo pause, peek-then-drag, "Upgrade in panel ›"; and, in co-op,
// that the tree pauses nothing and the lockstep hashes stay equal.
//
//   node e2e/unit-info.mjs                                   # 1280×720 (mouse) + 844×390 (touch) + co-op
//   node e2e/unit-info.mjs --viewport 844x390 --shots /tmp/unit-info
//   node e2e/unit-info.mjs --no-coop                         # skip the two-player section
//   node e2e/unit-info.mjs --coop-only                       # only the two-player section
//   node e2e/unit-info.mjs --portrait-only                   # only the 390×844 smoke pass (--no-portrait skips it)
//
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1
// when a check fails.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const only = args.includes('--coop-only') || args.includes('--portrait-only');
const viewports = only ? [] : opt('viewport', null) ? [opt('viewport')] : ['1280x720', '844x390'];
const withPortrait = !args.includes('--coop-only') && !args.includes('--no-portrait') && !opt('viewport', null);
const shotsDir = opt('shots', null);
const withCoop = !args.includes('--no-coop');
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

const IGNORE = [
  /GPU stall due to ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i, /favicon\.ico/i,
  /Failed to load resource: net::ERR_(CERT_AUTHORITY_INVALID|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|PROXY_CONNECTION_FAILED|TUNNEL_CONNECTION_FAILED|CONNECTION_REFUSED)/i,
];

const failures = [];
const log = (...a) => console.log(...a);
/**
 * A page error with where it came from: its message and the top of its stack (src file:line), so a rare one
 * (a co-op run under load once hit "Cannot read properties of undefined (reading 'sim')") names its source.
 */
const where = (e) => {
  const at = String(e?.stack || '').split('\n').filter((l) => /^\s*at /.test(l)).slice(0, 4).map((l) => l.trim().replace(/https?:\/\/[^/]+\//, '')).join(' ← ');
  return at ? `${e.message} (${at})` : e.message;
};
function check(cond, msg) {
  log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
}

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const base = `http://127.0.0.1:${port}/`;
const { browser, label } = await launchChromium();
log(`browser: ${label}`);

const ALL_GIRLS = ['hikari', 'aoi', 'rei', 'luna', 'nami', 'yuki', 'momo', 'akane', 'sango', 'kage', 'umeko', 'shiro', 'midori', 'suzu', 'raika', 'miko', 'hotaru', 'kaede', 'chika'];
const SQUAD = ['aoi', 'rei', 'yuki', 'momo', 'akane', 'sango', 'kage', 'chika'];

/** Gives the fresh save every girl (Hikari at Lv.60 ★5, like the owner's screenshot) and a full squad. */
async function seed(page, { quality = 'medium' } = {}) {
  await page.evaluate(([girls, squad, q]) => {
    const { store } = window.__sakura;
    const p = store.profile;
    for (const id of girls) {
      p.units[id] ||= { level: 1, exp: 0, breakthrough: 0, awaken: 0, gear: { charm: null, ribbon: null, shoes: null }, obtainedAt: Date.now(), favorite: false };
    }
    Object.assign(p.units.hikari, { level: 60, breakthrough: 5, awaken: 5 });
    p.formation = { hero: 'hikari', towers: [...squad] };
    p.currencies.gems = Math.max(p.currencies.gems || 0, 60000);
    Object.assign(p.settings, { quality: q, autoStart: false });
    store.commit('e2e');
    store.saveNow?.();
  }, [ALL_GIRLS, SQUAD, quality]);
}

async function runViewport(vp) {
  const [W, H] = vp.split('x').map(Number);
  const touch = Math.min(W, H) < 600;
  log(`\n=== viewport ${vp} (${touch ? 'touch' : 'mouse'}) ===`);
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (!IGNORE.some((re) => re.test(t))) errors.push(`[console] ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${where(e)}`));
  const takeErrors = () => errors.splice(0);
  const noErrors = (what) => {
    const errs = takeErrors();
    check(!errs.length, `${what}: no page/console errors${errs.length ? `\n       ${errs.slice(0, 5).join('\n       ')}` : ''}`);
  };
  const shot = async (name) => {
    if (!shotsDir) return;
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 200))))).catch(() => {});
    await page.screenshot({ path: `${shotsDir}/${name}-${vp}.png` }).catch((e) => log(`  (screenshot ${name} skipped: ${e.message.split('\n')[0]})`));
  };
  const go = async (hash, wait = 900) => {
    await page.evaluate((h) => { location.hash = h; }, hash);
    await page.waitForTimeout(wait);
  };
  const cdp = touch ? await context.newCDPSession(page) : null;
  const touchEvent = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const center = async (sel) => {
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded().catch(() => {});
    const b = await el.boundingBox();
    return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null;
  };
  /** Press, wait, release (touch on phones, mouse on desktop). */
  const holdAt = async ({ x, y }, ms = 700) => {
    if (touch) {
      await touchEvent('touchStart', x, y);
      await page.waitForTimeout(ms);
      await touchEvent('touchEnd');
    } else {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.waitForTimeout(ms);
      await page.mouse.up();
    }
  };
  const tapAt = async ({ x, y }) => {
    if (touch) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
  };
  const sheetOpen = () => page.waitForSelector('[data-testid="unit-sheet"]', { timeout: 10000 }).then(() => true).catch(() => false);
  const sheetGone = () => page.waitForSelector('[data-testid="unit-sheet"]', { state: 'detached', timeout: 4000 }).then(() => true).catch(() => false);
  const closeSheet = async () => {
    await page.click('[data-testid="unit-sheet-close"]', { timeout: 4000 }).catch(() => {});
    return sheetGone();
  };
  const formation = () => page.evaluate(() => JSON.stringify(window.__sakura.store.profile.formation));

  // ---- boot straight into a menu screen (no title), fresh save + every girl ----------------
  await page.goto(`${base}?onboarding=0#/formation`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura && document.querySelector('#app')?.children.length > 0, null, { timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura && document.documentElement.dataset.holdInfo === 'on', null, { timeout: 30000 });
  await seed(page, { quality: 'low' });
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
  await go('#/students');
  await go('#/formation', 1200);
  takeErrors();

  // ---- 1. formation squad slot: hold → sheet, she stays; a quick tap still removes her -------
  const f0 = await formation();
  const slotSel = '.mb-tower-slots .mb-fslot.filled[data-unit]';
  const slotId = await page.getAttribute(slotSel, 'data-unit').catch(() => null);
  if (check(!!slotId, `formation: a filled squad slot (${slotId})`)) {
    const at = await center(slotSel);
    // the fill ring shows while holding
    if (touch) await touchEvent('touchStart', at.x, at.y);
    else {
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
    }
    await page.waitForTimeout(300);
    const ring = await page.evaluate(() => !!document.querySelector('.hold-ring.run') && !!document.querySelector('.hold-active'));
    check(ring, 'formation: holding shows the pink fill ring on the card');
    await page.waitForTimeout(400);
    if (touch) await touchEvent('touchEnd');
    else await page.mouse.up();
    const open = await sheetOpen();
    check(open, 'formation: holding a squad slot opens her info sheet');
    const name = await page.evaluate(() => document.querySelector('[data-testid="unit-sheet"] .gp-name')?.textContent || '');
    const unitName = await page.evaluate((id) => document.querySelector(`[data-unit="${id}"]`)?.closest('[title]')?.title || '', slotId);
    check(open && unitName.includes(name) && !!name, `formation: the sheet is hers (${name})`);
    await page.waitForTimeout(900); // a click arriving late must still be swallowed
    check((await formation()) === f0, 'formation: holding did NOT remove her from the squad');
    check(await page.isVisible('[data-testid="unit-sheet-open-page"]'), 'formation: the sheet offers "Full page"');
    await page.waitForSelector('[data-testid="unit-sheet"] [data-testid="unit-sheet-strip"]', { timeout: 8000 }).catch(() => null);
    await shot('sheet-formation');
    check(await closeSheet(), 'formation: ✕ closes the sheet');
    await tapAt(await center(slotSel));
    await page.waitForTimeout(500);
    const after = JSON.parse(await formation());
    check(!after.towers.includes(slotId), 'formation: a quick tap on the slot still removes her (tap unchanged)');
    await page.evaluate((f) => { const { store } = window.__sakura; store.profile.formation = JSON.parse(f); store.commit('e2e'); }, f0);
    await go('#/students', 600);
    await go('#/formation', 900);
    // picture of the ring two thirds full (a real hold fires before a slow screenshot is taken)
    if (shotsDir) {
      await page.evaluate(async (sel) => {
        const m = await import('/src/ui/hold.js');
        m.showHoldRing(document.querySelector(sel), 1000);
        const fill = document.querySelector('.hold-ring-fill');
        fill.style.animation = 'none';
        fill.style.strokeDashoffset = '33';
      }, '.mb-tower-slots .mb-fslot.filled[data-unit]');
      await shot('hold-ring-formation');
      await page.evaluate(async () => (await import('/src/ui/hold.js')).hideHoldRing());
    }
  }
  noErrors('formation slot');

  // ---- 2. formation picker: hold → sheet, no toggle; right-click on desktop ------------------
  const pickSel = '.mb-pick-grid .unit-card[data-unit]';
  if (check(await page.isVisible(pickSel).catch(() => false), 'formation: picker cards shown')) {
    const f1 = await formation();
    await holdAt(await center(pickSel));
    check(await sheetOpen(), 'formation picker: holding a card opens her sheet');
    await page.waitForTimeout(800);
    check((await formation()) === f1, 'formation picker: holding did NOT toggle her');
    check(await closeSheet(), 'formation picker: ✕ closes the sheet');
    if (!touch) {
      await page.evaluate(() => {
        window.__ctxPrevented = null;
        window.addEventListener('contextmenu', (e) => { window.__ctxPrevented = { dp: e.defaultPrevented, target: String(e.target.className?.baseVal ?? e.target.className), sheet: !!document.querySelector('[data-testid="unit-sheet"]') }; }, { once: true });
      });
      const at = await center(pickSel);
      await page.mouse.click(at.x, at.y, { button: 'right' });
      check(await sheetOpen(), 'formation picker: right-click opens her sheet');
      await page.waitForFunction(() => window.__ctxPrevented != null, null, { timeout: 3000 }).catch(() => null);
      const ctxInfo = await page.evaluate(() => window.__ctxPrevented);
      check(ctxInfo?.dp === true, `formation picker: right-click shows no browser menu (contextmenu prevented) (${JSON.stringify(ctxInfo)})`);
      check((await formation()) === f1, 'formation picker: right-click did not toggle her');
      await closeSheet();
    }
  }
  noErrors('formation picker');

  // ---- 3. sheet content: the Glance sheet (UI_DIRECTION.md §6.2) + the Tree tab + full page ----
  const heroSel = '.mb-hero-slot [data-unit="hikari"]';
  if (check(await page.isVisible(heroSel).catch(() => false), 'formation: Hikari in the hero slot')) {
    await holdAt(await center(heroSel));
    if (check(await sheetOpen(), 'hero slot: holding opens Hikari\'s sheet')) {
      const glance = await page.waitForSelector('[data-testid="unit-sheet"] [data-testid="unit-sheet-strip"]', { timeout: 10000 }).then(() => true).catch(() => false);
      const g = await page.evaluate(() => {
        const s = document.querySelector('[data-testid="unit-sheet"]');
        return {
          cells: [...s.querySelectorAll('[data-testid="unit-sheet-strip"] .ui-cell .lbl')].map((e) => e.textContent),
          more: !!s.querySelector('[data-testid="unit-sheet-more"]'),
          slots: s.querySelectorAll('[data-testid^="unit-sheet-slot-"]').length,
          ult: s.querySelector('.gs-ult')?.textContent || '',
          plate: s.querySelector('[data-testid="girl-plate"]')?.innerText || '',
          oldInfo: !!s.querySelector('.mb-eff-row, .mb-role'),
        };
      });
      check(glance && g.cells.join('|') === 'DMG|RATE|ULT' && g.more, `sheet Info (Glance): her hero headline stats DMG · RATE · ULT + MORE (${g.cells.join('|')})`);
      check(g.slots === 3 && /Celestial Bloom/.test(g.ult) && !/\d/.test(g.ult) && !g.oldInfo, `sheet Info (Glance): 3 gear slots and her ult line, not the whole Info tab (${JSON.stringify({ slots: g.slots, ult: g.ult, oldInfo: g.oldInfo })})`);
      check(/LV\s*60\/60/.test(g.plate), `sheet plate: her level (LV 60/60) on the plate, not in a header (${g.plate.replace(/\n/g, ' ')})`);
      check(await page.evaluate(() => !!document.querySelector('[data-testid="unit-sheet"] [data-testid="rarity-tag"].is-ur .ur-ring') && !!document.querySelector('[data-testid="unit-sheet"] .us-art.is-ur .ur-ring')), 'sheet: Hikari at ★5 shows as UR (rainbow tag and frame)');
      await shot('sheet-hikari-info');
      // MORE: the Base stats Details sheet opens over it (the second layer), Escape closes only it
      await page.click('[data-testid="unit-sheet-more"]');
      const details = await page.waitForSelector('[data-testid="stats-sheet"] .mb-stats', { timeout: 8000 }).then(() => true).catch(() => false);
      check(details && await page.isVisible('[data-testid="stats-sheet"] .mb-eff-row'), 'sheet MORE: the Base stats sheet (stat table, type table)');
      await shot('sheet-hikari-more');
      await page.keyboard.press('Escape');
      await page.waitForSelector('[data-testid="stats-sheet"]', { state: 'detached', timeout: 4000 }).catch(() => null);
      check(!(await page.$('[data-testid="stats-sheet"]')) && !!(await page.$('[data-testid="unit-sheet"]')), 'sheet MORE: Escape closes the Details sheet only');
      // a hero has no upgrade paths since the hero rework: her Tree tab is the track band (LV 1 ±2) and the ult
      await page.click('[data-testid="unit-sheet-tab-upgrades"]');
      await page.waitForSelector('[data-testid="unit-sheet"] [data-testid="hero-track-band"]', { timeout: 5000 }).catch(() => null);
      const track = await page.evaluate(() => {
        const s = document.querySelector('[data-testid="unit-sheet"]');
        return { rows: s.querySelectorAll('[data-testid="hero-track-band"] .gp-hl').length, ult: !!s.querySelector('[data-testid="hero-ult"]'), cells: s.querySelectorAll('[data-testid^="ut-cell-"]').length };
      });
      check(track.rows === 3 && track.ult && track.cells === 0, `sheet Tree (hero): the band LV 1–3 and her ult, no tier grid (${JSON.stringify(track)})`);
      await page.click('[data-testid="unit-sheet"] [data-testid="hero-track-full"]');
      const full = await page.waitForSelector('[data-testid="hero-track-sheet"] [data-testid="hero-track-list"] li', { timeout: 5000 }).then(() => page.locator('[data-testid="hero-track-sheet"] [data-testid="hero-track-list"] li').count()).catch(() => 0);
      check(full === 25, `sheet Tree (hero): "Full track" lists all 25 battle levels (${full})`);
      await page.keyboard.press('Escape');
      await page.waitForSelector('[data-testid="hero-track-sheet"]', { state: 'detached', timeout: 4000 }).catch(() => null);
      await shot('sheet-hikari-upgrades');
      await page.click('[data-testid="unit-sheet-open-page"]');
      await page.waitForTimeout(1200);
      check(await page.evaluate(() => location.hash) === '#/student/hikari?tab=tree', `sheet: "Full page" opens her student page on the Tree tab (${await page.evaluate(() => location.hash)})`);
      check(await sheetGone(), 'sheet: closes when the full page opens');
      await page.waitForSelector('[data-testid="hero-track-full"]', { timeout: 6000 }).catch(() => null);
      await page.click('[data-testid="hero-track-full"]').catch(() => {});
      await page.waitForSelector('[data-testid="hero-track-list"] li', { timeout: 6000 }).catch(() => null);
      const heroLevels = await page.locator('[data-testid="hero-track-list"] li').count();
      check(heroLevels === 25, `student Tree tab (hero): "Full track" shows her battle levels 1–25 (${heroLevels})`);
      await shot('student-tree-hero');
      await page.keyboard.press('Escape');
    }
  }
  noErrors('sheet');

  // ---- 3b. a girl with paths (Miko): the shared grid, one tag per path, a tier's panel, full page --
  await page.evaluate(async () => (await import('/src/ui/unitSheet.js')).openUnitSheet('miko'));
  if (check(await sheetOpen(), 'sheet: Miko\'s sheet opens')) {
    await page.click('[data-testid="unit-sheet-tab-upgrades"]');
    await page.waitForSelector('[data-testid="unit-sheet"] [data-testid="ut-cell-0-1"]', { timeout: 5000 }).catch(() => null);
    const grid = await page.evaluate(() => {
      const s = document.querySelector('[data-testid="unit-sheet"]');
      return { cells: s.querySelectorAll('[data-testid^="ut-cell-"]').length, tags: [...s.querySelectorAll('.ug-head .ug-tag')].map((t) => t.textContent.trim()), cellChips: s.querySelectorAll('.ug-cell .tag-chip, .ug-cell .ui-chip').length, prices: s.querySelectorAll('.ug-price:not([hidden])').length };
    });
    check(grid.cells === 15 && grid.tags.length === 3 && grid.cellChips === 0 && grid.prices === 0, `sheet Tree: 15 tier icons, one tag per path (${grid.tags.join(', ')}), no per-cell chips, no prices (${JSON.stringify(grid)})`);
    await page.click('[data-testid="unit-sheet"] [data-testid="ut-cell-0-1"]');
    const detail = await page.waitForSelector('[data-testid="unit-sheet"] [data-testid="ut-detail"]', { timeout: 4000 }).then((e) => e.innerText()).catch(() => '');
    check(/Prayer Beads/.test(detail) && /Allies \+5% dmg/.test(detail) && /Tier 1/i.test(detail), `sheet Tree: tapping Blessing T1 shows its name, "Tier 1 · Blessing" and its effect chip (${detail.replace(/\n/g, ' ')})`);
    await page.waitForTimeout(500);
    await shot('sheet-miko-upgrades');
    await page.click('[data-testid="unit-sheet-open-page"]');
    await page.waitForTimeout(1200);
    check(await page.evaluate(() => location.hash) === '#/student/miko?tab=tree', `sheet: "Full page" opens her student page on the Tree tab (${await page.evaluate(() => location.hash)})`);
    check(await sheetGone(), 'sheet: closes when the full page opens (Miko)');
    // the student page Tree tab: the same grid, without prices, nothing sideways
    await page.waitForSelector('.gp-tree [data-testid="ut-cell-0-1"]', { timeout: 6000 }).catch(() => null);
    const tree = await page.evaluate(() => {
      const t = document.querySelector('.gp-tree');
      const host = document.querySelector('.gp-host');
      return { cells: t?.querySelectorAll('.ug-cell').length || 0, tags: t?.querySelectorAll('.ug-head .ug-tag').length || 0, cellChips: t?.querySelectorAll('.ug-cell .tag-chip').length || 0, rule: t?.querySelector('.gp-rule')?.textContent || '', sideways: host ? host.scrollWidth > host.clientWidth + 1 : true };
    });
    check(tree.cells === 15 && tree.tags === 3 && tree.cellChips === 0 && !tree.sideways, `student Tree tab: 15 tier icons, 3 path tags, no per-cell chips, no sideways scroll (${JSON.stringify(tree)})`);
    check(/One path to tier 5, a second to tier 2/.test(tree.rule), `student Tree tab: the one rule line (${tree.rule})`);
    await page.click('[data-testid="tree-rule-i"]');
    const legend = await page.waitForSelector('[data-testid="tree-rule-sheet"] .gp-legend li', { timeout: 4000 }).then(() => page.locator('[data-testid="tree-rule-sheet"] .gp-legend li').count()).catch(() => 0);
    check(legend === 4, `student Tree tab: "i" opens the full rule and the Self / Allies / Enemies / Coins legend (${legend})`);
    await page.keyboard.press('Escape');
    await shot('student-tree-chips');
  }
  noErrors('sheet (Miko)');

  // ---- 4. students list: scroll ≠ hold; hold → sheet; tap → student page ---------------------
  await go('#/students', 1200);
  const cardSel = '#app .unit-card[data-unit]';
  if (check(await page.isVisible(cardSel).catch(() => false), 'students: cards shown')) {
    if (touch) {
      const scroller = await page.evaluate(() => {
        let el = document.querySelector('#app .unit-card');
        while (el && el.scrollHeight <= el.clientHeight + 2) el = el.parentElement;
        if (!el) return null;
        el.dataset.e2eScroller = '1';
        return el.scrollTop;
      });
      const at = await center(cardSel);
      await touchEvent('touchStart', at.x, at.y);
      for (let i = 1; i <= 6; i++) {
        await touchEvent('touchMove', at.x, at.y - 15 * i);
        await page.waitForTimeout(40);
      }
      await page.waitForTimeout(500);
      await touchEvent('touchEnd');
      await page.waitForTimeout(400);
      const scrolled = await page.evaluate(() => document.querySelector('[data-e2e-scroller]')?.scrollTop ?? -1);
      check(scroller != null && scrolled > scroller, `students: a touch scroll over a card scrolls the list (${scroller} → ${scrolled})`);
      check(!(await page.$('[data-testid="unit-sheet"]')), 'students: scrolling does not open a sheet');
      await page.evaluate(() => { const s = document.querySelector('[data-e2e-scroller]'); if (s) s.scrollTop = 0; });
      await page.waitForTimeout(300);
    } else {
      // a mouse press that moves (drag-select, scrollbar-like motion) is not a hold. The moves are
      // dispatched in the page in one go: under software GL a 1280×720 frame can take longer
      // than the hold itself, and real mouse moves are only delivered once per frame.
      const moved = await page.evaluate(async (sel) => {
        const card = document.querySelector(sel);
        const img = card.querySelector('[data-unit]') || card;
        const r = img.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const ev = (type, dx, target = img) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 77, pointerType: 'mouse', isPrimary: true, button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x + dx, clientY: y + dx * 0.13 }));
        ev('pointerdown', 0);
        for (const dx of [7.5, 15, 22.5, 30]) ev('pointermove', dx);
        await new Promise((res) => setTimeout(res, 650));
        const ring = !!document.querySelector('.hold-ring.run');
        ev('pointerup', 30);
        await new Promise((res) => setTimeout(res, 150));
        return { sheet: !!document.querySelector('[data-testid="unit-sheet"]'), ring };
      }, cardSel);
      check(!moved.sheet && !moved.ring, `students: a press that moves does not open a sheet (${JSON.stringify(moved)})`);
      // …and the same press held still does (the synthetic events reach the hold at all)
      const still = await page.evaluate(async (sel) => {
        const img = document.querySelector(sel).querySelector('[data-unit]') || document.querySelector(sel);
        const r = img.getBoundingClientRect();
        const o = { bubbles: true, cancelable: true, composed: true, pointerId: 78, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
        img.dispatchEvent(new PointerEvent('pointerdown', o));
        img.dispatchEvent(new PointerEvent('pointermove', { ...o, button: -1, clientX: o.clientX + 4 }));
        await new Promise((res) => setTimeout(res, 650));
        img.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0 }));
        return true;
      }, cardSel);
      check(still && await sheetOpen(), 'students: the same synthetic press held still (4 px wobble) opens the sheet');
      await closeSheet();
      await go('#/students', 600);
    }
    const id = await page.getAttribute(cardSel, 'data-unit');
    await holdAt(await center(cardSel));
    check(await sheetOpen(), `students: holding ${id}'s card opens her sheet`);
    check(await page.evaluate(() => location.hash) === '#/students', 'students: holding did not navigate away');
    await shot('sheet-students');
    await closeSheet();
    await tapAt(await center(cardSel));
    await page.waitForTimeout(900);
    check((await page.evaluate(() => location.hash)).startsWith(`#/student/${id}`), 'students: a quick tap still opens her student page');
  }
  noErrors('students');

  // ---- 5. stage prep swap modal: sheet above the modal; no swap -------------------------------
  let swapped = false;
  for (const sid of ['1-1', '1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '3-1', '3-2', '4-1']) {
    await go(`#/stage/${sid}`, 900);
    const add = await page.$('[data-testid^="add-"]');
    if (!add) continue;
    await add.click();
    const grid = await page.waitForSelector('.ma-swap-grid .unit-card[data-unit]', { timeout: 3000 }).catch(() => null);
    if (!grid) {
      await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
      continue;
    }
    swapped = true;
    const fs = await formation();
    await holdAt(await center('.ma-swap-grid .unit-card[data-unit]'));
    check(await sheetOpen(), `stage ${sid} swap modal: holding a card opens her sheet`);
    const above = await page.evaluate(() => {
      const r = document.querySelector('.us-sheet').getBoundingClientRect();
      return !!document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.us-sheet');
    });
    check(above, 'stage swap modal: the sheet sits above the modal');
    await shot('sheet-stage-swap');
    await closeSheet();
    await page.waitForTimeout(500);
    check((await formation()) === fs, 'stage swap modal: holding did NOT swap anyone');
    check(await page.isVisible('.ma-swap-grid'), 'stage swap modal: still open after the sheet closed');
    await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
    break;
  }
  check(swapped, 'stage prep: found a counter "Add" that opens the swap modal');
  noErrors('stage prep');

  // ---- 6. recruit: unflipped cards keep their secret; flipped ones open the sheet -------------
  await go('#/recruit', 1200);
  if (await page.$('[data-testid="pull-10"]')) {
    await page.click('[data-testid="pull-10"]');
    const confirm = await page.waitForSelector('[data-testid="confirm-pull"]', { timeout: 2000 }).catch(() => null);
    if (confirm) await confirm.click();
    await page.waitForSelector('[data-testid="reveal-letter"]', { timeout: 5000 }).catch(() => null);
    await page.click('[data-testid="reveal-letter"]', { timeout: 3000, force: true }).catch(() => {});
    // the cards are dealt face down and flip one by one: press the last one while it is still down
    const down = await page.waitForFunction(() => {
      const cards = [...document.querySelectorAll('.ma-gacha-grid .ma-gc')];
      const c = cards.length ? cards[cards.length - 1] : null;
      if (!c || c.classList.contains('flipped')) return null;
      const r = c.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, null, { timeout: 8000, polling: 'raf' }).then((hdl) => hdl.jsonValue()).catch(() => null);
    if (check(!!down, 'recruit: caught a card still face down')) {
      await holdAt(down, 600);
      await page.waitForTimeout(300);
      check(!(await page.$('[data-testid="unit-sheet"]')), 'recruit: holding a face-down card does not spoil it');
    }
    // Skip straight to the results (an SSR showcase may already cover the Skip button)
    await page.evaluate(() => document.querySelector('[data-testid="reveal-skip"]')?.click());
    await page.waitForSelector('[data-testid="reveal-close"]', { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(600);
    check(!(await page.$('.ma-showcase')), 'recruit: Skip shows the results');
    await holdAt(await center('.ma-gacha-grid .ma-gc.flipped'));
    check(await sheetOpen(), 'recruit: holding a flipped result card opens her sheet');
    await shot('sheet-recruit');
    await closeSheet();
    check(await page.isVisible('[data-testid="reveal-close"]'), 'recruit: the results stay open under the sheet');
    await page.click('[data-testid="reveal-close"]').catch(() => {});
    await page.waitForTimeout(400);
  } else check(false, 'recruit: pull button');
  noErrors('recruit');

  // ---- 7. wiki legend --------------------------------------------------------------------------
  await go('#/wiki/crosspath', 1200);
  const legendChips = await page.locator('[data-testid="tag-legend"] .tag-chip').count();
  check(legendChips >= 4, `wiki: "Who an upgrade helps" shows the chip legend (${legendChips} chips)`);
  await page.locator('[data-testid="tag-legend"]').first().scrollIntoViewIfNeeded().catch(() => {});
  await shot('wiki-legend');
  noErrors('wiki');

  // ---- battle (solo) ---------------------------------------------------------------------------
  await go('#/battle?stage=1-1&difficulty=easy', 0);
  await page.waitForFunction(() => window.__battle?.ui?.placement && window.__battle?.ui?.tree, null, { timeout: 90000 });
  await page.waitForFunction(() => {
    for (let el = window.__battle.renderer.canvas; el; el = el.parentElement) {
      if (el.getAnimations().some((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity)) return false;
    }
    return true;
  }, null, { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(600);
  // the free hero card arms itself at wave 0 (hero rework, ~0.7 s in): let it arm, then put it back,
  // so the hold checks below start with nothing in hand (as e2e/stat-display does)
  await page.waitForFunction(() => window.__battle.ui.placement?.unitId, null, { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => window.__battle.ui.placement?.cancel?.());
  const firstId = await page.evaluate(() => [...window.__battle.sim.loadout.keys()].find((id) => window.__battle.sim.data.unit(id)?.placement === 'land'));
  const cardSelB = `[data-testid="card-${firstId}"]`;

  // 9. hold a bar card → preview tree; tap-to-place did not start; solo pauses. Frames are slow
  // under software GL on a busy machine: count them, so "time did not move" is never vacuous.
  await page.evaluate(() => {
    window.__uiFrames = 0;
    const f = () => { window.__uiFrames++; requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  const framesAfter = async (n) => {
    const f0 = await page.evaluate(() => window.__uiFrames);
    await page.waitForFunction((x) => window.__uiFrames >= x, f0 + n, { timeout: 30000, polling: 100 }).catch(() => null);
  };
  await page.waitForFunction(() => window.__battle.sim.time > 0.05, null, { timeout: 30000 }).catch(() => null);
  await holdAt(await center(cardSelB), 750);
  const treeUp = await page.waitForSelector('[data-testid="upgrade-tree"]:not([hidden])', { timeout: 4000 }).then(() => true).catch(() => false);
  check(treeUp, `battle: holding ${firstId}'s bar card opens her upgrade tree`);
  const pv = await page.evaluate(() => ({ mode: window.__battle.ui.tree.model?.mode, placing: window.__battle.ui.placement.unitId, paused: window.__battle.ui.paused }));
  check(pv.mode === 'preview' && pv.placing === null, `battle: the tree is a preview and tap-to-place did not start (${JSON.stringify(pv)})`);
  const t0 = await page.evaluate(() => window.__battle.sim.time);
  await page.waitForTimeout(700);
  await framesAfter(4);
  const t1 = await page.evaluate(() => window.__battle.sim.time);
  check(pv.paused && t1 === t0, `battle (solo): the battle waits while the tree is open (time ${t0.toFixed(2)} → ${t1.toFixed(2)})`);
  check(/Paused while open/.test(await page.innerText('[data-testid="ut-pause-chip"]').catch(() => '')), 'battle (solo): header says "Paused while open"');
  await shot('tree-preview');
  await page.click('[data-testid="upgrade-tree-close"]');
  await page.waitForFunction((t) => window.__battle.sim.time > t, t1, { timeout: 30000, polling: 100 }).catch(() => null);
  const t2 = await page.evaluate(() => ({ time: window.__battle.sim.time, paused: window.__battle.ui.paused, open: window.__battle.ui.tree.isOpen }));
  check(!t2.open && !t2.paused && t2.time > t1, `battle (solo): ✕ closes the tree and the battle runs again (${JSON.stringify(t2)})`);
  noErrors('bar hold');

  // 10. peek then drag: hold the card, the tree opens; moving up closes it and drags her out
  const spot = await page.evaluate((liftPx) => {
    const { sim, renderer, ui } = window.__battle;
    const unitId = [...sim.loadout.keys()].find((id) => sim.data.unit(id)?.placement === 'land' && sim.cash >= sim.placeCost(id));
    const barTop = ui.bar.el.getBoundingClientRect().top;
    const rect = renderer.canvas.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const midY = (rect.top + Math.min(rect.bottom, barTop)) / 2;
    const roomy = (x, y) => [[0, 0], [0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]].every(([dx, dy]) => sim.canPlace(unitId, x + dx, y + dy).ok);
    let best = null;
    for (let y = 0.3; y < sim.map.height; y += 0.5) {
      for (let x = 0.3; x < sim.map.width; x += 0.5) {
        if (!roomy(x, y)) continue;
        const s = renderer.worldToScreen(x, y, 0);
        const ry = s.clientY + liftPx;
        if (!s.visible || s.clientX < 40 || s.clientX > innerWidth - 40 || s.clientY < 60 || ry > barTop - 12) continue;
        if (document.elementFromPoint(s.clientX, s.clientY) !== renderer.canvas) continue;
        const p = renderer.pick(s.clientX, s.clientY);
        if (!p.inBounds || Math.hypot(p.x - x, p.y - y) > 0.05) continue;
        const d = Math.hypot(s.clientX - midX, s.clientY - midY);
        if (!best || d < best.d) best = { x, y, rx: s.clientX, ry, d };
      }
    }
    return best && { unitId, ...best, towers: sim.towers.length };
  }, touch ? 46 : 0);
  let placedUid = null;
  if (check(!!spot, 'peek-drag: open ground on screen')) {
    const c = await center(`[data-testid="card-${spot.unitId}"]`);
    const route = [];
    for (let i = 1; i <= 4; i++) route.push([c.x, c.y - 10 * i]);
    for (let i = 1; i <= 14; i++) route.push([c.x + ((spot.rx - c.x) * i) / 14, c.y - 40 + ((spot.ry - (c.y - 40)) * i) / 14]);
    if (touch) await touchEvent('touchStart', c.x, c.y);
    else {
      await page.mouse.move(c.x, c.y);
      await page.mouse.down();
    }
    await page.waitForTimeout(750);
    const peek = await page.evaluate(() => window.__battle.ui.tree.isOpen);
    check(peek, 'peek-drag: holding still opens the tree (a peek)');
    for (const [x, y] of route) {
      if (touch) await touchEvent('touchMove', x, y);
      else await page.mouse.move(x, y);
      await page.waitForTimeout(16);
    }
    await page.waitForFunction(([x, y]) => {
      const l = window.__battle.ui.placement.last;
      return !!l && Math.hypot(l.x - x, l.y - y) < 0.15;
    }, [spot.x, spot.y], { timeout: 5000 }).catch(() => null);
    const mid = await page.evaluate(() => ({ open: window.__battle.ui.tree.isOpen, mode: window.__battle.ui.placement.mode, unitId: window.__battle.ui.placement.unitId }));
    check(!mid.open && mid.mode === 'drag' && mid.unitId === spot.unitId, `peek-drag: moving up closes the tree and drags her out (${JSON.stringify(mid)})`);
    if (touch) await touchEvent('touchEnd');
    else await page.mouse.up();
    await page.waitForTimeout(400);
    const res = await page.evaluate((id) => {
      const { sim } = window.__battle;
      const t = sim.towers.filter((tw) => tw.unitId === id).pop();
      return { towers: sim.towers.length, uid: t?.uid ?? null, at: t ? [t.x, t.y] : null };
    }, spot.unitId);
    check(res.towers === spot.towers + 1, `peek-drag: releasing places her (${JSON.stringify(res)})`);
    placedUid = res.uid;
  }
  noErrors('peek-drag');

  // 12. hold a placed girl on the map → live tree at 2-0-3
  if (placedUid != null) {
    const live = await page.evaluate((uid) => {
      const { sim, ui } = window.__battle;
      sim.cash = Math.max(sim.cash, 200000);
      for (const [p, n] of [[0, 2], [2, 3]]) for (let k = 0; k < n; k++) ui.act.upgrade(uid, p);
      const t = sim.getTower(uid);
      ui.select(null);
      sim.cash = 1; // the next tier is unaffordable: shows "need … more"
      return { tiers: t.tiers.join('-'), x: t.x, y: t.y };
    }, placedUid);
    check(live.tiers === '2-0-3', `battle: she is upgraded to 2-0-3 (${live.tiers})`);
    await page.waitForTimeout(400);
    const at = await page.evaluate(({ x, y }) => {
      const s = window.__battle.renderer.worldToScreen(x, y, 0.4);
      return { x: s.clientX, y: s.clientY };
    }, live);
    await holdAt(at, 900);
    const opened = await page.waitForFunction(() => window.__battle.ui.tree.isOpen, null, { timeout: 3000 }).then(() => true).catch(() => false);
    check(opened, 'battle: holding a placed girl on the map opens her tree');
    const st = await page.evaluate((uid) => {
      const q = (s) => document.querySelector(`[data-testid="upgrade-tree"] [data-testid="${s}"]`);
      const state = (p, t) => ['owned', 'next', 'later', 'blocked'].find((k) => q(`ut-cell-${p}-${t}`)?.classList.contains(`s-${k}`));
      const rows = [...document.querySelectorAll('[data-testid="upgrade-tree"] .ut-row')].map((r) => r.querySelector('.ut-row-head').innerText);
      return {
        mode: window.__battle.ui.tree.model?.mode,
        cells: [0, 1, 2].map((p) => [1, 2, 3, 4, 5].map((t) => (state(p, t) || '?')[0]).join('')),
        rows,
        nextCost: q('ut-cell-2-4')?.querySelector('.ut-cost')?.textContent,
        simCost: window.__battle.sim.upgradeStatus(uid, 2).cost,
        poor: q('ut-cell-2-4')?.classList.contains('poor'),
      };
    }, placedUid);
    check(st.mode === 'live', `battle tree: live mode (${st.mode})`);
    check(st.cells[0] === 'oobbb' && st.cells[1] === 'bbbbb' && st.cells[2] === 'ooonl', `battle tree: owned / next / locked states match 2-0-3 (${st.cells.join(' ')})`);
    check(/cap T2/i.test(st.rows[0]) && /two paths in use/.test(st.rows[1]), `battle tree: row 1 says "cap T2", row 2 says "two paths in use" (${st.rows.slice(0, 2).map((r) => r.replace(/\s+/g, ' ')).join(' | ')})`);
    check(Number(String(st.nextCost).replace(/\D/g, '')) === st.simCost, `battle tree: the next tier's price is the sim's price (${st.nextCost} vs ${st.simCost})`);
    check(st.poor === true, 'battle tree: an unaffordable next tier is marked');
    await shot('tree-live');
    // tap a tier → detail, then "Upgrade in panel ›"
    await page.click('[data-testid="upgrade-tree"] [data-testid="ut-cell-2-4"]');
    const detail = await page.waitForSelector('[data-testid="upgrade-tree"] [data-testid="ut-detail"]', { timeout: 3000 }).then((e) => e.innerText()).catch(() => '');
    check(/need/.test(detail) && /T4/.test(detail), 'battle tree: tapping the next tier shows its detail with "need … more"');
    await page.waitForTimeout(500);
    await shot('tree-detail');
    // tap a locked tier: the reason
    await page.click('[data-testid="upgrade-tree"] [data-testid="ut-cell-0-3"]');
    const lockText = await page.innerText('[data-testid="upgrade-tree"] [data-testid="ut-detail-status"]').catch(() => '');
    check(/Capped at T2/.test(lockText), `battle tree: a locked tier explains why (${lockText.trim()})`);
    await page.click('[data-testid="upgrade-tree"] [data-testid="ut-cell-2-4"]');
    await page.click('[data-testid="ut-goto-panel"]');
    await page.waitForTimeout(300);
    const pan = await page.evaluate((uid) => ({
      open: window.__battle.ui.tree.isOpen, sel: window.__battle.ui.selectedUid === uid, flash: !!document.querySelector('.bt-panel [data-path="2"].bt-path-flash'), paused: window.__battle.ui.paused,
    }), placedUid);
    check(!pan.open && pan.sel && pan.flash && !pan.paused, `battle: "Upgrade in panel ›" closes the tree, selects her and flashes that path (${JSON.stringify(pan)})`);
    await page.waitForTimeout(1300);
    // 14. panel: Tree button opens; Escape closes without deselecting; chips on every open path
    const chipRows = await page.evaluate(() => [...document.querySelectorAll('.bt-panel .bt-path')].filter((r) => !r.querySelector('.bt-path-max')).map((r) => r.querySelectorAll('.tag-chip').length));
    check(chipRows.length > 0 && chipRows.every((n) => n >= 1), `battle panel: every next-tier line has a Self/Allies/Enemies chip (${chipRows.join(',')})`);
    await page.evaluate(() => { window.__battle.sim.cash = 5000; });
    await page.waitForTimeout(400);
    await shot('panel-chips');
    await page.click('[data-testid="panel-tree"]');
    check(await page.waitForFunction(() => window.__battle.ui.tree.isOpen, null, { timeout: 2000 }).then(() => true).catch(() => false), 'battle panel: the Tree button opens her tree');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const esc = await page.evaluate((uid) => ({ open: window.__battle.ui.tree.isOpen, sel: window.__battle.ui.selectedUid === uid, paused: window.__battle.ui.paused, pauseMenu: !!document.querySelector('.bt-paused') }), placedUid);
    check(!esc.open && esc.sel && !esc.paused && !esc.pauseMenu, `battle: Escape closes the tree only (still selected, no pause menu) (${JSON.stringify(esc)})`);
    if (!touch) {
      await page.keyboard.press('t');
      const tOpen = await page.waitForFunction(() => window.__battle.ui.tree.isOpen, null, { timeout: 2000 }).then(() => true).catch(() => false);
      await page.keyboard.press('t');
      await page.waitForTimeout(200);
      check(tOpen && !(await page.evaluate(() => window.__battle.ui.tree.isOpen)), 'battle: T opens and closes the selected girl\'s tree');
    }
    // the portrait in her panel opens it too
    await page.click('.bt-panel .bt-panel-portrait');
    check(await page.waitForFunction(() => window.__battle.ui.tree.isOpen, null, { timeout: 2000 }).then(() => true).catch(() => false), 'battle panel: tapping her portrait opens her tree');

    // 15. layout: fits the screen, cells inside the viewport (or a reachable scroll), no overflow
    const lay = await page.evaluate(() => {
      const ov = document.querySelector('[data-testid="upgrade-tree"]');
      const wrap = ov.querySelector('.ut-grid-wrap');
      const cells = [...ov.querySelectorAll('.ut-cell')];
      const vis = cells.filter((c) => {
        const r = c.getBoundingClientRect();
        return r.left >= 0 && r.right <= innerWidth + 0.5 && r.top >= 0 && r.bottom <= innerHeight + 0.5;
      }).length;
      const overflow = cells.filter((c) => c.scrollWidth > c.clientWidth + 1).map((c) => c.dataset.testid);
      const nameOut = cells.filter((c) => {
        const cr = c.getBoundingClientRect();
        const n = c.querySelector('.ut-name').getBoundingClientRect();
        return n.right > cr.right + 1 || n.left < cr.left - 1;
      }).length;
      return { sw: ov.scrollWidth, iw: innerWidth, vis, total: cells.length, scrollable: wrap.scrollHeight > wrap.clientHeight + 1, overflow, nameOut, cellH: Math.round(cells[0].getBoundingClientRect().height), cellW: Math.round(cells[0].getBoundingClientRect().width) };
    });
    check(lay.sw <= lay.iw, `tree layout: no horizontal overflow (${lay.sw} ≤ ${lay.iw})`);
    check(lay.vis === 15 || lay.scrollable, `tree layout: all 15 tiers on screen or in a scrollable grid (${lay.vis}/15 visible, scrollable ${lay.scrollable}, cell ${lay.cellW}×${lay.cellH})`);
    check(!lay.overflow.length && !lay.nameOut, `tree layout: no text spills out of a cell (${lay.overflow.join(',') || 'none'})`);
    await shot('tree');
    await page.click('[data-testid="upgrade-tree-close"]');
    await page.waitForTimeout(300);

    // §8 perf. Opening the tree builds its DOM and forces one style + layout pass inside open()
    // (the restart of the open animation). Compared with an interaction the battle already has,
    // selecting a girl (her panel opens), on this same machine: software GL makes absolute numbers
    // from this box meaningless for a phone. Then the frame right after an open vs ordinary frames,
    // and the size of the DOM (HTML elements; the SVG icon paths inside them counted apart).
    const perf = await page.evaluate(async (uid) => {
      const { ui } = window.__battle;
      const raf = () => new Promise((r) => requestAnimationFrame(r));
      const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
      const gaps = async (n) => {
        const out = [];
        let last = await raf().then(() => performance.now());
        for (let i = 0; i < n; i++) {
          const now = await raf().then(() => performance.now());
          out.push(now - last);
          last = now;
        }
        return out;
      };
      const opens = [];
      const selects = [];
      const openGaps = [];
      const baseGaps = [];
      for (let i = 0; i < 5; i++) {
        let t0 = performance.now();
        ui.select(uid);
        document.body.offsetHeight;
        selects.push(performance.now() - t0);
        ui.select(null);
        await raf();
        baseGaps.push(...(await gaps(6)));
        t0 = performance.now();
        ui.tree.open({ uid });
        document.body.offsetHeight;
        opens.push(performance.now() - t0);
        openGaps.push(Math.max(...(await gaps(6))));
        ui.tree.close();
        await raf();
      }
      ui.tree.open({ uid });
      const ov = document.querySelector('[data-testid="upgrade-tree"]');
      const all = ov.querySelectorAll('*').length;
      const svgInner = [...ov.querySelectorAll('svg')].reduce((n, el) => n + el.querySelectorAll('*').length, 0);
      ui.tree.close();
      const sorted = [...baseGaps].sort((x, y) => x - y);
      return { open: med(opens), select: med(selects), openFrame: med(openGaps), baseFrame: med(baseGaps), baseP90: sorted[Math.floor(sorted.length * 0.9)], html: all - svgInner, svgInner };
    }, placedUid);
    log(`  perf tree open: ${perf.open.toFixed(1)} ms build + style + layout (selecting her: ${perf.select.toFixed(1)} ms); frame after open ${perf.openFrame.toFixed(1)} ms vs ordinary battle frames median ${perf.baseFrame.toFixed(1)} / p90 ${perf.baseP90.toFixed(1)} ms; ${perf.html} HTML elements + ${perf.svgInner} SVG icon nodes`);
    check(perf.open <= Math.max(32, perf.select * 1.5), `tree perf: opening costs no more than selecting a girl (${perf.open.toFixed(1)} vs ${perf.select.toFixed(1)} ms)`);
    check(perf.openFrame <= Math.max(perf.baseP90 * 2, perf.baseFrame + 50), `tree perf: no long frame on open (${perf.openFrame.toFixed(1)} ms vs ordinary p90 ${perf.baseP90.toFixed(1)} ms)`);
    check(perf.html <= 400, `tree perf: ${perf.html} HTML elements (15 cells × ~11 + rows + side panel)`);
  }
  noErrors('battle tree');

  // hero widget: place her, then hold her portrait
  const heroUp = await page.evaluate(() => {
    const { sim, ui, renderer } = window.__battle;
    if (!sim.heroConfig) return null;
    sim.cash = Math.max(sim.cash, 5000);
    const id = sim.heroConfig.unitId;
    for (let y = 0.3; y < sim.map.height; y += 0.5) {
      for (let x = 0.3; x < sim.map.width; x += 0.5) {
        if (sim.canPlace(id, x, y).ok && renderer.worldToScreen(x, y, 0).visible) {
          ui.act.place(id, x, y);
          return sim.hero?.uid ?? null;
        }
      }
    }
    return null;
  });
  if (heroUp != null) {
    await page.waitForSelector('.bt-herow-portrait', { timeout: 3000 }).catch(() => null);
    await page.waitForTimeout(400);
    await holdAt(await center('.bt-herow-portrait'), 750);
    const ho = await page.waitForFunction(() => window.__battle.ui.tree.isOpen, null, { timeout: 2000 }).then(() => true).catch(() => false);
    const hm = await page.evaluate(() => ({ mode: window.__battle.ui.tree.model?.mode, hero: !!window.__battle.ui.tree.model?.hero, sel: window.__battle.ui.selectedUid }));
    check(ho && hm.mode === 'live' && hm.hero, `battle: holding the hero portrait opens her live tree with the ult card (${JSON.stringify(hm)})`);
    check(await page.evaluate(() => !!document.querySelector('[data-testid="upgrade-tree"] .ut-card-art.is-ur .ur-ring')), 'battle tree: Hikari at ★5 has the UR rainbow frame');
    await shot('tree-hero');
    await page.click('[data-testid="ut-ult"]').catch(() => {});
    await page.waitForTimeout(300);
    await shot('tree-hero-ult');
    await page.click('[data-testid="upgrade-tree-close"]');
    await page.waitForTimeout(300);
    check(await page.evaluate((h) => window.__battle.ui.selectedUid !== h, heroUp), 'battle: the hold did not also select the hero (tap swallowed)');
  }
  noErrors('hero widget');
  await go('#/lobby', 600);
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
  await cdp?.detach().catch(() => {});
  await context.close();
}

// ---- portrait phone (390×844, touch): smoke only — the sheet and the tree fit a narrow screen ----
async function runPortrait() {
  const vp = '390x844';
  log(`\n=== portrait ${vp} (touch, smoke) ===`);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (!IGNORE.some((re) => re.test(t))) errors.push(`[console] ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${where(e)}`));
  const cdp = await context.newCDPSession(page);
  const holdAt = async ({ x, y }, ms = 750) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await page.waitForTimeout(ms);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const center = async (sel) => {
    const el = page.locator(sel).first();
    await el.scrollIntoViewIfNeeded().catch(() => {});
    const b = await el.boundingBox();
    return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null;
  };
  const shot = async (name) => {
    if (!shotsDir) return;
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 200))))).catch(() => {});
    await page.screenshot({ path: `${shotsDir}/${name}-${vp}.png` }).catch(() => {});
  };
  const noOverflow = (sel) => page.evaluate((q) => {
    const el = document.querySelector(q);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { fits: r.left >= -0.5 && r.right <= innerWidth + 0.5 && el.scrollWidth <= el.clientWidth + 1, w: Math.round(r.width), iw: innerWidth };
  }, sel);
  try {
    await page.goto(`${base}?onboarding=0#/formation`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__sakura && document.documentElement.dataset.holdInfo === 'on', null, { timeout: 30000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.__sakura && document.documentElement.dataset.holdInfo === 'on', null, { timeout: 30000 });
    await seed(page, { quality: 'low' });
    await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
    await page.evaluate(() => { location.hash = '#/students'; });
    await page.waitForTimeout(600);
    await page.evaluate(() => { location.hash = '#/formation'; });
    await page.waitForTimeout(1200);
    const slot = '.mb-tower-slots .mb-fslot.filled[data-unit]';
    if (check(!!(await page.$(slot)), 'portrait formation: a filled squad slot')) {
      const f0 = await page.evaluate(() => JSON.stringify(window.__sakura.store.profile.formation));
      await holdAt(await center(slot));
      const open = await page.waitForSelector('[data-testid="unit-sheet"]', { timeout: 10000 }).then(() => true).catch(() => false);
      check(open, 'portrait formation: holding a squad slot opens her sheet');
      await page.waitForTimeout(800);
      check(await page.evaluate(() => JSON.stringify(window.__sakura.store.profile.formation)) === f0, 'portrait formation: holding did not remove her');
      const fit = await noOverflow('.us-sheet');
      check(fit?.fits === true, `portrait sheet: fits the screen width (${JSON.stringify(fit)})`);
      await page.waitForSelector('[data-testid="unit-sheet"] [data-testid="unit-sheet-strip"]', { timeout: 8000 }).catch(() => null);
      await shot('sheet-formation');
      await page.click('[data-testid="unit-sheet-tab-upgrades"]').catch(() => {});
      await page.waitForSelector('[data-testid="unit-sheet"] [data-testid="ut-cell-0-1"]', { timeout: 5000 }).catch(() => null);
      const g = await noOverflow('[data-testid="unit-sheet"] .ug');
      check(g?.fits === true, `portrait sheet Upgrades: the 3 × 5 grid fits the width (${JSON.stringify(g)})`);
      await shot('sheet-upgrades');
      await page.click('[data-testid="unit-sheet-close"]').catch(() => {});
      await page.waitForSelector('[data-testid="unit-sheet"]', { state: 'detached', timeout: 4000 }).catch(() => null);
    }
    await page.evaluate(() => { location.hash = '#/battle?stage=1-1&difficulty=easy'; });
    await page.waitForFunction(() => window.__battle?.ui?.placement && window.__battle?.ui?.tree, null, { timeout: 90000 });
    await page.waitForTimeout(1500);
    const id = await page.evaluate(() => [...window.__battle.sim.loadout.keys()].find((u) => window.__battle.sim.data.unit(u)?.placement === 'land'));
    const at = await center(`[data-testid="card-${id}"]`);
    if (check(!!at, `portrait battle: ${id}'s bar card on screen`)) {
      await holdAt(at, 800);
      const up = await page.waitForFunction(() => window.__battle.ui.tree.isOpen, null, { timeout: 4000 }).then(() => true).catch(() => false);
      check(up, 'portrait battle: holding a bar card opens her tree');
      const t = await noOverflow('[data-testid="upgrade-tree"] .ut-sheet');
      check(t?.fits === true, `portrait battle tree: fits the screen width (${JSON.stringify(t)})`);
      await shot('tree-preview');
      await page.click('[data-testid="upgrade-tree"] [data-testid="ut-cell-1-3"]').catch(() => {});
      await page.waitForSelector('[data-testid="upgrade-tree"] [data-testid="ut-detail"]', { timeout: 3000 }).catch(() => null);
      await shot('tree-detail');
      await page.click('[data-testid="upgrade-tree-close"]').catch(() => {});
    }
    const errs = errors.splice(0);
    check(!errs.length, `portrait: no page/console errors${errs.length ? `\n       ${errs.slice(0, 5).join('\n       ')}` : ''}`);
  } finally {
    await cdp.detach().catch(() => {});
    await context.close();
  }
}

// ---- co-op: the tree pauses nothing; lobby chips open the sheet without "Open full page" -------
async function runCoop() {
  const W = 1280;
  const H = 720;
  log(`\n=== co-op (local adapter, ${W}x${H}) ===`);
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const errors = [];
  const openPage = async (name) => {
    const p = await ctx.newPage();
    p.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (!IGNORE.some((re) => re.test(t))) errors.push(`[${name} console] ${t}`);
    });
    p.on('pageerror', (e) => errors.push(`[${name} pageerror] ${where(e)}`));
    return p;
  };
  const shot = async (p, name) => {
    if (!shotsDir) return;
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 200))))).catch(() => {});
    await p.screenshot({ path: `${shotsDir}/${name}-${W}x${H}.png` }).catch(() => {});
  };
  const go = (p, h) => p.evaluate((x) => { location.hash = x; }, h);
  const setName = async (p, name) => {
    const input = await p.waitForSelector('[data-testid="name-input"]', { timeout: 20000 }).catch(() => null);
    if (!input) return;
    await p.fill('[data-testid="name-input"]', name);
    await p.click('[data-testid="name-save"]');
    await p.waitForSelector('[data-testid="name-input"]', { state: 'detached', timeout: 10000 }).catch(() => null);
  };
  const online = `${base}?online=local&onboarding=0`;
  const A = await openPage('A');
  try {
    await A.goto(`${online}#/formation`, { waitUntil: 'load' });
    await A.evaluate(() => localStorage.clear());
    await A.reload({ waitUntil: 'load' });
    await A.waitForFunction(() => window.__sakura && document.documentElement.dataset.holdInfo === 'on', null, { timeout: 30000 });
    await seed(A, { quality: 'low' });
    await go(A, '#/coop');
    await setName(A, 'Aiko');
    const B = await openPage('B');
    await B.goto(`${online}#/coop`, { waitUntil: 'load' });
    await setName(B, 'Bea');
    await A.waitForSelector('[data-testid="coop-create"]', { timeout: 15000 });
    await A.click('[data-testid="coop-create"]', { force: true });
    await A.waitForSelector('[data-testid="coop-room-code"]', { timeout: 10000 });
    const code = (await A.locator('[data-testid="coop-room-code"]').innerText()).trim();
    // lobby squad chip: hold → sheet without "Open full page" (leaving would close the room)
    const chip = await A.waitForSelector('.ol-unit[data-unit]', { timeout: 10000 }).catch(() => null);
    if (check(!!chip, 'co-op lobby: squad chips shown')) {
      // The lobby repaints on every link change, and on a loaded machine a busy renderer can
      // deliver the press and the release in the same task (a tap, not a hold): press longer and
      // try again rather than call that a failure. The page records when the sheet appears.
      await A.evaluate(() => {
        window.__sheetSeen = 0;
        new MutationObserver(() => { if (document.querySelector('[data-testid="unit-sheet"]')) window.__sheetSeen++; }).observe(document.body, { childList: true });
      });
      let opened = false;
      for (let attempt = 1; attempt <= 3 && !opened; attempt++) {
        const at = await A.evaluate(() => {
          const r = document.querySelector('.ol-pcard.me .ol-unit[data-unit]')?.getBoundingClientRect();
          return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        if (!at) break;
        await A.mouse.move(at.x, at.y);
        await A.mouse.down();
        await A.waitForTimeout(700 + 500 * attempt);
        await A.mouse.up();
        opened = await A.waitForFunction(() => window.__sheetSeen > 0, null, { timeout: 8000, polling: 100 }).then(() => true).catch(() => false);
        if (!opened) log(`    (lobby hold attempt ${attempt}: no sheet yet — holding again)`);
      }
      check(opened && await A.waitForSelector('[data-testid="unit-sheet"]', { timeout: 5000 }).then(() => true).catch(() => false), 'co-op lobby: holding a squad chip opens her sheet');
      check(!(await A.$('[data-testid="unit-sheet-open-page"]')), 'co-op lobby: no "Open full page" (leaving the lobby would close the room)');
      await shot(A, 'sheet-coop-lobby');
      await A.click('[data-testid="unit-sheet-close"]', { timeout: 10000 }).catch(() => {});
      await A.waitForTimeout(400);
      check(await A.isVisible('[data-testid="coop-room-code"]') && (await A.evaluate(() => location.hash)).startsWith('#/coop'), 'co-op lobby: the room is still open after the sheet closes');
    }
    await B.waitForSelector('[data-testid="coop-code"]', { timeout: 10000 });
    await B.fill('[data-testid="coop-code"]', code);
    await B.click('[data-testid="coop-join"]', { force: true });
    await A.waitForSelector('[data-testid="coop-player-1"]', { timeout: 20000 });
    await B.click('[data-testid="coop-ready"]', { force: true });
    await A.waitForFunction(() => !document.querySelector('[data-testid="coop-start"]')?.disabled, null, { timeout: 15000 });
    await A.click('[data-testid="coop-start"]', { force: true }); // the start button glows: never "stable"
    const inBattle = (p) => p.waitForFunction(() => {
      const ls = window.__battle?.coop?.lockstep;
      return !!(ls && window.__battle.ui?.tree && ls.running && ls.tick > 0 && ls.livePeers().length === 1);
    }, null, { timeout: 180000, polling: 250 }).then(() => true).catch(() => false);
    const both = await Promise.all([inBattle(A), inBattle(B)]);
    if (!check(both.every(Boolean), 'co-op: both players are in the battle')) return;
    // B places a girl through its own lockstep orders (re-issued if a rejoin rebuilt B's battle);
    // first let a slow start settle (a late guest is dropped and re-admitted around tick 6)
    await Promise.all([A, B].map((p) => p.waitForFunction(() => (window.__battle?.coop?.tick || 0) > 240, null, { timeout: 240000, polling: 500 }).catch(() => null)));
    let placed = null;
    for (let attempt = 1; attempt <= 4 && placed == null; attempt++) {
      const id = await B.evaluate(() => {
        const { sim, ui } = window.__battle;
        const unitId = [...sim.loadout.keys()].find((u) => sim.data.unit(u)?.placement === 'land' && sim.cash >= sim.placeCost(u));
        for (let y = 0.3; y < sim.map.height; y += 0.5) {
          for (let x = 0.3; x < sim.map.width; x += 0.5) {
            if (sim.canPlace(unitId, x, y).ok && ui.act.place(unitId, x, y)) return unitId;
          }
        }
        return null;
      }).catch(() => null);
      // ran on B's own sim (through the lockstep) — a rejoin rebuild can drop an order in flight
      const applied = id && await B.waitForFunction(() => (window.__battle?.sim?.towers.length || 0) >= 1, null, { timeout: 90000, polling: 250 }).then(() => true).catch(() => false);
      if (applied) placed = id;
      else log(`    (attempt ${attempt}: B's girl did not stand yet — placing again)`);
    }
    const seen = await A.waitForFunction(() => window.__battle.sim.towers.length >= 1, null, { timeout: 240000, polling: 250 }).then(() => true).catch(() => false);
    if (!check(!!placed && seen, `co-op: B's girl (${placed}) stands on A's screen`)) {
      const st = (p) => p.evaluate(() => {
        const ls = window.__battle?.coop?.lockstep;
        return ls && { slot: ls.mySlot, tick: ls.tick, stalled: ls.stalled, vis: document.visibilityState, towers: window.__battle.sim.towers.length, orders: ls.log.map((c) => `${c.k}:${c.p}@${c.t}`), peers: [...ls.peers.values()].map((q) => ({ h: q.horizon, gone: q.gone })) };
      }).catch((e) => ({ error: e.message }));
      log(`    lockstep: ${JSON.stringify(await Promise.all([A, B].map(st)))}`);
      return;
    }
    const tickRate = async () => {
      const a = await A.evaluate(() => [window.__battle.coop.tick, performance.now()]);
      await A.waitForTimeout(4000);
      const b = await A.evaluate(() => [window.__battle.coop.tick, performance.now()]);
      return ((b[0] - a[0]) * 1000) / (b[1] - a[1]);
    };
    const closedRate = await tickRate();
    const uid = await A.evaluate(() => {
      const { sim, ui } = window.__battle;
      const t = sim.towers.find((tw) => !ui.coop.isMine(tw.uid));
      ui.tree.open({ uid: t.uid });
      return t.uid;
    });
    await A.waitForTimeout(300);
    const m = await A.evaluate(() => ({ mode: window.__battle.ui.tree.model?.mode, paused: window.__battle.ui.paused, chip: document.querySelector('.ut-chip-ally')?.textContent || '', pauseChip: document.querySelector('[data-testid="ut-pause-chip"]')?.textContent || '' }));
    check(m.mode === 'ally' && /view only/.test(m.chip) && /Bea/.test(m.chip), `co-op: A's tree on B's girl is view-only (${JSON.stringify(m)})`);
    check(!m.paused && /keeps going/.test(m.pauseChip), 'co-op: opening the tree does not pause ("Battle keeps going")');
    await A.click('[data-testid="upgrade-tree"] [data-testid="ut-cell-0-1"]');
    check(!(await A.$('[data-testid="ut-goto-panel"]')), 'co-op: no "Upgrade in panel" on an ally\'s girl');
    await shot(A, 'tree-coop-ally');
    const openRate = await tickRate();
    // the shared battle keeps running while A reads the tree: at least 60 more ticks (1 s of game)
    const tOpen = await A.evaluate(() => window.__battle.coop.tick);
    const advanced = await A.waitForFunction((t) => window.__battle.coop.tick >= t + 60 && window.__battle.ui.tree.isOpen, tOpen, { timeout: 120000, polling: 250 }).then(() => true).catch(() => false);
    check(advanced, `co-op: the lockstep keeps ticking with the tree open (from tick ${tOpen})`);
    // pace: compared only when this (software-GL, shared) machine runs the pair near real time
    if (closedRate >= 20) check(openRate >= closedRate * 0.8, `co-op: same pace with the tree open (${openRate.toFixed(1)} vs ${closedRate.toFixed(1)} ticks/s)`);
    else log(`  note co-op pace on this machine: ${closedRate.toFixed(1)} ticks/s closed, ${openRate.toFixed(1)} open (too slow to compare)`);
    check(await A.evaluate(() => window.__battle.ui.paused === false), 'co-op: ctx.paused stays false');
    await A.evaluate(() => window.__battle.ui.tree.close());
    // start the wave and compare state hashes (the tree changed nothing)
    await A.evaluate(() => window.__battle.ui.tree.open({ uid: window.__battle.sim.towers[0].uid }));
    await A.evaluate(() => window.__battle.ui.startWave());
    const hashes = await A.waitForFunction(() => (window.__battle.coop.hashes || []).length >= 2, null, { timeout: 180000, polling: 500 }).then(() => true).catch(() => false);
    const [ha, hb] = await Promise.all([A, B].map((p) => p.evaluate(() => window.__battle.coop.hashes || [])));
    check(hashes && ha.length > 0 && ha.every((p) => p.mine === p.theirs) && hb.every((p) => p.mine === p.theirs), `co-op: hash checkpoints agree with the tree open (${ha.map((p) => p.t).join(', ')})`);
    check(uid != null, 'co-op: tree opened on an ally girl');
    await go(B, '#/lobby');
    await go(A, '#/lobby');
    await A.waitForTimeout(800);
  } catch (e) {
    check(false, `co-op: unexpected error: ${e.stack || e.message}`);
  } finally {
    const errs = errors.splice(0);
    check(!errs.length, `co-op: no page/console errors${errs.length ? `\n       ${errs.slice(0, 6).join('\n       ')}` : ''}`);
    await ctx.close();
  }
}

try {
  for (const vp of viewports) {
    try {
      await runViewport(vp);
    } catch (e) {
      check(false, `${vp}: unexpected error: ${e.stack || e.message}`);
    }
  }
  if (withPortrait) {
    try {
      await runPortrait();
    } catch (e) {
      check(false, `portrait: unexpected error: ${e.stack || e.message}`);
    }
  }
  if (withCoop && !args.includes('--portrait-only')) await runCoop();
} finally {
  await browser.close();
  await server.close();
}
log(failures.length ? `\n${failures.length} check(s) FAILED:\n  - ${failures.join('\n  - ')}` : '\nall unit-info checks passed');
process.exit(failures.length ? 1 : 0);

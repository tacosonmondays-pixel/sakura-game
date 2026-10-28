// The condensed girl page and the menu hold sheet (docs/specs/UI_DIRECTION.md §6.2, M1), the flows the M1 review
// checked by hand, at 844x390 (touch) and 1280x720 (mouse):
//
//   Hold (Glance) sheet  every tab (Build, Info, Tree; a hero's track band; someone's showcase build) scrolls inside
//                        .gs-body with real wheel / touch input until its last line shows; tapping a tree cell keeps
//                        the tab rail and ✕ in view (only the body scrolls, never the sheet).
//   Equipment            tap a spare to equip it, Undo puts the old piece back; hold a spare for its Details without
//                        equipping it; Salvage asks with a second tap; taking a classmate's piece asks first, Undo
//                        gives it back to her.
//   Info                 the Profile sheet promises no ⚡ ability while abilities are dormant; Base stats › Role keeps
//                        her subclass and both role lines; the "+N" chip's hit area reaches the dense tap size.
//   Rail and band        an open locked tab's label stays readable on the ink plate (≥ 4.5:1); in 3D view the
//                        Idle / Attack / Cheer / Victory row sits under the model's canvas, not over her legs.
//   Compact / Detailed   Settings → Display → Girl page (src/ui/girlDetail.js), on Aoi and Umeko (both in full gear):
//                        Compact keeps today's counts (3 strip cells + MORE, no gear values, ≤ 4 matchup entries, the
//                        next star only, Manual closed, the Gear totals sheet its plain list); Detailed shows every
//                        stat inline, each slot's main stat value and substats, every gear total, the set bonuses that
//                        are on, every star, Manual open and the picked path's five tiers; every tab of a hero, a girl
//                        not recruited yet and a ★5 girl lays out too. Both: no sideways overflow, nothing under 12 px.
//                        The switch applies to an open page at once and survives a reload. --shots: both looks, every
//                        tab, both sizes.
//
// Usage: node e2e/girl-page.mjs [--viewport 844x390] [--shots dir]
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (n, d = null) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const SHOTS = opt('shots');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const viewports = opt('viewport') ? [opt('viewport')] : ['844x390', '1280x720'];
const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser } = await launchChromium();
const fails = [];
const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); return c; };
const T = 60000;

/** A fresh save: every girl but Kinu, Aoi with three legendary pieces, two spare charms, and Chika wearing a charm. */
async function openGame(page) {
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 30000 }).catch(() => null);
  if (later) { await later.click({ force: true }); await page.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 15000 }).catch(() => {}); }
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: T });
  return page.evaluate(async () => {
    const { store } = window.__sakura;
    const gear = await import('/src/systems/gear.js');
    const { createRng } = await import('/src/core/rng.js');
    const { UNITS } = await import('/src/data/units.js');
    const p = store.profile;
    for (const u of UNITS) {
      if (u.id === 'kinu') { delete p.units.kinu; continue; }
      p.units[u.id] ||= { level: 40, exp: 0, breakthrough: 3, awaken: 2, gear: { charm: null, ribbon: null, shoes: null }, obtainedAt: Date.now(), favorite: false };
    }
    Object.assign(p.units.hikari, { level: 60, breakthrough: 5, awaken: 5 });
    p.currencies.coins = 5_000_000;
    const mk = (seed, slot, rarity = 'legendary', level = 6) => gear.addGear(p, gear.rollGear(createRng(seed), { slot, rarity, level }));
    const worn = mk(21, 'charm');
    gear.equipGear(p, 'aoi', worn);
    gear.equipGear(p, 'aoi', mk(22, 'ribbon'));
    gear.equipGear(p, 'aoi', mk(23, 'shoes'));
    const spare = mk(24, 'charm', 'mythic', 3);
    const scrap = mk(25, 'charm', 'rare', 0);
    const chikas = mk(26, 'charm', 'superRare', 2);
    gear.equipGear(p, 'chika', chikas);
    // Umeko (a support) in a full club set: the Detailed page lists its 2-piece stat and 3-piece trick
    const { CLUBS } = await import('/src/data/clubs.js');
    const club = Object.keys(CLUBS)[0];
    for (const [i, slot] of ['charm', 'ribbon', 'shoes'].entries()) {
      const uid = mk(31 + i, slot, 'legendary', 8);
      p.gear[uid].club = club;
      gear.equipGear(p, 'umeko', uid);
    }
    for (const r of ['common', 'rare', 'superRare']) p.items[`book_${r}`] = 4; // Level Up's Manual steppers
    p.missions.counters['ga:gift'] = 1;
    store.commit('test');
    store.saveNow?.();
    return { worn, spare, scrap, chikas };
  });
}

const settle = (page, ms = 350) => page.waitForTimeout(ms);
const noToasts = (page) => page.evaluate(() => document.querySelectorAll('.toast-host, .ach-toast, .jn-toast').forEach((e) => e.remove())).catch(() => {});
async function go(page, hash, selector) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForSelector(selector, { timeout: T });
  await settle(page, 500);
  await noToasts(page);
}
async function shot(page, name) {
  if (!SHOTS) return;
  // never a frame of the screen-change cut or the loader
  await page.waitForFunction(() => !document.querySelector('#ld.on, .tx-cut.on'), null, { timeout: 10000 }).catch(() => {});
  await settle(page, 400);
  await noToasts(page);
  await page.screenshot({ path: `${SHOTS}/${name}.jpg`, type: 'jpeg', quality: 60 }).catch(() => {});
}

/** WCAG contrast of two "rgb(r, g, b)" strings. */
const CONTRAST = `(a, b) => {
  const L = (s) => { const c = s.match(/\\d+(\\.\\d+)?/g).slice(0, 3).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}`;

try {
  for (const vp of viewports) {
    const [W, H] = vp.split('x').map(Number);
    const tag = vp;
    const touch = Math.min(W, H) < 600;
    console.log(`\n=== ${vp} (${touch ? 'touch' : 'mouse'}) ===`);
    const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    const page = await context.newPage();
    page.setDefaultTimeout(T);
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    const cdp = await context.newCDPSession(page);
    const ids = await openGame(page);

    /** Scroll an element with real input: a finger swipe (touch events) on phones, the wheel on desktop. */
    const scrollWith = async (sel, dy) => {
      const b = await page.locator(sel).first().boundingBox();
      const x = Math.round(b.x + b.width / 2);
      if (touch) {
        const y0 = Math.round(b.y + b.height - 8);
        const step = Math.min(dy, b.height - 16) / 8;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0, id: 1 }] });
        for (let i = 1; i <= 8; i++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y0 - i * step), id: 1 }] });
          await page.waitForTimeout(16);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else { await page.mouse.move(x, Math.round(b.y + b.height / 2)); await page.mouse.wheel(0, dy); }
      await settle(page, 300);
    };
    const holdAt = async ({ x, y }, ms = 750) => {
      if (touch) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        await page.waitForTimeout(ms);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else { await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up(); }
    };
    const centerOf = async (sel) => {
      const el = page.locator(sel).first();
      await el.scrollIntoViewIfNeeded().catch(() => {});
      const b = await el.boundingBox();
      return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
    };
    /** Where the open hold sheet stands: its rect, the ✕, the body's scroll, the shown tab's last line. */
    const sheetState = () => page.evaluate(() => {
      const s = document.querySelector('[data-testid="unit-sheet"]');
      const body = s.querySelector('.gs-body');
      const close = s.querySelector('[data-testid="unit-sheet-close"]').getBoundingClientRect();
      const br = body.getBoundingClientRect();
      // the tab's lowest visible element (two-column bands: not always the last child)
      let last = null;
      let lr = null;
      for (const el of body.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.height <= 0 || r.width <= 0 || getComputedStyle(el).visibility === 'hidden') continue;
        if (!lr || r.bottom > lr.bottom + 0.5 || (Math.abs(r.bottom - lr.bottom) <= 0.5 && el.contains(last) === false && last?.contains(el))) { last = el; lr = r; }
      }
      const sr = s.getBoundingClientRect();
      return {
        sheet: [Math.round(sr.top), Math.round(sr.bottom)], sheetScroll: s.scrollTop, closeTop: Math.round(close.top), closeIn: close.top >= sr.top - 1 && close.bottom <= sr.bottom + 1 && close.top >= -1,
        body: [Math.round(br.top), Math.round(br.bottom)], scrollTop: Math.round(body.scrollTop), scrollH: body.scrollHeight, clientH: body.clientHeight,
        lastBottom: lr ? Math.round(lr.bottom) : null, lastShown: !!lr && lr.bottom <= Math.min(br.bottom, sr.bottom, innerHeight) + 1 && lr.bottom > br.top, lastText: (last?.textContent || '').trim().slice(0, 40),
      };
    });
    /** Scrolls the body to its end with real input and reports whether the tab's last line came into view. */
    const reachEnd = async () => {
      let st = await sheetState();
      for (let i = 0; i < 12 && st.scrollTop + st.clientH < st.scrollH - 1; i++) {
        await scrollWith('[data-testid="unit-sheet"] .gs-body', 260);
        st = await sheetState();
      }
      return st;
    };
    const openSheetFor = (id, o = {}) => page.evaluate(async ([uid, opts]) => {
      const m = await import('/src/ui/unitSheet.js');
      const { store } = window.__sakura;
      if (opts.showcase) {
        // someone's showcase build: a mini profile with her, no Full page
        const mini = { units: { [uid]: JSON.parse(JSON.stringify(store.profile.units[uid])) }, gear: JSON.parse(JSON.stringify(store.profile.gear)) };
        m.openUnitSheet(uid, { tab: 'build', owner: { name: 'Rin', avatar: 'aoi' }, profile: mini });
      } else m.openUnitSheet(uid, { tab: opts.tab || 'info' });
    }, [id, o]);
    /** The sheet has finished its slide-in (measure it standing still). */
    const sheetStill = () => page.waitForFunction(() => {
      const s = document.querySelector('[data-testid="unit-sheet"]');
      return !!s && s.getAnimations().every((a) => a.playState !== 'running');
    }, null, { timeout: 10000 }).catch(() => {});
    const closeHold = async () => {
      await page.click('[data-testid="unit-sheet-close"]').catch(() => {});
      await page.waitForSelector('[data-testid="unit-sheet"]', { state: 'detached', timeout: 5000 }).catch(() => {});
    };

    // ---- 1. the hold (Glance) sheet: every tab scrolls inside its body, the ✕ stays put -------------------------
    await go(page, '#/students', '#app .unit-card');
    await openSheetFor('aoi', { tab: 'build' });
    await page.waitForSelector('[data-testid="unit-sheet"] .gs-body > *');
    await sheetStill();
    for (const t of ['build', 'info', 'upgrades']) {
      await page.click(`[data-testid="unit-sheet-tab-${t}"]`);
      await settle(page, 500);
      const before = await sheetState();
      check(before.sheet[1] <= H + 1 && before.sheet[0] >= 0 && before.body[1] <= before.sheet[1] + 1, `${tag} hold sheet ${t}: the sheet and its body fit the screen (${JSON.stringify({ sheet: before.sheet, body: before.body })})`);
      const end = await reachEnd();
      check(end.lastShown && end.sheetScroll === 0 && end.closeIn, `${tag} hold sheet ${t}: real ${touch ? 'swipes' : 'wheel'} reach its last line "${end.lastText}" (scroll ${end.scrollTop} of ${end.scrollH - end.clientH}); the sheet itself never scrolls and ✕ stays in view`);
      await shot(page, `hold-${t}-end-${tag}`);
    }
    // a tree cell: only the body scrolls to the tier panel; the rail and ✕ stay on screen
    await page.click('[data-testid="unit-sheet-tab-upgrades"]');
    await settle(page, 300);
    await page.evaluate(() => { document.querySelector('[data-testid="unit-sheet"] .gs-body').scrollTop = 0; });
    await page.click('[data-testid="unit-sheet"] [data-testid="ut-cell-1-2"]');
    await settle(page, 900);
    const cell = await sheetState();
    const detail = await page.evaluate(() => {
      const d = document.querySelector('[data-testid="unit-sheet"] [data-testid="ut-detail"]')?.getBoundingClientRect();
      const b = document.querySelector('[data-testid="unit-sheet"] .gs-body').getBoundingClientRect();
      return d ? { shown: d.top < b.bottom - 20 && d.bottom > b.top, top: Math.round(d.top) } : null;
    });
    check(cell.sheetScroll === 0 && cell.closeIn && cell.closeTop >= 0, `${tag} hold sheet tree: after a cell tap the sheet has not moved and ✕ is in view (top ${cell.closeTop}, sheet scroll ${cell.sheetScroll})`);
    check(!!detail?.shown, `${tag} hold sheet tree: the tier panel scrolled into the body (${JSON.stringify(detail)})`);
    await shot(page, `hold-tree-cell-${tag}`);
    await closeHold();
    // a hero's band: LV 1–3 all reachable
    await openSheetFor('hikari', { tab: 'upgrades' });
    await page.waitForSelector('[data-testid="unit-sheet"] [data-testid="hero-track-band"]');
    await sheetStill();
    const hero = await reachEnd();
    const rows = await page.evaluate(() => {
      const b = document.querySelector('[data-testid="unit-sheet"] .gs-body').getBoundingClientRect();
      const s = document.querySelector('[data-testid="unit-sheet"]').getBoundingClientRect();
      const all = [...document.querySelectorAll('[data-testid="unit-sheet"] .gp-hl')];
      const last = all[all.length - 1]?.getBoundingClientRect();
      return { n: all.length, lastShown: !!last && last.bottom <= Math.min(b.bottom, s.bottom, innerHeight) + 1 && last.top >= b.top - 1 };
    });
    check(hero.lastShown && hero.closeIn, `${tag} hold sheet hero band: its last line "${hero.lastText}" can be reached, ✕ in view`);
    check(rows.n >= 3 && rows.lastShown, `${tag} hold sheet hero band: all ${rows.n} band rows (LV 1–3) can be scrolled into view`);
    await closeHold();
    // someone's showcase build (profile page): Build only, no Full page; every line reachable
    await openSheetFor('aoi', { showcase: true });
    await page.waitForSelector('[data-testid="unit-sheet-owner"]');
    await sheetStill();
    const sc = await reachEnd();
    check(sc.lastShown && sc.sheetScroll === 0 && !(await page.$('[data-testid="unit-sheet-open-page"]')), `${tag} showcase build: her whole build is reachable by scrolling ("${sc.lastText}"), no Full page`);
    await closeHold();

    // ---- 2. Info: Profile (no ⚡), Base stats › Role, the "+N" hit area ---------------------------------------
    for (const id of ['aoi', 'chika', 'momo', 'umeko', 'miko', 'akane', 'ouka']) {
      await go(page, `#/student/${id}?tab=info`, '[data-testid="info-profile"]');
      await page.click('[data-testid="info-profile"]');
      await page.waitForSelector('[data-testid="profile-sheet"]');
      const txt = await page.textContent('[data-testid="profile-sheet"]');
      const tips = await page.locator('[data-testid="profile-tips"] li').count();
      check(!txt.includes('⚡') && !/\bteaches\b/.test(txt) && tips >= 2, `${tag} ${id}'s Profile sheet: ${tips} tips, no ⚡ ability promise`);
      if (id === 'aoi') await shot(page, `aoi-profile-${tag}`);
      await page.keyboard.press('Escape');
      await page.waitForSelector('[data-testid="profile-sheet"]', { state: 'detached' });
    }
    await go(page, '#/student/aoi?tab=info', '[data-testid="info-more"]');
    await page.click('[data-testid="info-more"]');
    await page.waitForSelector('[data-testid="stats-sheet"] [data-testid="stats-role"]');
    const role = await page.evaluate(() => ({
      sub: document.querySelector('[data-testid="stats-subclass"]')?.textContent,
      text: document.querySelector('[data-testid="stats-role"]')?.textContent || '',
      mult: [...document.querySelectorAll('[data-testid="stats-sheet"] .mb-eff-mult')].map((e) => e.textContent),
    }));
    check(role.sub === 'Generalist' && role.text.includes('Cheap, reliable shots; good vs crystal shells.') && role.text.includes('Good against'), `${tag} Base stats › Role: subclass "${role.sub}", both role lines, good against and limitation`);
    check(role.mult.some((m) => /^▲/.test(m)) && role.mult.some((m) => /^▼/.test(m)), `${tag} Base stats: the type table's multipliers carry arrows (${role.mult.join(' ')})`);
    const floor = await page.evaluate(`(() => {
      const c = ${CONTRAST};
      const bad = [];
      for (const el of document.querySelectorAll('[data-testid="stats-sheet"] .ui-body *')) {
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const cs = getComputedStyle(el);
        if (parseFloat(cs.fontSize) < 12) bad.push(el.textContent.trim().slice(0, 24) + ' ' + cs.fontSize);
        let bg = null;
        for (let a = el; a && !bg; a = a.parentElement) { const b = getComputedStyle(a).backgroundColor; if (b && !/rgba\\(\\d+, \\d+, \\d+, 0\\)|transparent/.test(b) && !getComputedStyle(a).backgroundImage.includes('gradient')) bg = b; }
        if (bg && /^rgb\\(/.test(bg) && c(cs.color, bg) < 4.5 && !/rgba/.test(cs.color)) bad.push(el.textContent.trim().slice(0, 24) + ' ' + c(cs.color, bg).toFixed(2));
      }
      return bad;
    })()`);
    check(!floor.length, `${tag} Base stats sheet: nothing under 12 px, every text 4.5:1 or more on its fill (${floor.slice(0, 6).join(' | ')})`);
    await shot(page, `aoi-basestats-${tag}`);
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-testid="stats-sheet"]', { state: 'detached' });
    if (touch) {
      const more = await page.$('[data-testid="info-traits-more"]');
      if (check(!!more, `${tag} Info: Aoi has a "+N" trait chip`)) {
        const hit = await page.evaluate(() => {
          const el = document.querySelector('[data-testid="info-traits-more"]');
          const r = el.getBoundingClientRect();
          const probe = (x, y) => document.elementFromPoint(x, y)?.closest('[data-testid="info-traits-more"]') === el;
          return { w: Math.round(r.width), h: Math.round(r.height), below: probe(r.left + r.width / 2, r.bottom + 5), above: probe(r.left + r.width / 2, r.top - 5) };
        });
        check(hit.below && hit.above, `${tag} Info: the "+N" chip (${hit.w}x${hit.h}) answers taps a few px outside its edge (${JSON.stringify(hit)})`);
      }
    }

    // ---- 3. Equipment: tap to equip + Undo, hold for Details, two-tap Salvage, take from a classmate ----------
    const aoiCharm = () => page.evaluate(() => window.__sakura.store.profile.units.aoi.gear.charm);
    await go(page, '#/student/aoi?tab=gear', '[data-testid="slot-charm"]');
    await page.click('[data-testid="slot-charm"]');
    await page.waitForSelector('[data-testid="gear-sheet"] [data-testid="gear-picker"]');
    await settle(page);
    await page.locator(`[data-testid="pick-${ids.spare}"]`).scrollIntoViewIfNeeded();
    await page.click(`[data-testid="pick-${ids.spare}"]`);
    await settle(page, 500);
    check(await aoiCharm() === ids.spare && await page.locator('[data-testid="gear-sheet"] [data-testid="gear-undo"]').count() >= 1, `${tag} picker: a tap equips the spare and offers Undo`);
    await shot(page, `equip-undo-${tag}`);
    await page.locator('[data-testid="gear-sheet"] [data-testid="gear-undo"]').first().click();
    await settle(page, 500);
    check(await aoiCharm() === ids.worn, `${tag} picker: Undo puts her old charm back`);
    // hold a spare: its Details, and nothing is equipped
    await holdAt(await centerOf(`[data-testid="pick-${ids.scrap}"]`));
    const det = await page.waitForSelector('[data-testid="gear-details"]', { timeout: 6000 }).then(() => true).catch(() => false);
    await settle(page, 400);
    check(det && await aoiCharm() === ids.worn, `${tag} picker: holding a spare opens its Details and does not equip it`);
    if (det) {
      await page.click('[data-testid="gear-details"] [data-testid="gear-salvage"]');
      await settle(page, 300);
      const armed = await page.evaluate((uid) => ({ text: document.querySelector('[data-testid="gear-details"] [data-testid="gear-salvage"]')?.textContent || '', kept: !!window.__sakura.store.profile.gear[uid] }), ids.scrap);
      check(/Tap again/.test(armed.text) && armed.kept, `${tag} Details: the first Salvage tap only asks ("${armed.text.trim()}"), the piece stays`);
      await shot(page, `salvage-armed-${tag}`);
      await page.click('[data-testid="gear-details"] [data-testid="gear-salvage"]');
      await page.waitForSelector('[data-testid="gear-details"]', { state: 'detached', timeout: 6000 }).catch(() => {});
      const gone = await page.evaluate((uid) => !window.__sakura.store.profile.gear[uid], ids.scrap);
      check(gone && await page.locator(`[data-testid="pick-${ids.scrap}"]`).count() === 0, `${tag} Details: the second tap salvages it; the picker drops its tile`);
    }
    // take Chika's charm: asks first, Undo gives it back to her
    await page.locator(`[data-testid="pick-${ids.chikas}"]`).scrollIntoViewIfNeeded();
    await page.click(`[data-testid="pick-${ids.chikas}"]`);
    const asked = await page.waitForSelector('[data-testid="confirm-ok"]', { timeout: 6000 }).then(() => true).catch(() => false);
    check(asked && await aoiCharm() === ids.worn, `${tag} picker: taking Chika's charm asks first (nothing moved yet)`);
    await shot(page, `take-confirm-${tag}`);
    if (asked) {
      await page.click('[data-testid="confirm-ok"]');
      await settle(page, 600);
      const moved = await page.evaluate(() => { const p = window.__sakura.store.profile; return { aoi: p.units.aoi.gear.charm, chika: p.units.chika.gear.charm }; });
      check(moved.aoi === ids.chikas && moved.chika === null, `${tag} picker: Move puts it on Aoi and takes it off Chika (${JSON.stringify(moved)})`);
      await page.locator('[data-testid="gear-sheet"] [data-testid="gear-undo"]').first().click();
      await settle(page, 600);
      const back = await page.evaluate(() => { const p = window.__sakura.store.profile; return { aoi: p.units.aoi.gear.charm, chika: p.units.chika.gear.charm }; });
      check(back.aoi === ids.worn && back.chika === ids.chikas, `${tag} picker: Undo gives Aoi her charm back and Chika hers (${JSON.stringify(back)})`);
    }
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-testid="gear-sheet"]', { state: 'detached' });

    // ---- 4. an open locked tab stays readable; the 3D row sits under the model -------------------------------
    await go(page, '#/student/kinu?tab=gear', '[data-testid="tab-gear"]');
    const locked = await page.evaluate(`(() => {
      const c = ${CONTRAST};
      const t = document.querySelector('[data-testid="tab-gear"]');
      // (UI v2 M3: a folder tab, S4: the open tab's face is its ::before, the label its .ui-tab-word)
      const clear = (v) => v === 'transparent' || v === 'rgba(0, 0, 0, 0)';
      let bg = getComputedStyle(t).backgroundColor;
      if (clear(bg)) bg = getComputedStyle(t, '::before').backgroundColor;
      if (clear(bg)) bg = getComputedStyle(t.closest('.ui-tabbed') || document.body).backgroundColor;
      const word = t.querySelector('.ui-tab-word') || t.querySelector('span') || t;
      return { on: t.classList.contains('on'), locked: t.classList.contains('locked'), ratio: Math.round(c(getComputedStyle(word).color, bg) * 100) / 100 };
    })()`);
    check(locked.on && locked.locked && locked.ratio >= 4.5, `${tag} Kinu (not recruited) on Gear: the open locked tab's label is ${locked.ratio}:1 on its face`);
    await go(page, '#/student/aoi?tab=info', '[data-testid="view-3d"]');
    await page.click('[data-testid="view-3d"]');
    await page.waitForSelector('.gp-band.is-3d .gp-acts .gp-act');
    await settle(page, 1500);
    const band = await page.evaluate(() => {
      const c = document.querySelector('.gp-band .gp-3d').getBoundingClientRect();
      const a = document.querySelector('.gp-band .gp-acts').getBoundingClientRect();
      return { canvasBottom: Math.round(c.bottom), rowTop: Math.round(a.top), canvasH: Math.round(c.height) };
    });
    check(band.canvasBottom <= band.rowTop + 1 && band.canvasH >= 120, `${tag} 3D view: the model's canvas ends above the animation row (${JSON.stringify(band)})`);
    await shot(page, `aoi-3d-${tag}`);
    await page.click('[data-testid="view-card"]');
    await settle(page, 300);

    // ---- 5. Compact / Detailed (Settings → Display → Girl page) -------------------------------------------------
    /** No sideways overflow on the page or in the tab host; every text 12 px or more. */
    const layout = () => page.evaluate(() => {
      const host = document.querySelector('.gp-host');
      const small = [];
      for (const el of document.querySelectorAll('.gp-host *, .gp-band *')) {
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        if (el.closest('.ui-sr')) continue; // screen-reader words, never drawn
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 12) small.push(`${el.textContent.trim().slice(0, 20)} ${fs}px`);
      }
      const wide = [...host.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); const hr = host.getBoundingClientRect(); return r.width > 0 && r.right > hr.right + 1; }).map((el) => el.className || el.tagName).slice(0, 4);
      return { pageX: document.scrollingElement.scrollWidth - innerWidth, hostX: host.scrollWidth - host.clientWidth, small, wide };
    });
    const layoutOk = async (what) => {
      const l = await layout();
      check(l.pageX <= 0 && l.hostX <= 1 && !l.wide.length, `${tag} ${what}: no sideways overflow (page ${l.pageX}, host ${l.hostX}${l.wide.length ? `, past the edge: ${l.wide.join(' | ')}` : ''})`);
      check(!l.small.length, `${tag} ${what}: nothing under 12 px (${l.small.slice(0, 4).join(' | ')})`);
    };
    const mode = () => page.evaluate(() => window.__sakura.store.profile.settings.girlPage);
    const count = (sel) => page.locator(sel).count();
    const toEnd = () => page.evaluate(() => { const el = document.querySelector('.gp-host'); el.scrollTop = el.scrollHeight; });
    /** Her page on tab `t`, waiting for the NEW page's content (the old one is marked first). */
    const goGirl = async (id, t) => {
      await page.evaluate(() => document.querySelectorAll('.gp-host').forEach((e) => { e.dataset.old = '1'; }));
      await go(page, `#/student/${id}?tab=${t}`, '.gp-host:not([data-old]) > *');
    };
    const SHOT_GIRLS = ['aoi', 'umeko'];
    // Compact (the default): today's counts
    check(await mode() === 'compact', `${tag} the girl page starts Compact (${await mode()})`);
    for (const id of SHOT_GIRLS) {
      await go(page, `#/student/${id}?tab=info`, '[data-testid="info-strip"]');
      const mu = await count('[data-testid="info-matchup"] .gp-mu');
      check(await count('[data-testid="info-strip"] .ui-cell') === 3 && await count('[data-testid="info-more"]') === 1 && !(await count('[data-testid="info-stats"]')) && mu <= 4 && !(await count('[data-testid="info-matchup-mult"]')),
        `${tag} Compact ${id} Info: 3 headline stats + MORE, no inline stats, ${mu} matchup entries (≤ 4), no multipliers`);
      await layoutOk(`Compact ${id} Info`);
      await shot(page, `compact-${id}-info-${tag}`);
      await go(page, `#/student/${id}?tab=gear`, '[data-testid="slot-charm"]');
      check(await count('[data-testid="gear-strip"] .ui-cell') === 3 && await count('[data-testid="gear-more"]') === 1 && !(await count('[data-testid="gear-totals-all"]')),
        `${tag} Compact ${id} Gear: the totals strip is 3 cells + MORE`);
      check(!(await count('.gk-main-v')) && !(await count('.gk-subs')) && await count('.gk-slot .gk-main') === 3, `${tag} Compact ${id} Gear: 3 slot tiles with the main stat label, no value, no substats`);
      // MORE: the Gear totals sheet keeps its one-line-per-stat list (the Detailed grid's styles never reach it)
      await page.click('[data-testid="gear-more"]');
      await page.waitForSelector('[data-testid="gear-totals-sheet"] .gk-lines');
      const sheetList = await page.evaluate(() => { const cs = getComputedStyle(document.querySelector('[data-testid="gear-totals-sheet"] .gk-lines')); return `${cs.display} ${cs.flexDirection} ${cs.backgroundColor}`; });
      check(sheetList === 'flex column rgba(0, 0, 0, 0)', `${tag} Compact ${id} Gear › MORE: the totals sheet is its plain list (${sheetList})`);
      await page.keyboard.press('Escape');
      await page.waitForSelector('[data-testid="gear-totals-sheet"]', { state: 'detached' });
      await layoutOk(`Compact ${id} Gear`);
      await shot(page, `compact-${id}-gear-${tag}`);
    }
    await go(page, '#/student/aoi?tab=level', '[data-testid="level-panel"]');
    check(await count('[data-testid="level-manual"][aria-expanded="false"]') === 1 && !(await count('[data-testid="level-books"]')), `${tag} Compact Level Up: Manual is closed`);
    await shot(page, `compact-aoi-level-${tag}`);
    await go(page, '#/student/aoi?tab=awaken', '[data-testid="tab-awaken"]');
    const awC = { next: await count('[data-testid="awaken-next"]'), list: await count('[data-testid="awaken-stars"]'), lock: await count('[data-testid="story-lock-awaken"]') };
    check(awC.lock || (awC.next === 1 && !awC.list), `${tag} Compact Awakening: the next star only (${JSON.stringify(awC)})`);
    await shot(page, `compact-aoi-awaken-${tag}`);
    await go(page, '#/student/aoi?tab=tree', '[data-testid="tree-grid"]');
    check(!(await count('[data-testid="tree-path-list"]')), `${tag} Compact Tree: no tier list under the grid`);
    await shot(page, `compact-aoi-tree-${tag}`);

    // the Settings switch: Display → Girl page → Detailed
    await go(page, '#/settings', '[data-testid="set-girlPage"]');
    await page.locator('[data-testid="set-girlPage"] .ma-seg-btn', { hasText: 'Detailed' }).click();
    await settle(page, 300);
    const seg = await page.evaluate(() => [...document.querySelectorAll('[data-testid="set-girlPage"] .ma-seg-btn')].map((b) => `${b.textContent}:${b.getAttribute('aria-checked')}`).join(' '));
    check(await mode() === 'detailed' && /Detailed:true/.test(seg), `${tag} Settings → Display → Girl page: Detailed is picked and saved (${seg})`);
    await shot(page, `settings-girl-page-${tag}`);

    for (const id of SHOT_GIRLS) {
      await go(page, `#/student/${id}?tab=info`, '[data-testid="info-stats"]');
      const info = await page.evaluate(async (uid) => {
        const rows = document.querySelectorAll('[data-testid="info-stats"] tbody tr').length;
        const { matchupList } = await import('/src/ui/girlView.js');
        const { UNIT_MAP } = await import('/src/data/units.js');
        return { rows, head: document.querySelector('[data-testid="info-stats"] thead')?.textContent || '', mu: document.querySelectorAll('[data-testid="info-matchup"] .gp-mu').length, mult: document.querySelectorAll('[data-testid="info-matchup-mult"]').length, all: matchupList(UNIT_MAP[uid].attackType).length, caps: document.querySelectorAll('[data-testid="info-caps-list"] li').length, hasCaps: (UNIT_MAP[uid].capabilities || []).filter((c) => c !== 'water').length + (UNIT_MAP[uid].pathCapabilities || []).filter((c) => !(UNIT_MAP[uid].capabilities || []).includes(c)).length };
      }, id);
      await page.click('[data-testid="info-more"]');
      await page.waitForSelector('[data-testid="stats-sheet"] .mb-stats');
      const sheetRows = await page.evaluate(() => document.querySelectorAll('[data-testid="stats-sheet"] .mb-stats tbody tr').length);
      await page.keyboard.press('Escape');
      await page.waitForSelector('[data-testid="stats-sheet"]', { state: 'detached' });
      check(info.rows >= 8 && info.rows === sheetRows && /Base/.test(info.head) && /Yours/.test(info.head), `${tag} Detailed ${id} Info: every stat inline with Base and Yours (${info.rows} rows, the MORE sheet has ${sheetRows})`);
      check(info.mu === info.all && info.mult === info.all && info.caps === info.hasCaps, `${tag} Detailed ${id} Info: the whole matchup with multipliers (${info.mult} of ${info.all}) and ${info.caps} capabilities listed`);
      await layoutOk(`Detailed ${id} Info`);
      await shot(page, `detailed-${id}-info-${tag}`);
      await toEnd();
      await shot(page, `detailed-${id}-info-end-${tag}`);
      await go(page, `#/student/${id}?tab=gear`, '[data-testid="gear-totals-all"]');
      const gearD = await page.evaluate(async (uid) => {
        const { store } = window.__sakura;
        const { gearLines } = await import('/src/systems/gear.js');
        const { gearTotalsRows, setView } = await import('/src/ui/gearView.js');
        const { shortStatValue } = await import('/src/ui/girlDetail.js');
        const p = store.profile;
        const want = ['charm', 'ribbon', 'shoes'].map((slot) => { const L = gearLines(p.gear[p.units[uid].gear[slot]]); return { slot, main: shortStatValue(L.main.stat, L.main.value), subs: L.subs.map((l) => shortStatValue(l.stat, l.value)) }; });
        const got = want.map((w) => ({
          slot: w.slot,
          main: document.querySelector(`[data-testid="slot-${w.slot}-main"]`)?.textContent || null,
          mainShown: !!document.querySelector(`[data-testid="slot-${w.slot}-main"]`)?.getBoundingClientRect().width,
          subs: [...document.querySelectorAll(`[data-testid="slot-${w.slot}-subs"] .gk-sub .num`)].map((e) => e.textContent),
          subsShown: [...document.querySelectorAll(`[data-testid="slot-${w.slot}-subs"] .gk-sub`)].every((e) => e.getBoundingClientRect().height > 0),
        }));
        const set = setView(p, uid);
        return { want, got, totals: document.querySelectorAll('[data-testid="gear-totals-all"] .gk-tot').length, rows: gearTotalsRows(p, uid).length, more: document.querySelectorAll('[data-testid="gear-more"]').length, bonuses: document.querySelectorAll('[data-testid="gear-bonuses"] li').length, setOn: set ? Number(!!set.two?.on) + Number(!!set.trick?.on) + Number(!!set.resonance) : 0 };
      }, id);
      const sameMain = gearD.want.every((w, i) => gearD.got[i].main === w.main && gearD.got[i].mainShown);
      const sameSubs = gearD.want.every((w, i) => JSON.stringify(gearD.got[i].subs) === JSON.stringify(w.subs) && w.subs.length > 0 && gearD.got[i].subsShown);
      check(sameMain, `${tag} Detailed ${id} Gear: every slot tile shows its main stat value (${gearD.got.map((g) => g.main).join(', ')})`);
      check(sameSubs, `${tag} Detailed ${id} Gear: every substat shows with its value (${gearD.got.map((g) => g.subs.join(' ')).join(' | ')})`);
      check(gearD.totals === gearD.rows && gearD.rows > 3 && !gearD.more, `${tag} Detailed ${id} Gear: every total (${gearD.totals} of ${gearD.rows}), no MORE`);
      check(gearD.bonuses === gearD.setOn, `${tag} Detailed ${id} Gear: ${gearD.bonuses} set bonuses listed (${gearD.setOn} on)`);
      await layoutOk(`Detailed ${id} Gear`);
      await shot(page, `detailed-${id}-gear-${tag}`);
      await toEnd();
      await shot(page, `detailed-${id}-gear-end-${tag}`);
    }
    await go(page, '#/student/aoi?tab=level', '[data-testid="level-panel"]');
    check(await count('[data-testid="level-manual"][aria-expanded="true"]') === 1 && await count('[data-testid="level-books"] .mb-stepper') >= 3, `${tag} Detailed Level Up: the Manual steppers are open`);
    await layoutOk('Detailed Level Up');
    await shot(page, `detailed-aoi-level-${tag}`);
    await go(page, '#/student/aoi?tab=awaken', '[data-testid="tab-awaken"]');
    if (!awC.lock) {
      const aw = await page.evaluate(() => ({ n: document.querySelectorAll('[data-testid="awaken-stars"] li').length, on: document.querySelectorAll('[data-testid="awaken-stars"] li.on').length, star: window.__sakura.store.profile.units.aoi.awaken, next: [...document.querySelectorAll('[data-testid="awaken-stars"] li.next')].map((e) => e.textContent) }));
      check(aw.n === 5 && aw.on === aw.star && aw.next.length === 1 && aw.next[0].includes(`★${aw.star + 1}`), `${tag} Detailed Awakening: every star listed, ${aw.on} reached, the next one highlighted (${aw.next.join('')})`);
      await layoutOk('Detailed Awakening');
      await shot(page, `detailed-aoi-awaken-${tag}`);
    }
    await go(page, '#/student/aoi?tab=tree', '[data-testid="tree-path-list"]');
    const t0 = await count('[data-testid="tree-path-list"] [data-testid^="tree-tier-0-"]');
    await page.click('[data-testid="ut-cell-1-2"]');
    await settle(page, 300);
    const t1 = await count('[data-testid="tree-path-list"] [data-testid^="tree-tier-1-"]');
    const fx = await page.evaluate(() => [...document.querySelectorAll('[data-testid="tree-path-list"] .gp-tl')].every((li) => li.querySelector('.gp-tl-fx')?.textContent.trim()));
    check(t0 === 5 && t1 === 5 && fx, `${tag} Detailed Tree: the first path's five tiers, then the picked path's five, each with its effects`);
    await layoutOk('Detailed Tree');
    await shot(page, `detailed-aoi-tree-${tag}`);
    await toEnd();
    await shot(page, `detailed-aoi-tree-end-${tag}`);
    // every tab of a hero (Hikari, ★5), a girl not recruited yet (Kinu) and a ★5 student (Umeko raised below) in Detailed
    await page.evaluate(() => { const { store } = window.__sakura; store.profile.units.umeko.awaken = 5; store.commit('test'); });
    for (const id of ['hikari', 'kinu', 'umeko']) {
      for (const t of ['info', 'level', 'awaken', 'gear', 'tree']) {
        await goGirl(id, t);
        await layoutOk(`Detailed ${id} ${t}`);
      }
    }
    await goGirl('umeko', 'awaken');
    check(await count('[data-testid="awaken-stars"] li.on') === 5 && !(await count('[data-testid="awaken-stars"] li.next')), `${tag} Detailed Awakening at ★5: all five stars reached, none next`);
    // the switch applies to an open page at once, and Detailed survives a reload
    await go(page, '#/student/aoi?tab=gear', '[data-testid="gear-totals-all"]');
    await page.evaluate(() => { const { store } = window.__sakura; store.profile.settings.girlPage = 'compact'; store.commit('settings'); });
    const live = await page.waitForSelector('[data-testid="gear-strip"]', { timeout: 5000 }).then(() => true).catch(() => false);
    check(live && !(await count('[data-testid="gear-totals-all"]')), `${tag} an open girl page follows the switch at once (Detailed → Compact)`);
    await page.evaluate(() => { const { store } = window.__sakura; store.profile.settings.girlPage = 'detailed'; store.commit('settings'); store.saveNow?.(); });
    await page.waitForSelector('[data-testid="gear-totals-all"]', { timeout: 5000 }).catch(() => {});
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: T });
    const kept = await page.waitForSelector('[data-testid="gear-totals-all"]', { timeout: T }).then(() => true).catch(() => false);
    check(kept && await mode() === 'detailed', `${tag} Detailed survives a reload`);
    await page.evaluate(() => { const { store } = window.__sakura; store.profile.settings.girlPage = 'compact'; store.commit('settings'); store.saveNow?.(); });

    check(!errs.length, `${tag} no page errors${errs.length ? `: ${errs.slice(0, 3).join(' | ')}` : ''}`);
    await context.close();
  }
} catch (e) {
  fails.push(`crash: ${e.stack || e.message}`);
  console.log(e);
} finally {
  await browser.close();
  await server.close();
}
console.log(fails.length ? `\n${fails.length} FAILED:\n - ${fails.join('\n - ')}` : '\nall girl-page checks passed');
process.exit(fails.length ? 1 : 0);

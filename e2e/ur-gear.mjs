// UR gear (docs/specs/GEAR_AWAKEN.md §12.2, GEAR_STATS.md §I): seeds Aoi with a gold +10 charm and two
// Taiko Club pieces, a Rainbow Seed, Starlight Needles and a Club Armband, then on her Equipment tab (the
// condensed girl page, UI_DIRECTION.md §6.2 M1b: slot cards, the slot sheet, Details): the rainbow dot, the
// slot tile's ✦ and the Awaken button in the charm's slot sheet, the Awaken modal over the sheet (before →
// after, Power), "Awakened to UR!", the rainbow tile, tag and slot; a gold ✦ and a rainbow ✦ stitched on one
// line, then one taken back; the set chip, and the Armband moves the charm into the Taiko Club so the gear
// totals' set lights the 2-piece stat and the trick. In
// the Backpack a spare gold +10 can awaken from its modal, and a Rainbow Gear Box opens through its slot
// picker (rainbow-box-open → rainbow-box-<slot>, ASCENSION.md §C.8) into rainbow UR gear at +0 with four
// substats. No horizontal overflow; every modal fits.
// Phone (844x390) first, then PC (1280x720).
// Usage: node e2e/ur-gear.mjs [--shots dir]
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const SHOTS = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const require = createRequire('/opt/node22/lib/node_modules/playwright/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const fails = [];
const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); };
const T = 60000;

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
    const p = store.profile;
    p.currencies.coins = 5_000_000;
    Object.assign(p.items, { seed_rainbow: 2, needle_star: 3, club_band: 2, dice_reroll: 20, dice_prism: 5, gearbox_rainbow: 1 });
    const mk = (seed, slot, club = null) => gear.addGear(p, gear.rollGear(createRng(seed), { slot, rarity: 'legendary', level: 10, club }));
    const charm = mk(11, 'charm');
    gear.equipGear(p, 'aoi', charm);
    gear.equipGear(p, 'aoi', mk(12, 'ribbon', 'taiko'));
    gear.equipGear(p, 'aoi', mk(13, 'shoes', 'taiko'));
    const spare = mk(14, 'charm');
    p.missions.counters['ga:gift'] = 1; // no first-bloom gift in this test's counts
    store.commit('test');
    store.saveNow?.();
    return { charm, spare };
  });
}

async function go(page, hash, selector) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForSelector(selector, { timeout: T });
  await page.waitForTimeout(400);
}

async function shot(page, name) {
  if (!SHOTS) return;
  // screenshots show the screen, not the passing notices (achievement / lesson toasts) or a modal's fade-in
  await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelectorAll('.toast-host, .ach-toast, .jn-toast').forEach((e) => e.remove()));
  for (let i = 0; i < 2; i++) {
    try {
      await page.screenshot({ path: `${SHOTS}/${name}.png`, timeout: 150000 });
      return;
    } catch (e) {
      if (i) console.log(`  warn screenshot ${name} skipped: ${String(e.message).split('\n')[0]}`);
    }
  }
}

/** No horizontal page overflow, and the open modal (if any) fits the viewport. */
async function layout(page) {
  return page.evaluate(() => {
    const over = document.documentElement.scrollWidth - window.innerWidth;
    const m = [...document.querySelectorAll('.modal, .ui-layer > .ui-sheet')].pop();
    const r = m?.getBoundingClientRect();
    return { over, fits: !r || (r.left >= -1 && r.right <= window.innerWidth + 1 && r.top >= -1 && r.bottom <= window.innerHeight + 1) };
  });
}

const tap = (page, sel) => page.locator(sel).first().click();
const count = (page, id) => page.evaluate((i) => window.__sakura.store.profile.items[i] || 0, id);
const closeModals = async (page) => {
  for (let i = 0; i < 4 && await page.locator('.modal, .ui-layer > .ui-sheet').count(); i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    if (await page.locator('.modal-overlay').count()) await page.mouse.click(2, 2);
    await page.waitForTimeout(250);
  }
};

try {
  for (const [W, H] of [[844, 390], [1280, 720]]) {
    const tag = `${W}x${H}`;
    const touch = W < 1000;
    const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch });
    page.setDefaultTimeout(T);
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    const ids = await openGame(page);

    // ---- her Equipment tab: the rainbow dot, the slot tile's ✦, and Awaken in the charm's slot sheet
    await go(page, '#/student/aoi?tab=gear', '[data-testid="slot-charm"]');
    check(await page.locator('[data-testid="tab-gear"] .ur-dot').count() === 1, `${tag} the Equipment tab shows the rainbow dot (a piece can awaken)`);
    check(await page.locator('[data-testid="slot-charm"] .k-ready').count() === 1, `${tag} the charm's slot tile shows the rainbow ✦ (it can awaken)`);
    check(await page.locator('[data-testid="gear-set"]').count() === 1, `${tag} two Taiko pieces: the set chip shows on the Glance`);
    const setOn = await page.locator('[data-testid="gear-set-on"]').innerText().catch(() => '');
    check(/^RATE \+5%$/.test(setOn.trim()), `${tag} the set chip names the 2-piece bonus that is on ("${setOn}")`);
    await tap(page, '[data-testid="slot-charm"]');
    await page.waitForSelector('[data-testid="gear-sheet"]');
    await page.waitForTimeout(300);
    check(await page.locator('[data-testid="gear-sheet"] [data-testid="gear-awaken"]').count() === 1, `${tag} a gold +10 shows Awaken where "Max +10" was`);
    await tap(page, '[data-testid="gear-item-more"]');
    await page.waitForSelector('[data-testid="gear-details"]');
    check((await page.locator('[data-testid="gear-details"] .gk-flag.ready').count()) >= 1, `${tag} its Details say "✦ Can awaken"`);
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-testid="gear-details"]', { state: 'detached' });
    await shot(page, `${tag}-equipment-gold`);

    // ---- awaken (the modal sits above the sheet)
    await tap(page, '[data-testid="gear-awaken"]');
    await page.waitForSelector('[data-testid="gear-awaken-modal"]');
    const am = await page.evaluate(() => ({ cards: document.querySelectorAll('[data-testid="gear-awaken-modal"] .mb-gear').length, power: !!document.querySelector('.gu-power'), gains: document.querySelectorAll('.gu-gain').length }));
    check(am.cards === 2 && am.power && am.gains >= 4, `${tag} the Awaken modal shows before → after, the gains and Power (${JSON.stringify(am)})`);
    check((await layout(page)).fits, `${tag} the Awaken modal fits the screen`);
    await page.waitForTimeout(400); // the modal's pop-in
    const onTop = await page.evaluate(() => {
      // the middle of the modal: a passing toast at the top of the screen may sit over its title
      const m = document.querySelector('[data-testid="gear-awaken-modal"]').getBoundingClientRect();
      const hit = document.elementFromPoint(m.left + m.width / 2, m.top + m.height / 2);
      return !!hit?.closest('.modal') && !hit?.closest('.ui-sheet');
    });
    check(onTop, `${tag} the Awaken modal is above the slot sheet`);
    await shot(page, `${tag}-awaken-modal`);
    await tap(page, '[data-testid="gear-awaken-go"]');
    await page.waitForSelector('[data-testid="gear-ascend"]');
    check(true, `${tag} "Awakened to UR!" plays`);
    await page.waitForTimeout(1200);
    await shot(page, `${tag}-awaken-moment`);
    await tap(page, '[data-testid="gear-ascend-ok"]');
    await page.waitForSelector('[data-testid="gear-ascend"]', { state: 'detached' });
    await page.waitForTimeout(300);
    const ur = await page.evaluate((uid) => {
      const item = document.querySelector(`[data-testid="gear-item"][data-gear="${uid}"]`);
      const p = window.__sakura.store.profile;
      return { tile: !!item?.querySelector('.ui-gtile.is-ur > .ur-ring'), tag: !!item?.querySelector('.ui-rtag.is-ur .ur-ring'), slot: !!document.querySelector('[data-testid="slot-charm"].is-ur .ui-gtile.is-ur'), saved: p.gear[uid].ur === 1 && p.gear[uid].locked, seeds: p.items.seed_rainbow || 0 };
    }, ids.charm);
    check(ur.tile && ur.tag && ur.slot, `${tag} the tile is rainbow (step 5) with the UR tag, and so is her charm slot (${JSON.stringify(ur)})`);
    check(ur.saved && ur.seeds === 1, `${tag} saved as UR, locked, one Seed spent`);
    // the UR tag's rainbow ring sits on the tag itself (not around the whole sheet), in the slot sheet and in Details
    const ringOnTag = (scope) => page.evaluate((sel) => {
      const t = document.querySelector(`${sel} .ui-rtag.is-ur`);
      const r = t?.querySelector(':scope > .ur-ring');
      if (!t || !r) return { ok: false, why: 'no tag or ring' };
      const a = t.getBoundingClientRect();
      const b = r.getBoundingClientRect();
      const d = Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.right - b.right), Math.abs(a.bottom - b.bottom));
      return { ok: d <= 1.5, tag: [Math.round(a.width), Math.round(a.height)], ring: [Math.round(b.width), Math.round(b.height)] };
    }, scope);
    const rs = await ringOnTag(`[data-testid="gear-item"][data-gear="${ids.charm}"]`);
    check(rs.ok, `${tag} slot sheet: the UR ring wraps the tag only (${JSON.stringify(rs)})`);
    await tap(page, '[data-testid="gear-item-more"]');
    await page.waitForSelector('[data-testid="gear-details"]');
    await page.waitForTimeout(300);
    const rd = await ringOnTag('[data-testid="gear-details"]');
    check(rd.ok, `${tag} Details: the UR ring wraps the tag only (${JSON.stringify(rd)})`);
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-testid="gear-details"]', { state: 'detached' });

    // ---- Starlight Needle: gold then rainbow on the same line, then take one back
    const needles0 = await count(page, 'needle_star');
    await tap(page, '[data-testid="gear-stitch"]');
    await page.waitForSelector('[data-testid="stitch-modal"]');
    await tap(page, '[data-testid="stitch-line-0"]');
    const v0 = await page.evaluate((uid) => window.__sakura.store.profile.gear[uid].subs[0].value, ids.charm);
    await tap(page, '[data-testid="do-stitch"]');
    await page.waitForTimeout(250);
    await tap(page, '[data-testid="do-stitch"]');
    await page.waitForTimeout(300);
    const st = await page.evaluate((uid) => {
      const row = document.querySelector('[data-testid="stitch-line-0"]');
      return { gold: !!row?.querySelector('.mb-sub-star'), rb: !!row?.querySelector('.mb-sub-rb'), tuned: window.__sakura.store.profile.gear[uid].subs[0].tuned };
    }, ids.charm);
    check(st.gold && st.rb && st.tuned === 3, `${tag} a gold ✦ and a rainbow ✦ on one line (${JSON.stringify(st)})`);
    check(await count(page, 'needle_star') === needles0 - 2, `${tag} two Needles used`);
    check((await layout(page)).fits, `${tag} the Stitch modal fits the screen`);
    await shot(page, `${tag}-stitch`);
    await tap(page, '[data-testid="take-back-0"]');
    await page.waitForTimeout(300);
    const tb = await page.evaluate((uid) => window.__sakura.store.profile.gear[uid].subs[0].tuned, ids.charm);
    check(tb === 1 && await count(page, 'needle_star') === needles0 - 1, `${tag} take back removes the rainbow ✦ first and returns the Needle`);
    await tap(page, '[data-testid="stitch-done"]');
    await page.waitForTimeout(300);
    const v1 = await page.evaluate((uid) => window.__sakura.store.profile.gear[uid].subs[0].value, ids.charm);
    check(v1 > v0, `${tag} the stitched line grew (${v0} → ${v1})`);
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-testid="gear-sheet"]', { state: 'detached' });

    // ---- Club Armband: the charm joins Taiko, the gear totals' set lights the 2-piece stat and the trick
    await tap(page, '[data-testid="gear-more"]');
    await page.waitForSelector('[data-testid="gear-totals-sheet"]');
    check(await page.locator('[data-testid="club-bonus-on"]').count() === 1 && await page.locator('[data-testid="club-trick-on"]').count() === 0, `${tag} 2 Taiko pieces: the 2-piece line is lit, the trick is not`);
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-testid="gear-totals-sheet"]', { state: 'detached' });
    await tap(page, '[data-testid="slot-charm"]');
    await page.waitForSelector('[data-testid="gear-sheet"]');
    await tap(page, '[data-testid="gear-club"]');
    await page.waitForSelector('[data-testid="armband-modal"]');
    await tap(page, '[data-testid="club-taiko"]');
    check((await layout(page)).fits, `${tag} the Armband modal fits the screen`);
    await shot(page, `${tag}-armband`);
    await tap(page, '[data-testid="do-armband"]');
    await page.waitForTimeout(300);
    await tap(page, '[data-testid="armband-done"]');
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-testid="gear-sheet"]', { state: 'detached' });
    await tap(page, '[data-testid="gear-more"]');
    await page.waitForSelector('[data-testid="gear-totals-sheet"]');
    const set = await page.evaluate(async () => {
      const prog = await import('/src/systems/progression.js');
      const s = prog.unitBattleStats(window.__sakura.store.profile, 'aoi');
      return { club: s.club, n: s.clubN, trick: !!document.querySelector('[data-testid="club-trick-on"]'), fill: document.querySelector('[data-testid="fill-meter"]')?.textContent || '' };
    });
    check(set.club === 'taiko' && set.n === 3 && set.trick, `${tag} all three in Taiko: the set bonus and the Big Beat trick are on (${JSON.stringify(set)})`);
    await page.evaluate(() => document.querySelector('[data-testid="club-strip"]')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(250);
    await shot(page, `${tag}-equipment-ur`);
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-testid="gear-totals-sheet"]', { state: 'detached' });
    const lay = await layout(page);
    check(lay.over <= 1, `${tag} no horizontal overflow on her Equipment tab (${lay.over}px)`);

    // ---- Backpack: a spare gold +10 can awaken from its piece sheet (UI v2 M3: the girl page's piece sheet, spare mode)
    await go(page, '#/backpack?tab=equipment', `.mb-gear[data-gear="${ids.spare}"]`);
    await tap(page, `.mb-gear[data-gear="${ids.spare}"]`);
    await page.waitForSelector('[data-testid="gear-piece-sheet"] [data-testid="gear-awaken"]');
    check(true, `${tag} the Backpack's piece sheet offers Awaken on a spare gold +10`);
    check((await layout(page)).fits, `${tag} the Backpack's piece sheet fits the screen`);
    await shot(page, `${tag}-backpack-modal`);
    await closeModals(page);

    // ---- Backpack: the Rainbow Gear Box opens only through its slot picker, into rainbow UR gear at +0 (UI v2 M2: the
    // boxes live in the Supplies sheet, opened from the toolbar)
    await tap(page, '#app [data-testid="supplies-open"]');
    await page.waitForSelector('[data-testid="box-gearbox_rainbow"] [data-testid="rainbow-box-open"]');
    const gear0 = await page.evaluate(() => Object.keys(window.__sakura.store.profile.gear));
    const seeds0 = await count(page, 'seed_rainbow');
    check(await page.locator('[data-testid="open-all-gearbox_rainbow"]').count() === 0, `${tag} the Rainbow Gear Box has no Open all`);
    await tap(page, '[data-testid="rainbow-box-open"]');
    await page.waitForSelector('[data-testid="rainbow-box-modal"]');
    const picks = await page.evaluate(() => ['charm', 'ribbon', 'shoes'].map((s) => !!document.querySelector(`[data-testid="rainbow-box-${s}"]`)));
    check(picks.every(Boolean), `${tag} the slot picker offers charm, ribbon and shoes (${JSON.stringify(picks)})`);
    check((await layout(page)).fits, `${tag} the Rainbow Gear Box picker fits the screen`);
    await shot(page, `${tag}-rainbow-box-picker`);
    await tap(page, '[data-testid="rainbow-box-shoes"]');
    await page.waitForSelector('[data-testid="gear-ascend"]');
    // the picker fades out (160 ms) while the UR moment opens
    const pickerGone = await page.waitForSelector('[data-testid="rainbow-box-modal"]', { state: 'detached', timeout: 5000 }).then(() => true, () => false);
    check(pickerGone, `${tag} picking a slot closes the picker and plays the UR moment`);
    await page.waitForTimeout(1200);
    await shot(page, `${tag}-rainbow-box-moment`);
    const born = await page.evaluate((before) => {
      const p = window.__sakura.store.profile;
      const uid = Object.keys(p.gear).find((u) => !before.includes(u));
      const g = uid ? p.gear[uid] : null;
      return { uid, slot: g?.slot, rarity: g?.rarity, ur: g?.ur, level: g?.level, subs: g?.subs?.length, locked: g?.locked, boxes: p.items.gearbox_rainbow || 0, mark: p.missions.counters[`gbx:${uid}`] || 0, n: Object.keys(p.gear).length - before.length };
    }, gear0);
    check(born.n === 1 && born.slot === 'shoes' && born.rarity === 'legendary' && born.ur === 1 && born.level === 0 && born.subs === 4 && born.locked,
      `${tag} the box became one rainbow UR shoes piece at +0 with four substats, locked (${JSON.stringify(born)})`);
    check(born.boxes === 0 && born.mark > 0, `${tag} the box is spent and the piece carries its gbx: mark`);
    check(await count(page, 'seed_rainbow') === seeds0, `${tag} opening the box spends no Rainbow Seed`);
    await tap(page, '[data-testid="gear-ascend-ok"]');
    await page.waitForSelector('[data-testid="gear-ascend"]', { state: 'detached' });
    await page.waitForTimeout(300);
    // (the box row: in the Supplies sheet, opened again)
    await tap(page, '#app [data-testid="supplies-open"]');
    await page.waitForSelector('[data-testid="supplies-sheet"]');
    const card = await page.evaluate((uid) => {
      const el = document.querySelector(`.mb-gear[data-gear="${uid}"]`);
      return { card: !!el, ur: !!el?.classList.contains('is-ur'), box: !!document.querySelector('[data-testid="box-gearbox_rainbow"]') };
    }, born.uid);
    check(card.card && card.ur && !card.box, `${tag} the Backpack lists the new rainbow piece and the box row is gone (${JSON.stringify(card)})`);
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-testid="supplies-sheet"]', { state: 'detached' }).catch(() => {});
    const blay = await layout(page);
    check(blay.over <= 1, `${tag} no horizontal overflow in the Backpack (${blay.over}px)`);

    // ---- reduced motion: no running ring animation on a gear card
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await go(page, '#/student/aoi?tab=gear', '[data-testid="slot-charm"]');
    const anim = await page.evaluate(() => {
      const ring = document.querySelector('[data-testid="slot-charm"] .ui-gtile.is-ur > .ur-ring');
      return ring ? getComputedStyle(ring, '::before').animationName : 'none';
    });
    check(anim === 'none', `${tag} reduced motion: the gear ring holds still (${anim})`);
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    check(!errs.length, `${tag} no page errors${errs.length ? `: ${errs.slice(0, 3).join(' | ')}` : ''}`);
    await page.close();
  }
} catch (e) {
  fails.push(String(e?.stack || e));
  console.log(e);
} finally {
  await browser.close();
  await server.close();
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL UR GEAR CHECKS PASSED');
process.exit(fails.length ? 1 : 0);

// LR Awakening (docs/specs/LR_AWAKEN.md; was e2e/limit-break.mjs, GEAR_UPDATE.md §4.1, v0.1.66 audit D B1): the real
// piece sheets reach it. Seeds Aoi in five rainbow UR Geometry Set pieces at +12 and two spare UR +12 pieces (one in
// the Spirit Squad, one with No set), Nightglass Lenses and coins, then:
//   - her slot sheet (Equipment tab → slot): a UR +12 piece's primary button is ✦ Awaken; four of her pieces awaken
//     to LR there (Nightglass Bloom → "Awakened to LR!"), no Set LR / Blank LR choice;
//   - the Backpack's piece sheet: her fifth (worn) piece awakens there (the LR Set Form wakes); the Spirit Squad spare
//     awakens to LR, then "Unbind to Blank LR…" through its "for good" confirm leaves the set, free;
//   - the Nightglass Lens "Use" opens the piece picker, the No-set spare ready: it awakens straight to Blank LR;
//   - the LR tag reads "LR"; no Pin button while no pin can be had; a_lr_first / a_lr_form count; her battle stats carry
//     the LR Set Form; the Build Coach's Gear card shows its LR line.
// Phone (844x390), then PC (1280x720). Usage: node e2e/awaken-lr.mjs [--shots dir]   (screenshots: JPEG)
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const SHOTS = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser } = await launchChromium();
const fails = [];
const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); };
const T = 60000;
const SLOTS = ['charm', 'ribbon', 'shoes', 'hair', 'necklace'];

async function openGame(page) {
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
  const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 30000 }).catch(() => null);
  if (later) { await later.click({ force: true }); await page.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 15000 }).catch(() => {}); }
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: T });
  return page.evaluate(async (slots) => {
    const { store } = window.__sakura;
    const gear = await import('/src/systems/gear.js');
    const { createRng } = await import('/src/core/rng.js');
    const p = store.profile;
    p.currencies.coins = 50_000_000;
    p.items.lens_nightglass = 8;
    // a rainbow UR piece at +12 (its ▲ grown on the way, so the piece is canonical)
    const ur = (seed, slot, set) => {
      const g = gear.rollGear(createRng(seed), { slot, rarity: 'legendary', level: 10 });
      if (set) g.set = set;
      g.ur = 1;
      for (let l = 11; l <= 12; l++) if (l % 3 === 0 && g.subs.length) g.subs.reduce((m, x) => ((x.upgrades || 0) < (m.upgrades || 0) ? x : m), g.subs[0]).upgrades += 1;
      g.level = 12;
      if (set) g.name = gear.pieceName(g);
      gear.recomputeGear(g);
      return gear.addGear(p, g);
    };
    const worn = {};
    slots.forEach((slot, i) => { worn[slot] = ur(40 + i, slot, 'geometry'); gear.equipGear(p, 'aoi', worn[slot]); });
    const blank = ur(50, 'charm', 'spirit');
    const spare = ur(51, 'ribbon', null);
    p.missions.counters['ga:gift'] = 1;
    store.commit('test');
    store.saveNow?.();
    return { worn, blank, spare };
  }, SLOTS);
}

async function go(page, hash, selector) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForSelector(selector, { timeout: T });
  await page.waitForTimeout(300);
}
const tap = (page, sel) => page.locator(sel).first().click();
const lrOf = (page, uid) => page.evaluate((u) => window.__sakura.store.profile.gear[u]?.lr || 0, uid);

/** ✦ Awaken a UR +12 piece to LR from the open piece sheet: Nightglass Bloom, then the "Awakened to LR!" reveal. */
async function awakenLr(page, { fromModal = false } = {}) {
  if (!fromModal) await tap(page, '[data-testid="gear-lr-awaken"]');
  await page.waitForSelector('[data-testid="gear-lr-awaken-modal"]', { timeout: T });
  const kinds = await page.locator('[data-testid="limit-break-set"], [data-testid="limit-break-blank"]').count();
  await tap(page, '[data-testid="gear-lr-awaken-go"]');
  await page.waitForSelector('[data-testid="gear-lr-ascend"]', { timeout: T });
  const title = await page.locator('[data-testid="gear-lr-ascend"] .ur-ascend-title').innerText().catch(() => '');
  await tap(page, '[data-testid="gear-lr-ascend-ok"]');
  await page.waitForSelector('[data-testid="gear-lr-ascend"]', { state: 'detached', timeout: T });
  await page.waitForTimeout(300);
  return { kinds, title };
}

/** "Unbind to Blank LR…" from the open piece sheet, through its "for good" confirm. */
async function unbindLr(page) {
  await tap(page, '[data-testid="gear-unbind-lr"]');
  await page.waitForSelector('[data-testid="confirm-ok"]', { timeout: T });
  const text = await page.locator('.modal').last().innerText().catch(() => '');
  await tap(page, '[data-testid="confirm-ok"]');
  await page.waitForTimeout(400);
  return text;
}

async function closeSheets(page) {
  for (let i = 0; i < 4 && await page.locator('.modal-overlay, .sheet-overlay, [data-testid="gear-sheet"], [data-testid="gear-piece"]').count(); i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
}

for (const [W, H] of [[844, 390], [1280, 720]]) {
  const tag = `${W}x${H}`;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: W < 1000 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  const ids = await openGame(page);

  // ---- her slot sheet: ✦ Awaken is the primary; four pieces awaken to LR (no Set LR / Blank LR choice)
  for (const slot of SLOTS.slice(0, 4)) {
    await go(page, '#/student/aoi?tab=gear', `[data-testid="slot-${slot}"]`);
    await tap(page, `[data-testid="slot-${slot}"]`);
    await page.waitForSelector('[data-testid="gear-sheet"]', { timeout: T });
    const has = await page.locator('[data-testid="gear-sheet"] [data-testid="gear-lr-awaken"]').count();
    if (slot === 'charm') {
      check(has === 1, `${tag} slot sheet: a UR +12 piece shows ✦ Awaken`);
      check(await page.locator('[data-testid="gear-sheet"] [data-testid="gear-limit-break"]').count() === 0, `${tag} slot sheet: no Limit Break button any more`);
      check(await page.locator('[data-testid="gear-sheet"] [data-testid="gear-pin"]').count() === 0, `${tag} slot sheet: no Pin while no pin can be had`);
    }
    if (!has) break;
    const r = await awakenLr(page);
    if (slot === 'charm') {
      check(r.kinds === 0, `${tag} Nightglass Bloom offers no Set LR / Blank LR choice`);
      check(/Awakened to LR!/.test(r.title), `${tag} the reveal reads "Awakened to LR!" ("${r.title}")`);
    }
    check(await lrOf(page, ids.worn[slot]) === 1, `${tag} slot sheet: her ${slot} awakened to LR (of its set)`);
    if (slot === 'charm') {
      check(await page.locator('[data-testid="gear-sheet"] [data-testid="gear-lr-awaken"]').count() === 0, `${tag} slot sheet: an LR piece shows no ✦ Awaken`);
      check(await page.locator('[data-testid="gear-sheet"] [data-testid="gear-unbind-lr"]').count() === 1, `${tag} slot sheet: an LR set piece shows "Unbind to Blank LR…"`);
      const tagText = await page.locator('[data-testid="gear-sheet"] .ui-rtag').first().innerText().catch(() => '');
      check(/LR/.test(tagText) && !/UR/.test(tagText), `${tag} slot sheet: the piece's tag reads LR ("${tagText}")`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/lr-slot-${tag}.jpg`, type: 'jpeg', quality: 70 });
    }
    await closeSheets(page);
  }
  check(await page.evaluate(() => window.__sakura.store.profile.missions.counters['ach:lrEver'] || 0) === 4, `${tag} a_lr_first counts the awakenings`);

  // ---- the Backpack's piece sheet: her fifth piece (worn) awakens; the Spirit Squad spare awakens, then unbinds
  const openPiece = async (uid) => {
    await go(page, '#/backpack?tab=equipment', `.mb-gear[data-gear="${uid}"]`);
    await page.locator(`.mb-gear[data-gear="${uid}"]`).scrollIntoViewIfNeeded();
    await tap(page, `.mb-gear[data-gear="${uid}"]`);
    await page.waitForSelector('[data-testid="gear-piece"]', { timeout: T });
  };
  await openPiece(ids.worn.necklace);
  check(await page.locator('[data-testid="gear-lr-awaken"]').count() >= 1, `${tag} Backpack piece sheet: ✦ Awaken shows`);
  await awakenLr(page);
  check(await lrOf(page, ids.worn.necklace) === 1, `${tag} Backpack: her necklace awakened to LR`);
  await closeSheets(page);
  const form = await page.evaluate(async () => {
    const { store } = window.__sakura;
    const { unitBattleStats } = await import('/src/systems/progression.js');
    const s = unitBattleStats(store.profile, 'aoi');
    return { form: store.profile.missions.counters['ach:lrForm'] || 0, setLr: s.setLr, set: s.set, setN: s.setN };
  });
  check(form.form === 1, `${tag} a_lr_form: five LR pieces of one set wake the LR Set Form`);
  check(form.setLr === true && form.set === 'geometry' && form.setN === 5, `${tag} her battle stats carry the LR Set Form (${JSON.stringify(form)})`);

  await openPiece(ids.blank);
  const lensBefore = await page.evaluate(() => window.__sakura.store.profile.items.lens_nightglass);
  await awakenLr(page);
  check(await lrOf(page, ids.blank) === 1, `${tag} Backpack: the Spirit Squad spare awakened to LR, still in its set`);
  const coinsMid = await page.evaluate(() => window.__sakura.store.profile.currencies.coins);
  const confirmText = await unbindLr(page);
  check(/for good/.test(confirmText), `${tag} Unbind asks first, "for good" ("${confirmText.replace(/\s+/g, ' ').slice(0, 90)}…")`);
  const blank = await page.evaluate((u) => { const p = window.__sakura.store.profile; const g = p.gear[u]; return { lr: g.lr, set: g.set ?? null, lens: p.items.lens_nightglass, coins: p.currencies.coins }; }, ids.blank);
  check(blank.lr === 2 && blank.set === null, `${tag} Backpack: Unbind to Blank LR leaves the set (${JSON.stringify({ lr: blank.lr, set: blank.set })})`);
  check(blank.lens === lensBefore - 1 && blank.coins === coinsMid, `${tag} one Lens in all, unbinding is free (Lens ${lensBefore} → ${blank.lens})`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/lr-unbound-${tag}.jpg`, type: 'jpeg', quality: 70 });
  await closeSheets(page);

  // ---- the Nightglass Lens "Use" (the Backpack's item grid): the piece picker, the No-set spare ready → Blank LR
  await go(page, '#/backpack?tab=all', '[data-testid="use-lens_nightglass"]');
  await page.locator('[data-testid="use-lens_nightglass"]').scrollIntoViewIfNeeded();
  await tap(page, '[data-testid="use-lens_nightglass"]');
  await page.waitForSelector(`[data-testid="pick-${ids.spare}"]`, { timeout: T }).catch(() => {});
  check(await page.locator(`[data-testid="pick-${ids.spare}"]`).count() === 1, `${tag} the Nightglass Lens's Use lists the ready UR +12 spare`);
  await tap(page, `[data-testid="pick-${ids.spare}"]`);
  await page.waitForSelector('[data-testid="gear-lr-awaken-modal"]', { timeout: T }).catch(() => {});
  check(await page.locator('[data-testid="gear-lr-awaken-modal"][data-kind="blank"]').count() === 1, `${tag} choosing it opens Nightglass Bloom, into Blank LR (No set)`);
  const r = await awakenLr(page, { fromModal: true });
  check(await lrOf(page, ids.spare) === 2 && /Blank LR/.test(r.title), `${tag} the No-set spare awakened straight to Blank LR ("${r.title}")`);
  await closeSheets(page);

  // ---- the Build Coach's Gear card names the LR step
  await go(page, '#/student/aoi?tab=coach', '[data-testid="coach-tab"]');
  const coach = await page.locator('[data-testid="coach-lr"]').innerText().catch(() => '');
  check(/^LR:/.test(coach.trim()) && !/Limit Break|Set LR/.test(coach), `${tag} the Build Coach shows its LR line ("${coach.trim()}")`);

  check(errors.length === 0, `${tag} no page errors${errors.length ? ` (${errors[0]})` : ''}`);
  await ctx.close();
}

await browser.close();
await server.close();
console.log(fails.length ? `\n${fails.length} check(s) failed` : '\nall LR awakening checks passed');
process.exit(fails.length ? 1 : 0);

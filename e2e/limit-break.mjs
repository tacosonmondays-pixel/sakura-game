// Limit Break (docs/specs/GEAR_UPDATE.md §4.1; v0.1.66 audit D B1): the real piece sheets reach it. Seeds Aoi in five
// rainbow UR Geometry Set pieces at +12 and two spare UR +12 pieces, Nightglass Lenses and coins, then:
//   - her slot sheet (Equipment tab → slot) shows Limit Break; four of her pieces go Set LR there;
//   - the Backpack's piece sheet shows it too: her fifth (worn) piece goes Set LR there (the LR Set Form wakes), and a
//     spare goes Blank LR through its "for good" confirm;
//   - the Nightglass Lens "Use" opens the piece picker, the last spare ready;
//   - the LR tag reads "LR"; no Pin button while no pin can be had; a_lr_first / a_lr_form count; her battle stats carry
//     the LR Set Form; the Build Coach's Gear card shows its Limit Break line.
// Phone (844x390), then PC (1280x720). Usage: node e2e/limit-break.mjs [--shots dir]
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

/** Limit Break from the open piece sheet (`kind`: set | blank), through the Blank LR confirm. */
async function limitBreak(page, kind) {
  await tap(page, '[data-testid="gear-limit-break"]');
  await page.waitForSelector('[data-testid="limit-break-modal"]', { timeout: T });
  await tap(page, `[data-testid="limit-break-${kind}"]`);
  if (kind === 'blank') {
    await page.waitForSelector('[data-testid="confirm-ok"]', { timeout: T });
    await tap(page, '[data-testid="confirm-ok"]');
  }
  await page.waitForSelector('[data-testid="limit-break-modal"]', { state: 'detached', timeout: T });
  await page.waitForTimeout(300);
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

  // ---- her slot sheet: Limit Break is there; four pieces go Set LR
  for (const slot of SLOTS.slice(0, 4)) {
    await go(page, '#/student/aoi?tab=gear', `[data-testid="slot-${slot}"]`);
    await tap(page, `[data-testid="slot-${slot}"]`);
    await page.waitForSelector('[data-testid="gear-sheet"]', { timeout: T });
    const has = await page.locator('[data-testid="gear-sheet"] [data-testid="gear-limit-break"]').count();
    if (slot === 'charm') {
      check(has === 1, `${tag} slot sheet: a UR +12 piece shows Limit Break`);
      check(await page.locator('[data-testid="gear-sheet"] [data-testid="gear-pin"]').count() === 0, `${tag} slot sheet: no Pin while no pin can be had`);
    }
    if (!has) break;
    await limitBreak(page, 'set');
    check(await lrOf(page, ids.worn[slot]) === 1, `${tag} slot sheet: her ${slot} is Set LR`);
    if (slot === 'charm') {
      check(await page.locator('[data-testid="gear-sheet"] [data-testid="gear-limit-break"]').count() === 0, `${tag} slot sheet: an LR piece shows no Limit Break`);
      const tagText = await page.locator('[data-testid="gear-sheet"] .ui-rtag').first().innerText().catch(() => '');
      check(/LR/.test(tagText) && !/UR/.test(tagText), `${tag} slot sheet: the piece's tag reads LR ("${tagText}")`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/lb-slot-${tag}.png` });
    }
    await closeSheets(page);
  }
  check(await page.evaluate(() => window.__sakura.store.profile.missions.counters['ach:lrEver'] || 0) === 4, `${tag} a_lr_first counts the Limit Breaks`);

  // ---- the Backpack's piece sheet: her fifth piece (worn) goes Set LR, a spare goes Blank LR through its confirm
  const openPiece = async (uid) => {
    await go(page, '#/backpack?tab=equipment', `.mb-gear[data-gear="${uid}"]`);
    await page.locator(`.mb-gear[data-gear="${uid}"]`).scrollIntoViewIfNeeded();
    await tap(page, `.mb-gear[data-gear="${uid}"]`);
    await page.waitForSelector('[data-testid="gear-piece"]', { timeout: T });
  };
  await openPiece(ids.worn.necklace);
  check(await page.locator('[data-testid="gear-piece"] ~ * [data-testid="gear-limit-break"], [data-testid="gear-limit-break"]').count() >= 1, `${tag} Backpack piece sheet: Limit Break shows`);
  await limitBreak(page, 'set');
  check(await lrOf(page, ids.worn.necklace) === 1, `${tag} Backpack: her necklace is Set LR`);
  await closeSheets(page);
  const form = await page.evaluate(async () => {
    const { store } = window.__sakura;
    const { unitBattleStats } = await import('/src/systems/progression.js');
    const s = unitBattleStats(store.profile, 'aoi');
    return { form: store.profile.missions.counters['ach:lrForm'] || 0, setLr: s.setLr, set: s.set, setN: s.setN };
  });
  check(form.form === 1, `${tag} a_lr_form: five Set LR pieces of one set wake the LR Set Form`);
  check(form.setLr === true && form.set === 'geometry' && form.setN === 5, `${tag} her battle stats carry the LR Set Form (${JSON.stringify(form)})`);

  await openPiece(ids.blank);
  await limitBreak(page, 'blank');
  const blank = await page.evaluate((u) => { const g = window.__sakura.store.profile.gear[u]; return { lr: g.lr, set: g.set ?? null }; }, ids.blank);
  check(blank.lr === 2 && blank.set === null, `${tag} Backpack: Blank LR through its confirm leaves the set (${JSON.stringify(blank)})`);
  await closeSheets(page);

  // ---- the Nightglass Lens "Use" (the Backpack's item grid): the piece picker, the last spare ready
  await go(page, '#/backpack?tab=all', '[data-testid="use-lens_nightglass"]');
  await page.locator('[data-testid="use-lens_nightglass"]').scrollIntoViewIfNeeded();
  await tap(page, '[data-testid="use-lens_nightglass"]');
  await page.waitForSelector(`[data-testid="pick-${ids.spare}"]`, { timeout: T }).catch(() => {});
  check(await page.locator(`[data-testid="pick-${ids.spare}"]`).count() === 1, `${tag} the Nightglass Lens's Use lists the ready UR +12 spare`);
  await tap(page, `[data-testid="pick-${ids.spare}"]`);
  await page.waitForSelector('[data-testid="limit-break-modal"]', { timeout: T }).catch(() => {});
  check(await page.locator('[data-testid="limit-break-modal"]').count() === 1, `${tag} choosing it opens Limit Break`);
  await closeSheets(page);

  // ---- the Build Coach's Gear card names the Limit Break
  await go(page, '#/student/aoi?tab=coach', '[data-testid="coach-tab"]');
  check(await page.locator('[data-testid="coach-lr"]').count() === 1, `${tag} the Build Coach shows its Limit Break line`);

  check(errors.length === 0, `${tag} no page errors${errors.length ? ` (${errors[0]})` : ''}`);
  await ctx.close();
}

await browser.close();
await server.close();
console.log(fails.length ? `\n${fails.length} check(s) failed` : '\nall Limit Break checks passed');
process.exit(fails.length ? 1 : 0);

// Multi-salvage (owner: "Can you add multi salvage?"): Backpack → Equipment → Multi-salvage, at a
// phone and a PC size, with 20 generated pieces (one locked, one equipped). Protected pieces can't
// be picked, "Select all shown" follows the filters, hidden picks are dropped, the bar stays on
// screen while scrolling, Cancel changes nothing, Salvage pays exactly the preview.
// Usage: node e2e/multi-salvage.mjs [--shots dir]
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
try {
  for (const [W, H] of [[844, 390], [1280, 720]]) {
    const touch = W < 1000;
    const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    const tap = async (loc) => { await (touch ? loc.tap({ timeout: 15000 }) : loc.click({ timeout: 15000 })); await page.waitForTimeout(150); };
    const cards = () => page.locator('.mb-gear-grid .mb-gear');
    const picked = () => page.locator('.mb-gear-grid .mb-gear.selected').count();
    const barText = () => page.locator('[data-testid="salvage-count"]').innerText();
    await page.goto(`${base}#/lobby`, { waitUntil: 'load' });
    await page.evaluate(() => { localStorage.clear(); });
    await page.goto(`${base}#/lobby`, { waitUntil: 'load' });
    const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 15000 }).catch(() => null);
    if (later) { await later.click({ force: true }); await page.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 10000 }).catch(() => {}); }
    const seeded = await page.evaluate(async () => {
      const { store } = window.__sakura;
      const gear = await import('/src/systems/gear.js');
      const { createRng } = await import('/src/core/rng.js');
      const rng = createRng(11);
      const p = store.profile;
      for (const uid of Object.keys(p.gear)) delete p.gear[uid];
      const made = {};
      for (const r of ['common', 'rare', 'superRare', 'mythic', 'legendary']) {
        made[r] = [];
        for (let i = 0; i < 4; i++) made[r].push(gear.addGear(p, gear.rollGear(rng, { rarity: r, level: i * 2 })));
      }
      gear.setGearLocked(p, made.rare[0], true);
      const unit = Object.keys(p.units)[0];
      gear.equipGear(p, unit, made.common[0]);
      store.commit('test'); store.saveNow?.();
      return { locked: made.rare[0], worn: made.common[0], commons: made.common };
    });
    await page.evaluate(() => { location.hash = '#/backpack?tab=equipment'; });
    await page.waitForSelector('[data-testid="salvage-mode"]', { timeout: 15000 });
    check(await cards().count() === 20, `${W}x${H} 20 gear shown`);

    await tap(page.locator('[data-testid="salvage-mode"]'));
    check(await page.locator('[data-testid="salvage-bar"]').count() === 1 && await page.locator('[data-testid="salvage-tools"]').count() === 1, `${W}x${H} Multi-salvage shows the pick row and the bar`);
    check(/Nothing picked/.test(await barText()) && await page.locator('[data-testid="salvage-go"]').isDisabled(), `${W}x${H} nothing picked → Salvage disabled`);
    check(await page.locator('.mb-gear-grid .mb-gear.blocked').count() === 2, `${W}x${H} the locked and the equipped piece are dimmed`);

    // a protected piece can't be picked, and says why
    await tap(page.locator(`.mb-gear[data-gear="${seeded.locked}"]`));
    const toastText = await page.locator('.toast').last().innerText().catch(() => '');
    check(await picked() === 0 && /Locked gear is protected/.test(toastText), `${W}x${H} tapping locked gear: not picked, toast "${toastText}"`);
    await tap(page.locator(`.mb-gear[data-gear="${seeded.worn}"]`));
    check(await picked() === 0, `${W}x${H} tapping equipped gear: not picked`);
    check(await page.locator('.modal').count() === 0, `${W}x${H} picking never opens the gear popup`);

    // phone: scroll into the middle of the list, pick there, and the bar is still on screen
    await page.evaluate(() => { const b = document.querySelector('.screen-body'); b.scrollTop = b.scrollHeight / 2; });
    await page.waitForTimeout(200);
    const scrolled = await page.evaluate(() => document.querySelector('.screen-body').scrollTop);
    const mid = page.locator('.mb-gear-grid .mb-gear:not(.blocked)').nth(8);
    await mid.scrollIntoViewIfNeeded();
    await tap(mid);
    const keptScroll = await page.evaluate(() => document.querySelector('.screen-body').scrollTop);
    check(await picked() === 1 && /1 picked/.test(await barText()), `${W}x${H} tap picks one ("${await barText()}")`);
    check(Math.abs(keptScroll - scrolled) < H, `${W}x${H} picking does not jump the list (scroll ${scrolled} → ${keptScroll})`);
    const barBox = await page.locator('[data-testid="salvage-bar"]').boundingBox();
    check(barBox && barBox.y >= 0 && barBox.y + barBox.height <= H + 1, `${W}x${H} the bar is on screen while scrolled (y ${barBox && Math.round(barBox.y)}..${barBox && Math.round(barBox.y + barBox.height)})`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/pick-scrolled-${W}x${H}.png` });
    await tap(mid);
    check(await picked() === 0, `${W}x${H} tap again un-picks`);

    // filters: Common only → Select all shown picks the 3 free commons (the worn one is skipped)
    await tap(page.locator('.mb-chips-rarity .mb-chip', { hasText: 'Common' }).first());
    check(await cards().count() === 4, `${W}x${H} Common filter → 4 shown`);
    await tap(page.locator('[data-testid="salvage-select-all"]'));
    check(await picked() === 3 && /3 picked/.test(await barText()), `${W}x${H} Select all shown → 3 picked ("${await barText()}")`);
    check(/Clear picks/.test(await page.locator('[data-testid="salvage-select-all"]').innerText()), `${W}x${H} the button turns into Clear picks`);
    const pickedUids = await page.locator('.mb-gear-grid .mb-gear.selected').evaluateAll((els) => els.map((e) => e.dataset.gear));
    const preview = await page.evaluate(async (uids) => {
      const s = await import('/src/systems/salvage.js');
      return s.salvagePreview(window.__sakura.store.profile, uids);
    }, pickedUids);
    const coinChip = await page.locator('.mb-sv-reward').first().innerText();
    check(coinChip.replace(/\D/g, '') === String(preview.rewards[0].count), `${W}x${H} bar shows the merged coins (${coinChip} vs ${preview.rewards[0].count})`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/pick-commons-${W}x${H}.png` });

    // a filter change drops picks that are no longer shown
    await tap(page.locator('.mb-chips-rarity .mb-chip', { hasText: 'Rare' }).first());
    check(await picked() === 0 && /Nothing picked/.test(await barText()), `${W}x${H} switching to Rare drops the hidden Common picks`);
    await tap(page.locator('.mb-chips-rarity .mb-chip', { hasText: 'Common' }).first());
    await tap(page.locator('[data-testid="salvage-select-all"]'));

    // Cancel changes nothing
    const before = await page.evaluate(() => ({ n: Object.keys(window.__sakura.store.profile.gear).length, coins: window.__sakura.store.profile.currencies.coins }));
    await tap(page.locator('[data-testid="salvage-go"]'));
    await page.waitForSelector('[data-testid="confirm-ok"]', { timeout: 5000 });
    const warn = await page.locator('[data-testid="salvage-warn"]').count();
    check(warn === (preview.precious.length ? 1 : 0), `${W}x${H} warning for enhanced / Mythic+ pieces (${preview.precious.length} precious, warn ${warn})`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/confirm-${W}x${H}.png` });
    await tap(page.locator('[data-testid="confirm-cancel"]'));
    await page.waitForTimeout(250);
    const afterCancel = await page.evaluate(() => ({ n: Object.keys(window.__sakura.store.profile.gear).length, coins: window.__sakura.store.profile.currencies.coins }));
    check(afterCancel.n === before.n && afterCancel.coins === before.coins && await picked() === 3, `${W}x${H} Cancel keeps the gear, the coins and the picks`);

    // Salvage
    await tap(page.locator('[data-testid="salvage-go"]'));
    await tap(page.locator('[data-testid="confirm-ok"]'));
    await page.waitForTimeout(300);
    const after = await page.evaluate((uids) => {
      const p = window.__sakura.store.profile;
      return { n: Object.keys(p.gear).length, coins: p.currencies.coins, gone: uids.every((u) => !p.gear[u]) };
    }, pickedUids);
    check(after.gone && after.n === before.n - 3, `${W}x${H} the 3 picked pieces are gone (${before.n} → ${after.n})`);
    check(after.coins - before.coins === preview.rewards[0].count, `${W}x${H} paid exactly the preview (+${after.coins - before.coins} coins)`);
    const doneToast = await page.locator('.toast').last().innerText().catch(() => '');
    check(/Salvaged 3 pieces/.test(doneToast), `${W}x${H} toast "${doneToast}"`);
    check(await cards().count() === 1 && /Nothing picked/.test(await barText()), `${W}x${H} list redrawn: only the worn Common left, still picking`);
    const saved = await page.evaluate(async (uid) => {
      window.__sakura.store.saveNow?.();
      const raw = Object.keys(localStorage).map((k) => localStorage.getItem(k)).join('');
      return !raw.includes(uid);
    }, pickedUids[0]);
    check(saved, `${W}x${H} the save no longer has the salvaged gear`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-${W}x${H}.png` });

    // Done → a tap opens the gear popup again
    await tap(page.locator('[data-testid="salvage-mode"]'));
    check(await page.locator('[data-testid="salvage-bar"]').count() === 0, `${W}x${H} Done leaves pick mode`);
    await tap(cards().first());
    check(await page.locator('.modal-title', { hasText: 'Gear' }).count() === 1, `${W}x${H} after Done, a tap opens the gear popup`);
    check(errs.length === 0, `${W}x${H} no page errors${errs.length ? `: ${errs.slice(0, 3).join(' | ')}` : ''}`);
    await page.close();
  }
} catch (e) {
  fails.push(`crashed: ${e.stack || e}`);
  console.log(e);
} finally {
  await browser.close().catch(() => {});
  await server.close();
}
console.log(fails.length ? `\n${fails.length} CHECK(S) FAILED` : '\nALL MULTI-SALVAGE CHECKS PASSED');
process.exit(fails.length ? 1 : 0);

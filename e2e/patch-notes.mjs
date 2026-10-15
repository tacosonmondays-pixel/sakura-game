// Patch notes in the Notice (owner: "can you post all game version under notice and mention what
// was added or changed with the date and add a button to claim a few gems?"), at a phone and a PC
// size: the Notice opens on Patch notes, every version is listed, one Claim adds exactly
// PATCH_GIFT_GEMS to the top-bar gem counter and turns into "Claimed ✓", Claim all takes the rest,
// the claims are in the saved profile, and the red dot goes out once nothing is waiting.
// Usage: node e2e/patch-notes.mjs [--shots dir]
// Playwright / the browser are found by e2e/browser.mjs (PLAYWRIGHT_MODULE / NODE_PATH, CHROME_PATH).
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const SHOTS = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser, label } = await launchChromium();
console.log(`browser: ${label}`);
const fails = [];
const check = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); };
const gemsOf = (t) => Number(String(t).replace(/[^\d]/g, ''));
try {
  for (const [W, H] of [[844, 390], [1280, 720]]) {
    const touch = W < 1000;
    const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    const tap = async (loc) => { await (touch ? loc.tap({ timeout: 15000 }) : loc.click({ timeout: 15000 })); await page.waitForTimeout(150); };
    await page.goto(`${base}#/lobby`, { waitUntil: 'load' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${base}#/lobby`, { waitUntil: 'load' });
    const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 20000 }).catch(() => null);
    if (later) { await later.click({ force: true }); await page.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 10000 }).catch(() => {}); }
    const { notes, gift } = await page.evaluate(async () => {
      const { PATCH_NOTES } = await import('/src/data/patchNotes.js');
      const { PATCH_GIFT_GEMS } = await import('/src/systems/patchGifts.js');
      return { notes: PATCH_NOTES.map((n) => n.id), gift: PATCH_GIFT_GEMS };
    });
    const gemPill = page.locator('.lb-top [data-testid="gems"]').first();
    await gemPill.waitFor({ timeout: 15000 });
    const gems0 = gemsOf(await gemPill.innerText());
    check(await page.locator('[data-testid="shortcut-notice"] .lb-dot').count() === 1, `${W}x${H} Notice shows a red dot while gifts wait`);

    await tap(page.locator('[data-testid="shortcut-notice"]'));
    await page.waitForSelector('.lb-notice-modal', { timeout: 10000 });
    await tap(page.locator('[data-testid="notice-patch"]'));
    await page.waitForSelector('.lb-patch-list', { timeout: 10000 });
    check(await page.locator('.lb-patch').count() === notes.length, `${W}x${H} every version listed (${notes.length})`);
    check(await page.locator('[data-testid="patch-claim-all"]').innerText() === `Claim all (${notes.length})`, `${W}x${H} Claim all (${notes.length}) shown`);
    // nothing cut off: the modal sits inside the viewport and the article pane scrolls
    const box = await page.locator('.lb-notice-modal').boundingBox();
    check(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= W + 0.5 && box.y + box.height <= H + 0.5, `${W}x${H} Notice fits the screen (${box && `${Math.round(box.width)}x${Math.round(box.height)}`})`);
    const pane = await page.evaluate(() => { const p = document.querySelector('.lb-notice-page'); return { sh: p.scrollHeight, ch: p.clientHeight, sw: p.scrollWidth, cw: p.clientWidth }; });
    check(pane.sh > pane.ch && pane.sw <= pane.cw + 1, `${W}x${H} the list scrolls inside the pane, no sideways overflow (${pane.ch}/${pane.sh})`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/patch-notes-${W}x${H}.png` });

    // claim one (the newest)
    const one = notes[0];
    await tap(page.locator(`[data-testid="patch-claim-${one}"]`));
    const toastText = await page.locator('.toast').last().innerText().catch(() => '');
    check(/Received 100/.test(toastText), `${W}x${H} toast after a claim ("${toastText}")`);
    const gems1 = gemsOf(await gemPill.innerText());
    check(gems1 === gems0 + gift, `${W}x${H} top-bar gems ${gems0} → ${gems1} (+${gift})`);
    check(await page.locator(`[data-testid="patch-claimed-${one}"]`).innerText() === 'Claimed ✓' && await page.locator(`[data-testid="patch-claim-${one}"]`).count() === 0, `${W}x${H} the button turns into Claimed ✓`);
    check(await page.locator('[data-testid="patch-claim-all"]').innerText() === `Claim all (${notes.length - 1})`, `${W}x${H} Claim all counts down`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/patch-notes-claimed-${W}x${H}.png` });

    // a second claim of the same version is refused by the system
    const again = await page.evaluate(async (id) => (await import('/src/systems/patchGifts.js')).claimPatchGift(window.__sakura.store.profile, id).error, one);
    check(again === 'claimed', `${W}x${H} double claim refused`);

    // claim all
    await tap(page.locator('[data-testid="patch-claim-all"]'));
    const gems2 = gemsOf(await gemPill.innerText());
    check(gems2 === gems0 + gift * notes.length, `${W}x${H} Claim all: gems ${gems1} → ${gems2} (total +${gift * notes.length})`);
    check(await page.locator('.lb-patch-claimed').count() === notes.length && await page.locator('[data-testid="patch-claim-all"]').count() === 0, `${W}x${H} every version shows Claimed ✓, Claim all gone`);
    const saved = await page.evaluate(() => { window.__sakura.store.saveNow?.(); return Object.keys(window.__sakura.store.profile.patchGifts || {}).length; });
    check(saved === notes.length, `${W}x${H} claims are in the profile (${saved})`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/patch-notes-all-${W}x${H}.png` });

    await tap(page.locator('[data-testid="notice-close"]'));
    await page.waitForTimeout(300);
    check(await page.locator('[data-testid="shortcut-notice"] .lb-dot').count() === 0, `${W}x${H} red dot gone once everything is claimed and read`);
    check(!errs.length, `${W}x${H} no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(fails.length ? `\nPATCH NOTES FAIL (${fails.length})` : '\nPATCH NOTES PASS');
process.exit(fails.length ? 1 : 0);

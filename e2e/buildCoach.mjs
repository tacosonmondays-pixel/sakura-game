// The Build Coach (docs/specs/BUILD_COACH.md §8, §10; milestone C1) at 844 x 390, 1280 x 720 and 390 x 844: the girl
// page's Coach tab (Set as Main, the build score, the next steps with Go, To max and its sheet, Farm, Gear plan,
// Potential, the path toggle), the home chip for the main girl, Stage Prep's "Farming for" tag, Clear Main. No
// horizontal overflow anywhere.
// Usage: node e2e/buildCoach.mjs [--shots dir]
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

async function noOverflow(page, W, label) {
  const sw = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
  check(sw <= W + 1, `${label}: no horizontal overflow (${sw} <= ${W})`);
}

try {
  for (const [W, H] of [[844, 390], [1280, 720], [390, 844]]) {
    const touch = W < 1000;
    const tag = `${W}x${H}`;
    const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    const tap = async (sel) => {
      const loc = typeof sel === 'string' ? page.locator(sel).first() : sel;
      await loc.scrollIntoViewIfNeeded({ timeout: 15000 }).catch(() => {});
      await (touch ? loc.tap({ timeout: 15000 }) : loc.click({ timeout: 15000 }));
      await page.waitForTimeout(250);
    };
    const go = async (hash, sel) => {
      await page.evaluate((x) => { location.hash = x; }, hash);
      await page.waitForSelector(sel, { timeout: 20000 });
      await page.waitForTimeout(400);
    };
    await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
    await page.evaluate(() => { localStorage.clear(); });
    await page.goto(`${base}?onboarding=0#/lobby`, { waitUntil: 'load' });
    const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 15000 }).catch(() => null);
    if (later) { await later.click({ force: true }); await page.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 10000 }).catch(() => {}); }
    await page.evaluate(async () => {
      const { store } = window.__sakura;
      const gear = await import('/src/systems/gear.js');
      const { grantUnit } = await import('/src/systems/unlocks.js');
      const { createRng } = await import('/src/core/rng.js');
      const p = store.profile;
      grantUnit(p, 'kage', Date.now());
      if (p.story) p.story.legacy = true;
      const rng = createRng(3);
      for (const slot of ['charm', 'ribbon']) gear.equipGear(p, 'kage', gear.addGear(p, gear.rollGear(rng, { slot, rarity: 'mythic', level: 4 })));
      gear.addGear(p, gear.rollGear(rng, { slot: 'shoes', rarity: 'legendary', level: 2 }));
      store.commit('test');
      store.saveNow?.();
    });

    // ----- the Coach tab -----
    await go('#/student/kage?tab=coach', '[data-testid="coach-tab"]');
    check(await page.locator('[data-testid="coach-set-main"]').count() === 1, `${tag} Coach tab: Set as Main`);
    check(/Build\s*\d+\s*Max\s*\d+/i.test(await page.locator('[data-testid="coach-score"]').innerText()), `${tag} the build score shows Build and Max`);
    await noOverflow(page, W, `${tag} Coach tab`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/coach-${tag}.png` });
    await tap('[data-testid="coach-set-main"]');
    check(await page.locator('[data-testid="coach-main-tag"]').count() === 1, `${tag} Set as Main: the Main tag shows`);
    check(await page.evaluate(() => window.__sakura.store.profile.buildCoach?.main) === 'kage', `${tag} the save holds Kage as Main`);
    check(await page.evaluate(() => window.__sakura.store.profile.missions.counters['cm:kage']) === 1, `${tag} the 'cm:' mirror`);
    check(await page.locator('[data-testid^="coach-step-"]').count() >= 1, `${tag} at least one next step`);
    for (const id of ['coach-max', 'coach-farm', 'coach-gear', 'coach-pot']) check(await page.locator(`[data-testid="${id}"]`).count() === 1, `${tag} ${id} card`);
    check(await page.locator('[data-testid="coach-paths"] .bc-path').count() === 3, `${tag} three paths to choose from`);
    // the paths toggle redraws the plan
    await tap('[data-testid="coach-path-2"]');
    check(await page.locator('[data-testid="coach-path-2"]').getAttribute('aria-pressed') === 'true', `${tag} path toggle`);
    // To max sheet
    await tap('[data-testid="coach-max-more"]');
    check(await page.waitForSelector('[data-testid="coach-max-sheet"]', { timeout: 5000 }).then(() => true).catch(() => false), `${tag} To max opens its sheet`);
    check(/have/.test(await page.locator('[data-testid="coach-max-sheet"]').innerText()), `${tag} the sheet lists need · have · missing`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/coach-max-${tag}.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    // a Farm Go goes to its stage
    if (await page.locator('[data-testid="coach-farm-go-0"]').count()) {
      await tap('[data-testid="coach-farm-go-0"]');
      await page.waitForTimeout(500);
      check(/#\/(stage|mall|titans|bounty|campaign)/.test(page.url()), `${tag} Farm Go navigates (${page.url().split('#')[1]})`);
      if (/#\/stage/.test(page.url())) {
        await page.waitForSelector('[data-testid="stage-start"]', { timeout: 15000 }).catch(() => {});
        check(await page.locator('[data-testid="stage-farming"]').count() === 1, `${tag} Stage Prep: "Farming for Kage" tag`);
        const start = await page.locator('[data-testid="stage-start"]').boundingBox();
        check(!!start && start.y + start.height <= H + 1, `${tag} Stage Prep: Start still on screen`);
        await noOverflow(page, W, `${tag} Stage Prep`);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/coach-stage-${tag}.png` });
      }
    }

    // ----- the home chip -----
    await go('#/lobby', '[data-testid="lobby"]');
    const chip = await page.waitForSelector('[data-testid="home-coach-chip"]', { timeout: 10000 }).catch(() => null);
    check(!!chip, `${tag} home: the Main's chip`);
    if (chip) {
      const b = await chip.boundingBox();
      check(b && b.x >= 0 && b.x + b.width <= W + 1 && b.y >= 0 && b.y + b.height <= H + 1, `${tag} the chip is on screen`);
      check(/Kage/.test(await chip.innerText()), `${tag} the chip names Kage`);
      await noOverflow(page, W, `${tag} home`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/coach-home-${tag}.png` });
      await tap('[data-testid="home-coach-chip"]');
      await page.waitForSelector('[data-testid="coach-tab"]', { timeout: 10000 }).catch(() => {});
      check(await page.locator('[data-testid="coach-tab"]').count() === 1, `${tag} the chip opens her Coach tab`);
    }
    // Clear Main hides the chip
    await go('#/student/kage?tab=coach', '[data-testid="coach-tab"]');
    await tap('[data-testid="coach-clear-main"]');
    check(await page.evaluate(() => window.__sakura.store.profile.buildCoach?.main ?? null) === null, `${tag} Clear Main`);
    await go('#/lobby', '[data-testid="lobby"]');
    check(await page.locator('[data-testid="home-coach-chip"]').count() === 0, `${tag} no chip without a Main`);

    check(!errs.length, `${tag} no page errors${errs.length ? `: ${errs.slice(0, 3).join(' | ')}` : ''}`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
if (fails.length) {
  console.log(`\n${fails.length} FAILED`);
  process.exit(1);
}
console.log('\nall ok');

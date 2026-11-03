// The Build Coach (docs/specs/BUILD_COACH.md §8, §10; milestone C1) at 844 x 390, 1280 x 720 and 390 x 844: the girl
// page's Coach tab (Set as Main, the build score, the next steps with Go, To max and its sheet, Farm, Gear plan,
// Potential, the path toggle), the Main's page in the home's news chip, Stage Prep's "Farming for" tag, Clear Main. No
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
      grantUnit(p, 'miko', Date.now());
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
    // a Farm stage row's Go opens Stage Prep at its difficulty, which carries the "Farming for" tag (review r2 L2:
    // a stage row is picked on purpose, and its absence fails)
    await tap('[data-testid="coach-farm-more"]');
    await page.waitForSelector('[data-testid="coach-farm-sheet"]', { timeout: 5000 }).catch(() => {});
    const stageGo = page.locator('[data-testid="coach-farm-sheet"] .bc-go[data-route="stage"]').first();
    check(await stageGo.count() === 1, `${tag} the Farm sheet has a stage row with Go`);
    if (await stageGo.count()) {
      await tap(stageGo);
      await page.waitForSelector('[data-testid="stage-start"]', { timeout: 15000 }).catch(() => {});
      check(/#\/stage/.test(page.url()), `${tag} Farm Go opens Stage Prep (${page.url().split('#')[1]})`);
      check(/difficulty=/.test(page.url()), `${tag} Farm Go names the difficulty`);
      check(await page.locator('[data-testid="stage-farming"]').count() === 1, `${tag} Stage Prep: "Farming for Kage" tag`);
      const start = await page.locator('[data-testid="stage-start"]').boundingBox();
      check(!!start && start.y + start.height <= H + 1, `${tag} Stage Prep: Start still on screen`);
      await noOverflow(page, W, `${tag} Stage Prep`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/coach-stage-${tag}.png` });
    }

    // an aura girl's damage path says why it follows her role (Miko, Purification: path 1)
    await go('#/student/miko?tab=coach', '[data-testid="coach-tab"]');
    await tap('[data-testid="coach-path-1"]');
    const mikoNote = await page.locator('[data-testid="coach-basis"]').innerText();
    // (review r3 L1: the note names her own unused lines: Miko's include Attack Speed)
    check(/turn into her aura/.test(mikoNote) && /Attack Speed/.test(mikoNote), `${tag} Miko's Purification: the aura note names her lines ("${mikoNote.slice(0, 60)}…")`);
    check(/Aura Power/.test(await page.locator('[data-testid="coach-gear"]').innerText()), `${tag} Miko's Purification: an aura plan`);
    // Umeko's note names hers (Crit Rate, not Attack Speed)
    await page.evaluate(async () => { const { grantUnit } = await import('/src/systems/unlocks.js'); grantUnit(window.__sakura.store.profile, 'umeko', Date.now()); window.__sakura.store.commit('test'); });
    await go('#/student/umeko?tab=coach', '[data-testid="coach-tab"]');
    await tap('[data-testid="coach-path-2"]');
    const umeNote = await page.locator('[data-testid="coach-basis"]').innerText();
    check(/Crit Rate/.test(umeNote) && !/Attack Speed/.test(umeNote), `${tag} Umeko's Undertow Ripples: the note names her own lines`);

    // ----- the home: her next step is a page of the news chip (no new element) -----
    await go('#/lobby', '[data-testid="lobby"]');
    await page.waitForSelector('[data-testid="lobby-news"]', { timeout: 10000 }).catch(() => {});
    let found = false;
    for (let k = 0; k < 4 && !found; k++) {
      if (await page.locator('[data-testid="lobby-news"][data-page="coach"]').count()) { found = true; break; }
      if (!(await page.locator('[data-testid="lobby-news-next"]').count())) break;
      await tap('[data-testid="lobby-news-next"]');
      await page.waitForTimeout(400);
    }
    check(found, `${tag} home: the news chip has the Main's page`);
    check(await page.locator('.bc-home-chip').count() === 0, `${tag} home: no new element`);
    if (found) {
      const card = page.locator('[data-testid="lobby-news-coach"]');
      check(/Kage/.test(await card.getAttribute('aria-label')), `${tag} the page names Kage`);
      const b = await page.locator('[data-testid="lobby-news"]').boundingBox();
      check(b && b.x >= 0 && b.x + b.width <= W + 1, `${tag} the news chip fits`);
      await noOverflow(page, W, `${tag} home`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/coach-home-${tag}.png` });
      await tap('[data-testid="lobby-news-coach"]');
      await page.waitForSelector('[data-testid="coach-tab"]', { timeout: 10000 }).catch(() => {});
      check(await page.locator('[data-testid="coach-tab"]').count() === 1, `${tag} the page opens her Coach tab`);
    }
    // Clear Main takes the page away
    await go('#/student/kage?tab=coach', '[data-testid="coach-tab"]');
    await tap('[data-testid="coach-clear-main"]');
    check(await page.evaluate(() => window.__sakura.store.profile.buildCoach?.main ?? null) === null, `${tag} Clear Main`);
    await go('#/lobby', '[data-testid="lobby"]');
    check(await page.locator('[data-testid="lobby-news"][data-page="coach"], [data-testid="lobby-news-coach"]').count() === 0, `${tag} no coach page without a Main`);

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

// Ascension (docs/specs/ASCENSION.md §H.3), phone (844×390 touch) and PC (1280×720):
//   1. a duplicate → Essence → Raise Potential (an SSR Select Ticket on an owned SSR, then her Info tab)
//   2. break a level gate past 60 (gate 6 at P2: cap 60 → 63)
//   3. Titan Trials: the hub, a target chip, Fight (a Trial Key) → the battle → a Victory → the
//      result sheet (Victory Chest, first clear) → back to the hub (best tier, keys)
//   4. the weekly rewards: a sweep, the Titan shelf and the Memento Exchange, the Craft Room
// No horizontal scroll on any of these screens.
// Usage: node e2e/ascension.mjs [--shots dir]
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
  // a late-game save: the campaign up to 8-5, Kaede owned, Aoi at gate 5 L60, a strong formation
  await page.evaluate(async () => {
    const { store } = window.__sakura;
    const unlocks = await import('/src/systems/unlocks.js');
    const inv = await import('/src/systems/inventory.js');
    const stages = await import('/src/data/stages.js');
    const p = store.profile;
    for (const id of stages.CAMPAIGN_IDS) p.progress.stages[id] = { easy: true, normal: true, hard: true, nightmare: false, clears: 1 };
    for (const id of ['kaede', 'kage', 'shiro', 'akane', 'luna']) if (!p.units[id]) unlocks.grantUnit(p, id);
    for (const id of Object.keys(p.units)) Object.assign(p.units[id], { level: 60, breakthrough: 5, awaken: 5 });
    p.formation = { hero: 'hikari', towers: ['kage', 'shiro', 'akane', 'aoi', 'kaede', 'rei'] };
    p.currencies.coins = 50_000_000;
    p.currencies.gems = 10000;
    inv.addItems(p, [
      { id: 'ticket_ssr_select', count: 1 }, { id: 'mat_feather_mythic', count: 30 }, { id: 'mat_feather_legendary', count: 20 },
      { id: 'token_boss', count: 500 }, { id: 'memento', count: 200 }, { id: 'moonpearl', count: 200 },
    ]);
    p.story && Object.assign(p.story, { opening: 'done', tutorial: 'done', welcome: 'done' });
    store.commit('test');
    store.saveNow?.();
  });
}

async function go(page, hash, selector) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForSelector(selector, { timeout: T });
  await page.waitForTimeout(400);
}

async function shot(page, name) {
  if (!SHOTS) return;
  for (let i = 0; i < 2; i++) {
    try {
      await page.screenshot({ path: `${SHOTS}/${name}.png`, timeout: 150000 });
      return;
    } catch (e) {
      if (i) console.log(`  warn screenshot ${name} skipped: ${String(e.message).split('\n')[0]}`);
    }
  }
}

const noHScroll = (page) => page.evaluate(() => {
  const el = document.querySelector('.screen-body') || document.scrollingElement;
  return el.scrollWidth <= el.clientWidth + 1 && document.scrollingElement.scrollWidth <= window.innerWidth + 1;
});
const prof = (page, fn) => page.evaluate(fn);
/** Close every open window (a reward sheet, a purchase result) by tapping its backdrop. */
async function closeModals(page) {
  for (let i = 0; i < 4; i++) {
    const n = await page.evaluate(() => {
      const o = [...document.querySelectorAll('.modal-overlay:not(.closing)')];
      o.forEach((x) => x.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      return o.length;
    });
    if (!n) return;
    await page.waitForTimeout(250);
  }
}

try {
  for (const [W, H] of [[844, 390], [1280, 720]]) {
    const tag = `${W}x${H}`;
    const touch = W < 1000;
    const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch });
    page.setDefaultTimeout(T);
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await openGame(page);

    // ---- 1. a duplicate → Essence → Potential ------------------------------------------------
    await go(page, '#/backpack?tab=tickets', '[data-item="ticket_ssr_select"]');
    await page.click('[data-item="ticket_ssr_select"]');
    await page.click('[data-testid="item-use"]');
    await page.click('[data-testid="sst-kaede"]');
    await page.click('[data-testid="confirm-ok"]');
    const joined = await page.waitForSelector('[data-testid="sst-joined-text"]');
    const jt = await joined.textContent();
    check(/Essence \+1/.test(jt) && /P2 ready/.test(jt), `${tag} a duplicate gives Essence: "${jt}"`);
    await page.click('[data-testid="sst-ok"]');
    const ess = await prof(page, async () => {
      const e = await import('/src/systems/essence.js');
      const p = window.__sakura.store.profile;
      return { held: e.essenceBalance(p, 'kaede'), pl: p.units.kaede.pl || 1, frag: p.items.star_fragment || 0 };
    });
    check(ess.held === 1 && ess.pl === 1 && ess.frag === 0, `${tag} Kaede holds 1 Essence, still P1, no Star Fragments (${JSON.stringify(ess)})`);
    await go(page, '#/student/kaede?tab=info&focus=potential', '[data-testid="potential-raise"]');
    await page.evaluate(() => document.querySelector('[data-testid="potential-raise"]')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    await shot(page, `${tag}-1-raise-potential`);
    const raiseLabel = await page.textContent('[data-testid="potential-raise-btn"]');
    check(/Raise to P2 · 1 Essence \+ 10,000 coins/.test(raiseLabel), `${tag} the button reads "${raiseLabel.trim()}"`);
    await page.click('[data-testid="potential-raise-btn"]');
    await page.waitForFunction(() => window.__sakura.store.profile.units.kaede.pl === 2);
    const title = await page.textContent('[data-testid="potential-section"] .mb-card-title');
    check(/P2 \/ 6/.test(title), `${tag} Raise Potential: Kaede is P2 (${title.trim()})`);
    check(await noHScroll(page), `${tag} her page: no horizontal scroll`);

    // ---- 2. break gate 6 (P2: cap 60 → 63) ----------------------------------------------------
    await prof(page, () => {
      const p = window.__sakura.store.profile;
      Object.assign(p.units.kage, { pl: 2, level: 60, breakthrough: 5 });
      window.__sakura.store.commit('test');
    });
    await go(page, '#/student/kage?tab=level', '[data-testid="gate-card"]');
    await page.evaluate(() => document.querySelector('[data-testid="gate-card"]')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    await shot(page, `${tag}-2-gate-card`);
    const gateTitle = await page.textContent('[data-testid="gate-card"] .mb-card-title');
    check(/Gate 6 · Level cap 60 → 63/.test(gateTitle), `${tag} the gate card reads "${gateTitle.trim()}"`);
    await page.click('[data-testid="breakthrough"]');
    await page.waitForFunction(() => window.__sakura.store.profile.units.kage.breakthrough === 6);
    const cap = await page.textContent('[data-testid="level-cap"]');
    check(/Cap 63/.test(cap), `${tag} gate 6 broken: ${cap.trim()}`);
    // gate 7 needs P3: the card says so
    const lock = await page.textContent('[data-testid="gate-lock"]').catch(() => '');
    check(/Opens at P3/.test(lock), `${tag} gate 7 waits on P3: "${lock.trim()}"`);
    check(await noHScroll(page), `${tag} level tab: no horizontal scroll`);

    // ---- 3. Titan Trials: hub → Fight → Victory → result -----------------------------------------
    await go(page, '#/missions', '[data-testid="hub-titans"]');
    await shot(page, `${tag}-3a-missions-hub`);
    await page.click('[data-testid="hub-titans"]');
    await page.waitForSelector('[data-testid="titan-wyrm"]');
    await page.click('[data-testid="titan-wyrm"]');
    await page.waitForSelector('[data-testid="titan-target-feather"]');
    await page.click('[data-testid="titan-target-feather"]');
    await page.click('[data-testid="titan-tier-normal"]');
    await page.waitForTimeout(300);
    await shot(page, `${tag}-3b-titan-hub`);
    check(await noHScroll(page), `${tag} titan hub: no horizontal scroll`);
    const keysBefore = await prof(page, async () => (await import('/src/systems/titans.js')).refreshKeys(window.__sakura.store.profile));
    check(keysBefore === 12, `${tag} 12 Trial Keys this week (${keysBefore})`);
    const hp = await page.textContent('[data-testid="titan-hp"]');
    check(/HP 1\.2M/.test(hp), `${tag} Eclipse Wyrm Normal: ${hp.trim()}`);
    await page.click('[data-testid="titan-fight"]');
    await page.waitForFunction(() => window.__battle?.sim?.stage?.titan?.id === 'wyrm', null, { timeout: 120000 });
    await page.waitForTimeout(1200);
    await shot(page, `${tag}-3c-titan-battle`);
    // play it out fast: the test drives the waves and lands the final blows through the sim
    await page.evaluate(async () => {
      const { sim } = window.__battle;
      const seen = new Set();
      for (let guard = 0; guard < 3000 && sim.state !== 'won' && sim.state !== 'lost'; guard++) {
        sim.lives = 1e6;
        if (sim.state === 'prep' || sim.state === 'between') sim.startNextWave();
        // escorts fall at once; the titan and her children after one frame on the field (the tracker sees them arrive)
        for (const e of [...sim.enemies]) {
          if (e.dead) continue;
          if (e.id !== 'fp_eclipse_wyrm' && e.id !== 'dragon_ashwing') sim._killEnemy(e, null);
          else if (seen.has(e.uid)) sim._killEnemy(e, null);
          else seen.add(e.uid);
        }
        await new Promise((r) => setTimeout(r, 40));
      }
    });
    const res = await page.waitForSelector('[data-testid="titan-result"]', { timeout: 120000 });
    const notch = await res.getAttribute('data-notch');
    await page.waitForTimeout(600);
    await shot(page, `${tag}-3d-titan-result`);
    check(notch === 'victory', `${tag} the titan fell: result sheet notch "${notch}"`);
    const resText = await res.textContent();
    check(/Victory Chest/.test(resText) && /First clear/.test(resText), `${tag} result: Victory Chest and first clear shown`);
    const after = await prof(page, () => {
      const c = window.__sakura.store.profile.missions.counters;
      return { left: c['tk:left'], best: c['tbest:wyrm'], fc: c['tfc:wyrm:0'], kindred: window.__sakura.store.profile.items.kindred_r || 0 };
    });
    check(after.left === 11 && after.best === 1 && after.fc === 1 && after.kindred >= 2, `${tag} one key used, Normal won, first clear paid (${JSON.stringify(after)})`);
    await page.click('[data-testid="titan-back"]');
    await page.waitForSelector('[data-testid="titan-sweep"]');

    // ---- 4. the weekly rewards: sweep, Titan shelf, Memento Exchange, Craft Room ------------------
    await page.click('[data-testid="titan-sweep"]');
    await page.waitForSelector('.modal');
    await page.waitForTimeout(400);
    await shot(page, `${tag}-4a-sweep`);
    const swept = await prof(page, () => window.__sakura.store.profile.missions.counters['tk:left']);
    check(swept === 10, `${tag} a sweep used one key (${swept} left)`);
    await closeModals(page);
    await go(page, '#/mall?tab=boss', '[data-testid="shelf-titan"]');
    await page.evaluate(() => document.querySelector('[data-testid="shelf-titan"]')?.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(300);
    await shot(page, `${tag}-4b-titan-shelf`);
    check(await noHScroll(page), `${tag} Boss Exchange: no horizontal scroll`);
    await page.click('[data-testid="buy-ts_crown_shard"]');
    await page.click('[data-testid="buy-confirm"]');
    await page.waitForTimeout(300);
    const shard = await prof(page, () => window.__sakura.store.profile.items.crown_rainbow_shard || 0);
    check(shard >= 1, `${tag} Titan shelf: a Rainbow Crown Shard bought (${shard})`);
    await closeModals(page);
    await go(page, '#/mall?tab=memento', '[data-testid="buy-mem_ticket"]');
    await shot(page, `${tag}-4c-memento-exchange`);
    check(await noHScroll(page), `${tag} Memento Exchange: no horizontal scroll`);
    const wallets = await page.evaluate(() => [...document.querySelectorAll('.ma-balance-val')].map((e) => e.textContent));
    check(wallets.length === 2, `${tag} Memento Exchange shows two wallets (${wallets.join(' / ')})`);
    await page.click('[data-testid="buy-mem_ticket"]');
    await page.click('[data-testid="buy-confirm"]');
    await page.waitForTimeout(300);
    const tickets = await prof(page, () => ({ t: window.__sakura.store.profile.items.ticket_recruit || 0, m: window.__sakura.store.profile.items.memento || 0 }));
    check(tickets.m === 140, `${tag} Memento Exchange: a Recruit Ticket for 60 Mementos (${JSON.stringify(tickets)})`);
    await closeModals(page);
    await go(page, '#/backpack?tab=enhancement', '[data-item="mat_feather_legendary"]');
    await page.click('[data-item="mat_feather_legendary"]');
    await page.click('[data-testid="item-craft"]');
    await page.waitForSelector('[data-testid="craft-room"]');
    await page.waitForTimeout(300);
    await shot(page, `${tag}-4d-craft-room`);
    await page.click('[data-testid="craft-combine"]');
    await page.waitForTimeout(300);
    const zen = await prof(page, () => window.__sakura.store.profile.items.mat_feather_zenith || 0);
    check(zen === 1, `${tag} Craft Room: 3 Celestial Pinion → 1 Zenith Plume (${zen})`);

    check(!errs.length, `${tag} no page errors${errs.length ? `: ${errs.slice(0, 3).join(' | ')}` : ''}`);
    await page.close();
  }
} catch (e) {
  fails.push(`exception: ${e.message}`);
  console.log(`  FAIL exception: ${e.stack}`);
} finally {
  await browser.close();
  await server.close();
}
console.log(fails.length ? `\nascension e2e: ${fails.length} FAILED` : '\nascension e2e: all checks passed');
process.exit(fails.length ? 1 : 0);

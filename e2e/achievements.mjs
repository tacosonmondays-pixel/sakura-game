// Achievements expansion e2e (docs/specs/ACHIEVEMENTS.md §7.3): the tab on a seeded late save, Claim all through the
// special fanfare into the rewards modal, Open N gear boxes → the summary, a reload keeps the claims, the Honor
// Ribbon Case (32 cells at launch) and its detail, a new save's locked and secret rows, the unlock toast AFTER a
// battle's results (never during it) or over the recruit results / a modal, and the effect budgets (≤ 3 live specials and ≤ 6 running infinite animations
// on the list, 0 under Reduce Motion, no horizontal overflow). Screenshots: e2e/out/achievements/.
//
//   node e2e/achievements.mjs                       # 1280x720 and 844x390
//   node e2e/achievements.mjs --viewport 844x390
//
// Playwright and the browser come from e2e/browser.mjs (set PLAYWRIGHT_MODULE or NODE_PATH when Playwright is not in
// node_modules).
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';
import { veteran } from '../tests/fixtures/veterans.js';
import { createProfile, SAVE_KEY } from '../src/systems/save.js';
import { skipOnboarding } from '../src/systems/story.js';
import { CAMPAIGN_IDS } from '../src/data/stages.js';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport', null) ? [opt('viewport')] : ['1280x720', '844x390'];
const OUT = 'e2e/out/achievements';
mkdirSync(OUT, { recursive: true });

const IGNORE = [/GPU stall due to ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i, /favicon\.ico/i,
  /Failed to load resource: net::ERR_(CERT_AUTHORITY_INVALID|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|PROXY_CONNECTION_FAILED|TUNNEL_CONNECTION_FAILED|CONNECTION_REFUSED)/i];
const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
}

// ---- saves -----------------------------------------------------------------------------------------
/** A late veteran on update day with every Sakura medal: two specials ready (Rainbow Bright, Thousand Petals). */
function lateSave() {
  const p = veteran('late');
  for (const id of CAMPAIGN_IDS) p.progress.stages[id].nightmare = true;
  p.missions.counters.login = 104;
  return p;
}
/** A new (non-legacy) save before 2-1: a met box row stays locked; secrets show their hints. */
function newSave() {
  const p = createProfile();
  skipOnboarding(p);
  p.progress.stages['1-1'] = { easy: true, normal: true, hard: false, nightmare: false, clears: 1 };
  p.bestiary.slime_green = { seen: true, discovered: true, kills: 1000 }; // a_slime_1000: 20 gems + a Sturdy box → locked
  return p;
}
/** A veteran one win short of Patrol Veteran (100 wins). */
function oneWinShort() {
  const p = createProfile();
  p.story.legacy = true;
  for (const id of CAMPAIGN_IDS.slice(0, 5)) p.progress.stages[id] = { easy: true, normal: true, hard: false, nightmare: false, clears: 3 };
  p.missions.counters.battleWin = 99;
  p.missions.achievements.a_first_win = true;
  p.missions.achievements.a_chapter_1 = true;
  return p;
}

// ---- server + browser --------------------------------------------------------------------------------
const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
let browser;
try {
  const launched = await launchChromium();
  browser = launched.browser;
  log(`browser: ${launched.label}`);
} catch (e) {
  await server.close();
  throw e;
}

async function openWith(context, profile, hash) {
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.some((re) => re.test(m.text()))) errors.push(`[console] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  await page.addInitScript(([key, text]) => {
    if (!sessionStorage.getItem('ach-e2e-seeded')) {
      localStorage.setItem(key, text);
      sessionStorage.setItem('ach-e2e-seeded', '1');
    }
    sessionStorage.setItem('sakura-title-seen', '1');
  }, [SAVE_KEY, JSON.stringify(profile)]);
  await page.goto(`${base}?onboarding=0${hash}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura && document.querySelector('#app')?.children.length > 0, null, { timeout: 30000 });
  return { page, errors };
}

/** Live specials, running infinite animations and horizontal overflow on the page. */
const budget = (page) => page.evaluate(() => ({
  live: document.querySelectorAll('.rb.live').length,
  infinite: document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getComputedTiming?.().iterations === Infinity).length,
  overflow: document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('.ach-list, .ach-casepanel, .ach-main')].some((e) => e.scrollWidth > e.clientWidth + 1),
}));

async function runViewport(vp) {
  const [w, hh] = vp.split('x').map(Number);
  const touch = Math.min(w, hh) < 600;
  log(`\n=== viewport ${vp} ===`);
  const shot = (page, name) => page.screenshot({ path: `${OUT}/${vp}-${name}.png` }).catch((e) => log(`  (screenshot ${name} skipped: ${e.message.split('\n')[0]})`));
  const newContext = () => browser.newContext({ viewport: { width: w, height: hh }, deviceScaleFactor: 1, hasTouch: touch });

  // ---- 1. a late save: the tab dot, the categories, budgets ----
  let context = await newContext();
  let { page, errors } = await openWith(context, lateSave(), '#/commissions?tab=achievements');
  await page.waitForSelector('[data-testid="ach-tab"] .ach-row', { timeout: 30000 });
  await page.waitForTimeout(900);
  check(await page.evaluate(() => [...document.querySelectorAll('.tab')].some((t) => /Achievements/.test(t.textContent) && t.querySelector('.tab-badge'))), '1: the Achievements tab shows its dot');
  const cats = await page.$$eval('[data-testid^="ach-cat-"]', (els) => els.map((e) => e.dataset.testid));
  check(cats.length === 11 && cats.includes('ach-cat-secret') && !cats.includes('ach-cat-codex'), `1: 11 categories (All + 10; no Codex yet): ${cats.length}`);
  check(await page.$('[data-testid="ach-claim-a_ur_1"]') != null, '1: Rainbow Bright is ready to claim');
  const b1 = await budget(page);
  check(b1.live <= 3 && b1.live >= 1, `8: list live specials ≤ 3 (${b1.live})`);
  check(b1.infinite <= 6, `8: list running infinite animations ≤ 6 (${b1.infinite})`);
  check(!b1.overflow, '8: no horizontal overflow on the list');
  await shot(page, 'tab');
  await page.evaluate(() => { document.querySelector('.ach-list').scrollTop = 520; });
  await page.waitForTimeout(400);
  await shot(page, 'tab-more');
  await page.evaluate(() => document.documentElement.setAttribute('data-reduce-motion', ''));
  await page.waitForTimeout(400);
  const rm = await budget(page);
  check(rm.live === 0 && rm.infinite === 0, `8: Reduce Motion: 0 live, 0 infinite animations (${rm.live}, ${rm.infinite})`);
  await page.evaluate(() => document.documentElement.removeAttribute('data-reduce-motion'));

  // ---- 2. Claim all → the fanfare → Skip → the modal's strips ----
  await page.evaluate(() => { document.querySelector('.ach-list').scrollTop = 0; });
  await page.click('[data-testid="ach-claim-all"]');
  const ff = await page.waitForSelector('[data-testid="ach-fanfare"]', { timeout: 10000 }).catch(() => null);
  check(!!ff, '2: Claim all opens the special fanfare first');
  await page.waitForTimeout(700);
  const ffLive = await page.evaluate(() => document.querySelectorAll('.ach-fanfare .rb.live').length);
  const listLive = await page.evaluate(() => document.querySelectorAll('.ach-list .rb.live').length);
  check(ffLive === 1 && listLive === 0, `8: fanfare: 1 large live ribbon, the list drops to 0 (${ffLive}, ${listLive})`);
  await shot(page, 'fanfare');
  await page.click('[data-testid="ach-fanfare-skip"]');
  await page.waitForSelector('[data-testid="ach-strip-ribbons"]', { timeout: 10000 }).catch(() => null);
  const strips = await page.evaluate(() => ['ribbons', 'titles', 'rewards'].map((k) => !!document.querySelector(`[data-testid="ach-strip-${k}"]`)));
  check(strips.every(Boolean), `2: the modal shows New Honor Ribbons, New Titles and Rewards (${strips})`);
  const claimed = await page.evaluate(() => Object.keys(window.__sakura.store.profile.missions.achievements).length);
  check(claimed > 70, `2: the claims are in the save (${claimed})`);
  await page.waitForTimeout(500);
  await shot(page, 'claimall');

  // ---- 3. Open N gear boxes → the summary ----
  const openBtn = await page.$('[data-testid="ach-open-boxes"]');
  check(!!openBtn, '3: Open N gear boxes is offered');
  if (openBtn) {
    await openBtn.click();
    const sum = await page.waitForSelector('[data-testid="gear-summary"]', { timeout: 10000 }).catch(() => null);
    check(!!sum, '3: more than 12 pieces → the summary');
    await page.waitForTimeout(300);
    await shot(page, 'boxes');
    await page.click('[data-testid="ach-gear-ok"]').catch(() => {});
  }

  // ---- 4. reload: still claimed, Claim all disabled ----
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('[data-testid="ach-tab"] .ach-row', { timeout: 30000 });
  const after = await page.evaluate(() => ({ n: Object.keys(window.__sakura.store.profile.missions.achievements).length, disabled: document.querySelector('[data-testid="ach-claim-all"]')?.disabled }));
  check(after.n === claimed && after.disabled === true, `4: after a reload the claims stay (${after.n}) and Claim all is disabled (${after.disabled})`);

  // ---- 5. the Case: 32 cells, the detail ----
  await page.click('[data-testid="ach-case"]');
  await page.waitForSelector('[data-testid="ach-case-view"]', { timeout: 10000 });
  await page.waitForTimeout(800);
  const cells = await page.$$eval('[data-testid^="ach-cell-"]', (els) => els.length);
  check(cells === 32, `5: the Case has 32 cells at launch (${cells})`);
  await page.click('[data-testid="ach-cell-a_ur_1"]');
  await page.waitForTimeout(700);
  const det = await page.evaluate(() => !!document.querySelector('.ach-detail-body .ach-detail-name'));
  check(det, '5: the detail opens');
  const b5 = await page.evaluate(() => ({ cells: document.querySelectorAll('.ach-casepanel .rb.live').length, detail: document.querySelectorAll('.ach-detail .rb.live, .ach-detail-modal .rb.live').length }));
  check(b5.cells <= 3 && b5.detail <= 1, `8: Case: ≤ 3 cells + the detail live (${b5.cells} + ${b5.detail})`);
  const b5o = await budget(page);
  check(!b5o.overflow, '8: no horizontal overflow on the Case');
  await shot(page, 'case');
  if (touch) await page.keyboard.press('Escape').catch(() => {});
  check(!errors.length, `no console errors (${errors.slice(0, 3).join(' | ')})`);
  await context.close();

  // ---- 6. a new save: the locked row and a secret's hint ----
  context = await newContext();
  ({ page, errors } = await openWith(context, newSave(), '#/commissions?tab=achievements'));
  await page.waitForSelector('[data-testid="ach-tab"] .ach-row', { timeout: 30000 });
  const lockText = await page.textContent('[data-testid="ach-locked-a_slime_1000"]').catch(() => '');
  check(/Claim after stage 2-1/.test(lockText || ''), `6: a met box row on a new save reads "Claim after stage 2-1" (${lockText})`);
  const lockedState = await page.evaluate(() => ({ claim: !!document.querySelector('[data-testid="ach-claim-a_slime_1000"]'), all: document.querySelector('[data-testid="ach-claim-all"]')?.textContent || '' }));
  check(!lockedState.claim, '6: the locked row has no Claim button (Claim all skips it)');
  await shot(page, 'new-save');
  await page.click('[data-testid="ach-cat-secret"]');
  await page.waitForTimeout(300);
  const hint = await page.textContent('[data-testid="ach-row-a_close_call"]').catch(() => '');
  check(/Secret achievement/.test(hint) && /Hint/.test(hint), '6: a secret row shows its hint');
  await shot(page, 'secrets');
  check(!errors.length, `no console errors (${errors.slice(0, 3).join(' | ')})`);
  await context.close();

  // ---- 7. the toast waits for the results, then shows on the next screen ----
  context = await newContext();
  ({ page, errors } = await openWith(context, oneWinShort(), '#/lobby'));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()); location.hash = '#/battle?stage=1-2&difficulty=normal'; });
  await page.waitForFunction(() => window.__battle?.ui?.settleFinished && document.querySelector('#app')?.dataset.screen === 'battle', null, { timeout: 90000 });
  await page.evaluate(() => { const b = window.__battle; b.sim.state = 'won'; b.ui.settleFinished(); });
  await page.waitForSelector('[data-testid="result"]:not([hidden])', { timeout: 20000 }).catch(() => null);
  await page.waitForTimeout(1500);
  const during = await page.evaluate(() => ({ toast: !!document.querySelector('[data-testid="ach-toast"]'), line: document.querySelector('[data-testid="result-achievements"]')?.textContent || '' }));
  check(!during.toast, '7: no toast during the battle or on its results');
  check(/1 achievement ready/.test(during.line), `7: the result sheet says "★ 1 achievement ready ›" (${during.line})`);
  await shot(page, 'results');
  await page.evaluate(() => { location.hash = '#/lobby'; });
  const t = await page.waitForSelector('[data-testid="ach-toast"]', { timeout: 15000 }).catch(() => null);
  check(!!t && (await t.getAttribute('data-id')) === 'a_wins_100', '7: the toast shows on the next screen (Patrol Veteran)');
  await shot(page, 'toast');
  if (touch) {
    // on a phone the card never takes a tap meant for what is underneath; only Claim › does
    const hit = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="ach-toast"]');
      const r = card.getBoundingClientRect();
      const under = document.elementFromPoint(r.left + r.width * 0.3, r.top + r.height / 2);
      const go = card.querySelector('.ach-toast-go').getBoundingClientRect();
      const onGo = document.elementFromPoint(go.left + go.width / 2, go.top + go.height / 2);
      return { passes: !card.contains(under), claim: card.contains(onGo) };
    });
    check(hit.passes && hit.claim, `9: phone toast: taps pass through the card (${hit.passes}), Claim › still works (${hit.claim})`);
  }
  check(!errors.length, `no console errors (${errors.slice(0, 3).join(' | ')})`);
  await context.close();

  // ---- 9. a toast never sits on the recruit results (or any modal): it waits until they close ----
  context = await newContext();
  ({ page, errors } = await openWith(context, oneWinShort(), '#/recruit'));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { document.querySelectorAll('.modal-overlay').forEach((o) => o.remove()); });
  await page.waitForTimeout(400);
  // the recruit results are up (the overlay a 10-pull opens), then an achievement becomes ready
  await page.evaluate(() => {
    const o = document.createElement('div');
    o.className = 'ma-gacha';
    o.dataset.testid = 'fake-results';
    document.body.appendChild(o);
    const s = window.__sakura.store;
    s.profile.missions.counters.battleWin = 100;
    s.commit('missions');
  });
  await page.waitForTimeout(1200);
  check(!(await page.$('[data-testid="ach-toast"]')), '9: no toast while the recruit results are open');
  await page.evaluate(() => document.querySelector('[data-testid="fake-results"]').remove());
  const later = await page.waitForSelector('[data-testid="ach-toast"]', { timeout: 5000 }).catch(() => null);
  check(!!later, '9: the toast shows once the results close');
  // and a toast already showing steps aside when a modal opens
  await page.evaluate(() => {
    const o = document.createElement('div');
    o.className = 'modal-overlay';
    o.dataset.testid = 'fake-modal';
    document.body.appendChild(o);
  });
  await page.waitForTimeout(400);
  check(!(await page.$('[data-testid="ach-toast"]')), '9: a showing toast steps aside when a modal opens');
  await page.evaluate(() => document.querySelector('[data-testid="fake-modal"]').remove());
  check(!!(await page.waitForSelector('[data-testid="ach-toast"]', { timeout: 5000 }).catch(() => null)), '9: … and comes back when it closes');
  check(!errors.length, `no console errors (${errors.slice(0, 3).join(' | ')})`);
  await context.close();
}

try {
  for (const vp of viewports) await runViewport(vp);
} finally {
  await browser.close();
  await server.close();
}
log(failures.length ? `\n${failures.length} FAILED:\n  ${failures.join('\n  ')}` : '\nall achievements checks passed');
process.exit(failures.length ? 1 : 0);

// End-to-end check of Gate Arc Step 1 in the real game (docs/specs/gate-arc/STEP1_BUILD_PLAN.md, S1d "Done when"):
//   · an old save (chapters 1-3 cleared, as the `m5` seed) keeps every Act I unlock, and chapter 1 shows two act rows:
//     "Act I · The Morning" and "Act II · Rush Hour", the second unlocked with its NEW sticker and the tab's dot
//   · stage prep of 1-6 plays "Two Sunrises" as an overlay, opening with the content note card; Continue goes on to
//     the title card "Chapter 1 · Rush Hour"; the rule panel shows the stage's skin and the base rule's name
//   · the 1-6 battle opens on the city board (map noon_station_plaza)
// and Gate Arc Step 2 (docs/specs/gate-arc/STEP2_BUILD_PLAN.md §7):
//   · chapter 2's Act II "Hilltop After Dark" waits for both keys: with 2-5 cleared but not 1-10 its row says
//     "Clear 1-10 first"; once 1-10 is cleared the row is open with NEW
//   · stage prep of 2-6 plays "Exchange Students" (g2.pro) under the "Chapter 2 · Hilltop After Dark" kicker
//   · the 2-7 battle (Lights Out) opens on the campus board and dims while the eclipse is on (renderer info.blackout)
//
//   node e2e/gate-arc.mjs                          # both viewports
//   node e2e/gate-arc.mjs --viewport 844x390 --shots <dir>
// Exit code 1 if any check fails. Starts its own Vite dev server on a free port; screenshots are optional.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport', null) ? [opt('viewport')] : ['844x390', '1280x720'];
const shotsDir = opt('shots', null);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

const SAVE_KEY = 'sakura-sentinels-save-v1';
const BETA_SHOWN_KEY = 'sakura-beta-gift-shown';
const IGNORE = [
  /GPU stall due to ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i,
  /favicon\.ico/i,
  /Failed to load resource: net::ERR_(CERT_AUTHORITY_INVALID|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|PROXY_CONNECTION_FAILED|TUNNEL_CONNECTION_FAILED|CONNECTION_REFUSED)/i,
];

const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  if (cond) log(`  ok   ${msg}`);
  else {
    log(`  FAIL ${msg}`);
    failures.push(msg);
  }
  return cond;
}

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const base = `http://127.0.0.1:${port}/`;

// the old save, built with the game's own save code: chapters 1-3 cleared on Normal (the m5 seed's progress)
const { createProfile } = await server.ssrLoadModule('/src/systems/save.js');
function oldSave() {
  const p = createProfile();
  for (let c = 1; c <= 3; c++) for (let s = 1; s <= 5; s++) p.progress.stages[`${c}-${s}`] = { clears: 1, easy: true, normal: true, hard: false, nightmare: false };
  Object.assign(p.story, { opening: 'seen', tutorial: 'done', seen: ['opening', 'tut.outro'] });
  return JSON.stringify(p);
}

let browser;
try {
  browser = (await launchChromium()).browser;
} catch (e) {
  await server.close();
  throw e;
}

async function runViewport(vp) {
  const [w, hgt] = vp.split('x').map(Number);
  const touch = Math.min(w, hgt) < 600;
  log(`\n=== viewport ${vp}${touch ? ' (touch)' : ''} ===`);
  const context = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1, hasTouch: touch });
  const save = oldSave();
  await context.addInitScript(([k, v]) => { if (!sessionStorage.getItem('__seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } }, [SAVE_KEY, save]);
  await context.addInitScript((k) => sessionStorage.setItem(k, '1'), BETA_SHOWN_KEY);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (!IGNORE.some((re) => re.test(t))) errors.push(`[console] ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  const shot = async (name) => {
    if (!shotsDir) return;
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 150))))).catch(() => {});
    await page.screenshot({ path: `${shotsDir}/${vp}-${name}.png` }).catch(() => {});
  };

  // ---- the campaign: Act I as before, chapter 1's Act II row open with NEW
  await page.goto(`${base}?onboarding=0#/campaign`, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="chapter-1"]', { timeout: 60000 });
  await page.click('[data-testid="chapter-1"]', { force: true });
  await page.waitForSelector('[data-testid="act-row-1-2"]', { timeout: 10000 }).catch(() => null);
  const camp = await page.evaluate(() => {
    const t = (sel) => document.querySelector(sel)?.textContent?.trim() || '';
    return {
      head1: t('[data-testid="act-head-1-1"] .ma-act-title'),
      head2: t('[data-testid="act-head-1-2"] .ma-act-title'),
      locked2: !!document.querySelector('[data-testid="act-head-1-2"].locked'),
      isNew: !!document.querySelector('[data-testid="act-new-1-2"]'),
      tabDot: !!document.querySelector('[data-testid="chapter-new-act-1"]'),
    };
  });
  check(camp.head1 === 'Act I · The Morning' && camp.head2 === 'Act II · Rush Hour', `campaign: chapter 1 shows two act rows ("${camp.head1}", "${camp.head2}")`);
  check(!camp.locked2 && camp.isNew && camp.tabDot, 'campaign: Act II is open, with its NEW sticker and the chapter tab\'s dot');
  await shot('campaign-ch1');
  const unl = await page.evaluate(async () => {
    const u = await import('/src/systems/unlocks.js');
    const p = window.__sakura.store.profile;
    return Object.fromEntries(['1-5', '2-1', '3-5', '4-1', '4-2', '1-6', '1-7'].map((id) => [id, u.isStageUnlocked(p, id)]));
  });
  check(unl['1-5'] && unl['2-1'] && unl['3-5'] && unl['4-1'] && !unl['4-2'], 'old save: every Act I unlock as before (4-1 open, 4-2 locked)');
  check(unl['1-6'] && !unl['1-7'], 'old save: 1-6 open (it needs 1-5), 1-7 waits for 1-6');

  // ---- stage prep 1-6: the content note, then "Two Sunrises" under the Act II kicker
  await page.evaluate(() => { location.hash = '#/stage/1-6'; });
  const note = await page.waitForSelector('[data-testid="story-note"]:not([hidden])', { timeout: 20000 }).catch(() => null);
  const noteText = note ? await page.evaluate(() => document.querySelector('.sp-note-text')?.textContent || '') : '';
  check(!!note && noteText === 'This arc contains war and loss.', `1-6 prep: the content note comes first ("${noteText}")`);
  check(await page.evaluate(() => document.querySelector('.sp')?.dataset.scene) === 'g1.pro', '1-6 prep: the overlay is "Two Sunrises" (g1.pro)');
  const noteSize = await page.evaluate(() => [...document.querySelectorAll('.sp-note *')].map((e) => parseFloat(getComputedStyle(e).fontSize)));
  check(noteSize.length && noteSize.every((px) => px >= 12), `content note: every text ≥ 12 px (${noteSize.join(', ')})`);
  await shot('content-note');
  await page.click('[data-testid="story-note-continue"]', { force: true });
  await page.waitForFunction(() => !document.querySelector('[data-testid="story-note"]'), null, { timeout: 5000 }).catch(() => null);
  const kicker = await page.evaluate(() => document.querySelector('.sp-tc-kicker')?.textContent || '');
  check(kicker === 'Chapter 1 · Rush Hour', `title card: "${kicker}"`);
  await page.waitForSelector('.sp-box.sp-full', { timeout: 10000 }).catch(() => null);
  await shot('g1-pro');
  await page.click('[data-testid="story-skip"]');
  await page.click('[data-testid="story-skip-confirm"]');
  await page.waitForFunction(() => !document.querySelector('.sp'), null, { timeout: 8000 }).catch(() => null);
  const prep = await page.evaluate(() => ({
    seen: window.__sakura.store.profile.story.seen.includes('g1.pro'),
    rule: document.querySelector('[data-testid="rule-panel"] .ma-rule-name')?.textContent || '',
    base: document.querySelector('[data-testid="rule-base-name"]')?.textContent || '',
  }));
  check(prep.seen, '1-6 prep: skipping counts "Two Sunrises" as seen');
  check(prep.rule === 'Rush-hour Evacuation' && prep.base === 'The Petal Sanctuary rule.', `1-6 prep: the rule panel shows the skin ("${prep.rule}", "${prep.base}")`);
  await shot('prep-1-6');

  // ---- the battle opens on the city board
  await page.evaluate(() => { location.hash = '#/battle?stage=1-6&difficulty=easy'; });
  await page.waitForFunction(() => window.__battle?.sim, null, { timeout: 90000 }).catch(() => null);
  const map = await page.evaluate(() => ({ id: window.__battle?.sim?.map?.id, theme: window.__battle?.sim?.map?.theme }));
  check(map.id === 'noon_station_plaza' && map.theme === 'city', `1-6 battle: ${map.id} (${map.theme})`);
  await page.waitForTimeout(2500);
  await shot('battle-1-6');

  // ---- Step 2: chapter 2's Act II, the two-key lock, g2.pro and the 2-7 blackout
  await page.evaluate(() => {
    const { store } = window.__sakura;
    for (const id of ['1-6', '1-7', '1-8', '1-9']) store.profile.progress.stages[id] = { clears: 1, easy: true, normal: true, hard: false, nightmare: false };
    store.profile.story.seen = [...new Set([...store.profile.story.seen, 'g1.pro', 'g1.mahiru', 'g1.yuzuha', 'g1.mid', 'g1.poster', 'g1.boss', 'g1.epi'])];
    store.profile.story.queue = [];
    store.commit('e2e');
    location.hash = '#/campaign';
  });
  await page.waitForSelector('[data-testid="chapter-2"]', { timeout: 30000 });
  await page.click('[data-testid="chapter-2"]', { force: true });
  await page.waitForSelector('[data-testid="act-row-2-2"]', { timeout: 10000 }).catch(() => null);
  const lock2 = await page.evaluate(() => ({
    head: document.querySelector('[data-testid="act-head-2-2"] .ma-act-title')?.textContent?.trim() || '',
    locked: !!document.querySelector('[data-testid="act-head-2-2"].locked'),
    text: document.querySelector('[data-testid="act-head-2-2"] .ma-act-lock')?.textContent?.trim() || '',
  }));
  check(lock2.head === 'Act II · Hilltop After Dark' && lock2.locked && lock2.text === 'Clear 1-10 first', `chapter 2: Act II waits for 1-10 ("${lock2.head}", "${lock2.text}")`);
  await shot('campaign-ch2-locked');
  await page.evaluate(() => {
    const { store } = window.__sakura;
    store.profile.progress.stages['1-10'] = { clears: 1, easy: true, normal: true, hard: false, nightmare: false };
    store.commit('e2e');
    location.hash = '#/home';
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => { location.hash = '#/campaign'; });
  await page.waitForSelector('[data-testid="chapter-2"]', { timeout: 30000 });
  await page.click('[data-testid="chapter-2"]', { force: true });
  await page.waitForSelector('[data-testid="act-row-2-2"]', { timeout: 10000 }).catch(() => null);
  const open2 = await page.evaluate(() => ({
    locked: !!document.querySelector('[data-testid="act-head-2-2"].locked'),
    isNew: !!document.querySelector('[data-testid="act-new-2-2"]'),
  }));
  check(!open2.locked && open2.isNew, 'chapter 2: after 1-10, Act II is open with its NEW sticker');
  await shot('campaign-ch2-open');
  await page.evaluate(() => { location.hash = '#/stage/2-6'; });
  await page.waitForFunction(() => document.querySelector('.sp')?.dataset.scene === 'g2.pro', null, { timeout: 20000 }).catch(() => null);
  const kicker2 = await page.evaluate(() => ({ scene: document.querySelector('.sp')?.dataset.scene || '', kicker: document.querySelector('.sp-tc-kicker')?.textContent || '' }));
  check(kicker2.scene === 'g2.pro' && kicker2.kicker === 'Chapter 2 · Hilltop After Dark', `2-6 prep: "${kicker2.scene}" under "${kicker2.kicker}"`);
  await page.click('[data-testid="story-skip"]').catch(() => {});
  await page.click('[data-testid="story-skip-confirm"]').catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.sp'), null, { timeout: 8000 }).catch(() => null);
  await page.evaluate(() => { location.hash = '#/battle?stage=2-7&difficulty=easy'; });
  await page.waitForFunction(() => window.__battle?.sim && window.__battle?.renderer, null, { timeout: 90000 }).catch(() => null);
  const map2 = await page.evaluate(() => ({ id: window.__battle?.sim?.map?.id, theme: window.__battle?.sim?.map?.theme, dim: window.__battle?.renderer?.info?.blackout }));
  check(map2.id === 'noon_rowing_jetty' && map2.theme === 'campus' && map2.dim === 1, `2-7 battle: ${map2.id} (${map2.theme}), lit before the eclipse (${map2.dim})`);
  // the eclipse comes 14 s into each 20 s cycle of the wave clock: step the sim there (a slow headless frame rate
  // would take minutes), then let the renderer ease the lights down
  await page.evaluate(() => {
    const { sim } = window.__battle;
    sim.cash = 1e6;
    sim.startNextWave();
    for (let i = 0; i < 1300 && !sim.rule.active && sim.state === 'wave'; i++) sim.update(1 / 60);
  });
  await page.waitForFunction(() => window.__battle?.renderer?.info?.blackout < 0.5, null, { timeout: 15000 }).catch(() => null);
  const dark = await page.evaluate(() => ({ active: !!window.__battle?.sim?.rule?.active, dim: window.__battle?.renderer?.info?.blackout, state: window.__battle?.sim?.state, tick: window.__battle?.sim?._waveTick }));
  check(dark.active && dark.dim < 0.5, `2-7 battle: lights out while the eclipse is on (active ${dark.active}, dim ${dark.dim}, state ${dark.state}, tick ${dark.tick})`);
  await shot('battle-2-7-dark');

  check(!errors.length, `no errors${errors.length ? `\n       ${errors.slice(0, 6).join('\n       ')}` : ''}`);
  await context.close();
}

try {
  for (const vp of viewports) await runViewport(vp);
} catch (e) {
  failures.push(`crashed: ${e.stack || e.message}`);
  log(`CRASH ${e.stack || e.message}`);
} finally {
  await browser.close();
  await server.close();
}
log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL GATE ARC CHECKS PASSED');
process.exit(failures.length ? 1 : 0);

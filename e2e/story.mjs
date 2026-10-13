// End-to-end check of the story scene player (STORY_SPEC §6 E-story, player part). Boots the real game in
// Chromium at 844×390 (landscape phone, touch) and 1280×720 (mouse):
//   · fresh save: TAP TO START → the "Meet Hikari" opening plays (title card, type-on, tap advance, the choice,
//     Log, Auto) → Skip asks first → the coached 1-1 battle opens and the opening never plays again
//   · a fresh save deep-linked to the lobby is sent to the opening; other deep links still render
//   · reduced motion: instant text, no motion on the stands
//   · the Story archive lists the episodes, plays one (NEW → read, +20 gems once) and returns to its tab
//   · stage prep plays its `before` scene as an overlay; a first clear queues the `after` scene for the next screen
//   · a legacy save (no story block) is never forced through anything
//
//   node e2e/story.mjs                          # both viewports
//   node e2e/story.mjs --viewport 844x390 --shots <dir>
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

// seeded saves are built with the game's own save code (Node), so they match what the app writes
const { createProfile } = await server.ssrLoadModule('/src/systems/save.js');
const { CAMPAIGN_IDS } = await server.ssrLoadModule('/src/data/stages.js');
function seeded({ upTo = null, legacy = false, story = null } = {}) {
  const p = createProfile();
  for (const id of CAMPAIGN_IDS) {
    if (!upTo) break;
    p.progress.stages[id] = { clears: 1, easy: false, normal: true, hard: false, nightmare: false };
    if (id === upTo) break;
  }
  if (legacy) delete p.story;
  else Object.assign(p.story, { opening: 'seen', tutorial: 'done', seen: ['opening', 'tut.outro'] }, story || {});
  return JSON.stringify(p);
}

let browser;
try {
  const launched = await launchChromium();
  browser = launched.browser;
  log(`browser: ${launched.label}`);
} catch (e) {
  await server.close();
  throw e;
}

async function runViewport(vp) {
  const [w, hgt] = vp.split('x').map(Number);
  const touch = Math.min(w, hgt) < 600;
  log(`\n=== viewport ${vp}${touch ? ' (touch)' : ''} ===`);

  const newPage = async ({ save = null, reduce = false } = {}) => {
    const context = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1, hasTouch: touch, reducedMotion: reduce ? 'reduce' : 'no-preference' });
    if (save) await context.addInitScript(([k, v]) => { if (!sessionStorage.getItem('__seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } }, [SAVE_KEY, save]);
    // seeded runs: the beta-gift celebration modal counts as already shown this session
    if (save) await context.addInitScript((k) => sessionStorage.setItem(k, '1'), BETA_SHOWN_KEY);
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (!IGNORE.some((re) => re.test(t))) errors.push(`[console] ${t}`);
    });
    page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
    page.on('requestfailed', (r) => { if (r.url().startsWith(base)) errors.push(`[requestfailed] ${r.url()}`); });
    return { context, page, errors };
  };
  const shot = async (page, name) => {
    if (!shotsDir) return;
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 120))))).catch(() => {});
    await page.screenshot({ path: `${shotsDir}/${vp}-${name}.png` }).catch((e) => log(`  (screenshot ${name} skipped: ${e.message.split('\n')[0]})`));
  };
  const story = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__sakura.store.profile.story)));
  const text = (page) => page.evaluate(() => document.querySelector('[data-testid="story-text"]')?.textContent || '');
  const tapNext = (page) => page.click('[data-testid="story-next"]', { position: { x: Math.round(w / 2), y: Math.round(hgt * 0.35) }, force: true });
  /** Tap until a line has fully typed (caret shown) and return its text. */
  const fullLine = async (page) => {
    await page.waitForSelector('.sp-box.sp-full', { timeout: 8000 });
    return text(page);
  };

  // ---------------------------------------------------------------- fresh save → title → opening
  {
    const { context, page, errors } = await newPage();
    await page.goto(base, { waitUntil: 'load' });
    const start = await page.waitForSelector('[data-testid="title-start"]:not([disabled])', { timeout: 30000 }).catch(() => null);
    check(!!start, 'title: TAP TO START is ready on a fresh save');
    if (start) await start.click({ force: true });
    await page.waitForFunction(() => location.hash.startsWith('#/scene/opening'), null, { timeout: 15000 }).catch(() => null);
    check(await page.evaluate(() => location.hash.startsWith('#/scene/opening') && location.hash.includes('next=tutorial')), 'fresh save: TAP TO START opens the "Meet Hikari" opening');
    await page.waitForSelector('[data-testid="story-player"].sp-ready', { timeout: 15000 }).catch(() => null);
    check(await page.evaluate(() => !!document.querySelector('.sp-title-card .sp-tc-title')?.textContent.includes('Hikari')), 'opening: the title card names the episode (token resolved from data)');
    // the first line, then a tap: the second line types on (sampled twice while it grows)
    const first = await fullLine(page);
    await shot(page, 'opening-narration');
    await tapNext(page);
    await page.waitForFunction((prev) => { const t = document.querySelector('[data-testid="story-text"]')?.textContent || ''; return t && t !== prev; }, first, { timeout: 5000 }).catch(() => null);
    const t0 = (await text(page)).length;
    await page.waitForTimeout(200);
    const t1 = (await text(page)).length;
    const second = await fullLine(page);
    check(t0 < second.length && t1 >= t0, `opening: text types on (${t0} → ${t1} → ${second.length} chars)`);
    check(second !== first, 'opening: a tap advances to the next line');
    // a tap while typing completes the line instantly
    await tapNext(page);
    await page.waitForTimeout(80);
    const typing = await page.evaluate(() => !document.querySelector('.sp-box')?.classList.contains('sp-full'));
    if (typing) {
      await tapNext(page);
      check(await page.waitForSelector('.sp-box.sp-full', { timeout: 1000 }).then(() => true, () => false), 'opening: a tap while typing completes the line');
    }
    // tap through to the choice (bounded)
    let choice = null;
    for (let i = 0; i < 20 && !choice; i++) {
      choice = await page.$('[data-testid="story-choice-0"]');
      if (choice) break;
      await page.waitForSelector('.sp-box.sp-full, [data-testid="story-choice-0"]', { timeout: 8000 }).catch(() => null);
      choice = await page.$('[data-testid="story-choice-0"]');
      if (!choice) await tapNext(page);
      await page.waitForTimeout(120);
    }
    check(!!choice, 'opening: the choice appears');
    const cg = await page.evaluate(() => document.querySelector('.sp')?.classList.contains('sp-cg'));
    check(cg, 'opening: the CG background is up at the choice (portraits hidden)');
    await shot(page, 'opening-choice');
    if (choice) await choice.click();
    await page.waitForSelector('.sp-box.sp-full', { timeout: 8000 }).catch(() => null);
    const reply = await text(page);
    check(/partners/i.test(reply), `opening: the chosen reply plays ("${reply.slice(0, 50)}…")`);
    check((await story(page)).choices.opening === 0, 'opening: the choice is recorded (flavour only)');
    // stands are back on the academy, the speaker is lit
    await tapNext(page);
    await page.waitForSelector('.sp-box.sp-full', { timeout: 8000 }).catch(() => null);
    const stage = await page.evaluate(() => ({ cg: document.querySelector('.sp').classList.contains('sp-cg'), actors: [...document.querySelectorAll('.sp-actor')].map((a) => a.dataset.who), speaking: document.querySelector('.sp-actor.sp-speaking')?.dataset.who || null }));
    check(!stage.cg && stage.actors.includes('hikari') && stage.speaking === 'hikari', `opening: Hikari's stand is on stage and speaking (${JSON.stringify(stage)})`);
    await shot(page, 'opening-hikari');
    // Log
    await page.click('[data-testid="story-log"]');
    const logInfo = await page.evaluate(() => ({ open: !document.querySelector('.sp-log').hidden, rows: document.querySelectorAll('.sp-log-row').length, choice: document.querySelector('.sp-log-row.choice')?.textContent || '' }));
    check(logInfo.open && logInfo.rows >= 5 && logInfo.choice.includes('▶'), `log: lists the lines with the chosen option marked ▶ (${logInfo.rows} rows)`);
    await shot(page, 'opening-log');
    await page.click('[data-testid="story-log-close"]');
    check(await page.evaluate(() => document.querySelector('.sp-log').hidden), 'log: closes with ✕');
    // Auto
    await page.click('[data-testid="story-auto"]');
    check(await page.evaluate(() => document.querySelector('.sp').classList.contains('sp-auto-on') && window.__sakura.store.profile.story.prefs.auto === true), 'auto: on (saved in story.prefs)');
    await page.waitForSelector('.sp-box.sp-full', { timeout: 8000 }).catch(() => null);
    const before = await text(page);
    await page.waitForFunction((prev) => (document.querySelector('[data-testid="story-text"]')?.textContent || '') !== prev, before, { timeout: 9000 }).catch(() => null);
    check((await text(page)) !== before, 'auto: advances without a tap');
    await page.click('[data-testid="story-auto"]');
    // hide UI (on a fully shown line)
    await page.waitForSelector('.sp-box.sp-full', { timeout: 8000 }).catch(() => null);
    await page.click('[data-testid="story-hide"]');
    check(await page.evaluate(() => document.querySelector('.sp').classList.contains('sp-ui-hidden')), 'hide: the eye hides the text box');
    await shot(page, 'opening-hidden-ui');
    const hiddenText = await text(page);
    await tapNext(page);
    check(await page.evaluate(() => !document.querySelector('.sp').classList.contains('sp-ui-hidden')) && (await text(page)) === hiddenText, 'hide: a tap brings the UI back without advancing');
    // Skip → confirm (with the opening's extra note) → Keep reading → Skip again → confirm
    await page.click('[data-testid="story-skip"]');
    const conf = await page.evaluate(() => ({ open: !document.querySelector('.sp-confirm').hidden, note: document.querySelector('.sp-confirm-note')?.textContent || '' }));
    check(conf.open && /first battle/.test(conf.note), `skip: asks first, with the opening's note ("${conf.note}")`);
    await shot(page, 'opening-skip-confirm');
    await page.click('[data-testid="story-keep-reading"]');
    check(await page.evaluate(() => document.querySelector('.sp-confirm').hidden && !!document.querySelector('[data-testid="story-player"]')), 'skip: Keep reading returns to the scene');
    await page.keyboard.press('Escape');
    check(await page.evaluate(() => !document.querySelector('.sp-confirm').hidden), 'skip: Esc opens the confirm');
    await page.click('[data-testid="story-skip-confirm"]');
    await page.waitForFunction(() => location.hash.startsWith('#/battle'), null, { timeout: 15000 }).catch(() => null);
    const hash = await page.evaluate(() => location.hash);
    check(hash.includes('stage=1-1') && hash.includes('difficulty=easy') && hash.includes('tutorial=1'), `skip: the coached 1-1 Easy battle opens (${hash})`);
    const s = await story(page);
    check(s.opening === 'skipped' && s.seen.includes('opening') && s.tutorial === 'pending', `skip: opening skipped and seen, tutorial still pending (${s.opening}/${s.tutorial})`);
    // the lobby no longer redirects
    await page.evaluate(() => { location.hash = '#/lobby'; });
    await page.waitForTimeout(1500);
    check(await page.evaluate(() => location.hash.startsWith('#/lobby') && !document.querySelector('[data-testid="story-player"]')), 'after the opening: the lobby opens normally');
    check(!errors.length, `fresh save flow: no errors${errors.length ? `\n       ${errors.slice(0, 5).join('\n       ')}` : ''}`);
    await context.close();
  }

  // ---------------------------------------------------------------- deep links on a fresh save
  {
    const { context, page, errors } = await newPage();
    await page.goto(`${base}#/students`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    check(await page.evaluate(() => location.hash.startsWith('#/students')), 'fresh save: a deep link to Students still renders');
    await page.evaluate(() => { location.hash = '#/lobby'; });
    await page.waitForFunction(() => location.hash.startsWith('#/scene/opening'), null, { timeout: 10000 }).catch(() => null);
    check(await page.evaluate(() => location.hash.startsWith('#/scene/opening')), 'fresh save: the lobby sends a new player to the opening');
    await page.waitForSelector('[data-testid="story-player"].sp-ready', { timeout: 10000 }).catch(() => null);
    // Esc → confirm → skip
    await page.keyboard.press('Escape');
    await page.click('[data-testid="story-skip-confirm"]');
    await page.waitForFunction(() => location.hash.startsWith('#/battle'), null, { timeout: 15000 }).catch(() => null);
    check(await page.evaluate(() => location.hash.startsWith('#/battle')), 'deep-link opening: skipping goes on to the tutorial battle');
    check(!errors.length, `deep links: no errors${errors.length ? `\n       ${errors.slice(0, 5).join('\n       ')}` : ''}`);
    await context.close();
  }

  // ---------------------------------------------------------------- reduced motion
  {
    const { context, page, errors } = await newPage({ reduce: true, save: seeded({ upTo: '1-4' }) });
    await page.goto(`${base}#/scene/ch1.mid?next=story&ch=1`, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="story-player"].sp-ready', { timeout: 15000 }).catch(() => null);
    await page.waitForFunction(() => (document.querySelector('[data-testid="story-text"]')?.textContent || '').length > 0, null, { timeout: 10000 }).catch(() => null);
    const rm = await page.evaluate(() => ({
      reduce: document.querySelector('.sp').classList.contains('sp-reduce'),
      full: document.querySelector('.sp-box').classList.contains('sp-full'),
      anims: document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.target?.closest?.('.sp-stage, .sp-petals, .sp-flash')).length,
    }));
    check(rm.reduce && rm.full, `reduced motion: the line shows at once (${JSON.stringify(rm)})`);
    check(rm.anims === 0, `reduced motion: no motion on the stands, petals or flashes (${rm.anims} running)`);
    await shot(page, 'reduced-motion');
    check(!errors.length, `reduced motion: no errors${errors.length ? `\n       ${errors.slice(0, 5).join('\n       ')}` : ''}`);
    await context.close();
  }

  // ---------------------------------------------------------------- archive
  {
    const { context, page, errors } = await newPage({ save: seeded({ upTo: '1-5' }) });
    await page.goto(`${base}#/story`, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="story-ep-ch1.mid"]', { timeout: 15000 }).catch(() => null);
    const cards = await page.evaluate(() => [...document.querySelectorAll('.sa-card')].map((c) => ({ id: c.dataset.testid.slice(9), new: c.classList.contains('new'), locked: c.classList.contains('locked') })));
    check(cards.length >= 3 && cards.find((c) => c.id === 'ch1.mid')?.new, `archive: chapter 1 opens with NEW episodes (${cards.map((c) => `${c.id}${c.new ? '*' : ''}`).join(', ')})`);
    await shot(page, 'archive-ch1');
    await page.click('[data-testid="story-tab-2"]');
    await page.waitForTimeout(300);
    const ch2 = await page.evaluate(() => [...document.querySelectorAll('.sa-card')].map((c) => ({ id: c.dataset.testid.slice(9), locked: c.classList.contains('locked'), state: c.querySelector('.sa-state')?.textContent })));
    check(ch2.find((c) => c.id === 'ch2.pro' && !c.locked) && ch2.find((c) => c.id === 'ch2.epi' && c.locked && /Clear/.test(c.state)), `archive: chapter 2 shows unlocked and locked episodes with requirements (${JSON.stringify(ch2.map((c) => c.state))})`);
    await shot(page, 'archive-ch2');
    await page.click('[data-testid="story-tab-1"]');
    const gems0 = await page.evaluate(() => window.__sakura.store.profile.currencies.gems);
    await page.click('[data-testid="story-ep-ch1.mid"]');
    await page.waitForSelector('[data-testid="story-player"].sp-ready', { timeout: 15000 }).catch(() => null);
    await page.waitForSelector('.sp-box.sp-full', { timeout: 8000 }).catch(() => null);
    await tapNext(page);
    await page.waitForSelector('.sp-box.sp-full', { timeout: 8000 }).catch(() => null);
    await shot(page, 'archive-play-ch1-mid');
    // the enemy speaker: plate in the family colour, no stand
    for (let i = 0; i < 12; i++) {
      if (await page.evaluate(() => document.querySelector('.sp-plate')?.classList.contains('sp-plate-enemy'))) break;
      await tapNext(page);
      await page.waitForSelector('.sp-box.sp-full, [data-testid="story-choice-0"]', { timeout: 8000 }).catch(() => null);
      if (await page.$('[data-testid="story-choice-0"]')) await page.click('[data-testid="story-choice-1"]');
    }
    check(await page.evaluate(() => document.querySelector('.sp-plate')?.classList.contains('sp-plate-enemy')), 'archive play: a monster speaks with its own plate');
    await shot(page, 'archive-enemy-line');
    await page.click('[data-testid="story-skip"]');
    await page.click('[data-testid="story-skip-confirm"]');
    await page.waitForFunction(() => location.hash.startsWith('#/story'), null, { timeout: 10000 }).catch(() => null);
    await page.waitForSelector('[data-testid="story-ep-ch1.mid"]', { timeout: 10000 }).catch(() => null);
    const after = await page.evaluate(() => ({ hash: location.hash, read: document.querySelector('[data-testid="story-ep-ch1.mid"]')?.classList.contains('read'), gems: window.__sakura.store.profile.currencies.gems }));
    check(after.hash.includes('ch=1') && after.read, `archive: back on the same tab, the episode is read (${after.hash})`);
    check(after.gems === gems0 + 20, `archive: the first read paid 20 gems once (${gems0} → ${after.gems})`);
    // replay: no second reward
    await page.click('[data-testid="story-ep-ch1.mid"]');
    await page.waitForSelector('[data-testid="story-player"].sp-ready', { timeout: 15000 }).catch(() => null);
    await page.keyboard.press('Escape');
    await page.click('[data-testid="story-skip-confirm"]');
    await page.waitForFunction(() => location.hash.startsWith('#/story'), null, { timeout: 10000 }).catch(() => null);
    check(await page.evaluate((g) => window.__sakura.store.profile.currencies.gems === g, after.gems), 'archive: a replay grants nothing');
    check(!errors.length, `archive: no errors${errors.length ? `\n       ${errors.slice(0, 5).join('\n       ')}` : ''}`);
    await context.close();
  }

  // ---------------------------------------------------------------- stage prep + after-scene queue
  {
    const { context, page, errors } = await newPage({ save: seeded({ upTo: '1-4' }) });
    await page.goto(`${base}#/stage/1-5`, { waitUntil: 'load' });
    const overlay = await page.waitForSelector('[data-testid="story-player"].sp-overlay.sp-ready', { timeout: 15000 }).catch(() => null);
    check(!!overlay && (await page.evaluate(() => document.querySelector('.sp')?.dataset.scene)) === 'ch1.mid', 'stage prep 1-5: "The Jelly Throne" plays as an overlay');
    check(await page.evaluate(() => window.__sakura.storyBusy === true), 'overlay: storyBusy is set while it plays');
    await page.waitForSelector('.sp-box.sp-full', { timeout: 8000 }).catch(() => null);
    await shot(page, 'stage-prep-overlay');
    await page.click('[data-testid="story-skip"]');
    await page.click('[data-testid="story-skip-confirm"]');
    await page.waitForFunction(() => !document.querySelector('.sp'), null, { timeout: 5000 }).catch(() => null);
    const prep = await page.evaluate(() => ({ hash: location.hash, seen: window.__sakura.store.profile.story.seen, busy: window.__sakura.storyBusy }));
    check(prep.hash.startsWith('#/stage/1-5') && prep.seen.includes('ch1.mid') && !prep.busy, 'overlay: skipping returns to stage prep and counts as seen');
    // a first clear of 1-5 queues the epilogue; it plays on the next non-battle screen
    await page.evaluate(() => {
      const { store } = window.__sakura;
      store.profile.progress.stages['1-5'] = { clears: 1, easy: false, normal: true, hard: false, nightmare: false };
      store.commit('battle-result');
    });
    await page.waitForFunction(() => window.__sakura.store.profile.story.queue.includes('ch1.epi'), null, { timeout: 8000 }).catch(() => null);
    check(await page.evaluate(() => window.__sakura.store.profile.story.queue.includes('ch1.epi')), 'first clear of 1-5: "Ripples on the Lake" is queued (saved)');
    await page.evaluate(() => { location.hash = '#/campaign'; });
    const epi = await page.waitForSelector('.sp.sp-overlay[data-scene="ch1.epi"]', { timeout: 15000 }).catch(() => null);
    check(!!epi, 'queue: the epilogue plays on the next screen');
    await page.waitForSelector('.sp-box.sp-full', { timeout: 8000 }).catch(() => null);
    await shot(page, 'after-scene-overlay');
    await page.keyboard.press('Escape');
    await page.click('[data-testid="story-skip-confirm"]');
    await page.waitForFunction(() => !document.querySelector('.sp'), null, { timeout: 5000 }).catch(() => null);
    check(await page.evaluate(() => !window.__sakura.store.profile.story.queue.length && window.__sakura.store.profile.story.seen.includes('ch1.epi')), 'queue: emptied once the epilogue was seen');
    check(!errors.length, `stage prep + queue: no errors${errors.length ? `\n       ${errors.slice(0, 5).join('\n       ')}` : ''}`);
    await context.close();
  }

  // ---------------------------------------------------------------- legacy save
  {
    const { context, page, errors } = await newPage({ save: seeded({ upTo: '2-3', legacy: true }) });
    await page.goto(`${base}#/lobby`, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const l = await page.evaluate(() => ({ hash: location.hash, player: !!document.querySelector('.sp'), story: window.__sakura.store.profile.story }));
    check(l.hash.startsWith('#/lobby') && !l.player, 'legacy save: the lobby opens, nothing is forced');
    check(l.story.legacy === true && l.story.opening === 'legacy' && l.story.welcome === 'legacy', 'legacy save: the story block is legacy');
    await page.evaluate(() => { location.hash = '#/stage/2-1'; });
    await page.waitForTimeout(2500);
    check(await page.evaluate(() => !document.querySelector('.sp')), 'legacy save: no backlog scene on an already cleared stage');
    await page.evaluate(() => { location.hash = '#/missions'; });
    await page.waitForSelector('[data-testid="hub-story"]', { timeout: 10000 }).catch(() => null);
    await page.waitForSelector('[data-testid="hub-story-dot"]', { timeout: 5000 }).catch(() => null);
    check(await page.evaluate(() => !!document.querySelector('[data-testid="hub-story-dot"]')), 'missions hub: the Story tile shows a dot for unread episodes');
    await page.click('[data-testid="hub-story"]', { force: true });
    await page.waitForFunction(() => location.hash.startsWith('#/story'), null, { timeout: 5000 }).catch(() => null);
    check(await page.evaluate(() => location.hash.startsWith('#/story')), 'missions hub: the Story tile opens the archive');
    check(!errors.length, `legacy: no errors${errors.length ? `\n       ${errors.slice(0, 5).join('\n       ')}` : ''}`);
    await context.close();
  }
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
log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL STORY CHECKS PASSED');
process.exit(failures.length ? 1 : 0);

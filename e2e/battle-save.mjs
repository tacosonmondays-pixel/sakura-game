// Battle save e2e (owner request: "when you quit a match can you make it saves and you have two
// buttons continue or new game?"). Plays the real game in a browser:
//   1. start: 1-1 prep → Start; before any action no save and no &resume in the URL
//   2. build: two girls placed, one upgraded, the other on Strong; waves 1-2 played
//   3. wave-start write: starting wave 3 writes the calm state before it, at once
//   4. Save & quit mid-wave (an upgrade bought in wave 3 is undone; the confirm says so) → prep
//      shows Continue · Wave 3/12 and New game (no Start); the campaign node shows "Saved · W3"
//   5. app kill: Continue, start wave 3, buy an upgrade, then copy the storage without any
//      lifecycle event into a new browser context and Continue there: the wave-start state
//   6. a reload of the battle continues it; a battle link without &resume goes to prep instead
//   7. New game asks first (Keep it keeps the save), then starts fresh with no save until progress
//   8. paid once: a continued run is won, rewards are paid, the save is gone, and the old
//      &resume link says "already finished" without paying again
//   9. frozen team: formation and levels changed after the save do not change the continued run
//  10. practice (a locked stage) never saves; 11. Restart deletes the save and starts at wave 0
//  12. the lobby Continue chip opens the saved stage's prep
//  13. a wave won, then the app killed on the between-wave shop: Continue keeps that wave; a lost
//      Sim whose event was dropped still ends the battle (paid once, save gone)
//  14. the Colosseum: Save & quit, the badge, Continue, End run (40 coins per wave, save gone)
// Screenshots (prep with a save, the Save & quit confirm, the map badge, the lobby chip) go to
// --shots. Runs each viewport given (default both).
//
//   node e2e/battle-save.mjs                                   # 844×390 and 1280×720
//   node e2e/battle-save.mjs --viewports 844x390 --shots /tmp/battle-save
// Playwright / browser discovery: e2e/browser.mjs (PLAYWRIGHT_MODULE, CHROME_PATH). Starts its own
// Vite dev server. Exit code 1 when a check fails.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewports', opt('viewport', '844x390,1280x720')).split(',').map((v) => v.split('x').map(Number));
const shotsDir = opt('shots', null);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

const IGNORE = [
  /GPU stall due to ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i, /favicon\.ico/i,
  /Failed to load resource: net::ERR_(CERT_AUTHORITY_INVALID|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|PROXY_CONNECTION_FAILED|TUNNEL_CONNECTION_FAILED|CONNECTION_REFUSED)/i,
];
const SAVE_KEY = 'sakura-sentinels-save-v1';

const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
}

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const origin = `http://127.0.0.1:${port}/`;
const base = `${origin}?online=local&onboarding=0`;
const { browser, label } = await launchChromium();
log(`browser: ${label}`);
const errors = [];

for (const [W, H] of viewports) {
  const touch = Math.min(W, H) < 600;
  log(`\n=== viewport ${W}x${H} ===`);

  async function newContext(name, storage = null) {
    const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: touch, reducedMotion: 'reduce' });
    // every battle toast is kept after it fades: on a loaded machine the check can come later
    // than the toast's few seconds on screen
    await context.addInitScript(() => {
      window.__toasts = [];
      new MutationObserver((recs) => {
        for (const r of recs) for (const n of r.addedNodes) if (n.nodeType === 1 && n.classList.contains('bt-toast')) window.__toasts.push(n.textContent);
      }).observe(document, { childList: true, subtree: true });
    });
    if (storage) {
      // the copied storage of a killed app, in place before the game's first script runs (once)
      await context.addInitScript((data) => {
        if (sessionStorage.getItem('__seeded')) return;
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        sessionStorage.setItem('__seeded', '1');
      }, storage);
    }
    const page = await context.newPage();
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (!IGNORE.some((re) => re.test(t))) errors.push(`[${name} ${W}x${H} console] ${t}`);
    });
    page.on('pageerror', (e) => errors.push(`[${name} ${W}x${H} pageerror] ${e.message}`));
    return page;
  }
  const shot = async (page, name) => {
    if (!shotsDir) return;
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 250))))).catch(() => {});
    await page.screenshot({ path: `${shotsDir}/${name}-${W}x${H}.png` }).catch((e) => log(`  (screenshot ${name} skipped: ${e.message.split('\n')[0]})`));
  };
  const tap = async (page, sel) => {
    const el = page.locator(sel).first();
    const act = (o) => (touch ? el.tap(o) : el.click(o));
    try {
      await act({ timeout: 30000 });
    } catch (e) {
      if (!/Timeout/.test(e.message)) throw e;
      // the tap landed, but the page was too busy (a battle mounting) to answer in time
      if (!(await el.count().catch(() => 0))) {
        log(`    (${sel} was tapped; the page answered late)`);
        return;
      }
      // a loaded machine can starve the page of frames: press the button directly instead
      log(`    (no stable frames for 30 s: clicking ${sel} directly)`);
      await el.dispatchEvent('click', {}, { timeout: 30000 }).catch(async (err) => {
        if (await el.count().catch(() => 0)) throw err;
        log(`    (${sel} is gone: the first tap landed)`);
      });
    }
  };
  const where = (page) => page.evaluate(() => ({ hash: location.hash, screen: document.querySelector('#app')?.dataset.screen || null, battle: !!window.__battle })).catch(() => ({ hash: '?', screen: null, battle: false }));
  const onScreen = (page, name, prefix = `#/${name}`, timeout = 45000) => page.waitForFunction(([n, p]) => document.querySelector('#app')?.dataset.screen === n && location.hash.startsWith(p) && (n === 'battle' ? !document.documentElement.dataset.tx : !window.__battle), [name, prefix], { timeout, polling: 100 }).then(() => true).catch(() => false);
  const battleReady = async (page) => {
    const ok = await page.waitForFunction(() => window.__battle?.ui?.placement && document.querySelector('#app')?.dataset.screen === 'battle' && !document.documentElement.dataset.tx, null, { timeout: 300000, polling: 250 }).then(() => true).catch(() => false);
    if (!ok) {
      log(`    (battle not ready: ${JSON.stringify(await where(page))})`);
      await shot(page, 'not-ready');
    }
    return ok;
  };
  /** The stored profile (what a relaunch would load). */
  const storedProfile = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), SAVE_KEY);
  const savedRec = async (page, slot = '1-1') => (await storedProfile(page))?.battleSaves?.[slot] || null;
  const text = (page, sel) => page.locator(sel).first().innerText({ timeout: 15000 }).catch(() => '');
  /** A battle toast matching `re` was shown on this page (still up or already faded). */
  const toastSeen = (page, re) => page.evaluate((src) => (window.__toasts || []).some((t) => new RegExp(src).test(t)), re.source).catch(() => false);
  /** The player's build as the save stores it (towers sorted by uid). */
  const buildOf = (page) => page.evaluate(() => {
    const { sim } = window.__battle;
    return { wave: sim.wave, state: sim.state, cash: sim.cash, lives: sim.lives, towers: sim.towers.map((t) => ({ uid: t.uid, u: t.unitId, x: t.x, y: t.y, tiers: [...t.tiers], tm: t.targetMode })) };
  });
  const snapBuild = (snap) => ({ cash: snap.cash, lives: snap.lives, towers: snap.towers.map((t) => ({ uid: t.uid, u: t.u, x: t.x, y: t.y, tiers: t.tiers, tm: t.tm })) });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  async function freshLobby(name) {
    const page = await newContext(name);
    await page.goto(`${base}#/lobby`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__sakura && document.querySelector('#app')?.dataset.screen === 'lobby', null, { timeout: 60000 });
    await page.evaluate(() => {
      const { store } = window.__sakura;
      Object.assign(store.profile.settings, { quality: 'low', shadows: false, bloom: false });
      store.commit('settings');
      store.saveNow();
    });
    // a fresh account in the beta window gets the gift celebration over the lobby once per session
    if (Date.now() < Date.UTC(2026, 10, 8, 6)) {
      const later = await page.waitForSelector('[data-testid="beta-gift-later"]', { timeout: 15000 }).catch(() => null);
      if (later) {
        await tap(page, '[data-testid="beta-gift-later"]');
        await page.waitForSelector('.bg-gift-modal', { state: 'detached', timeout: 15000 }).catch(() => null);
      }
    }
    return page;
  }
  /** The open confirm dialog. */
  const CONFIRM = '.modal:has([data-testid="confirm-ok"])';
  /** Taps `sel` and waits for the confirm it opens (once more if the first tap is lost on a loaded machine). */
  async function openConfirm(page, sel) {
    for (let i = 0; i < 2; i++) {
      await tap(page, sel);
      if (await page.waitForSelector('[data-testid="confirm-ok"]', { timeout: 20000 }).catch(() => null)) return text(page, CONFIRM);
      log(`    (no confirm after tapping ${sel}${i ? '' : ', tapping again'})`);
    }
    return '';
  }
  /** Answers the open confirm and waits for it to close. */
  async function answer(page, ok) {
    await tap(page, `[data-testid="${ok ? 'confirm-ok' : 'confirm-cancel'}"]`);
    await page.waitForSelector('[data-testid="confirm-ok"]', { state: 'detached', timeout: 20000 }).catch(() => null);
  }

  /** Places the formation's first two girls on good spots via the battle's own actions (ctx.act). */
  const placeTwo = (page) => page.evaluate(() => {
    const { sim, ui } = window.__battle;
    sim.cash += 1500; // enough for both, an upgrade and a mid-wave upgrade later
    const score = (x, y) => {
      let n = 0;
      for (const k of sim.pathTiles) {
        const [px, py] = k.split(',').map(Number);
        if (Math.hypot(px + 0.5 - x, py + 0.5 - y) <= 3.2) n++;
      }
      return n;
    };
    const uids = [];
    for (const unitId of [...sim.loadout.keys()].slice(0, 2)) {
      let best = null;
      for (let y = 0.25; y < sim.map.height; y += 0.5) {
        for (let x = 0.25; x < sim.map.width; x += 0.5) {
          if (!sim.canPlace(unitId, x, y).ok) continue;
          const s = score(x, y);
          if (!best || s > best.s) best = { x, y, s };
        }
      }
      const t = best && ui.act.place(unitId, best.x, best.y);
      if (t) uids.push(t.uid);
    }
    return uids;
  });
  /** Fast-forwards the battle in the page (Start pressed whenever a wave is due) until `done`. */
  const playUntil = (page, wave) => page.evaluate((w) => {
    const { sim, ui } = window.__battle;
    for (let k = 0; k < 20000 && !(sim.state === 'between' && sim.wave >= w) && sim.state !== 'won' && sim.state !== 'lost'; k++) {
      if (sim.state === 'prep' || sim.state === 'between') ui.startWave();
      sim.update(0.25);
    }
    return { wave: sim.wave, state: sim.state };
  }, wave);
  /** Wins the running battle (as e2e/nav-back.mjs): every girl placed, upgrades, fast-forward. */
  async function winBattle(page) {
    let state = 'wave';
    for (let i = 0; i < 400 && state !== 'won' && state !== 'lost'; i++) {
      state = await page.evaluate(() => {
        const { sim, ui } = window.__battle;
        const ids = [...sim.loadout.keys(), ...(sim.heroConfig ? [sim.heroConfig.unitId] : [])];
        const placedIds = new Set(sim.towers.map((t) => t.unitId));
        for (const unitId of ids) {
          if (placedIds.has(unitId)) continue;
          let best = null;
          for (let y = 0.25; y < sim.map.height; y += 0.5) {
            for (let x = 0.25; x < sim.map.width; x += 0.5) {
              if (!sim.canPlace(unitId, x, y).ok) continue;
              let n = 0;
              for (const k of sim.pathTiles) {
                const [px, py] = k.split(',').map(Number);
                if (Math.hypot(px + 0.5 - x, py + 0.5 - y) <= 3.2) n++;
              }
              if (!best || n > best.s) best = { x, y, s: n };
            }
          }
          if (best) ui.act.place(unitId, best.x, best.y);
        }
        for (const t of sim.towers) {
          for (const p of [0, 2, 1]) {
            const st = sim.upgradeStatus(t.uid, p);
            if (!st.locked && st.next && sim.cash >= st.cost) ui.act.upgrade(t.uid, p);
          }
        }
        if (sim.state !== 'wave' && sim.state !== 'won' && sim.state !== 'lost') ui.startWave();
        for (let k = 0; k < 20 && sim.state !== 'won' && sim.state !== 'lost'; k++) sim.update(0.25);
        return sim.state;
      });
      await page.waitForTimeout(30);
    }
    return state;
  }
  async function saveAndQuit(page, expectText = null, shotName = null) {
    await page.evaluate(() => window.__battle.ui.openPause());
    await page.waitForSelector('[data-testid="pause-menu"]:not([hidden]) [data-testid="quit"]', { timeout: 20000 });
    if (shotName) await shot(page, shotName);
    const body = await openConfirm(page, '[data-testid="pause-menu"] [data-testid="quit"]');
    if (expectText) for (const t of expectText) check(body.includes(t), `Save & quit confirm says "${t}" (${JSON.stringify(body.slice(0, 160))})`);
    return body;
  }

  // ------------------------------------------------------------------------------------------
  log('\n--- 1-4: start, build, wave-start write, Save & quit mid-wave ---');
  const A = await freshLobby('A');
  await A.evaluate(() => { location.hash = '#/stage/1-1'; });
  await onScreen(A, 'stage', '#/stage/1-1');
  await tap(A, '[data-testid="diff-easy"]');
  await tap(A, '[data-testid="stage-start"]');
  if (!check(await battleReady(A), '1: Start opens the 1-1 battle')) throw new Error('battle did not load');
  let w = await where(A);
  check(!/resume=/.test(w.hash) && !(await savedRec(A)), `1: before any action there is no save and no &resume (${w.hash})`);

  const uids = await placeTwo(A);
  check(uids.length === 2, `2: two girls placed through the battle's actions (${uids.join(', ')})`);
  await A.evaluate(([a, b]) => {
    const { ui } = window.__battle;
    ui.act.upgrade(a, 0);
    ui.act.target(b, 'strong');
  }, uids);
  w = await where(A);
  const runId = (w.hash.match(/resume=([^&]+)/) || [])[1];
  check(!!runId && (await savedRec(A))?.id === runId, `2: the first action created the save and put &resume=${runId} in the URL`);
  const st2 = await playUntil(A, 2);
  check(st2.state === 'between' && st2.wave === 2, `2: waves 1-2 played (${JSON.stringify(st2)})`);
  const expected = await buildOf(A);
  log(`    expected build: ${expected.towers.length} girls, ${expected.cash} coins, ${expected.lives} lives`);

  // 3. starting wave 3 writes the calm state before it in the same task
  const atStart = await A.evaluate((k) => {
    window.__battle.ui.startWave();
    const rec = JSON.parse(localStorage.getItem(k)).battleSaves['1-1'];
    return { wave: window.__battle.sim.wave, state: window.__battle.sim.state, snap: rec.snap };
  }, SAVE_KEY);
  check(atStart.wave === 3 && atStart.state === 'wave', `3: wave 3 started (${atStart.wave} ${atStart.state})`);
  check(atStart.snap.wave === 2 && atStart.snap.state === 'between', `3: the stored snapshot is the calm start of wave 3 (snap.wave ${atStart.snap.wave}, ${atStart.snap.state})`);
  check(same(snapBuild(atStart.snap), { cash: expected.cash, lives: expected.lives, towers: expected.towers }), '3: … with exactly the build, coins and lives before the wave');

  // 4. an upgrade bought mid-wave is undone by Save & quit
  await A.evaluate((uid) => window.__battle.ui.act.upgrade(uid, 0), uids[0]);
  await saveAndQuit(A, ['start of wave 3', 'undone'], 'pause-menu');
  await shot(A, 'pause-save-quit-confirm');
  await answer(A, true);
  check(await onScreen(A, 'stage', '#/stage/1-1'), `4: Save & quit lands on 1-1 prep (${(await where(A)).hash})`);
  await A.waitForSelector('[data-testid="stage-continue"]', { timeout: 20000 }).catch(() => null);
  const contText = await text(A, '[data-testid="stage-continue"]');
  check(/Wave 3\//.test(contText), `4: prep shows "${contText.replace(/\s+/g, ' ')}"`);
  check(await A.locator('[data-testid="stage-new"]').count() === 1 && await A.locator('[data-testid="stage-start"]').count() === 0, '4: prep shows New game and no Start');
  check(/wave 3 of 12/.test(await text(A, '[data-testid="stage-saved"]')), `4: the saved line reads "${(await text(A, '[data-testid="stage-saved"]')).replace(/\s+/g, ' ')}"`);
  check((await savedRec(A))?.snap?.towers?.find((t) => t.uid === uids[0])?.tiers?.[0] === expected.towers.find((t) => t.uid === uids[0]).tiers[0], '4: the mid-wave upgrade is not in the save');
  await shot(A, 'prep-continue');
  await A.evaluate(() => { location.hash = '#/campaign?chapter=1'; });
  await onScreen(A, 'campaign');
  const badge = await A.waitForSelector('[data-testid="stage-1-1"] [data-testid="saved-badge"]', { timeout: 20000 }).catch(() => null);
  check(!!badge && /Saved · W3/.test(await badge.innerText()), `4: the 1-1 node on the campaign map shows "${badge ? await badge.innerText() : 'no badge'}"`);
  await shot(A, 'campaign-badge');
  // the lobby chip after a relaunch
  await A.evaluate(() => { location.hash = '#/lobby'; });
  await onScreen(A, 'lobby');
  // ([ui-ink] V2: a saved battle is the home objective's first choice; its play tile keeps the old chip's hook)
  const chip = await A.waitForSelector('[data-testid="lobby-objective"]:has([data-testid="lobby-continue"])', { timeout: 20000 }).catch(() => null);
  check(!!chip && /1-1/.test(await chip.innerText()) && /Wave 3/.test(await chip.innerText()), `12: the lobby's objective shows "${chip ? (await chip.innerText()).replace(/\s+/g, ' ') : 'no objective'}"`);
  await shot(A, 'lobby-continue');
  if (chip) {
    await tap(A, '[data-testid="lobby-continue"]');
    check(await onScreen(A, 'stage', '#/stage/1-1'), `12: the chip opens 1-1 prep, not the battle (${(await where(A)).hash})`);
  }

  // ------------------------------------------------------------------------------------------
  log('\n--- 5: Continue, then an app kill mid-wave ---');
  await tap(A, '[data-testid="stage-continue"]');
  if (check(await battleReady(A), '5: Continue opens the battle')) {
    const b = await buildOf(A);
    check(b.wave === 2 && b.state === 'between', `5: it lands between waves, wave 3 next (${b.wave} ${b.state})`);
    check(same(b.towers, expected.towers) && b.cash === expected.cash && b.lives === expected.lives, '5: the same girls, spots, tiers, target modes, coins and lives');
    check(await toastSeen(A, /Welcome back/), '5: "Welcome back!" toast');
    check((await savedRec(A))?.resumes === 1, `5: resumes = ${(await savedRec(A))?.resumes}`);
    await A.evaluate((uid) => {
      const { ui, sim } = window.__battle;
      ui.startWave();
      ui.act.upgrade(uid, 0);
      for (let k = 0; k < 12 && sim.state === 'wave'; k++) sim.update(0.25);
    }, uids[0]);
    // the app is killed: no pagehide, no visibilitychange; the storage is all that is left
    const storage = await A.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
    const B = await newContext('B', storage);
    await B.goto(`${base}#/stage/1-1`, { waitUntil: 'load' });
    await onScreen(B, 'stage', '#/stage/1-1', 60000);
    await B.waitForSelector('[data-testid="stage-continue"]', { timeout: 30000 }).catch(() => null);
    await tap(B, '[data-testid="stage-continue"]');
    if (check(await battleReady(B), '5: on the relaunched app, Continue opens the battle')) {
      const k = await buildOf(B);
      check(k.wave === 2 && k.state === 'between', `5: the start of wave 3 again (${k.wave} ${k.state})`);
      check(same(k.towers, expected.towers) && k.cash === expected.cash && k.lives === expected.lives, '5: the build, coins and lives from before the wave (the mid-wave upgrade is undone)');
      check(await toastSeen(B, /Welcome back/), '5: "Welcome back!" toast');
      check((await savedRec(B))?.resumes === 2, `5: resumes = ${(await savedRec(B))?.resumes}`);
      await shot(B, 'continued-battle');

      // 6. a reload of the battle page continues it; a link without &resume goes to prep
      const url = B.url();
      await B.reload({ waitUntil: 'load' });
      if (check(await battleReady(B), `6: reloading ${new URL(url).hash} reopens the battle`)) {
        const r = await buildOf(B);
        check(r.wave === 2 && r.state === 'between' && same(r.towers, expected.towers), `6: … continued, not restarted (${r.wave} ${r.state}, ${r.towers.length} girls)`);
      }
      await B.evaluate(() => {
        // record every toast (they fade after a few seconds; this machine may be slower than that)
        window.__toasts = [];
        new MutationObserver((list) => {
          for (const m of list) for (const n of m.addedNodes) if (n.classList?.contains('toast')) window.__toasts.push(n.textContent);
        }).observe(document.body, { childList: true, subtree: true });
        location.hash = '#/battle?stage=1-1&difficulty=easy';
      });
      check(await onScreen(B, 'stage', '#/stage/1-1'), `6: a battle link without &resume goes to prep (${(await where(B)).hash})`);
      await B.waitForFunction(() => window.__toasts?.length, null, { timeout: 15000 }).catch(() => null);
      const t6 = await B.evaluate(() => (window.__toasts || []).join(' | '));
      check(/saved battle here/.test(t6), `6: … with the toast "${t6}"`);
      check(!!(await savedRec(B)), '6: … and the save is untouched');

      // 7. New game asks first
      await B.waitForSelector('[data-testid="stage-new"]', { timeout: 20000 });
      const ask = await openConfirm(B, '[data-testid="stage-new"]');
      check(/wave 3/.test(ask) && /deleted/.test(ask), `7: New game asks first (${JSON.stringify(ask.slice(0, 140))})`);
      await shot(B, 'new-game-confirm');
      await answer(B, false);
      check(!!(await savedRec(B)) && (await B.locator('[data-testid="stage-continue"]').count()) === 1, '7: Keep it keeps the save');
      await openConfirm(B, '[data-testid="stage-new"]');
      await answer(B, true);
      if (check(await battleReady(B), '7: New game opens a fresh battle')) {
        const f = await B.evaluate(() => ({ wave: window.__battle.sim.wave, towers: window.__battle.sim.towers.length, cash: window.__battle.sim.cash, start: Math.round(window.__battle.sim.stage.startCash), hash: location.hash }));
        check(f.wave === 0 && f.towers === 0 && f.cash === f.start && !/resume=/.test(f.hash), `7: wave 0, no girls, start cash, no &resume (${JSON.stringify(f)})`);
        check(!(await savedRec(B)), '7: no save until the first action');

        // 8. paid once: progress, Save & quit, Continue, win
        await placeTwo(B);
        await saveAndQuit(B, ['Continue from wave 1 of 12']);
        await answer(B, true);
        await onScreen(B, 'stage', '#/stage/1-1');
        await tap(B, '[data-testid="stage-continue"]');
        if (check(await battleReady(B), '8: Continue opens the saved battle')) {
          const before = await storedProfile(B);
          const state = await winBattle(B);
          check(state === 'won', `8: the continued 1-1 is won (${state})`);
          await B.waitForSelector('[data-testid="view-rewards"]', { timeout: 60000 }).catch(() => null);
          const after = await storedProfile(B);
          check(!after.battleSaves['1-1'], '8: the save is gone in the payout write');
          check(after.stats.battles === before.stats.battles + 1 && after.stats.wins === before.stats.wins + 1, `8: one battle, one win (${before.stats.battles}→${after.stats.battles}, ${before.stats.wins}→${after.stats.wins})`);
          check(after.progress.stages['1-1']?.easy === true && after.currencies.gems > before.currencies.gems, `8: the Easy medal and first-clear gems are paid (${before.currencies.gems}→${after.currencies.gems} gems)`);
          const resumeUrl = B.url();
          check(/resume=/.test(resumeUrl), '8: the battle URL still names the run');
          await B.reload({ waitUntil: 'load' });
          const gone = await B.waitForSelector('[data-testid="save-gone-back"]', { timeout: 60000 }).catch(() => null);
          check(!!gone && /already finished/.test(await text(B, '.bt-error')), '8: reloading the old &resume link says "already finished or was replaced"');
          await shot(B, 'save-gone');
          const again = await storedProfile(B);
          check(again.stats.battles === after.stats.battles && again.currencies.gems === after.currencies.gems && again.stats.wins === after.stats.wins, '8: … and pays nothing again');
          if (gone) await tap(B, '[data-testid="save-gone-back"]');
          check(await onScreen(B, 'stage', '#/stage/1-1'), '8: Back to the stage');
        }
      }

      // 9. the team is frozen at New game
      await tap(B, '[data-testid="stage-start"]');
      if (check(await battleReady(B), '9: Start opens a new battle')) {
        const team = await B.evaluate(() => {
          const { sim, ui } = window.__battle;
          const ids = [...sim.loadout.keys()];
          return { ids, aoi: sim.loadout.get('aoi')?.damageMul ?? null, hero: sim.heroConfig?.unitId };
        });
        await placeTwo(B);
        await saveAndQuit(B);
        await answer(B, true);
        await onScreen(B, 'stage', '#/stage/1-1');
        await B.evaluate(() => {
          const { store } = window.__sakura;
          store.profile.units.aoi.level = 30;
          store.profile.units.aoi.breakthrough = 2;
          store.profile.formation.towers = ['rei'];
          store.commit('formation');
        });
        await tap(B, '[data-testid="stage-continue"]');
        if (check(await battleReady(B), '9: Continue after changing formation and levels')) {
          const now = await B.evaluate(() => {
            const { sim } = window.__battle;
            return { ids: [...sim.loadout.keys()], aoi: sim.loadout.get('aoi')?.damageMul ?? null, hero: sim.heroConfig?.unitId };
          });
          check(same(now, team), `9: the continued battle keeps the team and stats it started with (${JSON.stringify(now)} vs ${JSON.stringify(team)})`);

          // 11. Restart deletes the save
          await B.evaluate(() => window.__battle.ui.openPause());
          const r = await openConfirm(B, '[data-testid="pause-menu"] [data-testid="restart"]');
          check(/saved progress in it will be deleted/.test(r), `11: Restart asks first (${JSON.stringify(r.slice(0, 120))})`);
          await answer(B, true);
          await B.waitForFunction(() => window.__battle?.sim?.wave === 0 && window.__battle.sim.towers.length === 0 && window.__battle.ui?.placement, null, { timeout: 90000 }).catch(() => null);
          const rs = await B.evaluate(() => ({ wave: window.__battle?.sim?.wave, towers: window.__battle?.sim?.towers.length, hash: location.hash }));
          check(rs.wave === 0 && rs.towers === 0 && !/resume=/.test(rs.hash), `11: Restart starts at wave 0 without &resume (${JSON.stringify(rs)})`);
          check(!(await savedRec(B)), '11: … and the save is deleted');
        }
      }

      // 10. practice never saves
      await B.evaluate(() => { location.hash = '#/battle?stage=8-5&difficulty=normal'; });
      if (check(await battleReady(B), '10: a locked stage plays as practice')) {
        await placeTwo(B);
        await B.evaluate(() => {
          const { ui, sim } = window.__battle;
          ui.startWave();
          for (let k = 0; k < 8; k++) sim.update(0.25);
        });
        const label = await B.evaluate(() => {
          window.__battle.ui.openPause();
          return document.querySelector('[data-testid="pause-menu"] [data-testid="quit"]')?.innerText || '';
        });
        check(/^\s*Quit\s*$/.test(label), `10: practice keeps the plain Quit ("${label.trim()}")`);
        await openConfirm(B, '[data-testid="pause-menu"] [data-testid="quit"]');
        await answer(B, true);
        await onScreen(B, 'stage', '#/stage/8-5');
        const p = await storedProfile(B);
        check(!p.battleSaves['8-5'] && !Object.keys(p.battleSaves).length, `10: no save for a practice run (${JSON.stringify(Object.keys(p.battleSaves))})`);
      }
      await B.context().close();
    }
  }
  await A.context().close();

  // ------------------------------------------------------------------------------------------
  log('\n--- 13: a wave won and the app killed on the between-wave shop, then a lost Sim nobody ended ---');
  const C = await freshLobby('C');
  await C.evaluate(() => { location.hash = '#/stage/1-1'; });
  await onScreen(C, 'stage', '#/stage/1-1');
  await tap(C, '[data-testid="diff-easy"]');
  await tap(C, '[data-testid="stage-start"]');
  if (check(await battleReady(C), '13: Start opens 1-1')) {
    await placeTwo(C);
    // wave 1 is started and played to its end; no command after it, no lifecycle event
    const end1 = await C.evaluate(() => {
      const { sim, ui } = window.__battle;
      ui.startWave();
      for (let k = 0; k < 4000 && sim.state === 'wave'; k++) sim.update(0.25);
      return { wave: sim.wave, state: sim.state, cash: sim.cash };
    });
    check(end1.wave === 1 && end1.state === 'between', `13: wave 1 won, on the between-wave shop (${JSON.stringify(end1)})`);
    // a few frames go by (the battle loop writes the wave end once)
    await C.waitForFunction((k) => JSON.parse(localStorage.getItem(k))?.battleSaves?.['1-1']?.snap?.wave === 1, SAVE_KEY, { timeout: 30000, polling: 200 }).catch(() => null);
    const storage = await C.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
    const D = await newContext('D', storage);
    await D.goto(`${base}#/stage/1-1`, { waitUntil: 'load' });
    await onScreen(D, 'stage', '#/stage/1-1', 60000);
    const contText = await D.waitForSelector('[data-testid="stage-continue"]', { timeout: 30000 }).then(() => text(D, '[data-testid="stage-continue"]')).catch(() => '');
    check(/Wave 2\//.test(contText), `13: after the kill, prep offers the wave after the one won ("${contText.replace(/\s+/g, ' ')}")`);
    await tap(D, '[data-testid="stage-continue"]');
    if (check(await battleReady(D), '13: Continue on the relaunched app')) {
      const k = await buildOf(D);
      check(k.wave === 1 && k.state === 'between' && k.cash === end1.cash, `13: wave 1 kept with its bonus (${k.wave} ${k.state}, ${k.cash} coins)`);
      // the Sim reaches 'lost' but its event never reaches the controller (dropped): the battle
      // still ends, pays the defeat once and deletes the save instead of rewinding to a wave start
      const before = await storedProfile(D);
      await D.evaluate(() => {
        const { sim, ui } = window.__battle;
        ui.startWave();
        sim.drainEvents();
        sim.lives = 0;
        sim.state = 'lost';
      });
      const ended = await D.waitForFunction(() => window.__battle?.ui?.ended === true, null, { timeout: 60000, polling: 200 }).then(() => true).catch(() => false);
      check(ended, '13: a lost Sim whose event was dropped still ends the battle');
      const after = await storedProfile(D);
      check(!after.battleSaves['1-1'] && after.stats.battles === before.stats.battles + 1, `13: … paid once, the save gone (${before.stats.battles}→${after.stats.battles} battles)`);
    }
    await D.context().close();
  }
  await C.context().close();

  // ------------------------------------------------------------------------------------------
  log('\n--- 14: the Colosseum: Save & quit, Continue, End run ---');
  const E = await freshLobby('E');
  await E.evaluate(() => {
    const { store } = window.__sakura;
    for (const id of ['1-1', '1-2', '1-3', '1-4', '1-5', '2-1', '2-2', '2-3', '2-4', '2-5']) store.profile.progress.stages[id] = { easy: true, normal: false, hard: false, nightmare: false, clears: 1 };
    store.commit('replace');
    store.saveNow();
    location.hash = '#/stage/challenge';
  });
  await onScreen(E, 'stage', '#/stage/challenge');
  await tap(E, '[data-testid="stage-start"]');
  if (check(await battleReady(E), '14: Start endless opens the Colosseum')) {
    await placeTwo(E);
    const st = await playUntil(E, 2);
    check(st.state === 'between' && st.wave === 2, `14: two waves held (${JSON.stringify(st)})`);
    await saveAndQuit(E, ['Continue from wave 3']);
    await answer(E, true);
    check(await onScreen(E, 'stage', '#/stage/challenge'), '14: Save & quit lands on the Colosseum prep');
    const cont = await E.waitForSelector('[data-testid="stage-continue"]', { timeout: 20000 }).then(() => text(E, '[data-testid="stage-continue"]')).catch(() => '');
    check(/Wave 3/.test(cont) && !/\//.test(cont), `14: Continue · Wave 3, no total (${cont.replace(/\s+/g, ' ')})`);
    await E.evaluate(() => { location.hash = '#/challenge'; });
    await onScreen(E, 'challenge');
    const badge = await E.waitForSelector('[data-testid="saved-badge"]', { timeout: 20000 }).catch(() => null);
    check(!!badge && /W3/.test(await badge.innerText()), `14: the Colosseum card shows "${badge ? await badge.innerText() : 'no badge'}"`);
    await E.evaluate(() => { location.hash = '#/stage/challenge'; });
    await onScreen(E, 'stage', '#/stage/challenge');
    await tap(E, '[data-testid="stage-continue"]');
    if (check(await battleReady(E), '14: Continue opens the Colosseum run')) {
      const before = await storedProfile(E);
      const cleared = await E.evaluate(() => window.__battle.sim.wavesCleared);
      await E.evaluate(() => window.__battle.ui.openPause());
      const conf = await openConfirm(E, '[data-testid="pause-menu"] [data-testid="end-run"]');
      check(new RegExp(`${40 * cleared} coins`).test(conf), `14: End run says what it pays (${JSON.stringify(conf.slice(0, 120))})`);
      await answer(E, true);
      await E.waitForFunction(() => window.__battle?.ui?.ended === true, null, { timeout: 60000, polling: 200 }).catch(() => null);
      await E.waitForSelector('[data-testid="result"]:not([hidden])', { timeout: 60000 }).catch(() => null);
      const after = await storedProfile(E);
      check(!after.battleSaves.challenge, '14: End run deletes the save in the payout');
      check(after.currencies.coins === before.currencies.coins + 40 * cleared, `14: … and pays 40 × ${cleared} coins (${before.currencies.coins}→${after.currencies.coins})`);
      check(after.progress.stages.challenge?.bestWave === cleared, `14: best wave ${after.progress.stages.challenge?.bestWave}`);
      check(/RUN OVER/.test(await text(E, '[data-testid="result"]')), '14: the sheet says RUN OVER');
      await shot(E, 'end-run-result');
    }
  }
  await E.context().close();
}

await browser.close();
await server.close();
if (errors.length) {
  log('\nconsole / page errors:');
  for (const e of errors.slice(0, 20)) log(`  ${e}`);
}
check(!errors.length, `no console or page errors (${errors.length})`);
log(`\n${failures.length ? `${failures.length} check(s) FAILED` : 'battle-save: all checks passed'}`);
process.exit(failures.length ? 1 : 0);

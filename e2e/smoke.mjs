// End-to-end smoke test: boots the real game in Chromium (SwiftShader WebGL), visits every
// route with a fresh save, does a 10-pull, drags a girl from the tower bar onto the board
// (real pointer events), plays stage 1-1 on Easy to victory and checks that rewards, medals
// and bestiary discoveries were saved. Runs at 1280×720 (mouse), 844×390 (landscape phone,
// touch) and 390×844 (portrait phone, touch).
//
//   node e2e/smoke.mjs                 # all three viewports
//   node e2e/smoke.mjs --viewport 844x390 --shots /tmp/smoke   # one viewport + screenshots
//   node e2e/smoke.mjs --prod          # test the production build in dist/ (run `npm run build` first)
//
// Playwright and the browser are found by e2e/browser.mjs: set PLAYWRIGHT_MODULE (or NODE_PATH)
// when Playwright is not in node_modules, CHROME_PATH / PLAYWRIGHT_CHANNEL to pick the browser
// (the system Chrome or Edge is used when Playwright's own Chromium is not installed).
// Exit code 1 if any check fails. Starts its own Vite dev server on a free port (like e2e/shot.mjs).
import { createServer, preview } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport', null) ? [opt('viewport')] : ['1280x720', '844x390', '390x844'];
const shotsDir = opt('shots', null);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

// Console noise that is not a game bug (headless GPU / SwiftShader chatter).
const IGNORE = [
  /GPU stall due to ReadPixels/i,
  /WebGL: too many errors/i,
  /Automatic fallback to software WebGL/i,
  /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i,
  /favicon\.ico/i,
  // web fonts come from Google Fonts; offline / proxied sandboxes cannot reach them and the
  // game falls back to system fonts. Local request failures are caught via 'requestfailed'.
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

const prod = args.includes('--prod');
let server;
if (prod) {
  server = await preview({ root: process.cwd(), preview: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
} else {
  server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
}
const { port } = server.httpServer.address();
const base = `http://127.0.0.1:${port}/`;
let browser;
try {
  const launched = await launchChromium();
  browser = launched.browser;
  log(`browser: ${launched.label}`);
} catch (e) {
  await (server.close ? server.close() : new Promise((r) => server.httpServer.close(r)));
  throw e;
}

const ROUTES = [
  ['lobby', '#/lobby'],
  ['missions', '#/missions'],
  ['campaign', '#/campaign'],
  ['stage 1-1', '#/stage/1-1'],
  ['students', '#/students'],
  ['student aoi info', '#/student/aoi?tab=info'],
  ['student aoi level', '#/student/aoi?tab=level'],
  ['student aoi awaken', '#/student/aoi?tab=awaken'],
  ['student aoi gear', '#/student/aoi?tab=gear'],
  ['student aoi tree', '#/student/aoi?tab=tree'],
  ['student hikari 3d', '#/student/hikari?tab=info'],
  ['formation', '#/formation'],
  ['recruit', '#/recruit'],
  ['backpack', '#/backpack'],
  ['backpack equipment', '#/backpack?tab=equipment'],
  ['bounty', '#/bounty'],
  ['assault', '#/assault'],
  ['challenge', '#/challenge'],
  ['mall', '#/mall'],
  ['commissions', '#/commissions'],
  ['rewards', '#/rewards'],
  ['bestiary', '#/bestiary'],
  ['wiki', '#/wiki'],
  ['wiki article', '#/wiki/type-chart'],
  ['settings', '#/settings'],
];

async function runViewport(vp) {
  const [w, hgt] = vp.split('x').map(Number);
  log(`\n=== viewport ${vp} ===`);
  // phones are touch devices in either orientation (844×390 is the landscape-first target)
  const touch = Math.min(w, hgt) < 600;
  const context = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1, hasTouch: touch });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (!IGNORE.some((re) => re.test(t))) errors.push(`[console] ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => {
    if (r.url().startsWith(base)) errors.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText || ''}`);
  });
  page.on('response', (r) => {
    if (r.url().startsWith(base) && r.status() >= 400) errors.push(`[http ${r.status()}] ${r.url()}`);
  });
  const takeErrors = () => errors.splice(0);
  const shot = async (name) => {
    if (shotsDir) await page.screenshot({ path: `${shotsDir}/${vp}-${name.replace(/[^\w-]+/g, '_')}.png` });
  };

  // fresh save
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${base}#/lobby`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura && document.querySelector('#app')?.children.length > 0, null, { timeout: 30000 });
  check(await page.evaluate(() => !!window.__sakura.store.profile.units.aoi), 'fresh profile owns starter Aoi');

  // ---- every route ----
  for (const [label, hash] of ROUTES) {
    await page.evaluate((h) => { location.hash = h; }, hash);
    await page.waitForTimeout(label.includes('student') || label === 'lobby' || label === 'bestiary' || label === 'assault' ? 1600 : 900);
    const info = await page.evaluate(() => {
      const app = document.querySelector('#app');
      const text = (app?.innerText || '').trim();
      return { screen: app?.dataset.screen, len: text.length, crashed: /Something went wrong/.test(text), overflow: document.documentElement.scrollWidth > window.innerWidth + 1 };
    });
    const errs = takeErrors();
    check(info.len > 40 && !info.crashed, `${label}: renders content (${info.len} chars, screen=${info.screen})`);
    check(!errs.length, `${label}: no page/console errors${errs.length ? `\n       ${errs.slice(0, 5).join('\n       ')}` : ''}`);
    check(!info.overflow, `${label}: no horizontal page overflow`);
    await shot(label);
  }

  // student card art ⇄ 3D toggle
  await page.evaluate(() => { location.hash = '#/student/aoi?tab=info'; });
  await page.waitForTimeout(1200);
  const has3d = await page.$('[data-testid="view-chibi"], [data-testid="view-3d"]');
  if (has3d) {
    await has3d.click();
    await page.waitForTimeout(1500);
    check(await page.evaluate(() => !!document.querySelector('#app canvas')), 'student detail: 3D chibi canvas shown');
    await shot('student-3d');
  } else check(false, 'student detail: 3D toggle button exists');
  check(!takeErrors().length, 'student 3D: no errors');

  // ---- recruit 10-pull ----
  await page.evaluate(() => { location.hash = '#/recruit'; });
  await page.waitForSelector('[data-testid="pull-10"]', { timeout: 10000 });
  const before = await page.evaluate(() => ({ pulls: window.__sakura.store.profile.gacha.totalPulls, owned: Object.keys(window.__sakura.store.profile.units).length }));
  await page.click('[data-testid="pull-10"]');
  const confirm = await page.waitForSelector('[data-testid="confirm-pull"]', { timeout: 1500 }).catch(() => null);
  if (confirm) await confirm.click();
  const skip = await page.waitForSelector('[data-testid="reveal-skip"]', { timeout: 5000 }).catch(() => null);
  if (skip) await skip.click().catch(() => {});
  await page.waitForSelector('[data-testid="reveal-close"]', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(1500);
  await shot('recruit-results');
  const after = await page.evaluate(() => ({ pulls: window.__sakura.store.profile.gacha.totalPulls, owned: Object.keys(window.__sakura.store.profile.units).length, hist: window.__sakura.store.profile.gacha.history.length }));
  check(after.pulls === before.pulls + 10, `recruit: 10 pulls recorded (${before.pulls} → ${after.pulls})`);
  check(after.owned >= before.owned, `recruit: roster updated (${before.owned} → ${after.owned} girls)`);
  const close = await page.$('[data-testid="reveal-close"]');
  if (close) await close.click();
  await page.waitForTimeout(400);
  // Tracking stays live on the screen (playtester: it only updated after leaving and coming back):
  // the pity line and gem pill must match the profile after Close, and after "Recruit again" is
  // cancelled at the gem confirm.
  const recruitLive = () => page.evaluate(() => {
    const g = window.__sakura.store.profile.gacha;
    const foot = document.querySelector('#app .ma-pity-foot')?.textContent || '';
    const gemsPill = Number((document.querySelector('#app .ma-tickets .ma-ticket-pill:last-child b')?.textContent || '').replace(/\D/g, ''));
    const ok = foot.startsWith(`${g.pity}/`) && foot.includes(`· ${g.totalPulls.toLocaleString('en-US')} recruits`) && gemsPill === window.__sakura.store.profile.currencies.gems;
    return { ok, text: `"${foot}", gems pill ${gemsPill} (profile: pity ${g.pity}, ${g.totalPulls} pulls, ${window.__sakura.store.profile.currencies.gems} gems)` };
  });
  let live = await recruitLive();
  check(live.ok, `recruit: page updated after Close without leaving — ${live.text}`);
  await page.click('[data-testid="pull-1"]');
  const confirm1 = await page.waitForSelector('[data-testid="confirm-pull"]', { timeout: 3000 }).catch(() => null);
  if (check(!!confirm1, 'recruit: ×1 button still works after a reveal (gem confirm shown)')) {
    await confirm1.click();
    await page.click('[data-testid="reveal-skip"]', { timeout: 5000 }).catch(() => {});
    const again = await page.waitForSelector('[data-testid="reveal-again"]', { timeout: 15000 }).catch(() => null);
    if (again) await again.click();
    const confirm2 = await page.waitForSelector('[data-testid="confirm-pull"]', { timeout: 3000 }).catch(() => null);
    if (check(!!confirm2, 'recruit: "Recruit ×1 again" asks to confirm gems')) {
      await page.click('.modal-actions .btn:has-text("Cancel")');
      await page.waitForTimeout(400);
      live = await recruitLive();
      check(live.ok, `recruit: page updated after "again" was cancelled — ${live.text}`);
    }
  }
  check(!takeErrors().length, 'recruit: no errors');

  // ---- UI flows: teleport, mall purchase, commission claim ----
  const clickModalOk = async () => {
    const okBtn = await page.waitForSelector('[data-testid="buy-confirm"], [data-testid="confirm-ok"]', { timeout: 3000 }).catch(() => null);
    if (okBtn) await okBtn.click();
  };
  await page.evaluate(() => { location.hash = '#/backpack?tab=enhancement'; });
  await page.waitForTimeout(900);
  const tile = await page.$('#app .item-tile');
  if (check(!!tile, 'backpack: has item tiles')) {
    await tile.click();
    await page.waitForTimeout(500);
    let tp = await page.$('[data-testid^="teleport-"]');
    if (!tp) {
      // meta-b opens its own detail panel first; its "where to get" list carries the teleports
      const more = await page.$('#app [data-testid^="teleport-"], .modal [data-testid^="teleport-"]');
      tp = more;
    }
    if (check(!!tp, 'item info: Teleport button present')) {
      await tp.click();
      await page.waitForTimeout(900);
      check(await page.evaluate(() => location.hash.startsWith('#/stage/')), 'Teleport opens stage prep');
    }
  }
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
  await page.evaluate(() => { location.hash = '#/mall?tab=general'; });
  await page.waitForTimeout(900);
  const coins0 = await page.evaluate(() => window.__sakura.store.profile.currencies.coins);
  const books0 = await page.evaluate(() => window.__sakura.store.profile.items.book_common || 0);
  const buy = await page.$('[data-testid="buy-gen_book_common"]');
  if (check(!!buy, 'mall: General offer visible')) {
    await buy.click();
    await clickModalOk();
    await page.waitForTimeout(700);
    const after = await page.evaluate(() => ({ coins: window.__sakura.store.profile.currencies.coins, books: window.__sakura.store.profile.items.book_common || 0 }));
    check(after.coins < coins0 && after.books > books0, `mall: purchase paid coins and granted books (${books0} → ${after.books})`);
  }
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
  await page.evaluate(() => { location.hash = '#/commissions?tab=daily'; });
  await page.waitForTimeout(900);
  const gems0 = await page.evaluate(() => window.__sakura.store.profile.currencies.gems);
  const claim = await page.$('[data-testid="claim-d_login"], [data-testid="claim-all"]:not([disabled])');
  if (check(!!claim, 'commissions: login commission claimable')) {
    await claim.click();
    await page.waitForTimeout(900);
    check(await page.evaluate((g) => window.__sakura.store.profile.currencies.gems > g, gems0), 'commissions: claim paid gems');
  }
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
  // a redeemed code shows up in the tab's "Redeemed" list without leaving it
  await page.evaluate(() => { location.hash = '#/commissions?tab=codes'; });
  await page.waitForSelector('[data-testid="code-input"]', { timeout: 5000 });
  await page.fill('[data-testid="code-input"]', 'SAKURA2026');
  await page.click('[data-testid="code-redeem"]');
  await page.waitForTimeout(600);
  const codes = await page.evaluate(() => ({ shown: [...document.querySelectorAll('#app .ma-redeemed .chip')].map((c) => c.textContent.trim()), saved: window.__sakura.store.profile.redeemed || [] }));
  check(codes.saved.includes('SAKURA2026') && JSON.stringify(codes.shown) === JSON.stringify(codes.saved), `commissions: redeemed code listed without leaving the tab (${JSON.stringify(codes.shown)} vs ${JSON.stringify(codes.saved)})`);
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));
  check(!takeErrors().length, 'UI flows: no errors');

  // ---- battle 1-1 on easy ----
  await page.evaluate(() => { location.hash = '#/battle?stage=1-1&difficulty=easy'; });
  await page.waitForFunction(() => window.__battle?.ui?.placement, null, { timeout: 30000 });
  await page.waitForTimeout(800);

  // Real drag-and-release placement ("release does nothing" was the owner's original bug):
  // press a tower-bar card, drag it onto open ground and let go → she stands where the pointer
  // let go. Mouse on desktop, touch on phones. A touch drag aims 46 px above the finger
  // (TOUCH_LIFT in src/ui/battle/placement.js), so the finger is released that far below the spot.
  const lift = touch ? 46 : 0;
  // the battle screen slides in (slow under SwiftShader): aim only once the board stopped moving
  await page.waitForFunction(() => {
    for (let el = window.__battle.renderer.canvas; el; el = el.parentElement) {
      if (el.getAnimations().some((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity)) return false;
    }
    return true;
  }, null, { timeout: 15000 }).catch(() => null);
  const drag = await page.evaluate((liftPx) => {
    const { sim, renderer, ui } = window.__battle;
    const unitId = [...sim.loadout.keys()].find((id) => sim.data.unit(id)?.placement === 'land' && sim.cash >= sim.placeCost(id));
    if (!unitId) return null;
    const canvas = renderer.canvas;
    const barTop = ui.bar.el.getBoundingClientRect().top;
    const rect = canvas.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const midY = (rect.top + Math.min(rect.bottom, barTop)) / 2;
    const roomy = (x, y) => [[0, 0], [0.12, 0], [-0.12, 0], [0, 0.12], [0, -0.12]].every(([dx, dy]) => sim.canPlace(unitId, x + dx, y + dy).ok);
    let best = null;
    for (let y = 0.3; y < sim.map.height; y += 0.5) {
      for (let x = 0.3; x < sim.map.width; x += 0.5) {
        if (!roomy(x, y)) continue;
        const s = renderer.worldToScreen(x, y, 0);
        const rx = s.clientX;
        const ry = s.clientY + liftPx; // where the pointer is released
        if (!s.visible || rx < 8 || rx > innerWidth - 8 || s.clientY < 8 || ry > barTop - 8) continue;
        if (document.elementFromPoint(s.clientX, s.clientY) !== canvas) continue; // not under the HUD
        const p = renderer.pick(s.clientX, s.clientY);
        if (!p.inBounds || Math.hypot(p.x - x, p.y - y) > 0.05) continue;
        const d = Math.hypot(s.clientX - midX, s.clientY - midY);
        if (!best || d < best.d) best = { x, y, rx, ry, d };
      }
    }
    return best && { unitId, ...best, towers: sim.towers.length };
  }, lift);
  if (check(!!drag, 'drag: found open ground on screen for a tower-bar girl')) {
    const card = page.locator(`[data-testid="card-${drag.unitId}"]`);
    await card.scrollIntoViewIfNeeded();
    const box = await card.boundingBox();
    const sx = box.x + box.width / 2;
    const sy = box.y + box.height / 2;
    // up out of the bar first (the bar starts a drag on an upward move), then glide to the spot
    const route = [1, 2, 3].map((i) => [sx, sy - 10 * i]);
    for (let i = 1; i <= 15; i++) route.push([sx + ((drag.rx - sx) * i) / 15, sy - 30 + ((drag.ry - (sy - 30)) * i) / 15]);
    const holding = async () => {
      // pointermove is dispatched once per animation frame (slow under SwiftShader): let the
      // ghost catch up with the last move before reading it
      await page.waitForFunction(([x, y]) => {
        const l = window.__battle.ui.placement.last;
        return !!l && Math.hypot(l.x - x, l.y - y) < 0.1;
      }, [drag.x, drag.y], { timeout: 5000 }).catch(() => null);
      return page.evaluate(() => {
        const pl = window.__battle.ui.placement;
        return { unitId: pl.unitId, mode: pl.mode, ok: pl.last?.ok ?? null, at: pl.last ? [+pl.last.x.toFixed(2), +pl.last.y.toFixed(2)] : null };
      });
    };
    let mid;
    if (touch) {
      const cdp = await context.newCDPSession(page);
      const touchEvent = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
      await touchEvent('touchStart', sx, sy);
      for (const [x, y] of route) await touchEvent('touchMove', x, y);
      mid = await holding();
      await touchEvent('touchEnd');
      await cdp.detach();
    } else {
      await page.mouse.move(sx, sy);
      await page.mouse.down();
      for (const [x, y] of route) await page.mouse.move(x, y);
      mid = await holding();
      await page.mouse.up();
    }
    await page.waitForTimeout(300);
    const res = await page.evaluate((id) => {
      const { sim, ui } = window.__battle;
      const t = sim.towers.filter((tw) => tw.unitId === id).pop();
      return { towers: sim.towers.length, at: t ? [+t.x.toFixed(2), +t.y.toFixed(2)] : null, placing: ui.placement.unitId };
    }, drag.unitId);
    const how = touch ? 'touch' : 'mouse';
    check(mid.mode === 'drag' && mid.unitId === drag.unitId && mid.ok === true, `drag (${how}): holding ${drag.unitId}'s card over open ground shows a valid ghost (${JSON.stringify(mid)})`);
    check(res.towers === drag.towers + 1 && !!res.at && Math.hypot(res.at[0] - drag.x, res.at[1] - drag.y) < 0.25, `drag (${how}): releasing places ${drag.unitId} where the pointer let go (aimed [${drag.x}, ${drag.y}] → ${JSON.stringify(res.at)})`);
    check(res.placing === null, `drag (${how}): placement ends after the drop`);
    await shot('battle-drag-placed');
  }
  check(!takeErrors().length, 'drag placement: no errors');

  // helper installed in the page: place every not-yet-placed girl on her best spot. Placement
  // is free (continuous, placement-v2): candidates are a 0.5-tile lattice of NON-integer points
  // (two integers would be read as a legacy tile call), scored by path coverage.
  await page.evaluate(() => {
    window.__smokePlace = () => {
      const { sim, ui } = window.__battle;
      const ids = [...sim.loadout.keys(), ...(sim.heroConfig ? [sim.heroConfig.unitId] : [])];
      const placedIds = new Set(sim.towers.map((t) => t.unitId));
      const score = (x, y) => {
        let n = 0;
        for (const k of sim.pathTiles) {
          const [px, py] = k.split(',').map(Number);
          if (Math.hypot(px + 0.5 - x, py + 0.5 - y) <= 3.2) n++;
        }
        return n;
      };
      for (const unitId of ids) {
        if (placedIds.has(unitId)) continue;
        let best = null;
        for (let y = 0.25; y < sim.map.height; y += 0.5) {
          for (let x = 0.25; x < sim.map.width; x += 0.5) {
            if (!sim.canPlace(unitId, x, y).ok) continue;
            const s = score(x, y);
            if (!best || s > best.s) best = { x, y, s };
          }
        }
        if (!best) continue;
        ui.placement.start(unitId);
        if (!ui.placement.tryPlace(best.x, best.y)) ui.placement.cancel();
      }
      return { placed: sim.towers.map((t) => t.unitId), towers: sim.towers.length, cash: sim.cash, spots: sim.towers.map((t) => [+t.x.toFixed(2), +t.y.toFixed(2)]) };
    };
  });
  const placed = await page.evaluate(() => window.__smokePlace());
  check(placed.towers >= 1, `battle: placed ${placed.towers} girl(s) via free placement (${placed.placed.join(', ')} at ${JSON.stringify(placed.spots)})`);
  check(placed.spots.every(([x, y]) => !Number.isInteger(x) && !Number.isInteger(y)), 'battle: girls stand at continuous (non-tile) positions');
  check(await page.evaluate(() => { const t = window.__battle.sim.towers[0]; return t && t.tx === Math.floor(t.x) && t.ty === Math.floor(t.y) && t.radius > 0; }), 'battle: TowerRT carries tx/ty under the footprint centre and a radius');
  await page.evaluate(() => { const { ui } = window.__battle; ui.setAutoStart(true); ui.startWave(); ui.speed = 3; });
  await page.waitForTimeout(2500);
  await shot('battle-midwave');

  // fast-forward: advance the sim in chunks, spending coins on upgrades as we go
  let state = 'wave';
  for (let i = 0; i < 400 && state !== 'won' && state !== 'lost'; i++) {
    state = await page.evaluate(() => {
      const { sim } = window.__battle;
      window.__smokePlace();
      for (const t of sim.towers) {
        for (const p of [0, 2, 1]) {
          const st = sim.upgradeStatus(t.uid, p);
          if (!st.locked && st.next && sim.cash >= st.cost) sim.upgradeTower(t.uid, p);
        }
      }
      for (let k = 0; k < 20 && sim.state !== 'won' && sim.state !== 'lost'; k++) sim.update(0.25);
      if (sim.state === 'between') sim.startNextWave();
      return sim.state;
    });
    await page.waitForTimeout(40);
  }
  const summary = await page.evaluate(() => ({ state: window.__battle?.sim.state, wave: window.__battle?.sim.wave, lives: window.__battle?.sim.lives }));
  check(summary.state === 'won', `battle: stage 1-1 easy won (state=${summary.state}, wave ${summary.wave}, lives ${summary.lives})`);
  await page.waitForSelector('[data-testid="result"]:not([hidden])', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(1200);
  await shot('battle-victory');
  const rewardsBtn = await page.$('[data-testid="view-rewards"]');
  check(!!rewardsBtn, 'battle: victory sheet with Rewards button');
  if (rewardsBtn) {
    await rewardsBtn.click();
    await page.waitForSelector('[data-testid="rewards"]', { timeout: 5000 }).catch(() => null);
    await page.waitForTimeout(1500);
    check(!!(await page.$('[data-testid="rewards"]')), 'battle: rewards view opened');
    await shot('battle-rewards');
  }
  const prog = await page.evaluate(() => {
    const p = window.__sakura.store.profile;
    return {
      medal: p.progress.stages['1-1']?.easy,
      clears: p.progress.stages['1-1']?.clears,
      discovered: Object.entries(p.bestiary).filter(([, b]) => b.discovered).map(([id]) => id),
      saved: !!JSON.parse(localStorage.getItem('sakura-sentinels-save-v1') || '{}').progress?.stages?.['1-1']?.easy,
    };
  });
  check(prog.medal === true && prog.clears >= 1, `progress: 1-1 easy medal saved (clears=${prog.clears})`);
  check(prog.discovered.length > 0, `bestiary: discovered ${prog.discovered.join(', ')}`);
  check(prog.saved, 'progress persisted to localStorage');
  check(!takeErrors().length, 'battle: no errors');

  // next stage → prep screen, then quit back to lobby
  const next = await page.$('[data-testid="next-stage"]');
  if (next) {
    await next.click();
    await page.waitForTimeout(1200);
    check(await page.evaluate(() => location.hash.startsWith('#/stage/1-2')), 'Next Stage opens 1-2 prep');
  }
  check(await page.evaluate(() => !window.__battle && document.querySelectorAll('canvas').length <= 1), 'battle cleaned up after leaving');

  // sweep: mark 1-1 cleared on Hard, then sweep ×1 from stage prep
  await page.evaluate(() => {
    const p = window.__sakura.store.profile;
    Object.assign(p.progress.stages['1-1'], { hard: true });
    window.__sakura.store.commit('test');
  });
  await page.evaluate(() => { location.hash = '#/stage/1-1?difficulty=hard'; });
  await page.waitForTimeout(1200);
  const coinsS = await page.evaluate(() => window.__sakura.store.profile.currencies.coins);
  const sw = await page.$('[data-testid="sweep-1"]:not([disabled])');
  if (check(!!sw, 'stage prep: Sweep enabled after a Hard clear')) {
    await sw.click();
    await page.waitForTimeout(1200);
    check(await page.evaluate((c) => window.__sakura.store.profile.currencies.coins > c, coinsS), 'sweep: rewards granted');
    // the Clears fact behind the rewards modal follows the sweep without leaving the stage
    const clearsFact = await page.evaluate(() => {
      const n = window.__sakura.store.profile.progress.stages['1-1'].clears;
      const fact = [...document.querySelectorAll('#app .ma-facts > *')].find((f) => /clears/i.test(f.textContent))?.textContent || '';
      return { ok: fact.replace(/\D/g, '') === String(n), text: `"${fact}" (profile: ${n} clears)` };
    });
    check(clearsFact.ok, `sweep: stage prep Clears count updated without leaving — ${clearsFact.text}`);
    await shot('sweep');
  }
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));

  // bestiary shows the discovered slime
  await page.evaluate(() => { location.hash = '#/bestiary'; });
  await page.waitForTimeout(1500);
  check(!takeErrors().length, 'bestiary after win: no errors');

  await context.close();
}

try {
  for (const vp of viewports) await runViewport(vp);
} catch (e) {
  failures.push(`crashed: ${e.stack || e.message}`);
  log(`CRASH ${e.stack || e.message}`);
} finally {
  await browser.close();
  await (server.close ? server.close() : new Promise((r) => server.httpServer.close(r)));
}
log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL SMOKE CHECKS PASSED');
process.exit(failures.length ? 1 : 0);

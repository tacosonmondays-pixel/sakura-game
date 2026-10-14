// End-to-end check of the hero rework (docs/specs/HERO_REWORK.md §12, §10.6) in Chromium with a
// fresh profile, at 844×390 (landscape phone, touch) and 1280×720 (mouse):
//   stage 1-2: the hero card says FREE and is armed at wave 0 → one tap on the grass places her
//   for 0 coins; she gains XP during waves, not between them; the Level up pill buys a level at
//   the price it shows; her panel shows the track (25 rows), Level up and Move (no Sell); Move
//   between waves is instant and keeps her level, Move in a wave pauses her and recharges;
//   PC keys Q (ult) and L (level); the student page and formation say Free.
// Screenshots of every state go to --shots <dir> (default: the scratch dir printed at the end).
//
//   node e2e/hero.mjs                        # both viewports
//   node e2e/hero.mjs --viewport 844x390 --shots /tmp/hero
import { createServer } from 'vite';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport', null) ? [opt('viewport')] : ['844x390', '1280x720'];
const shotsDir = opt('shots', null) || mkdtempSync(join(tmpdir(), 'ss-hero-'));
mkdirSync(shotsDir, { recursive: true });

const IGNORE = [
  /GPU stall due to ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i, /favicon\.ico/i,
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
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser, label } = await launchChromium();
log(`browser: ${label}`);

async function runViewport(vp) {
  const [w, hgt] = vp.split('x').map(Number);
  const touch = Math.min(w, hgt) < 600;
  log(`\n=== viewport ${vp} ===`);
  const context = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1, hasTouch: touch });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !IGNORE.some((re) => re.test(m.text()))) errors.push(`[console] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  const shot = (name) => page.screenshot({ path: `${shotsDir}/${vp}-${name}.png` }).catch((e) => log(`  (screenshot ${name} skipped: ${e.message.split('\n')[0]})`));
  const tapAt = async (x, y) => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
  const tapEl = async (sel) => {
    const box = await page.locator(sel).first().boundingBox();
    if (!box) return false;
    await tapAt(box.x + box.width / 2, box.y + box.height / 2);
    return true;
  };
  /** A screen point on open ground where `ok(x, y)` holds (in the page), near the board's centre. */
  const spotWhere = (kind) => page.evaluate((k) => {
    const { sim, renderer, ui } = window.__battle;
    const barTop = ui.bar.el.getBoundingClientRect().top;
    const hero = sim.hero;
    const ok = (x, y) => (k === 'place' ? sim.canPlace(sim.heroConfig.unitId, x, y).ok : sim.canMoveHero(x, y).ok && Math.hypot(x - hero.x, y - hero.y) > 2);
    const roomy = (x, y) => [[0, 0], [0.12, 0], [-0.12, 0], [0, 0.12], [0, -0.12]].every(([dx, dy]) => ok(x + dx, y + dy));
    const rect = renderer.canvas.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const midY = (rect.top + Math.min(rect.bottom, barTop)) / 2;
    let best = null;
    for (let y = 0.3; y < sim.map.height; y += 0.4) {
      for (let x = 0.3; x < sim.map.width; x += 0.4) {
        if (!roomy(x, y)) continue;
        const s = renderer.worldToScreen(x, y, 0);
        if (!s.visible || s.clientX < 20 || s.clientX > innerWidth - 20 || s.clientY < 70 || s.clientY > barTop - 12) continue;
        if (document.elementFromPoint(s.clientX, s.clientY) !== renderer.canvas) continue;
        const p = renderer.pick(s.clientX, s.clientY);
        if (!p.inBounds || !ok(p.x, p.y)) continue;
        const d = Math.hypot(s.clientX - midX, s.clientY - midY);
        if (!best || d < best.d) best = { x: p.x, y: p.y, cx: s.clientX, cy: s.clientY, d };
      }
    }
    return best;
  }, kind);
  /** Runs the solo sim forward (game seconds) from the page. */
  const fastForward = (seconds) => page.evaluate((s) => {
    const { sim } = window.__battle;
    for (let i = 0; i < s * 4 && sim.state !== 'won' && sim.state !== 'lost'; i++) sim.update(0.25);
  }, seconds);

  // fresh profile → title → lobby
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura && document.querySelector('#app')?.children.length > 0, null, { timeout: 30000 });
  const startBtn = await page.waitForSelector('[data-testid="title-start"]:not([disabled])', { timeout: 30000 }).catch(() => null);
  if (startBtn) await startBtn.click({ force: true });
  await page.waitForFunction(() => location.hash.startsWith('#/lobby'), null, { timeout: 15000 }).catch(() => null);
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach((m) => m.remove()));

  // ---- outside battle: the student page and the formation say Free ----
  await page.evaluate(() => { location.hash = '#/student/hikari?tab=info'; });
  await page.waitForTimeout(1500);
  const studentText = await page.evaluate(() => document.querySelector('#app')?.innerText || '');
  check(/Deploy cost\s*Free/i.test(studentText), 'student page: Deploy cost Free');
  check(/Battle levels \(1.25\)/i.test(studentText) && /Dawnblade Ascendant/.test(studentText), 'student page: the Hero section lists the 25 battle levels');
  await shot('student-hero');
  await page.evaluate(() => { location.hash = '#/student/hikari?tab=tree'; });
  await page.waitForTimeout(1000);
  check(/Noon Absolute/.test(await page.evaluate(() => document.querySelector('#app')?.innerText || '')), 'student Tree tab: shows the track');
  await shot('student-tree');
  await page.evaluate(() => { location.hash = '#/formation'; });
  await page.waitForTimeout(1200);
  const formText = await page.evaluate(() => document.querySelector('#app')?.innerText || '');
  check(/free in battle/i.test(formText), 'formation: hero slot says "free in battle"');
  await shot('formation');

  // ---- battle 1-2 ----
  await page.evaluate(() => { location.hash = '#/battle?stage=1-2&difficulty=normal'; });
  await page.waitForFunction(() => window.__battle?.ui?.placement && window.__battle.ui.heroLevels, null, { timeout: 90000 });
  await page.waitForFunction(() => window.__battle.ui.placement.unitId === window.__battle.sim.heroConfig?.unitId, null, { timeout: 10000 }).catch(() => null);
  const card = await page.evaluate(() => {
    const { sim, ui } = window.__battle;
    const id = sim.heroConfig.unitId;
    const el = document.querySelector(`[data-testid="card-${id}"]`);
    return { id, cost: el?.querySelector('.bt-card-cost')?.innerText || '', armed: ui.placement.unitId === id, pulse: el?.classList.contains('bt-card-hero-arm'), cash: sim.cash };
  });
  check(/^free$/i.test(card.cost.trim()), `hero card says FREE (${card.cost})`);
  check(card.armed && card.pulse, 'hero card is armed (and pulses) at wave 0');
  await page.waitForTimeout(600);
  await shot('wave0-free-card');
  const spot = await spotWhere('place');
  if (check(!!spot, 'found open ground for her')) await tapAt(spot.cx, spot.cy);
  await page.waitForFunction(() => !!window.__battle.sim.hero, null, { timeout: 8000 }).catch(() => null);
  const placed = await page.evaluate(() => ({ hero: !!window.__battle.sim.hero, cash: window.__battle.sim.cash, deployed: document.querySelector('[data-testid="hero-card-deployed"]')?.innerText || '' }));
  check(placed.hero && placed.cash === card.cash, `one tap on the grass placed her for 0 coins (cash ${card.cash} → ${placed.cash})`);
  await page.waitForTimeout(400);
  check(/Deployed · Lv 1/i.test(placed.deployed) || (await page.evaluate(() => document.querySelector('[data-testid="hero-card-deployed"]')?.innerText || '')).match(/Lv 1/), 'card reads "Deployed · Lv 1"');

  // ---- XP in waves, not between ----
  await page.evaluate(() => window.__battle.ui.startWave());
  await fastForward(20);
  const inWave = await page.evaluate(() => ({ xp: window.__battle.sim.hero.xp, lv: window.__battle.sim.hero.level, state: window.__battle.sim.state }));
  check(inWave.xp > 0, `she gains XP during the wave (${Math.round(inWave.xp)} XP, Lv ${inWave.lv})`);
  await page.evaluate(() => {
    const { sim } = window.__battle;
    for (let i = 0; i < 600 && sim.state === 'wave'; i++) sim.update(0.25);
  });
  const between0 = await page.evaluate(() => ({ xp: window.__battle.sim.hero.xp, state: window.__battle.sim.state }));
  await page.evaluate(() => {
    const { sim } = window.__battle;
    sim.options.autoStart = false;
    sim._autoTimer = -1;
    for (let i = 0; i < 20; i++) sim.update(0.25);
  });
  const between1 = await page.evaluate(() => ({ xp: window.__battle.sim.hero.xp, state: window.__battle.sim.state }));
  check(between0.state === 'between' && between1.xp === between0.xp, `no XP between waves (${Math.round(between0.xp)} → ${Math.round(between1.xp)}, ${between1.state})`);

  // ---- buy a level from the pill ----
  await page.evaluate(() => { window.__battle.sim.cash = 5000; });
  await page.waitForTimeout(700); // the pill re-reads its price twice a second
  const pill = await page.evaluate(() => ({ text: document.querySelector('[data-testid="hero-levelup-quick"]')?.innerText || '', hidden: document.querySelector('[data-testid="hero-levelup-quick"]')?.hidden, st: window.__battle.sim.heroLevelStatus(), lv: window.__battle.sim.hero.level, cash: window.__battle.sim.cash }));
  check(!pill.hidden && /lv up/i.test(pill.text), `the Level up pill shows (${pill.text.replace(/\s+/g, ' ')})`);
  await shot('widget-pill');
  await tapEl('[data-testid="hero-levelup-quick"]');
  await page.waitForTimeout(300);
  const bought = await page.evaluate(() => ({ lv: window.__battle.sim.hero.level, cash: window.__battle.sim.cash }));
  check(bought.lv === pill.lv + 1 && pill.cash - bought.cash === pill.st.price, `pill bought Lv ${pill.lv + 1} for the shown ${pill.st.price} (cash ${pill.cash} → ${bought.cash})`);
  await page.evaluate(() => { window.__battle.sim.cash = 0; });
  check(await page.waitForFunction(() => document.querySelector('[data-testid="hero-levelup-quick"]')?.classList.contains('poor'), null, { timeout: 8000, polling: 100 }).then(() => true).catch(() => false), 'pill turns grey when coins are short');
  await shot('widget-pill-poor');
  await page.evaluate(() => { window.__battle.sim.cash = 5000; });

  // ---- her panel: track, Level up, Move, no Sell ----
  await page.evaluate(() => window.__battle.ui.select(window.__battle.sim.hero.uid));
  await page.waitForSelector('[data-testid="tower-panel"]:not([hidden])', { timeout: 5000 }).catch(() => null);
  const panel = await page.evaluate(() => ({
    lvup: !!document.querySelector('[data-testid="hero-levelup"]'), move: document.querySelector('[data-testid="hero-move"]')?.innerText || '', sell: !!document.querySelector('[data-testid="sell"]'),
    upgrades: /Upgrades/i.test(document.querySelector('[data-testid="tower-panel"]')?.innerText || ''),
  }));
  check(panel.lvup && !!panel.move && !panel.sell && !panel.upgrades, `panel: Level up and Move, no Sell, no Upgrades (${JSON.stringify(panel)})`);
  await shot('panel');
  await tapEl('[data-testid="hero-track-toggle"]');
  await page.waitForTimeout(300);
  check(await page.evaluate(() => document.querySelectorAll('[data-testid="hero-track"] .bt-track-row').length === 25), 'panel: the full track lists 25 levels');
  await shot('panel-track');

  // ---- Move between waves: instant, same level ----
  const lv0 = await page.evaluate(() => window.__battle.sim.hero.level);
  await page.evaluate(() => window.__battle.ui.select(window.__battle.sim.hero.uid));
  await page.waitForTimeout(200);
  await tapEl('[data-testid="hero-move"]');
  await page.waitForTimeout(250);
  const mv = await spotWhere('move');
  const from = await page.evaluate(() => [window.__battle.sim.hero.x, window.__battle.sim.hero.y]);
  if (check(!!mv, 'found a spot to move her to')) await tapAt(mv.cx, mv.cy);
  await page.waitForTimeout(300);
  const moved = await page.evaluate(() => ({ x: window.__battle.sim.hero.x, y: window.__battle.sim.hero.y, lv: window.__battle.sim.hero.level, lock: window.__battle.sim.hero.moveLock, cd: window.__battle.sim.hero.moveCd }));
  check((moved.x !== from[0] || moved.y !== from[1]) && moved.lv === lv0 && moved.lock === 0 && moved.cd === 0, `Move between waves: she is at the new spot, same level, no pause (${JSON.stringify(moved)})`);
  await shot('moved-between');

  // ---- Move during a wave: pause + recharge ----
  await page.evaluate(() => window.__battle.ui.startWave());
  await page.evaluate(() => window.__battle.sim.update(0.5));
  await page.evaluate(() => window.__battle.ui.select(window.__battle.sim.hero.uid));
  await page.waitForTimeout(250);
  check(/pauses 3s/i.test(await page.evaluate(() => document.querySelector('[data-testid="hero-move"]')?.innerText || '')), 'Move button in a wave reads "Move · pauses 3s"');
  await tapEl('[data-testid="hero-move"]');
  await page.waitForTimeout(250);
  const mv2 = await spotWhere('move');
  if (mv2) await tapAt(mv2.cx, mv2.cy);
  await page.waitForTimeout(300);
  const moved2 = await page.evaluate(() => ({ lock: window.__battle.sim.hero.moveLock, cd: window.__battle.sim.hero.moveCd }));
  check(moved2.lock > 0 && moved2.cd > 10, `Move in a wave: she pauses and Move recharges (${JSON.stringify(moved2)})`);
  await page.evaluate(() => window.__battle.ui.select(window.__battle.sim.hero.uid));
  await page.waitForTimeout(700);
  check(/Move · \d+s/i.test(await page.evaluate(() => document.querySelector('[data-testid="hero-move"]')?.innerText || '')), 'Move button shows the recharge ("Move · 14s")');
  await shot('moved-in-wave');
  await page.evaluate(() => window.__battle.ui.select(null));

  // ---- keys (PC): Q fires the ult, L buys a level ----
  if (!touch) {
    await page.evaluate(() => {
      const h = window.__battle.sim.hero;
      h.ultUnlocked = true;
      h.ultCooldown = 0;
    });
    const u0 = await page.evaluate(() => window.__battle.sim.stats.ultsUsed);
    await page.keyboard.press('q');
    await page.waitForTimeout(200);
    check((await page.evaluate(() => window.__battle.sim.stats.ultsUsed)) === u0 + 1, 'Q fires the ult');
    await page.evaluate(() => { window.__battle.sim.cash = 50000; });
    await page.waitForTimeout(700);
    const l0 = await page.evaluate(() => window.__battle.sim.hero.level);
    await page.keyboard.press('l');
    await page.waitForTimeout(200);
    check((await page.evaluate(() => window.__battle.sim.hero.level)) === l0 + 1, 'L buys a level');
  }

  // ---- a tier-5 banner and MAX ----
  await page.evaluate(() => {
    const { sim } = window.__battle;
    sim.cash = 1e6;
    while (sim.hero.level < 21) {
      const st = sim.heroLevelStatus();
      sim.buyHeroLevel({ level: st.level + 1, maxPrice: st.price });
    }
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const { sim, ui } = window.__battle;
    ui.levelUpHero(sim.heroLevelStatus());
  });
  // (software WebGL at 1280×720 can take a while to paint the next frame: poll)
  const banner = await page.waitForFunction(() => /LV 22/i.test(document.querySelector('.bt-banner')?.innerText || ''), null, { timeout: 8000, polling: 50 }).then(() => true).catch(() => false);
  check(banner, 'Lv 22 (a tier-5 level) gets the big banner');
  await shot('banner-tier5');
  await page.evaluate(() => {
    const { sim } = window.__battle;
    sim._credit(sim.hero, 1e9);
  });
  await page.waitForFunction(() => /MAX/.test(document.querySelector('.bt-herow-lv')?.innerText || ''), null, { timeout: 8000, polling: 100 }).catch(() => null);
  const maxed = await page.evaluate(() => ({ badge: document.querySelector('.bt-herow-lv')?.innerText || '', pill: document.querySelector('[data-testid="hero-levelup-quick"]')?.hidden }));
  check(/MAX · \+25%/.test(maxed.badge) && maxed.pill, `Lv 25: badge reads MAX with Mastery, the pill is gone (${maxed.badge})`);
  await shot('widget-max');
  const errs = errors.splice(0);
  check(!errs.length, `no page / console errors${errs.length ? `\n       ${errs.slice(0, 5).join('\n       ')}` : ''}`);
  await context.close();
}

try {
  for (const vp of viewports) await runViewport(vp);
} finally {
  await browser.close();
  await server.close();
}
log(`\nscreenshots: ${shotsDir}`);
if (failures.length) {
  log(`\n${failures.length} check(s) FAILED`);
  process.exit(1);
}
log('\nall hero checks passed');

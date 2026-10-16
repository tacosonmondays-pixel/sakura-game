// Chika's drones e2e (docs/specs/CHIKA_REWORK.md §9 and §16). Boots the real game in Chromium
// (SwiftShader WebGL) at a phone and a desktop size and:
//   1. places Chika ~3.8 tiles from a lane, starts wave 1: a drone flies farther from her than her
//      own range ring while her damage rises (the sim's drones, window.__battle.sim)
//   2. taps Chika: the tab row shows with Overall selected, the header damage is her damageDealt,
//      the split bar is there, and Overall DPS = Chika DPS + Wing DPS as read from the tabs
//   3. Upgrades → buy: still on Upgrades after the re-render; Drones: one row per drone, the first
//      is "#1 Sprocket", and on the phone row 1 is on screen without scrolling
//   4. taps a flying drone on the field (__battle.renderer.droneScreen): the drone card shows its
//      name, a state and its damage; ▶ steps to #2; ‹ returns to the Drones tab
//   5. closes and reopens her: the Drones tab is still selected
//   6. flight modes from the panel: Pursuit at once; Hold = one tap on the map; Patrol = two taps;
//      Hover again (the sim's flightInfo follows each one)
//   7. screenshots (chika-overall, chika-tab, drones-tab, drone-card, flight-picking, flight-patrol)
//      with nothing clipped sideways
//
//   node e2e/chika-drones.mjs [--viewport 844x390] [--shots <dir>]
//
// Playwright: PLAYWRIGHT_MODULE, else /opt/node22/lib/node_modules/playwright (createRequire),
// else e2e/browser.mjs's search. Browser: CHROME_PATH, else /opt/pw-browsers/chromium, else
// e2e/browser.mjs's search. Exit code 1 if any check fails.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'vite';
import { GL_ARGS, launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport', null) ? [opt('viewport')] : ['844x390', '1280x720'];
const shotsDir = opt('shots', join(tmpdir(), 'sakura-chika-drones'));
mkdirSync(shotsDir, { recursive: true });
const STAGE = opt('stage', '1-3');

const IGNORE = [
  /GPU stall due to ReadPixels/i,
  /WebGL: too many errors/i,
  /Automatic fallback to software WebGL/i,
  /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i,
  /favicon\.ico/i,
  /Failed to load resource: net::ERR_/i,
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

async function launch() {
  const require = createRequire(import.meta.url);
  const pwPath = process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright';
  const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
  if (existsSync(pwPath) && existsSync(exe)) {
    const { chromium } = require(pwPath);
    const browser = await chromium.launch({ executablePath: exe, args: GL_ARGS });
    return { browser, label: `${exe} ${browser.version()}` };
  }
  return launchChromium();
}

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
let browser;
try {
  const launched = await launch();
  browser = launched.browser;
  log(`browser: ${launched.label}`);
} catch (e) {
  await server.close();
  throw e;
}

const frames = (page, n = 3) => page.evaluate((k) => new Promise((r) => {
  let i = 0;
  const step = () => (++i >= k ? r() : requestAnimationFrame(step));
  requestAnimationFrame(step);
}), n);

/** Plays game time: the sim runs at `speed` until `fn` (a page predicate) holds or `ms` pass. */
async function until(page, fn, arg, ms = 60000) {
  return page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);
}

async function tapAt(page, phone, x, y) {
  if (phone) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

async function tapTestId(page, phone, id) {
  const el = page.locator(`[data-testid="${id}"]`).first();
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const box = await el.boundingBox();
  if (!box) throw new Error(`no box for ${id}`);
  await tapAt(page, phone, box.x + box.width / 2, box.y + box.height / 2);
  await frames(page, 3);
}

async function shot(page, name, vp) {
  await frames(page, 2);
  await page.screenshot({ path: `${shotsDir}/${name}-${vp}.png` });
}

/** Freezes the sim (the renderer keeps drawing): taps land where a drone was just drawn. */
const freeze = (page) => page.evaluate(() => {
  const s = window.__battle.sim;
  if (!s.__update) {
    s.__update = s.update;
    s.update = () => {};
  }
});
const thaw = (page) => page.evaluate(() => {
  const s = window.__battle.sim;
  if (s.__update) {
    s.update = s.__update;
    delete s.__update;
  }
});

/** No horizontal clipping inside the panel: nothing wider than its scroll area. */
const panelOverflow = (page) => page.evaluate(() => {
  const sc = document.querySelector('.bt-panel-scroll');
  if (!sc) return 'no panel';
  if (sc.scrollWidth > sc.clientWidth + 1) return `scroll area ${sc.scrollWidth} > ${sc.clientWidth}`;
  const r = sc.getBoundingClientRect();
  for (const el of sc.querySelectorAll('button, .bt-stat-cell, .bt-dr-split, .bt-dr-row, .bt-dr-card-head')) {
    const b = el.getBoundingClientRect();
    if (b.width && (b.left < r.left - 1 || b.right > r.right + 1)) return `${el.className} ${Math.round(b.left)}–${Math.round(b.right)} outside ${Math.round(r.left)}–${Math.round(r.right)}`;
  }
  return null;
});

const num = (s) => Number(String(s).replace(/,/g, '').match(/-?\d+(\.\d+)?/)?.[0] ?? NaN);

for (const vp of viewports) {
  const [w, h] = vp.split('x').map(Number);
  const phone = Math.min(w, h) < 600;
  log(`\n== ${vp}${phone ? ' (touch phone)' : ''} ==`);
  const context = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: phone, isMobile: phone, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !IGNORE.some((re) => re.test(m.text()))) errors.push(m.text());
  });
  await page.goto(base);
  await page.waitForFunction(() => window.__sakura?.store?.profile, null, { timeout: 120000 });
  // Chika joins the formation (no hero: an uncluttered board)
  await page.evaluate(() => {
    const p = window.__sakura.store.profile;
    p.units.chika ||= { level: 1, exp: 0, breakthrough: 0, awaken: 0, gear: { charm: null, ribbon: null, shoes: null }, obtainedAt: Date.now(), favorite: false };
    p.formation = { ...(p.formation || {}), towers: ['chika'], hero: null };
    p.settings = { ...(p.settings || {}), autoStart: false };
  });
  await page.evaluate((id) => { location.hash = `#/battle?stage=${id}&difficulty=easy`; }, STAGE);
  await page.waitForFunction((id) => window.__battle?.ui?.placement && window.__battle.ui.stage?.id === id && window.__battle.ui.flight, STAGE, { timeout: 180000 });
  await page.waitForTimeout(800);
  await frames(page, 4);

  // ---- 1. place her ~3.8 tiles from a lane, on screen; wave 1
  const placed = await page.evaluate(() => {
    const { sim, renderer, ui } = window.__battle;
    sim.cash = 1e6;
    const lane = sim.pathData.flatMap((p) => p.points);
    const near = (x, y) => {
      let b = Infinity;
      for (const p of sim.pathData) {
        for (let i = 1; i < p.points.length; i++) {
          const [ax, ay] = p.points[i - 1];
          const [bx, by] = p.points[i];
          const dx = bx - ax;
          const dy = by - ay;
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
          b = Math.min(b, Math.hypot(ax + dx * t - x, ay + dy * t - y));
        }
      }
      return b;
    };
    const barTop = ui.bar.el.getBoundingClientRect().top;
    let best = null;
    for (let y = 0.4; y < sim.map.height; y += 0.25) {
      for (let x = 0.4; x < sim.map.width; x += 0.25) {
        if (!sim.canPlace('chika', x, y).ok) continue;
        const d = near(x, y);
        if (d < 3.6 || d > 4.0) continue;
        const s = renderer.worldToScreen(x, y, 0);
        if (!s.visible || s.clientX < 60 || s.clientX > innerWidth * 0.55 || s.clientY < 80 || s.clientY > barTop - 30) continue;
        const cover = lane.length;
        if (!best || Math.abs(d - 3.8) < Math.abs(best.d - 3.8)) best = { x, y, d, cover };
      }
    }
    if (!best) return null;
    const t = sim.placeTower('chika', best.x, best.y);
    ui.startWave();
    ui.speed = 2;
    return { uid: t.uid, d: best.d, range: t.eff.range };
  });
  if (!check(!!placed, `Chika placed ${placed ? `${placed.d.toFixed(2)} tiles from the lane` : '(no spot)'}`)) {
    await context.close();
    continue;
  }
  const flew = await until(page, (uid) => {
    const { sim } = window.__battle;
    const t = sim.getTower(uid);
    return t && t.damageDealt > 0 && t.turrets.some((d) => Math.hypot(d.x - t.x, d.y - t.y) > t.eff.range);
  }, placed.uid, 90000);
  check(flew, 'a drone flies farther from her than her range ring while her damage rises');

  // ---- 2. tap Chika: Overall first; header damage; split bar; Overall = Chika + Wing
  const herScreen = await page.evaluate((uid) => {
    const t = window.__battle.sim.getTower(uid);
    return window.__battle.renderer.worldToScreen(t.x, t.y, 0.3);
  }, placed.uid);
  await freeze(page);
  await tapAt(page, phone, herScreen.clientX, herScreen.clientY);
  await frames(page, 4);
  const opened = await page.evaluate(() => ({
    sel: window.__battle.ui.selectedUid,
    tabs: !!document.querySelector('[data-testid="tab-overall"]'),
    on: document.querySelector('.bt-dr-tab.on')?.dataset.testid,
    split: !!document.querySelector('[data-testid="split-bar"]'),
    dmg: document.querySelector('.bt-panel-meta span:nth-child(2) b')?.textContent,
    dealt: Math.floor(window.__battle.sim.getTower(window.__battle.ui.selectedUid)?.damageDealt || 0),
  }));
  check(opened.sel === placed.uid && opened.tabs, `tapping Chika opens her panel with the tab row (${JSON.stringify(opened)})`);
  check(opened.on === 'tab-overall', 'the first open selects Overall');
  check(opened.split, 'the split bar is there');
  check(num(opened.dmg) === opened.dealt, `header Damage ${opened.dmg} = damageDealt ${opened.dealt}`);
  const overallDps = await page.evaluate(() => document.querySelector('[data-testid="stats-overall"] .bt-stat-main b')?.textContent);
  await shot(page, 'chika-overall', vp);
  check(!(await panelOverflow(page)), `Overall: nothing clipped sideways (${await panelOverflow(page)})`);
  await tapTestId(page, phone, 'tab-chika');
  const chikaDps = await page.evaluate(() => document.querySelector('[data-testid="stats-chika"] .bt-stat-main b')?.textContent);
  await shot(page, 'chika-tab', vp);
  check(!(await panelOverflow(page)), `Chika tab: nothing clipped sideways (${await panelOverflow(page)})`);
  await tapTestId(page, phone, 'tab-drones');
  const wingDps = await page.evaluate(() => document.querySelector('[data-testid="stats-drones"] .bt-stat-main b')?.textContent);
  check(Math.abs(num(overallDps) - (num(chikaDps) + num(wingDps))) < 0.11, `Overall DPS ${overallDps} = Chika ${chikaDps} + Wing ${wingDps}`);

  // ---- 3. Upgrades → buy stays on Upgrades; Drones rows
  await tapTestId(page, phone, 'tab-upgrades');
  const tiersBefore = await page.evaluate((uid) => window.__battle.sim.getTower(uid).tiers.join('-'), placed.uid);
  await tapTestId(page, phone, 'buy-0');
  await frames(page, 4);
  const afterBuy = await page.evaluate((uid) => ({ tiers: window.__battle.sim.getTower(uid).tiers.join('-'), on: document.querySelector('.bt-dr-tab.on')?.dataset.testid }), placed.uid);
  check(afterBuy.tiers !== tiersBefore && afterBuy.on === 'tab-upgrades', `buying an upgrade keeps the Upgrades tab (${tiersBefore} → ${afterBuy.tiers}, ${afterBuy.on})`);
  await tapTestId(page, phone, 'tab-drones');
  const list = await page.evaluate((uid) => {
    const rows = [...document.querySelectorAll('[data-testid^="drone-row-"]')];
    const sc = document.querySelector('.bt-panel-scroll').getBoundingClientRect();
    const r1 = document.querySelector('[data-testid="drone-row-1"]')?.getBoundingClientRect();
    return {
      rows: rows.length,
      drones: window.__battle.sim.droneStats(uid).length,
      first: rows[0]?.querySelector('.bt-dr-row-name')?.textContent,
      visible: !!r1 && r1.top >= sc.top - 1 && r1.bottom <= sc.bottom + 1,
      scrollTop: document.querySelector('.bt-panel-scroll').scrollTop,
    };
  }, placed.uid);
  check(list.rows === list.drones && list.rows > 0, `Drones tab: one row per drone (${list.rows} rows, ${list.drones} drones)`);
  check(list.first === '#1 Sprocket', `the first row is "#1 Sprocket" (${list.first})`);
  if (phone) check(list.visible && list.scrollTop === 0, `on the phone drone-row-1 is on screen without scrolling (${JSON.stringify(list)})`);
  await shot(page, 'drones-tab', vp);
  check(!(await panelOverflow(page)), `Drones tab: nothing clipped sideways (${await panelOverflow(page)})`);

  // ---- 4. tap a flying drone on the field (once she has two, so ▶ has somewhere to go)
  await thaw(page);
  await until(page, (uid) => {
    const t = window.__battle.sim.getTower(uid);
    return t.turrets.length >= 2 && t.turrets.some((d) => d.tgt || d.moving);
  }, placed.uid, 90000);
  await freeze(page);
  await frames(page, 3);
  const target = await page.evaluate((uid) => {
    const { sim, renderer } = window.__battle;
    const panel = document.querySelector('.bt-panel')?.getBoundingClientRect();
    const bar = window.__battle.ui.bar.el.getBoundingClientRect();
    for (const d of sim.getTower(uid).turrets) {
      if (!(d.tgt || d.moving)) continue;
      const s = renderer.droneScreen(d.uid);
      if (!s || !s.visible) continue;
      if (panel && s.clientX > panel.left - 4 && s.clientY > panel.top && s.clientY < panel.bottom) continue;
      if (s.clientY > bar.top - 4 || s.clientY < 60) continue;
      return { uid: d.uid, n: d.n, x: s.clientX, y: s.clientY };
    }
    return null;
  }, placed.uid);
  if (check(!!target, `a flying drone is on screen (${JSON.stringify(target)})`)) {
    await tapAt(page, phone, target.x, target.y);
    await frames(page, 4);
    const card = await page.evaluate(() => ({
      card: !!document.querySelector('[data-testid="drone-card"]'),
      name: document.querySelector('[data-testid="drone-name"]')?.textContent,
      state: document.querySelector('[data-testid="drone-state"]')?.textContent,
      dealt: [...document.querySelectorAll('[data-testid="drone-card"] .bt-stat-cell')].find((c) => /Damage dealt/i.test(c.textContent))?.querySelector('b')?.textContent,
      selected: window.__battle.ui.selectedDrone,
    }));
    check(card.card && card.selected === target.uid, `tapping the drone opens its card (${JSON.stringify(card)})`);
    check(new RegExp(`^#${target.n} `).test(card.name || ''), `the card names drone #${target.n} (${card.name})`);
    check(!!card.state && card.dealt != null, `the card shows a state and its damage (${card.state} · ${card.dealt})`);
    await shot(page, 'drone-card', vp);
    check(!(await panelOverflow(page)), `drone card: nothing clipped sideways (${await panelOverflow(page)})`);
    const count = await page.evaluate((uid) => window.__battle.sim.getTower(uid).turrets.length, placed.uid);
    await tapTestId(page, phone, 'drone-next');
    const next = await page.evaluate(() => document.querySelector('[data-testid="drone-name"]')?.textContent);
    const want = (target.n % count) + 1;
    check(count >= 2 && new RegExp(`^#${want} `).test(next || ''), `▶ steps to #${want} of ${count} (${next})`);
    // the card opened from the field: ‹ returns to the tab she was on (Drones)
    await tapTestId(page, phone, 'drone-back');
    const back = await page.evaluate(() => ({ card: !!document.querySelector('[data-testid="drone-card"]'), on: document.querySelector('.bt-dr-tab.on')?.dataset.testid }));
    check(!back.card && back.on === 'tab-drones', `‹ returns to the Drones tab (${JSON.stringify(back)})`);
  }

  // ---- 5. close and reopen: the Drones tab is remembered
  await tapTestId(page, phone, 'panel-close');
  await page.evaluate((uid) => window.__battle.ui.select(uid), placed.uid);
  await frames(page, 3);
  const reopened = await page.evaluate(() => document.querySelector('.bt-dr-tab.on')?.dataset.testid);
  check(reopened === 'tab-drones', `reopening her keeps the Drones tab (${reopened})`);

  // ---- 6. flight modes
  await tapTestId(page, phone, 'flight-pursuit');
  check(await page.evaluate((uid) => window.__battle.sim.flightInfo(uid).mode === 'pursuit', placed.uid), 'Flight → Pursuit applies at once');
  /** A point on the open board inside her signal range, on screen and off the panel. */
  const boardPoint = (k) => page.evaluate(([uid, k0]) => {
    const { sim, renderer, ui } = window.__battle;
    const t = sim.getTower(uid);
    const sig = sim.flightInfo(uid).signal;
    const panel = document.querySelector('.bt-panel')?.getBoundingClientRect();
    const bar = ui.bar.el.getBoundingClientRect();
    const pts = [];
    for (let r = 1.5; r < sig - 0.3; r += 0.5) for (let a = 0; a < 16; a++) pts.push([t.x + r * Math.cos(a * 0.3927), t.y + r * Math.sin(a * 0.3927)]);
    let n = 0;
    for (const [x, y] of pts) {
      if (x < 0.5 || y < 0.5 || x > sim.map.width - 0.5 || y > sim.map.height - 0.5) continue;
      const s = renderer.worldToScreen(x, y, 0);
      if (!s.visible || s.clientX < 30 || s.clientY < 70 || s.clientY > bar.top - 20) continue;
      if (panel && s.clientX > panel.left - 8) continue;
      if (document.elementFromPoint(s.clientX, s.clientY) !== renderer.canvas) continue;
      const p = renderer.pick(s.clientX, s.clientY);
      if (p.towerUid != null || p.droneUid != null || !p.inBounds) continue;
      if (n++ < k0) continue;
      return { x: p.x, y: p.y, sx: s.clientX, sy: s.clientY };
    }
    return null;
  }, [placed.uid, k]);
  await tapTestId(page, phone, 'flight-hold');
  const banner = await page.evaluate(() => !document.querySelector('[data-testid="flight-banner"]')?.hidden);
  check(banner, 'Flight → Hold asks for a point (banner)');
  await shot(page, 'flight-picking', vp);
  const hp = await boardPoint(0);
  if (check(!!hp, 'an open board point inside her signal ring is on screen')) {
    await tapAt(page, phone, hp.sx, hp.sy);
    await frames(page, 3);
    const fl = await page.evaluate((uid) => window.__battle.sim.flightInfo(uid), placed.uid);
    check(fl.mode === 'hold' && Math.hypot(fl.a[0] - hp.x, fl.a[1] - hp.y) < 0.05, `one tap sets the Hold point (${fl.mode} at ${fl.a?.map((v) => v.toFixed(2))})`);
  }
  await tapTestId(page, phone, 'flight-patrol');
  const pa = await boardPoint(2);
  const pb = await boardPoint(12);
  if (check(!!pa && !!pb, 'two board points for Patrol')) {
    await tapAt(page, phone, pa.sx, pa.sy);
    await frames(page, 2);
    await tapAt(page, phone, pb.sx, pb.sy);
    await frames(page, 3);
    const fl = await page.evaluate((uid) => window.__battle.sim.flightInfo(uid), placed.uid);
    check(fl.mode === 'patrol' && Math.hypot(fl.a[0] - pa.x, fl.a[1] - pa.y) < 0.05 && Math.hypot(fl.b[0] - pb.x, fl.b[1] - pb.y) < 0.05, `two taps set the Patrol points (${fl.mode})`);
    await thaw(page);
    await page.waitForTimeout(1500);
    await freeze(page);
    await shot(page, 'flight-patrol', vp);
  }
  await tapTestId(page, phone, 'flight-hover');
  check(await page.evaluate((uid) => window.__battle.sim.flightInfo(uid).mode === 'hover', placed.uid), 'Flight → Hover brings the wing back to her');
  check(!(await panelOverflow(page)), `flight row: nothing clipped sideways (${await panelOverflow(page)})`);
  await thaw(page);

  check(!errors.length, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await context.close();
}

await browser.close();
await server.close();
log(failures.length ? `\nchika-drones: ${failures.length} check(s) FAILED` : '\nchika-drones: all checks passed');
log(`screenshots: ${shotsDir}`);
process.exit(failures.length ? 1 : 0);

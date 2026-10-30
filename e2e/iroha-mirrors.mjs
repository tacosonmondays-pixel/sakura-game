// End-to-end check of Iroha's mirror network UI (docs/specs/IROHA_MIRRORS.md §8) at 844×390, 1280×720 and 390×844:
//   1. A battle on 1-1 with Iroha at Mirror Hall tier 2 (three mirrors): her drawer shows the MIRRORS row (AUTO ·
//      PLACE), the count and one numbered chip per mirror.
//   2. PLACE walks the mirrors in order: the banner names "Mirror 1 of 3"…, each board tap places the next one, the
//      banner closes after the last; the drawer marks them placed.
//   3. A numbered chip re-places only that mirror; Auto puts every mirror back on the road.
//   4. A wave: her bolts bounce off her mirrors ('mirrorBounce' events), nothing on screen reads null / NaN, and no
//      console errors.
// Screenshots (placing, placed, mid-wave) go to --shots <dir>.
//
//   node e2e/iroha-mirrors.mjs [--shots /tmp/shots]
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 when a check fails.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const shotsDir = opt('shots', null);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const SIZES = [[844, 390], [1280, 720], [390, 844]];
const IGNORE = [
  /GPU stall due to ReadPixels/i, /WebGL: too many errors/i, /Automatic fallback to software WebGL/i, /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i, /favicon\.ico/i,
  /Failed to load resource: net::ERR_/i,
];
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
const base = `http://127.0.0.1:${port}/`;

const save = await server.ssrLoadModule('/src/systems/save.js');
const profile = save.createProfile();
for (const id of ['iroha', 'aoi']) profile.units[id] = { ...save.newUnitState(), level: 40, breakthrough: 3 };
profile.formation = { ...(profile.formation || {}), towers: ['iroha', 'aoi'] };
profile.progress.stages['1-1'] = { easy: false, normal: true, hard: false, nightmare: false, clears: 1 };
profile.settings = { ...profile.settings, autoStart: false };
const saveText = JSON.stringify(profile);

const { browser, label } = await launchChromium();
log(`browser: ${label}`);
const errors = [];

for (const [w, h] of SIZES) {
  log(`\n--- ${w}x${h} ---`);
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < h });
  await context.addInitScript(([key, text]) => {
    if (!sessionStorage.getItem('im-e2e-seeded')) {
      localStorage.setItem(key, text);
      sessionStorage.setItem('im-e2e-seeded', '1');
    }
  }, [save.SAVE_KEY, saveText]);
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (!IGNORE.some((re) => re.test(t))) errors.push(`[${w}x${h} console] ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`[${w}x${h} pageerror] ${e.message}`));
  const settle = (ms = 250) => page.evaluate((t) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, t)))), ms).catch(() => null);
  const shot = async (name) => {
    const leaked = await page.evaluate(() => (document.body.innerText.match(/\b(null|undefined|NaN|Infinity)\b/g) || []).join(', ')).catch(() => '');
    check(!leaked, `${name}: no "null" / "undefined" / "NaN" on screen${leaked ? ` (${leaked})` : ''}`);
    if (shotsDir) await page.screenshot({ path: `${shotsDir}/iroha-mirrors-${name}-${w}x${h}.png`, timeout: 90000 }).catch((e) => log(`    (screenshot: ${String(e.message).split('\n')[0]})`));
  };
  /**
   * A board point for her mirror: within her reach, near the road, on screen and not under the drawer or the bar
   * (the board canvas is what a tap there hits); `avoid`: points already used.
   */
  const boardPoint = (uid, avoid) => page.evaluate(([u, used]) => {
    const { sim, renderer } = window.__battle;
    const t = sim.getTower(u);
    const reach = t.stats.relay.reach;
    for (let r = 0.8; r <= reach; r += 0.35) {
      for (let a = 0; a < 24; a++) {
        const x = t.x + r * Math.cos((a / 24) * Math.PI * 2);
        const y = t.y + r * Math.sin((a / 24) * Math.PI * 2);
        if (x < 0.3 || y < 0.3 || x > sim.map.width - 0.3 || y > sim.map.height - 0.3) continue;
        if (used.some(([ux, uy]) => Math.hypot(ux - x, uy - y) < 0.9)) continue;
        if (sim.placement.pathDistance(x, y) > 1.2) continue;
        const s = renderer.worldToScreen(x, y, 0);
        if (!s.visible) continue;
        const el = document.elementFromPoint(s.clientX, s.clientY);
        if (!el || el.tagName !== 'CANVAS') continue;
        return { x, y, cx: s.clientX, cy: s.clientY };
      }
    }
    return null;
  }, [uid, avoid]);
  const tap = async (p) => {
    if (w < h) await page.touchscreen.tap(p.cx, p.cy);
    else await page.mouse.click(p.cx, p.cy);
    await settle(300);
  };

  try {
    await page.goto(`${base}#/battle?stage=1-1&difficulty=normal`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => window.__battle?.ui?.act && window.__battle.sim, null, { timeout: 90000 });
    await settle(800);
    // Iroha near the road, on screen, at Mirror Hall tier 2 (three mirrors); Aoi beside her
    const uid = await page.evaluate(() => {
      const { sim, ui, renderer } = window.__battle;
      sim.cash = 1e7;
      const barTop = ui.bar?.el?.getBoundingClientRect().top ?? innerHeight;
      let best = null;
      for (let y = 0.6; y < sim.map.height; y += 0.3) {
        for (let x = 0.6; x < sim.map.width; x += 0.3) {
          if (!sim.canPlace('iroha', x, y).ok) continue;
          const d = sim.placement.pathDistance(x, y);
          if (d > 1.6 || d < 0.6) continue;
          const s = renderer.worldToScreen(x, y, 0);
          if (!s.visible || s.clientY > barTop - 40 || s.clientY < 70 || s.clientX < 40 || s.clientX > innerWidth * 0.55) continue;
          const c = Math.hypot(s.clientX - innerWidth * 0.3, s.clientY - innerHeight * 0.45);
          if (!best || c < best.c) best = { x, y, c };
        }
      }
      if (!best) return null;
      const t = ui.act.place('iroha', best.x, best.y);
      if (!t) return null;
      sim.upgradeTower(t.uid, 0);
      sim.upgradeTower(t.uid, 0);
      return t.uid;
    });
    if (!check(uid != null, 'Iroha placed at Mirror Hall tier 2')) continue;
    check(await page.evaluate((u) => window.__battle.sim.getTower(u).mirrors.length, uid) === 3, 'she owns three mirrors');
    await page.evaluate((u) => window.__battle.ui.select(u), uid);
    await settle(400);
    check(await page.locator('[data-testid="mirror-row"]').first().isVisible(), 'her drawer shows the mirrors row');
    const count = await page.locator('[data-testid="mirror-count"]').first().textContent();
    check(/3/.test(count) && /auto/i.test(count), `the count reads her three mirrors on Auto ("${count}")`);
    check(await page.locator('[data-testid^="mirror-chip-"]').count() === 3, 'one numbered chip per mirror');

    // PLACE: three taps, one per mirror, in order
    await page.locator('[data-testid="aim-set"]').first().click({ force: true });
    await settle(250);
    const banner = page.locator('[data-testid="aim-banner"]');
    check(await banner.isVisible() && /Mirror 1 of 3/.test(await banner.textContent()), 'PLACE: the banner asks for mirror 1 of 3');
    const used = [];
    for (let k = 0; k < 3; k++) {
      const p = await boardPoint(uid, used);
      if (!check(!!p, `a free board point for mirror ${k + 1}`)) break;
      used.push([p.x, p.y]);
      if (k === 1) await shot('placing');
      await tap(p);
      if (k < 2) check(/Mirror (\d) of 3/.exec(await banner.textContent())?.[1] === String(k + 2), `after tap ${k + 1} the banner asks for mirror ${k + 2}`);
    }
    const placed = await page.evaluate((u) => window.__battle.sim.getTower(u).mirrorAim, uid);
    check(Array.isArray(placed) && placed.filter(Boolean).length === 3, `each tap placed the next mirror (${JSON.stringify(placed)})`);
    if (placed) {
      for (let k = 0; k < 3 && k < used.length; k++) check(placed[k] && Math.hypot(placed[k].x - used[k][0], placed[k].y - used[k][1]) < 0.3, `mirror ${k + 1} stands where it was tapped`);
    }
    check(!(await banner.isVisible()), 'the banner closes after the last mirror');
    await settle(300);
    check(await page.locator('.bt-mirror-placed').count() === 3, 'the drawer marks all three placed');
    await shot('placed');

    // a numbered chip re-places only that mirror
    await page.locator('[data-testid="mirror-chip-1"]').first().click({ force: true });
    await settle(250);
    check(/mirror 2/i.test(await banner.textContent()), 'chip 2 asks for mirror 2 only');
    const q = await boardPoint(uid, used);
    if (check(!!q, 'a free board point to move mirror 2')) {
      await tap(q);
      const now = await page.evaluate((u) => window.__battle.sim.getTower(u).mirrorAim, uid);
      check(Math.hypot(now[1].x - q.x, now[1].y - q.y) < 0.3, 'mirror 2 moved there');
      check(now[0].x === placed[0].x && now[2].x === placed[2].x, 'mirrors 1 and 3 stayed');
      check(!(await banner.isVisible()), 'one mirror placed: the banner closes');
    }

    // a wave: her bolts bounce off her mirrors
    const bounces = await page.evaluate(async (u) => {
      const { sim } = window.__battle;
      sim.startNextWave();
      // (polled: a bolt of hers that has bounced at least once; up to 40 s while the first enemies walk in)
      const seen = new Set();
      for (let i = 0; i < 400 && seen.size < 5; i++) {
        await new Promise((r) => setTimeout(r, 100));
        for (const p of sim.projectiles) if (p.ownerUid === u && p.bounce > 0) seen.add(p.uid);
      }
      return seen.size;
    }, uid);
    check(bounces > 0, `her bolts bounce off her mirrors in a wave (${bounces} bolts seen bounced)`);
    await shot('wave');

    // Auto: every mirror back on the road
    await page.locator('[data-testid="aim-auto"]').first().click({ force: true });
    await settle(300);
    check(await page.evaluate((u) => window.__battle.sim.getTower(u).mirrorAim === null, uid), 'Auto puts her mirrors back on the road');
  } catch (e) {
    check(false, `${w}x${h}: ${String(e.message).split('\n')[0]}`);
  } finally {
    await context.close();
  }
}

await browser.close();
await server.close();
for (const e of errors) check(false, e);
log(`\n${failures.length ? `${failures.length} FAILED` : 'all ok'}`);
process.exit(failures.length ? 1 : 0);

// Drag-and-release placement from the tower bar, with real pointer events (mouse and touch), at three viewports:
// 1280x720 (DPR 1), 844x390 and 390x844 (phones: isMobile, DPR 3). For each pointer type it drags Aoi's card onto
//   - open ground near the middle of the board,
//   - open ground near each of the board's four edges (the closest spot to that edge that is on screen and clear of
//     the HUD and the tower bar),
//   - a spot she cannot stand on (the path or an obstacle),
// and checks that the ghost under the finger stood where the finger aimed (a touch drag aims TOUCH_LIFT = 46 px above
// the finger, src/ui/battle/placement.js; free placement, nothing snaps: docs/PLACEMENT.md), that the release placed
// her exactly where her ghost stood, and that a release on a red spot places no one and ends the placement.
// It aims only once the screen change into the battle has settled (window.__sakura.transitions.busy()): the "cut"
// reveals with a 14 px drift of the whole screen that starts after the battle UI exists (e2e/smoke.mjs had aimed
// during it, v0.1.53 to v0.1.67).
//
//   node e2e/drag-place.mjs [--viewport 844x390] [--shots <dir>]
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 on any failure.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { launchChromium } from './browser.mjs';
import { openApp, seedSave, openBattle } from './lib/battleKit.mjs';

const args = process.argv.slice(2);
const opt = (name, def = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport') ? [opt('viewport')] : ['1280x720', '844x390', '390x844'];
const SHOTS = opt('shots');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const LIFT = 46; // TOUCH_LIFT in src/ui/battle/placement.js
const UNIT = 'aoi';

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser, label } = await launchChromium();
console.log(`browser: ${label}`);
const fails = [];
let passes = 0;
const check = (c, m) => {
  console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`);
  if (c) passes++;
  else fails.push(m);
  return c;
};
const r2 = (v) => (v == null ? null : +v.toFixed(2));

try {
  for (const vp of viewports) {
    const [W, H] = vp.split('x').map(Number);
    const phone = Math.min(W, H) < 600;
    console.log(`\n=== viewport ${vp} (${phone ? 'phone, DPR 3' : 'desktop, DPR 1'}) ===`);
    // touch is enabled at every size so both pointer types run everywhere
    const context = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: phone, deviceScaleFactor: phone ? 3 : 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (/Failed to load resource|404 \(Not Found\)|net::ERR|GPU stall|WebGL: too many errors|software WebGL|GroupMarkerNotSet/.test(t)) return;
      errors.push(`console: ${t}`);
    });

    await openApp(page, base);
    await seedSave(page, { girls: ['hikari', 'aoi', 'akane', 'momo'], hero: 'hikari', towers: ['aoi', 'akane', 'momo'] });
    await openBattle(page, { stage: '1-1', difficulty: 'normal' });
    // the screen change into the battle (its 14 px drift) is over, the board stopped moving
    await page.waitForFunction(() => !window.__sakura?.transitions?.busy?.(), null, { timeout: 20000 }).catch(() => null);
    check(await page.evaluate(() => !window.__sakura.transitions.busy()), 'the screen change into the battle has settled');
    await page.waitForFunction(() => {
      const { renderer, sim } = window.__battle;
      const p = renderer.worldToScreen(sim.map.width / 2, sim.map.height / 2, 0);
      const w = (window.__dpStill ||= { x: p.clientX, y: p.clientY, n: 0 });
      w.n = Math.hypot(p.clientX - w.x, p.clientY - w.y) < 0.5 ? w.n + 1 : 0;
      w.x = p.clientX;
      w.y = p.clientY;
      return w.n >= 4;
    }, null, { timeout: 15000, polling: 150 }).catch(() => null);
    const dpr = await page.evaluate(() => devicePixelRatio);
    check(dpr === (phone ? 3 : 1), `devicePixelRatio is ${dpr}`);

    /**
     * A target spot (world) and the screen point the pointer is released at: `kind` is 'centre', 'left', 'right',
     * 'top', 'bottom' (open ground for her, as close to that board edge as is reachable on screen) or 'blocked'.
     */
    const findSpot = (kind, lift) => page.evaluate(([kind, lift, unitId]) => {
      const { sim, renderer, ui } = window.__battle;
      const canvas = renderer.canvas;
      const barTop = ui.bar.el.getBoundingClientRect().top;
      const rect = canvas.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const midY = (rect.top + Math.min(rect.bottom, barTop)) / 2;
      const ring = [[0, 0], [0.12, 0], [-0.12, 0], [0, 0.12], [0, -0.12]];
      const good = (x, y) => ring.every(([dx, dy]) => sim.canPlace(unitId, x + dx, y + dy).ok);
      const bad = (x, y) => ring.every(([dx, dy]) => ['path', 'blocked'].includes(sim.canPlace(unitId, x + dx, y + dy).reason));
      const W = sim.map.width;
      const H = sim.map.height;
      let best = null;
      for (let y = 0.05; y < H; y += 0.25) {
        for (let x = 0.05; x < W; x += 0.25) {
          if (kind === 'blocked' ? !bad(x, y) : !good(x, y)) continue;
          const s = renderer.worldToScreen(x, y, 0);
          const rx = s.clientX;
          const ry = s.clientY + lift; // where the pointer is released
          if (!s.visible || rx < 8 || rx > innerWidth - 8 || s.clientY < 8 || ry > barTop - 8) continue;
          if (document.elementFromPoint(s.clientX, s.clientY) !== canvas) continue; // under the HUD
          if (lift && document.elementFromPoint(rx, ry) !== canvas) continue; // the finger itself on the board too
          const p = renderer.pick(s.clientX, s.clientY);
          if (!p.inBounds || Math.hypot(p.x - x, p.y - y) > 0.05) continue;
          const score = kind === 'left' ? x : kind === 'right' ? W - x : kind === 'top' ? y : kind === 'bottom' ? H - y : Math.hypot(s.clientX - midX, s.clientY - midY);
          if (!best || score < best.score) best = { x: +x.toFixed(2), y: +y.toFixed(2), rx, ry, score, reason: sim.canPlace(unitId, x, y).reason };
        }
      }
      return best && { ...best, towers: sim.towers.length, map: [W, H] };
    }, [kind, lift, UNIT]);

    /** Drags her card from the tower bar to (rx, ry) and lets go; returns the ghost just before the release and what happened. */
    const dragTo = async (how, spot) => {
      const card = page.locator(`[data-testid="card-${UNIT}"]`);
      await card.scrollIntoViewIfNeeded();
      const box = await card.boundingBox();
      const sx = box.x + box.width / 2;
      const sy = box.y + box.height / 2;
      // up out of the bar first (the bar starts a drag on an upward move), then glide to the spot
      const route = [1, 2, 3].map((i) => [sx, sy - 10 * i]);
      for (let i = 1; i <= 15; i++) route.push([sx + ((spot.rx - sx) * i) / 15, sy - 30 + ((spot.ry - (sy - 30)) * i) / 15]);
      const holding = async () => {
        // pointermove is dispatched once per animation frame (slow under SwiftShader): let the ghost catch up
        await page.waitForFunction(([x, y]) => {
          const l = window.__battle.ui.placement.last;
          return !!l && Math.hypot(l.x - x, l.y - y) < 0.1;
        }, [spot.x, spot.y], { timeout: 5000 }).catch(() => null);
        return page.evaluate(() => {
          const pl = window.__battle.ui.placement;
          return { unitId: pl.unitId, mode: pl.mode, ok: pl.last?.ok ?? null, at: pl.last ? [pl.last.x, pl.last.y] : null };
        });
      };
      let mid;
      if (how === 'touch') {
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
        return { towers: sim.towers.length, uid: t?.uid ?? null, at: t ? [t.x, t.y] : null, placing: ui.placement.unitId };
      }, UNIT);
      return { mid, res };
    };

    for (const how of ['mouse', 'touch']) {
      const lift = how === 'touch' ? LIFT : 0;
      for (const kind of ['centre', 'left', 'right', 'top', 'bottom', 'blocked']) {
        const tag = `${vp} ${how} ${kind}`;
        const spot = await findSpot(kind, lift);
        if (!check(!!spot, `${tag}: found a spot on screen`)) continue;
        const { mid, res } = await dragTo(how, spot);
        const ghost = mid.at ? `[${r2(mid.at[0])}, ${r2(mid.at[1])}]` : 'none';
        check(mid.mode === 'drag' && mid.unitId === UNIT, `${tag}: the drag is holding ${UNIT} (${mid.mode})`);
        check(!!mid.at && Math.hypot(mid.at[0] - spot.x, mid.at[1] - spot.y) < 0.1, `${tag}: her ghost stands where the ${how === 'touch' ? 'finger aims (46 px above it)' : 'cursor is'} (aimed [${spot.x}, ${spot.y}], ghost ${ghost})`);
        if (kind === 'blocked') {
          check(mid.ok === false, `${tag}: the ghost is red on ${spot.reason} (ok ${mid.ok})`);
          check(res.towers === spot.towers, `${tag}: releasing there places no one (${spot.towers} → ${res.towers} girls)`);
        } else {
          check(mid.ok === true, `${tag}: the ghost is white on open ground (ok ${mid.ok})`);
          check(res.towers === spot.towers + 1 && !!res.at && !!mid.at && Math.hypot(res.at[0] - mid.at[0], res.at[1] - mid.at[1]) < 0.02, `${tag}: releasing places her exactly where her ghost stood (ghost ${ghost} → ${res.at ? `[${r2(res.at[0])}, ${r2(res.at[1])}]` : 'none'})`);
        }
        check(res.placing === null, `${tag}: placement ends after the release`);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${vp}-${how}-${kind}.png` }).catch(() => {});
        // back to an empty board for the next spot
        if (res.uid != null && res.towers > spot.towers) await page.evaluate((uid) => window.__battle.sim.sellTower(uid), res.uid);
      }
    }
    check(!errors.length, `${vp}: no page or console errors${errors.length ? ` (${errors.slice(0, 3).join(' | ')})` : ''}`);
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(`\n${passes} passed, ${fails.length} failed`);
if (fails.length) {
  console.log(fails.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}

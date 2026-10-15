// Battle camera lock e2e (owner: "make it so the screen is locked, I sometimes drag it when I
// try to place a unit"). Boots the real game in Chromium (SwiftShader WebGL) with touch and:
//   - Locked (the default): a one-finger touch drag across the map, a two-finger pinch, a
//     mouse drag and the mouse wheel leave the camera exactly where it was (position, target,
//     zoom, pan); a slightly wobbling tap still places a tapped card's girl; a drag from the
//     tower bar places a girl; tapping her selects her; a long press still fires
//   - Settings → Camera → Free from the pause menu applies at once and is saved: the same drag
//     pans, the wheel zooms; while a card is tapped (placement pending) a drag does not pan;
//     a drag from the bar with a second finger dragging the map places a girl and never pans
//   - Locked, the battle UI on top of the board still answers real touches: the selected girl's
//     panel (upgrade, target mode, close), the hero's ultimate button, the pause button
//   - the locked fit shows the whole board between the HUD and the tower bar on the largest maps
//     (screenshots with --shots; --maps all checks every map)
// Phone viewports (short side < 600 px) run as a touch phone (hasTouch + isMobile); larger ones
// as a touch-screen desktop (hasTouch, mouse and wheel checks too).
//
//   node e2e/camera-lock.mjs [--viewport 844x390] [--shots <dir>] [--maps large|all]
//
// Playwright: PLAYWRIGHT_MODULE, else /opt/node22/lib/node_modules/playwright (createRequire),
// else e2e/browser.mjs's search. Browser: CHROME_PATH, else /opt/pw-browsers/chromium, else
// e2e/browser.mjs's search. Exit code 1 if any check fails.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { GL_ARGS, launchChromium } from './browser.mjs';
import { MAPS } from '../src/data/maps.js';
import { STAGES } from '../src/data/stages.js';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const viewports = opt('viewport', null) ? [opt('viewport')] : ['844x390', '1280x720'];
const shotsDir = opt('shots', null);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const mapsArg = opt('maps', 'large');

const IGNORE = [
  /GPU stall due to ReadPixels/i,
  /WebGL: too many errors/i,
  /Automatic fallback to software WebGL/i,
  /GL_CLOSE_PATH_NV|GroupMarkerNotSet/i,
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

// ---- browser ------------------------------------------------------------------------------
async function launch() {
  const require = createRequire(import.meta.url);
  const pwPath = process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright';
  const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
  if (existsSync(pwPath) && existsSync(exe)) {
    const { chromium } = require(pwPath);
    const browser = await chromium.launch({ executablePath: exe, args: GL_ARGS });
    return { browser, label: `${exe} ${browser.version()}` };
  }
  return launchChromium(); // another machine: Playwright / Chrome from the usual places
}

// ---- maps to frame-check: the largest boards (by area, then the widest aspect) + 1-1 --------
const stageFor = new Map();
for (const s of STAGES) if (s.mapId && !stageFor.has(s.mapId)) stageFor.set(s.mapId, s.id);
const bySize = [...MAPS].filter((m) => stageFor.has(m.id)).sort((a, b) => b.width * b.height - a.width * a.height || b.width / b.height - a.width / a.height);
const firstMap = MAPS.find((m) => m.id === STAGES.find((s) => s.id === '1-1')?.mapId);
const fitMaps = mapsArg === 'all' ? bySize : [...new Set([...bySize.slice(0, 5), firstMap].filter(Boolean))];

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

async function openBattle(page, stageId) {
  await page.evaluate((id) => { location.hash = `#/battle?stage=${id}&difficulty=easy`; }, stageId);
  await page.waitForFunction((id) => window.__battle?.ui?.placement && window.__battle.ui.stage?.id === id, stageId, { timeout: 180000 });
  // the battle screen slides in (slow under SwiftShader): measure only once it stopped moving
  await page.waitForFunction(() => {
    for (let el = window.__battle.renderer.canvas; el; el = el.parentElement) {
      if (el.getAnimations().some((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity)) return false;
    }
    return true;
  }, null, { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(300);
  await frames(page, 4);
}

const camState = (page) => page.evaluate(() => window.__battle.renderer.cameraState);
const same = (a, b) => ['position', 'target', 'pan'].every((k) => a[k].every((v, i) => Math.abs(v - b[k][i]) < 1e-3)) && Math.abs(a.zoom - b.zoom) < 1e-3;
const fmtCam = (c) => `pos ${c.position.join(',')} target ${c.target.join(',')} zoom ${c.zoom} pan ${c.pan.join(',')}`;

/** Installs page helpers (open ground, a swipe row, render freeze, same-task synthetic touches). */
async function installHelpers(page) {
  await page.evaluate(() => {
    const canvas = () => window.__battle.renderer.canvas;
    const fire = (type, id, x, y, pointerType = 'touch') => canvas().dispatchEvent(new PointerEvent(type, {
      pointerId: id, pointerType, isPrimary: id === 101 || pointerType === 'mouse', clientX: x, clientY: y,
      button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true,
    }));
    window.__cam = {
      /** Open ground on screen for an affordable land girl (aim point + where a lifted touch releases). */
      spot(liftPx, avoid = []) {
        const { sim, renderer, ui } = window.__battle;
        const unitId = [...sim.loadout.keys()].find((id) => sim.data.unit(id)?.placement === 'land' && sim.cash >= sim.placeCost(id));
        if (!unitId) return null;
        const barTop = ui.bar.el.getBoundingClientRect().top;
        const rect = canvas().getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        const midY = (rect.top + Math.min(rect.bottom, barTop)) / 2;
        const roomy = (x, y) => [[0, 0], [0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]].every(([dx, dy]) => sim.canPlace(unitId, x + dx, y + dy).ok);
        let best = null;
        for (let y = 0.3; y < sim.map.height; y += 0.5) {
          for (let x = 0.3; x < sim.map.width; x += 0.5) {
            if (!roomy(x, y) || avoid.some(([ax, ay]) => Math.hypot(ax - x, ay - y) < 2)) continue;
            const s = renderer.worldToScreen(x, y, 0);
            const ry = s.clientY + liftPx;
            if (!s.visible || s.clientX < 20 || s.clientX > innerWidth - 20 || s.clientY < 20 || ry > barTop - 20) continue;
            if (document.elementFromPoint(s.clientX, s.clientY) !== canvas() || document.elementFromPoint(s.clientX, ry) !== canvas()) continue;
            const p = renderer.pick(s.clientX, s.clientY);
            if (!p.inBounds || p.towerUid != null || Math.hypot(p.x - x, p.y - y) > 0.05) continue;
            const d = Math.hypot(s.clientX - midX, s.clientY - midY);
            if (!best || d < best.d) best = { x, y, sx: s.clientX, sy: s.clientY, rx: s.clientX, ry, d };
          }
        }
        return best && { unitId, ...best };
      },
      /** A horizontal swipe row across the board that stays on the canvas (no HUD on it). */
      swipe() {
        const { ui } = window.__battle;
        const hudBottom = ui.layer.querySelector('.bt-hud')?.getBoundingClientRect().bottom ?? 60;
        const barTop = ui.bar.el.getBoundingClientRect().top;
        const y = Math.round((hudBottom + barTop) / 2);
        const x0 = Math.round(innerWidth * 0.3);
        const x1 = Math.round(innerWidth * 0.7);
        const onCanvas = [x0, (x0 + x1) / 2, x1].every((x) => document.elementFromPoint(x, y) === canvas());
        return { x0, x1, y, onCanvas };
      },
      /** Empty board under the finger: on the map, no girl, nothing over the canvas. */
      empty() {
        const { renderer } = window.__battle;
        const c = canvas().getBoundingClientRect();
        for (let y = c.top + 60; y < c.bottom - 140; y += 17) {
          for (let x = c.left + 80; x < c.right - 80; x += 23) {
            const p = renderer.pick(x, y);
            if (p.inBounds && p.towerUid == null && document.elementFromPoint(x, y) === canvas()) return [x, y];
          }
        }
        return null;
      },
      /** Pauses / resumes the 3D draw (input handlers keep running): CDP input waits for frames. */
      freeze() {
        const r = window.__battle.renderer;
        if (!r.__draw) {
          r.__draw = r.update;
          r.update = () => [];
        }
      },
      thaw() {
        const r = window.__battle.renderer;
        if (r.__draw) {
          r.update = r.__draw;
          delete r.__draw;
        }
      },
      // Synthetic touch (or mouse) pointers dispatched on the canvas in ONE task, so no frame,
      // timer or long-press can land in between however slow the machine is (the real-touch and
      // real-mouse checks cover the browser's input path). Under SwiftShader the browser holds a
      // real mouse move back until the next frame — seconds at 1280×720 — so a real press-and-drag
      // reaches the page as a long press and never as a drag.
      drag(x0, y0, x1, y1, n = 12, pointerType = 'touch') {
        const id = pointerType === 'mouse' ? 1 : 101;
        fire('pointerdown', id, x0, y0, pointerType);
        for (let i = 1; i <= n; i++) fire('pointermove', id, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, pointerType);
        fire('pointerup', id, x1, y1, pointerType);
      },
      tap(x, y, wobble = 0) {
        fire('pointerdown', 101, x, y);
        if (wobble) {
          fire('pointermove', 101, x + wobble * 0.6, y + wobble * 0.5);
          fire('pointermove', 101, x + wobble * 0.77, y + wobble * 0.64);
        }
        fire('pointerup', 101, x + wobble * 0.77, y + wobble * 0.64);
      },
      pinch(cx, cy, from, to, n = 10) {
        fire('pointerdown', 101, cx - from, cy);
        fire('pointerdown', 102, cx + from, cy);
        for (let i = 1; i <= n; i++) {
          const d = from + ((to - from) * i) / n;
          fire('pointermove', 101, cx - d, cy);
          fire('pointermove', 102, cx + d, cy + i * 3);
        }
        fire('pointerup', 101, cx - to, cy);
        fire('pointerup', 102, cx + to, cy + n * 3);
      },
      /** Press and hold `ms` without moving (long press), then lift. */
      hold(x, y, ms = 750) {
        fire('pointerdown', 101, x, y);
        return new Promise((r) => setTimeout(() => {
          fire('pointerup', 101, x, y);
          r();
        }, ms));
      },
    };
  });
}

async function runViewport(vp) {
  const [w, h] = vp.split('x').map(Number);
  log(`\n=== viewport ${vp}${Math.min(w, h) < 600 ? ' (touch phone)' : ' (desktop with touch)'} ===`);
  const phone = Math.min(w, h) < 600;
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, isMobile: phone });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (!IGNORE.some((re) => re.test(t))) errors.push(`[console] ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  const takeErrors = () => errors.splice(0);
  const shot = async (name) => {
    if (!shotsDir) return;
    await page.screenshot({ path: `${shotsDir}/${vp}-${name}.png` }).catch((e) => log(`  (screenshot ${name} skipped: ${e.message.split('\n')[0]})`));
  };
  const cdp = await context.newCDPSession(page);
  // real touches through the browser's input pipeline (touchEnd lists the fingers that lift)
  const touch = (type, pts = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id: id ?? 1 })) });
  const cam = (fn, ...a) => page.evaluate(([name, rest]) => window.__cam[name](...rest), [fn, a]);
  /** Camera pose after the 3D draw caught up (thaws a frozen renderer first). */
  const settled = async () => {
    await cam('thaw');
    await frames(page, 3);
    return camState(page);
  };
  /** Camera pose once a reset glide (0.35 s of frames, at most 0.1 s each) reached the fit. */
  const glidedHome = async () => {
    await cam('thaw');
    await page.waitForFunction(() => {
      const c = window.__battle.renderer.cameraState;
      return c.zoom === 1 && c.pan[0] === 0 && c.pan[1] === 0;
    }, null, { timeout: 30000 }).catch(() => null);
    return settled();
  };
  /**
   * Real one-finger touch drag from a to b in `steps` moves (3D draw paused meanwhile). Under
   * SwiftShader each CDP touch event can take seconds to land, so the first move may arrive after
   * the 520 ms long-press time: fine for "nothing moves" checks; the checks that need a drag to
   * pan use the same-task synthetic drag (cam('drag')) instead.
   */
  const touchDrag = async ([x0, y0], [x1, y1], steps = 12) => {
    await cam('freeze');
    await touch('touchStart', [[x0, y0]]);
    for (let i = 1; i <= steps; i++) await touch('touchMove', [[x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps]]);
    await touch('touchEnd');
  };
  const touchPinch = async (cx, cy, from, to, steps = 8) => {
    await cam('freeze');
    await touch('touchStart', [[cx - from, cy, 1], [cx + from, cy, 2]]);
    for (let i = 1; i <= steps; i++) {
      const d = from + ((to - from) * i) / steps;
      await touch('touchMove', [[cx - d, cy, 1], [cx + d, cy + i * 3, 2]]);
    }
    await touch('touchEnd');
  };
  /** Real mouse drag (3D draw paused meanwhile, so the moves come long before a long press). */
  const mouseDrag = async ([x0, y0], [x1, y1], steps = 10) => {
    await cam('freeze');
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
    await page.mouse.up();
  };
  // A real tap on a bar card. Under SwiftShader each CDP touch event can take seconds to land, and
  // a press that reaches the page as longer than 550 ms is a hold, which opens her Upgrade Tree
  // (unit info) instead of starting tap-to-place. So the 3D draw is paused and the lift is sent
  // right behind the press (not after the press was acknowledged).
  const tapCard = async (unitId) => {
    const card = await page.locator(`[data-testid="card-${unitId}"]`).boundingBox();
    const openBefore = await page.evaluate(() => {
      window.__tapLog = [];
      window.__tapOff?.();
      const f = (e) => window.__tapLog.push([e.type, Math.round(performance.now())]);
      document.addEventListener('pointerdown', f, true);
      document.addEventListener('pointerup', f, true);
      window.__tapOff = () => {
        document.removeEventListener('pointerdown', f, true);
        document.removeEventListener('pointerup', f, true);
      };
      return !!window.__battle.ui.tree?.isOpen;
    });
    await cam('freeze');
    await Promise.all([touch('touchStart', [[card.x + card.width / 2, card.y + card.height / 2]]), touch('touchEnd')]);
    await cam('thaw');
    const ok = await page.waitForFunction((id) => window.__battle.ui.placement.unitId === id && window.__battle.ui.placement.mode === 'tap', unitId, { timeout: 10000 }).then(() => true, () => false);
    const why = await page.evaluate(() => {
      window.__tapOff?.();
      const l = window.__tapLog || [];
      const d = l.find((x) => x[0] === 'pointerdown');
      const u = l.find((x) => x[0] === 'pointerup');
      return { pressMs: d && u ? u[1] - d[1] : null, treeOpen: !!window.__battle.ui.tree?.isOpen };
    });
    if (!ok) log(`  (card tap: ${JSON.stringify({ ...why, treeOpenBefore: openBefore })})`);
    return ok;
  };

  /** A real one-finger tap through the browser's input pipeline. */
  const realTap = async (x, y) => {
    await touch('touchStart', [[x, y]]);
    await touch('touchEnd');
  };
  /** Real tap on the centre of an element (scrolled into view first); false if it is not shown. */
  const tapEl = async (sel) => {
    const el = page.locator(sel).first();
    if (!(await el.isVisible().catch(() => false))) return false;
    await el.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    const b = await el.boundingBox();
    if (!b) return false;
    await realTap(b.x + b.width / 2, b.y + b.height / 2);
    return true;
  };

  // fresh save straight into stage 1-1 (Easy): the default camera is Locked
  await page.goto(`${base}#/battle?stage=1-1&difficulty=easy`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura?.store, null, { timeout: 60000 });
  await openBattle(page, '1-1');
  await installHelpers(page);
  const insets = await page.evaluate(() => {
    const { ui } = window.__battle;
    const r = ui.shell.getBoundingClientRect();
    return { top: Math.round(ui.layer.querySelector('.bt-hud').getBoundingClientRect().bottom - r.top), bottom: Math.round(r.bottom - ui.bar.el.getBoundingClientRect().top) };
  });
  log(`  (HUD bottom ${insets.top}px, tower bar ${insets.bottom}px tall)`);
  const mode0 = await page.evaluate(() => ({ saved: window.__sakura.store.profile.settings.camera, live: window.__battle.renderer.cameraMode }));
  check(mode0.saved === 'locked' && mode0.live === 'locked', `fresh save: camera setting is Locked and the battle uses it (${JSON.stringify(mode0)})`);

  // ---- Locked: drags, pinch, mouse and wheel never move the camera ----
  const sw = await cam('swipe');
  check(sw.onCanvas, `a swipe row across the board is free of HUD (${JSON.stringify(sw)})`);
  const c0 = await settled();
  await touchDrag([sw.x0, sw.y], [sw.x1, sw.y + 40]);
  await touchDrag([sw.x1, sw.y], [sw.x0, sw.y - 30], 6);
  const c1 = await settled();
  check(same(c0, c1), `locked: real touch drags across the map leave the camera put (${fmtCam(c0)} → ${fmtCam(c1)})`);
  await touchPinch((sw.x0 + sw.x1) / 2, sw.y, 40, 160);
  const c2 = await settled();
  check(same(c0, c2) && c2.zoom === 1, `locked: a real two-finger pinch neither zooms nor pans (${fmtCam(c2)})`);
  await mouseDrag([sw.x0, sw.y], [sw.x1, sw.y + 40]);
  await page.mouse.move((sw.x0 + sw.x1) / 2, sw.y);
  await page.mouse.wheel(0, -600);
  const c3 = await settled();
  check(same(c0, c3), `locked: a mouse drag and the wheel leave the camera put (${fmtCam(c3)})`);
  await cam('drag', sw.x0, sw.y, sw.x1, sw.y + 40);
  await cam('drag', sw.x1, sw.y + 30, sw.x0, sw.y - 20, 12, 'mouse');
  await cam('pinch', (sw.x0 + sw.x1) / 2, sw.y, 40, 160);
  const c4 = await settled();
  check(same(c0, c4), `locked: an instant touch drag, mouse drag and pinch (never a long press) leave the camera put (${fmtCam(c4)})`);
  const sel0 = await page.evaluate(() => ({ placing: window.__battle.ui.placement.unitId, selected: window.__battle.ui.selectedUid }));
  check(sel0.placing == null && sel0.selected == null, `locked: those drags did not start a placement or select anything (${JSON.stringify(sel0)})`);

  // ---- Locked: tap a card, then a slightly wobbling tap on the board still places her ----
  const tapSpot = await cam('spot', 0, []);
  if (check(!!tapSpot, 'locked: found open ground for tap-to-place')) {
    const towers0 = await page.evaluate(() => window.__battle.sim.towers.length);
    check(await tapCard(tapSpot.unitId), `locked: tapping ${tapSpot.unitId}'s card starts tap-to-place`);
    await cam('tap', tapSpot.sx, tapSpot.sy, 13); // slides 13 px: more than the 9 px a pan needs
    const r = await page.evaluate(() => ({ towers: window.__battle.sim.towers.length, placing: window.__battle.ui.placement.unitId }));
    check(r.towers === towers0 + 1 && r.placing == null, `locked: a 13 px wobbly tap on the board places her (${towers0} → ${r.towers} girls)`);
    check(same(c0, await settled()), 'locked: the camera did not move while placing');
  }

  // ---- drag a card from the bar onto the board (real touch: the ghost floats 46 px above the finger) ----
  const barDrag = async (label, { secondFinger = false } = {}) => {
    const placedAt = await page.evaluate(() => window.__battle.sim.towers.map((t) => [t.x, t.y]));
    const d = await cam('spot', 46, placedAt);
    if (!check(!!d, `${label}: found open ground on screen for a bar drag`)) return null;
    const before = await settled();
    const towers0 = await page.evaluate(() => window.__battle.sim.towers.length);
    const box = await page.locator(`[data-testid="card-${d.unitId}"]`).boundingBox();
    const sx = box.x + box.width / 2;
    const sy = box.y + box.height / 2;
    const route = [1, 2, 3].map((i) => [sx, sy - 10 * i]);
    for (let i = 1; i <= 15; i++) route.push([sx + ((d.rx - sx) * i) / 15, sy - 30 + ((d.ry - (sy - 30)) * i) / 15]);
    await cam('freeze');
    await touch('touchStart', [[sx, sy, 1]]);
    for (const [x, y] of route.slice(0, 8)) await touch('touchMove', [[x, y, 1]]);
    let during = null;
    if (secondFinger) {
      // a second finger lands on the board and drags across it while the girl is held
      const [hx, hy] = route[7];
      await touch('touchStart', [[hx, hy, 1], [sw.x0, sw.y, 2]]);
      for (let i = 1; i <= 8; i++) await touch('touchMove', [[hx, hy, 1], [sw.x0 + ((sw.x1 - sw.x0) * i) / 8, sw.y + i * 3, 2]]);
      during = await page.evaluate(() => ({ placing: window.__battle.ui.placement.mode, ...window.__battle.renderer.cameraState }));
      await touch('touchEnd', [[sw.x1, sw.y + 24, 2]]); // only the second finger lifts
    }
    for (const [x, y] of route.slice(8)) await touch('touchMove', [[x, y, 1]]);
    await page.waitForFunction(([x, y]) => {
      const l = window.__battle.ui.placement.last;
      return !!l && Math.hypot(l.x - x, l.y - y) < 0.1;
    }, [d.x, d.y], { timeout: 10000 }).catch(() => null);
    const mid = await page.evaluate(() => ({ mode: window.__battle.ui.placement.mode, ok: window.__battle.ui.placement.last?.ok ?? null }));
    await touch('touchEnd');
    const after = await settled();
    const res = await page.evaluate((id) => {
      const { sim, ui } = window.__battle;
      const t = sim.towers.filter((tw) => tw.unitId === id).pop();
      return { towers: sim.towers.length, at: t ? [+t.x.toFixed(2), +t.y.toFixed(2)] : null, uid: t?.uid ?? null, placing: ui.placement.unitId };
    }, d.unitId);
    check(mid.mode === 'drag' && mid.ok === true, `${label}: holding ${d.unitId}'s card over open ground shows a valid ghost (${JSON.stringify(mid)})`);
    check(res.towers === towers0 + 1 && !!res.at && Math.hypot(res.at[0] - d.x, res.at[1] - d.y) < 0.25 && res.placing == null, `${label}: releasing places ${d.unitId} where the finger let go (aimed [${d.x}, ${d.y}] → ${JSON.stringify(res.at)})`);
    if (during) check(during.placing === 'drag' && during.zoom === before.zoom && during.pan.join() === before.pan.join(), `${label}: a second finger dragging the board while she is held does not pan or zoom (zoom ${during.zoom}, pan ${during.pan.join(',')})`);
    check(same(before, after), `${label}: the camera did not move (${fmtCam(after)})`);
    return res.uid;
  };
  const lockedUid = await barDrag('locked bar drag');
  await shot('locked-drag-placed');

  // ---- taps select her, a long press still fires ----
  const tapAndHold = async (label, uid) => {
    if (uid == null) return;
    const at = await page.evaluate((id) => {
      const t = window.__battle.sim.getTower(id);
      const s = window.__battle.renderer.worldToScreen(t.x, t.y, 0.2);
      return [s.clientX, s.clientY];
    }, uid);
    await cam('tap', at[0], at[1]);
    const selected = await page.evaluate(() => window.__battle.ui.selectedUid);
    check(selected === uid, `${label}: tapping a girl selects her (selected ${selected}, expected ${uid})`);
    await page.evaluate(() => window.__battle.ui.select(null));
    await page.evaluate(() => {
      window.__lp = null;
      window.__lpOff?.();
      window.__lpOff = window.__battle.renderer.onLongPress((p) => { window.__lp = { towerUid: p.towerUid, inBounds: p.inBounds }; });
    });
    await cam('hold', at[0], at[1], 750);
    const lp = await page.evaluate(() => window.__lp);
    check(lp?.towerUid === uid, `${label}: a long press on her fires the long-press callback (${JSON.stringify(lp)})`);
    check(await page.evaluate(() => window.__battle.ui.selectedUid == null), `${label}: the long press is not also a tap`);
    // unit info: holding a placed girl opens her Upgrade Tree; close it before the next checks
    check(await page.evaluate(() => window.__battle.ui.tree?.isOpen === true), `${label}: the long press opens her Upgrade Tree`);
    await page.evaluate(() => window.__battle.ui.tree?.close()); // synchronous: the overlay is hidden at once
  };
  await tapAndHold('locked', lockedUid);

  // ---- Locked: the panel, abilities and the pause button still work by real touch ----
  if (lockedUid != null) {
    await settled();
    await page.evaluate(() => { window.__battle.sim.cash += 5000; });
    const girl = await page.evaluate((id) => {
      const t = window.__battle.sim.getTower(id);
      const s = window.__battle.renderer.worldToScreen(t.x, t.y, 0.2);
      return [s.clientX, s.clientY];
    }, lockedUid);
    await cam('tap', girl[0], girl[1]); // a board tap (same-task touch: CDP taps outlast a tap under SwiftShader)
    const opened = await page.waitForFunction((id) => window.__battle.ui.selectedUid === id && !!document.querySelector('[data-testid="tower-panel"] [data-testid="buy-0"]'), lockedUid, { timeout: 10000 }).then(() => true, () => false);
    check(opened, 'locked: tapping her opens her upgrade panel');
    if (opened) {
      const tier0 = await page.evaluate((id) => window.__battle.sim.getTower(id).tiers[0], lockedUid);
      await tapEl('[data-testid="tower-panel"] [data-testid="buy-0"]');
      const tier1 = await page.waitForFunction(([id, t0]) => window.__battle.sim.getTower(id).tiers[0] > t0 && window.__battle.sim.getTower(id).tiers[0], [lockedUid, tier0], { timeout: 10000 }).then((hd) => hd.jsonValue(), () => tier0);
      check(tier1 === tier0 + 1, `locked: the panel's upgrade button buys a tier (path 1: T${tier0} → T${tier1})`);
      const mode = await page.evaluate((id) => {
        const cur = window.__battle.sim.getTower(id).targetMode;
        const btn = [...document.querySelectorAll('[data-testid="tower-panel"] .bt-target [data-mode]')].find((b) => b.dataset.mode !== cur);
        return { cur, next: btn?.dataset.mode ?? null };
      }, lockedUid);
      if (mode.next) {
        await tapEl(`[data-testid="tower-panel"] .bt-target [data-mode="${mode.next}"]`);
        const now = await page.waitForFunction(([id, m]) => window.__battle.sim.getTower(id).targetMode === m, [lockedUid, mode.next], { timeout: 10000 }).then(() => mode.next, () => null);
        check(now === mode.next, `locked: the panel's target buttons switch her target (${mode.cur} → ${now})`);
      }
      await shot('locked-panel');
      await tapEl('[data-testid="panel-close"]');
      check(await page.waitForFunction(() => window.__battle.ui.selectedUid == null, null, { timeout: 10000 }).then(() => true, () => false), 'locked: the panel closes with its close button');
    }
    // the hero's ultimate button (deploy the hero first when this formation has one)
    const hero = await page.evaluate(() => {
      const { sim, ui, renderer } = window.__battle;
      const id = sim.heroConfig?.unitId;
      if (!id) return null;
      if (!sim.hero) {
        outer: for (let y = 0.5; y < sim.map.height; y += 0.5) {
          for (let x = 0.5; x < sim.map.width; x += 0.5) {
            if (!sim.canPlace(id, x, y).ok) continue;
            const s = renderer.worldToScreen(x, y, 0);
            if (s.clientY > ui.bar.el.getBoundingClientRect().top - 30 || s.clientY < 70) continue;
            const t = sim.placeTower(id, x, y);
            if (t) ui.onPlaced(t);
            break outer;
          }
        }
      }
      // the ultimate only charges during waves from hero level 3: report it ready and count the
      // activations instead of running one (no wave, no impact shake in the camera checks)
      window.__ults = 0;
      window.__ultStub = { status: sim.heroUltStatus, activate: sim.activateUlt };
      sim.heroUltStatus = () => ({ ...window.__ultStub.status.call(sim), unlocked: true, ready: true, cooldownLeft: 0 });
      sim.activateUlt = () => {
        window.__ults++;
        return true;
      };
      return { id, placed: !!sim.hero };
    });
    if (hero?.placed) {
      // the widget repaints every frame; under SwiftShader the first frame with the hero's new
      // model can take many seconds at 1280×720, so the 3D draw pauses while the button is pressed
      await cam('freeze');
      const ready = await page.waitForFunction(() => {
        const b = document.querySelector('[data-testid="hero-widget"]:not([hidden]) [data-testid="ult"]');
        return !!b && !b.disabled;
      }, null, { timeout: 60000 }).then(() => true, () => false);
      if (ready) await tapEl('[data-testid="ult"]');
      check(ready && await page.waitForFunction(() => window.__ults > 0, null, { timeout: 30000 }).then(() => true, () => false), `locked: the hero's ultimate button answers a real tap (${hero.id}, button ready ${ready})`);
      await cam('thaw');
    } else log(`  (no hero in this formation: ultimate button check skipped ${JSON.stringify(hero)})`);
    await page.evaluate(() => {
      const { sim } = window.__battle;
      if (!window.__ultStub) return;
      sim.heroUltStatus = window.__ultStub.status;
      sim.activateUlt = window.__ultStub.activate;
      delete window.__ultStub;
    });
    await page.evaluate(() => window.__battle.ui.select(null));
    // the pause button opens the menu, Resume closes it
    await tapEl('[data-testid="pause"]');
    const paused = await page.waitForFunction(() => window.__battle.ui.paused && !document.querySelector('[data-testid="pause-menu"]').hidden, null, { timeout: 10000 }).then(() => true, () => false);
    await page.waitForTimeout(400); // the sheet rises in
    await tapEl('[data-testid="resume"]');
    const resumed = await page.waitForFunction(() => !window.__battle.ui.paused, null, { timeout: 10000 }).then(() => true, () => false);
    check(paused && resumed, `locked: the pause button opens the menu and Resume closes it (paused ${paused}, resumed ${resumed})`);
  }

  // ---- Locked: the info panel never hides the selected girl's ring — the board slides aside
  // just far enough once the panel stands, and back when it closes (never from a drag) ----
  await cam('thaw');
  const side = await page.evaluate(() => {
    const { sim, renderer, ui } = window.__battle;
    sim.cash += 5000;
    const unitId = [...sim.loadout.keys()].find((id) => sim.data.unit(id)?.placement === 'land');
    const rect = renderer.canvas.getBoundingClientRect();
    const barTop = ui.bar.el.getBoundingClientRect().top;
    let best = null;
    for (let y = 0.5; y < sim.map.height; y += 0.5) {
      for (let x = 0.5; x < sim.map.width; x += 0.5) {
        if (!sim.canPlace(unitId, x, y).ok) continue;
        const s = renderer.worldToScreen(x, y, 0);
        if (s.clientY < 90 || s.clientY > barTop - 30) continue;
        const fr = (s.clientX - rect.left) / rect.width;
        if (fr < 0.72 || fr > 0.92) continue;
        if (!best || Math.abs(fr - 0.82) < best.d) best = { x, y, d: Math.abs(fr - 0.82) };
      }
    }
    const t = best && sim.placeTower(unitId, best.x, best.y);
    if (!t) return null;
    ui.select(t.uid);
    return { uid: t.uid, unitId };
  });
  if (side) {
    // the slide settles: the glide reached its goal (frames can be seconds apart under SwiftShader)
    const settledFocus = await page.waitForFunction(() => {
      const c = window.__battle.renderer.cameraState;
      return c.focusGoal[0] > 0 && c.focus[0] === c.focusGoal[0];
    }, null, { timeout: 90000, polling: 300 }).then(() => true, () => false);
    const m = await page.evaluate((uid) => {
      const { sim, renderer } = window.__battle;
      const t = sim.getTower(uid);
      const r = t.eff?.range ?? t.stats?.range ?? 0;
      const panel = document.querySelector('[data-testid="tower-panel"]').getBoundingClientRect();
      return { ringRight: Math.round(renderer.worldToScreen(t.x + r, t.y, 0).clientX), panelLeft: Math.round(panel.left), ...renderer.cameraState };
    }, side.uid);
    check(settledFocus && m.focus[0] > 0 && m.ringRight <= m.panelLeft, `locked: a girl on the right slides the board so her ring clears the panel (${side.unitId}: ring edge ${m.ringRight} px ≤ panel ${m.panelLeft} px, slid ${m.focus[0]} px, locked ${m.locked}, zoom ${m.zoom})`);
    await shot('locked-panel-slide');
    await page.evaluate(() => window.__battle.ui.select(null));
    const back = await page.waitForFunction(() => {
      const f = window.__battle.renderer.cameraState.focus;
      return f[0] === 0 && f[1] === 0;
    }, null, { timeout: 60000 }).then(() => true, () => false);
    check(back, 'locked: closing the panel slides the board back to the fit');
  } else log('  (no open ground on the right of this map: panel slide check skipped)');
  const cLocked = await settled();
  check(same(c0, cLocked), `locked: after every gesture the camera is still the initial fit (${fmtCam(cLocked)})`);
  check(!takeErrors().length, 'locked checks: no errors');

  // ---- Settings → Camera → Free from the pause menu: applies at once, persists ----
  await page.evaluate(() => window.__battle.ui.openPause());
  await page.locator('[data-testid="set-camera"] button', { hasText: 'Free' }).click();
  // the sheet re-renders and rises in again (seconds under SwiftShader): shoot it once it stands
  await page.waitForFunction(() => {
    const sheet = document.querySelector('[data-testid="pause-menu"] .bt-sheet');
    return !!sheet && !sheet.getAnimations().length;
  }, null, { timeout: 15000 }).catch(() => null);
  await shot('pause-camera-free');
  await page.click('[data-testid="resume"]');
  await page.waitForTimeout(400); // the store saves 150 ms after a change
  const mode1 = await page.evaluate(() => ({ live: window.__battle.renderer.cameraMode, profile: window.__sakura.store.profile.settings.camera, stored: JSON.parse(localStorage.getItem('sakura-sentinels-save-v1') || '{}').settings?.camera }));
  check(mode1.live === 'free' && mode1.profile === 'free' && mode1.stored === 'free', `pause menu Camera → Free: the open battle switches at once and the save stores it (${JSON.stringify(mode1)})`);

  const f0 = await settled();
  await cam('drag', sw.x0, sw.y, sw.x1, sw.y + 40);
  const f1 = await settled();
  check(!same(f0, f1) && f1.zoom === f0.zoom, `free: a touch drag pans the map (${fmtCam(f0)} → ${fmtCam(f1)})`);
  const cx = (sw.x0 + sw.x1) / 2;
  await touchPinch(cx, sw.y, 40, 160);
  const f2 = await settled();
  check(f2.zoom > f1.zoom + 0.3, `free: a real two-finger pinch zooms in (zoom ${f1.zoom} → ${f2.zoom})`);
  await page.mouse.move(cx, sw.y);
  await page.mouse.wheel(0, 300);
  const f3 = await settled();
  check(f3.zoom < f2.zoom - 0.05, `free: the mouse wheel zooms (zoom ${f2.zoom} → ${f3.zoom})`);
  // back the other way: the touch drag above already pushed the view to its pan limit that way.
  // Same-task mouse pointers: a real CDP mouse drag lands as a long press under SwiftShader (above)
  await cam('drag', sw.x1, sw.y + 20, sw.x0, sw.y - 10, 12, 'mouse');
  const f4 = await settled();
  check(f4.pan.join() !== f3.pan.join() && f4.zoom === f3.zoom, `free: a mouse drag pans (pan ${f3.pan.join(',')} → ${f4.pan.join(',')})`);
  await cam('pinch', cx, sw.y, 150, 50);
  const f5 = await settled();
  check(f5.zoom < f4.zoom - 0.05 || f5.zoom === 1, `free: a pinch zooms back out (zoom ${f4.zoom} → ${f5.zoom})`);
  await page.mouse.move(cx, sw.y);
  await page.mouse.wheel(0, -500); // zoomed in again for the checks below (a moved view to hold)
  await settled();

  // free, but a card is tapped (placement pending): drags, pinch and the wheel do not move the camera
  const pendingId = await page.evaluate(() => [...window.__battle.sim.loadout.keys()].find((id) => window.__battle.sim.cash >= window.__battle.sim.placeCost(id)) || null);
  if (check(!!pendingId, 'free: a girl is affordable for tap-to-place') && check(await tapCard(pendingId), `free: tapping ${pendingId}'s card starts tap-to-place`)) {
    const p0 = await settled();
    await touchDrag([sw.x0, sw.y], [sw.x1, sw.y + 40]);
    await cam('drag', sw.x0, sw.y, sw.x1, sw.y + 40);
    await cam('drag', sw.x1, sw.y + 30, sw.x0, sw.y - 20, 12, 'mouse');
    await cam('pinch', (sw.x0 + sw.x1) / 2, sw.y, 40, 160);
    await page.mouse.move((sw.x0 + sw.x1) / 2, sw.y);
    await page.mouse.wheel(0, 400);
    const p1 = await settled();
    const still = await page.evaluate(() => window.__battle.ui.placement.unitId);
    check(same(p0, p1), `free: with a card tapped, board drags, a pinch and the wheel do not move the camera (${fmtCam(p1)})`);
    check(still === pendingId, `free: those drags did not cancel or place the pending girl (placing ${still})`);
    await page.evaluate(() => window.__battle.ui.placement.cancel());
  }
  // double-tap empty ground still resets in Free
  const dt = await cam('empty');
  if (check(!!dt, 'free: found empty ground for a double-tap')) {
    const pre = await settled();
    await cam('tap', dt[0], dt[1]);
    await cam('tap', dt[0], dt[1]);
    const r = await glidedHome();
    check(!pre.isDefault && r.isDefault && same(r, c0), `free: double-tap empty ground resets to the fitted view (${fmtCam(pre)} → ${fmtCam(r)})`);
  }

  // free: drag from the bar places a girl; a second finger dragging the board meanwhile does not pan
  await page.evaluate(() => { window.__battle.sim.cash += 5000; });
  const freeUid = await barDrag('free bar drag + second finger', { secondFinger: true });
  await tapAndHold('free', freeUid);
  await shot('free-drag-placed');
  check(!takeErrors().length, 'free checks: no errors');

  // back to Locked from the pause menu: the moved view glides back to the fit
  await cam('drag', sw.x0, sw.y, sw.x1, sw.y + 40);
  const moved = await settled();
  await page.evaluate(() => window.__battle.ui.openPause());
  await page.locator('[data-testid="set-camera"] button', { hasText: 'Locked' }).click();
  await page.click('[data-testid="resume"]');
  const back = await glidedHome();
  check(!same(moved, c0) && back.mode === 'locked' && same(back, c0), `pause menu Camera → Locked: the view returns to the initial fit (${fmtCam(moved)} → ${fmtCam(back)})`);

  // ---- Settings screen: Battle → Camera row (Locked / Free), saved immediately ----
  await page.evaluate(() => { location.hash = '#/settings'; });
  await page.waitForSelector('[data-testid="set-camera"]', { timeout: 30000 });
  const row = await page.evaluate(() => {
    const seg = document.querySelector('[data-testid="set-camera"]');
    return { buttons: [...seg.querySelectorAll('button')].map((b) => b.textContent.trim()), active: seg.querySelector('.active')?.textContent.trim(), section: seg.closest('section')?.querySelector('.panel-title')?.textContent.trim() };
  });
  check(row.section === 'Battle' && row.buttons.join('/') === 'Locked/Free' && row.active === 'Locked', `Settings → Battle → Camera shows Locked (active) / Free (${JSON.stringify(row)})`);
  await page.locator('[data-testid="set-camera"] button', { hasText: 'Free' }).click();
  await page.waitForTimeout(400);
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('sakura-sentinels-save-v1') || '{}').settings?.camera === 'free'), 'Settings → Camera → Free is saved');
  await page.locator('[data-testid="set-camera"]').scrollIntoViewIfNeeded().catch(() => {});
  await shot('settings-camera');
  await page.locator('[data-testid="set-camera"] button', { hasText: 'Locked' }).click();
  await page.waitForTimeout(400);
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('sakura-sentinels-save-v1') || '{}').settings?.camera === 'locked'), 'Settings → Camera → Locked is saved');
  check(!takeErrors().length, 'settings: no errors');

  // ---- an older save without the camera setting loads Locked ----
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('sakura-sentinels-save-v1'));
    delete raw.settings.camera;
    // leaving the 1-1 battle above saved it (battle save), and a battle link for a stage with a
    // saved battle opens its prep instead: this check wants the battle itself. The live profile
    // drops it too (the goto below only changes the hash, so the store is not reloaded).
    delete raw.battleSaves;
    delete window.__sakura.store.profile.battleSaves;
    localStorage.setItem('sakura-sentinels-save-v1', JSON.stringify(raw));
  });
  await page.goto(`${base}#/battle?stage=1-1&difficulty=easy`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sakura?.store, null, { timeout: 60000 });
  await openBattle(page, '1-1');
  const old = await page.evaluate(() => ({ saved: window.__sakura.store.profile.settings.camera, live: window.__battle.renderer.cameraMode }));
  check(old.saved === 'locked' && old.live === 'locked', `an existing save without the setting plays Locked (${JSON.stringify(old)})`);

  // ---- the locked fit shows the whole board between the HUD and the tower bar ----
  for (const map of fitMaps) {
    const stageId = stageFor.get(map.id);
    await openBattle(page, stageId);
    const fit = await page.evaluate(() => {
      const { sim, renderer, ui } = window.__battle;
      const m = sim.map;
      const hudBottom = ui.layer.querySelector('.bt-hud').getBoundingClientRect().bottom;
      const barTop = ui.bar.el.getBoundingClientRect().top;
      const pts = [];
      for (const [x, y] of [[0, 0], [m.width, 0], [0, m.height], [m.width, m.height]]) for (const z of [0, 1]) pts.push(renderer.worldToScreen(x, y, z));
      const xs = pts.map((p) => p.clientX);
      const ys = pts.map((p) => p.clientY);
      const box = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
      const inside = box.left >= -0.5 && box.right <= innerWidth + 0.5 && box.top >= hudBottom - 0.5 && box.bottom <= barTop + 0.5;
      // HUD widgets floating over the board (hero portrait, wave button): board corners and open
      // (non-road land / water) tiles whose centre they cover — a locked camera cannot pan them out
      const covered = [];
      const rects = [];
      for (const sel of ['.bt-herow', '.bt-wavectl']) {
        const el = ui.layer.querySelector(sel);
        if (!el || el.hidden || !el.getClientRects().length) continue;
        const r = el.getBoundingClientRect();
        rects.push(r);
        for (const [x, y] of [[0, m.height], [m.width, m.height]]) {
          const s = renderer.worldToScreen(x, y, 0);
          if (s.clientX >= r.left && s.clientX <= r.right && s.clientY >= r.top && s.clientY <= r.bottom) covered.push(`${sel}@${x},${y}`);
        }
      }
      let open = 0;
      let hidden = 0;
      for (let ty = 0; ty < m.height; ty++) {
        for (let tx = 0; tx < m.width; tx++) {
          if (!'.,~'.includes(m.rows[ty][tx]) || sim.pathTiles.has(`${tx},${ty}`)) continue;
          open++;
          const s = renderer.worldToScreen(tx + 0.5, ty + 0.5, 0);
          if (rects.some((r) => s.clientX >= r.left && s.clientX <= r.right && s.clientY >= r.top && s.clientY <= r.bottom)) hidden++;
        }
      }
      const r1 = (v) => Math.round(v);
      return { size: `${m.width}x${m.height}`, inside, box: { l: r1(box.left), r: r1(box.right), t: r1(box.top), b: r1(box.bottom) }, band: [r1(hudBottom), r1(barTop)], covered, open, hidden, cam: renderer.cameraState };
    });
    check(fit.inside && fit.cam.locked && fit.cam.zoom === 1, `fit ${stageId} ${map.id} (${fit.size}): whole board on screen, board ${fit.box.l}–${fit.box.r} × ${fit.box.t}–${fit.box.b} inside 0–${w} × ${fit.band[0]}–${fit.band[1]}${fit.covered.length ? `; corner under ${fit.covered.join(', ')}` : ''}; open tiles under HUD widgets: ${fit.hidden}/${fit.open}`);
    await shot(`fit-${stageId}-${map.id}`);
  }
  check(!takeErrors().length, 'fit checks: no errors');
  await cdp.detach().catch(() => {});
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
log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL CAMERA-LOCK CHECKS PASSED');
process.exit(failures.length ? 1 : 0);

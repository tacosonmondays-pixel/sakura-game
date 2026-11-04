// T5 aura at close zoom (docs/review/t5-aura-zoom): one girl at a time on 1-2 (no wave running), every T5 path colour
// through the render-only tier override, the camera at zoom 1 (the fitted battle view) and at the wheel's max (3.2).
// Per shot it counts near-white pixels (every channel >= 240) and washed pixels (every channel >= 200, the brightest
// >= 245: a pale tinted bloom) in her face box: from her head bone (it sits at eye level) projected 0.20 x her height
// lower (chin) to 0.12 x her height higher (fringe), 0.88 x that tall wide. The battle is paused and the renderer
// stepped by hand (scene hidden, so SwiftShader skips those draws): 'steady' after 90 frames of 1/60 s (a phone's
// 60 fps, whatever SwiftShader manages), 'held' after 240 more frozen frames (visual dt 0, as a paused capture draws).
//
//   node e2e/t5-aura-zoom.mjs --label before|after [--out dir] [--sizes 844x390,1280x720] [--qualities high,medium]
//        [--girls umeko,suzu] [--probe]
// Writes <out>/<label>.json and <out>/<label>-<girl>-<tiers>-<quality>-<size>-z<zoom>-<steady|held>.png (her crop).
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server.
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchChromium } from './browser.mjs';
import { openApp, seedSave, openBattle } from './lib/battleKit.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const LABEL = opt('label', 'run');
const OUT = opt('out', '/tmp/t5-aura-zoom');
const SIZES = opt('sizes', '844x390,1280x720').split(',').map((s) => s.split('x').map(Number));
const QUALS = opt('qualities', 'high,medium').split(',');
const GIRLS = opt('girls', 'umeko,suzu').split(',');
const PROBE = args.includes('--probe');
const SETS = [[5, 2, 0], [2, 0, 5], [0, 5, 2]];
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(...a);

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser, label: bl } = await launchChromium();
log(`browser: ${bl}`);
const rows = [];

/** Face box (CSS px) of a placed girl, from her head bone's projection. */
async function faceBox(page, uid) {
  return page.evaluate((uid) => {
    const r = window.__battle.renderer;
    const m = r.towerModel(uid);
    let head = null;
    m.traverse((o) => {
      if (!head && o.isBone && /^head$/i.test(o.name)) head = o;
    });
    if (!head) {
      m.traverse((o) => {
        if (!head && o.isBone && /head/i.test(o.name)) head = o;
      });
    }
    if (!head) return null;
    m.updateMatrixWorld(true);
    const p = head.getWorldPosition(head.position.clone());
    const h = r.towerModelInfo(uid)?.height || 1;
    const k = m.getWorldScale(head.position.clone()).y;
    const H = h * k;
    // the head bone sits at her eyes: the face runs from 0.20 x her height below it (chin) to 0.12 above (fringe)
    const a = r.worldToScreen(p.x, p.z, p.y - 0.2 * H);
    const b = r.worldToScreen(p.x, p.z, p.y + 0.12 * H);
    const half = Math.abs(a.clientY - b.clientY) * 0.44;
    const top = Math.min(a.clientY, b.clientY);
    return { x: (a.clientX + b.clientX) / 2 - half, y: top, w: half * 2, h: Math.abs(a.clientY - b.clientY), head: head.name, H, headY: p.y };
  }, uid);
}

/** Near-white (every channel >= 240) and washed (every channel >= 200, the brightest >= 245: a pale tinted bloom)
 * pixels inside `r` (crop pixels) of a PNG, decoded in the page. */
async function countWhite(page, buf, r) {
  return page.evaluate(async ([b64, r]) => {
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    const bm = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const c = new OffscreenCanvas(bm.width, bm.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(bm, 0, 0);
    const d = ctx.getImageData(r.x, r.y, r.w, r.h).data;
    let white = 0;
    let washed = 0;
    for (let i = 0; i < d.length; i += 4) {
      const lo = Math.min(d[i], d[i + 1], d[i + 2]);
      const hi = Math.max(d[i], d[i + 1], d[i + 2]);
      if (lo >= 240) white++;
      if (lo >= 200 && hi >= 245) washed++;
    }
    return { white, washed };
  }, [buf.toString('base64'), r]);
}

async function step(page, n) {
  // the scene hidden while stepping: the frames' particles and clocks advance, SwiftShader skips drawing them
  await page.evaluate((n) => {
    window.__battle.ui.paused = true;
    const scene = window.__battle.renderer.sceneProbe();
    scene.visible = false;
    for (let i = 0; i < n; i++) window.__battle.renderer.update(1 / 60);
    scene.visible = true;
  }, n);
}

async function hold(page, n) {
  await page.evaluate((n) => {
    window.__battle.ui.paused = true;
    const scene = window.__battle.renderer.sceneProbe();
    scene.visible = false;
    for (let i = 0; i < n; i++) window.__battle.renderer.update(0);
    scene.visible = true;
  }, n);
}

async function setZoom(page, uid, z) {
  await page.evaluate(() => window.__battle.renderer.resetCamera());
  await page.waitForFunction(() => window.__battle.renderer.cameraState.zoom < 1.0001, null, { timeout: 20000 }).catch(() => null);
  if (z <= 1) return;
  for (let i = 0; i < 16; i++) {
    const cur = await page.evaluate(() => window.__battle.renderer.cameraState.zoom);
    if (cur >= z - 1e-3) break;
    const p = await page.evaluate((uid) => {
      const t = window.__battle.sim.getTower(uid);
      const s = window.__battle.renderer.worldToScreen(t.x, t.y, 0.55);
      return { x: s.clientX, y: s.clientY };
    }, uid);
    await page.mouse.move(p.x, p.y);
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(600);
}

for (const [W, H] of SIZES) {
  for (const q of QUALS) {
    const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', (e) => log(`[pageerror] ${e.message}`));
    await openApp(page, base);
    await seedSave(page, { girls: [...GIRLS, 'luna'], hero: 'luna', towers: GIRLS, settings: { camera: 'free', quality: q, defaultSpeed: 1, reduceMotion: false } });
    await openBattle(page, { stage: '1-2' });
    await page.waitForFunction(() => window.__battle?.renderer?.pathLooksProbe, null, { timeout: 30000 });
    log(`== ${W}x${H} ${q}: renderer quality ${await page.evaluate(() => window.__battle.renderer.info.quality)}`);
    for (const girl of GIRLS) {
      const uid = await page.evaluate((g) => {
        const { sim } = window.__battle;
        for (const t of [...sim.towers]) sim.sellTower?.(t.uid);
        return window.__ab.place(g);
      }, girl);
      if (uid == null) {
        log(`  ${girl}: not placed`);
        continue;
      }
      for (const set of SETS) {
        await page.evaluate(([uid, c]) => window.__battle.renderer.setPathLookOverride(uid, c), [uid, set]);
        await page.waitForFunction(([uid, c]) => {
          const p = window.__battle.renderer.pathLooksProbe(uid);
          return p && p.glb && p.tiers?.join('-') === c.join('-') && p.pieces.length > 0;
        }, [uid, set], { timeout: 20000 }).catch(() => null);
        for (const z of [1, 3.2]) {
          await page.evaluate(() => { window.__battle.ui.paused = false; });
          await setZoom(page, uid, z);
          // a steady 60 fps (the motes spawn per drawn frame; SwiftShader draws a few a second)
          await step(page, 90);
          const fb = await faceBox(page, uid);
          const zoom = await page.evaluate(() => window.__battle.renderer.cameraState.zoom);
          if (PROBE) log(JSON.stringify(fb), zoom);
          const clip = { x: Math.round(fb.x), y: Math.round(fb.y), width: Math.max(2, Math.round(fb.w)), height: Math.max(2, Math.round(fb.h)) };
          // one crop of her (head to feet) a shot; the face box is counted inside it
          const sz = Math.max(clip.width, clip.height);
          const wide = { x: Math.max(0, Math.round(fb.x + fb.w / 2 - sz * 1.5)), y: Math.max(0, Math.round(fb.y - sz * 0.7)), width: Math.round(sz * 3), height: Math.round(sz * 4) };
          wide.width = Math.min(wide.width, W - wide.x);
          wide.height = Math.min(wide.height, H - wide.y);
          const r = { x: clip.x - wide.x, y: clip.y - wide.y, w: clip.width, h: clip.height };
          const row = { label: LABEL, girl, tiers: set.join('-'), path: set.indexOf(5), quality: q, size: `${W}x${H}`, zoom, box: clip, wide, area: clip.width * clip.height };
          // steady: 60 fps play. held: then 240 frozen frames (visual dt 0: a held render, as a paused capture harness
          // draws), which is how the live check's close-ups were taken
          for (const scen of ['steady', 'held']) {
            if (scen === 'held') await hold(page, 240);
            const name = `${LABEL}-${girl}-${set.join('')}-${q}-${W}x${H}-z${z}-${scen}.png`;
            const buf = await page.screenshot({ type: 'png', clip: wide, path: `${OUT}/${name}`, timeout: 240000 });
            const c = await countWhite(page, buf, r);
            row[scen] = { ...c, shot: name };
          }
          rows.push(row);
          log(`  ${girl} ${set.join('-')} z${zoom}: box ${clip.width}x${clip.height} steady white ${row.steady.white} washed ${row.steady.washed} | held white ${row.held.white} washed ${row.held.washed}`);
        }
      }
      await page.evaluate((uid) => window.__battle.renderer.setPathLookOverride(uid, null), uid);
    }
    await context.close();
    writeFileSync(`${OUT}/${LABEL}.json`, JSON.stringify(rows, null, 1));
  }
}
writeFileSync(`${OUT}/${LABEL}.json`, JSON.stringify(rows, null, 1));
await browser.close();
await server.close();

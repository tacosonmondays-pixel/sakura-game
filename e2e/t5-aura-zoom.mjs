// T5 aura at close zoom (docs/review/t5-aura-zoom): one girl at a time on 1-2 (no wave running), drawn at a T5 tier set
// through the render-only override, the camera at zoom 1 (the fitted battle view) and at the wheel's max (3.2).
// Per shot it measures her face box (faceBox below: from her head bone's projection and her height on screen). It counts near-white pixels (every channel >= 240),
// washed pixels (every channel >= 200 and the brightest >= 245: a pale tinted bloom) and the luminance spread (the
// standard deviation of 0.299 R + 0.587 G + 0.114 B: a washed-out face has almost none).
// Two scenarios a shot:
//   play    the battle running: 120 renderer frames of 1/60 s (a phone's 60 fps; the motes spawn per drawn frame and
//           SwiftShader draws only a few a second, so the frames are stepped by hand with their WebGL draws skipped)
//   paused  then the battle paused (the visual clock stops: renderer.update(0), as the battle loop draws a paused game)
//           for --pause frames (default 900: 15 s at 60 fps), as a player who pauses to look at her close up
//
//   node e2e/t5-aura-zoom.mjs --label before|after --size 1280x720 --quality high [--out dir]
//        [--girls umeko:0-2-5,suzu:5-0-2,midori:0-5-2] [--zooms 1,3.2] [--pause 900] [--full]
// One size and one quality per run (SwiftShader runs are slow; keep them short). Writes <out>/<label>-<size>-<q>.json
// and <out>/<label>-<girl>-<tiers>-<q>-<size>-z<zoom>-<scenario>.png (her crop; --full: the whole view too).
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
const [W, H] = opt('size', '1280x720').split('x').map(Number);
const Q = opt('quality', 'high');
const GIRLS = opt('girls', 'umeko:0-2-5,suzu:5-0-2,midori:0-5-2').split(',').map((g) => {
  const [id, t] = g.split(':');
  return { id, tiers: t.split('-').map(Number) };
});
const ZOOMS = opt('zooms', '1,3.2').split(',').map(Number);
const FULL = args.includes('--full');
const PAUSE = Number(opt('pause', 900)); // paused frames (900: 15 s at 60 fps)
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(...a);
const tag = `${W}x${H}-${Q}`;

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const { browser, label: bl } = await launchChromium();
log(`browser: ${bl}`);
const rows = [];

/**
 * Face box (CSS px) of a placed girl, from her head bone's projection (on these chibis it sits at eye level) and her
 * drawn height on screen (feet to the top of her model, Hs): from 0.03 Hs above the bone (brows) to 0.11 Hs below it
 * (chin), 0.30 Hs wide, centred on the bone.
 */
async function faceBox(page, uid) {
  return page.evaluate((uid) => {
    const r = window.__battle.renderer;
    const m = r.towerModel(uid);
    let head = null;
    m.traverse((o) => {
      if (!head && o.isBone && /^head$/i.test(o.name)) head = o;
    });
    if (!head) m.traverse((o) => {
      if (!head && o.isBone && /head/i.test(o.name)) head = o;
    });
    if (!head) return null;
    m.updateMatrixWorld(true);
    const p = head.getWorldPosition(head.position.clone());
    const base = m.getWorldPosition(head.position.clone());
    const h = (r.towerModelInfo(uid)?.height || 1) * m.getWorldScale(head.position.clone()).y;
    const hb = r.worldToScreen(p.x, p.z, p.y);
    const feet = r.worldToScreen(base.x, base.z, base.y);
    const top = r.worldToScreen(base.x, base.z, base.y + h);
    const Hs = Math.abs(feet.clientY - top.clientY);
    return { x: hb.clientX - 0.15 * Hs, y: hb.clientY - 0.03 * Hs, w: 0.3 * Hs, h: 0.14 * Hs, Hs, feet, top, head: head.name };
  }, uid);
}

/** Near-white, washed and the luminance spread inside `r` (crop px) of a PNG, decoded in the page. */
async function measure(page, buf, r) {
  return page.evaluate(async ([b64, r]) => {
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    const bm = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const c = new OffscreenCanvas(bm.width, bm.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(bm, 0, 0);
    const d = ctx.getImageData(r.x, r.y, r.w, r.h).data;
    let white = 0;
    let washed = 0;
    let s = 0;
    let s2 = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      const lo = Math.min(d[i], d[i + 1], d[i + 2]);
      const hi = Math.max(d[i], d[i + 1], d[i + 2]);
      if (lo >= 240) white++;
      if (lo >= 200 && hi >= 245) washed++;
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      s += l;
      s2 += l * l;
    }
    const mean = s / n;
    return { white: +((100 * white) / n).toFixed(1), washed: +((100 * washed) / n).toFixed(1), mean: +mean.toFixed(1), sd: +Math.sqrt(Math.max(0, s2 / n - mean * mean)).toFixed(1) };
  }, [buf.toString('base64'), r]);
}

/**
 * n renderer frames of dt with nothing drawn: the particles and clocks advance, and every WebGL draw and clear of the
 * page is skipped for those frames (SwiftShader would take seconds a frame through the bloom chain).
 */
async function frames(page, n, dt) {
  await page.evaluate(([n, dt]) => {
    // the battle's canvas (BattleRenderer styles it so); three.js draws through WebGL2
    const gls = [...document.querySelectorAll('canvas')].filter((c) => c.style.touchAction === 'none' && c.style.width === '100%').map((c) => c.getContext('webgl2')).filter(Boolean);
    const noop = () => {};
    for (const gl of gls) gl.drawElements = gl.drawArrays = gl.drawElementsInstanced = gl.drawArraysInstanced = gl.clear = noop;
    try {
      for (let i = 0; i < n; i++) window.__battle.renderer.update(dt);
    } finally {
      for (const gl of gls) for (const k of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'clear']) delete gl[k];
    }
  }, [n, dt]);
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
  await page.waitForTimeout(700);
}

const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on('pageerror', (e) => log(`[pageerror] ${e.message}`));
await openApp(page, base);
const ids = GIRLS.map((g) => g.id);
await seedSave(page, { girls: [...ids, 'luna'], hero: 'luna', towers: ids, settings: { camera: 'free', quality: Q, defaultSpeed: 1, reduceMotion: false } });
await openBattle(page, { stage: '1-2' });
await page.waitForFunction(() => window.__battle?.renderer?.pathLooksProbe, null, { timeout: 30000 });
const info = await page.evaluate(() => ({ q: window.__battle.renderer.info.quality, glow: window.__battle.renderer.info.glow }));
log(`== ${tag}: renderer ${JSON.stringify(info)}`);
for (const { id, tiers } of GIRLS) {
  await page.evaluate(() => { window.__battle.ui.paused = false; });
  const uid = await page.evaluate((g) => {
    const { sim } = window.__battle;
    for (const t of [...sim.towers]) sim.sellTower?.(t.uid);
    return window.__ab.place(g);
  }, id);
  if (uid == null) {
    log(`  ${id}: not placed`);
    continue;
  }
  await page.evaluate(([uid, c]) => window.__battle.renderer.setPathLookOverride(uid, c), [uid, tiers]);
  const pr = await page.waitForFunction(([uid, c]) => {
    const p = window.__battle.renderer.pathLooksProbe(uid);
    return p && p.glb && p.tiers?.join('-') === c.join('-') && p.pieces.length > 0 && p;
  }, [uid, tiers], { timeout: 30000 }).then((h) => h.jsonValue()).catch(() => null);
  log(`  ${id} ${tiers.join('-')}: ${pr ? `pieces ${pr.pieces.join(' ')} aura ${JSON.stringify(pr.aura)}` : 'look NOT ready'}`);
  for (const z of ZOOMS) {
    await page.evaluate(() => { window.__battle.ui.paused = false; });
    await setZoom(page, uid, z);
    const zoom = await page.evaluate(() => window.__battle.renderer.cameraState.zoom);
    const row = { label: LABEL, girl: id, tiers: tiers.join('-'), path: tiers.indexOf(5), quality: Q, size: `${W}x${H}`, zoom: +zoom.toFixed(2) };
    for (const scen of ['play', 'paused']) {
      if (scen === 'play') await frames(page, 120, 1 / 60);
      else {
        await page.evaluate(() => { window.__battle.ui.paused = true; });
        await frames(page, PAUSE, 0);
      }
      const fb = await faceBox(page, uid);
      const box = { x: Math.round(fb.x), y: Math.round(fb.y), w: Math.max(2, Math.round(fb.w)), h: Math.max(2, Math.round(fb.h)) };
      // her crop: head to feet with a margin; the face box is measured inside it
      const span = fb.Hs;
      const wide = { x: Math.round(box.x + box.w / 2 - span * 0.6), y: Math.round(fb.top.clientY - span * 0.25), width: Math.round(span * 1.2), height: Math.round(span * 1.45) };
      wide.x = Math.max(0, wide.x);
      wide.y = Math.max(0, wide.y);
      wide.width = Math.min(wide.width, W - wide.x);
      wide.height = Math.min(wide.height, H - wide.y);
      const name = `${LABEL}-${id}-${tiers.join('')}-${Q}-${W}x${H}-z${z}-${scen}.png`;
      const buf = await page.screenshot({ type: 'png', clip: wide, path: `${OUT}/${name}`, timeout: 240000 });
      if (FULL) await page.screenshot({ type: 'jpeg', quality: 80, path: `${OUT}/full-${name.replace('.png', '.jpg')}`, timeout: 240000 });
      const m = await measure(page, buf, { x: box.x - wide.x, y: box.y - wide.y, w: box.w, h: box.h });
      row[scen] = { ...m, shot: name, box: { x: box.x - wide.x, y: box.y - wide.y, w: box.w, h: box.h } };
      log(`  ${id} ${tiers.join('-')} z${row.zoom} ${scen}: face ${box.w}x${box.h} white ${m.white}% washed ${m.washed}% mean ${m.mean} sd ${m.sd}`);
    }
    rows.push(row);
    writeFileSync(`${OUT}/${LABEL}-${tag}.json`, JSON.stringify(rows, null, 1));
  }
  await page.evaluate((uid) => window.__battle.renderer.setPathLookOverride(uid, null), uid);
}
writeFileSync(`${OUT}/${LABEL}-${tag}.json`, JSON.stringify(rows, null, 1));
await context.close();
await browser.close();
await server.close();

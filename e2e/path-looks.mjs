// Path looks (docs/specs/path-looks.md): renders the Phase 1 prototype girls (Aoi, Akane, Luna) in a real battle and
// writes the review board.
//
//   node e2e/path-looks.mjs [--shots /tmp/pathlooks] [--only close,phone,perf,board] [--quality high] [--girls aoi,akane,luna]
//                           [--frames 0]   (the board was made with: --only close --quality medium, then --only phone,perf,board)
//
//   close  1280×720, free camera zoomed on one girl: every tier set (0-0-0, 3-0-0, 0-3-0, 0-0-3, 5-2-0, 2-0-5, 0-5-2)
//          drawn through the render-only override, plus idle / attack / walk frames of each T5 look
//   phone  390×844 (DPR 2, the battle camera turned for portrait): the same girls placed and upgraded for real
//          (sim.upgradeTower), Luna levelled to 25, a wave running; crops at the phone's own pixel size
//   board  docs/art/previews/path-looks-board.jpg (≤ 300 KB) from the close and phone shots
//   perf   low quality, 12 girls at mixed tiers with their looks on vs off: draw calls, triangles, frame time
// Playwright / browser discovery: e2e/browser.mjs. Starts its own Vite dev server. Exit code 1 when a check fails.
import { createServer } from 'vite';
import { mkdirSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { launchChromium } from './browser.mjs';
import { openApp, seedSave, openBattle } from './lib/battleKit.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const SHOTS = opt('shots', '/tmp/pathlooks');
const ONLY = opt('only', null);
const QUALITY = opt('quality', 'high');
const STAGE = opt('stage', '1-2');
mkdirSync(SHOTS, { recursive: true });
const BOARD = 'docs/art/previews/path-looks-board.jpg';
const CONFIGS = [[0, 0, 0], [3, 0, 0], [0, 3, 0], [0, 0, 3], [5, 2, 0], [2, 0, 5], [0, 5, 2]];
const GIRLS = opt('girls', 'aoi,akane,luna').split(',');
const FRAMES = opt('frames', '1') !== '0';
const failures = [];
const log = (...a) => console.log(...a);
function check(cond, msg) {
  log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
  return cond;
}
const want = (k) => !ONLY || ONLY.split(',').includes(k);
const cfgName = (c) => c.join('-');

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const base = `http://127.0.0.1:${port}/`;
const { browser, label } = await launchChromium();
log(`browser: ${label}`);
const errors = [];

async function battlePage({ width, height, dpr = 1, quality = QUALITY, camera = 'free', stage = STAGE }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  await openApp(page, base);
  await seedSave(page, { girls: ['aoi', 'akane', 'luna'], hero: 'luna', towers: ['aoi', 'akane'], settings: { camera, quality, defaultSpeed: 1 } });
  await openBattle(page, { stage });
  await page.waitForFunction(() => window.__battle?.renderer?.pathLooksProbe, null, { timeout: 30000 });
  return { page, context };
}

/** Waits until the girl's GLB is in, she is drawn at `tiers` (when given) and her pieces (if any) are socketed. */
async function waitLook(page, uid, n = null, ms = 20000, tiers = null) {
  await page.waitForFunction(([uid, n, tiers]) => {
    const p = window.__battle.renderer.pathLooksProbe(uid);
    if (!p || !p.glb) return false;
    if (tiers && p.tiers?.join('-') !== tiers.join('-')) return false;
    return n == null || p.pieces.length === n;
  }, [uid, n, tiers], { timeout: ms }).catch(() => null);
  // two more frames drawn after the pieces went on
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  return page.evaluate((uid) => window.__battle.renderer.pathLooksProbe(uid), uid);
}

async function screenOf(page, uid, h = 0.55) {
  return page.evaluate(([uid, h]) => {
    const t = window.__battle.sim.getTower(uid);
    const s = window.__battle.renderer.worldToScreen(t.x, t.y, h);
    return { x: s.clientX, y: s.clientY };
  }, [uid, h]);
}

async function zoomOn(page, uid, steps = 8) {
  // zoom about her, re-aiming at her each notch (the view clamps to the board, so she can drift)
  for (let i = 0; i < steps; i++) {
    const p = await screenOf(page, uid);
    await page.mouse.move(p.x, p.y);
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(500);
}

const catalog = await server.ssrLoadModule('/src/render/pathLooks/catalog.js');
const rules = await server.ssrLoadModule('/src/render/pathLooks/rules.js');
/** How many pieces she should wear at these tiers (from the catalog). */
const expected = (unit, c) => {
  const row = catalog.pathLooksFor(unit);
  const L = rules.pathLayers(c, { multi: unit === 'luna' });
  return L.pieces.reduce((n, p) => n + (rules.stagePieces(row?.paths[p.path], p.tier)?.length || 0), 0);
};

// ---------------------------------------------------------------------------------------------
// close-ups
// ---------------------------------------------------------------------------------------------
if (want('close')) {
  log('\n== close-ups, 1280×720 ==');
  const { page, context } = await battlePage({ width: 1280, height: 720 });
  for (const unit of GIRLS) {
    // one girl on the board at a time, zoomed in
    const uid = await page.evaluate((unit) => {
      const { sim } = window.__battle;
      for (const t of [...sim.towers]) sim.sellTower?.(t.uid);
      return window.__ab.place(unit);
    }, unit);
    if (!check(uid != null, `${unit} placed`)) continue;
    await waitLook(page, uid);
    for (const c of CONFIGS) {
      await page.evaluate(([uid, c]) => window.__battle.renderer.setPathLookOverride(uid, c), [uid, c]);
      // the camera glides back to its fit between shots: zoom on her again every time
      await page.evaluate(() => window.__battle.renderer.resetCamera());
      await page.waitForTimeout(200);
      await zoomOn(page, uid);
      const pr = await waitLook(page, uid, expected(unit, c), 20000, c);
      check(pr.pieces.length === expected(unit, c), `${unit} ${cfgName(c)}: pieces ${pr.pieces.join(' ') || '—'} (${pr.meshes} meshes, ${pr.triangles} tris)`);
      const p = await screenOf(page, uid, 0.5);
      const file = `${SHOTS}/close-${unit}-${cfgName(c)}.png`;
      await page.screenshot({ path: file, clip: { x: Math.max(0, p.x - 170), y: Math.max(0, p.y - 230), width: 340, height: 360 }, timeout: 240000 });
    }
    // T5 frames: idle / attack / walk for each capstone set
    for (const c of FRAMES ? [[5, 2, 0], [2, 0, 5], [0, 5, 2]] : []) {
      await page.evaluate(([uid, c]) => window.__battle.renderer.setPathLookOverride(uid, c), [uid, c]);
      await page.evaluate(() => window.__battle.renderer.resetCamera());
      await page.waitForTimeout(200);
      await zoomOn(page, uid);
      await waitLook(page, uid, expected(unit, c), 20000, c);
      const p = await screenOf(page, uid, 0.5);
      const clip = { x: Math.max(0, p.x - 170), y: Math.max(0, p.y - 230), width: 340, height: 360 };
      for (const pose of ['idle', 'attack', 'walk']) {
        await page.evaluate(([uid, pose]) => window.__battle.renderer.setPathLookPose(uid, pose), [uid, pose]);
        await page.waitForTimeout(pose === 'attack' ? 180 : 600);
        const file = `${SHOTS}/frame-${unit}-${cfgName(c)}-${pose}.png`;
        await page.screenshot({ path: file, clip, timeout: 240000 });
      }
      await page.evaluate((uid) => window.__battle.renderer.setPathLookPose(uid, null), uid);
    }
    await page.evaluate((uid) => window.__battle.renderer.setPathLookOverride(uid, null), uid);
  }
  await context.close();
}

// ---------------------------------------------------------------------------------------------
// phone: a real battle, real upgrades
// ---------------------------------------------------------------------------------------------

async function realBoard(page) {
  return page.evaluate((CONFIGS) => {
    const { sim } = window.__battle;
    const ab = window.__ab;
    const out = [];
    for (const unit of ['aoi', 'akane']) {
      for (const c of CONFIGS) {
        const uid = ab.place(unit, { skip: out.length * 3 });
        if (uid == null) continue;
        // the higher path first, so the second path stays within the crosspath cap
        const order = [0, 1, 2].sort((a, b) => c[b] - c[a]);
        for (const p of order) ab.up(uid, p, c[p]);
        out.push({ unit, uid, want: c, got: [...sim.getTower(uid).tiers] });
      }
    }
    const h = ab.place('luna', { skip: 2 });
    if (h != null) out.push({ unit: 'luna', uid: h, level: ab.heroTo(25) });
    return out;
  }, CONFIGS);
}

if (want('phone')) {
  log('\n== phone, 390×844 DPR 2: real battle ==');
  const { page, context } = await battlePage({ width: 390, height: 844, dpr: 2, camera: 'locked' });
  const board = await realBoard(page);
  for (const b of board) {
    if (b.unit === 'luna') check(b.level >= 25, `luna levelled to ${b.level}`);
    else check(b.got.join('-') === b.want.join('-'), `${b.unit} bought to ${b.got.join('-')} (wanted ${b.want.join('-')})`);
  }
  await page.evaluate(() => window.__ab.keepWave(60));
  await page.waitForTimeout(15000);
  for (const b of board) await waitLook(page, b.uid, null, 8000);
  await page.waitForTimeout(1500);
  // where each girl stands on the phone (CSS px), then one full shot: the board crops her from it at the phone's pixels
  const spots = [];
  for (const b of board) {
    const p = await screenOf(page, b.uid, 0.42);
    const pr = await page.evaluate((uid) => window.__battle.renderer.pathLooksProbe(uid), b.uid);
    const name = b.unit === 'luna' ? 'Lv25' : b.got.join('-');
    spots.push({ unit: b.unit, label: name, x: p.x, y: p.y, pieces: pr?.pieces || [] });
    check(!!pr && pr.pieces.length === expected(b.unit, b.unit === 'luna' ? pr.tiers : b.got), `phone ${b.unit} ${name}: ${pr?.pieces.join(' ') || '—'}`);
  }
  await page.screenshot({ path: `${SHOTS}/phone-board.png`, timeout: 240000 });
  writeFileSync(`${SHOTS}/phone-spots.json`, JSON.stringify({ dpr: 2, spots }, null, 1));
  await context.close();
  log('\n== desktop 1280×720: the same real battle ==');
  const d = await battlePage({ width: 1280, height: 720, camera: 'locked' });
  await realBoard(d.page);
  await d.page.evaluate(() => window.__ab.keepWave(60));
  await d.page.waitForTimeout(25000);
  await d.page.screenshot({ path: `${SHOTS}/desktop-board.png`, timeout: 240000 });
  await d.context.close();
}

// ---------------------------------------------------------------------------------------------
// perf: low quality, 12 girls at mixed tiers, looks on vs off
// ---------------------------------------------------------------------------------------------
if (want('perf')) {
  log('\n== perf: low quality, 12 girls ==');
  const { page, context } = await battlePage({ width: 1280, height: 720, quality: 'low', camera: 'locked' });
  const MIX = [[5, 2, 0], [2, 0, 5], [0, 5, 2], [3, 0, 0], [0, 3, 0], [0, 0, 3], [4, 2, 0], [0, 4, 2], [2, 0, 4], [2, 1, 0], [0, 0, 0], [5, 0, 2]];
  const uids = await page.evaluate((MIX) => {
    const ab = window.__ab;
    const out = [];
    for (let i = 0; i < 12; i++) {
      const uid = ab.place(i % 2 ? 'akane' : 'aoi', { skip: i * 3 });
      if (uid == null) continue;
      out.push(uid);
      // tiers through the render override: the one-final-tier rule allows one T5 per path and girl, a look test wants more
      window.__battle.renderer.setPathLookOverride(uid, MIX[i]);
    }
    return out;
  }, MIX);
  check(uids.length === 12, `12 girls placed (${uids.length})`);
  await page.evaluate(() => window.__ab.keepWave(60));
  for (const u of uids) await waitLook(page, u, null, 8000);
  await page.waitForTimeout(2500);
  // a still battle (the sim paused, the frame still draws and the girls still animate): the rounds compare like with like
  await page.evaluate(() => {
    window.__ab.hold(true);
    // time the layer's own per-frame work (update per girl + draw per girl), summed per frame
    const pl = window.__battle.renderer.pathLooks;
    window.__plMs = 0;
    for (const k of ['update', 'draw']) {
      const fn = pl[k].bind(pl);
      pl[k] = (...a) => {
        const t0 = performance.now();
        const r = fn(...a);
        window.__plMs += performance.now() - t0;
        return r;
      };
    }
  });
  const measure = (frames = 90) => page.evaluate((frames) => new Promise((res) => {
    const r = window.__battle.renderer;
    const ds = [];
    const calls = [];
    const tris = [];
    const pl = [];
    let last = performance.now();
    let n = 0;
    window.__plMs = 0;
    function f() {
      const now = performance.now();
      ds.push(now - last);
      last = now;
      pl.push(window.__plMs);
      window.__plMs = 0;
      const i = r.info;
      calls.push(i.calls);
      tris.push(i.triangles);
      if (++n < frames) requestAnimationFrame(f);
      else {
        const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
        const p95 = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)];
        const skip = (a) => a.slice(5);
        res({ frameMs: +med(skip(ds)).toFixed(1), frameP95: +p95(skip(ds)).toFixed(1), calls: med(calls), triangles: med(tris), layerMs: +med(skip(pl)).toFixed(3), layerP95: +p95(skip(pl)).toFixed(3) });
      }
    }
    requestAnimationFrame(f);
  }), frames);
  const setOn = (on) => page.evaluate(([on, uids, MIX]) => {
    window.__battle.renderer.pathLooks.setEnabled(on);
    uids.forEach((u, i) => window.__battle.renderer.setPathLookOverride(u, MIX[i]));
  }, [on, uids, MIX]);
  const rounds = { on: [], off: [] };
  let probe = null;
  for (const on of [false, true, false, true, false, true]) {
    await setOn(on);
    if (on) for (const u of uids) await waitLook(page, u, null, 8000);
    await page.waitForTimeout(600);
    const m = await measure();
    rounds[on ? 'on' : 'off'].push(m);
    if (on && !probe) probe = await page.evaluate((uids) => uids.map((u) => window.__battle.renderer.pathLooksProbe(u)), uids);
    log(`  looks ${on ? 'on ' : 'off'}: ${m.calls} calls, ${m.triangles} tris, frame median ${m.frameMs} ms (p95 ${m.frameP95}), layer ${m.layerMs} ms/frame (p95 ${m.layerP95})`);
  }
  const avg = (a, k) => +(a.reduce((s, x) => s + x[k], 0) / a.length).toFixed(2);
  const on = { calls: rounds.on[0].calls, triangles: rounds.on[0].triangles, frameMs: avg(rounds.on, 'frameMs'), layerMs: avg(rounds.on, 'layerMs') };
  const off = { calls: rounds.off[0].calls, triangles: rounds.off[0].triangles, frameMs: avg(rounds.off, 'frameMs'), layerMs: avg(rounds.off, 'layerMs') };
  const pieceMeshes = probe.reduce((s, p) => s + (p?.meshes || 0), 0);
  const pieceTris = probe.reduce((s, p) => s + (p?.triangles || 0), 0);
  const res = { quality: 'low', girls: uids.length, mix: MIX.map(cfgName), on, off, rounds, pieceMeshes, pieceTris, deltaCalls: on.calls - off.calls, deltaTris: on.triangles - off.triangles };
  log(`  mean: on ${on.frameMs} ms vs off ${off.frameMs} ms a frame (SwiftShader: compare, do not read as a phone); layer ${on.layerMs} ms/frame`);
  log(`  pieces: ${pieceMeshes} meshes, ${pieceTris} triangles (12 girls); +${res.deltaCalls} calls, +${res.deltaTris} triangles`);
  writeFileSync(`${SHOTS}/perf.json`, JSON.stringify(res, null, 2));
  check(res.deltaCalls <= 24, `low: path looks add ≤ 24 draw calls for 12 girls (${res.deltaCalls})`);
  check(pieceTris <= 12 * 1400, `low: path looks add ≤ 1,400 triangles a girl (${Math.round(pieceTris / 12)})`);
  check(on.layerMs < 1, `low: the layer's own CPU work stays under 1 ms a frame for 12 girls (${on.layerMs} ms)`);
  await context.close();
}

// ---------------------------------------------------------------------------------------------
// the board JPEG
// ---------------------------------------------------------------------------------------------
if (want('board')) {
  log('\n== board ==');
  const fromDisk = (f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
  const tryRead = (f) => { try { return fromDisk(f); } catch { return null; } };
  let spots = { dpr: 2, spots: [] };
  try { spots = JSON.parse(readFileSync(`${SHOTS}/phone-spots.json`, 'utf8')); } catch { /* no phone run */ }
  const FRAME_CFGS = [[5, 2, 0], [2, 0, 5], [0, 5, 2]];
  const rows = GIRLS.map((unit) => ({
    unit,
    tiles: CONFIGS.map((c) => ({ label: cfgName(c), src: tryRead(`${SHOTS}/close-${unit}-${cfgName(c)}.png`) })),
    frames: FRAME_CFGS.flatMap((c) => ['idle', 'attack', 'walk'].map((pose) => ({ label: `${cfgName(c)} ${pose}`, src: tryRead(`${SHOTS}/frame-${unit}-${cfgName(c)}-${pose}.png`) }))),
    phone: spots.spots.filter((s) => s.unit === unit),
  }));
  const phoneFull = tryRead(`${SHOTS}/phone-board.png`);
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const page = await context.newPage();
  await page.goto(`${base}?onboarding=0#/`, { waitUntil: 'load' });
  const jpeg = await page.evaluate(async ({ rows, phoneFull, dpr }) => {
    const load = (src) => new Promise((res) => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    const pad = 12;
    const tw = 170; // close-up tile: the 340×360 shot at half size
    const th = 180;
    const fw = 128; // T5 frames
    const fh = 136;
    const pw = 120; // phone crops: 80×96 CSS px of the 390×844 screen = 160×192 device px, drawn at 3/4
    const ph = 144;
    const NAMES = {
      aoi: 'Aoi (student) — path 1 Piercing Arrows · path 2 Rapid Volley · path 3 Sky Hunter',
      akane: 'Akane (student) — path 1 Big Bang · path 2 Wildfire · path 3 Rocket Science',
      luna: 'Luna (adult hero, 25-level track: every path at T3+ shows) — path 1 Lances · path 2 Gravity · path 3 Court',
    };
    const rowH = 32 + th + 22 + fh + 20 + ph + 22;
    const H = 96 + rows.length * rowH;
    const phoneImg = await load(phoneFull);
    const phoneH = H - 110;
    const phoneW = phoneImg ? Math.round((phoneImg.width / phoneImg.height) * phoneH) : 0;
    const leftW = pad + 9 * (fw + 6) + pad;
    const W = leftW + phoneW + pad;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    g.fillStyle = '#1d1a2b';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff';
    g.font = 'bold 30px sans-serif';
    g.fillText('Path looks — Phase 1 prototype', pad, 40);
    g.font = '15px sans-serif';
    g.fillStyle = '#cfc8e8';
    g.fillText('Display only (sim id unchanged). Row 1: close-ups (1280×720, free camera zoomed, medium) at each tier set via the render-only override. Row 2: every T5 look idle / attack / walk.', pad, 64);
    g.fillText('Row 3: the same girls bought for real in a 390×844 phone battle (DPR 2), cropped at 3/4 of the phone\'s device pixels. Right: that whole phone screen.', pad, 84);
    // path colour key
    const key = [['path 1', '#ff6b8b'], ['path 2', '#4cc9f0'], ['path 3', '#ffd43b']];
    let kx = leftW - 330;
    for (const [l, c] of key) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(kx, 34, 8, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.font = '15px sans-serif';
      g.fillText(l, kx + 13, 39);
      kx += 100;
    }
    let y = 100;
    for (const r of rows) {
      g.fillStyle = '#ffe9a8';
      g.font = 'bold 20px sans-serif';
      g.fillText(NAMES[r.unit], pad, y + 20);
      y += 32;
      let x = pad;
      for (const t of r.tiles) {
        const im = await load(t.src);
        if (im) g.drawImage(im, x, y, tw, th);
        g.fillStyle = '#fff';
        g.font = 'bold 15px sans-serif';
        g.fillText(t.label, x + 4, y + th + 17);
        x += tw + 6;
      }
      y += th + 22;
      x = pad;
      for (const t of r.frames) {
        const im = await load(t.src);
        // the girl sits in the middle of a 340×360 shot: crop to her (the middle 240×255)
        if (im) g.drawImage(im, 50, 50, 240, 255, x, y, fw, fh);
        g.fillStyle = '#ddd';
        g.font = '12px sans-serif';
        g.fillText(t.label, x + 2, y + fh + 14);
        x += fw + 6;
      }
      y += fh + 20;
      x = pad;
      for (const s of r.phone) {
        if (phoneImg) {
          const sw = 80 * dpr;
          const sh = 96 * dpr;
          g.drawImage(phoneImg, s.x * dpr - sw / 2, s.y * dpr - sh * 0.58, sw, sh, x, y, pw, ph);
        }
        g.fillStyle = '#ddd';
        g.font = '12px sans-serif';
        g.fillText(`phone ${s.label}`, x + 2, y + ph + 15);
        x += pw + 8;
      }
      y += ph + 22;
    }
    if (phoneImg) {
      g.drawImage(phoneImg, leftW, 100, phoneW, phoneH);
      g.fillStyle = '#cfc8e8';
      g.font = '14px sans-serif';
      g.fillText('390×844 real battle: 7 Aoi + 7 Akane bought to the tier sets, Luna Lv 25', leftW, H - 4);
    }
    // the best quality that fits 300 KB: full size first, then a little smaller
    for (const sc of [1, 0.9, 0.8, 0.72]) {
      const out = document.createElement('canvas');
      out.width = Math.round(W * sc);
      out.height = Math.round(H * sc);
      const og = out.getContext('2d');
      og.imageSmoothingQuality = 'high';
      og.drawImage(cv, 0, 0, out.width, out.height);
      for (let q = 0.86; q >= 0.6; q -= 0.04) {
        const url = out.toDataURL('image/jpeg', q);
        const bytes = Math.round((url.length - 23) * 0.75);
        if (bytes <= 295 * 1024) return { url, q, bytes, W: out.width, H: out.height };
      }
    }
    return { url: cv.toDataURL('image/jpeg', 0.5), q: 0.5, W, H };
  }, { rows, phoneFull, dpr: spots.dpr || 2 });
  mkdirSync('docs/art/previews', { recursive: true });
  writeFileSync(BOARD, Buffer.from(jpeg.url.split(',')[1], 'base64'));
  const size = statSync(BOARD).size;
  check(size <= 300 * 1024, `${BOARD}: ${jpeg.W}×${jpeg.H}, q ${jpeg.q.toFixed(2)}, ${Math.round(size / 1024)} KB (≤ 300 KB)`);
  await context.close();
}

check(!errors.length, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
await server.close();
log(failures.length ? `\n${failures.length} check(s) failed` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);

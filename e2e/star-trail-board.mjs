// Star trail look boards (docs/VFX.md "Star trail"): stills of previews/star-trail.html at six moments of a flight
// (launch, mid-flight, approach, landing swell, landing ring, shard burst) for each preset and tier at 844x390, a
// 390x844 column, a Reduce Motion still and a frame strip of 2 s on high, composed into JPEG boards; plus each tier's
// draw calls (from the renderer) and estimated fragment area over a whole flight.
//
//   node e2e/star-trail-board.mjs --out <dir> [--max-kb 300] [--quick]
//
// Starts its own Vite dev server; Playwright and the browser come from e2e/browser.mjs. The lab runs in manual mode,
// so every still is the effect stepped at 60 Hz from its launch: the same picture every run.
//
// It is also the GPU gate (vitest has no WebGL, so a shader that fails to compile or draws nothing passes the unit
// tests). The run exits 1 on any console error or page error, and when a still of the effect fails a pixel check:
//   - near-white pixels (all three channels ≥ 250) at most 0.5% of the frame;
//   - no harsh red (r > 180 and r − max(g, b) > 90) anywhere;
//   - at mid-flight, lit pixels within 2 drawn star radii of the head (at least LIT_MIN, so a stray pixel cannot pass
//     it): pixels the effect changes by ≥ 40 against the same frame with the effect's canvas hidden.
// (The stills are taken before the card turns, so her art is never what the checks measure.)
import { createServer } from 'vite';
import { mkdirSync, readFileSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const OUT = resolve(opt('out', 'e2e/out/star-trail'));
const MAX_KB = Number(opt('max-kb', 300));
const QUICK = args.includes('--quick');
const KEEP = args.includes('--keep-png');
const SHOTS = join(OUT, 'shots');
mkdirSync(SHOTS, { recursive: true });

const MOMENTS = [
  ['launch', (tl) => tl.flight * 0.2],
  ['mid-flight', (tl) => tl.flight * 0.45],
  ['approach', (tl) => tl.flight * 0.82],
  ['landing swell', (tl) => tl.flight + tl.swell * 0.75],
  ['landing ring', (tl) => tl.flight + tl.swell + 0.07],
  ['shard burst', (tl) => tl.flight + tl.swell + tl.shards * 0.4],
];
const NEAR_WHITE_MAX = 0.005;
const LIT_MIN = 25;

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const { browser, label } = await launchChromium();
console.log(`browser: ${label}`);
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
const problems = [];
let errors = 0;
page.on('console', (m) => {
  if (m.type() !== 'error' && m.type() !== 'warning') return;
  if (m.type() === 'error') errors++;
  problems.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => {
  errors++;
  problems.push(`[pageerror] ${e.message}`);
});
// the pixel checks run on a blank page of their own (a 2D canvas reading the PNG bytes back; never the lab's WebGL)
const ana = await browser.newPage({ viewport: { width: 64, height: 64 } });
const gate = [];

/**
 * The pixel checks on one still (PNG bytes): near-white share, harsh-red count, and with `head` (and the same frame
 * without the effect, `bare`) the lit pixels within 2 drawn radii of it.
 */
async function pixels(png, head = null, bare = null) {
  return ana.evaluate(async ({ a, b, h }) => {
    const read = async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = new OffscreenCanvas(img.width, img.height);
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      return g.getImageData(0, 0, img.width, img.height);
    };
    const im = await read(a);
    const d = im.data;
    let white = 0;
    let red = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const gg = d[i + 1];
      const bb = d[i + 2];
      if (r >= 250 && gg >= 250 && bb >= 250) white++;
      if (r > 180 && r - Math.max(gg, bb) > 90) red++;
    }
    let lit = null;
    if (h && b) {
      const base = (await read(b)).data;
      lit = 0;
      const rr = 2 * h.r;
      for (let y = Math.max(0, Math.floor(h.y - rr)); y <= Math.min(im.height - 1, Math.ceil(h.y + rr)); y++) {
        for (let x = Math.max(0, Math.floor(h.x - rr)); x <= Math.min(im.width - 1, Math.ceil(h.x + rr)); x++) {
          if ((x - h.x) ** 2 + (y - h.y) ** 2 > rr * rr) continue;
          const i = (y * im.width + x) * 4;
          if (Math.max(Math.abs(d[i] - base[i]), Math.abs(d[i + 1] - base[i + 1]), Math.abs(d[i + 2] - base[i + 2])) >= 40) lit++;
        }
      }
    }
    return { nearWhite: white / (im.width * im.height), harshRed: red, lit };
  }, { a: png.toString('base64'), b: bare ? bare.toString('base64') : null, h: head });
}

/** Runs the checks on a still and records the result in the gate. */
async function check(name, png, o = {}) {
  let bare = null;
  if (o.head) {
    await page.evaluate(() => { document.querySelector('canvas.fx').style.visibility = 'hidden'; });
    bare = await page.screenshot();
    await page.evaluate(() => { document.querySelector('canvas.fx').style.visibility = ''; });
  }
  const px = await pixels(png, o.head || null, bare);
  const fails = [];
  if (px.nearWhite > NEAR_WHITE_MAX) fails.push(`near-white ${(px.nearWhite * 100).toFixed(2)}% > ${NEAR_WHITE_MAX * 100}%`);
  if (px.harshRed > 0) fails.push(`${px.harshRed} harsh-red pixels`);
  if (o.head !== undefined && !(px.lit >= LIT_MIN)) fails.push(`only ${px.lit ?? 0} lit pixels near the head (≥ ${LIT_MIN})`);
  gate.push({ name, nearWhitePct: +(px.nearWhite * 100).toFixed(3), harshRed: px.harshRed, lit: px.lit, ok: !fails.length, fails });
  return px;
}

const shots = [];
try {
  await page.goto(`http://127.0.0.1:${port}/previews/star-trail.html?manual=1`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__lab, null, { timeout: 60000 });

  async function configure(vp, cfg) {
    const [w, h] = vp.split('x').map(Number);
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate((c) => window.__lab.set(c), cfg);
    await page.waitForFunction(() => { const i = document.querySelector('.card img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 30000 });
    return page.evaluate(() => window.__lab.timeline());
  }
  async function still(file, t, name = null, o = {}) {
    const info = await page.evaluate((x) => window.__lab.seek(x), t);
    const png = await page.screenshot({ path: file });
    if (name) await check(name, png, o.head ? { head: info.head } : {});
    return info;
  }

  const combos = [];
  for (const preset of ['prism', 'nightglass']) for (const tier of ['high', 'medium']) combos.push({ vp: '844x390', preset, tier });
  combos.push({ vp: '390x844', preset: 'prism', tier: 'high' }, { vp: '390x844', preset: 'nightglass', tier: 'high' });
  const only = opt('only', null); // e.g. --only nightglass
  for (const c of QUICK ? combos.filter((x) => x.vp === '844x390' && x.tier === 'high' && (!only || x.preset === only)).slice(0, only ? 1 : 2) : combos) {
    const tl = await configure(c.vp, { preset: c.preset, tier: c.tier, rm: false });
    for (const [moment, at] of MOMENTS) {
      const file = join(SHOTS, `${c.vp}-${c.preset}-${c.tier}-${moment.replace(/\s/g, '_')}.png`);
      const info = await still(file, at(tl), `${c.vp} ${c.preset} ${c.tier} ${moment}`, { head: moment === 'mid-flight' });
      shots.push({ ...c, moment, file, phase: info.phase, calls: info.rendererCalls, screens: info.screens });
    }
  }
  // Reduce Motion: the still star and crescent on the card, at the top of their fade-in
  const rm = [];
  for (const preset of ['prism', 'nightglass']) {
    const tl = await configure('844x390', { preset, tier: 'high', rm: true });
    const file = join(SHOTS, `844x390-${preset}-high-reduce_motion.png`);
    const info = await still(file, tl.land + 0.15, `844x390 ${preset} high reduce motion`);
    rm.push({ preset, file, phase: info.phase, calls: info.rendererCalls, sprites: info.sprites, joints: info.joints });
  }
  // a frame strip: 2 s of a flight on high, every 1/8 s
  const strip = [];
  for (const preset of QUICK ? [] : ['prism', 'nightglass']) {
    await configure('844x390', { preset, tier: 'high', rm: false });
    await page.evaluate(() => window.__lab.seek(0));
    for (let f = 0; f < 16; f++) {
      // (1/8 s at 60 Hz is 7.5 frames: step to the exact frame of each eighth)
      const n = Math.round((f + 1) * 7.5) - Math.round(f * 7.5);
      const info = await page.evaluate((k) => window.__lab.advance(k), n);
      const file = join(SHOTS, `strip-${preset}-${String(f).padStart(2, '0')}.png`);
      await page.screenshot({ path: file });
      strip.push({ preset, f, t: info.clock, file, phase: info.phase });
    }
  }
  // perf: every frame of a whole flight per tier and preset, at each viewport (calls from the renderer)
  const perf = [];
  for (const vp of ['844x390', '1280x720', '390x844']) {
    for (const tier of ['high', 'medium']) {
      for (const preset of ['prism', 'nightglass']) {
        const tl = await configure(vp, { preset, tier, rm: false });
        perf.push({ vp, tier, preset, ...(await page.evaluate((total) => {
          const lab = window.__lab;
          lab.seek(0);
          let maxCalls = 0;
          let peak = 0;
          let sum = 0;
          let frames = 0;
          let maxSprites = 0;
          let maxJoints = 0;
          let idleCalls = -1;
          for (let f = 0; f < Math.ceil((total + 0.3) * 60); f++) {
            const s = lab.advance(1);
            maxCalls = Math.max(maxCalls, s.rendererCalls);
            if (s.alive) {
              peak = Math.max(peak, s.screens);
              sum += s.screens;
              frames++;
            } else idleCalls = Math.max(idleCalls, s.rendererCalls);
            maxSprites = Math.max(maxSprites, s.sprites);
            maxJoints = Math.max(maxJoints, s.joints);
          }
          const dpr = lab.info().dpr;
          return { maxCalls, idleCalls, peakScreens: peak, meanScreens: sum / Math.max(1, frames), maxSprites, maxJoints, dpr };
        }, tl.total)) });
      }
    }
  }
  writeFileSync(join(OUT, 'stats.json'), JSON.stringify({ browser: label, perf, rm, gate, shots: shots.map(({ file, ...s }) => s) }, null, 2));
  console.table(perf.map((p) => ({ vp: p.vp, tier: p.tier, preset: p.preset, calls: p.maxCalls, idle: p.idleCalls, peak: p.peakScreens.toFixed(3), mean: p.meanScreens.toFixed(3), sprites: p.maxSprites, joints: p.maxJoints, dpr: p.dpr })));
  console.table(rm.map(({ file, ...r }) => r));
  console.table(gate.map(({ fails, ...g }) => g));

  // ---- compose the boards (a page of images and labels, saved as JPEG under MAX_KB)
  const img = (f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
  const css = `body{margin:0;background:#0a0f24;color:#eef1ff;font:600 15px/1.3 system-ui,sans-serif}
    .b{padding:14px 16px 16px;display:inline-block}
    h1{font-size:22px;margin:0 0 4px} p.s{margin:0 0 10px;color:#aab4e6;font-weight:500;font-size:14px}
    table{border-collapse:separate;border-spacing:6px} td{vertical-align:top;padding:0}
    th{font-size:14px;color:#cfd6ff;text-align:left;padding:0 2px}
    td.l{width:118px;font-size:14px;color:#dfe4ff;vertical-align:middle;line-height:1.35}
    img{display:block;border-radius:4px;border:1px solid #2a3566}
    .cap{font-size:12px;color:#aab4e6;font-weight:500;margin-top:2px}`;
  async function saveBoard(name, html) {
    const p = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
    await p.setContent(`<!doctype html><html><head><style>${css}</style></head><body><div class="b">${html}</div></body></html>`, { waitUntil: 'load' });
    const box = await p.$eval('.b', (e) => { const r = e.getBoundingClientRect(); return { w: Math.ceil(r.width), h: Math.ceil(r.height) }; });
    await p.setViewportSize({ width: box.w, height: box.h });
    const file = join(OUT, `${name}.jpg`);
    let q = 86;
    for (;;) {
      await p.screenshot({ path: file, type: 'jpeg', quality: q, fullPage: true });
      const kb = statSync(file).size / 1024;
      if (kb <= MAX_KB || q <= 40) {
        console.log(`board ${file}: ${box.w}x${box.h}, ${kb.toFixed(0)} KB (q ${q})`);
        break;
      }
      q -= 6;
    }
    await p.close();
    return file;
  }
  const TW = 270; // a 844x390 still on the board
  const rowLabel = (s) => `${s.preset === 'prism' ? 'Prism (SSR)' : 'Nightglass (LR)'}<br>${s.tier}<br><span class="cap">844x390</span>`;
  const rowsA = [];
  for (const preset of ['prism', 'nightglass']) for (const tier of ['high', 'medium']) {
    const row = shots.filter((s) => s.vp === '844x390' && s.preset === preset && s.tier === tier);
    if (!row.length) continue;
    rowsA.push(`<tr><td class="l">${rowLabel(row[0])}</td>${row.map((s) => `<td><img src="${img(s.file)}" width="${TW}"></td>`).join('')}</tr>`);
  }
  const head = `<tr><th></th>${MOMENTS.map(([m]) => `<th>${m}</th>`).join('')}</tr>`;
  const boards = [];
  boards.push(await saveBoard('board-1a', `<h1>Star trail, step 1: look test (not in the game yet)</h1>
    <p class="s">Six moments of one flight landing on her recruit card: Prism for an SSR, Nightglass for an LR, on the high and medium tiers. Two draw calls while it plays (the landing ring is in the second), none after.</p>
    <table>${head}${rowsA.join('')}</table>`));
  if (!QUICK) {
    const col = (preset) => shots.filter((s) => s.vp === '390x844' && s.preset === preset);
    const TP = 140;
    const portrait = ['prism', 'nightglass'].map((preset) => `<td><table><tr><th colspan="${MOMENTS.length}">${preset === 'prism' ? 'Prism' : 'Nightglass'} · high · 390x844</th></tr><tr>${col(preset).map((s) => `<td><img src="${img(s.file)}" width="${TP}"><div class="cap">${s.moment}</div></td>`).join('')}</tr></table></td>`).join('');
    const rmCells = rm.map((r) => `<td><img src="${img(r.file)}" width="${Math.round(TW * 1.6)}"><div class="cap">${r.preset === 'prism' ? 'Prism' : 'Nightglass'} · Reduce Motion: a still star, halo and crescent fade in on the card (no flight, ribbon, ring or shards)</div></td>`).join('');
    boards.push(await saveBoard('board-1b', `<h1>Star trail, step 1: phone portrait and Reduce Motion</h1>
      <p class="s">The same six moments at 390x844; Reduce Motion at 844x390.</p>
      <table><tr>${portrait}</tr></table><table><tr>${rmCells}</tr></table>`));
    const TS = 205;
    const stripRows = ['prism', 'nightglass'].map((preset) => `<tr><td class="l">${preset === 'prism' ? 'Prism' : 'Nightglass'}<br>high<br><span class="cap">844x390</span></td>${strip.filter((s) => s.preset === preset).slice(0, 8).map((s) => `<td><img src="${img(s.file)}" width="${TS}"><div class="cap">${s.t.toFixed(3)} s · ${s.phase}</div></td>`).join('')}</tr><tr><td></td>${strip.filter((s) => s.preset === preset).slice(8).map((s) => `<td><img src="${img(s.file)}" width="${TS}"><div class="cap">${s.t.toFixed(3)} s · ${s.phase}</div></td>`).join('')}</tr>`).join('');
    boards.push(await saveBoard('board-1c', `<h1>Star trail, step 1: 2 s on high, every 1/8 s</h1>
      <p class="s">Stepped at 60 Hz from the launch: the flight, the landing swell, the ring and the shards, then nothing (0 draw calls).</p>
      <table>${stripRows}</table>`));
  }
  console.log(JSON.stringify({ boards }));
} catch (e) {
  console.log(`FAILED: ${e.stack || e.message}`);
  process.exitCode = 1;
} finally {
  if (problems.length) console.log(`console problems:\n${problems.slice(0, 30).join('\n')}`);
  const failed = gate.filter((g) => !g.ok);
  for (const g of failed) console.log(`GATE FAIL ${g.name}: ${g.fails.join('; ')}`);
  if (errors) console.log(`GATE FAIL ${errors} console / page error(s)`);
  if (!gate.length) console.log('GATE FAIL no still was checked');
  if (errors || failed.length || !gate.length) process.exitCode = 1;
  else console.log(`gate: OK (${gate.length} stills: near-white ≤ ${NEAR_WHITE_MAX * 100}%, no harsh red, lit at the head mid-flight; no console errors)`);
  await browser.close();
  await server.close();
  if (!KEEP) rmSync(SHOTS, { recursive: true, force: true });
}

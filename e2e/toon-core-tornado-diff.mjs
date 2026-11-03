// The tornado must look the same after it moved onto the shared toon core (src/render/vfx/toonCore.js, docs/VFX.md
// "Toon core"). This shoots reference stills of the real tornado layer on the lab patch (previews/tornado-stills.html:
// presets × tiers × phone viewports × fixed seeded times, every frame stepped at 1/60 s) and diffs two sets pixel by
// pixel: the largest channel delta must stay ≤ MAX_DELTA and the mean channel delta under MEAN_DELTA.
//
//   node e2e/toon-core-tornado-diff.mjs --capture <dir>              # shoot the stills (before a change)
//   node e2e/toon-core-tornado-diff.mjs --ref <dir> --out <dir2>     # shoot again into dir2 and diff against dir
//   node e2e/toon-core-tornado-diff.mjs --ref <dir> --against <dir2> # diff two sets already on disk
//   options: --presets fire,sakura,vortex --qualities high,medium --viewports 844x390,390x844 --times 0.7,1.6
//            --json <file> (write the numbers) ; exit code 1 when a still is over the limits or missing
//
// The PNGs are decoded in the page (createImageBitmap + OffscreenCanvas): no image dependency. Playwright and the
// browser are found by e2e/browser.mjs; WebGL runs on SwiftShader, so the same build gives the same picture.
import { createServer } from 'vite';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchChromium } from './browser.mjs';

/** Largest allowed channel delta (0..255) and mean channel delta between the before and after stills. */
export const MAX_DELTA = 2;
export const MEAN_DELTA = 0.1;

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] != null && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const list = (name, def) => opt(name, def).split(',').filter(Boolean);
const PRESETS = list('presets', 'fire,sakura,vortex');
const QUALITIES = list('qualities', 'high,medium');
const VIEWPORTS = list('viewports', '844x390,390x844');
const TIMES = list('times', '0.7,1.6').map(Number);
const CAPTURE = opt('capture', null);
const REF = opt('ref', null);
const AGAINST = opt('against', null);
const OUT = opt('out', null);
const JSON_OUT = opt('json', null);

/** Every still of a set: { name, preset, quality, viewport, time index }. */
function configs() {
  const out = [];
  for (const vp of VIEWPORTS) for (const q of QUALITIES) for (const p of PRESETS) {
    TIMES.forEach((t, i) => out.push({ name: `${p}-${q}-${vp}-t${i}`, preset: p, quality: q, viewport: vp, i, t }));
  }
  return out;
}

async function shoot(dir, browser, port) {
  mkdirSync(dir, { recursive: true });
  const groups = new Map();
  for (const c of configs()) {
    const k = `${c.viewport}|${c.quality}|${c.preset}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  const meta = [];
  for (const [, cs] of groups) {
    const { preset, quality, viewport } = cs[0];
    const [w, h] = viewport.split('x').map(Number);
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://127.0.0.1:${port}/previews/tornado-stills.html?preset=${preset}&quality=${quality}&times=${TIMES.join(',')}&clean=1`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__stills?.ready || window.__stills?.error, null, { timeout: 120000 });
    const err = await page.evaluate(() => window.__stills.error || null);
    if (err) throw new Error(`${preset} ${quality} ${viewport}: ${err}`);
    for (const c of cs) {
      const info = await page.evaluate((i) => window.__shot(i), c.i);
      await page.screenshot({ path: join(dir, `${c.name}.png`) });
      meta.push({ ...c, ...info });
      console.log(`  shot ${c.name} (t ${info.t.toFixed(2)} s, ${info.rings} rings, ${info.calls} calls)`);
    }
    if (errors.length) console.log(`  console: ${errors.slice(0, 5).join(' | ')}`);
    await page.close();
  }
  writeFileSync(join(dir, 'stills.json'), JSON.stringify(meta, null, 1));
  return meta;
}

/** Diffs two PNGs in the page: { max, mean, changed (pixels with any channel delta), w, h }. */
async function diffPair(page, a, b) {
  return page.evaluate(async ({ a64, b64 }) => {
    const dec = async (s) => {
      const bin = atob(s);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const cv = new OffscreenCanvas(bmp.width, bmp.height);
      const cx = cv.getContext('2d', { willReadFrequently: true });
      cx.drawImage(bmp, 0, 0);
      return cx.getImageData(0, 0, bmp.width, bmp.height);
    };
    const [A, B] = await Promise.all([dec(a64), dec(b64)]);
    if (A.width !== B.width || A.height !== B.height) return { error: `size ${A.width}x${A.height} vs ${B.width}x${B.height}` };
    let max = 0;
    let sum = 0;
    let changed = 0;
    const n = A.width * A.height;
    for (let p = 0; p < n; p++) {
      let any = 0;
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(A.data[p * 4 + c] - B.data[p * 4 + c]);
        sum += d;
        if (d > max) max = d;
        any |= d;
      }
      if (any) changed++;
    }
    return { max, mean: sum / (n * 3), changed, w: A.width, h: A.height };
  }, { a64: readFileSync(a).toString('base64'), b64: readFileSync(b).toString('base64') });
}

async function compare(refDir, newDir, browser) {
  const page = await browser.newPage();
  await page.goto('about:blank');
  const rows = [];
  for (const c of configs()) {
    const a = join(refDir, `${c.name}.png`);
    const b = join(newDir, `${c.name}.png`);
    if (!existsSync(a) || !existsSync(b)) {
      rows.push({ name: c.name, error: 'missing' });
      continue;
    }
    const r = await diffPair(page, a, b);
    rows.push({ name: c.name, ...r, ok: !r.error && r.max <= MAX_DELTA && r.mean < MEAN_DELTA });
  }
  await page.close();
  const ok = rows.every((r) => r.ok);
  const worst = rows.reduce((m, r) => Math.max(m, r.max ?? 255), 0);
  const meanAll = rows.reduce((s, r) => s + (r.mean ?? 255), 0) / Math.max(1, rows.length);
  for (const r of rows) console.log(`  ${r.ok ? 'OK  ' : 'FAIL'} ${r.name}: ${r.error || `max ${r.max}, mean ${r.mean.toFixed(4)}, changed px ${r.changed}`}`);
  const summary = { ok, stills: rows.length, maxDelta: worst, meanDelta: meanAll, limits: { max: MAX_DELTA, mean: MEAN_DELTA }, rows };
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${rows.length} stills, max channel delta ${worst} (≤ ${MAX_DELTA}), mean ${meanAll.toFixed(4)} (< ${MEAN_DELTA})`);
  return summary;
}

async function main() {
  if (!CAPTURE && !REF) {
    console.log('usage: --capture <dir> | --ref <dir> (--out <dir> | --against <dir>)');
    process.exit(2);
  }
  const { browser } = await launchChromium();
  let server = null;
  let port = 0;
  const needServer = !!CAPTURE || (REF && !AGAINST);
  try {
    if (needServer) {
      server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
      await server.listen();
      port = server.httpServer.address().port;
    }
    if (CAPTURE) {
      console.log(`capturing ${configs().length} stills → ${resolve(CAPTURE)}`);
      await shoot(resolve(CAPTURE), browser, port);
      return;
    }
    const newDir = AGAINST ? resolve(AGAINST) : resolve(OUT || join('e2e', 'out', 'toon-core-after'));
    if (!AGAINST) {
      console.log(`capturing ${configs().length} stills → ${newDir}`);
      await shoot(newDir, browser, port);
    }
    const summary = await compare(resolve(REF), newDir, browser);
    if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(summary, null, 1));
    if (!summary.ok) process.exitCode = 1;
  } finally {
    await browser.close();
    await server?.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// The tornado must look the same after it moved onto the shared toon core (src/render/vfx/toonCore.js, docs/VFX.md
// "Toon core"). This shoots reference stills of the real tornado layer on the lab patch (previews/tornado-stills.html:
// presets × tiers × phone viewports × fixed seeded times, every frame stepped at 1/60 s) and diffs two sets pixel by
// pixel: the largest channel delta must stay ≤ MAX_DELTA and the mean channel delta under MEAN_DELTA.
//
//   node e2e/toon-core-tornado-diff.mjs --capture <dir>              # shoot the stills (before a change)
//   node e2e/toon-core-tornado-diff.mjs --ref <dir> --out <dir2>     # shoot again into dir2 and diff against dir
//   node e2e/toon-core-tornado-diff.mjs --ref <dir> --against <dir2> # diff two sets already on disk
//   node e2e/toon-core-tornado-diff.mjs --ref <dir> --against <dir2> --board <out.jpg>
//                                                                    # and lay out a before / after board with the numbers
//   options: --presets fire,sakura,vortex --qualities high,medium --viewports 844x390,390x844 --times 0.7,1.6
//            --json <file> (write the numbers) ; exit code 1 when a still is over the limits or missing
//            --port <n> (or LAB_PORT): shoot from a dev server already running on 127.0.0.1:<n> instead of starting one
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
const BOARD = opt('board', null);
const MAX_KB = Number(opt('max-kb', '300'));
const PORT_OPT = Number(opt('port', process.env.LAB_PORT || '0')) || 0;

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

/**
 * The before / after board: six pairs (every preset, both tiers, both viewports) at half size, each with its diff
 * (|before − after| × 40, black = identical), and the numbers of all the stills. JPEG ≤ MAX_KB.
 */
async function board(refDir, newDir, summary, browser) {
  const picks = [
    'fire-high-844x390-t0', 'sakura-high-844x390-t1', 'vortex-medium-844x390-t0', 'fire-medium-844x390-t1',
    'sakura-medium-390x844-t0', 'vortex-high-390x844-t1',
  ].filter((n) => existsSync(join(refDir, `${n}.png`)) && existsSync(join(newDir, `${n}.png`)));
  const pairs = picks.map((n) => ({
    name: n, a: readFileSync(join(refDir, `${n}.png`)).toString('base64'), b: readFileSync(join(newDir, `${n}.png`)).toString('base64'),
    row: summary.rows.find((r) => r.name === n),
  }));
  const page = await browser.newPage();
  await page.goto('about:blank');
  const out = await page.evaluate(async ({ pairs: P, summary: S, maxKb }) => {
    const load = async (s) => createImageBitmap(new Blob([Uint8Array.from(atob(s), (c) => c.charCodeAt(0))], { type: 'image/png' }));
    const k = 0.5;
    const cells = [];
    for (const p of P) {
      const [A, B] = await Promise.all([load(p.a), load(p.b)]);
      const w = A.width;
      const h = A.height;
      const ca = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true });
      ca.drawImage(A, 0, 0);
      const cb = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true });
      cb.drawImage(B, 0, 0);
      const da = ca.getImageData(0, 0, w, h);
      const db = cb.getImageData(0, 0, w, h);
      const dd = new ImageData(w, h);
      for (let i = 0; i < da.data.length; i += 4) {
        for (let c = 0; c < 3; c++) dd.data[i + c] = Math.min(255, Math.abs(da.data[i + c] - db.data[i + c]) * 40);
        dd.data[i + 3] = 255;
      }
      const cd = new OffscreenCanvas(w, h).getContext('2d');
      cd.putImageData(dd, 0, 0);
      cells.push({ p, imgs: [A, B, await createImageBitmap(cd.canvas)], w: Math.round(w * k), h: Math.round(h * k) });
    }
    const land = cells.filter((c) => c.w > c.h);
    const port = cells.filter((c) => c.w <= c.h);
    const pad = 12;
    const gap = 6;
    const colW = land.length ? land[0].w : 211;
    const W = pad * 2 + Math.max(3 * colW + 2 * gap, port.length * (3 * (port[0]?.w || 0) + 2 * gap + 18));
    const tableH = 18 + Math.ceil(S.rows.length / 2) * 15;
    const H = 70 + land.reduce((s, c) => s + c.h + 22, 0) + (port.length ? (port[0].h + 40) : 0) + tableH + pad * 2;
    const cv = new OffscreenCanvas(W, H);
    const g = cv.getContext('2d');
    g.fillStyle = '#fff8f1';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#3b2a45';
    g.font = '700 20px system-ui, sans-serif';
    g.fillText('Tornado on the shared toon core: before / after', pad, 28);
    g.font = '600 13px system-ui, sans-serif';
    g.fillStyle = S.ok ? '#2e7d4f' : '#b3261e';
    g.fillText(`${S.ok ? 'PASS' : 'FAIL'} · ${S.stills} stills · max channel delta ${S.maxDelta} (limit ≤ ${S.limits.max}) · mean ${S.meanDelta.toFixed(4)} (limit < ${S.limits.mean})`, pad, 48);
    g.fillStyle = '#7a6585';
    g.font = '500 11px system-ui, sans-serif';
    g.fillText('Columns: before (old tornado.js) · after (on toonCore.js) · |before − after| × 40 (black = identical). Half size.', pad, 63);
    let y = 74;
    const label = (t, x, yy) => {
      g.fillStyle = '#3b2a45';
      g.font = '600 11px system-ui, sans-serif';
      g.fillText(t, x, yy);
    };
    for (const c of land) {
      label(`${c.p.name}: max ${c.p.row.max}, mean ${c.p.row.mean.toFixed(4)}, changed px ${c.p.row.changed}`, pad, y + 11);
      c.imgs.forEach((im, i) => g.drawImage(im, pad + i * (c.w + gap), y + 16, c.w, c.h));
      y += c.h + 22;
    }
    if (port.length) {
      let x = pad;
      for (const c of port) {
        label(`${c.p.name}: max ${c.p.row.max}, mean ${c.p.row.mean.toFixed(4)}`, x, y + 11);
        c.imgs.forEach((im, i) => g.drawImage(im, x + i * (c.w + gap), y + 16, c.w, c.h));
        x += 3 * c.w + 2 * gap + 18;
      }
      y += port[0].h + 40;
    }
    g.fillStyle = '#3b2a45';
    g.font = '700 12px system-ui, sans-serif';
    g.fillText('All stills (preset-tier-viewport-time):', pad, y);
    g.font = '500 11px ui-monospace, monospace';
    S.rows.forEach((r, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      g.fillStyle = r.ok ? '#3b2a45' : '#b3261e';
      g.fillText(`${r.name.padEnd(26)} max ${r.max} mean ${(r.mean ?? 0).toFixed(4)}`, pad + col * (W / 2), y + 16 + row * 15);
    });
    let q = 0.9;
    let blob;
    for (; q >= 0.4; q -= 0.05) {
      blob = await cv.convertToBlob({ type: 'image/jpeg', quality: q });
      if (blob.size <= maxKb * 1024) break;
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { data: btoa(s), w: W, h: H, q };
  }, { pairs, summary, maxKb: MAX_KB });
  await page.close();
  writeFileSync(BOARD, Buffer.from(out.data, 'base64'));
  console.log(`board → ${BOARD} (${out.w}×${out.h}, JPEG q ${out.q.toFixed(2)}, ${Math.round(Buffer.from(out.data, 'base64').length / 1024)} KB)`);
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
    if (needServer && PORT_OPT) port = PORT_OPT;
    else if (needServer) {
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
    if (BOARD) await board(resolve(REF), newDir, summary, browser);
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

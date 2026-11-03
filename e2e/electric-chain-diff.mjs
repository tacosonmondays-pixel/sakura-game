// The live chain lightning (src/render/vfx/lightning.js on the toon strokes, src/render/vfx/strokes.js) must look the
// same after a change to the electricity: this shoots stills of the electricity lab's shock scene (Raika's live chain
// through three goblins) with the electric layer hidden (window.__lab.bare(): the chain, its sparks and the board only),
// stepped at 1/60 s, and diffs two sets pixel by pixel (the method of e2e/toon-core-tornado-diff.mjs: the largest
// channel delta must stay ≤ MAX_DELTA and the mean under MEAN_DELTA).
//
//   node e2e/electric-chain-diff.mjs --capture <dir> [--url http://127.0.0.1:5191]   # shoot the stills (before a change)
//   node e2e/electric-chain-diff.mjs --ref <dir> --out <dir2> [--url …]             # shoot again into dir2 and diff
//   options: --qualities high,medium --viewports 844x390,390x844 --times 0.09,0.14,0.22 --json <file>
//   without --url it starts its own Vite server on a free port; exit code 1 when a still is over the limits or missing
import { createServer } from 'vite';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchChromium } from './browser.mjs';

export const MAX_DELTA = 2;
export const MEAN_DELTA = 0.1;

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] != null && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const list = (name, def) => opt(name, def).split(',').filter(Boolean);
const QUALITIES = list('qualities', 'high,medium');
const VIEWPORTS = list('viewports', '844x390,390x844');
const TIMES = list('times', '0.09,0.14,0.22').map(Number);
const CAPTURE = opt('capture', null);
const REF = opt('ref', null);
const OUT = opt('out', null);
const JSON_OUT = opt('json', null);
const URL_OPT = opt('url', process.env.LAB_URL || null);

async function shoot(dir, browser, base) {
  mkdirSync(dir, { recursive: true });
  const names = [];
  for (const vp of VIEWPORTS) for (const q of QUALITIES) {
    const [w, h] = vp.split('x').map(Number);
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.goto(`${base}/previews/electric.html?scene=shock&quality=${q}&manual=1&clean=1`, { waitUntil: 'load', timeout: 180000 });
    await page.waitForFunction(() => window.__lab?.ready || window.__lab?.error, null, { timeout: 240000 });
    const err = await page.evaluate(() => window.__lab.error || null);
    if (err) throw new Error(`${q} ${vp}: ${err}`);
    for (const [i, t] of TIMES.entries()) {
      await page.evaluate((tt) => {
        window.__lab.shot(tt);
        window.__lab.bare();
      }, t);
      const name = `chain-${q}-${vp}-t${i}`;
      await page.screenshot({ path: join(dir, `${name}.png`) });
      names.push(name);
      console.log(`  shot ${name} (t ${t.toFixed(2)} s)`);
    }
    await page.close();
  }
  return names;
}

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
    if (A.width !== B.width || A.height !== B.height) return { error: 'size' };
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
    return { max, mean: sum / (n * 3), changed };
  }, { a64: readFileSync(a).toString('base64'), b64: readFileSync(b).toString('base64') });
}

async function main() {
  let server = null;
  let base = URL_OPT;
  if (!base) {
    server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
    await server.listen();
    base = `http://127.0.0.1:${server.httpServer.address().port}`;
  }
  base = base.replace(/\/$/, '');
  const { browser } = await launchChromium();
  let fail = false;
  try {
    if (CAPTURE) {
      await shoot(resolve(CAPTURE), browser, base);
    } else if (REF && OUT) {
      const names = await shoot(resolve(OUT), browser, base);
      const page = await browser.newPage();
      await page.goto('about:blank');
      const rows = [];
      for (const name of names) {
        const a = join(resolve(REF), `${name}.png`);
        const b = join(resolve(OUT), `${name}.png`);
        if (!existsSync(a)) {
          rows.push({ name, error: 'missing reference' });
          fail = true;
          continue;
        }
        const d = await diffPair(page, a, b);
        const ok = !d.error && d.max <= MAX_DELTA && d.mean < MEAN_DELTA;
        if (!ok) fail = true;
        rows.push({ name, ...d, ok });
        console.log(`  ${ok ? 'same' : 'DIFF'} ${name}: max ${d.max}, mean ${d.mean?.toFixed(4)}, changed ${d.changed}`);
      }
      await page.close();
      console.log(`${rows.filter((r) => r.ok).length}/${rows.length} stills within max ${MAX_DELTA}, mean ${MEAN_DELTA}`);
      if (JSON_OUT) writeFileSync(resolve(JSON_OUT), JSON.stringify(rows, null, 1));
    } else {
      console.log('usage: --capture <dir> | --ref <dir> --out <dir2>');
      fail = true;
    }
  } finally {
    await browser.close();
    if (server) await server.close();
  }
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

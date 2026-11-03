// Counts loose dark-ink fragments in the electricity lab (docs/VFX.md "Electricity"; the house rule: ink leaves before
// erosion opens holes, so an eroding piece ends in its colour bands, never as loose dark ink dashes). Steps
// previews/electric.html (manual, 1/60 s) from 0 to --until s and, for every frame, draws it twice: as it is and with
// the electric layer hidden (window.__lab.bare()), so only the electricity's own pixels are classified:
//
//   effect pixel   any channel differs from the bare frame by more than 10 (0..255)
//   ink pixel      an effect pixel the layer made dark: its luma (sRGB, 0..1) under --ink-luma (0.2) and at least
//                  0.12 under the bare frame's (the layer's ink tone over the board, whatever the grade does to it)
//   colour pixel   an effect pixel the layer lit: luma at least 0.06 over the bare frame's, or over 0.5
//   fragment       an 8-connected group of ink pixels smaller than --frag-px (40) that is either loose (no colour
//                  pixel within 2 px of it: a dark dash or speck on its own) or ink-led (fewer colour pixels within
//                  2 px of it than its own ink pixels: a dark dash beside a hairline of colour, which reads as a dark
//                  dash); an outline beside its colour is neither. `small` counts every ink group under --frag-px
//
// It also measures the flash rules on the same frames (as the B2 review did): the share of pixels whose linear luminance
// changes by 0.1 or more from the frame before (where either is under 0.8), near-white pixels (every channel over 245)
// and reddish effect pixels (r over 60 % of r + g + b, linear, bright enough), each frame's and the worst.
//
//   node e2e/electric-ink.mjs --url http://127.0.0.1:5191 --out ink.json \
//     [--scenes drumstorm,aura,shock,scorch,surge,all] [--viewports 844x390,390x844] [--qualities high,medium]
//     [--look a|b] [--until 2.5] [--frag-px 40] [--ink-luma 0.2] [--strip <dir>]  (crops of the worst frames, PNG)
//   without --url it starts its own Vite server on a free port.
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] != null && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const list = (name, def) => opt(name, def).split(',').filter(Boolean);
const SCENES = list('scenes', 'drumstorm,aura,shock,scorch,surge,all');
const VIEWPORTS = list('viewports', '844x390,390x844');
const QUALITIES = list('qualities', 'high,medium');
const LOOK = opt('look', null);
const UNTIL = Number(opt('until', '2.5'));
const FRAG_PX = Number(opt('frag-px', '40'));
const INK_LUMA = Number(opt('ink-luma', '0.2'));
const OUT = resolve(opt('out', 'electric-ink.json'));
const STRIP = opt('strip', null);
const URL_OPT = opt('url', process.env.LAB_URL || null);

async function measure(browser, base, c) {
  const [w, h] = c.viewport.split('x').map(Number);
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const q = new URLSearchParams({ scene: c.scene, quality: c.quality, manual: '1', clean: '1', ...(LOOK ? { look: LOOK } : {}) });
  await page.goto(`${base}/previews/electric.html?${q}`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.__lab?.ready || window.__lab?.error, null, { timeout: 240000 });
  const err = await page.evaluate(() => window.__lab.error || null);
  if (err) throw new Error(`${c.scene} ${c.quality} ${c.viewport}: ${err}`);
  if (!(await page.evaluate(() => typeof window.__lab.bare === 'function'))) throw new Error('the lab has no __lab.bare()');
  const r = await page.evaluate(async ({ frames, fragPx, inkLuma, strip }) => {
    const cv = document.getElementById('c');
    const W = cv.width;
    const H = cv.height;
    const N = W * H;
    const g2 = new OffscreenCanvas(W, H).getContext('2d', { willReadFrequently: true });
    const grab = () => {
      g2.drawImage(cv, 0, 0);
      return g2.getImageData(0, 0, W, H).data;
    };
    const Y = (d, i) => (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    const ink = new Uint8Array(N);
    const col = new Uint8Array(N);
    const seen = new Uint8Array(N);
    const stamp = new Int32Array(N);
    const stack = new Int32Array(N);
    let comp = 0;
    const rows = [];
    let worst = null;
    const lin = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const c = i / 255;
      lin[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }
    let prevL = null;
    let curL = new Float32Array(N);
    for (let f = 1; f <= frames; f++) {
      const t = f / 60;
      window.__lab.shot(t);
      const A = grab().slice();
      window.__lab.bare();
      const B = grab();
      let nInk = 0;
      let nCol = 0;
      let white = 0;
      let red = 0;
      let changed = 0;
      for (let p = 0, i = 0; p < N; p++, i += 4) {
        ink[p] = 0;
        col[p] = 0;
        seen[p] = 0;
        const lr = lin[A[i]];
        const lg = lin[A[i + 1]];
        const lb = lin[A[i + 2]];
        const L = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
        curL[p] = L;
        if (prevL && Math.abs(prevL[p] - L) >= 0.1 && Math.min(prevL[p], L) < 0.8) changed++;
        if (A[i] > 245 && A[i + 1] > 245 && A[i + 2] > 245) white++;
        const dm = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
        if (dm <= 10) continue;
        const tt = lr + lg + lb;
        if (tt > 0.3 && lr / tt >= 0.6) red++;
        const ya = Y(A, i);
        const yb = Y(B, i);
        if (ya < inkLuma && ya < yb - 0.12) {
          ink[p] = 1;
          nInk++;
        } else if (ya >= yb + 0.06 || ya > 0.5) {
          col[p] = 1;
          nCol++;
        }
      }
      // 8-connected groups of ink pixels
      let frags = 0;
      let loose = 0;
      let led = 0;
      let attached = 0;
      let fragPxSum = 0;
      stamp.fill(0);
      const spots = [];
      for (let p0 = 0; p0 < N; p0++) {
        if (!ink[p0] || seen[p0]) continue;
        let sp = 0;
        stack[sp++] = p0;
        seen[p0] = 1;
        let size = 0;
        let near = 0;
        comp++;
        let sx = 0;
        let sy = 0;
        while (sp) {
          const p = stack[--sp];
          size++;
          const x = p % W;
          const y = (p - x) / W;
          sx += x;
          sy += y;
          for (let dy = -2; dy <= 2; dy++) {
            const yy = y + dy;
            if (yy < 0 || yy >= H) continue;
            for (let dx = -2; dx <= 2; dx++) {
              const xx = x + dx;
              if (xx < 0 || xx >= W) continue;
              const q = yy * W + xx;
              if (col[q] && stamp[q] !== comp) {
                stamp[q] = comp;
                near++;
              }
              if (dx >= -1 && dx <= 1 && dy >= -1 && dy <= 1 && ink[q] && !seen[q]) {
                seen[q] = 1;
                stack[sp++] = q;
              }
            }
          }
        }
        if (size < fragPx && near < size) {
          frags++;
          if (near === 0) loose++;
          else led++;
          fragPxSum += size;
          if (spots.length < 12) spots.push([Math.round(sx / size), Math.round(sy / size), size, near]);
        } else if (size < fragPx) attached++;
      }
      const swap = prevL || new Float32Array(N);
      prevL = curL;
      curL = swap;
      rows.push({
        t: +t.toFixed(3), frags, loose, led, fragPx: fragPxSum, small: frags + attached, ink: nInk, colour: nCol, spots,
        changed: +(changed / N * 100).toFixed(3), white: +(white / N * 100).toFixed(3), red: +(red / N * 100).toFixed(3),
      });
      if (strip && frags > 0 && (!worst || frags > worst.frags)) {
        // the worst frame so far: keep a crop round its first spot (with the effect)
        const [x, y] = spots[0];
        const cw = Math.min(W, 160);
        const ch = Math.min(H, 120);
        const cx = Math.max(0, Math.min(W - cw, x - cw / 2));
        const cy = Math.max(0, Math.min(H - ch, y - ch / 2));
        const img = new ImageData(new Uint8ClampedArray(A.buffer), W, H);
        const full = new OffscreenCanvas(W, H);
        full.getContext('2d').putImageData(img, 0, 0);
        const out = new OffscreenCanvas(cw * 3, ch * 3);
        const go = out.getContext('2d');
        go.imageSmoothingEnabled = false;
        go.drawImage(full, cx, cy, cw, ch, 0, 0, cw * 3, ch * 3);
        // mark the fragments (small magenta boxes)
        go.strokeStyle = '#ff00ff';
        for (const [fx, fy] of spots) go.strokeRect((fx - cx) * 3 - 9, (fy - cy) * 3 - 9, 18, 18);
        const blob = await out.convertToBlob({ type: 'image/png' });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        worst = { t, frags, png: btoa(s) };
      }
    }
    return { rows, worst, W, H };
  }, { frames: Math.round(UNTIL * 60), fragPx: FRAG_PX, inkLuma: INK_LUMA, strip: !!STRIP });
  await page.close();
  return { ...r, errors };
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
  if (STRIP) mkdirSync(resolve(STRIP), { recursive: true });
  const { browser } = await launchChromium();
  const out = { look: LOOK || 'default', until: UNTIL, fragPx: FRAG_PX, inkLuma: INK_LUMA, scenes: [] };
  try {
    for (const viewport of VIEWPORTS) for (const quality of QUALITIES) for (const scene of SCENES) {
      const c = { scene, quality, viewport };
      const t0 = Date.now();
      const r = await measure(browser, base, c);
      const total = r.rows.reduce((s, x) => s + x.frags, 0);
      const frames = r.rows.filter((x) => x.frags > 0);
      const peak = Math.max(0, ...r.rows.map((x) => x.frags));
      const loose = r.rows.reduce((s, x) => s + x.loose, 0);
      const small = r.rows.reduce((s, x) => s + x.small, 0);
      const flash = {
        changedMax: Math.max(...r.rows.slice(1).map((x) => x.changed)),
        changedMean: +(r.rows.slice(1).reduce((s, x) => s + x.changed, 0) / Math.max(1, r.rows.length - 1)).toFixed(3),
        whiteMax: Math.max(...r.rows.map((x) => x.white)),
        redMax: Math.max(...r.rows.map((x) => x.red)),
      };
      const entry = { ...c, fragments: total, loose, led: total - loose, small, framesWithFragments: frames.length, peak, flash, rows: r.rows };
      out.scenes.push(entry);
      if (STRIP && r.worst) writeFileSync(join(resolve(STRIP), `${scene}-${quality}-${viewport}-t${r.worst.t.toFixed(2)}.png`), Buffer.from(r.worst.png, 'base64'));
      console.log(`  ${scene.padEnd(9)} ${quality.padEnd(6)} ${viewport}: ${total} fragments (${loose} loose, ${total - loose} ink-led; ${small} small ink groups) in ${frames.length} frames (peak ${peak}; at ${frames.slice(0, 8).map((x) => x.t.toFixed(2)).join(' ')}); flash: changed ≤ ${flash.changedMax}% (mean ${flash.changedMean}%), white ≤ ${flash.whiteMax}%, red fx ≤ ${flash.redMax}%  ${((Date.now() - t0) / 1000).toFixed(0)} s${r.errors.length ? `  errors: ${r.errors.slice(0, 2).join(' | ')}` : ''}`);
      writeFileSync(OUT, JSON.stringify(out, null, 1));
    }
  } finally {
    await browser.close();
    if (server) await server.close();
  }
  const sum = out.scenes.reduce((s, x) => s + x.fragments, 0);
  console.log(`total ${sum} fragments → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

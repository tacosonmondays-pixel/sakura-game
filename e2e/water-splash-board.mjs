// Owner boards for the toon water splash (docs/VFX.md "Water splash"): shoots previews/water-splash.html (manual,
// stepped at 1/60 s, so every cell is the same picture on every run) at six moments of one splash and lays the cells
// out on one JPEG, composed in the page (canvas, no image dependency), kept under --max-kb.
//
//   node e2e/water-splash-board.mjs --board 1 --out board-water-1.jpg   # 6 moments × fresh / river × high / medium
//                                                                        #   (844×390, battle scale), a 390×844 column,
//                                                                        #   a Reduce Motion still
//   node e2e/water-splash-board.mjs --board 2 --out board-water-2.jpg   # close-ups (2.5× zoom) of the same moments,
//                                                                        #   low tier, the tornado beside it, RM
//   node e2e/water-splash-board.mjs --board quick --out strip.jpg [--preset fresh --quality high --zoom 2.5]
//   options: --times 0.03,0.14,0.3,0.46,0.75,1.25 --max-kb 300
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] != null && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const BOARD = opt('board', 'quick');
const OUT = resolve(opt('out', `board-water-${BOARD}.jpg`));
const MAX_KB = Number(opt('max-kb', '300'));
const TIMES = opt('times', '0.03,0.14,0.3,0.46,0.75,1.25').split(',').map(Number);
const MOMENTS = ['impact', 'crown rise', 'crown break', 'droplets', 'foam', 'ripples fading'];

/**
 * Shoots one config: { viewport, preset, quality, rm, zoom, crop: [w, h], times } → [{ t, b64, stats }] (PNG crops
 * centred on the splash, or the whole view with crop null).
 */
async function shoot(browser, port, c) {
  const [w, h] = c.viewport.split('x').map(Number);
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const q = new URLSearchParams({ preset: c.preset, quality: c.quality, manual: '1', clean: '1', zoom: String(c.zoom || 1), ...(c.rm ? { rm: '1' } : {}) });
  const path = c.page || '/previews/water-splash.html';
  await page.goto(`http://127.0.0.1:${port}${path}?${q}`, { waitUntil: 'load', timeout: 120000 });
  const ready = c.page ? '__stills' : '__lab';
  await page.waitForFunction((k) => window[k]?.ready || window[k]?.error, ready, { timeout: 120000 });
  const err = await page.evaluate((k) => window[k].error || null, ready);
  if (err) throw new Error(`${path} ${c.preset}: ${err}`);
  const out = [];
  for (const [i, t] of (c.times || TIMES).entries()) {
    const stats = c.page ? await page.evaluate((k) => window.__shot(k), i) : await page.evaluate((tt) => window.__lab.shot(tt), t);
    let clip = undefined;
    if (c.crop) {
      const [sx, sy] = c.page ? [w / 2, h / 2] : await page.evaluate(() => window.__lab.screen());
      const [cw, ch] = c.crop;
      const x = Math.max(0, Math.min(w - cw, Math.round(sx - cw / 2)));
      const y = Math.max(0, Math.min(h - ch, Math.round(sy - ch * 0.58)));
      clip = { x, y, width: cw, height: ch };
    }
    const buf = await page.screenshot({ type: 'png', clip });
    out.push({ t, b64: buf.toString('base64'), stats });
  }
  if (errors.length) console.log(`  console (${c.preset} ${c.quality}): ${errors.slice(0, 3).join(' | ')}`);
  await page.close();
  console.log(`  shot ${c.label || `${c.preset} ${c.quality}${c.rm ? ' rm' : ''} ${c.viewport}`} (${out.length} cells; calls ${out.map((o) => o.stats.calls ?? o.stats.frameCalls).join('/')})`);
  return out;
}

/**
 * Composes a board in the page: sections of rows, each row a label and its cells. Returns JPEG bytes ≤ maxKb when it can
 * (the quality steps down until it fits).
 */
async function compose(browser, spec, maxKb) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.goto('about:blank');
  const b64 = await page.evaluate(async ({ spec: S, maxKb: mk }) => {
    const load = async (s) => createImageBitmap(new Blob([Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0))], { type: 'image/png' }));
    const pad = 10;
    const labelW = S.labelW ?? 132;
    const headH = 46;
    let W = 0;
    let H = headH;
    const blocks = [];
    for (const sec of S.sections) {
      const rows = [];
      let secW = labelW;
      let secH = sec.title ? 26 : 0;
      for (const row of sec.rows) {
        const imgs = [];
        for (const c of row.cells) imgs.push(await load(c.b64));
        const rh = Math.max(...imgs.map((i) => i.height)) + (sec.captions ? 16 : 0);
        const rw = labelW + imgs.reduce((s, i) => s + i.width + 4, 0);
        rows.push({ row, imgs, rh });
        secW = Math.max(secW, rw);
        secH += rh + 4;
      }
      blocks.push({ sec, rows, secW, secH });
      W = Math.max(W, secW + pad * 2);
      H += secH + pad;
    }
    const cv = new OffscreenCanvas(Math.ceil(W), Math.ceil(H + pad));
    const g = cv.getContext('2d');
    g.fillStyle = '#fff8f1';
    g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#3b2a45';
    g.font = '700 20px system-ui, sans-serif';
    g.fillText(S.title, pad, 28);
    g.font = '500 12px system-ui, sans-serif';
    g.fillStyle = '#7a6585';
    g.fillText(S.subtitle || '', pad, 42);
    let y = headH;
    for (const b of blocks) {
      if (b.sec.title) {
        g.fillStyle = '#3b2a45';
        g.font = '700 14px system-ui, sans-serif';
        g.fillText(b.sec.title, pad, y + 17);
        y += 26;
      }
      for (const r of b.rows) {
        g.fillStyle = '#3b2a45';
        g.font = '700 12px system-ui, sans-serif';
        const lines = String(r.row.label).split('\n');
        lines.forEach((l, i) => g.fillText(l, pad, y + 18 + i * 15));
        let x = pad + labelW;
        r.row.cells.forEach((c, i) => {
          const im = r.imgs[i];
          g.drawImage(im, x, y);
          if (b.sec.captions) {
            g.fillStyle = '#7a6585';
            g.font = '500 11px system-ui, sans-serif';
            g.fillText(c.caption || '', x + 2, y + im.height + 12);
          }
          x += im.width + 4;
        });
        y += r.rh + 4;
      }
      y += pad;
    }
    let q = 0.9;
    let blob = null;
    for (; q >= 0.4; q -= 0.05) {
      blob = await cv.convertToBlob({ type: 'image/jpeg', quality: q });
      if (blob.size <= mk * 1024) break;
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { data: btoa(s), q: Math.round(q * 100) / 100, w: cv.width, h: cv.height };
  }, { spec, maxKb });
  await page.close();
  return b64;
}

const cells = (shots, caps = MOMENTS) => shots.map((s, i) => ({ b64: s.b64, caption: `${caps[i] ?? ''} ${s.t.toFixed(2)} s` }));

async function main() {
  const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
  const port = server.httpServer.address().port;
  const { browser } = await launchChromium();
  try {
    let spec;
    if (BOARD === '1') {
      const crop = [250, 180];
      const rows = [];
      for (const preset of ['fresh', 'river']) {
        for (const quality of ['high', 'medium']) {
          const s = await shoot(browser, port, { viewport: '844x390', preset, quality, crop });
          rows.push({ label: `${preset === 'fresh' ? 'Fresh' : 'River'}\n${quality}\n844×390`, cells: cells(s) });
        }
      }
      const portrait = await shoot(browser, port, { viewport: '390x844', preset: 'fresh', quality: 'high', crop: [180, 250] });
      const rmShot = await shoot(browser, port, { viewport: '844x390', preset: 'fresh', quality: 'high', rm: true, crop, times: [0.1, 0.9, 2.0] });
      spec = {
        title: 'Toon water splash: six moments at battle scale',
        subtitle: 'Lab patch (lake look, our own ground painter), Nami for scale; crops at 1:1 pixels of an 844×390 phone. Fresh = Nami, Sango; River = Umeko, Wakaba.',
        sections: [
          { title: 'Landscape 844×390 · impact → crown rise → crown break → droplets → foam → ripples fading', captions: true, rows },
          { title: 'Portrait 390×844 (board turned 90°, fresh, high) and Reduce Motion (a still foam ring that fades)', captions: true, rows: [
            { label: 'Fresh high\n390×844', cells: cells(portrait) },
            { label: 'Reduce Motion\nfresh high', cells: cells(rmShot, ['still ring', 'fading', 'gone soon']) },
          ] },
        ],
      };
    } else if (BOARD === '2') {
      const crop = [300, 220];
      const z = 2.5;
      const rows = [];
      for (const [preset, quality] of [['fresh', 'high'], ['fresh', 'medium'], ['river', 'high'], ['fresh', 'low']]) {
        const s = await shoot(browser, port, { viewport: '844x390', preset, quality, crop, zoom: z });
        rows.push({ label: `${preset}\n${quality}\nzoom ${z}×`, cells: cells(s) });
      }
      const rmShot = await shoot(browser, port, { viewport: '844x390', preset: 'fresh', quality: 'medium', rm: true, crop, zoom: z, times: [0.1, 0.9, 2.0] });
      const tor = await shoot(browser, port, { page: '/previews/tornado-stills.html', label: 'tornado', viewport: '844x390', preset: 'vortex', quality: 'high', crop: [300, 220], times: [0.7, 1.6] });
      rows.push({ label: 'Reduce Motion\nfresh medium', cells: cells(rmShot, ['still ring', 'fading', 'gone soon']) });
      spec = {
        title: 'Toon water splash: close-ups (2.5× zoom) and the tornado for the house look',
        subtitle: 'Inked eroding shapes, flat bands, a hard step: no soft particles. Bottom: the cyan vortex tornado at battle scale.',
        sections: [
          { title: 'Close-ups · impact → crown rise → crown break → droplets → foam → ripples fading', captions: true, rows },
          { title: 'House look reference: the tornado (vortex, high, 844×390, battle scale)', captions: true, rows: [{ label: 'Tornado\nvortex high', cells: cells(tor, ['tornado', 'tornado']) }] },
        ],
      };
    } else {
      const preset = opt('preset', 'fresh');
      const quality = opt('quality', 'high');
      const zoom = Number(opt('zoom', '2.5'));
      const vp = opt('viewport', '844x390');
      const s = await shoot(browser, port, { viewport: vp, preset, quality, zoom, rm: args.includes('--rm'), crop: zoom > 1 ? [300, 220] : [250, 180] });
      spec = { title: `water ${preset} ${quality} zoom ${zoom}`, sections: [{ captions: true, rows: [{ label: `${preset}\n${quality}`, cells: cells(s) }] }] };
    }
    const r = await compose(browser, spec, MAX_KB);
    writeFileSync(OUT, Buffer.from(r.data, 'base64'));
    console.log(`board ${BOARD} → ${OUT} (${r.w}×${r.h}, JPEG q ${r.q}, ${Math.round(Buffer.from(r.data, 'base64').length / 1024)} KB)`);
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

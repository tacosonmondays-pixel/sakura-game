// Owner boards for the electricity (docs/VFX.md "Electricity", batch B2; lab only): shoots previews/electric.html
// (manual, stepped at 1/60 s, so every cell is the same picture on every run) at a few moments of each scene and lays the
// cells out on one JPEG, composed in the page (canvas, no image dependency), kept under --max-kb.
//
//   node e2e/electric-board.mjs --board 1 --out board-electric-1.jpg   # aura, shocked crackle, ground decal, Drumstorm,
//                                                                      #   Drone Surge × high / medium at 844×390 (1:1),
//                                                                      #   and the five girls' presets side by side
//   node e2e/electric-board.mjs --board 2 --out board-electric-2.jpg   # 390×844, Reduce Motion, 2.5× close-ups, and one
//                                                                      #   panel side by side with the tornado
//   node e2e/electric-board.mjs --board 3 --out board-electric-3.jpg   # look A and look B side by side, each beside the
//                                                                      #   tornado (844×390 and 390×844 high; 844×390
//                                                                      #   medium A and B only): 1:1 pixels and 2.5× of the
//                                                                      #   same pixels
//   node e2e/electric-board.mjs --board quick --scene aura [--quality high --zoom 2.5 --viewport 844x390 --rm]
//   options: --times 0.1,0.3,0.6 --max-kb 300 --look a|b (boards 1, 2 and quick: every preset in that look)
//            --url http://127.0.0.1:<port> (shoot from a dev server already running; else it starts its own)
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
const OUT = resolve(opt('out', `board-electric-${BOARD}.jpg`));
const MAX_KB = Number(opt('max-kb', '300'));
const LOOK = opt('look', null);
const URL_OPT = opt('url', process.env.LAB_URL || null);
/** The boards' words for the look they show (--look; none: each preset's own). */
const LOOK_TITLE = LOOK === 'b' ? ' · look B (thick bands)' : LOOK === 'a' ? ' · look A (inked, the default)' : '';
const LOOK_SUB = LOOK === 'b'
  ? 'look B: thicker opaque stepped bands of her colour round every bolt (deep, body, glow, core), ink only outside the beat rings\' and arcs\' bands, a ground glow under each beat ring'
  : 'inked toon strokes (ink, body, white-hot core)';

/** Each scene's moments (s) and what they show. */
const MOMENTS = {
  aura: { times: [0.2, 0.45, 0.8, 1.3, 2.0], caps: ['crackle', 're-struck', 're-struck', 'forks', 'still on'] },
  shock: { times: [0.09, 0.14, 0.22, 0.34, 0.5], caps: ['chain lands', 'shock burst', 'crackle', 'thinning', 'gone soon'] },
  scorch: { times: [0.04, 0.16, 0.5, 1.0, 1.55], caps: ['cracks race out', 'white-hot', 'cooling', 'eroding', 'last flecks'] },
  drumstorm: { times: [0.1, 0.2, 0.33, 0.62, 1.2], caps: ['beat 1', 'ring bursts', 'erodes', 'beat 2', 'beat 3, scorch'] },
  surge: { times: [0.08, 0.3, 0.7, 1.2, 2.0], caps: ['launch', 'arcs', 're-struck', 'drones turn', 'held web'] },
  all: { times: [0.3, 0.8, 1.4], caps: ['', '', ''] },
};

/**
 * Shoots one config: { viewport, scene, quality, rm, zoom, focus, crop: [w, h], times, page } → [{ t, b64, stats }] (PNG
 * crops round the scene's focus, or the whole view with crop null).
 */
async function shoot(browser, base, c) {
  const [w, h] = c.viewport.split('x').map(Number);
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const times = c.times || MOMENTS[c.scene]?.times || [0.3];
  const q = new URLSearchParams(c.page
    ? { preset: c.preset, quality: c.quality, clean: '1', times: times.join(',') }
    : {
      scene: c.scene, quality: c.quality, manual: '1', clean: '1', zoom: String(c.zoom || 1), ...(c.rm ? { rm: '1' } : {}),
      ...(c.focus != null ? { focus: String(c.focus) } : {}), ...((c.look || LOOK) ? { look: c.look || LOOK } : {}),
    });
  const path = c.page || '/previews/electric.html';
  await page.goto(`${base}${path}?${q}`, { waitUntil: 'load', timeout: 120000 });
  const ready = c.page ? '__stills' : '__lab';
  await page.waitForFunction((k) => window[k]?.ready || window[k]?.error, ready, { timeout: 180000 });
  const err = await page.evaluate((k) => window[k].error || null, ready);
  if (err) throw new Error(`${path} ${c.scene || c.preset}: ${err}`);
  const out = [];
  for (const [i, t] of times.entries()) {
    const stats = c.page ? await page.evaluate((k) => window.__shot(k), i) : await page.evaluate((tt) => window.__lab.shot(tt), t);
    let clip = undefined;
    if (c.crop) {
      const [sx, sy] = c.page ? [c.at?.[0] ?? w / 2, c.at?.[1] ?? h / 2] : await page.evaluate(() => window.__lab.screen());
      const [cw, ch] = c.crop;
      const x = Math.max(0, Math.min(w - cw, Math.round(sx - cw / 2)));
      const y = Math.max(0, Math.min(h - ch, Math.round(sy - ch * 0.55)));
      clip = { x, y, width: cw, height: ch };
    }
    const buf = await page.screenshot({ type: 'png', clip });
    out.push({ t, b64: buf.toString('base64'), stats });
  }
  if (errors.length) console.log(`  console (${c.scene || c.preset} ${c.quality}): ${errors.slice(0, 3).join(' | ')}`);
  await page.close();
  const peak = Math.max(0, ...out.map((o) => o.stats.worldPeak ?? 0));
  const dimmed = Math.max(0, ...out.map((o) => o.stats.dimmed ?? 0));
  console.log(`  shot ${c.label || `${c.scene} ${c.quality}${c.rm ? ' rm' : ''} ${c.viewport}${c.zoom > 1 ? ` z${c.zoom}` : ''}${c.look || LOOK ? ` look ${c.look || LOOK}` : ''}`} (${out.length} cells; calls ${out.map((o) => o.stats.calls ?? o.stats.frameCalls).join('/')}${c.page ? '' : `; flash guard peak ${peak.toFixed(3)} screens/s, dimmed ${dimmed}`})`);
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
        for (const c of row.cells) {
          const im = await load(c.b64);
          // a pixel-zoom cell (c.zoom, c.sub: [x, y, w, h] of the crop): the same pixels enlarged, no smoothing
          const [sx, sy, sw, sh] = c.sub || [0, 0, im.width, im.height];
          const z = c.zoom || 1;
          imgs.push({ im, sx, sy, sw, sh, width: Math.round(sw * z), height: Math.round(sh * z) });
        }
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
          g.imageSmoothingEnabled = false;
          g.drawImage(im.im, im.sx, im.sy, im.sw, im.sh, x, y, im.width, im.height);
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
    // whole steps of 0.05 from 0.9 down to 0.4 (KB: 1000 bytes)
    for (let qi = 90; qi >= 40; qi -= 5) {
      q = qi / 100;
      blob = await cv.convertToBlob({ type: 'image/jpeg', quality: q });
      if (blob.size <= mk * 1000) break;
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { data: btoa(s), q: Math.round(q * 100) / 100, w: cv.width, h: cv.height };
  }, { spec, maxKb });
  await page.close();
  return b64;
}

const cells = (shots, caps) => shots.map((s, i) => ({ b64: s.b64, caption: `${caps?.[i] ?? ''} ${s.t.toFixed(2)} s` }));
const NAMES = { aura: 'Crackle aura\n(Raika)', shock: 'Shocked crackle\n(after her chain)', scorch: 'Ground decal\n(scorch)', drumstorm: 'Drumstorm\n(Raika)', surge: 'Drone Surge\n(Chika)' };

async function main() {
  let server = null;
  let port = URL_OPT;
  if (!URL_OPT) {
    server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
    await server.listen();
    port = `http://127.0.0.1:${server.httpServer.address().port}`;
  }
  port = port.replace(/\/$/, '');
  const { browser } = await launchChromium();
  try {
    let spec;
    if (BOARD === '1') {
      const crop = [250, 180];
      const sections = [];
      for (const quality of ['high', 'medium']) {
        const rows = [];
        for (const scene of ['aura', 'shock', 'scorch', 'drumstorm', 'surge']) {
          const s = await shoot(browser, port, { viewport: '844x390', scene, quality, crop });
          rows.push({ label: `${NAMES[scene]}\n${quality}`, cells: cells(s, MOMENTS[scene].caps) });
        }
        sections.push({ title: `${quality === 'high' ? 'High (bloom + grade)' : 'Medium (no bloom)'} · 844×390, 1:1 pixels`, captions: true, rows });
      }
      const row = [];
      for (const quality of ['high', 'medium']) {
        const s = await shoot(browser, port, { viewport: '844x390', scene: 'aura', quality, crop: [760, 150], focus: 2, times: [0.45] });
        row.push({ label: `Presets\n${quality}`, cells: cells(s, ['Raika gold · Chika cyan · Tenka violet-white · Seiran storm blue · Yuzuha pink']) });
      }
      sections.push({ title: 'The five presets side by side (each girl\'s chain colours)', captions: true, rows: row });
      spec = {
        title: `Electricity (B2): crackle auras, shocked crackle, ground decal, Drumstorm, Drone Surge${LOOK_TITLE}`,
        subtitle: `Lab patch (lake look, our own ground painter), real chibis for scale; ${LOOK_SUB}; toon-core ground pieces. Lab only, not wired.`,
        sections,
      };
    } else if (BOARD === '2') {
      const sections = [];
      // portrait (the board turned 90°)
      const prow = [];
      for (const scene of ['aura', 'drumstorm', 'surge']) {
        const s = await shoot(browser, port, { viewport: '390x844', scene, quality: 'high', crop: [180, 230], times: MOMENTS[scene].times.slice(0, 4) });
        prow.push({ label: `${NAMES[scene]}\nhigh 390×844`, cells: cells(s, MOMENTS[scene].caps) });
      }
      sections.push({ title: 'Portrait 390×844 (board turned 90°), high, 1:1', captions: true, rows: prow });
      // Reduce Motion
      const rrow = [];
      for (const scene of ['aura', 'shock', 'drumstorm', 'surge']) {
        const s = await shoot(browser, port, { viewport: '844x390', scene, quality: 'high', rm: true, crop: [250, 180], times: [0.3, 0.9, 1.5] });
        rrow.push({ label: `${NAMES[scene]}\nReduce Motion`, cells: cells(s, ['still', 'still', 'still']) });
      }
      sections.push({ title: 'Reduce Motion: a still glow ring instead of the crackle, no re-strike flicker, arcs held still', captions: true, rows: rrow });
      // close-ups
      const zrow = [];
      for (const [scene, quality] of [['aura', 'high'], ['shock', 'high'], ['scorch', 'high'], ['surge', 'medium']]) {
        const s = await shoot(browser, port, { viewport: '844x390', scene, quality, zoom: 2.5, crop: [300, 220], times: MOMENTS[scene].times.slice(0, 4) });
        zrow.push({ label: `${NAMES[scene]}\n${quality} 2.5×`, cells: cells(s, MOMENTS[scene].caps) });
      }
      sections.push({ title: 'Close-ups (2.5× zoom)', captions: true, rows: zrow });
      // side by side with the tornado (battle scale, high)
      const tor = await shoot(browser, port, { page: '/previews/tornado-stills.html', label: 'tornado', viewport: '844x390', preset: 'vortex', quality: 'high', crop: [300, 220], times: [0.7, 1.1] });
      const ds = await shoot(browser, port, { viewport: '844x390', scene: 'drumstorm', quality: 'high', crop: [300, 220], times: [0.2, 0.62] });
      const au = await shoot(browser, port, { viewport: '844x390', scene: 'all', quality: 'high', crop: [300, 220], times: [0.8] });
      sections.push({ title: 'Beside the house look: the tornado (vortex, high) and the electricity at the same 1:1 scale', captions: true, rows: [
        { label: 'Tornado | Drumstorm\n| all', cells: [...cells(tor, ['tornado', 'tornado']), ...cells(ds, ['Drumstorm', 'Drumstorm']), ...cells(au, ['Drumstorm + auras + scorch'])] },
      ] });
      spec = {
        title: `Electricity (B2): portrait, Reduce Motion, close-ups, and beside the tornado${LOOK_TITLE}`,
        subtitle: `${LOOK_SUB[0].toUpperCase()}${LOOK_SUB.slice(1)}, stepped re-strikes, hard-stepped toon-core ground pieces; no soft sparks.`,
        sections,
      };
    } else if (BOARD === '3') {
      // look A (the default) and look B shown the same way, each beside the tornado: every moment at 1:1 and again at
      // 2.5× of the same pixels (the middle of the crop, no smoothing), so the bands can be compared at phone scale
      const sections = [];
      const AT = {
        drumstorm: { times: [0.2, 0.62], caps: ['ring bursts', 'beat 2'] },
        aura: { times: [0.45, 1.3], caps: ['re-struck', 'forks'] },
      };
      const both = (shots, caps, tag, sub) => shots.flatMap((sh, i) => [
        { b64: sh.b64, caption: `${tag} · ${caps[i]} ${sh.t.toFixed(2)} s` },
        { b64: sh.b64, caption: '2.5× (same pixels)', zoom: 2.5, sub },
      ]);
      const block = async (title, base, scenes, sub, withTornado) => {
        const rows = [];
        for (const scene of scenes) {
          const at = AT[scene];
          for (const look of ['a', 'b']) {
            const s = await shoot(browser, port, { ...base, scene, look, times: at.times });
            rows.push({ label: `${NAMES[scene] || scene}\nlook ${look.toUpperCase()}`, cells: both(s, at.caps, look.toUpperCase(), sub) });
          }
          if (withTornado && scene === scenes[0]) {
            const tor = await shoot(browser, port, { page: '/previews/tornado-stills.html', label: `tornado ${base.quality} ${base.viewport}`, viewport: base.viewport, preset: 'vortex', quality: base.quality, crop: base.crop, times: [0.7, 1.1] });
            rows.push({ label: `Tornado\n(vortex, ${base.quality})`, cells: both(tor, ['tornado', 'tornado'], 'tornado', sub) });
          }
        }
        sections.push({ title, captions: true, rows });
      };
      const landscape = { viewport: '844x390', crop: [250, 180] };
      // the 2.5× cells: the middle of each crop round the girl (small enough that the board stays under --max-kb)
      const subL = [65, 45, 120, 85];
      await block('844×390, high (bloom + grade): A, B and the tornado, 1:1 and 2.5× of the same pixels', { ...landscape, quality: 'high' }, ['drumstorm', 'aura'], subL, true);
      await block('844×390, medium (no bloom)', { ...landscape, quality: 'medium' }, ['drumstorm'], subL, false);
      await block('390×844 (board turned 90°), high', { viewport: '390x844', quality: 'high', crop: [180, 230] }, ['drumstorm'], [40, 58, 100, 115], true);
      spec = {
        title: 'Electricity (B2 r3): look A (the default) and look B side by side, each beside the tornado',
        subtitle: 'A: inked line-work. B: thicker opaque stepped bands, a ground glow under the beat rings. Tornado: translucent brush ribbons, no ink. Lab only.',
        sections,
      };
    } else {
      const scene = opt('scene', 'aura');
      const quality = opt('quality', 'high');
      const zoom = Number(opt('zoom', '1'));
      const vp = opt('viewport', '844x390');
      const times = opt('times', null);
      const s = await shoot(browser, port, { viewport: vp, scene, quality, zoom, rm: args.includes('--rm'), focus: opt('focus', null), crop: zoom > 1 ? [300, 220] : [250, 180], times: times ? times.split(',').map(Number) : null });
      spec = { title: `electric ${scene} ${quality} zoom ${zoom}`, sections: [{ captions: true, rows: [{ label: `${scene}\n${quality}`, cells: cells(s, MOMENTS[scene]?.caps) }] }] };
    }
    const r = await compose(browser, spec, MAX_KB);
    writeFileSync(OUT, Buffer.from(r.data, 'base64'));
    const kb = Math.ceil(Buffer.from(r.data, 'base64').length / 1000);
    console.log(`board ${BOARD} → ${OUT} (${r.w}×${r.h}, JPEG q ${r.q}, ${kb} KB)${kb > MAX_KB ? `  OVER --max-kb ${MAX_KB}: show fewer cells` : ''}`);
  } finally {
    await browser.close();
    await server?.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

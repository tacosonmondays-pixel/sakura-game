// Owner boards for the toon beams (docs/VFX.md "Toon beams", batch B3; lab only): shoots previews/beams.html (manual,
// stepped at 1/60 s, so every cell is the same picture on every run) at each preset's beats and lays the cells out on one
// JPEG, composed in the page (canvas, no image dependency), kept under --max-kb.
//
//   node e2e/beams-board.mjs --port 5192 --board 1 --out board-beams-1.jpg   # every preset × high / medium at 844×390,
//                                                                            #   charge, fire, impact, sustain, end
//   node e2e/beams-board.mjs --port 5192 --board 2 --out board-beams-2.jpg   # 390×844, Reduce Motion, 2.5× close-ups of
//                                                                            #   the crown and the prism, beside the
//                                                                            #   tornado, and today's beam vs the new one
//   node e2e/beams-board.mjs --port 5192 --board ribbons --out board-ribbons-2.jpg  # look A beside look C (light
//                                                                                  #   ribbons) and the tornado
//   node e2e/beams-board.mjs --port 5192 --board quick --scene luna [--quality high --zoom 2.5 --focus crown --rm --old
//        --look c]
//   --port: a dev server already running there (else it starts its own on a free port); --max-kb 300
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
const OUT = resolve(opt('out', `board-beams-${BOARD}.jpg`));
const MAX_KB = Number(opt('max-kb', '300'));
const PORT = Number(opt('port', '0'));
const PRESETS = ['umeko', 'luna', 'kohaku', 'miko', 'raika'];
const NAMES = {
  umeko: 'Umeko\nSearchlight Sweep', luna: 'Luna\nmoonbeams', kohaku: 'Kohaku & Tsubaki\nprism beam', miko: 'Miko\nholy ray',
  raika: 'Raika\nOvercharge lance',
};

/**
 * Shoots one config: { viewport, scene, quality, rm, old, zoom, focus, crop: [w, h], times | moments, page } →
 * [{ t, cap, b64, stats }] (PNG crops round the scene's focus).
 */
async function shoot(browser, port, c) {
  const [w, h] = c.viewport.split('x').map(Number);
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const q = c.page
    ? new URLSearchParams({ preset: c.preset, quality: c.quality, clean: '1', times: c.times.join(','), girl: c.girl ?? 'akane' })
    : new URLSearchParams({
      scene: c.scene, quality: c.quality, manual: '1', clean: '1', zoom: String(c.zoom || 1), focus: c.focus || 'beam',
      ...(c.rm ? { rm: '1' } : {}), ...(c.old ? { old: '1' } : {}), ...(c.look ? { look: c.look } : {}),
    });
  const path = c.page || '/previews/beams.html';
  await page.goto(`http://127.0.0.1:${port}${path}?${q}`, { waitUntil: 'load', timeout: 180000 });
  const ready = c.page ? '__stills' : '__lab';
  await page.waitForFunction((k) => window[k]?.ready || window[k]?.error, ready, { timeout: 240000 });
  const err = await page.evaluate((k) => window[k].error || null, ready);
  if (err) throw new Error(`${path} ${c.scene || c.preset}: ${err}`);
  let beats = c.times ? c.times.map((t, i) => ({ t, cap: c.caps?.[i] ?? '' })) : await page.evaluate(() => window.__lab.moments());
  if (c.pick) beats = beats.filter((b) => c.pick.includes(b.cap));
  const out = [];
  for (const [i, b] of beats.entries()) {
    const stats = c.page ? await page.evaluate((k) => window.__shot(k), i) : await page.evaluate((tt) => window.__lab.shot(tt), b.t);
    let clip;
    if (c.crop) {
      const [sx, sy] = c.page ? [c.at?.[0] ?? w / 2, c.at?.[1] ?? h / 2] : await page.evaluate(() => window.__lab.screen());
      const [cw, ch] = c.crop;
      clip = { x: Math.max(0, Math.min(w - cw, Math.round(sx - cw / 2))), y: Math.max(0, Math.min(h - ch, Math.round(sy - ch * 0.5))), width: cw, height: ch };
    }
    const buf = await page.screenshot({ type: 'png', clip });
    out.push({ t: b.t, cap: b.cap, b64: buf.toString('base64'), stats });
  }
  if (errors.length) console.log(`  console (${c.scene || c.preset} ${c.quality}): ${errors.slice(0, 3).join(' | ')}`);
  await page.close();
  const peak = Math.max(0, ...out.map((o) => o.stats.worldPeak ?? 0));
  console.log(`  shot ${c.label || `${c.scene} ${c.quality}${c.rm ? ' rm' : ''}${c.old ? ' today' : ''} ${c.viewport}${c.zoom > 1 ? ` z${c.zoom}` : ''}`} (${out.length} cells; calls ${out.map((o) => o.stats.calls ?? o.stats.frameCalls).join('/')}${c.page ? '' : `; flash guard peak ${peak.toFixed(3)} screens/s`})`);
  return out;
}

/** Composes a board in the page: sections of rows, each row a label and its cells; a JPEG ≤ maxKb when it can. */
async function compose(browser, spec, maxKb) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.goto('about:blank');
  const r = await page.evaluate(async ({ spec: S, maxKb: mk }) => {
    const load = async (s) => createImageBitmap(new Blob([Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0))], { type: 'image/png' }));
    const pad = 10;
    const labelW = S.labelW ?? 128;
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
        const rw = labelW + imgs.reduce((s, i) => s + i.width + 4, 0) + (row.gap ? 10 : 0);
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
      for (const rr of b.rows) {
        g.fillStyle = '#3b2a45';
        g.font = '700 12px system-ui, sans-serif';
        String(rr.row.label).split('\n').forEach((l, i) => g.fillText(l, pad, y + 18 + i * 15));
        let x = pad + labelW;
        rr.row.cells.forEach((c, i) => {
          if (rr.row.gap && i === rr.row.gap) x += 10;
          const im = rr.imgs[i];
          g.drawImage(im, x, y);
          if (b.sec.captions) {
            g.fillStyle = '#7a6585';
            g.font = '500 11px system-ui, sans-serif';
            g.fillText(c.caption || '', x + 2, y + im.height + 12);
          }
          x += im.width + 4;
        });
        y += rr.rh + 4;
      }
      y += pad;
    }
    let q = 0.9;
    let blob = null;
    for (; q >= 0.35; q -= 0.05) {
      blob = await cv.convertToBlob({ type: 'image/jpeg', quality: q });
      if (blob.size <= mk * 1024) break;
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { data: btoa(s), q: Math.round(q * 100) / 100, w: cv.width, h: cv.height };
  }, { spec, maxKb });
  await page.close();
  return r;
}

const cells = (shots, tag = '') => shots.map((s) => ({ b64: s.b64, caption: `${tag}${s.cap ? `${s.cap} ` : ''}${s.t.toFixed(2)} s` }));

async function main() {
  let server = null;
  let port = PORT;
  if (!port) {
    server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
    await server.listen();
    port = server.httpServer.address().port;
  }
  const { browser } = await launchChromium();
  try {
    let spec;
    if (BOARD === '1') {
      const sections = [];
      for (const quality of ['high', 'medium']) {
        const rows = [];
        for (const scene of PRESETS) {
          const s = await shoot(browser, port, { viewport: '844x390', scene, quality, crop: [300, 172] });
          rows.push({ label: `${NAMES[scene]}\n${quality}`, cells: cells(s) });
        }
        sections.push({ title: `${quality === 'high' ? 'High (bloom + grade)' : 'Medium (no bloom)'} · 844×390, 1:1 pixels · charge, fire, impact, sustain, end`, captions: true, rows });
      }
      spec = {
        title: 'Toon beams (B3): held beams, charge-up, impact crown and prism bands',
        subtitle: 'Lab patch (lake look, our own ground painter), real chibis and goblins for scale; hand-written shaders on the toon core. Lab only, not wired.',
        sections,
      };
    } else if (BOARD === '2') {
      const sections = [];
      // portrait (the board turned 90°)
      const prow = [];
      for (const scene of ['umeko', 'kohaku', 'raika']) {
        const s = await shoot(browser, port, { viewport: '390x844', scene, quality: 'high', crop: [190, 250], pick: ['charge', 'impact', 'sustain', 'end'] });
        prow.push({ label: `${NAMES[scene]}\nhigh 390×844`, cells: cells(s) });
      }
      sections.push({ title: 'Portrait 390×844 (board turned 90°), high, 1:1', captions: true, rows: prow });
      // Reduce Motion
      const rrow = [];
      for (const scene of PRESETS) {
        const s = await shoot(browser, port, { viewport: '844x390', scene, quality: 'high', rm: true, crop: [230, 140], pick: ['charge', 'sustain', 'end'] });
        rrow.push({ label: `${NAMES[scene]}\nReduce Motion`, cells: cells(s) });
      }
      sections.push({ title: 'Reduce Motion: a still beam (no flow, spin, racing head or punch), a still glow at the muzzle, no crown burst: a held glow', captions: true, rows: rrow });
      // close-ups
      const zrow = [];
      for (const [scene, quality, focus] of [['raika', 'high', 'crown'], ['luna', 'medium', 'crown'], ['kohaku', 'high', 'beam'], ['kohaku', 'medium', 'beam']]) {
        const s = await shoot(browser, port, { viewport: '844x390', scene, quality, zoom: 2.5, focus, crop: [250, 160], pick: ['fire', 'impact', 'sustain', 'end'] });
        zrow.push({ label: `${NAMES[scene].split('\n')[0]}\n${focus === 'crown' ? 'crown' : 'prism'} ${quality} 2.5×`, cells: cells(s) });
      }
      sections.push({ title: 'Close-ups (2.5× zoom): the impact crown and the prism bands', captions: true, rows: zrow });
      // beside the tornado (battle scale, high)
      const tor = await shoot(browser, port, { page: '/previews/tornado-stills.html', label: 'tornado vortex high', viewport: '844x390', preset: 'vortex', quality: 'high', crop: [300, 200], times: [0.7, 1.1], caps: ['tornado', 'tornado'] });
      const um = await shoot(browser, port, { viewport: '844x390', scene: 'umeko', quality: 'high', crop: [300, 200], pick: ['sustain'] });
      const ko = await shoot(browser, port, { viewport: '844x390', scene: 'kohaku', quality: 'high', crop: [300, 200], pick: ['sustain'] });
      sections.push({ title: 'Beside the house look: the tornado (vortex, high) and the beams at the same 1:1 scale', captions: true, rows: [
        { label: 'Tornado | beams', cells: [...cells(tor), ...cells(um, 'Umeko '), ...cells(ko, 'prism ')], gap: 2 },
      ] });
      // today's live beam (the current code) vs the new one
      const trow = [];
      for (const scene of PRESETS) {
        const old = await shoot(browser, port, { viewport: '844x390', scene, quality: 'high', old: true, crop: [230, 140], pick: ['impact', 'sustain'] });
        const now = await shoot(browser, port, { viewport: '844x390', scene, quality: 'high', crop: [230, 140], pick: ['impact', 'sustain'] });
        trow.push({ label: `${NAMES[scene]}\ntoday | new`, cells: [...cells(old, 'today '), ...cells(now, 'new ')], gap: 2 });
      }
      sections.push({ title: 'Today\'s live beam (held.js, s5held.js, kohaku_tsubaki.js, beams.js, drawn by the current code) beside the new one, high', captions: true, rows: trow });
      spec = {
        title: 'Toon beams (B3): portrait, Reduce Motion, close-ups, beside the tornado, today vs new',
        subtitle: 'An inked outer silhouette (none over her face), hard-stepped beats, flowing toon-core bands; the ink leaves before any erosion.',
        sections,
      };
    } else if (BOARD === 'ribbons') {
      // look C (light ribbons) beside look A and the tornado: every preset at 844×390 on high and medium (1:1), 390×844
      // high, 2.5× close-ups of the prism and the crown, and Reduce Motion
      const sections = [];
      const crop = [230, 140];
      const tor = await shoot(browser, port, { page: '/previews/tornado-stills.html', label: 'tornado vortex high', viewport: '844x390', preset: 'vortex', quality: 'high', crop, times: [0.7, 1.1], caps: ['tornado', 'tornado'] });
      for (const quality of ['high', 'medium']) {
        const rows = [];
        if (quality === 'high') rows.push({ label: 'Tornado\n(vortex, high)', cells: cells(tor) });
        for (const scene of PRESETS) {
          const a = await shoot(browser, port, { viewport: '844x390', scene, quality, crop, pick: ['sustain'] });
          const c = await shoot(browser, port, { viewport: '844x390', scene, quality, look: 'c', crop, pick: ['impact', 'sustain'] });
          rows.push({ label: `${NAMES[scene]}\n${quality}`, cells: [...cells(a, 'A '), ...cells(c, 'C ')], gap: 1 });
        }
        sections.push({ title: `844×390, ${quality === 'high' ? 'high (bloom + grade), the tornado at the same 1:1 scale on top' : 'medium (no bloom)'}: look A | look C (impact, sustain)`, captions: true, rows });
      }
      const prow = [];
      for (const scene of ['umeko', 'kohaku', 'raika']) {
        const s = await shoot(browser, port, { viewport: '390x844', scene, quality: 'high', look: 'c', crop: [170, 220], pick: ['sustain'] });
        prow.push(...cells(s, `${NAMES[scene].split('\n')[0].split(' ')[0]} `));
      }
      sections.push({ title: 'Portrait 390×844 (board turned 90°), high, look C, 1:1', captions: true, rows: [{ label: 'look C\nhigh 390×844', cells: prow }] });
      const zrows = [];
      for (const [scene, quality, focus] of [['kohaku', 'high', 'beam'], ['kohaku', 'medium', 'beam'], ['raika', 'high', 'crown'], ['luna', 'medium', 'crown']]) {
        const s = await shoot(browser, port, { viewport: '844x390', scene, quality, look: 'c', zoom: 2.5, focus, crop: [250, 160], pick: focus === 'crown' ? ['impact', 'sustain'] : ['sustain', 'end'] });
        zrows.push({ label: `${NAMES[scene].split('\n')[0]}\n${focus === 'crown' ? 'crown' : 'prism'} ${quality} 2.5×`, cells: cells(s, 'C ') });
      }
      sections.push({ title: 'Close-ups (2.5× zoom), look C: the prism\'s braided colour ribbons and the crown\'s curling tongues', captions: true, rows: zrows });
      const rcells = [];
      for (const scene of PRESETS) {
        const s = await shoot(browser, port, { viewport: '844x390', scene, quality: 'high', rm: true, look: 'c', crop: [160, 110], pick: ['sustain'] });
        rcells.push(...cells(s, `${scene} `));
      }
      sections.push({ title: 'Reduce Motion, look C, high: a still bundle (no flow, no spin), faded in; no halo, no crown burst', captions: true, rows: [{ label: 'Reduce Motion\nlook C, high', cells: rcells }] });
      spec = {
        title: 'Toon beams: look A beside look C (light ribbons) and the tornado',
        subtitle: 'C: 3–4 translucent ribbons twisting round a bright core (the prism: 5 colours braided), one rim under all, a faint ground halo. Lab only.',
        sections,
      };
    } else {
      const scene = opt('scene', 'luna');
      const quality = opt('quality', 'high');
      const zoom = Number(opt('zoom', '1'));
      const vp = opt('viewport', '844x390');
      const look = opt('look', null);
      const s = await shoot(browser, port, { viewport: vp, scene, quality, zoom, rm: args.includes('--rm'), old: args.includes('--old'), look, focus: opt('focus', 'beam'), crop: [300, 200] });
      spec = { title: `beams ${scene} ${quality} zoom ${zoom}${look ? ` look ${look}` : ''}`, sections: [{ captions: true, rows: [{ label: `${scene}\n${quality}`, cells: cells(s) }] }] };
    }
    const r = await compose(browser, spec, MAX_KB);
    writeFileSync(OUT, Buffer.from(r.data, 'base64'));
    console.log(`board ${BOARD} → ${OUT} (${r.w}×${r.h}, JPEG q ${r.q}, ${Math.round(Buffer.from(r.data, 'base64').length / 1024)} KB)`);
  } finally {
    await browser.close();
    await server?.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

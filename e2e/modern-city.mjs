// PROTOTYPE tooling for the modern-city look test (previews/modern-city.html).
//   node e2e/modern-city.mjs perf [stage ids…]   draw calls + triangles per frame, empty boards
//                                               (terrain + ambient only), high and medium quality:
//                                               the three proto maps vs every campaign stage
//   node e2e/modern-city.mjs shots <out dir>     battle-camera screenshots of each variant at
//                                               844x390 and 1280x720 + a gate close-up (.png)
// Starts its own Vite dev server; Playwright / Chromium as in e2e/browser.mjs.
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchChromium } from './browser.mjs';
import { CAMPAIGN_IDS, STAGE_MAP } from '../src/data/stages.js';

const [mode = 'perf', ...rest] = process.argv.slice(2);
const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const { browser } = await launchChromium();
const base = `http://127.0.0.1:${port}/previews/modern-city.html`;

async function open(query, viewport = { width: 1280, height: 720 }) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}?${query}`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__perf && window.__perf().calls > 0, null, { timeout: 90000 });
  return { page, errors };
}

try {
  if (mode === 'perf') {
    const proto = ['downtown', 'campus', 'surge'].map((m) => ({ label: `proto:${m}`, theme: m, q: `map=${m}` }));
    const ids = rest.length ? rest : CAMPAIGN_IDS;
    const real = ids.map((id) => ({ label: id, theme: STAGE_MAP[id]?.mapId || id, q: `stage=${id}` }));
    const rows = [];
    for (const quality of ['high', 'medium']) {
      for (const c of [...proto, ...real]) {
        const { page, errors } = await open(`${c.q}&quality=${quality}&empty=1&clean=1`);
        await page.waitForTimeout(1500);
        // sample a second of frames: the ambient layer (particles) varies a little frame to frame
        const s = await page.evaluate(async () => {
          const out = [];
          for (let i = 0; i < 20; i++) {
            await new Promise((r) => requestAnimationFrame(r));
            out.push(window.__perf());
          }
          return { calls: Math.max(...out.map((o) => o.calls)), tris: Math.max(...out.map((o) => o.triangles)), theme: window.__r.info.theme };
        });
        rows.push({ quality, ...c, ...s });
        console.log(`${quality.padEnd(6)} ${c.label.padEnd(16)} ${s.theme.padEnd(10)} calls ${String(s.calls).padStart(4)}  tris ${String(s.tris).padStart(8)}${errors.length ? `  ERR ${errors[0]}` : ''}`);
        await page.close();
      }
    }
    for (const quality of ['high', 'medium']) {
      const r = rows.filter((x) => x.quality === quality && !x.label.startsWith('proto:'));
      const byCalls = r.reduce((a, b) => (b.calls > a.calls ? b : a));
      const byTris = r.reduce((a, b) => (b.tris > a.tris ? b : a));
      console.log(`${quality}: busiest current stage by draw calls ${byCalls.label} (${byCalls.theme}) ${byCalls.calls}; by triangles ${byTris.label} (${byTris.theme}) ${byTris.tris}`);
    }
  } else if (mode === 'shots') {
    const out = rest[0] || 'shots';
    mkdirSync(out, { recursive: true });
    const sizes = [[844, 390], [1280, 720]];
    for (const v of ['downtown', 'campus', 'surge']) {
      for (const [w, h] of sizes) {
        const { page, errors } = await open(`map=${v}&clean=1&quality=high&t=12`, { width: w, height: h });
        await page.waitForTimeout(3500);
        const file = join(out, `${v}-${w}x${h}.png`);
        await page.screenshot({ path: file });
        console.log(`saved ${file}${errors.length ? `  ERR ${errors[0]}` : ''}`);
        await page.close();
      }
    }
    const { page } = await open('map=downtown&clean=1&quality=high&t=8&cam=gate&zoom=4', { width: 1280, height: 720 });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: join(out, 'gate-closeup-1280x720.png') });
    console.log(`saved ${join(out, 'gate-closeup-1280x720.png')}`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}

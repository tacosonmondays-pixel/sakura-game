// Renders each girl's in-game chibi as a sticker pose base (tools/stickers/README.md).
//   STICKER_OUT=/path/outside/repo node tools/stickers/render.mjs [id,id]
// Writes $STICKER_OUT/pose/<id>.png (1024 x 1024, transparent). Starts its own Vite dev server.
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchChromium } from '../../e2e/browser.mjs';

const OUT = process.env.STICKER_OUT;
if (!OUT) throw new Error('set STICKER_OUT to a folder outside the repo');
// girl → her pose: the clip (an AnimationMixer state), how far into it, and the turn
export const POSES = {
  hikari: { state: 'cheer', at: 0.55 },
  aoi: { state: 'cheer', at: 0.55 },
  kage: { state: 'cheer', at: 0.55 },
  momo: { state: 'cheer', at: 0.55 },
  akane: { state: 'cheer', at: 0.55 },
  yuki: { state: 'idle', at: 0.5 },
  miko: { state: 'idle', at: 0.5 },
  ena: { state: 'cheer', at: 0.55 },
  iroha: { state: 'idle', at: 0.5 },
  tenka: { state: 'cheer', at: 0.55 },
  chigusa: { state: 'cheer', at: 0.55 },
  hotaru: { state: 'idle', at: 0.5 },
};
const ids = process.argv[2] ? process.argv[2].split(',') : Object.keys(POSES);
mkdirSync(join(OUT, 'pose'), { recursive: true });
const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const { browser } = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(`http://127.0.0.1:${port}/tools/stickers/render.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.renderReady, null, { timeout: 60000 });
for (const id of ids) {
  const url = await page.evaluate(([i, o]) => window.renderGirl(i, o), [id, POSES[id] || {}]);
  writeFileSync(join(OUT, 'pose', `${id}.png`), Buffer.from(url.split(',')[1], 'base64'));
  console.log('rendered', id);
}
await browser.close();
await server.close();

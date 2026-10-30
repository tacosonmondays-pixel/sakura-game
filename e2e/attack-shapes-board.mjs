// The attack shapes owner board (docs/specs/ATTACK_SHAPES.md §7.1) as files for a phone:
// a one-column board image of previews/attack-shapes.html and a short video of all ten loops.
//   node e2e/attack-shapes-board.mjs <out dir> [--seconds 12] [--set s5]
// Writes <out>/<name>-board.png (one column, 2x; also -1.png / -2.png halves) and <out>/<name>-reel.mp4 (720 wide,
// 30 fps, frames stepped by the page's own 60 Hz sim clock so the video runs at real speed). <name> is attack-shapes,
// or attack-shapes-s5 with --set s5 (only the six S5 proposals, docs/specs/ATTACK_SHAPES_S5.md).
import { createServer } from 'vite';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const out = args[0] || 'attack-shapes-out';
const seconds = Number(args.includes('--seconds') ? args[args.indexOf('--seconds') + 1] : 12);
const set = args.includes('--set') ? args[args.indexOf('--set') + 1] : null;
const name = set ? `attack-shapes-${set}` : 'attack-shapes';
const q = set ? `&set=${set}` : '';
mkdirSync(out, { recursive: true });

const server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const { port } = server.httpServer.address();
const base = `http://127.0.0.1:${port}/previews/attack-shapes.html`;
const { browser } = await launchChromium();
const errors = [];
try {
  // 1. the board image: one column at phone width, 2x
  const page = await browser.newPage({ viewport: { width: 460, height: 900 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?shot=1&manual=1${q}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__boardReady);
  const full = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: 460, height: full });
  await page.evaluate(() => window.__pose());
  await page.screenshot({ path: join(out, `${name}-board.png`) });
  // the same board in two halves for phones that shrink very tall images (the full set: cards 1-5 and 6 on, as the S1-S4
  // board; a set: half the cards each)
  const cut = await page.evaluate((half) => { const c = document.querySelectorAll('.card'); return Math.round(c[half ? Math.ceil(c.length / 2) : 5].getBoundingClientRect().top - 7); }, !!set);
  await page.screenshot({ path: join(out, `${name}-board-1.png`), clip: { x: 0, y: 0, width: 460, height: cut } });
  await page.screenshot({ path: join(out, `${name}-board-2.png`), clip: { x: 0, y: cut, width: 460, height: full - cut } });
  await page.close();

  // 2. the reel: two columns of loops, frames at 30 fps
  const reel = await browser.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 });
  reel.on('pageerror', (e) => errors.push(e.message));
  await reel.goto(`${base}?reel=1&manual=1${q}`, { waitUntil: 'load' });
  await reel.waitForFunction(() => window.__boardReady);
  // the reel's height: down to the last card (an even number for the encoder)
  const h = await reel.evaluate(() => Math.ceil((document.querySelector('main').getBoundingClientRect().bottom + 8) / 2) * 2);
  await reel.setViewportSize({ width: 720, height: Math.min(1600, h) });
  const frames = join(out, 'frames');
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames);
  const n = seconds * 30;
  for (let i = 0; i < n; i++) {
    await reel.evaluate(() => window.__advance(2));
    await reel.screenshot({ path: join(frames, `f${String(i).padStart(4, '0')}.png`) });
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(frames, 'f%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-movflags', '+faststart', join(out, `${name}-reel.mp4`)]);
  rmSync(frames, { recursive: true, force: true });
  console.log(`saved ${join(out, `${name}-board.png`)} and ${join(out, `${name}-reel.mp4`)}`);
} finally {
  if (errors.length) {
    console.log(`page errors:\n${errors.join('\n')}`);
    process.exitCode = 1;
  }
  await browser.close();
  await server.close();
}

// The toon beams' dark-ink check (docs/VFX.md "Toon beams", batch B3; lab only): steps previews/beams.html at 1/60 s
// through every preset's whole loop (charge, fire, sustain, end, impact) and counts, in every frame, the loose dark-ink
// fragments: connected components (8-connected) of pixels the beams changed whose luma is under 0.2, smaller than
// 40 px and touching no colour pixel of the beams (an eroding piece must end in its colour bands, never as loose ink);
// and the interior ink: dark components that touch the beams' colour but no untouched background pixel (ink inside
// the colour, not on its true outer silhouette: a dot in a band, a dash at a seam; the screen's own edge counts as
// background). It also counts the beams' dark pixels over each girl's face (the top 42 % of her figure on screen).
// Target: 0, 0 and 0.
// The baseline (the board without the beams) is shot once the board is still (__lab.settle: the figures' textures
// decode after the page is ready; a baseline shot before that counts their own outlines as changed pixels).
//
//   node e2e/beams-ink.mjs --port 5192                       # a dev server already running there (else it starts one)
//   options: --scenes umeko,luna,kohaku,miko,raika --qualities high,medium --viewports 844x390,390x844 --json <file>
// Exit code 1 when any loose fragment, interior ink component or face pixel is found.
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
import { launchChromium } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] != null && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const list = (name, def) => opt(name, def).split(',').filter(Boolean);
const SCENES = list('scenes', 'umeko,luna,kohaku,miko,raika');
const QUALITIES = list('qualities', 'high,medium');
const VIEWPORTS = list('viewports', '844x390,390x844');
const PORT = Number(opt('port', '0'));
const JSON_OUT = opt('json', null);

async function main() {
  let server = null;
  let port = PORT;
  if (!port) {
    server = await createServer({ root: process.cwd(), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
    await server.listen();
    port = server.httpServer.address().port;
  }
  const { browser, label } = await launchChromium();
  console.log(`browser: ${label}; lab at http://127.0.0.1:${port}`);
  const rows = [];
  let bad = 0;
  try {
    for (const vp of VIEWPORTS) for (const quality of QUALITIES) for (const scene of SCENES) {
      const [w, h] = vp.split('x').map(Number);
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${port}/previews/beams.html?scene=${scene}&quality=${quality}&manual=1&clean=1`, { waitUntil: 'load', timeout: 180000 });
      await page.waitForFunction(() => window.__lab?.ready || window.__lab?.error, null, { timeout: 240000 });
      const err = await page.evaluate(() => window.__lab.error || null);
      if (err) throw new Error(`${scene} ${quality} ${vp}: ${err}`);
      // (the board without the beams must be still first: its figures' textures decode after the page is ready)
      const settle = await page.evaluate(() => window.__lab.settle());
      if (!settle.stable) console.log(`  (the board did not settle in ${settle.ms} ms)`);
      const r = await page.evaluate(() => window.__lab.inkScan(window.__lab.loop));
      const row = { scene, quality, viewport: vp, frames: r.frames, frags: r.frags, worst: r.worst, interior: r.interior, interiorFrames: r.interiorFrames, faceInkMax: r.faceInkMax, faceInkFrames: r.faceInkFrames, examples: r.examples.slice(0, 6), interiorExamples: r.interiorExamples.slice(0, 6), worldPeak: r.worldPeak, dimmed: r.dimmed };
      rows.push(row);
      const ok = r.frags === 0 && r.interior === 0 && r.faceInkMax === 0;
      if (!ok) bad++;
      const eg = (list) => list.slice(0, 3).map((e) => `t ${e.t} (${e.x}, ${e.y}) ${e.size} px`).join(', ');
      console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${scene.padEnd(6)} ${quality.padEnd(6)} ${vp}: ${r.frames} frames, ${r.frags} loose dark-ink fragments (worst frame ${r.worst}), ${r.interior} interior ink components (${r.interiorFrames} frames), face ink ${r.faceInkMax} px max (${r.faceInkFrames} frames); flash guard peak ${r.worldPeak.toFixed(3)} screens/s, dimmed ${r.dimmed}${r.examples.length ? `; loose e.g. ${eg(r.examples)}` : ''}${r.interiorExamples.length ? `; interior e.g. ${eg(r.interiorExamples)}` : ''}${errors.length ? `; page errors: ${errors.slice(0, 2).join(' | ')}` : ''}`);
      await page.close();
    }
  } finally {
    await browser.close();
    await server?.close();
  }
  const frags = rows.reduce((s, r) => s + r.frags, 0);
  const interior = rows.reduce((s, r) => s + r.interior, 0);
  const frames = rows.reduce((s, r) => s + r.frames, 0);
  console.log(`\n${frames} frames: ${frags} loose dark-ink fragments, ${interior} interior ink components, face ink in ${rows.filter((r) => r.faceInkMax > 0).length} of ${rows.length} runs`);
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(rows, null, 1));
  process.exitCode = bad ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Writes what the ribbon bake needs (tools/blender/ribbons/build_ribbons.py): every Honor Ribbon's class, effect,
// colourway and the class silhouette as polygons in the 64-unit art box (src/art/honors.js, the same paths the CSS
// effect masks use), and each emblem rasterised from the game's own SVG with the pre-installed Chromium.
//   node tools/blender/ribbons/dump_ribbons.mjs <out.json> <emblem dir> [--px 512]
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { HONOR_RIBBONS } from '../../../src/data/honors.js';
import { HONOR_ART, SILHOUETTES, EMBLEMS } from '../../../src/art/honors.js';
import { ACHIEVEMENTS } from '../../../src/data/achievements.js';

const [out, emblemDir] = process.argv.slice(2);
const px = Number(process.argv[process.argv.indexOf('--px') + 1]) || 512;
if (!out || !emblemDir) throw new Error('usage: dump_ribbons.mjs <out.json> <emblem dir>');

/** M/L/l/H/V/Z polylines (the silhouettes use nothing else) → [[x, y], …] per subpath. */
function polys(d) {
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g);
  const out = [];
  let cur = null, cmd = null, x = 0, y = 0, i = 0;
  const num = () => Number(toks[i++]);
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    if (cmd === 'Z' || cmd === 'z') { if (cur) out.push(cur); cur = null; continue; }
    if (cmd === 'M' || cmd === 'm') {
      const a = num(), b = num();
      x = cmd === 'm' ? x + a : a; y = cmd === 'm' ? y + b : b;
      cur = [[x, y]]; cmd = cmd === 'm' ? 'l' : 'L'; continue;
    }
    if (cmd === 'L') { x = num(); y = num(); } else if (cmd === 'l') { x += num(); y += num(); } else if (cmd === 'H') x = num();
    else if (cmd === 'h') x += num(); else if (cmd === 'V') y = num(); else if (cmd === 'v') y += num();
    else throw new Error(`path command ${cmd}`);
    cur.push([x, y]);
  }
  if (cur) out.push(cur);
  return out;
}

const DEFS = Object.fromEntries(ACHIEVEMENTS.filter((a) => a.honor).map((a) => [a.id, a.honor]));
const PAD = 2; // the emblem box is 24 units; rasterised with 2 units of room a side (a few emblems reach past it)
const rows = HONOR_RIBBONS.map((h) => ({ id: h.id, no: h.no, name: h.name, cls: h.class, fx: h.effect, emblem: h.emblem, c: HONOR_ART[h.id].c, aura: HONOR_ART[h.id].aura || null }));
const silhouettes = Object.fromEntries(Object.entries(SILHOUETTES).map(([k, s]) => [k, {
  tails: polys(s.tails), outer: polys(s.outer)[0], inner: s.inner ? polys(s.inner)[0] : null, disc: s.disc, aura: s.aura ? polys(s.aura)[0] : null,
}]));
mkdirSync(emblemDir, { recursive: true });

const { launchChromium } = await import('../../../e2e/browser.mjs');
const { browser } = await launchChromium();
const page = await browser.newPage({ viewport: { width: px, height: px } });
for (const r of rows) {
  const acc = r.c[6];
  const body = EMBLEMS[DEFS[r.id].emblem](acc);
  await page.setContent(`<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="${-PAD} ${-PAD} ${24 + 2 * PAD} ${24 + 2 * PAD}">${body}</svg></body></html>`);
  await page.screenshot({ path: join(emblemDir, `${r.id}.png`), omitBackground: true, clip: { x: 0, y: 0, width: px, height: px } });
}
await browser.close();
writeFileSync(resolve(out), JSON.stringify({ box: 64, cx: 32, cy: 27, emblemPad: PAD, silhouettes, rows }, null, 1));
console.log(`[ribbons] ${rows.length} ribbons, emblems in ${emblemDir}`);

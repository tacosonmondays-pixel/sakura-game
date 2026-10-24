// [ui-ink] Bakes the home's cooler night grade into "-home" copies of the lobby paintings (UI v2 "Ink & Paper",
// notes/ui-v2/UI_V2_DIRECTION.md 2.1 and 12.1; the build plan's V2 step 2). The home shows the baked copy; the kit's
// CSS filter is only the fallback for a painting that has none.
//
//   node tools/art/bakeHome.mjs                 # every lobby painting: public/art/lobby/<id>.webp -> <id>-home.webp
//   node tools/art/bakeHome.mjs <in> <out>      # one picture (Marumi's living plate: public/art/live/marumi/)
//
// The grade, in order (the approved mock-up's bake, notes/ui-v2/home/tools/bake-home.cjs, unchanged):
//   1. hue-selective desaturation: greens and yellows lose the most colour (they turned olive under a flat drop),
//      reds and oranges a little less, blues, violets and pinks the least (the sky, the sakura, the girls' palettes);
//      near-grey colours barely move
//   2. brightness x 0.80, contrast 0.96 about mid-grey
//   3. a 16 % ink (#0e1930) layer over everything
//   4. the cap: no channel above 199/255, so text over the scene keeps the contrast the kit's table measured
// The +8 % lift behind the host stays a CSS layer (.ui-scene > .lift): it follows her.
//
// Needs NODE_PATH = the bundled runtime's node_modules (@napi-rs/canvas), as the e2e scripts need it for Playwright.
import { createRequire } from 'node:module';
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { createCanvas, loadImage } = createRequire(import.meta.url)('@napi-rs/canvas');

/** Saturation kept per hue (degrees); linear between the stops, wrapping at 360. */
export const SAT = [[0, 0.62], [25, 0.6], [45, 0.46], [70, 0.4], [150, 0.4], [175, 0.55], [200, 0.74], [250, 0.78], [300, 0.78], [335, 0.74], [360, 0.62]];
export const INK = [14, 25, 48];
export const INK_A = 0.16;
export const BRIGHT = 0.8;
export const CONTRAST = 0.96;
export const CAP = 199;
/** The webp quality of the baked copies. */
export const QUALITY = 90;

const satAt = (h) => {
  for (let i = 1; i < SAT.length; i++) {
    const [h1, s1] = SAT[i];
    const [h0, s0] = SAT[i - 1];
    if (h <= h1) return s0 + (s1 - s0) * ((h - h0) / (h1 - h0));
  }
  return SAT[0][1];
};

/** Grades RGBA pixels in place; returns the brightest channel written. */
export function grade(d) {
  let maxOut = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const c = mx - mn;
    let h = 0;
    if (c > 0) {
      if (mx === r) h = 60 * (((g - b) / c) % 6);
      else if (mx === g) h = 60 * ((b - r) / c + 2);
      else h = 60 * ((r - g) / c + 4);
    }
    if (h < 0) h += 360;
    const chroma = c / 255;
    const s = satAt(h) * Math.min(1, chroma * 4) + 0.7 * (1 - Math.min(1, chroma * 4));
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const px = [r, g, b].map((v) => {
      let o = y + (v - y) * s;
      o *= BRIGHT;
      o = (o - 128) * CONTRAST + 128;
      return o * (1 - INK_A);
    });
    for (let k = 0; k < 3; k++) {
      const v = Math.max(0, Math.min(CAP, Math.round(px[k] + INK[k] * INK_A)));
      d[i + k] = v;
      if (v > maxOut) maxOut = v;
    }
  }
  return maxOut;
}

async function bake(inp, out) {
  const img = await loadImage(inp);
  const cv = createCanvas(img.width, img.height);
  const cx = cv.getContext('2d');
  cx.drawImage(img, 0, 0);
  const id = cx.getImageData(0, 0, img.width, img.height);
  const maxOut = grade(id.data);
  cx.putImageData(id, 0, 0);
  writeFileSync(out, await cv.encode('webp', QUALITY));
  console.log(`${out} ${img.width}x${img.height} max channel ${maxOut}`);
}

const [, , inp, out] = process.argv;
if (inp && out) await bake(inp, out);
else if (inp) {
  console.error('usage: node tools/art/bakeHome.mjs [<in> <out>]');
  process.exit(2);
} else {
  const dir = 'public/art/lobby';
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.webp') && !n.endsWith('-home.webp'))) {
    await bake(join(dir, f), join(dir, f.replace(/\.webp$/, '-home.webp')));
  }
}

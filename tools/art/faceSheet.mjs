// [ui-ink] Contact sheets of every girl's drawn portraits, for recording and checking her face anchors
// (src/ui/faceAnchors.js; notes UI v2 "Ink & Paper" build plan, V2 step 1). Never committed: it writes to the
// scratch folder (default D:/poop/SakuraSentinels/.tmp/faces).
//
//   node tools/art/faceSheet.mjs                       # every -cut and -card, a 5 % grid (the anchors are read off it)
//   node tools/art/faceSheet.mjs --kind cut --zoom      # the top half of every -cut at twice the size, a 2.5 % grid
//   node tools/art/faceSheet.mjs --overlay              # the recorded anchors drawn over every portrait (the review)
//   node tools/art/faceSheet.mjs --ids ruri,marumi --out D:/poop/SakuraSentinels/.tmp/faces-ruri
//   node tools/art/faceSheet.mjs --extents              # prints the measured art extents (EXTENTS in faceAnchors.js)
//
// The grid and the labels are fractions of the whole picture (0 at the top-left, 100 at the far edge), the unit the
// anchors are written in. --overlay draws, per portrait: the brow line (cyan), the eye line (yellow), the chin line
// (pink), the face centre (a cross) and the face box the home keeps clear of every control (the box between brow and
// chin, as wide as it is tall, around the centre). --extents measures where each -cut has paint (alpha over 24) in ten
// bands of 10 % of its height: the home places her so her art ends 8 px before the rail and the right stack.
//
// Needs NODE_PATH = the bundled runtime's node_modules (@napi-rs/canvas), as the e2e scripts need it for Playwright.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { UNITS } from '../../src/data/units.js';
import { FACE_ANCHORS } from '../../src/ui/faceAnchors.js';

const { createCanvas, loadImage } = createRequire(import.meta.url)('@napi-rs/canvas');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const flag = (n) => args.includes(`--${n}`);
const OUT = opt('out', 'D:/poop/SakuraSentinels/.tmp/faces');
const KINDS = (opt('kind', 'cut,card')).split(',');
const IDS = opt('ids', null)?.split(',') || UNITS.map((u) => u.id);
const ZOOM = flag('zoom');
const OVERLAY = flag('overlay');
const DIR = 'public/art/portraits';
const PER_ROW = Number(opt('cols', ZOOM ? 4 : 6));
// --crop x0,x1,y0,y1 (percent of the picture) and --grid step (percent): a close look at the face region
const CROP = opt('crop', null)?.split(',').map((v) => Number(v) / 100) || null;
const STEP = Number(opt('grid', 0)) || null;
const CELL = Number(opt('cell', 0)) || null;
// --bands n: how many bands --extents measures down each picture (20: 5 % each); --file f: one picture (any path)
const BANDS = Number(opt('bands', 20)) || 20;

/** Paint extents of a picture: [x0, x1] fractions per band (`n` bands down its height; null for an empty band). */
export function extentsOf(img, n = BANDS) {
  const cv = createCanvas(img.width, img.height);
  const cx = cv.getContext('2d');
  cx.drawImage(img, 0, 0);
  const { data } = cx.getImageData(0, 0, img.width, img.height);
  const bands = [];
  for (let b = 0; b < n; b++) {
    const y0 = Math.floor((b * img.height) / n);
    const y1 = Math.floor(((b + 1) * img.height) / n);
    let x0 = Infinity;
    let x1 = -Infinity;
    for (let y = y0; y < y1; y++) {
      const row = y * img.width * 4;
      for (let x = 0; x < img.width; x++) {
        if (data[row + x * 4 + 3] > 24) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
        }
      }
    }
    bands.push(x0 === Infinity ? null : [Math.round((x0 / img.width) * 1000) / 1000, Math.round(((x1 + 1) / img.width) * 1000) / 1000]);
  }
  return bands;
}

if (flag('extents')) {
  const out = {};
  if (opt('file', null)) {
    console.log(JSON.stringify(extentsOf(await loadImage(opt('file')))));
    process.exit(0);
  }
  for (const id of IDS) {
    const f = join(DIR, `${id}-cut.webp`);
    if (!existsSync(f)) continue;
    out[id] = extentsOf(await loadImage(f));
  }
  console.log(JSON.stringify(out));
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });

/** The grid in fractions of the whole picture; w = {x0, x1, y0, y1} is the window drawn into the cell. */
function grid(cx, x, y, w, h, step, win) {
  cx.save();
  cx.font = '10px sans-serif';
  const label = step < 2 ? 5 : 10;
  for (let p = 0; p <= 100.001; p += step) {
    const major = Math.abs(p % label) < 0.01 || Math.abs((p % label) - label) < 0.01;
    cx.strokeStyle = major ? 'rgba(220, 40, 60, 0.55)' : 'rgba(40, 90, 200, 0.28)';
    cx.lineWidth = major ? 1 : 0.6;
    const f = p / 100;
    if (f >= win.x0 - 1e-6 && f <= win.x1 + 1e-6) {
      const gx = x + ((f - win.x0) / (win.x1 - win.x0)) * w;
      cx.beginPath(); cx.moveTo(gx, y); cx.lineTo(gx, y + h); cx.stroke();
      if (major) { cx.fillStyle = 'rgba(200, 30, 50, 0.9)'; cx.fillText(String(Math.round(p)), gx + 2, y + 10); }
    }
    if (f >= win.y0 - 1e-6 && f <= win.y1 + 1e-6) {
      const gy = y + ((f - win.y0) / (win.y1 - win.y0)) * h;
      cx.beginPath(); cx.moveTo(x, gy); cx.lineTo(x + w, gy); cx.stroke();
      if (major) { cx.fillStyle = 'rgba(200, 30, 50, 0.9)'; cx.fillText(String(Math.round(p)), x + 2, gy - 2); }
    }
  }
  cx.restore();
}

function overlay(cx, x, y, w, h, a, win) {
  if (!a) return;
  const Y = (f) => y + ((f - win.y0) / (win.y1 - win.y0)) * h;
  const X = (f) => x + ((f - win.x0) / (win.x1 - win.x0)) * w;
  const line = (f, col) => { cx.strokeStyle = col; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(x, Y(f)); cx.lineTo(x + w, Y(f)); cx.stroke(); };
  line(a.brow, 'rgba(0, 200, 255, 0.95)');
  line(a.eye, 'rgba(255, 210, 0, 0.95)');
  line(a.chin, 'rgba(255, 60, 150, 0.95)');
  // the face box: brow to chin, as wide (in the picture's own px) as it is tall, around the centre
  const pxH = Y(a.chin) - Y(a.brow);
  cx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  cx.lineWidth = 1.5;
  cx.strokeRect(X(a.cx) - pxH / 2, Y(a.brow), pxH, pxH);
  cx.beginPath(); cx.moveTo(X(a.cx) - 8, Y(a.cy)); cx.lineTo(X(a.cx) + 8, Y(a.cy)); cx.moveTo(X(a.cx), Y(a.cy) - 8); cx.lineTo(X(a.cx), Y(a.cy) + 8); cx.stroke();
}

for (const kind of KINDS) {
  const items = [];
  for (const id of IDS) {
    const f = join(DIR, `${id}-${kind}.webp`);
    if (existsSync(f)) items.push({ id, img: await loadImage(f) });
  }
  const win = CROP ? { x0: CROP[0], x1: CROP[1], y0: CROP[2], y1: CROP[3] } : { x0: 0, x1: 1, y0: 0, y1: ZOOM ? 0.5 : 1 };
  const cellW = CELL || (kind === 'card' ? (ZOOM ? 360 : 200) : (ZOOM ? 420 : 240));
  const cellH = Math.max(...items.map(({ img }) => Math.round((cellW / (img.width * (win.x1 - win.x0))) * img.height * (win.y1 - win.y0))));
  const LH = 18;
  const cols = Math.min(PER_ROW, items.length);
  const rows = Math.ceil(items.length / cols);
  const cv = createCanvas(cols * (cellW + 12) + 12, rows * (cellH + LH + 12) + 12);
  const cx = cv.getContext('2d');
  cx.fillStyle = '#d9dee6';
  cx.fillRect(0, 0, cv.width, cv.height);
  items.forEach(({ id, img }, i) => {
    const x = 12 + (i % cols) * (cellW + 12);
    const y = 12 + Math.floor(i / cols) * (cellH + LH + 12);
    cx.fillStyle = '#1f2a44';
    cx.font = 'bold 13px sans-serif';
    const a = FACE_ANCHORS[id]?.[kind];
    cx.fillText(`${id} ${kind}${a ? `  cx ${a.cx} cy ${a.cy} brow ${a.brow} eye ${a.eye} chin ${a.chin}` : ''}`, x, y + 13);
    // the window at the picture's own aspect (a real portrait may differ from the nominal one: the cell follows it)
    const sx = img.width * win.x0;
    const sw = img.width * (win.x1 - win.x0);
    const sy = img.height * win.y0;
    const sh = img.height * (win.y1 - win.y0);
    const h = Math.round((cellW / sw) * sh);
    cx.fillStyle = '#fff';
    cx.fillRect(x, y + LH, cellW, h);
    cx.drawImage(img, sx, sy, sw, sh, x, y + LH, cellW, h);
    if (!flag('nogrid')) grid(cx, x, y + LH, cellW, h, STEP || (ZOOM ? 2.5 : 5), win);
    if (OVERLAY) overlay(cx, x, y + LH, cellW, h, a, win);
  });
  const file = join(OUT, `faces-${kind}${ZOOM ? '-zoom' : ''}${CROP ? '-crop' : ''}${OVERLAY ? '-overlay' : ''}.png`);
  writeFileSync(file, await cv.encode('png'));
  console.log(`${file} (${items.length} portraits)`);
}

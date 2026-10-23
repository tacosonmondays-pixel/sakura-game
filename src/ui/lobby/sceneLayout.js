// Layout math for a whole-scene lobby (src/data/lobbyScenes.js): where her picture is cropped, where her face lands,
// where the speech bubble goes and whether a tap hit her head. Pure functions (no DOM), unit-tested in
// tests/systems/lobbyScenes.test.js; src/ui/lobby/artStage.js feeds them the real sizes.
//
// Coordinates: px in the stage host (the lobby screen). The picture fills a frame that may overhang the host
// (the parallax frame is inset -2%): frame = { x, y, w, h } in host px. Obstacles are the menu boxes
// { l, t, r, b, bar? } in host px; a bar (bar: true, or wider than 60% of the screen: the top bar, the dock, an
// event's lantern string) only limits her face and the bubble vertically.

/** The crop the designed scenes were checked at (a 16:9 cover crop at 60% / 30%). */
export const PREFER_POS = [0.6, 0.3];
/** Her face core around the point between her eyes, in head radii: half-width, up, down (forehead to chin). */
const CORE = { half: 0.85, up: 0.6, down: 0.95 };
const MARGIN = 8;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** object-fit: cover of an iw × ih picture in an fw × fh box. ox / oy = the overflow (px) that the position crops. */
export function coverFit(fw, fh, iw, ih) {
  const s = Math.max(fw / iw, fh / ih);
  const dw = iw * s;
  const dh = ih * s;
  return { s, dw, dh, ox: Math.max(0, dw - fw), oy: Math.max(0, dh - fh) };
}

/** Splits the menu boxes into bars (full-width strips) and blocks; returns the free band between the top and bottom bars. */
export function splitObstacles(obstacles, W, H) {
  const bars = [];
  const blocks = [];
  for (const o of obstacles || []) {
    if (!o || !(o.r > o.l) || !(o.b > o.t)) continue;
    (o.bar || o.r - o.l > 0.6 * W ? bars : blocks).push(o);
  }
  let top = 0;
  let bottom = H;
  for (const b of bars) {
    if ((b.t + b.b) / 2 < H / 2) top = Math.max(top, b.b);
    else bottom = Math.min(bottom, b.t);
  }
  return { bars, blocks, top, bottom };
}

const overlapsY = (o, y0, y1) => o.b > y0 && o.t < y1;

/**
 * The free horizontal band for a box spanning y0..y1 around x: from the right edge of the blocks on its left to
 * the left edge of the blocks on its right (a block is "left" when its centre is left of the screen centre).
 */
export function freeBand(blocks, y0, y1, W) {
  let L = 0;
  let R = W;
  for (const o of blocks) {
    if (!overlapsY(o, y0, y1)) continue;
    if ((o.l + o.r) / 2 < W / 2) L = Math.max(L, o.r);
    else R = Math.min(R, o.l);
  }
  return { L, R };
}

/**
 * Crops her picture (object-fit: cover) so her face sits where the scene was designed to put it, moved only as far
 * as needed to keep her face clear of the side menus and below the top bar.
 * @param {{ W: number, H: number, frame: {x:number,y:number,w:number,h:number}, iw: number, ih: number, fx: number, fy: number,
 *   obstacles?: object[], prefer?: number[], headR?: number }} o
 * @returns {{ posX: number, posY: number, face: {x:number,y:number}, r: number, fit: object, clear: boolean }}
 *   posX / posY in % (object-position), face in host px, r = her head radius in px, clear = her face core misses every menu box
 */
export function anchorFace({ W, H, frame, iw, ih, fx, fy, obstacles = [], prefer = PREFER_POS, headR = 0.12 }) {
  const fit = coverFit(frame.w, frame.h, iw, ih);
  const r = headR * fit.dh;
  const { blocks, top } = splitObstacles(obstacles, W, H);
  const faceX = (p) => frame.x - fit.ox * p + fx * fit.dw;
  const faceY = (q) => frame.y - fit.oy * q + fy * fit.dh;
  // vertical: only when the picture overflows top/bottom (a screen wider than the scene); keep her face under the top bar
  let q = prefer[1];
  if (fit.oy > 0.5) {
    const want = Math.max(faceY(q), top + CORE.up * r + MARGIN);
    q = clamp((frame.y + fy * fit.dh - want) / fit.oy, 0, 1);
  }
  const y = faceY(q);
  // horizontal: the designed crop, then the nearest spot whose face core is clear of the side menus
  let p = prefer[0];
  if (fit.ox > 0.5) {
    const { L, R } = freeBand(blocks, y - CORE.up * r, y + CORE.down * r, W);
    const half = CORE.half * r + MARGIN;
    const lo = Math.max(L + half, half);
    const hi = Math.min(R - half, W - half);
    let x = faceX(p);
    x = lo <= hi ? clamp(x, lo, hi) : (Math.max(L, 0) + Math.min(R, W)) / 2;
    p = clamp((frame.x + fx * fit.dw - x) / fit.ox, 0, 1);
  }
  const face = { x: faceX(p), y };
  const core = { l: face.x - CORE.half * r, r: face.x + CORE.half * r, t: face.y - CORE.up * r, b: face.y + CORE.down * r };
  const clear = core.t >= top && blocks.every((o) => !(o.l < core.r && o.r > core.l && o.t < core.b && o.b > core.t));
  return { posX: p * 100, posY: q * 100, face, r, fit, clear };
}

/**
 * Where her speech bubble goes: beside her face (left first, as the scenes leave the left open, then right), clear of
 * the menus; a narrower bubble when the natural one does not fit; under her chin when neither side has room (a
 * portrait phone). It never covers her face core.
 * @param {{ face: {x:number,y:number}, r: number, W: number, H: number, obstacles?: object[],
 *   measure: (maxW: number|null) => {w:number,h:number}, minW?: number }} o
 *   measure(maxW) returns the bubble's size with that max width (null = its CSS max width)
 * @returns {{ side: 'left'|'right'|'below', x: number, y: number, w: number, h: number, maxW: number|null, tail: number }}
 *   x / y = top-left in host px; tail = px along the edge where the tail points at her face
 */
export function placeBubble({ face, r, W, H, obstacles = [], measure, minW = 150 }) {
  const { blocks, top, bottom } = splitObstacles(obstacles, W, H);
  const gap = CORE.half * r + 14;
  const yFor = (h) => clamp(face.y - 26, top + 6, Math.max(top + 6, bottom - 6 - h));
  const room = (side, h) => {
    const y = yFor(h);
    const { L, R } = freeBand(blocks, y, y + h, W);
    return side === 'left' ? face.x - gap - Math.max(L, 0) - 6 : Math.min(R, W) - (face.x + gap) - 6;
  };
  const place = (side, m, maxW) => {
    const y = yFor(m.h);
    const x = side === 'left' ? face.x - gap - m.w : face.x + gap;
    return { side, x, y, w: m.w, h: m.h, maxW, tail: clamp(face.y - y - 9, 10, Math.max(10, m.h - 28)) };
  };
  const nat = measure(null);
  for (const side of ['left', 'right']) if (room(side, nat.h) >= nat.w) return place(side, nat, null);
  // a narrower bubble on the roomier side
  const side = room('left', nat.h) >= room('right', nat.h) ? 'left' : 'right';
  const space = Math.floor(room(side, nat.h));
  if (space >= minW) {
    const m = measure(space);
    if (room(side, m.h) >= m.w) return place(side, m, space);
  }
  // under her chin, centred on her face and kept on screen (tail up at her chin)
  const maxW = Math.min(nat.w, Math.max(minW, W - 24));
  const m = maxW < nat.w ? measure(maxW) : nat;
  const x = clamp(face.x - m.w / 2, 12, Math.max(12, W - 12 - m.w));
  const y = Math.min(face.y + CORE.down * r + 14, Math.max(top + 6, bottom - 6 - m.h));
  return { side: 'below', x, y, w: m.w, h: m.h, maxW: maxW < nat.w ? maxW : null, tail: clamp(face.x - x, 16, Math.max(16, m.w - 16)) };
}

/**
 * Did a tap hit her head? Her head around the point between her eyes: ±1.1 radii across, 1.4 up (hair) and
 * 1.0 down (chin), so the lower face counts too.
 */
export function headHit(x, y, face, r) {
  const dx = x - face.x;
  const dy = y - face.y;
  return Math.abs(dx) <= 1.1 * r && dy >= -1.4 * r && dy <= 1.0 * r;
}

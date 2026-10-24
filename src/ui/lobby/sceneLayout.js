// Layout math for a full illustration in the lobby (src/data/lobbyIllustrations.js): where the picture is cropped,
// where her face lands and whether a tap hit her head (a full illustration has no speech bubble). Pure functions
// (no DOM), unit-tested in tests/systems/lobbyIllustrations.test.js; src/ui/lobby/artStage.js feeds them the real
// sizes.
//
// Coordinates: px in the stage host (the lobby screen). The picture fills a frame that may overhang the host
// (the parallax frame is inset -2%): frame = { x, y, w, h } in host px. Obstacles are the menu boxes
// { l, t, r, b, bar? } in host px; a bar (bar: true, or wider than 60% of the screen: the top bar, the dock, an
// event's lantern string) only limits her face vertically. An event's lantern string itself gives way to her head
// (hangString).

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
 * Crops her picture (object-fit: cover) so her face sits where the scene was designed to put it (on a portrait screen:
 * across the middle of the screen), moved only as far as needed to keep her face clear of the side menus and below
 * the top bar. The crop moves her face down only as far as the picture overflows top/bottom: on a screen with the
 * picture's own aspect it cannot move at all.
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
  // horizontal: the designed crop (her face across the middle on a portrait screen, where the picture is cropped
  // hard), then the nearest spot whose face core is clear of the side menus
  let p = prefer[0];
  if (fit.ox > 0.5) {
    const { L, R } = freeBand(blocks, y - CORE.up * r, y + CORE.down * r, W);
    const half = CORE.half * r + MARGIN;
    const lo = Math.max(L + half, half);
    const hi = Math.min(R - half, W - half);
    let x = H > W ? W / 2 : faceX(p);
    x = lo <= hi ? clamp(x, lo, hi) : (Math.max(L, 0) + Math.min(R, W)) / 2;
    p = clamp((frame.x + fx * fit.dw - x) / fit.ox, 0, 1);
  }
  const face = { x: faceX(p), y };
  const core = { l: face.x - CORE.half * r, r: face.x + CORE.half * r, t: face.y - CORE.up * r, b: face.y + CORE.down * r };
  const clear = core.t >= top && blocks.every((o) => !(o.l < core.r && o.r > core.l && o.t < core.b && o.b > core.t));
  return { posX: p * 100, posY: q * 100, face, r, fit, clear };
}

/** Her head with her hair and what sits on it (a cap, a hat, a halo) around her face point, in head radii: what decor
 *  hung over her scene keeps clear of. 2 across: a hat brim or a tilted halo reaches about that far (Chigusa's vine
 *  halo); 1.8 up: on the 3:4 art the face point is her face centre, about 0.3 radii under her eyes, and halos float
 *  above the hair. */
export const DECOR_HEAD = Object.freeze({ half: 2.0, up: 1.8, down: 1.0 });

/** Her head on her stand, as fractions of the stand picture's height: the stand is centred on her and its top is the
 *  top of her hair, so the point between her eyes sits about a tenth of the way down; r is sized so the DECOR_HEAD
 *  box covers her hair and what sits on it (a ribbon, a hair ornament). */
export const STAND_HEAD = Object.freeze({ y: 0.1, r: 0.07 });

/**
 * Her head on her stand (a Backdrop), from the stand picture's box in host px: the same { face, r } that a full
 * illustration's anchorFace gives, so decor hung over the lobby (hangString) keeps off her hair either way.
 * @param {{l:number,t:number,r:number,b:number}|null} box
 * @returns {{ face: {x:number,y:number}, r: number }|null}
 */
export function standHead(box) {
  const h = box ? box.b - box.t : 0;
  if (!(h > 0)) return null;
  return { face: { x: (box.l + box.r) / 2, y: box.t + STAND_HEAD.y * h }, r: STAND_HEAD.r * h };
}

/**
 * Where a decor string hung under the top bar (an event's lantern string) may hang over a full illustration or her
 * stand: never across her head, hair or halo (DECOR_HEAD). The cover crop can only move her face down on a screen wider than the picture,
 * so on most screens the string has to give way instead: it keeps its whole length when it misses her head, else the
 * longer stretch from one of its own ends up to the side of her head; null (hide it) when neither stretch is minW px.
 * @param {{l:number,t:number,r:number,b:number}} box the string's own box (host px)
 * @param {{x:number,y:number}} face her face point from anchorFace or standHead (host px)
 * @param {number} r her head radius (px)
 * @param {{ minW?: number }} [o]
 * @returns {{ l: number, r: number, full: boolean }|null} the stretch to draw, in host px
 */
export function hangString(box, face, r, { minW = 0 } = {}) {
  const head = {
    l: face.x - DECOR_HEAD.half * r - MARGIN,
    r: face.x + DECOR_HEAD.half * r + MARGIN,
    t: face.y - DECOR_HEAD.up * r,
    b: face.y + DECOR_HEAD.down * r,
  };
  if (!(box.l < head.r && box.r > head.l && box.t < head.b && box.b > head.t)) return { l: box.l, r: box.r, full: true };
  const left = { l: box.l, r: Math.min(box.r, head.l) };
  const right = { l: Math.max(box.l, head.r), r: box.r };
  const best = left.r - left.l >= right.r - right.l ? left : right;
  return best.r - best.l >= Math.max(1, minW) ? { ...best, full: false } : null;
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

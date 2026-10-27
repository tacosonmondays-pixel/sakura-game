// [ui-ink] Home layout C (the owner, Oct 27: "keep the new wallpaper concepts but change the layout"; Oct 24: "it just
// looks busy the homescreen is kinda packed now"). Pure: no DOM. src/ui/screens/lobby.js places its pieces by it, the
// host placement (src/ui/lobby/hostPlace.js) and the tests (tests/ui/homeLayout.test.js) read the same boxes.
//
// One block of controls on one side, the girl and the wallpaper on the other:
//   · a ticker strip under the top bar (the event, the objective, the weekly bosses or the notice board: one page at a
//     time, paged by "›" and every 6 s unless Reduce Motion is on)
//   · a mosaic of -8 degree ink tiles that leans as one shape (every tile's left edge on one slanted line): STUDENTS
//     (the latest girl to join, framed on her face), RECRUIT (the banner's three girls), CO-OP, COMMISSIONS, MALL and
//     BATTLE, the biggest tile, at the bottom of the block in thumb reach (its lower band opens the chapter)
//   · on her side: a vertical caption (her name; the screen's one decorative serial) and the corner tools
// The block takes the right side (she stands left, face at 0.30 of the width). A picture whose girl stands right of
// centre (every full illustration, Marumi's living scene) mirrors it: the block on the left, her face at 0.70.
// A small landscape phone (667 wide) keeps 3 rows and drops the Students face; a phone held upright stacks the block
// under her.

/** The run of an 8 degree slant per px of height (base.css --tan8). */
export const TAN8 = 0.1405;

/** The UI block's side for a picture whose girl's face is at `faceX` (a fraction of the picture's width). */
export function uiSideFor(faceX) {
  return Number.isFinite(faceX) && faceX > 0.5 ? 'l' : 'r';
}

/** Her face's spot across the screen (fraction of the width) for a block side, landscape. */
export const FACE_X = Object.freeze({ r: 0.3, l: 0.7 });

const rect = (x, y, w, h) => ({ x, y, w, h });

/**
 * The boxes of the home's pieces (px from the screen's top-left). Tiles carry `lean`: how far their drawn
 * parallelogram's top runs right of its bottom (their box is the parallelogram's mean: the shape is skewed about its
 * centre, so it pokes lean / 2 past the box at its top-right and bottom-left corners).
 * @param {number} W
 * @param {number} H
 * @param {{ side?: 'r'|'l' }} [o]
 * @returns {{ kind: 'wide'|'compact'|'tall', side: 'r'|'l', phone: boolean, ticker: object, tiles: Record<string, object>,
 *   caption: object|null, tools: object, block: object, face: { x: number } }}
 */
export function homeLayout(W, H, { side = 'r' } = {}) {
  if (W < H) return tallLayout(W, H);
  const phone = H <= 480;
  const compact = phone && W <= 700;
  const edge = phone ? 16 : 24;
  const gap = phone ? 6 : 8;
  const tickerY = phone ? 48 : 84;
  // (46 px, not 44, on a phone: a 44 px control whose neighbour starts on its last line measures 43.75 px of real tap
  // in the probe's scan; the home's +2 px rule)
  const tickerH = phone ? 46 : 56;
  const top = phone ? 100 : 148;
  const bottom = H - (phone ? 56 : 100);
  const rows = compact ? 3 : 4;
  const rowH = (bottom - top - gap * (rows - 1)) / rows;
  // (a 4:3 screen gives the block a little more of its width: the tiles keep their words at their sizes)
  const blockW = Math.round(W * (phone ? 0.46 : W / H < 1.5 ? 0.52 : 0.47));
  const left = side === 'l' ? edge : W - edge - blockW;
  const lean = (bottom - top) * TAN8;
  const rowW = blockW - lean;
  // (the columns' gap: wide enough that a tile's box, the mean of its parallelogram, never meets its neighbour's when
  // one spans two rows beside one that spans one)
  const colGap = Math.max(gap, Math.ceil(((rowH + gap) / 2) * TAN8) + 1);
  const c1 = Math.round(rowW * (compact ? 0.34 : 0.335));
  const c23 = rowW - c1 - colGap;
  // (the inner column, next to her, holds Students, Commissions and Mall; the outer one Recruit, Co-op and Battle)
  const colX = side === 'l' ? { c1: c23 + colGap, c23: 0 } : { c1: 0, c23: c1 + colGap };
  const rowY = (r) => top + r * (rowH + gap);
  /** A tile in column `col` over rows r0..r1 (and the part of the column from `from` to `to`, fractions). */
  const tile = (col, r0, r1, from = 0, to = 1) => {
    const y = rowY(r0);
    const h = rowY(r1) + rowH - y;
    const cw = col === 'c1' ? c1 : c23;
    const x0 = colX[col] + cw * from + (from > 0 ? gap / 2 : 0);
    const w = cw * (to - from) - (from > 0 ? gap / 2 : 0) - (to < 1 ? gap / 2 : 0);
    // its box centred on the block's slanted left line at its middle
    const x = left + (bottom - (y + h / 2)) * TAN8 + x0;
    return { ...rect(x, y, w, h), lean: h * TAN8 };
  };
  const tiles = compact
    ? {
      students: tile('c1', 0, 0),
      commissions: tile('c1', 1, 1),
      mall: tile('c1', 2, 2),
      recruit: tile('c23', 0, 0, 0, 0.5),
      coop: tile('c23', 0, 0, 0.5, 1),
      battle: tile('c23', 1, 2),
    }
    : {
      students: tile('c1', 0, 1),
      recruit: tile('c23', 0, 0),
      coop: tile('c23', 1, 1),
      commissions: tile('c1', 2, 2),
      mall: tile('c1', 3, 3),
      battle: tile('c23', 2, 3),
    };
  const capW = phone ? 14 : 18;
  const caption = rect(side === 'l' ? W - edge - capW : edge, phone ? 110 : 190, capW, Math.max(80, H - (phone ? 110 + 90 : 190 + 160)));
  // (two 44 px buttons with room between their hit squares)
  const tool = phone ? 44 : 48;
  const tools = rect(side === 'l' ? W - edge - 2 * tool : edge, H - edge - tool, 2 * tool, tool);
  return {
    kind: compact ? 'compact' : 'wide',
    side,
    phone,
    // (the ticker continues the block's slanted left line: its left edge over the top row's)
    ticker: rect(left + lean, tickerY, rowW, tickerH),
    tiles,
    caption,
    tools,
    block: rect(left, top, blockW, bottom - top),
    face: { x: W * FACE_X[side] },
    battleBand: phone ? 46 : 56,
  };
}

/**
 * A phone held upright (the rotate prompt's fallback): her above, the block stacked under her in thumb reach, and the
 * two tools stacked on the right edge under the top bar (out past a centred girl's hair and a full picture's face).
 */
function tallLayout(W, H) {
  const edge = 16;
  const gap = 6;
  const bw = W - 2 * edge;
  const battleH = 104;
  const rowH = 48;
  const battle = { ...rect(edge, H - edge - battleH, bw, battleH), lean: battleH * TAN8 };
  const r2 = battle.y - gap - rowH;
  const r1 = r2 - gap - rowH;
  const third = (bw - 2 * gap) / 3;
  const half = (bw - gap) / 2;
  const t = (x, y, w) => ({ ...rect(x, y, w, rowH), lean: rowH * TAN8 });
  const tiles = {
    students: t(edge, r1, third),
    recruit: t(edge + third + gap, r1, third),
    coop: t(edge + 2 * (third + gap), r1, third),
    commissions: t(edge, r2, half),
    mall: t(edge + half + gap, r2, half),
    battle,
  };
  const tickerH = 52;
  const ticker = rect(edge, r1 - gap - 4 - tickerH, bw, tickerH);
  return {
    kind: 'tall',
    side: 'r',
    phone: true,
    ticker,
    tiles,
    caption: null,
    tools: rect(W - edge - 44, 120, 44, 96),
    block: rect(edge, ticker.y, bw, H - edge - ticker.y),
    face: { x: W * 0.5 },
    battleBand: 46,
  };
}

/**
 * The boxes the girl keeps clear of on this layout (the ticker, every tile, the caption and the tools), as the screen
 * draws them. The top bar's boxes come from the page itself.
 * @param {ReturnType<typeof homeLayout>} L
 */
export function layoutBoxes(L) {
  const out = [L.ticker, ...Object.values(L.tiles).map(({ x, y, w, h, lean }) => rect(x - lean / 2, y, w + lean, h)), L.tools];
  if (L.caption) out.push(L.caption);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// the ticker's pages
// ---------------------------------------------------------------------------------------------------------------

/**
 * The ticker's pages, in order (at most three): the event (a running limited event or this week's double drops), the
 * objective (its play square; a saved battle goes first of all: pick up where you left off), then the weekly bosses
 * once Titan Trials or Total Assault is open, else the notice board's latest. An objective that only repeats the
 * event page (its last day, its exchange) is left out: the event page says it.
 * @param {{ news: { id: string }[], objective: { kind: string }|null, notice?: object|null }} s
 *   news: lobbyTray.js homeNews() pages; objective: homeObjective(); notice: the notice board's latest page
 * @returns {{ id: string }[]} the news pages as they are, the objective as { id: 'objective', ...objective }
 */
export function tickerPages({ news = [], objective = null, notice = null } = {}) {
  const event = news.find((n) => n.id === 'event' || n.id === 'weekly') || null;
  const bosses = news.find((n) => n.id === 'bosses') || null;
  const obj = objective && objective.kind !== 'event' ? { ...objective, id: 'objective' } : null;
  const out = [];
  if (obj?.kind === 'continue') out.push(obj);
  if (event) out.push(event);
  if (obj && obj.kind !== 'continue') out.push(obj);
  if (bosses) out.push(bosses);
  else if (notice) out.push({ ...notice, id: 'notice' });
  return out.slice(0, 3);
}

/** A boss page wears the hazard edge (P8: hazard means danger: a boss); every other page the cyan tick edge. */
export const tickerEdge = (page) => (page?.id === 'bosses' ? 'hazard' : 'tick');

// ---------------------------------------------------------------------------------------------------------------
// the Students tile's face
// ---------------------------------------------------------------------------------------------------------------

/**
 * The girl the Students tile shows: the one who joined last (her obtainedAt; on a tie the later one in the save),
 * never the secretary, only a girl with drawn art.
 * @param {{ units?: Record<string, { obtainedAt?: number }> }} profile
 * @param {string|null} secretary
 * @param {(id: string) => boolean} [hasArt]
 * @returns {string|null}
 */
export function latestRecruit(profile, secretary, hasArt = () => true) {
  let best = null;
  let bestAt = -Infinity;
  for (const [id, st] of Object.entries(profile?.units || {})) {
    if (id === secretary || !hasArt(id)) continue;
    const at = Number.isFinite(st?.obtainedAt) ? st.obtainedAt : 0;
    if (at >= bestAt) {
      best = id;
      bestAt = at;
    }
  }
  return best;
}

/**
 * Where her -card picture (300 x 500) goes inside a tile so her eye line sits at `eyeAt` of the tile's height, her
 * face centred across it and `faceH` px tall (brow to chin); never smaller than the tile (it always covers it).
 * @param {{ cx: number, brow: number, eye: number, chin: number }} anchor her -card anchor (src/ui/faceAnchors.js)
 * @param {number} tw the tile's width
 * @param {number} th the tile's height
 * @param {{ eyeAt?: number, faceH?: number, aspect?: number }} [o]
 * @returns {{ left: number, top: number, width: number, height: number, faceH: number }}
 */
export function cardCrop(anchor, tw, th, { eyeAt = 0.35, faceH = 40, aspect = 0.6 } = {}) {
  const fh = Math.max(0.02, anchor.chin - anchor.brow);
  let height = faceH / fh;
  height = Math.max(height, th, tw / aspect);
  const width = height * aspect;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const left = clamp(tw / 2 - anchor.cx * width, tw - width, 0);
  const top = clamp(eyeAt * th - anchor.eye * height, th - height, 0);
  return { left, top, width, height, faceH: fh * height };
}

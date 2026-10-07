// Lobby V3 room (owner: art / ui lobby). A bright, detailed club office by the sea, painted
// in three depth layers so the lobby can parallax them and the secretary can stand between
// them, like a Blue Archive home screen:
//
//   far  — what you see through the windows: sky, sun, clouds, sea, islands, a lighthouse
//   mid  — the room: ceiling lights, window wall (transparent panes), shelves full of boxes and
//          binders, cork board + clock, low cabinet, desk with monitors, office chair, rug,
//          glossy floor, sun shafts. Slightly soft so the 3D girl in front pops.
//   near — blurred foreground objects at the edges (desk corner with a mug, big leaves).
//
// All layers share one 1600×900 viewBox (cover-cropped: keep important content within
// y 80–820 so 19.5:9 phones still see it). Deterministic, original art.
import { n, linGrad, radGrad, seeded, blossom, sparklePath, petalPath } from './svgUtil.js';

export const ROOM_W = 1600;
export const ROOM_H = 900;
/** Eye level / vanishing point of the room (also the sea horizon). */
export const ROOM_VP = { x: 780, y: 430 };
/** Floor line of the back wall (the secretary stands in front of it). */
export const ROOM_FLOOR_Y = 630;

const BACK = { x0: 120, x1: 1480, y0: 96, y1: 630 };
const WIN = { x0: 584, x1: 1356, y0: 142, y1: 540, cols: 3, transom: 252 };

function svg(body, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ROOM_W} ${ROOM_H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${label}">${body}</svg>`;
}

/** Point on the line from the vanishing point through (x, y), at the given x. */
function towardX(x, y, atX) {
  const t = (atX - ROOM_VP.x) / (x - ROOM_VP.x);
  return ROOM_VP.y + (y - ROOM_VP.y) * t;
}
/** Point on the line from the vanishing point through (x, y), at the given y. */
function towardY(x, y, atY) {
  const t = (atY - ROOM_VP.y) / (y - ROOM_VP.y);
  return ROOM_VP.x + (x - ROOM_VP.x) * t;
}

function cloud(x, y, s, op = 1) {
  return `<g opacity="${op}"><g fill="#c9e3fb"><ellipse cx="${n(x + 6 * s)}" cy="${n(y + 8 * s)}" rx="${n(70 * s)}" ry="${n(20 * s)}"/></g>`
    + `<g fill="#ffffff"><ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(66 * s)}" ry="${n(22 * s)}"/><circle cx="${n(x - 30 * s)}" cy="${n(y - 12 * s)}" r="${n(25 * s)}"/><circle cx="${n(x + 4 * s)}" cy="${n(y - 26 * s)}" r="${n(34 * s)}"/><circle cx="${n(x + 40 * s)}" cy="${n(y - 10 * s)}" r="${n(24 * s)}"/><circle cx="${n(x + 26 * s)}" cy="${n(y - 34 * s)}" r="${n(18 * s)}"/></g>`
    + `<g fill="#e6f3ff" opacity=".9"><ellipse cx="${n(x + 10 * s)}" cy="${n(y + 6 * s)}" rx="${n(56 * s)}" ry="${n(10 * s)}"/></g></g>`;
}

// ---------------------------------------------------------------------------------------------
// FAR: outside the windows
// ---------------------------------------------------------------------------------------------

function farLayer() {
  const rnd = seeded('lobby-v3-far');
  const hz = ROOM_VP.y; // horizon
  let s = '<defs>'
    + linGrad('rf-sky', [[0, '#3f9cf5'], [0.45, '#7cc4ff'], [0.85, '#c9ebff'], [1, '#eaf8ff']])
    + linGrad('rf-sea', [[0, '#8fd8ff'], [0.25, '#46b2f0'], [1, '#1f7fd0']])
    + radGrad('rf-sun', [[0, '#ffffff', 1], [0.18, '#fffdf0', 0.95], [0.5, '#fff6d6', 0.35], [1, '#fff6d6', 0]])
    + linGrad('rf-island', [[0, '#7cc79a'], [1, '#4f9e78']])
    + linGrad('rf-haze', [[0, '#ffffff', 0], [1, '#ffffff', 0.6]])
    + '<filter id="rf-soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.4"/></filter>'
    + '<filter id="rf-cloud" x="-10%" y="-20%" width="120%" height="140%"><feGaussianBlur stdDeviation="1.4"/></filter>'
    + '</defs>';
  s += `<rect width="${ROOM_W}" height="${ROOM_H}" fill="url(#rf-sky)"/>`;
  s += '<circle cx="1210" cy="150" r="300" fill="url(#rf-sun)"/>';
  // big cumulus over the sea + thin high streaks
  s += `<g filter="url(#rf-cloud)">${cloud(720, 300, 2.1)}${cloud(1010, 250, 1.5, 0.95)}${cloud(470, 220, 1.3, 0.9)}${cloud(1290, 330, 1.2, 0.9)}${cloud(880, 380, 0.9, 0.85)}${cloud(600, 400, 0.7, 0.8)}</g>`;
  s += '<path d="M560 170q120-14 240-4M900 150q140-12 300 0M640 200q60-6 130-2" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity=".55" fill="none"/>';
  // distant coast with a little academy town on the left, island with lighthouse on the right
  s += '<g filter="url(#rf-soft)">';
  s += `<path d="M420 ${hz}Q470 ${hz - 60} 560 ${hz - 70}Q640 ${hz - 84} 720 ${hz - 50}Q790 ${hz - 26} 860 ${hz}Z" fill="#9fcdbb" opacity=".9"/>`;
  s += `<path d="M440 ${hz}Q520 ${hz - 34} 610 ${hz - 38}Q700 ${hz - 40} 800 ${hz}Z" fill="#86bfa6"/>`;
  for (let i = 0; i < 9; i++) {
    const x = 520 + i * 26 + rnd() * 8;
    const h = 14 + rnd() * 22;
    s += `<rect x="${n(x)}" y="${n(hz - 22 - h)}" width="${n(16 + rnd() * 8)}" height="${n(h + 22)}" fill="${i % 3 ? '#f4f8ff' : '#ffe6ee'}"/><rect x="${n(x)}" y="${n(hz - 26 - h)}" width="${n(18 + rnd() * 6)}" height="5" fill="${i % 2 ? '#7aa7d6' : '#e98aa8'}"/>`;
  }
  s += `<circle cx="560" cy="${hz - 36}" r="14" fill="#ffc4d6"/><circle cx="584" cy="${hz - 30}" r="11" fill="#ffd6e4"/><circle cx="732" cy="${hz - 30}" r="12" fill="#ffc4d6"/>`;
  s += `<path d="M1100 ${hz}Q1150 ${hz - 40} 1220 ${hz - 44}Q1290 ${hz - 40} 1330 ${hz}Z" fill="url(#rf-island)"/>`;
  s += `<rect x="1236" y="${hz - 100}" width="16" height="60" fill="#ffffff"/><rect x="1236" y="${hz - 86}" width="16" height="9" fill="#ff6b8a"/><rect x="1236" y="${hz - 62}" width="16" height="9" fill="#ff6b8a"/><path d="M1232 ${hz - 100}h24l-4-12h-16z" fill="#3b5f9a"/><circle cx="1244" cy="${hz - 106}" r="5" fill="#fff6c4"/>`;
  s += `<path d="M1380 ${hz}Q1430 ${hz - 18} 1500 ${hz - 16}Q1560 ${hz - 12} 1600 ${hz}Z" fill="#9fcdbb" opacity=".8"/>`;
  s += '</g>';
  // sea with glints and boats
  s += `<rect y="${hz}" width="${ROOM_W}" height="${ROOM_H - hz}" fill="url(#rf-sea)"/>`;
  s += `<rect y="${hz}" width="${ROOM_W}" height="14" fill="#ffffff" opacity=".35"/>`;
  let glints = '';
  for (let i = 0; i < 80; i++) {
    const x = 500 + rnd() * 980;
    const y = hz + 8 + Math.pow(rnd(), 1.4) * 130;
    glints += `M${n(x)} ${n(y)}h${n(6 + rnd() * 28 * (1 + (y - hz) / 80))}`;
  }
  s += `<path d="${glints}" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" opacity=".6"/>`;
  s += '<path d="M1150 455q60-6 140 0" stroke="#fffbe0" stroke-width="5" stroke-linecap="round" opacity=".8"/>';
  for (const [x, y, sc] of [[980, hz + 18, 1], [700, hz + 10, 0.6], [1180, hz + 44, 0.8]]) {
    s += `<g transform="translate(${x} ${y}) scale(${sc})"><path d="M0 0l16-48 9 48z" fill="#ffffff"/><path d="M-4 0l-2-30 12 30z" fill="#ffe0ec"/><path d="M-14 2h46l-8 9h-32z" fill="#4b6fb0"/></g>`;
  }
  // gulls
  for (const [x, y, sc] of [[860, 230, 1], [900, 214, 0.8], [1120, 200, 0.7]]) s += `<path d="M${x} ${y}q${n(8 * sc)} ${n(-8 * sc)} ${n(16 * sc)} 0q${n(8 * sc)} ${n(-8 * sc)} ${n(16 * sc)} 0" stroke="#5b7fae" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  s += `<rect y="${hz - 60}" width="${ROOM_W}" height="70" fill="url(#rf-haze)" opacity=".6"/>`;
  return svg(s, 'Sea view');
}

// ---------------------------------------------------------------------------------------------
// MID: the room
// ---------------------------------------------------------------------------------------------

/** Cardboard box (front face + optional top), tape and a label. */
function box(x, y, w, h, { top = 0, tone = 0, label = true, rot = 0 } = {}) {
  const base = ['#e9b97c', '#dfae70', '#f0c78f'][tone % 3];
  const dark = ['#c48d4e', '#b98147', '#cf9c5c'][tone % 3];
  let s = `<g${rot ? ` transform="rotate(${rot} ${n(x + w / 2)} ${n(y + h)})"` : ''}>`;
  if (top) s += `<path d="M${n(x)} ${n(y)}l${n(top * 0.5)} ${n(-top)}h${n(w)}l${n(-top * 0.5)} ${n(top)}z" fill="#f7d9a8" stroke="${dark}" stroke-width="1.5"/><path d="M${n(x + w * 0.5 - 6)} ${n(y)}l${n(top * 0.5)} ${n(-top)}h12l${n(-top * 0.5)} ${n(top)}z" fill="#d7b07a"/>`;
  s += `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${base}" stroke="${dark}" stroke-width="2"/>`;
  s += `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(Math.min(14, h * 0.16))}" fill="#ffffff" opacity=".18"/>`;
  s += `<rect x="${n(x + w * 0.5 - 6)}" y="${n(y)}" width="12" height="${n(h * 0.42)}" fill="#d7b07a" opacity=".9"/>`;
  s += `<rect x="${n(x + w - 10)}" y="${n(y)}" width="10" height="${n(h)}" fill="${dark}" opacity=".35"/>`;
  if (label && w > 50) s += `<rect x="${n(x + w * 0.14)}" y="${n(y + h * 0.55)}" width="${n(w * 0.3)}" height="${n(Math.max(10, h * 0.2))}" fill="#ffffff" opacity=".85"/><path d="M${n(x + w * 0.17)} ${n(y + h * 0.62)}h${n(w * 0.22)}" stroke="#8aa0c0" stroke-width="2"/>`;
  return `${s}</g>`;
}

/** Row of binders / books standing on a shelf (bottom at y). */
function binders(x, y, count, rnd, { maxH = 92, lean = false } = {}) {
  const cols = ['#5b8def', '#ff7aa8', '#ffd166', '#7bd3a8', '#a58cff', '#4cc9f0', '#ff9f5a', '#f4f6fb'];
  let s = '';
  let cx = x;
  for (let i = 0; i < count; i++) {
    const w = 15 + rnd() * 9;
    const h = maxH * (0.72 + rnd() * 0.28);
    const c = cols[Math.floor(rnd() * cols.length)];
    const tilt = lean && i === count - 1 ? 14 : 0;
    s += `<g${tilt ? ` transform="rotate(${tilt} ${n(cx)} ${n(y)})"` : ''}><rect x="${n(cx)}" y="${n(y - h)}" width="${n(w)}" height="${n(h)}" rx="2" fill="${c}" stroke="#3b4d6e" stroke-opacity=".35" stroke-width="1.5"/>`
      + `<rect x="${n(cx + 3)}" y="${n(y - h * 0.72)}" width="${n(w - 6)}" height="${n(h * 0.16)}" rx="1.5" fill="#ffffff" opacity=".8"/>`
      + `<circle cx="${n(cx + w / 2)}" cy="${n(y - h * 0.24)}" r="${n(w * 0.2)}" fill="#ffffff" opacity=".55"/>`
      + `<rect x="${n(cx)}" y="${n(y - h)}" width="3" height="${n(h)}" fill="#ffffff" opacity=".3"/></g>`;
    cx += w + 1.5;
  }
  return s;
}

function plantPot(x, y, s = 1, kind = 'leafy') {
  let g = `<g transform="translate(${n(x)} ${n(y)}) scale(${n(s)})">`;
  if (kind === 'leafy') {
    g += '<path d="M0 0q-30-50-8-96M0 0q24-46 6-100M0 0q-44-24-54-58M0 0q40-20 52-62M0 0q4-60 24-82" stroke="#3d9a63" stroke-width="5" fill="none" stroke-linecap="round"/>';
    for (const [lx, ly, r, c] of [[-10, -96, 16, '#5cbf82'], [8, -100, 15, '#6fcf93'], [-52, -60, 15, '#4fae74'], [52, -62, 15, '#5cbf82'], [24, -82, 13, '#86dba5'], [-26, -48, 12, '#6fcf93'], [30, -40, 12, '#4fae74']]) {
      g += `<ellipse cx="${lx}" cy="${ly}" rx="${r}" ry="${n(r * 0.55)}" transform="rotate(${lx > 0 ? -35 : 35} ${lx} ${ly})" fill="${c}"/><path d="M${lx - r * 0.7} ${ly}h${n(r * 1.4)}" stroke="#ffffff" stroke-width="1.5" opacity=".35" transform="rotate(${lx > 0 ? -35 : 35} ${lx} ${ly})"/>`;
    }
  } else if (kind === 'cactus') {
    g += '<path d="M-8 0v-46q0-10 8-10t8 10V0z" fill="#5cbf82" stroke="#2f7a50" stroke-width="2"/><path d="M8-26h8q6 0 6-6v-10" stroke="#5cbf82" stroke-width="9" fill="none" stroke-linecap="round"/><circle cx="0" cy="-58" r="5" fill="#ff7aa8"/>';
  } else if (kind === 'sakura') {
    g += '<path d="M0 0q-4-30 6-52M2-30q14-10 26-14M4-44q-16-8-26-4" stroke="#7a4b3a" stroke-width="5" fill="none" stroke-linecap="round"/>';
    for (const [bx, by, r] of [[6, -62, 18], [26, -50, 14], [-22, -52, 14], [-6, -48, 12], [16, -70, 12]]) g += `<circle cx="${bx}" cy="${by}" r="${r}" fill="#ffc4d6"/><circle cx="${bx - r * 0.3}" cy="${by - r * 0.3}" r="${n(r * 0.5)}" fill="#ffe0ec"/>`;
  }
  g += '<path d="M-22 0h44l-6 34h-32z" fill="#f4f7fb" stroke="#a9b8cc" stroke-width="2"/><path d="M-24-4h48v8h-48z" fill="#ffffff" stroke="#a9b8cc" stroke-width="2"/><path d="M-16 8l2 22" stroke="#ffffff" stroke-width="4" opacity=".7"/>';
  return `${g}</g>`;
}

function midLayer() {
  const rnd = seeded('lobby-v3-mid');
  const { x0, x1, y0, y1 } = BACK;
  const W = ROOM_W;
  const H = ROOM_H;
  let defs = '<defs>'
    + linGrad('rm-wall', [[0, '#fbfdff'], [0.7, '#eef3f9'], [1, '#e2eaf4']])
    + linGrad('rm-side-l', [[0, '#e3ebf5'], [1, '#cfdbe8']], { x2: 1, y2: 0 })
    + linGrad('rm-side-r', [[0, '#cfdbe8'], [1, '#e7eef6']], { x2: 1, y2: 0 })
    + linGrad('rm-ceil', [[0, '#e4ecf6'], [1, '#f6f9fd']])
    + linGrad('rm-floor', [[0, '#e7eef7'], [0.45, '#d9e3ef'], [1, '#c3d1e2']])
    + linGrad('rm-wood', [[0, '#f3dcb8'], [1, '#d9b58a']])
    + linGrad('rm-wood-dark', [[0, '#d9b58a'], [1, '#b98d5e']])
    + linGrad('rm-metal', [[0, '#e6edf6'], [1, '#c3cfdf']])
    + linGrad('rm-shelf-back', [[0, '#c3d0e0'], [1, '#d6e0ec']])
    + linGrad('rm-beam', [[0, '#ffffff', 0.9], [0.5, '#ffffff', 0.35], [1, '#ffffff', 0]])
    + linGrad('rm-light', [[0, '#ffffff'], [1, '#eaf4ff']])
    + linGrad('rm-monitor', [[0, '#9ad3ff'], [1, '#5aa0e8']])
    + linGrad('rm-chair', [[0, '#6d93d8'], [1, '#3a5c9e']])
    + linGrad('rm-rug', [[0, '#d5e9ff'], [1, '#b9d8f7']])
    + linGrad('rm-reflect', [[0, '#ffffff', 0.55], [1, '#ffffff', 0]])
    + linGrad('rm-blind', [[0, '#fbf6ec'], [1, '#e9dfcc']])
    + radGrad('rm-glow', [[0, '#ffffff', 0.85], [1, '#ffffff', 0]])
    + radGrad('rm-vig', [[0, '#ffffff', 0], [0.62, '#ffffff', 0], [1, '#3a5584', 0.22]], { r: 0.75 })
    + radGrad('rm-shadow', [[0, '#5a6f94', 0.35], [1, '#5a6f94', 0]])
    + '<filter id="rm-soft" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="0.9"/></filter>'
    + '<filter id="rm-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16"/></filter>'
    + '<filter id="rm-blur-s" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>'
    + '</defs>';
  let s = '';

  // ---- shell: ceiling, side walls, back wall with window holes, floor ----
  const lTop = towardX(x0, y0, 0);
  const lBot = towardX(x0, y1, 0);
  const rTop = towardX(x1, y0, W);
  const rBot = towardX(x1, y1, W);
  s += `<path d="M0 0H${W}V${n(rTop)}L${x1} ${y0}H${x0}L0 ${n(lTop)}Z" fill="url(#rm-ceil)"/>`;
  // ceiling light panels (perspective trapezoids) + seams
  for (const [a, b] of [[0.18, 0.34], [0.43, 0.57], [0.66, 0.82]]) {
    const ax = x0 + (x1 - x0) * a;
    const bx = x0 + (x1 - x0) * b;
    const yA = 22;
    s += `<path d="M${n(towardY(ax, y0, yA))} ${yA}L${n(towardY(bx, y0, yA))} ${yA}L${n(bx - 6)} ${y0 - 26}L${n(ax + 6)} ${y0 - 26}Z" fill="url(#rm-light)" stroke="#d3e0ee" stroke-width="3"/>`;
  }
  let seams = '';
  for (let i = 1; i < 8; i++) {
    const x = x0 + ((x1 - x0) * i) / 8;
    seams += `M${n(x)} ${y0}L${n(towardY(x, y0, 0))} 0`;
  }
  s += `<path d="${seams}" stroke="#d5dfeb" stroke-width="2" opacity=".8"/>`;
  s += `<path d="M0 ${n(lTop)}L${x0} ${y0}H${x1}L${W} ${n(rTop)}" stroke="#c9d6e6" stroke-width="4" fill="none"/>`;
  // side walls
  s += `<path d="M0 ${n(lTop)}L${x0} ${y0}V${y1}L0 ${n(lBot)}Z" fill="url(#rm-side-l)"/>`;
  s += `<path d="M${W} ${n(rTop)}L${x1} ${y0}V${y1}L${W} ${n(rBot)}Z" fill="url(#rm-side-r)"/>`;
  // back wall (window panes cut out)
  let holes = '';
  const paneW = (WIN.x1 - WIN.x0) / WIN.cols;
  for (let c = 0; c < WIN.cols; c++) holes += `M${n(WIN.x0 + c * paneW)} ${WIN.y0}h${n(paneW)}v${WIN.y1 - WIN.y0}h${n(-paneW)}z`;
  s += `<path d="M${x0} ${y0}H${x1}V${y1}H${x0}Z${holes}" fill="url(#rm-wall)" fill-rule="evenodd"/>`;
  // bulkhead beam at the top of the back wall
  s += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="22" fill="#ffffff"/><rect x="${x0}" y="${y0 + 22}" width="${x1 - x0}" height="6" fill="#d6e1ee"/>`;
  // wainscot + skirting
  s += `<rect x="${x0}" y="${y1 - 18}" width="${x1 - x0}" height="18" fill="#d3deeb"/><rect x="${x0}" y="${y1 - 20}" width="${x1 - x0}" height="4" fill="#ffffff"/>`;
  // floor
  s += `<path d="M0 ${n(lBot)}L${x0} ${y1}H${x1}L${W} ${n(rBot)}V${H}H0Z" fill="url(#rm-floor)"/>`;
  let tiles = '';
  for (let i = -6; i <= 18; i++) {
    const x = x0 + ((x1 - x0) * i) / 12;
    tiles += `M${n(x)} ${y1}L${n(towardY(x, y1, H))} ${H}`;
  }
  for (const y of [652, 682, 724, 782, 862]) tiles += `M0 ${y}H${W}`;
  s += `<path d="${tiles}" stroke="#b6c6d9" stroke-width="2" opacity=".55" fill="none"/>`;
  // window reflections on the glossy floor
  for (let c = 0; c < WIN.cols; c++) {
    const a = WIN.x0 + c * paneW + 16;
    const b = a + paneW - 32;
    s += `<path d="M${n(a)} ${y1 + 4}H${n(b)}L${n(towardY(b, y1, 760))} 760H${n(towardY(a, y1, 760))}Z" fill="url(#rm-reflect)" opacity=".7"/>`;
  }

  // ---- left side wall: poster + fire extinguisher ----
  s += `<path d="M28 ${n(towardX(x0, 200, 28))}L96 ${n(towardX(x0, 212, 96))}L96 ${n(towardX(x0, 380, 96))}L28 ${n(towardX(x0, 392, 28))}Z" fill="#ffe0ec" stroke="#ffffff" stroke-width="5"/>`;
  s += `${blossom(62, 280, 22, '#ff9cc0', '#ffd34d')}<path d="M40 330l44 6M40 346l36 5" stroke="#d95b8a" stroke-width="5" stroke-linecap="round"/>`;
  s += '<rect x="62" y="548" width="26" height="62" rx="12" fill="#e5484d" stroke="#a5262c" stroke-width="2"/><rect x="66" y="540" width="16" height="12" rx="3" fill="#3b3b4f"/><path d="M82 546q14 4 10 26" stroke="#3b3b4f" stroke-width="4" fill="none"/><rect x="66" y="566" width="18" height="16" rx="2" fill="#ffffff" opacity=".85"/>';

  const dTop0 = 650;
  // ---- shelving unit (left of the windows) ----
  const sx0 = 150;
  const sx1 = 528;
  const sTop = 156;
  const boards = [sTop, 274, 392, 510, y1];
  const mid = (sx0 + sx1) / 2;
  s += `<rect x="${sx0}" y="${sTop}" width="${sx1 - sx0}" height="${y1 - sTop}" fill="url(#rm-shelf-back)"/>`;
  // contents per compartment (drawn before the frame so the boards overlap them)
  const L = sx0 + 14;
  const R = mid + 10;
  s += box(L + 4, 196, 92, 74, { tone: 0 }) + box(L + 102, 214, 64, 56, { tone: 2, label: false });
  s += binders(R, 270, 7, rnd, { maxH: 96, lean: true }) + `<g transform="translate(${n(R + 150)} 270)"><path d="M-10 0h20l-3-10h-14z" fill="#e0a600"/><rect x="-3" y="-22" width="6" height="12" fill="#ffd34d"/><path d="M-14-46h28q0 24-14 24t-14-24z" fill="#ffd34d" stroke="#c98a00" stroke-width="2"/><path d="M-8-42q2 10 6 14" stroke="#fff" stroke-width="3" opacity=".7" fill="none"/></g>`;
  s += binders(L, 388, 5, rnd, { maxH: 90 }) + `<g transform="translate(${n(L + 132)} 388)"><rect x="-26" y="-16" width="52" height="16" rx="2" fill="#5b8def"/><rect x="-22" y="-30" width="46" height="14" rx="2" fill="#ffd166"/><rect x="-24" y="-44" width="44" height="14" rx="2" fill="#7bd3a8"/></g>`;
  s += box(R, 316, 90, 72, { tone: 1 }) + `<g transform="translate(${n(R + 128)} 388)"><path d="M-14 0h28l-4-8h-20z" fill="#7f93b0"/><path d="M0-8v-10" stroke="#7f93b0" stroke-width="4"/><circle cy="-44" r="26" fill="#6ec3f5" stroke="#3a7cc4" stroke-width="2"/><path d="M-20-56q14 6 10 20t14 18M8-66q-4 14 12 18" stroke="#7bd3a8" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M-30-44a30 30 0 0 1 30-30" stroke="#c9a46a" stroke-width="3" fill="none"/></g>`;
  for (const bx of [L + 4, L + 88]) s += `<g transform="translate(${n(bx)} 506)"><path d="M0 0h76l-6-62H6z" fill="#7ab8f5" stroke="#3f7fc4" stroke-width="2"/><path d="M4-56h68" stroke="#ffffff" stroke-width="4" opacity=".55"/><rect x="24" y="-40" width="28" height="14" rx="4" fill="#ffffff" opacity=".85"/></g>`;
  s += binders(R, 506, 4, rnd, { maxH: 84 }) + `<g transform="translate(${n(R + 102)} 506)"><rect x="0" y="-64" width="50" height="64" rx="3" fill="#ffffff" stroke="#c9b48a" stroke-width="4"/><rect x="6" y="-58" width="38" height="44" fill="#bfe2ff"/><circle cx="25" cy="-40" r="10" fill="#ffd166"/><path d="M6-14l14-18 10 10 8-8 6 16z" fill="#7bd3a8"/></g>` + plantPot(R + 170, 506, 0.5, 'cactus');
  s += box(L, 554, 120, 76, { tone: 2 }) + box(R, 572, 70, 58, { tone: 0, label: false }) + box(R + 76, 560, 84, 70, { tone: 1 });
  // shelf frame + boards
  s += `<rect x="${sx0 - 8}" y="${sTop - 10}" width="12" height="${y1 - sTop + 10}" fill="url(#rm-metal)" stroke="#9fb0c8" stroke-width="2"/><rect x="${sx1 - 4}" y="${sTop - 10}" width="12" height="${y1 - sTop + 10}" fill="url(#rm-metal)" stroke="#9fb0c8" stroke-width="2"/><rect x="${mid - 5}" y="${sTop}" width="10" height="${y1 - sTop}" fill="url(#rm-metal)" stroke="#9fb0c8" stroke-width="1.5"/>`;
  for (const by of boards) s += `<rect x="${sx0 - 8}" y="${by - 8}" width="${sx1 - sx0 + 16}" height="12" fill="#eef3f9" stroke="#9fb0c8" stroke-width="2"/><rect x="${sx0}" y="${by + 4}" width="${sx1 - sx0}" height="7" fill="#9fb0c8" opacity=".45"/>`;
  // boxes stacked on top of the shelf
  s += box(sx0 + 6, 82, 118, 66, { tone: 1, label: true }) + box(sx0 + 22, 40, 86, 42, { tone: 2, label: false }) + box(sx0 + 136, 96, 92, 52, { tone: 0 }) + `<rect x="${sx0 + 250}" y="74" width="24" height="74" rx="10" fill="#ff9cc0" stroke="#d95b8a" stroke-width="2" transform="rotate(14 ${sx0 + 262} 148)"/>`;

  // ---- window wall ----
  const fr = (d, w, c) => `<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linejoin="round"/>`;
  let frame = `M${WIN.x0} ${WIN.y0}H${WIN.x1}V${WIN.y1}H${WIN.x0}Z`;
  for (let c = 1; c < WIN.cols; c++) frame += `M${n(WIN.x0 + c * paneW)} ${WIN.y0}V${WIN.y1}`;
  frame += `M${WIN.x0} ${WIN.transom}H${WIN.x1}`;
  s += fr(frame, 26, '#b5c8de') + fr(frame, 18, '#ffffff') + fr(frame, 3, '#d7e3f0');
  for (let c = 0; c < WIN.cols; c++) {
    const px = WIN.x0 + c * paneW;
    s += `<path d="M${n(px + 30)} ${WIN.y0 + 150}l${n(paneW * 0.4)} -80M${n(px + 30)} ${WIN.y0 + 196}l${n(paneW * 0.22)} -44" stroke="#ffffff" stroke-width="9" opacity=".32" stroke-linecap="round"/>`;
    s += `<rect x="${n(px + 9)}" y="${WIN.y0 + 9}" width="${n(paneW - 18)}" height="${WIN.y1 - WIN.y0 - 18}" fill="url(#rm-glow)" opacity=".25"/>`;
  }
  // roller blinds: rolled at the top, the right pane half down with slats
  s += `<rect x="${WIN.x0 - 14}" y="${WIN.y0 - 16}" width="${WIN.x1 - WIN.x0 + 28}" height="22" rx="10" fill="url(#rm-blind)" stroke="#d6c9ae" stroke-width="2"/>`;
  const bx0 = WIN.x0 + 2 * paneW + 10;
  s += `<rect x="${n(bx0)}" y="${WIN.y0 + 6}" width="${n(paneW - 20)}" height="88" fill="url(#rm-blind)" opacity=".96"/>`;
  let slats = '';
  for (let y = WIN.y0 + 16; y < WIN.y0 + 94; y += 11) slats += `M${n(bx0)} ${y}h${n(paneW - 20)}`;
  s += `<path d="${slats}" stroke="#d9ccb2" stroke-width="2"/><rect x="${n(bx0)}" y="${WIN.y0 + 90}" width="${n(paneW - 20)}" height="8" rx="3" fill="#d9ccb2"/><path d="M${n(bx0 + paneW - 44)} ${WIN.y0 + 98}v40" stroke="#c9b892" stroke-width="2"/><circle cx="${n(bx0 + paneW - 44)}" cy="${WIN.y0 + 142}" r="5" fill="#c9b892"/>`;
  // sill + low cabinet under the windows
  s += `<rect x="${WIN.x0 - 24}" y="${WIN.y1 - 4}" width="${WIN.x1 - WIN.x0 + 48}" height="12" fill="#ffffff"/><rect x="${WIN.x0 - 24}" y="${WIN.y1 + 8}" width="${WIN.x1 - WIN.x0 + 48}" height="6" fill="#c9d6e6"/>`;
  s += `<rect x="${WIN.x0 - 6}" y="${WIN.y1 + 14}" width="${WIN.x1 - WIN.x0 + 12}" height="${y1 - WIN.y1 - 14}" fill="url(#rm-wood)" stroke="#c49a6a" stroke-width="2"/>`;
  for (let i = 0; i < 6; i++) {
    const dx = WIN.x0 + i * ((WIN.x1 - WIN.x0) / 6);
    s += `<rect x="${n(dx + 4)}" y="${WIN.y1 + 22}" width="${n((WIN.x1 - WIN.x0) / 6 - 8)}" height="${y1 - WIN.y1 - 34}" rx="3" fill="none" stroke="#c49a6a" stroke-width="2" opacity=".7"/><rect x="${n(dx + (WIN.x1 - WIN.x0) / 12 - 12)}" y="${WIN.y1 + 34}" width="24" height="5" rx="2.5" fill="#8d6e50"/>`;
  }
  // things on the sill
  s += plantPot(WIN.x0 + 30, WIN.y1 - 4, 0.62, 'leafy');
  s += `<g transform="translate(${WIN.x0 + 330} ${WIN.y1 - 4})"><rect x="0" y="-12" width="70" height="12" rx="2" fill="#ff7aa8"/><rect x="6" y="-24" width="62" height="12" rx="2" fill="#4cc9f0"/><rect x="2" y="-36" width="58" height="12" rx="2" fill="#ffd166"/><rect x="40" y="-60" width="18" height="24" rx="3" fill="#ffffff" stroke="#9fb0c8" stroke-width="2"/></g>`;
  s += `<g transform="translate(${WIN.x0 + 520} ${WIN.y1 - 4})"><ellipse cx="0" cy="-26" rx="30" ry="26" fill="#cfefff" stroke="#9fd0ef" stroke-width="2.5" opacity=".9"/><path d="M-26-30q26 8 52 0" stroke="#7cc4f0" stroke-width="2" fill="none"/><path d="M-6-22q6-6 12 0-6 6-12 0zM6-22l6-4v8z" fill="#ff9f5a"/><rect x="-14" y="-2" width="28" height="4" rx="2" fill="#9fd0ef"/></g>`;
  s += plantPot(WIN.x1 - 70, WIN.y1 - 4, 0.9, 'sakura');

  // ---- right of the windows: clock + cork board ----
  s += '<g transform="translate(1420 170)"><circle r="34" fill="#ffffff" stroke="#9fb0c8" stroke-width="5"/><circle r="27" fill="#f7fbff"/><path d="M0-20v20l13 8" stroke="#22385c" stroke-width="4" stroke-linecap="round" fill="none"/><circle r="3.5" fill="#ff7aa8"/>';
  for (let i = 0; i < 12; i++) s += `<rect x="-1.5" y="-26" width="3" height="${i % 3 ? 4 : 7}" fill="#9fb0c8" transform="rotate(${i * 30})"/>`;
  s += '</g>';
  s += '<rect x="1386" y="228" width="88" height="200" rx="4" fill="#d9a86c" stroke="#ffffff" stroke-width="6"/><rect x="1392" y="234" width="76" height="188" fill="#c9965a" opacity=".5"/>';
  for (const [nx, ny, c, r] of [[1396, 244, '#fff6b8', -6], [1432, 252, '#ffd6e6', 5], [1400, 304, '#d9f1ff', 4], [1430, 318, '#ffffff', -4], [1402, 370, '#d6f5df', -3], [1436, 378, '#fff6b8', 6]]) {
    s += `<g transform="rotate(${r} ${nx + 16} ${ny + 18})"><rect x="${nx}" y="${ny}" width="32" height="38" fill="${c}"/><path d="M${nx + 6} ${ny + 14}h20M${nx + 6} ${ny + 22}h16" stroke="#9fb0c8" stroke-width="2"/><circle cx="${nx + 16}" cy="${ny + 4}" r="3.5" fill="#ff4d6d"/></g>`;
  }

  // ---- ambient occlusion along the wall/floor line + contact shadows under furniture ----
  s += `<rect x="0" y="${y1 - 6}" width="${W}" height="40" fill="#7f93b0" opacity=".16" filter="url(#rm-blur-s)"/>`;
  s += `<g filter="url(#rm-blur-s)" fill="#4d6288" opacity=".28"><rect x="${sx0 - 20}" y="${y1 - 4}" width="${sx1 - sx0 + 40}" height="20" rx="10"/><rect x="${WIN.x0 - 20}" y="${y1 - 4}" width="${WIN.x1 - WIN.x0 + 40}" height="18" rx="9"/><ellipse cx="231" cy="752" rx="96" ry="14"/><ellipse cx="366" cy="756" rx="60" ry="10"/><ellipse cx="468" cy="724" rx="44" ry="9"/><rect x="1100" y="${dTop0 + 200}" width="520" height="22" rx="11"/></g>`;
  // ---- floor objects ----
  // sun patches from the windows on the floor (drawn before furniture)
  s += `<g filter="url(#rm-blur-s)"><path d="M610 ${y1 + 8}H860L700 800H330Z" fill="#fffdf0" opacity=".75"/><path d="M880 ${y1 + 8}H1120L1010 800H640Z" fill="#fffdf0" opacity=".6"/></g>`;
  // rug where the secretary stands
  s += '<ellipse cx="640" cy="790" rx="360" ry="64" fill="url(#rm-rug)" stroke="#ffffff" stroke-width="5"/><ellipse cx="640" cy="790" rx="300" ry="48" fill="none" stroke="#9cc6ef" stroke-width="3" stroke-dasharray="14 10"/>';
  // stacked boxes + water cooler (left, in front of the shelf)
  s += box(156, 652, 150, 98, { top: 18, tone: 0 }) + box(178, 576, 112, 76, { top: 14, tone: 2 }) + box(318, 690, 96, 64, { top: 14, tone: 1, label: false });
  s += '<g transform="translate(468 720)"><rect x="-30" y="-120" width="60" height="120" rx="6" fill="#f4f7fb" stroke="#a9b8cc" stroke-width="2"/><rect x="-22" y="-104" width="44" height="30" rx="4" fill="#dfe8f3"/><rect x="-14" y="-96" width="9" height="12" rx="2" fill="#4c8bf5"/><rect x="5" y="-96" width="9" height="12" rx="2" fill="#ff6b6b"/><path d="M-26-120q-4-58 26-62 30 4 26 62z" fill="#a8dcff" stroke="#6eb5ea" stroke-width="2" opacity=".9"/><rect x="-10" y="-190" width="20" height="12" rx="3" fill="#6eb5ea"/><path d="M-14-170q0 30 4 46" stroke="#ffffff" stroke-width="5" opacity=".6" fill="none"/></g>';
  // office desk on the right with monitors, lamp, mug and papers + chair
  const dTop = 650;
  s += `<path d="M1118 ${dTop}H${W}V${dTop + 28}H1096Z" fill="url(#rm-wood)" stroke="#c49a6a" stroke-width="2"/>`;
  s += `<rect x="1096" y="${dTop + 28}" width="${W - 1096}" height="12" fill="#c49a6a"/><rect x="1110" y="${dTop + 40}" width="${W - 1110}" height="120" fill="url(#rm-wood-dark)" opacity=".95"/><rect x="1116" y="${dTop + 40}" width="16" height="170" fill="#b98d5e"/>`;
  s += `<rect x="1150" y="${dTop + 54}" width="120" height="60" rx="4" fill="none" stroke="#a87a4a" stroke-width="2"/><rect x="1196" y="${dTop + 78}" width="28" height="6" rx="3" fill="#8d6e50"/>`;
  for (const [mx, mw] of [[1176, 150], [1342, 150]]) {
    s += `<rect x="${mx + mw / 2 - 8}" y="${dTop - 40}" width="16" height="40" fill="#7f93b0"/><path d="M${mx + mw / 2 - 30} ${dTop}h60l-6-8h-48z" fill="#7f93b0"/>`;
    s += `<rect x="${mx}" y="${dTop - 138}" width="${mw}" height="100" rx="6" fill="#3a4a66"/><rect x="${mx + 7}" y="${dTop - 131}" width="${mw - 14}" height="86" rx="3" fill="url(#rm-monitor)"/>`;
    s += `<path d="M${mx + 16} ${dTop - 118}h${mw * 0.45}M${mx + 16} ${dTop - 104}h${mw * 0.6}M${mx + 16} ${dTop - 90}h${mw * 0.35}" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity=".7"/><path d="M${mx + 10} ${dTop - 128}l${mw * 0.5} 0l-${mw * 0.35} 80h-${mw * 0.15}z" fill="#ffffff" opacity=".15"/>`;
  }
  s += `<path d="M1234 ${dTop + 8}h140l8 12h-156z" fill="#e8eef6" stroke="#a9b8cc" stroke-width="2"/>`;
  s += `<g transform="translate(1530 ${dTop + 8})"><rect x="-16" y="-34" width="32" height="34" rx="6" fill="#ffffff" stroke="#a9b8cc" stroke-width="2"/><path d="M16-26q14 0 14 10t-14 10" stroke="#a9b8cc" stroke-width="5" fill="none"/><rect x="-16" y="-24" width="32" height="8" fill="#ff9cc0"/><path d="M-4-44q-6-8 0-14M6-44q-6-8 0-14" stroke="#ffffff" stroke-width="3" fill="none" opacity=".8"/></g>`;
  s += `<g transform="translate(1136 ${dTop})"><path d="M-18 0h36l-4-8h-28z" fill="#5b8def"/><path d="M0-8l18-60 26 14" stroke="#5b8def" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M30-70l34 14-10 16-34-14z" fill="#5b8def"/><ellipse cx="50" cy="-42" rx="16" ry="6" fill="#fff6c4" opacity=".9" transform="rotate(22 50 -42)"/></g>`;
  s += `<g transform="translate(1568 ${dTop + 4})"><rect x="-30" y="-10" width="62" height="10" fill="#ffffff" stroke="#c9d6e6" stroke-width="2" transform="rotate(-4)"/><rect x="-26" y="-20" width="58" height="10" fill="#ffd6e6" stroke="#e6a3bd" stroke-width="2" transform="rotate(3)"/><rect x="-28" y="-30" width="60" height="10" fill="#d9f1ff" stroke="#9fc6ea" stroke-width="2"/></g>`;
  // chair (seen from behind)
  s += '<g transform="translate(1340 860)"><ellipse cx="0" cy="18" rx="92" ry="14" fill="url(#rm-shadow)"/><path d="M-70 14h140M0 0v14M-50 14l-10 8M50 14l10 8" stroke="#3b4d6e" stroke-width="7" stroke-linecap="round"/><rect x="-6" y="-60" width="12" height="60" fill="#7f93b0"/><rect x="-70" y="-84" width="140" height="28" rx="12" fill="url(#rm-chair)"/><rect x="-62" y="-216" width="124" height="134" rx="34" fill="url(#rm-chair)" stroke="#2c4878" stroke-width="2"/><path d="M-40-196q30-12 70-4" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity=".35" fill="none"/><path d="M-80-112v-40q0-8 8-8M80-112v-40q0-8-8-8" stroke="#3b4d6e" stroke-width="8" fill="none" stroke-linecap="round"/></g>';

  // ---- light: sun shafts slanting in from the windows (top right → floor left) ----
  s += '<g filter="url(#rm-blur)" opacity=".9">';
  s += `<path d="M1180 150L1340 150 900 ${H} 600 ${H}Z" fill="url(#rm-beam)" opacity=".75"/>`;
  s += `<path d="M900 150L1040 150 560 ${H} 330 ${H}Z" fill="url(#rm-beam)" opacity=".6"/>`;
  s += `<path d="M640 150L740 150 320 ${H} 160 ${H}Z" fill="url(#rm-beam)" opacity=".4"/>`;
  s += '</g>';
  // bloom around the bright windows
  s += `<rect x="${WIN.x0 - 30}" y="${WIN.y0 - 20}" width="${WIN.x1 - WIN.x0 + 60}" height="${WIN.y1 - WIN.y0 + 40}" rx="30" fill="none" stroke="#ffffff" stroke-width="40" opacity=".35" filter="url(#rm-blur)"/>`;
  // dust motes in the light
  for (let i = 0; i < 26; i++) s += `<circle cx="${n(500 + rnd() * 700)}" cy="${n(200 + rnd() * 520)}" r="${n(1.4 + rnd() * 2.6)}" fill="#ffffff" opacity="${n(0.35 + rnd() * 0.5)}"/>`;
  // soft haze to push the room back behind the girl
  s += `<rect width="${W}" height="${H}" fill="#f4f9ff" opacity=".1"/>`;
  s += `<rect width="${W}" height="${H}" fill="url(#rm-vig)"/>`;
  return svg(`${defs}<g filter="url(#rm-soft)">${s}</g>`, 'Club office');
}

// ---------------------------------------------------------------------------------------------
// NEAR: blurred foreground
// ---------------------------------------------------------------------------------------------

function nearLayer() {
  const rnd = seeded('lobby-v3-near');
  const W = ROOM_W;
  const H = ROOM_H;
  let s = '<defs>'
    + linGrad('rn-desk', [[0, '#f3dcb8'], [1, '#caa070']])
    + linGrad('rn-leaf', [[0, '#5cbf82'], [1, '#2f7a50']])
    + linGrad('rn-leaf2', [[0, '#7bd3a0'], [1, '#3d9a63']])
    + '<filter id="rn-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>'
    + '<filter id="rn-blur2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.5"/></filter>'
    + '</defs>';
  // desk corner (bottom-left) with a mug and papers
  s += '<g filter="url(#rn-blur)">';
  s += `<path d="M-40 ${H - 96}Q170 ${H - 128} 360 ${H - 92}L380 ${H}H-40Z" fill="url(#rn-desk)"/><path d="M-40 ${H - 96}Q170 ${H - 128} 360 ${H - 92}" stroke="#ffffff" stroke-width="6" opacity=".5" fill="none"/>`;
  s += `<rect x="40" y="${H - 136}" width="140" height="30" rx="4" fill="#ffffff" transform="rotate(-7 110 ${H - 120})"/><rect x="60" y="${H - 150}" width="120" height="26" rx="4" fill="#d9f1ff" transform="rotate(4 120 ${H - 136})"/>`;
  s += `<g transform="translate(270 ${H - 104})"><rect x="-26" y="-64" width="52" height="64" rx="10" fill="#ffffff"/><rect x="-26" y="-46" width="52" height="14" fill="#ff9cc0"/><path d="M26-50q22 0 22 16t-22 16" stroke="#ffffff" stroke-width="9" fill="none"/></g>`;
  s += '</g>';
  // big leaves (bottom-right)
  s += '<g filter="url(#rn-blur)">';
  const leaf = (x, y, len, rot, g) => {
    const w = len * 0.46;
    return `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M0 0C${n(-w)} ${n(-len * 0.25)} ${n(-w * 0.9)} ${n(-len * 0.85)} 0 ${n(-len)}C${n(w * 0.9)} ${n(-len * 0.85)} ${n(w)} ${n(-len * 0.25)} 0 0Z" fill="url(#${g})"/><path d="M0 -6V${n(-len * 0.92)}" stroke="#a8e6bf" stroke-width="6" opacity=".55"/></g>`;
  };
  s += leaf(1560, 900, 260, -38, 'rn-leaf') + leaf(1600, 820, 230, -70, 'rn-leaf2') + leaf(1490, 920, 200, -18, 'rn-leaf2') + leaf(1620, 700, 180, -95, 'rn-leaf');
  s += '</g>';
  // a few large bokeh petals drifting close to the camera
  s += '<g filter="url(#rn-blur2)">';
  for (let i = 0; i < 5; i++) {
    const x = 120 + rnd() * 1360;
    const y = 120 + rnd() * 600;
    s += `<path d="${petalPath(26 + rnd() * 14)}" transform="translate(${n(x)} ${n(y)}) rotate(${n(rnd() * 360)})" fill="#ffd0e0" opacity=".7"/>`;
  }
  s += '</g>';
  s += `<path d="${sparklePath(1120, 200, 10)}" fill="#ffffff" opacity=".7"/>`;
  return svg(s, 'Foreground');
}

/**
 * The lobby room, one depth layer at a time ('far' | 'mid' | 'near'), or 'all' for a single
 * composed picture (thumbnails, fallbacks).
 * @param {'far'|'mid'|'near'|'all'} [layer]
 */
export function lobbyRoomSVG(layer = 'all') {
  if (layer === 'far') return farLayer();
  if (layer === 'mid') return midLayer();
  if (layer === 'near') return nearLayer();
  const inner = (s) => s.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  return svg(`<g>${inner(farLayer())}</g><g>${inner(midLayer())}</g><g>${inner(nearLayer())}</g>`, 'Club office by the sea');
}

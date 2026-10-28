// Large scenic backdrops (CONTRACTS §8): the lobby's seaside classroom and one banner
// scene per map theme. Original artwork from simple layered shapes; deterministic.

import { n, darken, linGrad, radGrad, seeded, petalPath, blossom, sparklePath } from './svgUtil.js';
import { gearPath } from './icons/glyphs.js';

export { lobbyRoomSVG, ROOM_VP, ROOM_FLOOR_Y } from './lobbyRoom.js';

/** Wavy hill silhouette across the width (filled down to `bottom`). */
function hills(rnd, w, baseY, amp, bottom, fill, steps = 8, extra = '') {
  let d = `M0 ${bottom}L0 ${n(baseY)}`;
  let prevX = 0;
  let prevY = baseY;
  for (let i = 1; i <= steps; i++) {
    const x = (w * i) / steps;
    const y = baseY - rnd() * amp;
    d += `Q${n((prevX + x) / 2)} ${n(Math.min(prevY, y) - amp * 0.5 * rnd())} ${n(x)} ${n(y)}`;
    prevX = x;
    prevY = y;
  }
  return `<path d="${d}L${w} ${bottom}Z" fill="${fill}"${extra}/>`;
}

/** Jagged mountain range. */
function peaks(rnd, w, baseY, amp, bottom, fill, count = 6, snowCap = null) {
  let d = `M0 ${bottom}L0 ${n(baseY)}`;
  let caps = '';
  const step = w / count;
  for (let i = 0; i < count; i++) {
    const x0 = i * step;
    const px = x0 + step * (0.35 + rnd() * 0.3);
    const py = baseY - amp * (0.55 + rnd() * 0.45);
    d += `L${n(px)} ${n(py)}L${n(x0 + step)} ${n(baseY - rnd() * amp * 0.25)}`;
    if (snowCap) caps += `<path d="M${n(px)} ${n(py)}L${n(px + amp * 0.16)} ${n(py + amp * 0.2)}L${n(px + amp * 0.05)} ${n(py + amp * 0.16)}L${n(px - amp * 0.04)} ${n(py + amp * 0.24)}L${n(px - amp * 0.16)} ${n(py + amp * 0.2)}Z" fill="${snowCap}"/>`;
  }
  return `<path d="${d}L${w} ${bottom}Z" fill="${fill}"/>${caps}`;
}

function cloud(x, y, s, fill = '#ffffff', op = 0.95) {
  return `<g fill="${fill}" opacity="${op}"><ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(60 * s)}" ry="${n(22 * s)}"/><circle cx="${n(x - 28 * s)}" cy="${n(y - 12 * s)}" r="${n(24 * s)}"/><circle cx="${n(x + 6 * s)}" cy="${n(y - 22 * s)}" r="${n(32 * s)}"/><circle cx="${n(x + 38 * s)}" cy="${n(y - 8 * s)}" r="${n(22 * s)}"/></g>`;
}

function petals(rnd, w, h, count, op = 0.85) {
  let s = '';
  for (let i = 0; i < count; i++) {
    s += `<path d="${petalPath(8 + rnd() * 10)}" transform="translate(${n(rnd() * w)} ${n(rnd() * h)}) rotate(${n(rnd() * 360)})" fill="${i % 2 ? '#ffc4d6' : '#ffe0ec'}" opacity="${op}"/>`;
  }
  return s;
}

function sakuraTree(x, y, s) {
  let c = `<path d="M${n(x)} ${n(y)}q${n(-6 * s)} ${n(-50 * s)} ${n(4 * s)} ${n(-90 * s)}M${n(x + 2 * s)} ${n(y - 50 * s)}q${n(20 * s)} ${n(-14 * s)} ${n(34 * s)} ${n(-30 * s)}M${n(x)} ${n(y - 60 * s)}q${n(-22 * s)} ${n(-8 * s)} ${n(-36 * s)} ${n(-26 * s)}" stroke="#7a4b3a" stroke-width="${n(9 * s)}" fill="none" stroke-linecap="round"/>`;
  const blobs = [[0, -110, 46], [-40, -90, 36], [40, -92, 38], [-18, -128, 30], [24, -126, 32]];
  for (const [dx, dy, r] of blobs) c += `<circle cx="${n(x + dx * s)}" cy="${n(y + dy * s)}" r="${n(r * s)}" fill="#ffb3d1"/>`;
  for (const [dx, dy, r] of blobs) c += `<circle cx="${n(x + dx * s - r * s * 0.25)}" cy="${n(y + dy * s - r * s * 0.3)}" r="${n(r * s * 0.55)}" fill="#ffd6e7"/>`;
  return c;
}

function pine(x, y, s, fill, snow = false) {
  let c = `<path d="M${n(x)} ${n(y - 80 * s)}L${n(x + 26 * s)} ${n(y - 30 * s)}L${n(x + 14 * s)} ${n(y - 30 * s)}L${n(x + 34 * s)} ${n(y)}L${n(x - 34 * s)} ${n(y)}L${n(x - 14 * s)} ${n(y - 30 * s)}L${n(x - 26 * s)} ${n(y - 30 * s)}Z" fill="${fill}"/>`;
  if (snow) c += `<path d="M${n(x)} ${n(y - 80 * s)}L${n(x + 14 * s)} ${n(y - 54 * s)}L${n(x)} ${n(y - 60 * s)}L${n(x - 14 * s)} ${n(y - 54 * s)}Z" fill="#fff"/>`;
  return c;
}

function torii(x, y, s) {
  const r = '#d62828';
  return `<g fill="${r}" stroke="#7a0d12" stroke-width="${n(2 * s)}"><rect x="${n(x - 70 * s)}" y="${n(y - 120 * s)}" width="${n(140 * s)}" height="${n(12 * s)}" rx="${n(4 * s)}"/><rect x="${n(x - 58 * s)}" y="${n(y - 98 * s)}" width="${n(116 * s)}" height="${n(8 * s)}"/><rect x="${n(x - 48 * s)}" y="${n(y - 112 * s)}" width="${n(10 * s)}" height="${n(112 * s)}"/><rect x="${n(x + 38 * s)}" y="${n(y - 112 * s)}" width="${n(10 * s)}" height="${n(112 * s)}"/></g><path d="M${n(x - 78 * s)} ${n(y - 124 * s)}Q${n(x)} ${n(y - 112 * s)} ${n(x + 78 * s)} ${n(y - 124 * s)}" stroke="#1d1d2b" stroke-width="${n(6 * s)}" fill="none" stroke-linecap="round"/>`;
}

function lanternString(w, y, count, colors) {
  let s = `<path d="M0 ${y}Q${w / 2} ${y + 50} ${w} ${y}" stroke="#4a3a35" stroke-width="2" fill="none"/>`;
  for (let i = 1; i < count; i++) {
    const t = i / count;
    const x = w * t;
    const ly = y + 50 * 2 * t * (1 - t) * 1 + 6;
    const c = colors[i % colors.length];
    s += `<circle cx="${n(x)}" cy="${n(ly + 14)}" r="22" fill="${c}" opacity="0.3"/><ellipse cx="${n(x)}" cy="${n(ly + 14)}" rx="11" ry="14" fill="${c}" stroke="${darken(c, 0.4)}" stroke-width="1.5"/><path d="M${n(x - 11)} ${n(ly + 14)}h22" stroke="${darken(c, 0.3)}" stroke-width="1"/>`;
  }
  return s;
}

function stars(rnd, w, h, count) {
  let s = '';
  for (let i = 0; i < count; i++) s += `<circle cx="${n(rnd() * w)}" cy="${n(rnd() * h)}" r="${n(0.8 + rnd() * 1.8)}" fill="#fff" opacity="${n(0.4 + rnd() * 0.6)}"/>`;
  return s;
}

/** A snowfall of round flakes over (0..w, 0..h): `count` flakes of radius r0 + rnd()·rr. */
function snowfall(rnd, w, h, count, r0, rr, op) {
  let s = '';
  for (let i = 0; i < count; i++) s += `<circle cx="${n(rnd() * w)}" cy="${n(rnd() * h)}" r="${n(r0 + rnd() * rr)}" fill="#ffffff" opacity="${op}"/>`;
  return s;
}

/**
 * A lit lamp: a bright core and a glow fading out round it (story backdrops at dusk and at night). The glow is a radial
 * gradient keyed by colour and strength, so every lamp of one kind shares one definition (a flat disc read as grey on
 * the night sky).
 */
function lamp(x, y, r, color, glow, glowOp) {
  const gid = `lampglow-${color.replace('#', '')}-${Math.round(glowOp * 100)}`;
  const grad = `<radialGradient id="${gid}"><stop offset="0" stop-color="${color}" stop-opacity="${glowOp}"/><stop offset="0.45" stop-color="${color}" stop-opacity="${n(glowOp * 0.45)}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
  return `${grad}<circle cx="${n(x)}" cy="${n(y)}" r="${n(glow)}" fill="url(#${gid})"/><circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="#fff4d6"/>`;
}

function svg(w, h, body, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${label}">${body}</svg>`;
}

/**
 * Lobby backdrop (V2): a bright seaside classroom with depth — a wall of tall windows over
 * a sunlit sea, airy curtains, light rays slanting across the room, soft-focus desks in the
 * foreground and sakura petals drifting in. Designed for 16:9 but safe to crop to ~2.2:1
 * (everything important sits between y = 80 and y = 820).
 */
export function lobbyBackdropSVG() {
  const W = 1600;
  const H = 900;
  const rnd = seeded('lobby-v2');
  let s = '<defs>' +
    linGrad('lb-sky', [[0, '#5fb6ff'], [0.45, '#a9dcff'], [1, '#eef9ff']]) +
    linGrad('lb-sea', [[0, '#7fd4ff'], [0.35, '#3fa9f0'], [1, '#1d78c9']]) +
    radGrad('lb-sun', [[0, '#ffffff', 1], [0.25, '#fffbe6', 0.9], [1, '#fff6d6', 0]]) +
    linGrad('lb-wall', [[0, '#ffffff'], [1, '#e9f1fa']]) +
    linGrad('lb-wall-side', [[0, '#dfe9f4'], [1, '#c9d8e8']], { x2: 1, y2: 0 }) +
    linGrad('lb-floor', [[0, '#eef4fb'], [0.5, '#dfe8f3'], [1, '#c7d6e6']]) +
    linGrad('lb-curtain', [[0, '#ffffff', 0.97], [1, '#e4f1ff', 0.92]], { x2: 1, y2: 0 }) +
    linGrad('lb-beam', [[0, '#ffffff', 0.85], [0.55, '#ffffff', 0.3], [1, '#ffffff', 0]]) +
    linGrad('lb-desk', [[0, '#f7ecd9'], [1, '#dcc3a0']]) +
    radGrad('lb-haze', [[0, '#ffffff', 0], [0.7, '#ffffff', 0], [1, '#ffffff', 0.55]]) +
    linGrad('lb-fog', [[0, '#ffffff', 0], [1, '#ffffff', 0.75]]) +
    '<filter id="lb-blur-far" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2"/></filter>' +
    '<filter id="lb-blur-near" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="4.5"/></filter>' +
    '<filter id="lb-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>' +
    '</defs>';

  // ---- outside: sky, sun, clouds, islands, sea --------------------------------------
  s += `<rect width="${W}" height="${H}" fill="url(#lb-sky)"/>`;
  s += '<circle cx="1210" cy="150" r="260" fill="url(#lb-sun)"/>';
  s += `<g filter="url(#lb-blur-far)">${cloud(300, 210, 1.7)}${cloud(720, 120, 1.2, '#ffffff', 0.9)}${cloud(1420, 250, 1.5)}${cloud(1000, 330, 0.9, '#ffffff', 0.8)}${cloud(520, 360, 0.7, '#ffffff', 0.7)}</g>`;
  s += `<g filter="url(#lb-blur-far)" opacity="0.9">${hills(rnd, W, 468, 44, 500, '#9fd1c3', 7)}${hills(rnd, W, 482, 26, 500, '#7fbfa8', 9)}</g>`;
  s += `<rect y="486" width="${W}" height="${H - 486}" fill="url(#lb-sea)"/>`;
  let glints = '';
  for (let i = 0; i < 70; i++) {
    const x = rnd() * W;
    const y = 496 + rnd() * 230;
    glints += `M${n(x)} ${n(y)}h${n(8 + rnd() * 34)}`;
  }
  s += `<path d="${glints}" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.55"/>`;
  s += '<path d="M1090 492l20-66 12 66z" fill="#ffffff"/><path d="M1068 492h66l-9 11h-48z" fill="#ff7aa8"/>';
  s += '<path d="M330 500l14-44 8 44z" fill="#ffffff" opacity="0.9"/>';

  // ---- classroom wall with four tall windows ------------------------------------------
  const win = [[70, 70, 330, 560], [450, 70, 330, 560], [830, 70, 330, 560], [1210, 70, 330, 560]];
  let holes = '';
  for (const [x, y, w, h] of win) holes += `M${x} ${y}h${w}v${h}h${-w}z`;
  s += `<path d="M0 0H${W}V${H}H0ZM${holes.slice(1)}" fill="url(#lb-wall)" fill-rule="evenodd"/>`;
  // window frames (white with a cool shadow line), mullions and glass highlights
  for (const [x, y, w, h] of win) {
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#b9cde3" stroke-width="22"/>`;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#ffffff" stroke-width="14"/>`;
    s += `<path d="M${x + w / 2} ${y}v${h}M${x} ${y + h * 0.36}h${w}M${x} ${y + h * 0.7}h${w}" stroke="#ffffff" stroke-width="10"/>`;
    s += `<path d="M${x + w / 2} ${y}v${h}M${x} ${y + h * 0.36}h${w}M${x} ${y + h * 0.7}h${w}" stroke="#c9dbee" stroke-width="3"/>`;
    s += `<path d="M${x + 28} ${y + 48}l92-34M${x + 28} ${y + 96}l48-18" stroke="#ffffff" stroke-width="7" opacity="0.55" stroke-linecap="round"/>`;
    s += `<rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${h - 16}" fill="url(#lb-haze)" opacity="0.5"/>`;
  }
  // wall trims: top cornice + window sill + skirting
  s += `<rect x="0" y="28" width="${W}" height="30" fill="#d9e6f3"/><rect x="0" y="52" width="${W}" height="8" fill="#ffffff"/>`;
  s += `<rect x="0" y="636" width="${W}" height="22" rx="4" fill="#ffffff"/><rect x="0" y="656" width="${W}" height="10" fill="#c4d5e6"/>`;

  // ---- floor with perspective tiles -----------------------------------------------------
  s += `<rect y="666" width="${W}" height="${H - 666}" fill="url(#lb-floor)"/>`;
  let tiles = '';
  for (let i = 0; i <= 12; i++) {
    const x = (W / 12) * i;
    tiles += `M${n(x)} 666L${n(800 + (x - 800) * 1.9)} ${H}`;
  }
  for (const y of [700, 745, 800, 865]) tiles += `M0 ${y}H${W}`;
  s += `<path d="${tiles}" stroke="#b8c9dc" stroke-width="2" opacity="0.55" fill="none"/>`;
  s += `<rect y="666" width="${W}" height="${H - 666}" fill="url(#lb-fog)" opacity="0.35"/>`;

  // ---- mid-ground: teacher's desk + chairs (slightly soft) ---------------------------------
  s += '<g filter="url(#lb-blur-far)" opacity="0.95">';
  for (const [x, sc] of [[250, 0.78], [620, 0.78], [990, 0.78], [1360, 0.78]]) {
    const w = 190 * sc;
    const y = 668;
    s += `<rect x="${n(x)}" y="${y}" width="${n(w)}" height="${n(16 * sc)}" rx="5" fill="url(#lb-desk)" stroke="#c7ab84" stroke-width="2.5"/>`;
    s += `<rect x="${n(x + 10 * sc)}" y="${n(y + 16 * sc)}" width="${n(7 * sc)}" height="${n(74 * sc)}" fill="#8d99ae"/><rect x="${n(x + w - 17 * sc)}" y="${n(y + 16 * sc)}" width="${n(7 * sc)}" height="${n(74 * sc)}" fill="#8d99ae"/>`;
    s += `<rect x="${n(x + w * 0.3)}" y="${n(y - 12 * sc)}" width="${n(w * 0.4)}" height="${n(13 * sc)}" rx="3" fill="#ffffff" stroke="#c9d6e8" stroke-width="2"/>`;
    s += `<rect x="${n(x + w * 0.5 - 22 * sc)}" y="${n(y + 16 * sc)}" width="${n(44 * sc)}" height="${n(40 * sc)}" rx="6" fill="#5c7cfa" opacity="0.85"/>`;
  }
  s += '</g>';
  // potted plant on the right windowsill + a stack of books
  s += '<g filter="url(#lb-blur-far)"><rect x="1478" y="600" width="44" height="40" rx="6" fill="#d8b98f"/><path d="M1500 604q-30-40-14-80M1500 604q30-40 16-82M1500 604q-6-50 6-90" stroke="#3f9a63" stroke-width="10" stroke-linecap="round" fill="none"/><circle cx="1484" cy="528" r="14" fill="#6cc48a"/><circle cx="1518" cy="524" r="13" fill="#6cc48a"/><circle cx="1506" cy="512" r="12" fill="#8ad39f"/></g>';
  s += '<g filter="url(#lb-blur-far)"><rect x="96" y="622" width="78" height="10" rx="2" fill="#ff7aa8"/><rect x="104" y="612" width="70" height="10" rx="2" fill="#4cc9f0"/><rect x="100" y="602" width="66" height="10" rx="2" fill="#ffd166"/></g>';

  // ---- light rays slanting in from the top right ------------------------------------------
  s += '<g opacity="0.95" filter="url(#lb-soft)">';
  s += `<path d="M1180 -40L1320 -40 520 ${H} 300 ${H}Z" fill="url(#lb-beam)"/>`;
  s += `<path d="M1400 -40L1480 -40 760 ${H} 640 ${H}Z" fill="url(#lb-beam)"/>`;
  s += `<path d="M1560 20L1600 20 1040 ${H} 960 ${H}Z" fill="url(#lb-beam)" opacity="0.7"/>`;
  s += '</g>';

  // ---- curtains (airy, translucent) -----------------------------------------------------
  s += '<path d="M0 40H150C132 240 176 470 120 680H0Z" fill="url(#lb-curtain)" stroke="#cfe0f2" stroke-width="3"/><path d="M40 60C52 260 30 460 54 660M86 60C100 280 92 480 98 670M124 60C132 240 150 440 110 660" stroke="#cfe0f2" stroke-width="3" fill="none"/>';
  s += `<path d="M${W} 40H${W - 150}C${W - 132} 240 ${W - 176} 470 ${W - 120} 680H${W}Z" fill="url(#lb-curtain)" stroke="#cfe0f2" stroke-width="3"/><path d="M${W - 40} 60C${W - 52} 260 ${W - 30} 460 ${W - 54} 660M${W - 86} 60C${W - 100} 280 ${W - 92} 480 ${W - 98} 670" stroke="#cfe0f2" stroke-width="3" fill="none"/>`;
  s += `<rect x="0" y="34" width="${W}" height="14" rx="4" fill="#c9d9ea"/>`;

  // ---- foreground: soft-focus desk edge (bottom-left) and chair back (bottom-right) --------
  s += '<g filter="url(#lb-blur-near)" opacity="0.92">';
  s += `<path d="M-40 ${H - 120}Q260 ${H - 170} 560 ${H - 110}L560 ${H}L-40 ${H}Z" fill="url(#lb-desk)"/><path d="M-40 ${H - 120}Q260 ${H - 170} 560 ${H - 110}" stroke="#c7ab84" stroke-width="5" fill="none"/>`;
  s += `<rect x="60" y="${H - 162}" width="150" height="34" rx="5" fill="#ffffff" stroke="#c9d6e8" stroke-width="3" transform="rotate(-6 135 ${H - 145})"/><rect x="250" y="${H - 150}" width="60" height="12" rx="3" fill="#ffd166" transform="rotate(-6 280 ${H - 144})"/>`;
  s += `<path d="M1360 ${H}V${H - 150}q0-26 26-26h130q26 0 26 26V${H}" fill="#6f8fc9" opacity="0.85"/><path d="M1386 ${H - 128}h130" stroke="#ffffff" stroke-width="4" opacity="0.5"/>`;
  s += '</g>';

  // ---- sakura branch top-left + drifting petals ---------------------------------------------
  s += '<path d="M-30 30C110 70 230 50 360 120M150 64c20-32 62-44 96-38M258 86c32 8 56 42 60 72M60 40c30-20 70-20 100-6" stroke="#7a4b3a" stroke-width="13" fill="none" stroke-linecap="round"/>';
  const bl = [[112, 52], [196, 30], [268, 66], [344, 118], [236, 20], [318, 150], [160, 92], [66, 44], [290, 42], [150, 30]];
  for (const [x, y] of bl) s += blossom(x, y, 17, '#ffc4d6', '#ff7aa8');
  for (const [x, y] of bl) s += blossom(x + 6, y + 8, 9, '#ffe0ec', '#ffd166');
  s += petals(rnd, W, H, 34, 0.9);
  for (let i = 0; i < 14; i++) s += `<path d="${sparklePath(rnd() * W, 100 + rnd() * 560, 6 + rnd() * 9)}" fill="#ffffff" opacity="0.85"/>`;
  // vignette-ish lift at the top so the HUD reads
  s += `<rect width="${W}" height="140" fill="url(#lb-fog)" opacity="0.25" transform="rotate(180 800 70)"/>`;
  return svg(W, H, s, 'Seaside classroom');
}

// --- theme banners ---------------------------------------------------------------------------

const THEME_SKY = {
  sakura: ['#9fd8ff', '#ffe3ef'], lake: ['#5b7ccf', '#f6c6d8'], shrine: ['#ffcf9f', '#ffe9c7'], mountain: ['#7ec8ff', '#e6f6ff'],
  marsh: ['#7f9f8a', '#d9e8c7'], foundry: ['#6c7a89', '#d6c7a8'], festival: ['#2b2a5c', '#ff9eb5'], volcano: ['#3a1c2a', '#ff8a4d'],
  snow: ['#a9d6ff', '#f4fbff'], night: ['#0f1d3d', '#3d5a9a'], arena: ['#7cc4ff', '#ffe8b8'],
  city: ['#8ec5ec', '#fde9d6'],
  campus: ['#16244a', '#3f5d96'],
};


/**
 * Old Town by night (Gate Arc S3a, the Bell Festival): a night sky, the shrine's bell tower on the
 * hill, rows of wooden houses with tiled roofs and warm paper windows, lantern strings across the
 * lane, stone setts. `burning`: the same street after the barrage: a dark sky with smoke, shells
 * with empty windows, amber fire glows behind them, ash falling, the lanterns dark. No people.
 */
function oldTownScene(rnd, id, W, H, burning) {
  let s = `<rect width="${W}" height="${H}" fill="${burning ? '#2a1e22' : '#16213f'}"/>`;
  s += burning
    ? `<rect y="160" width="${W}" height="160" fill="#4a2e26" opacity="0.55"/>`
    : stars(rnd, W, 190, 60) + '<path d="M940 60a38 38 0 1 0 30 60 30 30 0 1 1-30-60z" fill="#fff6c4"/>';
  // the hill with the shrine's bell tower
  s += hills(rnd, W, 220, 40, 300, burning ? '#2c2224' : '#1d2b4a');
  s += `<rect x="520" y="120" width="40" height="80" fill="${burning ? '#3a2e2a' : '#5e3c28'}"/><path d="M500 124h80l-40-34z" fill="${burning ? '#2b2624' : '#434b57'}"/><circle cx="540" cy="150" r="12" fill="${burning ? '#5a4a3a' : '#e3b04a'}"/>`;
  if (burning) {
    // smoke columns rising off the skyline, fire glow behind the shells
    for (const [x, w] of [[120, 90], [380, 70], [760, 110], [1000, 80]]) {
      s += `<ellipse cx="${x}" cy="150" rx="${w * 0.6}" ry="120" fill="#3b3638" opacity="0.6"/><circle cx="${x}" cy="250" r="${w}" fill="#ffb347" opacity="0.22"/>`;
    }
  }
  // the houses: timber walls, tiled roofs, paper windows (dark shells when burning)
  let x = -20;
  while (x < W) {
    const w = 90 + rnd() * 50;
    const h = 70 + rnd() * 40;
    const y = 300 - h;
    if (burning) {
      const top = rnd() * 30;
      s += `<path d="M${n(x)} 300V${n(y + top)}l${n(w * 0.3)} ${n(-top * 0.6)}l${n(w * 0.25)} ${n(top * 0.9)}l${n(w * 0.45 - 6)} ${n(-top * 0.5)}V300z" fill="#3d3734"/>`;
      for (let wx = x + 14; wx < x + w - 24; wx += 30) s += `<rect x="${n(wx)}" y="${n(y + 30)}" width="16" height="16" fill="${rnd() < 0.25 ? '#ffb347' : '#1c1816'}"/>`;
    } else {
      s += `<rect x="${n(x)}" y="${n(y)}" width="${n(w - 6)}" height="${n(h)}" fill="#6e4a32"/><path d="M${n(x - 10)} ${n(y + 4)}L${n(x + (w - 6) / 2)} ${n(y - 30)}L${n(x + w + 4)} ${n(y + 4)}z" fill="#434b57"/>`;
      for (let wx = x + 12; wx < x + w - 24; wx += 28) s += `<rect x="${n(wx)}" y="${n(y + 22)}" width="18" height="20" fill="${rnd() < 0.7 ? '#ffd98f' : '#8a6a4a'}"/>`;
      s += `<rect x="${n(x + 12)}" y="${n(300 - 28)}" width="${n(Math.min(60, w - 30))}" height="20" fill="${rnd() < 0.5 ? '#2f4a73' : '#d9473f'}"/>`;
    }
    x += w + 6;
  }
  // the lane: stone setts
  s += `<rect y="300" width="${W}" height="${H - 300}" fill="${burning ? '#8f8981' : '#c9bfae'}"/>`;
  for (let k = 0; k < 4; k++) s += `<path d="M0 ${312 + k * 22}H${W}" stroke="${burning ? '#6f6a64' : '#a99e8b'}" stroke-width="2" stroke-dasharray="26 6" opacity="0.8"/>`;
  if (burning) {
    for (let i = 0; i < 50; i++) s += `<circle cx="${n(rnd() * W)}" cy="${n(rnd() * H)}" r="${n(1.2 + rnd() * 2)}" fill="${rnd() < 0.2 ? '#ffc46b' : '#9a948e'}" opacity="0.85"/>`;
    s += '<path d="M60 170Q300 210 560 170T1060 170" stroke="#2b2624" stroke-width="2" fill="none"/>';
  } else {
    s += lanternString(W, 160, 14, ['#ff6a4d', '#ffc46b', '#f7f2e6']);
    s += `<circle cx="300" cy="200" r="120" fill="url(#${id}-glow)" opacity="0.18"/>`;
  }
  return s;
}

/**
 * The mountain highway (Gate Arc S4a, Act 4 "The Checkpoint"; story backgrounds of 4-6…4-8): a pass
 * between snow-capped peaks, pines, a concrete flyover striding across on its piers, the pale
 * concrete road in front with its hard shoulder and crash barrier, a sign gantry over it, a toll
 * canopy with booths and a lit price board, the Brigade's checkpoint barrier arm (amber and white)
 * and two of its navy vans parked by the sound wall. `snow` (the tunnel mouth, 4-8): a grey morning,
 * snow on everything, the mountain face in front with the two bores lit inside, snow blowing out.
 * `time` ('dusk' / 'night', TIME_OF_DAY): a low sun and pink clouds, or stars and a moon; the lamps,
 * booth windows, price board, van lights and the bores' sodium lamps go into `lights`, drawn over the
 * time-of-day wash so they stay bright. No people.
 * @returns {{ s: string, lights: string }}
 */
function highwayScene(rnd, id, W, H, snow, time) {
  let s = '';
  let lights = '';
  const lit = !!time;
  const night = time === 'night';
  if (snow) s += `<rect width="${W}" height="${H}" fill="#dfe6ee" opacity="0.55"/>`;
  else if (time === 'dusk') {
    // the sun going down behind the pass, pink-lit clouds
    s += '<circle cx="860" cy="200" r="130" fill="#ffd6a0" opacity="0.35"/><circle cx="860" cy="200" r="44" fill="#ffd08a"/>';
    s += cloud(260, 70, 0.9, '#ffc4b4', 0.9) + cloud(820, 96, 0.7, '#ffb4a6', 0.85);
  } else if (!night) s += cloud(260, 70, 0.9) + cloud(820, 96, 0.7);
  if (night) {
    const sky = seeded(`${id}-sky`);
    lights += stars(sky, W, 170, 70) + '<path d="M330 50a34 34 0 1 0 28 54 27 27 0 1 1-28-54z" fill="#fff6c4"/>';
  }
  s += peaks(rnd, W, 210, 150, H, snow ? '#b8c4d2' : '#8da2bb', 6, '#ffffff');
  s += peaks(rnd, W, 260, 90, H, snow ? '#a4b0bf' : '#6f8aa0', 8, snow ? '#f4f8fc' : null);
  for (let x = -10; x < W + 20; x += 34 + rnd() * 20) s += pine(x, 292 - rnd() * 14, 0.55 + rnd() * 0.3, snow ? '#4a6f62' : '#3d6b52', snow);
  // the flyover: a concrete deck on tall piers, parapets, a lamp now and then
  const fy = snow ? 150 : 162;
  for (let x = 60; x < W; x += 180) s += `<rect x="${x - 9}" y="${fy + 22}" width="18" height="${n(300 - fy - 22)}" fill="${snow ? '#b4b6b8' : '#a9a69e'}"/><rect x="${x - 26}" y="${fy + 16}" width="52" height="10" fill="#8e8b84"/>`;
  s += `<rect y="${fy}" width="${W}" height="20" fill="#cfccc4"/><rect y="${fy + 18}" width="${W}" height="6" fill="#8e8b84"/><rect y="${fy - 7}" width="${W}" height="7" fill="#e4e2dc"/>`;
  for (let x = 140; x < W; x += 260) {
    s += `<rect x="${x}" y="${fy - 40}" width="4" height="34" fill="#6d737b"/><rect x="${x - 6}" y="${fy - 44}" width="20" height="6" fill="#6d737b"/>`;
    if (lit) lights += lamp(x + 10, fy - 38, 4, '#ffc46b', night ? 30 : 22, night ? 0.45 : 0.35);
    else s += `<circle cx="${x + 10}" cy="${fy - 38}" r="9" fill="#ffc46b" opacity="0.5"/>`;
  }
  if (snow) {
    // the mountain face with the two bores: concrete headwalls, the hazard band, sodium lamps inside
    s += '<path d="M0 300L0 210Q200 170 420 200T840 190T1100 214V300Z" fill="#9aa0a8"/><path d="M0 214Q200 176 420 206T840 196T1100 218V232Q860 214 600 226T0 240Z" fill="#f4f8fc"/>';
    for (const x of [330, 690]) {
      s += `<rect x="${x - 80}" y="210" width="160" height="92" fill="#cbc8c0"/><rect x="${x - 56}" y="236" width="112" height="66" fill="#1b1e26"/><rect x="${x - 56}" y="230" width="112" height="6" fill="#f4a62a"/>`;
      s += `<rect x="${x - 90}" y="204" width="180" height="8" fill="#e4e8ee"/><rect x="${x - 26}" y="214" width="52" height="12" fill="#2f6f52"/>`;
      for (const k of [-34, 0, 34]) {
        if (lit) lights += lamp(x + k, 252, 4, '#ffc46b', night ? 18 : 14, night ? 0.45 : 0.35);
        else s += `<circle cx="${x + k}" cy="252" r="4" fill="#ffc46b"/><circle cx="${x + k}" cy="252" r="12" fill="#ffc46b" opacity="0.25"/>`;
      }
      for (let i = 0; i < 14; i++) s += `<circle cx="${n(x - 50 + rnd() * 100 + i * 4)}" cy="${n(280 + rnd() * 70)}" r="${n(2 + rnd() * 3)}" fill="#ffffff" opacity="0.9"/>`;
    }
  } else {
    // the sound wall behind the plaza, two Brigade vans parked by it (a ticket under each wiper)
    s += `<rect y="252" width="${W}" height="48" fill="#7a9a8c"/><path d="M0 252H1100" stroke="#a9a69e" stroke-width="5"/>`;
    for (let x = 0; x < W; x += 60) s += `<rect x="${x}" y="252" width="5" height="48" fill="#a9a69e"/>`;
    for (const x of [800, 920]) {
      s += `<rect x="${x}" y="262" width="96" height="40" rx="6" fill="#2b3a5c"/><rect x="${x}" y="280" width="96" height="6" fill="#f4a62a"/><rect x="${x + 70}" y="266" width="22" height="14" fill="#2e3a4c"/><rect x="${x + 70}" y="264" width="22" height="3" fill="#eef3f8"/><rect x="${x + 74}" y="276" width="8" height="5" fill="#fff8e6"/>`;
      if (lit) lights += lamp(x + 78, 278.5, 3, '#fff2cf', 12, 0.4);
    }
    // the toll canopy: a white slab with an amber fascia on pillars, three booths, the price board
    s += '<rect x="120" y="214" width="420" height="16" fill="#e4e2dc"/><rect x="120" y="230" width="420" height="7" fill="#f4a62a"/>';
    for (const x of [140, 290, 440, 520]) s += `<rect x="${x}" y="237" width="8" height="66" fill="#b9bfc6"/>`;
    for (const x of [180, 330, 470]) {
      s += `<rect x="${x}" y="262" width="40" height="40" fill="#eef3f8"/><rect x="${x + 6}" y="270" width="28" height="12" fill="#fff2cf"/><rect x="${x - 6}" y="298" width="52" height="8" fill="#a9a69e"/>`;
      // a lit booth window over the wash, its light spilling onto the road
      if (lit) lights += `<ellipse cx="${x + 20}" cy="312" rx="34" ry="8" fill="#ffd98f" opacity="${night ? 0.3 : 0.2}"/><rect x="${x + 6}" y="270" width="28" height="12" fill="#ffe2a0"/>${lamp(x + 20, 276, 0, '#ffd98f', 22, 0.4)}`;
    }
    s += '<rect x="560" y="226" width="54" height="34" fill="#1f2733"/><rect x="566" y="234" width="42" height="5" fill="#ffc46b"/><rect x="566" y="244" width="34" height="5" fill="#7fe0a8"/><rect x="584" y="260" width="5" height="46" fill="#6d737b"/>';
    if (lit) lights += '<rect x="566" y="234" width="42" height="5" fill="#ffd27a"/><rect x="566" y="244" width="34" height="5" fill="#9ff0c0"/>' + lamp(587, 242, 0, '#9ff0c0', 32, 0.3);
  }
  // the road: pale concrete, its expansion joints and edge lines, the dark hard shoulder, the rail
  s += `<rect y="300" width="${W}" height="14" fill="${snow ? '#9aa2ab' : '#77797e'}"/><rect y="314" width="${W}" height="86" fill="${snow ? '#d9dde2' : '#dcdad3'}"/>`;
  for (let x = 0; x < W; x += 70) s += `<path d="M${x} 314V400" stroke="${snow ? '#bfc4ca' : '#bdbab2'}" stroke-width="2"/>`;
  s += '<path d="M0 322H1100M0 392H1100" stroke="#f7f6f2" stroke-width="3"/><path d="M0 357H1100" stroke="#f7f6f2" stroke-width="3" stroke-dasharray="40 30" opacity="0.8"/>';
  s += '<path d="M0 306H1100" stroke="#d3d8de" stroke-width="5"/>';
  for (let x = 20; x < W; x += 50) s += `<rect x="${x}" y="300" width="4" height="12" fill="#6d737b"/>`;
  if (!snow) {
    // a sign gantry over the road and the checkpoint barrier arm across it (amber and white)
    s += '<rect x="640" y="150" width="8" height="160" fill="#b9bfc6"/><rect x="1040" y="150" width="8" height="160" fill="#b9bfc6"/><rect x="636" y="150" width="416" height="8" fill="#b9bfc6"/>';
    for (const [x, w] of [[680, 160], [880, 140]]) s += `<rect x="${x}" y="158" width="${w}" height="46" fill="#2f6f52"/><rect x="${x + 12}" y="168" width="${w * 0.6}" height="7" fill="#eef3f0"/><rect x="${x + 12}" y="184" width="${w * 0.4}" height="6" fill="#eef3f0"/>`;
    s += '<rect x="84" y="318" width="22" height="50" fill="#2b3a5c"/><rect x="84" y="336" width="22" height="6" fill="#f4a62a"/><circle cx="95" cy="314" r="6" fill="#f4a62a"/>';
    for (let i = 0; i < 9; i++) s += `<rect x="${106 + i * 30}" y="336" width="30" height="7" fill="${i % 2 ? '#f4a62a' : '#f7f4ee'}"/>`;
    if (lit) lights += lamp(95, 314, 3, '#f4a62a', 16, 0.45);
  } else if (lit) {
    lights += snowfall(rnd, W, H, 70, 1.2, 2.2, night ? 0.7 : 0.85);
  } else {
    s += snowfall(rnd, W, H, 70, 1.2, 2.2, 0.85);
  }
  return { s, lights };
}

/**
 * The far north (Gate Arc Act 4, 4-9 / 4-10 story backgrounds; snow theme variants). `north`: the
 * frozen villages under deep snow and a cold overcast sky: far peaks, snowy hills, snow pines, huts
 * with heavy snow on their roofs, icicles and dark windows, and in the middle a ring of stones where
 * a fire is going out (a few embers). `northBridge`: the snow bridge in a blizzard: two cliff sides
 * of the ravine, the old stone span across it on its arch, the Brigade's folding deck beside it (navy
 * treadway, amber rails), a few lanterns crossing, snow driving across everything. No people.
 * @returns {{ s: string, lights: string }}
 */
function northScene(rnd, id, W, H, bridge) {
  let s = '';
  let lights = '';
  if (!bridge) {
    // a pale sun behind the overcast, far peaks, snowy hills and a line of snow pines
    s += '<circle cx="820" cy="110" r="70" fill="#f4f1e8" opacity="0.3"/><circle cx="820" cy="110" r="30" fill="#f4f1e8" opacity="0.7"/>';
    s += peaks(rnd, W, 200, 140, H, '#a9b8cc', 6, '#ffffff');
    s += peaks(rnd, W, 245, 80, H, '#93a5bb', 8, '#f4f8fc');
    s += hills(rnd, W, 285, 30, H, '#e3eaf2');
    for (let x = -10; x < W + 20; x += 40 + rnd() * 30) s += pine(x, 302 - rnd() * 10, 0.5 + rnd() * 0.3, '#3f6658', true);
    // the snowfield, blue drift shadows across it
    s += '<path d="M0 310Q300 296 560 312T1100 306V400H0Z" fill="#eef3f8"/>';
    for (let i = 0; i < 9; i++) s += `<path d="M${n(rnd() * W)} ${n(330 + rnd() * 60)}q60 -12 120 0" stroke="#c9d6e4" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    // the huts: dark timber, snow heaped on the roofs and round the walls, icicles, cold windows
    for (const [x, y, w, h] of [[110, 334, 120, 56], [300, 322, 96, 46], [740, 326, 110, 50], [940, 340, 130, 58]]) {
      const l = x - w / 2;
      const top = y - h;
      s += `<rect x="${n(l)}" y="${n(top)}" width="${w}" height="${h}" fill="#5a4636"/>`;
      s += `<path d="M${n(l)} ${n(top + h * 0.35)}h${w}M${n(l)} ${n(top + h * 0.7)}h${w}" stroke="#46372b" stroke-width="2"/>`;
      s += `<rect x="${n(x - w * 0.12)}" y="${n(y - h * 0.62)}" width="${n(w * 0.24)}" height="${n(h * 0.62)}" fill="#2a2228"/>`;
      s += `<rect x="${n(l + w * 0.1)}" y="${n(top + h * 0.22)}" width="${n(w * 0.18)}" height="${n(h * 0.24)}" fill="#3a3f4e"/><rect x="${n(x + w * 0.22)}" y="${n(top + h * 0.22)}" width="${n(w * 0.18)}" height="${n(h * 0.24)}" fill="#3a3f4e"/>`;
      s += `<path d="M${n(l - 16)} ${n(top + 6)}L${n(x)} ${n(top - h * 0.72)}L${n(x + w / 2 + 16)} ${n(top + 6)}Z" fill="#f4f8fc" stroke="#d4dee9" stroke-width="3"/>`;
      let ice = '';
      for (let k = l - 8; k < x + w / 2 + 8; k += 12) ice += `M${n(k)} ${n(top + 6)}l3 ${n(6 + rnd() * 8)}l3 ${n(-6 - rnd() * 8)}`;
      s += `<path d="${ice}" fill="#dbeaf6"/>`;
      s += `<ellipse cx="${n(x)}" cy="${n(y + 2)}" rx="${n(w * 0.66)}" ry="7" fill="#f7fafd"/>`;
    }
    // the fire going out: a ring of stones, grey ash and a few embers
    s += '<ellipse cx="530" cy="352" rx="46" ry="11" fill="#8d96a3"/><ellipse cx="530" cy="350" rx="34" ry="7" fill="#5e6470"/>';
    lights += '<circle cx="530" cy="346" r="26" fill="#ff9a4a" opacity="0.22"/>';
    for (const [x, y] of [[520, 349], [532, 346], [542, 350], [528, 352]]) lights += `<circle cx="${x}" cy="${y}" r="2.6" fill="#ff8a3d" opacity="0.9"/>`;
    s += snowfall(rnd, W, H, 50, 1.2, 2.2, 0.85);
    return { s, lights };
  }
  // the snow bridge in a blizzard: faint far peaks behind a white haze
  s += peaks(rnd, W, 150, 100, H, '#b4c0ce', 5, '#ffffff');
  s += `<rect width="${W}" height="${H}" fill="#e6ebf0" opacity="0.4"/>`;
  // the ravine: the dark gap between two cliff sides, snow on their rims, mist down in it
  s += '<path d="M330 212L380 400H720L770 216Q550 246 330 212Z" fill="#2e3640"/><path d="M360 300H740" stroke="#aab4c0" stroke-width="22" opacity="0.3"/>';
  s += '<path d="M0 400V200Q120 186 260 196L340 212 380 400Z" fill="#6f7884"/><path d="M1100 400V194Q980 182 840 198L760 216 720 400Z" fill="#6f7884"/>';
  s += '<path d="M0 202Q120 188 260 198L340 214 330 224Q250 210 120 204T0 216Z" fill="#f4f8fc"/><path d="M1100 196Q980 184 840 200L760 218 772 228Q850 212 980 200T1100 210Z" fill="#f4f8fc"/>';
  // the old stone bridge: one arch across the gap, stone spandrels up to the deck, snow along its top
  s += '<path d="M346 218H754V312H730Q550 154 370 312H346Z" fill="#7f7b74"/><path d="M370 312Q550 154 730 312" stroke="#6a665f" stroke-width="6" fill="none"/>';
  s += '<rect x="300" y="196" width="500" height="22" fill="#8d8a84"/><rect x="300" y="190" width="500" height="7" fill="#f4f8fc"/>';
  for (let x = 306; x < 800; x += 38) s += `<rect x="${x}" y="182" width="18" height="10" fill="#8d8a84"/><rect x="${x}" y="179" width="18" height="4" fill="#f4f8fc"/>`;
  // the Brigade's folding deck beside it, nearer: navy treadway sections on trusses, amber rails
  s += '<rect x="320" y="256" width="460" height="14" fill="#3a465c"/>';
  let truss = '';
  for (let x = 320; x < 780; x += 46) truss += `M${x} 270L${x + 23} 290L${x + 46} 270`;
  s += `<path d="${truss}" stroke="#2b3a5c" stroke-width="4" fill="none"/><path d="M320 290H780" stroke="#2b3a5c" stroke-width="4"/>`;
  for (let x = 320; x <= 780; x += 46) s += `<rect x="${x - 1.5}" y="242" width="3" height="16" fill="#2b3a5c"/>`;
  s += '<path d="M320 244H780" stroke="#f4a62a" stroke-width="4"/><path d="M320 256H780" stroke="#f4a62a" stroke-width="2"/>';
  // lanterns of the column, still crossing the old span
  for (const x of [420, 470, 560, 610, 700]) lights += lamp(x, 178, 2.4, '#ffc46b', 10, 0.4);
  // the blizzard: a haze over everything, snow driving across, flakes
  s += `<rect width="${W}" height="${H}" fill="#eef2f6" opacity="0.28"/>`;
  let streaks = '';
  for (let i = 0; i < 90; i++) streaks += `M${n(rnd() * W)} ${n(rnd() * H)}l${n(14 + rnd() * 14)} ${n(4 + rnd() * 4)}`;
  lights += `<path d="${streaks}" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.65"/>`;
  lights += snowfall(rnd, W, H, 80, 1.2, 2.6, 0.9);
  return { s, lights };
}

/**
 * Time of day for a story backdrop (themeBackdropSVG `time`): its sky, then a wash over the whole
 * scene; the scene's `lights` (lamps, lit windows, embers) are drawn after the wash so they stay bright.
 */
export const TIME_OF_DAY = {
  dusk: { sky: ['#5a4a8e', '#ffa070'], wash: '#5b3c82', washOp: 0.24 },
  night: { sky: ['#0a1430', '#2a3c68'], wash: '#0b1634', washOp: 0.52 },
};

/** A variant's own sky (the far north is overcast, the bridge in a blizzard). */
const VARIANT_SKY = {
  north: ['#7d93b4', '#dde5ee'],
  northBridge: ['#8e9cae', '#e2e8ee'],
};

/**
 * Banner scene for a chapter / map theme (2.75:1). `variant` adds a place in the foreground (campus: 'jetty' the
 * rowing club's jetty, 'lamp' the breakwater and the old iron lamp; story backgrounds of 2-7 and 2-10; city:
 * 'oldtown' / 'burning' (Act 3), 'highway' / 'highwaySnow' (Act 4's mountain highway, its tunnel mouth in snow);
 * snow: 'north' / 'northBridge' (Act 4's frozen villages, the snow bridge in a blizzard)). `time` ('dusk' /
 * 'night', TIME_OF_DAY) re-lights it for a story scene: the sky, a wash, and the scene's lamps lit over it.
 */
export function themeBackdropSVG(theme, { variant = null, time = null } = {}) {
  const key = THEME_SKY[theme] ? theme : 'sakura';
  const W = 1100;
  const H = 400;
  const rnd = seeded(`theme-${key}`);
  const tod = TIME_OF_DAY[time] || null;
  const [top, bottom] = tod?.sky || VARIANT_SKY[variant] || THEME_SKY[key];
  // (the time is in the id: a day and a dusk copy of one place can be on screen together mid-fade)
  const id = `tb-${key}${variant ? `-${variant}` : ''}${tod ? `-${time}` : ''}`;
  let lights = '';
  let s = `<defs>${linGrad(`${id}-sky`, [[0, top], [1, bottom]])}${radGrad(`${id}-glow`, [[0, '#ffffff', 0.9], [1, '#ffffff', 0]])}</defs>`;
  s += `<rect width="${W}" height="${H}" fill="url(#${id}-sky)"/>`;
  switch (key) {
    case 'sakura':
      s += `<circle cx="820" cy="110" r="140" fill="url(#${id}-glow)"/>` + cloud(200, 90, 1.1) + cloud(700, 60, 0.8);
      s += hills(rnd, W, 260, 60, H, '#b8e0a0') + hills(rnd, W, 310, 50, H, '#8fd16a');
      s += sakuraTree(160, 330, 1.3) + sakuraTree(940, 340, 1.5) + sakuraTree(560, 320, 0.8);
      s += `<path d="M0 370Q550 330 1100 380V400H0Z" fill="#f7ead0"/>` + petals(rnd, W, H, 30);
      break;
    case 'lake':
      s += `<circle cx="820" cy="110" r="46" fill="#fff6e0"/><circle cx="820" cy="110" r="120" fill="url(#${id}-glow)" opacity="0.6"/>`;
      s += hills(rnd, W, 230, 50, 260, '#6a7fb8');
      s += `<rect y="250" width="${W}" height="150" fill="#5f8fd6"/><path d="M790 260h60M770 290h100M800 320h40" stroke="#fff6e0" stroke-width="4" stroke-linecap="round" opacity="0.8"/>`;
      s += `<path d="M0 300Q120 270 260 300T520 340Q600 362 650 400H0Z" fill="#4f8c5b"/><path d="M640 360h300l-20 14H660z" fill="#a47148"/><path d="M700 360v-40M880 360v-30" stroke="#a47148" stroke-width="5"/><circle cx="700" cy="314" r="10" fill="#ffb347"/><circle cx="880" cy="324" r="10" fill="#ffb347"/>`;
      s += stars(rnd, W, 200, 30);
      break;
    case 'shrine':
      s += `<circle cx="300" cy="120" r="150" fill="url(#${id}-glow)"/>` + hills(rnd, W, 250, 70, H, '#8bbf7a');
      s += torii(550, 330, 1.6);
      s += `<path d="M380 400L500 330H600L720 400Z" fill="#e6d6b8"/>`;
      for (const x of [150, 250, 850, 950]) s += `<rect x="${x - 10}" y="290" width="20" height="60" fill="#bdb6a8"/><rect x="${x - 22}" y="270" width="44" height="22" rx="4" fill="#cfc8ba"/><rect x="${x - 8}" y="296" width="16" height="12" fill="#ffd166"/>`;
      for (const x of [60, 1040]) s += pine(x, 380, 2.2, '#3f7d4f');
      s += petals(rnd, W, H, 14);
      break;
    case 'mountain':
      s += cloud(240, 90, 1) + peaks(rnd, W, 260, 180, H, '#8aa0bf', 5, '#ffffff') + peaks(rnd, W, 320, 110, H, '#6d8a6a', 7) + hills(rnd, W, 360, 30, H, '#a9c98a');
      for (const x of [120, 300, 820, 990]) s += pine(x, 380, 1.2, '#2f6b4a');
      s += '<path d="M480 300h160v12H480z" fill="#8d6e63"/><path d="M490 312v40M630 312v40" stroke="#8d6e63" stroke-width="6"/>';
      break;
    case 'marsh':
      s += hills(rnd, W, 260, 40, H, '#5f7f58') + `<rect y="300" width="${W}" height="100" fill="#4f7f6a"/>`;
      for (const x of [140, 420, 760, 1000]) s += `<path d="M${x} 330q-10-80 20-140M${x + 20} 200q-60 10-80 90M${x + 20} 200q60 10 80 90M${x + 20} 200q-20 30-30 100M${x + 20} 200q30 30 30 100" stroke="#3d6b3a" stroke-width="6" fill="none" stroke-linecap="round"/>`;
      s += '<path d="M200 350h700" stroke="#a47148" stroke-width="12"/><path d="M200 350h700" stroke="#c49a6c" stroke-width="4" stroke-dasharray="20 6"/>';
      for (let i = 0; i < 24; i++) s += `<circle cx="${n(rnd() * W)}" cy="${n(180 + rnd() * 200)}" r="3" fill="#e9ffb0" opacity="0.9"/>`;
      s += `<rect y="220" width="${W}" height="120" fill="#ffffff" opacity="0.18"/>`;
      break;
    case 'foundry':
      s += `<rect y="250" width="${W}" height="150" fill="#5c6370"/>`;
      for (const x of [120, 300, 760, 980]) s += `<rect x="${x}" y="140" width="40" height="120" fill="#46505c"/><circle cx="${x + 20}" cy="120" r="26" fill="#c0c7d6" opacity="0.6"/><circle cx="${x + 46}" cy="90" r="34" fill="#c0c7d6" opacity="0.4"/>`;
      s += `<g fill="#ffb703" stroke="#7a5200" stroke-width="3"><path d="${gearPath(560, 250, 90, 70, 12)}"/><path d="${gearPath(700, 300, 50, 38, 9)}"/></g><circle cx="560" cy="250" r="30" fill="#5c6370"/><circle cx="700" cy="300" r="16" fill="#5c6370"/>`;
      s += '<path d="M0 340H1100" stroke="#ffb703" stroke-width="12" stroke-dasharray="40 30"/>';
      break;
    case 'festival':
      s += stars(rnd, W, 200, 40);
      for (const [x, y, c] of [[220, 110, '#ffd166'], [820, 80, '#ff7ab6'], [560, 60, '#7ee8fa']]) {
        let fw = '';
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          fw += `M${x} ${y}L${n(x + Math.cos(a) * 60)} ${n(y + Math.sin(a) * 60)}`;
        }
        s += `<path d="${fw}" stroke="${c}" stroke-width="3" stroke-linecap="round" opacity="0.9"/><circle cx="${x}" cy="${y}" r="70" fill="${c}" opacity="0.15"/>`;
      }
      s += `<rect y="300" width="${W}" height="100" fill="#3a2a35"/>`;
      for (const x of [100, 380, 660, 940]) s += `<path d="M${x} 300h140v-50l-70-30-70 30z" fill="#ff5d73" stroke="#7a1f2b" stroke-width="3"/><path d="M${x} 250h140" stroke="#fff" stroke-width="8" stroke-dasharray="14 14"/><rect x="${x + 20}" y="270" width="100" height="30" fill="#ffe8b8"/>`;
      s += lanternString(W, 170, 12, ['#ff5d73', '#ffd166', '#ff9f1c']);
      break;
    case 'volcano':
      s += `<path d="M300 400L520 140h90L840 400Z" fill="#4a2a2a"/><path d="M520 140h90l-20 40-25-15-25 20z" fill="#ff6b35"/><circle cx="565" cy="130" r="120" fill="#ff6b35" opacity="0.18"/>`;
      s += '<path d="M560 160q-20 80 10 140t-20 100" stroke="#ff8a3d" stroke-width="10" fill="none" opacity="0.85"/>';
      s += peaks(rnd, W, 340, 90, H, '#3a2222', 7);
      for (let i = 0; i < 30; i++) s += `<circle cx="${n(rnd() * W)}" cy="${n(rnd() * 360)}" r="${n(1.5 + rnd() * 2.5)}" fill="#ffb347" opacity="${n(0.5 + rnd() * 0.5)}"/>`;
      s += '<path d="M760 120c40-30 90-20 110 10 30-20 70 0 60 30-60 0-140-10-170-40z" fill="#2a1a1a" opacity="0.8"/>';
      break;
    case 'snow':
      if (variant === 'north' || variant === 'northBridge') {
        const north = northScene(rnd, id, W, H, variant === 'northBridge');
        s += north.s;
        lights += north.lights;
        break;
      }
      s += peaks(rnd, W, 260, 150, H, '#c6dcf0', 5, '#ffffff') + hills(rnd, W, 330, 40, H, '#f4fbff');
      for (const x of [100, 220, 860, 1000, 520]) s += pine(x, 380, 1.4, '#3f7d5c', true);
      s += snowfall(rnd, W, H, 60, 1.5, 2.5, 0.9);
      break;
    case 'night':
      s += stars(rnd, W, 260, 90) + `<path d="M860 70a50 50 0 1 0 40 80 40 40 0 1 1-40-80z" fill="#fff6c4"/>`;
      s += hills(rnd, W, 290, 60, H, '#1f3358') + hills(rnd, W, 340, 40, H, '#2c4560');
      for (let i = 0; i < 18; i++) s += `<circle cx="${n(rnd() * W)}" cy="${n(240 + rnd() * 140)}" r="3" fill="#e9ffb0" opacity="0.85"/>`;
      for (const x of [200, 900]) s += `<rect x="${x - 8}" y="300" width="16" height="50" fill="#6c7a89"/><circle cx="${x}" cy="292" r="16" fill="#ffd166" opacity="0.9"/><circle cx="${x}" cy="292" r="40" fill="#ffd166" opacity="0.2"/>`;
      break;
    case 'arena':
      s += cloud(220, 80, 1) + cloud(860, 110, 0.9);
      s += `<path d="M80 400V200Q550 120 1020 200V400Z" fill="#e3cfa0" stroke="#a88c5c" stroke-width="4"/>`;
      for (let i = 0; i < 9; i++) {
        const x = 130 + i * 100;
        s += `<path d="M${x} 330v-60a30 30 0 0 1 60 0v60z" fill="#a88c5c" opacity="0.8"/>`;
      }
      s += `<path d="M80 210Q550 130 1020 210" stroke="#c1121f" stroke-width="10" fill="none"/>`;
      for (const x of [140, 960]) s += `<path d="M${x} 210v-90" stroke="#5c4a32" stroke-width="5"/><path d="M${x} 120h50l-12 14 12 14h-50z" fill="#ff5d73"/>`;
      s += `<rect y="340" width="${W}" height="60" fill="#f2e2bb"/>`;
      break;
    case 'city': {
      if (variant === 'oldtown' || variant === 'burning') {
        s += oldTownScene(rnd, id, W, H, variant === 'burning');
        break;
      }
      if (variant === 'highway' || variant === 'highwaySnow') {
        const hw = highwayScene(rnd, id, W, H, variant === 'highwaySnow', tod ? time : null);
        s += hw.s;
        lights += hw.lights;
        break;
      }
      // Itomachi by day: a warm skyline (offices, flats, a clock tower), utility poles and wires,
      // a row of shop awnings and the dark street in front
      s += cloud(240, 80, 1) + cloud(820, 60, 0.8);
      let x = 0;
      while (x < W) {
        const w = 60 + rnd() * 70;
        const h = 90 + rnd() * 150;
        const c = ['#d9c7aa', '#c9b79c', '#e6d6bc', '#b8674e', '#cfd8e0'][Math.floor(rnd() * 5)];
        s += `<rect x="${n(x)}" y="${n(300 - h)}" width="${n(w)}" height="${n(h + 20)}" fill="${c}"/>`;
        for (let wy = 300 - h + 14; wy < 290; wy += 22) s += `<rect x="${n(x + 8)}" y="${n(wy)}" width="${n(w - 16)}" height="8" fill="#9cc4d8" opacity="0.75"/>`;
        x += w + 4 + rnd() * 10;
      }
      s += '<rect x="520" y="90" width="44" height="220" fill="#b8674e"/><path d="M510 90h64l-32-40z" fill="#5f646c"/><circle cx="542" cy="120" r="16" fill="#f7f4ee" stroke="#34405e" stroke-width="3"/>';
      s += `<rect y="300" width="${W}" height="100" fill="#ece2d2"/>`;
      for (let i = 0; i < 8; i++) {
        const sx = 20 + i * 136;
        s += `<rect x="${sx}" y="250" width="120" height="60" fill="#f3e7d0"/><path d="M${sx - 4} 262h128l-10 18H${sx + 6}z" fill="${['#4f9a62', '#d9604a', '#3d6a9a', '#e3b04a'][i % 4]}"/><rect x="${sx + 14}" y="284" width="92" height="22" fill="#9cc4d8"/>`;
      }
      for (const px of [90, 430, 770, 1060]) s += `<rect x="${px - 4}" y="140" width="8" height="200" fill="#cbc4b8"/><rect x="${px - 24}" y="150" width="48" height="6" fill="#8f887c"/>`;
      s += '<path d="M0 156Q260 176 430 156T770 156T1100 156" stroke="#45424a" stroke-width="2" fill="none"/><path d="M0 162Q260 184 430 162T770 162T1100 162" stroke="#45424a" stroke-width="2" fill="none"/>';
      s += `<rect y="340" width="${W}" height="60" fill="#4b505b"/><path d="M0 370H1100" stroke="#f4f1ea" stroke-width="5" stroke-dasharray="40 30"/>`;
      s += sakuraTree(150, 340, 0.9) + sakuraTree(980, 345, 1.0) + petals(rnd, W, H, 18);
      break;
    }
    case 'campus': {
      // Hilltop High at night: stars and a moon, the clock tower with its lit face, the gym's
      // curved roof and the classroom wings with warm windows, cherry trees, and the lake below
      // with the searchlight's beam on the water
      s += stars(rnd, W, 200, 70) + '<path d="M150 64a40 40 0 1 0 32 64 32 32 0 1 1-32-64z" fill="#fff6c4"/>';
      s += hills(rnd, W, 236, 40, 260, '#22345c');
      // the wings: cream blocks, a navy band, warm windows (two in three lit)
      for (const [x, y, w, h] of [[60, 168, 300, 92], [690, 150, 360, 110], [380, 196, 120, 64]]) {
        s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#c9c1b2"/><rect x="${x}" y="${y}" width="${w}" height="8" fill="#3d5a8a"/>`;
        for (let wy = y + 18; wy < y + h - 12; wy += 30) {
          for (let wx = x + 12; wx < x + w - 24; wx += 36) s += `<rect x="${wx}" y="${wy}" width="26" height="18" fill="${rnd() < 0.66 ? '#ffd98f' : '#4a5f86'}"/>`;
        }
      }
      // the gym (Shelter 3): a curved roof, tall window slots and the pink banner
      s += '<path d="M500 260V180Q590 140 680 180V260Z" fill="#d8cfbf"/><path d="M496 182Q590 136 684 182" stroke="#6f8fa8" stroke-width="12" fill="none"/>';
      for (let i = 0; i < 5; i++) s += `<rect x="${518 + i * 32}" y="196" width="14" height="44" fill="#ffd98f" opacity="0.9"/>`;
      s += '<rect x="540" y="244" width="100" height="14" fill="#f7f4ee"/><rect x="540" y="249" width="100" height="4" fill="#ff7aa2"/>';
      // the clock tower with its lit face
      s += `<rect x="410" y="70" width="56" height="190" fill="#d8cfbf"/><rect x="406" y="128" width="64" height="8" fill="#3d5a8a"/><path d="M402 70h72l-36-42z" fill="#6f8fa8"/><circle cx="438" cy="98" r="18" fill="#fff3d0"/><circle cx="438" cy="98" r="44" fill="url(#${id}-glow)" opacity="0.35"/><path d="M438 98V86M438 98h9" stroke="#3a3d46" stroke-width="3" stroke-linecap="round"/>`;
      // the lakeshore: lawn, the lake, the searchlight's beam on the water
      s += '<rect y="258" width="1100" height="20" fill="#2f5a46"/>';
      s += '<rect y="276" width="1100" height="124" fill="#1f4f7a"/><path d="M0 284H1100" stroke="#8fb4d6" stroke-width="2" opacity="0.6"/>';
      s += '<path d="M930 282L560 360 640 380Z" fill="#eaf2ff" opacity="0.2"/><ellipse cx="600" cy="370" rx="70" ry="16" fill="#eaf2ff" opacity="0.35"/>';
      s += '<rect x="924" y="250" width="12" height="32" fill="#6b7480"/><circle cx="930" cy="250" r="9" fill="#fff2cc"/>';
      for (const [x, y] of [[620, 330], [700, 352], [840, 320], [300, 340], [210, 360]]) s += `<path d="M${x - 20} ${y}h40" stroke="#ffd98f" stroke-width="3" opacity="0.5" stroke-linecap="round"/>`;
      s += sakuraTree(40, 270, 0.8) + sakuraTree(1060, 268, 0.9);
      for (let i = 0; i < 22; i++) s += `<circle cx="${n(rnd() * W)}" cy="${n(240 + rnd() * 140)}" r="2.6" fill="#e9ffb0" opacity="0.85"/>`;
      if (variant === 'jetty') {
        // the rowing club's jetty running out into the lake, a rowing eight moored beside it, a lantern on a post
        s += '<path d="M250 400L470 300H560L520 400Z" fill="#7d5a3c"/>';
        for (let k = 0; k < 7; k++) s += `<path d="M${n(262 + k * 34)} ${n(396 - k * 14)}H${n(522 - k * 6)}" stroke="#5e4330" stroke-width="3"/>`;
        s += '<path d="M600 352q130 -10 260 0q-130 14 -260 0z" fill="#e8e1d4"/><path d="M620 352H840" stroke="#3d5a8a" stroke-width="3"/>';
        s += '<rect x="548" y="250" width="8" height="64" fill="#3a3d46"/><rect x="540" y="236" width="24" height="18" rx="3" fill="#ffd98f"/>';
        s += `<circle cx="552" cy="245" r="40" fill="url(#${id}-glow)" opacity="0.4"/>`;
      } else if (variant === 'lamp') {
        // the stone breakwater out into the lake and, at its head, the old iron lamp: tall, dark and cold
        s += '<path d="M120 400L560 296H650L660 400Z" fill="#8f8679"/><path d="M560 296H650" stroke="#bdb4a4" stroke-width="5"/>';
        s += '<ellipse cx="610" cy="300" rx="58" ry="12" fill="#a69d8d"/><rect x="600" y="140" width="16" height="158" fill="#3a3d46"/>';
        s += '<path d="M586 140h44l-8 -42h-28z" fill="none" stroke="#3a3d46" stroke-width="6"/><path d="M584 98h48l-24 -20z" fill="#3a3d46"/>';
        s += '<path d="M598 104h20l-4 30h-12z" fill="#2a3442"/><circle cx="608" cy="120" r="5" fill="#8fa3bf" opacity="0.7"/>';
      }
      break;
    }
    default:
      break;
  }
  // the time of day: a wash over the scene, then its lights over the wash
  if (tod) s += `<rect width="${W}" height="${H}" fill="${tod.wash}" opacity="${tod.washOp}"/>`;
  s += lights;
  // soft vignette for text legibility
  s += `<rect width="${W}" height="${H}" fill="url(#${id}-sky)" opacity="0.08"/>`;
  return svg(W, H, s, `${key} scenery`);
}

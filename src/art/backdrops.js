// Large scenic backdrops (CONTRACTS §8): the lobby's seaside classroom and one banner
// scene per map theme. Original artwork from simple layered shapes; deterministic.

import { n, darken, linGrad, radGrad, seeded, petalPath, blossom, sparklePath } from './svgUtil.js';
import { gearPath } from './icons/glyphs.js';

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
};

/** Banner scene for a chapter / map theme (2.75:1). */
export function themeBackdropSVG(theme) {
  const key = THEME_SKY[theme] ? theme : 'sakura';
  const W = 1100;
  const H = 400;
  const rnd = seeded(`theme-${key}`);
  const [top, bottom] = THEME_SKY[key];
  const id = `tb-${key}`;
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
      s += peaks(rnd, W, 260, 150, H, '#c6dcf0', 5, '#ffffff') + hills(rnd, W, 330, 40, H, '#f4fbff');
      for (const x of [100, 220, 860, 1000, 520]) s += pine(x, 380, 1.4, '#3f7d5c', true);
      for (let i = 0; i < 60; i++) s += `<circle cx="${n(rnd() * W)}" cy="${n(rnd() * H)}" r="${n(1.5 + rnd() * 2.5)}" fill="#ffffff" opacity="0.9"/>`;
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
    default:
      break;
  }
  // soft vignette for text legibility
  s += `<rect width="${W}" height="${H}" fill="url(#${id}-sky)" opacity="0.08"/>`;
  return svg(W, H, s, `${key} scenery`);
}

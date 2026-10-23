// [ui-ink] The UI v2 "Ink & Paper" line glyphs (notes/ui-v2/UI_V2_DIRECTION.md section 9): an ES module port of the
// approved kit's glyphs.js (notes/ui-v2/kit/glyphs.js), the same geometry.
//
// The set: the recommended icon set of the home v2 judging (a map, a coin with a five-lobed sakura, a shirt for the
// Gear tab, a ticket with one perforation line, settings with arcs between six teeth, the gate chapter emblem) plus the
// glyphs the v2 screens need: 86 glyphs in five groups (GLYPH_GROUPS), and three drawn for the mock-ups (armorbreak,
// pierce, lantern).
// Spec: 24 x 24 grid, 2 px padding (20 x 20 live area); 1.5 px round strokes (1.25 px at 16 px); currentColor only; no
// fills except dots of 2 px or more and the play triangle. Frame shapes (mail, clipboard, ticket, image, calendars,
// id card, monitor, store) cut their top-right corner at 45 degrees by 2.5 px, the panel chamfer in miniature. Glyphs
// are never slanted; the -8 degree slant lives on plates.
// Geometry: an open-source line icon set (ISC licence; its earlier-set parts MIT), restyled; both licence texts are in
// public/licenses/ and named in Settings > About. Our own drawings: coin, gem, energy, store, sakura, armorbreak,
// pierce, lantern and every chapter emblem.
//
// Use: lineGlyph('mail') returns the SVG markup (class "g lg": the kit's sizing classes s / xs / l apply to "g");
// emblemSvg('gate', { size: 64 }) a chapter emblem; hydrateGlyphs(root) swaps <i data-g="mail"> and
// <i data-emblem="gate"> for their SVGs. components.js glyph() and kit.js ico() look a game icon name up here first
// (lineFor(), through LINE_ALIASES) on the menus (the surface modes); game-data icons keep their own drawings.

const f = (n) => Math.round(n * 100) / 100;
const P = (d) => `<path d="${d}"/>`;
const C = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
// a filled dot (≥ 2 px): its own fill, so it reads the same without the kit's CSS
const DOT = (cx, cy) => `<circle class="fill" cx="${cx}" cy="${cy}" r="1.1" fill="currentColor" stroke="none"/>`;

/** Settings: six teeth with arcs between them (a calmer silhouette than straight valleys). */
function settings() {
  const pt = (r, a) => {
    const t = (a * Math.PI) / 180;
    return `${f(12 + r * Math.cos(t))} ${f(12 + r * Math.sin(t))}`;
  };
  const rt = 9.6;
  const rr = 7.3;
  let d = '';
  for (let i = 0; i < 6; i++) {
    const c = i * 60 - 90;
    d += `${i ? 'L' : 'M'}${pt(rr, c - 17)} L${pt(rt, c - 10)} L${pt(rt, c + 10)} L${pt(rr, c + 17)} A${rr} ${rr} 0 0 1 ${pt(rr, c + 43)} `;
  }
  return P(`${d}Z`) + C(12, 12, 3);
}

/** The coin (ours): a 20 px ring with a five-lobed sakura outline inside (it still reads as a flower at 16 px). */
function coin() {
  const d = 3.0;
  const r = 2.25;
  const t = d * Math.cos(Math.PI / 5) + Math.sqrt(r * r - (d * Math.sin(Math.PI / 5)) ** 2);
  const pts = [];
  for (let k = 0; k < 5; k++) {
    const a = ((-90 + 72 * k + 36) * Math.PI) / 180;
    pts.push([f(12 + t * Math.cos(a)), f(12 + t * Math.sin(a))]);
  }
  let p = `M${pts[4][0]} ${pts[4][1]}`;
  for (let k = 0; k < 5; k++) p += `A${r} ${r} 0 0 1 ${pts[k][0]} ${pts[k][1]}`;
  return C(12, 12, 9.25) + P(`${p}Z`);
}

/**
 * The gem (ours): the gem item art in line, a faceted five-petal sakura crystal (five straight-edged petals with a
 * notched tip, a crease from each notch to a small centre pentagon). Angular where the coin's sakura is round, and no
 * ring, so the two never read alike.
 */
function gem() {
  const cx = 12;
  const cy = 12.35;
  const rv = 4.7;
  const w = 4.3;
  const rs = 7.5;
  const nw = 2.0;
  const rt = 9.7;
  const rn = 7.9;
  const pr = 2.3;
  const pt = (th, a, r) => {
    const t = (th * Math.PI) / 180;
    const c = Math.cos(t);
    const s = Math.sin(t);
    return `${f(cx + r * c - a * s)} ${f(cy + r * s + a * c)}`;
  };
  let outline = '';
  let creases = '';
  let centre = '';
  for (let i = 0; i < 5; i++) {
    const th = -90 + 72 * i; // petal axis, the top petal first
    outline += `${i ? 'L' : 'M'}${pt(th - 36, 0, rv)}L${pt(th, -w, rs)}L${pt(th, -nw, rt)}L${pt(th, 0, rn)}L${pt(th, nw, rt)}L${pt(th, w, rs)}`;
    creases += P(`M${pt(th, 0, pr)}L${pt(th, 0, rn)}`);
    centre += `${i ? 'L' : 'M'}${pt(th, 0, pr)}`;
  }
  return P(`${outline}Z`) + creases + P(`${centre}Z`);
}

/** Five notched sakura petals (ours): the academy mail crest, the chapter 1 emblem. */
function sakura(cx, cy, s) {
  let out = '';
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 * Math.PI) / 180;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const pt = (x, y) => `${f(cx + (x * c - y * sn) * s)} ${f(cy + (x * sn + y * c) * s)}`;
    out += P(`M${pt(0, 0)}C${pt(-2.5, -1.4)} ${pt(-2.9, -4.3)} ${pt(-1.15, -5.5)}L${pt(0, -4.6)}L${pt(1.15, -5.5)}C${pt(2.9, -4.3)} ${pt(2.5, -1.4)} ${pt(0, 0)}Z`);
  }
  return out;
}

/** Every glyph's inner markup (24 x 24 viewBox). */
export const LINE_GLYPHS = Object.freeze({
  // ----- home rail (menu) -----
  swords: '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/>',
  cap: P('M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z') + P('M22 10v6') + P('M6 12.5V16a6 3 0 0 0 12 0v-3.5'),
  sparkles: P('M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.13 1.58a.5.5 0 0 1 0 .96l-6.13 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z') + P('M20 3v4') + P('M22 5h-4'),
  clipboard: '<rect width="8" height="4" x="8" y="2" rx="1"/>' + P('M16 4h1.5L20 6.5V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2') + P('m9 14 2 2 4-4'),
  flag: P('M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z') + P('M4 22v-7'),
  bag: P('M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z') + P('M3 6h18') + P('M16 10a4 4 0 0 1-8 0'),
  users: P('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2') + C(9, 7, 4) + P('M22 21v-2a4 4 0 0 0-3-3.87') + P('M16 3.13a4 4 0 0 1 0 7.75'),
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  // ----- chrome -----
  chat: P('M7.9 20A9 9 0 1 0 4 16.1L2 22Z'),
  mail: P('M4 4h15.5L22 6.5V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z') + P('m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7'),
  settings: settings(),
  house: P('M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8') + P('M3 10a2 2 0 0 1 .71-1.53l7-6a2 2 0 0 1 2.58 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'),
  back: P('m12 19-7-7 7-7') + P('M19 12H5'),
  plus: P('M5 12h14') + P('M12 5v14'),
  minus: P('M5 12h14'),
  x: P('M18 6 6 18') + P('m6 6 12 12'),
  eyeoff: P('M10.73 5.08a10.74 10.74 0 0 1 11.2 6.57 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.44 2.49') + P('M14.08 14.16a3 3 0 0 1-4.24-4.24') + P('M17.48 17.5a10.75 10.75 0 0 1-15.42-5.15 1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14') + P('m2 2 20 20'),
  image: P('M5 3h13.5L21 5.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z') + C(9, 9, 2) + P('m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21'),
  megaphone: P('m3 11 18-5v12L3 14v-3z') + P('M11.6 16.8a3 3 0 1 1-5.8-1.6'),
  bell: P('M10.27 21a2 2 0 0 0 3.46 0') + P('M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33'),
  maximize: '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/>',
  info: C(12, 12, 10) + P('M12 16v-4') + DOT(12, 8),
  help: C(12, 12, 10) + P('M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3') + DOT(12, 17),
  search: P('m21 21-4.34-4.34') + C(11, 11, 7.5),
  funnel: P('M10 20a1 1 0 0 0 .55.9l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .52-1.34L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.74 1.67l7.22 7.99A2 2 0 0 1 10 14z'),
  sort: P('m3 16 4 4 4-4') + P('M7 20V4') + P('M11 4h10') + P('M11 8h7') + P('M11 12h4'),
  check: P('M20 6 9 17l-5-5'),
  lock: '<rect width="16" height="10" x="4" y="11" rx="2"/>' + P('M8 11V7a4 4 0 0 1 8 0v4'),
  chevR: P('m9 18 6-6-6-6'),
  chevL: P('m15 18-6-6 6-6'),
  chevD: P('m6 9 6 6 6-6'),
  chevU: P('m18 15-6-6-6 6'),
  play: '<path class="fill" fill="currentColor" stroke="none" d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5a.8.8 0 0 0-1.2.7z"/>',
  skip: '<polygon points="5 4 15 12 5 20 5 4"/>' + P('M19 5v14'),
  clock: C(12, 12, 10) + P('M12 6v6l4 2'),
  refresh: P('M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8') + P('M21 3v5h-5'),
  swap: P('M8 3 4 7l4 4') + P('M4 7h16') + P('m16 21 4-4-4-4') + P('M20 17H4'),
  cube: P('M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z') + P('m3.3 7 8.7 5 8.7-5') + P('M12 22V12'),
  percent: P('M19 5 5 19') + C(6.5, 6.5, 2.5) + C(17.5, 17.5, 2.5),
  hash: P('M4 9h16') + P('M4 15h16') + P('M10 3 8 21') + P('M16 3l-2 18'),
  login: P('M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4') + P('m10 17 5-5-5-5') + P('M15 12H3'),
  // ----- currencies: chrome only (the top bar). Prices, rewards and shop tiles keep the 3D-flat art -----
  coin: coin(),
  gem: gem(),
  ticket: P('M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7.5L19.5 5H4a2 2 0 0 0-2 2Z') + P('M14 9.5v5'),
  energy: P('M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6l1-8z'),
  // ----- girl page tabs and stats -----
  level: P('m17 11-5-5-5 5') + P('m17 18-5-5-5 5'),
  star: '<polygon points="12 2.5 14.94 8.46 21.5 9.41 16.75 14.04 17.87 20.58 12 17.5 6.13 20.58 7.25 14.04 2.5 9.41 9.06 8.46"/>',
  shirt: P('M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z'),
  tree: C(12, 18, 3) + C(6, 6, 3) + C(18, 6, 3) + P('M18 9v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9') + P('M12 12v3'),
  shield: P('M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'),
  paw: C(11, 4, 2) + C(18, 8, 2) + C(20, 16, 2) + P('M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.05Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z'),
  moon: P('M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'),
  feather: P('M12.67 19a2 2 0 0 0 1.42-.59l6.15-6.17a6 6 0 0 0-8.49-8.49L5.59 9.91A2 2 0 0 0 5 11.33V18a1 1 0 0 0 1 1z') + P('M16 8 2 22') + P('M17.5 15H9'),
  waves: P('M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1') + P('M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1') + P('M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1'),
  sword: P('M14.5 17.5 3 6V3h3l11.5 11.5') + P('m13 19 6-6') + P('m16 16 4 4') + P('m19 21 2-2'),
  gauge: P('m12 14 4-4') + P('M3.34 19a10 10 0 1 1 17.32 0'),
  target: C(12, 12, 10) + C(12, 12, 6) + DOT(12, 12),
  heart: P('M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'),
  zap: P('M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z'),
  sparkle: P('M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.13 1.58a.5.5 0 0 1 0 .96l-6.13 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z'),
  // ----- rails, sections and sheets -----
  daily: P('M8 2v4') + P('M16 2v4') + P('M5 4h13.5L21 6.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z') + P('M3 10h18') + P('m9 16 2 2 4-4'),
  weekly: P('M5 4h13.5L21 6.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z') + P('M16 2v4') + P('M3 10h18') + P('M8 2v4') + P('M17 14h-6') + P('M13 18H7'),
  gift: P('M12 7v14') + P('M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8') + P('M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5') + '<rect x="3" y="7" width="18" height="4" rx="1"/>',
  trophy: P('M10 14.66v1.63a2 2 0 0 1-.98 1.7A5 5 0 0 0 7 21.98') + P('M14 14.66v1.63a2 2 0 0 0 .98 1.7A5 5 0 0 1 17 21.98') + P('M18 9h1.5a1 1 0 0 0 0-5H18') + P('M4 22h16') + P('M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z') + P('M6 9H4.5a1 1 0 0 1 0-5H6'),
  key: P('M2.59 17.41A2 2 0 0 0 2 18.83V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.17a2 2 0 0 0 1.41-.59l.82-.81a6.5 6.5 0 1 0-4-4z') + DOT(16.5, 7.5),
  store: P('M2.5 9 4.5 4H19l2.5 2.5V9Z') + P('M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9') + P('M9.5 21v-5.5h5V21'),
  crown: P('M11.56 3.27a.5.5 0 0 1 .88 0l2.95 5.6a1 1 0 0 0 1.52.29l4.27-3.66a.5.5 0 0 1 .8.52l-2.83 10.25a1 1 0 0 1-.96.73H5.81a1 1 0 0 1-.96-.73L2.02 6.02a.5.5 0 0 1 .8-.52l4.27 3.66a1 1 0 0 0 1.52-.29z') + P('M5 21h14'),
  monitor: P('M4 3h14.5L21 5.5V15a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z') + P('M8 21h8') + P('M12 17v4'),
  volume: P('M11 4.7a.7.7 0 0 0-1.2-.5L6.41 7.59A1.4 1.4 0 0 1 5.42 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.42a1.4 1.4 0 0 1 1 .41l3.38 3.38a.7.7 0 0 0 1.2-.49z') + P('M16 9a5 5 0 0 1 0 6') + P('M19.36 18.36a9 9 0 0 0 0-12.73'),
  idcard: P('M4 5h15.5L22 7.5V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z') + P('M16 10h2') + P('M16 14h2') + P('M6.17 15a3 3 0 0 1 5.66 0') + C(9, 11, 2),
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>' + P('M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z'),
  history: P('M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8') + P('M3 3v5h5') + P('M12 7v5l4 2'),
  hourglass: P('M5 22h14') + P('M5 2h14') + P('M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22') + P('M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2'),
  book: P('M12 7v14') + P('M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z'),
  booktext: P('M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20') + P('M8 11h8') + P('M8 7h6'),
  journal: P('M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4') + P('M2 6h4') + P('M2 10h4') + P('M2 14h4') + P('M2 18h4') + P('M21.38 5.63a1 1 0 1 0-3-3l-5.02 5.01a2 2 0 0 0-.5.86l-.84 2.87a.5.5 0 0 0 .62.62l2.87-.84a2 2 0 0 0 .86-.5z'),
  library: P('m16 6 4 14') + P('M12 6v14') + P('M8 8v12') + P('M4 4v16'),
  user: C(12, 8, 5) + P('M20 21a8 8 0 0 0-16 0'),
  userplus: P('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2') + C(9, 7, 4) + P('M19 8v6') + P('M22 11h-6'),
  backpack: P('M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z') + P('M8 10h8') + P('M8 18h8') + P('M8 22v-6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6') + P('M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2'),
  box: P('M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z') + P('m3.3 7 8.7 5 8.7-5') + P('M12 22V12'),
  timer: P('M10 2h4') + P('m12 14 3-3') + C(12, 14, 8),
  castle: P('M10 5V3') + P('M14 5V3') + P('M15 21v-3a3 3 0 0 0-6 0v3') + P('M18 3v8') + P('M18 5H6') + P('M22 11H2') + P('M22 9v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9') + P('M6 3v8'),
  map: P('M14.11 5.55a2 2 0 0 0 1.79 0l3.66-1.83A1 1 0 0 1 21 4.62v12.76a1 1 0 0 1-.55.9l-4.55 2.27a2 2 0 0 1-1.79 0l-4.21-2.1a2 2 0 0 0-1.79 0l-3.66 1.83A1 1 0 0 1 3 19.38V6.62a1 1 0 0 1 .55-.9l4.55-2.27a2 2 0 0 1 1.79 0z') + P('M15 5.76v15') + P('M9 3.24v15'),
  award: P('m15.48 12.89 1.51 8.53a.5.5 0 0 1-.81.47l-3.58-2.69a1 1 0 0 0-1.2 0l-3.59 2.69a.5.5 0 0 1-.81-.47l1.51-8.53') + C(12, 8, 6),
  sakura: sakura(12, 12, 1),
  // ----- drawn for the stage prep and Mailroom mock-ups (ours) -----
  armorbreak: P('M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z') + P('m12.6 4.2-2.1 5.6 3.4 2.6-2.4 5.8'),
  pierce: '<rect x="9.5" y="3" width="5" height="18" rx="1"/>' + P('M2 12h5.5') + P('M16.5 12H21') + P('m17.5 8.5 3.5 3.5-3.5 3.5') + P('M2 9.5 4 12l-2 2.5'),
  lantern: P('M12 2v1.5') + P('M8.5 3.5h7v2h-7z') + P('M8.5 5.5C5.2 7.1 4.5 9.6 4.5 12.25S5.2 17.4 8.5 19h7c3.3-1.6 4-4.1 4-6.75s-.7-5.15-4-6.75') + P('M5.3 9.5h13.4') + P('M5.3 15h13.4') + P('M8.5 19h7v2h-7z'),
});

/** The groups of the glyph sheet (the kit fixture's board 7) and of the direction's glyph list. */
export const GLYPH_GROUPS = Object.freeze({
  'Home rail': ['swords', 'cap', 'sparkles', 'clipboard', 'flag', 'bag', 'users', 'grid'],
  Chrome: ['chat', 'mail', 'settings', 'house', 'back', 'plus', 'minus', 'x', 'eyeoff', 'image', 'megaphone', 'bell', 'maximize', 'info', 'help',
    'search', 'funnel', 'sort', 'check', 'lock', 'chevR', 'chevL', 'chevD', 'chevU', 'play', 'skip', 'clock', 'refresh', 'swap', 'cube', 'percent', 'hash', 'login'],
  'Currencies (chrome only)': ['coin', 'gem', 'ticket', 'energy'],
  'Girl page': ['info', 'level', 'star', 'shirt', 'tree', 'shield', 'paw', 'moon', 'feather', 'waves', 'sword', 'gauge', 'target', 'heart', 'zap', 'sparkle'],
  'Sections and sheets': ['daily', 'weekly', 'gift', 'trophy', 'key', 'store', 'crown', 'monitor', 'volume', 'idcard', 'inbox', 'history', 'hourglass', 'book',
    'booktext', 'journal', 'library', 'user', 'userplus', 'backpack', 'box', 'timer', 'castle', 'map', 'award', 'sakura'],
  'Drawn for the mock-ups': ['armorbreak', 'pierce', 'lantern'],
});

/** The 86 glyphs of the approved set (the five groups, each once). */
export const CORE_GLYPHS = Object.freeze([...new Set(Object.entries(GLYPH_GROUPS).filter(([g]) => g !== 'Drawn for the mock-ups').flatMap(([, n]) => n))]);

/** Frame glyphs: their top-right corner is cut at 45 degrees by 2.5 px (the panel chamfer in miniature). */
export const FRAME_GLYPHS = Object.freeze(['mail', 'clipboard', 'ticket', 'image', 'daily', 'weekly', 'idcard', 'monitor', 'store']);

/**
 * The game's icon names (components.js glyph(), kit.js ico(): src/art/icons.js uiIcon, src/art/icons/glyphs.js and the
 * M0 extras) that mean what a line glyph means, so chrome asks for the old name and gets the line drawing. Game-data
 * icons (roles, attack types, capabilities, enemy traits, items, modes) are not here: they keep their own drawings.
 */
export const LINE_ALIASES = Object.freeze({
  back: 'back', home: 'house', settings: 'settings', key: 'key', lock: 'lock', star: 'star', heart: 'heart', coin: 'coin', play: 'play',
  info: 'info', close: 'x', check: 'check', plus: 'plus', minus: 'minus', refresh: 'refresh', backpack: 'backpack', wiki: 'library',
  bestiary: 'book', gacha: 'sparkles', formation: 'shield', students: 'cap', mission: 'map', mall: 'bag', gift: 'gift', calendar: 'daily',
  trophy: 'trophy', map: 'map', sword: 'sword', shield: 'shield', sparkle: 'sparkle', filter: 'funnel', sort: 'sort', hourglass: 'hourglass',
  target: 'target', mail: 'mail', menu: 'grid', notice: 'megaphone', tasks: 'clipboard', fullscreen: 'maximize', story: 'booktext',
  chevron: 'chevR', chevR: 'chevR', chevL: 'chevL', account: 'idcard', chat: 'chat', people: 'users', friend: 'userplus', clock: 'clock',
  cube: 'cube', search: 'search', bell: 'bell', image: 'image', user: 'user', users: 'users', ticket: 'ticket', gem: 'gem', crown: 'crown',
  store: 'store', inbox: 'inbox', history: 'history', timer: 'timer', box: 'box', journal: 'journal', library: 'library', award: 'award',
  volume: 'volume', monitor: 'monitor', idcard: 'idcard', daily: 'daily', weekly: 'weekly', swap: 'swap', help: 'help', percent: 'percent',
  hash: 'hash', login: 'login', castle: 'castle', userplus: 'userplus', sakura: 'sakura', eyeoff: 'eyeoff', megaphone: 'megaphone',
  grid: 'grid', bag: 'bag', cap: 'cap', sparkles: 'sparkles', clipboard: 'clipboard', flag: 'flag', house: 'house', x: 'x',
});

/** True when `name` is a line glyph. */
export const hasLineGlyph = (name) => Object.prototype.hasOwnProperty.call(LINE_GLYPHS, name);

/** The line glyph a game icon name maps to, or null (a game-data icon, or a name with no line drawing). */
export function lineFor(name) {
  const n = LINE_ALIASES[name];
  return n && hasLineGlyph(n) ? n : null;
}

/**
 * A line glyph as SVG markup: 24 x 24, currentColor, 1.5 px round strokes (attributes, so it draws the same without
 * the kit's CSS). Class "g lg" plus `cls` (the kit sizes: s, xs, l); `cls` '' keeps only "lg" off the kit sizing when
 * `kitSize` is false (a game icon in its own sized box).
 * @param {string} name
 * @param {string} [cls]
 * @param {{ kitSize?: boolean }} [o]
 */
export function lineGlyph(name, cls = '', { kitSize = true } = {}) {
  const body = LINE_GLYPHS[name];
  if (!body) throw new Error(`no line glyph "${name}"`);
  const c = [kitSize ? 'g' : null, 'lg', cls || null].filter(Boolean).join(' ');
  return `<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

/**
 * The chapter emblems (ours): an outer 1 px hairline ring, an inner 1.5 px ring at 78 %, four 45-degree ticks (the
 * kit's bracket motif; the first one cyan), and the chapter's glyph at 2 px. 64 px on the phone home, 88 px on desktop,
 * 40 px as a row emblem. Drawn so far: gate (chapter 4 Ironhold Pass: a gate arch under a ridge) and petal (chapter 1
 * Sakura Gardens); V2 draws the other six in the same strokes.
 */
export const EMBLEM_GLYPHS = Object.freeze({
  gate: '<path d="M-8 13V4a8 8 0 0 1 16 0v9"/><path d="M-3.5 13V5.5a3.5 3.5 0 0 1 7 0V13"/><path d="M-13 13h26"/><path class="ridge" d="M-14 -5.5l5.5-6 4 3.5 4.5-6.5 4.5 5.5 3-2.2 6.5 5.7"/>',
  petal: (() => {
    let o = '';
    for (let i = 0; i < 5; i++) o += `<path transform="rotate(${i * 72})" d="M0 0C-4.6-2.6-5.3-7.9-2.1-10.1L0-8.4 2.1-10.1C5.3-7.9 4.6-2.6 0 0Z"/>`;
    return `${o}<circle r="1.6"/>`;
  })(),
});

/**
 * A chapter emblem as SVG markup.
 * @param {string} [name] an EMBLEM_GLYPHS key
 * @param {{ size?: number|null, cls?: string }} [o] size: width and height in px (none: CSS sizes it)
 */
export function emblemSvg(name = 'gate', { size = null, cls = '' } = {}) {
  const ticks = [45, 135, 225, 315].map((a, i) => {
    const t = (a * Math.PI) / 180;
    const r1 = 26.5;
    const r2 = 31.5;
    return `<line class="${i === 0 ? 'tk-on' : 'tk'}" x1="${f(r1 * Math.cos(t))}" y1="${f(r1 * Math.sin(t))}" x2="${f(r2 * Math.cos(t))}" y2="${f(r2 * Math.sin(t))}"/>`;
  }).join('');
  const dim = size ? ` width="${size}" height="${size}"` : '';
  return `<svg class="emblem${cls ? ` ${cls}` : ''}"${dim} viewBox="-32 -32 64 64" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">`
    + '<style>.emblem .em-outer{stroke:var(--m-hair,rgba(150,200,255,.55));stroke-width:1px;vector-effect:non-scaling-stroke}'
    + '.emblem .em-inner{stroke-width:1.5px;vector-effect:non-scaling-stroke;opacity:.9}'
    + '.emblem .tk{stroke-width:1.5px;vector-effect:non-scaling-stroke;opacity:.9}.emblem .tk-on{stroke:var(--m-cy,#4cd6ff);stroke-width:1.5px;vector-effect:non-scaling-stroke}'
    + '.emblem .em-glyph *{stroke-width:2px;vector-effect:non-scaling-stroke}.emblem .em-glyph .ridge{stroke-width:1.5px;opacity:.6}</style>'
    + `<circle r="29" class="em-outer"/><circle r="22.6" class="em-inner"/>${ticks}<g class="em-glyph">${EMBLEM_GLYPHS[name] || ''}</g></svg>`;
}

/** Swaps <i data-g="name" class="s"> and <i data-emblem="gate"> under `root` for their SVGs (kit markup). */
export function hydrateGlyphs(root = globalThis.document) {
  if (!root?.querySelectorAll) return;
  for (const el of root.querySelectorAll('i[data-g]')) {
    if (!hasLineGlyph(el.dataset.g)) continue;
    el.outerHTML = lineGlyph(el.dataset.g, el.className);
  }
  for (const el of root.querySelectorAll('i[data-emblem]')) el.outerHTML = emblemSvg(el.dataset.emblem, { cls: el.className });
}

// Sensei Profile art (docs/specs/PROFILE.md §3.2, §7.5): the Eclipse picture frame and its chip icon,
// and the "all 20 ribbons" rosette. Placeholders from the approved mock; final art comes in M3.
// Gradient ids are per instance (two frames on one screen never hide each other's gradients).

let seq = 0;

/** The Eclipse frame around a profile picture (100 × 100, drawn over the picture). */
export function eclipseFrameSVG() {
  const id = `pfe${++seq}`;
  return `<svg class="pf-ava-frame" viewBox="0 0 100 100" aria-hidden="true"><defs>`
    + `<linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9a8"/><stop offset="0.35" stop-color="#b38bff"/><stop offset="0.7" stop-color="#3a2a7a"/><stop offset="1" stop-color="#f2c94c"/></linearGradient>`
    + `<radialGradient id="${id}c" cx="0.5" cy="0.5" r="0.5"><stop offset="0.55" stop-color="#fff3c4"/><stop offset="0.8" stop-color="#f2b705" stop-opacity="0.85"/><stop offset="1" stop-color="#f2b705" stop-opacity="0"/></radialGradient></defs>`
    + `<circle cx="50" cy="50" r="45" fill="none" stroke="url(#${id}r)" stroke-width="7"/>`
    + '<circle cx="50" cy="50" r="40.6" fill="none" stroke="#f2c94c" stroke-width="1.4"/>'
    + '<circle cx="50" cy="50" r="48.6" fill="none" stroke="#2a1d5c" stroke-width="1.2" opacity="0.7"/>'
    + `<circle cx="80" cy="18" r="13" fill="url(#${id}c)"/>`
    + '<circle cx="80" cy="18" r="8.2" fill="#241a46" stroke="#ffe08a" stroke-width="1.4"/>'
    + '<path d="M74.5 14.5a6.5 6.5 0 0 0 9 8.6 7.5 7.5 0 1 1-9-8.6z" fill="#ffe08a"/>'
    + '<path d="M14 30l1.6 3.4 3.4 1.6-3.4 1.6L14 40l-1.6-3.4L9 35l3.4-1.6z" fill="#fff3c4"/>'
    + '<path d="M89 66l1.2 2.6 2.6 1.2-2.6 1.2L89 73.6l-1.2-2.6-2.6-1.2 2.6-1.2z" fill="#fff3c4"/>'
    + '<path d="M24 86l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="#ffe08a"/></svg>';
}

/** One small carved pumpkin (for the Pumpkin Lantern frame), centred on (x, y). */
function pumpkinAt(x, y, r) {
  return `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="0" rx="${r * 1.2}" ry="${r}" fill="#f28c28" stroke="#8a3b0c" stroke-width="1.3"/>`
    + `<path d="M0 ${-r} V${r} M${-r * 0.55} ${-r * 0.85} Q${-r * 0.75} 0 ${-r * 0.55} ${r * 0.85} M${r * 0.55} ${-r * 0.85} Q${r * 0.75} 0 ${r * 0.55} ${r * 0.85}" stroke="#c4561a" stroke-width="0.9" fill="none"/>`
    + `<path d="M0 ${-r} q1 ${-r * 0.5} ${r * 0.45} ${-r * 0.6}" stroke="#2d6a4f" stroke-width="1.6" fill="none"/>`
    + `<path d="M${-r * 0.55} ${-r * 0.15} l${r * 0.25} ${-r * 0.3} l${r * 0.25} ${r * 0.3}z M${r * 0.05} ${-r * 0.15} l${r * 0.25} ${-r * 0.3} l${r * 0.25} ${r * 0.3}z" fill="#fff1a8"/>`
    + `<path d="M${-r * 0.55} ${r * 0.3} q${r * 0.55} ${r * 0.45} ${r * 1.1} 0" stroke="#fff1a8" stroke-width="1.2" fill="none"/></g>`;
}

/** The Pumpkin Lantern frame (Halloween 2026 event exchange): an orange-violet ring with lanterns and pumpkins. */
export function pumpkinFrameSVG() {
  const id = `pfp${++seq}`;
  return `<svg class="pf-ava-frame" viewBox="0 0 100 100" aria-hidden="true"><defs>`
    + `<linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset="0.5" stop-color="#f28c28"/><stop offset="1" stop-color="#7b2cbf"/></linearGradient></defs>`
    + `<circle cx="50" cy="50" r="45" fill="none" stroke="url(#${id}r)" stroke-width="7"/>`
    + '<circle cx="50" cy="50" r="40.6" fill="none" stroke="#3a1d5c" stroke-width="1.2"/>'
    + '<circle cx="50" cy="50" r="48.6" fill="none" stroke="#3a1d5c" stroke-width="1.2" opacity="0.7"/>'
    + pumpkinAt(80, 82, 8) + pumpkinAt(18, 80, 6)
    + '<g transform="translate(82 16)"><line x1="0" y1="-8" x2="0" y2="-3" stroke="#3a1d5c" stroke-width="1.4"/><ellipse cx="0" cy="4" rx="6" ry="7" fill="#ffb347" stroke="#8a3b0c" stroke-width="1.2"/><ellipse cx="0" cy="4" rx="3" ry="4" fill="#fff4c2" opacity="0.7"/></g>'
    + '<path d="M14 26l1.4 3 3 1.4-3 1.4L14 35l-1.4-3-3-1.4 3-1.4z" fill="#ffe08a"/></svg>';
}

// ---------------------------------------------------------------------------
// Cosmetics 2 frames (Oct 30): one ring recipe (a gradient band between two thin rules) plus each frame's ornaments.
// Every shape is drawn here from scratch; all art is original to this game.
// ---------------------------------------------------------------------------

const r2 = (v) => Math.round(v * 100) / 100;
const polar = (a, r) => [r2(50 + Math.cos((a - 90) * Math.PI / 180) * r), r2(50 + Math.sin((a - 90) * Math.PI / 180) * r)];

function blossomAt(x, y, r, fill = '#ffd1e4', heart = '#ffd23f', rot = 0, stroke = '#c2407a') {
  let p = '';
  for (let i = 0; i < 5; i++) p += `<ellipse cx="0" cy="${r2(-r * 0.55)}" rx="${r2(r * 0.38)}" ry="${r2(r * 0.58)}" transform="rotate(${i * 72})"/>`;
  return `<g transform="translate(${x} ${y}) rotate(${rot})" fill="${fill}" stroke="${stroke}" stroke-width="0.9">${p}<circle r="${r2(r * 0.22)}" fill="${heart}" stroke="none"/></g>`;
}
function sparkAt(x, y, r, fill = '#fff3c4') {
  return `<path d="M${x} ${y - r}l${r2(r * 0.28)} ${r2(r * 0.72)} ${r2(r * 0.72)} ${r2(r * 0.28)}-${r2(r * 0.72)} ${r2(r * 0.28)}L${x} ${y + r}l-${r2(r * 0.28)}-${r2(r * 0.72)}-${r2(r * 0.72)}-${r2(r * 0.28)} ${r2(r * 0.72)}-${r2(r * 0.28)}z" fill="${fill}"/>`;
}
function starAt(x, y, r, fill, stroke = 'none') {
  let d = '';
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2; const rr = i % 2 ? r * 0.45 : r; d += `${i ? 'L' : 'M'}${r2(x + Math.cos(a) * rr)} ${r2(y + Math.sin(a) * rr)}`; }
  return `<path d="${d}Z" fill="${fill}" stroke="${stroke}" stroke-width="0.9" stroke-linejoin="round"/>`;
}
function leafAt(x, y, len, rot, fill, stroke) {
  return `<path d="M0 0q${r2(len * 0.45)} ${r2(-len * 0.32)} ${len} 0q${r2(-len * 0.55)} ${r2(len * 0.32)}-${len} 0z" transform="translate(${x} ${y}) rotate(${rot})" fill="${fill}" stroke="${stroke}" stroke-width="0.8"/>`;
}
function waveRow(y, x0, x1, amp, col, w = 2.2) {
  let d = `M${x0} ${y}`;
  for (let x = x0; x < x1; x += 8) d += `q2 ${-amp} 4 0t4 0`;
  return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
}

/** A curtain hanging on the ring from angle a0 to a1 (degrees, 0 = top): its outer edge on the rim, a scalloped hem
 *  over the band, never over the picture (r ≥ 40). */
function drape(a0, a1, fill, stroke) {
  const pts = [];
  for (let a = a0; a <= a1; a += 2) pts.push(polar(a, 50));
  let d = `M${pts[0][0]} ${pts[0][1]}` + pts.slice(1).map(([x, y]) => `L${x} ${y}`).join('');
  const k = 5;
  for (let i = k; i >= 0; i--) {
    const a = a0 + (a1 - a0) * (i / k);
    const [x, y] = polar(a, i % 2 ? 40.5 : 43);
    d += `L${x} ${y}`;
  }
  return `<path d="${d}Z" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-linejoin="round"/>`;
}

/** The shared ring: a gradient band (stops, angle top-left → bottom-right) between an inner and an outer rule. */
function ring(id, stops, { band = 7, rule = '#2a1d5c', inner = null, dash = null } = {}) {
  const st = stops.map((c, i) => `<stop offset="${r2(i / (stops.length - 1))}" stop-color="${c}"/>`).join('');
  return `<defs><linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1">${st}</linearGradient></defs>`
    + `<circle cx="50" cy="50" r="45" fill="none" stroke="url(#${id}r)" stroke-width="${band}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
    + `<circle cx="50" cy="50" r="${r2(45 - band / 2 - 0.6)}" fill="none" stroke="${inner || rule}" stroke-width="1.3"/>`
    + `<circle cx="50" cy="50" r="${r2(45 + band / 2 + 0.4)}" fill="none" stroke="${rule}" stroke-width="1.1" opacity="0.75"/>`;
}

const FRAME_ART = {
  sakura: (id) => ring(id, ['#ffd6e8', '#ff8fbf', '#ffc2dc', '#e0569a'], { rule: '#9c2f63' })
    + [0, 72, 144, 216, 288].map((a, i) => { const [x, y] = polar(a + 18, 45); return blossomAt(x, y, i === 0 ? 8 : 6, '#fff3f8', '#ffd23f', a, '#c2407a'); }).join('')
    + sparkAt(84, 50, 3) + sparkAt(16, 64, 2.4),
  laurel: (id) => ring(id, ['#fff2b3', '#f2b705', '#ffe08a', '#a87400'], { rule: '#7a5300' })
    + [-1, 1].map((side) => Array.from({ length: 7 }, (_, i) => { const a = 180 + side * (32 + i * 18); const [x, y] = polar(a, 45); return leafAt(x, y, 9, a + (side < 0 ? -40 : 220), '#fff8d6', '#a87400'); }).join('')).join('')
    + starAt(50, 6, 6, '#fff3c4', '#a87400'),
  rosette: (id) => {
    let d = '';
    for (let i = 0; i < 48; i++) { const [x, y] = polar(i * 7.5, i % 2 ? 46 : 50); d += `${i ? 'L' : 'M'}${x} ${y}`; }
    return `<path d="${d}Z M50 9a41 41 0 1 0 0.01 0Z" fill="#ffd1e4" fill-rule="evenodd" stroke="#b5306a" stroke-width="1" stroke-linejoin="round"/>`
      + ring(id, ['#ffffff', '#9fc0ff', '#ff9fc2', '#5b47d6'], { band: 6, rule: '#3a2a7a' })
      + '<path d="M34 86l-6 12 6-2 3 5 5-12zM66 86l6 12-6-2-3 5-5-12z" fill="#7d6cf0" stroke="#3a2a7a" stroke-width="1" stroke-linejoin="round"/>'
      + blossomAt(50, 92, 5, '#fff', '#ffd23f', 0, '#b5306a');
  },
  knot: (id) => `<circle cx="50" cy="50" r="45" fill="none" stroke="#ffad4d" stroke-width="7"/>`
    + `<circle cx="50" cy="50" r="45" fill="none" stroke="#5aa7ff" stroke-width="7" stroke-dasharray="11 11" stroke-dashoffset="5"/>`
    + ring(id, ['#00000000', '#00000000'], { band: 7, rule: '#7a3d0a' })
    + '<path d="M50 99c-7-6-15-8-15-15a6 6 0 0 1 15-3 6 6 0 0 1 15 3c0 7-8 9-15 15z" fill="#ff7a9a" stroke="#8a1f3d" stroke-width="1.2"/>'
    + '<path d="M38 82c4-6 20-6 24 0" stroke="#fff" stroke-width="1.4" fill="none" opacity="0.7"/>',
  chalkboard: (id) => ring(id, ['#b07a46', '#7a4a22', '#c58e55', '#5e3616'], { band: 8, rule: '#3e2410', inner: '#2f5d4b' })
    + '<circle cx="50" cy="50" r="40.4" fill="none" stroke="#2f5d4b" stroke-width="2.4"/>'
    + '<path d="M10 70l5 4 9-9" stroke="#f4fff8" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    + starAt(84, 22, 4.6, '#f4fff8') + starAt(90, 36, 2.6, '#f4fff8')
    + '<rect x="40" y="91" width="20" height="7" rx="1.8" fill="#ffd1e4" stroke="#3e2410" stroke-width="1.1"/><rect x="40" y="91" width="20" height="3" rx="1.2" fill="#6b8fe6"/>',
  tide: (id) => ring(id, ['#d6f2ff', '#4aa6f0', '#9fe3ff', '#1a5f9e'], { rule: '#0f3d6b' })
    + '<g clip-path="none">' + waveRow(88, 26, 74, 4, '#ffffff', 2.4) + waveRow(94, 32, 68, 3, '#bfe7ff', 2) + '</g>'
    + '<path d="M12 70a10 10 0 0 1 12-6 6 6 0 0 0-2 9 8 8 0 0 1-10-3z" fill="#fff" stroke="#1a5f9e" stroke-width="1"/>'
    + sparkAt(84, 18, 3.4) + sparkAt(90, 30, 2),
  endless: (id) => ring(id, ['#9ef0d8', '#2b7fff', '#6d63c9', '#1b1640'], { rule: '#13102e' })
    + waveRow(88, 24, 76, 4, '#9ef0d8', 2.4) + waveRow(94, 30, 70, 3, '#cfc8ff', 2)
    + '<path d="M80 8a9 9 0 1 0 9 13 7.4 7.4 0 0 1-9-13z" fill="#ffe7a3" stroke="#6d4c00" stroke-width="1"/>'
    + sparkAt(16, 24, 3.2, '#cfc8ff') + sparkAt(10, 40, 2.2, '#ffffff') + sparkAt(92, 44, 2.4, '#9ef0d8'),
  limit: (id) => {
    let burst = '';
    for (let i = 0; i < 12; i++) { const a = i * 30; const [x0, y0] = polar(a - 6, 46); const [x1, y1] = polar(a, 50); const [x2, y2] = polar(a + 6, 46); burst += `M${x0} ${y0}L${x1} ${y1}L${x2} ${y2}`; }
    return `<path d="${burst}" fill="#ffe14d" stroke="#a87400" stroke-width="0.8" stroke-linejoin="round"/>`
      + ring(id, ['#ff7ad9', '#ffd84d', '#4cd6ff', '#b78bff', '#ff7ad9'], { band: 8, rule: '#3a2a7a' })
      + '<path d="M54 1l-9 12h6l-3 9 10-13h-6z" fill="#fff" stroke="#3a2a7a" stroke-width="1" stroke-linejoin="round"/>';
  },
  twin_legends: (id) => `<path d="M50 5a45 45 0 0 0 0 90" fill="none" stroke="#f2c94c" stroke-width="7"/><path d="M50 5a45 45 0 0 1 0 90" fill="none" stroke="#8b7bff" stroke-width="7"/>`
    + ring(id, ['#00000000', '#00000000'], { band: 7, rule: '#2a1d5c' })
    + starAt(38, 7, 6.4, '#fff3c4', '#a87400') + starAt(62, 7, 6.4, '#e4ddff', '#3d2c9e')
    + sparkAt(12, 70, 2.6) + sparkAt(88, 70, 2.6, '#e4ddff'),
  first_petal: (id) => ring(id, ['#e8f8e6', '#9be3a5', '#ffd1e4', '#5fb883'], { rule: '#2c6e49' })
    + '<path d="M50 99c0-6 0-9-1-13" stroke="#2f9e44" stroke-width="2" fill="none" stroke-linecap="round"/>'
    + leafAt(49, 92, 10, 200, '#c9f2c7', '#2f9e44') + leafAt(50, 92, 10, -20, '#c9f2c7', '#2f9e44')
    + '<path d="M49 86c-5-4-7-9-4-14 2 3 4 4 4 4s2-1 4-4c3 5 1 10-4 14z" fill="#ffc2dc" stroke="#c2407a" stroke-width="1"/>'
    + blossomAt(84, 20, 4.4, '#fff3f8', '#ffd23f', 12) + sparkAt(14, 26, 2.6),
  window_seat: (id) => ring(id, ['#fff1dc', '#e0b07a', '#f5d3a6', '#a8703a'], { band: 7, rule: '#6b4220' })
    + drape(292, 342, '#9fd3ff', '#2d6db3') + drape(18, 68, '#9fd3ff', '#2d6db3')
    + [317, 43].map((a) => { const [x, y] = polar(a, 45); return `<circle cx="${x}" cy="${y}" r="2.2" fill="#ffd1e4" stroke="#b5306a" stroke-width="0.8"/>`; }).join('')
    + '<path d="M41 88h18l-2 10H43z" fill="#e8622a" stroke="#8a2c0c" stroke-width="1"/>'
    + leafAt(50, 88, 9, 235, '#9be3a5', '#2f9e44') + leafAt(50, 88, 9, -55, '#9be3a5', '#2f9e44') + blossomAt(50, 82, 3.6, '#fff', '#ffd23f', 0, '#c2407a'),
  lantern_night: (id) => ring(id, ['#ffb347', '#e8622a', '#3a1d5c', '#1b1640'], { rule: '#1b1640' })
    + [-56, -28, 0, 28, 56].map((a, i) => { const [x, y] = polar(a, 46); return `<g transform="translate(${x} ${y}) rotate(${a / 3})"><ellipse cx="0" cy="0" rx="${i === 2 ? 4.6 : 3.8}" ry="${i === 2 ? 5.4 : 4.6}" fill="${i % 2 ? '#ff9fc2' : '#ffb347'}" stroke="#8a3b0c" stroke-width="1"/><ellipse cx="0" cy="0" rx="1.6" ry="2.8" fill="#fff4c2" opacity="0.75"/><rect x="-1.6" y="${i === 2 ? -6.6 : -5.6}" width="3.2" height="1.6" rx="0.5" fill="#3a1d5c"/></g>`; }).join('')
    + '<path d="M84 76a9 9 0 1 0 9 13 7.4 7.4 0 0 1-9-13z" fill="#ffe7a3" stroke="#6d4c00" stroke-width="1"/>'
    + pumpkinAt(18, 84, 6),
};

/** The Cosmetics 2 frame `id` around a profile picture (100 × 100, drawn over the picture), or '' when it has no art here. */
export function ornateFrameSVG(id) {
  const draw = FRAME_ART[id];
  if (!draw) return '';
  return `<svg class="pf-ava-frame" viewBox="0 0 100 100" aria-hidden="true" data-frame-art="${id}">${draw(`pfx${++seq}`)}</svg>`;
}

/** Frame ids drawn by ornateFrameSVG. */
export const ORNATE_FRAMES = Object.freeze(Object.keys(FRAME_ART));

/** Small round icon of a frame for chips and pickers ('ur' | 'eclipse' | 'pumpkin' | null = Default). */
export function frameChipSVG(frame) {
  if (FRAME_ART[frame]) return ornateFrameSVG(frame).replace(' class="pf-ava-frame"', '');
  if (frame === 'pumpkin') {
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="#f28c28" stroke-width="12"/><circle cx="50" cy="50" r="46" fill="none" stroke="#7b2cbf" stroke-width="3"/>' + pumpkinAt(50, 54, 18) + '</svg>';
  }
  if (frame === 'eclipse') {
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="#b38bff" stroke-width="12"/><circle cx="50" cy="50" r="22" fill="#241a46" stroke="#ffe08a" stroke-width="5"/><path d="M40 40a14 14 0 0 0 20 20 16 16 0 1 1-20-20z" fill="#ffe08a"/></svg>';
  }
  if (frame === 'ur') {
    const id = `pfu${++seq}`;
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7ad9"/><stop offset="0.33" stop-color="#ffd84d"/><stop offset="0.66" stop-color="#4cd6ff"/><stop offset="1" stop-color="#b78bff"/></linearGradient></defs><circle cx="50" cy="50" r="38" fill="#fff" stroke="url(#${id})" stroke-width="14"/></svg>`;
  }
  return '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="38" fill="#eaf4ff" stroke="#fff" stroke-width="12"/><circle cx="50" cy="50" r="44" fill="none" stroke="#b9d3ef" stroke-width="2"/></svg>';
}

/** Generic trophy plaque art (an achievement without an Honor Ribbon, or one this build doesn't know). */
export function trophySVG({ unknown = false } = {}) {
  const c = unknown ? ['#c9d3e0', '#8a9ab8'] : ['#ffd84d', '#b07d00'];
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 10h24v14a12 12 0 0 1-24 0z" fill="${c[0]}" stroke="${c[1]}" stroke-width="2.4"/>`
    + `<path d="M20 14h-7c0 7 3 10.5 8.5 11M44 14h7c0 7-3 10.5-8.5 11" fill="none" stroke="${c[1]}" stroke-width="2.4" stroke-linecap="round"/>`
    + `<path d="M32 36v8M24 54h16M26 44h12v10H26z" fill="${c[0]}" stroke="${c[1]}" stroke-width="2.4" stroke-linejoin="round"/>`
    + (unknown ? '<text x="32" y="29" text-anchor="middle" font-size="16" font-weight="900" fill="#fff">?</text>' : '<path d="M32 15l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z" fill="#fff8dc"/>')
    + '</svg>';
}

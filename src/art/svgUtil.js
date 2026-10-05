// Small, dependency-free helpers shared by every SVG generator in src/art.
// Everything here is pure and deterministic (no Math.random, no DOM).

/** Parse '#rgb' / '#rrggbb' into [r, g, b] (0-255). Falls back to mid grey. */
export function hexToRgb(hex) {
  let h = String(hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [128, 128, 128];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** [r, g, b] → '#rrggbb' (values are clamped and rounded). */
export function rgbToHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linear mix of two colours, t = 0 → a, t = 1 → b. */
export function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
}

/** Mix towards white. */
export const lighten = (c, t) => mix(c, '#ffffff', t);
/** Mix towards black. */
export const darken = (c, t) => mix(c, '#000000', t);

/** Relative luminance 0..1 (sRGB, approximate). */
export function luminance(c) {
  const [r, g, b] = hexToRgb(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Darker, slightly hue-shifted outline colour for a fill (anime line art tends to use a
 * saturated dark version of the fill rather than pure black).
 */
export function lineOf(c, amount = 0.55) {
  return mix(darken(c, amount), '#3a1f3d', 0.25);
}

/** Round to 1 decimal — keeps SVG strings short. */
export function n(v) {
  return Math.round(v * 10) / 10;
}

/** Join point list [[x,y],...] into 'x,y x,y'. */
export function pts(list) {
  return list.map(([x, y]) => `${n(x)},${n(y)}`).join(' ');
}

/** Escape text for SVG/XML. */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** FNV-1a string hash → unsigned 32-bit integer. */
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Tiny deterministic PRNG (mulberry32) seeded from a string. Returns () => [0,1). */
export function seeded(seedText) {
  let a = hashStr(String(seedText)) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Make an id-safe slug. */
export function slug(s) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, '_');
}

/** Star polygon points (spikes, outer radius, inner radius) centred at cx, cy. */
export function starPoints(cx, cy, outer, inner, spikes = 5, rot = -Math.PI / 2) {
  const out = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / spikes;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts(out);
}

/** Rounded 4-point sparkle path centred at cx, cy. */
export function sparklePath(cx, cy, r, waist = 0.22) {
  const w = r * waist;
  return `M${n(cx)} ${n(cy - r)}Q${n(cx + w)} ${n(cy - w)} ${n(cx + r)} ${n(cy)}Q${n(cx + w)} ${n(cy + w)} ${n(cx)} ${n(cy + r)}Q${n(cx - w)} ${n(cy + w)} ${n(cx - r)} ${n(cy)}Q${n(cx - w)} ${n(cy - w)} ${n(cx)} ${n(cy - r)}Z`;
}

/** Sakura petal path (notched tip) of length len pointing up from (0,0); transform it. */
export function petalPath(len = 10) {
  const w = len * 0.55;
  return `M0 0C${n(-w)} ${n(-len * 0.3)} ${n(-w * 0.7)} ${n(-len * 0.95)} ${n(-len * 0.12)} ${n(-len)}L0 ${n(-len * 0.82)}L${n(len * 0.12)} ${n(-len)}C${n(w * 0.7)} ${n(-len * 0.95)} ${n(w)} ${n(-len * 0.3)} 0 0Z`;
}

/** Five-petal sakura blossom centred at cx, cy. */
export function blossom(cx, cy, r, fill, centre = '#ffd166', extra = '') {
  let s = `<g transform="translate(${n(cx)} ${n(cy)})"${extra}>`;
  for (let i = 0; i < 5; i++) s += `<path d="${petalPath(r)}" transform="rotate(${i * 72})" fill="${fill}"/>`;
  s += `<circle r="${n(r * 0.22)}" fill="${centre}"/></g>`;
  return s;
}

/** Linear gradient definition helper. stops = [[offset, color, opacity?], ...] */
export function linGrad(id, stops, { x1 = 0, y1 = 0, x2 = 0, y2 = 1, units = '' } = {}) {
  const u = units ? ` gradientUnits="${units}"` : '';
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${u}>${stops
    .map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ''}/>`)
    .join('')}</linearGradient>`;
}

/** Radial gradient definition helper. */
export function radGrad(id, stops, { cx = 0.5, cy = 0.5, r = 0.5, fx, fy, units = '' } = {}) {
  const u = units ? ` gradientUnits="${units}"` : '';
  const f = fx != null ? ` fx="${fx}" fy="${fy}"` : '';
  return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"${f}${u}>${stops
    .map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ''}/>`)
    .join('')}</radialGradient>`;
}

/** Wrap content into a standalone SVG string. */
export function svgDoc(viewBox, body, { width, height, extra = '' } = {}) {
  const wh = width ? ` width="${width}" height="${height}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${wh}${extra}>${body}</svg>`;
}

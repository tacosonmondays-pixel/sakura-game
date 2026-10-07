// Debug drawing of a map's tracks (Tracks v3): terrain chars, stamped path tiles, the sim's
// forbidden band, the canonical centreline with direction arrows, control points, crossings
// (B = bridge, F = flat) and tunnels. Pure SVG string — used by previews/tracks.html and by
// the design scripts (Node + Playwright).
import { pathTiles, buildableTiles } from '../src/data/maps.js';
import { pointAtDistance } from '../src/core/track.js';

const FILL = { '.': '#a6d98a', ',': '#c4e6a0', '~': '#6cc3ea', B: '#9cc6d6', T: '#3f8f4a', R: '#9a958c', H: '#c0504d', X: '#2b1d1a' };
const COLORS = ['#ffffff', '#ffe066', '#ff9ecb', '#9be7ff'];

/**
 * @param {object} map MapDef
 * @param {{ scale?: number, before?: number|null }} [o] px per tile; old total length for the header
 */
export function trackDebugSVG(map, { scale = 26, before = null } = {}) {
  const W = map.width;
  const H = map.height;
  const pad = 1.5;
  const S = scale;
  const X = (x) => (x + pad) * S;
  const Y = (y) => (y + pad) * S;
  const w = (W + pad * 2) * S;
  const h = (H + pad * 2) * S + 34;
  let s = `<rect width="${w}" height="${h}" fill="#3a4250"/>`;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = map.rows[y][x];
      s += `<rect x="${X(x)}" y="${Y(y)}" width="${S}" height="${S}" fill="${FILL[ch] || '#f0f'}"/>`;
      if (ch === 'T') s += `<circle cx="${X(x + 0.5)}" cy="${Y(y + 0.5)}" r="${S * 0.42}" fill="#2a6b33"/>`;
    }
  }
  const tiles = pathTiles(map);
  for (const k of tiles) {
    const [x, y] = k.split(',').map(Number);
    s += `<rect x="${X(x)}" y="${Y(y)}" width="${S}" height="${S}" fill="#ff8a3d" opacity="0.28"/>`;
  }
  // grid
  let g = '';
  for (let x = 0; x <= W; x++) g += `M${X(x)} ${Y(0)}V${Y(H)}`;
  for (let y = 0; y <= H; y++) g += `M${X(0)} ${Y(y)}H${X(W)}`;
  s += `<path d="${g}" stroke="#000" stroke-opacity="0.18" stroke-width="1"/>`;
  for (let x = 0; x < W; x += 2) s += `<text x="${X(x + 0.5)}" y="${Y(-0.25)}" font-size="${S * 0.42}" fill="#fff" text-anchor="middle">${x}</text>`;
  for (let y = 0; y < H; y += 2) s += `<text x="${X(-0.3)}" y="${Y(y + 0.65)}" font-size="${S * 0.42}" fill="#fff" text-anchor="end">${y}</text>`;
  const tracks = map.tracks || [];
  const line = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)} ${Y(y).toFixed(1)}`).join('');
  tracks.forEach((t) => {
    s += `<path d="${line(t.points)}" fill="none" stroke="#000" stroke-opacity="0.22" stroke-width="${S * 1.1}" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  tracks.forEach((t, ti) => {
    const col = COLORS[ti % COLORS.length];
    s += `<path d="${line(t.points)}" fill="none" stroke="${col}" stroke-width="${S * 0.12}" stroke-linejoin="round"/>`;
    // elevated sections
    if (t.elev) {
      let seg = [];
      t.points.forEach((p, i) => {
        if (t.elev[i] > 0.05) seg.push(p);
        else if (seg.length) {
          s += `<path d="${line(seg)}" fill="none" stroke="#7a4a2a" stroke-width="${S * 0.5}" stroke-opacity="0.8"/>`;
          seg = [];
        }
      });
      if (seg.length) s += `<path d="${line(seg)}" fill="none" stroke="#7a4a2a" stroke-width="${S * 0.5}" stroke-opacity="0.8"/>`;
    }
    for (const [a, b] of t.tunnels || []) {
      const pts = t.points.filter((_, i) => t.cum[i] >= a && t.cum[i] <= b);
      s += `<path d="${line(pts)}" fill="none" stroke="#222" stroke-width="${S * 0.8}" stroke-opacity="0.75" stroke-dasharray="${S * 0.3} ${S * 0.15}"/>`;
    }
    const tmp = {};
    for (let d = 1.5; d < t.length - 0.5; d += 2.5) {
      pointAtDistance(t.points, t.cum, d, tmp);
      const a = Math.atan2(tmp.dy, tmp.dx);
      const p = (ang, r) => `${(X(tmp.x) + Math.cos(a + ang) * r).toFixed(1)} ${(Y(tmp.y) + Math.sin(a + ang) * r).toFixed(1)}`;
      s += `<path d="M${p(0, S * 0.3)}L${p(2.5, S * 0.3)}L${p(-2.5, S * 0.3)}Z" fill="${col}" stroke="#000" stroke-width="1"/>`;
    }
    for (const [x, y] of t.control || []) s += `<circle cx="${X(x)}" cy="${Y(y)}" r="${S * 0.09}" fill="#000"/>`;
    const [sx, sy] = t.points[0];
    s += `<text x="${X(sx)}" y="${Y(sy) - S * 0.35}" font-size="${S * 0.5}" fill="${col}" font-weight="bold" text-anchor="middle">${ti}</text>`;
  });
  for (const d of map.decor || []) {
    const bad = tiles.has(`${d.x},${d.y}`);
    s += `<rect x="${X(d.x + 0.2)}" y="${Y(d.y + 0.2)}" width="${S * 0.6}" height="${S * 0.6}" rx="${S * 0.15}" fill="${bad ? '#ff1744' : '#ffd166'}" stroke="#000" stroke-width="1"/>`;
    s += `<text x="${X(d.x + 0.5)}" y="${Y(d.y + 0.68)}" font-size="${S * 0.36}" text-anchor="middle" fill="#000">${d.type.slice(0, 2)}</text>`;
  }
  for (const c of map.crossings || []) {
    s += `<circle cx="${X(c.x)}" cy="${Y(c.y)}" r="${S * 0.32}" fill="${c.mode === 'bridge' ? '#7a4a2a' : c.mode === 'tunnel' ? '#222' : '#555'}" stroke="#fff" stroke-width="2"/>`;
    s += `<text x="${X(c.x)}" y="${Y(c.y) + S * 0.15}" font-size="${S * 0.42}" fill="#fff" text-anchor="middle" font-weight="bold">${c.mode === 'bridge' ? 'B' : c.mode === 'tunnel' ? 'T' : 'F'}</text>`;
  }
  const b = buildableTiles(map);
  const lens = tracks.map((t) => t.length.toFixed(1)).join(' + ');
  const total = tracks.reduce((a, t) => a + t.length, 0);
  const tun = tracks.reduce((a, t) => a + (t.tunnels || []).reduce((q, [x, y]) => q + y - x, 0), 0);
  const delta = before ? ` (was ${before.toFixed(0)}, ${total >= before ? '+' : ''}${(((total - before) / before) * 100).toFixed(0)}%)` : '';
  s += `<text x="8" y="${h - 20}" font-size="14" fill="#fff" font-family="sans-serif"><tspan font-weight="bold">${map.id}</tspan> · ${map.tier} · len ${lens} = ${total.toFixed(1)}${delta} · crossings ${(map.crossings || []).length} · tunnel ${tun.toFixed(1)}</text>`;
  s += `<text x="8" y="${h - 4}" font-size="12" fill="#cfd6e0" font-family="sans-serif">land ${b.land} · water ${b.water} · ${map.concept || ''}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="sans-serif">${s}</svg>`;
}

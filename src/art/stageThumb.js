// Top-down mini map for stage / map cards (CONTRACTS §8), Bloons-map-card style:
// themed ground, light stone road with a border (traced along the map's canonical Tracks v3
// centrelines: curves, overpasses drawn on top, buried tunnel sections dashed, plank decks
// over water), water with shine, trees / rocks / buildings as symbols, spawn and exit markers.

import { n, lighten, darken, seeded, blossom, slug } from './svgUtil.js';
import { mapTracks, pointAtDistance } from '../core/track.js';

/** Colour themes per map theme. */
export const MAP_THEMES = {
  sakura: { ground: '#8fd16a', alt: '#83c75f', edge: '#5d9e3f', path: '#f7ead0', pathEdge: '#c9a77c', water: '#5cc8f0', tree: '#ffa8cc', treeDark: '#e86f9f', rock: '#b5aea6', roof: '#e5383b', wall: '#fff6e8', flower: ['#ffc4d6', '#fff', '#ffd166'], voidc: '#3d2f2f' },
  lake: { ground: '#86d47f', alt: '#7bca74', edge: '#4f9c4b', path: '#f3e6c8', pathEdge: '#bf9c6c', water: '#3fb2e8', tree: '#57b05a', treeDark: '#2f7d3a', rock: '#aeb5bb', roof: '#2b7fff', wall: '#f4f1de', flower: ['#fff', '#ffd166', '#9be7ff'], voidc: '#2b3a4a' },
  shrine: { ground: '#78c26c', alt: '#6eb862', edge: '#447f3d', path: '#ece2cf', pathEdge: '#a8916f', water: '#4cbfe0', tree: '#3f9a4f', treeDark: '#256b34', rock: '#a3a3a3', roof: '#d62828', wall: '#fff3e0', flower: ['#ffc4d6', '#fff', '#c77dff'], voidc: '#2f2a3a' },
  mountain: { ground: '#a9c98a', alt: '#9fbf80', edge: '#6f8f55', path: '#e8dcc4', pathEdge: '#9c8664', water: '#5ab6dc', tree: '#3a7d50', treeDark: '#24563a', rock: '#9a958c', roof: '#8d6e63', wall: '#e9e1d3', flower: ['#fff', '#ffd166', '#a5d8ff'], voidc: '#3b3632' },
  marsh: { ground: '#7fa565', alt: '#769b5d', edge: '#4e6e3e', path: '#d8c9a3', pathEdge: '#8a7550', water: '#5f9e8a', tree: '#4f7f45', treeDark: '#2f5530', rock: '#8c8a7a', roof: '#6d597a', wall: '#d6ccc2', flower: ['#c0eb75', '#e6fcf5', '#d0bfff'], voidc: '#2a3326' },
  foundry: { ground: '#9aa0ab', alt: '#8f95a0', edge: '#5c6370', path: '#e6dccb', pathEdge: '#8c7b62', water: '#4fa3c7', tree: '#6c7a89', treeDark: '#46505c', rock: '#7d828c', roof: '#ffb703', wall: '#c0c7d6', flower: ['#ffd166', '#ff9f1c', '#e9ecef'], voidc: '#2b1d1a', lava: true },
  festival: { ground: '#93d27a', alt: '#88c86f', edge: '#5a9a48', path: '#fff0cf', pathEdge: '#d39a5c', water: '#4cc9f0', tree: '#ff9ec7', treeDark: '#e0679a', rock: '#b8b0a8', roof: '#ff5d73', wall: '#fff6e0', flower: ['#ffd166', '#ff8fab', '#9be7ff'], voidc: '#3a2a35' },
  volcano: { ground: '#7d6a62', alt: '#74625a', edge: '#4a3a35', path: '#d9c5ac', pathEdge: '#8a6f55', water: '#3f8fa8', tree: '#5b4a42', treeDark: '#3a2e29', rock: '#5f5550', roof: '#9c2f2f', wall: '#b9aaa0', flower: ['#ff9f1c', '#ffd166', '#ff6b35'], voidc: '#2b1410', lava: true },
  snow: { ground: '#eef6fb', alt: '#e3eef6', edge: '#a9c2d6', path: '#d7e0ea', pathEdge: '#8ea4ba', water: '#8fd0f5', tree: '#3f7d5c', treeDark: '#24563a', rock: '#a7b4c2', roof: '#5c7cfa', wall: '#ffffff', flower: ['#a5d8ff', '#fff', '#d0ebff'], voidc: '#4a5a6a', snowy: true },
  night: { ground: '#4a6b8a', alt: '#45647f', edge: '#2c4560', path: '#c7d2e2', pathEdge: '#7f8fa6', water: '#2f6db0', tree: '#2f5d62', treeDark: '#1c3c40', rock: '#6c7a89', roof: '#7b3fd4', wall: '#d9d4f0', flower: ['#ffe066', '#c0eb75', '#b197fc'], voidc: '#151a2a' },
  arena: { ground: '#e3cfa0', alt: '#d9c494', edge: '#a88c5c', path: '#f7ead0', pathEdge: '#b08960', water: '#4cc9f0', tree: '#5f9e3f', treeDark: '#3d6e28', rock: '#b0a08a', roof: '#c1121f', wall: '#f4e9d8', flower: ['#ffd166', '#fff', '#ff8fab'], voidc: '#3a2f22' },
};

const DECOR_COLORS = {
  sakura: '#ff9ec7', willow: '#7fb069', pine: '#2f6b4a', lantern: '#ffb347', stoneLantern: '#c9c3b8', bridgeLantern: '#ffb347',
  torii: '#d62828', shrine: '#d62828', bell: '#e9c46a', crystal: '#7ee8fa', fountain: '#4cc9f0', well: '#8d99ae',
  campfire: '#ff7b25', banner: '#ff5d73', flag: '#ff5d73', stall: '#ff8fab', taiko: '#9c2f2f', boat: '#a47148',
  pier: '#a47148', waterwheel: '#8d6e63', statue: '#c0c7d6', bones: '#f1ece2', chimney: '#6c757d', gearTower: '#adb5bd',
  vent: '#ff9f1c', crane: '#ffb703', nest: '#a47148', bookshelf: '#8d6e63', candle: '#ffe066', bench: '#a47148', signpost: '#a47148',
};

function treeSym(x, y, t, th) {
  const r = t * 0.46;
  if (th.snowy || (th === MAP_THEMES.mountain)) {
    const h = t * 0.9;
    return `<path d="M${n(x)} ${n(y - h * 0.55)}L${n(x + r)} ${n(y + h * 0.4)}L${n(x - r)} ${n(y + h * 0.4)}Z" fill="${th.tree}" stroke="${th.treeDark}" stroke-width="${n(t * 0.06)}"/>` +
      (th.snowy ? `<path d="M${n(x)} ${n(y - h * 0.55)}L${n(x + r * 0.45)} ${n(y - h * 0.12)}L${n(x - r * 0.45)} ${n(y - h * 0.12)}Z" fill="#fff"/>` : '');
  }
  return `<circle cx="${n(x + t * 0.06)}" cy="${n(y + t * 0.1)}" r="${n(r)}" fill="#000" opacity="0.15"/><circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${th.tree}" stroke="${th.treeDark}" stroke-width="${n(t * 0.06)}"/><circle cx="${n(x - r * 0.3)}" cy="${n(y - r * 0.3)}" r="${n(r * 0.35)}" fill="#fff" opacity="0.3"/>`;
}

function rockSym(x, y, t, th) {
  const r = t * 0.36;
  return `<path d="M${n(x - r)} ${n(y + r * 0.6)}L${n(x - r * 0.8)} ${n(y - r * 0.4)}L${n(x - r * 0.1)} ${n(y - r * 0.85)}L${n(x + r * 0.85)} ${n(y - r * 0.3)}L${n(x + r)} ${n(y + r * 0.6)}Z" fill="${th.rock}" stroke="${darken(th.rock, 0.4)}" stroke-width="${n(t * 0.06)}"/><path d="M${n(x - r * 0.5)} ${n(y - r * 0.3)}L${n(x - r * 0.05)} ${n(y - r * 0.6)}" stroke="#fff" stroke-width="${n(t * 0.07)}" opacity="0.5"/>`;
}

function houseSym(x, y, t, th) {
  const w = t * 0.82;
  return `<rect x="${n(x - w / 2)}" y="${n(y - w / 2 + t * 0.06)}" width="${n(w)}" height="${n(w)}" rx="${n(t * 0.08)}" fill="#000" opacity="0.15"/><rect x="${n(x - w / 2)}" y="${n(y - w / 2)}" width="${n(w)}" height="${n(w)}" rx="${n(t * 0.08)}" fill="${th.roof}" stroke="${darken(th.roof, 0.4)}" stroke-width="${n(t * 0.06)}"/><path d="M${n(x - w / 2)} ${n(y)}H${n(x + w / 2)}" stroke="${lighten(th.roof, 0.35)}" stroke-width="${n(t * 0.08)}"/><rect x="${n(x - w * 0.15)}" y="${n(y - w * 0.15)}" width="${n(w * 0.3)}" height="${n(w * 0.3)}" fill="${th.wall}" opacity="0.8"/>`;
}

function decorSym(type, x, y, t) {
  const col = DECOR_COLORS[type] || '#ffffff';
  const r = t * 0.3;
  if (type === 'sakura') return blossom(x, y, t * 0.42, '#ffb3d1', '#ffd166');
  if (type === 'torii') return `<path d="M${n(x - r * 1.3)} ${n(y - r * 0.6)}H${n(x + r * 1.3)}M${n(x - r)} ${n(y - r * 0.6)}V${n(y + r)}M${n(x + r)} ${n(y - r * 0.6)}V${n(y + r)}M${n(x - r * 1.1)} ${n(y - r * 0.1)}H${n(x + r * 1.1)}" stroke="${col}" stroke-width="${n(t * 0.12)}"/>`;
  if (type === 'crystal') return `<path d="M${n(x)} ${n(y - r * 1.3)}L${n(x + r * 0.7)} ${n(y)}L${n(x)} ${n(y + r)}L${n(x - r * 0.7)} ${n(y)}Z" fill="${col}" stroke="#2a6fb0" stroke-width="${n(t * 0.05)}"/>`;
  if (type === 'lantern' || type === 'bridgeLantern' || type === 'candle' || type === 'campfire' || type === 'vent') {
    return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r * 1.4)}" fill="${col}" opacity="0.35"/><circle cx="${n(x)}" cy="${n(y)}" r="${n(r * 0.6)}" fill="${lighten(col, 0.3)}" stroke="${darken(col, 0.4)}" stroke-width="${n(t * 0.04)}"/>`;
  }
  if (type === 'boat' || type === 'pier') return `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(r * 1.3)}" ry="${n(r * 0.6)}" fill="${col}" stroke="${darken(col, 0.4)}" stroke-width="${n(t * 0.05)}"/>`;
  return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r * 0.8)}" fill="${col}" stroke="${darken(col, 0.45)}" stroke-width="${n(t * 0.05)}"/>`;
}

function arrow(x, y, dx, dy, t, fill) {
  // triangle pointing in (dx,dy)
  const a = Math.atan2(dy, dx);
  const s = t * 0.45;
  const p = (ang, r) => `${n(x + Math.cos(a + ang) * r)} ${n(y + Math.sin(a + ang) * r)}`;
  return `<path d="M${p(0, s)}L${p(2.4, s)}L${p(-2.4, s)}Z" fill="${fill}" stroke="#fff" stroke-width="${n(t * 0.08)}"/>`;
}

/**
 * Top-down mini map of a MapDef.
 * @param {object} mapDef
 * @param {{width?: number, height?: number}} [opts]
 */
export function stageThumbSVG(mapDef, { width = 320, height = 200 } = {}) {
  const W = mapDef?.width || 20;
  const H = mapDef?.height || 12;
  const rows = mapDef?.rows || [];
  const th = MAP_THEMES[mapDef?.theme] || MAP_THEMES.sakura;
  const t = Math.min(width / W, height / H);
  const ox = (width - W * t) / 2;
  const oy = (height - H * t) / 2;
  const id = `st-${slug(mapDef?.id || 'map')}`;
  const rnd = seeded(id);
  const X = (tx) => ox + tx * t;
  const Y = (ty) => oy + ty * t;
  const cell = (tx, ty) => (rows[ty] || '')[tx] || '.';

  let s = `<rect width="${width}" height="${height}" fill="${th.edge}"/>`;
  s += `<rect x="${n(ox)}" y="${n(oy)}" width="${n(W * t)}" height="${n(H * t)}" fill="${th.ground}"/>`;
  // checker variation (pattern keeps the markup small)
  s += `<defs><pattern id="${id}-ck" x="${n(ox)}" y="${n(oy)}" width="${n(t * 2)}" height="${n(t * 2)}" patternUnits="userSpaceOnUse"><path d="M0 0h${n(t)}v${n(t)}H0zM${n(t)} ${n(t)}h${n(t)}v${n(t)}h${n(-t)}z" fill="${th.alt}"/></pattern>` +
    `<g id="${id}-T">${treeSym(0, 0, t, th)}</g><g id="${id}-R">${rockSym(0, 0, t, th)}</g><g id="${id}-H">${houseSym(0, 0, t, th)}</g></defs>`;
  s += `<rect x="${n(ox)}" y="${n(oy)}" width="${n(W * t)}" height="${n(H * t)}" fill="url(#${id}-ck)"/>`;
  // void + water tiles
  let water = '';
  let voids = '';
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const ch = cell(tx, ty);
      const r = `M${n(X(tx) - 0.3)} ${n(Y(ty) - 0.3)}h${n(t + 0.6)}v${n(t + 0.6)}h${n(-t - 0.6)}z`;
      if (ch === '~' || ch === 'B') water += r;
      else if (ch === 'X') voids += r;
    }
  }
  if (voids) {
    s += `<path d="${voids}" fill="${th.voidc}"/>`;
    if (th.lava) s += `<path d="${voids}" fill="#ff6b35" opacity="0.35"/>`;
  }
  if (water) {
    s += `<path d="${water}" fill="${darken(th.water, 0.25)}" transform="translate(0 ${n(t * 0.08)})"/><path d="${water}" fill="${th.water}"/>`;
    let shine = '';
    for (let ty = 0; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        if (cell(tx, ty) !== '~' || rnd() > 0.35) continue;
        const x = X(tx) + t * (0.2 + rnd() * 0.3);
        const y = Y(ty) + t * (0.3 + rnd() * 0.4);
        shine += `M${n(x)} ${n(y)}q${n(t * 0.15)} ${n(-t * 0.12)} ${n(t * 0.3)} 0`;
      }
    }
    s += `<path d="${shine}" fill="none" stroke="#fff" stroke-width="${n(t * 0.08)}" stroke-linecap="round" opacity="0.75"/>`;
  }
  // flowers
  let fl = '';
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      if (cell(tx, ty) !== ',') continue;
      for (let k = 0; k < 3; k++) {
        fl += `<circle cx="${n(X(tx) + t * (0.2 + rnd() * 0.6))}" cy="${n(Y(ty) + t * (0.2 + rnd() * 0.6))}" r="${n(t * 0.09)}" fill="${th.flower[k]}"/>`;
      }
    }
  }
  s += fl;
  // paths (Tracks v3: the map's canonical centrelines): border pass, then fill pass so flat
  // crossings merge into one road; buried tunnel sections are dashed, plank decks are drawn
  // where the road is over water, and the upper pass of every overpass is redrawn on top.
  const tracks = mapTracks(mapDef);
  const pl = (pts) => pts.map(([x, y]) => `${n(X(x))},${n(Y(y))}`).join(' ');
  const pieces = [];
  const buried = [];
  const decks = [];
  const wet = (x, y) => { const ch = cell(Math.floor(x), Math.floor(y)); return ch === '~' || ch === 'B'; };
  for (const tr of tracks) {
    const from = tr.fork ? tr.forkD - 0.2 : 0;
    const to = tr.join ? tr.joinD + 0.2 : tr.length;
    let cur = [];
    let bur = [];
    let dk = [];
    tr.points.forEach((p, i) => {
      const d = tr.cum[i];
      if (d < from || d > to) return;
      const hidden = (tr.tunnels || []).some(([a, b]) => d > a && d < b);
      if (hidden) {
        if (cur.length) cur.push(p);
        if (cur.length > 1) pieces.push(cur);
        cur = [];
        bur.push(p);
      } else {
        if (bur.length > 1) buried.push([...bur, p]);
        bur = [];
        cur.push(p);
      }
      if (!hidden && wet(p[0], p[1])) dk.push(p);
      else {
        if (dk.length > 1) decks.push(dk);
        dk = [];
      }
    });
    if (cur.length > 1) pieces.push(cur);
    if (bur.length > 1) buried.push(bur);
    if (dk.length > 1) decks.push(dk);
  }
  const lines = pieces.map(pl);
  for (const q of buried.map(pl)) s += `<polyline points="${q}" fill="none" stroke="${darken(th.ground, 0.22)}" stroke-width="${n(t * 0.7)}" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${q}" fill="none" stroke="${th.path}" stroke-opacity="0.75" stroke-width="${n(t * 0.13)}" stroke-dasharray="${n(t * 0.22)} ${n(t * 0.22)}"/>`;
  for (const q of lines) s += `<polyline points="${q}" fill="none" stroke="#000" stroke-opacity="0.12" stroke-width="${n(t * 1.02)}" stroke-linejoin="round" stroke-linecap="round" transform="translate(0 ${n(t * 0.1)})"/>`;
  for (const q of lines) s += `<polyline points="${q}" fill="none" stroke="${th.pathEdge}" stroke-width="${n(t * 0.98)}" stroke-linejoin="round" stroke-linecap="round"/>`;
  for (const q of lines) s += `<polyline points="${q}" fill="none" stroke="${th.path}" stroke-width="${n(t * 0.74)}" stroke-linejoin="round" stroke-linecap="round"/>`;
  for (const q of lines) s += `<polyline points="${q}" fill="none" stroke="${darken(th.path, 0.08)}" stroke-width="${n(t * 0.08)}" stroke-dasharray="${n(t * 0.25)} ${n(t * 0.45)}" stroke-linejoin="round"/>`;
  // plank decks over water
  for (const q of decks.map(pl)) s += `<polyline points="${q}" fill="none" stroke="#a47148" stroke-width="${n(t * 0.62)}" stroke-dasharray="${n(t * 0.09)} ${n(t * 0.07)}" opacity="0.7"/>`;
  // overpasses: the raised pass redrawn over the crossing, with a bridge outline
  for (const c of mapDef?.crossings || []) {
    if (c.mode !== 'bridge') continue;
    const pass = c[c.over];
    const tr = tracks[pass.path];
    if (!tr) continue;
    const seg = tr.points.filter((_, i) => Math.abs(tr.cum[i] - pass.d) < 1.0);
    if (seg.length < 2) continue;
    const q = pl(seg);
    s += `<polyline points="${q}" fill="none" stroke="#000" stroke-opacity="0.25" stroke-width="${n(t * 1.2)}" transform="translate(0 ${n(t * 0.16)})"/>`;
    s += `<polyline points="${q}" fill="none" stroke="#6b4428" stroke-width="${n(t * 1.12)}"/>`;
    s += `<polyline points="${q}" fill="none" stroke="${th.path}" stroke-width="${n(t * 0.76)}"/>`;
  }
  // tunnel portals
  const tmp = {};
  for (const tr of tracks) {
    for (const [a, b] of tr.tunnels || []) {
      for (const d of [a, b]) {
        pointAtDistance(tr.points, tr.cum, d, tmp);
        s += `<circle cx="${n(X(tmp.x))}" cy="${n(Y(tmp.y))}" r="${n(t * 0.42)}" fill="#2a2230" stroke="${lighten(th.rock, 0.2)}" stroke-width="${n(t * 0.14)}"/>`;
      }
    }
  }
  // props
  let props = '';
  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const ch = cell(tx, ty);
      const cx = X(tx + 0.5);
      const cy = Y(ty + 0.5);
      if (ch === 'T' || ch === 'R' || ch === 'H') props += `<use href="#${id}-${ch}" x="${n(cx)}" y="${n(cy)}"/>`;
    }
  }
  s += props;
  for (const d of mapDef?.decor || []) s += decorSym(d.type, X(d.x + 0.5), Y(d.y + 0.5), t);
  // spawn / exit markers where each road crosses the board edge, pointing along the road
  const onBoard = (x, y) => x >= 0 && y >= 0 && x <= W && y <= H;
  for (const tr of tracks) {
    if (!tr.fork) {
      const i = Math.max(0, tr.points.findIndex(([x, y]) => onBoard(x, y)));
      const [px, py] = tr.points[i];
      const [x, y] = tr.points[Math.min(tr.points.length - 1, i + 6)];
      s += arrow(X((px + x) / 2), Y((py + y) / 2), x - px, y - py, t, '#2bb673');
    }
    if (!tr.join) {
      let i = tr.points.length - 1;
      while (i > 0 && !onBoard(tr.points[i][0], tr.points[i][1])) i--;
      const [x, y] = tr.points[i];
      const [px, py] = tr.points[Math.max(0, i - 6)];
      const ex = Math.min(Math.max(x, 0.45), W - 0.45);
      const ey = Math.min(Math.max(y, 0.45), H - 0.45);
      s += `<circle cx="${n(X(ex))}" cy="${n(Y(ey))}" r="${n(t * 0.38)}" fill="#ff4d6d" stroke="#fff" stroke-width="${n(t * 0.08)}"/>`;
      s += arrow(X(ex), Y(ey), x - px, y - py, t * 0.6, '#fff');
    }
  }
  const label = mapDef?.name ? ` role="img" aria-label="${String(mapDef.name).replace(/"/g, '')}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice"${label}>${s}</svg>`;
}

// Track-shape metrics used by the silhouette tests (tests/data/world.test.js) and the dev
// contact-sheet scripts: a coarse raster IoU (where the road goes on the board) and a turning
// signature (how it bends: the sequence of signed curvature lobes between inflections).
// Pure functions over MapDef.tracks (src/core/track.js) — no DOM.

/**
 * Coarse occupancy raster of every track (cols × rows cells over the board).
 * @returns {Set<number>}
 */
export function silhouetteRaster(map, cols = 10, rows = 6) {
  const g = new Set();
  for (const t of map.tracks) {
    for (const [x, y] of t.points) {
      const gx = Math.floor(Math.min(0.999, Math.max(0, x / map.width)) * cols);
      const gy = Math.floor(Math.min(0.999, Math.max(0, y / map.height)) * rows);
      g.add(gx * 100 + gy);
    }
  }
  return g;
}

/** Intersection over union of two maps' coarse rasters. */
export function silhouetteIoU(a, b, cols = 10, rows = 6) {
  const A = silhouetteRaster(a, cols, rows);
  const B = silhouetteRaster(b, cols, rows);
  let inter = 0;
  for (const k of A) if (B.has(k)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * Signed turning lobes of one track's own section (shared fork prefix / join suffix excluded):
 * the curvature is measured over a ±`win` tile window, samples bending tighter than radius
 * `maxR` belong to a lobe, consecutive lobes turning the same way are merged across straights
 * (a racetrack's two 180° ends become one 360° lobe), and lobes under `minDeg` are dropped
 * (then merged again). Positive = clockwise on screen (+x towards +y), degrees, rounded.
 * @returns {number[]}
 */
export function trackLobes(track, { win = 0.5, maxR = 8, minDeg = 50 } = {}) {
  const p = track.points;
  const cum = track.cum;
  const d0 = track.fork ? track.forkD : 0;
  const d1 = track.join ? track.joinD : track.length;
  const idx = [];
  for (let i = 0; i < p.length; i++) if (cum[i] >= d0 - 1e-6 && cum[i] <= d1 + 1e-6) idx.push(i);
  if (idx.length < 4) return [];
  // unwrapped heading of each segment
  const h = [];
  for (let k = 1; k < idx.length; k++) {
    const a = p[idx[k - 1]];
    const b = p[idx[k]];
    let ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    if (h.length) {
      const prev = h[h.length - 1];
      while (ang - prev > Math.PI) ang -= 2 * Math.PI;
      while (ang - prev < -Math.PI) ang += 2 * Math.PI;
    }
    h.push(ang);
  }
  const step = (d1 - d0) / Math.max(1, h.length);
  const K = Math.max(1, Math.round(win / step));
  const kMin = 1 / maxR;
  // per-segment turn and its sign class from the windowed curvature
  const raw = [];
  let cur = null;
  for (let k = 1; k < h.length; k++) {
    const lo = Math.max(0, k - K);
    const hi = Math.min(h.length - 1, k + K);
    const kappa = (h[hi] - h[lo]) / ((hi - lo) * step);
    const s = kappa > kMin ? 1 : kappa < -kMin ? -1 : 0;
    const dt = h[k] - h[k - 1];
    if (s === 0) continue;
    if (cur && cur.s === s) cur.turn += dt;
    else {
      cur = { s, turn: dt };
      raw.push(cur);
    }
  }
  const merge = (list) => {
    const out = [];
    for (const l of list) {
      const last = out[out.length - 1];
      if (last && Math.sign(last) === Math.sign(l)) out[out.length - 1] = last + l;
      else out.push(l);
    }
    return out;
  };
  let lobes = merge(raw.map((r) => (r.turn * 180) / Math.PI));
  lobes = merge(lobes.filter((v) => Math.abs(v) >= minDeg));
  return lobes.map((v) => Math.round(v));
}

/** Per-track lobe lists of a map. */
export function turningSignature(map, o) {
  return map.tracks.map((t) => trackLobes(t, o));
}

/** Compact text form, e.g. "+180 -180 +180 | -90". */
export function signatureText(sig) {
  return sig.map((l) => l.map((v) => (v > 0 ? `+${v}` : `${v}`)).join(' ') || '·').join(' | ');
}

const variants = (l) => {
  const rev = [...l].reverse().map((v) => -v);
  return [l, l.map((v) => -v), rev, rev.map((v) => -v)];
};

/** Same lobe sequence (up to mirroring / running it backwards), each lobe within `tol` degrees. */
export function lobesMatch(a, b, tol = 50) {
  if (a.length !== b.length) return false;
  if (!a.length) return true;
  return variants(b).some((v) => v.every((x, i) => Math.abs(x - a[i]) <= tol));
}

/** Two maps bend the same way: same number of tracks and every track's lobes match (any pairing). */
export function signaturesMatch(sa, sb, tol = 50) {
  if (sa.length !== sb.length) return false;
  const used = new Array(sb.length).fill(false);
  const go = (i) => {
    if (i === sa.length) return true;
    for (let j = 0; j < sb.length; j++) {
      if (used[j] || !lobesMatch(sa[i], sb[j], tol)) continue;
      used[j] = true;
      if (go(i + 1)) return true;
      used[j] = false;
    }
    return false;
  };
  return go(0);
}

/**
 * A meander: one path that makes at least three U-bends (≥ 140°) in a row, alternating left /
 * right, without turning round overall (|net turn| ≤ 150°) — the "U-bends marching across the
 * board" family.
 */
export function isMeander(sig) {
  if (sig.length !== 1) return false;
  const l = sig[0];
  const net = l.reduce((a, b) => a + b, 0);
  if (Math.abs(net) > 150) return false;
  let run = 0;
  let best = 0;
  for (let i = 0; i < l.length; i++) {
    const big = Math.abs(l[i]) >= 140;
    if (!big) run = 0;
    else if (run > 0 && Math.sign(l[i]) !== Math.sign(l[i - 1])) run++;
    else run = 1;
    best = Math.max(best, run);
  }
  return best >= 3;
}

/** Total number of lobes over all tracks. */
export const lobeCount = (sig) => sig.reduce((a, l) => a + l.length, 0);

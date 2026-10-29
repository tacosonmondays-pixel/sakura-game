// City kit (Gate Arc, Noon `city` theme): what the city paints into the ground texture on top
// of the paving (textures.paintGround `extra` hook, 0 draw calls): planted verges on ',' tiles
// (rounded beds with mowing stripes and a few blossoms) and the map's painted areas
// (MapDef.city.areas: plaza rosettes and lawns). Under the paving (the `base` hook): the reservoir
// park's islands (look.city.isle; cityIslePainter).

/**
 * @param {object} map MapDef (map.city.areas: [{ type: 'plaza'|'lawn', x, y, w, h }])
 * @param {object} look resolved look
 * @param {(x: number, y: number) => string} charAt
 * @param {(x: number, y: number) => boolean} isPath
 * @returns {(g: CanvasRenderingContext2D, toPx: Function, px: number, rnd: Function) => void}
 */
export function cityGroundPainter(map, look, charAt, isPath) {
  const areas = map.city?.areas || [];
  const lawn = look.city?.lawn || '#9fcf7c';
  const plaza = look.city?.plaza || ['#efe4d2', '#e6d2bc'];
  return (g, toPx, px, rnd) => {
    const rr = (x, y, w, h, r) => {
      g.beginPath();
      g.roundRect(x, y, w, h, r);
    };
    // planted verges on ',' tiles
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        if (charAt(tx, ty) !== ',' || isPath(tx, ty)) continue;
        const [sx, sy] = toPx(tx, ty);
        g.fillStyle = lawn;
        rr(sx + 1, sy + 1, px - 2, px - 2, px * 0.18);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.12)';
        for (let k = 0; k < 4; k += 2) g.fillRect(sx + 2 + (k * (px - 4)) / 4, sy + 2, (px - 4) / 4, px - 4);
        for (let k = 0; k < 3; k++) {
          g.fillStyle = ['#ffffff', '#ffc4d9', '#ffe680'][k];
          g.beginPath();
          g.arc(sx + px * (0.2 + rnd() * 0.6), sy + px * (0.2 + rnd() * 0.6), px * 0.05, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    for (const a of areas) {
      const [x0, y0] = toPx(a.x, a.y);
      const w = a.w * px;
      const h = a.h * px;
      if (a.type === 'plaza') {
        // a rosette of warm paving slabs
        const cx = x0 + w / 2;
        const cy = y0 + h / 2;
        const R = Math.min(w, h) / 2;
        for (let k = 5; k >= 1; k--) {
          g.fillStyle = plaza[k % 2];
          g.beginPath();
          g.arc(cx, cy, (R * k) / 5, 0, Math.PI * 2);
          g.fill();
        }
        g.strokeStyle = 'rgba(160,140,120,0.45)';
        g.lineWidth = 1;
        for (let k = 0; k < 16; k++) {
          const ang = (k / 16) * Math.PI * 2;
          g.beginPath();
          g.moveTo(cx + Math.cos(ang) * R * 0.2, cy + Math.sin(ang) * R * 0.2);
          g.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
          g.stroke();
        }
      } else if (a.type === 'lawn') {
        g.fillStyle = lawn;
        rr(x0, y0, w, h, px * 0.3);
        g.fill();
      }
    }
  };
}

/**
 * The reservoir park's islands (Gate Arc 5-10, look.city.isle: themes.js PARK): every patch of land
 * that water rings on all sides (it never reaches the board's edge) is a mown island lawn with a
 * pale stone shore band round it, mowing stripes, a few tufts and blossoms, and a path of stepping
 * stones from its great willow (map decor 'greatWillow') down to the island's front-left shore. The
 * colours keep the island lighter than the water round it and darker than the park road (night and
 * fog included). Painted before the shore wash and the sidewalks (textures.paintGround `base`), so
 * those still paint over it. Null when the look has no isle colours or the map has no island.
 * @param {object} map MapDef
 * @param {object} look resolved look (look.city.isle: { lawn, stripe, tuft, shore, stone, blossoms })
 * @returns {((g: CanvasRenderingContext2D, toPx: Function, px: number) => void)|null}
 */
export function cityIslePainter(map, look) {
  const isle = look.city?.isle;
  if (!isle) return null;
  const isles = findIsles(map);
  if (!isles.length) return null;
  const trees = (map.decor || []).filter((d) => d.type === 'greatWillow');
  return (g, toPx, px) => {
    // (its own deterministic stream: the ground painter's rnd stays as it was for the later steps)
    let seed = 7919;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (const it of isles) {
      const [x0, y0] = toPx(it.x0, it.y0);
      const w = (it.x1 - it.x0) * px;
      const h = (it.y1 - it.y0) * px;
      const band = px * 0.3;
      // the island's outline: a rounded rectangle when it fills its box, else its tiles
      const shape = (inset, r) => {
        g.beginPath();
        if (it.full) {
          g.roundRect(x0 + inset, y0 + inset, w - inset * 2, h - inset * 2, r);
          return;
        }
        for (const [tx, ty] of it.tiles) {
          const [sx, sy] = toPx(tx, ty);
          const l = it.has(tx - 1, ty) ? 0 : inset;
          const r2 = it.has(tx + 1, ty) ? 0 : inset;
          const t = it.has(tx, ty - 1) ? 0 : inset;
          const b2 = it.has(tx, ty + 1) ? 0 : inset;
          g.rect(sx + l, sy + t, px - l - r2, px - t - b2);
        }
      };
      // the shore band: pale stones, a few darker pebbles along it
      g.fillStyle = isle.shore;
      shape(0, px * 0.5);
      g.fill();
      g.fillStyle = 'rgba(0,0,0,0.14)';
      const per = Math.round((w + h) / px) * 3;
      for (let k = 0; k < per; k++) {
        const side = k % 4;
        const u = rnd();
        const d = band * (0.3 + rnd() * 0.5);
        const sx = side === 1 ? x0 + w - d : side === 3 ? x0 + d : x0 + u * w;
        const sy = side === 0 ? y0 + d : side === 2 ? y0 + h - d : y0 + u * h;
        g.beginPath();
        g.arc(sx, sy, px * (0.03 + rnd() * 0.03), 0, Math.PI * 2);
        g.fill();
      }
      // the lawn inside it, with mowing stripes
      g.fillStyle = isle.lawn;
      shape(band, px * 0.35);
      g.fill();
      g.save();
      shape(band, px * 0.35);
      g.clip();
      g.fillStyle = isle.stripe;
      for (let k = 0, sx = x0; sx < x0 + w; k++, sx += px * 0.5) if (k % 2) g.fillRect(sx, y0, px * 0.5, h);
      // tufts (a darker green) and a few blossoms
      g.strokeStyle = isle.tuft;
      g.lineWidth = Math.max(1, px * 0.04);
      for (let k = 0; k < it.tiles.length * 2; k++) {
        const [tx, ty] = it.tiles[k % it.tiles.length];
        const [sx, sy] = toPx(tx + 0.15 + rnd() * 0.7, ty + 0.15 + rnd() * 0.7);
        g.beginPath();
        g.moveTo(sx - px * 0.06, sy + px * 0.04);
        g.lineTo(sx, sy - px * 0.06);
        g.lineTo(sx + px * 0.06, sy + px * 0.04);
        g.stroke();
        if (k % 3 === 0) {
          g.fillStyle = isle.blossoms[k % isle.blossoms.length];
          g.beginPath();
          g.arc(sx + px * 0.12, sy + px * 0.1, px * 0.045, 0, Math.PI * 2);
          g.fill();
        }
      }
      // stepping stones from the great willow down to the island's front-left shore, in a gentle S
      for (const tr of trees) {
        if (!it.has(tr.x, tr.y)) continue;
        const ax = tr.x + 0.5;
        const az = tr.y + 0.5;
        const bx = it.x0 + 0.35;
        const bz = it.y1 - 0.35;
        const len = Math.hypot(bx - ax, bz - az);
        const nx = -(bz - az) / len;
        const nz = (bx - ax) / len;
        const n = Math.max(3, Math.round(len / 0.42));
        for (let k = 1; k <= n; k++) {
          const t = k / n;
          const wob = Math.sin(t * Math.PI * 2) * 0.22;
          const [sx, sy] = toPx(ax + (bx - ax) * t + nx * wob, az + (bz - az) * t + nz * wob);
          const rx = px * (0.15 + rnd() * 0.04);
          const ry = px * (0.11 + rnd() * 0.03);
          const rot = rnd() * Math.PI;
          g.fillStyle = 'rgba(0,0,0,0.18)';
          g.beginPath();
          g.ellipse(sx + px * 0.02, sy + px * 0.03, rx, ry, rot, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = isle.stone;
          g.beginPath();
          g.ellipse(sx, sy, rx, ry, rot, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.restore();
    }
  };
}

/**
 * The map's islands: 4-connected patches of land (anything but '~' / 'B') of at least 4 tiles that
 * never touch the board's edge (water rings them; a road stamped over a corner still counts as land).
 * @param {object} map MapDef
 * @returns {{ tiles: number[][], has: (x: number, y: number) => boolean, x0: number, y0: number, x1: number, y1: number, full: boolean }[]}
 */
export function findIsles(map) {
  const W = map.width;
  const H = map.height;
  const land = (x, y) => x >= 0 && y >= 0 && x < W && y < H && map.rows[y][x] !== '~' && map.rows[y][x] !== 'B';
  const seen = new Set();
  const out = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!land(x, y) || seen.has(`${x},${y}`)) continue;
      const tiles = [];
      const keys = new Set();
      let edge = false;
      const stack = [[x, y]];
      seen.add(`${x},${y}`);
      while (stack.length) {
        const [cx, cy] = stack.pop();
        tiles.push([cx, cy]);
        keys.add(`${cx},${cy}`);
        if (cx === 0 || cy === 0 || cx === W - 1 || cy === H - 1) edge = true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (!land(nx, ny) || seen.has(`${nx},${ny}`)) continue;
          seen.add(`${nx},${ny}`);
          stack.push([nx, ny]);
        }
      }
      if (edge || tiles.length < 4) continue;
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const [tx, ty] of tiles) {
        x0 = Math.min(x0, tx);
        y0 = Math.min(y0, ty);
        x1 = Math.max(x1, tx + 1);
        y1 = Math.max(y1, ty + 1);
      }
      tiles.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      out.push({ tiles, has: (tx, ty) => keys.has(`${tx},${ty}`), x0, y0, x1, y1, full: tiles.length === (x1 - x0) * (y1 - y0) });
    }
  }
  return out;
}

// City kit (Gate Arc, Noon `city` theme): what the city paints into the ground texture on top
// of the paving (textures.paintGround `extra` hook, 0 draw calls): planted verges on ',' tiles
// (rounded beds with mowing stripes and a few blossoms) and the map's painted areas
// (MapDef.city.areas: plaza rosettes and lawns).

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

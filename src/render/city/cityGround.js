// Modern-city kit (prototype): what the city paints into the ground texture on top of the
// paving (textures.paintGround `extra` hook): lawns on ',' tiles, plaza rosettes, the campus
// sports field (running track) and court, and — after the surge — scorch marks and craters.
import { hash } from '../geo.js';

/**
 * @param {object} map MapDef (map.city.areas: { type: plaza|lawn|field|court, x, y, w, h })
 * @param {object} look resolved look
 * @param {(x: number, y: number) => string} charAt
 * @param {(x: number, y: number) => boolean} isPath
 * @returns {(g: CanvasRenderingContext2D, toPx: Function, px: number, rnd: Function) => void}
 */
export function cityGroundPainter(map, look, charAt, isPath) {
  const war = !!look.city?.war;
  const areas = map.city?.areas || [];
  return (g, toPx, px, rnd) => {
    const rr = (x, y, w, h, r) => {
      g.beginPath();
      g.roundRect(x, y, w, h, r);
    };
    // lawns on ',' tiles: rounded beds with mowing stripes and a few blossoms
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        if (charAt(tx, ty) !== ',' || isPath(tx, ty)) continue;
        const [sx, sy] = toPx(tx, ty);
        g.fillStyle = war ? '#6f735f' : '#9ad97c';
        rr(sx + 1, sy + 1, px - 2, px - 2, px * 0.18);
        g.fill();
        g.fillStyle = war ? 'rgba(60,58,50,0.35)' : 'rgba(255,255,255,0.12)';
        for (let k = 0; k < 4; k += 2) g.fillRect(sx + 2 + (k * (px - 4)) / 4, sy + 2, (px - 4) / 4, px - 4);
        if (!war) {
          for (let k = 0; k < 3; k++) {
            g.fillStyle = ['#ffffff', '#ffc4d9', '#ff9ec4'][k];
            g.beginPath();
            g.arc(sx + px * (0.2 + rnd() * 0.6), sy + px * (0.2 + rnd() * 0.6), px * 0.05, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    }
    for (const a of areas) {
      const [x0, y0] = toPx(a.x, a.y);
      const w = a.w * px;
      const h = a.h * px;
      if (a.type === 'plaza') {
        // concentric rosette of pale and pink slabs
        const cx = x0 + w / 2;
        const cy = y0 + h / 2;
        const R = Math.min(w, h) / 2;
        for (let k = 5; k >= 1; k--) {
          g.fillStyle = war ? (k % 2 ? '#9a96a0' : '#86828c') : (k % 2 ? '#fbf4f6' : '#ffe1ea');
          g.beginPath();
          g.arc(cx, cy, (R * k) / 5, 0, Math.PI * 2);
          g.fill();
        }
        g.strokeStyle = war ? 'rgba(60,56,66,0.5)' : 'rgba(210,190,200,0.6)';
        g.lineWidth = 1;
        for (let k = 0; k < 16; k++) {
          const ang = (k / 16) * Math.PI * 2;
          g.beginPath();
          g.moveTo(cx + Math.cos(ang) * R * 0.2, cy + Math.sin(ang) * R * 0.2);
          g.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
          g.stroke();
        }
      } else if (a.type === 'lawn') {
        g.fillStyle = war ? '#6f735f' : '#9ad97c';
        rr(x0, y0, w, h, px * 0.3);
        g.fill();
      } else if (a.type === 'field') {
        // running track (soft terracotta) round a striped green field
        g.fillStyle = '#ee9c84';
        rr(x0, y0, w, h, h / 2);
        g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.85)';
        g.lineWidth = Math.max(1, px * 0.04);
        for (let k = 1; k <= 3; k++) {
          const i = (k * px * 0.5) / 3.2;
          rr(x0 + i, y0 + i, w - i * 2, h - i * 2, Math.max(1, h / 2 - i));
          g.stroke();
        }
        const ins = px * 0.55;
        g.save();
        rr(x0 + ins, y0 + ins, w - ins * 2, h - ins * 2, Math.max(1, h / 2 - ins));
        g.clip();
        for (let k = 0; k < 10; k++) {
          g.fillStyle = k % 2 ? '#8fd472' : '#9ddd80';
          g.fillRect(x0 + (k * w) / 10, y0, w / 10 + 1, h);
        }
        g.strokeStyle = 'rgba(255,255,255,0.9)';
        g.lineWidth = Math.max(1, px * 0.05);
        g.beginPath();
        g.moveTo(x0 + w / 2, y0);
        g.lineTo(x0 + w / 2, y0 + h);
        g.stroke();
        g.beginPath();
        g.arc(x0 + w / 2, y0 + h / 2, px * 0.55, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      } else if (a.type === 'court') {
        g.fillStyle = '#8cc6ef';
        rr(x0, y0, w, h, px * 0.1);
        g.fill();
        g.strokeStyle = '#ffffff';
        g.lineWidth = Math.max(1, px * 0.05);
        g.strokeRect(x0 + px * 0.15, y0 + px * 0.15, w - px * 0.3, h - px * 0.3);
        g.beginPath();
        g.moveTo(x0 + w / 2, y0 + px * 0.15);
        g.lineTo(x0 + w / 2, y0 + h - px * 0.15);
        g.stroke();
        g.beginPath();
        g.arc(x0 + w / 2, y0 + h / 2, px * 0.4, 0, Math.PI * 2);
        g.stroke();
      }
    }
    if (war) {
      // scorch marks and shallow craters on the paving (never on the road)
      const n = Math.round(map.width * map.height * 0.06);
      for (let i = 0; i < n; i++) {
        const h = hash(map.id, 'scorch', i);
        const wx = -3 + ((h % 1000) / 1000) * (map.width + 6);
        const wz = -2 + (((h >>> 10) % 1000) / 1000) * (map.height + 4);
        if (isPath(Math.floor(wx), Math.floor(wz))) continue;
        const [sx, sy] = toPx(wx, wz);
        const r = px * (0.4 + ((h >>> 20) % 10) / 10);
        const gr = g.createRadialGradient(sx, sy, 0, sx, sy, r);
        gr.addColorStop(0, 'rgba(30,24,30,0.55)');
        gr.addColorStop(0.6, 'rgba(40,34,40,0.25)');
        gr.addColorStop(1, 'rgba(40,34,40,0)');
        g.fillStyle = gr;
        g.fillRect(sx - r, sy - r, r * 2, r * 2);
        if (h % 3 === 0) {
          g.strokeStyle = 'rgba(180,170,175,0.35)';
          g.lineWidth = 1.5;
          g.beginPath();
          g.arc(sx, sy, r * 0.45, 0, Math.PI * 2);
          g.stroke();
        }
      }
    }
  };
}

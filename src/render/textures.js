// Canvas-generated textures for the battle renderer: one sprite atlas (particles, rings,
// icons, glyphs) and tileable surface textures (grass detail, path styles).
import * as THREE from 'three';

const ATLAS_SIZE = 1024;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Simple shelf packer. */
class Packer {
  constructor(size) {
    this.size = size;
    this.x = 0;
    this.y = 0;
    this.rowH = 0;
  }

  alloc(w, h) {
    const pad = 2;
    if (this.x + w + pad > this.size) {
      this.x = 0;
      this.y += this.rowH + pad;
      this.rowH = 0;
    }
    const r = { x: this.x, y: this.y, w, h };
    this.x += w + pad;
    this.rowH = Math.max(this.rowH, h);
    return r;
  }
}

const GLYPHS = '0123456789+-!x%ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Builds the sprite atlas. Returns { texture, regions: {name: [u0,v0,u1,v1]}, glyph(ch), glyphAspect }.
 * All sprites are white/greyscale so they can be tinted by instance colour.
 */
export function createAtlas() {
  const c = canvas(ATLAS_SIZE, ATLAS_SIZE);
  const g = c.getContext('2d');
  const pk = new Packer(ATLAS_SIZE);
  const regions = {};
  const add = (name, w, h, draw) => {
    const r = pk.alloc(w, h);
    g.save();
    g.translate(r.x, r.y);
    g.beginPath();
    g.rect(0, 0, w, h);
    g.clip();
    draw(g, w, h);
    g.restore();
    // inset half a texel to avoid bleeding
    regions[name] = [(r.x + 0.5) / ATLAS_SIZE, 1 - (r.y + h - 0.5) / ATLAS_SIZE, (r.x + w - 0.5) / ATLAS_SIZE, 1 - (r.y + 0.5) / ATLAS_SIZE];
  };

  const radial = (stops) => (ctx, w, h) => {
    const gr = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    for (const [o, col] of stops) gr.addColorStop(o, col);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
  };

  add('white', 8, 8, (ctx, w, h) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
  });
  add('glow', 64, 64, radial([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.75)'], [0.6, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']]));
  add('soft', 64, 64, radial([[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]));
  add('shadow', 64, 64, radial([[0, 'rgba(255,255,255,0.9)'], [0.55, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]));
  add('dot', 32, 32, (ctx, w) => {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(w / 2, w / 2, w / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
  });
  add('spark', 64, 64, (ctx, w, h) => {
    radial([[0, 'rgba(255,255,255,0.9)'], [0.3, 'rgba(255,255,255,0.25)'], [1, 'rgba(255,255,255,0)']])(ctx, w, h);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    const cx = w / 2;
    const cy = h / 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? w / 2 - 1 : w * 0.09;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  });
  add('star', 64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const r = i % 2 === 0 ? w / 2 - 2 : w * 0.2;
      ctx.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  });
  const ring = (lw, dashed = false) => (ctx, w) => {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = lw;
    if (dashed) ctx.setLineDash([w * 0.09, w * 0.06]);
    ctx.beginPath();
    ctx.arc(w / 2, w / 2, w / 2 - lw / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  };
  add('ring', 128, 128, ring(5));
  add('ringThick', 128, 128, ring(12));
  add('ringDashed', 128, 128, ring(6, true));
  add('ringSoft', 128, 128, (ctx, w, h) => {
    const gr = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.75, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.88, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
  });
  add('disc', 128, 128, (ctx, w, h) => {
    const gr = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0.35)');
    gr.addColorStop(0.85, 'rgba(255,255,255,0.6)');
    gr.addColorStop(0.95, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
  });
  add('smoke', 64, 64, (ctx, w, h) => {
    const blobs = [[0.5, 0.55, 0.32], [0.33, 0.5, 0.22], [0.68, 0.48, 0.24], [0.5, 0.35, 0.22], [0.45, 0.66, 0.2]];
    for (const [x, y, r] of blobs) {
      const gr = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w);
      gr.addColorStop(0, 'rgba(255,255,255,0.85)');
      gr.addColorStop(0.7, 'rgba(255,255,255,0.5)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, w, h);
    }
  });
  add('petal', 32, 32, (ctx, w, h) => {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(w / 2, 2);
    ctx.bezierCurveTo(w - 2, h * 0.3, w * 0.8, h - 4, w / 2, h - 2);
    ctx.bezierCurveTo(w * 0.2, h - 4, 2, h * 0.3, w / 2, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,200,220,0.6)';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.65, w * 0.12, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  add('snow', 32, 32, radial([[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]));
  add('rain', 8, 64, (ctx, w, h) => {
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(1, 'rgba(255,255,255,0.9)');
    ctx.fillStyle = gr;
    ctx.fillRect(w / 2 - 1.5, 0, 3, h);
  });
  add('beam', 16, 64, (ctx, w, h) => {
    // horizontal axis = along the beam (u), vertical = across (v)
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    gr.addColorStop(0.5, 'rgba(255,255,255,1)');
    gr.addColorStop(0.65, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
  });
  add('slash', 128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(4, h * 0.8);
    ctx.quadraticCurveTo(w / 2, -h * 0.25, w - 4, h * 0.8);
    ctx.quadraticCurveTo(w / 2, h * 0.2, 4, h * 0.8);
    ctx.fill();
  });
  add('coin', 64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#ffd43b';
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.arc(w * 0.4, h * 0.38, w * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d99a00';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.24, 0, Math.PI * 2);
    ctx.stroke();
  });
  add('heart', 64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#1d2b4f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.86);
    ctx.bezierCurveTo(w * 0.05, h * 0.55, w * 0.1, h * 0.12, w / 2, h * 0.3);
    ctx.bezierCurveTo(w * 0.9, h * 0.12, w * 0.95, h * 0.55, w / 2, h * 0.86);
    ctx.fill();
    ctx.stroke();
  });
  add('chevron', 64, 64, (ctx, w, h) => {
    // points to +u (right)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(w * 0.22, h * 0.12);
    ctx.lineTo(w * 0.78, h * 0.5);
    ctx.lineTo(w * 0.22, h * 0.88);
    ctx.lineTo(w * 0.22, h * 0.64);
    ctx.lineTo(w * 0.48, h * 0.5);
    ctx.lineTo(w * 0.22, h * 0.36);
    ctx.closePath();
    ctx.fill();
  });
  add('rune', 128, 128, (ctx, w, h) => {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const b = ((i + 2) / 6) * Math.PI * 2 - Math.PI / 2;
      const r = w / 2 - 18;
      ctx.moveTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
      ctx.lineTo(w / 2 + Math.cos(b) * r, h / 2 + Math.sin(b) * r);
    }
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.fillStyle = '#fff';
      ctx.fillRect(w / 2 + Math.cos(a) * (w / 2 - 12) - 2, h / 2 + Math.sin(a) * (w / 2 - 12) - 2, 4, 4);
    }
  });
  add('warn', 64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#1d2b4f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w / 2, 5);
    ctx.lineTo(w - 5, h - 7);
    ctx.lineTo(5, h - 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1d2b4f';
    ctx.fillRect(w / 2 - 3.5, h * 0.32, 7, h * 0.3);
    ctx.fillRect(w / 2 - 3.5, h * 0.7, 7, 7);
  });
  add('shard', 32, 32, (ctx, w, h) => {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(w / 2, 1);
    ctx.lineTo(w * 0.85, h * 0.55);
    ctx.lineTo(w / 2, h - 1);
    ctx.lineTo(w * 0.2, h * 0.45);
    ctx.closePath();
    ctx.fill();
  });
  add('bubble', 32, 32, (ctx, w) => {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w / 2, w / 2, w / 2 - 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(w * 0.38, w * 0.36, w * 0.1, 0, Math.PI * 2);
    ctx.fill();
  });
  add('leaf', 32, 32, (ctx, w, h) => {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w * 0.2, h * 0.44, 0.5, 0, Math.PI * 2);
    ctx.fill();
  });
  add('note', 32, 32, (ctx, w, h) => {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(w * 0.36, h * 0.74, w * 0.2, h * 0.14, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(w * 0.5, h * 0.12, 4, h * 0.62);
    ctx.fillRect(w * 0.5, h * 0.12, w * 0.3, 5);
  });

  // Status icons: white silhouettes inside a navy circle; tinted per status.
  const icon = (name, draw) => add(name, 48, 48, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d2b4f';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    draw(ctx, w, h);
  });
  icon('st_burn', (ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.18);
    ctx.bezierCurveTo(w * 0.78, h * 0.42, w * 0.74, h * 0.8, w / 2, h * 0.8);
    ctx.bezierCurveTo(w * 0.26, h * 0.8, w * 0.24, h * 0.5, w * 0.4, h * 0.38);
    ctx.bezierCurveTo(w * 0.42, h * 0.52, w * 0.5, h * 0.5, w / 2, h * 0.18);
    ctx.fill();
  });
  icon('st_poison', (ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.18);
    ctx.bezierCurveTo(w * 0.78, h * 0.5, w * 0.72, h * 0.8, w / 2, h * 0.8);
    ctx.bezierCurveTo(w * 0.28, h * 0.8, w * 0.22, h * 0.5, w / 2, h * 0.18);
    ctx.fill();
  });
  icon('st_slow', (ctx, w, h) => {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(a) * w * 0.3, h / 2 + Math.sin(a) * h * 0.3);
      ctx.lineTo(w / 2 - Math.cos(a) * w * 0.3, h / 2 - Math.sin(a) * h * 0.3);
      ctx.stroke();
    }
  });
  icon('st_shock', (ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(w * 0.56, h * 0.16);
    ctx.lineTo(w * 0.3, h * 0.54);
    ctx.lineTo(w * 0.5, h * 0.54);
    ctx.lineTo(w * 0.42, h * 0.84);
    ctx.lineTo(w * 0.72, h * 0.44);
    ctx.lineTo(w * 0.52, h * 0.44);
    ctx.closePath();
    ctx.fill();
  });
  icon('st_stun', (ctx, w, h) => {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const x = w / 2 + Math.cos(a) * w * 0.18;
      const y = h / 2 + Math.sin(a) * h * 0.18;
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const b = -Math.PI / 2 + (k / 10) * Math.PI * 2;
        const r = k % 2 === 0 ? w * 0.12 : w * 0.05;
        ctx.lineTo(x + Math.cos(b) * r, y + Math.sin(b) * r);
      }
      ctx.fill();
    }
  });
  icon('st_shred', (ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.2);
    ctx.lineTo(w * 0.76, h * 0.3);
    ctx.lineTo(w * 0.72, h * 0.6);
    ctx.lineTo(w / 2, h * 0.82);
    ctx.lineTo(w * 0.28, h * 0.6);
    ctx.lineTo(w * 0.24, h * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1d2b4f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w * 0.56, h * 0.22);
    ctx.lineTo(w * 0.44, h * 0.48);
    ctx.lineTo(w * 0.58, h * 0.58);
    ctx.lineTo(w * 0.46, h * 0.82);
    ctx.stroke();
  });
  icon('st_mark', (ctx, w, h) => {
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.14);
    ctx.lineTo(w / 2, h * 0.86);
    ctx.moveTo(w * 0.14, h / 2);
    ctx.lineTo(w * 0.86, h / 2);
    ctx.stroke();
  });
  icon('st_silence', (ctx, w, h) => {
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.32, h * 0.68);
    ctx.lineTo(w * 0.68, h * 0.32);
    ctx.stroke();
  });
  icon('st_reveal', (ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(w * 0.16, h / 2);
    ctx.quadraticCurveTo(w / 2, h * 0.16, w * 0.84, h / 2);
    ctx.quadraticCurveTo(w / 2, h * 0.84, w * 0.16, h / 2);
    ctx.fill();
    ctx.fillStyle = '#1d2b4f';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.11, 0, Math.PI * 2);
    ctx.fill();
  });
  icon('st_soak', (ctx, w, h) => {
    ctx.beginPath();
    ctx.moveTo(w * 0.36, h * 0.24);
    ctx.bezierCurveTo(w * 0.5, h * 0.48, w * 0.5, h * 0.6, w * 0.36, h * 0.62);
    ctx.bezierCurveTo(w * 0.22, h * 0.6, w * 0.22, h * 0.48, w * 0.36, h * 0.24);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.64, h * 0.4);
    ctx.bezierCurveTo(w * 0.78, h * 0.64, w * 0.78, h * 0.76, w * 0.64, h * 0.78);
    ctx.bezierCurveTo(w * 0.5, h * 0.76, w * 0.5, h * 0.64, w * 0.64, h * 0.4);
    ctx.fill();
  });
  icon('st_freeze', (ctx, w, h) => {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(a) * w * 0.3, h / 2 + Math.sin(a) * h * 0.3);
      ctx.lineTo(w / 2 - Math.cos(a) * w * 0.3, h / 2 - Math.sin(a) * h * 0.3);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.1, 0, Math.PI * 2);
    ctx.fill();
  });

  // Glyphs: bold white with a navy outline (tint multiplies the fill; outline stays dark).
  const glyphW = 40;
  const glyphH = 56;
  for (const ch of GLYPHS) {
    add(`g_${ch}`, glyphW, glyphH, (ctx, w, h) => {
      ctx.font = `900 ${Math.round(h * 0.82)}px "Arial Black", "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#1d2b4f';
      const label = ch === 'x' ? '×' : ch;
      ctx.strokeText(label, w / 2, h / 2 + 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, w / 2, h / 2 + 2);
    });
  }

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 2;
  return {
    texture,
    regions,
    glyph: (ch) => regions[`g_${ch}`] || null,
    glyphAspect: glyphW / glyphH,
  };
}

/** Tileable grass detail (greyscale around 1.0 so it can multiply vertex colours). */
export function grassTexture(seed = 7) {
  const size = 256;
  const c = canvas(size, size);
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(236,236,236)';
  g.fillRect(0, 0, size, size);
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  // soft mottling
  for (let i = 0; i < 40; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 20 + rnd() * 40;
    const v = rnd() > 0.5 ? 255 : 210;
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, `rgba(${v},${v},${v},0.25)`);
      gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr;
      g.fillRect(0, 0, size, size);
    }
  }
  // blades
  for (let i = 0; i < 900; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const l = 3 + rnd() * 5;
    const v = rnd() > 0.5 ? 255 : 195;
    g.strokeStyle = `rgba(${v},${v},${v},0.45)`;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rnd() - 0.5) * 2.5, y - l);
    g.stroke();
  }
  return finishTileTex(c);
}

/**
 * Tileable path surface. style: flagstone | cobble | planks | metal | dirt | brick.
 * One texture repeat = 1 tile.
 */
export function pathTexture(style = 'flagstone', seed = 3) {
  const size = 256;
  const c = canvas(size, size);
  const g = c.getContext('2d');
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const base = 238;
  g.fillStyle = `rgb(${base},${base},${base})`;
  g.fillRect(0, 0, size, size);
  const stone = (x, y, w, h, r) => {
    const v = 225 + Math.floor(rnd() * 30);
    g.fillStyle = `rgb(${v},${v},${v})`;
    roundRect(g, x, y, w, h, r);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    roundRect(g, x + 3, y + 3, w - 10, Math.max(3, h * 0.25), r * 0.6);
    g.fill();
  };
  if (style === 'flagstone') {
    g.fillStyle = 'rgb(170,170,170)';
    g.fillRect(0, 0, size, size);
    const rows = [[0, 86], [86, 84], [170, 86]];
    for (const [y, h] of rows) {
      let x = -Math.floor(rnd() * 60);
      while (x < size) {
        const w = 70 + Math.floor(rnd() * 50);
        stone(x + 3, y + 3, w - 6, h - 6, 10);
        if (x + w > size) stone(x - size + 3, y + 3, w - 6, h - 6, 10);
        x += w;
      }
    }
  } else if (style === 'cobble') {
    g.fillStyle = 'rgb(160,160,160)';
    g.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 32) {
      for (let x = (y / 32) % 2 ? -16 : 0; x < size; x += 32) {
        const v = 205 + Math.floor(rnd() * 45);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.beginPath();
        g.ellipse(x + 16, y + 16, 13 + rnd() * 2, 12 + rnd() * 2, rnd(), 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.3)';
        g.beginPath();
        g.ellipse(x + 13, y + 12, 6, 4, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  } else if (style === 'planks') {
    g.fillStyle = 'rgb(150,150,150)';
    g.fillRect(0, 0, size, size);
    const n = 6;
    const ph = size / n;
    for (let i = 0; i < n; i++) {
      const v = 205 + Math.floor(rnd() * 40);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(0, i * ph + 2, size, ph - 4);
      g.strokeStyle = 'rgba(120,120,120,0.35)';
      g.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        const yy = i * ph + 6 + rnd() * (ph - 12);
        g.beginPath();
        g.moveTo(0, yy);
        g.bezierCurveTo(size * 0.3, yy + 3, size * 0.6, yy - 3, size, yy);
        g.stroke();
      }
      g.fillStyle = 'rgb(110,110,110)';
      const nx = Math.floor(rnd() * size);
      g.fillRect(nx, i * ph + 2, 3, ph - 4);
      g.fillStyle = 'rgb(90,90,90)';
      g.fillRect(nx + 8, i * ph + ph / 2 - 2, 4, 4);
    }
  } else if (style === 'metal') {
    g.fillStyle = 'rgb(175,175,175)';
    g.fillRect(0, 0, size, size);
    for (const [x, y] of [[0, 0], [128, 0], [0, 128], [128, 128]]) {
      const v = 215 + Math.floor(rnd() * 25);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x + 3, y + 3, 122, 122);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      for (let k = 0; k < 7; k++) {
        g.save();
        g.translate(x + 64, y + 64);
        g.rotate(Math.PI / 4);
        g.fillRect(-60, -50 + k * 16, 120, 4);
        g.restore();
      }
      g.fillStyle = 'rgb(140,140,140)';
      for (const [rx, ry] of [[12, 12], [116, 12], [12, 116], [116, 116]]) {
        g.beginPath();
        g.arc(x + rx, y + ry, 4, 0, Math.PI * 2);
        g.fill();
      }
    }
  } else if (style === 'brick') {
    g.fillStyle = 'rgb(175,175,175)';
    g.fillRect(0, 0, size, size);
    const bh = 32;
    for (let y = 0; y < size; y += bh) {
      const off = (y / bh) % 2 ? 32 : 0;
      for (let x = -64 + off; x < size; x += 64) stone(x + 2, y + 2, 60, bh - 4, 4);
    }
  } else {
    // dirt / sand
    g.fillStyle = 'rgb(232,232,232)';
    g.fillRect(0, 0, size, size);
    for (let i = 0; i < 260; i++) {
      const v = rnd() > 0.5 ? 255 : 190;
      g.fillStyle = `rgba(${v},${v},${v},${0.25 + rnd() * 0.35})`;
      g.beginPath();
      g.ellipse(rnd() * size, rnd() * size, 1.5 + rnd() * 4, 1.2 + rnd() * 3, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  return finishTileTex(c);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function finishTileTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/**
 * Soft mask texture from a predicate over a tile grid (1 = inside), blurred for smooth
 * shorelines. Covers [x0, x0+w) × [y0, y0+h) tiles.
 */
export function maskTexture(w, h, inside, { px = 16, blur = 6 } = {}) {
  const c = canvas(w * px, h * px);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x, y)) g.fillRect(x * px, y * px, px, px);
  const out = canvas(c.width, c.height);
  const o = out.getContext('2d');
  o.filter = `blur(${blur}px)`;
  o.drawImage(c, 0, 0);
  o.filter = 'none';
  const t = new THREE.CanvasTexture(out);
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

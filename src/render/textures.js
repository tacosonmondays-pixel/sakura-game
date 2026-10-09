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
  // Cute chunky arrow (points to +u) with a navy outline and a soft inner highlight.
  add('arrow', 96, 96, (ctx, w, h) => {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(w * 0.1, h * 0.36);
      ctx.lineTo(w * 0.52, h * 0.36);
      ctx.lineTo(w * 0.52, h * 0.16);
      ctx.lineTo(w * 0.92, h * 0.5);
      ctx.lineTo(w * 0.52, h * 0.84);
      ctx.lineTo(w * 0.52, h * 0.64);
      ctx.lineTo(w * 0.1, h * 0.64);
      ctx.closePath();
    };
    ctx.lineJoin = 'round';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#1d2b4f';
    path();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    path();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.0)';
    ctx.fillStyle = 'rgba(29,43,79,0.18)';
    ctx.beginPath();
    ctx.moveTo(w * 0.12, h * 0.52);
    ctx.lineTo(w * 0.52, h * 0.52);
    ctx.lineTo(w * 0.52, h * 0.62);
    ctx.lineTo(w * 0.12, h * 0.62);
    ctx.closePath();
    ctx.fill();
  });
  add('butterfly', 48, 48, (ctx, w, h) => {
    ctx.fillStyle = '#fff';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(w / 2 + s * w * 0.22, h * 0.4, w * 0.2, h * 0.24, s * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(w / 2 + s * w * 0.16, h * 0.68, w * 0.13, h * 0.16, s * -0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#1d2b4f';
    ctx.fillRect(w / 2 - 1.5, h * 0.22, 3, h * 0.6);
  });
  add('bird', 48, 24, (ctx, w, h) => {
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(3, h * 0.75);
    ctx.quadraticCurveTo(w * 0.3, h * 0.05, w / 2, h * 0.6);
    ctx.quadraticCurveTo(w * 0.7, h * 0.05, w - 3, h * 0.75);
    ctx.stroke();
  });
  add('koi', 48, 24, (ctx, w, h) => {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(w * 0.42, h / 2, w * 0.3, h * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.68, h / 2);
    ctx.lineTo(w * 0.95, h * 0.1);
    ctx.lineTo(w * 0.88, h / 2);
    ctx.lineTo(w * 0.95, h * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,120,60,0.9)';
    ctx.beginPath();
    ctx.ellipse(w * 0.36, h * 0.42, w * 0.1, h * 0.16, 0.3, 0, Math.PI * 2);
    ctx.fill();
  });
  add('lily', 48, 48, (ctx, w, h) => {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2);
    ctx.arc(w / 2, h / 2, w / 2 - 2, 0.35, Math.PI * 2 - 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,60,20,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const a = 0.5 + (i / 5) * (Math.PI * 2 - 1);
      ctx.beginPath();
      ctx.moveTo(w / 2, h / 2);
      ctx.lineTo(w / 2 + Math.cos(a) * (w / 2 - 4), h / 2 + Math.sin(a) * (h / 2 - 4));
      ctx.stroke();
    }
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


// ---------------------------------------------------------------------------
// Surface painting: hand-painted-looking ground, detail tiles and road tiles
// ---------------------------------------------------------------------------

/** Integer lattice hash → [0, 1). */
function hash2(ix, iy, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth 2D value noise (0..1) with a small fbm. */
export class Noise2 {
  constructor(seed = 1) {
    this.seed = seed | 0;
  }

  at(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let fx = x - xi;
    let fy = y - yi;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const s = this.seed;
    const a = hash2(xi, yi, s);
    const b = hash2(xi + 1, yi, s);
    const c = hash2(xi, yi + 1, s);
    const d = hash2(xi + 1, yi + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  fbm(x, y, oct = 3) {
    let v = 0;
    let amp = 0.5;
    let f = 1;
    let sum = 0;
    for (let i = 0; i < oct; i++) {
      v += this.at(x * f + i * 17.3, y * f - i * 9.1) * amp;
      sum += amp;
      amp *= 0.5;
      f *= 2.1;
    }
    return v / sum;
  }
}

function hexToRgb(hex) {
  const p = parseInt(String(hex).slice(1), 16);
  return [(p >> 16) & 255, (p >> 8) & 255, p & 255];
}

function mix3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function smooth(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

let filterSupport = null;
function supportsFilter(ctx) {
  if (filterSupport !== null) return filterSupport;
  try {
    ctx.filter = 'blur(1px)';
    filterSupport = ctx.filter === 'blur(1px)';
    ctx.filter = 'none';
  } catch {
    filterSupport = false;
  }
  return filterSupport;
}

/** Blurred copy of a canvas (alpha included). Falls back to a down/up-scale blur where ctx.filter is missing (Safari). */
export function blurCanvas(src, radius) {
  const out = canvas(src.width, src.height);
  const o = out.getContext('2d');
  if (radius <= 0.5) {
    o.drawImage(src, 0, 0);
    return out;
  }
  if (supportsFilter(o)) {
    o.filter = `blur(${radius}px)`;
    o.drawImage(src, 0, 0);
    o.filter = 'none';
    return out;
  }
  const k = Math.max(1.5, radius / 1.1);
  const sw = Math.max(2, Math.round(src.width / k));
  const sh = Math.max(2, Math.round(src.height / k));
  let small = canvas(sw, sh);
  small.getContext('2d').drawImage(src, 0, 0, sw, sh);
  for (let i = 0; i < 2; i++) {
    const s2 = canvas(sw, sh);
    const c2 = s2.getContext('2d');
    c2.globalAlpha = 0.5;
    c2.drawImage(small, 0, 0);
    c2.drawImage(small, 1, 0, sw - 1, sh, 0, 0, sw - 1, sh);
    c2.drawImage(small, 0, 1, sw, sh - 1, 0, 0, sw, sh - 1);
    small = s2;
  }
  o.imageSmoothingEnabled = true;
  o.imageSmoothingQuality = 'high';
  o.drawImage(small, 0, 0, src.width, src.height);
  return out;
}

/** Default painter parameters per ground style (looked up from the theme's `groundStyle`). */
const GROUND_STYLES = {
  grass: { mottle: 0.28, patch: 0.9, cloverScale: 0.55, cloverAmt: 0.7, flowers: 1, wet: 0 },
  moss: { mottle: 0.3, patch: 0.8, cloverScale: 0.5, cloverAmt: 0.85, flowers: 0.3, wet: 0.6 },
  sand: { mottle: 0.25, patch: 1.1, cloverScale: 0.6, cloverAmt: 0.25, flowers: 0.35, wet: 0 },
  snow: { mottle: 0.22, patch: 0.7, cloverScale: 0.45, cloverAmt: 0.55, flowers: 0.15, wet: 0 },
  ash: { mottle: 0.3, patch: 1.0, cloverScale: 0.5, cloverAmt: 0.5, flowers: 0.1, wet: 0, cracks: 1 },
  metal: { mottle: 0.2, patch: 1.2, cloverScale: 0.7, cloverAmt: 0.45, flowers: 0.05, wet: 0.3, plates: 1 },
};

/**
 * Paints the whole battlefield ground (playable area + margin) as one hand-painted-looking
 * albedo texture: soft colour mottling, clover / moss patches, flower drifts, worn dirt and
 * pebbles beside the road, wet sand around water, glowing cracks on ash, plate seams on metal.
 * The road slab itself is a separate mesh (terrain.js); this paints what lies around it.
 * @param {object} o
 * @param {object} o.look resolved theme look (themes.js)
 * @param {number} o.x0 first tile x of the painted extent
 * @param {number} o.y0 first tile y
 * @param {number} o.w extent width in tiles
 * @param {number} o.h extent height in tiles
 * @param {(x: number, y: number) => string} o.charAt tile char at tile coords ('.', ',', '~', 'o' outside…)
 * @param {(x: number, y: number) => boolean} o.isPath
 * @param {(x: number, y: number) => boolean} o.isWater
 * @param {number[][][]} o.roads road centrelines in world coords, [[x, z], ...] per road
 * @param {number} [o.px=32] pixels per tile
 * @param {number} [o.seed=1]
 * @returns {{ texture: THREE.CanvasTexture, canvas: HTMLCanvasElement }}
 */
export function paintGround(o) {
  const { look, x0, y0, w, h, charAt, isPath, isWater, roads = [], px = 32, seed = 1 } = o;
  const style = GROUND_STYLES[look.groundStyle] || GROUND_STYLES.grass;
  const styleName = GROUND_STYLES[look.groundStyle] ? look.groundStyle : 'grass';
  const W = w * px;
  const H = h * px;
  const rnd = makeRnd(seed);
  const noise = new Noise2(seed);
  const cA = hexToRgb(look.ground[0]);
  const cB = hexToRgb(look.ground[1] || look.ground[0]);
  const cLight = hexToRgb(look.groundSpeck || look.ground[0]);
  const cShade = hexToRgb(look.groundShade || darken(look.ground[0], 0.82));
  const cClover = hexToRgb(look.clover || darken(look.ground[0], 0.8));
  const cWet = hexToRgb(look.wet || darken(look.ground[0], 0.6));
  const cCrack = hexToRgb('#ff7a2a');
  const cCrackHot = hexToRgb('#ffd36b');

  // --- 1. soft noise layer at half resolution, upscaled (painterly softness) ----------
  const NPX = Math.max(8, Math.round(px / 2));
  const nw = w * NPX;
  const nh = h * NPX;
  const nc = canvas(nw, nh);
  const ng = nc.getContext('2d');
  const img = ng.createImageData(nw, nh);
  const data = img.data;
  const inv = 1 / NPX;
  for (let j = 0; j < nh; j++) {
    const wz = y0 + (j + 0.5) * inv;
    for (let i = 0; i < nw; i++) {
      const wx = x0 + (i + 0.5) * inv;
      const n1 = noise.fbm(wx * style.mottle, wz * style.mottle, 3);
      const n2 = noise.fbm(wx * style.patch + 50, wz * style.patch + 50, 2);
      const n3 = noise.at(wx * 5.3 + 11, wz * 5.3 + 7);
      let col = mix3(cA, cB, n1);
      col = mix3(col, cLight, Math.max(0, n2 - 0.52) * 1.5);
      col = mix3(col, cShade, Math.max(0, 0.46 - n2) * 1.4);
      const grain = 0.95 + n3 * 0.1;
      col = [col[0] * grain, col[1] * grain, col[2] * grain];
      if (style.cloverAmt > 0) {
        const c = noise.fbm(wx * style.cloverScale + 200, wz * style.cloverScale + 200, 2);
        const k = smooth(0.56, 0.68, c) * style.cloverAmt;
        col = mix3(col, cClover, k);
      }
      if (style.wet > 0) {
        const p = noise.fbm(wx * 0.75 + 300, wz * 0.75 + 300, 2);
        col = mix3(col, cWet, smooth(0.6, 0.72, p) * style.wet);
      }
      if (style.cracks) {
        const v = noise.fbm(wx * 0.8 + 400, wz * 0.8 + 400, 3);
        const d = Math.abs(v - 0.5);
        const glow = smooth(0.028, 0.0, d);
        const heat = noise.at(wx * 0.5 + 900, wz * 0.5 + 900);
        col = mix3(col, heat > 0.5 ? cCrackHot : cCrack, glow * 0.95);
        col = mix3(col, cShade, smooth(0.12, 0.04, d) * 0.5 * (1 - glow));
      }
      if (style.plates) {
        // concrete slabs: a faint seam grid every 2 tiles with rust bleeding along it
        const gx = Math.abs(((wx + 1) % 2) - 1);
        const gz = Math.abs(((wz + 1) % 2) - 1);
        const seam = 1 - smooth(0.0, 0.08, Math.min(gx, gz));
        col = mix3(col, cShade, seam * 0.55);
        const rust = noise.fbm(wx * 0.8 + 600, wz * 0.8 + 600, 2);
        col = mix3(col, hexToRgb(look.rust || '#9a6a48'), smooth(0.62, 0.74, rust) * 0.55);
      }
      const k = (j * nw + i) * 4;
      data[k] = col[0];
      data[k + 1] = col[1];
      data[k + 2] = col[2];
      data[k + 3] = 255;
    }
  }
  ng.putImageData(img, 0, 0);

  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(nc, 0, 0, W, H);

  const toPx = (wx, wz) => [(wx - x0) * px, (wz - y0) * px];

  // --- 2. wet shore around water -----------------------------------------------------
  let hasWater = false;
  const shoreLayer = canvas(W, H);
  const sg = shoreLayer.getContext('2d');
  sg.fillStyle = look.shore || '#e2cfa4';
  for (let ty = y0; ty < y0 + h; ty++) {
    for (let tx = x0; tx < x0 + w; tx++) {
      if (!isWater(tx, ty)) continue;
      hasWater = true;
      sg.fillRect((tx - x0) * px - 1, (ty - y0) * px - 1, px + 2, px + 2);
    }
  }
  if (hasWater) {
    g.globalAlpha = 0.95;
    g.drawImage(blurCanvas(shoreLayer, px * 0.42), 0, 0);
    g.globalAlpha = 0.5;
    g.drawImage(blurCanvas(shoreLayer, px * 0.9), 0, 0);
    g.globalAlpha = 1;
  }

  // --- 3. worn dirt beside the road, slab base under it ------------------------------
  if (roads.length) {
    const wear = canvas(W, H);
    const wg = wear.getContext('2d');
    wg.lineCap = 'round';
    wg.lineJoin = 'round';
    const stroke = (lineW, color, alpha) => {
      wg.strokeStyle = color;
      wg.globalAlpha = alpha;
      wg.lineWidth = lineW;
      for (const road of roads) {
        wg.beginPath();
        road.forEach(([x, z], i) => {
          const [sx, sy] = toPx(x, z);
          if (i === 0) wg.moveTo(sx, sy);
          else wg.lineTo(sx, sy);
        });
        wg.stroke();
      }
    };
    stroke(px * 2.3, look.dirt || '#b89a6a', 0.55);
    g.drawImage(blurCanvas(wear, px * 0.5), 0, 0);
    wg.clearRect(0, 0, W, H);
    stroke(px * 1.55, look.dirt || '#b89a6a', 0.5);
    g.drawImage(blurCanvas(wear, px * 0.18), 0, 0);
    // slab base (the ribbon mesh bevels down onto this)
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = darken(look.path.color, 0.86);
    g.lineWidth = px * 0.98;
    for (const road of roads) {
      g.beginPath();
      road.forEach(([x, z], i) => {
        const [sx, sy] = toPx(x, z);
        if (i === 0) g.moveTo(sx, sy);
        else g.lineTo(sx, sy);
      });
      g.stroke();
    }
    // pebbles along both edges
    const pebble = look.pebble || '#b8b0a4';
    const pebbleDark = darken(pebble, 0.78);
    for (const road of roads) {
      let acc = 0;
      for (let i = 1; i < road.length; i++) {
        const [ax, az] = road[i - 1];
        const [bx, bz] = road[i];
        const dx = bx - ax;
        const dz = bz - az;
        const len = Math.hypot(dx, dz);
        if (len < 1e-4) continue;
        const nx = -dz / len;
        const nz = dx / len;
        acc += len;
        while (acc > 0.22) {
          acc -= 0.22;
          const t = 1 - acc / len;
          const cx = ax + dx * t;
          const cz = az + dz * t;
          for (const side of [-1, 1]) {
            if (rnd() > 0.42) continue;
            const off = 0.5 + rnd() * 0.14;
            const wx = cx + nx * off * side;
            const wz = cz + nz * off * side;
            if (isWater(Math.floor(wx), Math.floor(wz))) continue;
            const [sx, sy] = toPx(wx + (rnd() - 0.5) * 0.06, wz + (rnd() - 0.5) * 0.06);
            const r = px * (0.035 + rnd() * 0.035);
            g.fillStyle = rnd() > 0.5 ? pebble : pebbleDark;
            g.beginPath();
            g.ellipse(sx, sy, r * 1.3, r, rnd() * 3, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = 'rgba(255,255,255,0.35)';
            g.beginPath();
            g.ellipse(sx - r * 0.3, sy - r * 0.3, r * 0.5, r * 0.35, 0, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    }
  }

  // --- 4. flower drifts, clover leaves, specks ---------------------------------------
  const flowers = (look.flowers || ['#ffffff']).map((f) => f);
  const leafCol = darken(look.clover || look.ground[0], 0.8);
  const dot = (sx, sy, r, col, hl = true) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(sx, sy, r, 0, Math.PI * 2);
    g.fill();
    if (hl) {
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath();
      g.arc(sx - r * 0.3, sy - r * 0.3, r * 0.4, 0, Math.PI * 2);
      g.fill();
    }
  };
  const flowerCluster = (tx, ty, n, spread) => {
    for (let k = 0; k < n; k++) {
      const fx = tx + 0.5 + (rnd() - 0.5) * spread;
      const fz = ty + 0.5 + (rnd() - 0.5) * spread;
      const [sx, sy] = toPx(fx, fz);
      if (rnd() < 0.6) dot(sx + px * 0.03, sy + px * 0.05, px * 0.05, leafCol, false);
      dot(sx, sy, px * (0.045 + rnd() * 0.03), flowers[Math.floor(rnd() * flowers.length)]);
    }
  };
  if (style.flowers > 0) {
    for (let ty = y0; ty < y0 + h; ty++) {
      for (let tx = x0; tx < x0 + w; tx++) {
        if (isPath(tx, ty) || isWater(tx, ty)) continue;
        const ch = charAt(tx, ty);
        if (ch === ',') {
          flowerCluster(tx, ty, Math.round(12 * style.flowers) + 4, 0.9);
          continue;
        }
        if (ch !== '.' && ch !== 'o') continue;
        const drift = noise.fbm(tx * 0.45 + 700, ty * 0.45 + 700, 2);
        if (drift > 0.6 && rnd() < 0.8 * style.flowers) flowerCluster(tx, ty, 3 + Math.round(rnd() * 4), 0.85);
        else if (rnd() < 0.12 * style.flowers) flowerCluster(tx, ty, 1 + Math.round(rnd()), 0.7);
      }
    }
  }
  if (styleName === 'grass' || styleName === 'moss') {
    // clover leaves (three small discs) in the clover patches
    const cl = darken(look.clover || look.ground[0], 0.92);
    for (let i = 0; i < w * h * 0.35; i++) {
      const wx = x0 + rnd() * w;
      const wz = y0 + rnd() * h;
      if (noise.fbm(wx * style.cloverScale + 200, wz * style.cloverScale + 200, 2) < 0.6) continue;
      if (isPath(Math.floor(wx), Math.floor(wz)) || isWater(Math.floor(wx), Math.floor(wz))) continue;
      const [sx, sy] = toPx(wx, wz);
      const r = px * 0.03;
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + rnd();
        dot(sx + Math.cos(a) * r, sy + Math.sin(a) * r, r, cl, false);
      }
    }
  }
  if (styleName === 'snow') {
    for (let i = 0; i < w * h * 1.2; i++) {
      const wx = x0 + rnd() * w;
      const wz = y0 + rnd() * h;
      if (isWater(Math.floor(wx), Math.floor(wz))) continue;
      const [sx, sy] = toPx(wx, wz);
      dot(sx, sy, px * (0.02 + rnd() * 0.02), rnd() > 0.5 ? '#ffffff' : '#d9ecff', false);
    }
  }
  if (styleName === 'ash') {
    for (let i = 0; i < w * h * 1.5; i++) {
      const wx = x0 + rnd() * w;
      const wz = y0 + rnd() * h;
      if (isWater(Math.floor(wx), Math.floor(wz)) || isPath(Math.floor(wx), Math.floor(wz))) continue;
      const [sx, sy] = toPx(wx, wz);
      dot(sx, sy, px * (0.015 + rnd() * 0.03), rnd() > 0.7 ? '#ff9a4a' : '#8a7a78', false);
    }
  }
  if (styleName === 'metal') {
    // oil stains + rivets along the slab seams
    for (let i = 0; i < w * h * 0.12; i++) {
      const [sx, sy] = toPx(x0 + rnd() * w, y0 + rnd() * h);
      const r = px * (0.2 + rnd() * 0.3);
      const gr = g.createRadialGradient(sx, sy, 0, sx, sy, r);
      gr.addColorStop(0, 'rgba(40,36,48,0.35)');
      gr.addColorStop(1, 'rgba(40,36,48,0)');
      g.fillStyle = gr;
      g.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    for (let ty = y0; ty < y0 + h; ty += 2) {
      for (let tx = x0; tx < x0 + w; tx += 2) {
        for (const [ox, oz] of [[0.12, 0.12], [1.88, 0.12], [0.12, 1.88], [1.88, 1.88]]) {
          const [sx, sy] = toPx(tx + ox, ty + oz);
          dot(sx, sy, px * 0.035, '#6f7682');
        }
      }
    }
  }

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  return { texture, canvas: c };
}

function darken(hex, k) {
  const [r, g, b] = hexToRgb(hex);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `#${((c(r) << 16) | (c(g) << 8) | c(b)).toString(16).padStart(6, '0')}`;
}

function makeRnd(seed) {
  let s = (seed * 16807 + 11) % 2147483647 || 7;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/**
 * Tileable greyscale detail (around 1.0, multiplies the painted ground). One repeat = 1 tile.
 * style: grass | moss | sand | snow | ash | metal
 */
export function detailTexture(style = 'grass', seed = 7) {
  const size = 256;
  const c = canvas(size, size);
  const g = c.getContext('2d');
  const rnd = makeRnd(seed);
  g.fillStyle = 'rgb(240,240,240)';
  g.fillRect(0, 0, size, size);
  const wrapDraw = (fn) => {
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      g.save();
      g.translate(ox, oy);
      fn();
      g.restore();
    }
  };
  // soft mottling (all styles)
  for (let i = 0; i < 30; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 20 + rnd() * 50;
    const v = rnd() > 0.5 ? 255 : 212;
    wrapDraw(() => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${v},${v},${v},0.22)`);
      gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr;
      g.fillRect(0, 0, size, size);
    });
  }
  if (style === 'grass' || style === 'moss') {
    const blades = style === 'grass' ? 1100 : 500;
    for (let i = 0; i < blades; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const l = 4 + rnd() * 7;
      const v = rnd() > 0.5 ? 255 : 188;
      wrapDraw(() => {
        g.strokeStyle = `rgba(${v},${v},${v},0.5)`;
        g.lineWidth = 1.4;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + (rnd() - 0.5) * 3, y - l * 0.6, x + (rnd() - 0.5) * 5, y - l);
        g.stroke();
      });
    }
  } else if (style === 'sand') {
    for (let i = 0; i < 700; i++) {
      const v = rnd() > 0.5 ? 255 : 200;
      g.fillStyle = `rgba(${v},${v},${v},${0.3 + rnd() * 0.3})`;
      g.beginPath();
      g.ellipse(rnd() * size, rnd() * size, 1 + rnd() * 2, 1 + rnd() * 1.5, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(200,200,200,0.25)';
    g.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const y = i * (size / 9) + rnd() * 10;
      wrapDraw(() => {
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(size * 0.3, y + 8, size * 0.6, y - 8, size, y);
        g.stroke();
      });
    }
  } else if (style === 'snow') {
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(255,255,255,${0.4 + rnd() * 0.5})`;
      g.beginPath();
      g.arc(rnd() * size, rnd() * size, 1 + rnd() * 1.5, 0, Math.PI * 2);
      g.fill();
    }
  } else if (style === 'ash') {
    g.strokeStyle = 'rgba(150,150,150,0.5)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      let x = rnd() * size;
      let y = rnd() * size;
      wrapDraw(() => {
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          x += (rnd() - 0.5) * 40;
          y += (rnd() - 0.5) * 40;
          g.lineTo(x, y);
        }
        g.stroke();
      });
    }
    for (let i = 0; i < 500; i++) {
      const v = rnd() > 0.6 ? 255 : 190;
      g.fillStyle = `rgba(${v},${v},${v},0.35)`;
      g.fillRect(rnd() * size, rnd() * size, 1.5, 1.5);
    }
  } else if (style === 'metal') {
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const a = rnd() * Math.PI;
      const l = 10 + rnd() * 30;
      wrapDraw(() => {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
      });
    }
    for (let i = 0; i < 300; i++) {
      g.fillStyle = `rgba(170,170,170,${0.2 + rnd() * 0.3})`;
      g.fillRect(rnd() * size, rnd() * size, 2, 2);
    }
  }
  return finishTileTex(c);
}

/** Back-compat alias: tileable grass detail. */
export function grassTexture(seed = 7) {
  return detailTexture('grass', seed);
}

/**
 * Tileable road surface (greyscale around 1.0, tinted by vertex colour). u runs along the
 * road, v across it; one repeat = 1 tile of road.
 * style: flagstone | cobble | planks | metal | dirt | brick | sand
 */
export function pathTexture(style = 'flagstone', seed = 3) {
  const size = 256;
  const c = canvas(size, size);
  const g = c.getContext('2d');
  const rnd = makeRnd(seed);
  g.fillStyle = 'rgb(236,236,236)';
  g.fillRect(0, 0, size, size);
  const wrap = (fn) => {
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size], [size, size], [-size, -size], [size, -size], [-size, size]]) {
      g.save();
      g.translate(ox, oy);
      fn();
      g.restore();
    }
  };
  const stoneShape = (cx, cy, rx, ry, rot, v) => {
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.beginPath();
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rot;
      const k = 0.86 + rnd() * 0.22;
      const x = cx + Math.cos(a) * rx * k;
      const y = cy + Math.sin(a) * ry * k;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.fill();
    // highlight on the upper-left rim
    g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy, Math.min(rx, ry) * 0.72, Math.PI * 1.05, Math.PI * 1.75);
    g.stroke();
  };
  if (style === 'flagstone') {
    g.fillStyle = 'rgb(168,168,168)';
    g.fillRect(0, 0, size, size);
    const cols = 3;
    const rows = 3;
    for (let r = 0; r < rows; r++) {
      for (let q = 0; q < cols; q++) {
        const cx = (q + 0.5) * (size / cols) + (rnd() - 0.5) * 18 + (r % 2 ? size / cols / 2 : 0);
        const cy = (r + 0.5) * (size / rows) + (rnd() - 0.5) * 14;
        const v = 222 + Math.floor(rnd() * 30);
        wrap(() => stoneShape(cx, cy, size / cols * 0.5, size / rows * 0.46, rnd(), v));
      }
    }
  } else if (style === 'cobble') {
    g.fillStyle = 'rgb(150,150,150)';
    g.fillRect(0, 0, size, size);
    const s = 36;
    for (let y = 0; y < size; y += s) {
      for (let x = (y / s) % 2 ? -s / 2 : 0; x < size; x += s) {
        const v = 208 + Math.floor(rnd() * 42);
        const cx = x + s / 2 + (rnd() - 0.5) * 4;
        const cy = y + s / 2 + (rnd() - 0.5) * 4;
        wrap(() => {
          g.fillStyle = `rgb(${v},${v},${v})`;
          g.beginPath();
          g.ellipse(cx, cy, s * 0.44, s * 0.4, rnd() * 0.5, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = 'rgba(255,255,255,0.32)';
          g.beginPath();
          g.ellipse(cx - 4, cy - 5, s * 0.2, s * 0.13, -0.3, 0, Math.PI * 2);
          g.fill();
        });
      }
    }
  } else if (style === 'planks') {
    // boards run across the road (vertical stripes in the tile)
    g.fillStyle = 'rgb(140,140,140)';
    g.fillRect(0, 0, size, size);
    const n = 6;
    const pw = size / n;
    for (let i = 0; i < n; i++) {
      const v = 200 + Math.floor(rnd() * 45);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(i * pw + 2, 0, pw - 4, size);
      g.strokeStyle = 'rgba(110,110,110,0.4)';
      g.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        const xx = i * pw + 6 + rnd() * (pw - 12);
        g.beginPath();
        g.moveTo(xx, 0);
        g.bezierCurveTo(xx + 3, size * 0.3, xx - 3, size * 0.6, xx, size);
        g.stroke();
      }
      g.fillStyle = 'rgb(95,95,95)';
      for (const yy of [14, size - 14]) {
        g.beginPath();
        g.arc(i * pw + pw / 2, yy, 3, 0, Math.PI * 2);
        g.fill();
      }
    }
  } else if (style === 'metal') {
    g.fillStyle = 'rgb(172,172,172)';
    g.fillRect(0, 0, size, size);
    for (const [x, y] of [[0, 0], [128, 0], [0, 128], [128, 128]]) {
      const v = 212 + Math.floor(rnd() * 26);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x + 3, y + 3, 122, 122);
      g.fillStyle = 'rgba(255,255,255,0.22)';
      for (let k = 0; k < 7; k++) {
        g.save();
        g.translate(x + 64, y + 64);
        g.rotate(Math.PI / 4);
        g.fillRect(-60, -50 + k * 16, 120, 4);
        g.restore();
      }
      for (const [rx, ry] of [[12, 12], [116, 12], [12, 116], [116, 116]]) {
        g.fillStyle = 'rgb(130,130,130)';
        g.beginPath();
        g.arc(x + rx, y + ry, 4, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.beginPath();
        g.arc(x + rx - 1, y + ry - 1, 1.5, 0, Math.PI * 2);
        g.fill();
      }
    }
  } else if (style === 'brick') {
    g.fillStyle = 'rgb(170,170,170)';
    g.fillRect(0, 0, size, size);
    const bh = 32;
    for (let y = 0; y < size; y += bh) {
      const off = (y / bh) % 2 ? 32 : 0;
      for (let x = -64 + off; x < size; x += 64) {
        const v = 218 + Math.floor(rnd() * 30);
        g.fillStyle = `rgb(${v},${v},${v})`;
        roundRect(g, x + 2, y + 2, 60, bh - 4, 5);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.3)';
        roundRect(g, x + 5, y + 5, 50, 6, 3);
        g.fill();
      }
    }
  } else {
    // dirt / sand: light trodden centre, two faint ruts along the road, pebbles
    g.fillStyle = 'rgb(236,236,236)';
    g.fillRect(0, 0, size, size);
    for (const y of [size * 0.3, size * 0.7]) {
      const gr = g.createLinearGradient(0, y - 18, 0, y + 18);
      gr.addColorStop(0, 'rgba(180,180,180,0)');
      gr.addColorStop(0.5, 'rgba(180,180,180,0.5)');
      gr.addColorStop(1, 'rgba(180,180,180,0)');
      g.fillStyle = gr;
      g.fillRect(0, y - 18, size, 36);
    }
    for (let i = 0; i < 220; i++) {
      const v = rnd() > 0.5 ? 255 : 185;
      g.fillStyle = `rgba(${v},${v},${v},${0.25 + rnd() * 0.35})`;
      g.beginPath();
      g.ellipse(rnd() * size, rnd() * size, 1.5 + rnd() * 4, 1.2 + rnd() * 3, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 18; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const r = 3 + rnd() * 4;
      wrap(() => stoneShape(x, y, r * 1.3, r, rnd(), 200 + Math.floor(rnd() * 40)));
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
export function maskTexture(w, h, inside, { px = 16, blur = 6, carve = null, carveHalf = 0 } = {}) {
  const c = canvas(w * px, h * px);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x, y)) g.fillRect(x * px, y * px, px, px);
  // carve: polylines (mask-grid units) whose surroundings are cut out of the mask, e.g. the
  // banks either side of a road that runs beside water
  if (carve?.length && carveHalf > 0) {
    g.strokeStyle = '#000';
    g.lineWidth = carveHalf * 2 * px;
    g.lineJoin = 'round';
    g.lineCap = 'butt';
    for (const line of carve) {
      if (line.length < 2) continue;
      g.beginPath();
      g.moveTo(line[0][0] * px, line[0][1] * px);
      for (let i = 1; i < line.length; i++) g.lineTo(line[i][0] * px, line[i][1] * px);
      g.stroke();
    }
  }
  const out = blurCanvas(c, blur);
  const t = new THREE.CanvasTexture(out);
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

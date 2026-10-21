// Atlas sprites for the attack FX (painted once into the shared battle atlas by createAtlas).
// White / greyscale so instance colours tint them; all ≤ 128 px. [name, w, h, draw(ctx, w, h)]
//
// Orientation: the top of a sprite is local +y. Ground quads map local +y to world −z before
// rotation, billboards to screen-up.

const TAU = Math.PI * 2;

function fillPath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}

function crane(up) {
  return (ctx, w, h) => {
    // origami crane seen from the side: body diamond, long neck + head, tail, one big wing
    ctx.fillStyle = '#ffffff';
    fillPath(ctx, [w * 0.18, h * 0.62, w * 0.5, h * 0.5, w * 0.78, h * 0.62, w * 0.5, h * 0.74]);
    fillPath(ctx, [w * 0.74, h * 0.62, w * 0.94, h * 0.2, w * 0.98, h * 0.24, w * 0.8, h * 0.66]); // neck
    fillPath(ctx, [w * 0.94, h * 0.2, w * 0.99, h * 0.22, w * 0.9, h * 0.3]); // beak
    fillPath(ctx, [w * 0.2, h * 0.62, w * 0.02, h * 0.36, w * 0.3, h * 0.62]); // tail
    ctx.fillStyle = '#e4e9f2';
    if (up) fillPath(ctx, [w * 0.36, h * 0.56, w * 0.46, h * 0.04, w * 0.62, h * 0.56]);
    else fillPath(ctx, [w * 0.36, h * 0.6, w * 0.5, h * 0.98, w * 0.64, h * 0.6]);
    ctx.strokeStyle = 'rgba(120,135,170,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(w * 0.18, h * 0.62);
    ctx.lineTo(w * 0.78, h * 0.62);
    ctx.stroke();
  };
}

export const ATTACK_SPRITES = [
  ['crane0', 48, 32, crane(true)],
  ['crane1', 48, 32, crane(false)],
  ['hawk', 48, 32, (ctx, w, h) => {
    // spread-wing raptor seen from above / below
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.12);
    ctx.quadraticCurveTo(w * 0.3, h * 0.2, w * 0.02, h * 0.44);
    ctx.quadraticCurveTo(w * 0.22, h * 0.46, w * 0.3, h * 0.6);
    ctx.lineTo(w * 0.42, h * 0.56);
    ctx.lineTo(w * 0.4, h * 0.94);
    ctx.lineTo(w * 0.5, h * 0.84);
    ctx.lineTo(w * 0.6, h * 0.94);
    ctx.lineTo(w * 0.58, h * 0.56);
    ctx.lineTo(w * 0.7, h * 0.6);
    ctx.quadraticCurveTo(w * 0.78, h * 0.46, w * 0.98, h * 0.44);
    ctx.quadraticCurveTo(w * 0.7, h * 0.2, w * 0.5, h * 0.12);
    ctx.fill();
    ctx.fillStyle = 'rgba(80,90,120,0.45)';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.36, w * 0.06, h * 0.16, 0, 0, TAU);
    ctx.fill();
  }],
  ['ofuda', 24, 48, (ctx, w, h) => {
    // paper talisman: cream strip, red seal, brush strokes (coloured — draw untinted)
    ctx.fillStyle = '#fff8e8';
    ctx.fillRect(3, 1, w - 6, h - 2);
    ctx.strokeStyle = '#d8c9a6';
    ctx.lineWidth = 1;
    ctx.strokeRect(3.5, 1.5, w - 7, h - 3);
    ctx.fillStyle = '#d62839';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.3, w * 0.24, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff8e8';
    ctx.fillRect(w / 2 - 1, h * 0.22, 2, h * 0.16);
    ctx.fillStyle = '#2a2233';
    for (let i = 0; i < 3; i++) ctx.fillRect(w * 0.36, h * (0.52 + i * 0.12), w * 0.28, 2);
  }],
  ['lantern', 32, 40, (ctx, w, h) => {
    const gr = ctx.createRadialGradient(w / 2, h * 0.52, 2, w / 2, h * 0.52, w * 0.5);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(1, '#d6d6d6');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.52, w * 0.4, h * 0.34, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,90,90,0.55)';
    ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.52, w * 0.4 * Math.abs(i * 0.6) + 0.5, h * 0.34, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = '#7a7a7a';
    ctx.fillRect(w * 0.3, h * 0.12, w * 0.4, h * 0.08);
    ctx.fillRect(w * 0.3, h * 0.84, w * 0.4, h * 0.08);
    ctx.fillRect(w / 2 - 1, 0, 2, h * 0.12);
  }],
  ['bell', 32, 32, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.12);
    ctx.bezierCurveTo(w * 0.22, h * 0.14, w * 0.24, h * 0.62, w * 0.12, h * 0.76);
    ctx.lineTo(w * 0.88, h * 0.76);
    ctx.bezierCurveTo(w * 0.76, h * 0.62, w * 0.78, h * 0.14, w * 0.5, h * 0.12);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.84, w * 0.09, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,110,90,0.4)';
    ctx.fillRect(w * 0.18, h * 0.66, w * 0.64, h * 0.05);
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.fillRect(w / 2 - 1.5, h * 0.02, 3, h * 0.12);
  }],
  ['maple', 32, 32, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    const cx = w / 2;
    const cy = h * 0.56;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + ((i - 5) / 5) * 2.3;
      const r = (i % 2 === 0 ? 0.46 : 0.2) * w;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx - 1, cy, 2, h * 0.42);
  }],
  ['feather', 32, 16, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(w * 0.55, h / 2, w * 0.42, h * 0.36, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,130,150,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(1, h / 2);
    ctx.lineTo(w - 2, h / 2);
    ctx.stroke();
  }],
  ['silhouette', 48, 64, (ctx, w, h) => {
    // plain chibi shape: big head with hair tufts, small body, feet
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.33, w * 0.33, 0, TAU);
    ctx.fill();
    fillPath(ctx, [w * 0.22, h * 0.3, w * 0.14, h * 0.62, w * 0.3, h * 0.5]);
    fillPath(ctx, [w * 0.78, h * 0.3, w * 0.86, h * 0.62, w * 0.7, h * 0.5]);
    ctx.beginPath();
    ctx.moveTo(w * 0.32, h * 0.6);
    ctx.lineTo(w * 0.68, h * 0.6);
    ctx.lineTo(w * 0.76, h * 0.86);
    ctx.lineTo(w * 0.24, h * 0.86);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(w * 0.34, h * 0.86, w * 0.1, h * 0.12);
    ctx.fillRect(w * 0.56, h * 0.86, w * 0.1, h * 0.12);
  }],
  ['mirror', 40, 40, (ctx, w, h) => {
    const gr = ctx.createRadialGradient(w * 0.4, h * 0.38, 1, w / 2, h / 2, w * 0.42);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.7, '#dfe6f2');
    gr.addColorStop(1, '#bfc8d8');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.42, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    fillPath(ctx, [w * 0.3, h * 0.24, w * 0.4, h * 0.2, w * 0.24, h * 0.5, w * 0.2, h * 0.42]);
  }],
  ['moon', 40, 40, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.44, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(w * 0.68, h * 0.4, w * 0.38, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }],
  ['ray', 32, 128, (ctx, w, h) => {
    // tapered light ray: wide soft base at the bottom, thin bright tip at the top
    const gr = ctx.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0.15)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.95)');
    gr.addColorStop(0.85, 'rgba(255,255,255,0.7)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, 0);
    ctx.quadraticCurveTo(w * 0.62, h * 0.5, w * 0.92, h);
    ctx.lineTo(w * 0.08, h);
    ctx.quadraticCurveTo(w * 0.38, h * 0.5, w * 0.5, 0);
    ctx.fill();
  }],
  ['fan', 128, 128, (ctx, w, h) => {
    // soft 90° wedge, apex at the centre, opening toward the top (local +y)
    const gr = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0.05)');
    gr.addColorStop(0.55, 'rgba(255,255,255,0.45)');
    gr.addColorStop(0.92, 'rgba(255,255,255,0.9)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2);
    ctx.arc(w / 2, h / 2, w / 2, -Math.PI / 2 - Math.PI / 4, -Math.PI / 2 + Math.PI / 4);
    ctx.closePath();
    ctx.fill();
  }],
  ['reticle', 96, 96, (ctx, w, h) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.setLineDash([w * 0.11, w * 0.07]);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 5, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.16, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      ctx.moveTo(w / 2 + Math.cos(a) * w * 0.26, h / 2 + Math.sin(a) * h * 0.26);
      ctx.lineTo(w / 2 + Math.cos(a) * w * 0.4, h / 2 + Math.sin(a) * h * 0.4);
    }
    ctx.stroke();
  }],
  ['ticket', 32, 20, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(1, 1);
    ctx.lineTo(w - 1, 1);
    ctx.lineTo(w - 1, h * 0.35);
    ctx.arc(w - 1, h / 2, h * 0.15, -Math.PI / 2, Math.PI / 2, true);
    ctx.lineTo(w - 1, h - 1);
    ctx.lineTo(1, h - 1);
    ctx.lineTo(1, h * 0.65);
    ctx.arc(1, h / 2, h * 0.15, Math.PI / 2, -Math.PI / 2, true);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(100,100,110,0.5)';
    for (let y = 3; y < h - 2; y += 4) ctx.fillRect(w * 0.7, y, 1.5, 2);
    ctx.fillRect(w * 0.18, h * 0.38, w * 0.38, 2);
    ctx.fillRect(w * 0.18, h * 0.58, w * 0.3, 2);
  }],
  ['flask', 24, 32, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.64, w * 0.4, 0, TAU);
    ctx.fill();
    ctx.fillRect(w * 0.38, h * 0.16, w * 0.24, h * 0.3);
    ctx.fillStyle = '#9a8a70';
    ctx.fillRect(w * 0.34, h * 0.06, w * 0.32, h * 0.12);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(w * 0.36, h * 0.56, w * 0.08, 0, TAU);
    ctx.fill();
  }],
  ['crack', 64, 64, (ctx, w, h) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.lineWidth = 3;
    const arms = [[0.1, 0.7], [1.3, 0.85], [2.5, 0.6], [3.4, 0.9], [4.6, 0.7], [5.6, 0.8]];
    ctx.beginPath();
    for (const [a, r] of arms) {
      ctx.moveTo(w / 2, h / 2);
      const mx = w / 2 + Math.cos(a + 0.2) * w * 0.22 * r;
      const my = h / 2 + Math.sin(a + 0.2) * h * 0.22 * r;
      ctx.lineTo(mx, my);
      ctx.lineTo(w / 2 + Math.cos(a) * w * 0.46 * r, h / 2 + Math.sin(a) * h * 0.46 * r);
    }
    ctx.stroke();
  }],
  ['swirl', 64, 64, (ctx, w, h) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      ctx.lineWidth = 4 - k * 1.5;
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const a = t * TAU * 1.6 + k * Math.PI;
        const r = w * (0.06 + 0.4 * t);
        const x = w / 2 + Math.cos(a) * r;
        const y = h / 2 + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }],
  ['drop', 16, 24, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(w / 2, 1);
    ctx.bezierCurveTo(w * 0.95, h * 0.55, w * 0.85, h - 1, w / 2, h - 1);
    ctx.bezierCurveTo(w * 0.15, h - 1, w * 0.05, h * 0.55, w / 2, 1);
    ctx.fill();
  }],
  ['banner', 32, 40, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(2, 0, 2.5, h);
    ctx.beginPath();
    ctx.moveTo(5, 3);
    ctx.lineTo(w - 2, 6);
    ctx.lineTo(w - 6, h * 0.36);
    ctx.lineTo(w - 2, h * 0.62);
    ctx.lineTo(5, h * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(150,140,110,0.55)';
    ctx.beginPath();
    ctx.arc(w * 0.46, h * 0.32, w * 0.12, 0, TAU);
    ctx.fill();
  }],
  ['cone', 32, 64, (ctx, w, h) => {
    // muzzle cone: bright at the bottom (muzzle), fanning out toward the top
    const gr = ctx.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    fillPath(ctx, [w / 2 - 2, h, w / 2 + 2, h, w - 1, 0, 1, 0]);
  }],
  ['rotor', 48, 48, (ctx, w, h) => {
    // drone rotor seen from above: a faint blur disc and two motion-blurred blades
    const cx = w / 2;
    const cy = h / 2;
    const r = w / 2 - 1;
    const gr = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.12)');
    gr.addColorStop(0.85, 'rgba(255,255,255,0.3)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const a of [0, Math.PI]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r * 0.95, a - 0.2, a + 0.2);
      ctx.closePath();
      ctx.fill();
    }
  }],
  ['card', 24, 32, (ctx, w, h) => {
    // holo fortune card (portrait): white face, a soft rim and a diamond sigil in the middle
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(1.5, 1.5, w - 3, h - 3);
    ctx.strokeStyle = 'rgba(150,120,140,0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = 'rgba(150,110,130,0.7)';
    fillPath(ctx, [w / 2, h * 0.3, w * 0.68, h / 2, w / 2, h * 0.7, w * 0.32, h / 2]);
  }],
];

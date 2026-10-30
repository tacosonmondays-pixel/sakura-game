// The recruit cinematic's effects layer (docs/RECRUIT_CINEMATIC.md): sparks, electric arcs, sakura petals, light
// rays and starlight on one 2D canvas over the Gate. Phones first: fixed pools (SPARKS, PETALS, ARCS), one pass a
// frame, no shadows or filters (a glow is a wide faint stroke under a thin bright one). Randomness only from the
// seeded stream it is handed (src/render/vfx/random.js); time only from update(dt).

const TAU = Math.PI * 2;

/** Pool sizes (the most of each alive at once). */
export const SPARKS = 220;
export const PETALS = 36;
export const ARCS = 10;
export const STARS = 60;

export class CinematicFx {
  /** @param {ReturnType<import('../../render/vfx/random.js').createVisualRandom>} rand */
  constructor(rand, { reduce = false } = {}) {
    this.rand = rand;
    this.reduce = !!reduce;
    this.el = document.createElement('canvas');
    this.el.className = 'rc-fx';
    this.el.setAttribute('aria-hidden', 'true');
    this.ctx = this.el.getContext('2d');
    this.w = 1;
    this.h = 1;
    this.dpr = 1;
    this.sparks = [];
    this.petals = [];
    this.arcs = [];
    this.stars = [];
    this.rings = [];
    // what the cinematic asks for each frame
    this.center = { x: 0, y: 0, r: 100 };
    this.rays = 0; // 0..1
    this.rayHue = null; // a number turns the rays rainbow; null = rayColor
    this.rayColor = [160, 215, 255];
    this.arcRate = 0; // arcs a second
    this.arcColor = [190, 230, 255];
    this.arcHue = null;
    this.sparkRate = 0;
    this.sparkColor = [180, 225, 255];
    this.sparkHue = null;
    this.petalRate = 0;
    this.starAmount = 0; // 0..1 starlight across the screen (LR)
    this.t = 0;
    this._arcAcc = 0;
    this._sparkAcc = 0;
    this._petalAcc = 0;
  }

  resize(w, h, dpr = 1) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.dpr = dpr;
    this.el.width = Math.round(this.w * dpr);
    this.el.height = Math.round(this.h * dpr);
    this.el.style.width = `${this.w}px`;
    this.el.style.height = `${this.h}px`;
  }

  /** A ring of sparks bursting out of (x, y) and a shockwave ring (the Gate opening, a mark stamping in). */
  burst(x, y, { count = 60, speed = 420, color = null, hue = null, ring = true, size = 1 } = {}) {
    const n = this.reduce ? Math.min(12, count) : count;
    for (let i = 0; i < n; i++) {
      const a = this.rand() * TAU;
      const v = speed * (0.35 + this.rand() * 0.75) * (this.reduce ? 0.3 : 1);
      this.spark(x, y, Math.cos(a) * v, Math.sin(a) * v, { color, hue: hue == null ? null : hue + this.rand() * 120, size: size * (1 + this.rand() * 1.5), life: 0.5 + this.rand() * 0.6 });
    }
    if (ring && !this.reduce) this.rings.push({ x, y, r: 10, v: speed * 1.4, life: 0.55, max: 0.55, color: color || [255, 255, 255], hue });
  }

  spark(x, y, vx, vy, { color = null, hue = null, size = 1.5, life = 0.8 } = {}) {
    if (this.sparks.length >= SPARKS) this.sparks.shift();
    this.sparks.push({ x, y, vx, vy, life, max: life, size, color: color || this.sparkColor, hue });
  }

  _spawnSpark() {
    const { x, y, r } = this.center;
    const sq = this.center.squash ?? 1;
    const a = this.rand() * TAU;
    const rr = r * (0.82 + this.rand() * 0.2);
    const out = 40 + this.rand() * 160;
    this.spark(x + Math.cos(a) * rr, y + Math.sin(a) * rr * sq, Math.cos(a) * out + this.rand.signed() * 60, Math.sin(a) * out - 30 - this.rand() * 40, {
      hue: this.sparkHue == null ? null : this.sparkHue + this.rand() * 90, size: 1 + this.rand() * 1.8, life: 0.4 + this.rand() * 0.7,
    });
  }

  _spawnPetal() {
    if (this.petals.length >= PETALS) return;
    const fromLeft = this.rand() < 0.5;
    this.petals.push({
      x: fromLeft ? -20 : this.rand() * this.w,
      y: fromLeft ? this.rand() * this.h * 0.7 : -20,
      vx: (this.reduce ? 18 : 40) + this.rand() * (this.reduce ? 12 : 50),
      vy: (this.reduce ? 14 : 30) + this.rand() * (this.reduce ? 10 : 40),
      rot: this.rand() * TAU,
      vr: (this.rand() - 0.5) * (this.reduce ? 0.6 : 3),
      sway: this.rand() * TAU,
      size: 5 + this.rand() * 6,
      tint: this.rand(),
    });
  }

  /** A jagged bolt from the ring outward or across a chord (midpoint displacement, 3 levels: 9 points). */
  _spawnArc() {
    if (this.arcs.length >= ARCS) this.arcs.shift();
    const { x, y, r } = this.center;
    const sq = this.center.squash ?? 1; // the whirlpool's rim is an ellipse on the sea
    const a = this.rand() * TAU;
    const x0 = x + Math.cos(a) * r * 0.9;
    const y0 = y + Math.sin(a) * r * 0.9 * sq;
    let x1;
    let y1;
    if (this.rand() < 0.55) {
      const out = r * (1.2 + this.rand() * 0.6);
      const b = a + this.rand.signed() * 0.6;
      x1 = x + Math.cos(b) * out;
      y1 = y + Math.sin(b) * out * sq - r * 0.25 * this.rand();
    } else {
      const b = a + 0.6 + this.rand() * 1.2;
      x1 = x + Math.cos(b) * r * 0.9;
      y1 = y + Math.sin(b) * r * 0.9 * sq;
    }
    let pts = [[x0, y0], [x1, y1]];
    let amp = Math.hypot(x1 - x0, y1 - y0) * 0.22;
    for (let lvl = 0; lvl < 3; lvl++) {
      const next = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1];
        const [bx, by] = pts[i];
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy) || 1;
        const off = this.rand.signed() * 2 * amp;
        next.push([(ax + bx) / 2 - (dy / len) * off, (ay + by) / 2 + (dx / len) * off], pts[i]);
      }
      pts = next;
      amp *= 0.5;
    }
    const life = 0.09 + this.rand() * 0.1;
    this.arcs.push({ pts, life, max: life, hue: this.arcHue == null ? null : this.arcHue + this.rand() * 140, w: 1 + this.rand() * 1.4 });
  }

  /** Starlight across the screen (LR): fixed positions from the stream, twinkling on t. */
  _ensureStars() {
    if (this.stars.length) return;
    for (let i = 0; i < STARS; i++) this.stars.push({ x: this.rand(), y: this.rand(), s: 0.6 + this.rand() * 1.8, ph: this.rand() * TAU, gold: this.rand() < 0.3 });
  }

  update(dt) {
    this.t += dt;
    // spawning
    this._arcAcc += this.arcRate * dt;
    while (this._arcAcc >= 1) { this._arcAcc -= 1; this._spawnArc(); }
    this._sparkAcc += this.sparkRate * dt;
    while (this._sparkAcc >= 1) { this._sparkAcc -= 1; this._spawnSpark(); }
    this._petalAcc += this.petalRate * dt;
    while (this._petalAcc >= 1) { this._petalAcc -= 1; this._spawnPetal(); }
    // motion
    const drag = Math.exp(-2.2 * dt);
    for (const s of this.sparks) {
      s.vx *= drag;
      s.vy = s.vy * drag + 140 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
    for (const p of this.petals) {
      p.sway += dt * 1.6;
      p.x += (p.vx + Math.sin(p.sway) * 22) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.petals = this.petals.filter((p) => p.x < this.w + 30 && p.y < this.h + 30);
    for (const a of this.arcs) a.life -= dt;
    this.arcs = this.arcs.filter((a) => a.life > 0);
    for (const g of this.rings) {
      g.r += g.v * dt;
      g.v *= Math.exp(-3 * dt);
      g.life -= dt;
    }
    this.rings = this.rings.filter((g) => g.life > 0);
    this.draw();
  }

  /** Anything still alive (the loop may stop drawing once nothing is). */
  get busy() {
    return this.sparks.length + this.petals.length + this.arcs.length + this.rings.length > 0 || this.rays > 0.01 || this.starAmount > 0.01;
  }

  draw() {
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const { x, y, r } = this.center;
    ctx.globalCompositeOperation = 'lighter';

    // light rays from the portal (wedges with a fading gradient)
    if (this.rays > 0.01) {
      const n = 12;
      const len = Math.hypot(this.w, this.h);
      const spin = this.reduce ? 0 : this.t * 0.35;
      const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, len * 0.7);
      const c = this.rayColor;
      g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${(0.22 * this.rays).toFixed(3)})`);
      g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      for (let i = 0; i < n; i++) {
        const a = spin + (i / n) * TAU;
        const wdt = 0.07 + 0.05 * Math.sin(i * 2.1 + this.t * 0.8);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a - wdt) * len, y + Math.sin(a - wdt) * len);
        ctx.lineTo(x + Math.cos(a + wdt) * len, y + Math.sin(a + wdt) * len);
        ctx.closePath();
        if (this.rayHue != null) {
          const rg = ctx.createRadialGradient(x, y, r * 0.3, x, y, len * 0.7);
          rg.addColorStop(0, `hsla(${Math.round((this.rayHue + i * 30) % 360)},95%,72%,${(0.2 * this.rays).toFixed(3)})`);
          rg.addColorStop(1, 'hsla(0,0%,100%,0)');
          ctx.fillStyle = rg;
        } else ctx.fillStyle = g;
        ctx.fill();
      }
    }

    // starlight (LR)
    if (this.starAmount > 0.01) {
      this._ensureStars();
      for (const s of this.stars) {
        const tw = this.reduce ? 0.7 : 0.45 + 0.55 * Math.sin(this.t * 3 + s.ph);
        const a = this.starAmount * tw;
        ctx.fillStyle = s.gold ? `rgba(255,210,122,${a.toFixed(3)})` : `rgba(235,242,255,${a.toFixed(3)})`;
        const px = s.x * this.w;
        const py = s.y * this.h;
        const k = s.s * 2.2;
        ctx.beginPath();
        ctx.moveTo(px, py - k);
        ctx.lineTo(px + k * 0.25, py);
        ctx.lineTo(px, py + k);
        ctx.lineTo(px - k * 0.25, py);
        ctx.closePath();
        ctx.moveTo(px - k, py);
        ctx.lineTo(px, py + k * 0.25);
        ctx.lineTo(px + k, py);
        ctx.lineTo(px, py - k * 0.25);
        ctx.closePath();
        ctx.fill();
      }
    }

    // shockwave rings
    for (const g of this.rings) {
      const a = (g.life / g.max) * 0.7;
      ctx.lineWidth = 2 + 10 * (g.life / g.max);
      ctx.strokeStyle = g.hue != null ? `hsla(${Math.round(g.hue % 360)},95%,75%,${a.toFixed(3)})` : `rgba(${g.color[0]},${g.color[1]},${g.color[2]},${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r, 0, TAU);
      ctx.stroke();
    }

    // electric arcs: a wide faint stroke (the glow) under a thin white-hot one
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const a of this.arcs) {
      const k = a.life / a.max;
      ctx.beginPath();
      a.pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      const c = this.arcColor;
      ctx.lineWidth = a.w * 6;
      ctx.strokeStyle = a.hue != null ? `hsla(${Math.round(a.hue % 360)},100%,65%,${(0.28 * k).toFixed(3)})` : `rgba(${c[0]},${c[1]},${c[2]},${(0.28 * k).toFixed(3)})`;
      ctx.stroke();
      ctx.lineWidth = a.w;
      ctx.strokeStyle = `rgba(255,255,255,${(0.9 * k).toFixed(3)})`;
      ctx.stroke();
    }

    // sparks: short streaks along their motion
    for (const s of this.sparks) {
      const k = s.life / s.max;
      ctx.lineWidth = s.size;
      ctx.strokeStyle = s.hue != null ? `hsla(${Math.round(s.hue % 360)},100%,72%,${k.toFixed(3)})` : `rgba(${s.color[0]},${s.color[1]},${s.color[2]},${k.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03);
      ctx.stroke();
    }

    // sakura petals (drawn normally, not added light)
    ctx.globalCompositeOperation = 'source-over';
    for (const p of this.petals) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(p.sway)));
      ctx.fillStyle = p.tint < 0.5 ? 'rgba(255,183,213,0.9)' : 'rgba(255,214,232,0.9)';
      const s = p.size;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.9, -s * 0.6, s * 0.7, s * 0.7, 0, s);
      ctx.bezierCurveTo(-s * 0.7, s * 0.7, -s * 0.9, -s * 0.6, 0, -s);
      ctx.fill();
      ctx.restore();
    }
  }

  dispose() {
    this.el.remove();
    this.sparks = this.petals = this.arcs = this.rings = [];
  }
}

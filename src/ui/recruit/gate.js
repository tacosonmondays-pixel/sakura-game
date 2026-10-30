// The academy's Gate for the recruit cinematic (docs/RECRUIT_CINEMATIC.md). A swappable component: the cinematic
// only talks to the small interface below, so the owner's own 3D gate model can drop in later through
// setGateFactory (its factory may be async and lazy-load three.js and the model; until it resolves, or if it
// fails, the drawn Gate plays).
//
// Interface (every method is called by the cinematic; all sizes are CSS px):
//   el                       the element to place in the overlay (a canvas, or a container)
//   resize(w, h, dpr)        the viewport changed
//   update(s)                one frame: s = { t, dt, phase: 'power'|'surge'|'night'|'open'|'done', p, tier,
//                            energy (0..1), hue (deg, the rainbow's turn), accent ('gold' | null),
//                            openPeak (the brightest the opening light may get: the flash guard's cap) }
//   center()                 { x, y, r, squash }: the portal's centre, radius and vertical squash (1 = a circle
//                            facing the camera; less = a plane seen at an angle), so sparks and arcs gather on it
//   dispose()
//
// The default Gate is drawn on a 2D canvas: a vast whirlpool on a dark sea seen low and at an angle, misty
// mountains on the horizon, spiral streaks of light pulling into a black eye (faster near the eye), twelve runes
// around its rim that light one by one, and, when it opens, light welling up out of the eye. Blue, then rainbow
// streaks for an SSR, gold and starlit on a Nightglass sea for an LR. Time comes only from `s.t` / `s.dt`;
// the streaks and ridges come from the seeded stream in `opts.rand`.

import { createVisualRandom } from '../../render/vfx/random.js';

const TAU = Math.PI * 2;

/** Colours of the Gate by tier (the rainbow turns through the hue wheel instead). */
export const GATE_COLORS = Object.freeze({
  blue: Object.freeze({ glow: [95, 180, 255], core: [210, 240, 255], line: [150, 215, 255] }),
  gold: Object.freeze({ glow: [255, 200, 90], core: [255, 244, 214], line: [255, 214, 130] }),
  night: Object.freeze({ glow: [60, 72, 170], core: [255, 236, 190], line: [255, 210, 122] }),
});

let factory = null;

/**
 * Swap the Gate: `make(opts)` returns a Gate (or a Promise of one). Pass null to go back to the drawn Gate.
 * @param {((opts: { reduce: boolean, rand?: Function }) => object | Promise<object>) | null} make
 */
export function setGateFactory(make) {
  factory = typeof make === 'function' ? make : null;
}

/** The Gate to play: the swapped-in one when it is ready, else the drawn one. @returns {Promise<object>} */
export async function createGate(opts = {}) {
  if (factory) {
    try {
      const g = await factory(opts);
      if (g && g.el && typeof g.update === 'function') return g;
    } catch (e) {
      console.warn('[recruit] the custom Gate failed; the drawn Gate plays', e);
    }
  }
  return new CanvasGate(opts);
}

const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const hsl = (h, s, l, a) => `hsla(${Math.round(h % 360)},${s}%,${l}%,${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const smooth = (x) => x * x * (3 - 2 * x);

/** Streaks in the whirlpool (phones first: one stroke each, a frame). */
export const STREAKS = 72;

/** The drawn Gate (2D canvas): the whirlpool. */
export class CanvasGate {
  constructor({ reduce = false, rand = null } = {}) {
    this.reduce = !!reduce;
    this.rand = rand || createVisualRandom('recruit-gate');
    this.el = document.createElement('canvas');
    this.el.className = 'rc-gate';
    this.el.setAttribute('aria-hidden', 'true');
    this.ctx = this.el.getContext('2d');
    this.w = 1;
    this.h = 1;
    this.dpr = 1;
    this.bg = null; // the sky, horizon and sea, drawn once a size (an offscreen canvas)
    // each streak: its ring (0 eye .. 1 rim), start angle, length (rad), width and brightness
    this.streaks = Array.from({ length: STREAKS }, () => {
      const q = this.rand() ** 0.8;
      return { q, a: this.rand() * TAU, len: 0.5 + this.rand() * 1.6, w: 0.6 + this.rand() * 1.8, b: 0.35 + this.rand() * 0.65 };
    });
    this.ridges = [0, 1].map(() => Array.from({ length: 9 }, () => this.rand()));
    this.swells = Array.from({ length: 26 }, () => ({ d: 0.05 + this.rand() * 0.95, x: this.rand() * 1.1 - 0.15, len: 0.1 + this.rand() * 0.3 }));
  }

  resize(w, h, dpr = 1) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.dpr = dpr;
    this.el.width = Math.round(this.w * dpr);
    this.el.height = Math.round(this.h * dpr);
    this.el.style.width = `${this.w}px`;
    this.el.style.height = `${this.h}px`;
    this.bg = null;
  }

  center() {
    const portrait = this.h > this.w * 1.2;
    // the eye sits a little below the middle; the sea plane is seen at an angle (squashed ellipse)
    return portrait
      ? { x: this.w / 2, y: this.h * 0.5, r: this.w * 0.62, squash: 0.5 }
      : { x: this.w / 2, y: this.h * 0.58, r: Math.min(this.w * 0.42, this.h * 1.05), squash: 0.36 };
  }

  /** The horizon line (CSS px from the top). */
  horizon() {
    const { y, r, squash } = this.center();
    return Math.max(this.h * 0.12, y - r * squash - this.h * 0.06);
  }

  /** The Gate's colours at this moment (blue → rainbow → Nightglass). */
  colors(s) {
    const { phase, p, tier, hue } = s;
    const blue = s.accent === 'gold' ? mix(GATE_COLORS.blue.glow, GATE_COLORS.gold.glow, 0.35) : GATE_COLORS.blue.glow;
    const base = { glow: blue, line: GATE_COLORS.blue.line, core: GATE_COLORS.blue.core, rainbow: 0, night: 0, hue };
    if (tier === 'blue' || phase === 'power') return base;
    if (phase === 'surge') return { ...base, rainbow: smooth(Math.min(1, p * 2.2)) };
    if (tier === 'lr' && (phase === 'night' || phase === 'open' || phase === 'done')) {
      const k = phase === 'night' ? smooth(Math.min(1, p * 1.6)) : 1;
      return { glow: GATE_COLORS.night.glow, line: GATE_COLORS.night.line, core: GATE_COLORS.night.core, rainbow: 1 - k, night: k, hue };
    }
    return { ...base, rainbow: 1 };
  }

  /** The sky, the misty mountains and the dark sea: static, so drawn once a size. */
  background() {
    if (this.bg) return this.bg;
    const c = document.createElement('canvas');
    c.width = this.el.width;
    c.height = this.el.height;
    const g = c.getContext('2d');
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const hz = this.horizon();
    const sky = g.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#0d1a33');
    sky.addColorStop(0.6, '#3a5a80');
    sky.addColorStop(1, '#8fb0cc');
    g.fillStyle = sky;
    g.fillRect(0, 0, this.w, hz + 1);
    // two mountain ridges in the mist, the far one paler
    this.ridges.forEach((pts, layer) => {
      g.fillStyle = layer ? 'rgba(52,78,108,0.9)' : 'rgba(110,140,170,0.55)';
      g.beginPath();
      g.moveTo(0, hz);
      const n = pts.length - 1;
      const at = (i) => [(i / n) * this.w, hz - (layer ? 0.08 : 0.15) * this.h * (0.25 + pts[i] * 0.75)];
      g.lineTo(...at(0));
      for (let i = 1; i <= n; i++) {
        const [px, py] = at(i - 1);
        const [qx, qy] = at(i);
        g.quadraticCurveTo(px, py, (px + qx) / 2, (py + qy) / 2);
      }
      g.lineTo(...at(n));
      g.lineTo(this.w, hz);
      g.closePath();
      g.fill();
    });
    // mist along the horizon
    const mist = g.createLinearGradient(0, hz - this.h * 0.08, 0, hz + this.h * 0.05);
    mist.addColorStop(0, 'rgba(170,198,220,0)');
    mist.addColorStop(0.6, 'rgba(170,198,220,0.55)');
    mist.addColorStop(1, 'rgba(170,198,220,0)');
    g.fillStyle = mist;
    g.fillRect(0, hz - this.h * 0.08, this.w, this.h * 0.13);
    // the sea: steel blue at the horizon, black-blue at our feet
    const sea = g.createLinearGradient(0, hz, 0, this.h);
    sea.addColorStop(0, '#5b7c9c');
    sea.addColorStop(0.25, '#203752');
    sea.addColorStop(1, '#050b18');
    g.fillStyle = sea;
    g.fillRect(0, hz, this.w, this.h - hz);
    // long swells on the open sea, closer together towards the horizon
    g.lineCap = 'round';
    for (const sw of this.swells) {
      const yy = hz + (this.h - hz) * sw.d * sw.d;
      g.strokeStyle = `rgba(190,215,235,${(0.05 + 0.1 * (1 - sw.d)).toFixed(3)})`;
      g.lineWidth = 0.6 + sw.d * 1.6;
      g.beginPath();
      g.moveTo(sw.x * this.w, yy);
      g.quadraticCurveTo((sw.x + sw.len / 2) * this.w, yy - 3 * sw.d, (sw.x + sw.len) * this.w, yy);
      g.stroke();
    }
    this.bg = c;
    return c;
  }

  update(s) {
    const { ctx, dpr } = this;
    const { x, y, r, squash } = this.center();
    const t = s.t;
    const e = Math.max(0, Math.min(1, s.energy));
    const col = this.colors(s);
    const open = s.phase === 'open' ? smooth(s.p) : s.phase === 'done' ? 1 : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.el.width, this.el.height);
    ctx.drawImage(this.background(), 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (col.night > 0) {
      // the Nightglass: the whole scene sinks into navy
      ctx.fillStyle = `rgba(8,14,40,${(0.6 * col.night).toFixed(3)})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }

    // everything on the sea is drawn in the plane's space: a circle squashed into an ellipse
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, squash);

    // the bowl of the whirlpool: lighter water at the rim falling into the black eye
    const bowl = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    const rim = col.night ? mix([40, 60, 120], [10, 16, 40], 0.2) : mix([70, 105, 140], col.glow, 0.15 + e * 0.25);
    bowl.addColorStop(0, 'rgba(0,3,10,0.98)');
    bowl.addColorStop(0.18, 'rgba(4,10,24,0.95)');
    bowl.addColorStop(0.6, rgba(mix(rim, [10, 20, 40], 0.5), 0.75));
    bowl.addColorStop(1, rgba(rim, 0));
    ctx.fillStyle = bowl;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();

    // the streaks: arcs around the eye, faster the closer they are (with Reduce motion a slow, even turn)
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const speed = this.reduce ? 0.15 : 0.35 + e * 1.4;
    for (const k of this.streaks) {
      const rr = r * (0.1 + k.q * 0.9);
      const a0 = k.a + t * speed * (this.reduce ? 1 : 0.35 / (0.12 + k.q));
      const len = k.len * (0.6 + 0.4 * e);
      const rimFade = k.q > 0.85 ? (1 - k.q) / 0.15 : 1;
      // the near side of the whirlpool (the bottom of the ellipse) is closer: wider and brighter
      const near = 0.5 + 0.5 * Math.sin(a0 + len / 2);
      const alpha = k.b * rimFade * (0.12 + e * 0.5) * (0.4 + k.q * 0.6) * (0.55 + near * 0.6);
      if (alpha < 0.01) continue;
      // the streak spirals inward along its length, pulled towards the eye
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const f = i / 8;
        const a = a0 + f * len;
        const rad = rr * (1 - f * 0.3);
        if (i) ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
        else ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      const lw = k.w * (1 + e * 1.2) * (0.5 + k.q) * (0.6 + near);
      let c;
      if (col.rainbow > 0.05 && !this.reduce) c = (a) => hsl(col.hue + k.a * 57 + k.q * 160, 95, 72, a * (0.6 + 0.6 * col.rainbow));
      else if (col.night > 0.05) c = (a) => rgba(k.b > 0.7 ? GATE_COLORS.night.line : [200, 214, 255], a * 1.2);
      else { const base = mix([190, 214, 235], col.line, 0.3 + e * 0.4); c = (a) => rgba(base, a); }
      // foam: a wide faint stroke under a thin bright one
      ctx.lineWidth = lw * 4;
      ctx.strokeStyle = c(alpha * 0.18);
      ctx.stroke();
      ctx.lineWidth = lw;
      ctx.strokeStyle = c(alpha);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    // the throat of the eye: a black funnel, a little below the centre (it falls away from us)
    const throat = ctx.createRadialGradient(0, r * 0.03, 0, 0, r * 0.03, r * 0.24);
    throat.addColorStop(0, 'rgba(0,2,8,0.95)');
    throat.addColorStop(0.6, 'rgba(2,6,16,0.6)');
    throat.addColorStop(1, 'rgba(2,6,16,0)');
    ctx.fillStyle = throat;
    ctx.beginPath();
    ctx.arc(0, r * 0.03, r * 0.24, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';

    // twelve runes around the rim, lit one by one while the Gate powers on
    const lit = s.phase === 'power' ? s.p * 12 : 12;
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 2 + (i / 12) * TAU + (this.reduce ? 0 : t * 0.08);
      const on = Math.max(0, Math.min(1, lit - i));
      const rs = r * 0.022;
      const px = Math.cos(a) * r * 0.86;
      const py = Math.sin(a) * r * 0.86;
      ctx.fillStyle = col.rainbow > 0.05 && !this.reduce ? hsl(col.hue + i * 30, 100, 72, 0.1 + on * 0.85)
        : rgba(col.night ? GATE_COLORS.night.line : col.line, 0.1 + on * 0.85);
      ctx.beginPath();
      ctx.moveTo(px, py - rs * 2.2);
      ctx.lineTo(px + rs, py);
      ctx.lineTo(px, py + rs * 2.2);
      ctx.lineTo(px - rs, py);
      ctx.closePath();
      ctx.fill();
    }

    // the eye's glow: it brightens with the energy, and when the Gate opens light wells up out of it
    const eyeR = r * (0.12 + e * 0.08 + open * 0.9);
    const eye = ctx.createRadialGradient(0, 0, 0, 0, 0, eyeR);
    const ec = col.night ? GATE_COLORS.night.core : col.core;
    const eyeA = 0.04 + e * 0.22 + open * 0.4;
    if (col.rainbow > 0.05 && !this.reduce && !col.night) {
      eye.addColorStop(0, hsl(col.hue, 90, 80, eyeA * col.rainbow + 0.05));
      eye.addColorStop(0.5, hsl(col.hue + 140, 90, 65, eyeA * 0.5 * col.rainbow));
    } else {
      eye.addColorStop(0, rgba(ec, eyeA));
      eye.addColorStop(0.5, rgba(mix(ec, col.glow, 0.6), eyeA * 0.5));
    }
    eye.addColorStop(1, rgba(col.glow, 0));
    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.arc(0, 0, eyeR, 0, TAU);
    ctx.fill();
    ctx.restore();

    // the column of light rising from the eye (open), and the soft light filling the screen (never full white)
    if (open > 0) {
      const peak = s.openPeak ?? 0.55;
      const oc = col.night ? GATE_COLORS.night.core : col.core;
      const colW = r * (0.12 + open * 0.5);
      const beam = ctx.createLinearGradient(x - colW, 0, x + colW, 0);
      beam.addColorStop(0, rgba(oc, 0));
      beam.addColorStop(0.5, rgba(oc, peak * 0.9 * open));
      beam.addColorStop(1, rgba(oc, 0));
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = beam;
      ctx.fillRect(x - colW, 0, colW * 2, y);
      ctx.globalCompositeOperation = 'source-over';
      const big = Math.hypot(this.w, this.h);
      const og = ctx.createRadialGradient(x, y, 0, x, y, r * 0.3 + open * big);
      og.addColorStop(0, rgba(oc, peak * open));
      og.addColorStop(0.6, rgba(oc, peak * 0.45 * open));
      og.addColorStop(1, rgba(oc, 0));
      ctx.fillStyle = og;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  dispose() {
    this.el.remove();
    this.bg = null;
  }
}

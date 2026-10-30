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
// The default Gate is drawn on a 2D canvas: the portal itself, a vortex almost facing us. Spiral streaks of light
// pull into a black eye (faster near the eye) inside a glowing rim with twelve runes that light one by one, and
// when it opens the light in the eye swells to fill the screen. Blue, then rainbow streaks for an SSR, gold and
// starlit Nightglass for an LR. Time comes only from `s.t` / `s.dt`;
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

/** Streaks in the vortex (phones first: one stroke each, a frame). */
export const STREAKS = 72;

/** The drawn Gate (2D canvas): the vortex portal. */
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
    this.bg = null; // the dark around the portal, drawn once a size (an offscreen canvas)
    // each streak: its ring (0 eye .. 1 rim), start angle, length (rad), width and brightness
    this.streaks = Array.from({ length: STREAKS }, () => {
      const q = this.rand() ** 0.8;
      return { q, a: this.rand() * TAU, len: 0.5 + this.rand() * 1.6, w: 0.6 + this.rand() * 1.8, b: 0.35 + this.rand() * 0.65 };
    });
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
    // the portal almost faces us: a slight tilt (squash) gives it depth
    return portrait
      ? { x: this.w / 2, y: this.h * 0.45, r: this.w * 0.44, squash: 0.92 }
      : { x: this.w / 2, y: this.h * 0.5, r: Math.min(this.w * 0.34, this.h * 0.43), squash: 0.88 };
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

  /** The dark around the portal (a deep navy vignette): static, so drawn once a size. */
  background() {
    if (this.bg) return this.bg;
    const c = document.createElement('canvas');
    c.width = this.el.width;
    c.height = this.el.height;
    const g = c.getContext('2d');
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const { x, y } = this.center();
    const bg = g.createRadialGradient(x, y, 0, x, y, Math.hypot(this.w, this.h) * 0.6);
    bg.addColorStop(0, '#1a2b52');
    bg.addColorStop(0.45, '#0d1834');
    bg.addColorStop(1, '#040814');
    g.fillStyle = bg;
    g.fillRect(0, 0, this.w, this.h);
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

    // the halo around the portal
    const halo = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * (1.7 + open));
    const hc = col.night ? GATE_COLORS.night.glow : col.glow;
    const haloA = 0.1 + e * 0.35;
    if (col.rainbow > 0.05 && !this.reduce && !col.night) halo.addColorStop(0, hsl(col.hue, 90, 65, haloA * col.rainbow + 0.03));
    else halo.addColorStop(0, rgba(hc, haloA));
    halo.addColorStop(1, rgba(hc, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, this.w, this.h);

    // the portal is drawn in its own plane: a circle squashed a little (a slight tilt)
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, squash);

    // the bowl of the vortex: lighter at the rim falling into the black eye
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
      // the near side of the tilted portal (its bottom) is a little closer: wider and brighter
      const near = 0.5 + 0.5 * Math.sin(a0 + len / 2);
      const alpha = k.b * rimFade * (0.12 + e * 0.5) * (0.4 + k.q * 0.6) * (0.75 + near * 0.35);
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
      const lw = k.w * (1 + e * 1.2) * (0.5 + k.q) * (0.8 + near * 0.4);
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

    // the rim: a wide faint glow under a bright line
    const rimCol = col.night ? GATE_COLORS.night.line : col.line;
    for (const [wd, al] of [[r * 0.06, 0.12 + e * 0.2], [Math.max(1.5, r * 0.012), 0.4 + e * 0.6]]) {
      ctx.lineWidth = wd;
      ctx.strokeStyle = col.rainbow > 0.05 && !this.reduce && !col.night ? hsl(col.hue, 95, 72, al) : rgba(rimCol, al);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.97, 0, TAU);
      ctx.stroke();
    }

    // twelve runes around the rim, lit one by one while the Gate powers on
    const lit = s.phase === 'power' ? s.p * 12 : 12;
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 2 + (i / 12) * TAU + (this.reduce ? 0 : t * 0.08);
      const on = Math.max(0, Math.min(1, lit - i));
      const rs = r * 0.022;
      const px = Math.cos(a) * r * 1.06;
      const py = Math.sin(a) * r * 1.06;
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

    // opening: the light in the eye swells to fill the screen (a soft light, never full white)
    if (open > 0) {
      const peak = s.openPeak ?? 0.55;
      const oc = col.night ? GATE_COLORS.night.core : col.core;
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

// Toon slashes and shockwave rings (docs/specs/VFX_LIBRARY.md batches B4 and B5; display only).
//
// A slash is a crescent: an arc of strokes flat to the camera, thickest in its middle and tapering to points at both
// ends. It sweeps across in a few frames (the leader), holds a beat, then its back end chases its front off and it breaks
// into dashes. A shockwave is a ring of strokes lying on the ground. It bursts out fast and eases, thinning as it goes,
// and breaks into dashes at the end. Both use the house layers: a dark ink line, the body colour, a white-hot core.
//
//   const shapes = createShapeFx({ scene, strokes, camera, quality, reduceMotion });
//   shapes.slash(x, y, z, angle, color, { size })   // angle: its turn on screen, as the old slash sprite's
//   shapes.shock(x, z, r0, r1, color, { life })     // ground radii (world units)
//   shapes.update(dt)   // between the shared strokes' begin and end
//
// Draw cost: toon strokes (src/render/vfx/strokes.js), sharing the battle's one draw call of styled lines; standalone
// (tests, the lab) it makes its own. Never the sim, never Math.random.
import * as THREE from 'three';
import { createStrokes, stroke, SOLID } from './strokes.js';

/** Detail per graphics tier: joints in a slash's arc and a shockwave's ring, and the most shapes up at once. */
export const SHAPE_TIERS = {
  high: { arc: 12, ring: 28, max: 64 },
  medium: { arc: 9, ring: 20, max: 40 },
  low: { arc: 6, ring: 12, max: 24 },
};

/** A slash: its sweep (radians of the arc), how flat its bulge is, its beats (s), its half width at the middle, its layers and its reach (× size). */
export const SLASH = { sweep: 2.6, flat: 0.5, grow: 0.05, hold: 0.06, fade: 0.12, width: 0.11, ink: 0.024, core: 0.42, reach: 0.72 };
/** A shockwave: its life (s), its band's half width at the start, its layers. */
export const SHOCK = { life: 0.36, width: 0.085, ink: 0.022, core: 0.4 };
/** Thinnest each layer is drawn (half width, CSS px). */
const MIN_PX = { ink: 2.2, body: 1.4, core: 0.7 };

const ease = (k) => 1 - (1 - k) * (1 - k) * (1 - k);
function lin(color) {
  const c = color && color.isColor ? color : new THREE.Color(color || '#ffffff');
  return [c.r, c.g, c.b];
}

/**
 * @param {{ scene: THREE.Object3D, strokes?: object|null, camera?: THREE.Camera|null, quality?: 'high'|'medium'|'low',
 *   reduceMotion?: boolean }} o
 */
export function createShapeFx({ scene, strokes = null, camera = null, quality = 'medium', reduceMotion = false }) {
  let tierId = SHAPE_TIERS[quality] ? quality : 'medium';
  let tier = SHAPE_TIERS[tierId];
  const own = !strokes;
  const lines = strokes || createStrokes({ scene, max: 2048, name: 'shapeFx' });
  const S = stroke();
  const live = [];
  const right = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3(0, 1, 0);
  let time = 0;
  let drawn = 0;
  let seq = 0;

  const add = (rec) => {
    if (live.length >= tier.max) live.shift();
    live.push(rec);
    return rec;
  };

  /** A crescent slash centred on (x, y, z), turned by `angle` on screen. */
  function slash(x, y, z, angle, color, { size = 0.9 } = {}) {
    return add({ type: 'slash', x, y, z, angle: angle || 0, size: Math.max(0.3, size), col: lin(color), t: 0, seed: (seq++ % 89) * 0.77 });
  }

  /** A shockwave ring on the ground at (x, z), from radius r0 to r1. */
  function shock(x, z, r0, r1, color, { life = SHOCK.life, y = 0.06 } = {}) {
    return add({ type: 'shock', x, y, z, r0: Math.max(0, r0), r1: Math.max(r0 + 0.05, r1), life: Math.max(0.1, life), col: lin(color), t: 0, seed: (seq++ % 89) * 0.77 });
  }

  const slashLife = () => SLASH.grow + SLASH.hold + SLASH.fade * (reduceMotion ? 1.5 : 1);
  const lifeOf = (rec) => (rec.type === 'slash' ? slashLife() : rec.life * (reduceMotion ? 1.3 : 1));

  /** Joints of a shape now: [x, y, z, u, w]… (u 0..1 along it, w its half width there). */
  const J = [];
  function joints(rec) {
    J.length = 0;
    if (rec.type === 'slash') {
      const n = tier.arc;
      const c = Math.cos(rec.angle);
      const s = Math.sin(rec.angle);
      // the arc's own axes on screen: along (the slash's direction) and across (its bulge)
      const ax = right.x * c + up.x * s;
      const ay = right.y * c + up.y * s;
      const az = right.z * c + up.z * s;
      const bx = -right.x * s + up.x * c;
      const by = -right.y * s + up.y * c;
      const bz = -right.z * s + up.z * c;
      const rad = rec.size * SLASH.reach;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const th = (u - 0.5) * SLASH.sweep;
        // an ellipse arc bulging across, passing near the target at its middle
        const along = Math.sin(th) * rad;
        const across = (Math.cos(th) - 0.75) * rad * SLASH.flat;
        J.push(rec.x + ax * along + bx * across, rec.y + ay * along + by * across, rec.z + az * along + bz * across, u, SLASH.width * rec.size * Math.pow(Math.sin(Math.PI * u), 0.8));
      }
    } else {
      const n = tier.ring;
      const k = Math.min(1, rec.t / lifeOf(rec));
      const r = rec.r0 + (rec.r1 - rec.r0) * (reduceMotion ? k : ease(k));
      const w = SHOCK.width * (1 - 0.6 * k) * Math.min(1.6, 0.6 + rec.r1 * 0.4);
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        J.push(rec.x + Math.cos(a) * r, rec.y, rec.z + Math.sin(a) * r, i / n, w);
      }
    }
    return J.length / 5 - 1;
  }

  /** The leader's head, the chasing tail and the erosion of a shape now. */
  function beats(rec) {
    const t = rec.t;
    if (rec.type === 'slash') {
      const fade = SLASH.fade * (reduceMotion ? 1.5 : 1);
      const head = reduceMotion ? 99 : t / SLASH.grow;
      const q = Math.max(0, (t - SLASH.grow - SLASH.hold) / fade);
      return { head, tail: reduceMotion ? -99 : q * q, cut: Math.min(1, q) * 0.9 };
    }
    const k = Math.min(1, t / lifeOf(rec));
    return { head: 99, tail: -99, cut: k > 0.5 ? (k - 0.5) * 1.8 : 0 };
  }

  function draw() {
    drawn = 0;
    for (let layer = 0; layer < 3; layer++) {
      S.kind = SOLID;
      S.hdr = 0;
      S.noise = 8;
      S.bandFreq = 0;
      S.bandSpeed = 0;
      S.a = 1;
      S.minPx = layer === 0 ? MIN_PX.ink : layer === 1 ? MIN_PX.body : MIN_PX.core;
      for (const rec of live) {
        const n = joints(rec);
        const { head, tail, cut } = beats(rec);
        const ink = rec.type === 'slash' ? SLASH.ink : SHOCK.ink;
        const core = rec.type === 'slash' ? SLASH.core : SHOCK.core;
        const [r, g, b] = rec.col;
        S.head = head;
        S.tail = tail;
        S.cut = cut;
        S.seed = rec.seed;
        if (layer === 0) {
          S.r = r * 0.18 + 0.035;
          S.g = g * 0.18 + 0.02;
          S.b = b * 0.18 + 0.07;
        } else if (layer === 1) {
          S.r = r;
          S.g = g;
          S.b = b;
        } else {
          S.r = 0.85 + r * 0.15;
          S.g = 0.85 + g * 0.15;
          S.b = 0.85 + b * 0.15;
        }
        for (let i = 0; i < n; i++) {
          const o = i * 5;
          const wa = J[o + 4];
          const wb = J[o + 9];
          S.ax = J[o]; S.ay = J[o + 1]; S.az = J[o + 2];
          S.bx = J[o + 5]; S.by = J[o + 6]; S.bz = J[o + 7];
          S.ua = J[o + 3];
          S.ub = J[o + 8];
          if (layer === 0) {
            S.wa = wa + ink * Math.min(1, wa / 0.02 + 0.3);
            S.wb = wb + ink * Math.min(1, wb / 0.02 + 0.3);
          } else if (layer === 1) {
            S.wa = wa;
            S.wb = wb;
          } else {
            S.wa = wa * core;
            S.wb = wb * core;
          }
          if (lines.push(S)) drawn++;
        }
      }
    }
  }

  return {
    slash,
    shock,
    get mesh() {
      return lines.mesh;
    },
    update(dt) {
      time += dt;
      if (camera) {
        camera.updateMatrixWorld?.();
        right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
        up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
      }
      for (let i = live.length - 1; i >= 0; i--) {
        const rec = live[i];
        rec.t += dt;
        if (rec.t > lifeOf(rec)) live.splice(i, 1);
      }
      if (own) lines.begin();
      draw();
      if (own) lines.end(time);
    },
    setQuality(q) {
      tierId = SHAPE_TIERS[q] ? q : 'medium';
      tier = SHAPE_TIERS[tierId];
    },
    hold(on) {
      if (own) lines.hold(on);
    },
    setPixel(px) {
      if (own) lines.setPixel(px);
    },
    get live() {
      return live;
    },
    get stats() {
      return { shapes: live.length, strokes: drawn, tier: tierId };
    },
    clear() {
      live.length = 0;
    },
    dispose() {
      live.length = 0;
      if (own) lines.dispose();
    },
  };
}

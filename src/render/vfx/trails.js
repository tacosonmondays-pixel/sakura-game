// Projectile trails (docs/specs/VFX_LIBRARY.md batch B3; display only). Every projectile in flight draws a short toon
// ribbon behind it: a dark ink line, its own colour and a white core. The ribbon tapers to a point and breaks into dashes
// at the tail, so shots read as quick strokes instead of floating dots. When a shot lands or vanishes, its ribbon is
// pulled in after it and gone in a moment.
//
//   const trails = createTrails({ scene, strokes, quality, reduceMotion });
//   trails.feed(uid, x, y, z, color, kind)  // every projectile, every frame (where it is drawn; color a THREE.Color)
//   trails.update(dt)                       // between the shared strokes' begin and end
//
// Draw cost: toon strokes (src/render/vfx/strokes.js), sharing the battle's one draw call of styled lines; standalone
// (tests) it makes its own. A tier caps how many shots get a ribbon and how many joints it has. Reads positions only;
// never the sim, never Math.random.
import { createStrokes, stroke, SOLID } from './strokes.js';

/**
 * Per projectile kind: the ribbon's length (world units), its half width at the head, the white core's share of it (0:
 * none) and how far into the tail the dashes reach. Kinds not listed use `default`.
 */
export const TRAIL_KINDS = {
  default: { len: 0.6, width: 0.038, core: 0.45, dash: 0.45 },
  arrow: { len: 0.78, width: 0.034, core: 0.5, dash: 0.5 },
  bolt: { len: 0.9, width: 0.05, core: 0.5, dash: 0.4 },
  spark: { len: 0.72, width: 0.044, core: 0.5, dash: 0.4 },
  bullet: { len: 0.66, width: 0.03, core: 0.55, dash: 0.5 },
  fireball: { len: 0.82, width: 0.095, core: 0.4, dash: 0.55 },
  shuriken: { len: 0.5, width: 0.032, core: 0.4, dash: 0.6 },
  shell: { len: 0.6, width: 0.055, core: 0, dash: 0.7 },
  flask: { len: 0.5, width: 0.044, core: 0.35, dash: 0.7 },
};

/** Detail per graphics tier: how many shots get a ribbon, and the most joints a ribbon keeps. Low: none. */
export const TRAIL_TIERS = {
  high: { max: 160, joints: 7 },
  medium: { max: 90, joints: 5 },
  low: { max: 0, joints: 0 },
};

/** A new joint once the head moved this far (world units) or this long passed (s). */
const STEP = { dist: 0.07, time: 1 / 40 };
/** Seconds a ribbon takes to be pulled in after its shot is gone. */
export const TRAIL_TAIL = 0.12;
/** Thinnest each layer is drawn (half width, CSS px). */
const MIN_PX = { ink: 1.8, body: 1.1, core: 0.6 };

/**
 * @param {{ scene: import('three').Object3D, strokes?: object|null, quality?: 'high'|'medium'|'low', reduceMotion?: boolean }} o
 */
export function createTrails({ scene, strokes = null, quality = 'medium', reduceMotion = false }) {
  let tierId = TRAIL_TIERS[quality] ? quality : 'medium';
  let tier = TRAIL_TIERS[tierId];
  const own = !strokes;
  const lines = strokes || createStrokes({ scene, max: 4096, name: 'trailFx' });
  const S = stroke();
  /** uid → { pts: [x, y, z, t]…, cfg, r, g, b, seen, gone, seed } */
  const live = new Map();
  let time = 0;
  let frame = 0;
  let drawn = 0;
  let seq = 0;

  function feed(uid, x, y, z, color, kind) {
    if (!tier.max) return;
    let tr = live.get(uid);
    if (!tr) {
      if (live.size >= tier.max) return;
      tr = { pts: [], cfg: TRAIL_KINDS[kind] || TRAIL_KINDS.default, r: 1, g: 1, b: 1, seen: frame, gone: -1, seed: (seq++ % 97) * 0.731 };
      live.set(uid, tr);
    }
    tr.seen = frame;
    tr.gone = -1;
    if (color) {
      tr.r = color.r;
      tr.g = color.g;
      tr.b = color.b;
    }
    const p = tr.pts;
    const n = p.length;
    // the head always sits on the shot; a new joint is kept once it moved or time passed
    if (n >= 4) {
      const lx = p[n - 4];
      const ly = p[n - 3];
      const lz = p[n - 2];
      const moved = Math.hypot(x - lx, y - ly, z - lz);
      if (n >= 8 && moved < STEP.dist && time - p[n - 5] < STEP.time) {
        p[n - 4] = x;
        p[n - 3] = y;
        p[n - 2] = z;
        p[n - 1] = time;
        return;
      }
    }
    // keep only what the ribbon's length (and the tier's joints) needs: the oldest joints make room (no new arrays;
    // after a switch to a tier with fewer joints, all the extra ones at once)
    const over = p.length + 4 - (tier.joints + 1) * 4;
    if (over > 0) {
      p.copyWithin(0, over);
      p.length -= over;
    }
    p.push(x, y, z, time);
  }

  /** The joints of a ribbon from its head back, cut to its length; its shot gone: pulled in from the tail. */
  function path(tr, out) {
    out.length = 0;
    const p = tr.pts;
    const n = p.length / 4;
    if (n < 2) return 0;
    let len = tr.cfg.len * (reduceMotion ? 0.7 : 1);
    if (tr.gone >= 0) len *= Math.max(0, 1 - (time - tr.gone) / TRAIL_TAIL);
    if (len <= 0.01) return 0;
    let acc = 0;
    out.push(p[(n - 1) * 4], p[(n - 1) * 4 + 1], p[(n - 1) * 4 + 2], 0);
    for (let i = n - 2; i >= 0; i--) {
      const ax = p[(i + 1) * 4];
      const ay = p[(i + 1) * 4 + 1];
      const az = p[(i + 1) * 4 + 2];
      const bx = p[i * 4];
      const by = p[i * 4 + 1];
      const bz = p[i * 4 + 2];
      const sl = Math.hypot(bx - ax, by - ay, bz - az);
      if (sl < 1e-5) continue;
      if (acc + sl >= len) {
        const f = (len - acc) / sl;
        out.push(ax + (bx - ax) * f, ay + (by - ay) * f, az + (bz - az) * f, len);
        return len;
      }
      acc += sl;
      out.push(bx, by, bz, acc);
    }
    return acc;
  }

  /** Every ribbon's joints for this frame, worked out once (tr.P, tr.total), then drawn layer by layer. */
  const DRAW = [];
  function draw() {
    drawn = 0;
    DRAW.length = 0;
    let need = 0;
    for (const tr of live.values()) {
      if (!tr.P) tr.P = [];
      tr.total = path(tr, tr.P);
      if (!tr.total) continue;
      DRAW.push(tr);
      need += (tr.P.length / 4 - 1) * (tr.cfg.core > 0 ? 3 : 2);
    }
    // short of the strokes' room: the newest ribbons go (a ribbon keeps all its layers or is not drawn)
    const room = lines.room ? lines.room() : Infinity;
    while (DRAW.length && need > room) {
      const tr = DRAW.pop();
      need -= (tr.P.length / 4 - 1) * (tr.cfg.core > 0 ? 3 : 2);
    }
    // layer by layer over every ribbon: every ink line, then every body, then every core (clean joints)
    for (let layer = 0; layer < 3; layer++) {
      S.kind = SOLID;
      S.hdr = 0;
      S.head = 99;
      S.tail = -99;
      S.noise = 7;
      S.bandFreq = 0;
      S.bandSpeed = 0;
      S.a = 1;
      S.minPx = layer === 0 ? MIN_PX.ink : layer === 1 ? MIN_PX.body : MIN_PX.core;
      for (let d = 0; d < DRAW.length; d++) {
        const tr = DRAW[d];
        const c = tr.cfg;
        if (layer === 2 && !(c.core > 0)) continue;
        const P = tr.P;
        const total = tr.total;
        const k = P.length / 4 - 1;
        for (let s = 0; s < k; s++) {
          const ua = P[s * 4 + 3] / total;
          const ub = P[(s + 1) * 4 + 3] / total;
          // tapered: full at the head (u 0), a point at the tail (u 1)
          const wa = c.width * (1 - 0.85 * ua);
          const wb = c.width * (1 - 0.85 * ub);
          S.ax = P[s * 4]; S.ay = P[s * 4 + 1]; S.az = P[s * 4 + 2];
          S.bx = P[(s + 1) * 4]; S.by = P[(s + 1) * 4 + 1]; S.bz = P[(s + 1) * 4 + 2];
          S.ua = ua;
          S.ub = ub;
          S.seed = tr.seed;
          S.cut = 0;
          if (layer === 0) {
            S.wa = wa + 0.014;
            S.wb = wb + 0.014;
            S.r = tr.r * 0.18 + 0.035;
            S.g = tr.g * 0.18 + 0.02;
            S.b = tr.b * 0.18 + 0.07;
          } else if (layer === 1) {
            S.wa = wa;
            S.wb = wb;
            S.r = tr.r;
            S.g = tr.g;
            S.b = tr.b;
          } else {
            S.wa = wa * c.core;
            S.wb = wb * c.core;
            S.r = 0.85 + tr.r * 0.15;
            S.g = 0.85 + tr.g * 0.15;
            S.b = 0.85 + tr.b * 0.15;
          }
          // a dashed tail: erosion that only bites past (1 − dash) along the ribbon
          if (ub > 1 - c.dash) S.cut = Math.min(0.85, ((Math.max(ua, 1 - c.dash) - (1 - c.dash)) / Math.max(c.dash, 1e-3)) * 0.9);
          if (lines.push(S)) drawn++;
        }
      }
    }
  }

  return {
    feed,
    get mesh() {
      return lines.mesh;
    },
    /** Ages the ribbons (shots not fed this frame are pulled in and dropped) and draws them. */
    update(dt) {
      time += dt;
      for (const [uid, tr] of live) {
        if (tr.seen !== frame && tr.gone < 0) tr.gone = time;
        if (tr.gone >= 0 && time - tr.gone >= TRAIL_TAIL) live.delete(uid);
      }
      if (own) lines.begin();
      if (tier.max) draw();
      if (own) lines.end(time);
      frame++;
    },
    setQuality(q) {
      tierId = TRAIL_TIERS[q] ? q : 'medium';
      tier = TRAIL_TIERS[tierId];
      if (!tier.max) live.clear();
    },
    hold(on) {
      if (own) lines.hold(on);
    },
    setPixel(px) {
      if (own) lines.setPixel(px);
    },
    get stats() {
      return { trails: live.size, strokes: drawn, tier: tierId };
    },
    clear() {
      live.clear();
    },
    dispose() {
      live.clear();
      if (own) lines.dispose();
    },
  };
}

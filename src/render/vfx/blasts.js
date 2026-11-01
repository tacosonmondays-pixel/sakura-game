// Toon blasts (docs/specs/VFX_LIBRARY.md batch B6; display only).
//
// A blast is a toon explosion in the house style. Where it lands: a white-hot star (flash-guarded) and a burst of inked
// impact lines. On the spot: a cloud of inked puffs seated on the ground, which slams out bigger than it stays, holds a
// beat, then breaks apart on twos (its puffs pop one by one while the rest shrink). Fire bits are flung out, smoke puffs
// rise after it, dark debris tumbles out, and the ground gets the shapes layer's shockwave ring and a brief scorch.
// Every puff is a round stroke (a zero-length capsule): all the ink discs first, then all the bodies, then the lit discs
// on their upper sides, so the cloud reads as one shape with one ink line round it.
//
//   const blasts = createBlastFx({ scene, strokes, batches, atlas, camera, quality, reduceMotion, rand, shapes });
//   blasts.blast(x, z, radius, color, { volatile, scale })   // world x / z (the sim's x / y), the blast's reach
//   blasts.dim(x, z, k)    // a styled impact drew its own hit there this moment: the star and the hot core drop to k
//   blasts.update(dt)      // the visual clock's dt, between the shared strokes' (and the batches') begin and end
//
// Seating (as the plain blast's cel puffs, src/render/fx.js): the cloud stands in the plane facing the camera through a
// point just above the road, moved toward the camera in depth only, so a walker on the spot has its legs in the cloud and
// its body, head, flash and hold in front. Draw cost: toon strokes (src/render/vfx/strokes.js), sharing the battle's one
// draw call of styled lines; the star and the scorch are quads in the existing batches. Never the sim, never
// Math.random.
import * as THREE from 'three';
import { createStrokes, stroke, SOLID } from './strokes.js';

/** Detail per graphics tier: puffs in the cloud, impact lines, fire bits, smoke puffs, debris, the most blasts up at once. */
export const BLAST_TIERS = {
  high: { puffs: 7, lines: 8, bits: 6, smoke: 3, debris: 5, max: 24 },
  medium: { puffs: 6, lines: 6, bits: 4, smoke: 2, debris: 3, max: 18 },
  low: { puffs: 4, lines: 0, bits: 2, smoke: 1, debris: 0, max: 12 },
};

/**
 * The toon blast (sizes × the cloud's height H = min(radius × scale, cloud.max) × cloud.size, world units; times in s):
 * - cloud: punch (it slams out to `over`), settle (back to 1), hold, then it breaks apart over `pop` (its puffs pop one
 *   by one, the rest shrink by `shrink`); its size changes on `step` (on twos), never under Reduce Motion;
 * - ink: the ink ring round every puff (world units); lit: the lighter disc on each puff's upper side (its share of the
 *   puff, its offset toward the light); core: the white-hot disc in the middle while it punches (× the first puff);
 * - star: its size (× min(radius, cloud.max)) and life; lines: the impact lines (from `from` × H out, `length` × H long);
 * - bits, smoke, debris: their sizes (× H), speeds (world units / s), gravity and lives; scorch: the dark mark's life.
 */
export const TOON_BLAST = {
  cloud: { size: 0.75, max: 1.2, punch: 0.05, over: 1.18, settle: 0.05, hold: 0.08, pop: 0.16, shrink: 0.35, step: 1 / 30 },
  ink: 0.03,
  lit: { share: 0.58, up: 0.42, side: -0.2 },
  core: { share: 0.55, life: 0.09, hdr: 1.6 },
  star: { size: 0.95, life: 0.12 },
  lines: { from: 0.55, length: 0.42, width: 0.028, ink: 0.016, life: 0.18 },
  bits: { size: 0.075, speed: [1.4, 2.8], up: [1.2, 2.4], g: -9, drag: 2.5, life: 0.38 },
  smoke: { at: 0.13, size: 0.15, rise: 0.55, life: 0.45, color: '#8b817c' },
  debris: { length: 0.07, width: 0.02, speed: [1.8, 3.6], up: [2.2, 3.8], g: -12, spin: 14, life: 0.5, color: '#4a3c38' },
  scorch: { life: 1.4, color: '#2a1a14' },
};

/**
 * The cloud's puffs, in the plane facing the camera ([x right, y up, radius] × H): a low wide base and a domed top. Every
 * tier draws the first `puffs` of them; each blast nudges them a little (seeded).
 */
export const CLOUD = [
  [0.0, 0.3, 0.3],
  [-0.3, 0.22, 0.22],
  [0.31, 0.24, 0.23],
  [-0.14, 0.56, 0.24],
  [0.16, 0.58, 0.25],
  [0.0, 0.82, 0.18],
  [-0.42, 0.42, 0.14],
];
/** The pop order of the cloud's puffs (the top and the sides first, the base last). */
const POP = [5, 6, 3, 1, 4, 2, 0];
/** The blast's anchor: just above the road, moved toward the camera in depth (fx.js's SEAT_Y and SEAT_FRONT). */
const SEAT_Y = 0.07;
const SEAT_FRONT = 0.12;
/** The shockwave ring's reach (× the blast's radius): the plain blast's hard ring at its widest. */
export const RING_REACH = 0.78;
/** How long after a blast a styled impact on its spot still dims it (s; fx.js folds explosions over the same gap). */
const DIM_GAP = 0.1;
/** Thinnest each layer is drawn (half width, CSS px): the cloud's discs, then the thin bits (the impact lines and the debris, as the beams' lines). */
const MIN_PX = { ink: 2.2, body: 1.4, core: 0.8, line: 1, chip: 0.6 };
const TAU = Math.PI * 2;

const ease = (k) => 1 - (1 - k) * (1 - k) * (1 - k);
function lin(color) {
  const c = color && color.isColor ? color : new THREE.Color(color || '#ffffff');
  return [c.r, c.g, c.b];
}
const _c = new THREE.Color();
const _w = new THREE.Color('#fff4dc');
const SMOKE_RGB = lin(TOON_BLAST.smoke.color);
const DEBRIS_RGB = lin(TOON_BLAST.debris.color);
const SCORCH_RGB = lin(TOON_BLAST.scorch.color);

/**
 * @param {{ scene: THREE.Object3D, strokes?: object|null, batches?: object|null, atlas?: object|null,
 *   camera?: THREE.Camera|null, quality?: 'high'|'medium'|'low', reduceMotion?: boolean, rand?: () => number,
 *   shapes?: object|null }} o
 */
export function createBlastFx({ scene, strokes = null, batches = null, atlas = null, camera = null, quality = 'medium', reduceMotion = false, rand = null, shapes = null }) {
  let tierId = BLAST_TIERS[quality] ? quality : 'medium';
  let tier = BLAST_TIERS[tierId];
  let bloom = false;
  const own = !strokes;
  const lines = strokes || createStrokes({ scene, max: 2048, name: 'blastFx' });
  const rnd = rand || (() => 0.5);
  const S = stroke();
  const live = [];
  const right = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3(0, -1, 0);
  const R = atlas?.regions || {};
  let time = 0;
  let drawn = 0;
  let seq = 0;

  const lifeOf = (rec) => {
    const C = TOON_BLAST.cloud;
    const cloud = C.punch + C.settle + C.hold + C.pop * (reduceMotion ? 1.6 : 1);
    return Math.max(cloud, TOON_BLAST.smoke.at + TOON_BLAST.smoke.life, TOON_BLAST.debris.life, rec.scorch ? TOON_BLAST.scorch.life : 0);
  };

  /** A blast at (x, z) reaching `radius`: the star, the lines, the cloud, the bits, the smoke, the debris and the ring. */
  function blast(x, z, radius, color, { volatile = false, scale = 1 } = {}) {
    const r = Math.max(0.5, radius || 0);
    const body = volatile ? lin('#ff5a4a') : lin(color);
    _c.setRGB(body[0], body[1], body[2]).lerp(_w, 0.45);
    const lit = [_c.r, _c.g, _c.b];
    const H = Math.min(r * Math.max(0.2, scale), TOON_BLAST.cloud.max) * TOON_BLAST.cloud.size;
    const rec = {
      x, z, r, H, body, lit, volatile, t: 0, starK: 1, coreK: 1, seed: (seq++ % 89) * 0.77,
      ink: [body[0] * 0.18 + 0.035, body[1] * 0.18 + 0.02, body[2] * 0.18 + 0.07],
      puffs: CLOUD.map(([px, py, pr]) => [px + (rnd() - 0.5) * 0.08, py + (rnd() - 0.5) * 0.06, pr * (0.9 + rnd() * 0.2)]),
      rays: [], bits: [], smoke: [], debris: [], scorch: true,
    };
    const nLines = BLAST_TIERS.high.lines;
    for (let i = 0; i < nLines; i++) rec.rays.push([(i / nLines + (rnd() - 0.5) * 0.08) * TAU, 0.7 + 0.6 * rnd()]);
    const B = TOON_BLAST.bits;
    for (let i = 0; i < BLAST_TIERS.high.bits; i++) {
      const a = rnd() * TAU;
      const sp = B.speed[0] + rnd() * (B.speed[1] - B.speed[0]);
      rec.bits.push({ a, sp, vy: B.up[0] + rnd() * (B.up[1] - B.up[0]), s: 0.75 + rnd() * 0.5, d: (0.2 + rnd() * 0.25) * r });
    }
    for (let i = 0; i < BLAST_TIERS.high.smoke; i++) rec.smoke.push([(rnd() - 0.5) * 0.7, 0.55 + rnd() * 0.35, 0.8 + rnd() * 0.4, rnd()]);
    const D = TOON_BLAST.debris;
    for (let i = 0; i < BLAST_TIERS.high.debris; i++) {
      const a = rnd() * TAU;
      rec.debris.push({ a, sp: D.speed[0] + rnd() * (D.speed[1] - D.speed[0]), vy: D.up[0] + rnd() * (D.up[1] - D.up[0]), rot: rnd() * TAU });
    }
    // the star where it lands asks the flash guard (a bright, short flash on the board)
    const st = R.star ? TOONSTAR(r) : 0;
    rec.starK = api.flashGate && st ? api.flashGate(st, R.star, 1) : 1;
    // the shockwave ring on the ground (the shapes layer's toon ring), at the blast's real reach
    shapes?.shock?.(x, z, r * 0.2, r * RING_REACH, volatile ? '#ff5a4a' : color);
    if (live.length >= tier.max) live.shift();
    live.push(rec);
    return rec;
  }
  const TOONSTAR = (r) => Math.min(r, TOON_BLAST.cloud.max) * TOON_BLAST.star.size;

  /** A styled impact drew its own hit near (x, z) this moment: the star and the hot core of a blast there drop to k. */
  function dim(x, z, k = 0.5) {
    for (const rec of live) {
      if (rec.t >= DIM_GAP) continue;
      if (Math.abs(rec.x - x) + Math.abs(rec.z - z) >= 0.5 * rec.r + 0.3) continue;
      rec.starK = Math.min(rec.starK, k);
      rec.coreK = Math.min(rec.coreK, k);
    }
  }

  // ---- drawing ------------------------------------------------------------------------------------------------------
  const A = new THREE.Vector3();
  /** The anchor of a blast: just above the road at its spot, moved toward the camera (depth only). */
  function anchor(rec) {
    A.set(rec.x - dir.x * SEAT_FRONT, SEAT_Y - dir.y * SEAT_FRONT, rec.z - dir.z * SEAT_FRONT);
    return A;
  }
  const disc = (px, py, pz, w) => {
    S.ax = px; S.ay = py; S.az = pz;
    S.bx = px; S.by = py; S.bz = pz;
    S.wa = w;
    S.wb = w;
    if (lines.push(S)) drawn++;
  };
  const rgb = (c, k = 1) => {
    S.r = c[0] * k;
    S.g = c[1] * k;
    S.b = c[2] * k;
  };

  /**
   * The cloud now, into the record: its size (× each puff's radius), how many of its puffs have popped and its strength.
   * It changes on twos (`cloud.step`), never under Reduce Motion, where it grows in gently, holds and fades instead.
   */
  function cloudNow(rec) {
    const C = TOON_BLAST.cloud;
    const t = reduceMotion ? rec.t : Math.floor(rec.t / C.step + 1e-6) * C.step;
    rec.n = Math.min(tier.puffs, rec.puffs.length);
    rec.popped = 0;
    rec.alpha = 1;
    const hold = C.punch + C.settle + C.hold;
    if (reduceMotion) {
      rec.size = 0.85 + 0.15 * Math.min(1, t / (C.punch + C.settle));
      rec.alpha = t <= hold ? 1 : Math.max(0, 1 - (t - hold) / (C.pop * 1.6));
    } else if (t < C.punch) rec.size = 0.35 + (C.over - 0.35) * ease(t / C.punch);
    else if (t < C.punch + C.settle) rec.size = C.over + (1 - C.over) * ((t - C.punch) / C.settle);
    else if (t < hold) rec.size = 1;
    else {
      const k = Math.min(1, (t - hold) / C.pop);
      rec.size = 1 - C.shrink * k;
      rec.popped = Math.min(rec.n, Math.floor(k * rec.n + 1e-6) + 1);
      if (k >= 1) rec.alpha = 0;
    }
  }
  /** Is puff i of a cloud of n puffs still up, after `popped` have popped (POP order, only the first n)? */
  function upNow(i, n, popped) {
    let gone = 0;
    for (const p of POP) {
      if (p >= n) continue;
      if (gone >= popped) return true;
      if (p === i) return false;
      gone++;
    }
    return true;
  }

  const DRAW = [];
  function draw() {
    drawn = 0;
    DRAW.length = 0;
    let need = 0;
    for (const rec of live) {
      cloudNow(rec);
      rec.need = strokesOf(rec);
      if (!rec.need) continue;
      DRAW.push(rec);
      need += rec.need;
    }
    // short of the strokes' room: the newest blasts go (a blast keeps all its layers or is not drawn)
    const room = lines.room ? lines.room() : Infinity;
    while (DRAW.length && need > room) need -= DRAW.pop().need;
    S.kind = SOLID;
    S.noise = 8;
    S.bandFreq = 0;
    S.bandSpeed = 0;
    S.head = 99;
    S.tail = -99;
    S.cut = 0;
    S.ua = 0;
    S.ub = 0;
    // back to front: smoke and debris (behind the cloud), impact lines, the cloud (ink, body, lit, core), fire bits
    smokeLayer(0);
    smokeLayer(1);
    debrisLayer(0);
    debrisLayer(1);
    lineLayer(0);
    lineLayer(1);
    for (let layer = 0; layer < 4; layer++) cloudLayer(layer);
    bitLayer(0);
    bitLayer(1);
  }

  const linesNow = (rec) => (reduceMotion || rec.t >= TOON_BLAST.lines.life ? 0 : Math.min(tier.lines, rec.rays.length));
  const bitsNow = (rec) => (rec.t >= TOON_BLAST.bits.life ? 0 : Math.min(reduceMotion ? Math.ceil(tier.bits / 2) : tier.bits, rec.bits.length));
  const smokeNow = (rec) => {
    const k = (rec.t - TOON_BLAST.smoke.at) / (TOON_BLAST.smoke.life * (reduceMotion ? 1.3 : 1));
    return k < 0 || k >= 1 ? 0 : Math.min(tier.smoke, rec.smoke.length);
  };
  const debrisNow = (rec) => (rec.t >= TOON_BLAST.debris.life ? 0 : Math.min(tier.debris, rec.debris.length));
  function strokesOf(rec) {
    let up = 0;
    if (rec.alpha > 0) for (let i = 0; i < rec.n; i++) if (upNow(i, rec.n, rec.popped)) up++;
    const core = rec.t < TOON_BLAST.core.life && rec.alpha > 0 ? 1 : 0;
    return up * 3 + core + linesNow(rec) * 2 + bitsNow(rec) * 2 + smokeNow(rec) * 2 + debrisNow(rec) * 2;
  }

  function cloudLayer(layer) {
    S.minPx = layer === 0 ? MIN_PX.ink : layer === 3 ? MIN_PX.core : MIN_PX.body;
    const L = TOON_BLAST.lit;
    for (const rec of DRAW) {
      if (rec.alpha <= 0) continue;
      const a = anchor(rec);
      S.seed = rec.seed;
      S.a = rec.alpha;
      S.hdr = 0;
      if (layer === 3) {
        // the white-hot core in the middle while it punches (over white on high with bloom, for the bloom)
        if (rec.t >= TOON_BLAST.core.life) continue;
        const [px, py, pr] = rec.puffs[0];
        const w = pr * rec.H * rec.size * TOON_BLAST.core.share * (1 - (rec.t / TOON_BLAST.core.life) * 0.4);
        S.r = 1;
        S.g = 0.95;
        S.b = 0.8;
        S.a = rec.alpha * rec.coreK;
        S.hdr = bloom && tierId === 'high' ? TOON_BLAST.core.hdr : 0;
        disc(a.x + right.x * px * rec.H + up.x * py * rec.H, a.y + right.y * px * rec.H + up.y * py * rec.H, a.z + right.z * px * rec.H + up.z * py * rec.H, w);
        continue;
      }
      rgb(layer === 0 ? rec.ink : layer === 1 ? rec.body : rec.lit);
      for (let i = 0; i < rec.n; i++) {
        if (!upNow(i, rec.n, rec.popped)) continue;
        const [px, py, pr] = rec.puffs[i];
        let ox = px;
        let oy = py;
        let w = pr * rec.H * rec.size;
        if (layer === 0) w += TOON_BLAST.ink;
        else if (layer === 2) {
          ox += L.side * pr * (1 - L.share);
          oy += L.up * pr * (1 - L.share);
          w *= L.share;
        }
        disc(a.x + (right.x * ox + up.x * oy) * rec.H, a.y + (right.y * ox + up.y * oy) * rec.H, a.z + (right.z * ox + up.z * oy) * rec.H, w);
      }
    }
  }

  function lineLayer(layer) {
    const L = TOON_BLAST.lines;
    S.minPx = MIN_PX.line;
    S.hdr = 0;
    for (const rec of DRAW) {
      const n = linesNow(rec);
      if (!n) continue;
      const k = rec.t / L.life;
      const a = anchor(rec);
      const cx = a.x + up.x * 0.38 * rec.H;
      const cy = a.y + up.y * 0.38 * rec.H;
      const cz = a.z + up.z * 0.38 * rec.H;
      S.seed = rec.seed;
      S.a = rec.starK;
      if (layer === 0) rgb(rec.ink);
      else {
        S.r = 0.85 + rec.lit[0] * 0.15;
        S.g = 0.85 + rec.lit[1] * 0.15;
        S.b = 0.85 + rec.lit[2] * 0.15;
      }
      const extra = layer === 0 ? L.ink : 0;
      for (let i = 0; i < n; i++) {
        const [ang, sz] = rec.rays[i];
        const r0 = rec.H * (L.from + 0.45 * ease(k)) * sz;
        const r1 = r0 + rec.H * L.length * sz * (1 - k);
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const dx = right.x * ca + up.x * sa;
        const dy = right.y * ca + up.y * sa;
        const dz = right.z * ca + up.z * sa;
        S.ax = cx + dx * r0; S.ay = cy + dy * r0; S.az = cz + dz * r0;
        S.bx = cx + dx * r1; S.by = cy + dy * r1; S.bz = cz + dz * r1;
        S.wa = L.width * (1 - 0.6 * k) + extra;
        S.wb = L.width * 0.25 + extra;
        S.ua = 0;
        S.ub = 1;
        if (lines.push(S)) drawn++;
      }
      S.ua = 0;
      S.ub = 0;
    }
  }

  function bitLayer(layer) {
    const B = TOON_BLAST.bits;
    S.minPx = layer === 0 ? MIN_PX.ink : MIN_PX.body;
    S.hdr = 0;
    S.a = 1;
    for (const rec of DRAW) {
      const n = bitsNow(rec);
      if (!n) continue;
      const t = rec.t;
      const k = t / B.life;
      // drag on the way out, gravity on the way up (x, z decay; y a ballistic arc from just above the ground)
      const go = (1 - Math.exp(-B.drag * t)) / B.drag;
      rgb(layer === 0 ? rec.ink : rec.lit);
      S.seed = rec.seed;
      for (let i = 0; i < n; i++) {
        const b = rec.bits[i];
        const px = rec.x + Math.cos(b.a) * (b.d + b.sp * go);
        const pz = rec.z + Math.sin(b.a) * (b.d + b.sp * go);
        const py = Math.max(0.06, 0.25 + b.vy * t + 0.5 * B.g * t * t);
        let w = B.size * rec.H * b.s * (1 - 0.7 * k);
        if (layer === 0) w += TOON_BLAST.ink * 0.7;
        disc(px, py, pz, w);
      }
    }
  }

  function smokeLayer(layer) {
    const M = TOON_BLAST.smoke;
    S.minPx = layer === 0 ? MIN_PX.ink : MIN_PX.body;
    S.hdr = 0;
    for (const rec of DRAW) {
      const n = smokeNow(rec);
      if (!n) continue;
      const life = M.life * (reduceMotion ? 1.3 : 1);
      const k = (rec.t - M.at) / life;
      const a = anchor(rec);
      S.seed = rec.seed;
      rgb(layer === 0 ? rec.ink : SMOKE_RGB, layer === 0 ? 0.6 : 1);
      // they swell, rise and pop on twos (Reduce Motion: they fade instead)
      const kq = reduceMotion ? k : Math.floor(k * 8) / 8;
      S.a = reduceMotion ? Math.min(1, (1 - k) * 2) : 1;
      for (let i = 0; i < n; i++) {
        const [ox, oy, sz, pop] = rec.smoke[i];
        if (!reduceMotion && kq > 0.62 + pop * 0.3) continue;
        let w = M.size * rec.H * sz * (0.6 + 0.4 * ease(Math.min(1, kq * 2.5)));
        if (layer === 0) w += TOON_BLAST.ink * 0.8;
        const sx = ox * rec.H;
        const sy = (oy + M.rise * kq) * rec.H;
        disc(a.x + right.x * sx + up.x * sy, a.y + right.y * sx + up.y * sy, a.z + right.z * sx + up.z * sy, w);
      }
    }
  }

  function debrisLayer(layer) {
    const D = TOON_BLAST.debris;
    S.minPx = layer === 0 ? MIN_PX.line : MIN_PX.chip;
    S.hdr = 0;
    S.a = 1;
    for (const rec of DRAW) {
      const n = debrisNow(rec);
      if (!n) continue;
      const t = rec.t;
      S.seed = rec.seed;
      if (layer === 0) {
        S.r = 0.06;
        S.g = 0.04;
        S.b = 0.05;
      } else rgb(DEBRIS_RGB);
      for (let i = 0; i < n; i++) {
        const d = rec.debris[i];
        const px = rec.x + Math.cos(d.a) * d.sp * t;
        const pz = rec.z + Math.sin(d.a) * d.sp * t;
        const py = Math.max(0.05, 0.3 + d.vy * t + 0.5 * D.g * t * t);
        // a chip tumbling on screen (Reduce Motion: it keeps its turn)
        const ang = d.rot + (reduceMotion ? 0 : D.spin * t);
        const ca = Math.cos(ang) * D.length * 0.5;
        const sa = Math.sin(ang) * D.length * 0.5;
        S.ax = px - right.x * ca - up.x * sa; S.ay = py - right.y * ca - up.y * sa; S.az = pz - right.z * ca - up.z * sa;
        S.bx = px + right.x * ca + up.x * sa; S.by = py + right.y * ca + up.y * sa; S.bz = pz + right.z * ca + up.z * sa;
        S.wa = D.width + (layer === 0 ? 0.012 : 0);
        S.wb = S.wa;
        if (lines.push(S)) drawn++;
      }
    }
  }

  /** The star and the scorch: quads in the existing batches. */
  function quads(rec) {
    if (!batches) return;
    const t = rec.t;
    if (R.star && t < TOON_BLAST.star.life && rec.starK > 0) {
      const k = t / TOON_BLAST.star.life;
      const s = TOONSTAR(rec.r) * (0.6 + 0.4 * ease(Math.min(1, k * 3)));
      const a = anchor(rec);
      const y = a.y + up.y * 0.38 * rec.H;
      batches.bbA?.push(a.x + up.x * 0.38 * rec.H, y, a.z + up.z * 0.38 * rec.H, s, s, R.star, 1, 0.95, 0.85, (1 - k) * rec.starK, reduceMotion ? 0 : rec.seed + t * 3);
    }
    if (R.shadow && rec.scorch && t < TOON_BLAST.scorch.life) {
      const k = t / TOON_BLAST.scorch.life;
      const s = rec.r * (1.3 + 0.2 * Math.min(1, k * 4));
      batches.groundN?.push(rec.x, 0.03, rec.z, s, s, R.shadow, SCORCH_RGB[0], SCORCH_RGB[1], SCORCH_RGB[2], 0.35 * (1 - k), 0);
    }
  }

  const api = {
    blast,
    dim,
    /** The flash guard's gate for world flashes ((size, uv, strength) → strength multiplier); set by the renderer. */
    flashGate: null,
    get mesh() {
      return lines.mesh;
    },
    update(dt) {
      time += dt;
      if (camera) {
        camera.updateMatrixWorld?.();
        right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
        up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
        camera.getWorldDirection(dir);
      }
      for (let i = live.length - 1; i >= 0; i--) {
        const rec = live[i];
        rec.t += dt;
        if (rec.t > lifeOf(rec)) live.splice(i, 1);
      }
      if (own) lines.begin();
      draw();
      for (const rec of live) quads(rec);
      if (own) lines.end(time);
    },
    setQuality(q) {
      tierId = BLAST_TIERS[q] ? q : 'medium';
      tier = BLAST_TIERS[tierId];
    },
    /** Bloom on (high only): the hot core goes above white. */
    setGlow(q, on) {
      bloom = q === 'high' && !!on;
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
      return { blasts: live.length, strokes: drawn, tier: tierId };
    },
    clear() {
      live.length = 0;
    },
    dispose() {
      live.length = 0;
      if (own) lines.dispose();
    },
  };
  return api;
}
